import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import { PRESETS, bitOf, expressionText, outsOfPreset, synthesise, type Form } from './synth';
import { evalDag, inputId, layoutDag, outputId } from './layout';

function truthOf(n: number, dagOut: (values: Record<string, number>) => number, names: string[]): number[] {
  return Array.from({ length: 2 ** n }, (_, m) => dagOut(Object.fromEntries(names.map((nm, v) => [nm, bitOf(m, v, n)]))));
}

describe('synthesise', () => {
  test('canonical forms of XOR', () => {
    const outs = [0, 1, 1, 0];
    expect(expressionText(synthesise(2, outs, 'sop'))).toBe('¬A·B + A·¬B');
    expect(expressionText(synthesise(2, outs, 'pos'))).toBe('(A + B) (¬A + ¬B)');
  });

  test('the minimised sum of a majority function has three two-literal terms', () => {
    const s = synthesise(3, [0, 0, 0, 1, 0, 1, 1, 1], 'min');
    expect(s.terms.map((t) => t.length)).toEqual([2, 2, 2]);
    expect(s.gates).toBe(4); // three ANDs and an OR
  });

  test('every preset, in every form, computes the table it was made from', () => {
    for (const p of PRESETS) {
      const outs = outsOfPreset(p);
      for (const form of ['sop', 'pos', 'min'] as Form[]) {
        const s = synthesise(p.n, outs, form);
        expect(truthOf(p.n, (v) => evalDag(s.dag, v).Y!, s.names), `${p.id} ${form}`).toEqual(outs);
      }
    }
  });

  test('every 3-input function survives the drawn circuit: layout, flatten, simulate', () => {
    for (let f = 0; f < 256; f++) {
      const outs = Array.from({ length: 8 }, (_, m) => (f >> m) & 1);
      for (const form of ['sop', 'pos', 'min'] as Form[]) {
        const s = synthesise(3, outs, form);
        const flat = flatten(layoutDag(s.dag));
        const e = createDigitalEngine(flat);
        const y = flat.elements.find((x) => x.id === outputId('Y'))!.pins[0]!;
        for (let m = 0; m < 8; m++) {
          s.names.forEach((nm, v) => {
            if (flat.elements.some((x) => x.id === inputId(nm))) e.setParam(inputId(nm), 'on', !!bitOf(m, v, 3));
          });
          e.advance(200e-9);
          expect(e.logic(y), `f=${f} ${form} row ${m}`).toBe(outs[m]);
        }
      }
    }
  }, 120_000);

  test('fan-in is limited to four, so the 16 minterms of parity need an OR tree', () => {
    const s = synthesise(4, outsOfPreset(PRESETS.find((p) => p.id === 'parity4')!), 'sop');
    expect(Math.max(...s.dag.gates.map((g) => g.inputs.length))).toBeLessThanOrEqual(4);
    expect(s.terms).toHaveLength(8);
  });
});
