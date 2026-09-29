// Exact arithmetic for Euclid's irrationals: sums of square roots with rational coefficients,
// c₁√s₁ + c₂√s₂ + …, and square roots of such sums. It is enough to classify the lines of Book X
// in their canonical forms √a ± √b and √(√a ± √b), with a, b rational, against the rational line
// ρ = 1. Anything else (cube roots, sums of three unlike surds, fourth roots of binomials) is
// reported as outside these forms rather than guessed.

export class Unsupported extends Error {}

// ------------------------------------------------------------------ rationals (BigInt)

export interface Q {
  n: bigint;
  d: bigint;
}

const abs = (x: bigint) => (x < 0n ? -x : x);
const bgcd = (a: bigint, b: bigint): bigint => {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
const LIMIT = 10n ** 15n;

export function q(n: bigint | number, d: bigint | number = 1n): Q {
  let N = BigInt(n);
  let D = BigInt(d);
  if (D === 0n) throw new Unsupported('division by zero');
  if (D < 0n) [N, D] = [-N, -D];
  const g = bgcd(N, D) || 1n;
  N /= g;
  D /= g;
  if (abs(N) > LIMIT || D > LIMIT) throw new Unsupported('the numbers get too large');
  return { n: N, d: D };
}
const qadd = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const qmul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const qneg = (a: Q): Q => ({ n: -a.n, d: a.d });
const qinv = (a: Q) => q(a.d, a.n);
const qnum = (a: Q) => Number(a.n) / Number(a.d);
const qzero = (a: Q) => a.n === 0n;

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x--;
  while ((x + 1n) * (x + 1n) <= n) x++;
  return x;
}
const isSq = (n: bigint) => n >= 0n && isqrt(n) ** 2n === n;
/** a rational that is the square of a rational */
export const qIsSquare = (a: Q) => a.n >= 0n && isSq(a.n) && isSq(a.d);

/** n = out² · inn with inn square-free (n > 0). */
function squareFree(n: bigint): [bigint, bigint] {
  let out = 1n;
  let inn = n;
  for (let p = 2n; p * p <= inn; p++) {
    if (p > 1000000n) throw new Unsupported('a number too large to factor');
    while (inn % (p * p) === 0n) {
      inn /= p * p;
      out *= p;
    }
  }
  return [out, inn];
}

// ------------------------------------------------------------------ surd sums

/** Σ c·√r, r square-free ≥ 1, keyed by r. */
export type S = Map<bigint, Q>;

const sClean = (s: S): S => new Map([...s].filter(([, c]) => !qzero(c)).sort((a, b) => (a[0] < b[0] ? -1 : 1)));
export const sRat = (c: Q): S => sClean(new Map([[1n, c]]));
export const sTerm = (c: Q, r: bigint): S => sClean(new Map([[r, c]]));
export function sAdd(a: S, b: S): S {
  const out = new Map(a);
  for (const [r, c] of b) out.set(r, out.has(r) ? qadd(out.get(r)!, c) : c);
  return sClean(out);
}
export const sNeg = (a: S): S => new Map([...a].map(([r, c]) => [r, qneg(c)]));
export function sMul(a: S, b: S): S {
  let out: S = new Map();
  for (const [r1, c1] of a)
    for (const [r2, c2] of b) {
      const g = bgcd(r1, r2);
      out = sAdd(out, sTerm(qmul(qmul(c1, c2), q(g)), (r1 / g) * (r2 / g)));
    }
  return out;
}
export const sScale = (a: S, c: Q): S => sMul(a, sRat(c));
export const sNum = (a: S) => [...a].reduce((t, [r, c]) => t + qnum(c) * Math.sqrt(Number(r)), 0);
const sEq = (a: S, b: S) => sAdd(a, sNeg(b)).size === 0;
/** A single term squared, or the rational c² r. */
const termSq = (c: Q, r: bigint) => qmul(qmul(c, c), q(r));

/** √ of a non-negative rational, as a single term. */
export function qSqrt(a: Q): S {
  if (a.n < 0n) throw new Unsupported('the square root of a negative number');
  if (a.n === 0n) return new Map();
  // √(n/d) = √(n·d)/d
  const [o, i] = squareFree(a.n * a.d);
  return sTerm(q(o, a.d), i);
}

export function sInv(a: S): S {
  const t = [...a];
  if (t.length === 0) throw new Unsupported('division by zero');
  if (t.length === 1) {
    const [r, c] = t[0];
    return sTerm(qinv(qmul(c, q(r))), r); // 1/(c√r) = √r/(c·r)
  }
  if (t.length === 2) {
    // (t₁ + t₂)(t₁ − t₂) = t₁² − t₂², a rational
    const [[r1, c1], [r2, c2]] = t;
    const den = qadd(termSq(c1, r1), qneg(termSq(c2, r2)));
    if (qzero(den)) throw new Unsupported('division by zero');
    return sScale(sAdd(sTerm(c1, r1), sTerm(qneg(c2), r2)), qinv(den));
  }
  throw new Unsupported('division by a sum of three or more unlike roots');
}

// ------------------------------------------------------------------ values: sums, or ±√(sum)

export type Val = { t: 'sum'; s: S } | { t: 'root'; sign: 1 | -1; s: S };

export const num = (x: Val) => (x.t === 'sum' ? sNum(x.s) : x.sign * Math.sqrt(sNum(x.s)));

/** ±√s, denested when that is possible within surd sums. */
export function root(s: S, sign: 1 | -1 = 1): Val {
  const t = [...s];
  if (sNum(s) < -1e-12) throw new Unsupported('the square root of a negative quantity');
  const neg = (v: S): Val => ({ t: 'sum', s: sign === 1 ? v : sNeg(v) });
  if (t.length === 0) return { t: 'sum', s: new Map() };
  if (t.length === 1 && t[0][0] === 1n) return neg(qSqrt(t[0][1]));
  if (t.length === 2 && t[0][0] === 1n) {
    // √(p + c√r) = √((p + d)/2) ± √((p − d)/2) when p² − c²r = d² is a rational square
    const p = t[0][1];
    const [r, c] = t[1];
    const disc = qadd(qmul(p, p), qneg(termSq(c, r)));
    if (p.n > 0n && qIsSquare(disc)) {
      const d = qSqrt(disc).get(1n) ?? q(0);
      const u = qSqrt(qmul(qadd(p, d), q(1, 2)));
      const w = qSqrt(qmul(qadd(p, qneg(d)), q(1, 2)));
      return neg(sAdd(u, c.n > 0n ? w : sNeg(w)));
    }
  }
  return { t: 'root', sign, s };
}

export function mul(x: Val, y: Val): Val {
  if (x.t === 'sum' && y.t === 'sum') return { t: 'sum', s: sMul(x.s, y.s) };
  if (x.t === 'root' && y.t === 'root') {
    const sign = (x.sign * y.sign) as 1 | -1;
    if (sEq(x.s, y.s)) return { t: 'sum', s: sign === 1 ? x.s : sNeg(x.s) };
    return root(sMul(x.s, y.s), sign);
  }
  const [r, s] = x.t === 'root' ? [x, y as { t: 'sum'; s: S }] : [y as { t: 'root'; sign: 1 | -1; s: S }, x as { t: 'sum'; s: S }];
  const k = sNum(s.s);
  if (Math.abs(k) < 1e-15) return { t: 'sum', s: new Map() };
  return root(sMul(r.s, sMul(s.s, s.s)), (r.sign * Math.sign(k)) as 1 | -1);
}

export function inv(x: Val): Val {
  if (x.t === 'sum') return { t: 'sum', s: sInv(x.s) };
  return root(sInv(x.s), x.sign);
}

export const neg = (x: Val): Val => (x.t === 'sum' ? { t: 'sum', s: sNeg(x.s) } : { ...x, sign: (-x.sign) as 1 | -1 });

export function add(x: Val, y: Val): Val {
  if (x.t === 'sum' && y.t === 'sum') return { t: 'sum', s: sAdd(x.s, y.s) };
  // (x + y)² = x² + y² + 2xy, which must be a surd sum
  const sq = (v: Val) => mul(v, v);
  const parts = [sq(x), sq(y), mul(x, y)];
  if (parts.some((p) => p.t !== 'sum')) throw new Unsupported('a sum whose square is not a sum of square roots');
  const [a, b, c] = parts.map((p) => (p as { s: S }).s);
  const total = sAdd(sAdd(a, b), sScale(c, q(2)));
  const v = num(x) + num(y);
  if (Math.abs(v) < 1e-12 * Math.max(1, Math.abs(num(x)))) return { t: 'sum', s: new Map() };
  return root(total, v > 0 ? 1 : -1);
}

// ------------------------------------------------------------------ parser

type Tok = { k: 'num'; v: Q } | { k: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = src.replace(/\s+/g, '');
  while (i < s.length) {
    const ch = s[i];
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (m) {
      const [int, dec = ''] = m[0].split('.');
      out.push({ k: 'num', v: q(BigInt(int + dec), 10n ** BigInt(dec.length)) });
      i += m[0].length;
      continue;
    }
    const word = /^(sqrt|root4|root)/i.exec(s.slice(i));
    if (word) {
      out.push({ k: 'op', v: word[0].toLowerCase() === 'sqrt' ? '√' : '∜' });
      i += word[0].length;
      continue;
    }
    const map: Record<string, string> = { '−': '-', '–': '-', '×': '*', '·': '*', '÷': '/', '²': '^2' };
    const c = map[ch] ?? ch;
    if (c === '^2') {
      out.push({ k: 'op', v: '^' }, { k: 'num', v: q(2) });
    } else if ('+-*/^()√∜'.includes(c)) out.push({ k: 'op', v: c });
    else throw new Unsupported(`unexpected “${ch}”`);
    i++;
  }
  return out;
}

export function parse(src: string): Val {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.k === 'op' && peek().v === v;
  const startsFactor = () => {
    const t = peek();
    return !!t && (t.k === 'num' || t.v === '(' || t.v === '√' || t.v === '∜');
  };
  const expr = (): Val => {
    let x = term();
    while (isOp('+') || isOp('-')) {
      const o = (toks[i++] as { v: string }).v;
      const y = term();
      x = add(x, o === '+' ? y : neg(y));
    }
    return x;
  };
  const term = (): Val => {
    let x = unary();
    for (;;) {
      if (isOp('*')) {
        i++;
        x = mul(x, unary());
      } else if (isOp('/')) {
        i++;
        x = mul(x, inv(unary()));
      } else if (startsFactor()) x = mul(x, power());
      else return x;
    }
  };
  const unary = (): Val => {
    if (isOp('-')) {
      i++;
      return neg(unary());
    }
    if (isOp('+')) {
      i++;
      return unary();
    }
    return power();
  };
  const power = (): Val => {
    const base = atom();
    if (!isOp('^')) return base;
    i++;
    const e = unary();
    const es = e.t === 'sum' ? [...e.s] : null;
    const r = es && es.length <= 1 && (es.length === 0 || es[0][0] === 1n) ? (es.length ? es[0][1] : q(0)) : null;
    if (!r) throw new Unsupported('an exponent that is not a rational number');
    if (r.d !== 1n && r.d !== 2n && r.d !== 4n) throw new Unsupported('exponents other than whole numbers, halves and quarters');
    let n = Number(r.n);
    if (Math.abs(n) > 12) throw new Unsupported('an exponent that large');
    let b = base;
    if (r.d >= 2n) b = sqrtVal(b);
    if (r.d === 4n) b = sqrtVal(b);
    let out: Val = { t: 'sum', s: sRat(q(1)) };
    const neg0 = n < 0;
    n = Math.abs(n);
    for (let k = 0; k < n; k++) out = mul(out, b);
    return neg0 ? inv(out) : out;
  };
  const atom = (): Val => {
    const t = toks[i++];
    if (!t) throw new Unsupported('the expression ends too early');
    if (t.k === 'num') return { t: 'sum', s: sRat(t.v) };
    if (t.v === '(') {
      const x = expr();
      if (!isOp(')')) throw new Unsupported('a missing “)”');
      i++;
      return x;
    }
    if (t.v === '√') return sqrtVal(power());
    if (t.v === '∜') return sqrtVal(sqrtVal(power()));
    throw new Unsupported(`unexpected “${t.v}”`);
  };
  const x = expr();
  if (i < toks.length) throw new Unsupported(`unexpected “${(toks[i] as { v: unknown }).v}”`);
  return x;
}

function sqrtVal(x: Val): Val {
  if (x.t === 'root') throw new Unsupported('the square root of a square root of a sum (an eighth root, or a nested root of a binomial): beyond these forms');
  return root(x.s);
}

// ------------------------------------------------------------------ formatting

const qText = (a: Q) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`);

function termText(c: Q, r: bigint, first: boolean): string {
  const sgn = c.n < 0n ? (first ? '−' : ' − ') : first ? '' : ' + ';
  const a = { n: abs(c.n), d: c.d };
  if (r === 1n) return sgn + qText(a);
  const coef = a.n === 1n ? '' : `${a.n}`;
  return sgn + coef + `√${r}` + (a.d === 1n ? '' : `/${a.d}`);
}

export function sText(s: S): string {
  // the positive terms first, larger before smaller: √5 − 2 rather than −2 + √5
  const val = ([r, c]: [bigint, Q]) => qnum(c) * Math.sqrt(Number(r));
  const t = [...s].sort((x, y) => val(y) - val(x));
  if (!t.length) return '0';
  return t.map(([r, c], k) => termText(c, r, k === 0)).join('');
}

/** ⁴√(a) for a positive rational a, simplified. */
function root4Text(a: Q): string {
  // ⁴√(n/d) = ⁴√(n·d³)/d
  let m = a.n * a.d ** 3n;
  let out = 1n;
  for (let p = 2n; p ** 4n <= m; p++) {
    if (p > 40000n) break;
    while (m % p ** 4n === 0n) {
      m /= p ** 4n;
      out *= p;
    }
  }
  const g = bgcd(out, a.d);
  const [nn, dd] = [out / g, a.d / g];
  let head: string;
  if (m === 1n) head = `${nn}`;
  else if (isSq(m)) head = `${nn === 1n ? '' : nn}√${isqrt(m)}`;
  else head = `${nn === 1n ? '' : nn}⁴√${m}`;
  return dd === 1n ? head : `${head}/${dd}`;
}

export function valText(x: Val): string {
  if (x.t === 'sum') return sText(x.s);
  const t = [...x.s];
  const pre = x.sign === -1 ? '−' : '';
  if (t.length === 1 && t[0][1].n > 0n) return pre + root4Text(termSq(t[0][1], t[0][0]));
  return `${pre}√(${sText(x.s)})`;
}

// ------------------------------------------------------------------ classification

export const ADDITIVE = ['binomial', 'first bimedial', 'second bimedial', 'major', 'side of a rational plus a medial area', 'side of the sum of two medial areas'];
export const SUBTRACTIVE = ['apotome', 'first apotome of a medial', 'second apotome of a medial', 'minor', 'that which produces with a rational area a medial whole', 'that which produces with a medial area a medial whole'];
export const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

export interface Result {
  family: 'rational' | 'medial' | 'binomial' | 'apotome' | 'additive' | 'subtractive' | 'zero';
  /** Euclid's name */
  name: string;
  /** 1–6 for the binomials/apotomes and the twelve compound kinds */
  order?: number;
  /** the proposition or definition where the kind is introduced */
  ref: string;
  /** the value in simplified exact form */
  form: string;
  /** x = u ± v, when the line is a compound one given as a nested root */
  parts?: { u: string; v: string; plus: boolean };
  /** the two terms α > β of the binomial or apotome (x itself, or x² for the compound kinds) */
  terms?: { alpha: string; beta: string; of: 'x' | 'x²' };
  /** the tests that decided the classification */
  checks: { label: string; ok: boolean }[];
  value: number;
}

/**
 * The order of the two-term sum α + β (|α| > |β|, the terms single surds with unlike radicands):
 * the binomial when β > 0, the apotome when β < 0.
 */
function order(big: Q, small: Q, checks: Result['checks'], word: string): number {
  // big = α², small = β² (rationals)
  const diff = qadd(big, qneg(small));
  const comm = qIsSquare(qmul(diff, qinv(big)));
  checks.push({ label: `√(α² − β²) = ${valText(root(sRat(diff)))} is commensurable in length with the greater term α (X. Deff. ${word} 1–3)`, ok: comm });
  const aRat = qIsSquare(big);
  const bRat = qIsSquare(small);
  checks.push({ label: 'the greater term α is commensurable in length with ρ', ok: aRat });
  checks.push({ label: 'the lesser term β is commensurable in length with ρ', ok: bRat });
  const k = aRat ? 1 : bRat ? 2 : 3;
  return comm ? k : k + 3;
}

/** The two single terms of a two-term sum, greater first, with their squares. */
function twoTerms(s: S) {
  const t = [...s].map(([r, c]) => ({ r, c, sq: termSq(c, r), v: qnum(c) * Math.sqrt(Number(r)) }));
  t.sort((x, y) => Math.abs(y.v) - Math.abs(x.v));
  return t;
}

export function classify(x: Val): Result {
  const value = num(x);
  if (value < -1e-12) throw new Unsupported('a negative quantity is not a length');
  const form = valText(x);
  const checks: Result['checks'] = [];
  if (x.t === 'sum') {
    const t = [...x.s];
    if (t.length === 0) return { family: 'zero', name: 'zero: not a length', ref: '', form, checks, value };
    if (t.length === 1) {
      const [r] = t[0];
      checks.push({ label: 'the square is a rational multiple of ρ²', ok: true });
      checks.push({ label: 'commensurable in length with ρ', ok: r === 1n });
      return { family: 'rational', name: r === 1n ? 'rational, commensurable in length with ρ' : 'rational, commensurable with ρ in square only', ref: '10.def1.3', form, checks, value };
    }
    if (t.length === 2) {
      const [a, b] = twoTerms(x.s);
      checks.push({ label: 'the two terms are rational and commensurable in square only (a : b is not a ratio of squares)', ok: true });
      const plus = b.v > 0;
      const k = order(a.sq, b.sq, checks, plus ? 'II' : 'III');
      const terms = { alpha: sText(sTerm(a.c, a.r)), beta: sText(sTerm(b.c.n < 0n ? qneg(b.c) : b.c, b.r)), of: 'x' as const };
      return plus
        ? { family: 'binomial', name: `binomial (of the ${ORDINAL[k - 1]} order)`, order: k, ref: '10.36', form, terms, checks, value }
        : { family: 'apotome', name: `apotome (of the ${ORDINAL[k - 1]} order)`, order: k, ref: '10.73', form, terms, checks, value };
    }
    throw new Unsupported('a sum of three or more unlike square roots: not one of the canonical forms');
  }
  // x = √s with s not a rational square
  const t = [...x.s];
  if (t.length === 1) {
    checks.push({ label: 'the square is ρ² times the square root of a non-square rational: a medial area', ok: true });
    return { family: 'medial', name: 'medial', ref: '10.21', form, checks, value };
  }
  if (t.length === 2) {
    const [a, b] = twoTerms(x.s);
    const plus = b.v > 0;
    checks.push({ label: `the square ${sText(x.s)} is ${plus ? 'a binomial' : 'an apotome'} (terms rational, commensurable in square only)`, ok: true });
    const k = order(a.sq, b.sq, checks, plus ? 'II' : 'III');
    const terms = { alpha: sText(sTerm(a.c, a.r)), beta: sText(sTerm(b.c.n < 0n ? qneg(b.c) : b.c, b.r)), of: 'x²' as const };
    checks.push({ label: `so x² is ${plus ? 'a binomial' : 'an apotome'} of the ${ORDINAL[k - 1]} order, and x is the ${ORDINAL[k - 1]} ${plus ? 'additive' : 'subtractive'} line (X.${plus ? 53 + k : 90 + k})`, ok: true });
    // x = u ± v with u² + v² = α and 2uv = β: u², v² = (α ± √(α² − β²))/2
    const alpha = sTerm(a.c.n < 0n ? qneg(a.c) : a.c, a.r);
    const d = qSqrt(qadd(a.sq, qneg(b.sq)));
    const half = q(1, 2);
    let parts: Result['parts'];
    try {
      const u = root(sScale(sAdd(alpha, d), half));
      const v = root(sScale(sAdd(alpha, sNeg(d)), half));
      parts = { u: valText(u), v: valText(v), plus };
    } catch {
      parts = undefined;
    }
    checks.push({
      label: `x = u ${plus ? '+' : '−'} v with u² + v² = α (${k <= 3 ? 'u², v² are single square roots' : 'u², v² are themselves binomials'})`,
      ok: true,
    });
    return plus
      ? { family: 'additive', name: ADDITIVE[k - 1], order: k, ref: `10.${35 + k}`, form, parts, terms, checks, value }
      : { family: 'subtractive', name: SUBTRACTIVE[k - 1], order: k, ref: `10.${72 + k}`, form, parts, terms, checks, value };
  }
  throw new Unsupported('the square root of a sum of three or more unlike roots: not one of the canonical forms');
}
