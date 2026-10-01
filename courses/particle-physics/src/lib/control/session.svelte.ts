/**
 * The state of a Control Room (or of the compact widget): the configuration, the seed, the pool of workers and what it has computed, the precomputed
 * sample, the reader's saved code, and a `summary` derived from them for the page to draw.
 *
 * What is shown, in order of preference: the live run (events computed in this browser, with the reader's code if it is switched on), else the
 * precomputed sample of the preset if it was made with the same physics, else nothing. Changing anything that determines the events (the machine, the
 * generator's samples, the detector, the reconstruction, the trigger menu, the selection, the binning) discards the live run; changing the K-factor,
 * the luminosity, the signal window, the fit or the dead time only changes how the result is read.
 */
import { base } from '$app/paths';
import { loadMine, setEnabled, type Mine } from '../code/mine.ts';
import {
  loadRealData, physicsKey, parsePayload, payloadMatches, presetConfig, realManifestExists, summarise, histogramReal, resolveDetector, isPreset,
  type BatchResult, type KeptEvent, type PipelineConfig, type RealEvent, type RealManifest, type SamplePayload, type StageName, type Summary,
} from '../hep/pipeline/index.ts';
import { makeWorker } from './makeWorker.ts';
import { RunPool, defaultPoolSize, type PoolSnapshot } from './pool.ts';
import { stageOfHook } from './protocol.ts';
import { loadSaved, saveState, hashForState, stateFromHash, type ControlState } from './codec.ts';

export interface MineRow {
  hook: string;
  exercise: string;
  enabled: boolean;
  stage: StageName | null;
}

export interface View {
  source: 'live' | 'precomputed';
  result: BatchResult;
  xsec: number[];
  events: number;
}

export class ControlSession {
  config = $state<PipelineConfig>(presetConfig('zmumu'));
  seed = $state(1);
  /** Events to run: 0 means until stopped. */
  target = $state(0);
  snap = $state.raw<PoolSnapshot | null>(null);
  payload = $state.raw<SamplePayload | null>(null);
  payloadState = $state<'idle' | 'loading' | 'missing' | 'ready'>('idle');
  mine = $state.raw<MineRow[]>([]);
  /** The real-data manifest for the current preset, if the file exists. */
  realManifest = $state.raw<RealManifest | null>(null);
  realEvents = $state.raw<RealEvent[] | null>(null);
  /** Show real data instead of simulation (only possible if `realManifest` is not null). */
  useReal = $state(false);
  poolSize: number;

  private pool: RunPool | null = null;
  private lastKey = '';
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private payloadFetch = 0;

  constructor(opts: { poolSize?: number } = {}) {
    this.poolSize = opts.poolSize ?? defaultPoolSize();
    this.lastKey = physicsKey(presetConfig('zmumu'));
  }

  // ── derived ──

  /** The result being shown. */
  get view(): View | null {
    const s = this.snap;
    if (s?.result && s.events > 0 && s.xsec) return { source: 'live', result: s.result, xsec: s.xsec, events: s.events };
    if (s?.result && s.events > 0 && this.payload && payloadMatches(this.payload, this.config)) {
      // live events have no cross-sections yet (a worker is still training the generator): the precomputed ones are the same numbers
      return { source: 'live', result: s.result, xsec: this.payload.xsec, events: s.events };
    }
    if (this.payload && payloadMatches(this.payload, this.config)) return { source: 'precomputed', result: this.payload.result, xsec: this.payload.xsec, events: this.payload.manifest.events };
    return null;
  }

  summary = $derived.by((): Summary | null => {
    const v = this.view;
    // reading these keeps the summary current as a live run streams in
    void this.snap;
    if (!v) return null;
    try {
      return summarise(v.result, $state.snapshot(this.config) as PipelineConfig, v.xsec, { seed: this.seed });
    } catch {
      return null;
    }
  });

  get running(): boolean {
    return !!this.snap?.running;
  }
  get kept(): KeptEvent[] {
    return this.snap?.kept ?? [];
  }
  /** The stage that runs the reader's code, by the hooks installed in the workers (or, before they are ready, the enabled saved solutions). */
  minePerStage = $derived.by((): Record<StageName, string[]> => {
    const out: Record<StageName, string[]> = { machine: [], generator: [], detector: [], reconstruction: [], trigger: [], analysis: [] };
    const active = this.snap?.mine?.active ?? this.mine.filter((m) => m.enabled).map((m) => m.hook);
    for (const h of active) {
      const st = stageOfHook(h);
      if (st) out[st].push(h);
    }
    return out;
  });

  // ── state in and out ──

  /** Take a state (from a link or from storage); discards any run. */
  apply(state: ControlState): void {
    this.pool?.reset();
    this.config = state.config;
    this.seed = state.seed;
    this.lastKey = physicsKey($state.snapshot(this.config) as PipelineConfig);
    void this.loadSamples();
    void this.checkReal();
  }

  /** The state from the page's URL hash, else from autosave, else the default preset. */
  async restore(hash: string): Promise<void> {
    const fromHash = await stateFromHash(hash);
    this.apply(fromHash ?? loadSaved() ?? { config: presetConfig('zmumu'), seed: 1 });
    this.readMine();
  }

  setPreset(name: string): void {
    if (!isPreset(name)) return;
    this.apply({ config: presetConfig(name), seed: 1 });
  }

  /** Save the state (debounced). */
  save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveState({ config: $state.snapshot(this.config) as PipelineConfig, seed: this.seed }), 400);
  }

  async link(): Promise<string> {
    const h = await hashForState({ config: $state.snapshot(this.config) as PipelineConfig, seed: this.seed });
    return `${location.origin}${location.pathname}${h}`;
  }

  // ── precomputed samples and real data ──

  async loadSamples(): Promise<void> {
    const preset = this.config.name;
    const ticket = ++this.payloadFetch;
    this.payloadState = 'loading';
    try {
      const res = await fetch(`${base}/data/samples/${encodeURIComponent(preset)}.json`);
      if (!res.ok) throw new Error(String(res.status));
      const p = parsePayload(await res.json());
      if (ticket !== this.payloadFetch) return;
      this.payload = p;
      this.payloadState = 'ready';
    } catch {
      if (ticket !== this.payloadFetch) return;
      this.payload = null;
      this.payloadState = 'missing';
    }
  }

  /** Whether `static/data/real/<preset>.manifest.json` exists. The real events are loaded only when the reader asks for them. */
  async checkReal(): Promise<void> {
    const name = this.config.name;
    const m = await realManifestExists(base, name);
    if (this.config.name !== name) return;
    this.realManifest = m;
    this.realEvents = null;
    if (!m) this.useReal = false;
  }

  async setUseReal(on: boolean): Promise<void> {
    this.useReal = on && !!this.realManifest;
    if (this.useReal && !this.realEvents) {
      const d = await loadRealData(base, this.config.name);
      if (d) this.realEvents = d.events;
      else this.useReal = false;
    }
  }

  /** The main observable of the real events with the configuration's selection and binning, if real data are shown. */
  get realHistogram(): { edges: number[]; counts: number[]; selected: number; manifest: RealManifest } | null {
    if (!this.useReal || !this.realEvents || !this.realManifest) return null;
    const h = histogramReal(this.realEvents, $state.snapshot(this.config) as PipelineConfig);
    return { edges: h.edges, counts: h.acc.counts, selected: h.selected, manifest: this.realManifest };
  }

  // ── the reader's code ──

  readMine(): void {
    const m: Mine = loadMine();
    this.mine = Object.entries(m).map(([hook, e]) => ({ hook, exercise: e.exercise, enabled: e.enabled, stage: stageOfHook(hook) }));
  }
  toggleMine(hook: string, enabled: boolean): void {
    setEnabled(hook, enabled);
    this.readMine();
    this.pool?.refreshMine();
    this.pool?.warm();
  }

  // ── running ──

  private ensurePool(): RunPool {
    if (!this.pool) {
      this.pool = new RunPool({ makeWorker, size: this.poolSize, getMine: () => loadMine(), onUpdate: (s) => (this.snap = s) });
    }
    return this.pool;
  }
  /** Create the workers so that the status of the reader's code is known before the first run. */
  warm(): void {
    this.ensurePool().warm();
  }
  start(): void {
    this.ensurePool().start($state.snapshot(this.config) as PipelineConfig, this.seed, this.target > 0 ? this.target : Infinity);
  }
  stop(): void {
    this.pool?.stop();
  }
  reset(): void {
    this.pool?.reset();
  }
  /** A fresh run of `events` events (the compact widget's "Regenerate"). */
  regenerate(events: number): void {
    this.target = events;
    this.pool?.reset();
    this.start();
  }

  /** Call from an effect: when the physics of the configuration changes, discard the run (and restart it, if it was running). */
  watchPhysics(): void {
    const key = physicsKey($state.snapshot(this.config) as PipelineConfig);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const was = this.running;
    this.pool?.reset();
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (was) this.restartTimer = setTimeout(() => this.start(), 350);
  }

  dispose(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.pool?.dispose();
    this.pool = null;
  }

  /** The detector configuration, for the event display's geometry. */
  get detector() {
    return resolveDetector($state.snapshot(this.config.detector) as PipelineConfig['detector']);
  }
}
