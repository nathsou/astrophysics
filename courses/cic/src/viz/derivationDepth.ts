// How much of a derivation tree is unfolded when it first appears.

/** a step-by-step tree opens this many levels of premises above the conclusion */
export const DEFAULT_OPEN_LEVELS = 3;

/**
 * The initial reveal depth of a derivation tree: nodes at depth ≥ the result
 * start folded.  Step-by-step trees used to open fully folded (a single
 * line); they now show the first few rule applications and keep the
 * fewer / grow controls for the rest.  Other trees open completely.
 */
export function initialRevealDepth(stepwise: boolean | undefined, maxDepth: number, levels = DEFAULT_OPEN_LEVELS): number {
  if (!stepwise) return Infinity;
  return Math.max(0, Math.min(levels, maxDepth + 1));
}
