// Small natural deduction derivations to code (section "Derivations in Natural Deduction").
// Between them they use all sixteen rules of the book's table. A and B are sentences chosen by
// the reader; the derivations are schematic in them, like the book's example.

import * as A from '../syntax/ast.ts';
import type { Formula } from '../syntax/ast.ts';
import { D, did, symm, type Deriv } from '../proof/nd.ts';
import { deriveAdd, deriveNeq, Q } from '../proof/q.ts';

export interface DerivationExample {
  id: string;
  /** Plain-text name, e.g. "(A ∧ B) → A". */
  title: string;
  /** Does it depend on the reader's A and B? */
  usesAB: boolean;
  /** Is it a derivation from the axioms of Q? */
  fromQ?: boolean;
  note: string;
  build: (a: Formula, b: Formula) => Deriv;
}

const cl = <T extends A.Node>(x: T) => A.cloneFresh(x);
const a = () => A.c(1);
const b = () => A.c(2);

export const DERIVATION_EXAMPLES: DerivationExample[] = [
  {
    id: 'book',
    title: '(A ∧ B) → A',
    usesAB: true,
    note: 'The book’s example: ∧Elim, then →Intro discharging the assumption labelled 1.',
    build: (fa, fb) => {
      const ab = A.and(cl(fa), cl(fb));
      const as = D.assume(ab, 1);
      const e = D.andE(as, 'left');
      return D.impI(e, cl(ab), 1);
    },
  },
  {
    id: 'comm',
    title: '(A ∧ B) → (B ∧ A)',
    usesAB: true,
    note: 'Two occurrences of the same assumption, both discharged by the →Intro labelled 1.',
    build: (fa, fb) => {
      const ab = A.and(cl(fa), cl(fb));
      const r = D.andE(D.assume(cl(ab), 1), 'right');
      const l = D.andE(D.assume(cl(ab), 1), 'left');
      return D.impI(D.andI(r, l), cl(ab), 1);
    },
  },
  {
    id: 'or',
    title: '(A ∨ B) → (B ∨ A)',
    usesAB: true,
    note: '∨Elim has three premises, so its code starts with 3; it discharges the two cases (label 1).',
    build: (fa, fb) => {
      const aOrB = A.or(cl(fa), cl(fb));
      const bOrA = () => A.or(cl(fb), cl(fa));
      const left = D.orI(D.assume(cl(fa), 1), bOrA());
      const right = D.orI(D.assume(cl(fb), 1), bOrA());
      const e = D.orE(D.assume(cl(aOrB), 2), left, right, 1);
      return D.impI(e, cl(aOrB), 2);
    },
  },
  {
    id: 'dneg',
    title: 'A → ¬¬A',
    usesAB: true,
    note: '¬Elim gives ⊥ from ¬A and A; ¬Intro discharges ¬A (label 1), →Intro discharges A (label 2).',
    build: (fa) => {
      const bot = D.notE(D.assume(A.not(cl(fa)), 1), D.assume(cl(fa), 2));
      const nn = D.notI(bot, A.not(cl(fa)), 1);
      return D.impI(nn, cl(fa), 2);
    },
  },
  {
    id: 'dnegE',
    title: '¬¬A → A',
    usesAB: true,
    note: 'Classical: ⊥C discharges the assumption ¬A (label 1).',
    build: (fa) => {
      const bot = D.notE(D.assume(A.not(A.not(cl(fa))), 2), D.assume(A.not(cl(fa)), 1));
      const botC: Deriv = { id: did(), rule: 'botC', concl: cl(fa), premises: [bot], label: 1 };
      return D.impI(botC, A.not(A.not(cl(fa))), 2);
    },
  },
  {
    id: 'efq',
    title: '¬A → (A → B)',
    usesAB: true,
    note: '⊥I (intuitionistic absurdity) infers B from ⊥.',
    build: (fa, fb) => {
      const bot = D.notE(D.assume(A.not(cl(fa)), 2), D.assume(cl(fa), 1));
      const bb = D.botI(bot, cl(fb));
      return D.impI(D.impI(bb, cl(fa), 1), A.not(cl(fa)), 2);
    },
  },
  {
    id: 'allE',
    title: '∀x x = x → 0 = 0',
    usesAB: false,
    note: '∀Elim instantiates x with the closed term 0. The term is not part of the code; the decoder reads it off the formulas.',
    build: () => {
      const all = A.forall(A.v(0), A.eq(A.v(0), A.v(0)));
      const inst = D.allE(D.assume(all, 1), A.zero());
      return D.impI(inst, cl(all), 1);
    },
  },
  {
    id: 'refl',
    title: '∀x x = x',
    usesAB: false,
    note: '=Intro has no premises: its code is ⟨0, #a = a#, 0, 15⟩ — four components, unlike an assumption ⟨0, #A#, n⟩. Then ∀Intro with eigenvariable a.',
    build: () => {
      const e = D.eqI(a());
      return D.allI(e, A.forall(A.v(0), A.eq(A.v(0), A.v(0))), 1);
    },
  },
  {
    id: 'sym',
    title: '∀x ∀y (x = y → y = x)',
    usesAB: false,
    note: '=Elim replaces a by b in a = a, using the assumption a = b; two ∀Intro inferences with eigenvariables b and a.',
    build: () => {
      const ab = A.eq(a(), b());
      const flipped = symm(D.assume(ab, 1));
      const imp = D.impI(flipped, A.eq(a(), b()), 1);
      const inner = D.allI(imp, A.forall(A.v(1), A.imp(A.eq(a(), A.v(1)), A.eq(A.v(1), a()))), 2);
      return D.allI(inner, A.forall(A.v(0), A.forall(A.v(1), A.imp(A.eq(A.v(0), A.v(1)), A.eq(A.v(1), A.v(0))))), 1);
    },
  },
  {
    id: 'exE',
    title: '∃x x = 0 → ∃x 0 = x',
    usesAB: false,
    note: '∃Elim discharges the instance a = 0 (label 1); the eigenvariable a is recovered from that assumption when decoding.',
    build: () => {
      const ex = A.exists(A.v(0), A.eq(A.v(0), A.zero()));
      const inst = D.assume(A.eq(a(), A.zero()), 1);
      const flipped = symm(inst);
      const intro = D.exI(flipped, A.exists(A.v(0), A.eq(A.zero(), A.v(0))), a());
      const elim = D.exE(D.assume(ex, 2), intro, 1, 1);
      return D.impI(elim, cl(ex), 2);
    },
  },
  {
    id: 'neq',
    title: 'Q ⊢ 0 ≠ 1',
    usesAB: false,
    fromQ: true,
    note: 'From the axiom Q2 of Q. In the code, the axiom is simply an undischarged assumption ⟨0, #Q2#, 0⟩.',
    build: () => deriveNeq(0n, 1n),
  },
  {
    id: 'neq2',
    title: 'Q ⊢ 2 ≠ 1',
    usesAB: false,
    fromQ: true,
    note: 'Lemma “Q proves different numerals are different” for 2 and 1: axioms Q1 and Q2, and an assumption discharged by ¬Intro.',
    build: () => deriveNeq(2n, 1n, { next: 1 }),
  },
  {
    id: 'add',
    title: 'Q ⊢ 1 + 1 = 2',
    usesAB: false,
    fromQ: true,
    note: 'From Q4 and Q5 by ∀Elim and =Elim.',
    build: () => deriveAdd(1n, 1n),
  },
];

export { Q };
