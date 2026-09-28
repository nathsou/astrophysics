// Finite structures used as examples: the book's own examples where they are finite, and small
// structures for the language of arithmetic and for orders.

import { GENERIC, arithmeticStructure, makeStructure, modArithmetic, type Elem, type Structure } from './structure.ts';

export interface StructurePreset {
  id: string;
  label: string;
  description: string;
  /** Where in the book the structure comes from, if it does. */
  source?: string;
  build(): Structure;
}

const n = (e: Elem) => e as number;

/**
 * The structure of the book's worked example of satisfaction (section "Satisfaction of a Formula
 * in a Structure"): |M| = {1, 2, 3, 4}, a^M = 1, b^M = 2, f^M(x, y) = x + y if x + y ≤ 3 and 3
 * otherwise, R^M = {⟨1,1⟩, ⟨1,2⟩, ⟨2,3⟩, ⟨2,4⟩}.
 */
export function bookSatisfactionExample(): Structure {
  return makeStructure({
    name: 'M',
    description: 'The book’s example: |M| = {1, 2, 3, 4}, a = 1, b = 2, f(x, y) = x + y if x + y ≤ 3 and 3 otherwise, R = {⟨1,1⟩, ⟨1,2⟩, ⟨2,3⟩, ⟨2,4⟩}.',
    domain: [1, 2, 3, 4],
    constants: { 1: 1, 2: 2 },
    functions: [{ ...GENERIC.f(2), def: (x, y) => (n(x) + n(y) <= 3 ? n(x) + n(y) : 3) }],
    relations: [{ ...GENERIC.R(2), def: { tuples: [[1, 1], [1, 2], [2, 3], [2, 4]] } }],
  });
}

/**
 * The structure of the book's problem in the same section: |M| = {1, 2, 3}, c^M = 3,
 * f(1) = 2, f(2) = 3, f(3) = 2, and a two-place relation {⟨1,2⟩, ⟨2,3⟩, ⟨3,3⟩}. The book calls the
 * predicate A; here it is written R (in this edition A is the ASCII spelling of ∀).
 */
export function bookSatisfactionProblem(): Structure {
  return makeStructure({
    name: 'M',
    description: 'The book’s problem: |M| = {1, 2, 3}, c = 3, f(1) = 2, f(2) = 3, f(3) = 2, and the two-place relation {⟨1,2⟩, ⟨2,3⟩, ⟨3,3⟩} (the book’s A, written R here).',
    domain: [1, 2, 3],
    constants: { 3: 3 },
    functions: [{ ...GENERIC.f(1), def: { values: [2, 3, 2] } }],
    relations: [{ ...GENERIC.R(2), def: { tuples: [[1, 2], [2, 3], [3, 3]] } }],
  });
}

/** A strict linear order on {0, …, n−1} (the relation <). */
export function linearOrder(size: number): Structure {
  return makeStructure({
    name: `<_${size}`,
    description: `The numbers 0, …, ${size - 1} with their usual strict order.`,
    domain: Array.from({ length: size }, (_, i) => i),
    relations: [{ arity: 2, index: 0, def: (x, y) => n(x) < n(y) }],
  });
}

/** A structure for L_A in which 0, 1, 2 form a cycle under ′ and a is its own successor. */
export function cycleWithStray(): Structure {
  return arithmeticStructure({
    name: 'C',
    description: 'Domain {0, 1, 2, a}: 0′ = 1, 1′ = 2, 2′ = 0, a′ = a. The element a is not the value of any numeral.',
    domain: [0, 1, 2, 'a'],
    zero: 0,
    succ: { values: [1, 2, 0, 'a'] },
  });
}

export const STRUCTURE_PRESETS: StructurePreset[] = [
  { id: 'book-sat', label: 'The book’s example M (a, b, f, R)', source: 'Satisfaction of a Formula in a Structure', description: 'The worked example of the book: |M| = {1, 2, 3, 4}.', build: bookSatisfactionExample },
  { id: 'book-prob', label: 'The book’s problem M (c, f, R)', source: 'Satisfaction of a Formula in a Structure (problem)', description: 'The structure of the problem at the end of the section.', build: bookSatisfactionProblem },
  { id: 'Z5', label: 'ℤ₅: arithmetic mod 5', description: 'x′ = x + 1 mod 5; + and × mod 5; < the usual order of 0, …, 4.', build: () => modArithmetic(5) },
  { id: 'N4', label: 'ℕ cut off at 4', description: 'x′ = min(x + 1, 4); + and × cut off at 4; < usual.', build: () => modArithmetic(5, 'saturate') },
  { id: 'order4', label: 'A strict linear order with 4 elements', description: '{0, 1, 2, 3} with <.', build: () => linearOrder(4) },
  { id: 'cycle', label: 'A cycle and a stray element (0, ′ only)', description: 'Domain {0, 1, 2, a}: 0 → 1 → 2 → 0 under ′, and a′ = a.', build: cycleWithStray },
];
