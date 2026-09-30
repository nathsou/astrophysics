/**
 * Changing the program of an Octet that has been fitted, without fitting it again.
 *
 * The program is the initial contents of the RAM, and the flow puts those into the configuration bits of the block
 * RAMs, as data: nothing else in the bitstream depends on them. So a new program is a change to those bits and to no
 * others. (The real iCE40 flow has a tool for the same job: `icebram` replaces the contents of the block RAMs in an
 * ASCII bitstream, and `icepack` then writes the file with new checksums.)
 */
import { check, elaborate, type RtlDesign } from '$lib/hdl';
import { BRAM_BITS, BRAM_WIDTHS } from '$lib/pld/devices/vfpga-arch';
import { bramInitOffset, encodeBitstream, getBits, readBram, setBits } from '$lib/pld/devices/vfpga-config';
import type { VFpgaDevice } from '$lib/pld/devices/vfpga';
import { decodeBitstream } from '$lib/pld/fpga/decode';
import type { FpgaResult } from '$lib/studio/fpga/types';
import { OCTET_MEMORY, type OctetProgram } from '$lib/sim/cpu/octet';
import { withProgram } from './octet-dcl';

export interface Patched {
  /** The configuration with the program in every block RAM that the design uses. */
  bits: Uint8Array;
  /** The bitstream file for it: the frames' checksums are computed again. */
  bitstream: Uint8Array;
  /** The block RAMs that were written (`x,y`). */
  rams: string[];
  /** How many configuration bits changed. */
  changed: number;
}

/** The block RAMs of a configuration that the design uses, as `x,y`. */
export function usedRams(device: VFpgaDevice, bits: Uint8Array): string[] {
  return [...decodeBitstream(device, bits).fabric.rams.keys()];
}

/** Write the program into the initial contents of every block RAM in use (a copy: the input is not changed). */
export function patchProgram(device: VFpgaDevice, bits: Uint8Array, image: ArrayLike<number>): Patched {
  const out = bits.slice();
  const rams = usedRams(device, bits);
  for (const key of rams) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    const w = BRAM_WIDTHS[readBram(device, bits, x, y).mode]!;
    // A block RAM is at least as wide as the byte; the fitter picks the mode that wastes least (Octet's are set to 512 × 8).
    if (w < 8) throw new Error(`the RAM at ${key} is ${w} bits wide, and Octet's words are 8`);
    const init = bramInitOffset(device, x, y);
    for (let a = 0; a < BRAM_BITS / w; a++) setBits(out, init + a * w, w, a < OCTET_MEMORY.ramSize ? (image[a] ?? 0) & 0xff : getBits(bits, init + a * w, w));
  }
  let changed = 0;
  for (let i = 0; i < out.length; i++) if (out[i] !== bits[i]) changed++;
  return { bits: out, bitstream: encodeBitstream(device, out), rams, changed };
}

export interface Loaded {
  /** The fit's result with the new configuration (everything else, the placement and the routes, is unchanged). */
  result: FpgaResult;
  /** The design for the RTL simulator that runs beside the device: the same source with the program in its table. */
  design: RtlDesign;
  /** The source with the program in its table. */
  source: string;
  patch: Patched;
}

/** A fitted result with `program` in place of the program it was fitted with. */
export function loadProgram(result: FpgaResult, device: VFpgaDevice, source: string, program: OctetProgram | ArrayLike<number>): Loaded {
  const image = 'image' in program ? program.image : program;
  const patch = patchProgram(device, result.bits, image);
  const next = withProgram(source, image);
  return {
    result: { ...result, bits: patch.bits, bitstream: patch.bitstream },
    design: elaborate(check(next, { file: 'octet.dcl' }).program, 'Octet'),
    source: next,
    patch,
  };
}
