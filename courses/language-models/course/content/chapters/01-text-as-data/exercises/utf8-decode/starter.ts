/**
 * Decode UTF-8 bytes into a string — without TextDecoder.
 * Malformed input must not throw: replace each maximal invalid sequence with U+FFFD ('�'),
 * exactly like TextDecoder does.
 */
export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i]!;
    if (b0 < 0x80) {
      out += String.fromCodePoint(b0);
      i += 1;
      continue;
    }
    // TODO: 2-, 3- and 4-byte sequences; invalid lead bytes; truncated or overlong sequences.
    throw new Error(`TODO: decode byte 0x${b0.toString(16)}`);
  }
  return out;
}
