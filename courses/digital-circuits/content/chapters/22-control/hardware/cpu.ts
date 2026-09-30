/**
 * The whole gate-level Octet: the datapath of Chapter 21 and either control unit of Chapter 22, as one
 * circuit on the digital engine, and `GateCpu`, the harness that clocks it.
 *
 * `memory: 'ram'` puts the 256-byte RAM in the circuit (what the widgets show). `memory: 'external'`
 * leaves the memory outside: `GateCpu` then plays the memory system, using an `OctetMachine` as the
 * memory and I/O devices, so that the gate-level CPU sees exactly the loads, stores and device side
 * effects that the reference interpreter's program sees (the differential tests use this).
 */
import { OctetMachine, type OctetState } from '$lib/sim/cpu/octet';
import type { SubResolver } from '$lib/sim/netlist/connect';
import type { DigitalEngineOptions } from '$lib/sim/digital';
import { Hw, type Level } from '../../21-datapath/hardware/hw';
import { addDatapath, FLAG_NETS } from '../../21-datapath/hardware/datapath';
import { CONTROL_LINES, DATAPATH_LINES, referenceLines, type ControlLine } from '../../21-datapath/hardware/control-word';
import { Rig, built, referenceParts, type Built } from '../../21-datapath/hardware/rig';
import { addHardwired, addMicrocoded } from './control-unit';

export type ControlKind = 'hardwired' | 'microcoded';

export interface CpuOptions {
  control: ControlKind;
  level: Level;
  memory: 'ram' | 'external';
  /** Microcode ROM contents (words and the dispatch table), for a modified microprogram. */
  words?: number[];
  dispatch?: number[];
}

export interface BuiltCpu extends Built {
  options: CpuOptions;
  /** Ids of the microcode ROM and the dispatch ROM (microcoded only). */
  rom?: string;
  dispatch?: string;
}

export function buildCpu(o: CpuOptions): BuiltCpu {
  const hw = new Hw(`Octet (${o.control})`, o.level);
  hw.input('CLK');
  hw.input('RST');
  if (o.memory === 'external') hw.inputs('MD', 8);
  addDatapath(hw, { memory: o.memory });
  let ids: { rom?: string; dispatch?: string } = {};
  if (o.control === 'hardwired') addHardwired(hw);
  else ids = addMicrocoded(hw, { words: o.words, dispatch: o.dispatch });
  return { ...built(hw), options: o, ...ids };
}

/** A gate-level Octet, clocked cycle by cycle. */
export class GateCpu {
  readonly rig: Rig;
  /** Half a clock period, in seconds: enough for the longest path (see the tests). */
  readonly half: number;
  /** Clock cycles since reset. */
  cycles = 0;
  private mark = 0;
  readonly memory: OctetMachine | undefined;
  /** The control lines that the last `cycle()` executed. */
  executed: Record<ControlLine, number> = Object.fromEntries(CONTROL_LINES.map((n) => [n, 0])) as Record<ControlLine, number>;

  constructor(
    readonly cpu: BuiltCpu,
    o: { resolver?: SubResolver; memory?: OctetMachine; half?: number; engine?: DigitalEngineOptions } = {},
  ) {
    this.rig = new Rig(cpu, o.resolver ?? referenceParts, o.engine);
    this.half = o.half ?? 100e-9;
    if (cpu.options.memory === 'external') this.memory = o.memory ?? new OctetMachine();
    this.rig.run(this.half);
  }

  /**
   * The reset sequence: RST for one clock edge. Afterwards the sequencer is at its first step, the control lines for the
   * first cycle have settled, and the machine waits for the rising edge that executes them. CLK is low.
   */
  reset(): void {
    const r = this.rig;
    r.set('RST', 1);
    r.run(this.half);
    r.set('CLK', 1);
    r.run(this.half);
    r.set('CLK', 0);
    r.run(this.half);
    r.set('RST', 0);
    r.run(this.half);
    this.cycles = 0;
    this.mark = r.engine.messages.length;
  }

  /** Warnings and errors the engine has reported since the last reset (power-up itself is allowed to be untidy: flip-flops start in random states). */
  problems(): string[] {
    return this.rig.engine.messages.slice(this.mark).filter((m) => m.level !== 'info').map((m) => m.text);
  }

  /**
   * One clock cycle. The control lines for it settled during the last cycle's second half, the bus window is open and the
   * bus carries the transfer; the rising edge makes every register listen (and the memory store); the sequencer steps on
   * and the next cycle's lines settle. With external memory this is also where the memory system reads or writes.
   */
  cycle(): void {
    const r = this.rig;
    if (this.memory) {
      const addr = r.word('MAR');
      if (r.bit('OE_MEM') === 1 && addr !== undefined) {
        r.setWord('MD', this.memory.read(addr));
        r.run(this.half);
      }
      if (r.bit('MEM_WR') === 1 && addr !== undefined) {
        const v = r.word('BUS');
        if (v !== undefined) this.memory.write(addr, v);
      }
    }
    this.executed = this.lines();
    r.set('CLK', 1);
    r.run(this.half);
    r.set('CLK', 0);
    r.run(this.half);
    this.cycles++;
  }

  /** Clock until the machine halts, or `max` cycles have passed. Returns the cycles run. */
  run(max = 1_000_000): number {
    let n = 0;
    while (!this.halted && n < max) {
      this.cycle();
      n++;
    }
    return n;
  }

  get halted(): boolean {
    return this.rig.bit('HALT') === 1;
  }

  /** The control lines now: what the next rising edge will execute. */
  lines(): Record<ControlLine, number> {
    const out = {} as Record<ControlLine, number>;
    for (const n of CONTROL_LINES) out[n] = this.rig.bit(n);
    return out;
  }

  get pc(): number {
    return this.rig.word('PC') ?? NaN;
  }
  get sp(): number {
    return this.rig.word('SP') ?? NaN;
  }
  get ir(): number {
    return this.rig.word('IR') ?? NaN;
  }
  r(i: number): number {
    return this.rig.word(`R${i}_`) ?? NaN;
  }
  flags(): { z: boolean; c: boolean; n: boolean; v: boolean } {
    const f = (n: string) => this.rig.bit(n) === 1;
    return { z: f(FLAG_NETS.Z), c: f(FLAG_NETS.C), n: f(FLAG_NETS.N), v: f(FLAG_NETS.V) };
  }

  /**
   * The state as the interpreter's `OctetState`, for `compareStates`: registers from the circuit,
   * memory and devices from the memory system (external memory only).
   */
  state(): OctetState {
    if (!this.memory) throw new Error('state() needs external memory');
    const s = this.memory.snapshot();
    return {
      ...s,
      pc: this.pc,
      sp: this.sp,
      r: [0, 1, 2, 3].map((i) => this.r(i)),
      flags: this.flags(),
      halted: this.halted,
      cycles: this.cycles,
    };
  }
}

export { DATAPATH_LINES, referenceLines };
