// `omega`: linear arithmetic over the natural numbers, by reflection.
//
// The tactic collects the hypotheses that are linear (in)equalities between
// natural numbers, adds the negation of the goal, and searches (with
// Fourier–Motzkin elimination) for non-negative multipliers that combine them
// into an obvious contradiction `c + … ≤ c' + …` with c > c'. It does not
// trust its own search: the proof it builds applies lemmas of the verified
// library `Omega` (in std.lean) to a *reified* copy of the problem, and the
// kernel checks that the combination really is contradictory by evaluating
// `Omega.dominates` — proof by reflection.
//
// Limits (unlike Lean's omega): reasoning is over the rationals (plus x ≥ 0), so
// purely integer facts such as "2x = 1 is impossible" are out of reach; `-`,
// `/` and `%` are treated as opaque atoms.

import { type Expr, exprEq, getAppArgs, getAppFn, headBeta, mkApp, mkApps, mkConst, replaceExpr } from '../core/expr.ts';
import type { Level } from '../core/level.ts';
import type { STerm, Span } from '../syntax/ast.ts';
import type { Elaborator } from './elaborator.ts';
import { ElabError } from './errors.ts';
import type { TacticRunner } from './tactics.ts';

// ---------------------------------------------------------------------------
// linear forms

interface Lin {
  c: bigint;
  /** atom index → coefficient */
  a: Map<number, bigint>;
}

interface Fact {
  /** L ≤ R, with proof */
  l: Expr;
  r: Expr;
  proof: Expr;
}

class Atoms {
  list: Expr[] = [];
  index(e: Expr): number {
    const i = this.list.findIndex((x) => exprEq(x, e));
    if (i >= 0) return i;
    this.list.push(e);
    return this.list.length - 1;
  }
}

function numeral(e: Expr): bigint | undefined {
  let n = 0n;
  while (e.k === 'app' && e.fn.k === 'const' && e.fn.name === 'Nat.succ') {
    n++;
    e = e.arg;
  }
  return e.k === 'const' && e.name === 'Nat.zero' ? n : undefined;
}

const one: Level = { k: 'succ', l: { k: 'zero' } };
const natNum = (n: bigint): Expr => {
  let e: Expr = mkConst('Nat.zero');
  for (let i = 0n; i < n; i++) e = mkApp(mkConst('Nat.succ'), e);
  return e;
};

/** read a Nat expression as a linear form, and build the matching Omega.Term */
function linearize(e: Expr, atoms: Atoms): { lin: Lin; term: Expr } {
  const T = (c: string, args: Expr[]) => mkApps(mkConst(`Omega.Term.${c}`), args);
  const n = numeral(e);
  if (n !== undefined) return { lin: { c: n, a: new Map() }, term: T('num', [e]) };
  const h = getAppFn(e);
  const args = getAppArgs(e);
  if (h.k === 'const' && h.name === 'Nat.add' && args.length === 2) {
    const x = linearize(args[0], atoms);
    const y = linearize(args[1], atoms);
    return { lin: addLin(x.lin, y.lin), term: T('add', [x.term, y.term]) };
  }
  if (h.k === 'const' && h.name === 'Nat.succ' && args.length === 1) {
    const x = linearize(args[0], atoms);
    return { lin: addLin(x.lin, { c: 1n, a: new Map() }), term: T('add', [x.term, T('num', [natNum(1n)])]) };
  }
  if (h.k === 'const' && h.name === 'Nat.mul' && args.length === 2) {
    const k0 = numeral(args[0]);
    const k1 = numeral(args[1]);
    if (k0 !== undefined) {
      const y = linearize(args[1], atoms);
      return { lin: scaleLin(k0, y.lin), term: T('smul', [args[0], y.term]) };
    }
    if (k1 !== undefined) {
      const x = linearize(args[0], atoms);
      return { lin: scaleLin(k1, x.lin), term: T('mulr', [x.term, args[1]]) };
    }
  }
  const i = atoms.index(e);
  return { lin: { c: 0n, a: new Map([[i, 1n]]) }, term: T('atom', [natNum(BigInt(i))]) };
}

function addLin(x: Lin, y: Lin): Lin {
  const a = new Map(x.a);
  for (const [k, v] of y.a) a.set(k, (a.get(k) ?? 0n) + v);
  return { c: x.c + y.c, a };
}

function scaleLin(k: bigint, x: Lin): Lin {
  return { c: k * x.c, a: new Map([...x.a].map(([i, v]) => [i, k * v])) };
}

// ---------------------------------------------------------------------------
// Fourier–Motzkin with certificates

interface Row {
  /** the linear form R − L ≥ 0 */
  coef: Map<number, bigint>;
  c: bigint;
  /** multipliers of the original facts */
  mult: bigint[];
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

/** find non-negative multipliers making Σ λᵢ (Rᵢ − Lᵢ) have coefficients ≤ 0 and a negative constant */
function search(rows: Row[], nAtoms: number): bigint[] | undefined {
  const done = (rs: Row[]) => rs.find((r) => r.c < 0n && [...r.coef.values()].every((v) => v <= 0n));
  let cur = rows;
  const hit0 = done(cur);
  if (hit0) return hit0.mult;
  for (let j = 0; j < nAtoms; j++) {
    const pos = cur.filter((r) => (r.coef.get(j) ?? 0n) > 0n);
    const rest = cur.filter((r) => (r.coef.get(j) ?? 0n) <= 0n);
    const neg = rest.filter((r) => (r.coef.get(j) ?? 0n) < 0n);
    const next = [...rest];
    for (const p of pos) {
      for (const n of neg) {
        const pj = p.coef.get(j)!;
        const nj = -n.coef.get(j)!;
        const coef = new Map<number, bigint>();
        for (const [k, v] of p.coef) coef.set(k, v * nj);
        for (const [k, v] of n.coef) coef.set(k, (coef.get(k) ?? 0n) + v * pj);
        coef.delete(j);
        let c = p.c * nj + n.c * pj;
        let mult = p.mult.map((m, i) => m * nj + n.mult[i] * pj);
        // keep the numbers small
        let g = c === 0n ? 0n : c;
        for (const v of coef.values()) g = gcd(g, v);
        for (const m of mult) g = gcd(g, m);
        if (g > 1n) {
          c /= g;
          for (const [k, v] of coef) coef.set(k, v / g);
          mult = mult.map((m) => m / g);
        }
        next.push({ coef, c, mult });
      }
    }
    if (next.length > 4000) return undefined;
    cur = next;
    const hit = done(cur);
    if (hit) return hit.mult;
  }
  return done(cur)?.mult;
}

// ---------------------------------------------------------------------------
// the tactic


export function omegaTactic(runner: TacticRunner, g: number, span: Span): void {
  const el = runner.el;
  runner.withGoal(g, () => {
    const proof = proveGoal(runner, el, runner.type(g), span);
    runner.assign(g, proof);
  });
}

const E = (e: Expr, span: Span): STerm => ({ k: 'elaborated', e, span });
function app(el: Elaborator, fn: string, args: Expr[], span: Span, expected?: Expr): Expr {
  return el.elab({ k: 'app', fn: { k: 'ident', name: fn, explicit: false, span }, args: args.map((a) => ({ arg: E(a, span) })), span }, expected);
}

function isNatType(el: Elaborator, t: Expr): boolean {
  const w = el.whnf(t);
  return w.k === 'const' && w.name === 'Nat';
}

/** the relation a goal or hypothesis states, if it is one omega understands */
function relOf(el: Elaborator, t: Expr): { kind: 'le' | 'lt' | 'eq' | 'ne' | 'nle' | 'nlt' | 'false' | 'and'; a: Expr; b: Expr } | undefined {
  const x = el.instantiate(t);
  const h = getAppFn(x);
  const args = getAppArgs(x);
  if (h.k !== 'const') {
    // ¬p unfolds to p → False
    if (x.k === 'pi' && x.body.k === 'const' && x.body.name === 'False') {
      const inner = relOf(el, x.type);
      if (inner?.kind === 'le') return { kind: 'nle', a: inner.a, b: inner.b };
      if (inner?.kind === 'lt') return { kind: 'nlt', a: inner.a, b: inner.b };
      if (inner?.kind === 'eq') return { kind: 'ne', a: inner.a, b: inner.b };
    }
    return undefined;
  }
  switch (h.name) {
    case 'False':
      return { kind: 'false', a: x, b: x };
    case 'Nat.le':
      return args.length === 2 ? { kind: 'le', a: args[0], b: args[1] } : undefined;
    case 'Nat.lt':
      return args.length === 2 ? { kind: 'lt', a: args[0], b: args[1] } : undefined;
    case 'Nat.ge':
      return args.length === 2 ? { kind: 'le', a: args[1], b: args[0] } : undefined;
    case 'Nat.gt':
      return args.length === 2 ? { kind: 'lt', a: args[1], b: args[0] } : undefined;
    case 'Eq':
      return args.length === 3 && isNatType(el, args[0]) ? { kind: 'eq', a: args[1], b: args[2] } : undefined;
    case 'Ne':
      return args.length === 3 && isNatType(el, args[0]) ? { kind: 'ne', a: args[1], b: args[2] } : undefined;
    case 'And':
      return { kind: 'and', a: args[0], b: args[1] };
    case 'Not': {
      const inner = relOf(el, args[0]);
      if (inner?.kind === 'le') return { kind: 'nle', a: inner.a, b: inner.b };
      if (inner?.kind === 'lt') return { kind: 'nlt', a: inner.a, b: inner.b };
      if (inner?.kind === 'eq') return { kind: 'ne', a: inner.a, b: inner.b };
      return undefined;
    }
  }
  return undefined;
}

function proveGoal(runner: TacticRunner, el: Elaborator, goal: Expr, span: Span): Expr {
  while (goal.k === 'app' && getAppFn(goal).k === 'lam') goal = headBeta(goal);
  const rel = relOf(el, goal);
  const succ = (x: Expr) => mkApps(mkConst('Nat.add'), [x, natNum(1n)]);
  const byContra = (hypType: Expr, wrap: (lam: Expr) => Expr): Expr =>
    el.withSavedLctx(() => {
      const h = el.pushLocal('h✝', hypType);
      const f = refute(runner, el, span);
      return wrap(el.mkBinding('lam', [h], f));
    });
  if (!rel) {
    // False is always a valid target
    const f = el.withSavedLctx(() => refute(runner, el, span));
    return app(el, 'False.elim', [f], span, goal);
  }
  switch (rel.kind) {
    case 'false':
      return el.withSavedLctx(() => refute(runner, el, span));
    case 'le':
      // ¬(b < a) → a ≤ b
      return byContra(mkApps(mkConst('Nat.lt'), [rel.b, rel.a]), (lam) => app(el, 'Nat.le_of_not_lt', [lam], span, goal));
    case 'lt':
      // ¬(b ≤ a) → a < b
      return byContra(mkApps(mkConst('Nat.le'), [rel.b, rel.a]), (lam) => app(el, 'Nat.lt_of_not_le', [lam], span, goal));
    case 'eq': {
      const p1 = proveGoal(runner, el, mkApps(mkConst('Nat.le'), [rel.a, rel.b]), span);
      const p2 = proveGoal(runner, el, mkApps(mkConst('Nat.le'), [rel.b, rel.a]), span);
      return app(el, 'Nat.le_antisymm', [p1, p2], span, goal);
    }
    case 'ne':
      return byContra(mkApps(mkConst('Eq', [one]), [mkConst('Nat'), rel.a, rel.b]), (lam) => lam);
    case 'nle':
      return byContra(mkApps(mkConst('Nat.le'), [rel.a, rel.b]), (lam) => lam);
    case 'nlt':
      return byContra(mkApps(mkConst('Nat.lt'), [rel.a, rel.b]), (lam) => lam);
    default:
      void succ;
      throw new ElabError(['omega: the goal is not a linear arithmetic statement about natural numbers'], span);
  }
}

type Split = { kind: 'ne'; h: Expr; a: Expr; b: Expr } | { kind: 'sub'; a: Expr; b: Expr };

/** read a hypothesis as linear facts (and disequalities to split on) */
function addHyp(el: Elaborator, span: Span, facts: Fact[], splits: Split[], t: Expr, h: Expr, depth = 0): void {
  if (depth > 4) return;
  // (fun a b => a < b) x y, as produced by relations passed as arguments
  while (t.k === 'app' && getAppFn(t).k === 'lam') t = headBeta(t);
  const succ = (x: Expr) => mkApps(mkConst('Nat.add'), [x, natNum(1n)]);
  const rel = relOf(el, t);
  if (!rel) return;
  switch (rel.kind) {
    case 'le':
      facts.push({ l: rel.a, r: rel.b, proof: h });
      return;
    case 'lt':
      facts.push({ l: succ(rel.a), r: rel.b, proof: h });
      return;
    case 'eq':
      facts.push({ l: rel.a, r: rel.b, proof: app(el, 'Nat.le_of_eq', [h], span) });
      facts.push({ l: rel.b, r: rel.a, proof: app(el, 'Nat.le_of_eq', [app(el, 'Eq.symm', [h], span)], span) });
      return;
    case 'nle':
      facts.push({ l: succ(rel.b), r: rel.a, proof: app(el, 'Nat.lt_of_not_le', [h], span) });
      return;
    case 'nlt':
      facts.push({ l: rel.b, r: rel.a, proof: app(el, 'Nat.le_of_not_lt', [h], span) });
      return;
    case 'ne':
      splits.push({ kind: 'ne', h, a: rel.a, b: rel.b });
      return;
    case 'and':
      addHyp(el, span, facts, splits, rel.a, app(el, 'And.left', [h], span), depth + 1);
      addHyp(el, span, facts, splits, rel.b, app(el, 'And.right', [h], span), depth + 1);
      return;
    case 'false':
      facts.push({ l: natNum(1n), r: natNum(0n), proof: app(el, 'False.elim', [h], span, mkApps(mkConst('Nat.le'), [natNum(1n), natNum(0n)])) });
      return;
  }
}

/** the truncated subtractions a - b occurring in the facts */
function subtractions(el: Elaborator, facts: Fact[]): { a: Expr; b: Expr }[] {
  const out: { a: Expr; b: Expr }[] = [];
  const visit = (e: Expr) =>
    replaceExpr(e, (x) => {
      if (x.k === 'app' && getAppFn(x).k === 'const' && (getAppFn(x) as { name: string }).name === 'Nat.sub' && getAppArgs(x).length === 2 && x.lb === 0) {
        const [a, b] = getAppArgs(x);
        if (!out.some((s) => exprEq(s.a, a) && exprEq(s.b, b))) out.push({ a, b });
      }
      return undefined;
    });
  for (const f of facts) {
    visit(el.instantiate(f.l));
    visit(el.instantiate(f.r));
  }
  return out;
}

/** prove False from the hypotheses in the local context */
function refute(runner: TacticRunner, el: Elaborator, span: Span): Expr {
  const facts: Fact[] = [];
  const splits: Split[] = [];
  for (const d of el.lctx.decls) {
    if (d.value) continue;
    try {
      addHyp(el, span, facts, splits, el.instantiate(d.type), { k: 'fvar', id: d.id, lb: 0, fv: true, mv: false, lp: false } as Expr);
    } catch (e) {
      if (!(e instanceof ElabError)) throw e;
    }
  }
  // a - b: either b ≤ a and a - b + b = a, or a < b and a - b = 0
  if (el.env.has('Nat.sub_cases')) for (const s of subtractions(el, facts)) splits.push({ kind: 'sub', a: s.a, b: s.b });
  return refuteWith(runner, el, facts, splits, span);
}

function refuteWith(runner: TacticRunner, el: Elaborator, facts: Fact[], splits: Split[], span: Span): Expr {
  const r = tryRefute(el, facts, span);
  if (r) return r;
  if (splits.length === 0) {
    const cex = counterexample(el, facts);
    throw new ElabError(
      [
        `omega could not prove the goal: no linear combination of the ${facts.length} fact${facts.length === 1 ? '' : 's'} it found (the hypotheses, and the negated goal) gives a contradiction`,
        facts.length ? '\n' : '',
        ...facts.flatMap((f, i) => [i ? '\n' : '', '  ', { e: f.l, lctx: el.lctx }, ' ≤ ', { e: f.r, lctx: el.lctx }]),
        ...(cex ? ['\nThey all hold when ', ...cex.flatMap((c, i) => [i ? ', ' : '', { e: c.atom, lctx: el.lctx }, ` = ${c.value}`]), ', so the goal may be false.'] : []),
      ],
      span,
    );
  }
  const [s, ...rest] = splits;
  if (s.kind === 'sub') {
    const sub = mkApps(mkConst('Nat.sub'), [s.a, s.b]);
    const eqN = (x: Expr, y: Expr) => mkApps(mkConst('Eq', [one]), [mkConst('Nat'), x, y]);
    const and = (x: Expr, y: Expr) => mkApps(mkConst('And'), [x, y]);
    const leftT = and(mkApps(mkConst('Nat.le'), [s.b, s.a]), eqN(mkApps(mkConst('Nat.add'), [sub, s.b]), s.a));
    const rightT = and(mkApps(mkConst('Nat.lt'), [s.a, s.b]), eqN(sub, natNum(0n)));
    const branch = (T: Expr) =>
      el.withSavedLctx(() => {
        const h = el.pushLocal('h✝', T);
        const more = [...facts];
        const moreSplits: Split[] = [];
        addHyp(el, span, more, moreSplits, T, h);
        const f = refuteWith(runner, el, more, [...moreSplits, ...rest], span);
        return el.mkBinding('lam', [h], f);
      });
    const left = branch(leftT);
    const right = branch(rightT);
    return app(el, 'Or.elim', [app(el, 'Nat.sub_cases', [s.a, s.b], span), left, right], span, mkConst('False'));
  }
  // a ≠ b: a < b or b < a
  const succ = (x: Expr) => mkApps(mkConst('Nat.add'), [x, natNum(1n)]);
  const branch = (l: Expr, rr: Expr, lt: Expr) =>
    el.withSavedLctx(() => {
      const h = el.pushLocal('h✝', lt);
      const f = refuteWith(runner, el, [...facts, { l: succ(l), r: rr, proof: h }], rest, span);
      return el.mkBinding('lam', [h], f);
    });
  const left = branch(s.a, s.b, mkApps(mkConst('Nat.lt'), [s.a, s.b]));
  const right = branch(s.b, s.a, mkApps(mkConst('Nat.lt'), [s.b, s.a]));
  return app(el, 'Or.elim', [app(el, 'Nat.lt_or_gt_of_ne', [s.h], span), left, right], span, mkConst('False'));
}

/** small values of the atoms satisfying every fact (a hint that the goal is false) */
function counterexample(el: Elaborator, facts: Fact[]): { atom: Expr; value: bigint }[] | undefined {
  const atoms = new Atoms();
  let lin: { l: Lin; r: Lin }[];
  try {
    lin = facts.map((f) => ({ l: linearize(el.instantiate(f.l), atoms).lin, r: linearize(el.instantiate(f.r), atoms).lin }));
  } catch {
    return undefined;
  }
  const n = atoms.list.length;
  if (n === 0 || n > 4) return undefined;
  const val = (x: Lin, v: bigint[]) => [...x.a].reduce((acc, [i, c]) => acc + c * v[i], x.c);
  const max = n <= 2 ? 12 : 5;
  const v: bigint[] = new Array(n).fill(0n);
  const total = (max + 1) ** n;
  for (let k = 0; k < total; k++) {
    let x = k;
    for (let i = 0; i < n; i++) {
      v[i] = BigInt(x % (max + 1));
      x = Math.floor(x / (max + 1));
    }
    if (lin.every((f) => val(f.l, v) <= val(f.r, v))) return atoms.list.map((atom, i) => ({ atom, value: v[i] }));
  }
  return undefined;
}

function tryRefute(el: Elaborator, facts: Fact[], span: Span): Expr | undefined {
  const atoms = new Atoms();
  const lin = facts.map((f) => ({ l: linearize(el.instantiate(f.l), atoms), r: linearize(el.instantiate(f.r), atoms) }));
  const rows: Row[] = lin.map((x, i) => {
    const d = addLin(x.r.lin, scaleLin(-1n, x.l.lin));
    return { coef: new Map([...d.a].filter(([, v]) => v !== 0n)), c: d.c, mult: facts.map((_, k) => (k === i ? 1n : 0n)) };
  });
  const mult = search(rows, atoms.list.length);
  if (!mult) return undefined;
  // ρ: the atoms, as a list literal
  const zero: Level = { k: 'zero' };
  let rho: Expr = mkApps(mkConst('List.nil', [zero]), [mkConst('Nat')]);
  for (let i = atoms.list.length - 1; i >= 0; i--) rho = mkApps(mkConst('List.cons', [zero]), [mkConst('Nat'), atoms.list[i], rho]);
  let combined: Expr | undefined;
  facts.forEach((f, i) => {
    const m = mult[i];
    if (m === 0n) return;
    let p = app(el, 'Omega.lift', [rho, lin[i].l.term, lin[i].r.term, f.proof], span);
    if (m !== 1n) p = app(el, 'Omega.le_scale', [natNum(m), p], span);
    combined = combined ? app(el, 'Omega.le_add', [combined, p], span) : p;
  });
  if (!combined) return undefined;
  const t = el.instantiate(el.inferType(combined));
  // t = Nat.le (eval A ρ) (eval B ρ)
  const [lhs, rhs] = getAppArgs(t);
  const A = getAppArgs(lhs)[0];
  const B = getAppArgs(rhs)[0];
  const refl = mkApps(mkConst('Eq.refl', [one]), [mkConst('Bool'), mkConst('Bool.true')]);
  return app(el, 'Omega.contra', [A, B, rho, refl, combined], span, mkConst('False'));
}
