/** Exact rational numbers on BigInt (numerator / positive denominator, in lowest terms). */

export class Q {
  readonly n: bigint;
  readonly d: bigint;
  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
  }
  static of(n: bigint | number, d: bigint | number = 1n): Q {
    let nn = BigInt(n);
    let dd = BigInt(d);
    if (dd === 0n) throw new Error('division by zero');
    if (dd < 0n) {
      nn = -nn;
      dd = -dd;
    }
    const g = gcd(nn < 0n ? -nn : nn, dd);
    return new Q(g > 1n ? nn / g : nn, g > 1n ? dd / g : dd);
  }
  static readonly ZERO = new Q(0n, 1n);
  static readonly ONE = new Q(1n, 1n);
  add(o: Q): Q {
    return this.d === o.d ? Q.of(this.n + o.n, this.d) : Q.of(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Q): Q {
    return this.d === o.d ? Q.of(this.n - o.n, this.d) : Q.of(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Q): Q {
    return Q.of(this.n * o.n, this.d * o.d);
  }
  div(o: Q): Q {
    return Q.of(this.n * o.d, this.d * o.n);
  }
  neg(): Q {
    return new Q(-this.n, this.d);
  }
  cmp(o: Q): number {
    const l = this.n * o.d;
    const r = o.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  lt(o: Q): boolean {
    return this.cmp(o) < 0;
  }
  le(o: Q): boolean {
    return this.cmp(o) <= 0;
  }
  eq(o: Q): boolean {
    return this.n === o.n && this.d === o.d;
  }
  isZero(): boolean {
    return this.n === 0n;
  }
  isInt(): boolean {
    return this.d === 1n;
  }
  floor(): bigint {
    const q = this.n / this.d;
    return this.n < 0n && q * this.d !== this.n ? q - 1n : q;
  }
  ceil(): bigint {
    const q = this.n / this.d;
    return this.n > 0n && q * this.d !== this.n ? q + 1n : q;
  }
  sign(): number {
    return this.n < 0n ? -1 : this.n > 0n ? 1 : 0;
  }
  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
}

export function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
}
