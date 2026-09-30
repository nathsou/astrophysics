/**
 * Dense LU decomposition with partial (row) pivoting, on a row-major Float64Array.
 *
 * The analog engine solves A·x = b at every Newton iteration. Circuits stay small (≤ ~100
 * unknowns), so a dense factorisation is simpler and, at this size, as fast as a sparse one.
 * All buffers are allocated once per circuit and reused.
 *
 * Singular matrices: a pivot that is tiny compared with its column (a floating group of nodes, two
 * ideal voltage sources in parallel) is replaced by a small value so the solve still completes,
 * and the column is remembered. After forward substitution, a non-negligible right-hand side in
 * such a direction means the equations contradict each other (e.g. 5 V and 3 V sources in
 * parallel): `solve` then reports the system as inconsistent. A zero right-hand side there (two
 * equal sources in parallel, a floating but otherwise sensible sub-circuit) is harmless.
 */
export class DenseLU {
  readonly n: number;
  /** L (unit lower, below the diagonal) and U (on and above it), row-major, rows permuted. */
  private readonly lu: Float64Array;
  /** perm[i] = original row now in row i. */
  private readonly perm: Int32Array;
  private readonly colScale: Float64Array;
  /** Row scaling (1 / largest entry of the row) applied before pivoting. */
  private readonly rowScale: Float64Array;
  private readonly y: Float64Array;
  private readonly r: Float64Array;
  private readonly d: Float64Array;
  private singular: number[] = [];
  /** Relative size below which a pivot counts as zero. */
  static readonly PIVOT_TOL = 1e-13;

  constructor(n: number) {
    this.n = n;
    this.lu = new Float64Array(n * n);
    this.perm = new Int32Array(n);
    this.colScale = new Float64Array(n);
    this.rowScale = new Float64Array(n);
    this.y = new Float64Array(n);
    this.r = new Float64Array(n);
    this.d = new Float64Array(n);
  }

  /** Columns whose pivot was regularised in the last factorisation. */
  get singularColumns(): readonly number[] {
    return this.singular;
  }

  /** Factorise A (n×n, row-major; not modified). */
  factor(A: Float64Array): void {
    const n = this.n;
    const a = this.lu;
    a.set(A);
    const cs = this.colScale;
    const rs = this.rowScale;
    cs.fill(0);
    // Row equilibration: rows of an MNA matrix mix units (amperes per volt from 1e-12 to 1e11), and
    // without scaling, partial pivoting is not backward stable.
    for (let i = 0; i < n; i++) {
      const row = i * n;
      let m = 0;
      for (let j = 0; j < n; j++) {
        const v = Math.abs(a[row + j]!);
        if (v > m) m = v;
      }
      const s = m > 0 ? 1 / m : 1;
      rs[i] = s;
      for (let j = 0; j < n; j++) {
        const v = (a[row + j] = a[row + j]! * s);
        const av = Math.abs(v);
        if (av > cs[j]!) cs[j] = av;
      }
      this.perm[i] = i;
    }
    this.singular = [];
    for (let k = 0; k < n; k++) {
      // Pivot: the largest entry in column k at or below the diagonal.
      let p = k;
      let max = Math.abs(a[k * n + k]!);
      for (let i = k + 1; i < n; i++) {
        const v = Math.abs(a[i * n + k]!);
        if (v > max) {
          max = v;
          p = i;
        }
      }
      if (p !== k) {
        const rk = k * n;
        const rp = p * n;
        for (let j = 0; j < n; j++) {
          const t = a[rk + j]!;
          a[rk + j] = a[rp + j]!;
          a[rp + j] = t;
        }
        const t = this.perm[k]!;
        this.perm[k] = this.perm[p]!;
        this.perm[p] = t;
      }
      const tiny = DenseLU.PIVOT_TOL * (cs[k]! > 0 ? cs[k]! : 1);
      let piv = a[k * n + k]!;
      if (!(Math.abs(piv) >= tiny)) {
        piv = piv < 0 ? -tiny : tiny;
        a[k * n + k] = piv;
        this.singular.push(k);
      }
      const inv = 1 / piv;
      const rk = k * n;
      for (let i = k + 1; i < n; i++) {
        const ri = i * n;
        const l = a[ri + k]! * inv;
        if (l === 0) continue;
        a[ri + k] = l;
        for (let j = k + 1; j < n; j++) a[ri + j] = a[ri + j]! - l * a[rk + j]!;
      }
    }
  }

  /**
   * Solve A·x = b with the last factorisation. Returns false when the system is singular and
   * inconsistent (the solution is then only a least-effort guess).
   *
   * If `A` (the matrix that was factorised) is given, one step of iterative refinement follows
   * (x += A⁻¹(b − A·x), the residual in the original matrix): it recovers the digits lost to the
   * wide range of magnitudes in the matrix and costs only O(n²).
   */
  solve(b: Float64Array, x: Float64Array, A?: Float64Array): boolean {
    const consistent = this.substitute(b, x);
    if (A && this.singular.length === 0) {
      const n = this.n;
      const r = this.r;
      const d = this.d;
      for (let i = 0; i < n; i++) {
        let s = b[i]!;
        const row = i * n;
        for (let j = 0; j < n; j++) s -= A[row + j]! * x[j]!;
        r[i] = s;
      }
      this.substitute(r, d);
      for (let i = 0; i < n; i++) x[i] = x[i]! + d[i]!;
    }
    return consistent;
  }

  private substitute(b: Float64Array, x: Float64Array): boolean {
    const n = this.n;
    const a = this.lu;
    const y = this.y;
    const rs = this.rowScale;
    let bmax = 0;
    for (let i = 0; i < n; i++) {
      const p = this.perm[i]!;
      const v = b[p]! * rs[p]!;
      y[i] = v;
      if (Math.abs(v) > bmax) bmax = Math.abs(v);
    }
    for (let i = 1; i < n; i++) {
      const ri = i * n;
      let s = y[i]!;
      for (let j = 0; j < i; j++) s -= a[ri + j]! * y[j]!;
      y[i] = s;
    }
    let consistent = true;
    for (const k of this.singular) {
      if (Math.abs(y[k]!) > 1e-6 * Math.max(1, bmax)) consistent = false;
    }
    for (let i = n - 1; i >= 0; i--) {
      const ri = i * n;
      let s = y[i]!;
      for (let j = i + 1; j < n; j++) s -= a[ri + j]! * x[j]!;
      x[i] = s / a[ri + i]!;
    }
    return consistent;
  }
}
