/**
 * The vCPLD-32's JTAG port: an IEEE 1149.1 test access port with boundary scan and in-system
 * programming, and a host that drives it and records every clock.
 *
 * ## The TAP controller
 *
 * Four pins: TCK (clock), TMS (mode select), TDI (data in) and TDO (data out). The controller is a
 * 16-state machine that moves on each rising edge of TCK according to TMS (`nextTapState`); five
 * TCK cycles with TMS = 1 lead to Test-Logic-Reset from any state. In Shift-DR/Shift-IR the
 * selected register moves one place towards TDO on each cycle, TDI entering at the far end. A
 * register captures at Capture-DR/Capture-IR (at the rising edge in that state) and updates its
 * output latches at Update-DR/Update-IR (the falling edge in that state). TDO is driven only
 * during the shift states. A software model has no separate falling edge, so `tck(tms, tdi)` is one
 * whole cycle: TDO is the value the port drives during it, the rising-edge actions of the state
 * the port is in happen, the state advances, and the actions of the state entered (update, reset)
 * follow.
 *
 * ## Instruction register: 8 bits (as the XC9500's)
 *
 * The register shifts LSB first. Capture-IR loads 00000001 with status bits above the mandatory
 * "01" in the two least significant places: bit 2 in-system-programming mode, bit 3 busy (an
 * erase or program pulse is still running), bit 4 error (a programming command was refused).
 * Test-Logic-Reset loads IDCODE. Unassigned codes select BYPASS.
 *
 * | Code | Instruction      | Data register (length)                                 |
 * |------|------------------|--------------------------------------------------------|
 * | 0x00 | EXTEST           | boundary-scan register (99): pins driven from latches |
 * | 0x01 | SAMPLE/PRELOAD   | boundary-scan register (99): pins stay under the core |
 * | 0xC0 | ISC_DISABLE      | bypass (1); leave programming mode, restart            |
 * | 0xE9 | ISC_ENABLE       | bypass (1); enter programming mode                     |
 * | 0xEA | ISC_PROGRAM      | row register (72): address + data, written at Update-DR |
 * | 0xEC | ISC_ERASE        | bypass (1); bulk erase                                 |
 * | 0xEE | ISC_VERIFY       | row register (72): read back                           |
 * | 0xFC | HIGHZ            | bypass (1); all pins off                               |
 * | 0xFD | USERCODE         | 32 bits: the user code in the last configuration row   |
 * | 0xFE | IDCODE           | 32 bits                                                |
 * | 0xFF | BYPASS           | 1 bit                                                  |
 *
 * ## IDCODE (32 bits, LSB first, LSB always 1)
 *
 * `version[31:28] part[27:12] manufacturer[11:1] 1`. Version 1, part 0xC032 ("CPLD 32"),
 * manufacturer 0x0FF: a code that belongs to no real vendor. That makes IDCODE = 0x1C0321FF (see
 * `IDCODE_VALUE`).
 *
 * ## Boundary-scan register (99 cells)
 *
 * Cell 0 is nearest TDO (it shifts out first), cell 98 nearest TDI. For each of the 32 I/O pins
 * `io`, three cells: `3·io` input (captures the level on the pin), `3·io + 1` output data (captures
 * the macrocell's output, latches what EXTEST drives), `3·io + 2` control (captures whether the
 * macrocell's output enable is true; the latched value enables the driver in EXTEST). Cells 96, 97
 * and 98 are the input cells of GCLK, GSR and GOE. Capture-DR loads all cells; Update-DR latches
 * the output-data and control cells. With SAMPLE/PRELOAD the latches do nothing yet (preload them,
 * then switch to EXTEST without glitching the pins); under EXTEST the pins are driven from the
 * latches and the core is isolated (it holds its state).
 *
 * ## Programming protocol
 *
 * The configuration is 141 rows of 64 bits. In programming mode all output buffers are off and the
 * flip-flops ignore the clock.
 *
 *  1. ISC_ENABLE: load the instruction; programming mode starts at Update-IR.
 *  2. ISC_ERASE: load the instruction; at Update-IR every bit is cleared. The device is busy for
 *     `ERASE_CYCLES` (8) TCK cycles spent in Run-Test/Idle; commands during that time are refused.
 *  3. ISC_PROGRAM: load the instruction, then for each row scan the 72-bit row register: bits 0–63
 *     the row's data, bit 0 first, then bits 64–71 the row address, LSB first. At Update-DR the row
 *     is programmed (programming can only set bits, so erase first) and the device is busy for
 *     `PROGRAM_CYCLES` (3) Run-Test/Idle cycles.
 *  4. ISC_VERIFY: an address is latched at Update-DR and the row at that address is captured at the
 *     next Capture-DR, so reading N rows takes N + 1 scans, each shifting out the previous
 *     address's row while shifting in the next address.
 *  5. ISC_DISABLE: load the instruction; at Update-IR programming mode ends and the device
 *     restarts from its new configuration (flip-flops at their power-up values).
 *
 * Entering Test-Logic-Reset also leaves programming mode. The configuration is non-volatile; it
 * survives `powerCycle()`.
 */
import {
  BIT_COUNT,
  IO_PINS,
  ROW_BITS,
  ROW_COUNT,
  USERCODE_BITS,
  getRow,
  getUsercode,
  type Level,
} from '../devices/vcpld32-arch';
import { VCpld32, type CpldSnapshot } from '../devices/vcpld32';

// ---------------------------------------------------------------------------------------------
// The TAP state machine

export type TapState =
  | 'Test-Logic-Reset'
  | 'Run-Test/Idle'
  | 'Select-DR-Scan'
  | 'Capture-DR'
  | 'Shift-DR'
  | 'Exit1-DR'
  | 'Pause-DR'
  | 'Exit2-DR'
  | 'Update-DR'
  | 'Select-IR-Scan'
  | 'Capture-IR'
  | 'Shift-IR'
  | 'Exit1-IR'
  | 'Pause-IR'
  | 'Exit2-IR'
  | 'Update-IR';

/** The states in the order of the standard's diagram (data-register column, then instruction-register column). */
export const TAP_STATES: readonly TapState[] = [
  'Test-Logic-Reset',
  'Run-Test/Idle',
  'Select-DR-Scan',
  'Capture-DR',
  'Shift-DR',
  'Exit1-DR',
  'Pause-DR',
  'Exit2-DR',
  'Update-DR',
  'Select-IR-Scan',
  'Capture-IR',
  'Shift-IR',
  'Exit1-IR',
  'Pause-IR',
  'Exit2-IR',
  'Update-IR',
];

/** The conventional 4-bit state codes (as read from a state-machine trace of real parts). */
export const TAP_CODE: Readonly<Record<TapState, number>> = {
  'Test-Logic-Reset': 0xf,
  'Run-Test/Idle': 0xc,
  'Select-DR-Scan': 0x7,
  'Capture-DR': 0x6,
  'Shift-DR': 0x2,
  'Exit1-DR': 0x1,
  'Pause-DR': 0x3,
  'Exit2-DR': 0x0,
  'Update-DR': 0x5,
  'Select-IR-Scan': 0x4,
  'Capture-IR': 0xe,
  'Shift-IR': 0xa,
  'Exit1-IR': 0x9,
  'Pause-IR': 0xb,
  'Exit2-IR': 0x8,
  'Update-IR': 0xd,
};

/** [next state when TMS = 0, next state when TMS = 1]. */
const TRANSITIONS: Readonly<Record<TapState, readonly [TapState, TapState]>> = {
  'Test-Logic-Reset': ['Run-Test/Idle', 'Test-Logic-Reset'],
  'Run-Test/Idle': ['Run-Test/Idle', 'Select-DR-Scan'],
  'Select-DR-Scan': ['Capture-DR', 'Select-IR-Scan'],
  'Capture-DR': ['Shift-DR', 'Exit1-DR'],
  'Shift-DR': ['Shift-DR', 'Exit1-DR'],
  'Exit1-DR': ['Pause-DR', 'Update-DR'],
  'Pause-DR': ['Pause-DR', 'Exit2-DR'],
  'Exit2-DR': ['Shift-DR', 'Update-DR'],
  'Update-DR': ['Run-Test/Idle', 'Select-DR-Scan'],
  'Select-IR-Scan': ['Capture-IR', 'Test-Logic-Reset'],
  'Capture-IR': ['Shift-IR', 'Exit1-IR'],
  'Shift-IR': ['Shift-IR', 'Exit1-IR'],
  'Exit1-IR': ['Pause-IR', 'Update-IR'],
  'Pause-IR': ['Pause-IR', 'Exit2-IR'],
  'Exit2-IR': ['Shift-IR', 'Update-IR'],
  'Update-IR': ['Run-Test/Idle', 'Select-DR-Scan'],
};

export function nextTapState(state: TapState, tms: number): TapState {
  return TRANSITIONS[state][tms ? 1 : 0];
}

/** The shortest TMS sequence from one state to another (the empty sequence if they are equal). */
export function tapPath(from: TapState, to: TapState): (0 | 1)[] {
  if (from === to) return [];
  const prev = new Map<TapState, { from: TapState; tms: 0 | 1 }>();
  const queue: TapState[] = [from];
  const seen = new Set<TapState>([from]);
  while (queue.length) {
    const s = queue.shift()!;
    for (const tms of [0, 1] as const) {
      const t = nextTapState(s, tms);
      if (seen.has(t)) continue;
      seen.add(t);
      prev.set(t, { from: s, tms });
      if (t === to) {
        const path: (0 | 1)[] = [];
        let cur: TapState = to;
        while (cur !== from) {
          const p = prev.get(cur)!;
          path.unshift(p.tms);
          cur = p.from;
        }
        return path;
      }
      queue.push(t);
    }
  }
  throw new Error(`No path from ${from} to ${to}`);
}

// ---------------------------------------------------------------------------------------------
// Instructions and identification

export const IR_LENGTH = 8;

export const INSTRUCTIONS = {
  EXTEST: 0x00,
  SAMPLE_PRELOAD: 0x01,
  ISC_DISABLE: 0xc0,
  ISC_ENABLE: 0xe9,
  ISC_PROGRAM: 0xea,
  ISC_ERASE: 0xec,
  ISC_VERIFY: 0xee,
  HIGHZ: 0xfc,
  USERCODE: 0xfd,
  IDCODE: 0xfe,
  BYPASS: 0xff,
} as const;

export type InstructionName = keyof typeof INSTRUCTIONS;

export function instructionName(code: number): InstructionName | 'BYPASS (unassigned)' {
  for (const [name, c] of Object.entries(INSTRUCTIONS)) if (c === code) return name as InstructionName;
  return 'BYPASS (unassigned)';
}

export const IDCODE_VERSION = 0x1;
export const IDCODE_PART = 0xc032;
export const IDCODE_MANUFACTURER = 0x0ff;
export const IDCODE_VALUE = (((IDCODE_VERSION << 28) | (IDCODE_PART << 12) | (IDCODE_MANUFACTURER << 1) | 1) >>> 0) as number;

export const BSR_LENGTH = 3 * IO_PINS + 3; // 99
export const ROW_REGISTER_LENGTH = ROW_BITS + 8; // 72
export const ERASE_CYCLES = 8;
export const PROGRAM_CYCLES = 3;

/** Status bits captured into the instruction register above the mandatory 01. */
export const IR_STATUS_ISC = 0x04;
export const IR_STATUS_BUSY = 0x08;
export const IR_STATUS_ERROR = 0x10;

export function decodeIrCapture(v: number): { valid: boolean; isc: boolean; busy: boolean; error: boolean } {
  return { valid: (v & 3) === 1, isc: !!(v & IR_STATUS_ISC), busy: !!(v & IR_STATUS_BUSY), error: !!(v & IR_STATUS_ERROR) };
}

/** Bits of a number, least significant first. */
export function numberToBits(v: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = Math.floor(v / 2 ** i) & 1;
  return out;
}

export function bitsToNumber(bits: ArrayLike<number>): number {
  let v = 0;
  for (let i = 0; i < bits.length; i++) if (bits[i]) v += 2 ** i;
  return v;
}

export type BoundaryCellKind = 'input' | 'output' | 'control' | 'global-input';

export interface BoundaryCell {
  index: number;
  kind: BoundaryCellKind;
  /** I/O pin, or the global pin name. */
  pin: number | 'GCLK' | 'GSR' | 'GOE';
  text: string;
}

export function describeBoundaryCell(index: number): BoundaryCell {
  if (!Number.isInteger(index) || index < 0 || index >= BSR_LENGTH) throw new Error(`Boundary cell ${index} out of range (0–${BSR_LENGTH - 1})`);
  if (index >= 3 * IO_PINS) {
    const pin = (['GCLK', 'GSR', 'GOE'] as const)[index - 3 * IO_PINS]!;
    return { index, kind: 'global-input', pin, text: `${pin} input cell` };
  }
  const io = Math.floor(index / 3);
  const kind = (['input', 'output', 'control'] as const)[index % 3]!;
  const what = kind === 'input' ? 'input (pin level)' : kind === 'output' ? 'output data' : 'output enable';
  return { index, kind, pin: io, text: `IO${io} ${what} cell` };
}

// ---------------------------------------------------------------------------------------------
// The port

/** What a host sees of a device with a JTAG port. */
export interface JtagTarget {
  readonly state: TapState;
  /** One TCK cycle. Returns what the device drives on TDO during it (null when TDO is high-impedance). */
  tck(tms: 0 | 1, tdi: 0 | 1): 0 | 1 | null;
  /** Name of the instruction in the instruction register (for traces). */
  readonly instructionName?: string;
}

export interface PinState {
  level: Level;
  driver: 'device' | 'external' | 'none';
  /** The device and the outside world drive the pin to different levels. */
  conflict: boolean;
}

type DrKind = 'bsr' | 'idcode' | 'usercode' | 'bypass' | 'row';

/**
 * A vCPLD-32 with its JTAG port and its pins: `tck` runs the TAP, and the outside world is set
 * with `setPin` (what the board drives onto a pin, or undefined for a floating pin) and `setGlobal`.
 */
export class CpldJtag implements JtagTarget {
  readonly device: VCpld32;
  state: TapState = 'Test-Logic-Reset';
  /** The current instruction (loaded at Update-IR). */
  ir: number = INSTRUCTIONS.IDCODE;
  private irShift = 0;
  private dr: Uint8Array = new Uint8Array(1);
  private readonly outLatch = new Uint8Array(IO_PINS);
  private readonly oeLatch = new Uint8Array(IO_PINS);
  private readonly ext: (Level | undefined)[] = new Array<Level | undefined>(IO_PINS).fill(undefined);
  private gclk: Level = 0;
  private gsr: Level = 0;
  private goe: Level = 0;
  /** Remaining Run-Test/Idle cycles of an erase or program pulse. */
  busyCycles = 0;
  error = false;
  /** Row address latched by ISC_PROGRAM / ISC_VERIFY. */
  address = 0;
  /** Called after anything that can change what the device drives on its pins. */
  onChange?: () => void;

  constructor(device?: VCpld32) {
    this.device = device ?? new VCpld32();
  }

  get instructionName(): string {
    return instructionName(this.ir);
  }

  /** Power off and on: the configuration stays; the TAP, the boundary latches and the flip-flops restart. */
  powerCycle(): void {
    this.device.powerCycle();
    this.state = 'Test-Logic-Reset';
    this.resetTap();
    this.gclk = 0;
    this.changed();
  }

  private changed(): void {
    this.onChange?.();
  }

  private resetTap(): void {
    this.ir = INSTRUCTIONS.IDCODE;
    this.outLatch.fill(0);
    this.oeLatch.fill(0);
    this.busyCycles = 0;
    this.error = false;
    this.address = 0;
    if (this.device.iscMode) {
      this.device.iscMode = false;
      this.device.resetRegisters();
    }
  }

  // -- The world outside ---------------------------------------------------------------------------

  /** Set what the board drives onto a pin (undefined: nothing drives it). */
  setPin(io: number, level: Level | undefined): void {
    this.ext[io] = level === undefined ? undefined : level ? 1 : 0;
  }

  getExternal(io: number): Level | undefined {
    return this.ext[io];
  }

  /** Set the level of GCLK, GSR or GOE. A rising edge of GCLK clocks the core unless it is isolated or being programmed. */
  setGlobal(name: 'gclk' | 'gsr' | 'goe', level: number): void {
    const v: Level = level ? 1 : 0;
    if (name === 'gsr') this.gsr = v;
    else if (name === 'goe') this.goe = v;
    else {
      const rising = this.gclk === 0 && v === 1;
      this.gclk = v;
      if (rising && this.coreActive()) this.device.clock(this.coreInputs());
    }
    this.changed();
  }

  getGlobal(name: 'gclk' | 'gsr' | 'goe'): Level {
    return name === 'gsr' ? this.gsr : name === 'goe' ? this.goe : this.gclk;
  }

  /** True when the core is connected to the pins and running (not EXTEST, HIGHZ or programming mode). */
  private coreActive(): boolean {
    return !this.device.iscMode && this.ir !== INSTRUCTIONS.EXTEST && this.ir !== INSTRUCTIONS.HIGHZ;
  }

  private coreInputs() {
    return { pins: this.ext.map((v) => v ?? 0), gsr: this.gsr, goe: this.goe };
  }

  /** The core's settled state for the current pins (for display and for capture). */
  evaluate(): CpldSnapshot {
    return this.device.evaluate(this.coreInputs());
  }

  /** What the device drives on a pin right now (undefined: not driving). */
  driveOf(io: number, snap?: CpldSnapshot): Level | undefined {
    if (this.device.iscMode || this.ir === INSTRUCTIONS.HIGHZ) return undefined;
    if (this.ir === INSTRUCTIONS.EXTEST) return this.oeLatch[io] ? (this.outLatch[io] as Level) : undefined;
    const s = snap ?? this.evaluate();
    return s.driven[io] ? s.pins[io] : undefined;
  }

  pinState(io: number, snap?: CpldSnapshot): PinState {
    const dev = this.driveOf(io, snap);
    const ext = this.ext[io];
    return {
      level: dev ?? ext ?? 0,
      driver: dev !== undefined ? 'device' : ext !== undefined ? 'external' : 'none',
      conflict: dev !== undefined && ext !== undefined && dev !== ext,
    };
  }

  pinStates(): PinState[] {
    const snap = this.evaluate();
    return Array.from({ length: IO_PINS }, (_, io) => this.pinState(io, snap));
  }

  // -- The TAP -----------------------------------------------------------------------------------------

  private selectedDr(): DrKind {
    switch (this.ir) {
      case INSTRUCTIONS.EXTEST:
      case INSTRUCTIONS.SAMPLE_PRELOAD:
        return 'bsr';
      case INSTRUCTIONS.IDCODE:
        return 'idcode';
      case INSTRUCTIONS.USERCODE:
        return 'usercode';
      case INSTRUCTIONS.ISC_PROGRAM:
      case INSTRUCTIONS.ISC_VERIFY:
        return 'row';
      default:
        return 'bypass';
    }
  }

  private irCapture(): number {
    return 0x01 | (this.device.iscMode ? IR_STATUS_ISC : 0) | (this.busyCycles > 0 ? IR_STATUS_BUSY : 0) | (this.error ? IR_STATUS_ERROR : 0);
  }

  private captureDr(): void {
    switch (this.selectedDr()) {
      case 'bsr': {
        const snap = this.evaluate();
        const cells = new Uint8Array(BSR_LENGTH);
        for (let io = 0; io < IO_PINS; io++) {
          cells[3 * io] = this.pinState(io, snap).level;
          cells[3 * io + 1] = snap.mc[io]!;
          cells[3 * io + 2] = snap.oe[io] ? 1 : 0;
        }
        cells[3 * IO_PINS] = this.gclk;
        cells[3 * IO_PINS + 1] = this.gsr;
        cells[3 * IO_PINS + 2] = this.goe;
        this.dr = cells;
        break;
      }
      case 'idcode':
        this.dr = numberToBits(IDCODE_VALUE, 32);
        break;
      case 'usercode':
        this.dr = numberToBits(getUsercode(this.device.bits), USERCODE_BITS);
        break;
      case 'row': {
        const out = new Uint8Array(ROW_REGISTER_LENGTH);
        if (this.address < ROW_COUNT) out.set(getRow(this.device.bits, this.address));
        out.set(numberToBits(this.address, 8), ROW_BITS);
        this.dr = out;
        break;
      }
      default:
        this.dr = new Uint8Array(1);
    }
  }

  private updateDr(): void {
    const kind = this.selectedDr();
    if (kind === 'bsr') {
      for (let io = 0; io < IO_PINS; io++) {
        this.outLatch[io] = this.dr[3 * io + 1]!;
        this.oeLatch[io] = this.dr[3 * io + 2]!;
      }
      this.changed();
    } else if (kind === 'row') {
      const row = bitsToNumber(this.dr.subarray(ROW_BITS, ROW_REGISTER_LENGTH));
      if (!this.device.iscMode || row >= ROW_COUNT) {
        this.error = true;
        return;
      }
      if (this.ir === INSTRUCTIONS.ISC_PROGRAM) {
        if (this.busyCycles > 0) {
          this.error = true;
          return;
        }
        this.device.programRow(row, this.dr.subarray(0, ROW_BITS));
        this.busyCycles = PROGRAM_CYCLES;
      }
      this.address = row;
    }
  }

  private updateIr(): void {
    this.ir = this.irShift;
    switch (this.ir) {
      case INSTRUCTIONS.ISC_ENABLE:
        if (!this.device.iscMode) {
          this.device.iscMode = true;
          this.error = false;
          this.address = 0;
        }
        break;
      case INSTRUCTIONS.ISC_ERASE:
        if (!this.device.iscMode || this.busyCycles > 0) this.error = true;
        else {
          this.device.erase();
          this.busyCycles = ERASE_CYCLES;
          this.address = 0;
        }
        break;
      case INSTRUCTIONS.ISC_DISABLE:
        if (this.device.iscMode) {
          this.device.iscMode = false;
          this.device.resetRegisters();
          this.address = 0;
        }
        break;
      default:
        break;
    }
    this.changed();
  }

  tck(tms: 0 | 1, tdi: 0 | 1): 0 | 1 | null {
    const s = this.state;
    let tdo: 0 | 1 | null = null;
    if (s === 'Shift-DR') tdo = this.dr[0] as 0 | 1;
    else if (s === 'Shift-IR') tdo = (this.irShift & 1) as 0 | 1;
    // Rising edge, in state s.
    switch (s) {
      case 'Run-Test/Idle':
        if (this.busyCycles > 0) this.busyCycles--;
        break;
      case 'Capture-DR':
        this.captureDr();
        break;
      case 'Shift-DR': {
        this.dr.copyWithin(0, 1);
        this.dr[this.dr.length - 1] = tdi ? 1 : 0;
        break;
      }
      case 'Capture-IR':
        this.irShift = this.irCapture();
        break;
      case 'Shift-IR':
        this.irShift = (this.irShift >> 1) | ((tdi ? 1 : 0) << (IR_LENGTH - 1));
        break;
      default:
        break;
    }
    const next = nextTapState(s, tms);
    this.state = next;
    // Falling edge, in the state just entered.
    if (next === 'Update-DR') this.updateDr();
    else if (next === 'Update-IR') this.updateIr();
    else if (next === 'Test-Logic-Reset') {
      const was = this.ir;
      this.resetTap();
      if (was !== this.ir || s !== 'Test-Logic-Reset') this.changed();
    }
    return tdo;
  }
}

// ---------------------------------------------------------------------------------------------
// The host

export interface JtagCycle {
  /** Number of the TCK cycle, from 0. */
  cycle: number;
  /** TAP state before the rising edge. */
  state: TapState;
  tms: 0 | 1;
  tdi: 0 | 1;
  /** What the device drove on TDO (null: high-impedance). */
  tdo: 0 | 1 | null;
  /** TAP state after the edge. */
  next: TapState;
  /** The instruction in the instruction register before the edge. */
  instruction: string;
}

export interface BoundaryCells {
  input: Level[];
  output: Level[];
  control: Level[];
  gclk: Level;
  gsr: Level;
  goe: Level;
}

export function decodeBoundaryCells(bits: ArrayLike<number>): BoundaryCells {
  const pick = (off: number): Level[] => Array.from({ length: IO_PINS }, (_, io) => (bits[3 * io + off] ? 1 : 0) as Level);
  return {
    input: pick(0),
    output: pick(1),
    control: pick(2),
    gclk: bits[3 * IO_PINS] ? 1 : 0,
    gsr: bits[3 * IO_PINS + 1] ? 1 : 0,
    goe: bits[3 * IO_PINS + 2] ? 1 : 0,
  };
}

export interface ProgramOptions {
  /** Skip rows that are all zero (the device is erased first anyway). Default true. */
  skipBlank?: boolean;
  /** Read the device back and compare. Default true. */
  verify?: boolean;
  /** Leave programming mode afterwards, restarting the device. Default true. */
  exit?: boolean;
}

export interface VerifyResult {
  ok: boolean;
  mismatches: { row: number; expected: Uint8Array; actual: Uint8Array }[];
}

export interface ProgramResult extends VerifyResult {
  rowsProgrammed: number;
  cycles: number;
  /** True if the status bits reported an error at any point. */
  error: boolean;
}

/**
 * Drives a JTAG target with TMS/TDI sequences and records a trace of every TCK cycle. A host does
 * not read the target's state: it tracks the TAP state itself from the TMS values it sends (it
 * starts out assuming the state the target reports, which is Test-Logic-Reset for a fresh port,
 * and `reset()` makes it certain).
 */
export class JtagHost {
  readonly trace: JtagCycle[] = [];
  readonly marks: { cycle: number; label: string }[] = [];
  cycles = 0;
  state: TapState;
  private readonly recording: boolean;
  private readonly limit: number;

  constructor(
    readonly target: JtagTarget,
    opts: { trace?: boolean; traceLimit?: number } = {},
  ) {
    this.state = target.state;
    this.recording = opts.trace ?? true;
    this.limit = opts.traceLimit ?? 250000;
  }

  /** Label the current point of the trace (for animation captions). */
  mark(label: string): void {
    this.marks.push({ cycle: this.cycles, label });
  }

  clearTrace(): void {
    this.trace.length = 0;
    this.marks.length = 0;
  }

  /** One TCK cycle. */
  clock(tms: 0 | 1, tdi: 0 | 1 = 0): 0 | 1 | null {
    const state = this.state;
    const instruction = this.target.instructionName ?? '';
    const tdo = this.target.tck(tms, tdi);
    this.state = nextTapState(state, tms);
    if (this.recording && this.trace.length < this.limit) this.trace.push({ cycle: this.cycles, state, tms, tdi, tdo, next: this.state, instruction });
    this.cycles++;
    return tdo;
  }

  /** Five cycles with TMS = 1 (Test-Logic-Reset from anywhere), then one with TMS = 0 to Run-Test/Idle. */
  reset(): void {
    for (let i = 0; i < 5; i++) this.clock(1);
    this.clock(0);
  }

  goto(state: TapState): void {
    for (const tms of tapPath(this.state, state)) this.clock(tms);
  }

  /** `n` cycles in Run-Test/Idle. */
  idle(n: number): void {
    this.goto('Run-Test/Idle');
    for (let i = 0; i < n; i++) this.clock(0);
  }

  /**
   * Shift `bits` (first element first) through the selected data register and return what came out.
   * The scan starts from Run-Test/Idle (or wherever the TAP is) and ends in Run-Test/Idle, going
   * through Update-DR.
   */
  shiftDr(bits: ArrayLike<number>, length = bits.length): Uint8Array {
    this.goto('Shift-DR');
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      const tdo = this.clock(i === length - 1 ? 1 : 0, (bits[i] ? 1 : 0) as 0 | 1);
      out[i] = tdo ? 1 : 0;
    }
    this.goto('Run-Test/Idle');
    return out;
  }

  /** Load an instruction; returns what the register captured (the status bits). */
  shiftIr(code: number, length = IR_LENGTH): number {
    this.goto('Shift-IR');
    const bits = numberToBits(code, length);
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) out[i] = this.clock(i === length - 1 ? 1 : 0, bits[i] as 0 | 1) ? 1 : 0;
    this.goto('Run-Test/Idle');
    return bitsToNumber(out);
  }

  loadInstruction(name: InstructionName): number {
    return this.shiftIr(INSTRUCTIONS[name]);
  }

  /** Reset the TAP, which selects IDCODE, and read the 32-bit identification. */
  readIdcode(): number {
    this.reset();
    return bitsToNumber(this.shiftDr(new Uint8Array(32)));
  }

  readUsercode(): number {
    this.loadInstruction('USERCODE');
    return bitsToNumber(this.shiftDr(new Uint8Array(USERCODE_BITS)));
  }

  /** Instruction-register status bits (loads BYPASS). */
  readStatus(): { valid: boolean; isc: boolean; busy: boolean; error: boolean } {
    return decodeIrCapture(this.loadInstruction('BYPASS'));
  }

  // -- Boundary scan ------------------------------------------------------------------------------------

  /** SAMPLE: capture every boundary cell without disturbing the device. */
  sample(): BoundaryCells {
    this.loadInstruction('SAMPLE_PRELOAD');
    // Shifting zeros through would preload zeros; harmless under SAMPLE/PRELOAD (pins stay under the core).
    return decodeBoundaryCells(this.shiftDr(new Uint8Array(BSR_LENGTH)));
  }

  /** Bits for the boundary register that drive the given levels (undefined: leave the pin off). */
  private driveBits(drive: ArrayLike<Level | undefined>): Uint8Array {
    const cells = new Uint8Array(BSR_LENGTH);
    for (let io = 0; io < IO_PINS; io++) {
      const v = drive[io];
      if (v !== undefined) {
        cells[3 * io + 1] = v ? 1 : 0;
        cells[3 * io + 2] = 1;
      }
    }
    return cells;
  }

  /** PRELOAD: latch levels to drive without driving them yet. */
  preload(drive: ArrayLike<Level | undefined>): void {
    this.loadInstruction('SAMPLE_PRELOAD');
    this.shiftDr(this.driveBits(drive));
  }

  /**
   * EXTEST: drive the given levels on pins (undefined: not driven) and capture what the pins then
   * show. The levels are preloaded first so that the pins change only when EXTEST is selected, and
   * shifted in again during the capture so that they stay driven.
   */
  extest(drive: ArrayLike<Level | undefined>): BoundaryCells {
    this.preload(drive);
    this.loadInstruction('EXTEST');
    const bits = this.driveBits(drive);
    this.shiftDr(bits);
    return decodeBoundaryCells(this.shiftDr(bits));
  }

  // -- In-system programming ------------------------------------------------------------------------------

  enableIsc(): void {
    this.mark('ISC_ENABLE: enter programming mode');
    this.loadInstruction('ISC_ENABLE');
    this.idle(1);
  }

  erase(): void {
    this.mark('ISC_ERASE: bulk erase');
    this.loadInstruction('ISC_ERASE');
    this.idle(ERASE_CYCLES);
  }

  disableIsc(): void {
    this.mark('ISC_DISABLE: leave programming mode and restart');
    this.loadInstruction('ISC_DISABLE');
    this.idle(2);
  }

  /** The 72 bits of the row register for a row: 64 data bits, then the address. */
  static rowScan(row: number, data?: ArrayLike<number>): Uint8Array {
    const bits = new Uint8Array(ROW_REGISTER_LENGTH);
    if (data) for (let i = 0; i < ROW_BITS; i++) bits[i] = data[i] ? 1 : 0;
    bits.set(numberToBits(row, 8), ROW_BITS);
    return bits;
  }

  /** Program the rows of `bits` (ISC_PROGRAM must be loaded first; returns the number of rows written). */
  programRows(bits: ArrayLike<number>, skipBlank = true): number {
    let n = 0;
    for (let row = 0; row < ROW_COUNT; row++) {
      const data = getRow(bits, row);
      if (skipBlank && !data.some((b) => b)) continue;
      if (n === 0 || row % 16 === 0) this.mark(`ISC_PROGRAM: row ${row}`);
      this.shiftDr(JtagHost.rowScan(row, data));
      this.idle(PROGRAM_CYCLES);
      n++;
    }
    return n;
  }

  /** Read rows back with ISC_VERIFY (pipelined: N + 1 scans for N rows). */
  readBack(rows: number[] = Array.from({ length: ROW_COUNT }, (_, i) => i)): Uint8Array[] {
    this.mark('ISC_VERIFY: read back');
    this.loadInstruction('ISC_VERIFY');
    const out: Uint8Array[] = [];
    let prev = -1;
    for (const row of [...rows, rows[rows.length - 1] ?? 0]) {
      const captured = this.shiftDr(JtagHost.rowScan(row));
      if (prev >= 0) out.push(captured.slice(0, ROW_BITS));
      prev = row;
    }
    return out;
  }

  /** Compare the device's rows with `bits`. */
  verify(bits: ArrayLike<number>): VerifyResult {
    const rows = Array.from({ length: ROW_COUNT }, (_, i) => i);
    const actual = this.readBack(rows);
    const mismatches: VerifyResult['mismatches'] = [];
    rows.forEach((row, i) => {
      const expected = getRow(bits, row);
      const got = actual[i]!;
      if (expected.some((b, k) => b !== got[k])) mismatches.push({ row, expected, actual: got });
    });
    return { ok: mismatches.length === 0, mismatches };
  }

  /** The device's whole configuration, read through ISC_VERIFY. */
  readConfiguration(): Uint8Array {
    const rows = this.readBack();
    const bits = new Uint8Array(BIT_COUNT);
    rows.forEach((r, i) => bits.set(r, i * ROW_BITS));
    return bits;
  }

  /**
   * The whole programming sequence: reset, ISC_ENABLE, ISC_ERASE, ISC_PROGRAM row by row, ISC_VERIFY,
   * ISC_DISABLE, with `mark`s for the trace.
   */
  programDevice(bits: ArrayLike<number>, opts: ProgramOptions = {}): ProgramResult {
    if (bits.length !== BIT_COUNT) throw new Error(`A vCPLD-32 has ${BIT_COUNT} configuration bits, not ${bits.length}`);
    const start = this.cycles;
    let error = false;
    this.mark('Reset the TAP: five cycles with TMS = 1');
    this.reset();
    this.enableIsc();
    this.erase();
    this.mark('ISC_PROGRAM: load the instruction');
    this.loadInstruction('ISC_PROGRAM');
    const rowsProgrammed = this.programRows(bits, opts.skipBlank ?? true);
    let result: VerifyResult = { ok: true, mismatches: [] };
    if (opts.verify ?? true) result = this.verify(bits);
    const status = this.readStatus();
    error = status.error;
    if (opts.exit ?? true) this.disableIsc();
    return { ...result, rowsProgrammed, cycles: this.cycles - start, error };
  }
}

// ---------------------------------------------------------------------------------------------
// A board: nets between the pins of devices, for boundary-scan interconnect tests

export type NetFault = 'open' | 'stuck0' | 'stuck1';

export interface BoardNet {
  name: string;
  ends: { chip: CpldJtag; pin: number }[];
  /** A manufacturing fault: 'open' cuts the net between its ends; 'stuck0'/'stuck1' tie it to a rail. */
  fault?: NetFault;
}

/**
 * Wires pins of devices together and resolves each net from what the devices drive, so that
 * EXTEST on one device and SAMPLE on another can find a broken board. Nets settle automatically
 * whenever a connected device's drive changes.
 */
export class JtagBoard {
  readonly nets: BoardNet[] = [];
  private settling = false;

  connect(name: string, a: { chip: CpldJtag; pin: number }, b: { chip: CpldJtag; pin: number }, fault?: NetFault): BoardNet {
    const net: BoardNet = { name, ends: [a, b], fault };
    this.nets.push(net);
    for (const chip of new Set([a.chip, b.chip])) chip.onChange = () => this.settle();
    this.settle();
    return net;
  }

  settle(): void {
    if (this.settling) return;
    this.settling = true;
    try {
      for (const net of this.nets) {
        const drives = net.ends.map((e) => e.chip.driveOf(e.pin));
        net.ends.forEach((e, k) => {
          let level: Level | undefined;
          if (net.fault === 'stuck0') level = 0;
          else if (net.fault === 'stuck1') level = 1;
          else if (net.fault !== 'open') {
            const others = drives.filter((_, j) => j !== k).filter((d): d is Level => d !== undefined);
            level = others.length ? (others.every((v) => v === others[0]) ? others[0] : 0) : undefined;
          }
          e.chip.setPin(e.pin, level);
        });
      }
    } finally {
      this.settling = false;
    }
  }
}
