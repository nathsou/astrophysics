import { describe, expect, test } from 'vitest';
import { estimateDelay } from '$lib/pld/fpga/place';
import { fastest, hopDelay } from './wire-reach';

describe('crossing a row of tiles (Figure 28.3)', () => {
  test('the delay of one hop is a multiplexer plus a wire: 0.3, 0.5 and 0.9 ns', () => {
    expect([1, 4, 12].map((s) => +hopDelay(s as 1 | 4 | 12).toFixed(3))).toEqual([0.3, 0.5, 0.9]);
  });

  test('the next tile is one span-1 hop and one connection-box multiplexer: 0.4 ns', () => {
    const r = fastest(1, 'one');
    expect(r.hops.map((h) => h.span)).toEqual([1]);
    expect(r.delay).toBeCloseTo(0.4, 9);
    expect(r.muxes).toBe(2);
  });

  test('twelve tiles: twelve hops of span 1 (3.7 ns), or one span-12 wire (1.0 ns)', () => {
    expect(fastest(12, 'one').delay).toBeCloseTo(3.7, 9);
    expect(fastest(12, 'all').delay).toBeCloseTo(1.0, 9);
    expect(fastest(12, 'all').hops).toHaveLength(1);
  });

  test('thirty tiles: 9.1 ns with span-1 wires alone, 3.0 ns with the full mix', () => {
    expect(fastest(30, 'one').delay).toBeCloseTo(9.1, 9);
    expect(fastest(30, 'one-four').delay).toBeCloseTo(0.1 + 7 * 0.5 + 2 * 0.3, 9);
    const all = fastest(30, 'all');
    expect(all.delay).toBeCloseTo(3.0, 9);
    expect(all.hops.map((h) => h.span).sort((a, b) => a - b)).toEqual([1, 1, 4, 12, 12]);
  });

  test('a wire may overshoot and come back when that is faster: eleven tiles by span 12 then span 1 back', () => {
    const r = fastest(11, 'all');
    expect(r.delay).toBeCloseTo(0.1 + 0.9 + 0.3, 9);
    expect(r.hops.map((h) => h.to)).toEqual([12, 11]);
  });

  test('never slower than the placer’s greedy estimate, and equal to it for the round distances', () => {
    for (let d = 1; d < 36; d++) {
      const f = fastest(d, 'all').delay;
      expect(f).toBeLessThanOrEqual(estimateDelay(d, 0) + 1e-9);
    }
    for (const d of [1, 4, 8, 12, 16, 24]) expect(fastest(d, 'all').delay).toBeCloseTo(estimateDelay(d, 0), 9);
  });

  test('more kinds of wire never hurt', () => {
    for (let d = 1; d < 36; d++) {
      const a = fastest(d, 'one').delay;
      const b = fastest(d, 'one-four').delay;
      const c = fastest(d, 'all').delay;
      expect(b).toBeLessThanOrEqual(a + 1e-9);
      expect(c).toBeLessThanOrEqual(b + 1e-9);
    }
  });
});
