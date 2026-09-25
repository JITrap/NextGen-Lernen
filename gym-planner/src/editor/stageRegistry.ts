import type Konva from 'konva';

let stage: Konva.Stage | null = null;
const listeners = new Set<() => void>();

/** Registriert die aktive Konva-Stage (für Export & Fokus-Steuerung). */
export function setStage(s: Konva.Stage | null) {
  stage = s;
  listeners.forEach((l) => l());
}
export function getStage(): Konva.Stage | null {
  return stage;
}
export function onStageChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
