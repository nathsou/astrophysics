import type { Recorder } from '../engine';
import { TICKS_PER_SECOND } from './model';

/**
 * A trace buffer for the digital engine. It stores one row per change of any watched net: the
 * time and the values of every watched net after the change. Two changes at the same time (a
 * zero-width glitch across delta cycles) give two rows with the same time, so nothing is lost.
 * The first row is the state when watching started (or at the last reset).
 */
export class DigitalRecorder implements Recorder {
  readonly nets: number[];
  /** Per net of the netlist: 1 when this recorder watches it. */
  readonly mask: Uint8Array;
  private t: Float64Array;
  private v: Uint8Array[];
  private count = 0;

  constructor(
    nets: number[],
    netCount: number,
    private readonly now: () => number,
    private readonly onClose: (r: DigitalRecorder) => void,
  ) {
    this.nets = [...nets];
    this.mask = new Uint8Array(netCount);
    for (const n of nets) if (n >= 0 && n < netCount) this.mask[n] = 1;
    this.t = new Float64Array(256);
    this.v = nets.map(() => new Uint8Array(256));
  }

  /** Append a row (time in ticks). */
  push(ticks: number, values: Uint8Array): void {
    if (this.count === this.t.length) {
      const n = this.t.length * 2;
      const t = new Float64Array(n);
      t.set(this.t);
      this.t = t;
      this.v = this.v.map((a) => {
        const b = new Uint8Array(n);
        b.set(a);
        return b;
      });
    }
    const i = this.count++;
    this.t[i] = ticks;
    const nets = this.nets;
    for (let j = 0; j < nets.length; j++) this.v[j]![i] = values[nets[j]!] ?? 3;
  }

  /** Forget every row (after a reset). */
  clear(): void {
    this.count = 0;
  }

  times(): Float64Array {
    const out = new Float64Array(this.count);
    for (let i = 0; i < this.count; i++) out[i] = this.t[i]! / TICKS_PER_SECOND;
    return out;
  }

  values(): Float64Array[] {
    return this.v.map((a) => Float64Array.from(a.subarray(0, this.count)));
  }

  /**
   * Drop rows older than `keepSeconds` before now. The last row before the cut is kept, so the
   * value at the start of the window stays known.
   */
  trim(keepSeconds: number): void {
    const cut = this.now() - keepSeconds * TICKS_PER_SECOND;
    let i = 0;
    while (i < this.count && this.t[i]! < cut) i++;
    const drop = Math.max(0, i - 1);
    if (drop === 0) return;
    this.t.copyWithin(0, drop, this.count);
    for (const a of this.v) a.copyWithin(0, drop, this.count);
    this.count -= drop;
  }

  close(): void {
    this.onClose(this);
  }
}
