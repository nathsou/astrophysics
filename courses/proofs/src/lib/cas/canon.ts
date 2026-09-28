/**
 * Canonical forms: turn an expression into a rational function in atoms, applying the rules a
 * learner relies on when doing algebra by hand:
 *
 * - polynomial and rational-function arithmetic over ℚ (expand, collect, cancel by cross-multiplying);
 * - powers with symbolic exponents: 2^(n+1) = 2·2^n, 4^n = (2^n)^2, (2^n)^m = 2^(nm), (ab)^n = a^n b^n;
 * - roots: √8 = 2√2, (√x)^2 = x, 1/√2 = √2/2;
 * - |x|^2 = x^2, and (−1)^(2n) = 1 when n is declared an integer;
 * - factorials and binomials: (n+1)! = (n+1)·n!, binom(n, k) = n!/(k!(n−k)!);
 * - finite sums and products peel off their last terms: Σ_{k=1}^{n+1} f(k) = Σ_{k=1}^{n} f(k) + f(n+1).
 *
 * Anything else (sin, ln, …) becomes an opaque atom keyed by its canonicalised arguments. Two
 * expressions with equal canonical forms are equal wherever both are defined; unequal forms are not
 * proof of inequality (sin²x + cos²x vs 1), which is why check.ts falls back to numerical testing.
 */
import { Rat, bigAbs, bigGcd } from './rational';
import { fn, mul, num, pow, subst, sym, type Expr } from './expr';
import {
  atomPoly,
  constPoly,
  polyAdd,
  polyAtoms,
  polyConst,
  polyKey,
  polyMul,
  polyScale,
  rfAdd,
  rfAsPoly,
  rfConst,
  rfConstValue,
  rfInv,
  rfKey,
  rfMul,
  rfNeg,
  rfNormal,
  rfPoly,
  rfPow,
  type Mono,
  type Poly,
  type RF,
} from './poly';

const MAX_INT_POWER = 64;
const MAX_UNROLL = 40;

function factorial(n: bigint): bigint {
  let r = 1n;
  for (let i = 2n; i <= n; i++) r *= i;
  return r;
}

/** Trial-division factorisation (enough for the constant bases that appear in exercises). */
function smallFactor(n: bigint): Map<bigint, number> {
  const out = new Map<bigint, number>();
  let m = bigAbs(n);
  for (let p = 2n; p * p <= m && p < 100000n; p += p === 2n ? 1n : 2n) {
    while (m % p === 0n) {
      out.set(p, (out.get(p) ?? 0) + 1);
      m /= p;
    }
  }
  if (m > 1n) out.set(m, (out.get(m) ?? 0) + 1);
  return out;
}

/** Largest t with t^q dividing s, and the q-th-power-free rest u (s = t^q · u). */
function extractPower(s: bigint, q: number): { t: bigint; u: bigint } {
  let t = 1n;
  let u = 1n;
  for (const [p, a] of smallFactor(s)) {
    t *= p ** BigInt(Math.floor(a / q));
    u *= p ** BigInt(a % q);
  }
  return { t, u };
}

function floorRat(r: Rat): bigint {
  const q = r.n / r.d;
  return r.n < 0n && q * r.d !== r.n ? q - 1n : q;
}

interface Reduction {
  q: number;
  to: RF;
}

export interface CanonOptions {
  /** Symbols known to be integers (enables (−1)^(2n) = 1). */
  intVars?: Iterable<string>;
}

export class Canon {
  private readonly reductions = new Map<string, Reduction>();
  private readonly intVars: Set<string>;

  constructor(opts: CanonOptions = {}) {
    this.intVars = new Set(opts.intVars ?? []);
  }

  /** Canonical rational function of an expression. Throws RangeError on division by zero. */
  rf(e: Expr): RF {
    switch (e.k) {
      case 'num':
        return rfConst(e.v);
      case 'sym':
        return this.atom(e.name);
      case 'add':
        return e.args.map((a) => this.rf(a)).reduce(rfAdd);
      case 'mul':
        return this.reduce(e.args.map((a) => this.rf(a)).reduce(rfMul));
      case 'pow':
        return this.power(e.base, e.exp);
      case 'fn':
        return this.func(e.name, e.args);
    }
  }

  /** Are two expressions equal as rational functions (after the rewrite rules)? */
  equal(a: Expr, b: Expr): boolean {
    const x = this.rf(a);
    const y = this.rf(b);
    const diff = this.reduce(rfAdd(x, rfNeg(y)));
    return diff.num.size === 0;
  }

  key(e: Expr): string {
    return rfKey(this.rf(e));
  }

  private atom(key: string, reduction?: Reduction): RF {
    if (reduction) this.reductions.set(key, reduction);
    return rfPoly(atomPoly(key));
  }

  // ── Powers ──────────────────────────────────────────────────────────────────

  private power(baseE: Expr, expE: Expr): RF {
    const ex = this.rf(expE);
    const c = rfConstValue(ex);
    // (b^e1)^e2 = b^(e1·e2), except when that would turn (x²)^(1/2) into x.
    if (baseE.k === 'pow' && !(c && !c.isInt())) return this.power(baseE.base, mul(baseE.exp, expE));
    const b = this.rf(baseE);
    if (c) {
      if (c.isInt()) {
        const k = Number(c.n);
        const bc = rfConstValue(b);
        if (Math.abs(k) <= MAX_INT_POWER || (bc && Math.abs(k) <= 4096)) return this.reduce(rfPow(b, k));
        return this.atom(`pow(${rfKey(b)},${c})`);
      }
      return this.fractionalPower(b, c);
    }
    const ep = rfAsPoly(ex);
    if (!ep) return this.atom(`pow(${rfKey(b)},${rfKey(ex)})`);
    // Split the constant part of the exponent: b^(n + 3/2) = b · b^(1/2) · b^n.
    const c0 = ep.get('')?.c ?? Rat.ZERO;
    const whole = floorRat(c0);
    const frac = c0.sub(Rat.of(whole));
    const rest: Poly = new Map(ep);
    rest.delete('');
    let out = this.reduce(rfPow(b, Number(whole)));
    if (!frac.isZero()) out = this.reduce(rfMul(out, this.fractionalPower(b, frac)));
    return this.reduce(rfMul(out, this.symbolicPower(b, rest)));
  }

  /**
   * b^e for an exponent polynomial e with no constant term. Each monomial of the exponent gets its
   * own atom, so b^(n+m) = b^n·b^m and b^(2n) = (b^n)^2.
   */
  private symbolicPower(b: RF, e: Poly): RF {
    let out = rfConst(Rat.ONE);
    for (const t of e.values()) out = this.reduce(rfMul(out, this.raise(this.monoPower(b, t.mono), t.c)));
    return out;
  }

  /** r^c for a rational c. */
  private raise(r: RF, c: Rat): RF {
    if (c.isInt()) return this.reduce(rfPow(r, Number(c.n)));
    return this.fractionalPower(r, c);
  }

  /** b^m for a single exponent monomial m (coefficient 1). */
  private monoPower(b: RF, m: Mono): RF {
    const mono: Mono = new Map(m);
    const eKey = polyKey(new Map([['', { mono, c: Rat.ONE }]])).replace(/^1\*/, '');
    const intExponent = [...mono.keys()].every((a) => this.intVars.has(a));
    const bc = rfConstValue(b);
    if (bc) {
      if (bc.isZero()) return this.atom(`pow(0,${eKey})`);
      if (bc.isOne()) return rfConst(Rat.ONE);
      let out = rfConst(Rat.ONE);
      if (bc.sign() < 0) out = this.atom(`pow(-1,${eKey})`, intExponent ? { q: 2, to: rfConst(Rat.ONE) } : undefined);
      // Prime-power normal form: 12^n = (2^n)^2 · 3^n.
      for (const [p, a] of smallFactor(bc.n)) out = rfMul(out, rfPow(this.atom(`pow(${p},${eKey})`), a));
      for (const [p, a] of smallFactor(bc.d)) out = rfMul(out, rfPow(this.atom(`pow(${p},${eKey})`), -a));
      return this.reduce(out);
    }
    // A monomial base splits: (3x²y)^n = 3^n (x^n)^2 y^n.
    const bp = rfAsPoly(b);
    if (bp && bp.size === 1) {
      const t = [...bp.values()][0]!;
      let out = t.c.isOne() ? rfConst(Rat.ONE) : this.monoPower(rfConst(t.c), m);
      for (const [atom, a] of t.mono) out = rfMul(out, rfPow(this.atom(`pow(${atom},${eKey})`), a));
      return this.reduce(out);
    }
    return this.atom(`pow(${rfKey(b)},${eKey})`);
  }

  /** b^(p/q) for a non-integer rational exponent. */
  private fractionalPower(b: RF, c: Rat): RF {
    const q = Number(c.d);
    const whole = floorRat(c);
    const m = Number(c.n - whole * c.d); // 0 < m < q
    const root = this.root(b, q);
    return this.reduce(rfMul(rfPow(b, Number(whole)), rfPow(root, m)));
  }

  /** The principal q-th root of b, as an atom with the reduction A^q = b. */
  private root(b: RF, q: number): RF {
    const bc = rfConstValue(b);
    if (bc) {
      if (bc.isZero()) return rfConst(Rat.ZERO);
      const negative = bc.sign() < 0;
      if (negative && q % 2 === 0) return this.atom(`root(${q},${bc})`, { q, to: rfConst(bc) });
      const abs = negative ? bc.neg() : bc;
      // (n/d)^(1/q) = (n·d^(q−1))^(1/q) / d
      const s = abs.n * abs.d ** BigInt(q - 1);
      const { t, u } = extractPower(s, q);
      let out = rfConst(Rat.of(t, abs.d));
      if (u !== 1n) out = rfMul(out, this.atom(`root(${q},${u})`, { q, to: rfConst(Rat.of(u)) }));
      return negative ? rfMul(out, rfConst(Rat.MINUS_ONE)) : out;
    }
    return this.atom(`root(${q},${rfKey(b)})`, { q, to: b });
  }

  // ── Functions ───────────────────────────────────────────────────────────────

  private func(name: string, args: Expr[]): RF {
    switch (name) {
      case 'pi':
      case 'e':
        return this.atom(name);
      case 'exp':
        return this.power(fn('e'), args[0]!);
      case 'fact':
        return this.factorial(args[0]!);
      case 'binom': {
        const [n, k] = args as [Expr, Expr];
        const nc = rfConstValue(this.rf(n));
        const kc = rfConstValue(this.rf(k));
        if (nc?.isInt() && kc?.isInt() && nc.n >= 0n) {
          if (kc.n < 0n || kc.n > nc.n) return rfConst(Rat.ZERO);
          return rfConst(Rat.of(factorial(nc.n) / (factorial(kc.n) * factorial(nc.n - kc.n))));
        }
        const nMinusK = { k: 'add', args: [n, mul(num(-1), k)] } as Expr;
        return this.reduce(rfMul(this.factorial(n), rfInv(rfMul(this.factorial(k), this.factorial(nMinusK)))));
      }
      case 'abs': {
        const a = this.rf(args[0]!);
        const ac = rfConstValue(a);
        if (ac) return rfConst(ac.sign() < 0 ? ac.neg() : ac);
        // |−x| = |x|: key on the sign-normalised argument.
        const p = rfAsPoly(a);
        let keyed = a;
        if (p) {
          const first = [...p.entries()].sort(([x], [y]) => (x < y ? -1 : 1))[0]![1];
          if (first.c.sign() < 0) keyed = rfPoly(polyScale(p, Rat.MINUS_ONE));
        }
        return this.atom(`abs(${rfKey(keyed)})`, { q: 2, to: rfMul(a, a) });
      }
      case 'sum':
      case 'prod':
        return this.bigOp(name, args);
      case 'floor':
      case 'ceil':
      case 'gcd':
      case 'lcm':
      case 'max':
      case 'min':
      case 'mod': {
        const vals = args.map((a) => rfConstValue(this.rf(a)));
        if (vals.every((v) => v !== null)) {
          const exact = exactFunction(name, vals as Rat[]);
          if (exact) return rfConst(exact);
        }
        break;
      }
      case 'sin':
      case 'tan':
      case 'ln':
      case 'log': {
        const v = rfConstValue(this.rf(args[0]!));
        if (v && (name === 'ln' || name === 'log' ? v.isOne() : v.isZero())) return rfConst(Rat.ZERO);
        break;
      }
      case 'cos': {
        const v = rfConstValue(this.rf(args[0]!));
        if (v?.isZero()) return rfConst(Rat.ONE);
        break;
      }
    }
    return this.atom(`${name}(${args.map((a) => rfKey(this.rf(a))).join(',')})`);
  }

  /** n! with n = base + c for an integer c: (base + c)! = (base+1)…(base+c)·base!. */
  private factorial(arg: Expr): RF {
    const a = this.rf(arg);
    const ac = rfConstValue(a);
    if (ac?.isInt() && ac.n >= 0n && ac.n <= 500n) return rfConst(Rat.of(factorial(ac.n)));
    const p = rfAsPoly(a);
    if (!p) return this.atom(`fact(${rfKey(a)})`);
    const c0 = p.get('')?.c ?? Rat.ZERO;
    if (!c0.isInt() || Math.abs(Number(c0.n)) > MAX_UNROLL) return this.atom(`fact(${polyKey(p)})`);
    const base: Poly = new Map(p);
    base.delete('');
    const k = Number(c0.n);
    const f = this.atom(`fact(${polyKey(base)})`);
    const shifted = (i: number) => rfPoly(polyAdd(base, constPoly(Rat.of(i))));
    let out = f;
    if (k > 0) for (let i = 1; i <= k; i++) out = rfMul(out, shifted(i));
    else for (let i = 0; i < -k; i++) out = rfMul(out, rfInv(shifted(-i)));
    return this.reduce(out);
  }

  /** sum(body, k, from, to) and prod(…): peel constant offsets off the upper limit. */
  private bigOp(name: 'sum' | 'prod', args: Expr[]): RF {
    const [body, v, from, to] = args as [Expr, Expr, Expr, Expr];
    if (v.k !== 'sym') return this.atom(`${name}(?)`);
    const lo = rfConstValue(this.rf(from));
    const hi = this.rf(to);
    const hc = rfConstValue(hi);
    const combine = name === 'sum' ? rfAdd : rfMul;
    const unit = rfConst(name === 'sum' ? Rat.ZERO : Rat.ONE);
    const at = (x: Expr) => this.rf(subst(body, { [v.name]: x }));
    // Fully constant limits: expand (if not too long).
    if (lo?.isInt() && hc?.isInt() && hc.n - lo.n < 200n) {
      let out = unit;
      for (let i = lo.n; i <= hc.n; i++) out = combine(out, at(num(i)));
      return this.reduce(out);
    }
    const hp = rfAsPoly(hi);
    const c0 = hp?.get('')?.c ?? Rat.ZERO;
    // Rename the bound variable so Σ_k f(k) and Σ_j f(j) get the same key.
    const bodyKey = rfKey(this.rf(subst(body, { [v.name]: sym('#') })));
    const key = (upper: string) => `${name}(${bodyKey},${rfKey(this.rf(from))},${upper})`;
    if (!hp || !c0.isInt() || Math.abs(Number(c0.n)) > MAX_UNROLL) return this.atom(key(rfKey(hi)));
    const base: Poly = new Map(hp);
    base.delete('');
    const k = Number(c0.n);
    let out = this.atom(key(polyKey(base)));
    const baseE = polyToExpr(base);
    const term = (i: number) => at({ k: 'add', args: [baseE, num(i)] });
    if (k > 0) for (let i = 1; i <= k; i++) out = combine(out, term(i));
    else
      for (let i = 0; i < -k; i++) {
        const t = term(-i);
        out = name === 'sum' ? rfAdd(out, { num: polyScale(t.num, Rat.MINUS_ONE), den: t.den }) : rfMul(out, rfInv(t));
      }
    return this.reduce(out);
  }

  // ── Reductions ──────────────────────────────────────────────────────────────

  /** Apply A^q → value for every root-like atom whose exponent reached q. */
  reduce(r: RF): RF {
    if (this.reductions.size === 0) return r;
    const n = this.reducePoly(r.num);
    const d = this.reducePoly(r.den);
    if (!n && !d) return r;
    const nn = n ?? rfPoly(r.num);
    const dd = d ?? rfPoly(r.den);
    return rfNormal({ num: polyMul(nn.num, dd.den), den: polyMul(nn.den, dd.num) });
  }

  private reducePoly(p: Poly, depth = 0): RF | null {
    let changed = false;
    let out = rfConst(Rat.ZERO);
    for (const t of p.values()) {
      let hit: [string, Reduction, number] | undefined;
      for (const [a, e] of t.mono) {
        const red = this.reductions.get(a);
        if (red && e >= red.q) {
          hit = [a, red, e];
          break;
        }
      }
      if (!hit) {
        out = rfAdd(out, rfPoly(singleTerm(t.mono, t.c)));
        continue;
      }
      changed = true;
      const [a, red, e] = hit;
      const mono: Mono = new Map(t.mono);
      const rem = e % red.q;
      if (rem) mono.set(a, rem);
      else mono.delete(a);
      let term = rfMul(rfPoly(singleTerm(mono, t.c)), rfPow(red.to, Math.floor(e / red.q)));
      if (depth < 8) {
        const again = this.reducePoly(term.num, depth + 1);
        if (again) term = rfNormal({ num: polyMul(again.num, term.den), den: again.den });
      }
      out = rfAdd(out, term);
    }
    return changed ? out : null;
  }
}

function singleTerm(mono: Mono, c: Rat): Poly {
  const p: Poly = new Map();
  const key = [...mono.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, e]) => (e === 1 ? k : `${k}^${e}`))
    .join('*');
  if (!c.isZero()) p.set(key, { mono, c });
  return p;
}

/** Rebuild an expression from a polynomial whose atoms are plain symbols. */
function polyToExpr(p: Poly): Expr {
  const terms: Expr[] = [];
  for (const t of p.values()) {
    const factors: Expr[] = [num(t.c)];
    for (const [a, e] of t.mono) factors.push(e === 1 ? sym(a) : pow(sym(a), num(e)));
    terms.push(mul(...factors));
  }
  return terms.length === 0 ? num(0) : terms.length === 1 ? terms[0]! : { k: 'add', args: terms };
}

function exactFunction(name: string, v: Rat[]): Rat | null {
  const ints = v.every((x) => x.isInt());
  switch (name) {
    case 'floor':
      return Rat.of(floorRat(v[0]!));
    case 'ceil':
      return Rat.of(-floorRat(v[0]!.neg()));
    case 'max':
      return v.reduce((a, b) => (a.cmp(b) >= 0 ? a : b));
    case 'min':
      return v.reduce((a, b) => (a.cmp(b) <= 0 ? a : b));
    case 'gcd':
      return ints ? Rat.of(bigGcd(v[0]!.n, v[1]!.n)) : null;
    case 'lcm': {
      if (!ints) return null;
      const g = bigGcd(v[0]!.n, v[1]!.n);
      return g === 0n ? Rat.ZERO : Rat.of(bigAbs(v[0]!.n * v[1]!.n) / g);
    }
    case 'mod': {
      if (!ints || v[1]!.n === 0n) return null;
      const m = bigAbs(v[1]!.n);
      return Rat.of(((v[0]!.n % m) + m) % m);
    }
  }
  return null;
}
