// Exercises for the chapter "Recursive Functions", added for this edition. Numeric answers are
// checked by computing with the engine; multiple-choice answers are explained.

import { evaluate, R } from '../../engine/recursive/rf';
import * as Lib from '../../engine/computability/library';
import { classify, parseNotation, recursions, stage, unfoldRec } from '../../engine/computability/primrec';
import { sameDefinition } from '../../engine/computability/indices';
import type { ReactNode } from 'react';
import { gHierarchy } from '../../engine/computability/ackermann';
import { codeNumber, leaf } from '../../engine/computability/trees';
import { COV_PRESETS, runCourseOfValues } from '../../engine/computability/recursions';
import { Exercise } from '../../ui/Exercise';
import { Tex } from '../../ui/Tex';
import { nextPrime } from './entries';

const digits = (s: string) => s.replace(/[\s,_]/g, '');
const numeric = (want: bigint, right: ReactNode, wrong: ReactNode) => (a: string) => {
  const d = digits(a);
  if (!/^\d+$/.test(d)) return { ok: false, message: 'Write a natural number.' };
  const ok = BigInt(d) === want;
  return { ok, message: ok ? right : wrong };
};

export function ExPreTable() {
  // h(0) = 3, h(y + 1) = h(y) + y, officially h′(x, 0) = const₃(x), h′(x, y + 1) = add(P³₂, P³₁)
  const h = R.rec(Lib.constN(3), R.comp(Lib.add(), [R.proj(3, 2), R.proj(3, 1)]));
  const u = unfoldRec(h, [0n], 4n);
  const want = u.ok ? u.rows[4].value! : 9n;
  return (
    <Exercise
      id="rec.pre.table"
      title="Compute by the equations"
      placeholder="a number"
      check={numeric(want, <>h(1) = 3 + 0, h(2) = 3 + 1, h(3) = 4 + 2, h(4) = 6 + 3 = {String(want)}.</>, 'Compute h(1), h(2), h(3) first; each uses only the one before it.')}
      hint="The second equation adds y — the old argument, not the new one."
    >
      <p>
        Suppose <Tex tex="h(0) = 3" /> and <Tex tex="h(y+1) = h(y) + y" />. What is <Tex tex="h(4)" />?
      </p>
    </Exercise>
  );
}

export function ExPreStep() {
  return (
    <Exercise
      id="rec.pre.exp-step"
      title="Which step function?"
      choices={[
        { label: <Tex tex="g(x, y, z) = x \cdot z" />, correct: true, why: <>Yes: <Tex tex="x^{y+1} = x \cdot x^y" />, and <Tex tex="z" /> is the previous value <Tex tex="x^y" />.</> },
        { label: <Tex tex="g(x, y, z) = z \cdot z" />, why: <>That squares the previous value: it gives <Tex tex="x^{2^y}" /> (with the right base case), not <Tex tex="x^y" />.</> },
        { label: <Tex tex="g(x, y, z) = x \cdot y" />, why: <>This ignores the previous value <Tex tex="z" />: it would make <Tex tex="h(x, y+1) = x \cdot y" />.</> },
      ]}
    >
      <p>
        We want <Tex tex="h(x, y) = x^y" /> by <Tex tex="h(x, 0) = 1" /> and <Tex tex="h(x, y+1) = g(x, y, h(x, y))" />. Which <Tex tex="g" /> works?
      </p>
    </Exercise>
  );
}

export function ExComSwap() {
  return (
    <Exercise
      id="rec.com.swap"
      title="Rearranging arguments"
      choices={[
        { label: <Tex tex="f(P^2_1(x, y), P^2_0(x, y), P^2_0(x, y))" />, correct: true, why: 'Three inner functions (f is 3-place), all 2-place (h is 2-place): y, x, x.' },
        { label: <Tex tex="f(P^2_0(x, y), P^2_1(x, y), P^2_1(x, y))" />, why: <>That is <Tex tex="f(x, y, y)" />: <Tex tex="P^2_0" /> picks the first argument.</> },
        { label: <Tex tex="f(P^3_1(x, y), P^3_0(x, y), P^3_0(x, y))" />, why: <>The inner functions must take as many arguments as <Tex tex="h" />: two, so the projections are <Tex tex="P^2_i" />.</> },
      ]}
    >
      <p>
        <Tex tex="f" /> is 3-place. Which composition defines <Tex tex="h(x, y) = f(y, x, x)" />?
      </p>
    </Exercise>
  );
}

export function ExPrfStage() {
  const want = BigInt(stage(Lib.mult()) ?? 4);
  return (
    <Exercise
      id="rec.prf.stage"
      title="At which stage?"
      placeholder="a number"
      check={numeric(want, <>add is at stage 2, so Comp(add; P³₂, P³₀) is at stage 3 and the recursion at stage {String(want)}.</>, 'Start from add = Rec(P¹₀, Comp(succ; P³₂)), which is at stage 2.')}
      hint="Explore mode shows the stages for mult if you choose it there."
    >
      <p>
        The book’s definition <Tex tex="\mathrm{mult} = \mathrm{Rec}(\mathrm{zero}, \mathrm{Comp}(\mathrm{add}; P^3_2, P^3_0))" />, with <Tex tex="\mathrm{add}" /> as in the
        proof above, is in <Tex tex="S_i" /> for which least <Tex tex="i" />?
      </p>
    </Exercise>
  );
}

export function ExNotMult() {
  const mult = Lib.mult();
  return (
    <Exercise
      id="rec.not.mult"
      title="The complete notation for mult"
      placeholder="Rec_1[…, …]"
      check={(a) => {
        const p = parseNotation(a);
        if (!p.ok) return { ok: false, message: <>Not a notation: {p.error} (at character {p.at + 1}).</> };
        if (p.abbreviations.length) return { ok: false, message: 'Write out add as well: the complete notation uses only zero, succ, projections, Comp and Rec.' };
        if (!classify(p.rf).pr) return { ok: false };
        let agrees = true;
        for (let x = 0n; x <= 4n && agrees; x++)
          for (let y = 0n; y <= 4n && agrees; y++) {
            const r = evaluate(p.rf, [x, y], { fuel: 50_000, maxTraceDepth: -1 });
            if (r.status !== 'ok' || r.value !== x * y) agrees = false;
          }
        if (!agrees) return { ok: false, message: 'That notation is well formed, but it does not compute x · y (tested for x, y ≤ 4).' };
        return {
          ok: true,
          message: sameDefinition(p.rf, mult) ? (
            <>That is exactly the book’s definition.</>
          ) : (
            <>It computes x · y on all 25 pairs with x, y ≤ 4 — a different definition from the book’s, which is fine if you can show it is right everywhere.</>
          ),
        };
      }}
      hint={<>Start from the notation of add in the text, and the equations mult(x, 0) = 0, mult(x, y + 1) = add(mult(x, y), x).</>}
    >
      <p>
        This is the book’s problem. Type the complete primitive recursive notation for <Tex tex="\mathrm{mult}" />, e.g. with <code>Comp_{'{k,n}'}[…]</code>,{' '}
        <code>Rec_k[…]</code>, <code>P^n_i</code>, <code>zero</code>, <code>succ</code>.
      </p>
    </Exercise>
  );
}

export function ExCmpHalts() {
  return (
    <Exercise
      id="rec.cmp.halts"
      title="Why it always stops"
      choices={[
        {
          label: 'The number of steps of a recursion is fixed before it starts: computing h(x⃗, y) takes one computation of f and y of g.',
          correct: true,
          why: 'Yes. By induction on the definition, every computation of a primitive recursive function halts: basic functions at once, compositions and recursions after finitely many halting sub-computations.',
        },
        { label: 'Because the values of primitive recursive functions are small.', why: 'They are not: exp and the functions g_n later in this chapter are primitive recursive and grow very fast.' },
        { label: 'Because the computation searches until it finds the value.', why: 'Searching is exactly what primitive recursion does not do; unbounded search comes later, and it need not stop.' },
      ]}
    >
      <p>Why does the procedure of this section always produce a value?</p>
    </Exercise>
  );
}

export function ExExaRecursions() {
  const want = BigInt(recursions(Lib.fac()));
  return (
    <Exercise
      id="rec.exa.fac-recursions"
      title="Count the recursions"
      placeholder="a number"
      check={numeric(want, <>One for h itself, one inside mult, one inside add: {String(want)}. The constant const₁ needs none.</>, 'Unfold every named part: which of them are defined by primitive recursion?')}
      hint="Explore mode unfolds the definition for you."
    >
      <p>
        How many primitive recursions does the book’s official definition of <Tex tex="\mathrm{fac}" /> contain, once <Tex tex="\mathrm{mult}" />, <Tex tex="\mathrm{add}" /> and{' '}
        <Tex tex="\mathrm{const}_1" /> are written out?
      </p>
    </Exercise>
  );
}

export function ExPrrVacuous() {
  return (
    <Exercise
      id="rec.prr.vacuous"
      title="Quantifying below 0"
      choices={[
        { label: <Tex tex="\chi_P(\vec x, 0) = 1" />, correct: true, why: 'There is no z < 0, so “every z < 0 satisfies R” is (vacuously) true. That is the base case of the recursion.' },
        { label: <Tex tex="\chi_P(\vec x, 0) = 0" />, why: 'That is the base case for the bounded existential quantifier: there is no z < 0 at all, so none satisfies R.' },
        { label: <>it depends on <Tex tex="R" /></>, why: 'With no z below the bound, R is never consulted.' },
      ]}
    >
      <p>
        For <Tex tex="P(\vec x, y) \iff (\forall z < y)\, R(\vec x, z)" />, what is <Tex tex="\chi_P(\vec x, 0)" />?
      </p>
    </Exercise>
  );
}

export function ExBmiNone() {
  let want = 4n;
  for (let z = 0n; z < 4n; z++)
    if (z * z > 20n) {
      want = z;
      break;
    }
  return (
    <Exercise
      id="rec.bmi.none"
      title="When there is no witness"
      placeholder="a number"
      check={numeric(want, <>No z &lt; 4 has z·z &gt; 20, so the bound 4 is returned.</>, 'Check z = 0, 1, 2, 3. What does m_R return when none of them works?')}
    >
      <p>
        What is <Tex tex="(\min z < 4)\,(z \cdot z > 20)" />?
      </p>
    </Exercise>
  );
}

export function ExPriNext() {
  const want = nextPrime(13n);
  return (
    <Exercise id="rec.pri.next" title="The next prime" placeholder="a number" check={numeric(want, <>17. The bound 13! + 1 = 6,227,020,801 is far away.</>, 'The least prime larger than 13.')}>
      <p>
        What is <Tex tex="\mathrm{nextPrime}(13)" />, and would bounded minimization with the bound <Tex tex="13! + 1" /> find it?
      </p>
    </Exercise>
  );
}

export function ExTreCode() {
  const want = codeNumber(leaf(2)) ?? 54n;
  return (
    <Exercise
      id="rec.tre.leaf"
      title="The code of a leaf"
      placeholder="a number"
      check={numeric(want, <>⟨0, 2⟩ = 2⁰⁺¹ · 3²⁺¹ = 2 · 27 = {String(want)}.</>, 'A single node labelled l is coded by ⟨0, l⟩; remember the + 1 in the exponents of a sequence code.')}
    >
      <p>What number codes the tree consisting of a single node labelled 2?</p>
    </Exercise>
  );
}

export function ExOreHistory() {
  const rows = runCourseOfValues(COV_PRESETS[0], 3);
  const want = rows[3].history;
  return (
    <Exercise
      id="rec.ore.history"
      title="The code of a history"
      placeholder="a number"
      check={numeric(want, <>H(3) = ⟨0, 1, 1⟩ = 2¹ · 3² · 5² = {String(want)}.</>, 'The Fibonacci numbers start 0, 1, 1, 2, …; H(3) codes the first three.')}
    >
      <p>
        For the Fibonacci numbers by course-of-values recursion, what is <Tex tex="H(3) = \langle h(0), h(1), h(2)\rangle" /> as a number?
      </p>
    </Exercise>
  );
}

export function ExNprG3() {
  const r = gHierarchy(3, 2);
  const want = r.status === 'ok' ? r.value : 2048n;
  return (
    <Exercise
      id="rec.npr.g3"
      title="One step up the hierarchy"
      placeholder="a number"
      check={numeric(want, <>g₃(2) = g₂(g₂(2)) = g₂(8) = 2⁸ · 8 = {String(want)}.</>, 'g₃(2) applies g₂ twice to 2, and g₂(x) = 2ˣ · x.')}
    >
      <p>
        Using <Tex tex="g_2(x) = 2^x \cdot x" />, compute <Tex tex="g_3(2)" />.
      </p>
    </Exercise>
  );
}

export function ExParStuck() {
  return (
    <Exercise
      id="rec.par.stuck"
      title="An undefined value on the way"
      choices={[
        { label: 'μx f(x) is undefined', correct: true, why: 'The book’s definition requires f(0), …, f(x) all to be defined. The search computes f(0) first and never gets past it.' },
        { label: 'μx f(x) = 1', why: 'f(1) = 0, but the search would have to compute f(0) first — and that computation never ends.' },
        { label: 'μx f(x) = 0', why: 'f(0) is undefined, not 0.' },
      ]}
    >
      <p>
        Suppose <Tex tex="f(0)" /> is undefined and <Tex tex="f(1) = 0" />. What is <Tex tex="\mu x\, f(x)" />?
      </p>
    </Exercise>
  );
}

export function ExNftBudget() {
  return (
    <Exercise
      id="rec.nft.budget"
      title="What a budget can tell"
      choices={[
        { label: <>Nothing about whether <Tex tex="\varphi_e(x)" /> is defined.</>, correct: true, why: 'A longer search might succeed; or none will. T(e, x, s) is decidable for each s, but the search over all s is unbounded.' },
        { label: <><Tex tex="\varphi_e(x)" /> is undefined.</>, why: 'That would need T(e, x, s) to fail for every s, and no finite search checks every s.' },
        { label: <><Tex tex="e" /> is not an index.</>, why: 'Whether e is an index is decided by decoding e, before any search.' },
      ]}
    >
      <p>
        For some <Tex tex="e" /> and <Tex tex="x" />, <Tex tex="T(e, x, s)" /> is false for every <Tex tex="s \le 10^6" />. What follows?
      </p>
    </Exercise>
  );
}

export function ExHltBounded() {
  return (
    <Exercise
      id="rec.hlt.bounded"
      title="Why not the bounded version?"
      choices={[
        {
          label: <>Its diagonal <Tex tex="d_N" /> has an index <Tex tex="e" />; <Tex tex="\varphi_e(e)" /> simply halts after more than <Tex tex="N" /> steps. No contradiction.</>,
          correct: true,
          why: <>Yes. The proof needs <Tex tex="h" /> to be right about <em>every</em> computation; <Tex tex="h_N" /> is only right about the first <Tex tex="N" /> steps, and <Tex tex="d_N" /> escapes by being slow.</>,
        },
        { label: <><Tex tex="h_N" /> is not computable either.</>, why: 'It is: run the computation for N steps and see. This is how the workbench fills in its table.' },
        { label: 'The proof does go through, so h_N is not partial recursive.', why: 'It cannot, since h_N is computable. Look for the step of the proof that fails.' },
      ]}
    >
      <p>
        Let <Tex tex="h_N(e, x) = 1" /> if the computation of <Tex tex="\varphi_e(x)" /> halts within <Tex tex="N" /> steps, <Tex tex="0" /> otherwise. Define{' '}
        <Tex tex="d_N" /> from <Tex tex="h_N" /> as <Tex tex="d" /> is defined from <Tex tex="h" />. Why does the proof of the halting theorem not show that <Tex tex="h_N" /> is not
        partial recursive?
      </p>
    </Exercise>
  );
}

export function ExGenRegular() {
  return (
    <Exercise
      id="rec.gen.regular"
      title="Which is regular?"
      choices={[
        { label: <Tex tex="f(x, z) = z \dot- x" />, correct: true, why: <>For every <Tex tex="z" />, <Tex tex="x = z" /> gives <Tex tex="z \dot- z = 0" />; and <Tex tex="f" /> is total.</> },
        { label: <Tex tex="f(x, z) = 1 \dot- \chi_=(x + x, z)" />, why: <>For odd <Tex tex="z" /> no <Tex tex="x" /> has <Tex tex="x + x = z" />, so <Tex tex="f(x, z) = 1" /> for all <Tex tex="x" />.</> },
        { label: <Tex tex="f(x, z) = z + 1" />, why: 'Never 0.' },
      ]}
    >
      <p>Which of these functions is regular?</p>
    </Exercise>
  );
}
