/**
 * Source positions. Every token, AST node, typed expression and RTL cell carries a `Span`: the file name,
 * the half-open byte range [start, end) of UTF-16 offsets, and the 1-based line and column of `start`.
 */
export interface Span {
  file: string;
  start: number;
  end: number;
  line: number;
  col: number;
}

/** A source text with a line table, for turning offsets into lines and columns. */
export class SourceFile {
  readonly name: string;
  readonly text: string;
  readonly lineStarts: number[];
  // Plain fields rather than parameter properties: Node's strip-only TypeScript mode (used when the
  // Markdown compiler highlights DCL at build time) cannot load parameter properties.
  constructor(name: string, text: string) {
    this.name = name;
    this.text = text;
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
    this.lineStarts = starts;
  }

  /** 1-based line and column of an offset. */
  position(offset: number): { line: number; col: number } {
    const starts = this.lineStarts;
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: offset - starts[lo]! + 1 };
  }

  span(start: number, end: number): Span {
    const { line, col } = this.position(start);
    return { file: this.name, start, end, line, col };
  }

  /** The text of a 1-based line, without its newline. */
  lineText(line: number): string {
    const s = this.lineStarts[line - 1];
    if (s === undefined) return '';
    const e = this.lineStarts[line];
    let t = this.text.slice(s, e === undefined ? undefined : e - 1);
    if (t.endsWith('\r')) t = t.slice(0, -1);
    return t;
  }
}

/** The smallest span covering both. */
export function joinSpans(a: Span, b: Span): Span {
  if (b.start < a.start) return joinSpans(b, a);
  return { file: a.file, start: a.start, end: Math.max(a.end, b.end), line: a.line, col: a.col };
}

export const NO_SPAN: Span = { file: '<builtin>', start: 0, end: 0, line: 1, col: 1 };
