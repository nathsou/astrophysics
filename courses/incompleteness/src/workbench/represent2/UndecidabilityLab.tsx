// Undecidability of Q (section "Undecidability"): the reduction of the halting problem to
// provability in Q, with the sentence g(e, n) = #∃y B_T(ē, n̄, y)# computed for chosen e, n, and
// the corollary for first-order logic (the sentence T → A).

import { useMemo, useState } from 'react';
import * as A from '../../engine/syntax/ast';
import type { Formula } from '../../engine/syntax/ast';
import { varIndex } from '../../engine/syntax/language';
import { godelNumber } from '../../engine/coding/godel';
import { num, Q } from '../../engine/proof/q';
import { FormulaView } from '../../ui/FormulaView';
import { NatView } from '../../ui/NatView';
import { Tex } from '../../ui/Tex';
import { Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { Panel } from '../coding';
import './represent2.css';

function haltingSentence(e: bigint, n: bigint): Formula {
  const y = varIndex('y')!;
  const params = [varIndex('x')!, varIndex('y')!, varIndex('z')!];
  return A.exists(A.v(y), A.abbr('B_T', 'B_T', params, [num(e), num(n), A.v(y)]));
}

export function UndecidabilityLab() {
  const [eText, setE] = useState('7');
  const [nText, setN] = useState('3');
  const e = /^\d+$/.test(eText) && eText.length <= 30 ? BigInt(eText) : null;
  const n = /^\d+$/.test(nText) && nText.length <= 30 ? BigInt(nText) : null;
  const sentence = useMemo(() => (e !== null && n !== null ? haltingSentence(e, n) : null), [e, n]);
  const code = useMemo(() => (sentence ? godelNumber(sentence) : null), [sentence]);
  const T = useMemo(() => {
    const axs = [...Q().values()].map((f) => A.cloneFresh(f));
    return axs.slice(1).reduce((acc, f) => A.and(acc, f), axs[0]);
  }, []);
  const fol = useMemo(() => (sentence ? A.imp(A.cloneFresh(T), A.cloneFresh(sentence)) : null), [T, sentence]);
  return (
    <div className="workbench">
      <Panel n={1} title="The reduction" prov={<Prov kind="added" />}>
        <p className="wb-note">If provability in Q were decidable, this procedure would decide the halting problem:</p>
        <div className="r2-flow">
          <div className="r2-flow-box">
            <h4>
              Given <Tex tex="e" /> and <Tex tex="n" />
            </h4>
            compute <Tex tex="g(e, n) = \#\exists y\, B_T(\overline e, \overline n, y)\#" /> — primitive recursive (substitute two numerals into a fixed formula).
          </div>
          <div className="r2-flow-arrow">ask the supposed decision procedure</div>
          <div className="r2-flow-box accent">
            <h4>
              Is <Tex tex="\mathrm{Prov}_{\mathbf Q}(g(e, n))" />?
            </h4>
            By representability (<Tex tex="T" /> is primitive recursive, so Q represents it by <Tex tex="B_T" />) and the truth of Q’s axioms in <Tex tex="\mathfrak N" />:
            <div className="r2-eqs" style={{ marginTop: 6 }}>
              <Tex tex="\mathbf Q \vdash \exists y\, B_T(\overline e, \overline n, y) \iff \text{there is an } s \text{ with } T(e, n, s) \iff \varphi_e(n)\downarrow" />
            </div>
          </div>
          <div className="r2-flow-arrow">answer yes / no</div>
          <div className="r2-flow-box danger">
            <h4>
              <Tex tex="h(e, n)" />: whether <Tex tex="\varphi_e(n)" /> halts
            </h4>
            would be recursive — but it is not (<Ref k="cmp:rec:hlt:thm:halting-problem" />). So <Tex tex="\mathrm{Prov}_{\mathbf Q}" /> is not recursive.
          </div>
        </div>
        <ul className="r2-small sans" style={{ margin: '4px 0', paddingLeft: 20 }}>
          <li>
            <b>⇐</b>: if <Tex tex="T(e, n, s)" />, then Q proves <Tex tex="B_T(\overline e, \overline n, \overline s)" /> (representability), and <Tex tex="\exists y\, B_T(\overline e, \overline n, y)" /> by ∃Intro.
          </li>
          <li>
            <b>⇒</b>: if no <Tex tex="s" /> works, Q proves <Tex tex="\lnot B_T(\overline e, \overline n, \overline s)" /> for <em>every</em> <Tex tex="s" />. That alone does not stop Q from proving the existential sentence; what does is that Q is ω-consistent, because its axioms are true in the standard model.
          </li>
        </ul>
      </Panel>
      <Panel n={2} title="The sentence g(e, n) codes" prov={<Prov kind="computed" />}>
        <div className="r2-row">
          <label>
            <Tex tex="e =" />
            <input className={`r2-input num ${e === null ? 'invalid' : ''}`} value={eText} onChange={(ev) => setE(ev.target.value)} aria-label="program index e" inputMode="numeric" />
          </label>
          <label>
            <Tex tex="n =" />
            <input className={`r2-input num ${n === null ? 'invalid' : ''}`} value={nText} onChange={(ev) => setN(ev.target.value)} aria-label="input n" inputMode="numeric" />
          </label>
        </div>
        {sentence && code && (
          <div aria-live="polite">
            <div className="r2-formula-line">
              <FormulaView node={sentence} />
            </div>
            <p className="wb-note">
              <Tex tex="B_T(x, y, z)" /> is a definite, very long formula (the one the representability theorem builds for Kleene’s <Tex tex="T" />); it is kept by name here, so its Gödel number is known by name only. The Gödel number of the whole sentence:
            </p>
            <NatView n={code} />
            <p className="wb-note">
              Computing this is easy — it is <Tex tex="g(e, n)" />. What is impossible is to decide, uniformly in <Tex tex="e" /> and <Tex tex="n" />, whether Q proves it. Note that this workbench does not (and could not) tell you the answer for your <Tex tex="e, n" />.
            </p>
          </div>
        )}
      </Panel>
      {fol && (
        <Panel n={3} title="First-order logic is undecidable" prov={<Prov kind="computed" />}>
          <p className="wb-note">
            Q has finitely many axioms. Let <Tex tex="T" /> be their conjunction. Then <Tex tex="\mathbf Q \vdash A" /> iff <Tex tex="\vdash T \rightarrow A" /> — so a decision procedure for validity in first-order logic would decide provability in Q. For your <Tex tex="e, n" />, the sentence whose validity would have to be decided is:
          </p>
          <div className="r2-formula-line">
            <FormulaView node={fol} />
          </div>
        </Panel>
      )}
    </div>
  );
}
