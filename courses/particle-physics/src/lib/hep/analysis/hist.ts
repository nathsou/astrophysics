/**
 * Histograms: fixed or variable binning, weights, the sum of squared weights (for the statistical uncertainty of weighted
 * entries), underflow and overflow. `Hist1D.toSeries()` gives the `{ edges, counts }` shape that `HepHist.svelte` draws.
 *
 *     const h = new Hist1D(60, 60, 120);        // 60 bins from 60 to 120
 *     h.fillArray(masses);
 *     h.mean(); h.std(); h.integral();
 *
 * Bin i covers [edges[i], edges[i + 1]); a value equal to the upper edge of the last bin is overflow, as in ROOT.
 */

export interface HistSeriesData {
  edges: number[];
  counts: number[];
}

export class Hist1D {
  /** n + 1 bin edges, increasing. */
  readonly edges: Float64Array;
  /** Sum of weights in each bin. */
  readonly counts: Float64Array;
  /** Sum of squared weights in each bin (the variance of the bin content). */
  readonly sumw2: Float64Array;
  underflow = 0;
  overflow = 0;
  underflowW2 = 0;
  overflowW2 = 0;
  /** Number of fill calls (unweighted entries), including under- and overflow. */
  entries = 0;
  /** Sums over in-range fills, for the mean and standard deviation. */
  private sw = 0;
  private swx = 0;
  private swx2 = 0;
  private uniform: boolean;
  private lo: number;
  private inv: number;
  title = '';

  /** `new Hist1D(nbins, lo, hi)` for even bins or `new Hist1D(edges)` for variable bins. */
  constructor(nbins: number, lo: number, hi: number);
  constructor(edges: ArrayLike<number>);
  constructor(a: number | ArrayLike<number>, lo?: number, hi?: number) {
    if (typeof a === 'number') {
      if (!(a >= 1) || !(hi! > lo!)) throw new Error('Hist1D: need nbins ≥ 1 and hi > lo');
      this.edges = new Float64Array(a + 1);
      for (let i = 0; i <= a; i++) this.edges[i] = lo! + ((hi! - lo!) * i) / a;
      this.edges[a] = hi!;
      this.uniform = true;
    } else {
      if (a.length < 2) throw new Error('Hist1D: need at least two edges');
      this.edges = Float64Array.from(a);
      for (let i = 1; i < this.edges.length; i++) if (!(this.edges[i]! > this.edges[i - 1]!)) throw new Error('Hist1D: edges must be strictly increasing');
      // Even spacing (to 1e-9) gets the fast path.
      const w = (this.edges[this.edges.length - 1]! - this.edges[0]!) / (this.edges.length - 1);
      this.uniform = this.edges.every((e, i) => Math.abs(e - (this.edges[0]! + i * w)) < 1e-9 * Math.max(1, Math.abs(w)));
    }
    this.counts = new Float64Array(this.edges.length - 1);
    this.sumw2 = new Float64Array(this.edges.length - 1);
    this.lo = this.edges[0]!;
    this.inv = this.nbins / (this.edges[this.nbins]! - this.lo);
  }

  /** Logarithmically spaced bins from lo to hi (both > 0). */
  static logBins(nbins: number, lo: number, hi: number): Hist1D {
    const e = Array.from({ length: nbins + 1 }, (_, i) => lo * (hi / lo) ** (i / nbins));
    return new Hist1D(e);
  }

  get nbins(): number {
    return this.counts.length;
  }
  get lower(): number {
    return this.edges[0]!;
  }
  get upper(): number {
    return this.edges[this.nbins]!;
  }

  /** Index of the bin containing x: −1 for underflow, nbins for overflow (NaN is overflow). */
  findBin(x: number): number {
    const n = this.nbins;
    if (x < this.lo) return -1;
    if (!(x < this.edges[n]!)) return n;
    if (this.uniform) {
      const i = Math.floor((x - this.lo) * this.inv);
      // Guard against rounding at the edges.
      if (i >= n) return n - 1;
      if (x < this.edges[i]!) return i - 1;
      if (x >= this.edges[i + 1]!) return i + 1;
      return i;
    }
    let a = 0;
    let b = n;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (this.edges[m]! <= x) a = m;
      else b = m;
    }
    return a;
  }

  /** Add one entry with weight w. */
  fill(x: number, w = 1): this {
    const i = this.findBin(x);
    this.entries++;
    if (i < 0) {
      this.underflow += w;
      this.underflowW2 += w * w;
    } else if (i >= this.nbins) {
      this.overflow += w;
      this.overflowW2 += w * w;
    } else {
      this.counts[i]! += w;
      this.sumw2[i]! += w * w;
      this.sw += w;
      this.swx += w * x;
      this.swx2 += w * x * x;
    }
    return this;
  }

  /** Fill from an array (of values, and optionally of weights). Much faster than a loop of `fill` for large arrays. */
  fillArray(xs: ArrayLike<number>, ws?: ArrayLike<number>): this {
    const n = this.nbins;
    const c = this.counts, s2 = this.sumw2;
    const lo = this.lo, hi = this.edges[n]!, inv = this.inv;
    let sw = 0, swx = 0, swx2 = 0;
    if (this.uniform && !ws) {
      let ufl = 0, ofl = 0;
      for (let k = 0; k < xs.length; k++) {
        const x = xs[k]!;
        if (x < lo) ufl++;
        else if (!(x < hi)) ofl++;
        else {
          let i = ((x - lo) * inv) | 0;
          if (i >= n) i = n - 1;
          else if (x < this.edges[i]!) i--;
          else if (x >= this.edges[i + 1]!) i++;
          c[i]!++;
          s2[i]!++;
          sw++;
          swx += x;
          swx2 += x * x;
        }
      }
      this.underflow += ufl;
      this.underflowW2 += ufl;
      this.overflow += ofl;
      this.overflowW2 += ofl;
      this.entries += xs.length;
      this.sw += sw;
      this.swx += swx;
      this.swx2 += swx2;
      return this;
    }
    for (let k = 0; k < xs.length; k++) this.fill(xs[k]!, ws ? ws[k]! : 1);
    return this;
  }

  binCenter(i: number): number {
    return 0.5 * (this.edges[i]! + this.edges[i + 1]!);
  }
  binWidth(i: number): number {
    return this.edges[i + 1]! - this.edges[i]!;
  }
  centres(): number[] {
    return Array.from({ length: this.nbins }, (_, i) => this.binCenter(i));
  }
  widths(): number[] {
    return Array.from({ length: this.nbins }, (_, i) => this.binWidth(i));
  }
  /** Statistical uncertainty of bin i: √(Σ w²). */
  error(i: number): number {
    return Math.sqrt(this.sumw2[i]!);
  }
  errors(): number[] {
    return Array.from(this.sumw2, Math.sqrt);
  }

  /** Sum of the in-range bin contents; with `width: true` the integral ∫ h dx (content × width). */
  integral(opts: { width?: boolean; flow?: boolean } = {}): number {
    let s = 0;
    for (let i = 0; i < this.nbins; i++) s += this.counts[i]! * (opts.width ? this.binWidth(i) : 1);
    if (opts.flow) s += this.underflow + this.overflow;
    return s;
  }
  /** Sum of the contents of the bins whose centres lie in [xlo, xhi]. */
  integralRange(xlo: number, xhi: number): number {
    let s = 0;
    for (let i = 0; i < this.nbins; i++) {
      const c = this.binCenter(i);
      if (c >= xlo && c <= xhi) s += this.counts[i]!;
    }
    return s;
  }
  /** Weighted mean of the in-range fills (exact, not from the bin centres). */
  mean(): number {
    return this.sw > 0 ? this.swx / this.sw : NaN;
  }
  /** Weighted standard deviation of the in-range fills. */
  std(): number {
    if (!(this.sw > 0)) return NaN;
    const m = this.swx / this.sw;
    return Math.sqrt(Math.max(0, this.swx2 / this.sw - m * m));
  }
  /** Index of the fullest bin. */
  maxBin(): number {
    let k = 0;
    for (let i = 1; i < this.nbins; i++) if (this.counts[i]! > this.counts[k]!) k = i;
    return k;
  }

  clone(): Hist1D {
    const h = new Hist1D(this.edges);
    h.counts.set(this.counts);
    h.sumw2.set(this.sumw2);
    h.underflow = this.underflow; h.overflow = this.overflow;
    h.underflowW2 = this.underflowW2; h.overflowW2 = this.overflowW2;
    h.entries = this.entries;
    h.sw = this.sw; h.swx = this.swx; h.swx2 = this.swx2;
    h.title = this.title;
    return h;
  }
  /** An empty histogram with the same binning. */
  emptyLike(): Hist1D {
    return new Hist1D(this.edges);
  }
  sameBinning(o: Hist1D): boolean {
    return o.edges.length === this.edges.length && this.edges.every((e, i) => Math.abs(e - o.edges[i]!) < 1e-9 * Math.max(1, Math.abs(e)));
  }

  /** this += k × other (same binning required). Variances add with k². */
  add(other: Hist1D, k = 1): this {
    if (!this.sameBinning(other)) throw new Error('Hist1D.add: different binning');
    for (let i = 0; i < this.nbins; i++) {
      this.counts[i]! += k * other.counts[i]!;
      this.sumw2[i]! += k * k * other.sumw2[i]!;
    }
    this.underflow += k * other.underflow; this.overflow += k * other.overflow;
    this.underflowW2 += k * k * other.underflowW2; this.overflowW2 += k * k * other.overflowW2;
    this.entries += other.entries;
    this.sw += k * other.sw; this.swx += k * other.swx; this.swx2 += k * other.swx2;
    return this;
  }
  /** Multiply the contents by k (variances by k²). */
  scale(k: number): this {
    for (let i = 0; i < this.nbins; i++) {
      this.counts[i]! *= k;
      this.sumw2[i]! *= k * k;
    }
    this.underflow *= k; this.overflow *= k;
    this.underflowW2 *= k * k; this.overflowW2 *= k * k;
    this.sw *= k; this.swx *= k; this.swx2 *= k;
    return this;
  }
  /** Scale so that the in-range integral is `to` (default 1). With `width: true` the area ∫ h dx is normalised (a density). */
  normalise(to = 1, width = false): this {
    const I = this.integral({ width });
    if (I !== 0) this.scale(to / I);
    return this;
  }
  /** Divide each bin by its width (an "events per GeV" density). */
  toDensity(): this {
    for (let i = 0; i < this.nbins; i++) {
      const w = this.binWidth(i);
      this.counts[i]! /= w;
      this.sumw2[i]! /= w * w;
    }
    return this;
  }

  /**
   * Merge bins. `rebin(k)` merges each k adjacent bins (the number of bins must be divisible by k);
   * `rebin(edges)` re-bins to the given edges, which must be a subset of the current ones.
   */
  rebin(k: number | ArrayLike<number>): Hist1D {
    let keep: number[];
    if (typeof k === 'number') {
      if (!Number.isInteger(k) || k < 1 || this.nbins % k !== 0) throw new Error(`Hist1D.rebin: ${this.nbins} bins are not divisible by ${k}`);
      keep = Array.from({ length: this.nbins / k + 1 }, (_, i) => i * k);
    } else {
      keep = Array.from(k, (e) => {
        const j = this.edges.findIndex((x) => Math.abs(x - e) < 1e-9 * Math.max(1, Math.abs(e)));
        if (j < 0) throw new Error(`Hist1D.rebin: ${e} is not a bin edge`);
        return j;
      });
    }
    const out = new Hist1D(keep.map((j) => this.edges[j]!));
    for (let b = 0; b < keep.length - 1; b++) {
      for (let i = keep[b]!; i < keep[b + 1]!; i++) {
        out.counts[b]! += this.counts[i]!;
        out.sumw2[b]! += this.sumw2[i]!;
      }
    }
    // Content outside the new range goes to the flows.
    out.underflow = this.underflow; out.overflow = this.overflow;
    out.underflowW2 = this.underflowW2; out.overflowW2 = this.overflowW2;
    for (let i = 0; i < keep[0]!; i++) { out.underflow += this.counts[i]!; out.underflowW2 += this.sumw2[i]!; }
    for (let i = keep[keep.length - 1]!; i < this.nbins; i++) { out.overflow += this.counts[i]!; out.overflowW2 += this.sumw2[i]!; }
    out.entries = this.entries;
    out.sw = this.sw; out.swx = this.swx; out.swx2 = this.swx2;
    out.title = this.title;
    return out;
  }

  /** A histogram restricted to the bins between two edges (which must be bin edges): a "zoom". */
  slice(xlo: number, xhi: number): Hist1D {
    const e = Array.from(this.edges).filter((x) => x >= xlo - 1e-9 && x <= xhi + 1e-9);
    return this.rebin(e);
  }

  /** The `{ edges, counts }` pair that `HepHist.svelte` draws. */
  toSeries(): HistSeriesData {
    return { edges: Array.from(this.edges), counts: Array.from(this.counts) };
  }
  /** Plain arrays of everything, for plotting and for fits. */
  toArrays(): { edges: number[]; counts: number[]; errors: number[]; centres: number[]; widths: number[] } {
    return { edges: Array.from(this.edges), counts: Array.from(this.counts), errors: this.errors(), centres: this.centres(), widths: this.widths() };
  }
  /**
   * The cumulative histogram as an array: `forward` gives the sum of bins 0…i (events below the upper edge of bin i),
   * `backward` the sum of bins i…n−1 (events above the lower edge of bin i). Underflow is included in `forward`, overflow in `backward`
   * when `flow` is true.
   */
  cumulative(direction: 'forward' | 'backward' = 'forward', flow = false): number[] {
    return cumulative(this.counts, direction, flow ? (direction === 'forward' ? this.underflow : this.overflow) : 0);
  }
}

/** Running sum of an array, forward (prefix) or backward (suffix), starting from `start`. */
export function cumulative(a: ArrayLike<number>, direction: 'forward' | 'backward' = 'forward', start = 0): number[] {
  const out = new Array<number>(a.length);
  let s = start;
  if (direction === 'forward') for (let i = 0; i < a.length; i++) out[i] = s += a[i]!;
  else for (let i = a.length - 1; i >= 0; i--) out[i] = s += a[i]!;
  return out;
}

/** The efficiency curve of a cut: for each threshold bin, the fraction of the histogram at or above it (backward) or below it (forward), normalised to 1. */
export function cumulativeEfficiency(h: Hist1D, direction: 'forward' | 'backward' = 'backward'): number[] {
  const total = h.integral();
  return h.cumulative(direction).map((v) => (total > 0 ? v / total : 0));
}

/** A two-dimensional histogram with even or variable bins on each axis. Content outside the range is counted in `outside`. */
export class Hist2D {
  readonly xedges: Float64Array;
  readonly yedges: Float64Array;
  /** Row-major: index = ix × ny + iy. */
  readonly counts: Float64Array;
  readonly sumw2: Float64Array;
  outside = 0;
  entries = 0;
  constructor(nx: number, xlo: number, xhi: number, ny: number, ylo: number, yhi: number);
  constructor(xedges: ArrayLike<number>, yedges: ArrayLike<number>);
  constructor(...a: (number | ArrayLike<number>)[]) {
    if (typeof a[0] === 'number') {
      const [nx, xlo, xhi, ny, ylo, yhi] = a as number[];
      this.xedges = Float64Array.from({ length: nx! + 1 }, (_, i) => xlo! + ((xhi! - xlo!) * i) / nx!);
      this.yedges = Float64Array.from({ length: ny! + 1 }, (_, i) => ylo! + ((yhi! - ylo!) * i) / ny!);
    } else {
      this.xedges = Float64Array.from(a[0] as ArrayLike<number>);
      this.yedges = Float64Array.from(a[1] as ArrayLike<number>);
    }
    this.counts = new Float64Array(this.nx * this.ny);
    this.sumw2 = new Float64Array(this.nx * this.ny);
  }
  get nx(): number {
    return this.xedges.length - 1;
  }
  get ny(): number {
    return this.yedges.length - 1;
  }
  private bin(edges: Float64Array, v: number): number {
    const n = edges.length - 1;
    if (!(v >= edges[0]!) || !(v < edges[n]!)) return -1;
    let a = 0, b = n;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (edges[m]! <= v) a = m;
      else b = m;
    }
    return a;
  }
  fill(x: number, y: number, w = 1): this {
    this.entries++;
    const i = this.bin(this.xedges, x), j = this.bin(this.yedges, y);
    if (i < 0 || j < 0) this.outside += w;
    else {
      this.counts[i * this.ny + j]! += w;
      this.sumw2[i * this.ny + j]! += w * w;
    }
    return this;
  }
  fillArrays(xs: ArrayLike<number>, ys: ArrayLike<number>, ws?: ArrayLike<number>): this {
    for (let k = 0; k < xs.length; k++) this.fill(xs[k]!, ys[k]!, ws ? ws[k]! : 1);
    return this;
  }
  get(i: number, j: number): number {
    return this.counts[i * this.ny + j]!;
  }
  integral(): number {
    let s = 0;
    for (let k = 0; k < this.counts.length; k++) s += this.counts[k]!;
    return s;
  }
  /** Sum over y (keeping x). */
  projectionX(): Hist1D {
    const h = new Hist1D(this.xedges);
    for (let i = 0; i < this.nx; i++) for (let j = 0; j < this.ny; j++) {
      h.counts[i]! += this.get(i, j);
      h.sumw2[i]! += this.sumw2[i * this.ny + j]!;
    }
    return h;
  }
  /** Sum over x (keeping y). */
  projectionY(): Hist1D {
    const h = new Hist1D(this.yedges);
    for (let i = 0; i < this.nx; i++) for (let j = 0; j < this.ny; j++) {
      h.counts[j]! += this.get(i, j);
      h.sumw2[j]! += this.sumw2[i * this.ny + j]!;
    }
    return h;
  }
  add(o: Hist2D, k = 1): this {
    if (o.counts.length !== this.counts.length) throw new Error('Hist2D.add: different binning');
    for (let i = 0; i < this.counts.length; i++) {
      this.counts[i]! += k * o.counts[i]!;
      this.sumw2[i]! += k * k * o.sumw2[i]!;
    }
    this.outside += k * o.outside;
    this.entries += o.entries;
    return this;
  }
  scale(k: number): this {
    for (let i = 0; i < this.counts.length; i++) {
      this.counts[i]! *= k;
      this.sumw2[i]! *= k * k;
    }
    this.outside *= k;
    return this;
  }
  /** Rows of counts as nested arrays: `[ix][iy]`. */
  toMatrix(): number[][] {
    return Array.from({ length: this.nx }, (_, i) => Array.from({ length: this.ny }, (_, j) => this.get(i, j)));
  }
  clone(): Hist2D {
    const h = new Hist2D(this.xedges, this.yedges);
    h.counts.set(this.counts);
    h.sumw2.set(this.sumw2);
    h.outside = this.outside;
    h.entries = this.entries;
    return h;
  }
}
