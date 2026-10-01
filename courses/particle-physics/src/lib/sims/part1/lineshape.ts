/**
 * Line shapes (Chapter 3): the Breit–Wigner, its convolution with a Gaussian detector resolution, and a least-squares fit to a
 * histogram (used on the real dimuon data).
 */

/** The normalised Breit–Wigner (Cauchy) density in the mass m: (Γ/2π) / ((m − M)² + Γ²/4). Its full width at half maximum is Γ. */
export function bw(m: number, M: number, gamma: number): number {
  const d = m - M;
  return gamma / (2 * Math.PI) / (d * d + (gamma * gamma) / 4);
}
/** Its cumulative distribution. */
export function bwCdf(m: number, M: number, gamma: number): number {
  return 0.5 + Math.atan((m - M) / (gamma / 2)) / Math.PI;
}
/** The complex amplitude behind it, 1/(E − M + iΓ/2), as [re, im]. As E sweeps through M the tip traces a circle of diameter 2/Γ. */
export function bwAmplitude(e: number, M: number, gamma: number): [number, number] {
  const re = e - M, im = gamma / 2;
  const d = re * re + im * im;
  return [re / d, -im / d];
}

export const gauss = (x: number, sigma: number): number => Math.exp(-(x * x) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));

/**
 * The Breit–Wigner convolved with a Gaussian of width σ: what a detector of resolution σ records of a line of width Γ.
 * Computed by splitting the Breit–Wigner into cells whose exact probability (from its cumulative distribution) is weighted by the
 * Gaussian at the cell centre, so a line far narrower than σ (the J/ψ in a muon detector) is handled exactly.
 */
export function smeared(m: number, M: number, gamma: number, sigma: number): number {
  if (!(sigma > 0)) return bw(m, M, gamma);
  const n = 240;
  const reach = 8 * sigma;
  const h = (2 * reach) / n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const x0 = m - reach + i * h;
    const p = bwCdf(x0 + h, M, gamma) - bwCdf(x0, M, gamma);
    s += p * gauss(m - (x0 + h / 2), sigma);
  }
  return s; // Σ p_i G(m − x_i) is the convolution integral
}

/** The full width at half maximum of a sampled curve, by linear interpolation on a fine grid around the maximum. */
export function fwhm(f: (x: number) => number, lo: number, hi: number, n = 4000): number {
  let best = -Infinity, at = lo;
  const xs = new Float64Array(n + 1), ys = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    xs[i] = lo + ((hi - lo) * i) / n;
    ys[i] = f(xs[i]!);
    if (ys[i]! > best) {
      best = ys[i]!;
      at = i;
    }
  }
  const half = best / 2;
  let left = xs[0]!, right = xs[n]!;
  for (let i = at; i > 0; i--) if (ys[i - 1]! < half) { left = xs[i - 1]! + ((half - ys[i - 1]!) / (ys[i]! - ys[i - 1]!)) * (xs[i]! - xs[i - 1]!); break; }
  for (let i = at; i < n; i++) if (ys[i + 1]! < half) { right = xs[i]! + ((ys[i]! - half) / (ys[i]! - ys[i + 1]!)) * (xs[i + 1]! - xs[i]!); break; }
  return right - left;
}

export interface LineshapeFit {
  mass: number;
  sigma: number;
  /** Signal events (the integral of the fitted line). */
  signal: number;
  /** Flat background per unit mass. */
  background: number;
  chi2: number;
  dof: number;
}

/**
 * Fit counts in bins (`edges`, n + 1 values) to A · (Breit–Wigner ⊗ Gaussian) + b. The mass offset and σ are scanned on a grid; for each
 * pair, the two linear parameters A and b follow from weighted least squares with weights 1/max(count, 1) (Neyman χ²). Γ is fixed.
 * A coarse tool for a picture: good to a few per cent in σ, and the Z's radiative tail is not modelled.
 */
export function fitLineshape(
  edges: readonly number[],
  counts: readonly number[],
  gamma: number,
  grid: { mass: [number, number]; sigma: [number, number]; nMass?: number; nSigma?: number },
): LineshapeFit {
  const n = counts.length;
  const centres = counts.map((_, i) => (edges[i]! + edges[i + 1]!) / 2);
  const widths = counts.map((_, i) => edges[i + 1]! - edges[i]!);
  const w = counts.map((c) => 1 / Math.max(c, 1));
  const nm = grid.nMass ?? 25, ns = grid.nSigma ?? 40;
  let best: LineshapeFit | null = null;
  for (let a = 0; a < nm; a++) {
    const M = grid.mass[0] + ((grid.mass[1] - grid.mass[0]) * a) / (nm - 1);
    for (let b = 0; b < ns; b++) {
      // σ on a logarithmic grid
      const sigma = ns > 1 ? grid.sigma[0] * (grid.sigma[1] / grid.sigma[0]) ** (b / (ns - 1)) : grid.sigma[0];
      const s = centres.map((c, i) => smeared(c, M, gamma, sigma) * widths[i]!);
      // minimise Σ w (y − A s − B u)², u = widths (flat background per unit mass)
      let Sss = 0, Ssu = 0, Suu = 0, Sys = 0, Syu = 0;
      for (let i = 0; i < n; i++) {
        Sss += w[i]! * s[i]! * s[i]!;
        Ssu += w[i]! * s[i]! * widths[i]!;
        Suu += w[i]! * widths[i]! * widths[i]!;
        Sys += w[i]! * counts[i]! * s[i]!;
        Syu += w[i]! * counts[i]! * widths[i]!;
      }
      const det = Sss * Suu - Ssu * Ssu;
      if (!(det > 0)) continue;
      const A = Math.max(0, (Sys * Suu - Syu * Ssu) / det);
      const B = Math.max(0, (Syu - A * Ssu) / Suu);
      let chi2 = 0;
      for (let i = 0; i < n; i++) chi2 += w[i]! * (counts[i]! - A * s[i]! - B * widths[i]!) ** 2;
      if (!best || chi2 < best.chi2) best = { mass: M, sigma, signal: A, background: B, chi2, dof: n - 4 };
    }
  }
  return best!;
}
