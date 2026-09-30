import type { ElementState, Engine, EngineMessage, EngineOptions, Recorder } from '../engine';
import type { FlatElement, FlatNetlist, Logic, ParamValue } from '../netlist/types';
import { GMIN, CapacitorState, InductorState, type AcceptContext, type AnalogDevice, type DeviceEnv, type Method, type StampContext } from './device';
import { DenseLU } from './lu';
import { getAnalogModel } from './models';
import { logicLevel } from './models/behavioural';
import { SampleRecorder } from './recorder';
import { mulberry32 } from './rng';

/**
 * The analog engine: modified nodal analysis, transient analysis with companion models,
 * Newton–Raphson for non-linear devices.
 *
 * Unknowns are the voltages of the nets that have element pins (ground excluded), then internal
 * nodes and branch currents allocated by the devices. Every time point solves A·x = b, where each
 * device "stamps" its linearised equations; Newton–Raphson repeats this until x stops moving.
 *
 * Time steps:
 *  - adaptive (default): each step is checked against a local truncation error estimate (the
 *    difference between the solution and a polynomial predictor through the previous points,
 *    scaled to the integration method's error constant). A step whose error is above tolerance is
 *    retried with a smaller one; otherwise the next step grows (at most ×4). The step never
 *    exceeds `options.step` (default 10 ms), a device's own limit (a warming lamp, a sine), or the
 *    distance to the next breakpoint (source edges, switch bounces, relay contact changes);
 *  - after every breakpoint or parameter change the step restarts small and the first step uses
 *    backward Euler, as in SPICE, so the trapezoidal rule does not ring on the jump. The restart
 *    step is min(1 ns, 1e-3 × the fastest RC or L/R time constant estimated from the circuit as it
 *    is now, 1/100 of the interval advance() was asked for), at least 1 fs (startStep());
 *  - `fixedStep: true` uses exactly `options.step` (default 1 µs) with the chosen method throughout,
 *    to show how the methods behave (Chapter 4).
 *
 * Linear algebra: dense LU with partial pivoting on row-equilibrated rows and one step of iterative
 * refinement (lu.ts); the factorisation is reused while the matrix is unchanged, so a linear
 * circuit with a steady step costs only a forward/back substitution per point. All buffers are
 * allocated once.
 *
 * Work per advance(): capped by `maxStepsPerAdvance` (1000) and by `maxWorkPerAdvance` (5e7
 * multiply–adds, about 30 ms), optionally by a wall-clock `budgetMs`. When a cap stops the loop,
 * `lagging` is set, `speed` is < 1 and an info message is posted; simulated time then simply falls
 * behind the requested time.
 *
 * Newton–Raphson: at most 40 iterations per point; junction voltages are limited (pnjlim,
 * fetlim). If a point fails, the step is divided by 8 and retried; at the smallest step, gmin
 * stepping (1e-2 S down to 0 on every node) is tried (not again for the next 100 steps if it
 * fails: it is expensive); if that fails too, the last iterate is accepted and a warning posted.
 */

export interface AnalogEngineOptions extends EngineOptions {
  /** Integration method (default backward Euler). */
  method?: Method;
  /** Use a fixed step of `step` seconds (no error control, no breakpoints). */
  fixedStep?: boolean;
  /** Cap on internal steps per advance() call, so a frame never freezes (default 1000). */
  maxStepsPerAdvance?: number;
  /**
   * Cap on the arithmetic done by one advance() call, in multiply–adds (default 5e7, roughly 30 ms
   * on a laptop for any circuit size): larger circuits get fewer steps per call. Deterministic.
   */
  maxWorkPerAdvance?: number;
  /**
   * Optional wall-clock budget for one advance() call, in milliseconds (default: none). A UI
   * loop sets it to a fraction of the frame time. Unlike the caps above it depends on the machine,
   * so tests should not use it.
   */
  budgetMs?: number;
  /**
   * Relative local truncation error tolerance per step (default 1e-4 for backward Euler, whose
   * errors accumulate over many steps, and 5e-4 for the trapezoidal rule).
   */
  lteTol?: number;
}

export interface AnalogStats {
  /** Accepted time points. */
  steps: number;
  /** Steps retried with a smaller step (truncation error or no convergence). */
  rejected: number;
  /** Newton iterations (linear solves). */
  iterations: number;
  /** LU factorisations (solves reuse the factorisation when the matrix did not change). */
  factorizations: number;
  /** Points accepted without convergence. */
  failures: number;
}

export interface AnalogEngine extends Engine {
  readonly kind: 'analog';
  readonly method: Method;
  readonly stats: AnalogStats;
  /** True when the last advance() hit the work cap before reaching the requested time. */
  readonly lagging: boolean;
  /** Simulated time covered by the last advance() divided by the time requested (1 = on time). */
  readonly speed: number;
  /** Number of unknowns. */
  readonly size: number;
  /** Size of the last accepted internal step (s). */
  readonly lastStep: number;
}

const DEFAULT_MAX_STEP = 1e-2;
const DEFAULT_FIXED_STEP = 1e-6;
const H_START = 1e-9;
/** The first step after a breakpoint is this fraction of the fastest time constant found (see startStep). */
const START_TAU_FRACTION = 1e-3;
/** … but not more than this fraction of the interval an advance() call asked for. */
const START_DT_FRACTION = 1e-2;
/** Step used to assemble the matrix when estimating time constants (any small value: its companion conductances are subtracted). */
const PROBE_H = 1e-9;
const H_MIN = 1e-15;
const MAX_GROW = 4;
const SETTLE_H = 1e-12;
const RELTOL = 1e-6;
const VNTOL = 1e-8;
const ABSTOL = 1e-11;
const LTE_ABS_V = 1e-5;
const LTE_ABS_I = 1e-8;
const MAXITER = 40;
const MAXITER_SETTLE = 200;
const MAX_MESSAGES = 200;

export function createAnalogEngine(netlist: FlatNetlist, options?: AnalogEngineOptions): AnalogEngine {
  return new AnalogEngineImpl(netlist, options ?? {});
}

interface Entry {
  el: FlatElement;
  dev: AnalogDevice;
}

class AnalogEngineImpl implements AnalogEngine {
  readonly kind = 'analog' as const;
  readonly netlist: FlatNetlist;
  readonly messages: EngineMessage[] = [];
  readonly stats: AnalogStats = { steps: 0, rejected: 0, iterations: 0, factorizations: 0, failures: 0 };
  readonly method: Method;
  lagging = false;
  speed = 1;
  lastStep = 0;

  private t = 0;
  private readonly fixed: boolean;
  private readonly hmax: number;
  private readonly hFixed: number;
  private readonly maxSteps: number;
  private readonly maxWork: number;
  private readonly budgetMs: number;
  /** Arithmetic done since the start of the current advance() (multiply–adds, roughly). */
  private work = 0;
  private readonly lteTol: number;
  private readonly seed: number;
  private rng: () => number;

  private readonly ground: number;
  private readonly netNode: Int32Array;
  private readonly entries: Entry[] = [];
  private readonly byId = new Map<string, Entry>();
  private readonly devices: AnalogDevice[] = [];
  private readonly checkers: AnalogDevice[] = [];
  private readonly accepters: AnalogDevice[] = [];
  private readonly timed: AnalogDevice[] = [];
  private readonly limiters: AnalogDevice[] = [];
  private readonly reactors: AnalogDevice[] = [];
  /** The interval the current advance() call was asked for (s). */
  private reqDt = Infinity;
  private readonly nonlinear: boolean;
  private readonly n: number;
  private readonly isCurrent: Uint8Array;

  private readonly A: Float64Array;
  private readonly Af: Float64Array;
  private readonly b: Float64Array;
  private x: Float64Array;
  private readonly xn: Float64Array;
  /** Accepted solutions: now, one and two points back (for the predictor). */
  private xAcc: Float64Array;
  private x1: Float64Array;
  private x2: Float64Array;
  private t1 = 0;
  private t2 = 0;
  private readonly lu: DenseLU;
  private factored = false;
  private consistent = true;
  private readonly ctx: StampContext & { t: number; h: number; method: Method; gmin: number };

  /** Steps during which gmin stepping is not tried again (it has just failed: it is expensive). */
  private gminCooldown = 0;
  private sinceBreak = 0;
  private hNext = H_START;
  private breakPending = true;
  private pending = 0;
  private readonly recorders = new Set<SampleRecorder>();
  private readonly structural: EngineMessage[] = [];
  private readonly posted = new Set<string>();

  constructor(netlist: FlatNetlist, options: AnalogEngineOptions) {
    this.netlist = netlist;
    this.method = options.method ?? 'euler';
    this.fixed = options.fixedStep ?? false;
    this.hmax = options.step && options.step > 0 ? options.step : DEFAULT_MAX_STEP;
    this.hFixed = options.step && options.step > 0 ? options.step : DEFAULT_FIXED_STEP;
    this.maxSteps = options.maxStepsPerAdvance ?? 1000;
    this.maxWork = options.maxWorkPerAdvance ?? 5e7;
    this.budgetMs = options.budgetMs && options.budgetMs > 0 ? options.budgetMs : 0;
    this.lteTol = options.lteTol ?? (this.method === 'euler' ? 1e-4 : 5e-4);
    this.seed = options.seed ?? 1;
    this.rng = mulberry32(this.seed);

    // Ground: the netlist's, else the − terminal of a source, else net 0.
    let ground = netlist.ground;
    if (ground === undefined && netlist.netCount > 0) {
      const src = netlist.elements.find((e) => (e.type === 'battery' || e.type === 'supply' || e.type === 'siggen') && e.pinNames.includes('-'));
      ground = src ? src.pins[src.pinNames.indexOf('-')]! : 0;
      this.structural.push({
        level: 'info',
        text: src ? `No ground symbol: voltages are measured from the − terminal of ${src.id}.` : 'No ground symbol: voltages are measured from an arbitrary net.',
        time: 0,
      });
    }
    this.ground = ground ?? -1;

    // Unknowns for every net that has at least one element pin.
    this.netNode = new Int32Array(netlist.netCount).fill(-1);
    let count = 0;
    for (const el of netlist.elements) {
      for (const net of el.pins) {
        if (net !== this.ground && net >= 0 && net < netlist.netCount && this.netNode[net] === -1) this.netNode[net] = count++;
      }
    }
    const kinds: number[] = new Array<number>(count).fill(0);

    const shared = new Map<string, unknown>();
    let creating = true;
    for (const el of netlist.elements) {
      const factory = getAnalogModel(el.type);
      if (!factory) {
        this.structural.push({ level: 'warning', text: `${el.id}: a ${el.type} cannot be simulated in the analog engine; it is left out.`, element: el.id, time: 0 });
        continue;
      }
      const env: DeviceEnv = {
        element: el,
        nodes: el.pins.map((net) => (net === this.ground || net < 0 ? -1 : this.netNode[net]!)),
        internal: () => {
          if (!creating) throw new Error('analog: unknowns can only be allocated while creating devices');
          kinds.push(0);
          return count++;
        },
        branch: () => {
          if (!creating) throw new Error('analog: unknowns can only be allocated while creating devices');
          kinds.push(1);
          return count++;
        },
        random: () => this.rng(),
        message: (level, text) => this.post(level, text, el.id),
        time: () => this.t,
        shared,
      };
      // Messages posted while building (e.g. conflicting rails) survive reset().
      const before = this.messages.length;
      const dev = factory(env);
      this.structural.push(...this.messages.splice(before));
      const entry = { el, dev };
      this.entries.push(entry);
      this.byId.set(el.id, entry);
      this.devices.push(dev);
      if (dev.check) this.checkers.push(dev);
      if (dev.accept) this.accepters.push(dev);
      if (dev.breakpoint) this.timed.push(dev);
      if (dev.maxStep) this.limiters.push(dev);
      if (dev.reactives) this.reactors.push(dev);
    }
    creating = false;
    this.nonlinear = this.devices.some((d) => d.nonlinear);

    const n = (this.n = count);
    this.isCurrent = Uint8Array.from(kinds);
    this.A = new Float64Array(n * n);
    this.Af = new Float64Array(n * n);
    this.b = new Float64Array(n);
    this.x = new Float64Array(n);
    this.xn = new Float64Array(n);
    this.xAcc = new Float64Array(n);
    this.x1 = new Float64Array(n);
    this.x2 = new Float64Array(n);
    this.lu = new DenseLU(n);
    this.ctx = { n, A: this.A, b: this.b, x: this.x, t: 0, h: 1, method: 'euler', gmin: 0, limited: false };

    this.reset();
  }

  get time(): number {
    return this.t;
  }

  get size(): number {
    return this.n;
  }

  // -------------------------------------------------------------------------------------------
  // Messages.

  private post(level: EngineMessage['level'], text: string, element?: string, key?: string): void {
    if (key) {
      if (this.posted.has(key)) return;
      this.posted.add(key);
    }
    this.messages.push({ level, text, element, time: this.t });
    if (this.messages.length > MAX_MESSAGES) this.messages.splice(0, this.messages.length - MAX_MESSAGES);
  }

  // -------------------------------------------------------------------------------------------
  // Solving one time point.

  /**
   * Newton–Raphson at time t with step h, starting from this.x. Leaves the result in this.x.
   * Returns false if it did not converge.
   */
  private solvePoint(t: number, h: number, method: Method, gextra: number, maxIter: number): boolean {
    const { n, A, b, xn, lu, isCurrent } = this;
    const ctx = this.ctx;
    ctx.t = t;
    ctx.h = h;
    ctx.method = method;
    ctx.gmin = gextra;
    if (n === 0) return true;
    let flips = 0;
    for (let iter = 0; iter < maxIter; iter++) {
      const x = this.x;
      A.fill(0);
      b.fill(0);
      ctx.limited = false;
      const gdiag = GMIN + gextra;
      for (let i = 0; i < n; i++) if (!isCurrent[i]) A[i * n + i] = gdiag;
      for (const d of this.devices) d.stamp(ctx);

      if (!this.factored || !sameMatrix(A, this.Af)) {
        this.Af.set(A);
        lu.factor(A);
        this.factored = true;
        this.stats.factorizations++;
        this.work += (n * n * n) / 3;
      }
      this.work += 4 * n * n;
      this.consistent = lu.solve(b, xn, this.Af);
      this.stats.iterations++;

      let converged = !ctx.limited;
      for (let i = 0; i < n; i++) {
        const v = xn[i]!;
        if (!Number.isFinite(v)) return false;
        if (converged) {
          const old = x[i]!;
          const tol = RELTOL * Math.max(Math.abs(v), Math.abs(old)) + (isCurrent[i] ? ABSTOL : VNTOL);
          if (Math.abs(v - old) > tol) converged = false;
        }
      }
      x.set(xn);
      if (!this.nonlinear || converged) {
        let changed = false;
        for (const d of this.checkers) if (d.check!(x)) changed = true;
        if (!changed) return true;
        if (++flips > 20) return false;
      }
    }
    return false;
  }

  /** Gmin stepping: solve with a large conductance on every node, then reduce it by decades. */
  private gminStepping(t: number, h: number, method: Method): boolean {
    this.x.set(this.xAcc);
    for (let g = 1e-2; g >= 1e-11; g /= 10) {
      if (!this.solvePoint(t, h, method, g, MAXITER_SETTLE)) return false;
    }
    return this.solvePoint(t, h, method, 0, MAXITER_SETTLE);
  }

  /** Largest ratio of estimated local truncation error to tolerance over all unknowns. */
  private lteRatio(h: number, method: Method): number {
    const t0 = this.t;
    const h1 = t0 - this.t1;
    const h2 = this.t1 - this.t2;
    const x = this.x;
    const x0 = this.xAcc;
    const x1 = this.x1;
    const x2 = this.x2;
    let worst = 0;
    if (method === 'euler') {
      // Linear predictor through (t1, x1), (t0, x0); BE's error is h/(h + h1) of the predictor's.
      const s = h / h1;
      const scale = h / (h + h1);
      for (let i = 0; i < this.n; i++) {
        const pred = x0[i]! + (x0[i]! - x1[i]!) * s;
        const err = Math.abs(x[i]! - pred) * scale;
        const tol = this.lteTol * Math.max(Math.abs(x[i]!), Math.abs(x0[i]!)) + (this.isCurrent[i] ? LTE_ABS_I : LTE_ABS_V);
        const r = err / tol;
        if (r > worst) worst = r;
      }
    } else {
      // Quadratic predictor through three points; the trapezoidal rule's error is
      // h²/(2(h + h1)(h + h1 + h2)) of the predictor's.
      const tn = t0 + h;
      const ta = this.t2;
      const tb = this.t1;
      const la = ((tn - tb) * (tn - t0)) / ((ta - tb) * (ta - t0));
      const lb = ((tn - ta) * (tn - t0)) / ((tb - ta) * (tb - t0));
      const lc = ((tn - ta) * (tn - tb)) / ((t0 - ta) * (t0 - tb));
      const scale = (h * h) / (2 * (h + h1) * (h + h1 + h2));
      for (let i = 0; i < this.n; i++) {
        const pred = la * x2[i]! + lb * x1[i]! + lc * x0[i]!;
        const err = Math.abs(x[i]! - pred) * scale;
        const tol = this.lteTol * Math.max(Math.abs(x[i]!), Math.abs(x0[i]!)) + (this.isCurrent[i] ? LTE_ABS_I : LTE_ABS_V);
        const r = err / tol;
        if (r > worst) worst = r;
      }
    }
    return worst;
  }

  /**
   * The first step after a breakpoint: min(1 ns, 1e-3 × the fastest time constant, requested dt / 100),
   * never below 1 fs. Time constants are estimated from the circuit as it is now (a switch that has
   * just closed counts): the matrix is assembled once with a probe step, and each capacitor gets
   * τ = C / G, where G is the largest conductance at its terminals not counting the capacitors
   * themselves (a lower bound of the true τ, so the step errs on the small side); each inductor
   * (or relay coil) L / (R + 1 / G). Parts that do not list their reactive elements are ignored.
   */
  private startStep(): number {
    let h = H_START;
    if (this.reqDt < Infinity) h = Math.min(h, START_DT_FRACTION * this.reqDt);
    if (this.reactors.length > 0 && this.n > 0) {
      const tau = this.fastestTimeConstant();
      if (tau < Infinity) h = Math.min(h, START_TAU_FRACTION * tau);
    }
    return Math.max(h, H_MIN);
  }

  private fastestTimeConstant(): number {
    const { n, A, b, ctx } = this;
    this.x.set(this.xAcc);
    ctx.t = this.t;
    ctx.h = PROBE_H;
    ctx.method = 'euler';
    ctx.gmin = 0;
    ctx.limited = false;
    A.fill(0);
    b.fill(0);
    for (const d of this.devices) d.stamp(ctx);
    // Conductance at each node, minus the companion conductances of the listed capacitors.
    const g = (i: number): number => (i >= 0 ? A[i * n + i]! : 0);
    const own = new Map<number, number>();
    const parts: (CapacitorState | InductorState)[] = [];
    for (const d of this.reactors) {
      for (const r of d.reactives!()) {
        parts.push(r);
        if (r instanceof CapacitorState) {
          if (r.a >= 0) own.set(r.a, (own.get(r.a) ?? 0) + r.g);
          if (r.b >= 0) own.set(r.b, (own.get(r.b) ?? 0) + r.g);
        }
      }
    }
    const free = (i: number): number => (i >= 0 ? Math.max(0, g(i) - (own.get(i) ?? 0)) : 0);
    let tau = Infinity;
    for (const r of parts) {
      const G = Math.max(free(r.a), free(r.b));
      if (!(G > 1e-9)) continue;
      if (r instanceof CapacitorState) {
        if (r.C > 0) tau = Math.min(tau, r.C / G);
      } else if (r.L > 0) tau = Math.min(tau, r.L / (r.R + 1 / G));
    }
    return tau;
  }

  private hmin(): number {
    return Math.max(H_MIN, Math.abs(this.t) * 1e-12);
  }

  /** One accepted internal step, not going past `limit`. */
  private step(limit: number): void {
    const t0 = this.t;
    if (this.breakPending) {
      this.breakPending = false;
      this.sinceBreak = 0;
      this.hNext = Math.min(this.startStep(), this.hmax);
    }
    const hmin = this.hmin();
    let h: number;
    let land = Infinity;
    let landBreak = false;
    const planned = this.hNext;
    if (this.fixed) h = this.hFixed;
    else {
      h = Math.min(this.hNext, this.hmax);
      for (const d of this.limiters) h = Math.min(h, d.maxStep!());
      h = Math.max(h, hmin);
      // Land exactly on the next breakpoint or on the end of the interval, avoiding slivers.
      let devBp = Infinity;
      for (const d of this.timed) devBp = Math.min(devBp, d.breakpoint!(t0));
      const bp = Math.min(devBp, limit);
      const gap = bp - t0;
      if (gap <= h) {
        h = gap;
        land = bp;
        landBreak = devBp <= limit;
      } else if (gap < 2 * h) h = gap / 2;
    }
    const method: Method = !this.fixed && this.sinceBreak === 0 ? 'euler' : this.method;
    const order = method === 'euler' ? 1 : 2;
    let grow = 2;
    for (;;) {
      this.x.set(this.xAcc);
      let ok = this.solvePoint(t0 + h, h, method, 0, MAXITER);
      if (!ok && !this.fixed && h > 2 * hmin) {
        h = Math.max(h / 8, hmin);
        land = Infinity;
        landBreak = false;
        this.stats.rejected++;
        continue;
      }
      if (!ok) {
        ok = this.gminCooldown > 0 ? false : this.gminStepping(t0 + h, h, method);
        if (!ok) {
          this.gminCooldown = 100;
          this.stats.failures++;
          this.post('warning', `The simulation did not converge at t = ${t0.toPrecision(4)} s; the results may be inaccurate.`, undefined, 'convergence');
        }
      }
      if (!this.fixed && ok && this.sinceBreak >= order + 1) {
        const r = this.lteRatio(h, method);
        const factor = r > 0 ? 0.9 * Math.pow(r, -1 / (order + 1)) : MAX_GROW;
        if (r > 1 && h > 2 * hmin) {
          h = Math.max(hmin, h * Math.max(0.2, Math.min(0.9, factor)));
          land = Infinity;
          landBreak = false;
          this.stats.rejected++;
          continue;
        }
        grow = Math.min(MAX_GROW, Math.max(0.5, factor));
      }
      break;
    }

    // Accept.
    const tNew = land !== Infinity ? land : t0 + h;
    const old2 = this.x2;
    this.x2 = this.x1;
    this.x1 = this.xAcc;
    this.xAcc = this.x;
    this.x = old2;
    (this.ctx as { x: Float64Array }).x = this.x;
    this.t2 = this.t1;
    this.t1 = t0;
    this.t = tNew;
    this.lastStep = h;
    const actx: AcceptContext = { x: this.xAcc, t: tNew, h, method };
    let discontinuity = false;
    for (const d of this.accepters) if (d.accept!(actx)) discontinuity = true;
    if (!this.consistent) {
      this.post(
        'error',
        'Ideal voltage sources are connected in parallel (or in a loop) with different voltages: the circuit has no solution. Put a resistor between them.',
        undefined,
        'inconsistent',
      );
    }
    this.stats.steps++;
    if (this.gminCooldown > 0) this.gminCooldown--;
    if (discontinuity || landBreak || this.breakPending) this.breakPending = true;
    else {
      this.sinceBreak++;
      // A step cut short to land on the end of the advance() interval does not shrink the next one.
      this.hNext = Math.min(this.hmax, land !== Infinity ? Math.max(planned * Math.min(1, grow), h * grow) : h * grow);
    }
    for (const r of this.recorders) r.push(tNew, (net) => this.voltage(net));
  }

  // -------------------------------------------------------------------------------------------
  // Engine interface.

  advance(dt: number): void {
    if (!(dt > 0)) return;
    this.reqDt = dt;
    const start = this.t;
    let steps = 0;
    this.lagging = false;
    if (this.fixed) {
      this.pending += dt;
      let k = Math.floor(this.pending / this.hFixed + 1e-9);
      if (k > this.maxSteps) {
        k = this.maxSteps;
        this.lagging = true;
        this.pending = 0;
      } else this.pending -= k * this.hFixed;
      this.work = 0;
      for (let i = 0; i < k; i++) {
        if (this.work >= this.maxWork) {
          this.lagging = true;
          this.pending = 0;
          break;
        }
        this.step(Infinity);
      }
    } else {
      const target = this.t + dt;
      this.work = 0;
      const deadline = this.budgetMs ? performance.now() + this.budgetMs : Infinity;
      while (target - this.t > Math.max(1e-15, Math.abs(target) * 1e-13)) {
        if (steps >= this.maxSteps || this.work >= this.maxWork || (steps > 0 && deadline !== Infinity && performance.now() > deadline)) {
          this.lagging = true;
          break;
        }
        this.step(target);
        steps++;
      }
    }
    this.speed = (this.t - start) / dt;
    if (this.lagging) {
      this.post('info', 'The circuit needs more computation than a frame allows: the simulation is running slower than real time.', undefined, 'lagging');
    }
  }

  settle(): void {
    this.x.set(this.xAcc);
    let ok = this.solvePoint(this.t, SETTLE_H, 'euler', 0, MAXITER_SETTLE);
    if (!ok) ok = this.gminStepping(this.t, SETTLE_H, 'euler');
    if (!ok) {
      this.stats.failures++;
      this.post('warning', `The simulation did not converge at t = ${this.t.toPrecision(4)} s; the results may be inaccurate.`, undefined, 'convergence');
    }
    this.xAcc.set(this.x);
    this.breakPending = true;
    for (const r of this.recorders) r.push(this.t, (net) => this.voltage(net));
  }

  reset(): void {
    this.t = 0;
    this.t1 = 0;
    this.t2 = 0;
    this.pending = 0;
    this.rng = mulberry32(this.seed);
    this.messages.length = 0;
    this.messages.push(...this.structural);
    this.posted.clear();
    for (const d of this.devices) d.reset();
    this.xAcc.fill(0);
    this.x1.fill(0);
    this.x2.fill(0);
    this.breakPending = true;
    this.gminCooldown = 0;
    this.lagging = false;
    this.speed = 1;
    for (const r of this.recorders) r.clear();
    this.settle();
  }

  voltage(net: number): number {
    // Nets merged by a subcircuit (a port tied to ground or a rail): look up the representative.
    const alias = this.netlist.alias;
    if (alias && net >= 0 && net < alias.length) net = alias[net] ?? net;
    if (net === this.ground) return 0;
    if (!(net >= 0 && net < this.netNode.length)) return NaN;
    const i = this.netNode[net]!;
    return i < 0 ? 0 : this.xAcc[i]!;
  }

  logic(net: number): Logic {
    return logicLevel(this.voltage(net));
  }

  current(id: string, pin: number): number {
    const e = this.byId.get(id);
    if (!e || !(pin >= 0 && pin < e.el.pins.length)) return 0;
    return e.dev.current(pin, this.xAcc);
  }

  state(id: string): ElementState {
    const e = this.byId.get(id);
    return e ? e.dev.state(this.xAcc) : {};
  }

  setParam(id: string, key: string, value: ParamValue): void {
    const e = this.byId.get(id);
    if (!e) return;
    e.dev.setParam(key, value);
    this.breakPending = true;
  }

  watch(nets: number[]): Recorder {
    const r = new SampleRecorder(nets, () => this.t, (rec) => this.recorders.delete(rec));
    this.recorders.add(r);
    r.push(this.t, (net) => this.voltage(net));
    return r;
  }
}

function sameMatrix(a: Float64Array, b: Float64Array): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
