/**
 * The bench-top rig behind the scope widgets: an analog engine, an `engine.watch()` recorder on the
 * probed nets, and a ScopeModel that turns the recording into sweeps.
 *
 * Time. A real scope watches real time; ours watches simulated time, and one frame of the page can
 * only afford a little of it. Each frame we advance the engine by whatever produces at most a few
 * sweeps: `min(real dt × boost, sweeps × span)`, where `boost` is 1 for fast sweeps and grows for slow
 * ones so that a whole sweep never takes much more than two real seconds. (A sweep of 10 s/div would
 * otherwise take 100 s to draw.)
 *
 * `timeScale` lets a widget show nanosecond circuits without asking the engine for picosecond steps:
 * with k = 1000 the engine simulates a circuit whose capacitors are 1000 times larger (so τ is 1000
 * times longer) and the scope divides all times by k. The shape of an RC curve depends only on
 * t/RC, so nothing else changes.
 */
import { createAnalogEngine, type AnalogEngine, type AnalogEngineOptions } from '$lib/sim/analog';
import type { Recorder } from '$lib/sim/engine';
import type { FlatNetlist, ParamValue } from '$lib/sim/netlist/types';
import { ScopeModel, type PartialSweep } from './scope-model';

export interface RigOptions {
  /** Engine time per displayed time (default 1). */
  timeScale?: number;
  /** Largest internal step of the engine, in engine seconds. */
  step?: number;
  engineOptions?: AnalogEngineOptions;
  /** Wall-clock budget for the engine in one frame, in milliseconds. */
  budgetMs?: number;
}

/** Display seconds to simulate in a frame of `realDt` real seconds, for a scope with the given sweep span. */
export function planAdvance(realDt: number, span: number, retrace = 0.05, maxSweeps = 4): number {
  const boost = Math.max(1, span / 2);
  return Math.min(realDt * boost, span * (1 + retrace) * maxSweeps);
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class ScopeRig {
  readonly engine: AnalogEngine;
  readonly rec: Recorder;
  readonly k: number;
  private readonly budgetMs: number;
  private times: Float64Array = new Float64Array(0);
  private values: Float64Array[] = [];

  constructor(
    readonly flat: FlatNetlist,
    readonly nets: number[],
    readonly model: ScopeModel,
    opts: RigOptions = {},
  ) {
    this.k = opts.timeScale ?? 1;
    this.budgetMs = opts.budgetMs ?? 12;
    this.engine = createAnalogEngine(flat, { maxStepsPerAdvance: 50000, ...opts.engineOptions, ...(opts.step ? { step: opts.step } : {}) });
    this.rec = this.engine.watch(nets);
    // The caller decides what happens to the model: `model.restart(0)` for a clean screen, or
    // `model.restart(0, true)` to keep the old sweeps on screen until a new one completes.
  }

  /** Displayed time now. */
  get time(): number {
    return this.engine.time / this.k;
  }

  setParam(id: string, key: string, value: ParamValue): void {
    this.engine.setParam(id, key, value);
  }

  /** Advance the engine by `dt` displayed seconds (or as far as the frame's time budget allows). */
  advance(dt: number): void {
    const target = this.engine.time + dt * this.k;
    const deadline = now() + this.budgetMs;
    for (let i = 0; i < 40 && this.engine.time < target * (1 - 1e-12); i++) {
      this.engine.advance(target - this.engine.time);
      if (now() > deadline) break;
    }
  }

  /** Read the recording into displayed time and feed the model. Returns the number of finished sweeps. */
  process(): number {
    const t = this.rec.times();
    const v = this.rec.values();
    if (this.k !== 1) for (let i = 0; i < t.length; i++) t[i] = t[i]! / this.k;
    this.times = t;
    this.values = v;
    const done = this.model.process(t, v, this.time);
    // Trim what no sweep will need again (in engine time, as the recorder counts).
    const need = this.model.needFrom();
    const keep = Math.max(this.model.span * 1.2, this.time - need + this.model.span * 0.05);
    this.rec.trim(keep * this.k);
    return done;
  }

  /** One frame: advance by the planned amount, then process. */
  step(realDt: number): number {
    this.advance(planAdvance(realDt, this.model.span, this.model.retrace));
    return this.process();
  }

  /** The sweep in progress (from the data of the last `process()`). */
  partial(): PartialSweep | null {
    return this.model.partial(this.times, this.values);
  }

  dispose(): void {
    this.rec.close();
  }
}

/**
 * Run `tick(dtReal)` on every animation frame while `el` is on screen and the tab is visible. The
 * loop stops itself otherwise, so an off-screen scope costs nothing. Returns a disposer.
 */
export function visibleLoop(el: Element, tick: (dt: number) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  let raf = 0;
  let last = 0;
  let visible = false;
  const loop = (t: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    tick(dt);
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  };
  const io = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    if (visible) start();
  });
  io.observe(el);
  const vis = () => !document.hidden && visible && start();
  document.addEventListener('visibilitychange', vis);
  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    document.removeEventListener('visibilitychange', vis);
  };
}
