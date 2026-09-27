// The standard model ℕ of arithmetic, and the Δ0 / Σ1 / Π1 formulas of section
// "Σ1 Completeness":
//
//   A bounded existential formula is one of the form ∃x (x < t ∧ A(x)), written ∃x < t A(x);
//   a bounded universal formula is one of the form ∀x (x < t → A(x)), written ∀x < t A(x).
//   A formula is Δ0 if it is built up from atomic formulas using only propositional
//   connectives and bounded quantification. It is Σ1 if it is ∃x B(x) with B Δ0, and Π1 if it
//   is ∀x B(x) with B Δ0.
//
// Conventions of this implementation:
//   – the shapes are recognised literally in the AST: ∀x (x < t → B) and ∃x (x < t ∧ B), with
//     x itself on the left of <; the book says "t is any term", but x must not occur in t (so
//     that the bound does not depend on x) for the quantifier to be bounded — otherwise, e.g.
//     ∀x (x < x′ → B) quantifies over all of ℕ;
//   – ↔ and ⊤ count as propositional connectives (they abbreviate formulas built with ∧, →, ¬, ⊥);
//   – only the symbols of L_A (0, ′, +, ×, <) and numerals are allowed; named formulas (abbr)
//     are not Δ0 since their definitions are not given.
//
// Δ0 formulas are decided exactly in ℕ: a bounded quantifier needs only the x-variants below
// the value of its bound. For Σ1 formulas ∃x B(x), evaluateInN searches for a witness below a
// limit; failing to find one proves nothing, so the answer is then 'unknown', never false.

import type { Formula, NodeId, Term } from '../syntax/ast.ts';
import { freeVars } from '../syntax/ops.ts';
import { constName, fnName, predName, varName } from '../syntax/language.ts';
import { formulaText, termText } from '../syntax/print.ts';
import { evaluate } from '../numbers/nat.ts';
import { variant, type Assignment } from './assignment.ts';
import { evalFormulaIn, evalTermIn, makeCtx, type EvalOptions, type FormulaTrace, type Interp, type QuantifierInfo, type TermTrace, type Truth, type VariantTry } from './trace.ts';

// ------------------------------------------------------------------ bounded quantifiers

export interface BoundedForm {
  kind: 'forall' | 'exists';
  variable: number;
  /** The bound t in ∀x < t / ∃x < t. */
  bound: Term;
  /** A(x) in ∀x (x < t → A(x)) / ∃x (x < t ∧ A(x)). */
  body: Formula;
}

/**
 * If A is ∀x (x < t → B) or ∃x (x < t ∧ B) with x not occurring in t, its parts; otherwise why not
 * (or null if A is not a quantified formula at all).
 */
export function boundedForm(A: Formula): BoundedForm | { reason: string } | null {
  if (A.k !== 'forall' && A.k !== 'exists') return null;
  const x = A.v.index;
  const xn = varName(x);
  const q = A.k === 'forall' ? '∀' : '∃';
  const conn = A.k === 'forall' ? 'imp' : 'and';
  const connText = A.k === 'forall' ? '→' : '∧';
  const shape = `${q}${xn} (${xn} < t ${connText} …)`;
  const b = A.body;
  const isLessX = (f: Formula): f is Formula & { k: 'pred' } => f.k === 'pred' && f.arity === 2 && f.index === 0 && f.args[0].k === 'var' && f.args[0].index === x;
  if (b.k !== conn || !isLessX(b.a)) {
    // A helpful hint for ∃x ((x < t ∧ B) ∧ C), which ∧'s left-associativity produces.
    if (A.k === 'exists' && b.k === 'and') {
      let l: Formula = b;
      while (l.k === 'and') l = l.a;
      if (isLessX(l)) return { reason: `${q}${xn} … is not literally of the bounded form ${shape}: the conjunct ${xn} < t is nested; write it as ∃${xn} (${xn} < t ∧ (…))` };
    }
    return { reason: `${q}${xn} … is not of the bounded form ${shape}, so it is an unbounded quantifier` };
  }
  const t = b.a.args[1];
  if (freeVars(t).has(x)) return { reason: `in ${q}${xn} (${xn} < ${termText(t)} ${connText} …) the bound ${termText(t)} contains ${xn} itself, so the quantifier is not bounded` };
  return { kind: A.k, variable: x, bound: t, body: b.b };
}

// ------------------------------------------------------------------ classification

export type Level = 'Δ0' | 'Σ1' | 'Π1' | 'other';

export interface Classification {
  level: Level;
  explanation: string;
  /** The bounded quantifiers (node ids) in the Δ0 part. */
  bounded: NodeId[];
  /** For Σ1 / Π1: the unbounded quantifier in front. */
  unbounded?: { node: NodeId; variable: number; kind: 'forall' | 'exists' };
  /** For 'other': the node that is in the way, and why. */
  problem?: { node: NodeId; reason: string };
}

function termProblem(t: Term): { node: NodeId; reason: string } | null {
  switch (t.k) {
    case 'var':
    case 'numeral':
      return null;
    case 'const':
      return t.index === 0 ? null : { node: t.id, reason: `the constant ${constName(t.index)} is not a symbol of the language of arithmetic` };
    case 'app': {
      const ok = (t.arity === 1 && t.index === 0) || (t.arity === 2 && (t.index === 0 || t.index === 1));
      if (!ok) return { node: t.id, reason: `the function symbol ${fnName(t.arity, t.index)} is not a symbol of the language of arithmetic` };
      for (const a of t.args) {
        const p = termProblem(a);
        if (p) return p;
      }
      return null;
    }
  }
}

/** Whether A is Δ0; if so, its bounded quantifiers, otherwise the first obstacle. */
export function delta0(A: Formula): { ok: true; bounded: NodeId[] } | { ok: false; node: NodeId; reason: string } {
  const bounded: NodeId[] = [];
  const go = (f: Formula): { node: NodeId; reason: string } | null => {
    switch (f.k) {
      case 'bot':
      case 'top':
        return null;
      case 'eq':
        return termProblem(f.l) ?? termProblem(f.r);
      case 'pred':
        if (!(f.arity === 2 && f.index === 0)) return { node: f.id, reason: `the predicate symbol ${predName(f.arity, f.index)} is not a symbol of the language of arithmetic` };
        return termProblem(f.args[0]) ?? termProblem(f.args[1]);
      case 'abbr':
        return { node: f.id, reason: `${f.name}(…) is a named formula whose definition is not given here, so its form cannot be checked` };
      case 'not':
        return go(f.a);
      case 'and':
      case 'or':
      case 'imp':
      case 'iff':
        return go(f.a) ?? go(f.b);
      case 'forall':
      case 'exists': {
        const b = boundedForm(f);
        if (!b || 'reason' in b) return { node: f.id, reason: b ? b.reason : 'unbounded quantifier' };
        bounded.push(f.id);
        return termProblem(b.bound) ?? go(b.body);
      }
    }
  };
  const p = go(A);
  return p ? { ok: false, ...p } : { ok: true, bounded };
}

/** Classifies A as Δ0, Σ1, Π1 (by the book's definitions, literally) or none of these, with an explanation. */
export function classify(A: Formula): Classification {
  const d = delta0(A);
  if (d.ok) {
    const n = d.bounded.length;
    return {
      level: 'Δ0',
      bounded: d.bounded,
      explanation:
        n === 0
          ? 'Δ₀: built from atomic formulas using only propositional connectives (no quantifiers).'
          : `Δ₀: built from atomic formulas using propositional connectives and ${n} bounded quantifier${n === 1 ? '' : 's'} (∀x (x < t → …) or ∃x (x < t ∧ …)).`,
    };
  }
  if (A.k === 'exists' || A.k === 'forall') {
    const inner = delta0(A.body);
    const xn = varName(A.v.index);
    const [level, sym, dual] = A.k === 'exists' ? (['Σ1', '∃', 'Σ₁'] as const) : (['Π1', '∀', 'Π₁'] as const);
    if (inner.ok) {
      return {
        level,
        bounded: inner.bounded,
        unbounded: { node: A.id, variable: A.v.index, kind: A.k },
        explanation: `${dual}: of the form ${sym}${xn} B with B Δ₀ (one unbounded ${sym} in front${inner.bounded.length ? `, ${inner.bounded.length} bounded quantifier${inner.bounded.length === 1 ? '' : 's'} in B` : ''}).`,
      };
    }
    const nested = A.body.k === A.k && delta0(A.body.body).ok;
    return {
      level: 'other',
      bounded: [],
      problem: { node: inner.node, reason: inner.reason },
      explanation: nested
        ? `Not ${dual} by the book's definition: it has more than one unbounded ${sym} in front (${sym}${xn} ${sym}… B). The book's ${dual} formulas have exactly one; this one is equivalent to a ${dual} formula (code the variables as one), but is not literally of that form.`
        : `Not Δ₀, Σ₁ or Π₁: it is ${sym}${xn} B, but B is not Δ₀ — ${inner.reason}.`,
    };
  }
  return {
    level: 'other',
    bounded: [],
    problem: { node: d.node, reason: d.reason },
    explanation: `Not Δ₀, Σ₁ or Π₁: ${d.reason}${A.k === 'not' || A.k === 'and' || A.k === 'or' || A.k === 'imp' || A.k === 'iff' ? ' (an unbounded quantifier inside a connective)' : ''}.`,
  };
}

// ------------------------------------------------------------------ ℕ

export interface NOptions extends EvalOptions {
  /** Refuse to compute numbers with more bits than this (default 4096). */
  maxBits?: number;
  /** Refuse bounded quantifiers whose bound exceeds this (default 100,000). */
  maxBound?: number;
  /** For Σ1/Π1 formulas: search x = 0, 1, …, limit − 1 (default 1000). */
  limit?: number | bigint;
}

/** The standard model: ℕ with 0, successor, +, × and < as usual; quantifiers only if bounded. */
export function standardInterpretation(opts: NOptions = {}): Interp<bigint> {
  const maxBits = opts.maxBits ?? 4096;
  const maxBound = opts.maxBound ?? 100_000;
  const big = (v: bigint) => (v.toString(2).length > maxBits ? { fail: `the value has more than ${maxBits} bits` } : v);
  return {
    name: 'ℕ',
    show: (e) => e.toString(),
    constant: (i) => (i === 0 ? 0n : { fail: `ℕ interprets only the constant 0; ${constName(i)} is not a symbol of the language of arithmetic` }),
    apply: (arity, index, [a, b]) => {
      if (arity === 1 && index === 0) return big(a + 1n);
      if (arity === 2 && index === 0) return big(a + b);
      if (arity === 2 && index === 1) return big(a * b);
      return { fail: `ℕ does not interpret the function symbol ${fnName(arity, index)} (not in the language of arithmetic)` };
    },
    holds: (arity, index, [a, b]) => (arity === 2 && index === 0 ? a < b : { fail: `ℕ does not interpret the predicate symbol ${predName(arity, index)} (not in the language of arithmetic)` }),
    numeral: (value) => {
      const v = evaluate(value, maxBits);
      return v === null ? { fail: `the numeral is too large to evaluate (more than ${maxBits} bits, or known by name only)` } : v;
    },
    range: (q, _s, evalTerm) => {
      const b = boundedForm(q);
      if (!b || 'reason' in b) {
        return { fail: `${b ? b.reason : 'unbounded quantifier'}: ℕ has infinitely many ${varName(q.v.index)}-variants, so this cannot be decided by running through them` };
      }
      const bound = evalTerm(b.bound);
      if (bound.value === null) return { fail: `the bound ${bound.text} has no value: ${bound.reason}` };
      const n = bound.value;
      if (n > BigInt(maxBound)) return { fail: `the bound ${bound.text} has value ${n}, more than the ${maxBound} x-variants this evaluator is willing to try` };
      const xn = varName(b.variable);
      return {
        elements: (function* () {
          for (let m = 0n; m < n; m++) yield m;
        })(),
        count: Number(n),
        bound,
        description: n === 0n ? `no numbers (the bound ${bound.text} has value 0)` : `0, …, ${n - 1n} (the numbers below the value ${n} of ${bound.text})`,
        rest:
          b.kind === 'forall'
            ? `for ${xn} ≥ ${n} the antecedent ${xn} < ${bound.text} is not satisfied, so those ${xn}-variants satisfy the conditional`
            : `for ${xn} ≥ ${n} the conjunct ${xn} < ${bound.text} is not satisfied, so those ${xn}-variants do not satisfy the conjunction`,
      };
    },
  };
}

type NAssignment = Assignment<bigint> | ReadonlyMap<number, number | bigint>;
const toBig = (s: NAssignment): Assignment<bigint> => new Map([...s.entries()].map(([k, v]) => [k, BigInt(v)]));

/** The value t^ℕ[s] of a term, with the computation (numerals via nat.ts `evaluate`). */
export function evaluateTermInN(t: Term, s: NAssignment = new Map(), opts: NOptions = {}): TermTrace<bigint> {
  return evalTermIn(makeCtx(standardInterpretation(opts)), t, toBig(s));
}

export interface NResult {
  classification: Classification;
  /** true / false only when established; 'unknown' otherwise (e.g. no Σ1 witness found yet). */
  truth: Truth;
  /** "true", "false", "true (witness found: x = 3)", "no witness below 1000", … */
  message: string;
  trace?: FormulaTrace<bigint>;
  witness?: bigint;
  counterexample?: bigint;
  /** For Σ1/Π1 searches without result: how many values were tried (0, …, searched − 1). */
  searched?: bigint;
}

/**
 * Evaluates A in ℕ under s. Δ0 formulas are decided exactly, with a trace. For a Σ1 formula
 * ∃x B the values x = 0, 1, … below `limit` are tried: it reports 'true (witness found: x = n)'
 * or 'no witness below N' (truth 'unknown' — never false). Dually, for a Π1 formula ∀x B a
 * counterexample is searched: 'false (counterexample found: …)' or 'no counterexample below N'.
 * Other formulas are not evaluated.
 */
export function evaluateInN(A: Formula, s: NAssignment = new Map(), opts: NOptions = {}): NResult {
  const classification = classify(A);
  const sb = toBig(s);
  const missing = [...freeVars(A)].filter((x) => !sb.has(x));
  if (missing.length > 0) {
    return { classification, truth: 'unknown', message: `unknown: the assignment gives no value to ${missing.map(varName).join(', ')}` };
  }
  const I = standardInterpretation(opts);
  if (classification.level === 'Δ0') {
    const trace = evalFormulaIn(makeCtx(I, opts), A, sb);
    return { classification, truth: trace.truth, trace, message: trace.truth === 'unknown' ? `unknown: ${trace.reason}` : String(trace.truth) };
  }
  if (classification.level === 'other') {
    return { classification, truth: 'unknown', message: `not evaluated: ${classification.explanation}` };
  }
  // Σ1 or Π1: search.
  const q = A as Formula & { k: 'forall' | 'exists' };
  const x = q.v.index;
  const xn = varName(x);
  const all = q.k === 'forall';
  const limit = BigInt(opts.limit ?? 1000);
  const quiet = makeCtx(I, { ...opts, trace: false });
  const variants: VariantTry<bigint>[] = [];
  const clause = all
    ? `∀${xn} B (Π₁: one unbounded ∀): satisfied iff every ${xn}-variant satisfies B; searching ${xn} = 0, 1, … for a counterexample`
    : `∃${xn} B (Σ₁: one unbounded ∃): satisfied iff some ${xn}-variant satisfies B; searching ${xn} = 0, 1, … for a witness`;
  const node = (truth: Truth, detail: string, quantifier: QuantifierInfo<bigint>, children: FormulaTrace<bigint>[], reason?: string): FormulaTrace<bigint> => ({
    kind: 'formula', node: A.id, formula: A, text: formulaText(A), truth, clause, detail, assignment: sb, terms: [], children, quantifier,
    ...(reason !== undefined ? { reason } : {}),
  });
  for (let m = 0n; m < limit; m++) {
    const sm = variant(sb, x, m);
    const r = evalFormulaIn(quiet, q.body, sm);
    if (r.truth === 'unknown') {
      variants.push({ element: m, truth: 'unknown', trace: null });
      const reason = `B is unknown for ${xn} = ${m}: ${r.reason}`;
      const trace = node('unknown', reason, { kind: q.k, variable: x, variants, range: `0, …, ${m}` }, [], reason);
      return { classification, truth: 'unknown', trace, message: `unknown: ${reason}` };
    }
    if (r.truth === !all) {
      const full = evalFormulaIn(makeCtx(I, opts), q.body, sm);
      variants.push({ element: m, truth: r.truth, trace: full });
      const quantifier: QuantifierInfo<bigint> = { kind: q.k, variable: x, variants, range: `0, …, ${m} (searched in order)`, ...(all ? { counterexample: m } : { witness: m }) };
      const detail = all ? `counterexample: the ${xn}-variant s[${m}/${xn}] does not satisfy B` : `witness: the ${xn}-variant s[${m}/${xn}] satisfies B`;
      const trace = node(!all, detail, quantifier, [full]);
      return all
        ? { classification, truth: false, trace, counterexample: m, message: `false (counterexample found: ${xn} = ${m})` }
        : { classification, truth: true, trace, witness: m, message: `true (witness found: ${xn} = ${m})` };
    }
    variants.push({ element: m, truth: r.truth, trace: null });
  }
  const detail = all
    ? `no counterexample below ${limit}: each of ${xn} = 0, …, ${limit - 1n} satisfies B, but larger values were not tried, so the formula may still be false`
    : `no witness below ${limit}: none of ${xn} = 0, …, ${limit - 1n} satisfies B, but larger values were not tried, so the formula may still be true`;
  const trace = node('unknown', detail, { kind: q.k, variable: x, variants, range: `0, …, ${limit - 1n} (search limit)` }, [], detail);
  return { classification, truth: 'unknown', trace, searched: limit, message: all ? `no counterexample below ${limit}` : `no witness below ${limit}` };
}
