import { createContext } from 'svelte';
import type { GlossaryEntry, Reference, TermDef } from '$lib/content/types';

/** Per-page documentation compiled from the chapter's Markdown, provided by <TermLayer>. */
export interface PageDocs {
  terms: Record<string, TermDef>;
  references: Reference[];
  glossary: Record<string, GlossaryEntry>;
}

export const [getPageDocs, setPageDocs] = createContext<PageDocs>();

/** Like getPageDocs but tolerates components rendered outside a chapter (e.g. the gallery). */
export function tryPageDocs(): PageDocs {
  try {
    return getPageDocs();
  } catch {
    return { terms: {}, references: [], glossary: {} };
  }
}
