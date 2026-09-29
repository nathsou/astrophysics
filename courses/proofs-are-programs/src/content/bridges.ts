// Links between this course and the Calculus of Inductive Constructions course.
// Both are built into sibling directories of the same site (…/proofs-are-programs/ and …/cic/),
// and both use hash routing, so relative links work wherever the site is hosted.

export const CIC_TITLES: Record<string, string> = {
  intro: 'Why a Calculus?',
  lambda: 'The λ-Calculus',
  binders: 'Names, Binders and Substitution',
  stlc: 'Simple Types',
  'curry-howard': 'Propositions as Types',
  'system-f': 'Polymorphism: System F',
  fomega: 'Type Operators: Fω',
  dependent: 'Dependent Types',
  cube: 'The λ-Cube',
  coc: 'The Calculus of Constructions',
  universes: 'Universes',
  inductive: 'Inductive Types',
  positivity: 'Strict Positivity',
  families: 'Inductive Families and Equality',
  prop: 'Propositions as Inductive Types',
  recursion: 'Pattern Matching and Recursion',
  'beyond-structural': 'Mutual, Nested and Well-Founded',
  cic: 'CIC on One Page',
  metatheory: 'Metatheory',
  lean: 'Lean 4’s Type Theory',
  beyond: 'Beyond CIC',
};

export const CIC_NUMBERS: Record<string, number> = Object.fromEntries(Object.keys(CIC_TITLES).map((k, i) => [k, i]));

export function cicHref(slug: string, section?: string): string {
  return `../cic/#/ch/${slug}${section ? `?s=${encodeURIComponent(section)}` : ''}`;
}

/** open a snippet in the CIC course's playground (the two courses share the language) */
export function cicPlaygroundHref(code: string): string {
  return `../cic/#/playground?code=${btoa(unescape(encodeURIComponent(code)))}`;
}
