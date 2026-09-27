// Exact, symbolic natural numbers.
//
// Gödel numbers are astronomically large: the formula =(v0,c0) already has a Gödel number with
// more than half a million decimal digits, and the numeral for that number, placed inside
// another formula, gives a Gödel number whose *number of digits* has half a million digits.
// Such numbers are never expanded. A `Nat` is an exact description of a natural number as an
// expression tree (literals, sequence codes, powers, products, sums, and named numbers such as
// ⌜Prov(x)⌝ whose value is not spelled out); it is evaluated to a bigint only when it is small.

import { lnPrimeApprox, lnPrimeRangeProductApprox, nthPrime } from './primes.ts';

export type Nat =
  | { k: 'lit'; v: bigint }
  /** The code ⟨a_0, …, a_{n-1}⟩ = p_0^{a_0+1} · … · p_{n-1}^{a_{n-1}+1} of a sequence (⟨⟩ = 0, the book's Λ). */
  | { k: 'seq'; parts: SeqPart[] }
  | { k: 'pow'; base: Nat; exp: Nat }
  | { k: 'mul'; fs: Nat[] }
  | { k: 'add'; ts: Nat[] }
  /**
   * A number known by name only, e.g. the Gödel number of the formula Prov(x), which exists and
   * is primitive recursively computable but is far too long to write down. `seq` records that it
   * is the code of a sequence (so it can be spliced into other sequences). `atLeast` is a number
   * it is known to be at least (e.g. a sequence code whose elements it contains, in order).
   */
  | { k: 'named'; name: string; tex: string; seq?: boolean; atLeast?: Nat };

export type SeqPart =
  | { k: 'item'; v: Nat }
  /** `items` repeated `times` times (used for numerals: n ticks). */
  | { k: 'run'; times: Nat; items: Nat[] }
  /** All elements of another sequence code (concatenation). */
  | { k: 'splice'; seq: Nat };

export const lit = (v: bigint | number): Nat => ({ k: 'lit', v: BigInt(v) });
export const named = (name: string, tex: string, seq = false): Nat => ({ k: 'named', name, tex, seq });
export const seqOf = (items: Nat[]): Nat => ({ k: 'seq', parts: items.map((v) => ({ k: 'item', v })) });
export const seqLit = (items: (bigint | number)[]): Nat => seqOf(items.map((v) => lit(v)));

export function isLit(n: Nat): n is { k: 'lit'; v: bigint } {
  return n.k === 'lit';
}

// ------------------------------------------------------------------ exact arithmetic on bigints

/** ⟨a_0, …, a_{n-1}⟩ on concrete numbers. */
export function encodeSeq(items: readonly bigint[]): bigint {
  if (items.length === 0) return 0n;
  let r = 1n;
  items.forEach((a, i) => {
    r *= BigInt(nthPrime(i)) ** (a + 1n);
  });
  return r;
}

export interface DecodeStep {
  /** index of the prime */
  i: number;
  p: number;
  /** exponent of p_i in the number */
  exponent: bigint;
  /** element a_i = exponent − 1 */
  element: bigint | null;
}

export type DecodeResult =
  | { ok: true; items: bigint[]; steps: DecodeStep[] }
  | { ok: false; reason: string; steps: DecodeStep[] };

/** The exponent of p in n, by repeated squaring of p (fast even for huge exponents). */
export function valuation(n: bigint, p: bigint): { exponent: bigint; rest: bigint } {
  if (n === 0n) throw new RangeError('valuation of 0');
  let exponent = 0n;
  let rest = n;
  // Divide by p^(2^k) for decreasing k.
  const powers: bigint[] = [p];
  while (rest % (powers[powers.length - 1] * powers[powers.length - 1]) === 0n) {
    powers.push(powers[powers.length - 1] * powers[powers.length - 1]);
  }
  for (let k = powers.length - 1; k >= 0; k--) {
    while (rest % powers[k] === 0n) {
      rest /= powers[k];
      exponent += 1n << BigInt(k);
    }
  }
  return { exponent, rest };
}

/**
 * Decodes a number as a sequence code, as the functions len and (s)_i of the book do: the
 * exponents of p_0, p_1, … must all be positive up to the last prime dividing the number.
 */
export function decodeSeq(n: bigint): DecodeResult {
  const steps: DecodeStep[] = [];
  if (n === 0n || n === 1n) return { ok: true, items: [], steps };
  const items: bigint[] = [];
  let rest = n;
  for (let i = 0; rest > 1n; i++) {
    const p = nthPrime(i);
    const { exponent, rest: r } = valuation(rest, BigInt(p));
    steps.push({ i, p, exponent, element: exponent > 0n ? exponent - 1n : null });
    if (exponent === 0n) {
      return { ok: false, reason: `p_${i} = ${p} does not divide the number, but a larger prime does: it is not the code of a sequence`, steps };
    }
    items.push(exponent - 1n);
    rest = r;
    if (i > 100_000) return { ok: false, reason: 'too many prime factors to decode here', steps };
  }
  return { ok: true, items, steps };
}

// ------------------------------------------------------------------ structure

/** Flattens splices of concrete sequences and merges nothing else. */
export function seqParts(n: Nat): SeqPart[] | null {
  if (n.k === 'seq') {
    const out: SeqPart[] = [];
    for (const p of n.parts) {
      if (p.k === 'splice') {
        const inner = seqParts(p.seq);
        if (inner) out.push(...inner);
        else out.push(p);
      } else out.push(p);
    }
    return out;
  }
  if (n.k === 'lit' && (n.v === 0n || n.v === 1n)) return [];
  return null;
}

export function concatSeq(...ns: Nat[]): Nat {
  const parts: SeqPart[] = [];
  for (const n of ns) {
    const ps = seqParts(n);
    if (ps) parts.push(...ps);
    else parts.push({ k: 'splice', seq: n });
  }
  return { k: 'seq', parts };
}

/** Number of elements, as a Nat (symbolic when runs or spliced named sequences are involved). */
export function seqLength(n: Nat): Nat {
  const parts = seqParts(n);
  if (!parts) return { k: 'named', name: `len(${show(n)})`, tex: `\\mathrm{len}(${toTex(n)})` };
  let concrete = 0n;
  const sym: Nat[] = [];
  for (const p of parts) {
    if (p.k === 'item') concrete++;
    else if (p.k === 'run') {
      const t = p.times;
      if (t.k === 'lit') concrete += t.v * BigInt(p.items.length);
      else sym.push(p.items.length === 1 ? t : { k: 'mul', fs: [lit(p.items.length), t] });
    } else sym.push(seqLength(p.seq));
  }
  if (!sym.length) return lit(concrete);
  return { k: 'add', ts: concrete ? [...sym, lit(concrete)] : sym };
}

/** Expands runs whose repetition count is a small literal, so that equal numbers compare equal. */
function canonicalParts(n: Nat): SeqPart[] | null {
  const parts = seqParts(n);
  if (!parts) return null;
  const out: SeqPart[] = [];
  for (const p of parts) {
    if (p.k === 'run' && p.times.k === 'lit' && p.times.v <= 4096n) {
      for (let r = 0n; r < p.times.v; r++) for (const v of p.items) out.push({ k: 'item', v });
    } else out.push(p);
  }
  return out;
}

export type Equality = 'equal' | 'different' | 'unknown';

/**
 * Compares two numbers. 'equal' and 'different' are certain; 'unknown' means the comparison
 * would require expanding named numbers or very large values.
 */
export function natEq(a: Nat, b: Nat): Equality {
  if (a === b) return 'equal';
  const va = evaluate(a, 1 << 16);
  const vb = evaluate(b, 1 << 16);
  if (va !== null && vb !== null) return va === vb ? 'equal' : 'different';
  if (a.k === 'named' && b.k === 'named') return a.name === b.name ? 'equal' : 'unknown';
  const pa = canonicalParts(a);
  const pb = canonicalParts(b);
  if (pa && pb) {
    if (pa.length !== pb.length) {
      // Different lengths of fully concrete part lists are different sequences.
      const concrete = (ps: SeqPart[]) => ps.every((p) => p.k === 'item');
      return concrete(pa) && concrete(pb) ? 'different' : 'unknown';
    }
    let result: Equality = 'equal';
    for (let i = 0; i < pa.length; i++) {
      const r = partEq(pa[i], pb[i]);
      if (r === 'different') return pa.every((p) => p.k === 'item') && pb.every((p) => p.k === 'item') ? 'different' : 'unknown';
      if (r === 'unknown') result = 'unknown';
    }
    return result;
  }
  if (a.k === b.k && (a.k === 'pow' || a.k === 'mul' || a.k === 'add')) {
    return JSON.stringify(a) === JSON.stringify(b) ? 'equal' : 'unknown';
  }
  return 'unknown';
}

function partEq(a: SeqPart, b: SeqPart): Equality {
  if (a.k === 'item' && b.k === 'item') return natEq(a.v, b.v);
  if (a.k === 'run' && b.k === 'run') {
    if (a.items.length !== b.items.length) return 'unknown';
    const t = natEq(a.times, b.times);
    if (t !== 'equal') return 'unknown';
    for (let i = 0; i < a.items.length; i++) if (natEq(a.items[i], b.items[i]) !== 'equal') return 'unknown';
    return 'equal';
  }
  if (a.k === 'splice' && b.k === 'splice') return natEq(a.seq, b.seq) === 'equal' ? 'equal' : 'unknown';
  return 'unknown';
}

// ------------------------------------------------------------------ magnitude

/**
 * An estimate of the size of a number: `{ L }` means log10(n) ≈ L, `{ LL }` means
 * log10(log10(n)) ≈ LL (for numbers whose digit count is itself too large for a float).
 */
export type Magnitude = { L: number } | { LL: number };

const LN10 = Math.log(10);

function magOfLog(L: number): Magnitude {
  return Number.isFinite(L) && L < 1e300 ? { L } : { LL: Math.log10(L) };
}

function logOf(m: Magnitude): number {
  return 'L' in m ? m.L : Infinity;
}

/** log10(log10(n)), for comparing magnitudes of either form. */
function llOf(m: Magnitude): number {
  return 'LL' in m ? m.LL : m.L > 0 ? Math.log10(m.L) : -Infinity;
}

/** The magnitude of a product: log10 adds. */
function magMul(ms: Magnitude[]): Magnitude {
  if (ms.some((m) => 'LL' in m)) return { LL: Math.max(...ms.map(llOf)) };
  return magOfLog(ms.reduce((s, m) => s + (m as { L: number }).L, 0));
}

/** The magnitude of m·c for a positive real c ≥ 1 given by its log10. */
function magScale(m: Magnitude, log10c: number): Magnitude {
  if ('LL' in m) return m;
  return magOfLog(m.L + log10c);
}

/** Magnitude of log10(n) itself, i.e. the number of digits. */
export function digitCount(n: Nat): Magnitude | null {
  const m = magnitude(n);
  if (!m) return null;
  if ('LL' in m) return { L: m.LL };
  return { L: Math.log10(Math.max(1, m.L)) };
}

/**
 * An estimate of log10 of a number; null for numbers known only by name. With `lowerBound`, a
 * named number counts as 1 (it is at least that), so the result bounds the size from below.
 */
export function magnitude(n: Nat, opts: { lowerBound?: boolean } = {}): Magnitude | null {
  lowerBoundMode = opts.lowerBound ?? false;
  try {
    return mag(n);
  } finally {
    lowerBoundMode = false;
  }
}

let lowerBoundMode = false;

function mag(n: Nat): Magnitude | null {
  switch (n.k) {
    case 'lit': {
      if (n.v === 0n) return { L: -Infinity };
      const s = n.v.toString();
      return { L: s.length - 1 + Math.log10(Number(s.slice(0, 15).padEnd(15, '0')) / 1e14) };
    }
    case 'named':
      return lowerBoundMode ? (n.atLeast ? mag(n.atLeast) : { L: 0 }) : null;
    case 'pow': {
      const b = mag(n.base);
      const e = mag(n.exp);
      if (!b || !e) return null;
      // log10(b^e) = e · log10(b)
      if ('LL' in e) return { LL: e.LL + Math.log10(Math.max(1e-300, logOf(b))) };
      if ('LL' in b) return { LL: b.LL + e.L };
      if (e.L > 300) return { LL: e.L + Math.log10(Math.max(1e-300, b.L)) };
      return magOfLog(10 ** e.L * b.L);
    }
    case 'mul': {
      const ms = n.fs.map((f) => mag(f));
      if (ms.some((m) => !m)) return null;
      return magMul(ms as Magnitude[]);
    }
    case 'add': {
      const ms = n.ts.map((t) => mag(t));
      if (ms.some((m) => !m)) return null;
      // Dominated by the largest term.
      let best = ms[0]!;
      for (const m of ms as Magnitude[]) if (llOf(m) > llOf(best) || ('L' in m && 'L' in best && m.L > best.L)) best = m;
      return best;
    }
    case 'seq':
      return seqMagnitude(n);
  }
}

/** log10 of p_i for a position given as a magnitude. */
function log10PrimeAt(pos: Magnitude): number {
  if ('LL' in pos) return 10 ** pos.LL; // log10 p_n ≈ log10 n
  if (pos.L < 5.3) return lnPrimeApprox(Math.round(10 ** pos.L)) / LN10;
  // p_n ≈ n ln n
  return pos.L + Math.log10(pos.L * LN10);
}

function seqMagnitude(n: Nat): Magnitude | null {
  const parts = seqParts(n);
  if (!parts) return null;
  if (parts.length === 0) return { L: -Infinity };
  // Sum over elements of (a_i + 1) · log10(p_i), tracking the position (possibly huge).
  let posSmall = 0; // exact position while small
  let posMag: Magnitude | null = null; // once a huge run has passed
  const terms: Magnitude[] = [];
  const addTerm = (exponent: Magnitude, log10p: number) => {
    // exponent · log10 p, as the magnitude of the total's log10: that is, we collect L-values.
    terms.push(magScale(exponent, Math.log10(Math.max(log10p, 1e-300))));
  };
  const plusOne = (m: Magnitude): Magnitude => ('L' in m && m.L < 15 ? { L: Math.log10(10 ** m.L + 1) } : m);
  for (const p of parts) {
    if (p.k === 'item') {
      const a = mag(p.v);
      if (!a) return null;
      const exp = plusOne('L' in a && a.L === -Infinity ? { L: 0 } : a);
      const log10p = posMag ? log10PrimeAt(posMag) : lnPrimeApprox(posSmall) / LN10;
      addTerm(exp, log10p);
      if (!posMag) posSmall++;
    } else if (p.k === 'run') {
      const times = mag(p.times);
      if (!times) return null;
      const avg = p.items.map((v) => mag(v));
      if (avg.some((m) => !m)) return null;
      const maxExp = avg.reduce((best, m) => (llOf(m!) > llOf(best!) ? m : best), avg[0]!)!;
      const count = 'L' in times ? 10 ** times.L * p.items.length : Infinity;
      if (!posMag && Number.isFinite(count) && count < 1e7) {
        // Sum of log10 p over the positions covered, times the largest exponent (an estimate).
        const lnRange = lnPrimeRangeProductApprox(posSmall, posSmall + Math.round(count));
        terms.push(magScale(plusOne(maxExp), Math.log10(Math.max(lnRange / LN10, 1e-300))));
        posSmall += Math.round(count);
      } else {
        // θ(p_N) ≈ N ln N with N = count: log10 of the product ≈ N · log10(N).
        const N: Magnitude = 'L' in times ? magOfLog(times.L + Math.log10(p.items.length)) : times;
        const logProduct: Magnitude = 'LL' in N ? N : magOfLog(N.L + Math.log10(Math.max(N.L, 1)));
        terms.push(magMul([logProduct, plusOne(maxExp)]));
        posMag = posMag ? (llOf(N) > llOf(posMag) ? N : posMag) : N;
      }
    } else {
      const m = mag(p.seq);
      if (!m) return null;
      terms.push('L' in m ? { L: Math.log10(Math.max(m.L, 1e-300)) } : { L: m.LL });
    }
  }
  // Total log10 = Σ terms (each term is a magnitude of a log10 contribution).
  let best = terms[0];
  let sum = 0;
  let allSmall = true;
  for (const t of terms) {
    if ('LL' in t || t.L > 300) allSmall = false;
    if (llOf(t) > llOf(best)) best = t;
  }
  if (allSmall) {
    for (const t of terms) sum += 10 ** (t as { L: number }).L;
    return magOfLog(sum);
  }
  // Dominated by the largest contribution.
  return 'LL' in best ? { LL: 10 ** best.LL } : { LL: best.L };
}

// ------------------------------------------------------------------ evaluation

/** The exact value, or null when it would exceed `maxBits` bits (or involves named numbers). */
export function evaluate(n: Nat, maxBits = 1 << 20): bigint | null {
  if (n.k === 'lit') return n.v;
  const m = magnitude(n);
  if (!m || 'LL' in m || m.L * 3.33 > maxBits) return null;
  switch (n.k) {
    case 'named':
      return null;
    case 'pow': {
      const b = evaluate(n.base, maxBits);
      const e = evaluate(n.exp, maxBits);
      return b === null || e === null ? null : b ** e;
    }
    case 'mul': {
      let r = 1n;
      for (const f of n.fs) {
        const v = evaluate(f, maxBits);
        if (v === null) return null;
        r *= v;
      }
      return r;
    }
    case 'add': {
      let r = 0n;
      for (const t of n.ts) {
        const v = evaluate(t, maxBits);
        if (v === null) return null;
        r += v;
      }
      return r;
    }
    case 'seq': {
      const items = seqItems(n, 100_000);
      if (!items) return null;
      const vs: bigint[] = [];
      for (const it of items) {
        const v = evaluate(it, maxBits);
        if (v === null) return null;
        vs.push(v);
      }
      return encodeSeq(vs);
    }
  }
}

/** The elements of a sequence code, if there are at most `limit` of them and no named splices. */
export function seqItems(n: Nat, limit = 100_000): Nat[] | null {
  const parts = seqParts(n);
  if (!parts) return null;
  const out: Nat[] = [];
  for (const p of parts) {
    if (p.k === 'item') out.push(p.v);
    else if (p.k === 'run') {
      const t = evaluate(p.times, 64);
      if (t === null || t * BigInt(p.items.length) + BigInt(out.length) > BigInt(limit)) return null;
      for (let r = 0n; r < t; r++) out.push(...p.items);
    } else {
      const inner = seqItems(p.seq, limit - out.length);
      if (!inner) return null;
      out.push(...inner);
    }
    if (out.length > limit) return null;
  }
  return out;
}

// ------------------------------------------------------------------ presentation

export function formatMagnitude(m: Magnitude | null): string {
  if (!m) return 'unknown size';
  if ('L' in m) {
    if (m.L === -Infinity) return '0';
    const digits = Math.floor(m.L) + 1;
    return `${digits.toLocaleString('en-US')} digit${digits === 1 ? '' : 's'}`;
  }
  // number of digits ≈ 10^LL
  const d = m.LL;
  if (d < 15) return `about ${Math.round(10 ** d).toLocaleString('en-US')} digits`;
  return `a number of digits that itself has about ${Math.floor(d) + 1} digits`;
}

/** A short plain-text form (for names and keys). */
export function show(n: Nat): string {
  switch (n.k) {
    case 'lit':
      return n.v.toString();
    case 'named':
      return n.name;
    case 'pow':
      return `${show(n.base)}^${show(n.exp)}`;
    case 'mul':
      return n.fs.map(show).join('·');
    case 'add':
      return n.ts.map(show).join('+');
    case 'seq':
      return `⟨${(seqParts(n) ?? []).map((p) => (p.k === 'item' ? show(p.v) : p.k === 'run' ? `(${p.items.map(show).join(',')})×${show(p.times)}` : `…${show(p.seq)}…`)).join(',')}⟩`;
  }
}

export interface TexOptions {
  /** Literal values with more digits than this are abbreviated. */
  maxDigits?: number;
  /** 'seq' shows ⟨…⟩; 'powers' shows the prime factorisation. */
  seqStyle?: 'seq' | 'powers';
  /** Maximum number of elements shown before eliding. */
  maxItems?: number;
}

export function litTex(v: bigint, maxDigits = 24): string {
  const s = v.toString();
  if (s.length <= maxDigits) return s.length > 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : s;
  return `${s.slice(0, 6)}\\ldots${s.slice(-4)}\\;\\text{\\small(${s.length.toLocaleString('en-US')} digits)}`;
}

export function toTex(n: Nat, opt: TexOptions = {}): string {
  const maxItems = opt.maxItems ?? 12;
  switch (n.k) {
    case 'lit':
      return litTex(n.v, opt.maxDigits);
    case 'named':
      return n.tex;
    case 'pow':
      return `${wrap(n.base, opt)}^{${toTex(n.exp, opt)}}`;
    case 'mul':
      return n.fs.map((f) => wrap(f, opt)).join(' \\cdot ');
    case 'add':
      return n.ts.map((t) => toTex(t, opt)).join(' + ');
    case 'seq': {
      const parts = seqParts(n) ?? [];
      if (parts.length === 0) return '\\Lambda';
      if (opt.seqStyle === 'powers') {
        const out: string[] = [];
        let i = 0;
        for (const p of parts) {
          if (out.length >= maxItems) {
            out.push('\\cdots');
            break;
          }
          if (p.k === 'item') {
            out.push(`${nthPrime(i)}^{${toTex(p.v, opt)} + 1}`);
            i++;
          } else {
            out.push('\\cdots');
            break;
          }
        }
        return out.join(' \\cdot ');
      }
      const out: string[] = [];
      for (const p of parts) {
        if (out.length >= maxItems) {
          out.push('\\ldots');
          break;
        }
        if (p.k === 'item') out.push(toTex(p.v, opt));
        else if (p.k === 'run') {
          const body = p.items.map((v) => toTex(v, opt)).join(', ');
          out.push(`\\underbrace{${body}, \\ldots, ${body}}_{${toTex(p.times, opt)}\\text{ times}}`);
        } else out.push(`\\ldots_{${toTex(p.seq, opt)}}`);
      }
      return `\\langle ${out.join(', ')} \\rangle`;
    }
  }
}

function wrap(n: Nat, opt: TexOptions): string {
  const t = toTex(n, opt);
  return n.k === 'add' || n.k === 'mul' ? `(${t})` : n.k === 'pow' ? `{(${t})}` : t;
}
