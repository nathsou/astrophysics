/**
 * The bibliography of the whole course, grouped by the part of the course that first cites each source, with the
 * chapters that cite it. The data is `content/bibliography.yaml`; the map from sources to the chapters citing them
 * is `citations.json`, made by `citations.test.ts` (`UPDATE_CITATIONS=1 npx vitest run content/appendices/h-glossary-timeline`).
 */
import YAML from 'yaml';
import raw from '$content/bibliography.yaml?raw';
import citations from './citations.json';
import { APPENDICES, PARTS } from '$content/outline';

export interface Ref {
  key: string;
  authors: string;
  year: number | string;
  title: string;
  venue?: string;
  url?: string;
  note?: string;
}

export function parseBibliography(text: string): Ref[] {
  const data = (YAML.parse(text) ?? {}) as Record<string, Omit<Ref, 'key'>>;
  return Object.entries(data).map(([key, r]) => ({ key, ...r }));
}

/** A citing place: a chapter slug, or `appendix:<slug>`. */
export type Place = string;

export interface Where {
  place: Place;
  /** "Ch 6" or "App. A". */
  label: string;
  kind: 'chapter' | 'appendix';
  slug: string;
}

const chapterOrder = PARTS.flatMap((p) => p.chapters.map((c) => ({ slug: c.slug, number: c.number, part: p.id })));

/** The order in which places are listed: chapters in course order, then appendices. */
export function whereOf(place: Place): Where | undefined {
  if (place.startsWith('appendix:')) {
    const slug = place.slice('appendix:'.length);
    const a = APPENDICES.find((x) => x.slug === slug);
    return a ? { place, label: `App. ${a.number}`, kind: 'appendix', slug } : undefined;
  }
  const c = chapterOrder.find((x) => x.slug === place);
  return c ? { place, label: `Ch ${c.number}`, kind: 'chapter', slug: place } : undefined;
}

const rank = (place: Place) => {
  if (place.startsWith('appendix:')) return 1000 + APPENDICES.findIndex((a) => a.slug === place.slice(9));
  return chapterOrder.findIndex((c) => c.slug === place);
};

export const sortPlaces = (places: Place[]) => [...places].filter((p) => rank(p) >= 0).sort((a, b) => rank(a) - rank(b));

export interface Entry extends Ref {
  cited: Where[];
}

export interface Group {
  id: string;
  title: string;
  /** A short label for the jump links. */
  short: string;
  entries: Entry[];
}

const authorKey = (r: Ref) => r.authors.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Groups by the part of the first chapter that cites a source; appendices-only and uncited sources have their own groups. */
export function groupRefs(refs: Ref[], map: Record<string, Place[]>): Group[] {
  const groups = new Map<string, Group>();
  const order: { id: string; title: string; short: string }[] = [
    ...PARTS.map((p) => ({
      id: `part-${p.id}`,
      title: p.id === '0' || p.id === 'E' ? p.title : `Part ${p.id}: ${p.title}`,
      short: p.id === '0' || p.id === 'E' ? p.title : `Part ${p.id}`,
    })),
    { id: 'appendices', title: 'Cited only in the appendices', short: 'Appendices' },
    { id: 'uncited', title: 'Other sources', short: 'Other' },
  ];
  for (const o of order) groups.set(o.id, { ...o, entries: [] });
  for (const r of refs) {
    const places = sortPlaces(map[r.key] ?? []);
    const cited = places.map(whereOf).filter((w): w is Where => !!w);
    const first = places.find((p) => !p.startsWith('appendix:'));
    const part = first ? chapterOrder.find((c) => c.slug === first)!.part : undefined;
    const id = part ? `part-${part}` : cited.length ? 'appendices' : 'uncited';
    groups.get(id)!.entries.push({ ...r, cited });
  }
  for (const g of groups.values()) g.entries.sort((a, b) => authorKey(a).localeCompare(authorKey(b)) || String(a.year).localeCompare(String(b.year)) || a.title.localeCompare(b.title));
  return [...groups.values()].filter((g) => g.entries.length);
}

export const REFS: Ref[] = parseBibliography(raw);
export const CITATIONS = citations as Record<string, Place[]>;
