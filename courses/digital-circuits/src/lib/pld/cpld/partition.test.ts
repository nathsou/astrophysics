import { describe, expect, test } from 'vitest';
import { mulberry32 } from '../twolevel/random';
import { partition, type PartItem } from './partition';

/** Outputs whose inputs mostly come from one of four planted groups of signals, plus noise. */
function planted(seed: number, count: number): PartItem[] {
  const rng = mulberry32(seed);
  const items: PartItem[] = [];
  for (let i = 0; i < count; i++) {
    const g = rng.int(4);
    const sup = new Set<number>();
    const k = 3 + rng.int(5);
    while (sup.size < k) sup.add(rng.chance(0.85) ? g * 14 + rng.int(14) : rng.int(56));
    items.push({ support: [...sup], terms: 1 + rng.int(4), oe: false, buried: false });
  }
  return items;
}

const distinct = (items: PartItem[], ids: number[]) => new Set(ids.flatMap((i) => items[i]!.support)).size;

describe('partition: greedy construction and Kernighan–Lin refinement', () => {
  test('every result respects the limits: at most 24 distinct inputs and 8 outputs per block', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const items = planted(seed, 24 + (seed % 9));
      const r = partition(items);
      expect(r.feasible, `seed ${seed}`).toBe(true);
      expect(r.fbOf.every((f) => f >= 0 && f < 4)).toBe(true);
      r.members.forEach((ids, fb) => {
        expect(ids.length).toBeLessThanOrEqual(8);
        expect(distinct(items, ids)).toBe(r.inputs[fb]);
        expect(r.inputs[fb]).toBeLessThanOrEqual(24);
        expect(r.arrangements[fb]).not.toBeNull();
      });
      // Every output is in exactly one block.
      expect(r.members.flat().sort((a, b) => a - b)).toEqual(items.map((_, i) => i));
    }
  });

  test('refinement never makes things worse and usually reduces the total number of block inputs', () => {
    let better = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const r = partition(planted(seed, 26));
      expect(r.stats.finalCost).toBeLessThanOrEqual(r.stats.initialCost);
      expect(r.stats.finalInputs).toBeLessThanOrEqual(r.stats.initialInputs + 2);
      if (r.stats.finalCost < r.stats.initialCost) better++;
    }
    expect(better).toBeGreaterThan(15);
  });

  test('refinement repairs a greedy start that overloads a block', () => {
    // With this seed the greedy construction leaves a block with more than 24 inputs.
    const r = partition(planted(4, 32));
    expect(r.stats.initialCost).toBeGreaterThan(400);
    expect(r.feasible).toBe(true);
    expect(r.stats.finalCost).toBeLessThan(150);
  });

  test('swaps let full blocks exchange outputs', () => {
    // Four blocks of eight, two kinds of output; a bad start would have them interleaved.
    const items: PartItem[] = Array.from({ length: 32 }, (_, i) => ({
      support: Array.from({ length: 20 }, (_, k) => (i % 2 === 0 ? k : 100 + k)),
      terms: 1,
      oe: false,
      buried: false,
    }));
    const r = partition(items);
    expect(r.feasible).toBe(true);
    // 16 outputs of each kind fill two blocks each; total inputs 4 × 20.
    expect(r.stats.finalInputs).toBe(80);
  });

  test('fixed blocks are honoured, and impossible constraints are reported', () => {
    const items: PartItem[] = [
      { support: Array.from({ length: 13 }, (_, k) => k), terms: 1, oe: false, buried: false, fb: 0, mc: 0 },
      { support: Array.from({ length: 13 }, (_, k) => 100 + k), terms: 1, oe: false, buried: false, fb: 0, mc: 1 },
    ];
    const r = partition(items);
    expect(r.feasible).toBe(false);
    expect(r.problems).toEqual([{ fb: 0, kind: 'inputs', inputs: 26, members: 2, termLoad: 2 }]);
    const ok = partition([items[0]!, { ...items[1]!, fb: 2, mc: 1 }]);
    expect(ok.feasible).toBe(true);
    expect(ok.fbOf).toEqual([0, 2]);
  });

  test('output-enable terms and heavy outputs are accounted for', () => {
    const heavy: PartItem = { support: [1, 2, 3], terms: 13, oe: true, buried: false };
    const r = partition([heavy]);
    expect(r.feasible).toBe(true);
    // 13 terms + the enable at macrocell m: 4 own + 5 + 5 = 14 at an interior macrocell.
    const arr = r.arrangements[r.fbOf[0]!]!;
    expect(arr.positions[0]).toBeGreaterThan(0);
    expect(arr.positions[0]).toBeLessThan(7);
    const impossible = partition([{ ...heavy, terms: 15 }]);
    expect(impossible.feasible).toBe(false);
    expect(impossible.problems[0]!.kind).toBe('terms');
  });

  test('deterministic', () => {
    const a = partition(planted(9, 28));
    const b = partition(planted(9, 28));
    expect(a.fbOf).toEqual(b.fbOf);
    expect(a.stats).toEqual(b.stats);
  });
});
