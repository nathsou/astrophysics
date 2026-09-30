import { describe, expect, it } from 'vitest';
import { getVFpga } from '../../pld/devices/vfpga';
import { describeBit, lcOffset } from '../../pld/devices/vfpga-config';
import { bitIndex, bitPosition, countSet, frameOf, frameSegments, segmentAt } from './bitlayout';

describe('bit layout', () => {
  for (const size of ['S', 'M'] as const) {
    const dev = getVFpga(size);
    it(`covers every bit of every frame of ${size} exactly once, in order`, () => {
      dev.frames.forEach((fr, f) => {
        const segs = frameSegments(dev, f);
        expect(segs.length).toBeGreaterThan(0);
        let p = fr.start;
        for (const s of segs) {
          expect(s.start).toBe(p);
          expect(s.end).toBeGreaterThan(s.start);
          p = s.end;
        }
        expect(p).toBe(fr.start + fr.length);
      });
    });

    it(`agrees with describeBit on ${size} for a sample of bits`, () => {
      const cat = { lut: 'lut', flag: 'lc-flag', clock: 'clock', pad: 'pad', ram: 'bram', 'ram-init': 'bram-init', mux: 'mux' } as const;
      for (let i = 0; i < dev.totalBits; i += 97) {
        const s = segmentAt(dev, i)!;
        const d = describeBit(dev, i);
        expect(cat[s.cat], `bit ${i}`).toBe(d.category);
        expect(s.x).toBe(d.tile.x);
        expect(s.y).toBe(d.tile.y);
        if (d.cell !== undefined) expect(s.cell).toBe(d.cell);
      }
    });
  }

  it('finds frames, positions and indices consistently', () => {
    const dev = getVFpga('M');
    for (const i of [0, 1, dev.frames[3]!.start, dev.frames[3]!.start - 1, dev.totalBits - 1]) {
      const { frame, offset } = bitPosition(dev, i);
      expect(frameOf(dev, i)).toBe(frame);
      expect(bitIndex(dev, frame, offset)).toBe(i);
    }
    expect(bitIndex(dev, 0, -1)).toBe(-1);
    expect(bitIndex(dev, 99, 0)).toBe(-1);
    expect(segmentAt(dev, dev.totalBits)).toBeUndefined();
  });

  it('puts a cell’s LUT bits in a lut segment', () => {
    const dev = getVFpga('S');
    const o = lcOffset(dev, 2, 1, 3);
    const s = segmentAt(dev, o + 5)!;
    expect(s).toMatchObject({ cat: 'lut', x: 2, y: 1, cell: 3 });
    expect(segmentAt(dev, o + 17)).toMatchObject({ cat: 'flag', cell: 3 });
    expect(countSet(new Uint8Array([1, 0, 1, 1]), 0, 3)).toBe(2);
  });
});
