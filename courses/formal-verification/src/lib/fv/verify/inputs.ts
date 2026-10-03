/**
 * Random inputs for testing a function against its contract (the "tested" rung of the badge ladder, and the
 * soundness fuzzing of the verifier). Small values are favoured, with a few extremes of machine types.
 */
import type { Ty } from '../vouch/check/types';
import { machBounds } from '../vouch/check/types';
import type { Rng } from '../util/random';
import { enumerate, funcConst, funcSet, mset, seq, set, type Value } from '../vouch/interp/values';

export function randomValue(t: Ty, r: Rng, depth = 0): Value | undefined {
  switch (t.k) {
    case 'bool':
      return r.chance(0.5);
    case 'int':
      return BigInt(r.chance(0.8) ? r.int(-10, 11) : r.int(-1000, 1001));
    case 'nat':
      return BigInt(r.chance(0.8) ? r.int(0, 11) : r.int(0, 1001));
    case 'range':
      return t.lo + BigInt(r.int(0, Number(t.hi - t.lo)));
    case 'mach': {
      const [lo, hi] = machBounds(t);
      if (r.chance(0.05)) return lo;
      if (r.chance(0.05)) return hi;
      const small = BigInt(r.int(t.signed ? -20 : 0, 21));
      return small < lo ? lo : small > hi ? hi : small;
    }
    case 'bv':
      return BigInt.asUintN(t.bits, BigInt(r.nextU32()) | (BigInt(r.nextU32()) << 32n));
    case 'seq': {
      const n = depth > 1 ? r.int(0, 3) : r.int(0, 9);
      const items: Value[] = [];
      for (let i = 0; i < n; i++) {
        const v = randomValue(t.elem, r, depth + 1);
        if (v === undefined) return undefined;
        items.push(v);
      }
      return seq(items);
    }
    case 'set':
    case 'multiset': {
      const n = r.int(0, 6);
      const items: Value[] = [];
      for (let i = 0; i < n; i++) {
        const v = randomValue(t.elem, r, depth + 1);
        if (v === undefined) return undefined;
        items.push(v);
      }
      return t.k === 'set' ? set(items) : mset(items);
    }
    case 'map': {
      let m: Value = { t: 'map', entries: [] };
      for (let i = r.int(0, 5); i > 0; i--) {
        const k = randomValue(t.key, r, depth + 1);
        const v = randomValue(t.val, r, depth + 1);
        if (k === undefined || v === undefined) return undefined;
        m = funcSet(m as { t: 'map'; entries: [] }, k, v);
      }
      return m;
    }
    case 'struct': {
      const fields: Value[] = [];
      for (const f of t.fields) {
        const v = randomValue(f.ty, r, depth + 1);
        if (v === undefined) return undefined;
        fields.push(v);
      }
      return { t: 'struct', name: t.name, fields };
    }
    case 'tuple': {
      const items: Value[] = [];
      for (const e of t.elems) {
        const v = randomValue(e, r, depth + 1);
        if (v === undefined) return undefined;
        items.push(v);
      }
      return { t: 'tuple', items };
    }
    case 'enum':
    case 'atom': {
      const all = enumerate(t);
      return all?.length ? r.pick(all) : undefined;
    }
    case 'func': {
      const def = randomValue(t.result, r, depth + 1);
      if (def === undefined) return undefined;
      let f = funcConst(def);
      if (t.params.length === 1) {
        for (let i = r.int(0, 4); i > 0; i--) {
          const k = randomValue(t.params[0]!, r, depth + 1);
          const v = randomValue(t.result, r, depth + 1);
          if (k !== undefined && v !== undefined) f = funcSet(f, k, v);
        }
      }
      return f;
    }
    default:
      return undefined;
  }
}
