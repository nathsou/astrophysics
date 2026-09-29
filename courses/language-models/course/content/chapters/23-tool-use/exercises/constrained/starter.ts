/** A pattern is a sequence of literal strings and character classes repeated between min and max times. */
export type Part = { lit: string } | { cls: 'letters' | 'digits' | 'lower'; min: number; max: number };

/**
 * Can `s` be extended into a full match of the pattern? Constrained decoding keeps only the tokens t for
 * which isPrefix(pattern, generated + t) holds, so whatever the model samples still fits the pattern.
 * (Class runs are greedy: take as many class characters as allowed before moving on.)
 */
export function isPrefix(pattern: Part[], s: string): boolean {
  // TODO
  return true;
}
