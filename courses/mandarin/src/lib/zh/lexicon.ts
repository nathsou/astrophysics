/**
 * The course dictionary: the HSK word lists (levels 1–3 of three lists), a default reading for
 * every character, and the course's own additions in content/data/extra.ts.
 */
import LEXICON from '$content/data/lexicon.json';
import CHARS from '$content/data/chars.json';
import { EXTRA } from '$content/data/extra';

/** n = 2025 syllabus, s = 2021 standard (HSK 3.0), o = HSK 2.0. */
export type ListId = 'n' | 's' | 'o';

export interface Word {
  /** The word in simplified characters. */
  w: string;
  /** Pinyin with tone marks, one syllable per character, space-separated. */
  p: string;
  /** A short English gloss. */
  g: string;
  /** Lowest HSK level per list. */
  l: Partial<Record<ListId, number>>;
  /** Measure words, if any. */
  c?: string[];
  /** Frequency rank (lower = more common). */
  f?: number;
}

type Raw = { p: string; g: string; l: Partial<Record<ListId, number>>; c?: string[]; f?: number };
const RAW = LEXICON as Record<string, Raw>;
const CHAR_READINGS = CHARS as Record<string, string>;

const words = new Map<string, Word>();
for (const [w, r] of Object.entries(RAW)) words.set(w, { w, ...r });
for (const [w, e] of Object.entries(EXTRA)) {
  const prev = words.get(w);
  words.set(w, { w, p: e.p ?? prev?.p ?? '', g: e.g ?? prev?.g ?? '', l: prev?.l ?? {}, c: prev?.c, f: prev?.f });
}

export const MAX_WORD = Math.max(...[...words.keys()].map((w) => [...w].length));

export function lookup(word: string): Word | undefined {
  return words.get(word);
}

export function allWords(): Word[] {
  return [...words.values()];
}

/** The default reading of a single character. */
export function charReading(ch: string): string | undefined {
  return words.get(ch)?.p || CHAR_READINGS[ch];
}

/** Words of exactly this HSK level in the given list. */
export function hskWords(list: ListId, level: number): Word[] {
  return allWords()
    .filter((w) => w.l[list] === level)
    .sort((a, b) => (a.f ?? 1e9) - (b.f ?? 1e9));
}

export const LIST_NAMES: Record<ListId, string> = {
  n: '2025 syllabus',
  s: 'HSK 3.0 (2021)',
  o: 'HSK 2.0',
};
