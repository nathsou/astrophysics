/**
 * A cosmic ray in the configuration memory: flip one bit of a configured vFPGA-S and see whether the circuit still
 * does its job. The design is the by-hand goal of Figure 28.5 (pad P2 = P0 XOR P1), taken from its worked solution;
 * "still does its job" is the same check as the goal's: the decoded bits are simulated for the four input pairs.
 *
 * A flip in the *file* is a different thing: the bitstream file has a CRC per frame, so a loader refuses it.
 * A flip in the memory after loading has no such protection unless something reads the frames back.
 */
import { getVFpga, type VFpgaDevice } from '$lib/pld/devices/vfpga';
import { BitstreamError, describeBit, encodeBitstream, parseBitstream, type BitDescription } from '$lib/pld/devices/vfpga-config';
import { checkGoal, XOR_GOAL, xorSolution, type GoalCheck } from '$lib/studio/fpga/hand';
import { mulberry32 } from '$lib/pld/twolevel/random';

export const device = (): VFpgaDevice => getVFpga('S');

/** The configured design: the worked solution of the XOR goal. */
export const reference = (): Uint8Array => xorSolution(device());

export interface Strike {
  index: number;
  before: 0 | 1;
  after: 0 | 1;
  what: BitDescription;
  check: GoalCheck;
  /** True when the design still does its job. */
  harmless: boolean;
}

/** Flip bit `index` of the configuration memory and check the goal again. */
export function strike(bits: Uint8Array, index: number, dev: VFpgaDevice = device()): Strike {
  const hit = bits.slice();
  const before = hit[index]! as 0 | 1;
  hit[index] = before ? 0 : 1;
  const check = checkGoal(dev, hit, XOR_GOAL);
  return { index, before, after: hit[index] as 0 | 1, what: describeBit(dev, index, bits), check, harmless: check.ok };
}

/** The same flip in the bitstream *file*, and what a loader says about it (null: it would accept the file). */
export function loaderVerdict(bits: Uint8Array, index: number, dev: VFpgaDevice = device()): string | null {
  const file = encodeBitstream(dev, bits);
  const name = new TextEncoder().encode(dev.name).length;
  let p = 4 + 1 + 1 + name + 4 + 2;
  let f = 0;
  while (f + 1 < dev.frames.length && dev.frames[f + 1]!.start <= index) {
    p += 4 + Math.ceil(dev.frames[f]!.length / 8) + 4;
    f++;
  }
  const o = index - dev.frames[f]!.start;
  file[p + 4 + (o >> 3)]! ^= 1 << (o & 7);
  try {
    parseBitstream(file, dev);
    return null;
  } catch (e) {
    if (e instanceof BitstreamError) return e.message;
    throw e;
  }
}

export interface CategoryCount {
  category: BitDescription['category'];
  label: string;
  bits: number;
  critical: number;
}

export interface Census {
  total: number;
  /** Bits whose flip breaks the design, in bit order. */
  critical: number[];
  byCategory: CategoryCount[];
}

export const CATEGORY_LABELS: Record<BitDescription['category'], string> = {
  lut: 'LUT truth tables',
  'lc-flag': 'cell flags',
  clock: 'clock selects',
  pad: 'pad settings',
  mux: 'routing multiplexers',
  bram: 'block RAM settings',
  'bram-init': 'block RAM contents',
};

/** Flip every bit in turn, one at a time. `onProgress` is called every `every` bits (for a progress bar). */
export function census(bits: Uint8Array, dev: VFpgaDevice = device(), from = 0, to = bits.length, into?: Census): Census {
  const c: Census = into ?? { total: bits.length, critical: [], byCategory: [] };
  const cat = new Map(c.byCategory.map((x) => [x.category, x]));
  for (let i = from; i < to; i++) {
    const s = strike(bits, i, dev);
    const k = s.what.category;
    let row = cat.get(k);
    if (!row) {
      row = { category: k, label: CATEGORY_LABELS[k], bits: 0, critical: 0 };
      cat.set(k, row);
      c.byCategory.push(row);
    }
    row.bits++;
    if (!s.harmless) {
      row.critical++;
      c.critical.push(i);
    }
  }
  return c;
}

/** A reproducible sequence of random strikes: the n-th ray hits this bit. */
export function ray(n: number, total: number, seed = 2024): number {
  const rng = mulberry32(seed);
  let v = 0;
  for (let i = 0; i <= n; i++) v = rng.int(total);
  return v;
}
