/**
 * A `decode` exercise: a configuration the reader cannot see the source of, and a function to work out. The
 * configuration is made from hidden source text (or a hidden vFPGA-S design) with the course's own fitters; what the
 * reader sees is its raw data: a PROM's words, a PLA's two fuse planes, a GAL22V10's JEDEC rows, or the cells and
 * routing of a small bitstream. The answer is an expression, a truth table or a DCL module, and it is checked by
 * equivalence with what the *device* does (the Studio's runner on the configured device, or the fabric simulator
 * on the decoded bitstream), never by comparing with the hidden source. Pure TypeScript.
 */
import { createRtlSim, check, elaborate } from '$lib/hdl';
import { hasErrors } from '$lib/hdl/diagnostics';
import { FUSE_COUNT, toFuseMap, OLMC_PINS } from '$lib/pld/devices/gal22v10';
import { evalExpr, exprVars, parseEquations, type Equation } from '$lib/pld/twolevel/expr';
import { getAdapter } from '$lib/studio/adapters';
import type { GalChip } from '$lib/studio/adapters/gal';
import type { PlaChip } from '$lib/studio/adapters/pla';
import type { PromChip } from '$lib/studio/adapters/prom';
import { recover } from '$lib/studio/fpga/hand';
import { hex4 } from '$lib/studio/fpga/lut';
import { buildFabric, configuredCells, device, simulateFabric, type FabricSpec } from '../fabric';

export type DecodeDevice = 'prom' | 'pla' | 'gal22v10' | 'fpga';
export type AnswerMode = 'expression' | 'table' | 'dcl';

export interface DecodeInput {
  id: string;
  title?: string;
  prompt?: string;
  hints?: string[];
  explain?: string;
  device: DecodeDevice;
  /** The hidden design the configuration is made from (PROM, PLA, GAL). */
  source?: string;
  /** The hidden vFPGA-S design (device `fpga`). */
  bitstream?: FabricSpec;
  /** The names of the inputs and outputs the answer is about (pins, pads), in truth-table order. */
  inputs: string[];
  outputs: string[];
  /** Answer forms offered (default: expression and table). */
  answers?: AnswerMode[];
  /** What to show of the configuration (GAL: the output pins whose rows are listed; default: all in use). */
  show?: { pins?: number[] };
  /** Names the reader's answer must use for the inputs, when different from `inputs` (DCL modules use these as port names). */
  solution?: string;
}

// ── What the reader sees ────────────────────────────────────────────────────────

export interface GridRow {
  label: string;
  /** One character per column: `0`, `1`, or ` ` for a gap. */
  bits: string;
  note?: string;
}

export interface Grid {
  title: string;
  /** Column heads, grouped (a group is drawn with a rule before it). */
  heads: { label: string; span?: number }[];
  headLabel?: string;
  /** The first this many columns come in pairs (a signal and its complement): a rule is drawn before each pair. */
  pairCols?: number;
  rows: GridRow[];
  caption?: string;
}

export interface Listing {
  title: string;
  head: string[];
  rows: string[][];
  caption?: string;
}

export interface Artifact {
  title: string;
  /** What to know to read it. */
  legend: string[];
  grids: Grid[];
  listings: Listing[];
}

export class DecodeError extends Error {}

const chunk = (s: string, n: number): string => s.replace(new RegExp(`(.{${n}})(?=.)`, 'g'), '$1 ');

/** The configured device behind an adapter-based exercise. */
function programmed(input: DecodeInput) {
  const adapter = getAdapter(input.device);
  if (!adapter || !input.source) throw new DecodeError(`decode: a ${input.device} exercise needs a source`);
  const r = adapter.program(input.source);
  if (!r.ok) throw new DecodeError(`decode: the hidden source does not fit: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.fit;
}

export function artifactOf(input: DecodeInput): Artifact {
  if (input.device === 'fpga') return fpgaArtifact(input);
  const fit = programmed(input);
  if (input.device === 'prom') {
    const prom = (fit.chip as PromChip).prom;
    const map = prom.toFuseMap();
    return {
      title: `A ${prom.words}-word PROM, ${map.width} bits wide`,
      legend: [`1 means the fuse is blown. A word is chosen by the address ${map.inputs.join('')}, most significant bit first; the bits of a word are D${map.width - 1} to D0, left to right.`],
      grids: [
        {
          title: 'Fuse map',
          heads: map.outputs.map((o) => ({ label: o })),
          headLabel: `address ${map.inputs.join('')}`,
          rows: map.fuses.map((f, w) => ({ label: w.toString(2).padStart(map.inputs.length, '0'), bits: f })),
        },
      ],
      listings: [],
    };
  }
  if (input.device === 'pla') {
    const pla = (fit.chip as PlaChip).pla;
    const map = pla.toFuseMap();
    const used = map.termInfo.filter((t) => t.outputs.length > 0 && t.kind !== 'false');
    const inNames = map.inputNames.slice(0, (fit.chip as PlaChip).declaredInputs);
    const outNames = map.outputNames.slice(0, (fit.chip as PlaChip).declaredOutputs);
    const nIn = inNames.length;
    const nOut = outNames.length;
    return {
      title: `A PLA: ${nIn} inputs, ${used.length} product terms in use, ${nOut} outputs`,
      legend: [
        'In the AND plane each input has two fuses, one for the input and one for its complement (`A` and `!A` in the heads). An **intact** fuse (0) connects that form to the term’s AND gate; a **blown** fuse (1) disconnects it.',
        'In the OR plane an intact fuse (0) connects the term to the output’s OR gate. A blown fuse (1) in the last row inverts the output (active low).',
      ],
      grids: [
        {
          title: 'AND plane, then OR plane',
          heads: [...inNames.flatMap((n) => [{ label: n }, { label: `!${n}` }]), ...outNames.map((n) => ({ label: n }))],
          headLabel: 'product term',
          pairCols: nIn * 2,
          rows: [
            ...used.map((t) => ({
              label: `T${t.index}`,
              bits: `${map.and[t.index]!.slice(0, nIn * 2)} ${map.or[t.index]!.slice(0, nOut)}`,
            })),
            { label: 'inverts', bits: `${' '.repeat(nIn * 2)} ${map.polarity.slice(0, nOut)}` },
          ],
        },
      ],
      listings: [],
    };
  }
  if (input.device === 'gal22v10') return galArtifact(input, fit.chip as GalChip);
  throw new DecodeError(`decode: unknown device ${input.device}`);
}

function galArtifact(input: DecodeInput, chip: GalChip): Artifact {
  if (chip.fuses.length !== FUSE_COUNT) throw new DecodeError('decode: not a GAL22V10 fuse array');
  const map = toFuseMap(chip.fuses);
  const pins = input.show?.pins ?? OLMC_PINS.filter((p) => chip.olmcs.find((o) => o.pin === p && o.use === 'output')).map((p) => p);
  const pinOf = (c: number) => map.columns[c]!;
  const rows: GridRow[] = [];
  for (const pin of pins) {
    const rowsOf = map.rows.filter((r) => r.pin === pin);
    for (const r of rowsOf) {
      // A product-term row that nothing uses is all zeros (a constant 0): leave it out, as the terms in use are what matter.
      if (r.kind === 'term' && /^0+$/.test(r.bits)) continue;
      rows.push({
        label: `L${String(r.row * 44).padStart(4, '0')}`,
        bits: r.bits,
        note: r.kind === 'OE' ? `pin ${pin} output enable` : `pin ${pin}, term ${(r.term ?? 0) + 1}`,
      });
    }
  }
  const heads = Array.from({ length: 22 }, (_, k) => ({ label: String(pinOf(2 * k).pin), span: 2 }));
  return {
    title: 'GAL22V10 fuse map (JEDEC)',
    legend: [
      'Each row is one product term: 44 fuses, two for each of the 22 signals of the array (the pin, then its complement). In a JEDEC file a **0 connects** the signal to the term and a **1 leaves it out**: a row of all 1s is the constant 1, and a signal with both fuses at 0 makes the term 0. The number is the address of the row’s first fuse.',
      'Rows with nothing in them (all 0) are left out. An output’s sum is the OR of its rows. The last table is the macrocell configuration: S0 = 1 is active high, 0 active low; S1 = 1 is combinational, 0 registered.',
    ],
    grids: [
      {
        title: 'The array, by row',
        headLabel: 'fuse no. · pins across the top',
        pairCols: 44,
        heads,
        rows,
      },
    ],
    listings: [
      {
        title: 'Pins of this design',
        head: ['pin', 'signal', 'direction'],
        rows: chip.pins.filter((p) => p.name && (p.role === 'input' || p.role === 'output' || p.role === 'input-olmc')).map((p) => [String(p.pin), p.name, p.role === 'output' ? 'output' : 'input']),
      },
      {
        title: 'Macrocell configuration',
        head: ['pin', 'S0', 'S1', 'so the output is'],
        rows: pins.map((pin) => {
          const o = map.olmcs.find((x) => x.pin === pin)!;
          return [String(pin), String(o.s0), String(o.s1), `${o.activeHigh ? 'active high' : 'active low'}, ${o.registered ? 'registered' : 'combinational'}`];
        }),
      },
    ],
  };
}

function fpgaArtifact(input: DecodeInput): Artifact {
  if (!input.bitstream) throw new DecodeError('decode: an fpga exercise needs a bitstream');
  const dev = device();
  const bits = buildFabric(input.bitstream).bits;
  const rec = recover(dev, bits);
  const cells = configuredCells(dev, bits);
  const listings: Listing[] = [
    {
      title: 'Logic cells in use',
      caption: 'The 16 bits of a cell’s LUT, as the bitstream holds them. Bit r is the output when I0 + 2·I1 + 4·I2 + 8·I3 = r, so the first bit is the output for inputs 0000 and the last for 1111 (Chapter 28).',
      head: ['cell', 'LUT bits, 15 down to 0', 'as hex', 'flip-flop'],
      rows: cells.map((c) => [c.name, chunk((c.lut & 0xffff).toString(2).padStart(16, '0'), 4), hex4(c.lut), c.ff ? 'used' : 'no']),
    },
    {
      title: 'Routing multiplexers that are set',
      caption: 'Each line is one cell input and what the routing delivers to it: the multiplexers on the way (Chapter 28) have been followed for you, back to a pad or to a cell’s output.',
      head: ['input or pad', 'is driven by'],
      rows: rec.nodes
        .filter((n) => n.kind === 'lut')
        .flatMap((n) =>
          n.used.map((p): string[] => {
            const d = n.inputs[p]!;
            const from = d < 0 ? '(nothing)' : rec.nodes[d]!.label;
            return [`${n.label}.I${p}`, from];
          }),
        ),
    },
    {
      title: 'Pads',
      head: ['pad', 'set as', 'driven by'],
      rows: rec.nodes
        .filter((n) => n.kind === 'pad-out')
        .map((n) => [n.label, 'output', n.inputs[0]! >= 0 ? rec.nodes[n.inputs[0]!]!.label : '(nothing)'])
        .concat(rec.nodes.filter((n) => n.kind === 'pad-in').map((n) => [n.label, 'input', '(the outside world)'])),
    },
  ];
  return {
    title: 'A vFPGA-S bitstream, region by region',
    legend: ['Only what is set is listed. A cell with its flip-flop unused passes the LUT’s output straight through.'],
    grids: [],
    listings,
  };
}

// ── What the device does ─────────────────────────────────────────────────────────

export type Bit = 0 | 1;

/** The truth table of the configured device: outputs for every input vector (first input = most significant bit). */
export function deviceTruth(input: DecodeInput): Bit[][] {
  const n = input.inputs.length;
  const rows: Bit[][] = [];
  if (input.device === 'fpga') {
    const bits = buildFabric(input.bitstream ?? {}).bits;
    const sim = simulateFabric(device(), bits, input.inputs, input.outputs);
    if (sim.problems.length) throw new DecodeError(`decode: the hidden bitstream does not work: ${sim.problems.join('; ')}`);
    return sim.rows.map((r) => r.map((l): Bit => (l === '1' ? 1 : 0)));
  }
  const fit = programmed(input);
  const runner = fit.runner();
  for (let v = 0; v < 1 << n; v++) {
    const state = runner.evaluate(Object.fromEntries(input.inputs.map((name, i) => [name, (v >> (n - 1 - i)) & 1])));
    rows.push(input.outputs.map((o) => (state.signals[o] === 1 ? 1 : 0)));
  }
  return rows;
}

// ── Checking an answer ───────────────────────────────────────────────────────────

export interface DecodeRow {
  inputs: Record<string, string>;
  expected: Record<string, string>;
  got: Record<string, string>;
  differ: string[];
}

export interface DecodeOutcome {
  pass: boolean;
  problems: string[];
  rows: DecodeRow[];
  compared: number;
}

/** The port a DCL answer uses for a pin or pad: its name in lower case (`A` is `a`, `P0` is `p0`). */
export const portName = (n: string): string => n.toLowerCase();

/** The module the DCL answer starts from. */
export function dclTemplate(input: DecodeInput): string {
  return `module Decoded(${input.inputs.map((i) => `${portName(i)}: bit`).join(', ')}) -> (${input.outputs.map((o) => `${portName(o)}: bit`).join(', ')}) {\n${input.outputs.map((o) => `  ${portName(o)} = 0`).join('\n')}\n}\n`;
}

export interface Answer {
  mode: AnswerMode;
  /** Expression mode: equations, one per line (`Y = A & !B`). DCL mode: the module. */
  text?: string;
  /** Table mode: per output, a value for every input vector (null: not filled in). */
  table?: Record<string, (Bit | null)[]>;
}

const MAX_ROWS = 8;

function compare(input: DecodeInput, truth: Bit[][], got: (v: number) => (string | null)[]): DecodeOutcome {
  const n = input.inputs.length;
  const rows: DecodeRow[] = [];
  let bad = 0;
  for (let v = 0; v < 1 << n; v++) {
    const g = got(v);
    const differ = input.outputs.filter((_, i) => g[i] !== String(truth[v]![i]));
    if (differ.length) {
      bad++;
      if (rows.length < MAX_ROWS) {
        rows.push({
          inputs: Object.fromEntries(input.inputs.map((name, i) => [name, String((v >> (n - 1 - i)) & 1)])),
          expected: Object.fromEntries(input.outputs.map((o, i) => [o, String(truth[v]![i])])),
          got: Object.fromEntries(input.outputs.map((o, i) => [o, g[i] ?? '?'])),
          differ,
        });
      }
    }
  }
  return { pass: bad === 0, problems: bad ? [] : [], rows, compared: 1 << n };
}

export function checkDecode(input: DecodeInput, answer: Answer, truth: Bit[][] = deviceTruth(input)): DecodeOutcome {
  const fail = (...problems: string[]): DecodeOutcome => ({ pass: false, problems, rows: [], compared: 0 });
  const n = input.inputs.length;
  if (answer.mode === 'table') {
    const t = answer.table ?? {};
    for (const o of input.outputs) if (!t[o] || t[o]!.some((x) => x === null || x === undefined)) return fail('Fill in every cell of the table first.');
    return compare(input, truth, (v) => input.outputs.map((o) => String(t[o]![v])));
  }
  const text = (answer.text ?? '').trim();
  if (!text) return fail(answer.mode === 'dcl' ? 'Write the module first.' : 'Write an equation for each output first.');
  if (answer.mode === 'expression') {
    let eqs: Equation[];
    try {
      eqs = parseEquations(text);
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
    const by = new Map(eqs.map((e) => [e.name, e]));
    const problems: string[] = [];
    for (const o of input.outputs) if (!by.has(o)) problems.push(`There is no equation for ${o}. Write ${o} = …`);
    for (const e of eqs) {
      if (!input.outputs.includes(e.name)) problems.push(`${e.name} is not one of the outputs (${input.outputs.join(', ')}).`);
      for (const v of exprVars(e.expr)) if (!input.inputs.includes(v)) problems.push(`${v} is not one of the inputs (${input.inputs.join(', ')}).`);
    }
    if (problems.length) return fail(...[...new Set(problems)]);
    return compare(input, truth, (v) => {
      const val = (name: string) => (v >> (n - 1 - input.inputs.indexOf(name))) & 1;
      return input.outputs.map((o) => String(evalExpr(by.get(o)!.expr, val)));
    });
  }
  // DCL: a module named Decoded with a bit input per input and a bit output per output.
  const { diagnostics, program } = check(text, { file: 'decoded.dcl' });
  if (hasErrors(diagnostics)) return fail(...diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.message} (line ${d.span.line})`));
  if (!program.modules.has('Decoded')) return fail('Name the module `Decoded`.');
  let sim;
  try {
    sim = createRtlSim(elaborate(program, 'Decoded'), 'Decoded');
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  const missing = [...input.inputs.filter((i) => !sim.module.inputs.some((p) => p.name === portName(i))).map((i) => `input ${portName(i)}`), ...input.outputs.filter((o) => !sim.module.outputs.some((p) => p.name === portName(o))).map((o) => `output ${portName(o)}`)];
  if (missing.length) return fail(`The module needs ${missing.join(', ')} (each a \`bit\`).`);
  if (sim.module.inputs.some((p) => p.clock)) return fail('The function has no clock: write a module without registers.');
  return compare(input, truth, (v) => {
    input.inputs.forEach((name, i) => sim.set(portName(name), (v >> (n - 1 - i)) & 1));
    return input.outputs.map((o) => sim.getBig(portName(o)).toString());
  });
}

/** Expected values for a table answer, so the component can show them after "Show a solution". */
export function truthTable(input: DecodeInput): Record<string, Bit[]> {
  const t = deviceTruth(input);
  return Object.fromEntries(input.outputs.map((o, i) => [o, t.map((r) => r[i]!)]));
}
