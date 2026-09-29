/**
 * Checking sequential circuits: a circuit against a reference circuit or a finite-state-machine table.
 *
 * Both sides are wrapped as a `Machine`: reset it, feed it one input vector per clock cycle, read the
 * outputs before the rising edge (what a Mealy machine shows) and after it (what a Moore machine shows).
 * The checker first runs directed and seeded random stimulus in lock step, then, when the state space is
 * small, explores the product of the two machines breadth-first (replaying from reset to reach each
 * state), which gives the shortest counterexample and, if it finishes, a proof of equivalence over all
 * input sequences.
 */
import type { Circuit } from '../netlist/types';
import type { SubResolver } from '../netlist/connect';
import { CircuitBench } from './circuit';
import { rng } from './rng';
import type { Expect } from './spec';

/** Output value of a machine: 0, 1, 2 (X), 3 (Z), or null when nothing is specified. */
export type OutVal = 0 | 1 | 2 | 3 | null;

export interface Machine {
  readonly inputs: string[];
  readonly outputs: string[];
  /** Power up (and reset, if there is a reset pin), then run the warm-up vectors without comparing. */
  reset(warm: number[][]): void;
  /** One clock cycle with these inputs. `pre`: before the rising edge; `post`: after it. */
  cycle(vec: number[]): { pre: OutVal[]; post: OutVal[] };
  /** Identifies the internal state (for the product search). */
  signature(): string;
}

// ── FSM tables ─────────────────────────────────────────────────────────────────

/**
 * A state machine as authored:
 *
 *   type: moore
 *   inputs: [X]
 *   outputs: [Z]
 *   initial: S0
 *   states:
 *     S0: { out: "0", next: { "0": S0, "1": S1 } }
 *     S1: { out: "1", next: { "0": S0, "1": S1 } }
 *
 * `next` maps input bits (in the order of `inputs`, '-' matches either) to the next state. For a
 * Mealy machine (`type: mealy`) each target is `state/outputbits`, e.g. `"S1/0"`, and states have no `out`.
 */
export interface FsmInput {
  type?: 'moore' | 'mealy';
  inputs: string[];
  outputs: string[];
  initial: string;
  states: Record<string, { out?: string; next: Record<string, string> }>;
}

const outBits = (s: string | undefined, n: number, where: string): OutVal[] => {
  const t = String(s ?? '').replace(/[\s,]/g, '');
  if (t.length !== n) throw new Error(`${where}: expected ${n} output bit${n === 1 ? '' : 's'}, got "${s ?? ''}"`);
  return [...t].map((c) => (c === '0' ? 0 : c === '1' ? 1 : c === '-' || c === 'x' || c === 'X' ? null : (() => { throw new Error(`${where}: "${c}" is not 0, 1 or x`); })()));
};

interface Transition {
  pattern: string;
  to: string;
  out?: OutVal[];
}

export class FsmMachine implements Machine {
  readonly inputs: string[];
  readonly outputs: string[];
  readonly mealy: boolean;
  private readonly moore = new Map<string, OutVal[]>();
  private readonly trans = new Map<string, Transition[]>();
  private state: string;
  private readonly initial: string;

  constructor(fsm: FsmInput) {
    this.inputs = fsm.inputs;
    this.outputs = fsm.outputs;
    this.mealy = fsm.type === 'mealy';
    this.initial = this.state = fsm.initial;
    const ni = fsm.inputs.length;
    const no = fsm.outputs.length;
    if (!fsm.states[fsm.initial]) throw new Error(`the initial state ${fsm.initial} is not defined`);
    for (const [name, st] of Object.entries(fsm.states)) {
      if (!this.mealy) this.moore.set(name, outBits(st.out, no, `state ${name}`));
      const list: Transition[] = [];
      for (const [pattern, target] of Object.entries(st.next ?? {})) {
        const p = String(pattern).replace(/[\s,]/g, '');
        if (p.length !== ni || /[^01-]/.test(p)) throw new Error(`state ${name}: "${pattern}" is not ${ni} input bit${ni === 1 ? '' : 's'} (0, 1 or -)`);
        let to = String(target);
        let out: OutVal[] | undefined;
        if (this.mealy) {
          const [s, o] = to.split('/');
          to = s!.trim();
          out = outBits(o, no, `state ${name}, input ${pattern}`);
        }
        if (!fsm.states[to]) throw new Error(`state ${name}: the next state ${to} is not defined`);
        list.push({ pattern: p, to, out });
      }
      // Every input combination needs a transition.
      for (let i = 0; i < 1 << ni; i++) {
        const bits = Array.from({ length: ni }, (_, k) => String((i >> (ni - 1 - k)) & 1)).join('');
        if (!list.some((t) => matches(t.pattern, bits))) throw new Error(`state ${name} has no transition for input ${bits || '(none)'}`);
      }
      this.trans.set(name, list);
    }
  }

  reset(): void {
    this.state = this.initial;
  }

  cycle(vec: number[]): { pre: OutVal[]; post: OutVal[] } {
    const bits = vec.map((b) => (b ? '1' : '0')).join('');
    const list = this.trans.get(this.state)!;
    // An exact pattern beats a wildcard one.
    const t = list.find((x) => x.pattern === bits) ?? list.find((x) => matches(x.pattern, bits))!;
    const none = this.outputs.map(() => null);
    if (this.mealy) {
      this.state = t.to;
      return { pre: t.out!, post: none };
    }
    const pre = this.moore.get(this.state)!;
    this.state = t.to;
    return { pre, post: this.moore.get(this.state)! };
  }

  signature(): string {
    return this.state;
  }

  /** The current state (for tests and displays). */
  current(): string {
    return this.state;
  }
}

/**
 * A machine written as code (parts-bin specs: registers, counters, memories). `step` gets the state and
 * the input bits for one clock cycle and returns the next state, the outputs after the edge (`post`) and,
 * optionally, the outputs before it (`pre`, for asynchronous reads); null bits are don't-care.
 */
export interface SeqModel<S = unknown> {
  inputs: string[];
  outputs: string[];
  initial(): S;
  step(state: S, inputs: Record<string, number>): { next: S; pre?: (0 | 1 | null)[]; post: (0 | 1 | null)[] };
  key(state: S): string;
}

export class ModelMachine<S> implements Machine {
  readonly inputs: string[];
  readonly outputs: string[];
  private state: S;
  constructor(private readonly model: SeqModel<S>) {
    this.inputs = model.inputs;
    this.outputs = model.outputs;
    this.state = model.initial();
  }
  reset(): void {
    this.state = this.model.initial();
  }
  cycle(vec: number[]): { pre: OutVal[]; post: OutVal[] } {
    const r = this.model.step(this.state, Object.fromEntries(this.inputs.map((n, i) => [n, vec[i] ?? 0])));
    this.state = r.next;
    return { pre: r.pre ?? this.outputs.map(() => null), post: r.post };
  }
  signature(): string {
    return this.model.key(this.state);
  }
}

const matches = (pattern: string, bits: string) => [...pattern].every((c, i) => c === '-' || c === bits[i]);

// ── Circuits as machines ───────────────────────────────────────────────────────

export interface ResetSpec {
  pin: string;
  /** The level that resets (default: 1, or 0 for names ending in n, e.g. CLRn). */
  active?: 0 | 1;
  /** Clock cycles to hold it (default 2). */
  cycles?: number;
}

const CLOCK_NAMES = ['clk', 'ck', 'clock', 'c'];

export function findClock(names: string[]): string | undefined {
  for (const c of CLOCK_NAMES) {
    const hit = names.find((n) => n.toLowerCase() === c);
    if (hit) return hit;
  }
  return undefined;
}

export function normaliseReset(r: SeqSpec['reset']): ResetSpec | undefined {
  if (r === undefined || r === false) return undefined;
  const spec = typeof r === 'string' ? { pin: r } : r;
  const activeLow = /[a-z0-9]n$/.test(spec.pin) || /_n$/i.test(spec.pin);
  return { pin: spec.pin, active: spec.active ?? (activeLow ? 0 : 1), cycles: spec.cycles ?? 2 };
}

export class CircuitMachine implements Machine {
  readonly bench: CircuitBench;
  readonly outputs: string[];

  constructor(
    circuit: Circuit,
    readonly inputs: string[],
    outputs: string[],
    private readonly clock: string | undefined,
    private readonly reset_: ResetSpec | undefined,
    options: { parts?: SubResolver; expectation?: boolean } = {},
  ) {
    this.bench = new CircuitBench(circuit, { parts: options.parts });
    this.outputs = outputs;
    this.asExpectation = !!options.expectation;
  }
  private readonly asExpectation: boolean;

  private read(): OutVal[] {
    return this.outputs.map((o) => {
      const v = this.bench.get(o);
      return this.asExpectation && v > 1 ? null : v;
    });
  }

  private pulse(): void {
    if (!this.clock) return;
    this.bench.set(this.clock, 1);
    this.bench.settle();
    this.bench.set(this.clock, 0);
    this.bench.settle();
  }

  reset(warm: number[][]): void {
    this.bench.reset();
    const r = this.reset_;
    if (r) {
      this.bench.set(r.pin, r.active ?? 1);
      this.bench.settle();
      for (let i = 0; i < (r.cycles ?? 2); i++) this.pulse();
      this.bench.set(r.pin, r.active ? 0 : 1);
      this.bench.settle();
    }
    for (const v of warm) this.cycle(v);
  }

  cycle(vec: number[]): { pre: OutVal[]; post: OutVal[] } {
    const b = this.bench;
    this.inputs.forEach((n, i) => b.set(n, vec[i] ?? 0));
    b.settle();
    const pre = this.read();
    if (!this.clock) return { pre, post: pre };
    b.set(this.clock, 1);
    b.settle();
    const post = this.read();
    b.set(this.clock, 0);
    b.settle();
    return { pre, post };
  }

  signature(): string {
    const b = this.bench;
    if (this.clock) {
      // Inputs are not part of the state of a clocked circuit: park them at 0.
      for (const n of this.inputs) b.set(n, 0);
      if (this.reset_) b.set(this.reset_.pin, this.reset_.active ? 0 : 1);
      b.settle();
    }
    return b.signature();
  }
}

// ── The checker ────────────────────────────────────────────────────────────────

export interface SeqSpec {
  /** A reference circuit with the same pins. */
  reference?: Circuit;
  /** Or a state machine table. */
  fsm?: FsmInput;
  /** Code only: a machine written as a function (see SeqModel). */
  model?: SeqModel;
  /** Change only one input at a time between cycles (level-sensitive parts, where two simultaneous changes are a race). Skips the product search. */
  singleStep?: boolean;
  /** Input patterns never applied (an SR latch's S = R = 1): each is a partial `{ S: 1, R: 1 }`. */
  forbidden?: Record<string, number>[];
  /** An explicit start-up sequence (instead of random warm-up cycles) that brings both circuits to the same state. */
  init?: Record<string, number>[];
  /** Probability of each input being 1 in random cycles (default 0.5; a reset pin: 0.1). */
  bias?: Record<string, number>;
  /** Code only: shape the random cycles; return the inputs to override (e.g. keep RAM addresses in a small set). */
  stimulus?: (rand: () => number, cycle: number) => Record<string, number> | undefined;
  /** The clock input: a name, `false` for a level-sensitive circuit (latches), default: CLK / CK / C if there is one. */
  clock?: string | false;
  /** Pin that resets the circuit before checking (pulsed for a few cycles). */
  reset?: string | ResetSpec | false;
  /** Cycles of random input run before comparing, when there is no reset (default 2 without reset, 0 with). */
  warmup?: number;
  /** Random cycles after the directed ones (default 300). */
  cycles?: number;
  seed?: number;
  /** Explore the product machine breadth-first (default true when there are at most 6 inputs). */
  exhaustive?: boolean;
  /** Give up the product search after this many machine cycles (default 150 000). */
  budget?: number;
}

export interface SeqCounterexample {
  /** Input vectors from the (post-reset) start, the last one being where it went wrong. */
  sequence: Record<string, number>[];
  /** Index in `sequence` of the diverging cycle. */
  cycle: number;
  phase: 'before the clock edge' | 'after the clock edge';
  expected: Record<string, Expect>;
  got: Record<string, string>;
  wrong: string[];
}

export interface SeqResult {
  pass: boolean;
  problems: string[];
  /** Clock cycles compared. */
  cycles: number;
  /** The product search covered every reachable state pair: equivalent for all input sequences. */
  proven: boolean;
  /** Product states visited by the search. */
  states: number;
  counterexample?: SeqCounterexample;
}

const CH = ['0', '1', 'X', 'Z'];

export function checkSequential(circuit: Circuit, spec: SeqSpec, options: { parts?: SubResolver } = {}): SeqResult {
  const fail = (...problems: string[]): SeqResult => ({ pass: false, problems, cycles: 0, proven: false, states: 0 });
  const parts = options.parts;
  let ref: Machine;
  let cand: CircuitMachine;
  let stimulus: string[];
  let resetPin: string | undefined;
  try {
    const reset = normaliseReset(spec.reset);
    if (spec.fsm) {
      const fsm = new FsmMachine(spec.fsm);
      ref = fsm;
      stimulus = fsm.inputs;
    } else if (spec.model) {
      const m = new ModelMachine(spec.model);
      ref = m;
      stimulus = m.inputs;
    } else if (spec.reference) {
      const probe = new CircuitBench(spec.reference, { parts });
      const clock = spec.clock === false ? undefined : (spec.clock ?? findClock(probe.inputs));
      if (probe.problems.length) return fail(`The reference circuit has problems: ${probe.problems.join('; ')}`);
      stimulus = probe.inputs.filter((n) => n !== clock);
      ref = new CircuitMachine(spec.reference, stimulus, probe.outputs, clock, reset, { parts, expectation: true });
    } else return fail('A sequential specification needs a reference circuit, an fsm table or a model.');
    const probe = new CircuitBench(circuit, { parts });
    const clock = spec.clock === false ? undefined : (spec.clock ?? findClock(probe.inputs));
    const problems = [...probe.problems];
    for (const n of stimulus) if (!probe.hasInput(n)) problems.push(`The circuit has no input called ${n}.`);
    for (const n of ref.outputs) if (!probe.hasOutput(n)) problems.push(`The circuit has no output called ${n}.`);
    if (spec.clock !== false && !clock) problems.push('The circuit has no clock input (call it CLK).');
    else if (typeof spec.clock === 'string' && !probe.hasInput(spec.clock)) problems.push(`The circuit has no clock input called ${spec.clock}.`);
    if (reset && !probe.hasInput(reset.pin)) problems.push(`The circuit has no reset input called ${reset.pin}.`);
    if (problems.length) return fail(...problems);
    resetPin = reset?.pin;
    cand = new CircuitMachine(circuit, stimulus, ref.outputs, clock, reset, { parts });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  const n = stimulus.length;
  const rand = rng(spec.seed ?? 12345);
  const warmN = spec.warmup ?? (resetPin || spec.fsm || spec.model || spec.init ? 0 : 2);
  const forbidden = spec.forbidden ?? [];
  const isForbidden = (v: number[]) => forbidden.some((f) => Object.entries(f).every(([k, x]) => v[stimulus.indexOf(k)] === x));
  const warm = spec.init
    ? spec.init.map((r) => stimulus.map((n) => r[n] ?? 0))
    : Array.from({ length: warmN }, () => {
        for (let t = 0; t < 20; t++) {
          const v = stimulus.map(() => (rand() < 0.5 ? 1 : 0));
          if (!isForbidden(v)) return v;
        }
        return stimulus.map(() => 0);
      });

  const describe = (seq: number[][], cycle: number, phase: SeqCounterexample['phase'], want: OutVal[], have: OutVal[]): SeqCounterexample => {
    const wrong: string[] = [];
    want.forEach((w, i) => {
      if (w !== null && have[i] !== w) wrong.push(ref.outputs[i]!);
    });
    return {
      sequence: seq.map((v) => Object.fromEntries(stimulus.map((s, i) => [s, v[i]!]))),
      cycle,
      phase,
      expected: Object.fromEntries(ref.outputs.map((o, i) => [o, want[i] === null || want[i] === undefined ? null : (want[i] as Bit01)])),
      got: Object.fromEntries(ref.outputs.map((o, i) => [o, have[i] === null || have[i] === undefined ? '?' : CH[have[i]!]!])),
      wrong,
    };
  };
  const differs = (want: OutVal[], have: OutVal[]) => want.some((w, i) => w !== null && have[i] !== w);

  /** Step both machines through `seq`; return the first divergence. */
  const run = (seq: number[][]): SeqCounterexample | undefined => {
    for (let c = 0; c < seq.length; c++) {
      const a = ref.cycle(seq[c]!);
      const b = cand.cycle(seq[c]!);
      if (differs(a.pre, b.pre)) return describe(seq.slice(0, c + 1), c, 'before the clock edge', a.pre, b.pre);
      if (differs(a.post, b.post)) return describe(seq.slice(0, c + 1), c, 'after the clock edge', a.post, b.post);
    }
    return undefined;
  };
  const restart = () => {
    ref.reset(warm);
    cand.reset(warm);
  };

  // 1. The product machine, breadth-first: shortest counterexamples, and a proof when it finishes.
  let proven = false;
  let states = 0;
  if ((spec.exhaustive ?? true) && n <= 6 && !spec.singleStep) {
    let budget = spec.budget ?? 150_000;
    const all = Array.from({ length: 1 << n }, (_, i) => stimulus.map((_, k) => (i >> (n - 1 - k)) & 1)).filter((v) => !isForbidden(v));
    restart();
    const seen = new Set([`${ref.signature()}#${cand.signature()}`]);
    let frontier: number[][] = [[]];
    let complete = true;
    search: while (frontier.length) {
      const next: number[][] = [];
      for (const path of frontier) {
        for (let v = 0; v < all.length; v++) {
          budget -= path.length + 1;
          if (budget < 0) {
            complete = false;
            break search;
          }
          restart();
          for (const p of path) {
            ref.cycle(all[p]!);
            cand.cycle(all[p]!);
          }
          const step = [...path, v].map((i) => all[i]!);
          const a = ref.cycle(all[v]!);
          const b = cand.cycle(all[v]!);
          const c = path.length;
          if (differs(a.pre, b.pre)) return { pass: false, problems: [], cycles: 0, proven: false, states: seen.size, counterexample: describe(step, c, 'before the clock edge', a.pre, b.pre) };
          if (differs(a.post, b.post)) return { pass: false, problems: [], cycles: 0, proven: false, states: seen.size, counterexample: describe(step, c, 'after the clock edge', a.post, b.post) };
          const key = `${ref.signature()}#${cand.signature()}`;
          if (!seen.has(key)) {
            seen.add(key);
            if (seen.size > 4000) {
              complete = false;
              break search;
            }
            next.push([...path, v]);
          }
        }
      }
      frontier = next;
    }
    proven = complete;
    states = seen.size;
  }

  // 2. Directed and random stimulus (the only check when the state space is too big to search).
  const vectors: number[][] = [];
  const zeros = () => stimulus.map(() => 0);
  const ones = () => stimulus.map(() => 1);
  const p1 = stimulus.map((s) => spec.bias?.[s] ?? (resetPin === s && !spec.fsm ? 0.1 : 0.5));
  const total = spec.cycles ?? 300;
  if (spec.singleStep) {
    // A Gray-code walk through every input combination (up to 6 inputs), then a random walk.
    let cur = zeros();
    vectors.push(cur);
    for (let g = 1; g < 1 << Math.min(n, 6); g++) {
      const bit = 31 - Math.clz32(g & -g);
      cur = cur.slice();
      cur[n - 1 - bit] = cur[n - 1 - bit] ? 0 : 1;
      vectors.push(cur);
    }
    for (let i = 0; i < total; i++) {
      cur = cur.slice();
      const k = Math.floor(rand() * n);
      cur[k] = cur[k] ? 0 : 1;
      vectors.push(cur);
    }
  } else {
    vectors.push(zeros(), zeros(), ones(), ones(), zeros());
    for (let k = 0; k < n; k++) {
      const v = zeros();
      v[k] = 1;
      vectors.push(v, v, zeros());
      const w = ones();
      w[k] = 0;
      vectors.push(w, w, ones());
    }
    for (let i = 0; i < total; i++) {
      let v: number[] = stimulus.map((_, k) => (rand() < p1[k]! ? 1 : 0));
      const over = spec.stimulus?.(rand, i);
      if (over) v = v.map((b, k) => over[stimulus[k]!] ?? b);
      vectors.push(v);
    }
  }
  for (let i = vectors.length - 1; i >= 0; i--) if (isForbidden(vectors[i]!)) vectors.splice(i, 1);
  restart();
  const cx = run(vectors);
  if (cx) return { pass: false, problems: [], cycles: cx.cycle + 1, proven: false, states, counterexample: cx };
  const errors = cand.bench.errors();
  if (errors.length) return { pass: false, problems: errors.slice(0, 2), cycles: vectors.length, proven: false, states };
  return { pass: true, problems: [], cycles: vectors.length, proven, states };
}

type Bit01 = 0 | 1;
