/**
 * Number systems for Appendix A: parse and format a fixed-width bit pattern in binary, octal,
 * decimal (unsigned and two's complement) and hexadecimal. A "pattern" is the unsigned integer
 * value of the bits, 0 to 2^width − 1; everything else is a view of it.
 */

export const WIDTHS = [4, 8, 16, 32] as const;
export type Width = (typeof WIDTHS)[number];
export type Field = 'bin' | 'oct' | 'dec' | 'sdec' | 'hex';

export const MINUS = '−';

const modulus = (width: number) => 2 ** width;

/** The largest unsigned pattern of a width. */
export const maxPattern = (width: number) => modulus(width) - 1;

/** The signed (two's-complement) value of a pattern. */
export function signedValue(pattern: number, width: number): number {
  return pattern >= modulus(width - 1) ? pattern - modulus(width) : pattern;
}

/** The pattern that represents a signed value, or undefined if it does not fit. */
export function patternOfSigned(value: number, width: number): number | undefined {
  if (!Number.isInteger(value) || value < -modulus(width - 1) || value >= modulus(width - 1)) return undefined;
  return value < 0 ? value + modulus(width) : value;
}

/** Bits, most significant first. */
export function bitsOf(pattern: number, width: number): number[] {
  const out: number[] = [];
  for (let i = width - 1; i >= 0; i--) out.push(Math.floor(pattern / 2 ** i) % 2);
  return out;
}

export function patternOfBits(bits: readonly number[]): number {
  return bits.reduce((acc, b) => acc * 2 + (b ? 1 : 0), 0);
}

export function flipBit(pattern: number, width: number, indexFromLeft: number): number {
  const bits = bitsOf(pattern, width);
  bits[indexFromLeft] = bits[indexFromLeft] ? 0 : 1;
  return patternOfBits(bits);
}

/** Change the width, keeping the value: a signed pattern is sign-extended, or cut to fit. */
export function resize(pattern: number, from: number, to: number, signed: boolean): number {
  if (to >= from) return signed ? (patternOfSigned(signedValue(pattern, from), to) ?? pattern) : pattern;
  return pattern % modulus(to);
}

const groups = (s: string, size: number) => {
  const parts: string[] = [];
  for (let i = s.length; i > 0; i -= size) parts.unshift(s.slice(Math.max(0, i - size), i));
  return parts.join(' ');
};

export function format(pattern: number, field: Field, width: number): string {
  switch (field) {
    case 'bin':
      return groups(pattern.toString(2).padStart(width, '0'), 4);
    case 'oct':
      return pattern.toString(8).padStart(Math.ceil(width / 3), '0');
    case 'hex':
      return pattern.toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0');
    case 'dec':
      return String(pattern);
    case 'sdec': {
      const v = signedValue(pattern, width);
      return v < 0 ? MINUS + String(-v) : String(v);
    }
  }
}

export type Parsed = { ok: true; pattern: number } | { ok: false; message: string };

const DIGITS: Record<'bin' | 'oct' | 'hex', { base: number; re: RegExp; prefix: RegExp; name: string }> = {
  bin: { base: 2, re: /^[01]+$/, prefix: /^0b/i, name: 'binary' },
  oct: { base: 8, re: /^[0-7]+$/, prefix: /^0o/i, name: 'octal' },
  hex: { base: 16, re: /^[0-9a-f]+$/i, prefix: /^0x/i, name: 'hexadecimal' },
};

/** Parse what a reader typed into one field. Spaces and underscores are ignored, as are 0b/0o/0x prefixes. */
export function parseField(text: string, field: Field, width: number): Parsed {
  let t = text.replace(/[\s_]/g, '').replace(/[−–]/g, '-');
  if (t === '') return { ok: false, message: 'Type a number.' };
  if (field === 'dec' || field === 'sdec') {
    if (!/^[+-]?\d+$/.test(t)) return { ok: false, message: 'Decimal digits only.' };
    const v = Number(t);
    if (field === 'dec') {
      if (v < 0) return { ok: false, message: 'Unsigned values are not negative: use the signed field.' };
      if (v > maxPattern(width)) return { ok: false, message: `${v} needs more than ${width} bits (the largest is ${maxPattern(width)}).` };
      return { ok: true, pattern: v };
    }
    const p = patternOfSigned(v, width);
    if (p === undefined) return { ok: false, message: `${width} bits hold ${MINUS}${modulus(width - 1)} to ${modulus(width - 1) - 1}.` };
    return { ok: true, pattern: p };
  }
  const d = DIGITS[field];
  t = t.replace(d.prefix, '');
  if (!d.re.test(t)) return { ok: false, message: `Not a ${d.name} number.` };
  const v = parseInt(t, d.base);
  if (v > maxPattern(width)) return { ok: false, message: `That needs more than ${width} bits.` };
  return { ok: true, pattern: v };
}

/** Two's-complement negation, step by step: invert every bit, then add one. */
export function negate(pattern: number, width: number): { inverted: number; result: number } {
  const inverted = maxPattern(width) - pattern;
  return { inverted, result: (inverted + 1) % modulus(width) };
}

/** Name of a byte as an ASCII character, for the 8-bit view. */
export function asciiName(byte: number): string {
  const CONTROL = ['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI', 'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US'];
  if (byte < 32) return CONTROL[byte]!;
  if (byte === 32) return 'space';
  if (byte < 127) return `'${String.fromCharCode(byte)}'`;
  if (byte === 127) return 'DEL';
  return '(not ASCII)';
}

/** Add two patterns and report the flags Octet's ADD would (chapter 14): carry out and signed overflow. */
export function addWithFlags(a: number, b: number, width: number): { sum: number; carry: boolean; overflow: boolean } {
  const total = a + b;
  const sum = total % modulus(width);
  const carry = total >= modulus(width);
  const sa = signedValue(a, width);
  const sb = signedValue(b, width);
  const overflow = sa + sb !== signedValue(sum, width);
  return { sum, carry, overflow };
}

/** Number of bits needed for an unsigned value (at least one). */
export const bitsNeeded = (n: number) => Math.max(1, Math.ceil(Math.log2(n + 1)));
