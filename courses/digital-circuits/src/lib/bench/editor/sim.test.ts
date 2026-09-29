import { describe, expect, test } from 'vitest';
import type { Circuit } from '../../sim/netlist/types';
import '../../sim/netlist/catalog';
import { Stepper, clampSpeed, defaultSpeed, engineOf, engineProblems, snapSpeed, speedAt, speedIndex, suggestEngine } from './sim';

const circuit = (types: string[], extra: Partial<Circuit> = {}): Circuit => ({
  version: 1,
  components: types.map((type, i) => ({ id: `X${i}`, type, x: i * 6, y: 0 })),
  wires: [],
  ...extra,
});

describe('engine choice', () => {
  test('analog circuits, logic circuits and mixtures', () => {
    expect(suggestEngine(circuit([]))).toBe('analog');
    expect(suggestEngine(circuit(['battery', 'resistor', 'led']))).toBe('analog');
    expect(suggestEngine(circuit(['toggle', 'nand', 'indicator']))).toBe('digital');
    expect(suggestEngine(circuit(['toggle', 'resistor', 'led']))).toBe('analog');
    expect(suggestEngine(circuit(['nmos', 'pmos', 'rail']))).toBe('analog');
  });
  test('parts that only the digital engine has force it', () => {
    expect(suggestEngine(circuit(['battery', 'dff']))).toBe('digital');
    expect(suggestEngine(circuit(['tristate']))).toBe('digital');
  });
  test('problems name the parts an engine cannot run', () => {
    expect(engineProblems(circuit(['resistor', 'nand']), 'digital')).toEqual(['X0 (Resistor)']);
    expect(engineProblems(circuit(['nand', 'toggle']), 'digital')).toEqual([]);
    expect(engineProblems(circuit(['dff']), 'analog')).toEqual(['X0 (D flip-flop)']);
  });
  test('the circuit\'s own choice wins', () => {
    expect(engineOf(circuit(['nand'], { engine: 'switch' }))).toBe('switch');
    expect(engineOf(circuit(['nand']))).toBe('digital');
  });
});

describe('default speed', () => {
  test('oscillators are slowed to a visible rate', () => {
    const c: Circuit = { version: 1, components: [{ id: 'G', type: 'siggen', x: 0, y: 0, params: { frequency: 1000 } }], wires: [] };
    expect(defaultSpeed(c)).toBeCloseTo(5e-4);
    const k: Circuit = { version: 1, components: [{ id: 'K', type: 'clock', x: 0, y: 0 }], wires: [] };
    expect(defaultSpeed(k)).toBe(0.5);
  });
  test('static circuits: real time for analog, microseconds for logic', () => {
    expect(defaultSpeed(circuit(['battery', 'resistor']))).toBe(1);
    expect(defaultSpeed(circuit(['nand', 'nand']))).toBe(1e-6);
  });
  test('the 1–2–5 ladder', () => {
    expect(speedIndex(1)).toBe(0);
    expect(speedIndex(1e-6)).toBe(-18);
    expect([-1, 0, 1, 2, 3, 4].map(speedAt)).toEqual([0.5, 1, 2, 5, 10, 20]);
    expect(snapSpeed(0.0035)).toBe(0.005);
    expect(snapSpeed(1e-30)).toBe(clampSpeed(1e-30));
  });
});

describe('Stepper', () => {
  /** An engine costing `ms` of fake time per simulated second. */
  function fake(costMsPerSimSecond: number) {
    let now = 0;
    const engine = {
      time: 0,
      advance(dt: number) {
        this.time += dt;
        now += dt * costMsPerSimSecond;
      },
    };
    return { engine, clock: () => now };
  }

  test('a cheap engine gets everything it is asked for', () => {
    const { engine, clock } = fake(1);
    const s = new Stepper(10, clock);
    s.advance(engine, 0.005);
    expect(engine.time).toBeCloseTo(0.005, 9);
    expect(s.lagging).toBe(false);
    expect(s.advanced).toBeCloseTo(0.005, 9);
  });

  test('an expensive engine is cut off near the budget and reports lagging', () => {
    // 1e6 ms of real time per simulated second: a whole 16 ms frame would take four hours.
    const { engine, clock } = fake(1e6);
    const s = new Stepper(10, clock);
    s.advance(engine, 0.016);
    expect(s.lagging).toBe(true);
    expect(engine.time).toBeLessThan(0.016);
    expect(clock()).toBeLessThan(40);
    // After a few frames the chunk has adapted, so each frame uses about the budget without overshooting far.
    for (let i = 0; i < 10; i++) s.advance(engine, 0.016);
    const before = clock();
    s.advance(engine, 0.016);
    expect(clock() - before).toBeLessThanOrEqual(15);
    expect(s.advanced).toBeGreaterThan(0);
  });

  test('non-positive requests do nothing', () => {
    const { engine, clock } = fake(1);
    const s = new Stepper(10, clock);
    s.advance(engine, 0);
    s.advance(engine, -1);
    expect(engine.time).toBe(0);
  });
});
