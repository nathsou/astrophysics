// Which sections of the book have interactive treatment, and what each mode contains.
//
// Every converted section can be read in Formal mode (the book's text). Sections listed here
// also have an Intuition mode (explanations written for this edition) and an Explore mode (a
// workbench), and may attach computed material to specific blocks of the formal text.

import type { ComponentType } from 'react';
import type { Annotations } from '../formal/FormalText';
import { sourceIndex } from './source';

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
const metas = import.meta.glob<{ blurb: string; object?: SectionPlan['object'] }>('./sections/*/meta.ts', { eager: true });

// Each section directory holds its own meta.ts (blurb, object) next to its content, so that
// sections can be added without touching a shared list. Plans follow the book's order.
const order = new Map(sourceIndex.chapters.flatMap((c) => c.sections.map((s) => s.id)).map((id, i) => [id, i]));

function plan(id: string): SectionPlan {
  const m = metas[`./sections/${id}/meta.ts`];
  const p: SectionPlan = { id, blurb: m.blurb, object: m.object };
  const i = mdx[`./sections/${id}/intuition.mdx`];
  const e = mdx[`./sections/${id}/explore.mdx`];
  const f = tsx[`./sections/${id}/formal.tsx`];
  if (i) p.intuition = i;
  if (e) p.explore = e;
  if (f) p.annotations = f;
  return p;
}

export const PLANS: SectionPlan[] = Object.keys(metas)
  .map((k) => k.split('/')[2])
  .filter((id) => {
    if (!order.has(id)) console.warn(`section ${id} has content but is not in the book`);
    return order.has(id);
  })
  .sort((a, b) => order.get(a)! - order.get(b)!)
  .map(plan);

export const planOf = (id: string) => PLANS.find((p) => p.id === id);
export const isInteractive = (id: string) => {
  const p = planOf(id);
  return !!(p && (p.intuition || p.explore));
};
