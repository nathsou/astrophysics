/**
 * What a `build`, `debug` or `golf` exercise is made of, and how it is checked: normalising the YAML
 * block, the starting circuit, the allowed parts and budget, and running the right checker.
 * Pure TypeScript (no Svelte): the components are thin shells around it.
 */
import type { Circuit, EngineKind } from '$lib/sim/netlist/types';
import type { SubResolver } from '$lib/sim/netlist/connect';
import {
  checkCombinational,
  checkScenarios,
  checkSequential,
  CircuitBench,
  DEFAULT_CLOCK,
  seqClock,
  compileComb,
  costOf,
  type CombResult,
  type CombSpec,
  type Cost,
  type FsmInput,
  type Scenario,
  type ScenarioResult,
  type SeqResult,
  type SeqSpec,
} from '$lib/sim/check';
import { getPart, referenceOf } from '$lib/partsbin/parts';
import { checkPart, portsOf } from '$lib/partsbin/verify';

/** How the YAML block describes the specification. */
export interface SpecInput {
  truthTable?: CombSpec['truthTable'];
  expression?: CombSpec['expression'];
  /** Input order for an expression. */
  inputs?: string[];
  /** A reference circuit, or the id of a part in the parts bin. */
  reference?: Circuit | string;
  /** A state machine table (see `FsmInput`). */
  fsm?: FsmInput;
  /** Scenarios for analogue circuits: set switches, expect lit LEDs and levels. */
  scenarios?: Scenario[];
  /** Sequential options. */
  clock?: string | false;
  reset?: SeqSpec['reset'];
  warmup?: number;
  cycles?: number;
  /** Engine to simulate on (default: the circuit's own). */
  engine?: EngineKind;
  /** Seconds to settle in scenario checks. */
  settle?: number;
  /** Input patterns never applied (sequential). */
  forbidden?: Record<string, number>[];
}

export interface BuildInput {
  id: string;
  title?: string;
  prompt?: string;
  hints?: string[];
  explain?: string;
  /** Parts-bin id: the spec and pins default to the part's, and passing stores the circuit in the bin. */
  part?: string;
  spec?: SpecInput;
  /** Component catalog types the palette offers (`part:*` allows every part). */
  allowed?: string[];
  budget?: { gates?: number; transistors?: number; depth?: number };
  /** Golf: the par, in the chosen metric. */
  par?: number;
  metric?: 'gates' | 'transistors';
  start?: Circuit;
  solution?: Circuit;
  /** Debug: what the fault is, shown after solving. */
  fault?: string;
}

/** Always allowed, whatever the exercise says: they only make connections or show values. */
export const ALWAYS = new Set(['port', 'label', 'ground', 'rail', 'toggle', 'button', 'clock', 'const', 'indicator', 'probe']);

export const DEFAULT_ALLOWED = ['not', 'and', 'or', 'nand', 'nor', 'xor', 'xnor', 'buffer'];

/** The palette: the block's `allowed` list, else the basic gates plus whatever the starting circuit already uses. */
export function allowedTypes(input: BuildInput): string[] {
  if (input.allowed) return input.allowed;
  const used = (input.start?.components ?? []).map((c) => c.type).filter((t) => !ALWAYS.has(t));
  return [...new Set([...DEFAULT_ALLOWED, ...used])];
}

/** Component types in the circuit that the exercise does not allow, and any budget it exceeds. */
export function violations(input: BuildInput, circuit: Circuit, cost?: Cost): string[] {
  const allowed = new Set(allowedTypes(input));
  const out: string[] = [];
  const bad = new Set<string>();
  const anyPart = allowed.has('part:*');
  for (const c of circuit.components) {
    if (ALWAYS.has(c.type) || allowed.has(c.type)) continue;
    if (c.type.startsWith('part:') && anyPart) continue;
    bad.add(c.type);
  }
  if (bad.size) out.push(`Not allowed here: ${[...bad].map((t) => t.replace(/^part:/, '')).join(', ')}.`);
  const b = input.budget;
  if (b && cost) {
    if (b.gates !== undefined && cost.gates > b.gates) out.push(`Uses ${cost.gates} gates; the budget is ${b.gates}.`);
    if (b.transistors !== undefined && cost.transistors > b.transistors) out.push(`Uses about ${cost.transistors} transistors; the budget is ${b.transistors}.`);
    if (b.depth !== undefined && cost.depth > b.depth) out.push(`Logic depth ${cost.depth}; the limit is ${b.depth}.`);
  }
  return out;
}

// ── The starting circuit ───────────────────────────────────────────────────────

/** A circuit holding just the ports: inputs down the left, outputs down the right. */
export function portsStart(inputs: string[], outputs: string[], title?: string): Circuit {
  const rows = Math.max(inputs.length, outputs.length);
  const pitch = rows > 6 ? 3 : 4;
  return {
    version: 1,
    title,
    engine: 'digital',
    components: [
      ...inputs.map((name, i) => ({ id: name, type: 'port', x: 6, y: 2 + i * pitch, params: { name, dir: 'in' }, label: '' })),
      ...outputs.map((name, i) => ({ id: name, type: 'port', x: 32, y: 2 + i * pitch, flip: true, params: { name, dir: 'out' }, label: '' })),
    ],
    wires: [],
  };
}

/** What the reader's circuit must expose, from the spec. */
export function pinsOfSpec(input: BuildInput): { inputs: string[]; outputs: string[] } | undefined {
  const part = input.part ? getPart(input.part) : undefined;
  if (part && !input.spec) return { inputs: part.pins.filter((p) => p.dir === 'in').map((p) => p.name), outputs: part.pins.filter((p) => p.dir === 'out').map((p) => p.name) };
  const s = input.spec;
  if (!s) return undefined;
  try {
    if (s.fsm) {
      const clock = s.clock === false ? [] : [typeof s.clock === 'string' ? s.clock : DEFAULT_CLOCK];
      const reset = typeof s.reset === 'string' ? [s.reset] : s.reset ? [s.reset.pin] : [];
      return { inputs: [...s.fsm.inputs, ...clock, ...reset.filter((r) => !s.fsm!.inputs.includes(r))], outputs: s.fsm.outputs };
    }
    const ref = typeof s.reference === 'string' ? (referenceOf(s.reference) ?? undefined) : s.reference;
    if (ref) {
      const p = portsOf(ref);
      if (p.inputs.length || p.outputs.length) return p;
    }
    if (s.truthTable || s.expression) {
      const m = compileComb({ truthTable: s.truthTable, expression: s.expression, inputs: s.inputs });
      return { inputs: m.inputs, outputs: m.outputs };
    }
  } catch {
    /* an invalid spec is reported when the exercise is checked */
  }
  return undefined;
}

/** The circuit the reader starts from: the block's `start`, or ports for the spec's pins. */
export function startCircuit(input: BuildInput): Circuit {
  if (input.start) return input.start;
  const pins = pinsOfSpec(input);
  const part = input.part ? getPart(input.part) : undefined;
  return portsStart(pins?.inputs ?? [], pins?.outputs ?? [], part?.name ?? input.title);
}

// ── Checking ───────────────────────────────────────────────────────────────────

export interface Outcome {
  pass: boolean;
  /** One line for the reader. */
  headline: string;
  /** What is wrong with the circuit or the way it was checked. */
  problems: string[];
  violations: string[];
  comb?: CombResult;
  seq?: SeqResult;
  scenarios?: ScenarioResult;
  cost?: Cost;
  /** Did the checker's verdict (ignoring budget and allowed parts) come out right? */
  correct: boolean;
}

function specKind(input: BuildInput, parts?: SubResolver): 'part' | 'comb' | 'seq' | 'scenarios' | 'none' {
  const s = input.spec;
  if (!s) return input.part && getPart(input.part)?.check ? 'part' : 'none';
  if (s.scenarios) return 'scenarios';
  if (s.fsm) return 'seq';
  if (typeof s.reference === 'string') {
    const c = getPart(s.reference)?.check;
    return c?.kind === 'seq' ? 'seq' : 'comb';
  }
  if (s.reference) return s.clock !== undefined || s.reset !== undefined || hasClock(s.reference, parts) ? 'seq' : 'comb';
  return 'comb';
}

/** A reference circuit is sequential when a component in it has a clock pin (a port's name proves nothing). */
function hasClock(c: Circuit, parts?: SubResolver): boolean {
  try {
    return new CircuitBench(c, { parts }).clockInputs.length > 0;
  } catch {
    return c.components.some((x) => /^(dff|dffr|dffe|jkff|tff|register|counter|shift-register|lfsr|ram)$/.test(x.type));
  }
}

/**
 * The input a sequential exercise is clocked by (the live "Pulse" button drives it): the block's `clock`, else
 * the spec's (a part's check, an fsm's `CLK`, the reference circuit's clock pin). Undefined for combinational
 * and level-sensitive exercises: an input called `C` is data.
 */
export function exerciseClock(input: BuildInput, parts?: SubResolver): string | undefined {
  try {
    const s = input.spec;
    const partId = s ? (typeof s.reference === 'string' ? s.reference : undefined) : input.part;
    const check = partId ? getPart(partId)?.check : undefined;
    let base: Pick<SeqSpec, 'clock' | 'fsm' | 'model' | 'reference'>;
    if (check?.kind === 'seq') base = check.spec;
    else if (s?.fsm) base = { fsm: s.fsm };
    else if (s?.reference && typeof s.reference !== 'string' && specKind(input, parts) === 'seq') base = { reference: s.reference };
    else return undefined;
    return seqClock({ ...base, ...(s?.clock !== undefined ? { clock: s.clock } : {}) }, parts);
  } catch {
    return undefined;
  }
}

export function runCheck(input: BuildInput, circuit: Circuit, parts?: SubResolver): Outcome {
  const kind = specKind(input, parts);
  let cost: Cost | undefined;
  try {
    cost = costOf(circuit, parts);
  } catch {
    /* an unknown part: the checker reports it */
  }
  const viol = violations(input, circuit, cost);
  const base = { violations: viol, cost };
  const s = input.spec;
  try {
    if (kind === 'none') return { ...base, pass: false, correct: false, headline: 'This exercise has no specification.', problems: ['The exercise block needs a part or a spec.'] };
    if (kind === 'part') {
      const r = checkPart(input.part!, circuit, parts, { maxFailures: 64 });
      const problems = r.problems;
      return finish(base, r.pass, problems, { comb: r.comb, seq: r.seq }, viol);
    }
    if (kind === 'scenarios') {
      const r = checkScenarios(circuit, s!.scenarios!, { engine: s!.engine, parts });
      return finish(base, r.pass, r.problems, { scenarios: r }, viol);
    }
    if (kind === 'comb') {
      const ref = typeof s!.reference === 'string' ? referenceOf(s!.reference) : s!.reference;
      const r = checkCombinational(circuit, { truthTable: s!.truthTable, expression: s!.expression, inputs: s!.inputs, reference: ref }, { parts, engine: s!.engine, maxFailures: 64 });
      return finish(base, r.pass, r.problems, { comb: r }, viol);
    }
    // sequential
    const ref = typeof s!.reference === 'string' ? referenceOf(s!.reference) : s!.reference;
    const partSeq = typeof s!.reference === 'string' && getPart(s!.reference)?.check?.kind === 'seq' ? (getPart(s!.reference)!.check as { kind: 'seq'; spec: SeqSpec }).spec : undefined;
    const spec: SeqSpec = {
      ...(partSeq ?? {}),
      ...(s!.fsm ? { fsm: s!.fsm } : partSeq?.model ? {} : { reference: ref }),
      ...(s!.clock !== undefined ? { clock: s!.clock } : {}),
      ...(s!.reset !== undefined ? { reset: s!.reset } : {}),
      ...(s!.warmup !== undefined ? { warmup: s!.warmup } : {}),
      ...(s!.cycles !== undefined ? { cycles: s!.cycles } : {}),
      ...(s!.forbidden ? { forbidden: s!.forbidden } : {}),
    };
    const r = checkSequential(circuit, spec, { parts });
    return finish(base, r.pass, r.problems, { seq: r }, viol);
  } catch (e) {
    return { ...base, pass: false, correct: false, headline: 'The checker could not run.', problems: [e instanceof Error ? e.message : String(e)] };
  }
}

function finish(base: { violations: string[]; cost?: Cost }, correct: boolean, problems: string[], extra: Partial<Outcome>, viol: string[]): Outcome {
  const pass = correct && viol.length === 0;
  let headline: string;
  if (pass) headline = 'It works.';
  else if (correct) headline = 'It behaves correctly, but breaks a rule of the exercise.';
  else if (problems.length && !extra.comb?.failures.length && !extra.seq?.counterexample && !extra.scenarios?.failures.length) headline = problems[0]!;
  else headline = 'Not yet.';
  return { ...base, ...extra, pass, correct, headline, problems };
}

// ── Golf ───────────────────────────────────────────────────────────────────────

export interface GolfScore {
  metric: 'gates' | 'transistors';
  value: number;
  par: number;
  /** Strokes over par (negative: under). */
  strokes: number;
  name: string;
}

export function golfName(strokes: number): string {
  if (strokes <= -3) return 'Albatross';
  return { '-2': 'Eagle', '-1': 'Birdie', '0': 'Par', '1': 'Bogey', '2': 'Double bogey', '3': 'Triple bogey' }[String(strokes)] ?? `+${strokes}`;
}

export function golfScore(input: Pick<BuildInput, 'par' | 'metric'>, cost: Cost): GolfScore | undefined {
  if (input.par === undefined) return undefined;
  const metric = input.metric ?? 'gates';
  const value = cost[metric];
  const strokes = value - input.par;
  return { metric, value, par: input.par, strokes, name: golfName(strokes) };
}

// ── Display helpers ────────────────────────────────────────────────────────────

/** The expected truth table of a combinational exercise (up to 5 inputs), for showing next to the result. */
export function tableFor(input: BuildInput, parts?: SubResolver): { inputs: string[]; outputs: string[]; rows: { inputs: number[]; outputs: (0 | 1 | null)[] }[] } | undefined {
  try {
    const s = input.spec;
    let spec: CombSpec | undefined;
    if (!s) {
      const c = input.part ? getPart(input.part)?.check : undefined;
      if (c?.kind === 'comb') spec = c.spec;
    } else if (s.truthTable || s.expression) spec = { truthTable: s.truthTable, expression: s.expression, inputs: s.inputs };
    else if (s.reference && specKind(input) === 'comb') spec = { reference: typeof s.reference === 'string' ? referenceOf(s.reference) : s.reference };
    else if (typeof s.reference === 'string') {
      const c = getPart(s.reference)?.check;
      if (c?.kind === 'comb') spec = c.spec;
    }
    if (!spec) return undefined;
    const m = compileComb(spec, { parts });
    if (m.inputs.length > 5) return undefined;
    return tableOfModel(m);
  } catch {
    return undefined;
  }
}

import { tableOf as tableOfModel } from '$lib/sim/check';
