import { describe, expect, test } from 'vitest';
import { mulberry32 } from '../twolevel/random';
import {
  adder4Design,
  bcdDisplayDesign,
  counter4Design,
  parity4Design,
  sevenSegmentDesign,
  trafficDesign,
} from './designs';
import { CpldFitError, fitCpld, fitCpldEquations, type CpldDesign, type CpldFit } from './fit';
import { EquationModel } from './reference';

function names(d: CpldDesign): string[] {
  return d.inputs.map((i) => (typeof i === 'string' ? i : i.name));
}

/** Fit, then compare the device with the equations on every input combination (combinational designs). */
function checkExhaustive(design: CpldDesign, valid: (env: Record<string, number>) => boolean = () => true): CpldFit {
  const fit = fitCpld(design);
  const ins = names(design);
  expect(ins.length).toBeLessThanOrEqual(12);
  const model = new EquationModel(design);
  const dev = fit.device();
  for (let m = 0; m < 1 << ins.length; m++) {
    const env: Record<string, number> = {};
    ins.forEach((name, k) => (env[name] = (m >> k) & 1));
    if (!valid(env)) continue;
    const want = model.evaluate(env);
    const pins = new Array<number>(32).fill(0);
    for (const i of fit.inputs) pins[i.pin] = env[i.name]!;
    const snap = dev.evaluate({ pins });
    expect(snap.stable).toBe(true);
    for (const o of fit.outputs) {
      if (o.pin !== null) expect(snap.driven[o.pin]).toBe(true);
      expect(snap.mc[o.macrocell], `${o.name} at ${JSON.stringify(env)}`).toBe(want[o.name]);
      if (o.pin !== null) expect(snap.pins[o.pin]).toBe(want[o.name]);
    }
  }
  return fit;
}

/** Random clocked sequences: after every edge the device must match the equations. */
function checkSequence(design: CpldDesign, cycles: number, seed: number, bias: Record<string, number> = {}): CpldFit {
  const fit = fitCpld(design);
  const ins = names(design);
  const rng = mulberry32(seed);
  const model = new EquationModel(design);
  const dev = fit.device();
  // Power-up state equals the equations' initial state.
  const first = model.evaluate({});
  const snap0 = dev.evaluate({});
  for (const o of fit.outputs) expect(snap0.mc[o.macrocell], `${o.name} at power-up`).toBe(first[o.name]);
  for (let c = 0; c < cycles; c++) {
    const env: Record<string, number> = {};
    for (const name of ins) env[name] = rng.chance(bias[name] ?? 0.5) ? 1 : 0;
    const pins = new Array<number>(32).fill(0);
    for (const i of fit.inputs) pins[i.pin] = env[i.name]!;
    // Before the edge the combinational outputs already follow the new inputs.
    const pre = model.evaluate(env);
    const snapPre = dev.evaluate({ pins });
    for (const o of fit.outputs) expect(snapPre.mc[o.macrocell], `${o.name} before edge ${c}`).toBe(pre[o.name]);
    const want = model.clock(env);
    const got = dev.clock({ pins });
    for (const o of fit.outputs) expect(got.mc[o.macrocell], `${o.name} after edge ${c}`).toBe(want[o.name]);
  }
  return fit;
}

describe('fitting and evaluating equals the equations: combinational', () => {
  test('BCD to seven-segment decoder (codes 10–15 are don\'t cares)', () => {
    const fit = checkExhaustive(sevenSegmentDesign(), (e) => e.D! * 8 + e.C! * 4 + e.B! * 2 + e.A! < 10);
    expect(fit.outputs).toHaveLength(7);
    // The decoder is small: every segment fits in its own macrocell without borrowing.
    for (const o of fit.outputs) expect(o.terms).toBeLessThanOrEqual(5);
  });

  test('4-bit adder with buried carries (512 combinations)', () => {
    const fit = checkExhaustive(adder4Design());
    const carry = fit.outputs.find((o) => o.name === 'C1')!;
    expect(carry.buried).toBe(true);
    expect(carry.pin).toBeNull();
    // Buried carries leave their pads free: inputs may sit on them.
    expect(fit.utilisation.pins).toBe(9 + 5);
  });

  test('a 12-input function, exhaustively (4,096 combinations)', () => {
    const inputs = 'ABCDEFGHIJKL'.split('');
    const design: CpldDesign = {
      inputs,
      outputs: [
        { name: 'Y', expr: 'A & B | C & D | E & F | G & H | I & J | K & L' },
        { name: 'Z', expr: '(A ^ B) & (C ^ D) | (E ^ F) & (G ^ H) | I & !L' },
      ],
    };
    const fit = checkExhaustive(design);
    expect(fit.outputs.find((o) => o.name === 'Y')!.terms).toBeGreaterThanOrEqual(6);
  });

  test('parity of four inputs needs 8 terms and borrows 3 from a neighbour, and the report says so', () => {
    const fit = checkExhaustive(parity4Design());
    const p = fit.outputs[0]!;
    expect(p.terms).toBe(8);
    expect(p.borrowed).toBe(3);
    expect(fit.utilisation.borrowedTerms).toBe(3);
    // A borrowing macrocell sits away from the chain's ends when it can, and its neighbour lent slots.
    const fb = fit.fbs[p.fb]!;
    expect(fb.lent).toBe(3);
    const text = fit.report();
    expect(text).toContain('borrowed');
    expect(text).toContain('(+3 borrowed)');
    // The extra delay of the allocator is in the timing.
    expect(p.timing.tpd).toBe(8.5);
  });

  test('output polarity: the fitter uses the cheaper polarity and the XOR bit restores the function', () => {
    const fit = checkExhaustive({ inputs: ['A', 'B', 'C', 'D'], outputs: [{ name: 'Y', expr: '!(A & B & C & D)' }] });
    const y = fit.outputs[0]!;
    expect(y.polarity).toBe('low');
    expect(y.terms).toBe(1);
  });

  test('a function of a signal in another output: feedback through a combinational macrocell', () => {
    const fit = checkExhaustive(
      { inputs: ['A', 'B', 'C'], outputs: [{ name: 'X', expr: 'A ^ B' }, { name: 'Y', expr: 'X & C' }] },
    );
    const y = fit.outputs.find((o) => o.name === 'Y')!;
    expect(y.timing.combDepth).toBe(1);
    expect(y.timing.tpd).toBe(7.5 + 5.0);
  });

  test('constants and tri-state outputs', () => {
    const design: CpldDesign = {
      inputs: ['A', 'B', 'OE'],
      outputs: [
        { name: 'ONE', expr: '1' },
        { name: 'ZERO', expr: '0' },
        { name: 'T', expr: 'A & B', oe: 'OE' },
        { name: 'G', expr: 'A | B', globalOe: true },
      ],
    };
    const fit = fitCpld(design);
    const dev = fit.device();
    const t = fit.outputs.find((o) => o.name === 'T')!;
    const g = fit.outputs.find((o) => o.name === 'G')!;
    const pins = new Array<number>(32).fill(0);
    pins[fit.pinOf.A!] = 1;
    pins[fit.pinOf.B!] = 1;
    let s = dev.evaluate({ pins });
    expect(s.driven[fit.pinOf.ONE!]).toBe(true);
    expect(s.pins[fit.pinOf.ONE!]).toBe(1);
    expect(s.pins[fit.pinOf.ZERO!]).toBe(0);
    // OE low: T floats (shows the external level), G floats until GOE.
    expect(s.driven[t.pin!]).toBe(false);
    expect(s.driven[g.pin!]).toBe(false);
    s = dev.evaluate({ pins, goe: 1 });
    expect(s.driven[g.pin!]).toBe(true);
    expect(s.pins[g.pin!]).toBe(1);
    pins[fit.pinOf.OE!] = 1;
    s = dev.evaluate({ pins });
    expect(s.driven[t.pin!]).toBe(true);
    expect(s.pins[t.pin!]).toBe(1);
    pins[fit.pinOf.B!] = 0;
    s = dev.evaluate({ pins });
    expect(s.pins[t.pin!]).toBe(0);
    // The enable term is one of the macrocell's slots: its own capacity is one less.
    expect(t.capacity).toBeLessThanOrEqual(14);
  });
});

describe('fitting and evaluating equals the equations: registered', () => {
  test('4-bit counter with enable and clear: random sequences', () => {
    const fit = checkSequence(counter4Design(), 300, 1, { CLR: 0.05, EN: 0.8 });
    // T flip-flops need one product term per bit for a toggle counter; the fitter finds them.
    const q3 = fit.outputs.find((o) => o.name === 'Q3')!;
    expect(q3.ff).toBe('T');
    expect(q3.terms).toBeLessThanOrEqual(2);
    expect(q3.alternatives.some((a) => a.label.startsWith('D flip-flop') && a.terms > q3.terms)).toBe(true);
  });

  test('the counter counts', () => {
    const fit = fitCpld(counter4Design());
    const res = fit.simulate(Array.from({ length: 20 }, () => ({ inputs: { EN: 1, CLR: 0 } })));
    res.forEach((r, k) => {
      const v = r.values.Q0! + 2 * r.values.Q1! + 4 * r.values.Q2! + 8 * r.values.Q3!;
      expect(v).toBe((k + 1) % 16);
    });
  });

  test('forced D flip-flops give the same behaviour with more terms', () => {
    const d = counter4Design();
    for (const o of d.outputs) o.ff = 'D';
    const fit = checkSequence(d, 200, 2, { CLR: 0.05, EN: 0.8 });
    const t = fitCpld(counter4Design());
    const dTerms = fit.outputs.reduce((s, o) => s + o.terms, 0);
    const tTerms = t.outputs.reduce((s, o) => s + o.terms, 0);
    expect(dTerms).toBeGreaterThan(tTerms);
  });

  test('traffic-light FSM: random sequences', () => {
    const fit = checkSequence(trafficDesign(), 400, 3, { RST: 0.03, CAR: 0.5, T: 0.5 });
    expect(fit.outputs.filter((o) => o.registered)).toHaveLength(2);
  });

  test('BCD counter driving a seven-segment display: random sequences, all ten digits shown', () => {
    const design = bcdDisplayDesign();
    const fit = checkSequence(design, 300, 4, { CLR: 0.03, EN: 0.85 });
    // Count through a full cycle and check the segments spell each digit.
    const res = fit.simulate([{ inputs: { CLR: 1, EN: 0 } }, ...Array.from({ length: 12 }, () => ({ inputs: { CLR: 0, EN: 1 } }))]);
    const patterns = [0x7e, 0x30, 0x6d, 0x79, 0x33, 0x5b, 0x5f, 0x70, 0x7f, 0x7b];
    res.slice(1).forEach((r, k) => {
      const digit = (k + 1) % 10;
      let seg = 0;
      'abcdefg'.split('').forEach((s, i) => (seg |= r.values[`S${s}`]! << (6 - i)));
      expect(seg, `digit ${digit}`).toBe(patterns[digit]);
    });
    expect(fit.outputs.filter((o) => o.registered)).toHaveLength(4);
  });

  test('power-up values (init) and GSR', () => {
    const design: CpldDesign = {
      inputs: ['D'],
      outputs: [
        { name: 'A', expr: 'D', registered: true, init: 1 },
        { name: 'B', expr: 'D', registered: true, init: 0 },
      ],
    };
    const fit = fitCpld(design);
    const dev = fit.device();
    const a = fit.outputs[0]!.macrocell;
    const b = fit.outputs[1]!.macrocell;
    let s = dev.evaluate({});
    expect([s.mc[a], s.mc[b]]).toEqual([1, 0]);
    const pins = new Array<number>(32).fill(0);
    pins[fit.pinOf.D!] = 1;
    s = dev.clock({ pins });
    expect([s.mc[a], s.mc[b]]).toEqual([1, 1]);
    pins[fit.pinOf.D!] = 0;
    s = dev.clock({ pins });
    expect([s.mc[a], s.mc[b]]).toEqual([0, 0]);
    // GSR sends every flip-flop to its init value asynchronously and holds it there.
    s = dev.evaluate({ pins, gsr: 1 });
    expect([s.mc[a], s.mc[b]]).toEqual([1, 0]);
    s = dev.clock({ pins, gsr: 1 });
    expect([s.mc[a], s.mc[b]]).toEqual([1, 0]);
    s = dev.clock({ pins });
    expect([s.mc[a], s.mc[b]]).toEqual([0, 0]);
  });
});

describe('the fit result', () => {
  test('bits, names, pins, report and fuse map', () => {
    const fit = fitCpld(counter4Design());
    expect(fit.bits.length).toBe(9024);
    expect(Object.keys(fit.pinOf).sort()).toEqual(['CLR', 'EN', 'Q0', 'Q1', 'Q2', 'Q3']);
    const pins = Object.values(fit.pinOf);
    expect(new Set(pins).size).toBe(pins.length);
    // Inputs sit on pads whose macrocell does not drive a pin.
    for (const i of fit.inputs) expect(fit.outputs.some((o) => o.pin === i.pin)).toBe(false);
    const text = fit.report();
    expect(text).toContain('vCPLD-32');
    expect(text).toContain('Function blocks');
    expect(text).toContain('tPD = 7.5 ns');
    expect(text).toContain('Partitioning');
    expect(fit.timing.worstTsu).toBe(4.5);
    expect(fit.timing.worstTco).toBe(4.5);
    expect(fit.timing.fmaxMHz).toBe(125);
    const map = fit.fuseMap();
    expect(map.device).toBe('vCPLD-32');
    expect(map.fbs).toHaveLength(4);
    const used = map.fbs.flatMap((f) => f.macrocells.filter((m) => m.registered));
    expect(used).toHaveLength(4);
    expect(used.every((m) => m.type === 'T')).toBe(true);
    // The usercode round trips as text.
    expect(fit.usercode).toBe(0x434e5434);
  });

  test('text front end: .R and .E, and pin constraints', () => {
    const fit = fitCpldEquations(
      `Q.R = !Q ^ EN
Y = Q & A
Y.E = EN`,
      { pins: { A: 5, Y: 20 } },
    );
    expect(fit.pinOf.A).toBe(5);
    expect(fit.pinOf.Y).toBe(20);
    expect(fit.mcOf.Y).toEqual({ fb: 2, mc: 4, macrocell: 20 });
    const y = fit.outputs.find((o) => o.name === 'Y')!;
    expect(y.oeMode).toBe('term');
    expect(fit.outputs.find((o) => o.name === 'Q')!.registered).toBe(true);
  });

  test('deterministic', () => {
    const a = fitCpld(bcdDisplayDesign());
    const b = fitCpld(bcdDisplayDesign());
    expect(Array.from(a.bits)).toEqual(Array.from(b.bits));
  });
});

describe('partitioning', () => {
  /** Two groups of outputs, each group reading its own 13 inputs: mixing them needs 26 > 24 inputs. */
  function groups(order: string[]): CpldDesign {
    const a = Array.from({ length: 13 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 13 }, (_, i) => `b${i}`);
    const all = (v: string[]) => v.join(' & ');
    const none = (v: string[]) => v.map((x) => `!${x}`).join(' & ');
    const defs: Record<string, string> = { Y1: all(a), Y2: none(a), Z1: all(b), Z2: none(b) };
    return { inputs: [...a, ...b], outputs: order.map((name) => ({ name, expr: defs[name]! })) };
  }

  test('no block reads more than 24 signals; outputs that share inputs are kept together', () => {
    for (const order of [['Y1', 'Z1', 'Y2', 'Z2'], ['Z1', 'Y1', 'Z2', 'Y2'], ['Y1', 'Y2', 'Z1', 'Z2']]) {
      const fit = fitCpld(groups(order));
      for (const f of fit.fbs) expect(f.inputsUsed).toBeLessThanOrEqual(24);
      const fb = (n: string) => fit.mcOf[n]!.fb;
      expect(fb('Y1')).toBe(fb('Y2'));
      expect(fb('Z1')).toBe(fb('Z2'));
      expect(fb('Y1')).not.toBe(fb('Z1'));
      expect(fit.utilisation.blockInputs).toBe(26);
    }
  });

  test('bits agree: each block\'s multiplexers select only the signals its terms read', () => {
    const fit = fitCpld(groups(['Y1', 'Z1', 'Y2', 'Z2']));
    const used = fit.fuseMap().fbs.filter((f) => f.distinctSources > 0);
    expect(used).toHaveLength(2);
    for (const f of used) expect(f.distinctSources).toBe(13);
  });

  test('a design with more signals than one block can read spreads over several', () => {
    // Eight outputs, each an AND of a different 5 of 30 inputs: no block can hold them all comfortably.
    const rng = mulberry32(11);
    const inputs = Array.from({ length: 22 }, (_, i) => `i${i}`);
    const outputs = Array.from({ length: 8 }, (_, k) => {
      const pick = new Set<number>();
      while (pick.size < 5) pick.add(rng.int(22));
      return { name: `o${k}`, expr: [...pick].map((p) => `i${p}`).join(' & ') };
    });
    const fit = fitCpld({ inputs, outputs });
    for (const f of fit.fbs) expect(f.inputsUsed).toBeLessThanOrEqual(24);
    const check = fit.device();
    const r = mulberry32(5);
    for (let t = 0; t < 200; t++) {
      const pins = new Array<number>(32).fill(0);
      const env: Record<string, number> = {};
      for (const i of fit.inputs) {
        env[i.name] = r.chance(0.8) ? 1 : 0;
        pins[i.pin] = env[i.name]!;
      }
      const s = check.evaluate({ pins });
      for (const o of outputs) {
        const want = o.expr.split(' & ').every((v) => env[v]) ? 1 : 0;
        expect(s.mc[fit.mcOf[o.name]!.macrocell]).toBe(want);
      }
    }
  });

  test('pin constraints are honoured', () => {
    const fit = fitCpld({
      inputs: [{ name: 'A', pin: 31 }, 'B'],
      outputs: [{ name: 'Y', expr: 'A & B', pin: 0 }, { name: 'Z', expr: 'A | B', pin: 9 }],
    });
    expect(fit.pinOf).toMatchObject({ A: 31, Y: 0, Z: 9 });
    expect(fit.mcOf.Z!.fb).toBe(1);
  });
});

describe('errors say why', () => {
  const fails = (fn: () => unknown): CpldFitError => {
    try {
      fn();
    } catch (e) {
      expect(e).toBeInstanceOf(CpldFitError);
      return e as CpldFitError;
    }
    throw new Error('expected the fit to fail');
  };

  test('too many outputs', () => {
    const outputs = Array.from({ length: 33 }, (_, i) => ({ name: `Y${i}`, expr: 'A' }));
    const e = fails(() => fitCpld({ inputs: ['A'], outputs }));
    expect(e.code).toBe('too-many-outputs');
    expect(e.message).toContain('32 macrocells');
  });

  test('too many pins', () => {
    const outputs = Array.from({ length: 16 }, (_, i) => ({ name: `Y${i}`, expr: 'I0' }));
    const inputs = Array.from({ length: 20 }, (_, i) => `I${i}`);
    const e = fails(() => fitCpld({ inputs, outputs }));
    expect(e.code).toBe('too-many-signals');
    expect(e.message).toContain('36 I/O pins');
  });

  test('an output that needs more than 15 product terms even with borrowing', () => {
    const e = fails(() => fitCpldEquations('P = A ^ B ^ C ^ D ^ E'));
    expect(e.code).toBe('too-many-terms');
    expect(e.info?.needed).toBe(16);
    expect(e.message).toContain('at most 15');
    expect(e.message).toContain('Split the function');
  });

  test('a function of more than 24 signals', () => {
    const inputs = Array.from({ length: 25 }, (_, i) => `I${i}`);
    const e = fails(() => fitCpld({ inputs, outputs: [{ name: 'Y', expr: inputs.join(' & ') }] }));
    expect(e.code).toBe('fb-inputs');
    expect(e.message).toContain('25 different signals');
    expect(e.message).toContain('24 inputs');
  });

  test('outputs that cannot be separated because pins keep them in one block', () => {
    const a = Array.from({ length: 13 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 13 }, (_, i) => `b${i}`);
    const e = fails(() =>
      fitCpld({
        inputs: [...a, ...b],
        outputs: [
          { name: 'Y', expr: a.join(' & '), pin: 0 },
          { name: 'Z', expr: b.join(' & '), pin: 1 },
        ],
      }),
    );
    expect(e.code).toBe('fb-inputs');
    expect(e.message).toContain('function block 0');
    expect(e.message).toContain('26 distinct inputs');
  });

  test('an output enable of more than one term', () => {
    const e = fails(() => fitCpld({ inputs: ['A', 'B', 'C'], outputs: [{ name: 'Y', expr: 'A', oe: 'B | C' }] }));
    expect(e.code).toBe('oe-terms');
    expect(e.info?.needed).toBe(2);
  });

  test('the total number of product terms', () => {
    // Twenty-one copies of a 4-input parity need 8 terms each: 168 > 160.
    const outputs = Array.from({ length: 21 }, (_, k) => ({ name: `P${k}`, expr: 'A ^ B ^ C ^ D' }));
    const e = fails(() => fitCpld({ inputs: ['A', 'B', 'C', 'D'], outputs }));
    expect(e.code).toBe('too-many-terms');
    expect(e.message).toContain('168 product terms in all');
  });

  test('names, signals and pins', () => {
    expect(fails(() => fitCpld({ inputs: ['A'], outputs: [{ name: 'Y', expr: 'A & Q' }] })).code).toBe('unknown-signal');
    expect(fails(() => fitCpld({ inputs: ['A', 'A'], outputs: [] })).code).toBe('duplicate');
    expect(fails(() => fitCpld({ inputs: ['1A'], outputs: [] })).code).toBe('bad-name');
    expect(fails(() => fitCpld({ inputs: ['A'], outputs: [{ name: 'Y', expr: 'A &' }] })).code).toBe('syntax');
    expect(fails(() => fitCpld({ inputs: [{ name: 'A', pin: 40 }], outputs: [] })).code).toBe('pin');
    expect(fails(() => fitCpld({ inputs: [{ name: 'A', pin: 3 }], outputs: [{ name: 'Y', expr: 'A', pin: 3 }] })).code).toBe('pin');
    expect(fails(() => fitCpld({ inputs: ['A'], outputs: [{ name: 'Y', expr: 'A', pin: 3 }, { name: 'Z', expr: 'A', pin: 3 }] })).code).toBe('pin');
    const clk = fails(() => fitCpld({ inputs: ['A'], clock: 'CLK', outputs: [{ name: 'Y', expr: 'A & CLK', registered: true }] }));
    expect(clk.message).toContain('global pin');
  });
});

describe('random designs', () => {
  /** A random expression over the given names. */
  function expr(rng: ReturnType<typeof mulberry32>, vars: string[], depth: number): string {
    if (depth === 0 || rng.chance(0.2)) {
      const v = vars[rng.int(vars.length)]!;
      return rng.chance(0.4) ? `!${v}` : v;
    }
    const op = ['&', '|', '^'][rng.int(3)]!;
    return `(${expr(rng, vars, depth - 1)} ${op} ${expr(rng, vars, depth - 1)})`;
  }

  test('combinational designs with feedback between outputs, exhaustively', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = mulberry32(100 + seed);
      const inputs = Array.from({ length: 6 }, (_, i) => `i${i}`);
      const outputs: CpldDesign['outputs'] = [];
      for (let k = 0; k < 6; k++) {
        // An output may read the outputs defined before it (no loops).
        const vars = [...inputs, ...outputs.map((o) => o.name)];
        const buried = rng.chance(0.3);
        outputs.push({ name: `o${k}`, expr: expr(rng, vars, 3), buried });
      }
      let fit: CpldFit;
      try {
        fit = checkExhaustive({ inputs, outputs });
      } catch (e) {
        // Some random functions are too big for a macrocell: that must be reported as such, never as a crash.
        expect(e).toBeInstanceOf(CpldFitError);
        expect(['too-many-terms', 'fb-inputs']).toContain((e as CpldFitError).code);
        continue;
      }
      for (const f of fit.fbs) expect(f.inputsUsed).toBeLessThanOrEqual(24);
    }
  });

  test('registered designs (state machines with random next-state logic), random clocked sequences', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = mulberry32(200 + seed);
      const inputs = ['a', 'b', 'c'];
      const states = ['s0', 's1', 's2', 's3'];
      const outputs: CpldDesign['outputs'] = states.map((name) => ({
        name,
        expr: expr(rng, [...inputs, ...states], 3),
        registered: true,
        init: rng.chance(0.5) ? 1 : 0,
        ff: (['auto', 'D', 'T'] as const)[rng.int(3)],
      }));
      outputs.push({ name: 'z', expr: expr(rng, [...inputs, ...states], 2) });
      try {
        checkSequence({ inputs, outputs }, 120, seed);
      } catch (e) {
        if (e instanceof CpldFitError) continue;
        throw e;
      }
    }
  });
});
