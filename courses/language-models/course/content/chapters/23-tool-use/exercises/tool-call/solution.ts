/**
 * The runtime side of tool use. `text` is what the model has written so far. If it has just completed a
 * calculator call — an open `[` followed by a sum and `=`, as in `…[357+6789=` — return what the tool writes
 * back: the result and the closing bracket (`7146]`). Otherwise return null and let the model continue.
 */
export function toolStep(text: string): string | null {
  const open = text.lastIndexOf('[');
  if (open < 0 || text.indexOf(']', open) >= 0 || !text.endsWith('=')) return null;
  const terms = text.slice(open + 1, -1).split('+');
  if (terms.some((t) => !/^\d+$/.test(t))) return ']'; // a malformed call: close it, with no result
  return `${terms.reduce((a, t) => a + Number(t), 0)}]`;
}
