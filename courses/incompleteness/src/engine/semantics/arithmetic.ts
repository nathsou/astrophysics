// The axioms of Q in finite structures (chapter "Models of Arithmetic").
//
// No finite structure is a model of Q: already Q1 (′ is injective) and Q2 (0 is not a
// successor) cannot both hold. Follow 0, 0′, 0′′, … in a finite structure M: some element must
// repeat. Let m_j be the first element equal to an earlier one, m_i (i < j).
//   – If i = 0, then m_{j−1}′ = m_j = 0: 0 is a successor, and Q2 fails at x = m_{j−1}.
//   – If i > 0, then m_{i−1}′ = m_i = m_j = m_{j−1}′ although m_{i−1} ≠ m_{j−1} (m_j is the
//     first repetition): ′ is not injective, and Q1 fails at x = m_{i−1}, y = m_{j−1}.
// (Equivalently: an injective function on a finite set is surjective, so 0 is in its range.)

import type { Formula } from '../syntax/ast.ts';
import { Q, Q_AXIOM_TEXT } from '../proof/q.ts';
import { variant } from './assignment.ts';
import { isModelOf, satisfies, trueIn, type ModelCheck } from './satisfaction.ts';
import { showElem, successorOrbit, type Elem, type Structure } from './structure.ts';
import { decisivePath, type Binding, type EvalOptions, type FormulaTrace } from './trace.ts';

/** Q1–Q8 as named sentences (from proof/q.ts). */
export function qSentences(): { name: string; formula: Formula; gloss: string }[] {
  const q = Q();
  return Q_AXIOM_TEXT.map(([name, , gloss]) => ({ name, formula: q.get(name)!, gloss }));
}

/** Which of Q1–Q8 hold in M, with traces and the first failing axiom's counterexample. */
export function checkQ(M: Structure, opts: EvalOptions = {}): ModelCheck {
  return isModelOf(M, qSentences(), opts);
}

export interface FiniteQFailure {
  /** The axiom that must fail, by the orbit argument. */
  axiom: 'Q1' | 'Q2';
  /** 0^M, (0^M)′, … up to (not including) the first repetition. */
  orbit: Elem[];
  /** Index i of the earlier occurrence of the first repeated element m_j (j = orbit.length). */
  repeatsAt: number;
  /** The counterexample the orbit argument produces: x for Q2; x and y for Q1. */
  elements: { x: Elem; y?: Elem };
  /** The argument, in words, for this structure. */
  argument: string;
  /** The trace of M ⊨ axiom (false), as the definition of satisfaction computes it. */
  trace: FormulaTrace<Elem>;
  /** The counterexample read off that trace (the first one in domain order). */
  counterexample: Binding<Elem>[];
  /** The trace of the axiom's matrix at the orbit argument's counterexample (false). */
  witnessTrace: FormulaTrace<Elem>;
}

/**
 * Why the finite structure M is not a model of Q: returns the axiom among Q1, Q2 that fails,
 * the counterexample found by following the successors of 0, and the satisfaction traces.
 * Returns an explanation instead if M does not interpret 0 and ′.
 */
export function finiteQ1Q2Failure(M: Structure, opts: EvalOptions = {}): FiniteQFailure | { fail: string } {
  const o = successorOrbit(M);
  if ('fail' in o) return { fail: `cannot follow 0, 0′, 0′′, …: ${o.fail}` };
  const { orbit, cycleStart: i } = o;
  const j = orbit.length;
  const show = showElem;
  const seq = orbit.map((m, k) => `m${k} = ${show(m)}`).join(', ');
  const rep = orbit[i];
  const q = Q();
  if (i === 0) {
    const x = orbit[j - 1];
    const ax = q.get('Q2')!;
    const trace = trueIn(M, ax, opts);
    const body = ax.k === 'forall' ? ax.body : ax;
    const witnessTrace = satisfies(M, variant(new Map(), 0, x), body, opts);
    return {
      axiom: 'Q2', orbit, repeatsAt: i, elements: { x },
      argument:
        `Following the successors of 0 in ${M.name}: ${seq}. The next one, ${show(x)}′, is ${show(rep)} = m0 = 0^${M.name}, ` +
        `which already occurred. So 0 is a successor: ${show(x)}′ = 0, and Q2 (∀x 0 ≠ x′) fails for x = ${show(x)}.`,
      trace, counterexample: decisivePath(trace).bindings, witnessTrace,
    };
  }
  const x = orbit[i - 1];
  const y = orbit[j - 1];
  const ax = q.get('Q1')!;
  const trace = trueIn(M, ax, opts);
  const body = ax.k === 'forall' && ax.body.k === 'forall' ? ax.body.body : ax;
  const witnessTrace = satisfies(M, variant(variant(new Map(), 0, x), 1, y), body, opts);
  return {
    axiom: 'Q1', orbit, repeatsAt: i, elements: { x, y },
    argument:
      `Following the successors of 0 in ${M.name}: ${seq}. The next one, ${show(y)}′, is ${show(rep)} = m${i}, which already occurred ` +
      `as the successor of m${i - 1} = ${show(x)}. So ${show(x)}′ = ${show(y)}′ although ${show(x)} ≠ ${show(y)}: ′ is not injective, ` +
      `and Q1 (∀x ∀y (x′ = y′ → x = y)) fails for x = ${show(x)}, y = ${show(y)}.`,
    trace, counterexample: decisivePath(trace).bindings, witnessTrace,
  };
}
