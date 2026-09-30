/**
 * Why one big PAL does not scale, and what function blocks and a matrix do about it, counted with the vCPLD-32's own
 * numbers (src/lib/pld/devices/vcpld32-arch.ts).
 *
 * Take M macrocells, each with 5 product terms. In the vCPLD-32 the signals available to the logic are M pins and the
 * M macrocell feedbacks, so 2M signals, each needed true and complemented: 4M columns. A single array in which every
 * product term can see every signal has 5M rows of 4M crosspoints: 20 M². Split the same macrocells into blocks of
 * eight and let each block see only 24 of the 2M signals through a matrix of multiplexers, and the array is 40 terms by
 * 48 columns per block, plus the multiplexer bits: linear in M.
 */
import { FB_INPUTS, LITERAL_COLUMNS, MACROCELLS, MACROCELLS_PER_FB, MUX_BITS, TERMS_PER_FB, TERMS_PER_MC } from '$lib/pld/devices/vcpld32-arch';

export const SIZES = [8, 16, 32, 64, 128, 256, 512] as const;

export interface Counts {
  macrocells: number;
  /** Signals the logic can choose from: pins and feedbacks. */
  signals: number;
  /** Fuses (configuration bits) in the AND array(s). */
  array: number;
  /** Bits of the interconnect matrix (zero for the single array). */
  matrix: number;
  total: number;
  /** Inputs of every product term's AND gate. */
  fanIn: number;
  /** Function blocks. */
  blocks: number;
}

export function monolithic(m: number): Counts {
  const signals = 2 * m;
  const array = TERMS_PER_MC * m * 2 * signals;
  return { macrocells: m, signals, array, matrix: 0, total: array, fanIn: 2 * signals, blocks: 1 };
}

/** Bits to select one of `signals` sources. */
export const muxBits = (signals: number): number => Math.ceil(Math.log2(signals));

export function blocked(m: number): Counts {
  const blocks = m / MACROCELLS_PER_FB;
  const signals = 2 * m;
  const array = blocks * TERMS_PER_FB * LITERAL_COLUMNS;
  const matrix = blocks * FB_INPUTS * muxBits(signals);
  return { macrocells: m, signals, array, matrix, total: array + matrix, fanIn: LITERAL_COLUMNS, blocks };
}

/** The ratio of the single array's fuses to the blocked device's configuration bits. */
export const advantage = (m: number): number => monolithic(m).total / blocked(m).total;

export const VCPLD_MACROCELLS = MACROCELLS;
export const VCPLD_MUX_BITS = MUX_BITS;
