import { describe, expect, it } from 'vitest';
import { fitAll, fitRect, initialView } from './panzoom-fit';

describe('PanZoom initial view', () => {
  it('fits all the content, centred', () => {
    const v = fitAll(900, 400, 1500, 1200);
    expect(v.k).toBeCloseTo((400 - 24) / 1200, 6);
    expect(v.tx).toBeCloseTo((900 - 1500 * v.k) / 2, 6);
    expect(v.ty).toBe(12);
  });
  it('fits a rectangle so that it fills the pane', () => {
    const r = { x: 100, y: 50, w: 600, h: 400 };
    const v = fitRect(900, 500, r);
    const left = r.x * v.k + v.tx;
    const right = (r.x + r.w) * v.k + v.tx;
    expect((left + right) / 2).toBeCloseTo(450, 6);
    expect(v.k).toBeCloseTo(Math.min(876 / 600, 476 / 400), 6);
  });
  it('opens on the home rectangle when the whole content would be unreadably small', () => {
    const home = { x: 0, y: 0, w: 700, h: 500 };
    const whole = fitAll(900, 440, 1500, 1200);
    expect(whole.k).toBeLessThan(0.5);
    const v = initialView(900, 440, 1500, 1200, { home, minFit: 0.5 });
    expect(v.k).toBeGreaterThan(whole.k);
    expect(v).toEqual(fitRect(900, 440, home));
  });
  it('keeps the whole content when it is big enough, without a home, or when asked for all', () => {
    const home = { x: 0, y: 0, w: 700, h: 500 };
    expect(initialView(1500, 1200, 1500, 1200, { home, minFit: 0.5 })).toEqual(fitAll(1500, 1200, 1500, 1200));
    expect(initialView(900, 440, 1500, 1200, { minFit: 0.5 })).toEqual(fitAll(900, 440, 1500, 1200));
    expect(initialView(900, 440, 1500, 1200, { home, minFit: 0.5, all: true })).toEqual(fitAll(900, 440, 1500, 1200));
  });
});
