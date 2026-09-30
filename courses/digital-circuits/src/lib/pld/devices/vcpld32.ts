/**
 * The vCPLD-32 simulated from its configuration bits (layout and architecture: `vcpld32-arch.ts`).
 *
 * The device has non-volatile configuration memory: `program()` writes it, `powerCycle()` loses
 * only the flip-flop contents, and the device comes back up already configured (instant-on) with
 * every flip-flop at its `init` value. Nothing else is remembered.
 *
 * Behaviour, from the bits alone:
 *
 * - Every function block input is a 64-way multiplexer over the 32 pin levels and the 32
 *   macrocell outputs. A product term is true when it is enabled and every connected literal is
 *   true. A macrocell's OR gate collects the terms steered to it (its own, and its neighbours'
 *   that were steered up or down), the XOR bit inverts the sum, and the result is either the
 *   output directly or the flip-flop's D (or T) input. Feedback into the matrix is the output
 *   itself, before the pin buffer.
 * - A pin is driven by its macrocell when the output enable says so; otherwise the pin is an input
 *   and shows the external level. Feedback through combinational macrocells settles by iteration;
 *   a loop that does not settle is reported by `stable = false`.
 * - GSR (global set/reset, level 1) asynchronously puts every flip-flop at its `init` value and
 *   holds it there. A rising edge of the global clock (`clock()`) loads D flip-flops with their
 *   input and toggles T flip-flops whose input is 1, all at once, from the settled levels before
 *   the edge.
 * - In in-system-programming mode (`iscMode`, entered through JTAG) every output buffer is off and
 *   the flip-flops ignore the clock.
 */
import {
  BIT_COUNT,
  FB_INPUTS,
  FUNCTION_BLOCKS,
  IO_PINS,
  MACROCELLS,
  OE_ALWAYS,
  OE_GLOBAL,
  OE_TERM,
  ROW_BITS,
  ROW_COUNT,
  TERMS_PER_FB,
  decodeConfig,
  getRow,
  getUsercode,
  toFuseMap,
  type CpldConfig,
  type CpldFuseMap,
  type Level,
} from './vcpld32-arch';

export type { Level };

/** External levels on the I/O pins (index = pin number 0–31); pins not listed read 0. */
export type CpldPinLevels = Partial<Record<number, Level>> | ArrayLike<number | undefined>;

export interface CpldInputs {
  pins?: CpldPinLevels;
  /** Global set/reset level (default 0). */
  gsr?: number;
  /** Global output-enable level (default 0). */
  goe?: number;
}

export interface CpldSnapshot {
  /** Level of every I/O pin: the macrocell output where it drives the pin, the external level elsewhere. */
  pins: Level[];
  /** True for pins driven by the device. */
  driven: boolean[];
  /** Output of every macrocell (the flip-flop's Q, or the combinational output), before the pin buffer. */
  mc: Level[];
  /** Flip-flop contents (0 for combinational macrocells). */
  q: Level[];
  /** OR of the terms of each macrocell, before the XOR. */
  sums: Level[];
  /** The macrocell's D/T input: sum XOR `xor`. */
  d: Level[];
  /** Whether each macrocell's output enable is true (the pin is driven unless in programming mode). */
  oe: boolean[];
  /** Value of every product term, block `fb`, term `t` at fb · 40 + t. */
  terms: Uint8Array;
  /** Value of every block input, block `fb`, input `k` at fb · 24 + k. */
  inputs: Uint8Array;
  gsr: Level;
  goe: Level;
  /** False if combinational feedback did not settle (a loop that oscillates). */
  stable: boolean;
}

/** The configuration in the form the evaluator wants. */
interface Compiled {
  sel: Uint8Array; // fb·24 + k → source
  trueMask: Uint32Array; // per term (fb·40 + t): inputs required 1
  compMask: Uint32Array; // per term: inputs required 0
  enabled: Uint8Array;
  xor: Uint8Array;
  reg: Uint8Array;
  tff: Uint8Array;
  init: Uint8Array;
  oe: Uint8Array;
  oeTerm: Int16Array; // per macrocell: global term index, or -1
  route: Int16Array[]; // per macrocell: global term indices that reach the OR
}

function compile(cfg: CpldConfig): Compiled {
  const c: Compiled = {
    sel: new Uint8Array(FUNCTION_BLOCKS * FB_INPUTS),
    trueMask: new Uint32Array(FUNCTION_BLOCKS * TERMS_PER_FB),
    compMask: new Uint32Array(FUNCTION_BLOCKS * TERMS_PER_FB),
    enabled: new Uint8Array(FUNCTION_BLOCKS * TERMS_PER_FB),
    xor: new Uint8Array(MACROCELLS),
    reg: new Uint8Array(MACROCELLS),
    tff: new Uint8Array(MACROCELLS),
    init: new Uint8Array(MACROCELLS),
    oe: new Uint8Array(MACROCELLS),
    oeTerm: new Int16Array(MACROCELLS).fill(-1),
    route: [],
  };
  for (const f of cfg.fbs) {
    f.sources.forEach((s, k) => (c.sel[f.fb * FB_INPUTS + k] = s));
    for (const t of f.terms) {
      const g = f.fb * TERMS_PER_FB + t.term;
      c.enabled[g] = t.enabled ? 1 : 0;
      for (const l of t.literals) {
        if (l.complement) c.compMask[g] = (c.compMask[g]! | (1 << l.input)) >>> 0;
        else c.trueMask[g] = (c.trueMask[g]! | (1 << l.input)) >>> 0;
      }
    }
    for (const m of f.macrocells) {
      c.xor[m.io] = m.xor ? 1 : 0;
      c.reg[m.io] = m.registered ? 1 : 0;
      c.tff[m.io] = m.tff ? 1 : 0;
      c.init[m.io] = m.init;
      c.oe[m.io] = m.oe;
      if (m.oe === OE_TERM) c.oeTerm[m.io] = f.fb * TERMS_PER_FB + m.mc * 5 + 4;
      c.route[m.io] = Int16Array.from(m.orTerms.map((t) => f.fb * TERMS_PER_FB + t));
    }
  }
  return c;
}

const level = (v: number | undefined): Level => (v ? 1 : 0);

function pinLevel(p: CpldPinLevels | undefined, io: number): Level {
  if (!p) return 0;
  return level((p as ArrayLike<number | undefined>)[io]);
}

/**
 * A vCPLD-32. Construct it erased (all bits 0) or with a bit array, then `evaluate` for the
 * settled outputs and `clock` for a rising edge on the global clock.
 */
export class VCpld32 {
  private nv: Uint8Array;
  /** Flip-flop contents (volatile), by macrocell 0–31. */
  readonly q = new Uint8Array(MACROCELLS);
  /** In-system-programming mode: outputs off, flip-flops frozen. Set by the JTAG port. */
  iscMode = false;
  private compiled: Compiled | null = null;
  private config: CpldConfig | null = null;

  constructor(bits?: ArrayLike<number>) {
    this.nv = new Uint8Array(BIT_COUNT);
    if (bits) this.program(bits);
    else this.powerCycle();
  }

  /** The non-volatile configuration memory (do not modify; use `setBit`, `program` and `programRow`). */
  get bits(): Readonly<Uint8Array> {
    return this.nv;
  }

  get isBlank(): boolean {
    return this.nv.every((b) => b === 0);
  }

  private changed(): void {
    this.compiled = null;
    this.config = null;
  }

  /** The decoded configuration (blocks, terms, macrocells). */
  decode(): CpldConfig {
    return (this.config ??= decodeConfig(this.nv));
  }

  private code(): Compiled {
    return (this.compiled ??= compile(this.decode()));
  }

  fuseMap(): CpldFuseMap {
    return toFuseMap(this.nv);
  }

  get usercode(): number {
    return getUsercode(this.nv);
  }

  getBit(i: number): Level {
    return this.nv[i] ? 1 : 0;
  }

  /** Write one bit directly (a debugging aid for the studio; real parts are programmed by rows). */
  setBit(i: number, v: number): void {
    if (i < 0 || i >= BIT_COUNT) throw new Error(`Configuration bit ${i} out of range`);
    this.nv[i] = v ? 1 : 0;
    this.changed();
  }

  /**
   * Program the whole device with a bit array (an erase followed by a write), then start up: the
   * flip-flops take their `init` values. The bits stay over `powerCycle()`.
   */
  program(bits: ArrayLike<number>): void {
    if (bits.length !== BIT_COUNT) throw new Error(`A vCPLD-32 has ${BIT_COUNT} configuration bits, not ${bits.length}`);
    for (let i = 0; i < BIT_COUNT; i++) this.nv[i] = bits[i] ? 1 : 0;
    this.changed();
    this.powerCycle();
  }

  /**
   * Bulk erase: every bit back to 0. The device is then inert (no product term enabled, no pin
   * driven). Programming mode, if it was on, stays on.
   */
  erase(): void {
    this.nv.fill(0);
    this.changed();
    this.resetRegisters();
  }

  /**
   * Program one row of 64 bits, as flash does: programming can set bits but not clear them, so the
   * row becomes old OR data (erase first to change a 1 back to 0).
   */
  programRow(row: number, data: ArrayLike<number>): void {
    if (row < 0 || row >= ROW_COUNT) throw new Error(`Row ${row} out of range (0–${ROW_COUNT - 1})`);
    for (let i = 0; i < ROW_BITS; i++) if (data[i]) this.nv[row * ROW_BITS + i] = 1;
    this.changed();
  }

  readRow(row: number): Uint8Array {
    if (row < 0 || row >= ROW_COUNT) throw new Error(`Row ${row} out of range (0–${ROW_COUNT - 1})`);
    return getRow(this.nv, row);
  }

  /**
   * Power off and on: the configuration is kept (it is non-volatile); every flip-flop starts at its
   * `init` value; programming mode is left.
   */
  powerCycle(): void {
    this.iscMode = false;
    this.resetRegisters();
  }

  /** Flip-flops to their `init` values (power-up and GSR). */
  resetRegisters(): void {
    const c = this.code();
    for (let i = 0; i < MACROCELLS; i++) this.q[i] = c.reg[i] ? c.init[i]! : 0;
  }

  /** Settle the logic for the given external pin levels and global signals. */
  evaluate(inputs: CpldInputs = {}): CpldSnapshot {
    const c = this.code();
    const gsr = level(inputs.gsr);
    const goe = level(inputs.goe);
    if (gsr) this.resetRegisters();
    const q = this.q;
    const ext = new Uint8Array(IO_PINS);
    for (let i = 0; i < IO_PINS; i++) ext[i] = pinLevel(inputs.pins, i);
    const pins = new Uint8Array(ext);
    const mc = new Uint8Array(MACROCELLS);
    for (let i = 0; i < MACROCELLS; i++) mc[i] = c.reg[i] ? q[i]! : 0;
    const sums = new Uint8Array(MACROCELLS);
    const d = new Uint8Array(MACROCELLS);
    const oe = new Uint8Array(MACROCELLS);
    const driven = new Uint8Array(MACROCELLS);
    const terms = new Uint8Array(FUNCTION_BLOCKS * TERMS_PER_FB);
    const blockInputs = new Uint8Array(FUNCTION_BLOCKS * FB_INPUTS);
    let stable = false;
    for (let iter = 0; iter < 64 && !stable; iter++) {
      let changed = false;
      for (let fb = 0; fb < FUNCTION_BLOCKS; fb++) {
        let inv = 0;
        for (let k = 0; k < FB_INPUTS; k++) {
          const src = c.sel[fb * FB_INPUTS + k]!;
          const v = src < IO_PINS ? pins[src]! : mc[src - IO_PINS]!;
          blockInputs[fb * FB_INPUTS + k] = v;
          if (v) inv |= 1 << k;
        }
        for (let t = 0; t < TERMS_PER_FB; t++) {
          const g = fb * TERMS_PER_FB + t;
          terms[g] = c.enabled[g] && (c.trueMask[g]! & ~inv) === 0 && (c.compMask[g]! & inv) === 0 ? 1 : 0;
        }
      }
      for (let i = 0; i < MACROCELLS; i++) {
        let s = 0;
        for (const g of c.route[i]!) s |= terms[g]!;
        sums[i] = s;
        d[i] = s ^ c.xor[i]!;
        const out = c.reg[i] ? q[i]! : d[i]!;
        const mode = c.oe[i]!;
        const enabled = mode === OE_ALWAYS || (mode === OE_GLOBAL && goe === 1) || (mode === OE_TERM && terms[c.oeTerm[i]!]! === 1);
        oe[i] = enabled ? 1 : 0;
        const drives = enabled && !this.iscMode;
        const newPin = drives ? out : ext[i]!;
        if (mc[i] !== out || pins[i] !== newPin || driven[i] !== (drives ? 1 : 0)) changed = true;
        mc[i] = out;
        pins[i] = newPin;
        driven[i] = drives ? 1 : 0;
      }
      if (!changed && iter > 0) stable = true;
    }
    return {
      pins: Array.from(pins, level),
      driven: Array.from(driven, (v) => v === 1),
      mc: Array.from(mc, level),
      q: Array.from(q, level),
      sums: Array.from(sums, level),
      d: Array.from(d, level),
      oe: Array.from(oe, (v) => v === 1),
      terms,
      inputs: blockInputs,
      gsr,
      goe,
      stable,
    };
  }

  /**
   * A rising edge on the global clock. The external levels are held across the edge: every
   * flip-flop samples its input from the settled logic, then all load (D) or toggle (T) together,
   * then the logic settles again. GSR = 1 holds the flip-flops at `init` instead; programming mode
   * ignores the clock. Returns the snapshot after the edge.
   */
  clock(inputs: CpldInputs = {}): CpldSnapshot {
    const before = this.evaluate(inputs);
    if (before.gsr || this.iscMode) return before;
    const c = this.code();
    const next = new Uint8Array(MACROCELLS);
    for (let i = 0; i < MACROCELLS; i++) {
      if (!c.reg[i]) continue;
      next[i] = c.tff[i] ? this.q[i]! ^ before.d[i]! : before.d[i]!;
    }
    this.q.set(next);
    return this.evaluate(inputs);
  }
}

// ---------------------------------------------------------------------------------------------
// Simulation helpers

export interface CpldStep {
  pins?: CpldPinLevels;
  gsr?: number;
  goe?: number;
  /** Apply a rising clock edge after the inputs settle (default true); false only evaluates. */
  clock?: boolean;
}

/**
 * Run a configuration on a fresh, powered-up device through a sequence of steps. Each step applies
 * its inputs, settles, and (unless `clock: false`) gives one rising edge on the global clock; the
 * result is the snapshot after each step.
 */
export function simulate(bits: ArrayLike<number>, steps: CpldStep[]): CpldSnapshot[] {
  const dev = new VCpld32(bits);
  return runSteps(dev, steps);
}

/** As `simulate`, on an existing device (its flip-flops keep their state). */
export function runSteps(dev: VCpld32, steps: CpldStep[]): CpldSnapshot[] {
  return steps.map((s) => {
    const inputs: CpldInputs = { pins: s.pins, gsr: s.gsr, goe: s.goe };
    return s.clock === false ? dev.evaluate(inputs) : dev.clock(inputs);
  });
}
