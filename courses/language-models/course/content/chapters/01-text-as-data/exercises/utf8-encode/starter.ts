/**
 * Encode a string as UTF-8 bytes — without TextEncoder.
 *
 *   U+0000–U+007F     0xxxxxxx
 *   U+0080–U+07FF     110xxxxx 10xxxxxx
 *   U+0800–U+FFFF     1110xxxx 10xxxxxx 10xxxxxx
 *   U+10000–U+10FFFF  11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
 */
export function utf8Encode(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of text) {
    // for…of iterates code points, so astral characters like 😀 arrive whole.
    const cp = ch.codePointAt(0)!;
    // TODO: push the 1–4 bytes that encode `cp`.
    throw new Error(`TODO: encode ${cp}`);
  }
  return new Uint8Array(bytes);
}
