/** What the learner knows, for keeping the AI partner's Chinese at the right level. */
import { annotate } from '$lib/zh/annotate';
import { lookup, type ListId } from '$lib/zh/lexicon';
import type { StartPoint } from '$lib/state/settings.svelte';

export function levelLabel(start: StartPoint | null): string {
  switch (start) {
    case 'hsk2':
      return 'preparing for HSK 2 (about 500 words)';
    case 'hsk1':
      return 'preparing for HSK 1 (about 300 words)';
    default:
      return 'complete beginner, a few weeks in';
  }
}

/** Words in `text` that are neither in the learner's deck nor at or below `maxLevel`. */
export function unfamiliar(text: string, known: Set<string>, list: ListId, maxLevel: number): string[] {
  const out = new Set<string>();
  for (const t of annotate(text)) {
    if (!t.s || known.has(t.t)) continue;
    const e = lookup(t.t);
    const level = e?.l[list];
    if (level !== undefined && level <= maxLevel) continue;
    if (t.s.length === 1 && e && Object.keys(e.l).length === 0) continue;
    out.add(t.t);
  }
  return [...out];
}
