/**
 * The GAL22V10 adapter: the faithful model, fitted from equations.
 *
 * Source: equations in the fitter's text form (`Q.R = …` registered, `Y.E = …` output enable, `AR`, `SP`),
 * with `# @pins`, `# @polarity`, `# @clock`, `# @dc` and `# @title` pragmas. The fit is the 5,892-fuse JEDEC
 * map; everything else the panes show is recovered from those fuses (`decodeGal22v10`), and the device
 * runs from them (`Gal22v10`).
 *
 * Term ids are array rows: `r12` is row 12 of the AND array.
 */
import {
  AR_ROW,
  ARRAY_FUSES,
  COLUMNS,
  FUSE_COUNT,
  OLMC_PINS,
  ROWS,
  SP_ROW,
  Gal22v10,
  decodeGal22v10,
  describeFuse,
  isOlmcPin,
  olmcRows,
  rowInfo,
  s0Fuse,
  s1Fuse,
  type GalConfig,
  type GalProductTerm,
  type GalSnapshot,
  type PinLevels,
} from '../../pld/devices/gal22v10';
import { GalFitError, designFromEquations, fitGal22v10, type GalFit } from '../../pld/devices/gal22v10-fit';
import { matchesPattern, definitionLines, lintEquations, parsePragmas, locateError } from '../source';
import { makeResolver, type ProbeTermSpec } from '../probe';
import { outputEquation } from '../network';
import { EXAMPLES } from '../examples';
import { errorsFrom } from './common';
import type { BitsModel, DeviceAdapter, DeviceFit, FileExport, Level, Lit, NetOutput, NetTerm, Network, PinLevel, ReportSection, RunState, Runner, SourceError } from '../types';

export const galTermId = (row: number) => `r${row}`;

export interface GalPinView {
  pin: number;
  name: string;
  role: 'input' | 'clock' | 'output' | 'gnd' | 'vcc' | 'nc' | 'input-olmc';
}

export interface GalOlmcView {
  pin: number;
  index: number;
  /** The output's name, or '' when the macrocell drives nothing. */
  name: string;
  /** How the pin is used: an output, an input (enable off, read by the array) or unused. */
  use: 'output' | 'input' | 'unused';
  registered: boolean;
  activeHigh: boolean;
  oeKind: 'always' | 'term' | 'never';
  oeRow: number;
  firstTermRow: number;
  termCount: number;
  /** Rows in use (product or true terms). */
  termsUsed: number;
}

export interface GalChip {
  kind: 'gal';
  fuses: Uint8Array;
  cfg: GalConfig;
  pins: GalPinView[];
  olmcs: GalOlmcView[];
  /** Per row: the term id if the row is live, else undefined. */
  rowTerm: (string | undefined)[];
  /** Per row: the output that owns the row (product and OE rows; AR and SP: undefined). */
  rowOutput: (string | undefined)[];
  /** Per row: all-zero (both forms of every signal connected) or otherwise constant false. */
  rowDead: boolean[];
  signature: string;
  fit: GalFit | null;
  pinOf: Record<string, number>;
  /** Name of the clock signal on pin 1. */
  clock: string;
  /** Number of live connected crossings in the array. */
  connected: number;
}

export type GalDeviceFit = DeviceFit<GalChip>;

const flips = (cfg: GalConfig, pin: number): boolean => {
  if (!isOlmcPin(pin)) return false;
  const o = cfg.olmcs.find((x) => x.pin === pin)!;
  return o.registered && o.activeHigh;
};

/** The text of a fuse for hovering: `describeFuse` in words, with the pin names of the fit. */
export function galFuseText(chip: GalChip, fuse: number): string {
  const info = describeFuse(fuse);
  const v = chip.fuses[fuse]!;
  const nm = (pin: number) => chip.pins[pin - 1]?.name || `pin ${pin}`;
  if (info.kind === 'array') {
    const who = info.rowKind === 'AR' ? 'the asynchronous reset term (AR)' : info.rowKind === 'SP' ? 'the synchronous preset term (SP)' : info.rowKind === 'OE' ? `the output-enable term of pin ${info.olmcPin} (${nm(info.olmcPin!)})` : `product term ${info.term} of pin ${info.olmcPin} (${nm(info.olmcPin!)})`;
    const sig = nm(info.inputPin);
    const lit = info.complement ? `${sig} complemented` : sig;
    return `Fuse ${fuse} · row ${info.row} · column ${info.column}: ${lit}, an input of ${who}. ${v ? 'Value 1: not connected.' : 'Value 0: connected, so the literal is ANDed into the term.'}`;
  }
  if (info.kind === 'S0') return `Fuse ${fuse} · S0 of pin ${info.pin} (${nm(info.pin)}): ${v ? '1 = active high' : '0 = active low (the macrocell inverts)'}.`;
  if (info.kind === 'S1') return `Fuse ${fuse} · S1 of pin ${info.pin} (${nm(info.pin)}): ${v ? '1 = combinational' : '0 = registered (D flip-flop)'}.`;
  if (info.kind === 'signature') return `Fuse ${fuse} · user signature, byte ${info.byte} bit ${info.bit}: ${v}.`;
  return `Fuse ${fuse}: ${v}.`;
}

function galBits(chip: GalChip): BitsModel {
  const rows = Math.ceil(FUSE_COUNT / COLUMNS);
  const fuses = chip.fuses;
  const groupOf = new Map<number, number>();
  OLMC_PINS.forEach((pin, k) => {
    const r = olmcRows(pin);
    for (let row = r.oeRow; row < r.oeRow + r.terms + 1; row++) groupOf.set(row, k);
  });
  const gaps: number[] = [AR_ROW];
  for (const pin of OLMC_PINS) {
    const r = olmcRows(pin);
    gaps.push(r.oeRow + r.terms);
  }
  gaps.push(SP_ROW);
  const rowName = (row: number): string => {
    if (row >= ROWS) return row === ROWS ? 'S0/S1' : 'sig';
    const info = rowInfo(row);
    if (info.kind === 'AR') return 'AR';
    if (info.kind === 'SP') return 'SP';
    const n = chip.pins[info.pin! - 1]?.name || String(info.pin);
    return info.kind === 'OE' ? `${n}.E` : `${n}.${info.term}`;
  };
  return {
    title: 'JEDEC fuse map',
    count: FUSE_COUNT,
    rows,
    columns: COLUMNS,
    index: (r, c) => (r * COLUMNS + c < FUSE_COUNT ? r * COLUMNS + c : -1),
    cell: (i) => ({ row: Math.floor(i / COLUMNS), col: i % COLUMNS }),
    get: (i) => (fuses[i] ? 1 : 0),
    lit: (i) => {
      if (i < ARRAY_FUSES) return fuses[i] === 0 && !chip.rowDead[Math.floor(i / COLUMNS)];
      return fuses[i] === 1;
    },
    region: (i) => {
      if (i >= ARRAY_FUSES + 20) return 5;
      if (i >= ARRAY_FUSES) return 4;
      const row = Math.floor(i / COLUMNS);
      if (row === AR_ROW || row === SP_ROW) return 3;
      const info = rowInfo(row);
      return info.kind === 'OE' ? 2 : (groupOf.get(row) ?? 0) % 2;
    },
    regions: [{ name: 'Product terms', note: 'even macrocells' }, { name: 'Product terms', note: 'odd macrocells' }, { name: 'Output enable' }, { name: 'AR and SP' }, { name: 'Macrocell S0 / S1' }, { name: 'Signature' }],
    rowLabel: rowName,
    describe: (i) => galFuseText(chip, i),
    gapsAfter: gaps,
    litMeaning: 'connected (0)',
    unlitMeaning: 'not connected (1)',
  };
}

function galRunner(chip: GalChip, network: Network): Runner {
  const dev = new Gal22v10(chip.fuses);
  const pinByName = new Map<string, number>();
  for (const p of chip.pins) if (p.name && p.role !== 'nc' && p.role !== 'gnd' && p.role !== 'vcc') pinByName.set(p.name, p.pin);
  const inputs = network.inputs.slice();
  const hasClock = network.clock !== undefined;
  const outNames = network.outputs.map((o) => o.name);
  let clocks = 0;
  const levelsOf = (v: Record<string, number>): PinLevels => {
    const l: PinLevels = {};
    for (const n of inputs) {
      const pin = pinByName.get(n);
      if (pin !== undefined) l[pin] = v[n] ? 1 : 0;
    }
    return l;
  };
  const state = (snap: GalSnapshot, v: Record<string, number>): RunState => {
    const signals: Record<string, PinLevel> = {};
    for (const n of inputs) signals[n] = v[n] ? 1 : 0;
    for (const name of outNames) {
      const pin = pinByName.get(name)!;
      signals[name] = snap.driven[pin] ? (snap.pins[pin] as Level) : 'z';
    }
    const active = new Set<string>();
    for (const t of network.terms) if (snap.rows[Number(t.id.slice(1))]) active.add(t.id);
    return { signals, activeTerms: active, stable: snap.stable, clocks, detail: snap };
  };
  return {
    inputs,
    hasClock,
    powerUp() {
      dev.powerUp();
      clocks = 0;
      return state(dev.evaluate({}), {});
    },
    evaluate: (v) => state(dev.evaluate(levelsOf(v)), v),
    clock(v) {
      clocks++;
      return state(dev.clock(levelsOf(v)), v);
    },
  };
}

export function galNetwork(cfg: GalConfig, pins: GalPinView[], inputOrder: string[] = []): Network {
  const nm = (pin: number) => pins[pin - 1]?.name || `P${pin}`;
  const litOf = (l: { pin: number; complement: boolean }): Lit => ({ signal: nm(l.pin), neg: l.complement !== flips(cfg, l.pin) });
  const terms: NetTerm[] = [];
  const seen = new Set<string>();
  const addTerm = (t: GalProductTerm): string => {
    const id = galTermId(t.row);
    if (!seen.has(id)) {
      seen.add(id);
      terms.push({ id, kind: t.kind, lits: t.literals.map(litOf) });
    }
    return id;
  };
  const anyRegistered = cfg.olmcs.some((o) => o.registered && o.oe.kind !== 'false');
  const spOn = cfg.sp.kind !== 'false';
  const arOn = cfg.ar.kind !== 'false' && anyRegistered;
  const outputs: NetOutput[] = [];
  for (const o of cfg.olmcs) {
    if (o.oe.kind === 'false') continue;
    const ids = o.terms.filter((t) => t.kind !== 'false').map(addTerm);
    if (o.registered && spOn) ids.push(addTerm(cfg.sp));
    outputs.push({
      name: nm(o.pin),
      terms: ids,
      ff: o.registered ? 'D' : 'comb',
      invert: o.activeHigh ? 'none' : o.registered ? 'after' : 'before',
      oe: o.oe.kind === 'product' ? addTerm(o.oe) : undefined,
      reset: o.registered && arOn,
      pin: o.pin,
      pinLabel: `pin ${o.pin}`,
    });
  }
  const ar = arOn ? addTerm(cfg.ar) : undefined;
  const outNames = new Set(outputs.map((o) => o.name));
  const used = new Set<string>();
  for (const t of terms) for (const l of t.lits) used.add(l.signal);
  const pinOfName = new Map(pins.map((p) => [p.name, p.pin]));
  const inputs = [...used].filter((n) => !outNames.has(n)).sort((a, b) => {
    const ia = inputOrder.indexOf(a);
    const ib = inputOrder.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    return (pinOfName.get(a) ?? 99) - (pinOfName.get(b) ?? 99);
  });
  return { inputs, clock: anyRegistered ? nm(1) : undefined, terms, outputs, ar };
}

function galReport(chip: GalChip, network: Network): ReportSection[] {
  const fit = chip.fit;
  const used = chip.olmcs.filter((o) => o.use === 'output');
  const termsUsed = used.reduce((a, o) => a + o.termsUsed, 0);
  const oeTerms = used.filter((o) => o.oeKind === 'term').length;
  const sections: ReportSection[] = [
    {
      title: 'Utilisation',
      rows: [
        { label: 'Output macrocells', value: `${used.length} of 10`, level: used.length === 10 ? 'warn' : 'ok' },
        { label: 'Product terms', value: `${termsUsed} of 130`, note: `${oeTerms} more in output-enable rows` },
        { label: 'Inputs', value: `${network.inputs.length}`, note: `${chip.olmcs.filter((o) => o.use === 'input').length} of them on macrocell pins` },
        { label: 'Registered', value: `${used.filter((o) => o.registered).length} outputs` },
        { label: 'Fuses connected', value: `${chip.connected} of ${ARRAY_FUSES}`, note: 'live crossings in the AND array' },
        { label: 'Signature', value: JSON.stringify(chip.signature) },
      ],
      meter: [
        { label: 'Macrocells', used: used.length, of: 10 },
        { label: 'Product terms', used: termsUsed, of: 130 },
      ],
    },
    {
      title: 'Outputs',
      table: {
        head: ['Output', 'Pin', 'Kind', 'Polarity', 'Terms'],
        rows: [...used]
          .sort((a, b) => b.pin - a.pin)
          .map((o) => [o.name, String(o.pin), o.registered ? 'registered' : 'combinational', o.activeHigh ? 'active high' : 'active low', `${o.termsUsed}/${o.termCount}${o.oeKind === 'term' ? ' + OE' : ''}`]),
        mono: true,
      },
    },
  ];
  if (fit) {
    const alt = fit.outputs.filter((o) => o.highTerms !== o.terms);
    if (alt.length)
      sections.push({
        title: 'Polarity choices',
        rows: alt.map((o) => ({ label: o.name, value: `${o.terms} terms`, note: `active ${o.polarity}; the other polarity would need ${o.polarity === 'high' ? o.lowTerms : o.highTerms}` })),
      });
    sections.push({
      title: 'Pinout',
      table: { head: ['Pin', 'Role', 'Name'], rows: fit.pins.map((p) => [String(p.pin), p.role, p.name]), mono: true },
    });
  }
  sections.push({
    title: 'Timing',
    text: 'The GAL22V10 has one propagation delay for every path from a pin, through the array and a macrocell, to a pin (tPD), and a set-up and clock-to-output time for registered paths. The vGAL does not model delays: the speed grade of the part you buy sets them (a GAL22V10-15 guarantees tPD of at most 15 ns).',
  });
  return sections;
}

function build(fit: GalFit | null, fuses: Uint8Array, source: string): GalDeviceFit {
  const cfg = decodeGal22v10(fuses);
  const pins: GalPinView[] = Array.from({ length: 24 }, (_, i) => {
    const p = fit?.pins[i];
    return { pin: i + 1, name: p && p.role !== 'nc' ? p.name : p?.role === 'nc' ? '' : '', role: (p?.role ?? 'nc') as GalPinView['role'] };
  });
  if (!fit)
    for (const p of pins) {
      p.name = `P${p.pin}`;
      p.role = (p.pin >= 14 && p.pin <= 23 ? 'output' : 'input') as GalPinView['role'];
    }
  const gnd = pins[11]!;
  gnd.name = 'GND';
  gnd.role = 'gnd';
  const vcc = pins[23]!;
  vcc.name = 'VCC';
  vcc.role = 'vcc';
  const inputOrder = (fit?.design.inputs ?? []).map((i) => (typeof i === 'string' ? i : i.name));
  const network = galNetwork(cfg, pins, inputOrder);
  if (fit) {
    const order = fit.design.outputs.map((o) => o.name);
    network.outputs.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  }
  // Pins used as signals without a name (hand-made fuse maps): give them generic names in the view.
  const olmcs: GalOlmcView[] = cfg.olmcs.map((o) => {
    const r = olmcRows(o.pin);
    const driven = o.oe.kind !== 'false';
    const isInput = !driven && network.terms.some((t) => t.lits.some((l) => l.signal === pins[o.pin - 1]!.name));
    return {
      pin: o.pin,
      index: o.index,
      name: driven ? pins[o.pin - 1]!.name || `P${o.pin}` : '',
      use: driven ? 'output' : isInput ? 'input' : 'unused',
      registered: o.registered,
      activeHigh: o.activeHigh,
      oeKind: o.oe.kind === 'false' ? 'never' : o.oe.kind === 'true' ? 'always' : 'term',
      oeRow: r.oeRow,
      firstTermRow: r.firstTermRow,
      termCount: r.terms,
      termsUsed: o.terms.filter((t) => t.kind !== 'false').length,
    };
  });
  const rowTerm: (string | undefined)[] = new Array(ROWS).fill(undefined);
  const rowOutput: (string | undefined)[] = new Array(ROWS).fill(undefined);
  const rowDead: boolean[] = new Array(ROWS).fill(true);
  const mark = (t: GalProductTerm, out?: string) => {
    rowDead[t.row] = t.kind === 'false';
    if (t.kind !== 'false') rowTerm[t.row] = galTermId(t.row);
    rowOutput[t.row] = out;
  };
  mark(cfg.ar);
  mark(cfg.sp);
  for (const o of cfg.olmcs) {
    const name = o.oe.kind === 'false' ? undefined : pins[o.pin - 1]!.name || `P${o.pin}`;
    mark(o.oe, name);
    for (const t of o.terms) mark(t, name);
  }
  let connected = 0;
  for (let r = 0; r < ROWS; r++) if (!rowDead[r]) for (let c = 0; c < COLUMNS; c++) if (fuses[r * COLUMNS + c] === 0) connected++;
  const chip: GalChip = {
    kind: 'gal',
    fuses,
    cfg,
    pins,
    olmcs,
    rowTerm,
    rowOutput,
    rowDead,
    signature: fit?.signature ?? new TextDecoder().decode(cfg.signature).replace(/\0+$/, ''),
    fit,
    pinOf: Object.fromEntries(pins.filter((p) => p.name && p.role !== 'nc').map((p) => [p.name, p.pin])),
    clock: pins[0]!.name || 'CLK',
    connected,
  };
  const lines = definitionLines(source);
  // Probe: rows are terms; AR and SP feed every registered output.
  const registeredOutputs = network.outputs.filter((o) => o.ff !== 'comb').map((o) => o.name);
  const terms: ProbeTermSpec[] = network.terms.map((t) => {
    const row = Number(t.id.slice(1));
    const owner = rowOutput[row];
    const bits = Array.from({ length: COLUMNS }, (_, c) => row * COLUMNS + c);
    return { id: t.id, outputs: row === AR_ROW || row === SP_ROW ? registeredOutputs : owner ? [owner] : [], bits, signals: t.lits.map((l) => l.signal) };
  });
  const outputBits: Record<string, number[]> = {};
  for (const o of network.outputs) outputBits[o.name] = [s0Fuse(o.pin!), s1Fuse(o.pin!)];
  const resolve = makeResolver({
    outputs: network.outputs.map((o) => o.name),
    outputLine: Object.fromEntries(network.outputs.filter((o) => lines[o.name]).map((o) => [o.name, lines[o.name]!])),
    terms,
    outputBits,
    bitOwner: (i) => {
      if (i < ARRAY_FUSES) {
        const row = Math.floor(i / COLUMNS);
        if (rowTerm[row]) return { term: rowTerm[row] };
        return rowOutput[row] ? { output: rowOutput[row] } : undefined;
      }
      const k = i - ARRAY_FUSES;
      if (k < 20) {
        const pin = 23 - (k >> 1);
        const name = pins[pin - 1]!.name;
        return name ? { output: name } : undefined;
      }
      return undefined;
    },
  });
  const files: FileExport[] = [];
  if (fit) {
    files.push({ name: 'design.jed', mime: 'text/plain', label: 'JEDEC file', text: fit.jedec() });
    files.push({ name: 'design.pld', mime: 'text/plain', label: 'galette .pld', text: safePld(fit) });
  }
  const outputsUsed = olmcs.filter((o) => o.use === 'output').length;
  const termsUsed = olmcs.reduce((a, o) => a + (o.use === 'output' ? o.termsUsed : 0), 0);
  const result: GalDeviceFit = {
    adapter: 'gal22v10',
    title: parsePragmas(source).title ?? fit?.design.title ?? 'GAL22V10',
    summary: `${outputsUsed} of 10 macrocells, ${termsUsed} of 130 product terms, ${connected} fuses connected`,
    network,
    bits: galBits(chip),
    chip,
    report: galReport(chip, network),
    equations: network.outputs.map((o) => outputEquation(network, o)),
    outputLine: Object.fromEntries(network.outputs.filter((o) => lines[o.name]).map((o) => [o.name, lines[o.name]!])),
    resolve,
    runner: () => galRunner(chip, network),
    files,
  };
  return result;
}

function safePld(fit: GalFit): string {
  try {
    return fit.pld();
  } catch (e) {
    return `; ${e instanceof Error ? e.message : String(e)}\n`;
  }
}

export function programGal(source: string): { fit: GalDeviceFit; warnings: SourceError[] } | { errors: SourceError[] } {
  try {
    const lint = lintEquations(source);
    if (lint.length) return { errors: lint };
    const pr = parsePragmas(source);
    const design = designFromEquations(source, {
      inputs: pr.inputs,
      pins: pr.pins,
      clock: pr.clock,
      signature: pr.signature,
      title: pr.title,
      polarity: Object.keys(pr.polarity).length ? pr.polarity : undefined,
    });
    for (const d of pr.dc) for (const o of design.outputs) if (d.patterns.some((p) => matchesPattern(o.name, p))) o.dc = d.expr;
    const fit = fitGal22v10(design);
    return { fit: build(fit, fit.fuses, source), warnings: [] };
  } catch (e) {
    if (e instanceof GalFitError) return { errors: [locateError(source, e.message, e.info?.output ? { output: e.info.output } : undefined)] };
    return { errors: errorsFrom(e, source) };
  }
}

/** A GAL22V10 straight from a fuse array (a JEDEC file the reader loaded), with generic pin names. */
export function galFromFuses(fuses: ArrayLike<number>, source = ''): GalDeviceFit {
  if (fuses.length !== FUSE_COUNT) throw new Error(`A GAL22V10 has ${FUSE_COUNT} fuses`);
  return build(null, Uint8Array.from(fuses), source);
}

export const galAdapter: DeviceAdapter = {
  id: 'gal22v10',
  name: 'GAL22V10',
  short: 'GAL22V10',
  blurb: 'The Lattice GAL22V10, modelled fuse for fuse: 12 inputs, 10 output macrocells with 8 to 16 product terms each, and a JEDEC file that programs a real part.',
  language: 'Equations',
  syntax: [
    'Y = A & !B | C          a combinational output (the level on pin Y)',
    'Q.R = !Q ^ EN           a registered output: the level after the next clock edge (pin 1 is the clock)',
    'Y.E = OE                an output enable: one product term',
    'AR = RESET   SP = SET   asynchronous reset and synchronous preset of every register: one product term each',
    'Operators: ! / ~ not, & * and, | + # or, ^ xor, parentheses. Comments start with // or ;',
    '# @pins A=2 Y=19   # @polarity Y=low   # @clock CLK   # @dc S* : D & (C | B)   # @title text',
  ],
  examples: EXAMPLES.gal22v10,
  program(source) {
    const r = programGal(source);
    return 'errors' in r ? { ok: false, errors: r.errors } : { ok: true, fit: r.fit, warnings: r.warnings };
  },
};

