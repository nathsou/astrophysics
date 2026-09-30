/**
 * riscv-arch-test signatures: the words between `begin_signature` and `end_signature` after a test has run,
 * one per line as eight lower-case hexadecimal digits, most significant first (the reference files are
 * `<test>.reference_output`).
 */
export function formatSignature(words: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < words.length; i++) out += `${(words[i]! >>> 0).toString(16).padStart(8, '0')}\n`;
  return out;
}

/** The words of a signature file. Blank lines are ignored; every other line must be hexadecimal. */
export function parseSignature(text: string): number[] {
  const words: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    if (!/^[0-9a-fA-F]{1,8}$/.test(line)) throw new Error(`not a signature line: ${JSON.stringify(line)}`);
    words.push(parseInt(line, 16) >>> 0);
  }
  return words;
}

/**
 * Where two signatures first differ, or undefined if they are the same. With `padded`, `want` may end with zero words
 * beyond the end of `got`: riscv-arch-test's reference files pad the signature to an alignment boundary.
 */
export function compareSignatures(got: ArrayLike<number>, want: ArrayLike<number>, padded = false): string | undefined {
  let wantLength = want.length;
  if (padded) while (wantLength > got.length && want[wantLength - 1] === 0) wantLength--;
  const n = Math.max(got.length, wantLength);
  for (let i = 0; i < n; i++) {
    const g = i < got.length ? (got[i]! >>> 0).toString(16).padStart(8, '0') : undefined;
    const w = i < wantLength ? (want[i]! >>> 0).toString(16).padStart(8, '0') : undefined;
    if (g !== w) return `word ${i}: got ${g ?? '<missing>'}, expected ${w ?? '<missing>'}${got.length !== wantLength ? ` (${got.length} words against ${wantLength})` : ''}`;
  }
  return undefined;
}
