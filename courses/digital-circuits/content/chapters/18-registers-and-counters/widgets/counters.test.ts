import { describe, expect, test } from 'vitest';
import { DEFAULT_COUNTER, octaves, rippleTransients, run, type CounterParams } from './counters';

const P = (over: Partial<CounterParams>): CounterParams => ({ ...DEFAULT_COUNTER, ...over });
const steady = (r: ReturnType<typeof run>, p: CounterParams) => {
  // The word just before each clock edge (and at the end): the settled count.
  const at = (t: number) => {
    let v = -2;
    for (const [a, z, w] of r.word) if (a <= t && t < z) v = w;
    return v;
  };
  return [...r.edges.map((e) => at(e - 1)), at(r.end - 1)].slice(0, p.cycles);
};

describe('the transients of a ripple counter', () => {
  test('7 to 8 goes through 6, 4 and 0; 3 to 4 through 2 and 0; even to odd goes straight there', () => {
    expect(rippleTransients(7, 4)).toEqual([6, 4, 0]);
    expect(rippleTransients(3, 4)).toEqual([2, 0]);
    expect(rippleTransients(0, 4)).toEqual([]);
    expect(rippleTransients(4, 4)).toEqual([]);
    expect(rippleTransients(15, 4)).toEqual([14, 12, 8]);
  });
});

describe('both counters count', () => {
  for (const kind of ['ripple', 'sync'] as const) {
    test(`${kind}: the settled value before each edge is 0, 1, 2, … and wraps at 16`, () => {
      const p = P({ kind, watch: -1, cycles: 20 });
      const r = run(p);
      expect(steady(r, p)).toEqual(Array.from({ length: 20 }, (_, i) => i % 16));
    });
  }
});

describe('the ripple counter shows wrong values on the way', () => {
  test('exactly the values the model predicts, in order', () => {
    const p = P({ kind: 'ripple', watch: -1, cycles: 9 });
    const r = run(p);
    // Edge 7 takes the count from 7 to 8.
    const e7 = r.edges[7]!;
    const within = r.transients.filter((s) => s[0] >= e7 - 1 && s[1] <= e7 + p.period);
    expect(within.map((s) => s[2])).toEqual([6, 4, 0]);
    // Each stage adds one clock-to-Q of delay: the spans last 12 ns each.
    for (const s of within) expect(s[1] - s[0]).toBeCloseTo(12, 0);
  });
  test('the count settles after bits × clock-to-Q at worst', () => {
    const r = run(P({ kind: 'ripple', watch: -1, cycles: 17 }));
    expect(r.settle).toBeGreaterThan(3 * 12 - 1);
    expect(r.settle).toBeLessThanOrEqual(4 * 12 + 1);
  });
  test('a longer ripple, a longer wait', () => {
    expect(run(P({ kind: 'ripple', bits: 6, watch: -1, cycles: 33 })).settle).toBeGreaterThan(5 * 12 - 1);
  });
});

describe('the synchronous counter changes all its bits together', () => {
  test('no transients at all, and one clock-to-Q of settling', () => {
    const r = run(P({ kind: 'sync', watch: -1, cycles: 20 }));
    expect(r.transients).toEqual([]);
    expect(r.settle).toBeCloseTo(12, 0);
  });
});

describe('a decoder watching for one count', () => {
  test('ripple: pulses on the wrong counts too', () => {
    // Watching for 2 (0010): the ripple from 3 to 4 passes through 2, and so do 7 to 8, and 11 to 12 and 15 to 0.
    const r = run(P({ kind: 'ripple', watch: 2, cycles: 34 }));
    expect(r.hitPulses).toBeGreaterThan(r.hitLegit);
  });
  test('synchronous: exactly one pulse per lap', () => {
    const r = run(P({ kind: 'sync', watch: 2, cycles: 34 }));
    expect(r.hitPulses).toBe(r.hitLegit);
    expect(r.hitLegit).toBe(3);
  });
});

describe('frequency division', () => {
  test('each output has half the frequency of the one before, in both counters', () => {
    for (const kind of ['ripple', 'sync'] as const) {
      const r = run(P({ kind, watch: -1, cycles: 32 }));
      const rises = (segs: [number, number, number][]) => segs.filter((s, i) => i > 0 && s[2] === 1 && segs[i - 1]![2] === 0).length;
      const clk = rises(r.clk);
      expect(clk).toBe(32);
      expect(rises(r.bits[0]!)).toBe(16);
      expect(rises(r.bits[1]!)).toBe(8);
      expect(rises(r.bits[2]!)).toBe(4);
      expect(rises(r.bits[3]!)).toBe(2);
    }
  });
  test('octaves: 1760 Hz down to 110 Hz', () => {
    expect(octaves(1760, 4)).toEqual([1760, 880, 440, 220, 110]);
  });
});
