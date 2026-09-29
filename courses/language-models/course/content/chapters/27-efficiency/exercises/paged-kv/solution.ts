/**
 * KV-cache slots (one per token per sequence) that a server must set aside for sequences of the given lengths:
 * `contiguous` reserves `maxLen` for every sequence up front; `paged` allocates blocks of `block` tokens as needed.
 */
export function kvSlots(lengths: number[], maxLen: number, block: number): { used: number; contiguous: number; paged: number } {
  const used = lengths.reduce((a, n) => a + n, 0);
  const paged = lengths.reduce((a, n) => a + Math.ceil(n / block) * block, 0);
  return { used, contiguous: lengths.length * maxLen, paged };
}
