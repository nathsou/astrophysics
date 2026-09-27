// Exercises for chapter 5, sections 5.4–5.9.

import { Exercise } from '../../ui/Exercise';
import { Tex } from '../../ui/Tex';
import { parsePF } from '../../engine/provability/pl';
import { ProvabilityEditor } from './ProvabilityLab';

export function RosserExercise() {
  return (
    <Exercise
      id="inp.ros.race"
      title="Proof versus shmoof"
      choices={[
        { label: 'true', why: 'RProv requires that no smaller code is a refutation; code 3 is a refutation and 3 < 5.' },
        { label: 'false', correct: true, why: 'The refutation (code 3) comes before the proof (code 5), so there is no proof without a smaller refutation. Prov(⌜R⌝) is true, RProv(⌜R⌝) is false.' },
        { label: 'it depends on whether T is consistent', why: 'The situation described already makes T inconsistent; the truth value of RProv(⌜R⌝) in ℕ is fixed by the two codes.' },
      ]}
    >
      <p>
        Suppose (in an inconsistent theory T) the least code of a derivation of <Tex tex="R" /> is 5 and the least code of a derivation of <Tex tex="\lnot R" /> is 3. Is{' '}
        <Tex tex="\mathsf{RProv}_T(\ulcorner R\urcorner)" /> true in <Tex tex="\mathfrak N" />?
      </p>
    </Exercise>
  );
}

export function ConditionsExercise() {
  return (
    <Exercise
      id="inp.prc.rule"
      title="A rule or a theorem?"
      choices={[
        { label: 'P1', correct: true, why: 'P1 says: if T ⊢ A then T ⊢ Prov(⌜A⌝). It is a closure property of T, not a sentence T derives; its internal version A → Prov(⌜A⌝) is not derivable in general.' },
        { label: 'P2', why: 'P2 is a schema of sentences each of which T derives.' },
        { label: 'P3', why: 'P3 is a schema of sentences each of which T derives — it is P1 “formalized inside T”.' },
      ]}
    >
      <p>Which of the derivability conditions is a rule (it turns derivable sentences into derivable sentences) rather than a schema of derivable sentences?</p>
    </Exercise>
  );
}

export function ReflectionExercise() {
  return (
    <Exercise
      id="inp.lob.reflection"
      title="Which reflection instances?"
      choices={[
        { label: 'all of them, if T is sound', why: 'Soundness makes each instance true, not derivable. Löb’s theorem is about derivability.' },
        { label: 'exactly those for which T ⊢ A', correct: true, why: 'If T ⊢ A, then T ⊢ Prov(⌜A⌝) → A by logic. Conversely, if T ⊢ Prov(⌜A⌝) → A, then T ⊢ A by Löb’s theorem.' },
        { label: 'none of them', why: 'If T ⊢ A, the instance Prov(⌜A⌝) → A follows by logic.' },
      ]}
    >
      <p>
        For which sentences <Tex tex="A" /> does a theory T satisfying P1–P3 derive the reflection instance <Tex tex="\mathsf{Prov}_T(\ulcorner A\urcorner) \rightarrow A" />?
      </p>
    </Exercise>
  );
}

export function GImpliesCon() {
  return (
    <ProvabilityEditor
      id="inp.2in.g-con"
      goal="G -> Con"
      given={[{ n: 1, f: parsePF('G <-> ~Prov(G)'), just: { r: 'hyp', name: 'G is a Gödel sentence' } }]}
    >
      <p className="wb-note">
        <b>Problem from the book.</b> Show that PA derives <Tex tex="G \rightarrow \mathsf{Con}" />, using only the fixed point, P1–P3 and propositional logic. Hint: argue contrapositively.{' '}
        <Tex tex="\bot \rightarrow G" /> is a tautology; what do P1 and P2 give you from it?
      </p>
    </ProvabilityEditor>
  );
}

export function SecondFromLob() {
  return (
    <ProvabilityEditor
      id="inp.lob.g2"
      lob
      goal="_|_"
      given={[{ n: 1, f: parsePF('Con'), just: { r: 'hyp', name: 'suppose T ⊢ Con' } }]}
    >
      <p className="wb-note">
        <b>The second incompleteness theorem from Löb’s theorem.</b> Suppose T derives <Tex tex="\mathsf{Con} \equiv \lnot\mathsf{Prov}(\ulcorner\bot\urcorner)" />. Derive{' '}
        <Tex tex="\bot" />, using Löb’s theorem as a rule.
      </p>
    </ProvabilityEditor>
  );
}

export function HenkinSentence() {
  return (
    <ProvabilityEditor id="inp.lob.henkin" lob goal="H" given={[{ n: 1, f: parsePF('H <-> Prov(H)'), just: { r: 'hyp', name: 'H is a fixed point of Prov(x)' } }]}>
      <p className="wb-note">
        <b>Henkin’s question.</b> Show that T derives the sentence <Tex tex="H" /> that says “I am derivable”.
      </p>
    </ProvabilityEditor>
  );
}

export function TarskiExercise() {
  return (
    <Exercise
      id="inp.tar.halting"
      title="Definable, not computable"
      choices={[
        { label: 'the set of Gödel numbers of true sentences', why: 'That is exactly what Tarski’s theorem says is not definable.' },
        { label: 'the halting relation', correct: true, why: 'It is defined by ∃s D_T(z, x, s), where D_T defines Kleene’s T predicate — but it is not computable.' },
        { label: 'no relation: definable and computable coincide', why: 'Every computable relation is definable, but not conversely.' },
      ]}
    >
      <p>Which of these is definable in 𝔑 but not computable?</p>
    </Exercise>
  );
}
