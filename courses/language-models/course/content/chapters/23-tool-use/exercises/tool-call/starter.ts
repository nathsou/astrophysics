/**
 * The runtime side of tool use. `text` is what the model has written so far. If it has just completed a
 * calculator call — an open `[` followed by a sum and `=`, as in `…[357+6789=` — return what the tool writes
 * back: the result and the closing bracket (`7146]`). Otherwise return null and let the model continue.
 */
export function toolStep(text: string): string | null {
  // TODO
  return null;
}
