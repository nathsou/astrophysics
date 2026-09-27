/**
 * Chapter 1 — corpus statistics: frequencies, Zipf's and Heaps' laws, entropy.
 */

/** Count occurrences of each item. */
export function countFrequencies<T>(items: Iterable<T>): Map<T, number> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

export interface Ranked<T> {
  item: T;
  count: number;
  /** 1-based rank; the most frequent item has rank 1. */
  rank: number;
}

/** Sort a frequency table by descending count (ties broken by first appearance). */
export function rankFrequencies<T>(counts: Map<T, number>): Ranked<T>[] {
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([item, count], i) => ({ item, count, rank: i + 1 }));
}

/**
 * A deliberately simple word splitter: lower-cased runs of letters, digits and
 * apostrophes. Chapter 3 replaces this with a learned tokeniser.
 */
export function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? [];
}

/**
 * Shannon entropy of a distribution given by (unnormalised) counts.
 *   H = −Σ p·log(p),  p = count / total
 * Zero counts contribute nothing (lim p→0 of p·log p = 0).
 */
export function entropy(counts: Iterable<number>, base = 2): number {
  const cs = [...counts];
  const total = cs.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const c of cs) {
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log(p);
    }
  }
  return h / Math.log(base);
}

export interface PowerLawFit {
  /** Exponent s in f(r) = C / r^s. */
  s: number;
  /** Scale C (the fitted frequency of rank 1). */
  C: number;
  /** Coefficient of determination of the fit in log–log space. */
  r2: number;
}

/**
 * Fit f(r) = C / r^s by ordinary least squares on log f = log C − s·log r.
 * Quick and visual, but biased for heavy tails — see Clauset, Shalizi & Newman (2009)
 * for maximum-likelihood alternatives (a Chapter 1 challenge).
 */
export function fitPowerLaw(xs: ArrayLike<number>, ys: ArrayLike<number>): PowerLawFit {
  const n = Math.min(xs.length, ys.length);
  let sx = 0, sy = 0, sxx = 0, sxy = 0, m = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i]!, y = ys[i]!;
    if (x <= 0 || y <= 0) continue;
    const lx = Math.log(x), ly = Math.log(y);
    sx += lx; sy += ly; sxx += lx * lx; sxy += lx * ly; m++;
  }
  const slope = (m * sxy - sx * sy) / (m * sxx - sx * sx);
  const intercept = (sy - slope * sx) / m;
  let ssRes = 0, ssTot = 0;
  const meanY = sy / m;
  for (let i = 0; i < n; i++) {
    const x = xs[i]!, y = ys[i]!;
    if (x <= 0 || y <= 0) continue;
    const ly = Math.log(y);
    const pred = intercept + slope * Math.log(x);
    ssRes += (ly - pred) ** 2;
    ssTot += (ly - meanY) ** 2;
  }
  return { s: -slope, C: Math.exp(intercept), r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

/**
 * Vocabulary growth (Heaps' law): number of distinct items seen after the first n,
 * sampled at roughly log-spaced n.
 */
export function vocabularyGrowth<T>(items: readonly T[], samples = 60): { n: number; v: number }[] {
  const seen = new Set<T>();
  const points: { n: number; v: number }[] = [];
  const marks = new Set<number>();
  for (let k = 0; k <= samples; k++) {
    marks.add(Math.max(1, Math.round(Math.exp((Math.log(items.length) * k) / samples))));
  }
  items.forEach((item, i) => {
    seen.add(item);
    if (marks.has(i + 1)) points.push({ n: i + 1, v: seen.size });
  });
  return points;
}
