// Chapters of the companion course, Proofs Are Programs, that build on each chapter of this one:
// the reverse of its `cic` links. Kept in sync by a test in proofs-are-programs (tests/bridges.test.ts).

export interface PapLink {
  /** chapter slug in Proofs Are Programs */
  slug: string;
  num: number;
  title: string;
  /** what the CIC chapter explains, for that chapter */
  what: string;
}

export const PAP: Record<string, PapLink[]> = {
  'system-f': [
    { slug: 'prologue', num: 0, title: 'A Function You Cannot Write', what: 'parametricity: why α → α has one inhabitant' },
    { slug: 'promises', num: 2, title: 'What a Type Can Promise', what: 'polymorphism and parametricity' },
  ],
  'inductive': [
    { slug: 'programs', num: 1, title: 'Programs in the Course Language', what: 'how inductive types are added to the kernel' },
    { slug: 'induction', num: 11, title: 'Induction', what: 'recursors: recursion and induction are the same thing' },
  ],
  'stlc': [
    { slug: 'promises', num: 2, title: 'What a Type Can Promise', what: 'the simply typed λ-calculus and its typing rules' },
    { slug: 'stlc-checker', num: 20, title: 'A Verified Type Checker', what: 'the simply typed λ-calculus' },
  ],
  'curry-howard': [
    { slug: 'evidence', num: 3, title: 'Evidence: the Sort Prop', what: 'natural deduction and the Curry–Howard dictionary' },
    { slug: 'proof-terms', num: 4, title: 'Proofs as Terms', what: 'proof simplification is computation' },
  ],
  'prop': [
    { slug: 'evidence', num: 3, title: 'Evidence: the Sort Prop', what: 'logic as inductive types, and the special sort Prop' },
    { slug: 'quantifiers', num: 5, title: 'Quantifiers', what: 'why proofs cannot be eliminated into data' },
    { slug: 'limits', num: 7, title: 'What You Cannot Prove', what: 'classical logic, safely' },
    { slug: 'typed-language', num: 18, title: 'A Typed Language', what: 'Σ-types and subtypes' },
  ],
  'dependent': [
    { slug: 'quantifiers', num: 5, title: 'Quantifiers', what: 'Π-types and first-order logic' },
  ],
  'families': [
    { slug: 'equality', num: 6, title: 'Equality', what: 'equality as an inductive family' },
    { slug: 'predicates', num: 13, title: 'Inductive Predicates and Decidability', what: 'inductive predicates and index unification' },
    { slug: 'typed-language', num: 18, title: 'A Typed Language', what: 'inductive families, as used for intrinsic typing' },
  ],
  'lean': [
    { slug: 'limits', num: 7, title: 'What You Cannot Prove', what: 'Lean’s three axioms' },
  ],
  'intro': [
    { slug: 'tactics', num: 8, title: 'From Terms to Tactics', what: 'the de Bruijn criterion: why tactics need not be trusted' },
  ],
  'cic': [
    { slug: 'tactics', num: 8, title: 'From Terms to Tactics', what: 'how the kernel checks the term tactics produce' },
    { slug: 'automation', num: 10, title: 'Automation That Leaves a Proof Behind', what: 'definitional equality, which decide relies on' },
    { slug: 'reflection', num: 19, title: 'Reflection', what: 'definitional equality: why computation counts as proof' },
    { slug: 'kernel', num: 21, title: 'A Dependent Type Checker', what: 'the rules of the real kernel' },
  ],
  'recursion': [
    { slug: 'induction', num: 11, title: 'Induction', what: 'how pattern matching compiles to recursors' },
    { slug: 'termination', num: 12, title: 'Termination and Consistency', what: 'why recursion must be restricted' },
  ],
  'beyond-structural': [
    { slug: 'termination', num: 12, title: 'Termination and Consistency', what: 'well-founded recursion from Acc' },
  ],
  'metatheory': [
    { slug: 'termination', num: 12, title: 'Termination and Consistency', what: 'consistency and normalisation' },
    { slug: 'kernel', num: 21, title: 'A Dependent Type Checker', what: 'what breaks when a rule is removed' },
  ],
  'binders': [
    { slug: 'kernel', num: 21, title: 'A Dependent Type Checker', what: 'de Bruijn indices and binders' },
  ],
  'universes': [
    { slug: 'kernel', num: 21, title: 'A Dependent Type Checker', what: 'why Type : Type is inconsistent' },
  ],
};

export function papHref(slug: string): string {
  return `../proofs-are-programs/#/ch/${slug}`;
}
