// Natural deduction, as defined in the book's appendix "Natural Deduction".
//
// A derivation is a tree. Leaves are assumptions (possibly labelled, to be discharged), axioms of
// a theory Γ (e.g. Q1–Q8), or hypotheses: facts that the text establishes elsewhere (for
// instance, "D_diag represents diag"). The checker verifies every inference against the rule it
// claims, including eigenvariable conditions and discharge labels, and computes for each step
// the undischarged assumptions it depends on.
//
// As in the book, derivations contain sentences only, eigenvariables are constant symbols
// (a, b, c, …), and the terms in ∀Elim, ∃Intro and the identity rules are closed.

import * as A from '../syntax/ast.ts';
import type { Formula, Term } from '../syntax/ast.ts';
import { constants, formulaEq, freeVars, isClosed, termEq } from '../syntax/ops.ts';
import { subst } from '../syntax/subst.ts';
import { formulaText, termText } from '../syntax/print.ts';
import { constName } from '../syntax/language.ts';
import { lit } from '../numbers/nat.ts';

export type Rule =
  | 'assume' | 'axiom' | 'hyp'
  | 'andI' | 'andE' | 'orI' | 'orE' | 'impI' | 'impE' | 'notI' | 'notE' | 'botI' | 'botC'
  | 'allI' | 'allE' | 'exI' | 'exE' | 'eqI' | 'eqE';

export const RULE_NAMES: Record<Rule, string> = {
  assume: 'Assumption', axiom: 'Axiom', hyp: 'Hypothesis',
  andI: '∧Intro', andE: '∧Elim', orI: '∨Intro', orE: '∨Elim', impI: '→Intro', impE: '→Elim',
  notI: '¬Intro', notE: '¬Elim', botI: '⊥I', botC: '⊥C',
  allI: '∀Intro', allE: '∀Elim', exI: '∃Intro', exE: '∃Elim', eqI: '=Intro', eqE: '=Elim',
};

export const RULE_TEX: Record<Rule, string> = {
  assume: '', axiom: '', hyp: '',
  andI: '{\\land}\\mathrm{Intro}', andE: '{\\land}\\mathrm{Elim}', orI: '{\\lor}\\mathrm{Intro}', orE: '{\\lor}\\mathrm{Elim}',
  impI: '{\\rightarrow}\\mathrm{Intro}', impE: '{\\rightarrow}\\mathrm{Elim}', notI: '{\\lnot}\\mathrm{Intro}', notE: '{\\lnot}\\mathrm{Elim}',
  botI: '\\bot_I', botC: '\\bot_C', allI: '{\\forall}\\mathrm{Intro}', allE: '{\\forall}\\mathrm{Elim}',
  exI: '{\\exists}\\mathrm{Intro}', exE: '{\\exists}\\mathrm{Elim}', eqI: '{=}\\mathrm{Intro}', eqE: '{=}\\mathrm{Elim}',
};

/** The rule schemas, as the book states them (for the step inspector). */
export const RULE_SCHEMA: Record<Rule, string> = {
  assume: 'Any sentence may be assumed. An assumption with a label n is discharged by a later inference labelled n.',
  axiom: 'A sentence of the theory Γ may be used as an undischarged assumption; Γ ⊢ A means A has a derivation whose undischarged assumptions are all in Γ.',
  hyp: 'A fact established elsewhere in the text, used here as an undischarged assumption.',
  andI: 'From A and B infer A ∧ B.',
  andE: 'From A ∧ B infer A, or infer B.',
  orI: 'From A infer A ∨ B (or B ∨ A).',
  orE: 'From A ∨ B, a derivation of C from [A]ⁿ, and a derivation of C from [B]ⁿ, infer C, discharging the assumptions labelled n.',
  impI: 'From a derivation of B from [A]ⁿ infer A → B, discharging the assumptions A labelled n.',
  impE: 'From A → B and A infer B.',
  notI: 'From a derivation of ⊥ from [A]ⁿ infer ¬A, discharging the assumptions A labelled n.',
  notE: 'From ¬A and A infer ⊥.',
  botI: 'From ⊥ infer any sentence A (intuitionistic absurdity).',
  botC: 'From a derivation of ⊥ from [¬A]ⁿ infer A, discharging ¬A (classical absurdity).',
  allI: 'From A(a) infer ∀x A(x), where the eigenvariable a occurs neither in ∀x A(x) nor in any undischarged assumption.',
  allE: 'From ∀x A(x) infer A(t), for any closed term t.',
  exI: 'From A(t) infer ∃x A(x), for any closed term t (some or all occurrences of t become x).',
  exE: 'From ∃x A(x) and a derivation of C from [A(a)]ⁿ, infer C, where the eigenvariable a occurs neither in ∃x A(x), nor in C, nor in any other undischarged assumption.',
  eqI: 'Infer t = t outright, for any closed term t.',
  eqE: 'From t₁ = t₂ and A(t₁) infer A(t₂), or from t₁ = t₂ and A(t₂) infer A(t₁) (some occurrences replaced).',
};

export interface Deriv {
  id: string;
  rule: Rule;
  concl: Formula;
  premises: Deriv[];
  /** assume: its label; discharging rules: the label discharged */
  label?: number;
  /** allE / exI: the closed term */
  term?: Term;
  /** allI / exE: the eigenvariable (a constant index) */
  eigen?: number;
  /** axiom / hyp: its name (Q5, "repdiag1", …) */
  name?: string;
  /** An authored remark shown in the step inspector. */
  note?: string;
  /** For grouping steps in high-level views: the name of the stage this step belongs to. */
  group?: string;
}

export interface OpenAssumption {
  id: string;
  formula: Formula;
  label?: number;
  kind: 'assume' | 'axiom' | 'hyp';
  name?: string;
}

export interface StepCheck {
  ok: boolean;
  errors: string[];
  /** Undischarged assumptions, axioms and hypotheses the step depends on. */
  open: OpenAssumption[];
  /** Assumptions discharged at this step. */
  discharged: OpenAssumption[];
}

export interface CheckResult {
  valid: boolean;
  steps: Map<string, StepCheck>;
  /** Undischarged at the root. */
  open: OpenAssumption[];
  axioms: string[];
  hypotheses: string[];
  /** Errors anywhere, with the step id. */
  errors: { id: string; message: string }[];
  size: number;
}

let dcounter = 0;
export const did = () => `d${++dcounter}`;

// ------------------------------------------------------------------ checking

export interface CheckOptions {
  /** The axioms of Γ, by name. `axiom` leaves must match one of them. */
  axioms?: Map<string, Formula>;
}

export function check(root: Deriv, opt: CheckOptions = {}): CheckResult {
  const steps = new Map<string, StepCheck>();
  const errors: { id: string; message: string }[] = [];
  const go = (d: Deriv): StepCheck => {
    const prem = d.premises.map(go);
    const errs: string[] = [];
    let open: OpenAssumption[] = prem.flatMap((p) => p.open);
    const discharged: OpenAssumption[] = [];
    const fail = (m: string) => errs.push(m);
    const P = d.premises.map((p) => p.concl);
    const arity = (n: number) => {
      if (d.premises.length !== n) fail(`${RULE_NAMES[d.rule]} needs ${n} premise${n === 1 ? '' : 's'}, found ${d.premises.length}`);
      return d.premises.length === n;
    };
    const discharge = (from: OpenAssumption[], f: Formula): OpenAssumption[] => {
      if (d.label === undefined) {
        fail(`${RULE_NAMES[d.rule]} must name the label of the assumptions it discharges`);
        return from;
      }
      const keep: OpenAssumption[] = [];
      for (const a of from) {
        if (a.kind === 'assume' && a.label === d.label && formulaEq(a.formula, f)) discharged.push(a);
        else keep.push(a);
      }
      return keep;
    };
    const conclIsSentence = freeVars(d.concl).size === 0;
    if (!conclIsSentence) fail(`${formulaText(d.concl)} is not a sentence (free variables are not allowed in derivations)`);

    switch (d.rule) {
      case 'assume':
        arity(0);
        open = [{ id: d.id, formula: d.concl, label: d.label, kind: 'assume' }];
        break;
      case 'axiom': {
        arity(0);
        const ax = d.name ? opt.axioms?.get(d.name) : undefined;
        if (!opt.axioms) fail('no theory given for axioms');
        else if (!ax) fail(`${d.name ?? '?'} is not an axiom of the theory`);
        else if (!formulaEq(ax, d.concl)) fail(`this is not axiom ${d.name}`);
        open = [{ id: d.id, formula: d.concl, kind: 'axiom', name: d.name }];
        break;
      }
      case 'hyp':
        arity(0);
        open = [{ id: d.id, formula: d.concl, kind: 'hyp', name: d.name }];
        break;
      case 'andI':
        if (arity(2) && !(d.concl.k === 'and' && formulaEq(d.concl.a, P[0]) && formulaEq(d.concl.b, P[1]))) fail('the conclusion must be the conjunction of the premises, in order');
        break;
      case 'andE':
        if (arity(1)) {
          const p = P[0];
          if (p.k !== 'and') fail('the premise must be a conjunction');
          else if (!formulaEq(d.concl, p.a) && !formulaEq(d.concl, p.b)) fail('the conclusion must be one of the conjuncts');
        }
        break;
      case 'orI':
        if (arity(1) && !(d.concl.k === 'or' && (formulaEq(d.concl.a, P[0]) || formulaEq(d.concl.b, P[0])))) fail('the conclusion must be a disjunction with the premise as a disjunct');
        break;
      case 'orE':
        if (arity(3)) {
          const p = P[0];
          if (p.k !== 'or') fail('the first premise must be a disjunction');
          if (!formulaEq(P[1], d.concl) || !formulaEq(P[2], d.concl)) fail('the second and third premises must both be the conclusion');
          if (p.k === 'or') {
            const o1 = discharge(prem[1].open, p.a);
            const o2 = discharge(prem[2].open, p.b);
            open = [...prem[0].open, ...o1, ...o2];
          }
        }
        break;
      case 'impI':
        if (arity(1)) {
          if (d.concl.k !== 'imp' || !formulaEq(d.concl.b, P[0])) fail('the conclusion must be A → B where B is the premise');
          else open = discharge(prem[0].open, d.concl.a);
        }
        break;
      case 'impE':
        if (arity(2)) {
          const p = P[0];
          if (p.k !== 'imp') fail('the first premise must be a conditional');
          else {
            if (!formulaEq(p.a, P[1])) fail('the second premise must be the antecedent of the first');
            if (!formulaEq(p.b, d.concl)) fail('the conclusion must be the consequent of the first premise');
          }
        }
        break;
      case 'notI':
        if (arity(1)) {
          if (P[0].k !== 'bot') fail('the premise must be ⊥');
          if (d.concl.k !== 'not') fail('the conclusion must be a negation');
          else open = discharge(prem[0].open, d.concl.a);
        }
        break;
      case 'notE':
        if (arity(2)) {
          if (d.concl.k !== 'bot') fail('the conclusion must be ⊥');
          if (P[0].k !== 'not' || !formulaEq(P[0].a, P[1])) fail('the premises must be ¬A and A');
        }
        break;
      case 'botI':
        if (arity(1) && P[0].k !== 'bot') fail('the premise must be ⊥');
        break;
      case 'botC':
        if (arity(1)) {
          if (P[0].k !== 'bot') fail('the premise must be ⊥');
          open = discharge(prem[0].open, A.not(d.concl));
        }
        break;
      case 'allI':
        if (arity(1)) {
          const c = d.concl;
          if (c.k !== 'forall') fail('the conclusion must be universally quantified');
          else if (d.eigen === undefined) fail('∀Intro needs an eigenvariable');
          else {
            const a = A.c(d.eigen);
            if (!formulaEq(subst(c.body, c.v.index, a), P[0])) fail(`the premise must be the conclusion's matrix with ${constName(d.eigen)} in place of the bound variable`);
            if (constants(c).has(d.eigen)) fail(`eigenvariable condition: ${constName(d.eigen)} occurs in the conclusion`);
            const bad = prem[0].open.filter((o) => constants(o.formula).has(d.eigen!));
            if (bad.length) fail(`eigenvariable condition: ${constName(d.eigen)} occurs in the undischarged assumption ${formulaText(bad[0].formula)}`);
          }
        }
        break;
      case 'allE':
        if (arity(1)) {
          const p = P[0];
          if (p.k !== 'forall') fail('the premise must be universally quantified');
          else {
            const t = d.term ?? inferInstance(p.body, p.v.index, d.concl);
            if (!t) fail('the conclusion is not an instance of the premise');
            else {
              if (!isClosed(t)) fail(`the term ${termText(t)} is not closed`);
              if (!formulaEq(subst(p.body, p.v.index, t), d.concl)) fail(`the conclusion is not the instance of the premise for ${termText(t)}`);
            }
          }
        }
        break;
      case 'exI': {
        const c = d.concl;
        if (arity(1)) {
          if (c.k !== 'exists') fail('the conclusion must be existentially quantified');
          else {
            const t = d.term ?? inferInstance(c.body, c.v.index, P[0]);
            if (!t) fail('the premise is not an instance of the conclusion');
            else {
              if (!isClosed(t)) fail(`the term ${termText(t)} is not closed`);
              if (!formulaEq(subst(c.body, c.v.index, t), P[0])) fail(`the premise is not the instance of the conclusion for ${termText(t)}`);
            }
          }
        }
        break;
      }
      case 'exE':
        if (arity(2)) {
          const p = P[0];
          if (p.k !== 'exists') fail('the first premise must be existentially quantified');
          else if (d.eigen === undefined) fail('∃Elim needs an eigenvariable');
          else {
            if (!formulaEq(P[1], d.concl)) fail('the second premise must be the conclusion');
            const inst = subst(p.body, p.v.index, A.c(d.eigen));
            const rest = discharge(prem[1].open, inst);
            const e = constName(d.eigen);
            if (constants(p).has(d.eigen)) fail(`eigenvariable condition: ${e} occurs in the premise ${formulaText(p)}`);
            if (constants(d.concl).has(d.eigen)) fail(`eigenvariable condition: ${e} occurs in the conclusion`);
            const bad = [...prem[0].open, ...rest].filter((o) => constants(o.formula).has(d.eigen!));
            if (bad.length) fail(`eigenvariable condition: ${e} occurs in the undischarged assumption ${formulaText(bad[0].formula)}`);
            open = [...prem[0].open, ...rest];
          }
        }
        break;
      case 'eqI':
        arity(0);
        if (d.concl.k !== 'eq' || !termEq(d.concl.l, d.concl.r)) fail('the conclusion must be t = t');
        else if (!isClosed(d.concl.l)) fail('t must be a closed term');
        break;
      case 'eqE':
        if (arity(2)) {
          const e = P[0];
          if (e.k !== 'eq') fail('the first premise must be an identity t₁ = t₂');
          else if (!isClosed(e.l) || !isClosed(e.r)) fail('the terms of the identity must be closed');
          else if (!replaceMatch(P[1], d.concl, e.l, e.r) && !replaceMatch(P[1], d.concl, e.r, e.l)) {
            fail('the conclusion must be the second premise with some occurrences of one side of the identity replaced by the other');
          }
        }
        break;
    }
    const sc: StepCheck = { ok: errs.length === 0, errors: errs, open, discharged };
    steps.set(d.id, sc);
    for (const m of errs) errors.push({ id: d.id, message: m });
    return sc;
  };
  const r = go(root);
  for (const o of r.open) {
    if (o.kind === 'assume' && o.label !== undefined) errors.push({ id: o.id, message: `the assumption ${formulaText(o.formula)} labelled ${o.label} is never discharged` });
  }
  const uniq = (xs: string[]) => [...new Set(xs)];
  return {
    valid: errors.length === 0,
    steps,
    open: r.open,
    axioms: uniq(r.open.filter((o) => o.kind === 'axiom').map((o) => o.name!)).sort(),
    hypotheses: uniq(r.open.filter((o) => o.kind === 'hyp').map((o) => o.name!)),
    errors,
    size: steps.size,
  };
}

/** Finds t with body[t/x] ≡ target, by walking the two in parallel. */
export function inferInstance(body: Formula, x: number, target: Formula): Term | null {
  let found: Term | null = null;
  let ok = true;
  const t2 = (a: Term, b: Term, bound: boolean) => {
    if (!ok) return;
    if (bound) {
      if (!termEq(a, b)) ok = false;
      return;
    }
    if (a.k === 'var' && a.index === x) {
      if (found === null) found = b;
      else if (!termEq(found, b)) ok = false;
      return;
    }
    const [aa, bb] = unfoldPair(a, b);
    if (aa.k === 'app' && bb.k === 'app') {
      if (aa.arity !== bb.arity || aa.index !== bb.index) ok = false;
      else aa.args.forEach((arg, i) => t2(arg, bb.args[i], false));
    } else if (!termEq(aa, bb)) ok = false;
  };
  const f2 = (a: Formula, b: Formula, bound: boolean) => {
    if (!ok) return;
    if (a.k !== b.k) {
      ok = false;
      return;
    }
    switch (a.k) {
      case 'eq':
        t2(a.l, (b as typeof a).l, bound);
        t2(a.r, (b as typeof a).r, bound);
        break;
      case 'pred':
      case 'abbr': {
        const bb = b as typeof a;
        if (a.args.length !== bb.args.length) ok = false;
        else a.args.forEach((arg, i) => t2(arg, bb.args[i], bound));
        break;
      }
      case 'not':
        f2(a.a, (b as typeof a).a, bound);
        break;
      case 'and':
      case 'or':
      case 'imp':
      case 'iff':
        f2(a.a, (b as typeof a).a, bound);
        f2(a.b, (b as typeof a).b, bound);
        break;
      case 'forall':
      case 'exists': {
        const bb = b as typeof a;
        if (a.v.index !== bb.v.index) ok = false;
        else f2(a.body, bb.body, bound || a.v.index === x);
        break;
      }
    }
  };
  f2(body, target, false);
  if (!ok) return null;
  return found ?? A.zero();
}

/** Unfolds a numeral one step when compared with a successor application. */
function unfoldPair(a: Term, b: Term): [Term, Term] {
  const unfold = (n: Term): Term => {
    if (n.k === 'numeral' && n.value.k === 'lit' && n.value.v > 0n) return A.succ(A.numeral(lit(n.value.v - 1n)));
    return n;
  };
  const isSucc = (t: Term) => t.k === 'app' && t.arity === 1 && t.index === 0;
  if (a.k === 'numeral' && isSucc(b)) return [unfold(a), b];
  if (b.k === 'numeral' && isSucc(a)) return [a, unfold(b)];
  return [a, b];
}

/**
 * Is `to` obtained from `from` by replacing some occurrences of s by t? (The identity rule.)
 */
export function replaceMatch(from: Formula, to: Formula, s: Term, t: Term): boolean {
  const tm = (a: Term, b: Term): boolean => {
    if (termEq(a, b)) return true;
    if (termEq(a, s) && termEq(b, t)) return true;
    const [aa, bb] = unfoldPair(a, b);
    if (aa.k === 'app' && bb.k === 'app' && aa.arity === bb.arity && aa.index === bb.index) return aa.args.every((x, i) => tm(x, bb.args[i]));
    return false;
  };
  const fm = (a: Formula, b: Formula): boolean => {
    if (a.k !== b.k) return false;
    switch (a.k) {
      case 'bot':
      case 'top':
        return true;
      case 'eq':
        return tm(a.l, (b as typeof a).l) && tm(a.r, (b as typeof a).r);
      case 'pred':
      case 'abbr': {
        const bb = b as typeof a;
        return a.args.length === bb.args.length && (a.k !== 'abbr' || a.name === (bb as typeof a).name) && a.args.every((x, i) => tm(x, bb.args[i]));
      }
      case 'not':
        return fm(a.a, (b as typeof a).a);
      case 'and':
      case 'or':
      case 'imp':
      case 'iff':
        return fm(a.a, (b as typeof a).a) && fm(a.b, (b as typeof a).b);
      case 'forall':
      case 'exists':
        return a.v.index === (b as typeof a).v.index && fm(a.body, (b as typeof a).body);
    }
  };
  return fm(from, to);
}

// ------------------------------------------------------------------ building derivations

type Extra = Partial<Pick<Deriv, 'note' | 'group' | 'name'>>;
const mk = (rule: Rule, concl: Formula, premises: Deriv[], extra: Partial<Deriv> = {}): Deriv => ({ id: did(), rule, concl, premises, ...extra });

/** Constructors that compute conclusions where the rule determines them. */
export const D = {
  assume: (f: Formula, label?: number, x: Extra = {}) => mk('assume', f, [], { label, ...x }),
  axiom: (name: string, f: Formula, x: Extra = {}) => mk('axiom', f, [], { name, ...x }),
  hyp: (name: string, f: Formula, x: Extra = {}) => mk('hyp', f, [], { name, ...x }),
  andI: (a: Deriv, b: Deriv, x: Extra = {}) => mk('andI', A.and(a.concl, b.concl), [a, b], x),
  andE: (p: Deriv, which: 'left' | 'right', x: Extra = {}) => {
    const c = p.concl;
    if (c.k !== 'and') throw new Error('andE of a non-conjunction');
    return mk('andE', which === 'left' ? c.a : c.b, [p], x);
  },
  orI: (p: Deriv, concl: Formula, x: Extra = {}) => mk('orI', concl, [p], x),
  orE: (p: Deriv, left: Deriv, right: Deriv, label: number, x: Extra = {}) => mk('orE', left.concl, [p, left, right], { label, ...x }),
  impI: (p: Deriv, antecedent: Formula, label: number, x: Extra = {}) => mk('impI', A.imp(antecedent, p.concl), [p], { label, ...x }),
  impE: (pImp: Deriv, pA: Deriv, x: Extra = {}) => {
    const c = pImp.concl;
    if (c.k !== 'imp') throw new Error('impE of a non-conditional');
    return mk('impE', c.b, [pImp, pA], x);
  },
  notI: (p: Deriv, negated: Formula, label: number, x: Extra = {}) => mk('notI', A.not(negated), [p], { label, ...x }),
  notE: (pNot: Deriv, pA: Deriv, x: Extra = {}) => mk('notE', A.bot(), [pNot, pA], x),
  botI: (p: Deriv, concl: Formula, x: Extra = {}) => mk('botI', concl, [p], x),
  allE: (p: Deriv, t: Term, x: Extra = {}) => {
    const c = p.concl;
    if (c.k !== 'forall') throw new Error('allE of a non-universal');
    return mk('allE', subst(c.body, c.v.index, t), [p], { term: t, ...x });
  },
  allI: (p: Deriv, concl: Formula, eigen: number, x: Extra = {}) => mk('allI', concl, [p], { eigen, ...x }),
  exI: (p: Deriv, concl: Formula, t: Term, x: Extra = {}) => mk('exI', concl, [p], { term: t, ...x }),
  exE: (pEx: Deriv, pC: Deriv, eigen: number, label: number, x: Extra = {}) => mk('exE', pC.concl, [pEx, pC], { eigen, label, ...x }),
  eqI: (t: Term, x: Extra = {}) => mk('eqI', A.eq(t, A.cloneFresh(t)), [], x),
  eqE: (pEq: Deriv, pA: Deriv, concl: Formula, x: Extra = {}) => mk('eqE', concl, [pEq, pA], x),
};

/** From s = t derive t = s (by =Elim from s = t and s = s). */
export function symm(p: Deriv, x: Extra = {}): Deriv {
  const e = p.concl;
  if (e.k !== 'eq') throw new Error('symm of a non-identity');
  const refl = D.eqI(e.l, { note: 'to turn the identity around', group: x.group });
  return D.eqE(p, refl, A.eq(e.r, e.l), { note: x.note ?? 'symmetry of identity: replace the first occurrence', group: x.group });
}

/** The steps of a derivation, premises before conclusions (the order a reader follows). */
export function linearize(root: Deriv): Deriv[] {
  const out: Deriv[] = [];
  const go = (d: Deriv) => {
    d.premises.forEach(go);
    out.push(d);
  };
  go(root);
  return out;
}

export function derivSize(root: Deriv): number {
  return linearize(root).length;
}
