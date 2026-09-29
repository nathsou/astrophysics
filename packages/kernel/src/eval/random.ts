// Random testing: evaluate a decidable statement on random inputs.
//
// `#test ∀ (x : A) (y : B), P x y` compiles `fun x y => decide (P x y)` and runs
// it on random values of A and B. It never proves anything — a passing test is
// evidence, not a proof — but a failing test is a counterexample, which saves
// trying to prove something false.

import { type Expr, getAppArgs, getAppFn, instantiate1, instantiateLevelParamsExpr } from '../core/expr.ts';
import { toNat } from '../core/level.ts';
import { type Environment, LocalContext } from '../core/env.ts';
import { TypeChecker } from '../core/typechecker.ts';
import { type CtorVal, type Fn, type Value, EvalError } from './compile.ts';

/** a small deterministic PRNG (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Generated {
  value: Value;
  /** how to show it (functions are shown as tables) */
  show?: string;
}

export class Generator {
  private tc: TypeChecker;
  constructor(
    readonly env: Environment,
    readonly rand: () => number,
  ) {
    this.tc = new TypeChecker(env, LocalContext.empty, { fuel: 100_000 });
  }

  private int(n: number): number {
    return Math.floor(this.rand() * n);
  }

  /** a random value of type t, of size at most `size` */
  gen(t: Expr, size: number): Generated {
    const w = this.tc.whnf(t);
    if (w.k === 'pi') {
      // a function: a random finite table, extended by a default
      const dom = w.type;
      const k = 1 + this.int(4);
      const outs: Generated[] = [];
      for (let i = 0; i < k; i++) outs.push(this.gen(instantiate1(w.body, dom), Math.max(1, size - 1)));
      const key = (v: Value): number => {
        if (typeof v === 'bigint') return Number(v % BigInt(k));
        return Math.abs(hash(JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x)))) % k;
      };
      const f: Fn = (v: Value) => outs[key(v)].value;
      const isNat = getAppFn(this.tc.whnf(dom)).k === 'const' && (getAppFn(this.tc.whnf(dom)) as { name: string }).name === 'Nat';
      const shown = outs.map((o) => o.show ?? '?');
      const show = shown.every((x) => x === shown[0])
        ? `fun _ => ${shown[0]}`
        : !isNat
          ? `fun ⋯`
          : k === 2
            ? `fun x => if x % 2 = 0 then ${shown[0]} else ${shown[1]}`
            : `fun x => [${shown.join(', ')}][x % ${k}]`;
      return { value: f, show };
    }
    const h = getAppFn(w);
    if (h.k !== 'const') throw new EvalError('#test: cannot generate values of this type');
    if (h.name === 'Nat') {
      const r = this.rand();
      const n = r < 0.6 ? this.int(Math.min(6, size + 2)) : this.int(Math.max(1, size * 3));
      return { value: BigInt(n), show: String(n) };
    }
    const d = this.env.get(h.name);
    if (!d || d.kind !== 'inductive') throw new EvalError(`#test: cannot generate values of type '${h.name}'`);
    if (d.numIndices > 0) throw new EvalError(`#test: cannot generate values of the inductive family '${h.name}'`);
    const args = getAppArgs(w);
    // constructors, with their field types
    const ctors = d.ctors.map((c) => {
      const cd = this.env.get(c) as { numParams: number; numFields: number; type: Expr; levelParams: string[] };
      let ct = instantiateLevelParamsExpr(cd.type, cd.levelParams, h.levels);
      for (let i = 0; i < cd.numParams; i++) {
        ct = this.tc.whnf(ct);
        ct = instantiate1((ct as Extract<Expr, { k: 'pi' }>).body, args[i]);
      }
      const fields: { type: Expr; relevant: boolean; recursive: boolean }[] = [];
      for (let i = 0; i < cd.numFields; i++) {
        ct = this.tc.whnf(ct);
        const pi = ct as Extract<Expr, { k: 'pi' }>;
        const ft = pi.type;
        const fh = getAppFn(this.tc.whnf(ft));
        let relevant = true;
        try {
          const s = this.tc.whnf(this.tc.inferOnly(ft));
          if (s.k === 'sort' && toNat(s.level) === 0) relevant = false;
        } catch {
          relevant = true;
        }
        fields.push({ type: ft, relevant, recursive: fh.k === 'const' && fh.name === h.name });
        ct = instantiate1(pi.body, ft);
      }
      return { name: c, fields };
    });
    const usable = ctors.filter((c) => c.fields.every((f) => f.relevant || f.type.k === 'sort'));
    if (usable.length === 0) throw new EvalError(`#test: cannot generate values of '${h.name}' (its constructors need proofs)`);
    const base = usable.filter((c) => !c.fields.some((f) => f.recursive));
    const pool = size <= 0 && base.length > 0 ? base : usable;
    // lists get more elements than a uniform choice would give
    const pick = h.name === 'List' && size > 0 ? (this.rand() < 0.2 ? pool[0] : pool[pool.length - 1]) : pool[this.int(pool.length)];
    const f: Value[] = pick.fields.map((fd) => (fd.relevant ? this.gen(fd.type, fd.recursive ? size - 1 : Math.floor(size / 2)).value : null));
    const v: CtorVal = { c: pick.name, f };
    return { value: v };
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
