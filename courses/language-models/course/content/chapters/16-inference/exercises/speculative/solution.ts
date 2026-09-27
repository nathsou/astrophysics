import { sampleIndex } from '@lm/core';

/**
 * Verify a draft model's proposals. The draft sampled drafts[i] from q[i]; the target's distributions at
 * the same positions are p[i], and p[drafts.length] is the target's distribution after the last draft.
 * Returns the tokens to append — the accepted drafts, then one token from the target (a correction
 * after a rejection, or a bonus if all were accepted) — distributed exactly as the target would sample.
 */
export function verify(p: number[][], q: number[][], drafts: number[], rng: () => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const x = drafts[i]!;
    // Accept with probability min(1, p(x) / q(x)).
    if (rng() * q[i]![x]! < p[i]![x]!) {
      out.push(x);
      continue;
    }
    // Rejected: draw from the part of p that q under-represents.
    out.push(sampleIndex(p[i]!.map((pj, j) => Math.max(0, pj - q[i]![j]!)), rng()));
    return out;
  }
  out.push(sampleIndex(p[drafts.length]!, rng()));
  return out;
}
