// Appendix A, "Derivations in Arithmetic Theories": the book's derivations, generated for the
// chosen numbers and verified by the checker, shown in the proof debugger.

import { useMemo, useState } from 'react';
import { check } from '../../engine/proof/nd';
import { deriveAdd, num, Q } from '../../engine/proof/q';
import { deriveLessZero, deriveRosserFirstHalf, qUnfolded, ROSSER_MAX } from '../../engine/proof/arith';
import * as Ast from '../../engine/syntax/ast';
import { formulaEq } from '../../engine/syntax/ops';
import { ProofDebugger } from '../../ui/ProofDebugger';
import { NotAProof, Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { Ref } from '../../formal/FormalText';
import { Panel } from '../coding';
import './nd.css';

type Which = 'add' | 'less' | 'rosser';

export function ArithDerivations({ initial = 'add' }: { initial?: Which }) {
  const [which, setWhich] = useState<Which>(initial);
  return (
    <div className="workbench ndb">
      <div className="seg" role="radiogroup" aria-label="Derivation">
        {(
          [
            ['add', 'n̄ + m̄ = n+m (Q)'],
            ['less', '∀x ¬x < 0 (Q)'],
            ['rosser', 'Rosser: RProv(⌜R⌝)'],
          ] as [Which, string][]
        ).map(([w, l]) => (
          <button key={w} type="button" className="chip-btn" role="radio" aria-checked={which === w} aria-pressed={which === w} onClick={() => setWhich(w)}>
            {l}
          </button>
        ))}
      </div>
      {which === 'add' ? <AddPanel /> : which === 'less' ? <LessZeroPanel /> : <RosserPanel />}
    </div>
  );
}

function AddPanel() {
  const [n, setN] = useState(2);
  const [m, setM] = useState(2);
  const d = useMemo(() => deriveAdd(BigInt(n), BigInt(m)), [n, m]);
  const c = useMemo(() => check(d, { axioms: Q() }), [d]);
  const ok = c.valid && formulaEq(d.concl, Ast.eq(Ast.plus(num(n), num(m)), num(n + m)));
  return (
    <Panel n={1} title={<>Q proves addition facts</>} prov={ok ? <Prov kind="checked" /> : <Prov kind="failed" />}>
      <p className="wb-note">
        The proof of <Ref k="inc:req:bre:lem:q-proves-add" /> is an induction on m in the metalanguage. Its base case is one ∀Elim from Q4; its inductive step takes the derivation δ<sub>n,m</sub> and adds
        two ∀Elims from Q5 and one =Elim, “replacing the subterm n̄ + m̄ of the right side (n̄ + m̄)′ by n+m”. Unwinding the induction for particular n and m gives this derivation.
      </p>
      <div className="ndb-row">
        <label>
          n{' '}
          <input className="ndb-input small" type="number" min={0} max={9} value={n} onChange={(e) => setN(Math.max(0, Math.min(9, Number(e.target.value) || 0)))} />
        </label>
        <label>
          m{' '}
          <input className="ndb-input small" type="number" min={0} max={9} value={m} onChange={(e) => setM(Math.max(0, Math.min(9, Number(e.target.value) || 0)))} />
        </label>
      </div>
      <ProofDebugger deriv={d} check={c} title={<Tex tex={`\\mathbf{Q} \\vdash (\\overline{${n}} + \\overline{${m}}) = \\overline{${n + m}}`} />} expanded />
      <NotAProof>
        This is the derivation for n = {n} and m = {m}. The lemma, for all n and m, is proved by the induction in the text — outside Q, which has no induction.
      </NotAProof>
    </Panel>
  );
}

function LessZeroPanel() {
  const d = useMemo(() => deriveLessZero(), []);
  const c = useMemo(() => check(d, { axioms: qUnfolded() }), [d]);
  return (
    <Panel n={1} title={<>Q ⊢ ∀x ¬x &lt; 0</>} prov={c.valid ? <Prov kind="checked" /> : <Prov kind="failed" />}>
      <p className="wb-note">
        The complete derivation of <Ref k="inc:req:min:lem:less-zero" /> from the appendix, assembled from its pieces δ₁ (from Q8), δ₂ (∃Elim with eigenvariable b), δ₃ (the case a = 0), δ₄ and δ₅ (the case
        ∃y a = y′, ∃Elim with eigenvariable c), and the final ∀Intro with eigenvariable a. The book’s double line (from (b′ + 0) = 0 to 0 = (b′ + 0)) is written out as two steps: =Intro and =Elim.
      </p>
      <div className="ndb-note">
        <b>Q8 is written out.</b> Q8 is ∀x ∀y (x &lt; y ↔ ∃z (z′ + x) = y), and the book applies ∧Elim to its instance, “recall that A ↔ B is short for (A → B) ∧ (B → A)”. The checker has rules for the
        primitive connectives only, so here the axiom Q8 is the sentence with ↔ replaced by its definition.
      </div>
      <ProofDebugger deriv={d} check={c} title={<Tex tex="\mathbf{Q} \vdash \forall x\, \lnot x < 0" />} />
      <p className="wb-note">
        This one derivation proves the general statement: it is a derivation of the universal sentence itself, not of an instance. That is what ∀Intro, with its eigenvariable condition, is for.
      </p>
    </Panel>
  );
}

function RosserPanel() {
  const [n, setN] = useState(3);
  const d = useMemo(() => deriveRosserFirstHalf(n), [n]);
  const c = useMemo(() => check(d, { axioms: qUnfolded() }), [d]);
  return (
    <Panel n={1} title={<>Rosser’s theorem: if T ⊢ R then T ⊢ RProv(⌜R⌝)</>} prov={c.valid ? <Prov kind="checked" /> : <Prov kind="failed" />}>
      <p className="wb-note">
        The first half of the proof of <Ref k="inc:inp:ros:thm:rosser" /> in the appendix: if n is the Gödel number of a derivation of R, and no k &lt; n is the Gödel number of a refutation, then
        RProv(⌜R⌝) = ∃x (Prf(x, ⌜R⌝) ∧ ∀z (z &lt; x → ¬Refut(z, ⌜R⌝))) is derivable. The book abbreviates the n cases by “∨Elim*”; here they are written out, all labelled 2 as in the book.
      </p>
      <div className="ndb-row">
        <label>
          n{' '}
          <input className="ndb-input small" type="number" min={1} max={ROSSER_MAX} value={n} onChange={(e) => setN(Math.max(1, Math.min(ROSSER_MAX, Number(e.target.value) || 1)))} />
        </label>
      </div>
      <ProofDebugger
        deriv={d}
        check={c}
        title={<Tex tex="\mathbf{T} \vdash \mathrm{RProv}(\ulcorner R \urcorner)" />}
        hypotheses={{
          δ1: <>δ₁: Prf represents the proof relation of T in Q, and n is the Gödel number of a derivation of R.</>,
          'less-nsucc': (
            <>
              <Ref k="inc:req:min:lem:less-nsucc" /> (for n − 1), used as in the book’s λ₁.
            </>
          ),
          ...Object.fromEntries(Array.from({ length: n }, (_, k) => [`ρ${k}`, <>ρ{k}: Refut represents the refutation relation, and {k} is not the Gödel number of a refutation of R.</>])),
        }}
      />
      <NotAProof>
        The hypotheses are what the proof takes from elsewhere: Prf and Refut are not spelled out, and the numbers are symbolic. The checker verifies that RProv(⌜R⌝) follows from them by the rules, for n = {n}.
        The book’s second half (T ⊬ ¬R, with the derivations λ₂ and λ₃) is not reproduced here.
      </NotAProof>
    </Panel>
  );
}
