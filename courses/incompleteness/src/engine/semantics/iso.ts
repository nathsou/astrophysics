// Isomorphisms, reducts and expansions of finite structures (chapter "Models of Arithmetic",
// sections "Reducts and Expansions" and "Isomorphic Structures").
//
// h : |M| → |M′| is an isomorphism iff (1) h is injective, (2) h is surjective, (3) h(c^M) = c^{M′}
// for every constant c, (4) ⟨a₁, …, aₙ⟩ ∈ P^M iff ⟨h(a₁), …, h(aₙ)⟩ ∈ P^{M′} for every predicate
// symbol P, and (5) h(f^M(a₁, …, aₙ)) = f^{M′}(h(a₁), …, h(aₙ)) for every function symbol f.
// For finite structures an isomorphism can be searched for among all bijections.

import { constName, fnName, predName } from '../syntax/language.ts';
import {
  applyFn, holdsRel, makeStructure, showElem, showTuple, symKey, tupleKey, tuples, type Elem, type FnInterp, type RelInterp, type Structure,
} from './structure.ts';

export interface Signature {
  constants: number[];
  functions: { arity: number; index: number }[];
  relations: { arity: number; index: number }[];
}

export function signature(M: Structure): Signature {
  const byKey = <T extends { arity: number; index: number }>(xs: Iterable<T>) => [...xs].map(({ arity, index }) => ({ arity, index })).sort((a, b) => a.arity - b.arity || a.index - b.index);
  return { constants: [...M.constants.keys()].sort((a, b) => a - b), functions: byKey(M.functions.values()), relations: byKey(M.relations.values()) };
}

export function sameSignature(a: Signature, b: Signature): boolean {
  const k = (s: Signature) => JSON.stringify(s);
  return k(a) === k(b);
}

export interface IsoViolation {
  /** Which clause of the definition fails: 1 injective, 2 surjective, 3 constants, 4 predicates, 5 functions. */
  clause: 1 | 2 | 3 | 4 | 5;
  detail: string;
}

/** Checks the five conditions of the definition for a given map h (as a Map from |M| to |M′|). */
export function checkIsomorphism(M: Structure, N: Structure, h: ReadonlyMap<Elem, Elem>): IsoViolation[] {
  const out: IsoViolation[] = [];
  const H = (e: Elem) => h.get(e)!;
  const missing = M.domain.filter((e) => !h.has(e));
  if (missing.length) return [{ clause: 1, detail: `h is not defined on ${missing.map(showElem).join(', ')}` }];
  const img = new Map<string, Elem>();
  for (const e of M.domain) {
    const k = tupleKey([H(e)]);
    if (img.has(k)) out.push({ clause: 1, detail: `h is not injective: h(${showElem(img.get(k)!)}) = h(${showElem(e)}) = ${showElem(H(e))}` });
    img.set(k, e);
  }
  const notHit = N.domain.filter((e) => !img.has(tupleKey([e])));
  if (notHit.length) out.push({ clause: 2, detail: `h is not surjective: nothing is mapped to ${notHit.map(showElem).join(', ')}` });
  const sM = signature(M);
  if (!sameSignature(sM, signature(N))) out.push({ clause: 3, detail: 'the structures do not interpret the same symbols' });
  for (const c of sM.constants) {
    const a = M.constants.get(c)!;
    const b = N.constants.get(c);
    if (b !== undefined && H(a) !== b) out.push({ clause: 3, detail: `h(${constName(c)}^${M.name}) = h(${showElem(a)}) = ${showElem(H(a))}, but ${constName(c)}^${N.name} = ${showElem(b)}` });
  }
  for (const { arity, index } of sM.relations) {
    if (!N.relations.has(symKey(arity, index))) continue;
    for (const args of tuples(M.domain, arity)) {
      const r1 = holdsRel(M, arity, index, args) === true;
      const r2 = holdsRel(N, arity, index, args.map(H)) === true;
      if (r1 !== r2) {
        out.push({ clause: 4, detail: `${showTuple(args)} ${r1 ? '∈' : '∉'} ${predName(arity, index)}^${M.name}, but ${showTuple(args.map(H))} ${r2 ? '∈' : '∉'} ${predName(arity, index)}^${N.name}` });
        break;
      }
    }
  }
  for (const { arity, index } of sM.functions) {
    if (!N.functions.has(symKey(arity, index))) continue;
    for (const args of tuples(M.domain, arity)) {
      const v1 = applyFn(M, arity, index, args) as Elem;
      const v2 = applyFn(N, arity, index, args.map(H)) as Elem;
      if (H(v1) !== v2) {
        const f = fnName(arity, index);
        out.push({ clause: 5, detail: `h(${f}^${M.name}(${args.map(showElem).join(', ')})) = h(${showElem(v1)}) = ${showElem(H(v1))}, but ${f}^${N.name}(${args.map(H).map(showElem).join(', ')}) = ${showElem(v2)}` });
        break;
      }
    }
  }
  return out;
}

export type IsoResult =
  | { ok: true; h: Map<Elem, Elem>; tried: number }
  | { ok: false; reason: string; tried: number };

/** The largest domain for which isomorphisms are searched (8! = 40,320 bijections at most). */
export const MAX_ISO_DOMAIN = 8;

/**
 * Searches for an isomorphism from M to N, trying bijections in order and abandoning a partial
 * map as soon as a condition fails on the elements already mapped.
 */
export function findIsomorphism(M: Structure, N: Structure, opts: { all?: boolean } = {}): IsoResult & { all?: Map<Elem, Elem>[] } {
  if (M.domain.length !== N.domain.length) return { ok: false, reason: `|${M.name}| has ${M.domain.length} elements and |${N.name}| has ${N.domain.length}: there is no bijection between them`, tried: 0 };
  if (!sameSignature(signature(M), signature(N))) return { ok: false, reason: 'the structures do not interpret the same symbols, so they are not structures for the same language', tried: 0 };
  if (M.domain.length > MAX_ISO_DOMAIN) return { ok: false, reason: `the search is limited to domains of at most ${MAX_ISO_DOMAIN} elements`, tried: 0 };
  const sig = signature(M);
  const D = M.domain;
  const h = new Map<Elem, Elem>();
  const used = new Set<string>();
  let tried = 0;
  const found: Map<Elem, Elem>[] = [];
  const pos = new Map(D.map((e, i) => [tupleKey([e]), i]));
  // Is the partial map h (defined on D[0..k]) consistent with conditions (3)–(5) so far?
  const consistent = (k: number): boolean => {
    const known = (e: Elem) => (pos.get(tupleKey([e])) ?? Infinity) <= k;
    for (const c of sig.constants) {
      const a = M.constants.get(c)!;
      if (known(a) && h.get(a) !== N.constants.get(c)) return false;
    }
    const newest = D[k];
    for (const { arity, index } of sig.relations) {
      for (const args of tuples(D.slice(0, k + 1), arity)) {
        if (!args.includes(newest)) continue;
        if ((holdsRel(M, arity, index, args) === true) !== (holdsRel(N, arity, index, args.map((a) => h.get(a)!)) === true)) return false;
      }
    }
    for (const { arity, index } of sig.functions) {
      for (const args of tuples(D.slice(0, k + 1), arity)) {
        const v = applyFn(M, arity, index, args) as Elem;
        const w = applyFn(N, arity, index, args.map((a) => h.get(a)!)) as Elem;
        if (known(v) && h.get(v) !== w) return false;
      }
    }
    return true;
  };
  const go = (k: number): boolean => {
    if (k === D.length) {
      found.push(new Map(h));
      return !opts.all;
    }
    for (const t of N.domain) {
      const key = tupleKey([t]);
      if (used.has(key)) continue;
      tried++;
      h.set(D[k], t);
      used.add(key);
      if (consistent(k) && go(k + 1)) return true;
      used.delete(key);
      h.delete(D[k]);
    }
    return false;
  };
  go(0);
  if (found.length === 0) return { ok: false, reason: `none of the bijections from |${M.name}| to |${N.name}| satisfies conditions (3)–(5)`, tried };
  return { ok: true, h: found[0], tried, ...(opts.all ? { all: found } : {}) };
}

/** The automorphisms of M (isomorphisms of M onto itself). */
export function automorphisms(M: Structure): Map<Elem, Elem>[] {
  const r = findIsomorphism(M, M, { all: true });
  return r.all ?? [];
}

/** A copy of M with every element e renamed h(e) (h a bijection): an isomorphic structure. */
export function relabel(M: Structure, h: (e: Elem) => Elem, name = `${M.name}′`): Structure {
  const H = (e: Elem) => h(e);
  const constants: Record<number, Elem> = {};
  for (const [c, e] of M.constants) constants[c] = H(e);
  return makeStructure({
    name,
    domain: M.domain.map(H),
    constants,
    functions: [...M.functions.values()].map((f) => ({
      arity: f.arity,
      index: f.index,
      def: { entries: tuples(M.domain, f.arity).map((args) => [args.map(H), H(f.table.get(tupleKey(args))!)] as const) },
    })),
    relations: [...M.relations.values()].map((r) => ({ arity: r.arity, index: r.index, def: { tuples: tuples(M.domain, r.arity).filter((args) => r.tuples.has(tupleKey(args))).map((args) => args.map(H)) } })),
  });
}

/**
 * The reduct of M to the symbols listed in `keep` ("forgetting" the others): same domain, same
 * interpretations of the kept symbols.
 */
export function reduct(M: Structure, keep: { constants?: number[]; functions?: [number, number][]; relations?: [number, number][] }, name = `${M.name}↾`): Structure {
  const kc = new Set(keep.constants ?? []);
  const kf = new Set((keep.functions ?? []).map(([a, i]) => symKey(a, i)));
  const kr = new Set((keep.relations ?? []).map(([a, i]) => symKey(a, i)));
  return {
    name,
    domain: M.domain,
    constants: new Map([...M.constants].filter(([c]) => kc.has(c))),
    functions: new Map<string, FnInterp>([...M.functions].filter(([k]) => kf.has(k))),
    relations: new Map<string, RelInterp>([...M.relations].filter(([k]) => kr.has(k))),
  };
}

/** The expansion M^R of M by an n-place predicate symbol (arity, index) interpreted as R. */
export function expandWithRelation(M: Structure, arity: number, index: number, R: readonly (readonly Elem[])[], name = `${M.name}^R`): Structure {
  if (M.relations.has(symKey(arity, index))) throw new Error(`${M.name} already interprets ${predName(arity, index)}`);
  const checked = makeStructure({ domain: M.domain, relations: [{ arity, index, def: { tuples: R } }] });
  return { ...M, name, relations: new Map([...M.relations, ...checked.relations]) };
}
