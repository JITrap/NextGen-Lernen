import { memo, useMemo } from 'react';
import type { Viewport } from '@/store/uiStore';
import { niceStep } from '../viewport';
import { useIsDark } from '@/hooks/useTheme';

const SIZE = 22;

/** Lineale am oberen und linken Rand (in m bzw. cm). */
export const Rulers = memo(function Rulers({ viewport, width, height }: { viewport: Viewport; width: number; height: number }) {
  const dark = useIsDark();
  const step = niceStep(viewport.scale, 80);
  const label = (cm: number) => {
    if (cm === 0) return '0';
    const v = Math.abs(cm) >= 100 ? `${(Math.abs(cm) / 100).toLocaleString('de-DE')} m` : `${Math.abs(cm)} cm`;
    return cm < 0 ? `−${v}` : v;
  };
  const ticksX = useMemo(() => {
    const out: { px: number; text: string }[] = [];
    const minWorld = -viewport.x / viewport.scale;
    const maxWorld = (width - viewport.x) / viewport.scale;
    for (let v = Math.floor(minWorld / step) * step; v <= maxWorld; v += step) out.push({ px: v * viewport.scale + viewport.x, text: label(v) });
    return out;
  }, [viewport, width, step]);
  const ticksY = useMemo(() => {
    const out: { px: number; text: string }[] = [];
    const minWorld = -viewport.y / viewport.scale;
    const maxWorld = (height - viewport.y) / viewport.scale;
    for (let v = Math.floor(minWorld / step) * step; v <= maxWorld; v += step) out.push({ px: v * viewport.scale + viewport.y, text: label(v) });
    return out;
  }, [viewport, height, step]);
  const bg = dark ? 'rgba(15,23,42,0.9)' : 'rgba(248,250,252,0.92)';
  const fg = dark ? '#94a3b8' : '#475569';
  return (
    <>
      <svg className="pointer-events-none absolute left-0 top-0" width={width} height={SIZE} style={{ background: bg }}>
        {ticksX.map((t, i) => (
          <g key={i}>
            <line x1={t.px} y1={SIZE - 8} x2={t.px} y2={SIZE} stroke={fg} strokeWidth={1} />
            <text x={t.px + 3} y={10} fontSize={9} fill={fg}>{t.text}</text>
          </g>
        ))}
        <line x1={0} y1={SIZE - 0.5} x2={width} y2={SIZE - 0.5} stroke={fg} strokeOpacity={0.4} />
      </svg>
      <svg className="pointer-events-none absolute left-0 top-0" width={SIZE} height={height} style={{ background: bg }}>
        {ticksY.map((t, i) => (
          <g key={i}>
            <line x1={SIZE - 8} y1={t.px} x2={SIZE} y2={t.px} stroke={fg} strokeWidth={1} />
            <text x={10} y={t.px - 3} fontSize={9} fill={fg} transform={`rotate(-90 10 ${t.px - 3})`}>{t.text}</text>
          </g>
        ))}
        <line x1={SIZE - 0.5} y1={0} x2={SIZE - 0.5} y2={height} stroke={fg} strokeOpacity={0.4} />
      </svg>
      <div className="absolute left-0 top-0" style={{ width: SIZE, height: SIZE, background: bg }} />
    </>
  );
});
