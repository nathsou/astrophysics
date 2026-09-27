// The primes p_0 = 2, p_1 = 3, p_2 = 5, … (the book indexes primes from 0).

let sieveLimit = 0;
let primes: number[] = [];

function extend(limit: number) {
  const composite = new Uint8Array(limit + 1);
  const out: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (composite[i]) continue;
    out.push(i);
    for (let j = i * i; j <= limit; j += i) composite[j] = 1;
  }
  primes = out;
  sieveLimit = limit;
}

/** The i-th prime, p_0 = 2. */
export function nthPrime(i: number): number {
  if (!Number.isInteger(i) || i < 0) throw new RangeError(`no prime with index ${i}`);
  while (primes.length <= i) extend(Math.max(1024, sieveLimit * 2));
  return primes[i];
}

/** Natural log of p_i, cheap even for indices beyond the sieve (prime number theorem estimate). */
export function lnPrimeApprox(i: number): number {
  if (i < 200_000) return Math.log(nthPrime(i));
  const n = i + 1;
  return Math.log(n * (Math.log(n) + Math.log(Math.log(n)) - 1));
}

/** ln(p_a · p_{a+1} · … · p_{b-1}) ≈ θ(p_{b-1}) − θ(p_{a-1}), using θ(x) ≈ x. */
export function lnPrimeRangeProductApprox(a: number, b: number): number {
  if (b <= a) return 0;
  if (b - a < 5000 && b < 200_000) {
    let s = 0;
    for (let i = a; i < b; i++) s += Math.log(nthPrime(i));
    return s;
  }
  const p = (k: number) => (k <= 0 ? 0 : Math.exp(lnPrimeApprox(k - 1)));
  return p(b) - p(a);
}
