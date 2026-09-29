// Running programs: erasure and compilation to JavaScript closures.
//
// `#eval` does not use the kernel's reduction. Like Lean's compiler, it first
// *erases* everything that cannot influence the result — types and proofs —
// and then runs what is left as ordinary code:
//
//   * a constructor application becomes a JavaScript object { c, f },
//   * a natural number becomes a BigInt (with native +, *, −, comparisons),
//   * a recursor becomes a function that inspects the constructor of its major
//     premise and applies the matching ι-rule,
//   * λ becomes a JavaScript closure,
//   * types and proofs become `null`.
//
// Erasure is justified by the kernel's rules: a proof can never be inspected to
// compute data (subsingleton elimination), and types have no runtime content.

import {
  type Expr,
  getAppArgs,
  getAppFn,
  instantiate1,
  instantiateLevelParamsExpr,
  mkApps,
  mkConst,
  mkFVar,
} from '../core/expr.ts';
import { toNat } from '../core/level.ts';
import { type Decl, type Environment, LocalContext, type LocalDecl, freshFVarId } from '../core/env.ts';
import { TypeChecker, structureProjections } from '../core/typechecker.ts';

export type Value = null | bigint | CtorVal | Fn;
export interface CtorVal {
  c: string;
  f: Value[];
}
export type Fn = ((v: Value) => Value) & { arity?: number; label?: string };

export class EvalError extends Error {}

/** how a term is erased: kept, a type, or a proof */
type Relevance = 'data' | 'type' | 'proof';

const MAX_STEPS = 20_000_000;

export class Evaluator {
  private consts = new Map<string, Value>();
  steps = 0;

  constructor(readonly env: Environment) {}

  // -------------------------------------------------------------------------
  // relevance

  private relevance(tc: TypeChecker, e: Expr): Relevance {
    let t: Expr;
    try {
      t = tc.inferOnly(e);
    } catch {
      return 'data';
    }
    const w = tc.whnf(t);
    if (w.k === 'sort') return 'type';
    // a type former: (x : A) → Sort u
    let x: Expr = w;
    while (x.k === 'pi') x = x.body;
    if (x.k === 'sort' && w.k === 'pi') return 'type';
    try {
      const s = tc.whnf(tc.inferOnly(t));
      if (s.k === 'sort' && toNat(s.level) === 0) return 'proof';
    } catch {
      /* ignore */
    }
    return 'data';
  }

  // -------------------------------------------------------------------------
  // compiling

  /** compile a closed term to a value */
  run(e: Expr, lctx: LocalContext = LocalContext.empty): Value {
    const tc = new TypeChecker(this.env, lctx, { fuel: 5_000_000 });
    const code = this.compile(e, tc, new Map());
    return code([]);
  }

  /** compile e (whose free variables are in `slots`) to a function of the runtime environment */
  private compile(e: Expr, tc: TypeChecker, slots: Map<number, number>): (env: Value[]) => Value {
    switch (e.k) {
      case 'sort':
      case 'pi':
        return () => null;
      case 'fvar': {
        const i = slots.get(e.id);
        if (i === undefined) {
          const d = tc.lctx.get(e.id);
          if (d?.value) return this.compile(d.value, tc, slots);
          throw new EvalError(`cannot evaluate: free variable '${d?.name ?? '?'}'`);
        }
        return (env) => env[i];
      }
      case 'mvar':
        throw new EvalError('cannot evaluate a term with holes');
      case 'bvar':
        throw new EvalError('internal error: loose bound variable');
      case 'const': {
        const name = e.name;
        const levels = e.levels;
        let cached: Value | undefined;
        return () => (cached ??= this.constValue(name, levels));
      }
      case 'let': {
        const val = this.compile(e.value, tc, slots);
        const d: LocalDecl = { id: freshFVarId(), name: e.name, type: e.type, value: e.value };
        const saved = tc.lctx;
        tc.lctx = tc.lctx.push({ ...d, value: undefined });
        const slot = slots.size;
        const s2 = new Map(slots);
        s2.set(d.id, slot);
        const body = this.compile(instantiate1(e.body, mkFVar(d.id)), tc, s2);
        tc.lctx = saved;
        return (env) => body([...env, val(env)]);
      }
      case 'lam': {
        const d: LocalDecl = { id: freshFVarId(), name: e.name, type: e.type };
        const saved = tc.lctx;
        tc.lctx = tc.lctx.push(d);
        const slot = slots.size;
        const s2 = new Map(slots);
        s2.set(d.id, slot);
        let body: (env: Value[]) => Value;
        try {
          body = this.compile(instantiate1(e.body, mkFVar(d.id)), tc, s2);
        } finally {
          tc.lctx = saved;
        }
        return (env) => {
          const f: Fn = (v: Value) => {
            const env2 = env.slice(0, slot);
            env2[slot] = v;
            return body(env2);
          };
          return f;
        };
      }
      case 'app': {
        const fn = getAppFn(e);
        const args = getAppArgs(e);
        // β-redexes are compiled as lets
        const fc = this.compile(fn, tc, slots);
        const acs = args.map((a) => (this.relevance(tc, a) === 'data' ? this.compile(a, tc, slots) : () => null));
        return (env) => {
          let f = fc(env);
          for (const a of acs) f = apply(f, a(env), this);
          return f;
        };
      }
    }
  }

  // -------------------------------------------------------------------------
  // constants

  private constValue(name: string, levels: readonly import('../core/level.ts').Level[]): Value {
    const ext = externs[name];
    if (ext) return ext(this);
    const d = this.env.get(name);
    if (!d) throw new EvalError(`unknown constant '${name}'`);
    switch (d.kind) {
      case 'ctor':
        return this.ctorValue(d);
      case 'rec':
        return this.recValue(d, levels);
      case 'def': {
        const key = name + '|' + levels.map((l) => JSON.stringify(l)).join(',');
        const c = this.consts.get(key);
        if (c !== undefined) return c;
        const v = this.run(instantiateLevelParamsExpr(d.value, d.levelParams, levels));
        this.consts.set(key, v);
        return v;
      }
      case 'theorem':
        return null;
      case 'inductive':
        return null;
      case 'quot':
        return this.quotValue(d.quotKind);
      case 'axiom':
      case 'opaque':
        if (name === 'sorryAx') throw new EvalError('cannot evaluate: the program uses sorry');
        throw new EvalError(`cannot evaluate: '${name}' is an axiom${name === 'Classical.choice' ? ' (it is noncomputable: it chooses an element without saying which)' : ''}`);
    }
  }

  private ctorValue(d: Extract<Decl, { kind: 'ctor' }>): Value {
    if (d.name === 'Nat.zero') return 0n;
    if (d.name === 'Nat.succ') return withLabel((v: Value) => (v as bigint) + 1n, 'Nat.succ');
    const n = d.numParams + d.numFields;
    if (n === 0) return { c: d.name, f: [] };
    return curry(n, (args) => ({ c: d.name, f: args.slice(d.numParams) }), d.name);
  }

  private recValue(d: Extract<Decl, { kind: 'rec' }>, levels: readonly import('../core/level.ts').Level[]): Value {
    const n = d.majorIdx + 1;
    const rules = new Map<string, Value>();
    const ruleFor = (ctor: string): Value => {
      let r = rules.get(ctor);
      if (r === undefined) {
        const rule = d.rules.find((x) => x.ctor === ctor);
        if (!rule) throw new EvalError(`internal error: no ι-rule for '${ctor}'`);
        r = this.run(instantiateLevelParamsExpr(rule.rhs, d.levelParams, levels));
        rules.set(ctor, r);
      }
      return r;
    };
    const nPMM = d.numParams + d.numMotives + d.numMinors;
    return curry(
      n,
      (args) => {
        const major = args[d.majorIdx];
        const cv = ctorView(major, d.induct, this.env);
        if (!cv) throw new EvalError(`cannot evaluate: '${d.name}' applied to a value that is not a constructor`);
        let f = ruleFor(cv.c);
        for (const a of args.slice(0, nPMM)) f = apply(f, a, this);
        for (const a of cv.f) f = apply(f, a, this);
        return f;
      },
      d.name,
    );
  }

  private quotValue(kind: 'type' | 'mk' | 'lift' | 'ind'): Value {
    switch (kind) {
      case 'type':
      case 'ind':
        return null;
      case 'mk':
        // Quot.mk {α} r a  ↦  a
        return curry(3, (args) => args[2]);
      case 'lift':
        // Quot.lift {α} {r} {β} f h q  ↦  f q
        return curry(6, (args) => apply(args[3], args[5], this));
    }
  }

  tick(): void {
    if (++this.steps > MAX_STEPS) throw new EvalError('evaluation took too long (more than 20 million steps)');
  }
}

// ---------------------------------------------------------------------------
// runtime helpers

export function apply(f: Value, a: Value, ev: Evaluator): Value {
  ev.tick();
  if (typeof f !== 'function') {
    if (f === null) return null; // applying an erased value (a type former) stays erased
    throw new EvalError('internal error: applying a value that is not a function');
  }
  return f(a);
}

function withLabel(f: (v: Value) => Value, label: string): Fn {
  const g = f as Fn;
  g.label = label;
  return g;
}

/** a curried function of n arguments */
function curry(n: number, body: (args: Value[]) => Value, label?: string): Fn {
  const go = (acc: Value[]): Fn =>
    withLabel((v: Value) => {
      const next = [...acc, v];
      return next.length === n ? body(next) : go(next);
    }, label ?? '');
  return go([]);
}

/** view a runtime value as a constructor application of inductive type `ind` */
export function ctorView(v: Value, ind: string, env: Environment): CtorVal | undefined {
  if (typeof v === 'bigint') {
    if (ind !== 'Nat') return undefined;
    return v === 0n ? { c: 'Nat.zero', f: [] } : { c: 'Nat.succ', f: [v - 1n] };
  }
  if (v && typeof v === 'object') return v;
  void env;
  return undefined;
}

const nat = (v: Value): bigint => {
  if (typeof v !== 'bigint') throw new EvalError('internal error: expected a natural number');
  return v;
};
const bool = (b: boolean): CtorVal => ({ c: b ? 'Bool.true' : 'Bool.false', f: [] });
const decidable = (b: boolean): CtorVal => ({ c: b ? 'Decidable.isTrue' : 'Decidable.isFalse', f: [null] });

/** native implementations of the arithmetic on natural numbers (like Lean's GMP-backed Nat) */
const externs: Record<string, (ev: Evaluator) => Value> = {
  'Nat.add': () => curry(2, ([a, b]) => nat(a) + nat(b), 'Nat.add'),
  'Nat.mul': () => curry(2, ([a, b]) => nat(a) * nat(b), 'Nat.mul'),
  'Nat.sub': () => curry(2, ([a, b]) => (nat(a) > nat(b) ? nat(a) - nat(b) : 0n), 'Nat.sub'),
  'Nat.pred': () => curry(1, ([a]) => (nat(a) > 0n ? nat(a) - 1n : 0n), 'Nat.pred'),
  'Nat.div': () => curry(2, ([a, b]) => (nat(b) === 0n ? 0n : nat(a) / nat(b)), 'Nat.div'),
  'Nat.mod': () => curry(2, ([a, b]) => (nat(b) === 0n ? nat(a) : nat(a) % nat(b)), 'Nat.mod'),
  'Nat.pow': () => curry(2, ([a, b]) => nat(a) ** nat(b), 'Nat.pow'),
  'Nat.min': () => curry(2, ([a, b]) => (nat(a) < nat(b) ? nat(a) : nat(b)), 'Nat.min'),
  'Nat.max': () => curry(2, ([a, b]) => (nat(a) > nat(b) ? nat(a) : nat(b)), 'Nat.max'),
  'Nat.ble': () => curry(2, ([a, b]) => bool(nat(a) <= nat(b)), 'Nat.ble'),
  'Nat.beq': () => curry(2, ([a, b]) => bool(nat(a) === nat(b)), 'Nat.beq'),
  'Nat.decEq': () => curry(2, ([a, b]) => decidable(nat(a) === nat(b)), 'Nat.decEq'),
  'Nat.decLe': () => curry(2, ([a, b]) => decidable(nat(a) <= nat(b)), 'Nat.decLe'),
};

// ---------------------------------------------------------------------------
// showing values

export interface ShowOptions {
  maxDepth?: number;
  maxItems?: number;
}

/** print a runtime value, guided by its type */
export function showValue(env: Environment, v: Value, type: Expr, opts: ShowOptions = {}): string {
  const tc = new TypeChecker(env, LocalContext.empty, { fuel: 100_000 });
  const maxDepth = opts.maxDepth ?? 40;
  const maxItems = opts.maxItems ?? 200;
  const go = (v: Value, t: Expr, depth: number, atom: boolean): string => {
    if (depth > maxDepth) return '…';
    let w: Expr;
    try {
      w = tc.whnf(t);
    } catch {
      w = t;
    }
    if (typeof v === 'function') return atom ? '(fun ⋯)' : 'fun ⋯';
    if (v === null) return '_';
    const h = getAppFn(w);
    const targs = getAppArgs(w);
    if (typeof v === 'bigint') return v.toString();
    if (h.k === 'const' && h.name === 'Bool') return v.c === 'Bool.true' ? 'true' : 'false';
    if (h.k === 'const' && h.name === 'List') {
      const items: string[] = [];
      let cur: Value = v;
      while (cur && typeof cur === 'object' && cur.c === 'List.cons' && items.length < maxItems) {
        items.push(go(cur.f[0], targs[0], depth + 1, false));
        cur = cur.f[1];
      }
      if (cur && typeof cur === 'object' && cur.c === 'List.cons') items.push('…');
      return `[${items.join(', ')}]`;
    }
    if (h.k === 'const' && h.name === 'Prod' && typeof v === 'object') {
      return `(${go(v.f[0], targs[0], depth + 1, false)}, ${go(v.f[1], targs[1], depth + 1, false)})`;
    }
    // generic constructor application
    const d = env.get(v.c);
    if (!d || d.kind !== 'ctor') return '?';
    let short = v.c;
    for (const ns of env.opened) if (short.startsWith(ns + '.') && !short.slice(ns.length + 1).includes('.')) short = short.slice(ns.length + 1);
    if (h.k === 'const' && h.name === 'Subtype' && typeof v === 'object') return go(v.f[0], targs[0], depth, atom);
    const isStruct = h.k === 'const' && structureProjections(env, h.name) !== undefined;
    if (v.f.length === 0) return short;
    // field types: instantiate the constructor's type with the type's parameters
    let ct = instantiateLevelParamsExpr(d.type, d.levelParams, h.k === 'const' ? h.levels : []);
    for (let i = 0; i < d.numParams; i++) {
      ct = tc.whnf(ct);
      if (ct.k !== 'pi') break;
      ct = instantiate1(ct.body, targs[i] ?? mkConst('Unit'));
    }
    const parts: string[] = [];
    for (let i = 0; i < d.numFields; i++) {
      ct = tc.whnf(ct);
      if (ct.k !== 'pi') break;
      const ft = ct.type;
      const explicit = ct.binfo === 'default';
      const fv = v.f[i];
      // erased fields (types, proofs) are not shown
      if (explicit && fv !== null) parts.push(isStruct ? `${ct.name} := ${go(fv, ft, depth + 1, false)}` : go(fv, ft, depth + 1, true));
      ct = instantiate1(ct.body, mkConst('Unit.unit'));
    }
    if (isStruct) return `{ ${parts.join(', ')} }`;
    const s = [short, ...parts].join(' ');
    return atom && parts.length > 0 ? `(${s})` : s;
  };
  return go(v, type, 0, false);
}

export { mkApps };
