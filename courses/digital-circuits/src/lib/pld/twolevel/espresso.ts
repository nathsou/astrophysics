/**
 * An Espresso-style heuristic minimiser (after Brayton, Hachtel, McMullen and Sangiovanni-
 * Vincentelli, 1984), for single-output functions too large for Quine–McCluskey.
 *
 *   R = complement(F ∪ D)                        the off-set
 *   F = IRREDUNDANT(EXPAND(F, R), D)
 *   repeat
 *     F' = IRREDUNDANT(EXPAND(REDUCE(F, D), R), D)
 *   while F' is cheaper than F
 *   LAST_GASP: reduce every cube independently, expand, and keep new primes that help
 *
 * EXPAND turns each cube into a prime by raising literals, guided by a blocking matrix against the
 * off-set and preferring raises that swallow other cubes. IRREDUNDANT removes cubes covered by the
 * rest. REDUCE shrinks each cube to the smallest cube that still covers what only it covers, which
 * lets the next EXPAND move in a different direction. Containment and redundancy tests use the unate
 * recursive tautology check of `unate.ts`.
 */
import {
  DC,
  ONE,
  ZERO,
  compareCost,
  contains,
  coverCost,
  getVar,
  intersect,
  isVoid,
  literalCount,
  scc,
  setVar,
  universe,
  type Cover,
  type Cube,
} from './cube';
import { cofactorCover, complement, coveredBy, supercubeOfComplement } from './unate';

export interface EspressoOptions {
  /** Maximum REDUCE–EXPAND–IRREDUNDANT iterations (default 20). */
  maxIterations?: number;
  /** Try LAST_GASP when the loop stalls (default true). */
  lastGasp?: boolean;
  /** A precomputed off-set; must equal complement(on ∪ dc). */
  offSet?: Cover;
}

export interface EspressoStats {
  iterations: number;
  offSetCubes: number;
  initial: { cubes: number; literals: number };
  final: { cubes: number; literals: number };
}

export function espresso(on: Cover, dc?: Cover, opts: EspressoOptions = {}): Cover {
  return espressoWithStats(on, dc, opts).cover;
}

export function espressoWithStats(on: Cover, dc?: Cover, opts: EspressoOptions = {}): { cover: Cover; stats: EspressoStats } {
  const n = on.n;
  const D = dc?.cubes ?? [];
  let F = scc(on.cubes, n);
  const initial = coverCost({ n, cubes: F });
  if (F.length === 0) return { cover: { n, cubes: [] }, stats: { iterations: 0, offSetCubes: 0, initial, final: initial } };
  const R = opts.offSet?.cubes ?? complement([...F, ...D], n);
  if (R.length === 0) {
    const u = universe(n);
    const cost = { cubes: 1, literals: 0 };
    return { cover: { n, cubes: [u] }, stats: { iterations: 0, offSetCubes: 0, initial, final: cost } };
  }
  F = expand(F, R, n);
  F = irredundant(F, D, n);
  let cost = coverCost({ n, cubes: F });
  const maxIter = opts.maxIterations ?? 20;
  let iterations = 0;
  for (;;) {
    while (iterations < maxIter) {
      iterations++;
      let G = reduce(F, D, n);
      G = expand(G, R, n);
      G = irredundant(G, D, n);
      const c = coverCost({ n, cubes: G });
      if (compareCost(c, cost) >= 0) break;
      F = G;
      cost = c;
    }
    if (opts.lastGasp === false || iterations >= maxIter) break;
    const G = lastGasp(F, D, R, n);
    const c = coverCost({ n, cubes: G });
    if (compareCost(c, cost) >= 0) break;
    // LAST_GASP found a cheaper cover: run the main loop again from it.
    F = G;
    cost = c;
  }
  return { cover: { n, cubes: F }, stats: { iterations, offSetCubes: R.length, initial, final: cost } };
}

// ---------------------------------------------------------------------------------------------
// EXPAND

/**
 * Expand every cube of F into a prime implicant that does not meet the off-set R, removing cubes
 * that become covered. Larger cubes are expanded first.
 */
export function expand(F: Cube[], R: Cube[], n: number): Cube[] {
  const order = F.map((c, i) => ({ c, i, k: literalCount(c, n) })).sort((a, b) => a.k - b.k || a.i - b.i);
  const live = order.map((e) => e.c);
  const alive = new Uint8Array(live.length).fill(1);
  const out: Cube[] = [];
  for (let i = 0; i < live.length; i++) {
    if (!alive[i]) continue;
    const others: Cube[] = [];
    const otherIdx: number[] = [];
    for (let j = 0; j < live.length; j++)
      if (j !== i && alive[j]) {
        others.push(live[j]!);
        otherIdx.push(j);
      }
    const p = expandCube(live[i]!, others, R, n);
    alive[i] = 0;
    for (let j = 0; j < live.length; j++) if (alive[j] && contains(p, live[j]!)) alive[j] = 0;
    out.push(p);
  }
  return scc(out, n);
}

/**
 * Expand one cube. Its literal columns form a blocking matrix against R: row r has a bit for each
 * literal of c that conflicts with r. A set K of literals may be kept iff every row has a bit in
 * K. First, other cubes are absorbed greedily (each forbids keeping the literals it conflicts
 * with) while every row still has a permitted bit; then K is chosen as a small irredundant cover
 * of the rows, which makes the result prime.
 */
export function expandCube(c: Cube, others: Cube[], R: Cube[], n: number): Cube {
  const lits: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = getVar(c, i);
    if (v === ZERO || v === ONE) lits.push(i);
  }
  const L = lits.length;
  if (L === 0) return c.slice();
  const W = Math.max(1, Math.ceil(L / 32)); // words per bitset over the literal columns
  // Blocking rows.
  const rows = new Uint32Array(R.length * W);
  let nRows = 0;
  for (const r of R) {
    const base = nRows * W;
    let any = false;
    for (let j = 0; j < L; j++) {
      const v = lits[j]!;
      if ((getVar(c, v) & getVar(r, v)) === 0) {
        rows[base + (j >>> 5)] = rows[base + (j >>> 5)]! | (1 << (j & 31));
        any = true;
      }
    }
    if (!any) throw new Error('espresso: a cube of F intersects the off-set');
    nRows++;
  }
  // Conflict masks of the other cubes.
  const forbid = new Uint32Array(W);
  const conflicts: Uint32Array[] = [];
  for (const d of others) {
    const m = new Uint32Array(W);
    let any = false;
    for (let j = 0; j < L; j++) {
      const v = lits[j]!;
      const cv = getVar(c, v);
      if ((getVar(d, v) & ~cv & 3) !== 0) {
        m[j >>> 5] = m[j >>> 5]! | (1 << (j & 31));
        any = true;
      }
    }
    if (any) conflicts.push(m);
  }
  const feasible = (extra: Uint32Array | null) => {
    for (let r = 0; r < nRows; r++) {
      const base = r * W;
      let ok = false;
      for (let w = 0; w < W; w++) {
        const allowed = ~(forbid[w]! | (extra ? extra[w]! : 0));
        if (rows[base + w]! & allowed) {
          ok = true;
          break;
        }
      }
      if (!ok) return false;
    }
    return true;
  };
  const popNew = (m: Uint32Array) => {
    let k = 0;
    for (let w = 0; w < W; w++) {
      let x = m[w]! & ~forbid[w]!;
      while (x) {
        x &= x - 1;
        k++;
      }
    }
    return k;
  };
  const subsetOfForbidPlus = (m: Uint32Array, extra: Uint32Array) => {
    for (let w = 0; w < W; w++) if (m[w]! & ~(forbid[w]! | extra[w]!)) return false;
    return true;
  };
  let cands = conflicts.filter((m) => feasible(m));
  while (cands.length) {
    // Fewest new raises; ties broken by how many other candidates it would absorb too.
    let best = -1;
    let bestNew = Infinity;
    let bestAbsorb = -1;
    for (let k = 0; k < cands.length; k++) {
      const m = cands[k]!;
      const nw = popNew(m);
      if (nw > bestNew) continue;
      let absorb = 0;
      if (nw === bestNew || cands.length <= 64) for (const o of cands) if (subsetOfForbidPlus(o, m)) absorb++;
      if (nw < bestNew || absorb > bestAbsorb) {
        best = k;
        bestNew = nw;
        bestAbsorb = absorb;
      }
    }
    const m = cands[best]!;
    for (let w = 0; w < W; w++) forbid[w] = forbid[w]! | m[w]!;
    cands = cands.filter((o) => !subsetOfForbidPlus(o, forbid) && feasible(o));
  }
  // Choose kept literals K ⊆ ¬forbid covering every row: essentials, then greedy, then prune.
  const keep = new Uint32Array(W);
  const covered = new Uint8Array(nRows);
  let left = nRows;
  const markCovered = () => {
    for (let r = 0; r < nRows; r++) {
      if (covered[r]) continue;
      const base = r * W;
      for (let w = 0; w < W; w++)
        if (rows[base + w]! & keep[w]!) {
          covered[r] = 1;
          left--;
          break;
        }
    }
  };
  for (let r = 0; r < nRows; r++) {
    const base = r * W;
    let count = 0;
    let only = -1;
    for (let w = 0; w < W; w++) {
      let x = rows[base + w]! & ~forbid[w]!;
      while (x) {
        const low = x & -x;
        only = w * 32 + (31 - Math.clz32(low));
        x &= x - 1;
        count++;
      }
    }
    if (count === 1) keep[only >>> 5] = keep[only >>> 5]! | (1 << (only & 31));
  }
  markCovered();
  while (left > 0) {
    let bestJ = -1;
    let bestHits = 0;
    for (let j = 0; j < L; j++) {
      const w = j >>> 5;
      const b = 1 << (j & 31);
      if (forbid[w]! & b || keep[w]! & b) continue;
      let hits = 0;
      for (let r = 0; r < nRows; r++) if (!covered[r] && rows[r * W + w]! & b) hits++;
      if (hits > bestHits) {
        bestHits = hits;
        bestJ = j;
      }
    }
    if (bestJ < 0) throw new Error('espresso: expansion is infeasible');
    keep[bestJ >>> 5] = keep[bestJ >>> 5]! | (1 << (bestJ & 31));
    markCovered();
  }
  // Irredundant: drop kept literals whose rows are all hit by another kept literal.
  for (let j = L - 1; j >= 0; j--) {
    const w = j >>> 5;
    const b = 1 << (j & 31);
    if (!(keep[w]! & b)) continue;
    keep[w] = keep[w]! & ~b;
    let ok = true;
    for (let r = 0; r < nRows && ok; r++) {
      const base = r * W;
      let hit = false;
      for (let ww = 0; ww < W; ww++)
        if (rows[base + ww]! & keep[ww]!) {
          hit = true;
          break;
        }
      if (!hit) ok = false;
    }
    if (!ok) keep[w] = keep[w]! | b;
  }
  const p = c.slice();
  for (let j = 0; j < L; j++) if (!(keep[j >>> 5]! & (1 << (j & 31)))) setVar(p, lits[j]!, DC);
  return p;
}

// ---------------------------------------------------------------------------------------------
// IRREDUNDANT

/**
 * Remove redundant cubes. Relatively essential cubes (not covered by the others and D) are kept;
 * totally redundant ones (covered by the essentials and D) are dropped; the partially redundant
 * rest is reduced to a small subset that still covers them, removing the smallest cubes first.
 */
export function irredundant(F: Cube[], D: Cube[], n: number): Cube[] {
  const essential: Cube[] = [];
  const redundant: Cube[] = [];
  for (let i = 0; i < F.length; i++) {
    const rest = [...F.slice(0, i), ...F.slice(i + 1), ...D];
    if (coveredBy(F[i]!, rest, n)) redundant.push(F[i]!);
    else essential.push(F[i]!);
  }
  if (redundant.length === 0) return F.slice();
  const ED = [...essential, ...D];
  const partial = redundant.filter((c) => !coveredBy(c, ED, n));
  if (partial.length === 0) return essential;
  const chosen = minimumSubcover(partial, ED, n);
  return [...essential, ...chosen];
}

/**
 * Smallest subset S of P (heuristically; exactly for small P) such that every cube of P is
 * covered by base ∪ S.
 */
function minimumSubcover(P: Cube[], base: Cube[], n: number): Cube[] {
  // For each cube p, the sets of P-cubes that together (with base) cover it would define a
  // covering problem; for small P we search subsets by increasing size, otherwise we remove
  // cubes greedily, smallest first.
  const covers = (S: Cube[]) => P.every((p) => S.includes(p) || coveredBy(p, [...base, ...S], n));
  if (P.length <= 10) {
    const k0 = 1;
    const idx = P.map((_, i) => i);
    for (let k = k0; k < P.length; k++) {
      let found: Cube[] | null = null;
      combinations(idx, k, (sel) => {
        const S = sel.map((i) => P[i]!);
        if (covers(S)) {
          found = S;
          return true;
        }
        return false;
      });
      if (found) return found;
    }
    return P.slice();
  }
  const keep = P.slice();
  const order = P.map((c, i) => ({ c, i, k: literalCount(c, n) })).sort((a, b) => b.k - a.k || a.i - b.i);
  for (const { c } of order) {
    const rest = keep.filter((x) => x !== c);
    if (coveredBy(c, [...base, ...rest], n)) keep.splice(keep.indexOf(c), 1);
  }
  return keep;
}

function combinations(items: number[], k: number, visit: (sel: number[]) => boolean): boolean {
  const sel: number[] = [];
  const rec = (start: number): boolean => {
    if (sel.length === k) return visit(sel);
    for (let i = start; i <= items.length - (k - sel.length); i++) {
      sel.push(items[i]!);
      if (rec(i + 1)) return true;
      sel.pop();
    }
    return false;
  };
  return rec(0);
}

// ---------------------------------------------------------------------------------------------
// REDUCE

/**
 * Replace each cube, in turn, by the smallest cube containing the part of it that no other cube
 * (or the don't-care set) covers; a cube with no such part is dropped. Largest cubes go first.
 */
export function reduce(F: Cube[], D: Cube[], n: number): Cube[] {
  const order = F.map((c, i) => ({ c, i, k: literalCount(c, n) })).sort((a, b) => a.k - b.k || a.i - b.i);
  const cur: (Cube | null)[] = order.map((e) => e.c);
  for (let i = 0; i < cur.length; i++) {
    const c = cur[i]!;
    const others: Cube[] = [];
    for (let j = 0; j < cur.length; j++) if (j !== i && cur[j]) others.push(cur[j]!);
    const G = cofactorCover([...others, ...D], c, n);
    const s = supercubeOfComplement(G, n);
    if (!s) {
      cur[i] = null;
      continue;
    }
    const r = intersect(c, s);
    cur[i] = isVoid(r, n) ? null : r;
  }
  return cur.filter((c): c is Cube => c !== null);
}

// ---------------------------------------------------------------------------------------------
// LAST_GASP

/**
 * Reduce every cube independently (against the unreduced others), expand the reduced cubes, and
 * add the new primes that absorb at least two reduced cubes; then make the result irredundant.
 */
export function lastGasp(F: Cube[], D: Cube[], R: Cube[], n: number): Cube[] {
  const reduced: Cube[] = [];
  for (let i = 0; i < F.length; i++) {
    const others = [...F.slice(0, i), ...F.slice(i + 1), ...D];
    const s = supercubeOfComplement(cofactorCover(others, F[i]!, n), n);
    if (!s) continue;
    const r = intersect(F[i]!, s);
    if (!isVoid(r, n)) reduced.push(r);
  }
  const extra: Cube[] = [];
  for (let i = 0; i < reduced.length; i++) {
    const others = reduced.filter((_, j) => j !== i);
    const p = expandCube(reduced[i]!, others, R, n);
    let absorbed = 0;
    for (const r of reduced) if (contains(p, r)) absorbed++;
    if (absorbed >= 2 && !F.some((f) => contains(f, p))) extra.push(p);
  }
  if (extra.length === 0) return F;
  return irredundant(scc([...extra, ...F], n), D, n);
}
