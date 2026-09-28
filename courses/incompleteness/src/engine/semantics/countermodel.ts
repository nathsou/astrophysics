// Searching small structures (section "Semantic Notions").
//
// Γ ⊨ A iff every structure satisfying Γ satisfies A; A is valid iff it is satisfied in every
// structure; Γ is satisfiable iff some structure satisfies it. Checking all structures is
// impossible, but all structures with a small domain {0, …, n−1} for the symbols that occur can
// be enumerated. Finding a structure that satisfies Γ ∪ {¬A} *proves* Γ ⊭ A (it is a
// countermodel); finding none up to size n proves nothing about larger structures.

import * as A from '../syntax/ast.ts';
import type { Formula } from '../syntax/ast.ts';
import { freeVars } from '../syntax/ops.ts';
import { evalFormulaIn, makeCtx } from './trace.ts';
import { interpretation } from './satisfaction.ts';
import { symKey, tupleKey, tuples, type Elem, type FnInterp, type RelInterp, type Structure } from './structure.ts';
import type { Signature } from './iso.ts';

/** The non-logical symbols occurring in the formulas. */
export function signatureOf(fs: readonly Formula[]): Signature & { numerals: boolean; abbreviations: string[] } {
  const c = new Set<number>();
  const f = new Map<string, { arity: number; index: number }>();
  const r = new Map<string, { arity: number; index: number }>();
  const abbrs = new Set<string>();
  let numerals = false;
  for (const F of fs) {
    A.walk(F, (x) => {
      if (x.k === 'const') c.add(x.index);
      if (x.k === 'numeral') {
        numerals = true;
        c.add(0);
        f.set(symKey(1, 0), { arity: 1, index: 0 });
      }
      if (x.k === 'app') f.set(symKey(x.arity, x.index), { arity: x.arity, index: x.index });
      if (x.k === 'pred') r.set(symKey(x.arity, x.index), { arity: x.arity, index: x.index });
      if (x.k === 'abbr') abbrs.add(x.name);
    });
  }
  const sort = (xs: { arity: number; index: number }[]) => xs.sort((a, b) => a.arity - b.arity || a.index - b.index);
  return { constants: [...c].sort((a, b) => a - b), functions: sort([...f.values()]), relations: sort([...r.values()]), numerals, abbreviations: [...abbrs] };
}

/** How many structures with domain {0, …, n−1} the signature has. */
export function countStructures(sig: Signature, n: number): number {
  let count = n ** sig.constants.length;
  for (const f of sig.functions) count *= n ** n ** f.arity;
  for (const r of sig.relations) count *= 2 ** n ** r.arity;
  return count;
}

/** All structures for the signature with domain {0, …, n−1}, in a fixed order. */
export function* structuresOfSize(sig: Signature, n: number): Generator<Structure> {
  const domain = Array.from({ length: n }, (_, i) => i);
  // One "digit" per choice: constants (n values), function table entries (n values), relation tuples (2 values).
  const slots: { base: number; kind: 'c' | 'f' | 'r'; which: number; entry?: Elem[] }[] = [];
  sig.constants.forEach((_, i) => slots.push({ base: n, kind: 'c', which: i }));
  sig.functions.forEach((f, i) => tuples(domain, f.arity).forEach((args) => slots.push({ base: n, kind: 'f', which: i, entry: args })));
  sig.relations.forEach((r, i) => tuples(domain, r.arity).forEach((args) => slots.push({ base: 2, kind: 'r', which: i, entry: args })));
  const digits = slots.map(() => 0);
  for (;;) {
    const constants = new Map<number, Elem>();
    const fTables = sig.functions.map(() => new Map<string, Elem>());
    const rSets = sig.relations.map(() => new Set<string>());
    slots.forEach((s, i) => {
      if (s.kind === 'c') constants.set(sig.constants[s.which], digits[i]);
      else if (s.kind === 'f') fTables[s.which].set(tupleKey(s.entry!), digits[i]);
      else if (digits[i] === 1) rSets[s.which].add(tupleKey(s.entry!));
    });
    yield {
      name: 'M',
      domain,
      constants,
      functions: new Map<string, FnInterp>(sig.functions.map((f, i) => [symKey(f.arity, f.index), { ...f, table: fTables[i] }])),
      relations: new Map<string, RelInterp>(sig.relations.map((r, i) => [symKey(r.arity, r.index), { ...r, tuples: rSets[i] }])),
    };
    let i = 0;
    while (i < digits.length && ++digits[i] === slots[i].base) digits[i++] = 0;
    if (i === digits.length) return;
  }
}

export type ModelSearch =
  | { found: true; structure: Structure; size: number; searched: number }
  | { found: false; searched: number; sizes: number[]; stoppedAt?: { size: number; count: number }; reason?: string };

/**
 * Looks for a structure with domain {0, …, n−1}, n = 1 … maxSize, satisfying all the sentences.
 * Sizes whose number of structures exceeds `budget` (default 300,000 in total) are not tried.
 */
export function findModel(sentences: readonly Formula[], opts: { maxSize?: number; budget?: number } = {}): ModelSearch {
  const maxSize = opts.maxSize ?? 4;
  const budget = opts.budget ?? 300_000;
  const open = sentences.find((f) => freeVars(f).size > 0);
  if (open) return { found: false, searched: 0, sizes: [], reason: 'every formula must be a sentence (no free variables)' };
  const sig = signatureOf(sentences);
  if (sig.abbreviations.length) return { found: false, searched: 0, sizes: [], reason: `${sig.abbreviations.join(', ')} cannot be evaluated` };
  let searched = 0;
  const sizes: number[] = [];
  for (let n = 1; n <= maxSize; n++) {
    const count = countStructures(sig, n);
    if (searched + count > budget) return { found: false, searched, sizes, stoppedAt: { size: n, count } };
    sizes.push(n);
    for (const M of structuresOfSize(sig, n)) {
      searched++;
      const ctx = makeCtx(interpretation(M), { trace: false });
      if (sentences.every((F) => evalFormulaIn(ctx, F, new Map()).truth === true)) return { found: true, structure: M, size: n, searched };
    }
  }
  return { found: false, searched, sizes };
}

/** Looks for a countermodel to Γ ⊨ A: a small structure satisfying Γ and ¬A. */
export function findCountermodel(gamma: readonly Formula[], F: Formula, opts: { maxSize?: number; budget?: number } = {}): ModelSearch {
  return findModel([...gamma, A.not(F)], opts);
}
