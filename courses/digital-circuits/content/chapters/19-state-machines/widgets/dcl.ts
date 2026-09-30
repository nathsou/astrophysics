/**
 * The DCL text of a drawn machine: an `enum` of states, one `reg`, and a `match` on it.
 *
 *     enum State { Red, RedAmber, Green, Amber }
 *     module TrafficLight(clk: clock, tick: bit) -> (red: bit, amber: bit, green: bit) {
 *       reg state: State = State.Red
 *       next state = match state { State.Red => if tick { State.RedAmber } else { State.Red }, … }
 *       red = state == State.Red || state == State.RedAmber
 *     }
 *
 * The encoding is not part of the machine's logic: it is one attribute on the enum (`@onehot`, `@gray`, or
 * none for binary), and the compiler does the rest. The text is already in the formatter's style (a test
 * checks that `format` leaves it alone), and a test compiles it and runs it against `step` for every encoding.
 */
import { format } from '$lib/hdl/format';
import { allInputs, cap, matches, mergePatterns, step, toSnake, type Fsm } from './fsm';
import type { Encoding } from './synth';

/** A state's name as an enum variant: the first letter capitalised. */
export const variant = cap;

/** A machine's title as a module name: `Traffic light` → `TrafficLight`. */
export function moduleName(title: string): string {
  const words = title.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let name = words.map((w) => w[0]!.toUpperCase() + (/^[A-Z]+$/.test(w) ? w.slice(1).toLowerCase() : w.slice(1))).join('');
  if (!name) name = 'Machine';
  if (/^[0-9]/.test(name)) name = 'M' + name;
  return name;
}

const ATTRIBUTE: Record<Encoding, string> = { binary: '', gray: '@gray ', onehot: '@onehot ' };

/** `tick`, `!tick`, `five && !ten`: the pattern as a Boolean expression (undefined when it matches every input). */
function guard(pattern: string, inputs: readonly string[]): string | undefined {
  const lits: string[] = [];
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '1') lits.push(toSnake(inputs[i]!));
    else if (pattern[i] === '0') lits.push('!' + toSnake(inputs[i]!));
  }
  return lits.length ? lits.join(' && ') : undefined;
}

/** The condition "the inputs are one of these combinations", as a sum of the fewest patterns the merge finds. */
function condition(minterms: string[], inputs: readonly string[]): string {
  const gs = mergePatterns(minterms).map((p) => guard(p, inputs) ?? '1');
  return gs.join(' || ');
}

/**
 * The next state from `from`: an `if` chain with one branch for each state it can go to, and the most common
 * destination (staying put, when it ties) as the final `else`.
 */
function nextExpr(fsm: Fsm, from: string): string {
  const byTarget = new Map<string, string[]>();
  for (const v of allInputs(fsm.inputs.length)) {
    const to = step(fsm, from, v).next;
    byTarget.set(to, [...(byTarget.get(to) ?? []), v.join('')]);
  }
  const targets = [...byTarget.keys()];
  // The default branch: the destination with the most input combinations, preferring to stay.
  const size = (t: string) => byTarget.get(t)!.length;
  const fallback = targets.reduce((best, t) => (size(t) > size(best) || (size(t) === size(best) && t === from) ? t : best), targets[0]!);
  const others = targets.filter((t) => t !== fallback);
  const target = (t: string) => `State.${variant(t)}`;
  if (!others.length) return target(fallback);
  return others.map((t, i) => `${i === 0 ? 'if' : ' else if'} ${condition(byTarget.get(t)!, fsm.inputs)} { ${target(t)} }`).join('') + ` else { ${target(fallback)} }`;
}

/** A Mealy output in a state: 1 for exactly the input combinations on which the machine takes an arrow that sets it. */
function mealyExpr(fsm: Fsm, from: string, o: number): string {
  const ones = allInputs(fsm.inputs.length).filter((v) => step(fsm, from, v).out[o] === '1');
  if (!ones.length) return '0';
  if (ones.length === 1 << fsm.inputs.length) return '1';
  return condition(ones.map((v) => v.join('')), fsm.inputs);
}

export function toDcl(fsm: Fsm, encoding: Encoding): string {
  const name = moduleName(fsm.title);
  const ins = fsm.inputs.map((i) => `${toSnake(i)}: bit`);
  const outs = fsm.outputs.map((o) => `${toSnake(o)}: bit`);
  const first = variant(fsm.states[0]!.name);
  const lines: string[] = [];
  const codeWord = encoding === 'binary' ? 'binary' : encoding === 'gray' ? 'Gray' : 'one-hot';
  lines.push(`/// ${fsm.title}: a ${fsm.kind === 'moore' ? 'Moore' : 'Mealy'} machine, states coded ${codeWord}.`);
  lines.push(`${ATTRIBUTE[encoding]}enum State { ${fsm.states.map((s) => variant(s.name)).join(', ')} }`);
  lines.push('');
  const header = `module ${name}(${['clk: clock', ...ins].join(', ')}) -> (${outs.join(', ')}) {`;
  if (header.length > 100) {
    lines.push(`module ${name}(`);
    lines.push(...['clk: clock', ...ins].map((p) => `  ${p},`));
    lines.push(') -> (');
    lines.push(...outs.map((p) => `  ${p},`));
    lines.push(') {');
  } else lines.push(header);
  lines.push(`  reg state: State = State.${first}`);
  lines.push('');
  lines.push('  next state = match state {');
  for (const s of fsm.states) lines.push(`    State.${variant(s.name)} => ${nextExpr(fsm, s.name)},`);
  lines.push('  }');
  fsm.outputs.forEach((o, k) => {
    const port = toSnake(o);
    if (fsm.kind === 'moore') {
      const on = fsm.states.filter((s) => s.out[k] === '1');
      const rhs = on.length === 0 ? '0' : on.length === fsm.states.length ? '1' : on.map((s) => `state == State.${variant(s.name)}`).join(' || ');
      lines.push(`  ${port} = ${rhs}`);
    } else {
      lines.push(`  ${port} = match state {`);
      for (const s of fsm.states) lines.push(`    State.${variant(s.name)} => ${mealyExpr(fsm, s.name, k)},`);
      lines.push('  }');
    }
  });
  lines.push('}');
  return format(lines.join('\n') + '\n');
}

// ── Stimulus, for the tests and the widget ─────────────────────────────────────

/** Every input combination, as the port values the DCL module takes. */
export const inputVectors = (fsm: Fsm): number[][] => allInputs(fsm.inputs.length);

export { matches };
