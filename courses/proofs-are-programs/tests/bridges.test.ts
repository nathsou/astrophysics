// The CIC course lists, for each of its chapters, the chapters of this course that link to it
// (courses/cic/src/content/pap.ts). Check that the list matches this course's registry.
import { describe, expect, it } from 'vitest';
import { chapters } from '../src/content/chapters.ts';
import { CIC_TITLES } from '../src/content/bridges.ts';
import { PAP } from '../../cic/src/content/pap.ts';

describe('bridges between the two courses', () => {
  it('every CIC link points to an existing CIC chapter', () => {
    for (const c of chapters) for (const l of c.cic ?? []) expect(CIC_TITLES[l.slug], `${c.slug} → ${l.slug}`).toBeDefined();
  });
  it('the CIC course lists exactly the chapters that link to it', () => {
    const expected: Record<string, { slug: string; num: number; title: string; what: string }[]> = {};
    for (const c of chapters) for (const l of c.cic ?? []) (expected[l.slug] ??= []).push({ slug: c.slug, num: c.num, title: c.title, what: l.what });
    expect(PAP).toEqual(expected);
  });
});
