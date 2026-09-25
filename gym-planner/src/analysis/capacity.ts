/**
 * Kapazität: gleichzeitig Trainierende (Trainingsfläche / m² pro Person) sowie Spinde, Duschen und WCs
 * (Ist vs. Richtwert). Richtwerte: 1 Spind je Person, 1 Dusche je 10–15 Personen (Minimum 1/15,
 * empfohlen 1/10), 1 WC je 25 Personen (Urinale zählen mit).
 *
 * Trainingsfläche = Flächenklasse „Trainingsfläche“ der Bilanz. Hat ein Stockwerk keine typisierten Räume/Zonen
 * (nur die leere Halle bzw. Auto-Räume ohne gewählten Typ), gilt seine gesamte Nettofläche als Trainingsfläche
 * (Kennzeichen usedNettoFallback).
 */
import type { Project, Id } from '@/types';
import { analysisContext, memoByProject, numParam, symbolOf, type FloorContext, type AnalysisContext } from './common';
import { areaBalance } from './areaBalance';

export type CapacityKey = 'lockers' | 'showers' | 'toilets';
export type CapacityStatus = 'ok' | 'warn' | 'danger';

export interface CapacityCounter {
  key: CapacityKey;
  label: string;
  /** Vorhanden. */
  actual: number;
  /** Mindestbedarf. */
  required: number;
  /** Empfohlen (≥ Mindestbedarf). */
  recommended: number;
  status: CapacityStatus;
  /** Hinweistext bei Unterschreitung des Mindestbedarfs, sonst null. */
  hint: string | null;
  /** Kurze Erläuterung des Richtwerts / Zusammensetzung. */
  detail: string;
}
export interface FloorCapacity {
  floorId: Id;
  floorName: string;
  trainingM2: number;
  usedNettoFallback: boolean;
  persons: number;
  lockers: number;
  showers: number;
  toilets: number;
  urinals: number;
}
export interface Capacity {
  m2PerPerson: number;
  trainingM2: number;
  persons: number;
  counters: CapacityCounter[];
  floors: FloorCapacity[];
  usedNettoFallback: boolean;
  lockers: number;
  showers: number;
  toilets: number;
  urinals: number;
}

interface Facilities { lockers: number; showers: number; toilets: number; urinals: number }

/** Zählt Spinde, Duschen, WCs und Urinale eines Stockwerks anhand der Symbole. */
export function countFacilities(fc: FloorContext, ctx: AnalysisContext): Facilities {
  const f: Facilities = { lockers: 0, showers: 0, toilets: 0, urinals: 0 };
  for (const it of fc.items) {
    const def = ctx.def(it.defId);
    switch (symbolOf(def)) {
      case 'locker':
        f.lockers += Math.max(1, Math.round(numParam(it, def, 'faecher') ?? 1));
        break;
      case 'locker-row': {
        const faecher = numParam(it, def, 'faecher');
        f.lockers += Math.max(1, Math.round(faecher ?? it.width / 40));
        break;
      }
      case 'shower':
        f.showers += Math.max(1, Math.round(numParam(it, def, 'anzahl') ?? 1));
        break;
      case 'shower-row': {
        const anzahl = numParam(it, def, 'anzahl');
        f.showers += Math.max(1, Math.round(anzahl ?? it.width / 90));
        break;
      }
      case 'toilet':
        f.toilets += Math.max(1, Math.round(numParam(it, def, 'anzahl') ?? 1));
        break;
      case 'urinal':
        f.urinals += Math.max(1, Math.round(numParam(it, def, 'anzahl') ?? 1));
        break;
      default:
        break;
    }
  }
  return f;
}

function personsFor(trainingM2: number, m2PerPerson: number): number {
  if (!Number.isFinite(m2PerPerson) || m2PerPerson <= 0 || trainingM2 <= 0) return 0;
  return Math.floor(trainingM2 / m2PerPerson + 1e-9);
}

function statusFor(actual: number, required: number, recommended: number): CapacityStatus {
  if (actual < required) return 'danger';
  if (actual < recommended) return 'warn';
  return 'ok';
}

/** Kapazitäts-Auswertung des Projekts (memoisiert am Projekt-Objekt). */
export const capacity: (project: Project) => Capacity = memoByProject((project) => {
  const ctx = analysisContext(project);
  const balance = areaBalance(project);
  const m2PerPerson = project.settings.m2PerPerson;
  const totals: Facilities = { lockers: 0, showers: 0, toilets: 0, urinals: 0 };
  let trainingM2 = 0;
  let usedNettoFallback = false;
  const floors: FloorCapacity[] = ctx.floors.map((fc, i) => {
    const fb = balance.floors[i];
    const fallback = fc.typedRoomCount === 0;
    const t = fallback ? fb.nettoM2 : fb.trainingM2;
    if (fallback && t > 0) usedNettoFallback = true;
    trainingM2 += t;
    const fac = countFacilities(fc, ctx);
    totals.lockers += fac.lockers;
    totals.showers += fac.showers;
    totals.toilets += fac.toilets;
    totals.urinals += fac.urinals;
    return { floorId: fc.floor.id, floorName: fc.floor.name, trainingM2: t, usedNettoFallback: fallback && t > 0, persons: personsFor(t, m2PerPerson), ...fac };
  });
  const persons = personsFor(trainingM2, m2PerPerson);

  const lockersReq = persons;
  const showersReq = Math.ceil(persons / 15);
  const showersRec = Math.ceil(persons / 10);
  const wcReq = Math.ceil(persons / 25);
  const wcActual = totals.toilets + totals.urinals;

  const counters: CapacityCounter[] = [
    {
      key: 'lockers',
      label: 'Spinde',
      actual: totals.lockers,
      required: lockersReq,
      recommended: lockersReq,
      status: statusFor(totals.lockers, lockersReq, lockersReq),
      hint: totals.lockers < lockersReq ? `Zu wenige Spinde: ${totals.lockers} vorhanden, mind. ${lockersReq} empfohlen (1 Spind je Person).` : null,
      detail: '1 Spind je Person',
    },
    {
      key: 'showers',
      label: 'Duschen',
      actual: totals.showers,
      required: showersReq,
      recommended: showersRec,
      status: statusFor(totals.showers, showersReq, showersRec),
      hint: totals.showers < showersReq ? `Zu wenige Duschen: ${totals.showers} vorhanden, mind. ${showersReq} empfohlen (1 Dusche je 10–15 Personen).` : null,
      detail: '1 Dusche je 10–15 Personen',
    },
    {
      key: 'toilets',
      label: 'WCs',
      actual: wcActual,
      required: wcReq,
      recommended: wcReq,
      status: statusFor(wcActual, wcReq, wcReq),
      hint: wcActual < wcReq ? `Zu wenige WCs: ${wcActual} vorhanden, mind. ${wcReq} empfohlen (1 WC je 25 Personen, Urinale zählen mit).` : null,
      detail: totals.urinals > 0 ? `${totals.toilets} WC + ${totals.urinals} Urinale · 1 WC je 25 Personen` : '1 WC je 25 Personen (Urinale zählen mit)',
    },
  ];

  return { m2PerPerson, trainingM2, persons, counters, floors, usedNettoFallback, ...totals };
});
