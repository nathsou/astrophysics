/**
 * Write the pre-tokenisation regex (used with the "gu" flags) so that `pretokenise` splits text the
 * way GPT-2 does:
 *
 *  - common English contractions stay separate:  it's → "it", "'s"
 *  - a word keeps the single space before it:    " world"
 *  - numbers and punctuation form their own chunks, also with an optional leading space
 *  - runs of whitespace are kept, but the last space before a word goes with the word
 *
 * Useful syntax: \p{L} (any letter), \p{N} (any number), (?!\S) (not followed by non-space).
 */
export const PATTERN = String.raw`\S+|\s+`; // TODO: replace this naive pattern

export function pretokenise(text: string): string[] {
  return text.match(new RegExp(PATTERN, 'gu')) ?? [];
}
