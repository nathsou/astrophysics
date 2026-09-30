/**
 * The aperture experiment: one flip-flop, one rising clock edge, and a data input that changes `dt` ns after
 * that edge (negative: before it). Run on the digital engine, so what happens is what the engine's flip-flop does:
 * outside the window from `setup` before the edge to `hold` after it, Q is cleanly the old or the new value;
 * inside, Q goes unknown (X) for a random time of mean `tau`, then settles to a random 0 or 1.
 */
import '$lib/sim/netlist/catalog';
import { NetlistBuilder, createDigitalEngine } from '$lib/sim/digital';
import { valueAt, type Segments } from './clocking';

export interface ApertureParams {
  setup: number;
  hold: number;
  clkToQ: number;
  tau: number;
}

/** Deliberately large, so the picture is readable: real flip-flops have windows of tens of picoseconds (fast) to nanoseconds. */
export const APERTURE: ApertureParams = { setup: 2, hold: 1, clkToQ: 3, tau: 1.5 };

export type Outcome = 'old' | 'new' | 'metastable';

/** What the data sheet promises for a data change `dt` ns after the edge. */
export function expected(dt: number, p: ApertureParams = APERTURE): Outcome {
  if (dt <= -p.setup) return 'new';
  if (dt >= p.hold) return 'old';
  return 'metastable';
}

export interface Trial {
  dt: number;
  outcome: Outcome;
  /** Value Q settles to (0 = the old value, 1 = the new one). */
  final: 0 | 1;
  /** How long Q was unknown, ns (0 when it never was). */
  unknownFor: number;
  /** Waveforms in ns relative to the clock edge. */
  clk: Segments;
  d: Segments;
  q: Segments;
  from: number;
  to: number;
}

const EDGE = 50;

export function trial(dt: number, seed = 1, p: ApertureParams = APERTURE): Trial {
  const b = new NetlistBuilder();
  const clk = b.net('CLK');
  const d = b.net('D');
  const q = b.net('Q');
  b.add('clock', 'clk', { Y: clk }, { frequency: 1e9 / (2 * EDGE) });
  b.add('toggle', 'D', { Y: d }, { on: false });
  b.add('dff', 'FF', { D: d, CLK: clk, Q: q, Qn: b.net() }, { clkToQ: p.clkToQ, setup: p.setup, hold: p.hold, tau: p.tau });
  const engine = createDigitalEngine(b.build(), { seed });
  const rec = engine.watch([clk, d, q]);
  const change = EDGE + dt;
  engine.advance(change * 1e-9);
  engine.setParam('D', 'on', true);
  const end = EDGE + 40;
  engine.advance((end - change) * 1e-9);
  const times = rec.times();
  const vals = rec.values();
  rec.close();
  const seg = (i: number): Segments => {
    const out: Segments = [];
    for (let k = 0; k < times.length; k++) {
      const t0 = times[k]! * 1e9 - EDGE;
      const t1 = k + 1 < times.length ? times[k + 1]! * 1e9 - EDGE : end - EDGE;
      const v = vals[i]![k]!;
      const last = out[out.length - 1];
      if (last && last[2] === v) last[1] = t1;
      else if (t1 > t0 || k === 0) out.push([t0, t1, v]);
    }
    return out;
  };
  const clkS = seg(0);
  const dS = seg(1);
  const qS = seg(2);
  const unknownFor = qS.filter((s) => s[2] === 2 && s[0] > 0).reduce((a, s) => a + (s[1] - s[0]), 0);
  const last = valueAt(qS, end - EDGE - 0.001) as 0 | 1;
  const outcome: Outcome = unknownFor > 0 ? 'metastable' : last === 1 ? 'new' : 'old';
  return { dt, outcome, final: last, unknownFor, clk: clkS, d: dS, q: qS, from: -15, to: 40 };
}

export interface Tally {
  n: number;
  old: number;
  new: number;
  metastable: number;
  /** Time Q spent unknown in each metastable trial, ns. */
  durations: number[];
  /** How many of them settled to the new value. */
  settledNew: number;
}

export function tally(dt: number, n: number, p: ApertureParams = APERTURE, seed0 = 100): Tally {
  const t: Tally = { n, old: 0, new: 0, metastable: 0, durations: [], settledNew: 0 };
  for (let i = 0; i < n; i++) {
    const r = trial(dt, seed0 + i, p);
    t[r.outcome]++;
    if (r.outcome === 'metastable') {
      t.durations.push(r.unknownFor);
      if (r.final === 1) t.settledNew++;
    }
  }
  return t;
}
