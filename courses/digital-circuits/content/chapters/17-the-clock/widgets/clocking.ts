/**
 * Clocked timing: the arithmetic of a register-to-register path, and the same path run on the digital engine.
 *
 * The path is the one every synchronous design is made of: a launching flip-flop, a chain of gates, and a
 * capturing flip-flop. The launching flip-flop toggles at every edge (its Q̄ feeds its own D), so there is always
 * a fresh value to catch. `skew` is how much later the capture flip-flop's clock arrives than the launch
 * flip-flop's clock.
 *
 *   setup slack = T + skew − (t_cq + t_path + t_su)     ≥ 0 or the capture flip-flop may go metastable
 *   hold slack  = t_cq + t_path − skew − t_h             ≥ 0 or the *next* value races through to this edge
 *
 * `analyse` is the formulas; `simulate` builds the netlist and runs it, so the widget (and the tests) can compare
 * what the formulas say with what the engine's flip-flops do.
 */
import '$lib/sim/netlist/catalog';
import { NetlistBuilder, createDigitalEngine } from '$lib/sim/digital';

export interface PathParams {
  /** Clock period, ns. */
  period: number;
  /** Number of gates between the flip-flops (0 = a wire, as in a shift register). */
  gates: number;
  /** Delay of each gate, ns. */
  gateDelay: number;
  /** Capture clock arrival minus launch clock arrival, ns (negative: the launch clock is the late one). */
  skew: number;
  /** Flip-flop data sheet numbers, ns. */
  clkToQ: number;
  setup: number;
  hold: number;
  /** Metastability time constant, ns. */
  tau: number;
}

export const FLIPFLOP = { clkToQ: 1.5, setup: 1.0, hold: 0.8, tau: 0.8 } as const;

export const DEFAULT_PATH: PathParams = { period: 20, gates: 8, gateDelay: 1.2, skew: 0, ...FLIPFLOP };

export interface Analysis {
  /** Delay of the gates between the flip-flops, ns. */
  tpath: number;
  /** Time after the launch edge at which the data reaches the capture flip-flop, ns. */
  arrival: number;
  setupSlack: number;
  holdSlack: number;
  /** The shortest period that meets setup (ns), and the corresponding frequency (MHz). */
  tmin: number;
  fmax: number;
  setupOk: boolean;
  holdOk: boolean;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function analyse(p: PathParams): Analysis {
  const tpath = p.gates * p.gateDelay;
  const arrival = p.clkToQ + tpath;
  const tmin = arrival + p.setup - p.skew;
  return {
    tpath: r3(tpath),
    arrival: r3(arrival),
    setupSlack: r3(p.period + p.skew - arrival - p.setup),
    holdSlack: r3(arrival - p.skew - p.hold),
    tmin: r3(tmin),
    fmax: tmin > 0 ? r3(1000 / tmin) : Infinity,
    setupOk: p.period + p.skew - arrival - p.setup >= 0,
    holdOk: arrival - p.skew - p.hold >= 0,
  };
}

/** A signal as a list of segments [from, to, value] in ns; value 0, 1 or 2 (X). */
export type Segments = [number, number, number][];

export type EdgeVerdict = 'ok' | 'metastable' | 'wrong';

export interface Capture {
  /** Time of the capture flip-flop's rising edge, ns. */
  time: number;
  /** What the design meant to capture, and what Q2 held a period later (2 = X). */
  expected: number;
  got: number;
  verdict: EdgeVerdict;
}

export interface Run {
  end: number;
  clk1: Segments;
  clk2: Segments;
  q1: Segments;
  d2: Segments;
  q2: Segments;
  captures: Capture[];
  /** Warnings the engine posted (set-up and hold violations). */
  warnings: string[];
  /** True when every capture is ok. */
  works: boolean;
}

function segments(times: Float64Array, values: Float64Array, end: number): Segments {
  const out: Segments = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = times[i]! * 1e9;
    const t1 = i + 1 < times.length ? times[i + 1]! * 1e9 : end;
    if (t1 <= t0 && i + 1 < times.length) continue;
    const v = values[i]!;
    const last = out[out.length - 1];
    if (last && last[2] === v) last[1] = Math.max(t1, last[1]);
    else out.push([t0, Math.max(t1, t0), v]);
  }
  return out;
}

export const valueAt = (s: Segments, t: number): number => {
  for (let i = s.length - 1; i >= 0; i--) if (s[i]![0] <= t) return s[i]![2];
  return 2;
};

/** Run the path on the digital engine for `cycles` capture edges. */
export function simulate(p: PathParams, cycles = 6, seed = 7): Run {
  const b = new NetlistBuilder();
  const clk = b.net('CLK');
  const nSkewCap = b.net('CLK2');
  const nLaunch = p.skew < 0 ? b.net('CLK1') : clk;
  const q1 = b.net('Q1');
  const qn1 = b.net('Qn1');
  const q2 = b.net('Q2');
  b.add('clock', 'clk', { Y: clk }, { frequency: 1e9 / p.period });
  if (p.skew < 0) b.add('buffer', 'skewL', { A: clk, Y: nLaunch }, { delay: -p.skew });
  if (p.skew > 0) b.add('buffer', 'skewC', { A: clk, Y: nSkewCap }, { delay: p.skew });
  const capClk = p.skew > 0 ? nSkewCap : clk;
  const ff = { clkToQ: p.clkToQ, setup: p.setup, hold: p.hold, tau: p.tau };
  b.add('dff', 'FF1', { D: qn1, CLK: nLaunch, Q: q1, Qn: qn1 }, ff);
  let d = q1;
  for (let i = 0; i < p.gates; i++) {
    const out = i === p.gates - 1 ? b.net('D2') : b.net();
    b.add('buffer', `G${i + 1}`, { A: d, Y: out }, { delay: p.gateDelay });
    d = out;
  }
  b.add('dff', 'FF2', { D: d, CLK: capClk, Q: q2, Qn: b.net() }, ff);
  const engine = createDigitalEngine(b.build(), { seed });
  const rec = engine.watch([nLaunch, capClk, q1, d, q2]);
  const end = (cycles + 0.5) * p.period;
  engine.advance(end * 1e-9);
  const times = rec.times();
  const vals = rec.values();
  rec.close();
  const seg = (i: number) => segments(times, vals[i]!, end);
  const run: Run = {
    end,
    clk1: seg(0),
    clk2: seg(1),
    q1: seg(2),
    d2: seg(3),
    q2: seg(4),
    captures: [],
    warnings: engine.messages.filter((m) => m.level === 'warning').map((m) => m.text),
    works: true,
  };
  // Edge 0 of the capture flip-flop sees the gates still settling from power-up; its warning is not the design's.
  const first = p.period / 2 + Math.max(0, p.skew);
  const real = engine.messages.filter((m) => m.level === 'warning' && m.time * 1e9 > first + p.hold + 0.001);
  const warnAt = real.map((m) => m.time * 1e9);
  run.warnings = real.map((m) => m.text);
  const late = Math.max(0, p.skew);
  // Capture edge 0 is skipped: the gates have not settled from power-up, so it catches X (and says nothing useful).
  for (let k = 1; k < cycles; k++) {
    const time = p.period / 2 + k * p.period + late;
    const next = time + p.period;
    if (next > end) break;
    // The launch flip-flop has toggled k times before capture edge k (its edge k is the same one, moved by the skew).
    // Edge k should catch what edge k − 1 launched: 1 after an odd number of launches.
    const expected = k % 2;
    const got = valueAt(run.q2, next - 0.01);
    // A violation is reported at the edge (set-up) or at the data change just after it (hold).
    const meta = warnAt.some((t) => t >= time - 0.001 && t <= time + p.hold + 0.001);
    const verdict: EdgeVerdict = meta ? 'metastable' : got === expected ? 'ok' : 'wrong';
    run.captures.push({ time, expected, got: meta ? 2 : got, verdict });
  }
  run.works = run.captures.every((c) => c.verdict === 'ok');
  return run;
}
