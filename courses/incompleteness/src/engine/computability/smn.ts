// The s-m-n theorem and padding, on this edition's indices (see indices.ts: the coding there is
// this edition's, not the book's).
//
// s^m_n(e, a₀, …, a_{m−1}) is the index of the definition
//
//   Comp(E; c_{a₀}, …, c_{a_{m−1}}, P^n_0, …, P^n_{n−1})
//
// where E is the definition with index e and c_a is the n-place constant function with value a
// (const_a = succ ∘ … ∘ succ ∘ zero, composed with P^n_0 when n > 1). Its index is computed
// from e and the aᵢ by arithmetic alone:
//
//   s^m_n(e, a⃗) = 3 + 4·J(e, list(#c_{a₀}, …, #c_{a_{m−1}}, #P^n_0, …, #P^n_{n−1}))
//
// with #const_0 = #zero = 0 and #const_{a+1} = 3 + 4·J(1, J(#const_a, 0)) — a primitive
// recursion on a. Nothing about e is decoded: s^m_n acts on programs, blindly. If e is not the
// index of an (m + n)-place definition, neither side of the s-m-n equation is defined.
//
// Padding: #Comp(P^1_0; f) = 3 + 4·J(2, J(#f, 0)) is an index of the same function as #f, and
// bigger. Iterating it gives infinitely many indices for every function.

import { evaluate, type RF } from '../recursive/rf.ts';
import { J } from './beta.ts';
import { decodeIndex } from './indices.ts';

/** Index of P^n_i (as in indices.ts). */
export function projIndex(n: number, i: number): bigint {
  return 2n + 4n * J(BigInt(i), BigInt(n - 1 - i));
}

/** Index of Comp(f; g₀, …) from the indices of its parts (as in indices.ts). */
export function compIndex(f: bigint, gs: bigint[]): bigint {
  if (gs.length === 0) throw new RangeError('a composition needs at least one inner function');
  let c = J(gs[gs.length - 1], 0n);
  for (let i = gs.length - 2; i >= 0; i--) c = J(gs[i], c + 1n);
  return 3n + 4n * J(f, c);
}

/** Largest constant allowed: #const_a has roughly 4^a bits. */
export const MAX_SMN_CONSTANT = 7;

/** Index of const_a = succ(succ(…zero…)) (unary), by primitive recursion on a. */
export function constIndex(a: number): bigint {
  if (!Number.isInteger(a) || a < 0) throw new RangeError('constants are natural numbers');
  if (a > MAX_SMN_CONSTANT) throw new RangeError(`the index of const_${a} is too large to compute here (it has roughly 4^${a} bits)`);
  let c = 0n;
  for (let k = 0; k < a; k++) c = compIndex(1n, [c]);
  return c;
}

/** Index of the n-place constant function with value a. */
export function constIndexN(a: number, n: number): bigint {
  const c = constIndex(a);
  return n === 1 ? c : compIndex(c, [projIndex(n, 0)]);
}

/** s^m_n(e, a₀, …, a_{m−1}); m = as.length. */
export function smn(e: bigint, as: number[], n: number): bigint {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('n ≥ 1');
  if (as.length < 1) throw new RangeError('m ≥ 1');
  const parts = [...as.map((a) => constIndexN(a, n)), ...Array.from({ length: n }, (_, i) => projIndex(n, i))];
  return compIndex(e, parts);
}

/** #Comp(P^1_0; f): another index of the same function. */
export function padIndex(e: bigint): bigint {
  return compIndex(projIndex(1, 0), [e]);
}

export type RunOutcome =
  | { kind: 'value'; value: bigint; calls: number }
  | { kind: 'outOfFuel'; calls: number }
  | { kind: 'notAFunction'; reason: string };

/** φ^k_e(args): the definition with index e run on k = args.length arguments with a budget. */
export function runIndex(e: bigint, args: bigint[], fuel = 10_000): RunOutcome {
  const d = decodeIndex(e);
  if (!d.ok) return { kind: 'notAFunction', reason: d.errors.join('; ') };
  return runDefinition(d.rf, d.arity, args, fuel);
}

function runDefinition(rf: RF, ar: number, args: bigint[], fuel: number): RunOutcome {
  if (ar !== args.length) return { kind: 'notAFunction', reason: `the definition takes ${ar} argument${ar === 1 ? '' : 's'}, not ${args.length}` };
  const r = evaluate(rf, args, { fuel, maxTraceDepth: -1 });
  if (r.status === 'ok' && r.value !== undefined) return { kind: 'value', value: r.value, calls: r.calls };
  return { kind: 'outOfFuel', calls: r.calls };
}

export interface SmnRow {
  ys: bigint[];
  /** φ^n_{s(e, a⃗)}(y⃗) */
  left: RunOutcome;
  /** φ^{m+n}_e(a⃗, y⃗) */
  right: RunOutcome;
  /** 'agree': both values and equal; 'both-undefined-here': both not a function; 'unknown': a side ran out of fuel */
  verdict: 'agree' | 'differ' | 'both-not-functions' | 'unknown';
}

export interface SmnComparison {
  index: bigint;
  rows: SmnRow[];
}

/** Runs both sides of the s-m-n equation on the sample inputs (computed, not proved). */
export function compareSmn(e: bigint, as: number[], n: number, samples: bigint[][], fuel = 10_000): SmnComparison {
  const index = smn(e, as, n);
  const a = as.map(BigInt);
  const rows = samples.map((ys): SmnRow => {
    const left = runIndex(index, ys, fuel);
    const right = runIndex(e, [...a, ...ys], fuel);
    let verdict: SmnRow['verdict'];
    if (left.kind === 'value' && right.kind === 'value') verdict = left.value === right.value ? 'agree' : 'differ';
    else if (left.kind === 'notAFunction' && right.kind === 'notAFunction') verdict = 'both-not-functions';
    else if (left.kind === 'outOfFuel' || right.kind === 'outOfFuel') verdict = 'unknown';
    else verdict = 'differ';
    return { ys, left, right, verdict };
  });
  return { index, rows };
}
