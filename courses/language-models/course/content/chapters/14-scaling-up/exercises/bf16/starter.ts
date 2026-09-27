/**
 * bfloat16 keeps float32's sign bit and 8 exponent bits but only 7 of its 23 mantissa bits: it is the
 * top half of a float32. Converting means rounding away the bottom 16 bits.
 */

/** The 16-bit pattern of x rounded to the nearest bfloat16 (ties to even). NaN → 0x7FC0. */
export function bf16Bits(x: number): number {
  // TODO
  return 0;
}

/** x rounded to the nearest bfloat16, as a number. */
export function toBf16(x: number): number {
  // TODO: put bf16Bits(x) in the top half of a float32
  return x;
}
