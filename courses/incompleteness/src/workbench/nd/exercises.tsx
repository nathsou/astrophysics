// Exercises for the natural deduction appendix. Derivation exercises are checked by the
// checker: the answer is accepted when the builder holds a complete derivation of the goal whose
// undischarged assumptions are all in Γ, and the checker accepts every inference.

import { useCallback, useRef, type ReactNode } from 'react';
import { Exercise } from '../../ui/Exercise';
import { Tex } from '../../ui/Tex';
import { DerivationBuilder } from './DerivationBuilder';

function NDExercise({ id, title, goal, gamma = [], children, hint }: { id: string; title: string; goal: string; gamma?: string[]; children: ReactNode; hint?: ReactNode }) {
  const done = useRef(false);
  const onDone = useCallback((d: boolean) => {
    done.current = d;
  }, []);
  return (
    <Exercise
      id={id}
      title={title}
      noInput
      check={() =>
        done.current
          ? { ok: true, message: 'The checker accepts every inference, and every undischarged assumption is in Γ.' }
          : { ok: false, message: 'Not yet: the derivation still has goals, a rejected inference, or an undischarged assumption outside Γ (see the status above the builder’s panels).' }
      }
      hint={hint}
    >
      {children}
      <DerivationBuilder goal={goal} gamma={gamma} fixed onDone={onDone} examples={[]} />
    </Exercise>
  );
}

export function ExNotNot() {
  return (
    <NDExercise id="ntd.pro.notnot" title="A ⊢ ¬¬A" goal="¬¬A" gamma={['A']} hint={<>The goal is a negation: which assumption would you need to refute?</>}>
      <p>
        Derive <Tex tex="\lnot\lnot A" /> from <Tex tex="A" /> (a problem of the section). Start with the goal, choose a rule, and close the goals by assumptions.
      </p>
    </NDExercise>
  );
}

export function ExNotAndNot() {
  return (
    <NDExercise id="ntd.pro.noncontra" title="⊢ ¬(A ∧ ¬A)" goal="¬(A ∧ ¬A)" hint={<>The goal is a negation, so assume A ∧ ¬A and aim for ⊥. What can you get out of that one assumption?</>}>
      <p>
        Derive <Tex tex="\lnot(A \land \lnot A)" /> with every assumption discharged.
      </p>
    </NDExercise>
  );
}

export function ExAllNotNotEx() {
  return (
    <NDExercise id="ntd.prq.allnot" title="∀x ¬A(x) ⊢ ¬∃x A(x)" goal="¬∃x A(x)" gamma={['∀x ¬A(x)']} hint={<>Assume ∃x A(x) and aim for ⊥. To use an existential assumption you need ∃Elim, and its eigenvariable may be instantiated by ∀Elim too.</>}>
      <p>
        Derive <Tex tex="\lnot\exists x\, A(x)" /> from <Tex tex="\forall x\, \lnot A(x)" />. Watch the eigenvariable condition: the checker will tell you if it is violated.
      </p>
    </NDExercise>
  );
}

export function ExSymmetry() {
  return (
    <NDExercise id="ntd.ide.symm" title="= is symmetric" goal="∀x ∀y (x = y → y = x)" hint={<>Do the ∀Intros last (lowest in the tree), with fresh constants a and b. For b = a from a = b, read b = a as A(b) with A(x) the formula x = a: what is A(a)?</>}>
      <p>
        Derive <Tex tex="\forall x\, \forall y\, (x = y \rightarrow y = x)" /> (a problem of the section).
      </p>
    </NDExercise>
  );
}

export function ExEigenChoice() {
  return (
    <Exercise
      id="ntd.qrl.eigen"
      title="Which inference is wrong?"
      choices={[
        { label: 'The ∃Elim: a occurs in the assumption A(a) that it discharges.', why: 'That is allowed: ∃Elim discharges A(a); the condition concerns the other undischarged assumptions, the premise ∃x A(x) and the conclusion.' },
        { label: 'The ∀Intro: a occurs in the undischarged assumption A(a).', correct: true, why: 'At the ∀Intro, A(a) is still undischarged (it is discharged only below, by ∃Elim), so the eigenvariable condition of ∀Intro fails.' },
        { label: 'Neither: ∃x A(x) ⊢ ∀x A(x).', why: 'In a structure where A is true of some but not all elements, ∃x A(x) is true and ∀x A(x) false; by soundness there can be no derivation.' },
      ]}
    >
      <p>
        In the book’s incorrect derivation of <Tex tex="\forall x\, A(x)" /> from <Tex tex="\exists x\, A(x)" />, the assumption <Tex tex="[A(a)]^1" /> is followed by ∀Intro and then ∃Elim (eigenvariable
        a, label 1). Which inference violates the eigenvariable condition?
      </p>
    </Exercise>
  );
}

export function ExNegVsBotC() {
  return (
    <Exercise
      id="ntd.prl.botc"
      title="¬Intro or ⊥C?"
      choices={[
        { label: '¬Intro: from a derivation of ⊥ from [A]ⁿ infer ¬A.', why: 'That concludes ¬A, a negated sentence; here the conclusion is A.' },
        { label: '⊥C: from a derivation of ⊥ from [¬A]ⁿ infer A.', correct: true, why: 'Right: ⊥C derives a positive sentence by refuting its negation — the book: “¬Intro derives a negated sentence ¬A but ⊥C a positive sentence A”.' },
        { label: '⊥I: from ⊥ infer A.', why: '⊥I discharges nothing; the assumption ¬A would stay undischarged.' },
      ]}
    >
      <p>
        You have derived <Tex tex="\bot" /> from the assumption <Tex tex="[\lnot A]^1" />. Which rule concludes <Tex tex="A" /> and discharges it?
      </p>
    </Exercise>
  );
}

export function ExInconsistent() {
  return (
    <Exercise
      id="ntd.ptn.incons"
      title="From an inconsistent set, anything"
      choices={[
        { label: 'By ⊥I: add one inference below the derivation of ⊥.', correct: true, why: 'Γ ⊢ ⊥ gives a derivation of ⊥ whose undischarged assumptions are in Γ; ⊥I infers any A from it and discharges nothing.' },
        { label: 'By ¬Intro.', why: '¬Intro concludes a negation ¬B, not an arbitrary A.' },
        { label: 'It does not follow.', why: 'It does: ⊥I infers any sentence from ⊥, so one more inference below the derivation of ⊥ gives a derivation of A from Γ.' },
      ]}
    >
      <p>
        Γ is inconsistent: <Tex tex="\Gamma \vdash \bot" />. Why is <Tex tex="\Gamma \vdash A" /> for every sentence A?
      </p>
    </Exercise>
  );
}

export function ExFiniteCheck() {
  return (
    <Exercise
      id="ntd.sou.finite"
      title="What does a search show?"
      choices={[
        { label: 'That the derivation’s assumptions entail its conclusion.', why: 'Entailment is about all structures, including infinite ones and larger finite ones. A search of small structures cannot establish it.' },
        { label: 'Nothing about entailment in general — only that no structure of that size is a counterexample.', correct: true, why: 'Right. Soundness (proved in the text) is what guarantees entailment for every correct derivation.' },
        { label: 'That natural deduction is sound.', why: 'Soundness is a theorem about all derivations and all structures; it is proved by induction on the number of inferences.' },
      ]}
    >
      <p>The soundness lab searches all structures with two elements and finds no step of a derivation that fails. What does that show?</p>
    </Exercise>
  );
}
