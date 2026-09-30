/**
 * Seeded random numbers and the samplers the generator is built from.
 *
 * Every random number in the course comes from an `Rng`, so results are reproducible: the same seed gives
 * the same events in a test, in a worker and in the reader's browser.
 */

/** A source of uniform random numbers with helpers. Create with `rng(seed)`. */
export interface Rng {
  /** Uniform in [0, 1). */
  (): number;
  /** An independent stream derived from this one (for workers and sub-tasks). */
  fork(label?: number | string): Rng;
  readonly seed: number;
}

/** sfc32, a small fast generator with 128 bits of state, seeded through splitmix32. */
export function rng(seed = 1): Rng {
  let a = 0, b = 0, c = 0, d = 0;
  let s = seed >>> 0;
  const split = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  a = split(); b = split(); c = split(); d = split();
  const next = (() => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) >>> 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    d = (d + 1) >>> 0;
    t = (t + d) >>> 0;
    c = (c + t) >>> 0;
    return t / 4294967296;
  }) as Rng;
  // warm up
  for (let i = 0; i < 12; i++) next();
  (next as { seed: number }).seed = seed >>> 0;
  next.fork = (label: number | string = 0) => {
    let h = 2166136261 >>> 0;
    for (const ch of String(label)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return rng((Math.floor(next() * 4294967296) ^ h) >>> 0);
  };
  return next;
}

/** Uniform in [lo, hi). */
export function uniform(r: Rng, lo = 0, hi = 1): number {
  return lo + (hi - lo) * r();
}

/** Standard normal by the polar (Marsaglia) method, scaled to mean and sigma. */
export function normal(r: Rng, mean = 0, sigma = 1): number {
  let u: number, v: number, s: number;
  do {
    u = 2 * r() - 1;
    v = 2 * r() - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  return mean + sigma * u * Math.sqrt((-2 * Math.log(s)) / s);
}

/** Exponential with the given mean (inverse transform: t = −τ ln u). */
export function exponential(r: Rng, mean = 1): number {
  return -mean * Math.log(1 - r());
}

/** Poisson: Knuth's product method for small means, a normal approximation with rejection for large. */
export function poisson(r: Rng, mean: number): number {
  if (mean <= 0) return 0;
  if (mean < 30) {
    const L = Math.exp(-mean);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= r();
    } while (p > L);
    return k - 1;
  }
  // Atkinson's rejection (PA) is overkill here; a rounded normal is adequate above 30 and keeps the tails honest enough for the course.
  for (;;) {
    const x = Math.round(normal(r, mean, Math.sqrt(mean)));
    if (x >= 0) return x;
  }
}

/** Binomial(n, p) by direct summation for small n, a normal approximation for large n. */
export function binomial(r: Rng, n: number, p: number): number {
  if (n < 50) {
    let k = 0;
    for (let i = 0; i < n; i++) if (r() < p) k++;
    return k;
  }
  const x = Math.round(normal(r, n * p, Math.sqrt(n * p * (1 - p))));
  return Math.min(n, Math.max(0, x));
}

/** Breit–Wigner (Cauchy) with mass m and full width Γ, by inverse transform. Truncate with `lo`/`hi` if given. */
export function breitWigner(r: Rng, mass: number, width: number, lo = -Infinity, hi = Infinity): number {
  const cdf = (x: number) => 0.5 + Math.atan((x - mass) / (width / 2)) / Math.PI;
  const a = Number.isFinite(lo) ? cdf(lo) : 0;
  const b = Number.isFinite(hi) ? cdf(hi) : 1;
  const u = a + (b - a) * r();
  return mass + (width / 2) * Math.tan(Math.PI * (u - 0.5));
}

/** Sample an index from (unnormalised) weights. */
export function choice(r: Rng, weights: ArrayLike<number>): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i]!;
  let u = r() * total;
  for (let i = 0; i < weights.length; i++) {
    u -= weights[i]!;
    if (u < 0) return i;
  }
  return weights.length - 1;
}

/**
 * Accept–reject: sample from `pdf` on [lo, hi] using a flat envelope of height `max`.
 * Returns the sample and the number of trials it took (the efficiency is 1/trials on average).
 */
export function acceptReject(r: Rng, pdf: (x: number) => number, lo: number, hi: number, max: number): { x: number; trials: number } {
  for (let trials = 1; ; trials++) {
    const x = lo + (hi - lo) * r();
    if (r() * max <= pdf(x)) return { x, trials };
    if (trials > 1e7) throw new Error('acceptReject: envelope too small or pdf is zero everywhere');
  }
}

/** Inverse-transform sampler for a tabulated density on an even grid (piecewise-linear CDF). */
export function tabulated(values: ArrayLike<number>, lo: number, hi: number): (r: Rng) => number {
  const n = values.length;
  const cdf = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cdf[i + 1] = cdf[i]! + Math.max(0, values[i]!);
  const total = cdf[n]!;
  const dx = (hi - lo) / n;
  return (r) => {
    const u = r() * total;
    let a = 0;
    let b = n;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (cdf[m]! <= u) a = m;
      else b = m;
    }
    const w = cdf[a + 1]! - cdf[a]!;
    return lo + (a + (w > 0 ? (u - cdf[a]!) / w : 0.5)) * dx;
  };
}

/** Shuffle in place (Fisher–Yates). */
export function shuffle<T>(r: Rng, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
