// Unbounded search, and what can and cannot be observed about it with a finite budget (sections
// "Partial Recursive Functions", "The Normal Form Theorem", "The Halting Problem", "General
// Recursive Functions").
//
// Everything here runs computations with a budget of function calls. A computation that has not
// finished when the budget is used up is reported as such ("no answer within N steps"), never as
// undefined: whether it would ever finish is, in general, the halting problem.

import { arity, evaluate, type RF } from '../recursive/rf.ts';
import { decodeIndex, phi, showDefinition, type PhiOutcome } from './indices.ts';

// ------------------------------------------------------------------ μx f(x, z⃗), step by step

export interface SearchTest {
  x: bigint;
  /** f(x, z⃗), when its computation finished within the budget */
  value?: bigint;
  calls: number;
}

export type SearchResult =
  /** f(0, z⃗), …, f(x − 1, z⃗) were computed and nonzero, and f(x, z⃗) = 0 */
  | { kind: 'found'; value: bigint; tests: SearchTest[]; calls: number }
  /** the computation of f(x, z⃗) for the last test did not finish within the budget */
  | { kind: 'stuck'; at: bigint; tests: SearchTest[]; calls: number }
  /** every test finished with a nonzero value, and the budget (or the number of tests allowed) ran out */
  | { kind: 'exhausted'; searchedBelow: bigint; tests: SearchTest[]; calls: number };

export interface SearchOptions {
  /** total budget of function calls for the whole search (default 20 000) */
  fuel?: number;
  /** maximum number of values of x to try (default 500) */
  maxTests?: number;
}

/**
 * μx f(x, z⃗) as the book describes the procedure: compute f(0, z⃗), f(1, z⃗), … until a value 0
 * is returned. If one of these computations does not halt, neither does the search — even if f
 * is 0 at some larger x.
 */
export function unboundedSearch(f: RF, zs: readonly bigint[], opt: SearchOptions = {}): SearchResult | { kind: 'error'; error: string } {
  const a = arity(f);
  if (!a.ok) return { kind: 'error', error: a.errors.map((e) => e.message).join('; ') };
  if (a.arity !== zs.length + 1) return { kind: 'error', error: `f must take x and the ${zs.length} parameter${zs.length === 1 ? '' : 's'} z⃗: ${zs.length + 1} arguments, not ${a.arity}` };
  let fuel = opt.fuel ?? 20_000;
  const maxTests = opt.maxTests ?? 500;
  const tests: SearchTest[] = [];
  let calls = 0;
  for (let x = 0n; ; x++) {
    if (tests.length >= maxTests || fuel <= 0) return { kind: 'exhausted', searchedBelow: x, tests, calls };
    const r = evaluate(f, [x, ...zs], { fuel, maxTraceDepth: -1 });
    fuel -= r.calls;
    calls += r.calls;
    tests.push({ x, value: r.value, calls: r.calls });
    if (r.status !== 'ok') return { kind: 'stuck', at: x, tests, calls };
    if (r.value === 0n) return { kind: 'found', value: x, tests, calls };
  }
}

// ------------------------------------------------------------------ the normal form, in this edition's terms

export interface NormalFormSearch {
  e: bigint;
  x: bigint;
  /** the definition with index e, or why there is none */
  definition: { ok: true; text: string } | { ok: false; reason: string };
  /** the least s such that the computation of φₑ(x) finishes within s function calls, if found */
  leastS?: number;
  value?: bigint;
  /** the largest s checked */
  checkedUpTo: number;
}

/**
 * An analogue of φₑ(x) ≃ U(μs T(e, x, s)): here T′(e, x, s) says "the computation of φₑ(x)
 * finishes within s function calls" — decidable, since it only runs the computation for at most
 * s calls — and U′ reads off the value. μs T′(e, x, s) is an unbounded search over s. This is
 * not the book's T (which checks that s codes the whole computation), but it has the features
 * that matter: T′ is decidable for each s, and a single unbounded search finds the answer.
 *
 * T′(e, x, s) holds exactly when s ≥ the number of calls the computation takes, so the least s is
 * that number; it is found here by running once with budget `maxS`.
 */
export function normalFormSearch(e: bigint, x: bigint, maxS: number): NormalFormSearch {
  const d = decodeIndex(e);
  const definition = d.ok
    ? d.arity === 1
      ? ({ ok: true, text: showDefinition(d.rf) } as const)
      : ({ ok: false, reason: `index ${e} defines a ${d.arity}-place function, not a unary one` } as const)
    : ({ ok: false, reason: d.errors.join('; ') } as const);
  if (!definition.ok) return { e, x, definition, checkedUpTo: 0 };
  const o = phi(e, x, maxS);
  if (o.kind === 'value') return { e, x, definition, leastS: o.calls, value: o.value, checkedUpTo: maxS };
  return { e, x, definition, checkedUpTo: maxS };
}

// ------------------------------------------------------------------ the halting problem's diagonal

export interface HaltingRow {
  e: bigint;
  /** the definition with index e, in short form, or why e is not the index of a unary function */
  definition: { ok: true; text: string } | { ok: false; reason: string };
  /** φₑ(e), computed with the budget */
  diag: PhiOutcome;
  /**
   * h(e, e): 1 when φₑ(e) was seen to halt, 0 when e is not the index of a unary function (the
   * book's convention), 'unknown' when the computation did not finish within the budget.
   */
  h: 1 | 0 | 'unknown';
  /**
   * The function d of the proof of the halting theorem at e: d(e) = 1 if h(e, e) = 0, and
   * undefined (the search μx x ≠ x never succeeds) if h(e, e) = 1. 'unknown' when h(e, e) is.
   */
  d: 1 | 'undefined' | 'unknown';
}

/** The rows e of the diagonal φₑ(e), with what can be said about h(e, e) and d(e) from a bounded run. */
export function haltingDiagonal(es: readonly bigint[], fuel: number): HaltingRow[] {
  return es.map((e) => {
    const dec = decodeIndex(e);
    const definition = dec.ok
      ? dec.arity === 1
        ? ({ ok: true, text: showDefinition(dec.rf) } as const)
        : ({ ok: false, reason: `${dec.arity}-place` } as const)
      : ({ ok: false, reason: 'not well formed' } as const);
    const diag = phi(e, e, fuel);
    if (diag.kind === 'value') return { e, definition, diag, h: 1, d: 'undefined' } as HaltingRow;
    if (diag.kind === 'notAFunction') return { e, definition, diag, h: 0, d: 1 } as HaltingRow;
    return { e, definition, diag, h: 'unknown', d: 'unknown' } as HaltingRow;
  });
}

/** The indices e in [from, from + span) of well-formed unary definitions (to skip the others). */
export function unaryIndices(from: bigint, span: number): bigint[] {
  const out: bigint[] = [];
  for (let j = 0; j < span; j++) {
    const e = from + BigInt(j);
    const d = decodeIndex(e);
    if (d.ok && d.arity === 1) out.push(e);
  }
  return out;
}
