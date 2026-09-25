import { describe, it, expect, beforeAll } from 'vitest';
import { createElement } from 'react';
import { Stage, Layer, Rect, Group, Text, Line, Circle, Arc } from 'react-konva';
import { render } from '@testing-library/react';

beforeAll(() => {
  const noop = () => {};
  const makeCtx = (canvas: HTMLCanvasElement) => {
    const base: Record<string, unknown> = {
      canvas,
      measureText: (t: string) => ({ width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      createImageData: () => ({ data: new Uint8ClampedArray(4) }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createPattern: () => ({}),
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    };
    return new Proxy(base, {
      get: (t, k) => (k in t ? t[k as string] : noop),
      set: (t, k, v) => { t[k as string] = v; return true; },
    });
  };
  (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = function (this: HTMLCanvasElement) { return makeCtx(this); };
});

describe('konva jsdom probe', () => {
  it('renders a stage', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const t0 = performance.now();
    const r = render(createElement(Stage, { width: 100, height: 100 }, createElement(Layer, null, createElement(Group, { x: 5, y: 5, rotation: 30 },
      createElement(Rect, { x: 0, y: 0, width: 10, height: 10, fill: 'red', dash: [2, 2] }),
      createElement(Text, { text: 'Hallo', fontSize: 10, width: 50, wrap: 'none', ellipsis: true, align: 'center' }),
      createElement(Line, { points: [0, 0, 10, 10, 20, 0], tension: 0.5, closed: true, fill: 'blue' }),
      createElement(Circle, { radius: 5 }),
      createElement(Arc, { innerRadius: 2, outerRadius: 5, angle: 90 }),
    ))), { container: div });
    console.log('CANVAS:', div.querySelector('canvas') ? 'yes' : 'no', 'ms', (performance.now() - t0).toFixed(1));
    expect(r.container.querySelectorAll('canvas').length).toBeGreaterThan(0);
  });
});
