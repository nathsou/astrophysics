// Exercises for the chapter "Computability and Incompleteness", added for this edition. Answers
// are checked by the engine where possible.

import { Exercise } from '../../ui/Exercise';
import { Tex } from '../../ui/Tex';
import { decodeIndex, phi } from '../../engine/computability/indices';
import { computationRecord, encodeRecord } from '../../engine/computability/records';

const digits = (s: string) => s.replace(/[\s,_]/g, '');

export function ExReadIndex() {
  return (
    <Exercise
      id="cmp.thy.int.read-index"
      title="Read an index"
      choices={[
        { label: <Tex tex="\varphi_{31}(x) = x + 2" />, correct: true, why: <>31 = 3 + 4·7 and 7 = J(1, 2) = J(1, J(1, 0)): a composition with outer function #1 = succ and one inner function #1 = succ. So φ₃₁ = succ ∘ succ.</> },
        { label: <Tex tex="\varphi_{31}(x) = 2x" />, why: 'Decode the tag first: 31 − 2 = 29 leaves remainder 1 on division by 4, so it is a composition. Of which functions?' },
        { label: <>31 is not the index of a function</>, why: 'Every number codes a definition tree; this one happens to be well formed. Try it in the workbench.' },
      ]}
    >
      <p>
        In this edition’s coding, <Tex tex="\#\mathrm{Comp}(f; g) = 3 + 4\,J(\#f, J(\#g, 0))" />, <Tex tex="\#\mathrm{succ} = 1" /> and <Tex tex="J(1, 0) = 2" />,{' '}
        <Tex tex="J(1, 2) = 7" />. Which function is <Tex tex="\varphi_{31}" />?
      </p>
    </Exercise>
  );
}

export function ExAnotherIndex() {
  return (
    <Exercise
      id="cmp.thy.nfm.another-index"
      title="Another index of succ"
      placeholder="an index other than 1"
      check={(a) => {
        const t = digits(a);
        if (!/^\d+$/.test(t) || t.length > 400) return { ok: false, message: 'Type a natural number.' };
        const e = BigInt(t);
        if (e === 1n) return { ok: false, message: '1 is the index of succ itself. Find a different one.' };
        const d = decodeIndex(e);
        if (!d.ok || d.arity !== 1) return { ok: false, message: 'That index does not code a one-place definition.' };
        for (let x = 0n; x < 12n; x++) {
          const o = phi(e, x, 20_000);
          if (o.kind !== 'value' || o.value !== x + 1n) return { ok: false, message: <>At x = {x.toString()} this function gives {o.kind === 'value' ? o.value.toString() : 'no value within the budget'}, not {(x + 1n).toString()}.</> };
        }
        return { ok: true, message: <>It agrees with succ on x = 0, …, 11 (checked by running it). That it agrees everywhere follows from its definition — look at it in the explorer.</> };
      }}
      hint={<>Pad succ with a projection: <Tex tex="\mathrm{Comp}(P^1_0; \mathrm{succ})" /> or <Tex tex="\mathrm{Comp}(\mathrm{succ}; P^1_0)" />. The first unary definitions in the list include one.</>}
      solution={<>51 = #Comp(P¹₀; succ) and 91 = #Comp(succ; P¹₀) both compute x + 1.</>}
    >
      <p>Give an index e ≠ 1 with <Tex tex="\varphi_e = \mathrm{succ}" />.</p>
    </Exercise>
  );
}

export function ExRecordCode() {
  const r = computationRecord(1n, 0n);
  const want = r.kind === 'halted' ? encodeRecord(r.root)! : 37n;
  return (
    <Exercise
      id="cmp.thy.cod.record-code"
      title="The smallest record"
      placeholder="a number"
      check={(a) => ({ ok: digits(a) === want.toString(), message: digits(a) === want.toString() ? <>J(1, J(1, J(1, 0))) = J(1, J(1, 2)) = J(1, 7) = 37: definition 1, arguments seq(0) = 1, value 1, no children.</> : 'Work from the inside: seq() = 0, seq(0) = 1 + J(0, 0) = 1, then J(value, children), J(args, …), J(e, …).' })}
      hint={<>The record of one call is <Tex tex="J(e, J(\mathrm{seq}(\vec y), J(v, \mathrm{seq}(\text{children}))))" />, and <Tex tex="J(x, y) = \tfrac12(x+y)(x+y+1) + x" />.</>}
    >
      <p>
        What is the code s of the record of the computation of <Tex tex="\varphi_1(0) = \mathrm{succ}(0) = 1" />?
      </p>
    </Exercise>
  );
}

export function ExSmnBlind() {
  return (
    <Exercise
      id="cmp.thy.smn.blind"
      title="What does s look at?"
      choices={[
        { label: 'It decodes e, checks that it defines an (m + n)-place function, and builds a new definition from it.', why: 'That would work too, but it is not needed — and checking well-formedness is extra work that s does not have to do.' },
        { label: 'It only does arithmetic on e and the aᵢ: the result is an index of a composition with e as the outer function.', correct: true, why: 'Right. If e is not an (m + n)-place definition, the composition is not well formed either, and both sides of the s-m-n equation are undefined — which ≃ allows.' },
        { label: 'It runs φₑ on the aᵢ first.', why: 'No: s must be total, and φₑ may not halt. It never runs anything.' },
      ]}
    >
      <p>
        In this edition’s construction, how does <Tex tex="s^m_n(e, a_0, \ldots, a_{m-1})" /> treat e?
      </p>
    </Exercise>
  );
}

export function ExPartialDiagonal() {
  return (
    <Exercise
      id="cmp.thy.nou.partial"
      title="The diagonal of the partial Un"
      choices={[
        { label: <>f is not partial computable, so it has no index.</>, why: 'f(x) ≃ Un(x, x) + 1 is a composition of partial computable functions, so it is partial computable and has an index e.' },
        { label: <>f(e) ≃ f(e) + 1, which is impossible — contradiction.</>, why: 'Only if f(e) is defined. ≃ allows both sides to be undefined.' },
        { label: <>f(e) ≃ f(e) + 1, so f(e) is undefined — no contradiction.</>, correct: true, why: 'Yes: Un(e, e) ≃ f(e) ≃ Un(e, e) + 1 forces Un(e, e) to be undefined. The diagonal argument only shows that the universal function cannot be total.' },
      ]}
    >
      <p>
        Let <Tex tex="f(x) \simeq \mathrm{Un}(x, x) + 1" /> and let e be an index of f, so <Tex tex="f(x) \simeq \mathrm{Un}(e, x)" /> for all x. What can you say about{' '}
        <Tex tex="f(e)" />?
      </p>
    </Exercise>
  );
}

export function ExBoundedHalting() {
  return (
    <Exercise
      id="cmp.thy.hlt.bounded"
      title="Halting within N steps"
      choices={[
        { label: 'It is not computable either: it is the halting problem again.', why: 'Running a computation for N calls always finishes, so this relation is decidable.' },
        { label: 'It is computable, and h(e, x) = 1 iff it holds for some N.', correct: true, why: 'Right: h(e, x) = 1 iff ∃N (halts within N calls) — a decidable relation under an unbounded ∃. That makes the halting set c.e., not decidable.' },
        { label: 'It is computable, so h is computable too.', why: 'To compute h you would need to know how large an N to try — and no computable bound exists.' },
      ]}
    >
      <p>What about the relation “the computation of φₑ(x) halts within N calls”, of e, x and N?</p>
    </Exercise>
  );
}

export function ExFiniteCe() {
  return (
    <Exercise
      id="cmp.thy.ces.finite"
      title="Finite sets"
      choices={[
        { label: 'Every finite set is computable, hence c.e.', correct: true, why: 'A finite set {a₀, …, aₖ} has a primitive recursive characteristic function (a finite definition by cases), so it is computable, and computable sets are c.e.' },
        { label: 'Only the empty set, by the definition.', why: 'The definition adds the empty set as a special case because the range of a total function is never empty. Nonempty finite sets are ranges too: f(x) = aᵢ for i = min(x, k).' },
        { label: 'Finite sets can be c.e. but not computable.', why: 'For a finite set you can hard-wire the answer; the difficulty with K is that it is infinite and no finite amount of information settles it.' },
      ]}
    >
      <p>Is every finite set of natural numbers computably enumerable?</p>
    </Exercise>
  );
}

export function ExComplementK() {
  return (
    <Exercise
      id="cmp.thy.cmp.k-bar"
      title="Why not enumerate the complement of K?"
      choices={[
        { label: 'List the e for which φₑ(e) has not halted by stage s.', why: 'At stage s that list contains many e that halt later. An enumeration may never take an element back.' },
        { label: 'If it were c.e., K would be computable — and it is not.', correct: true, why: 'Right: K is c.e.; if its complement were c.e. too, racing the two enumerations would decide K (the theorem of this section).' },
        { label: 'The complement of K is finite.', why: 'Infinitely many e have φₑ(e) undefined — for instance every index that does not code a one-place definition.' },
      ]}
    >
      <p>Why is the complement of K not computably enumerable?</p>
    </Exercise>
  );
}

export function ExCompleteDecidable() {
  return (
    <Exercise
      id="inc.cpi.hal.complete"
      title="Where completeness is used"
      choices={[
        { label: 'To make the enumeration of theorems computable.', why: 'That is what c.e. (or axiomatizable) gives.' },
        { label: 'To guarantee that the search for A or ¬A ends.', correct: true, why: 'Right. Without completeness, for an undecided A neither A nor ¬A ever appears and the search runs forever: the theorems of a c.e. theory are c.e., but need not be decidable.' },
        { label: 'To guarantee that A and ¬A are not both listed.', why: 'That is consistency.' },
      ]}
    >
      <p>
        In the proof that a complete consistent c.e. theory is decidable (search the list of theorems until A or ¬A appears), what is completeness needed for?
      </p>
    </Exercise>
  );
}

export function ExCraig() {
  return (
    <Exercise
      id="inc.cpi.int.craig"
      title="Reading an axiom"
      choices={[
        { label: <><Tex tex="A_3" /></>, why: 'Count the copies: there are three, so which n has n + 1 = 3?' },
        { label: <><Tex tex="A_2" /></>, correct: true, why: 'Three copies: n + 1 = 3, so it must be A₂ for the sentence to be in Γ. Computing one element of the enumeration decides the question.' },
        { label: 'All of them, one after the other', why: 'That would be a search — and the point of the trick is that no search is needed.' },
      ]}
    >
      <p>
        To decide whether <Tex tex="B \land (B \land B)" /> belongs to Craig’s <Tex tex="\Gamma = \{A_0, A_1 \land A_1, A_2 \land (A_2 \land A_2), \ldots\}" /> (B not itself
        such a conjunction), which element of the enumeration must you compare B with?
      </p>
    </Exercise>
  );
}
