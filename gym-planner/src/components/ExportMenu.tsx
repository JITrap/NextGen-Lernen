import { useState, type ReactNode } from 'react';
import { Download, FileImage, FileText, Table, FileJson, Upload, ChevronDown, LoaderCircle } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import { createProject } from '@/store/persistence';
import { exportPng, exportPdf, exportCsv, exportJson, importJsonFile } from '@/export';
import { Dropdown } from './ui/Menu';
import { Button, IconButton } from './ui/Button';
import { Select } from './ui/Select';
import { ConfirmDialog } from './ui/Modal';

export type PdfScale = 50 | 100 | 200;
const PDF_SCALES: { value: PdfScale; label: string }[] = [
  { value: 50, label: '1:50' },
  { value: 100, label: '1:100' },
  { value: 200, label: '1:200' },
];

export type ExportKind = 'png' | 'pdf' | 'csv' | 'json' | 'import';

/** Führt eine Export-/Import-Aktion mit Fehlerbehandlung und Toasts aus (auch außerhalb des Menüs nutzbar). */
export async function runExport(kind: ExportKind, opts: { pdfScale?: PdfScale } = {}): Promise<void> {
  const ui = useUiStore.getState();
  try {
    switch (kind) {
      case 'png':
        await exportPng({ floorId: useProjectStore.getState().project.activeFloorId });
        ui.toast('PNG exportiert', 'success');
        break;
      case 'pdf':
        await exportPdf({ scale: opts.pdfScale ?? 100 });
        ui.toast(`PDF (1:${opts.pdfScale ?? 100}) exportiert`, 'success');
        break;
      case 'csv':
        exportCsv();
        ui.toast('Stückliste als CSV exportiert', 'success');
        break;
      case 'json':
        exportJson(useProjectStore.getState().project);
        ui.toast('Projekt als JSON exportiert', 'success');
        break;
      case 'import': {
        const p = await importJsonFile();
        if (p) {
          // Als (neues) Projekt registrieren und öffnen; bei bereits vorhandener ID entsteht eine Kopie.
          await createProject(p);
          const u = useUiStore.getState();
          u.clearSelection();
          u.requestFit();
          u.toast(`Projekt „${p.name}“ importiert`, 'success');
        }
        break;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.toast(`${kind === 'import' ? 'Import' : 'Export'} fehlgeschlagen: ${msg}`, 'error');
  }
}

function Row({ icon, label, hint, onClick, busy, children }: { icon: ReactNode; label: string; hint?: string; onClick: () => void; busy: 'idle' | 'this' | 'other'; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2 py-0.5">
      <button
        type="button"
        role="menuitem"
        disabled={busy !== 'idle'}
        onClick={onClick}
        className="flex min-h-[40px] flex-1 items-center gap-2.5 rounded-md px-2 text-left text-sm transition-colors hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <span className="inline-flex w-5 shrink-0 justify-center gp-muted" aria-hidden="true">
          {busy === 'this' ? <LoaderCircle size={16} className="animate-spin" /> : icon}
        </span>
        <span className="flex min-w-0 flex-col">
          <span>{busy === 'this' ? `${label} …` : label}</span>
          {hint && <span className="text-[11px] gp-muted">{hint}</span>}
        </span>
      </button>
      {children}
    </div>
  );
}

/**
 * Export-Menü: PNG, PDF (Maßstab 1:50/1:100/1:200), CSV-Stückliste, JSON exportieren/importieren.
 * `compact` zeigt nur das Icon (schmale Bildschirme).
 */
export function ExportMenu({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [pdfScale, setPdfScale] = useState<PdfScale>(100);
  const [confirmImport, setConfirmImport] = useState(false);
  const projectName = useProjectStore((s) => s.project.name);

  const run = async (kind: ExportKind) => {
    if (busy) return;
    setBusy(kind);
    try {
      await runExport(kind, { pdfScale });
    } finally {
      setBusy(null);
    }
  };
  const state = (k: ExportKind): 'idle' | 'this' | 'other' => (busy === null ? 'idle' : busy === k ? 'this' : 'other');

  return (
    <>
      <Dropdown
        placement="bottom-end"
        ariaLabel="Export"
        trigger={({ open, toggle }) =>
          compact ? (
            <IconButton title="Exportieren / Importieren" icon={<Download size={18} />} active={open} onClick={toggle} aria-haspopup="menu" aria-expanded={open} data-tutorial="topbar-export" />
          ) : (
            <Button icon={<Download size={16} />} onClick={toggle} active={open} aria-haspopup="menu" aria-expanded={open} title="Exportieren / Importieren" data-tutorial="topbar-export">
              Export
              <ChevronDown size={14} className="opacity-60" />
            </Button>
          )
        }
      >
        {(close) => (
          <div className="w-[310px] py-1">
            <div className="px-4 pb-1 pt-2 gp-label">Plan exportieren</div>
            <Row icon={<FileImage size={16} />} label="PNG-Bild" hint="Aktives Stockwerk als Bild" busy={state('png')} onClick={() => { close(); void run('png'); }} />
            <Row icon={<FileText size={16} />} label="PDF-Plan" hint="maßstäblich, mit Legende, Flächenbilanz, Stückliste" busy={state('pdf')} onClick={() => { close(); void run('pdf'); }}>
              <Select compact value={pdfScale} options={PDF_SCALES} onChange={setPdfScale} title="Maßstab des PDF-Plans" aria-label="Maßstab" />
            </Row>
            <div className="my-1 border-t gp-border" />
            <div className="px-4 pb-1 pt-2 gp-label">Daten</div>
            <Row icon={<Table size={16} />} label="Stückliste (CSV)" hint="für Excel / Kalkulation" busy={state('csv')} onClick={() => { close(); void run('csv'); }} />
            <Row icon={<FileJson size={16} />} label="Projekt als JSON" hint="vollständige Sicherung" busy={state('json')} onClick={() => { close(); void run('json'); }} />
            <Row icon={<Upload size={16} />} label="JSON importieren" hint="ersetzt das aktuelle Projekt" busy={state('import')} onClick={() => { close(); setConfirmImport(true); }} />
          </div>
        )}
      </Dropdown>
      <ConfirmDialog
        open={confirmImport}
        title="Projekt importieren"
        message={
          <>
            Das aktuelle Projekt <strong>„{projectName}“</strong> wird durch das importierte Projekt ersetzt und der Verlauf (Rückgängig) geleert.
            Exportiere es vorher als JSON, wenn du es behalten möchtest.
          </>
        }
        confirmLabel="Datei wählen …"
        onCancel={() => setConfirmImport(false)}
        onConfirm={() => {
          setConfirmImport(false);
          void run('import');
        }}
      />
    </>
  );
}
