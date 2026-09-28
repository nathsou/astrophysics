// Representing relations (section "Representing Relations"): A_R(x⃗) = A_χR(x⃗, 1̄), and for the
// chosen numbers a checked derivation of A_R(n̄⃗) (if R holds) or of ¬A_R(n̄⃗) (if not).

import { useMemo, useState } from 'react';
import { check } from '../../engine/proof/nd';
import { Q } from '../../engine/proof/q';
import { deriveRelation } from '../../engine/represent/relations';
import { FormulaView } from '../../ui/FormulaView';
import { ProofDebugger } from '../../ui/ProofDebugger';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { Panel } from '../coding';
import { parseArgList, RELATIONS } from './functions';
import './represent2.css';

export function RelationLab() {
  const [id, setId] = useState('eq');
  const entry = RELATIONS.find((r) => r.id === id)!;
  const [argText, setArgText] = useState(entry.args.join(', '));
  const chi = useMemo(() => entry.build(), [entry]);
  const args = useMemo(() => parseArgList(argText, entry.arity, 6n), [argText, entry]);
  const res = useMemo(() => (typeof args === 'string' ? null : deriveRelation(chi, args)), [chi, args]);
  const chk = useMemo(() => (res && !('error' in res) ? check(res.deriv, { axioms: Q() }) : null), [res]);
  const choose = (i: string) => {
    setId(i);
    setArgText(RELATIONS.find((r) => r.id === i)!.args.join(', '));
  };
  const nums = typeof args === 'string' ? '' : args.map((a) => `\\overline{${a}}`).join(', ');
  return (
    <div className="workbench">
      <Panel n={1} title="A relation and the formula representing it" prov={<Prov kind="computed" />}>
        <div className="seg" role="radiogroup" aria-label="Relation">
          {RELATIONS.map((r) => (
            <button key={r.id} className="chip-btn" role="radio" aria-checked={r.id === id} onClick={() => choose(r.id)}>
              <Tex tex={r.label} />
            </button>
          ))}
        </div>
        <p className="wb-note">
          Its characteristic function is <Tex tex={`\\chi_R(x, y) = ${entry.chi}`} />, built by composition from the basic functions, so the book’s constructions give a formula <Tex tex="A_{\chi_R}(x_0, x_1, y)" /> representing it. The relation is represented by
        </p>
        {res && !('error' in res) && (
          <div className="r2-formula-line">
            <Tex tex="A_R(x_0, x_1) \;\equiv\; A_{\chi_R}(x_0, x_1, \overline 1) \;\equiv\;" /> <FormulaView node={res.formula} />
          </div>
        )}
      </Panel>
      <Panel n={2} title="For particular numbers: a derivation in Q" prov={chk?.valid ? <Prov kind="checked" /> : <Prov kind="computed" />}>
        <div className="r2-row">
          <label>
            <Tex tex="(n_0, n_1) =" />
            <input className={`r2-input ${typeof args === 'string' ? 'invalid' : ''}`} value={argText} onChange={(e) => setArgText(e.target.value)} aria-label="the numbers n0, n1" />
          </label>
        </div>
        {typeof args === 'string' && <p className="r2-err">{args}</p>}
        {res && 'error' in res && <p className="r2-err">{res.error}</p>}
        {res && !('error' in res) && chk && (
          <div aria-live="polite">
            <p className="wb-note">
              <Tex tex={`R(${typeof args === 'string' ? '' : args.join(', ')})`} /> is <b>{res.holds ? 'true' : 'false'}</b>: <Tex tex={`\\chi_R = ${res.chi}`} />.{' '}
              {res.holds ? (
                <>
                  So clause (a) of the representation of <Tex tex="\chi_R" />, with value <Tex tex="\overline 1" />, is already a derivation of <Tex tex={`A_R(${nums})`} />.
                </>
              ) : (
                <>
                  The proof of <Ref k="inc:req:rel:thm:representing-rels" />: clause (b) gives <Tex tex={`\\forall y\\,(A_{\\chi_R}(${nums}, y) \\rightarrow y = \\overline 0)`} />; instantiate with <Tex tex="\overline 1" />; since Q proves <Tex tex="\overline 1 \neq \overline 0" />, it refutes <Tex tex={`A_{\\chi_R}(${nums}, \\overline 1)`} />, that is, <Tex tex={`A_R(${nums})`} />.
                </>
              )}
            </p>
            <ProofDebugger deriv={res.deriv} check={chk} title={<Tex tex={`\\mathbf Q \\vdash ${res.holds ? '' : '\\lnot '}A_R(${nums})`} />} />
          </div>
        )}
        <NotAProof>
          The derivation is generated for these numbers and every inference is checked. <Ref k="inc:req:rel:thm:representing-rels" /> covers all computable relations and all inputs, by the argument in the text.
        </NotAProof>
      </Panel>
    </div>
  );
}
