/**
 * Regularien-Prüfung (Gerüst): Fluchtwege und Notausgänge (ASR A2.3 / MBO), Brandschutz (ASR A2.2), Erste Hilfe
 * (ASR A4.3 / DGUV Vorschrift 1), Kennzeichnung (ASR A1.3), Sicherheitsbeleuchtung (ASR A3.4/7), Barrierefreiheit
 * (DIN 18040-1), Sanitär (ASR A4.1) und Gerätefreiräume (DIN EN ISO 20957). Jede Prüfung liefert Ist/Soll, Status,
 * Erläuterung und Quelle; `target` erlaubt das Hinspringen im Plan.
 */
import type { Project, Id, PlanningWarning } from '@/types';
import { memoByProject } from './common';

export type RegulationStatus = 'ok' | 'warn' | 'fail' | 'info' | 'na';
export const REGULATION_STATUS_LABELS: Record<RegulationStatus, string> = { ok: 'erfüllt', warn: 'prüfen', fail: 'nicht erfüllt', info: 'Hinweis', na: 'nicht anwendbar' };

export interface RegulationCheck {
  id: string;
  /** Themenblock, z. B. „Fluchtwege“, „Brandschutz“, „Erste Hilfe“. */
  thema: string;
  titel: string;
  status: RegulationStatus;
  ist: string;
  soll: string;
  erlaeuterung: string;
  quelle: string;
  quelleUrl?: string;
  floorId?: Id;
  target?: PlanningWarning['target'];
}

export interface RegulationReport {
  checks: RegulationCheck[];
  counts: Record<RegulationStatus, number>;
  /** Bemessungspersonenzahl (Kapazität + Beschäftigte). */
  persons: number;
}

export const regulations = memoByProject((_project: Project): RegulationReport => ({
  checks: [],
  counts: { ok: 0, warn: 0, fail: 0, info: 0, na: 0 },
  persons: 0,
}));
