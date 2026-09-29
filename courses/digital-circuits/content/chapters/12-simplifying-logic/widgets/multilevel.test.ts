import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import { evalDag, layoutDag, outputId } from '../../11-boolean-algebra/widgets/layout';
import { bitOf } from '../../11-boolean-algebra/widgets/synth';
import { EXAMPLES, both, metrics, prefixed, twoLevel } from './multilevel';

describe('two-level against multi-level', () => {
  for (const e of EXAMPLES) {
    test(`${e.id}: the two networks are the same function`, () => {
      const n = e.vars.length;
      const a = twoLevel(e);
      const b = e.multi;
      for (let m = 0; m < 2 ** n; m++) {
        const env = Object.fromEntries(e.vars.map((v, i) => [v, bitOf(m, i, n)]));
        expect(evalDag(a, env).Y, `${e.id} row ${m}`).toBe(evalDag(b, env).Y);
      }
    });
    test(`${e.id}: the drawing of both simulates correctly`, () => {
      const n = e.vars.length;
      const { dag, order } = both(e);
      const flat = flatten(layoutDag(dag, { order }));
      const eng = createDigitalEngine(flat);
      const net = (name: string) => flat.elements.find((x) => x.id === outputId(name))!.pins[0]!;
      for (let m = 0; m < 2 ** n; m++) {
        e.vars.forEach((v, i) => eng.setParam(`in_${v}`, 'on', !!bitOf(m, i, n)));
        eng.advance(300e-9);
        const want = evalDag(e.multi, Object.fromEntries(e.vars.map((v, i) => [v, bitOf(m, i, n)]))).Y;
        expect(eng.logic(net('two levels'))).toBe(want);
        expect(eng.logic(net('factored'))).toBe(want);
      }
    });
  }
  test('factoring saves gates and transistors but adds depth (except parity, which wins on both)', () => {
    const cmp = (id: string) => {
      const e = EXAMPLES.find((x) => x.id === id)!;
      return { flat: metrics(prefixed(twoLevel(e), 's_', 'Y')), multi: metrics(prefixed(e.multi, 'm_', 'Y')) };
    };
    const c = cmp('common');
    expect(c.flat.gates).toBe(4);
    expect(c.multi.gates).toBe(2);
    expect(c.multi.transistors).toBeLessThan(c.flat.transistors);
    const m = cmp('majority');
    expect(m.flat.gates).toBe(4);
    expect(m.multi.gates).toBe(4);
    expect(m.multi.depth).toBeGreaterThan(m.flat.depth);
    const p = cmp('parity');
    expect(p.multi.gates).toBe(3);
    expect(p.flat.gates).toBeGreaterThan(10);
    expect(p.multi.depth).toBeLessThanOrEqual(p.flat.depth);
    console.log(JSON.stringify({ common: c, product: cmp('product'), majority: m, parity: p }));
  });
});
