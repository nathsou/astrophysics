import { expect, test } from '@lm/test';
import { bf16Bits, toBf16 } from './solution.ts';

test('values with 8 significant bits are exact', () => {
  for (const x of [0, 1, -2, 0.5, 3, 255, 1 / 1024, -65280]) expect(toBf16(x)).toBe(x);
});

test('the bit pattern is the top half of the float32', () => {
  expect(bf16Bits(1)).toBe(0x3f80);
  expect(bf16Bits(-2)).toBe(0xc000);
  expect(bf16Bits(Infinity)).toBe(0x7f80);
});

test('rounds to the nearest representable value', () => {
  // Between 1 and 2 bfloat16 values are 2⁻⁷ = 0.0078125 apart.
  expect(toBf16(1.003)).toBe(1);
  expect(toBf16(1.005)).toBe(1.0078125);
  expect(toBf16(3.14159265)).toBe(3.140625);
});

test('ties go to the even neighbour', () => {
  expect(toBf16(1 + 2 ** -8)).toBe(1); // halfway between 1 (even) and 1 + 2⁻⁷ (odd)
  expect(toBf16(1 + 3 * 2 ** -8)).toBe(1 + 2 ** -6); // halfway between 1 + 2⁻⁷ (odd) and 1 + 2⁻⁶ (even)
});

test('keeps float32 range: tiny and huge values survive, the largest round up to infinity', () => {
  expect(toBf16(1e-38)).toBeGreaterThan(0);
  expect(toBf16(1e38) / 1e38).toBeCloseTo(1, 2);
  expect(toBf16(3.4028234e38)).toBe(Infinity);
});

test('NaN stays NaN', () => {
  expect(toBf16(NaN)).toBeNaN();
});
