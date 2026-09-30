/**
 * The vPROM adapter: a fuse PROM sized to the design (N address lines × M data outputs, N ≤ 6).
 *
 * Source: a truth table (`D C B A | a b c d e f g`, one row per line, `-` for don't care) or equations
 * (`a = …`). The programmed device is the fuse matrix: one row per address (the decoder's word line),
 * one column per output, and a blown fuse reads 1. The logic view recovered from the bits is the ROM's
 * own structure: a minterm AND gate per word and an OR per output.
 *
 * By hand: `edit({type:'blow'})` blows one fuse; a blown fuse cannot be restored.
 */
import { Prom, PromError, wordsOf, type PromBlowOp } from '../../pld/devices/prom';
import { functionFromEquations, parseTruthTable, type BoolFunction } from '../../pld/twolevel/expr';
import { definitionLines, isTruthTable, lintEquations, parsePragmas } from '../source';
import { makeResolver } from '../probe';
import { EXAMPLES } from '../examples';
import { bin, errorsFrom, plural } from './common';
import type {
  BitsModel,
  DeviceAdapter,
  DeviceFit,
  EditAction,
  Level,
  Network,
  NetOutput,
  NetTerm,
  ReportSection,
  RunState,
  Runner,
  SourceError,
} from '../types';

export const PROM_MAX_ADDRESS = 6;
export const PROM_MAX_WIDTH = 16;

export interface PromChip {
  kind: 'prom';
  prom: Prom;
  words: number;
  width: number;
  addressBits: number;
  /** Address input names, most significant first. */
  inputs: string[];
  /** Output names by column (column 0 is the most significant bit). */
  outputs: string[];
  /** The pulses that program a virgin device to the source's function. */
  ops: PromBlowOp[];
  /** Words the source asks for (for "differs from the source"). */
  target: number[] | null;
}

export type PromFit = DeviceFit<PromChip>;

const wordTerm = (w: number) => `w${w}`;

function functionOf(source: string): { f: BoolFunction; error?: never } {
  const pr = parsePragmas(source);
  const f = isTruthTable(source) ? parseTruthTable(source) : functionFromEquations(source, pr.inputs);
  return { f };
}

export function promNetwork(prom: Prom): Network {
  const terms: NetTerm[] = [];
  const outputs: NetOutput[] = prom.outputs.map((name) => ({ name, terms: [], ff: 'comb' as const, invert: 'none' as const }));
  for (let w = 0; w < prom.words; w++) {
    const ones: number[] = [];
    for (let c = 0; c < prom.width; c++) if (prom.bitValue(w, c) === 1) ones.push(c);
    if (!ones.length) continue;
    const id = wordTerm(w);
    terms.push({
      id,
      kind: 'product',
      lits: prom.inputs.map((signal, i) => ({ signal, neg: ((w >> (prom.addressBits - 1 - i)) & 1) === 0 })),
    });
    for (const c of ones) outputs[c]!.terms.push(id);
  }
  return { inputs: prom.inputs.slice(), terms, outputs };
}

function promBits(prom: Prom): BitsModel {
  const { words, width } = prom;
  const A = prom.addressBits;
  return {
    title: 'Fuse map',
    count: words * width,
    rows: words,
    columns: width,
    index: (r, c) => (r < words && c < width ? r * width + c : -1),
    cell: (i) => ({ row: Math.floor(i / width), col: i % width }),
    get: (i) => (prom.fuses[i] ? 1 : 0),
    lit: (i) => prom.fuses[i] === 1,
    region: () => 0,
    regions: [{ name: 'Fuses' }],
    rowLabel: (r) => bin(r, A),
    describe: (i) => {
      const w = Math.floor(i / width);
      const c = i % width;
      const blown = prom.fuses[i] === 1;
      return `Fuse ${i}: address ${bin(w, A)} (${w}), output ${prom.outputs[c]} (column ${c}). ${blown ? `Blown: this bit reads ${prom.blownReads}` : `Intact: this bit reads ${1 - prom.blownReads}`}.`;
    },
    litMeaning: 'blown fuse',
    unlitMeaning: 'intact fuse',
  };
}

function promRunner(prom: Prom): Runner {
  const inputs = prom.inputs.slice();
  const run = (v: Record<string, number>): RunState => {
    const levels = inputs.map((n) => (v[n] ? 1 : 0));
    const address = levels.reduce<number>((a, b) => a * 2 + b, 0);
    const bits = prom.readBits(address);
    const signals: RunState['signals'] = {};
    inputs.forEach((n, i) => (signals[n] = levels[i] as Level));
    prom.outputs.forEach((n, c) => (signals[n] = bits[c]!));
    return { signals, activeTerms: new Set([wordTerm(address)]), stable: true, clocks: 0, detail: { address, bits } };
  };
  return { inputs, hasClock: false, powerUp: () => run({}), evaluate: run, clock: run };
}

function promReport(prom: Prom, ops: PromBlowOp[], target: number[] | null): ReportSection[] {
  const blown = prom.fuses.reduce((a, b) => a + b, 0);
  const sections: ReportSection[] = [
    {
      title: 'Utilisation',
      rows: [
        { label: 'Size', value: `${prom.words} words × ${prom.width} bits = ${prom.fuseCount} fuses` },
        { label: 'Blown', value: `${blown} fuses`, note: `${prom.blownReads === 1 ? 'a blown fuse reads 1' : 'a blown fuse reads 0'}; a virgin part reads all ${1 - prom.blownReads}s` },
        { label: 'Programming pulses', value: String(ops.length), note: 'one pulse per fuse to blow, each a short burst of current through the nichrome link' },
      ],
      meter: [{ label: 'Fuses blown', used: blown, of: prom.fuseCount }],
    },
  ];
  const diff = target ? prom.verify(target) : [];
  if (target)
    sections.push({
      title: 'Verify',
      rows: [
        diff.length === 0
          ? { label: 'Against the source', value: 'every word matches', level: 'ok' }
          : { label: 'Against the source', value: `${plural(diff.length, 'word')} differ`, level: 'bad', note: 'fuses were blown by hand; a blown fuse cannot be repaired' },
      ],
    });
  sections.push({
    title: 'Contents',
    table: {
      head: ['Address', ...prom.outputs, 'Hex'],
      rows: Array.from({ length: prom.words }, (_, a) => [bin(a, prom.addressBits), ...prom.readBits(a).map(String), prom.read(a).toString(16).toUpperCase().padStart(Math.ceil(prom.width / 4), '0')]),
      mono: true,
    },
  });
  sections.push({
    title: 'Timing',
    text: 'A PROM has no state: after the address changes, the data is valid one access time later (tAA), the same for every word. The vPROM does not model it; a bipolar fuse PROM of the 1970s guaranteed tAA in the tens of nanoseconds.',
  });
  return sections;
}

function promResolver(prom: Prom, source: string) {
  const W = prom.width;
  const lines = definitionLines(source);
  const outputLine: Record<string, number> = {};
  for (const o of prom.outputs) if (lines[o]) outputLine[o] = lines[o]!;
  const terms = [];
  for (let w = 0; w < prom.words; w++) {
    const feeds = prom.outputs.filter((_, c) => prom.bitValue(w, c) === 1);
    if (!feeds.length) continue;
    const cellsOf = (o: string) => [w * W + prom.outputs.indexOf(o)];
    terms.push({
      id: wordTerm(w),
      outputs: feeds,
      bits: feeds.flatMap((o) => cellsOf(o)),
      bitsVia: cellsOf,
      signals: prom.inputs.slice(),
    });
  }
  return makeResolver({
    outputs: prom.outputs.slice(),
    outputLine,
    terms,
    outputBits: Object.fromEntries(prom.outputs.map((o) => [o, [] as number[]])) as Record<string, number[]>,
    bitOwner: (i) => {
      const w = Math.floor(i / W);
      const o = prom.outputs[i % W]!;
      return prom.bitValue(w, i % W) === 1 ? { term: wordTerm(w) } : { output: o };
    },
  });
}

export function promFit(prom: Prom, source: string, ops: PromBlowOp[], target: number[] | null, edited = false): PromFit {
  const network = promNetwork(prom);
  const chip: PromChip = { kind: 'prom', prom, words: prom.words, width: prom.width, addressBits: prom.addressBits, inputs: prom.inputs, outputs: prom.outputs, ops, target };
  const blown = prom.fuses.reduce((a, b) => a + b, 0);
  const lines = definitionLines(source);
  const fit: PromFit = {
    adapter: 'prom',
    title: parsePragmas(source).title ?? `${prom.words} × ${prom.width} PROM`,
    summary: `${prom.words} words × ${prom.width} bits, ${plural(blown, 'fuse')} blown`,
    network,
    bits: promBits(prom),
    chip,
    report: promReport(prom, ops, target),
    equations: prom.outputs.map((o, c) => `${o} = ${[...Array(prom.words).keys()].filter((w) => prom.bitValue(w, c) === 1).map((w) => `m${w}`).join(' | ') || '0'}`),
    outputLine: Object.fromEntries(prom.outputs.filter((o) => lines[o]).map((o) => [o, lines[o]!])),
    resolve: promResolver(prom, source),
    runner: () => promRunner(prom),
    edited,
    programSteps: ops.map((op) => ({ type: 'blow' as const, word: op.word, column: op.column })),
    files: [
      { name: 'prom-fuses.json', mime: 'application/json', label: 'Fuse map (JSON)', text: JSON.stringify(prom.toFuseMap(), null, 2) },
      { name: 'prom-truth-table.txt', mime: 'text/plain', label: 'Truth table', text: prom.toTruthTable() + '\n' },
    ],
    edit: (action: EditAction) => {
      if (action.type === 'reset') {
        const p = new Prom({ addressBits: prom.addressBits, width: prom.width, blownReads: prom.blownReads, inputs: prom.inputs, outputs: prom.outputs });
        return promFit(p, source, ops, target, true);
      }
      if (action.type !== 'blow') return fit;
      const p = prom.clone();
      if (!p.blow(action.word, action.column)) return fit;
      return promFit(p, source, ops, target, true);
    },
  };
  return fit;
}

/** Row numbers in truth-table error messages ("Row 3: …") → source lines. */
function truthTableRowLine(source: string, row: number): number {
  let n = 0;
  const lines = source.split(/\r\n|\n|\r/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.replace(/(\/\/|#).*$/, '').trim()) continue;
    if (n === row) return i + 1;
    n++;
  }
  return 1;
}

export function programProm(source: string): { fit: PromFit; warnings: SourceError[] } | { errors: SourceError[] } {
  try {
    if (!isTruthTable(source)) {
      const lint = lintEquations(source);
      if (lint.length) return { errors: lint };
    }
    const { f } = functionOf(source);
    if (f.inputs.length < 1) return { errors: [{ line: 0, message: 'The function needs at least one input' }] };
    if (f.inputs.length > PROM_MAX_ADDRESS) return { errors: [{ line: 1, message: `A vPROM here has at most ${PROM_MAX_ADDRESS} address lines (${2 ** PROM_MAX_ADDRESS} words); this function has ${f.inputs.length} inputs. A PROM needs 2ⁿ words for n inputs: this is the reason PLAs exist.` }] };
    if (f.outputs.length < 1) return { errors: [{ line: 0, message: 'The function needs at least one output' }] };
    if (f.outputs.length > PROM_MAX_WIDTH) return { errors: [{ line: 1, message: `A vPROM here is at most ${PROM_MAX_WIDTH} bits wide; this function has ${f.outputs.length} outputs` }] };
    const prom = new Prom({ addressBits: f.inputs.length, width: f.outputs.length, inputs: f.inputs, outputs: f.outputs });
    const target = wordsOf(f, prom);
    const ops = prom.program(target);
    return { fit: promFit(prom, source, ops, target), warnings: [] };
  } catch (e) {
    if (e instanceof PromError) return { errors: [{ line: 0, message: e.message }] };
    if (e instanceof Error) {
      const m = /^Row (\d+):\s*(.*)$/s.exec(e.message);
      if (m) return { errors: [{ line: truthTableRowLine(source, Number(m[1])), message: m[2]! }] };
    }
    return { errors: errorsFrom(e, source) };
  }
}

export const promAdapter: DeviceAdapter = {
  id: 'prom',
  name: 'vPROM',
  short: 'PROM',
  blurb: 'A fuse PROM: every address selects a word, every fuse is one bit. A truth table burned into silicon.',
  language: 'A truth table or equations',
  syntax: [
    'Truth table: one row per line, inputs then outputs, separated by |. The first input is the most significant address line.',
    '  D C B A | a b c d e f g',
    '  0 0 0 0 | 1 1 1 1 1 1 0',
    'A - among the inputs covers both values; a - among the outputs is a don’t care (read as the virgin value, 0).',
    'Equations: a = expression, one per line, with ! & | ^ and parentheses. Inputs are ordered by first use; # @inputs D C B A fixes the order.',
    '# @title text names the design. A PROM holds at most 6 inputs (64 words).',
  ],
  examples: EXAMPLES.prom,
  editable: true,
  program(source) {
    const r = programProm(source);
    return 'errors' in r ? { ok: false, errors: r.errors } : { ok: true, fit: r.fit, warnings: r.warnings };
  },
  blank() {
    const prom = new Prom({ addressBits: 4, width: 7, inputs: ['D', 'C', 'B', 'A'], outputs: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    return promFit(prom, '', [], null);
  },
};
