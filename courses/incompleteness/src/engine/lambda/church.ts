// Church encodings from chapter "Lambda Definability": numerals, truth values, pairs, the named
// terms of BOOK_DEFS, and the constructions in the proofs that the primitive recursive and the
// general recursive functions are λ-definable (projection, composition, primitive recursion,
// minimization). Decoders read results back after normalising.

import type { Term } from './term.ts';
import { app, apps, freeVars, freshName, isClosed, lam, lams, variable, withLabel } from './term.ts';
import { booleanValue, churchNumeral, numeralValue } from './numerals.ts';
import { BOOK_DEFS, type Definition } from './defs.ts';
import { parseLambda } from './parse.ts';
import { normalize } from './reduce.ts';

export { churchNumeral, churchBoolean, numeralValue, booleanValue, numeralLabel } from './numerals.ts';

export interface DecodeOptions {
  /** Reduce to normal form (normal order) first. Default true. */
  normalize?: boolean;
  /** Step limit for normalising (default 10 000). */
  fuel?: number;
}

function nf(t: Term, o: DecodeOptions): Term | null {
  if (o.normalize === false) return t;
  return normalize(t, { fuel: o.fuel ?? 10_000 });
}

/** n if M reduces (normal order, within the fuel) to a term α-equivalent to n̄; else null. */
export function decodeNumeral(t: Term, o: DecodeOptions = {}): number | null {
  const direct = numeralValue(t);
  if (direct !== null) return direct;
  const n = nf(t, o);
  return n === null ? null : numeralValue(n);
}

/** true/false if M reduces to (a term α-equivalent to) true ≡ λx.λy.x or false ≡ λx.λy.y; else null. */
export function decodeBoolean(t: Term, o: DecodeOptions = {}): boolean | null {
  const direct = booleanValue(t);
  if (direct !== null) return direct;
  const n = nf(t, o);
  return n === null ? null : booleanValue(n);
}

/** The pair ⟨M, N⟩ ≡ λf.f M N (with f chosen not free in M, N). */
export function pair(m: Term, n: Term): Term {
  const f = freshName('f', new Set([...freeVars(m), ...freeVars(n)]));
  return lam(f, apps(variable(f), m, n));
}

/** If M reduces to a pair λf.f A B (f not free in A, B), returns [A, B]; else null. */
export function decodePair(t: Term, o: DecodeOptions = {}): [Term, Term] | null {
  const n = nf(t, o);
  if (n === null || n.k !== 'abs') return null;
  const b = n.body;
  if (b.k !== 'app' || b.fn.k !== 'app' || b.fn.fn.k !== 'var' || b.fn.fn.name !== n.param) return null;
  const [x, y] = [b.fn.arg, b.arg];
  if (freeVars(x).has(n.param) || freeVars(y).has(n.param)) return null;
  return [x, y];
}

/** A fresh copy of a named term of the book (BOOK_DEFS), labelled with its name: combinator('Y'). */
export function combinator(name: string, defs: Record<string, string | Definition> = BOOK_DEFS): Term {
  return parseLambda(name, { defs });
}

/** A named term applied to arguments; numbers become Church numerals: applyNamed('Add', 2, 3). */
export function applyNamed(name: string, ...args: (Term | number)[]): Term {
  return apps(combinator(name), ...args.map((a) => (typeof a === 'number' ? churchNumeral(a) : a)));
}

// ------------------------------------------------------------------ λ-definability constructions

/** Pᵢⁿ ≡ λx₀ … xₙ₋₁. xᵢ (section “Primitive Recursive Functions are λ-Definable”). */
export function projection(n: number, i: number): Term {
  if (!(n >= 1 && i >= 0 && i < n)) throw new Error(`projection: need 0 ≤ i < n (got n = ${n}, i = ${i})`);
  const xs = Array.from({ length: n }, (_, j) => `x_${j}`);
  return withLabel(lams(xs, variable(xs[i]!)), `P^${n}_${i}`);
}

function requireClosed(what: string, t: Term) {
  if (!isClosed(t)) throw new Error(`${what} must be a closed term (it has free ${[...freeVars(t)].join(', ')})`);
}

/**
 * Composition (lemma in section “Primitive Recursive Functions are λ-Definable”):
 * H ≡ λx₀ … xₙ₋₁. F (G₀ x₀ … xₙ₋₁) … (Gₖ₋₁ x₀ … xₙ₋₁).
 */
export function composition(f: Term, gs: Term[], n: number): Term {
  requireClosed('F', f);
  gs.forEach((g, i) => requireClosed(`G${i}`, g));
  const xs = Array.from({ length: n }, (_, j) => `x_${j}`);
  const call = (g: Term) => apps(g, ...xs.map((x) => variable(x)));
  return lams(xs, apps(f, ...gs.map(call)));
}

/**
 * Primitive recursion with one extra argument x (same section):
 * H ≡ λx.λy. Snd (y D ⟨0̄, F x⟩)  where  D ≡ λp.⟨Succ (Fst p), G x (Fst p) (Snd p)⟩.
 */
export function primitiveRecursion(f: Term, g: Term): Term {
  requireClosed('F', f);
  requireClosed('G', g);
  return parseLambda('λx y. Snd (y (λp. ⟨Succ (Fst p), G x (Fst p) (Snd p)⟩) ⟨0, F x⟩)', { defs: { ...BOOK_DEFS, F: { src: f, label: f.label ?? 'F' }, G: { src: g, label: g.label ?? 'G' } } });
}

/**
 * Minimization (section “Minimization”), for a regular F of k + 1 arguments:
 * H ≡ λx₁ … xₖ. (Y Search) F x₁ … xₖ 0̄, where
 * Search ≡ λg f x₁ … xₖ y. IsZero (f x₁ … xₖ y) y (g f x₁ … xₖ (Succ y)).
 */
export function minimization(f: Term, k: number): Term {
  requireClosed('F', f);
  const xs = Array.from({ length: k }, (_, j) => `x_${j + 1}`).join(' ');
  const search = withLabel(parseLambda(`λg f ${xs} y. IsZero (f ${xs} y) y (g f ${xs} (Succ y))`), 'Search');
  const h = parseLambda(k === 0 ? 'Y Search F 0' : `λ${xs}. Y Search F ${xs} 0`, { defs: { ...BOOK_DEFS, Search: { src: search }, F: { src: f, label: f.label ?? 'F' } } });
  return h;
}

/** The Church numeral for n applied through a function term: F n̄₁ … n̄ₖ. */
export function applyTo(f: Term, ...ns: number[]): Term {
  return ns.reduce<Term>((acc, n) => app(acc, churchNumeral(n)), f);
}
