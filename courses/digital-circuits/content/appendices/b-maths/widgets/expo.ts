/**
 * Exponential growth and decay for Appendix B, in units of the time constant τ (so t = 1 is one τ).
 * The step-by-step version needs no calculus: each step closes a fixed fraction of the remaining gap.
 */

/** Fraction of the way to the final value of a charging RC circuit, at time t (in τ). */
export const charge = (t: number) => 1 - Math.exp(-t);
/** Fraction of the starting value left after time t (in τ) when discharging. */
export const decay = (t: number) => Math.exp(-t);

export type Mode = 'charge' | 'decay';
export const exact = (mode: Mode, t: number) => (mode === 'charge' ? charge(t) : decay(t));

/** ln 2, the half-life in units of τ. */
export const HALF_LIFE = Math.LN2;

/** Time (in τ) at which charging reaches `fraction` of the final value: t = −ln(1 − f). */
export function timeToCharge(fraction: number): number {
  if (!(fraction >= 0 && fraction < 1)) return NaN;
  return -Math.log(1 - fraction);
}

/** Time (in τ) at which a decay has fallen to `fraction` of its starting value. */
export function timeToDecay(fraction: number): number {
  if (!(fraction > 0 && fraction <= 1)) return NaN;
  return -Math.log(fraction);
}

export interface Point {
  t: number;
  v: number;
}

/**
 * The step-by-step approximation: divide each τ into N equal steps. In each step the value moves a
 * fraction 1/N of the way it still has to go (charging: towards 1; decaying: towards 0), using the gap
 * at the start of the step. Returns the points at t = 0, 1/N, 2/N, … up to `until` (in τ).
 */
export function steps(mode: Mode, n: number, until: number): Point[] {
  const out: Point[] = [{ t: 0, v: mode === 'charge' ? 0 : 1 }];
  const count = Math.round(until * n);
  let v = out[0]!.v;
  for (let k = 1; k <= count; k++) {
    const gap = mode === 'charge' ? 1 - v : v;
    v += mode === 'charge' ? gap / n : -gap / n;
    out.push({ t: k / n, v });
  }
  return out;
}

/** The gap left after one τ of N steps, (1 − 1/N)^N, which tends to 1/e = 0.3679 as N grows. */
export const gapAfterOneTau = (n: number) => (1 - 1 / n) ** n;

/** Rows of the classic limit table: N, (1 − 1/N)^N. */
export const LIMIT_TABLE = [1, 2, 4, 10, 100, 1000, 1_000_000].map((n) => ({ n, gap: gapAfterOneTau(n) }));

/** Compound growth by the same argument: (1 + 1/N)^N tends to e. */
export const growthAfterOneTau = (n: number) => (1 + 1 / n) ** n;

export interface DecayFact {
  label: string;
  fraction: number;
  /** In units of τ. */
  t: number;
}

/** Times, in τ, at which a decay has fallen to common fractions. */
export const DECAY_FACTS: DecayFact[] = [0.9, 0.5, 1 / Math.E, 0.1, 0.01].map((fraction) => ({
  label: fraction === 0.5 ? 'half' : fraction === 1 / Math.E ? '1/e (37 %)' : `${Math.round(fraction * 100)} %`,
  fraction,
  t: timeToDecay(fraction),
}));

/** Doubling time for growth at rate r per unit time, ln 2 / ln(1 + r) (discrete) — for the rule of 72. */
export const doublingTime = (rate: number) => Math.LN2 / Math.log1p(rate);

/** Half-life from a time constant, and back. */
export const halfLifeOf = (tau: number) => tau * Math.LN2;
export const tauOf = (halfLife: number) => halfLife / Math.LN2;
