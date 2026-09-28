/**
 * Number theory on BigInt: gcd and Bézout, modular arithmetic, primality, factorisation,
 * Legendre/Jacobi symbols, continued fractions and friends.
 */

export const abs = (a: bigint) => (a < 0n ? -a : a);

export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: bigint, b: bigint): bigint {
  return a === 0n || b === 0n ? 0n : abs(a * b) / gcd(a, b);
}

/** Euclidean division with a non-negative remainder. */
export function divmod(a: bigint, m: bigint): [bigint, bigint] {
  let r = a % m;
  if (r < 0n) r += abs(m);
  return [(a - r) / m, r];
}

export const mod = (a: bigint, m: bigint) => divmod(a, m)[1];

/** One step of Euclid's algorithm, for visualisations: a = q·b + r. */
export interface EuclidStep {
  a: bigint;
  b: bigint;
  q: bigint;
  r: bigint;
}

export function euclidSteps(a: bigint, b: bigint): EuclidStep[] {
  const steps: EuclidStep[] = [];
  a = abs(a);
  b = abs(b);
  while (b) {
    const [q, r] = divmod(a, b);
    steps.push({ a, b, q, r });
    [a, b] = [b, r];
  }
  return steps;
}

/** Extended Euclid: returns [g, x, y] with a·x + b·y = g = gcd(a, b). */
export function egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  let [oldR, r] = [a, b];
  let [oldS, s] = [1n, 0n];
  let [oldT, t] = [0n, 1n];
  while (r) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  if (oldR < 0n) return [-oldR, -oldS, -oldT];
  return [oldR, oldS, oldT];
}

export function modInv(a: bigint, m: bigint): bigint | null {
  const [g, x] = egcd(mod(a, m), m);
  return g === 1n ? mod(x, m) : null;
}

export function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  if (m === 1n) return 0n;
  let r = 1n;
  let b = mod(base, m);
  let e = exp;
  if (e < 0n) {
    const inv = modInv(b, m);
    if (inv === null) throw new RangeError('No inverse');
    b = inv;
    e = -e;
  }
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}

const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

/** Miller–Rabin with the first 12 primes as bases: deterministic below 3.3·10^24. */
export function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of SMALL_PRIMES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }
  witness: for (const a of SMALL_PRIMES) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < s; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue witness;
    }
    return false;
  }
  return true;
}

/** Fermat test to base a: does a^(n−1) ≡ 1 (mod n)? */
export function fermatPasses(n: bigint, a: bigint): boolean {
  return modPow(a, n - 1n, n) === 1n;
}

function pollardRho(n: bigint): bigint {
  if (n % 2n === 0n) return 2n;
  for (let c = 1n; ; c++) {
    const f = (x: bigint) => (x * x + c) % n;
    let x = 2n;
    let y = 2n;
    let d = 1n;
    while (d === 1n) {
      x = f(x);
      y = f(f(y));
      d = gcd(x - y, n);
    }
    if (d !== n) return d;
  }
}

/**
 * Smallest prime factor, or null if not found within the effort budget (for numbers too large to
 * factor quickly in a browser).
 */
export function smallestPrimeFactor(n: bigint, budget = 200_000): bigint | null {
  n = abs(n);
  if (n < 2n) return null;
  for (let p = 2n; p < 10_000n; p += p === 2n ? 1n : 2n) {
    if (p * p > n) return n;
    if (n % p === 0n) return p;
  }
  if (isPrime(n)) return n;
  // Pollard rho finds some factor; recurse on the pieces and keep the smallest prime.
  let best: bigint | null = null;
  const stack = [n];
  let spent = 0;
  while (stack.length) {
    const m = stack.pop()!;
    if (isPrime(m)) {
      if (best === null || m < best) best = m;
      continue;
    }
    let d: bigint | null = null;
    for (let c = 1n; c < 20n && d === null; c++) {
      let x = 2n;
      let y = 2n;
      let g = 1n;
      while (g === 1n && spent < budget) {
        x = (x * x + c) % m;
        y = (y * y + c) % m;
        y = (y * y + c) % m;
        g = gcd(x - y, m);
        spent++;
      }
      if (g !== 1n && g !== m) d = g;
      if (spent >= budget) return null;
    }
    if (d === null) return null;
    stack.push(d, m / d);
  }
  return best;
}

/** Prime factorisation as a sorted map prime → exponent. */
export function factor(n: bigint): Map<bigint, number> {
  const out = new Map<bigint, number>();
  const add = (p: bigint) => out.set(p, (out.get(p) ?? 0) + 1);
  n = abs(n);
  if (n < 2n) return out;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n]) {
    while (n % p === 0n) {
      add(p);
      n /= p;
    }
  }
  for (let p = 17n; p * p <= n && p < 10000n; p += 2n) {
    while (n % p === 0n) {
      add(p);
      n /= p;
    }
  }
  const stack = n > 1n ? [n] : [];
  while (stack.length) {
    const m = stack.pop()!;
    if (m === 1n) continue;
    if (isPrime(m)) add(m);
    else {
      const d = pollardRho(m);
      stack.push(d, m / d);
    }
  }
  return new Map([...out.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}

export function factorTex(n: bigint): string {
  const f = factor(n);
  if (f.size === 0) return n.toString();
  return [...f].map(([p, e]) => (e === 1 ? `${p}` : `${p}^{${e}}`)).join(' \\cdot ');
}

export function totient(n: bigint): bigint {
  let r = n;
  for (const p of factor(n).keys()) r = (r / p) * (p - 1n);
  return r;
}

export function divisors(n: bigint): bigint[] {
  let ds = [1n];
  for (const [p, e] of factor(n)) {
    const next: bigint[] = [];
    for (const d of ds) {
      let pk = 1n;
      for (let i = 0; i <= e; i++) {
        next.push(d * pk);
        pk *= p;
      }
    }
    ds = next;
  }
  return ds.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Jacobi symbol (a/n) for odd n > 0; equals the Legendre symbol when n is prime. */
export function jacobi(a: bigint, n: bigint): number {
  if (n <= 0n || n % 2n === 0n) throw new RangeError('n must be odd and positive');
  a = mod(a, n);
  let t = 1;
  while (a !== 0n) {
    while (a % 2n === 0n) {
      a /= 2n;
      const r = n % 8n;
      if (r === 3n || r === 5n) t = -t;
    }
    [a, n] = [n, a];
    if (a % 4n === 3n && n % 4n === 3n) t = -t;
    a %= n;
  }
  return n === 1n ? t : 0;
}

/** Sieve of Eratosthenes up to n (numbers, for visualisations). */
export function primesUpTo(n: number): number[] {
  if (n < 2) return [];
  const sieve = new Uint8Array(n + 1);
  const out: number[] = [];
  for (let i = 2; i <= n; i++) {
    if (sieve[i]) continue;
    out.push(i);
    for (let j = i * i; j <= n; j += i) sieve[j] = 1;
  }
  return out;
}

/** Continued fraction of a rational p/q. */
export function continuedFraction(p: bigint, q: bigint): bigint[] {
  const out: bigint[] = [];
  while (q) {
    const [a, r] = divmod(p, q);
    out.push(a);
    [p, q] = [q, r];
  }
  return out;
}

/** Continued fraction of a real number (floating point, so only the first terms are reliable). */
export function continuedFractionReal(x: number, terms = 12): number[] {
  const out: number[] = [];
  for (let i = 0; i < terms; i++) {
    const a = Math.floor(x);
    out.push(a);
    const frac = x - a;
    if (frac < 1e-12) break;
    x = 1 / frac;
  }
  return out;
}

/** Convergents p_k/q_k of a continued fraction. */
export function convergents(cf: (number | bigint)[]): [bigint, bigint][] {
  const out: [bigint, bigint][] = [];
  let [p0, p1] = [1n, BigInt(cf[0]!)];
  let [q0, q1] = [0n, 1n];
  out.push([p1, q1]);
  for (let i = 1; i < cf.length; i++) {
    const a = BigInt(cf[i]!);
    [p0, p1] = [p1, a * p1 + p0];
    [q0, q1] = [q1, a * q1 + q0];
    out.push([p1, q1]);
  }
  return out;
}

/** Integer square root (floor). */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError('Negative');
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x--;
  while ((x + 1n) * (x + 1n) <= n) x++;
  return x;
}

/** Write p as x² + y² (p prime ≡ 1 mod 4, or 2), via Zagier's involution's fixed point… or search. */
export function twoSquares(n: bigint): [bigint, bigint] | null {
  for (let x = 0n; 2n * x * x <= n; x++) {
    const r = n - x * x;
    const y = isqrt(r);
    if (y * y === r) return [x, y];
  }
  return null;
}
