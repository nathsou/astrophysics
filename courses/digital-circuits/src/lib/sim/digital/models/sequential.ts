import type { ElementState } from '../../engine';
import { X, control, input, merge, not4, parseInit } from '../logic';
import { nsToTicks, registerDigitalModel, TICKS_PER_NS, type DigitalModel, type DigitalSim, type ModelInit } from '../model';
import { outputSlot } from './gates';

/**
 * Latches and flip-flops.
 *
 * Power-up: Q takes the `init` parameter ('0' by default, '1', or 'X' for unknown), Q̄ its
 * complement, at t = 0. reset() does the same.
 *
 * Edges: a rising edge is the clock reaching 1 when its last known value was 0; a detour through X
 * or Z in between still counts, and a clock that powers up at X and then goes to 1 does not.
 *
 * Metastability (flip-flops): if a data input (D, J, K, T or EN) changes less than `setup` ns
 * before a rising edge, or less than `hold` ns after it, Q and Q̄ go to X at clock-to-Q and stay
 * there for a random time drawn from an exponential distribution with mean `tau` ns (seeded, so
 * runs repeat), then settle to a random 0 or 1. A warning is posted for the violation and an info
 * message when the output resolves. The SR latch does the same when S and R leave the forbidden
 * state S = R = 1 together (within its delay of each other).
 *
 * Unconnected control inputs read as inactive: EN as 1, CLR as 0.
 *
 * State: `{ value, metastable }` (value undefined while Q is X), plus `q` as a logic value.
 */

const RESOLVE = 1;

const fmtNs = (ticks: number) => `${+(ticks / TICKS_PER_NS).toFixed(3)} ns`;

/** Common parts: Q and Q̄ outputs, metastable resolution. */
abstract class Storage implements DigitalModel {
  protected q = X;
  protected metastable = false;
  protected metaStart = 0;
  protected readonly qSlot: number;
  protected readonly qnSlot: number;
  protected tau = 0;

  constructor(protected readonly init: ModelInit) {
    this.qSlot = outputSlot(init, 'Q');
    this.qnSlot = outputSlot(init, 'Qn');
  }

  protected get id(): string {
    return this.init.element.id;
  }

  protected net(name: string): number {
    const i = this.init.pin(name);
    if (i < 0) throw new Error(`no pin ${name}`);
    return this.init.nets[i]!;
  }

  protected param(key: string, dflt: number): number {
    return nsToTicks(this.init.element.params[key], nsToTicks(dflt));
  }

  protected readParams(): void {
    this.tau = this.param('tau', 1);
  }

  reset(sim: DigitalSim): void {
    this.readParams();
    this.metastable = false;
    this.q = parseInit(this.init.element.params.init, 0);
    if (this.q > X) this.q = X;
    this.setQ(sim, this.q, 0);
  }

  abstract evaluate(sim: DigitalSim): void;

  setParam(): void {
    this.readParams();
  }

  protected setQ(sim: DigitalSim, v: number, delay: number): void {
    this.q = v;
    sim.drive(this.qSlot, v, delay);
    sim.drive(this.qnSlot, not4(v), delay);
  }

  /** Go metastable: X after `delay`, then a random value after a random extra time. */
  protected goMetastable(sim: DigitalSim, delay: number): number {
    this.metastable = true;
    this.metaStart = sim.now + delay;
    this.setQ(sim, X, delay);
    const r = Math.round(-this.tau * Math.log(1 - sim.random()));
    sim.wakeAt(this.init.index, delay + r, RESOLVE);
    return r;
  }

  protected endMetastable(sim: DigitalSim): void {
    if (!this.metastable) return;
    this.metastable = false;
    sim.cancelWake(this.init.index);
  }

  wake(sim: DigitalSim, tag: number): void {
    if (tag !== RESOLVE || !this.metastable) return;
    this.metastable = false;
    const v = sim.random() < 0.5 ? 0 : 1;
    this.setQ(sim, v, 0);
    sim.message('info', `${this.id} left the metastable state after ${fmtNs(sim.now - this.metaStart)}: Q settled to ${v}.`, this.id);
  }

  state(): ElementState {
    return { value: this.q <= 1 ? this.q : undefined, q: this.q, metastable: this.metastable };
  }
}

/** SR latch with NOR semantics (active-high S and R). */
class SRLatch extends Storage {
  private readonly s: number;
  private readonly r: number;
  private delay = 0;
  private forbidden = false;
  private releaseTime = -Infinity;

  constructor(init: ModelInit) {
    super(init);
    this.s = this.net('S');
    this.r = this.net('R');
  }

  protected override readParams(): void {
    super.readParams();
    this.delay = this.param('delay', 1);
  }

  override reset(sim: DigitalSim): void {
    this.forbidden = false;
    this.releaseTime = -Infinity;
    super.reset(sim);
  }

  private out(sim: DigitalSim, q: number, qn: number): void {
    sim.drive(this.qSlot, q, this.delay);
    sim.drive(this.qnSlot, qn, this.delay);
  }

  evaluate(sim: DigitalSim): void {
    const s = input(sim.nets[this.s]!);
    const r = input(sim.nets[this.r]!);
    const now = sim.now;
    if (s === 1 && r === 1) {
      // Forbidden: both NOR outputs are pulled to 0.
      this.endMetastable(sim);
      this.forbidden = true;
      this.q = 0;
      this.out(sim, 0, 0);
      return;
    }
    if (s <= 1 && r <= 1) {
      if (s === 0 && r === 0) {
        const together = this.forbidden || now - this.releaseTime < this.delay;
        this.forbidden = false;
        this.releaseTime = -Infinity;
        if (together) {
          this.goMetastable(sim, this.delay);
          sim.message('info', `${this.id}: S and R were released together from S = R = 1, so the latch has no reason to fall either way. It is metastable and will settle at random.`, this.id);
        } else if (!this.metastable) this.out(sim, this.q, not4(this.q));
        return;
      }
      // Exactly one of S and R is 1.
      this.releaseTime = this.forbidden ? now : -Infinity;
      this.forbidden = false;
      this.endMetastable(sim);
      this.q = s;
      this.out(sim, s, 1 - s);
      return;
    }
    // An input is unknown: every outcome it could lead to must agree, else X.
    this.endMetastable(sim);
    this.forbidden = false;
    this.releaseTime = -Infinity;
    let q = -1;
    let qn = -1;
    for (let ss = 0; ss <= 1; ss++) {
      if (s <= 1 && ss !== s) continue;
      for (let rr = 0; rr <= 1; rr++) {
        if (r <= 1 && rr !== r) continue;
        const a = ss && rr ? 0 : ss ? 1 : rr ? 0 : this.q;
        const b = ss && rr ? 0 : ss ? 0 : rr ? 1 : not4(this.q);
        q = q < 0 ? a : merge(q, a);
        qn = qn < 0 ? b : merge(qn, b);
      }
    }
    this.q = q;
    this.out(sim, q, qn);
  }
}

/** D latch: transparent while EN is 1. */
class DLatch extends Storage {
  private readonly d: number;
  private readonly en: number;
  private delay = 0;

  constructor(init: ModelInit) {
    super(init);
    this.d = this.net('D');
    this.en = this.net('EN');
  }

  protected override readParams(): void {
    super.readParams();
    this.delay = this.param('delay', 1);
  }

  evaluate(sim: DigitalSim): void {
    const en = control(sim.nets[this.en]!, 1);
    const d = input(sim.nets[this.d]!);
    if (en === 1) this.setQ(sim, d, this.delay);
    else if (en !== 0 && d !== this.q) this.setQ(sim, X, this.delay);
  }
}

type FFKind = 'dff' | 'dffr' | 'dffe' | 'jkff' | 'tff';

/** Edge-triggered flip-flops with set-up and hold checking. */
class FlipFlop extends Storage {
  private readonly clk: number;
  /** Data inputs, whose changes are checked against set-up and hold. */
  private readonly data: Int32Array;
  private readonly a: number;
  private readonly b: number;
  private readonly clr: number;
  private clkToQ = 0;
  private setup = 0;
  private hold = 0;
  private lastClk = X;
  private lastData = -1;
  private lastDataChange = -Infinity;
  private lastEdge = -Infinity;

  constructor(
    init: ModelInit,
    private readonly kind: FFKind,
  ) {
    super(init);
    this.clk = this.net('CLK');
    const names = kind === 'jkff' ? ['J', 'K'] : kind === 'tff' ? ['T'] : kind === 'dffe' ? ['D', 'EN'] : ['D'];
    this.data = Int32Array.from(names.map((n) => this.net(n)));
    this.a = this.data[0]!;
    this.b = this.data[1] ?? -1;
    this.clr = kind === 'dffr' ? this.net('CLR') : -1;
  }

  protected override readParams(): void {
    super.readParams();
    this.clkToQ = this.param('clkToQ', 1);
    this.setup = this.param('setup', 0.5);
    this.hold = this.param('hold', 0.2);
  }

  override reset(sim: DigitalSim): void {
    this.lastClk = X;
    this.lastData = -1;
    this.lastDataChange = -Infinity;
    this.lastEdge = -Infinity;
    super.reset(sim);
  }

  private next(nets: Uint8Array): number {
    const q = this.q;
    switch (this.kind) {
      case 'dff':
      case 'dffr':
        return input(nets[this.a]!);
      case 'dffe': {
        const d = input(nets[this.a]!);
        const en = control(nets[this.b]!, 1);
        return en === 1 ? d : en === 0 ? q : merge(d, q);
      }
      case 'tff': {
        const t = input(nets[this.a]!);
        return t === 0 ? q : t === 1 ? not4(q) : merge(q, not4(q));
      }
      case 'jkff': {
        const j = input(nets[this.a]!);
        const k = input(nets[this.b]!);
        let r = -1;
        for (let jj = 0; jj <= 1; jj++) {
          if (j <= 1 && jj !== j) continue;
          for (let kk = 0; kk <= 1; kk++) {
            if (k <= 1 && kk !== k) continue;
            const v = jj && kk ? not4(q) : jj ? 1 : kk ? 0 : q;
            r = r < 0 ? v : merge(r, v);
          }
        }
        return r;
      }
    }
  }

  evaluate(sim: DigitalSim): void {
    const nets = sim.nets;
    const now = sim.now;

    // Data changes: check the hold time of the last edge.
    let sig = 0;
    for (let i = 0; i < this.data.length; i++) sig = sig * 4 + nets[this.data[i]!]!;
    if (sig !== this.lastData) {
      const first = this.lastData < 0;
      this.lastData = sig;
      if (!first) {
        this.lastDataChange = now;
        const clearing = this.clr >= 0 && control(nets[this.clr]!, 0) !== 0;
        if (now - this.lastEdge < this.hold && !clearing) {
          const dt = now - this.lastEdge;
          this.goMetastable(sim, Math.max(0, this.lastEdge + this.clkToQ - now));
          sim.message('warning', `${this.id}: hold time violated. The data input changed ${fmtNs(dt)} after the rising clock edge (hold time ${fmtNs(this.hold)}), so Q is metastable.`, this.id);
        }
      }
    }

    // Asynchronous clear.
    const clk = nets[this.clk]!;
    if (this.clr >= 0) {
      const c = control(nets[this.clr]!, 0);
      if (c !== 0) {
        if (clk <= 1) this.lastClk = clk;
        this.endMetastable(sim);
        this.setQ(sim, c === 1 ? 0 : merge(this.q, 0), this.clkToQ);
        return;
      }
    }

    // Rising edge.
    const rising = clk === 1 && this.lastClk === 0;
    if (clk <= 1) this.lastClk = clk;
    if (!rising) return;
    this.lastEdge = now;
    const since = now - this.lastDataChange;
    if (since < this.setup) {
      this.endMetastable(sim);
      this.goMetastable(sim, this.clkToQ);
      sim.message('warning', `${this.id}: set-up time violated. The data input changed ${fmtNs(since)} before the rising clock edge (set-up time ${fmtNs(this.setup)}), so Q is metastable.`, this.id);
      return;
    }
    this.endMetastable(sim);
    this.setQ(sim, this.next(nets), this.clkToQ);
  }
}

registerDigitalModel('srlatch', (init) => new SRLatch(init));
registerDigitalModel('dlatch', (init) => new DLatch(init));
for (const kind of ['dff', 'dffr', 'dffe', 'jkff', 'tff'] as const) registerDigitalModel(kind, (init) => new FlipFlop(init, kind));
