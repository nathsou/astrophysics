/**
 * Special functions the statistics needs: the error function, the normal distribution and its quantile, the log-gamma
 * function, the regularised incomplete gamma and beta functions. Pure TypeScript, double precision.
 *
 * Accuracy is chosen for the far tails, because discovery is about tails: a 5σ p-value is 2.87e-7 and the
 * functions here keep about 12 significant digits there (see `special.test.ts`).
 */

const SQRT_PI = Math.sqrt(Math.PI);
const SQRT2 = Math.SQRT2;
const EPS = 1e-16;

/** erf(x), from the positive series e^(−x²)·Σ 2ⁿx²ⁿ⁺¹/(2n+1)!! below 2 and 1 − erfc above. */
export function erf(x: number): number {
  if (Number.isNaN(x)) return NaN;
  const a = Math.abs(x);
  if (a >= 6) return Math.sign(x);
  if (a < 2) {
    // erf(x) = (2/√π) e^(−x²) Σ_{n≥0} 2ⁿ x^(2n+1) / (1·3·5···(2n+1)); every term is positive, so no cancellation.
    let term = a;
    let sum = a;
    for (let n = 1; n < 200; n++) {
      term *= (2 * a * a) / (2 * n + 1);
      sum += term;
      if (term < EPS * sum) break;
    }
    return Math.sign(x) * ((2 / SQRT_PI) * Math.exp(-a * a) * sum);
  }
  return x > 0 ? 1 - erfc(a) : erfc(a) - 1;
}

/** erfc(x) = 1 − erf(x) with full relative precision for large positive x (continued fraction above 2). */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 2) return 1 - erf(x);
  if (x > 27) return 0;
  // erfc(x) = e^(−x²)/√π · 1/(x + ½/(x + 1/(x + (3/2)/(x + 2/(x + …))))), evaluated from the tail upwards.
  let f = x;
  for (let k = 80; k >= 1; k--) f = x + k / 2 / f;
  return Math.exp(-x * x) / (SQRT_PI * f);
}

/** Standard normal density. */
export const normalPdf = (x: number): number => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
/** Standard normal cumulative distribution Φ(x). */
export const normalCdf = (x: number): number => 0.5 * erfc(-x / SQRT2);
/** Upper tail 1 − Φ(x), accurate for large x. */
export const normalSf = (x: number): number => 0.5 * erfc(x / SQRT2);

/**
 * The z with 1 − Φ(z) = q (the upper-tail quantile). Start from the Abramowitz–Stegun 26.2.23 rational approximation
 * (error below 4.5e-4) and polish with Newton steps on Q(z) − q, which converges quadratically because Q is convex for z > 0.
 */
export function normalUpperQuantile(q: number): number {
  if (Number.isNaN(q) || q < 0 || q > 1) return NaN;
  if (q === 0) return Infinity;
  if (q === 1) return -Infinity;
  if (q === 0.5) return 0;
  if (q > 0.5) return -normalUpperQuantile(1 - q);
  const t = Math.sqrt(-2 * Math.log(q));
  let z = t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
  for (let i = 0; i < 8; i++) {
    const d = (normalSf(z) - q) / normalPdf(z);
    z += d;
    if (Math.abs(d) < 1e-15 * Math.max(1, Math.abs(z))) break;
  }
  return z;
}

/** The quantile function Φ⁻¹(p). */
export function normalQuantile(p: number): number {
  if (p > 0.5) return -normalUpperQuantile(p);
  return normalUpperQuantile(1 - p);
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(x) for x > 0 (Lanczos, g = 7, nine terms: about 15 digits). */
export function lnGamma(x: number): number {
  if (x <= 0) return Infinity;
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = LANCZOS[0]!;
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i]! / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** ln(n!) with a table for small n. */
const LNFACT: number[] = [0];
for (let i = 1; i < 171; i++) LNFACT[i] = LNFACT[i - 1]! + Math.log(i);
export function lnFactorial(n: number): number {
  return n < 171 && Number.isInteger(n) ? LNFACT[n]! : lnGamma(n + 1);
}

/** Regularised lower incomplete gamma P(a, x) = γ(a, x)/Γ(a). */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (!Number.isFinite(x)) return 1;
  if (x < a + 1) return gammaSeries(a, x);
  return 1 - gammaContinuedFraction(a, x);
}
/** Regularised upper incomplete gamma Q(a, x) = 1 − P(a, x), with full relative precision in the upper tail. */
export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (!Number.isFinite(x)) return 0;
  if (x < a + 1) return 1 - gammaSeries(a, x);
  return gammaContinuedFraction(a, x);
}
function gammaSeries(a: number, x: number): number {
  let ap = a;
  let del = 1 / a;
  let sum = del;
  for (let n = 0; n < 10000; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}
/** Q(a, x) by the modified Lentz continued fraction (Numerical Recipes, gcf). */
function gammaContinuedFraction(a: number, x: number): number {
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** Survival function of the χ² distribution with k degrees of freedom: P(χ² ≥ x). */
export function chi2Sf(x: number, k: number): number {
  return gammaQ(k / 2, x / 2);
}
/** Cumulative χ² distribution with k degrees of freedom. */
export function chi2Cdf(x: number, k: number): number {
  return gammaP(k / 2, x / 2);
}

/** Regularised incomplete beta function I_x(a, b). */
export function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(x, a, b)) / a;
  return 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}
function betaContinuedFraction(x: number, a: number, b: number): number {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Root of a monotone function on [lo, hi] by bisection (sign of f(lo) and f(hi) must differ). */
export function bisect(f: (x: number) => number, lo: number, hi: number, tol = 1e-12, maxIter = 200): number {
  let flo = f(lo);
  for (let i = 0; i < maxIter; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if (fm === 0 || Math.abs(hi - lo) < tol * Math.max(1, Math.abs(mid))) return mid;
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return 0.5 * (lo + hi);
}
