// Exact arithmetic for the second half of Book X (X.41–84 and after).
//
// Every magnitude in these propositions, measured against a rational line ρ = 1, has a square (or,
// for areas, a value) of the form  c₁√n₁ + c₂√n₂ + …  with rational cᵢ and distinct square-free nᵢ.
// Such sums form a ring (√n·√m = √(nm) reduces to a rational times a square-free root), and the
// square roots of distinct square-free integers are linearly independent over the rationals. So two
// such sums have a rational ratio exactly when their coefficient vectors are proportional, which is
// all that commensurability needs. The figures use this to check Euclid's classifications exactly,
// rather than guessing irrationality from floating-point numbers.
//
// Conventions:
//   - an area is a Surd (its value);
//   - a line is represented by its square, a Surd (a line l with l² = M);
//   - "rational" and "medial" are relative to ρ = 1.

import { Degenerate } from '../../geometry/vec';

// ------------------------------------------------------------------ rationals (bigint)

const babs = (a: bigint) => (a < 0n ? -a : a);
const bgcd = (a: bigint, b: bigint): bigint => {
  a = babs(a);
  b = babs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

export class Rat {
  readonly p: bigint;
  readonly q: bigint;
  constructor(p: bigint | number, q: bigint | number = 1n) {
    let pp = BigInt(p);
    let qq = BigInt(q);
    if (qq === 0n) throw new Degenerate('division by zero');
    if (qq < 0n) {
      pp = -pp;
      qq = -qq;
    }
    const g = bgcd(pp, qq) || 1n;
    this.p = pp / g;
    this.q = qq / g;
  }
  static of(x: number | Rat): Rat {
    if (x instanceof Rat) return x;
    if (Number.isInteger(x)) return new Rat(x);
    // a slider value with a few decimals (0.5, 0.25, 1.75 …)
    for (let d = 2; d <= 1000; d++) if (Number.isInteger(Math.round(x * d)) && Math.abs(Math.round(x * d) - x * d) < 1e-9) return new Rat(Math.round(x * d), d);
    throw new Error(`not a simple rational: ${x}`);
  }
  add(o: Rat) {
    return new Rat(this.p * o.q + o.p * this.q, this.q * o.q);
  }
  sub(o: Rat) {
    return new Rat(this.p * o.q - o.p * this.q, this.q * o.q);
  }
  mul(o: Rat) {
    return new Rat(this.p * o.p, this.q * o.q);
  }
  div(o: Rat) {
    return new Rat(this.p * o.q, this.q * o.p);
  }
  get zero() {
    return this.p === 0n;
  }
  get value() {
    return Number(this.p) / Number(this.q);
  }
  eq(o: Rat) {
    return this.p === o.p && this.q === o.q;
  }
  /** The ratio of a square number to a square number. */
  get square(): boolean {
    return this.p >= 0n && isSq(this.p) && isSq(this.q);
  }
  toString(): string {
    return this.q === 1n ? `${this.p}` : `${this.p}/${this.q}`;
  }
}

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x--;
  while ((x + 1n) * (x + 1n) <= n) x++;
  return x;
}
const isSq = (n: bigint) => n >= 0n && isqrt(n) ** 2n === n;

/** n = out² · inn with inn square-free (n > 0). */
function splitSquare(n: bigint): [bigint, bigint] {
  let out = 1n;
  let inn = n;
  for (let d = 2n; d * d <= inn; d++) {
    while (inn % (d * d) === 0n) {
      inn /= d * d;
      out *= d;
    }
  }
  return [out, inn];
}

// ------------------------------------------------------------------ sums of roots

/** Σ c·√n over square-free n (keys as decimal strings of n). */
export class Surd {
  readonly t: ReadonlyMap<string, Rat>;
  private constructor(t: Map<string, Rat>) {
    for (const [k, c] of t) if (c.zero) t.delete(k);
    this.t = t;
  }
  static rat(x: number | Rat): Surd {
    return new Surd(new Map([['1', Rat.of(x)]]));
  }
  static frac(p: number, q: number): Surd {
    return Surd.rat(new Rat(p, q));
  }
  /** √x for a non-negative rational x, simplified. */
  static root(x: number | Rat): Surd {
    const r = Rat.of(x);
    if (r.p < 0n) throw new Degenerate('root of a negative number');
    if (r.zero) return Surd.rat(0);
    // √(p/q) = √(p·q)/q
    const [out, inn] = splitSquare(r.p * r.q);
    return new Surd(new Map([[inn.toString(), new Rat(out, r.q)]]));
  }
  add(o: Surd): Surd {
    const m = new Map(this.t);
    for (const [k, c] of o.t) m.set(k, (m.get(k) ?? new Rat(0)).add(c));
    return new Surd(m);
  }
  sub(o: Surd): Surd {
    return this.add(o.scale(-1));
  }
  scale(x: number | Rat): Surd {
    const r = Rat.of(x);
    return new Surd(new Map([...this.t].map(([k, c]) => [k, c.mul(r)])));
  }
  mul(o: Surd): Surd {
    let out = Surd.rat(0);
    for (const [k1, c1] of this.t)
      for (const [k2, c2] of o.t) {
        const [s, inn] = splitSquare(BigInt(k1) * BigInt(k2));
        out = out.add(new Surd(new Map([[inn.toString(), c1.mul(c2).mul(new Rat(s))]])));
      }
    return out;
  }
  get value(): number {
    let s = 0;
    for (const [k, c] of this.t) s += c.value * Math.sqrt(Number(k));
    return s;
  }
  get zero(): boolean {
    return this.t.size === 0;
  }
  /** The rational value, if this is rational. */
  get rational(): Rat | null {
    if (this.zero) return new Rat(0);
    if (this.t.size === 1 && this.t.has('1')) return this.t.get('1')!;
    return null;
  }
  eq(o: Surd): boolean {
    return this.sub(o).zero;
  }
  /** this : o, if it is a ratio of numbers (the coefficient vectors are proportional). */
  ratio(o: Surd): Rat | null {
    if (o.zero || this.zero) return null;
    if (this.t.size !== o.t.size) return null;
    let r: Rat | null = null;
    for (const [k, c] of this.t) {
      const d = o.t.get(k);
      if (!d) return null;
      const q = c.div(d);
      if (r && !r.eq(q)) return null;
      r = q;
    }
    return r;
  }
  toString(): string {
    if (this.zero) return '0';
    const keys = [...this.t.keys()].sort((a, b) => Number(a) - Number(b));
    let s = '';
    keys.forEach((k, i) => {
      const c = this.t.get(k)!;
      const neg = c.p < 0n;
      const a = neg ? new Rat(-c.p, c.q) : c;
      let term: string;
      if (k === '1') term = a.toString();
      else {
        const num = a.p === 1n ? '' : `${a.p}`;
        term = `${num}√${k}${a.q === 1n ? '' : `/${a.q}`}`;
      }
      s += i === 0 ? (neg ? `−${term}` : term) : neg ? ` − ${term}` : ` + ${term}`;
    });
    return s;
  }
}

// ------------------------------------------------------------------ Euclid's predicates

/** Areas (given by their values). */
export const area = {
  rational: (a: Surd) => a.rational !== null && !a.zero,
  /** a² is rational but a is not: the area of a rectangle on two rational lines commensurable in square only. */
  medial: (a: Surd) => a.rational === null && a.mul(a).rational !== null,
  comm: (a: Surd, b: Surd) => a.ratio(b) !== null,
};

/** Lines (given by their squares). */
export const line = {
  rational: (m: Surd) => m.rational !== null && !m.zero,
  /** The square is a medial area. */
  medial: (m: Surd) => area.medial(m),
  /** Commensurable in length: the squares have the ratio of a square number to a square number. */
  comm: (m: Surd, n: Surd) => m.ratio(n)?.square ?? false,
  /** Commensurable in square. */
  commSq: (m: Surd, n: Surd) => m.ratio(n) !== null,
  /** Commensurable in square only. */
  commSqOnly: (m: Surd, n: Surd) => m.ratio(n) !== null && !m.ratio(n)!.square,
  /** Incommensurable in square. */
  incommSq: (m: Surd, n: Surd) => m.ratio(n) === null,
};

/** A line as text, from its square: "3", "√5", "√(2 + √3)". */
export function lineText(m: Surd): string {
  const r = m.rational;
  if (r) {
    if (r.square) return new Rat(isqrt(r.p), isqrt(r.q)).toString();
    return Surd.root(r).toString();
  }
  return `√(${m})`;
}

/** Throw Degenerate unless `ok` (a hypothesis the sliders failed to meet). */
export function need(ok: boolean, why: string): void {
  if (!ok) throw new Degenerate(why);
}

export const isSquareInt = (n: number) => n >= 0 && Math.round(Math.sqrt(n)) ** 2 === n;
