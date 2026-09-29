/**
 * The unate recursive paradigm (Brayton et al., "Logic Minimization Algorithms for VLSI Synthesis",
 * 1984): tautology, complement and the supercube of the complement, computed by Shannon expansion
 * on the most binate variable. A cover that is unate in every variable is a tautology exactly when
 * it contains the universal cube, which ends the recursion early; unate variables are also removed
 * before splitting (the unate reduction).
 */
import {
  DC,
  ONE,
  ZERO,
  cofactorCube,
  contains,
  cubeKey,
  getVar,
  intersects,
  isUniversal,
  literalCount,
  scc,
  setVar,
  universe,
  withVar,
  type Cover,
  type Cube,
} from './cube';

interface ColumnCounts {
  zeros: Int32Array;
  ones: Int32Array;
}

function columnCounts(F: Cube[], n: number): ColumnCounts {
  const zeros = new Int32Array(n);
  const ones = new Int32Array(n);
  for (const c of F) {
    for (let w = 0; w < c.length; w++) {
      let x = c[w]!;
      const base = w * 16;
      for (let k = 0; k < 16 && base + k < n; k++, x >>>= 2) {
        const v = x & 3;
        if (v === ZERO) zeros[base + k]!++;
        else if (v === ONE) ones[base + k]!++;
      }
    }
  }
  return { zeros, ones };
}

/** Most binate variable (most literals, then most balanced); -1 if the cover is unate. */
function binateVar(cc: ColumnCounts, n: number): number {
  let best = -1;
  let bestTotal = -1;
  let bestBalance = Infinity;
  for (let i = 0; i < n; i++) {
    const z = cc.zeros[i]!;
    const o = cc.ones[i]!;
    if (z === 0 || o === 0) continue;
    const t = z + o;
    const b = Math.abs(z - o);
    if (t > bestTotal || (t === bestTotal && b < bestBalance)) {
      best = i;
      bestTotal = t;
      bestBalance = b;
    }
  }
  return best;
}

/** Variable with the most literals; -1 if no cube has a literal. */
function busiestVar(cc: ColumnCounts, n: number): number {
  let best = -1;
  let bestTotal = 0;
  for (let i = 0; i < n; i++) {
    const t = cc.zeros[i]! + cc.ones[i]!;
    if (t > bestTotal) {
      best = i;
      bestTotal = t;
    }
  }
  return best;
}

/** Shannon cofactor of a cover with respect to variable i = value (0 or 1). */
export function cofactorVar(F: Cube[], i: number, value: 0 | 1): Cube[] {
  const need = value ? ONE : ZERO;
  const out: Cube[] = [];
  for (const c of F) {
    const v = getVar(c, i);
    if (!(v & need)) continue;
    out.push(v === DC ? c : withVar(c, i, DC));
  }
  return out;
}

/** Cofactor of a cover with respect to a cube. */
export function cofactorCover(F: Cube[], p: Cube, n: number): Cube[] {
  const out: Cube[] = [];
  for (const c of F) {
    const r = cofactorCube(c, p, n);
    if (r) out.push(r);
  }
  return out;
}

function hasUniversal(F: Cube[], n: number): boolean {
  for (const c of F) if (isUniversal(c, n)) return true;
  return false;
}

/** True if the cover is the constant 1. */
export function tautology(F: Cube[], n: number): boolean {
  if (F.length === 0) return false;
  if (hasUniversal(F, n)) return true;
  // Too few minterms to fill the space?
  let total = 0;
  const space = 2 ** n;
  for (const c of F) {
    total += 2 ** (n - literalCount(c, n));
    if (total >= space) break;
  }
  if (total < space) return false;

  const cc = columnCounts(F, n);
  const x = binateVar(cc, n);
  if (x < 0) return false; // unate and no universal cube
  // Unate reduction: a variable that appears in one polarity only can be set to the other
  // polarity, which deletes every cube containing it.
  let unate = false;
  for (let i = 0; i < n; i++) if ((cc.zeros[i]! === 0) !== (cc.ones[i]! === 0)) unate = true;
  if (unate) {
    const kept = F.filter((c) => {
      for (let i = 0; i < n; i++) {
        if ((cc.zeros[i]! === 0) === (cc.ones[i]! === 0)) continue;
        if (getVar(c, i) !== DC) return false;
      }
      return true;
    });
    return tautology(kept, n);
  }
  return tautology(cofactorVar(F, x, 0), n) && tautology(cofactorVar(F, x, 1), n);
}

/** True if cube c is covered by the cover F (c ⊆ ∪F). */
export function coveredBy(c: Cube, F: Cube[], n: number): boolean {
  for (const d of F) if (contains(d, c)) return true;
  return tautology(cofactorCover(F, c, n), n);
}

/** True if every cube of A is covered by B. */
export function coverContains(B: Cube[], A: Cube[], n: number): boolean {
  return A.every((c) => coveredBy(c, B, n));
}

/**
 * True if the covers agree wherever the don't-care set does not apply:
 * A ⊆ B ∪ DC and B ⊆ A ∪ DC.
 */
export function equivalent(A: Cover, B: Cover, dc?: Cover): boolean {
  const n = A.n;
  if (B.n !== n || (dc && dc.n !== n)) throw new Error('Covers have different numbers of variables');
  const d = dc?.cubes ?? [];
  return coverContains([...B.cubes, ...d], A.cubes, n) && coverContains([...A.cubes, ...d], B.cubes, n);
}

/** True if cover F implements the function (on, dc): on ⊆ F ⊆ on ∪ dc. */
export function implementsFunction(F: Cover, on: Cover, dc?: Cover): boolean {
  const n = F.n;
  const d = dc?.cubes ?? [];
  return coverContains(F.cubes, on.cubes, n) && coverContains([...on.cubes, ...d], F.cubes, n);
}

/** De Morgan: the complement of a single cube, as disjoint-literal cubes. */
function complementCube(c: Cube, n: number): Cube[] {
  const out: Cube[] = [];
  for (let i = 0; i < n; i++) {
    const v = getVar(c, i);
    if (v === ZERO || v === ONE) {
      const r = universe(n);
      setVar(r, i, v === ZERO ? ONE : ZERO);
      out.push(r);
    }
  }
  return out;
}

/** The complement of a cover, as a cover (unate recursive). */
export function complement(F: Cube[], n: number): Cube[] {
  if (F.length === 0) return [universe(n)];
  if (hasUniversal(F, n)) return [];
  if (F.length === 1) return complementCube(F[0]!, n);
  const cc = columnCounts(F, n);
  let x = binateVar(cc, n);
  if (x < 0) x = busiestVar(cc, n);
  const C1 = complement(cofactorVar(F, x, 1), n);
  const C0 = complement(cofactorVar(F, x, 0), n);
  return mergeHalves(C0, C1, x, n);
}

/**
 * x̄·C0 + x·C1, merging cubes that appear in both halves (the variable drops out) and raising x
 * in a cube of one half that is contained in a cube of the other.
 */
function mergeHalves(C0: Cube[], C1: Cube[], x: number, n: number): Cube[] {
  const out: Cube[] = [];
  const keys0 = new Map<string, number>();
  C0.forEach((c, i) => keys0.set(cubeKey(c), i));
  const used0 = new Uint8Array(C0.length);
  const rest1: Cube[] = [];
  for (const c of C1) {
    const j = keys0.get(cubeKey(c));
    if (j !== undefined) {
      used0[j] = 1;
      out.push(c);
    } else rest1.push(c);
  }
  const rest0 = C0.filter((_, i) => !used0[i]);
  for (const c of rest1) out.push(rest0.some((d) => contains(d, c)) ? c : withVar(c, x, ONE));
  for (const c of rest0) out.push(rest1.some((d) => contains(d, c)) ? c : withVar(c, x, ZERO));
  // If C0 and C1 are free of single-cube containment, so is the result (a cube raised only where
  // no cube of the other half contains it cannot be contained in another output cube), so no
  // further scc pass is needed.
  return out;
}

/**
 * The supercube of the complement of F (the smallest cube containing every minterm not in F), or
 * null when F is a tautology. Used by REDUCE.
 */
export function supercubeOfComplement(F: Cube[], n: number): Cube | null {
  if (F.length === 0) return universe(n);
  if (hasUniversal(F, n)) return null;
  if (F.length === 1) {
    const c = F[0]!;
    let lit = -1;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const v = getVar(c, i);
      if (v === ZERO || v === ONE) {
        lit = i;
        count++;
      }
    }
    const r = universe(n);
    if (count === 1) setVar(r, lit, getVar(c, lit) === ZERO ? ONE : ZERO);
    return r;
  }
  const cc = columnCounts(F, n);
  let x = binateVar(cc, n);
  if (x < 0) x = busiestVar(cc, n);
  const a = supercubeOfComplement(cofactorVar(F, x, 1), n);
  const b = supercubeOfComplement(cofactorVar(F, x, 0), n);
  if (a && b) {
    const r = new Uint32Array(a.length);
    for (let w = 0; w < a.length; w++) r[w] = a[w]! | b[w]!;
    setVar(r, x, DC);
    return r;
  }
  if (a) return withVar(a, x, getVar(a, x) & ONE);
  if (b) return withVar(b, x, getVar(b, x) & ZERO);
  return null;
}

/** The complement of a cover with a don't-care set: the off-set R = ¬(F ∪ D). */
export function offSet(F: Cover, dc?: Cover): Cover {
  return { n: F.n, cubes: complement([...F.cubes, ...(dc?.cubes ?? [])], F.n) };
}

/** True if the two cubes lists are disjoint everywhere (no minterm in both). */
export function disjointCovers(A: Cube[], B: Cube[], n: number): boolean {
  for (const a of A) for (const b of B) if (intersects(a, b, n)) return false;
  return true;
}

