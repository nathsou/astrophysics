import { sampleIndex } from '@lm/core';

/**
 * Verify a draft model's proposals. The draft sampled drafts[i] from q[i]; the target's distributions at
 * the same positions are p[i], and p[drafts.length] is the target's distribution after the last draft.
 * Returns the tokens to append — the accepted drafts, then one token from the target (a correction
 * after a rejection, or a bonus if all were accepted) — distributed exactly as the target would sample.
 */
export function verify(p: number[][], q: number[][], drafts: number[], rng: () => number): number[] {
  const out: number[] = [];
  // TODO
  return out;
}
