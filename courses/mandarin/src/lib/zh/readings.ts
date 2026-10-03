/**
 * From sound to characters: for each pinyin syllable and tone, the most common characters read
 * that way. Lets the pinyin chart play any syllable with a real character behind it.
 */
import { allWords, charReading } from './lexicon';
import { bare, toneOf, type Tone } from './pinyin';
import CHARS from '$content/data/chars.json';

let index: Map<string, string[]> | null = null;

function build(): Map<string, string[]> {
  const rank = new Map<string, number>();
  for (const w of allWords()) if ([...w.w].length === 1 && w.f) rank.set(w.w, w.f);
  const m = new Map<string, string[]>();
  for (const ch of Object.keys(CHARS as Record<string, string>)) {
    const py = charReading(ch);
    if (!py || py.includes(' ')) continue;
    const key = `${bare(py).toLowerCase()}${toneOf(py)}`;
    m.set(key, [...(m.get(key) ?? []), ch]);
  }
  for (const list of m.values()) list.sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
  return m;
}

/** Characters read `syllable` (bare, e.g. "zhong") in `tone`, most common first. */
export function charsFor(syllable: string, tone: Tone): string[] {
  index ??= build();
  return index.get(`${syllable}${tone}`) ?? [];
}

/** Syllables (bare) that have at least one character in the course dictionary. */
export function knownSyllables(): Set<string> {
  index ??= build();
  return new Set([...index.keys()].map((k) => k.slice(0, -1)));
}
