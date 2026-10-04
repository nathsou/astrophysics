/**
 * The octagon domain (Miné, 2006), chapter 27: conjunctions of constraints ±x ± y ≤ c and ±x ≤ c. It can say
 * `i < len(a)` or `lo ≤ hi`, which intervals cannot, at a cost quadratic in the number of variables.
 *
 * Representation: a difference-bound matrix over 2n "signed" variables, V(2k) = +x_k and V(2k+1) = −x_k, where
 * m[i][j] bounds V(j) − V(i) (null is +∞). Closure (shortest paths, then the octagonal strengthening step and
 * integer tightening) makes every bound as tight as the others imply; a negative cycle means the octagon is empty.
 */
import type * as A from '../vouch/syntax/ast';
import * as I from './interval';
import { varOf, type StateDomain, type VarDesc } from './domain';

type B = bigint | null;
interface Oct {
  n: number;
  m: B[];
  closed: boolean;
}
type OctS = Oct | 'bot';

const minB = (a: B, b: B): B => (a === null ? b : b === null ? a : a < b ? a : b);
const maxB = (a: B, b: B): B => (a === null || b === null ? null : a > b ? a : b);
const addB = (a: B, b: B): B => (a === null || b === null ? null : a + b);
const floorDiv2 = (x: bigint) => (x >= 0n ? x / 2n : -((-x + 1n) / 2n));
const bar = (i: number) => i ^ 1;

interface Lin {
  coefs: Map<string, bigint>;
  c: bigint;
}

/** e as a linear expression Σ a_x·x + c, when it is one. */
function linear(e: A.Expr): Lin | undefined {
  const v = varOf(e);
  if (v) return { coefs: new Map([[v, 1n]]), c: 0n };
  switch (e.k) {
    case 'int':
      return { coefs: new Map(), c: e.value };
    case 'unary':
      if (e.op === '-') {
        const a = linear(e.arg);
        return a && { coefs: new Map([...a.coefs].map(([k, x]) => [k, -x])), c: -a.c };
      }
      return undefined;
    case 'binary': {
      if (e.op !== '+' && e.op !== '-' && e.op !== '*') return undefined;
      const a = linear(e.left);
      const b = linear(e.right);
      if (!a || !b) return undefined;
      if (e.op === '*') {
        const [k, l] = a.coefs.size === 0 ? [a.c, b] : b.coefs.size === 0 ? [b.c, a] : [undefined, undefined];
        if (k === undefined || !l) return undefined;
        return { coefs: new Map([...l.coefs].map(([x, y]) => [x, y * k])), c: l.c * k };
      }
      const sgn = e.op === '+' ? 1n : -1n;
      const coefs = new Map(a.coefs);
      for (const [x, y] of b.coefs) coefs.set(x, (coefs.get(x) ?? 0n) + sgn * y);
      for (const [x, y] of coefs) if (y === 0n) coefs.delete(x);
      return { coefs, c: a.c + sgn * b.c };
    }
  }
  return undefined;
}

export class Octagons implements StateDomain<OctS> {
  readonly name = 'octagons';
  private index = new Map<string, number>();
  private names: string[] = [];
  /** A scratch variable for exact assignments x := ±y + c. */
  private static SCRATCH = '$scratch';

  private idx(x: string): number | undefined {
    return this.index.get(x);
  }

  bottom(): OctS {
    return 'bot';
  }
  isBottom(s: OctS): boolean {
    if (s === 'bot') return true;
    return this.close(s) === 'bot';
  }
  top(vars: VarDesc[]): OctS {
    this.names = [...vars.map((v) => v.name), Octagons.SCRATCH];
    this.index = new Map(this.names.map((n, i) => [n, i]));
    const n = this.names.length;
    const m: B[] = new Array(4 * n * n).fill(null);
    for (let i = 0; i < 2 * n; i++) m[i * 2 * n + i] = 0n;
    let s: OctS = { n, m, closed: true };
    for (const v of vars) s = this.bound(s, v.name, v.bounds);
    return s;
  }

  private get(s: Oct, i: number, j: number): B {
    return s.m[i * 2 * s.n + j]!;
  }
  private set(s: Oct, i: number, j: number, v: B) {
    s.m[i * 2 * s.n + j] = v;
  }
  private copy(s: Oct): Oct {
    return { n: s.n, m: [...s.m], closed: s.closed };
  }

  /** Strong closure with integer tightening; 'bot' when empty. */
  close(s: OctS): OctS {
    if (s === 'bot') return s;
    if (s.closed) return s;
    const o = this.copy(s);
    const N = 2 * o.n;
    for (let k = 0; k < N; k++)
      for (let i = 0; i < N; i++) {
        const ik = this.get(o, i, k);
        if (ik === null) continue;
        for (let j = 0; j < N; j++) {
          const v = addB(ik, this.get(o, k, j));
          if (v !== null) {
            const cur = this.get(o, i, j);
            if (cur === null || v < cur) this.set(o, i, j, v);
          }
        }
      }
    // Integer tightening of the unary bounds, then strengthening through them.
    for (let i = 0; i < N; i++) {
      const u = this.get(o, i, bar(i));
      if (u !== null) this.set(o, i, bar(i), 2n * floorDiv2(u));
    }
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const a = this.get(o, i, bar(i));
        const b = this.get(o, bar(j), j);
        if (a !== null && b !== null) {
          const v = floorDiv2(a + b);
          const cur = this.get(o, i, j);
          if (cur === null || v < cur) this.set(o, i, j, v);
        }
      }
    for (let i = 0; i < N; i++) {
      const d = this.get(o, i, i);
      if (d !== null && d < 0n) return 'bot';
      this.set(o, i, i, 0n);
    }
    o.closed = true;
    return o;
  }

  /** Add s1·x + s2·y ≤ c (y optional), not closing. */
  private constrain(s: Oct, x: number, s1: 1 | -1, y: number | undefined, s2: 1 | -1, c: bigint): void {
    const p = 2 * x + (s1 < 0 ? 1 : 0);
    if (y === undefined) {
      this.set(s, bar(p), p, minB(this.get(s, bar(p), p), 2n * c));
    } else {
      const q = 2 * y + (s2 > 0 ? 1 : 0);
      this.set(s, q, p, minB(this.get(s, q, p), c));
      this.set(s, bar(p), bar(q), minB(this.get(s, bar(p), bar(q)), c));
    }
    s.closed = false;
  }

  private bound(s: OctS, x: string, b: I.IntervalV): OctS {
    if (s === 'bot') return s;
    if (b === I.BOT) return 'bot';
    const k = this.idx(x);
    if (k === undefined) return s;
    const o = this.copy(s);
    if (b.hi !== null) this.constrain(o, k, 1, undefined, 1, b.hi);
    if (b.lo !== null) this.constrain(o, k, -1, undefined, 1, -b.lo);
    return o;
  }

  /** Bounds on one variable. */
  project(s: OctS, x: string): I.IntervalV {
    const c = this.close(s);
    if (c === 'bot') return I.BOT;
    const k = this.idx(x);
    if (k === undefined) return I.TOP;
    const hi = this.get(c, 2 * k + 1, 2 * k);
    const lo = this.get(c, 2 * k, 2 * k + 1);
    return I.itv(lo === null ? null : -floorDiv2(lo), hi === null ? null : floorDiv2(hi));
  }

  private forget(s: Oct, k: number): Oct {
    const o = this.copy(this.close(s) as Oct);
    const N = 2 * o.n;
    for (const i of [2 * k, 2 * k + 1])
      for (let j = 0; j < N; j++) {
        this.set(o, i, j, i === j ? 0n : null);
        this.set(o, j, i, i === j ? 0n : null);
      }
    return o;
  }

  join(a: OctS, b: OctS): OctS {
    const ca = this.close(a);
    const cb = this.close(b);
    if (ca === 'bot') return cb;
    if (cb === 'bot') return ca;
    return { n: ca.n, m: ca.m.map((x, i) => maxB(x, cb.m[i]!)), closed: true };
  }
  widen(a: OctS, b: OctS): OctS {
    const ca = this.close(a);
    const cb = this.close(b);
    if (ca === 'bot') return cb;
    if (cb === 'bot') return ca;
    return { n: ca.n, m: ca.m.map((x, i) => (x !== null && cb.m[i] !== null && cb.m[i]! <= x ? x : null)), closed: false };
  }
  narrow(a: OctS, b: OctS): OctS {
    const ca = this.close(a);
    const cb = this.close(b);
    if (ca === 'bot' || cb === 'bot') return 'bot';
    return { n: ca.n, m: ca.m.map((x, i) => (x === null ? cb.m[i]! : x)), closed: false };
  }
  leq(a: OctS, b: OctS): boolean {
    const ca = this.close(a);
    if (ca === 'bot') return true;
    const cb = this.close(b);
    if (cb === 'bot') return false;
    return ca.m.every((x, i) => cb.m[i] === null || (x !== null && x <= cb.m[i]!));
  }

  /** Interval of an expression: through the octagon for x, ±x ± y + c; through interval arithmetic otherwise. */
  range(s: OctS, e: A.Expr): I.IntervalV {
    const c = this.close(s);
    if (c === 'bot') return I.BOT;
    const l = linear(e);
    if (l) {
      const terms = [...l.coefs];
      if (terms.length === 0) return I.constant(l.c);
      if (terms.length <= 2 && terms.every(([, a]) => a === 1n || a === -1n)) {
        const ks = terms.map(([x]) => this.idx(x));
        if (ks.every((k) => k !== undefined)) {
          if (terms.length === 1) {
            const r = this.project(c, terms[0]![0]);
            return I.add(terms[0]![1] > 0n ? r : I.neg(r), I.constant(l.c));
          }
          // Upper bound of s1·x + s2·y is m[q][p]; lower bound is −m[p̄ … ] by symmetry.
          const [[, a1], [, a2]] = terms as [[string, bigint], [string, bigint]];
          const p = 2 * ks[0]! + (a1 < 0n ? 1 : 0);
          const q = 2 * ks[1]! + (a2 > 0n ? 1 : 0);
          const hi = this.get(c, q, p);
          const lo = this.get(c, bar(q), bar(p));
          // The pair bound, intersected with what the separate bounds give.
          const viaPair = I.itv(lo === null ? null : -lo, hi);
          const sep = I.add(a1 > 0n ? this.project(c, terms[0]![0]) : I.neg(this.project(c, terms[0]![0])), a2 > 0n ? this.project(c, terms[1]![0]) : I.neg(this.project(c, terms[1]![0])));
          return I.add(I.meet(viaPair, sep), I.constant(l.c));
        }
      }
    }
    return this.intervalEval(c, e);
  }

  private intervalEval(s: Oct, e: A.Expr): I.IntervalV {
    const v = varOf(e);
    if (v) return this.project(s, v);
    switch (e.k) {
      case 'int':
        return I.constant(e.value);
      case 'bool':
        return I.constant(e.value ? 1n : 0n);
      case 'unary':
        if (e.op === '-') return I.neg(this.range(s, e.arg));
        break;
      case 'binary': {
        const ops: Record<string, (a: I.IntervalV, b: I.IntervalV) => I.IntervalV> = { '+': I.add, '-': I.sub, '*': I.mul, '/': I.div, '%': I.mod };
        const f = ops[e.op];
        if (f) return f(this.range(s, e.left), this.range(s, e.right));
        if (['<', '<=', '>', '>=', '==', '!=', '&&', '||', '==>'].includes(e.op)) {
          const t = !this.isBottom(this.assume(s, e, true));
          const ff = !this.isBottom(this.assume(s, e, false));
          return I.itv(ff ? 0n : 1n, t ? 1n : 0n);
        }
        break;
      }
      case 'if':
        return I.join(this.range(this.assume(s, e.cond, true), e.then), this.range(this.assume(s, e.cond, false), e.else));
      case 'cast':
        return this.range(s, e.arg);
    }
    return I.TOP;
  }

  assign(s: OctS, x: string, e: A.Expr, bounds: I.IntervalV): OctS {
    const c = this.close(s);
    if (c === 'bot') return c;
    const k = this.idx(x);
    if (k === undefined) return c;
    const l = linear(e);
    const terms = l ? [...l.coefs] : [];
    if (l && terms.length <= 1 && terms.every(([y, a]) => (a === 1n || a === -1n) && this.idx(y) !== undefined)) {
      // Exact: scratch := ±y + c; x := scratch.
      const t = this.idx(Octagons.SCRATCH)!;
      let o = this.forget(c, t);
      if (terms.length === 0) {
        this.constrain(o, t, 1, undefined, 1, l.c);
        this.constrain(o, t, -1, undefined, 1, -l.c);
      } else {
        const [y, a] = terms[0]!;
        const yk = this.idx(y)!;
        const s2 = a > 0n ? -1 : 1; // t − a·y = c
        this.constrain(o, t, 1, yk, s2 as 1 | -1, l.c);
        this.constrain(o, t, -1, yk, -s2 as 1 | -1, -l.c);
      }
      const o2 = this.close(o);
      if (o2 === 'bot') return 'bot';
      o = this.forget(o2, k);
      this.constrain(o, k, 1, t, -1, 0n);
      this.constrain(o, k, -1, t, 1, 0n);
      const o3 = this.close(o);
      if (o3 === 'bot') return 'bot';
      return this.bound(this.forget(o3, t), x, bounds);
    }
    const r = I.meet(this.range(c, e), bounds);
    return this.bound(this.forget(c, k), x, r);
  }

  havoc(s: OctS, x: string, bounds: I.IntervalV): OctS {
    const c = this.close(s);
    if (c === 'bot') return c;
    const k = this.idx(x);
    if (k === undefined) return c;
    return this.bound(this.forget(c, k), x, bounds);
  }

  assume(s: OctS, cond: A.Expr, positive: boolean): OctS {
    const c = this.close(s);
    if (c === 'bot') return c;
    switch (cond.k) {
      case 'bool':
        return cond.value === positive ? c : 'bot';
      case 'unary':
        if (cond.op === '!') return this.assume(c, cond.arg, !positive);
        break;
      case 'var':
        return this.cmp(c, positive ? '==' : '!=', cond, { k: 'int', value: 1n, span: cond.span });
      case 'chain': {
        const parts = cond.ops.map((op, i) => ({ k: 'binary', op, left: cond.args[i]!, right: cond.args[i + 1]!, span: cond.span }) as A.Expr);
        if (positive) return parts.reduce<OctS>((acc, p) => this.assume(acc, p, true), c);
        return parts.reduce<OctS>((acc, p) => this.join(acc, this.assume(c, p, false)), 'bot');
      }
      case 'binary': {
        if (cond.op === '&&' || cond.op === '||') {
          if ((cond.op === '&&') === positive) return this.assume(this.assume(c, cond.left, positive), cond.right, positive);
          return this.join(this.assume(c, cond.left, positive), this.assume(c, cond.right, positive));
        }
        if (cond.op === '==>') {
          if (positive) return this.join(this.assume(c, cond.left, false), this.assume(c, cond.right, true));
          return this.assume(this.assume(c, cond.left, true), cond.right, false);
        }
        const flip: Record<string, string> = { '<': '>=', '<=': '>', '>': '<=', '>=': '<', '==': '!=', '!=': '==' };
        if (flip[cond.op]) return this.cmp(c, positive ? cond.op : flip[cond.op]!, cond.left, cond.right);
      }
    }
    return c;
  }

  /** l op r. Linear differences of at most two variables (unit coefficients) are added exactly; otherwise bounds. */
  private cmp(s: Oct, op: string, l: A.Expr, r: A.Expr): OctS {
    if (op === '!=') {
      // Only a constant at the end of a variable's range can be cut off.
      const d = linear({ k: 'binary', op: '-', left: l, right: r, span: l.span });
      if (d && d.coefs.size === 1) {
        const [x, a] = [...d.coefs][0]!;
        if (a === 1n || a === -1n) {
          const val = a === 1n ? -d.c : d.c;
          const cur = this.project(s, x);
          if (cur !== I.BOT && cur.lo === val) return this.bound(s, x, { lo: val + 1n, hi: null });
          if (cur !== I.BOT && cur.hi === val) return this.bound(s, x, { lo: null, hi: val - 1n });
        }
      }
      return s;
    }
    if (op === '==') return this.cmp(this.close(this.cmp(s, '<=', l, r) as Oct) as Oct, '>=', l, r);
    // Normalise to d ≤ 0, with d = l − r (or r − l), and strict to non-strict over the integers.
    const [lhs, rhs, strict] = op === '<' ? [l, r, true] : op === '<=' ? [l, r, false] : op === '>' ? [r, l, true] : [r, l, false];
    const d = linear({ k: 'binary', op: '-', left: lhs, right: rhs, span: l.span });
    if (d) {
      const terms = [...d.coefs];
      const bound = -d.c - (strict ? 1n : 0n); // Σ a·x ≤ bound
      if (terms.length === 0) return bound >= 0n ? s : 'bot';
      if (terms.length <= 2 && terms.every(([x, a]) => (a === 1n || a === -1n) && this.idx(x) !== undefined)) {
        const o = this.copy(s);
        const [x1, a1] = terms[0]!;
        const second = terms[1];
        this.constrain(o, this.idx(x1)!, a1 > 0n ? 1 : -1, second ? this.idx(second[0])! : undefined, second && second[1] > 0n ? 1 : -1, bound);
        return this.close(o);
      }
    }
    // Not octagonal: narrow each side that is a variable by the other side's bounds.
    const a = this.range(s, lhs);
    const b = this.range(s, rhs);
    if (a === I.BOT || b === I.BOT) return 'bot';
    let out: OctS = s;
    const lv = varOf(lhs);
    const rv = varOf(rhs);
    if (lv) out = this.bound(out, lv, { lo: null, hi: b.hi === null ? null : b.hi - (strict ? 1n : 0n) });
    if (rv) out = this.bound(out, rv, { lo: a.lo === null ? null : a.lo + (strict ? 1n : 0n), hi: null });
    const lo = a.lo;
    const hi = b.hi;
    if (lo !== null && hi !== null && (strict ? lo >= hi : lo > hi)) return 'bot';
    return this.close(out);
  }

  show(s: OctS): { vars: Record<string, string>; relations: string[] } {
    const c = this.close(s);
    if (c === 'bot') return { vars: {}, relations: ['unreachable'] };
    const vars: Record<string, string> = {};
    const real = this.names.filter((n) => n !== Octagons.SCRATCH && !n.startsWith('$'));
    for (const x of real) vars[x] = I.show(this.project(c, x));
    const relations: string[] = [];
    for (let a = 0; a < real.length; a++)
      for (let b = a + 1; b < real.length; b++) {
        const x = real[a]!;
        const y = real[b]!;
        const ka = this.idx(x)!;
        const kb = this.idx(y)!;
        const ix = this.project(c, x);
        const iy = this.project(c, y);
        // x − y ≤ m, y − x ≤ m′, x + y ≤ m″, −x − y ≤ m‴; shown when tighter than the intervals imply.
        const forms: [1 | -1, 1 | -1, (k: bigint) => string][] = [
          [1, -1, (k) => (k === 0n ? `${x} ≤ ${y}` : k === -1n ? `${x} < ${y}` : `${x} ≤ ${y} ${k < 0n ? '−' : '+'} ${k < 0n ? -k : k}`)],
          [-1, 1, (k) => (k === 0n ? `${y} ≤ ${x}` : k === -1n ? `${y} < ${x}` : `${y} ≤ ${x} ${k < 0n ? '−' : '+'} ${k < 0n ? -k : k}`)],
          [1, 1, (k) => `${x} + ${y} ≤ ${k}`],
          [-1, -1, (k) => `${x} + ${y} ≥ ${-k}`],
        ];
        // x − y ≤ k and y − x ≤ −k together: an equation.
        const d1 = this.get(c, 2 * kb, 2 * ka);
        const d2 = this.get(c, 2 * ka, 2 * kb);
        if (d1 !== null && d2 !== null && d1 === -d2) {
          relations.push(d1 === 0n ? `${x} = ${y}` : `${x} = ${y} ${d1 < 0n ? '−' : '+'} ${d1 < 0n ? -d1 : d1}`);
          forms.splice(0, 2);
        }
        for (const [s1, s2, txt] of forms) {
          const p = 2 * ka + (s1 < 0 ? 1 : 0);
          const q = 2 * kb + (s2 > 0 ? 1 : 0);
          const m = this.get(c, q, p);
          if (m === null) continue;
          const implied = I.add(s1 > 0 ? ix : I.neg(ix), s2 > 0 ? iy : I.neg(iy));
          if (implied !== I.BOT && implied.hi !== null && implied.hi <= m) continue;
          relations.push(txt(m));
        }
      }
    return { vars, relations };
  }
}
