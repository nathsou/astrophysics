import type { Component } from 'solid-js';

export interface ChapterInfo {
  slug: string;
  part: number;
  num: number;
  title: string;
  short: string;
  blurb: string;
  /** calculus introduced in this chapter (for the course map) */
  calculus?: string;
  load: () => Promise<{ default: Component<{ components?: Record<string, unknown> }> }>;
}

export const parts = [
  { num: 0, title: 'Prologue' },
  { num: 1, title: 'Computation' },
  { num: 2, title: 'Types' },
  { num: 3, title: 'The Calculus of Constructions' },
  { num: 4, title: 'Inductive Constructions' },
  { num: 5, title: 'The Whole System' },
];

export const chapters: ChapterInfo[] = [
  { slug: 'intro', part: 0, num: 0, title: 'Why a Calculus?', short: 'Prologue', blurb: 'Proof assistants, trusted kernels, and the road from λ to CIC.', load: () => import('./chapters/00-intro.mdx') },
  { slug: 'lambda', part: 1, num: 1, title: 'The λ-Calculus', short: 'λ-calculus', calculus: 'λ', blurb: 'Functions as the only data: syntax, β-reduction, Church encodings, confluence and divergence.', load: () => import('./chapters/01-lambda.mdx') },
  { slug: 'binders', part: 1, num: 2, title: 'Names, Binders and Substitution', short: 'Binders', blurb: 'Why substitution is subtle, and how kernels represent bound variables: de Bruijn indices and the locally nameless style.', load: () => import('./chapters/02-binders.mdx') },
  { slug: 'stlc', part: 2, num: 3, title: 'Simple Types', short: 'Simple types', calculus: 'λ→', blurb: 'Typing judgements, inference rules and derivations — and the price of termination.', load: () => import('./chapters/03-stlc.mdx') },
  { slug: 'curry-howard', part: 2, num: 4, title: 'Propositions as Types', short: 'Curry–Howard', blurb: 'Proofs are programs, propositions are types: natural deduction meets the λ-calculus.', load: () => import('./chapters/04-curry-howard.mdx') },
  { slug: 'system-f', part: 2, num: 5, title: 'Polymorphism: System F', short: 'System F', calculus: 'λ2', blurb: 'Terms that depend on types, impredicativity, parametricity and typed Church encodings.', load: () => import('./chapters/05-system-f.mdx') },
  { slug: 'fomega', part: 2, num: 6, title: 'Type Operators: Fω', short: 'Fω', calculus: 'λω', blurb: 'Functions from types to types, kinds, and computation inside types.', load: () => import('./chapters/06-fomega.mdx') },
  { slug: 'dependent', part: 2, num: 7, title: 'Dependent Types', short: 'Dependent types', calculus: 'λP', blurb: 'Types that depend on terms: Π-types, predicates, and the logical framework LF.', load: () => import('./chapters/07-dependent.mdx') },
  { slug: 'cube', part: 2, num: 8, title: 'The λ-Cube', short: 'λ-cube', blurb: 'Eight calculi, one pattern: Barendregt’s cube and Pure Type Systems.', load: () => import('./chapters/08-cube.mdx') },
  { slug: 'coc', part: 3, num: 9, title: 'The Calculus of Constructions', short: 'CoC', calculus: 'λC', blurb: 'All four dependencies at once: impredicative logic, encodings — and their limits.', load: () => import('./chapters/09-coc.mdx') },
  { slug: 'universes', part: 3, num: 10, title: 'Universes', short: 'Universes', calculus: 'ECC', blurb: 'Why Type : Type is inconsistent, and the hierarchy of universes that replaces it.', load: () => import('./chapters/10-universes.mdx') },
  { slug: 'inductive', part: 4, num: 11, title: 'Inductive Types', short: 'Inductive types', calculus: 'CIC', blurb: 'Constructors, recursors and ι-reduction: data as a primitive.', load: () => import('./chapters/11-inductive.mdx') },
  { slug: 'positivity', part: 4, num: 12, title: 'Strict Positivity', short: 'Positivity', blurb: 'Which inductive definitions are allowed, and how the wrong ones break everything.', load: () => import('./chapters/12-positivity.mdx') },
  { slug: 'families', part: 4, num: 13, title: 'Inductive Families and Equality', short: 'Families & equality', blurb: 'Parameters versus indices, vectors, and equality as an inductive family.', load: () => import('./chapters/13-families.mdx') },
  { slug: 'prop', part: 4, num: 14, title: 'Propositions as Inductive Types', short: 'Prop', blurb: 'Logic from inductive types, the special sort Prop, and why proofs may not be eliminated into data.', load: () => import('./chapters/14-prop.mdx') },
  { slug: 'recursion', part: 4, num: 15, title: 'Pattern Matching and Recursion', short: 'Recursion', blurb: 'How definitions by pattern matching compile down to recursors, and why recursion must be structural.', load: () => import('./chapters/15-recursion.mdx') },
  { slug: 'beyond-structural', part: 4, num: 16, title: 'Mutual, Nested and Well-Founded', short: 'Well-founded', blurb: 'Mutual and nested inductive types, accessibility, and recursion beyond immediate subterms.', load: () => import('./chapters/16-beyond-structural.mdx') },
  { slug: 'cic', part: 5, num: 17, title: 'CIC on One Page', short: 'CIC', blurb: 'All the rules together, definitional equality, and a walk through a real kernel.', load: () => import('./chapters/17-cic.mdx') },
  { slug: 'metatheory', part: 5, num: 18, title: 'Metatheory', short: 'Metatheory', blurb: 'Subject reduction, normalisation, consistency, decidability — and what breaks each of them.', load: () => import('./chapters/18-metatheory.mdx') },
  { slug: 'lean', part: 5, num: 19, title: 'Lean 4’s Type Theory', short: 'Lean 4', blurb: 'Definitional proof irrelevance, quotients, η, axioms, and how Lean differs from Rocq.', load: () => import('./chapters/19-lean.mdx') },
  { slug: 'beyond', part: 5, num: 20, title: 'Beyond CIC', short: 'Beyond', blurb: 'Univalence, cubical type theory, observational equality and other roads ahead.', load: () => import('./chapters/20-beyond.mdx') },
];

export function chapterBySlug(slug: string): ChapterInfo | undefined {
  return chapters.find((c) => c.slug === slug);
}

export function neighbours(slug: string): { prev?: ChapterInfo; next?: ChapterInfo } {
  const i = chapters.findIndex((c) => c.slug === slug);
  return { prev: chapters[i - 1], next: chapters[i + 1] };
}
