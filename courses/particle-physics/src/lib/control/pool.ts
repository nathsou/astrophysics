/**
 * A pool of workers that runs the pipeline for the page.
 *
 * The page asks for a run (`start(config, seed, maxEvents)`); the pool hands out jobs of consecutive event indices to idle workers, sized so that a job
 * takes about 200 ms (so every worker reports about five times a second), merges the results as they arrive (`mergeBatch`: counts add), and calls
 * `onUpdate` with a snapshot at most every `updateMs` milliseconds. Because each event's random streams depend only on the run seed and the event's index,
 * the merged histograms do not depend on the number of workers or on which finished first.
 *
 *   stop()     stop handing out jobs; the jobs in flight finish and are merged; start() continues the same run
 *   reset()    forget the run and terminate the workers (so even an infinite loop in the reader's code ends); the next start() makes new workers
 *   a job that does not come back within `jobTimeoutMs` terminates its worker, stops the run and says so
 */
import type { Mine } from '../code/mine.ts';
import { mergeBatch, physicsKey, type BatchResult, type KeptEvent, type PipelineConfig } from '../hep/pipeline/index.ts';
import type { FromWorker, ToWorker } from './protocol.ts';

export interface WorkerLike {
  postMessage(m: ToWorker): void;
  terminate(): void;
  onmessage: ((e: { data: FromWorker }) => void) | null;
  onerror: ((e: { message?: string }) => void) | null;
}

export interface PoolSnapshot {
  runId: number;
  running: boolean;
  /** The run reached its event target. */
  finished: boolean;
  /** Events merged so far, and the target (Infinity for a run until stopped). */
  events: number;
  target: number;
  result: BatchResult | null;
  /** Leading-order cross-sections (pb) of the samples, and the generator-window fractions, once a worker has computed them. */
  xsec: number[] | null;
  windows: ({ eff: number; error: number } | null)[] | null;
  /** Triggered events kept for display, by event index. */
  kept: KeptEvent[];
  /** Wall-clock time spent running, and the overall events per second. */
  elapsedMs: number;
  wallRate: number;
  workers: number;
  /** What the workers' hook overrides are (from the first worker), or null before they are ready. */
  mine: { active: string[]; errors: Record<string, string> } | null;
  /** Problems: a configuration the pipeline could not prepare, a stalled worker. */
  problems: string[];
}

export interface PoolOptions {
  makeWorker: () => WorkerLike;
  /** Number of workers (default: hardwareConcurrency − 1, at least 1, at most 12). */
  size?: number;
  /** The reader's saved solutions, read when workers are created. */
  getMine: () => Mine;
  onUpdate: (s: PoolSnapshot) => void;
  /** Minimum time between updates (ms, default 200). */
  updateMs?: number;
  /** Target duration of one job (ms, default 200). */
  jobMs?: number;
  jobTimeoutMs?: number;
  /** Complete events kept for display (default 40). */
  keepMax?: number;
}

export function defaultPoolSize(): number {
  const hc = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
  return Math.max(1, Math.min(12, (hc ?? 2) - 1));
}

interface Slot {
  worker: WorkerLike;
  ready: boolean;
  busy: boolean;
  /** Why the slot is busy: a job, or the cross-section computation. */
  job: { jobId: number; sentAt: number; start: number; n: number } | { xsec: true; sentAt: number } | null;
  msPerEvent: number;
  dead: boolean;
}

export class RunPool {
  private opts: Required<Omit<PoolOptions, 'size'>> & { size: number };
  private slots: Slot[] = [];
  private runId = 0;
  private config: PipelineConfig | null = null;
  private configKey = '';
  private seed = 1;
  private target = Infinity;
  private nextIndex = 0;
  private jobCounter = 0;
  private events = 0;
  private agg: BatchResult | null = null;
  private kept: KeptEvent[] = [];
  private xsec: number[] | null = null;
  private windows: ({ eff: number; error: number } | null)[] | null = null;
  private xsecRequested = false;
  private running = false;
  private runningSince = 0;
  private elapsedBefore = 0;
  private mine: PoolSnapshot['mine'] = null;
  private problems: string[] = [];
  private lastUpdate = 0;
  private dirty = false;
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(opts: PoolOptions) {
    this.opts = { updateMs: 200, jobMs: 200, jobTimeoutMs: 30_000, keepMax: 40, size: opts.size ?? defaultPoolSize(), ...opts } as PoolOptions & Required<Omit<PoolOptions, 'size'>> & { size: number };
  }

  get snapshot(): PoolSnapshot {
    const elapsed = this.elapsedBefore + (this.running ? now() - this.runningSince : 0);
    const finished = this.events >= this.target && this.target !== Infinity;
    return {
      runId: this.runId, running: this.running, finished, events: this.events, target: this.target, result: this.agg, xsec: this.xsec, windows: this.windows,
      kept: [...this.kept].sort((a, b) => a.index - b.index), elapsedMs: elapsed, wallRate: elapsed > 0 ? (this.events / elapsed) * 1000 : 0,
      workers: this.slots.filter((s) => !s.dead).length, mine: this.mine, problems: this.problems.slice(),
    };
  }

  /** Begin a run, or continue the stopped one if the configuration and seed are unchanged. */
  start(config: PipelineConfig, seed: number, maxEvents = Infinity): void {
    if (this.disposed) return;
    const key = physicsKey(config);
    const sameRun = this.config !== null && key === this.configKey && seed === this.seed && (this.agg !== null || this.running);
    if (!sameRun) this.newRun(config, key, seed);
    else this.config = config;
    this.target = maxEvents;
    if (this.events >= this.target) {
      this.publish(true);
      return;
    }
    if (!this.running) {
      this.running = true;
      this.runningSince = now();
      if (!this.watchdog) this.watchdog = setInterval(() => this.checkStalled(), 1000);
    }
    this.ensureWorkers();
    this.dispatch();
    this.publish(true);
  }

  /** Stop handing out jobs. Jobs in flight finish and are merged. */
  stop(): void {
    if (!this.running) return;
    this.pause();
    this.publish(true);
  }

  /** Discard the run and terminate the workers. */
  reset(): void {
    this.pause();
    this.runId++;
    this.config = null;
    this.configKey = '';
    this.agg = null;
    this.kept = [];
    this.events = 0;
    this.nextIndex = 0;
    this.xsec = null;
    this.windows = null;
    this.xsecRequested = false;
    this.elapsedBefore = 0;
    this.problems = [];
    this.terminateAll();
    this.publish(true);
  }

  /** Terminate the workers and make the next start() create new ones, which re-read the reader's saved code (call after the saved solutions change). */
  refreshMine(): void {
    this.pause();
    this.terminateAll();
    this.mine = null;
    // a run in progress restarts: its events were made with the old code
    this.runId++;
    this.agg = null;
    this.kept = [];
    this.events = 0;
    this.nextIndex = 0;
    this.xsecRequested = false;
    this.elapsedBefore = 0;
    this.config = null;
    this.configKey = '';
    this.publish(true);
  }

  /** Create the workers now (so the first Start is fast and the hook status can be shown before a run). */
  warm(): void {
    if (this.disposed) return;
    this.ensureWorkers();
  }

  dispose(): void {
    this.disposed = true;
    this.pause();
    this.terminateAll();
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    if (this.updateTimer) clearTimeout(this.updateTimer);
  }

  // ── internals ──

  private newRun(config: PipelineConfig, key: string, seed: number): void {
    this.runId++;
    this.config = config;
    this.configKey = key;
    this.seed = seed;
    this.agg = null;
    this.kept = [];
    this.events = 0;
    this.nextIndex = 0;
    this.xsec = null;
    this.windows = null;
    this.xsecRequested = false;
    this.elapsedBefore = 0;
    this.problems = [];
  }

  private pause(): void {
    if (this.running) {
      this.elapsedBefore += now() - this.runningSince;
      this.running = false;
    }
  }

  private ensureWorkers(): void {
    while (this.slots.filter((s) => !s.dead).length < this.opts.size) {
      const worker = this.opts.makeWorker();
      const slot: Slot = { worker, ready: false, busy: true, job: null, msPerEvent: 0, dead: false };
      worker.onmessage = (e) => this.onMessage(slot, e.data);
      worker.onerror = (e) => {
        this.problems.push(`A worker failed: ${e.message ?? 'unknown error'}`);
        slot.dead = true;
        slot.busy = false;
        this.pause();
        this.publish(true);
      };
      this.slots.push(slot);
      worker.postMessage({ type: 'init', mine: this.opts.getMine() });
    }
  }

  private terminateAll(): void {
    for (const s of this.slots) {
      try {
        s.worker.terminate();
      } catch {
        /* already gone */
      }
      s.dead = true;
    }
    this.slots = [];
  }

  private onMessage(slot: Slot, m: FromWorker): void {
    if (slot.dead || this.disposed) return;
    if (m.type === 'ready') {
      slot.ready = true;
      slot.busy = false;
      slot.job = null;
      if (slot === this.slots.find((s) => !s.dead) || this.mine === null) this.mine = { active: m.active, errors: m.errors };
      this.dispatch();
      this.publish(this.mine !== null);
      return;
    }
    if (m.type === 'xsec') {
      slot.busy = false;
      slot.job = null;
      if (m.runId === this.runId) {
        this.xsec = m.xsec;
        this.windows = m.windows;
        this.dirty = true;
      }
      this.dispatch();
      this.publish(true);
      return;
    }
    if (m.type === 'fatal') {
      slot.busy = false;
      slot.job = null;
      if (m.runId === this.runId || m.runId === 0) {
        this.problems.push(m.message);
        this.pause();
      }
      this.publish(true);
      return;
    }
    // a job result
    slot.busy = false;
    slot.job = null;
    if (m.n > 0) slot.msPerEvent = slot.msPerEvent > 0 ? 0.6 * slot.msPerEvent + 0.4 * (m.ms / m.n) : m.ms / m.n;
    if (m.runId === this.runId) {
      const kept = m.result.kept;
      m.result.kept = [];
      if (this.agg === null) this.agg = m.result;
      else mergeBatch(this.agg, m.result);
      this.events += m.result.n;
      this.addKept(kept);
      this.dirty = true;
    }
    if (this.running && this.events >= this.target) this.pause();
    this.dispatch();
    this.publish(!this.running || this.events >= this.target);
  }

  private addKept(list: KeptEvent[]): void {
    for (const k of list) this.kept.push(k);
    const max = this.opts.keepMax;
    while (this.kept.length > max) {
      const i = this.kept.findIndex((k) => !k.selected);
      this.kept.splice(i >= 0 ? i : 0, 1);
    }
  }

  /** Give every idle, ready worker a job (or the cross-section request), while the run is running and events remain. */
  private dispatch(): void {
    if (!this.running || !this.config || this.disposed) return;
    for (const s of this.slots) {
      if (s.dead || !s.ready || s.busy) continue;
      if (!this.xsecRequested) {
        this.xsecRequested = true;
        s.busy = true;
        s.job = { xsec: true, sentAt: now() };
        s.worker.postMessage({ type: 'xsec', runId: this.runId, config: this.config });
        continue;
      }
      if (this.nextIndex >= this.target) continue;
      let n = s.msPerEvent > 0 ? Math.round(this.opts.jobMs / s.msPerEvent) : 2;
      n = Math.max(1, Math.min(64, n));
      n = Math.min(n, this.target - this.nextIndex);
      const jobId = ++this.jobCounter;
      s.busy = true;
      s.job = { jobId, sentAt: now(), start: this.nextIndex, n };
      this.nextIndex += n;
      s.worker.postMessage({ type: 'job', runId: this.runId, jobId, config: this.config, seed: this.seed, start: s.job.start, n, keep: 1 });
    }
  }

  private checkStalled(): void {
    const t = now();
    for (const s of this.slots) {
      if (s.dead || !s.busy || !s.job) continue;
      if (t - s.job.sentAt > this.opts.jobTimeoutMs) {
        this.problems.push(`A worker did not answer for ${Math.round(this.opts.jobTimeoutMs / 1000)} s and was stopped. Is there an infinite loop in your code?`);
        try {
          s.worker.terminate();
        } catch {
          /* ignore */
        }
        s.dead = true;
        this.pause();
        this.publish(true);
      }
    }
  }

  /** Call onUpdate now, or at most every `updateMs`. */
  private publish(immediate: boolean): void {
    if (this.disposed) return;
    const t = now();
    if (immediate || t - this.lastUpdate >= this.opts.updateMs) {
      if (this.updateTimer) clearTimeout(this.updateTimer);
      this.updateTimer = null;
      this.lastUpdate = t;
      this.dirty = false;
      this.opts.onUpdate(this.snapshot);
    } else if (!this.updateTimer) {
      this.updateTimer = setTimeout(() => {
        this.updateTimer = null;
        this.publish(true);
      }, this.opts.updateMs - (t - this.lastUpdate));
    }
  }
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
