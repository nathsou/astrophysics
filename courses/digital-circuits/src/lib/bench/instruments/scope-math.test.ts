import { describe, expect, test } from 'vitest';
import { PRE_TRIGGER, chooseCapture, crossings, cursorDelta, decimate, indexAtOrBefore, logicToVolts, statistics, stepLadder, valueAt } from './scope-math';

/** A sine or ramp sampled every `dt`. */
const sample = (f: (t: number) => number, dt: number, until: number) => {
  const n = Math.round(until / dt) + 1;
  const t = new Float64Array(n);
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    t[i] = i * dt;
    v[i] = f(t[i]!);
  }
  return { t, v };
};

describe('lookup', () => {
  const t = [0, 1, 2, 4];
  const v = [0, 10, 0, 8];
  test('index at or before', () => {
    expect(indexAtOrBefore(t, -1)).toBe(-1);
    expect(indexAtOrBefore(t, 0)).toBe(0);
    expect(indexAtOrBefore(t, 1.5)).toBe(1);
    expect(indexAtOrBefore(t, 99)).toBe(3);
  });
  test('value interpolates linearly, or holds', () => {
    expect(valueAt(t, v, 0.5)).toBe(5);
    expect(valueAt(t, v, 3)).toBe(4);
    expect(valueAt(t, v, 3, true)).toBe(0);
    expect(valueAt(t, v, 10)).toBe(8);
    expect(valueAt(t, v, -1)).toBeNaN();
  });
  test('logic to volts', () => {
    expect([0, 1, 2, 3].map(logicToVolts)).toEqual([0, 5, 2.5, NaN]);
  });
});

describe('crossings', () => {
  const { t, v } = sample((x) => Math.sin(2 * Math.PI * 1000 * x), 1e-6, 5e-3);
  test('rising crossings of a 1 kHz sine are a millisecond apart', () => {
    const c = crossings(t, v, 0, 'rise', 1e-6, 5e-3);
    expect(c.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < c.length; i++) expect(c[i]! - c[i - 1]!).toBeCloseTo(1e-3, 6);
  });
  test('falling crossings sit half a period later', () => {
    const rise = crossings(t, v, 0, 'rise', 1e-6, 5e-3);
    const fall = crossings(t, v, 0, 'fall', 1e-6, 5e-3);
    expect(fall[0]!).toBeCloseTo(5e-4, 6);
    expect(rise[0]! - fall[0]!).toBeCloseTo(5e-4, 6);
  });
  test('the crossing time is interpolated between samples', () => {
    const c = crossings([0, 10], [0, 10], 2.5, 'rise', 0, 10);
    expect(c).toEqual([2.5]);
  });
  test('digital steps cross at the later sample', () => {
    expect(crossings([0, 3, 7], [0, 5, 0], 2.5, 'rise', 0, 10, true)).toEqual([3]);
    expect(crossings([0, 3, 7], [0, 5, 0], 2.5, 'fall', 0, 10, true)).toEqual([7]);
  });
  test('a level that is never crossed', () => {
    expect(crossings(t, v, 2, 'rise', 0, 5e-3)).toEqual([]);
  });
});

describe('chooseCapture', () => {
  const window = 4e-3;
  const { t, v } = sample((x) => Math.sin(2 * Math.PI * 1000 * x), 2e-6, 0.03);
  const trig = { level: 0, slope: 'rise' as const, mode: 'auto' as const };

  test('locks the trigger point at 10 % of the screen, on a completed sweep', () => {
    const now = 0.03;
    const cap = chooseCapture(t, v, now, window, trig, false)!;
    expect(cap.triggered).toBe(true);
    // The trigger sits at t0 + 10 % of the window: a rising zero crossing of the sine (k·1 ms).
    const at = cap.t0 + PRE_TRIGGER * window;
    expect(at / 1e-3).toBeCloseTo(Math.round(at / 1e-3), 2);
    expect(cap.t0 + window).toBeLessThanOrEqual(now + 1e-9);
  });

  test('the picture does not move while time passes (stable trigger)', () => {
    const a = chooseCapture(t, v, 0.03, window, trig, false)!;
    const b = chooseCapture(t, v, 0.03, window, trig, false)!;
    expect(a).toEqual(b);
    // A little later the same signal locks to a crossing a whole number of periods apart.
    const later = sample((x) => Math.sin(2 * Math.PI * 1000 * x), 2e-6, 0.0312);
    const c = chooseCapture(later.t, later.v, 0.0312, window, trig, false)!;
    expect(Math.abs(((c.t0 - a.t0) / 1e-3) % 1) < 1e-2 || Math.abs((((c.t0 - a.t0) / 1e-3) % 1) - 1) < 1e-2).toBe(true);
  });

  test('auto mode free-runs when nothing crosses, starting at zero until a window has elapsed', () => {
    const flat = sample(() => 1, 1e-4, 0.02);
    expect(chooseCapture(flat.t, flat.v, 0.002, window, trig, false)).toEqual({ t0: 0, triggered: false });
    expect(chooseCapture(flat.t, flat.v, 0.02, window, trig, false)!.t0).toBeCloseTo(0.016);
  });

  test('normal mode holds the last capture, or shows nothing', () => {
    const flat = sample(() => 1, 1e-4, 0.02);
    const normal = { ...trig, mode: 'normal' as const };
    expect(chooseCapture(flat.t, flat.v, 0.02, window, normal, false)).toBeUndefined();
    const held = { t0: 0.005, triggered: true };
    expect(chooseCapture(flat.t, flat.v, 0.02, window, normal, false, held)).toBe(held);
  });

  test('an RC charge shows its first partial sweep anchored at the first crossing', () => {
    const tau = 1e-3;
    const rc = sample((x) => 5 * (1 - Math.exp(-x / tau)), 1e-5, 2e-3);
    const cap = chooseCapture(rc.t, rc.v, 2e-3, 5e-3, { level: 0.05, slope: 'rise', mode: 'auto' }, false)!;
    expect(cap.triggered).toBe(true);
    expect(cap.t0).toBeCloseTo(1e-5 - 0.5e-3, 4); // the charge starts 10 % in from the left
  });
});

describe('decimate', () => {
  test('few samples are joined as they are, entering and leaving at the window edges', () => {
    const p = decimate([0, 1, 2, 3], [0, 1, 0, 1], 0.5, 2.5, 400);
    expect(p.t[0]).toBe(0.5);
    expect(p.v[0]).toBeCloseTo(0.5);
    expect(p.t.at(-1)).toBe(2.5);
    expect(p.v.at(-1)).toBeCloseTo(0.5);
    expect(p.t).toEqual([...p.t].sort((a, b) => a - b));
  });
  test('held (digital) samples become steps', () => {
    const p = decimate([0, 2, 4], [0, 5, 0], 0, 5, 400, true, 5);
    expect(p.t).toEqual([0, 2, 2, 4, 4, 5]);
    expect(p.v).toEqual([0, 0, 5, 5, 0, 0]);
  });
  test('many samples are reduced to a min/max pair per column and keep a narrow spike', () => {
    const n = 200000;
    const t = new Float64Array(n);
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      t[i] = i * 1e-6;
      v[i] = i === 123456 ? 9 : Math.sin(i * 1e-3);
    }
    const p = decimate(t, v, 0, 0.2, 400);
    expect(p.t.length).toBeLessThanOrEqual(400 * 2 + 4);
    expect(Math.max(...p.v)).toBe(9);
    expect(Math.min(...p.v)).toBeLessThan(-0.99);
    expect(p.t.every((x, i) => i === 0 || x >= p.t[i - 1]!)).toBe(true);
  });
  test('nothing recorded, or an empty window', () => {
    expect(decimate([], [], 0, 1, 100).t).toEqual([]);
    expect(decimate([0, 1], [0, 1], 1, 1, 100).t).toEqual([]);
  });
  test('a window after the last sample draws the trace up to the last sample only', () => {
    const p = decimate([0, 1], [0, 1], 0, 5, 100);
    expect(p.t.at(-1)).toBe(1);
  });
});

describe('ladder and cursors', () => {
  test('the timebase steps 1–2–5', () => {
    expect(stepLadder(1e-3, 1, 1e-9, 100)).toBe(2e-3);
    expect(stepLadder(2e-3, 1, 1e-9, 100)).toBe(5e-3);
    expect(stepLadder(5e-3, 1, 1e-9, 100)).toBe(1e-2);
    expect(stepLadder(1e-3, -1, 1e-9, 100)).toBe(5e-4);
    expect(stepLadder(100, 1, 1e-9, 100)).toBe(100);
  });
  test('cursor deltas', () => {
    expect(cursorDelta(1e-3, 3e-3)).toEqual({ delta: 2e-3, inverse: 500 });
    expect(cursorDelta(1, 1).inverse).toBe(Infinity);
  });
  test('statistics of a window', () => {
    const s = statistics([0, 1, 2, 3], [0, 4, 4, 0], 0, 3)!;
    expect(s.min).toBe(0);
    expect(s.max).toBe(4);
    expect(s.pkpk).toBe(4);
    expect(statistics([], [], 0, 1)).toBeUndefined();
  });
});
