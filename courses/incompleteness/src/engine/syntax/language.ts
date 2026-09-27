// The symbols of first-order languages and their codes (Definition "symbol code" in the section
// Coding Symbols).
//
// The book fixes codes for the *official* symbols: the logical symbols, variables v_i, constants
// c_i, n-place function symbols f^n_i and n-place predicate symbols P^n_i. The language of
// arithmetic writes some of these specially. Which official symbol each special symbol is, is a
// convention of this web edition (the book leaves it open):
//
//   0 = c_0      ′ = f^1_0      + = f^2_0      × = f^2_1      < = P^2_0
//
// Variables are displayed x, y, z, u, w for v_0 … v_4, and x₀, y₀, z₀, u₀, w₀, x₁, … for v_5, v_6, …
// Constants other than 0 (used as eigenvariables in derivations) are displayed a, b, c, d for
// c_1 … c_4.

import { encodeSeq } from '../numbers/nat.ts';

export const LOGICAL = ['⊥', '¬', '∨', '∧', '→', '∀', '∃', '=', '(', ')', ','] as const;
export type LogicalName = (typeof LOGICAL)[number];

export type Sym =
  | { k: 'logical'; name: LogicalName }
  | { k: 'var'; index: number }
  | { k: 'const'; index: number }
  | { k: 'fn'; arity: number; index: number }
  | { k: 'pred'; arity: number; index: number };

const LOGICAL_TEX: Record<LogicalName, string> = {
  '⊥': '\\bot', '¬': '\\lnot', '∨': '\\lor', '∧': '\\land', '→': '\\rightarrow', '∀': '\\forall', '∃': '\\exists',
  '=': '=', '(': '(', ')': ')', ',': ',',
};

const LOGICAL_ROLE: Record<LogicalName, string> = {
  '⊥': 'falsity', '¬': 'negation', '∨': 'disjunction', '∧': 'conjunction', '→': 'conditional',
  '∀': 'universal quantifier', '∃': 'existential quantifier', '=': 'identity predicate',
  '(': 'left parenthesis', ')': 'right parenthesis', ',': 'comma',
};

const VAR_LETTERS = ['x', 'y', 'z', 'u', 'w'];
const CONST_LETTERS = ['a', 'b', 'c', 'd'];
export const GENERIC_FN = ['f', 'g', 'h'];
export const GENERIC_PRED = ['P', 'Q', 'R', 'S'];
/** Generic function and predicate letters are official symbols with index GENERIC_OFFSET + position. */
export const GENERIC_OFFSET = 10;

export function varName(index: number): string {
  if (index < 5) return VAR_LETTERS[index];
  const k = Math.floor((index - 5) / 5);
  return `${VAR_LETTERS[(index - 5) % 5]}_${k}`;
}

export function varTex(index: number): string {
  if (index < 5) return VAR_LETTERS[index];
  const k = Math.floor((index - 5) / 5);
  return `${VAR_LETTERS[(index - 5) % 5]}_{${k}}`;
}

/** The index of a variable written x, y, z, u, w, x_0, …, or v_i / v17. */
export function varIndex(name: string): number | null {
  const m = /^([xyzuw])(?:_?\{?(\d+)\}?)?$/.exec(name);
  if (m) {
    const pos = VAR_LETTERS.indexOf(m[1]);
    return m[2] === undefined ? pos : 5 + 5 * Number(m[2]) + pos;
  }
  const vm = /^v_?\{?(\d+)\}?$/.exec(name);
  return vm ? Number(vm[1]) : null;
}

export function constName(index: number): string {
  if (index === 0) return '0';
  if (index <= CONST_LETTERS.length) return CONST_LETTERS[index - 1];
  return `c_${index}`;
}

export function constTex(index: number): string {
  if (index === 0) return '0';
  if (index <= CONST_LETTERS.length) return CONST_LETTERS[index - 1];
  return `c_{${index}}`;
}

export function constIndex(name: string): number | null {
  if (name === '0') return 0;
  const i = CONST_LETTERS.indexOf(name);
  if (i >= 0) return i + 1;
  const m = /^c_?\{?(\d+)\}?$/.exec(name);
  return m ? Number(m[1]) : null;
}

export function fnName(arity: number, index: number): string {
  if (arity === 1 && index === 0) return '′';
  if (arity === 2 && index === 0) return '+';
  if (arity === 2 && index === 1) return '×';
  const g = index - GENERIC_OFFSET;
  if (g >= 0 && g < GENERIC_FN.length) return GENERIC_FN[g];
  return `f^${arity}_${index}`;
}

export function fnTex(arity: number, index: number): string {
  if (arity === 1 && index === 0) return '{}^{\\prime}';
  if (arity === 2 && index === 0) return '+';
  if (arity === 2 && index === 1) return '\\times';
  const g = index - GENERIC_OFFSET;
  if (g >= 0 && g < GENERIC_FN.length) return GENERIC_FN[g];
  return `f^{${arity}}_{${index}}`;
}

export function predName(arity: number, index: number): string {
  if (arity === 2 && index === 0) return '<';
  const g = index - GENERIC_OFFSET;
  if (g >= 0 && g < GENERIC_PRED.length) return GENERIC_PRED[g];
  return `P^${arity}_${index}`;
}

export function predTex(arity: number, index: number): string {
  if (arity === 2 && index === 0) return '<';
  const g = index - GENERIC_OFFSET;
  if (g >= 0 && g < GENERIC_PRED.length) return GENERIC_PRED[g];
  return `P^{${arity}}_{${index}}`;
}

// ------------------------------------------------------------------ codes

/** The sequence whose code is the symbol code c_s (Definition in Coding Symbols). */
export function symbolCodeSeq(s: Sym): number[] {
  switch (s.k) {
    case 'logical':
      return [0, LOGICAL.indexOf(s.name)];
    case 'var':
      return [1, s.index];
    case 'const':
      return [2, s.index];
    case 'fn':
      return [3, s.arity, s.index];
    case 'pred':
      return [4, s.arity, s.index];
  }
}

export function symbolCode(s: Sym): bigint {
  return encodeSeq(symbolCodeSeq(s).map(BigInt));
}

export function symEqual(a: Sym, b: Sym): boolean {
  return symbolCodeSeq(a).join(',') === symbolCodeSeq(b).join(',');
}

/** Recovers a symbol from its code sequence, or explains why there is none. */
export function symbolFromCodeSeq(seq: readonly bigint[]): Sym | { error: string } {
  const [kind, a, b] = seq.map(Number);
  if (seq.some((x) => x > BigInt(Number.MAX_SAFE_INTEGER))) return { error: 'component too large for a symbol code' };
  if (kind === 0 && seq.length === 2 && a < LOGICAL.length) return { k: 'logical', name: LOGICAL[a] };
  if (kind === 1 && seq.length === 2) return { k: 'var', index: a };
  if (kind === 2 && seq.length === 2) return { k: 'const', index: a };
  if (kind === 3 && seq.length === 3 && a >= 1) return { k: 'fn', arity: a, index: b };
  if (kind === 4 && seq.length === 3 && a >= 1) return { k: 'pred', arity: a, index: b };
  return { error: `⟨${seq.join(', ')}⟩ is not the code sequence of any symbol` };
}

export function symTex(s: Sym): string {
  switch (s.k) {
    case 'logical':
      return LOGICAL_TEX[s.name];
    case 'var':
      return varTex(s.index);
    case 'const':
      return constTex(s.index);
    case 'fn':
      return s.arity === 1 && s.index === 0 ? '\\prime' : fnTex(s.arity, s.index);
    case 'pred':
      return predTex(s.arity, s.index);
  }
}

/** The official name of the symbol, e.g. v_3, c_0, f^2_1. */
export function officialTex(s: Sym): string {
  switch (s.k) {
    case 'logical':
      return LOGICAL_TEX[s.name];
    case 'var':
      return `v_{${s.index}}`;
    case 'const':
      return `c_{${s.index}}`;
    case 'fn':
      return `f^{${s.arity}}_{${s.index}}`;
    case 'pred':
      return `P^{${s.arity}}_{${s.index}}`;
  }
}

/** A sentence describing the symbol, for inspectors. */
export function describeSym(s: Sym): string {
  switch (s.k) {
    case 'logical':
      return `the ${LOGICAL_ROLE[s.name]} (a logical symbol)`;
    case 'var':
      return `the variable v${sub(s.index)}, written ${varName(s.index)}`;
    case 'const':
      return s.index === 0 ? 'the constant symbol 0 of arithmetic, officially c₀' : `the constant symbol c${sub(s.index)}, written ${constName(s.index)}`;
    case 'fn': {
      const special = s.arity === 1 && s.index === 0 ? 'the successor symbol ′, ' : s.arity === 2 && s.index === 0 ? 'the addition symbol +, ' : s.arity === 2 && s.index === 1 ? 'the multiplication symbol ×, ' : '';
      return `${special}the ${s.arity}-place function symbol f${sup(s.arity)}${sub(s.index)}`;
    }
    case 'pred': {
      const special = s.arity === 2 && s.index === 0 ? 'the less-than symbol <, ' : '';
      return `${special}the ${s.arity}-place predicate symbol P${sup(s.arity)}${sub(s.index)}`;
    }
  }
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sub = (n: number) => String(n).replace(/\d/g, (d) => SUB[Number(d)]);
export const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[Number(d)]);
