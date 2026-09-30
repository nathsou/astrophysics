/**
 * Chapter 18, "under the hood": the Sudakov veto algorithm for the first emission of a quark, with a fixed coupling so that
 * every trial can be shown. The density of emissions per unit ln pT² is the library's `emissionRate` (z-integrated
 * q → qg splitting). It is overestimated by a constant, which is easy to sample from, and each trial is accepted with
 * probability (true rate)/(overestimate). The result is exactly distributed as −dΔ/dt with Δ the Sudakov factor.
 */
import type { Rng } from '../../hep/random/index.ts';
import { emissionRate, sudakov, CF } from '../../hep/shower/index.ts';

export interface Trial {
  /** pT² of the trial, GeV². */
  t: number;
  /** The true rate there, per unit ln t. */
  rate: number;
  accepted: boolean;
}

/** The constant overestimate of the emission rate per unit ln t: the z-integral of 2C_F/(1 − z) over the widest range. */
export function overRate(E: number, tmin: number, alpha: number): number {
  const eps = Math.sqrt(tmin) / E;
  return (alpha / (2 * Math.PI)) * 2 * CF * Math.log((1 - eps) / eps);
}

/** One evolution from tmax down to tmin. Returns the list of trials; the last one is accepted unless the evolution ran out of scale. */
export function traceVeto(E: number, tmax: number, tmin: number, alpha: number, r: Rng): Trial[] {
  const over = overRate(E, tmin, alpha);
  const trials: Trial[] = [];
  let t = tmax;
  for (let i = 0; i < 10000; i++) {
    // next trial: P(no trial above t') = (t'/t)^over, so ln t' = ln t + ln(u)/over
    t = t * Math.pow(r(), 1 / over);
    if (t <= tmin) return trials;
    const rate = emissionRate(t, { parton: 'q', E, alphaS: alpha });
    const accepted = r() * over < rate;
    trials.push({ t, rate, accepted });
    if (accepted) return trials;
  }
  return trials;
}

/** The first-emission scale, or null when the evolution finishes without an emission. */
export function firstEmission(E: number, tmax: number, tmin: number, alpha: number, r: Rng): number | null {
  const tr = traceVeto(E, tmax, tmin, alpha, r);
  const last = tr[tr.length - 1];
  return last?.accepted ? last.t : null;
}

/** Probability of no emission between tmin and tmax (analytic). */
export function noEmission(E: number, tmax: number, tmin: number, alpha: number): number {
  return sudakov(tmin, tmax, { parton: 'q', E, alphaS: alpha });
}
