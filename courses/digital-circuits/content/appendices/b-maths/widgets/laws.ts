/**
 * The laws of Boolean algebra for Appendix B (and the reference for Chapter 11). Each law is a pair of
 * expressions; the tests, and the widget when it loads, check every one on all its truth-table rows.
 */
import { equivalent } from './boolexpr';

export interface Law {
  name: string;
  /** Both sides, in the notation of the course: · is AND, + is OR, ¬ is NOT, ⊕ is XOR. */
  lhs: string;
  rhs: string;
  /** The dual: swap · and +, and 0 and 1. */
  dual?: { lhs: string; rhs: string };
  note?: string;
}

export interface LawGroup {
  title: string;
  laws: Law[];
}

export const LAW_GROUPS: LawGroup[] = [
  {
    title: 'With constants',
    laws: [
      { name: 'Identity', lhs: 'A · 1', rhs: 'A', dual: { lhs: 'A + 0', rhs: 'A' }, note: 'A wire in series with nothing (a closed switch) or in parallel with nothing (an open one) is the wire.' },
      { name: 'Domination', lhs: 'A · 0', rhs: '0', dual: { lhs: 'A + 1', rhs: '1' }, note: 'An open switch in series kills the branch; a closed switch in parallel shorts it.' },
      { name: 'Complement', lhs: 'A · ¬A', rhs: '0', dual: { lhs: 'A + ¬A', rhs: '1' }, note: 'A signal and its inverse are never both 1, and never both 0.' },
    ],
  },
  {
    title: 'With itself',
    laws: [
      { name: 'Idempotence', lhs: 'A · A', rhs: 'A', dual: { lhs: 'A + A', rhs: 'A' }, note: 'Two identical switches in series or in parallel behave as one.' },
      { name: 'Double negation', lhs: '¬¬A', rhs: 'A', note: 'Two inverters in a row are a buffer.' },
    ],
  },
  {
    title: 'Reordering',
    laws: [
      { name: 'Commutativity', lhs: 'A · B', rhs: 'B · A', dual: { lhs: 'A + B', rhs: 'B + A' } },
      { name: 'Associativity', lhs: '(A · B) · C', rhs: 'A · (B · C)', dual: { lhs: '(A + B) + C', rhs: 'A + (B + C)' }, note: 'Why a 3-input AND can be built from two 2-input ANDs in either order.' },
      { name: 'Distributivity', lhs: 'A · (B + C)', rhs: 'A · B + A · C', dual: { lhs: 'A + B · C', rhs: '(A + B) · (A + C)' }, note: 'The second form has no counterpart in ordinary arithmetic.' },
    ],
  },
  {
    title: 'Simplifying',
    laws: [
      { name: 'Absorption', lhs: 'A + A · B', rhs: 'A', dual: { lhs: 'A · (A + B)', rhs: 'A' }, note: 'If A is 1 then B cannot matter, and if A is 0 the second term is 0 too.' },
      { name: 'Combining (adjacency)', lhs: 'A · B + A · ¬B', rhs: 'A', dual: { lhs: '(A + B) · (A + ¬B)', rhs: 'A' }, note: 'The step every Karnaugh-map loop takes (Chapter 12).' },
      { name: 'Redundant literal', lhs: 'A + ¬A · B', rhs: 'A + B', dual: { lhs: 'A · (¬A + B)', rhs: 'A · B' } },
      { name: 'Consensus', lhs: 'A · B + ¬A · C + B · C', rhs: 'A · B + ¬A · C', dual: { lhs: '(A + B) · (¬A + C) · (B + C)', rhs: '(A + B) · (¬A + C)' }, note: 'The third term is covered by the other two, and removing it removes a gate (and a hazard, if you keep it: Chapter 15).' },
    ],
  },
  {
    title: 'De Morgan',
    laws: [
      { name: 'De Morgan', lhs: '¬(A · B)', rhs: '¬A + ¬B', dual: { lhs: '¬(A + B)', rhs: '¬A · ¬B' }, note: 'Invert everything and swap AND with OR: the rule behind bubble pushing.' },
    ],
  },
  {
    title: 'Exclusive or',
    laws: [
      { name: 'Definition', lhs: 'A ⊕ B', rhs: 'A · ¬B + ¬A · B', note: '1 when the inputs differ.' },
      { name: 'With constants', lhs: 'A ⊕ 0', rhs: 'A', dual: { lhs: 'A ⊕ 1', rhs: '¬A' }, note: 'XOR with 1 is a controlled inverter.' },
      { name: 'With itself', lhs: 'A ⊕ A', rhs: '0', dual: { lhs: 'A ⊕ ¬A', rhs: '1' } },
      { name: 'Associativity', lhs: '(A ⊕ B) ⊕ C', rhs: 'A ⊕ (B ⊕ C)', note: 'Parity of any number of bits can be built from a chain or a tree of XORs.' },
      { name: 'Distributes over AND', lhs: 'A · (B ⊕ C)', rhs: 'A · B ⊕ A · C' },
      { name: 'Cancellation', lhs: '(A ⊕ B) ⊕ B', rhs: 'A', note: 'Encrypt and decrypt with the same key; swap two variables without a temporary.' },
    ],
  },
  {
    title: 'One gate is enough',
    laws: [
      { name: 'NAND as NOT', lhs: '¬(A · A)', rhs: '¬A' },
      { name: 'NAND as AND', lhs: '¬(¬(A · B) · ¬(A · B))', rhs: 'A · B' },
      { name: 'NAND as OR', lhs: '¬(¬(A · A) · ¬(B · B))', rhs: 'A + B' },
    ],
  },
];

export const ALL_LAWS: Law[] = LAW_GROUPS.flatMap((g) => g.laws);

/** Every equation in the table (each law and its dual), for checking. */
export function equations(): { name: string; lhs: string; rhs: string }[] {
  return ALL_LAWS.flatMap((l) => [
    { name: l.name, lhs: l.lhs, rhs: l.rhs },
    ...(l.dual ? [{ name: `${l.name} (dual)`, lhs: l.dual.lhs, rhs: l.dual.rhs }] : []),
  ]);
}

/** True if the equation holds on every row of its truth table. */
export const holds = (eq: { lhs: string; rhs: string }): boolean => equivalent(eq.lhs, eq.rhs).equal;
