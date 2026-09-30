/** Fenced code blocks of a Markdown text, for the appendix's tests. */
export interface Block {
  meta: string;
  code: string;
  line: number;
  /** Offsets of the code (without the fence lines) in the text. */
  start: number;
  end: number;
}

export function fencedBlocks(text: string, lang: string): Block[] {
  const blocks: Block[] = [];
  const re = /^```(\w+)([^\n]*)\n([\s\S]*?)\n```$/gm;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[1] === lang) {
      const start = m.index + m[0].indexOf('\n') + 1;
      blocks.push({ meta: m[2]!.trim(), code: m[3]! + '\n', line: text.slice(0, m.index).split('\n').length, start, end: start + m[3]!.length });
    }
  }
  return blocks;
}

/**
 * The rows of a table (without its header and separator): the `nth` table after the first line equal to
 * `heading`, and before the next heading of the same or a higher level.
 */
export function tableAfter(text: string, heading: string, nth = 0): string[][] {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.trim() === heading);
  if (at < 0) throw new Error(`no heading "${heading}"`);
  const level = /^#+/.exec(heading)![0].length;
  let i = at + 1;
  let seen = -1;
  for (; i < lines.length; i++) {
    const h = /^(#+) /.exec(lines[i]!);
    if (h && h[1]!.length <= level) break;
    if (lines[i]!.startsWith('|') && (i === 0 || !lines[i - 1]!.startsWith('|'))) {
      if (++seen === nth) break;
    }
  }
  if (seen !== nth || i >= lines.length || !lines[i]!.startsWith('|')) throw new Error(`no table ${nth} under "${heading}"`);
  const rows: string[][] = [];
  for (; i < lines.length && lines[i]!.startsWith('|'); i++) {
    const cells = lines[i]!
      .trim()
      .replace(/^\||\|$/g, '')
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replace(/\\\|/g, '|'));
    rows.push(cells);
  }
  return rows.slice(2);
}

/** The first `code span` of a table cell. */
export const firstCode = (cell: string): string => {
  const m = /`([^`]+)`/.exec(cell);
  if (!m) throw new Error(`no code in "${cell}"`);
  return m[1]!;
};
