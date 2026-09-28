// Instances of the induction schema (section 1.2): building them, and the book's test for
// recognising them — which is why PA is axiomatizable although it has infinitely many axioms.

import type { Formula, NodeId } from './ast.ts';
import { and, forall, imp, succ, v, zero } from './ast.ts';
import { formulaEq, freeVars } from './ops.ts';
import { subst } from './subst.ts';
import { varName } from './language.ts';

/** ∀y1 … ∀yn ((A(0) ∧ ∀x (A(x) → A(x′))) → ∀x A(x)), the ys being the other free variables of A. */
export function inductionInstance(A: Formula, x: number): Formula {
  const ys = [...freeVars(A)].filter((y) => y !== x).sort((a, b) => a - b);
  const core = imp(and(subst(A, x, zero()), forall(v(x), imp(A, subst(A, x, succ(v(x)))))), forall(v(x), A));
  return ys.reduceRight<Formula>((acc, y) => forall(v(y), acc), core);
}

export interface InductionStep {
  text: string;
  ok: boolean;
  /** nodes of the candidate the step looks at */
  nodes: NodeId[];
}

export type InductionCheck =
  | { instance: true; A: Formula; x: number; ys: number[]; steps: InductionStep[] }
  | { instance: false; steps: InductionStep[] };

/** The book's procedure: strip the initial universal quantifiers, read A off the consequent,
 *  check the free variables, and compare the antecedent with the one A determines. */
export function recognizeInduction(B: Formula): InductionCheck {
  const steps: InductionStep[] = [];
  const fail = (text: string, nodes: NodeId[]): InductionCheck => {
    steps.push({ text, ok: false, nodes });
    return { instance: false, steps };
  };
  // The prefix ∀y1 … ∀yn: we do not know n yet, so try every split of the leading ∀s.
  const prefix: { v: number; id: NodeId }[] = [];
  let body: Formula = B;
  const bodies: { ys: number[]; body: Formula }[] = [{ ys: [], body: B }];
  while (body.k === 'forall') {
    prefix.push({ v: body.v.index, id: body.id });
    body = body.body;
    bodies.push({ ys: prefix.map((p) => p.v), body });
  }
  steps.push({ text: `B begins with ${prefix.length} universal quantifier${prefix.length === 1 ? '' : 's'}${prefix.length ? ` (${prefix.map((p) => '∀' + varName(p.v)).join(' ')})` : ''}.`, ok: true, nodes: prefix.map((p) => p.id) });
  // The core is the innermost conditional reached by stripping; the ∀ quantifiers after the
  // prefix belong to the core only if the core is not itself a conditional, so take the longest
  // prefix whose body is a conditional.
  const cand = [...bodies].reverse().find((b) => b.body.k === 'imp');
  if (!cand || cand.body.k !== 'imp') return fail('After the quantifiers there is no conditional, so B is not an instance.', [body.id]);
  const core = cand.body;
  const ys = cand.ys;
  steps.push({ text: `After ${ys.length ? ys.map((y) => '∀' + varName(y)).join(' ') : 'no quantifiers'}, B is a conditional.`, ok: true, nodes: [core.id] });
  const cons = core.b;
  if (cons.k !== 'forall') return fail('Its consequent is not of the form ∀x A(x).', [cons.id]);
  const x = cons.v.index;
  const A = cons.body;
  steps.push({ text: `The consequent is ∀${varName(x)} A(${varName(x)}), which fixes A(${varName(x)}).`, ok: true, nodes: [cons.id, A.id] });
  const fv = freeVars(A);
  const others = [...fv].filter((y) => y !== x).sort((a, b) => a - b);
  const ysSorted = [...new Set(ys)].sort((a, b) => a - b);
  if (others.length !== ysSorted.length || others.some((y, i) => y !== ysSorted[i]) || ysSorted.length !== ys.length)
    return fail(
      `The free variables of A other than ${varName(x)} are {${others.map(varName).join(', ')}}, but the initial quantifiers bind {${ys.map(varName).join(', ')}}.`,
      [A.id, ...prefix.map((p) => p.id)],
    );
  steps.push({ text: `The free variables of A besides ${varName(x)} are exactly those bound by the initial quantifiers.`, ok: true, nodes: [A.id] });
  const expected = and(subst(A, x, zero()), forall(v(x), imp(A, subst(A, x, succ(v(x))))));
  if (!formulaEq(core.a, expected)) return fail(`The antecedent is not A(0) ∧ ∀${varName(x)} (A(${varName(x)}) → A(${varName(x)}′)).`, [core.a.id]);
  steps.push({ text: `The antecedent is A(0) ∧ ∀${varName(x)} (A(${varName(x)}) → A(${varName(x)}′)).`, ok: true, nodes: [core.a.id] });
  return { instance: true, A, x, ys, steps };
}
