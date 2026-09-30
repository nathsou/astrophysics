import { describe, expect, test } from 'vitest';
import { fromBits, shift, stages, toBits, type ShiftMode } from './shift';

describe('shifts', () => {
  test('left shift multiplies by 2^k modulo 256', () => {
    for (let x = 0; x < 256; x++) for (let k = 0; k < 8; k++) expect(shift(x, k, 'lsl')).toBe((x << k) & 255);
  });
  test('logical right shift divides an unsigned number, rounding down', () => {
    for (let x = 0; x < 256; x++) for (let k = 0; k < 8; k++) expect(shift(x, k, 'lsr')).toBe(x >> k);
  });
  test('arithmetic right shift divides a signed number, rounding towards minus infinity', () => {
    for (let x = 0; x < 256; x++)
      for (let k = 0; k < 8; k++) {
        const signed = x >= 128 ? x - 256 : x;
        const want = Math.floor(signed / 2 ** k);
        const got = shift(x, k, 'asr');
        expect(got >= 128 ? got - 256 : got, `${x} >>> ${k}`).toBe(want);
      }
    expect(shift(0b11110000, 2, 'asr')).toBe(0b11111100);
    expect(shift(0b10000001, 1, 'asr')).toBe(0b11000000);
    // −1 stays −1 whatever the shift, and −5 >> 1 is −3 (towards −∞), not −2.
    expect(shift(0xff, 5, 'asr')).toBe(0xff);
    expect(shift(0xfb, 1, 'asr')).toBe(0xfd);
  });
  test('rotate left', () => {
    expect(shift(0b10010110, 3, 'rol')).toBe(0b10110100);
    expect(shift(0b10010110, 8, 'rol')).toBe(0b10010110);
  });
});

describe('the barrel shifter’s stages', () => {
  test('after the last stage the word is the shifted word, for every mode, word and amount', () => {
    for (const mode of ['lsl', 'lsr', 'asr', 'rol'] as ShiftMode[])
      for (let x = 0; x < 256; x += 3)
        for (let k = 0; k < 8; k++) {
          const st = stages(x, k, mode);
          expect(st).toHaveLength(3);
          expect(fromBits(st[2]!.bits), `${mode} ${x} ${k}`).toBe(shift(x, k, mode));
          expect(st.map((s) => s.enabled)).toEqual([!!(k & 1), !!(k & 2), !!(k & 4)]);
        }
  });
  test('a disabled stage passes the word through', () => {
    const st = stages(0b10110001, 4, 'lsl');
    expect(st[0]!.bits).toEqual(toBits(0b10110001));
    expect(st[1]!.bits).toEqual(toBits(0b10110001));
    expect(fromBits(st[2]!.bits)).toBe(0b00010000);
  });
});
