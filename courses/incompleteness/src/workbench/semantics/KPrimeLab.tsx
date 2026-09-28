// The book's computable model K′ of Q with domain ℕ, side by side with K: the relabeling
// g(0) = a, g(n) = n − 1 turns one into the other. The conditions on g are checked on samples.

import { useMemo, useState } from 'react';
import { MODEL_K, MODEL_K_PRIME, checkMapOnSamples, kPrimeToK, type IElem } from '../../engine/semantics/infinite';
import { NotAProof, Prov } from '../../ui/Prov';
import { Panel } from '../coding';
import './sem.css';

const LA = { constants: [0], functions: [[1, 0], [2, 0], [2, 1]] as [number, number][], predicates: [[2, 0]] as [number, number][] };

export function KPrimeLab() {
  const [n, setN] = useState(12);
  const [which, setWhich] = useState<'g' | 'id'>('g');
  const h = useMemo(() => (which === 'g' ? kPrimeToK : (e: IElem) => e), [which]);
  const samples = useMemo(() => Array.from({ length: n }, (_, i) => BigInt(i)), [n]);
  const res = useMemo(() => checkMapOnSamples(MODEL_K_PRIME, MODEL_K, h, samples, LA), [h, samples]);
  const small = samples.slice(0, 7);
  const op = (i: number) => (x: IElem, y: IElem) => {
    const v = MODEL_K_PRIME.apply(2, i, [x, y]);
    return typeof v === 'object' ? '?' : String(v);
  };
  return (
    <div className="workbench sem-lab">
      <Panel n={1} title="K′: a model of Q whose domain is ℕ" prov={<Prov kind="computed" />}>
        <p className="wb-note">{MODEL_K_PRIME.description}</p>
        <div className="sem-tables">
          <div className="sem-table-box">
            <div className="sem-table-title">
              ′<sup>K′</sup> and g
            </div>
            <div className="sem-scroll">
              <table className="sem-table">
                <tbody>
                  <tr>
                    <th scope="row">x</th>
                    {small.map((x) => (
                      <td key={String(x)}>{String(x)}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">x′ in K′</th>
                    {small.map((x) => (
                      <td key={String(x)} className="sem-val">
                        {String(MODEL_K_PRIME.apply(1, 0, [x]))}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">g(x) in K</th>
                    {small.map((x) => (
                      <td key={String(x)} className="sem-val">
                        {String(kPrimeToK(x))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="sem-table-box">
              <div className="sem-table-title">
                {i === 0 ? '+' : '×'}
                <sup>K′</sup>
              </div>
              <div className="sem-scroll">
                <table className="sem-table">
                  <thead>
                    <tr>
                      <th scope="col">{i === 0 ? '+' : '×'}</th>
                      {small.slice(0, 6).map((y) => (
                        <th key={String(y)} scope="col">
                          {String(y)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {small.slice(0, 6).map((x) => (
                      <tr key={String(x)}>
                        <th scope="row">{String(x)}</th>
                        {small.slice(0, 6).map((y) => (
                          <td key={String(y)} className="sem-val">
                            {op(i)(x, y)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        <p className="wb-note">
          All of these are computable functions of natural numbers, and &lt;<sup>K′</sup> is decidable — but they are not successor, addition and multiplication: 0 plays the role of the non-standard element a, and 0<sup>K′</sup> = 1.
        </p>
      </Panel>
      <Panel n={2} title="Is g an isomorphism from K′ to K?" prov={<Prov kind="computed" />}>
        <div className="seg" role="group" aria-label="The map">
          <button className="chip-btn" aria-pressed={which === 'g'} onClick={() => setWhich('g')}>
            g(0) = a, g(n) = n − 1
          </button>
          <button className="chip-btn" aria-pressed={which === 'id'} onClick={() => setWhich('id')}>
            the identity n ↦ n
          </button>
          <label className="sem-inline">
            check all arguments below
            <input type="number" min={2} max={30} value={n} onChange={(e) => setN(Math.max(2, Math.min(30, Number(e.target.value) || 12)))} />
          </label>
        </div>
        <p className="sem-line" aria-live="polite">
          Conditions (3)–(5) of the definition of isomorphism, for 0, ′, +, × and &lt; on all arguments below {n}: <b>{res.checked.toLocaleString('en-US')} instances checked</b>,{' '}
          {res.failures.length === 0 ? <span className="sem-ok">none fails.</span> : <span className="sem-viol">{res.failures.length} fail, e.g. {res.failures[0].detail}.</span>}
        </p>
        <p className="wb-note">
          The book writes this bijection as g(0) = a and g(n) = n + 1 for n &gt; 0; for the interpretations of K′ given there (0<sup>K′</sup> = 1 plays the role of 0) the map has to send n &gt; 0 to n − 1, which is what is checked here.
        </p>
        <NotAProof>Finitely many instances illustrate the claim; that g is an isomorphism for all arguments follows from the definitions of K′ by a short calculation (try it for + and ×).</NotAProof>
      </Panel>
    </div>
  );
}
