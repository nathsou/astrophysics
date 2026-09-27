/**
 * Prompt-lookup decoding: guess the next tokens by finding the most recent earlier occurrence of the
 * last `n` tokens of `ids` and proposing the (up to) `k` tokens that followed it. Returns [] if the
 * last n tokens never occurred before.
 */
export function promptLookup(ids: number[], n: number, k: number): number[] {
  const end = ids.length;
  if (end <= n) return [];
  const pattern = ids.slice(end - n);
  // Candidate starts s with s + n ≤ end − 1, so at least one token follows the match.
  for (let s = end - n - 1; s >= 0; s--) {
    let match = true;
    for (let i = 0; i < n && match; i++) match = ids[s + i] === pattern[i];
    if (match) return ids.slice(s + n, Math.min(end, s + n + k));
  }
  return [];
}
