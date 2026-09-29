import type { Component } from 'solid-js';

export interface CicLink {
  /** chapter slug in the CIC course */
  slug: string;
  /** optional section id */
  s?: string;
  /** what the CIC chapter explains */
  what: string;
}

export interface ChapterInfo {
  slug: string;
  part: number;
  num: number;
  title: string;
  short: string;
  blurb: string;
  /** the chapters of the CIC course that explain the theory behind this one */
  cic?: CicLink[];
  load: () => Promise<{ default: Component<{ components?: Record<string, unknown> }> }>;
}

export const parts = [
  { num: 0, title: 'Prologue', short: 'Prologue' },
  { num: 1, title: 'Types as Promises', short: 'I' },
  { num: 2, title: 'Logic Is a Library', short: 'II' },
  { num: 3, title: 'Tactics Are Programs That Write Programs', short: 'III' },
  { num: 4, title: 'Recursion Is Induction', short: 'IV' },
  { num: 5, title: 'Verified Programs', short: 'V' },
  { num: 6, title: 'Build Your Own Kernel', short: 'VI' },
  { num: 7, title: 'Epilogue', short: 'Epilogue' },
];

export const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export const chapters: ChapterInfo[] = [
  {
    slug: 'prologue',
    part: 0,
    num: 0,
    title: 'A Function You Cannot Write',
    short: 'Prologue',
    blurb: 'Some types have no programs at all, and some have exactly one. A type is a promise — and that is the whole course.',
    cic: [{ slug: 'system-f', s: 'parametricity-theorems-for-free', what: 'parametricity: why α → α has one inhabitant' }],
    load: () => import('./chapters/00-prologue.mdx'),
  },
  {
    slug: 'programs',
    part: 1,
    num: 1,
    title: 'Programs in the Course Language',
    short: 'Programs',
    blurb: 'Definitions, inductive types, pattern matching and recursion — a tour of the language for programmers.',
    cic: [{ slug: 'inductive', what: 'how inductive types are added to the kernel' }],
    load: () => import('./chapters/01-programs.mdx'),
  },
  {
    slug: 'promises',
    part: 1,
    num: 2,
    title: 'What a Type Can Promise',
    short: 'Promises',
    blurb: 'Counting the programs of a type, and how polymorphism constrains what a function can do.',
    cic: [
      { slug: 'stlc', what: 'the simply typed λ-calculus and its typing rules' },
      { slug: 'system-f', what: 'polymorphism and parametricity' },
    ],
    load: () => import('./chapters/02-promises.mdx'),
  },
  {
    slug: 'evidence',
    part: 1,
    num: 3,
    title: 'Evidence: the Sort Prop',
    short: 'Evidence',
    blurb: 'Propositions are types whose values are evidence. Build conjunction, disjunction and falsity yourself.',
    cic: [
      { slug: 'curry-howard', what: 'natural deduction and the Curry–Howard dictionary' },
      { slug: 'prop', what: 'logic as inductive types, and the special sort Prop' },
    ],
    load: () => import('./chapters/03-evidence.mdx'),
  },
  {
    slug: 'proof-terms',
    part: 2,
    num: 4,
    title: 'Proofs as Terms',
    short: 'Proof terms',
    blurb: 'Writing proofs as programs: anonymous constructors, pattern matching, holes, and reading goals.',
    cic: [{ slug: 'curry-howard', s: 'proof-simplification-is-computation', what: 'proof simplification is computation' }],
    load: () => import('./chapters/04-proof-terms.mdx'),
  },
  {
    slug: 'quantifiers',
    part: 2,
    num: 5,
    title: 'Quantifiers',
    short: 'Quantifiers',
    blurb: '∀ is a dependent function, ∃ is a pair — and a pair whose first component you cannot take out.',
    cic: [
      { slug: 'dependent', what: 'Π-types and first-order logic' },
      { slug: 'prop', s: 'why-proofs-must-not-compute-data', what: 'why proofs cannot be eliminated into data' },
    ],
    load: () => import('./chapters/05-quantifiers.mdx'),
  },
  {
    slug: 'equality',
    part: 2,
    num: 6,
    title: 'Equality',
    short: 'Equality',
    blurb: 'Equality as an inductive type, rfl by computation, and rewriting as transport.',
    cic: [{ slug: 'families', s: 'equality-as-an-inductive-family', what: 'equality as an inductive family' }],
    load: () => import('./chapters/06-equality.mdx'),
  },
  {
    slug: 'limits',
    part: 2,
    num: 7,
    title: 'What You Cannot Prove',
    short: 'Limits',
    blurb: 'Excluded middle, countermodels, classical axioms, and which axioms a proof depends on.',
    cic: [
      { slug: 'prop', s: 'classical-logic-safely', what: 'classical logic, safely' },
      { slug: 'lean', s: 'the-three-axioms', what: 'Lean’s three axioms' },
    ],
    load: () => import('./chapters/07-limits.mdx'),
  },
  {
    slug: 'tactics',
    part: 3,
    num: 8,
    title: 'From Terms to Tactics',
    short: 'Tactics',
    blurb: 'A tactic is a small program that fills a hole in a proof term. Watch the term being written.',
    cic: [
      { slug: 'intro', s: 'the-de-bruijn-criterion', what: 'the de Bruijn criterion: why tactics need not be trusted' },
      { slug: 'cic', s: 'watching-the-kernel', what: 'how the kernel checks the term tactics produce' },
    ],
    load: () => import('./chapters/08-tactics.mdx'),
  },
  {
    slug: 'toolbox',
    part: 3,
    num: 9,
    title: 'The Tactic Toolbox',
    short: 'Toolbox',
    blurb: 'intro, apply, exact, constructor, cases, rcases, rw, have, calc — and how to structure a proof.',
    load: () => import('./chapters/09-toolbox.mdx'),
  },
  {
    slug: 'automation',
    part: 3,
    num: 10,
    title: 'Automation That Leaves a Proof Behind',
    short: 'Automation',
    blurb: 'simp, decide and omega: what they do, the proofs they produce, and how to read their failures.',
    cic: [{ slug: 'cic', s: 'definitional-equality', what: 'definitional equality, which decide relies on' }],
    load: () => import('./chapters/10-automation.mdx'),
  },
  {
    slug: 'induction',
    part: 4,
    num: 11,
    title: 'Induction',
    short: 'Induction',
    blurb: 'The recursor is both a recursive function and the induction principle. An induction proof is a recursive program.',
    cic: [
      { slug: 'inductive', s: 'recursion-and-induction-are-the-same-thing', what: 'recursors: recursion and induction are the same thing' },
      { slug: 'recursion', what: 'how pattern matching compiles to recursors' },
    ],
    load: () => import('./chapters/11-induction.mdx'),
  },
  {
    slug: 'termination',
    part: 4,
    num: 12,
    title: 'Termination and Consistency',
    short: 'Termination',
    blurb: 'Why a proof that loops would prove anything, structural recursion, fuel, and well-founded recursion.',
    cic: [
      { slug: 'recursion', s: 'why-recursion-must-be-restricted', what: 'why recursion must be restricted' },
      { slug: 'beyond-structural', s: 'well-founded-recursion', what: 'well-founded recursion from Acc' },
      { slug: 'metatheory', what: 'consistency and normalisation' },
    ],
    load: () => import('./chapters/12-termination.mdx'),
  },
  {
    slug: 'predicates',
    part: 4,
    num: 13,
    title: 'Inductive Predicates and Decidability',
    short: 'Predicates',
    blurb: 'Evenness, sortedness and reachability as inductive types; case analysis on evidence; Decidable and if.',
    cic: [{ slug: 'families', s: 'inductive-predicates', what: 'inductive predicates and index unification' }],
    load: () => import('./chapters/13-predicates.mdx'),
  },
  {
    slug: 'accumulators',
    part: 5,
    num: 14,
    title: 'Fast = Correct',
    short: 'Fast = correct',
    blurb: 'Prove that fast, tail-recursive programs compute what their slow specifications do — and learn to generalise.',
    load: () => import('./chapters/14-accumulators.mdx'),
  },
  {
    slug: 'sorting',
    part: 5,
    num: 15,
    title: 'Sorting',
    short: 'Sorting',
    blurb: 'Insertion sort returns a sorted permutation of its input: specifications as inductive predicates.',
    load: () => import('./chapters/15-sorting.mdx'),
  },
  {
    slug: 'interpreter',
    part: 5,
    num: 16,
    title: 'An Interpreter and an Optimiser',
    short: 'Interpreter',
    blurb: 'Arithmetic expressions, an evaluator, and a constant-folding optimiser proved to preserve meaning.',
    load: () => import('./chapters/16-interpreter.mdx'),
  },
  {
    slug: 'compiler',
    part: 5,
    num: 17,
    title: 'A Compiler to a Stack Machine',
    short: 'Compiler',
    blurb: 'Compile expressions to a stack machine and prove the compiler correct. Then break it, and watch the proof break.',
    load: () => import('./chapters/17-compiler.mdx'),
  },
  {
    slug: 'typed-language',
    part: 5,
    num: 18,
    title: 'A Typed Language',
    short: 'Typed language',
    blurb: 'Typing rules, small-step semantics and type safety — then intrinsic typing, where ill-typed terms cannot be written.',
    cic: [
      { slug: 'families', s: 'programming-with-vectors', what: 'inductive families, as used for intrinsic typing' },
      { slug: 'prop', s: 'data-with-proofs-σ-and-subtypes', what: 'Σ-types and subtypes' },
    ],
    load: () => import('./chapters/18-typed-language.mdx'),
  },
  {
    slug: 'reflection',
    part: 5,
    num: 19,
    title: 'Reflection',
    short: 'Reflection',
    blurb: 'A verified tautology checker becomes a tactic: proving by computing, and how omega works.',
    cic: [{ slug: 'cic', s: 'definitional-equality', what: 'definitional equality: why computation counts as proof' }],
    load: () => import('./chapters/19-reflection.mdx'),
  },
  {
    slug: 'stlc-checker',
    part: 6,
    num: 20,
    title: 'A Verified Type Checker',
    short: 'Type checker',
    blurb: 'A type checker for simple types, proved sound and complete: typability becomes decidable.',
    cic: [{ slug: 'stlc', what: 'the simply typed λ-calculus' }],
    load: () => import('./chapters/20-stlc-checker.mdx'),
  },
  {
    slug: 'kernel',
    part: 6,
    num: 21,
    title: 'A Dependent Type Checker',
    short: 'Your kernel',
    blurb: 'Substitution, normalisation, bidirectional checking and universes: a small kernel for dependent types, in the course language.',
    cic: [
      { slug: 'binders', what: 'de Bruijn indices and binders' },
      { slug: 'universes', what: 'why Type : Type is inconsistent' },
      { slug: 'cic', what: 'the rules of the real kernel' },
      { slug: 'metatheory', s: 'breaking-it', what: 'what breaks when a rule is removed' },
    ],
    load: () => import('./chapters/21-kernel.mdx'),
  },
  {
    slug: 'epilogue',
    part: 7,
    num: 22,
    title: 'Where to Go Next',
    short: 'Epilogue',
    blurb: 'Lean 4 and Mathlib, the Calculus of Inductive Constructions course, and further reading.',
    load: () => import('./chapters/22-epilogue.mdx'),
  },
];

export function chapterBySlug(slug: string): ChapterInfo | undefined {
  return chapters.find((c) => c.slug === slug);
}

export function neighbours(slug: string): { prev?: ChapterInfo; next?: ChapterInfo } {
  const i = chapters.findIndex((c) => c.slug === slug);
  return { prev: chapters[i - 1], next: chapters[i + 1] };
}

/** the label of a chapter, as used in cross references ("Chapter 8", "the Prologue") */
export function chapterLabel(c: ChapterInfo): string {
  if (c.part === 0) return 'Prologue';
  if (c.part === 7) return 'Epilogue';
  return `Chapter ${c.num}`;
}
