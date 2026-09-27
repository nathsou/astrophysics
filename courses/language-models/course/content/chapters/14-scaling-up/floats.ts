/**
 * Rounding to small floating-point formats (Chapter 14): IEEE-style binary formats with `e` exponent
 * bits and `m` mantissa bits, subnormals, and round-to-nearest-even.
 */

export interface FloatFormat {
  name: string;
  note: string;
  /** Exponent bits. */
  e: number;
  /** Mantissa (fraction) bits. */
  m: number;
  /** Largest finite value. */
  max: number;
  minNormal: number;
  minSub: number;
  /** Values beyond max become ±∞ (IEEE), or NaN for float8 e4m3, which has no infinities. */
  infinity: boolean;
}

function format(name: string, note: string, e: number, m: number, max?: number, infinity = true): FloatFormat {
  const bias = 2 ** (e - 1) - 1;
  return {
    name,
    note,
    e,
    m,
    max: max ?? (2 - 2 ** -m) * 2 ** bias,
    minNormal: 2 ** (1 - bias),
    minSub: 2 ** (1 - bias - m),
    infinity,
  };
}

export const FORMATS: FloatFormat[] = [
  format('float32', 'the default', 8, 23),
  format('tf32', 'NVIDIA matmul inputs', 8, 10),
  format('bfloat16', 'Google Brain', 8, 7),
  format('float16', 'IEEE half', 5, 10),
  format('float8 e4m3', 'H100 forward pass', 4, 3, 448, false),
  format('float8 e5m2', 'H100 gradients', 5, 2),
];

/** Round half to even, for non-negative x. */
function roundEven(x: number): number {
  const f = Math.floor(x), d = x - f;
  return d > 0.5 || (d === 0.5 && f % 2 === 1) ? f + 1 : f;
}

/** x rounded to the nearest value of format f, and the stored bit pattern (sign, exponent, mantissa). */
export function roundToFormat(x: number, f: FloatFormat): { value: number; bits: string } {
  const bias = 2 ** (f.e - 1) - 1;
  const sign = x < 0 || Object.is(x, -0) ? 1 : 0;
  const a = Math.abs(x);
  const pad = (v: number, n: number) => v.toString(2).padStart(n, '0');
  if (Number.isNaN(x)) return { value: NaN, bits: '0' + '1'.repeat(f.e) + '1'.padEnd(f.m, '0') };
  const emin = 1 - bias;
  const exp = a === 0 ? emin : Math.max(emin, Math.floor(Math.log2(a)));
  const quantum = 2 ** (exp - f.m);
  let r = roundEven(a / quantum) * quantum;
  if (r > f.max || a === Infinity) {
    if (!f.infinity) return { value: NaN, bits: String(sign) + '1'.repeat(f.e + f.m) };
    return { value: sign ? -Infinity : Infinity, bits: String(sign) + '1'.repeat(f.e) + '0'.repeat(f.m) };
  }
  if (r === 0) return { value: sign ? -0 : 0, bits: String(sign) + '0'.repeat(f.e + f.m) };
  const re = Math.floor(Math.log2(r));
  let field: number, mant: number;
  if (re < emin) {
    field = 0;
    mant = r / 2 ** (emin - f.m);
  } else {
    field = re + bias;
    mant = (r / 2 ** re - 1) * 2 ** f.m;
  }
  r = sign ? -r : r;
  return { value: r, bits: String(sign) + pad(field, f.e) + pad(Math.round(mant), f.m) };
}
