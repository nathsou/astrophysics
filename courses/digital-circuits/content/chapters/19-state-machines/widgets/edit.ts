/**
 * The editing operations of the FSM designer, as pure functions from one machine to the next, so the buttons
 * and forms of the widget stay thin and every rule (unique names, arrows follow renames, the first state is the
 * reset state) is tested.
 */
import { dashes, LIMITS, zeros, type Fsm, type FsmState, type FsmTransition } from './fsm';

const withOut = (fsm: Fsm, n: number): string => zeros(n) || '';

/** A fresh state name not used yet: S0, S1, … */
export function freshName(fsm: Fsm, prefix = 'S'): string {
  const used = new Set(fsm.states.map((s) => s.name.toLowerCase()));
  for (let i = 0; ; i++) if (!used.has(`${prefix}${i}`.toLowerCase())) return `${prefix}${i}`;
}

export function addState(fsm: Fsm, name?: string): Fsm {
  if (fsm.states.length >= LIMITS.states) return fsm;
  const s: FsmState = { name: (name ?? '').trim() || freshName(fsm), out: withOut(fsm, fsm.outputs.length) };
  return { ...fsm, states: [...fsm.states, s] };
}

export function removeState(fsm: Fsm, name: string): Fsm {
  if (fsm.states.length <= 1) return fsm;
  return { ...fsm, states: fsm.states.filter((s) => s.name !== name), transitions: fsm.transitions.filter((t) => t.from !== name && t.to !== name) };
}

/** Rename a state; arrows follow. An empty or duplicate name is refused (the machine is returned unchanged). */
export function renameState(fsm: Fsm, from: string, to: string): Fsm {
  const name = to.trim();
  if (!name || name === from) return fsm;
  if (fsm.states.some((s) => s.name.toLowerCase() === name.toLowerCase() && s.name !== from)) return fsm;
  return {
    ...fsm,
    states: fsm.states.map((s) => (s.name === from ? { ...s, name } : s)),
    transitions: fsm.transitions.map((t) => ({ ...t, from: t.from === from ? name : t.from, to: t.to === from ? name : t.to })),
  };
}

/** Make a state the reset state by moving it to the front. */
export function makeReset(fsm: Fsm, name: string): Fsm {
  const s = fsm.states.find((x) => x.name === name);
  if (!s) return fsm;
  return { ...fsm, states: [s, ...fsm.states.filter((x) => x !== s)] };
}

/** Move a state up (−1) or down (+1) the list, which is the order of the binary and Gray codes. */
export function moveState(fsm: Fsm, name: string, by: -1 | 1): Fsm {
  const i = fsm.states.findIndex((s) => s.name === name);
  const j = i + by;
  if (i < 0 || j < 0 || j >= fsm.states.length) return fsm;
  const states = fsm.states.slice();
  [states[i], states[j]] = [states[j]!, states[i]!];
  return { ...fsm, states };
}

/** Set one Moore output bit of a state. */
export function setStateOutput(fsm: Fsm, name: string, bit: number, value: boolean): Fsm {
  return { ...fsm, states: fsm.states.map((s) => (s.name === name ? { ...s, out: setBit(s.out, bit, value) } : s)) };
}

const setBit = (bits: string, i: number, v: boolean): string => bits.slice(0, i) + (v ? '1' : '0') + bits.slice(i + 1);

export function addTransition(fsm: Fsm, t: FsmTransition): Fsm {
  const out = fsm.kind === 'mealy' ? (t.out ?? zeros(fsm.outputs.length)) : undefined;
  const dup = fsm.transitions.some((x) => x.from === t.from && x.to === t.to && x.when === t.when && x.out === out);
  if (dup) return fsm;
  return { ...fsm, transitions: [...fsm.transitions, { ...t, out }] };
}

export function removeTransition(fsm: Fsm, index: number): Fsm {
  return { ...fsm, transitions: fsm.transitions.filter((_, i) => i !== index) };
}

export function setTransitionOutput(fsm: Fsm, index: number, bit: number, value: boolean): Fsm {
  return { ...fsm, transitions: fsm.transitions.map((t, i) => (i === index ? { ...t, out: setBit(t.out ?? zeros(fsm.outputs.length), bit, value) } : t)) };
}

// ── Ports ──────────────────────────────────────────────────────────────────────

export function addInput(fsm: Fsm, name: string): Fsm {
  if (fsm.inputs.length >= LIMITS.inputs) return fsm;
  const n = name.trim() || `in${fsm.inputs.length}`;
  return { ...fsm, inputs: [...fsm.inputs, n], transitions: fsm.transitions.map((t) => ({ ...t, when: t.when + '-' })) };
}

export function removeInput(fsm: Fsm, index: number): Fsm {
  if (index < 0 || index >= fsm.inputs.length) return fsm;
  // Arrows that depended on the input for their pattern would change meaning: they lose the column.
  return { ...fsm, inputs: fsm.inputs.filter((_, i) => i !== index), transitions: fsm.transitions.map((t) => ({ ...t, when: t.when.slice(0, index) + t.when.slice(index + 1) })) };
}

export function renameInput(fsm: Fsm, index: number, name: string): Fsm {
  const n = name.trim();
  if (!n) return fsm;
  return { ...fsm, inputs: fsm.inputs.map((x, i) => (i === index ? n : x)) };
}

export function addOutput(fsm: Fsm, name: string): Fsm {
  if (fsm.outputs.length >= LIMITS.outputs) return fsm;
  const n = name.trim() || `out${fsm.outputs.length}`;
  return { ...fsm, outputs: [...fsm.outputs, n], states: fsm.states.map((s) => ({ ...s, out: s.out + '0' })), transitions: fsm.transitions.map((t) => (t.out !== undefined ? { ...t, out: t.out + '0' } : t)) };
}

export function removeOutput(fsm: Fsm, index: number): Fsm {
  if (fsm.outputs.length <= 1 || index < 0 || index >= fsm.outputs.length) return fsm;
  const cut = (b: string) => b.slice(0, index) + b.slice(index + 1);
  return { ...fsm, outputs: fsm.outputs.filter((_, i) => i !== index), states: fsm.states.map((s) => ({ ...s, out: cut(s.out) })), transitions: fsm.transitions.map((t) => (t.out !== undefined ? { ...t, out: cut(t.out) } : t)) };
}

export function renameOutput(fsm: Fsm, index: number, name: string): Fsm {
  const n = name.trim();
  if (!n) return fsm;
  return { ...fsm, outputs: fsm.outputs.map((x, i) => (i === index ? n : x)) };
}

/** Set a character of a transition's input pattern (a select in the form of the widget). */
export function setPatternChar(pattern: string, index: number, c: '0' | '1' | '-'): string {
  return pattern.slice(0, index) + c + pattern.slice(index + 1);
}

/** A new arrow's default: from the first state to the second, whatever the inputs. */
export function defaultTransition(fsm: Fsm): FsmTransition {
  const from = fsm.states[0]?.name ?? '';
  const to = fsm.states[Math.min(1, fsm.states.length - 1)]?.name ?? from;
  return { from, to, when: dashes(fsm.inputs.length), out: fsm.kind === 'mealy' ? zeros(fsm.outputs.length) : undefined };
}
