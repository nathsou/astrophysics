// Which sections of the book have interactive treatment, and what each mode contains.
//
// Every converted section can be read in Formal mode (the book's text). Sections listed here
// also have an Intuition mode (explanations written for this edition) and an Explore mode (a
// workbench), and may attach computed material to specific blocks of the formal text.

import type { ComponentType } from 'react';
import type { Annotations } from '../formal/FormalText';

export type Mode = 'intuition' | 'explore' | 'formal';

export interface SectionPlan {
  id: string;
  /** One line for the table of contents and the home page. */
  blurb: string;
  /** The object the section works with, shown in the object bar. */
  object?: 'formula' | 'term' | 'subst' | 'function' | 'B' | 'sequence';
  intuition?: () => Promise<{ default: ComponentType }>;
  explore?: () => Promise<{ default: ComponentType }>;
  /** Computed material attached to blocks of the formal text (a hook, since it follows the object). */
  annotations?: () => Promise<{ useAnnotations: () => Annotations }>;
}

const mdx = import.meta.glob<{ default: ComponentType }>('./sections/*/*.mdx');
const tsx = import.meta.glob<{ useAnnotations: () => Annotations }>('./sections/*/formal.tsx');

function plan(id: string, blurb: string, object?: SectionPlan['object']): SectionPlan {
  const p: SectionPlan = { id, blurb, object };
  const i = mdx[`./sections/${id}/intuition.mdx`];
  const e = mdx[`./sections/${id}/explore.mdx`];
  const f = tsx[`./sections/${id}/formal.tsx`];
  if (i) p.intuition = i;
  if (e) p.explore = e;
  if (f) p.annotations = f;
  return p;
}

export const PLANS: SectionPlan[] = [
  plan('cmp.rec.seq', 'Numbers that code finite sequences: the tool behind every Gödel number.', 'sequence'),
  plan('inc.art.int', 'Why logic needs to talk about its own syntax, in numbers.', 'formula'),
  plan('inc.art.cod', 'A code for every symbol: the table, and how to read it back.', 'formula'),
  plan('inc.art.trm', 'Gödel numbers of terms, numerals and the function num.', 'term'),
  plan('inc.art.frm', 'The formula / symbols / codes / number workbench.', 'formula'),
  plan('inc.art.sub', 'Substitution, capture, and substitution done on Gödel numbers.', 'subst'),
  plan('inc.req.int', 'Robinson’s Q, and what it means for a formula to represent a function.', 'function'),
  plan('inc.req.bre', 'The basic functions, and Q’s derivations about numerals, checked.', 'function'),
  plan('inc.req.cmp', 'Representing a composition: witnesses from the computation.', 'function'),
  plan('inc.req.min', 'Representing regular minimization.', 'function'),
  plan('inc.inp.fix', 'Diagonalisation: a sentence that talks about its own Gödel number.', 'B'),
  plan('inc.inp.1in', 'Gödel’s theorem, and exactly where each hypothesis is used.', 'B'),
];

export const planOf = (id: string) => PLANS.find((p) => p.id === id);
export const isInteractive = (id: string) => {
  const p = planOf(id);
  return !!(p && (p.intuition || p.explore));
};
