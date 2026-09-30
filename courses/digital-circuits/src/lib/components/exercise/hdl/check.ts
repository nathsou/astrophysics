/**
 * Checking an `hdl` exercise: the reader's DCL is compiled, run against hidden `test` blocks, and compared with a
 * reference design on the RTL simulator. Pure TypeScript (no Svelte): `Hdl.svelte` is a shell around it.
 *
 * The equivalence check is exhaustive when the module's data inputs are few enough (`exhaustiveBits`, 16 by
 * default), as HDL.md, *Tests*, promises. A module with a clock is checked from power-up on every input sequence
 * of a bounded length (when that is few enough sequences), then on seeded random sequences; a combinational module
 * wider than the bound gets seeded random vectors. A mismatch is reported as a table of inputs, expected outputs
 * and what the reader's module gave: for a sequential module, the cycles that led up to the mismatch.
 */
import { check, createRtlSim, elaborate, runTests, type Diagnostic, type RtlModule, type RtlSim, type TestFailure } from '$lib/hdl';
import { hasErrors } from '$lib/hdl/diagnostics';
import { rng } from '../types';

export interface HdlInput {
  id: string;
  title?: string;
  prompt?: string;
  hints?: string[];
  explain?: string;
  /** The module the reader writes (and the hidden tests and the reference use). */
  top: string;
  /** What the editor starts with. Its `top` module gives the ports when there is no reference. */
  start: string;
  /** A hidden reference design: DCL source with a module named `top`. */
  reference?: string;
  /** Hidden DCL `test` blocks, appended to the reader's source. */
  tests?: string;
  solution?: string;
  /** Equivalence options. `false` turns the comparison with the reference off (the tests alone decide). */
  equivalence?: false | EquivalenceOptions;
  /** Editor height, in lines (not `lines`: the compiler renders a field of that name as Markdown). */
  height?: number;
}

export interface EquivalenceOptions {
  /** Exhaustive up to this many data input bits (default 16). */
  exhaustiveBits?: number;
  /** Random vectors beyond that (default 4096); for a sequential module, random runs (default 64). */
  random?: number;
  /** Cycles of a random run (default 48). */
  cycles?: number;
  /** Exhaustive input sequences of up to this many cycles, when there are at most 2^13 of them (default 8). */
  depth?: number;
  seed?: number;
}

export interface Port {
  name: string;
  width: number;
}

export interface HiddenTestResult {
  name: string;
  passed: boolean;
  /** What failed, in a sentence (empty when it passed). */
  message: string;
}

/** One row of a counterexample table: values as text, by port name. */
export interface CounterRow {
  /** The clock cycle (sequential modules). */
  cycle?: number;
  /** `before` or `after` the clock edge, for the row that mismatches (sequential modules). */
  phase?: 'before' | 'after';
  inputs: Record<string, string>;
  expected: Record<string, string>;
  got: Record<string, string>;
  /** The outputs that differ. */
  differ: string[];
}

export interface Equivalence {
  pass: boolean;
  kind: 'exhaustive' | 'random' | 'sequences';
  vectors: number;
  inputs: Port[];
  outputs: Port[];
  /** The mismatching vectors (combinational: several; sequential: the run up to the first). */
  rows: CounterRow[];
  /** How many mismatches there were in all, when it kept counting (combinational). */
  mismatches: number;
  sequential: boolean;
}

export interface HdlOutcome {
  pass: boolean;
  /** Errors and warnings of the reader's source. */
  diagnostics: Diagnostic[];
  /** A plain reason why nothing was run ("there is no module named X", "the ports changed"). */
  problems: string[];
  tests: HiddenTestResult[];
  equivalence?: Equivalence;
  /** The reader's source with the diagnostics' positions. */
  source: string;
}

const mapRow = (names: Port[], values: bigint[]): Record<string, string> => Object.fromEntries(names.map((p, i) => [p.name, show(values[i]!, p.width)]));

/** `0b0101` for up to 8 bits, `0x…` for wider values. */
export function show(v: bigint, width: number): string {
  if (width === 1) return v.toString();
  if (width <= 8) return `0b${v.toString(2).padStart(width, '0')}`;
  return `0x${v.toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0')}`;
}

interface Built {
  mod: RtlModule;
  sim: RtlSim;
  inputs: Port[];
  outputs: Port[];
  clock: string | undefined;
}

function build(source: string, top: string, file: string): { built?: Built; diagnostics: Diagnostic[]; problem?: string } {
  const { diagnostics, program } = check(source, { file });
  if (hasErrors(diagnostics)) return { diagnostics };
  if (!program.modules.has(top)) return { diagnostics, problem: `There is no module named \`${top}\`. The exercise checks a module with exactly that name.` };
  let design;
  try {
    design = elaborate(program, top);
  } catch (e) {
    return { diagnostics, problem: e instanceof Error ? e.message : String(e) };
  }
  const sim = createRtlSim(design, top);
  const mod = sim.module;
  const port = (name: string): Port => ({ name, width: sim.width(name) });
  const clocks = mod.inputs.filter((p) => p.clock);
  return {
    diagnostics,
    built: {
      mod,
      sim,
      inputs: mod.inputs.filter((p) => !p.clock).map((p) => port(p.name)),
      outputs: mod.outputs.map((p) => port(p.name)),
      clock: clocks[0]?.name,
    },
  };
}

const portText = (ports: Port[], clock?: string) => [...(clock ? [`${clock}: clock`] : []), ...ports.map((p) => `${p.name}: ${p.width === 1 ? 'bit' : `bits<${p.width}>`}`)].join(', ');

/** The ports that the reader's module must have, compared with the contract's. Empty when they match. */
function portProblems(mine: Built, want: Built): string[] {
  const out: string[] = [];
  const same = (a: Port[], b: Port[]) => a.length === b.length && a.every((p, i) => p.name === b[i]!.name && p.width === b[i]!.width);
  if (!same(mine.inputs, want.inputs) || mine.clock !== want.clock || !same(mine.outputs, want.outputs)) {
    out.push(`The ports must not change. The exercise expects \`(${portText(want.inputs, want.clock)}) -> (${portText(want.outputs)})\`; your module has \`(${portText(mine.inputs, mine.clock)}) -> (${portText(mine.outputs)})\`.`);
  }
  return out;
}

function failureMessage(f: TestFailure): string {
  const vals = f.values.length ? ` (${f.values.map((v) => `${v.name} = ${v.value}`).join(', ')})` : '';
  return `expected ${f.text}${vals}`;
}

/** Run the hidden tests against the reader's source: results for the hidden blocks only. */
function runHidden(source: string, tests: string, file: string): HiddenTestResult[] {
  const n = [...tests.matchAll(/^\s*test\s+"/gm)].length;
  const run = runTests(`${source}\n\n${tests}\n`, { file });
  const mine = run.results.slice(run.results.length - n);
  return mine.map((r) => ({
    name: r.name,
    passed: r.passed,
    message: r.passed ? '' : r.error ? r.error.message : r.failures[0] ? failureMessage(r.failures[0]) : 'failed',
  }));
}

// ── Equivalence ─────────────────────────────────────────────────────────────────

const MAX_ROWS = 6;

function compare(a: Built, b: Built, o: Required<EquivalenceOptions>): Equivalence {
  const inputs = a.inputs;
  const outputs = a.outputs;
  const sequential = a.clock !== undefined;
  const ha = inputs.map((p) => a.sim.signal(p.name));
  const hb = inputs.map((p) => b.sim.signal(p.name));
  const oa = outputs.map((p) => a.sim.signal(p.name));
  const ob = outputs.map((p) => b.sim.signal(p.name));
  const totalBits = inputs.reduce((s, p) => s + p.width, 0);
  const random = rng(o.seed);
  const randBig = (w: number): bigint => {
    let v = 0n;
    for (let k = 0; k < w; k += 24) v = (v << 24n) | BigInt(Math.floor(random() * 0x1000000));
    return v & ((1n << BigInt(w)) - 1n);
  };
  const apply = (vec: bigint[]) => {
    vec.forEach((v, i) => {
      ha[i]!.set(v);
      hb[i]!.set(v);
    });
  };
  const read = (hs: typeof oa) => hs.map((h) => h.getBig());
  const differ = (x: bigint[], y: bigint[]) => outputs.filter((_, i) => x[i] !== y[i]).map((p) => p.name);
  const row = (vec: bigint[], want: bigint[], got: bigint[], extra: Partial<CounterRow> = {}): CounterRow => ({
    ...extra,
    inputs: mapRow(inputs, vec),
    expected: mapRow(outputs, want),
    got: mapRow(outputs, got),
    differ: differ(want, got),
  });

  if (!sequential) {
    const exhaustive = totalBits <= o.exhaustiveBits;
    const count = exhaustive ? 2 ** totalBits : o.random;
    const rows: CounterRow[] = [];
    let mismatches = 0;
    const split = (n: number): bigint[] => {
      const vec: bigint[] = [];
      let shift = 0n;
      // The first input is the most significant, as in a truth table.
      for (let i = inputs.length - 1; i >= 0; i--) {
        vec[i] = (BigInt(n) >> shift) & ((1n << BigInt(inputs[i]!.width)) - 1n);
        shift += BigInt(inputs[i]!.width);
      }
      return vec;
    };
    for (let n = 0; n < count; n++) {
      const vec = exhaustive ? split(n) : inputs.map((p) => randBig(p.width));
      apply(vec);
      const want = read(ob);
      const got = read(oa);
      if (differ(want, got).length) {
        mismatches++;
        if (rows.length < MAX_ROWS) rows.push(row(vec, want, got));
      }
    }
    return { pass: mismatches === 0, kind: exhaustive ? 'exhaustive' : 'random', vectors: count, inputs, outputs, rows, mismatches, sequential };
  }

  // Sequential: power up both, drive the same inputs, compare before and after every clock edge.
  let vectors = 0;
  const hist: { vec: bigint[]; want: bigint[]; got: bigint[] }[] = [];
  const runSeq = (seq: bigint[][]): CounterRow[] | undefined => {
    a.sim.reset();
    b.sim.reset();
    hist.length = 0;
    for (let c = 0; c < seq.length; c++) {
      apply(seq[c]!);
      let want = read(ob);
      let got = read(oa);
      hist.push({ vec: seq[c]!, want, got });
      vectors++;
      if (differ(want, got).length) return rowsOf(c, 'before');
      a.sim.tick();
      b.sim.tick();
      want = read(ob);
      got = read(oa);
      hist[c] = { vec: seq[c]!, want, got };
      if (differ(want, got).length) return rowsOf(c, 'after');
    }
    return undefined;
  };
  const rowsOf = (cycle: number, phase: 'before' | 'after'): CounterRow[] => {
    // The reader sees the last few cycles, ending with the mismatch; `before` rows show the outputs before the edge.
    const from = Math.max(0, cycle - (MAX_ROWS - 1));
    return hist.slice(from, cycle + 1).map((h, k) => row(h.vec, h.want, h.got, { cycle: from + k, phase: from + k === cycle ? phase : 'after' }));
  };
  // Exhaustive short sequences: the input vectors are the digits of a number in base 2^totalBits.
  const vecBits = totalBits;
  let depth = 0;
  if (vecBits === 0) depth = 1;
  else while (depth < o.depth && vecBits * (depth + 1) <= 13) depth++;
  const vecCount = 2 ** vecBits;
  const exhaustiveCases = vecBits === 0 ? 1 : depth > 0 ? vecCount ** depth : 0;
  const decode = (vec: number): bigint[] => {
    const out: bigint[] = [];
    let rest = BigInt(vec);
    for (let i = inputs.length - 1; i >= 0; i--) {
      out[i] = rest & ((1n << BigInt(inputs[i]!.width)) - 1n);
      rest >>= BigInt(inputs[i]!.width);
    }
    return out;
  };
  const cyclesRandom = o.cycles;
  if (depth > 0 && vecBits > 0) {
    for (let n = 0; n < exhaustiveCases; n++) {
      const seq: bigint[][] = [];
      let rest = n;
      for (let d = 0; d < depth; d++) {
        seq.push(decode(rest % vecCount));
        rest = Math.floor(rest / vecCount);
      }
      const bad = runSeq(seq);
      if (bad) return { pass: false, kind: 'sequences', vectors, inputs, outputs, rows: bad, mismatches: 1, sequential };
    }
  }
  for (let r = 0; r < o.random; r++) {
    const seq: bigint[][] = [];
    // Hold inputs for a few cycles sometimes, so counters and timers get to count.
    let cur = inputs.map((p) => randBig(p.width));
    for (let c = 0; c < cyclesRandom; c++) {
      if (random() < 0.45) cur = inputs.map((p) => randBig(p.width));
      seq.push(cur);
    }
    const bad = runSeq(seq);
    if (bad) return { pass: false, kind: 'sequences', vectors, inputs, outputs, rows: bad, mismatches: 1, sequential };
  }
  return { pass: true, kind: 'sequences', vectors, inputs, outputs, rows: [], mismatches: 0, sequential };
}

/** Compile and check the reader's source. */
export function checkHdl(input: HdlInput, source: string): HdlOutcome {
  const file = `${input.top}.dcl`;
  const base: HdlOutcome = { pass: false, diagnostics: [], problems: [], tests: [], source };
  const mine = build(source, input.top, file);
  base.diagnostics = mine.diagnostics;
  if (!mine.built) {
    if (mine.problem) base.problems.push(mine.problem);
    return base;
  }
  // The contract: the reference's ports, else the starting code's.
  const contract = build(input.reference ?? input.start, input.top, 'reference.dcl');
  if (contract.built) base.problems.push(...portProblems(mine.built, contract.built));
  if (base.problems.length) return base;

  if (input.tests) base.tests = runHidden(source, input.tests, file);
  let eq: Equivalence | undefined;
  if (input.reference && input.equivalence !== false && contract.built) {
    const o = input.equivalence ?? {};
    eq = compare(mine.built, contract.built, { exhaustiveBits: o.exhaustiveBits ?? 16, random: o.random ?? (mine.built.clock ? 64 : 4096), cycles: o.cycles ?? 48, depth: o.depth ?? 8, seed: o.seed ?? 7 });
    base.equivalence = eq;
  }
  base.pass = base.tests.every((t) => t.passed) && (eq ? eq.pass : true);
  return base;
}

/** The text of an outcome, for tests and for the screen reader. */
export function summary(o: HdlOutcome): string {
  if (o.pass) return 'All hidden tests pass and the design matches the reference.';
  const lines: string[] = [];
  for (const d of o.diagnostics.filter((x) => x.severity === 'error')) lines.push(`error: ${d.message}`);
  lines.push(...o.problems);
  for (const t of o.tests.filter((x) => !x.passed)) lines.push(`test "${t.name}": ${t.message}`);
  if (o.equivalence && !o.equivalence.pass) lines.push('The design differs from the reference.');
  return lines.join('\n');
}
