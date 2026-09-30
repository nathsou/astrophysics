/**
 * How long does a latch stay undecided? Release S and R together, over and over, on the digital engine's SR latch,
 * and time how long its outputs read X before they settle. The engine draws that time from an exponential
 * distribution with mean τ (the `tau` parameter), so the fraction of trials still undecided after t is e^(−t/τ):
 * a straight line on a logarithmic axis.
 */
import '$lib/sim/netlist/catalog';
import { NetlistBuilder, createDigitalEngine } from '$lib/sim/digital';

/** Resolution times (ns) of `trials` releases of S and R from S = R = 1, with time constant `tau` (ns). */
export function resolutionTimes(tau: number, trials: number, seed = 1): number[] {
  const b = new NetlistBuilder();
  const S = b.net('S');
  const R = b.net('R');
  const Q = b.net('Q');
  const Qn = b.net('Qn');
  b.add('toggle', 'tS', { Y: S });
  b.add('toggle', 'tR', { Y: R });
  b.add('srlatch', 'L1', { S, R, Q, Qn }, { tau, delay: 1 });
  const e = createDigitalEngine(b.build(), { seed });
  const rec = e.watch([Q]);
  const out: number[] = [];
  for (let k = 0; k < trials; k++) {
    e.setParam('tS', 'on', true);
    e.setParam('tR', 'on', true);
    e.advance(3e-9);
    const t0 = e.time;
    e.setParam('tS', 'on', false);
    e.setParam('tR', 'on', false);
    let guard = 0;
    while ((e.logic(Q) > 1 || e.time - t0 < 2e-9) && guard++ < 100000) e.advance(1e-9);
    const t = rec.times();
    const v = rec.values()[0]!;
    let x = NaN;
    for (let i = 0; i < t.length; i++) {
      if (t[i]! < t0) continue;
      if (Number.isNaN(x) && v[i] === 2) x = t[i]!;
      else if (!Number.isNaN(x) && v[i]! <= 1) {
        out.push(Math.round((t[i]! - x) * 1e12) / 1e3);
        break;
      }
    }
    rec.trim(20e-9);
  }
  rec.close();
  return out;
}

/** Fraction of the times that are longer than each t. */
export function survival(times: number[], ts: number[]): number[] {
  const sorted = [...times].sort((a, b) => a - b);
  return ts.map((t) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid]! <= t) lo = mid + 1;
      else hi = mid;
    }
    return (sorted.length - lo) / Math.max(1, sorted.length);
  });
}

/** The estimate of τ from the data: the mean of the times (the maximum-likelihood estimate for an exponential). */
export const meanTime = (times: number[]): number => times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);

/** "1 in 22,000" for a probability. */
export function oneIn(p: number): string {
  if (p >= 0.5) return `${Math.round(p * 100)} in 100`;
  const n = 1 / p;
  if (n < 1e6) return `1 in ${Math.round(n).toLocaleString('en-GB')}`;
  return `1 in ${n.toExponential(1).replace('e+', '×10^')}`;
}
