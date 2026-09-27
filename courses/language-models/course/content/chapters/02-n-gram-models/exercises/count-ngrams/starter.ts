/**
 * A minimal n-gram counter using ordinary Maps (the course library uses sorted typed arrays for
 * speed, but the idea is identical).
 */
export class NGramCounter {
  readonly n: number;
  /** count of each n-gram, keyed by its ids joined with commas, e.g. "3,1,4" */
  readonly grams = new Map<string, number>();
  /** Σ_w count(context + w) for each (n−1)-token context */
  readonly contexts = new Map<string, number>();

  constructor(ids: number[], n: number) {
    this.n = n;
    // TODO: slide a window of length n over ids and fill both maps.
  }

  count(gram: number[]): number {
    return this.grams.get(gram.join(',')) ?? 0;
  }

  /** Maximum-likelihood P(next | context); 0 if the context never occurred. */
  prob(context: number[], next: number): number {
    // TODO: use the last n − 1 tokens of `context`.
    return 0;
  }
}
