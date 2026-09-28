// Craig's trick (Proposition "ce-ax" in "Computable Enumerability and Axiomatizable Theories"):
// from an enumeration A₀, A₁, A₂, … of a theory, the set
//
//   Γ = {A₀, A₁ ∧ A₁, A₂ ∧ (A₂ ∧ A₂), …}      (the n-th element has n + 1 copies of Aₙ)
//
// axiomatizes the same theory and is decidable: to test F ∈ Γ, read off how many copies of which
// formula F is made of, and compare with that element of the enumeration — one enumeration step,
// no search.
//
// As in the proof, k copies go with the element Aₖ₋₁ (k = n + 1), and a formula F can be read in
// two ways — as one copy of F, and, if it has the right shape, as k ≥ 2 copies of its left
// conjunct — so both readings are tested (A₀ may itself be a conjunction of identical conjuncts).

import type { Formula } from '../syntax/ast.ts';
import { freshId } from '../syntax/ast.ts';
import { formulaEq } from '../syntax/ops.ts';

/** B ∧ (B ∧ (… ∧ B)) with k ≥ 1 copies of B. */
export function copies(B: Formula, k: number): Formula {
  if (!Number.isInteger(k) || k < 1) throw new RangeError('at least one copy');
  let f: Formula = B;
  for (let i = 1; i < k; i++) f = { k: 'and', id: freshId('c'), a: B, b: f };
  return f;
}

/** The n-th element of Γ: n + 1 copies of Aₙ. */
export function craigElement(An: Formula, n: number): Formula {
  return copies(An, n + 1);
}

export interface Reading {
  /** the repeated formula */
  B: Formula;
  /** how many copies */
  k: number;
  /** the element of the enumeration it must be: n = k − 1 */
  n: number;
}

/** All ways of reading F as k copies of some B: always (F, 1), and (left conjunct, k) if F has that shape. */
export function readings(F: Formula): Reading[] {
  const out: Reading[] = [{ B: F, k: 1, n: 0 }];
  if (F.k !== 'and') return out;
  const B = F.a;
  let rest: Formula = F.b;
  let k = 2;
  while (!formulaEq(rest, B)) {
    if (rest.k !== 'and' || !formulaEq(rest.a, B)) return out;
    rest = rest.b;
    k++;
  }
  out.push({ B, k, n: k - 1 });
  return out;
}

export interface Membership {
  member: boolean;
  /** each reading, with the comparison made */
  tests: { reading: Reading; An: Formula | null; equal: boolean }[];
}

/**
 * Is F ∈ Γ? `enumeration(n)` gives Aₙ (null if the enumeration shown is too short to say — then
 * that reading is reported as not compared).
 */
export function inGamma(F: Formula, enumeration: (n: number) => Formula | null): Membership {
  const tests = readings(F).map((reading) => {
    const An = enumeration(reading.n);
    return { reading, An, equal: An !== null && formulaEq(An, reading.B) };
  });
  return { member: tests.some((t) => t.equal), tests };
}
