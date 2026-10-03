/**
 * TRUSTED (the evaluator at the end, which checks every model). First-order terms over the sorts the course needs:
 * Booleans, integers, bit-vectors, arrays and uninterpreted sorts, with uninterpreted functions and quantifiers.
 *
 * Terms are hash-consed: building the same term twice returns the same object, so terms can be compared with ===
 * and used as map keys. Builders simplify a little (constant folding, flattening, true/false absorption); the
 * plain constructor `mk` does not.
 */

export type Sort =
  | { k: 'bool' }
  | { k: 'int' }
  | { k: 'bv'; w: number }
  | { k: 'array'; idx: Sort; elem: Sort }
  | { k: 'u'; name: string };

export const BOOL: Sort = { k: 'bool' };
export const INT: Sort = { k: 'int' };
export const bvSort = (w: number): Sort => ({ k: 'bv', w });
export const arraySort = (idx: Sort, elem: Sort): Sort => ({ k: 'array', idx, elem });
export const uSort = (name: string): Sort => ({ k: 'u', name });

export function sortKey(s: Sort): string {
  switch (s.k) {
    case 'bool':
      return 'Bool';
    case 'int':
      return 'Int';
    case 'bv':
      return `(_ BitVec ${s.w})`;
    case 'array':
      return `(Array ${sortKey(s.idx)} ${sortKey(s.elem)})`;
    case 'u':
      return s.name;
  }
}
export const sortEq = (a: Sort, b: Sort) => sortKey(a) === sortKey(b);

export type Op =
  | 'true' | 'false' | 'num' | 'bvnum' | 'var'
  | 'not' | 'and' | 'or' | 'imp' | 'iff' | 'xor' | 'ite' | 'eq' | 'distinct'
  | 'add' | 'sub' | 'mul' | 'neg' | 'div' | 'mod' | 'le' | 'lt' | 'ge' | 'gt'
  | 'app' | 'select' | 'store'
  | 'forall' | 'exists'
  | 'bvadd' | 'bvsub' | 'bvmul' | 'bvudiv' | 'bvurem' | 'bvsdiv' | 'bvsrem' | 'bvneg'
  | 'bvand' | 'bvor' | 'bvxor' | 'bvnot' | 'bvshl' | 'bvlshr' | 'bvashr'
  | 'bvult' | 'bvule' | 'bvslt' | 'bvsle' | 'concat' | 'extract' | 'zext' | 'sext';

export interface Term {
  readonly id: number;
  readonly op: Op;
  readonly args: readonly Term[];
  readonly sort: Sort;
  /** Variables and function applications. */
  readonly name?: string;
  /** Numerals (and bit-vector literals, unsigned). */
  readonly value?: bigint;
  /** Quantifiers: the bound variables (as 'var' terms) and the triggers. */
  readonly bound?: readonly Term[];
  readonly triggers?: readonly (readonly Term[])[];
  /** extract: [hi, lo]; zext/sext: [extra bits]. */
  readonly params?: readonly number[];
}

const table = new Map<string, Term>();
let nextId = 1;

export function mk(op: Op, args: readonly Term[], sort: Sort, extra: { name?: string; value?: bigint; bound?: readonly Term[]; triggers?: readonly (readonly Term[])[]; params?: readonly number[] } = {}): Term {
  const key = `${op}|${extra.name ?? ''}|${extra.value ?? ''}|${sortKey(sort)}|${args.map((a) => a.id).join(',')}|${extra.bound?.map((b) => b.id).join(',') ?? ''}|${extra.triggers?.map((t) => t.map((x) => x.id).join(',')).join(';') ?? ''}|${extra.params?.join(',') ?? ''}`;
  let t = table.get(key);
  if (!t) {
    t = { id: nextId++, op, args, sort, ...extra };
    table.set(key, t);
  }
  return t;
}

// ── Constants and variables ──
export const TRUE = mk('true', [], BOOL);
export const FALSE = mk('false', [], BOOL);
export const bool = (b: boolean) => (b ? TRUE : FALSE);
export const num = (n: bigint | number) => mk('num', [], INT, { value: BigInt(n) });
export const bvnum = (n: bigint, w: number) => mk('bvnum', [], bvSort(w), { value: BigInt.asUintN(w, n) });
export const v = (name: string, sort: Sort = INT) => mk('var', [], sort, { name });
export const app = (name: string, args: readonly Term[], sort: Sort) => mk('app', args, sort, { name });

let fresh = 0;
/** A fresh variable (for Skolem constants, Tseitin and purification). */
export function freshVar(prefix: string, sort: Sort): Term {
  return v(`${prefix}!${++fresh}`, sort);
}

// ── Boolean builders (with light simplification) ──
export function not(a: Term): Term {
  if (a === TRUE) return FALSE;
  if (a === FALSE) return TRUE;
  if (a.op === 'not') return a.args[0]!;
  return mk('not', [a], BOOL);
}

export function and(...xs: Term[]): Term {
  const out: Term[] = [];
  for (const x of xs.flatMap((y) => (y.op === 'and' ? y.args : [y]))) {
    if (x === FALSE) return FALSE;
    if (x === TRUE || out.includes(x)) continue;
    out.push(x);
  }
  if (!out.length) return TRUE;
  if (out.length === 1) return out[0]!;
  return mk('and', out, BOOL);
}

export function or(...xs: Term[]): Term {
  const out: Term[] = [];
  for (const x of xs.flatMap((y) => (y.op === 'or' ? y.args : [y]))) {
    if (x === TRUE) return TRUE;
    if (x === FALSE || out.includes(x)) continue;
    out.push(x);
  }
  if (!out.length) return FALSE;
  if (out.length === 1) return out[0]!;
  return mk('or', out, BOOL);
}

export const imp = (a: Term, b: Term) => (a === TRUE ? b : a === FALSE || b === TRUE ? TRUE : b === FALSE ? not(a) : mk('imp', [a, b], BOOL));
export const iff = (a: Term, b: Term) => (a === b ? TRUE : a === TRUE ? b : b === TRUE ? a : a === FALSE ? not(b) : b === FALSE ? not(a) : mk('iff', [a, b], BOOL));

export function ite(c: Term, a: Term, b: Term): Term {
  if (c === TRUE || a === b) return a;
  if (c === FALSE) return b;
  if (a.sort.k === 'bool') {
    if (a === TRUE && b === FALSE) return c;
    if (a === FALSE && b === TRUE) return not(c);
  }
  return mk('ite', [c, a, b], a.sort);
}

export function eq(a: Term, b: Term): Term {
  if (a === b) return TRUE;
  if ((a.op === 'num' && b.op === 'num') || (a.op === 'bvnum' && b.op === 'bvnum')) return bool(a.value === b.value);
  if (a.sort.k === 'bool') return iff(a, b);
  return a.id < b.id ? mk('eq', [a, b], BOOL) : mk('eq', [b, a], BOOL);
}

// ── Integer builders ──
const isNum = (t: Term) => t.op === 'num';

export function add(...xs: Term[]): Term {
  let c = 0n;
  const out: Term[] = [];
  for (const x of xs.flatMap((y) => (y.op === 'add' ? y.args : [y]))) {
    if (isNum(x)) c += x.value!;
    else out.push(x);
  }
  if (c !== 0n || !out.length) out.push(num(c));
  return out.length === 1 ? out[0]! : mk('add', out, INT);
}
export const sub = (a: Term, b: Term) => (isNum(a) && isNum(b) ? num(a.value! - b.value!) : isNum(b) && b.value === 0n ? a : mk('sub', [a, b], INT));
export function mul(a: Term, b: Term): Term {
  if (isNum(a) && isNum(b)) return num(a.value! * b.value!);
  if ((isNum(a) && a.value === 0n) || (isNum(b) && b.value === 0n)) return num(0);
  if (isNum(a) && a.value === 1n) return b;
  if (isNum(b) && b.value === 1n) return a;
  return mk('mul', isNum(b) && !isNum(a) ? [b, a] : [a, b], INT);
}
export const neg = (a: Term) => (isNum(a) ? num(-a.value!) : mk('neg', [a], INT));
/** Integer division and remainder, SMT-LIB semantics (Euclidean: remainder in [0, |d|)). */
export const div = (a: Term, b: Term) => mk('div', [a, b], INT);
export const mod = (a: Term, b: Term) => mk('mod', [a, b], INT);
const cmpFold = (op: 'le' | 'lt' | 'ge' | 'gt', a: Term, b: Term): Term => {
  if (isNum(a) && isNum(b)) {
    const x = a.value!;
    const y = b.value!;
    return bool(op === 'le' ? x <= y : op === 'lt' ? x < y : op === 'ge' ? x >= y : x > y);
  }
  if (a === b) return bool(op === 'le' || op === 'ge');
  return mk(op, [a, b], BOOL);
};
export const le = (a: Term, b: Term) => cmpFold('le', a, b);
export const lt = (a: Term, b: Term) => cmpFold('lt', a, b);
export const ge = (a: Term, b: Term) => cmpFold('ge', a, b);
export const gt = (a: Term, b: Term) => cmpFold('gt', a, b);

// ── Arrays ──
export function select(a: Term, i: Term): Term {
  if (a.sort.k !== 'array') throw new Error('select on a non-array');
  // Read over write, when the indices are distinct numerals or the same term.
  if (a.op === 'store') {
    const [base, j, val] = a.args as [Term, Term, Term];
    if (j === i) return val;
    if ((j.op === 'num' || j.op === 'bvnum') && (i.op === 'num' || i.op === 'bvnum') && j.value !== i.value) return select(base, i);
  }
  return mk('select', [a, i], a.sort.elem);
}
export const store = (a: Term, i: Term, x: Term) => mk('store', [a, i, x], a.sort);

// ── Quantifiers ──
export function forall(bound: Term[], body: Term, triggers: Term[][] = []): Term {
  if (!bound.length || body.op === 'true' || body.op === 'false') return body;
  return mk('forall', [body], BOOL, { bound, triggers });
}
export function exists(bound: Term[], body: Term, triggers: Term[][] = []): Term {
  if (!bound.length || body.op === 'true' || body.op === 'false') return body;
  return mk('exists', [body], BOOL, { bound, triggers });
}

// ── Bit-vectors ──
export const bvbin = (op: Op, a: Term, b: Term) => mk(op, [a, b], ['bvult', 'bvule', 'bvslt', 'bvsle'].includes(op) ? BOOL : a.sort);
export const bvun = (op: 'bvnot' | 'bvneg', a: Term) => mk(op, [a], a.sort);
export const extract = (a: Term, hi: number, lo: number) => mk('extract', [a], bvSort(hi - lo + 1), { params: [hi, lo] });
export const zext = (a: Term, n: number) => mk('zext', [a], bvSort((a.sort as { w: number }).w + n), { params: [n] });
export const sext = (a: Term, n: number) => mk('sext', [a], bvSort((a.sort as { w: number }).w + n), { params: [n] });
export const concat = (a: Term, b: Term) => mk('concat', [a, b], bvSort((a.sort as { w: number }).w + (b.sort as { w: number }).w));

// ── Traversal ──
/** Rebuild a term bottom-up. `f` is called after the children are mapped. */
export function mapTerm(t: Term, f: (t: Term) => Term | undefined, memo = new Map<Term, Term>()): Term {
  const m = memo.get(t);
  if (m) return m;
  let out: Term;
  if (!t.args.length) out = f(t) ?? t;
  else {
    const args = t.args.map((a) => mapTerm(a, f, memo));
    const same = args.every((a, i) => a === t.args[i]);
    const rebuilt = same ? t : rebuild(t, args);
    out = f(rebuilt) ?? rebuilt;
  }
  memo.set(t, out);
  return out;
}

/** The same operator applied to new arguments (through the simplifying builders where there are some). */
export function rebuild(t: Term, args: Term[]): Term {
  switch (t.op) {
    case 'not':
      return not(args[0]!);
    case 'and':
      return and(...args);
    case 'or':
      return or(...args);
    case 'imp':
      return imp(args[0]!, args[1]!);
    case 'iff':
      return iff(args[0]!, args[1]!);
    case 'ite':
      return ite(args[0]!, args[1]!, args[2]!);
    case 'eq':
      return eq(args[0]!, args[1]!);
    case 'add':
      return add(...args);
    case 'sub':
      return sub(args[0]!, args[1]!);
    case 'mul':
      return mul(args[0]!, args[1]!);
    case 'neg':
      return neg(args[0]!);
    case 'le':
      return le(args[0]!, args[1]!);
    case 'lt':
      return lt(args[0]!, args[1]!);
    case 'ge':
      return ge(args[0]!, args[1]!);
    case 'gt':
      return gt(args[0]!, args[1]!);
    case 'select':
      return select(args[0]!, args[1]!);
    default:
      return mk(t.op, args, t.sort, { name: t.name, value: t.value, bound: t.bound, triggers: t.triggers, params: t.params });
  }
}

/** Substitute terms for variables (capture is impossible: bound variables are fresh per quantifier). */
export function subst(t: Term, map: Map<Term, Term>): Term {
  if (!map.size) return t;
  return mapTerm(t, (x) => (x.op === 'var' ? map.get(x) : undefined));
}

/** Free variables. */
export function freeVars(t: Term, out = new Set<Term>(), bound = new Set<Term>()): Set<Term> {
  if (t.op === 'var') {
    if (!bound.has(t)) out.add(t);
    return out;
  }
  if (t.op === 'forall' || t.op === 'exists') {
    const b = new Set(bound);
    for (const x of t.bound ?? []) b.add(x);
    freeVars(t.args[0]!, out, b);
    for (const tr of t.triggers ?? []) for (const x of tr) freeVars(x, out, b);
    return out;
  }
  for (const a of t.args) freeVars(a, out, bound);
  return out;
}

export function subterms(t: Term, out = new Set<Term>()): Set<Term> {
  if (out.has(t)) return out;
  out.add(t);
  for (const a of t.args) subterms(a, out);
  return out;
}

// ── Printing ──
const SMT_OP: Partial<Record<Op, string>> = {
  not: 'not', and: 'and', or: 'or', imp: '=>', iff: '=', xor: 'xor', ite: 'ite', eq: '=', distinct: 'distinct',
  add: '+', sub: '-', mul: '*', neg: '-', div: 'div', mod: 'mod', le: '<=', lt: '<', ge: '>=', gt: '>',
  select: 'select', store: 'store',
};

export function smtlib(t: Term): string {
  switch (t.op) {
    case 'true':
      return 'true';
    case 'false':
      return 'false';
    case 'num':
      return t.value! < 0n ? `(- ${-t.value!})` : t.value!.toString();
    case 'bvnum':
      return `(_ bv${t.value} ${(t.sort as { w: number }).w})`;
    case 'var':
      return quoteName(t.name!);
    case 'app':
      return t.args.length ? `(${quoteName(t.name!)} ${t.args.map(smtlib).join(' ')})` : quoteName(t.name!);
    case 'forall':
    case 'exists': {
      const body = smtlib(t.args[0]!);
      const pats = t.triggers?.length ? `(! ${body} ${t.triggers.map((tr) => `:pattern (${tr.map(smtlib).join(' ')})`).join(' ')})` : body;
      return `(${t.op} (${t.bound!.map((b) => `(${quoteName(b.name!)} ${sortKey(b.sort)})`).join(' ')}) ${pats})`;
    }
    case 'extract':
      return `((_ extract ${t.params![0]} ${t.params![1]}) ${smtlib(t.args[0]!)})`;
    case 'zext':
      return `((_ zero_extend ${t.params![0]}) ${smtlib(t.args[0]!)})`;
    case 'sext':
      return `((_ sign_extend ${t.params![0]}) ${smtlib(t.args[0]!)})`;
    default:
      return `(${SMT_OP[t.op] ?? t.op} ${t.args.map(smtlib).join(' ')})`;
  }
}

function quoteName(n: string): string {
  return /^[A-Za-z_][\w.!$]*$/.test(n) && !/^(true|false|and|or|not)$/.test(n) ? n : `|${n.replace(/\|/g, '_')}|`;
}

/** An SMT-LIB script declaring the free symbols of the assertions (for Z3 and for the VC inspector). */
export function smtlibScript(assertions: Term[]): string {
  const vars = new Map<string, Sort>();
  const funs = new Map<string, { args: Sort[]; ret: Sort }>();
  const sorts = new Set<string>();
  const walkSort = (s: Sort) => {
    if (s.k === 'u') sorts.add(s.name);
    if (s.k === 'array') {
      walkSort(s.idx);
      walkSort(s.elem);
    }
  };
  for (const a of assertions) {
    for (const x of freeVars(a)) {
      vars.set(x.name!, x.sort);
      walkSort(x.sort);
    }
    for (const s of subterms(a)) {
      if (s.op === 'app') funs.set(s.name!, { args: s.args.map((x) => x.sort), ret: s.sort });
      walkSort(s.sort);
      for (const b of s.bound ?? []) walkSort(b.sort);
    }
  }
  const lines = [
    ...[...sorts].map((s) => `(declare-sort ${s} 0)`),
    ...[...vars].map(([n, s]) => `(declare-const ${quoteName(n)} ${sortKey(s)})`),
    ...[...funs].map(([n, f]) => `(declare-fun ${quoteName(n)} (${f.args.map(sortKey).join(' ')}) ${sortKey(f.ret)})`),
    ...assertions.map((a) => `(assert ${smtlib(a)})`),
  ];
  return lines.join('\n') + '\n';
}

/** A readable, mathematical rendering (for the VC inspector and the DPLL(T) widget). */
export function pretty(t: Term): string {
  const p = (x: Term) => (x.args.length && !['app', 'select', 'neg', 'not', 'extract'].includes(x.op) ? `(${pretty(x)})` : pretty(x));
  switch (t.op) {
    case 'true':
    case 'false':
      return t.op;
    case 'num':
    case 'bvnum':
      return t.value!.toString();
    case 'var':
      return t.name!;
    case 'app':
      return t.args.length ? `${t.name}(${t.args.map(pretty).join(', ')})` : t.name!;
    case 'not':
      return `¬${p(t.args[0]!)}`;
    case 'and':
      return t.args.map(p).join(' ∧ ');
    case 'or':
      return t.args.map(p).join(' ∨ ');
    case 'imp':
      return `${p(t.args[0]!)} ⟹ ${p(t.args[1]!)}`;
    case 'iff':
      return `${p(t.args[0]!)} ⟺ ${p(t.args[1]!)}`;
    case 'eq':
      return `${p(t.args[0]!)} = ${p(t.args[1]!)}`;
    case 'ite':
      return `if ${pretty(t.args[0]!)} then ${pretty(t.args[1]!)} else ${pretty(t.args[2]!)}`;
    case 'add':
      return t.args.map(p).join(' + ');
    case 'sub':
      return `${p(t.args[0]!)} − ${p(t.args[1]!)}`;
    case 'mul':
      return `${p(t.args[0]!)}·${p(t.args[1]!)}`;
    case 'neg':
      return `−${p(t.args[0]!)}`;
    case 'le':
      return `${p(t.args[0]!)} ≤ ${p(t.args[1]!)}`;
    case 'lt':
      return `${p(t.args[0]!)} < ${p(t.args[1]!)}`;
    case 'ge':
      return `${p(t.args[0]!)} ≥ ${p(t.args[1]!)}`;
    case 'gt':
      return `${p(t.args[0]!)} > ${p(t.args[1]!)}`;
    case 'select':
      return `${p(t.args[0]!)}[${pretty(t.args[1]!)}]`;
    case 'store':
      return `${p(t.args[0]!)}[${pretty(t.args[1]!)} ↦ ${pretty(t.args[2]!)}]`;
    case 'forall':
    case 'exists':
      return `${t.op === 'forall' ? '∀' : '∃'}${t.bound!.map((b) => b.name).join(',')}. ${pretty(t.args[0]!)}`;
    default:
      return `${t.op}(${t.args.map(pretty).join(', ')})`;
  }
}

// ── Evaluation (TRUSTED: this is how models are checked) ──

export type MValue = boolean | bigint | { arr: { def: MValue; entries: Map<string, MValue> } } | { u: string };

export interface Model {
  /** Values of free variables, by name. */
  vars: Map<string, MValue>;
  /** Interpretations of uninterpreted functions: argument key → value, with a default. */
  funs: Map<string, { entries: Map<string, MValue>; def: MValue }>;
}

export const mvKey = (x: MValue): string => (typeof x === 'object' ? ('u' in x ? `u:${x.u}` : `arr:${mvKey(x.arr.def)}{${[...x.arr.entries].sort().map(([k, y]) => `${k}=${mvKey(y)}`).join(',')}}`) : String(x));

const euclidDiv = (a: bigint, b: bigint): bigint => {
  const q = a / b;
  const r = a - q * b;
  if (r < 0n) return b > 0n ? q - 1n : q + 1n;
  return q;
};
const euclidMod = (a: bigint, b: bigint): bigint => {
  const r = a % b;
  return r < 0n ? r + (b < 0n ? -b : b) : r;
};

/** Evaluate a ground term (or a term whose free variables the model gives). Quantifiers are not evaluated. */
export function evaluate(t: Term, m: Model, env = new Map<Term, MValue>()): MValue {
  const ev = (x: Term) => evaluate(x, m, env);
  const w = (x: Term) => (x.sort as { w: number }).w;
  switch (t.op) {
    case 'true':
      return true;
    case 'false':
      return false;
    case 'num':
    case 'bvnum':
      return t.value!;
    case 'var': {
      const b = env.get(t);
      if (b !== undefined) return b;
      const x = m.vars.get(t.name!);
      if (x === undefined) return defaultOf(t.sort);
      return x;
    }
    case 'app': {
      const f = m.funs.get(t.name!);
      const k = t.args.map((a) => mvKey(ev(a))).join(',');
      return f?.entries.get(k) ?? f?.def ?? defaultOf(t.sort);
    }
    case 'not':
      return !ev(t.args[0]!);
    case 'and':
      return t.args.every((a) => ev(a) === true);
    case 'or':
      return t.args.some((a) => ev(a) === true);
    case 'imp':
      return !ev(t.args[0]!) || ev(t.args[1]!) === true;
    case 'iff':
      return ev(t.args[0]!) === ev(t.args[1]!);
    case 'xor':
      return ev(t.args[0]!) !== ev(t.args[1]!);
    case 'ite':
      return ev(t.args[0]!) ? ev(t.args[1]!) : ev(t.args[2]!);
    case 'eq':
      return mvKey(ev(t.args[0]!)) === mvKey(ev(t.args[1]!));
    case 'distinct': {
      const ks = t.args.map((a) => mvKey(ev(a)));
      return new Set(ks).size === ks.length;
    }
    case 'add':
      return t.args.reduce<bigint>((s, a) => s + (ev(a) as bigint), 0n);
    case 'sub':
      return (ev(t.args[0]!) as bigint) - (ev(t.args[1]!) as bigint);
    case 'mul':
      return (ev(t.args[0]!) as bigint) * (ev(t.args[1]!) as bigint);
    case 'neg':
      return -(ev(t.args[0]!) as bigint);
    case 'div': {
      const b = ev(t.args[1]!) as bigint;
      return b === 0n ? 0n : euclidDiv(ev(t.args[0]!) as bigint, b);
    }
    case 'mod': {
      const b = ev(t.args[1]!) as bigint;
      return b === 0n ? ev(t.args[0]!) : euclidMod(ev(t.args[0]!) as bigint, b);
    }
    case 'le':
      return (ev(t.args[0]!) as bigint) <= (ev(t.args[1]!) as bigint);
    case 'lt':
      return (ev(t.args[0]!) as bigint) < (ev(t.args[1]!) as bigint);
    case 'ge':
      return (ev(t.args[0]!) as bigint) >= (ev(t.args[1]!) as bigint);
    case 'gt':
      return (ev(t.args[0]!) as bigint) > (ev(t.args[1]!) as bigint);
    case 'select': {
      const a = ev(t.args[0]!) as { arr: { def: MValue; entries: Map<string, MValue> } };
      const i = mvKey(ev(t.args[1]!));
      return a.arr.entries.get(i) ?? a.arr.def;
    }
    case 'store': {
      const a = ev(t.args[0]!) as { arr: { def: MValue; entries: Map<string, MValue> } };
      const entries = new Map(a.arr.entries);
      entries.set(mvKey(ev(t.args[1]!)), ev(t.args[2]!));
      return { arr: { def: a.arr.def, entries } };
    }
    case 'forall':
    case 'exists':
      throw new Error('Quantified formulas are not evaluated in a model.');
    // Bit-vectors.
    case 'bvadd':
      return BigInt.asUintN(w(t), (ev(t.args[0]!) as bigint) + (ev(t.args[1]!) as bigint));
    case 'bvsub':
      return BigInt.asUintN(w(t), (ev(t.args[0]!) as bigint) - (ev(t.args[1]!) as bigint));
    case 'bvmul':
      return BigInt.asUintN(w(t), (ev(t.args[0]!) as bigint) * (ev(t.args[1]!) as bigint));
    case 'bvneg':
      return BigInt.asUintN(w(t), -(ev(t.args[0]!) as bigint));
    case 'bvudiv': {
      const b = ev(t.args[1]!) as bigint;
      return b === 0n ? (1n << BigInt(w(t))) - 1n : (ev(t.args[0]!) as bigint) / b;
    }
    case 'bvurem': {
      const b = ev(t.args[1]!) as bigint;
      return b === 0n ? ev(t.args[0]!) : (ev(t.args[0]!) as bigint) % b;
    }
    case 'bvsdiv':
    case 'bvsrem': {
      const n = w(t);
      const a = BigInt.asIntN(n, ev(t.args[0]!) as bigint);
      const b = BigInt.asIntN(n, ev(t.args[1]!) as bigint);
      if (b === 0n) return t.op === 'bvsdiv' ? BigInt.asUintN(n, a < 0n ? 1n : -1n) : BigInt.asUintN(n, a);
      return BigInt.asUintN(n, t.op === 'bvsdiv' ? a / b : a % b);
    }
    case 'bvand':
      return (ev(t.args[0]!) as bigint) & (ev(t.args[1]!) as bigint);
    case 'bvor':
      return (ev(t.args[0]!) as bigint) | (ev(t.args[1]!) as bigint);
    case 'bvxor':
      return (ev(t.args[0]!) as bigint) ^ (ev(t.args[1]!) as bigint);
    case 'bvnot':
      return BigInt.asUintN(w(t), ~(ev(t.args[0]!) as bigint));
    case 'bvshl': {
      const k = ev(t.args[1]!) as bigint;
      return k >= BigInt(w(t)) ? 0n : BigInt.asUintN(w(t), (ev(t.args[0]!) as bigint) << k);
    }
    case 'bvlshr': {
      const k = ev(t.args[1]!) as bigint;
      return k >= BigInt(w(t)) ? 0n : (ev(t.args[0]!) as bigint) >> k;
    }
    case 'bvashr': {
      const n = w(t);
      const k = ev(t.args[1]!) as bigint;
      const a = BigInt.asIntN(n, ev(t.args[0]!) as bigint);
      return BigInt.asUintN(n, k >= BigInt(n) ? (a < 0n ? -1n : 0n) : a >> k);
    }
    case 'bvult':
      return (ev(t.args[0]!) as bigint) < (ev(t.args[1]!) as bigint);
    case 'bvule':
      return (ev(t.args[0]!) as bigint) <= (ev(t.args[1]!) as bigint);
    case 'bvslt':
    case 'bvsle': {
      const n = w(t.args[0]!);
      const a = BigInt.asIntN(n, ev(t.args[0]!) as bigint);
      const b = BigInt.asIntN(n, ev(t.args[1]!) as bigint);
      return t.op === 'bvslt' ? a < b : a <= b;
    }
    case 'concat':
      return ((ev(t.args[0]!) as bigint) << BigInt(w(t.args[1]!))) | (ev(t.args[1]!) as bigint);
    case 'extract': {
      const [hi, lo] = t.params as [number, number];
      return BigInt.asUintN(hi - lo + 1, (ev(t.args[0]!) as bigint) >> BigInt(lo));
    }
    case 'zext':
      return ev(t.args[0]!);
    case 'sext': {
      const n = w(t.args[0]!);
      return BigInt.asUintN(w(t), BigInt.asIntN(n, ev(t.args[0]!) as bigint));
    }
  }
}

export function defaultOf(s: Sort): MValue {
  switch (s.k) {
    case 'bool':
      return false;
    case 'int':
    case 'bv':
      return 0n;
    case 'array':
      return { arr: { def: defaultOf(s.elem), entries: new Map() } };
    case 'u':
      return { u: `${s.name}!0` };
  }
}
