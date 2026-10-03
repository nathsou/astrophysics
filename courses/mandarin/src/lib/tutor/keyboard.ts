import { bare, numbersToMarks } from '$lib/zh/pinyin';
import type { Word } from '$lib/zh/lexicon';

export const TONE_KEYS = ['āáǎàa', 'ēéěèe', 'īíǐìi', 'ōóǒòo', 'ūúǔùu', 'ǖǘǚǜü'];
const normalise = (text: string) => bare(numbersToMarks(text.toLowerCase().replace(/u:|v/g, 'ü'))).replace(/[\s’']/g, '');

/** Dictionary-assisted input, deliberately bounded to course vocabulary. */
export function characterCandidates(query: string, words: Word[]): Word[] {
  const q = normalise(query.trim());
  if (!q) return [];
  return words.filter(w => normalise(w.p).startsWith(q) || w.w.startsWith(q))
    .sort((a, b) => Number(normalise(b.p) === q) - Number(normalise(a.p) === q) || (a.f ?? 1e9) - (b.f ?? 1e9))
    .slice(0, 12);
}

export function insertAt(text: string, insert: string, start: number, end: number) {
  return { text: text.slice(0, start) + insert + text.slice(end), cursor: start + insert.length };
}
