// The recursive definitions of value and satisfaction (section "Satisfaction of a Formula in a
// Structure"), computed with a trace: one trace node for each clause of the definition that is
// used, with the assignment at that point, the clause, and the values found. The same evaluator
// serves finite structures (satisfaction.ts) and the bounded formulas of the standard model ℕ
// (standard.ts); they differ only in how symbols are interpreted and which x-variants a
// quantifier has to run through.

import type { Formula, NodeId, Term } from '../syntax/ast.ts';
import { constName, fnName, predName, varName } from '../syntax/language.ts';
import { formulaText, termText } from '../syntax/print.ts';
import { show as showNat, type Nat } from '../numbers/nat.ts';
import { showAssignment, variant, type Assignment } from './assignment.ts';

/** true, false, or 'unknown' (the formula could not be evaluated; `reason` says why). */
export type Truth = boolean | 'unknown';

export type Fail = { fail: string };
export function isFail(x: unknown): x is Fail {
  return typeof x === 'object' && x !== null && 'fail' in x;
}

export interface TermTrace<E> {
  kind: 'term';
  /** The id of the term node in the AST. */
  node: NodeId;
  term: Term;
  text: string;
  /** The value, or null if it has none (see `reason`). */
  value: E | null;
  /** The clause of the definition of value used, e.g. "x: the value is s(x)". */
  clause: string;
  /** The computation at this node, e.g. "+^M(2, 3) = 0". */
  detail: string;
  children: TermTrace<E>[];
  reason?: string;
}

export interface VariantTry<E> {
  /** m, for the x-variant s[m/x]. */
  element: E;
  truth: Truth;
  /** The trace of the body under s[m/x] (null when traces are switched off). */
  trace: FormulaTrace<E> | null;
}

export interface QuantifierInfo<E> {
  kind: 'forall' | 'exists';
  variable: number;
  /** The x-variants s[m/x] tried, in order. */
  variants: VariantTry<E>[];
  /** For a satisfied ∃: the element m with M ⊨ B[s[m/x]]. */
  witness?: E;
  /** For an unsatisfied ∀: the element m with M ⊭ B[s[m/x]]. */
  counterexample?: E;
  /** Which x-variants have to be considered (e.g. "all 5 elements of |M|"). */
  range: string;
  /** For bounded quantifiers in ℕ: the value of the bound t. */
  bound?: TermTrace<E>;
}

export interface FormulaTrace<E> {
  kind: 'formula';
  /** The id of the formula node in the AST. The same node is visited once per assignment. */
  node: NodeId;
  formula: Formula;
  text: string;
  truth: Truth;
  /** The clause of the definition of satisfaction used, e.g. "∀x B: every x-variant satisfies B". */
  clause: string;
  /** Why the clause gives this truth value here. */
  detail: string;
  /** The assignment s at this point. */
  assignment: Assignment<E>;
  /** For atomic formulas: the values of the terms. */
  terms: TermTrace<E>[];
  /** Subformula traces (for quantifiers: one per x-variant tried). */
  children: FormulaTrace<E>[];
  quantifier?: QuantifierInfo<E>;
  /** When truth is 'unknown': why. */
  reason?: string;
}

export interface QuantRange<E> {
  elements: Iterable<E>;
  /** How many elements there are, if known. */
  count?: number;
  /** Which x-variants are tried, e.g. "all 5 elements of |M|". */
  description: string;
  /** What holds of the remaining x-variants (for bounded quantifiers). */
  rest?: string;
  bound?: TermTrace<E>;
  /**
   * The elements are only some of the x-variants (an infinite domain searched up to a limit).
   * A witness (∃) or counterexample (∀) among them still decides the quantifier; not finding
   * one decides nothing, and the result is then 'unknown'.
   */
  partial?: boolean;
}

/** How a structure interprets the symbols, and which x-variants a quantifier runs through. */
export interface Interp<E> {
  /** "M", "ℤ_5", "ℕ" … */
  name: string;
  show(e: E): string;
  constant(index: number): E | Fail;
  apply(arity: number, index: number, args: E[]): E | Fail;
  holds(arity: number, index: number, args: E[]): boolean | Fail;
  numeral(value: Nat): E | Fail;
  range(q: Formula & { k: 'forall' | 'exists' }, s: Assignment<E>, evalTerm: (t: Term) => TermTrace<E>): QuantRange<E> | Fail;
}

export interface EvalOptions {
  /**
   * Try every x-variant even after a counterexample (∀) or witness (∃) is found, as the letter
   * of the definition does. Default false: stop at the first decisive x-variant.
   */
  exhaustive?: boolean;
  /** Keep the traces of subformulas (default true). Off: only truth values and elements tried. */
  trace?: boolean;
  /** Give up (truth 'unknown') after visiting this many formula nodes. Default 2,000,000. */
  maxSteps?: number;
}

interface Ctx<E> {
  I: Interp<E>;
  exhaustive: boolean;
  keep: boolean;
  maxSteps: number;
  steps: number;
  texts: Map<NodeId, string>;
}

export function makeCtx<E>(I: Interp<E>, o: EvalOptions = {}): Ctx<E> {
  return { I, exhaustive: o.exhaustive ?? false, keep: o.trace ?? true, maxSteps: o.maxSteps ?? 2_000_000, steps: 0, texts: new Map() };
}

function fText<E>(ctx: Ctx<E>, A: Formula): string {
  let t = ctx.texts.get(A.id);
  if (t === undefined) ctx.texts.set(A.id, (t = formulaText(A)));
  return t;
}

const sup = (name: string, M: string) => `${name}^${M}`;

// ------------------------------------------------------------------ terms

export function evalTermIn<E>(ctx: Ctx<E>, t: Term, s: Assignment<E>): TermTrace<E> {
  const { I } = ctx;
  const base = { kind: 'term' as const, node: t.id, term: t, text: termText(t) };
  const fail = (clause: string, reason: string, children: TermTrace<E>[] = []): TermTrace<E> => ({ ...base, value: null, clause, detail: reason, children, reason });
  switch (t.k) {
    case 'var': {
      const clause = `${varName(t.index)} (a variable): its value is s(${varName(t.index)})`;
      if (!s.has(t.index)) return fail(clause, `the assignment s does not assign a value to ${varName(t.index)}`);
      const v = s.get(t.index) as E;
      return { ...base, value: v, clause, detail: `s(${varName(t.index)}) = ${I.show(v)}`, children: [] };
    }
    case 'const': {
      const name = constName(t.index);
      const clause = `${name} (a constant): its value is ${sup(name, I.name)}`;
      const v = I.constant(t.index);
      if (isFail(v)) return fail(clause, v.fail);
      return { ...base, value: v, clause, detail: `${sup(name, I.name)} = ${I.show(v)}`, children: [] };
    }
    case 'numeral': {
      const clause = 'n̄ (a numeral, i.e., 0′…′ with n primes): its value is the n-th successor of the value of 0';
      const v = I.numeral(t.value);
      if (isFail(v)) return fail(clause, v.fail);
      return { ...base, value: v, clause, detail: `${showNat(t.value)}̄ has value ${I.show(v)}`, children: [] };
    }
    case 'app': {
      const name = fnName(t.arity, t.index);
      const clause = `${name}(t₁, …, t${t.arity === 1 ? '₁' : 'ₙ'}): its value is ${sup(name, I.name)} applied to the values of the arguments`;
      const children = t.args.map((a) => evalTermIn(ctx, a, s));
      if (children.some((c) => c.value === null)) return fail(clause, 'an argument has no value', children);
      const args = children.map((c) => c.value as E);
      const v = I.apply(t.arity, t.index, args);
      if (isFail(v)) return fail(clause, v.fail, children);
      return { ...base, value: v, clause, detail: `${sup(name, I.name)}(${args.map(I.show).join(', ')}) = ${I.show(v)}`, children };
    }
  }
}

// ------------------------------------------------------------------ formulas

const and3 = (xs: Truth[]): Truth => (xs.includes(false) ? false : xs.includes('unknown') ? 'unknown' : true);
const or3 = (xs: Truth[]): Truth => (xs.includes(true) ? true : xs.includes('unknown') ? 'unknown' : false);
const not3 = (x: Truth): Truth => (x === 'unknown' ? 'unknown' : !x);
const word = (t: Truth) => (t === 'unknown' ? 'unknown' : t ? 'satisfied' : 'not satisfied');

export function evalFormulaIn<E>(ctx: Ctx<E>, A: Formula, s: Assignment<E>): FormulaTrace<E> {
  const { I } = ctx;
  ctx.steps++;
  const base = { kind: 'formula' as const, node: A.id, formula: A, text: fText(ctx, A), assignment: s, terms: [] as TermTrace<E>[], children: [] as FormulaTrace<E>[] };
  const unknown = (clause: string, reason: string, extra: Partial<FormulaTrace<E>> = {}): FormulaTrace<E> => ({ ...base, truth: 'unknown', clause, detail: reason, reason, ...extra });
  if (ctx.steps > ctx.maxSteps) return unknown('(not evaluated)', `gave up: the evaluation budget of ${ctx.maxSteps} steps is exhausted`);
  const keep = (ts: FormulaTrace<E>[]) => (ctx.keep ? ts : []);

  switch (A.k) {
    case 'bot':
      return { ...base, truth: false, clause: '⊥: never satisfied', detail: `${I.name} ⊭ ⊥[s]` };
    case 'top':
      return { ...base, truth: true, clause: '⊤ (defined as ¬⊥): always satisfied, since ⊥ never is', detail: `${I.name} ⊨ ⊤[s]` };
    case 'abbr':
      return unknown(
        `${A.name}(…) (a named formula)`,
        `${A.name} stands for a formula of arithmetic that is not spelled out here, so its satisfaction cannot be computed`,
        { terms: A.args.map((t) => evalTermIn(ctx, t, s)) },
      );
    case 'eq': {
      const clause = 't₁ = t₂: satisfied iff t₁ and t₂ have the same value';
      const terms = [evalTermIn(ctx, A.l, s), evalTermIn(ctx, A.r, s)];
      const bad = terms.find((t) => t.value === null);
      if (bad) return unknown(clause, `the term ${bad.text} has no value: ${bad.reason}`, { terms });
      const [l, r] = terms.map((t) => t.value as E);
      const truth = l === r;
      return { ...base, terms, truth, clause, detail: truth ? `both values are ${I.show(l)}` : `the values differ: ${I.show(l)} ≠ ${I.show(r)}` };
    }
    case 'pred': {
      const name = predName(A.arity, A.index);
      const clause = `${name}(t₁, …, tₙ): satisfied iff the tuple of values is in ${sup(name, I.name)}`;
      const terms = A.args.map((t) => evalTermIn(ctx, t, s));
      const bad = terms.find((t) => t.value === null);
      if (bad) return unknown(clause, `the term ${bad.text} has no value: ${bad.reason}`, { terms });
      const args = terms.map((t) => t.value as E);
      const h = I.holds(A.arity, A.index, args);
      if (isFail(h)) return unknown(clause, h.fail, { terms });
      const tup = args.length === 1 ? I.show(args[0]) : `⟨${args.map(I.show).join(', ')}⟩`;
      return { ...base, terms, truth: h, clause, detail: `${tup} ${h ? '∈' : '∉'} ${sup(name, I.name)}` };
    }
    case 'not': {
      const b = evalFormulaIn(ctx, A.a, s);
      const truth = not3(b.truth);
      return { ...base, children: keep([b]), truth, clause: '¬B: satisfied iff B is not satisfied', detail: `B is ${word(b.truth)}`, ...(truth === 'unknown' ? { reason: b.reason ?? 'B is unknown' } : {}) };
    }
    case 'and':
    case 'or':
    case 'imp':
    case 'iff': {
      const b = evalFormulaIn(ctx, A.a, s);
      const c = evalFormulaIn(ctx, A.b, s);
      let truth: Truth;
      let clause: string;
      switch (A.k) {
        case 'and':
          truth = and3([b.truth, c.truth]);
          clause = 'B ∧ C: satisfied iff B and C both are';
          break;
        case 'or':
          truth = or3([b.truth, c.truth]);
          clause = 'B ∨ C: satisfied iff B or C (or both) is';
          break;
        case 'imp':
          truth = or3([not3(b.truth), c.truth]);
          clause = 'B → C: satisfied iff B is not satisfied or C is (or both)';
          break;
        case 'iff':
          truth = and3([or3([not3(b.truth), c.truth]), or3([not3(c.truth), b.truth])]);
          clause = 'B ↔ C (defined as (B → C) ∧ (C → B)): satisfied iff B and C are both satisfied or both not';
          break;
      }
      const reason = truth === 'unknown' ? (b.truth === 'unknown' ? b.reason : c.reason) : undefined;
      return { ...base, children: keep([b, c]), truth, clause, detail: `B is ${word(b.truth)}, C is ${word(c.truth)}`, ...(reason !== undefined ? { reason } : {}) };
    }
    case 'forall':
    case 'exists': {
      const x = A.v.index;
      const xn = varName(x);
      const all = A.k === 'forall';
      const clause = all
        ? `∀${xn} B: satisfied iff every ${xn}-variant of s satisfies B`
        : `∃${xn} B: satisfied iff at least one ${xn}-variant of s satisfies B`;
      const r = I.range(A as Formula & { k: 'forall' | 'exists' }, s, (t) => evalTermIn(ctx, t, s));
      if (isFail(r)) return unknown(clause, r.fail);
      const variants: VariantTry<E>[] = [];
      let decisive: E | undefined;
      let found = false;
      let exhausted = false;
      for (const m of r.elements) {
        if (ctx.steps > ctx.maxSteps) {
          exhausted = true;
          break;
        }
        const sub = evalFormulaIn(ctx, A.body, variant(s, x, m));
        variants.push({ element: m, truth: sub.truth, trace: ctx.keep ? sub : null });
        if (sub.truth === !all && !found) {
          found = true;
          decisive = m;
          if (!ctx.exhaustive) break;
        }
      }
      const q: QuantifierInfo<E> = { kind: A.k, variable: x, variants, range: r.description, ...(r.bound ? { bound: r.bound } : {}) };
      if (found) {
        if (all) q.counterexample = decisive;
        else q.witness = decisive;
      }
      const children = keep(variants.flatMap((v) => (v.trace ? [v.trace] : [])));
      const terms = r.bound ? [r.bound] : [];
      const m = found ? I.show(decisive as E) : '';
      if (found) {
        return {
          ...base, terms, children, quantifier: q, truth: !all, clause,
          detail: all
            ? `counterexample: the ${xn}-variant s[${m}/${xn}] does not satisfy B`
            : `witness: the ${xn}-variant s[${m}/${xn}] satisfies B`,
        };
      }
      const unk = variants.find((v) => v.truth === 'unknown');
      if (exhausted || unk) {
        const reason = exhausted
          ? `gave up after ${variants.length} ${xn}-variants: the evaluation budget of ${ctx.maxSteps} steps is exhausted`
          : r.partial
            ? `no ${all ? 'counterexample' : 'witness'} among ${r.description}, and for some of them (first ${xn} = ${I.show(unk!.element)}) B itself could not be settled; the domain has further elements`
            : `B is unknown for ${xn} = ${I.show(unk!.element)}${unk!.trace?.reason ? `: ${unk!.trace.reason}` : ''}`;
        return { ...base, terms, children, quantifier: q, truth: 'unknown', clause, detail: reason, reason };
      }
      const n = variants.length;
      if (r.partial) {
        const reason = `no ${all ? 'counterexample' : 'witness'} among ${r.description}; the domain has further elements, so this does not settle the quantifier`;
        return { ...base, terms, children, quantifier: q, truth: 'unknown', clause, detail: reason, reason };
      }
      const rest = r.rest ? `; ${r.rest}` : '';
      return {
        ...base, terms, children, quantifier: q, truth: all, clause,
        detail: all
          ? `each of the ${n} ${xn}-variant${n === 1 ? '' : 's'} s[m/${xn}] (m ranging over ${r.description}) satisfies B${rest}`
          : `none of the ${n} ${xn}-variant${n === 1 ? '' : 's'} s[m/${xn}] (m ranging over ${r.description}) satisfies B${rest}`,
      };
    }
  }
}

// ------------------------------------------------------------------ reading traces

export interface Binding<E> {
  variable: number;
  element: E;
  quantifier: 'forall' | 'exists';
  /** A witness for a satisfied ∃, or a counterexample to an unsatisfied ∀. */
  role: 'witness' | 'counterexample';
  node: NodeId;
}

/**
 * Follows a trace down to what decides its truth value: through a counterexample for a false ∀,
 * a witness for a true ∃, a false conjunct, a true disjunct, etc. The bindings collected on the
 * way are the counterexample (or witnessing) assignment. The path stops where the reason is
 * "all of them" (a true ∀, a false ∃, a true ∧, …) or at an atomic formula.
 */
export function decisivePath<E>(t: FormulaTrace<E>): { bindings: Binding<E>[]; path: FormulaTrace<E>[]; leaf: FormulaTrace<E> } {
  const bindings: Binding<E>[] = [];
  const path: FormulaTrace<E>[] = [t];
  let cur = t;
  for (;;) {
    let next: FormulaTrace<E> | null | undefined;
    const q = cur.quantifier;
    if (q) {
      const m = q.kind === 'forall' ? q.counterexample : q.witness;
      if (m !== undefined && cur.truth === (q.kind === 'exists')) {
        const v = q.variants.find((x) => x.element === m);
        bindings.push({ variable: q.variable, element: m, quantifier: q.kind, role: q.kind === 'exists' ? 'witness' : 'counterexample', node: cur.node });
        next = v?.trace;
      }
    } else if (cur.children.length > 0 && cur.truth !== 'unknown') {
      const [b, c] = cur.children;
      switch (cur.formula.k) {
        case 'not':
          next = b;
          break;
        case 'and':
          next = cur.truth ? null : cur.children.find((x) => x.truth === false);
          break;
        case 'or':
          next = cur.truth ? cur.children.find((x) => x.truth === true) : null;
          break;
        case 'imp':
          next = cur.truth ? (b.truth === false ? b : c) : c;
          break;
        default:
          next = null;
      }
    }
    if (!next) return { bindings, path, leaf: cur };
    path.push(next);
    cur = next;
  }
}

/** The number of formula and term nodes in a trace. */
export function traceSize<E>(t: FormulaTrace<E>): number {
  const termSize = (x: TermTrace<E>): number => 1 + x.children.reduce((a, c) => a + termSize(c), 0);
  return 1 + t.terms.reduce((a, x) => a + termSize(x), 0) + t.children.reduce((a, c) => a + traceSize(c), 0);
}

/** A plain-text rendering, one line per node, indented (for debugging and plain displays). */
export function formatTrace<E>(t: FormulaTrace<E>, show: (e: E) => string = String, opts: { maxLines?: number } = {}): string {
  const lines: string[] = [];
  const max = opts.maxLines ?? 400;
  const mark = (x: Truth) => (x === 'unknown' ? '?' : x ? '⊨' : '⊭');
  const go = (n: FormulaTrace<E>, depth: number) => {
    if (lines.length >= max) return;
    const pad = '  '.repeat(depth);
    lines.push(`${pad}${mark(n.truth)} ${n.text}   [${showAssignment(n.assignment, show)}]`);
    lines.push(`${pad}    ${n.clause} — ${n.detail}`);
    for (const c of n.children) go(c, depth + 1);
  };
  go(t, 0);
  if (lines.length >= max) lines.push('…');
  return lines.join('\n');
}
