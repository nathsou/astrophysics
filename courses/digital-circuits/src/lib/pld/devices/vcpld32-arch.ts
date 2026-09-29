/**
 * vCPLD-32: architecture constants, the configuration-bit layout, and decoding.
 *
 * A small complex programmable logic device in the style of the Xilinx XC9500 and Altera MAX 7000,
 * scaled down so that every bit can be shown on screen:
 *
 * ```
 *   32 I/O pins ──┬─────────────────────────────┐            global clock GCLK ─┐
 *                 │  GLOBAL INTERCONNECT MATRIX │            global set/reset GSR ─┤ (not part of the
 *   32 macrocell ─┤  (per-FB input multiplexers)│            global output enable GOE ─┘  matrix)
 *   feedbacks     └──┬──────┬──────┬──────┬─────┘
 *                24 signals to each function block
 *                    FB0    FB1    FB2    FB3        4 function blocks (FB)
 *                 each: 24 inputs → AND array (48 literal columns × 40 rows)
 *                       → product-term allocator → 8 macrocells (MC) → 8 I/O pins
 * ```
 *
 * Numbering. I/O pin `io` (0–31) is the pad of macrocell `io`; function block `fb = io >> 3`,
 * macrocell-in-block `mc = io & 7`. The two are always paired (as in the XC9500): a macrocell that
 * drives its pin uses up the pin, one that does not (buried logic, or a macrocell whose product
 * terms all go to a neighbour) leaves the pad free to be an input.
 *
 * The global interconnect matrix. Every function block sees 24 signals. Input `k` of function
 * block `fb` is a 64-to-1 multiplexer (6 configuration bits, least significant first) whose
 * sources are 0–31 the level on I/O pin `n` and 32–63 the output of macrocell `n − 32` (before its
 * output buffer, so buried macrocells can feed back). The matrix is a full crossbar: any 24 of the
 * 64 signals can be chosen for each block, so where a signal comes from never limits fitting. What
 * limits it is that a block can only look at 24 signals at a time.
 *
 * The AND array. Each block has 40 product terms, 5 per macrocell: term `t = 5·mc + slot`. A term
 * has 48 literal columns: input `k` true (column 2k) and input `k` complemented (column 2k+1); a
 * bit of 1 connects the literal into the AND. Every term also has an enable bit: a term with
 * enable 0 is switched off (it is constant 0, and does not pull anything down); an enabled term
 * with no literal connected is the constant 1, and one with both forms of an input connected is
 * the constant 0.
 *
 * The product-term allocator. Term slot `s` of macrocell `m` has a 2-bit steering code:
 *
 *   0 off      the term is not used
 *   1 local    the term goes to the OR gate of macrocell m
 *   2 up       the term goes to the OR gate of macrocell m + 1  (nothing if m = 7)
 *   3 down     the term goes to the OR gate of macrocell m − 1  (nothing if m = 0)
 *
 * Steering is one hop within a function block: a borrowed term is not passed on, and there is no
 * wrap-around and no steering between blocks. A macrocell can therefore collect its own five terms
 * plus the five of each neighbour: at most 15. The macrocell that lends terms simply has fewer
 * (its lent slots are not available to itself). This mirrors the XC9500's allocator (MAX 7000's
 * "shared expanders", a pool of extra inverted terms any macrocell of the block can use, are not
 * modelled). Slot 4 of a macrocell whose output enable is a product term is that term (the
 * steering bits of the slot are then ignored; the fitter writes 0).
 *
 * The macrocell (16 bits): sum of its terms → XOR with `xor` → either straight to the output
 * (combinational, `reg` = 0) or into a flip-flop clocked by the rising edge of GCLK (`reg` = 1;
 * `tff` = 0 D flip-flop, 1 T flip-flop, which toggles when its input is 1). The output (flip-flop
 * or combinational) is the macrocell's feedback and passes through the output buffer to the pin
 * under the control of `oe`:
 *
 *   0 never drives the pin (input pad, or buried macrocell)     1 always drives the pin
 *   2 drives while the GOE pin is 1                             3 drives while product term slot 4 is 1
 *
 * `init` is the flip-flop's value at power-up and whenever GSR is 1 (GSR acts asynchronously on
 * every flip-flop; XC9500's per-macrocell product-term set/reset is not modelled).
 *
 * Configuration memory: 141 rows of 64 bits (9,024 bits) of non-volatile (flash-like) storage. The
 * erased state is all zeros, which makes an erased device inert (no term enabled, no pin driven).
 * Programming can only set bits to 1 (see `VCpld32.programRow`); erasing clears everything.
 *
 * ```
 *   bit = FB_BITS · fb + offset                   FB_BITS = 2,240 = 35 rows; blocks are row-aligned
 *   offset   0 ..  143  interconnect: input k at 6k … 6k+5, source number LSB first
 *   offset 144 .. 2063  AND array: term t, input k → true at 144 + 48t + 2k, complement at +1
 *   offset 2064 .. 2103 term enables: term t at 2064 + t
 *   offset 2104 .. 2231 macrocells: mc m at 2104 + 16m
 *        +0 xor  +1 reg  +2 tff  +3 init  +4,+5 oe (LSB first)  +6 + 2s, +7 + 2s steering of slot s
 *   offset 2232 .. 2239 reserved (0)
 *   bit 8960 .. 8991    USERCODE, bit i of the 32-bit user code at 8960 + i
 *   bit 8992 .. 9023    reserved (0)
 * ```
 */

export const FUNCTION_BLOCKS = 4;
export const MACROCELLS_PER_FB = 8;
export const MACROCELLS = FUNCTION_BLOCKS * MACROCELLS_PER_FB; // 32
export const IO_PINS = MACROCELLS; // 32
export const FB_INPUTS = 24;
export const LITERAL_COLUMNS = 2 * FB_INPUTS; // 48
export const TERMS_PER_MC = 5;
export const TERMS_PER_FB = TERMS_PER_MC * MACROCELLS_PER_FB; // 40
/** Most product terms one macrocell's OR can collect: its own five and five from each neighbour. */
export const MAX_TERMS_PER_MC = 3 * TERMS_PER_MC;
export const SOURCE_COUNT = IO_PINS + MACROCELLS; // 64
export const MUX_BITS = 6;

export const INTERCONNECT_OFFSET = 0;
export const ARRAY_OFFSET = FB_INPUTS * MUX_BITS; // 144
export const ENABLE_OFFSET = ARRAY_OFFSET + TERMS_PER_FB * LITERAL_COLUMNS; // 2064
export const MC_OFFSET = ENABLE_OFFSET + TERMS_PER_FB; // 2104
export const MC_BITS = 16;
export const RESERVED_OFFSET = MC_OFFSET + MC_BITS * MACROCELLS_PER_FB; // 2232
export const FB_BITS = 2240;
export const USERCODE_OFFSET = FUNCTION_BLOCKS * FB_BITS; // 8960
export const USERCODE_BITS = 32;
export const ROW_BITS = 64;
export const ROW_COUNT = 141;
export const BIT_COUNT = ROW_COUNT * ROW_BITS; // 9024
/** The row that holds the USERCODE. */
export const USERCODE_ROW = USERCODE_OFFSET / ROW_BITS; // 140

// Macrocell field offsets.
export const MC_XOR = 0;
export const MC_REG = 1;
export const MC_TFF = 2;
export const MC_INIT = 3;
export const MC_OE = 4; // 2 bits
export const MC_STEER = 6; // 5 slots × 2 bits

export type Level = 0 | 1;

export const STEER_OFF = 0;
export const STEER_LOCAL = 1;
export const STEER_UP = 2;
export const STEER_DOWN = 3;
export type SteerCode = 0 | 1 | 2 | 3;
export type SteerName = 'off' | 'local' | 'up' | 'down';
export const STEER_NAMES: readonly SteerName[] = ['off', 'local', 'up', 'down'];

export const OE_OFF = 0;
export const OE_ALWAYS = 1;
export const OE_GLOBAL = 2;
export const OE_TERM = 3;
export type OeMode = 0 | 1 | 2 | 3;
export const OE_NAMES = ['off', 'always', 'global (GOE)', 'product term'] as const;

// ---------------------------------------------------------------------------------------------
// Bit addresses

export function fbBase(fb: number): number {
  return fb * FB_BITS;
}

/** First of the 6 bits of input multiplexer `k` of function block `fb`. */
export function interconnectBit(fb: number, k: number, b = 0): number {
  return fbBase(fb) + INTERCONNECT_OFFSET + MUX_BITS * k + b;
}

/** The AND-array bit of term `t` (0–39) and input `k` (0–23), true or complemented. */
export function arrayBit(fb: number, t: number, k: number, complement: boolean): number {
  return fbBase(fb) + ARRAY_OFFSET + LITERAL_COLUMNS * t + 2 * k + (complement ? 1 : 0);
}

export function termEnableBit(fb: number, t: number): number {
  return fbBase(fb) + ENABLE_OFFSET + t;
}

/** First bit of macrocell `mc` (0–7) of block `fb`. */
export function mcBase(fb: number, mc: number): number {
  return fbBase(fb) + MC_OFFSET + MC_BITS * mc;
}

export function mcBit(fb: number, mc: number, field: number): number {
  return mcBase(fb, mc) + field;
}

/** Steering bit `b` (0 or 1) of term slot `slot` of macrocell `mc`. */
export function steerBit(fb: number, mc: number, slot: number, b = 0): number {
  return mcBase(fb, mc) + MC_STEER + 2 * slot + b;
}

export function usercodeBit(i: number): number {
  return USERCODE_OFFSET + i;
}

export const ioFb = (io: number): number => io >> 3;
export const ioMc = (io: number): number => io & 7;
export const ioOf = (fb: number, mc: number): number => fb * MACROCELLS_PER_FB + mc;

/** Term number within a block of slot `slot` of macrocell `mc`. */
export const termOf = (mc: number, slot: number): number => mc * TERMS_PER_MC + slot;

/** Where a term of macrocell `mc` steered `code` goes: a macrocell of the same block, or -1. */
export function steerTarget(mc: number, code: number): number {
  if (code === STEER_LOCAL) return mc;
  if (code === STEER_UP) return mc < MACROCELLS_PER_FB - 1 ? mc + 1 : -1;
  if (code === STEER_DOWN) return mc > 0 ? mc - 1 : -1;
  return -1;
}

export function sourceName(source: number): string {
  return source < IO_PINS ? `IO${source}` : `MC${source - IO_PINS}`;
}

export function ioName(io: number): string {
  return `IO${io}`;
}

export function blankBits(): Uint8Array {
  return new Uint8Array(BIT_COUNT);
}

export function getRow(bits: ArrayLike<number>, row: number): Uint8Array {
  const out = new Uint8Array(ROW_BITS);
  for (let i = 0; i < ROW_BITS; i++) out[i] = bits[row * ROW_BITS + i] ? 1 : 0;
  return out;
}

export function setRow(bits: Uint8Array, row: number, data: ArrayLike<number>): void {
  for (let i = 0; i < ROW_BITS; i++) bits[row * ROW_BITS + i] = data[i] ? 1 : 0;
}

/** The bits as hexadecimal, 4 per digit, bit 0 as the least significant bit of the first digit. */
export function bitsToHex(bits: ArrayLike<number>): string {
  let s = '';
  for (let i = 0; i < bits.length; i += 4) {
    s += ((bits[i] ? 1 : 0) | (bits[i + 1] ? 2 : 0) | (bits[i + 2] ? 4 : 0) | (bits[i + 3] ? 8 : 0)).toString(16);
  }
  return s;
}

export function bitsFromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length * 4);
  for (let i = 0; i < hex.length; i++) {
    const v = Number.parseInt(hex[i]!, 16);
    if (Number.isNaN(v)) throw new Error(`Not a hexadecimal digit: ${hex[i]}`);
    for (let b = 0; b < 4; b++) out[i * 4 + b] = (v >> b) & 1;
  }
  return out;
}

/** The USERCODE (32-bit user signature) held in the last row. */
export function getUsercode(bits: ArrayLike<number>): number {
  let v = 0;
  for (let i = 0; i < USERCODE_BITS; i++) if (bits[USERCODE_OFFSET + i]) v += 2 ** i;
  return v;
}

export function setUsercode(bits: Uint8Array, value: number | string): void {
  let v: number;
  if (typeof value === 'string') {
    // Up to four ASCII characters, the first in the most significant byte (so the hex reads as text).
    v = 0;
    for (let i = 0; i < 4; i++) v = v * 256 + ((value.charCodeAt(i) || 0) & 0xff);
  } else v = value >>> 0;
  for (let i = 0; i < USERCODE_BITS; i++) bits[USERCODE_OFFSET + i] = Math.floor(v / 2 ** i) & 1;
}

export function usercodeText(value: number): string {
  let s = '';
  for (let sh = 24; sh >= 0; sh -= 8) {
    const c = Math.floor(value / 2 ** sh) & 0xff;
    if (c >= 0x20 && c < 0x7f) s += String.fromCharCode(c);
  }
  return s;
}

// ---------------------------------------------------------------------------------------------
// describeBit

export type BitRegion = 'interconnect' | 'and-array' | 'term-enable' | 'macrocell' | 'usercode' | 'reserved';

export type BitInfo =
  | { bit: number; region: 'interconnect'; fb: number; input: number; index: number; text: string }
  | { bit: number; region: 'and-array'; fb: number; term: number; mc: number; slot: number; input: number; complement: boolean; text: string }
  | { bit: number; region: 'term-enable'; fb: number; term: number; mc: number; slot: number; text: string }
  | {
      bit: number;
      region: 'macrocell';
      fb: number;
      mc: number;
      io: number;
      field: 'xor' | 'reg' | 'tff' | 'init' | 'oe' | 'steer';
      /** Bit within a 2-bit field (oe, steer). */
      index: number;
      /** Term slot, for steering bits. */
      slot?: number;
      text: string;
    }
  | { bit: number; region: 'usercode'; index: number; text: string }
  | { bit: number; region: 'reserved'; text: string };

/** Everything about one configuration bit, for hovering in the bit map. */
export function describeBit(bit: number): BitInfo {
  if (!Number.isInteger(bit) || bit < 0 || bit >= BIT_COUNT) throw new Error(`Configuration bit ${bit} out of range (0–${BIT_COUNT - 1})`);
  if (bit >= USERCODE_OFFSET) {
    const i = bit - USERCODE_OFFSET;
    if (i < USERCODE_BITS) return { bit, region: 'usercode', index: i, text: `USERCODE bit ${i}` };
    return { bit, region: 'reserved', text: 'Reserved (row 140, unused)' };
  }
  const fb = Math.floor(bit / FB_BITS);
  const off = bit % FB_BITS;
  if (off < ARRAY_OFFSET) {
    const input = Math.floor(off / MUX_BITS);
    const index = off % MUX_BITS;
    return { bit, region: 'interconnect', fb, input, index, text: `FB${fb} input ${input} source select, bit ${index} (source = 6-bit number, LSB first: 0–31 pin IOn, 32–63 macrocell n−32)` };
  }
  if (off < ENABLE_OFFSET) {
    const a = off - ARRAY_OFFSET;
    const term = Math.floor(a / LITERAL_COLUMNS);
    const col = a % LITERAL_COLUMNS;
    const input = col >> 1;
    const complement = (col & 1) === 1;
    const mc = Math.floor(term / TERMS_PER_MC);
    const slot = term % TERMS_PER_MC;
    return {
      bit,
      region: 'and-array',
      fb,
      term,
      mc,
      slot,
      input,
      complement,
      text: `FB${fb} AND array: term ${term} (MC${ioOf(fb, mc)} slot ${slot}), input ${input} ${complement ? 'complemented' : 'true'} literal`,
    };
  }
  if (off < MC_OFFSET) {
    const term = off - ENABLE_OFFSET;
    const mc = Math.floor(term / TERMS_PER_MC);
    return { bit, region: 'term-enable', fb, term, mc, slot: term % TERMS_PER_MC, text: `FB${fb} term ${term} (MC${ioOf(fb, mc)} slot ${term % TERMS_PER_MC}) enable` };
  }
  if (off < RESERVED_OFFSET) {
    const a = off - MC_OFFSET;
    const mc = Math.floor(a / MC_BITS);
    const f = a % MC_BITS;
    const io = ioOf(fb, mc);
    const base = { bit, region: 'macrocell' as const, fb, mc, io };
    if (f === MC_XOR) return { ...base, field: 'xor', index: 0, text: `MC${io} XOR: 1 inverts the sum of products` };
    if (f === MC_REG) return { ...base, field: 'reg', index: 0, text: `MC${io} register: 1 = flip-flop, 0 = combinational` };
    if (f === MC_TFF) return { ...base, field: 'tff', index: 0, text: `MC${io} flip-flop type: 1 = T (toggle), 0 = D` };
    if (f === MC_INIT) return { ...base, field: 'init', index: 0, text: `MC${io} power-up and GSR value of the flip-flop` };
    if (f < MC_STEER) return { ...base, field: 'oe', index: f - MC_OE, text: `MC${io} output-enable mode, bit ${f - MC_OE} (0 off, 1 always, 2 GOE, 3 product term)` };
    const s = f - MC_STEER;
    const slot = s >> 1;
    return { ...base, field: 'steer', index: s & 1, slot, text: `MC${io} product-term slot ${slot} steering, bit ${s & 1} (0 off, 1 local, 2 up, 3 down)` };
  }
  return { bit, region: 'reserved', text: `FB${fb} reserved` };
}

// ---------------------------------------------------------------------------------------------
// Decoding

export type TermKind = 'off' | 'product' | 'true' | 'false';

export interface CpldLiteral {
  input: number;
  complement: boolean;
}

export interface CpldTerm {
  fb: number;
  /** Term number in the block, 0–39. */
  term: number;
  mc: number;
  slot: number;
  enabled: boolean;
  /** 'off' if disabled, 'true' if enabled with nothing connected, 'false' if contradictory. */
  kind: TermKind;
  literals: CpldLiteral[];
  steer: SteerName;
  /** The macrocell (of the same block) whose OR receives the term; -1 if none (or it is the OE term). */
  destMc: number;
  /** True if this is the output-enable term of its macrocell. */
  isOe: boolean;
}

export interface CpldMacrocell {
  fb: number;
  mc: number;
  io: number;
  xor: boolean;
  registered: boolean;
  tff: boolean;
  init: Level;
  oe: OeMode;
  steer: SteerName[];
  /** Terms (block numbers) that reach this macrocell's OR gate: its own, then from below, then from above. */
  orTerms: number[];
  /** Of orTerms, how many come from a neighbour. */
  borrowed: number;
  /** Of this macrocell's own slots, how many go to a neighbour. */
  lent: number;
}

export interface CpldFunctionBlock {
  fb: number;
  /** Source (0–63) chosen by each of the 24 input multiplexers. */
  sources: number[];
  terms: CpldTerm[];
  macrocells: CpldMacrocell[];
}

export interface CpldConfig {
  fbs: CpldFunctionBlock[];
  usercode: number;
}

export function decodeConfig(bits: ArrayLike<number>): CpldConfig {
  if (bits.length !== BIT_COUNT) throw new Error(`A vCPLD-32 has ${BIT_COUNT} configuration bits, not ${bits.length}`);
  const fbs: CpldFunctionBlock[] = [];
  for (let fb = 0; fb < FUNCTION_BLOCKS; fb++) {
    const sources: number[] = [];
    for (let k = 0; k < FB_INPUTS; k++) {
      let s = 0;
      for (let b = 0; b < MUX_BITS; b++) if (bits[interconnectBit(fb, k, b)]) s |= 1 << b;
      sources.push(s);
    }
    const macrocells: CpldMacrocell[] = [];
    for (let mc = 0; mc < MACROCELLS_PER_FB; mc++) {
      const oe = ((bits[mcBit(fb, mc, MC_OE)] ? 1 : 0) | (bits[mcBit(fb, mc, MC_OE + 1)] ? 2 : 0)) as OeMode;
      const steer: SteerName[] = [];
      for (let s = 0; s < TERMS_PER_MC; s++) {
        const code = (bits[steerBit(fb, mc, s, 0)] ? 1 : 0) | (bits[steerBit(fb, mc, s, 1)] ? 2 : 0);
        steer.push(STEER_NAMES[code]!);
      }
      macrocells.push({
        fb,
        mc,
        io: ioOf(fb, mc),
        xor: !!bits[mcBit(fb, mc, MC_XOR)],
        registered: !!bits[mcBit(fb, mc, MC_REG)],
        tff: !!bits[mcBit(fb, mc, MC_TFF)],
        init: bits[mcBit(fb, mc, MC_INIT)] ? 1 : 0,
        oe,
        steer,
        orTerms: [],
        borrowed: 0,
        lent: 0,
      });
    }
    const terms: CpldTerm[] = [];
    for (let t = 0; t < TERMS_PER_FB; t++) {
      const mc = Math.floor(t / TERMS_PER_MC);
      const slot = t % TERMS_PER_MC;
      const enabled = !!bits[termEnableBit(fb, t)];
      const literals: CpldLiteral[] = [];
      let contradiction = false;
      for (let k = 0; k < FB_INPUTS; k++) {
        const tr = !!bits[arrayBit(fb, t, k, false)];
        const co = !!bits[arrayBit(fb, t, k, true)];
        if (tr && co) contradiction = true;
        if (tr) literals.push({ input: k, complement: false });
        if (co) literals.push({ input: k, complement: true });
      }
      const kind: TermKind = !enabled ? 'off' : contradiction ? 'false' : literals.length ? 'product' : 'true';
      const owner = macrocells[mc]!;
      const isOe = slot === TERMS_PER_MC - 1 && owner.oe === OE_TERM;
      const steer = owner.steer[slot]!;
      const code = STEER_NAMES.indexOf(steer);
      terms.push({ fb, term: t, mc, slot, enabled, kind, literals, steer, destMc: isOe ? -1 : steerTarget(mc, code), isOe });
    }
    // Which terms reach which OR gate: own first, then from the macrocell below (steered up), then above.
    for (const m of macrocells) {
      const from = (j: number) => terms.filter((t) => t.mc === j && t.destMc === m.mc);
      const own = from(m.mc);
      const below = m.mc > 0 ? from(m.mc - 1) : [];
      const above = m.mc < MACROCELLS_PER_FB - 1 ? from(m.mc + 1) : [];
      m.orTerms = [...own, ...below, ...above].map((t) => t.term);
      m.borrowed = below.length + above.length;
      m.lent = terms.filter((t) => t.mc === m.mc && t.destMc >= 0 && t.destMc !== m.mc).length;
    }
    fbs.push({ fb, sources, terms, macrocells });
  }
  return { fbs, usercode: getUsercode(bits) };
}

// ---------------------------------------------------------------------------------------------
// Fuse (bit) map for the renderer

export interface CpldFuseMapTerm {
  term: number;
  mc: number;
  slot: number;
  enabled: boolean;
  kind: TermKind;
  literals: CpldLiteral[];
  /** 48 characters, column 0 first (input 0 true, input 0 complement, input 1 true, …). */
  bits: string;
  dest: SteerName | 'oe';
  destMc: number | null;
}

export interface CpldFuseMap {
  device: 'vCPLD-32';
  version: 1;
  bitCount: number;
  rowBits: number;
  rowCount: number;
  usercode: number;
  fbs: {
    fb: number;
    interconnect: { input: number; source: number; kind: 'pin' | 'macrocell'; index: number; name: string }[];
    terms: CpldFuseMapTerm[];
    macrocells: {
      mc: number;
      io: number;
      xor: boolean;
      registered: boolean;
      type: 'comb' | 'D' | 'T';
      init: Level;
      oe: (typeof OE_NAMES)[number];
      oeMode: OeMode;
      steer: SteerName[];
      /** Block term numbers reaching the OR gate. */
      orTerms: number[];
      borrowed: number;
      lent: number;
    }[];
    /** How many distinct signals feed the block's enabled product terms (at most 24). */
    distinctSources: number;
  }[];
  /** For the 48 columns of the AND array: the input and whether it is the complement. */
  columns: { column: number; input: number; complement: boolean }[];
  /** Bits at 1. */
  ones: number;
}

export function toFuseMap(bits: ArrayLike<number>): CpldFuseMap {
  const cfg = decodeConfig(bits);
  let ones = 0;
  for (let i = 0; i < BIT_COUNT; i++) if (bits[i]) ones++;
  return {
    device: 'vCPLD-32',
    version: 1,
    bitCount: BIT_COUNT,
    rowBits: ROW_BITS,
    rowCount: ROW_COUNT,
    usercode: cfg.usercode,
    fbs: cfg.fbs.map((f) => ({
      fb: f.fb,
      interconnect: f.sources.map((source, input) => ({
        input,
        source,
        kind: source < IO_PINS ? ('pin' as const) : ('macrocell' as const),
        index: source % IO_PINS,
        name: sourceName(source),
      })),
      terms: f.terms.map((t) => {
        let s = '';
        for (let c = 0; c < LITERAL_COLUMNS; c++) s += bits[fbBase(f.fb) + ARRAY_OFFSET + LITERAL_COLUMNS * t.term + c] ? '1' : '0';
        return {
          term: t.term,
          mc: t.mc,
          slot: t.slot,
          enabled: t.enabled,
          kind: t.kind,
          literals: t.literals,
          bits: s,
          dest: t.isOe ? ('oe' as const) : t.steer,
          destMc: t.destMc >= 0 ? t.destMc : null,
        };
      }),
      macrocells: f.macrocells.map((m) => ({
        mc: m.mc,
        io: m.io,
        xor: m.xor,
        registered: m.registered,
        type: m.registered ? (m.tff ? ('T' as const) : ('D' as const)) : ('comb' as const),
        init: m.init,
        oe: OE_NAMES[m.oe],
        oeMode: m.oe,
        steer: m.steer,
        orTerms: m.orTerms,
        borrowed: m.borrowed,
        lent: m.lent,
      })),
      distinctSources: new Set(
        f.terms.filter((t) => t.enabled).flatMap((t) => t.literals.map((l) => f.sources[l.input]!)),
      ).size,
    })),
    columns: Array.from({ length: LITERAL_COLUMNS }, (_, column) => ({ column, input: column >> 1, complement: (column & 1) === 1 })),
    ones,
  };
}
