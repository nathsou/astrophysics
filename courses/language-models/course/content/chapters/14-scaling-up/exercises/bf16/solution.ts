/**
 * bfloat16 keeps float32's sign bit and 8 exponent bits but only 7 of its 23 mantissa bits: it is the
 * top half of a float32. Converting means rounding away the bottom 16 bits.
 */
const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

/** The 16-bit pattern of x rounded to the nearest bfloat16 (ties to even). NaN → 0x7FC0. */
export function bf16Bits(x: number): number {
  if (Number.isNaN(x)) return 0x7fc0;
  f32[0] = x; // also rounds x to float32 first
  const bits = u32[0]!;
  // Adding 0x7FFF rounds up exactly when the discarded half exceeds 0x8000; the extra bit from the
  // kept part breaks ties towards an even result. Carries propagate into the exponent.
  return ((bits + 0x7fff + ((bits >>> 16) & 1)) >>> 16) & 0xffff;
}

/** x rounded to the nearest bfloat16, as a number. */
export function toBf16(x: number): number {
  u32[0] = bf16Bits(x) << 16;
  return f32[0]!;
}
