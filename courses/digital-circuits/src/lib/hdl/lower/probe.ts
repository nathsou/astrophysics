/**
 * Cross-probing between source text and gates: from an offset (or a line) to the elements built for the
 * expression there, and from an element back to its source spans.
 */
import type { Span } from '../span';
import type { Lowered } from './types';

export interface SpanRange {
  from: number;
  to: number;
}

/** The spans of the cells an element implements: the one that built it, and those that reuse it. */
export function spansOfElement(l: Lowered, id: string): SpanRange[] {
  const info = l.elements[id];
  if (!info) return [];
  const out: SpanRange[] = [];
  const add = (s: Span | undefined) => {
    if (s && s.end > s.start && !out.some((o) => o.from === s.start && o.to === s.end)) out.push({ from: s.start, to: s.end });
  };
  add(info.src);
  for (const c of info.shared ?? []) add(l.rtl.cells.find((x) => x.id === c)?.src);
  return out;
}

/**
 * The elements of the innermost expression around an offset: the smallest source span that contains it and
 * has elements of its own. Returns the span too, so the editor can mark it. Falls back to the cells that
 * start on the same line, so that hovering a keyword or a name still lights something.
 */
export function elementsAt(l: Lowered, offset: number, line?: number): { ids: string[]; range: SpanRange | undefined } {
  let best: { size: number; from: number; to: number; ids: string[] } | undefined;
  for (const c of l.rtl.cells) {
    const s = c.src;
    if (!s || offset < s.start || offset > s.end || s.end <= s.start) continue;
    const ids = l.cells[c.id] ?? [];
    if (!ids.length) continue;
    const size = s.end - s.start;
    if (!best || size < best.size) best = { size, from: s.start, to: s.end, ids: [...ids] };
    else if (size === best.size && s.start === best.from) for (const id of ids) if (!best.ids.includes(id)) best.ids.push(id);
  }
  if (best) return { ids: best.ids, range: { from: best.from, to: best.to } };
  return line === undefined ? { ids: [], range: undefined } : elementsOnLine(l, line);
}

/** Every element built for a cell that starts on this (1-based) line. */
export function elementsOnLine(l: Lowered, line: number): { ids: string[]; range: SpanRange | undefined } {
  const ids: string[] = [];
  let from = Infinity;
  let to = -Infinity;
  for (const c of l.rtl.cells) {
    const s = c.src;
    if (!s || s.line !== line || s.end <= s.start) continue;
    for (const id of l.cells[c.id] ?? []) if (!ids.includes(id)) ids.push(id);
    if ((l.cells[c.id] ?? []).length) {
      from = Math.min(from, s.start);
      to = Math.max(to, s.end);
    }
  }
  return { ids, range: ids.length ? { from, to } : undefined };
}
