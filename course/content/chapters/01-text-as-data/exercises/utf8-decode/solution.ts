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
    // Lead byte → number of continuation bytes, initial payload, and the allowed range of the
    // *second* byte (which rules out overlong forms, surrogates and values above U+10FFFF).
    let need: number, cp: number, lo = 0x80, hi = 0xbf;
    if (b0 >= 0xc2 && b0 <= 0xdf) [need, cp] = [1, b0 & 0x1f];
    else if (b0 >= 0xe0 && b0 <= 0xef) {
      [need, cp] = [2, b0 & 0x0f];
      if (b0 === 0xe0) lo = 0xa0;
      if (b0 === 0xed) hi = 0x9f;
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      [need, cp] = [3, b0 & 0x07];
      if (b0 === 0xf0) lo = 0x90;
      if (b0 === 0xf4) hi = 0x8f;
    } else {
      out += '�';
      i += 1;
      continue;
    }
    let k = 1;
    for (; k <= need; k++) {
      const b = bytes[i + k];
      const [min, max] = k === 1 ? [lo, hi] : [0x80, 0xbf];
      if (b === undefined || b < min || b > max) break;
      cp = (cp << 6) | (b & 0x3f);
    }
    if (k <= need) {
      out += '�'; // maximal invalid prefix consumed
      i += k;
    } else {
      out += String.fromCodePoint(cp);
      i += need + 1;
    }
  }
  return out;
}
