/**
 * Formulas and checks for the RC labs. Everything here is closed-form; the labs' traces come from the analog
 * engine, and the tests compare the two.
 */
import { formatSI } from '$lib/bench/format';

export const nb = (s: string) => s.replace(/ /g, ' ');

/** The time constant. */
export const tau = (R: number, C: number) => R * C;

/** Voltage of a capacitor charging from v0 towards vs through τ, after time t. */
export const charge = (v0: number, vs: number, tauSeconds: number, t: number) => vs + (v0 - vs) * Math.exp(-t / tauSeconds);

/** Time to go from v0 to v, charging towards vs: τ·ln((vs − v0)/(vs − v)). */
export function timeTo(v0: number, v: number, vs: number, tauSeconds: number): number {
  return tauSeconds * Math.log((vs - v0) / (vs - v));
}

export interface TauCheck {
  ok: boolean;
  text: string;
}

/**
 * Judge a τ measurement made with cursors. T1 should sit on the rising edge, and CH2 at T2 should have closed
 * 63.2 % of the gap between its value at T1 and the final value `vs`; then Δt is τ.
 */
export function checkTau(a: { dt: number; v1: number; v2: number; vs: number; t1Div: number; edgeDiv: number; R: number; C: number }): TauCheck {
  const rc = tau(a.R, a.C);
  const rcText = nb(formatSI(rc, 's', 3));
  if (Math.abs(a.t1Div - a.edgeDiv) > 0.3)
    return { ok: false, text: 'Put T1 on the rising edge of the generator (the orange step, where the trigger marker points): that is when charging starts.' };
  const gap = (a.v2 - a.v1) / (a.vs - a.v1);
  const pct = gap * 100;
  if (!(gap > 0.55 && gap < 0.71))
    return {
      ok: false,
      text: `At T2 the capacitor has closed ${pct.toFixed(0)} % of the gap to ${nb(formatSI(a.vs, 'V', 2))}. Move T2 until it is 63 % (about ${nb(formatSI(a.v1 + 0.632 * (a.vs - a.v1), 'V', 3))}), then compare.`,
    };
  const err = (a.dt - rc) / rc;
  const dtText = nb(formatSI(a.dt, 's', 3));
  if (Math.abs(err) < 0.1) return { ok: true, text: `Δt = ${dtText} at ${pct.toFixed(0)} % of the gap, and R × C = ${rcText}: they agree to within ${Math.max(1, Math.round(Math.abs(err) * 100))} %. That is τ.` };
  return { ok: false, text: `Δt = ${dtText} but R × C = ${rcText}, ${Math.abs(err * 100).toFixed(0)} % ${err > 0 ? 'more' : 'less'}. Check that T1 is exactly on the edge and T2 exactly at 63 %.` };
}

/** The 1–2–5 timebase closest to τ (so that 5τ, the time to settle, fills half a period of ten divisions). */
export function autosetIndex(timebases: number[], tauSeconds: number): number {
  let best = 0;
  let bd = Infinity;
  timebases.forEach((t, i) => {
    const d = Math.abs(Math.log(t / tauSeconds));
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

export interface WireMetrics {
  tau: number;
  /** 10–90 % rise time, 2.2 τ. */
  rise: number;
  /** Delay to the 50 % point, τ·ln 2. */
  delay: number;
  /** The fastest clock whose half period is five time constants (the wire settles to 99 % each half cycle). */
  fmax: number;
  /** Energy drawn from the supply per full cycle: C·V². */
  energy: number;
  /** Power at frequency f: C·V²·f. */
  power: (f: number) => number;
}

export function wireMetrics(R: number, C: number, vdd: number): WireMetrics {
  const t = tau(R, C);
  return { tau: t, rise: 2.2 * t, delay: Math.LN2 * t, fmax: 1 / (10 * t), energy: C * vdd * vdd, power: (f) => C * vdd * vdd * f };
}

/** Rise time of a pull-up edge between 30 % and 70 % of the supply: τ·ln(0.7/0.3) = 0.847 τ. */
export const pullupRise = (R: number, C: number) => Math.log(0.7 / 0.3) * R * C;
