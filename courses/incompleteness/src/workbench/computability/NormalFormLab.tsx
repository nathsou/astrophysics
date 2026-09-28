// Section "The Normal Form Theorem": φₑ(x) ≃ U(μs T(e, x, s)), searched literally for the smallest
// computations, and "every partial computable function has infinitely many indices" by padding.

import { useMemo, useState } from 'react';
import { Panel } from '../coding';
import { Prov, NotAProof } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { useStore } from '../../ui/store';
import { computationRecord, describeCodeSize, encodeRecord, recordCodeSize, searchNormalForm, U, type NormalFormSearch } from '../../engine/computability/records';
import { padIndex, runIndex } from '../../engine/computability/smn';
import { decodeIndex } from '../../engine/computability/indices';
import { Big, DefinitionView, IndexPicker, OutcomeCell, indexStore, parseNat } from './shared';

const TINY: { e: bigint; x: bigint; label: string }[] = [
  { e: 0n, x: 0n, label: 'zero(0)' },
  { e: 1n, x: 0n, label: 'succ(0)' },
  { e: 1n, x: 1n, label: 'succ(1)' },
  { e: 2n, x: 3n, label: 'P¹₀(3)' },
  { e: 1n, x: 3n, label: 'succ(3)' },
  { e: 45n, x: 2n, label: 'μz P²₁(z, 2)' },
];

const LIMITS = [1_000n, 10_000n, 100_000n, 300_000n];

export function NormalFormSearchLab() {
  const [eText, setE] = useState('1');
  const [xText, setX] = useState('1');
  const [limit, setLimit] = useState(100_000n);
  const [result, setResult] = useState<{ key: string; r: NormalFormSearch } | null>(null);
  const e = parseNat(eText, 6);
  const x = parseNat(xText, 3);
  const key = `${eText}|${xText}|${limit}`;
  const rec = useMemo(() => (e !== null && x !== null ? computationRecord(e, x, 2000) : null), [e, x]);
  const s = rec?.kind === 'halted' ? encodeRecord(rec.root, 14) : null;
  const r = result?.key === key ? result.r : null;
  return (
    <Panel n={1} title={<>Searching for s: <Tex tex="\mu s\, T(e, x, s)" /></>} prov={<Prov kind="computed" />}>
      <p className="wb-note">
        The normal form computes <Tex tex="\varphi_e(x)" /> by testing <Tex tex="s = 0, 1, 2, \ldots" /> until <Tex tex="T(e, x, s)" /> holds, then reading off{' '}
        <Tex tex="U(s)" />. Codes of records are enormous, so a literal search is only possible for the very smallest computations. Try one:
      </p>
      <div className="seg" role="group" aria-label="small computations">
        {TINY.map((t) => (
          <button
            key={t.label}
            className={`chip-btn ${eText === t.e.toString() && xText === t.x.toString() ? 'current try' : ''}`}
            onClick={() => {
              setE(t.e.toString());
              setX(t.x.toString());
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="ct-controls">
        <label>
          e = <input className={`ct-inline-input ${e === null ? 'invalid' : ''}`} value={eText} onChange={(ev) => setE(ev.target.value)} aria-label="index e" inputMode="numeric" />
        </label>
        <label>
          x = <input className={`ct-inline-input ${x === null ? 'invalid' : ''}`} value={xText} onChange={(ev) => setX(ev.target.value)} aria-label="input x" inputMode="numeric" />
        </label>
        <label>
          test s below{' '}
          <select className="fi-examples" value={limit.toString()} onChange={(ev) => setLimit(BigInt(ev.target.value))} aria-label="search limit">
            {LIMITS.map((l) => (
              <option key={l.toString()} value={l.toString()}>
                {l.toLocaleString('en-US')}
              </option>
            ))}
          </select>
        </label>
        <button className="chip-btn primary" disabled={e === null || x === null} onClick={() => e !== null && x !== null && setResult({ key, r: searchNormalForm(e, x, limit) })}>
          search
        </button>
      </div>
      {(e === null || x === null) && <p className="fi-error">Small numbers only here: e below a million, x below 1000.</p>}
      {rec && (
        <p className="wb-note">
          {rec.kind === 'halted' ? (
            <>
              The record of this computation (found by running it) is{' '}
              {s !== null ? (
                <>
                  s = <Big n={s} />
                </>
              ) : (
                <>a number with {describeCodeSize(recordCodeSize(rec.root)).text}</>
              )}
              .{s !== null && s >= limit && ' It lies beyond the search limit.'}
            </>
          ) : rec.kind === 'notAFunction' ? (
            <>e is not a one-place definition: no s will ever pass the test, and the search never ends.</>
          ) : (
            <>No record within 2000 calls: if the computation never ends, no s passes the test and the search never ends.</>
          )}
        </p>
      )}
      {r && (
        <div aria-live="polite">
          <p>
            Tested {r.tested.toLocaleString('en-US')} candidates; {r.rejectedByIndex.toLocaleString('en-US')} failed at the very first check (the root is a call of the wrong
            definition). {r.found !== null ? <span className="ct-verdict yes">found</span> : <span className="ct-verdict maybe">none below the limit</span>}
          </p>
          <ul className="ct-checks">
            {r.rejected.map((q) => (
              <li key={q.s.toString()}>
                s = {q.s.toString()}: ✗ {q.why}
              </li>
            ))}
            {r.rejected.length > 0 && <li className="muted">…</li>}
            {r.found !== null && (
              <li>
                s = <Big n={r.found} />: ✓ a correct record. <Tex tex={`U(s) = ${U(r.found)}`} />, so <Tex tex={`\\varphi_{${e}}(${x}) = ${U(r.found)}`} />.
              </li>
            )}
          </ul>
          {r.found === null && (
            <p className="wb-note">
              No s below the limit passes. That says nothing about larger s: the search <Tex tex="\mu s" /> itself has no limit, and it runs forever exactly when{' '}
              <Tex tex="\varphi_e(x)" /> is undefined.
            </p>
          )}
        </div>
      )}
      <p className="wb-note">
        <Prov kind="added" /> In this edition’s coding a computation has exactly one record, so the least <Tex tex="s" /> with <Tex tex="T(e, x, s)" /> is simply
        <em> the</em> record. The search needs only one unbounded <Tex tex="\mu" />, however many searches the definition of <Tex tex="\varphi_e" /> itself contains —
        that is the “normal form”.
      </p>
    </Panel>
  );
}

export function PaddingLab() {
  const text = useStore(indexStore);
  const e = parseNat(text);
  const [depth, setDepth] = useState(3);
  const chain = useMemo(() => {
    if (e === null) return [];
    const out = [e];
    for (let i = 0; i < depth; i++) {
      const next = padIndex(out[out.length - 1]);
      if (next.toString().length > 20_000) break;
      out.push(next);
    }
    return out;
  }, [e, depth]);
  const d = useMemo(() => (e === null ? null : decodeIndex(e)), [e]);
  const xs = [0n, 1n, 2n, 3n, 4n];
  return (
    <Panel n={2} title="Infinitely many indices for one function" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        Pad a definition <Tex tex="f" /> with a step that does nothing: <Tex tex="\mathrm{Comp}(P^1_0; f)" /> computes the same function, and its index{' '}
        <Tex tex="3 + 4J(2, J(\#f, 0))" /> is larger. Repeat forever.
      </p>
      <IndexPicker value={text} onChange={indexStore.set} />
      <div className="ct-controls">
        <label>
          padding steps{' '}
          <select className="fi-examples" value={depth} onChange={(ev) => setDepth(Number(ev.target.value))} aria-label="padding steps">
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      {d && !d.ok && <p className="wb-note">This index is not a well-formed definition; padding keeps it ill-formed (and nowhere defined).</p>}
      {d?.ok && d.arity === 1 && (
        <p className="ct-scroll">
          <DefinitionView rf={d.rf} />
        </p>
      )}
      <div className="ct-table-wrap">
        <table className="ct-table">
          <thead>
            <tr>
              <th className="row" scope="col">
                index
              </th>
              {xs.map((x) => (
                <th key={x.toString()} scope="col">
                  x = {x.toString()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chain.map((i, k) => (
              <tr key={k}>
                <th className="row left" scope="row">
                  {k === 0 ? 'e' : `pad${k > 1 ? '⁰¹²³⁴⁵'[k] : ''}(e)`} = <Big n={i} max={24} />
                </th>
                {xs.map((x) => {
                  const o = runIndex(i, [x], 5000);
                  return (
                    <td key={x.toString()}>
                      <OutcomeCell o={o} fuel={5000} compact />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NotAProof>The rows agree on the inputs tried. That they agree everywhere follows from the definition of composition, not from this table.</NotAProof>
    </Panel>
  );
}

export function NormalFormLab() {
  return (
    <div className="workbench">
      <NormalFormSearchLab />
      <PaddingLab />
    </div>
  );
}
