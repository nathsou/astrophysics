/**
 * The bench's state: the circuit being edited with its undo history, the selection, the view, the
 * running simulation and the instruments. One instance per page; the canvas, palette, inspector,
 * toolbar and instrument panels all talk to it.
 *
 * Editing: `commit(next)` records a new circuit in the history and stops the simulation (it restarts by
 * itself a moment later if it was running). Small changes to a running circuit (turning a knob, flipping
 * a switch) go through `setParam`, which keeps the engine.
 */
import { base } from '$app/paths';
import type { Engine, EngineMessage } from '../../sim/engine';
import type { Connectivity, EngineKind, ParamValue, Circuit, Rot } from '../../sim/netlist/types';
import { flatten, topLevelNets } from '../../sim/netlist/flatten';
import { createEngine } from '../engines';
import type { SchematicMode } from '../model';
import { encodeShare, loadDraft, parseCircuitJson, saveDraft, shareUrl, type BenchExtras } from '../share';
import { renameInProbes, type ProbeRef } from '../instruments/probes';
import { isKind, markersOf, timeSpanOf, withDefaultConfig, defaultConfig, type Instrument, type InstrumentKind, type Marker } from '../instruments/kinds';
import { canRedo, canUndo, commit, createHistory, redo, reset, undo, type History } from './history';
import { circuitBox, layoutOf } from './layout';
import { addWire, duplicateSelection, emptySelection, extract, freeOffset, isEmpty, mirrorSelection, moveSelection, normalise, paste, place, removeSelection, renameId, rerouteWire, rotateSelection, selectAll, setLabel, setParam, setTitle, type Fragment, type Selection } from './ops';
import { clampSpeed, defaultSpeed, engineOf, engineProblems, Stepper } from './sim';
import { fitBox, zoomAt, type View } from './view';
import type { Pt } from './layout';

export type Tool = 'select' | 'wire';
export type SimState = 'edit' | 'paused' | 'running';

/** A request for the next click on the schematic to choose a probe point. */
export interface PickRequest {
  /** What is being attached, shown in the banner: "CH1", "multimeter +". */
  label: string;
  /** Pins only (an ammeter needs a component pin), or any pin or wire. */
  pinsOnly?: boolean;
  onpick: (ref: ProbeRef) => void;
}

export type Notice = { id: number; text: string; level: 'info' | 'warning' | 'error' };

/** Parameters that change a part's pins or names: they need a fresh engine even in the analog engine. */
const STRUCTURAL = new Set(['inputs', 'name', 'dir']);
/** Parts whose parameters every engine can change while it runs. */
const LIVE_EVERYWHERE = new Set(['toggle', 'button', 'clock', 'const', 'switch', 'spdt', 'pushbutton']);

const emptyCircuit = (): Circuit => ({ version: 1, components: [], wires: [] });

export class Bench {
  // ── The document ───────────────────────────────────────────────────────────
  circuit = $state.raw<Circuit>(emptyCircuit());
  /** A circuit being dragged (not yet committed): shown instead of `circuit`. */
  draft = $state.raw<Circuit | null>(null);
  history = $state.raw<History<Circuit>>(createHistory(emptyCircuit()));
  selection = $state.raw<Selection>(emptySelection);
  clipboard: Fragment | undefined;

  // ── The view and the tools ─────────────────────────────────────────────────
  view = $state<View>({ x: -60, y: -60, zoom: 1.5 });
  viewport = $state({ w: 900, h: 600 });
  tool = $state<Tool>('select');
  /** The catalog type being placed (the ghost follows the pointer), if any. */
  placing = $state<string | null>(null);
  pick = $state.raw<PickRequest | null>(null);
  /** Grid position under the pointer, for the status bar. */
  cursor = $state<Pt | null>(null);
  wireDrafting = $state(false);
  private fitPending = false;
  /** The canvas has reported its real size at least once. */
  private sized = false;

  // ── The simulation ─────────────────────────────────────────────────────────
  engine = $state.raw<Engine | null>(null);
  sim = $state<SimState>('edit');
  /** Simulated seconds per real second, when not following an instrument. */
  speed = $state(1);
  autoSpeed = $state(true);
  /** The reader chose a speed: stop suggesting one from the circuit. */
  private speedManual = false;
  mode = $state<SchematicMode>('logic');
  showCurrent = $state(true);
  simTime = $state(0);
  lagging = $state(false);
  error = $state('');
  messages = $state.raw<EngineMessage[]>([]);
  private stepper = new Stepper(10);
  private generation = 0;
  private resumeTimer: ReturnType<typeof setTimeout> | undefined;
  private shownMessages = 0;

  // ── Instruments and notices ────────────────────────────────────────────────
  instruments = $state<Instrument[]>([]);
  notice = $state<Notice | null>(null);
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  private hooks = new Set<(dt: number) => void>();
  private counter = 0;

  // ── Derived ────────────────────────────────────────────────────────────────
  /** What is drawn: the circuit, or the draft while dragging. */
  shown = $derived(this.draft ?? this.circuit);
  conn = $derived.by<Connectivity | undefined>(() => {
    try {
      return topLevelNets(this.circuit);
    } catch {
      return undefined;
    }
  });
  engineKind = $derived<EngineKind>(engineOf(this.circuit));
  problems = $derived(engineProblems(this.circuit, this.engineKind));
  canUndo = $derived(canUndo(this.history));
  canRedo = $derived(canRedo(this.history));
  markers = $derived<Marker[]>(this.instruments.flatMap((i) => markersOf(i)));
  /** Simulated seconds across the widest time-based instrument, when the speed follows it. */
  timeSpan = $derived(this.instruments.map(timeSpanOf).find((s) => s !== undefined));
  effectiveSpeed = $derived(this.autoSpeed && this.timeSpan ? clampSpeed(this.timeSpan / 3) : clampSpeed(this.speed));
  empty = $derived(this.circuit.components.length === 0 && this.circuit.wires.length === 0);
  selectedComponents = $derived(this.circuit.components.filter((c) => this.selection.ids.has(c.id)));
  sources = $derived(this.circuit.components.filter((c) => c.type === 'supply' || c.type === 'siggen'));

  constructor() {
    this.mode = 'logic';
  }

  // ── Editing ────────────────────────────────────────────────────────────────

  /** Record a new circuit (an edit): stops the simulation, which resumes shortly if it was running. */
  commit(next: Circuit, options: { key?: string; keepWires?: boolean } = {}): void {
    if (next === this.circuit) return;
    this.history = commit(this.history, next, { key: options.key });
    this.circuit = next;
    this.draft = null;
    if (!options.keepWires && this.selection.wires.size) this.selection = { ids: this.selection.ids, wires: new Set() };
    this.invalidate();
  }

  /** Apply an operation to the circuit and record the result. */
  edit(fn: (c: Circuit) => Circuit, options: { key?: string; keepWires?: boolean } = {}): void {
    this.commit(fn(this.circuit), options);
  }

  undo(): void {
    if (!canUndo(this.history)) return;
    this.history = undo(this.history);
    this.afterHistory();
  }
  redo(): void {
    if (!canRedo(this.history)) return;
    this.history = redo(this.history);
    this.afterHistory();
  }
  private afterHistory(): void {
    this.circuit = this.history.present;
    this.draft = null;
    const ids = new Set(this.circuit.components.map((c) => c.id));
    this.selection = { ids: new Set([...this.selection.ids].filter((i) => ids.has(i))), wires: new Set() };
    this.invalidate();
  }

  /** Change the circuit without touching the engine or the undo steps (a switch flipped while running). */
  private replacePresent(next: Circuit): void {
    this.circuit = next;
    this.history = { ...this.history, present: next };
  }

  /** The reader flipped a switch in the running schematic: remember it in the circuit. */
  syncParam(id: string, key: string, value: ParamValue): void {
    this.replacePresent(setParam(this.circuit, id, key, value));
  }

  /**
   * Change a parameter. A running analog circuit keeps its engine (the parameter is changed in place, so
   * a scope trace shows the step); anything that changes pins or names restarts it.
   */
  setParam(id: string, key: string, value: ParamValue): void {
    const c = this.circuit.components.find((x) => x.id === id);
    if (!c) return;
    const next = setParam(this.circuit, id, key, value);
    const e = this.engine;
    const live = e && !STRUCTURAL.has(key) && (e.kind === 'analog' || LIVE_EVERYWHERE.has(c.type));
    if (!live) {
      this.commit(next, { key: `param:${id}:${key}`, keepWires: true });
      return;
    }
    try {
      e.setParam(id, key, value);
    } catch {
      this.commit(next, { key: `param:${id}:${key}`, keepWires: true });
      return;
    }
    this.history = commit(this.history, next, { key: `param:${id}:${key}` });
    this.circuit = next;
    this.hooks.forEach((h) => h(0));
  }

  setLabel(id: string, label: string | undefined): void {
    this.edit((c) => setLabel(c, id, label), { key: `label:${id}` });
  }

  rename(id: string, to: string): boolean {
    const next = renameId(this.circuit, id, to);
    if (next === this.circuit) return false;
    const name = to.trim();
    this.instruments = renameInProbes($state.snapshot(this.instruments), id, name);
    this.commit(next);
    this.selection = { ids: new Set([...this.selection.ids].map((i) => (i === id ? name : i))), wires: new Set() };
    return true;
  }

  setTitle(title: string): void {
    this.edit((c) => setTitle(c, title), { key: 'title' });
  }

  setSpeed(speed: number): void {
    this.speedManual = true;
    this.speed = clampSpeed(speed);
  }

  setEngineKind(kind: EngineKind): void {
    this.edit((c) => ({ ...c, engine: kind }));
    if (this.mode !== 'plain') this.mode = kind === 'analog' ? 'voltage' : 'logic';
    if (!this.speedManual && !this.timeSpan) this.speed = defaultSpeed(this.circuit, kind);
  }

  // Selection and structure edits used by keys and buttons.

  select(sel: Selection): void {
    this.selection = sel;
  }
  clearSelection(): void {
    if (!isEmpty(this.selection)) this.selection = emptySelection;
  }
  selectEverything(): void {
    this.selection = selectAll(this.circuit);
  }

  placePart(type: string, x: number, y: number, options: { params?: Record<string, ParamValue>; rot?: Rot; flip?: boolean } = {}): string {
    const r = place(this.circuit, type, x, y, options);
    this.commit(r.circuit);
    this.selection = { ids: new Set([r.id]), wires: new Set() };
    return r.id;
  }

  addWirePath(points: Pt[]): void {
    this.commit(addWire(this.circuit, points));
  }

  moveSelected(dx: number, dy: number, key?: string): void {
    if (isEmpty(this.selection)) return;
    this.edit((c) => moveSelection(c, this.selection, dx, dy), { key, keepWires: false });
  }
  /** Replace the selected wire's route by a straight line or an L between its ends. */
  tidyWire(first: 'h' | 'v'): void {
    const i = [...this.selection.wires][0];
    if (i === undefined || this.selection.wires.size !== 1) return;
    this.commit(rerouteWire(this.circuit, i, first));
  }
  rotateSelected(): void {
    if (isEmpty(this.selection)) return;
    this.edit((c) => rotateSelection(c, this.selection));
  }
  mirrorSelected(axis: 'x' | 'y' = 'x'): void {
    if (isEmpty(this.selection)) return;
    this.edit((c) => mirrorSelection(c, this.selection, axis));
  }
  deleteSelected(): void {
    if (isEmpty(this.selection)) return;
    const sel = this.selection;
    this.commit(removeSelection(this.circuit, sel));
    this.selection = emptySelection;
  }
  duplicateSelected(): void {
    if (isEmpty(this.selection)) return;
    const r = duplicateSelection(this.circuit, this.selection);
    this.commit(r.circuit);
    this.selection = { ids: new Set(r.ids), wires: new Set() };
  }
  copySelected(): void {
    if (!isEmpty(this.selection)) this.clipboard = extract(this.circuit, this.selection);
  }
  cutSelected(): void {
    this.copySelected();
    this.deleteSelected();
  }
  pasteClipboard(): void {
    if (!this.clipboard) return;
    const [dx, dy] = freeOffset(this.circuit, this.clipboard, 2, 2);
    const r = paste(this.circuit, this.clipboard, dx, dy);
    this.commit(r.circuit);
    // The next paste lands a little further on.
    this.clipboard = { components: this.clipboard.components.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy })), wires: this.clipboard.wires.map((w) => w.map((p) => [p[0] + dx, p[1] + dy] as Pt)) };
    this.selection = { ids: new Set(r.ids), wires: new Set() };
  }

  // ── Opening and saving ─────────────────────────────────────────────────────

  /** Start from a circuit (opened, imported, from a link): clears the history and the simulation. */
  load(circuit: Circuit, extras?: BenchExtras): void {
    const c = normalise(circuit);
    this.stop();
    this.circuit = c;
    this.draft = null;
    this.history = reset(this.history, c);
    this.selection = emptySelection;
    this.tool = 'select';
    this.placing = null;
    this.pick = null;
    this.applyExtras(extras);
    const kind = engineOf(c);
    this.mode = kind === 'analog' ? 'voltage' : 'logic';
    if (typeof extras?.mode === 'string' && ['logic', 'voltage', 'plain'].includes(extras.mode)) this.mode = extras.mode as SchematicMode;
    this.speedManual = typeof extras?.speed === 'number';
    this.speed = typeof extras?.speed === 'number' ? clampSpeed(extras.speed) : defaultSpeed(c, kind);
    this.autoSpeed = typeof extras?.autoSpeed === 'boolean' ? extras.autoSpeed : true;
    this.showCurrent = typeof extras?.showCurrent === 'boolean' ? extras.showCurrent : true;
    this.fitPending = !this.sized;
    this.fit();
  }

  newCircuit(): void {
    this.instruments = [];
    this.load(emptyCircuit());
  }

  private applyExtras(extras?: BenchExtras): void {
    const list = extras?.instruments;
    if (!Array.isArray(list)) {
      this.instruments = [];
      return;
    }
    const out: Instrument[] = [];
    for (const raw of list) {
      const r = raw as Partial<Instrument> | undefined;
      if (!r || !isKind(r.kind)) continue;
      out.push({ id: typeof r.id === 'string' ? r.id : this.newInstrumentId(r.kind), kind: r.kind, collapsed: !!r.collapsed, config: withDefaultConfig(r.kind, r.config) });
    }
    this.instruments = out;
  }

  /** The bench's own state that travels with the circuit. */
  extras(): BenchExtras {
    const out: BenchExtras = { speed: this.speed, autoSpeed: this.autoSpeed, mode: this.mode, showCurrent: this.showCurrent };
    if (this.instruments.length) out.instruments = $state.snapshot(this.instruments);
    return out;
  }

  autosave(): boolean {
    return saveDraft(this.circuit, this.extras());
  }

  /** Load the autosaved circuit; returns whether there was one. */
  restoreDraft(): boolean {
    const d = loadDraft();
    if (!d) return false;
    this.load(d.circuit, d.extras);
    return true;
  }

  /**
   * The circuit as JSON text, ready for a chapter's circuits/ folder: the engine is written out (the
   * widget defaults to digital) and the bench's own state (instruments, speed) is left out.
   */
  exportJson(): string {
    return JSON.stringify({ ...this.circuit, engine: this.engineKind }, null, 2) + '\n';
  }

  importText(text: string): void {
    const p = parseCircuitJson(text);
    this.load(p.circuit, p.extras);
  }

  async shareLink(): Promise<string> {
    const payload = await encodeShare(this.circuit, this.extras());
    return shareUrl(location.origin, base, payload);
  }

  // ── The view ───────────────────────────────────────────────────────────────

  fit(): void {
    const box = circuitBox(this.circuit, layoutOf(this.circuit));
    // Labels and notes hang outside the parts and wires: leave room for them.
    const roomy = box && { x0: box.x0 - 2, y0: box.y0 - 3, x1: box.x1 + 4, y1: box.y1 + 3 };
    this.view = fitBox(roomy, this.viewport.w, this.viewport.h);
  }

  /** The canvas was resized; the first fit waits for a real size. */
  resized(w: number, h: number): void {
    const old = this.viewport;
    this.viewport = { w, h };
    const first = !this.sized;
    this.sized = true;
    if (this.fitPending && w > 100) {
      this.fitPending = false;
      this.fit();
    } else if (!first && (old.w !== w || old.h !== h)) {
      // Keep whatever is in the middle of the canvas in the middle (a panel opening, the window resizing).
      const z = this.view.zoom;
      this.view = { ...this.view, x: this.view.x + (old.w - w) / 2 / z, y: this.view.y + (old.h - h) / 2 / z };
    }
  }

  zoomBy(factor: number): void {
    this.view = zoomAt(this.view, this.viewport.w / 2, this.viewport.h / 2, factor);
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  private async build(): Promise<boolean> {
    const gen = ++this.generation;
    this.error = '';
    try {
      const flat = flatten(this.circuit);
      const engine = await createEngine(this.engineKind, flat, { budgetMs: 8 } as object);
      if (gen !== this.generation) return false;
      engine.settle();
      this.engine = engine;
      this.simTime = engine.time;
      this.shownMessages = 0;
      this.messages = [];
      this.pollMessages();
      return true;
    } catch (e) {
      if (gen === this.generation) this.error = e instanceof Error ? e.message : String(e);
      return false;
    }
  }

  async run(): Promise<void> {
    clearTimeout(this.resumeTimer);
    if (this.engine) {
      this.sim = 'running';
      return;
    }
    if (this.empty) {
      this.error = 'Nothing to simulate yet: place some parts first.';
      return;
    }
    if (this.problems.length) {
      this.error = `The ${this.engineKind} engine cannot simulate ${this.problems.slice(0, 3).join(', ')}${this.problems.length > 3 ? '…' : ''}. Choose another engine.`;
    }
    this.pick = null;
    // A circuit built by hand has no speed of its own yet: suggest one from its parts.
    if (!this.speedManual && !this.timeSpan) this.speed = defaultSpeed(this.circuit, this.engineKind);
    if (await this.build()) {
      this.sim = 'running';
      this.hooks.forEach((h) => h(0));
    } else this.sim = 'edit';
  }

  pause(): void {
    clearTimeout(this.resumeTimer);
    if (this.sim === 'running') this.sim = 'paused';
  }

  toggleRun(): void {
    if (this.sim === 'running') this.pause();
    else void this.run();
  }

  /** Leave the simulation and go back to editing. */
  stop(): void {
    clearTimeout(this.resumeTimer);
    this.generation++;
    this.engine = null;
    this.sim = 'edit';
    this.lagging = false;
    this.simTime = 0;
    this.hooks.forEach((h) => h(0));
  }

  /** Back to time zero (a fresh engine), keeping running or paused. */
  async reset(): Promise<void> {
    if (this.sim === 'edit') return;
    const was = this.sim;
    this.engine = null;
    if (await this.build()) {
      this.sim = was;
      this.hooks.forEach((h) => h(0));
    } else this.sim = 'edit';
  }

  /** One step: a twentieth of a second at the current speed. */
  async step(): Promise<void> {
    if (!this.engine) await this.run();
    if (!this.engine) return;
    this.sim = 'paused';
    this.advance(0.05);
    this.hooks.forEach((h) => h(0));
  }

  private advance(dtReal: number): void {
    const e = this.engine;
    if (!e || !(dtReal > 0)) return;
    try {
      this.stepper.advance(e, dtReal * this.effectiveSpeed);
      this.lagging = this.stepper.lagging;
    } catch (err) {
      this.pause();
      this.error = `Simulation stopped: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /** Called every animation frame: advance the simulation, then let the drawing and instruments read it. */
  tick(dtReal: number): void {
    if (this.sim === 'running') this.advance(dtReal);
    for (const h of this.hooks) h(dtReal);
    const e = this.engine;
    if (e) {
      this.pollMessages();
      if (e.time !== this.simTime) this.simTime = e.time;
    }
  }

  private pollMessages(): void {
    const e = this.engine;
    if (!e || e.messages.length === this.shownMessages) return;
    this.shownMessages = e.messages.length;
    this.messages = [...e.messages];
  }

  /** Called after an edit: throw the engine away, and restart it shortly if the simulation was running. */
  private invalidate(): void {
    if (!this.engine && this.sim === 'edit') return;
    const wasRunning = this.sim === 'running';
    this.stop();
    if (wasRunning && !this.empty) this.scheduleResume();
  }

  private scheduleResume(): void {
    clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => {
      // Not while something is being dragged: the engine would be built for the wrong circuit.
      if (this.draft) this.scheduleResume();
      else void this.run();
    }, 400);
  }

  /** An edit is starting (a drag): drop the engine now, and resume when it is over if it was running. */
  interrupt(): void {
    this.invalidate();
  }

  onFrame(fn: (dt: number) => void): () => void {
    this.hooks.add(fn);
    return () => this.hooks.delete(fn);
  }

  /** Engine net of a top-level net number. */
  engineNet(n: number): number {
    return this.engine?.netlist.alias?.[n] ?? n;
  }

  // ── Instruments ────────────────────────────────────────────────────────────

  private newInstrumentId(kind: InstrumentKind): string {
    let id: string;
    do id = `${kind}${++this.counter}`;
    while (this.instruments.some((i) => i.id === id));
    return id;
  }

  addInstrument(kind: InstrumentKind): Instrument {
    const inst: Instrument = { id: this.newInstrumentId(kind), kind, config: defaultConfig(kind) };
    this.instruments.push(inst);
    // Newest first is easier to find; the panels keep their order otherwise.
    return this.instruments[this.instruments.length - 1]!;
  }

  removeInstrument(id: string): void {
    this.instruments = this.instruments.filter((i) => i.id !== id);
  }

  /** Ask the reader to click a pin or wire on the schematic. */
  startPick(request: PickRequest): void {
    this.tool = 'select';
    this.placing = null;
    this.pick = request;
  }
  cancelPick(): void {
    this.pick = null;
  }

  // ── Notices ────────────────────────────────────────────────────────────────

  say(text: string, level: Notice['level'] = 'info'): void {
    clearTimeout(this.noticeTimer);
    this.notice = { id: ++this.counter, text, level };
    this.noticeTimer = setTimeout(() => (this.notice = null), level === 'error' ? 6000 : 3000);
  }

}
