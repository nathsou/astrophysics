// The primitive recursive functions of the chapter "Recursive Functions", built from zero, succ,
// projections, composition and primitive recursion exactly as the book gives them (sections
// "Examples of Primitive Recursive Functions", "Primitive Recursive Relations", "Bounded
// Minimization", "Primes"). No basic functions other than zero, succ and P^n_i are used.
//
// Every builder returns a fresh term (new ids), wrapped in a named definition R.def(name, tex, …)
// so that traces show "add", "pred", … instead of the unfolded definition.
//
// The book's primitive recursion needs at least one parameter x⃗ (k ≥ 1). One-place recursions
// such as pred(0) = 0, pred(y + 1) = y are made official with a dummy parameter, as the book
// does for pred: first pred′(x, y), then pred(y) = pred′(zero(y), y).

import { arity, R, rfTex, type RF } from '../recursive/rf.ts';

const P = R.proj;

function arityOf(f: RF): number {
  const a = arity(f);
  if (!a.ok) throw new Error(`ill-formed definition: ${a.errors.map((e) => e.message).join('; ')}`);
  return a.arity;
}

/** P^n_0, …, P^n_{m-1}: the first m of n arguments. */
function firstProjs(n: number, m: number): RF[] {
  return Array.from({ length: m }, (_, i) => P(n, i));
}

function labelOf(f: RF): string {
  return f.k === 'def' ? f.tex : rfTex(f);
}

function nameOf(f: RF): string {
  return f.k === 'def' ? f.name : f.k;
}

export interface Label {
  name: string;
  tex: string;
}

// ------------------------------------------------------------------ basic examples

/** id(x) = P^1_0(x). */
export function id(): RF {
  return R.def('id', '\\mathrm{id}', P(1, 0));
}

/**
 * const_n(x) = n, by n successive compositions of succ with zero. With `k` > 1 arguments,
 * const_n ∘ P^k_0 (useful as the constant in definitions with k parameters).
 */
export function constN(n: number, k = 1): RF {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('const_n needs a natural number n');
  if (!Number.isInteger(k) || k < 1) throw new RangeError('const_n takes at least one argument');
  let t: RF = R.zero();
  for (let i = 0; i < n; i++) t = R.comp(R.succ(), [t]);
  const unary = R.def(`const_${n}`, `\\mathrm{const}_{${n}}`, t);
  if (k === 1) return unary;
  return R.def(`const_${n}^${k}`, `\\mathrm{const}^{${k}}_{${n}}`, R.comp(unary, [P(k, 0)]));
}

/** add(x, 0) = x, add(x, y + 1) = succ(add(x, y)). */
export function add(): RF {
  return R.def('add', '\\mathrm{add}', R.rec(P(1, 0), R.comp(R.succ(), [P(3, 2)])));
}

/** mult(x, 0) = 0, mult(x, y + 1) = add(mult(x, y), x). */
export function mult(): RF {
  return R.def('mult', '\\mathrm{mult}', R.rec(R.zero(), R.comp(add(), [P(3, 2), P(3, 0)])));
}

/** exp(x, 0) = succ(zero(x)) = 1, exp(x, y + 1) = mult(P^3_0, P^3_2) = x · exp(x, y). */
export function exp(): RF {
  return R.def('exp', '\\mathrm{exp}', R.rec(R.comp(R.succ(), [R.zero()]), R.comp(mult(), [P(3, 0), P(3, 2)])));
}

/** pred′(x, 0) = zero(x), pred′(x, y + 1) = P^3_1(x, y, pred′(x, y)) = y;  pred(y) = pred′(zero(y), P^1_0(y)). */
export function pred(): RF {
  const predP = R.def("pred'", "\\mathrm{pred}'", R.rec(R.zero(), P(3, 1)));
  return R.def('pred', '\\mathrm{pred}', R.comp(predP, [R.zero(), P(1, 0)]));
}

/**
 * h(x, 0) = const_1(x), h(x, y + 1) = mult(P^3_2, succ(P^3_1)) = h(x, y) · (y + 1);
 * fac(y) = h(P^1_0(y), P^1_0(y)) = h(y, y).
 */
export function fac(): RF {
  const h = R.def('h_{fac}', 'h_{\\mathrm{fac}}', R.rec(constN(1), R.comp(mult(), [P(3, 2), R.comp(R.succ(), [P(3, 1)])])));
  return R.def('fac', '\\mathrm{fac}', R.comp(h, [P(1, 0), P(1, 0)]));
}

/** Truncated subtraction x ∸ y:  x ∸ 0 = x, x ∸ (y + 1) = pred(x ∸ y). */
export function tsub(): RF {
  return R.def('tsub', '\\mathrm{tsub}', R.rec(P(1, 0), R.comp(pred(), [P(3, 2)])));
}

/** |x − y| = (x ∸ y) + (y ∸ x). */
export function dist(): RF {
  return R.def('dist', '\\mathrm{dist}', R.comp(add(), [tsub(), R.comp(tsub(), [P(2, 1), P(2, 0)])]));
}

/** max(x, y) = x + (y ∸ x). */
export function max(): RF {
  return R.def('max', '\\mathrm{max}', R.comp(add(), [P(2, 0), R.comp(tsub(), [P(2, 1), P(2, 0)])]));
}

/** min(x, y) = x ∸ (x ∸ y) (the book leaves this one as an exercise). */
export function min(): RF {
  return R.def('min', '\\mathrm{min}', R.comp(tsub(), [P(2, 0), R.comp(tsub(), [P(2, 0), P(2, 1)])]));
}

// ------------------------------------------------------------------ relations

/**
 * χ_IsZero(0) = 1, χ_IsZero(x + 1) = 0. Officially (with a dummy parameter, as for pred):
 * z′(x, 0) = const_1(x), z′(x, y + 1) = zero(P^3_0(x, y, z′(x, y)));  χ_IsZero(y) = z′(zero(y), y).
 */
export function isZero(): RF {
  const z = R.def("IsZero'", "\\chi_{\\mathrm{IsZero}}'", R.rec(constN(1), R.comp(R.zero(), [P(3, 0)])));
  return R.def('IsZero', '\\chi_{\\mathrm{IsZero}}', R.comp(z, [R.zero(), P(1, 0)]));
}

/** χ_=(x, y) = χ_IsZero(|x − y|). */
export function chiEq(): RF {
  return R.def('chi_eq', '\\chi_{=}', R.comp(isZero(), [dist()]));
}

/** χ_≤(x, y) = χ_IsZero(x ∸ y). */
export function chiLeq(): RF {
  return R.def('chi_leq', '\\chi_{\\le}', R.comp(isZero(), [tsub()]));
}

/** χ_<(x, y) = χ_≤(x + 1, y). */
export function chiLt(): RF {
  return R.def('chi_lt', '\\chi_{<}', R.comp(chiLeq(), [R.comp(R.succ(), [P(2, 0)]), P(2, 1)]));
}

function sameArity(fs: RF[], what: string): number {
  const as = fs.map(arityOf);
  if (new Set(as).size > 1) throw new Error(`${what}: the relations must take the same number of arguments (${as.join(', ')})`);
  return as[0];
}

/** χ_¬P = 1 ∸ χ_P. */
export function charNot(p: RF, label?: Label): RF {
  const k = arityOf(p);
  return R.def(label?.name ?? `not(${nameOf(p)})`, label?.tex ?? `\\chi_{\\lnot}(${labelOf(p)})`, R.comp(tsub(), [constN(1, k), p]));
}

/** χ_{P∧Q} = χ_P · χ_Q. */
export function charAnd(p: RF, q: RF, label?: Label): RF {
  sameArity([p, q], 'and');
  return R.def(label?.name ?? `and(${nameOf(p)}, ${nameOf(q)})`, label?.tex ?? `\\chi_{\\land}(${labelOf(p)}, ${labelOf(q)})`, R.comp(mult(), [p, q]));
}

/** χ_{P∨Q} = max(χ_P, χ_Q). */
export function charOr(p: RF, q: RF, label?: Label): RF {
  sameArity([p, q], 'or');
  return R.def(label?.name ?? `or(${nameOf(p)}, ${nameOf(q)})`, label?.tex ?? `\\chi_{\\lor}(${labelOf(p)}, ${labelOf(q)})`, R.comp(max(), [p, q]));
}

/** χ_{P→Q} = max(1 ∸ χ_P, χ_Q). */
export function charImplies(p: RF, q: RF, label?: Label): RF {
  sameArity([p, q], 'implies');
  return R.def(label?.name ?? `implies(${nameOf(p)}, ${nameOf(q)})`, label?.tex ?? `\\chi_{\\to}(${labelOf(p)}, ${labelOf(q)})`, R.comp(max(), [charNot(p), q]));
}

// ------------------------------------------------------------------ cond and definition by cases

/**
 * cond(x, y, z) = y if x = 0, z otherwise:  cond(0, y, z) = y, cond(x + 1, y, z) = z.
 * The book recurses on the first argument; officially the recursion argument comes last, so
 * cond′(y, z, 0) = P^2_0(y, z), cond′(y, z, x + 1) = P^4_1(y, z, x, cond′(y, z, x)), and
 * cond(x, y, z) = cond′(P^3_1, P^3_2, P^3_0).
 */
export function cond(): RF {
  const c = R.def("cond'", "\\mathrm{cond}'", R.rec(P(2, 0), P(4, 1)));
  return R.def('cond', '\\mathrm{cond}', R.comp(c, [P(3, 1), P(3, 2), P(3, 0)]));
}

export interface Case {
  /** the characteristic function of R_i */
  rel: RF;
  /** g_i */
  fn: RF;
}

/**
 * f(x⃗) = g_0(x⃗) if R_0(x⃗); g_1(x⃗) if R_1(x⃗) and not R_0(x⃗); …; g_m(x⃗) otherwise.
 * For one case, f = cond(χ_¬R_0, g_0, g_1); more cases are composed from this.
 */
export function byCases(cases: Case[], otherwise: RF, label?: Label): RF {
  const all = [...cases.flatMap((c) => [c.rel, c.fn]), otherwise];
  sameArity(all, 'definition by cases');
  let body = otherwise;
  for (let i = cases.length - 1; i >= 0; i--) body = R.comp(cond(), [charNot(cases[i].rel), cases[i].fn, body]);
  return label ? R.def(label.name, label.tex, body) : body;
}

// ------------------------------------------------------------------ bounded quantification and minimization

/**
 * Builds P(x⃗, y) by primitive recursion from R(x⃗, z) with k = |x⃗| ≥ 1. When R has one argument
 * (k = 0), the recursion is made official with a dummy parameter w, as for pred:
 * P′(w, y) is built from R′(w, z) = R(z), and P(y) = P′(zero(y), y).
 */
function withParams(r: RF, build: (r: RF, k: number) => RF): RF {
  const n = arityOf(r);
  if (n < 1) throw new Error('the relation needs an argument z to quantify over');
  if (n > 1) return build(r, n - 1);
  const dummy = build(R.comp(r, [P(2, 1)]), 1);
  return R.comp(dummy, [R.zero(), P(1, 0)]);
}

/** R(x⃗, y) applied to the arguments (x⃗, y, z) of a step function: R ∘ (P^{k+2}_0, …, P^{k+2}_k). */
function relAtStep(r: RF, k: number): RF {
  return R.comp(r, firstProjs(k + 2, k + 1));
}

/**
 * P(x⃗, y) ⟺ ∀z < y R(x⃗, z):  χ_P(x⃗, 0) = 1, χ_P(x⃗, y + 1) = min(χ_P(x⃗, y), χ_R(x⃗, y)).
 */
export function bforall(r: RF, label?: Label): RF {
  const body = withParams(r, (rr, k) => R.rec(constN(1, k), R.comp(min(), [P(k + 2, k + 1), relAtStep(rr, k)])));
  return R.def(label?.name ?? `forall<(${nameOf(r)})`, label?.tex ?? `\\chi_{(\\forall z < y)}(${labelOf(r)})`, body);
}

/**
 * P(x⃗, y) ⟺ ∃z < y R(x⃗, z):  χ_P(x⃗, 0) = 0, χ_P(x⃗, y + 1) = max(χ_P(x⃗, y), χ_R(x⃗, y)).
 */
export function bexists(r: RF, label?: Label): RF {
  const body = withParams(r, (rr, k) => R.rec(constN(0, k), R.comp(max(), [P(k + 2, k + 1), relAtStep(rr, k)])));
  return R.def(label?.name ?? `exists<(${nameOf(r)})`, label?.tex ?? `\\chi_{(\\exists z < y)}(${labelOf(r)})`, body);
}

/** The bound y + 1 in place of y: Q(x⃗, y) ⟺ P(x⃗, y + 1) (e.g. ∃z ≤ y is ∃z < y + 1). */
function upToAndIncluding(p: RF): RF {
  const n = arityOf(p);
  return R.comp(p, [...firstProjs(n, n - 1), R.comp(R.succ(), [P(n, n - 1)])]);
}

/** ∀z ≤ y R(x⃗, z), as ∀z < y + 1 R(x⃗, z). */
export function bforallLeq(r: RF, label?: Label): RF {
  return R.def(label?.name ?? `forall<=(${nameOf(r)})`, label?.tex ?? `\\chi_{(\\forall z \\le y)}(${labelOf(r)})`, upToAndIncluding(bforall(r)));
}

/** ∃z ≤ y R(x⃗, z), as ∃z < y + 1 R(x⃗, z). */
export function bexistsLeq(r: RF, label?: Label): RF {
  return R.def(label?.name ?? `exists<=(${nameOf(r)})`, label?.tex ?? `\\chi_{(\\exists z \\le y)}(${labelOf(r)})`, upToAndIncluding(bexists(r)));
}

/**
 * m_R(x⃗, y) = (min z < y) R(x⃗, z): the least z < y with R(x⃗, z), and y if there is none.
 *   m_R(x⃗, 0) = 0
 *   m_R(x⃗, y + 1) = m_R(x⃗, y) if m_R(x⃗, y) ≠ y;  y if m_R(x⃗, y) = y and R(x⃗, y);  y + 1 otherwise.
 */
export function bmin(r: RF, label?: Label): RF {
  const body = withParams(r, (rr, k) => {
    const n = k + 2; // step arguments: x⃗, y, m
    const y = () => P(n, k);
    const m = () => P(n, k + 1);
    const step = byCases(
      [
        { rel: charNot(R.comp(chiEq(), [m(), y()])), fn: m() },
        { rel: relAtStep(rr, k), fn: y() },
      ],
      R.comp(R.succ(), [y()]),
    );
    return R.rec(constN(0, k), step);
  });
  return R.def(label?.name ?? `min<(${nameOf(r)})`, label?.tex ?? `(\\min z < y)\\,${labelOf(r)}`, body);
}

// ------------------------------------------------------------------ divisibility and primes

/** x ∣ y ⟺ ∃z ≤ y (x · z) = y. */
export function divides(): RF {
  // R(x, y, z) ⟺ x · z = y;  D(x, y, b) ⟺ ∃z ≤ b R(x, y, z);  x ∣ y ⟺ D(x, y, y).
  const r = R.comp(chiEq(), [R.comp(mult(), [P(3, 0), P(3, 2)]), P(3, 1)]);
  const d = bexistsLeq(r);
  return R.def('divides', '\\chi_{\\mid}', R.comp(d, [P(2, 0), P(2, 1), P(2, 1)]));
}

/** Prime(x) ⟺ x ≥ 2 ∧ ∀y ≤ x (y ∣ x → y = 1 ∨ y = x). */
export function prime(): RF {
  // S(x, y) ⟺ y ∣ x → (y = 1 ∨ y = x)
  const yDivX = R.comp(divides(), [P(2, 1), P(2, 0)]);
  const yIs1 = R.comp(chiEq(), [P(2, 1), constN(1, 2)]);
  const yIsX = R.comp(chiEq(), [P(2, 1), P(2, 0)]);
  const s = charImplies(yDivX, charOr(yIs1, yIsX));
  const all = bforallLeq(s); // A(x, b) ⟺ ∀y ≤ b S(x, y)
  const atLeast2 = R.comp(chiLeq(), [constN(2), P(1, 0)]);
  return R.def('Prime', '\\chi_{\\mathrm{Prime}}', charAnd(atLeast2, R.comp(all, [P(1, 0), P(1, 0)])));
}

// ------------------------------------------------------------------ catalogue

export interface LibraryEntry {
  name: string;
  tex: string;
  arity: number;
  build: () => RF;
  /** the function the definition is meant to compute */
  spec: (args: bigint[]) => bigint;
  /** a short description, e.g. the book's equations */
  note: string;
}

const b = (c: boolean) => (c ? 1n : 0n);

/** The functions above with their intended meanings (for checking and display). */
export const LIBRARY: LibraryEntry[] = [
  { name: 'id', tex: '\\mathrm{id}', arity: 1, build: id, spec: ([x]) => x, note: 'id(x) = P^1_0(x)' },
  { name: 'const_3', tex: '\\mathrm{const}_{3}', arity: 1, build: () => constN(3), spec: () => 3n, note: 'succ(succ(succ(zero(x))))' },
  { name: 'add', tex: '\\mathrm{add}', arity: 2, build: add, spec: ([x, y]) => x + y, note: 'add(x, 0) = x, add(x, y + 1) = succ(add(x, y))' },
  { name: 'mult', tex: '\\mathrm{mult}', arity: 2, build: mult, spec: ([x, y]) => x * y, note: 'mult(x, 0) = 0, mult(x, y + 1) = add(mult(x, y), x)' },
  { name: 'exp', tex: '\\mathrm{exp}', arity: 2, build: exp, spec: ([x, y]) => x ** y, note: 'exp(x, 0) = 1, exp(x, y + 1) = mult(x, exp(x, y))' },
  { name: 'pred', tex: '\\mathrm{pred}', arity: 1, build: pred, spec: ([x]) => (x === 0n ? 0n : x - 1n), note: 'pred(0) = 0, pred(y + 1) = y' },
  { name: 'fac', tex: '\\mathrm{fac}', arity: 1, build: fac, spec: ([x]) => { let r = 1n; for (let i = 2n; i <= x; i++) r *= i; return r; }, note: 'fac(0) = 1, fac(y + 1) = fac(y) · (y + 1)' },
  { name: 'tsub', tex: '\\mathrm{tsub}', arity: 2, build: tsub, spec: ([x, y]) => (x < y ? 0n : x - y), note: 'x ∸ 0 = x, x ∸ (y + 1) = pred(x ∸ y)' },
  { name: 'dist', tex: '\\mathrm{dist}', arity: 2, build: dist, spec: ([x, y]) => (x < y ? y - x : x - y), note: '|x − y| = (x ∸ y) + (y ∸ x)' },
  { name: 'max', tex: '\\mathrm{max}', arity: 2, build: max, spec: ([x, y]) => (x > y ? x : y), note: 'max(x, y) = x + (y ∸ x)' },
  { name: 'min', tex: '\\mathrm{min}', arity: 2, build: min, spec: ([x, y]) => (x < y ? x : y), note: 'min(x, y) = x ∸ (x ∸ y)' },
  { name: 'IsZero', tex: '\\chi_{\\mathrm{IsZero}}', arity: 1, build: isZero, spec: ([x]) => b(x === 0n), note: 'χ(0) = 1, χ(x + 1) = 0' },
  { name: 'chi_eq', tex: '\\chi_{=}', arity: 2, build: chiEq, spec: ([x, y]) => b(x === y), note: 'χ_=(x, y) = χ_IsZero(|x − y|)' },
  { name: 'chi_leq', tex: '\\chi_{\\le}', arity: 2, build: chiLeq, spec: ([x, y]) => b(x <= y), note: 'χ_≤(x, y) = χ_IsZero(x ∸ y)' },
  { name: 'chi_lt', tex: '\\chi_{<}', arity: 2, build: chiLt, spec: ([x, y]) => b(x < y), note: 'χ_<(x, y) = χ_≤(x + 1, y)' },
  { name: 'cond', tex: '\\mathrm{cond}', arity: 3, build: cond, spec: ([x, y, z]) => (x === 0n ? y : z), note: 'cond(0, y, z) = y, cond(x + 1, y, z) = z' },
  { name: 'divides', tex: '\\chi_{\\mid}', arity: 2, build: divides, spec: ([x, y]) => b(x === 0n ? y === 0n : y % x === 0n), note: 'x ∣ y ⟺ ∃z ≤ y (x · z = y)' },
  { name: 'Prime', tex: '\\chi_{\\mathrm{Prime}}', arity: 1, build: prime, spec: ([x]) => { if (x < 2n) return 0n; for (let d = 2n; d * d <= x; d++) if (x % d === 0n) return 0n; return 1n; }, note: 'x ≥ 2 ∧ ∀y ≤ x (y ∣ x → y = 1 ∨ y = x)' },
];
