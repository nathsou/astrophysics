import type { ElementState } from '../../engine';
import type { ParamValue } from '../../netlist/types';
import { blockSizes } from '../../netlist/catalog/blocks';
import { X, bus, control, input, maj4, merge, or4, readBus } from '../logic';
import { registerDigitalModel, type DigitalModel, type DigitalSim, type ModelInit } from '../model';
import { delayOf } from './gates';

/**
 * Building blocks: multiplexers, decoders, encoders, adders, comparators, registers, counters,
 * shift registers, LFSRs and memories. Every output of a block changes `delay` ns after its cause
 * (for clocked blocks, after the rising clock edge). Clocked blocks detect edges like the
 * flip-flops (0 → 1, with detours through X allowed) but do not check set-up and hold times.
 *
 * X handling: combinational blocks give a known output whenever every value the unknown inputs
 * could take agrees (a multiplexer whose selected inputs are equal, an adder's low bits below an
 * unknown bit, a comparator decided by a higher bit). Registers keep an unknown mask per bit.
 *
 * Unconnected (Z) control inputs are inactive: EN reads 1; CLR, LOAD and WE read 0.
 *
 * Power-up: registers, counters and shift registers start at their `init` parameter (default 0),
 * the LFSR at `init` (default 1). RAM starts filled with zeros, and reset() clears it again. ROM
 * holds its `contents` parameter: hexadecimal words separated by commas or spaces, from address 0;
 * missing words are 0.
 *
 * RAM writes synchronously (on the rising edge of CLK while WE is 1) and reads asynchronously (DO
 * always shows the word at A, `delay` ns after A or the word changes). A write with an unknown
 * address is ignored with a warning; unknown data bits are stored as unknown and read back as X.
 *
 * State: `{ value }`, the number on the main output bus (Y, A, S, Q or DO), or undefined while any
 * of its bits is X. The adder adds `carry` (COUT); the comparator `eq`, `lt`, `gt`. RAM and ROM
 * contents are available through DigitalEngine.memory(id), not the state.
 */

function nets(init: ModelInit, names: string[]): Int32Array {
  return Int32Array.from(names.map((n) => {
    const i = init.pin(n);
    if (i < 0) throw new Error(`no pin ${n}`);
    return init.nets[i]!;
  }));
}

function slots(init: ModelInit, names: string[]): Int32Array {
  return Int32Array.from(names.map((n) => {
    const i = init.pin(n);
    if (i < 0 || init.slots[i]! < 0) throw new Error(`no output pin ${n}`);
    return init.slots[i]!;
  }));
}

const names = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/** Drive a bus: bit i is X where `unknown` has bit i set, else bit i of `value`. */
function driveBus(sim: DigitalSim, out: Int32Array, value: number, unknown: number, delay: number): void {
  for (let i = 0; i < out.length; i++) sim.drive(out[i]!, (unknown >>> i) & 1 ? X : (value >>> i) & 1, delay);
}

function busValue(sim: DigitalSim, out: Int32Array): number | undefined {
  let v = 0;
  for (let i = 0; i < out.length; i++) {
    const b = sim.output(out[i]!);
    if (b > 1) return undefined;
    v += b * 2 ** i;
  }
  return v;
}

abstract class Block implements DigitalModel {
  protected delay: number;
  constructor(protected readonly init: ModelInit) {
    this.delay = delayOf(init.element, init.defaultDelay);
  }
  abstract evaluate(sim: DigitalSim): void;
  setParam(_sim: DigitalSim, key: string, _value: ParamValue): void {
    if (key === 'delay') this.delay = delayOf(this.init.element, this.init.defaultDelay);
  }
  /** The main output bus, for state(). */
  protected abstract readonly main: Int32Array;
  state(sim: DigitalSim): ElementState {
    return { value: busValue(sim, this.main) };
  }
}

// ─── Combinational ──────────────────────────────────────────────────────────

class Mux extends Block {
  readonly combinational = true;
  private readonly d: Int32Array;
  private readonly s: Int32Array;
  protected readonly main: Int32Array;
  constructor(init: ModelInit) {
    super(init);
    const k = blockSizes.select(init.element.params);
    this.d = nets(init, names('D', 1 << k));
    this.s = nets(init, names('S', k));
    this.main = slots(init, ['Y']);
  }
  evaluate(sim: DigitalSim): void {
    readBus(sim.nets, this.s, 0, this.s.length);
    const sel = bus.value;
    const unk = bus.unknown;
    let y = -1;
    for (let i = 0; i < this.d.length; i++) {
      if ((i & ~unk) !== sel) continue;
      const v = input(sim.nets[this.d[i]!]!);
      y = y < 0 ? v : merge(y, v);
    }
    sim.drive(this.main[0]!, y, this.delay);
  }
}

class Demux extends Block {
  readonly combinational = true;
  private readonly d: number;
  private readonly s: Int32Array;
  protected readonly main: Int32Array;
  constructor(init: ModelInit) {
    super(init);
    const k = blockSizes.select(init.element.params);
    this.d = nets(init, ['D'])[0]!;
    this.s = nets(init, names('S', k));
    this.main = slots(init, names('Y', 1 << k));
  }
  evaluate(sim: DigitalSim): void {
    readBus(sim.nets, this.s, 0, this.s.length);
    const sel = bus.value;
    const unk = bus.unknown;
    const d = input(sim.nets[this.d]!);
    for (let i = 0; i < this.main.length; i++) {
      const v = (i & ~unk) !== sel ? 0 : unk === 0 ? d : merge(d, 0);
      sim.drive(this.main[i]!, v, this.delay);
    }
  }
}

class Decoder extends Block {
  readonly combinational = true;
  private readonly a: Int32Array;
  private readonly en: number;
  protected readonly main: Int32Array;
  constructor(init: ModelInit) {
    super(init);
    const k = blockSizes.decoderBits(init.element.params);
    this.a = nets(init, names('A', k));
    this.en = nets(init, ['EN'])[0]!;
    this.main = slots(init, names('Y', 1 << k));
  }
  evaluate(sim: DigitalSim): void {
    readBus(sim.nets, this.a, 0, this.a.length);
    const sel = bus.value;
    const unk = bus.unknown;
    const en = control(sim.nets[this.en]!, 1);
    for (let i = 0; i < this.main.length; i++) {
      const match = (i & ~unk) === sel;
      const v = en === 0 || !match ? 0 : en === 1 && unk === 0 ? 1 : X;
      sim.drive(this.main[i]!, v, this.delay);
    }
  }
}

class Encoder extends Block {
  readonly combinational = true;
  private readonly d: Int32Array;
  private readonly v: number;
  protected readonly main: Int32Array;
  constructor(
    init: ModelInit,
    private readonly priority: boolean,
  ) {
    super(init);
    const k = blockSizes.encoderBits(init.element.params);
    this.d = nets(init, names('D', 1 << k));
    this.main = slots(init, names('A', k));
    this.v = slots(init, ['V'])[0]!;
  }
  evaluate(sim: DigitalSim): void {
    const nets = sim.nets;
    if (!this.priority) {
      // Each output bit is the OR of the inputs whose number has that bit set.
      let any = 0;
      for (let j = 0; j < this.main.length; j++) {
        let a = 0;
        for (let i = 0; i < this.d.length; i++) if ((i >> j) & 1) a = or4(a, input(nets[this.d[i]!]!));
        sim.drive(this.main[j]!, a, this.delay);
      }
      for (let i = 0; i < this.d.length; i++) any = or4(any, input(nets[this.d[i]!]!));
      sim.drive(this.v, any, this.delay);
      return;
    }
    // Priority: the highest input at 1 wins; an unknown input above it makes the answer unknown.
    let found = -1;
    let unsure = false;
    for (let i = this.d.length - 1; i >= 0; i--) {
      const v = input(nets[this.d[i]!]!);
      if (v === 1) {
        found = i;
        break;
      }
      if (v === X) unsure = true;
    }
    if (unsure) {
      driveBus(sim, this.main, 0, -1, this.delay);
      sim.drive(this.v, found >= 0 ? 1 : X, this.delay);
    } else {
      driveBus(sim, this.main, Math.max(0, found), 0, this.delay);
      sim.drive(this.v, found >= 0 ? 1 : 0, this.delay);
    }
  }
}

class Adder extends Block {
  readonly combinational = true;
  private readonly a: Int32Array;
  private readonly b: Int32Array;
  private readonly cin: number;
  private readonly cout: number;
  protected readonly main: Int32Array;
  constructor(init: ModelInit) {
    super(init);
    const n = blockSizes.bits(init.element.params);
    this.a = nets(init, names('A', n));
    this.b = nets(init, names('B', n));
    this.cin = nets(init, ['CIN'])[0]!;
    this.main = slots(init, names('S', n));
    this.cout = slots(init, ['COUT'])[0]!;
  }
  evaluate(sim: DigitalSim): void {
    const nets = sim.nets;
    let c = input(nets[this.cin]!);
    for (let i = 0; i < this.main.length; i++) {
      const a = input(nets[this.a[i]!]!);
      const b = input(nets[this.b[i]!]!);
      const s = a > 1 || b > 1 || c > 1 ? X : a ^ b ^ c;
      c = maj4(a, b, c);
      sim.drive(this.main[i]!, s, this.delay);
    }
    sim.drive(this.cout, c, this.delay);
  }
  override state(sim: DigitalSim): ElementState {
    const carry = sim.output(this.cout);
    return { value: busValue(sim, this.main), carry: carry <= 1 ? carry : undefined };
  }
}

class Comparator extends Block {
  readonly combinational = true;
  private readonly a: Int32Array;
  private readonly b: Int32Array;
  protected readonly main: Int32Array;
  constructor(init: ModelInit) {
    super(init);
    const n = blockSizes.bits(init.element.params);
    this.a = nets(init, names('A', n));
    this.b = nets(init, names('B', n));
    this.main = slots(init, ['EQ', 'LT', 'GT']);
  }
  evaluate(sim: DigitalSim): void {
    const nets = sim.nets;
    // From the most significant bit down: the first known difference decides.
    let eq = 1;
    let lt = 0;
    let gt = 0;
    for (let i = this.a.length - 1; i >= 0; i--) {
      const a = input(nets[this.a[i]!]!);
      const b = input(nets[this.b[i]!]!);
      if (a > 1 || b > 1) {
        eq = lt = gt = X;
        break;
      }
      if (a !== b) {
        eq = 0;
        lt = a < b ? 1 : 0;
        gt = a > b ? 1 : 0;
        break;
      }
    }
    sim.drive(this.main[0]!, eq, this.delay);
    sim.drive(this.main[1]!, lt, this.delay);
    sim.drive(this.main[2]!, gt, this.delay);
  }
  override state(sim: DigitalSim): ElementState {
    const [eq, lt, gt] = Array.from(this.main, (s) => sim.output(s));
    return { eq: eq === 1, lt: lt === 1, gt: gt === 1 };
  }
}

// ─── Clocked ────────────────────────────────────────────────────────────────

/** A clocked block holding a word `q` with a mask of unknown bits `qx`. */
abstract class Clocked extends Block {
  protected q = 0;
  protected qx = 0;
  protected lastClk = X;
  protected readonly clk: number;
  protected readonly mask: number;
  constructor(init: ModelInit, bits: number) {
    super(init);
    this.clk = nets(init, ['CLK'])[0]!;
    this.mask = 2 ** bits - 1;
  }
  protected initValue(dflt: number): number {
    const v = Math.round(Number(this.init.element.params.init ?? dflt));
    return Number.isFinite(v) ? (v >>> 0) & this.mask : dflt;
  }
  /** Returns true on a rising edge of CLK. */
  protected edge(nets: Uint8Array): boolean {
    const clk = nets[this.clk]!;
    const rising = clk === 1 && this.lastClk === 0;
    if (clk <= 1) this.lastClk = clk;
    return rising;
  }
  reset(sim: DigitalSim): void {
    this.lastClk = X;
    this.q = this.initValue(0);
    this.qx = 0;
    this.output(sim, 0);
  }
  protected output(sim: DigitalSim, delay: number): void {
    driveBus(sim, this.main, this.q, this.qx, delay);
  }
  override state(): ElementState {
    return { value: this.qx === 0 ? this.q : undefined };
  }
}

class Register extends Clocked {
  private readonly d: Int32Array;
  private readonly en: number;
  private readonly clr: number;
  protected readonly main: Int32Array;
  constructor(init: ModelInit) {
    const n = blockSizes.bits(init.element.params);
    super(init, n);
    this.d = nets(init, names('D', n));
    this.en = nets(init, ['EN'])[0]!;
    this.clr = nets(init, ['CLR'])[0]!;
    this.main = slots(init, names('Q', n));
  }
  evaluate(sim: DigitalSim): void {
    const nets = sim.nets;
    const rising = this.edge(nets);
    const clr = control(nets[this.clr]!, 0);
    if (clr !== 0) {
      // Clearing: bits that are 1 become 0, or unknown if CLR itself is unknown.
      if (clr === 1) this.qx = 0;
      else this.qx |= this.q;
      this.q = 0;
    } else if (rising) {
      const en = control(nets[this.en]!, 1);
      readBus(nets, this.d, 0, this.d.length);
      if (en === 1) {
        this.q = bus.value;
        this.qx = bus.unknown;
      } else if (en !== 0) {
        this.qx = (this.qx | bus.unknown | (bus.value ^ this.q)) & this.mask;
        this.q &= ~this.qx;
      }
    }
    this.output(sim, this.delay);
  }
}

class Counter extends Clocked {
  private readonly en: number;
  private readonly clr: number;
  private readonly load: number;
  private readonly d: Int32Array;
  private readonly co: number;
  protected readonly main: Int32Array;
  constructor(init: ModelInit) {
    const n = blockSizes.bits(init.element.params);
    super(init, n);
    [this.en, this.clr, this.load] = nets(init, ['EN', 'CLR', 'LOAD']) as unknown as [number, number, number];
    this.d = nets(init, names('D', n));
    this.main = slots(init, names('Q', n));
    this.co = slots(init, ['CO'])[0]!;
  }
  evaluate(sim: DigitalSim): void {
    const nets = sim.nets;
    const rising = this.edge(nets);
    const clr = control(nets[this.clr]!, 0);
    const en = control(nets[this.en]!, 1);
    if (clr !== 0) {
      if (clr === 1) this.qx = 0;
      else this.qx |= this.q;
      this.q = 0;
    } else if (rising) {
      const load = control(nets[this.load]!, 0);
      if (load === 1) {
        readBus(nets, this.d, 0, this.d.length);
        this.q = bus.value;
        this.qx = bus.unknown;
      } else if (load !== 0) {
        this.qx = this.mask;
        this.q = 0;
      } else if (en !== 0) {
        if (this.qx !== 0) {
          this.qx = this.mask;
          this.q = 0;
        } else {
          const next = (this.q + 1) % (this.mask + 1);
          if (en === 1) this.q = next;
          else {
            this.qx = (this.q ^ next) & this.mask;
            this.q &= ~this.qx;
          }
        }
      }
    }
    this.output(sim, this.delay);
    const full = this.qx === 0 && this.q === this.mask;
    const co = this.qx !== 0 ? (en === 0 ? 0 : X) : !full || en === 0 ? 0 : en === 1 ? 1 : X;
    sim.drive(this.co, co, this.delay);
  }
  override reset(sim: DigitalSim): void {
    super.reset(sim);
    sim.drive(this.co, 0, 0);
  }
}

class ShiftRegister extends Clocked {
  private readonly si: number;
  private readonly en: number;
  private readonly clr: number;
  private readonly so: number;
  protected readonly main: Int32Array;
  private readonly bits: number;
  constructor(init: ModelInit) {
    const n = blockSizes.bits(init.element.params);
    super(init, n);
    this.bits = n;
    [this.si, this.en, this.clr] = nets(init, ['SI', 'EN', 'CLR']) as unknown as [number, number, number];
    this.main = slots(init, names('Q', n));
    this.so = slots(init, ['SO'])[0]!;
  }
  protected override output(sim: DigitalSim, delay: number): void {
    super.output(sim, delay);
    const top = this.bits - 1;
    sim.drive(this.so, (this.qx >>> top) & 1 ? X : (this.q >>> top) & 1, delay);
  }
  evaluate(sim: DigitalSim): void {
    const nets = sim.nets;
    const rising = this.edge(nets);
    const clr = control(nets[this.clr]!, 0);
    if (clr !== 0) {
      if (clr === 1) this.qx = 0;
      else this.qx |= this.q;
      this.q = 0;
    } else if (rising) {
      const en = control(nets[this.en]!, 1);
      const si = input(nets[this.si]!);
      const q = ((this.q << 1) | (si === 1 ? 1 : 0)) & this.mask;
      const qx = ((this.qx << 1) | (si > 1 ? 1 : 0)) & this.mask;
      if (en === 1) {
        this.q = q;
        this.qx = qx;
      } else if (en !== 0) {
        this.qx = (this.qx | qx | (q ^ this.q)) & this.mask;
        this.q &= ~this.qx;
      }
    }
    this.output(sim, this.delay);
  }
}

class LFSR extends Clocked {
  protected readonly main: Int32Array;
  private taps = 0;
  constructor(init: ModelInit) {
    const n = blockSizes.lfsrBits(init.element.params);
    super(init, n);
    this.main = slots(init, names('Q', n));
    this.readTaps();
  }
  private readTaps(): void {
    this.taps = (Math.round(Number(this.init.element.params.taps ?? 0)) >>> 0) & this.mask;
  }
  override reset(sim: DigitalSim): void {
    this.readTaps();
    super.reset(sim);
    this.q = this.initValue(1);
    this.output(sim, 0);
  }
  override setParam(sim: DigitalSim, key: string, value: ParamValue): void {
    super.setParam(sim, key, value);
    if (key === 'taps') this.readTaps();
  }
  evaluate(sim: DigitalSim): void {
    if (!this.edge(sim.nets)) return;
    if (this.qx === 0) {
      let t = this.q & this.taps;
      let fb = 0;
      while (t) {
        fb ^= t & 1;
        t >>>= 1;
      }
      this.q = ((this.q << 1) | fb) & this.mask;
    }
    this.output(sim, this.delay);
  }
}

// ─── Memories ───────────────────────────────────────────────────────────────

function parseContents(text: string, words: number, dataMask: number, into: Uint8Array | Uint32Array): string[] {
  const bad: string[] = [];
  const parts = text.split(/[\s,]+/).filter((s) => s.length > 0);
  parts.slice(0, words).forEach((p, i) => {
    const v = parseInt(p.replace(/^0x/i, ''), 16);
    if (!/^(0x)?[0-9a-f]+$/i.test(p) || !Number.isFinite(v)) bad.push(p);
    else into[i] = (v & dataMask) >>> 0;
  });
  if (parts.length > words) bad.push(`${parts.length - words} words beyond the last address`);
  return bad;
}

abstract class Memory extends Block {
  protected readonly a: Int32Array;
  protected readonly main: Int32Array;
  protected mem: Uint8Array | Uint32Array;
  protected unknown: Uint8Array | Uint32Array;
  protected readonly dataMask: number;
  constructor(init: ModelInit) {
    super(init);
    const p = init.element.params;
    const ab = blockSizes.addrBits(p);
    const db = blockSizes.dataBits(p);
    this.a = nets(init, names('A', ab));
    this.main = slots(init, names('DO', db));
    this.dataMask = db >= 32 ? 0xffffffff : 2 ** db - 1;
    const Arr = db <= 8 ? Uint8Array : Uint32Array;
    this.mem = new Arr(2 ** ab);
    this.unknown = new Arr(2 ** ab);
  }
  memory(): Uint8Array | Uint32Array {
    return this.mem;
  }
  poke(_sim: DigitalSim, address: number, value: number): void {
    if (!(address >= 0 && address < this.mem.length)) return;
    this.mem[address] = (value & this.dataMask) >>> 0;
    this.unknown[address] = 0;
  }
  /** Drive DO with the word at the current address. */
  protected read(sim: DigitalSim): void {
    readBus(sim.nets, this.a, 0, this.a.length);
    if (bus.unknown !== 0) driveBus(sim, this.main, 0, -1, this.delay);
    else driveBus(sim, this.main, this.mem[bus.value]!, this.unknown[bus.value]!, this.delay);
  }
}

class RAM extends Memory {
  private readonly di: Int32Array;
  private readonly we: number;
  private readonly clk: number;
  private lastClk = X;
  constructor(init: ModelInit) {
    super(init);
    this.di = nets(init, names('DI', this.main.length));
    this.we = nets(init, ['WE'])[0]!;
    this.clk = nets(init, ['CLK'])[0]!;
  }
  reset(): void {
    this.lastClk = X;
    this.mem.fill(0);
    this.unknown.fill(0);
  }
  evaluate(sim: DigitalSim): void {
    const nets = sim.nets;
    const clk = nets[this.clk]!;
    const rising = clk === 1 && this.lastClk === 0;
    if (clk <= 1) this.lastClk = clk;
    if (rising) {
      const we = control(nets[this.we]!, 0);
      if (we !== 0) {
        readBus(nets, this.a, 0, this.a.length);
        if (bus.unknown !== 0) {
          sim.message('warning', `${this.init.element.id}: write to an unknown address ignored (an address input is X or Z).`, this.init.element.id);
        } else {
          const addr = bus.value;
          if (we === 1) {
            readBus(nets, this.di, 0, this.di.length);
            this.mem[addr] = bus.value;
            this.unknown[addr] = bus.unknown;
          } else {
            // Unknown write enable: the word may or may not have been written.
            this.unknown[addr] = this.dataMask;
            this.mem[addr] = 0;
          }
        }
      }
    }
    this.read(sim);
  }
}

class ROM extends Memory {
  private load(sim: DigitalSim): void {
    this.mem.fill(0);
    this.unknown.fill(0);
    const bad = parseContents(String(this.init.element.params.contents ?? ''), this.mem.length, this.dataMask, this.mem);
    if (bad.length) sim.message('warning', `${this.init.element.id}: ignored ${bad.join(', ')} in the contents (hexadecimal words separated by commas).`, this.init.element.id);
  }
  reset(sim: DigitalSim): void {
    this.load(sim);
  }
  override setParam(sim: DigitalSim, key: string, value: ParamValue): void {
    super.setParam(sim, key, value);
    if (key === 'contents') this.load(sim);
  }
  evaluate(sim: DigitalSim): void {
    this.read(sim);
  }
}

registerDigitalModel('mux', (init) => new Mux(init));
registerDigitalModel('demux', (init) => new Demux(init));
registerDigitalModel('decoder', (init) => new Decoder(init));
registerDigitalModel('encoder', (init) => new Encoder(init, false));
registerDigitalModel('priority-encoder', (init) => new Encoder(init, true));
registerDigitalModel('adder', (init) => new Adder(init));
registerDigitalModel('magnitude-comparator', (init) => new Comparator(init));
registerDigitalModel('register', (init) => new Register(init));
registerDigitalModel('counter', (init) => new Counter(init));
registerDigitalModel('shift-register', (init) => new ShiftRegister(init));
registerDigitalModel('lfsr', (init) => new LFSR(init));
registerDigitalModel('ram', (init) => new RAM(init));
registerDigitalModel('rom', (init) => new ROM(init));
