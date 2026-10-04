/**
 * Abstract domains for chapter 26 and 27. A domain describes a set of program states by an abstract value; the
 * analyser (analyse.ts) only needs the operations below. The non-relational domains (signs, intervals) keep one
 * abstract value per variable; the octagon domain (octagon.ts) also keeps bounds on x ± y.
 */
import type * as A from '../vouch/syntax/ast';
import * as I from './interval';

export interface VarDesc {
  name: string;
  /** Bounds that every value of the variable's type satisfies (bool: [0, 1], nat: [0, +∞], u8: [0, 255]). */
  bounds: I.IntervalV;
}

export interface StateDomain<S> {
  readonly name: string;
  bottom(): S;
  isBottom(s: S): boolean;
  /** Every variable anywhere within its type's bounds. */
  top(vars: VarDesc[]): S;
  join(a: S, b: S): S;
  widen(a: S, b: S): S;
  narrow(a: S, b: S): S;
  leq(a: S, b: S): boolean;
  /** x := e (e an integer or Boolean expression; anything the domain cannot follow gives x its type's bounds). */
  assign(s: S, x: string, e: A.Expr, bounds: I.IntervalV): S;
  /** x := any value within bounds. */
  havoc(s: S, x: string, bounds: I.IntervalV): S;
  /** The states of s where cond is true (positive) or false. */
  assume(s: S, cond: A.Expr, positive: boolean): S;
  /** Bounds on the value of an integer expression in s. */
  range(s: S, e: A.Expr): I.IntervalV;
  /** Each variable's description, and any relations, for display. */
  show(s: S): { vars: Record<string, string>; relations: string[] };
}

// ── Values of the non-relational domains ──

export interface ValueDomain<V> {
  readonly name: string;
  bottom: V;
  top: V;
  isBottom(v: V): boolean;
  join(a: V, b: V): V;
  meet(a: V, b: V): V;
  widen(a: V, b: V): V;
  narrow(a: V, b: V): V;
  leq(a: V, b: V): boolean;
  constant(n: bigint): V;
  fromInterval(i: I.IntervalV): V;
  toInterval(v: V): I.IntervalV;
  binop(op: string, a: V, b: V): V;
  neg(a: V): V;
  show(v: V): string;
}

export const IntervalValues: ValueDomain<I.IntervalV> = {
  name: 'intervals',
  bottom: I.BOT,
  top: I.TOP,
  isBottom: (v) => v === I.BOT,
  join: I.join,
  meet: I.meet,
  widen: I.widen,
  narrow: I.narrow,
  leq: I.leq,
  constant: I.constant,
  fromInterval: (i) => i,
  toInterval: (v) => v,
  binop: (op, a, b) => (op === '+' ? I.add(a, b) : op === '-' ? I.sub(a, b) : op === '*' ? I.mul(a, b) : op === '/' ? I.div(a, b) : op === '%' ? I.mod(a, b) : I.TOP),
  neg: I.neg,
  show: I.show,
};

/** Signs: a set of {negative, zero, positive}, as three bits. */
export type Sign = number;
const NEG = 1;
const ZERO = 2;
const POS = 4;
const signOf = (n: bigint): Sign => (n < 0n ? NEG : n === 0n ? ZERO : POS);
const SIGN_TABLE: Record<string, (a: number, b: number) => Sign> = {
  '+': (a, b) => (a === ZERO ? b : b === ZERO ? a : a === b ? a : NEG | ZERO | POS),
  '*': (a, b) => (a === ZERO || b === ZERO ? ZERO : a === b ? POS : NEG),
  // Truncating division: |a| < |b| gives zero.
  '/': (a, b) => (a === ZERO ? ZERO : a === b ? POS | ZERO : NEG | ZERO),
  '%': (a) => (a === ZERO ? ZERO : a | ZERO),
};
const bits = (s: Sign) => [NEG, ZERO, POS].filter((b) => s & b);

export const SignValues: ValueDomain<Sign> = {
  name: 'signs',
  bottom: 0,
  top: NEG | ZERO | POS,
  isBottom: (v) => v === 0,
  join: (a, b) => a | b,
  meet: (a, b) => a & b,
  widen: (a, b) => a | b,
  narrow: (a, b) => a & b,
  leq: (a, b) => (a & ~b) === 0,
  constant: signOf,
  fromInterval(i) {
    if (i === I.BOT) return 0;
    let s = 0;
    if (i.lo === null || i.lo < 0n) s |= NEG;
    if (I.contains(i, 0n)) s |= ZERO;
    if (i.hi === null || i.hi > 0n) s |= POS;
    return s;
  },
  toInterval(v) {
    if (v === 0) return I.BOT;
    const lo = v & NEG ? null : v & ZERO ? 0n : 1n;
    const hi = v & POS ? null : v & ZERO ? 0n : -1n;
    return { lo, hi };
  },
  binop(op, a, b) {
    if (op === '-') return this.binop('+', a, this.neg(b));
    const f = SIGN_TABLE[op];
    if (!f) return this.top;
    let out = 0;
    for (const x of bits(a)) for (const y of bits(b)) if (!(op === '/' || op === '%') || y !== ZERO) out |= f(x, y);
    return out;
  },
  neg: (a) => (a & ZERO) | (a & NEG ? POS : 0) | (a & POS ? NEG : 0),
  show(v) {
    switch (v) {
      case 0:
        return '⊥';
      case NEG:
        return '< 0';
      case ZERO:
        return '0';
      case POS:
        return '> 0';
      case NEG | ZERO:
        return '≤ 0';
      case ZERO | POS:
        return '≥ 0';
      case NEG | POS:
        return '≠ 0';
      default:
        return '⊤';
    }
  },
};

// ── A non-relational state: one value per variable ──

type Env<V> = Map<string, V> | 'bot';

const CMP = new Set(['<', '<=', '>', '>=', '==', '!=']);
const flipOp: Record<string, string> = { '<': '>=', '<=': '>', '>': '<=', '>=': '<', '==': '!=', '!=': '==' };
const mirror: Record<string, string> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '==': '==', '!=': '!=' };

/** The variable an expression names, if it is one (len(a) is the variable |a|). */
export function varOf(e: A.Expr): string | undefined {
  if (e.k === 'var') return e.name;
  if (e.k === 'call' && e.callee === 'len' && e.args[0]?.k === 'var') return `|${e.args[0].name}|`;
  return undefined;
}

export class NonRelational<V> implements StateDomain<Env<V>> {
  readonly name: string;
  constructor(readonly D: ValueDomain<V>) {
    this.name = D.name;
  }
  bottom(): Env<V> {
    return 'bot';
  }
  isBottom(s: Env<V>): boolean {
    return s === 'bot' || [...s.values()].some((v) => this.D.isBottom(v));
  }
  top(vars: VarDesc[]): Env<V> {
    return new Map(vars.map((v) => [v.name, this.D.fromInterval(v.bounds)]));
  }
  private lift(a: Env<V>, b: Env<V>, f: (x: V, y: V) => V): Env<V> {
    if (this.isBottom(a)) return b;
    if (this.isBottom(b)) return a;
    const out = new Map<string, V>();
    for (const [k, x] of a as Map<string, V>) out.set(k, f(x, (b as Map<string, V>).get(k) ?? this.D.top));
    return out;
  }
  join(a: Env<V>, b: Env<V>) {
    return this.lift(a, b, (x, y) => this.D.join(x, y));
  }
  widen(a: Env<V>, b: Env<V>) {
    return this.lift(a, b, (x, y) => this.D.widen(x, y));
  }
  narrow(a: Env<V>, b: Env<V>): Env<V> {
    if (this.isBottom(a) || this.isBottom(b)) return 'bot';
    return this.lift(a, b, (x, y) => this.D.narrow(x, y));
  }
  leq(a: Env<V>, b: Env<V>): boolean {
    if (this.isBottom(a)) return true;
    if (this.isBottom(b)) return false;
    for (const [k, x] of a as Map<string, V>) if (!this.D.leq(x, (b as Map<string, V>).get(k) ?? this.D.top)) return false;
    return true;
  }

  /** The abstract value of an integer (or Boolean, as 0/1) expression. */
  value(s: Env<V>, e: A.Expr): V {
    if (this.isBottom(s)) return this.D.bottom;
    const env = s as Map<string, V>;
    switch (e.k) {
      case 'int':
        return this.D.constant(e.value);
      case 'bool':
        return this.D.constant(e.value ? 1n : 0n);
      case 'unary':
        if (e.op === '-') return this.D.neg(this.value(s, e.arg));
        if (e.op === '!') return this.boolValue(s, e);
        break;
      case 'binary':
        if (['+', '-', '*', '/', '%'].includes(e.op)) return this.D.binop(e.op, this.value(s, e.left), this.value(s, e.right));
        if (CMP.has(e.op) || ['&&', '||', '==>'].includes(e.op)) return this.boolValue(s, e);
        break;
      case 'call': {
        const v = varOf(e);
        if (v) return env.get(v) ?? this.D.fromInterval({ lo: 0n, hi: null });
        if ((e.callee === 'min' || e.callee === 'max') && e.args.length === 2) {
          const a = this.D.toInterval(this.value(s, e.args[0]!));
          const b = this.D.toInterval(this.value(s, e.args[1]!));
          if (a === I.BOT || b === I.BOT) return this.D.bottom;
          const lo = e.callee === 'min' ? (a.lo === null || b.lo === null ? null : a.lo < b.lo ? a.lo : b.lo) : (a.lo === null ? b.lo : b.lo === null ? a.lo : a.lo > b.lo ? a.lo : b.lo);
          const hi = e.callee === 'min' ? (a.hi === null ? b.hi : b.hi === null ? a.hi : a.hi < b.hi ? a.hi : b.hi) : (a.hi === null || b.hi === null ? null : a.hi > b.hi ? a.hi : b.hi);
          return this.D.fromInterval(I.itv(lo, hi));
        }
        if (e.callee === 'abs' && e.args.length === 1) {
          const a = this.value(s, e.args[0]!);
          return this.D.join(this.D.meet(a, this.D.fromInterval({ lo: 0n, hi: null })), this.D.meet(this.D.neg(a), this.D.fromInterval({ lo: 0n, hi: null })));
        }
        break;
      }
      case 'var':
        return env.get(e.name) ?? this.D.top;
      case 'if': {
        const t = this.value(this.assume(s, e.cond, true), e.then);
        const f = this.value(this.assume(s, e.cond, false), e.else);
        return this.D.join(t, f);
      }
    }
    return this.D.top;
  }

  private boolValue(s: Env<V>, e: A.Expr): V {
    const t = !this.isBottom(this.assume(s, e, true));
    const f = !this.isBottom(this.assume(s, e, false));
    return this.D.fromInterval(I.itv(f ? 0n : 1n, t ? 1n : 0n));
  }

  assign(s: Env<V>, x: string, e: A.Expr, bounds: I.IntervalV): Env<V> {
    if (this.isBottom(s)) return s;
    const v = this.D.meet(this.value(s, e), this.D.fromInterval(bounds));
    return new Map(s as Map<string, V>).set(x, v);
  }
  havoc(s: Env<V>, x: string, bounds: I.IntervalV): Env<V> {
    if (this.isBottom(s)) return s;
    return new Map(s as Map<string, V>).set(x, this.D.fromInterval(bounds));
  }

  assume(s: Env<V>, c: A.Expr, positive: boolean): Env<V> {
    if (this.isBottom(s)) return s;
    switch (c.k) {
      case 'bool':
        return c.value === positive ? s : 'bot';
      case 'unary':
        if (c.op === '!') return this.assume(s, c.arg, !positive);
        break;
      case 'binary': {
        const and = (c.op === '&&') === positive;
        if (c.op === '&&' || c.op === '||') {
          if (and) return this.assume(this.assume(s, c.left, positive), c.right, positive);
          return this.join(this.assume(s, c.left, positive), this.assume(s, c.right, positive));
        }
        if (c.op === '==>') {
          // a ==> b  is  !a || b
          if (positive) return this.join(this.assume(s, c.left, false), this.assume(s, c.right, true));
          return this.assume(this.assume(s, c.left, true), c.right, false);
        }
        if (CMP.has(c.op)) return this.compare(s, positive ? c.op : flipOp[c.op]!, c.left, c.right);
        break;
      }
      case 'chain': {
        const parts = c.ops.map((op, i) => ({ op, l: c.args[i]!, r: c.args[i + 1]! }));
        if (positive) return parts.reduce((acc, p) => this.compare(acc, p.op, p.l, p.r), s);
        return parts.reduce<Env<V>>((acc, p) => this.join(acc, this.compare(s, flipOp[p.op]!, p.l, p.r)), 'bot');
      }
      case 'var':
        return this.compare(s, positive ? '==' : '!=', c, { k: 'int', value: 1n, span: c.span });
    }
    return s;
  }

  /** Refine s by "l op r": each side that is a variable is narrowed against the other side's bounds. */
  private compare(s: Env<V>, op: string, l: A.Expr, r: A.Expr): Env<V> {
    if (this.isBottom(s)) return s;
    const a = this.D.toInterval(this.value(s, l));
    const b = this.D.toInterval(this.value(s, r));
    if (a === I.BOT || b === I.BOT) return 'bot';
    const refine = (x: I.Itv, o: string, y: I.Itv): I.IntervalV => {
      switch (o) {
        case '<':
          return I.meet(x, { lo: null, hi: y.hi === null ? null : y.hi - 1n });
        case '<=':
          return I.meet(x, { lo: null, hi: y.hi });
        case '>':
          return I.meet(x, { lo: y.lo === null ? null : y.lo + 1n, hi: null });
        case '>=':
          return I.meet(x, { lo: y.lo, hi: null });
        case '==':
          return I.meet(x, y);
        case '!=':
          // Only a singleton on the other side, at an end of x, can be cut off.
          if (y.lo !== null && y.lo === y.hi) {
            if (x.lo === y.lo) return I.itv(x.lo + 1n, x.hi);
            if (x.hi === y.lo) return I.itv(x.lo, x.hi - 1n);
          }
          return x;
      }
      return x;
    };
    const na = refine(a, op, b);
    const nb = refine(b, mirror[op]!, a);
    if (na === I.BOT || nb === I.BOT) return 'bot';
    let out = s as Map<string, V>;
    const lv = varOf(l);
    const rv = varOf(r);
    if (lv) out = new Map(out).set(lv, this.D.meet(out.get(lv) ?? this.D.top, this.D.fromInterval(na)));
    if (rv) out = new Map(out).set(rv, this.D.meet(out.get(rv) ?? this.D.top, this.D.fromInterval(nb)));
    return this.isBottom(out) ? 'bot' : out;
  }

  range(s: Env<V>, e: A.Expr): I.IntervalV {
    return this.D.toInterval(this.value(s, e));
  }

  show(s: Env<V>): { vars: Record<string, string>; relations: string[] } {
    if (this.isBottom(s)) return { vars: {}, relations: ['unreachable'] };
    return { vars: Object.fromEntries([...(s as Map<string, V>)].map(([k, v]) => [k, this.D.show(v)])), relations: [] };
  }
}
