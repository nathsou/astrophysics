/**
 * Cuts of an AIG: sets of at most k "leaf" nodes that separate a node from the primary inputs, each with the
 * truth table of the node as a function of its leaves. Shared by carry-chain detection (k = 3) and LUT mapping
 * (k = 4).
 *
 * A truth table over m leaves (sorted by node id, leaf i is variable i) has 2^m rows, row r having variable i
 * equal to bit i of r; bit r of the table is the function's value on row r. Tables are kept in 16 bits, so
 * `tt` of a cut with fewer than 4 leaves describes a function that ignores the missing variables only when it
 * is expanded (`expandTt`).
 */

export interface Cut {
  /** Sorted node ids. */
  leaves: number[];
  /** Truth table over `leaves`, in the low 2^leaves.length bits. */
  tt: number;
}

/** Union of two sorted leaf lists if it has at most k elements, else null. */
export function mergeLeaves(a: number[], b: number[], k: number): number[] | null {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    let v: number;
    if (j >= b.length || (i < a.length && a[i]! < b[j]!)) v = a[i++]!;
    else if (i >= a.length || b[j]! < a[i]!) v = b[j++]!;
    else {
      v = a[i]!;
      i++;
      j++;
    }
    if (out.length === k) return null;
    out.push(v);
  }
  return out;
}

/** Truth table of a function over `from` (sorted subset of `to`), re-expressed over the leaves `to`. */
export function expandTt(tt: number, from: number[], to: number[]): number {
  if (from.length === to.length) return tt;
  const pos: number[] = from.map((l) => to.indexOf(l));
  let out = 0;
  const rows = 1 << to.length;
  for (let r = 0; r < rows; r++) {
    let sub = 0;
    for (let j = 0; j < pos.length; j++) sub |= ((r >> pos[j]!) & 1) << j;
    out |= ((tt >> sub) & 1) << r;
  }
  return out;
}

/** Complement of a table over m variables. */
export const notTt = (tt: number, m: number): number => ~tt & ((1 << (1 << m)) - 1) & 0xffff;

/** The table with variable i inverted. */
export function flipVar(tt: number, i: number, m: number): number {
  let out = 0;
  for (let r = 0; r < 1 << m; r++) out |= ((tt >> (r ^ (1 << i))) & 1) << r;
  return out;
}

/** A table over m variables replicated to a full 16-bit table (so unused inputs are don't-cares). */
export function replicate(tt: number, m: number): number {
  let out = tt & ((1 << (1 << m)) - 1);
  for (let w = 1 << m; w < 16; w <<= 1) out |= out << w;
  return out & 0xffff;
}

/** Whether a table over m variables depends on variable i. */
export function dependsOn(tt: number, i: number, m: number): boolean {
  for (let r = 0; r < 1 << m; r++) if (((tt >> r) & 1) !== ((tt >> (r ^ (1 << i))) & 1)) return true;
  return false;
}

/** Merge a fanin cut pair for an AND node with fanin complement flags; returns null if too many leaves. */
export function mergeCuts(x: Cut, cx: number, y: Cut, cy: number, k: number): Cut | null {
  const leaves = mergeLeaves(x.leaves, y.leaves, k);
  if (!leaves) return null;
  const m = leaves.length;
  let a = expandTt(x.tt, x.leaves, leaves);
  let b = expandTt(y.tt, y.leaves, leaves);
  const mask = (1 << (1 << m)) - 1;
  if (cx) a = ~a & mask;
  if (cy) b = ~b & mask;
  return { leaves, tt: a & b & mask };
}

/** Whether `a`'s leaves are a subset of `b`'s (a dominates b). */
export function dominates(a: number[], b: number[]): boolean {
  if (a.length > b.length) return false;
  let j = 0;
  for (let i = 0; i < a.length; i++) {
    while (j < b.length && b[j]! < a[i]!) j++;
    if (j >= b.length || b[j] !== a[i]) return false;
    j++;
  }
  return true;
}
