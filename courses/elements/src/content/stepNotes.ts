// The one-line note shown under the step track while the reader steps through a proof.
// Hand-written for the propositions listed here (indexed by paragraph), otherwise the first
// clause of the paragraph itself.

import type { Inline, Item, Para } from '../text/types';

const HAND: Record<string, string[]> = {
  '1.1': [
    '',
    'The given: a finite straight line AB.',
    'The goal.',
    'Two circles, one about each end. C is where they cross: join CA and CB.',
    'Radii of the first circle: AC = AB.',
    'Radii of the second circle: BC = BA.',
    'Both equal AB.',
    'Common notion 1: CA = CB.',
    'All three sides are equal.',
    'ABC is equilateral.',
    'Q.E.F.',
  ],
};

export function plainText(c: Inline[]): string {
  return c
    .map((x) => {
      if (typeof x === 'string') return x;
      switch (x.t) {
        case 'label':
          return x.v;
        case 'ref':
          return '';
        default:
          return plainText(x.c);
      }
    })
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/\s+([;:,.])/g, '$1')
    .trim();
}

const MAX = 64;

function clause(p: Para, problem?: boolean): string {
  if (p.role === 'qed') return problem ? 'Q.E.F.' : 'Q.E.D.';
  const t = plainText(p.c);
  const m = /^(.*?)([;:.]|,\s(?=\w+\s\w+\s\w+))/.exec(t);
  let s = m && m[1].length >= 12 ? m[1] : t;
  if (s.length > MAX) s = s.slice(0, s.lastIndexOf(' ', MAX)).replace(/[,;:]$/, '') + '…';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function stepNote(item: Item, i: number): string {
  return HAND[item.id]?.[i] || clause(item.paras[i], item.problem);
}
