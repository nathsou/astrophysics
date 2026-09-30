/**
 * The RV32I reference interpreter: executes one instruction per `step()`, counting the clock cycles
 * of the reference core, two per instruction (`RV32_TIMING` in `spec.ts`). It is the specification the DCL
 * core is tested against, and the engine behind the ISA-level turbo mode.
 *
 * Memory is RAM at 0 (64 KiB by default) and the board's I/O block at 0xFFFF_FF00 (see `board.ts`).
 * Everything else is a fault. Loads and stores must be naturally aligned, and so must jump targets.
 *
 * **Traps.** Anything the core cannot execute is reported and stops the machine, with the PC still
 * pointing at the offending instruction and no register or memory change: an illegal instruction,
 * a misaligned or faulting access, a jump to a misaligned target, `ecall` and `ebreak`. The trap is
 * kept in `trap`, logged on the board (`board.traps`) and passed to the `onTrap` option, whose
 * handler can resume after an `ecall` or `ebreak` by returning true (the PC then moves on to the
 * next instruction), which is how a host provides system calls.
 */
import { compareOutputs, type BoardOutputs } from '../common/board';
import { RV32_MEMORY, RV32_TRAP_CODES, Rv32Board, Rv32Io, trapMessage, type Rv32BoardHooks, type Rv32Trap, type Rv32TrapCause } from './board';
import { disassembleWord } from './disassembler';
import { RV32_TIMING } from './spec';
import type { Rv32Program } from './assembler';

export interface Rv32TraceEntry {
  /** Instruction number (0 for the first executed after reset). */
  step: number;
  /** Cycle count before the instruction. */
  cycle: number;
  pc: number;
  word: number;
  text: string;
  /** Cycles the instruction took. */
  cycles: number;
}

/** Everything that defines the machine's state, as plain data. */
export interface Rv32State {
  pc: number;
  /** x0–x31 as unsigned 32-bit numbers. */
  x: number[];
  halted: boolean;
  trap?: Rv32Trap;
  cycles: number;
  steps: number;
  ram: Uint8Array;
  lfsr: number;
  board: BoardOutputs;
}

export type Rv32StopReason = 'trap' | 'max-steps' | 'breakpoint' | 'cycles';

export interface Rv32RunResult {
  reason: Rv32StopReason;
  /** Instructions executed by this call. */
  steps: number;
  /** Cycles taken by this call. */
  cycles: number;
}

export interface Rv32MachineOptions {
  /** RAM size in bytes, a multiple of 4 (default 64 KiB). */
  ramSize?: number;
  /** Device hooks (console, LEDs, traps, …); ignored if `board` is given. */
  hooks?: Rv32BoardHooks;
  /** A board to share with a UI. */
  board?: Rv32Board;
  /** Keep the last `traceLimit` executed instructions in `trace` (default 0: off). */
  traceLimit?: number;
  /**
   * Called when a trap is taken. Return true to resume after an `ecall` or `ebreak` (the PC moves
   * to the next instruction); any other trap stops the machine whatever is returned.
   */
  onTrap?: (trap: Rv32Trap, machine: Rv32Machine) => boolean | void;
}

const IO_BASE = RV32_MEMORY.ioBase;

export class Rv32Machine {
  /** The registers as signed 32-bit values; x0 is always 0. Use `reg(n)` for the unsigned value. */
  readonly x = new Int32Array(32);
  pc: number = RV32_MEMORY.resetPc;
  /** Set when a trap stopped the machine. */
  halted = false;
  trap: Rv32Trap | undefined;
  /** Clock cycles since reset. */
  cycles = 0;
  /** Instructions retired since reset. */
  steps = 0;
  readonly memory: Uint8Array;
  readonly ramSize: number;
  readonly board: Rv32Board;
  readonly io: Rv32Io;
  /** Where `reset()` puts the PC (a loaded program's `_start`, else 0). */
  entry: number = RV32_MEMORY.resetPc;
  /** Addresses at which `run` stops before executing (except on its first step). */
  readonly breakpoints = new Set<number>();
  traceLimit: number;
  onTrap: Rv32MachineOptions['onTrap'];
  private traceBuffer: Rv32TraceEntry[] = [];
  /** Set by the memory accessors when an access fails. */
  private fault: Rv32TrapCause | undefined;

  constructor(options: Rv32MachineOptions = {}) {
    this.ramSize = options.ramSize ?? RV32_MEMORY.ramSize;
    if (!Number.isInteger(this.ramSize) || this.ramSize <= 0 || this.ramSize % 4 !== 0 || this.ramSize > 0x8000_0000)
      throw new RangeError('ramSize must be a positive multiple of 4');
    this.memory = new Uint8Array(this.ramSize);
    this.board = options.board ?? new Rv32Board(options.hooks);
    this.io = new Rv32Io(this.board);
    this.traceLimit = options.traceLimit ?? 0;
    this.onTrap = options.onTrap;
  }

  /** Reset the CPU and the board's outputs; memory keeps its contents unless `clearMemory`. */
  reset(clearMemory = false): void {
    if (clearMemory) this.memory.fill(0);
    this.x.fill(0);
    this.pc = this.entry;
    this.halted = false;
    this.trap = undefined;
    this.cycles = 0;
    this.steps = 0;
    this.io.reset();
    this.traceBuffer = [];
    this.board.reset();
  }

  /** Clear memory, copy a program image into RAM and reset (the PC starts at `_start` if there is one). */
  load(program: Rv32Program | ArrayLike<number>, at = 0): this {
    const image = 'image' in program ? program.image : program;
    if (at + image.length > this.ramSize) throw new RangeError(`the program (${image.length} bytes at ${at}) does not fit in ${this.ramSize} bytes of RAM`);
    this.memory.fill(0);
    this.memory.set(Array.from(image, (b) => b & 0xff), at);
    this.entry = 'image' in program ? program.entry : at;
    this.reset();
    return this;
  }

  /** The unsigned value of register `n`. */
  reg(n: number): number {
    return this.x[n & 31]! >>> 0;
  }

  setReg(n: number, value: number): void {
    if (n & 31) this.x[n & 31] = value;
  }

  /** The executed-instruction trace, oldest first (empty unless `traceLimit` > 0). */
  get trace(): Rv32TraceEntry[] {
    return this.traceBuffer.slice(-this.traceLimit);
  }

  // ---- Memory and I/O.

  /**
   * Read `size` (1, 2 or 4) bytes as the CPU does, unsigned. On a misaligned or unmapped address it
   * returns 0 and records the fault in `this.fault`.
   */
  private loadBytes(address: number, size: number): number {
    const a = address >>> 0;
    if (a & (size - 1)) {
      this.fault = 'load-misaligned';
      return 0;
    }
    if (a + size <= this.ramSize) {
      const m = this.memory;
      if (size === 4) return (m[a]! | (m[a + 1]! << 8) | (m[a + 2]! << 16) | (m[a + 3]! << 24)) >>> 0;
      if (size === 2) return m[a]! | (m[a + 1]! << 8);
      return m[a]!;
    }
    if (a >= IO_BASE && Rv32Io.mapped(a - IO_BASE, size)) return this.io.read(a - IO_BASE, size, this.cycles);
    this.fault = 'load-access-fault';
    return 0;
  }

  private storeBytes(address: number, size: number, value: number): void {
    const a = address >>> 0;
    if (a & (size - 1)) {
      this.fault = 'store-misaligned';
      return;
    }
    if (a + size <= this.ramSize) {
      const m = this.memory;
      m[a] = value;
      if (size > 1) m[a + 1] = value >>> 8;
      if (size > 2) {
        m[a + 2] = value >>> 16;
        m[a + 3] = value >>> 24;
      }
      return;
    }
    if (a >= IO_BASE && Rv32Io.mapped(a - IO_BASE, size)) {
      this.io.write(a - IO_BASE, size, value);
      return;
    }
    this.fault = 'store-access-fault';
  }

  /** Read a word without side effects (for memory views and tests); undefined if unmapped or misaligned. */
  peekWord(address: number): number | undefined {
    const a = address >>> 0;
    if (a & 3) return undefined;
    if (a + 4 <= this.ramSize) return (this.memory[a]! | (this.memory[a + 1]! << 8) | (this.memory[a + 2]! << 16) | (this.memory[a + 3]! << 24)) >>> 0;
    if (a >= IO_BASE && Rv32Io.mapped(a - IO_BASE, 4)) return this.io.read(a - IO_BASE, 4, this.cycles, false);
    return undefined;
  }

  /** Read a byte, halfword or word as a program would (with I/O side effects); for tests. */
  read(address: number, size: 1 | 2 | 4 = 4): number {
    this.fault = undefined;
    const v = this.loadBytes(address, size);
    if (this.fault) throw new RangeError(`read of ${size} bytes at 0x${(address >>> 0).toString(16)}: ${this.fault}`);
    return v;
  }

  /** Write a byte, halfword or word as a program would; for tests. */
  write(address: number, value: number, size: 1 | 2 | 4 = 4): void {
    this.fault = undefined;
    this.storeBytes(address, size, value);
    if (this.fault) throw new RangeError(`write of ${size} bytes at 0x${(address >>> 0).toString(16)}: ${this.fault}`);
  }

  // ---- Execution.

  private takeTrap(cause: Rv32TrapCause, pc: number, value: number): number {
    const before = this.cycles;
    const trap: Rv32Trap = {
      cause,
      code: RV32_TRAP_CODES[cause],
      pc,
      value: value >>> 0,
      message: trapMessage(cause, pc, value),
      cycle: this.cycles,
    };
    this.cycles += RV32_TIMING.trap;
    this.trap = trap;
    this.halted = true;
    this.board.reportTrap(trap);
    if (this.onTrap?.(trap, this) === true && (cause === 'ecall' || cause === 'breakpoint')) this.resume();
    return this.cycles - before;
  }

  /** After an `ecall` or `ebreak` trap: continue with the next instruction (the execute cycle the trap stopped short of is then clocked, so the instruction has taken its two cycles). */
  resume(): void {
    if (!this.trap || (this.trap.cause !== 'ecall' && this.trap.cause !== 'breakpoint')) throw new Error('resume() is only possible after ecall or ebreak');
    this.pc = (this.trap.pc + 4) >>> 0;
    this.trap = undefined;
    this.halted = false;
    this.steps++;
    this.cycles += RV32_TIMING.instruction - RV32_TIMING.trap;
  }

  /**
   * Execute one instruction. Returns the number of cycles it took (0 if the machine was halted by
   * a trap and not resumed).
   */
  step(): number {
    if (this.halted) return 0;
    const pc = this.pc;
    const x = this.x;
    // Fetch.
    if (pc & 3) return this.takeTrap('instruction-misaligned', pc, pc);
    if (pc + 4 > this.ramSize) return this.takeTrap('instruction-access-fault', pc, pc);
    const m = this.memory;
    const w = m[pc]! | (m[pc + 1]! << 8) | (m[pc + 2]! << 16) | (m[pc + 3]! << 24);
    const rd = (w >> 7) & 31;
    const f3 = (w >> 12) & 7;
    const rs1 = (w >> 15) & 31;
    const rs2 = (w >> 20) & 31;
    const f7 = (w >>> 25) & 0x7f;
    const a = x[rs1]!;
    const b = x[rs2]!;
    let next = (pc + 4) >>> 0;
    const cycles: number = RV32_TIMING.instruction;
    let result = 0;
    let write = false;
    const illegal = () => this.takeTrap('illegal-instruction', pc, w);

    switch (w & 0x7f) {
      case 0x37: // lui
        result = w & 0xfffff000;
        write = true;
        break;
      case 0x17: // auipc
        result = (pc + (w & 0xfffff000)) | 0;
        write = true;
        break;
      case 0x6f: {
        // jal
        const t = (pc + (((w >> 31) << 20) | (w & 0xff000) | (((w >> 20) & 1) << 11) | (((w >> 21) & 0x3ff) << 1))) >>> 0;
        if (t & 3) return this.takeTrap('instruction-misaligned', pc, t);
        result = next;
        write = true;
        next = t;
        break;
      }
      case 0x67: {
        // jalr
        if (f3 !== 0) return illegal();
        const t = ((a + (w >> 20)) & ~1) >>> 0;
        if (t & 3) return this.takeTrap('instruction-misaligned', pc, t);
        result = next;
        write = true;
        next = t;
        break;
      }
      case 0x63: {
        // branches
        let taken: boolean;
        switch (f3) {
          case 0:
            taken = a === b;
            break;
          case 1:
            taken = a !== b;
            break;
          case 4:
            taken = a < b;
            break;
          case 5:
            taken = a >= b;
            break;
          case 6:
            taken = a >>> 0 < b >>> 0;
            break;
          case 7:
            taken = a >>> 0 >= b >>> 0;
            break;
          default:
            return illegal();
        }
        if (taken) {
          const t = (pc + (((w >> 31) << 12) | (((w >> 7) & 1) << 11) | (((w >> 25) & 0x3f) << 5) | (((w >> 8) & 0xf) << 1))) >>> 0;
          if (t & 3) return this.takeTrap('instruction-misaligned', pc, t);
          next = t;
        }
        break;
      }
      case 0x03: {
        // loads
        const addr = (a + (w >> 20)) >>> 0;
        let size: number;
        switch (f3) {
          case 0:
          case 4:
            size = 1;
            break;
          case 1:
          case 5:
            size = 2;
            break;
          case 2:
            size = 4;
            break;
          default:
            return illegal();
        }
        this.fault = undefined;
        const v = this.loadBytes(addr, size);
        if (this.fault) return this.takeTrap(this.fault, pc, addr);
        result = f3 === 0 ? (v << 24) >> 24 : f3 === 1 ? (v << 16) >> 16 : v;
        write = true;
        break;
      }
      case 0x23: {
        // stores
        if (f3 > 2) return illegal();
        const addr = (a + (((w >> 25) << 5) | ((w >> 7) & 0x1f))) >>> 0;
        this.fault = undefined;
        this.storeBytes(addr, 1 << f3, b);
        if (this.fault) return this.takeTrap(this.fault, pc, addr);
        break;
      }
      case 0x13: {
        // register–immediate
        const imm = w >> 20;
        write = true;
        switch (f3) {
          case 0:
            result = a + imm;
            break;
          case 1:
            if (f7 !== 0) return illegal();
            result = a << rs2;
            break;
          case 2:
            result = a < imm ? 1 : 0;
            break;
          case 3:
            result = a >>> 0 < imm >>> 0 ? 1 : 0;
            break;
          case 4:
            result = a ^ imm;
            break;
          case 5:
            if (f7 === 0) result = a >>> rs2;
            else if (f7 === 0x20) result = a >> rs2;
            else return illegal();
            break;
          case 6:
            result = a | imm;
            break;
          default:
            result = a & imm;
        }
        break;
      }
      case 0x33: {
        // register–register
        write = true;
        if (f7 === 0x00) {
          switch (f3) {
            case 0:
              result = a + b;
              break;
            case 1:
              result = a << (b & 31);
              break;
            case 2:
              result = a < b ? 1 : 0;
              break;
            case 3:
              result = a >>> 0 < b >>> 0 ? 1 : 0;
              break;
            case 4:
              result = a ^ b;
              break;
            case 5:
              result = a >>> (b & 31);
              break;
            case 6:
              result = a | b;
              break;
            default:
              result = a & b;
          }
        } else if (f7 === 0x20 && f3 === 0) result = a - b;
        else if (f7 === 0x20 && f3 === 5) result = a >> (b & 31);
        else return illegal();
        break;
      }
      case 0x0f: // fence
        if (f3 !== 0 || rd !== 0 || rs1 !== 0 || w >>> 28 !== 0) return illegal();
        break;
      case 0x73:
        if (w === 0x00000073) return this.takeTrap('ecall', pc, 0);
        if (w === 0x00100073) return this.takeTrap('breakpoint', pc, 0);
        return illegal();
      default:
        return illegal();
    }

    if (write && rd) x[rd] = result;
    if (this.traceLimit > 0) {
      const text = disassembleWord(w, pc).text;
      this.traceBuffer.push({ step: this.steps, cycle: this.cycles, pc, word: w >>> 0, text, cycles });
      if (this.traceBuffer.length > 2 * this.traceLimit) this.traceBuffer.splice(0, this.traceBuffer.length - this.traceLimit);
    }
    this.pc = next;
    this.cycles += cycles;
    this.steps++;
    return cycles;
  }

  /** Run until a trap (including `ebreak`), a breakpoint, or `maxSteps` instructions. */
  run(maxSteps = 1_000_000): Rv32RunResult {
    const c0 = this.cycles;
    let n = 0;
    while (!this.halted && n < maxSteps) {
      if (n > 0 && this.breakpoints.size && this.breakpoints.has(this.pc)) return { reason: 'breakpoint', steps: n, cycles: this.cycles - c0 };
      this.step();
      n++;
    }
    return { reason: this.halted ? 'trap' : 'max-steps', steps: n, cycles: this.cycles - c0 };
  }

  /** Run whole instructions until at least `cycles` more clock cycles have passed (or a trap). */
  runCycles(cycles: number): Rv32RunResult {
    const c0 = this.cycles;
    const target = c0 + cycles;
    let n = 0;
    while (!this.halted && this.cycles < target) {
      if (n > 0 && this.breakpoints.size && this.breakpoints.has(this.pc)) return { reason: 'breakpoint', steps: n, cycles: this.cycles - c0 };
      this.step();
      n++;
    }
    return { reason: this.halted ? 'trap' : 'cycles', steps: n, cycles: this.cycles - c0 };
  }

  /** Run until the PC reaches `address` (before executing it), a trap, or `maxSteps`. */
  runUntil(address: number, maxSteps = 1_000_000): Rv32RunResult {
    const c0 = this.cycles;
    let n = 0;
    while (!this.halted && n < maxSteps) {
      this.step();
      n++;
      if (this.pc === address >>> 0) return { reason: 'breakpoint', steps: n, cycles: this.cycles - c0 };
    }
    return { reason: this.halted ? 'trap' : 'max-steps', steps: n, cycles: this.cycles - c0 };
  }

  snapshot(): Rv32State {
    return {
      pc: this.pc,
      x: Array.from(this.x, (v) => v >>> 0),
      halted: this.halted,
      trap: this.trap ? { ...this.trap } : undefined,
      cycles: this.cycles,
      steps: this.steps,
      ram: this.memory.slice(),
      lfsr: this.io.lfsr,
      board: this.board.outputs(),
    };
  }

  /** Restore a snapshot (the board's outputs are restored without calling hooks). */
  restore(state: Rv32State): void {
    this.pc = state.pc;
    state.x.forEach((v, i) => (this.x[i] = v));
    this.halted = state.halted;
    this.trap = state.trap ? { ...state.trap } : undefined;
    this.cycles = state.cycles;
    this.steps = state.steps;
    this.memory.fill(0);
    this.memory.set(state.ram.subarray(0, this.ramSize));
    this.io.lfsr = state.lfsr;
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

export interface Rv32CompareOptions {
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
 * Compare two RV32I states (for differential testing of the DCL core, or another implementation,
 * against the interpreter). Returns human-readable differences; an empty list means they agree.
 */
export function compareStates(a: Rv32State, b: Rv32State, options: Rv32CompareOptions = {}): string[] {
  const out: string[] = [];
  const h = (x: number) => '0x' + (x >>> 0).toString(16).toUpperCase().padStart(8, '0');
  if (a.pc !== b.pc) out.push(`pc: ${h(a.pc)} ≠ ${h(b.pc)}`);
  for (let i = 0; i < 32; i++) if (a.x[i] !== b.x[i]) out.push(`x${i}: ${h(a.x[i]!)} ≠ ${h(b.x[i]!)}`);
  if (a.halted !== b.halted) out.push(`halted: ${a.halted} ≠ ${b.halted}`);
  if (a.trap?.cause !== b.trap?.cause) out.push(`trap: ${a.trap?.cause ?? 'none'} ≠ ${b.trap?.cause ?? 'none'}`);
  else if (a.trap && b.trap && (a.trap.pc !== b.trap.pc || a.trap.value !== b.trap.value))
    out.push(`trap details: ${a.trap.message} ≠ ${b.trap.message}`);
  if (options.timing) {
    if (a.cycles !== b.cycles) out.push(`cycles: ${a.cycles} ≠ ${b.cycles}`);
    if (a.steps !== b.steps) out.push(`steps: ${a.steps} ≠ ${b.steps}`);
  }
  if (options.memory !== false) {
    const max = options.maxMemoryDifferences ?? 16;
    let count = 0;
    for (let i = 0; i < Math.max(a.ram.length, b.ram.length); i++) {
      if ((a.ram[i] ?? 0) !== (b.ram[i] ?? 0)) {
        if (count++ < max) out.push(`M[${h(i)}]: 0x${(a.ram[i] ?? 0).toString(16).padStart(2, '0')} ≠ 0x${(b.ram[i] ?? 0).toString(16).padStart(2, '0')}`);
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

