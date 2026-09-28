// Exercises added for this edition, with engine-checked answers.

import { Exercise } from '../ui/Exercise';
import { Tex } from '../ui/Tex';
import { parseFormula, tryParseFormula, tryParseTerm } from '../engine/syntax/parse';
import { godel } from '../engine/coding/godel';
import { natEq } from '../engine/numbers/nat';
import { symbolCode, varIndex } from '../engine/syntax/language';
import { freeFor } from '../engine/syntax/subst';
import { termText } from '../engine/syntax/print';
import { functionStore, buildRF } from './objects';
import { arity, evaluate as evalRF } from '../engine/recursive/rf';
import { check } from '../engine/proof/nd';
import { deriveAdd, Q } from '../engine/proof/q';
import { Ref } from '../formal/FormalText';

const digits = (s: string) => s.replace(/[\s,_]/g, '');

export function ExSymbolCode() {
  const want = symbolCode({ k: 'fn', arity: 2, index: 1 });
  return (
    <Exercise
      id="art.cod.times"
      title="A symbol code"
      check={(a) => ({ ok: digits(a) === want.toString(), message: digits(a) === want.toString() ? <>⟨3, 2, 1⟩ = 2⁴ · 3³ · 5² = {want.toString()}.</> : 'Write the code as a number. Which kind of symbol is ×, what is its arity, and what is its index?' })}
      placeholder="a number"
      hint={<>In this edition × is the official symbol <Tex tex="f^2_1" />, whose code is <Tex tex="\langle 3, 2, 1\rangle" />.</>}
    >
      <p>
        What is the symbol code <Tex tex="c_\times" /> of the multiplication symbol?
      </p>
    </Exercise>
  );
}

export function ExCodeVsNumber() {
  const c = symbolCode({ k: 'var', index: 0 });
  return (
    <Exercise
      id="art.cod.code-vs-gn"
      title="Code or Gödel number?"
      choices={[
        { label: <Tex tex={`${c}`} />, why: <>That is the <em>code</em> of the symbol v₀. The term v₀ is a sequence of one symbol, and its Gödel number codes that sequence.</> },
        { label: <Tex tex={`2^{${c} + 1} = ${2n ** (c + 1n)}`} />, correct: true, why: <>The Gödel number of the one-symbol string v₀ is <Tex tex={`\\langle c_{v_0}\\rangle = 2^{c_{v_0}+1}`} />.</> },
        { label: <Tex tex={`2^{${c}}`} />, why: 'Remember the + 1 in the exponents of a sequence code.' },
      ]}
    >
      <p>
        The variable v₀ (displayed <Tex tex="x" />) has code <Tex tex={`c_{v_0} = \\langle 1, 0 \\rangle = 2^2 \\cdot 3 = ${c}`} />. What is the Gödel number of the <em>term</em> v₀?
      </p>
    </Exercise>
  );
}

export function ExDecodeBook() {
  const target = godel(parseFormula('x = 0')).number;
  return (
    <Exercise
      id="art.cod.decode-book"
      title="Read a Gödel number"
      placeholder="a formula, e.g. ∀x x = x"
      check={(a) => {
        const p = tryParseFormula(a);
        if (!p.ok) return { ok: false, message: `That is not a formula: ${p.error}.` };
        const ok = natEq(godel(p.value).number, target) === 'equal';
        return { ok, message: ok ? 'Its six symbols are =, (, v₀, the comma, c₀ and ), with codes 13122, 39366, 12, 354294, 24 and 118098.' : 'That formula has a different Gödel number. Decode the exponents one at a time.' };
      }}
      hint={<>Subtract 1 from each exponent to get the symbol codes, and look them up in the table of symbol codes (<Ref k="inc:art:cod:sec" />).</>}
      solution={<>The formula <Tex tex="v_0 = 0" />, officially <Tex tex="=(v_0, c_0)" /> — the book’s own example.</>}
    >
      <p>
        Which formula has the Gödel number <Tex tex="2^{13123} \cdot 3^{39367} \cdot 5^{13} \cdot 7^{354295} \cdot 11^{25} \cdot 13^{118099}" />?
      </p>
    </Exercise>
  );
}

export function ExNumeralSymbols() {
  return (
    <Exercise
      id="art.trm.numeral-length"
      title="How long is a numeral?"
      placeholder="a number"
      check={(a) => ({ ok: digits(a) === '16', message: digits(a) === '16' ? 'Five copies of ′ and ( , then 0, then five ) : 5·3 + 1 = 16.' : 'Write out ′(′(0)) for 2̄ first, and count.' })}
    >
      <p>
        How many symbols does the numeral <Tex tex="\overline{5}" /> have in official notation (the notation that is coded)?
      </p>
    </Exercise>
  );
}

export function ExNotFreeFor() {
  const A = tryParseFormula('∀y (x = y′ ∨ y = 0)');
  const x = varIndex('x')!;
  return (
    <Exercise
      id="art.sub.not-free-for"
      title="Make a capture happen"
      placeholder="a term, e.g. (z + 1)"
      check={(a) => {
        const t = tryParseTerm(a);
        if (!t.ok) return { ok: false, message: `That is not a term: ${t.error}.` };
        if (!A.ok) return { ok: false };
        const r = freeFor(t.value, x, A.value);
        return { ok: !r.ok, message: r.ok ? <>{termText(t.value)} is free for x here: substituting it captures nothing.</> : <>Yes: the y in {termText(t.value)} would be bound by ∀y.</> };
      }}
      hint="Which variables are bound by a quantifier whose scope contains the free x?"
    >
      <p>
        Give a term that is <b>not</b> free for <Tex tex="x" /> in <Tex tex="\forall y\,(x = y' \lor y = 0)" />.
      </p>
    </Exercise>
  );
}

export function ExSubstOnNumbers() {
  return (
    <Exercise
      id="art.sub.why-pr"
      title="Why does it matter?"
      choices={[
        { label: 'Because it lets us compute substitution faster.', why: 'Speed is not the point; the construction is not efficient at all.' },
        { label: 'Because arithmetic can then talk about substitution: a formula can represent Subst in Q.', correct: true, why: <>Primitive recursive functions are representable in Q. So there are formulas that express “the result of substituting …” — the fixed-point lemma needs exactly that for diag.</> },
        { label: 'Because substitution on formulas is not well defined without numbers.', why: 'Substitution is perfectly well defined on formulas; the question is whether arithmetic can express it.' },
      ]}
    >
      <p>
        <Ref k="inc:art:sub:prop:subst-primrec" /> says substitution becomes a primitive recursive function on Gödel numbers. Why is that important for the incompleteness theorems?
      </p>
    </Exercise>
  );
}

export function ExBuildDouble() {
  return (
    <Exercise
      id="req.build-double"
      title="Build 3x"
      noInput
      check={() => {
        const s = functionStore.get();
        const f = buildRF(s.spec);
        const ar = arity(f);
        if (!ar.ok) return { ok: false, message: 'The definition in the workbench is ill-formed.' };
        if (ar.arity !== 1) return { ok: false, message: `Your function takes ${ar.arity} arguments; it should take one.` };
        for (let n = 0n; n <= 8n; n++) {
          const r = evalRF(f, [n], { fuel: 5000 });
          if (r.value !== 3n * n) return { ok: false, message: <>At {n.toString()} your function gives {r.value?.toString() ?? 'no value'}, not {(3n * n).toString()}.</> };
        }
        return { ok: true, message: <>It agrees with 3x at 0, 1, …, 8. (A finite test: to know it computes 3x everywhere, read your definition — which is exactly what its representing formula does.)</> };
      }}
      hint={<>3x = x + 2x, and 2x is itself a sum. Composition with add, used twice; the projection <Tex tex="P^1_0" /> supplies x wherever it is needed.</>}
    >
      <p>Use the workbench above to build a one-place function equal to 3x from the basic functions and composition, then check it.</p>
    </Exercise>
  );
}

export function ExWhichAxioms() {
  const r = check(deriveAdd(2n, 2n), { axioms: Q() });
  return (
    <Exercise
      id="req.bre.axioms"
      title="Which axioms?"
      choices={[
        { label: 'Q4 and Q5', correct: true, why: <>The generated derivation of <Tex tex="\overline 2 + \overline 2 = \overline 4" /> uses exactly {r.axioms.join(' and ')} — the two recursion equations for +.</> },
        { label: 'Q1 and Q2', why: 'Those are about successor alone; they are what Q uses to prove numerals distinct.' },
        { label: 'Q4, Q5 and induction', why: 'Q has no induction axiom. The induction in the proof of the lemma happens outside Q, in our reasoning about all n and m.' },
      ]}
    >
      <p>
        Which axioms of Q does its derivation of <Tex tex="\overline 2 + \overline 2 = \overline 4" /> use?
      </p>
    </Exercise>
  );
}

export function ExThreeKinds() {
  return (
    <Exercise
      id="inp.fix.kinds"
      title="What can a formula contain?"
      choices={[
        { label: <>the formula <Tex tex="E(x)" /></>, why: 'A formula can contain subformulas, but not as terms: “B(E(x))” is not a formula.' },
        { label: <>the number <Tex tex="\#E(x)\#" /></>, why: 'Numbers are not symbols of the language. A formula can only contain a term that denotes the number.' },
        { label: <>the numeral <Tex tex="\ulcorner E(x)\urcorner" /></>, correct: true, why: 'A numeral is a term, so it can be substituted for a variable. That is how A = E(⌜E(x)⌝) is formed.' },
      ]}
    >
      <p>
        Which of these can be put in place of <Tex tex="x" /> in <Tex tex="E(x)" /> to make a sentence?
      </p>
    </Exercise>
  );
}

export function ExTruthDefinition() {
  return (
    <Exercise
      id="inp.fix.truth"
      title="No truth definition (Problem in the text)"
      choices={[
        { label: <><Tex tex="\mathbf{Q} \vdash A \leftrightarrow \lnot A" />, so Q would be inconsistent.</>, correct: true, why: <>The fixed point of <Tex tex="\lnot T(x)" /> gives <Tex tex="A \leftrightarrow \lnot T(\ulcorner A\urcorner)" />, and the truth definition gives <Tex tex="A \leftrightarrow T(\ulcorner A \urcorner)" />. Together: <Tex tex="A \leftrightarrow \lnot A" />, from which Q derives ⊥. Q is consistent, so there is no such T.</> },
        { label: 'A would be undecidable.', why: 'Stronger: the assumption leads to an outright contradiction.' },
        { label: 'Nothing: T(x) could exist.', why: 'Try B(x) = ¬T(x) in the fixed-point workbench and combine with the truth-definition property.' },
      ]}
    >
      <p>
        Suppose <Tex tex="T(x)" /> were a truth definition: <Tex tex="\mathbf{Q} \vdash B \leftrightarrow T(\ulcorner B \urcorner)" /> for every sentence <Tex tex="B" />. Apply the
        fixed-point lemma to <Tex tex="\lnot T(x)" />. What follows?
      </p>
    </Exercise>
  );
}

export function ExWhereOmega() {
  return (
    <Exercise
      id="inp.1in.omega"
      title="Where is ω-consistency used?"
      choices={[
        { label: <>To show <Tex tex="T \nvdash G_T" /></>, why: <>Plain consistency suffices for that (<Ref k="inc:inp:1in:lem:cons-G-unprov" />). Switch ω-consistency off in the explorer and see.</> },
        { label: <>To show <Tex tex="T \nvdash \lnot G_T" /></>, correct: true, why: 'Only the second lemma needs it: if T derived ¬G_T it would derive ∃x Prf(x, ⌜G_T⌝) while refuting every instance.' },
        { label: 'To construct G_T', why: 'The fixed-point lemma works for any formula, in Q; no consistency is needed to construct G_T.' },
      ]}
    >
      <p>In Gödel’s original proof, which step needs ω-consistency rather than consistency?</p>
    </Exercise>
  );
}

