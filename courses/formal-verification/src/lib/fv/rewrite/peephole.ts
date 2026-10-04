/**
 * The peephole court (chapter 14): rewrites `lhs => rhs if pre` over fixed-width integers, in the spirit of Alive
 * (Lopes, Menendez, Nagarakatte and Regehr, PLDI 2015). A rewrite is correct at width w when, for every input
 * satisfying the precondition on which the left side is defined, the right side is defined and has the same value.
 *
 * "Defined" models LLVM's immediate undefined behaviour in a simplified way: division and remainder by zero, signed
 * division of the minimum value by −1, and shifts by the width or more are undefined. Alive also models poison
 * values, `nsw`/`nuw` flags and undef; the court does not.
 *
 * Each width is a separate SMT query over bit-vectors, answered by bit-blasting. A counterexample is replayed by the
 * evaluator below (plain BigInt arithmetic, independent of the solver) before it is reported, and a proof comes with
 * the SMT certificate check.
 */
import { and, bool, bvbin, bvnum, bvSort, bvun, eq, FALSE, not, or, TRUE, v, type Term } from '../logic/term';
import { checkSat, type SmtProof } from '../smt/solver';
import { checkUnsatCertificate } from '../smt/check/certificate';
import { BitBlaster } from '../smt/bv';

export type BinOp = '+' | '-' | '*' | '/u' | '/s' | '%u' | '%s' | '<<' | '>>u' | '>>s' | '&' | '|' | '^' | '==' | '!=' | '<u' | '<=u' | '>u' | '>=u' | '<s' | '<=s' | '>s' | '>=s' | '&&' | '||';
export type Expr =
  | { k: 'var'; name: string }
  | { k: 'num'; value: bigint }
  | { k: 'kw'; name: 'width' | 'SMAX' | 'SMIN' | 'UMAX' | 'true' | 'false' }
  | { k: 'un'; op: '~' | '-' | '!'; a: Expr }
  | { k: 'bin'; op: BinOp; a: Expr; b: Expr }
  | { k: 'call'; name: 'pow2'; args: Expr[] };

export class RewriteError extends Error {}

const BIN_LEVELS: BinOp[][] = [
  ['||'],
  ['&&'],
  ['==', '!=', '<u', '<=u', '>u', '>=u', '<s', '<=s', '>s', '>=s'],
  ['|'],
  ['^'],
  ['&'],
  ['<<', '>>u', '>>s'],
  ['+', '-'],
  ['*', '/u', '/s', '%u', '%s'],
];
const TOKENS = ['>>u', '>>s', '<=u', '>=u', '<=s', '>=s', '&&', '||', '==', '!=', '<<', '/u', '/s', '%u', '%s', '<u', '>u', '<s', '>s', '+', '-', '*', '&', '|', '^', '~', '!', '(', ')', ','];

function tokenize(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(0x[0-9a-fA-F]+|0b[01]+|\d+)/.exec(src.slice(i));
    if (num) {
      out.push(num[0]);
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z_0-9]*/.exec(src.slice(i));
    if (id) {
      out.push(id[0]);
      i += id[0].length;
      continue;
    }
    const t = TOKENS.find((t) => src.startsWith(t, i));
    if (!t && '/%<>'.includes(c)) {
      const op = src.startsWith('>>', i) ? '>>' : src.startsWith('<=', i) || src.startsWith('>=', i) ? src.slice(i, i + 2) : c;
      throw new RewriteError(`Write ${op}u or ${op}s: on machine integers, “${op}” depends on whether the bits are read as unsigned or signed.`);
    }
    if (!t) throw new RewriteError(`Unexpected “${c}” in “${src}”.`);
    out.push(t);
    i += t.length;
  }
  return out;
}

export function parseExpr(src: string): Expr {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (t: string) => {
    if (toks[p] !== t) throw new RewriteError(`Expected “${t}” in “${src}”${toks[p] ? `, found “${toks[p]}”` : ''}.`);
    p++;
  };
  const level = (n: number): Expr => {
    if (n === BIN_LEVELS.length) return unary();
    let a = level(n + 1);
    for (;;) {
      const op = peek() as BinOp | undefined;
      if (!op || !BIN_LEVELS[n]!.includes(op)) return a;
      p++;
      // Comparisons do not chain.
      a = { k: 'bin', op, a, b: level(n + 1) };
      if (n === 2) return a;
    }
  };
  const unary = (): Expr => {
    const t = peek();
    if (t === '~' || t === '-' || t === '!') {
      p++;
      return { k: 'un', op: t, a: unary() };
    }
    return atom();
  };
  const atom = (): Expr => {
    const t = toks[p++];
    if (t === undefined) throw new RewriteError(`“${src}” ends too early.`);
    if (t === '(') {
      const e = level(0);
      eat(')');
      return e;
    }
    if (/^(0x|0b|\d)/.test(t)) return { k: 'num', value: BigInt(t) };
    if (t === 'width' || t === 'SMAX' || t === 'SMIN' || t === 'UMAX' || t === 'true' || t === 'false') return { k: 'kw', name: t };
    if (t === 'pow2') {
      eat('(');
      const a = level(0);
      eat(')');
      return { k: 'call', name: 'pow2', args: [a] };
    }
    if (/^[A-Za-z_]/.test(t)) {
      if (peek() === '(') throw new RewriteError(`Unknown function “${t}”. The only function is pow2(…).`);
      return { k: 'var', name: t };
    }
    throw new RewriteError(`Unexpected “${t}” in “${src}”.`);
  };
  const e = level(0);
  if (p < toks.length) throw new RewriteError(`Unexpected “${toks[p]}” in “${src}”.`);
  return e;
}

export interface Rewrite {
  lhs: Expr;
  rhs: Expr;
  pre?: Expr;
  text: string;
}

/** `lhs => rhs` or `lhs => rhs if pre` (⇒ also accepted). */
export function parseRewrite(text: string): Rewrite {
  const t = text.replace(/⇒/g, '=>');
  const i = t.indexOf('=>');
  if (i < 0) throw new RewriteError('Write a rewrite as “left => right”, optionally followed by “if precondition”.');
  const left = t.slice(0, i);
  let right = t.slice(i + 2);
  let pre: string | undefined;
  const m = /\bif\b/.exec(right);
  if (m) {
    pre = right.slice(m.index + 2);
    right = right.slice(0, m.index);
  }
  if (!left.trim() || !right.trim()) throw new RewriteError('Both sides of the rewrite need an expression.');
  const rw: Rewrite = { lhs: parseExpr(left), rhs: parseExpr(right), pre: pre?.trim() ? parseExpr(pre) : undefined, text: text.trim() };
  const tl = typeOf(rw.lhs);
  const tr = typeOf(rw.rhs);
  if (tl !== tr) throw new RewriteError(`The left side is ${tl === 'bool' ? 'a condition' : 'a number'} but the right side is ${tr === 'bool' ? 'a condition' : 'a number'}.`);
  if (rw.pre && typeOf(rw.pre) !== 'bool') throw new RewriteError('The precondition must be a condition, such as C != 0.');
  return rw;
}

type Ty = 'bv' | 'bool';
const CMP = new Set<BinOp>(['==', '!=', '<u', '<=u', '>u', '>=u', '<s', '<=s', '>s', '>=s']);
export function typeOf(e: Expr): Ty {
  switch (e.k) {
    case 'var':
    case 'num':
      return 'bv';
    case 'kw':
      return e.name === 'true' || e.name === 'false' ? 'bool' : 'bv';
    case 'call':
      if (typeOf(e.args[0]!) !== 'bv') throw new RewriteError('pow2 takes a number.');
      return 'bool';
    case 'un': {
      const t = typeOf(e.a);
      if (e.op === '!' ? t !== 'bool' : t !== 'bv') throw new RewriteError(`“${e.op}” cannot apply to ${t === 'bool' ? 'a condition' : 'a number'}.`);
      return t;
    }
    case 'bin': {
      const a = typeOf(e.a);
      const b = typeOf(e.b);
      if (e.op === '&&' || e.op === '||') {
        if (a !== 'bool' || b !== 'bool') throw new RewriteError(`“${e.op}” combines conditions.`);
        return 'bool';
      }
      if ((e.op === '==' || e.op === '!=') && a === 'bool' && b === 'bool') return 'bool';
      if (a !== 'bv' || b !== 'bv') throw new RewriteError(`“${e.op}” applies to numbers.`);
      return CMP.has(e.op) ? 'bool' : 'bv';
    }
  }
}

export function varsOf(rw: Rewrite): string[] {
  const out: string[] = [];
  const go = (e: Expr) => {
    if (e.k === 'var' && !out.includes(e.name)) out.push(e.name);
    if (e.k === 'un') go(e.a);
    if (e.k === 'bin') {
      go(e.a);
      go(e.b);
    }
    if (e.k === 'call') e.args.forEach(go);
  };
  go(rw.lhs);
  go(rw.rhs);
  if (rw.pre) go(rw.pre);
  return out.sort((a, b) => (a[0] === a[0]!.toUpperCase()) === (b[0] === b[0]!.toUpperCase()) ? a.localeCompare(b) : a[0] === a[0]!.toUpperCase() ? 1 : -1);
}

// ── The reference evaluator ──

export interface Value {
  v: bigint | boolean;
  /** False when the expression has undefined behaviour on this input. */
  defined: boolean;
}

export function evaluate(e: Expr, env: ReadonlyMap<string, bigint>, w: number): Value {
  const mask = (1n << BigInt(w)) - 1n;
  const u = (x: bigint) => x & mask;
  const s = (x: bigint) => BigInt.asIntN(w, x);
  const go = (e: Expr): Value => {
    switch (e.k) {
      case 'var': {
        const x = env.get(e.name);
        if (x === undefined) throw new RewriteError(`No value for ${e.name}.`);
        return { v: u(x), defined: true };
      }
      case 'num':
        return { v: u(e.value), defined: true };
      case 'kw':
        if (e.name === 'true' || e.name === 'false') return { v: e.name === 'true', defined: true };
        return { v: u(e.name === 'width' ? BigInt(w) : e.name === 'UMAX' ? mask : e.name === 'SMAX' ? mask >> 1n : 1n << BigInt(w - 1)), defined: true };
      case 'call': {
        const a = go(e.args[0]!);
        const x = a.v as bigint;
        return { v: x !== 0n && (x & (x - 1n)) === 0n, defined: a.defined };
      }
      case 'un': {
        const a = go(e.a);
        if (e.op === '!') return { v: !a.v, defined: a.defined };
        return { v: e.op === '~' ? u(~(a.v as bigint)) : u(-(a.v as bigint)), defined: a.defined };
      }
      case 'bin': {
        const a = go(e.a);
        const b = go(e.b);
        const defined = a.defined && b.defined;
        if (e.op === '&&' || e.op === '||' || (typeof a.v === 'boolean' && (e.op === '==' || e.op === '!='))) {
          const r = e.op === '&&' ? (a.v as boolean) && (b.v as boolean) : e.op === '||' ? (a.v as boolean) || (b.v as boolean) : e.op === '==' ? a.v === b.v : a.v !== b.v;
          return { v: r, defined };
        }
        const x = a.v as bigint;
        const y = b.v as bigint;
        switch (e.op) {
          case '+': return { v: u(x + y), defined };
          case '-': return { v: u(x - y), defined };
          case '*': return { v: u(x * y), defined };
          case '&': return { v: x & y, defined };
          case '|': return { v: x | y, defined };
          case '^': return { v: x ^ y, defined };
          case '/u': return y === 0n ? { v: mask, defined: false } : { v: x / y, defined };
          case '%u': return y === 0n ? { v: x, defined: false } : { v: x % y, defined };
          case '/s':
          case '%s': {
            if (y === 0n) return { v: e.op === '/s' ? mask : x, defined: false };
            const sx = s(x);
            const sy = s(y);
            const overflow = sx === -(1n << BigInt(w - 1)) && sy === -1n;
            // BigInt division truncates towards zero, like LLVM's sdiv and srem.
            return { v: u(e.op === '/s' ? sx / sy : sx % sy), defined: defined && !overflow };
          }
          case '<<': return { v: y >= BigInt(w) ? 0n : u(x << y), defined: defined && y < BigInt(w) };
          case '>>u': return { v: y >= BigInt(w) ? 0n : x >> y, defined: defined && y < BigInt(w) };
          case '>>s': return { v: u(s(x) >> (y >= BigInt(w) ? BigInt(w) : y)), defined: defined && y < BigInt(w) };
          case '==': return { v: x === y, defined };
          case '!=': return { v: x !== y, defined };
          case '<u': return { v: x < y, defined };
          case '<=u': return { v: x <= y, defined };
          case '>u': return { v: x > y, defined };
          case '>=u': return { v: x >= y, defined };
          case '<s': return { v: s(x) < s(y), defined };
          case '<=s': return { v: s(x) <= s(y), defined };
          case '>s': return { v: s(x) > s(y), defined };
          case '>=s': return { v: s(x) >= s(y), defined };
        }
        throw new RewriteError(`unknown operator ${e.op}`);
      }
    }
  };
  return go(e);
}

// ── The encoding into bit-vector terms ──

interface Enc {
  t: Term;
  /** When the expression is defined. */
  def: Term;
}

export function encode(e: Expr, w: number): Enc {
  const S = bvSort(w);
  const k = (x: bigint) => bvnum(x, w);
  const mask = (1n << BigInt(w)) - 1n;
  const go = (e: Expr): Enc => {
    switch (e.k) {
      case 'var':
        return { t: v(e.name, S), def: TRUE };
      case 'num':
        return { t: k(e.value), def: TRUE };
      case 'kw':
        if (e.name === 'true' || e.name === 'false') return { t: bool(e.name === 'true'), def: TRUE };
        return { t: k(e.name === 'width' ? BigInt(w) : e.name === 'UMAX' ? mask : e.name === 'SMAX' ? mask >> 1n : 1n << BigInt(w - 1)), def: TRUE };
      case 'call': {
        const a = go(e.args[0]!);
        return { t: and(not(eq(a.t, k(0n))), eq(bvbin('bvand', a.t, bvbin('bvsub', a.t, k(1n))), k(0n))), def: a.def };
      }
      case 'un': {
        const a = go(e.a);
        return { t: e.op === '!' ? not(a.t) : bvun(e.op === '~' ? 'bvnot' : 'bvneg', a.t), def: a.def };
      }
      case 'bin': {
        const a = go(e.a);
        const b = go(e.b);
        const def = and(a.def, b.def);
        const x = a.t;
        const y = b.t;
        if (e.op === '&&') return { t: and(x, y), def };
        if (e.op === '||') return { t: or(x, y), def };
        if (x.sort.k === 'bool' && (e.op === '==' || e.op === '!=')) return { t: e.op === '==' ? eq(x, y) : not(eq(x, y)), def };
        const nz = not(eq(y, k(0n)));
        const shiftOk = bvbin('bvult', y, k(BigInt(w)));
        switch (e.op) {
          case '+': return { t: bvbin('bvadd', x, y), def };
          case '-': return { t: bvbin('bvsub', x, y), def };
          case '*': return { t: bvbin('bvmul', x, y), def };
          case '&': return { t: bvbin('bvand', x, y), def };
          case '|': return { t: bvbin('bvor', x, y), def };
          case '^': return { t: bvbin('bvxor', x, y), def };
          case '/u': return { t: bvbin('bvudiv', x, y), def: and(def, nz) };
          case '%u': return { t: bvbin('bvurem', x, y), def: and(def, nz) };
          case '/s':
          case '%s': {
            const overflow = and(eq(x, k(1n << BigInt(w - 1))), eq(y, k(mask)));
            return { t: bvbin(e.op === '/s' ? 'bvsdiv' : 'bvsrem', x, y), def: and(def, nz, not(overflow)) };
          }
          case '<<': return { t: bvbin('bvshl', x, y), def: and(def, shiftOk) };
          case '>>u': return { t: bvbin('bvlshr', x, y), def: and(def, shiftOk) };
          case '>>s': return { t: bvbin('bvashr', x, y), def: and(def, shiftOk) };
          case '==': return { t: eq(x, y), def };
          case '!=': return { t: not(eq(x, y)), def };
          case '<u': return { t: bvbin('bvult', x, y), def };
          case '<=u': return { t: bvbin('bvule', x, y), def };
          case '>u': return { t: bvbin('bvult', y, x), def };
          case '>=u': return { t: bvbin('bvule', y, x), def };
          case '<s': return { t: bvbin('bvslt', x, y), def };
          case '<=s': return { t: bvbin('bvsle', x, y), def };
          case '>s': return { t: bvbin('bvslt', y, x), def };
          case '>=s': return { t: bvbin('bvsle', y, x), def };
        }
        throw new RewriteError(`unknown operator ${e.op}`);
      }
    }
  };
  return go(e);
}

/** Gates and clauses in the bit-blasted circuit of one side of a rewrite, at width w. */
export function circuitSize(e: Expr, w: number): { gates: number; clauses: number } {
  let vars = 1;
  let clauses = 0;
  const sink = { newVar: () => ++vars, addClause: () => void clauses++, T: 1 };
  const bb = new BitBlaster(sink, () => ++vars);
  const enc = encode(e, w);
  const leaves = new Set<Term>();
  const visit = (t: Term) => {
    if (t.op === 'var') leaves.add(t);
    t.args.forEach(visit);
  };
  visit(enc.t);
  for (const l of leaves) bb.blast(l);
  const inputs = vars;
  if (enc.t.sort.k === 'bv') bb.blast(enc.t);
  else blastBool(bb, enc.t, () => ++vars);
  return { gates: vars - inputs, clauses };
}

function blastBool(bb: BitBlaster, t: Term, fresh: () => number): number {
  if (t === TRUE) return 1;
  if (t === FALSE) return -1;
  if (t.op === 'not') return -blastBool(bb, t.args[0]!, fresh);
  if (t.op === 'and' || t.op === 'or') {
    const xs = t.args.map((a) => blastBool(bb, a, fresh));
    return t.op === 'and' ? bb.andAll(xs) : bb.orAll(xs);
  }
  if (t.op === 'eq' && t.args[0]!.sort.k === 'bool') return -bb.xor(blastBool(bb, t.args[0]!, fresh), blastBool(bb, t.args[1]!, fresh));
  if (t.op === 'eq' || t.op.startsWith('bv')) return bb.predicate(t);
  return fresh();
}

// ── The verdicts ──

export interface Counterexample {
  inputs: [string, bigint][];
  lhs: Value;
  rhs: Value;
}
export interface WidthVerdict {
  width: number;
  status: 'proved' | 'refuted' | 'unknown' | 'vacuous';
  counterexample?: Counterexample;
  /** For proofs: was the SMT certificate checked? Undefined until `certify` runs. */
  certified?: boolean;
  /** For proofs: the solver's certificate, to check with `certify` (it is slower to check than to produce). */
  proof?: SmtProof;
  reason?: string;
  ms: number;
  conflicts: number;
}

export function checkAt(rw: Rewrite, w: number, opts: { conflictLimit?: number; timeout?: number; certify?: boolean } = {}): WidthVerdict {
  const t0 = Date.now();
  const L = encode(rw.lhs, w);
  const R = encode(rw.rhs, w);
  const P = rw.pre ? encode(rw.pre, w) : { t: TRUE, def: TRUE };
  const assume = and(P.def, P.t, L.def);
  const differ = or(not(R.def), L.t.sort.k === 'bool' ? not(eq(L.t, R.t)) : not(eq(L.t, R.t)));
  const r = checkSat([assume, differ], { proof: true, conflictLimit: opts.conflictLimit ?? 200000, timeout: opts.timeout ?? 20000 });
  const conflicts = r.stats.conflicts ?? 0;
  if (r.status === 'sat' && r.model) {
    const env = new Map<string, bigint>(varsOf(rw).map((n) => [n, (r.model!.vars.get(n) as bigint | undefined) ?? 0n]));
    const lhs = evaluate(rw.lhs, env, w);
    const rhs = evaluate(rw.rhs, env, w);
    const pre = rw.pre ? evaluate(rw.pre, env, w) : { v: true, defined: true };
    const replays = pre.v === true && pre.defined && lhs.defined && (!rhs.defined || lhs.v !== rhs.v);
    if (!replays) return { width: w, status: 'unknown', reason: 'the solver’s counterexample did not replay', ms: Date.now() - t0, conflicts };
    return { width: w, status: 'refuted', counterexample: { inputs: [...env], lhs, rhs }, ms: Date.now() - t0, conflicts };
  }
  if (r.status === 'unsat') {
    const proof = r.proof;
    const certified = opts.certify === false || !proof ? undefined : checkUnsatCertificate(proof).ok;
    // A precondition that never holds proves everything.
    const vac = checkSat([assume], { conflictLimit: opts.conflictLimit ?? 200000 });
    if (vac.status === 'unsat') return { width: w, status: 'vacuous', reason: 'the precondition never holds (with the left side defined)', ms: Date.now() - t0, conflicts, certified, proof };
    return { width: w, status: 'proved', certified, proof, ms: Date.now() - t0, conflicts };
  }
  return { width: w, status: 'unknown', reason: r.reason ?? 'the solver gave up', ms: Date.now() - t0, conflicts };
}

/** Check a proof's certificate (DRAT for the Boolean part, each theory lemma on its own terms). */
export function certify(v: WidthVerdict): boolean {
  return !!v.proof && checkUnsatCertificate(v.proof).ok;
}

/** Show a width-w value in binary (grouped by 4) and hex, with its signed reading when it differs. */
export function showValue(x: bigint | boolean, w: number): { bin: string; hex: string; dec: string } {
  if (typeof x === 'boolean') return { bin: '', hex: '', dec: String(x) };
  const bin = x.toString(2).padStart(w, '0').replace(/(.{4})(?=.)/g, '$1 ');
  const hex = '0x' + x.toString(16).padStart(Math.ceil(w / 4), '0');
  const signed = BigInt.asIntN(w, x);
  return { bin, hex, dec: signed === x ? String(x) : `${x} (signed ${signed})` };
}

export function showExpr(e: Expr): string {
  const prec = (e: Expr): number => (e.k === 'bin' ? BIN_LEVELS.findIndex((l) => l.includes(e.op)) : 99);
  const go = (e: Expr, ctx: number): string => {
    let s: string;
    switch (e.k) {
      case 'var': s = e.name; break;
      case 'num': s = String(e.value); break;
      case 'kw': s = e.name; break;
      case 'call': s = `${e.name}(${e.args.map((a) => go(a, 0)).join(', ')})`; break;
      case 'un': s = `${e.op}${go(e.a, 99)}`; break;
      case 'bin': {
        const p = prec(e);
        s = `${go(e.a, p)} ${e.op} ${go(e.b, p + 1)}`;
        if (p < ctx) s = `(${s})`;
        break;
      }
    }
    return s;
  };
  return go(e, 0);
}

