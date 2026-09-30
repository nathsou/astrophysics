/**
 * Modified Bessel functions of the first kind, I_n(x), for integer order n ≥ 0 and real x ≥ 0.
 *
 * I_n(x) = Σ_k (x/2)^{2k+n} / (k! (k+n)!) has only positive terms, so the power series has no cancellation and is
 * accurate to rounding for every x; it is used up to x = 30 (about 70 terms). Beyond that the terms grow too large
 * to be convenient and the asymptotic expansion
 *   I_n(x) ≈ e^x / √(2πx) · [1 − (μ−1)/(8x) + (μ−1)(μ−9)/(2!(8x)²) − …],  μ = 4n²,
 * is accurate to better than 1e-12 (its terms fall until k ≈ 2x).
 *
 * The scaled function `besselIScaled(n, x) = e^{−x} I_n(x)` does not overflow; the plaquette of the two-dimensional U(1)
 * lattice gauge theory, ⟨cos θ_p⟩ = I_1(β)/I_0(β), is computed from it.
 */

const SERIES_LIMIT = 30;

/** e^{−x} I_n(x). */
export function besselIScaled(n: number, x: number): number {
  n = Math.abs(n);
  if (!Number.isInteger(n)) throw new Error('besselIScaled: integer order only');
  if (x < 0) {
    // I_n(−x) = (−1)^n I_n(x)
    return (n % 2 ? -1 : 1) * besselIScaled(n, -x);
  }
  if (x === 0) return n === 0 ? 1 : 0;
  if (x <= SERIES_LIMIT) {
    const h = x / 2;
    // first term (x/2)^n / n!, in logs to be safe for big n
    let lterm = n * Math.log(h);
    for (let i = 2; i <= n; i++) lterm -= Math.log(i);
    let term = Math.exp(lterm);
    let sum = term;
    const q = h * h;
    for (let k = 1; k < 400; k++) {
      term *= q / (k * (k + n));
      sum += term;
      if (term < sum * 1e-17) break;
    }
    return sum * Math.exp(-x);
  }
  const mu = 4 * n * n;
  let term = 1;
  let sum = 1;
  for (let k = 1; k < 60; k++) {
    const next = (-term * (mu - (2 * k - 1) ** 2)) / (k * 8 * x);
    if (Math.abs(next) >= Math.abs(term) && k > 2) break; // asymptotic series has started to diverge
    term = next;
    sum += term;
    if (Math.abs(term) < 1e-17 * Math.abs(sum)) break;
  }
  return sum / Math.sqrt(2 * Math.PI * x);
}

/** I_n(x) (overflows to Infinity beyond x ≈ 700). */
export function besselI(n: number, x: number): number {
  return besselIScaled(n, x) * Math.exp(Math.abs(x));
}
export const besselI0 = (x: number): number => besselI(0, x);
export const besselI1 = (x: number): number => besselI(1, x);

/** I_1(x)/I_0(x): the mean cosine of a von Mises distribution, and the 2D U(1) plaquette at coupling β = x. */
export function besselRatio(x: number): number {
  return besselIScaled(1, x) / besselIScaled(0, x);
}
