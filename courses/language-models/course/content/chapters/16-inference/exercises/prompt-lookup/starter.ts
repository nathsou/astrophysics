/**
 * Prompt-lookup decoding: guess the next tokens by finding the most recent earlier occurrence of the
 * last `n` tokens of `ids` and proposing the (up to) `k` tokens that followed it. Returns [] if the
 * last n tokens never occurred before.
 */
export function promptLookup(ids: number[], n: number, k: number): number[] {
  // TODO
  return [];
}
