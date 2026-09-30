/** A pattern is a sequence of literal strings and character classes repeated between min and max times. */
export type Part = { lit: string } | { cls: 'letters' | 'digits' | 'lower'; min: number; max: number };

const CLASSES = { letters: /[A-Za-z]/, digits: /[0-9]/, lower: /[a-z]/ };

/**
 * Can `s` be extended into a full match of the pattern? Constrained decoding keeps only the tokens t for
 * which isPrefix(pattern, generated + t) holds, so whatever the model samples still fits the pattern.
 * (Class runs are greedy: take as many class characters as allowed before moving on.)
 */
export function isPrefix(pattern: Part[], s: string): boolean {
  let i = 0;
  for (const part of pattern) {
    if ('lit' in part) {
      for (const c of part.lit) {
        if (i === s.length) return true; // the string stops inside the literal
        if (s[i++] !== c) return false;
      }
    } else {
      let n = 0;
      while (i < s.length && n < part.max && CLASSES[part.cls].test(s[i]!)) i++, n++;
      if (i === s.length) return true; // the run may still grow (or the next part begin)
      if (n < part.min) return false;
    }
  }
  return i === s.length; // nothing may follow a complete match
}
