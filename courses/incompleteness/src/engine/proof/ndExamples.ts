// The derivations of the natural deduction appendix, transcribed from the book's trees.
//
// Each example is the book's finished derivation, inference by inference, with the book's
// discharge labels and eigenvariables (tests/nd-builder.test.ts records the checker's verdict on
// each).
//
// Letters: A, B, C, D are formula letters (see ndlang.ts): A is a sentence letter, A(x) a
// one-place formula letter; a, b, c are constant symbols, used as eigenvariables.

import * as Ast from '../syntax/ast.ts';
import type { Formula } from '../syntax/ast.ts';
import { D, did, type Deriv } from './nd.ts';
import { nd } from './ndlang.ts';

export interface NDExample {
  id: string;
  /** The section whose text contains the example. */
  section: string;
  title: string;
  /** Where in the section (for the reader). */
  where: string;
  /** The assumptions Γ the example derives from (empty: a theorem). */
  gamma: Formula[];
  goal: Formula;
  build: () => Deriv;
  /** An example the book gives as incorrect. */
  incorrect?: boolean;
  note?: string;
}

const a = 1;
const b = 2;
const c = 3;

/** →Intro without a discharge label (the book allows this when nothing is discharged). */
const impINoLabel = (p: Deriv, antecedent: Formula): Deriv => ({ id: did(), rule: 'impI', concl: Ast.imp(antecedent, p.concl), premises: [p] });

export const ND_EXAMPLES: NDExample[] = [
  {
    id: 'ntd-and-imp',
    section: 'fol.prf.ntd',
    title: '⊢ (A ∧ B) → A',
    where: 'the first derivation in the section',
    gamma: [],
    goal: nd('(A ∧ B) → A'),
    build: () => D.impI(D.andE(D.assume(nd('A ∧ B'), 1), 'left'), nd('A ∧ B'), 1),
  },
  {
    id: 'der-andI',
    section: 'fol.ntd.der',
    title: 'A, B ⊢ A ∧ B',
    where: 'Example: an assumption on its own is a derivation, and ∧Intro combines two',
    gamma: [nd('A'), nd('B')],
    goal: nd('A ∧ B'),
    build: () => D.andI(D.assume(nd('A')), D.assume(nd('B'))),
  },
  {
    id: 'der-C-imp',
    section: 'fol.ntd.der',
    title: 'D ⊢ C → (C ∧ D)',
    where: 'Example: →Intro discharges the assumption C labelled 1',
    gamma: [nd('D')],
    goal: nd('C → (C ∧ D)'),
    build: () => D.impI(D.andI(D.assume(nd('C'), 1), D.assume(nd('D'))), nd('C'), 1),
  },
  {
    id: 'der-D-imp',
    section: 'fol.ntd.der',
    title: 'C ⊢ D → (C ∧ D)',
    where: 'Example: the same, discharging D instead',
    gamma: [nd('C')],
    goal: nd('D → (C ∧ D)'),
    build: () => D.impI(D.andI(D.assume(nd('C')), D.assume(nd('D'), 1)), nd('D'), 1),
  },
  {
    id: 'der-vacuous',
    section: 'fol.ntd.der',
    title: 'B ⊢ A → B',
    where: 'Example: discharging is a permission — →Intro labelled 1 with no assumption A labelled 1',
    gamma: [nd('B')],
    goal: nd('A → B'),
    build: () => D.impI(D.assume(nd('B')), nd('A'), 1),
  },
  {
    id: 'pro-1',
    section: 'fol.ntd.pro',
    title: '⊢ (A ∧ B) → A',
    where: 'first example',
    gamma: [],
    goal: nd('(A ∧ B) → A'),
    build: () => D.impI(D.andE(D.assume(nd('A ∧ B'), 1), 'left'), nd('A ∧ B'), 1),
  },
  {
    id: 'pro-2',
    section: 'fol.ntd.pro',
    title: '⊢ (¬A ∨ B) → (A → B)',
    where: 'second example, the finished derivation',
    gamma: [],
    goal: nd('(¬A ∨ B) → (A → B)'),
    build: () => {
      const middle = D.impI(D.botI(D.notE(D.assume(nd('¬A'), 2), D.assume(nd('A'), 3)), nd('B')), nd('A'), 3);
      const right = impINoLabel(D.assume(nd('B'), 2), nd('A'));
      return D.impI(D.orE(D.assume(nd('¬A ∨ B'), 1), middle, right, 2), nd('¬A ∨ B'), 1);
    },
  },
  {
    id: 'pro-3',
    section: 'fol.ntd.pro',
    title: '⊢ A ∨ ¬A',
    where: 'third example (⊥C)',
    gamma: [],
    goal: nd('A ∨ ¬A'),
    build: () => {
      const notA = D.notI(D.notE(D.assume(nd('¬(A ∨ ¬A)'), 1), D.orI(D.assume(nd('A'), 2), nd('A ∨ ¬A'))), nd('A'), 2);
      const A = D.botC(D.notE(D.assume(nd('¬(A ∨ ¬A)'), 1), D.orI(D.assume(nd('¬A'), 3), nd('A ∨ ¬A'))), nd('A'), 3);
      return D.botC(D.notE(notA, A), nd('A ∨ ¬A'), 1);
    },
  },
  {
    id: 'qrl-bad',
    section: 'fol.ntd.qrl',
    title: '∃x A(x) ⊢ ∀x A(x)?',
    where: 'the incorrect derivation that motivates the eigenvariable condition',
    gamma: [nd('∃x A(x)')],
    goal: nd('∀x A(x)'),
    incorrect: true,
    build: () => D.exE(D.assume(nd('∃x A(x)')), D.allI(D.assume(nd('A(a)'), 1), nd('∀x A(x)'), a), a, 1),
    note: 'The book marks the ∀Intro inference with * : it violates the eigenvariable condition, and ∃x A(x) does not entail ∀x A(x).',
  },
  {
    id: 'qrl-bad-2',
    section: 'fol.ntd.qrl',
    title: 'P(a, a) ⊢ ∀x P(a, x)?',
    where: 'the remark that ∀x P(a, x) cannot be inferred from P(a, a) by ∀Intro',
    gamma: [nd('P(a, a)')],
    goal: nd('∀x P(a, x)'),
    incorrect: true,
    build: () => D.allI(D.assume(nd('P(a, a)')), nd('∀x P(a, x)'), a),
  },
  {
    id: 'qrl-exI',
    section: 'fol.ntd.qrl',
    title: 'P(a, a) ⊢ ∃x P(a, x)',
    where: 'the remark that ∃Intro may replace some, not all, occurrences of t',
    gamma: [nd('P(a, a)')],
    goal: nd('∃x P(a, x)'),
    build: () => D.exI(D.assume(nd('P(a, a)')), nd('∃x P(a, x)'), Ast.c(a)),
  },
  {
    id: 'prq-1',
    section: 'fol.ntd.prq',
    title: '⊢ ∃x ¬A(x) → ¬∀x A(x)',
    where: 'first example',
    gamma: [],
    goal: nd('∃x ¬A(x) → ¬∀x A(x)'),
    build: () => {
      const bot = D.notE(D.assume(nd('¬A(a)'), 2), D.allE(D.assume(nd('∀x A(x)'), 3), Ast.c(a)));
      const neg = D.notI(bot, nd('∀x A(x)'), 3);
      return D.impI(D.exE(D.assume(nd('∃x ¬A(x)'), 1), neg, a, 2), nd('∃x ¬A(x)'), 1);
    },
  },
  {
    id: 'prq-2',
    section: 'fol.ntd.prq',
    title: '∃x (A(x) ∧ B(x)), ∀x (B(x) → C(x, b)) ⊢ ∃x C(x, b)',
    where: 'second example',
    gamma: [nd('∃x (A(x) ∧ B(x))'), nd('∀x (B(x) → C(x, b))')],
    goal: nd('∃x C(x, b)'),
    build: () => {
      const inst = D.allE(D.assume(nd('∀x (B(x) → C(x, b))')), Ast.c(a));
      const Ba = D.andE(D.assume(nd('A(a) ∧ B(a)'), 1), 'right');
      const Cab = D.impE(inst, Ba);
      const ex = D.exI(Cab, nd('∃x C(x, b)'), Ast.c(a));
      return D.exE(D.assume(nd('∃x (A(x) ∧ B(x))')), ex, a, 1);
    },
  },
  {
    id: 'prq-3',
    section: 'fol.ntd.prq',
    title: '∀x A(x) → ∃y B(y), ¬∃y B(y) ⊢ ¬∀x A(x)',
    where: 'third example',
    gamma: [nd('∀x A(x) → ∃y B(y)'), nd('¬∃y B(y)')],
    goal: nd('¬∀x A(x)'),
    build: () => {
      const eb = D.impE(D.assume(nd('∀x A(x) → ∃y B(y)')), D.assume(nd('∀x A(x)'), 1));
      return D.notI(D.notE(D.assume(nd('¬∃y B(y)')), eb), nd('∀x A(x)'), 1);
    },
  },
  {
    id: 'ide-1',
    section: 'fol.ntd.ide',
    title: 'A(a), a = b ⊢ A(b)',
    where: 'first example (Leibniz’ law), with the closed terms s, t taken to be the constants a, b',
    gamma: [nd('A(a)'), nd('a = b')],
    goal: nd('A(b)'),
    build: () => D.eqE(D.assume(nd('a = b')), D.assume(nd('A(a)')), nd('A(b)')),
  },
  {
    id: 'ide-2',
    section: 'fol.ntd.ide',
    title: '∃x ∀y (A(y) → y = x) ⊢ ∀x ∀y ((A(x) ∧ A(y)) → x = y)',
    where: 'second example, assembled from the book’s pieces',
    gamma: [nd('∃x ∀y (A(y) → y = x)')],
    goal: nd('∀x ∀y ((A(x) ∧ A(y)) → x = y)'),
    build: () => {
      const ac = D.impE(D.allE(D.assume(nd('∀y (A(y) → y = c)'), 2), Ast.c(a)), D.andE(D.assume(nd('A(a) ∧ A(b)'), 1), 'left'));
      const bc = D.impE(D.allE(D.assume(nd('∀y (A(y) → y = c)'), 2), Ast.c(b)), D.andE(D.assume(nd('A(a) ∧ A(b)'), 1), 'right'));
      const ab = D.eqE(bc, ac, nd('a = b'), { note: 'From b = c and a = c: replace c in a = c by b.' });
      const ex = D.exE(D.assume(nd('∃x ∀y (A(y) → y = x)')), ab, c, 2);
      const imp = D.impI(ex, nd('A(a) ∧ A(b)'), 1);
      const allb = D.allI(imp, nd('∀y ((A(a) ∧ A(y)) → a = y)'), b);
      return D.allI(allb, nd('∀x ∀y ((A(x) ∧ A(y)) → x = y)'), a);
    },
    note: 'The book draws the derivation down to ∃Elim and the sub-derivation of a = c, and says b = c is derived the same way and a = b follows by =Elim. The derivation of b = c and the final =Elim (with the identity b = c as its first premise, as the rule’s schema has it) are filled in here.',
  },
];

export const exampleById = (id: string) => ND_EXAMPLES.find((e) => e.id === id);
export const examplesOf = (section: string) => ND_EXAMPLES.filter((e) => e.section === section);
