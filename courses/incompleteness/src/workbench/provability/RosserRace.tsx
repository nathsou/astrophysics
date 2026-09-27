// Rosser's trick as a race between the first proof and the first refutation (section 5.4).

import { useState } from 'react';
import { analyseRosser } from '../../engine/provability/rosser';
import { Tex } from '../../ui/Tex';
import { Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import './provability.css';

const N = 12;

export function RosserRace() {
  const [proof, setProof] = useState<number | null>(null);
  const [refutation, setRefutation] = useState<number | null>(null);
  const a = analyseRosser({ proof, refutation });
  const cell = (k: number) => {
    const p = proof === k;
    const r = refutation === k;
    return p ? 'R' : r ? '¬R' : '';
  };
  const pick = (k: number) => {
    // Cycle a cell: nothing → derivation of R → derivation of ¬R → nothing.
    if (proof === k) {
      setProof(null);
      setRefutation(k);
    } else if (refutation === k) setRefutation(null);
    else if (proof === null) setProof(k);
    else if (refutation === null) setRefutation(k);
    else setProof(k);
  };
  return (
    <div className="workbench pv rr">
      <p className="wb-note">
        <Prov kind="added">toy model</Prov> Imagine listing all T-derivations by their Gödel numbers. For the Rosser sentence <Tex tex="R" /> only two things matter: the least code{' '}
        <Tex tex="n" /> of a derivation of <Tex tex="R" />, and the least code <Tex tex="m" /> of a derivation of <Tex tex="\lnot R" />. Click cells to place them (click again to switch
        or clear). The small codes stand in for real Gödel numbers, which are astronomically large.
      </p>
      <div className="rr-track" role="group" aria-label="Derivation codes">
        {Array.from({ length: N }, (_, k) => (
          <button key={k} className={`rr-cell ${proof === k ? 'proof' : ''} ${refutation === k ? 'refut' : ''}`} onClick={() => pick(k)} aria-label={`code ${k}: ${proof === k ? 'derivation of R' : refutation === k ? 'derivation of not R' : 'nothing relevant'}`}>
            <span className="rr-k">{k}</span>
            <span className="rr-what">{cell(k)}</span>
          </button>
        ))}
        <span className="rr-more" aria-hidden>
          …
        </span>
      </div>
      <div className="fi-row">
        <button className="chip-btn" onClick={() => { setProof(null); setRefutation(null); }}>
          Clear
        </button>
      </div>
      <table className="rr-table">
        <tbody>
          <tr>
            <th scope="row">
              <Tex tex="\mathfrak N \vDash \mathsf{Prov}_T(\ulcorner R \urcorner)" />
            </th>
            <td className={a.prov ? 'yes' : 'no'}>{a.prov ? 'true' : 'false'}</td>
            <td>some code derives R</td>
          </tr>
          <tr>
            <th scope="row">
              <Tex tex="\mathfrak N \vDash \mathsf{RProv}_T(\ulcorner R \urcorner)" />
            </th>
            <td className={a.rprov ? 'yes' : 'no'}>{a.rprov ? 'true' : 'false'}</td>
            <td>some code derives R and no smaller code derives ¬R</td>
          </tr>
          <tr>
            <th scope="row">
              <Tex tex="\mathfrak N \vDash R" />
            </th>
            <td className={a.rTrue ? 'yes' : 'no'}>{a.rTrue ? 'true' : 'false'}</td>
            <td>
              since <Tex tex="R \leftrightarrow \lnot\mathsf{RProv}_T(\ulcorner R\urcorner)" /> is derivable in Q, hence true
            </td>
          </tr>
        </tbody>
      </table>
      <div className={`pv-verdict ${a.verdict === 'independent' ? 'ok' : 'bad'}`} aria-live="polite">
        {a.verdict === 'independent' && (
          <>
            Neither R nor ¬R is derivable: the situation <Ref k="inc:inp:ros:thm:rosser" /> says a consistent T must be in. R is true but not derivable.
          </>
        )}
        {a.verdict === 'first-half' && (
          <>
            Impossible for consistent T (first half of the proof): Q derives <Tex tex={`\\mathsf{Prf}_T(\\overline{${proof}}, \\ulcorner R\\urcorner)`} /> and, for every <Tex tex={`k < ${proof}`} />,{' '}
            <Tex tex={`\\lnot\\mathsf{Ref}_T(\\overline{k}, \\ulcorner R\\urcorner)`} />; so Q ⊢ RProv(⌜R⌝), so Q ⊢ ¬R, so T ⊢ ¬R — a refutation would exist after all.
          </>
        )}
        {a.verdict === 'second-half' && (
          <>
            Impossible for consistent T (second half): Q derives <Tex tex={`\\mathsf{Ref}_T(\\overline{${refutation}}, \\ulcorner R\\urcorner)`} />, and any x with{' '}
            <Tex tex="\mathsf{Prf}_T(x, \ulcorner R\urcorner)" /> must differ from 0, …, {refutation}, so it has a smaller refutation. Hence Q ⊢ ¬RProv(⌜R⌝), so T ⊢ R — a proof would
            exist after all. Unlike Gödel’s argument, no ω-consistency is needed.
          </>
        )}
        {a.verdict === 'inconsistent' && (
          <>
            T is inconsistent (it derives R and ¬R). Now Prov and RProv come apart: <Tex tex="\mathsf{Prov}_T(\ulcorner R\urcorner)" /> is true, but{' '}
            <Tex tex="\mathsf{RProv}_T(\ulcorner R\urcorner)" /> is true only if the proof comes first ({a.rprov ? 'it does here' : 'it does not here'}). “Rosser provable” is not a kind of
            provability.
          </>
        )}
      </div>
    </div>
  );
}
