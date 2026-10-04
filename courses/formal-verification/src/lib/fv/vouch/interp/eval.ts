/**
 * The reference evaluator for Vouch expressions: the semantics every engine is tested against.
 *
 * Every proof obligation of docs/VOUCH.md becomes a run-time check here: overflow of machine integers, array bounds,
 * division by zero, null dereferences, narrowing conversions. A failed check throws a RuntimeFailure naming the
 * obligation and the source span, which is exactly what a verifier's counterexample must reproduce.
 *
 * Quantifiers are evaluated by enumeration. A bound variable of a finite type ranges over the type; an integer
 * variable needs bounds, read from the condition (`0 <= i < len(a) ==> …`); otherwise the quantifier cannot be
 * evaluated and an `unbounded-quantifier` failure says so (the contract is then reported as not checked at run time).
 */
import type * as A from '../syntax/ast';
import type { Span } from '../syntax/lexer';
import type { Checked, FnInfo } from '../check/checker';
import type { Sym } from '../check/symbols';
import { machBounds, intBounds, type Ty } from '../check/types';
import {
  compare, defaultValue, enumerate, equal, funcGet, funcSet, mset, rel, seq, set, show,
  type FuncV, type MapV, type MsetV, type RelV, type SeqV, type SetV, type StructV, type Value,
} from './values';

export type FailureKind =
  | 'precondition'
  | 'postcondition'
  | 'assert'
  | 'invariant-entry'
  | 'invariant-preserved'
  | 'decreases'
  | 'overflow'
  | 'bounds'
  | 'division'
  | 'null'
  | 'use-after-free'
  | 'range'
  | 'narrowing'
  | 'fuel'
  | 'unbounded-quantifier'
  | 'heap'
  | 'match'
  | 'internal';

export class RuntimeFailure extends Error {
  constructor(
    readonly kind: FailureKind,
    readonly span: Span,
    message: string,
    readonly values: Record<string, string> = {},
  ) {
    super(message);
  }
}

export interface HeapObj {
  cls: string;
  fields: Value[];
  freed: boolean;
}

export class Heap {
  objs: HeapObj[] = [];
  alloc(cls: string, fields: Value[]): Value {
    this.objs.push({ cls, fields, freed: false });
    return { t: 'ref', addr: this.objs.length };
  }
  get(addr: number): HeapObj | undefined {
    return this.objs[addr - 1];
  }
  clone(): Heap {
    const h = new Heap();
    h.objs = this.objs.map((o) => ({ cls: o.cls, fields: [...o.fields], freed: o.freed }));
    return h;
  }
}

export interface Env {
  vals: Map<number, Value>;
  /** Values at function entry, for old(…). */
  old?: Env;
  heap: Heap;
  /** For `P(i) at label` in systems. */
  at?: (proc: Sym, args: Value[], label: string) => boolean;
  /** For worlds: the atoms of each type. */
  universe?: Map<string, number>;
}

export interface EvalOptions {
  /** Steps before giving up (runaway recursion in pure functions). */
  fuel: number;
  /** Largest number of values a quantifier may enumerate. */
  maxEnum: number;
  /**
   * Interpretations of bodiless (uninterpreted) pure functions, e.g. from a solver's model, so that a
   * counterexample that depends on them can be replayed.
   */
  externals?: Map<string, (args: Value[]) => Value | undefined>;
}

const truncDiv = (a: bigint, b: bigint) => a / b; // BigInt division truncates toward zero, as in Java, C and Rust
const truncRem = (a: bigint, b: bigint) => a % b;

export class Evaluator {
  steps = 0;
  readonly opts: EvalOptions;
  constructor(
    readonly checked: Checked,
    opts: Partial<EvalOptions> = {},
  ) {
    this.opts = { fuel: 2_000_000, maxEnum: 200_000, ...opts };
  }

  tick(span: Span): void {
    if (++this.steps > this.opts.fuel) throw new RuntimeFailure('fuel', span, `Gave up after ${this.opts.fuel.toLocaleString('en-GB')} steps: the computation may not terminate.`);
  }

  typeOf(e: A.Expr): Ty | undefined {
    return this.checked.types.get(e);
  }

  sym(node: object): Sym {
    const s = this.checked.refs.get(node);
    if (!s) throw new RuntimeFailure('internal', (node as { span?: Span }).span ?? { start: 0, end: 0 }, 'Unresolved name (the program has type errors).');
    return s;
  }

  /** Check that an integer fits its static type; report as `kind`. */
  fit(v: bigint, t: Ty | undefined, span: Span, kind: FailureKind, what: string): bigint {
    if (!t) return v;
    if (t.k === 'bv') return BigInt.asUintN(t.bits, v);
    const [lo, hi] = intBounds(t);
    if ((lo !== undefined && v < lo) || (hi !== undefined && v > hi)) {
      const range = t.k === 'nat' ? 'nat (≥ 0)' : `${lo}…${hi}`;
      throw new RuntimeFailure(kind, span, `${what}: ${v} is outside ${range}.`, { value: v.toString() });
    }
    return v;
  }

  eval(e: A.Expr, env: Env): Value {
    this.tick(e.span);
    switch (e.k) {
      case 'int':
        return e.value;
      case 'bool':
        return e.value;
      case 'null':
        return null;
      case 'emp':
        return true;
      case 'var':
        return this.varValue(e, env);
      case 'unary':
        return this.unary(e, env);
      case 'binary':
        return this.binary(e, env);
      case 'chain': {
        let prev = this.eval(e.args[0]!, env) as bigint;
        for (let i = 0; i < e.ops.length; i++) {
          const next = this.eval(e.args[i + 1]!, env) as bigint;
          if (!cmp(e.ops[i]!, prev, next)) return false;
          prev = next;
        }
        return true;
      }
      case 'call':
        return this.call(e, env);
      case 'index': {
        const t = this.eval(e.target, env);
        return this.index(e, t, e.indices.map((i) => this.eval(i, env)));
      }
      case 'slice': {
        const s = this.eval(e.target, env) as SeqV;
        const n = BigInt(s.items.length);
        const lo = e.lo ? (this.eval(e.lo, env) as bigint) : 0n;
        const hi = e.hi ? (this.eval(e.hi, env) as bigint) : n;
        if (lo < 0n || hi > n || lo > hi) throw new RuntimeFailure('bounds', e.span, `Slice [${lo}..${hi}] of a sequence of length ${n}.`, { lo: lo.toString(), hi: hi.toString(), length: n.toString() });
        return seq(s.items.slice(Number(lo), Number(hi)));
      }
      case 'update': {
        const t = this.eval(e.target, env);
        const i = this.eval(e.index, env);
        const v = this.eval(e.value, env);
        return this.store(t, [i], v, e.span);
      }
      case 'field':
        return this.field(e, env);
      case 'struct': {
        const st = this.typeOf(e);
        if (!st || st.k !== 'struct') throw new RuntimeFailure('internal', e.span, 'Untyped struct literal.');
        return { t: 'struct', name: st.name, fields: st.fields.map((f) => this.eval(e.fields.find((x) => x.name === f.name)!.value, env)) };
      }
      case 'new': {
        const rt = this.typeOf(e);
        const cls = rt?.k === 'ref' ? this.checked.globals.lookup(rt.cls)?.ty : undefined;
        if (!cls || cls.k !== 'struct') throw new RuntimeFailure('internal', e.span, 'Unknown class.');
        return env.heap.alloc(cls.name, cls.fields.map((f) => {
          const init = e.fields.find((x) => x.name === f.name);
          return init ? this.eval(init.value, env) : defaultValue(f.ty);
        }));
      }
      case 'seqlit':
        return seq(e.elems.map((x) => this.eval(x, env)));
      case 'setlit': {
        const items = e.elems.map((x) => this.eval(x, env));
        return this.typeOf(e)?.k === 'multiset' ? mset(items) : set(items);
      }
      case 'tuple':
        return { t: 'tuple', items: e.elems.map((x) => this.eval(x, env)) };
      case 'quant':
        return this.quant(e, env);
      case 'comprehension':
        return this.comprehension(e, env);
      case 'mult': {
        const v = this.eval(e.arg, env);
        const n = size(v);
        return e.m === 'some' ? n > 0 : e.m === 'no' ? n === 0 : e.m === 'one' ? n === 1 : n <= 1;
      }
      case 'if':
        return this.eval(e.cond, env) ? this.eval(e.then, env) : this.eval(e.else, env);
      case 'match': {
        const v = this.eval(e.scrutinee, env);
        for (const arm of e.arms) {
          const bound = this.matchPattern(arm.pattern, v, env);
          if (bound) return this.eval(arm.body, { ...env, vals: bound });
        }
        throw new RuntimeFailure('match', e.span, `No case matches ${show(v)}.`);
      }
      case 'block': {
        const vals = new Map(env.vals);
        const inner = { ...env, vals };
        for (const l of e.lets) vals.set(this.sym(l).id, this.eval(l.value, inner));
        return this.eval(e.body, inner);
      }
      case 'old':
        if (!env.old) throw new RuntimeFailure('internal', e.span, 'old() outside a function.');
        // Bound variables of quantifiers inside old() keep their current values.
        return this.eval(e.arg, { ...env.old, vals: mergeBound(env.old.vals, env.vals, this.checked) });
      case 'at': {
        if (!env.at || e.proc.k !== 'call') throw new RuntimeFailure('internal', e.span, '`at` outside a system.');
        return env.at(this.sym(e.proc), e.proc.args.map((a) => this.eval(a, env)), e.label);
      }
      case 'cast': {
        const v = this.eval(e.arg, env) as bigint;
        const from = this.typeOf(e.arg);
        const to = this.typeOf(e)!;
        // From a signed bit-vector view? bvs convert as unsigned; `as` to a bv wraps.
        if (to.k === 'bv') return BigInt.asUintN(to.bits, v);
        if (from?.k === 'bv' && to.k === 'mach' && to.signed) return this.fit(BigInt.asIntN(from.bits, v), to, e.span, 'narrowing', 'Narrowing conversion');
        return this.fit(v, to, e.span, 'narrowing', `Conversion to ${to.k === 'mach' ? `${to.signed ? 'i' : 'u'}${to.bits}` : 'the target type'}`);
      }
    }
  }

  varValue(e: A.Expr & { k: 'var' }, env: Env): Value {
    const s = this.sym(e);
    switch (s.kind) {
      case 'variant':
        if (s.ty.k !== 'enum') break;
        return { t: 'enum', name: s.ty.name, tag: s.index!, variant: s.name, fields: [] };
      case 'const': {
        if (s.value !== undefined) return s.value;
        const d = s.decl;
        if (d?.k === 'const') return this.eval(d.value, env);
        break;
      }
      case 'type':
        // In a world, a type names the set of its atoms.
        if (s.ty.k === 'atom' && env.universe) return rel(1, Array.from({ length: env.universe.get(s.name) ?? 0 }, (_, i) => [{ t: 'atom' as const, type: s.name, i }]));
        break;
      default: {
        const v = env.vals.get(s.id);
        if (v === undefined) throw new RuntimeFailure('internal', e.span, `“${e.name}” has no value yet.`);
        return v;
      }
    }
    throw new RuntimeFailure('internal', e.span, `“${e.name}” is not a value.`);
  }

  arith(op: string, a: bigint, b: bigint, t: Ty | undefined, span: Span, operands: () => Record<string, string>): bigint {
    let r: bigint;
    switch (op) {
      case '+':
        r = a + b;
        break;
      case '-':
        r = a - b;
        break;
      case '*':
        r = a * b;
        break;
      case '/':
      case '%':
        if (b === 0n) throw new RuntimeFailure('division', span, 'Division by zero.', operands());
        if (t?.k === 'bv') r = op === '/' ? a / b : a % b;
        else r = op === '/' ? truncDiv(a, b) : truncRem(a, b);
        break;
      default:
        throw new RuntimeFailure('internal', span, `Unknown operator ${op}.`);
    }
    if (t?.k === 'bv') return BigInt.asUintN(t.bits, r);
    if (t?.k === 'mach') {
      const [lo, hi] = machBounds(t);
      if (r < lo || r > hi) throw new RuntimeFailure('overflow', span, `${t.signed ? 'i' : 'u'}${t.bits} ${r < lo ? 'underflow' : 'overflow'}: ${a} ${op} ${b} = ${r}, outside ${lo}…${hi}.`, { ...operands(), result: r.toString() });
    }
    return r;
  }

  unary(e: A.Expr & { k: 'unary' }, env: Env): Value {
    switch (e.op) {
      case '-': {
        const v = this.eval(e.arg, env) as bigint;
        return this.arith('-', 0n, v, this.typeOf(e), e.span, () => ({ operand: v.toString() }));
      }
      case '!':
        return !this.eval(e.arg, env);
      case '~': {
        const v = this.eval(e.arg, env);
        if (typeof v === 'bigint') {
          const t = this.typeOf(e);
          return BigInt.asUintN(t?.k === 'bv' ? t.bits : 64, ~v);
        }
        const r = v as RelV;
        return rel(r.arity, r.tuples.map((t) => [...t].reverse()));
      }
      case '#':
        return BigInt(size(this.eval(e.arg, env)));
      case '^':
      case '*':
        return closure(this.eval(e.arg, env) as RelV, e.op === '*', env);
      default:
        throw new RuntimeFailure('internal', e.span, `Temporal operator \`${e.op}\` evaluated in a single state.`);
    }
  }

  binary(e: A.Expr & { k: 'binary' }, env: Env): Value {
    const op = e.op;
    // Short-circuit logic (left to right, so `i < len(a) && a[i] == x` is safe).
    if (op === '&&' || op === '**') return !!this.eval(e.left, env) && !!this.eval(e.right, env);
    if (op === '||') return !!this.eval(e.left, env) || !!this.eval(e.right, env);
    if (op === '==>') return !this.eval(e.left, env) || !!this.eval(e.right, env);
    if (op === '<==') return !!this.eval(e.left, env) || !this.eval(e.right, env);
    // Heap assertions at run time (approximately: `**` is checked as a conjunction, without disjointness; the heap
    // verifier is the one that reasons about separation).
    if (op === '|->') {
      if (e.left.k !== 'field') throw new RuntimeFailure('internal', e.span, 'Points-to needs a field on its left.');
      const target = this.eval(e.left.target, env);
      if (target === null) return false;
      const o = env.heap.get((target as { addr: number }).addr);
      if (!o || o.freed) return false;
      return equal(this.eval(e.left, env), this.eval(e.right, env));
    }
    const l = this.eval(e.left, env);
    const r = this.eval(e.right, env);
    switch (op) {
      case '<==>':
        return !!l === !!r;
      case '==':
        return equal(l, r);
      case '!=':
        return !equal(l, r);
      case '<':
      case '<=':
      case '>':
      case '>=':
        if (typeof l === 'bigint') return cmp(op, l, r as bigint);
        // Subset on sets and multisets.
        return op === '<=' ? subset(l, r) : op === '<' ? subset(l, r) && !equal(l, r) : op === '>=' ? subset(r, l) : subset(r, l) && !equal(l, r);
      case 'in':
      case '!in': {
        const m = member(l, r);
        return op === 'in' ? m : !m;
      }
      case '+':
      case '-':
      case '*':
      case '/':
      case '%': {
        if (typeof l === 'bigint') {
          const t = this.typeOf(e);
          return this.arith(op, l, r as bigint, t, e.span, () => ({ left: (l as bigint).toString(), right: (r as bigint).toString() }));
        }
        return setOp(op, l, r);
      }
      case '++':
        return seq([...(l as SeqV).items, ...(r as SeqV).items]);
      case '&':
        if (typeof l === 'bigint') return l & (r as bigint);
        return setOp('&', l, r);
      case '|':
        return (l as bigint) | (r as bigint);
      case '^':
        return (l as bigint) ^ (r as bigint);
      case '<<': {
        const t = this.typeOf(e);
        const bits = t?.k === 'bv' ? t.bits : 64;
        const k = r as bigint;
        return k >= BigInt(bits) ? 0n : BigInt.asUintN(bits, (l as bigint) << k);
      }
      case '>>': {
        const t = this.typeOf(e);
        const bits = t?.k === 'bv' ? t.bits : 64;
        const k = r as bigint;
        return k >= BigInt(bits) ? 0n : (l as bigint) >> k;
      }
      case '.':
        return join(l as RelV, r as RelV);
      default:
        throw new RuntimeFailure('internal', e.span, `Operator ${op} cannot be evaluated in one state.`);
    }
  }

  index(e: A.Expr & { k: 'index' }, t: Value, idx: Value[]): Value {
    if (t !== null && typeof t === 'object') {
      if (t.t === 'seq') {
        const i = idx[0] as bigint;
        if (i < 0n || i >= BigInt(t.items.length)) throw new RuntimeFailure('bounds', e.span, `Index ${i} is out of bounds for a sequence of length ${t.items.length}.`, { index: i.toString(), length: String(t.items.length) });
        return t.items[Number(i)]!;
      }
      if (t.t === 'map') {
        const v = funcGet(t, idx[0]!);
        if (v === undefined) throw new RuntimeFailure('bounds', e.span, `Key ${show(idx[0]!)} is not in the map.`);
        return v;
      }
      if (t.t === 'func') return funcGet(t, idx.length === 1 ? idx[0]! : { t: 'tuple', items: idx })!;
    }
    if (typeof t === 'bigint') {
      // Bit i of a bit-vector.
      return ((t >> (idx[0] as bigint)) & 1n) === 1n;
    }
    throw new RuntimeFailure('internal', e.span, 'Index on a value that cannot be indexed.');
  }

  /** A copy of `t` with t[idx] = v (sequences, maps, functions). */
  store(t: Value, idx: Value[], v: Value, span: Span): Value {
    if (t !== null && typeof t === 'object') {
      if (t.t === 'seq') {
        const i = idx[0] as bigint;
        if (i < 0n || i >= BigInt(t.items.length)) throw new RuntimeFailure('bounds', span, `Index ${i} is out of bounds for a sequence of length ${t.items.length}.`, { index: i.toString(), length: String(t.items.length) });
        const items = [...t.items];
        items[Number(i)] = v;
        return seq(items);
      }
      if (t.t === 'map') return funcSet(t as MapV, idx[0]!, v);
      if (t.t === 'func') return funcSet(t as FuncV, idx.length === 1 ? idx[0]! : { t: 'tuple', items: idx }, v);
    }
    throw new RuntimeFailure('internal', span, 'Update of a value that cannot be updated.');
  }

  field(e: A.Expr & { k: 'field' }, env: Env): Value {
    // Variant through its enum: Vote.none
    const tsym = this.checked.refs.get(e.target);
    if (tsym?.kind === 'type' && tsym.ty.k === 'enum') {
      const i = tsym.ty.variants.findIndex((v) => v.name === e.name);
      return { t: 'enum', name: tsym.ty.name, tag: i, variant: e.name, fields: [] };
    }
    const t = this.eval(e.target, env);
    if (t !== null && typeof t === 'object' && t.t === 'struct') {
      const st = this.typeOf(e.target);
      const i = st?.k === 'struct' ? st.fields.findIndex((f) => f.name === e.name) : -1;
      return (t as StructV).fields[i]!;
    }
    if (t === null || (typeof t === 'object' && t.t === 'ref')) {
      const o = this.deref(t, e.target.span, env);
      const cls = this.checked.globals.lookup(o.cls)?.ty;
      const i = cls?.k === 'struct' ? cls.fields.findIndex((f) => f.name === e.name) : -1;
      return o.fields[i]!;
    }
    if (t !== null && typeof t === 'object' && (t.t === 'rel' || t.t === 'atom')) {
      // Relational join with a named relation (worlds): `d.parent`, where d is an atom or a set of atoms.
      const r = this.checked.refs.get(e);
      if (r?.kind === 'rel') return join(t, env.vals.get(r.id) as RelV);
    }
    throw new RuntimeFailure('internal', e.span, `No field ${e.name}.`);
  }

  deref(t: Value, span: Span, env: Env) {
    if (t === null) throw new RuntimeFailure('null', span, 'Dereference of null.');
    const o = env.heap.get((t as { addr: number }).addr);
    if (!o) throw new RuntimeFailure('internal', span, 'Dangling reference.');
    if (o.freed) throw new RuntimeFailure('use-after-free', span, `Use of object #${(t as { addr: number }).addr} after it was freed.`);
    return o;
  }

  call(e: A.Expr & { k: 'call' }, env: Env): Value {
    const s = this.checked.refs.get(e);
    if (!s) return this.builtin(e, env);
    if (s.kind === 'variant' && s.ty.k === 'enum') return { t: 'enum', name: s.ty.name, tag: s.index!, variant: s.name, fields: e.args.map((a) => this.eval(a, env)) };
    const info = this.fnInfo(s);
    const args = e.args.map((a) => this.eval(a, env));
    return this.callPure(info, args, env, e.span);
  }

  fnInfo(s: Sym): FnInfo {
    for (const f of this.checked.fns.values()) if (f.sym === s) return f;
    throw new RuntimeFailure('internal', s.def, `No function ${s.name}.`);
  }

  /** Evaluate a pure function or predicate (preconditions are checked). */
  callPure(info: FnInfo, args: Value[], env: Env, span: Span): Value {
    const vals = new Map<number, Value>(env.vals);
    info.params.forEach((p, i) => vals.set(p.id, args[i]!));
    const inner: Env = { ...env, vals };
    for (const r of info.decl.spec.requires) {
      const ok = this.tryEval(r.value, inner);
      if (ok === false) throw new RuntimeFailure('precondition', span, `The precondition of ${info.decl.name}${r.label ? ` (${r.label})` : ''} does not hold for ${args.map(show).join(', ')}.`);
    }
    const body = info.decl.body;
    if (!body) {
      const ext = this.opts.externals?.get(info.decl.name)?.(args);
      if (ext !== undefined) return ext;
      throw new RuntimeFailure('internal', span, `${info.decl.name} has no body: it is uninterpreted, and cannot be run.`);
    }
    if ('stmts' in body) throw new RuntimeFailure('internal', span, `${info.decl.name} has no expression body.`);
    return this.eval(body, inner);
  }

  /** Evaluate a condition; `undefined` if it cannot be evaluated at run time (an unbounded quantifier). */
  tryEval(e: A.Expr, env: Env): boolean | undefined {
    try {
      return !!this.eval(e, env);
    } catch (err) {
      if (err instanceof RuntimeFailure && err.kind === 'unbounded-quantifier') return undefined;
      throw err;
    }
  }

  builtin(e: A.Expr & { k: 'call' }, env: Env): Value {
    const args = e.args.map((a) => this.eval(a, env));
    const a0 = args[0]!;
    const t = this.typeOf(e);
    switch (e.callee) {
      case 'len':
        return BigInt((a0 as SeqV).items.length);
      case 'multiset':
        return mset(collItems(a0));
      case 'set':
        return set(collItems(a0));
      case 'min':
        return args.reduce((a, b) => (compare(a, b) <= 0 ? a : b));
      case 'max':
        return args.reduce((a, b) => (compare(a, b) >= 0 ? a : b));
      case 'abs': {
        const v = a0 as bigint;
        return this.fit(v < 0n ? -v : v, t, e.span, 'overflow', 'abs');
      }
      case 'reversed':
        return seq([...(a0 as SeqV).items].reverse());
      case 'keys':
        return set((a0 as MapV).entries.map(([k]) => k));
      case 'sum':
        return (a0 as SeqV).items.reduce<bigint>((s, x) => s + (x as bigint), 0n);
      case 'slt':
      case 'sle':
      case 'sgt':
      case 'sge': {
        const at = this.typeOf(e.args[0]!);
        const bits = at?.k === 'bv' ? at.bits : 64;
        const x = BigInt.asIntN(bits, a0 as bigint);
        const y = BigInt.asIntN(bits, args[1] as bigint);
        return e.callee === 'slt' ? x < y : e.callee === 'sle' ? x <= y : e.callee === 'sgt' ? x > y : x >= y;
      }
      case 'sdiv':
      case 'srem': {
        const bits = t?.k === 'bv' ? t.bits : 64;
        const x = BigInt.asIntN(bits, a0 as bigint);
        const y = BigInt.asIntN(bits, args[1] as bigint);
        if (y === 0n) throw new RuntimeFailure('division', e.span, 'Division by zero.');
        return BigInt.asUintN(bits, e.callee === 'sdiv' ? x / y : x % y);
      }
      case 'ashr': {
        const bits = t?.k === 'bv' ? t.bits : 64;
        const x = BigInt.asIntN(bits, a0 as bigint);
        const k = args[1] as bigint;
        return BigInt.asUintN(bits, k >= BigInt(bits) ? (x < 0n ? -1n : 0n) : x >> k);
      }
      case 'list':
      case 'lseg': {
        // Following next from x reaches y (null for list) without a cycle and without a freed node.
        let cur = a0;
        const stop = e.callee === 'list' ? null : args[1]!;
        const seen = new Set<number>();
        for (;;) {
          if (cur === null || (stop !== null && cur !== null && equal(cur, stop))) return cur === null ? stop === null : true;
          const addr = (cur as { addr: number }).addr;
          if (seen.has(addr)) return false;
          seen.add(addr);
          const o = env.heap.get(addr);
          if (!o || o.freed) return false;
          const cls = this.checked.program.decls.find((d) => d.k === 'class' && d.name === o.cls) as A.StructDecl | undefined;
          const i = cls?.fields.findIndex((f) => f.name === 'next') ?? -1;
          if (i < 0) return false;
          cur = o.fields[i]!;
        }
      }
      case 'seq_of':
        return seq(args);
    }
    throw new RuntimeFailure('internal', e.span, `Unknown function ${e.callee}.`);
  }

  matchPattern(p: A.Pattern, v: Value, env: Env): Map<number, Value> | undefined {
    if (p.k === 'wild') return env.vals;
    if (p.k === 'lit') return equal(this.eval(p.value, env), v) ? env.vals : undefined;
    const ev = v as { t: 'enum'; variant: string; fields: readonly Value[] };
    if (ev.variant !== p.name) return undefined;
    const vals = new Map(env.vals);
    p.binds.forEach((b, i) => vals.set(this.sym(b).id, ev.fields[i]!));
    return vals;
  }

  // ── Quantifiers ──
  quant(e: A.Expr & { k: 'quant' }, env: Env): Value {
    const want = e.q === 'forall';
    let result = want;
    this.enumBinders(e.binders, e.body, env, (inner) => {
      const v = this.eval(e.body, inner);
      if (!!v !== want) {
        result = !want;
        return false;
      }
      return true;
    }, e.span, e.q === 'forall');
    return result;
  }

  comprehension(e: A.Expr & { k: 'comprehension' }, env: Env): Value {
    const out: Value[] = [];
    this.enumBinders(e.binders, e.body, env, (inner) => {
      if (this.eval(e.body, inner)) out.push(e.value ? this.eval(e.value, inner) : inner.vals.get(this.sym(e.binders[0]!).id)!);
      return true;
    }, e.span, false);
    if (e.seq) return seq(out);
    const t = this.typeOf(e);
    if (t?.k === 'rel') return rel(1, out.map((x) => [x]));
    return set(out);
  }

  /**
   * Call `f` with every combination of values of the binders (stopping when f returns false). Integer binders
   * get their bounds from the condition: the antecedent of an implication for ∀, the conjuncts for ∃.
   */
  enumBinders(bs: A.Binder[], body: A.Expr, env: Env, f: (env: Env) => boolean, span: Span, universal: boolean): void {
    const guard = universal ? (body.k === 'binary' && body.op === '==>' ? body.left : undefined) : body;
    const facts = guard ? flattenComparisons(guard) : [];
    const syms = bs.map((b) => this.sym(b));
    const go = (k: number, vals: Map<number, Value>): boolean => {
      if (k === bs.length) return f({ ...env, vals });
      const b = bs[k]!;
      const s = syms[k]!;
      const inner: Env = { ...env, vals };
      let domain: Iterable<Value> | undefined;
      if (b.range && 'set' in b.range) domain = collItems(this.eval(b.range.set, inner));
      else if (b.range) {
        const lo = this.eval(b.range.lo, inner) as bigint;
        const hi = (this.eval(b.range.hi, inner) as bigint) + (b.range.inclusive ? 1n : 0n);
        domain = intRange(lo, hi);
      } else {
        domain = enumerate(s.ty) ?? undefined;
        if (s.ty.k === 'atom' && env.universe) domain = Array.from({ length: env.universe.get(s.ty.name) ?? 0 }, (_, i) => ({ t: 'atom' as const, type: s.ty.k === 'atom' ? s.ty.name : '', i }));
        if (!domain) domain = this.inferBounds(s, syms.slice(k + 1), facts, inner, span);
      }
      let count = 0;
      for (const v of domain) {
        if (++count > this.opts.maxEnum) throw new RuntimeFailure('unbounded-quantifier', span, `A quantifier ranges over more than ${this.opts.maxEnum.toLocaleString('en-GB')} values.`);
        const next = new Map(vals);
        next.set(s.id, v);
        if (!go(k + 1, next)) return false;
      }
      return true;
    };
    go(0, new Map(env.vals));
  }

  inferBounds(s: Sym, later: Sym[], facts: Fact[], env: Env, span: Span): Iterable<Value> {
    const laterIds = new Set(later.map((x) => x.id));
    const usable = (e: A.Expr) => !mentions(e, laterIds, this.checked) && !mentions(e, new Set([s.id]), this.checked);
    let lo: bigint | undefined;
    let hi: bigint | undefined; // exclusive
    for (const f of facts) {
      // Normalise to `a op b` with op in < <=.
      for (const [a, op, b] of [[f.a, f.op, f.b], [f.b, flip(f.op), f.a]] as const) {
        if (op !== '<' && op !== '<=') continue;
        if (isVar(b, s, this.checked) && usable(a)) {
          const v = this.eval(a, env);
          if (typeof v === 'bigint') {
            const bound = op === '<' ? v + 1n : v;
            lo = lo === undefined || bound > lo ? bound : lo;
          }
        }
        if (isVar(a, s, this.checked) && usable(b)) {
          const v = this.eval(b, env);
          if (typeof v === 'bigint') {
            const bound = op === '<' ? v : v + 1n;
            hi = hi === undefined || bound < hi ? bound : hi;
          }
        }
      }
      if (f.op === 'in' && isVar(f.a, s, this.checked) && usable(f.b)) return collItems(this.eval(f.b, env));
    }
    // Machine and natural types give a bound on one side.
    const [tlo, thi] = intBounds(s.ty);
    if (lo === undefined && tlo !== undefined) lo = tlo;
    if (hi === undefined && thi !== undefined) hi = thi + 1n;
    if (lo === undefined || hi === undefined || hi - lo > BigInt(this.opts.maxEnum))
      throw new RuntimeFailure('unbounded-quantifier', span, `Cannot check “${s.name}” over all integers at run time: give it bounds in the condition, such as \`0 <= ${s.name} < len(a) ==> …\`.`);
    return intRange(lo, hi);
  }
}

// ── Helpers ──
function cmp(op: string, a: bigint, b: bigint): boolean {
  return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
}
function flip(op: string): string {
  return op === '<' ? '>' : op === '<=' ? '>=' : op === '>' ? '<' : op === '>=' ? '<=' : op;
}

function* intRange(lo: bigint, hi: bigint): Generator<bigint> {
  for (let i = lo; i < hi; i++) yield i;
}

interface Fact {
  a: A.Expr;
  op: string;
  b: A.Expr;
}

/** Comparisons among the conjuncts of a condition, with chains expanded transitively (0 <= i < j < n gives i < n). */
function flattenComparisons(e: A.Expr): Fact[] {
  const out: Fact[] = [];
  const walk = (x: A.Expr) => {
    if (x.k === 'binary' && x.op === '&&') {
      walk(x.left);
      walk(x.right);
    } else if (x.k === 'binary' && ['<', '<=', '>', '>=', 'in'].includes(x.op)) out.push({ a: x.left, op: x.op, b: x.right });
    else if (x.k === 'chain') {
      for (let i = 0; i < x.args.length; i++)
        for (let j = i + 1; j < x.args.length; j++) {
          const ops = x.ops.slice(i, j);
          const strict = ops.some((o) => o === '<' || o === '>');
          const up = ops[0] === '<' || ops[0] === '<=';
          out.push({ a: x.args[i]!, op: up ? (strict ? '<' : '<=') : strict ? '>' : '>=', b: x.args[j]! });
        }
    }
  };
  walk(e);
  return out;
}

function isVar(e: A.Expr, s: Sym, c: Checked): boolean {
  return e.k === 'var' && c.refs.get(e) === s;
}

function mentions(e: A.Expr, ids: Set<number>, c: Checked): boolean {
  let found = false;
  const visit = (x: A.Expr) => {
    if (found) return;
    if (x.k === 'var') {
      const s = c.refs.get(x);
      if (s && ids.has(s.id)) found = true;
    }
  };
  walkExpr(e, visit);
  return found;
}

function walkExpr(e: A.Expr, f: (e: A.Expr) => void): void {
  f(e);
  const kids: (A.Expr | undefined)[] = [];
  switch (e.k) {
    case 'unary':
    case 'old':
    case 'mult':
    case 'cast':
      kids.push(e.arg);
      break;
    case 'binary':
      kids.push(e.left, e.right);
      break;
    case 'chain':
      kids.push(...e.args);
      break;
    case 'call':
      kids.push(...e.args);
      break;
    case 'index':
      kids.push(e.target, ...e.indices);
      break;
    case 'slice':
      kids.push(e.target, e.lo, e.hi);
      break;
    case 'update':
      kids.push(e.target, e.index, e.value);
      break;
    case 'field':
      kids.push(e.target);
      break;
    case 'seqlit':
    case 'setlit':
    case 'tuple':
      kids.push(...e.elems);
      break;
    case 'if':
      kids.push(e.cond, e.then, e.else);
      break;
    case 'struct':
    case 'new':
      kids.push(...e.fields.map((x) => x.value));
      break;
    case 'quant':
    case 'comprehension':
      kids.push(e.body);
      break;
    case 'block':
      kids.push(...e.lets.map((l) => l.value), e.body);
      break;
    case 'at':
      kids.push(e.proc);
      break;
    case 'match':
      kids.push(e.scrutinee, ...e.arms.map((a) => a.body));
      break;
  }
  for (const k of kids) if (k) walkExpr(k, f);
}

function mergeBound(old: Map<number, Value>, cur: Map<number, Value>, c: Checked): Map<number, Value> {
  const out = new Map(old);
  for (const [id, v] of cur) {
    const s = c.symbols[id - 1];
    if (s && (s.kind === 'bound' || (s.kind === 'local' && !old.has(id)))) out.set(id, v);
  }
  return out;
}

export function collItems(v: Value): Value[] {
  if (v !== null && typeof v === 'object') {
    if (v.t === 'seq' || v.t === 'set') return [...v.items];
    if (v.t === 'mset') return v.items.flatMap(([x, n]) => Array<Value>(n).fill(x));
    if (v.t === 'map') return v.entries.map(([k]) => k);
    if (v.t === 'rel') return v.tuples.map((t) => (t.length === 1 ? t[0]! : { t: 'tuple' as const, items: t }));
  }
  return [];
}

function size(v: Value): number {
  if (v !== null && typeof v === 'object') {
    if (v.t === 'seq' || v.t === 'set') return v.items.length;
    if (v.t === 'mset') return v.items.reduce((s, [, n]) => s + n, 0);
    if (v.t === 'map') return v.entries.length;
    if (v.t === 'rel') return v.tuples.length;
    if (v.t === 'atom') return 1;
  }
  return 0;
}

function member(x: Value, c: Value): boolean {
  if (c !== null && typeof c === 'object') {
    if (c.t === 'seq') return c.items.some((y) => equal(x, y));
    if (c.t === 'set') return c.items.some((y) => equal(x, y));
    if (c.t === 'mset') return c.items.some(([y]) => equal(x, y));
    if (c.t === 'map') return funcGet(c, x) !== undefined;
    if (c.t === 'rel') {
      const xs = x !== null && typeof x === 'object' && x.t === 'rel' ? x.tuples : [[x]];
      return xs.every((t) => c.tuples.some((u) => u.length === t.length && u.every((y, i) => equal(y, t[i]!))));
    }
  }
  return false;
}

function subset(a: Value, b: Value): boolean {
  if (a !== null && typeof a === 'object' && a.t === 'mset' && b !== null && typeof b === 'object' && b.t === 'mset')
    return a.items.every(([x, n]) => (b.items.find(([y]) => equal(x, y))?.[1] ?? 0) >= n);
  return collItems(a).every((x) => member(x, b));
}

function setOp(op: string, l: Value, r: Value): Value {
  if (l !== null && typeof l === 'object' && l.t === 'mset') {
    const rs = r as MsetV;
    const count = (m: MsetV, x: Value) => m.items.find(([y]) => equal(x, y))?.[1] ?? 0;
    const keys = set([...l.items.map(([x]) => x), ...rs.items.map(([x]) => x)]).items;
    const items: Value[] = [];
    for (const k of keys) {
      const a = count(l, k);
      const b = count(rs, k);
      const n = op === '+' ? a + b : op === '-' ? Math.max(0, a - b) : Math.min(a, b);
      for (let i = 0; i < n; i++) items.push(k);
    }
    return mset(items);
  }
  if (l !== null && typeof l === 'object' && l.t === 'rel') {
    const rr = (r !== null && typeof r === 'object' && r.t === 'rel' ? r : rel(1, [[r]])) as RelV;
    const has = (rs: RelV, t: readonly Value[]) => rs.tuples.some((u) => u.every((y, i) => equal(y, t[i]!)));
    if (op === '+') return rel(l.arity, [...l.tuples, ...rr.tuples]);
    if (op === '-') return rel(l.arity, l.tuples.filter((t) => !has(rr, t)));
    return rel(l.arity, l.tuples.filter((t) => has(rr, t)));
  }
  if (l !== null && typeof l === 'object' && l.t === 'map' && op === '-') {
    const ks = collItems(r);
    return { t: 'map', entries: l.entries.filter(([k]) => !ks.some((x) => equal(x, k))) };
  }
  const a = collItems(l);
  const b = collItems(r);
  if (op === '+') return set([...a, ...b]);
  if (op === '-') return set(a.filter((x) => !b.some((y) => equal(x, y))));
  return set(a.filter((x) => b.some((y) => equal(x, y))));
}

function join(l: RelV | Value, r: RelV | Value): RelV {
  const asRel = (v: Value): RelV => (v !== null && typeof v === 'object' && v.t === 'rel' ? v : rel(1, [[v]]));
  const a = asRel(l);
  const b = asRel(r);
  const out: Value[][] = [];
  for (const x of a.tuples) for (const y of b.tuples) if (equal(x[x.length - 1]!, y[0]!)) out.push([...x.slice(0, -1), ...y.slice(1)]);
  return rel(a.arity + b.arity - 2, out);
}

function closure(r: RelV, reflexive: boolean, env: Env): RelV {
  let cur = r;
  for (;;) {
    const next = rel(2, [...cur.tuples, ...join(cur, r).tuples]);
    if (next.tuples.length === cur.tuples.length) break;
    cur = next;
  }
  if (!reflexive) return cur;
  const atoms: Value[][] = [];
  for (const [type, n] of env.universe ?? new Map()) for (let i = 0; i < n; i++) atoms.push([{ t: 'atom', type, i }, { t: 'atom', type, i }]);
  return rel(2, [...cur.tuples, ...atoms]);
}
