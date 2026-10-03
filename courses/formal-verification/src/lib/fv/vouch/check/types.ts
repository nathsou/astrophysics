/**
 * Vouch types, as the checker and every engine see them (docs/VOUCH.md, "Types").
 *
 * Integers come in four flavours that mix freely in comparisons:
 *   int         mathematical integers (unbounded)
 *   nat         non-negative mathematical integers (assigning a negative value is an obligation)
 *   lo..hi      a finite range (state variables of systems; assigning outside it is an obligation)
 *   i8…u64      machine integers: arithmetic in executable code overflows, and every operation is an obligation
 * Bit-vectors (bv1…bv64) wrap silently and convert only with `as`.
 */

export type Ty =
  | { k: 'bool' }
  | { k: 'int' }
  | { k: 'nat' }
  | { k: 'range'; lo: bigint; hi: bigint } // [lo, hi)
  | { k: 'mach'; signed: boolean; bits: number }
  | { k: 'bv'; bits: number }
  | { k: 'enum'; name: string; variants: { name: string; fields: { name: string; ty: Ty }[] }[] }
  | { k: 'struct'; name: string; fields: { name: string; ty: Ty; ghost: boolean }[] }
  | { k: 'seq'; elem: Ty }
  | { k: 'set'; elem: Ty }
  | { k: 'multiset'; elem: Ty }
  | { k: 'map'; key: Ty; val: Ty }
  | { k: 'func'; params: Ty[]; result: Ty }
  | { k: 'tuple'; elems: Ty[] }
  /** Atoms of a declared type without a definition (`type Shard`): equality only. `size` comes from `instance`. */
  | { k: 'atom'; name: string; size?: number; symmetric: boolean }
  | { k: 'ref'; cls: string; nullable: boolean }
  /** A relation in a world: a set of tuples over atom types. */
  | { k: 'rel'; cols: Ty[] }
  /** A separation-logic assertion (a predicate on heaps). */
  | { k: 'heapprop' }
  /** A temporal formula (LTL). */
  | { k: 'temporal' }
  /** Placeholder for the element type of an empty literal; compatible with anything. */
  | { k: 'unknown' }
  | { k: 'void' }
  /** After a type error, to avoid cascades. */
  | { k: 'error' };

export const BOOL: Ty = { k: 'bool' };
export const INT: Ty = { k: 'int' };
export const NAT: Ty = { k: 'nat' };
export const VOID: Ty = { k: 'void' };
export const ERR: Ty = { k: 'error' };
export const UNKNOWN: Ty = { k: 'unknown' };
export const HEAPPROP: Ty = { k: 'heapprop' };
export const TEMPORAL: Ty = { k: 'temporal' };

export const isIntLike = (t: Ty) => t.k === 'int' || t.k === 'nat' || t.k === 'range' || t.k === 'mach';
export const isNumeric = (t: Ty) => isIntLike(t) || t.k === 'bv';
export const isBoolLike = (t: Ty) => t.k === 'bool';
export const isPermissive = (t: Ty) => t.k === 'error' || t.k === 'unknown';

/** Bounds of a machine integer type, as [min, max]. */
export function machBounds(t: { signed: boolean; bits: number }): [bigint, bigint] {
  const b = BigInt(t.bits);
  return t.signed ? [-(1n << (b - 1n)), (1n << (b - 1n)) - 1n] : [0n, (1n << b) - 1n];
}

/** Inclusive bounds of an integer-like type, if it has any. */
export function intBounds(t: Ty): [bigint | undefined, bigint | undefined] {
  if (t.k === 'nat') return [0n, undefined];
  if (t.k === 'range') return [t.lo, t.hi - 1n];
  if (t.k === 'mach') return machBounds(t);
  return [undefined, undefined];
}

export function tyEq(a: Ty, b: Ty): boolean {
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'range':
      return a.lo === (b as typeof a).lo && a.hi === (b as typeof a).hi;
    case 'mach':
      return a.signed === (b as typeof a).signed && a.bits === (b as typeof a).bits;
    case 'bv':
      return a.bits === (b as typeof a).bits;
    case 'enum':
    case 'struct':
    case 'atom':
      return a.name === (b as typeof a).name;
    case 'seq':
    case 'set':
    case 'multiset':
      return tyEq(a.elem, (b as typeof a).elem);
    case 'map':
      return tyEq(a.key, (b as typeof a).key) && tyEq(a.val, (b as typeof a).val);
    case 'func':
      return a.params.length === (b as typeof a).params.length && a.params.every((p, i) => tyEq(p, (b as typeof a).params[i]!)) && tyEq(a.result, (b as typeof a).result);
    case 'tuple':
      return a.elems.length === (b as typeof a).elems.length && a.elems.every((p, i) => tyEq(p, (b as typeof a).elems[i]!));
    case 'ref':
      return a.cls === (b as typeof a).cls && a.nullable === (b as typeof a).nullable;
    case 'rel':
      return a.cols.length === (b as typeof a).cols.length && a.cols.every((p, i) => tyEq(p, (b as typeof a).cols[i]!));
    default:
      return true;
  }
}

/**
 * Can a value of type `from` be stored where `to` is expected?
 * 'ok' — always fine; 'checked' — fine, with a proof obligation (or a run-time check) that the value fits;
 * 'no' — needs an explicit conversion.
 */
export function assignable(from: Ty, to: Ty): 'ok' | 'checked' | 'no' {
  if (isPermissive(from) || isPermissive(to)) return 'ok';
  if (tyEq(from, to)) return 'ok';
  if (isIntLike(from) && isIntLike(to)) {
    if (to.k === 'int') return 'ok';
    if (to.k === 'nat') return from.k === 'range' && from.lo >= 0n ? 'ok' : from.k === 'mach' && !from.signed ? 'ok' : 'checked';
    if (to.k === 'range') {
      const [lo, hi] = intBounds(from);
      return lo !== undefined && hi !== undefined && lo >= to.lo && hi < to.hi ? 'ok' : 'checked';
    }
    // to is a machine integer: only lossless widenings and ranges that fit are implicit.
    const [tlo, thi] = machBounds(to as { signed: boolean; bits: number });
    const [flo, fhi] = intBounds(from);
    if (flo !== undefined && fhi !== undefined && flo >= tlo && fhi <= thi) return 'ok';
    return 'no';
  }
  if (from.k === 'bool' && (to.k === 'heapprop' || to.k === 'temporal')) return 'ok';
  if (from.k === 'ref' && to.k === 'ref' && (from.cls === to.cls || from.cls === '') && to.nullable) return 'ok';
  if ((from.k === 'seq' && to.k === 'seq') || (from.k === 'set' && to.k === 'set') || (from.k === 'multiset' && to.k === 'multiset')) {
    const r = assignable(from.elem, (to as typeof from).elem);
    return r === 'ok' && (isPermissive(from.elem) || tyEq(from.elem, (to as typeof from).elem)) ? 'ok' : r === 'ok' ? 'no' : r;
  }
  if (from.k === 'map' && to.k === 'map') return assignable(from.key, to.key) === 'ok' && assignable(from.val, to.val) === 'ok' && (isPermissive(from.key) || tyEq(from.key, to.key)) ? 'ok' : 'no';
  if (from.k === 'tuple' && to.k === 'tuple' && from.elems.length === to.elems.length) {
    let worst: 'ok' | 'checked' = 'ok';
    for (let i = 0; i < from.elems.length; i++) {
      const r = assignable(from.elems[i]!, to.elems[i]!);
      if (r === 'no') return 'no';
      if (r === 'checked') worst = 'checked';
    }
    return worst;
  }
  if (from.k === 'rel' && to.k === 'rel') return from.cols.length === to.cols.length ? 'ok' : 'no';
  if (from.k === 'atom' && to.k === 'rel' && to.cols.length === 1) return 'ok';
  return 'no';
}

/** The type two branches (or two operands) share, if any. */
export function join(a: Ty, b: Ty): Ty | undefined {
  if (isPermissive(a)) return b;
  if (isPermissive(b)) return a;
  if (tyEq(a, b)) return a;
  if (isIntLike(a) && isIntLike(b)) {
    if (a.k === 'mach' && b.k === 'mach') return undefined;
    if (a.k === 'mach') return assignable(b, a) === 'ok' ? a : INT;
    if (b.k === 'mach') return assignable(a, b) === 'ok' ? b : INT;
    return INT;
  }
  if (a.k === 'ref' && b.k === 'ref' && (a.cls === b.cls || a.cls === '' || b.cls === '')) return { k: 'ref', cls: a.cls || b.cls, nullable: a.nullable || b.nullable };
  if ((a.k === 'seq' || a.k === 'set' || a.k === 'multiset') && a.k === b.k) {
    const e = join(a.elem, (b as typeof a).elem);
    return e ? { k: a.k, elem: e } : undefined;
  }
  if ((a.k === 'bool' && b.k === 'heapprop') || (a.k === 'heapprop' && b.k === 'bool')) return HEAPPROP;
  if ((a.k === 'bool' && b.k === 'temporal') || (a.k === 'temporal' && b.k === 'bool')) return TEMPORAL;
  return undefined;
}

export function showTy(t: Ty): string {
  switch (t.k) {
    case 'bool':
    case 'int':
    case 'nat':
    case 'void':
      return t.k;
    case 'range':
      return `${t.lo}..${t.hi}`;
    case 'mach':
      return `${t.signed ? 'i' : 'u'}${t.bits}`;
    case 'bv':
      return `bv${t.bits}`;
    case 'enum':
    case 'struct':
    case 'atom':
      return t.name;
    case 'seq':
      return `[${showTy(t.elem)}]`;
    case 'set':
    case 'multiset':
      return `${t.k}<${showTy(t.elem)}>`;
    case 'map':
      return `map<${showTy(t.key)}, ${showTy(t.val)}>`;
    case 'func':
      return `${t.params.length === 1 ? showTy(t.params[0]!) : `(${t.params.map(showTy).join(', ')})`} -> ${showTy(t.result)}`;
    case 'tuple':
      return `(${t.elems.map(showTy).join(', ')})`;
    case 'ref':
      return `ref ${t.cls}${t.nullable ? '?' : ''}`;
    case 'rel':
      return t.cols.map(showTy).join(' -> ');
    case 'heapprop':
      return 'heap assertion';
    case 'temporal':
      return 'temporal formula';
    case 'unknown':
      return '_';
    case 'error':
      return '?';
  }
}

/** Number of values of a finite type, or undefined when infinite (or too large to enumerate). */
export function finiteSize(t: Ty, limit = 1_000_000): number | undefined {
  switch (t.k) {
    case 'bool':
      return 2;
    case 'range':
      return Number(t.hi - t.lo);
    case 'mach':
    case 'bv':
      return t.bits <= 16 ? 2 ** t.bits : undefined;
    case 'enum': {
      let n = 0;
      for (const v of t.variants) {
        let m = 1;
        for (const f of v.fields) {
          const s = finiteSize(f.ty, limit);
          if (s === undefined) return undefined;
          m *= s;
        }
        n += m;
      }
      return n <= limit ? n : undefined;
    }
    case 'atom':
      return t.size;
    case 'struct':
    case 'tuple': {
      let n = 1;
      for (const f of t.k === 'struct' ? t.fields.map((x) => x.ty) : t.elems) {
        const s = finiteSize(f, limit);
        if (s === undefined) return undefined;
        n *= s;
        if (n > limit) return undefined;
      }
      return n;
    }
    case 'func': {
      let dom = 1;
      for (const p of t.params) {
        const s = finiteSize(p, limit);
        if (s === undefined) return undefined;
        dom *= s;
      }
      const r = finiteSize(t.result, limit);
      if (r === undefined) return undefined;
      const n = r ** dom;
      return n <= limit ? n : undefined;
    }
    default:
      return undefined;
  }
}
