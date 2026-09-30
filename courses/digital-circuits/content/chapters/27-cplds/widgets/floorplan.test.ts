import { describe, expect, test } from 'vitest';
import { DESIGNS, floorplan, modulePath, moduleNodes, outputsOf, BLOCK_INPUTS } from './floorplan';
import { simulateAdder } from './floorplan-sim';

const by = (id: string) => DESIGNS.find((d) => d.id === id)!;

describe('the design hierarchies', () => {
  test.each(DESIGNS.map((d) => [d.id]))('%s: every output of the design belongs to exactly one module', (id) => {
    const d = by(id);
    const names = d.design().outputs.map((o) => o.name).sort();
    expect(outputsOf(d.tree).sort()).toEqual(names);
    for (const n of names) expect(modulePath(d.tree, n)).not.toBeNull();
    expect(moduleNodes(d.tree)[0]!.node.id).toBe('top');
  });
});

describe('the floorplan of Chapter 27', () => {
  test('the BCD display: the fitter packs eleven macrocells into two blocks, reading nine signals in all', () => {
    const r = floorplan(by('bcd'), 'fitter');
    expect(r.totals.macrocells).toBe(11);
    expect(r.fbs.map((f) => f.cells.filter(Boolean).length)).toEqual([8, 3, 0, 0]);
    expect(r.totals.blockInputs).toBe(9);
    expect(r.totals.tpd).toBe(7.5);
  });

  test('the counter goes where the design tree says it is, with its equation', () => {
    const r = floorplan(by('bcd'), 'fitter');
    const q3 = r.fbs.flatMap((f) => f.cells).find((c) => c?.name === 'Q3')!;
    expect(q3.path).toEqual(['top', 'counter']);
    expect(q3.kind).toBe('D');
    expect(q3.reads.sort()).toEqual(['CLR', 'EN', 'Q0', 'Q1', 'Q2', 'Q3']);
    const sg = r.fbs.flatMap((f) => f.cells).find((c) => c?.name === 'Sg')!;
    expect(sg.path).toEqual(['top', 'decoder']);
    expect(sg.polarity).toBe('low');
  });

  test.each(DESIGNS.map((d) => [d.id]))('%s: spreading the outputs over the blocks costs interconnect and changes no delay', (id) => {
    const packed = floorplan(by(id), 'fitter');
    const spread = floorplan(by(id), 'spread');
    expect(spread.totals.macrocells).toBe(packed.totals.macrocells);
    expect(spread.totals.blockInputs).toBeGreaterThan(packed.totals.blockInputs);
    expect(spread.totals.tpd).toBe(packed.totals.tpd);
    expect(spread.totals.tsu).toBe(packed.totals.tsu);
    expect(spread.totals.tco).toBe(packed.totals.tco);
    for (const f of spread.fbs) expect(f.inputs).toBeLessThanOrEqual(BLOCK_INPUTS);
    // Spread means every block that can be used is used.
    const used = (r: typeof packed) => r.fbs.filter((f) => f.cells.some(Boolean)).length;
    expect(used(spread)).toBeGreaterThanOrEqual(used(packed));
  });

  test('the 8-bit adder: 16 macrocells, the carry chain sets the delay at 7.5 + 7 × 5 = 42.5 ns wherever the fitter puts it', () => {
    for (const mode of ['fitter', 'spread'] as const) {
      const r = floorplan(by('adder8'), mode);
      expect(r.totals.macrocells).toBe(16);
      expect(r.totals.tpd).toBe(42.5);
      const cout = r.fbs.flatMap((f) => f.cells).find((c) => c?.name === 'COUT')!;
      expect(cout.depth).toBe(7);
      expect(cout.tpd).toBe(42.5);
      const c1 = r.fbs.flatMap((f) => f.cells).find((c) => c?.name === 'C1')!;
      expect(c1.tpd).toBe(7.5);
      expect(c1.buried).toBe(true);
    }
  });

  test('the fitted 8-bit adder adds: the device computes what the tree says', () => {
    const r = floorplan(by('adder8'), 'fitter');
    for (const [a, b, cin] of [[0, 0, 0], [255, 1, 0], [100, 155, 1], [200, 100, 0], [127, 128, 1]] as const) {
      expect(simulateAdder(r.fit, a, b, cin)).toBe(a + b + cin);
    }
  });
});
