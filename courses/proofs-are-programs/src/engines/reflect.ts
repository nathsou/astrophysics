// Proof by reflection for propositional logic: reification of a formula into the
// `Form` syntax of chapter 19, and the proof term `taut_sound f rfl (atoms […])`.
// This is the part a tactic would do; the kernel then checks the proof by running `taut`.

import { parseF, atoms, type F } from './props.ts';

export const MAX_ATOMS = 6;

/** ↔ is not a connective of Form: expand it */
export function expandIff(f: F): F {
  switch (f.k) {
    case 'and':
    case 'or':
    case 'imp':
      return { ...f, a: expandIff(f.a), b: expandIff(f.b) };
    case 'iff': {
      const a = expandIff(f.a);
      const b = expandIff(f.b);
      return { k: 'and', a: { k: 'imp', a, b }, b: { k: 'imp', a: b, b: a } };
    }
    default:
      return f;
  }
}

/** the Form term, in the course language */
export function reify(f: F, names: string[]): string {
  switch (f.k) {
    case 'atom':
      return `(.var ${names.indexOf(f.name)})`;
    case 'top':
      return '.tru';
    case 'bot':
      return '.fls';
    case 'and':
      return `(.and ${reify(f.a, names)} ${reify(f.b, names)})`;
    case 'or':
      return `(.or ${reify(f.a, names)} ${reify(f.b, names)})`;
    case 'imp':
      return `(.imp ${reify(f.a, names)} ${reify(f.b, names)})`;
    case 'iff':
      return reify(expandIff(f), names);
  }
}

/** the statement, as the course language writes it */
function statement(f: F, prec = 0): string {
  const par = (s: string, p: number) => (prec > p ? `(${s})` : s);
  switch (f.k) {
    case 'atom':
      return f.name;
    case 'top':
      return 'True';
    case 'bot':
      return 'False';
    case 'and':
      return par(`${statement(f.a, 4)} ∧ ${statement(f.b, 3)}`, 3);
    case 'or':
      return par(`${statement(f.a, 3)} ∨ ${statement(f.b, 2)}`, 2);
    case 'imp':
      return par(`${statement(f.a, 2)} → ${statement(f.b, 1)}`, 1);
    case 'iff':
      return statement(expandIff(f), prec);
  }
}

export function reflectionProof(src: string): { f: F; names: string[]; code: string } {
  const f = parseF(src);
  const names = atoms(f);
  if (names.length > MAX_ATOMS) throw new Error(`at most ${MAX_ATOMS} propositions, please: the checker tries all 2^n rows`);
  const binders = names.length ? ` (${names.join(' ')} : Prop)` : '';
  const term = reify(f, names).replace(/^\((.*)\)$/, '$1');
  const code = `theorem claim${binders} :
    ${statement(f)} :=
  taut_sound
    (${term})
    rfl
    (atoms [${names.join(', ')}])`;
  return { f, names, code };
}
