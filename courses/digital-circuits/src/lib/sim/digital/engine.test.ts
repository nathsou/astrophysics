import { describe, expect, test } from 'vitest';
import { NetlistBuilder, createDigitalEngine, type DigitalEngineOptions } from './index';
import { LX } from '../netlist/types';
import type { Circuit } from '../netlist/types';
import { flatten } from '../netlist/flatten';
import type { Recorder } from '../engine';

const NS = 1e-9;

/** Rows of a recorder as [time in ns (rounded to ps), ...values]. */
function rows(r: Recorder): number[][] {
  const t = r.times();
  const v = r.values();
  return Array.from(t, (time, i) => [Math.round(time * 1e12) / 1e3, ...v.map((a) => a[i]!)]);
}

/** Times (ns) at which a single watched net rose to 1. */
function risingEdges(r: Recorder): number[] {
  const out: number[] = [];
  const rs = rows(r);
  for (let i = 1; i < rs.length; i++) if (rs[i]![1] === 1 && rs[i - 1]![1] !== 1) out.push(rs[i]![0]!);
  return out;
}

function pulseBench(options: DigitalEngineOptions) {
  const b = new NetlistBuilder();
  const a = b.net('A');
  const y = b.net('Y');
  b.add('toggle', 'S', { Y: a });
  b.add('buffer', 'U1', { A: a, Y: y }, { delay: 1 });
  const e = createDigitalEngine(b.build(), options);
  e.advance(10 * NS);
  const r = e.watch([y]);
  // A 0.5 ns pulse.
  e.setParam('S', 'on', true);
  e.advance(0.5 * NS);
  e.setParam('S', 'on', false);
  e.advance(10 * NS);
  return rows(r);
}

describe('delays', () => {
  test('inertial delay swallows a pulse shorter than the gate delay', () => {
    expect(pulseBench({})).toEqual([[10, 0]]);
  });

  test('transport delay passes it, one delay later', () => {
    expect(pulseBench({ delayModel: 'transport' })).toEqual([
      [10, 0],
      [11, 1],
      [11.5, 0],
    ]);
  });

  test('a pulse longer than the delay passes with inertial delay too', () => {
    const b = new NetlistBuilder();
    const a = b.net();
    const y = b.net();
    b.add('toggle', 'S', { Y: a });
    b.add('buffer', 'U1', { A: a, Y: y }, { delay: 1 });
    const e = createDigitalEngine(b.build());
    e.advance(10 * NS);
    const r = e.watch([y]);
    e.setParam('S', 'on', true);
    e.advance(1.5 * NS);
    e.setParam('S', 'on', false);
    e.advance(10 * NS);
    expect(rows(r)).toEqual([
      [10, 0],
      [11, 1],
      [12.5, 0],
    ]);
  });

  test('gate outputs are X until their first delay has passed', () => {
    const b = new NetlistBuilder();
    const a = b.net();
    const y = b.net();
    b.add('toggle', 'S', { Y: a });
    b.add('not', 'U1', { A: a, Y: y }, { delay: 2.5 });
    const e = createDigitalEngine(b.build());
    expect(e.time).toBe(0);
    expect(e.logic(y)).toBe(LX);
    e.advance(2.4 * NS);
    expect(e.logic(y)).toBe(LX);
    e.advance(0.1 * NS);
    expect(e.logic(y)).toBe(1);
    expect(e.time).toBeCloseTo(2.5e-9, 15);
  });

  test('setParam changes a gate delay while running', () => {
    const b = new NetlistBuilder();
    const a = b.net();
    const y = b.net();
    b.add('toggle', 'S', { Y: a });
    b.add('not', 'U1', { A: a, Y: y }, { delay: 1 });
    const e = createDigitalEngine(b.build());
    e.advance(5 * NS);
    e.setParam('U1', 'delay', 3);
    e.setParam('S', 'on', true);
    e.advance(2.9 * NS);
    expect(e.logic(y)).toBe(1);
    e.advance(0.1 * NS);
    expect(e.logic(y)).toBe(0);
  });
});

/** A ring of n inverters; returns the engine and the ring's nets. */
function ring(n: number, delay: number, options: DigitalEngineOptions = {}, zero = false) {
  const b = new NetlistBuilder();
  const nets = b.nets(n, 'n');
  for (let i = 0; i < n; i++) b.add('not', `U${i + 1}`, { A: nets[(i + n - 1) % n]!, Y: nets[i]! }, { delay: zero ? 0 : delay });
  return { e: createDigitalEngine(b.build(), options), nets };
}

describe('feedback', () => {
  test('a ring of three inverters oscillates with period 2 · 3 · delay', () => {
    const { e, nets } = ring(3, 1);
    const r = e.watch([nets[0]!]);
    e.advance(100 * NS);
    const edges = risingEdges(r);
    expect(edges.length).toBeGreaterThan(10);
    for (let i = 1; i < edges.length; i++) expect(edges[i]! - edges[i - 1]!).toBeCloseTo(6, 9);
    // Duty cycle 50 %: each net is high for three delays.
    const rs = rows(r).slice(1);
    for (let i = 1; i < rs.length; i++) expect(rs[i]![0]! - rs[i - 1]![0]!).toBeCloseTo(3, 9);
    expect(e.messages.some((m) => m.level === 'info' && m.text.includes('random state'))).toBe(true);
  });

  test('a ring of five 2 ns inverters has period 20 ns', () => {
    const { e, nets } = ring(5, 2);
    const r = e.watch([nets[2]!]);
    e.advance(200 * NS);
    const edges = risingEdges(r);
    for (let i = 1; i < edges.length; i++) expect(edges[i]! - edges[i - 1]!).toBeCloseTo(20, 9);
  });

  test('an even ring powers up in one of its two stable states and stays there', () => {
    for (const seed of [1, 2, 3, 4]) {
      const { e, nets } = ring(2, 1, { seed });
      const r = e.watch(nets);
      e.advance(50 * NS);
      expect(rows(r)).toHaveLength(1);
      const [a, b] = nets.map((n) => e.logic(n));
      expect(a === 0 || a === 1).toBe(true);
      expect(b).toBe(1 - a!);
    }
  });

  test('with powerUp: "x" a ring stays unknown', () => {
    const { e, nets } = ring(3, 1, { powerUp: 'x' });
    e.advance(50 * NS);
    expect(nets.map((n) => e.logic(n))).toEqual([LX, LX, LX]);
  });

  test('the power-up choice is seeded: same seed, same state', () => {
    const states = (seed: number) => {
      const { e, nets } = ring(4, 1, { seed });
      return nets.map((n) => e.logic(n)).join('');
    };
    expect(states(7)).toBe(states(7));
    const all = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(states));
    expect(all.size).toBe(2); // 0101 or 1010
  });

  test('a zero-delay loop that never settles is reported, not hung', () => {
    const { e, nets } = ring(1, 0, {}, true);
    const err = e.messages.find((m) => m.level === 'error');
    expect(err?.text).toContain('U1');
    expect(err?.element).toBe('U1');
    expect(e.logic(nets[0]!)).toBe(LX);
    e.advance(10 * NS);
    expect(e.logic(nets[0]!)).toBe(LX);
  });

  test('a zero-delay loop started by a switch is reported at that time', () => {
    const b = new NetlistBuilder();
    const en = b.net('EN');
    const y = b.net('Y');
    const z = b.net('Z');
    b.add('toggle', 'S', { Y: en });
    b.add('nand', 'U1', { A: en, B: z, Y: y }, { delay: 0 });
    b.add('buffer', 'U2', { A: y, Y: z }, { delay: 0 });
    const e = createDigitalEngine(b.build(), { maxDeltaCycles: 500 });
    e.advance(5 * NS);
    expect(e.logic(y)).toBe(1);
    expect(e.messages.filter((m) => m.level === 'error')).toHaveLength(0);
    e.setParam('S', 'on', true);
    const err = e.messages.find((m) => m.level === 'error');
    expect(err?.text).toMatch(/U1, U2|U2, U1/);
    expect(err?.time).toBeCloseTo(5e-9, 15);
    expect(e.logic(y)).toBe(LX);
    expect(e.logic(z)).toBe(LX);
    // It keeps running.
    e.advance(5 * NS);
    expect(e.time).toBeCloseTo(10e-9, 15);
  });

  test('an SR latch of NOR gates powers up consistent and holds', () => {
    const b = new NetlistBuilder();
    const [s, r, q, qn] = [b.net('S'), b.net('R'), b.net('Q'), b.net('Qn')];
    b.add('button', 'BS', { Y: s });
    b.add('button', 'BR', { Y: r });
    b.add('nor', 'N1', { A: r, B: qn, Y: q });
    b.add('nor', 'N2', { A: s, B: q, Y: qn });
    const e = createDigitalEngine(b.build());
    e.advance(10 * NS);
    const q0 = e.logic(q);
    expect(q0 === 0 || q0 === 1).toBe(true);
    expect(e.logic(qn)).toBe(1 - q0);

    const press = (id: string) => {
      e.setParam(id, 'pressed', true);
      e.advance(5 * NS);
      e.setParam(id, 'pressed', false);
      e.advance(20 * NS);
    };
    press('BS');
    expect([e.logic(q), e.logic(qn)]).toEqual([1, 0]);
    e.advance(100 * NS);
    expect([e.logic(q), e.logic(qn)]).toEqual([1, 0]);
    press('BR');
    expect([e.logic(q), e.logic(qn)]).toEqual([0, 1]);
    e.advance(100 * NS);
    expect([e.logic(q), e.logic(qn)]).toEqual([0, 1]);
  });
});

describe('watch()', () => {
  test('records a static-hazard glitch on a timing diagram', () => {
    // Y = A AND NOT A: in theory always 0, but the inverter's delay lets a 1 ns pulse through.
    const b = new NetlistBuilder();
    const a = b.net('A');
    const na = b.net('nA');
    const y = b.net('Y');
    b.add('toggle', 'S', { Y: a });
    b.add('not', 'U1', { A: a, Y: na }, { delay: 1 });
    b.add('and', 'U2', { A: a, B: na, Y: y }, { delay: 1 });
    const e = createDigitalEngine(b.build());
    e.advance(10 * NS);
    const r = e.watch([a, na, y]);
    e.setParam('S', 'on', true);
    e.advance(10 * NS);
    expect(rows(r)).toEqual([
      [10, 0, 1, 0],
      [10, 1, 1, 0],
      [11, 1, 0, 0],
      [11, 1, 0, 1],
      [12, 1, 0, 0],
    ]);
    // The final value alone would hide it.
    expect(e.logic(y)).toBe(0);
  });

  test('records a zero-width glitch between delta cycles', () => {
    const b = new NetlistBuilder();
    const a = b.net('A');
    const na = b.net('nA');
    const y = b.net('Y');
    b.add('toggle', 'S', { Y: a });
    b.add('not', 'U1', { A: a, Y: na }, { delay: 0 });
    b.add('and', 'U2', { A: a, B: na, Y: y }, { delay: 0 });
    const e = createDigitalEngine(b.build());
    const r = e.watch([y]);
    e.advance(10 * NS);
    e.setParam('S', 'on', true);
    expect(rows(r)).toEqual([
      [0, 0],
      [10, 1],
      [10, 0],
    ]);
    expect(r.times()[1]).toBe(r.times()[2]);
  });

  test('trim keeps a bounded window and close stops recording', () => {
    const b = new NetlistBuilder();
    const c = b.net('CLK');
    b.add('clock', 'C', { Y: c }, { frequency: 1e8 });
    const e = createDigitalEngine(b.build());
    const r = e.watch([c]);
    e.advance(1e-6);
    expect(r.times().length).toBe(201);
    r.trim(100e-9);
    const t = r.times();
    // 900 … 1000 ns, plus the last row before the window (895 ns) so the starting level is known.
    expect(t.length).toBe(22);
    expect(t[0]).toBeCloseTo(0.895e-6, 15);
    r.close();
    e.advance(1e-6);
    expect(r.times().length).toBe(22);
  });
});

describe('reset and state', () => {
  test('reset() goes back to t = 0, keeping parameters', () => {
    const b = new NetlistBuilder();
    const a = b.net();
    const y = b.net();
    b.add('toggle', 'S', { Y: a });
    b.add('not', 'U1', { A: a, Y: y });
    const e = createDigitalEngine(b.build());
    e.setParam('S', 'on', true);
    e.advance(5 * NS);
    expect(e.logic(y)).toBe(0);
    e.reset();
    expect(e.time).toBe(0);
    expect(e.logic(a)).toBe(1);
    expect(e.logic(y)).toBe(LX);
    e.advance(1 * NS);
    expect(e.logic(y)).toBe(0);
    expect(e.state('S')).toEqual({ value: 1, on: true });
  });

  test('messages about the netlist survive reset', () => {
    const b = new NetlistBuilder();
    b.add('resistor', 'R1', [b.net(), b.net()]);
    const e = createDigitalEngine(b.build());
    expect(e.messages.some((m) => m.element === 'R1')).toBe(true);
    e.reset();
    expect(e.messages.some((m) => m.element === 'R1')).toBe(true);
  });

  test('io states: indicator, probe, seven-segment and hex displays', () => {
    const b = new NetlistBuilder();
    const bits = b.nets(8);
    bits.forEach((n, i) => b.add('const', `C${i}`, { Y: n }, { value: [1, 0, 1, 1, 0, 1, 1, 0][i]! }));
    b.add('indicator', 'L', { A: bits[0]! });
    b.add('probe', 'P', { A: bits[1]! });
    b.add('seven-seg', 'SEG', bits);
    b.add('hex-display', 'HEX', bits.slice(0, 4));
    const e = createDigitalEngine(b.build());
    expect(e.state('L')).toEqual({ lit: true, brightness: 1, value: 1 });
    expect(e.state('P')).toEqual({ value: 0 });
    expect(e.state('SEG')).toEqual({ segments: 0b01101101, unknown: false });
    expect(e.state('HEX')).toEqual({ value: 0b1101 });
    e.setParam('C2', 'value', LX);
    expect(e.state('SEG')).toEqual({ segments: 0b01101001, unknown: true });
    expect(e.state('HEX').value).toBeUndefined();
    expect(e.state('nothing')).toEqual({});
    expect(e.current('L', 0)).toBe(0);
  });
});

describe('clock', () => {
  test('starts at 0, first rising edge after half a period, then every period', () => {
    const b = new NetlistBuilder();
    const c = b.net();
    b.add('clock', 'C', { Y: c }, { frequency: 1e6 });
    const e = createDigitalEngine(b.build());
    expect(e.logic(c)).toBe(0);
    const r = e.watch([c]);
    e.advance(3.2e-6);
    expect(rows(r)).toEqual([
      [0, 0],
      [500, 1],
      [1000, 0],
      [1500, 1],
      [2000, 0],
      [2500, 1],
      [3000, 0],
    ]);
  });

  test('duty cycle, and a frequency change that keeps the phase', () => {
    const b = new NetlistBuilder();
    const c = b.net();
    b.add('clock', 'C', { Y: c }, { frequency: 1e6, duty: 0.25 });
    const e = createDigitalEngine(b.build());
    const r = e.watch([c]);
    e.advance(1.1e-6);
    expect(rows(r)).toEqual([
      [0, 0],
      [750, 1],
      [1000, 0],
    ]);
    // 10 % into the second period; at 2 MHz the next rise is 0.65 · 500 ns later.
    e.setParam('C', 'frequency', 2e6);
    e.advance(1e-6);
    expect(rows(r).slice(3)).toEqual([
      [1100 + 325, 1],
      [1100 + 450, 0],
      [1100 + 450 + 375, 1],
      [1100 + 450 + 500, 0],
    ]);
    expect(e.state('C')).toEqual({ value: 0, frequency: 2e6 });
  });

  test('advance() moves time even with no events', () => {
    const b = new NetlistBuilder();
    b.add('toggle', 'S', [b.net()]);
    const e = createDigitalEngine(b.build());
    e.advance(1);
    expect(e.time).toBe(1);
    e.settle();
    expect(e.time).toBe(1);
  });
});

describe('subcircuits', () => {
  // XOR from four NANDs, as in netlist.test.ts.
  const nand = (id: string, x: number, y: number) => ({ id, type: 'nand', x, y });
  const xor: Circuit = {
    version: 1,
    title: 'XOR',
    components: [
      { id: 'PA', type: 'port', x: 0, y: 0, params: { name: 'A', dir: 'in' } },
      { id: 'PB', type: 'port', x: 0, y: 2, params: { name: 'B', dir: 'in' } },
      { id: 'PY', type: 'port', x: 40, y: 1, params: { name: 'Y', dir: 'out' } },
      nand('N1', 10, 0),
      nand('N2', 20, -4),
      nand('N3', 20, 4),
      nand('N4', 30, 0),
    ],
    wires: [
      { points: [[0, 0], [10, 0]] },
      { points: [[5, 0], [5, -4], [20, -4]] },
      { points: [[0, 2], [10, 2]] },
      { points: [[7, 2], [7, 6], [20, 6]] },
      { points: [[16, 1], [18, 1], [18, -2], [20, -2]] },
      { points: [[18, 1], [18, 4], [20, 4]] },
      { points: [[26, -3], [28, -3], [28, 0], [30, 0]] },
      { points: [[26, 5], [28, 5], [28, 2], [30, 2]] },
      { points: [[36, 1], [40, 1]] },
    ],
  };

  test('an XOR built from four NANDs matches the xor gate on every input', () => {
    const top: Circuit = {
      version: 1,
      subcircuits: { xor },
      components: [
        { id: 'SA', type: 'toggle', x: -10, y: 0 },
        { id: 'SB', type: 'toggle', x: -10, y: 2 },
        { id: 'X1', type: 'sub:xor', x: 0, y: 0 },
        { id: 'OUT1', type: 'indicator', x: 20, y: 0 },
        { id: 'G', type: 'xor', x: 0, y: 20 },
        { id: 'OUT2', type: 'indicator', x: 20, y: 21 },
      ],
      wires: [
        { points: [[-7, 0], [0, 0]] },
        { points: [[-7, 2], [0, 2]] },
        { points: [[-5, 0], [-5, 20], [0, 20]] },
        { points: [[-3, 2], [-3, 22], [0, 22]] },
        { points: [[6, 0], [20, 0]] },
        { points: [[6, 21], [20, 21]] },
      ],
    };
    const e = createDigitalEngine(flatten(top));
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    for (const [a, b] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
      e.setParam('SA', 'on', a === 1);
      e.setParam('SB', 'on', b === 1);
      e.advance(10 * 1e-9);
      expect(e.state('OUT1').value, `${a} xor ${b}`).toBe(a ^ b);
      expect(e.state('OUT2').value).toBe(a ^ b);
    }
  });
});

describe('the allowance of one advance() call', () => {
  const clockNet = (frequency: number, options: DigitalEngineOptions = {}) => {
    const b = new NetlistBuilder();
    const c = b.net('C');
    b.add('clock', 'CK', { Y: c }, { frequency });
    return { e: createDigitalEngine(b.build(), options), c };
  };

  test('a ring oscillator advanced by a huge interval returns within the cap, lagging', () => {
    const { e, nets } = ring(3, 1, { maxEventsPerAdvance: 1000 });
    const r = e.watch([nets[0]!]);
    const before = e.eventCount;
    e.advance(1); // ~3e9 events if it ran to the end
    expect(e.lagging).toBe(true);
    expect(e.speed).toBeGreaterThan(0);
    expect(e.speed).toBeLessThan(1e-5);
    expect(e.time).toBeLessThan(5e-6);
    expect(e.time).toBeGreaterThan(0);
    // Within the allowance, plus the last time point.
    expect(e.eventCount - before).toBeLessThan(1010);
    expect(rows(r).length).toBeLessThan(1010);
    expect(e.messages.some((m) => m.level === 'info' && /slower than real time/.test(m.text))).toBe(true);
  });

  test('a 1 GHz clock over one second stops at the default cap and reports lagging', () => {
    const { e } = clockNet(1e9);
    e.advance(1);
    expect(e.lagging).toBe(true);
    expect(e.speed).toBeLessThan(1e-3);
    // Each edge costs two queue entries (the clock's wake-up and the change of its output), two edges a
    // period of 1 ns: the 100 000 entries of the default cap cover about 25 µs.
    expect(e.time).toBeGreaterThan(20e-6);
    expect(e.time).toBeLessThan(30e-6);
    expect(e.eventCount).toBeLessThan(100_100);
  });

  test('the message is posted once, and the next calls carry on from where the last one stopped', () => {
    const { e } = clockNet(1e9, { maxEventsPerAdvance: 500 });
    e.advance(1);
    const t1 = e.time;
    e.advance(1);
    const t2 = e.time;
    expect(t2).toBeGreaterThan(t1);
    expect(e.messages.filter((m) => /slower than real time/.test(m.text))).toHaveLength(1);
    e.reset();
    expect(e.lagging).toBe(false);
    expect(e.speed).toBe(1);
    expect(e.time).toBe(0);
    expect(e.messages.some((m) => /slower than real time/.test(m.text))).toBe(false);
  });

  test('an ordinary circuit is unaffected: it lands on its target, at speed 1', () => {
    const { e, c } = clockNet(1e6);
    const r = e.watch([c]);
    e.advance(3.2e-6);
    expect(e.lagging).toBe(false);
    expect(e.speed).toBe(1);
    expect(e.time).toBeCloseTo(3.2e-6, 15);
    expect(rows(r)).toHaveLength(7);
    // A lagging call is followed by a normal one that is not lagging.
    const slow = clockNet(1e9, { maxEventsPerAdvance: 100 });
    slow.e.advance(1);
    expect(slow.e.lagging).toBe(true);
    const t = slow.e.time;
    slow.e.advance(10 * NS);
    expect(slow.e.lagging).toBe(false);
    expect(slow.e.time).toBeCloseTo(t + 10 * NS, 12);
  });

  test('a `while (time < end)` loop makes progress with any cap and sees the same waveform as one big call', () => {
    const end = 2e-6;
    const whole = clockNet(5e6, { maxEventsPerAdvance: 1e9 });
    const rw = whole.e.watch([whole.c]);
    whole.e.advance(end);
    for (const cap of [1, 2, 3]) {
      const { e, c } = clockNet(5e6, { maxEventsPerAdvance: cap });
      const r = e.watch([c]);
      let calls = 0;
      while (e.time < end - 1e-15 && calls++ < 1000) e.advance(end - e.time);
      expect(e.time, `cap ${cap}`).toBeCloseTo(end, 12);
      expect(rows(r), `cap ${cap}`).toEqual(rows(rw));
    }
    expect(whole.e.lagging).toBe(false);
  });

  test('a zero-delay loop is still reported by maxDeltaCycles, not by the cap', () => {
    const { e } = ring(1, 0, { maxEventsPerAdvance: 10 }, true);
    e.advance(1e-6);
    expect(e.messages.some((m) => m.level === 'error' && /loop with no delay/.test(m.text))).toBe(true);
  });
});
