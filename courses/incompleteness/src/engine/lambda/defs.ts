// Named terms from the book, as source text for the parser (`parseLambda` expands an uppercase
// name to a fresh copy of its term, labelled with the name). Sources use this module's syntax:
// multi-letter variables, so binders and applications are separated by spaces; digits are Church
// numerals; ⟨M, N⟩ is the pair λf.f M N.

import type { Term } from './term.ts';

export interface Definition {
  /** The term, as source text (parsed with the same definitions) or as a term. */
  src: string | Term;
  /** Display label (default: the name). */
  label?: string;
  /** Where it comes from / what it does. */
  note?: string;
}

const ARF = 'section “λ-Definable Arithmetical Functions”';
const PAI = 'section “Pairs and Predecessor”';
const TVR = 'section “Truth Values and Relations”';
const PRF = 'section “Primitive Recursive Functions are λ-Definable”';
const FP = 'section “Fixpoints”';

export const BOOK_DEFS: Record<string, Definition> = {
  I: { src: 'λx. x', note: 'the identity function (chapter “Lambda Definability”, introduction)' },
  K: { src: 'λx y. x', note: 'λx.λy.x returns its first argument (section “Currying”)' },
  S: { src: 'λx y z. x z (y z)', note: 'the combinator S (standard; not used in the book)' },
  Ω: { src: '(λx. x x) (λx. x x)', note: '(λx.xx)(λx.xx) reduces to itself (section “Reduction of Lambda Terms”)' },
  Omega: { src: '(λx. x x) (λx. x x)', label: 'Ω', note: 'same as Ω' },

  Succ: { src: 'λa f x. f (a f x)', note: ARF },
  "Succ'": { src: 'λn f x. n f (f x)', note: `${ARF}, exercise` },
  Add: { src: 'λa b f x. a f (b f x)', note: ARF },
  "Add'": { src: 'λa b. a Succ b', note: ARF },
  Mult: { src: 'λa b f x. a (b f) x', note: ARF },
  "Mult'": { src: 'λa b. a (Add b) 0', note: `${ARF}, exercise: b added a times to 0̄` },
  Exp: { src: 'λb e. e b', note: `${ARF}: for exponents e ≥ 1` },
  "Exp'": { src: 'λb e. e (Mult b) 1', note: ARF },

  Pair: { src: 'λm n f. f m n', note: PAI },
  Fst: { src: 'λp. p (λm n. m)', note: PAI },
  Snd: { src: 'λp. p (λm n. n)', note: PAI },
  Pred: { src: 'λn. Fst (n (λp. ⟨Snd p, Succ (Snd p)⟩) ⟨0, 0⟩)', note: PAI },
  Sub: { src: 'λa b. b Pred a', note: PAI },

  True: { src: 'λx y. x', label: 'true', note: TVR },
  False: { src: 'λx y. y', label: 'false', note: TVR },
  IsZero: { src: 'λn. n (λx. False) True', note: TVR },
  Not: { src: 'λx. x False True', note: TVR },
  And: { src: 'λx y. x y False', note: TVR },

  Zero: { src: 'λa f x. x', note: `${PRF}: the zero function` },

  U: { src: 'λu x. x (u u x)', note: `${FP}: Y ≡ U U` },
  Y: { src: '(λu x. x (u u x)) (λu x. x (u u x))', note: `${FP}: Turing’s fixpoint combinator, Y g ↠ g (Y g)` },
  Y_C: { src: 'λg. (λx. g (x x)) (λx. g (x x))', note: `${FP}: Church’s fixpoint combinator, Y_C g =β g (Y_C g)` },
  "Fac'": { src: 'λg n. IsZero n 1 (Mult n (g (Pred n)))', note: FP },
  Fac: { src: "Y Fac'", note: `${FP}: the factorial, a fixpoint of Fac′` },
  Search: { src: 'λg f x y. IsZero (f x y) y (g f x (Succ y))', note: 'section “Minimization”, for one argument x' },
};
