// `deriving DecidableEq`: generate a decision procedure for equality.
//
// The procedure is ordinary source code, elaborated and checked like anything
// the user writes: for two values built with the same constructor, compare the
// fields one by one; for different constructors, the equation is impossible.

import { getAppFn, instantiate1 } from '../core/expr.ts';
import type { Environment } from '../core/env.ts';
import { toNat } from '../core/level.ts';

export function derivingDecidableEq(env: Environment, name: string): string {
  const ind = env.get(name);
  if (!ind || ind.kind !== 'inductive') throw new Error(`deriving DecidableEq: '${name}' is not an inductive type`);
  if (ind.numIndices > 0) throw new Error(`deriving DecidableEq: '${name}' is an inductive family (it has indices)`);
  // parameters: only types (they get a DecidableEq instance argument)
  const params: string[] = [];
  let t = ind.type;
  for (let i = 0; i < ind.numParams; i++) {
    if (t.k !== 'pi' || t.type.k !== 'sort' || toNat(t.type.level) !== 1) {
      throw new Error(`deriving DecidableEq: only parameters of type Type are supported`);
    }
    params.push(`α${i + 1}`);
    t = t.body;
  }
  const binders = params.map((p) => `{${p} : Type} [DecidableEq ${p}]`).join(' ');
  const self = params.length ? `(${name} ${params.join(' ')})` : name;
  const fn = `${name}.decEq`;
  const ctors = ind.ctors.map((c) => {
    const cd = env.get(c) as { numParams: number; numFields: number; type: import('../core/expr.ts').Expr };
    // which fields are recursive occurrences of the type
    let ct = cd.type;
    for (let i = 0; i < cd.numParams; i++) ct = instantiate1((ct as Extract<typeof ct, { k: 'pi' }>).body, { k: 'bvar', i: 0, lb: 1, fv: false, mv: false, lp: false });
    const rec: boolean[] = [];
    for (let i = 0; i < cd.numFields; i++) {
      const pi = ct as Extract<typeof ct, { k: 'pi' }>;
      const h = getAppFn(pi.type);
      if (pi.type.k === 'pi') throw new Error(`deriving DecidableEq: constructor '${c}' has a function-typed field`);
      rec.push(h.k === 'const' && h.name === name);
      ct = pi.body;
    }
    return { name: c, n: cd.numFields, rec };
  });
  const lines: string[] = [];
  lines.push(`def ${fn} ${binders} : (a b : ${self}) → Decidable (a = b)`);
  for (const a of ctors) {
    for (const b of ctors) {
      const xs = Array.from({ length: a.n }, (_, i) => `x${i}`);
      const ys = Array.from({ length: b.n }, (_, i) => `y${i}`);
      const pa = a.n ? `@${a.name} ${xs.join(' ')}` : `@${a.name}`;
      const pb = b.n ? `@${b.name} ${ys.join(' ')}` : `@${b.name}`;
      if (a.name !== b.name) {
        lines.push(`  | ${pa.replace(/x\d+/g, '_')}, ${pb.replace(/y\d+/g, '_')} => Decidable.isFalse (fun h => nomatch h)`);
        continue;
      }
      if (a.n === 0) {
        lines.push(`  | ${pa}, ${pb} => Decidable.isTrue rfl`);
        continue;
      }
      const substs = xs.map((_, i) => `subst h${i}`).join('; ');
      let body = `Decidable.isTrue (by ${substs}; rfl)`;
      for (let i = a.n - 1; i >= 0; i--) {
        const cmp = a.rec[i] ? `${fn} x${i} y${i}` : `decEq x${i} y${i}`;
        body = `(match ${cmp} with | Decidable.isTrue h${i} => ${body} | Decidable.isFalse h${i} => Decidable.isFalse (fun h => by cases h; exact h${i} rfl))`;
      }
      lines.push(`  | ${pa}, ${pb} => ${body}`);
    }
  }
  lines.push(`instance ${binders} : DecidableEq ${self} := ${fn}`);
  return lines.join('\n') + '\n';
}
