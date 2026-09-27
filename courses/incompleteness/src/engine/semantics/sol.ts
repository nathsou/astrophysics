// Second-order logic over finite domains (chapter "Syntax and Semantics" of second-order logic).
//
// Second-order formulas add relation variables X^n_i and function variables u^n_i, atomic
// formulas X(t_1, …, t_n), terms u(t_1, …, t_n), and quantifiers ∀X, ∃X, ∀u, ∃u. A variable
// assignment now also assigns to each n-place relation variable a relation X ⊆ |M|^n and to each
// n-place function variable a function |M|^n → |M|; x-variants are defined as before, and
//
//   M ⊨ ∀X B [s] iff for every R ⊆ |M|^n, M ⊨ B [s[R/X]]
//   M ⊨ ∃X B [s] iff for at least one R ⊆ |M|^n, M ⊨ B [s[R/X]]
//
// (and likewise for ∀u, ∃u with all functions f : |M|^n → |M|). On a finite domain these are
// finitely many — 2^(|M|^n) relations and |M|^(|M|^n) functions — so satisfaction can be computed
// by running through them all. That is only feasible for tiny domains; the evaluator refuses
// (truth 'unknown') when a quantifier has too many values or the step budget runs out.
//
// This is a small AST of its own; first-order formulas can be imported with `fromFirstOrder`.

import type { Formula, Term } from '../syntax/ast.ts';
import { constName, fnName, predName, sub, varIndex, varName } from '../syntax/language.ts';
import { parseFormula } from '../syntax/parse.ts';
import { evaluate } from '../numbers/nat.ts';
import { applyFn, holdsRel, lookupConst, numeralIn, showElem, showTuple, tupleKey, tuples, type Elem, type Structure } from './structure.ts';
import type { Truth } from './trace.ts';

// ------------------------------------------------------------------ syntax

export interface RelVar {
  index: number;
  arity: number;
}
export interface FnVar {
  index: number;
  arity: number;
}

export type SolTerm =
  | { k: 'var'; index: number }
  | { k: 'const'; index: number }
  | { k: 'app'; arity: number; index: number; args: SolTerm[] }
  /** A numeral (value as bigint), i.e., 0′…′. */
  | { k: 'numeral'; value: bigint }
  /** u(t_1, …, t_n) for a function variable u. */
  | { k: 'fvar'; u: FnVar; args: SolTerm[] };

export type SolFormula =
  | { k: 'bot' }
  | { k: 'top' }
  | { k: 'eq'; l: SolTerm; r: SolTerm }
  | { k: 'pred'; arity: number; index: number; args: SolTerm[] }
  /** X(t_1, …, t_n) for a relation variable X. */
  | { k: 'rvar'; X: RelVar; args: SolTerm[] }
  | { k: 'not'; a: SolFormula }
  | { k: 'and' | 'or' | 'imp' | 'iff'; a: SolFormula; b: SolFormula }
  | { k: 'forall' | 'exists'; v: number; body: SolFormula }
  | { k: 'forallR' | 'existsR'; X: RelVar; body: SolFormula }
  | { k: 'forallF' | 'existsF'; u: FnVar; body: SolFormula };

const obj = (x: number | string): number => {
  if (typeof x === 'number') return x;
  const i = varIndex(x);
  if (i === null) throw new Error(`“${x}” is not an object variable`);
  return i;
};

/** Constructors. Object variables may be given by name ("x") or index. */
export const S = {
  v: (x: number | string): SolTerm => ({ k: 'var', index: obj(x) }),
  c: (index: number): SolTerm => ({ k: 'const', index }),
  app: (arity: number, index: number, args: SolTerm[]): SolTerm => ({ k: 'app', arity, index, args }),
  num: (n: number | bigint): SolTerm => ({ k: 'numeral', value: BigInt(n) }),
  fv: (u: FnVar, ...args: SolTerm[]): SolTerm => ({ k: 'fvar', u, args }),
  /** The n-place relation variable X_i (X, Y, Z, X₁, …). */
  X: (index: number, arity = 1): RelVar => ({ index, arity }),
  /** The n-place function variable u_i (u, v, u₁, …). */
  U: (index: number, arity = 1): FnVar => ({ index, arity }),
  bot: (): SolFormula => ({ k: 'bot' }),
  top: (): SolFormula => ({ k: 'top' }),
  eq: (l: SolTerm, r: SolTerm): SolFormula => ({ k: 'eq', l, r }),
  pred: (arity: number, index: number, args: SolTerm[]): SolFormula => ({ k: 'pred', arity, index, args }),
  rel: (X: RelVar, ...args: SolTerm[]): SolFormula => ({ k: 'rvar', X, args }),
  not: (a: SolFormula): SolFormula => ({ k: 'not', a }),
  and: (a: SolFormula, b: SolFormula): SolFormula => ({ k: 'and', a, b }),
  or: (a: SolFormula, b: SolFormula): SolFormula => ({ k: 'or', a, b }),
  imp: (a: SolFormula, b: SolFormula): SolFormula => ({ k: 'imp', a, b }),
  iff: (a: SolFormula, b: SolFormula): SolFormula => ({ k: 'iff', a, b }),
  all: (x: number | string, body: SolFormula): SolFormula => ({ k: 'forall', v: obj(x), body }),
  ex: (x: number | string, body: SolFormula): SolFormula => ({ k: 'exists', v: obj(x), body }),
  allR: (X: RelVar, body: SolFormula): SolFormula => ({ k: 'forallR', X, body }),
  exR: (X: RelVar, body: SolFormula): SolFormula => ({ k: 'existsR', X, body }),
  allF: (u: FnVar, body: SolFormula): SolFormula => ({ k: 'forallF', u, body }),
  exF: (u: FnVar, body: SolFormula): SolFormula => ({ k: 'existsF', u, body }),
};

function termFromFO(t: Term): SolTerm {
  switch (t.k) {
    case 'var':
      return S.v(t.index);
    case 'const':
      return S.c(t.index);
    case 'app':
      return S.app(t.arity, t.index, t.args.map(termFromFO));
    case 'numeral': {
      const v = evaluate(t.value, 1 << 16);
      if (v === null) throw new Error('fromFirstOrder: the numeral is too large to evaluate');
      return S.num(v);
    }
  }
}

/** The first-order formula as a second-order formula (without second-order variables). */
export function fromFirstOrder(A: Formula): SolFormula {
  switch (A.k) {
    case 'bot':
      return S.bot();
    case 'top':
      return S.top();
    case 'eq':
      return S.eq(termFromFO(A.l), termFromFO(A.r));
    case 'pred':
      return S.pred(A.arity, A.index, A.args.map(termFromFO));
    case 'abbr':
      throw new Error(`fromFirstOrder: ${A.name}(…) is a named formula whose definition is not given`);
    case 'not':
      return S.not(fromFirstOrder(A.a));
    case 'and':
    case 'or':
    case 'imp':
    case 'iff':
      return { k: A.k, a: fromFirstOrder(A.a), b: fromFirstOrder(A.b) };
    case 'forall':
    case 'exists':
      return { k: A.k, v: A.v.index, body: fromFirstOrder(A.body) };
  }
}

// ------------------------------------------------------------------ printing

const REL_LETTERS = ['X', 'Y', 'Z'];
const FN_LETTERS = ['u', 'v'];
export const relVarName = (X: RelVar) => (X.index < REL_LETTERS.length ? REL_LETTERS[X.index] : `X${sub(X.index)}`);
export const fnVarName = (u: FnVar) => (u.index < FN_LETTERS.length ? FN_LETTERS[u.index] : `u${sub(u.index)}`);

export function solTermText(t: SolTerm): string {
  switch (t.k) {
    case 'var':
      return varName(t.index);
    case 'const':
      return constName(t.index);
    case 'numeral':
      return t.value.toString();
    case 'fvar':
      return `${fnVarName(t.u)}(${t.args.map(solTermText).join(', ')})`;
    case 'app': {
      if (t.arity === 1 && t.index === 0) return `${solTermText(t.args[0])}′`;
      if (t.arity === 2 && (t.index === 0 || t.index === 1)) return `(${solTermText(t.args[0])} ${fnName(2, t.index)} ${solTermText(t.args[1])})`;
      return `${fnName(t.arity, t.index)}(${t.args.map(solTermText).join(', ')})`;
    }
  }
}

const BIN = { and: '∧', or: '∨', imp: '→', iff: '↔' } as const;

export function solText(A: SolFormula, outer = true): string {
  switch (A.k) {
    case 'bot':
      return '⊥';
    case 'top':
      return '⊤';
    case 'eq':
      return `${solTermText(A.l)} = ${solTermText(A.r)}`;
    case 'pred':
      if (A.arity === 2 && A.index === 0) return `${solTermText(A.args[0])} < ${solTermText(A.args[1])}`;
      return `${predName(A.arity, A.index)}(${A.args.map(solTermText).join(', ')})`;
    case 'rvar':
      return `${relVarName(A.X)}(${A.args.map(solTermText).join(', ')})`;
    case 'not':
      return A.a.k === 'eq' ? `${solTermText(A.a.l)} ≠ ${solTermText(A.a.r)}` : `¬${solText(A.a, false)}`;
    case 'and':
    case 'or':
    case 'imp':
    case 'iff': {
      const s = `${solText(A.a, false)} ${BIN[A.k]} ${solText(A.b, false)}`;
      return outer ? s : `(${s})`;
    }
    case 'forall':
    case 'exists':
      return `${A.k === 'forall' ? '∀' : '∃'}${varName(A.v)} ${solText(A.body, false)}`;
    case 'forallR':
    case 'existsR':
      return `${A.k === 'forallR' ? '∀' : '∃'}${relVarName(A.X)} ${solText(A.body, false)}`;
    case 'forallF':
    case 'existsF':
      return `${A.k === 'forallF' ? '∀' : '∃'}${fnVarName(A.u)} ${solText(A.body, false)}`;
  }
}

// ------------------------------------------------------------------ assignments

const rkey = (X: RelVar) => `${X.arity}/${X.index}`;

/** A second-order variable assignment (relations as sets of tuple keys, functions as tables). */
export interface SolAssignment {
  obj: ReadonlyMap<number, Elem>;
  rel: ReadonlyMap<string, ReadonlySet<string>>;
  fn: ReadonlyMap<string, ReadonlyMap<string, Elem>>;
}

export const emptySolAssignment = (): SolAssignment => ({ obj: new Map(), rel: new Map(), fn: new Map() });

/** An assignment built from object values, relations (lists of tuples) and functions (JS functions or entries). */
export function solAssignment(parts: {
  obj?: Readonly<Record<string, Elem>>;
  rel?: readonly { X: RelVar; tuples: readonly (readonly Elem[])[] }[];
  fn?: readonly { u: FnVar; f: (...args: Elem[]) => Elem }[];
}, domain: readonly Elem[] = []): SolAssignment {
  const o = new Map<number, Elem>();
  for (const [k, e] of Object.entries(parts.obj ?? {})) o.set(/^\d+$/.test(k) ? Number(k) : obj(k), e);
  const r = new Map<string, ReadonlySet<string>>();
  for (const { X, tuples: ts } of parts.rel ?? []) r.set(rkey(X), new Set(ts.map(tupleKey)));
  const f = new Map<string, ReadonlyMap<string, Elem>>();
  for (const { u, f: fun } of parts.fn ?? []) f.set(rkey(u), new Map(tuples(domain, u.arity).map((args) => [tupleKey(args), fun(...args)])));
  return { obj: o, rel: r, fn: f };
}

/** A value a quantifier ranges over: an object, a relation, or a function. */
export type SolValue =
  | { kind: 'object'; element: Elem }
  | { kind: 'relation'; tuples: Elem[][] }
  | { kind: 'function'; table: [Elem[], Elem][] };

export function showSolValue(v: SolValue): string {
  switch (v.kind) {
    case 'object':
      return showElem(v.element);
    case 'relation':
      return `{${v.tuples.map(showTuple).join(', ')}}`;
    case 'function':
      return `{${v.table.map(([a, b]) => `${showTuple(a)} ↦ ${showElem(b)}`).join(', ')}}`;
  }
}

// ------------------------------------------------------------------ satisfaction

export interface SolTrace {
  formula: SolFormula;
  text: string;
  truth: Truth;
  clause: string;
  detail: string;
  /** Connectives: the subformula traces. Quantifiers: the trace for the witness/counterexample only. */
  children: SolTrace[];
  quantifier?: {
    kind: SolFormula['k'];
    variable: string;
    /** How many values were tried, out of how many there are. */
    tried: number;
    total: number;
    witness?: SolValue;
    counterexample?: SolValue;
  };
  reason?: string;
}

export interface SolOptions {
  /** Refuse domains larger than this (default 6). */
  maxDomain?: number;
  /** Refuse a quantifier with more values than this (default 2^20). */
  maxCandidates?: number;
  /** Give up after visiting this many formula nodes (default 5,000,000). */
  maxSteps?: number;
}

type Fail = { fail: string };
const failed = (x: unknown): x is Fail => typeof x === 'object' && x !== null && 'fail' in x;

/** Whether M ⊨ A[s] for a second-order formula, by running through all relations/functions. */
export function solSatisfies(M: Structure, s: SolAssignment, A: SolFormula, opts: SolOptions = {}): SolTrace {
  const D = M.domain;
  const maxSteps = opts.maxSteps ?? 5_000_000;
  const maxCand = opts.maxCandidates ?? 1 << 20;
  let steps = 0;
  if (D.length > (opts.maxDomain ?? 6)) {
    const reason = `the domain has ${D.length} elements; second-order quantifiers are only evaluated on domains of at most ${opts.maxDomain ?? 6}`;
    return { formula: A, text: solText(A), truth: 'unknown', clause: '(not evaluated)', detail: reason, children: [], reason };
  }

  const term = (t: SolTerm, s: SolAssignment): Elem | Fail => {
    switch (t.k) {
      case 'var':
        return s.obj.has(t.index) ? s.obj.get(t.index)! : { fail: `s assigns no value to ${varName(t.index)}` };
      case 'const':
        return lookupConst(M, t.index);
      case 'numeral':
        return numeralIn(M, t.value);
      case 'app': {
        const args: Elem[] = [];
        for (const a of t.args) {
          const v = term(a, s);
          if (failed(v)) return v;
          args.push(v);
        }
        return applyFn(M, t.arity, t.index, args);
      }
      case 'fvar': {
        const f = s.fn.get(rkey(t.u));
        if (!f) return { fail: `s assigns no function to ${fnVarName(t.u)}` };
        const args: Elem[] = [];
        for (const a of t.args) {
          const v = term(a, s);
          if (failed(v)) return v;
          args.push(v);
        }
        return f.get(tupleKey(args)) ?? { fail: `s(${fnVarName(t.u)}) has no value at ${showTuple(args)}` };
      }
    }
  };

  const and3 = (xs: Truth[]): Truth => (xs.includes(false) ? false : xs.includes('unknown') ? 'unknown' : true);
  const or3 = (xs: Truth[]): Truth => (xs.includes(true) ? true : xs.includes('unknown') ? 'unknown' : false);
  const not3 = (x: Truth): Truth => (x === 'unknown' ? 'unknown' : !x);
  const word = (t: Truth) => (t === 'unknown' ? 'unknown' : t ? 'satisfied' : 'not satisfied');

  const go = (A: SolFormula, s: SolAssignment): SolTrace => {
    steps++;
    const base = { formula: A, text: solText(A), children: [] as SolTrace[] };
    const unknown = (clause: string, reason: string): SolTrace => ({ ...base, truth: 'unknown', clause, detail: reason, reason });
    if (steps > maxSteps) return unknown('(not evaluated)', `gave up: the evaluation budget of ${maxSteps} steps is exhausted`);
    switch (A.k) {
      case 'bot':
        return { ...base, truth: false, clause: '⊥: never satisfied', detail: '' };
      case 'top':
        return { ...base, truth: true, clause: '⊤ (defined as ¬⊥): always satisfied', detail: '' };
      case 'eq': {
        const clause = 't₁ = t₂: satisfied iff the values are the same';
        const l = term(A.l, s);
        const r = term(A.r, s);
        if (failed(l)) return unknown(clause, l.fail);
        if (failed(r)) return unknown(clause, r.fail);
        return { ...base, truth: l === r, clause, detail: l === r ? `both are ${showElem(l)}` : `${showElem(l)} ≠ ${showElem(r)}` };
      }
      case 'pred':
      case 'rvar': {
        const name = A.k === 'pred' ? predName(A.arity, A.index) : relVarName(A.X);
        const clause = A.k === 'pred' ? `${name}(t₁, …, tₙ): satisfied iff the values are in ${name}^M` : `${name}(t₁, …, tₙ): satisfied iff the values are in s(${name})`;
        const args: Elem[] = [];
        for (const a of A.args) {
          const v = term(a, s);
          if (failed(v)) return unknown(clause, v.fail);
          args.push(v);
        }
        let h: boolean | Fail;
        if (A.k === 'pred') h = holdsRel(M, A.arity, A.index, args);
        else {
          const R = s.rel.get(rkey(A.X));
          h = R ? R.has(tupleKey(args)) : { fail: `s assigns no relation to ${name}` };
        }
        if (failed(h)) return unknown(clause, h.fail);
        return { ...base, truth: h, clause, detail: `${showTuple(args)} ${h ? '∈' : '∉'} ${A.k === 'pred' ? `${name}^M` : `s(${name})`}` };
      }
      case 'not': {
        const b = go(A.a, s);
        return { ...base, children: [b], truth: not3(b.truth), clause: '¬B: satisfied iff B is not', detail: `B is ${word(b.truth)}`, ...(b.reason ? { reason: b.reason } : {}) };
      }
      case 'and':
      case 'or':
      case 'imp':
      case 'iff': {
        const b = go(A.a, s);
        const c = go(A.b, s);
        const truth =
          A.k === 'and' ? and3([b.truth, c.truth])
          : A.k === 'or' ? or3([b.truth, c.truth])
          : A.k === 'imp' ? or3([not3(b.truth), c.truth])
          : and3([or3([not3(b.truth), c.truth]), or3([not3(c.truth), b.truth])]);
        const clause = {
          and: 'B ∧ C: satisfied iff both are',
          or: 'B ∨ C: satisfied iff at least one is',
          imp: 'B → C: satisfied iff B is not or C is',
          iff: 'B ↔ C (defined as (B → C) ∧ (C → B)): satisfied iff both or neither',
        }[A.k];
        const reason = truth === 'unknown' ? (b.reason ?? c.reason) : undefined;
        return { ...base, children: [b, c], truth, clause, detail: `B is ${word(b.truth)}, C is ${word(c.truth)}`, ...(reason ? { reason } : {}) };
      }
      default:
        return quant(A, s);
    }
  };

  const quant = (A: Extract<SolFormula, { k: 'forall' | 'exists' | 'forallR' | 'existsR' | 'forallF' | 'existsF' }>, s: SolAssignment): SolTrace => {
    const all = A.k === 'forall' || A.k === 'forallR' || A.k === 'forallF';
    const q = all ? '∀' : '∃';
    let name: string;
    let what: string;
    let total: number;
    let candidates: Iterable<[SolAssignment, SolValue]>;
    if ('v' in A) {
      const x = A.v;
      name = varName(x);
      what = `element m of |M|`;
      total = D.length;
      candidates = D.map((m) => [{ ...s, obj: new Map(s.obj).set(x, m) }, { kind: 'object', element: m }]);
    } else if ('X' in A) {
      const X = A.X;
      name = relVarName(X);
      const ts = tuples(D, X.arity);
      what = `relation R ⊆ |M|^${X.arity}`;
      total = 2 ** ts.length;
      candidates = (function* () {
        for (let mask = 0; mask < total; mask++) {
          const chosen = ts.filter((_, i) => Math.floor(mask / 2 ** i) % 2 === 1);
          yield [{ ...s, rel: new Map(s.rel).set(rkey(X), new Set(chosen.map(tupleKey))) }, { kind: 'relation', tuples: chosen }];
        }
      })();
    } else {
      const u = A.u;
      name = fnVarName(u);
      const ts = tuples(D, u.arity);
      what = `function f: |M|^${u.arity} → |M|`;
      total = D.length ** ts.length;
      candidates = (function* () {
        const digits = ts.map(() => 0);
        for (let n = 0; n < total; n++) {
          const table: [Elem[], Elem][] = ts.map((args, i) => [args, D[digits[i]]]);
          yield [{ ...s, fn: new Map(s.fn).set(rkey(u), new Map(table.map(([a, b]) => [tupleKey(a), b]))) }, { kind: 'function', table }];
          for (let i = 0; i < digits.length; i++) {
            if (++digits[i] < D.length) break;
            digits[i] = 0;
          }
        }
      })();
    }
    const clause = all ? `${q}${name} B: satisfied iff B is satisfied for every ${what} assigned to ${name}` : `${q}${name} B: satisfied iff B is satisfied for at least one ${what} assigned to ${name}`;
    const base = { formula: A, text: solText(A), clause };
    if (total > maxCand) {
      const reason = `${q}${name} would have to run through ${total} values (more than ${maxCand})`;
      return { ...base, truth: 'unknown', detail: reason, reason, children: [] };
    }
    let tried = 0;
    let unknownReason: string | undefined;
    for (const [s2, val] of candidates) {
      tried++;
      const t = go(A.body, s2);
      if (t.truth === !all) {
        return {
          ...base, truth: !all, children: [t],
          detail: `${all ? 'counterexample' : 'witness'}: ${name} = ${showSolValue(val)}`,
          quantifier: { kind: A.k, variable: name, tried, total, ...(all ? { counterexample: val } : { witness: val }) },
        };
      }
      if (t.truth === 'unknown' && unknownReason === undefined) unknownReason = t.reason ?? 'unknown';
      if (steps > maxSteps) {
        unknownReason = `gave up: the evaluation budget of ${maxSteps} steps is exhausted`;
        break;
      }
    }
    const quantifier = { kind: A.k, variable: name, tried, total };
    if (unknownReason !== undefined) return { ...base, truth: 'unknown', detail: unknownReason, reason: unknownReason, children: [], quantifier };
    return {
      ...base, truth: all, children: [], quantifier,
      detail: all ? `all ${total} values of ${name} satisfy B` : `none of the ${total} values of ${name} satisfies B`,
    };
  };

  return go(A, s);
}

/** For a sentence (no free variables of any kind): whether M ⊨ A. */
export function solTrueIn(M: Structure, A: SolFormula, opts: SolOptions = {}): SolTrace {
  return solSatisfies(M, emptySolAssignment(), A, opts);
}

// ------------------------------------------------------------------ examples from the book

const x = S.v('x');
const y = S.v('y');
const z = S.v('z');
const X1 = S.X(0, 1);
const u1 = S.U(0, 1);

/**
 * Inf ≡ ∃u (∀x ∀y (u(x) = u(y) → x = y) ∧ ∃y ∀x y ≠ u(x)): there is an injective function on
 * the domain that is not surjective — the domain is (Dedekind) infinite. False in every finite
 * structure.
 */
export function solInf(): SolFormula {
  return S.exF(u1, S.and(
    S.all('x', S.all('y', S.imp(S.eq(S.fv(u1, x), S.fv(u1, y)), S.eq(x, y)))),
    S.ex('y', S.all('x', S.not(S.eq(y, S.fv(u1, x))))),
  ));
}

/** Fin ≡ ¬Inf: the domain is finite. */
export function solFin(): SolFormula {
  return S.not(solInf());
}

/**
 * Count ≡ ∃z ∃u ∀X ((X(z) ∧ ∀x (X(x) → X(u(x)))) → ∀x X(x)): the domain is z, u(z), u(u(z)), …
 * — it is enumerable. True in every finite structure.
 */
export function solCount(): SolFormula {
  return S.ex('z', S.exF(u1, S.allR(X1, S.imp(
    S.and(S.rel(X1, z), S.all('x', S.imp(S.rel(X1, x), S.rel(X1, S.fv(u1, x))))),
    S.all('x', S.rel(X1, x)),
  ))));
}

/** ∀X (X(x) ↔ X(y)) — defines identity without =: x and y are elements of the same subsets. */
export function solIdentity(): SolFormula {
  return S.allR(X1, S.iff(S.rel(X1, x), S.rel(X1, y)));
}

/** ∀X (X(x) → X(y)) — also defines identity (the book's problem). */
export function solIdentityImp(): SolFormula {
  return S.allR(X1, S.imp(S.rel(X1, x), S.rel(X1, y)));
}

/**
 * B_R(X) ≡ ∀x ∀y (R(x, y) → X(x, y)) ∧ ∀x ∀y ∀z ((X(x, y) ∧ X(y, z)) → X(x, z)): X is a
 * transitive relation including R. `R` is a 2-place predicate symbol (arity, index).
 */
export function solTransitiveIncluding(R: { arity: number; index: number }, X: RelVar): SolFormula {
  return S.and(
    S.all('x', S.all('y', S.imp(S.pred(R.arity, R.index, [x, y]), S.rel(X, x, y)))),
    S.all('x', S.all('y', S.all('z', S.imp(S.and(S.rel(X, x, y), S.rel(X, y, z)), S.rel(X, x, z))))),
  );
}

/** R*(X) ≡ B_R(X) ∧ ∀Y (B_R(Y) → ∀x ∀y (X(x, y) → Y(x, y))): X is the transitive closure of R. */
export function solTransitiveClosure(R: { arity: number; index: number }, X: RelVar = S.X(0, 2), Y: RelVar = S.X(1, 2)): SolFormula {
  return S.and(
    solTransitiveIncluding(R, X),
    S.allR(Y, S.imp(solTransitiveIncluding(R, Y), S.all('x', S.all('y', S.imp(S.rel(X, x, y), S.rel(Y, x, y)))))),
  );
}

/**
 * The first-order version of Dedekind infinity with a function symbol f (the book's section
 * "Describing Infinite and Enumerable Domains"): ∀x ∀y (f(x) = f(y) → x = y) ∧ ∃y ∀x y ≠ f(x).
 * No finite structure satisfies it, whatever f^M is.
 */
export function dedekindInfinityFO(): Formula {
  return parseFormula('∀x ∀y (f(x) = f(y) → x = y) ∧ ∃y ∀x ¬y = f(x)');
}
