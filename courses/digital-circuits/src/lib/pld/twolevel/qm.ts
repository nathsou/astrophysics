/**
 * Exact two-level minimisation: Quine–McCluskey prime implicant generation, the prime implicant
 * chart (essential primes, row and column dominance) and Petrick's method for the cyclic core.
 *
 * Besides the minimal cover, `quineMcCluskey` returns a trace that Chapter 12 animates step by
 * step. The trace is plain data (numbers, strings and arrays), so it can be serialised as JSON.
 *
 * Implicants are (value, mask) pairs over minterm indices: bits set in `mask` are don't-care
 * positions, and `value` has zeros there. Variable i is bit (n − 1 − i), as everywhere in
 * `twolevel` (variable 0 is the most significant bit).
 */
import { DC, ONE, ZERO, setVar, universe, type Cover, type Cube } from './cube';

export interface QmImplicant {
  id: number;
  value: number;
  mask: number;
  /** One character per variable: '0', '1' or '-'. */
  pattern: string;
  /** Minterms covered (on-set and don't-care), ascending. */
  minterms: number[];
  /** Number of ones in the pattern (the group it belongs to). */
  ones: number;
  /** Merge round that produced it (0 for the minterms themselves). */
  round: number;
  /** Number of literals. */
  literals: number;
  /** True if it covers only don't-care minterms. */
  onlyDontCares: boolean;
}

export interface QmMerge {
  a: number;
  b: number;
  result: number;
  /** True if `result` had already been produced by an earlier pair in this round. */
  duplicate: boolean;
}

export interface QmRound {
  round: number;
  /** The implicants of this column, grouped by number of ones (only non-empty groups). */
  groups: { ones: number; ids: number[] }[];
  /** Pairs from adjacent groups that differ in one bit, merged into the next column. */
  merges: QmMerge[];
  /** Implicants of this column that took part in no merge: prime implicants. */
  primes: number[];
}

export type QmChartStep =
  | {
      kind: 'essential';
      prime: number;
      /** Minterms covered by this prime alone (why it is essential). */
      because: number[];
      /** Remaining columns it covers, which are now removed. */
      covers: number[];
    }
  | { kind: 'row-dominance'; removed: number; by: number }
  | { kind: 'column-dominance'; removed: number; by: number }
  | { kind: 'cyclic-core'; rows: number[]; cols: number[] };

export interface QmPetrickStep {
  /** The column (minterm) whose sum was multiplied in. */
  minterm: number;
  sum: number[];
  /** Number of products after multiplication and absorption. */
  count: number;
  /** The products (sets of prime ids), if there are at most `traceLimit` of them. */
  products: number[][] | null;
}

export interface QmPetrick {
  rows: number[];
  cols: number[];
  /** One sum per column: the primes that cover it. */
  sums: { minterm: number; primes: number[] }[];
  steps: QmPetrickStep[];
  /** Products with the fewest primes (up to 32 of them), cheapest in literals first. */
  minimal: number[][];
  chosen: number[];
  /**
   * Set if the expansion exceeded `petrickLimit`; the core was then solved by branch and bound
   * ('branch-and-bound', still exact) or, if that ran out of its node budget too, the best cover
   * it had found ('incomplete', not guaranteed minimal).
   */
  aborted?: boolean;
  method: 'petrick' | 'branch-and-bound' | 'incomplete';
}

export interface QmTrace {
  n: number;
  names: string[];
  on: number[];
  dc: number[];
  implicants: QmImplicant[];
  rounds: QmRound[];
  primes: number[];
  /** The prime implicant chart: rows are primes covering some on-set minterm, columns the on-set. */
  chart: { rows: number[]; cols: number[] };
  steps: QmChartStep[];
  petrick?: QmPetrick;
  /** Essential primes, in order of selection. */
  essential: number[];
  /** The primes of the final cover. */
  solution: number[];
}

export interface QmOptions {
  names?: string[];
  /** Apply row and column dominance between essential-prime rounds (default true). */
  dominance?: boolean;
  /** Abort Petrick's expansion beyond this many products (default 2,000). */
  petrickLimit?: number;
  /** Record Petrick products in the trace up to this many per step (default 256). */
  traceLimit?: number;
  /** Refuse functions with more variables than this (default 16). */
  maxVars?: number;
}

export interface QmResult {
  cover: Cover;
  primes: Cover;
  trace: QmTrace;
  /** True if the cover is guaranteed minimal (fewest terms, then fewest literals among those). */
  exact: boolean;
}

function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

export function implicantPattern(value: number, mask: number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const b = 1 << (n - 1 - i);
    s += mask & b ? '-' : value & b ? '1' : '0';
  }
  return s;
}

export function implicantCube(value: number, mask: number, n: number): Cube {
  const c = universe(n);
  for (let i = 0; i < n; i++) {
    const b = 1 << (n - 1 - i);
    setVar(c, i, mask & b ? DC : value & b ? ONE : ZERO);
  }
  return c;
}

/** The product term of an implicant as text, e.g. "A·B̄" style with a chosen NOT marker. */
export function implicantText(imp: { value: number; mask: number }, n: number, names: string[], not = '!', and = ' & '): string {
  const lits: string[] = [];
  for (let i = 0; i < n; i++) {
    const b = 1 << (n - 1 - i);
    if (imp.mask & b) continue;
    lits.push(imp.value & b ? names[i]! : not + names[i]!);
  }
  return lits.length ? lits.join(and) : '1';
}

function mintermsOf(value: number, mask: number): number[] {
  let ms = [value];
  for (let b = 1; b <= mask; b <<= 1) if (mask & b) ms = ms.flatMap((m) => [m, m | b]);
  return ms.sort((a, b) => a - b);
}

function defaultNames(n: number): string[] {
  return Array.from({ length: n }, (_, i) => (n <= 26 ? String.fromCharCode(65 + i) : `x${i}`));
}

/** Exact minimisation of a single-output function given by minterm lists. */
export function quineMcCluskey(n: number, on: number[], dc: number[] = [], opts: QmOptions = {}): QmResult {
  const maxVars = opts.maxVars ?? 16;
  if (n > maxVars) throw new Error(`Quine–McCluskey is limited to ${maxVars} variables (got ${n}); use Espresso`);
  const size = 2 ** n;
  const onSet = [...new Set(on)].sort((a, b) => a - b);
  const onLookup = new Set(onSet);
  const dcSet = [...new Set(dc)].filter((m) => !onLookup.has(m)).sort((a, b) => a - b);
  for (const m of [...onSet, ...dcSet]) if (!(m >= 0 && m < size && Number.isInteger(m))) throw new Error(`Minterm ${m} is out of range for ${n} variables`);
  const names = opts.names ?? defaultNames(n);
  const dominance = opts.dominance ?? true;
  const petrickLimit = opts.petrickLimit ?? 2000;
  const traceLimit = opts.traceLimit ?? 256;

  const implicants: QmImplicant[] = [];
  const byKey = new Map<string, number>();
  const make = (value: number, mask: number, round: number): { id: number; fresh: boolean } => {
    const key = `${value}/${mask}`;
    const found = byKey.get(key);
    if (found !== undefined) return { id: found, fresh: false };
    const minterms = mintermsOf(value, mask);
    const imp: QmImplicant = {
      id: implicants.length,
      value,
      mask,
      pattern: implicantPattern(value, mask, n),
      minterms,
      ones: popcount(value),
      round,
      literals: n - popcount(mask),
      onlyDontCares: !minterms.some((m) => onLookup.has(m)),
    };
    implicants.push(imp);
    byKey.set(key, imp.id);
    return { id: imp.id, fresh: true };
  };

  // --- Prime implicant generation -----------------------------------------------------------
  const rounds: QmRound[] = [];
  let column = [...onSet, ...dcSet].sort((a, b) => a - b).map((m) => make(m, 0, 0).id);
  const primes: number[] = [];
  for (let r = 0; column.length > 0; r++) {
    const groupMap = new Map<number, number[]>();
    for (const id of column) {
      const k = implicants[id]!.ones;
      if (!groupMap.has(k)) groupMap.set(k, []);
      groupMap.get(k)!.push(id);
    }
    const groups = [...groupMap.entries()].sort((a, b) => a[0] - b[0]).map(([ones, ids]) => ({ ones, ids }));
    const merges: QmMerge[] = [];
    const used = new Set<number>();
    const next: number[] = [];
    for (let g = 0; g + 1 < groups.length; g++) {
      const lo = groups[g]!;
      const hi = groups[g + 1]!;
      if (hi.ones !== lo.ones + 1) continue;
      for (const a of lo.ids)
        for (const b of hi.ids) {
          const A = implicants[a]!;
          const B = implicants[b]!;
          if (A.mask !== B.mask) continue;
          const diff = A.value ^ B.value;
          if (popcount(diff) !== 1 || (B.value & diff) === 0) continue;
          const { id, fresh } = make(A.value, A.mask | diff, r + 1);
          merges.push({ a, b, result: id, duplicate: !fresh });
          used.add(a);
          used.add(b);
          if (fresh) next.push(id);
        }
    }
    const roundPrimes = column.filter((id) => !used.has(id));
    primes.push(...roundPrimes);
    rounds.push({ round: r, groups, merges, primes: roundPrimes });
    column = next;
  }

  // --- Prime implicant chart ----------------------------------------------------------------
  const chartRows = primes.filter((p) => !implicants[p]!.onlyDontCares);
  const chartCols = onSet.slice();
  const covers = (p: number, m: number) => {
    const imp = implicants[p]!;
    return (m & ~imp.mask) === imp.value;
  };
  const rows = new Set(chartRows);
  const cols = new Set(chartCols);
  const steps: QmChartStep[] = [];
  const essential: number[] = [];
  const selected: number[] = [];

  const rowCols = (p: number) => [...cols].filter((m) => covers(p, m));
  const colRows = (m: number) => [...rows].filter((p) => covers(p, m));
  const cost = (p: number) => implicants[p]!.literals;

  let changed = true;
  while (changed && cols.size > 0) {
    changed = false;
    // Essential primes: a column covered by exactly one row.
    const found = new Map<number, number[]>();
    for (const m of [...cols].sort((a, b) => a - b)) {
      const rs = colRows(m);
      if (rs.length === 1) {
        const p = rs[0]!;
        if (!found.has(p)) found.set(p, []);
        found.get(p)!.push(m);
      }
    }
    for (const [p, because] of found) {
      if (!rows.has(p)) continue;
      const covered = rowCols(p);
      steps.push({ kind: 'essential', prime: p, because, covers: covered });
      essential.push(p);
      selected.push(p);
      rows.delete(p);
      for (const m of covered) cols.delete(m);
      changed = true;
    }
    if (changed || !dominance || cols.size === 0) continue;
    // Rows that cover nothing any more.
    for (const p of [...rows]) if (rowCols(p).length === 0) rows.delete(p);
    // Column dominance: if every row covering column a also covers column b, then covering a
    // covers b, so b can be removed... in the chart sense: a column whose row set is a superset
    // of another's is removed (the smaller one is harder to cover and implies it).
    const colList = [...cols].sort((a, b) => a - b);
    for (const a of colList) {
      if (!cols.has(a)) continue;
      const ra = colRows(a);
      for (const b of colList) {
        if (a === b || !cols.has(b)) continue;
        const rb = colRows(b);
        if (rb.length < ra.length || (rb.length === ra.length && b < a)) continue;
        if (ra.every((p) => rb.includes(p))) {
          // rows(a) ⊆ rows(b): any row covering a also covers b; drop b.
          cols.delete(b);
          steps.push({ kind: 'column-dominance', removed: b, by: a });
          changed = true;
        }
      }
    }
    // Row dominance: a row whose columns are a subset of another row's, at no lower cost.
    const rowList = [...rows].sort((a, b) => a - b);
    for (const p of rowList) {
      if (!rows.has(p)) continue;
      const cp = rowCols(p);
      for (const q of rowList) {
        if (p === q || !rows.has(q) || !rows.has(p)) continue;
        const cq = rowCols(q);
        if (cq.length < cp.length || cost(q) > cost(p)) continue;
        if (cq.length === cp.length && cost(q) === cost(p) && q > p) continue; // keep the first of equals
        if (cp.every((m) => cq.includes(m))) {
          rows.delete(p);
          steps.push({ kind: 'row-dominance', removed: p, by: q });
          changed = true;
        }
      }
    }
  }

  let petrick: QmPetrick | undefined;
  let exact = true;
  if (cols.size > 0) {
    const coreRows = [...rows].filter((p) => rowCols(p).length > 0).sort((a, b) => a - b);
    const coreCols = [...cols].sort((a, b) => a - b);
    steps.push({ kind: 'cyclic-core', rows: coreRows, cols: coreCols });
    petrick = solvePetrick(coreRows, coreCols, covers, cost, petrickLimit, traceLimit);
    if (petrick.method === 'incomplete') exact = false;
    selected.push(...petrick.chosen);
  }

  const solution = selected.slice();
  const cubes = solution.map((p) => implicantCube(implicants[p]!.value, implicants[p]!.mask, n));
  const trace: QmTrace = {
    n,
    names,
    on: onSet,
    dc: dcSet,
    implicants,
    rounds,
    primes: primes.slice().sort((a, b) => a - b),
    chart: { rows: chartRows.slice().sort((a, b) => a - b), cols: chartCols },
    steps,
    petrick,
    essential,
    solution,
  };
  return {
    cover: { n, cubes },
    primes: { n, cubes: trace.primes.map((p) => implicantCube(implicants[p]!.value, implicants[p]!.mask, n)) },
    trace,
    exact,
  };
}

function solvePetrick(
  rows: number[],
  cols: number[],
  covers: (p: number, m: number) => boolean,
  cost: (p: number) => number,
  limit: number,
  traceLimit: number,
): QmPetrick {
  const index = new Map(rows.map((p, i) => [p, i]));
  const sums = cols.map((m) => ({ minterm: m, primes: rows.filter((p) => covers(p, m)) }));
  const toIds = (s: bigint) => {
    const out: number[] = [];
    for (let i = 0; i < rows.length; i++) if ((s >> BigInt(i)) & 1n) out.push(rows[i]!);
    return out;
  };
  const steps: QmPetrickStep[] = [];
  let products: bigint[] = [0n];
  let aborted = false;
  for (const { minterm, primes } of sums) {
    const next = new Set<bigint>();
    for (const p of products) {
      for (const r of primes) next.add(p | (1n << BigInt(index.get(r)!)));
    }
    products = absorb([...next]);
    steps.push({
      minterm,
      sum: primes,
      count: products.length,
      products: products.length <= traceLimit ? products.map(toIds) : null,
    });
    if (products.length > limit) {
      aborted = true;
      break;
    }
  }
  const setCost = (ids: number[]) => ({ terms: ids.length, lits: ids.reduce((s, p) => s + cost(p), 0) });
  if (!aborted) {
    const all = products.map(toIds).map((ids) => ({ ids, ...setCost(ids) }));
    all.sort((a, b) => a.terms - b.terms || a.lits - b.lits || cmpIds(a.ids, b.ids));
    const fewest = all[0]!.terms;
    const minimal = all.filter((x) => x.terms === fewest).slice(0, 32).map((x) => x.ids);
    return { rows, cols, sums, steps, minimal, chosen: minimal[0]!, method: 'petrick' };
  }
  // Branch and bound on the covering problem (exact, with a node budget).
  const bb = branchAndBound(rows, cols, covers, cost, 200_000);
  return {
    rows,
    cols,
    sums,
    steps,
    minimal: [bb.best],
    chosen: bb.best,
    aborted: true,
    method: bb.complete ? 'branch-and-bound' : 'incomplete',
  };
}

function cmpIds(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}

/** Remove duplicates and every product that contains another (x + xy = x). */
function absorb(ps: bigint[]): bigint[] {
  const bits = (x: bigint) => {
    let c = 0;
    while (x) {
      x &= x - 1n;
      c++;
    }
    return c;
  };
  const sorted = [...new Set(ps)].map((p) => ({ p, k: bits(p) })).sort((a, b) => a.k - b.k || (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));
  const kept: bigint[] = [];
  for (const { p } of sorted) if (!kept.some((q) => (q & p) === q)) kept.push(p);
  return kept;
}

function branchAndBound(
  rows: number[],
  cols: number[],
  covers: (p: number, m: number) => boolean,
  cost: (p: number) => number,
  budget: number,
): { best: number[]; complete: boolean } {
  const R = rows.length;
  const C = cols.length;
  const rowCols = rows.map((p) => cols.map((m, i) => (covers(p, m) ? i : -1)).filter((i) => i >= 0));
  const colRows = cols.map((m) => rows.map((p, r) => (covers(p, m) ? r : -1)).filter((r) => r >= 0));
  const rowCost = rows.map(cost);
  // Greedy initial solution.
  const covered = new Int32Array(C);
  const greedy: number[] = [];
  let left = C;
  while (left > 0) {
    let bestRow = -1;
    let bestGain = 0;
    for (let r = 0; r < R; r++) {
      let g = 0;
      for (const i of rowCols[r]!) if (!covered[i]) g++;
      if (g > bestGain || (g === bestGain && g > 0 && rowCost[r]! < rowCost[bestRow]!)) {
        bestGain = g;
        bestRow = r;
      }
    }
    greedy.push(bestRow);
    for (const i of rowCols[bestRow]!) if (!covered[i]!++) left--;
  }
  covered.fill(0);
  let best = greedy.slice();
  let bestTerms = greedy.length;
  let bestLits = greedy.reduce((s, r) => s + rowCost[r]!, 0);
  let nodes = 0;
  let complete = true;
  const chosen: number[] = [];
  // Lower bound: a set of uncovered columns no two of which share a row needs that many rows.
  const colOrder = cols.map((_, i) => i).sort((a, b) => colRows[a]!.length - colRows[b]!.length);
  const lowerBound = () => {
    const blocked = new Uint8Array(R);
    let lb = 0;
    for (const i of colOrder) {
      if (covered[i]) continue;
      if (colRows[i]!.some((r) => blocked[r])) continue;
      lb++;
      for (const r of colRows[i]!) blocked[r] = 1;
    }
    return lb;
  };
  const recurse = (lits: number) => {
    if (++nodes > budget) {
      complete = false;
      return;
    }
    let pick = -1;
    let fewest = Infinity;
    for (let i = 0; i < C; i++) {
      if (covered[i]) continue;
      const k = colRows[i]!.length;
      if (k < fewest) {
        fewest = k;
        pick = i;
      }
    }
    if (pick < 0) {
      if (chosen.length < bestTerms || (chosen.length === bestTerms && lits < bestLits)) {
        best = chosen.slice();
        bestTerms = chosen.length;
        bestLits = lits;
      }
      return;
    }
    if (chosen.length + lowerBound() > bestTerms) return;
    const gain = (r: number) => rowCols[r]!.reduce((g, i) => g + (covered[i] ? 0 : 1), 0);
    const branches = colRows[pick]!.slice().sort((a, b) => gain(b) - gain(a) || rowCost[a]! - rowCost[b]!);
    for (const r of branches) {
      chosen.push(r);
      for (const i of rowCols[r]!) covered[i]!++;
      recurse(lits + rowCost[r]!);
      for (const i of rowCols[r]!) covered[i]!--;
      chosen.pop();
      if (!complete) return;
    }
  };
  recurse(0);
  return { best: best.map((r) => rows[r]!).sort((a, b) => a - b), complete };
}

/** Convenience: minimise a cover given as minterm lists and return the cubes only. */
export function qmCover(n: number, on: number[], dc: number[] = []): Cover {
  return quineMcCluskey(n, on, dc).cover;
}
