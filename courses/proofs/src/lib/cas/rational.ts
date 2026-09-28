/**
 * Exact rational numbers on BigInt. Always normalised: gcd(num, den) = 1 and den > 0.
 */

export function bigAbs(a: bigint): bigint {
  return a < 0n ? -a : a;
}

export function bigGcd(a: bigint, b: bigint): bigint {
  a = bigAbs(a);
  b = bigAbs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export class Rat {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
  }

  static of(n: bigint | number, d: bigint | number = 1n): Rat {
    let nn = BigInt(n);
    let dd = BigInt(d);
    if (dd === 0n) throw new RangeError('Division by zero');
    if (dd < 0n) {
      nn = -nn;
      dd = -dd;
    }
    const g = bigGcd(nn, dd) || 1n;
    return new Rat(nn / g, dd / g);
  }

  /** Parse "12", "-3/4" or a finite decimal such as "0.125" exactly. */
  static parse(s: string): Rat {
    const t = s.trim();
    const frac = /^([+-]?\d+)\s*\/\s*(\d+)$/.exec(t);
    if (frac) return Rat.of(BigInt(frac[1]!), BigInt(frac[2]!));
    const dec = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(t);
    if (!dec || (dec[2] === '' && !dec[3])) throw new SyntaxError(`Not a number: ${s}`);
    const digits = (dec[2] || '0') + (dec[3] ?? '');
    const scale = 10n ** BigInt((dec[3] ?? '').length);
    return Rat.of((dec[1] === '-' ? -1n : 1n) * BigInt(digits), scale);
  }

  static readonly ZERO = Rat.of(0);
  static readonly ONE = Rat.of(1);
  static readonly MINUS_ONE = Rat.of(-1);

  add(o: Rat): Rat {
    return Rat.of(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Rat): Rat {
    return Rat.of(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Rat): Rat {
    return Rat.of(this.n * o.n, this.d * o.d);
  }
  div(o: Rat): Rat {
    return Rat.of(this.n * o.d, this.d * o.n);
  }
  neg(): Rat {
    return new Rat(-this.n, this.d);
  }
  inv(): Rat {
    return Rat.of(this.d, this.n);
  }
  /** Integer power (negative exponents allowed for non-zero values). */
  pow(k: number): Rat {
    if (k < 0) return this.inv().pow(-k);
    return Rat.of(this.n ** BigInt(k), this.d ** BigInt(k));
  }
  cmp(o: Rat): number {
    const x = this.n * o.d - o.n * this.d;
    return x < 0n ? -1 : x > 0n ? 1 : 0;
  }
  eq(o: Rat): boolean {
    return this.n === o.n && this.d === o.d;
  }
  isZero(): boolean {
    return this.n === 0n;
  }
  isOne(): boolean {
    return this.n === 1n && this.d === 1n;
  }
  isInt(): boolean {
    return this.d === 1n;
  }
  sign(): number {
    return this.n < 0n ? -1 : this.n > 0n ? 1 : 0;
  }
  toNumber(): number {
    // Scale down huge values before converting so the ratio stays accurate.
    const n = this.n;
    const d = this.d;
    const bits = Math.max(n.toString(2).length, d.toString(2).length) - 900;
    if (bits > 0) return Number(n >> BigInt(bits)) / Number(d >> BigInt(bits));
    return Number(n) / Number(d);
  }
  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
  toTex(): string {
    if (this.d === 1n) return this.n.toString();
    const s = this.n < 0n ? '-' : '';
    return `${s}\\frac{${bigAbs(this.n)}}{${this.d}}`;
  }
}
