/**
 * Clocking the synthesised logic. The widget keeps a state *code* (what the flip-flops hold); each clock edge
 * evaluates the minimised equations for the outputs of this cycle and the next code, and checks the result
 * against the diagram's own `step`, so a mistake in synthesis could never go unseen.
 */
import { step } from './fsm';
import { evalLogic, stateOfCode, type Synthesis } from './synth';

export interface Cycle {
  /** Number of the clock edge that ends this cycle (1 for the first). */
  n: number;
  inputs: number[];
  /** The state during the cycle, and the flip-flops' code. */
  state: string;
  code: number;
  /** The outputs during the cycle (before the edge), from the logic. */
  out: string;
  /** The state after the edge. */
  next: string;
  nextCode: number;
  /** True when the logic and the diagram agree on both the outputs and the next state. */
  agrees: boolean;
}

export const resetCode = (s: Synthesis): number => s.codes.code[s.fsm.states[0]!.name]!;

/** The outputs the logic shows right now, for the current inputs (before any edge). */
export function outputsNow(s: Synthesis, code: number, inputs: readonly number[]): string {
  return evalLogic(s, code, inputs).out;
}

export function clock(s: Synthesis, code: number, inputs: readonly number[], n: number): Cycle {
  const state = stateOfCode(s, code) ?? '?';
  const logic = evalLogic(s, code, inputs);
  const want = state === '?' ? undefined : step(s.fsm, state, inputs);
  const next = stateOfCode(s, logic.next) ?? '?';
  return {
    n, inputs: [...inputs], state, code, out: logic.out, next, nextCode: logic.next,
    agrees: !!want && want.out === logic.out && want.next === next,
  };
}
