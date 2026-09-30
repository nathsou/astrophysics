/**
 * Encoders. A plain encoder assumes that at most one input is 1 and outputs its number by ORing the numbers of
 * the inputs that are 1, bit by bit; press two keys and it outputs the OR of their numbers, which is neither. A
 * priority encoder outputs the number of the highest input that is 1, whatever the others do. Both have a
 * "valid" output V that says whether any input is 1 (without it, "no key" and "key 0" look the same).
 *
 * These are the models of the digital engine's `encoder` and `priority-encoder` blocks
 * (src/lib/sim/digital/models/blocks.ts), which the chapter's circuit test compares them with.
 */

export interface Encoded {
  /** The output number (bits A(k−1)…A0 read as binary). */
  code: number;
  /** 1 when any input is 1. */
  valid: 0 | 1;
}

/** Numbers of the inputs that are 1, ascending. */
export const pressed = (keys: number[]): number[] => keys.flatMap((k, i) => (k ? [i] : []));

/** Plain encoder: the OR of the numbers of the inputs that are 1. */
export function encode(keys: number[]): Encoded {
  const p = pressed(keys);
  return { code: p.reduce((a, i) => a | i, 0), valid: p.length ? 1 : 0 };
}

/** Priority encoder: the number of the highest input that is 1 (0 when there is none). */
export function priorityEncode(keys: number[]): Encoded {
  const p = pressed(keys);
  return { code: p.length ? p[p.length - 1]! : 0, valid: p.length ? 1 : 0 };
}

/** The bits of a code, A0 first. */
export const codeBits = (code: number, k: number): number[] => Array.from({ length: k }, (_, i) => (code >> i) & 1);

/** Did the plain encoder name a key that is really pressed (or no key, when none is)? */
export function encoderIsRight(keys: number[]): boolean {
  const p = pressed(keys);
  if (p.length === 0) return true;
  return p.length === 1;
}
