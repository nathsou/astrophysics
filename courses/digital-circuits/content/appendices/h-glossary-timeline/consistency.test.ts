/**
 * Checks across the shared YAML files and every Markdown page of the course:
 *
 * - every glossary entry belongs to a real chapter (or appendix);
 * - every timeline entry links to a real chapter;
 * - every `:cite[key]` in any page names an entry of the bibliography, and every `:term[…]` a glossary entry;
 * - no glossary term, timeline event or bibliography title is entered twice;
 * - the map from sources to the chapters that cite them (`widgets/citations.json`, for the bibliography of this appendix)
 *   is up to date. When it is not, `UPDATE_CITATIONS=1 npx vitest run content/appendices/h-glossary-timeline` rewrites it.
 *
 * Unused entries (a bibliography entry no page cites, a glossary term no page links) are legal, since the glossary and
 * the bibliography are also read as lists; `unused()` reports them and a test checks that it does.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import YAML from 'yaml';
import { APPENDICES, PARTS } from '$content/outline';

const root = path.resolve(import.meta.dirname, '../..');
const yaml = (name: string) => YAML.parse(readFileSync(path.join(root, `${name}.yaml`), 'utf8'), { uniqueKeys: true });
const bib = yaml('bibliography') as Record<string, { title: string; authors: string; year: unknown }>;
const glossary = yaml('glossary') as Record<string, { term: string; definition: string; chapter?: string }>;
const timeline = yaml('timeline') as { year: number; title: string; chapter?: string }[];

const chapterSlugs = new Set(PARTS.flatMap((p) => p.chapters.map((c) => c.slug)));
const appendixSlugs = new Set(APPENDICES.map((a) => a.slug));

/** Every page: `chapters/<nn>-<slug>/index.md` and `appendices/<x>-<slug>/index.md`, as [place, text]. */
function pages(): { place: string; file: string; text: string }[] {
  const out: { place: string; file: string; text: string }[] = [];
  for (const kind of ['chapters', 'appendices'] as const) {
    const dir = path.join(root, kind);
    if (!existsSync(dir)) continue;
    for (const d of readdirSync(dir).sort()) {
      const file = path.join(dir, d, 'index.md');
      if (!existsSync(file)) continue;
      const slug = d.replace(/^[0-9a-z]{1,2}-/, '');
      if (kind === 'chapters' && !chapterSlugs.has(slug)) continue; // the test chapter
      out.push({ place: kind === 'chapters' ? slug : `appendix:${slug}`, file: path.relative(root, file), text: readFileSync(file, 'utf8') });
    }
  }
  return out;
}

export function citedKeys(text: string): string[] {
  const keys: string[] = [];
  for (const m of text.matchAll(/:cite\[([^\]]*)\]/g)) keys.push(...m[1]!.split(',').map((k) => k.trim()).filter(Boolean));
  return keys;
}

export function termIds(text: string): string[] {
  const ids: string[] = [];
  for (const m of text.matchAll(/:term\[([^\]]*)\](?:\{([^}]*)\})?/g)) {
    const id = /(?:^|\s)id=([\w-]+)/.exec(m[2] ?? '')?.[1];
    ids.push(id ?? m[1]!.toLowerCase());
  }
  return ids;
}

/** Entries that no page uses. */
export function unused(all: { place: string; file: string; text: string }[] = pages()) {
  const cited = new Set(all.flatMap((p) => citedKeys(p.text)));
  const linked = new Set(all.flatMap((p) => termIds(p.text)));
  return { bibliography: Object.keys(bib).filter((k) => !cited.has(k)), glossary: Object.keys(glossary).filter((k) => !linked.has(k)) };
}

const all = pages();

describe('the shared YAML files', () => {
  test('every glossary entry names a real chapter or appendix', () => {
    for (const [id, e] of Object.entries(glossary)) {
      expect(e.chapter, `${id} has no chapter`).toBeTruthy();
      expect(chapterSlugs.has(e.chapter!) || appendixSlugs.has(e.chapter!), `${id}: “${e.chapter}” is not a chapter or appendix slug of content/outline.ts`).toBe(true);
    }
  });
  test('every timeline entry links to a real chapter', () => {
    for (const e of timeline) expect(chapterSlugs.has(e.chapter ?? '') || appendixSlugs.has(e.chapter ?? ''), `${e.year} ${e.title}: “${e.chapter}”`).toBe(true);
  });
  test('nothing is entered twice: glossary terms, timeline events, bibliography titles', () => {
    const dup = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
    expect(dup(Object.values(glossary).map((e) => e.term.toLowerCase()))).toEqual([]);
    expect(dup(timeline.map((e) => `${e.year} ${e.title}`.toLowerCase()))).toEqual([]);
    expect(dup(Object.values(bib).map((e) => e.title.toLowerCase()))).toEqual([]);
  });
});

describe('the pages', () => {
  test('there are pages to check', () => {
    expect(all.length).toBeGreaterThan(30);
  });
  test('every :cite[key] names an entry of the bibliography', () => {
    const bad: string[] = [];
    for (const p of all) for (const k of citedKeys(p.text)) if (!(k in bib)) bad.push(`${p.file}: :cite[${k}]`);
    expect(bad).toEqual([]);
  });
  test('every :term names an entry of the glossary', () => {
    const bad: string[] = [];
    for (const p of all) for (const id of termIds(p.text)) if (!(id in glossary)) bad.push(`${p.file}: :term id ${id}`);
    expect(bad).toEqual([]);
  });
  test('unused() finds entries that no page cites or links', () => {
    const fake = [{ place: 'relays', file: 'x', text: 'A :cite[shannon1938] and :term[series]{id=series} and :term[relay].' }];
    const u = unused(fake);
    expect(u.bibliography).not.toContain('shannon1938');
    expect(u.bibliography).toContain('peirce1886');
    expect(u.glossary).not.toContain('series');
    expect(u.glossary).not.toContain('relay');
    expect(u.glossary).toContain('parallel');
  });
});

describe('the citation map of the bibliography', () => {
  const file = path.join(import.meta.dirname, 'widgets/citations.json');
  const order = [...PARTS.flatMap((p) => p.chapters.map((c) => c.slug)), ...APPENDICES.map((a) => `appendix:${a.slug}`)];
  const fresh = (): Record<string, string[]> => {
    const map = new Map<string, Set<string>>();
    for (const p of all) for (const k of citedKeys(p.text)) (map.get(k) ?? map.set(k, new Set()).get(k)!).add(p.place);
    return Object.fromEntries(
      [...map.entries()]
        .filter(([k]) => k in bib)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, s]) => [k, [...s].sort((a, b) => order.indexOf(a) - order.indexOf(b))]),
    );
  };
  test('it matches the pages (UPDATE_CITATIONS=1 rewrites it)', () => {
    const now = fresh();
    if (process.env.UPDATE_CITATIONS) writeFileSync(file, JSON.stringify(now, null, 1) + '\n');
    const saved = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>;
    const changed = Object.keys({ ...now, ...saved }).filter((k) => JSON.stringify(now[k]) !== JSON.stringify(saved[k]));
    expect(changed, 'citations.json is out of date: run  UPDATE_CITATIONS=1 npx vitest run content/appendices/h-glossary-timeline').toEqual([]);
  });
});
