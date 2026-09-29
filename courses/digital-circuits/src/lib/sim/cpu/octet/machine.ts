/**
 * The Octet reference interpreter: executes one instruction per `step()`, counting the clock cycles
 * the multi-cycle hardware would take (from `spec.ts`). It is the specification the gate-level CPUs
 * are tested against, and the engine behind the bench's turbo mode.
 *
 * Memory is 256 bytes: RAM at 0x00–0xEF and the board's I/O registers at 0xF0–0xFF (see
 * `OCTET_IO_REGISTERS`). Reads of CONSOLE and RANDOM have side effects (they consume a character or
 * step the LFSR), including when the CPU fetches an instruction from there; `peek()` reads without
 * side effects, for memory views.
 */
import { VirtualBoard, compareOutputs, lfsr8, type BoardHooks, type BoardOutputs } from '../common/board';
import { disassembleAt } from './disassembler';
import { OCTET_CONDITIONS, OCTET_IO, OCTET_MEMORY, type OctetFlags } from './spec';
import type { OctetProgram } from './assembler';

/** Cycles per opcode (and per sub-operation for the stack group), from the spec. */
const CYCLES = {
  hlt: 4,
  mov: 4,
  ldi: 5,
  ld: 6,
  st: 6,
  ldr: 5,
  str: 5,
  push: 6,
  pop: 5,
  call: 8,
  ret: 5,
  alu: 6,
  unary: 5,
  jump: 5,
};

export interface OctetTraceEntry {
  /** Instruction number (0 for the first executed after reset). */
  step: number;
  /** Cycle count before the instruction. */
  cycle: number;
  pc: number;
  bytes: number[];
  text: string;
  /** Cycles the instruction took. */
  cycles: number;
}

/** Everything that defines the machine's state, as plain data. */
export interface OctetState {
  pc: number;
  sp: number;
  r: number[];
  flags: OctetFlags;
  halted: boolean;
  cycles: number;
  steps: number;
  /** RAM, 0x00–0xEF (240 bytes). */
  ram: number[];
  lfsr: number;
  board: BoardOutputs;
}

export type StopReason = 'halted' | 'max-steps' | 'breakpoint' | 'cycles';

export interface RunResult {
  reason: StopReason;
  /** Instructions executed by this call. */
  steps: number;
  /** Cycles taken by this call. */
  cycles: number;
}

export interface OctetMachineOptions {
  /** Device hooks (console, LEDs, …); ignored if `board` is given. */
  hooks?: BoardHooks;
  /** A board to share with a UI. */
  board?: VirtualBoard;
  /** Keep the last `traceLimit` executed instructions in `trace` (default 0: off). */
  traceLimit?: number;
}

export class OctetMachine {
  /** 256 bytes; the I/O region 0xF0–0xFF of this array is unused (see `peek`). */
  readonly memory = new Uint8Array(OCTET_MEMORY.size);
  readonly r = new Uint8Array(4);
  pc: number = OCTET_MEMORY.resetPc;
  sp: number = OCTET_MEMORY.resetSp;
  z = false;
  c = false;
  n = false;
  v = false;
  halted = false;
  /** Clock cycles since reset. */
  cycles = 0;
  /** Instructions executed since reset. */
  steps = 0;
  /** The RANDOM port's LFSR state (never 0). */
  lfsr = 1;
  readonly board: VirtualBoard;
  /** Addresses at which `run` stops before executing (except on its first step). */
  readonly breakpoints = new Set<number>();
  traceLimit: number;
  private traceBuffer: OctetTraceEntry[] = [];

  constructor(options: OctetMachineOptions = {}) {
    this.board = options.board ?? new VirtualBoard(options.hooks, 2);
    this.traceLimit = options.traceLimit ?? 0;
  }

  /** Reset the CPU and the board's outputs; memory keeps its contents unless `clearMemory`. */
  reset(clearMemory = false): void {
    if (clearMemory) this.memory.fill(0);
    this.r.fill(0);
    this.pc = OCTET_MEMORY.resetPc;
    this.sp = OCTET_MEMORY.resetSp;
    this.z = this.c = this.n = this.v = false;
    this.halted = false;
    this.cycles = 0;
    this.steps = 0;
    this.lfsr = 1;
    this.traceBuffer = [];
    this.board.reset();
  }

  /** Clear memory, copy a program image into RAM and reset. */
  load(program: OctetProgram | ArrayLike<number>, at = 0): this {
    const image = 'image' in program ? program.image : program;
    this.memory.fill(0);
    for (let i = 0; i < image.length && at + i < OCTET_MEMORY.ramSize; i++) this.memory[at + i] = image[i]! & 0xff;
    this.reset();
    return this;
  }

  get flags(): OctetFlags {
    return { z: this.z, c: this.c, n: this.n, v: this.v };
  }

  set flags(f: OctetFlags) {
    this.z = f.z;
    this.c = f.c;
    this.n = f.n;
    this.v = f.v;
  }

  /** The executed-instruction trace, oldest first (empty unless `traceLimit` > 0). */
  get trace(): OctetTraceEntry[] {
    return this.traceBuffer.slice(-this.traceLimit);
  }

  // ---- Memory and I/O.

  /** Read a byte as the CPU does (with I/O side effects). */
  read(address: number): number {
    const a = address & 0xff;
    if (a < OCTET_MEMORY.ioBase) return this.memory[a]!;
    const b = this.board;
    switch (a) {
      case OCTET_IO.LEDS:
        return b.leds;
      case OCTET_IO.SWITCHES:
        return b.readSwitches();
      case OCTET_IO.BUTTONS:
        return b.readButtons();
      case OCTET_IO.HEX:
        return b.hex & 0xff;
      case OCTET_IO.CONSOLE:
        return b.readConsole();
      case OCTET_IO.RANDOM:
        if (b.hooks.random) return b.hooks.random() & 0xff;
        this.lfsr = lfsr8(this.lfsr);
        return this.lfsr;
      case OCTET_IO.PWM:
        return b.pwm;
      case OCTET_IO.ADC:
        return b.readAdc();
      default:
        return b.matrix[a - OCTET_IO.MATRIX]!;
    }
  }

  /** Read a byte without side effects (for memory views). */
  peek(address: number): number {
    const a = address & 0xff;
    if (a === OCTET_IO.CONSOLE) return this.board.consoleInput[0] ?? 0;
    if (a === OCTET_IO.RANDOM) return this.lfsr;
    return this.read(a);
  }

  /** Write a byte as the CPU does. */
  write(address: number, value: number): void {
    const a = address & 0xff;
    const v = value & 0xff;
    if (a < OCTET_MEMORY.ioBase) {
      this.memory[a] = v;
      return;
    }
    const b = this.board;
    switch (a) {
      case OCTET_IO.LEDS:
        return b.writeLeds(v);
      case OCTET_IO.SWITCHES:
      case OCTET_IO.BUTTONS:
        return;
      case OCTET_IO.HEX:
        return b.writeHex(v);
      case OCTET_IO.CONSOLE:
        return b.writeConsole(v);
      case OCTET_IO.RANDOM:
        if (v !== 0) this.lfsr = v;
        return;
      case OCTET_IO.PWM:
        return b.writePwm(v);
      case OCTET_IO.DAC:
        return b.writeDac(v);
      default:
        return b.writeMatrix(a - OCTET_IO.MATRIX, v);
    }
  }

  // ---- Execution.

  private fetch(): number {
    const b = this.read(this.pc);
    this.pc = (this.pc + 1) & 0xff;
    return b;
  }

  private zn(r: number): number {
    this.z = r === 0;
    this.n = (r & 0x80) !== 0;
    return r;
  }

  /** Compute an ALU operation (opcodes 8–D), setting all four flags. */
  private alu(op: number, a: number, b: number): number {
    switch (op) {
      case 0x8: {
        const sum = a + b;
        const r = sum & 0xff;
        this.c = sum > 0xff;
        this.v = (~(a ^ b) & (a ^ r) & 0x80) !== 0;
        return this.zn(r);
      }
      case 0x9:
      case 0xd: {
        const r = (a - b) & 0xff;
        this.c = a < b;
        this.v = ((a ^ b) & (a ^ r) & 0x80) !== 0;
        return this.zn(r);
      }
      default: {
        const r = op === 0xa ? a & b : op === 0xb ? a | b : a ^ b;
        this.c = this.v = false;
        return this.zn(r);
      }
    }
  }

  private unary(sub: number, a: number): number {
    switch (sub) {
      case 0: {
        const r = (a << 1) & 0xff;
        this.c = (a & 0x80) !== 0;
        this.v = ((a ^ r) & 0x80) !== 0;
        return this.zn(r);
      }
      case 1:
        this.c = (a & 1) !== 0;
        this.v = false;
        return this.zn(a >> 1);
      case 2:
        this.c = this.v = false;
        return this.zn(~a & 0xff);
      default:
        this.c = a === 0xff;
        this.v = a === 0x7f;
        return this.zn((a + 1) & 0xff);
    }
  }

  /**
   * Execute one instruction. Returns the number of cycles it took (0 if the machine was already
   * halted).
   */
  step(): number {
    if (this.halted) return 0;
    const pc0 = this.pc;
    const cycle0 = this.cycles;
    const ir = this.fetch();
    const op = ir >> 4;
    const d = (ir >> 2) & 3;
    const s = ir & 3;
    const r = this.r;
    let operand = -1;
    let cycles: number;
    switch (op) {
      case 0x0:
        this.halted = true;
        cycles = CYCLES.hlt;
        break;
      case 0x1:
        r[d] = r[s]!;
        cycles = CYCLES.mov;
        break;
      case 0x2:
        r[d] = operand = this.fetch();
        cycles = CYCLES.ldi;
        break;
      case 0x3:
        operand = this.fetch();
        r[d] = this.read(operand);
        cycles = CYCLES.ld;
        break;
      case 0x4:
        operand = this.fetch();
        this.write(operand, r[d]!);
        cycles = CYCLES.st;
        break;
      case 0x5:
        r[d] = this.read(r[s]!);
        cycles = CYCLES.ldr;
        break;
      case 0x6:
        this.write(r[d]!, r[s]!);
        cycles = CYCLES.str;
        break;
      case 0x7:
        switch (s) {
          case 0:
            this.sp = (this.sp - 1) & 0xff;
            this.write(this.sp, r[d]!);
            cycles = CYCLES.push;
            break;
          case 1:
            r[d] = this.read(this.sp);
            this.sp = (this.sp + 1) & 0xff;
            cycles = CYCLES.pop;
            break;
          case 2:
            operand = this.fetch();
            this.sp = (this.sp - 1) & 0xff;
            this.write(this.sp, this.pc);
            this.pc = operand;
            cycles = CYCLES.call;
            break;
          default:
            this.pc = this.read(this.sp);
            this.sp = (this.sp + 1) & 0xff;
            cycles = CYCLES.ret;
        }
        break;
      case 0xd:
        this.alu(op, r[d]!, r[s]!);
        cycles = CYCLES.alu;
        break;
      case 0xe:
        r[d] = this.unary(s, r[d]!);
        cycles = CYCLES.unary;
        break;
      case 0xf:
        operand = this.fetch();
        if (OCTET_CONDITIONS[ir & 0xf]!.test(this)) this.pc = operand;
        cycles = CYCLES.jump;
        break;
      default:
        // 0x8–0xC: ADD, SUB, AND, OR, XOR.
        r[d] = this.alu(op, r[d]!, r[s]!);
        cycles = CYCLES.alu;
    }
    this.cycles += cycles;
    this.steps++;
    if (this.traceLimit > 0) {
      const bytes = operand >= 0 ? [ir, operand] : [ir];
      const text = disassembleAt(bytes.length === 2 ? bytes : [ir, 0], 0).text;
      this.traceBuffer.push({ step: this.steps - 1, cycle: cycle0, pc: pc0, bytes, text, cycles });
      if (this.traceBuffer.length > 2 * this.traceLimit) this.traceBuffer.splice(0, this.traceBuffer.length - this.traceLimit);
    }
    return cycles;
  }

  /** Run until HLT, a breakpoint, or `maxSteps` instructions. */
  run(maxSteps = 1_000_000): RunResult {
    const c0 = this.cycles;
    let n = 0;
    while (!this.halted && n < maxSteps) {
      if (n > 0 && this.breakpoints.size && this.breakpoints.has(this.pc))
        return { reason: 'breakpoint', steps: n, cycles: this.cycles - c0 };
      this.step();
      n++;
    }
    return { reason: this.halted ? 'halted' : 'max-steps', steps: n, cycles: this.cycles - c0 };
  }

  /** Run whole instructions until at least `cycles` more clock cycles have passed (or a halt). */
  runCycles(cycles: number): RunResult {
    const c0 = this.cycles;
    const target = c0 + cycles;
    let n = 0;
    while (!this.halted && this.cycles < target) {
      if (n > 0 && this.breakpoints.size && this.breakpoints.has(this.pc))
        return { reason: 'breakpoint', steps: n, cycles: this.cycles - c0 };
      this.step();
      n++;
    }
    return { reason: this.halted ? 'halted' : 'cycles', steps: n, cycles: this.cycles - c0 };
  }

  /** Run until the PC reaches `address` (before executing it), a halt, or `maxSteps`. */
  runUntil(address: number, maxSteps = 1_000_000): RunResult {
    const c0 = this.cycles;
    let n = 0;
    while (!this.halted && n < maxSteps) {
      this.step();
      n++;
      if (this.pc === address) return { reason: 'breakpoint', steps: n, cycles: this.cycles - c0 };
    }
    return { reason: this.halted ? 'halted' : 'max-steps', steps: n, cycles: this.cycles - c0 };
  }

  snapshot(): OctetState {
    return {
      pc: this.pc,
      sp: this.sp,
      r: [...this.r],
      flags: this.flags,
      halted: this.halted,
      cycles: this.cycles,
      steps: this.steps,
      ram: [...this.memory.subarray(0, OCTET_MEMORY.ramSize)],
      lfsr: this.lfsr,
      board: this.board.outputs(),
    };
  }

  /** Restore a snapshot (the board's outputs are restored without calling hooks). */
  restore(state: OctetState): void {
    this.pc = state.pc;
    this.sp = state.sp;
    this.r.set(state.r);
    this.flags = state.flags;
    this.halted = state.halted;
    this.cycles = state.cycles;
    this.steps = state.steps;
    this.memory.fill(0);
    this.memory.set(state.ram);
    this.lfsr = state.lfsr;
    const b = this.board;
    b.leds = state.board.leds;
    b.hex = state.board.hex;
    b.matrix.set(state.board.matrix);
    b.pwm = state.board.pwm;
    b.dac = state.board.dac;
    b.consoleOutput.length = 0;
    b.consoleOutput.push(...state.board.console);
  }
}

export interface CompareOptions {
  /** Compare cycle and instruction counts too (default false). */
  timing?: boolean;
  /** Compare RAM (default true). */
  memory?: boolean;
  /** Compare the board outputs and the LFSR (default true). */
  io?: boolean;
  /** Stop listing memory differences after this many (default 16). */
  maxMemoryDifferences?: number;
}

/**
 * Compare two Octet states (for differential testing of a gate-level or DCL CPU against the
 * interpreter). Returns human-readable differences; an empty list means the states agree.
 */
export function compareStates(a: OctetState, b: OctetState, options: CompareOptions = {}): string[] {
  const out: string[] = [];
  const h = (x: number) => '0x' + x.toString(16).toUpperCase().padStart(2, '0');
  if (a.pc !== b.pc) out.push(`pc: ${h(a.pc)} ≠ ${h(b.pc)}`);
  if (a.sp !== b.sp) out.push(`sp: ${h(a.sp)} ≠ ${h(b.sp)}`);
  for (let i = 0; i < 4; i++) if (a.r[i] !== b.r[i]) out.push(`R${i}: ${h(a.r[i]!)} ≠ ${h(b.r[i]!)}`);
  for (const f of ['z', 'c', 'n', 'v'] as const) {
    if (a.flags[f] !== b.flags[f]) out.push(`flag ${f.toUpperCase()}: ${+a.flags[f]} ≠ ${+b.flags[f]}`);
  }
  if (a.halted !== b.halted) out.push(`halted: ${a.halted} ≠ ${b.halted}`);
  if (options.timing) {
    if (a.cycles !== b.cycles) out.push(`cycles: ${a.cycles} ≠ ${b.cycles}`);
    if (a.steps !== b.steps) out.push(`steps: ${a.steps} ≠ ${b.steps}`);
  }
  if (options.memory !== false) {
    const max = options.maxMemoryDifferences ?? 16;
    let count = 0;
    for (let i = 0; i < Math.max(a.ram.length, b.ram.length); i++) {
      if (a.ram[i] !== b.ram[i]) {
        if (count++ < max) out.push(`M[${h(i)}]: ${h(a.ram[i] ?? 0)} ≠ ${h(b.ram[i] ?? 0)}`);
      }
    }
    if (count > max) out.push(`… and ${count - max} more memory differences`);
  }
  if (options.io !== false) {
    if (a.lfsr !== b.lfsr) out.push(`lfsr: ${h(a.lfsr)} ≠ ${h(b.lfsr)}`);
    out.push(...compareOutputs(a.board, b.board));
  }
  return out;
}
