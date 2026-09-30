/**
 * Run from bits: the configured device simulated on the digital engine from its **decoded bitstream**
 * (`decodeBitstream`), not from the source. The virtual board's switches, buttons and reset drive input pads,
 * the clock button pulses the clock pad, and LEDs and digits read output pads. A second run of the design on the
 * RTL simulator, fed the same inputs, gives the "logic view agrees with the device" indicator.
 */
import { createRtlSim, type RtlSim } from '../../hdl/rtlsim';
import type { RtlDesign, RtlModule } from '../../hdl/rtl';
import { createDigitalEngine, type DigitalEngine } from '../../sim/digital';
import type { FlatElement } from '../../sim/netlist/types';
import { decodeBitstream, attachTestbench, type DecodedFabric } from '../../pld/fpga/decode';
import type { VFpgaDevice } from '../../pld/devices/vfpga';
import { boardOutputs, bindBoard, inputLevel, type BoardBinding, type BoardInputs, type BoardOutputs, type BoardPort, type Level } from './board';
import type { FpgaPort } from './types';

const level = (v: number): Level => (v === 0 ? 0 : v === 1 ? 1 : 'x');

/** The top module of an elaborated design (its ports, for the board binding and the RTL simulator). */
export function topModule(design: RtlDesign | RtlModule): RtlModule {
  return 'modules' in design ? design.modules[design.top]! : design;
}

export function boardPorts(design: RtlDesign | RtlModule): BoardPort[] {
  const m = topModule(design);
  return [
    ...m.inputs.map((p) => ({ name: p.name, dir: 'in' as const, width: p.width, clock: p.clock })),
    ...m.outputs.map((p) => ({ name: p.name, dir: 'out' as const, width: p.width, clock: false })),
  ];
}

export interface FabricSimOptions {
  ports: FpgaPort[];
  binding: BoardBinding;
  design?: RtlDesign | RtlModule;
  /** The design's critical path (ns): the clock's half period is a few times this, so the fabric always settles. */
  periodNs?: number;
}

export interface Comparison {
  /** Output bits on which the device and the RTL simulator disagree. */
  mismatches: string[];
  checked: number;
}

export class FabricSim {
  readonly decoded: DecodedFabric;
  readonly engine: DigitalEngine;
  readonly rtl: RtlSim | undefined;
  /** Clock edges since power-up. */
  cycles = 0;
  /** Simulated device time, seconds. */
  time = 0;
  private readonly padOf = new Map<string, string>();
  private readonly outNet = new Map<string, number>();
  private readonly elements = new Map<string, FlatElement>();
  private readonly half: number;
  private readonly clockPad: string | undefined;
  private readonly rtlInputs: { name: string; width: number; bits: string[] }[] = [];
  private readonly rtlOutputs: { name: string; width: number }[] = [];
  private latch = [0, 0, 0, 0];
  private applied = new Map<string, boolean>();
  private clockLevel = false;
  /** Digest for the board: last inputs. */
  private last: BoardInputs | undefined;

  constructor(
    readonly device: VFpgaDevice,
    bits: Uint8Array,
    readonly opts: FabricSimOptions,
  ) {
    this.decoded = decodeBitstream(device, bits);
    for (const p of opts.ports) this.padOf.set(p.name, p.pad);
    const inputPads = opts.ports.filter((p) => p.dir === 'in' && this.decoded.fabric.padNets.has(p.pad)).map((p) => p.pad);
    attachTestbench(this.decoded, inputPads);
    for (const p of opts.ports) if (p.dir === 'out') {
      const n = this.decoded.fabric.padNets.get(p.pad);
      if (n !== undefined) this.outNet.set(p.name, n);
    }
    this.clockPad = opts.ports.find((p) => p.clock && this.decoded.fabric.padNets.has(p.pad))?.pad;
    this.half = Math.max(100, 3 * (opts.periodNs ?? 0)) * 1e-9;
    this.engine = createDigitalEngine(this.decoded, { powerUp: 'x' });
    for (const e of this.decoded.elements) this.elements.set(e.id, e);
    if (opts.design) {
      const m = topModule(opts.design);
      this.rtl = createRtlSim(opts.design);
      for (const p of m.inputs) if (!p.clock) this.rtlInputs.push({ name: p.name, width: p.width, bits: Array.from({ length: p.width }, (_, i) => (p.width > 1 ? `${p.name}[${i}]` : p.name)) });
      for (const p of m.outputs) this.rtlOutputs.push({ name: p.name, width: p.width });
    }
    this.engine.advance(this.half);
    this.time = this.engine.time;
  }

  private drive(portName: string, on: boolean): void {
    const pad = this.padOf.get(portName);
    if (!pad || !this.decoded.fabric.padNets.has(pad)) return;
    if (this.applied.get(pad) === on) return;
    this.applied.set(pad, on);
    this.engine.setParam(`TB:${pad}`, 'on', on);
  }

  /** Applies the board's inputs (not the clock) to the input pads and, for the comparison, to the RTL simulator. */
  setInputs(inputs: BoardInputs): void {
    this.last = inputs;
    const levels = new Map<string, boolean>();
    for (const b of this.opts.binding.bound) {
      const v = inputLevel(b, inputs);
      if (v !== undefined) levels.set(b.port, v);
    }
    for (const [name, v] of Object.entries(inputs.free)) levels.set(name, v);
    for (const p of this.opts.ports) if (p.dir === 'in' && !p.clock) this.drive(p.name, levels.get(p.name) ?? false);
    if (this.rtl) for (const p of this.rtlInputs) this.rtl.set(p.name, p.bits.reduce((v, b, i) => v | (levels.get(b) ? 1 << i : 0), 0));
    this.engine.advance(this.half);
    this.time = this.engine.time;
  }

  /** One full clock cycle: rising edge, settle, falling edge, settle. */
  clock(): void {
    if (this.clockPad) {
      this.engine.setParam(`TB:${this.clockPad}`, 'on', true);
      this.clockLevel = true;
      this.engine.advance(this.half);
      this.engine.setParam(`TB:${this.clockPad}`, 'on', false);
      this.clockLevel = false;
      this.engine.advance(this.half);
    } else this.engine.advance(2 * this.half);
    this.rtl?.tick();
    this.cycles++;
    this.time = this.engine.time;
    this.sampleDisplay();
  }

  /** Power-up: every flip-flop to its initial value, inputs as they are. */
  powerUp(): void {
    this.engine.reset();
    this.applied.clear();
    this.rtl?.reset();
    this.cycles = 0;
    this.latch = [0, 0, 0, 0];
    if (this.last) this.setInputs(this.last);
    else this.engine.advance(this.half);
    this.time = this.engine.time;
  }

  get clockHigh(): boolean {
    return this.clockLevel;
  }

  /** The level of an output port bit by the name the flow gives it. */
  output(bitName: string): Level {
    const n = this.outNet.get(bitName);
    if (n === undefined) return 'x';
    return level(this.engine.logic(this.decoded.alias?.[n] ?? n));
  }

  private sampleDisplay(): void {
    // A multiplexed display: remember what each digit showed while its select was on.
    this.latch = boardOutputs(this.opts.binding, (b) => this.output(b), this.latch).digits;
  }

  board(): BoardOutputs {
    return boardOutputs(this.opts.binding, (b) => this.output(b), this.latch);
  }

  /** The level of a routing node (through the net the decoder gave it), for colouring wires. */
  nodeLevel(node: number): Level | 'z' | undefined {
    const n = this.decoded.fabric.nodeNet[node]!;
    if (n < 0) return undefined;
    const v = this.engine.logic(this.decoded.alias?.[n] ?? n);
    return v === 0 ? 0 : v === 1 ? 1 : v === 3 ? 'z' : 'x';
  }

  /** The LUT row a cell is reading (I0 + 2·I1 + …), or −1 if an input is unknown, and its output. */
  cellState(x: number, y: number, k: number): { row: number; out: Level; ff: Level | undefined } | undefined {
    const lut = this.elements.get(`LC(${x},${y},${k})/lut`);
    if (!lut) return undefined;
    let row = 0;
    for (let i = 0; i < 4; i++) {
      const net = lut.pins[lut.pinNames.indexOf(`I${i}`)]!;
      const v = this.engine.logic(this.decoded.alias?.[net] ?? net);
      if (v === 1) row |= 1 << i;
      else if (v !== 0) row = -1;
      if (row < 0) break;
    }
    const outNet = lut.pins[lut.pinNames.indexOf('O')]!;
    const ff = this.elements.get(`LC(${x},${y},${k})/ff`);
    let ffLevel: Level | undefined;
    if (ff) {
      const q = ff.pins[ff.pinNames.indexOf('Q')]!;
      ffLevel = level(this.engine.logic(this.decoded.alias?.[q] ?? q));
    }
    return { row, out: level(this.engine.logic(this.decoded.alias?.[outNet] ?? outNet)), ff: ffLevel };
  }

  /** Compares the device's outputs with the RTL simulator's. */
  compare(): Comparison {
    if (!this.rtl) return { mismatches: [], checked: 0 };
    const mismatches: string[] = [];
    let checked = 0;
    for (const p of this.rtlOutputs) {
      const want = this.rtl.getBig(p.name);
      for (let i = 0; i < p.width; i++) {
        const name = p.width > 1 ? `${p.name}[${i}]` : p.name;
        if (!this.outNet.has(name)) continue;
        checked++;
        const got = this.output(name);
        if (got !== Number((want >> BigInt(i)) & 1n)) mismatches.push(name);
      }
    }
    return { mismatches, checked };
  }
}

export { bindBoard };
