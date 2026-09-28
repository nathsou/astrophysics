/**
 * Symbolic differentiation and a light simplifier for displaying results.
 */
import { Rat } from './rational';
import { add, fn, mul, num, pow, sub, type Expr } from './expr';

/** A string key for structural comparison (used to collect like terms). */
export function keyOf(e: Expr): string {
  switch (e.k) {
    case 'num':
      return e.v.toString();
    case 'sym':
      return e.name;
    case 'add':
      return `(+ ${e.args.map(keyOf).join(' ')})`;
    case 'mul':
      return `(* ${e.args.map(keyOf).join(' ')})`;
    case 'pow':
      return `(^ ${keyOf(e.base)} ${keyOf(e.exp)})`;
    case 'fn':
      return `(${e.name} ${e.args.map(keyOf).join(' ')})`;
  }
}

function coefAndRest(e: Expr): [Rat, Expr] {
  if (e.k === 'num') return [e.v, num(1)];
  if (e.k === 'mul') {
    let c = Rat.ONE;
    const rest: Expr[] = [];
    for (const a of e.args) {
      if (a.k === 'num') c = c.mul(a.v);
      else rest.push(a);
    }
    return [c, rest.length === 0 ? num(1) : rest.length === 1 ? rest[0]! : { k: 'mul', args: rest }];
  }
  return [Rat.ONE, e];
}

function baseAndExp(e: Expr): [Expr, Expr] {
  return e.k === 'pow' ? [e.base, e.exp] : [e, num(1)];
}

const order = (e: Expr) => (e.k === 'num' ? 0 : e.k === 'sym' ? 1 : e.k === 'pow' ? 2 : e.k === 'fn' ? 3 : 4);

/** Simplify for display: fold constants, collect like terms and powers of equal bases. */
export function simplify(e: Expr): Expr {
  switch (e.k) {
    case 'num':
    case 'sym':
      return e;
    case 'add': {
      const terms = e.args.map(simplify).flatMap((a) => (a.k === 'add' ? a.args : [a]));
      const groups = new Map<string, [Rat, Expr]>();
      let constant = Rat.ZERO;
      for (const t of terms) {
        const [c, rest] = coefAndRest(t);
        if (rest.k === 'num') {
          constant = constant.add(c.mul(rest.v));
          continue;
        }
        const k = keyOf(rest);
        const g = groups.get(k);
        groups.set(k, [g ? g[0].add(c) : c, rest]);
      }
      const out: Expr[] = [];
      for (const [c, rest] of groups.values()) {
        if (c.isZero()) continue;
        out.push(c.isOne() ? rest : simplify(mul(num(c), rest)));
      }
      if (!constant.isZero()) out.push(num(constant));
      if (out.length === 0) return num(0);
      return out.length === 1 ? out[0]! : { k: 'add', args: out };
    }
    case 'mul': {
      const factors = e.args.map(simplify).flatMap((a) => (a.k === 'mul' ? a.args : [a]));
      let c = Rat.ONE;
      const powers = new Map<string, [Expr, Expr[]]>();
      for (const f of factors) {
        if (f.k === 'num') {
          c = c.mul(f.v);
          continue;
        }
        const [b, x] = baseAndExp(f);
        const k = keyOf(b);
        const g = powers.get(k);
        if (g) g[1].push(x);
        else powers.set(k, [b, [x]]);
      }
      if (c.isZero()) return num(0);
      const out: Expr[] = [];
      for (const [b, xs] of powers.values()) {
        const x = simplify(add(...xs));
        if (x.k === 'num' && x.v.isZero()) continue;
        out.push(x.k === 'num' && x.v.isOne() ? b : simplify(pow(b, x)));
      }
      out.sort((a, b) => order(a) - order(b));
      if (!c.isOne() || out.length === 0) out.unshift(num(c));
      return out.length === 1 ? out[0]! : { k: 'mul', args: out };
    }
    case 'pow': {
      const b = simplify(e.base);
      const x = simplify(e.exp);
      if (x.k === 'num') {
        if (x.v.isZero()) return num(1);
        if (x.v.isOne()) return b;
        if (b.k === 'num' && x.v.isInt() && Math.abs(Number(x.v.n)) < 64 && !(b.v.isZero() && x.v.sign() < 0)) return num(b.v.pow(Number(x.v.n)));
        if (b.k === 'pow' && x.v.isInt()) return simplify(pow(b.base, mul(b.exp, x)));
        if (b.k === 'mul' && x.v.isInt()) return simplify(mul(...b.args.map((a) => pow(a, x))));
      }
      if (b.k === 'num' && (b.v.isOne() || b.v.isZero())) return b.v.isOne() ? num(1) : b;
      return pow(b, x);
    }
    case 'fn': {
      const args = e.args.map(simplify);
      const a = args[0];
      if (a?.k === 'num' && a.v.isZero()) {
        if (e.name === 'sin' || e.name === 'tan') return num(0);
        if (e.name === 'cos' || e.name === 'exp') return num(1);
      }
      if ((e.name === 'ln' || e.name === 'log') && a?.k === 'num' && a.v.isOne()) return num(0);
      if ((e.name === 'ln' || e.name === 'log') && a?.k === 'fn' && a.name === 'e') return num(1);
      return fn(e.name, ...args);
    }
  }
}

/** d/dx of an expression. */
export function derivative(e: Expr, x: string): Expr {
  return simplify(d(e, x));
}

function dependsOn(e: Expr, x: string): boolean {
  switch (e.k) {
    case 'num':
      return false;
    case 'sym':
      return e.name === x;
    case 'pow':
      return dependsOn(e.base, x) || dependsOn(e.exp, x);
    default:
      return e.args.some((a) => dependsOn(a, x));
  }
}

function d(e: Expr, x: string): Expr {
  if (!dependsOn(e, x)) return num(0);
  switch (e.k) {
    case 'num':
      return num(0);
    case 'sym':
      return num(e.name === x ? 1 : 0);
    case 'add':
      return add(...e.args.map((a) => d(a, x)));
    case 'mul':
      // Product rule over n factors.
      return add(...e.args.map((_, i) => mul(...e.args.map((a, j) => (i === j ? d(a, x) : a)))));
    case 'pow': {
      const { base, exp } = e;
      if (!dependsOn(exp, x)) return mul(exp, pow(base, sub(exp, num(1))), d(base, x));
      if (!dependsOn(base, x)) return mul(e, fn('ln', base), d(exp, x));
      // General case: d(b^g) = b^g (g' ln b + g b'/b)
      return mul(e, add(mul(d(exp, x), fn('ln', base)), mul(exp, d(base, x), pow(base, num(-1)))));
    }
    case 'fn': {
      const u = e.args[0]!;
      const du = d(u, x);
      switch (e.name) {
        case 'sin':
          return mul(fn('cos', u), du);
        case 'cos':
          return mul(num(-1), fn('sin', u), du);
        case 'tan':
          return mul(pow(fn('cos', u), num(-2)), du);
        case 'exp':
          return mul(e, du);
        case 'ln':
        case 'log':
          return mul(du, pow(u, num(-1)));
        case 'abs':
          return mul(u, pow(e, num(-1)), du);
      }
      throw new Error(`Cannot differentiate ${e.name}`);
    }
  }
}
