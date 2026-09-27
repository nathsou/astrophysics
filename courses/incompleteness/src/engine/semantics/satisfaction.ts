// Value of terms and satisfaction of formulas in finite structures, with traces
// (sections "Satisfaction of a Formula in a Structure", "Variable Assignments" and
// "Semantic Notions").

import * as A from '../syntax/ast.ts';
import type { Formula, Term } from '../syntax/ast.ts';
import { freeVars } from '../syntax/ops.ts';
import { varName } from '../syntax/language.ts';
import { evaluate, type Nat } from '../numbers/nat.ts';
import { allAssignments, type Assignment } from './assignment.ts';
import {
  applyFn, describeConst, describeFn, describeRel, holdsRel, lookupConst, numeralIn, showElem, symKey,
  type Elem, type Structure,
} from './structure.ts';
import { decisivePath, evalFormulaIn, evalTermIn, makeCtx, type Binding, type EvalOptions, type FormulaTrace, type Interp, type TermTrace, type Truth } from './trace.ts';

/** The interpretation of a finite structure: quantifiers run through the whole domain. */
export function interpretation(M: Structure): Interp<Elem> {
  const n = M.domain.length;
  return {
    name: M.name,
    show: showElem,
    constant: (i) => lookupConst(M, i),
    apply: (arity, index, args) => applyFn(M, arity, index, args),
    holds: (arity, index, args) => holdsRel(M, arity, index, args),
    numeral: (value: Nat) => {
      const v = evaluate(value, 1 << 16);
      if (v === null) return { fail: 'the numeral is too large (or known by name only) to evaluate' };
      return numeralIn(M, v);
    },
    range: () => ({ elements: M.domain, count: n, description: `all ${n} element${n === 1 ? '' : 's'} of |${M.name}|` }),
  };
}

/** The value t^M[s] of a term, with the computation (Definition "Value of Terms"). */
export function evaluateTerm(M: Structure, s: Assignment<Elem>, t: Term): TermTrace<Elem> {
  return evalTermIn(makeCtx(interpretation(M)), t, s);
}

/**
 * Whether M ⊨ A[s], as a trace tree mirroring the recursive definition of satisfaction. The root's
 * `truth` is the answer. ⊤ and ↔ follow their definitions (¬⊥ and (B → C) ∧ (C → B)); named
 * formulas (`abbr`) cannot be evaluated and give 'unknown' with a reason, as do uninterpreted
 * symbols and variables that s does not assign.
 */
export function satisfies(M: Structure, s: Assignment<Elem>, A: Formula, opts: EvalOptions = {}): FormulaTrace<Elem> {
  return evalFormulaIn(makeCtx(interpretation(M), opts), A, s);
}

/**
 * For a sentence A: whether M ⊨ A. By the book's Proposition, M ⊨ A iff M ⊨ A[s] for any one
 * assignment s, so the empty assignment is used. A formula with free variables is not a
 * sentence; the result is then 'unknown' with that reason (use `satisfies` with an assignment).
 */
export function trueIn(M: Structure, A: Formula, opts: EvalOptions = {}): FormulaTrace<Elem> {
  const fv = [...freeVars(A)];
  if (fv.length > 0) {
    const t = satisfies(M, new Map(), A, { ...opts, maxSteps: 0 });
    const reason = `not a sentence: ${fv.map(varName).join(', ')} ${fv.length === 1 ? 'is' : 'are'} free, so M ⊨ A is only defined relative to an assignment`;
    return { ...t, truth: 'unknown', children: [], terms: [], clause: '(not a sentence)', detail: reason, reason };
  }
  return satisfies(M, new Map(), A, opts);
}

/** The non-logical symbols of A that M does not interpret (as descriptions). */
export function missingSymbols(M: Structure, F: Formula | Term): string[] {
  const out = new Set<string>();
  A.walk(F, (x) => {
    if (x.k === 'const' && !M.constants.has(x.index)) out.add(describeConst(x.index));
    if (x.k === 'numeral' && (!M.constants.has(0) || !M.functions.has(symKey(1, 0)))) out.add('0 and ′ (needed for numerals)');
    if (x.k === 'app' && !M.functions.has(symKey(x.arity, x.index))) out.add(describeFn(x.arity, x.index));
    if (x.k === 'pred' && !M.relations.has(symKey(x.arity, x.index))) out.add(describeRel(x.arity, x.index));
  });
  return [...out];
}

/**
 * The assignments to the free variables of A (or to `vars`) that satisfy A in M: the relation
 * A defines. There are |M|^n candidate assignments.
 */
export function extension(M: Structure, F: Formula, vars: readonly number[] = [...freeVars(F)].sort((a, b) => a - b)): Assignment<Elem>[] {
  const ctx = makeCtx(interpretation(M), { trace: false });
  return allAssignments(M.domain, vars).filter((s) => evalFormulaIn(ctx, F, s).truth === true);
}

export type NamedSentence = { name: string; formula: Formula };

export interface SentenceResult {
  name: string;
  formula: Formula;
  truth: Truth;
  trace: FormulaTrace<Elem>;
}

export interface ModelCheck {
  /** true iff M ⊨ Γ; false if some sentence is false in M; 'unknown' otherwise. */
  ok: Truth;
  results: SentenceResult[];
  /** The first sentence (in the given order) false in M, with its counterexample. */
  firstFailure?: SentenceResult & {
    /** The counterexample assignment read off the trace (e.g. x ↦ 4 for ∀x 0 ≠ x′ in ℤ_5). */
    counterexample: Binding<Elem>[];
    /** The subformula trace where the counterexample is decided (usually atomic). */
    leaf: FormulaTrace<Elem>;
  };
}

function toNamed(sentences: Iterable<Formula> | ReadonlyMap<string, Formula> | readonly NamedSentence[]): NamedSentence[] {
  if (sentences instanceof Map) return [...sentences.entries()].map(([name, formula]) => ({ name, formula }));
  const arr = [...(sentences as Iterable<Formula | NamedSentence>)];
  return arr.map((x, i) => ('formula' in x ? x : { name: `A${i + 1}`, formula: x }));
}

/**
 * Whether M ⊨ Γ (M satisfies every sentence in Γ), with a trace for each sentence and, if one
 * fails, the first failing sentence and its counterexample.
 */
export function isModelOf(
  M: Structure,
  sentences: Iterable<Formula> | ReadonlyMap<string, Formula> | readonly NamedSentence[],
  opts: EvalOptions & { stopAtFirstFailure?: boolean } = {},
): ModelCheck {
  const results: SentenceResult[] = [];
  let firstFailure: ModelCheck['firstFailure'];
  for (const { name, formula } of toNamed(sentences)) {
    const trace = trueIn(M, formula, opts);
    const r = { name, formula, truth: trace.truth, trace };
    results.push(r);
    if (trace.truth === false && !firstFailure) {
      const p = decisivePath(trace);
      firstFailure = { ...r, counterexample: p.bindings, leaf: p.leaf };
      if (opts.stopAtFirstFailure) break;
    }
  }
  const ok: Truth = firstFailure ? false : results.some((r) => r.truth === 'unknown') ? 'unknown' : true;
  return { ok, results, ...(firstFailure ? { firstFailure } : {}) };
}
