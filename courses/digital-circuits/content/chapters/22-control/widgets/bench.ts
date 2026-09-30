/**
 * The control-unit viewer's machine: a gate-level Octet (either control unit, RAM inside the circuit) that
 * knows which step of which instruction it is in, and can be clocked a cycle, an instruction or a program at
 * a time. `ControlUnit.svelte` draws it; nothing here draws anything.
 */
import { OctetMachine, assemble, DECODE_TABLE } from '$lib/sim/cpu/octet';
import type { SubResolver } from '$lib/sim/netlist/connect';
import type { Level } from '../../21-datapath/hardware/hw';
import { CONTROL_LINES, romContents, type ControlLine } from '../../21-datapath/hardware/control-word';
import { irText } from '../../21-datapath/widgets/diagram';
import type { Block, ExplorerState } from '../../21-datapath/widgets/explorer';
import { FLAG_NETS } from '../../21-datapath/hardware/datapath';
import { buildCpu, GateCpu, type ControlKind } from '../hardware/cpu';
import { Microprogram } from './microprogram';

export const STEP_LABELS = ['F1', 'F2', 'D', 'X1', 'X2', 'X3', 'X4', 'X5'] as const;
export const STEP_NAMES = ['fetch: address', 'fetch: read the instruction', 'decode', 'execute 1', 'execute 2', 'execute 3', 'execute 4', 'execute 5'];

export interface Program {
  id: string;
  title: string;
  source: string;
  note: string;
}

/** Small programs for the viewer. Each halts. */
export const PROGRAMS: Program[] = [
  {
    id: 'add',
    title: 'Add',
    note: 'Two loads and an ADD: the ALU group in three micro-steps.',
    source: 'LDI R1, 5\nLDI R2, 9\nADD R1, R2\nHLT\n',
  },
  {
    id: 'loop',
    title: 'Loop',
    note: 'Count down with a conditional jump: the jump step decides between PC ← M[MAR] and PC ← PC + 1.',
    source: 'LDI R0, 3\nLDI R1, 1\nloop:\n  SUB R0, R1\n  JNZ loop\nHLT\n',
  },
  {
    id: 'call',
    title: 'Call',
    note: 'CALL is the longest instruction: eight cycles, with the return address pushed by hand.',
    source: 'LDI R0, 7\nCALL double\nHLT\ndouble:\n  ADD R0, R0\n  RET\n',
  },
  {
    id: 'stack',
    title: 'Stack',
    note: 'PUSH and POP move SP by one and use MAR to reach memory.',
    source: 'LDI R0, 0x2A\nPUSH R0\nLDI R0, 0\nPOP R1\nHLT\n',
  },
  {
    id: 'memory',
    title: 'Memory',
    note: 'A store, a load and a register-indirect load: three ways to name an address.',
    source: 'LDI R0, 0x77\nST [0x80], R0\nLD R1, [0x80]\nLDI R2, 0x80\nLDR R3, [R2]\nHLT\n',
  },
];

export interface BenchState extends ExplorerState {
  step: number;
  /** The micro-program counter (microcoded) or the step counter (hardwired). */
  counter: number;
  halted: boolean;
  cycles: number;
}

export class ControlBench {
  readonly gate: GateCpu;
  readonly mp = new Microprogram();
  private readonly rom: string | undefined;
  private readonly dispatchRom: string | undefined;

  constructor(
    readonly kind: ControlKind,
    o: { level?: Level; resolver?: SubResolver } = {},
  ) {
    const cpu = buildCpu({ control: kind, level: o.level ?? 'parts', memory: 'ram' });
    this.gate = new GateCpu(cpu, { resolver: o.resolver });
    this.rom = cpu.rom;
    this.dispatchRom = cpu.dispatch;
    this.gate.reset();
  }

  /** Copy the ROM contents of a microprogram into the running microcoded machine. Returns a problem if it does not fit. */
  applyMicroprogram(mp: Microprogram): string | undefined {
    if (!this.rom) return undefined;
    let words: number[];
    try {
      words = mp.words();
    } catch (e) {
      return (e as Error).message;
    }
    const e = this.gate.rig.engine;
    e.setParam(this.rom, 'contents', romContents(words));
    e.setParam(this.dispatchRom!, 'contents', romContents(mp.dispatch()));
    return undefined;
  }

  /** Assemble a program into RAM (everything else zero) and reset the CPU. Returns the assembler's complaints, if any. */
  load(source: string): string[] {
    const p = assemble(source);
    const errors = p.diagnostics.filter((d) => d.severity === 'error').map((d) => `line ${d.line}: ${d.message}`);
    if (errors.length) return errors;
    const r = this.gate.rig;
    for (let a = 0; a < 0xf0; a++) r.poke(a, p.image[a] ?? 0);
    this.gate.reset();
    return [];
  }

  reset(): void {
    this.gate.reset();
  }

  /** Which step (0 F1, 1 F2, 2 D, 3… X1…) the machine is about to execute. */
  step(): number {
    const r = this.gate.rig;
    if (this.kind === 'hardwired') return r.word('TS', 3) ?? 0;
    const at = this.mp.locate(r.word('UPC', 6) ?? 0);
    if (!at) return 0;
    return at.routine === 0 ? at.step : at.routine === 1 ? 2 : 3 + at.step;
  }

  lines(): Record<ControlLine, number> {
    return this.gate.lines();
  }

  /** Execute one clock cycle. */
  cycle(): void {
    this.gate.cycle();
  }

  get halted(): boolean {
    return this.gate.halted;
  }

  /** Clock until the next instruction begins (or the machine halts). Returns the cycles clocked. */
  instruction(): number {
    let n = 0;
    do {
      if (this.halted) break;
      this.cycle();
      n++;
    } while (this.step() !== 0 && n < 16 && !this.halted);
    return n;
  }

  /** The instruction being executed, once it has been fetched. */
  instructionText(): string {
    return irText(this.gate.rig.word('IR'));
  }

  /** Cycles the current instruction takes, per the ISA spec. */
  instructionCycles(): number | undefined {
    const ir = this.gate.rig.word('IR');
    return ir === undefined ? undefined : DECODE_TABLE[ir]!.cycles;
  }

  state(): BenchState {
    const r = this.gate.rig;
    const f = (n: string) => r.bit(n) === 1;
    let contention = false;
    for (let i = 0; i < 8; i++) if (r.engine.contended(r.net(`BUS${i}`))) contention = true;
    const mar = r.word('MAR');
    const ok = [FLAG_NETS.Z, FLAG_NETS.C, FLAG_NETS.N, FLAG_NETS.V].every((n) => !Number.isNaN(r.bit(n)));
    return {
      pc: r.word('PC'),
      sp: r.word('SP'),
      mar,
      ir: r.word('IR'),
      a: r.word('A'),
      b: r.word('B'),
      t: r.word('T'),
      r: [0, 1, 2, 3].map((i) => r.word(`R${i}_`)),
      flags: ok ? { z: f(FLAG_NETS.Z), c: f(FLAG_NETS.C), n: f(FLAG_NETS.N), v: f(FLAG_NETS.V) } : undefined,
      bus: r.bits('BUS'),
      busValue: r.word('BUS'),
      contention,
      alu: r.word('ALU_Y'),
      mem: mar === undefined ? undefined : r.peek(mar),
      step: this.step(),
      counter: this.kind === 'hardwired' ? (r.word('TS', 3) ?? 0) : (r.word('UPC', 6) ?? 0),
      halted: this.halted,
      cycles: this.gate.cycles,
    };
  }

  /** Blocks driving and listening now, from the control lines. */
  activity(): { drivers: Block[]; listeners: Block[]; counting: string[] } {
    const l = this.lines();
    const drivers: Block[] = [];
    const src: [ControlLine, Block][] = [['OE_RD', 'RD'], ['OE_RS', 'RS'], ['OE_PC', 'PC'], ['OE_SP', 'SP'], ['OE_ALU', 'ALU'], ['OE_MEM', 'MEM'], ['OE_T', 'T']];
    for (const [n, b] of src) if (l[n]) drivers.push(b);
    const listeners: Block[] = [];
    const dst: [ControlLine, Block][] = [['LD_MAR', 'MAR'], ['LD_IR', 'IR'], ['LD_A', 'A'], ['LD_B', 'B'], ['LD_T', 'T'], ['WE_R', 'RF'], ['PC_LD', 'PC'], ['MEM_WR', 'MEM'], ['LD_FLAGS', 'FLAGS']];
    for (const [n, b] of dst) if (l[n]) listeners.push(b);
    const counting = [l.PC_INC ? 'PC' : '', l.SP_INC ? 'SP+' : '', l.SP_DEC ? 'SP−' : ''].filter(Boolean);
    return { drivers, listeners, counting };
  }
}

/** The interpreter, run to the end of a program, for the "expected" line of the viewer. */
export function referenceResult(source: string): { r: number[]; cycles: number; instructions: number } | undefined {
  const p = assemble(source);
  if (p.diagnostics.some((d) => d.severity === 'error')) return undefined;
  const m = new OctetMachine().load(p);
  m.run(10_000);
  return { r: [...m.r], cycles: m.cycles, instructions: m.steps };
}

export { CONTROL_LINES };
