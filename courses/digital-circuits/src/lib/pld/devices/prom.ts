/**
 * vPROM: a virtual bipolar fuse PROM, N address lines by M data outputs.
 *
 * The device is a fuse matrix with one fuse per stored bit, at (word, bit). A decoder selects one
 * word from the address; each fuse in that word, if intact, reads as the "unprogrammed" value
 * and, once blown by its programming pulse, as the opposite. Blowing is one-way: a blown fuse
 * cannot be repaired, so a PROM can be programmed once (and further bits can only be added).
 *
 * Conventions used throughout (and by the fuse-map JSON):
 * - `fuses[word * width + column]` is 1 when the fuse is blown. Column 0 is the leftmost, most
 *   significant data bit (D(M−1)); column M−1 is D0. A word's value is therefore the binary number
 *   read left to right across the row, as in a printed fuse map.
 * - A virgin part reads all zeros and blowing a fuse makes the bit read 1 (`blownReads = 1`).
 *   Real families differ: some ship with all 0s, some with all 1s, and nichrome-fuse parts with
 *   inverting output stages read the other way. The option `blownReads` selects the other polarity.
 * - Addresses are numbered as minterms: with address inputs named A(N−1)…A0 (the default), the
 *   address is the binary number A(N−1)…A0, and in equations the leftmost input is the most
 *   significant bit, as in a truth table.
 */
import {
  functionFromEquations,
  parseTruthTable,
  type BoolFunction,
} from '../twolevel/expr';
import { cubeHasMinterm } from '../twolevel/cube';

export const VPROM_ADDRESS_BITS = 5;
export const VPROM_WIDTH = 8;

export class PromError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromError';
  }
}

/** One programming pulse: blow the fuse of a bit in a word. */
export interface PromBlowOp {
  word: number;
  /** Column, 0 = most significant data bit. */
  column: number;
}

export interface PromOptions {
  /** Address lines (default 5, so 32 words). */
  addressBits?: number;
  /** Data outputs (default 8). */
  width?: number;
  /** What a blown fuse reads as (default 1; a virgin device reads the opposite). */
  blownReads?: 0 | 1;
  inputs?: string[];
  outputs?: string[];
}

export interface PromFuseMap {
  device: 'vPROM';
  version: 1;
  addressBits: number;
  width: number;
  words: number;
  blownReads: 0 | 1;
  /** Address input names, most significant first. */
  inputs: string[];
  /** Data output names, most significant (column 0) first. */
  outputs: string[];
  /** One string of '0'/'1' per word, column 0 first; '1' = blown fuse. */
  fuses: string[];
  /** The stored words. */
  data: number[];
  blown: number;
}

export function defaultAddressNames(bits: number): string[] {
  return Array.from({ length: bits }, (_, i) => `A${bits - 1 - i}`);
}

export function defaultDataNames(width: number): string[] {
  return Array.from({ length: width }, (_, i) => `D${width - 1 - i}`);
}

export class Prom {
  readonly addressBits: number;
  readonly width: number;
  readonly words: number;
  readonly blownReads: 0 | 1;
  readonly inputs: string[];
  readonly outputs: string[];
  /** 1 = blown, index word × width + column. */
  readonly fuses: Uint8Array;

  constructor(opts: PromOptions = {}, fuses?: ArrayLike<number>) {
    this.addressBits = opts.addressBits ?? VPROM_ADDRESS_BITS;
    this.width = opts.width ?? VPROM_WIDTH;
    if (!Number.isInteger(this.addressBits) || this.addressBits < 1 || this.addressBits > 16) throw new PromError('A vPROM has 1 to 16 address lines');
    if (!Number.isInteger(this.width) || this.width < 1 || this.width > 32) throw new PromError('A vPROM has 1 to 32 data outputs');
    this.words = 2 ** this.addressBits;
    this.blownReads = opts.blownReads ?? 1;
    this.inputs = opts.inputs ?? defaultAddressNames(this.addressBits);
    this.outputs = opts.outputs ?? defaultDataNames(this.width);
    if (this.inputs.length !== this.addressBits) throw new PromError(`Expected ${this.addressBits} address names`);
    if (this.outputs.length !== this.width) throw new PromError(`Expected ${this.width} output names`);
    this.fuses = new Uint8Array(this.words * this.width);
    if (fuses) {
      if (fuses.length !== this.fuses.length) throw new PromError(`Expected ${this.fuses.length} fuses, got ${fuses.length}`);
      for (let i = 0; i < fuses.length; i++) this.fuses[i] = fuses[i] ? 1 : 0;
    }
  }

  get fuseCount(): number {
    return this.fuses.length;
  }

  fuseIndex(word: number, column: number): number {
    this.checkWord(word);
    if (!Number.isInteger(column) || column < 0 || column >= this.width) throw new PromError(`Column ${column} out of range`);
    return word * this.width + column;
  }

  private checkWord(word: number): void {
    if (!Number.isInteger(word) || word < 0 || word >= this.words) throw new PromError(`Address ${word} out of range (0–${this.words - 1})`);
  }

  /** The data bit (0 = D0, the least significant) of a column. */
  bitOfColumn(column: number): number {
    return this.width - 1 - column;
  }

  columnOfBit(bit: number): number {
    return this.width - 1 - bit;
  }

  isBlown(word: number, column: number): boolean {
    return this.fuses[this.fuseIndex(word, column)] === 1;
  }

  /** Blow one fuse. Returns false if it was already blown (nothing happens). */
  blow(word: number, column: number): boolean {
    const i = this.fuseIndex(word, column);
    if (this.fuses[i]) return false;
    this.fuses[i] = 1;
    return true;
  }

  /** Blow the fuse of data bit `bit` (0 = D0) in a word. */
  blowBit(word: number, bit: number): boolean {
    return this.blow(word, this.columnOfBit(bit));
  }

  /** The value of one stored bit column (what the output reads). */
  bitValue(word: number, column: number): 0 | 1 {
    const blown = this.fuses[this.fuseIndex(word, column)] === 1;
    return (blown ? this.blownReads : 1 - this.blownReads) as 0 | 1;
  }

  /** The word stored at an address, with column 0 as the most significant bit. */
  read(address: number): number {
    this.checkWord(address);
    let v = 0;
    for (let c = 0; c < this.width; c++) v = v * 2 + this.bitValue(address, c);
    return v >>> 0;
  }

  /** The output levels at an address, column 0 first (most significant first). */
  readBits(address: number): (0 | 1)[] {
    this.checkWord(address);
    return Array.from({ length: this.width }, (_, c) => this.bitValue(address, c));
  }

  /** Evaluate from address input levels, given most significant first (A(N−1)…A0). */
  evaluate(inputs: ArrayLike<number>): (0 | 1)[] {
    if (inputs.length !== this.addressBits) throw new PromError(`Expected ${this.addressBits} inputs`);
    let a = 0;
    for (let i = 0; i < inputs.length; i++) a = a * 2 + (inputs[i] ? 1 : 0);
    return this.readBits(a);
  }

  /** All stored words. */
  contents(): number[] {
    return Array.from({ length: this.words }, (_, a) => this.read(a));
  }

  /** The fuses that must be blown to turn the current contents into `target` (a word per address). */
  plan(target: ArrayLike<number>): PromBlowOp[] {
    if (target.length > this.words) throw new PromError(`${target.length} words do not fit in ${this.words}`);
    const max = this.width >= 32 ? 0xffffffff : 2 ** this.width - 1;
    const ops: PromBlowOp[] = [];
    for (let word = 0; word < this.words; word++) {
      const want = word < target.length ? target[word]! : this.read(word);
      if (!Number.isInteger(want) || want < 0 || want > max) throw new PromError(`Word ${word} = ${want} does not fit in ${this.width} bits`);
      for (let c = 0; c < this.width; c++) {
        const bit = (want / 2 ** this.bitOfColumn(c)) & 1 ? 1 : 0;
        const have = this.bitValue(word, c);
        if (bit === have) continue;
        if (this.fuses[this.fuseIndex(word, c)])
          throw new PromError(
            `Address ${word}, ${this.outputs[c]}: the fuse is already blown, so the bit cannot change back to ${bit}. A fuse PROM can only be programmed once.`,
          );
        ops.push({ word, column: c });
      }
    }
    return ops;
  }

  /** Apply programming pulses (each blows a fuse). Returns the number of fuses actually blown. */
  apply(ops: PromBlowOp[]): number {
    let n = 0;
    for (const op of ops) if (this.blow(op.word, op.column)) n++;
    return n;
  }

  /** Program the words (one per address; addresses beyond the list are left alone). */
  program(target: ArrayLike<number>): PromBlowOp[] {
    const ops = this.plan(target);
    this.apply(ops);
    return ops;
  }

  /** Program from a multi-output function; don't cares read as the virgin value. Inputs are the address, most significant first. */
  programFunction(f: BoolFunction): PromBlowOp[] {
    return this.program(wordsOf(f, this));
  }

  /** Program from a truth table in the `A B C | Y Z` text form. */
  programTruthTable(text: string): PromBlowOp[] {
    return this.programFunction(parseTruthTable(text));
  }

  /** Program from equations `Y = expr`; the variables are the address inputs, most significant first. */
  programEquations(text: string, inputs: string[] = this.inputs): PromBlowOp[] {
    return this.programFunction(functionFromEquations(text, inputs));
  }

  /** Addresses whose stored word differs from `expected`. */
  verify(expected: ArrayLike<number>): { address: number; expected: number; actual: number }[] {
    const out: { address: number; expected: number; actual: number }[] = [];
    for (let a = 0; a < expected.length && a < this.words; a++) {
      const actual = this.read(a);
      if (actual !== expected[a]) out.push({ address: a, expected: expected[a]!, actual });
    }
    return out;
  }

  clone(): Prom {
    return new Prom({ addressBits: this.addressBits, width: this.width, blownReads: this.blownReads, inputs: this.inputs, outputs: this.outputs }, this.fuses);
  }

  toFuseMap(): PromFuseMap {
    const fuses: string[] = [];
    let blown = 0;
    for (let w = 0; w < this.words; w++) {
      let row = '';
      for (let c = 0; c < this.width; c++) {
        const f = this.fuses[w * this.width + c]!;
        blown += f;
        row += f;
      }
      fuses.push(row);
    }
    return {
      device: 'vPROM',
      version: 1,
      addressBits: this.addressBits,
      width: this.width,
      words: this.words,
      blownReads: this.blownReads,
      inputs: this.inputs.slice(),
      outputs: this.outputs.slice(),
      fuses,
      data: this.contents(),
      blown,
    };
  }

  static fromFuseMap(map: PromFuseMap): Prom {
    if (map.device !== 'vPROM') throw new PromError(`Not a vPROM fuse map: ${String(map.device)}`);
    const p = new Prom({ addressBits: map.addressBits, width: map.width, blownReads: map.blownReads, inputs: map.inputs, outputs: map.outputs });
    if (map.fuses.length !== p.words) throw new PromError(`Expected ${p.words} fuse rows, got ${map.fuses.length}`);
    map.fuses.forEach((row, w) => {
      if (row.length !== p.width || /[^01]/.test(row)) throw new PromError(`Bad fuse row ${w}: "${row}"`);
      for (let c = 0; c < p.width; c++) p.fuses[w * p.width + c] = row.charCodeAt(c) === 49 ? 1 : 0;
    });
    return p;
  }

  /** A truth table of the stored data, `A4 … A0 | D7 … D0`, one row per address. */
  toTruthTable(): string {
    const lines = [`${this.inputs.join(' ')} | ${this.outputs.join(' ')}`];
    for (let a = 0; a < this.words; a++) {
      const bits = a.toString(2).padStart(this.addressBits, '0').split('');
      lines.push(`${bits.join(' ')} | ${this.readBits(a).join(' ')}`);
    }
    return lines.join('\n');
  }
}

/**
 * The words a function specifies on a PROM. Function inputs are matched to address lines by name
 * when every name is one of the PROM's; otherwise they are taken to be the low-order address lines
 * (the last input is A0) and the higher lines are ignored, so the function repeats. Outputs are
 * matched the same way (otherwise the last output is D0). Columns the function does not drive, and
 * don't-care outputs, keep the virgin value.
 */
export function wordsOf(
  f: BoolFunction,
  prom: { addressBits: number; width: number; blownReads: 0 | 1; inputs?: string[]; outputs?: string[] },
): number[] {
  const N = prom.addressBits;
  const M = prom.width;
  const n = f.inputs.length;
  if (n > N) throw new PromError(`The function has ${n} inputs but the PROM has ${N} address lines`);
  if (f.outputs.length > M) throw new PromError(`The function has ${f.outputs.length} outputs but the PROM is ${M} bits wide`);
  const inNames = prom.inputs ?? defaultAddressNames(N);
  const outNames = prom.outputs ?? defaultDataNames(M);
  // Address line (0 = most significant) of each function input.
  const byName = f.inputs.every((x) => inNames.includes(x)) && new Set(f.inputs).size === n;
  const line = f.inputs.map((x, i) => (byName ? inNames.indexOf(x) : N - n + i));
  const outByName = f.outputs.every((x) => outNames.includes(x)) && new Set(f.outputs).size === f.outputs.length;
  const column = f.outputs.map((x, o) => (outByName ? outNames.indexOf(x) : M - f.outputs.length + o));
  const virgin = prom.blownReads === 1 ? 0 : 1;
  const words: number[] = [];
  for (let a = 0; a < 2 ** N; a++) {
    // The minterm of the function at this address.
    let minterm = 0;
    for (let i = 0; i < n; i++) minterm = minterm * 2 + ((a >>> (N - 1 - line[i]!)) & 1);
    const bits = new Array<number>(M).fill(virgin);
    f.outputs.forEach((_, o) => {
      if (f.on[o]!.cubes.some((c) => cubeHasMinterm(c, minterm, n))) bits[column[o]!] = 1 - virgin;
    });
    let w = 0;
    for (const b of bits) w = w * 2 + b;
    words.push(w >>> 0);
  }
  return words;
}
