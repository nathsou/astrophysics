/**
 * The arithmetic decision procedure of the SMT solver: the general simplex of Dutertre and de Moura (2006), as in
 * Yices and Z3. Every linear form the problem mentions gets a variable; a tableau keeps the basic variables as
 * linear combinations of the non-basic ones; literals only tighten bounds, so backtracking is cheap (restore the
 * bounds, keep the tableau and the assignment).
 *
 * When a basic variable cannot be brought within its bounds, the row explains why: its bound and the bounds of the
 * non-basic variables of the row, with the row's coefficients as Farkas multipliers. That explanation is the
 * certificate the trusted checker re-checks.
 *
 * Arithmetic is exact (BigInt rationals). Pivoting follows Bland's rule, so it terminates.
 */
import { Q } from '../logic/rational';

export interface Bound {
  value: Q;
  /** The literal (DIMACS) that set it. */
  reason: number;
}

export interface Explanation {
  /**
   * Literals responsible, with signed Farkas multipliers μ: each literal's constraint is `form ≤ k` (μ ≥ 0),
   * `form ≥ k` (μ ≤ 0) or `form = k` (any μ), and Σ μ·(form − k) has every term cancel and a positive constant —
   * which is absurd, since each summand is ≤ 0.
   */
  lits: { lit: number; coeff: Q }[];
}

interface Undo {
  v: number;
  side: 'lo' | 'hi';
  old: Bound | undefined;
}

export class Simplex {
  /** Assignment of every variable. */
  value: Q[] = [];
  lo: (Bound | undefined)[] = [];
  hi: (Bound | undefined)[] = [];
  /** rows.get(b) = coefficients of the non-basic variables defining basic variable b. */
  rows = new Map<number, Map<number, Q>>();
  /** For each non-basic variable, the basic variables whose rows mention it. */
  private cols: Set<number>[] = [];
  private undo: Undo[] = [];
  pivots = 0;

  newVar(): number {
    const v = this.value.length;
    this.value.push(Q.ZERO);
    this.lo.push(undefined);
    this.hi.push(undefined);
    this.cols.push(new Set());
    return v;
  }

  /** A new variable s defined as Σ coeffs (over existing variables); returns s. */
  define(coeffs: [number, Q][]): number {
    const s = this.newVar();
    const row = new Map<number, Q>();
    for (const [x, c] of coeffs) {
      const r = this.rows.get(x);
      if (r) for (const [y, d] of r) addTo(row, y, c.mul(d));
      else addTo(row, x, c);
    }
    let val = Q.ZERO;
    for (const [y, c] of row) {
      val = val.add(c.mul(this.value[y]!));
      this.cols[y]!.add(s);
    }
    this.value[s] = val;
    this.rows.set(s, row);
    return s;
  }

  /** The current position of the undo log (to return to with `undoTo`). */
  mark(): number {
    return this.undo.length;
  }

  undoTo(m: number): void {
    while (this.undo.length > m) {
      const u = this.undo.pop()!;
      (u.side === 'lo' ? this.lo : this.hi)[u.v] = u.old;
    }
  }

  /** Assert v ≥ k (side 'lo') or v ≤ k ('hi'). Returns a conflict explanation if the bounds cross. */
  assertBound(v: number, side: 'lo' | 'hi', k: Q, reason: number): Explanation | null {
    const lo = this.lo[v];
    const hi = this.hi[v];
    if (side === 'lo') {
      if (lo && lo.value.cmp(k) >= 0) return null;
      if (hi && hi.value.lt(k)) return { lits: merge([{ lit: reason, coeff: Q.ONE.neg() }, { lit: hi.reason, coeff: Q.ONE }]) };
      this.undo.push({ v, side, old: lo });
      this.lo[v] = { value: k, reason };
      if (!this.rows.has(v) && this.value[v]!.lt(k)) this.update(v, k);
    } else {
      if (hi && hi.value.cmp(k) <= 0) return null;
      if (lo && k.lt(lo.value)) return { lits: merge([{ lit: reason, coeff: Q.ONE }, { lit: lo.reason, coeff: Q.ONE.neg() }]) };
      this.undo.push({ v, side, old: hi });
      this.hi[v] = { value: k, reason };
      if (!this.rows.has(v) && k.lt(this.value[v]!)) this.update(v, k);
    }
    return null;
  }

  /** Set a non-basic variable's value and update the basic variables that depend on it. */
  private update(x: number, k: Q): void {
    const delta = k.sub(this.value[x]!);
    for (const b of this.cols[x]!) {
      const c = this.rows.get(b)!.get(x)!;
      this.value[b] = this.value[b]!.add(c.mul(delta));
    }
    this.value[x] = k;
  }

  /** Restore feasibility. Returns null (feasible) or the explanation of infeasibility. */
  check(maxPivots = 100000): Explanation | null | 'gave-up' {
    for (let n = 0; n < maxPivots; n++) {
      // Bland: the lowest-numbered basic variable out of bounds.
      let b = -1;
      for (const v of this.rows.keys()) {
        if ((b < 0 || v < b) && this.violates(v)) b = v;
      }
      if (b < 0) return null;
      const row = this.rows.get(b)!;
      const val = this.value[b]!;
      const lo = this.lo[b];
      const hi = this.hi[b];
      const increase = !!lo && val.lt(lo.value);
      // Find the lowest-numbered non-basic variable that can move b in the right direction.
      let x = -1;
      for (const [y, c] of row) {
        const up = increase === c.sign() > 0; // need y to increase
        const ok = up ? !this.hi[y] || this.value[y]!.lt(this.hi[y]!.value) : !this.lo[y] || this.lo[y]!.value.lt(this.value[y]!);
        if (ok && (x < 0 || y < x)) x = y;
      }
      if (x < 0) {
        // The row proves infeasibility.
        // b = Σ c·y; with μ_b = ∓1 and μ_y = ±c the forms cancel.
        const lits: { lit: number; coeff: Q }[] = [{ lit: (increase ? lo : hi)!.reason, coeff: increase ? Q.ONE.neg() : Q.ONE }];
        for (const [y, c] of row) {
          const bound = increase === c.sign() > 0 ? this.hi[y]! : this.lo[y]!;
          lits.push({ lit: bound.reason, coeff: increase ? c : c.neg() });
        }
        return { lits: merge(lits) };
      }
      this.pivotAndUpdate(b, x, increase ? lo!.value : hi!.value);
    }
    return 'gave-up';
  }

  private violates(v: number): boolean {
    const val = this.value[v]!;
    return (!!this.lo[v] && val.lt(this.lo[v]!.value)) || (!!this.hi[v] && this.hi[v]!.value.lt(val));
  }

  /** Make x basic in place of b, then set b to `target`. */
  private pivotAndUpdate(b: number, x: number, target: Q): void {
    this.pivots++;
    const row = this.rows.get(b)!;
    const a = row.get(x)!;
    const theta = target.sub(this.value[b]!).div(a);
    this.value[b] = target;
    this.value[x] = this.value[x]!.add(theta);
    for (const c of this.cols[x]!) {
      if (c === b) continue;
      this.value[c] = this.value[c]!.add(this.rows.get(c)!.get(x)!.mul(theta));
    }
    // Rewrite: x = (b − Σ_{y≠x} a_y y) / a
    const newRow = new Map<number, Q>();
    const inv = Q.ONE.div(a);
    newRow.set(b, inv);
    for (const [y, c] of row) if (y !== x) newRow.set(y, c.neg().mul(inv));
    this.rows.delete(b);
    for (const y of row.keys()) this.cols[y]!.delete(b);
    this.rows.set(x, newRow);
    for (const y of newRow.keys()) this.cols[y]!.add(x);
    // Substitute x in every other row that mentions it.
    for (const c of [...this.cols[x]!]) {
      if (c === x) continue;
      const r = this.rows.get(c)!;
      const k = r.get(x)!;
      r.delete(x);
      this.cols[x]!.delete(c);
      for (const [y, d] of newRow) {
        const before = r.has(y);
        addTo(r, y, k.mul(d));
        if (r.has(y) && !before) this.cols[y]!.add(c);
        if (!r.has(y) && before) this.cols[y]!.delete(c);
      }
    }
    this.cols[x] = new Set();
  }
}

function addTo(row: Map<number, Q>, y: number, c: Q): void {
  const s = (row.get(y) ?? Q.ZERO).add(c);
  if (s.isZero()) row.delete(y);
  else row.set(y, s);
}

function merge(lits: { lit: number; coeff: Q }[]): { lit: number; coeff: Q }[] {
  const m = new Map<number, Q>();
  for (const { lit, coeff } of lits) m.set(lit, (m.get(lit) ?? Q.ZERO).add(coeff));
  return [...m].filter(([, c]) => !c.isZero()).map(([lit, coeff]) => ({ lit, coeff }));
}
