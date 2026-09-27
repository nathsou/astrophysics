/**
 * N-gram count tables for Chapter 2.
 *
 * Each k-gram (x₁ … x_k) is packed into one integer code  Σ xᵢ·V^(k−i)  (base-V digits, oldest
 * first). All k-gram codes of the corpus are sorted and run-length encoded. Because a k-gram's code
 * is  code(context)·V + next,  every continuation of a context occupies one contiguous range
 * [ctx·V, ctx·V + V) of the sorted array, found by binary search — no hash maps, a few bytes per
 * distinct n-gram, and fast enough to count 1M characters at n = 8 in the browser.
 */

export interface Table {
  /** Sorted unique k-gram codes. */
  codes: Float64Array;
  /** Count for each code (raw counts, or continuation counts for Kneser–Ney). */
  counts: Float64Array;
  /** cum[i] = counts[0] + … + counts[i−1], so any range sum is O(1). */
  cum: Float64Array;
}

function makeTable(codes: Float64Array, counts: Float64Array): Table {
  const cum = new Float64Array(codes.length + 1);
  for (let i = 0; i < counts.length; i++) cum[i + 1] = cum[i]! + counts[i]!;
  return { codes, counts, cum };
}

/** Sort codes and collapse runs of equal values into (unique code, count) pairs. */
function runLength(raw: Float64Array): Table {
  raw.sort();
  let m = 0;
  for (let i = 0; i < raw.length; i++) if (i === 0 || raw[i] !== raw[i - 1]) m++;
  const codes = new Float64Array(m);
  const counts = new Float64Array(m);
  let j = -1;
  for (let i = 0; i < raw.length; i++) {
    if (i === 0 || raw[i] !== raw[i - 1]) codes[++j] = raw[i]!;
    counts[j]!++;
  }
  return makeTable(codes, counts);
}

/** First index i with a[i] >= x. */
export function lowerBound(a: Float64Array, x: number): number {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (a[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export class NGramStats {
  readonly vocabSize: number;
  readonly maxOrder: number;
  readonly tokens: number;
  /** tables[k − 1] holds the k-grams. */
  readonly tables: Table[] = [];
  private readonly continuation: (Table | undefined)[] = [];

  constructor(ids: ArrayLike<number>, vocabSize: number, maxOrder: number) {
    if (vocabSize ** maxOrder > 2 ** 53) throw new Error(`V^n = ${vocabSize}^${maxOrder} exceeds 2^53; use a smaller order`);
    this.vocabSize = vocabSize;
    this.maxOrder = maxOrder;
    this.tokens = ids.length;
    const V = vocabSize;
    for (let k = 1; k <= maxOrder; k++) {
      const m = Math.max(0, ids.length - k + 1);
      const raw = new Float64Array(m);
      const top = V ** (k - 1); // weight of the oldest digit
      let code = 0;
      for (let t = 0; t < ids.length; t++) {
        code = code * V + ids[t]!;
        if (t >= k - 1) {
          raw[t - k + 1] = code;
          code -= ids[t - k + 1]! * top; // drop the oldest token for the next window
        }
      }
      this.tables.push(runLength(raw));
    }
  }

  /** Code of the k tokens ending just before position `end` (i.e. ids[end−k … end−1]). */
  codeOf(ids: ArrayLike<number>, end: number, k: number): number {
    let code = 0;
    for (let i = end - k; i < end; i++) code = code * this.vocabSize + ids[i]!;
    return code;
  }

  table(k: number): Table {
    return this.tables[k - 1]!;
  }

  count(k: number, code: number): number {
    const t = this.table(k);
    const i = lowerBound(t.codes, code);
    return t.codes[i] === code ? t.counts[i]! : 0;
  }

  /** Index range [lo, hi) in `table` of the k-grams that extend context code `ctx` (k−1 tokens). */
  range(table: Table, ctx: number): [number, number] {
    const V = this.vocabSize;
    return [lowerBound(table.codes, ctx * V), lowerBound(table.codes, ctx * V + V)];
  }

  /**
   * Kneser–Ney continuation counts for k-grams (k < maxOrder): for each k-gram g, the number of
   * distinct tokens x such that x·g occurs — N₁₊(• g). "How many contexts does g complete?"
   */
  continuationTable(k: number): Table {
    let t = this.continuation[k - 1];
    if (!t) {
      if (k >= this.maxOrder) throw new Error('continuation counts need the (k+1)-gram table');
      const higher = this.table(k + 1).codes;
      const mod = this.vocabSize ** k;
      const suffixes = new Float64Array(higher.length);
      for (let i = 0; i < higher.length; i++) suffixes[i] = higher[i]! % mod; // drop the oldest token
      t = runLength(suffixes);
      this.continuation[k - 1] = t;
    }
    return t;
  }

  /** Approximate memory used by the tables, in bytes. */
  get bytes(): number {
    return this.tables.reduce((a, t) => a + t.codes.byteLength + t.counts.byteLength + t.cum.byteLength, 0);
  }
}
