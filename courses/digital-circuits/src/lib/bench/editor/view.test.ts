import { describe, expect, test } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, fitBox, panBy, toGrid, toScreen, toWorld, viewBox, zoomAt } from './view';

describe('view', () => {
  test('world and screen coordinates convert both ways', () => {
    const v = { x: 100, y: -40, zoom: 2 };
    const [wx, wy] = toWorld(v, 30, 50);
    expect([wx, wy]).toEqual([115, -15]);
    expect(toScreen(v, wx, wy)).toEqual([30, 50]);
    expect(toGrid(v, 30, 50)).toEqual([115 / 12, -15 / 12]);
  });
  test('zooming keeps the point under the cursor fixed', () => {
    const v = { x: 10, y: 20, zoom: 1.5 };
    const before = toWorld(v, 200, 120);
    const z = zoomAt(v, 200, 120, 1.6);
    expect(z.zoom).toBeCloseTo(2.4);
    const after = toWorld(z, 200, 120);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });
  test('zoom is clamped', () => {
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, 0, 0, 1000).zoom).toBe(MAX_ZOOM);
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, 0, 0, 1e-6).zoom).toBe(MIN_ZOOM);
  });
  test('panning moves the world under the pointer', () => {
    const v = panBy({ x: 0, y: 0, zoom: 2 }, 40, -20);
    expect(v).toEqual({ x: -20, y: 10, zoom: 2 });
  });
  test('fit centres the box and never zooms in past the limit', () => {
    const v = fitBox({ x0: 0, y0: 0, x1: 10, y1: 5 }, 800, 600, 40, 2);
    expect(v.zoom).toBe(2);
    const b = viewBox(v, 800, 600);
    expect((b.x0 + b.x1) / 2).toBeCloseTo(60);
    expect((b.y0 + b.y1) / 2).toBeCloseTo(30);
    const big = fitBox({ x0: 0, y0: 0, x1: 100, y1: 60 }, 800, 600, 40, 2);
    expect(big.zoom).toBeLessThan(2);
    const w = (100 * 12 * big.zoom) as number;
    expect(w).toBeLessThanOrEqual(800 - 80 + 1e-6);
  });
  test('fit of nothing gives the default view', () => {
    expect(fitBox(undefined, 800, 600).zoom).toBe(1.5);
  });
});
