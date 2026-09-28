/**
 * Evaluating expressions: in floating point (for plots and numerical checks) and exactly over ℚ
 * where possible (for integer arguments, so 2^60 + 1 and 30! compare exactly).
 */
import { Rat, bigAbs, bigGcd } from './rational';
import { subst, num, type Expr } from './expr';

export type NumEnv = Record<string, number>;
export type RatEnv = Record<string, Rat>;
/** Extra functions (defined in an exercise), numeric version. */
export type FnTable = Record<string, (...args: number[]) => number>;

const MAX_TERMS = 100_000;

function gamma(x: number): number {
  // Lanczos approximation, enough for non-integer factorials in plots.
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  x -= 1;
  let a = c[0]!;
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i]! / (x + i);
  return Math.sqrt(2 * Math.PI) * t ** (x + 0.5) * Math.exp(-t) * a;
}

function factNum(n: number): number {
  if (Number.isInteger(n)) {
    if (n < 0) return NaN;
    let r = 1;
    for (let i = 2; i <= n && r !== Infinity; i++) r *= i;
    return r;
  }
  return gamma(n + 1);
}

function gcdNum(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function evalNum(e: Expr, env: NumEnv, fns: FnTable = {}): number {
  switch (e.k) {
    case 'num':
      return e.v.toNumber();
    case 'sym': {
      const v = env[e.name];
      if (v === undefined) throw new ReferenceError(`No value for ${e.name}`);
      return v;
    }
    case 'add':
      return e.args.reduce((s, a) => s + evalNum(a, env, fns), 0);
    case 'mul':
      return e.args.reduce((s, a) => s * evalNum(a, env, fns), 1);
    case 'pow': {
      const b = evalNum(e.base, env, fns);
      if (e.exp.k === 'num' && !e.exp.v.isInt()) {
        // Real odd roots of negative numbers: (−8)^(1/3) = −2.
        const q = Number(e.exp.v.d);
        const p = Number(e.exp.v.n);
        if (b < 0 && q % 2 === 1) return (p % 2 === 0 ? 1 : -1) * Math.abs(b) ** (p / q);
      }
      return b ** evalNum(e.exp, env, fns);
    }
    case 'fn': {
      const name = e.name;
      if (name === 'sum' || name === 'prod') return bigOpNum(e, env, fns);
      const a = e.args.map((x) => evalNum(x, env, fns));
      switch (name) {
        case 'pi':
          return Math.PI;
        case 'e':
          return Math.E;
        case 'sin':
          return Math.sin(a[0]!);
        case 'cos':
          return Math.cos(a[0]!);
        case 'tan':
          return Math.tan(a[0]!);
        case 'exp':
          return Math.exp(a[0]!);
        case 'ln':
        case 'log':
          return Math.log(a[0]!);
        case 'abs':
          return Math.abs(a[0]!);
        case 'floor':
          return Math.floor(a[0]!);
        case 'ceil':
          return Math.ceil(a[0]!);
        case 'fact':
          return factNum(a[0]!);
        case 'binom': {
          const [n, k] = a as [number, number];
          if (Number.isInteger(n) && Number.isInteger(k)) {
            if (k < 0 || (n >= 0 && k > n)) return 0;
            let r = 1;
            for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
            return Math.round(r);
          }
          return factNum(n) / (factNum(k) * factNum(n - k));
        }
        case 'gcd':
          return gcdNum(a[0]!, a[1]!);
        case 'lcm':
          return a[0] === 0 || a[1] === 0 ? 0 : Math.abs(a[0]! * a[1]!) / gcdNum(a[0]!, a[1]!);
        case 'max':
          return Math.max(...a);
        case 'min':
          return Math.min(...a);
        case 'mod':
          return ((a[0]! % a[1]!) + a[1]!) % a[1]!;
      }
      const f = fns[name];
      if (f) return f(...a);
      throw new ReferenceError(`Unknown function ${name}`);
    }
  }
}

function bigOpNum(e: Expr & { k: 'fn' }, env: NumEnv, fns: FnTable): number {
  const [body, v, from, to] = e.args as [Expr, Expr, Expr, Expr];
  if (v.k !== 'sym') throw new SyntaxError('sum/prod needs a variable as its second argument');
  const lo = Math.ceil(evalNum(from, env, fns) - 1e-9);
  const hi = Math.floor(evalNum(to, env, fns) + 1e-9);
  if (hi - lo > MAX_TERMS) throw new RangeError('Too many terms');
  let acc = e.name === 'sum' ? 0 : 1;
  for (let i = lo; i <= hi; i++) {
    const x = evalNum(body, { ...env, [v.name]: i }, fns);
    acc = e.name === 'sum' ? acc + x : acc * x;
  }
  return acc;
}

/**
 * Exact evaluation over ℚ. Returns null when the value is not rational (√2, π, sin 1) or when a
 * user function has no exact version.
 */
export function evalExact(e: Expr, env: RatEnv, fns: Record<string, (...args: Rat[]) => Rat | null> = {}): Rat | null {
  switch (e.k) {
    case 'num':
      return e.v;
    case 'sym':
      return env[e.name] ?? null;
    case 'add': {
      let s = Rat.ZERO;
      for (const a of e.args) {
        const v = evalExact(a, env, fns);
        if (!v) return null;
        s = s.add(v);
      }
      return s;
    }
    case 'mul': {
      let s = Rat.ONE;
      for (const a of e.args) {
        const v = evalExact(a, env, fns);
        if (!v) return null;
        s = s.mul(v);
        if (s.isZero()) return s;
      }
      return s;
    }
    case 'pow': {
      const b = evalExact(e.base, env, fns);
      const x = evalExact(e.exp, env, fns);
      if (!b || !x) return null;
      if (x.isInt()) {
        if (bigAbs(x.n) > 20000n) return null;
        if (b.isZero() && x.n < 0n) throw new RangeError('Division by zero');
        return b.pow(Number(x.n));
      }
      // Exact roots of perfect powers: 4^(1/2) = 2.
      const q = Number(x.d);
      const root = (v: bigint): bigint | null => {
        if (v < 0n) return null;
        const r = BigInt(Math.round(Number(v) ** (1 / q)));
        for (const c of [r - 1n, r, r + 1n]) if (c >= 0n && c ** BigInt(q) === v) return c;
        return null;
      };
      if (b.sign() < 0) return null;
      const rn = root(b.n);
      const rd = root(b.d);
      if (rn === null || rd === null) return null;
      return Rat.of(rn, rd).pow(Number(x.n));
    }
    case 'fn': {
      const name = e.name;
      if (name === 'sum' || name === 'prod') {
        const [body, v, from, to] = e.args as [Expr, Expr, Expr, Expr];
        const lo = evalExact(from, env, fns);
        const hi = evalExact(to, env, fns);
        if (!lo || !hi || v.k !== 'sym' || !lo.isInt() || !hi.isInt() || hi.n - lo.n > 5000n) return null;
        let acc = name === 'sum' ? Rat.ZERO : Rat.ONE;
        for (let i = lo.n; i <= hi.n; i++) {
          const t = evalExact(subst(body, { [v.name]: num(i) }), env, fns);
          if (!t) return null;
          acc = name === 'sum' ? acc.add(t) : acc.mul(t);
        }
        return acc;
      }
      if (name === 'pi' || name === 'e') return null;
      const a: Rat[] = [];
      for (const x of e.args) {
        const v = evalExact(x, env, fns);
        if (!v) return null;
        a.push(v);
      }
      const ints = a.every((x) => x.isInt());
      switch (name) {
        case 'abs':
          return a[0]!.sign() < 0 ? a[0]!.neg() : a[0]!;
        case 'floor': {
          const r = a[0]!;
          const q = r.n / r.d;
          return Rat.of(r.n < 0n && q * r.d !== r.n ? q - 1n : q);
        }
        case 'ceil': {
          const r = a[0]!.neg();
          const q = r.n / r.d;
          return Rat.of(-(r.n < 0n && q * r.d !== r.n ? q - 1n : q));
        }
        case 'fact': {
          if (!ints || a[0]!.n < 0n || a[0]!.n > 3000n) return null;
          let r = 1n;
          for (let i = 2n; i <= a[0]!.n; i++) r *= i;
          return Rat.of(r);
        }
        case 'binom': {
          if (!ints) return null;
          const [n, k] = [a[0]!.n, a[1]!.n];
          if (k < 0n || (n >= 0n && k > n)) return Rat.ZERO;
          let r = Rat.ONE;
          for (let i = 1n; i <= k; i++) r = r.mul(Rat.of(n - k + i, i));
          return r;
        }
        case 'gcd':
          return ints ? Rat.of(bigGcd(a[0]!.n, a[1]!.n)) : null;
        case 'lcm': {
          if (!ints) return null;
          const g = bigGcd(a[0]!.n, a[1]!.n);
          return g === 0n ? Rat.ZERO : Rat.of(bigAbs(a[0]!.n * a[1]!.n) / g);
        }
        case 'max':
          return a.reduce((x, y) => (x.cmp(y) >= 0 ? x : y));
        case 'min':
          return a.reduce((x, y) => (x.cmp(y) <= 0 ? x : y));
        case 'mod': {
          if (!ints || a[1]!.n === 0n) return null;
          const m = bigAbs(a[1]!.n);
          return Rat.of(((a[0]!.n % m) + m) % m);
        }
        case 'sin':
        case 'tan':
          return a[0]!.isZero() ? Rat.ZERO : null;
        case 'cos':
          return a[0]!.isZero() ? Rat.ONE : null;
        case 'ln':
        case 'log':
          return a[0]!.isOne() ? Rat.ZERO : null;
        case 'exp':
          return a[0]!.isZero() ? Rat.ONE : null;
      }
      const f = fns[name];
      return f ? f(...a) : null;
    }
  }
}
