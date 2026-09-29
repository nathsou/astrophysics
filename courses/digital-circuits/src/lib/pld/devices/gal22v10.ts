/**
 * A faithful model of the GAL22V10 (Lattice) / ATF22V10 (Microchip, formerly Atmel): its pins, its
 * 5,892-fuse JEDEC map, and a simulator that runs the device from the fuses alone.
 *
 * Pins: 1 clock and array input; 2–11 and 13 inputs; 12 GND; 24 VCC; 14–23 input/outputs, each
 * with an output logic macrocell (OLMC).
 *
 * The AND array has 44 columns: 22 signals, each in true and complement form. Column 2k carries
 * signal k, column 2k+1 its complement. The signals alternate between dedicated inputs and OLMC
 * feedbacks:
 *
 *   dedicated input pin p (1–11):  column 4(p − 1)          pin 1 → 0, pin 2 → 4, …, pin 11 → 40
 *   dedicated input pin 13:        column 42
 *   OLMC pin p (14–23):            column 2 + 4(23 − p)     pin 23 → 2, pin 22 → 6, …, pin 14 → 38
 *
 * The array has 132 rows of 44 fuses (5,808 fuses): row 0 is the asynchronous reset (AR) term;
 * then, for each OLMC from pin 23 down to pin 14, one output-enable row followed by its product
 * term rows; row 131 is the synchronous preset (SP) term. The product-term counts, pin 23 first,
 * are 8, 10, 12, 14, 16, 16, 14, 12, 10, 8, so the OLMCs start at rows
 *
 *   pin   23   22   21   20   19   18   17   16   15   14
 *   OE     1   10   21   34   49   66   83   98  111  122
 *   terms  8   10   12   14   16   16   14   12   10    8
 *
 * and fuse number = 44 × row + column. After the array come 20 configuration fuses, two per OLMC
 * from pin 23 down: fuse 5808 + 2(23 − p) is S0 and the next is S1 of pin p. Then 64 user
 * signature fuses (5828–5891): 8 bytes, most significant bit first.
 *
 *   S0 = 1 active high, 0 active low;   S1 = 1 combinational, 0 registered.
 *
 * In the JEDEC file a fuse value 0 connects the array input to the product term; 1 leaves it out.
 * A row of all 1s is therefore the constant 1, and a row with both columns of any signal at 0 is
 * the constant 0 (unused rows are all 0).
 *
 * Sources and checks: the layout is galette's (Simon Frankau's Rust port of GALasm,
 * github.com/simon-frankau/galette, MIT): `chips.rs` has the OLMC start rows 122, 111, 98, 83, 66,
 * 49, 34, 21, 10, 1 for pins 14…23 with 9, 11, 13, 15, 17, 17, 15, 13, 11, 9 rows each (an OE row
 * plus 8, 10, 12, 14, 16, 16, 14, 12, 10, 8 product terms; this is the 8-10-12-14-16-16-14-12-10-8
 * pattern of the datasheets, which I recalled rather than re-read), AR at row 0, SP at row 131, and 5,892 fuses
 * in all; `gal.rs` has the pin-to-column table and the inverted registered feedback; `writer.rs`
 * writes S0/S1 interleaved from pin 23, then the signature. `gal22v10-pld.ts` assembles `.pld`
 * files the way galette does and `gal22v10-galette.test.ts` (run with GALETTE_DIR set) checks
 * that the JEDEC files are identical to galette's byte for byte, for galette's own test cases;
 * the frozen copies of some of them in `gal22v10-galette-cases.ts` run in the normal tests.
 * That establishes that this fuse map programs a part the way the assembler people use to program
 * real GAL22V10s does. What the map does once programmed (the simulator below) follows the
 * datasheet's macrocell description as galette's `needs_flip` comment states it; it has not been
 * compared with a physical part.
 *
 * Macrocell behaviour (simulated below):
 * - Combinational (S1 = 1): pin = sum when active high, ¬sum when active low. The feedback into
 *   the array is the pin itself, so a combinational OLMC whose output enable is off is an input.
 * - Registered (S1 = 0): D = sum is clocked on the rising edge of pin 1. The pin is Q when active
 *   high, ¬Q when active low. The feedback is always ¬Q (the register's inverting output), whatever
 *   the polarity, and never the pin; so in active-high mode the feedback is the complement of the
 *   pin. (galette's `needs_flip` compensates for this when assembling.)
 * - Output enable: the pin is driven when its OE product term is true, otherwise it floats.
 * - AR (row 0), when true, resets every register to Q = 0 at once (asynchronously). SP (row 131),
 *   when true at a rising clock edge, sets every register to Q = 1 instead of loading D. AR wins
 *   over SP. At power-up every register is reset (Q = 0).
 */

export const PINS = 24;
export const ROWS = 132;
export const COLUMNS = 44;
export const ARRAY_FUSES = ROWS * COLUMNS; // 5808
export const CONFIG_BASE = ARRAY_FUSES; // 5808
export const SIGNATURE_BASE = CONFIG_BASE + 20; // 5828
export const FUSE_COUNT = SIGNATURE_BASE + 64; // 5892
export const AR_ROW = 0;
export const SP_ROW = 131;
export const CLOCK_PIN = 1;
export const GND_PIN = 12;
export const VCC_PIN = 24;

/** OLMC pins in fuse-map order (pin 23 first). */
export const OLMC_PINS = [23, 22, 21, 20, 19, 18, 17, 16, 15, 14] as const;
/** Dedicated input pins (pin 1 doubles as the clock). */
export const INPUT_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13] as const;
/** Product terms per OLMC, by pin. */
export const PRODUCT_TERMS: Readonly<Record<number, number>> = {
  23: 8,
  22: 10,
  21: 12,
  20: 14,
  19: 16,
  18: 16,
  17: 14,
  16: 12,
  15: 10,
  14: 8,
};

export function isOlmcPin(pin: number): boolean {
  return pin >= 14 && pin <= 23;
}

export function isInputPin(pin: number): boolean {
  return (pin >= 1 && pin <= 11) || pin === 13;
}

/** OLMC index in fuse-map order: 0 for pin 23 … 9 for pin 14. */
export function olmcIndex(pin: number): number {
  if (!isOlmcPin(pin)) throw new Error(`Pin ${pin} has no macrocell`);
  return 23 - pin;
}

/** Row of the OE term of an OLMC; its product terms follow it. */
export function olmcOeRow(pin: number): number {
  let row = 1;
  for (const p of OLMC_PINS) {
    if (p === pin) return row;
    row += PRODUCT_TERMS[p]! + 1;
  }
  throw new Error(`Pin ${pin} has no macrocell`);
}

export interface OlmcRows {
  pin: number;
  oeRow: number;
  firstTermRow: number;
  terms: number;
}

export function olmcRows(pin: number): OlmcRows {
  const oeRow = olmcOeRow(pin);
  return { pin, oeRow, firstTermRow: oeRow + 1, terms: PRODUCT_TERMS[pin]! };
}

/** The true-form column of a pin's signal (add 1 for the complement). */
export function pinColumn(pin: number): number {
  if (pin >= 1 && pin <= 11) return 4 * (pin - 1);
  if (pin === 13) return 42;
  if (isOlmcPin(pin)) return 2 + 4 * (23 - pin);
  throw new Error(`Pin ${pin} is not an input to the AND array`);
}

/** The pin whose signal a column carries, and whether it is the complement. */
export function columnSignal(column: number): { pin: number; complement: boolean } {
  if (column < 0 || column >= COLUMNS) throw new Error(`Column ${column} out of range`);
  const k = column >> 1;
  const complement = (column & 1) === 1;
  if (k === 21) return { pin: 13, complement };
  if (k % 2 === 0) return { pin: k / 2 + 1, complement };
  return { pin: 23 - (k - 1) / 2, complement };
}

export function fuseIndex(row: number, column: number): number {
  return row * COLUMNS + column;
}

export function s0Fuse(pin: number): number {
  return CONFIG_BASE + 2 * olmcIndex(pin);
}

export function s1Fuse(pin: number): number {
  return CONFIG_BASE + 2 * olmcIndex(pin) + 1;
}

export type RowKind = 'AR' | 'SP' | 'OE' | 'term';

/** What a row of the array does. */
export function rowInfo(row: number): { kind: RowKind; pin?: number; term?: number } {
  if (row === AR_ROW) return { kind: 'AR' };
  if (row === SP_ROW) return { kind: 'SP' };
  for (const p of OLMC_PINS) {
    const r = olmcRows(p);
    if (row === r.oeRow) return { kind: 'OE', pin: p };
    if (row > r.oeRow && row <= r.oeRow + r.terms) return { kind: 'term', pin: p, term: row - r.firstTermRow };
  }
  throw new Error(`Row ${row} out of range`);
}

export type FuseInfo =
  | { kind: 'array'; fuse: number; row: number; column: number; rowKind: RowKind; olmcPin?: number; term?: number; inputPin: number; complement: boolean }
  | { kind: 'S0' | 'S1'; fuse: number; pin: number }
  | { kind: 'signature'; fuse: number; byte: number; bit: number };

/** Everything about one fuse, for hovering in the fuse map. */
export function describeFuse(fuse: number): FuseInfo {
  if (fuse < 0 || fuse >= FUSE_COUNT) throw new Error(`Fuse ${fuse} out of range`);
  if (fuse < ARRAY_FUSES) {
    const row = Math.floor(fuse / COLUMNS);
    const column = fuse % COLUMNS;
    const r = rowInfo(row);
    const s = columnSignal(column);
    return { kind: 'array', fuse, row, column, rowKind: r.kind, olmcPin: r.pin, term: r.term, inputPin: s.pin, complement: s.complement };
  }
  if (fuse < SIGNATURE_BASE) {
    const k = fuse - CONFIG_BASE;
    return { kind: k % 2 === 0 ? 'S0' : 'S1', fuse, pin: 23 - (k >> 1) };
  }
  const k = fuse - SIGNATURE_BASE;
  return { kind: 'signature', fuse, byte: k >> 3, bit: 7 - (k & 7) };
}

/** A blank fuse map: every fuse 0 (the JEDEC default *F0*): all terms false, all outputs off. */
export function blankFuses(): Uint8Array {
  return new Uint8Array(FUSE_COUNT);
}

export function setSignature(fuses: Uint8Array, signature: string | Uint8Array): void {
  const bytes = typeof signature === 'string' ? new TextEncoder().encode(signature) : signature;
  for (let i = 0; i < 8; i++) {
    const c = bytes[i] ?? 0;
    for (let j = 0; j < 8; j++) fuses[SIGNATURE_BASE + i * 8 + j] = (c << j) & 0x80 ? 1 : 0;
  }
}

export function getSignature(fuses: Uint8Array): Uint8Array {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    let c = 0;
    for (let j = 0; j < 8; j++) if (fuses[SIGNATURE_BASE + i * 8 + j]) c |= 0x80 >> j;
    out[i] = c;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Decoding the fuses into a readable configuration

export interface GalLiteral {
  pin: number;
  complement: boolean;
}

export interface GalProductTerm {
  row: number;
  /** 'false' if some signal is connected in both forms; 'true' if nothing is connected. */
  kind: 'product' | 'true' | 'false';
  literals: GalLiteral[];
}

export interface GalOlmcConfig {
  pin: number;
  index: number;
  registered: boolean;
  activeHigh: boolean;
  oe: GalProductTerm;
  terms: GalProductTerm[];
}

export interface GalConfig {
  ar: GalProductTerm;
  sp: GalProductTerm;
  olmcs: GalOlmcConfig[];
  signature: Uint8Array;
}

export function decodeRow(fuses: ArrayLike<number>, row: number): GalProductTerm {
  const literals: GalLiteral[] = [];
  let contradiction = false;
  for (let k = 0; k < 22; k++) {
    const t = !fuses[row * COLUMNS + 2 * k];
    const c = !fuses[row * COLUMNS + 2 * k + 1];
    const { pin } = columnSignal(2 * k);
    if (t && c) contradiction = true;
    else if (t) literals.push({ pin, complement: false });
    else if (c) literals.push({ pin, complement: true });
  }
  if (contradiction) return { row, kind: 'false', literals: [] };
  return { row, kind: literals.length ? 'product' : 'true', literals };
}

export function decodeGal22v10(fuses: ArrayLike<number>): GalConfig {
  if (fuses.length !== FUSE_COUNT) throw new Error(`A GAL22V10 has ${FUSE_COUNT} fuses, not ${fuses.length}`);
  const olmcs = OLMC_PINS.map((pin) => {
    const r = olmcRows(pin);
    return {
      pin,
      index: olmcIndex(pin),
      activeHigh: fuses[s0Fuse(pin)] === 1,
      registered: fuses[s1Fuse(pin)] === 0,
      oe: decodeRow(fuses, r.oeRow),
      terms: Array.from({ length: r.terms }, (_, t) => decodeRow(fuses, r.firstTermRow + t)),
    };
  });
  return {
    ar: decodeRow(fuses, AR_ROW),
    sp: decodeRow(fuses, SP_ROW),
    olmcs,
    signature: getSignature(fuses instanceof Uint8Array ? fuses : Uint8Array.from(fuses)),
  };
}

// ---------------------------------------------------------------------------------------------
// Simulation from the fuses

export type Level = 0 | 1;

/** External levels on the pins (index = pin number); missing pins read 0. */
export type PinLevels = Partial<Record<number, Level>>;

export interface GalSnapshot {
  /** Level of each pin (index = pin number, 1–24): driven outputs, or the external level. */
  pins: Level[];
  /** True for OLMC pins driven by the device. */
  driven: boolean[];
  /** Value of every product-term row (0–131). */
  rows: Uint8Array;
  /** Sum of each OLMC's product terms, by pin. */
  sums: Partial<Record<number, Level>>;
  /** Register contents Q, by pin. */
  q: Partial<Record<number, Level>>;
  ar: Level;
  sp: Level;
  /** False if combinational feedback did not settle (a loop that oscillates). */
  stable: boolean;
}

/**
 * The GAL22V10 running from its fuse map. Construct with a fuse array (5,892 values, 0 or 1),
 * then call `evaluate` for the settled outputs and `clock` for a rising edge on pin 1.
 */
export class Gal22v10 {
  readonly fuses: Uint8Array;
  /** Register Q of each OLMC, by OLMC index (0 = pin 23). */
  readonly q = new Uint8Array(10);
  private masks: Uint32Array | null = null;

  constructor(fuses?: ArrayLike<number>) {
    this.fuses = fuses ? Uint8Array.from(fuses) : blankFuses();
    if (this.fuses.length !== FUSE_COUNT) throw new Error(`A GAL22V10 has ${FUSE_COUNT} fuses, not ${this.fuses.length}`);
  }

  setFuse(fuse: number, value: 0 | 1): void {
    this.fuses[fuse] = value;
    this.masks = null;
  }

  /** Power-up: every register resets to Q = 0. */
  powerUp(): void {
    this.q.fill(0);
  }

  private rowMasks(): Uint32Array {
    if (!this.masks) {
      // Per row, two words of "connected" columns (fuse = 0).
      const m = new Uint32Array(ROWS * 2);
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLUMNS; c++) if (!this.fuses[r * COLUMNS + c]) m[r * 2 + (c >> 5)] = m[r * 2 + (c >> 5)]! | (1 << (c & 31));
      this.masks = m;
    }
    return this.masks;
  }

  private registered(pin: number): boolean {
    return this.fuses[s1Fuse(pin)] === 0;
  }

  private activeHigh(pin: number): boolean {
    return this.fuses[s0Fuse(pin)] === 1;
  }

  /** Settle the combinational logic for the given external pin levels. */
  evaluate(inputs: PinLevels = {}): GalSnapshot {
    const masks = this.rowMasks();
    const pins: Level[] = new Array(PINS + 1).fill(0);
    const driven: boolean[] = new Array(PINS + 1).fill(false);
    for (let p = 1; p <= PINS; p++) pins[p] = inputs[p] ? 1 : 0;
    pins[GND_PIN] = 0;
    pins[VCC_PIN] = 1;
    const rows = new Uint8Array(ROWS);
    const sums: Partial<Record<number, Level>> = {};
    let stable = false;
    let ar: Level = 0;
    let sp: Level = 0;
    const q = this.q;
    for (let iter = 0; iter < 64 && !stable; iter++) {
      // Array inputs.
      let lo = 0;
      let hi = 0;
      for (let k = 0; k < 22; k++) {
        const { pin } = columnSignal(2 * k);
        let v: number;
        if (isOlmcPin(pin) && this.registered(pin)) v = q[olmcIndex(pin)] ? 0 : 1; // ¬Q
        else v = pins[pin]!;
        const bits = v ? 1 : 2; // true column 2k set when v = 1, complement column 2k+1 when v = 0
        const c = 2 * k;
        if (c < 32) lo |= bits << c;
        else hi |= bits << (c - 32);
      }
      lo >>>= 0;
      for (let r = 0; r < ROWS; r++) {
        const need0 = masks[r * 2]!;
        const need1 = masks[r * 2 + 1]!;
        rows[r] = (need0 & ~lo) === 0 && (need1 & ~hi) === 0 ? 1 : 0;
      }
      ar = rows[AR_ROW] as Level;
      sp = rows[SP_ROW] as Level;
      let changed = false;
      if (ar) {
        for (let i = 0; i < 10; i++) {
          if (q[i]) changed = true;
          q[i] = 0;
        }
      }
      for (const pin of OLMC_PINS) {
        const r = olmcRows(pin);
        let sum = 0;
        for (let t = 0; t < r.terms; t++) sum |= rows[r.firstTermRow + t]!;
        sums[pin] = sum as Level;
        const oe = rows[r.oeRow] === 1;
        const reg = this.registered(pin);
        const base = reg ? q[olmcIndex(pin)]! : sum;
        const out = (this.activeHigh(pin) ? base : 1 - base) as Level;
        const level = oe ? out : ((inputs[pin] ? 1 : 0) as Level);
        if (pins[pin] !== level || driven[pin] !== oe) changed = true;
        pins[pin] = level;
        driven[pin] = oe;
      }
      if (!changed && iter > 0) stable = true;
    }
    const qOut: Partial<Record<number, Level>> = {};
    for (const pin of OLMC_PINS) qOut[pin] = q[olmcIndex(pin)] as Level;
    return { pins, driven, rows, sums, q: qOut, ar, sp, stable };
  }

  /**
   * A rising edge on the clock (pin 1). The inputs, including pin 1's level as an array input,
   * are held across the edge: D is sampled from the settled logic, the registers load (or preset
   * when SP is true; AR overrides both), and the logic settles again.
   */
  clock(inputs: PinLevels = {}): GalSnapshot {
    const before = this.evaluate(inputs);
    const next = new Uint8Array(10);
    for (const pin of OLMC_PINS) next[olmcIndex(pin)] = before.sp ? 1 : before.sums[pin]!;
    if (!before.ar) this.q.set(next);
    return this.evaluate(inputs);
  }
}

// ---------------------------------------------------------------------------------------------
// Fuse map for the renderer

export interface GalFuseMapRow {
  row: number;
  kind: RowKind;
  /** The macrocell pin, for OE and product-term rows. */
  pin?: number;
  /** Product-term number within the macrocell (0-based), for product-term rows. */
  term?: number;
  /** 44 characters, column 0 first: '1' = fuse blown (input not connected), '0' = intact (connected). */
  bits: string;
}

export interface GalFuseMap {
  device: 'GAL22V10';
  version: 1;
  fuseCount: number;
  rows: GalFuseMapRow[];
  /** Per macrocell, pin 23 first. */
  olmcs: { pin: number; s0: 0 | 1; s1: 0 | 1; activeHigh: boolean; registered: boolean; oeRow: number; firstTermRow: number; terms: number; s0Fuse: number; s1Fuse: number }[];
  /** For each of the 44 columns: the pin and whether it is the complement. */
  columns: { column: number; pin: number; complement: boolean }[];
  signature: string;
  /** Fuses at 1 (blown) and at 0. */
  blown: number;
}

/** The fuse map as JSON-friendly data, for drawing and hovering. */
export function toFuseMap(fuses: ArrayLike<number>): GalFuseMap {
  if (fuses.length !== FUSE_COUNT) throw new Error(`A GAL22V10 has ${FUSE_COUNT} fuses, not ${fuses.length}`);
  const rows: GalFuseMapRow[] = [];
  for (let r = 0; r < ROWS; r++) {
    let bits = '';
    for (let c = 0; c < COLUMNS; c++) bits += fuses[r * COLUMNS + c] ? '1' : '0';
    rows.push({ row: r, ...rowInfo(r), bits });
  }
  let blown = 0;
  for (let i = 0; i < FUSE_COUNT; i++) if (fuses[i]) blown++;
  const sig = getSignature(Uint8Array.from(fuses));
  return {
    device: 'GAL22V10',
    version: 1,
    fuseCount: FUSE_COUNT,
    rows,
    olmcs: OLMC_PINS.map((pin) => {
      const r = olmcRows(pin);
      const s0 = fuses[s0Fuse(pin)] ? 1 : 0;
      const s1 = fuses[s1Fuse(pin)] ? 1 : 0;
      return { pin, s0, s1, activeHigh: s0 === 1, registered: s1 === 0, oeRow: r.oeRow, firstTermRow: r.firstTermRow, terms: r.terms, s0Fuse: s0Fuse(pin), s1Fuse: s1Fuse(pin) };
    }),
    columns: Array.from({ length: COLUMNS }, (_, column) => ({ column, ...columnSignal(column) })),
    signature: String.fromCharCode(...sig.map((b) => (b >= 0x20 && b < 0x7f ? b : 0x2e))),
    blown,
  };
}
