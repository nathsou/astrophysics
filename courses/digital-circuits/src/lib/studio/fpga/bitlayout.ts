/**
 * The configuration memory as the bits view lays it out: one row per frame (a frame is a tile column), each row a
 * run of segments: a tile's clock bits, its logic cells' LUT bits and flags, its pads, its RAM, its multiplexer
 * selects. `segmentAt` finds what a bit belongs to without decoding the whole tile.
 */
import { LCS_PER_TILE, LC_BITS, BRAM_BITS } from '../../pld/devices/vfpga-arch';
import { TILE_BRAM, TILE_IO, TILE_LOGIC, type VFpgaDevice } from '../../pld/devices/vfpga';

export type BitCategory = 'clock' | 'lut' | 'flag' | 'pad' | 'ram' | 'ram-init' | 'mux';

export interface BitSegment {
  start: number;
  /** Exclusive. */
  end: number;
  cat: BitCategory;
  x: number;
  y: number;
  /** Logic cell slot for `lut` and `flag` segments. */
  cell?: number;
}

export const CATEGORY_LABEL: Record<BitCategory, string> = {
  clock: 'clock select',
  lut: 'LUT truth tables',
  flag: 'cell flags (flip-flop, carry, set/reset)',
  pad: 'pads',
  ram: 'block RAM settings',
  'ram-init': 'block RAM contents',
  mux: 'routing multiplexers',
};

const cache = new WeakMap<VFpgaDevice, BitSegment[][]>();

/** The segments of frame `f`, in bit order. */
export function frameSegments(dev: VFpgaDevice, f: number): BitSegment[] {
  let all = cache.get(dev);
  if (!all) cache.set(dev, (all = []));
  const hit = all[f];
  if (hit) return hit;
  const out: BitSegment[] = [];
  const x = f;
  for (let y = 0; y < dev.height; y++) {
    const t = dev.tid(x, y);
    const kind = dev.tileKind[t]!;
    if (kind === 0) continue;
    let p = dev.tileCfgOffset[t]!;
    const end = p + dev.tileCfgBits[t]!;
    const add = (n: number, cat: BitCategory, cell?: number) => {
      if (n <= 0) return;
      out.push({ start: p, end: p + n, cat, x, y, ...(cell === undefined ? {} : { cell }) });
      p += n;
    };
    if (kind === TILE_LOGIC) {
      add(dev.clkBits + 1, 'clock');
      for (let k = 0; k < LCS_PER_TILE; k++) {
        add(16, 'lut', k);
        add(LC_BITS - 16, 'flag', k);
      }
    } else if (kind === TILE_IO) add(2 * dev.spec.padsPerTile, 'pad');
    else if (kind === TILE_BRAM) {
      add(3 + 2 * dev.clkBits, 'ram');
      add(BRAM_BITS, 'ram-init');
    }
    add(end - p, 'mux');
  }
  all[f] = out;
  return out;
}

/** The frame a bit is in. */
export function frameOf(dev: VFpgaDevice, index: number): number {
  let lo = 0;
  let hi = dev.frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (dev.frames[mid]!.start <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The segment a bit belongs to. */
export function segmentAt(dev: VFpgaDevice, index: number): BitSegment | undefined {
  if (index < 0 || index >= dev.totalBits) return undefined;
  const segs = frameSegments(dev, frameOf(dev, index));
  let lo = 0;
  let hi = segs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = segs[mid]!;
    if (index < s.start) hi = mid - 1;
    else if (index >= s.end) lo = mid + 1;
    else return s;
  }
  return undefined;
}

/** Position of a bit in the frame grid. */
export function bitPosition(dev: VFpgaDevice, index: number): { frame: number; offset: number } {
  const frame = frameOf(dev, index);
  return { frame, offset: index - dev.frames[frame]!.start };
}

/** Bit index of (frame, offset), or −1. */
export function bitIndex(dev: VFpgaDevice, frame: number, offset: number): number {
  const f = dev.frames[frame];
  return f && offset >= 0 && offset < f.length ? f.start + offset : -1;
}

/** Summary of a range of bits for an overview cell: how many are set. */
export function countSet(bits: Uint8Array, from: number, to: number): number {
  let n = 0;
  for (let i = from; i < to; i++) n += bits[i]!;
  return n;
}
