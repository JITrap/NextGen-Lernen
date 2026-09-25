/**
 * Export-API (Platzhalter – wird vom Export-Modul implementiert).
 * Alle Funktionen arbeiten auf dem aktuellen Projekt aus dem Store.
 */
import type { Project } from '@/types';

export async function exportPng(_opts?: { floorId?: string; scaleFactor?: number }): Promise<void> {}
export async function exportPdf(_opts?: { floorIds?: string[]; scale?: 50 | 100 | 200 }): Promise<void> {}
export function exportCsv(): void {}
export function exportJson(_project?: Project): void {}
/** Öffnet einen Dateidialog und importiert ein Projekt-JSON. */
export async function importJsonFile(): Promise<Project | null> { return null; }
export function serializeProject(p: Project): string { return JSON.stringify(p, null, 2); }
export function parseProject(json: string): Project { return JSON.parse(json) as Project; }
