/**
 * The Device Studio's contracts.
 *
 * A **DeviceAdapter** knows one kind of programmable device: it turns source text into a **DeviceFit**
 * (a configured device), and a DeviceFit carries everything the panes need:
 *
 *   source ──program()──► DeviceFit ──► network()  the two-level logic recovered from the configuration bits
 *                                   ├─► bits       the raw fuse map / configuration bits, cell by cell
 *                                   ├─► chip       device-specific data for the chip view component
 *                                   ├─► report     the fitter's report
 *                                   ├─► resolve()  the cross-probing map (source item ↔ chip elements ↔ bits)
 *                                   └─► runner()   the device simulated from its bits (evaluate / clock)
 *
 * The chip view is a Svelte component registered next to the adapter (`registry.ts`); it receives
 * {@link ChipProps}. A future device (the vFPGA, a DCL front end) plugs in by implementing
 * DeviceAdapter and registering a chip component; the Studio itself never names a device.
 *
 * Cross-probing: the panes share one selection (a {@link Ref}). `DeviceFit.resolve(ref)` expands it to a
 * {@link Probe}: every output, product term, signal, configuration bit and source line related to it.
 * Views highlight what is in the probe; chip views map terms and outputs to their own geometry.
 */

export type Level = 0 | 1;
/** 'z': high impedance (an output whose enable is off). */
export type PinLevel = Level | 'z';

/** A selectable item. Term ids and output names are those of the fit's network. */
export type Ref =
  | { kind: 'output'; name: string }
  | { kind: 'term'; id: string }
  | { kind: 'signal'; name: string }
  | { kind: 'bit'; index: number }
  | { kind: 'line'; line: number };

export const refKey = (r: Ref | null | undefined): string => {
  if (!r) return '';
  switch (r.kind) {
    case 'output':
    case 'signal':
      return `${r.kind}:${r.name}`;
    case 'term':
      return `term:${r.id}`;
    case 'bit':
      return `bit:${r.index}`;
    case 'line':
      return `line:${r.line}`;
  }
};

export const sameRef = (a: Ref | null | undefined, b: Ref | null | undefined): boolean => refKey(a) === refKey(b);

/** Everything related to a selection, resolved by the device adapter. */
export interface Probe {
  outputs: ReadonlySet<string>;
  terms: ReadonlySet<string>;
  signals: ReadonlySet<string>;
  /** Configuration bits (fuse / bit indices in the fit's bits view numbering). */
  bits: ReadonlySet<number>;
  /** Source lines (1-based). */
  lines: ReadonlySet<number>;
}

export const EMPTY_PROBE: Probe = Object.freeze({
  outputs: new Set<string>(),
  terms: new Set<string>(),
  signals: new Set<string>(),
  bits: new Set<number>(),
  lines: new Set<number>(),
});

export const isEmptyProbe = (p: Probe): boolean =>
  p.outputs.size === 0 && p.terms.size === 0 && p.signals.size === 0 && p.bits.size === 0 && p.lines.size === 0;

// ---------------------------------------------------------------------------------------------
// The two-level network recovered from the configuration

export interface Lit {
  /** A signal name: an external input, or an output (feedback). */
  signal: string;
  neg: boolean;
}

export interface NetTerm {
  id: string;
  /** 'product': the literals; 'true': nothing connected (constant 1); 'false': contradictory or off (constant 0). */
  kind: 'product' | 'true' | 'false';
  lits: Lit[];
}

export interface NetOutput {
  name: string;
  /** Product terms feeding the OR gate, by term id. */
  terms: string[];
  /** 'comb', or a D or T flip-flop clocked by the (single) clock. */
  ff: 'comb' | 'D' | 'T';
  /**
   * Where the polarity inversion (active-low output) sits: before the flip-flop (CPLD's XOR bit, and
   * every combinational output) or after it (the GAL's macrocell inverts Q on the way out).
   */
  invert: 'none' | 'before' | 'after';
  /** Term id of a product-term output enable (tri-state); absent when the output is always driven. */
  oe?: string;
  /** The asynchronous reset applies to this flip-flop. */
  reset?: boolean;
  /** Power-up value of the flip-flop (default 0). */
  init?: Level;
  /** Pin number, or undefined for a buried output. */
  pin?: number;
  /** Label for the pin ("pin 19", "IO12"). */
  pinLabel?: string;
}

export interface Network {
  /** External inputs, in display order. */
  inputs: string[];
  /** Name of the clock signal, if any output is registered. */
  clock?: string;
  terms: NetTerm[];
  outputs: NetOutput[];
  /** Term id of the asynchronous reset of the registers. */
  ar?: string;
}

// ---------------------------------------------------------------------------------------------
// Bits view

export interface BitsModel {
  title: string;
  /** Number of configuration bits (JEDEC fuse count). */
  count: number;
  rows: number;
  columns: number;
  /** Bit index of a grid cell, or -1 for an empty cell. */
  index(row: number, col: number): number;
  /** The grid position of a bit. */
  cell(index: number): { row: number; col: number };
  /** The stored value of a bit. */
  get(index: number): 0 | 1;
  /** True when the bit is "set" in the sense that matters: a connected crossing, a blown fuse, a 1. */
  lit(index: number): boolean;
  /** Colour class of a bit, an index into `regions`. */
  region(index: number): number;
  regions: { name: string; note?: string }[];
  rowLabel(row: number): string;
  /** What the bit controls, for hovering. */
  describe(index: number): string;
  /** Rows after which a gap is drawn (groups of rows). */
  gapsAfter?: number[];
  /** What "lit" means, for the legend ("connected", "blown", "1"). */
  litMeaning: string;
  unlitMeaning: string;
}

// ---------------------------------------------------------------------------------------------
// Running the configured device

export interface RunState {
  /** Level of every named signal: inputs as applied, outputs as the device drives them. */
  signals: Record<string, PinLevel>;
  /** Product terms that are true right now, by term id. */
  activeTerms: ReadonlySet<string>;
  /** False if combinational feedback did not settle. */
  stable: boolean;
  /** Clock edges since power-up. */
  clocks: number;
  /** Device-specific detail for the chip view (the simulator's snapshot). */
  detail?: unknown;
}

export interface Runner {
  /** External input names, in display order. */
  readonly inputs: string[];
  readonly hasClock: boolean;
  /** Power-up: registers to their initial values. */
  powerUp(): RunState;
  /** Settle for these input levels (missing inputs read 0). */
  evaluate(inputs: Record<string, number>): RunState;
  /** A rising clock edge with the inputs held. */
  clock(inputs: Record<string, number>): RunState;
}

// ---------------------------------------------------------------------------------------------
// The report

export interface ReportSection {
  title: string;
  /** Key–value lines (utilisation, timing). */
  rows?: { label: string; value: string; note?: string; level?: 'ok' | 'warn' | 'bad' }[];
  /** A table: header row then rows. */
  table?: { head: string[]; rows: string[][]; mono?: boolean };
  /** Preformatted text (the fitter's own report). */
  text?: string;
  /** A bar to show utilisation. */
  meter?: { label: string; used: number; of: number }[];
}

// ---------------------------------------------------------------------------------------------
// Source

export interface SourceError {
  /** 1-based line, or 0 for "the whole design". */
  line: number;
  message: string;
  severity?: 'error' | 'warning';
}

export interface ExampleDesign {
  id: string;
  title: string;
  blurb: string;
  source: string;
}

export type ProgramResult = { ok: true; fit: DeviceFit; warnings: SourceError[] } | { ok: false; errors: SourceError[] };

// ---------------------------------------------------------------------------------------------
// By-hand editing (PROM, PLA)

export type EditAction =
  | { type: 'blow'; word: number; column: number }
  | { type: 'toggle'; plane: 'and' | 'or' | 'polarity'; term?: number; input?: number; literal?: 'true' | 'complement'; output?: number }
  | { type: 'reset' };

export interface FileExport {
  name: string;
  mime: string;
  text: string;
  label: string;
}

export interface PinInfo {
  id: string;
  label: string;
  role: string;
}

/** A configured device: the result of programming. Treat as immutable; `edit` returns a new one. */
export interface DeviceFit<Chip = unknown> {
  adapter: string;
  title: string;
  /** One-line summary for the status line ("14 of 16 product terms, 7 outputs"). */
  summary: string;
  network: Network;
  bits: BitsModel;
  chip: Chip;
  report: ReportSection[];
  /** The equations as recovered from the bits, one line per output (for the source pane's "as fitted" hint). */
  equations: string[];
  /** Source line (1-based) where each output is defined, when known. */
  outputLine: Record<string, number>;
  resolve(ref: Ref): Probe;
  runner(): Runner;
  /** Present when the device can be edited by hand (blow a fuse, toggle a crossing). */
  edit?(action: EditAction): DeviceFit<Chip>;
  /** The edits that program a virgin device (after `edit({type:'reset'})`) to this design, for the programming animation. */
  programSteps?: EditAction[];
  /** True when the configuration no longer matches the source it was fitted from. */
  edited?: boolean;
  files?: FileExport[];
}

export interface DeviceAdapter {
  id: string;
  name: string;
  /** Short name for tabs. */
  short: string;
  blurb: string;
  /** What the source pane accepts ("Equations or a truth table"). */
  language: string;
  /** Help text for the source pane. */
  syntax: string[];
  examples: ExampleDesign[];
  program(source: string): ProgramResult;
  /** A virgin, unprogrammed device for programming by hand (adapters without hand editing omit it). */
  blank?(): DeviceFit;
  /** Whether fuses can be edited by clicking. */
  editable?: boolean;
}

/** Props every chip view component takes. */
export interface ChipProps<Fit extends DeviceFit = DeviceFit> {
  fit: Fit;
  /** The selection. */
  probe: Probe;
  /** The transient hover highlight (lighter). */
  hover: Probe;
  run: RunState | null;
  onselect?: (ref: Ref | null) => void;
  onhover?: (ref: Ref | null) => void;
  onedit?: (action: EditAction) => void;
  /** A programming pulse to animate at a fuse: `id` names the fuse, `n` changes for every pulse. */
  flash?: { id: string; n: number } | null;
  /** Fuses can be edited by clicking. */
  editable?: boolean;
  /** A compact figure inside a chapter. */
  compact?: boolean;
  /** Name shown on the package. */
  title?: string;
}
