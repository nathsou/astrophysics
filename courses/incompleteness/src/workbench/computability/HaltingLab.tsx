// Section "The Halting Problem": the halting table, a bounded "decider" and an index on which it
// is wrong, and the structure of the book's second proof.

import { useMemo, useState } from 'react';
import { Panel } from '../coding';
import { NotAProof, Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { decodeIndex } from '../../engine/computability/indices';
import { boundedDeciderCounterexample } from '../../engine/computability/ce';
import { DefinitionView, indexStore } from './shared';
import { DiagonalLab } from './DiagonalLab';

const BUDGETS = [10, 50, 200, 1000];

export function BoundedDeciderLab() {
  const [N, setN] = useState(50);
  const cex = useMemo(() => boundedDeciderCounterexample(N, 5000, 100_000), [N]);
  const d = cex ? decodeIndex(cex.e) : null;
  return (
    <Panel n={2} title="A test that always answers — and is sometimes wrong" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        <Tex tex="H_N(e, x) = 1" /> if the computation of <Tex tex="\varphi_e(x)" /> halts within N calls, else <Tex tex="0" />. This is a total computable function. As an
        answer to the halting problem it is wrong wherever a computation halts, but only after more than N calls. The engine searches for such an e (on the diagonal, x = e):
      </p>
      <div className="seg" role="radiogroup" aria-label="budget N">
        {BUDGETS.map((b) => (
          <button key={b} role="radio" aria-checked={N === b} className={`chip-btn ${N === b ? 'current try' : ''}`} onClick={() => setN(b)}>
            N = {b}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {cex && d?.ok ? (
          <>
            <p>
              <Tex tex={`H_{${N}}(${cex.e}, ${cex.e}) = 0`} />, but <Tex tex={`\\varphi_{${cex.e}}(${cex.e}) = ${cex.value}`} /> after {cex.calls.toLocaleString('en-US')} calls.{' '}
              <button className="ct-rowbtn" onClick={() => indexStore.set(cex.e.toString())}>
                use e = {cex.e.toString()}
              </button>
            </p>
            <p className="ct-scroll">
              <Tex tex={`\\varphi_{${cex.e}} = `} /> <DefinitionView rf={d.rf} />
            </p>
            <p className="wb-note">
              The computation halts, but it needs {cex.calls.toLocaleString('en-US')} calls, more than {N}. Some such index exists for every N — the
              proof below shows that <Tex tex="H_N" /> must be wrong somewhere.
            </p>
          </>
        ) : (
          <p className="wb-note">No counterexample among the first 5000 indices with this budget.</p>
        )}
      </div>
      <p className="wb-note">
        Answering 1 when unsure fails the other way, on computations that never halt. Cleverer tests (such as the simple divergence checks behind the red cells above) catch
        more cases, but the theorem says that <em>every</em> total computable test is wrong somewhere.
      </p>
      <NotAProof>The engine exhibits one failure of one test. The general statement is the theorem, proved by diagonalization.</NotAProof>
    </Panel>
  );
}

export function HaltingProofSketch() {
  const [c, setC] = useState<'def' | 'undef'>('def');
  return (
    <Panel n={3} title="The second proof, case by case" prov={<Prov kind="added" />}>
      <p className="wb-note">
        Suppose <Tex tex="h" /> were computable. Then so is the partial function <Tex tex="g(x) \simeq 0" /> if <Tex tex="h(x, x) = 0" />, and undefined otherwise. So{' '}
        <Tex tex="g = \varphi_e" /> for some e. Ask whether <Tex tex="g(e)" /> is defined:
      </p>
      <div className="seg" role="radiogroup" aria-label="case">
        <button role="radio" aria-checked={c === 'def'} className={`chip-btn ${c === 'def' ? 'current try' : ''}`} onClick={() => setC('def')}>
          g(e) defined
        </button>
        <button role="radio" aria-checked={c === 'undef'} className={`chip-btn ${c === 'undef' ? 'current try' : ''}`} onClick={() => setC('undef')}>
          g(e) undefined
        </button>
      </div>
      {c === 'def' ? (
        <ol className="ct-steps" aria-live="polite">
          <li>
            <Tex tex="g(e)\downarrow" />, so by the definition of g, <Tex tex="h(e, e) = 0" />.
          </li>
          <li>
            By the definition of h, <Tex tex="\varphi_e(e)\uparrow" />.
          </li>
          <li className="ct-case contra">
            But <Tex tex="g = \varphi_e" />, so <Tex tex="g(e)\uparrow" />. Contradiction.
          </li>
        </ol>
      ) : (
        <ol className="ct-steps" aria-live="polite">
          <li>
            <Tex tex="g(e)\uparrow" />, so <Tex tex="h(e, e) \neq 0" />, i.e. <Tex tex="h(e, e) = 1" /> (h is total).
          </li>
          <li>
            By the definition of h, <Tex tex="\varphi_e(e)\downarrow" />.
          </li>
          <li className="ct-case contra">
            But <Tex tex="g = \varphi_e" />, so <Tex tex="g(e)\downarrow" />. Contradiction.
          </li>
        </ol>
      )}
      <p className="wb-note">
        Run the same argument with <Tex tex="H_N" /> in place of h. Now g is computable and has an index e, and the argument shows exactly where <Tex tex="H_N" /> fails:{' '}
        <Tex tex="H_N(e, e) = 1" /> is impossible (then <Tex tex="g(e)" /> would be undefined although <Tex tex="\varphi_e(e)" /> halted), so{' '}
        <Tex tex="H_N(e, e) = 0" />, so <Tex tex="g(e) = 0" />: <Tex tex="\varphi_e(e)" /> halts, but not within N calls. For a total test there is no contradiction — only a
        wrong answer.
      </p>
    </Panel>
  );
}

export function HaltingLab() {
  return (
    <div className="workbench">
      <DiagonalLab mode="halting" />
      <BoundedDeciderLab />
      <HaltingProofSketch />
    </div>
  );
}
