/**
 * Checking a `fit` exercise: a configured device (a PLA, a GAL22V10 or a vCPLD-32 from the Device Studio's adapters)
 * against a specification, and its resources against a budget. Pure TypeScript; `Fit.svelte` is a shell around it.
 *
 * The device is checked the way the Studio runs it: the `Runner` of the `DeviceFit`, which simulates the device
 * from its fuses or configuration bits, never the source text. So a PLA programmed by hand (clicking crossings)
 * is checked exactly like one fitted from equations.
 *
 * Specifications, as in `build` blocks where they overlap:
 * - `truthTable` or `expression` (combinational): every input combination, with don't-care outputs skipped;
 * - `fsm` (a state machine table, see `FsmInput`): the device and the table run in lock step from power-up, over
 *   every short input sequence and then over seeded random ones;
 * - `steps`: a scripted scenario (set inputs, give clock edges, expect outputs), for counters and registers.
 *
 * Resources come from the fit's network, so they mean the same on every device: product terms, macrocells (outputs
 * of the OR plane or the macrocell array, buried ones too), registers and literals.
 */
import { compileComb, FsmMachine, type CombSpec, type FsmInput, type OutVal } from '$lib/sim/check';
import { getAdapter } from '$lib/studio/adapters';
import type { DeviceFit, NetTerm, SourceError } from '$lib/studio/types';
import { rng } from '../types';

export type FitDevice = 'pla' | 'gal22v10' | 'cpld32';

export interface FitStep {
  /** Inputs to set (they keep their value until set again). */
  set?: Record<string, number>;
  /** Rising clock edges to give after setting the inputs (default 0). */
  clock?: number;
  /** Outputs to read after that (`z`: not driven). */
  expect?: Record<string, number | string>;
  name?: string;
}

export interface FitSpec extends Pick<CombSpec, 'truthTable' | 'expression' | 'inputs'> {
  fsm?: FsmInput;
  steps?: FitStep[];
  /** Buses for `steps`: `{ Q: [Q3, Q2, Q1, Q0] }` (most significant first) lets a step say `set: { D: 5 }` or `expect: { Q: 9 }`. */
  buses?: Record<string, string[]>;
  /** Input and output names of a `steps` spec, for a device that is programmed by hand. */
  ports?: { inputs?: string[]; outputs?: string[] };
}

/** The spec's input and output names, in order. */
export function pinsOf(spec: FitSpec): { inputs: string[]; outputs: string[] } {
  if (spec.fsm) return { inputs: [...spec.fsm.inputs], outputs: [...spec.fsm.outputs] };
  if (spec.steps) return { inputs: spec.ports?.inputs ?? [], outputs: spec.ports?.outputs ?? [] };
  const m = compileComb({ truthTable: spec.truthTable, expression: spec.expression, inputs: spec.inputs });
  return { inputs: m.inputs, outputs: m.outputs };
}

/** `{ Q: 9 }` with a bus `Q: [Q3, Q2, Q1, Q0]` becomes `{ Q3: 1, Q2: 0, Q1: 0, Q0: 1 }`. */
function expandBuses(values: Record<string, number | string> | undefined, buses: Record<string, string[]> = {}): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(values ?? {})) {
    const bus = buses[k];
    if (!bus) out[k] = v;
    else bus.forEach((name, i) => (out[name] = (Number(v) >> (bus.length - 1 - i)) & 1));
  }
  return out;
}

export interface FitBudget {
  /** Product terms in use (a term shared by several outputs counts once, as on a PLA). */
  terms?: number;
  /** Macrocells: outputs of the device, registered or buried. */
  macrocells?: number;
  /** Registered outputs. */
  registers?: number;
  /** Connected AND-plane literals in all. */
  literals?: number;
}

export interface FitInput {
  id: string;
  title?: string;
  prompt?: string;
  hints?: string[];
  explain?: string;
  device: FitDevice;
  /** What the source pane starts with. */
  start?: string;
  /** PLA only: start from a virgin device whose pins have the spec's names, to be programmed by clicking crossings. */
  blank?: boolean;
  spec: FitSpec;
  budget?: FitBudget;
  solution?: string;
  /** Which Studio panes to show (default: source, chip, report). */
  views?: string[];
}

export interface Resource {
  key: keyof FitBudget;
  label: string;
  used: number;
  budget?: number;
  ok: boolean;
}

/** One line of a failure table: the inputs, what the spec wanted, what the device gave. */
export interface FitRow {
  /** A step or cycle number, when there is a sequence. */
  step?: string;
  inputs: Record<string, string>;
  expected: Record<string, string>;
  got: Record<string, string>;
  differ: string[];
}

export interface FitOutcome {
  pass: boolean;
  /** Why the check could not run (the source does not fit, a pin of the spec is missing). */
  problems: string[];
  errors: SourceError[];
  functionOk: boolean;
  rows: FitRow[];
  /** How many input vectors (or cycles) were compared. */
  compared: number;
  resources: Resource[];
}

const bit = (v: unknown): string => (v === 0 || v === 1 ? String(v) : v === 'z' ? 'Z' : v === undefined ? '?' : String(v));

// ── Resources ───────────────────────────────────────────────────────────────────

export function resourcesOf(fit: DeviceFit, budget: FitBudget = {}): Resource[] {
  const net = fit.network;
  const byId = new Map<string, NetTerm>(net.terms.map((t) => [t.id, t]));
  const used = new Set<string>();
  for (const o of net.outputs) for (const id of o.terms) if (byId.get(id)?.kind !== 'false') used.add(id);
  const literals = [...used].reduce((s, id) => s + (byId.get(id)?.lits.length ?? 0), 0);
  const values: Record<keyof FitBudget, number> = {
    terms: used.size,
    macrocells: net.outputs.length,
    registers: net.outputs.filter((o) => o.ff !== 'comb').length,
    literals,
  };
  const labels: Record<keyof FitBudget, string> = { terms: 'Product terms', macrocells: 'Macrocells', registers: 'Registers', literals: 'Literals' };
  const keys: (keyof FitBudget)[] = ['terms', 'macrocells', 'registers', 'literals'];
  return keys
    .filter((k) => budget[k] !== undefined || k === 'terms' || k === 'macrocells')
    .map((k) => ({ key: k, label: labels[k], used: values[k], budget: budget[k], ok: budget[k] === undefined || values[k] <= budget[k]! }));
}

// ── The function ────────────────────────────────────────────────────────────────

const MAX_ROWS = 8;

function checkComb(fit: DeviceFit, spec: FitSpec): { ok: boolean; rows: FitRow[]; compared: number; problems: string[] } {
  const model = compileComb({ truthTable: spec.truthTable, expression: spec.expression, inputs: spec.inputs });
  const problems = [...model.problems];
  const runner = fit.runner();
  const have = new Set(fit.network.outputs.map((o) => o.name));
  for (const o of model.outputs) if (!have.has(o)) problems.push(`The device has no output called ${o}. Its outputs are ${[...have].join(', ') || '(none)'}.`);
  if (problems.length) return { ok: false, rows: [], compared: 0, problems };
  const n = model.inputs.length;
  const rows: FitRow[] = [];
  let bad = 0;
  for (let v = 0; v < 1 << n; v++) {
    const bits = model.inputs.map((_, i) => (v >> (n - 1 - i)) & 1);
    const want = model.expected(bits);
    const state = runner.evaluate(Object.fromEntries(model.inputs.map((name, i) => [name, bits[i]!])));
    const differ = model.outputs.filter((o, i) => want[i] !== null && state.signals[o] !== want[i]);
    if (differ.length) {
      bad++;
      if (rows.length < MAX_ROWS) {
        rows.push({
          inputs: Object.fromEntries(model.inputs.map((name, i) => [name, String(bits[i])])),
          expected: Object.fromEntries(model.outputs.map((o, i) => [o, want[i] === null ? 'x' : String(want[i])])),
          got: Object.fromEntries(model.outputs.map((o) => [o, bit(state.signals[o])])),
          differ,
        });
      }
    }
  }
  return { ok: bad === 0, rows, compared: 1 << n, problems };
}

function checkSteps(fit: DeviceFit, spec: FitSpec): { ok: boolean; rows: FitRow[]; compared: number; problems: string[] } {
  const steps = spec.steps ?? [];
  const runner = fit.runner();
  const outputs = new Set(fit.network.outputs.map((o) => o.name));
  const problems: string[] = [];
  for (const s of steps) for (const o of Object.keys(expandBuses(s.expect, spec.buses))) if (!outputs.has(o)) problems.push(`The device has no output called ${o}. Its outputs are ${[...outputs].join(', ') || '(none)'}.`);
  if (problems.length) return { ok: false, rows: [], compared: 0, problems: [...new Set(problems)] };
  let inputs: Record<string, number> = {};
  runner.powerUp();
  const rows: FitRow[] = [];
  let compared = 0;
  steps.forEach((s, i) => {
    inputs = { ...inputs, ...(expandBuses(s.set, spec.buses) as Record<string, number>) };
    let state = runner.evaluate(inputs);
    for (let c = 0; c < (s.clock ?? 0); c++) state = runner.clock(inputs);
    if (s.clock) state = runner.evaluate(inputs);
    compared++;
    const want = Object.entries(expandBuses(s.expect, spec.buses));
    const differ = want.filter(([o, v]) => state.signals[o] !== (v === 'z' || v === 'Z' ? 'z' : v)).map(([o]) => o);
    if (differ.length && rows.length < MAX_ROWS) {
      rows.push({
        step: s.name ?? `step ${i + 1}${s.clock ? ` (after ${s.clock} clock edge${s.clock === 1 ? '' : 's'})` : ''}`,
        inputs: Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, String(v)])),
        expected: Object.fromEntries(want.map(([o, v]) => [o, String(v)])),
        got: Object.fromEntries(want.map(([o]) => [o, bit(state.signals[o])])),
        differ,
      });
    }
  });
  return { ok: rows.length === 0, rows, compared, problems };
}

function checkFsm(fit: DeviceFit, fsm: FsmInput): { ok: boolean; rows: FitRow[]; compared: number; problems: string[] } {
  let ref: FsmMachine;
  try {
    ref = new FsmMachine(fsm);
  } catch (e) {
    return { ok: false, rows: [], compared: 0, problems: [`The exercise's state machine is wrong: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const outputs = new Set(fit.network.outputs.map((o) => o.name));
  const problems = fsm.outputs.filter((o) => !outputs.has(o)).map((o) => `The device has no output called ${o}. Its outputs are ${[...outputs].join(', ') || '(none)'}.`);
  if (problems.length) return { ok: false, rows: [], compared: 0, problems };
  const runner = fit.runner();
  const n = fsm.inputs.length;
  const rand = rng(99);
  let compared = 0;
  const bad = (a: OutVal[], b: Record<string, unknown>) => fsm.outputs.some((o, i) => a[i] !== null && a[i] !== undefined && b[o] !== a[i]);
  /** Runs `seq` from power-up in lock step; returns the failing rows (the cycles up to the first mismatch). */
  const run = (seq: number[][]): FitRow[] | undefined => {
    ref.reset();
    runner.powerUp();
    const trail: FitRow[] = [];
    for (let c = 0; c < seq.length; c++) {
      const inputs = Object.fromEntries(fsm.inputs.map((name, i) => [name, seq[c]![i]!]));
      const want = ref.cycle(seq[c]!);
      const pre = runner.evaluate(inputs).signals;
      const post = runner.clock(inputs).signals;
      compared++;
      const rowFor = (phase: string, w: OutVal[], g: Record<string, unknown>): FitRow => ({
        step: `cycle ${c + 1}, ${phase} the clock edge`,
        inputs: Object.fromEntries(fsm.inputs.map((name, i) => [name, String(seq[c]![i])])),
        expected: Object.fromEntries(fsm.outputs.map((o, i) => [o, w[i] === null || w[i] === undefined ? 'x' : String(w[i])])),
        got: Object.fromEntries(fsm.outputs.map((o) => [o, bit(g[o])])),
        differ: fsm.outputs.filter((o, i) => w[i] !== null && w[i] !== undefined && g[o] !== w[i]),
      });
      const cycleRows = (tail: FitRow) => [...trail.slice(-(MAX_ROWS - 1)), tail];
      if (bad(want.pre, pre)) return cycleRows(rowFor('before', want.pre, pre));
      if (bad(want.post, post)) return cycleRows(rowFor('after', want.post, post));
      trail.push(rowFor('after', want.post, post));
    }
    return undefined;
  };
  // Every input sequence of up to a few cycles, then random ones.
  const depth = n === 0 ? 1 : Math.min(6, Math.max(1, Math.floor(12 / n)));
  const all = Array.from({ length: 1 << n }, (_, i) => Array.from({ length: n }, (_, k) => (i >> (n - 1 - k)) & 1));
  for (let d = 1; d <= depth && n > 0; d++) {
    const total = all.length ** d;
    for (let k = 0; k < total; k++) {
      const seq: number[][] = [];
      let rest = k;
      for (let j = 0; j < d; j++) {
        seq.push(all[rest % all.length]!);
        rest = Math.floor(rest / all.length);
      }
      const r = run(seq);
      if (r) return { ok: false, rows: r, compared, problems: [] };
    }
  }
  for (let r = 0; r < 40; r++) {
    const seq = Array.from({ length: 60 }, () => Array.from({ length: n }, () => (rand() < 0.5 ? 1 : 0)));
    const res = run(seq);
    if (res) return { ok: false, rows: res, compared, problems: [] };
  }
  return { ok: true, rows: [], compared, problems: [] };
}

// ── The check ────────────────────────────────────────────────────────────────

/** Check a configured device against the exercise's specification and budget. */
export function checkFit(input: FitInput, fit: DeviceFit): FitOutcome {
  const resources = resourcesOf(fit, input.budget);
  const spec = input.spec;
  let r: { ok: boolean; rows: FitRow[]; compared: number; problems: string[] };
  try {
    r = spec.fsm ? checkFsm(fit, spec.fsm) : spec.steps ? checkSteps(fit, spec) : checkComb(fit, spec);
  } catch (e) {
    r = { ok: false, rows: [], compared: 0, problems: [e instanceof Error ? e.message : String(e)] };
  }
  const withinBudget = resources.every((x) => x.ok);
  return { pass: r.ok && withinBudget && r.problems.length === 0, problems: r.problems, errors: [], functionOk: r.ok, rows: r.rows, compared: r.compared, resources };
}

/** Program the exercise's device from source text and check it: what the Check button does for a typed design. */
export function checkFitSource(input: FitInput, source: string): FitOutcome {
  const adapter = getAdapter(input.device);
  if (!adapter) return { pass: false, problems: [`Unknown device ${input.device}.`], errors: [], functionOk: false, rows: [], compared: 0, resources: [] };
  const r = adapter.program(source);
  if (!r.ok) return { pass: false, problems: [], errors: r.errors, functionOk: false, rows: [], compared: 0, resources: [] };
  return checkFit(input, r.fit);
}
