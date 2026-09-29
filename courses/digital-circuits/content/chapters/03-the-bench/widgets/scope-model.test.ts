import { describe, expect, test } from 'vitest';
import { COLS, ScopeModel, countEdges, findCrossing, nearestIndex, readCursors, resample, riseTime, seq125, valueAt } from './scope-model';

/** A square wave 0–5 V with linear edges of `edge` seconds, sampled only at its corners. */
function square(freq: number, until: number, edge = 1e-9) {
  const T = 1 / freq;
  const t: number[] = [0];
  const v: number[] = [0];
  for (let k = 0; k * T < until; k++) {
    const r = k * T;
    if (k > 0) {
      t.push(r);
      v.push(0);
    }
    t.push(r + edge, r + T / 2, r + T / 2 + edge);
    v.push(5, 5, 0);
  }
  t.push(until);
  v.push(0);
  return { t: Float64Array.from(t), v: Float64Array.from(v) };
}

describe('sequences and interpolation', () => {
  test('seq125 covers decades in 1-2-5 steps', () => {
    expect(seq125(-6, -5)).toEqual([1e-6, 2e-6, 5e-6, 1e-5]);
    expect(seq125(-3, -1)[nearestIndex(seq125(-3, -1), 0.0015)]).toBe(0.002);
  });

  test('valueAt interpolates linearly and is NaN outside the data', () => {
    const t = Float64Array.from([0, 1, 3]);
    const v = Float64Array.from([0, 2, 0]);
    expect(valueAt(t, v, 0.5)).toBeCloseTo(1, 12);
    expect(valueAt(t, v, 2)).toBeCloseTo(1, 12);
    expect(valueAt(t, v, -0.1)).toBeNaN();
    expect(valueAt(t, v, 3.1)).toBeNaN();
  });
});

describe('resample', () => {
  test('a ramp gives one value per column, rising', () => {
    const t = Float64Array.from([0, 10]);
    const v = Float64Array.from([0, 10]);
    const e = resample(t, v, 0, 10, 100);
    for (let c = 0; c < 100; c++) {
      expect(e.min[c]).toBeCloseTo(c / 10, 4);
      expect(e.max[c]).toBeCloseTo((c + 1) / 10, 4);
    }
  });

  test('a glitch narrower than a column is not lost', () => {
    // A 5 V spike 0.1 columns wide inside a flat 0 V signal.
    const t = Float64Array.from([0, 4.5, 4.55, 4.6, 10]);
    const v = Float64Array.from([0, 0, 5, 0, 0]);
    const e = resample(t, v, 0, 10, 10);
    expect(e.max[4]).toBeCloseTo(5, 6);
    expect(e.min[4]).toBeCloseTo(0, 6);
    expect(e.max[3]).toBe(0);
  });

  test('columns outside the recorded range are NaN', () => {
    const t = Float64Array.from([2, 6]);
    const v = Float64Array.from([1, 1]);
    const e = resample(t, v, 0, 10, 10);
    expect(e.min[0]).toBeNaN();
    expect(e.min[2]).toBe(1);
    expect(e.max[5]).toBe(1);
    expect(e.max[8]).toBeNaN();
  });
});

describe('triggering', () => {
  test('findCrossing interpolates between recorded points', () => {
    const t = Float64Array.from([0, 1, 2]);
    const v = Float64Array.from([0, 4, 0]);
    expect(findCrossing(t, v, 0, 1, 'rise')).toBeCloseTo(0.25, 12);
    expect(findCrossing(t, v, 0, 1, 'fall')).toBeCloseTo(1.75, 12);
    expect(findCrossing(t, v, 0.5, 1, 'rise')).toBeNull();
  });

  /** Phase of each finished sweep relative to the square wave: value of the signal at the sweep's left edge. */
  function starts(mode: 'off' | 'auto', timebase: number) {
    const s = square(1000, 0.5);
    const m = new ScopeModel(1, timebase, { mode, level: 2.5, slope: 'rise', position: 0.1 });
    m.process(s.t, [s.v], 0.5);
    return m.sweeps;
  }

  test('with the trigger on, every sweep starts at the same phase of the wave', () => {
    const sweeps = starts('auto', 5e-4);
    expect(sweeps.length).toBeGreaterThan(3);
    for (const sw of sweeps) {
      expect(sw.triggered).toBe(true);
      // The trigger point is 10 % into the sweep: the same phase modulo the period.
      const phase = (sw.t0 + 0.1 * 5e-3) % 1e-3;
      expect(phase === 0 || Math.abs(phase - 1e-3) < 1e-9 || Math.abs(phase - 0.5e-9) < 2e-9 || phase < 2e-9).toBe(true);
    }
  });

  test('with the trigger off, sweeps meet the signal at different phases', () => {
    const sweeps = starts('off', 5e-4);
    expect(sweeps.length).toBeGreaterThan(3);
    const phases = new Set(sweeps.map((sw) => Math.round(((sw.t0 % 1e-3) / 1e-3) * 100)));
    expect(phases.size).toBeGreaterThan(2);
    for (const sw of sweeps) expect(sw.triggered).toBe(false);
  });

  test('auto falls back to free running when nothing crosses the level', () => {
    const s = square(1000, 0.2);
    const m = new ScopeModel(1, 5e-4, { mode: 'auto', level: 9 });
    m.process(s.t, [s.v], 0.2);
    expect(m.sweeps.length).toBeGreaterThan(0);
    expect(m.sweeps.every((sw) => !sw.triggered)).toBe(true);
    expect(m.status()).toBe('Auto');
  });

  test('single shot captures one sweep and holds until re-armed', () => {
    const s = square(1000, 0.2);
    const m = new ScopeModel(1, 5e-4, { mode: 'single', level: 2.5, slope: 'fall', position: 0.2 });
    m.process(s.t, [s.v], 0.2);
    expect(m.sweeps.length).toBe(1);
    expect(m.armed).toBe(false);
    expect(m.status()).toBe('Held');
    m.process(s.t, [s.v], 0.2);
    expect(m.sweeps.length).toBe(1);
    m.arm(0.1);
    expect(m.status()).toBe('Armed');
    m.process(s.t, [s.v], 0.2);
    expect(m.sweeps.length).toBe(1);
    // The window may start up to the pre-trigger time before the arming moment, no earlier.
    expect(m.sweeps[0]!.t0).toBeGreaterThan(0.1 - 0.2 * 5e-3 - 1e-9);
  });

  test('a triggered sweep shows the edge at the trigger position', () => {
    const s = square(1000, 0.1);
    const m = new ScopeModel(1, 5e-4, { mode: 'auto', level: 2.5, position: 0.2 });
    m.process(s.t, [s.v], 0.1);
    const sw = m.last!;
    // 20 % of 500 columns = column 100: the level is crossed there.
    const col = 100;
    expect(sw.min[0]![col - 3]).toBeLessThan(0.1);
    expect(sw.max[0]![col + 3]).toBeGreaterThan(4.9);
    expect(sw.raw!.t.length).toBeGreaterThan(3);
  });

  test('restart with keep leaves old sweeps until a new one completes', () => {
    const s = square(1000, 0.1);
    const m = new ScopeModel(1, 5e-4, { mode: 'auto' });
    m.process(s.t, [s.v], 0.05);
    const n = m.sweeps.length;
    expect(n).toBeGreaterThan(0);
    m.restart(0.05, true);
    expect(m.sweeps.length).toBe(n);
    m.process(s.t, [s.v], 0.1);
    expect(m.sweeps.every((sw) => sw.t0 >= 0.05 - 1e-9)).toBe(true);
  });
});

describe('cursors and measurements', () => {
  test('cursor readout converts divisions to time and reads the trace', () => {
    const s = square(1000, 0.1);
    const m = new ScopeModel(1, 5e-4, { mode: 'auto', position: 0.2 });
    m.process(s.t, [s.v], 0.1);
    const r = readCursors({ on: true, t1: 2.5, t2: 4.5, v1: 0, v2: 5 }, m.timebase, m.last, 1);
    expect(r.dt).toBeCloseTo(1e-3, 12);
    expect(r.freq).toBeCloseTo(1000, 6);
    expect(r.dv).toBe(5);
    expect(r.at1[0]).toBeCloseTo(5, 3);
    expect(r.at2[0]).toBeCloseTo(5, 3);
  });

  test('rise time between two levels, and Schmitt edge counting', () => {
    const t = Float64Array.from([0, 1e-6, 2e-6, 3e-6, 4e-6]);
    const v = Float64Array.from([0, 0, 5, 5, 0]);
    const raw = { t, v: [v] };
    expect(riseTime(raw, 0, 1.5, 3.5)).toBeCloseTo(0.4e-6, 12);
    expect(countEdges(raw, 0, 1.5, 3.5)).toBe(2);
    const noisy = { t: Float64Array.from([0, 1, 2, 3, 4, 5]), v: [Float64Array.from([0, 3, 2.6, 3, 5, 0])] };
    expect(countEdges(noisy, 0, 1.5, 3.5)).toBe(2);
  });

  test('COLS is the number of envelope columns', () => {
    expect(resample(Float64Array.from([0, 1]), Float64Array.from([0, 1]), 0, 1).min.length).toBe(COLS);
  });
});
