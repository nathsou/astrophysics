// Finite structures for first-order languages (section "Structures for First-order Languages").
//
// A structure M consists of a non-empty domain |M|, an element c^M for each constant symbol, a
// relation R^M ⊆ |M|^n for each n-place predicate symbol (other than =, which is logical) and a
// total function f^M : |M|^n → |M| for each n-place function symbol. Here the domain is finite
// (so that satisfaction can be computed by running through it) and its elements are labels:
// numbers or strings. Symbols are the official symbols of language.ts: constants c_i, function
// symbols f^n_i and predicate symbols P^n_i; in the language of arithmetic L_A,
//
//   0 = c_0      ′ = f^1_0      + = f^2_0      × = f^2_1      < = P^2_0.

import { constName, fnName, GENERIC_OFFSET, predName } from '../syntax/language.ts';

/** An element of a finite domain: a number or a string label. */
export type Elem = number | string;

/** A key identifying a tuple of elements (distinguishes 1 from "1"). */
export function tupleKey(args: readonly Elem[]): string {
  return JSON.stringify(args);
}

export function showElem(e: Elem): string {
  return typeof e === 'number' ? String(e) : e;
}

export function showTuple(args: readonly Elem[]): string {
  return args.length === 1 ? showElem(args[0]) : `⟨${args.map(showElem).join(', ')}⟩`;
}

export const symKey = (arity: number, index: number) => `${arity}/${index}`;

export interface FnInterp {
  arity: number;
  index: number;
  /** tupleKey(args) ↦ value, for every args ∈ |M|^arity. */
  table: ReadonlyMap<string, Elem>;
}

export interface RelInterp {
  arity: number;
  index: number;
  /** tupleKey of each tuple in the relation. */
  tuples: ReadonlySet<string>;
}

export interface Structure {
  name: string;
  description?: string;
  domain: readonly Elem[];
  constants: ReadonlyMap<number, Elem>;
  /** Keyed by symKey(arity, index). */
  functions: ReadonlyMap<string, FnInterp>;
  /** Keyed by symKey(arity, index). */
  relations: ReadonlyMap<string, RelInterp>;
}

// ------------------------------------------------------------------ specifications

/**
 * How a function symbol is interpreted: by a JavaScript function, by explicit entries
 * [arguments, value], by `values` (one-place only: values[i] is f(domain[i])), or by `grid`
 * (two-place only: grid[i][j] is f(domain[i], domain[j])).
 */
export type FnDef =
  | ((...args: Elem[]) => Elem)
  | { entries: readonly (readonly [readonly Elem[], Elem])[] }
  | { values: readonly Elem[] }
  | { grid: readonly (readonly Elem[])[] };

/** How a predicate symbol is interpreted: by a test, or by the list of tuples in the relation. */
export type RelDef = ((...args: Elem[]) => boolean) | { tuples: readonly (readonly Elem[])[] };

export interface StructureSpec {
  name?: string;
  description?: string;
  domain: readonly Elem[];
  /** constant index ↦ element. */
  constants?: Readonly<Record<number, Elem>>;
  functions?: readonly { arity: number; index: number; def: FnDef }[];
  relations?: readonly { arity: number; index: number; def: RelDef }[];
}

/** Interpretations of the symbols of L_A (all optional, so that parts of L_A can be interpreted). */
export interface ArithmeticSpec {
  name?: string;
  description?: string;
  domain: readonly Elem[];
  /** 0^M */
  zero?: Elem;
  /** ′^M */
  succ?: FnDef;
  /** +^M */
  plus?: FnDef;
  /** ×^M */
  times?: FnDef;
  /** <^M */
  less?: RelDef;
  /** Further symbols. */
  constants?: Readonly<Record<number, Elem>>;
  functions?: StructureSpec['functions'];
  relations?: StructureSpec['relations'];
}

export class StructureError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super(`not a structure:\n  ${errors.join('\n  ')}`);
    this.errors = errors;
  }
}

/** Upper bound on |M|^n for a function table or relation (to keep things small). */
export const MAX_TABLE = 250_000;

const constLabel = (i: number) => `the constant ${constName(i)}${i === 0 || i > 4 ? '' : ` (c_${i})`}`;
const fnLabel = (n: number, i: number) => `the ${n}-place function symbol ${fnName(n, i)}${fnName(n, i).startsWith('f^') ? '' : ` (f^${n}_${i})`}`;
const relLabel = (n: number, i: number) => `the ${n}-place predicate symbol ${predName(n, i)}${predName(n, i).startsWith('P^') ? '' : ` (P^${n}_${i})`}`;

export function describeConst(index: number): string {
  return constLabel(index);
}
export function describeFn(arity: number, index: number): string {
  return fnLabel(arity, index);
}
export function describeRel(arity: number, index: number): string {
  return relLabel(arity, index);
}

/** All tuples of length n over the domain, in lexicographic order. */
export function tuples(domain: readonly Elem[], n: number): Elem[][] {
  let out: Elem[][] = [[]];
  for (let k = 0; k < n; k++) {
    const next: Elem[][] = [];
    for (const t of out) for (const d of domain) next.push([...t, d]);
    out = next;
  }
  return out;
}

/**
 * Checks a specification and builds the structure, or lists everything that is wrong with it:
 * an empty domain, repeated elements, values outside the domain, functions that are not total
 * or not functions (conflicting entries), tuples of the wrong length.
 */
export function validateStructure(spec: StructureSpec): { ok: true; structure: Structure } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const domain = [...spec.domain];
  if (domain.length === 0) errors.push('the domain must be non-empty');
  const inDomain = new Set(domain.map((d) => tupleKey([d])));
  const seen = new Set<string>();
  for (const d of domain) {
    if (typeof d !== 'number' && typeof d !== 'string') errors.push(`domain element ${String(d)} is neither a number nor a string`);
    else if (typeof d === 'number' && !Number.isFinite(d)) errors.push(`domain element ${d} is not a finite number`);
    const k = tupleKey([d]);
    if (seen.has(k)) errors.push(`the element ${showElem(d)} is listed twice in the domain`);
    seen.add(k);
  }
  const member = (e: unknown): e is Elem => (typeof e === 'number' || typeof e === 'string') && inDomain.has(tupleKey([e]));
  const domText = `{${domain.slice(0, 12).map(showElem).join(', ')}${domain.length > 12 ? ', …' : ''}}`;

  const constants = new Map<number, Elem>();
  for (const [k, e] of Object.entries(spec.constants ?? {})) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0) errors.push(`“${k}” is not a constant index`);
    else if (!member(e)) errors.push(`${constLabel(i)} is interpreted as ${String(e)}, which is not in the domain ${domText}`);
    else constants.set(i, e);
  }

  const functions = new Map<string, FnInterp>();
  for (const f of spec.functions ?? []) {
    const label = fnLabel(f.arity, f.index);
    if (!Number.isInteger(f.arity) || f.arity < 1) {
      errors.push(`${label}: arity must be a positive integer`);
      continue;
    }
    if (functions.has(symKey(f.arity, f.index))) {
      errors.push(`${label} is interpreted twice`);
      continue;
    }
    if (domain.length ** f.arity > MAX_TABLE) {
      errors.push(`${label}: its table would have ${domain.length}^${f.arity} entries (at most ${MAX_TABLE} are allowed)`);
      continue;
    }
    const table = new Map<string, Elem>();
    const def = f.def;
    const errs: string[] = [];
    if (typeof def === 'function') {
      for (const args of tuples(domain, f.arity)) {
        let val: unknown;
        try {
          val = def(...args);
        } catch (e) {
          errs.push(`${label}: computing its value at ${showTuple(args)} failed (${e instanceof Error ? e.message : String(e)})`);
          continue;
        }
        if (!member(val)) errs.push(`${label} maps ${showTuple(args)} to ${String(val)}, which is not in the domain ${domText}`);
        else table.set(tupleKey(args), val);
      }
    } else {
      let entries: (readonly [readonly Elem[], Elem])[] = [];
      if ('entries' in def) entries = [...def.entries];
      else if ('values' in def) {
        if (f.arity !== 1) errs.push(`${label}: a list of values can only interpret a 1-place function symbol`);
        else if (def.values.length !== domain.length) errs.push(`${label}: expected ${domain.length} values (one for each element of the domain), got ${def.values.length}`);
        else entries = domain.map((d, i) => [[d], def.values[i]] as const);
      } else {
        if (f.arity !== 2) errs.push(`${label}: a grid can only interpret a 2-place function symbol`);
        else if (def.grid.length !== domain.length || def.grid.some((row) => row.length !== domain.length)) errs.push(`${label}: the grid must be ${domain.length} × ${domain.length} (rows and columns in domain order)`);
        else entries = domain.flatMap((a, i) => domain.map((b, j) => [[a, b], def.grid[i][j]] as const));
      }
      for (const [args, val] of entries) {
        if (args.length !== f.arity) {
          errs.push(`${label}: the entry for ${showTuple(args)} has ${args.length} argument${args.length === 1 ? '' : 's'}, not ${f.arity}`);
          continue;
        }
        const bad = args.find((a) => !member(a));
        if (bad !== undefined) {
          errs.push(`${label}: the argument ${String(bad)} in ${showTuple(args)} is not in the domain ${domText}`);
          continue;
        }
        if (!member(val)) {
          errs.push(`${label} maps ${showTuple(args)} to ${String(val)}, which is not in the domain ${domText}`);
          continue;
        }
        const key = tupleKey(args);
        const old = table.get(key);
        if (old !== undefined && old !== val) errs.push(`${label} is not a function: ${showTuple(args)} is mapped both to ${showElem(old)} and to ${showElem(val)}`);
        else table.set(key, val);
      }
      if (errs.length === 0) {
        const missing = tuples(domain, f.arity).filter((args) => !table.has(tupleKey(args)));
        if (missing.length > 0) {
          errs.push(`${label} is not total: no value for ${missing.slice(0, 5).map(showTuple).join(', ')}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}`);
        }
      }
    }
    if (errs.length > 0) errors.push(...errs.slice(0, 8), ...(errs.length > 8 ? [`${label}: … and ${errs.length - 8} more problems`] : []));
    else functions.set(symKey(f.arity, f.index), { arity: f.arity, index: f.index, table });
  }

  const relations = new Map<string, RelInterp>();
  for (const r of spec.relations ?? []) {
    const label = relLabel(r.arity, r.index);
    if (!Number.isInteger(r.arity) || r.arity < 1) {
      errors.push(`${label}: arity must be a positive integer`);
      continue;
    }
    if (relations.has(symKey(r.arity, r.index))) {
      errors.push(`${label} is interpreted twice`);
      continue;
    }
    if (domain.length ** r.arity > MAX_TABLE) {
      errors.push(`${label}: |M|^${r.arity} has ${domain.length}^${r.arity} tuples (at most ${MAX_TABLE} are allowed)`);
      continue;
    }
    const set = new Set<string>();
    const def = r.def;
    const errs: string[] = [];
    if (typeof def === 'function') {
      for (const args of tuples(domain, r.arity)) {
        try {
          if (def(...args)) set.add(tupleKey(args));
        } catch (e) {
          errs.push(`${label}: testing ${showTuple(args)} failed (${e instanceof Error ? e.message : String(e)})`);
        }
      }
    } else {
      for (const t of def.tuples) {
        if (t.length !== r.arity) errs.push(`${label}: the tuple ${showTuple(t)} has length ${t.length}, not ${r.arity}`);
        else {
          const bad = t.find((a) => !member(a));
          if (bad !== undefined) errs.push(`${label}: the tuple ${showTuple(t)} contains ${String(bad)}, which is not in the domain ${domText}`);
          else set.add(tupleKey(t));
        }
      }
    }
    if (errs.length > 0) errors.push(...errs.slice(0, 8));
    else relations.set(symKey(r.arity, r.index), { arity: r.arity, index: r.index, tuples: set });
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    structure: {
      name: spec.name ?? 'M',
      ...(spec.description !== undefined ? { description: spec.description } : {}),
      domain,
      constants,
      functions,
      relations,
    },
  };
}

/** Builds a structure from a specification; throws a StructureError listing the problems. */
export function makeStructure(spec: StructureSpec): Structure {
  const r = validateStructure(spec);
  if (!r.ok) throw new StructureError(r.errors);
  return r.structure;
}

function arithmeticToSpec(spec: ArithmeticSpec): StructureSpec {
  const constants: Record<number, Elem> = { ...(spec.constants ?? {}) };
  if (spec.zero !== undefined) constants[0] = spec.zero;
  const functions = [...(spec.functions ?? [])];
  if (spec.succ !== undefined) functions.push({ arity: 1, index: 0, def: spec.succ });
  if (spec.plus !== undefined) functions.push({ arity: 2, index: 0, def: spec.plus });
  if (spec.times !== undefined) functions.push({ arity: 2, index: 1, def: spec.times });
  const relations = [...(spec.relations ?? [])];
  if (spec.less !== undefined) relations.push({ arity: 2, index: 0, def: spec.less });
  return {
    domain: spec.domain,
    ...(spec.name !== undefined ? { name: spec.name } : {}),
    ...(spec.description !== undefined ? { description: spec.description } : {}),
    constants,
    functions,
    relations,
  };
}

/** A structure for (part of) the language of arithmetic L_A, from tables or functions. */
export function arithmeticStructure(spec: ArithmeticSpec): Structure {
  return makeStructure(arithmeticToSpec(spec));
}

export function validateArithmeticStructure(spec: ArithmeticSpec) {
  return validateStructure(arithmeticToSpec(spec));
}

export type ModMode = 'wrap' | 'saturate';

/**
 * Finite "arithmetic" on {0, …, n−1}, with < the usual order of these numbers.
 *
 * - `wrap` (default): arithmetic mod n — x′ = x+1 mod n, x + y and x × y mod n. Successor is a
 *   bijection (so Q1 holds), and (n−1)′ = 0, so 0 is a successor: Q2 fails.
 * - `saturate`: arithmetic cut off at n−1 — x′ = min(x+1, n−1), x + y = min(x+y, n−1),
 *   x × y = min(xy, n−1). Now 0 is not a successor (Q2 holds when n ≥ 2), but (n−2)′ = (n−1)′:
 *   Q1 fails.
 */
export function modArithmetic(n: number, mode: ModMode = 'wrap'): Structure {
  if (!Number.isInteger(n) || n < 1) throw new StructureError([`the domain {0, …, n−1} needs a positive integer n, not ${n}`]);
  const domain = Array.from({ length: n }, (_, i) => i);
  const cut = (x: number) => (mode === 'wrap' ? x % n : Math.min(x, n - 1));
  const num = (e: Elem) => e as number;
  return arithmeticStructure({
    name: mode === 'wrap' ? `ℤ_${n}` : `ℕ_{≤${n - 1}}`,
    description:
      mode === 'wrap'
        ? `The numbers 0, …, ${n - 1} with successor, addition and multiplication mod ${n}, and the usual order <.`
        : `The numbers 0, …, ${n - 1} with successor, addition and multiplication cut off at ${n - 1} (x′ = min(x+1, ${n - 1}), etc.), and the usual order <.`,
    domain,
    zero: 0,
    succ: (x) => cut(num(x) + 1),
    plus: (x, y) => cut(num(x) + num(y)),
    times: (x, y) => cut(num(x) * num(y)),
    less: (x, y) => num(x) < num(y),
  });
}

/** A structure with no non-logical symbols interpreted (for pure first- and second-order logic). */
export function pureStructure(domain: readonly Elem[], name = 'M'): Structure {
  return makeStructure({ name, domain });
}

/** The generic predicate letters P, Q, R, S (and function letters f, g, h) as official symbols. */
export const GENERIC = {
  P: (arity: number) => ({ arity, index: GENERIC_OFFSET }),
  Q: (arity: number) => ({ arity, index: GENERIC_OFFSET + 1 }),
  R: (arity: number) => ({ arity, index: GENERIC_OFFSET + 2 }),
  S: (arity: number) => ({ arity, index: GENERIC_OFFSET + 3 }),
  f: (arity: number) => ({ arity, index: GENERIC_OFFSET }),
  g: (arity: number) => ({ arity, index: GENERIC_OFFSET + 1 }),
  h: (arity: number) => ({ arity, index: GENERIC_OFFSET + 2 }),
};

// ------------------------------------------------------------------ lookups

export function lookupConst(M: Structure, index: number): Elem | { fail: string } {
  const e = M.constants.get(index);
  return e === undefined ? { fail: `${M.name} does not interpret ${constLabel(index)}` } : e;
}

export function applyFn(M: Structure, arity: number, index: number, args: readonly Elem[]): Elem | { fail: string } {
  const f = M.functions.get(symKey(arity, index));
  if (!f) return { fail: `${M.name} does not interpret ${fnLabel(arity, index)}` };
  const v = f.table.get(tupleKey(args));
  return v === undefined ? { fail: `${fnLabel(arity, index)} has no value at ${showTuple(args)} in ${M.name}` } : v;
}

export function holdsRel(M: Structure, arity: number, index: number, args: readonly Elem[]): boolean | { fail: string } {
  const r = M.relations.get(symKey(arity, index));
  if (!r) return { fail: `${M.name} does not interpret ${relLabel(arity, index)}` };
  return r.tuples.has(tupleKey(args));
}

/** The sequence 0^M, (0^M)′, (0^M)′′, … up to its first repetition, with the index where the cycle starts. */
export function successorOrbit(M: Structure): { orbit: Elem[]; cycleStart: number } | { fail: string } {
  const z = lookupConst(M, 0);
  if (typeof z === 'object') return z;
  const orbit: Elem[] = [z];
  const pos = new Map<string, number>([[tupleKey([z]), 0]]);
  for (;;) {
    const next = applyFn(M, 1, 0, [orbit[orbit.length - 1]]);
    if (typeof next === 'object') return next;
    const p = pos.get(tupleKey([next]));
    if (p !== undefined) return { orbit, cycleStart: p };
    pos.set(tupleKey([next]), orbit.length);
    orbit.push(next);
  }
}

/** The value of the numeral n̄ = 0′…′ (n primes) in M, for any n (using that the orbit of 0 is eventually periodic). */
export function numeralIn(M: Structure, n: bigint): Elem | { fail: string } {
  const o = successorOrbit(M);
  if ('fail' in o) return { fail: `numerals need 0 and ′: ${o.fail}` };
  const { orbit, cycleStart } = o;
  if (n < BigInt(orbit.length)) return orbit[Number(n)];
  const period = BigInt(orbit.length - cycleStart);
  return orbit[cycleStart + Number((n - BigInt(cycleStart)) % period)];
}
