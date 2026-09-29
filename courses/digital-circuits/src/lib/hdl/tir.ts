/**
 * The typed intermediate representation produced by the checker: types, typed expressions (`TExpr`) and
 * their bit-exact semantics on BigInt values, used for constant folding, `match` coverage and test benches.
 *
 * Every hardware value is a bit vector. Aggregates are laid out as vectors too:
 * - arrays: element 0 in the least significant bits;
 * - structs: the concatenation of the fields in declaration order (the first field is most significant);
 * - enums: their encoding (binary by default, `@onehot`, `@gray`).
 * Signed values are stored as their two's-complement bit pattern, like unsigned ones.
 */
import type { Span } from './span';

export type Type =
  | { k: 'bits'; w: number; signed: boolean }
  | { k: 'clock' }
  | { k: 'array'; elem: Type; n: number }
  | { k: 'struct'; name: string; fields: { name: string; type: Type }[] }
  | { k: 'enum'; name: string; variants: string[]; codes: bigint[]; w: number; encoding: string }
  /** A compile-time integer (generics, constants, loop variables, untyped literals). */
  | { k: 'int' }
  /** A hardware expression built only from untyped literals: its width comes from context. */
  | { k: 'lit' }
  /** The type of an expression that already has an error; compatible with everything. */
  | { k: 'error' };

export const BIT: Type = { k: 'bits', w: 1, signed: false };
export const INT: Type = { k: 'int' };
export const LIT: Type = { k: 'lit' };
export const ERROR: Type = { k: 'error' };
export const CLOCK: Type = { k: 'clock' };
export const bits = (w: number, signed = false): Type => ({ k: 'bits', w, signed });

export function widthOf(t: Type): number {
  switch (t.k) {
    case 'bits':
      return t.w;
    case 'array':
      return t.n * widthOf(t.elem);
    case 'struct':
      return t.fields.reduce((s, f) => s + widthOf(f.type), 0);
    case 'enum':
      return t.w;
    case 'clock':
      return 1;
    default:
      return 0;
  }
}

export function typeToString(t: Type): string {
  switch (t.k) {
    case 'bits':
      return t.signed ? `signed<${t.w}>` : t.w === 1 ? 'bit' : `bits<${t.w}>`;
    case 'clock':
      return 'clock';
    case 'array':
      return `[${typeToString(t.elem)}; ${t.n}]`;
    case 'struct':
    case 'enum':
      return t.name;
    case 'int':
      return 'int';
    case 'lit':
      return 'an untyped literal';
    case 'error':
      return '{error}';
  }
}

export function typeEq(a: Type, b: Type): boolean {
  if (a.k === 'error' || b.k === 'error') return true;
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'bits':
      return b.k === 'bits' && a.w === b.w && a.signed === b.signed;
    case 'array':
      return b.k === 'array' && a.n === b.n && typeEq(a.elem, b.elem);
    case 'struct':
    case 'enum':
      return a.name === (b as { name: string }).name;
    default:
      return true;
  }
}

export const isBits = (t: Type): t is Extract<Type, { k: 'bits' }> => t.k === 'bits';
export const isBit = (t: Type): boolean => t.k === 'bits' && t.w === 1 && !t.signed;
export const isUntyped = (t: Type): boolean => t.k === 'int' || t.k === 'lit';

export function mask(w: number): bigint {
  return (1n << BigInt(w)) - 1n;
}
export function toSigned(v: bigint, w: number): bigint {
  return v & (1n << BigInt(w - 1)) ? v - (1n << BigInt(w)) : v;
}
/** ⌈log₂ n⌉, at least 1: the width of an index into n elements. */
export function indexWidth(n: number): number {
  let w = 0;
  while (2 ** w < n) w++;
  return Math.max(1, w);
}
export function clog2(n: bigint): bigint {
  let w = 0n;
  while (1n << w < n) w++;
  return w;
}
/** Bits needed to write a non-negative value. */
export function bitsNeeded(v: bigint): number {
  let w = 1;
  while (v >> BigInt(w) > 0n) w++;
  return w;
}

// ------------------------------------------------------------------------------------ typed expressions

export type BinOp =
  | 'add' | 'sub' | 'mul' | 'and' | 'or' | 'xor' | 'shl' | 'shr'
  | 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge';
export type UnOp = 'not' | 'neg';

export type RefKind = 'input' | 'let' | 'reg' | 'instout' | 'testvar' | 'simport';

/**
 * A typed, elaborated expression. Generic parameters, constants and loop variables have been substituted,
 * `fn` calls inlined and `for` loops unrolled, so every node denotes one piece of hardware.
 * Nodes can be shared (a DAG), for example the arguments of an inlined function.
 */
export type TExpr = { t: Type; span: Span } & (
  | { k: 'const'; v: bigint }
  /** A named signal. For `instout`, `name` is `inst.port`; for `simport`, `sim.port`. */
  | { k: 'ref'; ref: RefKind; name: string }
  | { k: 'un'; op: UnOp; a: TExpr }
  | { k: 'bin'; op: BinOp; a: TExpr; b: TExpr }
  /** `if c { a } else { b }` */
  | { k: 'mux'; c: TExpr; a: TExpr; b: TExpr }
  /** A parallel multiplexer: the arm whose values contain `sel`, else `dflt`. */
  | { k: 'match'; sel: TExpr; arms: { values: bigint[]; body: TExpr }[]; dflt?: TExpr }
  /** Bits [lo, lo + width(t)) of `a` (bit slices, struct fields, truncation). */
  | { k: 'slice'; a: TExpr; lo: number }
  /** Constant element `i` of an array. */
  | { k: 'elem'; a: TExpr; i: number }
  /** Dynamic element of an array (`i` has type bits<⌈log₂ n⌉>); out-of-range reads give 0. */
  | { k: 'index'; a: TExpr; i: TExpr }
  /** Dynamic bit of a bit vector. */
  | { k: 'bitidx'; a: TExpr; i: TExpr }
  /** Concatenation; the first part is the most significant. */
  | { k: 'concat'; parts: TExpr[] }
  | { k: 'repeat'; a: TExpr; n: number }
  /** Zero or sign extension to width(t). */
  | { k: 'ext'; a: TExpr; signed: boolean }
  | { k: 'reduce'; op: 'and' | 'or' | 'xor'; a: TExpr }
  | { k: 'popcount'; a: TExpr }
  | { k: 'reverse'; a: TExpr }
  /** Array literal (element 0 first). */
  | { k: 'array'; elems: TExpr[] }
  /** Struct literal, fields in declaration order. */
  | { k: 'struct'; fields: TExpr[] }
  /** Reinterpretation between types of the same width (`signed(x)`, `bits(x)`). */
  | { k: 'cast'; a: TExpr }
  /** Read port `port` of memory `mem`: the data at `addr` one cycle later. */
  | { k: 'memread'; mem: string; port: number; addr: TExpr }
  /** Tests only: a random value of type t. */
  | { k: 'random' }
  /** Tests only: a run-time integer converted to a hardware type (checked to fit). */
  | { k: 'intcast'; a: TExpr }
);

export type TExprOf<K extends TExpr['k']> = Extract<TExpr, { k: K }>;

export function isConst(e: TExpr): e is TExprOf<'const'> {
  return e.k === 'const';
}

// ----------------------------------------------------------------------------------------- semantics

export interface EvalEnv {
  ref(e: TExprOf<'ref'>): bigint;
  memread?(e: TExprOf<'memread'>): bigint;
  random?(t: Type): bigint;
}

export class EvalError extends Error {
  constructor(
    message: string,
    readonly span: Span,
  ) {
    super(message);
  }
}

/** Normalises an integer to the bit pattern of type t (int values are left alone). */
export function wrap(v: bigint, t: Type): bigint {
  if (t.k === 'int' || t.k === 'lit' || t.k === 'error') return v;
  return v & mask(widthOf(t));
}

function signedOf(t: Type): boolean {
  return t.k === 'bits' && t.signed;
}

/** Evaluates a binary operator on bit patterns of operand type `t` (or unbounded integers for `int`). */
export function evalBin(op: BinOp, a: bigint, b: bigint, t: Type, bt?: Type): bigint {
  const isInt = t.k === 'int' || t.k === 'lit';
  const w = isInt ? 0 : widthOf(t);
  const s = signedOf(t);
  const sa = isInt ? a : s ? toSigned(a, w) : a;
  const sb = isInt ? b : s ? toSigned(b, w) : b;
  const r = (v: bigint) => (isInt ? v : v & mask(w));
  switch (op) {
    case 'add':
      return r(a + b);
    case 'sub':
      return r(a - b);
    case 'mul':
      return r(a * b);
    case 'and':
      return r(a & b);
    case 'or':
      return r(a | b);
    case 'xor':
      return r(a ^ b);
    case 'shl':
      if (isInt) return a << b;
      return b >= BigInt(w) ? 0n : r(a << b);
    case 'shr': {
      void bt;
      if (isInt) return a >> b;
      if (s) return r(sa >> (b >= BigInt(w) ? BigInt(w) : b));
      return b >= BigInt(w) ? 0n : a >> b;
    }
    case 'eq':
      return a === b ? 1n : 0n;
    case 'ne':
      return a !== b ? 1n : 0n;
    case 'lt':
      return sa < sb ? 1n : 0n;
    case 'le':
      return sa <= sb ? 1n : 0n;
    case 'gt':
      return sa > sb ? 1n : 0n;
    case 'ge':
      return sa >= sb ? 1n : 0n;
  }
}

/** Evaluates a typed expression on BigInt values. */
export function evalTExpr(e: TExpr, env: EvalEnv, memo = new Map<TExpr, bigint>()): bigint {
  const cached = memo.get(e);
  if (cached !== undefined) return cached;
  const v = evalNode(e, env, memo);
  memo.set(e, v);
  return v;
}

function evalNode(e: TExpr, env: EvalEnv, memo: Map<TExpr, bigint>): bigint {
  const ev = (x: TExpr) => evalTExpr(x, env, memo);
  switch (e.k) {
    case 'const':
      return e.v;
    case 'ref':
      return env.ref(e);
    case 'un': {
      const a = ev(e.a);
      if (e.t.k === 'int') return e.op === 'neg' ? -a : ~a;
      return e.op === 'not' ? ~a & mask(widthOf(e.t)) : -a & mask(widthOf(e.t));
    }
    case 'bin':
      return evalBin(e.op, ev(e.a), ev(e.b), e.a.t, e.b.t);
    case 'mux':
      return ev(e.c) ? ev(e.a) : ev(e.b);
    case 'match': {
      const s = ev(e.sel);
      for (const arm of e.arms) if (arm.values.includes(s)) return ev(arm.body);
      return e.dflt ? ev(e.dflt) : 0n;
    }
    case 'slice':
      return (ev(e.a) >> BigInt(e.lo)) & mask(widthOf(e.t));
    case 'elem': {
      const w = widthOf(e.t);
      return (ev(e.a) >> BigInt(e.i * w)) & mask(w);
    }
    case 'index': {
      const n = e.a.t.k === 'array' ? e.a.t.n : 0;
      const i = ev(e.i);
      if (i >= BigInt(n)) return 0n;
      const w = widthOf(e.t);
      return (ev(e.a) >> (i * BigInt(w))) & mask(w);
    }
    case 'bitidx': {
      const i = ev(e.i);
      if (i >= BigInt(widthOf(e.a.t))) return 0n;
      return (ev(e.a) >> i) & 1n;
    }
    case 'concat': {
      let v = 0n;
      for (const p of e.parts) v = (v << BigInt(widthOf(p.t))) | ev(p);
      return v;
    }
    case 'repeat': {
      const a = ev(e.a);
      const w = BigInt(widthOf(e.a.t));
      let v = 0n;
      for (let i = 0; i < e.n; i++) v = (v << w) | a;
      return v;
    }
    case 'ext': {
      const a = ev(e.a);
      const wa = widthOf(e.a.t);
      if (!e.signed) return a;
      return toSigned(a, wa) & mask(widthOf(e.t));
    }
    case 'reduce': {
      const a = ev(e.a);
      const w = widthOf(e.a.t);
      if (e.op === 'and') return a === mask(w) ? 1n : 0n;
      if (e.op === 'or') return a !== 0n ? 1n : 0n;
      return BigInt(popcount(a) & 1);
    }
    case 'popcount':
      return BigInt(popcount(ev(e.a)));
    case 'reverse': {
      const a = ev(e.a);
      const w = widthOf(e.t);
      let v = 0n;
      for (let i = 0; i < w; i++) if ((a >> BigInt(i)) & 1n) v |= 1n << BigInt(w - 1 - i);
      return v;
    }
    case 'array': {
      let v = 0n;
      for (let i = e.elems.length - 1; i >= 0; i--) v = (v << BigInt(widthOf(e.elems[i]!.t))) | ev(e.elems[i]!);
      return v;
    }
    case 'struct': {
      let v = 0n;
      for (const f of e.fields) v = (v << BigInt(widthOf(f.t))) | ev(f);
      return v;
    }
    case 'cast':
      return ev(e.a);
    case 'memread':
      if (!env.memread) throw new EvalError('memory reads cannot be evaluated here', e.span);
      return env.memread(e);
    case 'random':
      if (!env.random) throw new EvalError('random values exist only in tests', e.span);
      return env.random(e.t);
    case 'intcast': {
      const a = ev(e.a);
      const w = widthOf(e.t);
      const signed = signedOf(e.t);
      const lo = signed ? -(1n << BigInt(w - 1)) : 0n;
      const hi = 1n << BigInt(w);
      if (a < lo || a >= hi) throw new EvalError(`value ${a} does not fit ${typeToString(e.t)}`, e.span);
      return a & mask(w);
    }
  }
}

function popcount(v: bigint): number {
  let n = 0;
  while (v > 0n) {
    if (v & 1n) n++;
    v >>= 1n;
  }
  return n;
}

const NO_ENV: EvalEnv = {
  ref() {
    throw new Error('not constant');
  },
};

/** Whether a node's children are all constants (and the node itself can be folded). */
function foldable(e: TExpr): boolean {
  switch (e.k) {
    case 'const':
    case 'ref':
    case 'memread':
    case 'random':
    case 'intcast':
      return false;
    case 'un':
    case 'slice':
    case 'elem':
    case 'repeat':
    case 'ext':
    case 'reduce':
    case 'popcount':
    case 'reverse':
    case 'cast':
      return e.a.k === 'const';
    case 'bin':
      return e.a.k === 'const' && e.b.k === 'const';
    case 'mux':
      return e.c.k === 'const' && e.a.k === 'const' && e.b.k === 'const';
    case 'match':
      return e.sel.k === 'const' && e.arms.every((a) => a.body.k === 'const') && (!e.dflt || e.dflt.k === 'const');
    case 'index':
    case 'bitidx':
      return e.a.k === 'const' && e.i.k === 'const';
    case 'concat':
      return e.parts.every((p) => p.k === 'const');
    case 'array':
      return e.elems.every((p) => p.k === 'const');
    case 'struct':
      return e.fields.every((p) => p.k === 'const');
  }
}

/** Folds a node whose operands are constants into a `const` node (keeping its type and span). */
export function fold(e: TExpr): TExpr {
  if (e.t.k === 'error' || !foldable(e)) {
    // A mux with a constant condition selects a branch even if the branches are not constant.
    if (e.k === 'mux' && e.c.k === 'const') return e.c.v ? e.a : e.b;
    return e;
  }
  return { k: 'const', v: evalTExpr(e, NO_ENV), t: e.t, span: e.span };
}

/** Visits every node of a DAG once. */
export function walkTExpr(root: TExpr, visit: (e: TExpr) => void, seen = new Set<TExpr>()): void {
  const stack = [root];
  while (stack.length) {
    const e = stack.pop()!;
    if (seen.has(e)) continue;
    seen.add(e);
    visit(e);
    for (const c of children(e)) stack.push(c);
  }
}

export function children(e: TExpr): TExpr[] {
  switch (e.k) {
    case 'const':
    case 'ref':
    case 'random':
      return [];
    case 'un':
    case 'slice':
    case 'elem':
    case 'repeat':
    case 'ext':
    case 'reduce':
    case 'popcount':
    case 'reverse':
    case 'cast':
    case 'intcast':
      return [e.a];
    case 'bin':
      return [e.a, e.b];
    case 'mux':
      return [e.c, e.a, e.b];
    case 'match':
      return [e.sel, ...e.arms.map((a) => a.body), ...(e.dflt ? [e.dflt] : [])];
    case 'index':
    case 'bitidx':
      return [e.a, e.i];
    case 'concat':
      return e.parts;
    case 'array':
      return e.elems;
    case 'struct':
      return e.fields;
    case 'memread':
      return [e.addr];
  }
}

/** Formats a value of type t for messages and test output. */
export function formatValue(v: bigint, t: Type): string {
  if (t.k === 'enum') {
    const i = t.codes.indexOf(v);
    return i >= 0 ? `${t.name}.${t.variants[i]}` : `${t.name}(${v})`;
  }
  if (t.k === 'bits' && t.signed) return String(toSigned(v, t.w));
  if (t.k === 'bits' && t.w > 8) return `${v} (0x${v.toString(16)})`;
  return String(v);
}
