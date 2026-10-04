/**
 * Run-time meaning of separation-logic assertions (chapters 21–22).
 *
 * An assertion holds in a heap when it describes a part of the heap, its footprint: `x.f |-> v` owns the one
 * field x.f, `P ** Q` holds when P and Q hold on *disjoint* parts, `emp` owns nothing, and a pure condition owns
 * nothing and must be true. This evaluator computes one footprint (trying witnesses for `exists` over references),
 * which is what the interpreter needs to check contracts on concrete runs; the separation-logic prover reasons
 * about all heaps symbolically.
 */
import type * as A from '../syntax/ast';
import type { Evaluator, Env } from './eval';
import { RuntimeFailure } from './eval';
import { equal, type Value } from './values';

export type Footprint = Set<string>;

export function spatialHolds(ev: Evaluator, e: A.Expr, env: Env): boolean {
  return footprint(ev, e, env) !== false;
}

export function footprint(ev: Evaluator, e: A.Expr, env: Env): Footprint | false {
  ev.tick(e.span);
  const t = ev.checked.types.get(e);
  switch (e.k) {
    case 'emp':
      return new Set();
    case 'binary':
      if (e.op === '**' || (e.op === '&&' && t?.k === 'heapprop')) {
        const a = footprint(ev, e.left, env);
        if (a === false) return false;
        const b = footprint(ev, e.right, env);
        if (b === false) return false;
        if (e.op === '**') {
          for (const x of b) if (a.has(x)) return false; // overlap: the two parts are not separate
        }
        return new Set([...a, ...b]);
      }
      if (e.op === '|->') {
        if (e.left.k !== 'field') return false;
        const r = ev.eval(e.left.target, env);
        if (r === null) return false;
        const addr = (r as { addr: number }).addr;
        const o = env.heap.get(addr);
        if (!o || o.freed) return false;
        const cls = ev.checked.globals.lookup(o.cls)?.ty;
        const i = cls?.k === 'struct' ? cls.fields.findIndex((f) => f.name === (e.left as { name: string }).name) : -1;
        if (i < 0) return false;
        const v = ev.eval(e.right, env);
        return equal(o.fields[i]!, v) ? new Set([`${addr}.${(e.left as { name: string }).name}`]) : false;
      }
      break;
    case 'if':
      return footprint(ev, ev.eval(e.cond, env) ? e.then : e.else, env);
    case 'quant':
      if (e.q === 'exists' && t?.k === 'heapprop') return existsFootprint(ev, e, env);
      break;
    case 'call': {
      const s = ev.checked.refs.get(e);
      if (s?.kind === 'fn' && s.ty.k === 'func' && s.ty.result.k === 'heapprop') {
        const info = ev.fnInfo(s);
        const vals = new Map(env.vals);
        info.params.forEach((p, i) => vals.set(p.id, ev.eval(e.args[i]!, env)));
        const body = info.decl.body;
        if (!body || 'stmts' in body) return false;
        return footprint(ev, body, { ...env, vals });
      }
      break;
    }
    case 'block': {
      const vals = new Map(env.vals);
      for (const l of e.lets) vals.set(ev.sym(l).id, ev.eval(l.value, { ...env, vals }));
      return footprint(ev, e.body, { ...env, vals });
    }
  }
  // A pure condition.
  return ev.eval(e, env) ? new Set() : false;
}

function existsFootprint(ev: Evaluator, e: A.Expr & { k: 'quant' }, env: Env): Footprint | false {
  const syms = e.binders.map((b) => ev.sym(b));
  const candidates = (k: number): Value[] => {
    const t = syms[k]!.ty;
    if (t.k === 'ref') {
      const refs: Value[] = env.heap.objs.map((o, i) => (o.freed ? undefined : { t: 'ref' as const, addr: i + 1 })).filter((x) => x !== undefined) as Value[];
      return t.nullable ? [null, ...refs] : refs;
    }
    throw new RuntimeFailure('unbounded-quantifier', e.span, 'At run time, `exists` in a heap assertion can only range over object references.');
  };
  const go = (k: number, vals: Map<number, Value>): Footprint | false => {
    if (k === syms.length) return footprint(ev, e.body, { ...env, vals });
    for (const v of candidates(k)) {
      const next = new Map(vals);
      next.set(syms[k]!.id, v);
      const r = go(k + 1, next);
      if (r !== false) return r;
    }
    return false;
  };
  return go(0, new Map(env.vals));
}
