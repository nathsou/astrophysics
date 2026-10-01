/**
 * One-loop running of the three gauge couplings of the Standard Model (and of a supersymmetric extension), for the unification figure of Chapter 32.
 *
 *     α_i⁻¹(μ) = α_i⁻¹(m_Z) − (b_i / 2π) ln(μ / m_Z),   i = 1 (hypercharge, GUT-normalised: α₁ = (5/3) α/cos²θ_W), 2 (weak isospin), 3 (colour).
 *
 * The one-loop coefficients are b = (41/10, −19/6, −7) in the Standard Model and (33/5, 1, −3) in the minimal supersymmetric extension (MSSM) above the
 * superpartner mass. A toy: one loop only (two-loop terms shift the crossing points by a few per cent in ln μ), thresholds taken as sharp steps at one common
 * superpartner mass, no heavy-particle thresholds at the GUT scale. Initial values at m_Z from the course's `hep/sm`: α(m_Z) = 1/127.95 and sin²θ_W (MS-bar) = 0.23122, α_s(m_Z) = 0.118.
 */
import { M_Z, SIN2W_MSBAR, ALPHA_S_MZ } from '$lib/hep/sm';
import { ALPHA_MZ } from '$lib/hep/units';

export const B_SM: readonly [number, number, number] = [41 / 10, -19 / 6, -7];
export const B_MSSM: readonly [number, number, number] = [33 / 5, 1, -3];

/** The inverse couplings α₁⁻¹, α₂⁻¹, α₃⁻¹ at the Z mass. */
export function startValues(): [number, number, number] {
  const a = 1 / ALPHA_MZ;
  return [0.6 * (1 - SIN2W_MSBAR) * a, SIN2W_MSBAR * a, 1 / ALPHA_S_MZ];
}

/** α_i⁻¹ at scale μ (GeV), for a superpartner mass `mSusy` (Infinity or omitted: the Standard Model all the way). */
export function inverseCouplings(mu: number, mSusy = Infinity): [number, number, number] {
  const start = startValues();
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    let v = start[i]! - (B_SM[i]! / (2 * Math.PI)) * Math.log(Math.min(mu, mSusy) / M_Z);
    if (mu > mSusy) v -= (B_MSSM[i]! / (2 * Math.PI)) * Math.log(mu / mSusy);
    out[i] = v;
  }
  return out;
}

/** The scale (GeV) where couplings i and j are equal, and their common inverse value. */
export function crossing(i: number, j: number, mSusy = Infinity): { mu: number; alphaInv: number } {
  let lo = Math.log(M_Z), hi = Math.log(1e19);
  const f = (lnMu: number) => {
    const a = inverseCouplings(Math.exp(lnMu), mSusy);
    return a[i]! - a[j]!;
  };
  const sign = Math.sign(f(lo));
  if (Math.sign(f(hi)) === sign) return { mu: NaN, alphaInv: NaN };
  for (let k = 0; k < 80; k++) {
    const mid = 0.5 * (lo + hi);
    if (Math.sign(f(mid)) === sign) lo = mid;
    else hi = mid;
  }
  const mu = Math.exp(0.5 * (lo + hi));
  return { mu, alphaInv: inverseCouplings(mu, mSusy)[i]! };
}

/** The largest spread among the three inverse couplings, minimised over μ: how close the three come to meeting. Returns the scale and the spread. */
export function closestApproach(mSusy = Infinity): { mu: number; spread: number } {
  let best = { mu: NaN, spread: Infinity };
  for (let k = 0; k <= 4000; k++) {
    const mu = Math.exp(Math.log(M_Z) + ((Math.log(1e19) - Math.log(M_Z)) * k) / 4000);
    const a = inverseCouplings(mu, mSusy);
    const spread = Math.max(...a) - Math.min(...a);
    if (spread < best.spread) best = { mu, spread };
  }
  return best;
}
