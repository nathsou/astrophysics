/**
 * Symmetry reduction (chapter 2): when a type is declared `symmetric`, renaming its values (Shard0 ↔ Shard1, …)
 * maps reachable states to reachable states and preserves every property that does not name a particular value.
 * The explorer then keeps one representative per class: the state whose key is smallest among all renamings.
 */
import type { SystemRuntime, State } from '../vouch/interp/system';
import { compare, key, mset, rel, set, type Value } from '../vouch/interp/values';

const MAX_PERMS = 720;

function permutations(n: number): number[][] {
  if (n <= 1) return [[0].slice(0, n)];
  const out: number[][] = [];
  const go = (prefix: number[], rest: number[]) => {
    if (!rest.length) out.push(prefix);
    rest.forEach((x, i) => go([...prefix, x], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  go([], Array.from({ length: n }, (_, i) => i));
  return out;
}

export function mapAtoms(v: Value, type: string, perm: number[]): Value {
  if (v === null || typeof v !== 'object') return v;
  switch (v.t) {
    case 'atom':
      return v.type === type ? { ...v, i: perm[v.i]! } : v;
    case 'seq':
      return { t: 'seq', items: v.items.map((x) => mapAtoms(x, type, perm)) };
    case 'set':
      return set(v.items.map((x) => mapAtoms(x, type, perm)));
    case 'mset':
      return mset(v.items.flatMap(([x, n]) => Array<Value>(n).fill(mapAtoms(x, type, perm))));
    case 'map':
    case 'func': {
      const entries = v.entries.map(([k, x]) => [mapAtoms(k, type, perm), mapAtoms(x, type, perm)] as const).sort((a, b) => compare(a[0], b[0]));
      return v.t === 'func' ? { t: 'func', def: mapAtoms(v.def, type, perm), entries } : { t: 'map', entries };
    }
    case 'struct':
      return { ...v, fields: v.fields.map((x) => mapAtoms(x, type, perm)) };
    case 'enum':
      return { ...v, fields: v.fields.map((x) => mapAtoms(x, type, perm)) };
    case 'tuple':
      return { t: 'tuple', items: v.items.map((x) => mapAtoms(x, type, perm)) };
    case 'rel':
      return rel(v.arity, v.tuples.map((t) => t.map((x) => mapAtoms(x, type, perm))));
    default:
      return v;
  }
}

/** A function from a state to the canonical key of its symmetry class. */
export function canonicalizer(rt: SystemRuntime): (s: State) => string {
  const types = rt.info.atoms.filter((a): a is { k: 'atom'; name: string; size?: number; symmetric: boolean } => a.k === 'atom' && a.symmetric && (a.size ?? 0) > 1);
  if (!types.length) return (s) => rt.key(s);
  // One group of permutations per symmetric type; the full group is their product (capped).
  let group: { type: string; perm: number[] }[][] = [[]];
  for (const t of types) {
    const perms = permutations(t.size!);
    const next: { type: string; perm: number[] }[][] = [];
    for (const g of group) for (const p of perms) if (next.length < MAX_PERMS) next.push([...g, { type: t.name, perm: p }]);
    group = next;
  }
  // How each permutation moves process instances (when their parameters are of a symmetric type).
  const instKey = (args: Value[]) => args.map(key).join(',');
  const byArgs = new Map(rt.instances.map((inst, i) => [`${inst.proc.decl.name}|${instKey(inst.args)}`, i]));
  return (s: State) => {
    let best: string | undefined;
    for (const g of group) {
      const vals = [...s.vals];
      // Rename atoms everywhere.
      for (let i = 0; i < vals.length; i++) for (const { type, perm } of g) vals[i] = mapAtoms(vals[i]!, type, perm);
      // Move instance slots: instance i goes where its renamed arguments put it.
      for (let i = 0; i < rt.instances.length; i++) {
        const inst = rt.instances[i]!;
        let args = inst.args;
        for (const { type, perm } of g) args = args.map((a) => mapAtoms(a, type, perm));
        const j = byArgs.get(`${inst.proc.decl.name}|${instKey(args)}`);
        if (j === undefined || j === i) continue;
        const width = inst.proc.locals.length + 1;
        const target = rt.instances[j]!;
        for (let k = 0; k < width; k++) vals[target.base + k] = (() => {
          let w: Value = s.vals[inst.base + k]!;
          for (const { type, perm } of g) w = mapAtoms(w, type, perm);
          return w;
        })();
      }
      let k = '';
      for (const v of vals) k += key(v) + '|';
      if (best === undefined || k < best) best = k;
    }
    return best!;
  };
}
