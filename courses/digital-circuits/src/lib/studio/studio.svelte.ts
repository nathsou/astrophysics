/**
 * The Studio's state: one device, its source, the fit, the shared selection, and the running device.
 * Every pane reads this object (Svelte 5 runes) and asks it to change things; it knows nothing about how
 * a device looks.
 *
 * Cross-probing: `selected` (a click) and `hovered` (a pointer passing over) are refs; `probe` and
 * `hoverProbe` are what the current fit says is related to them.
 */
import { getAdapter } from './adapters';
import { EMPTY_PROBE, refKey, type DeviceAdapter, type DeviceFit, type EditAction, type PinLevel, type Probe, type Ref, type RunState, type Runner, type SourceError } from './types';
import { encodeState } from './state-hash';
import { fpgaExample } from './fpga/examples';

/** The vFPGA is not a `DeviceAdapter` (its fit is asynchronous and runs in a worker): the Studio only tracks its source. */
export const FPGA_DEVICE = 'fpga';

export type LogicLevel = PinLevel | 'x';

export interface StudioOptions {
  device?: string;
  example?: string;
  source?: string;
  /** Start from a blank device instead of the example (devices that can be edited by hand). */
  blank?: boolean;
  /** Fit automatically shortly after the source changes. */
  auto?: boolean;
  /** Start from this configured device instead of fitting the source (by-hand widgets with a custom blank part). */
  fit?: DeviceFit;
}

const FIT_DELAY = 350;

export class Studio {
  deviceId = $state('gal22v10');
  exampleId = $state<string | null>(null);
  source = $state('');
  fit = $state.raw<DeviceFit | null>(null);
  /** Errors of the last failed fit, or the warnings of the last good one. */
  errors = $state.raw<SourceError[]>([]);
  /** The source text the current fit was made from. */
  fittedSource = $state('');
  auto = $state(true);
  /** The fit was changed by hand (a fuse blown or toggled) and no longer matches the source. */
  handEdited = $state(false);

  selected = $state.raw<Ref | null>(null);
  hovered = $state.raw<Ref | null>(null);

  inputs = $state.raw<Record<string, number>>({});
  run = $state.raw<RunState | null>(null);
  /** Levels of the outputs in the logic view, reported by the logic pane. */
  logic = $state.raw<Record<string, LogicLevel> | null>(null);
  /** A programming pulse for the chip view to animate. */
  flash = $state.raw<{ id: string; n: number } | null>(null);
  programming = $state(false);
  autoClock = $state(false);

  private runner: Runner | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private clockTimer: ReturnType<typeof setInterval> | undefined;
  private flashN = 0;
  private programTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(opts: StudioOptions = {}) {
    this.auto = opts.auto ?? true;
    this.load(opts);
  }

  // ── Derived views ───────────────────────────────────────────────────────
  adapter = $derived<DeviceAdapter | undefined>(getAdapter(this.deviceId));
  probe = $derived<Probe>(this.fit && this.selected ? this.fit.resolve(this.selected) : EMPTY_PROBE);
  hoverProbe = $derived<Probe>(this.fit && this.hovered ? this.fit.resolve(this.hovered) : EMPTY_PROBE);
  stale = $derived(this.fit !== null && this.source !== this.fittedSource);
  hasErrors = $derived(this.errors.some((e) => e.severity !== 'warning'));
  status = $derived<'ok' | 'stale' | 'error' | 'edited' | 'empty'>(
    !this.fit ? (this.hasErrors ? 'error' : 'empty') : this.hasErrors ? 'error' : this.handEdited ? 'edited' : this.stale ? 'stale' : 'ok',
  );
  /** Outputs on which the logic view and the device disagree (should always be empty). */
  mismatches = $derived.by<string[]>(() => {
    const run = this.run;
    const logic = this.logic;
    if (!run || !logic || !this.fit) return [];
    const bad: string[] = [];
    for (const o of this.fit.network.outputs) {
      const want = run.signals[o.name];
      const got = logic[o.name];
      if (got === undefined) continue;
      if (want !== got) bad.push(o.name);
    }
    return bad;
  });

  // ── Loading ─────────────────────────────────────────────────────────────
  /** Switch device and/or design. */
  load(opts: StudioOptions): void {
    this.cancelProgramming();
    const id = opts.device ?? this.deviceId;
    if (id === FPGA_DEVICE) return this.loadFpga(opts);
    const a = getAdapter(id) ?? getAdapter('gal22v10')!;
    this.deviceId = a.id;
    let source = opts.source;
    let example = opts.example;
    if (source === undefined) {
      const ex = a.examples.find((e) => e.id === example) ?? a.examples[0];
      example = ex?.id;
      source = ex?.source ?? '';
    } else if (!example) example = a.examples.find((e) => e.source === source)?.id;
    this.exampleId = example ?? null;
    this.source = source;
    this.selected = null;
    this.hovered = null;
    this.handEdited = false;
    this.fit = null;
    this.errors = [];
    if (opts.fit || (opts.blank && a.blank)) {
      const fit = opts.fit ?? a.blank!();
      this.fit = fit;
      this.fittedSource = this.source;
      this.handEdited = true;
      this.installFit(fit);
    } else this.fitNow();
  }

  /** Switch to the vFPGA: the workspace (`panes/fpga`) owns the flow; here only the source and example are kept. */
  private loadFpga(opts: StudioOptions): void {
    this.stopAutoClock();
    clearTimeout(this.timer);
    this.deviceId = FPGA_DEVICE;
    const ex = fpgaExample(opts.example) ?? (opts.source === undefined ? fpgaExample('counter') : undefined);
    this.source = opts.source ?? ex?.source ?? '';
    this.exampleId = ex && ex.source === this.source ? ex.id : null;
    this.selected = null;
    this.hovered = null;
    this.handEdited = false;
    this.fit = null;
    this.errors = [];
    this.run = null;
    this.runner = null;
  }

  loadExample(id: string): void {
    this.load({ device: this.deviceId, example: id });
  }

  // ── Source and fitting ──────────────────────────────────────────────────
  setSource(text: string): void {
    this.source = text;
    this.exampleId = this.adapter?.examples.find((e) => e.source === text)?.id ?? null;
    if (this.auto) this.schedule();
  }

  private schedule(): void {
    if (typeof window === 'undefined') return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fitNow(), FIT_DELAY);
  }

  fitNow(): void {
    clearTimeout(this.timer);
    const a = this.adapter;
    if (!a) return;
    const r = a.program(this.source);
    if (r.ok) {
      this.fit = r.fit;
      this.errors = r.warnings;
      this.fittedSource = this.source;
      this.handEdited = false;
      this.installFit(r.fit);
    } else this.errors = r.errors;
  }

  /** A new fit is in: a fresh runner at power-up, the inputs kept where their names still exist. */
  private installFit(fit: DeviceFit): void {
    const runner = fit.runner();
    this.runner = runner;
    const next: Record<string, number> = {};
    for (const n of runner.inputs) next[n] = this.inputs[n] ?? 0;
    this.inputs = next;
    this.run = runner.powerUp();
    this.run = runner.evaluate(next);
    this.logic = null;
    if (this.selected) {
      const p = fit.resolve(this.selected);
      if (!p.outputs.size && !p.terms.size && !p.signals.size && !p.bits.size) this.selected = null;
    }
    if (!runner.hasClock) this.stopAutoClock();
  }

  // ── Selection ───────────────────────────────────────────────────────────
  select(ref: Ref | null): void {
    this.selected = ref && this.selected && refKey(ref) === refKey(this.selected) ? null : ref;
  }

  hover(ref: Ref | null): void {
    if (refKey(ref) !== refKey(this.hovered)) this.hovered = ref;
  }

  // ── Running ─────────────────────────────────────────────────────────────
  setInput(name: string, value: number): void {
    if (!this.runner || (this.inputs[name] ?? 0) === (value ? 1 : 0)) return;
    this.inputs = { ...this.inputs, [name]: value ? 1 : 0 };
    this.run = this.runner.evaluate(this.inputs);
  }

  toggleInput(name: string): void {
    this.setInput(name, this.inputs[name] ? 0 : 1);
  }

  /** A rising clock edge. */
  clock(): void {
    if (!this.runner?.hasClock) return;
    this.run = this.runner.clock(this.inputs);
  }

  powerUp(): void {
    if (!this.runner) return;
    this.run = this.runner.powerUp();
    this.run = this.runner.evaluate(this.inputs);
  }

  setAutoClock(on: boolean): void {
    this.stopAutoClock();
    if (!on || typeof window === 'undefined' || !this.runner?.hasClock) return;
    this.autoClock = true;
    this.clockTimer = setInterval(() => this.clock(), 700);
  }

  stopAutoClock(): void {
    clearInterval(this.clockTimer);
    this.autoClock = false;
  }

  /** The logic pane reports the levels it sees on the output LEDs. */
  reportLogic(levels: Record<string, LogicLevel>): void {
    this.logic = levels;
  }

  // ── Editing by hand ─────────────────────────────────────────────────────
  get editable(): boolean {
    return !!this.fit?.edit;
  }

  edit(action: EditAction): void {
    const fit = this.fit;
    if (!fit?.edit) return;
    const next = fit.edit(action);
    if (next === fit) return;
    this.fit = next;
    this.handEdited = true;
    this.installFit(next);
  }

  /** Start over with a virgin device (by-hand programming). */
  resetDevice(): void {
    this.cancelProgramming();
    this.edit({ type: 'reset' });
  }

  private pulse(id: string): void {
    this.flash = { id, n: ++this.flashN };
  }

  /** Blow one fuse with a programming pulse (an edit plus the animation cue). */
  blow(action: EditAction, fuseId: string): void {
    this.pulse(fuseId);
    this.edit(action);
  }

  /** Reset to a virgin device and program the source's design fuse by fuse, with pulses. */
  programAnimated(fuseId: (a: EditAction) => string, reduced = false, stepsOverride?: EditAction[]): void {
    const fit = this.fit;
    const steps = stepsOverride ?? fit?.programSteps;
    if (!fit?.edit || !steps) return;
    this.cancelProgramming();
    this.programming = true;
    const source = this.source;
    this.edit({ type: 'reset' });
    const total = steps.length;
    const period = reduced ? 0 : Math.max(18, Math.min(120, 2400 / Math.max(1, total)));
    let i = 0;
    const tick = () => {
      if (!this.programming) return;
      if (i >= total) {
        this.programming = false;
        this.handEdited = false;
        this.fittedSource = source;
        return;
      }
      const burst = period === 0 ? total : 1;
      for (let k = 0; k < burst && i < total; k++, i++) {
        const action = steps[i]!;
        this.pulse(fuseId(action));
        this.edit(action);
      }
      this.programTimer = setTimeout(tick, period);
    };
    tick();
  }

  cancelProgramming(): void {
    clearTimeout(this.programTimer);
    this.programming = false;
  }

  // ── Sharing ─────────────────────────────────────────────────────────────
  /** The hash that reopens this design in the Studio. */
  hash(views?: string[]): string {
    const example = this.exampleId ?? undefined;
    return encodeState({ device: this.deviceId, example, source: example ? undefined : this.source, views });
  }

  destroy(): void {
    clearTimeout(this.timer);
    clearTimeout(this.programTimer);
    clearInterval(this.clockTimer);
  }
}
