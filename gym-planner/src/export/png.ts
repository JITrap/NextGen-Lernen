/**
 * PNG-Export eines Stockwerks in hoher Auflösung.
 * pxPerCm = PNG_BASE_PX_PER_CM · scaleFactor (Standard 2 → 1,2 px/cm → ca. 3000 × 2400 px bei 25 × 20 m),
 * begrenzt auf MAX_IMAGE_PX für die längste Seite.
 */
import type { Project, Floor } from '@/types';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { renderFloorToCanvas, layoutFloorRender, clampPxPerCm, MAX_IMAGE_PX } from './planRenderer';
import { downloadBlob, safeFileName } from './json';

export const PNG_BASE_PX_PER_CM = 0.6;

export interface PngOptions {
  /** Stockwerk (Standard: aktives). */
  floorId?: string;
  /** Auflösungsfaktor (Standard 2). */
  scaleFactor?: number;
  /** Sicherheitszonen zeichnen (Standard: true). */
  safetyZones?: boolean;
  /** Transparenter Hintergrund statt Weiß. */
  transparent?: boolean;
  /** Legende unter dem Plan (Standard: true). */
  legend?: boolean;
  /** Ohne Download – liefert nur den Blob (z. B. für Tests/Vorschau). */
  download?: boolean;
}

/** Effektive Pixel je cm für ein Stockwerk (inkl. Begrenzung auf MAX_IMAGE_PX). */
export function pngPxPerCm(project: Project, floor: Floor, scaleFactor = 2, safetyZones = true): number {
  const base = PNG_BASE_PX_PER_CM * Math.max(0.1, scaleFactor);
  const layout = layoutFloorRender(project, floor, { pxPerCm: base, safetyZones });
  return clampPxPerCm(base, layout.bounds, MAX_IMAGE_PX);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas konnte nicht in PNG umgewandelt werden.'))), 'image/png');
    } else {
      try {
        const url = canvas.toDataURL('image/png');
        const bin = atob(url.split(',')[1]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        resolve(new Blob([bytes], { type: 'image/png' }));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    }
  });
}

function resolveFloor(project: Project, floorId?: string): Floor | null {
  if (!project.floors.length) return null;
  return project.floors.find((f) => f.id === (floorId ?? project.activeFloorId)) ?? project.floors[0];
}

/** Rendert ein Stockwerk als PNG-Blob (ohne Download). */
export async function renderFloorPng(project: Project, floor: Floor, opts: PngOptions = {}): Promise<{ blob: Blob; widthPx: number; heightPx: number }> {
  const pxPerCm = pngPxPerCm(project, floor, opts.scaleFactor ?? 2, opts.safetyZones ?? true);
  const r = renderFloorToCanvas(project, floor, {
    pxPerCm,
    safetyZones: opts.safetyZones ?? true,
    legend: opts.legend ?? true,
    background: opts.transparent ? null : '#ffffff',
  });
  try {
    const blob = await canvasToBlob(r.canvas);
    return { blob, widthPx: r.widthPx, heightPx: r.heightPx };
  } finally {
    // Speicher auch bei Fehlern freigeben
    r.canvas.width = 0;
    r.canvas.height = 0;
  }
}

/** PNG des aktiven (oder angegebenen) Stockwerks herunterladen: „<Projekt>-<Stockwerk>.png“. */
export async function exportPng(opts: PngOptions = {}): Promise<void> {
  const ui = useUiStore.getState();
  const project = useProjectStore.getState().project;
  const floor = resolveFloor(project, opts.floorId);
  if (!floor) { ui.toast('Kein Stockwerk vorhanden – PNG-Export nicht möglich.', 'warning'); return; }
  try {
    const { blob, widthPx, heightPx } = await renderFloorPng(project, floor, opts);
    if (opts.download !== false) downloadBlob(blob, `${safeFileName(project.name)}-${safeFileName(floor.name, 'Stockwerk')}.png`);
    ui.toast(`PNG „${floor.name}“ exportiert (${widthPx} × ${heightPx} px).`, 'success');
  } catch (e) {
    ui.toast(`PNG-Export fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, 'error');
  }
}

/** Alle Stockwerke nacheinander als PNG exportieren. */
export async function exportAllFloorsPng(opts: Omit<PngOptions, 'floorId'> = {}): Promise<void> {
  const project = useProjectStore.getState().project;
  const floors = [...project.floors].sort((a, b) => a.order - b.order);
  for (const f of floors) {
    await exportPng({ ...opts, floorId: f.id });
    // kurze Pause, damit der Browser mehrere Downloads nacheinander zulässt
    await new Promise((r) => setTimeout(r, 300));
  }
}
