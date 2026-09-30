import { describe, expect, test } from 'vitest';
import { contains, coverFromStrings, coverTruthTable, cubeHasMinterm, cubeMinterms, cubeToString, type Cube } from './cube';
import { mulberry32, type Rng } from './random';
import { complement, coveredBy, equivalent, supercubeOfComplement, tautology } from './unate';

function randomCover(rng: Rng, n: number, count: number, pLit = 0.5): Cube[] {
  const strings: string[] = [];
  for (let k = 0; k < count; k++) {
    let s = '';
    for (let i = 0; i < n; i++) s += rng.chance(pLit) ? (rng.chance(0.5) ? '1' : '0') : '-';
    strings.push(s);
  }
  return coverFromStrings(strings, n).cubes;
}

function table(cubes: Cube[], n: number): Uint8Array {
  return coverTruthTable({ n, cubes });
}

describe('unate recursive paradigm', () => {
  test('tautology agrees with brute force', () => {
    const rng = mulberry32(1);
    let yes = 0;
    for (let trial = 0; trial < 400; trial++) {
      const n = 2 + rng.int(6);
      const F = randomCover(rng, n, 1 + rng.int(12), 0.35);
      const expected = table(F, n).every((v) => v === 1);
      if (expected) yes++;
      expect(tautology(F, n)).toBe(expected);
    }
    expect(yes).toBeGreaterThan(20); // both outcomes are exercised
  });

  test('classic tautologies', () => {
    expect(tautology(coverFromStrings(['1-', '0-']).cubes, 2)).toBe(true);
    expect(tautology(coverFromStrings(['11', '10', '0-']).cubes, 2)).toBe(true);
    expect(tautology(coverFromStrings(['11', '00']).cubes, 2)).toBe(false);
    expect(tautology([], 3)).toBe(false);
  });

  test('complement agrees with brute force', () => {
    const rng = mulberry32(2);
    for (let trial = 0; trial < 300; trial++) {
      const n = 1 + rng.int(7);
      const F = randomCover(rng, n, rng.int(10));
      const C = complement(F, n);
      const t = table(F, n);
      const tc = table(C, n);
      for (let m = 0; m < t.length; m++) expect(tc[m]).toBe(1 - t[m]!);
    }
  });

  test('the complement has no cube contained in another', () => {
    const rng = mulberry32(22);
    for (let trial = 0; trial < 200; trial++) {
      const n = 3 + rng.int(8);
      const C = complement(randomCover(rng, n, 1 + rng.int(12), 0.4), n);
      for (let i = 0; i < C.length; i++)
        for (let j = 0; j < C.length; j++) if (i !== j) expect(contains(C[i]!, C[j]!)).toBe(false);
    }
  });

  test('supercube of the complement agrees with brute force', () => {
    const rng = mulberry32(3);
    for (let trial = 0; trial < 300; trial++) {
      const n = 1 + rng.int(6);
      const F = randomCover(rng, n, rng.int(8));
      const t = table(F, n);
      const offMs = [...t.keys()].filter((m) => !t[m]);
      const s = supercubeOfComplement(F, n);
      if (offMs.length === 0) {
        expect(s).toBeNull();
        continue;
      }
      // Smallest cube containing every off minterm: per variable, the values seen.
      let expected = '';
      for (let i = 0; i < n; i++) {
        const vals = new Set(offMs.map((m) => (m >>> (n - 1 - i)) & 1));
        expected += vals.size === 2 ? '-' : vals.has(1) ? '1' : '0';
      }
      expect(cubeToString(s!, n)).toBe(expected);
    }
  });

  test('containment of a cube in a cover', () => {
    const F = coverFromStrings(['1-0', '11-', '0-1']).cubes;
    expect(coveredBy(coverFromStrings(['110']).cubes[0]!, F, 3)).toBe(true);
    expect(coveredBy(coverFromStrings(['1--']).cubes[0]!, F, 3)).toBe(false);
    // Covered only by the union, not by any single cube.
    expect(coveredBy(coverFromStrings(['11-']).cubes[0]!, coverFromStrings(['110', '111']).cubes, 3)).toBe(true);
  });

  test('equivalence with and without don’t cares', () => {
    const a = coverFromStrings(['1-', '-1']);
    const b = coverFromStrings(['1-', '01']);
    expect(equivalent(a, b)).toBe(true);
    const c = coverFromStrings(['1-']);
    expect(equivalent(a, c)).toBe(false);
    expect(equivalent(a, c, coverFromStrings(['01']))).toBe(true);
    // Random: a cover and its minterm expansion are equivalent.
    const rng = mulberry32(4);
    for (let trial = 0; trial < 50; trial++) {
      const n = 2 + rng.int(5);
      const F = randomCover(rng, n, 1 + rng.int(6));
      const ms = [...new Set(F.flatMap((c) => cubeMinterms(c, n)))];
      const G = ms.map((m) => {
        let s = '';
        for (let i = 0; i < n; i++) s += (m >>> (n - 1 - i)) & 1;
        return s;
      });
      expect(equivalent({ n, cubes: F }, coverFromStrings(G, n))).toBe(true);
      expect(F.every((c) => ms.some((m) => cubeHasMinterm(c, m, n)))).toBe(true);
    }
  });

  test('tautology on 24 variables (structured)', () => {
    // x0 + x̄0·x1 + x̄0·x̄1 over 24 variables, with extra noise cubes.
    const n = 24;
    const pad = '-'.repeat(n - 2);
    const F = coverFromStrings([`1-${pad}`, `01${pad}`, `00${pad}`, `1-${'0'.repeat(n - 2)}`], n).cubes;
    expect(tautology(F, n)).toBe(true);
    expect(tautology(F.slice(1), n)).toBe(false);
    expect(complement(F.slice(1, 3), n).map((c) => cubeToString(c, n))).toEqual([`1-${pad}`]);
  });
});
