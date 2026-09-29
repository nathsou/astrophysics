export const SEGMENT_TABLE: readonly number[] = [0x7e, 0x30, 0x6d, 0x79, 0x33, 0x5b, 0x5f, 0x70, 0x7f, 0x7b, 0x77, 0x1f, 0x4e, 0x3d, 0x4f, 0x47];

/** Segment mask (a = bit 0 … g = bit 6) from the levels of outputs a…g. */
export function segmentMask(levels: (0 | 1 | 'z' | undefined)[]): number {
  return levels.reduce<number>((m, v, i) => (v === 1 ? m | (1 << i) : m), 0);
}

/** The mask of a digit (bit 6 of the table is segment a). */
export function digitMask(d: number): number {
  const p = SEGMENT_TABLE[d] ?? 0;
  let m = 0;
  for (let s = 0; s < 7; s++) if ((p >> (6 - s)) & 1) m |= 1 << s;
  return m;
}
