/**
 * Dispatch with expert capacity (GShard, Switch Transformer). `choice[t]` is token t's expert (top-1). Each
 * expert accepts at most C = max(1, ⌊factor · tokens / experts⌋) tokens, first come first served. Returns, for
 * each token, the slot it got in its expert's buffer (0 … C−1), or −1 if it was dropped.
 */
export function dispatch(choice: number[], experts: number, factor: number): number[] {
  const C = Math.max(1, Math.floor((factor * choice.length) / experts));
  const used = new Array<number>(experts).fill(0);
  // Fixed-size buffers let every device hold the same shapes, which is what makes experts easy to shard.
  return choice.map((e) => (used[e]! < C ? used[e]!++ : -1));
}
