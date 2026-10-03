/**
 * Run-time values of the reference interpreter. Values are immutable: updates build new values, so states of a
 * system can share structure and be compared by their canonical key.
 */
import { finiteSize, type Ty } from '../check/types';

export type Value =
  | boolean
  | bigint
  | null
  | SeqV
  | SetV
  | MsetV
  | MapV
  | FuncV
  | StructV
  | EnumV
  | TupleV
  | AtomV
  | RefV
  | RelV;

export interface SeqV {
  t: 'seq';
  items: readonly Value[];
}
export interface SetV {
  t: 'set';
  /** Sorted by `compare`, no duplicates. */
  items: readonly Value[];
}
export interface MsetV {
  t: 'mset';
  /** Sorted by element, counts > 0. */
  items: readonly (readonly [Value, number])[];
}
export interface MapV {
  t: 'map';
  /** Sorted by key. */
  entries: readonly (readonly [Value, Value])[];
}
/** A total function (system state like `flag: Proc -> bool`): a default value with exceptions. */
export interface FuncV {
  t: 'func';
  def: Value;
  /** Sorted by argument; never equal to the default. */
  entries: readonly (readonly [Value, Value])[];
}
export interface StructV {
  t: 'struct';
  name: string;
  fields: readonly Value[];
}
export interface EnumV {
  t: 'enum';
  name: string;
  tag: number;
  /** Variant name, for display. */
  variant: string;
  fields: readonly Value[];
}
export interface TupleV {
  t: 'tuple';
  items: readonly Value[];
}
export interface AtomV {
  t: 'atom';
  type: string;
  i: number;
}
export interface RefV {
  t: 'ref';
  addr: number;
}
/** A relation: a set of tuples of atoms (worlds). Unary relations hold 1-tuples. */
export interface RelV {
  t: 'rel';
  arity: number;
  /** Sorted, unique. */
  tuples: readonly (readonly Value[])[];
}

const kindRank = (v: Value): number => (v === null ? 0 : typeof v === 'boolean' ? 1 : typeof v === 'bigint' ? 2 : 3);

/** A total order on values (used for canonical forms of sets, maps and states). */
export function compare(a: Value, b: Value): number {
  if (a === b) return 0;
  const ra = kindRank(a);
  const rb = kindRank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === 'boolean') return (a ? 1 : 0) - ((b as boolean) ? 1 : 0);
  if (typeof a === 'bigint') return a < (b as bigint) ? -1 : a > (b as bigint) ? 1 : 0;
  if (a === null) return 0;
  const x = a as Exclude<Value, null | boolean | bigint>;
  const y = b as Exclude<Value, null | boolean | bigint>;
  if (x.t !== y.t) return x.t < y.t ? -1 : 1;
  switch (x.t) {
    case 'seq':
    case 'set':
    case 'tuple':
      return compareLists(x.items, (y as typeof x).items);
    case 'mset': {
      const yi = (y as MsetV).items;
      for (let i = 0; i < Math.min(x.items.length, yi.length); i++) {
        const c = compare(x.items[i]![0], yi[i]![0]) || x.items[i]![1] - yi[i]![1];
        if (c) return c;
      }
      return x.items.length - yi.length;
    }
    case 'map':
    case 'func': {
      if (x.t === 'func') {
        const c = compare(x.def, (y as FuncV).def);
        if (c) return c;
      }
      const ye = (y as MapV).entries;
      for (let i = 0; i < Math.min(x.entries.length, ye.length); i++) {
        const c = compare(x.entries[i]![0], ye[i]![0]) || compare(x.entries[i]![1], ye[i]![1]);
        if (c) return c;
      }
      return x.entries.length - ye.length;
    }
    case 'struct':
      return x.name < (y as StructV).name ? -1 : x.name > (y as StructV).name ? 1 : compareLists(x.fields, (y as StructV).fields);
    case 'enum':
      return x.name !== (y as EnumV).name ? (x.name < (y as EnumV).name ? -1 : 1) : x.tag - (y as EnumV).tag || compareLists(x.fields, (y as EnumV).fields);
    case 'atom':
      return x.type !== (y as AtomV).type ? (x.type < (y as AtomV).type ? -1 : 1) : x.i - (y as AtomV).i;
    case 'ref':
      return x.addr - (y as RefV).addr;
    case 'rel': {
      const yt = (y as RelV).tuples;
      for (let i = 0; i < Math.min(x.tuples.length, yt.length); i++) {
        const c = compareLists(x.tuples[i]!, yt[i]!);
        if (c) return c;
      }
      return x.tuples.length - yt.length;
    }
  }
}

function compareLists(a: readonly Value[], b: readonly Value[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const c = compare(a[i]!, b[i]!);
    if (c) return c;
  }
  return a.length - b.length;
}

export const equal = (a: Value, b: Value) => compare(a, b) === 0;

/** A canonical string for a value: equal values have equal keys (states are hashed by these). */
export function key(v: Value): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'T' : 'F';
  if (typeof v === 'bigint') return v.toString();
  switch (v.t) {
    case 'seq':
      return `[${v.items.map(key).join(',')}]`;
    case 'set':
      return `{${v.items.map(key).join(',')}}`;
    case 'mset':
      return `{|${v.items.map(([x, n]) => `${key(x)}*${n}`).join(',')}|}`;
    case 'map':
      return `<${v.entries.map(([k, x]) => `${key(k)}:${key(x)}`).join(',')}>`;
    case 'func':
      return `λ${key(v.def)}<${v.entries.map(([k, x]) => `${key(k)}:${key(x)}`).join(',')}>`;
    case 'struct':
      return `(${v.fields.map(key).join(',')})`;
    case 'enum':
      return v.fields.length ? `${v.tag}(${v.fields.map(key).join(',')})` : `#${v.tag}`;
    case 'tuple':
      return `(${v.items.map(key).join(',')})`;
    case 'atom':
      return `${v.type}${v.i}`;
    case 'ref':
      return `@${v.addr}`;
    case 'rel':
      return `R{${v.tuples.map((t) => t.map(key).join('>')).join(',')}}`;
  }
}

/** A human-readable rendering in Vouch syntax, for traces and counterexamples. */
export function show(v: Value): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'bigint') return v.toString();
  switch (v.t) {
    case 'seq':
      return `[${v.items.map(show).join(', ')}]`;
    case 'set':
      return `{${v.items.map(show).join(', ')}}`;
    case 'mset':
      return `multiset{${v.items.flatMap(([x, n]) => Array(n).fill(show(x))).join(', ')}}`;
    case 'map':
      return `map{${v.entries.map(([k, x]) => `${show(k)}: ${show(x)}`).join(', ')}}`;
    case 'func':
      return v.entries.length ? `[${v.entries.map(([k, x]) => `${show(k)} ↦ ${show(x)}`).join(', ')}, else ${show(v.def)}]` : `[all ↦ ${show(v.def)}]`;
    case 'struct':
      return `${v.name} { ${v.fields.map(show).join(', ')} }`;
    case 'enum':
      return v.fields.length ? `${v.variant}(${v.fields.map(show).join(', ')})` : v.variant;
    case 'tuple':
      return `(${v.items.map(show).join(', ')})`;
    case 'atom':
      return `${v.type}${v.i}`;
    case 'ref':
      return `#${v.addr}`;
    case 'rel':
      return `{${v.tuples.map((t) => t.map(show).join('→')).join(', ')}}`;
  }
}

// ── Constructors ──
export const seq = (items: readonly Value[]): SeqV => ({ t: 'seq', items });

export function set(items: readonly Value[]): SetV {
  const sorted = [...items].sort(compare);
  const out: Value[] = [];
  for (const x of sorted) if (!out.length || compare(out[out.length - 1]!, x) !== 0) out.push(x);
  return { t: 'set', items: out };
}

export function mset(items: readonly Value[]): MsetV {
  const sorted = [...items].sort(compare);
  const out: [Value, number][] = [];
  for (const x of sorted) {
    const last = out[out.length - 1];
    if (last && compare(last[0], x) === 0) last[1]++;
    else out.push([x, 1]);
  }
  return { t: 'mset', items: out };
}

export function rel(arity: number, tuples: readonly (readonly Value[])[]): RelV {
  const sorted = [...tuples].sort(compareLists);
  const out: (readonly Value[])[] = [];
  for (const t of sorted) if (!out.length || compareLists(out[out.length - 1]!, t) !== 0) out.push(t);
  return { t: 'rel', arity, tuples: out };
}

export function funcConst(def: Value): FuncV {
  return { t: 'func', def, entries: [] };
}

export function funcGet(f: FuncV | MapV, arg: Value): Value | undefined {
  const es = f.t === 'func' ? f.entries : f.entries;
  let lo = 0;
  let hi = es.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = compare(es[mid]![0], arg);
    if (c === 0) return es[mid]![1];
    if (c < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return f.t === 'func' ? f.def : undefined;
}

export function funcSet<F extends FuncV | MapV>(f: F, arg: Value, v: Value): F {
  const es = [...f.entries];
  const i = es.findIndex((e) => compare(e[0], arg) >= 0);
  const isDefault = f.t === 'func' && equal(v, f.def);
  if (i >= 0 && compare(es[i]![0], arg) === 0) {
    if (isDefault) es.splice(i, 1);
    else es[i] = [arg, v];
  } else if (!isDefault) es.splice(i < 0 ? es.length : i, 0, [arg, v]);
  return { ...f, entries: es };
}

/** Every value of a finite type, in a fixed order (for exploring states, action parameters and quantifiers). */
export function enumerate(t: Ty): Value[] | undefined {
  const n = finiteSize(t, 200_000);
  if (n === undefined) return undefined;
  switch (t.k) {
    case 'bool':
      return [false, true];
    case 'range': {
      const out: Value[] = [];
      for (let i = t.lo; i < t.hi; i++) out.push(i);
      return out;
    }
    case 'mach': {
      const out: Value[] = [];
      const lo = t.signed ? -(1n << BigInt(t.bits - 1)) : 0n;
      for (let i = 0n; i < 1n << BigInt(t.bits); i++) out.push(lo + i);
      return out;
    }
    case 'bv': {
      const out: Value[] = [];
      for (let i = 0n; i < 1n << BigInt(t.bits); i++) out.push(i);
      return out;
    }
    case 'enum':
      return t.variants.flatMap((v, tag) => {
        const parts = v.fields.map((f) => enumerate(f.ty)!);
        return product(parts).map((fields) => ({ t: 'enum' as const, name: t.name, tag, variant: v.name, fields }));
      });
    case 'atom':
      return Array.from({ length: t.size ?? 0 }, (_, i) => ({ t: 'atom' as const, type: t.name, i }));
    case 'struct':
      return product(t.fields.map((f) => enumerate(f.ty)!)).map((fields) => ({ t: 'struct' as const, name: t.name, fields }));
    case 'tuple':
      return product(t.elems.map((e) => enumerate(e)!)).map((items) => ({ t: 'tuple' as const, items }));
    case 'func': {
      const dom = domainOf(t.params);
      const cod = enumerate(t.result)!;
      if (!dom) return undefined;
      return product(dom.map(() => cod)).map((vals) => {
        let f: FuncV = funcConst(cod[0]!);
        dom.forEach((d, i) => (f = funcSet(f, d, vals[i]!)));
        return f;
      });
    }
    default:
      return undefined;
  }
}

/** The argument values of a function type: single values, or tuples for several parameters. */
export function domainOf(params: Ty[]): Value[] | undefined {
  const parts = params.map((p) => enumerate(p));
  if (parts.some((p) => !p)) return undefined;
  if (parts.length === 1) return parts[0]!;
  return product(parts as Value[][]).map((items) => ({ t: 'tuple' as const, items }));
}

export function product(parts: Value[][]): Value[][] {
  let out: Value[][] = [[]];
  for (const p of parts) {
    const next: Value[][] = [];
    for (const prefix of out) for (const x of p) next.push([...prefix, x]);
    out = next;
  }
  return out;
}

/** The default value of a type (used for uninitialised state and fresh objects). */
export function defaultValue(t: Ty): Value {
  switch (t.k) {
    case 'bool':
      return false;
    case 'range':
      return t.lo;
    case 'int':
    case 'nat':
    case 'mach':
    case 'bv':
      return 0n;
    case 'seq':
      return seq([]);
    case 'set':
      return set([]);
    case 'multiset':
      return mset([]);
    case 'map':
      return { t: 'map', entries: [] };
    case 'func':
      return funcConst(defaultValue(t.result));
    case 'struct':
      return { t: 'struct', name: t.name, fields: t.fields.map((f) => defaultValue(f.ty)) };
    case 'enum':
      return { t: 'enum', name: t.name, tag: 0, variant: t.variants[0]?.name ?? '?', fields: (t.variants[0]?.fields ?? []).map((f) => defaultValue(f.ty)) };
    case 'tuple':
      return { t: 'tuple', items: t.elems.map(defaultValue) };
    case 'atom':
      return { t: 'atom', type: t.name, i: 0 };
    case 'ref':
      return null;
    case 'rel':
      return rel(t.cols.length, []);
    default:
      return null;
  }
}
