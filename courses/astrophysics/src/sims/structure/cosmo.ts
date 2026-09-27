// Shared cosmology helpers for Chapter 28 (Cosmic Structure): background expansion,
// linear growth factor, BBKS transfer function, WDM cutoff, σ8 normalisation, and a small CPU FFT.
// Units: H0 = 1 for time, Mpc/h for lengths, h/Mpc for wavenumbers.

export const PLANCK = { Om: 0.31, OL: 0.69, h: 0.68, ns: 0.965, sigma8: 0.81, Gamma: 0.17 };

/** Dimensionless Hubble rate E(a) = H(a)/H0 (matter + curvature + Λ, radiation ignored). */
export function E(a: number, Om: number, OL: number): number {
  const Ok = 1 - Om - OL;
  return Math.sqrt(Math.max(1e-12, Om / (a * a * a) + Ok / (a * a) + OL));
}

export interface Growth {
  /** Growth factor normalised so D ≈ a deep in matter domination. */
  D(a: number): number;
  /** Growth rate f = dlnD/dlna. */
  f(a: number): number;
}

/**
 * Integrate the linear growth ODE in y = ln a:
 *   D'' + (2 + dlnE/dlna) D' = (3/2) Ωm(a) D
 * from a = 1e-3 (D = a, D' = a) to aMax with RK4, and tabulate.
 */
export function growth(Om: number, OL: number, aMax = 10, n = 1500): Growth {
  const y0 = Math.log(1e-3), y1 = Math.log(aMax), h = (y1 - y0) / n;
  const Ok = 1 - Om - OL;
  const Ds = new Float64Array(n + 1), Fs = new Float64Array(n + 1);
  const rhs = (y: number, D: number, V: number): [number, number] => {
    const a = Math.exp(y), a3 = a * a * a, E2 = Math.max(1e-12, Om / a3 + Ok / (a * a) + OL);
    const dlnE = (-3 * Om / a3 - 2 * Ok / (a * a)) / (2 * E2);
    return [V, 1.5 * (Om / a3 / E2) * D - (2 + dlnE) * V];
  };
  let D = Math.exp(y0), V = D;
  Ds[0] = D; Fs[0] = 1;
  for (let i = 0; i < n; i++) {
    const y = y0 + i * h;
    const k1 = rhs(y, D, V);
    const k2 = rhs(y + h / 2, D + (h / 2) * k1[0], V + (h / 2) * k1[1]);
    const k3 = rhs(y + h / 2, D + (h / 2) * k2[0], V + (h / 2) * k2[1]);
    const k4 = rhs(y + h, D + h * k3[0], V + h * k3[1]);
    D += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    V += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    Ds[i + 1] = D; Fs[i + 1] = V / D;
  }
  const interp = (arr: Float64Array, a: number) => {
    const t = Math.min(n, Math.max(0, (Math.log(a) - y0) / h));
    const i = Math.min(n - 1, Math.floor(t)), u = t - i;
    return arr[i] * (1 - u) + arr[i + 1] * u;
  };
  return { D: (a) => interp(Ds, a), f: (a) => interp(Fs, a) };
}

/** Bardeen–Bond–Kaiser–Szalay (1986) CDM transfer function; k in h/Mpc, Γ ≈ Ωm h. */
export function Tbbks(k: number, Gamma = PLANCK.Gamma): number {
  const q = Math.max(1e-8, k / Gamma);
  return (Math.log(1 + 2.34 * q) / (2.34 * q)) *
    Math.pow(1 + 3.89 * q + (16.1 * q) ** 2 + (5.46 * q) ** 3 + (6.71 * q) ** 4, -0.25);
}

/** Warm-dark-matter suppression (Bode+01 / Viel+05 fit). */
export function Twdm(k: number, alpha: number): number {
  if (alpha <= 0) return 1;
  const nu = 1.12;
  return Math.pow(1 + Math.pow(alpha * k, 2 * nu), -5 / nu);
}

/** Viel et al. (2005) α (Mpc/h) for a thermal-relic WDM particle of mass m (keV). */
export const wdmAlpha = (mKeV: number, Om = PLANCK.Om, h = PLANCK.h) =>
  0.049 * Math.pow(mKeV, -1.11) * Math.pow(Om / 0.25, 0.11) * Math.pow(h / 0.7, 1.22);

/** Unnormalised linear P(k) ∝ k^ns T²(k). */
export const pkShape = (k: number, ns: number, Gamma: number, alpha: number) => {
  const T = Tbbks(k, Gamma) * Twdm(k, alpha);
  return Math.pow(k, ns) * T * T;
};

/** rms of the field smoothed with a top-hat of radius R (Mpc/h): σ²(R) = (1/2π²) ∫ k³P W² dlnk. */
export function sigmaR(R: number, pk: (k: number) => number): number {
  let s = 0;
  const n = 1200, l0 = Math.log(1e-4), l1 = Math.log(1e2), h = (l1 - l0) / n;
  for (let i = 0; i <= n; i++) {
    const k = Math.exp(l0 + i * h), x = k * R;
    const W = x < 1e-3 ? 1 : (3 * (Math.sin(x) - x * Math.cos(x))) / (x * x * x);
    const w = i === 0 || i === n ? 0.5 : 1;
    s += w * k * k * k * pk(k) * W * W;
  }
  return Math.sqrt((s * h) / (2 * Math.PI * Math.PI));
}

/** Amplitude A such that A·pkShape has the requested σ8. */
export function normalise(sigma8: number, ns: number, Gamma: number, alpha: number): number {
  const s = sigmaR(8, (k) => pkShape(k, ns, Gamma, alpha));
  return (sigma8 * sigma8) / (s * s);
}

/** In-place iterative radix-2 complex FFT (sign −1 forward, +1 inverse, unnormalised). */
export function fft1d(re: Float64Array, im: Float64Array, off: number, stride: number, n: number, sign: number, tr: Float64Array, ti: Float64Array) {
  for (let i = 0; i < n; i++) { tr[i] = re[off + i * stride]; ti[i] = im[off + i * stride]; }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = tr[i]; tr[i] = tr[j]; tr[j] = t; t = ti[i]; ti[i] = ti[j]; ti[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = tr[b] * cr - ti[b] * ci, xi = tr[b] * ci + ti[b] * cr;
        tr[b] = tr[a] - xr; ti[b] = ti[a] - xi;
        tr[a] += xr; ti[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  for (let i = 0; i < n; i++) { re[off + i * stride] = tr[i]; im[off + i * stride] = ti[i]; }
}

/** 2D FFT of an n×n complex field stored row-major. */
export function fft2d(re: Float64Array, im: Float64Array, n: number, sign: number) {
  const tr = new Float64Array(n), ti = new Float64Array(n);
  for (let y = 0; y < n; y++) fft1d(re, im, y * n, 1, n, sign, tr, ti);
  for (let x = 0; x < n; x++) fft1d(re, im, x, n, n, sign, tr, ti);
}

/** Seeded PRNG (mulberry32) and Gaussian deviates. */
export function rng(seed: number) {
  let s = seed >>> 0;
  const u = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
  return { u, gauss };
}
