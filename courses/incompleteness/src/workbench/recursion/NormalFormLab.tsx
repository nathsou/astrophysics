// The normal form theorem (section "The Normal Form Theorem"), in this edition's terms: an index
// e names a definition; T′(e, x, s) — "the computation of φₑ(x) finishes within s steps" — is
// decidable for each s; a single unbounded search μs T′(e, x, s) finds the answer when there is
// one. And every function has infinitely many indices.

import { useMemo, useState } from 'react';
import { R } from '../../engine/recursive/rf';
import * as Lib from '../../engine/computability/library';
import { decodeIndex, runUnary, showDefinition, type PhiOutcome } from '../../engine/computability/indices';
import { normalFormSearch } from '../../engine/computability/search';
import { safeIndex } from '../../engine/computability/primrec';
import { Panel } from '../coding';
import { Tex } from '../../ui/Tex';
import { Added, Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { DefTree, fmtBig, FuelControl, NumField, OutcomeCell, useRemembered } from './common';

const presetIndex = (f: ReturnType<typeof Lib.add>) => {
  const s = safeIndex(f);
  return s.ok ? s.e.toString() : '0';
};

const PRESETS: { label: string; e: () => string; x: string }[] = [
  { label: 'succ', e: () => '1', x: '4' },
  { label: 'x + 2', e: () => '31', x: '4' },
  { label: 'x + x', e: () => presetIndex(R.comp(Lib.add(), [R.proj(1, 0), R.proj(1, 0)])), x: '6' },
  { label: 'pred', e: () => presetIndex(Lib.pred()), x: '5' },
  { label: 'μx P²₁(x, z)', e: () => '45', x: '3' },
  { label: 'not a unary function', e: () => '4', x: '0' },
];

export function NormalFormLab() {
  const [st, setSt] = useRemembered('nft', { e: '31', x: '4' });
  const [fuel, setFuel] = useState(10_000);
  const e = /^\d{1,60}$/.test(st.e.trim()) ? BigInt(st.e.trim()) : null;
  const x = /^\d+$/.test(st.x.trim()) && BigInt(st.x.trim()) <= 30n ? BigInt(st.x.trim()) : null;
  const nf = useMemo(() => (e !== null && x !== null ? normalFormSearch(e, x, fuel) : null), [e, x, fuel]);
  const dec = useMemo(() => (e !== null ? decodeIndex(e) : null), [e]);
  return (
    <div className="workbench">
      <Panel n={1} title={<>An index <Tex tex="e" /> and an input <Tex tex="x" /></>}>
        <div className="rc-presets" role="group" aria-label="Examples">
          {PRESETS.map((p) => (
            <button key={p.label} className="chip-btn" onClick={() => setSt({ e: p.e(), x: p.x })}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="rc-row">
          <NumField id="nf-e" label={<Tex tex="e =" />} value={st.e} onChange={(v) => setSt({ ...st, e: v })} width={220} hint="an index, up to 60 digits" />
          <NumField id="nf-x" label={<Tex tex="x =" />} value={st.x} onChange={(v) => setSt({ ...st, x: v })} width={60} hint="at most 30" />
          {e === null && <span className="rc-err">an index of at most 60 digits</span>}
          {x === null && <span className="rc-err">x at most 30</span>}
        </div>
        {dec && (dec.ok ? (
          <>
            <p className="wb-note">
              Index <span className="rc-mono">{fmtBig(e!, 30)}</span> decodes to <span className="rc-mono">{showDefinition(dec.rf)}</span>, a {dec.arity}-place definition
              {dec.arity !== 1 && <> — not a unary function, so <Tex tex="\varphi_e" /> is not defined anywhere (and <Tex tex="h(e, x) = 0" />)</>}.
            </p>
            <details>
              <summary className="sans small">its definition tree</summary>
              <DefTree f={dec.rf} />
            </details>
          </>
        ) : (
          <p className="wb-note">
            Index <span className="rc-mono">{fmtBig(e!, 30)}</span> is not a well-formed definition ({dec.errors[0]}): not the index of a partial recursive function.
          </p>
        ))}
        <p className="small sans muted">
          Indices are this edition’s numbering of definitions from zero, succ, projections, composition, primitive recursion and minimization (the book codes computations for the normal form theorem in <Ref k="cmp:thy:cod:sec" />).
        </p>
      </Panel>
      {nf && nf.definition.ok && (
        <Panel n={2} title={<>One unbounded search: <Tex tex="\varphi_e(x) \simeq U'(\mu s\, T'(e, x, s))" /></>} prov={<Prov kind="computed" />}>
          <Added label="This edition’s stand-in for T and U">
            <p className="sans small">
              <Tex tex="T'(e, x, s)" />: “run the definition with index <Tex tex="e" /> on <Tex tex="x" /> for at most <Tex tex="s" /> function calls; it has finished”. For each{' '}
              <Tex tex="s" /> this is decided by a bounded computation, as the book’s <Tex tex="T" /> is (<Tex tex="T" /> checks that <Tex tex="s" /> codes a whole computation
              record). <Tex tex="U'" /> reads off the result. Only the search over <Tex tex="s" /> is unbounded.
            </p>
          </Added>
          <FuelControl value={fuel} onChange={setFuel} options={[1_000, 10_000, 100_000]} label="Search s up to" />
          {nf.leastS !== undefined ? (
            <>
              <div className="rc-scroll">
                <table className="rc-table rc-grid">
                  <tbody>
                    <tr>
                      <th scope="row">s</th>
                      {sWindow(nf.leastS).map((s) => (
                        <td key={s}>{s}</td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">
                        <Tex tex={`T'(e, ${x}, s)`} />
                      </th>
                      {sWindow(nf.leastS).map((s) => (
                        <td key={s} className={s >= nf.leastS! ? 'one' : 'zero'}>
                          {s >= nf.leastS! ? 'yes' : 'no'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="wb-result" aria-live="polite">
                <Tex tex={`\\mu s\\, T'(e, ${x}, s) = ${nf.leastS}`} />, so <Tex tex={`\\varphi_e(${x}) = U'(${nf.leastS}) = ${fmtBig(nf.value!, 30)}`} />
              </p>
            </>
          ) : (
            <p className="wb-result" aria-live="polite">
              <span className="rc-unknown">
                <Tex tex={`T'(e, ${x}, s)`} /> is false for every <Tex tex={`s \\le ${fuel.toLocaleString('en-US')}`} />: no answer within {fuel.toLocaleString('en-US')} steps.
              </span>{' '}
              <span className="small sans muted">A larger s might still work — or none ever will; the search itself cannot tell which.</span>
            </p>
          )}
        </Panel>
      )}
      {dec && dec.ok && dec.arity === 1 && <ManyIndices e={e!} />}
    </div>
  );
}

function sWindow(least: number): number[] {
  const from = Math.max(0, least - 4);
  return Array.from({ length: least + 3 - from }, (_, i) => from + i);
}

function ManyIndices({ e }: { e: bigint }) {
  const rows = useMemo(() => {
    const d = decodeIndex(e);
    if (!d.ok) return [];
    let f = d.rf;
    const out: { text: string; idx: bigint | string; vals: PhiOutcome[] }[] = [];
    for (let i = 0; i < 3; i++) {
      const s = safeIndex(f, 200);
      out.push({
        text: showDefinition(f),
        idx: s.ok ? s.e : `about ${Math.round(s.log10) + 1} digits`,
        vals: Array.from({ length: 5 }, (_, x) => runUnary(f, BigInt(x), 5000)),
      });
      f = R.comp(R.proj(1, 0), [f]);
    }
    return out;
  }, [e]);
  return (
    <Panel n={3} title="Infinitely many indices for the same function" prov={<Prov kind="computed" />}>
      <p className="wb-note">
        Composing with the identity <Tex tex="P^1_0" /> changes the definition, hence the index, but not the function. Repeating this gives infinitely many indices for{' '}
        <Tex tex="\varphi_e" />, as <Ref k="cmp:rec:nft:sec" /> says.
      </p>
      <div className="rc-scroll">
        <table className="rc-table">
          <thead>
            <tr>
              <th scope="col">definition</th>
              <th scope="col" className="num">
                index
              </th>
              {[0, 1, 2, 3, 4].map((x) => (
                <th key={x} scope="col" className="num">
                  φ({x})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="wrap rc-mono">{r.text}</td>
                <td className="num">{typeof r.idx === 'bigint' ? fmtBig(r.idx, 24) : r.idx}</td>
                {r.vals.map((v, x) => (
                  <td key={x} className="num">
                    <OutcomeCell o={v} fuel={5000} compact />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
