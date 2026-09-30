/**
 * A finite-state machine as the FSM designer draws it, and what it does.
 *
 *   inputs  x, y…        one bit each, read at every clock edge
 *   states  A, B, …      each with a name; a Moore machine also gives each state its output bits
 *   arrows  A ─ 1- → B   "when the inputs match the pattern (1, 0 or – for either), go to B"; a Mealy
 *                        machine also gives each arrow its output bits
 *
 * The rules that make the diagram a machine (so that a drawing always means something):
 *
 *  - Input combinations that no arrow leaves a state for keep the machine where it is (a Mealy
 *    machine outputs zeros meanwhile). "Nothing happens" needs no arrow.
 *  - Two arrows from a state that both match some input combination must agree on the target state
 *    and the outputs; otherwise the diagram is ambiguous (`validate` names the combination).
 *  - The first state in the list is the reset state, the one the register holds at power-up.
 *
 * Everything here is pure TypeScript, with tests in fsm.test.ts.
 */
import type { FsmInput } from '$lib/sim/check';

export type Kind = 'moore' | 'mealy';

export interface FsmState {
  name: string;
  /** Moore outputs while in this state: one '0'/'1' per output. Ignored for Mealy machines. */
  out: string;
}

export interface FsmTransition {
  from: string;
  to: string;
  /** One character per input: '1', '0', or '-' for either. */
  when: string;
  /** Mealy outputs while this arrow is taken: one '0'/'1' per output. Ignored for Moore machines. */
  out?: string;
}

export interface Fsm {
  title: string;
  kind: Kind;
  inputs: string[];
  outputs: string[];
  /** The first state is the reset state. */
  states: FsmState[];
  transitions: FsmTransition[];
}

export const LIMITS = { states: 12, inputs: 3, outputs: 5 } as const;

const IDENT = /^[A-Za-z][A-Za-z0-9_]*$/;

// ── Patterns ───────────────────────────────────────────────────────────────────

/** Does the input vector (bits, first input first) match a pattern? */
export function matches(pattern: string, bits: readonly number[]): boolean {
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c !== '-' && c !== String(bits[i] ?? 0)) return false;
  }
  return true;
}

/** Every input vector, in binary counting order with the first input most significant. */
export function allInputs(n: number): number[][] {
  return Array.from({ length: 1 << n }, (_, m) => Array.from({ length: n }, (_, i) => (m >> (n - 1 - i)) & 1));
}

export const zeros = (n: number): string => '0'.repeat(n);
export const dashes = (n: number): string => '-'.repeat(n);

/** A readable label for a pattern: `tick`, `!tick`, `x & !y`, or `any` when no input matters. */
export function guardText(pattern: string, inputs: readonly string[]): string {
  const lits: string[] = [];
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '1') lits.push(inputs[i]!);
    else if (pattern[i] === '0') lits.push('!' + inputs[i]!);
  }
  return lits.length ? lits.join(' & ') : 'any';
}

// ── Behaviour ──────────────────────────────────────────────────────────────────

export interface StepResult {
  /** The state after the clock edge. */
  next: string;
  /** The outputs during this cycle (before the edge): a Moore machine's depend on the state alone. */
  out: string;
  /** The arrow taken, or null when the machine stayed because none matched. */
  via: FsmTransition | null;
}

export const stateOf = (fsm: Fsm, name: string): FsmState | undefined => fsm.states.find((s) => s.name === name);

/** One clock cycle: the state and inputs in, the outputs of the cycle and the next state out. */
export function step(fsm: Fsm, state: string, bits: readonly number[]): StepResult {
  const t = fsm.transitions.find((x) => x.from === state && matches(x.when, bits)) ?? null;
  const next = t ? t.to : state;
  const out = fsm.kind === 'moore' ? (stateOf(fsm, state)?.out ?? zeros(fsm.outputs.length)) : t ? (t.out ?? zeros(fsm.outputs.length)) : zeros(fsm.outputs.length);
  return { next, out, via: t };
}

/** The states reachable from the reset state. */
export function reachable(fsm: Fsm): Set<string> {
  const seen = new Set<string>();
  if (!fsm.states.length) return seen;
  const stack = [fsm.states[0]!.name];
  const ins = allInputs(fsm.inputs.length);
  while (stack.length) {
    const s = stack.pop()!;
    if (seen.has(s)) continue;
    seen.add(s);
    for (const v of ins) stack.push(step(fsm, s, v).next);
  }
  return seen;
}

// ── Validation ─────────────────────────────────────────────────────────────────

export interface Problem {
  level: 'error' | 'warning';
  text: string;
}

/** DCL words that cannot be port or state names. */
const RESERVED = new Set(['module', 'top', 'fn', 'struct', 'enum', 'type', 'const', 'let', 'reg', 'mem', 'next', 'inst', 'for', 'in', 'if', 'else', 'match', 'on', 'test', 'sim', 'step', 'expect', 'print', 'bit', 'bits', 'signed', 'clock', 'int', 'clk', 'state', 'State']);

/** A state name as an enum variant: the first letter capitalised. */
export const cap = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
export const toSnake = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** What is wrong with a machine, in words a reader can act on. Errors block synthesis. */
export function validate(fsm: Fsm): Problem[] {
  const out: Problem[] = [];
  const err = (text: string) => out.push({ level: 'error', text });
  const warn = (text: string) => out.push({ level: 'warning', text });
  const ni = fsm.inputs.length;
  const no = fsm.outputs.length;
  if (fsm.states.length < 2) err('A machine needs at least two states.');
  if (fsm.states.length > LIMITS.states) err(`The designer takes at most ${LIMITS.states} states.`);
  if (ni > LIMITS.inputs) err(`The designer takes at most ${LIMITS.inputs} inputs.`);
  if (no > LIMITS.outputs) err(`The designer takes at most ${LIMITS.outputs} outputs.`);
  if (no < 1) err('A machine needs at least one output.');
  const seen = new Set<string>();
  for (const s of fsm.states) {
    if (!IDENT.test(s.name)) err(`“${s.name}” is not a state name: use letters, digits and underscores, starting with a letter.`);
    else if (cap(s.name) === 'State') err('“State” is the name of the enum; call the state something else.');
    const key = cap(s.name);
    if (seen.has(key)) err(`Two states are called ${s.name}.`);
    seen.add(key);
    if (fsm.kind === 'moore' && !new RegExp(`^[01]{${no}}$`).test(s.out)) err(`State ${s.name} needs ${no} output bit${no === 1 ? '' : 's'}.`);
  }
  const pins = new Set<string>();
  for (const name of [...fsm.inputs, ...fsm.outputs]) {
    if (!IDENT.test(name)) err(`“${name}” is not a signal name.`);
    else if (RESERVED.has(name) || RESERVED.has(toSnake(name))) err(`“${name}” is a reserved word.`);
    const key = toSnake(name);
    if (pins.has(key)) err(`Two signals are called ${name}.`);
    pins.add(key);
  }
  const names = new Set(fsm.states.map((s) => s.name));
  fsm.transitions.forEach((t, i) => {
    const where = `Arrow ${i + 1} (${t.from} → ${t.to})`;
    if (!names.has(t.from) || !names.has(t.to)) err(`${where} joins a state that does not exist.`);
    if (t.when.length !== ni || /[^01-]/.test(t.when)) err(`${where} needs a pattern of ${ni} characters, each 0, 1 or –.`);
    if (fsm.kind === 'mealy' && !new RegExp(`^[01]{${no}}$`).test(t.out ?? '')) err(`${where} needs ${no} output bit${no === 1 ? '' : 's'}.`);
  });
  if (out.some((p) => p.level === 'error')) return out;

  // Two arrows that both apply must agree.
  for (const s of fsm.states) {
    const mine = fsm.transitions.filter((t) => t.from === s.name);
    for (const v of allInputs(ni)) {
      const hit = mine.filter((t) => matches(t.when, v));
      const first = hit[0];
      if (!first) continue;
      const clash = hit.find((t) => t.to !== first.to || (fsm.kind === 'mealy' && t.out !== first.out));
      if (clash) {
        err(`In state ${s.name}, with ${ni ? v.map((b, i) => `${fsm.inputs[i]}=${b}`).join(' ') : 'no inputs'}, the arrows to ${first.to} and ${clash.to} both apply.`);
        break;
      }
    }
  }
  const reach = reachable(fsm);
  const lost = fsm.states.filter((s) => !reach.has(s.name)).map((s) => s.name);
  if (lost.length) warn(`${lost.join(', ')} can never be reached from the reset state ${fsm.states[0]!.name}.`);
  return out;
}

export const hasErrors = (p: Problem[]): boolean => p.some((x) => x.level === 'error');

// ── The state table ────────────────────────────────────────────────────────────

export interface TableRow {
  state: string;
  /** The input pattern this row stands for ('-' where the inputs do not matter). */
  when: string;
  next: string;
  out: string;
  /** True when no arrow applies and the machine stays. */
  implicit: boolean;
}

/** One row per arrow, plus one row per state for the inputs nothing leaves it for. */
export function stateTable(fsm: Fsm): TableRow[] {
  const rows: TableRow[] = [];
  const ni = fsm.inputs.length;
  for (const s of fsm.states) {
    for (const t of fsm.transitions.filter((x) => x.from === s.name)) {
      rows.push({ state: s.name, when: t.when, next: t.to, out: fsm.kind === 'moore' ? s.out : (t.out ?? zeros(fsm.outputs.length)), implicit: false });
    }
    const gap = allInputs(ni).filter((v) => !fsm.transitions.some((t) => t.from === s.name && matches(t.when, v)));
    if (gap.length) {
      const all = gap.length === 1 << ni;
      // Show the uncovered inputs as one row when they form a subcube, else as separate rows.
      const patterns = all ? [dashes(ni)] : mergePatterns(gap.map((v) => v.join('')));
      for (const p of patterns) rows.push({ state: s.name, when: p, next: s.name, out: fsm.kind === 'moore' ? s.out : zeros(fsm.outputs.length), implicit: true });
    }
  }
  return rows;
}

/** Greedy merge of input minterms into patterns with dashes (enough for at most three inputs). */
export function mergePatterns(minterms: string[]): string[] {
  let cur = [...new Set(minterms)];
  for (;;) {
    const used = new Set<string>();
    const next = new Set<string>();
    for (let i = 0; i < cur.length; i++) {
      for (let j = i + 1; j < cur.length; j++) {
        const a = cur[i]!;
        const b = cur[j]!;
        let diff = -1;
        let ok = true;
        for (let k = 0; k < a.length; k++) {
          if (a[k] !== b[k]) {
            if (diff >= 0 || a[k] === '-' || b[k] === '-') {
              ok = false;
              break;
            }
            diff = k;
          }
        }
        if (ok && diff >= 0) {
          next.add(a.slice(0, diff) + '-' + a.slice(diff + 1));
          used.add(a);
          used.add(b);
        }
      }
    }
    if (!next.size) return cur;
    cur = [...next, ...cur.filter((p) => !used.has(p))];
  }
}

// ── Conversions ────────────────────────────────────────────────────────────────

/**
 * Mealy → Moore: a Moore machine has to *be in* a state to show an output, so every (state, output on the
 * way in) pair that can occur becomes a state of its own. The Moore machine shows each output one clock
 * cycle later than the Mealy machine did, because the output now waits for the register.
 */
export function mealyToMoore(fsm: Fsm): Fsm {
  if (fsm.kind === 'moore') return fsm;
  const no = fsm.outputs.length;
  const key = (s: string, o: string) => `${s}_${o}`;
  const label = (s: string, o: string) => (o === zeros(no) ? s : `${s}_${o}`);
  const start = fsm.states[0]!.name;
  const states: FsmState[] = [];
  const transitions: FsmTransition[] = [];
  const seen = new Set<string>();
  const stack: [string, string][] = [[start, zeros(no)]];
  while (stack.length) {
    const [s, o] = stack.shift()!;
    if (seen.has(key(s, o))) continue;
    seen.add(key(s, o));
    states.push({ name: label(s, o), out: o });
    for (const t of fsm.transitions.filter((x) => x.from === s)) {
      const to = t.out ?? zeros(no);
      transitions.push({ from: label(s, o), to: label(t.to, to), when: t.when });
      stack.push([t.to, to]);
    }
    // Inputs with no arrow: stay in s, output zero.
    const gap = allInputs(fsm.inputs.length).filter((v) => !fsm.transitions.some((t) => t.from === s && matches(t.when, v)));
    for (const p of gap.length === 1 << fsm.inputs.length ? [dashes(fsm.inputs.length)] : mergePatterns(gap.map((v) => v.join('')))) {
      transitions.push({ from: label(s, o), to: label(s, zeros(no)), when: p });
      stack.push([s, zeros(no)]);
    }
  }
  // Drop duplicate arrows (the same pattern and target from the same state).
  const uniq = transitions.filter((t, i) => transitions.findIndex((u) => u.from === t.from && u.to === t.to && u.when === t.when) === i);
  return { ...fsm, title: fsm.title + ' (Moore)', kind: 'moore', states, transitions: uniq };
}

/**
 * Moore → Mealy: the output of the source state rides on every arrow that leaves it, including the holding
 * arrows that a Moore machine leaves implicit (a Mealy machine outputs zeros when nothing matches).
 */
export function mooreToMealy(fsm: Fsm): Fsm {
  if (fsm.kind === 'mealy') return fsm;
  const ni = fsm.inputs.length;
  const transitions: FsmTransition[] = [];
  for (const s of fsm.states) {
    for (const t of fsm.transitions.filter((x) => x.from === s.name)) transitions.push({ ...t, out: s.out });
    const gap = allInputs(ni).filter((v) => !fsm.transitions.some((t) => t.from === s.name && matches(t.when, v)));
    if (gap.length && s.out !== zeros(fsm.outputs.length)) {
      for (const p of gap.length === 1 << ni ? [dashes(ni)] : mergePatterns(gap.map((v) => v.join('')))) transitions.push({ from: s.name, to: s.name, when: p, out: s.out });
    }
  }
  return {
    ...fsm,
    title: fsm.title.replace(/ \(Moore\)$/, ''),
    kind: 'mealy',
    states: fsm.states.map((s) => ({ ...s, out: zeros(fsm.outputs.length) })),
    transitions,
  };
}

/**
 * The machine as the exercise checker's table (`spec.fsm` in `build` blocks), with every input combination
 * spelled out so the checker sees exactly what `step` does.
 */
export function toFsmInput(fsm: Fsm): FsmInput {
  const no = fsm.outputs.length;
  const states: FsmInput['states'] = {};
  for (const s of fsm.states) {
    const next: Record<string, string> = {};
    for (const v of allInputs(fsm.inputs.length)) {
      const r = step(fsm, s.name, v);
      next[v.join('')] = fsm.kind === 'mealy' ? `${r.next}/${r.out}` : r.next;
    }
    states[s.name] = fsm.kind === 'moore' ? { out: s.out || zeros(no), next } : { next };
  }
  return { type: fsm.kind, inputs: fsm.inputs, outputs: fsm.outputs, initial: fsm.states[0]!.name, states };
}
