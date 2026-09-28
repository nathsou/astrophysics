// Primitive recursive definitions as objects of study (chapter "Recursive Functions", sections
// "Primitive Recursion" to "Non-Primitive Recursive Functions"): unfolding a primitive recursion
// step by step, the parts of a composition, why a definition is primitive recursive (the clauses
// of the inductive definition, and the stage S_i at which it appears), the book's notations
// Comp_{k,n}[F, G_0, …] and Rec_k[F, G] with a parser, the book's numbering #(F) of notations,
// the hierarchy g_n as primitive recursive definitions, and the enumeration of the unary
// primitive recursive functions used in the diagonal argument.

import { arity, evaluate, R, type RF } from '../recursive/rf.ts';
import { lit, seqOf, type Nat } from '../numbers/nat.ts';
import * as Lib from './library.ts';
import { decodeIndex, indexOf, runUnary, type PhiOutcome } from './indices.ts';

/** Strip named definitions at the top of a term. */
export function unwrap(f: RF): RF {
  while (f.k === 'def') f = f.body;
  return f;
}

function arityOrThrow(f: RF): number {
  const a = arity(f);
  if (!a.ok) throw new Error(a.errors.map((e) => e.message).join('; '));
  return a.arity;
}

// ------------------------------------------------------------------ is it primitive recursive?

export type PrClass =
  | { pr: true; usesBasic: boolean }
  /** uses unbounded search: not a primitive recursive definition (the function may still be one) */
  | { pr: false; reason: 'min'; id: string };

/**
 * Is this a primitive recursive *definition*: built from zero, succ, projections by composition
 * and primitive recursion? The basic functions add, mult and χ= of the representability chapter
 * count (usesBasic is set): they are primitive recursive by the definitions of section
 * "Examples of Primitive Recursive Functions". A definition using μ is not primitive recursive
 * as a definition, even when the function it defines happens to be.
 */
export function classify(f: RF): PrClass {
  let usesBasic = false;
  let bad: string | null = null;
  const go = (g: RF): void => {
    if (bad) return;
    switch (g.k) {
      case 'zero':
      case 'succ':
      case 'proj':
        return;
      case 'basic':
        usesBasic = true;
        return;
      case 'def':
        return go(g.body);
      case 'comp':
        go(g.f);
        g.gs.forEach(go);
        return;
      case 'rec':
        go(g.f);
        go(g.g);
        return;
      case 'min':
        bad = g.id;
        return;
    }
  };
  go(f);
  return bad ? { pr: false, reason: 'min', id: bad } : { pr: true, usesBasic };
}

export const isPrimitiveRecursive = (f: RF) => classify(f).pr;

/**
 * The stage at which a definition first appears in S_0 ⊆ S_1 ⊆ … (section "Primitive Recursion
 * Functions"): 0 for zero, succ and projections, and one more than the latest stage of the parts
 * for a composition or a primitive recursion. (The *function* may appear earlier, with another
 * definition.) Null for definitions using μ or the basic functions of chapter 4.
 */
export function stage(f: RF): number | null {
  switch (f.k) {
    case 'zero':
    case 'succ':
    case 'proj':
      return 0;
    case 'basic':
    case 'min':
      return null;
    case 'def':
      return stage(f.body);
    case 'comp': {
      const ss = [stage(f.f), ...f.gs.map(stage)];
      if (ss.some((s) => s === null)) return null;
      return 1 + Math.max(...(ss as number[]));
    }
    case 'rec': {
      const a = stage(f.f);
      const b = stage(f.g);
      if (a === null || b === null) return null;
      return 1 + Math.max(a, b);
    }
  }
}

/** Number of nodes of the definition with all named definitions unfolded. */
export function size(f: RF): number {
  switch (f.k) {
    case 'def':
      return size(f.body);
    case 'comp':
      return 1 + size(f.f) + f.gs.reduce((s, g) => s + size(g), 0);
    case 'rec':
      return 1 + size(f.f) + size(f.g);
    case 'min':
      return 1 + size(f.f);
    default:
      return 1;
  }
}

/** Count of primitive recursions in the unfolded definition. */
export function recursions(f: RF): number {
  switch (f.k) {
    case 'def':
      return recursions(f.body);
    case 'comp':
      return recursions(f.f) + f.gs.reduce((s, g) => s + recursions(g), 0);
    case 'rec':
      return 1 + recursions(f.f) + recursions(f.g);
    case 'min':
      return recursions(f.f);
    default:
      return 0;
  }
}

// ------------------------------------------------------------------ certificate: the clauses of the definition

export interface Certificate {
  id: string;
  /** clause of the book's inductive definition: 1 zero, 2 succ, 3 projection, 4 composition, 5 primitive recursion; 0 = basic function of chapter 4 */
  clause: 0 | 1 | 2 | 3 | 4 | 5;
  arity: number;
  /** the name, when the node is a named definition */
  name?: { name: string; tex: string };
  node: RF;
  children: Certificate[];
}

/**
 * Why a definition is primitive recursive: at every node, the clause of the inductive
 * definition that applies, with arities (a composition needs a k-place f and k n-place g's; a
 * primitive recursion needs a k-place f, k ≥ 1, and a (k+2)-place g). Returns the problems
 * instead when the definition is ill-formed or uses μ.
 */
export function certificate(f: RF): { ok: true; cert: Certificate } | { ok: false; errors: { id: string; message: string }[] } {
  const a = arity(f);
  if (!a.ok) return { ok: false, errors: a.errors };
  const c = classify(f);
  if (!c.pr) return { ok: false, errors: [{ id: c.id, message: 'unbounded search μ is not one of the clauses of the definition of the primitive recursive functions' }] };
  const go = (g: RF, name?: { name: string; tex: string }): Certificate => {
    if (g.k === 'def') return go(g.body, name ?? { name: g.name, tex: g.tex });
    const ar = arityOrThrow(g);
    const base = { id: g.id, arity: ar, name, node: g };
    switch (g.k) {
      case 'zero':
        return { ...base, clause: 1, children: [] };
      case 'succ':
        return { ...base, clause: 2, children: [] };
      case 'proj':
        return { ...base, clause: 3, children: [] };
      case 'basic':
        return { ...base, clause: 0, children: [] };
      case 'comp':
        return { ...base, clause: 4, children: [go(g.f), ...g.gs.map((h) => go(h))] };
      case 'rec':
        return { ...base, clause: 5, children: [go(g.f), go(g.g)] };
      case 'min':
        throw new Error('unreachable');
    }
  };
  return { ok: true, cert: go(f) };
}

// ------------------------------------------------------------------ unfolding a primitive recursion

export interface RecRow {
  /** the recursion argument of this row */
  y: bigint;
  /** h(x⃗, y), when computed within the budget */
  value?: bigint;
  /** function calls used for this row (evaluating f, or g once) */
  calls: number;
}

export type RecUnfolding =
  | { ok: true; k: number; f: RF; g: RF; xs: bigint[]; rows: RecRow[]; status: 'ok' | 'out-of-fuel'; calls: number }
  | { ok: false; error: string };

/**
 * h(x⃗, 0), h(x⃗, 1), …, h(x⃗, y) for h = Rec(f, g) (possibly under named definitions), computed
 * by the equations of the definition: h(x⃗, 0) = f(x⃗), h(x⃗, j + 1) = g(x⃗, j, h(x⃗, j)). Each row
 * is one evaluation of f or g with the shared budget `fuel` of function calls.
 */
export function unfoldRec(h: RF, xs: readonly bigint[], y: bigint, opt: { fuel?: number } = {}): RecUnfolding {
  const r = unwrap(h);
  if (r.k !== 'rec') return { ok: false, error: 'not defined by primitive recursion' };
  const a = arity(r);
  if (!a.ok) return { ok: false, error: a.errors.map((e) => e.message).join('; ') };
  const k = a.arity - 1;
  if (xs.length !== k) return { ok: false, error: `${k} parameter${k === 1 ? '' : 's'} x⃗ needed` };
  if (y < 0n || xs.some((x) => x < 0n)) return { ok: false, error: 'arguments are natural numbers' };
  let fuel = opt.fuel ?? 100_000;
  let calls = 0;
  const rows: RecRow[] = [];
  const base = evaluate(r.f, [...xs], { fuel, maxTraceDepth: -1 });
  fuel -= base.calls;
  calls += base.calls;
  rows.push({ y: 0n, value: base.value, calls: base.calls });
  if (base.status !== 'ok') return { ok: true, k, f: r.f, g: r.g, xs: [...xs], rows, status: 'out-of-fuel', calls };
  let prev = base.value!;
  for (let j = 0n; j < y; j++) {
    const s = evaluate(r.g, [...xs, j, prev], { fuel, maxTraceDepth: -1 });
    fuel -= s.calls;
    calls += s.calls;
    rows.push({ y: j + 1n, value: s.value, calls: s.calls });
    if (s.status !== 'ok') return { ok: true, k, f: r.f, g: r.g, xs: [...xs], rows, status: 'out-of-fuel', calls };
    prev = s.value!;
  }
  return { ok: true, k, f: r.f, g: r.g, xs: [...xs], rows, status: 'ok', calls };
}

// ------------------------------------------------------------------ the parts of a composition

export interface CompositionParts {
  f: RF;
  gs: RF[];
  /** the values g_i(x⃗), when computed */
  inner: { value?: bigint; calls: number }[];
  /** f(g_0(x⃗), …), when every inner value was computed */
  outer?: { value?: bigint; calls: number };
  status: 'ok' | 'out-of-fuel';
}

/** Evaluates h = Comp(f; g_0, …, g_{k-1}) at x⃗ part by part: first every g_i(x⃗), then f of the results. */
export function compositionParts(h: RF, xs: readonly bigint[], opt: { fuel?: number } = {}): { ok: true; parts: CompositionParts } | { ok: false; error: string } {
  const c = unwrap(h);
  if (c.k !== 'comp') return { ok: false, error: 'not defined by composition' };
  const a = arity(c);
  if (!a.ok) return { ok: false, error: a.errors.map((e) => e.message).join('; ') };
  if (xs.length !== a.arity) return { ok: false, error: `${a.arity} argument${a.arity === 1 ? '' : 's'} needed` };
  let fuel = opt.fuel ?? 100_000;
  const inner: { value?: bigint; calls: number }[] = [];
  for (const g of c.gs) {
    const r = evaluate(g, [...xs], { fuel, maxTraceDepth: -1 });
    fuel -= r.calls;
    inner.push({ value: r.value, calls: r.calls });
    if (r.status !== 'ok') return { ok: true, parts: { f: c.f, gs: c.gs, inner, status: 'out-of-fuel' } };
  }
  const r = evaluate(c.f, inner.map((i) => i.value!), { fuel, maxTraceDepth: -1 });
  return { ok: true, parts: { f: c.f, gs: c.gs, inner, outer: { value: r.value, calls: r.calls }, status: r.status } };
}

// ------------------------------------------------------------------ the book's notations

const TEX_BASIC: Record<string, string> = { add: '\\mathrm{add}', mult: '\\mathrm{mult}', chareq: '\\chi_{=}' };

/**
 * The book's notation (section "Primitive Recursion Notations"): zero, succ, P^n_i,
 * Comp_{k,n}[F, G_0, …, G_{k-1}] and Rec_k[F, G]. Named definitions are unfolded unless
 * `keepNames` is set. Minimization, which the book's notations for primitive recursive
 * functions do not have, is written Min[F].
 */
export function notation(f: RF, opt: { keepNames?: boolean; tex?: boolean } = {}): string {
  const tex = opt.tex ?? false;
  const go = (g: RF): string => {
    switch (g.k) {
      case 'zero':
        return tex ? '\\mathrm{zero}' : 'zero';
      case 'succ':
        return tex ? '\\mathrm{succ}' : 'succ';
      case 'proj':
        return tex ? `P^{${g.n}}_{${g.i}}` : `P^${g.n}_${g.i}`;
      case 'basic':
        return tex ? TEX_BASIC[g.name] : g.name;
      case 'def':
        return opt.keepNames ? (tex ? g.tex : g.name) : go(g.body);
      case 'comp': {
        const k = g.gs.length;
        const n = arity(g.gs[0]);
        const ns = n.ok ? String(n.arity) : '?';
        return tex
          ? `\\mathrm{Comp}_{${k},${ns}}[${[g.f, ...g.gs].map(go).join(', ')}]`
          : `Comp_{${k},${ns}}[${[g.f, ...g.gs].map(go).join(', ')}]`;
      }
      case 'rec': {
        const a = arity(g.f);
        const ks = a.ok ? String(a.arity) : '?';
        return tex ? `\\mathrm{Rec}_{${ks}}[${go(g.f)}, ${go(g.g)}]` : `Rec_${ks}[${go(g.f)}, ${go(g.g)}]`;
      }
      case 'min':
        return tex ? `\\mathrm{Min}[${go(g.f)}]` : `Min[${go(g.f)}]`;
    }
  };
  return go(f);
}

export type ParsedNotation = { ok: true; rf: RF; abbreviations: string[] } | { ok: false; error: string; at: number };

/**
 * Parses the book's notation: zero (or 0, Zero), succ (or S, Succ), P^n_i (braces allowed),
 * Comp_{k,n}[F, G_0, …] and Rec_k[F, G]. The subscripts may be omitted; when they are given
 * they must be right. The names add and mult may be used as abbreviations of the book's
 * definitions; they are reported in `abbreviations`.
 */
export function parseNotation(src: string): ParsedNotation {
  let i = 0;
  const abbreviations: string[] = [];
  class Fail extends Error {
    at: number;
    constructor(message: string, at: number) {
      super(message);
      this.at = at;
    }
  }
  const ws = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };
  const peek = (s: string) => {
    ws();
    return src.startsWith(s, i);
  };
  const expect = (s: string) => {
    ws();
    if (!src.startsWith(s, i)) throw new Fail(`expected “${s}”`, i);
    i += s.length;
  };
  const num = (): number => {
    ws();
    const m = /^\d+/.exec(src.slice(i));
    if (!m) throw new Fail('expected a number', i);
    i += m[0].length;
    return Number(m[0]);
  };
  /** _k, _{k}, _{k,n}, _k,n — returns the numbers given */
  const subscripts = (): number[] => {
    ws();
    if (!peek('_')) return [];
    expect('_');
    if (peek('{')) {
      expect('{');
      const out = [num()];
      while (peek(',')) {
        expect(',');
        out.push(num());
      }
      expect('}');
      return out;
    }
    const out = [num()];
    // Comp_1,3[ … ]: a comma directly followed by a number before the bracket
    ws();
    const m = /^,\s*(\d+)\s*\[/.exec(src.slice(i));
    if (m) {
      expect(',');
      out.push(num());
    }
    return out;
  };
  const word = (): string => {
    ws();
    const m = /^[A-Za-z]+/.exec(src.slice(i));
    if (!m) {
      if (src[i] === '0') {
        i++;
        return 'zero';
      }
      throw new Fail('expected zero, succ, P^n_i, Comp, Rec, add or mult', i);
    }
    i += m[0].length;
    return m[0];
  };
  const term = (): RF => {
    ws();
    const at = i;
    const w = word();
    switch (w) {
      case 'zero':
      case 'Zero':
        return R.zero();
      case 'succ':
      case 'Succ':
      case 'S':
        return R.succ();
      case 'P': {
        let n: number, k: number;
        if (peek('^')) {
          expect('^');
          const braced = peek('{');
          if (braced) expect('{');
          n = num();
          if (braced) expect('}');
          expect('_');
          const b2 = peek('{');
          if (b2) expect('{');
          k = num();
          if (b2) expect('}');
        } else throw new Fail('write a projection as P^n_i', i);
        if (!(n >= 1 && k < n)) throw new Fail(`P^${n}_${k} is not a projection: it needs i < n`, at);
        return R.proj(n, k);
      }
      case 'add':
      case 'mult': {
        abbreviations.push(w);
        return w === 'add' ? Lib.add() : Lib.mult();
      }
      case 'Comp': {
        const sub = subscripts();
        expect('[');
        const parts = [term()];
        while (peek(',')) {
          expect(',');
          parts.push(term());
        }
        expect(']');
        if (parts.length < 2) throw new Fail('Comp needs an outer function and at least one inner function', at);
        const c = R.comp(parts[0], parts.slice(1));
        const a = arity(c);
        if (!a.ok) throw new Fail(a.errors[0].message, at);
        if (sub.length > 0) {
          const k = parts.length - 1;
          if (sub[0] !== k) throw new Fail(`Comp_{${sub.join(',')}}: there are ${k} inner function${k === 1 ? '' : 's'}, so the first subscript should be ${k}`, at);
          if (sub.length > 1 && sub[1] !== a.arity) throw new Fail(`Comp_{${sub.join(',')}}: the inner functions are ${a.arity}-place, so the second subscript should be ${a.arity}`, at);
        }
        return c;
      }
      case 'Rec': {
        const sub = subscripts();
        expect('[');
        const f = term();
        expect(',');
        const g = term();
        expect(']');
        const r = R.rec(f, g);
        const a = arity(r);
        if (!a.ok) throw new Fail(a.errors[0].message, at);
        if (sub.length > 0 && sub[0] !== a.arity - 1) throw new Fail(`Rec_${sub[0]}: the base function is ${a.arity - 1}-place, so the subscript should be ${a.arity - 1}`, at);
        return r;
      }
      default:
        throw new Fail(`unknown symbol “${w}”`, at);
    }
  };
  try {
    const rf = term();
    ws();
    if (i < src.length) throw new Fail('unexpected text after the notation', i);
    return { ok: true, rf, abbreviations };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.message, at: e.at };
    throw e;
  }
}

/**
 * The book's number #(F) of a notation (section "Non-Primitive Recursive Functions"):
 *   #(zero) = ⟨0⟩, #(succ) = ⟨1⟩, #(P^n_i) = ⟨2, n, i⟩,
 *   #(Comp_{k,l}[H, G_0, …, G_{k-1}]) = ⟨3, k, l, #(H), #(G_0), …, #(G_{k-1})⟩,
 *   #(Rec_l[G, H]) = ⟨4, l, #(G), #(H)⟩,
 * as an exact symbolic number (these are far too large to write out). Null for definitions
 * using μ or the basic functions of chapter 4, which have no notation in this numbering.
 */
export function bookCode(f: RF): Nat | null {
  switch (f.k) {
    case 'zero':
      return seqOf([lit(0)]);
    case 'succ':
      return seqOf([lit(1)]);
    case 'proj':
      return seqOf([lit(2), lit(f.n), lit(f.i)]);
    case 'def':
      return bookCode(f.body);
    case 'basic':
    case 'min':
      return null;
    case 'comp': {
      const a = arity(f.gs[0]);
      if (!a.ok) return null;
      const parts = [f.f, ...f.gs].map(bookCode);
      if (parts.some((p) => p === null)) return null;
      return seqOf([lit(3), lit(f.gs.length), lit(a.arity), ...(parts as Nat[])]);
    }
    case 'rec': {
      const a = arity(f.f);
      if (!a.ok) return null;
      const g = bookCode(f.f);
      const h = bookCode(f.g);
      if (!g || !h) return null;
      return seqOf([lit(4), lit(a.arity), g, h]);
    }
  }
}

// ------------------------------------------------------------------ indices, safely

/**
 * log10 of the index of a definition in this edition's bijective coding (indices.ts), estimated
 * with floating point: each nesting roughly doubles the number of digits. Infinity when even the
 * estimate overflows.
 */
export function indexLog10(f: RF): number {
  const l10 = (x: bigint) => (x === 0n ? -Infinity : x.toString().length - 1 + Math.log10(Number(x.toString().slice(0, 15).padEnd(15, '0')) / 1e14));
  const lsum = (a: number, b: number) => (a === -Infinity ? b : b === -Infinity ? a : Math.max(a, b) + Math.log10(1 + 10 ** (Math.min(a, b) - Math.max(a, b))));
  const lJ = (a: number, b: number) => {
    const s = lsum(a, b);
    return s === -Infinity ? -Infinity : 2 * s - Math.log10(2);
  };
  const plus = (a: number, c: number) => lsum(a, Math.log10(c));
  const go = (g: RF): number => {
    switch (g.k) {
      case 'zero':
        return -Infinity;
      case 'succ':
        return 0;
      case 'proj':
        return l10(2n + 4n * ((BigInt(g.n - 1) * BigInt(g.n)) / 2n + BigInt(g.i)));
      case 'def':
        return go(g.body);
      case 'basic':
        return NaN;
      case 'comp': {
        const fs = g.gs.map(go);
        let l = lJ(fs[fs.length - 1], -Infinity);
        for (let j = fs.length - 2; j >= 0; j--) l = lJ(fs[j], plus(l, 1));
        return plus(Math.log10(4) + lJ(go(g.f), l), 3);
      }
      case 'rec':
        return plus(Math.log10(4) + lJ(go(g.f), go(g.g)), 4);
      case 'min':
        return plus(Math.log10(4) + go(g.f), 5);
    }
  };
  return go(f);
}

/** The index of a definition when it has at most `maxDigits` digits; otherwise an estimate of its size. */
export function safeIndex(f: RF, maxDigits = 4000): { ok: true; e: bigint } | { ok: false; log10: number; reason: string } {
  const l = indexLog10(f);
  if (Number.isNaN(l)) return { ok: false, log10: NaN, reason: 'the basic functions of chapter 4 have no index in this coding' };
  if (l > maxDigits) return { ok: false, log10: l, reason: 'too large to write out' };
  return { ok: true, e: indexOf(f) };
}

// ------------------------------------------------------------------ the hierarchy g_n as primitive recursive definitions

/**
 * g_0 = succ, g_{n+1}(x) = g_n^x(x) (section "Non-Primitive Recursive Functions"), officially:
 *   it_n(x, 0) = P^1_0(x) = x,  it_n(x, y + 1) = g_n(P^3_2(x, y, it_n(x, y)))   (so it_n(x, y) = g_n^y(x))
 *   g_{n+1}(x) = it_n(P^1_0(x), P^1_0(x)).
 */
export function gLevel(n: number): RF {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('the level must be a natural number');
  let g: RF = R.def('g_0', 'g_0', R.succ());
  for (let m = 0; m < n; m++) {
    const it = R.def(`it_${m}`, `\\mathit{it}_{${m}}`, R.rec(R.proj(1, 0), R.comp(g, [R.proj(3, 2)])));
    g = R.def(`g_${m + 1}`, `g_{${m + 1}}`, R.comp(it, [R.proj(1, 0), R.proj(1, 0)]));
  }
  return g;
}

// ------------------------------------------------------------------ the enumeration of unary primitive recursive functions

export type PrRow =
  | { e: bigint; kind: 'pr'; rf: RF }
  /** e is not the code of a unary primitive recursive definition: f_e is the constant 0 function */
  | { e: bigint; kind: 'zero-by-convention'; why: string };

/**
 * f_e, the e-th unary primitive recursive function, following the book: the function whose
 * definition has index e if there is one and it is unary and primitive recursive, the constant
 * 0 function otherwise. (Indices are this edition's bijective coding; see indices.ts.)
 */
export function prRow(e: bigint): PrRow {
  const d = decodeIndex(e);
  if (!d.ok) return { e, kind: 'zero-by-convention', why: 'not a well-formed definition' };
  if (d.arity !== 1) return { e, kind: 'zero-by-convention', why: `defines a ${d.arity}-place function` };
  if (!isPrimitiveRecursive(d.rf)) return { e, kind: 'zero-by-convention', why: 'uses μ: not a primitive recursive notation' };
  return { e, kind: 'pr', rf: d.rf };
}

export interface PrDiagonalRow {
  row: PrRow;
  /** f_e(x) for x < cols */
  cells: PhiOutcome[];
  /** f_e(e) */
  diag: PhiOutcome;
  /** h(e) = f_e(e) + 1; 'not within budget' when f_e(e) was not computed (it exists: f_e is total) */
  h: bigint | 'not within budget';
}

const zeroOutcome: PhiOutcome = { kind: 'value', value: 0n, calls: 0 };

/** The rows e = from, …, from + count − 1 of the table f_e(x), and the diagonal h(e) = f_e(e) + 1. */
export function prDiagonal(from: bigint, count: number, cols: number, fuel: number): PrDiagonalRow[] {
  const out: PrDiagonalRow[] = [];
  for (let j = 0; j < count; j++) {
    const e = from + BigInt(j);
    const row = prRow(e);
    const cell = (x: bigint): PhiOutcome => (row.kind === 'pr' ? runUnary(row.rf, x, fuel) : zeroOutcome);
    const cells = Array.from({ length: cols }, (_, x) => cell(BigInt(x)));
    const diag = e < BigInt(cols) ? cells[Number(e)] : cell(e);
    out.push({ row, cells, diag, h: diag.kind === 'value' ? diag.value + 1n : 'not within budget' });
  }
  return out;
}

/** A diagonal over any finite list of unary definitions: h(i) = f_i(i) + 1. */
export function listDiagonal(fs: RF[], cols: number, fuel: number): { cells: PhiOutcome[]; h: bigint | 'not within budget' }[] {
  return fs.map((f, i) => {
    const cells = Array.from({ length: Math.max(cols, fs.length) }, (_, x) => runUnary(f, BigInt(x), fuel));
    const d = cells[i];
    return { cells, h: d.kind === 'value' ? d.value + 1n : 'not within budget' };
  });
}
