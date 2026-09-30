/**
 * An Octet computer for a page: an assembly source, the assembler's listing, the machine, its
 * devices, breakpoints, a history of executed instructions, and a clock that can run one cycle,
 * one instruction or a budget of cycles at a time.
 *
 * It has no user interface, so it is tested on its own and shared by the chapter's widgets (the
 * flagship computer of Chapter 23 and the I/O board of Chapter 24). At low speeds it steps the
 * cycle-accurate `MicroCpu` (every register transfer visible); at high speeds it lets the reference
 * interpreter execute whole instructions. Both work on the same `OctetMachine`, and the tests show
 * that they reach identical states.
 */
import { OctetMachine, assemble, disassembleAt, type OctetProgram } from '$lib/sim/cpu/octet';
import type { Diagnostic } from '$lib/sim/cpu/common/asm';
import { MicroCpu, type CycleInfo } from './cycles';

/** An OctetMachine that remembers when each byte of memory was last written (in clock cycles). */
export class TracedMachine extends OctetMachine {
  /** The cycle count at the last write to each address (−1: never). */
  readonly stamps = new Int32Array(256).fill(-1);

  override write(address: number, value: number): void {
    this.stamps[address & 0xff] = this.cycles;
    super.write(address, value);
  }

  override reset(clearMemory = false): void {
    super.reset(clearMemory);
    this.stamps.fill(-1);
  }
}

export interface HistoryEntry {
  address: number;
  bytes: number[];
  text: string;
  /** 1-based source line, or 0 if unknown. */
  line: number;
  /** Clock cycles it took. */
  cycles: number;
  /** The cycle count when it started. */
  start: number;
}

export interface OutputChange {
  /** Clock cycle at the end of the instruction that wrote it. */
  cycle: number;
  value: number;
}

export type StopReason = 'budget' | 'halted' | 'breakpoint';

export interface RunOutcome {
  /** Clock cycles executed by the call. */
  ran: number;
  reason: StopReason;
}

const HISTORY = 8;
const LOG_LIMIT = 40_000;

export class OctetComputer {
  readonly machine: TracedMachine;
  readonly cpu: MicroCpu;
  source: string;
  program: OctetProgram;
  /** Source lines with a breakpoint. */
  readonly breakpoints = new Set<number>();
  /** The most recent instructions, oldest first. */
  history: HistoryEntry[] = [];
  /** Changes of the LEDS register, of the PWM register and of the DAC register, in clock cycles. */
  readonly ledLog: OutputChange[] = [{ cycle: 0, value: 0 }];
  readonly pwmLog: OutputChange[] = [{ cycle: 0, value: 0 }];
  readonly dacLog: OutputChange[] = [{ cycle: 0, value: 0 }];
  /** True when the source has changed since it was loaded into memory. */
  stale = false;
  /** The instruction address where a step began (for the 'you are here' marker while stepping cycles). */
  private instructionStart = 0;
  private lastLeds = 0;
  private lastPwm = 0;
  private lastDac = 0;
  private startCycle = 0;

  constructor(source = '') {
    this.machine = new TracedMachine({ traceLimit: 0 });
    this.cpu = new MicroCpu(this.machine);
    this.source = source;
    this.program = assemble(source);
    this.load();
  }

  get board() {
    return this.machine.board;
  }

  get diagnostics(): Diagnostic[] {
    return this.program.diagnostics;
  }

  get ok(): boolean {
    return this.program.ok;
  }

  /** Replace the source and assemble it (live). The machine keeps running the old image until `load`. */
  setSource(source: string): void {
    if (source === this.source) return;
    this.source = source;
    this.program = assemble(source);
    this.stale = true;
    // Breakpoints on lines that no longer hold an instruction are dropped.
    for (const l of [...this.breakpoints]) if (!this.isInstructionLine(l)) this.breakpoints.delete(l);
  }

  /** Copy the assembled program into memory and reset the machine and its devices. Returns false if the source has errors. */
  load(): boolean {
    if (!this.program.ok) return false;
    this.machine.load(this.program);
    this.cpu.reset();
    this.history = [];
    this.ledLog.length = 0;
    this.ledLog.push({ cycle: 0, value: 0 });
    this.pwmLog.length = 0;
    this.pwmLog.push({ cycle: 0, value: 0 });
    this.dacLog.length = 0;
    this.dacLog.push({ cycle: 0, value: 0 });
    this.lastLeds = this.lastPwm = this.lastDac = 0;
    this.stale = false;
    this.instructionStart = this.machine.pc;
    return true;
  }

  /** Reset the machine (CPU, devices, cycle counter) and reload the program image: memory changes are undone. */
  reset(): void {
    if (this.program.ok) this.load();
    else {
      this.machine.reset(true);
      this.cpu.reset();
      this.history = [];
    }
  }

  // ---- Breakpoints (by source line).

  isInstructionLine(line: number): boolean {
    const l = this.program.listing[line - 1];
    return !!l && l.address !== undefined && l.bytes.length > 0 && this.program.instructionStart[l.address] === 1;
  }

  toggleBreakpoint(line: number): boolean {
    if (this.breakpoints.has(line)) {
      this.breakpoints.delete(line);
      return false;
    }
    if (!this.isInstructionLine(line)) return false;
    this.breakpoints.add(line);
    return true;
  }

  breakpointAddresses(): Set<number> {
    const out = new Set<number>();
    for (const l of this.breakpoints) {
      const a = this.program.listing[l - 1]?.address;
      if (a !== undefined) out.add(a);
    }
    return out;
  }

  /** The source line of the instruction at `address`, or 0. */
  lineAt(address: number): number {
    return this.program.lineOf[address & 0xff] ?? 0;
  }

  /** The source line of the instruction being executed, or about to be. */
  get currentLine(): number {
    return this.lineAt(this.cpu.atBoundary ? this.machine.pc : this.instructionStart);
  }

  // ---- Running.

  get halted(): boolean {
    return this.machine.halted && this.cpu.atBoundary;
  }

  /** Cycles per instruction so far. */
  get cpi(): number {
    return this.machine.steps ? this.machine.cycles / this.machine.steps : 0;
  }

  private beginInstruction(): void {
    this.instructionStart = this.machine.pc;
    this.startCycle = this.machine.cycles;
  }

  private endInstruction(): void {
    const m = this.machine;
    const a = this.instructionStart;
    const d = disassembleAt(m.memory, a, { labels: this.program.labels });
    this.history.push({ address: a, bytes: d.bytes, text: d.text, line: this.lineAt(a), cycles: m.cycles - this.startCycle, start: this.startCycle });
    if (this.history.length > HISTORY) this.history.shift();
    const b = m.board;
    if (b.leds !== this.lastLeds) this.push(this.ledLog, (this.lastLeds = b.leds));
    if (b.pwm !== this.lastPwm) this.push(this.pwmLog, (this.lastPwm = b.pwm));
    if (b.dac !== this.lastDac) this.push(this.dacLog, (this.lastDac = b.dac));
  }

  private push(log: OutputChange[], value: number): void {
    log.push({ cycle: this.machine.cycles, value });
    if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT / 2);
  }

  /** Run one clock cycle. */
  stepCycle(): CycleInfo | null {
    if (this.cpu.atBoundary) {
      if (this.machine.halted) return null;
      this.beginInstruction();
    }
    const c = this.cpu.cycle();
    if (c?.last) this.endInstruction();
    return c;
  }

  /** Run to the end of the current instruction (or one whole instruction). Returns its cycles. */
  stepInstruction(): number {
    const c0 = this.machine.cycles;
    if (this.cpu.atBoundary) {
      if (this.machine.halted) return 0;
      this.beginInstruction();
      this.machine.step();
      this.endInstruction();
    } else {
      this.cpu.finishInstruction();
      this.endInstruction();
    }
    return this.machine.cycles - c0;
  }

  /**
   * Run for a budget of clock cycles, stopping early at a halt or at a breakpoint (before the
   * instruction there executes; the instruction the run starts on never counts). Whole instructions
   * are executed by the interpreter while more than 8 cycles remain, and single cycles after that,
   * so the result never exceeds the budget.
   */
  run(budget: number): RunOutcome {
    let ran = 0;
    let first = true;
    const stops = this.breakpoints.size ? this.breakpointAddresses() : undefined;
    while (ran < budget) {
      if (this.cpu.atBoundary) {
        if (this.machine.halted) return { ran, reason: 'halted' };
        if (!first && stops?.has(this.machine.pc)) return { ran, reason: 'breakpoint' };
      }
      first = false;
      if (this.cpu.atBoundary && budget - ran >= 8) {
        ran += this.stepInstruction();
      } else {
        this.stepCycle();
        ran++;
      }
    }
    return { ran, reason: this.halted ? 'halted' : 'budget' };
  }

  /** Run until the program halts, a breakpoint is reached or `maxInstructions` have executed. For tests and exercises. */
  runToHalt(maxInstructions = 1_000_000): StopReason | 'limit' {
    let n = 0;
    const stops = this.breakpoints.size ? this.breakpointAddresses() : undefined;
    while (n < maxInstructions) {
      if (this.cpu.atBoundary) {
        if (this.machine.halted) return 'halted';
        if (n > 0 && stops?.has(this.machine.pc)) return 'breakpoint';
      }
      this.stepInstruction();
      n++;
    }
    return 'limit';
  }

  // ---- What the page shows.

  /** The 256 bytes as the CPU would read them now, without side effects. */
  memoryView(): number[] {
    const out: number[] = [];
    for (let a = 0; a < 256; a++) out.push(this.machine.peek(a));
    return out;
  }

  /** Which addresses hold an assembled byte of the program (for shading the memory view). */
  programBytes(): Uint8Array {
    return this.program.used;
  }
}
