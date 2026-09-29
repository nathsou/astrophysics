import { describe, expect, test } from 'vitest';
import { NetlistBuilder, createDigitalEngine } from './index';
import { LX, LZ } from '../netlist/types';

const NS = 1e-9;
const V = [0, 1, LX, LZ];
const name = (v: number) => '01XZ'[v];

/** All combinations of four-valued inputs. */
function* combos(n: number): Generator<number[]> {
  for (let i = 0; i < 4 ** n; i++) yield Array.from({ length: n }, (_, j) => V[Math.floor(i / 4 ** j) % 4]!);
}

/** Exact X semantics: every way of reading X/Z inputs as 0/1 must agree, else X. */
function reference(fn: (bits: number[]) => number, values: number[]): number {
  let out = -1;
  const unknown = values.map((v, i) => (v > 1 ? i : -1)).filter((i) => i >= 0);
  for (let m = 0; m < 1 << unknown.length; m++) {
    const bits = [...values];
    unknown.forEach((idx, k) => (bits[idx] = (m >> k) & 1));
    const r = fn(bits);
    out = out < 0 ? r : out === r ? r : LX;
  }
  return out;
}

const fns: Record<string, (b: number[]) => number> = {
  and: (b) => +b.every((x) => x === 1),
  or: (b) => +b.some((x) => x === 1),
  nand: (b) => +!b.every((x) => x === 1),
  nor: (b) => +!b.some((x) => x === 1),
  xor: (b) => b.reduce((a, x) => a ^ x, 0),
  xnor: (b) => 1 - b.reduce((a, x) => a ^ x, 0),
  not: (b) => 1 - b[0]!,
  buffer: (b) => b[0]!,
};

/** A gate whose inputs come from constants we can set to 0, 1, X or Z. */
function gateBench(type: string, inputs: number) {
  const b = new NetlistBuilder();
  const ins = b.nets(inputs, 'I');
  const y = b.net('Y');
  const pins: Record<string, number> = { Y: y };
  ins.forEach((n, i) => {
    b.add('const', `C${i}`, { Y: n }, { value: 0 });
    pins[String.fromCharCode(65 + i)] = n;
  });
  b.add(type, 'G', pins, type === 'not' || type === 'buffer' ? {} : { inputs });
  const e = createDigitalEngine(b.build());
  return {
    e,
    y,
    apply(values: number[]) {
      values.forEach((v, i) => e.setParam(`C${i}`, 'value', v));
      e.advance(2 * NS);
      return e.logic(y);
    },
  };
}

describe('gate truth tables with X and Z', () => {
  for (const [type, fn] of Object.entries(fns)) {
    const sizes = type === 'not' || type === 'buffer' ? [1] : [2, 3];
    for (const n of sizes) {
      test(`${type} with ${n} input${n > 1 ? 's' : ''}`, () => {
        const g = gateBench(type, n);
        for (const values of combos(n)) {
          const want = reference(fn, values);
          expect(g.apply(values), `${type}(${values.map(name).join(',')})`).toBe(want);
        }
      });
    }
  }

  test('dominance rules: AND with a 0 is 0 and OR with a 1 is 1 even when other inputs are X', () => {
    const and = gateBench('and', 3);
    expect(and.apply([0, LX, LZ])).toBe(0);
    expect(and.apply([1, LX, 1])).toBe(LX);
    const or = gateBench('or', 3);
    expect(or.apply([LX, 1, LZ])).toBe(1);
    expect(or.apply([LX, 0, 0])).toBe(LX);
    const xor = gateBench('xor', 2);
    expect(xor.apply([1, LX])).toBe(LX);
    expect(xor.apply([LZ, 0])).toBe(LX);
  });

  test('an unconnected input floats: the gate reads it as X', () => {
    const b = new NetlistBuilder();
    const y = b.net();
    b.add('not', 'U1', { Y: y });
    const e = createDigitalEngine(b.build());
    e.advance(5 * NS);
    expect(e.logic(y)).toBe(LX);
    expect(e.voltage(y)).toBeNaN();
  });
});

describe('tri-state buffers', () => {
  test('EN = 1 drives A, EN = 0 lets go (Z), EN unknown gives X', () => {
    const b = new NetlistBuilder();
    const a = b.net();
    const en = b.net();
    const y = b.net();
    b.add('const', 'CA', { Y: a });
    b.add('const', 'CE', { Y: en });
    b.add('tristate', 'T', { A: a, EN: en, Y: y });
    const e = createDigitalEngine(b.build());
    const at = (av: number, ev: number) => {
      e.setParam('CA', 'value', av);
      e.setParam('CE', 'value', ev);
      e.advance(2 * NS);
      return e.logic(y);
    };
    for (const av of V) {
      expect(at(av, 1)).toBe(av > 1 ? LX : av);
      expect(at(av, 0)).toBe(LZ);
      expect(at(av, LX)).toBe(LX);
      expect(at(av, LZ)).toBe(LX);
    }
  });

  test('a shared bus: one driver at a time works, two disagreeing drivers are contention (X)', () => {
    const b = new NetlistBuilder();
    const bus = b.net('BUS');
    const [a1, e1, a2, e2] = b.nets(4) as [number, number, number, number];
    b.add('toggle', 'A1', { Y: a1 }, { on: false });
    b.add('toggle', 'E1', { Y: e1 }, { on: false });
    b.add('toggle', 'A2', { Y: a2 }, { on: true });
    b.add('toggle', 'E2', { Y: e2 }, { on: false });
    b.add('tristate', 'T1', { A: a1, EN: e1, Y: bus });
    b.add('tristate', 'T2', { A: a2, EN: e2, Y: bus });
    b.add('probe', 'P', { A: bus });
    const e = createDigitalEngine(b.build());
    e.advance(5 * NS);
    expect(e.logic(bus)).toBe(LZ);
    expect(e.state('P').value).toBe(LZ);

    e.setParam('E1', 'on', true);
    e.advance(5 * NS);
    expect(e.logic(bus)).toBe(0);
    expect(e.contended(bus)).toBe(false);

    e.setParam('E2', 'on', true);
    e.advance(5 * NS);
    expect(e.logic(bus)).toBe(LX);
    expect(e.contended(bus)).toBe(true);
    const warning = e.messages.find((m) => m.text.includes('Contention'));
    expect(warning?.level).toBe('warning');
    expect(warning?.text).toContain('BUS');
    expect(warning?.text).toMatch(/T1 drives 0 while T2 drives 1/);

    e.setParam('E1', 'on', false);
    e.advance(5 * NS);
    expect(e.logic(bus)).toBe(1);
    expect(e.contended(bus)).toBe(false);

    // Both drivers agreeing is not contention.
    e.setParam('A1', 'on', true);
    e.setParam('E1', 'on', true);
    e.advance(5 * NS);
    expect(e.logic(bus)).toBe(1);
    expect(e.messages.filter((m) => m.text.includes('Contention'))).toHaveLength(1);
  });
});

describe('wiring', () => {
  test('ground is 0, a positive rail is 1', () => {
    const b = new NetlistBuilder();
    const g = b.ground();
    const v = b.net('+5V');
    const y = b.net();
    b.add('rail', 'VCC', { v });
    b.add('nand', 'U1', { A: v, B: g, Y: y });
    const e = createDigitalEngine(b.build());
    expect(e.logic(g)).toBe(0);
    expect(e.logic(v)).toBe(1);
    expect(e.voltage(v)).toBe(5);
    e.advance(2 * NS);
    expect(e.logic(y)).toBe(1);
  });

  test('an output tied to ground is contention', () => {
    const b = new NetlistBuilder();
    const g = b.ground();
    b.add('const', 'ONE', { Y: g }, { value: 1 });
    const e = createDigitalEngine(b.build());
    expect(e.logic(g)).toBe(LX);
    expect(e.messages.some((m) => m.text.includes('ground'))).toBe(true);
  });
});
