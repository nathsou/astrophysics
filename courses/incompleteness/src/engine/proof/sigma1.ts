// The proof of Σ1-completeness (section "Σ1 completeness"), unfolded for one sentence.
//
// Theorem: if ∃x A(x) is a Σ1 sentence true in ℕ, then Q ⊢ ∃x A(x). The proof finds n with
// ℕ ⊨ A(n̄), applies Lemma "Δ0-completeness" to the Δ0 sentence A(n̄), and concludes by ∃Intro.
// Lemma Δ0-completeness is proved by induction on the formula, with one case per form of the
// sentence (and of a negated sentence). `plan` follows that induction for a particular true
// Δ0 sentence and records, at each node, which case is used and on which smaller sentences the
// induction hypothesis is invoked; at the leaves stands Lemma "atomic completeness".
//
// This is the *shape* of the argument for one sentence, not a derivation in Q: the lemmas it
// cites (about closed terms and <) are proved in the text, not mechanised here.
//
// The book's cases treat ∧, ∨, ¬ and the bounded quantifiers. For →, ↔, ⊤ and ⊥, which are
// also propositional connectives, the plan adds the analogous cases "by logic" and marks them
// as added.

import * as A from '../syntax/ast.ts';
import type { Formula, NodeId, Term } from '../syntax/ast.ts';
import { freeVars } from '../syntax/ops.ts';
import { subst } from '../syntax/subst.ts';
import { varName } from '../syntax/language.ts';
import { lit } from '../numbers/nat.ts';
import { boundedForm, classify, evaluateInN, evaluateTermInN, type Classification } from '../semantics/standard.ts';

export type Goal = 'prove' | 'refute';

export interface PlanNode {
  /** The sentence S; the node establishes Q ⊢ S (goal 'prove') or Q ⊢ ¬S (goal 'refute'). */
  sentence: Formula;
  goal: Goal;
  /** The case of the proof used here, as the book states it (or 'added' for connectives it leaves implicit). */
  case: string;
  /** The label of the lemma invoked at this node, if any. */
  lemma?: string;
  added?: boolean;
  /** For atomic sentences: the values of the two terms. */
  values?: [bigint, bigint];
  /** For bounded quantifiers: the value k of the bound, and the instances used. */
  bound?: bigint;
  children: PlanNode[];
  /** Children not listed because there are too many (bounded quantifiers with a large bound). */
  omitted?: number;
}

export interface Sigma1Plan {
  classification: Classification;
  /** For Σ1 sentences: the witness n found by search, and the instance A(n̄). */
  witness?: bigint;
  instance?: Formula;
  /** The Δ0 part. */
  plan?: PlanNode;
  /** 'true' (plan built), 'false' (Δ0 sentence false: not provable, its negation is), 'unknown' (no witness within the search limit, or too large) */
  status: 'true' | 'false' | 'unknown' | 'not-applicable';
  message: string;
  /** For a false Δ0 sentence: the plan for its negation. */
  negationPlan?: PlanNode;
  nodes: number;
}

const num = (n: bigint): Term => (n === 0n ? A.zero() : A.numeral(lit(n)));

export interface PlanOptions {
  /** Σ1 search: try x = 0, …, limit − 1 (default 1000). */
  limit?: number;
  /** Largest bound expanded instance by instance (default 64). */
  maxInstances?: number;
  /** Maximum number of plan nodes (default 3000). */
  maxNodes?: number;
}

const MAX_STEPS = 400_000;

function truth(S: Formula): boolean | 'unknown' {
  return evaluateInN(S, new Map(), { limit: 1, maxSteps: MAX_STEPS }).truth;
}

class Budget extends Error {}

/** The plan for Q ⊢ S (goal 'prove', S true) or Q ⊢ ¬S (goal 'refute', S false), S a Δ0 sentence. */
export function planDelta0(S: Formula, goal: Goal, opts: PlanOptions = {}): { plan: PlanNode; nodes: number } | { error: string } {
  const maxInstances = opts.maxInstances ?? 64;
  const maxNodes = opts.maxNodes ?? 3000;
  let nodes = 0;
  const L = {
    atomic: 'inc:inp:s1c:lem:atomic-completeness',
    bq: 'inc:inp:s1c:lem:bounded-quant-equiv',
    d0: 'inc:inp:s1c:lem:delta0-completeness',
  };
  const go = (S: Formula, goal: Goal): PlanNode => {
    if (++nodes > maxNodes) throw new Budget();
    const node = (c: string, children: PlanNode[], extra: Partial<PlanNode> = {}): PlanNode => ({ sentence: S, goal, case: c, children, ...extra });
    const pos = goal === 'prove';
    switch (S.k) {
      case 'eq':
      case 'pred': {
        const [l, r] = S.k === 'eq' ? [S.l, S.r] : S.args;
        const lv = evaluateTermInN(l).value;
        const rv = evaluateTermInN(r).value;
        if (lv === null || rv === null) throw new Error('a term has no value');
        const vals: [bigint, bigint] = [lv, rv];
        if (S.k === 'eq') {
          return node(pos ? `atomic, t₁ = t₂ with equal values (${lv}): Q ⊢ t₁ = t₂` : `atomic, t₁ = t₂ with different values (${lv} ≠ ${rv}): Q ⊢ t₁ ≠ t₂`, [], { lemma: L.atomic, values: vals });
        }
        return node(pos ? `atomic, t₁ < t₂ with ${lv} < ${rv}: Q ⊢ t₁ < t₂` : `atomic, t₁ < t₂ with ${lv} ≥ ${rv}: Q ⊢ ¬(t₁ < t₂)`, [], { lemma: L.atomic, values: vals });
      }
      case 'top':
        return pos ? node('⊤ is ¬⊥, provable by logic', [], { added: true }) : node('⊤ is never false', []);
      case 'bot':
        return pos ? node('⊥ is never true', []) : node('¬⊥ is provable by logic', [], { added: true });
      case 'and':
        if (pos) return node('A ∧ B true: both are true; by the induction hypothesis Q proves both, so Q ⊢ A ∧ B', [go(S.a, 'prove'), go(S.b, 'prove')], { lemma: L.d0 });
        return node('¬(A ∧ B) true: one conjunct is false; by the induction hypothesis Q refutes it, so Q ⊢ ¬(A ∧ B)', [truth(S.a) === false ? go(S.a, 'refute') : go(S.b, 'refute')], { lemma: L.d0 });
      case 'or':
        if (pos) return node('A ∨ B true: one disjunct is true; by the induction hypothesis Q proves it, so Q ⊢ A ∨ B', [truth(S.a) === true ? go(S.a, 'prove') : go(S.b, 'prove')], { lemma: L.d0 });
        return node('¬(A ∨ B) true: both are false; by the induction hypothesis Q refutes both, so Q ⊢ ¬(A ∨ B)', [go(S.a, 'refute'), go(S.b, 'refute')], { lemma: L.d0 });
      case 'imp':
        if (pos) {
          return truth(S.a) === false
            ? node('A → B true because A is false: Q ⊢ ¬A, hence Q ⊢ A → B by logic', [go(S.a, 'refute')], { added: true })
            : node('A → B true because B is true: Q ⊢ B, hence Q ⊢ A → B by logic', [go(S.b, 'prove')], { added: true });
        }
        return node('¬(A → B) true: A is true and B false; Q ⊢ A and Q ⊢ ¬B, hence Q ⊢ ¬(A → B) by logic', [go(S.a, 'prove'), go(S.b, 'refute')], { added: true });
      case 'iff': {
        const ta = truth(S.a);
        if (pos) {
          return ta === true
            ? node('A ↔ B true, both true: Q ⊢ A and Q ⊢ B, hence Q ⊢ A ↔ B by logic', [go(S.a, 'prove'), go(S.b, 'prove')], { added: true })
            : node('A ↔ B true, both false: Q ⊢ ¬A and Q ⊢ ¬B, hence Q ⊢ A ↔ B by logic', [go(S.a, 'refute'), go(S.b, 'refute')], { added: true });
        }
        return ta === true
          ? node('¬(A ↔ B) true, A true and B false: hence Q ⊢ ¬(A ↔ B) by logic', [go(S.a, 'prove'), go(S.b, 'refute')], { added: true })
          : node('¬(A ↔ B) true, A false and B true: hence Q ⊢ ¬(A ↔ B) by logic', [go(S.a, 'refute'), go(S.b, 'prove')], { added: true });
      }
      case 'not':
        if (pos) {
          // ¬B true: refute B (the book splits this into the cases for the form of B).
          const inner = go(S.a, 'refute');
          return { ...inner, sentence: S, goal: 'prove' as Goal, case: inner.case, children: inner.children };
        }
        // ¬B false, i.e. B true: ¬¬B case — Q ⊢ ¬¬B from Q ⊢ B
        return node('¬¬B true: B is true; by the induction hypothesis Q ⊢ B, and ¬¬B follows by logic', [go(S.a, 'prove')], { lemma: L.d0 });
      case 'forall':
      case 'exists': {
        const b = boundedForm(S);
        if (!b || 'reason' in b) throw new Error('not a bounded quantifier');
        const kv = evaluateTermInN(b.bound).value;
        if (kv === null) throw new Error('the bound has no value');
        const xn = varName(b.variable);
        const inst = (n: bigint) => subst(b.body, b.variable, num(n));
        const every = (g: Goal) => {
          const count = kv > BigInt(maxInstances) ? maxInstances : Number(kv);
          const ch = Array.from({ length: count }, (_, i) => go(inst(BigInt(i)), g));
          return { ch, omitted: Number(kv) - count };
        };
        const find = (want: boolean): bigint | null => {
          for (let n = 0n; n < kv; n++) if (truth(inst(n)) === want) return n;
          return null;
        };
        const universal = S.k === 'forall';
        if (universal === pos) {
          // true ∀x<t A (prove every instance) or false ∃x<t A (refute every instance)
          const { ch, omitted } = every(pos ? 'prove' : 'refute');
          const c = pos
            ? `∀${xn} < t A(${xn}) true, t has value ${kv}: Q proves A(0̄), …, A(${kv === 0n ? '−' : `${kv - 1n}̄`}), so by Lemma “bounded quantifiers” Q ⊢ ∀${xn} < t A(${xn})`
            : `¬∃${xn} < t A(${xn}) true, t has value ${kv}: it is equivalent in Q to ∀${xn} < t ¬A(${xn}); Q refutes each of A(0̄), …, A(${kv === 0n ? '−' : `${kv - 1n}̄`})`;
          return node(c, ch, { lemma: L.bq, bound: kv, ...(omitted > 0 ? { omitted } : {}) });
        }
        // true ∃x<t A (one witness) or false ∀x<t A (one counterexample)
        const n = find(pos);
        if (n === null) throw new Error('no witness below the bound');
        const c = pos
          ? `∃${xn} < t A(${xn}) true, t has value ${kv}: A(${n}̄) is true with ${n} < ${kv}; Q proves it, so Q ⊢ ∃${xn} < t A(${xn}) (Lemma “bounded quantifiers”)`
          : `¬∀${xn} < t A(${xn}) true, t has value ${kv}: equivalent in Q to ∃${xn} < t ¬A(${xn}); A(${n}̄) is false with ${n} < ${kv}, and Q refutes it`;
        return node(c, [go(inst(n), pos ? 'prove' : 'refute')], { lemma: L.bq, bound: kv });
      }
      case 'abbr':
        throw new Error('named formulas are not Δ0 here');
    }
  };
  try {
    return { plan: go(S, goal), nodes };
  } catch (e) {
    if (e instanceof Budget) return { error: `the plan would have more than ${maxNodes} steps` };
    return { error: (e as Error).message };
  }
}

/** Σ1-completeness for one sentence: classify, find the witness, and unfold the Δ0 lemma. */
export function sigma1Plan(S: Formula, opts: PlanOptions = {}): Sigma1Plan {
  const classification = classify(S);
  const base = { classification, nodes: 0 };
  if (freeVars(S).size) return { ...base, status: 'not-applicable', message: 'Σ1-completeness is about sentences; this formula has free variables.' };
  if (classification.level === 'other' || classification.level === 'Π1') {
    return {
      ...base,
      status: 'not-applicable',
      message: classification.level === 'Π1'
        ? 'This is a Π1 sentence. Σ1-completeness says nothing about Π1 sentences: a true Π1 sentence need not be provable in Q.'
        : `Not Δ0 or Σ1, so the theorem does not apply. ${classification.explanation}`,
    };
  }
  const r = evaluateInN(S, new Map(), { limit: opts.limit ?? 1000, maxSteps: MAX_STEPS });
  if (classification.level === 'Δ0') {
    if (r.truth === 'unknown') return { ...base, status: 'unknown', message: r.message };
    const p = planDelta0(S, r.truth ? 'prove' : 'refute', opts);
    if ('error' in p) return { ...base, status: 'unknown', message: p.error };
    return r.truth
      ? { classification, status: 'true', plan: p.plan, nodes: p.nodes, message: 'A true Δ0 sentence: by Lemma Δ0-completeness, Q proves it.' }
      : { classification, status: 'false', negationPlan: p.plan, nodes: p.nodes, message: 'A false Δ0 sentence: Q does not prove it (Q is sound), and by Lemma Δ0-completeness Q proves its negation.' };
  }
  // Σ1: ∃x B(x)
  const q = S as Formula & { k: 'exists' };
  if (r.truth !== true || r.witness === undefined) {
    return { ...base, status: 'unknown', message: `${r.message}. That does not make the sentence false: larger witnesses were not tried.` };
  }
  const instance = subst(q.body, q.v.index, num(r.witness));
  const p = planDelta0(instance, 'prove', opts);
  if ('error' in p) return { ...base, witness: r.witness, instance, status: 'unknown', message: p.error };
  return {
    classification,
    witness: r.witness,
    instance,
    plan: p.plan,
    nodes: p.nodes,
    status: 'true',
    message: `True: the witness ${varName(q.v.index)} = ${r.witness} was found by trying 0, 1, 2, … in turn. Q proves the Δ0 sentence A(${r.witness}̄) by Lemma Δ0-completeness, and then ∃${varName(q.v.index)} A(${varName(q.v.index)}) by ∃Intro.`,
  };
}

/** Node ids of the formula that are bounded quantifiers (for highlighting). */
export function boundedIds(S: Formula): NodeId[] {
  return classify(S).bounded;
}
