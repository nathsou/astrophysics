import { describe, expect, test } from 'vitest';
import { place } from '$lib/pld/fpga';
import { assignOf, buildProblem, cost, fromNames, legality, packDesign, period, score, search, toNames, type PlaceInput } from './model';

const design = `module Lfsr(clk: clock, en: bit, load: bit, seed: bits<4>) -> (q: bits<4>, par: bit, hit: bit) {
  reg r: bits<12> = 1
  let fb: bit = r[11] ^ r[10] ^ r[9] ^ r[3]
  next r = if load { concat(seed, r[7:0]) } else if en { concat(r[10:0], fb) } else { r }
  q = r[11:8]
  par = r[0] ^ r[1] ^ r[2] ^ r[3] ^ r[4] ^ r[5] ^ r[6] ^ r[7]
  hit = r[11:4] == 0xA5
}`;
const pins = { 'seed[0]': 'P12', 'seed[2]': 'P14', 'q[0]': 'P4', 'q[2]': 'P6' };
const input: PlaceInput = { id: 't/place', design, seed: 5, pins };

describe('place: the model', () => {
  const p = buildProblem(input);

  test('the design packs into three tiles and thirteen pad blocks', () => {
    expect(p.blocks.filter((b) => b.kind === 'logic').map((b) => b.cells)).toEqual([8, 8, 7]);
    expect(p.blocks.filter((b) => b.kind === 'io')).toHaveLength(13);
    expect(p.blocks.filter((b) => b.fixed).map((b) => b.name).sort()).toEqual(['clk', 'q[0]', 'q[2]', 'seed[0]', 'seed[2]']);
    expect(p.sites.filter((s) => s.kind === 'logic')).toHaveLength(4);
    expect(p.sites.filter((s) => s.kind === 'io')).toHaveLength(16);
  });

  test('the cost of the annealer’s own placement is the placer’s wirelength term, exactly', () => {
    expect(p.annealerCost).toBeCloseTo(p.annealer.bb, 9);
    for (const seed of [1, 2, 3]) {
      const q = buildProblem({ ...input, seed });
      expect(cost(q, assignOf(q, q.annealer))).toBeCloseTo(q.annealer.bb, 9);
    }
  });

  test('the placer’s own result is legal under our checks, and its estimated critical path is the placer’s', () => {
    expect(legality(p, assignOf(p, p.annealer))).toEqual([]);
    expect(period(p, assignOf(p, p.annealer))).toBeCloseTo(p.annealer.estPeriod, 9);
  });

  test('two blocks on a site, a block on the wrong kind of site, and a moved fixed block are all refused', () => {
    const a = p.start.slice();
    const tiles = p.blocks.filter((b) => b.kind === 'logic');
    a[tiles[1]!.unit] = a[tiles[0]!.unit]!;
    expect(legality(p, a)[0]).toMatch(/tile 1 and tile 0 are both on tile/);
    const b = p.start.slice();
    b[tiles[0]!.unit] = p.sites.findIndex((s) => s.kind === 'io');
    expect(legality(p, b)[0]).toMatch(/tile 0 cannot go on pad/);
    const c = p.start.slice();
    const clk = p.blocks.find((x) => x.name === 'clk')!;
    const free = p.sites.findIndex((s, i) => s.kind === 'io' && !c.includes(i));
    c[clk.unit] = free;
    expect(legality(p, c).join(' ')).toMatch(/clk is fixed to pad P0/);
  });

  test('a search for a cheaper placement beats the annealer on this seed, and the names round-trip', () => {
    const best = search(p, 8);
    expect(legality(p, best)).toEqual([]);
    expect(cost(p, best)).toBeLessThan(p.annealerCost);
    const again = fromNames(p, toNames(p, best));
    expect([...again]).toEqual([...best]);
    expect(score(input, p, best)).toMatchObject({ legal: true, beats: true });
  });

  test('level with the annealer is not beating it; a goal factor moves the bar', () => {
    const level = assignOf(p, p.annealer);
    expect(score(input, p, level).beats).toBe(false);
    expect(score({ goal: 1.1 }, p, level).beats).toBe(true);
  });

  test('designs with carry chains are refused (a rigid column of tiles cannot be dragged)', () => {
    expect(() => packDesign({ design: 'module Add(a: bits<16>, b: bits<16>) -> (y: bits<16>) {\n y = a + b\n}' })).toThrow(/carry chain/);
  });

  test('the annealer is deterministic for a seed', () => {
    const q = packDesign(input);
    const a = place(q.packed, q.device, { seed: 5, pins });
    const b = place(q.packed, q.device, { seed: 5, pins });
    expect([...a.unitX]).toEqual([...b.unitX]);
    expect(a.bb).toBe(b.bb);
  });
});
