/**
 * Dispatch with expert capacity (GShard, Switch Transformer). `choice[t]` is token t's expert (top-1). Each
 * expert accepts at most C = max(1, ⌊factor · tokens / experts⌋) tokens, first come first served. Returns, for
 * each token, the slot it got in its expert's buffer (0 … C−1), or −1 if it was dropped.
 */
export function dispatch(choice: number[], experts: number, factor: number): number[] {
  // TODO
  return choice.map(() => 0);
}
