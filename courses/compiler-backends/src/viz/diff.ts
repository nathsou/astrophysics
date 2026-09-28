// Line diff between two stage listings, for the playground's "diff with the previous stage".
// Only instructions and labels take part; directives, comments and blank lines pass through unmarked.

import { lineText, type Line } from '../compiler/listing';

const significant = (l: Line) => l.kind === undefined || l.kind === 'instr' || l.kind === 'label';
// Drop trailing comments (`; preds: …` in IR, `# loop depth` in MIR) and normalise spacing.
const norm = (l: Line) => lineText(l).replace(/\s+[;#].*$/, '').trim().replace(/\s+/g, ' ');

export interface LineDiff {
  lines: Line[];
  added: number;
  removed: number;
}

/** `cur` with added lines marked, and removed lines from `prev` inserted (struck through) where they were. */
export function diffLines(prev: Line[], cur: Line[]): LineDiff | null {
  const a = prev.filter(significant).map(norm);
  const bIdx = cur.flatMap((l, i) => (significant(l) ? [i] : []));
  const b = bIdx.map((i) => norm(cur[i]));
  const n = a.length, m = b.length;
  if (n * m > 9_000_000) return null;
  // lcs[i][j] = length of the LCS of a[i..] and b[j..]
  const w = m + 1;
  const lcs = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }
  const prevSig = prev.filter(significant);
  // For each significant line of `cur`: the removed lines that go before it, and whether it is new.
  const before: Line[][] = Array.from({ length: m + 1 }, () => []);
  const isNew = new Array<boolean>(m).fill(false);
  let i = 0, j = 0, added = 0, removed = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { i++; j++; }
    else if (j < m && (i >= n || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) { isNew[j++] = true; added++; }
    else { before[j].push(ghost(prevSig[i++])); removed++; }
  }
  const lines: Line[] = [];
  let k = 0;
  cur.forEach((l, idx) => {
    if (k < m && bIdx[k] === idx) {
      lines.push(...before[k]);
      lines.push(isNew[k] ? { ...l, mark: 'added' } : l);
      k++;
    } else lines.push(l);
  });
  lines.push(...before[m]);
  return { lines, added, removed };
}

/** A removed line: same text, but no keys or tooltips, so hovering it lights up nothing. */
function ghost(l: Line): Line {
  return { toks: l.toks.map((t) => ({ t: t.t, c: t.c })), kind: l.kind, indent: l.indent, mark: 'removed' };
}
