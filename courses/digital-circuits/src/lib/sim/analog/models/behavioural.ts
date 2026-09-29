import { L0, L1, LX, type Logic } from '../../netlist/types';
import { CapacitorState, conductance, num, volt, type AcceptContext, type AnalogDevice, type DeviceEnv, type StampContext } from '../device';
import { VDD } from './sources';
import { registerAnalogModel } from './registry';

/**
 * Behavioural parts: logic gates, comparator, logic indicator and probe, meters.
 *
 * These are grounded models: they return current through an implicit ground (their supply), so
 * for them the currents of their pins do not sum to zero.
 *
 * Logic gates (not, buffer, and, or, nand, nor, xor, xnor, with 1–8 inputs):
 *  - inputs: high impedance with 5 pF to ground; each input's level is a logistic function
 *    s = 1/(1 + e^(−(v − 2.5 V)/50 mV)), a smooth but narrow switching threshold at 2.5 V;
 *  - logic: the Boolean function extended to real numbers in [0, 1] (AND = product, OR = 1 − Π(1 − s),
 *    XOR = a + b − 2ab), so it is smooth and Newton–Raphson converges;
 *  - delay: an internal node m follows 5 V·f(s) through a first-order lag, RC = delay/ln 2, so a
 *    step at the input crosses 50 % at the output after the gate's `delay` (ns). delay 0 → no lag;
 *  - output: m drives Y through 50 Ω.
 *  State: { value: 0 | 1 (output above 2.5 V) }.
 *
 * Comparator: output = high·(1 + tanh((v₊ − v₋ ± 1 mV)/5 mV))/2 through 10 Ω, with ±1 mV of
 * hysteresis around the last accepted output state; inputs draw nothing. State: { value: 0 | 1 }.
 *
 * Indicator (logic LED with its own driver): 1 MΩ and 5 pF to ground. State: { lit (above 2.5 V),
 * brightness (0 at 2.5 V to 1 at 4.5 V), value (0 | 1) }.
 *
 * Probe: 1 GΩ to ground. State: { value: 0, 1 or 2 (X), level: '0' | '1' | 'X', voltage } from
 * 5 V CMOS thresholds: below 1.5 V → 0, above 3.5 V → 1, otherwise X.
 *
 * Voltmeter: 10 MΩ between − and +; state { value: V(+) − V(−) }.
 * Ammeter: 0.1 Ω; state { value: current from + to − through it }.
 */

export const LOGIC_THRESHOLD = VDD / 2;
const LOGIC_WIDTH = 0.1;
const GATE_CIN = 5e-12;
const GATE_ROUT = 50;
/** Conductance of the delay node's RC (1 S, so C = τ farads). */
const GATE_GM = 1;

export function logicLevel(v: number): Logic {
  if (!Number.isFinite(v)) return LX;
  if (v < 1.5) return L0;
  if (v > 3.5) return L1;
  return LX;
}

type LogicFn = (s: number[], df: number[]) => number;

const and: LogicFn = (s, df) => {
  let f = 1;
  for (let i = 0; i < s.length; i++) {
    let d = 1;
    for (let j = 0; j < s.length; j++) if (j !== i) d *= s[j]!;
    df[i] = d;
    f *= s[i]!;
  }
  return f;
};
const or: LogicFn = (s, df) => {
  let q = 1;
  for (let i = 0; i < s.length; i++) {
    let d = 1;
    for (let j = 0; j < s.length; j++) if (j !== i) d *= 1 - s[j]!;
    df[i] = d;
    q *= 1 - s[i]!;
  }
  return 1 - q;
};
const xor: LogicFn = (s, df) => {
  // f ← f + s − 2·f·s, input by input, carrying the derivatives along.
  let f = s[0]!;
  df[0] = 1;
  for (let i = 1; i < s.length; i++) {
    const si = s[i]!;
    const k = 1 - 2 * si;
    for (let j = 0; j < i; j++) df[j] = df[j]! * k;
    df[i] = 1 - 2 * f;
    f = f + si - 2 * f * si;
  }
  return f;
};
const invert =
  (fn: LogicFn): LogicFn =>
  (s, df) => {
    const f = fn(s, df);
    for (let i = 0; i < s.length; i++) df[i] = -df[i]!;
    return 1 - f;
  };
const buffer: LogicFn = (s, df) => {
  df[0] = 1;
  return s[0]!;
};

export const LOGIC_FUNCTIONS: Record<string, LogicFn> = {
  buffer,
  not: invert(buffer),
  and,
  nand: invert(and),
  or,
  nor: invert(or),
  xor,
  xnor: invert(xor),
};

function gate(env: DeviceEnv, fn: LogicFn): AnalogDevice {
  const p = { ...env.element.params };
  const ins = env.nodes.slice(0, -1);
  const out = env.nodes[env.nodes.length - 1]!;
  const m = env.internal();
  const caps = ins.map((i) => new CapacitorState(GATE_CIN, i, -1));
  const tau = () => (Math.max(0, num(p, 'delay', 1)) * 1e-9) / Math.LN2;
  const lag = new CapacitorState(tau() * GATE_GM, m, -1);
  const s = new Array<number>(ins.length).fill(0);
  const ds = new Array<number>(ins.length).fill(0);
  const df = new Array<number>(ins.length).fill(0);
  const init = () => {
    for (const c of caps) c.reset(0);
    // A tiny seeded offset breaks the symmetry of cross-coupled gates at power-on.
    lag.reset(0.01 * env.random());
  };
  init();
  return {
    nonlinear: true,
    stamp(c: StampContext) {
      for (const cap of caps) cap.stamp(c);
      lag.stamp(c);
      for (let i = 0; i < ins.length; i++) {
        const z = (volt(c.x, ins[i]!) - LOGIC_THRESHOLD) / LOGIC_WIDTH;
        const si = 1 / (1 + Math.exp(-z));
        s[i] = si;
        ds[i] = (si * (1 - si)) / LOGIC_WIDTH;
      }
      const f = fn(s, df);
      const n = c.n;
      // Row m: G·(x_m − VDD·f(v)) = 0, linearised in the input voltages.
      c.A[m * n + m] = c.A[m * n + m]! + GATE_GM;
      let rhs = f;
      for (let i = 0; i < ins.length; i++) {
        const g = df[i]! * ds[i]!;
        const node = ins[i]!;
        if (node >= 0) c.A[m * n + node] = c.A[m * n + node]! - (GATE_GM * VDD * g);
        rhs -= g * volt(c.x, node);
      }
      c.b[m] = c.b[m]! + (GATE_GM * VDD * rhs);
      // Output: Y through R_out to the voltage of m.
      conductance(c, out, -1, 1 / GATE_ROUT);
      if (out >= 0) c.A[out * n + m] = c.A[out * n + m]! - (1 / GATE_ROUT);
    },
    accept(c: AcceptContext) {
      for (const cap of caps) cap.accept(c.x);
      lag.accept(c.x);
    },
    current(pin, x) {
      if (pin < ins.length) return caps[pin]!.current(x);
      return (volt(x, out) - x[m]!) / GATE_ROUT;
    },
    state: (x) => ({ value: volt(x, out) > LOGIC_THRESHOLD ? 1 : 0 }),
    setParam(key, value) {
      p[key] = value;
      lag.C = tau() * GATE_GM;
    },
    reset: init,
  };
}

for (const [type, fn] of Object.entries(LOGIC_FUNCTIONS)) registerAnalogModel(type, (env) => gate(env, fn));

// ---------------------------------------------------------------------------------------------

const CMP_WIDTH = 5e-3;
const CMP_HYST = 1e-3;
const CMP_ROUT = 10;

registerAnalogModel('comparator', (env) => {
  const p = { ...env.element.params };
  const [ip, im, out] = [env.nodes[0]!, env.nodes[1]!, env.nodes[2]!];
  let high = false;
  const hi = () => num(p, 'high', 5);
  const vd = (x: Float64Array) => volt(x, ip) - volt(x, im) + (high ? CMP_HYST : -CMP_HYST);
  const vout = (d: number) => (hi() * (1 + Math.tanh(d / CMP_WIDTH))) / 2;
  return {
    nonlinear: true,
    stamp(c) {
      const d = vd(c.x);
      const th = Math.tanh(d / CMP_WIDTH);
      const g = (hi() * (1 - th * th)) / (2 * CMP_WIDTH);
      const v0 = vout(d);
      const G = 1 / CMP_ROUT;
      // Current into Y = G·(vY − vout(v₊ − v₋)), linearised.
      conductance(c, out, -1, G);
      if (out >= 0) {
        if (ip >= 0) c.A[out * c.n + ip] = c.A[out * c.n + ip]! - (G * g);
        if (im >= 0) c.A[out * c.n + im] = c.A[out * c.n + im]! + (G * g);
        c.b[out] = c.b[out]! + (G * (v0 - g * (volt(c.x, ip) - volt(c.x, im))));
      }
    },
    accept(c) {
      high = volt(c.x, out) > hi() / 2;
    },
    current: (pin, x) => (pin === 2 ? (volt(x, out) - vout(vd(x))) / CMP_ROUT : 0),
    state: (x) => ({ value: volt(x, out) > hi() / 2 ? 1 : 0 }),
    setParam(key, value) {
      p[key] = value;
    },
    reset() {
      high = false;
    },
  };
});

// ---------------------------------------------------------------------------------------------

const INDICATOR_R = 1e6;

registerAnalogModel('indicator', (env) => {
  const a = env.nodes[0]!;
  const cap = new CapacitorState(GATE_CIN, a, -1);
  return {
    stamp(c) {
      conductance(c, a, -1, 1 / INDICATOR_R);
      cap.stamp(c);
    },
    accept(c) {
      cap.accept(c.x);
    },
    current: (_pin, x) => volt(x, a) / INDICATOR_R + cap.current(x),
    state(x) {
      const v = volt(x, a);
      return { lit: v > LOGIC_THRESHOLD, brightness: Math.max(0, Math.min(1, (v - LOGIC_THRESHOLD) / 2)), value: v > LOGIC_THRESHOLD ? 1 : 0 };
    },
    setParam() {},
    reset() {
      cap.reset(0);
    },
  };
});

registerAnalogModel('probe', (env) => {
  const a = env.nodes[0]!;
  return {
    stamp(c) {
      conductance(c, a, -1, 1e-9);
    },
    current: (_pin, x) => volt(x, a) * 1e-9,
    state(x) {
      const v = volt(x, a);
      const l = logicLevel(v);
      return { value: l, level: l === L0 ? '0' : l === L1 ? '1' : 'X', voltage: v };
    },
    setParam() {},
    reset() {},
  };
});

// ---------------------------------------------------------------------------------------------

function meter(env: DeviceEnv, R: number, pinPlus: number, show: (v: number, i: number) => number): AnalogDevice {
  const [a, b] = [env.nodes[0]!, env.nodes[1]!];
  const g = 1 / R;
  // Current into pin 0 flows from pin 0 to pin 1.
  const i0 = (x: Float64Array) => g * (volt(x, a) - volt(x, b));
  return {
    stamp(c) {
      conductance(c, a, b, g);
    },
    current: (pin, x) => (pin === 0 ? i0(x) : -i0(x)),
    state(x) {
      const vPlus = pinPlus === 0 ? volt(x, a) - volt(x, b) : volt(x, b) - volt(x, a);
      const iPlus = pinPlus === 0 ? i0(x) : -i0(x);
      return { value: show(vPlus, iPlus) };
    },
    setParam() {},
    reset() {},
  };
}

// Voltmeter pins: −, +. Ammeter pins: +, −.
registerAnalogModel('voltmeter', (env) => meter(env, 1e7, 1, (v) => v));
registerAnalogModel('ammeter', (env) => meter(env, 0.1, 0, (_v, i) => i));
