import type { ElementState, EngineMessage } from '../engine';
import type { FlatElement, ParamValue, Params } from '../netlist/types';

/**
 * The contract between the analog engine and its device models, plus the stamping helpers the
 * models share.
 *
 * Unknowns: index 0 … nodes−1 are net voltages (ground is not an unknown and has index −1), then
 * device-allocated unknowns: internal node voltages (`env.internal()`) and branch currents
 * (`env.branch()`). The matrix is row-major: A[r·n + c].
 *
 * Sign conventions:
 *  - A node's row sums the currents *leaving* the node into device pins; so a device whose pin p
 *    draws current i(v) from node p adds ∂i/∂v to row p and moves the constant part to b.
 *  - `current(pin)` is the current flowing *into* the pin from its net.
 *  - A branch current of a voltage source flows into its + pin, through the source, out of its −.
 */

/** Thermal voltage kT/q at 300 K. */
export const VT = 0.025852;
/** Conductance from every node to ground so floating nets do not make the matrix singular. */
export const GMIN = 1e-12;
/** A closed contact: 10 mΩ. */
export const G_CLOSED = 100;
/** An open contact or a burned-open part: 1 TΩ. */
export const G_OPEN = 1e-12;

export type Method = 'euler' | 'trapezoidal';

export interface StampContext {
  readonly n: number;
  readonly A: Float64Array;
  readonly b: Float64Array;
  /** The Newton iterate the devices linearise around. */
  readonly x: Float64Array;
  /** Time of the point being solved. */
  readonly t: number;
  /** Step from the last accepted point (the "settle" solve uses a tiny step with state frozen). */
  readonly h: number;
  readonly method: Method;
  /** Extra junction conductance during gmin stepping (0 normally). */
  readonly gmin: number;
  /** Devices set this when they limited a junction voltage: the iteration has not converged. */
  limited: boolean;
}

export interface AcceptContext {
  readonly x: Float64Array;
  /** Time of the accepted point. */
  readonly t: number;
  readonly h: number;
  readonly method: Method;
}

/** What a model factory gets from the engine. */
export interface DeviceEnv {
  readonly element: FlatElement;
  /** Unknown index of each pin's net, −1 for ground. */
  readonly nodes: readonly number[];
  /** Allocate an internal node (a voltage unknown). Only while the device is being created. */
  internal(): number;
  /** Allocate a branch current unknown. Only while the device is being created. */
  branch(): number;
  /** Seeded random number in [0, 1) (the engine's seed; reset restarts the sequence). */
  random(): number;
  /** Post a message about this element. */
  message(level: EngineMessage['level'], text: string): void;
  /** Simulated time of the last accepted point (s). */
  time(): number;
  /** Coordination between devices of the same circuit (e.g. rails sharing a net). */
  readonly shared: Map<string, unknown>;
}

export interface AnalogDevice {
  /** Needs Newton iterations (its stamp depends on x). */
  readonly nonlinear?: boolean;
  /** Add this device's linearised equations at iterate ctx.x. */
  stamp(ctx: StampContext): void;
  /**
   * After a converged solve: return true if a discrete mode must change (e.g. a supply entering
   * current limit); the point is then solved again.
   */
  check?(x: Float64Array): boolean;
  /**
   * Commit a solved point (capacitor history, temperatures, scheduled contact changes). Return
   * true for a discontinuity (the stamps changed abruptly): the engine restarts with a small step.
   */
  accept?(ctx: AcceptContext): boolean | void;
  /** Next time strictly after t where the device changes abruptly (Infinity if none). */
  breakpoint?(t: number): number;
  /** Largest step the device tolerates right now (Infinity if any). */
  maxStep?(): number;
  /** Current into pin `pin` at solution x. */
  current(pin: number, x: Float64Array): number;
  state(x: Float64Array): ElementState;
  /** Change a parameter. The engine treats the change as a discontinuity. */
  setParam(key: string, value: ParamValue): void;
  /** Back to the initial state (parameters keep their values). */
  reset(): void;
}

export type AnalogModelFactory = (env: DeviceEnv) => AnalogDevice;

// ---------------------------------------------------------------------------------------------
// Stamping helpers. Index −1 is ground and is skipped.

export function addA(c: StampContext, r: number, col: number, v: number): void {
  if (r >= 0 && col >= 0) c.A[r * c.n + col] = c.A[r * c.n + col]! + v;
}

export function addB(c: StampContext, r: number, v: number): void {
  if (r >= 0) c.b[r] = c.b[r]! + v;
}

/** A conductance g between nodes a and b. */
export function conductance(c: StampContext, a: number, b: number, g: number): void {
  const n = c.n;
  const A = c.A;
  if (a >= 0) {
    A[a * n + a] = A[a * n + a]! + g;
    if (b >= 0) {
      A[a * n + b] = A[a * n + b]! - g;
      A[b * n + a] = A[b * n + a]! - g;
    }
  }
  if (b >= 0) A[b * n + b] = A[b * n + b]! + g;
}

/** A constant current j flowing into pin a, through the device, and out of pin b. */
export function currentSource(c: StampContext, a: number, b: number, j: number): void {
  if (a >= 0) c.b[a] = c.b[a]! - j;
  if (b >= 0) c.b[b] = c.b[b]! + j;
}

/** The incidence of branch current k flowing into node p and out of node m (a voltage source's KCL part). */
export function branchIncidence(c: StampContext, p: number, m: number, k: number): void {
  const n = c.n;
  if (p >= 0) c.A[p * n + k] = c.A[p * n + k]! + 1;
  if (m >= 0) c.A[m * n + k] = c.A[m * n + k]! - 1;
}

/** An ideal voltage source V from m to p (x[p] − x[m] = V) using branch k. */
export function voltageSource(c: StampContext, p: number, m: number, k: number, V: number): void {
  branchIncidence(c, p, m, k);
  const n = c.n;
  if (p >= 0) c.A[k * n + p] = c.A[k * n + p]! + 1;
  if (m >= 0) c.A[k * n + m] = c.A[k * n + m]! - 1;
  c.b[k] = c.b[k]! + V;
}

export const volt = (x: Float64Array, i: number): number => (i >= 0 ? x[i]! : 0);

// ---------------------------------------------------------------------------------------------
// Reactive companions.

/**
 * A capacitor between unknowns a and b as a companion model: a conductance g in parallel with a
 * current source j, so i = g·v + j.
 *  - backward Euler:  i₁ = (C/h)(v₁ − v₀)            → g = C/h,  j = −g·v₀
 *  - trapezoidal:     i₁ = (2C/h)(v₁ − v₀) − i₀      → g = 2C/h, j = −g·v₀ − i₀
 */
export class CapacitorState {
  /** Committed voltage and current (last accepted point). */
  v = 0;
  i = 0;
  g = 0;
  j = 0;
  constructor(
    public C: number,
    public a: number,
    public b: number,
  ) {}
  stamp(c: StampContext): void {
    if (!(this.C > 0)) {
      this.g = 0;
      this.j = 0;
      return;
    }
    if (c.method === 'trapezoidal') {
      this.g = (2 * this.C) / c.h;
      this.j = -this.g * this.v - this.i;
    } else {
      this.g = this.C / c.h;
      this.j = -this.g * this.v;
    }
    conductance(c, this.a, this.b, this.g);
    currentSource(c, this.a, this.b, this.j);
  }
  voltage(x: Float64Array): number {
    return volt(x, this.a) - volt(x, this.b);
  }
  current(x: Float64Array): number {
    return this.g * this.voltage(x) + this.j;
  }
  accept(x: Float64Array): void {
    const v = this.voltage(x);
    this.i = this.g * v + this.j;
    this.v = v;
  }
  reset(v0: number): void {
    this.v = v0;
    this.i = 0;
    this.g = 0;
    this.j = 0;
  }
}

/**
 * An inductor L with series resistance R between nodes a and b, carrying branch current k (from a
 * to b). Branch equation, with vL the voltage across the ideal inductance:
 *  - backward Euler:  v₁ − (L/h + R)·i₁ = −(L/h)·i₀
 *  - trapezoidal:     v₁ − (2L/h + R)·i₁ = −(2L/h)·i₀ − vL₀
 */
export class InductorState {
  i = 0;
  vL = 0;
  constructor(
    public L: number,
    public R: number,
    public a: number,
    public b: number,
    public k: number,
  ) {}
  stamp(c: StampContext): void {
    const { a, b, k, n } = { a: this.a, b: this.b, k: this.k, n: c.n };
    branchIncidence(c, a, b, k);
    if (a >= 0) c.A[k * n + a] = c.A[k * n + a]! + 1;
    if (b >= 0) c.A[k * n + b] = c.A[k * n + b]! - 1;
    if (c.method === 'trapezoidal') {
      const z = (2 * this.L) / c.h;
      c.A[k * n + k] = c.A[k * n + k]! - (z + this.R);
      c.b[k] = c.b[k]! + (-z * this.i - this.vL);
    } else {
      const z = this.L / c.h;
      c.A[k * n + k] = c.A[k * n + k]! - (z + this.R);
      c.b[k] = c.b[k]! + (-z * this.i);
    }
  }
  accept(x: Float64Array): void {
    const i = x[this.k]!;
    this.vL = volt(x, this.a) - volt(x, this.b) - this.R * i;
    this.i = i;
  }
  reset(): void {
    this.i = 0;
    this.vL = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Non-linear helpers.

/** e^x, continued linearly above x = 80 so a wild Newton iterate cannot overflow. */
export function safeExp(x: number): number {
  if (x > 80) return Math.exp(80) * (1 + x - 80);
  return Math.exp(x);
}

/** Derivative of safeExp. */
export function safeExpD(x: number): number {
  return x > 80 ? Math.exp(80) : Math.exp(x);
}

/** Critical voltage of a junction (where the exponential's curvature is largest): nVt·ln(nVt/(√2·Is)). */
export function vcrit(nvt: number, is: number): number {
  return nvt * Math.log(nvt / (Math.SQRT2 * is));
}

/**
 * SPICE's junction voltage limiting (pnjlim): above the critical voltage, a Newton step that
 * would increase a junction voltage by more than 2·nVt is replaced by a logarithmic one, so the
 * exponential cannot explode. Returns the limited voltage; sets c.limited when it changed.
 */
export function pnjlim(c: StampContext, vnew: number, vold: number, nvt: number, vcr: number): number {
  if (vnew > vcr && Math.abs(vnew - vold) > 2 * nvt) {
    let v: number;
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / nvt;
      v = arg > 0 ? vold + nvt * Math.log(arg) : vcr;
    } else {
      v = nvt * Math.log(vnew / nvt);
    }
    c.limited = true;
    return v;
  }
  return vnew;
}

/** SPICE's gate–source voltage limiting for MOSFETs (DEVfetlim). */
export function fetlim(c: StampContext, vnew: number, vold: number, vto: number): number {
  const v0 = vnew;
  const vtsthi = Math.abs(2 * (vold - vto)) + 2;
  const vtstlo = vtsthi / 2 + 2;
  const vtox = vto + 3.5;
  const delv = vnew - vold;
  if (vold >= vto) {
    if (vold >= vtox) {
      if (delv <= 0) {
        if (vnew >= vtox) {
          if (-delv > vtstlo) vnew = vold - vtstlo;
        } else vnew = Math.max(vnew, vto + 2);
      } else if (delv >= vtsthi) vnew = vold + vtsthi;
    } else if (delv <= 0) vnew = Math.max(vnew, vto - 0.5);
    else vnew = Math.min(vnew, vto + 4);
  } else if (delv <= 0) {
    if (-delv > vtsthi) vnew = vold - vtsthi;
  } else {
    const vtemp = vto + 0.5;
    if (vnew <= vtemp) {
      if (delv > vtstlo) vnew = vold + vtstlo;
    } else vnew = vtemp;
  }
  if (vnew !== v0) c.limited = true;
  return vnew;
}

/** SPICE's drain–source voltage limiting for MOSFETs (DEVlimvds). */
export function limvds(c: StampContext, vnew: number, vold: number): number {
  const v0 = vnew;
  if (vold >= 3.5) {
    if (vnew > vold) vnew = Math.min(vnew, 3 * vold + 2);
    else if (vnew < 3.5) vnew = Math.max(vnew, 2);
  } else if (vnew > vold) vnew = Math.min(vnew, 4);
  else vnew = Math.max(vnew, -0.5);
  if (vnew !== v0) c.limited = true;
  return vnew;
}

/** First-order relaxation of `value` towards `target` over h with time constant tau (exact for constant target). */
export function relax(value: number, target: number, h: number, tau: number): number {
  return target + (value - target) * Math.exp(-h / tau);
}

// ---------------------------------------------------------------------------------------------
// Parameters and text.

export const num = (p: Params, key: string, fallback: number): number => {
  const v = p[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : typeof v === 'boolean' ? (v ? 1 : 0) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const bool = (p: Params, key: string, fallback = false): boolean => {
  const v = p[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return fallback;
};

const PREFIXES: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
];

/** A value with an SI prefix and 2–3 significant digits: 0.9 W, 25 mA, 4.7 kΩ. Values from 0.1 to 1 keep no prefix. */
export function si(value: number, unit: string): string {
  if (!Number.isFinite(value)) return `${value} ${unit}`;
  const a = Math.abs(value);
  if (a === 0) return `0 ${unit}`;
  if (a >= 0.1 && a < 1) return `${trim(value.toPrecision(2))} ${unit}`;
  for (const [f, p] of PREFIXES) {
    if (a >= f) return `${trim((value / f).toPrecision(a / f >= 100 ? 3 : 2))} ${p}${unit}`;
  }
  return `${trim((value / 1e-12).toPrecision(2))} p${unit}`;
}

const trim = (s: string) => (s.includes('e') ? String(Number(s)) : s.includes('.') ? s.replace(/\.?0+$/, '') : s);
