// Soundness, observed in finite structures (section "Soundness" of the natural deduction
// appendix).
//
// The soundness theorem says: if A is derivable from the undischarged assumptions Γ, then
// Γ ⊨ A. Every step of a derivation is the conclusion of a sub-derivation, so the theorem
// applies to every step: in every structure M, if M satisfies the step's undischarged
// assumptions, M satisfies the step's sentence. This module evaluates that claim, step by step,
// in a given finite structure, and searches all structures over a small domain for a step where
// it fails. For a derivation the checker accepts, no such step exists (that is the theorem);
// for an incorrect one, the search may find a structure that shows where it goes wrong.
//
// Checking finitely many finite structures does not prove soundness, nor that Γ ⊨ A for a
// particular derivation: entailment quantifies over all structures, of every size.
//
// Formula letters (ndlang.ts) are interpreted like predicate symbols: an n-place letter by an
// n-place relation, a sentence letter by a truth value (as a 0-place predicate would be).

import * as Ast from '../syntax/ast.ts';
import type { Formula } from '../syntax/ast.ts';
import { makeStructure, tupleKey, tuples, type Elem, type Structure } from '../semantics/structure.ts';
import { trueIn } from '../semantics/satisfaction.ts';
import type { Truth } from '../semantics/trace.ts';
import { linearize, type CheckResult, type Deriv } from './nd.ts';
import { predName } from '../syntax/language.ts';

/** Official predicate indices used for the formula letters A, B, C, D (so they cannot clash with P, Q, R, S). */
export const LETTER_BASE = 30;
const LETTER_NAMES = ['A', 'B', 'C', 'D'];

export interface Sym {
  /** 'A'…'D' for a letter, 'P'… for a generic predicate, '<' etc. */
  name: string;
  arity: number;
  /** official predicate index (letters: LETTER_BASE + position) */
  index: number;
  letter: boolean;
}

export interface Signature {
  preds: Sym[];
  /** constant indices (0 is the constant 0) */
  constants: number[];
  /** symbols this model checker does not interpret (function symbols, named formulas) */
  unsupported: string[];
}

const symId = (s: { arity: number; index: number }) => `${s.arity}/${s.index}`;

export function signatureOf(fs: Formula[]): Signature {
  const preds = new Map<string, Sym>();
  const consts = new Set<number>();
  const unsupported = new Set<string>();
  for (const f of fs) {
    Ast.walk(f, (x) => {
      if (x.k === 'const') consts.add(x.index);
      else if (x.k === 'numeral') unsupported.add('numerals');
      else if (x.k === 'app') unsupported.add('function symbols');
      else if (x.k === 'pred') preds.set(symId(x), { name: predName(x.arity, x.index), arity: x.arity, index: x.index, letter: false });
      else if (x.k === 'abbr') {
        const k = LETTER_NAMES.indexOf(x.name);
        if (k < 0 || x.tex !== x.name) unsupported.add(`the named formula ${x.name}`);
        else {
          const s = { name: x.name, arity: x.args.length, index: LETTER_BASE + k, letter: true };
          preds.set(symId(s), s);
        }
      }
    });
  }
  return {
    preds: [...preds.values()].sort((a, b) => a.name.localeCompare(b.name) || a.arity - b.arity),
    constants: [...consts].sort((a, b) => a - b),
    unsupported: [...unsupported],
  };
}

/** A finite structure for the signature: domain {0, …, n−1}. */
export interface Model {
  size: number;
  constants: Map<number, number>;
  /** symId ↦ the set of tupleKeys in the relation; for a sentence letter, {'[]'} means true */
  rels: Map<string, Set<string>>;
}

export function emptyModel(sig: Signature, size: number): Model {
  return { size, constants: new Map(sig.constants.map((c) => [c, 0])), rels: new Map(sig.preds.map((p) => [symId(p), new Set<string>()])) };
}

export const relKey = symId;

/** Formula letters to predicates; sentence letters to ⊥ or ⊤ according to the model. */
export function translate(f: Formula, m: Model): Formula {
  const go = (x: Formula): Formula => {
    switch (x.k) {
      case 'abbr': {
        const k = LETTER_NAMES.indexOf(x.name);
        if (k < 0 || x.tex !== x.name) return x;
        if (x.args.length === 0) return m.rels.get(`0/${LETTER_BASE + k}`)?.has('[]') ? Ast.top() : Ast.bot();
        return { k: 'pred', id: x.id, arity: x.args.length, index: LETTER_BASE + k, args: x.args };
      }
      case 'not':
        return { ...x, a: go(x.a) };
      case 'and':
      case 'or':
      case 'imp':
      case 'iff':
        return { ...x, a: go(x.a), b: go(x.b) };
      case 'forall':
      case 'exists':
        return { ...x, body: go(x.body) };
      default:
        return x;
    }
  };
  return go(f);
}

export function structureOf(sig: Signature, m: Model): Structure {
  const domain: Elem[] = Array.from({ length: m.size }, (_, i) => i);
  const constants: Record<number, Elem> = {};
  for (const c of sig.constants) constants[c] = Math.min(m.constants.get(c) ?? 0, m.size - 1);
  const relations = sig.preds
    .filter((p) => p.arity > 0)
    .map((p) => ({
      arity: p.arity,
      index: p.index,
      def: { tuples: tuples(domain, p.arity).filter((t) => m.rels.get(symId(p))?.has(tupleKey(t))) },
    }));
  return makeStructure({ name: 'M', domain, constants, relations });
}

export function truthIn(M: Structure, m: Model, f: Formula): Truth {
  return trueIn(M, translate(f, m), { trace: false }).truth;
}

export type StepStatus = 'preserved' | 'vacuous' | 'violated' | 'unknown';

export interface StepVerdict {
  id: string;
  /** truth of each undischarged assumption the step depends on */
  open: { id: string; formula: Formula; truth: Truth }[];
  concl: Truth;
  /**
   * preserved: M satisfies the assumptions and the sentence; vacuous: some assumption is false
   * in M (so the step claims nothing about M); violated: the assumptions hold and the sentence
   * does not — the step is not a consequence of its assumptions.
   */
  status: StepStatus;
}

export function stepVerdicts(root: Deriv, c: CheckResult, sig: Signature, m: Model): StepVerdict[] {
  const M = structureOf(sig, m);
  const memo = new Map<string, Truth>();
  const t = (f: Formula, key: string) => {
    let v = memo.get(key);
    if (v === undefined) memo.set(key, (v = truthIn(M, m, f)));
    return v;
  };
  return linearize(root).map((d) => {
    const st = c.steps.get(d.id);
    const open = (st?.open ?? []).map((o) => ({ id: o.id, formula: o.formula, truth: t(o.formula, `leaf:${o.id}`) }));
    const concl = t(d.concl, `step:${d.id}`);
    let status: StepStatus;
    if (open.some((o) => o.truth === false)) status = 'vacuous';
    else if (concl === 'unknown' || open.some((o) => o.truth === 'unknown')) status = 'unknown';
    else status = concl ? 'preserved' : 'violated';
    return { id: d.id, open, concl, status };
  });
}

/** The number of structures with domain {0, …, n−1} for the signature. */
export function modelCount(sig: Signature, n: number): number {
  let count = n ** sig.constants.length;
  for (const p of sig.preds) count *= 2 ** n ** p.arity;
  return count;
}

export const SEARCH_CAP = 4096;

/** Every model over {0, …, n−1}, in a fixed order (only when there are at most SEARCH_CAP). */
export function* allModels(sig: Signature, n: number): Generator<Model> {
  const cs = sig.constants;
  const ps = sig.preds.map((p) => ({ p, keys: tuples(Array.from({ length: n }, (_, i) => i), p.arity).map(tupleKey) }));
  const cChoices = n ** cs.length;
  const rChoices = ps.map(({ keys }) => 2 ** keys.length);
  for (let ci = 0; ci < cChoices; ci++) {
    const constants = new Map<number, number>();
    let x = ci;
    for (const c of cs) {
      constants.set(c, x % n);
      x = Math.floor(x / n);
    }
    const idx = rChoices.map(() => 0);
    for (;;) {
      const rels = new Map<string, Set<string>>();
      ps.forEach(({ p, keys }, i) => rels.set(symId(p), new Set(keys.filter((_, j) => (idx[i] >> j) & 1))));
      yield { size: n, constants, rels };
      let i = 0;
      while (i < idx.length) {
        idx[i]++;
        if (idx[i] < rChoices[i]) break;
        idx[i] = 0;
        i++;
      }
      if (i === idx.length) break;
    }
  }
}

export interface Search {
  size: number;
  total: number;
  /** false: more than SEARCH_CAP structures, nothing searched */
  searched: boolean;
  /** Structures in which some step is violated (the first one found, and the step). */
  counterexample?: { model: Model; stepId: string; rootViolated: boolean };
  /** How many structures made the root's assumptions all true. */
  rootApplicable: number;
}

/** Searches all structures over {0, …, n−1} for one in which some step's claim fails. */
export function search(root: Deriv, c: CheckResult, sig: Signature, n: number): Search {
  const total = modelCount(sig, n);
  if (total > SEARCH_CAP || sig.unsupported.length) return { size: n, total, searched: false, rootApplicable: 0 };
  let rootApplicable = 0;
  for (const m of allModels(sig, n)) {
    const v = stepVerdicts(root, c, sig, m);
    const r = v[v.length - 1];
    if (r.status === 'preserved' || r.status === 'violated') rootApplicable++;
    const bad = v.find((x) => x.status === 'violated');
    if (bad) return { size: n, total, searched: true, counterexample: { model: m, stepId: bad.id, rootViolated: r.status === 'violated' }, rootApplicable };
  }
  return { size: n, total, searched: true, rootApplicable };
}

/** Every sentence in a derivation (for the signature). */
export function sentencesOf(root: Deriv): Formula[] {
  return linearize(root).map((d) => d.concl);
}
