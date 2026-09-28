/**
 * Expression trees for the step checker.
 *
 * Subtraction is `a + (-1)·b`, division is `a · b^(-1)`, and √x is `x^(1/2)`, so the core only
 * has sums, products, powers, numbers, symbols and named functions.
 */
import { Rat } from './rational';

export type Expr =
  | { k: 'num'; v: Rat }
  | { k: 'sym'; name: string }
  | { k: 'add'; args: Expr[] }
  | { k: 'mul'; args: Expr[] }
  | { k: 'pow'; base: Expr; exp: Expr }
  | { k: 'fn'; name: string; args: Expr[] };

export type Rel = '=' | '<' | '<=' | '>' | '>=' | '!=';

export const num = (n: number | bigint | Rat, d: number | bigint = 1): Expr => ({ k: 'num', v: n instanceof Rat ? n : Rat.of(n, d) });
export const sym = (name: string): Expr => ({ k: 'sym', name });
export const fn = (name: string, ...args: Expr[]): Expr => ({ k: 'fn', name, args });

export function add(...args: Expr[]): Expr {
  const flat = args.flatMap((a) => (a.k === 'add' ? a.args : [a]));
  if (flat.length === 1) return flat[0]!;
  if (flat.length === 0) return num(0);
  return { k: 'add', args: flat };
}

export function mul(...args: Expr[]): Expr {
  const flat = args.flatMap((a) => (a.k === 'mul' ? a.args : [a]));
  if (flat.length === 1) return flat[0]!;
  if (flat.length === 0) return num(1);
  return { k: 'mul', args: flat };
}

export const pow = (base: Expr, exp: Expr): Expr => ({ k: 'pow', base, exp });
export const neg = (a: Expr): Expr => (a.k === 'num' ? num(a.v.neg()) : mul(num(-1), a));
export const sub = (a: Expr, b: Expr): Expr => add(a, neg(b));
export const div = (a: Expr, b: Expr): Expr => mul(a, pow(b, num(-1)));
export const sqrt = (a: Expr): Expr => pow(a, num(1, 2));

export const isNum = (e: Expr, v?: number): e is { k: 'num'; v: Rat } => e.k === 'num' && (v === undefined || e.v.eq(Rat.of(v)));

/** Functions whose second argument is a bound variable: sum(body, k, from, to), prod(…). */
export const BINDERS = new Set(['sum', 'prod']);

/**
 * Free symbols of an expression. Constants such as π are functions, so they are excluded, and so
 * are the bound variables of sums and products.
 */
export function symbols(e: Expr, out: Set<string> = new Set()): Set<string> {
  switch (e.k) {
    case 'sym':
      out.add(e.name);
      break;
    case 'fn':
      if (BINDERS.has(e.name) && e.args[1]?.k === 'sym') {
        const bound = e.args[1].name;
        const inner = symbols(e.args[0]!);
        inner.delete(bound);
        inner.forEach((s) => out.add(s));
        e.args.slice(2).forEach((a) => symbols(a, out));
        break;
      }
      e.args.forEach((a) => symbols(a, out));
      break;
    case 'add':
    case 'mul':
      e.args.forEach((a) => symbols(a, out));
      break;
    case 'pow':
      symbols(e.base, out);
      symbols(e.exp, out);
      break;
  }
  return out;
}

/** Replace symbols by expressions. */
export function subst(e: Expr, env: Record<string, Expr>): Expr {
  switch (e.k) {
    case 'sym':
      return env[e.name] ?? e;
    case 'num':
      return e;
    case 'add':
      return add(...e.args.map((a) => subst(a, env)));
    case 'mul':
      return mul(...e.args.map((a) => subst(a, env)));
    case 'pow':
      return pow(subst(e.base, env), subst(e.exp, env));
    case 'fn': {
      if (BINDERS.has(e.name) && e.args[1]?.k === 'sym') {
        const { [e.args[1].name]: _shadowed, ...inner } = env;
        return fn(e.name, subst(e.args[0]!, inner), e.args[1], ...e.args.slice(2).map((a) => subst(a, env)));
      }
      return fn(e.name, ...e.args.map((a) => subst(a, env)));
    }
  }
}

/** Structural equality. */
export function same(a: Expr, b: Expr): boolean {
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'num':
      return a.v.eq((b as typeof a).v);
    case 'sym':
      return a.name === (b as typeof a).name;
    case 'pow':
      return same(a.base, (b as typeof a).base) && same(a.exp, (b as typeof a).exp);
    case 'fn':
      if (a.name !== (b as typeof a).name) return false;
    // fallthrough
    case 'add':
    case 'mul': {
      const bb = b as { args: Expr[] };
      return a.args.length === bb.args.length && a.args.every((x, i) => same(x, bb.args[i]!));
    }
  }
}
