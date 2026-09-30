import type { ElementState } from '../../engine';
import {
  bool,
  branchIncidence,
  conductance,
  currentSource,
  num,
  volt,
  voltageSource,
  type AnalogDevice,
  type DeviceEnv,
  type StampContext,
} from '../device';
import { registerAnalogModel } from './registry';

/** Supply voltage of the behavioural logic parts (toggle, gates, …). */
export const VDD = 5;

/**
 * Sources. State keys:
 *  - rail: { value } — its voltage.
 *  - battery: { value } — terminal voltage (+ relative to −); `current` — current delivered out of +.
 *  - supply: { cc } — true while current limiting (the CC light); `value` — output voltage; `current`.
 *  - siggen: { value } — the source voltage now.
 *  - toggle / button / const / clock (logic sources, 0 V or 5 V to ground): { value } — 0 or 1 (logic), `on`.
 *
 * setParam: any catalog parameter (`voltage`, `resistance`, `limit`, `waveform`, `frequency`,
 * `amplitude`, `offset`, `duty`, `rise`, `on`, `pressed`, `value`).
 */

// ---------------------------------------------------------------------------------------------
// Rail: an ideal voltage source from ground to its net. Rails of the same voltage share a net
// (connect() joins them by name); only the first one on a net is stamped, the others are shadows,
// since several ideal sources in parallel make the matrix singular.

registerAnalogModel('rail', (env) => {
  const p = { ...env.element.params };
  const node = env.nodes[0]!;
  const k = env.branch();
  const key = `rail:${node}`;
  const first = env.shared.get(key) as { id: string; V: number } | undefined;
  let shadow = false;
  const V = () => num(p, 'voltage', 5);
  if (node < 0) {
    shadow = true;
    if (V() !== 0) env.message('error', `${env.element.id}: a ${V()} V rail is connected to ground (a short circuit). It is ignored.`);
  } else if (first) {
    shadow = true;
    if (first.V !== V()) env.message('error', `${env.element.id}: rails at ${first.V} V (${first.id}) and ${V()} V are connected together. The second is ignored.`);
  } else env.shared.set(key, { id: env.element.id, V: V() });
  return {
    stamp(c) {
      if (shadow) {
        // Keep the branch row non-singular: i = 0.
        c.A[k * c.n + k] = c.A[k * c.n + k]! + 1;
        return;
      }
      voltageSource(c, node, -1, k, V());
    },
    current: (_pin, x) => (shadow ? 0 : x[k]!),
    state: (): ElementState => ({ value: V() }),
    setParam(key, value) {
      p[key] = value;
    },
    reset() {},
  };
});

// ---------------------------------------------------------------------------------------------
// Battery: an ideal source in series with its internal resistance, stamped as its Norton
// equivalent (no extra unknown). Pins: −, +.

registerAnalogModel('battery', (env) => {
  const p = { ...env.element.params };
  const [m, pl] = [env.nodes[0]!, env.nodes[1]!];
  const r = () => Math.max(1e-6, num(p, 'resistance', 0.2));
  const V = () => num(p, 'voltage', 9);
  // Current into + = (v+ − v− − V)/r.
  const iPlus = (x: Float64Array) => (volt(x, pl) - volt(x, m) - V()) / r();
  return {
    stamp(c) {
      const g = 1 / r();
      conductance(c, pl, m, g);
      currentSource(c, pl, m, -V() * g);
    },
    current: (pin, x) => (pin === 1 ? iPlus(x) : -iPlus(x)),
    state: (x) => ({ value: volt(x, pl) - volt(x, m), current: -iPlus(x) }),
    setParam(key, value) {
      p[key] = value;
    },
    reset() {},
  };
});

// ---------------------------------------------------------------------------------------------
// Bench supply: a voltage source (CV) that becomes a current source at its limit (CC). The mode is
// chosen after each converged solve: CV → CC when the output current exceeds the limit, CC → CV
// when the output voltage would exceed the set voltage.

registerAnalogModel('supply', (env) => {
  const p = { ...env.element.params };
  const [m, pl] = [env.nodes[0]!, env.nodes[1]!];
  const k = env.branch();
  const shorted = m === pl;
  let cc = shorted;
  const V = () => num(p, 'voltage', 5);
  const limit = () => Math.max(1e-6, num(p, 'limit', 0.5));
  return {
    nonlinear: false,
    stamp(c) {
      if (cc) {
        branchIncidence(c, pl, m, k);
        c.A[k * c.n + k] = c.A[k * c.n + k]! + 1;
        c.b[k] = c.b[k]! + (-limit());
      } else voltageSource(c, pl, m, k, V());
    },
    check(x) {
      if (shorted) return false;
      const i = x[k]!;
      if (!cc && -i > limit() * (1 + 1e-9)) {
        cc = true;
        return true;
      }
      if (cc && volt(x, pl) - volt(x, m) > V() + 1e-9 * Math.max(1, Math.abs(V()))) {
        cc = false;
        return true;
      }
      return false;
    },
    current: (pin, x) => (pin === 1 ? x[k]! : -x[k]!),
    state: (x) => ({ cc, value: volt(x, pl) - volt(x, m), current: -x[k]! }),
    setParam(key, value) {
      p[key] = value;
    },
    reset() {
      cc = shorted;
    },
  };
});

// ---------------------------------------------------------------------------------------------
// Waveforms (function generator and logic clock).

export interface Wave {
  kind: string;
  frequency: number;
  amplitude: number;
  offset: number;
  duty: number;
  rise: number;
}

/** Low and high levels, and the edge time actually used (at most half of the shorter phase). */
function levels(w: Wave): { lo: number; hi: number; r: number; T: number; d: number } {
  const T = 1 / Math.max(1e-12, w.frequency);
  const d = Math.min(0.999, Math.max(0.001, w.duty));
  const r = Math.max(0, Math.min(w.rise, 0.5 * Math.min(d, 1 - d) * T));
  // Square: offset ± amplitude. Pulse (SPICE PULSE style): rests at offset, pulses to offset + amplitude.
  if (w.kind === 'pulse') return { lo: w.offset, hi: w.offset + w.amplitude, r, T, d };
  return { lo: w.offset - w.amplitude, hi: w.offset + w.amplitude, r, T, d };
}

/**
 * Value of a waveform at time t. Every period starts with the rising edge at t = k·T:
 *  - square / pulse: rise over `rise`, high until duty·T, fall over `rise`, low for the rest;
 *  - sine: offset + amplitude·sin(2πft);
 *  - triangle: from offset − amplitude up to offset + amplitude at T/2 and back.
 */
export function waveValue(w: Wave, t: number): number {
  if (w.kind === 'sine') return w.offset + w.amplitude * Math.sin(2 * Math.PI * w.frequency * t);
  const { lo, hi, r, T, d } = levels(w);
  const ph = t - Math.floor(t / T) * T;
  if (w.kind === 'triangle') {
    const u = ph / T;
    return w.offset + w.amplitude * (u < 0.5 ? -1 + 4 * u : 3 - 4 * u);
  }
  const dT = d * T;
  if (ph < r) return lo + ((hi - lo) * ph) / r;
  if (ph < dT) return hi;
  if (ph < dT + r) return hi - ((hi - lo) * (ph - dT)) / r;
  return lo;
}

/** Next corner of the waveform strictly after t (edges of square and pulse, peaks of the triangle). */
export function waveBreakpoint(w: Wave, t: number): number {
  if (w.kind === 'sine') return Infinity;
  const { r, T, d } = levels(w);
  const corners = w.kind === 'triangle' ? [0, T / 2] : [0, r, d * T, d * T + r];
  const eps = Math.max(1e-12 * T, Math.abs(t) * 1e-14);
  const k0 = Math.floor(t / T);
  for (let k = k0; k <= k0 + 1; k++) {
    for (const c of corners) {
      const tc = k * T + c;
      if (tc > t + eps) return tc;
    }
  }
  return (k0 + 2) * T;
}

registerAnalogModel('siggen', (env) => {
  const p = { ...env.element.params };
  const [m, pl] = [env.nodes[0]!, env.nodes[1]!];
  const k = env.branch();
  const wave = (): Wave => ({
    kind: String(p.waveform ?? 'square'),
    frequency: num(p, 'frequency', 1000),
    amplitude: num(p, 'amplitude', 2.5),
    offset: num(p, 'offset', 2.5),
    duty: num(p, 'duty', 0.5),
    rise: num(p, 'rise', 1e-9),
  });
  let w = wave();
  let now = 0;
  return {
    stamp(c) {
      now = c.t;
      voltageSource(c, pl, m, k, waveValue(w, c.t));
    },
    breakpoint: (t) => waveBreakpoint(w, t),
    maxStep: () => (w.kind === 'sine' ? 1 / (20 * w.frequency) : Infinity),
    current: (pin, x) => (pin === 1 ? x[k]! : -x[k]!),
    state: () => ({ value: waveValue(w, now) }),
    setParam(key, value) {
      p[key] = value;
      w = wave();
    },
    reset() {
      now = 0;
    },
  };
});

// ---------------------------------------------------------------------------------------------
// Logic-level sources: an ideal 0 V / 5 V source from ground to pin Y.

function logicSource(env: DeviceEnv, level: (t: number) => number, extra?: Partial<AnalogDevice>): AnalogDevice {
  const node = env.nodes[0]!;
  const k = env.branch();
  let now = 0;
  return {
    stamp(c: StampContext) {
      now = c.t;
      if (node < 0) {
        c.A[k * c.n + k] = c.A[k * c.n + k]! + 1;
        return;
      }
      voltageSource(c, node, -1, k, level(c.t));
    },
    current: (_pin, x) => (node < 0 ? 0 : x[k]!),
    state: () => {
      const v = level(now);
      return { value: v > VDD / 2 ? 1 : 0, on: v > VDD / 2 };
    },
    setParam() {},
    reset() {
      now = 0;
    },
    ...extra,
  };
}

registerAnalogModel('toggle', (env) => {
  const p = { ...env.element.params };
  return logicSource(env, () => (bool(p, 'on') ? VDD : 0), {
    setParam(key, value) {
      p[key] = value;
    },
  });
});

registerAnalogModel('button', (env) => {
  const p = { ...env.element.params };
  return logicSource(env, () => (bool(p, 'pressed') ? VDD : 0), {
    setParam(key, value) {
      p[key] = value;
    },
  });
});

registerAnalogModel('const', (env) => {
  const p = { ...env.element.params };
  return logicSource(env, () => (num(p, 'value', 1) ? VDD : 0), {
    setParam(key, value) {
      p[key] = value;
    },
  });
});

registerAnalogModel('clock', (env) => {
  const p = { ...env.element.params };
  const wave = (): Wave => {
    const f = num(p, 'frequency', 1);
    return { kind: 'pulse', frequency: f, amplitude: VDD, offset: 0, duty: num(p, 'duty', 0.5), rise: Math.min(1e-9, 1e-3 / f) };
  };
  let w = wave();
  return logicSource(env, (t) => waveValue(w, t), {
    breakpoint: (t) => waveBreakpoint(w, t),
    setParam(key, value) {
      p[key] = value;
      w = wave();
    },
  });
});
