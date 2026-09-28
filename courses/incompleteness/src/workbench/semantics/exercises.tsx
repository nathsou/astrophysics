// Exercises for the semantics chapters, checked by the engine where possible.

import { parseFormula, tryParseFormula } from '../../engine/syntax/parse';
import { freeVars } from '../../engine/syntax/ops';
import { varIndex, varName } from '../../engine/syntax/language';
import * as Ast from '../../engine/syntax/ast';
import { satisfies, trueIn } from '../../engine/semantics/satisfaction';
import { MODEL_K, STANDARD, satisfiesSearch } from '../../engine/semantics/infinite';
import { automorphisms } from '../../engine/semantics/iso';
import { bookSatisfactionProblem } from '../../engine/semantics/examples';
import { assignment } from '../../engine/semantics/assignment';
import { modArithmetic } from '../../engine/semantics/structure';
import { Exercise } from '../../ui/Exercise';
import { Tex } from '../../ui/Tex';

/** The book's problem (a): is M, s ⊨ ∃x (R(f(z), c) → ∀y (R(y, x) ∨ R(f(y), x)))? */
export function ExBookProblemSat() {
  const M = bookSatisfactionProblem();
  const t = satisfies(M, assignment({ x: 1, y: 1, z: 1 }), parseFormula('∃x (R(f(z), c) → ∀y (R(y, x) ∨ R(f(y), x)))'));
  const w = t.quantifier?.witness;
  return (
    <Exercise
      id="sem.sat.book-problem"
      title="The book’s problem (a)"
      choices={[
        { label: 'Yes, M, s ⊨ the formula', correct: t.truth === true, why: t.truth === true ? <>Right: x = {String(w)} is a witness. Since R(f(z), c) is ⟨2, 3⟩ ∈ R, true, the conditional needs ∀y (R(y, x) ∨ R(f(y), x)) for that x. Check it for y = 1, 2, 3 in Explore mode (the structure “The book’s problem”).</> : 'The engine finds no witness.' },
        { label: 'No', correct: t.truth === false, why: t.truth === false ? 'Right: no x-variant satisfies the conditional.' : <>The x-variant s[{String(w)}/x] satisfies it. Try it in Explore mode.</> },
      ]}
    >
      <p>
        In the structure with |M| = {'{'}1, 2, 3{'}'}, c = 3, f(1) = 2, f(2) = 3, f(3) = 2 and the relation {'{'}⟨1,2⟩, ⟨2,3⟩, ⟨3,3⟩{'}'} (the book’s A, written R here), and with s(v) = 1 for every variable: is{' '}
        <Tex tex="\mathfrak M, s \vDash \exists x\,(R(f(z), c) \rightarrow \forall y\,(R(y, x) \lor R(f(y), x)))" />?
      </p>
    </Exercise>
  );
}

export function ExCountVariants() {
  return (
    <Exercise
      id="sem.ass.count"
      title="Counting x-variants"
      check={(a) => ({ ok: a.trim() === '4', message: a.trim() === '4' ? 'One for each element: s[1/x], s[2/x], s[3/x], s[4/x] — and s itself is one of them.' : 'An x-variant may differ from s only at x. How many choices are there for the value of x?' })}
      placeholder="a number"
    >
      <p>
        The domain of M is {'{'}1, 2, 3, 4{'}'} and s assigns 1 to every variable. How many x-variants does s have (counting s itself)?
      </p>
    </Exercise>
  );
}

export function ExFreeVars() {
  const F = '∀x (R(x, y) → ∃y R(y, z))';
  const want = [...freeVars(parseFormula(F))].map(varName).sort();
  return (
    <Exercise
      id="sem.fvs.free"
      title="Free variables"
      placeholder="variables separated by commas, e.g. x, y"
      check={(a) => {
        const got = a.split(/[\s,]+/).filter(Boolean).sort();
        const bad = got.find((v) => varIndex(v) === null);
        if (bad) return { ok: false, message: `${bad} is not a variable.` };
        const ok = got.join(',') === want.join(',');
        return { ok, message: ok ? 'y occurs free in R(x, y) (outside the scope of ∃y); z is never bound. x is bound by ∀x.' : 'Look at each occurrence separately: which quantifier’s scope is it in, and does that quantifier bind that variable?' };
      }}
    >
      <p>
        Which variables occur free in <Tex tex="\forall x\,(R(x, y) \rightarrow \exists y\, R(y, z))" />?
      </p>
    </Exercise>
  );
}

export function ExSentenceOnlySucc() {
  return (
    <Exercise
      id="sem.mdq.succ-sentence"
      title="A sentence about ′ that K gets wrong"
      placeholder="a sentence using only ′ (and =, 0)"
      check={(a) => {
        const p = tryParseFormula(a);
        if (!p.ok) return { ok: false, message: `Not a formula: ${p.error}.` };
        const F = p.value;
        if (freeVars(F).size) return { ok: false, message: 'That formula has free variables; write a sentence.' };
        let other = false;
        Ast.walk(F, (n) => {
          if ((n.k === 'app' && !(n.arity === 1 && n.index === 0)) || n.k === 'pred' || n.k === 'abbr' || (n.k === 'const' && n.index !== 0)) other = true;
        });
        if (other) return { ok: false, message: 'Use only ′ (besides =, 0 and the logical symbols).' };
        const k = satisfiesSearch(MODEL_K, new Map(), F, { limit: 30 });
        const n = satisfiesSearch(STANDARD, new Map(), F, { limit: 60 });
        if (k.truth !== false) return { ok: false, message: k.truth === true ? 'That sentence is true in K.' : `The engine could not refute it in K (${k.reason}). Look for a sentence a counterexample in K refutes.` };
        if (n.truth === false) return { ok: false, message: 'That sentence is false in ℕ as well.' };
        return { ok: true, message: <>It is false in K (the engine found {k.quantifier?.counterexample !== undefined ? `the counterexample ${String(k.quantifier.counterexample)}` : 'a refutation'}); that it is true in ℕ is for you to argue — the search only found no counterexample there.</> };
      }}
      hint="What does ′ do to the non-standard element a?"
      solution={<>For instance ∀x ¬x = x′: in K, a′ = a. (Another: ∀x ∀y (x′ = y → ¬y = x).)</>}
    >
      <p>
        The book asks: find a sentence only involving ′ true in ℕ but false in the model K of Q (Example <em>model-K-of-Q</em>).
      </p>
    </Exercise>
  );
}

export function ExAutomorphismsZ5() {
  const n = automorphisms(modArithmetic(5)).length;
  return (
    <Exercise
      id="sem.iso.autos"
      title="Automorphisms"
      placeholder="a number"
      check={(a) => ({ ok: a.trim() === String(n), message: a.trim() === String(n) ? 'Only the identity: h(0) = 0 because 0 is a constant, and then h(x′) = h(x)′ forces h(1) = 1, h(2) = 2, …' : 'An automorphism must send 0 to 0 and commute with ′. What does that force?' })}
    >
      <p>How many automorphisms does ℤ₅ (0, successor, + and × mod 5, the usual &lt;) have?</p>
    </Exercise>
  );
}

export function ExTheoryComplete() {
  const M = modArithmetic(3);
  const f = parseFormula('∃x (x + x) = 1');
  const t = trueIn(M, f).truth;
  return (
    <Exercise
      id="sem.thm.complete"
      title="Th(ℤ₃) decides every sentence"
      choices={[
        { label: '∃x (x + x) = 1 ∈ Th(ℤ₃)', correct: t === true, why: t === true ? 'Right: 2 + 2 = 4 = 1 mod 3.' : 'Check the addition table.' },
        { label: '¬∃x (x + x) = 1 ∈ Th(ℤ₃)', correct: t === false, why: t === false ? 'Right.' : 'In ℤ₃, 2 + 2 = 1.' },
        { label: 'neither', why: 'For any sentence A, either ℤ₃ ⊨ A or ℤ₃ ⊨ ¬A: Th(M) is always complete.' },
      ]}
    >
      <p>Which of these is in the theory of ℤ₃ (numbers 0, 1, 2 with arithmetic mod 3)?</p>
    </Exercise>
  );
}

export function ExInfFinite() {
  return (
    <Exercise
      id="sem.sol.inf-finite"
      title="Why Inf fails in finite domains"
      choices={[
        { label: 'On a finite set, every injective function is surjective.', correct: true, why: 'Right: an injective u : D → D on a finite D hits |D| distinct values, i.e., all of D. So no y is outside the range, and the second conjunct of Inf fails.' },
        { label: 'There are no functions on a finite set.', why: 'There are |D|^|D| of them; the workbench runs through all of them.' },
        { label: 'Second-order quantifiers only range over infinite sets.', why: 'In the standard semantics ∃u ranges over all functions |M| → |M|, whatever the size of |M|.' },
      ]}
    >
      <p>Why is Inf false in every structure with a finite domain?</p>
    </Exercise>
  );
}

export function ExStandardDomain() {
  return (
    <Exercise
      id="sem.stm.converse"
      title="Every element named, but not standard"
      choices={[
        { label: 'ℤ₅ (arithmetic mod 5)', correct: true, why: 'Right: 0, 0′, 0′′, 0′′′, 0′′′′ name all five elements, but ℤ₅ is finite, so not isomorphic to ℕ. (It is not a model of Q: Q2 fails.)' },
        { label: 'ℤ with the usual operations', why: 'The negative integers are not values of numerals.' },
        { label: 'The model K of Q', why: 'The non-standard element a is not the value of any numeral.' },
      ]}
    >
      <p>The book asks for a structure M with |M| = {'{'}Val<sup>M</sup>(n̄) : n ∈ ℕ{'}'} that is not isomorphic to ℕ. Which of these is one?</p>
    </Exercise>
  );
}
