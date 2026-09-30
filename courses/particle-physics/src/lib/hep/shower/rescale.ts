/**
 * The final rescaling that makes a set of particles add up to a prescribed four-momentum exactly.
 *
 * Both the shower (after the cascade) and the hadronisation (after the string breaks) build momenta that are
 * nearly, but not exactly, consistent with energy–momentum conservation. The fix used by both is the one of RAMBO's
 * mass-correction step: go to the rest frame of the sum, multiply every three-momentum by the same factor ξ, choose ξ so
 * that the energies (with the true masses) add up to the target mass, then boost to the target's frame.
 */
import type { P4 } from '../kinematics/index.ts';

/**
 * Rescale the four-vectors in place so that they add up to `target` exactly (to rounding error), keeping each mass
 * `masses[i]` and the relative directions (in the rest frame of their sum). Returns false, leaving the input
 * untouched, if that is impossible: the particles have no relative motion, their sum is not time-like, or the target
 * mass does not exceed the sum of the masses.
 */
export function rescaleToTarget(p: P4[], masses: ArrayLike<number>, target: P4): boolean {
  const n = p.length;
  if (n < 2) return false;
  let E = 0, X = 0, Y = 0, Z = 0, sumM = 0;
  for (let i = 0; i < n; i++) {
    const q = p[i]!;
    E += q.E;
    X += q.px;
    Y += q.py;
    Z += q.pz;
    sumM += masses[i]!;
  }
  const MS2 = (E - Math.sqrt(X * X + Y * Y + Z * Z)) * (E + Math.sqrt(X * X + Y * Y + Z * Z));
  if (!(MS2 > 0)) return false;
  const pT2 = target.px * target.px + target.py * target.py + target.pz * target.pz;
  const MT2 = (target.E - Math.sqrt(pT2)) * (target.E + Math.sqrt(pT2));
  if (!(MT2 > 0)) return false;
  const MT = Math.sqrt(MT2);
  if (!(MT > sumM)) return false;
  // Rest frame of the sum: β = −P/E.
  const bx = -X / E, by = -Y / E, bz = -Z / E;
  const b2 = bx * bx + by * by + bz * bz;
  const g = 1 / Math.sqrt(1 - b2);
  const g2 = b2 > 0 ? (g - 1) / b2 : 0;
  const sx = new Float64Array(n), sy = new Float64Array(n), sz = new Float64Array(n);
  let sumP = 0;
  for (let i = 0; i < n; i++) {
    const q = p[i]!;
    const bp = bx * q.px + by * q.py + bz * q.pz;
    const c = g2 * bp + g * q.E;
    sx[i] = q.px + c * bx;
    sy[i] = q.py + c * by;
    sz[i] = q.pz + c * bz;
    sumP += Math.sqrt(sx[i]! ** 2 + sy[i]! ** 2 + sz[i]! ** 2);
  }
  if (!(sumP > 0)) return false;
  // Solve Σ √(mᵢ² + ξ² pᵢ²) = MT. f is convex and increasing, f(ξ₀) ≥ 0 at ξ₀ = MT/Σp, so Newton from ξ₀ converges monotonically.
  let xi = MT / sumP;
  for (let it = 0; it < 60; it++) {
    let f = -MT;
    let df = 0;
    for (let i = 0; i < n; i++) {
      const p2 = sx[i]! ** 2 + sy[i]! ** 2 + sz[i]! ** 2;
      const e = Math.sqrt(masses[i]! ** 2 + xi * xi * p2);
      f += e;
      df += e > 0 ? (xi * p2) / e : 0;
    }
    if (Math.abs(f) < 1e-15 * MT || df <= 0) break;
    const step = f / df;
    xi -= step;
    if (xi <= 0) {
      xi = 1e-12;
      break;
    }
    if (Math.abs(step) < 1e-16 * xi) break;
  }
  // Boost from the rest frame of the sum to the target's frame: β = +P_T/E_T.
  const tx = target.px / target.E, ty = target.py / target.E, tz = target.pz / target.E;
  const t2 = tx * tx + ty * ty + tz * tz;
  const gt = 1 / Math.sqrt(1 - t2);
  const gt2 = t2 > 0 ? (gt - 1) / t2 : 0;
  for (let i = 0; i < n; i++) {
    const x = xi * sx[i]!, y = xi * sy[i]!, z = xi * sz[i]!;
    const e = Math.sqrt(masses[i]! ** 2 + x * x + y * y + z * z);
    const bp = tx * x + ty * y + tz * z;
    const c = gt2 * bp + gt * e;
    p[i] = { E: gt * (e + bp), px: x + c * tx, py: y + c * ty, pz: z + c * tz };
  }
  return true;
}
