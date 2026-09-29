/**
 * Digital-engine models of the fabric primitives. Importing this module registers them with the engine.
 * They are not in the component catalog: only `decodeBitstream` creates these elements, so the bench never offers
 * them.
 *
 * | type | pins | parameters | behaviour |
 * |---|---|---|---|
 * | `fpga-lut4` | I0…I3 → O | `truth` (16 bits), `delay` (ns) | O = truth[I0 + 2·I1 + 4·I2 + 8·I3]; an unknown or floating input only makes O unknown if the table depends on it |
 * | `fpga-dff` | D, CLK, CE, SR → Q | `negClk`, `ceEn`, `srEn`, `srVal`, `srAsync`, `init`, `tcq` (ns) | edge-triggered; synchronous set/reset has priority over the enable; asynchronous set/reset acts at once |
 * | `fpga-carry` | I1, I2, CIN → COUT | `delayData`, `delayCin` (ns) | COUT = MAJ(I1, I2, CIN) |
 * | `fpga-mux` | A → Y | `delay` (ns), `sel`, `inputs` | a routing multiplexer after decoding: only the selected input is connected; passes 0, 1, X and Z |
 * | `fpga-pad` | PAD, IN, OUT | `mode` (`in`/`out`), `pullup`, `delayIn`, `delayOut` | in: IN follows PAD (a floating pad with a pull-up reads 1, else X); out: PAD and IN follow OUT |
 * | `fpga-bram` | RADDR0…10, WADDR0…10, WDATA0…15, RE, WE, RCLK, WCLK → RDATA0…15 | `mode`, `asyncRead`, `contents` (hex words), `tcq`, `tasync` (ns) | dual-port RAM; read before write on the same edge; unconnected data and address pins read 0, an unconnected RE reads 1 |
 *
 * Element states (`engine.state(id)`): LUT `{ value, truth }`, flip-flop `{ value, q }`, block RAM `{ value }` of the
 * last word read.
 */
import type { ElementState } from '../../sim/engine';
import type { FlatElement } from '../../sim/netlist/types';
import { registerDigitalModel, nsToTicks, type DigitalModel, type DigitalSim, type ModelInit, type PinDir } from '../../sim/digital';
import { control, input, maj4 } from '../../sim/digital';

const X = 2;

export const FPGA_TYPES = ['fpga-lut4', 'fpga-dff', 'fpga-carry', 'fpga-mux', 'fpga-pad', 'fpga-bram'] as const;

const ns = (v: unknown, dflt: number): number => nsToTicks(v, nsToTicks(dflt));
const truthy = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';

function outSlot(init: ModelInit, name: string): number {
  const i = init.pin(name);
  if (i < 0 || init.slots[i]! < 0) throw new Error(`no output pin ${name}`);
  return init.slots[i]!;
}
function inNet(init: ModelInit, name: string): number {
  const i = init.pin(name);
  return i < 0 ? -1 : init.nets[i]!;
}

class Lut4 implements DigitalModel {
  readonly combinational = true;
  private readonly ins: Int32Array;
  private readonly out: number;
  private truth = 0;
  private delay = 0;
  constructor(private readonly init: ModelInit) {
    this.ins = Int32Array.from([0, 1, 2, 3].map((i) => inNet(init, `I${i}`)));
    this.out = outSlot(init, 'O');
    this.read();
  }
  private read(): void {
    this.truth = Number(this.init.element.params.truth ?? 0) & 0xffff;
    this.delay = ns(this.init.element.params.delay, 0.5);
  }
  setParam(): void {
    this.read();
  }
  evaluate(sim: DigitalSim): void {
    let idx = 0;
    let unk = 0;
    for (let i = 0; i < 4; i++) {
      const v = this.ins[i]! >= 0 ? sim.nets[this.ins[i]!]! : 3;
      if (v === 1) idx |= 1 << i;
      else if (v !== 0) unk |= 1 << i;
    }
    let out: number;
    if (unk === 0) out = (this.truth >> idx) & 1;
    else {
      let first = -1;
      out = 0;
      for (let s = unk; ; s = (s - 1) & unk) {
        const b = (this.truth >> (idx | s)) & 1;
        if (first < 0) first = b;
        else if (b !== first) {
          out = X;
          break;
        }
        if (s === 0) break;
      }
      if (out !== X) out = first;
    }
    sim.drive(this.out, out, this.delay);
  }
  state(sim: DigitalSim): ElementState {
    const v = sim.output(this.out);
    return { value: v, truth: this.truth };
  }
}

class Dff implements DigitalModel {
  private q = 0;
  private lastClk = X;
  private neg = false;
  private ceEn = false;
  private srEn = false;
  private srVal = 0;
  private srAsync = false;
  private tcq = 0;
  private readonly d: number;
  private readonly clk: number;
  private readonly ce: number;
  private readonly sr: number;
  private readonly out: number;
  constructor(private readonly init: ModelInit) {
    this.d = inNet(init, 'D');
    this.clk = inNet(init, 'CLK');
    this.ce = inNet(init, 'CE');
    this.sr = inNet(init, 'SR');
    this.out = outSlot(init, 'Q');
    this.read();
  }
  private read(): void {
    const p = this.init.element.params;
    this.neg = truthy(p.negClk);
    this.ceEn = truthy(p.ceEn);
    this.srEn = truthy(p.srEn);
    this.srVal = truthy(p.srVal) ? 1 : 0;
    this.srAsync = truthy(p.srAsync);
    this.tcq = ns(p.tcq, 0.3);
  }
  reset(sim: DigitalSim): void {
    this.read();
    this.q = truthy(this.init.element.params.init) ? 1 : 0;
    this.lastClk = X;
    sim.drive(this.out, this.q, 0);
  }
  setParam(): void {
    this.read();
  }
  private set(sim: DigitalSim, v: number, delay: number): void {
    this.q = v;
    sim.drive(this.out, v, delay);
  }
  evaluate(sim: DigitalSim): void {
    const nets = sim.nets;
    let clk = this.clk >= 0 ? nets[this.clk]! : X;
    if (clk > 1) clk = X;
    else if (this.neg) clk = 1 - clk;
    const srv = this.srEn && this.sr >= 0 ? control(nets[this.sr]!, 0) : 0;
    if (this.srEn && this.srAsync) {
      if (srv === 1) {
        if (this.q !== this.srVal) this.set(sim, this.srVal, this.tcq);
        if (clk <= 1) this.lastClk = clk;
        return;
      }
      if (srv > 1 && this.q !== this.srVal) this.set(sim, X, this.tcq);
    }
    const rising = clk === 1 && this.lastClk === 0;
    if (clk <= 1) this.lastClk = clk;
    if (!rising) return;
    // Next value from D and the enable.
    const d = this.d >= 0 ? input(nets[this.d]!) : X;
    let next = d;
    if (this.ceEn) {
      const ce = this.ce >= 0 ? control(nets[this.ce]!, 0) : 0;
      if (ce === 0) next = this.q;
      else if (ce !== 1) next = d === this.q ? d : X;
    }
    if (this.srEn && !this.srAsync) {
      if (srv === 1) next = this.srVal;
      else if (srv > 1) next = next === this.srVal ? next : X;
    }
    if (next !== this.q) this.set(sim, next, this.tcq);
  }
  state(): ElementState {
    return { value: this.q <= 1 ? this.q : undefined, q: this.q };
  }
}

class Carry implements DigitalModel {
  readonly combinational = true;
  private readonly a: number;
  private readonly b: number;
  private readonly c: number;
  private readonly out: number;
  private readonly dData: number;
  private readonly dCin: number;
  private pa = X;
  private pb = X;
  constructor(init: ModelInit) {
    this.a = inNet(init, 'I1');
    this.b = inNet(init, 'I2');
    this.c = inNet(init, 'CIN');
    this.out = outSlot(init, 'COUT');
    this.dData = ns(init.element.params.delayData, 0.3);
    this.dCin = ns(init.element.params.delayCin, 0.1);
  }
  evaluate(sim: DigitalSim): void {
    const a = this.a >= 0 ? sim.nets[this.a]! : 3;
    const b = this.b >= 0 ? sim.nets[this.b]! : 3;
    const c = this.c >= 0 ? sim.nets[this.c]! : 3;
    const dataChanged = a !== this.pa || b !== this.pb;
    this.pa = a;
    this.pb = b;
    sim.drive(this.out, maj4(input(a), input(b), input(c)), dataChanged ? this.dData : this.dCin);
  }
}

class RoutingMux implements DigitalModel {
  readonly combinational = true;
  private readonly a: number;
  private readonly out: number;
  private delay: number;
  constructor(private readonly init: ModelInit) {
    this.a = inNet(init, 'A');
    this.out = outSlot(init, 'Y');
    this.delay = ns(init.element.params.delay, 0.1);
  }
  setParam(): void {
    this.delay = ns(this.init.element.params.delay, 0.1);
  }
  evaluate(sim: DigitalSim): void {
    sim.drive(this.out, this.a >= 0 ? sim.nets[this.a]! : 3, this.delay);
  }
}

class Pad implements DigitalModel {
  readonly combinational = true;
  private readonly pad: number;
  private readonly outNet: number;
  private readonly inSlot: number;
  private readonly padSlot: number;
  private readonly isOut: boolean;
  private readonly pullup: boolean;
  private readonly dIn: number;
  private readonly dOut: number;
  constructor(init: ModelInit) {
    const p = init.element.params;
    this.isOut = p.mode === 'out';
    this.pullup = truthy(p.pullup);
    this.pad = inNet(init, 'PAD');
    this.outNet = inNet(init, 'OUT');
    this.inSlot = outSlot(init, 'IN');
    this.padSlot = this.isOut ? outSlot(init, 'PAD') : -1;
    this.dIn = ns(p.delayIn, 0.5);
    this.dOut = ns(p.delayOut, 0.8);
  }
  evaluate(sim: DigitalSim): void {
    if (this.isOut) {
      const v = this.outNet >= 0 ? input(sim.nets[this.outNet]!) : X;
      sim.drive(this.padSlot, v, this.dOut);
      sim.drive(this.inSlot, v, this.dIn);
    } else {
      let v = sim.nets[this.pad]!;
      if (v === 3) v = this.pullup ? 1 : X;
      sim.drive(this.inSlot, v, this.dIn);
    }
  }
}

const WIDTHS = [16, 8, 4, 2];

class Bram implements DigitalModel {
  private mem = new Uint32Array(256);
  private width = 16;
  private depth = 256;
  private async = false;
  private tcq = 0;
  private tasync = 0;
  private lastR = X;
  private lastW = X;
  private last = 0;
  private readonly raddr: Int32Array;
  private readonly waddr: Int32Array;
  private readonly wdata: Int32Array;
  private readonly re: number;
  private readonly we: number;
  private readonly rclk: number;
  private readonly wclk: number;
  private readonly outs: Int32Array;
  constructor(private readonly init: ModelInit) {
    const pins = (prefix: string, n: number) => Int32Array.from({ length: n }, (_, i) => inNet(init, `${prefix}${i}`));
    this.raddr = pins('RADDR', 11);
    this.waddr = pins('WADDR', 11);
    this.wdata = pins('WDATA', 16);
    this.re = inNet(init, 'RE');
    this.we = inNet(init, 'WE');
    this.rclk = inNet(init, 'RCLK');
    this.wclk = inNet(init, 'WCLK');
    this.outs = Int32Array.from({ length: 16 }, (_, i) => outSlot(init, `RDATA${i}`));
    this.load();
  }
  private load(): void {
    const p = this.init.element.params;
    const mode = Math.max(0, Math.min(3, Number(p.mode ?? 0) | 0));
    this.width = WIDTHS[mode]!;
    this.depth = 4096 / this.width;
    this.async = truthy(p.asyncRead);
    this.tcq = ns(p.tcq, 1.2);
    this.tasync = ns(p.tasync, 1.5);
    this.mem = new Uint32Array(this.depth);
    const words = String(p.contents ?? '').split(',');
    for (let i = 0; i < this.depth && i < words.length; i++) this.mem[i] = parseInt(words[i]!, 16) || 0;
  }
  reset(sim: DigitalSim): void {
    this.load();
    this.lastR = X;
    this.lastW = X;
    this.last = 0;
    for (let i = 0; i < 16; i++) sim.drive(this.outs[i]!, i < this.width ? 0 : 0, 0);
  }
  memory(): Uint32Array {
    return this.mem;
  }
  poke(_sim: DigitalSim, address: number, value: number): void {
    if (address >= 0 && address < this.depth) this.mem[address] = value & (2 ** this.width - 1);
  }
  /** Address from pins; −1 when unknown. Floating pins read 0. */
  private addr(nets: Uint8Array, pins: Int32Array): number {
    const bits = Math.log2(this.depth);
    let a = 0;
    for (let i = 0; i < bits; i++) {
      const v = pins[i]! >= 0 ? nets[pins[i]!]! : 3;
      if (v === 1) a |= 1 << i;
      else if (v === X) return -1;
    }
    return a;
  }
  private drive(sim: DigitalSim, word: number, delay: number): void {
    for (let i = 0; i < 16; i++) {
      const v = i < this.width ? (word < 0 ? X : (this.mem[word]! >> i) & 1) : 0;
      sim.drive(this.outs[i]!, v, delay);
    }
  }
  evaluate(sim: DigitalSim): void {
    const nets = sim.nets;
    const rclk = this.rclk >= 0 ? nets[this.rclk]! : X;
    const wclk = this.wclk >= 0 ? nets[this.wclk]! : X;
    const rRise = rclk === 1 && this.lastR === 0;
    const wRise = wclk === 1 && this.lastW === 0;
    if (rclk <= 1) this.lastR = rclk;
    if (wclk <= 1) this.lastW = wclk;
    const re = this.re >= 0 ? control(nets[this.re]!, 1) : 1;
    if (this.async) {
      // The read is combinational; a write edge changes the word it reads.
      if (wRise) this.write(nets);
      if (re !== 0) this.drive(sim, this.addr(nets, this.raddr), this.tasync);
      return;
    }
    if (rRise && re !== 0) {
      this.last = this.addr(nets, this.raddr);
      this.drive(sim, re === 1 ? this.last : -1, this.tcq);
    }
    if (wRise) this.write(nets);
  }
  private write(nets: Uint8Array): void {
    const we = this.we >= 0 ? control(nets[this.we]!, 0) : 0;
    if (we !== 1) return;
    const a = this.addr(nets, this.waddr);
    if (a < 0) return;
    let w = 0;
    for (let i = 0; i < this.width; i++) {
      const v = this.wdata[i]! >= 0 ? nets[this.wdata[i]!]! : 3;
      if (v === 1) w |= 1 << i;
    }
    this.mem[a] = w;
  }
  state(): ElementState {
    return { value: this.last >= 0 ? this.mem[this.last] : undefined };
  }
}

const dirs =
  (spec: (el: FlatElement, name: string) => PinDir) =>
  (el: FlatElement): PinDir[] =>
    el.pinNames.map((n) => spec(el, n));

registerDigitalModel('fpga-lut4', (init) => new Lut4(init), { pinDirs: dirs((_, n) => (n === 'O' ? 'out' : 'in')) });
registerDigitalModel('fpga-dff', (init) => new Dff(init), { pinDirs: dirs((_, n) => (n === 'Q' ? 'out' : 'in')) });
registerDigitalModel('fpga-carry', (init) => new Carry(init), { pinDirs: dirs((_, n) => (n === 'COUT' ? 'out' : 'in')) });
registerDigitalModel('fpga-mux', (init) => new RoutingMux(init), { pinDirs: dirs((_, n) => (n === 'Y' ? 'out' : 'in')) });
registerDigitalModel('fpga-pad', (init) => new Pad(init), {
  pinDirs: dirs((el, n) => (n === 'IN' ? 'out' : n === 'PAD' ? (el.params.mode === 'out' ? 'out' : 'in') : 'in')),
});
registerDigitalModel('fpga-bram', (init) => new Bram(init), { pinDirs: dirs((_, n) => (n.startsWith('RDATA') ? 'out' : 'in')) });
