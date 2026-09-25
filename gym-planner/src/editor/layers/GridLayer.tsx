import { memo } from 'react';
import { Layer, Line, Shape } from 'react-konva';
import type { Viewport } from '@/store/uiStore';
import { niceStep } from '../viewport';
import { useIsDark } from '@/hooks/useTheme';

interface Props {
  viewport: Viewport;
  width: number;
  height: number;
  gridSize: number;
  visible: boolean;
}

/** Raster (Neben- und Hauptlinien) + Achsenkreuz am Ursprung. Zeichnet nur den sichtbaren Ausschnitt. */
export const GridLayer = memo(function GridLayer({ viewport, width, height, gridSize, visible }: Props) {
  const dark = useIsDark();
  if (!visible) return <Layer listening={false} />;
  const { scale, x, y } = viewport;
  // Sichtbarer Weltbereich
  const minX = -x / scale;
  const minY = -y / scale;
  const maxX = (width - x) / scale;
  const maxY = (height - y) / scale;
  // Nebenraster ausdünnen, wenn zu dicht (< 6 px)
  let minor = gridSize;
  while (minor * scale < 6) minor *= 2;
  const major = Math.max(100, niceStep(scale, 100));
  const minorColor = dark ? '#1e293b' : '#e2e8f0';
  const majorColor = dark ? '#334155' : '#cbd5e1';
  return (
    <Layer listening={false}>
      <Shape
        sceneFunc={(ctx) => {
          ctx.beginPath();
          const sx = Math.floor(minX / minor) * minor;
          const sy = Math.floor(minY / minor) * minor;
          for (let gx = sx; gx <= maxX; gx += minor) {
            if (Math.abs(gx % major) < 1e-6) continue;
            ctx.moveTo(gx, minY);
            ctx.lineTo(gx, maxY);
          }
          for (let gy = sy; gy <= maxY; gy += minor) {
            if (Math.abs(gy % major) < 1e-6) continue;
            ctx.moveTo(minX, gy);
            ctx.lineTo(maxX, gy);
          }
          ctx.setAttr('strokeStyle', minorColor);
          ctx.setAttr('lineWidth', 1 / scale);
          ctx.stroke();
          ctx.beginPath();
          const mx = Math.floor(minX / major) * major;
          const my = Math.floor(minY / major) * major;
          for (let gx = mx; gx <= maxX; gx += major) { ctx.moveTo(gx, minY); ctx.lineTo(gx, maxY); }
          for (let gy = my; gy <= maxY; gy += major) { ctx.moveTo(minX, gy); ctx.lineTo(maxX, gy); }
          ctx.setAttr('strokeStyle', majorColor);
          ctx.setAttr('lineWidth', 1 / scale);
          ctx.stroke();
        }}
      />
      <Line points={[minX, 0, maxX, 0]} stroke={dark ? '#475569' : '#94a3b8'} strokeWidth={1.5 / scale} dash={[8 / scale, 6 / scale]} />
      <Line points={[0, minY, 0, maxY]} stroke={dark ? '#475569' : '#94a3b8'} strokeWidth={1.5 / scale} dash={[8 / scale, 6 / scale]} />
    </Layer>
  );
});
