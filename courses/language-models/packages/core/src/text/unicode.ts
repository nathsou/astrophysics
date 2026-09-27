/**
 * Chapter 1 — Text as data.
 *
 * Reference implementations of the Unicode/UTF-8 plumbing every language model sits on.
 * We implement UTF-8 ourselves (rather than calling TextEncoder) because byte-level
 * tokenisers in Chapter 3 operate directly on these bytes.
 */

/** The Unicode replacement character, emitted for malformed input. */
export const REPLACEMENT = 0xfffd;

/** Split a JS string into Unicode code points (not UTF-16 code units). */
export function codePoints(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const hi = text.charCodeAt(i);
    // A high surrogate followed by a low surrogate encodes one astral code point.
    if (hi >= 0xd800 && hi <= 0xdbff && i + 1 < text.length) {
      const lo = text.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        out.push(0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00));
        i++;
        continue;
      }
    }
    out.push(hi);
  }
  return out;
}

/** Number of bytes UTF-8 needs for a code point: 1 to 4. */
export function utf8Length(cp: number): 1 | 2 | 3 | 4 {
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/** Encode a single code point into `out` starting at `offset`; returns bytes written. */
export function encodeCodePoint(cp: number, out: Uint8Array, offset: number): number {
  // Lone surrogates are not valid scalar values; encode them as U+FFFD like TextEncoder does.
  if (cp >= 0xd800 && cp <= 0xdfff) cp = REPLACEMENT;
  const n = utf8Length(cp);
  if (n === 1) {
    out[offset] = cp;
  } else if (n === 2) {
    out[offset] = 0b1100_0000 | (cp >> 6);
    out[offset + 1] = 0b1000_0000 | (cp & 0b11_1111);
  } else if (n === 3) {
    out[offset] = 0b1110_0000 | (cp >> 12);
    out[offset + 1] = 0b1000_0000 | ((cp >> 6) & 0b11_1111);
    out[offset + 2] = 0b1000_0000 | (cp & 0b11_1111);
  } else {
    out[offset] = 0b1111_0000 | (cp >> 18);
    out[offset + 1] = 0b1000_0000 | ((cp >> 12) & 0b11_1111);
    out[offset + 2] = 0b1000_0000 | ((cp >> 6) & 0b11_1111);
    out[offset + 3] = 0b1000_0000 | (cp & 0b11_1111);
  }
  return n;
}

/** Encode a string as UTF-8 bytes. Equivalent to `new TextEncoder().encode(text)`. */
export function utf8Encode(text: string): Uint8Array {
  const cps = codePoints(text);
  let size = 0;
  for (const cp of cps) size += utf8Length(cp >= 0xd800 && cp <= 0xdfff ? REPLACEMENT : cp);
  const out = new Uint8Array(size);
  let o = 0;
  for (const cp of cps) o += encodeCodePoint(cp, out, o);
  return out;
}

/** One step of decoding: the code point found at `offset` and how many bytes it used. */
export interface DecodeStep {
  codePoint: number;
  length: number;
  valid: boolean;
}

/**
 * Decode one UTF-8 sequence starting at `offset`.
 * Rejects truncated sequences, stray continuation bytes, overlong encodings,
 * surrogates and values above U+10FFFF — each becomes U+FFFD consuming the
 * maximal invalid prefix (the WHATWG "maximal subpart" rule, simplified).
 */
export function decodeStep(bytes: Uint8Array, offset: number): DecodeStep {
  const b0 = bytes[offset]!;
  const bad = (length: number): DecodeStep => ({ codePoint: REPLACEMENT, length, valid: false });
  if (b0 < 0x80) return { codePoint: b0, length: 1, valid: true };

  let need: number;
  let cp: number;
  let min: number;
  if (b0 >= 0xc2 && b0 <= 0xdf) [need, cp, min] = [1, b0 & 0x1f, 0x80];
  else if (b0 >= 0xe0 && b0 <= 0xef) [need, cp, min] = [2, b0 & 0x0f, 0x800];
  else if (b0 >= 0xf0 && b0 <= 0xf4) [need, cp, min] = [3, b0 & 0x07, 0x10000];
  else return bad(1); // continuation byte, overlong lead (C0/C1) or > F4

  for (let k = 1; k <= need; k++) {
    const b = bytes[offset + k];
    if (b === undefined || (b & 0xc0) !== 0x80) return bad(k);
    cp = (cp << 6) | (b & 0x3f);
    // Early rejection of overlong / surrogate / out-of-range 3- and 4-byte forms.
    if (k === 1) {
      if (b0 === 0xe0 && b < 0xa0) return bad(1);
      if (b0 === 0xed && b > 0x9f) return bad(1);
      if (b0 === 0xf0 && b < 0x90) return bad(1);
      if (b0 === 0xf4 && b > 0x8f) return bad(1);
    }
  }
  if (cp < min) return bad(need + 1);
  return { codePoint: cp, length: need + 1, valid: true };
}

/** Decode UTF-8 bytes to a string, replacing malformed sequences with U+FFFD. */
export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const step = decodeStep(bytes, i);
    out += String.fromCodePoint(step.codePoint);
    i += step.length;
  }
  return out;
}

/** UTF-16 code units of a string (what `.length` counts in JavaScript). */
export function utf16Units(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) out.push(text.charCodeAt(i));
  return out;
}

/** User-perceived characters (extended grapheme clusters), via Intl.Segmenter. */
export function graphemes(text: string, locale = 'en'): string[] {
  const seg = new Intl.Segmenter(locale, { granularity: 'grapheme' });
  return Array.from(seg.segment(text), (s) => s.segment);
}

/** Format a code point as U+XXXX. */
export function formatCodePoint(cp: number): string {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}
