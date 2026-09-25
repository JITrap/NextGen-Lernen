import type { Project } from '@/types';
import { createEmptyProject, createHall } from '@/store/factories';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  /** Erzeugt ein neues Projekt (mit frischen IDs). */
  create: (name?: string) => Project;
}

/** Platzhalter – wird durch die vollständigen Vorlagen (leere Halle, kleines/mittleres Studio) ersetzt. */
export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'empty-20x25',
    name: 'Leere Halle 20 × 25 m',
    description: '500 m² Rechteckhalle ohne Einrichtung',
    create: (name = 'Leere Halle 20 × 25 m') => {
      const p = createEmptyProject(name);
      p.floors[0].hall = createHall(2500, 2000);
      return p;
    },
  },
];
