/**
 * N-gram language models with the classic smoothing methods (Chapter 2).
 */
import type { LanguageModel } from '../lm.ts';
import { NGramStats, type Table } from './stats.ts';

export type Smoothing =
  /** Maximum likelihood: relative frequencies. Unseen events get probability 0. */
  | { kind: 'mle' }
  /** Add-k (Laplace when k = 1): pretend every continuation was seen k extra times. */
  | { kind: 'addk'; k: number }
  /** Jelinek–Mercer interpolation: λ·P_MLE(order k) + (1 − λ)·P(order k − 1), recursively. */
  | { kind: 'interp'; lambda: number }
  /** Interpolated Kneser–Ney with absolute discount d and continuation counts. */
  | { kind: 'kn'; d: number };

export class NGramModel implements LanguageModel {
  readonly vocabSize: number;
  readonly contextLength: number;
  readonly stats: NGramStats;
  readonly order: number;
  readonly smoothing: Smoothing;

  constructor(stats: NGramStats, order: number, smoothing: Smoothing) {
    if (order > stats.maxOrder) throw new Error(`order ${order} > counted order ${stats.maxOrder}`);
    this.stats = stats;
    this.order = order;
    this.smoothing = smoothing;
    this.vocabSize = stats.vocabSize;
    this.contextLength = order - 1;
  }

  static train(ids: ArrayLike<number>, vocabSize: number, order: number, smoothing: Smoothing): NGramModel {
    return new NGramModel(new NGramStats(ids, vocabSize, order), order, smoothing);
  }

  /** Highest order usable with this context (shorter at the very start of a text). */
  private topOrder(context: ArrayLike<number>): number {
    return Math.min(this.order, context.length + 1);
  }

  /** Table used at order j: raw counts at the top, continuation counts below it (KN only). */
  private tableFor(j: number, top: number): Table {
    return this.smoothing.kind === 'kn' && j < top ? this.stats.continuationTable(j) : this.stats.table(j);
  }

  distribution(context: ArrayLike<number>): Float64Array {
    const V = this.vocabSize;
    const s = this.smoothing;
    const top = this.topOrder(context);
    const ctxCode = (j: number) => this.stats.codeOf(context, context.length, j - 1);

    if (s.kind === 'mle' || s.kind === 'addk') {
      const t = this.stats.table(top);
      const [lo, hi] = this.stats.range(t, ctxCode(top));
      const tot = t.cum[hi]! - t.cum[lo]!;
      const k = s.kind === 'addk' ? s.k : 0;
      const p = new Float64Array(V);
      if (tot + k * V === 0) return p.fill(1 / V); // unseen context: MLE is undefined; fall back to uniform
      p.fill(k / (tot + k * V));
      for (let i = lo; i < hi; i++) p[t.codes[i]! % V] = (t.counts[i]! + k) / (tot + k * V);
      return p;
    }

    // Recursive interpolation from the uniform distribution upwards.
    let p = new Float64Array(V).fill(1 / V);
    for (let j = 1; j <= top; j++) {
      const t = this.tableFor(j, top);
      const [lo, hi] = this.stats.range(t, ctxCode(j));
      const tot = t.cum[hi]! - t.cum[lo]!;
      if (tot === 0) continue; // unseen context: keep the lower-order estimate
      const q = new Float64Array(V);
      if (s.kind === 'interp') {
        for (let w = 0; w < V; w++) q[w] = (1 - s.lambda) * p[w]!;
        for (let i = lo; i < hi; i++) q[t.codes[i]! % V]! += (s.lambda * t.counts[i]!) / tot;
      } else {
        const backoff = (s.d * (hi - lo)) / tot; // mass freed by discounting, spread by the lower order
        for (let w = 0; w < V; w++) q[w] = backoff * p[w]!;
        for (let i = lo; i < hi; i++) q[t.codes[i]! % V]! += Math.max(t.counts[i]! - s.d, 0) / tot;
      }
      p = q;
    }
    return p;
  }

  prob(context: ArrayLike<number>, next: number): number {
    const V = this.vocabSize;
    const s = this.smoothing;
    const top = this.topOrder(context);
    const ctxCode = (j: number) => this.stats.codeOf(context, context.length, j - 1);
    const lookup = (t: Table, ctx: number) => {
      const [lo, hi] = this.stats.range(t, ctx);
      const tot = t.cum[hi]! - t.cum[lo]!;
      const code = ctx * V + next;
      // Binary search within the (small) range for the exact n-gram.
      let a = lo, b = hi;
      while (a < b) {
        const m = (a + b) >>> 1;
        if (t.codes[m]! < code) a = m + 1;
        else b = m;
      }
      const c = a < hi && t.codes[a] === code ? t.counts[a]! : 0;
      return { c, tot, types: hi - lo };
    };

    if (s.kind === 'mle' || s.kind === 'addk') {
      const { c, tot } = lookup(this.stats.table(top), ctxCode(top));
      const k = s.kind === 'addk' ? s.k : 0;
      if (tot + k * V === 0) return 1 / V;
      return (c + k) / (tot + k * V);
    }

    let p = 1 / V;
    for (let j = 1; j <= top; j++) {
      const { c, tot, types } = lookup(this.tableFor(j, top), ctxCode(j));
      if (tot === 0) continue;
      p = s.kind === 'interp' ? s.lambda * (c / tot) + (1 - s.lambda) * p : Math.max(c - s.d, 0) / tot + ((s.d * types) / tot) * p;
    }
    return p;
  }
}
