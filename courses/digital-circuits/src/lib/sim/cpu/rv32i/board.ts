/**
 * The virtual board as the RV32I core sees it: a memory map in the spirit of Octet's (`octet/spec.ts`),
 * with the same devices in the same order, but word-sized registers, four hexadecimal digits, a
 * 32-bit random port and a timer.
 *
 * ```
 * 0x0000_0000 – 0x0000_FFFF   RAM (64 KiB): program, data and stack; the stack grows down from RAM_TOP
 * 0xFFFF_FF00 – 0xFFFF_FF07   MATRIX: the 8 × 8 LED matrix, one byte per row (row 0 at the lowest address)
 * 0xFFFF_FF08                 LEDS      0xFFFF_FF0C SWITCHES   0xFFFF_FF10 BUTTONS   0xFFFF_FF14 HEX
 * 0xFFFF_FF18                 CONSOLE   0xFFFF_FF1C RANDOM     0xFFFF_FF20 PWM       0xFFFF_FF24 DAC / ADC
 * 0xFFFF_FF28                 TIMER     0xFFFF_FF2C TIMER_HI
 * ```
 *
 * The I/O block sits at the very top of the 32-bit address space, so every register is reachable
 * with a single instruction relative to `zero`: 0xFFFF_FF08 is −248, and `sw t0, LEDS(zero)` works
 * (the assembler reads a 12-bit offset as a 32-bit number; see `fitsImm12`).
 *
 * Accesses must be naturally aligned (a misaligned load or store is a trap). Byte and halfword
 * accesses to a word register touch just those bytes. Addresses that are neither RAM nor a
 * register are access faults, and so is fetching an instruction from I/O.
 */
import { VirtualBoard, lfsr32, type BoardHooks } from '../common/board';

export const RV32_MEMORY = {
  ramBase: 0,
  /** RAM size in bytes (the reference design uses block RAM of this size). */
  ramSize: 0x10000,
  ioBase: 0xffffff00,
  ioSize: 0x100,
  resetPc: 0,
} as const;

/** Register addresses (also predefined as assembler symbols). */
export const RV32_IO = {
  MATRIX: 0xffffff00,
  LEDS: 0xffffff08,
  SWITCHES: 0xffffff0c,
  BUTTONS: 0xffffff10,
  HEX: 0xffffff14,
  CONSOLE: 0xffffff18,
  RANDOM: 0xffffff1c,
  PWM: 0xffffff20,
  DAC: 0xffffff24,
  ADC: 0xffffff24,
  TIMER: 0xffffff28,
  TIMER_HI: 0xffffff2c,
} as const;

/** One past the highest register offset in the I/O block. */
const IO_END = 0x30;

export interface Rv32IoRegister {
  address: string;
  name: string;
  width: string;
  read: string;
  write: string;
}

export const RV32_IO_REGISTERS: Rv32IoRegister[] = [
  {
    address: '0xFFFF_FF00–07',
    name: 'MATRIX',
    width: '8 bytes',
    read: 'The row as last written.',
    write: '8 × 8 LED matrix frame buffer: the byte at MATRIX + n is row n (0 = top), bit 7 the leftmost pixel; 1 = lit. A word write sets four rows, little-endian.',
  },
  { address: '0xFFFF_FF08', name: 'LEDS', width: '8 bits', read: 'The value last written.', write: 'The 8 LEDs; bit 7 is the leftmost.' },
  { address: '0xFFFF_FF0C', name: 'SWITCHES', width: '8 bits', read: 'The 8 switches; 1 = on.', write: 'Ignored.' },
  {
    address: '0xFFFF_FF10',
    name: 'BUTTONS',
    width: '8 bits',
    read: 'Bits 0–3: buttons BTN0–BTN3, 1 while pressed. Bit 7: comparator, 1 when the analogue input is above the DAC output. Bits 4–6: 0.',
    write: 'Ignored.',
  },
  { address: '0xFFFF_FF14', name: 'HEX', width: '16 bits', read: 'The value last written.', write: 'Four hexadecimal 7-segment digits: bits 15–12 are the leftmost.' },
  {
    address: '0xFFFF_FF18',
    name: 'CONSOLE',
    width: '8 bits',
    read: 'The next typed character, or 0 if none is waiting.',
    write: 'Print a character (ASCII; 10 is a new line).',
  },
  {
    address: '0xFFFF_FF1C',
    name: 'RANDOM',
    width: '32 bits',
    read: 'Steps the 32-bit LFSR (x³² + x²² + x² + x + 1, period 2³² − 1) and returns its new state. Reset state 1.',
    write: 'Seeds the LFSR (a write of 0 is ignored: 0 would stop it).',
  },
  { address: '0xFFFF_FF20', name: 'PWM', width: '8 bits', read: 'The value last written.', write: 'PWM duty: the output is high for n/256 of every period.' },
  { address: '0xFFFF_FF24', name: 'DAC / ADC', width: '8 bits', read: 'ADC: the analogue input converted to 0–255.', write: 'DAC: output voltage n/256 of full scale.' },
  { address: '0xFFFF_FF28', name: 'TIMER', width: '32 bits', read: 'Clock cycles since reset, low 32 bits (the cycles completed before the load executes).', write: 'Ignored.' },
  { address: '0xFFFF_FF2C', name: 'TIMER_HI', width: '32 bits', read: 'Clock cycles since reset, bits 63–32.', write: 'Ignored.' },
];

export const RV32_MEMORY_MAP: { range: string; use: string }[] = [
  { range: '0x0000_0000–0x0000_FFFF', use: 'RAM (64 KiB): the program from 0 (where the PC starts), then data; the stack grows down from RAM_TOP (0x1_0000).' },
  { range: '0x0001_0000–0xFFFF_FEFF', use: 'Nothing: an access is a fault.' },
  { range: '0xFFFF_FF00–0xFFFF_FF2F', use: 'I/O registers (above). The rest of the block up to 0xFFFF_FFFF is a fault.' },
];

/** Names the assembler predefines: the I/O registers, `RAM_TOP` and `IO_BASE`. */
export function rv32Symbols(ramSize: number = RV32_MEMORY.ramSize): Record<string, number> {
  return { ...RV32_IO, RAM_TOP: ramSize, IO_BASE: RV32_MEMORY.ioBase };
}

// ---------------------------------------------------------------------------------------------
// Traps

export type Rv32TrapCause =
  | 'instruction-misaligned'
  | 'instruction-access-fault'
  | 'illegal-instruction'
  | 'breakpoint'
  | 'load-misaligned'
  | 'load-access-fault'
  | 'store-misaligned'
  | 'store-access-fault'
  | 'ecall';

/** The `mcause` exception codes of the privileged specification. */
export const RV32_TRAP_CODES: Record<Rv32TrapCause, number> = {
  'instruction-misaligned': 0,
  'instruction-access-fault': 1,
  'illegal-instruction': 2,
  breakpoint: 3,
  'load-misaligned': 4,
  'load-access-fault': 5,
  'store-misaligned': 6,
  'store-access-fault': 7,
  ecall: 11,
};

export interface Rv32Trap {
  cause: Rv32TrapCause;
  /** The exception code (`mcause`). */
  code: number;
  /** Address of the instruction that trapped (`mepc`). */
  pc: number;
  /** `mtval`: the faulting address, or the instruction word for an illegal instruction, else 0. */
  value: number;
  /** A sentence for the reader. */
  message: string;
  /** Clock cycle at which it happened. */
  cycle: number;
}

const h8 = (n: number) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');

export function trapMessage(cause: Rv32TrapCause, pc: number, value: number): string {
  switch (cause) {
    case 'illegal-instruction':
      return `illegal instruction ${h8(value)} at ${h8(pc)}`;
    case 'ecall':
      return `ecall at ${h8(pc)}`;
    case 'breakpoint':
      return `ebreak at ${h8(pc)}`;
    case 'instruction-misaligned':
      return `jump to ${h8(value)}, which is not 4-byte aligned, at ${h8(pc)}`;
    case 'instruction-access-fault':
      return `fetch from ${h8(value)}, which is not RAM, at ${h8(pc)}`;
    case 'load-misaligned':
      return `misaligned load from ${h8(value)} at ${h8(pc)}`;
    case 'store-misaligned':
      return `misaligned store to ${h8(value)} at ${h8(pc)}`;
    case 'load-access-fault':
      return `load from ${h8(value)}, which is neither RAM nor a device, at ${h8(pc)}`;
    case 'store-access-fault':
      return `store to ${h8(value)}, which is neither RAM nor a device, at ${h8(pc)}`;
  }
}

export interface Rv32BoardHooks extends BoardHooks {
  /** A trap was taken (the core stops, unless the machine's trap handler resumes it). */
  onTrap?(trap: Rv32Trap): void;
}

/** The board with the RV32I extras: four hex digits, and a log of the traps the core reported. */
export class Rv32Board extends VirtualBoard {
  /** The traps reported so far, oldest first. */
  readonly traps: Rv32Trap[] = [];
  readonly trapHooks: Rv32BoardHooks;

  constructor(hooks: Rv32BoardHooks = {}) {
    super(hooks, 4);
    this.trapHooks = hooks;
  }

  get lastTrap(): Rv32Trap | undefined {
    return this.traps[this.traps.length - 1];
  }

  reportTrap(trap: Rv32Trap): void {
    if (this.traps.length >= 1000) this.traps.shift();
    this.traps.push(trap);
    this.trapHooks.onTrap?.(trap);
  }

  override reset(): void {
    super.reset();
    this.traps.length = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// The I/O block

/** Access to the memory-mapped registers; the machine calls it for addresses in the I/O block. */
export class Rv32Io {
  /** The RANDOM port's LFSR state (never 0). */
  lfsr = 1;

  constructor(readonly board: Rv32Board) {}

  reset(): void {
    this.lfsr = 1;
  }

  /** Is `offset … offset + size − 1` (from IO_BASE) inside a register? */
  static mapped(offset: number, size: number): boolean {
    return offset >= 0 && offset + size <= IO_END;
  }

  /** The 32-bit value of the word register at `offset` (a multiple of 4). `effects`: reading may have side effects. */
  private word(offset: number, cycles: number, effects: boolean): number {
    const b = this.board;
    switch (offset) {
      case 0x00:
      case 0x04: {
        const m = b.matrix;
        const i = offset;
        return (m[i]! | (m[i + 1]! << 8) | (m[i + 2]! << 16) | (m[i + 3]! << 24)) >>> 0;
      }
      case 0x08:
        return b.leds;
      case 0x0c:
        return b.readSwitches();
      case 0x10:
        return b.readButtons();
      case 0x14:
        return b.hex;
      case 0x18:
        return effects ? b.readConsole() : (b.consoleInput[0] ?? 0);
      case 0x1c:
        if (!effects) return this.lfsr;
        if (b.hooks.random) return b.hooks.random() >>> 0;
        this.lfsr = lfsr32(this.lfsr);
        return this.lfsr;
      case 0x20:
        return b.pwm;
      case 0x24:
        return b.readAdc();
      case 0x28:
        return cycles >>> 0;
      case 0x2c:
        return Math.floor(cycles / 4294967296) >>> 0;
      default:
        return 0;
    }
  }

  /** Read `size` bytes (1, 2 or 4) at `offset`, naturally aligned. `cycles` is the timer's value. */
  read(offset: number, size: number, cycles: number, effects = true): number {
    const aligned = offset & ~3;
    const v = this.word(aligned, cycles, effects);
    const shift = (offset & 3) * 8;
    return size === 4 ? v >>> 0 : ((v >>> shift) & (size === 2 ? 0xffff : 0xff)) >>> 0;
  }

  /** Write `size` bytes at `offset`. Sub-word writes leave the other bytes of a register alone. */
  write(offset: number, size: number, value: number): void {
    const b = this.board;
    const aligned = offset & ~3;
    const shift = (offset & 3) * 8;
    const mask = size === 4 ? 0xffffffff : ((size === 2 ? 0xffff : 0xff) << shift) >>> 0;
    const bits = size === 4 ? value >>> 0 : ((value << shift) >>> 0) & mask;
    const merge = (old: number) => (((old & ~mask) | bits) >>> 0);
    switch (aligned) {
      case 0x00:
      case 0x04:
        for (let k = 0; k < 4; k++) {
          if ((mask >>> (8 * k)) & 0xff) b.writeMatrix(aligned + k, (bits >>> (8 * k)) & 0xff);
        }
        return;
      case 0x08:
        b.writeLeds(merge(b.leds));
        return;
      case 0x14:
        b.writeHex(merge(b.hex));
        return;
      case 0x18:
        b.writeConsole(bits >>> shift);
        return;
      case 0x1c: {
        const v = merge(this.lfsr);
        if (v !== 0) this.lfsr = v;
        return;
      }
      case 0x20:
        b.writePwm(merge(b.pwm));
        return;
      case 0x24:
        b.writeDac(merge(b.dac));
        return;
      default:
        return; // SWITCHES, BUTTONS, TIMER, TIMER_HI: read-only
    }
  }
}
