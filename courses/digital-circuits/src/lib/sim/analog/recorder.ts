import type { Recorder } from '../engine';

/**
 * Samples of some nets at every accepted time point, in growable typed arrays. `trim` drops old
 * samples by moving a start offset; the arrays are compacted when more than half is dead.
 */
export class SampleRecorder implements Recorder {
  readonly nets: number[];
  private t: Float64Array;
  private v: Float64Array[];
  private start = 0;
  private end = 0;
  private closed = false;

  constructor(
    nets: number[],
    private readonly now: () => number,
    private readonly onClose: (r: SampleRecorder) => void,
  ) {
    this.nets = [...nets];
    this.t = new Float64Array(256);
    this.v = this.nets.map(() => new Float64Array(256));
  }

  push(time: number, value: (net: number) => number): void {
    if (this.closed) return;
    if (this.end === this.t.length) this.grow();
    this.t[this.end] = time;
    for (let i = 0; i < this.nets.length; i++) this.v[i]![this.end] = value(this.nets[i]!);
    this.end++;
  }

  private grow(): void {
    const live = this.end - this.start;
    const cap = live * 2 > this.t.length ? this.t.length * 2 : this.t.length;
    const move = (a: Float64Array) => {
      const b = new Float64Array(cap);
      b.set(a.subarray(this.start, this.end));
      return b;
    };
    this.t = move(this.t);
    this.v = this.v.map(move);
    this.end = live;
    this.start = 0;
  }

  clear(): void {
    this.start = 0;
    this.end = 0;
  }

  times(): Float64Array {
    return this.t.slice(this.start, this.end);
  }

  values(): Float64Array[] {
    return this.v.map((a) => a.slice(this.start, this.end));
  }

  trim(keepSeconds: number): void {
    const cutoff = this.now() - keepSeconds;
    let lo = this.start;
    let hi = this.end;
    // First sample at or after the cutoff.
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.t[mid]! < cutoff) lo = mid + 1;
      else hi = mid;
    }
    this.start = lo;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onClose(this);
  }
}
