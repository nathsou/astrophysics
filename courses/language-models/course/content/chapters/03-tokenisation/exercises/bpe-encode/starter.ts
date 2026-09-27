/**
 * Encode and decode with a trained list of merges (merge i created token 256 + i).
 *
 * Encoding: start from the UTF-8 bytes, then repeatedly find the adjacent pair with the lowest
 * merge rank and merge all its occurrences. Stop when no adjacent pair is in the merge list.
 * (Applying merges in *training order* is what makes encoding reproduce training.)
 */
export function encode(text: string, merges: [number, number][]): number[] {
  // TODO
  return Array.from(new TextEncoder().encode(text));
}

/** Map each token back to its bytes and decode them as UTF-8. */
export function decode(ids: number[], merges: [number, number][]): string {
  // TODO: build a table id → bytes (0–255 are single bytes; 256 + i = bytes(a) ++ bytes(b)).
  return '';
}
