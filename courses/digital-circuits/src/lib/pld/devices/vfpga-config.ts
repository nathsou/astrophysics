/**
 * Configuration of the virtual FPGA: what each bit controls, the bitstream file, and an API for setting bits by
 * hand (used by the Device Studio's "by hand" mode and by the toolchain's bitstream generator).
 *
 * ## The configuration memory
 *
 * A configuration is a flat array of bits (`Uint8Array`, one 0/1 entry per bit). It is organised in **frames**, one
 * per tile column; a frame holds its tiles from y = 0 upwards, and a tile holds, in this order:
 *
 * - **logic tile**: `clk_sel` (`clkBits` bits: which global clock the tile's flip-flops use), `clk_neg` (1: the
 *   flip-flops use the falling edge), then 8 logic cells of 25 bits each; then the select fields of its
 *   multiplexers in node order (connection-box muxes of the pins, then switch-box muxes of the wires);
 * - **I/O tile**: 2 bits per pad (`output`: the pad drives the outside, `pullup`); then the multiplexers;
 * - **block RAM tile**: `mode` (2 bits: width 16, 8, 4 or 2), `async` (1: asynchronous read), `rclk_sel` and
 *   `wclk_sel` (`clkBits` each), 4096 initial-contents bits (row r of the memory is bits [r·w, r·w + w) of the
 *   contents, w = the width of mode 0 read as 16 bits per row: word a of a width-w memory is bits [a·w, a·w + w)),
 *   then the multiplexers.
 *
 * A **logic cell** (25 bits, `LC` names the fields):
 *
 * | bits | field | meaning |
 * |---|---|---|
 * | 0–15 | `lut` | truth table: bit r is the output when I0 + 2·I1 + 4·I2 + 8·I3 = r |
 * | 16 | `i3_carry` | LUT input I3 comes from the carry input instead of the routing pin |
 * | 17 | `carry_chain` | the carry input is the previous cell's carry output (else the constant `carry_const`) |
 * | 18 | `carry_const` | the constant carry input when `carry_chain` is 0 |
 * | 19 | `ff` | the cell's output is the flip-flop (bypass mux); else the LUT |
 * | 20 | `ce_en` | the flip-flop loads only while the tile's clock-enable pin is 1 |
 * | 21 | `sr_en` | the tile's set/reset pin resets or sets the flip-flop |
 * | 22 | `sr_val` | value the set/reset forces (0 = reset, 1 = set) |
 * | 23 | `sr_async` | set/reset acts at once (else at the next clock edge; it then has priority over enable) |
 * | 24 | `init` | power-up value of the flip-flop |
 *
 * The carry output of a cell is always MAJ(I1, I2, carry input), as the iCE40's SB_CARRY.
 */
import {
  DIR_NAMES,
  NK,
  TILE_BRAM,
  TILE_IO,
  TILE_LOGIC,
  type VFpgaDevice,
} from './vfpga';
import { BRAM_BITS, BRAM_WIDTHS, LCS_PER_TILE, LC_BITS } from './vfpga-arch';

export const LC = { LUT: 0, I3_CARRY: 16, CARRY_CHAIN: 17, CARRY_CONST: 18, FF: 19, CE_EN: 20, SR_EN: 21, SR_VAL: 22, SR_ASYNC: 23, INIT: 24 } as const;
export const LC_FIELD_NAMES = ['i3_carry', 'carry_chain', 'carry_const', 'ff', 'ce_en', 'sr_en', 'sr_val', 'sr_async', 'init'] as const;

export interface LcConfig {
  /** 16-bit truth table. */
  lut: number;
  i3Carry: boolean;
  carryChain: boolean;
  carryConst: 0 | 1;
  ff: boolean;
  ceEn: boolean;
  srEn: boolean;
  srVal: 0 | 1;
  srAsync: boolean;
  init: 0 | 1;
}

export const defaultLc = (): LcConfig => ({ lut: 0, i3Carry: false, carryChain: false, carryConst: 0, ff: false, ceEn: false, srEn: false, srVal: 0, srAsync: false, init: 0 });

export interface BramConfig {
  /** 0…3: 256×16, 512×8, 1024×4, 2048×2. */
  mode: number;
  asyncRead: boolean;
  rclk: number;
  wclk: number;
}

export class BitstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BitstreamError';
  }
}

export function getBits(bits: Uint8Array, offset: number, width: number): number {
  let v = 0;
  for (let i = 0; i < width; i++) v |= bits[offset + i]! << i;
  return v >>> 0;
}

export function setBits(bits: Uint8Array, offset: number, width: number, value: number): void {
  for (let i = 0; i < width; i++) bits[offset + i] = (value >>> i) & 1;
}

/** Offsets of the fixed fields of a tile, relative to the device. */
export function lcOffset(dev: VFpgaDevice, x: number, y: number, k: number): number {
  return dev.tileCfgOffset[dev.tid(x, y)]! + dev.clkBits + 1 + k * LC_BITS;
}
export const clkSelOffset = (dev: VFpgaDevice, x: number, y: number): number => dev.tileCfgOffset[dev.tid(x, y)]!;
export const clkNegOffset = (dev: VFpgaDevice, x: number, y: number): number => dev.tileCfgOffset[dev.tid(x, y)]! + dev.clkBits;
export const padOffset = (dev: VFpgaDevice, pad: number): number => {
  const p = dev.pads[pad]!;
  return dev.tileCfgOffset[dev.tid(p.x, p.y)]! + 2 * p.slot;
};
export const bramOffset = (dev: VFpgaDevice, x: number, y: number): number => dev.tileCfgOffset[dev.tid(x, y)]!;
export const bramInitOffset = (dev: VFpgaDevice, x: number, y: number): number => dev.tileCfgOffset[dev.tid(x, y)]! + 3 + 2 * dev.clkBits;

export function readLc(dev: VFpgaDevice, bits: Uint8Array, x: number, y: number, k: number): LcConfig {
  const o = lcOffset(dev, x, y, k);
  return {
    lut: getBits(bits, o + LC.LUT, 16),
    i3Carry: bits[o + LC.I3_CARRY] === 1,
    carryChain: bits[o + LC.CARRY_CHAIN] === 1,
    carryConst: bits[o + LC.CARRY_CONST] as 0 | 1,
    ff: bits[o + LC.FF] === 1,
    ceEn: bits[o + LC.CE_EN] === 1,
    srEn: bits[o + LC.SR_EN] === 1,
    srVal: bits[o + LC.SR_VAL] as 0 | 1,
    srAsync: bits[o + LC.SR_ASYNC] === 1,
    init: bits[o + LC.INIT] as 0 | 1,
  };
}

export function writeLc(dev: VFpgaDevice, bits: Uint8Array, x: number, y: number, k: number, c: Partial<LcConfig>): void {
  const o = lcOffset(dev, x, y, k);
  if (c.lut !== undefined) setBits(bits, o + LC.LUT, 16, c.lut);
  const flag = (off: number, v: boolean | 0 | 1 | undefined) => {
    if (v !== undefined) bits[o + off] = v ? 1 : 0;
  };
  flag(LC.I3_CARRY, c.i3Carry);
  flag(LC.CARRY_CHAIN, c.carryChain);
  flag(LC.CARRY_CONST, c.carryConst);
  flag(LC.FF, c.ff);
  flag(LC.CE_EN, c.ceEn);
  flag(LC.SR_EN, c.srEn);
  flag(LC.SR_VAL, c.srVal);
  flag(LC.SR_ASYNC, c.srAsync);
  flag(LC.INIT, c.init);
}

export function readBram(dev: VFpgaDevice, bits: Uint8Array, x: number, y: number): BramConfig {
  const o = bramOffset(dev, x, y);
  return { mode: getBits(bits, o, 2), asyncRead: bits[o + 2] === 1, rclk: getBits(bits, o + 3, dev.clkBits), wclk: getBits(bits, o + 3 + dev.clkBits, dev.clkBits) };
}

/** The tile whose configuration contains bit `index`. */
export function tileOfBit(dev: VFpgaDevice, index: number): { x: number; y: number; tid: number } | undefined {
  if (index < 0 || index >= dev.totalBits) return undefined;
  let x = 0;
  while (x < dev.frames.length - 1 && index >= dev.frames[x + 1]!.start) x++;
  for (let y = dev.height - 1; y >= 0; y--) {
    const t = dev.tid(x, y);
    if (dev.tileCfgBits[t]! > 0 && dev.tileCfgOffset[t]! <= index) return index < dev.tileCfgOffset[t]! + dev.tileCfgBits[t]! ? { x, y, tid: t } : undefined;
  }
  return undefined;
}

export interface BitDescription {
  index: number;
  frame: number;
  tile: { x: number; y: number; kind: 'logic' | 'io' | 'bram' };
  category: 'lut' | 'lc-flag' | 'clock' | 'pad' | 'bram' | 'bram-init' | 'mux';
  /** Sentence saying what the bit controls. */
  text: string;
  /** The multiplexer's node, for category "mux". */
  node?: number;
  /** For LUT bits: the truth-table row. */
  row?: number;
  /** Cell number for logic-cell bits. */
  cell?: number;
}

const KIND_NAMES = { [TILE_LOGIC]: 'logic', [TILE_IO]: 'io', [TILE_BRAM]: 'bram' } as const;

/** What bit `index` of the configuration controls. With `bits` given, the text also says what it is set to now. */
export function describeBit(dev: VFpgaDevice, index: number, bits?: Uint8Array): BitDescription {
  const t = tileOfBit(dev, index);
  if (!t) throw new RangeError(`bit ${index} is outside the ${dev.name} configuration (${dev.totalBits} bits)`);
  const kind = dev.tileKind[t.tid]! as 1 | 2 | 3;
  const rel = index - dev.tileCfgOffset[t.tid]!;
  const base = { index, frame: t.x, tile: { x: t.x, y: t.y, kind: KIND_NAMES[kind] } };
  const val = bits ? ` (now ${bits[index]})` : '';
  const at = `tile (${t.x}, ${t.y})`;
  if (kind === TILE_LOGIC) {
    if (rel < dev.clkBits) return { ...base, category: 'clock', text: `Bit ${rel} of the clock select of ${at}: which of the ${dev.spec.globals} global clocks its flip-flops use${val}.` };
    if (rel === dev.clkBits) return { ...base, category: 'clock', text: `Clock polarity of ${at}: 1 makes its flip-flops load on the falling edge${val}.` };
    const r = rel - dev.clkBits - 1;
    if (r < LCS_PER_TILE * LC_BITS) {
      const k = Math.floor(r / LC_BITS);
      const f = r % LC_BITS;
      const cell = `logic cell ${k} of ${at}`;
      if (f < 16) {
        const row = f;
        return {
          ...base,
          category: 'lut',
          cell: k,
          row,
          text: `LUT bit ${f} of ${cell}: the output when I0=${row & 1}, I1=${(row >> 1) & 1}, I2=${(row >> 2) & 1}, I3=${(row >> 3) & 1}${val}.`,
        };
      }
      const text: Record<number, string> = {
        [LC.I3_CARRY]: `LUT input I3 of ${cell} reads the carry input instead of its routing pin`,
        [LC.CARRY_CHAIN]: `the carry input of ${cell} comes from the previous cell's carry output (else from the constant)`,
        [LC.CARRY_CONST]: `the constant carry input of ${cell} when it is not chained`,
        [LC.FF]: `${cell} outputs its flip-flop (1) or its LUT (0)`,
        [LC.CE_EN]: `the flip-flop of ${cell} loads only while the tile's clock enable is 1`,
        [LC.SR_EN]: `the tile's set/reset pin acts on the flip-flop of ${cell}`,
        [LC.SR_VAL]: `the value the set/reset forces in ${cell}: 0 resets, 1 sets`,
        [LC.SR_ASYNC]: `set/reset of ${cell} acts at once (1) or at the next clock edge (0)`,
        [LC.INIT]: `power-up value of the flip-flop of ${cell}`,
      };
      return { ...base, category: 'lc-flag', cell: k, text: `${text[f]!}${val}.`.replace(/^./, (c) => c.toUpperCase()) };
    }
  } else if (kind === TILE_IO) {
    if (rel < 2 * dev.spec.padsPerTile) {
      const slot = rel >> 1;
      const pad = dev.pads[dev.padAt(t.x, t.y, slot)]!;
      return {
        ...base,
        category: 'pad',
        text: rel & 1 ? `Pull-up of pad ${pad.name}${val}.` : `Direction of pad ${pad.name}: 1 drives the pin from the fabric, 0 reads it${val}.`,
      };
    }
  } else if (kind === TILE_BRAM) {
    const site = 3 + 2 * dev.clkBits;
    if (rel < 2) return { ...base, category: 'bram', text: `Bit ${rel} of the width mode of the block RAM at ${at}: ${BRAM_WIDTHS.join(', ')} bits wide for 0…3${val}.` };
    if (rel === 2) return { ...base, category: 'bram', text: `Block RAM at ${at}: 1 reads asynchronously${val}.` };
    if (rel < 3 + dev.clkBits) return { ...base, category: 'bram', text: `Read clock select of the block RAM at ${at}${val}.` };
    if (rel < site) return { ...base, category: 'bram', text: `Write clock select of the block RAM at ${at}${val}.` };
    if (rel < site + BRAM_BITS) return { ...base, category: 'bram-init', text: `Initial contents bit ${rel - site} of the block RAM at ${at}${val}.` };
  }
  // A multiplexer field.
  for (let n = dev.tileNodeStart[t.tid]!; n < dev.tileNodeStart[t.tid + 1]!; n++) {
    const off = dev.cfgOffset[n]!;
    if (off >= 0 && index >= off && index < off + dev.cfgWidth[n]!) {
      const ninputs = dev.inStart[n + 1]! - dev.inStart[n]!;
      let text = `Bit ${index - off} of the ${dev.cfgWidth[n]}-bit select of the multiplexer driving ${dev.nodeName(n)} (${ninputs} inputs; 0 = none).`;
      if (bits) {
        const sel = getBits(bits, off, dev.cfgWidth[n]!);
        text += sel >= 1 && sel <= ninputs ? ` It selects ${dev.nodeName(dev.inList[dev.inStart[n]! + sel - 1]!)}.` : ' It selects nothing.';
      }
      return { ...base, category: 'mux', node: n, text };
    }
  }
  throw new Error(`bit ${index}: layout error`);
}

/** The select code of node n as set in `bits`, and the selected input (−1 for none). */
export function readSelect(dev: VFpgaDevice, bits: Uint8Array, n: number): { code: number; input: number } {
  const off = dev.cfgOffset[n]!;
  if (off < 0) return { code: 0, input: -1 };
  const code = getBits(bits, off, dev.cfgWidth[n]!);
  const ninputs = dev.inStart[n + 1]! - dev.inStart[n]!;
  return { code, input: code >= 1 && code <= ninputs ? dev.inList[dev.inStart[n]! + code - 1]! : -1 };
}

/** A human-readable listing of everything that is set in a configuration. */
export function dumpBitstream(dev: VFpgaDevice, bits: Uint8Array): string {
  const lines: string[] = [`${dev.name}: ${dev.totalBits} bits in ${dev.frames.length} frames, ${countOnes(bits)} set`];
  for (let x = 0; x < dev.width; x++) {
    for (let y = 0; y < dev.height; y++) {
      const t = dev.tid(x, y);
      const kind = dev.tileKind[t]!;
      if (kind === 0) continue;
      const out: string[] = [];
      if (kind === TILE_LOGIC) {
        const clk = getBits(bits, clkSelOffset(dev, x, y), dev.clkBits);
        const neg = bits[clkNegOffset(dev, x, y)]!;
        if (clk || neg) out.push(`  clock: global ${clk}${neg ? ', falling edge' : ''}`);
        for (let k = 0; k < LCS_PER_TILE; k++) {
          const c = readLc(dev, bits, x, y, k);
          const flags: string[] = [];
          if (c.ff) flags.push(`ff${c.init ? ' init=1' : ''}${c.ceEn ? ' ce' : ''}${c.srEn ? ` ${c.srAsync ? 'async ' : 'sync '}${c.srVal ? 'set' : 'reset'}` : ''}`);
          if (c.i3Carry) flags.push('I3=carry');
          if (c.carryChain) flags.push('carry-in=chain');
          else if (c.carryConst) flags.push('carry-in=1');
          if (c.lut || flags.length) out.push(`  LC${k}: lut=0x${c.lut.toString(16).padStart(4, '0')}${flags.length ? ' ' + flags.join(' ') : ''}`);
        }
      } else if (kind === TILE_IO) {
        for (let s = 0; s < dev.spec.padsPerTile; s++) {
          const pad = dev.pads[dev.padAt(x, y, s)]!;
          const o = padOffset(dev, pad.index);
          if (bits[o] || bits[o + 1]) out.push(`  ${pad.name}: ${bits[o] ? 'output' : 'input'}${bits[o + 1] ? ' pull-up' : ''}`);
        }
      } else {
        const c = readBram(dev, bits, x, y);
        const init = bramInitOffset(dev, x, y);
        let ones = 0;
        for (let i = 0; i < BRAM_BITS; i++) ones += bits[init + i]!;
        if (c.mode || c.asyncRead || c.rclk || c.wclk || ones) out.push(`  RAM: ${BRAM_WIDTHS[c.mode]} bits wide, ${c.asyncRead ? 'asynchronous' : 'synchronous'} read, clocks ${c.rclk}/${c.wclk}, ${ones} ones in the contents`);
      }
      for (let n = dev.tileNodeStart[t]!; n < dev.tileNodeStart[t + 1]!; n++) {
        const { code, input } = readSelect(dev, bits, n);
        if (code) out.push(`  ${dev.nodeName(n)} <= ${input >= 0 ? dev.nodeName(input) : `(reserved code ${code})`}`);
      }
      if (out.length) lines.push(`tile (${x}, ${y}) ${KIND_NAMES[kind as 1 | 2 | 3]}:`, ...out);
    }
  }
  return lines.join('\n');
}

const countOnes = (bits: Uint8Array): number => {
  let n = 0;
  for (let i = 0; i < bits.length; i++) n += bits[i]!;
  return n;
};

/**
 * Hand configuration: an editable configuration with named accessors. Nodes can be given as ids or as names
 * ("LCO(1,1,0)", "W(1,1,E,1,0)"; see `device.findNode`).
 */
export class FabricConfig {
  readonly bits: Uint8Array;

  constructor(
    readonly device: VFpgaDevice,
    bits?: Uint8Array,
  ) {
    if (bits && bits.length !== device.totalBits) throw new BitstreamError(`a ${device.name} configuration has ${device.totalBits} bits, not ${bits.length}`);
    this.bits = bits ?? new Uint8Array(device.totalBits);
  }

  node(n: number | string): number {
    const id = typeof n === 'string' ? this.device.findNode(n) : n;
    if (id < 0 || id >= this.device.nodeCount) throw new Error(`no such routing node: ${n}`);
    return id;
  }

  private tile(x: number, y: number, kind: number): void {
    const d = this.device;
    if (x < 0 || y < 0 || x >= d.width || y >= d.height || d.tileKind[d.tid(x, y)] !== kind) throw new Error(`tile (${x}, ${y}) is not a ${['empty', 'logic', 'I/O', 'block RAM'][kind]} tile`);
  }

  lc(x: number, y: number, k: number): LcConfig {
    this.tile(x, y, TILE_LOGIC);
    return readLc(this.device, this.bits, x, y, k);
  }

  setLc(x: number, y: number, k: number, c: Partial<LcConfig>): this {
    this.tile(x, y, TILE_LOGIC);
    if (k < 0 || k >= LCS_PER_TILE) throw new RangeError(`logic cell ${k}`);
    writeLc(this.device, this.bits, x, y, k, c);
    return this;
  }

  setLut(x: number, y: number, k: number, truth: number): this {
    return this.setLc(x, y, k, { lut: truth & 0xffff });
  }

  /** Global clock and polarity of a logic tile's flip-flops. */
  setTileClock(x: number, y: number, global: number, falling = false): this {
    this.tile(x, y, TILE_LOGIC);
    setBits(this.bits, clkSelOffset(this.device, x, y), this.device.clkBits, global);
    this.bits[clkNegOffset(this.device, x, y)] = falling ? 1 : 0;
    return this;
  }

  setPad(pad: number | string, cfg: { output?: boolean; pullup?: boolean }): this {
    const p = typeof pad === 'string' ? this.device.pads.findIndex((q) => q.name === pad) : pad;
    if (p < 0 || p >= this.device.pads.length) throw new Error(`no such pad: ${pad}`);
    const o = padOffset(this.device, p);
    if (cfg.output !== undefined) this.bits[o] = cfg.output ? 1 : 0;
    if (cfg.pullup !== undefined) this.bits[o + 1] = cfg.pullup ? 1 : 0;
    return this;
  }

  setBram(x: number, y: number, cfg: Partial<BramConfig> & { contents?: ArrayLike<number> }): this {
    this.tile(x, y, TILE_BRAM);
    const d = this.device;
    const o = bramOffset(d, x, y);
    if (cfg.mode !== undefined) setBits(this.bits, o, 2, cfg.mode);
    if (cfg.asyncRead !== undefined) this.bits[o + 2] = cfg.asyncRead ? 1 : 0;
    if (cfg.rclk !== undefined) setBits(this.bits, o + 3, d.clkBits, cfg.rclk);
    if (cfg.wclk !== undefined) setBits(this.bits, o + 3 + d.clkBits, d.clkBits, cfg.wclk);
    if (cfg.contents) {
      const mode = getBits(this.bits, o, 2);
      const w = BRAM_WIDTHS[mode]!;
      const init = bramInitOffset(d, x, y);
      for (let a = 0; a < BRAM_BITS / w; a++) setBits(this.bits, init + a * w, w, cfg.contents[a] ?? 0);
    }
    return this;
  }

  /** Make multiplexer `to` select `from`. */
  select(to: number | string, from: number | string): this {
    const d = this.device;
    const t = this.node(to);
    const f = this.node(from);
    const code = d.selectFor(t, f);
    if (code === 0) throw new Error(`${d.nodeName(f)} is not an input of the multiplexer driving ${d.nodeName(t)}`);
    setBits(this.bits, d.cfgOffset[t]!, d.cfgWidth[t]!, code);
    return this;
  }

  /** Disconnect multiplexer `to`. */
  clear(to: number | string): this {
    const t = this.node(to);
    if (this.device.cfgOffset[t]! >= 0) setBits(this.bits, this.device.cfgOffset[t]!, this.device.cfgWidth[t]!, 0);
    return this;
  }

  /** Set the multiplexers along a path of nodes (each must be an input of the next). */
  connect(path: (number | string)[]): this {
    for (let i = 1; i < path.length; i++) this.select(path[i]!, path[i - 1]!);
    return this;
  }

  /**
   * Connect `from` to `to` along the shortest path that does not disturb what is already configured (a multiplexer
   * that already selects something can only be passed through by the same input), and return the path.
   */
  route(from: number | string, to: number | string): number[] {
    const d = this.device;
    const src = this.node(from);
    const dst = this.node(to);
    const prev = new Int32Array(d.nodeCount).fill(-2);
    prev[src] = -1;
    const queue = [src];
    for (let qi = 0; qi < queue.length && prev[dst] === -2; qi++) {
      const n = queue[qi]!;
      for (let e = d.outStart[n]!; e < d.outStart[n + 1]!; e++) {
        const m = d.outList[e]!;
        if (prev[m] !== -2) continue;
        const cur = readSelect(d, this.bits, m);
        if (cur.code !== 0 && cur.input !== n) continue;
        prev[m] = n;
        queue.push(m);
      }
    }
    if (prev[dst] === -2) throw new Error(`no free route from ${d.nodeName(src)} to ${d.nodeName(dst)}`);
    const path: number[] = [];
    for (let n = dst; n !== -1; n = prev[n]!) path.push(n);
    path.reverse();
    this.connect(path);
    return path;
  }

  /** What each node's multiplexer currently selects (−1 for none). */
  selected(n: number | string): number {
    return readSelect(this.device, this.bits, this.node(n)).input;
  }

  /** Invert one bit (a "cosmic ray"). */
  flip(index: number): this {
    if (index < 0 || index >= this.bits.length) throw new RangeError(`bit ${index}`);
    this.bits[index] = this.bits[index] ? 0 : 1;
    return this;
  }

  describe(index: number): BitDescription {
    return describeBit(this.device, index, this.bits);
  }

  dump(): string {
    return dumpBitstream(this.device, this.bits);
  }

  encode(): Uint8Array {
    return encodeBitstream(this.device, this.bits);
  }
}

// ─── The bitstream file ───────────────────────────────────────────────────────────────────────────

const MAGIC = [0x56, 0x46, 0x50, 0x47]; // "VFPG"
const VERSION = 1;

let crcTable: Uint32Array | undefined;
export function crc32(data: Uint8Array, start = 0, end = data.length, seed = 0): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = ~seed >>> 0;
  for (let i = start; i < end; i++) c = crcTable[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return ~c >>> 0;
}

/**
 * The bitstream as a file: header (magic "VFPG", version, device name, total bits, frame count), then per frame its
 * length in bits, its bits packed least-significant-bit first, and a CRC-32 of the packed bytes; then a CRC-32 of
 * everything before it.
 */
export function encodeBitstream(dev: VFpgaDevice, bits: Uint8Array): Uint8Array {
  if (bits.length !== dev.totalBits) throw new BitstreamError(`a ${dev.name} configuration has ${dev.totalBits} bits, not ${bits.length}`);
  const name = new TextEncoder().encode(dev.name);
  let size = 4 + 1 + 1 + name.length + 4 + 2 + 4;
  for (const f of dev.frames) size += 4 + Math.ceil(f.length / 8) + 4;
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  let p = 0;
  for (const b of MAGIC) out[p++] = b;
  out[p++] = VERSION;
  out[p++] = name.length;
  out.set(name, p);
  p += name.length;
  dv.setUint32(p, dev.totalBits, true);
  p += 4;
  dv.setUint16(p, dev.frames.length, true);
  p += 2;
  for (const f of dev.frames) {
    dv.setUint32(p, f.length, true);
    p += 4;
    const start = p;
    for (let i = 0; i < f.length; i++) if (bits[f.start + i]) out[start + (i >> 3)]! |= 1 << (i & 7);
    p += Math.ceil(f.length / 8);
    dv.setUint32(p, crc32(out, start, p), true);
    p += 4;
  }
  dv.setUint32(p, crc32(out, 0, p), true);
  return out;
}

/** Read a bitstream file, checking the magic number, the device's frame layout and every CRC. */
export function parseBitstream(bytes: Uint8Array, dev: VFpgaDevice): Uint8Array {
  const fail = (msg: string): never => {
    throw new BitstreamError(msg);
  };
  if (bytes.length < 16 || MAGIC.some((b, i) => bytes[i] !== b)) fail('not a vFPGA bitstream (bad magic number)');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[4] !== VERSION) fail(`unsupported bitstream version ${bytes[4]}`);
  const nameLen = bytes[5]!;
  const name = new TextDecoder().decode(bytes.subarray(6, 6 + nameLen));
  if (name !== dev.name) fail(`this bitstream is for ${name}, not ${dev.name}`);
  let p = 6 + nameLen;
  const total = dv.getUint32(p, true);
  p += 4;
  const nFrames = dv.getUint16(p, true);
  p += 2;
  if (total !== dev.totalBits || nFrames !== dev.frames.length) fail('the bitstream does not match the device layout');
  const bits = new Uint8Array(total);
  for (let fi = 0; fi < nFrames; fi++) {
    const f = dev.frames[fi]!;
    if (p + 4 > bytes.length || dv.getUint32(p, true) !== f.length) fail(`frame ${fi} has the wrong length`);
    p += 4;
    const start = p;
    p += Math.ceil(f.length / 8);
    if (p + 4 > bytes.length) fail('the bitstream is truncated');
    if (dv.getUint32(p, true) !== crc32(bytes, start, p)) fail(`frame ${fi} is corrupt (CRC mismatch)`);
    p += 4;
    for (let i = 0; i < f.length; i++) bits[f.start + i] = (bytes[start + (i >> 3)]! >> (i & 7)) & 1;
  }
  if (p + 4 !== bytes.length || dv.getUint32(p, true) !== crc32(bytes, 0, p)) fail('the bitstream is corrupt (final CRC mismatch)');
  return bits;
}

/** Names of routing nodes' directions, re-exported for views. */
export { DIR_NAMES, NK };
