import { describe, expect, test } from 'vitest';
import { mulberry32, type Rng } from '../twolevel/random';
import { Gal22v10, PRODUCT_TERMS, s0Fuse, s1Fuse } from './gal22v10';
import {
  GalFitError,
  designFromEquations,
  fitGal22v10,
  fitGal22v10Equations,
  pinLevelsFor,
  type GalDesign,
  type GalFit,
} from './gal22v10-fit';
import { decoderDesign, sevenSegmentDesign, trafficDesign, SEVEN_SEGMENT_PATTERNS } from './gal22v10-designs';
import { GAL_FIXTURES } from './gal22v10-fixtures';
import { readGal22v10Jedec } from './gal22v10-jedec';
import { assemblePld } from './gal22v10-pld';
import { GalSpecModel } from './gal22v10-spec';
import { evalExpr, parseExpr } from '../twolevel/expr';

function expectError(fn: () => unknown): GalFitError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GalFitError);
    return e as GalFitError;
  }
  throw new Error('expected a GalFitError');
}

/** Every input combination: the device from the fuses agrees with the equations. */
function checkCombinational(fit: GalFit, design: GalDesign, dcFree = true) {
  const names = design.inputs.map((i) => (typeof i === 'string' ? i : i.name)).filter((n) => n !== design.clock);
  const g = new Gal22v10(fit.fuses);
  const model = new GalSpecModel(design, fit);
  for (let x = 0; x < 2 ** names.length; x++) {
    const inputs: Record<string, number> = {};
    names.forEach((n, i) => (inputs[n] = (x >> i) & 1));
    const s = g.evaluate(pinLevelsFor(fit, inputs));
    const want = model.evaluate(inputs);
    for (const o of design.outputs) {
      if (o.registered) continue;
      if (o.dc !== undefined && dcFree && evalExpr(parseExpr(o.dc as string), (n) => want[n] ?? inputs[n] ?? 0)) continue;
      expect(s.pins[fit.pinOf[o.name]!], `${o.name} at ${JSON.stringify(inputs)}`).toBe(want[o.name]);
    }
  }
}

/** Random clocked sequences: the device and the specification stay in step. */
function checkSequential(fit: GalFit, design: GalDesign, rng: Rng, cycles = 200) {
  const names = design.inputs.map((i) => (typeof i === 'string' ? i : i.name)).filter((n) => n !== design.clock && !design.outputs.some((o) => o.name === n));
  const g = new Gal22v10(fit.fuses);
  const model = new GalSpecModel(design, fit);
  const compare = (inputs: Record<string, number>, when: string) => {
    const s = g.evaluate(pinLevelsFor(fit, inputs));
    const want = model.evaluate(inputs);
    for (const o of design.outputs) expect(s.pins[fit.pinOf[o.name]!], `${o.name} ${when} inputs ${JSON.stringify(inputs)}`).toBe(want[o.name]);
  };
  for (let t = 0; t < cycles; t++) {
    const inputs: Record<string, number> = {};
    for (const n of names) inputs[n] = rng.chance(0.5) ? 1 : 0;
    compare(inputs, `before clock ${t}`);
    g.clock(pinLevelsFor(fit, inputs));
    model.clock(inputs);
    compare(inputs, `after clock ${t}`);
  }
}

describe('fitting the course designs', () => {
  test('3-to-8 decoder: eight one-term active-low outputs', () => {
    const d = decoderDesign();
    const fit = fitGal22v10(d);
    expect(fit.outputs.length).toBe(8);
    for (const o of fit.outputs) {
      expect(o.terms).toBe(1);
      expect(o.polarity).toBe('low');
      expect(o.highTerms).toBe(5);
    }
    checkCombinational(fit, d);
    // Exactly one output low when enabled.
    const g = new Gal22v10(fit.fuses);
    for (let k = 0; k < 8; k++) {
      const s = g.evaluate(pinLevelsFor(fit, { A: k & 1, B: (k >> 1) & 1, C: (k >> 2) & 1, G1: 1, G2N: 0 }));
      const lows = fit.outputs.filter((o) => s.pins[o.pin] === 0).map((o) => o.name);
      expect(lows).toEqual([`Y${k}`]);
    }
  });

  test('traffic-light controller: registered state machine with feedback, random clocked sequences', () => {
    const d = trafficDesign();
    const fit = fitGal22v10(d);
    expect(fit.pinOf.CLK).toBe(1);
    expect(fit.outputs.find((o) => o.name === 'Q1')!.registered).toBe(true);
    // The state machine walks 00 → 01 → 10 → 11 → 00 when CAR and T are held.
    const g = new Gal22v10(fit.fuses);
    const io = { CAR: 1, T: 1, RST: 0 };
    const states: string[] = [];
    for (let i = 0; i < 6; i++) {
      const s = g.clock(pinLevelsFor(fit, io));
      states.push(`${s.pins[fit.pinOf.Q1!]}${s.pins[fit.pinOf.Q0!]}`);
    }
    expect(states).toEqual(['01', '10', '11', '00', '01', '10']);
    // Lamps: after the first clock (01) main amber and side red.
    const lamps = (n: string) => new Gal22v10(fit.fuses).clock(pinLevelsFor(fit, io)).pins[fit.pinOf[n]!];
    expect([lamps('MA'), lamps('SR'), lamps('MG'), lamps('MR')]).toEqual([1, 1, 0, 0]);
    checkSequential(fit, d, mulberry32(1));
    checkCombinational(fit, d, false);
  });

  test('traffic-light controller: reset', () => {
    const fit = fitGal22v10(trafficDesign());
    const g = new Gal22v10(fit.fuses);
    g.clock(pinLevelsFor(fit, { CAR: 1, T: 1 }));
    g.clock(pinLevelsFor(fit, { CAR: 1, T: 1 }));
    expect(g.evaluate(pinLevelsFor(fit, {})).pins[fit.pinOf.Q1!]).toBe(1);
    const s = g.evaluate(pinLevelsFor(fit, { RST: 1 }));
    expect([s.pins[fit.pinOf.Q1!], s.pins[fit.pinOf.Q0!], s.pins[fit.pinOf.MG!]]).toEqual([0, 0, 1]);
  });

  test('seven-segment decoder with don’t cares', () => {
    const d = sevenSegmentDesign();
    const fit = fitGal22v10(d);
    const g = new Gal22v10(fit.fuses);
    for (let digit = 0; digit < 10; digit++) {
      const s = g.evaluate(pinLevelsFor(fit, { A: digit & 1, B: (digit >> 1) & 1, C: (digit >> 2) & 1, D: (digit >> 3) & 1 }));
      let pattern = 0;
      'abcdefg'.split('').forEach((seg, i) => (pattern |= s.pins[fit.pinOf['S' + seg]!]! << (6 - i)));
      expect(pattern, `digit ${digit}`).toBe(SEVEN_SEGMENT_PATTERNS[digit]);
    }
    // The don't-care codes gave smaller covers than the fully specified functions would.
    const strict = fitGal22v10({ ...d, outputs: d.outputs.map((o) => ({ ...o, dc: undefined })) });
    expect(fit.termsUsed).toBeLessThan(strict.termsUsed);
    checkCombinational(fit, d);
  });

  test('the frozen fixtures and fresh fits agree, and pld() assembles to the fitted fuses', () => {
    for (const f of GAL_FIXTURES) {
      const d = f.design();
      const fit = fitGal22v10(d);
      const a = assemblePld(fit.pld());
      expect([...a.fuses], f.id).toEqual([...fit.fuses]);
      // The frozen source runs like the design.
      const frozen = assemblePld(f.pld);
      const pinOf = Object.fromEntries(frozen.source.pins.map((n, i) => [n.replace(/^\//, ''), i + 1]));
      const g = new Gal22v10(frozen.fuses);
      const fresh = new Gal22v10(fit.fuses);
      const names = d.inputs.map((i) => (typeof i === 'string' ? i : i.name));
      const rng = mulberry32(9);
      for (let t = 0; t < 40; t++) {
        const inputsA: Record<number, 0 | 1> = {};
        const inputsB: Record<number, 0 | 1> = {};
        for (const n of names) {
          if (n === d.clock) continue;
          const v = rng.chance(0.5) ? 1 : 0;
          inputsA[pinOf[n]!] = v;
          inputsB[fit.pinOf[n]!] = v;
        }
        const a1 = t % 2 ? g.clock(inputsA) : g.evaluate(inputsA);
        const b1 = t % 2 ? fresh.clock(inputsB) : fresh.evaluate(inputsB);
        for (const o of d.outputs) expect(a1.pins[pinOf[o.name]!], `${f.id} ${o.name}`).toBe(b1.pins[fit.pinOf[o.name]!]);
      }
    }
  });

  test('JEDEC written by the fitter reads back to the same fuses and behaviour', () => {
    const fit = fitGal22v10(trafficDesign());
    const text = fit.jedec();
    const f = readGal22v10Jedec(text);
    expect([...f.fuses]).toEqual([...fit.fuses]);
    expect(text).toContain('*QF5892');
    expect(text).toContain('Traffic-light');
    // Non-ASCII in a title is replaced, not written.
    const t = fitGal22v10({ ...sevenSegmentDesign(), title: '10–15 unused' }).jedec();
    expect(t).toContain('10?15 unused');
  });
});

describe('random designs', () => {
  function randomExpr(rng: Rng, vars: string[], maxProducts = 3, maxLits = 3): string {
    const products: string[] = [];
    const count = 1 + rng.int(maxProducts);
    for (let p = 0; p < count; p++) {
      const lits: string[] = [];
      const used = new Set<string>();
      const k = 1 + rng.int(maxLits);
      while (lits.length < k) {
        const v = vars[rng.int(vars.length)]!;
        if (used.has(v)) continue;
        used.add(v);
        lits.push(rng.chance(0.5) ? v : `!${v}`);
      }
      products.push(lits.join(' & '));
    }
    return products.join(' | ');
  }

  test('combinational designs with feedback between outputs: exhaustive comparison', () => {
    const rng = mulberry32(31);
    for (let trial = 0; trial < 25; trial++) {
      const inputs = ['A', 'B', 'C', 'D', 'E'].slice(0, 3 + rng.int(3));
      const outputs: GalDesign['outputs'] = [];
      const count = 2 + rng.int(4);
      for (let k = 0; k < count; k++) {
        // Later outputs may use earlier outputs (no combinational loops).
        const vars = [...inputs, ...outputs.map((o) => o.name)];
        outputs.push({ name: `Y${k}`, expr: randomExpr(rng, vars, 4, 3) });
      }
      const design: GalDesign = { inputs, outputs };
      const fit = fitGal22v10(design);
      checkCombinational(fit, design);
      // Every fitted output respects its macrocell's limit.
      for (const o of fit.outputs) expect(o.terms).toBeLessThanOrEqual(PRODUCT_TERMS[o.pin]!);
    }
  });

  test('a full chip: 12 inputs and 10 outputs (22 signals), exhaustive over all 4096 input combinations', () => {
    const rng = mulberry32(4242);
    const inputs = Array.from({ length: 12 }, (_, i) => `I${i}`);
    const outputs: GalDesign['outputs'] = [];
    for (let k = 0; k < 10; k++) {
      // Each output uses inputs and the earlier outputs (feedback through the array).
      const vars = [...inputs, ...outputs.map((o) => o.name)];
      outputs.push({ name: `O${k}`, expr: randomExpr(rng, vars, 4, 5) });
    }
    const design: GalDesign = { inputs, outputs };
    const t0 = performance.now();
    const fit = fitGal22v10(design);
    const fitMs = performance.now() - t0;
    expect(fit.variables.length).toBe(22);
    const g = new Gal22v10(fit.fuses);
    const model = new GalSpecModel(design, fit);
    for (let x = 0; x < 4096; x++) {
      const inp: Record<string, number> = {};
      inputs.forEach((n, i) => (inp[n] = (x >> i) & 1));
      const s = g.evaluate(pinLevelsFor(fit, inp));
      const want = model.evaluate(inp);
      for (const o of outputs) expect(s.pins[fit.pinOf[o.name]!]).toBe(want[o.name]);
    }
    console.log(`GAL22V10 full-chip fit (22 signals, ${fit.termsUsed} product terms): ${fitMs.toFixed(0)} ms`);
  });

  test('registered designs: the fuse-level device tracks the equations over random clocked sequences', () => {
    const rng = mulberry32(77);
    for (let trial = 0; trial < 25; trial++) {
      const inputs = ['A', 'B', 'C', 'R', 'S'];
      const state = ['Q0', 'Q1', 'Q2'].slice(0, 1 + rng.int(3));
      const outputs: GalDesign['outputs'] = state.map((name) => ({ name, expr: randomExpr(rng, [...inputs.slice(0, 3), ...state], 3, 3), registered: true }));
      // A combinational output decoded from the state.
      outputs.push({ name: 'Z', expr: randomExpr(rng, [...inputs.slice(0, 3), ...state], 2, 3) });
      const design: GalDesign = {
        inputs,
        outputs,
        clock: 'CLK',
        ar: rng.chance(0.5) ? 'R & !S' : undefined,
        sp: rng.chance(0.5) ? 'S & !R' : undefined,
      };
      const fit = fitGal22v10(design);
      checkSequential(fit, design, rng, 120);
    }
  });

  test('registered outputs in either polarity behave the same at the pin (polarity only changes the fuses)', () => {
    const rng = mulberry32(5);
    const base = { inputs: ['A', 'B'], clock: 'CLK', ar: undefined as string | undefined };
    for (const polarity of ['high', 'low'] as const) {
      const design: GalDesign = { ...base, outputs: [{ name: 'Q', expr: '!Q & A | Q & !B', registered: true, polarity }] };
      const fit = fitGal22v10(design);
      expect(fit.fuses[s0Fuse(fit.pinOf.Q!)]).toBe(polarity === 'high' ? 1 : 0);
      expect(fit.fuses[s1Fuse(fit.pinOf.Q!)]).toBe(0);
      // Compare the pin with a software model started from the power-up level.
      const g = new Gal22v10(fit.fuses);
      let q = polarity === 'high' ? 0 : 1;
      expect(g.evaluate({}).pins[fit.pinOf.Q!]).toBe(q);
      for (let t = 0; t < 40; t++) {
        const a = rng.chance(0.5) ? 1 : 0;
        const b = rng.chance(0.5) ? 1 : 0;
        q = ((q ? 0 : 1) & a) | (q & (b ? 0 : 1));
        expect(g.clock(pinLevelsFor(fit, { A: a, B: b })).pins[fit.pinOf.Q!]).toBe(q);
      }
    }
  });

  test('an expression is minimised before it is fitted', () => {
    const fit = fitGal22v10Equations('Y = A & B | A & !B | !A & B & C | !A & B & !C', { polarity: { Y: 'high' } });
    // = A + B
    expect(fit.outputs[0]!.terms).toBe(2);
    expect(fit.outputs[0]!.sum).toBe('A + B');
    // Left to choose, the fitter stores the complement: /Y = /A * /B, one term.
    const auto = fitGal22v10Equations('Y = A & B | A & !B | !A & B & C | !A & B & !C');
    expect(auto.outputs[0]).toMatchObject({ terms: 1, polarity: 'low', sum: '/A * /B' });
  });
});

describe('product-term limits and polarity', () => {
  const vars9 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

  test('overflow on a fixed pin: an error that suggests pins with more terms', () => {
    // Nine terms active high and active low (a 4-input parity has 8 + 8; use a 9-term function of 4 inputs).
    const nine = vars9.map((v) => `${v}`).join(' | '); // OR of 9 inputs: 9 terms high, 1 term low
    const design: GalDesign = { inputs: vars9, outputs: [{ name: 'Y', expr: nine, pin: 23, polarity: 'high' }] };
    const e = expectError(() => fitGal22v10(design));
    expect(e.code).toBe('too-many-terms');
    expect(e.info).toMatchObject({ output: 'Y', needed: 9, pin: 23 });
    expect(e.message).toContain('needs 9 product terms');
    expect(e.message).toContain('pin 23 has only 8');
    expect(e.message).toMatch(/15 \(10 terms\)/); // the nearest free pin with more terms
    expect(e.info!.suggestions!.every((p) => PRODUCT_TERMS[p]! >= 9)).toBe(true);
    // Any pin that is listed really would do.
    const fit = fitGal22v10({ ...design, outputs: [{ ...design.outputs[0]!, pin: e.info!.suggestions![0]! }] });
    expect(fit.outputs[0]!.terms).toBe(9);
  });

  test('the fitter alone puts a big output on a big macrocell', () => {
    // Twelve terms needed: only pins with at least 12 terms qualify (16–21 and 18–19… 16,17,18,19,20,21).
    const rng = mulberry32(3);
    const inputs = ['A', 'B', 'C', 'D', 'E', 'F'];
    const seen = new Set<string>();
    const products: string[] = [];
    while (products.length < 12) {
      const lits = inputs.map((v) => (rng.chance(0.5) ? v : `!${v}`));
      const key = lits.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(lits.join(' & '));
    }
    // 12 random minterms of 6 variables rarely merge; force a large cover by making the function its own parity-like mess.
    const design: GalDesign = {
      inputs,
      outputs: [
        { name: 'Big', expr: 'A ^ B ^ C ^ D ^ E', polarity: 'high' }, // 16 terms
        { name: 'Small', expr: 'A & B' },
      ],
    };
    const fit = fitGal22v10(design);
    expect(fit.outputs.find((o) => o.name === 'Big')!.terms).toBe(16);
    expect([18, 19]).toContain(fit.outputs.find((o) => o.name === 'Big')!.pin);
    expect(fit.outputs.find((o) => o.name === 'Small')!.pin).toBeLessThan(18);
    checkCombinational(fit, design);
    void products;
  });

  test('more than 16 terms: even the biggest macrocell is too small', () => {
    const design: GalDesign = { inputs: ['A', 'B', 'C', 'D', 'E', 'F'], outputs: [{ name: 'P', expr: 'A ^ B ^ C ^ D ^ E ^ F' }] };
    const e = expectError(() => fitGal22v10(design));
    expect(e.code).toBe('too-many-terms');
    expect(e.message).toMatch(/32 product terms/);
    expect(e.message).toMatch(/more than any macrocell has/);
    expect(e.message).toMatch(/Split the function/);
  });

  test('all macrocells that are large enough are taken: the error names them', () => {
    // Three outputs of 16 terms: only two macrocells (18, 19) have 16.
    const p = 'A ^ B ^ C ^ D ^ E';
    const design: GalDesign = { inputs: ['A', 'B', 'C', 'D', 'E'], outputs: [0, 1, 2].map((k) => ({ name: `P${k}`, expr: p, polarity: 'high' as const })) };
    const e = expectError(() => fitGal22v10(design));
    expect(e.message).toMatch(/all taken by other outputs/);
  });

  test('output polarity: the fitter uses the inverted form when it needs fewer terms', () => {
    // A 9-input NAND needs 9 terms active high and 1 term active low. Pin 23 has only 8: auto polarity fits it.
    const nand = `!(${vars9.join(' & ')})`;
    const design: GalDesign = { inputs: vars9, outputs: [{ name: 'Y', expr: nand, pin: 23 }] };
    const fit = fitGal22v10(design);
    expect(fit.outputs[0]!.polarity).toBe('low');
    expect(fit.outputs[0]!.terms).toBe(1);
    expect(fit.outputs[0]!.highTerms).toBe(9);
    expect(fit.fuses[s0Fuse(23)]).toBe(0);
    // The pin still carries the NAND: spot check.
    const g = new Gal22v10(fit.fuses);
    const all1 = Object.fromEntries(vars9.map((v) => [v, 1]));
    expect(g.evaluate(pinLevelsFor(fit, all1)).pins[23]).toBe(0);
    expect(g.evaluate(pinLevelsFor(fit, { ...all1, E: 0 })).pins[23]).toBe(1);
    // Forcing active high overflows.
    const e = expectError(() => fitGal22v10({ ...design, outputs: [{ ...design.outputs[0]!, polarity: 'high' }] }));
    expect(e.message).toContain('polarity was fixed');
    // Forcing active low on a function that is cheaper active high still works, just wastefully.
    const forced = fitGal22v10({ inputs: ['A', 'B'], outputs: [{ name: 'Y', expr: 'A & B', polarity: 'low' }] });
    expect(forced.outputs[0]!.polarity).toBe('low');
    expect(forced.outputs[0]!.terms).toBe(2);
  });

  test('registered outputs default to active high so that the power-up state is the all-zero state', () => {
    const fit = fitGal22v10({ inputs: ['A'], clock: 'CLK', outputs: [{ name: 'Q', expr: '!(A & !Q)', registered: true }] });
    expect(fit.outputs[0]!.polarity).toBe('high');
    const auto = fitGal22v10({ inputs: ['A'], clock: 'CLK', outputs: [{ name: 'Q', expr: '!(A & !Q)', registered: true, polarity: 'auto' }] });
    expect(auto.outputs[0]!.polarity).toBe('low');
  });
});

describe('pins and other resources', () => {
  test('given pins are kept; the clock is pin 1; others are assigned', () => {
    const fit = fitGal22v10({
      inputs: [{ name: 'A', pin: 7 }, 'B'],
      clock: 'CK',
      outputs: [
        { name: 'Q', expr: 'A & B', registered: true, pin: 21 },
        { name: 'Y', expr: 'A | Q' },
      ],
    });
    expect(fit.pinOf.CK).toBe(1);
    expect(fit.pinOf.A).toBe(7);
    expect(fit.pinOf.Q).toBe(21);
    expect(fit.pinOf.B).toBe(2);
    expect(fit.pins[0]).toMatchObject({ pin: 1, role: 'clock', name: 'CK' });
    expect(fit.pins[11]).toMatchObject({ role: 'gnd' });
    expect(fit.pins[23]).toMatchObject({ role: 'vcc' });
    expect(fit.report()).toContain('registered');
  });

  test('pin errors', () => {
    const base: GalDesign = { inputs: [{ name: 'A', pin: 12 }], outputs: [] };
    expect(expectError(() => fitGal22v10(base)).message).toContain('GND');
    expect(expectError(() => fitGal22v10({ inputs: ['A'], outputs: [{ name: 'Y', expr: 'A', pin: 5 }] })).message).toContain('outputs go on pins 14');
    expect(expectError(() => fitGal22v10({ inputs: [{ name: 'A', pin: 3 }, { name: 'B', pin: 3 }], outputs: [] })).message).toContain('both on pin 3');
    expect(expectError(() => fitGal22v10({ inputs: ['A'], outputs: [{ name: 'A', expr: '1' }] })).message).toContain('used twice');
    expect(expectError(() => fitGal22v10({ inputs: ['A'], outputs: [{ name: 'Y', expr: 'A & Z' }] })).message).toMatch(/unknown signal "Z"/);
    expect(expectError(() => fitGal22v10({ inputs: ['A'], outputs: [{ name: 'Y', expr: 'A &' }] })).code).toBe('syntax');
  });

  test('a 13th input uses a macrocell as an input; 12 inputs and 10 outputs fill the chip', () => {
    const inputs = Array.from({ length: 13 }, (_, i) => `I${i}`);
    const design: GalDesign = { inputs, outputs: [{ name: 'Y', expr: inputs.join(' & ') }] };
    const fit = fitGal22v10(design);
    const inputOlmc = fit.pins.filter((p) => p.role === 'input-olmc');
    expect(inputOlmc.length).toBe(1);
    // It is programmed as an input: S1 = 1 and never driven.
    expect(fit.fuses[s1Fuse(inputOlmc[0]!.pin)]).toBe(1);
    checkCombinational(fit, { ...design, outputs: [{ name: 'Y', expr: inputs.join(' & ') }] }, true);
    // Too many signals overall.
    const many: GalDesign = { inputs: Array.from({ length: 13 }, (_, i) => `I${i}`), outputs: Array.from({ length: 10 }, (_, i) => ({ name: `Y${i}`, expr: `I${i}` })) };
    expect(expectError(() => fitGal22v10(many)).code).toBe('too-many-signals');
  });

  test('output enable: tri-state output', () => {
    const design: GalDesign = { inputs: ['A', 'B', 'OE'], outputs: [{ name: 'Y', expr: 'A ^ B', oe: 'OE' }] };
    const fit = fitGal22v10(design);
    const g = new Gal22v10(fit.fuses);
    expect(g.evaluate(pinLevelsFor(fit, { A: 1, B: 0, OE: 1 })).driven[fit.pinOf.Y!]).toBe(true);
    expect(g.evaluate(pinLevelsFor(fit, { A: 1, B: 0, OE: 0 })).driven[fit.pinOf.Y!]).toBe(false);
    expect(fit.outputs[0]!.oe).toBe('OE');
    expect(fit.pld()).toContain('Y.T =');
    expect(fit.pld()).toContain('Y.E = OE');
    const a = assemblePld(fit.pld());
    expect([...a.fuses]).toEqual([...fit.fuses]);
    // An enable that needs two terms cannot be fitted.
    const e = expectError(() => fitGal22v10({ ...design, outputs: [{ name: 'Y', expr: 'A', oe: 'A ^ B' }] }));
    expect(e.code).toBe('oe-terms');
    expect(e.message).toContain('single enable term');
  });

  test('equations text front end', () => {
    const fit = fitGal22v10Equations(
      `; a counter bit and a lamp
       Q.R = !Q & EN | Q & !EN
       LAMP = Q & !RESET // comment
       AR = RESET`,
      { clock: 'CLK', signature: 'CNT' },
    );
    expect(fit.pinOf.CLK).toBe(1);
    expect(Object.keys(fit.pinOf).sort()).toEqual(['CLK', 'EN', 'LAMP', 'Q', 'RESET']);
    expect(fit.ar).toBe('RESET');
    const d = designFromEquations('Y.T = A\nY.E = B', {});
    expect(d.outputs[0]).toMatchObject({ name: 'Y', oe: 'B', registered: false });
    expect(() => designFromEquations('Y.X = A')).toThrow(/unknown suffix/);
    expect(() => designFromEquations('Y = A\nY = B')).toThrow(/defined twice/);
    expect(() => designFromEquations('nonsense')).toThrow(/expected/);
  });

  test('the report lists pins and per-output terms', () => {
    const r = fitGal22v10(decoderDesign()).report();
    expect(r).toContain('GAL22V10');
    expect(r).toContain('Y7');
    expect(r).toMatch(/1\/\d+/);
  });
});
