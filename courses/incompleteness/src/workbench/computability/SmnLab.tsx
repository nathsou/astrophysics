// Section "The s-m-n Theorem": s^m_n takes a program e and fixed inputs a⃗ and returns a program
// for the function of the remaining inputs — here by composing constants into the definition.

import { useMemo, useState } from 'react';
import { Panel } from '../coding';
import { NotAProof, Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { decodeIndex } from '../../engine/computability/indices';
import { compareSmn, constIndexN, MAX_SMN_CONSTANT, projIndex } from '../../engine/computability/smn';
import { MULTI_EXAMPLES } from '../../engine/computability/examples';
import { Big, DefinitionView, IndexPicker, OutcomeCell, exampleIndex, parseNat } from './shared';
import { persistedStore, useStore } from '../../ui/store';

const smnIndexStore = persistedStore<string>('ic.cmp.smn.index', exampleIndex(MULTI_EXAMPLES[0]).toString());

function samples(n: number): bigint[][] {
  if (n === 1) return [0n, 1n, 2n, 3n, 5n, 8n].map((y) => [y]);
  if (n === 2)
    return [
      [0n, 0n],
      [1n, 2n],
      [3n, 1n],
      [4n, 4n],
      [2n, 5n],
    ];
  return [Array.from({ length: n }, () => 1n), Array.from({ length: n }, (_, i) => BigInt(i))];
}

export function SmnLab() {
  const text = useStore(smnIndexStore);
  const e = parseNat(text);
  const d = useMemo(() => (e === null ? null : decodeIndex(e)), [e]);
  const arity = d?.ok ? d.arity : 2;
  const [mWanted, setM] = useState(1);
  const m = Math.max(1, Math.min(mWanted, Math.max(1, arity - 1)));
  const n = Math.max(1, arity - m);
  const [aText, setA] = useState<string[]>(['3', '1', '2']);
  const as = aText.slice(0, m).map((t) => {
    const v = parseNat(t, 1);
    return v !== null && v <= BigInt(MAX_SMN_CONSTANT) ? Number(v) : null;
  });
  const ok = e !== null && as.every((a) => a !== null);
  const result = useMemo(() => (ok ? compareSmn(e!, as as number[], n, samples(n), 20_000) : null), [ok, e, as.join(','), n]);
  const newDef = useMemo(() => (result ? decodeIndex(result.index) : null), [result]);
  const ys = Array.from({ length: n }, (_, i) => `y_{${i}}`).join(', ');
  const aTex = (as as number[]).join(', ');

  return (
    <div className="workbench">
      <Panel n={1} title={<>A program e for an (m + n)-place function</>} prov={<Prov kind="computed" />}>
        <IndexPicker value={text} onChange={smnIndexStore.set} examples="multi" id="ct-smn-index" next="multi" />
        {d?.ok ? (
          <>
            <p className="ct-scroll">
              <DefinitionView rf={d.rf} />
            </p>
            <p className="wb-note">A definition of a {d.arity}-place function.</p>
          </>
        ) : (
          d && <p className="wb-note">Not a well-formed definition ({d.errors.join('; ')}). s-m-n still produces a number — see below.</p>
        )}
        <div className="ct-controls">
          {arity > 2 && (
            <label>
              fix the first m ={' '}
              <select className="fi-examples" value={m} onChange={(ev) => setM(Number(ev.target.value))} aria-label="m">
                {Array.from({ length: arity - 1 }, (_, i) => i + 1).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>{' '}
              arguments
            </label>
          )}
          {Array.from({ length: m }, (_, i) => (
            <label key={i}>
              <Tex tex={`a_{${i}} =`} />
              <input
                className={`ct-inline-input ${as[i] === null ? 'invalid' : ''}`}
                value={aText[i] ?? ''}
                onChange={(ev) => setA(aText.map((t, j) => (j === i ? ev.target.value : t)))}
                aria-label={`fixed input a${i}`}
                inputMode="numeric"
              />
            </label>
          ))}
        </div>
        {!as.every((a) => a !== null) && <p className="fi-error">The fixed inputs must be at most {MAX_SMN_CONSTANT} here: the index of the constant function const_a has roughly 4^a bits.</p>}
      </Panel>

      {result && newDef && (
        <Panel n={2} title={<>The program <Tex tex={`s^{${m}}_{${n}}(e, ${aTex})`} /></>} prov={<Prov kind="computed" />}>
          <p className="wb-note">
            <Prov kind="added">this edition’s construction</Prov> Compose the constants into the definition:{' '}
            <Tex tex={`\\mathrm{Comp}(E;\\ ${(as as number[]).map((a) => `c_{${a}}`).join(', ')},\\ ${Array.from({ length: n }, (_, i) => `P^{${n}}_{${i}}`).join(', ')})`} />, where{' '}
            <Tex tex="E" /> is the definition with index e and <Tex tex="c_a" /> is the {n}-place constant function with value a. Its index is computed from e and the aᵢ by
            arithmetic alone:
          </p>
          <p className="ct-scroll">
            <Tex tex={`s^{${m}}_{${n}}(e, ${aTex}) = 3 + 4\\,J\\bigl(e,\\ \\mathrm{list}(${(as as number[]).map((a) => `\\#c_{${a}}`).join(', ')}, ${Array.from({ length: n }, (_, i) => `\\#P^{${n}}_{${i}}`).join(', ')})\\bigr)`} />
          </p>
          <ul className="ct-checks">
            {(as as number[]).map((a, i) => (
              <li key={i}>
                <Tex tex={`\\#c_{${a}}`} /> = <Big n={constIndexN(a, n)} max={30} />
              </li>
            ))}
            {Array.from({ length: n }, (_, i) => (
              <li key={`p${i}`}>
                <Tex tex={`\\#P^{${n}}_{${i}} = ${projIndex(n, i)}`} />
              </li>
            ))}
            <li>
              result: <Big n={result.index} max={30} />
            </li>
          </ul>
          <p className="wb-note">
            Nothing here looks inside e: <Tex tex="s^m_n" /> would transform any number, well-formed or not. That, and the fact that the index of <Tex tex="c_a" /> is
            defined by primitive recursion on a (<Tex tex="\#c_0 = 0" />, <Tex tex="\#c_{a+1} = 3 + 4J(1, J(\#c_a, 0))" />), is why <Tex tex="s^m_n" /> is primitive recursive.
          </p>
          {newDef.ok ? (
            <p className="ct-scroll">
              <span className="sans small muted">Decoded, the new index is the definition </span>
              <DefinitionView rf={newDef.rf} />
            </p>
          ) : (
            <p className="wb-note">Decoded, the new index is not a well-formed definition — as expected when e is not an (m + n)-place definition.</p>
          )}
        </Panel>
      )}

      {result && (
        <Panel n={3} title="Both sides of the equation, on some inputs" prov={<Prov kind="computed" />}>
          <div className="ct-table-wrap">
            <table className="ct-table" aria-live="polite">
              <thead>
                <tr>
                  <th scope="col">
                    <Tex tex={`${ys}`} />
                  </th>
                  <th scope="col">
                    <Tex tex={`\\varphi^{${n}}_{s^{${m}}_{${n}}(e, ${aTex})}(${ys})`} />
                  </th>
                  <th scope="col">
                    <Tex tex={`\\varphi^{${m + n}}_{e}(${aTex}, ${ys})`} />
                  </th>
                  <th scope="col">agree?</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.ys.join(', ')}</td>
                    <td>
                      <OutcomeCell o={r.left} fuel={20_000} />
                    </td>
                    <td>
                      <OutcomeCell o={r.right} fuel={20_000} />
                    </td>
                    <td className="sans">
                      {r.verdict === 'agree' ? '✓ same value' : r.verdict === 'both-not-functions' ? '✓ neither defined' : r.verdict === 'unknown' ? 'no answer yet' : '✗'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NotAProof>
            The two sides agree on these inputs. The theorem says they agree on all inputs — including where both are undefined (<Tex tex="\simeq" />) — and that follows from
            the definition of composition, not from the table.
          </NotAProof>
        </Panel>
      )}
    </div>
  );
}
