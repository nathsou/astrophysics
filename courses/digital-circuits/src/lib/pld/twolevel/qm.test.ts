import { describe, expect, test } from 'vitest';
import { coverMinterms, coverToStrings, cubeMinterms, cubeToString, literalCount } from './cube';
import { coverToText } from './expr';
import { quineMcCluskey } from './qm';
import { mulberry32 } from './random';

/** All prime implicants by brute force over the 3^n cubes (small n). */
function brutePrimes(n: number, on: number[], dc: number[]): string[] {
  const allowed = new Set([...on, ...dc]);
  const implicants: string[] = [];
  for (let k = 0; k < 3 ** n; k++) {
    let s = '';
    let x = k;
    for (let i = 0; i < n; i++, x = Math.floor(x / 3)) s += '01-'[x % 3]!;
    const ms = mintermsOfPattern(s);
    if (ms.every((m) => allowed.has(m))) implicants.push(s);
  }
  const set = new Set(implicants);
  return implicants
    .filter((s) => ![...s].some((ch, i) => ch !== '-' && set.has(s.slice(0, i) + '-' + s.slice(i + 1))))
    .sort();
}

function mintermsOfPattern(s: string): number[] {
  let ms = [0];
  const n = s.length;
  [...s].forEach((ch, i) => {
    const b = 1 << (n - 1 - i);
    if (ch === '1') ms = ms.map((m) => m | b);
    else if (ch === '-') ms = ms.flatMap((m) => [m, m | b]);
  });
  return ms;
}

/** Minimum (terms, literals) of a cover of `on` using the given primes, by exhaustive search. */
function bruteMinimum(primes: string[], on: number[]): { terms: number; literals: number } {
  const pm = primes.map((p) => new Set(mintermsOfPattern(p)));
  const lits = primes.map((p) => [...p].filter((c) => c !== '-').length);
  let best = { terms: Infinity, literals: Infinity };
  const k = primes.length;
  for (let mask = 0; mask < 1 << k; mask++) {
    let terms = 0;
    let literals = 0;
    for (let i = 0; i < k; i++)
      if (mask & (1 << i)) {
        terms++;
        literals += lits[i]!;
      }
    if (terms > best.terms || (terms === best.terms && literals >= best.literals)) continue;
    if (on.every((m) => pm.some((s, i) => mask & (1 << i) && s.has(m)))) best = { terms, literals };
  }
  return best;
}

function checkCover(n: number, on: number[], dc: number[], cubes: string[]) {
  const got = new Set(cubes.flatMap(mintermsOfPattern));
  for (const m of on) expect(got.has(m)).toBe(true);
  for (const m of got) expect(on.includes(m) || dc.includes(m)).toBe(true);
  void n;
}

describe('Quine–McCluskey', () => {
  test('Mano: Σm(4,8,10,11,12,15) + d(9,14) = BC̄D̄ + AB̄ + AC', () => {
    const r = quineMcCluskey(4, [4, 8, 10, 11, 12, 15], [9, 14]);
    expect(r.exact).toBe(true);
    expect(coverToStrings(r.cover).sort()).toEqual(['-100', '1-1-', '10--'].sort());
    expect(coverToText(r.cover, ['A', 'B', 'C', 'D'])).toMatch(/B & !C & !D/);
  });

  test('Σm(0,1,2,5,6,7,8,9,10,14) = B̄C̄ + CD̄ + ĀBD', () => {
    const on = [0, 1, 2, 5, 6, 7, 8, 9, 10, 14];
    const r = quineMcCluskey(4, on);
    const strings = coverToStrings(r.cover);
    checkCover(4, on, [], strings);
    expect(strings.sort()).toEqual(['-00-', '--10', '01-1'].sort());
    const primes = brutePrimes(4, on, []);
    expect(coverToStrings(r.primes).sort()).toEqual(primes);
    expect(bruteMinimum(primes, on)).toEqual({ terms: 3, literals: 7 });
  });

  test('the cyclic function Σm(0,1,2,5,6,7) needs Petrick', () => {
    const r = quineMcCluskey(3, [0, 1, 2, 5, 6, 7], [], { names: ['A', 'B', 'C'] });
    const t = r.trace;
    expect(t.primes.length).toBe(6);
    expect(t.essential).toEqual([]);
    const core = t.steps.find((s) => s.kind === 'cyclic-core');
    expect(core).toBeDefined();
    expect(t.petrick).toBeDefined();
    const p = t.petrick!;
    expect(p.method).toBe('petrick');
    expect(p.sums.length).toBe(6);
    expect(p.sums.every((s) => s.primes.length === 2)).toBe(true);
    // The two classic minimal solutions, three terms each.
    expect(p.minimal.length).toBe(2);
    expect(p.minimal.every((s) => s.length === 3)).toBe(true);
    const asText = p.minimal.map((ids) => ids.map((id) => t.implicants[id]!.pattern).sort());
    expect(asText).toContainEqual(['00-', '-10', '1-1'].sort());
    expect(asText).toContainEqual(['0-0', '-01', '11-'].sort());
    expect(r.cover.cubes.length).toBe(3);
    // Every product after the last multiplication is a cover.
    const last = p.steps[p.steps.length - 1]!;
    expect(last.products).not.toBeNull();
    for (const prod of last.products!) {
      const ms = new Set(prod.flatMap((id) => t.implicants[id]!.minterms));
      for (const m of [0, 1, 2, 5, 6, 7]) expect(ms.has(m)).toBe(true);
    }
  });

  test('trace: rounds, groups and merges', () => {
    const r = quineMcCluskey(4, [0, 1, 2, 5, 6, 7, 8, 9, 10, 14]);
    const t = r.trace;
    // Round 0 groups minterms by number of ones.
    const g0 = t.rounds[0]!.groups;
    expect(g0.map((g) => g.ones)).toEqual([0, 1, 2, 3]);
    expect(g0[0]!.ids.map((id) => t.implicants[id]!.minterms[0])).toEqual([0]);
    expect(g0[1]!.ids.map((id) => t.implicants[id]!.minterms[0]).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2, 8]);
    // Each merge combines two implicants differing in one bit.
    for (const round of t.rounds)
      for (const mg of round.merges) {
        const a = t.implicants[mg.a]!;
        const b = t.implicants[mg.b]!;
        const c = t.implicants[mg.result]!;
        expect(c.minterms).toEqual([...a.minterms, ...b.minterms].sort((x, y) => x - y));
        expect(c.round).toBeLessThanOrEqual(round.round + 1);
      }
    // Duplicates (the same result from two pairs) are flagged, not repeated.
    const r2 = t.rounds[2];
    if (r2) expect(new Set(r2.groups.flatMap((g) => g.ids)).size).toBe(r2.groups.flatMap((g) => g.ids).length);
    expect(t.rounds[1]!.merges.some((m) => m.duplicate)).toBe(true);
    // The trace is plain data.
    expect(JSON.parse(JSON.stringify(t))).toEqual(t);
  });

  test('essential primes are recorded with the minterms that make them essential', () => {
    const r = quineMcCluskey(4, [4, 8, 10, 11, 12, 15], [9, 14]);
    const ess = r.trace.steps.filter((s) => s.kind === 'essential');
    expect(ess.length).toBeGreaterThan(0);
    for (const s of ess) {
      if (s.kind !== 'essential') continue;
      const imp = r.trace.implicants[s.prime]!;
      for (const m of s.because) expect(imp.minterms).toContain(m);
    }
  });

  test('random functions: covers are correct and minimal (brute force, n ≤ 4)', () => {
    const rng = mulberry32(12);
    for (let trial = 0; trial < 120; trial++) {
      const n = 2 + rng.int(3);
      const on: number[] = [];
      const dc: number[] = [];
      for (let m = 0; m < 2 ** n; m++) {
        const x = rng.next();
        if (x < 0.45) on.push(m);
        else if (x < 0.6) dc.push(m);
      }
      const r = quineMcCluskey(n, on, dc);
      const strings = coverToStrings(r.cover);
      checkCover(n, on, dc, strings);
      const primes = brutePrimes(n, on, dc);
      expect(coverToStrings(r.primes).sort()).toEqual(primes);
      if (on.length === 0) {
        expect(strings).toEqual([]);
        continue;
      }
      const best = bruteMinimum(primes, on);
      expect(strings.length).toBe(best.terms);
      expect(r.cover.cubes.reduce((s, c) => s + literalCount(c, n), 0)).toBe(best.literals);
    }
  });

  test('random 6-variable functions with and without dominance agree in cost', () => {
    const rng = mulberry32(99);
    for (let trial = 0; trial < 40; trial++) {
      const n = 6;
      const on: number[] = [];
      const dc: number[] = [];
      for (let m = 0; m < 64; m++) {
        const x = rng.next();
        if (x < 0.4) on.push(m);
        else if (x < 0.5) dc.push(m);
      }
      const a = quineMcCluskey(n, on, dc);
      const b = quineMcCluskey(n, on, dc, { dominance: false });
      expect(a.cover.cubes.length).toBe(b.cover.cubes.length);
      const lits = (cs: typeof a.cover.cubes) => cs.reduce((s, c) => s + literalCount(c, n), 0);
      expect(lits(a.cover.cubes)).toBe(lits(b.cover.cubes));
      checkCover(n, on, dc, coverToStrings(a.cover));
    }
  });

  test('Petrick size guard falls back to branch and bound', () => {
    const rng = mulberry32(5);
    const n = 6;
    const on: number[] = [];
    for (let m = 0; m < 64; m++) if (rng.chance(0.5)) on.push(m);
    const exact = quineMcCluskey(n, on, [], { dominance: false });
    const guarded = quineMcCluskey(n, on, [], { dominance: false, petrickLimit: 4 });
    if (guarded.trace.petrick) {
      expect(guarded.trace.petrick.aborted).toBe(true);
      expect(guarded.trace.petrick.method).toBe('branch-and-bound');
    }
    expect(guarded.cover.cubes.length).toBe(exact.cover.cubes.length);
  });

  test('constants', () => {
    expect(quineMcCluskey(3, []).cover.cubes).toEqual([]);
    const one = quineMcCluskey(3, [0, 1, 2, 3, 4, 5, 6, 7]);
    expect(one.cover.cubes.map((c) => cubeToString(c, 3))).toEqual(['---']);
    expect(coverMinterms(one.cover).length).toBe(8);
    expect(cubeMinterms(one.cover.cubes[0]!, 3).length).toBe(8);
  });
});
