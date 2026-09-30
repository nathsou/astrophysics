/**
 * The vPLA adapter: the 82S100-style field-programmable logic array, 8 inputs × 16 product terms × 8 outputs.
 *
 * Source: a truth table or equations; `# @polarity auto` lets the fitter invert outputs that need fewer
 * terms. The fit programs the AND plane (which literals each product term ANDs), the OR plane (which
 * terms each output ORs) and the polarity fuses. By hand: `edit({type:'toggle'})` flips one crossing.
 *
 * Fuse numbering (the bits view): the AND plane `(term × inputs + input) × 2 + (0 true | 1 complement)`,
 * then the OR plane `term × outputs + output`, then the polarity fuses. An intact AND fuse connects the
 * literal to the term; an intact OR fuse connects the term to the output; a blown polarity fuse inverts
 * the output.
 */
import { Pla, PlaError, fitPla, VPLA_SIZE, type PlaFit, type PlaTermInfo } from '../../pld/devices/pla';
import { functionFromEquations, parseTruthTable, type BoolFunction } from '../../pld/twolevel/expr';
import type { Polarity } from '../../pld/twolevel/minimise';
import { definitionLines, isTruthTable, lintEquations, parsePragmas } from '../source';
import { makeResolver, type ProbeTermSpec } from '../probe';
import { EXAMPLES } from '../examples';
import { errorsFrom } from './common';
import type { BitsModel, DeviceAdapter, DeviceFit, EditAction, Level, Lit, NetOutput, NetTerm, Network, ReportSection, RunState, Runner, SourceError } from '../types';

export interface PlaChip {
  kind: 'pla';
  pla: Pla;
  inputs: number;
  terms: number;
  outputs: number;
  /** Inputs and outputs the design uses (all of them for a blank device). */
  declaredInputs: number;
  declaredOutputs: number;
  inputNames: string[];
  outputNames: string[];
  info: PlaTermInfo[];
  /** Pulses that program a virgin device (for the animated programming). */
  ops: PlaFit['ops'];
}

export type PlaDeviceFit = DeviceFit<PlaChip>;

export const termId = (t: number) => `t${t}`;

interface Meta {
  declaredInputs: number;
  declaredOutputs: number;
  ops: PlaFit['ops'];
  cost?: PlaFit['cost'];
  polarity?: Polarity[];
}

function plaNetwork(pla: Pla, info: PlaTermInfo[], meta: Meta): Network {
  const inputNames = pla.inputNames.slice(0, meta.declaredInputs);
  const terms: NetTerm[] = [];
  for (const t of info) {
    if (t.kind === 'false') continue;
    terms.push({
      id: termId(t.index),
      kind: t.kind === 'true' ? 'true' : 'product',
      lits: [...t.pattern].flatMap((ch, i): Lit[] => (ch === '1' ? [{ signal: pla.inputNames[i]!, neg: false }] : ch === '0' ? [{ signal: pla.inputNames[i]!, neg: true }] : [])),
    });
  }
  const outputs: NetOutput[] = pla.outputNames.slice(0, meta.declaredOutputs).map((name, o) => ({
    name,
    terms: info.filter((t) => t.kind !== 'false' && t.outputs.includes(o)).map((t) => termId(t.index)),
    ff: 'comb' as const,
    invert: pla.polarityFuses[o] ? ('before' as const) : ('none' as const),
    pin: undefined,
  }));
  return { inputs: inputNames, terms, outputs };
}

function plaBits(pla: Pla, info: PlaTermInfo[]): BitsModel {
  const { inputs: I, terms: T, outputs: O } = pla.size;
  const A = T * I * 2;
  const ORB = A;
  const POL = A + T * O;
  const cols = 2 * I + O;
  const dead = (t: number) => info[t]!.kind === 'false';
  const fuseAt = (i: number): number => (i < A ? pla.andFuses[i]! : i < POL ? pla.orFuses[i - ORB]! : pla.polarityFuses[i - POL]!);
  return {
    title: 'Fuse map',
    count: pla.fuseCount,
    rows: T + 1,
    columns: cols,
    index: (r, c) => {
      if (r < T) return c < 2 * I ? r * 2 * I + c : ORB + r * O + (c - 2 * I);
      return r === T && c >= 2 * I ? POL + (c - 2 * I) : -1;
    },
    cell: (i) => {
      if (i < A) return { row: Math.floor(i / (2 * I)), col: i % (2 * I) };
      if (i < POL) {
        const k = i - ORB;
        return { row: Math.floor(k / O), col: 2 * I + (k % O) };
      }
      return { row: T, col: 2 * I + (i - POL) };
    },
    get: (i) => (fuseAt(i) ? 1 : 0),
    lit: (i) => (i < A ? !pla.andFuses[i] && !dead(Math.floor(i / (2 * I))) : i < POL ? !pla.orFuses[i - ORB] && !dead(Math.floor((i - ORB) / O)) : pla.polarityFuses[i - POL] === 1),
    region: (i) => (i < A ? 0 : i < POL ? 1 : 2),
    regions: [{ name: 'AND plane', note: 'true and complement fuse of each input' }, { name: 'OR plane' }, { name: 'Polarity' }],
    rowLabel: (r) => (r < T ? `T${r}` : 'inv'),
    describe: (i) => {
      if (i < A) {
        const t = Math.floor(i / (2 * I));
        const k = i % (2 * I);
        const inp = pla.inputNames[k >> 1]!;
        const lit = k & 1 ? `!${inp}` : inp;
        const blown = pla.andFuses[i] === 1;
        return `AND-plane fuse ${i}: product term ${t}, literal ${lit}. ${blown ? `Blown: ${lit} is not part of the term.` : `Intact: ${lit} is ANDed into the term.`}`;
      }
      if (i < POL) {
        const k = i - ORB;
        const t = Math.floor(k / O);
        const o = k % O;
        const blown = pla.orFuses[k] === 1;
        return `OR-plane fuse ${i}: term ${t} to output ${pla.outputNames[o]}. ${blown ? 'Blown: the term is not part of the output.' : 'Intact: the term is ORed into the output.'}`;
      }
      const o = i - POL;
      return `Polarity fuse ${i}: output ${pla.outputNames[o]}. ${pla.polarityFuses[o] ? 'Blown: the output is inverted (active low).' : 'Intact: the output is active high.'}`;
    },
    gapsAfter: [],
    litMeaning: 'connected',
    unlitMeaning: 'blown or unused',
  };
}

function plaRunner(pla: Pla, meta: Meta): Runner {
  const inputs = pla.inputNames.slice(0, meta.declaredInputs);
  const outputs = pla.outputNames.slice(0, meta.declaredOutputs);
  const info = pla.terms();
  const run = (v: Record<string, number>): RunState => {
    const levels = Array.from({ length: pla.size.inputs }, (_, i) => (i < inputs.length && v[inputs[i]!] ? 1 : 0));
    const tr = pla.trace(levels);
    const signals: RunState['signals'] = {};
    inputs.forEach((n, i) => (signals[n] = levels[i] as Level));
    outputs.forEach((n, o) => (signals[n] = tr.outputs[o]!));
    const active = new Set<string>();
    tr.terms.forEach((x, t) => x && info[t]!.kind !== 'false' && active.add(termId(t)));
    return { signals, activeTerms: active, stable: true, clocks: 0, detail: tr };
  };
  return { inputs, hasClock: false, powerUp: () => run({}), evaluate: run, clock: run };
}

function plaResolver(pla: Pla, info: PlaTermInfo[], source: string, meta: Meta) {
  const { inputs: I, terms: T, outputs: O } = pla.size;
  const A = T * I * 2;
  const POL = A + T * O;
  const outputs = pla.outputNames.slice(0, meta.declaredOutputs);
  const lines = definitionLines(source);
  const terms: ProbeTermSpec[] = info.map((t) => {
    const andRow = Array.from({ length: 2 * I }, (_, k) => t.index * 2 * I + k);
    const feeds = t.kind === 'false' ? [] : t.outputs.filter((o) => o < outputs.length).map((o) => outputs[o]!);
    const orCell = (o: number) => A + t.index * O + o;
    return {
      id: termId(t.index),
      outputs: feeds,
      bits: [...andRow, ...t.outputs.map(orCell)],
      bitsVia: (name: string) => [...andRow, orCell(pla.outputNames.indexOf(name))],
      signals: [...t.pattern].flatMap((ch, i) => (ch === '1' || ch === '0' ? [pla.inputNames[i]!] : [])),
    };
  });
  return makeResolver({
    outputs,
    outputLine: Object.fromEntries(outputs.filter((o) => lines[o]).map((o) => [o, lines[o]!])),
    terms,
    outputBits: Object.fromEntries(outputs.map((o) => [o, [POL + pla.outputNames.indexOf(o)]])),
    bitOwner: (i) => {
      if (i < A) return { term: termId(Math.floor(i / (2 * I))) };
      if (i < POL) return { term: termId(Math.floor((i - A) / O)) };
      return { output: pla.outputNames[i - POL] };
    },
  });
}

function plaReport(pla: Pla, info: PlaTermInfo[], meta: Meta): ReportSection[] {
  const used = info.filter((t) => t.kind !== 'false' && t.outputs.length > 0);
  const blown = pla.blownOps().length;
  const sections: ReportSection[] = [
    {
      title: 'Utilisation',
      rows: [
        { label: 'Product terms', value: `${used.length} of ${pla.size.terms}`, level: used.length === pla.size.terms ? 'warn' : 'ok' },
        { label: 'Inputs', value: `${meta.declaredInputs} of ${pla.size.inputs}` },
        { label: 'Outputs', value: `${meta.declaredOutputs} of ${pla.size.outputs}` },
        { label: 'Fuses blown', value: `${blown} of ${pla.fuseCount}`, note: `${meta.ops.length} programming pulses from a virgin device` },
        ...(meta.cost ? [{ label: 'Literals', value: String(meta.cost.literals), note: 'the number of connected AND-plane fuses, the classic cost of a PLA' }] : []),
      ],
      meter: [
        { label: 'Product terms', used: used.length, of: pla.size.terms },
        { label: 'Fuses blown', used: blown, of: pla.fuseCount },
      ],
    },
    {
      title: 'Product terms',
      table: {
        head: ['Term', 'AND plane', 'Feeds'],
        rows: used.map((t) => [`T${t.index}`, t.pattern, t.outputs.map((o) => pla.outputNames[o]).join(' ')]),
        mono: true,
      },
    },
    {
      title: 'Outputs',
      table: {
        head: ['Output', 'Polarity', 'Terms'],
        rows: pla.outputNames.slice(0, meta.declaredOutputs).map((n, o) => [n, pla.polarityFuses[o] ? 'active low (inverted)' : 'active high', String(info.filter((t) => t.kind !== 'false' && t.outputs.includes(o)).length)]),
        mono: true,
      },
    },
    {
      title: 'Timing',
      text: 'A PLA is combinational: each signal passes through the input buffers, the AND plane, the OR plane and the output stage, the same delay for every path. The vPLA does not model the delay.',
    },
  ];
  return sections;
}

export function plaFit(pla: Pla, source: string, meta: Meta, edited = false): PlaDeviceFit {
  const info = pla.terms();
  const network = plaNetwork(pla, info, meta);
  const chip: PlaChip = {
    kind: 'pla',
    pla,
    inputs: pla.size.inputs,
    terms: pla.size.terms,
    outputs: pla.size.outputs,
    declaredInputs: meta.declaredInputs,
    declaredOutputs: meta.declaredOutputs,
    inputNames: pla.inputNames,
    outputNames: pla.outputNames,
    info,
    ops: meta.ops,
  };
  const lines = definitionLines(source);
  const used = info.filter((t) => t.kind !== 'false' && t.outputs.length > 0).length;
  const fit: PlaDeviceFit = {
    adapter: 'pla',
    title: parsePragmas(source).title ?? 'PLA',
    summary: `${used} of ${pla.size.terms} product terms, ${meta.declaredOutputs} outputs`,
    network,
    bits: plaBits(pla, info),
    chip,
    report: plaReport(pla, info, meta),
    equations: network.outputs.map((o) => {
      const ts = o.terms.map((id) => network.terms.find((t) => t.id === id)!);
      const sum = ts.length ? ts.map((t) => (t.lits.length ? t.lits.map((l) => (l.neg ? `!${l.signal}` : l.signal)).join(' & ') : '1')).join(' | ') : '0';
      return `${o.name} = ${o.invert === 'none' ? sum : ts.length > 1 ? `!(${sum})` : `!${sum}`}`;
    }),
    outputLine: Object.fromEntries(network.outputs.filter((o) => lines[o.name]).map((o) => [o.name, lines[o.name]!])),
    resolve: plaResolver(pla, info, source, meta),
    runner: () => plaRunner(pla, meta),
    edited,
    programSteps: meta.ops.map((op): EditAction =>
      op.plane === 'and' ? { type: 'toggle', plane: 'and', term: op.term, input: op.input, literal: op.literal } : op.plane === 'or' ? { type: 'toggle', plane: 'or', term: op.term, output: op.output } : { type: 'toggle', plane: 'polarity', output: op.output },
    ),
    files: [{ name: 'pla-fuses.json', mime: 'application/json', label: 'Fuse map (JSON)', text: JSON.stringify({ ...pla.toFuseMap(), termInfo: undefined }, null, 2) }],
    edit: (action: EditAction) => {
      if (action.type === 'reset') return plaFit(new Pla(pla.size, { inputs: pla.inputNames, outputs: pla.outputNames }), source, { ...meta, ops: [] }, true);
      if (action.type !== 'toggle') return fit;
      const p = pla.clone();
      try {
        if (action.plane === 'and') {
          const k = p.andIndex(action.term!, action.input!, action.literal!);
          p.andFuses[k] = p.andFuses[k] ? 0 : 1;
        } else if (action.plane === 'or') {
          const k = p.orIndex(action.term!, action.output!);
          p.orFuses[k] = p.orFuses[k] ? 0 : 1;
        } else {
          p.polarityFuses[action.output!] = p.polarityFuses[action.output!] ? 0 : 1;
        }
      } catch (e) {
        if (e instanceof PlaError) return fit;
        throw e;
      }
      return plaFit(p, source, meta, true);
    },
  };
  return fit;
}

function functionOf(source: string): BoolFunction {
  const pr = parsePragmas(source);
  return isTruthTable(source) ? parseTruthTable(source) : functionFromEquations(source, pr.inputs);
}

export function programPla(source: string): { fit: PlaDeviceFit; warnings: SourceError[] } | { errors: SourceError[] } {
  try {
    if (!isTruthTable(source)) {
      const lint = lintEquations(source);
      if (lint.length) return { errors: lint };
    }
    const pr = parsePragmas(source);
    const f = functionOf(source);
    const per: Polarity[] | undefined = Object.keys(pr.polarity).length ? f.outputs.map((o) => (pr.polarity[o] === 'low' ? 'low' : 'high')) : undefined;
    const polarity: 'auto' | 'high' | Polarity[] = pr.polarityAll === 'auto' ? 'auto' : (per ?? 'high');
    const r = fitPla(f, { polarity });
    const meta: Meta = { declaredInputs: f.inputs.length, declaredOutputs: f.outputs.length, ops: r.ops, cost: r.cost, polarity: r.polarity };
    return { fit: plaFit(r.pla, source, meta), warnings: [] };
  } catch (e) {
    if (e instanceof PlaError) return { errors: [{ line: 0, message: e.message }] };
    return { errors: errorsFrom(e, source) };
  }
}

/** A virgin PLA whose inputs and outputs carry the given names (the rest keep their default names). */
export function blankPla(inputs: string[], outputs: string[]): PlaDeviceFit {
  const names = {
    inputs: [...inputs, ...Array.from({ length: VPLA_SIZE.inputs - inputs.length }, (_, i) => `I${inputs.length + i}`)],
    outputs: [...outputs, ...Array.from({ length: VPLA_SIZE.outputs - outputs.length }, (_, i) => `O${outputs.length + i}`)],
  };
  return plaFit(new Pla(VPLA_SIZE, names), '', { declaredInputs: inputs.length, declaredOutputs: outputs.length, ops: [] });
}

export const plaAdapter: DeviceAdapter = {
  id: 'pla',
  name: 'vPLA',
  short: 'PLA',
  blurb: 'A field-programmable logic array: a programmable AND plane feeds a programmable OR plane. Sixteen product terms are shared by all outputs.',
  language: 'A truth table or equations',
  syntax: [
    'Truth table: one row per line, inputs then outputs, separated by |; - is a don’t care. Or equations: Y = A & !B | C.',
    'The fitter minimises all outputs together and shares product terms between them.',
    '# @polarity auto lets it invert outputs that need fewer terms; # @polarity Y=low forces one.',
    'A vPLA has 8 inputs, 16 product terms and 8 outputs.',
  ],
  examples: EXAMPLES.pla,
  editable: true,
  program(source) {
    const r = programPla(source);
    return 'errors' in r ? { ok: false, errors: r.errors } : { ok: true, fit: r.fit, warnings: r.warnings };
  },
  blank() {
    const pla = new Pla(VPLA_SIZE);
    return plaFit(pla, '', { declaredInputs: VPLA_SIZE.inputs, declaredOutputs: VPLA_SIZE.outputs, ops: [] });
  },
};

