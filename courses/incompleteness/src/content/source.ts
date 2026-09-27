// Access to the converted upstream text and to the vendored LaTeX.

import type { Chapter, SourceIndex, SourceLoc } from './schema';
import index from './source/index.json';
import upstream from '../../upstream/UPSTREAM.json';

export const sourceIndex = index as unknown as SourceIndex;
export const upstreamInfo = upstream;

const chapterFiles = import.meta.glob<Chapter>('./source/*.json', { import: 'default' });
const chapterCache = new Map<string, Promise<Chapter>>();

export function loadChapter(id: string): Promise<Chapter> {
  let p = chapterCache.get(id);
  if (!p) {
    const loader = chapterFiles[`./source/${id}.json`];
    if (!loader) return Promise.reject(new Error(`no chapter ${id}`));
    p = loader();
    chapterCache.set(id, p);
  }
  return p;
}

export function chapterOf(sectionId: string) {
  return sourceIndex.chapters.find((c) => c.sections.some((s) => s.id === sectionId));
}

export function sourceUrl(loc: SourceLoc): string {
  const repo = upstream.repositories[loc.repo];
  return `${repo.url}/blob/${repo.commit}/${loc.file}#L${loc.line}-L${loc.endLine}`;
}

const rawFiles = import.meta.glob<string>('../../upstream/**/*.tex', { query: '?raw', import: 'default' });

export async function loadUpstreamLines(loc: SourceLoc): Promise<string> {
  const loader = rawFiles[`../../upstream/${loc.repo}/${loc.file}`];
  if (!loader) return '(source file not available)';
  const text = await loader();
  const lines = text.split('\n');
  return lines
    .slice(loc.line - 1, loc.endLine)
    .map((l, i) => `${String(loc.line + i).padStart(4)}  ${l}`)
    .join('\n');
}

/** The display text of a label ("Proposition 3.11"), as numbered in the book. */
export function labelText(key: string): string {
  return sourceIndex.labels[key]?.text ?? key;
}
