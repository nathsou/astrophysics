import { describe, expect, test } from 'vitest';
import { createAnalogEngine } from '$lib/sim/analog';
import { DROP_OUT_CURRENT, PULL_IN_CURRENT, RATED_CURRENT, cutawayNetlist } from './cutaway-circuit';
import { Armature } from './armature';

/** Turn the supply knob to `v` volts and let things settle. */
function at(e: ReturnType<typeof createAnalogEngine>, v: number) {
  e.setParam('S', 'voltage', v);
  e.advance(0.05);
  return e.state('K1');
}

describe('the relay cutaway circuit', () => {
  test('rated numbers: 5 V across 70 Ω is 71 mA; pull-in at 50 mA (3.5 V), drop-out at 21 mA (1.5 V)', () => {
    expect(RATED_CURRENT).toBeCloseTo(0.0714, 4);
    expect(PULL_IN_CURRENT * 70).toBeCloseTo(3.5, 6);
    expect(DROP_OUT_CURRENT * 70).toBeCloseTo(1.5, 6);
  });

  test('hysteresis: it pulls in near 3.5 V rising and lets go near 1.5 V falling', () => {
    const e = createAnalogEngine(cutawayNetlist());
    // Slowly up: not in at 3.3 V, in at 3.6 V.
    expect(at(e, 3.3).energised).toBe(false);
    expect(at(e, 3.6).energised).toBe(true);
    // Slowly down: still in at 2.0 V and 1.6 V (below pull-in, above drop-out), out at 1.4 V.
    expect(at(e, 2.0).energised).toBe(true);
    expect(at(e, 1.6).energised).toBe(true);
    expect(at(e, 1.4).energised).toBe(false);
    // The same 2 V is "off" on the way up and "on" on the way down.
    expect(at(e, 2.0).energised).toBe(false);
  });

  test('the contacts steer the current: NO lights the green LED, NC the red one', () => {
    const e = createAnalogEngine(cutawayNetlist());
    e.advance(0.05);
    expect(e.state('D2').brightness as number).toBeGreaterThan(0.3);
    expect(e.state('D1').brightness as number).toBeLessThan(0.01);
    at(e, 5);
    expect(e.state('D1').brightness as number).toBeGreaterThan(0.3);
    expect(e.state('D2').brightness as number).toBeLessThan(0.01);
  });

  test('the animated armature arrives when the engine’s contact closes', () => {
    const e = createAnalogEngine(cutawayNetlist());
    e.advance(0.02);
    e.setParam('S', 'voltage', 5);
    const a = new Armature();
    let closedAt = NaN;
    let armAt = NaN;
    const t0 = e.time;
    for (let i = 0; i < 2000 && (Number.isNaN(closedAt) || Number.isNaN(armAt)); i++) {
      e.advance(1e-5);
      const s = e.state('K1');
      a.update(1e-5, !!s.energised, 0.005);
      if (s.closed && Number.isNaN(closedAt)) closedAt = e.time - t0;
      if (a.position >= 1 && Number.isNaN(armAt)) armAt = e.time - t0;
    }
    expect(Math.abs(closedAt - armAt)).toBeLessThan(2e-4);
  });

  test('no bleeder resistors: while the armature is in flight both LEDs float, and the solver copes', () => {
    // (The netlist once had a 10 MΩ resistor across each LED to keep the solver from stalling; the engine no longer needs them.)
    const nl = cutawayNetlist();
    expect(nl.elements.filter((x) => x.type === 'resistor').map((x) => x.id)).toEqual(['R1', 'R2']);
    const e = createAnalogEngine(nl);
    /** Advance in frame-sized pieces, as the figure does; every piece must reach its target time. */
    const frames = (dt: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const t = e.time;
        e.advance(dt);
        expect(e.time - t).toBeCloseTo(dt, 9);
      }
    };
    frames(1e-3, 20);
    for (const v of [5, 0, 5, 0]) {
      e.setParam('S', 'voltage', v);
      frames(1e-4, 300);
    }
    // Nothing failed, and the solver did not fall into tiny steps.
    expect(e.stats.failures).toBe(0);
    expect(e.stats.steps).toBeLessThan(5000);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    frames(1e-3, 50);
    expect(e.state('D2').brightness as number).toBeGreaterThan(0.3);
    expect(e.state('D1').brightness as number).toBeLessThan(0.01);
  });
});
