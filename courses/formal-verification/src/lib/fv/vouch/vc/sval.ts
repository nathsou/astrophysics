/**
 * Symbolic values: how the verification-condition generator represents Vouch values as SMT terms.
 *
 *   - Booleans, integers of every flavour, bit-vectors, enum tags and atoms are single terms (`scalar`).
 *   - A sequence is a length term and a function from an index term to the element: `at(i)`. Parameters and
 *     havocked loop variables are backed by an SMT array (`at(i) = A[i]`); updates, slices, concatenations and
 *     comprehensions stay functional (`a[k := v]` is `i ↦ if i = k then v else a(i)`), so quantified properties keep
 *     triggers on the underlying array reads.
 *   - Multisets and sets are functions from an element to its count or membership; `multiset(a)` of an updated
 *     sequence is the old count with the overwritten element removed and the new one added.
 *   - Structs and tuples are their fields.
 */
import {
  add, and, app, arraySort, bvSort, eq, exists, forall, freshVar, iff, imp, INT, BOOL, ite, le, lt, num, or, select, store, sub, uSort,
  type Sort, type Term,
} from '../../logic/term';
import { intBounds, isIntLike, type Ty } from '../check/types';

export type SVal =
  | { k: 'scalar'; t: Term }
  | { k: 'seq'; elemTy: Ty; len: Term; at: (i: Term) => SVal; count?: (x: Term) => Term; arr?: Term }
  | { k: 'struct'; ty: Ty & { k: 'struct' }; fields: SVal[] }
  | { k: 'set'; elemTy: Ty; mem: (x: Term) => Term }
  | { k: 'mset'; elemTy: Ty; count: (x: Term) => Term }
  | { k: 'tuple'; items: SVal[] };

export class Unsupported extends Error {}

export const scalar = (t: Term): SVal => ({ k: 'scalar', t });

export function asTerm(v: SVal): Term {
  if (v.k !== 'scalar') throw new Unsupported('a compound value where a single value was expected');
  return v.t;
}

/** The SMT sort of a scalar Vouch type. */
export function sortOf(t: Ty): Sort {
  switch (t.k) {
    case 'bool':
      return BOOL;
    case 'int':
    case 'nat':
    case 'range':
    case 'mach':
      return INT;
    case 'bv':
      return bvSort(t.bits);
    case 'enum':
      if (t.variants.some((v) => v.fields.length)) throw new Unsupported('enums with fields are not supported by the program verifier yet');
      return INT;
    case 'atom':
      return uSort(t.name);
    default:
      throw new Unsupported(`values of this type (${t.k}) are not supported by the program verifier yet`);
  }
}

export const isScalarTy = (t: Ty) => ['bool', 'int', 'nat', 'range', 'mach', 'bv', 'enum', 'atom'].includes(t.k);

/** Facts every value of the type satisfies (bounds of nat, ranges and machine integers; enum tags). */
export function typeFacts(t: Ty, v: SVal): Term[] {
  if (v.k === 'scalar') {
    if (isIntLike(t)) {
      const [lo, hi] = intBounds(t);
      return [...(lo !== undefined ? [le(num(lo), v.t)] : []), ...(hi !== undefined ? [le(v.t, num(hi))] : [])];
    }
    if (t.k === 'enum') return [le(num(0), v.t), lt(v.t, num(t.variants.length))];
    return [];
  }
  if (v.k === 'seq') {
    const out = [le(num(0), v.len)];
    if (v.arr && isScalarTy(v.elemTy)) {
      const i = freshVar('i', INT);
      const inner = typeFacts(v.elemTy, v.at(i));
      if (inner.length) out.push(forall([i], imp(and(le(num(0), i), lt(i, v.len)), and(...inner)), [[select(v.arr, i)]]));
    }
    return out;
  }
  if (v.k === 'struct' && t.k === 'struct') return t.fields.flatMap((f, i) => typeFacts(f.ty, v.fields[i]!));
  if (v.k === 'tuple' && t.k === 'tuple') return t.elems.flatMap((e, i) => typeFacts(e, v.items[i]!));
  return [];
}

/** A fresh, unconstrained value of a type (parameters, havocked variables, call results). */
export function freshValue(t: Ty, name: string, keepLen?: Term): SVal {
  if (isScalarTy(t)) return scalar(freshVar(name, sortOf(t)));
  switch (t.k) {
    case 'seq': {
      const len = keepLen ?? freshVar(`len_${name}`, INT);
      if (isScalarTy(t.elem)) {
        const s = sortOf(t.elem);
        const A = freshVar(name, arraySort(INT, s));
        return { k: 'seq', elemTy: t.elem, len, arr: A, at: (i) => scalar(select(A, i)), count: (x) => app(`count_${s.k}`, [A, len, x], INT) };
      }
      if (t.elem.k === 'struct') {
        const st = t.elem;
        const arrs = st.fields.map((f) => {
          if (!isScalarTy(f.ty)) throw new Unsupported('sequences of structs with compound fields are not supported by the program verifier yet');
          return freshVar(`${name}_${f.name}`, arraySort(INT, sortOf(f.ty)));
        });
        return { k: 'seq', elemTy: t.elem, len, at: (i) => ({ k: 'struct', ty: st, fields: arrs.map((A) => scalar(select(A, i))) }) };
      }
      throw new Unsupported('sequences of sequences are not supported by the program verifier yet');
    }
    case 'struct':
      return { k: 'struct', ty: t, fields: t.fields.map((f) => freshValue(f.ty, `${name}_${f.name}`)) };
    case 'tuple':
      return { k: 'tuple', items: t.elems.map((e, i) => freshValue(e, `${name}_${i}`)) };
    case 'set': {
      const s = sortOf(t.elem);
      const S = freshVar(name, arraySort(s, BOOL));
      return { k: 'set', elemTy: t.elem, mem: (x) => select(S, x) };
    }
    case 'multiset': {
      const s = sortOf(t.elem);
      const M = freshVar(name, arraySort(s, INT));
      return { k: 'mset', elemTy: t.elem, count: (x) => select(M, x) };
    }
    default:
      throw new Unsupported(`values of type ${t.k} are not supported by the program verifier yet`);
  }
}

/** The default value of a type (what `var x: T` without an initialiser holds). */
export function defaultValue(t: Ty): SVal {
  switch (t.k) {
    case 'bool':
      return scalar(and());
    case 'seq':
      return { k: 'seq', elemTy: t.elem, len: num(0), at: () => defaultValue(t.elem), count: () => num(0) };
    case 'struct':
      return { k: 'struct', ty: t, fields: t.fields.map((f) => defaultValue(f.ty)) };
    case 'tuple':
      return { k: 'tuple', items: t.elems.map(defaultValue) };
    case 'set':
      return { k: 'set', elemTy: t.elem, mem: () => or() };
    case 'multiset':
      return { k: 'mset', elemTy: t.elem, count: () => num(0) };
    case 'range':
      return scalar(num(t.lo));
    default:
      if (isIntLike(t) || t.k === 'enum') return scalar(num(0));
      if (t.k === 'bv') return scalar(freshVar('bv0', bvSort(t.bits)));
      throw new Unsupported(`no default value for ${t.k}`);
  }
}

/** if c then a else b, for symbolic values of the same type. */
export function joinS(c: Term, a: SVal, b: SVal): SVal {
  if (a === b) return a;
  if (a.k === 'scalar' && b.k === 'scalar') return scalar(ite(c, a.t, b.t));
  if (a.k === 'seq' && b.k === 'seq') {
    return {
      k: 'seq',
      elemTy: a.elemTy,
      len: ite(c, a.len, b.len),
      at: (i) => joinS(c, a.at(i), b.at(i)),
      count: a.count && b.count ? (x) => ite(c, a.count!(x), b.count!(x)) : undefined,
    };
  }
  if (a.k === 'struct' && b.k === 'struct') return { k: 'struct', ty: a.ty, fields: a.fields.map((f, i) => joinS(c, f, b.fields[i]!)) };
  if (a.k === 'tuple' && b.k === 'tuple') return { k: 'tuple', items: a.items.map((f, i) => joinS(c, f, b.items[i]!)) };
  if (a.k === 'set' && b.k === 'set') return { k: 'set', elemTy: a.elemTy, mem: (x) => ite(c, a.mem(x), b.mem(x)) };
  if (a.k === 'mset' && b.k === 'mset') return { k: 'mset', elemTy: a.elemTy, count: (x) => ite(c, a.count(x), b.count(x)) };
  throw new Unsupported('joining values of different shapes');
}

/** Equality of symbolic values, as a formula (quantified for sequences, sets and multisets). */
export function eqS(a: SVal, b: SVal): Term {
  if (a.k === 'scalar' && b.k === 'scalar') return a.t.sort.k === 'bool' ? iff(a.t, b.t) : eq(a.t, b.t);
  if (a.k === 'seq' && b.k === 'seq') {
    const i = freshVar('i', INT);
    return and(eq(a.len, b.len), forall([i], imp(and(le(num(0), i), lt(i, a.len)), eqS(a.at(i), b.at(i)))));
  }
  if (a.k === 'struct' && b.k === 'struct') return and(...a.fields.map((f, i) => eqS(f, b.fields[i]!)));
  if (a.k === 'tuple' && b.k === 'tuple') return and(...a.items.map((f, i) => eqS(f, b.items[i]!)));
  if (a.k === 'set' && b.k === 'set') {
    const x = freshVar('x', sortOf(a.elemTy));
    return forall([x], iff(a.mem(x), b.mem(x)));
  }
  if (a.k === 'mset' && b.k === 'mset') {
    const x = freshVar('x', sortOf(a.elemTy));
    return forall([x], eq(a.count(x), b.count(x)));
  }
  throw new Unsupported('comparing values of different shapes');
}

/** x ∈ s for a sequence: some index holds x. */
export function seqContains(s: SVal & { k: 'seq' }, x: SVal): Term {
  const i = freshVar('i', INT);
  return exists([i], and(le(num(0), i), lt(i, s.len), eqS(s.at(i), x)));
}

/** The multiset of a sequence's elements (as a count function). Updates keep an exact count. */
export function countOf(s: SVal & { k: 'seq' }): ((x: Term) => Term) | undefined {
  return s.count;
}

/** a[k := v] on a sequence (k assumed in bounds: the caller checks it). */
export function seqStore(s: SVal & { k: 'seq' }, k: Term, v: SVal): SVal {
  const old = s.at(k);
  return {
    k: 'seq',
    elemTy: s.elemTy,
    len: s.len,
    // As an array term too, so that equal updates of the same array are the same term (function arguments,
    // recursive definitions); reading it back agrees with `at`.
    arr: s.arr && v.k === 'scalar' ? store(s.arr, k, v.t) : undefined,
    at: (i) => joinS(eq(i, k), v, s.at(i)),
    count:
      s.count && old.k === 'scalar' && v.k === 'scalar'
        ? (x) => sub(add(s.count!(x), ite(eq(x, v.t), num(1), num(0))), ite(eq(x, old.t), num(1), num(0)))
        : undefined,
  };
}

/** a[lo..hi] (bounds assumed checked). */
export function seqSlice(s: SVal & { k: 'seq' }, lo: Term, hi: Term): SVal {
  if (lo.op === 'num' && lo.value === 0n && hi === s.len) return s;
  return { k: 'seq', elemTy: s.elemTy, len: sub(hi, lo), at: (i) => s.at(add(lo, i)) };
}

export function seqConcat(a: SVal & { k: 'seq' }, b: SVal & { k: 'seq' }): SVal {
  return {
    k: 'seq',
    elemTy: a.elemTy,
    len: add(a.len, b.len),
    at: (i) => joinS(lt(i, a.len), a.at(i), b.at(sub(i, a.len))),
    count: a.count && b.count ? (x) => add(a.count!(x), b.count!(x)) : undefined,
  };
}

export function seqLiteral(elemTy: Ty, items: SVal[]): SVal {
  return {
    k: 'seq',
    elemTy,
    len: num(items.length),
    at: (i) => (items.length ? items.slice(0, -1).reduceRight((acc, x, k) => joinS(eq(i, num(k)), x, acc), items[items.length - 1]!) : defaultValue(elemTy)),
    count: items.every((x) => x.k === 'scalar') ? (x) => add(num(0), ...items.map((y) => ite(eq(x, (y as { t: Term }).t), num(1), num(0)))) : undefined,
  };
}
