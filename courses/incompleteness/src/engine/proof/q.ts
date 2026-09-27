// Robinson's Q and derivations of the numeral facts the book proves about it
// (section Basic Functions are Representable in Q).
//
// The book proves these lemmas "by induction on m" in the metalanguage: for each particular n
// and m there is a derivation. The functions below build that derivation for the given numbers;
// every step is then verified by the natural deduction checker. A finite number of checked
// instances is not a proof of the lemma for all n and m — the induction in the text is.

import * as A from '../syntax/ast.ts';
import type { Formula } from '../syntax/ast.ts';
import { parseFormula } from '../syntax/parse.ts';
import { lit } from '../numbers/nat.ts';
import { D, symm, type Deriv } from './nd.ts';

export const Q_AXIOM_TEXT: [string, string, string][] = [
  ['Q1', '∀x ∀y (x′ = y′ → x = y)', 'Successor is injective.'],
  ['Q2', '∀x 0 ≠ x′', '0 is not a successor.'],
  ['Q3', '∀x (x = 0 ∨ ∃y x = y′)', 'Every number other than 0 is a successor.'],
  ['Q4', '∀x (x + 0) = x', 'Addition: base case.'],
  ['Q5', "∀x ∀y (x + y′) = (x + y)′", 'Addition: recursion step.'],
  ['Q6', '∀x (x × 0) = 0', 'Multiplication: base case.'],
  ['Q7', "∀x ∀y (x × y′) = ((x × y) + x)", 'Multiplication: recursion step.'],
  ['Q8', "∀x ∀y (x < y ↔ ∃z (z′ + x) = y)", 'Definition of <.'],
];

export function qAxioms(): Map<string, Formula> {
  return new Map(Q_AXIOM_TEXT.map(([name, text]) => [name, parseFormula(text)]));
}

let cached: Map<string, Formula> | null = null;
export function Q(): Map<string, Formula> {
  return (cached ??= qAxioms());
}

export const num = (n: bigint | number) => (BigInt(n) === 0n ? A.zero() : A.numeral(lit(BigInt(n))));

const ax = (name: string, group?: string) => D.axiom(name, A.cloneFresh(Q().get(name)!), { group });

/** Q ⊢ n̄ + m̄ = n+m̄  (Lemma "Q proves addition"), by recursion on m. */
export function deriveAdd(n: bigint, m: bigint, group = `n̄ + m̄ = ${n + m}`): Deriv {
  if (m === 0n) {
    return D.allE(ax('Q4', group), num(n), { note: `Q4 with x := ${n}̄ gives ${n}̄ + 0 = ${n}̄.`, group });
  }
  const ih = deriveAdd(n, m - 1n, group);
  const q5 = D.allE(D.allE(ax('Q5', group), num(n), { group }), num(m - 1n), {
    note: `Q5 with x := ${n}̄, y := ${m - 1n}̄: since ${m}̄ is ${m - 1n}̄′, this is ${n}̄ + ${m}̄ = (${n}̄ + ${m - 1n}̄)′.`,
    group,
  });
  const concl = A.eq(A.plus(num(n), num(m)), num(n + m));
  return D.eqE(ih, q5, concl, {
    note: `Replace ${n}̄ + ${m - 1n}̄ by ${n + m - 1n}̄ (the previous line), and ${n + m - 1n}̄′ is ${n + m}̄.`,
    group,
  });
}

/** Q ⊢ n̄ × m̄ = n·m̄  (Lemma "Q proves multiplication"). */
export function deriveMult(n: bigint, m: bigint, group = `n̄ × m̄ = ${n * m}`): Deriv {
  if (m === 0n) {
    return D.allE(ax('Q6', group), num(n), { note: `Q6 with x := ${n}̄.`, group });
  }
  const ih = deriveMult(n, m - 1n, group);
  const k = n * (m - 1n);
  const q7 = D.allE(D.allE(ax('Q7', group), num(n), { group }), num(m - 1n), { note: `Q7 with x := ${n}̄, y := ${m - 1n}̄.`, group });
  // n̄ × m̄ = (n̄ × (m−1)̄) + n̄  ⟶  n̄ × m̄ = k̄ + n̄
  const step1 = D.eqE(ih, q7, A.eq(A.times(num(n), num(m)), A.plus(num(k), num(n))), { note: `Replace ${n}̄ × ${m - 1n}̄ by ${k}̄.`, group });
  const add = deriveAdd(k, n, group);
  return D.eqE(add, step1, A.eq(A.times(num(n), num(m)), num(k + n)), { note: `Replace ${k}̄ + ${n}̄ by ${k + n}̄.`, group });
}

/** Q ⊢ ¬ n̄ = m̄ for n ≠ m  (Lemma "Q proves different numerals are different"). */
export function deriveNeq(n: bigint, m: bigint, labels = { next: 100 }, group = `${n}̄ ≠ ${m}̄`): Deriv {
  if (n === m) throw new Error('deriveNeq: the numbers are equal');
  if (n === 0n) {
    // m = k + 1: Q2 with x := k̄.
    return D.allE(ax('Q2', group), num(m - 1n), { note: `Q2 with x := ${m - 1n}̄: 0 ≠ ${m - 1n}̄′, and ${m - 1n}̄′ is ${m}̄.`, group });
  }
  if (m === 0n) {
    // ¬ n̄ = 0 from Q2 and symmetry.
    const label = labels.next++;
    const q2 = D.allE(ax('Q2', group), num(n - 1n), { note: `Q2 gives 0 ≠ ${n}̄.`, group });
    const assumption = D.assume(A.eq(num(n), A.zero()), label, { group });
    const flipped = symm(assumption, { group });
    const contra = D.notE(q2, flipped, { group });
    return D.notI(contra, A.eq(num(n), A.zero()), label, { note: `So ${n}̄ = 0 is refuted.`, group });
  }
  // n = n'+1, m = k+1 with n' ≠ k
  const ih = deriveNeq(n - 1n, m - 1n, labels, group);
  const label = labels.next++;
  const q1 = D.allE(D.allE(ax('Q1', group), num(n - 1n), { group }), num(m - 1n), { note: `Q1 with x := ${n - 1n}̄, y := ${m - 1n}̄.`, group });
  const assumption = D.assume(A.eq(num(n), num(m)), label, { group });
  const smaller = D.impE(q1, assumption, { note: `From ${n}̄ = ${m}̄ by Q1: ${n - 1n}̄ = ${m - 1n}̄.`, group });
  const contra = D.notE(ih, smaller, { group });
  return D.notI(contra, A.eq(num(n), num(m)), label, { note: `Contradiction with ${n - 1n}̄ ≠ ${m - 1n}̄, so ${n}̄ ≠ ${m}̄.`, group });
}
