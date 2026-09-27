export class NGramCounter {
  readonly n: number;
  readonly grams = new Map<string, number>();
  readonly contexts = new Map<string, number>();

  constructor(ids: number[], n: number) {
    this.n = n;
    for (let t = 0; t + n <= ids.length; t++) {
      const gram = ids.slice(t, t + n);
      const key = gram.join(',');
      const ctx = gram.slice(0, n - 1).join(',');
      this.grams.set(key, (this.grams.get(key) ?? 0) + 1);
      // Count contexts from the n-grams themselves, so Σ_w P(w | h) = 1 exactly
      // (the (n−1)-gram at the very end of the text has no successor).
      this.contexts.set(ctx, (this.contexts.get(ctx) ?? 0) + 1);
    }
  }

  count(gram: number[]): number {
    return this.grams.get(gram.join(',')) ?? 0;
  }

  prob(context: number[], next: number): number {
    const h = context.slice(context.length - (this.n - 1));
    if (this.n === 1) h.length = 0;
    const total = this.contexts.get(h.join(',')) ?? 0;
    if (total === 0) return 0;
    return this.count([...h, next]) / total;
  }
}
