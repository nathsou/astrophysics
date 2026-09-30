/** The fraction of time each GPU sits idle in a GPipe pipeline with `stages` stages and `micro` micro-batches. */
export function bubble(stages: number, micro: number): number {
  // The pipeline fills for stages − 1 slots and drains for as many; each stage works for `micro` of the slots.
  return (stages - 1) / (micro + stages - 1);
}
