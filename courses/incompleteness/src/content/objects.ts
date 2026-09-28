// The mathematical objects a reader builds. They persist across the three modes of a section,
// across sections, and across visits (localStorage), so the same example can be followed from
// intuition to workbench to formal proof.

import { persistedStore, useStore, type Store } from '../ui/store';
import { tryParseFormula, tryParseTerm, type ParseResult } from '../engine/syntax/parse';
import type { Formula, Term } from '../engine/syntax/ast';
import { PROV } from '../engine/fixedpoint/fixedpoint';
import { R, type RF } from '../engine/recursive/rf';
import { useMemo } from 'react';

export const ABBREVIATIONS = [PROV];

/** The formula studied in the arithmetization chapter. */
export const formulaStore = persistedStore('ic.formula', '∀x (x = 0 ∨ ∃y x = y′)');
/** A term (coding terms, substitution). */
export const termStore = persistedStore('ic.term', "(x + 1)′");
/** A substitution problem: A, the variable, the term. */
export const substStore = persistedStore('ic.subst', { formula: '∃y x < y ∧ x = 2', variable: 'x', term: 'y′' });
/** The formula B(x) of the fixed-point lemma. */
export const bStore = persistedStore('ic.fixed.B', '¬Prov(x)');
/** A sequence of numbers (section Sequences). */
export const sequenceStore = persistedStore('ic.sequence', '2, 7, 3');
/** A recursive function, as a serialisable definition, with its inputs. */
export const functionStore = persistedStore<{ spec: RFSpec; args: string }>('ic.function', {
  spec: { k: 'comp', f: { k: 'basic', name: 'add' }, gs: [{ k: 'proj', n: 1, i: 0 }, { k: 'comp', f: { k: 'succ' }, gs: [{ k: 'succ' }] }] },
  args: '3',
});

export function useParsedFormula(store: Store<string> = formulaStore): [string, (s: string) => void, ParseResult<Formula>] {
  const text = useStore(store);
  const parsed = useMemo(() => tryParseFormula(text, { abbreviations: ABBREVIATIONS }), [text]);
  return [text, store.set, parsed];
}

export function useParsedTerm(): [string, (s: string) => void, ParseResult<Term>] {
  const text = useStore(termStore);
  const parsed = useMemo(() => tryParseTerm(text), [text]);
  return [text, termStore.set, parsed];
}

// ------------------------------------------------------------------ recursive-function specs

export type RFSpec =
  | { k: 'zero' }
  | { k: 'succ' }
  | { k: 'proj'; n: number; i: number }
  | { k: 'basic'; name: 'add' | 'mult' | 'chareq' }
  | { k: 'comp'; f: RFSpec; gs: RFSpec[] }
  | { k: 'rec'; f: RFSpec; g: RFSpec }
  | { k: 'min'; f: RFSpec };

export function buildRF(s: RFSpec): RF {
  switch (s.k) {
    case 'zero':
      return R.zero();
    case 'succ':
      return R.succ();
    case 'proj':
      return R.proj(s.n, s.i);
    case 'basic':
      return R.basic(s.name);
    case 'comp':
      return R.comp(buildRF(s.f), s.gs.map(buildRF));
    case 'rec':
      return R.rec(buildRF(s.f), buildRF(s.g));
    case 'min':
      return R.min(buildRF(s.f));
  }
}

export function toSpec(f: RF): RFSpec {
  switch (f.k) {
    case 'zero':
    case 'succ':
      return { k: f.k };
    case 'proj':
      return { k: 'proj', n: f.n, i: f.i };
    case 'basic':
      return { k: 'basic', name: f.name };
    case 'comp':
      return { k: 'comp', f: toSpec(f.f), gs: f.gs.map(toSpec) };
    case 'rec':
      return { k: 'rec', f: toSpec(f.f), g: toSpec(f.g) };
    case 'min':
      return { k: 'min', f: toSpec(f.f) };
    case 'def':
      return toSpec(f.body);
  }
}
