import { describe, expect, test, vi } from 'vitest';
import { frameOf } from '$lib/studio/fpga/bitlayout';
import { census, device, loaderVerdict, ray, reference, strike } from './upset';

vi.setConfig({ testTimeout: 120_000 });

describe('a cosmic ray in the XOR design (Figure 28.6)', () => {
  const dev = device();
  const bits = reference();

  test('the device has 1,772 configuration bits in 4 frames, and the design sets 19 of them', () => {
    expect(dev.totalBits).toBe(1772);
    expect(dev.frames).toHaveLength(4);
    expect(bits.reduce((a, b) => a + b, 0)).toBe(19);
  });

  test('a flipped bit in an unused tile does nothing', () => {
    const s = strike(bits, 1700);
    expect(s.harmless).toBe(true);
    expect(s.check.ok).toBe(true);
  });

  test('flipping a bit of the XOR table changes the function, and the text says which row', () => {
    const lut = [...bits.keys()].find((i) => {
      const d = strike(bits, i);
      return d.what.category === 'lut' && !d.harmless;
    })!;
    const s = strike(bits, lut);
    expect(s.harmless).toBe(false);
    expect(s.what.text).toMatch(/^LUT bit \d+ of logic cell/);
  });

  test('census: 42 of the 1,772 bits break the design: 16 LUT bits, 22 routing selects, 3 pad bits and 1 cell flag', () => {
    const c = census(bits, dev);
    expect(c.total).toBe(1772);
    expect(c.critical).toHaveLength(42);
    const by = Object.fromEntries(c.byCategory.map((r) => [r.category, [r.bits, r.critical]]));
    expect(by.lut).toEqual([512, 16]);
    expect(by.mux).toEqual([928, 22]);
    expect(by['lc-flag']![1]).toBe(1);
    expect(by.pad![1]).toBe(3);
    expect(by.clock![1]).toBe(0);
    expect(c.byCategory.reduce((a, r) => a + r.bits, 0)).toBe(1772);
    expect(((100 * 42) / 1772).toFixed(1)).toBe('2.4');
  });

  test('all 16 bits of the LUT matter, although only two of its inputs are wired', () => {
    // The unwired inputs float, so the tool repeats the table (0x6666): a single flipped bit makes the output unknown for one input pair.
    const c = census(bits, dev);
    const lutBits = c.critical.filter((i) => strike(bits, i).what.category === 'lut');
    expect(lutBits).toHaveLength(16);
  });

  test('a flip in the file is caught by the frame CRC; the loader names the frame', () => {
    for (const i of [3, 1700, 1771]) expect(loaderVerdict(bits, i)).toBe(`frame ${frameOf(dev, i)} is corrupt (CRC mismatch)`);
    expect(frameOf(dev, 3)).toBe(0);
  });

  test('random rays are reproducible', () => {
    expect(ray(0, 1772)).toBe(ray(0, 1772));
    expect(ray(3, 1772)).not.toBe(ray(4, 1772));
    for (let i = 0; i < 20; i++) expect(ray(i, 1772)).toBeLessThan(1772);
  });
});
