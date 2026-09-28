// An interactive derivation under construction (the builder behind the "proof debugger you can
// build with" of the natural deduction appendix).
//
// A derivation under construction is a tree whose unfinished leaves are *goals*: sentences still
// to be derived. The book develops its examples this way — "we begin by writing the desired
// conclusion at the bottom" — and so does the builder:
//
//   - bottom-up: pick a goal, pick a rule, supply what the rule needs (a formula, a term, an
//     eigenvariable, a discharge label); the goal becomes the conclusion of that inference and
//     its premises become new goals;
//   - top-down: start from assumptions and apply rules to finished pieces, then plug a piece
//     into a goal with the same sentence;
//   - close a goal as an assumption (labelled, to be discharged below, or not);
//   - retract a step (its subtree becomes a goal again).
//
// Nothing here decides whether an inference is correct: every state is handed to the checker
// (nd.ts), goals included, and its verdicts are what the interface shows. The builder only
// computes the *suggested* premises of a rule for a goal; the reader may change them, and the
// checker then says what is wrong. All operations are pure: they return a new state and leave
// the old one intact (for undo).

import * as Ast from '../syntax/ast.ts';
import type { Formula, Term } from '../syntax/ast.ts';
import { constants, formulaEq, freshConstIndex, termEq } from '../syntax/ops.ts';
import { subst } from '../syntax/subst.ts';
import { check, did, linearize, RULE_NAMES, type CheckResult, type Deriv, type Rule } from './nd.ts';

export const GOAL = '?';

export interface BState {
  /** The derivation; goals are `hyp` leaves whose ids are in `goals`. */
  root: Deriv;
  goals: ReadonlySet<string>;
  /** Derivations built top-down, not yet plugged into a goal. */
  pieces: Deriv[];
  /** The assumptions Γ that may stay undischarged. */
  gamma: Formula[];
  /** The axioms of a theory, if any (their leaves are `axiom` steps). */
  axioms?: Map<string, Formula>;
}

export type Result = { ok: true; state: BState; focus?: string } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });

export function goalLeaf(f: Formula): Deriv {
  return { id: did(), rule: 'hyp', concl: f, premises: [], name: GOAL };
}

export function start(goal: Formula, gamma: Formula[] = [], axioms?: Map<string, Formula>): BState {
  const g = goalLeaf(goal);
  return { root: g, goals: new Set([g.id]), pieces: [], gamma, axioms };
}

export function isGoal(s: BState, id: string): boolean {
  return s.goals.has(id);
}

/** The goals in reading order (left to right in the tree). */
export function goalsInOrder(s: BState): Deriv[] {
  return linearize(s.root).filter((d) => s.goals.has(d.id));
}

export function findNode(root: Deriv, id: string): Deriv | null {
  if (root.id === id) return root;
  for (const p of root.premises) {
    const r = findNode(p, id);
    if (r) return r;
  }
  return null;
}

/** Replaces the node with the given id (path copying; untouched subtrees are shared). */
export function replaceNode(root: Deriv, id: string, by: Deriv): Deriv {
  if (root.id === id) return by;
  let changed = false;
  const premises = root.premises.map((p) => {
    const q = replaceNode(p, id, by);
    if (q !== p) changed = true;
    return q;
  });
  return changed ? { ...root, premises } : root;
}

function collectIds(d: Deriv, out: Set<string> = new Set()): Set<string> {
  out.add(d.id);
  d.premises.forEach((p) => collectIds(p, out));
  return out;
}

// ------------------------------------------------------------------ checking

export interface BuildCheck {
  /** The checker's verdict on the whole tree (goals count as not yet derived). */
  check: CheckResult;
  goals: Deriv[];
  /** Undischarged assumptions that are not in Γ (the checker allows any; Γ ⊢ A needs them in Γ). */
  outsideGamma: Deriv[];
  /** Γ ⊢ goal is established: no goals, no errors, every undischarged assumption in Γ. */
  done: boolean;
  /** The checker's verdict on each piece built top-down. */
  pieces: { piece: Deriv; check: CheckResult }[];
}

export function checkState(s: BState): BuildCheck {
  const c = check(s.root, { axioms: s.axioms, goals: s.goals });
  const byId = new Map(linearize(s.root).map((d) => [d.id, d]));
  const outsideGamma = c.open
    .filter((o) => o.kind === 'assume' && !s.gamma.some((g) => formulaEq(g, o.formula)))
    .map((o) => byId.get(o.id)!)
    .filter(Boolean);
  const goals = goalsInOrder(s);
  return {
    check: c,
    goals,
    outsideGamma,
    done: c.valid && goals.length === 0 && outsideGamma.length === 0,
    pieces: s.pieces.map((piece) => ({ piece, check: check(piece, { axioms: s.axioms }) })),
  };
}

// ------------------------------------------------------------------ what a goal may assume

export interface Available {
  formula: Formula;
  label: number;
  /** The id of the inference that would discharge it. */
  by: string;
  rule: Rule;
}

/**
 * The labelled assumptions that inferences below the goal would discharge if the goal were
 * closed by that assumption: [A]ⁿ above an →Intro concluding A → B, the disjuncts above ∨Elim,
 * A(a) above ∃Elim, ¬A above ⊥C, A above ¬Intro.
 */
export function availableAt(s: BState, id: string): Available[] {
  const out: Available[] = [];
  const go = (d: Deriv, trail: Available[]): boolean => {
    if (d.id === id) {
      out.push(...trail);
      return true;
    }
    return d.premises.some((p, i) => {
      const add: Available[] = [];
      const push = (f: Formula | null | undefined) => {
        if (f && d.label !== undefined) add.push({ formula: f, label: d.label, by: d.id, rule: d.rule });
      };
      switch (d.rule) {
        case 'impI':
          if (d.concl.k === 'imp') push(d.concl.a);
          break;
        case 'notI':
          if (d.concl.k === 'not') push(d.concl.a);
          break;
        case 'botC':
          push(Ast.not(d.concl));
          break;
        case 'orE': {
          const disj = d.premises[0].concl;
          if (disj.k === 'or' && i === 1) push(disj.a);
          if (disj.k === 'or' && i === 2) push(disj.b);
          break;
        }
        case 'exE': {
          const ex = d.premises[0].concl;
          if (ex.k === 'exists' && i === 1 && d.eigen !== undefined) push(subst(ex.body, ex.v.index, Ast.c(d.eigen)));
          break;
        }
      }
      return go(p, [...add, ...trail]);
    });
  };
  go(s.root, []);
  // innermost first; drop duplicates of the same formula and label
  return out.filter((a, i) => out.findIndex((b) => b.label === a.label && formulaEq(b.formula, a.formula)) === i);
}

/** Labels used anywhere in the state. */
export function usedLabels(s: BState): Set<number> {
  const out = new Set<number>();
  for (const t of [s.root, ...s.pieces]) for (const d of linearize(t)) if (d.label !== undefined) out.add(d.label);
  return out;
}

export function freshLabel(s: BState): number {
  const used = usedLabels(s);
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

/** A constant a, b, c, … occurring nowhere in the derivation, Γ, or the pieces. */
export function freshEigen(s: BState, extra: Formula[] = []): number {
  const fs: Formula[] = [...s.gamma, ...extra];
  for (const t of [s.root, ...s.pieces]) for (const d of linearize(t)) fs.push(d.concl);
  return freshConstIndex(fs);
}

// ------------------------------------------------------------------ rules: shapes and suggestions

export type RefineRule = Exclude<Rule, 'hyp'>;

/** What the reader must supply for a rule, applied bottom-up to a goal. */
export interface RuleNeeds {
  /** A formula the rule cannot read off the goal. */
  formula?: { label: string; placeholder: string };
  /** A closed term. */
  term?: { label: string; optional?: boolean };
  /** An eigenvariable. */
  eigen?: boolean;
  /** A discharge label. */
  label?: boolean;
  /** Which of two forms. */
  side?: { label: string; options: [string, string] };
  /** An axiom name. */
  axiom?: boolean;
}

export const NEEDS: Record<RefineRule, RuleNeeds> = {
  assume: { label: true },
  axiom: { axiom: true },
  andI: {},
  andE: { formula: { label: 'the other conjunct', placeholder: 'e.g. B' }, side: { label: 'the goal is the', options: ['left conjunct', 'right conjunct'] } },
  orI: { side: { label: 'derive the', options: ['left disjunct', 'right disjunct'] } },
  orE: { formula: { label: 'the disjunction A ∨ B', placeholder: 'e.g. ¬A ∨ B' }, label: true },
  impI: { label: true },
  impE: { formula: { label: 'the antecedent A (premises A → goal and A)', placeholder: 'e.g. A' } },
  notI: { label: true },
  notE: { formula: { label: 'the sentence A (premises ¬A and A)', placeholder: 'e.g. A' } },
  botI: {},
  botC: { label: true },
  allI: { eigen: true },
  allE: { formula: { label: 'the universal premise ∀x A(x)', placeholder: 'e.g. ∀x A(x)' }, term: { label: 'the term t', optional: true } },
  exI: { term: { label: 'the closed term t' } },
  exE: { formula: { label: 'the existential premise ∃x A(x)', placeholder: 'e.g. ∃x ¬A(x)' }, eigen: true, label: true },
  eqI: {},
  eqE: { formula: { label: 'the identity t₁ = t₂', placeholder: 'e.g. a = b' }, side: { label: 'the other premise has', options: ['t₁ in place of t₂', 't₂ in place of t₁'] } },
};

export interface RefineParams {
  formula?: Formula;
  term?: Term;
  eigen?: number;
  label?: number;
  side?: 0 | 1;
  axiom?: string;
  /** Premise sentences overriding the suggestion (the checker judges them). */
  premises?: Formula[];
}

/** Replaces every occurrence of the closed term s by t. */
export function replaceTerm<T extends Formula | Term>(f: T, s: Term, t: Term): T {
  const tm = (x: Term): Term => {
    if (termEq(x, s)) return Ast.cloneFresh(t);
    if (x.k === 'app') return { ...x, args: x.args.map(tm) };
    return x;
  };
  const fm = (x: Formula): Formula => {
    switch (x.k) {
      case 'bot':
      case 'top':
        return x;
      case 'eq':
        return { ...x, l: tm(x.l), r: tm(x.r) };
      case 'pred':
      case 'abbr':
        return { ...x, args: x.args.map(tm) };
      case 'not':
        return { ...x, a: fm(x.a) };
      case 'and':
      case 'or':
      case 'imp':
      case 'iff':
        return { ...x, a: fm(x.a), b: fm(x.b) };
      case 'forall':
      case 'exists':
        return { ...x, body: fm(x.body) };
    }
  };
  return (Ast.isTerm(f) ? tm(f as Term) : fm(f as Formula)) as T;
}

/** Replaces the constant c_i by the variable x (for ∀Intro top-down). */
export function abstractConst(f: Formula, c: number, x: number): Formula {
  return replaceTerm(f, Ast.c(c), Ast.v(x));
}

export type Suggestion = { ok: true; premises: Formula[]; note?: string } | { ok: false; error: string };

/**
 * The premises a rule needs for the goal, as the book's schema determines them from the goal
 * and the supplied parameters. This is a suggestion; the checker decides.
 */
export function suggest(rule: RefineRule, goal: Formula, p: RefineParams): Suggestion {
  const need = (what: string): Suggestion => ({ ok: false, error: `${RULE_NAMES[rule]} needs ${what}` });
  const shape = (what: string): Suggestion => ({ ok: false, error: `${RULE_NAMES[rule]} concludes ${what}; the goal is not one` });
  switch (rule) {
    case 'assume':
    case 'axiom':
    case 'eqI':
      return { ok: true, premises: [] };
    case 'andI':
      return goal.k === 'and' ? { ok: true, premises: [goal.a, goal.b] } : shape('a conjunction A ∧ B');
    case 'andE':
      if (!p.formula) return need('the other conjunct');
      return { ok: true, premises: [p.side === 1 ? Ast.and(p.formula, goal) : Ast.and(goal, p.formula)] };
    case 'orI':
      if (goal.k !== 'or') return shape('a disjunction A ∨ B');
      return { ok: true, premises: [p.side === 1 ? goal.b : goal.a] };
    case 'orE':
      if (!p.formula) return need('the disjunction to reason by cases on');
      if (p.formula.k !== 'or') return { ok: false, error: 'the formula to reason by cases on must be a disjunction' };
      return { ok: true, premises: [p.formula, goal, goal] };
    case 'impI':
      return goal.k === 'imp' ? { ok: true, premises: [goal.b] } : shape('a conditional A → B');
    case 'impE':
      if (!p.formula) return need('the antecedent A');
      return { ok: true, premises: [Ast.imp(p.formula, goal), p.formula] };
    case 'notI':
      return goal.k === 'not' ? { ok: true, premises: [Ast.bot()] } : shape('a negation ¬A');
    case 'notE':
      if (goal.k !== 'bot') return shape('⊥');
      if (!p.formula) return need('the sentence A');
      return { ok: true, premises: [Ast.not(p.formula), p.formula] };
    case 'botI':
    case 'botC':
      return { ok: true, premises: [Ast.bot()] };
    case 'allI':
      if (goal.k !== 'forall') return shape('a universal sentence ∀x A(x)');
      if (p.eigen === undefined) return need('an eigenvariable');
      return { ok: true, premises: [subst(goal.body, goal.v.index, Ast.c(p.eigen))] };
    case 'allE':
      if (!p.formula) return need('the universal premise');
      if (p.formula.k !== 'forall') return { ok: false, error: 'the premise of ∀Elim must be universally quantified' };
      return { ok: true, premises: [p.formula] };
    case 'exI':
      if (goal.k !== 'exists') return shape('an existential sentence ∃x A(x)');
      if (!p.term) return need('the closed term t');
      return { ok: true, premises: [subst(goal.body, goal.v.index, p.term)] };
    case 'exE':
      if (!p.formula) return need('the existential premise');
      if (p.formula.k !== 'exists') return { ok: false, error: 'the first premise of ∃Elim must be existentially quantified' };
      if (p.eigen === undefined) return need('an eigenvariable');
      return { ok: true, premises: [p.formula, goal] };
    case 'eqE': {
      if (!p.formula) return need('the identity t₁ = t₂');
      const e = p.formula;
      if (e.k !== 'eq') return { ok: false, error: 'the first premise of =Elim must be an identity t₁ = t₂' };
      // from t₁ = t₂ and A(t₁) infer A(t₂): the other premise has t₁ where the goal has t₂
      const other = p.side === 1 ? replaceTerm(goal, e.l, e.r) : replaceTerm(goal, e.r, e.l);
      return { ok: true, premises: [e, other], note: 'The other premise replaces every occurrence; edit it to replace only some.' };
    }
  }
}

/** Applies a rule bottom-up at a goal: the goal becomes its conclusion, the premises new goals. */
export function refine(s: BState, goalId: string, rule: RefineRule, p: RefineParams = {}): Result {
  if (!s.goals.has(goalId)) return fail('that is not an open goal');
  const g = findNode(s.root, goalId);
  if (!g) return fail('no such goal');
  const goals = new Set(s.goals);
  goals.delete(goalId);
  if (rule === 'assume') {
    const leaf: Deriv = { id: did(), rule: 'assume', concl: g.concl, premises: [], ...(p.label !== undefined ? { label: p.label } : {}) };
    return { ok: true, state: { ...s, root: replaceNode(s.root, goalId, leaf), goals }, focus: leaf.id };
  }
  if (rule === 'axiom') {
    if (!p.axiom) return fail('choose an axiom');
    const leaf: Deriv = { id: did(), rule: 'axiom', concl: g.concl, premises: [], name: p.axiom };
    return { ok: true, state: { ...s, root: replaceNode(s.root, goalId, leaf), goals }, focus: leaf.id };
  }
  let premises: Formula[];
  if (p.premises) premises = p.premises;
  else {
    const sg = suggest(rule, g.concl, p);
    if (!sg.ok) return fail(sg.error);
    premises = sg.premises;
  }
  const kids = premises.map(goalLeaf);
  kids.forEach((k) => goals.add(k.id));
  const node: Deriv = {
    id: did(),
    rule,
    concl: g.concl,
    premises: kids,
    ...(p.label !== undefined && ['orE', 'impI', 'notI', 'botC', 'exE'].includes(rule) ? { label: p.label } : {}),
    ...(p.eigen !== undefined && (rule === 'allI' || rule === 'exE') ? { eigen: p.eigen } : {}),
    ...(p.term !== undefined && (rule === 'allE' || rule === 'exI') ? { term: p.term } : {}),
  };
  return { ok: true, state: { ...s, root: replaceNode(s.root, goalId, node), goals }, focus: kids[0]?.id ?? node.id };
}

/** Turns a step (and everything above it) back into a goal. */
export function retract(s: BState, id: string): Result {
  const d = findNode(s.root, id);
  if (!d) return fail('no such step');
  if (s.goals.has(id)) return fail('that is already a goal');
  const removed = collectIds(d);
  const g = goalLeaf(d.concl);
  const goals = new Set([...s.goals].filter((x) => !removed.has(x)));
  goals.add(g.id);
  return { ok: true, state: { ...s, root: replaceNode(s.root, id, g), goals }, focus: g.id };
}

/** Changes (or removes) the label of an assumption or of a discharging inference. */
export function setLabel(s: BState, id: string, label: number | undefined): Result {
  const inRoot = findNode(s.root, id);
  const d = inRoot ?? s.pieces.map((p) => findNode(p, id)).find(Boolean) ?? null;
  if (!d) return fail('no such step');
  if (!['assume', 'orE', 'impI', 'notI', 'botC', 'exE'].includes(d.rule)) return fail(`${RULE_NAMES[d.rule]} has no discharge label`);
  const { label: _old, ...rest } = d;
  void _old;
  const nd: Deriv = label === undefined ? rest : { ...rest, label };
  if (inRoot) return { ok: true, state: { ...s, root: replaceNode(s.root, id, nd) } };
  return { ok: true, state: { ...s, pieces: s.pieces.map((p) => replaceNode(p, id, nd)) } };
}

// ------------------------------------------------------------------ top-down

/** Adds an assumption (or an axiom) as a new piece. */
export function addAssumption(s: BState, f: Formula, label?: number, axiom?: string): Result {
  const leaf: Deriv = axiom ? { id: did(), rule: 'axiom', concl: f, premises: [], name: axiom } : { id: did(), rule: 'assume', concl: f, premises: [], ...(label !== undefined ? { label } : {}) };
  return { ok: true, state: { ...s, pieces: [...s.pieces, leaf] }, focus: leaf.id };
}

export type ForwardRule = Exclude<Rule, 'assume' | 'axiom' | 'hyp'>;

export const FORWARD_ARITY: Record<ForwardRule, number> = {
  andI: 2, andE: 1, orI: 1, orE: 3, impI: 1, impE: 2, notI: 1, notE: 2, botI: 1, botC: 1,
  allI: 1, allE: 1, exI: 1, exE: 2, eqI: 0, eqE: 2,
};

/** What a forward (top-down) application needs besides its premises. */
export const FORWARD_NEEDS: Record<ForwardRule, RuleNeeds & { concl?: string }> = {
  andI: {},
  andE: { side: { label: 'infer the', options: ['left conjunct', 'right conjunct'] } },
  orI: { formula: { label: 'the other disjunct', placeholder: 'e.g. ¬A' }, side: { label: 'the premise becomes the', options: ['left disjunct', 'right disjunct'] } },
  orE: { label: true },
  impI: { formula: { label: 'the antecedent A (discharging [A]ⁿ)', placeholder: 'e.g. A ∧ B' }, label: true },
  impE: {},
  notI: { formula: { label: 'the sentence A to refute (discharging [A]ⁿ)', placeholder: 'e.g. A' }, label: true },
  notE: {},
  botI: { formula: { label: 'the conclusion', placeholder: 'any sentence' } },
  botC: { formula: { label: 'the conclusion A (discharging [¬A]ⁿ)', placeholder: 'e.g. A ∨ ¬A' }, label: true },
  allI: { eigen: true, formula: { label: 'the conclusion ∀x A(x) (optional: default replaces the eigenvariable by x)', placeholder: 'e.g. ∀x A(x)' } },
  allE: { term: { label: 'the closed term t' } },
  exI: { formula: { label: 'the conclusion ∃x A(x)', placeholder: 'e.g. ∃x C(x, b)' }, term: { label: 'the term t it generalises', optional: true } },
  exE: { eigen: true, label: true },
  eqI: { term: { label: 'the closed term t' } },
  eqE: { formula: { label: 'the conclusion (optional: default replaces every occurrence)', placeholder: 'e.g. A(b)' }, side: { label: 'replace', options: ['t₁ by t₂', 't₂ by t₁'] } },
};

export interface ForwardParams extends RefineParams {
  /** For ∀Intro: the bound variable of the conclusion (default x or the first unused). */
  variable?: number;
}

/** Applies a rule to finished pieces (in the order given), making a new piece. */
export function forward(s: BState, rule: ForwardRule, pieceIds: string[], p: ForwardParams = {}): Result {
  const n = FORWARD_ARITY[rule];
  if (pieceIds.length !== n) return fail(`${RULE_NAMES[rule]} takes ${n} premise${n === 1 ? '' : 's'}; ${pieceIds.length} selected`);
  const prem = pieceIds.map((id) => s.pieces.find((x) => x.id === id));
  if (prem.some((x) => !x)) return fail('select pieces from the list of pieces');
  const P = prem as Deriv[];
  const C = P.map((x) => x.concl);
  let concl: Formula | null = null;
  const extra: Partial<Deriv> = {};
  const label = () => {
    if (p.label !== undefined) extra.label = p.label;
  };
  switch (rule) {
    case 'andI':
      concl = Ast.and(C[0], C[1]);
      break;
    case 'andE':
      if (C[0].k !== 'and') return fail('∧Elim needs a conjunction as its premise');
      concl = p.side === 1 ? C[0].b : C[0].a;
      break;
    case 'orI':
      if (!p.formula) return fail('∨Intro needs the other disjunct');
      concl = p.side === 1 ? Ast.or(p.formula, C[0]) : Ast.or(C[0], p.formula);
      break;
    case 'orE':
      concl = C[1];
      label();
      break;
    case 'impI':
      if (!p.formula) return fail('→Intro needs the antecedent');
      concl = Ast.imp(p.formula, C[0]);
      label();
      break;
    case 'impE':
      if (C[0].k !== 'imp') return fail('→Elim needs a conditional as its first premise');
      concl = C[0].b;
      break;
    case 'notI':
      if (!p.formula) return fail('¬Intro needs the sentence it refutes');
      concl = Ast.not(p.formula);
      label();
      break;
    case 'notE':
      concl = Ast.bot();
      break;
    case 'botI':
      if (!p.formula) return fail('⊥I needs its conclusion');
      concl = p.formula;
      break;
    case 'botC':
      if (!p.formula) return fail('⊥C needs its conclusion');
      concl = p.formula;
      label();
      break;
    case 'allI': {
      if (p.eigen === undefined) return fail('∀Intro needs an eigenvariable');
      extra.eigen = p.eigen;
      if (p.formula) concl = p.formula;
      else {
        const x = p.variable ?? 0;
        concl = Ast.forall(Ast.v(x), abstractConst(C[0], p.eigen, x));
      }
      break;
    }
    case 'allE':
      if (C[0].k !== 'forall') return fail('∀Elim needs a universal premise');
      if (!p.term) return fail('∀Elim needs a closed term');
      concl = subst(C[0].body, C[0].v.index, p.term);
      extra.term = p.term;
      break;
    case 'exI':
      if (!p.formula) return fail('∃Intro needs its conclusion ∃x A(x)');
      concl = p.formula;
      if (p.term) extra.term = p.term;
      break;
    case 'exE':
      if (p.eigen === undefined) return fail('∃Elim needs an eigenvariable');
      concl = C[1];
      extra.eigen = p.eigen;
      label();
      break;
    case 'eqI':
      if (!p.term) return fail('=Intro needs a closed term');
      concl = Ast.eq(p.term, Ast.cloneFresh(p.term));
      break;
    case 'eqE': {
      const e = C[0];
      if (e.k !== 'eq') return fail('=Elim needs an identity as its first premise');
      concl = p.formula ?? (p.side === 1 ? replaceTerm(C[1], e.r, e.l) : replaceTerm(C[1], e.l, e.r));
      break;
    }
  }
  const node: Deriv = { id: did(), rule, concl: concl!, premises: P, ...extra };
  const used = new Set(pieceIds);
  const pieces = s.pieces.filter((x) => !used.has(x.id));
  // keep the new piece where its first premise was
  const at = s.pieces.findIndex((x) => used.has(x.id));
  pieces.splice(at < 0 ? pieces.length : Math.min(at, pieces.length), 0, node);
  return { ok: true, state: { ...s, pieces }, focus: node.id };
}

/** Uses a finished piece to close a goal with the same sentence. */
export function plug(s: BState, goalId: string, pieceId: string): Result {
  const g = s.goals.has(goalId) ? findNode(s.root, goalId) : null;
  if (!g) return fail('choose an open goal');
  const piece = s.pieces.find((x) => x.id === pieceId);
  if (!piece) return fail('no such piece');
  if (!formulaEq(g.concl, piece.concl)) return fail('the piece derives a different sentence from the goal');
  const goals = new Set(s.goals);
  goals.delete(goalId);
  return { ok: true, state: { ...s, root: replaceNode(s.root, goalId, piece), goals, pieces: s.pieces.filter((x) => x.id !== pieceId) }, focus: piece.id };
}

/** Deletes a piece. */
export function dropPiece(s: BState, pieceId: string): Result {
  if (!s.pieces.some((x) => x.id === pieceId)) return fail('no such piece');
  return { ok: true, state: { ...s, pieces: s.pieces.filter((x) => x.id !== pieceId) } };
}

// ------------------------------------------------------------------ replay

/**
 * The construction of a finished derivation, goal by goal: state k has the first k inferences
 * (in reading order from the bottom: preorder) in place and the rest as goals. Loading a
 * finished derivation with this history lets the reader undo their way back to the bare goal.
 */
export function constructionOf(d: Deriv, gamma: Formula[] = [], axioms?: Map<string, Formula>): BState[] {
  const pre: Deriv[] = [];
  const walk = (x: Deriv) => {
    pre.push(x);
    x.premises.forEach(walk);
  };
  walk(d);
  const index = new Map(pre.map((x, i) => [x.id, i]));
  const states: BState[] = [];
  for (let k = 0; k <= pre.length; k++) {
    const goals = new Set<string>();
    const build = (x: Deriv): Deriv => {
      if (index.get(x.id)! >= k) {
        const id = `goal:${x.id}`;
        goals.add(id);
        return { id, rule: 'hyp', concl: x.concl, premises: [], name: GOAL };
      }
      const premises = x.premises.map(build);
      return premises.every((p, i) => p === x.premises[i]) ? x : { ...x, premises };
    };
    states.push({ root: build(d), goals, pieces: [], gamma, axioms });
  }
  return states;
}

/** The eigenvariable conditions depend on constants: the constants of a formula (for hints). */
export function constantsOf(f: Formula): number[] {
  return [...constants(f)].filter((c) => c !== 0).sort((a, b) => a - b);
}
