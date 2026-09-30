/**
 * KV-cache slots (one per token per sequence) that a server must set aside for sequences of the given lengths:
 * `contiguous` reserves `maxLen` for every sequence up front; `paged` allocates blocks of `block` tokens as needed.
 */
export function kvSlots(lengths: number[], maxLen: number, block: number): { used: number; contiguous: number; paged: number } {
  // TODO
  return { used: 0, contiguous: 0, paged: 0 };
}
