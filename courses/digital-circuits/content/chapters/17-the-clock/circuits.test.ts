import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import { createAnalogEngine } from '$lib/sim/analog';
import type { Circuit } from '$lib/sim/netlist/types';

/**
 * Every live circuit of Chapter 17 must do what the text says. Each test loads the JSON exactly as the page does,
 * flips the switches through `setParam` (as a click does), and reads the engine.
 */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const ns = 1e-9;

function digital(name: string) {
  const flat = flatten(load(name));
  const e = createDigitalEngine(flat);
  const net = (id: string, pin = 0) => flat.elements.find((x) => x.id === id)!.pins[pin]!;
  const pinNet = (id: string, pinName: string) => {
    const el = flat.elements.find((x) => x.id === id)!;
    return el.pins[el.pinNames!.indexOf(pinName)]!;
  };
  return { e, flat, net, pinNet };
}

describe('the circuits load and run without messages', () => {
  for (const name of ['d-latch', 'latch-race', 'master-slave', 'toggle-ff']) {
    test(name, () => {
      const b = digital(name);
      b.e.advance(200 * ns);
      expect(b.e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
});

describe('the D latch (Figure 17.1)', () => {
  test('is transparent while EN is 1 and holds while EN is 0', () => {
    const { e, net } = digital('d-latch');
    const q = () => e.logic(net('Q'));
    const qn = () => e.logic(net('Qn'));
    e.setParam('D', 'on', false);
    e.advance(50 * ns);
    expect([q(), qn()]).toEqual([0, 1]);
    e.setParam('D', 'on', true);
    e.advance(50 * ns);
    expect([q(), qn()]).toEqual([1, 0]);
    // Close it with D = 1, then wiggle D: Q holds.
    e.setParam('EN', 'on', false);
    e.advance(50 * ns);
    for (const d of [false, true, false, false, true, false]) {
      e.setParam('D', 'on', d);
      e.advance(50 * ns);
      expect(q()).toBe(1);
      expect(qn()).toBe(0);
    }
    // Open it again with D = 0: Q follows.
    e.setParam('EN', 'on', true);
    e.advance(50 * ns);
    expect(q()).toBe(0);
  });
  test('is five gates: an inverter and four NANDs', () => {
    const c = load('d-latch');
    const gates = c.components.filter((x) => ['not', 'nand'].includes(x.type)).map((x) => x.type).sort();
    expect(gates).toEqual(['nand', 'nand', 'nand', 'nand', 'not']);
  });
});

describe('a latch racing itself (Figure 17.2)', () => {
  test('flips every nanosecond while EN is 1, and freezes when EN falls', () => {
    const { e, net, flat } = digital('latch-race');
    const q = net('Q');
    const rec = e.watch([q]);
    e.advance(20 * ns);
    const t = rec.times();
    const v = rec.values()[0]!;
    // Changes of value only.
    const edges: number[] = [];
    for (let i = 1; i < t.length; i++) if (v[i] !== v[i - 1]) edges.push(t[i]!);
    expect(edges.length).toBeGreaterThanOrEqual(18);
    for (let i = 1; i < edges.length; i++) expect((edges[i]! - edges[i - 1]!) / ns).toBeCloseTo(1, 1);
    e.setParam('EN', 'on', false);
    e.advance(5 * ns);
    const frozen = e.logic(q);
    e.advance(50 * ns);
    expect(e.logic(q)).toBe(frozen);
    expect(flat.elements.some((x) => x.type === 'dlatch')).toBe(true);
    rec.close();
  });
});

describe('master and slave (Figure 17.3)', () => {
  test('Q changes only just after a rising clock edge, to the value D had before it; M follows D while CLK is low', () => {
    const { e, net, pinNet } = digital('master-slave');
    const clk = net('CLK');
    const d = net('D');
    const m = pinNet('M', 'Q');
    const q = pinNet('S', 'Q');
    const rec = e.watch([clk, d, m, q]);
    // D is flipped at odd moments: 30, 130 (just after an edge at 50 + ...), etc.
    const flips = [30, 130, 160, 210, 290, 330, 340, 420];
    let t = 0;
    for (const f of flips) {
      e.advance((f - t) * ns);
      t = f;
      e.setParam('D', 'on', !(e.state('D').on as boolean));
    }
    e.advance((500 - t) * ns);
    const times = rec.times();
    const [vc, vd, vm, vq] = rec.values() as [Float64Array, Float64Array, Float64Array, Float64Array];
    const at = (arr: Float64Array, time: number) => {
      let val = arr[0]!;
      for (let i = 0; i < times.length; i++) if (times[i]! <= time) val = arr[i]!;
      return val;
    };
    // Rising edges of CLK.
    const rises: number[] = [];
    for (let i = 1; i < times.length; i++) if (vc[i] === 1 && vc[i - 1] === 0) rises.push(times[i]! / ns);
    expect(rises.length).toBeGreaterThanOrEqual(4);
    // Every change of Q happens within 5 ns after a rising edge.
    for (let i = 1; i < times.length; i++) {
      if (vq[i] !== vq[i - 1]) {
        const ti = times[i]! / ns;
        expect(rises.some((r) => ti >= r && ti <= r + 5), `Q changed at ${ti} ns`).toBe(true);
      }
    }
    // Just after each edge, Q equals what D was just before it.
    for (const r of rises.slice(1)) {
      expect(at(vq, (r + 6) * ns)).toBe(at(vd, (r - 0.5) * ns));
    }
    // While CLK is low (and long after an edge), M equals D.
    for (const r of rises.slice(1)) {
      const mid = r + 75;
      if (at(vc, mid * ns) === 0 && mid < 500) expect(at(vm, mid * ns)).toBe(at(vd, mid * ns));
    }
    rec.close();
  });
});

describe('a flip-flop divides by two (Figure 17.4)', () => {
  test('Q has half the frequency of CLK', () => {
    const { e, net, pinNet } = digital('toggle-ff');
    const clk = net('CLK');
    const q = pinNet('FF', 'Q');
    const rec = e.watch([clk, q]);
    e.advance(1000 * ns);
    const t = rec.times();
    const [vc, vq] = rec.values() as [Float64Array, Float64Array];
    let clkRises = 0;
    let qChanges = 0;
    for (let i = 1; i < t.length; i++) {
      if (vc[i] === 1 && vc[i - 1] === 0) clkRises++;
      if (vq[i] !== vq[i - 1] && vq[i]! <= 1 && vq[i - 1]! <= 1) qChanges++;
    }
    expect(clkRises).toBe(10);
    expect(qChanges).toBe(clkRises);
    rec.close();
  });
});

describe('the synchroniser (Figure 17.11)', () => {
  test('FF1 goes unknown from time to time, and FF2 sits behind it', () => {
    const { e, pinNet } = digital('synchroniser');
    const q1 = pinNet('FF1', 'Q');
    const q2 = pinNet('FF2', 'Q');
    const rec = e.watch([q1, q2]);
    e.advance(2000 * ns);
    const t = rec.times();
    const [v1, v2] = rec.values() as [Float64Array, Float64Array];
    const unknown = (v: Float64Array) => {
      let total = 0;
      for (let i = 0; i < t.length; i++) if (v[i] === 2) total += ((i + 1 < t.length ? t[i + 1]! : 2000 * ns) - t[i]!) / ns;
      return total;
    };
    expect(unknown(v1)).toBeGreaterThan(0);
    expect(unknown(v2)).toBeLessThan(unknown(v1));
    // The engine says why, once per violation.
    expect(e.messages.some((m) => m.level === 'warning' && /FF1/.test(m.text))).toBe(true);
    rec.close();
  });
});

describe('the 555 astable (Figure 17.9)', () => {
  // A frame of the page at speed 0.05 is about 1 ms of circuit time; the reader can raise the speed.
  for (const frame of [0.0008, 0.0032, 0.0128]) {
    test(`the OUT lamp blinks at about the formula frequency, with frames of ${frame * 1000} ms`, () => {
      const flat = flatten(load('astable-555'));
      const e = createAnalogEngine(flat);
      const out = flat.elements.find((x) => x.id === 'OUT')!.pins[0]!;
      const rec = e.watch([out]);
      const end = 0.6;
      while (e.time < end - 1e-12) e.advance(Math.min(frame, end - e.time));
      const t = rec.times();
      const v = rec.values()[0]!;
      const rises: number[] = [];
      for (let i = 1; i < t.length; i++) if (v[i - 1]! < 2.5 && v[i]! >= 2.5) rises.push(t[i]!);
      expect(rises.length).toBeGreaterThanOrEqual(6);
      const period = (rises[rises.length - 1]! - rises[1]!) / (rises.length - 2);
      // 1.44 / ((1 k + 20 k) × 4.7 µ) = 14.6 Hz.
      expect(1 / period).toBeGreaterThan(13.5);
      expect(1 / period).toBeLessThan(15.5);
      rec.close();
    });
  }
  test('the supply is an ideal rail, and the figure still oscillates', () => {
    const c = load('astable-555');
    expect(c.components.some((x) => x.type === 'rail')).toBe(true);
    expect(c.components.some((x) => x.type === 'battery')).toBe(false);
  });

  // R1 and C1 are what the reader can change in the figure (double-click the part); the drawn circuit must keep
  // working over the whole range the widget offers, up to R1 = 1 MΩ.
  for (const [r1, c1] of [
    [100e3, 1e-6],
    [1e6, 1e-7],
  ] as const) {
    test(`R1 = ${r1 / 1000} kΩ, C1 = ${c1 * 1e6} µF: the OUT lamp still follows the formula`, () => {
      const circuit = load('astable-555');
      circuit.components.find((x) => x.id === 'R1')!.params = { resistance: r1 };
      circuit.components.find((x) => x.id === 'C1')!.params = { capacitance: c1 };
      const flat = flatten(circuit);
      const e = createAnalogEngine(flat);
      const out = flat.elements.find((x) => x.id === 'OUT')!.pins[0]!;
      const rec = e.watch([out]);
      const period = 0.693 * (r1 + 2 * 10e3) * c1;
      const end = period * 6;
      const frame = period / 40;
      while (e.time < end - 1e-12) e.advance(Math.min(frame, end - e.time));
      const t = rec.times();
      const v = rec.values()[0]!;
      const rises: number[] = [];
      for (let i = 1; i < t.length; i++) if (v[i - 1]! < 2.5 && v[i]! >= 2.5) rises.push(t[i]!);
      expect(rises.length).toBeGreaterThanOrEqual(4);
      const measured = (rises[rises.length - 1]! - rises[1]!) / (rises.length - 2);
      expect(Math.abs(measured / period - 1)).toBeLessThan(0.08);
      rec.close();
    });
  }
});
