/**
 * Multiplexer trees and lookup tables: the logic behind the mux-tree figure and the LUT explorer.
 *
 * A 2^k : 1 multiplexer is a tree of 2:1 multiplexers in k levels. Level 0 holds the data inputs D0…D(2^k − 1)
 * (the leaves); level j has 2^(k−j) two-way multiplexers, each controlled by select input S(j−1) and reading
 * two nodes of the level below, so the first level is controlled by S0, the least significant select bit. The
 * node at level j on the active path is number `sel >> j`. This is how `part:mux4` and `part:mux8` are built.
 *
 * A lookup table is the same tree with constants at the leaves: the k select inputs are the inputs of the
 * function, and leaf D(m) holds the function's value in truth-table row m. Row numbers follow Chapter 11: the
 * first variable, A, is the most significant bit of the row (and so is the highest select input).
 */
import { ONE, ZERO, getVar, quineMcCluskey } from '$lib/pld/twolevel';

export const LUT_NAMES = ['A', 'B', 'C', 'D'];

export const leafCount = (k: number): number => 1 << k;

/** A node of the tree: level 0 are the data inputs, level k the output. */
export interface TreeNode {
  level: number;
  index: number;
}

/** Number of nodes at a level. */
export const nodesAt = (k: number, level: number): number => 1 << (k - level);

/**
 * The value of every node for data inputs `data` and select value `sel`: a node at level j passes on the
 * selected one of its two children. Returns levels[j][i].
 */
export function nodeValues(data: number[], k: number, sel: number): number[][] {
  const levels: number[][] = [data.slice(0, 1 << k)];
  for (let j = 1; j <= k; j++) {
    const below = levels[j - 1]!;
    const bit = (sel >> (j - 1)) & 1;
    levels.push(Array.from({ length: nodesAt(k, j) }, (_, i) => below[2 * i + bit]!));
  }
  return levels;
}

/** The data input that reaches the output: D(sel). */
export function evalMux(data: number[], sel: number): number {
  return data[sel] ?? 0;
}

/** Is node (level, index) on the path from data input `sel` to the output? */
export const onPath = (level: number, index: number, sel: number): boolean => index === sel >> level;

/** Which child of a node on the path is being selected (0 or 1)? */
export const childSelected = (level: number, sel: number): number => (sel >> (level - 1)) & 1;

// ── Lookup tables ──────────────────────────────────────────────────────────────

/** The value of variable v (0 = A, the most significant) in row m of a k-variable table. */
export const bitOf = (m: number, v: number, k: number): number => (m >> (k - 1 - v)) & 1;

/** The inputs A, B, … of row m. */
export const rowInputs = (m: number, k: number): number[] => Array.from({ length: k }, (_, v) => bitOf(m, v, k));

/** The row selected by inputs A, B, … (A first). */
export const rowOf = (inputs: number[]): number => inputs.reduce((m, b) => (m << 1) | (b ? 1 : 0), 0);

/** What a lookup table with configuration `bits` gives for `inputs` (A first). */
export const lutValue = (bits: number[], inputs: number[]): number => bits[rowOf(inputs)] ?? 0;

/** The configuration word, D0 as the least significant bit, as hexadecimal ("0x96"). */
export function hexWord(bits: number[]): string {
  let s = '';
  for (let i = 0; i < bits.length; i += 4) {
    let v = 0;
    for (let j = 0; j < 4 && i + j < bits.length; j++) v |= (bits[i + j]! ? 1 : 0) << j;
    s = v.toString(16).toUpperCase() + s;
  }
  return `0x${s}`;
}

/** The configuration word as a number. */
export const wordOf = (bits: number[]): number => bits.reduce((w, b, i) => w + (b ? 2 ** i : 0), 0);

/** Configuration bits from a word (D0 is the least significant bit). */
export const bitsOf = (word: number, k: number): number[] => Array.from({ length: 1 << k }, (_, i) => Math.floor(word / 2 ** i) % 2);

/** How many different functions of k variables there are. */
export const functionCount = (k: number): number => 2 ** (2 ** k);

export interface LutPreset {
  id: string;
  label: string;
  /** Numbers of inputs it makes sense for. */
  ks: number[];
  /** The function of the inputs (A first). */
  f: (x: number[]) => number;
  note: string;
}

const sum = (x: number[]) => x.reduce((a, b) => a + b, 0);

export const PRESETS: LutPreset[] = [
  { id: 'and', label: 'AND', ks: [2, 3, 4], f: (x) => +(sum(x) === x.length), note: 'Only the last row, all inputs 1, holds a 1.' },
  { id: 'or', label: 'OR', ks: [2, 3, 4], f: (x) => +(sum(x) > 0), note: 'Every row but the first holds a 1.' },
  { id: 'xor', label: 'XOR', ks: [2, 3, 4], f: (x) => sum(x) % 2, note: 'A 1 in every row with an odd number of 1s: the parity of the inputs.' },
  { id: 'nand', label: 'NAND', ks: [2, 3], f: (x) => +(sum(x) !== x.length), note: 'The opposite of AND: every row but the last.' },
  { id: 'majority', label: 'Majority', ks: [3], f: (x) => +(sum(x) >= 2), note: 'The carry out of a full adder: 1 when at least two inputs are 1.' },
  { id: 'select', label: 'A ? B : C', ks: [3], f: (x) => (x[0] ? x[1]! : x[2]!), note: 'A 2:1 multiplexer, drawn as a lookup table: A chooses between B and C.' },
  { id: 'greater', label: 'A > B', ks: [2], f: (x) => +(x[0]! > x[1]!), note: 'Only the row A = 1, B = 0.' },
  { id: 'gt2', label: 'AB > CD', ks: [4], f: (x) => +(x[0]! * 2 + x[1]! > x[2]! * 2 + x[3]!), note: 'A 2-bit comparator: six of the sixteen rows.' },
  { id: 'prime', label: 'Prime', ks: [3, 4], f: (x) => +[2, 3, 5, 7, 11, 13].includes(rowOf(x)), note: 'A 1 in the rows whose number is prime: no formula, just a list.' },
  { id: 'zero', label: 'All zero', ks: [2, 3, 4], f: () => 0, note: 'Constant 0: the table holds no 1s.' },
];

/** Configuration bits of a preset for k inputs. */
export function presetBits(p: LutPreset, k: number): number[] {
  return Array.from({ length: 1 << k }, (_, m) => p.f(rowInputs(m, k)));
}

/** A literal of a product term: variable index (0 = A) and whether it is complemented. */
export interface Lit {
  v: number;
  neg: boolean;
}

/** The smallest sum of products of the function of `bits` (Chapter 12), as terms of literals; [] is constant 0 and [[]] is constant 1. */
export function minimalTerms(bits: number[], k: number): Lit[][] {
  const on = bits.flatMap((b, m) => (b ? [m] : []));
  if (on.length === 0) return [];
  if (on.length === 1 << k) return [[]];
  const q = quineMcCluskey(k, on, []);
  return q.cover.cubes.map((c) => {
    const lits: Lit[] = [];
    for (let v = 0; v < k; v++) {
      const f = getVar(c, v);
      if (f === ONE) lits.push({ v, neg: false });
      else if (f === ZERO) lits.push({ v, neg: true });
    }
    return lits;
  });
}

/** The same as plain text: "A·¬B + C". */
export function termsText(terms: Lit[][], names = LUT_NAMES): string {
  if (terms.length === 0) return '0';
  if (terms.length === 1 && terms[0]!.length === 0) return '1';
  return terms.map((t) => t.map((l) => (l.neg ? '¬' : '') + names[l.v]).join('·')).join(' + ');
}
