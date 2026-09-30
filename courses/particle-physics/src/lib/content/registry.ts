import { APPENDICES, PARTS, type OutlineEntry } from '$content/outline';
import type { ContentModule } from './types';

type Loader = () => Promise<ContentModule>;

const chapterFiles = import.meta.glob('/content/chapters/*/index.md') as Record<string, Loader>;
const appendixFiles = import.meta.glob('/content/appendices/*/index.md') as Record<string, Loader>;

const slugOf = (p: string) => p.split('/').at(-2)!.replace(/^[0-9a-z]{1,2}-/, '');

const loaders = {
  chapter: new Map(Object.entries(chapterFiles).map(([p, l]) => [slugOf(p), l])),
  appendix: new Map(Object.entries(appendixFiles).map(([p, l]) => [slugOf(p), l])),
};

export type Kind = 'chapter' | 'appendix';

export interface NavEntry extends OutlineEntry {
  kind: Kind;
  available: boolean;
  href: string;
  part?: string;
}

const chapterEntries: NavEntry[] = PARTS.flatMap((part) =>
  part.chapters.map((c) => ({ ...c, kind: 'chapter' as const, part: part.id, available: loaders.chapter.has(c.slug), href: `/chapters/${c.slug}/` })),
);
const appendixEntries: NavEntry[] = APPENDICES.map((a) => ({ ...a, kind: 'appendix' as const, available: loaders.appendix.has(a.slug), href: `/appendix/${a.slug}/` }));

/** Reading order: chapters, then appendices. */
export const ALL_ENTRIES: NavEntry[] = [...chapterEntries, ...appendixEntries];

export function findEntry(kind: Kind, slug: string): NavEntry | undefined {
  return ALL_ENTRIES.find((e) => e.kind === kind && e.slug === slug);
}

export function loadContent(kind: Kind, slug: string): Loader | undefined {
  return loaders[kind].get(slug);
}

export function availableSlugs(kind: Kind): string[] {
  return [...loaders[kind].keys()];
}

/** Previous/next *available* entries for page navigation. */
export function neighbours(kind: Kind, slug: string): { prev?: NavEntry; next?: NavEntry } {
  const list = ALL_ENTRIES.filter((e) => e.available);
  const i = list.findIndex((e) => e.kind === kind && e.slug === slug);
  return { prev: i > 0 ? list[i - 1] : undefined, next: i >= 0 ? list[i + 1] : undefined };
}
