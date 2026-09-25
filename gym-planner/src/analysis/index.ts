/**
 * Analyse-API: reine Funktionen über dem Projekt (memoisiert am immutablen Projekt-Objekt).
 *
 *   areaBalance(project)     → Flächenbilanz je Stockwerk + gesamt
 *   equipmentStats(project)  → Geräte-Statistik
 *   floorLoad(project)       → Gewicht & Bodenlast
 *   capacity(project)        → Personen, Spinde/Duschen/WCs
 *   bom(project)             → Stückliste
 *   warnings(project)        → PlanningWarning[] (sortiert), warningFocus(project, w) zum Hinspringen
 */
export * from './clip';
export * from './common';
export * from './areaBalance';
export * from './equipmentStats';
export * from './floorLoad';
export * from './capacity';
export * from './bom';
export * from './warnings';
