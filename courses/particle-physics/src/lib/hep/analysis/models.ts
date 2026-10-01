/**
 * Probability shapes and signal-plus-background models for fits.
 *
 * A `Shape` is a density of one variable (usually an invariant mass) with a few parameters: Gaussian, Crystal Ball,
 * Breit–Wigner, exponential, Chebyshev or Bernstein polynomial. Shapes need not be normalised; the fit normalises
 * them over its range, analytically where possible.
 *
 * A `Model` is an *extended* sum of shapes, each multiplied by its yield ν_k (the expected number of events), so the model predicts
 *     expected events in [a, b] = Σ_k ν_k ∫_a^b f_k(x) dx / ∫_range f_k(x) dx.
 * The parameter vector lists, component by component, the yield and then the shape parameters:
 *
 *     const model = extendedModel([{ label: 'sig', shape: gaussian() }, { label: 'bkg', shape: exponential() }]);
 *     model.paramNames   // ['sig.yield', 'sig.mean', 'sig.sigma', 'bkg.yield', 'bkg.slope']
 */
import { erf } from './special.ts';

/** A shape bound to parameter values and a fit range: the density and its integral, with constants precomputed. */
export interface BoundShape {
  /** Unnormalised density f(x). */
  f(x: number): number;
  /** ∫_a^b f(x) dx. */
  integral(a: number, b: number): number;
}

export interface Shape {
  name: string;
  paramNames: string[];
  /** Default limits for the shape parameters (used by the fits unless overridden). */
  lower: number[];
  upper: number[];
  /** Sensible limits for the parameters given the fit range (a mass must lie in the range, a width cannot exceed it). Overrides `lower`/`upper` in the fits. */
  rangeLimits?(lo: number, hi: number): { lower: number[]; upper: number[] };
  /** Bind parameter values `p` (this shape's own parameters) and the fit range [lo, hi]. */
  bind(p: ArrayLike<number>, lo: number, hi: number): BoundShape;
}

// ── numerical integration ────────────────────────────────────────────────────────────────────────

/** Adaptive Simpson integration of f on [a, b]. */
export function integrate(f: (x: number) => number, a: number, b: number, tol = 1e-10, maxDepth = 24): number {
  const simpson = (fa: number, fm: number, fb: number, a0: number, b0: number) => ((b0 - a0) / 6) * (fa + 4 * fm + fb);
  const rec = (a0: number, b0: number, fa: number, fm: number, fb: number, whole: number, eps: number, depth: number): number => {
    const m = 0.5 * (a0 + b0);
    const lm = 0.5 * (a0 + m), rm = 0.5 * (m + b0);
    const flm = f(lm), frm = f(rm);
    const left = simpson(fa, flm, fm, a0, m), right = simpson(fm, frm, fb, m, b0);
    const delta = left + right - whole;
    if (depth <= 0 || Math.abs(delta) <= 15 * eps) return left + right + delta / 15;
    return rec(a0, m, fa, flm, fm, left, eps / 2, depth - 1) + rec(m, b0, fm, frm, fb, right, eps / 2, depth - 1);
  };
  if (a === b) return 0;
  const fa = f(a), fb = f(b), fm = f(0.5 * (a + b));
  const whole = simpson(fa, fm, fb, a, b);
  return rec(a, b, fa, fm, fb, whole, Math.max(tol * Math.abs(whole), 1e-300), maxDepth);
}

// ── shapes ───────────────────────────────────────────────────────────────────────────────────────

/** Gaussian with parameters `mean` and `sigma`. */
export function gaussian(): Shape {
  return {
    name: 'gaussian',
    paramNames: ['mean', 'sigma'],
    lower: [-Infinity, 1e-6],
    upper: [Infinity, Infinity],
    rangeLimits: (lo, hi) => ({ lower: [lo, 1e-4 * (hi - lo)], upper: [hi, hi - lo] }),
    bind(p) {
      const mu = p[0]!, s = p[1]!;
      const inv = 1 / s;
      const k = 1 / (s * Math.SQRT2);
      return {
        f: (x) => {
          const z = (x - mu) * inv;
          return Math.exp(-0.5 * z * z);
        },
        integral: (a, b) => s * Math.sqrt(Math.PI / 2) * (erf((b - mu) * k) - erf((a - mu) * k)),
      };
    },
  };
}

/**
 * The Crystal Ball function (Gaussian core, power-law tail on the low side), the classic shape of a photon or electron
 * peak that loses energy to radiation or leakage: f = exp(−z²/2) for z > −α and A (B − z)⁻ⁿ below, with z = (x − mean)/σ,
 * A = (n/α)ⁿ e^(−α²/2) and B = n/α − α, so that f and its slope are continuous at z = −α. Parameters: mean, sigma, alpha, n (n > 1).
 */
export function crystalBall(): Shape {
  return {
    name: 'crystalBall',
    paramNames: ['mean', 'sigma', 'alpha', 'n'],
    lower: [-Infinity, 1e-6, 0.05, 1.05],
    upper: [Infinity, Infinity, 10, 200],
    rangeLimits: (lo, hi) => ({ lower: [lo, 1e-4 * (hi - lo), 0.05, 1.05], upper: [hi, hi - lo, 10, 200] }),
    bind(p) {
      const mu = p[0]!, s = p[1]!, alpha = Math.abs(p[2]!), n = p[3]!;
      const A = Math.pow(n / alpha, n) * Math.exp(-0.5 * alpha * alpha);
      const B = n / alpha - alpha;
      const gaussPart = Math.sqrt(Math.PI / 2);
      const tailAt = A * Math.pow(B + alpha, 1 - n) / (n - 1); // tail primitive at z = −α
      // Primitive G(z) of f in units of σ, with G(−∞) = 0.
      const G = (z: number): number => {
        if (z <= -alpha) return (A * Math.pow(B - z, 1 - n)) / (n - 1);
        return tailAt + gaussPart * (erf(z / Math.SQRT2) - erf(-alpha / Math.SQRT2));
      };
      return {
        f: (x) => {
          const z = (x - mu) / s;
          return z > -alpha ? Math.exp(-0.5 * z * z) : A * Math.pow(B - z, -n);
        },
        integral: (a, b) => s * (G((b - mu) / s) - G((a - mu) / s)),
      };
    },
  };
}

/**
 * The Breit–Wigner (Cauchy) line shape of an unstable particle: f = 1/((x − M)² + Γ²/4), parameters `mean` (M) and `width` (Γ, the FWHM).
 * With `relativistic`, f = 1/((x² − M²)² + M²Γ²), which is what the propagator gives and is asymmetric for a wide resonance.
 */
export function breitWigner(relativistic = false): Shape {
  return {
    name: relativistic ? 'breitWignerRelativistic' : 'breitWigner',
    paramNames: ['mean', 'width'],
    lower: [-Infinity, 1e-6],
    upper: [Infinity, Infinity],
    rangeLimits: (lo, hi) => ({ lower: [lo, 1e-4 * (hi - lo)], upper: [hi, hi - lo] }),
    bind(p) {
      const M = p[0]!, G = p[1]!;
      if (!relativistic) {
        return {
          f: (x) => 1 / ((x - M) * (x - M) + 0.25 * G * G),
          integral: (a, b) => (2 / G) * (Math.atan((2 * (b - M)) / G) - Math.atan((2 * (a - M)) / G)),
        };
      }
      const f = (x: number) => 1 / ((x * x - M * M) ** 2 + M * M * G * G);
      return {
        f,
        integral: (a, b) => {
          // Split at the peak so that the adaptive rule sees it.
          if (a < M && M < b) return integrate(f, a, M, 1e-11) + integrate(f, M, b, 1e-11);
          return integrate(f, a, b, 1e-11);
        },
      };
    },
  };
}

/** Exponential f = exp(slope · (x − mid)), with `slope` in 1/unit of x (negative for a falling spectrum). `mid` is the centre of the fit range. */
export function exponential(): Shape {
  return {
    name: 'exponential',
    paramNames: ['slope'],
    lower: [-Infinity],
    upper: [Infinity],
    rangeLimits: (lo, hi) => ({ lower: [-60 / (hi - lo)], upper: [60 / (hi - lo)] }),
    bind(p, lo, hi) {
      const s = p[0]!;
      const mid = 0.5 * (lo + hi);
      return {
        f: (x) => Math.exp(s * (x - mid)),
        integral: (a, b) => {
          const t = s * (b - a);
          if (Math.abs(t) < 1e-6) return (b - a) * Math.exp(s * (0.5 * (a + b) - mid));
          return (Math.exp(s * (b - mid)) - Math.exp(s * (a - mid))) / s;
        },
      };
    },
  };
}

/** A constant density. */
export function flat(): Shape {
  return { name: 'flat', paramNames: [], lower: [], upper: [], bind: () => ({ f: () => 1, integral: (a, b) => b - a }) };
}

/** Coefficients (in t^j) of the Chebyshev polynomials T_0 … T_n. */
function chebyshevCoefficients(n: number): number[][] {
  const T: number[][] = [[1], [0, 1]];
  for (let k = 2; k <= n; k++) {
    const next = new Array<number>(k + 1).fill(0);
    T[k - 1]!.forEach((c, j) => (next[j + 1]! += 2 * c));
    T[k - 2]!.forEach((c, j) => (next[j]! -= c));
    T[k] = next;
  }
  return T;
}

function polynomialShape(name: string, coefficientsOf: (p: ArrayLike<number>, order: number) => number[], order: number, varOf: (x: number, lo: number, hi: number) => number, scale: (lo: number, hi: number) => number, lower: number, upper: number): Shape {
  return {
    name,
    paramNames: Array.from({ length: order }, (_, i) => `c${i + 1}`),
    lower: new Array<number>(order).fill(lower),
    upper: new Array<number>(order).fill(upper),
    bind(p, lo, hi) {
      const q = coefficientsOf(p, order); // coefficients in the scaled variable t
      const ev = (t: number) => {
        let v = 0;
        for (let j = q.length - 1; j >= 0; j--) v = v * t + q[j]!;
        return v;
      };
      const k = scale(lo, hi);
      return {
        f: (x) => ev(varOf(x, lo, hi)),
        integral: (a, b) => {
          const ta = varOf(a, lo, hi), tb = varOf(b, lo, hi);
          let s = 0;
          for (let j = 0; j < q.length; j++) s += (q[j]! * (Math.pow(tb, j + 1) - Math.pow(ta, j + 1))) / (j + 1);
          return s * k;
        },
      };
    },
  };
}

/**
 * A Chebyshev polynomial background of the given order on the fit range: f = 1 + Σ_{k=1..order} c_k T_k(t), t = (2x − lo − hi)/(hi − lo).
 * The constant term is fixed to 1 (the fit normalises anyway), so the parameters are c1 … c_order. Chebyshev polynomials
 * keep the coefficients nearly uncorrelated, which is why they are the usual choice for smooth backgrounds.
 */
export function chebyshev(order: number): Shape {
  const T = chebyshevCoefficients(order);
  return polynomialShape(
    `chebyshev${order}`,
    (p, n) => {
      const q = new Array<number>(n + 1).fill(0);
      q[0] = 1;
      for (let k = 1; k <= n; k++) T[k]!.forEach((c, j) => (q[j]! += p[k - 1]! * c));
      return q;
    },
    order,
    (x, lo, hi) => (2 * x - lo - hi) / (hi - lo),
    (lo, hi) => (hi - lo) / 2,
    -Infinity,
    Infinity,
  );
}

function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/**
 * A Bernstein polynomial of the given order: f = a_0 B_{0,n}(u) + Σ a_i B_{i,n}(u), u = (x − lo)/(hi − lo), with a_0 = 1 fixed and
 * a_i ≥ 0 (limits 0 … ∞), which makes the density non-negative everywhere by construction.
 */
export function bernstein(order: number): Shape {
  return polynomialShape(
    `bernstein${order}`,
    (p, n) => {
      const q = new Array<number>(n + 1).fill(0);
      for (let i = 0; i <= n; i++) {
        const a = i === 0 ? 1 : p[i - 1]!;
        for (let j = 0; j <= n - i; j++) q[i + j]! += a * binom(n, i) * binom(n - i, j) * (j % 2 ? -1 : 1);
      }
      return q;
    },
    order,
    (x, lo, hi) => (x - lo) / (hi - lo),
    (lo, hi) => hi - lo,
    0,
    Infinity,
  );
}

/** A shape with no parameters defined by a histogram (a template, for instance from simulation): piecewise constant. */
export function template(edges: ArrayLike<number>, values: ArrayLike<number>): Shape {
  const n = values.length;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i]! + values[i]! * (edges[i + 1]! - edges[i]!);
  const primitive = (x: number): number => {
    if (x <= edges[0]!) return 0;
    if (x >= edges[n]!) return cum[n]!;
    let a = 0, b = n;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (edges[m]! <= x) a = m;
      else b = m;
    }
    return cum[a]! + values[a]! * (x - edges[a]!);
  };
  return {
    name: 'template',
    paramNames: [],
    lower: [],
    upper: [],
    bind: () => ({
      f: (x) => {
        if (x < edges[0]! || x >= edges[n]!) return 0;
        let a = 0, b = n;
        while (b - a > 1) {
          const m = (a + b) >> 1;
          if (edges[m]! <= x) a = m;
          else b = m;
        }
        return values[a]!;
      },
      integral: (a, b) => primitive(b) - primitive(a),
    }),
  };
}

// ── models ───────────────────────────────────────────────────────────────────────────────────────

export interface Component {
  label: string;
  shape: Shape;
}

export interface Model {
  paramNames: string[];
  /** Default limits: yields ≥ 0, shape limits from the shapes. */
  lower: number[];
  upper: number[];
  /** True when the model has yields (extended likelihood); false for a single normalised shape. */
  extended: boolean;
  components: { label: string; shape: Shape; yieldIndex: number; paramIndex: number[] }[];
  /** Default limits for a fit range: the shapes' range-dependent limits where they have them, else the static ones. */
  limits(lo: number, hi: number): { lower: number[]; upper: number[] };
  /** Expected events in each bin of `edges` (the range is the full span of the edges unless `range` is given). */
  binned(p: ArrayLike<number>, edges: ArrayLike<number>, range?: [number, number]): number[];
  /** The same, one array per component. */
  componentBinned(p: ArrayLike<number>, edges: ArrayLike<number>, range?: [number, number]): number[][];
  /** Normalised probability density on [lo, hi] (for the unbinned likelihood). */
  pdf(p: ArrayLike<number>, lo: number, hi: number): (x: number) => number;
  /** Expected events per unit of x: Σ ν_k f_k(x)/∫f_k, for drawing the fitted curve. */
  density(p: ArrayLike<number>, lo: number, hi: number): (x: number) => number;
  /** Expected events per unit of x of component k. */
  componentDensity(p: ArrayLike<number>, lo: number, hi: number): ((x: number) => number)[];
  /** Total expected events Σ ν_k (1 for a non-extended model). */
  totalYield(p: ArrayLike<number>): number;
}

/** Build an extended sum of components. Parameter order: for each component its yield, then its shape parameters. */
export function extendedModel(components: Component[]): Model {
  const names: string[] = [], lower: number[] = [], upper: number[] = [];
  const comps: Model['components'] = [];
  for (const c of components) {
    const yieldIndex = names.length;
    names.push(`${c.label}.yield`);
    lower.push(0);
    upper.push(Infinity);
    const paramIndex: number[] = [];
    c.shape.paramNames.forEach((nm, j) => {
      paramIndex.push(names.length);
      names.push(`${c.label}.${nm}`);
      lower.push(c.shape.lower[j]!);
      upper.push(c.shape.upper[j]!);
    });
    comps.push({ label: c.label, shape: c.shape, yieldIndex, paramIndex });
  }
  return buildModel(names, lower, upper, true, comps);
}

/** A single normalised shape (no yield), for the non-extended unbinned likelihood. */
export function shapeModel(shape: Shape, label = 'pdf'): Model {
  const paramIndex = shape.paramNames.map((_, j) => j);
  return buildModel(shape.paramNames.map((nm) => `${label}.${nm}`), shape.lower.slice(), shape.upper.slice(), false, [{ label, shape, yieldIndex: -1, paramIndex }]);
}

function buildModel(paramNames: string[], lower: number[], upper: number[], extended: boolean, components: Model['components']): Model {
  const bindAll = (p: ArrayLike<number>, lo: number, hi: number) =>
    components.map((c) => {
      const bound = c.shape.bind(c.paramIndex.map((i) => p[i]!), lo, hi);
      const norm = bound.integral(lo, hi);
      return { bound, norm, nu: c.yieldIndex >= 0 ? p[c.yieldIndex]! : 1 };
    });
  const spanOf = (edges: ArrayLike<number>, range?: [number, number]): [number, number] => range ?? [edges[0]!, edges[edges.length - 1]!];
  const total = (p: ArrayLike<number>) => components.reduce((s, c) => s + (c.yieldIndex >= 0 ? p[c.yieldIndex]! : 1), 0);
  const componentBinned: Model['componentBinned'] = (p, edges, range) => {
    const [lo, hi] = spanOf(edges, range);
    return bindAll(p, lo, hi).map(({ bound, norm, nu }) => {
      const out = new Array<number>(edges.length - 1);
      const k = norm > 0 ? nu / norm : 0;
      for (let i = 0; i < out.length; i++) out[i] = k * bound.integral(edges[i]!, edges[i + 1]!);
      return out;
    });
  };
  const pdf: Model['pdf'] = (p, lo, hi) => {
    const b = bindAll(p, lo, hi);
    const nuTot = b.reduce((s, c) => s + c.nu, 0);
    const w = b.map((c) => (c.norm > 0 ? c.nu / (c.norm * nuTot) : 0));
    if (b.length === 1) {
      const f = b[0]!.bound.f, k = w[0]!;
      return (x) => k * f(x);
    }
    if (b.length === 2) {
      const f0 = b[0]!.bound.f, f1 = b[1]!.bound.f, k0 = w[0]!, k1 = w[1]!;
      return (x) => k0 * f0(x) + k1 * f1(x);
    }
    return (x) => {
      let s = 0;
      for (let k = 0; k < b.length; k++) s += w[k]! * b[k]!.bound.f(x);
      return s;
    };
  };
  return {
    paramNames,
    lower,
    upper,
    extended,
    components,
    limits(lo, hi) {
      const l = lower.slice(), u = upper.slice();
      for (const c of components) {
        const r = c.shape.rangeLimits?.(lo, hi);
        if (!r) continue;
        c.paramIndex.forEach((pi, j) => {
          l[pi] = r.lower[j]!;
          u[pi] = r.upper[j]!;
        });
      }
      return { lower: l, upper: u };
    },
    componentBinned,
    binned(p, edges, range) {
      const parts = componentBinned(p, edges, range);
      const out = new Array<number>(edges.length - 1).fill(0);
      for (const part of parts) for (let i = 0; i < out.length; i++) out[i]! += part[i]!;
      return out;
    },
    pdf,
    density(p, lo, hi) {
      const f = pdf(p, lo, hi);
      const nu = total(p);
      return (x) => nu * f(x);
    },
    componentDensity(p, lo, hi) {
      return bindAll(p, lo, hi).map(({ bound, norm, nu }) => (x: number) => (norm > 0 ? (nu / norm) * bound.f(x) : 0));
    },
    totalYield: total,
  };
}

/** Convenience: a Gaussian signal on an exponential background, `sig.{yield,mean,sigma}` and `bkg.{yield,slope}`. */
export function gaussianPlusExponential(): Model {
  return extendedModel([{ label: 'sig', shape: gaussian() }, { label: 'bkg', shape: exponential() }]);
}

// ── named models ─────────────────────────────────────────────────────────────────────────────────

const SIGNALS: Record<string, () => Shape> = {
  gauss: gaussian,
  cb: crystalBall,
  bw: () => breitWigner(false),
  bwrel: () => breitWigner(true),
};

/** The shape behind a background key: `exp`, `flat`, `cheb<N>` or `bern<N>` (N = 1…8). */
export function namedShape(key: string): Shape {
  if (key === 'exp') return exponential();
  if (key === 'flat') return flat();
  const m = /^(cheb|bern)([1-8])$/.exec(key);
  if (m) return m[1] === 'cheb' ? chebyshev(Number(m[2])) : bernstein(Number(m[2]));
  const s = SIGNALS[key];
  if (s) return s();
  throw new Error(`unknown shape "${key}" (use gauss, cb, bw, bwrel, exp, flat, chebN or bernN)`);
}

/**
 * A model from a short name, as used in the exercise specifications: `"gauss+exp"`, `"cb+cheb2"`, `"bw+bern3"`, `"gauss+flat"`. The first part is the
 * signal (`gauss`, `cb` Crystal Ball, `bw` Breit–Wigner, `bwrel` relativistic), the second the background (`exp`, `flat`, `chebN`, `bernN`). The components
 * are labelled `sig` and `bkg`, so the parameters are `sig.yield`, `sig.mean`, … and `bkg.yield`, `bkg.slope`, … . A single name (`"exp"`) is a
 * background-only model labelled `bkg`.
 */
export function namedModel(key: string): Model {
  const parts = key.split('+').map((s) => s.trim());
  if (parts.length === 1) return extendedModel([{ label: 'bkg', shape: namedShape(parts[0]!) }]);
  if (parts.length === 2) return extendedModel([{ label: 'sig', shape: namedShape(parts[0]!) }, { label: 'bkg', shape: namedShape(parts[1]!) }]);
  throw new Error(`model "${key}": expected "signal+background"`);
}
