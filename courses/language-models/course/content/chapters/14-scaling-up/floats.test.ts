/** The FloatFormats widget's rounding against float32 (Math.fround), the bfloat16 exercise, and known float16 and float8 values. */
import { expect, test } from 'vitest';
import { FORMATS, roundToFormat } from './floats.ts';
import { toBf16, bf16Bits } from './exercises/bf16/solution.ts';

const f = (n: string) => FORMATS.find((x) => x.name === n)!;

test('float32 matches Math.fround', () => {
  for (const x of [0.1, Math.PI, 1e-40, 3e38, 1 / 3, -7.25, 1e-45]) expect(roundToFormat(x, f('float32')).value).toBe(Math.fround(x));
});

test('bfloat16 matches the exercise’s solution, value and bits', () => {
  for (const x of [0.1, Math.PI, 1e-40, 3e38, 1 / 3, -7.25, 1 + 2 ** -8, 1 + 3 * 2 ** -8, 3.3e38]) {
    expect(roundToFormat(x, f('bfloat16')).value).toBe(toBf16(x));
    expect(parseInt(roundToFormat(x, f('bfloat16')).bits, 2)).toBe(bf16Bits(x));
  }
});

test('float16: range limits, subnormals and bit patterns', () => {
  const h = f('float16');
  expect(roundToFormat(65504, h).value).toBe(65504);
  expect(roundToFormat(65520, h).value).toBe(Infinity);
  expect(roundToFormat(65519, h).value).toBe(65504);
  expect(roundToFormat(2 ** -24, h).value).toBe(2 ** -24);
  expect(roundToFormat(2 ** -26, h).value).toBe(0);
  expect(roundToFormat(1, h).bits).toBe('0011110000000000');
  expect(roundToFormat(2 ** -24, h).bits).toBe('0000000000000001');
  expect(roundToFormat(0.1, h).value).toBeCloseTo(0.0999755859375, 12);
});

test('float8 e4m3 has no infinity: 448 is the largest value', () => {
  const g = f('float8 e4m3');
  expect(roundToFormat(448, g).value).toBe(448);
  expect(roundToFormat(500, g).value).toBeNaN();
  expect(roundToFormat(448, g).bits).toBe('01111110');
});
