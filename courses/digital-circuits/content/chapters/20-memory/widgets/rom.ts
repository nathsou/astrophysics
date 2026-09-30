/**
 * A ROM as a grid of crossings: a word line for each word, a sense line for each bit, and a connection where the
 * bit is 1. In the Apollo Guidance Computer's core rope a sense wire *threads* the core of a word to make a 1
 * and *bypasses* it to make a 0; in a mask ROM a transistor sits at the crossing (or a diode, in earlier
 * ones). The picture is the same, and so is the logic: a ROM is a truth table with the address as the input.
 */

export const ROM_BITS = 7;

export interface Rom {
  /** words[a][b]: 1 where the sense line b is coupled to word line a. Bit 0 is the most significant. */
  words: number[][];
}

export const bitsOfChar = (ch: string, width = ROM_BITS): number[] => {
  const code = ch.charCodeAt(0) & ((1 << width) - 1);
  return Array.from({ length: width }, (_, i) => (code >> (width - 1 - i)) & 1);
};

export const charOfBits = (bits: readonly number[]): string => String.fromCharCode(bits.reduce((n, b) => (n << 1) | (b ? 1 : 0), 0));

/** A ROM whose words are the ASCII codes of the characters of a text (padded with spaces to `size` words). */
export function programText(text: string, size = 8, width = ROM_BITS): Rom {
  const chars = text.padEnd(size, ' ').slice(0, size);
  return { words: [...chars].map((c) => bitsOfChar(c, width)) };
}

export function blank(size = 8, width = ROM_BITS): Rom {
  return { words: Array.from({ length: size }, () => Array<number>(width).fill(0)) };
}

/** Read a word: the sense lines that are coupled to the selected word line carry a pulse. */
export const readWord = (rom: Rom, addr: number): number[] => [...rom.words[addr]!];

export const toggle = (rom: Rom, addr: number, bit: number): Rom => ({ words: rom.words.map((w, a) => (a === addr ? w.map((b, i) => (i === bit ? 1 - b : b)) : [...w])) });

/** How many crossings are coupled: cores threaded, or transistors fitted. */
export const couplings = (rom: Rom): number => rom.words.flat().filter(Boolean).length;

/** The text a ROM spells, one character per word. */
export const textOf = (rom: Rom): string => rom.words.map((w) => charOfBits(w)).join('');

/**
 * The AGC's numbers: 36,864 words of 16 bits in the fixed memory, made of 6 modules of 512 cores, each core
 * carrying the 192 bits of 12 words.
 */
export const AGC = { words: 36864, wordBits: 16, modules: 6, coresPerModule: 512 } as const;
export const agcBits = (): number => AGC.words * AGC.wordBits;
