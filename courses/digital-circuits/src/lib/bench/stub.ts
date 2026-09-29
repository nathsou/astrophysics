/**
 * A small stand-in engine for the bench's tests and for the gallery before the real engines exist.
 *
 * Digital kind: an event-driven evaluator for the io parts, rails and gates (inertial delays, 0/1/X/Z
 * with a simple resolution), enough for a half adder or a ring oscillator. Gate outputs start at 0
 * rather than X so rings oscillate. Analog kind: every net at 0 V, no currents; element state
 * mirrors the parameters (switch positions). It is not a simulator; the real ones live in sim/.
 */
import type { Engine, ElementState, EngineMessage, EngineOptions, Recorder } from '../sim/engine';
import type { EngineKind, FlatNetlist, Logic, ParamValue } from '../sim/netlist/types';

const X = 2;
const Z = 3;

const GATES = new Set(['and', 'or', 'nand', 'nor', 'xor', 'xnor', 'not', 'buffer', 'tristate']);

function gateOut(type: string, ins: number[]): number {
  const any = (v: number) => ins.some((x) => x === v);
  const unknown = ins.some((x) => x >= X);
  switch (type) {
    case 'not':
      return ins[0] === 0 ? 1 : ins[0] === 1 ? 0 : X;
    case 'buffer':
      return ins[0]! >= X ? X : ins[0]!;
    case 'and':
    case 'nand': {
      const v = any(0) ? 0 : unknown ? X : 1;
      return type === 'nand' && v < X ? 1 - v : v;
    }
    case 'or':
    case 'nor': {
      const v = any(1) ? 1 : unknown ? X : 0;
      return type === 'nor' && v < X ? 1 - v : v;
    }
    case 'xor':
    case 'xnor': {
      if (unknown) return X;
      const v = ins.reduce((a, b) => a ^ b, 0);
      return type === 'xnor' ? 1 - v : v;
    }
  }
  return X;
}

interface Event {
  t: number;
  el: number;
  value: number;
  version: number;
}

export function createStubEngine(netlist: FlatNetlist, options: EngineOptions & { kind?: EngineKind } = {}): Engine {
  const kind = options.kind ?? 'digital';
  const els = netlist.elements;
  const params = els.map((e) => ({ ...e.params }));
  const index = new Map(els.map((e, i) => [e.id, i]));
  const defaultDelay = options.step ?? 1e-9;

  // Output pin (the pin named Y, or 'v' for rails) of each driving element.
  const outPin = els.map((e) => (e.type === 'rail' ? e.pinNames.indexOf('v') : e.pinNames.indexOf('Y')));
  const drivers: number[][] = Array.from({ length: netlist.netCount }, () => []);
  const readers: number[][] = Array.from({ length: netlist.netCount }, () => []);
  els.forEach((e, i) => {
    if (outPin[i]! >= 0) drivers[e.pins[outPin[i]!]!]!.push(i);
    e.pins.forEach((n, k) => {
      if (k !== outPin[i]) readers[n]!.push(i);
    });
  });

  let time = 0;
  let out = new Uint8Array(els.length);
  let net = new Uint8Array(netlist.netCount);
  let version = new Uint32Array(els.length);
  let queue: Event[] = [];
  const recorders: StubRecorder[] = [];

  const resolve = (n: number) => {
    let v = Z;
    for (const d of drivers[n]!) {
      const o = out[d]!;
      if (o === Z) continue;
      if (v === Z) v = o;
      else if (v !== o) v = X;
    }
    return v;
  };

  const source = (i: number): number | undefined => {
    const e = els[i]!;
    const p = params[i]!;
    switch (e.type) {
      case 'toggle':
        return p.on ? 1 : 0;
      case 'button':
        return p.pressed ? 1 : 0;
      case 'const':
        return Number(p.value) ? 1 : 0;
      case 'rail':
        return Number(p.voltage) > 0 ? 1 : 0;
      case 'clock': {
        const period = 1 / Number(p.frequency || 1);
        const phase = (time % period) / period;
        return phase < Number(p.duty ?? 0.5) ? 1 : 0;
      }
    }
    return undefined;
  };

  const evaluate = (i: number): number => {
    const e = els[i]!;
    if (e.type === 'tristate') {
      const en = net[e.pins[e.pinNames.indexOf('EN')]!]!;
      const a = net[e.pins[e.pinNames.indexOf('A')]!]!;
      return en === 1 ? (a >= X ? X : a) : en === 0 ? Z : X;
    }
    const ins = e.pins.filter((_, k) => k !== outPin[i]).map((n) => net[n]!);
    return gateOut(e.type, ins);
  };

  const schedule = (ev: Event) => {
    // Keep the queue sorted by time (stable for equal times). Small circuits: linear insert is fine.
    let k = queue.length;
    while (k > 0 && queue[k - 1]!.t > ev.t) k--;
    queue.splice(k, 0, ev);
  };

  const setOut = (i: number, v: number) => {
    if (out[i] === v) return;
    out[i] = v;
    const n = els[i]!.pins[outPin[i]!]!;
    const nv = resolve(n);
    if (nv === net[n]) return;
    net[n] = nv;
    for (const r of recorders) r.sample(time, n);
    for (const j of readers[n]!) if (GATES.has(els[j]!.type)) consider(j);
  };

  const consider = (j: number) => {
    const v = evaluate(j);
    const pending = queue.some((q) => q.el === j && q.version === version[j]);
    if (!pending && v === out[j]) return;
    const d = Number(params[j]!.delay ?? NaN);
    const delay = Number.isFinite(d) ? d * 1e-9 : defaultDelay;
    version[j]!++;
    schedule({ t: time + delay, el: j, value: v, version: version[j]! });
  };

  const scheduleClock = (i: number, from: number) => {
    const p = params[i]!;
    const period = 1 / Number(p.frequency || 1);
    const duty = Number(p.duty ?? 0.5);
    const k = Math.floor(from / period);
    const rise = k * period;
    const fall = rise + duty * period;
    const next = from < fall - 1e-18 ? fall : rise + period;
    schedule({ t: next, el: i, value: -1, version: 0 });
  };

  const run = (until: number) => {
    let guard = 0;
    while (queue.length && queue[0]!.t <= until) {
      const ev = queue.shift()!;
      time = Math.max(time, ev.t);
      if (ev.value === -1) {
        setOut(ev.el, source(ev.el)!);
        scheduleClock(ev.el, time + 1e-15);
      } else if (ev.version === version[ev.el]) setOut(ev.el, ev.value);
      if (++guard > 1e6) break;
    }
  };

  const reset = () => {
    time = 0;
    queue = [];
    out = new Uint8Array(els.length);
    net = new Uint8Array(netlist.netCount).fill(Z);
    version = new Uint32Array(els.length);
    if (kind !== 'digital') return;
    for (let n = 0; n < netlist.netCount; n++) net[n] = drivers[n]!.length ? 0 : Z;
    els.forEach((e, i) => {
      const s = source(i);
      if (s !== undefined) setOut(i, s);
      if (e.type === 'clock') scheduleClock(i, 0);
    });
    els.forEach((e, i) => {
      if (GATES.has(e.type)) consider(i);
    });
    run(0);
  };

  const messages: EngineMessage[] = [];

  const engine: Engine = {
    kind,
    netlist,
    get time() {
      return time;
    },
    advance(dt: number) {
      const target = time + Math.max(0, dt);
      if (kind === 'digital') run(target);
      time = target;
    },
    settle() {
      if (kind === 'digital') run(time);
    },
    reset,
    logic(n: number): Logic {
      if (kind !== 'digital') return 0;
      return (net[n] ?? Z) as Logic;
    },
    voltage(n: number) {
      if (kind !== 'digital') return 0;
      const v = net[n];
      return v === 1 ? 5 : v === 0 ? 0 : NaN;
    },
    current() {
      return 0;
    },
    state(id: string): ElementState {
      const i = index.get(id);
      if (i === undefined) return {};
      const e = els[i]!;
      const p = params[i]!;
      const pinv = (k: number) => net[e.pins[k]!] ?? Z;
      switch (e.type) {
        case 'switch':
          return { closed: !!p.closed };
        case 'pushbutton':
          return { closed: !!p.pressed };
        case 'spdt':
          return { throw: Number(p.throw) };
        case 'indicator':
          return { brightness: pinv(0) === 1 ? 1 : 0 };
        case 'seven-seg':
          return { segments: e.pins.reduce((m, _, k) => (pinv(k) === 1 ? m | (1 << k) : m), 0) };
        case 'hex-display': {
          const bits = e.pins.map((_, k) => pinv(k));
          return bits.some((b) => b > 1) ? {} : { value: bits.reduce((m, b, k) => m | (b << k), 0) };
        }
      }
      return {};
    },
    setParam(id: string, key: string, value: ParamValue) {
      const i = index.get(id);
      if (i === undefined) return;
      params[i]![key] = value;
      if (kind !== 'digital') return;
      const s = source(i);
      if (s !== undefined) setOut(i, s);
      run(time);
    },
    watch(nets: number[]): Recorder {
      const r = new StubRecorder(nets, () => time, (n) => net[n] ?? Z);
      recorders.push(r);
      r.sampleAll(time);
      return r;
    },
    messages,
  };
  reset();
  return engine;
}

class StubRecorder implements Recorder {
  private t: number[] = [];
  private v: number[][];
  private closed = false;
  constructor(
    readonly nets: number[],
    private now: () => number,
    private read: (n: number) => number,
  ) {
    this.v = nets.map(() => []);
  }
  sampleAll(t: number) {
    this.t.push(t);
    this.nets.forEach((n, k) => this.v[k]!.push(this.read(n)));
  }
  sample(t: number, net: number) {
    if (this.closed || !this.nets.includes(net)) return;
    this.sampleAll(t);
  }
  times() {
    return Float64Array.from(this.t);
  }
  values() {
    return this.v.map((a) => Float64Array.from(a));
  }
  trim(keep: number) {
    const cut = this.now() - keep;
    let k = 0;
    while (k < this.t.length - 1 && this.t[k + 1]! < cut) k++;
    if (k > 0) {
      this.t.splice(0, k);
      for (const a of this.v) a.splice(0, k);
    }
  }
  close() {
    this.closed = true;
  }
}

