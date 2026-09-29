import type { Circuit, EngineKind } from '../netlist/types';
import type { SubResolver } from '../netlist/connect';
import { CircuitBench } from './circuit';
import { compileComb, type CombSpec, type Expect } from './spec';
import { rng } from './rng';

export interface CombOptions {
  parts?: SubResolver;
  /** Counterexamples to collect (default 3). */
  maxFailures?: number;
  /** Refuse specs with more inputs than this (default 24). */
  maxInputs?: number;
  /** Check every input row up to this many (default 65 536 = 16 inputs); beyond it, corners and seeded random rows. */
  maxVectors?: number;
  /** Random rows when sampling (default 3000). */
  samples?: number;
  /** Simulate on this engine (default: the circuit's own). */
  engine?: EngineKind;
}

export interface CombFailure {
  /** Row number (the first input is the most significant bit). */
  index: number;
  inputs: Record<string, number>;
  expected: Record<string, Expect>;
  /** What the circuit gave: '0', '1', 'X' (unknown) or 'Z' (floating). */
  got: Record<string, string>;
  /** The outputs that differ. */
  wrong: string[];
}

export interface CombResult {
  pass: boolean;
  /** Why the check could not run, or a summary of what is wrong with the circuit's pins. */
  problems: string[];
  checked: number;
  total: number;
  failCount: number;
  failures: CombFailure[];
  /** Per input row, when the table is small (≤ 256 rows): did that row pass? */
  rows?: ('pass' | 'fail' | 'skip')[];
  /** Too many inputs for every row: corners and random rows were checked instead. */
  sampled?: boolean;
  inputs: string[];
  outputs: string[];
}

const CH = ['0', '1', 'X', 'Z'];

/** Check a circuit against a combinational spec on the digital engine, over every input combination. */
export function checkCombinational(circuit: Circuit, spec: CombSpec, options: CombOptions = {}): CombResult {
  const maxFailures = options.maxFailures ?? 3;
  const empty = (problems: string[], inputs: string[] = [], outputs: string[] = []): CombResult => ({ pass: false, problems, checked: 0, total: 0, failCount: 0, failures: [], inputs, outputs });
  let model;
  try {
    model = compileComb(spec, { parts: options.parts });
  } catch (e) {
    return empty([`The specification is not valid: ${e instanceof Error ? e.message : String(e)}`]);
  }
  const { inputs, outputs } = model;
  if (model.problems.length) return empty([`The reference circuit has problems: ${model.problems.join('; ')}`], inputs, outputs);
  if (inputs.length > (options.maxInputs ?? 24)) return empty([`Too many inputs to check exhaustively (${inputs.length}).`], inputs, outputs);

  let bench: CircuitBench;
  try {
    bench = new CircuitBench(circuit, { parts: options.parts, engine: options.engine });
  } catch (e) {
    return empty([`The circuit cannot be simulated: ${e instanceof Error ? e.message : String(e)}`], inputs, outputs);
  }
  const problems = [...bench.problems];
  for (const n of inputs) if (!bench.hasInput(n)) problems.push(`The circuit has no input called ${n}.`);
  for (const n of outputs) if (!bench.hasOutput(n)) problems.push(`The circuit has no output called ${n}.`);
  if (problems.length) return empty(problems, inputs, outputs);

  const n = inputs.length;
  const full = 2 ** n <= (options.maxVectors ?? 65536);
  const list: number[] = [];
  if (full) for (let i = 0; i < 2 ** n; i++) list.push(i);
  else {
    // Corners (all 0, all 1, each input alone, each input missing) and seeded random rows.
    const all = 2 ** n - 1;
    list.push(0, all);
    for (let k = 0; k < n; k++) list.push(2 ** k, all - 2 ** k);
    const rand = rng(0xc0ffee);
    for (let i = 0; i < (options.samples ?? 3000); i++) list.push(Math.floor(rand() * 2 ** n));
  }
  const total = list.length;
  const failures: CombFailure[] = [];
  const rows: ('pass' | 'fail' | 'skip')[] | undefined = full && total <= 256 ? [] : undefined;
  let failCount = 0;
  for (const i of list) {
    const bits = inputs.map((_, k) => Math.floor(i / 2 ** (n - 1 - k)) % 2);
    inputs.forEach((name, k) => bench.set(name, bits[k]!));
    bench.settle();
    const want = model.expected(bits);
    const wrong: string[] = [];
    const got: Record<string, string> = {};
    let any = false;
    outputs.forEach((o, k) => {
      const v = bench.get(o);
      got[o] = CH[v]!;
      const w = want[k];
      if (w === null || w === undefined) return;
      any = true;
      if (v !== w) wrong.push(o);
    });
    if (wrong.length) {
      failCount++;
      rows?.push('fail');
      if (failures.length < maxFailures) {
        failures.push({
          index: i,
          inputs: Object.fromEntries(inputs.map((name, k) => [name, bits[k]!])),
          expected: Object.fromEntries(outputs.map((o, k) => [o, want[k] ?? null])),
          got,
          wrong,
        });
      }
    } else rows?.push(any ? 'pass' : 'skip');
  }
  const errors = bench.errors();
  if (errors.length) problems.push(...errors.slice(0, 2));
  return { pass: failCount === 0 && problems.length === 0, problems, checked: total, total, failCount, failures, rows, sampled: !full, inputs, outputs };
}
