import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, ChevronLeft, ChevronRight, Check, X, Square, BrickWall, LayoutDashboard, Dumbbell, SlidersHorizontal, ChartPie, Download, Sparkles } from 'lucide-react';
import type { Floor, Tool } from '@/types';
import { useUiStore, type RightPanel } from '@/store/uiStore';
import { useActiveFloor } from '@/store/selectors';
import { Button } from './ui/Button';
import { KbdCombo } from './ui/Kbd';

export interface TutorialStep {
  id: string;
  title: string;
  text: ReactNode;
  icon: ReactNode;
  /** CSS-Selektoren für das Spotlight (erster Treffer gewinnt). */
  target?: string[];
  /** Rechtes Panel, das beim Betreten des Schritts geöffnet wird. */
  panel?: RightPanel;
  /** Werkzeug, das per Hilfsbutton aktiviert werden kann. */
  tool?: Tool;
  toolLabel?: string;
  /** Erfüllt-Bedingung (Schritt wartet auf Aktion). Ohne: „Weiter“ immer möglich. */
  done?: (floor: Floor) => boolean;
  waitingText?: string;
  doneText?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Willkommen im GymPlanner',
    icon: <Sparkles size={18} />,
    text: (
      <>
        In acht kurzen Schritten planst du dein Studio maßstabsgetreu: Halle, Wände, Räume und Geräte mit echten Herstellermaßen. Alle Flächen werden live in m² berechnet.
        Du kannst das Tutorial jederzeit überspringen und über <strong>Hilfe → Tutorial starten</strong> erneut öffnen.
      </>
    ),
  },
  {
    id: 'hall',
    title: 'Halle zeichnen',
    icon: <Square size={18} />,
    target: ['[data-tutorial="toolbar-hall"]'],
    tool: 'hall-rect',
    toolLabel: 'Halle-Werkzeug aktivieren',
    text: (
      <>
        Wähle das Werkzeug <strong>Halle</strong> (<KbdCombo combo="H" />) und ziehe ein Rechteck auf – die Maße erscheinen live. Für unregelmäßige Grundrisse gibt es im Flyout die Polygon-Variante.
        Außenwandstärke und Bodenbelag stellst du ebenfalls dort ein.
      </>
    ),
    done: (f) => !!f.hall,
    waitingText: 'Ziehe eine Halle auf dem Plan auf …',
    doneText: 'Halle angelegt – die Fläche siehst du unten rechts in der Statusleiste.',
  },
  {
    id: 'walls',
    title: 'Wände ziehen',
    icon: <BrickWall size={18} />,
    target: ['[data-tutorial="toolbar-wall"]'],
    tool: 'wall',
    toolLabel: 'Wand-Werkzeug aktivieren',
    text: (
      <>
        Mit <strong>Wand</strong> (<KbdCombo combo="W" />) zeichnest du per Klick–Klick Wandketten. Stärke, Typ und Höhe wählst du im Flyout; eine exakte Länge tippst du einfach ein.
        Geschlossene Wandzüge werden automatisch zu Räumen.
      </>
    ),
    done: (f) => f.walls.length > 0,
    doneText: 'Erste Wand gesetzt.',
  },
  {
    id: 'rooms',
    title: 'Räume und Zonen',
    icon: <LayoutDashboard size={18} />,
    target: ['[data-tutorial="toolbar-zone"]'],
    tool: 'zone-rect',
    toolLabel: 'Zonen-Werkzeug aktivieren',
    text: (
      <>
        Bereiche ohne Wände – etwa „Freihantel“ in der offenen Halle – markierst du als <strong>Zone</strong> (<KbdCombo combo="Z" />). Jeder Raum hat Typ, Farbe und Bodenbelag und zeigt seine m² in der Mitte.
      </>
    ),
    done: (f) => f.zones.length > 0,
    doneText: 'Zone angelegt.',
  },
  {
    id: 'library',
    title: 'Gerät aus der Bibliothek ziehen',
    icon: <Dumbbell size={18} />,
    target: ['[data-tutorial="library"]', '[data-tutorial="right-panel"]', 'main ~ aside'],
    panel: 'library',
    text: (
      <>
        Rechts findest du die <strong>Bibliothek</strong> mit allen Atlantis- und Prime-Geräten sowie Cardio, Umkleide und Wellness. Suche ein Gerät und ziehe es per Drag &amp; Drop auf den Plan.
        Geräte behalten immer ihr Originalmaß; <KbdCombo combo="R" /> dreht in 90°-Schritten.
      </>
    ),
    done: (f) => f.items.length > 0,
    waitingText: 'Ziehe ein Gerät aus der Bibliothek auf den Plan …',
    doneText: 'Gerät platziert – Kollisionen mit Wänden oder anderen Geräten werden rot markiert.',
  },
  {
    id: 'properties',
    title: 'Eigenschaften & Sicherheitszone',
    icon: <SlidersHorizontal size={18} />,
    target: ['[data-tutorial="properties"]', '[data-tutorial="right-panel"]', 'main ~ aside'],
    panel: 'properties',
    text: (
      <>
        Im Panel <strong>Eigenschaften</strong> siehst du Hersteller, Modell, Maße, Gewicht und Preis des gewählten Objekts. Die halbtransparente <strong>Sicherheitszone</strong> (DIN EN ISO 20957) lässt sich je Gerät anpassen;
        Position und Drehung sind auch numerisch eingebbar.
      </>
    ),
  },
  {
    id: 'overview',
    title: 'Übersicht & Warnungen',
    icon: <ChartPie size={18} />,
    target: ['[data-tutorial="overview"]', '[data-tutorial="right-panel"]', 'main ~ aside'],
    panel: 'overview',
    text: (
      <>
        Die <strong>Übersicht</strong> liefert Flächenbilanz, Gerätestatistik, Bodenlast, Kapazität und die Stückliste mit Kosten. Planungs-Warnungen (Überlappungen, Fluchtwege, Deckenhöhe …) springen per Klick zum Problem.
      </>
    ),
  },
  {
    id: 'export',
    title: 'Speichern & Export',
    icon: <Download size={18} />,
    target: ['[data-tutorial="topbar-export"]'],
    text: (
      <>
        Dein Projekt wird automatisch im Browser gespeichert. Über <strong>Export</strong> erzeugst du maßstäbliche PNG- und PDF-Pläne, die Stückliste als CSV oder eine JSON-Sicherung.
        Mehrere Projekte und Varianten verwaltest du unter <strong>Projekte</strong>. Viel Erfolg bei der Planung!
      </>
    ),
  },
];

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function findTarget(selectors?: string[]): Element | null {
  if (!selectors) return null;
  for (const s of selectors) {
    try {
      const el = document.querySelector(s);
      if (el && (el as HTMLElement).offsetParent !== null) return el;
    } catch {
      /* ungültiger Selektor – ignorieren */
    }
  }
  return null;
}

/**
 * Interaktives Tutorial (überspringbar) beim ersten Start: Karten unten rechts mit Fortschritt,
 * Spotlight auf UI-Elemente (data-tutorial), wartet bei Aktionsschritten auf die Erfüllung.
 */
export function Tutorial() {
  const show = useUiStore((s) => s.showTutorial);
  const setShow = useUiStore((s) => s.setShowTutorial);
  const tutorialDone = useUiStore((s) => s.tutorialDone);
  const setTutorialDone = useUiStore((s) => s.setTutorialDone);
  const presentation = useUiStore((s) => s.presentationMode);
  const setRightPanel = useUiStore((s) => s.setRightPanel);
  const setTool = useUiStore((s) => s.setTool);
  const floor = useActiveFloor();

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Beim ersten Start automatisch öffnen
  useEffect(() => {
    if (!tutorialDone && !useUiStore.getState().showTutorial) setShow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Bei jedem Öffnen von vorn beginnen
  useEffect(() => {
    if (show) setIndex(0);
  }, [show]);

  const step = TUTORIAL_STEPS[index];
  const total = TUTORIAL_STEPS.length;
  const done = step?.done ? step.done(floor) : true;

  // Beim Betreten eines Schritts Panel öffnen
  useEffect(() => {
    if (!show || !step) return;
    if (step.panel) setRightPanel(step.panel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, index]);

  // Spotlight-Rechteck verfolgen (Layout kann sich ändern: Panels, Fenstergröße)
  useEffect(() => {
    if (!show || !step) {
      setRect(null);
      return;
    }
    let last = '';
    const update = () => {
      const el = findTarget(step.target);
      if (!el) {
        if (last !== 'none') {
          last = 'none';
          setRect(null);
        }
        return;
      }
      const r = el.getBoundingClientRect();
      const key = `${Math.round(r.left)}:${Math.round(r.top)}:${Math.round(r.width)}:${Math.round(r.height)}`;
      if (key === last) return;
      last = key;
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    update();
    const iv = window.setInterval(update, 350);
    window.addEventListener('resize', update);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener('resize', update);
    };
  }, [show, index, step]);

  const finish = useCallback(() => {
    setTutorialDone(true);
    setShow(false);
  }, [setTutorialDone, setShow]);
  const next = useCallback(() => {
    if (index >= total - 1) finish();
    else setIndex((i) => Math.min(total - 1, i + 1));
  }, [index, total, finish]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Tastatur: → / Enter weiter, ← zurück (nur wenn Fokus in der Karte)
  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (done) next();
    } else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Escape') finish();
  };

  const progress = useMemo(() => ((index + 1) / total) * 100, [index, total]);

  if (!show || !step || presentation || typeof document === 'undefined') return null;
  const isLast = index === total - 1;
  const pad = 6;

  return createPortal(
    <>
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[1150] rounded-lg transition-all duration-200"
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.38), 0 0 0 3px var(--gp-accent)',
          }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-label={`Tutorial – Schritt ${index + 1} von ${total}: ${step.title}`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="gp-panel fixed bottom-11 right-4 z-[1200] flex w-[min(360px,calc(100vw-32px))] flex-col gap-3 rounded-xl border p-4 shadow-2xl outline-none"
        data-tutorial-card="true"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: 'var(--gp-accent)' }} aria-hidden="true">
              {step.icon}
            </span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide gp-muted">
                Schritt {index + 1} von {total}
              </div>
              <h2 className="text-sm font-semibold leading-tight">{step.title}</h2>
            </div>
          </div>
          <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md gp-muted hover:[background:color-mix(in_srgb,var(--gp-accent)_12%,transparent)]" title="Tutorial überspringen" aria-label="Tutorial überspringen" onClick={finish}>
            <X size={16} />
          </button>
        </div>

        <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: 'color-mix(in srgb, var(--gp-muted) 25%, transparent)' }} aria-hidden="true">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--gp-accent)' }} />
        </div>

        <p className="text-sm leading-relaxed">{step.text}</p>

        {step.tool && !done && (
          <Button size="sm" icon={<GraduationCap size={14} />} onClick={() => setTool(step.tool!)} className="self-start">
            {step.toolLabel ?? 'Werkzeug aktivieren'}
          </Button>
        )}

        {step.done && (
          <div className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ${done ? 'gp-ok' : 'gp-muted'}`} style={{ background: 'color-mix(in srgb, var(--gp-muted) 12%, transparent)' }} role="status">
            {done ? <Check size={14} /> : <span className="inline-block h-3 w-3 animate-pulse rounded-full" style={{ background: 'var(--gp-accent)' }} aria-hidden="true" />}
            <span>{done ? step.doneText ?? 'Erledigt!' : step.waitingText ?? 'Probiere es aus – oder überspringe den Schritt.'}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <button type="button" className="text-xs underline-offset-2 gp-muted hover:underline" onClick={finish}>
            Überspringen
          </button>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={prev} disabled={index === 0} icon={<ChevronLeft size={14} />} title="Zurück (←)">
              Zurück
            </Button>
            {step.done && !done ? (
              <Button size="sm" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))} title="Diesen Schritt ohne Aktion überspringen">
                Schritt überspringen
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={next} data-primary="true" title={isLast ? 'Tutorial beenden' : 'Weiter (→)'}>
                {isLast ? 'Fertig' : 'Weiter'}
                {!isLast && <ChevronRight size={14} />}
              </Button>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-1" aria-hidden="true">
          {TUTORIAL_STEPS.map((s, i) => (
            <button key={s.id} type="button" tabIndex={-1} className="h-2.5 w-2.5 rounded-full transition-colors" style={{ background: i === index ? 'var(--gp-accent)' : i < index ? 'color-mix(in srgb, var(--gp-accent) 45%, transparent)' : 'color-mix(in srgb, var(--gp-muted) 30%, transparent)' }} onClick={() => setIndex(i)} title={s.title} />
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}
