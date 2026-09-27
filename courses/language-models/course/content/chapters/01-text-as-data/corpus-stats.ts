/**
 * Statistics of TinyShakespeare shared by the chapter's widgets (computed once per page).
 */
import * as T from '@lm/core/text';
import { loadCorpus } from '$lib/data/corpus';

/** Shannon's 27-symbol alphabet: a–z plus space. */
export const ALPHABET27 = 'abcdefghijklmnopqrstuvwxyz ';

/** Lower-case, map anything outside a–z to a space, and collapse runs of spaces. */
export function to27(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z]+/g, ' ');
}

export interface CorpusStats {
  text: string;
  words: string[];
  wordRanks: T.Ranked<string>[];
  charRanks: T.Ranked<string>[];
  charRanksFolded: T.Ranked<string>[];
  /** Counts over ALPHABET27, and the 27×27 bigram count matrix (row = current, col = next). */
  counts27: Float32Array;
  bigram27: Float32Array;
  text27: string;
}

let stats: Promise<CorpusStats> | undefined;

export function shakespeare(): Promise<CorpusStats> {
  stats ??= loadCorpus('shakespeare').then((text) => {
    const words = T.words(text);
    const text27 = to27(text);
    const counts27 = new Float32Array(27);
    const bigram27 = new Float32Array(27 * 27);
    let prev = -1;
    for (const ch of text27) {
      const i = ch === ' ' ? 26 : ch.charCodeAt(0) - 97;
      counts27[i]!++;
      if (prev >= 0) bigram27[prev * 27 + i]!++;
      prev = i;
    }
    return {
      text,
      words,
      wordRanks: T.rankFrequencies(T.countFrequencies(words)),
      charRanks: T.rankFrequencies(T.countFrequencies(T.codePoints(text).map((c) => String.fromCodePoint(c)))),
      charRanksFolded: T.rankFrequencies(T.countFrequencies(T.codePoints(text.toLowerCase()).map((c) => String.fromCodePoint(c)))),
      counts27,
      bigram27,
      text27,
    };
  });
  return stats;
}

/** Make whitespace visible in labels. */
export const visible = (s: string) => s.replace(/ /g, '␣').replace(/\n/g, '↵').replace(/\t/g, '⇥');
