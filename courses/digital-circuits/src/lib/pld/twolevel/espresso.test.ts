import { describe, expect, test } from 'vitest';
import { coverFromStrings, coverMinterms, coverToStrings, coverTruthTable, literalCount, type Cover } from './cube';
import { espresso, espressoWithStats } from './espresso';
import { quineMcCluskey } from './qm';
import { mulberry32, type Rng } from './random';
import { implementsFunction } from './unate';

function randomTable(rng: Rng, n: number, pOn: number, pDc: number) {
  const on: number[] = [];
  const dc: number[] = [];
  for (let m = 0; m < 2 ** n; m++) {
    const x = rng.next();
    if (x < pOn) on.push(m);
    else if (x < pOn + pDc) dc.push(m);
  }
  return { on, dc };
}

function mintermCover(n: number, ms: number[]): Cover {
  return coverFromStrings(
    ms.map((m) => m.toString(2).padStart(n, '0')),
    n,
  );
}

function randomSop(rng: Rng, n: number, cubes: number, minLits: number, maxLits: number): Cover {
  const strings: string[] = [];
  for (let k = 0; k < cubes; k++) {
    const lits = minLits + rng.int(maxLits - minLits + 1);
    const s = Array<string>(n).fill('-');
    for (let j = 0; j < lits; j++) s[rng.int(n)] = rng.chance(0.5) ? '1' : '0';
    strings.push(s.join(''));
  }
  return coverFromStrings(strings, n);
}

describe('Espresso', () => {
  test('a simple function', () => {
    // f = Σm(0,1,2,5,6,7,8,9,10,14) → 3 terms.
    const n = 4;
    const on = mintermCover(n, [0, 1, 2, 5, 6, 7, 8, 9, 10, 14]);
    const F = espresso(on);
    expect(implementsFunction(F, on)).toBe(true);
    expect(F.cubes.length).toBe(3);
  });

  test('uses don’t cares', () => {
    const n = 4;
    const on = mintermCover(n, [4, 8, 10, 11, 12, 15]);
    const dc = mintermCover(n, [9, 14]);
    const F = espresso(on, dc);
    expect(implementsFunction(F, on, dc)).toBe(true);
    expect(F.cubes.length).toBe(3);
  });

  test('constants and tautologies', () => {
    const n = 3;
    expect(espresso({ n, cubes: [] }).cubes).toEqual([]);
    const all = espresso(mintermCover(n, [0, 1, 2, 3, 4, 5, 6, 7]));
    expect(all.cubes.length).toBe(1);
    expect(literalCount(all.cubes[0]!, n)).toBe(0);
    const viaDc = espresso(mintermCover(n, [0, 1, 2, 3]), mintermCover(n, [4, 5, 6, 7]));
    expect(viaDc.cubes.length).toBe(1);
    expect(literalCount(viaDc.cubes[0]!, n)).toBe(0);
  });

  test('random functions: equivalent to the specification, close to the exact minimum', () => {
    const rng = mulberry32(2026);
    let exactTerms = 0;
    let espressoTerms = 0;
    let exactLits = 0;
    let espressoLits = 0;
    let optimal = 0;
    let worst = 1;
    let inexact = 0;
    const trials = 300;
    for (let trial = 0; trial < trials; trial++) {
      const n = 4 + rng.int(4); // 4..7 variables
      const { on, dc } = randomTable(rng, n, 0.2 + rng.next() * 0.4, rng.chance(0.5) ? 0.1 : 0);
      if (on.length === 0) continue;
      const onC = mintermCover(n, on);
      const dcC = mintermCover(n, dc);
      const F = espresso(onC, dcC);
      expect(implementsFunction(F, onC, dcC)).toBe(true);
      // Double-check against the truth table.
      const t = coverTruthTable(F);
      for (const m of on) expect(t[m]).toBe(1);
      const allowed = new Set([...on, ...dc]);
      for (const m of coverMinterms(F)) expect(allowed.has(m)).toBe(true);
      const exact = quineMcCluskey(n, on, dc);
      const q = exact.cover;
      if (exact.exact) expect(F.cubes.length).toBeGreaterThanOrEqual(q.cubes.length);
      else inexact++;
      exactTerms += q.cubes.length;
      espressoTerms += F.cubes.length;
      exactLits += q.cubes.reduce((s, c) => s + literalCount(c, n), 0);
      espressoLits += F.cubes.reduce((s, c) => s + literalCount(c, n), 0);
      if (F.cubes.length === q.cubes.length) optimal++;
      worst = Math.max(worst, F.cubes.length / q.cubes.length);
    }
    const ratio = espressoTerms / exactTerms;
    console.log(
      `Espresso vs exact on ${trials} random functions of 4–7 variables: ` +
        `${espressoTerms} vs ${exactTerms} terms (ratio ${ratio.toFixed(3)}), ` +
        `${espressoLits} vs ${exactLits} literals, optimal term count in ${optimal}/${trials}, worst ratio ${worst.toFixed(2)}` +
        (inexact ? `; exact covering hit its budget in ${inexact}` : ''),
    );
    expect(ratio).toBeLessThanOrEqual(1.3);
  });

  test('8-variable random functions: close to the exact minimum', () => {
    const rng = mulberry32(88);
    let exactTerms = 0;
    let espressoTerms = 0;
    let optimal = 0;
    const trials = 8;
    for (let trial = 0; trial < trials; trial++) {
      const n = 8;
      const { on, dc } = randomTable(rng, n, 0.25 + rng.next() * 0.3, 0.08);
      const onC = mintermCover(n, on);
      const dcC = mintermCover(n, dc);
      const F = espresso(onC, dcC);
      expect(implementsFunction(F, onC, dcC)).toBe(true);
      const q = quineMcCluskey(n, on, dc, { traceLimit: 0 }).cover;
      exactTerms += q.cubes.length;
      espressoTerms += F.cubes.length;
      if (F.cubes.length === q.cubes.length) optimal++;
    }
    console.log(`Espresso vs exact on ${trials} random 8-variable functions: ${espressoTerms} vs ${exactTerms} terms (ratio ${(espressoTerms / exactTerms).toFixed(3)}), optimal in ${optimal}/${trials}`);
    expect(espressoTerms / exactTerms).toBeLessThanOrEqual(1.3);
  });

  test('22 inputs × 10 outputs, per output', () => {
    // Each output is a random compact SOP whose cubes are then split into fragments (a cube split
    // on 1–3 extra variables), with a few don't-care cubes. Espresso must recover a cover no
    // larger than the compact one.
    const rng = mulberry32(7);
    const n = 22;
    let given = 0;
    let compact = 0;
    let after = 0;
    const t0 = performance.now();
    for (let o = 0; o < 10; o++) {
      const base = randomSop(rng, n, 6 + rng.int(10), 4, 9);
      const fragments: string[] = [];
      for (const c of coverToStrings(base)) {
        const free = [...c].map((ch, i) => (ch === '-' ? i : -1)).filter((i) => i >= 0);
        const k = 1 + rng.int(3);
        const split = free.sort(() => rng.next() - 0.5).slice(0, k);
        for (let v = 0; v < 1 << split.length; v++) {
          const s = [...c];
          split.forEach((i, j) => (s[i] = (v >> j) & 1 ? '1' : '0'));
          fragments.push(s.join(''));
        }
      }
      const on = coverFromStrings(fragments, n);
      const dc = randomSop(rng, n, rng.int(4), 8, 12);
      const { cover: F, stats } = espressoWithStats(on, dc);
      expect(implementsFunction(F, on, dc)).toBe(true);
      expect(implementsFunction(F, base, dc)).toBe(true);
      expect(F.cubes.length).toBeLessThanOrEqual(base.cubes.length);
      expect(stats.final.cubes).toBe(F.cubes.length);
      given += on.cubes.length;
      compact += base.cubes.length;
      after += F.cubes.length;
    }
    const ms = performance.now() - t0;
    console.log(`Espresso, 22 inputs × 10 outputs: ${given} fragments in (from ${compact} cubes), ${after} out, ${ms.toFixed(0)} ms`);
  });

  test('merges adjacent cubes across many variables', () => {
    // x0·x1·…·x19 + x̄0·x1·…·x19 = x1·…·x19
    const n = 20;
    const on = coverFromStrings(['1'.repeat(n), '0' + '1'.repeat(n - 1)], n);
    const F = espresso(on);
    expect(F.cubes.length).toBe(1);
    expect(literalCount(F.cubes[0]!, n)).toBe(n - 1);
  });
});
