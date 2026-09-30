/**
 * Cross-probing state shared by the widgets: which gates are lit and which source ranges are marked, set from
 * the pointer being over source text, a gate, or a row of the cost table.
 */
import { elementsAt, elementsOnLine, spansOfElement, type SpanRange } from '$lib/hdl/lower/probe';
import type { Lowered } from '$lib/hdl/lower';
import type { ConstructInfo } from '$lib/hdl/editor/analysis';

export class Probe {
  /** Elements (component ids of the circuit) to highlight. */
  ids: Set<string> = $state.raw(new Set());
  /** Source ranges to mark. */
  ranges: SpanRange[] = $state.raw([]);

  clear(): void {
    if (this.ids.size) this.ids = new Set();
    if (this.ranges.length) this.ranges = [];
  }

  /** The pointer is over the source: an offset in the text, or a line number (its gutter). */
  fromSource(l: Lowered | undefined, hit: { offset: number; line: number; gutter?: boolean } | null): void {
    if (!l || !hit) return this.clear();
    const r = hit.gutter ? elementsOnLine(l, hit.line) : elementsAt(l, hit.offset, hit.line);
    if (!r.ids.length) return this.clear();
    this.ids = new Set(r.ids);
    this.ranges = r.range ? [r.range] : [];
  }

  /** The pointer is over a part of the drawing: light the whole construct it belongs to, and mark its source. */
  fromElement(l: Lowered | undefined, id: string | null): void {
    if (!l || !id) return this.clear();
    const info = l.elements[id];
    if (!info) return this.clear();
    const ids = info.cell >= 0 ? (l.cells[info.cell] ?? [id]) : [id];
    this.ids = new Set(ids.includes(id) ? ids : [id, ...ids]);
    this.ranges = spansOfElement(l, id);
  }

  /** The pointer is over a row of the cost table. */
  fromConstruct(l: Lowered | undefined, c: ConstructInfo | null): void {
    if (!c) return this.clear();
    const cell = l?.rtl.cells.find((x) => x.src.start === c.from && x.src.end === c.to && x.kind === c.kind);
    this.ids = new Set(cell && l ? (l.cells[cell.id] ?? []) : []);
    this.ranges = [{ from: c.from, to: c.to }];
  }
}
