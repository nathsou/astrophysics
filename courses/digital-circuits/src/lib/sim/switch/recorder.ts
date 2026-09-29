import type { Recorder } from '../engine';

/** Simulated time unit of the switch-level engine: 1 tick = 1 ps. */
export const TICKS_PER_SECOND = 1e12;

/**
 * A trace buffer for the switch-level engine: one row per change of any watched net (the time and
 * the logic value of every watched net after the change). Several rows may share a time (settling
 * rounds at one instant), so short glitches are kept. The first row is the state when watching
 * started (or at the last reset).
 */
export class SwitchRecorder implements Recorder {
  readonly nets: number[];
  private t: Float64Array;
  private v: Uint8Array[];
  private count = 0;

  constructor(
    nets: number[],
    private readonly now: () => number,
    private readonly onClose: (r: SwitchRecorder) => void,
  ) {
    this.nets = [...nets];
    this.t = new Float64Array(256);
    this.v = nets.map(() => new Uint8Array(256));
  }

  /** Append a row: `ticks` is the time, `read(net)` the logic value of a net. */
  push(ticks: number, read: (net: number) => number): void {
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
    for (let j = 0; j < this.nets.length; j++) this.v[j]![i] = read(this.nets[j]!);
  }

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

  /** Drop rows older than `keepSeconds` before now, keeping the last row before the cut. */
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
