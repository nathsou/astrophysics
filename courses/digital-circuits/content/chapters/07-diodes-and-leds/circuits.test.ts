import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { connect } from '$lib/sim/netlist/connect';
import { createAnalogEngine, type AnalogEngine } from '$lib/sim/analog';
import { VT, pnjlim, vcrit, safeExp, safeExpD, type StampContext } from '$lib/sim/analog/device';
import type { Circuit } from '$lib/sim/netlist/types';

/**
 * Every live circuit of Chapter 7 must do what the text says it does. Each test loads the JSON exactly
 * as the page does, flips the switches through `setParam` (as a click does), lets the circuit settle and
 * reads voltages, currents and lamp brightness off the engine.
 */

const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const engine = (name: string): AnalogEngine => createAnalogEngine(flatten(load(name)));

/** Advance in frame-sized pieces, as the page does (one call of `advance` is capped at 1000 steps). */
function run(e: AnalogEngine, seconds: number, frame = 0.01): void {
  const end = e.time + seconds;
  while (e.time < end - 1e-9) e.advance(Math.min(frame, end - e.time));
}

/** The voltage of a named pin of a component in the circuit (via the connectivity of the drawing). */
function nodeVoltage(e: AnalogEngine, name: string, id: string, pin: string): number {
  const c = connect(load(name));
  return e.voltage(c.pinNet.get(`${id}.${pin}`)!);
}

const volts = (e: AnalogEngine, id: string) => e.state(id).value as number;

describe('the circuits load and run without messages', () => {
  for (const name of ['diode-lamp', 'diode-and', 'diode-or', 'diode-chain', 'led-iv']) {
    test(name, () => {
      const e = engine(name);
      run(e, 0.3);
      for (const c of load(name).components) {
        if (c.type === 'toggle') for (const on of [true, false]) { e.setParam(c.id, 'on', on); run(e, 0.1); }
      }
      expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
});

describe('a diode passes current one way (Figure 7.1)', () => {
  test('forward: the lamp is lit and the diode drops a bit under a volt', () => {
    const e = engine('diode-lamp');
    run(e, 0.5);
    expect(e.state('L1').brightness as number).toBeGreaterThan(0.5);
    expect(volts(e, 'V1')).toBeGreaterThan(0.7);
    expect(volts(e, 'V1')).toBeLessThan(0.85);
  });
  test('reversed: the lamp is dark, and the whole 6 V is across the diode', () => {
    const e = engine('diode-lamp');
    run(e, 0.5);
    expect(e.state('L2').brightness as number).toBeLessThan(0.01);
    expect(volts(e, 'V2')).toBeGreaterThan(5.99);
    // The leakage is a few nanoamps (the model's saturation current): far too little to see.
    expect(Math.abs(e.current('D2', 0))).toBeLessThan(5e-9);
  });
});

describe('an LED needs a resistor (Figure 7.4)', () => {
  test('with the 470 Ω resistor it takes about 15 mA at about 1.85 V, and lights', () => {
    const e = engine('led-resistor');
    run(e, 0.5);
    const i = e.state('A1').value as number;
    expect(i).toBeGreaterThan(0.014);
    expect(i).toBeLessThan(0.016);
    expect(volts(e, 'V1')).toBeGreaterThan(1.7);
    expect(volts(e, 'V1')).toBeLessThan(1.95);
    expect(e.state('D1').brightness as number).toBeGreaterThan(0.3);
    expect(e.state('D1').burned).toBe(false);
  });
  test('short the resistor and the LED burns out within a moment, with a message that says why', () => {
    const e = engine('led-resistor');
    run(e, 0.2);
    e.setParam('SW', 'closed', true);
    run(e, 0.5);
    expect(e.state('D1').burned).toBe(true);
    const msg = e.messages.find((m) => m.level === 'warning');
    expect(msg?.text).toMatch(/burned out/);
    expect(msg?.text).toMatch(/resistor/);
  });
  test('the current an unprotected LED would take is amperes: the exponential has no upper limit', () => {
    const e = engine('led-resistor');
    run(e, 0.1);
    e.setParam('SW', 'closed', true);
    // Watch the first few milliseconds: the current peaks at amperes, a hundred times the 30 mA rating,
    // and the LED is gone before the lamp of Figure 7.1 would have noticed.
    let peak = 0;
    let burnedAt: number | undefined;
    for (let k = 0; k < 40; k++) {
      e.advance(0.0002);
      peak = Math.max(peak, Math.abs(e.state('D1').current as number));
      if (burnedAt === undefined && e.state('D1').burned) burnedAt = k * 0.2;
    }
    expect(peak).toBeGreaterThan(1);
    expect(burnedAt).toBeDefined();
    expect(burnedAt!).toBeLessThan(8);
  });
});

/** The four input combinations of a two-input toggle gate. */
const rows = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
] as const;

describe('diode AND gate (Figure 7.6)', () => {
  test('the output is high only when both inputs are, and "low" is a diode drop above the low input', () => {
    const out: number[] = [];
    for (const [a, b] of rows) {
      const e = engine('diode-and');
      e.setParam('A', 'on', !!a);
      e.setParam('B', 'on', !!b);
      run(e, 0.1);
      out.push(volts(e, 'V1'));
    }
    expect(out[3]!).toBeGreaterThan(4.99);
    for (const i of [0, 1, 2]) {
      expect(out[i]!).toBeGreaterThan(0.4);
      expect(out[i]!).toBeLessThan(0.6);
    }
  });
});

describe('diode OR gate (Figure 7.7)', () => {
  test('the output is high when either input is, and "high" is a diode drop below the high input', () => {
    const out: number[] = [];
    for (const [a, b] of rows) {
      const e = engine('diode-or');
      e.setParam('A', 'on', !!a);
      e.setParam('B', 'on', !!b);
      run(e, 0.1);
      out.push(volts(e, 'V1'));
    }
    expect(out[0]!).toBeLessThan(0.01);
    for (const i of [1, 2, 3]) {
      expect(out[i]!).toBeGreaterThan(4.3);
      expect(out[i]!).toBeLessThan(4.6);
    }
  });
});

describe('a chain of four diode gates (Figure 7.8)', () => {
  test('a 5 V input arrives as 4.3, 3.6, 2.9 and 2.3 V: about 0.65 V lost at every stage', () => {
    const e = engine('diode-chain');
    run(e, 0.1);
    const v = ['V1', 'V2', 'V3', 'V4'].map((id) => volts(e, id));
    const want = [4.29, 3.6, 2.94, 2.32];
    v.forEach((x, i) => expect(Math.abs(x - want[i]!)).toBeLessThan(0.06));
    for (let i = 1; i < 4; i++) {
      expect(v[i - 1]! - v[i]!).toBeGreaterThan(0.6);
      expect(v[i - 1]! - v[i]!).toBeLessThan(0.7);
    }
    // The last output is below the 3.5 V that a 5 V CMOS input needs to read a 1 (Chapter 10), so the engine calls it undefined or low.
    expect(v[3]!).toBeLessThan(3.5);
  });
  test('a low input stays low all the way along (the loss is only in the high level)', () => {
    const e = engine('diode-chain');
    e.setParam('A', 'on', false);
    run(e, 0.1);
    for (const id of ['V1', 'V2', 'V3', 'V4']) expect(Math.abs(volts(e, id))).toBeLessThan(0.01);
  });
  test('no output is ever above its input: a diode gate cannot amplify', () => {
    const e = engine('diode-chain');
    run(e, 0.1);
    const v = ['V1', 'V2', 'V3', 'V4'].map((id) => volts(e, id));
    expect(v[0]!).toBeLessThan(5);
    for (let i = 1; i < 4; i++) expect(v[i]!).toBeLessThan(v[i - 1]!);
  });
});

describe("an LED's curve with a potentiometer (Figure 7.5)", () => {
  /** The pot is a rheostat here: 0 % is 0 Ω (only the 220 Ω resistor limits the current), 100 % is 100 kΩ more. */
  function point(position: number) {
    const e = engine('led-iv');
    e.setParam('POT', 'position', position);
    run(e, 0.1);
    return { v: volts(e, 'V1'), i: e.state('A1').value as number };
  }
  test('turning the knob up cuts the current from about 14 mA to 35 µA, while the LED voltage falls by only a third of a volt', () => {
    const p = [0, 0.02, 0.1, 0.4, 1].map(point);
    for (let k = 1; k < p.length; k++) {
      expect(p[k]!.i).toBeLessThan(p[k - 1]!.i);
      expect(p[k]!.v).toBeLessThan(p[k - 1]!.v);
    }
    expect(p[0]!.i).toBeGreaterThan(0.013);
    expect(p[0]!.i).toBeLessThan(0.015);
    expect(p[0]!.v).toBeGreaterThan(1.8);
    expect(p[0]!.v).toBeLessThan(1.95);
    expect(p[4]!.i).toBeGreaterThan(30e-6);
    expect(p[4]!.i).toBeLessThan(40e-6);
    // A factor of 400 in current, a third of a volt in voltage.
    expect(p[0]!.i / p[4]!.i).toBeGreaterThan(300);
    expect(p[0]!.v - p[4]!.v).toBeGreaterThan(0.28);
    expect(p[0]!.v - p[4]!.v).toBeLessThan(0.4);
  });
  test('each ×10 in current costs about 0.13 V: the curve is an exponential (an ideality factor near 2 for this LED)', () => {
    const hi = point(0);
    const lo = point(1);
    const perDecade = (hi.v - lo.v) / Math.log10(hi.i / lo.i);
    expect(perDecade).toBeGreaterThan(0.11);
    expect(perDecade).toBeLessThan(0.15);
    // Between the middle points the same holds.
    const a = point(0.02);
    const b = point(0.2);
    expect((a.v - b.v) / Math.log10(a.i / b.i)).toBeGreaterThan(0.1);
    expect((a.v - b.v) / Math.log10(a.i / b.i)).toBeLessThan(0.16);
  });
});

describe('Newton–Raphson with junction limiting (the "under the hood" box)', () => {
  const IS = 2.5e-9;
  const NVT = 1.75 * VT;
  const VCR = vcrit(NVT, IS);
  /**
   * Solve 5 V = V + 1000 Ω · I(V) for the engine's default diode by Newton's method: each iteration
   * linearises the diode at the last guess (g = dI/dV, plus a constant current) and solves the
   * resulting resistor circuit exactly. Returns the guesses.
   */
  function newton(limit: boolean): { guesses: number[]; converged: boolean } {
    const ctx = { limited: false } as unknown as StampContext;
    let v = 0; // the guess for the diode voltage
    let vOld = 0;
    const guesses: number[] = [];
    for (let k = 0; k < 200; k++) {
      // Companion model at v: I ≈ id + g (V' − v), and the loop equation 5 = V' + R I.
      const id = IS * (safeExp(v / NVT) - 1);
      const g = (IS * safeExpD(v / NVT)) / NVT;
      const vNew = (5 - 1000 * (id - g * v)) / (1 + 1000 * g);
      const next = limit ? pnjlim(ctx, vNew, vOld, NVT, VCR) : vNew;
      guesses.push(next);
      if (Math.abs(next - v) < 1e-9) return { guesses, converged: true };
      vOld = v;
      v = next;
    }
    return { guesses, converged: false };
  }

  test('the answer is a diode voltage of about 0.65 V at 4.4 mA', () => {
    const { guesses } = newton(true);
    const v = guesses[guesses.length - 1]!;
    expect(v).toBeGreaterThan(0.6);
    expect(v).toBeLessThan(0.7);
    expect((5 - v) / 1000).toBeGreaterThan(0.004);
    expect((5 - v) / 1000).toBeLessThan(0.0046);
  });

  test('the first guess without limiting jumps to almost the whole supply, where the exponential is astronomical', () => {
    const { guesses } = newton(false);
    expect(guesses[0]!).toBeGreaterThan(4.9);
    expect(IS * Math.exp(guesses[0]! / NVT)).toBeGreaterThan(1e30);
  });

  test('with the limiter Newton converges in 11 iterations; without it the guess crawls down in steps of nVt and takes about 70', () => {
    const withLimit = newton(true);
    const without = newton(false);
    expect(withLimit.converged).toBe(true);
    expect(withLimit.guesses.length).toBeLessThanOrEqual(12);
    expect(without.converged).toBe(true);
    expect(without.guesses.length).toBeGreaterThan(60);
    expect(without.guesses.length).toBeLessThan(90);
    // Far from the answer, each unlimited step lowers the guess by exactly nVt = 45 mV.
    expect(without.guesses[4]! - without.guesses[5]!).toBeCloseTo(NVT, 3);
  });

  test('pnjlim leaves small steps alone and turns big ones into logarithmic ones', () => {
    const ctx = { limited: false } as unknown as StampContext;
    expect(pnjlim(ctx, 0.66, 0.65, NVT, VCR)).toBe(0.66);
    expect(ctx.limited).toBe(false);
    const stepped = pnjlim(ctx, 5, 0.65, NVT, VCR);
    expect(ctx.limited).toBe(true);
    expect(stepped).toBeGreaterThan(0.65);
    expect(stepped).toBeLessThan(1);
  });
});
