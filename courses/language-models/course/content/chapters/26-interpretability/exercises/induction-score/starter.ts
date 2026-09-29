/**
 * A head's induction score on a sequence of 2L + 1 tokens: a start token, then L random tokens, then the same L
 * tokens again. attn[i][j] is how much position i attends to position j. An induction head, at each position of
 * the second copy, attends to the token *after* the same token's first occurrence — the token it should predict.
 */
export function inductionScore(attn: number[][], L: number): number {
  // TODO
  return 0;
}
