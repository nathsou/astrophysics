import { describe, expect, test } from 'vitest';
import { PARTS, getPart, referenceOf, behaviourOf, expandPins } from './parts';
import { checkPart, portsOf } from './verify';
import { partsResolver } from './store-core';
import { connect } from '../sim/netlist/connect';
import { flatten } from '../sim/netlist/flatten';
import { checkCombinational } from '../sim/check';

const real = PARTS.filter((p) => p.status === 'reference');

describe('registry', () => {
  test('ids are unique and planned parts have no reference', () => {
    expect(new Set(PARTS.map((p) => p.id)).size).toBe(PARTS.length);
    for (const p of PARTS.filter((x) => x.status === 'planned')) expect(p.reference).toBeUndefined();
  });
  test('pin expansion', () => {
    expect(expandPins('A0-2 EN')).toEqual(['A0', 'A1', 'A2', 'EN']);
  });
  test('the curriculum’s parts are all there', () => {
    for (const id of ['not-rtl', 'not', 'nand', 'nor', 'and', 'or', 'xor', 'xnor', 'mux2', 'mux4', 'mux8', 'dec2-4', 'dec3-8', 'seg7', 'comparator', 'half-adder', 'full-adder', 'adder8', 'shifter', 'sr-latch', 'd-latch', 'd-flip-flop', 'register', 'counter', 'shift-register', 'lfsr', 'ram', 'rom', 'alu', 'register-file', 'bus', 'control-unit', 'io-ports', 'pwm', 'dac', 'adc'])
      expect(getPart(id), id).toBeDefined();
  });
});

describe('every reference part', () => {
  for (const p of real) {
    test(`${p.id}: pins match the reference's ports, wires connect, and the spec passes`, () => {
      const c = referenceOf(p.id)!;
      expect(c).toBeDefined();
      const ports = portsOf(c);
      expect(ports.inputs, 'inputs').toEqual(p.pins.filter((x) => x.dir === 'in').map((x) => x.name));
      expect(ports.outputs, 'outputs').toEqual(p.pins.filter((x) => x.dir === 'out').map((x) => x.name));
      // Drawn circuits have no dangling pins except the unused Qn of flip-flops.
      const partsRes = (t: string) => (t.startsWith('part:') ? behaviourOf(t.slice(5)) : undefined);
      const conn = connect(c, (t) => (t.startsWith('part:') ? partsRes(t) : undefined));
      const dangling = conn.unconnected.filter((n) => !/\.(Qn|COUT)$/.test(n) || true);
      // Only outputs of parts may be left open.
      const bad = dangling.filter((n) => {
        const [id, pin] = n.split('.');
        const comp = c.components.find((x) => x.id === id)!;
        return !(comp.type.startsWith('part:') || comp.type === 'ram' || comp.type === 'dff' || comp.type === 'dlatch') || /^(A|B|D|EN|CLK|S|R|CIN|CLR)/.test(pin!);
      });
      expect(bad).toEqual([]);
      const r = checkPart(p, undefined, partsResolver(false));
      expect(r.problems).toEqual([]);
      if (r.comb) expect(r.comb.failures[0]).toBeUndefined();
      if (r.seq) expect(r.seq.counterexample).toBeUndefined();
      expect(r.pass).toBe(true);
    }, 60000);
  }
});

describe('reference parts fail wrong circuits', () => {
  test('an OR is not an AND', () => {
    const r = checkPart('and', referenceOf('or')!, partsResolver(false));
    expect(r.pass).toBe(false);
    expect(r.comb!.failures.length).toBeGreaterThan(0);
  });
  test('a NAND is not a NOR', () => {
    expect(checkPart('nand', referenceOf('nor')!).pass).toBe(false);
  });
  test('missing pins are reported', () => {
    const r = checkPart('full-adder', referenceOf('half-adder')!, partsResolver(false));
    expect(r.pass).toBe(false);
    expect(r.problems.join()).toContain('CIN');
  });
  test('an adder with a broken carry fails with a counterexample', () => {
    const c = structuredClone(referenceOf('half-adder')!);
    const and = c.components.find((x) => x.type === 'part:and')!;
    and.type = 'part:or';
    const r = checkPart('half-adder', c, partsResolver(false));
    expect(r.pass).toBe(false);
    expect(r.comb!.failures[0]!.wrong).toContain('C');
  });
});

describe('parts inside circuits', () => {
  test('a circuit using part:full-adder flattens to gates and computes', () => {
    const c = {
      version: 1 as const,
      components: [
        { id: 'SA', type: 'toggle', x: 0, y: 0, label: 'A' },
        { id: 'SB', type: 'toggle', x: 0, y: 2, label: 'B' },
        { id: 'SC', type: 'toggle', x: 0, y: 4, label: 'C' },
        { id: 'X1', type: 'part:full-adder', x: 8, y: 0 },
        { id: 'S', type: 'indicator', x: 20, y: 0, label: 'S' },
        { id: 'CO', type: 'indicator', x: 20, y: 2, label: 'CO' },
      ],
      wires: [
        { points: [[3, 0], [8, 0]] as [number, number][] },
        { points: [[3, 2], [8, 2]] as [number, number][] },
        { points: [[3, 4], [8, 4]] as [number, number][] },
        { points: [[14, 0], [20, 0]] as [number, number][] },
        { points: [[14, 2], [20, 2]] as [number, number][] },
      ],
    };
    const parts = partsResolver(false);
    const flat = flatten(c, parts);
    expect(flat.elements.some((e) => e.id.startsWith('X1/'))).toBe(true);
    const r = checkCombinational(c, { fn: (v) => { const t = v.A! + v.B! + v.C!; return { S: t & 1, CO: t >> 1 }; }, inputs: ['A', 'B', 'C'], outputs: ['S', 'CO'] }, { parts });
    expect(r.problems).toEqual([]);
    expect(r.pass).toBe(true);
  });
});

describe('mutants of the references are caught', () => {
  /** Swap the first component of `from` for `to` and expect the part's checker to fail. */
  const cases: [string, string, string][] = [
    ['adder8', 'part:xor', 'part:xnor'],
    ['full-adder', 'part:or', 'part:and'],
    ['mux4', 'part:mux2', 'part:and'],
    ['alu', 'part:mux8', 'part:mux8'],
    ['d-flip-flop', 'part:not', 'part:not'],
    ['register', 'part:and', 'part:or'],
    ['counter', 'part:half-adder', 'part:and'],
    ['shift-register', 'part:mux2', 'part:mux2'],
    ['lfsr', 'xor', 'or'],
    ['comparator', 'part:xnor', 'part:xor'],
    ['seg7', 'and', 'or'],
    ['sr-latch', 'part:nor', 'part:nand'],
    ['register-file', 'part:mux4', 'part:mux2'],
  ];
  for (const [id, from, to] of cases) {
    test(`${id}: ${from} → ${to}`, () => {
      const c = structuredClone(referenceOf(id)!);
      const target = c.components.find((x) => x.type === from)!;
      expect(target, `no ${from} in ${id}`).toBeDefined();
      if (from === to) {
        // Same type: break the wiring instead by dropping the first wire.
        c.wires.shift();
      } else target.type = to;
      let r;
      try {
        r = checkPart(id, c, partsResolver(false));
      } catch {
        return; // a mutant that cannot even be simulated is caught too
      }
      expect(r.pass, `${id} mutant passed`).toBe(false);
    }, 60000);
  }
});
