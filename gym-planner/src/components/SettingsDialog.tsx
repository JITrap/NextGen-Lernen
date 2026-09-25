import { useEffect, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { TextInput } from './ui/Input';
import { LayerToggles, ProjectSettingsFields, UiSettingsFields } from './LayersPanel';
import { formatDateTime } from './ui/hooks';

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Einstellungs-Dialog (aus der Kopfleiste): Projektname + Projekt-/UI-Einstellungen, Ebenen. */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const project = useProjectStore((s) => s.project);
  const renameProject = useProjectStore((s) => s.renameProject);
  const [name, setName] = useState(project.name);
  useEffect(() => {
    if (open) setName(project.name);
  }, [open, project.name]);
  const commitName = () => {
    const n = name.trim();
    if (n && n !== project.name) renameProject(n);
    else setName(project.name);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Einstellungen"
      width={720}
      footer={
        <Button variant="primary" data-primary="true" onClick={onClose}>
          Fertig
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="gp-label">Projekt</span>
            <TextInput
              label="Projektname"
              value={name}
              onChange={setName}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitName();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              maxLength={80}
            />
            <div className="text-xs gp-muted">
              {project.variantName && (
                <div>
                  Variante: <strong>{project.variantName}</strong>
                </div>
              )}
              <div>Erstellt: {formatDateTime(project.createdAt)}</div>
              <div>Zuletzt geändert: {formatDateTime(project.updatedAt)}</div>
              <div>
                {project.floors.length} {project.floors.length === 1 ? 'Stockwerk' : 'Stockwerke'} · {project.floors.reduce((n, f) => n + f.items.length, 0)} Objekte
              </div>
            </div>
          </div>
          <ProjectSettingsFields compact />
        </div>
        <div className="flex flex-col gap-4">
          <LayerToggles />
          <UiSettingsFields />
        </div>
      </div>
    </Modal>
  );
}
