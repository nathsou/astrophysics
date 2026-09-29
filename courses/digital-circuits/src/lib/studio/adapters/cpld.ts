/**
 * The vCPLD-32 adapter: 4 function blocks of 8 macrocells around a global interconnect matrix.
 *
 * Source: equations in the fitter's text form (`Q.R = …`, `Y.E = …`) with `# @pins`, `# @buried`,
 * `# @ff`, `# @init`, `# @polarity`, `# @dc`, `# @title` pragmas. The fit is the 9,024-bit configuration;
 * the panes' data are recovered from those bits (`decodeConfig`) and the device runs from them (`VCpld32`).
 *
 * Term ids are physical: `f1t23` is product term 23 of function block 1 (macrocell 4, slot 3).
 */
import {
  BIT_COUNT,
  FB_INPUTS,
  IO_PINS,
  MACROCELLS,
  MACROCELLS_PER_FB,
  OE_GLOBAL,
  OE_OFF,
  OE_TERM,
  ROW_BITS,
  ROW_COUNT,
  TERMS_PER_FB,
  TERMS_PER_MC,
  USERCODE_OFFSET,
  arrayBit,
  bitsToHex,
  decodeConfig,
  describeBit,
  interconnectBit,
  mcBase,
  steerBit,
  termEnableBit,
  termOf,
  toFuseMap,
  usercodeText,
  ARRAY_OFFSET,
  ENABLE_OFFSET,
  FB_BITS,
  MC_OFFSET,
  RESERVED_OFFSET,
  USERCODE_BITS,
  type CpldConfig,
  type CpldFuseMap,
} from '../../pld/devices/vcpld32-arch';
import { VCpld32, type CpldSnapshot } from '../../pld/devices/vcpld32';
import { CpldFitError, designFromEquations, fitCpld, type CpldFit } from '../../pld/cpld';
import { matchesPattern, definitionLines, lintEquations, parsePragmas, locateError } from '../source';
import { makeResolver, type ProbeTermSpec } from '../probe';
import { outputEquation } from '../network';
import { EXAMPLES } from '../examples';
import { errorsFrom, plural } from './common';
import type { BitsModel, DeviceAdapter, DeviceFit, FileExport, Level, Lit, NetOutput, NetTerm, Network, PinLevel, ReportSection, RunState, Runner, SourceError } from '../types';

export const cpldTermId = (fb: number, t: number) => `f${fb}t${t}`;

export interface CpldChip {
  kind: 'cpld';
  bits: Uint8Array;
  cfg: CpldConfig;
  map: CpldFuseMap;
  /** The signal on each I/O pad: an input's name, the name of the output driving it, or ''. */
  ioNames: string[];
  ioRole: ('input' | 'output' | 'free')[];
  /** The output of each macrocell, or ''. */
  mcNames: string[];
  mcUse: ('output' | 'buried' | 'unused')[];
  fit: CpldFit | null;
  usercode: string;
  clock: string;
  /** Names of the inputs and where they are (for the pin list). */
  inputPins: Record<string, number>;
}

export type CpldDeviceFit = DeviceFit<CpldChip>;

const isGlobalOe = 'GOE';

interface Names {
  io(n: number): string;
  mc(n: number): string;
  source(s: number): string;
}

function namesOf(fit: CpldFit | null, cfg: CpldConfig): Names {
  const mcName = (m: number): string => fit?.outputs.find((o) => o.macrocell === m)?.name ?? `MC${m}`;
  const ioName = (n: number): string => {
    const inp = fit?.inputs.find((i) => i.pin === n);
    if (inp) return inp.name;
    const out = fit?.outputs.find((o) => o.macrocell === n && o.pin === n);
    if (out) return out.name;
    const m = cfg.fbs[n >> 3]!.macrocells[n & 7]!;
    if (!fit && m.oe !== OE_OFF) return mcName(n);
    return `IO${n}`;
  };
  return { io: ioName, mc: mcName, source: (s) => (s < IO_PINS ? ioName(s) : mcName(s - IO_PINS)) };
}

export function cpldNetwork(cfg: CpldConfig, names: Names, inputOrder: string[], clockName: string): Network {
  const terms: NetTerm[] = [];
  const seen = new Set<string>();
  const outputs: NetOutput[] = [];
  let anyRegistered = false;
  let usesGoe = false;
  const addTerm = (fb: number, t: number): string | undefined => {
    const term = cfg.fbs[fb]!.terms[t]!;
    if (term.kind === 'off' || term.kind === 'false') return undefined;
    const id = cpldTermId(fb, t);
    if (!seen.has(id)) {
      seen.add(id);
      const sources = cfg.fbs[fb]!.sources;
      terms.push({ id, kind: term.kind === 'true' ? 'true' : 'product', lits: term.literals.map((l): Lit => ({ signal: names.source(sources[l.input]!), neg: l.complement })) });
    }
    return id;
  };
  for (const f of cfg.fbs) {
    for (const m of f.macrocells) {
      const inUse = m.orTerms.length > 0 || m.registered || m.oe !== OE_OFF;
      if (!inUse) continue;
      const ids = m.orTerms.map((t) => addTerm(f.fb, t)).filter((x): x is string => !!x);
      let oe: string | undefined;
      if (m.oe === OE_TERM) oe = addTerm(f.fb, termOf(m.mc, TERMS_PER_MC - 1));
      else if (m.oe === OE_GLOBAL) {
        usesGoe = true;
        if (!seen.has(isGlobalOe)) {
          seen.add(isGlobalOe);
          terms.push({ id: isGlobalOe, kind: 'product', lits: [{ signal: isGlobalOe, neg: false }] });
        }
        oe = isGlobalOe;
      }
      if (m.registered) anyRegistered = true;
      outputs.push({
        name: names.mc(m.io),
        terms: ids,
        ff: m.registered ? (m.tff ? 'T' : 'D') : 'comb',
        invert: m.xor ? 'before' : 'none',
        oe,
        init: m.init,
        pin: m.oe !== OE_OFF ? m.io : undefined,
        pinLabel: m.oe !== OE_OFF ? `IO${m.io}` : 'buried',
      });
    }
  }
  const outNames = new Set(outputs.map((o) => o.name));
  const used = new Set<string>();
  for (const t of terms) for (const l of t.lits) used.add(l.signal);
  const ioOf = (n: string) => {
    const m = /^IO(\d+)$/.exec(n);
    return m ? Number(m[1]) : 99;
  };
  const inputs = [...used].filter((n) => !outNames.has(n) && n !== isGlobalOe).sort((a, b) => {
    const ia = inputOrder.indexOf(a);
    const ib = inputOrder.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    return ioOf(a) - ioOf(b) || a.localeCompare(b);
  });
  if (usesGoe) inputs.push(isGlobalOe);
  return { inputs, clock: anyRegistered ? clockName : undefined, terms, outputs };
}

function regionOf(i: number): number {
  if (i >= USERCODE_OFFSET) return i < USERCODE_OFFSET + USERCODE_BITS ? 4 : 5;
  const off = i % FB_BITS;
  if (off < ARRAY_OFFSET) return 0;
  if (off < ENABLE_OFFSET) return 1;
  if (off < MC_OFFSET) return 2;
  if (off < RESERVED_OFFSET) return 3;
  return 5;
}

function cpldBits(bits: Uint8Array): BitsModel {
  return {
    title: 'Configuration bits',
    count: BIT_COUNT,
    rows: ROW_COUNT,
    columns: ROW_BITS,
    index: (r, c) => r * ROW_BITS + c,
    cell: (i) => ({ row: Math.floor(i / ROW_BITS), col: i % ROW_BITS }),
    get: (i) => (bits[i] ? 1 : 0),
    lit: (i) => bits[i] === 1,
    region: regionOf,
    regions: [
      { name: 'Interconnect', note: 'input multiplexers' },
      { name: 'AND array' },
      { name: 'Term enables' },
      { name: 'Macrocells', note: 'flip-flop, XOR, output enable, term steering' },
      { name: 'USERCODE' },
      { name: 'Reserved' },
    ],
    rowLabel: (r) => (r >= ROW_COUNT - 1 ? 'USER' : `FB${Math.floor(r / 35)}·${String(r % 35).padStart(2, '0')}`),
    describe: (i) => `${describeBit(i).text}. Value ${bits[i] ? 1 : 0}.`,
    gapsAfter: [34, 69, 104, 139],
    litMeaning: '1',
    unlitMeaning: '0',
  };
}

function cpldRunner(chip: CpldChip, network: Network): Runner {
  const dev = new VCpld32(chip.bits);
  const inputs = network.inputs.slice();
  const ioOf = (n: string): number | undefined => {
    const fromFit = chip.inputPins[n];
    if (fromFit !== undefined) return fromFit;
    const m = /^IO(\d+)$/.exec(n);
    return m ? Number(m[1]) : undefined;
  };
  const hasClock = network.clock !== undefined;
  const outByName = new Map(network.outputs.map((o) => [o.name, o]));
  const macrocellOf = new Map<string, number>();
  for (let m = 0; m < MACROCELLS; m++) if (chip.mcNames[m]) macrocellOf.set(chip.mcNames[m]!, m);
  let clocks = 0;
  const args = (v: Record<string, number>) => {
    const pins: Level[] = new Array<Level>(IO_PINS).fill(0);
    for (const n of inputs) {
      const io = ioOf(n);
      if (io !== undefined && io < IO_PINS) pins[io] = v[n] ? 1 : 0;
    }
    return { pins, goe: v[isGlobalOe] ? 1 : 0 };
  };
  const state = (snap: CpldSnapshot, v: Record<string, number>): RunState => {
    const signals: Record<string, PinLevel> = {};
    for (const n of inputs) signals[n] = v[n] ? 1 : 0;
    for (const [name, o] of outByName) {
      const m = macrocellOf.get(name)!;
      signals[name] = o.pin === undefined || snap.driven[m] ? (snap.mc[m] as Level) : 'z';
    }
    const active = new Set<string>();
    for (const t of network.terms) {
      const mm = /^f(\d)t(\d+)$/.exec(t.id);
      if (mm && snap.terms[Number(mm[1]) * TERMS_PER_FB + Number(mm[2])]) active.add(t.id);
      if (t.id === isGlobalOe && snap.goe) active.add(t.id);
    }
    return { signals, activeTerms: active, stable: snap.stable, clocks, detail: snap };
  };
  return {
    inputs,
    hasClock,
    powerUp() {
      dev.powerCycle();
      clocks = 0;
      return state(dev.evaluate(args({})), {});
    },
    evaluate: (v) => state(dev.evaluate(args(v)), v),
    clock(v) {
      clocks++;
      return state(dev.clock(args(v)), v);
    },
  };
}

function cpldReport(chip: CpldChip, network: Network): ReportSection[] {
  const fit = chip.fit;
  const sections: ReportSection[] = [];
  if (fit) {
    const u = fit.utilisation;
    sections.push({
      title: 'Utilisation',
      rows: [
        { label: 'Macrocells', value: `${u.macrocells} of 32` },
        { label: 'Product terms', value: `${u.productTerms} of ${u.productTermCapacity}` },
        { label: 'I/O pins', value: `${u.pins} of 32`, note: 'a driven macrocell uses its pin; an input uses a pad' },
        { label: 'Borrowed terms', value: String(u.borrowedTerms), note: 'product terms steered to a neighbouring macrocell', level: u.borrowedTerms ? 'warn' : 'ok' },
        { label: 'Interconnect multiplexers', value: `${u.blockInputs} of ${u.blockInputCapacity}`, note: 'each function block sees at most 24 distinct signals' },
      ],
      meter: [
        { label: 'Macrocells', used: u.macrocells, of: 32 },
        { label: 'Product terms', used: u.productTerms, of: u.productTermCapacity },
        { label: 'I/O pins', used: u.pins, of: 32 },
        { label: 'Interconnect', used: u.blockInputs, of: u.blockInputCapacity },
      ],
    });
    sections.push({
      title: 'Function blocks',
      table: {
        head: ['FB', 'Macrocells', 'Terms', 'Inputs', 'Borrowed', 'Lent', 'Pins'],
        rows: fit.fbs.map((f) => [String(f.fb), `${f.macrocellsUsed}/8`, `${f.termsUsed}/40`, `${f.inputsUsed}/24`, String(f.borrowed), String(f.lent), `${f.pinsUsed}/8`]),
        mono: true,
      },
    });
    sections.push({
      title: 'Outputs',
      table: {
        head: ['Output', 'Pin', 'FB.MC', 'Kind', 'Polarity', 'Terms'],
        rows: fit.outputs.map((o) => [o.name, o.pin === null ? 'buried' : `IO${o.pin}`, `${o.fb}.${o.mc}`, o.registered ? `${o.ff} flip-flop` : 'combinational', o.polarity === 'low' ? 'active low' : 'active high', `${o.terms}${o.borrowed ? ` (+${o.borrowed} borrowed)` : ''}${o.lent ? ` (−${o.lent} lent)` : ''}`]),
        mono: true,
      },
    });
    const alts = fit.outputs.filter((o) => o.alternatives.length > 1);
    if (alts.length)
      sections.push({
        title: 'Fitter choices',
        table: { head: ['Output', 'Candidates (terms)'], rows: alts.map((o) => [o.name, o.alternatives.map((a) => `${a.label} ${a.terms}`).join(', ')]), mono: true },
      });
    sections.push({
      title: 'Partitioning',
      text: `Block inputs: ${fit.partition.initialInputs} after the greedy step, ${fit.partition.finalInputs} after ${plural(fit.partition.passes, 'Kernighan–Lin pass', 'Kernighan–Lin passes')} (${plural(fit.partition.moves, 'move')} kept).`,
    });
    const t = fit.timing;
    sections.push({
      title: 'Timing',
      text: t.statement,
      rows: [
        { label: 'Worst tPD', value: t.worstTpd ? `${t.worstTpd.toFixed(1)} ns` : 'n/a', note: 'pin to pin, combinational' },
        { label: 'Worst tSU', value: t.worstTsu ? `${t.worstTsu.toFixed(1)} ns` : 'n/a', note: 'set-up before the clock' },
        { label: 'tCO', value: t.worstTco ? `${t.worstTco.toFixed(1)} ns` : 'n/a', note: 'clock to output' },
        { label: 'fMAX', value: Number.isFinite(t.fmaxMHz) ? `${t.fmaxMHz.toFixed(0)} MHz` : 'n/a', note: 'register to register' },
      ],
    });
    if (fit.warnings.length) sections.push({ title: 'Warnings', rows: fit.warnings.map((w) => ({ label: '', value: w, level: 'warn' as const })) });
  } else {
    const ones = chip.bits.reduce((a, b) => a + b, 0);
    sections.push({
      title: 'Utilisation',
      rows: [
        { label: 'Macrocells in use', value: `${network.outputs.length} of 32` },
        { label: 'Product terms', value: `${network.terms.length}` },
        { label: 'Bits set', value: `${ones} of ${BIT_COUNT}` },
      ],
    });
  }
  return sections;
}

function build(fit: CpldFit | null, bits: Uint8Array, source: string): CpldDeviceFit {
  const cfg = decodeConfig(bits);
  const names = namesOf(fit, cfg);
  const inputOrder = (fit?.design.inputs ?? []).map((i) => (typeof i === 'string' ? i : i.name));
  const clockName = fit?.design.clock ?? 'GCLK';
  const network = cpldNetwork(cfg, names, inputOrder, clockName);
  const mcNames: string[] = new Array(MACROCELLS).fill('');
  const mcUse: CpldChip['mcUse'] = new Array(MACROCELLS).fill('unused');
  const ioNames: string[] = new Array(IO_PINS).fill('');
  const ioRole: CpldChip['ioRole'] = new Array(IO_PINS).fill('free');
  for (const f of cfg.fbs)
    for (const m of f.macrocells) {
      const inUse = m.orTerms.length > 0 || m.registered || m.oe !== OE_OFF;
      if (!inUse) continue;
      mcNames[m.io] = names.mc(m.io);
      mcUse[m.io] = m.oe !== OE_OFF ? 'output' : 'buried';
      if (m.oe !== OE_OFF) {
        ioNames[m.io] = mcNames[m.io]!;
        ioRole[m.io] = 'output';
      }
    }
  const inputPins: Record<string, number> = {};
  if (fit) for (const i of fit.inputs) inputPins[i.name] = i.pin;
  for (const n of network.inputs) {
    const m = /^IO(\d+)$/.exec(n);
    if (m && inputPins[n] === undefined) inputPins[n] = Number(m[1]);
  }
  for (const [n, io] of Object.entries(inputPins)) {
    if (network.inputs.includes(n) || fit?.inputs.some((i) => i.name === n)) {
      ioNames[io] = n;
      ioRole[io] = 'input';
    }
  }
  const chip: CpldChip = {
    kind: 'cpld',
    bits,
    cfg,
    map: toFuseMap(bits),
    ioNames,
    ioRole,
    mcNames,
    mcUse,
    fit,
    usercode: usercodeText(cfg.usercode),
    clock: clockName,
    inputPins,
  };

  // Cross-probing.
  const lines = definitionLines(source);
  const outNames = network.outputs.map((o) => o.name);
  const owner = (fb: number, t: number): string | undefined => {
    const term = cfg.fbs[fb]!.terms[t]!;
    const dest = term.isOe ? term.mc : term.destMc;
    return dest >= 0 ? mcNames[fb * MACROCELLS_PER_FB + dest] || undefined : undefined;
  };
  const specTerms: ProbeTermSpec[] = network.terms
    .filter((t) => t.id !== isGlobalOe)
    .map((t) => {
      const [, fbS, tS] = /^f(\d)t(\d+)$/.exec(t.id)!;
      const fb = Number(fbS);
      const tn = Number(tS);
      const term = cfg.fbs[fb]!.terms[tn]!;
      const array = Array.from({ length: FB_INPUTS * 2 }, (_, c) => arrayBit(fb, tn, c >> 1, (c & 1) === 1));
      const mux = [...new Set(term.literals.map((l) => l.input))].flatMap((k) => Array.from({ length: 6 }, (_, b) => interconnectBit(fb, k, b)));
      const o = owner(fb, tn);
      return {
        id: t.id,
        outputs: o ? [o] : [],
        bits: [...array, termEnableBit(fb, tn), steerBit(fb, term.mc, term.slot, 0), steerBit(fb, term.mc, term.slot, 1), ...mux],
        signals: t.lits.map((l) => l.signal),
      };
    });
  const outputBits: Record<string, number[]> = {};
  for (const o of network.outputs) {
    const m = mcNames.indexOf(o.name);
    outputBits[o.name] = m >= 0 ? Array.from({ length: 6 }, (_, b) => mcBase(m >> 3, m & 7) + b) : [];
  }
  const resolve = makeResolver({
    outputs: outNames,
    outputLine: Object.fromEntries(outNames.filter((n) => lines[n]).map((n) => [n, lines[n]!])),
    terms: specTerms,
    outputBits,
    bitOwner: (i) => {
      const info = describeBit(i);
      if (info.region === 'and-array' || info.region === 'term-enable') return { term: cpldTermId(info.fb, info.term) };
      if (info.region === 'macrocell') {
        if (info.field === 'steer') return { term: cpldTermId(info.fb, termOf(info.mc, info.slot!)) };
        return mcNames[info.io] ? { output: mcNames[info.io]! } : undefined;
      }
      return undefined;
    },
  });

  const files: FileExport[] = [
    { name: 'cpld-bits.json', mime: 'application/json', label: 'Configuration (JSON)', text: JSON.stringify({ device: 'vCPLD-32', bits: bitsToHex(bits), usercode: chip.usercode }, null, 2) },
  ];
  if (fit) files.push({ name: 'cpld-fit-report.txt', mime: 'text/plain', label: 'Fitter report', text: fit.report() + '\n' });
  const u = fit?.utilisation;
  return {
    adapter: 'cpld32',
    title: parsePragmas(source).title ?? fit?.design.title ?? 'vCPLD-32',
    summary: u ? `${u.macrocells} of 32 macrocells, ${u.productTerms} of ${u.productTermCapacity} product terms, ${u.borrowedTerms} borrowed` : `${network.outputs.length} macrocells in use`,
    network,
    bits: cpldBits(bits),
    chip,
    report: cpldReport(chip, network),
    equations: network.outputs.map((o) => outputEquation(network, o)),
    outputLine: Object.fromEntries(outNames.filter((n) => lines[n]).map((n) => [n, lines[n]!])),
    resolve,
    runner: () => cpldRunner(chip, network),
    files,
  };
}

export function programCpld(source: string): { fit: CpldDeviceFit; warnings: SourceError[] } | { errors: SourceError[] } {
  try {
    const lint = lintEquations(source);
    if (lint.length) return { errors: lint };
    const pr = parsePragmas(source);
    const design = designFromEquations(source, {
      inputs: pr.inputs,
      pins: pr.pins,
      buried: pr.buried,
      globalOe: pr.goe,
      ff: pr.ff,
      init: pr.init,
      polarity: Object.keys(pr.polarity).length ? pr.polarity : undefined,
      title: pr.title,
      usercode: pr.usercode,
      clock: pr.clock,
    });
    for (const d of pr.dc) for (const o of design.outputs) if (d.patterns.some((p) => matchesPattern(o.name, p))) o.dc = d.expr;
    const fit = fitCpld(design);
    return { fit: build(fit, fit.bits, source), warnings: fit.warnings.map((message) => ({ line: 0, message, severity: 'warning' as const })) };
  } catch (e) {
    if (e instanceof CpldFitError) return { errors: [locateError(source, e.message, e.info?.output ? { output: e.info.output } : undefined)] };
    return { errors: errorsFrom(e, source) };
  }
}

/** A vCPLD-32 straight from configuration bits (read back through JTAG, say), with generic names. */
export function cpldFromBits(bits: ArrayLike<number>, source = ''): CpldDeviceFit {
  if (bits.length !== BIT_COUNT) throw new Error(`A vCPLD-32 has ${BIT_COUNT} configuration bits`);
  return build(null, Uint8Array.from(bits), source);
}

export const cpldAdapter: DeviceAdapter = {
  id: 'cpld32',
  name: 'vCPLD-32',
  short: 'CPLD',
  blurb: 'Four PAL-like function blocks joined by a global interconnect matrix, with product-term steering, and a JTAG port that programs it.',
  language: 'Equations',
  syntax: [
    'Y = A & !B | C          a combinational output',
    'Q.R = !Q ^ EN           a registered output: the level after the next rising edge of the global clock',
    'Y.E = SEL               an output enable: one product term',
    'An output’s name on a right-hand side is its own feedback. Operators: ! & | ^ and parentheses.',
    '# @buried C1 C2   # @pins A=3 Y=17   # @ff Q0=T   # @init Q0=1   # @polarity Y=low   # @dc S* : Q3 & (Q2 | Q1)   # @title text',
  ],
  examples: EXAMPLES.cpld32,
  program(source) {
    const r = programCpld(source);
    return 'errors' in r ? { ok: false, errors: r.errors } : { ok: true, fit: r.fit, warnings: r.warnings };
  },
};
