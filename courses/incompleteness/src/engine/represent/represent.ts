// Representing formulas (chapter Representability in Q).
//
// For functions built from zero, succ, projections, add, mult and χ= by composition and regular
// minimization, `representing` builds the formula A_f(x_0, …, x_{k-1}, y) exactly as the book
// does (sections Basic Functions…, Composition…, Regular Minimization… are Representable in Q),
// and records which subformula comes from which part of the function's definition.
//
// For a particular input, `deriveClauseA` / `deriveClauseB` build derivations in Q of
//   (a)  A_f(n̄_0, …, n̄_{k-1}, m̄)                   where m = f(n_0, …, n_{k-1})
//   (b)  ∀y (A_f(n̄_0, …, n̄_{k-1}, y) → y = m̄)
// using the computation of f as the source of witnesses. For a minimization the derivations
// follow the book's proof (Proposition rep-minimization): they use the lemmas about < —
// less-zero, less-nsucc and trichotomy — whose derivations are generated in proof/less.ts, and
// Q8, which the checker gets with ↔ written out (qUnfolded); `axioms` says which theory to check
// against.

import * as A from '../syntax/ast.ts';
import type { Formula, NodeId, Term } from '../syntax/ast.ts';
import { freshConstIndex } from '../syntax/ops.ts';
import { subst } from '../syntax/subst.ts';
import { arity, evaluate, type RF } from '../recursive/rf.ts';
import { D, symm, type Deriv } from '../proof/nd.ts';
import { deriveAdd, deriveMult, deriveNeq, num, Q } from '../proof/q.ts';
import { deriveLessZero, qUnfolded } from '../proof/arith.ts';
import { deriveLessNSucc, deriveTrichotomy, LESS_MAX, orCases } from '../proof/less.ts';
import { numeralValue } from '../syntax/ops.ts';
import { constName } from '../syntax/language.ts';
import { varIndex } from '../syntax/language.ts';

export interface Representation {
  formula: Formula;
  inputs: number[];
  output: number;
  /** subformula id → function node id */
  origin: Map<NodeId, string>;
  /** function node id → the subformula representing it (the outermost one) */
  formulaOf: Map<string, NodeId>;
}

export type RepresentError = { error: string; id?: string };

/** Fresh bound variables, named as the book names them: y₀, y₁, … and w, w₀, w₁, … */
class VarPool {
  used: Set<number>;
  constructor(avoid: number[]) {
    this.used = new Set(avoid);
  }
  fresh(family: 'y' | 'w' = 'y'): number {
    const names = family === 'y' ? Array.from({ length: 200 }, (_, k) => `y_${k}`) : ['w', ...Array.from({ length: 200 }, (_, k) => `w_${k}`)];
    for (const n of names) {
      const i = varIndex(n)!;
      if (!this.used.has(i)) {
        this.used.add(i);
        return i;
      }
    }
    throw new Error('out of variables');
  }
}

/** Input variables x_0, x_1, … and output y, as the book writes them. */
export function standardVars(k: number): { inputs: number[]; output: number } {
  return { inputs: Array.from({ length: k }, (_, i) => varIndex(`x_${i}`)!), output: varIndex('y')! };
}

export function representing(f: RF): Representation | RepresentError {
  const ar = arity(f);
  if (!ar.ok) return { error: ar.errors[0].message, id: ar.errors[0].id };
  const { inputs, output } = standardVars(ar.arity);
  const origin = new Map<NodeId, string>();
  const formulaOf = new Map<string, NodeId>();
  const pool = new VarPool([...inputs, output]);

  const build = (g: RF, ins: Term[], out: Term): Formula => {
    let r: Formula;
    switch (g.k) {
      case 'zero':
        r = A.eq(out, A.zero());
        break;
      case 'succ':
        r = A.eq(out, A.succ(ins[0]));
        break;
      case 'proj':
        r = A.eq(out, ins[g.i]);
        break;
      case 'basic':
        if (g.name === 'add') r = A.eq(out, A.plus(ins[0], ins[1]));
        else if (g.name === 'mult') r = A.eq(out, A.times(ins[0], ins[1]));
        else {
          // (x0 = x1 ∧ y = 1̄) ∨ (¬ x0 = x1 ∧ y = 0̄)
          r = A.or(
            A.and(A.eq(ins[0], A.cloneFresh(ins[1])), A.eq(out, num(1))),
            A.and(A.not(A.eq(A.cloneFresh(ins[0]), A.cloneFresh(ins[1]))), A.eq(A.cloneFresh(out), A.zero())),
          );
        }
        break;
      case 'def':
        r = build(g.body, ins, out);
        break;
      case 'comp': {
        // ∃y0 … ∃y_{k-1} (A_g0(x⃗, y0) ∧ … ∧ A_g{k-1}(x⃗, y_{k-1}) ∧ A_f(y⃗, z))
        const ys = g.gs.map(() => pool.fresh());
        const parts = g.gs.map((h, i) => build(h, ins.map((t) => A.cloneFresh(t)), A.v(ys[i])));
        parts.push(build(g.f, ys.map((y) => A.v(y)), out));
        let body = parts[0];
        for (let i = 1; i < parts.length; i++) body = A.and(body, parts[i]);
        r = body;
        for (let i = ys.length - 1; i >= 0; i--) r = A.exists(A.v(ys[i]), r);
        break;
      }
      case 'min': {
        // A_g(y, z⃗, 0) ∧ ∀w (w < y → ¬ A_g(w, z⃗, 0))
        // The same A_g twice (the same bound variables too — the proof needs ¬A_g(t, …) and
        // A_g(t, …) to be the same sentence): the second copy has w in place of the output.
        const w = pool.fresh('w');
        const first = build(g.f, [out, ...ins], A.zero());
        const copied = new Map<NodeId, NodeId>();
        const below = A.cloneFresh(first, copied);
        for (const [nid, oid] of copied) {
          const o = origin.get(oid);
          if (o !== undefined) origin.set(nid, o);
        }
        if (out.k !== 'var') throw new Error('min: the output must be a variable');
        A.walk(below, (n) => {
          if (n.k === 'var' && n.index === out.index) (n as A.Var).index = w;
        });
        r = A.and(first, A.forall(A.v(w), A.imp(A.less(A.v(w), A.cloneFresh(out)), A.not(below))));
        break;
      }
      case 'rec':
        throw new RecError(g.id);
    }
    A.walk(r, (n) => {
      if (!A.isTerm(n) && !origin.has(n.id)) origin.set(n.id, g.id);
    });
    formulaOf.set(g.id, r.id);
    return r;
  };
  try {
    const formula = build(f, inputs.map((i) => A.v(i)), A.v(output));
    return { formula, inputs, output, origin, formulaOf };
  } catch (e) {
    if (e instanceof RecError) {
      return {
        error: 'primitive recursion has no direct representing formula: the book first eliminates it using the β-function, so that only composition and minimization remain',
        id: e.id,
      };
    }
    throw e;
  }
}

class RecError extends Error {
  id: string;
  constructor(id: string) {
    super('rec');
    this.id = id;
  }
}

/** A_f(n̄⃗, t): the representing formula with numerals for the inputs and t for the output. */
export function instance(rep: Representation, args: bigint[], out: Term): Formula {
  let f = rep.formula;
  rep.inputs.forEach((x, i) => {
    f = subst(f, x, num(args[i]));
  });
  return subst(f, rep.output, out);
}

// ------------------------------------------------------------------ derivations

export interface ClauseDerivations {
  value: bigint;
  /** The theory to check against: Q, or Q with Q8 written out (when < is used, for minimization). */
  axioms: Map<string, Formula>;
  /** f contains a minimization: the derivations use the lemmas about < and Q8. */
  minimization: boolean;
  /** Q ⊢ A_f(n̄⃗, m̄) */
  a: Deriv;
  /** Q ⊢ ∀y (A_f(n̄⃗, y) → y = m̄) */
  b: Deriv;
}

export type DeriveResult = ClauseDerivations | { error: string };

interface Ctx {
  labels: { next: number };
  /** eigenvariable constants in use */
  consts: Set<number>;
}

/**
 * Derivations of clauses (a) and (b) for f at the given arguments. Each builder is driven by
 * the sentence it must derive (read off the representing formula), and by the computation of
 * f, which supplies the witnesses for the existential quantifiers.
 */
export function deriveClauses(f: RF, args: bigint[]): DeriveResult {
  const rep = representing(f);
  if ('error' in rep) return { error: rep.error };
  const ev = evaluate(f, args);
  if (ev.status !== 'ok' || ev.value === undefined) return { error: 'the computation did not finish' };
  const m = ev.value;
  const ctx: Ctx = { labels: { next: 1 }, consts: new Set() };
  try {
    const a = clauseA(f, instance(rep, args, num(m)), args, m, ctx);
    const eig = freshConstIndex([rep.formula]);
    ctx.consts.add(eig);
    const e = A.c(eig);
    const S = instance(rep, args, e);
    const u = uniqueness(f, S, args, m, ctx);
    const target = A.forall(A.v(rep.output), A.imp(instance(rep, args, A.v(rep.output)), A.eq(A.v(rep.output), num(m))));
    const imp = D.impI(u.deriv, S, u.label, { note: `Discharge the assumption: we have shown A_f(n̄⃗, ${constName(eig)}) → ${constName(eig)} = m̄.`, group: 'clause (b)' });
    const b = D.allI(imp, target, eig, { note: `${constName(eig)} was arbitrary (it occurs in no undischarged assumption), so generalise.`, group: 'clause (b)' });
    const minimization = containsMin(f);
    return { value: m, a, b, axioms: minimization ? qUnfolded() : Q(), minimization };
  } catch (err) {
    if (err instanceof TooLarge) return { error: err.message };
    throw err;
  }
}

/** Largest value of a minimization for which derivations are generated. */
export const MIN_VALUE_MAX = 8;

class TooLarge extends Error {}

function containsMin(f: RF): boolean {
  switch (f.k) {
    case 'min':
      return true;
    case 'def':
      return containsMin(f.body);
    case 'comp':
      return containsMin(f.f) || f.gs.some(containsMin);
    case 'rec':
      return containsMin(f.f) || containsMin(f.g);
    default:
      return false;
  }
}

/** =Intro, with the conclusion written as `target` (which must be t = t up to numerals). */
function eqIAs(target: Formula, note?: string, group?: string): Deriv {
  if (target.k !== 'eq') throw new Error('eqIAs');
  return { ...D.eqI(target.l, { note, group }), concl: target };
}

/** The existential prefix and matrix of ∃y_0 … ∃y_{k-1} M. */
function peel(f: Formula, k: number): { ys: number[]; matrix: Formula } {
  const ys: number[] = [];
  let cur = f;
  for (let i = 0; i < k; i++) {
    if (cur.k !== 'exists') throw new Error('expected ∃');
    ys.push(cur.v.index);
    cur = cur.body;
  }
  return { ys, matrix: cur };
}

/** The conjuncts of a left-nested conjunction with n conjuncts. */
function conjuncts(f: Formula, n: number): Formula[] {
  const out: Formula[] = [];
  let cur = f;
  for (let i = n - 1; i > 0; i--) {
    if (cur.k !== 'and') throw new Error('expected ∧');
    out.unshift(cur.b);
    cur = cur.a;
  }
  out.unshift(cur);
  return out;
}

/** ∧Elim steps that extract conjunct i (of n, left-nested) from a derivation of the conjunction. */
function extract(d: Deriv, i: number, n: number, group: string): Deriv {
  let cur = d;
  for (let j = n - 1; j > i; j--) cur = D.andE(cur, 'left', { group });
  return i === 0 ? cur : D.andE(cur, 'right', { group });
}

const unwrap = (g: RF): RF => (g.k === 'def' ? unwrap(g.body) : g);

/** Q ⊢ target, where target is A_g(n̄⃗, m̄) and m = g(n⃗). */
function clauseA(g0: RF, target: Formula, vals: bigint[], m: bigint, ctx: Ctx): Deriv {
  const g = unwrap(g0);
  const group = 'clause (a)';
  switch (g.k) {
    case 'zero':
      return eqIAs(target, 'zero: the sentence is 0 = 0, an instance of =Intro.', group);
    case 'succ':
      return eqIAs(target, `succ: ${m}̄ is the term ${vals[0]}̄′, so this is t = t.`, group);
    case 'proj':
      return eqIAs(target, `projection: the value ${m} is the input x${g.i}.`, group);
    case 'basic': {
      if (g.name === 'add' || g.name === 'mult') {
        const lemma = g.name === 'add' ? deriveAdd(vals[0], vals[1]) : deriveMult(vals[0], vals[1]);
        const d = symm(lemma, { note: `Turn the lemma around.`, group });
        return { ...d, concl: target };
      }
      if (target.k !== 'or' || target.a.k !== 'and' || target.b.k !== 'and') throw new Error('χ= formula');
      if (vals[0] === vals[1]) {
        const left = D.andI(eqIAs(target.a.a, undefined, group), eqIAs(target.a.b, undefined, group), { group });
        return D.orI(left, target, { note: `${vals[0]} = ${vals[1]}, so the left disjunct holds.`, group });
      }
      const neq = deriveNeq(vals[0], vals[1], ctx.labels);
      const right = D.andI({ ...neq, concl: target.b.a }, eqIAs(target.b.b, undefined, group), { group });
      return D.orI(right, target, { note: `${vals[0]} ≠ ${vals[1]}, so the right disjunct holds.`, group });
    }
    case 'comp': {
      const k = g.gs.length;
      const inner = g.gs.map((h) => evaluate(h, vals).value!);
      const { ys, matrix } = peel(target, k);
      let inst = matrix;
      ys.forEach((y, i) => {
        inst = subst(inst, y, num(inner[i]));
      });
      const parts = conjuncts(inst, k + 1);
      const ds = g.gs.map((h, i) => clauseA(h, parts[i], vals, inner[i], ctx));
      ds.push(clauseA(g.f, parts[k], inner, m, ctx));
      let conj = ds[0];
      for (let i = 1; i < ds.length; i++) conj = D.andI(conj, ds[i], { group });
      // ∃Intro, innermost quantifier first.
      let d = conj;
      for (let i = k - 1; i >= 0; i--) {
        let concl: Formula = target;
        for (let j = 0; j < i; j++) {
          if (concl.k !== 'exists') throw new Error('∃');
          concl = subst(concl.body, ys[j], num(inner[j]));
        }
        d = D.exI(d, concl, num(inner[i]), { note: `The computation supplies the witness: g${k > 1 ? i : ''}(${vals.join(', ')}) = ${inner[i]}.`, group });
      }
      return d;
    }
    case 'min': {
      // A_g(m̄, n̄⃗, 0) ∧ ∀w (w < m̄ → ¬A_g(w, n̄⃗, 0)): the book's (a) for g, and (4.6).
      if (target.k !== 'and' || target.b.k !== 'forall') throw new Error('min formula');
      checkMin(m);
      const first = clauseA(g.f, target.a, [m, ...vals], 0n, ctx);
      const less = repLess(g.f, target.b, vals, Number(m), ctx);
      return D.andI(first, less, { note: `Both conjuncts: g(${[m, ...vals].join(', ')}) = 0, and no smaller w is a zero of g.`, group });
    }
    default:
      throw new Error('not supported');
  }
}

function checkMin(m: bigint) {
  if (m > BigInt(Math.min(MIN_VALUE_MAX, LESS_MAX))) throw new TooLarge(`the search ends at ${m}; derivations are generated for values up to ${MIN_VALUE_MAX} (they grow with the value)`);
}

const numVal = (t: Term): number => {
  const v = numeralValue(t);
  if (!v || v.k !== 'lit') throw new Error('not a numeral');
  return Number(v.v);
};

/**
 * Q ⊢ ∀w (w < m̄ → ¬A_g(w, n̄⃗, 0)) — equation (4.6) in the proof of Proposition
 * rep-minimization — where g(k, n⃗) ≠ 0 for every k < m. By Lemma less-zero if m = 0, and by
 * Lemma less-nsucc otherwise; each case w = k̄ is refuted using clause (b) for g at (k, n⃗).
 */
function repLess(gf: RF, T: Formula, vals: bigint[], m: number, ctx: Ctx): Deriv {
  const group = `(4.6): ∀w (w < ${m}̄ → ¬A_g(w, …, 0))`;
  if (T.k !== 'forall') throw new Error('rep-less');
  const e = freshConst(ctx);
  const body = subst(T.body, T.v.index, A.c(e));
  if (body.k !== 'imp') throw new Error('rep-less');
  const lab = ctx.labels.next++;
  const h = D.assume(body.a, lab, { group, note: `Suppose ${constName(e)} < ${m}̄.` });
  let concl: Deriv;
  if (m === 0) {
    const lz = D.allE({ ...deriveLessZero(), group }, A.c(e), { group, note: `Lemma less-zero, for ${constName(e)}.` });
    concl = D.botI(D.notE(lz, h, { group }), body.b, { group, note: 'Nothing is below 0.' });
  } else {
    const lemma = deriveLessNSucc(m - 1, ctx.labels);
    const cases = D.impE(D.allE(lemma, A.c(e), { group, note: `Lemma less-nsucc for n = ${m - 1}, for ${constName(e)}.` }), h, { group });
    concl = orCases(
      cases,
      (f, hyp) => {
        if (f.k !== 'eq') throw new Error('disjunct');
        const k = numVal(f.r);
        const inst = subst(T.body, T.v.index, num(k));
        if (inst.k !== 'imp') throw new Error('rep-less');
        const notK = refuteZero(gf, inst.b, [BigInt(k), ...vals], ctx);
        return D.eqE(hyp(), notK, body.b, { group, note: `Replace ${k}̄ by ${constName(e)}.` });
      },
      ctx.labels,
      group,
      `Every case ${constName(e)} = k̄ with k < ${m} (∨Elim*).`,
    );
  }
  const imp = D.impI(concl, body.a, lab, { group });
  return D.allI(imp, T, e, { group, note: `Eigenvariable ${constName(e)}: only axioms remain undischarged.` });
}

/** Q ⊢ ¬A_g(k̄, n̄⃗, 0) when g(k, n⃗) = v ≠ 0: clause (b) for g gives 0 = v̄, which Q refutes. */
function refuteZero(gf: RF, N: Formula, args: bigint[], ctx: Ctx): Deriv {
  const group = `¬A_g(${args.join(', ')}, 0): g(${args.join(', ')}) ≠ 0`;
  if (N.k !== 'not') throw new Error('refuteZero');
  const ev = evaluate(gf, args);
  if (ev.status !== 'ok' || ev.value === undefined) throw new TooLarge('the computation did not finish');
  const v = ev.value;
  if (v === 0n) throw new Error('refuteZero: g is 0 here');
  const u = uniqueness(gf, N.a, args, v, ctx);
  const neq = deriveNeq(0n, v, ctx.labels, group);
  const bot = D.notE(neq, u.deriv, { group, note: `Clause (b) for g says the value would be ${v}, but 0 ≠ ${v}̄.` });
  return D.notI(bot, N.a, u.label, { group, note: `So ¬A_g(${args.map((x) => `${x}̄`).join(', ')}, 0).` });
}

interface Uniq {
  /** derivation of e = m̄ whose only undischarged assumption (besides axioms) is [S]^label */
  deriv: Deriv;
  label: number;
}

function freshConst(ctx: Ctx): number {
  let c = 1;
  while (ctx.consts.has(c)) c++;
  ctx.consts.add(c);
  return c;
}

/** From [S]^n, where S is A_g(n̄⃗, e) for an eigenvariable e, derive e = m̄. */
function uniqueness(g0: RF, S: Formula, vals: bigint[], m: bigint, ctx: Ctx): Uniq {
  const g = unwrap(g0);
  const group = 'clause (b)';
  const label = ctx.labels.next++;
  const hyp = () => D.assume(S, label, { group });
  if (S.k === 'eq' && (g.k === 'zero' || g.k === 'succ' || g.k === 'proj')) {
    // e = 0, e = n̄′, e = n̄_i: already e = m̄.
    return { deriv: { ...hyp(), note: 'This already says that the value is ' + m + '.' }, label };
  }
  if (g.k === 'basic' && (g.name === 'add' || g.name === 'mult')) {
    if (S.k !== 'eq') throw new Error('add');
    const lemma = g.name === 'add' ? deriveAdd(vals[0], vals[1]) : deriveMult(vals[0], vals[1]);
    return { deriv: D.eqE(lemma, hyp(), A.eq(S.l, num(m)), { note: `Replace the ${g.name === 'add' ? 'sum' : 'product'} by its value, using the lemma.`, group }), label };
  }
  if (g.k === 'basic') {
    if (S.k !== 'or' || S.a.k !== 'and' || S.b.k !== 'and' || S.a.b.k !== 'eq') throw new Error('χ=');
    const e = S.a.b.l;
    const goal = A.eq(e, num(m));
    const caseLabel = ctx.labels.next++;
    const la = D.assume(S.a, caseLabel, { group });
    const ra = D.assume(S.b, caseLabel, { group });
    let left: Deriv;
    let right: Deriv;
    if (vals[0] === vals[1]) {
      left = D.andE(la, 'right', { note: 'First case: the value is 1̄.', group });
      const bot = D.notE(D.andE(ra, 'left', { group }), { ...D.eqI(num(vals[0])), concl: (S.b.a as Extract<Formula, { k: 'not' }>).a }, { note: `The second case says ${vals[0]}̄ ≠ ${vals[1]}̄, refuted by =Intro.`, group });
      right = D.botI(bot, goal, { group });
    } else {
      const neq = deriveNeq(vals[0], vals[1], ctx.labels);
      const bot = D.notE(neq, D.andE(la, 'left', { group }), { note: `The first case says ${vals[0]}̄ = ${vals[1]}̄, but Q derives ${vals[0]}̄ ≠ ${vals[1]}̄.`, group });
      left = D.botI(bot, goal, { group });
      right = D.andE(ra, 'right', { note: 'Second case: the value is 0.', group });
    }
    return { deriv: D.orE(hyp(), left, right, caseLabel, { note: 'Either way the value is ' + m + '.', group }), label };
  }
  if (g.k === 'comp') {
    const k = g.gs.length;
    const inner = g.gs.map((h) => evaluate(h, vals).value!);
    const eig = g.gs.map(() => freshConst(ctx));
    // The core: from [M(b⃗)]^core derive e = m̄.
    const { ys, matrix } = peel(S, k);
    let M = matrix;
    ys.forEach((y, i) => {
      M = subst(M, y, A.c(eig[i]));
    });
    const parts = conjuncts(M, k + 1);
    const coreLabel = ctx.labels.next++;
    const Mhyp = () => D.assume(M, coreLabel, { group });
    const eqs = g.gs.map((h, i) => {
      const u = uniqueness(h, parts[i], vals, inner[i], ctx);
      const imp = D.impI(u.deriv, parts[i], u.label, { group });
      return D.impE(imp, extract(Mhyp(), i, k + 1, group), { note: `By (b) for the inner function: ${'abcd'[eig[i] - 1] ?? 'b'} = ${inner[i]}̄.`, group });
    });
    let fPart = extract(Mhyp(), k, k + 1, group);
    eqs.forEach((eqD, i) => {
      fPart = D.eqE(eqD, fPart, replaceConst(fPart.concl, eig[i], num(inner[i])), { note: `Put ${inner[i]}̄ for ${'abcd'[eig[i] - 1] ?? 'b'}.`, group });
    });
    const fu = uniqueness(g.f, fPart.concl, inner, m, ctx);
    const core = D.impE(D.impI(fu.deriv, fPart.concl, fu.label, { group }), fPart, { note: `By (b) for the outer function, the value is ${m}.`, group });
    // ∃Elim from the outside in.
    const chain = (T: Formula, i: number, lab: number): Deriv => {
      if (i === k) return relabelCore(core, coreLabel, lab);
      if (T.k !== 'exists') throw new Error('∃');
      const body = subst(T.body, T.v.index, A.c(eig[i]));
      const innerLab = i + 1 === k ? coreLabel : ctx.labels.next++;
      const d = chain(body, i + 1, innerLab);
      return D.exE(D.assume(T, lab, { group }), d, eig[i], innerLab, { note: `Let ${'abcd'[eig[i] - 1] ?? 'b'} be such a y (∃Elim).`, group });
    };
    return { deriv: chain(S, 0, label), label };
  }
  if (g.k === 'min') {
    // The book's argument: from (a) A_g(t, n̄⃗, 0) and (b) ∀w (w < t → ¬A_g(w, n̄⃗, 0)), and
    // trichotomy, t = m̄: both t < m̄ and m̄ < t lead to a contradiction.
    if (S.k !== 'and' || S.b.k !== 'forall' || S.b.body.k !== 'imp' || S.b.body.a.k !== 'pred') throw new Error('min');
    checkMin(m);
    const gm = 'clause (b): minimization';
    const t = S.b.body.a.args[1];
    const tName = t.k === 'const' && t.index > 0 ? constName(t.index) : 't';
    const goal = () => A.eq(A.cloneFresh(t), num(m));
    const Sa = () => D.andE(hyp(), 'left', { group: gm, note: `(a) A_g(${tName}, n̄⃗, 0).` });
    const Sb = () => D.andE(hyp(), 'right', { group: gm, note: `(b) ∀w (w < ${tName} → ¬A_g(w, n̄⃗, 0)).` });
    const tri = D.allE(deriveTrichotomy(Number(m), ctx.labels), t, { group: gm, note: `Lemma trichotomy for m = ${m}, for ${tName}.` });
    if (tri.concl.k !== 'or' || tri.concl.a.k !== 'or') throw new Error('trichotomy');
    const [lt, gt] = [tri.concl.a.a, tri.concl.a.b];
    const l1 = ctx.labels.next++;
    const l2 = ctx.labels.next++;
    // t < m̄: (4.6) gives ¬A_g(t, n̄⃗, 0), against (a)
    const T = A.forall(A.v(S.b.v.index), A.imp(A.less(A.v(S.b.v.index), num(m)), S.b.body.b));
    const rl = repLess(unwrap(g.f), T, vals, Number(m), ctx);
    const notT = D.impE(D.allE(rl, t, { group: gm, note: `(4.6), for ${tName}.` }), D.assume(lt, l2, { group: gm, note: `Case ${tName} < ${m}̄.` }), { group: gm });
    const c1 = D.botI(D.notE(notT, Sa(), { group: gm, note: 'This contradicts (a).' }), goal(), { group: gm });
    // m̄ < t: (b) gives ¬A_g(m̄, n̄⃗, 0), against clause (a) for g
    const bm = D.allE(Sb(), num(m), { group: gm, note: `(b) for w := ${m}̄.` });
    const notM = D.impE(bm, D.assume(gt, l2, { group: gm, note: `Case ${m}̄ < ${tName}.` }), { group: gm });
    if (notM.concl.k !== 'not') throw new Error('min');
    const vals0 = [m, ...vals];
    const agm = clauseA(g.f, notM.concl.a, vals0, 0n, ctx);
    const c2 = D.botI(D.notE(notM, agm, { group: gm, note: `g(${vals0.join(', ')}) = 0, so Q ⊢ A_g(${m}̄, n̄⃗, 0) (clause (a) for g): a contradiction.` }), goal(), { group: gm });
    const inner = D.orE(D.assume(tri.concl.a, l1, { group: gm }), c1, c2, l2, { group: gm, note: `Both ${tName} < ${m}̄ and ${m}̄ < ${tName} are impossible.` });
    const c3 = D.assume(tri.concl.b, l1, { group: gm, note: `Case ${tName} = ${m}̄: what we want.` });
    return { deriv: D.orE(tri, inner, c3, l1, { group: gm, note: `So ${tName} = ${m}̄.` }), label };
  }
  throw new Error('not supported');
}

/** The core derivation already uses coreLabel for [M]; nothing to change unless labels differ. */
function relabelCore(core: Deriv, coreLabel: number, lab: number): Deriv {
  if (coreLabel === lab) return core;
  const go = (d: Deriv): Deriv => ({ ...d, label: d.rule === 'assume' && d.label === coreLabel ? lab : d.label, premises: d.premises.map(go) });
  return go(core);
}

/** Replace every occurrence of the constant c_index by the term t. */
function replaceConst(f: Formula, index: number, t: Term): Formula {
  const goT = (x: Term): Term => {
    if (x.k === 'const' && x.index === index) return A.cloneFresh(t);
    if (x.k === 'app') return { ...x, args: x.args.map(goT) };
    return x;
  };
  const goF = (x: Formula): Formula => {
    switch (x.k) {
      case 'eq':
        return { ...x, l: goT(x.l), r: goT(x.r) };
      case 'pred':
      case 'abbr':
        return { ...x, args: x.args.map(goT) };
      case 'not':
        return { ...x, a: goF(x.a) };
      case 'and':
      case 'or':
      case 'imp':
      case 'iff':
        return { ...x, a: goF(x.a), b: goF(x.b) };
      case 'forall':
      case 'exists':
        return { ...x, body: goF(x.body) };
      default:
        return x;
    }
  };
  return goF(f);
}
