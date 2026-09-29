import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '$lib/studio/examples';
import { blankPla, plaAdapter, type PlaDeviceFit } from '$lib/studio/adapters/pla';
import { promAdapter, type PromFit } from '$lib/studio/adapters/prom';
import { Pla, fitPlaEquations } from '$lib/pld/devices/pla';
import { Prom } from '$lib/pld/devices/prom';
import { SEGMENT_TABLE } from '$lib/studio/widgets/SegmentDecoder';

/** The numbers of Chapter 25's text about the Studio's PROM and PLA. */
const strip = (s: string) => s.split('\n').filter((l) => !/^\s*#\s*@/.test(l)).join('\n');
const example = (dev: 'prom' | 'pla', id: string) => EXAMPLES[dev].find((e) => e.id === id)!;

describe('the seven-segment PROM (Figure 25.2)', () => {
  test('digits 0 to 9 light 6, 2, 5, 5, 4, 5, 6, 3, 7 and 6 segments: 49 fuses in all', () => {
    const lit = SEGMENT_TABLE.slice(0, 10).map((p) => p.toString(2).split('1').length - 1);
    expect(lit).toEqual([6, 2, 5, 5, 4, 5, 6, 3, 7, 6]);
    expect(lit.reduce((a, b) => a + b, 0)).toBe(49);
  });

  test('programming the table blows exactly 49 of the 112 fuses', () => {
    const p = new Prom({ addressBits: 4, width: 7 });
    expect(p.fuseCount).toBe(112);
    const ops = p.programTruthTable(strip(example('prom', 'seven-segment').source));
    expect(ops).toHaveLength(49);
    expect(p.contents().slice(0, 10)).toEqual(SEGMENT_TABLE.slice(0, 10));
    expect(p.contents().slice(10)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  test('a blown fuse cannot be put right: the planner refuses, in the words quoted in the chapter', () => {
    const p = new Prom({ addressBits: 4, width: 7 });
    p.blow(6, 4);
    const want = Array.from({ length: 16 }, () => 0);
    expect(() => p.plan(want)).toThrow(/the fuse is already blown, so the bit cannot change back to 0/);
  });

  test('the Studio adapter agrees', () => {
    const r = promAdapter.program(example('prom', 'seven-segment').source);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.fit as PromFit).chip.prom.fuses.reduce((a, b) => a + b, 0)).toBe(49);
  });
});

describe('the full-adder PLA (Figure 25.4)', () => {
  const fit = fitPlaEquations(strip(example('pla', 'full-adder').source));

  test('seven product terms; 392 fuses; the fitter blows 215 and leaves 177', () => {
    expect(fit.pla.fuseCount).toBe(392);
    expect(fit.pla.usedTerms()).toBe(7);
    expect(fit.pla.blownOps()).toHaveLength(215);
    expect(392 - 215).toBe(177);
  });

  test('the sum uses four terms of three literals, the carry three terms of two', () => {
    const used = fit.pla.terms().filter((t) => t.kind === 'product' && t.outputs.length > 0);
    const literals = (t: { pattern: string }) => t.pattern.replace(/-/g, '').length;
    const s = used.filter((t) => t.outputs.includes(0));
    const c = used.filter((t) => t.outputs.includes(1));
    expect(s.map(literals)).toEqual([3, 3, 3, 3]);
    expect(c.map(literals)).toEqual([2, 2, 2]);
    expect(s.filter((t) => c.includes(t))).toHaveLength(0);
  });

  test('the lab: making T0 = A·B by hand, then unwiring it from S', () => {
    const blank = blankPla(['A', 'B', 'CIN'], ['S', 'COUT']);
    let f: PlaDeviceFit = blank;
    const toggle = (a: Parameters<NonNullable<typeof f.edit>>[0]) => (f = f.edit!(a) as PlaDeviceFit);
    // A virgin part: every output reads 0.
    const rows = () => {
      const r = f.runner();
      return Array.from({ length: 8 }, (_, m) => {
        const v = { A: (m >> 2) & 1, B: (m >> 1) & 1, CIN: m & 1 };
        const s = r.evaluate(v).signals;
        return [s.S, s.COUT];
      });
    };
    expect(rows().flat().every((x) => x === 0)).toBe(true);
    // Keep the true fuses of A and B (inputs 0 and 1) on T0; blow the other fourteen.
    for (let i = 0; i < 8; i++)
      for (const literal of ['true', 'complement'] as const) {
        const keep = literal === 'true' && i < 2;
        if (!keep) toggle({ type: 'toggle', plane: 'and', term: 0, input: i, literal });
      }
    // The term is alive and, in a virgin OR plane, wired to every output.
    expect(rows()).toEqual([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 1], [1, 1]]);
    // The target: S = 0 for A=1,B=1,CIN=0 (row 6), 1 for row 7; COUT = 1 for both.
    // Blowing T0's fuse to S leaves it feeding COUT only.
    toggle({ type: 'toggle', plane: 'or', term: 0, output: 0 });
    expect(rows()).toEqual([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 1], [0, 1]]);
  });

  test('the Studio’s own adapter fits the example with seven terms', () => {
    const r = plaAdapter.program(example('pla', 'full-adder').source);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.fit as PlaDeviceFit).chip.info.filter((t) => t.kind !== 'false' && t.outputs.length > 0)).toHaveLength(7);
    expect(new Pla().fuseCount).toBe(392);
  });
});
