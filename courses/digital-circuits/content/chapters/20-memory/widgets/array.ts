/**
 * A small memory as the explorer shows it: an address decoder, a word line for each word, a pair of bit lines for
 * each bit of the word, and a cell at every crossing. A read or a write is a short sequence of *frames*, each
 * with the voltage of every line and the stored charge of every cell, so a widget can play them one by one and
 * the tests can check the physics of each step.
 *
 *   SRAM  six transistors per cell, two complementary bit lines. Read: precharge both lines high, raise the
 *         word line, the cell pulls one line down a little, the sense amplifier finishes the job. The cell is
 *         untouched. Write: the drivers force the lines, and win against the cell.
 *   DRAM  one transistor and a capacitor. Read: precharge the bit line to half the supply, raise the word line,
 *         share charge (a swing of tens of millivolts), sense, and *write the value back*, because sharing
 *         destroyed it.
 *   ROM   a transistor at each crossing that holds a 1 (and none where it holds a 0). Read: precharge, raise the
 *         word line, and the transistors pull their bit lines low. Nothing can be written.
 */
import { DRAM, chargeShare, swing } from './dram';

export type CellKind = 'sram' | 'dram' | 'rom';

/** Bit-line difference (V) a 6T cell makes before the sense amplifier fires. */
export const SRAM_DIFF = 0.1;

export interface Frame {
  label: string;
  /** What is happening, in a sentence. */
  text: string;
  /** Which word line is high. */
  wl: boolean[];
  /** Bit line voltages (V). */
  bl: number[];
  /** Complementary bit line voltages (V); empty for a ROM, which has one line per bit. */
  blb: number[];
  /** How each column's lines are being held. */
  lines: ('driven' | 'charged' | 'shared' | 'sensed' | 'released')[];
  /** Stored bit of every cell. */
  cells: number[][];
  /** Voltage on every cell's storage node. */
  cellV: number[][];
  /** The word being read or written, once known. */
  q: (number | null)[];
  /** The write drivers, the precharge circuit and the sense amplifiers are working. */
  drivers: boolean;
  precharge: boolean;
  sense: boolean;
}

export interface Facts {
  /** Transistors in the cell array. */
  cellTransistors: number;
  /** Capacitors in the cell array. */
  capacitors: number;
  /** Gates in the address decoder: the AND gates and the inverters. */
  decoderGates: { and: number; not: number; fanIn: number };
}

export class Mem {
  readonly words: number;
  /** The stored bits of every word, most significant bit first. */
  cells: number[][];
  constructor(
    readonly kind: CellKind,
    readonly addrBits = 3,
    readonly width = 4,
    contents?: number[],
  ) {
    this.words = 1 << addrBits;
    this.cells = Array.from({ length: this.words }, (_, a) => this.bitsOf(contents?.[a] ?? 0));
  }

  private bitsOf(word: number): number[] {
    return Array.from({ length: this.width }, (_, i) => (word >> (this.width - 1 - i)) & 1);
  }
  wordOf(bits: readonly number[]): number {
    return bits.reduce((n, b) => (n << 1) | (b ? 1 : 0), 0);
  }
  /** The word stored at an address. */
  peek(addr: number): number {
    return this.wordOf(this.cells[addr]!);
  }
  /** The address decoder: exactly one word line for each address. */
  decode(addr: number): boolean[] {
    return Array.from({ length: this.words }, (_, i) => i === addr);
  }
  get vdd(): number {
    return DRAM.vdd;
  }

  facts(): Facts {
    const n = this.words * this.width;
    const ones = this.cells.flat().filter(Boolean).length;
    return {
      cellTransistors: this.kind === 'sram' ? 6 * n : this.kind === 'dram' ? n : ones,
      capacitors: this.kind === 'dram' ? n : 0,
      decoderGates: { and: this.words, not: this.addrBits, fanIn: this.addrBits },
    };
  }

  private cellV(r: number, c: number): number {
    return this.cells[r]![c]! ? this.vdd : 0;
  }

  private frame(p: Partial<Frame> & Pick<Frame, 'label' | 'text'>): Frame {
    const w = this.width;
    return {
      wl: Array<boolean>(this.words).fill(false),
      bl: Array<number>(w).fill(this.kind === 'dram' ? this.vdd / 2 : this.vdd),
      blb: this.kind === 'rom' ? [] : Array<number>(w).fill(this.kind === 'dram' ? this.vdd / 2 : this.vdd),
      lines: Array<Frame['lines'][number]>(w).fill('released'),
      cells: this.cells.map((r) => [...r]),
      cellV: this.cells.map((row, r) => row.map((_, c) => this.cellV(r, c))),
      q: Array<number | null>(w).fill(null),
      drivers: false,
      precharge: false,
      sense: false,
      ...p,
    };
  }

  /** The array at rest: every word line low, the bit lines let go. */
  idle(): Frame {
    return this.frame({ label: 'Idle', text: 'All word lines are low: every cell is cut off from the bit lines and simply holds its bit.', lines: Array(this.width).fill('released') });
  }

  /** The frames of a read: the last one holds the word in `q`. */
  read(addr: number): Frame[] {
    const a = this.decode(addr);
    const w = this.width;
    const bits = this.cells[addr]!;
    const v = this.vdd;
    if (this.kind === 'sram') {
      return [
        this.frame({ label: 'Precharge', text: 'The precharge transistors pull both bit lines of every column up to the supply and let go: each line is now a small capacitor holding a 1.', bl: Array(w).fill(v), blb: Array(w).fill(v), lines: Array(w).fill('charged'), precharge: true }),
        this.frame({ label: 'Word line', text: `The decoder raises word line ${addr}. In every column, the two access transistors of that row connect the cell to the bit lines, and the side of the cell that holds a 0 starts to pull its line down.`, wl: a, bl: bits.map((b) => (b ? v : v - SRAM_DIFF)), blb: bits.map((b) => (b ? v - SRAM_DIFF : v)), lines: Array(w).fill('shared') }),
        this.frame({ label: 'Sense', text: 'A sense amplifier, a cross-coupled pair like the cell itself, sees a difference of about 100 mV between the two lines and amplifies it to a full 0 and 1. The word is read; the cell was never disturbed.', wl: a, bl: bits.map((b) => (b ? v : 0)), blb: bits.map((b) => (b ? 0 : v)), lines: Array(w).fill('sensed'), q: [...bits], sense: true }),
        this.frame({ label: 'Done', text: 'The word line falls and the cells are cut off again. Reading an SRAM leaves it as it was.', q: [...bits] }),
      ];
    }
    if (this.kind === 'dram') {
      const half = v / 2;
      const shared = bits.map((b) => chargeShare(b ? v : 0, half));
      return [
        this.frame({ label: 'Precharge', text: 'Both bit lines of every column are precharged to half the supply, 0.6 V, and let go.', lines: Array(w).fill('charged'), precharge: true }),
        this.frame({ label: 'Word line', text: `Word line ${addr} rises. Each cell of the row shares its charge with its bit line. The line moves only a little (${(swing(v) * 1000).toFixed(0)} mV for a full cell, up or down), and the cell itself is left at the same in-between voltage: the stored value is gone.`, wl: a, bl: shared, blb: Array(w).fill(half), lines: Array(w).fill('shared'), cellV: this.cellV2(addr, shared) }),
        this.frame({ label: 'Sense', text: 'The sense amplifier (the same cross-coupled pair as an SRAM cell) amplifies the small difference between the bit line and its reference to a full 0 or 1.', wl: a, bl: bits.map((b) => (b ? v : 0)), blb: bits.map((b) => (b ? 0 : v)), lines: Array(w).fill('sensed'), cellV: this.cellV2(addr, shared), q: [...bits], sense: true }),
        this.frame({ label: 'Restore', text: 'With the word line still up, the amplified bit line recharges the cell (or empties it): the value that the read destroyed is written back. Every read of a DRAM row is a read followed by a write.', wl: a, bl: bits.map((b) => (b ? v : 0)), blb: bits.map((b) => (b ? 0 : v)), lines: Array(w).fill('driven'), q: [...bits], sense: true }),
        this.frame({ label: 'Done', text: 'The word line falls. The cells hold full charge again, and the leak starts over.', q: [...bits] }),
      ];
    }
    // ROM: a transistor at each 1.
    return [
      this.frame({ label: 'Precharge', text: 'The bit lines are precharged high.', lines: Array(w).fill('charged'), precharge: true }),
      this.frame({ label: 'Word line', text: `Word line ${addr} rises. Where the row has a transistor (a stored 1) it turns on and pulls its bit line to ground; where there is none, the line stays high.`, wl: a, bl: bits.map((b) => (b ? 0 : v)), lines: Array(w).fill('shared') }),
      this.frame({ label: 'Sense', text: 'An inverter on each column turns "line pulled low" into a 1. The word is read.', wl: a, bl: bits.map((b) => (b ? 0 : v)), lines: Array(w).fill('sensed'), q: [...bits], sense: true }),
      this.frame({ label: 'Done', text: 'The word line falls. A ROM has no way to change; reading it never disturbs anything.', q: [...bits] }),
    ];
  }

  private cellV2(addr: number, shared: number[]): number[][] {
    return this.cells.map((row, r) => row.map((_, c) => (r === addr ? shared[c]! : this.cellV(r, c))));
  }

  /** The frames of a write (a ROM refuses: no frames). The memory changes as the last frame is reached, so call `commit` after playing them, or use `write`. */
  writeFrames(addr: number, word: number): Frame[] {
    const a = this.decode(addr);
    const w = this.width;
    const v = this.vdd;
    const bits = this.bitsOf(word);
    if (this.kind === 'rom') return [];
    const cellsWith = (row: number[]) => this.cells.map((r, i) => (i === addr ? [...row] : [...r]));
    const voltsWith = (row: number[]) => this.cells.map((r, i) => r.map((b, c) => (i === addr ? (row[c] ? v : 0) : this.cellV(i, c))));
    if (this.kind === 'sram') {
      return [
        this.frame({ label: 'Drivers', text: 'The write drivers in every column force the bit line to the new bit and its partner to the opposite: strong transistors, much stronger than the cell’s own pull-ups.', bl: bits.map((b) => (b ? v : 0)), blb: bits.map((b) => (b ? 0 : v)), lines: Array(w).fill('driven'), drivers: true }),
        this.frame({ label: 'Word line', text: `Word line ${addr} rises. The access transistors connect the cell to the driven lines. A cell whose bit is different loses the fight on its pull-up side and flips.`, wl: a, bl: bits.map((b) => (b ? v : 0)), blb: bits.map((b) => (b ? 0 : v)), lines: Array(w).fill('driven'), drivers: true, cells: cellsWith(bits), cellV: voltsWith(bits) }),
        this.frame({ label: 'Done', text: 'The word line falls and the drivers let go. The cell keeps the new value for as long as it has power: its two inverters hold each other.', cells: cellsWith(bits), cellV: voltsWith(bits), q: [...bits] }),
      ];
    }
    return [
      this.frame({ label: 'Drivers', text: 'The write drivers force each bit line to the supply for a 1 or to ground for a 0.', bl: bits.map((b) => (b ? v : 0)), blb: Array(w).fill(v / 2), lines: Array(w).fill('driven'), drivers: true }),
      this.frame({ label: 'Word line', text: `Word line ${addr} rises. The access transistor connects each cell’s capacitor to its bit line, and the driver charges it to the supply or empties it.`, wl: a, bl: bits.map((b) => (b ? v : 0)), blb: Array(w).fill(v / 2), lines: Array(w).fill('driven'), drivers: true, cells: cellsWith(bits), cellV: voltsWith(bits) }),
      this.frame({ label: 'Done', text: 'The word line falls. The capacitors are cut off, holding their charge: full for a 1, none for a 0, for a while.', cells: cellsWith(bits), cellV: voltsWith(bits), q: [...bits] }),
    ];
  }

  /** Store a word (no-op on a ROM). Returns whether anything was written. */
  commit(addr: number, word: number): boolean {
    if (this.kind === 'rom') return false;
    this.cells[addr] = this.bitsOf(word);
    return true;
  }

  write(addr: number, word: number): Frame[] {
    const f = this.writeFrames(addr, word);
    this.commit(addr, word);
    return f;
  }
}
