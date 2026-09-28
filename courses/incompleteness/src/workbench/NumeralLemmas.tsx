// The lemmas about numerals in Q (Basic Functions are Representable), generated and checked for
// numbers of your choice.

import { useMemo, useState } from 'react';
import { deriveAdd, deriveMult, deriveNeq, Q } from '../engine/proof/q';
import { check } from '../engine/proof/nd';
import { ProofDebugger } from '../ui/ProofDebugger';
import { NotAProof, Prov } from '../ui/Prov';
import { Tex } from '../ui/Tex';
import { Ref } from '../formal/FormalText';
import { Panel } from './coding';

type Which = 'add' | 'mult' | 'neq';

export function NumeralLemmas({ initial = 'add' }: { initial?: Which }) {
  const [which, setWhich] = useState<Which>(initial);
  const [n, setN] = useState(2);
  const [m, setM] = useState(3);
  const d = useMemo(() => {
    if (which === 'neq' && n === m) return null;
    return which === 'add' ? deriveAdd(BigInt(n), BigInt(m)) : which === 'mult' ? deriveMult(BigInt(n), BigInt(m)) : deriveNeq(BigInt(n), BigInt(m));
  }, [which, n, m]);
  const c = useMemo(() => (d ? check(d, { axioms: Q() }) : null), [d]);
  const label = { add: 'inc:req:bre:lem:q-proves-add', mult: 'inc:req:bre:lem:q-proves-mult', neq: 'inc:req:bre:lem:q-proves-neq' }[which];
  const tex = which === 'add' ? `(\\overline{${n}} + \\overline{${m}}) = \\overline{${n + m}}` : which === 'mult' ? `(\\overline{${n}} \\times \\overline{${m}}) = \\overline{${n * m}}` : `\\overline{${n}} \\neq \\overline{${m}}`;
  return (
    <Panel n="★" title="Q’s derivations about numerals" prov={<Prov kind="checked" />}>
      <div className="seg" role="radiogroup" aria-label="Lemma">
        {(['add', 'mult', 'neq'] as Which[]).map((w) => (
          <button key={w} className="chip-btn" role="radio" aria-checked={which === w} onClick={() => setWhich(w)}>
            <Tex tex={w === 'add' ? '(\\overline n + \\overline m) = \\overline{n + m}' : w === 'mult' ? '(\\overline n \\times \\overline m) = \\overline{n \\cdot m}' : '\\overline n \\neq \\overline m'} />
          </button>
        ))}
      </div>
      <div className="nm-inputs sans">
        <label>
          n <input type="number" min={0} max={9} value={n} onChange={(e) => setN(Math.max(0, Math.min(9, Number(e.target.value) || 0)))} />
        </label>
        <label>
          m <input type="number" min={0} max={9} value={m} onChange={(e) => setM(Math.max(0, Math.min(9, Number(e.target.value) || 0)))} />
        </label>
      </div>
      {!d || !c ? (
        <p className="wb-note">For n = m there is nothing to derive: Q derives n̄ = n̄ by =Intro, not its negation.</p>
      ) : (
        <>
          <p>
            <Tex tex={`\\mathbf{Q} \\vdash ${tex}`} /> — an instance of <Ref k={label} />.
          </p>
          <ProofDebugger deriv={d} check={c} title={<Tex tex={tex} />} expanded />
          <NotAProof>
            {which === 'mult' ? (
              <>
                The book leaves this lemma as an exercise; the proof is by induction on m, like the one for +, and it is outside Q, which has no induction. This is the
                derivation such a proof describes, for n = {n} and m = {m}.
              </>
            ) : (
              <>
                The lemma is proved in the text by induction on {which === 'neq' ? 'n' : 'm'} — outside Q, which has no induction. This is the derivation that proof describes, for
                n = {n} and m = {m}.
              </>
            )}
          </NotAProof>
        </>
      )}
    </Panel>
  );
}
