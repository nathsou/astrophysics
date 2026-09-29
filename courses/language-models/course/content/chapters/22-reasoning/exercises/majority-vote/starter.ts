/** The most common answer among the samples (ignoring nulls, which failed to parse); first seen on ties. */
export function majorityVote(answers: (number | null)[]): number | null {
  // TODO
  return answers[0] ?? null;
}

/** The unbiased estimate of pass@k from n samples of which c are correct (Chen et al., 2021). */
export function passAtK(n: number, c: number, k: number): number {
  // TODO
  return c / n;
}
