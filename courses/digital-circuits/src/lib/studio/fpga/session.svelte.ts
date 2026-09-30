/**
 * The FPGA workspace's state: the DCL source, its analysis (for the editor and the gate view), the flow's result and
 * everything derived from it, the shared selection, and the three activities around a fit: running from the bits on
 * the virtual board, replaying the toolchain's traces, and configuring the small device by hand.
 *
 * Panes read this object (Svelte 5 runes) and ask it to change things; it knows how to fit, not how anything looks.
 */
import { untrack } from 'svelte';
import { encodeState } from '../state-hash';
import type { Analysis } from '../../hdl/editor/analysis';
import type { Analyzer } from '../../hdl/editor/client';
import type { RtlDesign } from '../../hdl/rtl';
import { getVFpga, type VFpgaDevice } from '../../pld/devices/vfpga';
import { bindBoard, boardOutputs, emptyBoardInputs, type BoardBinding, type BoardInputs, type BoardOutputs } from './board';
import { analysisForFit, AnalysisInterrupted, SharedRequests } from './analysis-share';
import { buildChipModel, type ChipModel } from './chipmodel';
import { Cancelled, createFlowClient, FlowFailure, type FlowClient } from './client';
import { buildIndex, logicLinkOf, resolveFpga, type FpgaIndex, type LogicLink } from './crossmap';
import { exampleOfSource, fpgaExample } from './examples';
import { FabricSim, boardPorts } from './fabric-sim';
import { HandDevice, checkGoal, xorSolution, XOR_GOAL, type GoalCheck, type HandGoal } from './hand';
import { buildHierarchy, type HierNode } from './hierarchy';
import { congestionMap, overusedAt, placeFrame, positionOfStep } from './replay';
import { EMPTY_FPGA_PROBE, fpgaRefKey, flowProgress, type FpgaProbe, type FpgaRef, type FpgaResult, type VFpgaSize } from './types';

export type SizeChoice = 'auto' | VFpgaSize;
export type Op = { op: 'set'; name: string; value: bigint } | { op: 'tick' } | { op: 'reset' };

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const MAX_OPS = 20000;

// ── Running from bits ────────────────────────────────────────────────────────────────────────────

/** The virtual board wired to the configured device. */
export class BoardRun {
  sim = $state.raw<FabricSim | null>(null);
  binding = $state.raw<BoardBinding | null>(null);
  inputs = $state.raw<BoardInputs>(emptyBoardInputs());
  outputs = $state.raw<BoardOutputs | null>(null);
  agreement = $state.raw<{ ok: boolean; mismatches: string[]; checked: number } | null>(null);
  /** Changes with every step, so canvases and readouts repaint. */
  tick = $state(0);
  cycles = $state(0);
  running = $state(false);
  /** Requested clock rate (cycles per second of wall time); 0 means as fast as the page allows. */
  speed = $state(4);
  /** Measured rate while running. */
  hz = $state(0);
  error = $state('');
  /** Called with each operation the gate view should mirror. */
  onop: ((op: Op) => void) | undefined;

  private raf = 0;
  private last = 0;
  private owed = 0;
  private hzCount = 0;
  private hzStart = 0;
  private design: RtlDesign | undefined;

  load(result: FpgaResult, device: VFpgaDevice, design: RtlDesign | undefined): void {
    this.dispose();
    this.design = design;
    try {
      const binding = bindBoard(design ? boardPorts(design) : result.ports.map((p) => ({ name: p.name.replace(/\[\d+\]$/, ''), dir: p.dir, width: 1, clock: p.clock })));
      this.binding = binding;
      this.inputs = emptyBoardInputs();
      this.sim = new FabricSim(device, result.bits, { ports: result.ports, binding, design, periodNs: result.critical.periodNs });
      this.sim.setInputs(this.inputs);
      this.error = '';
      this.cycles = 0;
      this.refresh();
    } catch (e) {
      this.sim = null;
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  private refresh(): void {
    const s = this.sim;
    if (!s) return;
    this.outputs = s.board();
    const c = s.compare();
    this.agreement = { ok: c.mismatches.length === 0, mismatches: c.mismatches, checked: c.checked };
    this.cycles = s.cycles;
    this.tick++;
  }

  private push(): void {
    this.sim?.setInputs(this.inputs);
    this.refresh();
  }

  /** The value of every design input port for the board's inputs (for the gate view). */
  portValues(): Map<string, bigint> {
    const out = new Map<string, bigint>();
    const b = this.binding;
    if (!b || !this.sim) return out;
    const add = (name: string, bit: number, on: boolean) => {
      const cur = out.get(name) ?? 0n;
      out.set(name, on ? cur | (1n << BigInt(bit)) : cur);
    };
    for (const x of b.bound) {
      const m = /^(.*?)(?:\[(\d+)\])?$/.exec(x.port)!;
      const name = m[1]!;
      const bit = m[2] ? Number(m[2]) : 0;
      if (x.resource === 'rst') add(name, bit, this.inputs.reset);
      else if (x.resource === 'btn') add(name, bit, this.inputs.buttons[x.index] ?? false);
      else if (x.resource === 'sw') add(name, bit, this.inputs.switches[x.index] ?? false);
    }
    for (const [n, v] of Object.entries(this.inputs.free)) {
      const m = /^(.*?)(?:\[(\d+)\])?$/.exec(n)!;
      add(m[1]!, m[2] ? Number(m[2]) : 0, v);
    }
    return out;
  }

  private mirrorInputs(): void {
    for (const [name, value] of this.portValues()) this.onop?.({ op: 'set', name, value });
  }

  /** A whole port set from outside (a switch flipped in the gate view): each bit goes to the board input it is bound to. */
  setPort(name: string, value: bigint): void {
    const b = this.binding;
    if (!b) return;
    let inputs = this.inputs;
    const bit = (i: number) => ((value >> BigInt(i)) & 1n) === 1n;
    for (const x of b.bound) {
      const m = /^(.*?)(?:\[(\d+)\])?$/.exec(x.port)!;
      if (m[1] !== name) continue;
      const on = bit(m[2] ? Number(m[2]) : 0);
      if (x.resource === 'rst') inputs = { ...inputs, reset: on };
      else if (x.resource === 'btn') inputs = { ...inputs, buttons: inputs.buttons.map((v, i) => (i === x.index ? on : v)) };
      else if (x.resource === 'sw') inputs = { ...inputs, switches: inputs.switches.map((v, i) => (i === x.index ? on : v)) };
    }
    for (const n of b.freeInputs) {
      const m = /^(.*?)(?:\[(\d+)\])?$/.exec(n)!;
      if (m[1] === name) inputs = { ...inputs, free: { ...inputs.free, [n]: bit(m[2] ? Number(m[2]) : 0) } };
    }
    this.inputs = inputs;
    this.push();
  }

  setSwitch(i: number, on: boolean): void {
    const s = [...this.inputs.switches];
    s[i] = on;
    this.inputs = { ...this.inputs, switches: s };
    this.push();
    this.mirrorInputs();
  }
  setButton(i: number, on: boolean): void {
    const b = [...this.inputs.buttons];
    b[i] = on;
    this.inputs = { ...this.inputs, buttons: b };
    this.push();
    this.mirrorInputs();
  }
  setReset(on: boolean): void {
    this.inputs = { ...this.inputs, reset: on };
    this.push();
    this.mirrorInputs();
  }
  setFree(name: string, on: boolean): void {
    this.inputs = { ...this.inputs, free: { ...this.inputs.free, [name]: on } };
    this.push();
    this.mirrorInputs();
  }

  /** `n` clock cycles. */
  step(n = 1): void {
    const s = this.sim;
    if (!s) return;
    for (let i = 0; i < n; i++) {
      s.clock();
      this.onop?.({ op: 'tick' });
    }
    this.refresh();
  }

  powerUp(): void {
    this.sim?.powerUp();
    this.onop?.({ op: 'reset' });
    this.mirrorInputs();
    this.refresh();
  }

  play(): void {
    if (this.running || !this.sim || typeof requestAnimationFrame === 'undefined') return;
    this.running = true;
    this.last = now();
    this.owed = 0;
    this.hzStart = this.last;
    this.hzCount = 0;
    const frame = () => {
      if (!this.running) return;
      const t = now();
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      // A fixed budget per frame: enough cycles for the requested rate, or as many as fit when the rate is 0.
      let n = 0;
      const start = now();
      if (this.speed > 0) {
        this.owed += this.speed * dt;
        n = Math.floor(this.owed);
        this.owed -= n;
      } else n = 1 << 20;
      const s = this.sim;
      if (s) {
        let done = 0;
        while (done < n && now() - start < 12) {
          s.clock();
          this.onop?.({ op: 'tick' });
          done++;
        }
        this.hzCount += done;
        if (done) this.refresh();
      }
      if (t - this.hzStart > 500) {
        this.hz = Math.round((this.hzCount * 1000) / (t - this.hzStart));
        this.hzStart = t;
        this.hzCount = 0;
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  pause(): void {
    this.running = false;
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.pause();
    this.sim = null;
    this.outputs = null;
    this.agreement = null;
  }
}

// ── Replay ───────────────────────────────────────────────────────────────────────────────────────

/** The scrubber over the placement and routing traces. */
export class ReplayState {
  mode = $state<'place' | 'route'>('place');
  /** Placement: position 0…1 over the snapshots. Routing: 0…1 over the iterations. */
  pos = $state(1);
  playing = $state(false);
  links = $state(true);
  private raf = 0;
  private t0 = 0;

  setMode(m: 'place' | 'route'): void {
    this.pause();
    this.mode = m;
    this.pos = 1;
  }

  play(seconds = 8): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    if (this.pos >= 1) this.pos = 0;
    this.playing = true;
    this.t0 = now();
    const from = this.pos;
    const frame = () => {
      if (!this.playing) return;
      const p = Math.min(1, from + ((now() - this.t0) / 1000 / seconds) * (1 - from) / Math.max(0.0001, 1 - from));
      this.pos = p;
      if (p >= 1) this.playing = false;
      else this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  pause(): void {
    this.playing = false;
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
  }
}

// ── By hand ──────────────────────────────────────────────────────────────────────────────────────

/** The small device configured by clicking, with a goal to reach. */
export class HandMode {
  device = getVFpga('S');
  private dev = new HandDevice(this.device);
  /** Bumps with every edit. */
  tick = $state(0);
  goal = $state.raw<HandGoal | null>(XOR_GOAL);
  check = $state.raw<GoalCheck | null>(null);
  /** The routing node the inspector shows. */
  node = $state<number | null>(null);
  message = $state('');

  get hand(): HandDevice {
    return this.dev;
  }
  /** A copy of the configuration that changes identity with every edit, so what depends on it recomputes. */
  private now = $state.raw<Uint8Array>(new Uint8Array(0));
  get bits(): Uint8Array {
    return this.now;
  }
  get canUndo(): boolean {
    void this.tick;
    return this.dev.canUndo;
  }
  get canRedo(): boolean {
    void this.tick;
    return this.dev.canRedo;
  }

  private after(): void {
    this.now = this.dev.bits.slice();
    this.tick++;
    this.check = this.goal ? checkGoal(this.device, this.dev.bits, this.goal) : null;
  }

  edit(f: (h: HandDevice) => void): void {
    f(this.dev);
    this.after();
  }
  undo(): void {
    this.dev.undo();
    this.after();
  }
  redo(): void {
    this.dev.redo();
    this.after();
  }
  clear(): void {
    this.dev.clear();
    this.node = null;
    this.after();
  }
  showSolution(): void {
    this.dev.load(xorSolution(this.device));
    this.after();
  }
  loadBits(bits: Uint8Array): void {
    this.dev.load(bits);
    this.after();
  }
  constructor() {
    this.now = this.dev.bits.slice();
    this.check = this.goal ? checkGoal(this.device, this.dev.bits, this.goal) : null;
  }
}

// ── The session ──────────────────────────────────────────────────────────────────────────────────

export interface FpgaSessionOptions {
  example?: string;
  source?: string;
  size?: SizeChoice;
  /** Fit again shortly after the source changes. */
  auto?: boolean;
  /** Called when the source or example changes (the host keeps the URL hash in step). */
  onsource?: (source: string, example: string | null) => void;
}

export class FpgaSession {
  source = $state('');
  exampleId = $state<string | null>(null);
  size = $state<SizeChoice>('auto');
  auto = $state(false);
  top = $state<string | undefined>(undefined);

  analysis = $state.raw<Analysis | undefined>(undefined);
  /** The last analysis that compiled (the gate view keeps showing it while the source has errors). */
  goodAnalysis = $state.raw<Analysis | undefined>(undefined);
  analysing = $state(false);

  status = $state<'idle' | 'running' | 'ok' | 'error'>('idle');
  doneStages = $state.raw<ReadonlySet<string>>(new Set());
  runningStage = $state('');
  stageMs = $state.raw<Record<string, number>>({});
  error = $state.raw<{ message: string; stage?: string } | null>(null);
  result = $state.raw<FpgaResult | null>(null);
  device = $state.raw<VFpgaDevice | null>(null);
  index = $state.raw<FpgaIndex | null>(null);
  fittedSource = $state('');
  /** The last fit ran in a Web Worker (false: in the page, where workers are unavailable). */
  inWorker = $state(false);
  private fittedDesign: RtlDesign | undefined;

  selected = $state.raw<FpgaRef | null>(null);
  hovered = $state.raw<FpgaRef | null>(null);

  mode = $state<'design' | 'hand'>('design');
  readonly run = new BoardRun();
  readonly replay = new ReplayState();
  readonly hand = new HandMode();
  /** What the gate view has been told (inputs and clocks), replayed when it is rebuilt. */
  ops = $state.raw<Op[]>([]);

  private client: FlowClient | undefined;
  /** Analysis requests in flight, by text: the editor and `fit` share one instead of superseding each other. */
  private readonly requests = new SharedRequests<Analysis>();
  /** Changes when a fit starts and when one is cancelled; a fit that finds it changed has been replaced. */
  private fitToken = 0;
  private analyzer: Analyzer | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly key = `fpga-${Math.random().toString(36).slice(2)}`;
  private readonly onsource: FpgaSessionOptions['onsource'];

  constructor(opts: FpgaSessionOptions = {}) {
    this.size = opts.size ?? 'auto';
    this.auto = opts.auto ?? false;
    this.onsource = opts.onsource;
    const ex = fpgaExample(opts.example) ?? (opts.source === undefined ? fpgaExample('counter') : undefined);
    this.source = opts.source ?? ex?.source ?? '';
    this.exampleId = ex && ex.source === this.source ? ex.id : (exampleOfSource(this.source)?.id ?? null);
    if (this.size === 'auto' && ex && opts.size === undefined) this.size = 'auto';
    this.run.onop = (op) => this.pushOp(op);
  }

  // ── Derived ───────────────────────────────────────────────────────────
  link = $derived<LogicLink | undefined>(this.goodAnalysis?.lowered ? logicLinkOf(this.goodAnalysis.lowered) : undefined);
  stale = $derived(this.result !== null && this.source !== this.fittedSource);
  progress = $derived(flowProgress(this.doneStages, this.runningStage));
  hasErrors = $derived(!!this.analysis && !this.analysis.ok);
  chipModel = $derived.by<ChipModel | null>(() => {
    if (this.mode === 'hand') return buildChipModel(this.hand.device, this.hand.bits);
    const r = this.result;
    const d = this.device;
    return r && d ? buildChipModel(d, r.bits, r, this.index) : null;
  });
  hierarchy = $derived<HierNode[]>(this.index ? buildHierarchy(this.index) : []);
  probe = $derived<FpgaProbe>(this.resolve(this.selected));
  hoverProbe = $derived<FpgaProbe>(this.resolve(this.hovered));
  tops = $derived(this.analysis?.tops ?? this.goodAnalysis?.tops ?? []);

  private resolve(ref: FpgaRef | null): FpgaProbe {
    if (!ref) return EMPTY_FPGA_PROBE;
    if (this.index) return resolveFpga(this.index, ref);
    // Before a fit: source lines and gates still point at each other.
    const link = this.link;
    if (!link) return EMPTY_FPGA_PROBE;
    const elements = new Set<string>();
    const lines = new Set<number>();
    if (ref.kind === 'line') {
      lines.add(ref.line);
      for (const [id, e] of link.elements) if (e.line === ref.line) elements.add(id);
    } else if (ref.kind === 'element') {
      elements.add(ref.id);
      const e = link.elements.get(ref.id);
      if (e?.line !== undefined) lines.add(e.line);
    }
    return { ...EMPTY_FPGA_PROBE, elements, lines };
  }

  // ── Analysis (the editor's checker) ───────────────────────────────────
  private async getAnalyzer(): Promise<Analyzer> {
    this.analyzer ??= (await import('../../hdl/editor/client')).getAnalyzer();
    return this.analyzer;
  }

  /** The editor's `analyze`: check, elaborate and lower, in the analysis worker. */
  analyze = async (text: string): Promise<Analysis | undefined> => {
    this.analysing = true;
    return this.request(text);
  };

  /** One analysis request per text at a time (see `SharedRequests`). */
  private request(text: string): Promise<Analysis | undefined> {
    return this.requests.run(text, async () => (await this.getAnalyzer()).run({ source: text, file: 'design.dcl', top: this.top, design: true, circuit: { maxElements: 300 } }, this.key));
  }

  onanalysis = (a: Analysis): void => {
    this.analysing = false;
    this.analysis = a;
    if (a.ok && a.design) {
      this.goodAnalysis = a;
      if (this.auto && this.source !== this.fittedSource) this.schedule();
    }
  };

  // ── Source ────────────────────────────────────────────────────────────
  setSource(text: string): void {
    if (text === this.source) return;
    this.source = text;
    this.exampleId = exampleOfSource(text)?.id ?? null;
    this.selected = null;
    this.onsource?.(this.source, this.exampleId);
  }

  loadExample(id: string): void {
    const ex = fpgaExample(id);
    if (!ex) return;
    this.top = undefined;
    this.source = ex.source;
    this.exampleId = ex.id;
    this.selected = null;
    this.hovered = null;
    this.analysis = undefined;
    this.goodAnalysis = undefined;
    this.onsource?.(this.source, this.exampleId);
    if (this.size !== 'auto' && this.size !== ex.size && ['S', 'M', 'L'].indexOf(this.size) < ['S', 'M', 'L'].indexOf(ex.size)) this.size = ex.size;
    if (this.auto) this.schedule();
  }

  private schedule(): void {
    if (typeof window === 'undefined') return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.fit(), 700);
  }

  // ── Fitting ───────────────────────────────────────────────────────────
  private stage(name: string, phase: 'start' | 'end', ms?: number): void {
    if (phase === 'start') this.runningStage = name;
    else {
      this.doneStages = new Set([...this.doneStages, name]);
      this.stageMs = { ...this.stageMs, [name]: (this.stageMs[name] ?? 0) + (ms ?? 0) };
      if (this.runningStage === name) this.runningStage = '';
    }
  }

  /**
   * Check → elaborate → front end → … → bitstream. Resolves when the result is installed or the fit failed; the status
   * is never left on `running` by a fit that has stopped, unless a newer fit or `cancel` took it over.
   */
  async fit(): Promise<void> {
    clearTimeout(this.timer);
    const token = ++this.fitToken;
    const stale = () => token !== this.fitToken;
    this.status = 'running';
    this.error = null;
    this.doneStages = new Set();
    this.stageMs = {};
    this.runningStage = 'check';
    try {
      const t0 = now();
      // The analysis of the text: the editor's if it has one, else a request shared with the editor's own. If a newer
      // text or a lost worker supersedes it, this looks again (and gives up with an error after a few rounds).
      const got = await analysisForFit({
        source: () => this.source,
        current: () => this.analysis,
        request: async (text) => {
          const r = await this.request(text);
          if (r && this.source === text) {
            this.analysis = r;
            if (r.ok && r.design) this.goodAnalysis = r;
          }
          return r;
        },
        stale,
      });
      if (got === 'stale') return;
      const { source, analysis: a } = got;
      this.stage('check', 'end', a.timings.check ?? now() - t0);
      if (!a.ok) {
        const first = a.diagnostics.find((d) => d.severity === 'error');
        throw new FlowFailure(first ? `Line ${first.span.line}: ${first.message}` : 'The source has errors.', 'check');
      }
      this.stage('elaborate', 'start');
      this.stage('elaborate', 'end', a.timings.lower ?? 0);
      if (!a.design) throw new FlowFailure(a.designError ?? 'The design could not be elaborated.', 'elaborate');
      this.client ??= createFlowClient();
      const result = await this.client.run({
        design: a.design,
        device: this.size === 'auto' ? undefined : this.size,
        onProgress: (s, p, ms) => this.stage(s, p, ms),
      });
      if (stale()) return;
      this.inWorker = this.client.worker;
      this.install(result, a.design, source);
    } catch (e) {
      if (e instanceof Cancelled || stale()) return;
      const stage = e instanceof FlowFailure ? e.stage : e instanceof AnalysisInterrupted ? 'check' : undefined;
      this.error = { message: e instanceof Error ? e.message : String(e), stage };
      this.status = 'error';
      this.runningStage = '';
    }
  }

  cancel(): void {
    this.fitToken++;
    this.client?.cancel();
    this.status = this.result ? 'ok' : 'idle';
    this.runningStage = '';
  }

  private install(result: FpgaResult, design: RtlDesign, source: string): void {
    const device = getVFpga(result.size);
    this.fittedDesign = design;
    this.device = device;
    this.result = result;
    this.fittedSource = source;
    this.index = buildIndex(result, device, this.link);
    this.status = 'ok';
    this.runningStage = '';
    this.doneStages = new Set(['check', 'elaborate', ...Object.keys(result.times)]);
    if (this.selected && this.selected.kind !== 'line') this.selected = null;
    this.replay.pos = 1;
    this.ops = [];
    this.run.load(result, device, design);
    this.run.pause();
  }

  // ── Selection ─────────────────────────────────────────────────────────
  select(ref: FpgaRef | null): void {
    this.selected = ref && this.selected && fpgaRefKey(ref) === fpgaRefKey(this.selected) ? null : ref;
  }
  hover(ref: FpgaRef | null): void {
    if (fpgaRefKey(ref) !== fpgaRefKey(this.hovered)) this.hovered = ref;
  }

  // ── The gate view mirrors the board ───────────────────────────────────
  private pushOp(op: Op): void {
    const next = this.ops.length >= MAX_OPS ? this.ops.slice(-Math.floor(MAX_OPS / 2)) : this.ops;
    this.ops = [...next, op];
  }

  // ── Modes ─────────────────────────────────────────────────────────────
  setMode(m: 'design' | 'hand'): void {
    this.mode = m;
    this.selected = null;
    this.hovered = null;
    if (m === 'hand') this.run.pause();
  }

  /** The replay's current position of a step (for the plots to draw the marker). */
  replayStep(): number {
    const r = this.result;
    if (!r) return 0;
    return placeFrame(r.place, this.replay.pos).stepIndex;
  }

  positionOfStep(step: number): number {
    return this.result ? positionOfStep(this.result.place, step) : 0;
  }

  /** The routing replay's iteration index and its congestion, for the chip view. */
  routeCongestion(): { tiles: Map<string, number>; max: number; nodes: readonly number[] } | null {
    const r = this.result;
    const d = this.device;
    if (!r || !d) return null;
    const i = Math.round(this.replay.pos * (r.route.iterations.length - 1));
    const nodes = overusedAt(r.route, i);
    return { ...congestionMap(nodes, d), nodes };
  }

  destroy(): void {
    clearTimeout(this.timer);
    this.run.dispose();
    this.replay.pause();
    this.client?.dispose();
  }

  /** The hash that reopens this design in the Studio. */
  hash(): string {
    return untrack(() => encodeState({ device: 'fpga', example: this.exampleId ?? undefined, source: this.exampleId ? undefined : this.source }));
  }
}

export { boardOutputs };
