/**
 * The virtual board's devices, shared by both course CPUs (PLAN.md, *The virtual board*): 8 LEDs,
 * 8 switches, 4 buttons, four hexadecimal 7-segment digits, an 8 × 8 LED matrix, a text console,
 * a PWM output, a DAC output with a comparator, and an ADC input.
 *
 * The board holds the device state; each CPU maps it into its own address space:
 * Octet at 0xF0–0xFF (see `octet/spec.ts`), RV32I at 0xFFFF_FF00 (see `rv32i/board.ts`).
 * The CPU-specific ports (Octet's 8-bit LFSR, RV32I's 32-bit LFSR and cycle timer) live in those
 * adapters.
 *
 * Outputs are latches: the CPU writes them and the board remembers the last value (and calls the
 * matching `on…` hook so a UI can redraw). Inputs are plain fields a UI or test sets, unless a
 * hook is given, in which case the hook is asked on every read (useful for inputs that change with
 * time, such as a button pressed at a given cycle).
 */

export interface BoardHooks {
  /** A byte written to the console. */
  onConsole?(byte: number): void;
  onLeds?(value: number): void;
  onHex?(value: number): void;
  onMatrix?(row: number, value: number): void;
  onPwm?(duty: number): void;
  onDac?(value: number): void;
  /** Input overrides, asked on every read instead of the matching field. */
  switches?(): number;
  buttons?(): number;
  adc?(): number;
  /** The next console input byte, or undefined if none is waiting. */
  consoleIn?(): number | undefined;
  /** A random value to return instead of the CPU's LFSR (tests, or a UI's own randomness). */
  random?(): number;
}

/** A snapshot of the board's output latches (used when comparing machine states). */
export interface BoardOutputs {
  leds: number;
  hex: number;
  matrix: number[];
  pwm: number;
  dac: number;
  console: number[];
}

export class VirtualBoard {
  // Outputs (latches).
  leds = 0;
  /** The hexadecimal display, 16 bits: digit 3 (leftmost) is bits 15–12. */
  hex = 0;
  /** How many digits the CPU drives (Octet 2, RV32I 4); the others are blank. */
  hexDigits: number;
  /** Row 0 is the top row; bit 7 of a row is its leftmost pixel. */
  readonly matrix = new Uint8Array(8);
  pwm = 0;
  dac = 0;
  /** Every byte written to the console, in order. */
  readonly consoleOutput: number[] = [];

  // Inputs.
  switches = 0;
  /** Bits 0–3: buttons BTN0–BTN3, 1 while pressed. */
  buttons = 0;
  /** The analogue input, as the ADC would convert it (0–255). */
  adc = 0;
  /** Bytes waiting to be read from the console. */
  readonly consoleInput: number[] = [];

  hooks: BoardHooks;

  constructor(hooks: BoardHooks = {}, hexDigits = 4) {
    this.hooks = hooks;
    this.hexDigits = hexDigits;
  }

  /** Clear the outputs (inputs keep their values, as switches would). */
  reset(): void {
    this.leds = 0;
    this.hex = 0;
    this.matrix.fill(0);
    this.pwm = 0;
    this.dac = 0;
    this.consoleOutput.length = 0;
  }

  // Output writes.
  writeLeds(v: number): void {
    this.leds = v & 0xff;
    this.hooks.onLeds?.(this.leds);
  }
  writeHex(v: number): void {
    this.hex = v & (this.hexDigits >= 4 ? 0xffff : (1 << (4 * this.hexDigits)) - 1);
    this.hooks.onHex?.(this.hex);
  }
  writeMatrix(row: number, v: number): void {
    this.matrix[row & 7] = v & 0xff;
    this.hooks.onMatrix?.(row & 7, v & 0xff);
  }
  writePwm(v: number): void {
    this.pwm = v & 0xff;
    this.hooks.onPwm?.(this.pwm);
  }
  writeDac(v: number): void {
    this.dac = v & 0xff;
    this.hooks.onDac?.(this.dac);
  }
  writeConsole(v: number): void {
    this.consoleOutput.push(v & 0xff);
    this.hooks.onConsole?.(v & 0xff);
  }

  // Input reads.
  readSwitches(): number {
    return (this.hooks.switches ? this.hooks.switches() : this.switches) & 0xff;
  }
  /** Buttons in bits 0–3 and, in bit 7, the comparator: 1 when the analogue input exceeds the DAC. */
  readButtons(): number {
    const b = (this.hooks.buttons ? this.hooks.buttons() : this.buttons) & 0x0f;
    return b | (this.readAdc() > this.dac ? 0x80 : 0);
  }
  readAdc(): number {
    return (this.hooks.adc ? this.hooks.adc() : this.adc) & 0xff;
  }
  /** The next console input byte, or 0 if nothing is waiting. */
  readConsole(): number {
    if (this.hooks.consoleIn) return (this.hooks.consoleIn() ?? 0) & 0xff;
    return this.consoleInput.shift() ?? 0;
  }

  /** Everything written to the console so far, as text. */
  get consoleText(): string {
    return String.fromCharCode(...this.consoleOutput);
  }

  /** Queue text for the program to read from the console. */
  type(text: string): void {
    for (const ch of text) this.consoleInput.push(ch.charCodeAt(0) & 0xff);
  }

  outputs(): BoardOutputs {
    return {
      leds: this.leds,
      hex: this.hex,
      matrix: [...this.matrix],
      pwm: this.pwm,
      dac: this.dac,
      console: [...this.consoleOutput],
    };
  }

  /** The matrix as eight strings of '#' and '.', top row first (handy in tests and logs). */
  matrixText(): string[] {
    return [...this.matrix].map((row) => [...Array(8)].map((_, x) => ((row >> (7 - x)) & 1 ? '#' : '.')).join(''));
  }
}

/** One step of the 8-bit Galois LFSR x⁸ + x⁶ + x⁵ + x⁴ + 1 (taps 0xB8); period 255. */
export function lfsr8(state: number): number {
  return (state >>> 1) ^ (state & 1 ? 0xb8 : 0);
}

/** One step of the 32-bit Galois LFSR x³² + x²² + x² + x + 1 (taps 0x80200003); period 2³² − 1. */
export function lfsr32(state: number): number {
  return ((state >>> 1) ^ (state & 1 ? 0x80200003 : 0)) >>> 0;
}

/** Compare two board-output snapshots; returns human-readable differences. */
export function compareOutputs(a: BoardOutputs, b: BoardOutputs, prefix = 'board'): string[] {
  const out: string[] = [];
  for (const k of ['leds', 'hex', 'pwm', 'dac'] as const) {
    if (a[k] !== b[k]) out.push(`${prefix}.${k}: ${a[k]} ≠ ${b[k]}`);
  }
  for (let r = 0; r < 8; r++) {
    if (a.matrix[r] !== b.matrix[r]) out.push(`${prefix}.matrix[${r}]: ${a.matrix[r]} ≠ ${b.matrix[r]}`);
  }
  const ca = String.fromCharCode(...a.console);
  const cb = String.fromCharCode(...b.console);
  if (ca !== cb) out.push(`${prefix}.console: ${JSON.stringify(ca)} ≠ ${JSON.stringify(cb)}`);
  return out;
}
