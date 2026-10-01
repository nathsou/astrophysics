/**
 * Trigger turn-on curves: the efficiency of a trigger as a function of the offline pT of the object it selects. A trigger
 * with a nominal threshold is not a step, because the trigger's own measurement of pT is coarser than the offline one: the
 * efficiency rises through an error function (the integral of a Gaussian resolution) from 0 to a plateau.
 *
 *     ε(pT) = plateau · ½ [1 + erf((pT − x50)/(√2 σ))]
 *
 * x50 is the pT at which the efficiency is half the plateau and σ the width. Analyses cut on pT above the point where the
 * plateau is reached (x50 + 2σ is 98% of it) so that the trigger efficiency is flat. The kink near 8 GeV in the CMS dimuon
 * map of chapter 2 is the turn-on of the low-threshold dimuon trigger.
 */

/** The error function (Abramowitz & Stegun 7.1.26, absolute error below 1.5 × 10⁻⁷). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return sign * y;
}

export interface TurnOn { plateau: number; x50: number; sigma: number }

/** The turn-on efficiency at x. */
export function turnOn(x: number, p: TurnOn): number {
  return p.plateau * 0.5 * (1 + erf((x - p.x50) / (Math.SQRT2 * Math.abs(p.sigma))));
}
/** The pT at which the turn-on reaches the given fraction (0–1) of its plateau. */
export function turnOnQuantile(p: TurnOn, fraction: number): number {
  // invert ½(1 + erf(z/√2)) = fraction by bisection
  let lo = -8, hi = 8;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (0.5 * (1 + erf(mid / Math.SQRT2)) < fraction) lo = mid;
    else hi = mid;
  }
  return p.x50 + 0.5 * (lo + hi) * Math.abs(p.sigma);
}

export interface EffPoint { x: number; eff: number; err: number; n: number }

/**
 * The efficiency in bins of a variable: `passed` says whether each event fired the trigger. Bin errors are binomial with a
 * floor (Wilson-style) so that bins at 0% or 100% still carry a finite error. Bins with no events are omitted.
 */
export function efficiencyCurve(values: ArrayLike<number>, passed: ArrayLike<boolean | number>, edges: readonly number[], weights?: ArrayLike<number>): EffPoint[] {
  const out: EffPoint[] = [];
  for (let b = 0; b + 1 < edges.length; b++) {
    let n = 0, k = 0, n2 = 0;
    for (let i = 0; i < values.length; i++) {
      const v = values[i]!;
      if (v < edges[b]! || v >= edges[b + 1]!) continue;
      const w = weights ? weights[i]! : 1;
      n += w;
      n2 += w * w;
      if (passed[i]) k += w;
    }
    if (n === 0) continue;
    const neff = (n * n) / n2;
    const eff = k / n;
    const z = 1;
    const err = (z / (1 + (z * z) / neff)) * Math.sqrt((eff * (1 - eff)) / neff + (z * z) / (4 * neff * neff));
    out.push({ x: 0.5 * (edges[b]! + edges[b + 1]!), eff, err: Math.max(err, 1e-3), n });
  }
  return out;
}

export interface TurnOnFit extends TurnOn { chi2: number; ndof: number }

/** Nelder–Mead minimiser (small, for 3 parameters). */
function nelderMead(f: (p: number[]) => number, start: number[], step: number[], iterations = 600): number[] {
  const n = start.length;
  let simplex: number[][] = [start.slice()];
  for (let i = 0; i < n; i++) {
    const p = start.slice();
    p[i]! += step[i]!;
    simplex.push(p);
  }
  let values = simplex.map(f);
  for (let it = 0; it < iterations; it++) {
    const order = values.map((v, i) => i).sort((a, b) => values[a]! - values[b]!);
    simplex = order.map((i) => simplex[i]!);
    values = order.map((i) => values[i]!);
    if (Math.abs(values[n]! - values[0]!) < 1e-14 * (1 + Math.abs(values[0]!))) break;
    const centroid = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j]! += simplex[i]![j]! / n;
    const at = (t: number) => centroid.map((c, j) => c + t * (simplex[n]![j]! - c));
    const xr = at(-1);
    const fr = f(xr);
    if (fr < values[0]!) {
      const xe = at(-2);
      const fe = f(xe);
      if (fe < fr) { simplex[n] = xe; values[n] = fe; } else { simplex[n] = xr; values[n] = fr; }
    } else if (fr < values[n - 1]!) {
      simplex[n] = xr; values[n] = fr;
    } else {
      const xc = at(fr < values[n]! ? -0.5 : 0.5);
      const fc = f(xc);
      if (fc < Math.min(fr, values[n]!)) { simplex[n] = xc; values[n] = fc; }
      else {
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[i]!.map((x, j) => simplex[0]![j]! + 0.5 * (x - simplex[0]![j]!));
          values[i] = f(simplex[i]!);
        }
      }
    }
  }
  const best = values.indexOf(Math.min(...values));
  return simplex[best]!;
}

/** Fit plateau, x50 and σ to efficiency points by least squares (χ²) with a Nelder–Mead search. */
export function fitTurnOn(points: readonly EffPoint[]): TurnOnFit {
  if (points.length < 3) throw new Error('fitTurnOn: need at least three points');
  const plateau0 = Math.max(0.05, Math.max(...points.map((p) => p.eff)));
  const half = points.find((p) => p.eff >= plateau0 / 2) ?? points[Math.floor(points.length / 2)]!;
  const span = points[points.length - 1]!.x - points[0]!.x;
  const chi2 = (q: number[]) => {
    const t = { plateau: Math.min(1.2, Math.max(0, q[0]!)), x50: q[1]!, sigma: Math.max(1e-6, Math.abs(q[2]!)) };
    let s = 0;
    for (const p of points) s += ((p.eff - turnOn(p.x, t)) / p.err) ** 2;
    return s;
  };
  const best = nelderMead(chi2, [plateau0, half.x, 0.1 * span], [0.05, 0.05 * span, 0.05 * span]);
  const t = { plateau: best[0]!, x50: best[1]!, sigma: Math.abs(best[2]!) };
  return { ...t, chi2: chi2(best), ndof: points.length - 3 };
}
