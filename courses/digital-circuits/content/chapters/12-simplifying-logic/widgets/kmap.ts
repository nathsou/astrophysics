/**
 * Karnaugh maps: the geometry of the map (Gray-code axes, which cell is which minterm), groups (a legal
 * group is a rectangle of 1, 2, 4, 8 or 16 cells that may wrap round the edges, and is exactly a product
 * term), and what a set of groups means: the expression, the circuit, the cost and how it compares with the
 * minimum that Quine–McCluskey finds.
 *
 * Cells are 0, 1 or 2 (don't care). A group is stored as its cube pattern, one character per variable:
 * '1' the variable, '0' its complement, '-' the variable does not appear. `mode` chooses what the groups
 * cover: 'sop' groups the 1s (a sum of products), 'pos' groups the 0s and gives a product of sums.
 */
import { quineMcCluskey } from '$lib/pld/twolevel';
import { twoLevelDag, type Lit, type Token } from '../../11-boolean-algebra/widgets/synth';
import type { Dag } from '../../11-boolean-algebra/widgets/layout';

export type CellValue = 0 | 1 | 2;
export type Mode = 'sop' | 'pos';
export const NAMES = ['A', 'B', 'C', 'D'];

export interface Shape {
  n: number;
  rowVars: number;
  colVars: number;
  rows: number;
  cols: number;
  /** The row / column axes in Gray-code order: the value of the row (column) variables in each position. */
  rowGray: number[];
  colGray: number[];
}

/** Gray code of k bits (k ≤ 2 here): neighbours, and the last and the first, differ in one bit. */
export function gray(k: number): number[] {
  if (k === 0) return [0];
  if (k === 1) return [0, 1];
  if (k === 2) return [0, 1, 3, 2];
  throw new Error('Karnaugh maps here have at most four variables');
}

export function shapeOf(n: number): Shape {
  if (n < 2 || n > 4) throw new Error('2 to 4 variables');
  const rowVars = n >> 1;
  const colVars = n - rowVars;
  return { n, rowVars, colVars, rows: 2 ** rowVars, cols: 2 ** colVars, rowGray: gray(rowVars), colGray: gray(colVars) };
}

/** The minterm number of the cell in row r, column c (variable A is the most significant bit). */
export function mintermAt(s: Shape, r: number, c: number): number {
  return (s.rowGray[r]! << s.colVars) | s.colGray[c]!;
}

export function cellOf(s: Shape, m: number): { r: number; c: number } {
  const rowBits = m >> s.colVars;
  const colBits = m & (s.cols - 1);
  return { r: s.rowGray.indexOf(rowBits), c: s.colGray.indexOf(colBits) };
}

const bits = (v: number, k: number) => (k === 0 ? '' : v.toString(2).padStart(k, '0'));
export const rowLabel = (s: Shape, r: number) => bits(s.rowGray[r]!, s.rowVars);
export const colLabel = (s: Shape, c: number) => bits(s.colGray[c]!, s.colVars);

const popcount = (x: number) => x.toString(2).replace(/0/g, '').length;
const isPow2 = (x: number) => x > 0 && (x & (x - 1)) === 0;

// ---------------------------------------------------------------------------------------------
// Groups

export interface Span {
  /** First index (0 ≤ first < size) and number of cells, running cyclically. */
  first: number;
  len: number;
}

/**
 * The cells a drag covers along one axis. `from` and `to` are positions counted without wrapping: a drag past the
 * right edge goes to position `size`, which is column 0 again. The span runs from the smaller to the larger.
 */
export function spanOf(from: number, to: number, size: number): Span {
  const lo = Math.min(from, to);
  const len = Math.min(size, Math.abs(to - from) + 1);
  return { first: ((lo % size) + size) % size, len };
}

export type GroupResult = { ok: true; pattern: string } | { ok: false; why: string };

/** The product term of a rectangle of cells, or why it is not a legal group. */
export function groupFromSpans(s: Shape, rowSpan: Span, colSpan: Span): GroupResult {
  const cells = rowSpan.len * colSpan.len;
  if (!isPow2(rowSpan.len) || !isPow2(colSpan.len)) {
    return { ok: false, why: `That rectangle has ${cells} cell${cells === 1 ? '' : 's'} (${rowSpan.len} × ${colSpan.len}). Groups are 1, 2, 4, 8 or 16 cells, and each side must be 1, 2 or 4 cells long.` };
  }
  let and = (1 << s.n) - 1;
  let or = 0;
  for (let i = 0; i < rowSpan.len; i++)
    for (let j = 0; j < colSpan.len; j++) {
      const m = mintermAt(s, (rowSpan.first + i) % s.rows, (colSpan.first + j) % s.cols);
      and &= m;
      or |= m;
    }
  const varying = and ^ or;
  if (2 ** popcount(varying) !== cells) return { ok: false, why: 'Those cells do not all differ from each other in the same few variables.' };
  let pattern = '';
  for (let v = 0; v < s.n; v++) {
    const b = 1 << (s.n - 1 - v);
    pattern += varying & b ? '-' : and & b ? '1' : '0';
  }
  return { ok: true, pattern };
}

/** Minterms of a pattern, ascending. */
export function mintermsOf(pattern: string): number[] {
  let ms = [0];
  const n = pattern.length;
  for (let v = 0; v < n; v++) {
    const b = 1 << (n - 1 - v);
    const ch = pattern[v];
    ms = ch === '1' ? ms.map((m) => m | b) : ch === '-' ? ms.flatMap((m) => [m, m | b]) : ms;
  }
  return ms.sort((a, b) => a - b);
}

export const literalsIn = (pattern: string) => [...pattern].filter((c) => c !== '-').length;

/** A rectangle of the drawing (in cells) with the sides that are open because the group wraps round the edge. */
export interface Piece {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
  openTop: boolean;
  openBottom: boolean;
  openLeft: boolean;
  openRight: boolean;
}

function runsOf(set: number[], size: number): { a: number; b: number; openStart: boolean; openEnd: boolean }[] {
  const has = new Set(set);
  if (has.size === size) return [{ a: 0, b: size - 1, openStart: false, openEnd: false }];
  const start = set.find((x) => !has.has((x - 1 + size) % size))!;
  const len = has.size;
  if (start + len <= size) return [{ a: start, b: start + len - 1, openStart: false, openEnd: false }];
  return [
    { a: start, b: size - 1, openStart: false, openEnd: true },
    { a: 0, b: start + len - 1 - size, openStart: true, openEnd: false },
  ];
}

/** The rectangles to draw for a group: one, or two or four where it wraps round an edge. */
export function piecesOf(s: Shape, pattern: string): Piece[] {
  const cells = mintermsOf(pattern).map((m) => cellOf(s, m));
  const rows = [...new Set(cells.map((x) => x.r))].sort((a, b) => a - b);
  const cols = [...new Set(cells.map((x) => x.c))].sort((a, b) => a - b);
  const out: Piece[] = [];
  for (const rr of runsOf(rows, s.rows))
    for (const cc of runsOf(cols, s.cols)) out.push({ r0: rr.a, r1: rr.b, c0: cc.a, c1: cc.b, openTop: rr.openStart, openBottom: rr.openEnd, openLeft: cc.openStart, openRight: cc.openEnd });
  return out;
}

// ---------------------------------------------------------------------------------------------
// What the groups mean

/** The value a group must not contain: a 0 for a sum of products, a 1 for a product of sums. */
export const forbidden = (mode: Mode): CellValue => (mode === 'sop' ? 0 : 1);
export const target = (mode: Mode): CellValue => (mode === 'sop' ? 1 : 0);

/** Why a group is not allowed for these cells, or undefined if it is. */
export function groupProblem(s: Shape, cells: CellValue[], pattern: string, mode: Mode): string | undefined {
  const bad = mintermsOf(pattern).filter((m) => cells[m] === forbidden(mode));
  if (bad.length) {
    const kind = mode === 'sop' ? '0' : '1';
    return `That group contains ${bad.length === 1 ? 'a' : bad.length} ${kind}${bad.length === 1 ? '' : 's'}${bad.length === 1 ? ` (in the cell of minterm ${bad[0]})` : ''}. A group may hold only ${mode === 'sop' ? '1s and don’t-cares' : '0s and don’t-cares'}.`;
  }
  return undefined;
}

export interface Cost {
  terms: number;
  literals: number;
}
export const costOf = (patterns: string[]): Cost => ({ terms: patterns.length, literals: patterns.reduce((sum, p) => sum + literalsIn(p), 0) });

export interface Minimum {
  patterns: string[];
  cost: Cost;
  /** All prime implicants that cover at least one required cell. */
  primes: string[];
  /** Primes that are essential. */
  essential: string[];
  exact: boolean;
}

/** The smallest cover of the target cells (Quine–McCluskey), for the given mode. */
export function minimum(s: Shape, cells: CellValue[], mode: Mode): Minimum {
  const want = target(mode);
  const on = cells.flatMap((v, m) => (v === want ? [m] : []));
  const dc = cells.flatMap((v, m) => (v === 2 ? [m] : []));
  if (on.length === 0) return { patterns: [], cost: { terms: 0, literals: 0 }, primes: [], essential: [], exact: true };
  const q = quineMcCluskey(s.n, on, dc, { traceLimit: 0 });
  const t = q.trace;
  const pat = (id: number) => t.implicants[id]!.pattern;
  return {
    patterns: t.solution.map(pat),
    cost: costOf(t.solution.map(pat)),
    primes: t.primes.filter((id) => !t.implicants[id]!.onlyDontCares).map(pat),
    essential: t.essential.map(pat),
    exact: q.exact,
  };
}

export interface Status {
  /** Required cells (the target value) that no group covers. */
  uncovered: number[];
  /** Cells whose realised value is wrong: the function gives the opposite of what the map says. */
  wrong: number[];
  /** Groups that could be dropped: everything they cover is covered by others. */
  redundant: string[];
  /** Groups that are not as big as they could be (contained in a larger legal group). */
  growable: string[];
  cost: Cost;
  complete: boolean;
}

export function status(s: Shape, cells: CellValue[], patterns: string[], mode: Mode, primes: string[]): Status {
  const want = target(mode);
  const covered = new Map<number, number>();
  for (const p of patterns) for (const m of mintermsOf(p)) covered.set(m, (covered.get(m) ?? 0) + 1);
  const uncovered = cells.flatMap((v, m) => (v === want && !covered.has(m) ? [m] : []));
  const wrong = cells.flatMap((v, m) => (v === forbidden(mode) && covered.has(m) ? [m] : []));
  const redundant = patterns.filter((p) => mintermsOf(p).every((m) => cells[m] !== want || (covered.get(m) ?? 0) > 1) && mintermsOf(p).some((m) => cells[m] === want));
  const growable = patterns.filter((p) => !primes.includes(p) && groupProblem(s, cells, p, mode) === undefined);
  return { uncovered, wrong, redundant, growable, cost: costOf(patterns), complete: uncovered.length === 0 && wrong.length === 0 };
}

/** Compare the reader's cover with the minimum: fewer terms first, then fewer literals. */
export function compareCost(a: Cost, b: Cost): number {
  return a.terms - b.terms || a.literals - b.literals;
}

// ---------------------------------------------------------------------------------------------
// Expressions and circuits

/** The literals of each group: for a sum of products the variable when the pattern says 1; for a product of sums, the complement. */
export function termsOf(patterns: string[], mode: Mode): Lit[][] {
  return patterns.map((p) => {
    const lits: Lit[] = [];
    [...p].forEach((ch, v) => {
      if (ch === '1') lits.push({ v, neg: mode === 'pos' });
      else if (ch === '0') lits.push({ v, neg: mode === 'sop' });
    });
    return lits;
  });
}

export function tokensOf(patterns: string[], mode: Mode, names = NAMES): Token[] {
  if (patterns.length === 0) return [{ t: 'op', text: mode === 'sop' ? '0' : '1' }];
  const terms = termsOf(patterns, mode);
  const out: Token[] = [];
  terms.forEach((term, i) => {
    if (i > 0) out.push({ t: 'op', text: mode === 'sop' ? ' + ' : ' ' });
    const wrap = mode === 'pos' && terms.length > 1 && term.length > 1;
    if (term.length === 0) out.push({ t: 'op', text: mode === 'sop' ? '1' : '0' });
    if (wrap) out.push({ t: 'op', text: '(' });
    term.forEach((l, j) => {
      if (j > 0) out.push({ t: 'op', text: mode === 'sop' ? '·' : ' + ' });
      out.push({ t: 'lit', name: names[l.v]!, neg: l.neg });
    });
    if (wrap) out.push({ t: 'op', text: ')' });
  });
  return out;
}

export function textOf(patterns: string[], mode: Mode, names = NAMES): string {
  return tokensOf(patterns, mode, names)
    .map((t) => (t.t === 'op' ? t.text : (t.neg ? '¬' : '') + t.name))
    .join('');
}

/** The two-level gate network of a cover: AND–OR for a sum of products, OR–AND for a product of sums. */
export function dagOf(n: number, patterns: string[], mode: Mode, names = NAMES): Dag {
  const terms = termsOf(patterns, mode);
  // A product of sums covers the zeros, so an empty cover is the constant 1; a sum of products, the constant 0.
  return twoLevelDag(n, names, terms, mode === 'sop' ? 'or' : 'and');
}

/** The function a cover realises, as an output for each row. */
export function realised(n: number, patterns: string[], mode: Mode): number[] {
  const covered = new Set(patterns.flatMap(mintermsOf));
  return Array.from({ length: 2 ** n }, (_, m) => (mode === 'sop' ? +covered.has(m) : +!covered.has(m)));
}

// ---------------------------------------------------------------------------------------------
// Examples

export interface Example {
  id: string;
  label: string;
  n: number;
  on: number[];
  dc: number[];
  note: string;
}

export const EXAMPLES: Example[] = [
  { id: 'majority', label: 'Majority', n: 3, on: [3, 5, 6, 7], dc: [], note: 'The carry out of a full adder: three groups of two, AB + AC + BC.' },
  { id: 'corners', label: 'Four corners', n: 4, on: [0, 2, 8, 10], dc: [], note: 'The four corners are neighbours once the map wraps round: one group of four, ¬B·¬D.' },
  { id: 'seg-a', label: '7-segment a', n: 4, on: [0, 2, 3, 5, 6, 7, 8, 9], dc: [10, 11, 12, 13, 14, 15], note: 'Segment a of a 7-segment display for the digits 0–9 (A is the 8s bit). Codes 10–15 never occur: they are don’t-cares, and the groups may use them.' },
  { id: 'xor', label: 'XOR', n: 2, on: [1, 2], dc: [], note: 'The two 1s are diagonal, so neither can be grouped: XOR is as bad as a function gets.' },
  { id: 'cyclic', label: 'No essential group', n: 3, on: [0, 1, 2, 5, 6, 7], dc: [], note: 'Every 1 can be covered in two ways, so no group is forced: a cyclic function, solved by choosing (Petrick’s method in Quine–McCluskey). Three groups suffice, in two ways.' },
  { id: 'ge', label: 'A ≥ B (2-bit)', n: 4, on: [0, 4, 5, 8, 9, 10, 12, 13, 14, 15], dc: [], note: 'A = AB and B = CD as two-bit numbers. Five groups, of which two are essential.' },
];

export function cellsOfExample(e: Example): CellValue[] {
  return Array.from({ length: 2 ** e.n }, (_, m) => (e.on.includes(m) ? 1 : e.dc.includes(m) ? 2 : 0));
}

// ---------------------------------------------------------------------------------------------
// Drawing

/**
 * The outline of a rounded rectangle, leaving out the sides that are open (where a wrapping group continues
 * on the other side of the map). Corners between two drawn sides are rounded with radius r.
 */
export function outlinePath(x: number, y: number, w: number, h: number, r: number, open: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean } = {}): string {
  const rr = Math.min(r, w / 2, h / 2);
  const x1 = x + w;
  const y1 = y + h;
  // Each side, its corners (start, end), and whether the neighbours on both ends are drawn (then the end is rounded).
  const top = !open.top;
  const right = !open.right;
  const bottom = !open.bottom;
  const left = !open.left;
  const d: string[] = [];
  const f = (v: number) => String(Math.round(v * 100) / 100);
  if (top) {
    d.push(`M${f(left ? x + rr : x)} ${f(y)} H${f(right ? x1 - rr : x1)}`);
    if (right) d.push(`A${f(rr)} ${f(rr)} 0 0 1 ${f(x1)} ${f(y + rr)}`);
  }
  if (right) {
    if (!top) d.push(`M${f(x1)} ${f(y)}`);
    d.push(`V${f(bottom ? y1 - rr : y1)}`);
    if (bottom) d.push(`A${f(rr)} ${f(rr)} 0 0 1 ${f(x1 - rr)} ${f(y1)}`);
  }
  if (bottom) {
    if (!right) d.push(`M${f(x1)} ${f(y1)}`);
    d.push(`H${f(left ? x + rr : x)}`);
    if (left) d.push(`A${f(rr)} ${f(rr)} 0 0 1 ${f(x)} ${f(y1 - rr)}`);
  }
  if (left) {
    if (!bottom) d.push(`M${f(x)} ${f(y1)}`);
    d.push(`V${f(top ? y + rr : y)}`);
    if (top) d.push(`A${f(rr)} ${f(rr)} 0 0 1 ${f(x + rr)} ${f(y)}`);
  }
  return d.join(' ');
}
