/**
 * Minimisation, the engine under every fit.
 *
 * `minimize(fn, x0, opts)` finds a local minimum of `fn(x)` (usually a negative log-likelihood, −ln L) and reports the
 * parameter errors. It is a quasi-Newton method, BFGS with central-difference gradients and a backtracking line search, with
 * Nelder–Mead as the fallback when the gradient is unreliable (noisy or non-smooth functions). Parameter limits use the
 * MINUIT variable transformations (a sine for two limits, a square root for one) so the algorithms never see a bound;
 * fixed parameters are simply left out of the search.
 *
 * At the minimum the Hessian matrix H_ij = ∂²f/∂x_i∂x_j is computed by finite differences. Near the minimum
 *     f(x) ≈ f_min + ½ Δᵀ H Δ,
 * so the region where f rises by `errorDef` (½ for −ln L, 1 for −2 ln L or χ²) is the ellipsoid Δᵀ H Δ = 2·errorDef, and
 * the covariance matrix of the parameters is cov = 2·errorDef·H⁻¹. The square roots of its diagonal are the parameter errors.
 * When the likelihood is not parabolic, `profile` and `minos` follow the function itself instead of its parabola.
 */

export type Objective = (x: number[]) => number;

export interface MinimizeOptions {
  /** Lower limits (use −Infinity for none). */
  lower?: number[];
  /** Upper limits (use Infinity for none). */
  upper?: number[];
  /** Parameters held at their starting values. */
  fixed?: boolean[];
  /** A typical size (or uncertainty) of each parameter: sets the initial step. Defaults to max(0.1|x0|, 0.1), or a tenth of a finite range. */
  step?: number[];
  method?: 'auto' | 'bfgs' | 'nelder-mead';
  /** Stop when the estimated distance to the minimum, in units of f, is below this. Default 1e-9. */
  tol?: number;
  maxIter?: number;
  /** Change in f that defines one standard deviation: 0.5 for −ln L (default), 1 for χ² or −2 ln L. */
  errorDef?: number;
  /** Compute the Hessian, covariance and errors (default true). */
  hessian?: boolean;
}

export interface MinimizeResult {
  x: number[];
  fval: number;
  converged: boolean;
  method: 'bfgs' | 'nelder-mead' | 'bfgs+nelder-mead';
  nEval: number;
  nIter: number;
  /** Estimated distance to the minimum, ½ gᵀ H⁻¹ g, in units of f. */
  edm: number;
  /** Second-derivative matrix in the external parameters (zero rows for fixed ones), or null. */
  hessian: number[][] | null;
  /** Covariance matrix (zero rows and columns for fixed parameters), or null. */
  covariance: number[][] | null;
  /** Parameter errors √cov_ii (0 for fixed parameters; NaN if the Hessian is unusable). */
  errors: number[];
  /** True when the Hessian was positive definite, so the errors can be trusted. */
  covValid: boolean;
}

const BIG = 1e300;

interface Xform {
  free: number[];
  n: number;
  lower: number[];
  upper: number[];
  /** Internal free vector → external full vector. */
  ext(u: ArrayLike<number>): number[];
  /** External full vector → internal free vector. */
  int(x: number[]): number[];
}

function makeTransform(x0: number[], opts: MinimizeOptions): Xform {
  const n = x0.length;
  const lower = x0.map((_, i) => opts.lower?.[i] ?? -Infinity);
  const upper = x0.map((_, i) => opts.upper?.[i] ?? Infinity);
  const free: number[] = [];
  for (let i = 0; i < n; i++) if (!opts.fixed?.[i]) free.push(i);
  const clampIn = (i: number, x: number) => {
    const lo = lower[i]!, hi = upper[i]!;
    if (lo > hi) throw new Error(`minimize: lower limit above upper limit for parameter ${i}`);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      const r = hi - lo;
      return Math.min(hi - 1e-4 * r, Math.max(lo + 1e-4 * r, x));
    }
    if (Number.isFinite(lo)) return Math.max(lo + 1e-4 * Math.max(1, Math.abs(lo)), x);
    if (Number.isFinite(hi)) return Math.min(hi - 1e-4 * Math.max(1, Math.abs(hi)), x);
    return x;
  };
  return {
    free,
    n: free.length,
    lower,
    upper,
    ext(u) {
      const x = x0.slice();
      for (let k = 0; k < free.length; k++) {
        const i = free[k]!;
        const lo = lower[i]!, hi = upper[i]!;
        const v = u[k]!;
        if (Number.isFinite(lo) && Number.isFinite(hi)) x[i] = lo + 0.5 * (hi - lo) * (Math.sin(v) + 1);
        else if (Number.isFinite(lo)) x[i] = lo - 1 + Math.sqrt(v * v + 1);
        else if (Number.isFinite(hi)) x[i] = hi + 1 - Math.sqrt(v * v + 1);
        else x[i] = v;
      }
      return x;
    },
    int(x) {
      return free.map((i) => {
        const lo = lower[i]!, hi = upper[i]!;
        const v = clampIn(i, x[i]!);
        if (Number.isFinite(lo) && Number.isFinite(hi)) return Math.asin(Math.min(1, Math.max(-1, (2 * (v - lo)) / (hi - lo) - 1)));
        if (Number.isFinite(lo)) return Math.sqrt(Math.max(0, (v - lo + 1) ** 2 - 1));
        if (Number.isFinite(hi)) return Math.sqrt(Math.max(0, (hi - v + 1) ** 2 - 1));
        return v;
      });
    },
  };
}

function defaultStep(x0: number[], t: Xform, opts: MinimizeOptions): number[] {
  return t.free.map((i) => {
    const given = opts.step?.[i];
    if (given !== undefined && given > 0) return given;
    const lo = t.lower[i]!, hi = t.upper[i]!;
    if (Number.isFinite(lo) && Number.isFinite(hi)) return Math.min((hi - lo) / 10, Math.max(0.1 * Math.abs(x0[i]!), 0.01 * (hi - lo)));
    return Math.max(0.1 * Math.abs(x0[i]!), 0.1);
  });
}

interface Core {
  u: number[];
  f: number;
  converged: boolean;
  nIter: number;
  Hinv?: number[][];
}

/** BFGS with central-difference gradients and a backtracking line search, on the internal (unbounded) variables. */
function bfgs(F: (u: number[]) => number, u0: number[], scale: number[], tol: number, maxIter: number): Core {
  const n = u0.length;
  const grad = (u: number[]): number[] => {
    const g = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const h = 1e-5 * Math.max(Math.abs(u[i]!), scale[i]!);
      const save = u[i]!;
      u[i] = save + h;
      const fp = F(u);
      u[i] = save - h;
      const fm = F(u);
      u[i] = save;
      g[i] = (fp - fm) / (2 * h);
    }
    return g;
  };
  const identity = () => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? scale[i]! * scale[i]! : 0)));
  let Hinv = identity();
  let u = u0.slice();
  let f = F(u);
  if (!Number.isFinite(f)) return { u, f, converged: false, nIter: 0 };
  let g = grad(u);
  let converged = false;
  let first = true;
  let stalled = 0;
  let iter = 0;
  for (; iter < maxIter; iter++) {
    let p = Hinv.map((row) => -row.reduce((s, h, j) => s + h * g[j]!, 0));
    let gp = g.reduce((s, gi, i) => s + gi * p[i]!, 0);
    if (!(gp < 0)) {
      Hinv = identity();
      first = true;
      p = Hinv.map((row) => -row.reduce((s, h, j) => s + h * g[j]!, 0));
      gp = g.reduce((s, gi, i) => s + gi * p[i]!, 0);
      if (!(gp < 0)) { converged = true; break; } // zero gradient
    }
    const edm = -0.5 * gp;
    if (!first && edm < tol) { converged = true; break; }
    // Step length: at most ~a few typical scales on the first steps.
    const pn = Math.hypot(...p);
    const sn = Math.hypot(...scale);
    let alpha = pn > 5 * sn ? (5 * sn) / pn : 1;
    let fnew = Infinity;
    let unew = u;
    let ok = false;
    for (let k = 0; k < 40; k++) {
      unew = u.map((ui, i) => ui + alpha * p[i]!);
      fnew = F(unew);
      if (Number.isFinite(fnew) && fnew <= f + 1e-4 * alpha * gp) { ok = true; break; }
      if (Number.isFinite(fnew)) {
        const a2 = (-gp * alpha * alpha) / (2 * (fnew - f - gp * alpha));
        alpha = Math.min(0.5 * alpha, Math.max(0.05 * alpha, a2));
      } else alpha *= 0.25;
    }
    if (!ok) {
      if (!first) { Hinv = identity(); first = true; continue; } // restart from steepest descent once
      break;
    }
    const gnew = grad(unew);
    const s = unew.map((v, i) => v - u[i]!);
    const y = gnew.map((v, i) => v - g[i]!);
    const sy = s.reduce((a, v, i) => a + v * y[i]!, 0);
    const sn2 = Math.hypot(...s), yn = Math.hypot(...y);
    if (sy > 1e-10 * sn2 * yn) {
      if (first) {
        // Scale the initial matrix to the curvature actually seen (Nocedal & Wright, eq. 6.20).
        const Hy = Hinv.map((row) => row.reduce((a, h, j) => a + h * y[j]!, 0));
        const yHy = y.reduce((a, v, i) => a + v * Hy[i]!, 0);
        const gamma = sy / yHy;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Hinv[i]![j]! *= gamma;
        first = false;
      }
      const rho = 1 / sy;
      const Hy = Hinv.map((row) => row.reduce((a, h, j) => a + h * y[j]!, 0));
      const yHy = y.reduce((a, v, i) => a + v * Hy[i]!, 0);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) Hinv[i]![j]! += (1 + rho * yHy) * rho * s[i]! * s[j]! - rho * (Hy[i]! * s[j]! + s[i]! * Hy[j]!);
    } else first = false;
    const df = f - fnew;
    u = unew;
    f = fnew;
    g = gnew;
    // Stalled: no measurable progress three times running.
    if (Math.abs(df) <= 1e-13 * (1 + Math.abs(f)) && sn2 <= 1e-9 * (1 + Math.hypot(...u))) stalled++;
    else stalled = 0;
    if (stalled >= 3) {
      const edm2 = 0.5 * g.reduce((a, gi, i) => a + gi * Hinv[i]!.reduce((b, h, j) => b + h * g[j]!, 0), 0);
      converged = edm2 < Math.max(tol * 1e3, 1e-4);
      break;
    }
  }
  return { u, f, converged, nIter: iter, Hinv };
}

/** Nelder–Mead simplex with the dimension-adaptive coefficients of Gao and Han (2012). Derivative free. */
function nelderMead(F: (u: number[]) => number, u0: number[], scale: number[], tol: number, maxEval: number): Core {
  const n = u0.length;
  if (n === 0) return { u: [], f: F([]), converged: true, nIter: 0 };
  const alpha = 1, beta = 1 + 2 / n, gamma = 0.75 - 1 / (2 * n), delta = 1 - 1 / n;
  let simplex: { x: number[]; f: number }[] = [{ x: u0.slice(), f: F(u0) }];
  for (let i = 0; i < n; i++) {
    const x = u0.slice();
    x[i]! += scale[i]!;
    simplex.push({ x, f: F(x) });
  }
  let evals = n + 1;
  let iter = 0;
  let converged = false;
  let restarts = 0;
  while (evals < maxEval) {
    simplex.sort((a, b) => a.f - b.f);
    const best = simplex[0]!, worst = simplex[n]!;
    const fspread = Math.abs(worst.f - best.f);
    let size = 0;
    for (let k = 1; k <= n; k++) for (let i = 0; i < n; i++) size = Math.max(size, Math.abs(simplex[k]!.x[i]! - best.x[i]!) / scale[i]!);
    if ((fspread <= tol * 1e-2 + 1e-14 * Math.abs(best.f) || !Number.isFinite(best.f)) && size < 1e-5) {
      // Restart once from the best point with a fresh simplex to escape a collapsed one.
      if (restarts < 1) {
        restarts++;
        const b = best.x.slice();
        simplex = [{ x: b, f: best.f }];
        for (let i = 0; i < n; i++) {
          const x = b.slice();
          x[i]! += 0.1 * scale[i]!;
          simplex.push({ x, f: F(x) });
        }
        evals += n;
        continue;
      }
      converged = true;
      break;
    }
    iter++;
    const c = new Array<number>(n).fill(0);
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) c[i]! += simplex[k]!.x[i]! / n;
    const at = (t: number) => c.map((ci, i) => ci + t * (ci - worst.x[i]!));
    const xr = at(alpha);
    const fr = F(xr);
    evals++;
    if (fr < best.f) {
      const xe = at(beta);
      const fe = F(xe);
      evals++;
      simplex[n] = fe < fr ? { x: xe, f: fe } : { x: xr, f: fr };
    } else if (fr < simplex[n - 1]!.f) {
      simplex[n] = { x: xr, f: fr };
    } else {
      const outside = fr < worst.f;
      const xc = at(outside ? gamma : -gamma);
      const fc = F(xc);
      evals++;
      if (fc < (outside ? fr : worst.f)) simplex[n] = { x: xc, f: fc };
      else {
        for (let k = 1; k <= n; k++) {
          const x = simplex[k]!.x.map((v, i) => best.x[i]! + delta * (v - best.x[i]!));
          simplex[k] = { x, f: F(x) };
        }
        evals += n;
      }
    }
  }
  simplex.sort((a, b) => a.f - b.f);
  return { u: simplex[0]!.x, f: simplex[0]!.f, converged, nIter: iter };
}

/** Invert a symmetric positive-definite matrix by Cholesky decomposition; null if it is not positive definite. */
export function invertSPD(A: number[][]): number[][] | null {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i]![j]!;
      for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!;
      if (i === j) {
        if (!(s > 1e-14 * Math.abs(A[i]![i]!)) || !Number.isFinite(s)) return null;
        L[i]![i] = Math.sqrt(s);
      } else L[i]![j] = s / L[j]![j]!;
    }
  }
  // Solve L Lᵀ X = I column by column.
  const inv = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let c = 0; c < n; c++) {
    const y = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = i === c ? 1 : 0;
      for (let k = 0; k < i; k++) s -= L[i]![k]! * y[k]!;
      y[i] = s / L[i]![i]!;
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i]!;
      for (let k = i + 1; k < n; k++) s -= L[k]![i]! * inv[k]![c]!;
      inv[i]![c] = s / L[i]![i]!;
    }
  }
  return inv;
}

/**
 * The matrix of second derivatives of `fn` at x for the listed free parameters, by finite differences with steps `h`.
 * The point is moved inside the limits by h if it sits on one, so a parameter at its bound still gets a curvature.
 */
export function hessianAt(fn: Objective, x: number[], free: number[], h: number[], lower: number[] = [], upper: number[] = []): number[][] {
  const n = free.length;
  const c = x.slice();
  for (let k = 0; k < n; k++) {
    const i = free[k]!;
    const lo = lower[i] ?? -Infinity, hi = upper[i] ?? Infinity;
    if (c[i]! + h[k]! > hi) c[i] = hi - h[k]!;
    if (c[i]! - h[k]! < lo) c[i] = lo + h[k]!;
  }
  const ev = (d: [number, number][]) => {
    const p = c.slice();
    for (const [k, s] of d) p[free[k]!]! += s;
    const v = fn(p);
    return Number.isFinite(v) ? v : BIG;
  };
  const f0 = ev([]);
  const fp = new Array<number>(n), fm = new Array<number>(n);
  for (let k = 0; k < n; k++) {
    fp[k] = ev([[k, h[k]!]]);
    fm[k] = ev([[k, -h[k]!]]);
  }
  const H = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let k = 0; k < n; k++) H[k]![k] = (fp[k]! - 2 * f0 + fm[k]!) / (h[k]! * h[k]!);
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) {
      const fpp = ev([[a, h[a]!], [b, h[b]!]]);
      const fmm = ev([[a, -h[a]!], [b, -h[b]!]]);
      const v = (fpp + fmm - fp[a]! - fm[a]! - fp[b]! - fm[b]! + 2 * f0) / (2 * h[a]! * h[b]!);
      H[a]![b] = v;
      H[b]![a] = v;
    }
  return H;
}

/** Minimise `fn` starting at `x0`. See the file comment for the method, limits and error definition. */
export function minimize(fn: Objective, x0: number[], opts: MinimizeOptions = {}): MinimizeResult {
  const n = x0.length;
  const t = makeTransform(x0, opts);
  const tol = opts.tol ?? 1e-9;
  const errorDef = opts.errorDef ?? 0.5;
  let nEval = 0;
  const F = (u: number[]): number => {
    nEval++;
    const v = fn(t.ext(u));
    return Number.isFinite(v) ? v : Infinity;
  };
  const scale = defaultStep(x0, t, opts);
  const u0 = t.int(x0);
  const method = opts.method ?? 'auto';
  let core: Core;
  let used: MinimizeResult['method'] = 'bfgs';
  if (t.n === 0) core = { u: [], f: F([]), converged: true, nIter: 0 };
  else if (method === 'nelder-mead') {
    core = nelderMead(F, u0, scale, tol, 3000 * t.n);
    used = 'nelder-mead';
  } else {
    core = bfgs(F, u0, scale, tol, opts.maxIter ?? 200);
    if (!core.converged && method === 'auto') {
      const nm = nelderMead(F, core.u, scale, tol, 3000 * t.n);
      used = 'bfgs+nelder-mead';
      // Polish the simplex result with BFGS.
      const b2 = bfgs(F, nm.f <= core.f ? nm.u : core.u, scale, tol, opts.maxIter ?? 200);
      core = b2.f <= nm.f && b2.f <= core.f ? b2 : nm.f <= core.f ? nm : core;
      if (b2.converged) core.converged = true;
    }
  }
  const x = t.ext(core.u);
  const res: MinimizeResult = {
    x,
    fval: core.f,
    converged: core.converged,
    method: used,
    nEval,
    nIter: core.nIter,
    edm: NaN,
    hessian: null,
    covariance: null,
    errors: new Array<number>(n).fill(0),
    covValid: false,
  };
  if (opts.hessian === false || t.n === 0) {
    res.covValid = t.n === 0;
    return res;
  }
  // Steps for the finite differences: a fraction of the expected error, refined once.
  let h = t.free.map((_, k) => {
    const hk = core.Hinv ? Math.sqrt(Math.abs(core.Hinv[k]![k]!)) : 0;
    const s = hk > 0 && Number.isFinite(hk) ? hk : scale[k]!;
    return Math.min(Math.max(0.3 * s, 1e-6 * scale[k]!), 10 * scale[k]!);
  });
  let Hfree: number[][] = [];
  let inv: number[][] | null = null;
  for (let pass = 0; pass < 2; pass++) {
    Hfree = hessianAt(fn, x, t.free, h, t.lower, t.upper);
    inv = invertSPD(Hfree);
    if (!inv) break;
    h = t.free.map((_, k) => Math.min(Math.max(0.3 * Math.sqrt(2 * errorDef * inv![k]![k]!), 1e-6 * scale[k]!), 10 * scale[k]!));
  }
  const full = (M: number[][]): number[][] => {
    const out = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    t.free.forEach((i, a) => t.free.forEach((j, b) => (out[i]![j] = M[a]![b]!)));
    return out;
  };
  res.hessian = full(Hfree);
  if (inv) {
    const cov = inv.map((row) => row.map((v) => 2 * errorDef * v));
    res.covariance = full(cov);
    t.free.forEach((i, k) => (res.errors[i] = Math.sqrt(Math.max(0, cov[k]![k]!))));
    res.covValid = true;
    // Distance to the minimum with the exact Hessian: ½ gᵀ H⁻¹ g, gradient in the external parameters.
    const g = t.free.map((i, k) => {
      const hh = h[k]!;
      const a = x.slice(), b = x.slice();
      a[i]! += hh;
      b[i]! -= hh;
      return (fn(a) - fn(b)) / (2 * hh);
    });
    res.edm = 0.5 * g.reduce((s, gi, a) => s + gi * inv![a]!.reduce((q, v, b) => q + v * g[b]!, 0), 0);
  } else {
    // Not positive definite: flat or saddle direction. Fall back to the diagonal for a rough error, flagged invalid.
    t.free.forEach((i, k) => (res.errors[i] = Hfree[k]![k]! > 0 ? Math.sqrt((2 * errorDef) / Hfree[k]![k]!) : NaN));
  }
  return res;
}

export interface ProfilePoint {
  value: number;
  /** Minimum of fn over the other parameters with this one held at `value`. */
  fval: number;
  /** fval − global minimum, times 2 when `errorDef` is ½ (so that Δ(−2 ln L) = 1 is one standard deviation), else in units of f. */
  delta: number;
  x: number[];
}

/**
 * The profile of `fn` in parameter `index`: for each value on `grid`, minimise over all the other (non-fixed) parameters.
 * The grid is walked outwards from the best fit so each minimisation starts from its neighbour's answer. With a
 * negative log-likelihood, `delta` is 2(f − f_min) = Δ(−2 ln L), and its crossings of 1 are the 68 % interval (MINOS).
 */
export function profile(fn: Objective, index: number, grid: number[], opts: MinimizeOptions & { best?: MinimizeResult; x0?: number[] } = {}): ProfilePoint[] {
  const x0 = opts.best?.x ?? opts.x0;
  if (!x0) throw new Error('profile: give x0 or a previous result as `best`');
  const best = opts.best ?? minimize(fn, x0, { ...opts, hessian: false });
  const fixed = (opts.fixed ?? x0.map(() => false)).slice();
  fixed[index] = true;
  const factor = (opts.errorDef ?? 0.5) === 0.5 ? 2 : 1;
  const order = grid.map((v, i) => ({ v, i })).sort((a, b) => Math.abs(a.v - best.x[index]!) - Math.abs(b.v - best.x[index]!));
  const out: ProfilePoint[] = new Array(grid.length);
  const lastBySide: Record<string, number[]> = { lo: best.x.slice(), hi: best.x.slice() };
  for (const { v, i } of order) {
    const side = v < best.x[index]! ? 'lo' : 'hi';
    const start = lastBySide[side]!.slice();
    start[index] = v;
    const r = minimize(fn, start, { ...opts, fixed, hessian: false, method: opts.method ?? 'auto' });
    lastBySide[side] = r.x;
    out[i] = { value: v, fval: r.fval, delta: factor * (r.fval - best.fval), x: r.x };
  }
  return out;
}

/**
 * MINOS-like asymmetric errors for parameter `index` of a result: the values where the profile rises by `errorDef`
 * (Δ(−2 ln L) = 1 for a likelihood). Returns `lo` and `hi` as distances from the best-fit value (positive numbers), or the
 * distance to the parameter limit if the curve never crosses.
 */
export function minos(fn: Objective, best: MinimizeResult, index: number, opts: MinimizeOptions = {}): { lo: number; hi: number; loAtLimit: boolean; hiAtLimit: boolean } {
  const errorDef = opts.errorDef ?? 0.5;
  const x0 = best.x;
  const sigma0 = best.errors[index] && Number.isFinite(best.errors[index]) && best.errors[index]! > 0 ? best.errors[index]! : Math.max(0.1 * Math.abs(x0[index]!), 0.1);
  const fixed = (opts.fixed ?? x0.map(() => false)).slice();
  fixed[index] = true;
  const lower = opts.lower?.[index] ?? -Infinity, upper = opts.upper?.[index] ?? Infinity;
  let start = x0.slice();
  const prof = (v: number) => {
    const s = start.slice();
    s[index] = v;
    const r = minimize(fn, s, { ...opts, fixed, hessian: false });
    return r;
  };
  const side = (dir: 1 | -1): { d: number; atLimit: boolean } => {
    start = x0.slice();
    const limit = dir > 0 ? upper : lower;
    const g = (v: number) => {
      const r = prof(v);
      start = r.x;
      return r.fval - best.fval - errorDef;
    };
    let a = 0; // g(a) < 0
    let b = sigma0;
    for (let k = 0; k < 40; k++) {
      let v = x0[index]! + dir * b;
      if ((dir > 0 && v >= limit) || (dir < 0 && v <= limit)) {
        v = limit;
        if (g(v) < 0) return { d: Math.abs(limit - x0[index]!), atLimit: true };
        b = Math.abs(v - x0[index]!);
        break;
      }
      if (g(v) > 0) break;
      a = b;
      b *= 1.6;
    }
    // Bisection/secant on the bracket [a, b] (distances from the minimum).
    let ga = -errorDef, gb = g(x0[index]! + dir * b);
    for (let k = 0; k < 40; k++) {
      const m = gb === ga ? 0.5 * (a + b) : Math.min(0.9 * b + 0.1 * a, Math.max(0.1 * b + 0.9 * a, a - (ga * (b - a)) / (gb - ga)));
      const gm = g(x0[index]! + dir * m);
      if (Math.abs(gm) < 1e-4 * errorDef || Math.abs(b - a) < 1e-6 * sigma0) return { d: m, atLimit: false };
      if (gm < 0) { a = m; ga = gm; } else { b = m; gb = gm; }
    }
    return { d: 0.5 * (a + b), atLimit: false };
  };
  const hi = side(1);
  const lo = side(-1);
  return { lo: lo.d, hi: hi.d, loAtLimit: lo.atLimit, hiAtLimit: hi.atLimit };
}
