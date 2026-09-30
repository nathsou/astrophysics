/**
 * The digital engine's event queue: a binary min-heap over (time, sequence number), stored in
 * parallel typed arrays so pushing and popping never allocate (the arrays double when full).
 * Events at the same time come out in the order they were pushed.
 *
 * An event is a `target` (a driver slot ≥ 0, or ~element for a wake-up), a `value` (a logic value
 * or a wake-up tag) and a `serial` the engine compares with the target's current serial to drop
 * cancelled events lazily.
 */
export class EventQueue {
  size = 0;
  time: Float64Array;
  private seq: Float64Array;
  private target: Int32Array;
  private value: Int32Array;
  private serial: Int32Array;
  private counter = 0;

  /** Fields of the last popped event. */
  pTime = 0;
  pTarget = 0;
  pValue = 0;
  pSerial = 0;

  constructor(capacity = 1024) {
    this.time = new Float64Array(capacity);
    this.seq = new Float64Array(capacity);
    this.target = new Int32Array(capacity);
    this.value = new Int32Array(capacity);
    this.serial = new Int32Array(capacity);
  }

  clear(): void {
    this.size = 0;
    this.counter = 0;
  }

  private grow(): void {
    const n = this.time.length * 2;
    const g = <T extends Float64Array | Int32Array>(a: T, make: (n: number) => T): T => {
      const b = make(n);
      b.set(a);
      return b;
    };
    this.time = g(this.time, (k) => new Float64Array(k));
    this.seq = g(this.seq, (k) => new Float64Array(k));
    this.target = g(this.target, (k) => new Int32Array(k));
    this.value = g(this.value, (k) => new Int32Array(k));
    this.serial = g(this.serial, (k) => new Int32Array(k));
  }

  push(t: number, target: number, value: number, serial: number): void {
    if (this.size === this.time.length) this.grow();
    const time = this.time;
    const seq = this.seq;
    const s = this.counter++;
    // Sift the hole up from the end.
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      const pt = time[p]!;
      if (pt < t || (pt === t && seq[p]! < s)) break;
      this.move(p, i);
      i = p;
    }
    time[i] = t;
    seq[i] = s;
    this.target[i] = target;
    this.value[i] = value;
    this.serial[i] = serial;
  }

  /** Remove the earliest event; its fields are left in pTime, pTarget, pValue, pSerial. */
  pop(): void {
    const time = this.time;
    const seq = this.seq;
    this.pTime = time[0]!;
    this.pTarget = this.target[0]!;
    this.pValue = this.value[0]!;
    this.pSerial = this.serial[0]!;
    const n = --this.size;
    if (n === 0) return;
    // Sift the last element down from the root.
    const t = time[n]!;
    const s = seq[n]!;
    const tg = this.target[n]!;
    const v = this.value[n]!;
    const sr = this.serial[n]!;
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      const r = c + 1;
      if (r < n && (time[r]! < time[c]! || (time[r] === time[c] && seq[r]! < seq[c]!))) c = r;
      const ct = time[c]!;
      if (t < ct || (t === ct && s < seq[c]!)) break;
      this.move(c, i);
      i = c;
    }
    time[i] = t;
    seq[i] = s;
    this.target[i] = tg;
    this.value[i] = v;
    this.serial[i] = sr;
  }

  private move(from: number, to: number): void {
    this.time[to] = this.time[from]!;
    this.seq[to] = this.seq[from]!;
    this.target[to] = this.target[from]!;
    this.value[to] = this.value[from]!;
    this.serial[to] = this.serial[from]!;
  }
}
