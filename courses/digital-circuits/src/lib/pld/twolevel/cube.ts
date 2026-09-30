/**
 * Cubes and covers in positional cube notation, packed bit-parallel.
 *
 * A cube over n Boolean variables is a product term. Each variable takes two bits:
 *
 *   01 (ZERO)  the literal x̄ (the variable must be 0)
 *   10 (ONE)   the literal x  (the variable must be 1)
 *   11 (DC)    the variable does not appear (don't care)
 *   00 (VOID)  no value is allowed: the cube is empty
 *
 * Bit 0 of a field means "0 is allowed", bit 1 means "1 is allowed", so intersection is a bitwise
 * AND, the smallest cube containing two cubes (their supercube) is a bitwise OR, and containment is
 * `(b & ~a) == 0`. Sixteen variables are packed into each 32-bit word of a `Uint32Array`, so the
 * usual operations touch one or two words for the functions of this course. Bits beyond the last
 * variable are always zero.
 *
 * Minterm numbering: in a minterm index m, variable i is bit (n − 1 − i). Variable 0 is the most
 * significant bit, as in the truth tables and Karnaugh maps of the text (A is the leftmost column).
 *
 * A cover is a list of cubes over the same variables: the sum (OR) of its product terms.
 */

export type Cube = Uint32Array;

/** A sum of products over `n` variables. */
export interface Cover {
  n: number;
  cubes: Cube[];
}

export const VOID = 0;
export const ZERO = 1;
export const ONE = 2;
export const DC = 3;

export const VARS_PER_WORD = 16;

export function wordCount(n: number): number {
  return Math.max(1, Math.ceil(n / VARS_PER_WORD));
}

const lowCache = new Map<number, Uint32Array>();
const fullCache = new Map<number, Uint32Array>();

/** Per word, the low bit of every valid variable field (0x5555… trimmed to n). Do not mutate. */
export function lowMask(n: number): Uint32Array {
  let m = lowCache.get(n);
  if (!m) {
    const w = wordCount(n);
    m = new Uint32Array(w);
    for (let i = 0; i < w; i++) {
      const k = Math.min(VARS_PER_WORD, n - i * VARS_PER_WORD);
      m[i] = k >= 16 ? 0x55555555 : k <= 0 ? 0 : ((1 << (2 * k)) - 1) & 0x55555555;
    }
    lowCache.set(n, m);
  }
  return m;
}

/** Per word, both bits of every valid variable field. Do not mutate. */
export function fullMask(n: number): Uint32Array {
  let m = fullCache.get(n);
  if (!m) {
    const low = lowMask(n);
    m = new Uint32Array(low.length);
    for (let i = 0; i < low.length; i++) m[i] = (low[i]! | (low[i]! << 1)) >>> 0;
    fullCache.set(n, m);
  }
  return m;
}

export function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

/** The cube with no literals (the constant 1). */
export function universe(n: number): Cube {
  return fullMask(n).slice();
}

export function getVar(c: Cube, i: number): number {
  return (c[i >>> 4]! >>> ((i & 15) * 2)) & 3;
}

/** Set variable i of c in place to a field value (ZERO, ONE, DC or VOID). */
export function setVar(c: Cube, i: number, v: number): void {
  const w = i >>> 4;
  const s = (i & 15) * 2;
  c[w] = ((c[w]! & ~(3 << s)) | (v << s)) >>> 0;
}

/** A copy of c with variable i set to v. */
export function withVar(c: Cube, i: number, v: number): Cube {
  const r = c.slice();
  setVar(r, i, v);
  return r;
}

/** True if some variable of c allows no value. */
export function isVoid(c: Cube, n: number): boolean {
  const low = lowMask(n);
  for (let w = 0; w < low.length; w++) {
    const x = c[w]!;
    if (((x | (x >>> 1)) & low[w]!) !== low[w]) return true;
  }
  return false;
}

export function isUniversal(c: Cube, n: number): boolean {
  const full = fullMask(n);
  for (let w = 0; w < full.length; w++) if (c[w] !== full[w]) return false;
  return true;
}

export function intersect(a: Cube, b: Cube): Cube {
  const r = new Uint32Array(a.length);
  for (let w = 0; w < a.length; w++) r[w] = a[w]! & b[w]!;
  return r;
}

/** a ∩ b, or null when the cubes are disjoint. */
export function intersectOrNull(a: Cube, b: Cube, n: number): Cube | null {
  const r = intersect(a, b);
  return isVoid(r, n) ? null : r;
}

/** True if a and b share at least one minterm. */
export function intersects(a: Cube, b: Cube, n: number): boolean {
  const low = lowMask(n);
  for (let w = 0; w < low.length; w++) {
    const x = a[w]! & b[w]!;
    if (((x | (x >>> 1)) & low[w]!) !== low[w]) return false;
  }
  return true;
}

/** The smallest cube containing a and b. */
export function supercube(a: Cube, b: Cube): Cube {
  const r = new Uint32Array(a.length);
  for (let w = 0; w < a.length; w++) r[w] = a[w]! | b[w]!;
  return r;
}

/** True if a ⊇ b (every minterm of b is in a). */
export function contains(a: Cube, b: Cube): boolean {
  for (let w = 0; w < a.length; w++) if ((b[w]! & ~a[w]!) !== 0) return false;
  return true;
}

export function equalCubes(a: Cube, b: Cube): boolean {
  for (let w = 0; w < a.length; w++) if (a[w] !== b[w]) return false;
  return true;
}

/** Number of variables in which a and b conflict (0 means they intersect). */
export function distance(a: Cube, b: Cube, n: number): number {
  const low = lowMask(n);
  let d = 0;
  for (let w = 0; w < low.length; w++) {
    const x = a[w]! & b[w]!;
    d += popcount(~(x | (x >>> 1)) & low[w]!);
  }
  return d;
}

/** Number of literals (variables that are 0 or 1, not don't care). */
export function literalCount(c: Cube, n: number): number {
  const low = lowMask(n);
  let k = 0;
  for (let w = 0; w < low.length; w++) {
    const x = c[w]!;
    k += popcount((x ^ (x >>> 1)) & low[w]!);
  }
  return k;
}

/** Number of minterms in a non-void cube: 2^(number of don't-care variables). */
export function mintermCount(c: Cube, n: number): number {
  return 2 ** (n - literalCount(c, n));
}

/** Indices of the variables that appear as literals in c. */
export function literalVars(c: Cube, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = getVar(c, i);
    if (v === ZERO || v === ONE) out.push(i);
  }
  return out;
}

/**
 * The cofactor of cube c with respect to cube p: null if they are disjoint, otherwise c with every
 * variable that is a literal in p made don't care.
 */
export function cofactorCube(c: Cube, p: Cube, n: number): Cube | null {
  if (!intersects(c, p, n)) return null;
  const full = fullMask(n);
  const r = new Uint32Array(c.length);
  for (let w = 0; w < c.length; w++) r[w] = (c[w]! | (full[w]! ^ p[w]!)) >>> 0;
  return r;
}

/** The cube of a single minterm. */
export function mintermCube(m: number, n: number): Cube {
  const c = new Uint32Array(wordCount(n));
  for (let i = 0; i < n; i++) setVar(c, i, (m >>> (n - 1 - i)) & 1 ? ONE : ZERO);
  return c;
}

/** True if minterm m lies in cube c. */
export function cubeHasMinterm(c: Cube, m: number, n: number): boolean {
  for (let i = 0; i < n; i++) {
    const bit = (m >>> (n - 1 - i)) & 1;
    if (!(getVar(c, i) & (bit ? ONE : ZERO))) return false;
  }
  return true;
}

/** True if the assignment (values[i] for variable i) lies in cube c. */
export function cubeHasPoint(c: Cube, values: ArrayLike<number>, n: number): boolean {
  for (let i = 0; i < n; i++) if (!(getVar(c, i) & (values[i] ? ONE : ZERO))) return false;
  return true;
}

/** The minterms of a cube, ascending (small n only). */
export function cubeMinterms(c: Cube, n: number): number[] {
  let ms = [0];
  for (let i = 0; i < n; i++) {
    const v = getVar(c, i);
    const bit = 1 << (n - 1 - i);
    if (v === ONE) ms = ms.map((m) => m | bit);
    else if (v === DC) ms = ms.flatMap((m) => [m, m | bit]);
    else if (v === VOID) return [];
  }
  return ms.sort((a, b) => a - b);
}

/** Cube from a string with one character per variable: '0', '1' or '-' (also 'x', 'X', '2'). */
export function cubeFromString(s: string): Cube {
  const n = s.length;
  const c = universe(n);
  for (let i = 0; i < n; i++) {
    const ch = s[i]!;
    if (ch === '0') setVar(c, i, ZERO);
    else if (ch === '1') setVar(c, i, ONE);
    else if (ch === '-' || ch === 'x' || ch === 'X' || ch === '2') setVar(c, i, DC);
    else if (ch === '~' || ch === '∅') setVar(c, i, VOID);
    else throw new Error(`Bad cube character '${ch}' in "${s}"`);
  }
  return c;
}

export function cubeToString(c: Cube, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += '~01-'[getVar(c, i)]!;
  return s;
}

/** A string key for hashing cubes of the same width. */
export function cubeKey(c: Cube): string {
  return c.length === 1 ? String(c[0]) : Array.from(c).join(',');
}

// ---------------------------------------------------------------------------------------------
// Covers

export function cover(n: number, cubes: Cube[] = []): Cover {
  return { n, cubes };
}

export function coverFromStrings(strings: string[], n?: number): Cover {
  const width = n ?? strings[0]?.length ?? 0;
  return { n: width, cubes: strings.map((s) => {
    if (s.length !== width) throw new Error(`Cube "${s}" does not have ${width} variables`);
    return cubeFromString(s);
  }) };
}

export function coverToStrings(F: Cover): string[] {
  return F.cubes.map((c) => cubeToString(c, F.n));
}

export function coverFromMinterms(n: number, minterms: Iterable<number>): Cover {
  return { n, cubes: [...minterms].map((m) => mintermCube(m, n)) };
}

/** The on-set minterms of a cover, ascending (small n only). */
export function coverMinterms(F: Cover): number[] {
  const seen = new Uint8Array(2 ** F.n);
  for (const c of F.cubes) for (const m of cubeMinterms(c, F.n)) seen[m] = 1;
  const out: number[] = [];
  for (let m = 0; m < seen.length; m++) if (seen[m]) out.push(m);
  return out;
}

/** Evaluate a cover at minterm m. */
export function evalCover(F: Cover, m: number): boolean {
  for (const c of F.cubes) if (cubeHasMinterm(c, m, F.n)) return true;
  return false;
}

/** Evaluate a cover at an assignment given variable by variable. */
export function evalCoverAt(F: Cover, values: ArrayLike<number>): boolean {
  for (const c of F.cubes) if (cubeHasPoint(c, values, F.n)) return true;
  return false;
}

/** Truth table of a cover as a bit per minterm (small n only). */
export function coverTruthTable(F: Cover): Uint8Array {
  const t = new Uint8Array(2 ** F.n);
  for (const c of F.cubes) for (const m of cubeMinterms(c, F.n)) t[m] = 1;
  return t;
}

/**
 * Single-cube containment: drop void cubes, duplicates and cubes contained in another cube.
 * Keeps the first occurrence order otherwise.
 */
export function scc(cubes: Cube[], n: number): Cube[] {
  const live = cubes.filter((c) => !isVoid(c, n));
  // Larger cubes first, so each cube only needs to be tested against those kept before it.
  const order = live.map((c, i) => ({ c, i, k: literalCount(c, n) })).sort((a, b) => a.k - b.k || a.i - b.i);
  const kept: { c: Cube; i: number }[] = [];
  for (const e of order) {
    if (!kept.some((k) => contains(k.c, e.c))) kept.push(e);
  }
  return kept.sort((a, b) => a.i - b.i).map((e) => e.c);
}

export function coverUnion(a: Cover, b: Cover): Cover {
  return { n: a.n, cubes: scc([...a.cubes, ...b.cubes], a.n) };
}

/** AND of two covers (pairwise intersections). */
export function coverProduct(a: Cover, b: Cover): Cover {
  const out: Cube[] = [];
  for (const x of a.cubes)
    for (const y of b.cubes) {
      const z = intersectOrNull(x, y, a.n);
      if (z) out.push(z);
    }
  return { n: a.n, cubes: scc(out, a.n) };
}

export interface CoverCost {
  cubes: number;
  literals: number;
}

export function coverCost(F: Cover): CoverCost {
  let literals = 0;
  for (const c of F.cubes) literals += literalCount(c, F.n);
  return { cubes: F.cubes.length, literals };
}

/** Compare costs: fewer cubes first, then fewer literals. Negative if a is cheaper. */
export function compareCost(a: CoverCost, b: CoverCost): number {
  return a.cubes - b.cubes || a.literals - b.literals;
}

/** Variables that appear as a literal in some cube of the covers. */
export function supportOf(n: number, ...covers: Cube[][]): number[] {
  const used = new Uint8Array(n);
  for (const cubes of covers)
    for (const c of cubes)
      for (let i = 0; i < n; i++) {
        const v = getVar(c, i);
        if (v === ZERO || v === ONE) used[i] = 1;
      }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (used[i]) out.push(i);
  return out;
}

/** Project cubes onto a subset of variables (vars[j] becomes variable j). */
export function projectCubes(cubes: Cube[], vars: number[]): Cube[] {
  const k = vars.length;
  return cubes.map((c) => {
    const r = universe(k);
    vars.forEach((v, j) => setVar(r, j, getVar(c, v)));
    return r;
  });
}

/** Inverse of projectCubes: variable j of each cube becomes variable vars[j] of an n-variable cube. */
export function embedCubes(cubes: Cube[], vars: number[], n: number): Cube[] {
  return cubes.map((c) => {
    const r = universe(n);
    vars.forEach((v, j) => setVar(r, v, getVar(c, j)));
    return r;
  });
}

/** Map cubes to a new variable space: variable i of each cube becomes variable map[i] (or is dropped if map[i] < 0 and don't care). */
export function remapCubes(cubes: Cube[], map: number[], n: number): Cube[] {
  return cubes.map((c) => {
    const r = universe(n);
    map.forEach((to, from) => {
      const v = getVar(c, from);
      if (to < 0) {
        if (v !== DC) throw new Error(`Variable ${from} is used but has no place in the new space`);
      } else setVar(r, to, getVar(r, to) & v);
    });
    return r;
  });
}
