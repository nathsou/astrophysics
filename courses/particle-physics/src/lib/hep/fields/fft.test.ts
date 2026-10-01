import { describe, expect, test } from 'vitest';
import { fft, fft2 } from './fft.ts';

describe('fft', () => {
  test('a cosine lands in the right bin and the inverse restores the data', () => {
    const n = 64;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 5 * i) / n);
    const orig = Float64Array.from(re);
    fft(re, im);
    expect(re[5]).toBeCloseTo(n / 2, 10);
    expect(re[n - 5]).toBeCloseTo(n / 2, 10);
    expect(Math.abs(re[6]!)).toBeLessThan(1e-9);
    fft(re, im, true);
    for (let i = 0; i < n; i++) expect(re[i]).toBeCloseTo(orig[i]!, 12);
  });
  test('Parseval and the 2D transform of a plane wave', () => {
    const R = 16, C = 32;
    const re = new Float64Array(R * C);
    const im = new Float64Array(R * C);
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const ph = 2 * Math.PI * (3 * r / R + 7 * c / C);
        re[r * C + c] = Math.cos(ph);
        im[r * C + c] = Math.sin(ph);
      }
    fft2(re, im, R, C);
    expect(re[3 * C + 7]).toBeCloseTo(R * C, 8);
    let off = 0;
    for (let i = 0; i < R * C; i++) if (i !== 3 * C + 7) off += re[i]! ** 2 + im[i]! ** 2;
    expect(off).toBeLessThan(1e-12);
  });
});
