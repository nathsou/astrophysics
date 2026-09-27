// Exercises for sections 3.6, 4.2–4.4 and 4.8–4.11, with engine-checked answers where possible.

import { Exercise } from '../../ui/Exercise';
import { Tex } from '../../ui/Tex';
import { beta, J } from '../../engine/computability/beta';
import { parseFormula } from '../../engine/syntax/parse';
import { classify } from '../../engine/semantics/standard';
import { lastRule } from '../../engine/coding/derivations';
import { godelNumber } from '../../engine/coding/godel';
import { lit, seqOf } from '../../engine/numbers/nat';

const clean = (s: string) => s.replace(/[\s⟨⟩()]/g, '');

export function ExBetaByHand() {
  const d = J(5n, 2n);
  const want = [beta(d, 0), beta(d, 1)].join(',');
  return (
    <Exercise
      id="req.bet.by-hand"
      title="Decode by hand"
      placeholder="β(d, 0), β(d, 1)"
      check={(a) => {
        const ok = clean(a) === want;
        return { ok, message: ok ? <>Right: <Tex tex="\mathrm{rem}(3, 5) = 2" /> and <Tex tex="\mathrm{rem}(5, 5) = 0" />, so <Tex tex="d" /> codes the sequence 2, 0.</> : <>Use <Tex tex="\beta(d, i) = \mathrm{rem}(1 + (i+1)\,d_1, d_0)" />: the remainder when <Tex tex="d_0 = 5" /> is divided by <Tex tex="1 + (i+1)\cdot 2" />.</> };
      }}
      hint={<>Here <Tex tex="K(d) = 5" /> and <Tex tex="L(d) = 2" />. The moduli are <Tex tex="1 + 1\cdot 2 = 3" /> and <Tex tex="1 + 2\cdot 2 = 5" />.</>}
    >
      <p>
        Let <Tex tex={`d = J(5, 2) = ${d}`} />. Compute <Tex tex="\beta(d, 0)" /> and <Tex tex="\beta(d, 1)" /> (answer as two numbers separated by a comma).
      </p>
    </Exercise>
  );
}

export function ExBetaWhyJ() {
  return (
    <Exercise
      id="req.bet.why-j"
      title="Why j ≥ n?"
      choices={[
        { label: <>So that the moduli are pairwise relatively prime</>, correct: true, why: <>A prime dividing <Tex tex="x_i" /> and <Tex tex="x_k" /> divides <Tex tex="(i - k)\,d_1" /> but not <Tex tex="d_1" />, so it divides <Tex tex="|i - k| \le n" />. Since every number up to <Tex tex="j \ge n" /> divides <Tex tex="d_1" />, the prime would divide <Tex tex="d_1" /> after all — contradiction.</> },
        { label: <>So that each <Tex tex="a_i < x_i" /></>, why: <>That is what the terms <Tex tex="a_i + 1" /> in the maximum are for.</> },
        { label: <>So that <Tex tex="d" /> records the length of the sequence</>, why: <>It does not: <Tex tex="\beta(d, i)" /> for <Tex tex="i > n" /> is just some number, and nothing in <Tex tex="d" /> says where the sequence ends.</> },
      ]}
    >
      <p>
        In the proof of the β-function lemma, <Tex tex="j = \max(n, a_0 + 1, \ldots, a_n + 1)" />. What is the <Tex tex="n" /> in the maximum for?
      </p>
    </Exercise>
  );
}

export function ExPriRegular() {
  return (
    <Exercise
      id="req.pri.regular"
      title="Why is the minimization regular?"
      choices={[
        { label: <>Because the β-function lemma guarantees that some <Tex tex="d" /> codes <Tex tex="h(\vec x, 0), \ldots, h(\vec x, y)" /></>, correct: true, why: <>That <Tex tex="d" /> passes all the tests, so for every <Tex tex="\vec x, y" /> the search terminates: the function being minimized has a zero.</> },
        { label: <>Because <Tex tex="f" /> and <Tex tex="g" /> are total</>, why: <>Totality of <Tex tex="f" /> and <Tex tex="g" /> makes each test defined, but a search can still fail to find anything. What makes it find something is the existence of a code.</> },
        { label: <>Because the least code is the one built in the proof</>, why: <>It usually is not — the workbench shows the least code is often far smaller. Any code will do.</> },
      ]}
    >
      <p>
        In <Tex tex="\hat h(\vec x, y) = \mu d\,(\beta(d, 0) = f(\vec x) \land \forall i < y\ \beta(d, i+1) = g(\vec x, i, \beta(d, i)))" />, why is the minimization regular?
      </p>
    </Exercise>
  );
}

export function ExPndEqIntro() {
  return (
    <Exercise
      id="art.pnd.eqintro"
      title="Assumption or inference?"
      choices={[
        { label: <Tex tex="\langle 0, \#0 = 0\#, 0\rangle" />, why: <>This is the code of the <em>assumption</em> <Tex tex="0 = 0" />, undischarged. An inference also records its rule.</> },
        { label: <Tex tex="\langle 0, \#0 = 0\#, 0, 15\rangle" />, correct: true, why: <>An inference with zero premises: <Tex tex="(d)_0 = 0" />, the end-formula, discharge label 0, and rule number 15 for =Intro. The extra component tells it apart from an assumption.</> },
        { label: <Tex tex="\langle 1, \#0 = 0\#, 0, 15\rangle" />, why: <>The first component counts premises, and =Intro has none.</> },
      ]}
    >
      <p>
        What is the Gödel number of the one-step derivation that infers <Tex tex="0 = 0" /> by =Intro?
      </p>
    </Exercise>
  );
}

export function ExPndLastRule() {
  // ⟨2, d₁, d₂, #A∧B#, 0, 1⟩
  const f = parseFormula('0 = 0 ∧ 0 = 0');
  const a = seqOf([lit(0), godelNumber(parseFormula('0 = 0')), lit(0)]);
  const d = seqOf([lit(2), a, a, godelNumber(f), lit(0), lit(1)]);
  const want = String(lastRule(d));
  return (
    <Exercise
      id="art.pnd.lastrule"
      title="Reading a code"
      placeholder="a number"
      check={(s) => {
        const ok = clean(s) === want;
        return { ok, message: ok ? <>Yes: <Tex tex="(d)_0 = 2" />, so <Tex tex="\mathrm{LastRule}(d) = (d)_{5} = 1" />, which is ∧Intro.</> : <>Count: <Tex tex="(d)_0" /> is the number of premises, and <Tex tex="\mathrm{LastRule}(d) = (d)_{(d)_0 + 3}" />.</> };
      }}
    >
      <p>
        Let <Tex tex="d = \langle 2, d_1, d_2, \#(A \land B)\#, 0, 1\rangle" />. What is <Tex tex="\mathrm{LastRule}(d)" />, the number <Tex tex="(d)_{(d)_0+3}" />?
      </p>
    </Exercise>
  );
}

export function ExS1cClassify() {
  const f = '∃x ∃y (x × y = 6)';
  const level = classify(parseFormula(f)).level;
  return (
    <Exercise
      id="inp.s1c.classify"
      title="Σ1 by the letter"
      choices={[
        { label: 'Δ0', correct: level === 'Δ0', why: 'Its quantifiers are not bounded: neither is of the form ∃x (x < t ∧ …).' },
        { label: 'Σ1', correct: level === 'Σ1', why: <>By the book’s definition a Σ<sub>1</sub> formula is <Tex tex="\exists x\, B(x)" /> with <Tex tex="B" /> Δ<sub>0</sub>. Here <Tex tex="B" /> would be <Tex tex="\exists y\,(x \times y = 6)" />, which is not Δ<sub>0</sub>.</> },
        { label: 'none of Δ0, Σ1, Π1 (literally)', correct: level === 'other', why: <>Right, by the letter of the definition: it has two unbounded ∃ in front. It is <em>equivalent</em> to a Σ<sub>1</sub> sentence (e.g. <Tex tex="\exists z\,\exists x < z\,\exists y < z\,(x \times y = 6)" />), and the Σ Classifier in Explore mode says so.</> },
      ]}
    >
      <p>
        Classify <Tex tex="\exists x\,\exists y\,(x \times y = \overline 6)" /> using the book’s definitions.
      </p>
    </Exercise>
  );
}

export function ExRelNegative() {
  return (
    <Exercise
      id="req.rel.negative"
      title="The negative case"
      choices={[
        { label: <>Clause (b) for <Tex tex="\chi_R" /> and <Tex tex="\mathbf Q \vdash \overline 1 \neq \overline 0" /></>, correct: true, why: <>Clause (b) gives <Tex tex="A_{\chi_R}(\vec{\overline n}, \overline 1) \rightarrow \overline 1 = \overline 0" />, and Q refutes <Tex tex="\overline 1 = \overline 0" />. Explore mode builds exactly this derivation and checks it.</> },
        { label: <>Clause (a) for <Tex tex="\chi_R" /></>, why: <>Clause (a) proves <Tex tex="A_{\chi_R}(\vec{\overline n}, \overline 0)" />; that alone does not rule out <Tex tex="A_{\chi_R}(\vec{\overline n}, \overline 1)" />.</> },
        { label: <>The consistency of Q</>, why: <>Consistency shows Q does not prove both; it does not by itself give a proof of the negation.</> },
      ]}
    >
      <p>
        If <Tex tex="R(n_0, \ldots, n_k)" /> is false, what does the proof use to show <Tex tex="\mathbf Q \vdash \lnot A_R(\overline{n_0}, \ldots, \overline{n_k})" />?
      </p>
    </Exercise>
  );
}

export function ExUndTruth() {
  return (
    <Exercise
      id="req.und.truth"
      title="Where truth comes in"
      choices={[
        { label: <>To conclude that Q does not prove <Tex tex="\exists y\, B_T(\overline e, \overline n, y)" /> when <Tex tex="\varphi_e(n)" /> does not halt</>, correct: true, why: <>If no <Tex tex="s" /> works, Q refutes every instance, and since its axioms are true in <Tex tex="\mathfrak N" /> (so Q is ω-consistent) it cannot prove the existential sentence.</> },
        { label: <>To conclude that Q proves <Tex tex="\exists y\, B_T(\overline e, \overline n, y)" /> when <Tex tex="\varphi_e(n)" /> halts</>, why: <>That direction only needs representability: Q proves <Tex tex="B_T(\overline e, \overline n, \overline s)" /> for the halting computation <Tex tex="s" />, then ∃Intro.</> },
        { label: <>To show that <Tex tex="g(e, n)" /> is primitive recursive</>, why: <>That is pure syntax: substituting numerals into a fixed formula.</> },
      ]}
    >
      <p>In the proof that Q is undecidable, where is it used that the axioms of Q are true in the standard model?</p>
    </Exercise>
  );
}

export function ExRpcPairs() {
  return (
    <Exercise
      id="req.rpc.pairs"
      title="Why one search?"
      choices={[
        { label: <>Minimization searches for a single number, so the pair (derivation, value) is packed into one <Tex tex="s = \langle d, m\rangle" /></>, correct: true, why: <>Searching for <Tex tex="m" /> first would not work — for each <Tex tex="m" /> we would have to wait for a derivation that might not exist. Searching the pairs together, every candidate is checked in finitely many steps.</> },
        { label: <>Because every derivation proves a formula about some <Tex tex="m" /></>, why: 'Most derivations prove something else entirely; they simply fail the test R.' },
        { label: <>To make R primitive recursive</>, why: <><Tex tex="\mathrm{Prf}_{\mathbf Q}" />, <Tex tex="\mathrm{Subst}" /> and <Tex tex="\mathrm{num}" /> are primitive recursive either way; the pairing is about the search.</> },
      ]}
    >
      <p>
        In the proof that representable functions are computable, <Tex tex="f(\vec n) = (\mu s\, R(\vec n, s))_1" />. Why search for <Tex tex="s" /> rather than for <Tex tex="m" /> directly?
      </p>
    </Exercise>
  );
}
