// The halting problem (section "The Halting Problem"): the diagonal φₑ(e), what a bounded run can
// say about h(e, e), the function d of the proof, and the proof's case analysis for any index e.

import { useMemo, useState } from 'react';
import { haltingDiagonal, unaryIndices, type HaltingRow } from '../../engine/computability/search';
import { Panel } from '../coding';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { fmtBig, FuelControl, OutcomeCell } from './common';

const ROWS = 24;

export function HaltingLab() {
  const [from, setFrom] = useState(0);
  const [onlyUnary, setOnlyUnary] = useState(true);
  const [fuel, setFuel] = useState(1_000);
  const es = useMemo(() => {
    if (!onlyUnary) return Array.from({ length: ROWS }, (_, i) => BigInt(from + i));
    const out: bigint[] = [];
    let start = BigInt(from);
    while (out.length < ROWS && start < BigInt(from) + 200_000n) {
      out.push(...unaryIndices(start, 2000));
      start += 2000n;
    }
    return out.slice(0, ROWS);
  }, [from, onlyUnary]);
  const rows = useMemo(() => haltingDiagonal(es, fuel), [es, fuel]);
  const [sel, setSel] = useState<bigint | null>(null);
  const selRow = rows.find((r) => r.e === sel) ?? rows.find((r) => r.h === 'unknown') ?? rows[0];
  const last = es[es.length - 1] ?? BigInt(from);
  return (
    <div className="workbench">
      <Panel n={1} title={<>The diagonal <Tex tex="\varphi_e(e)" />, run with a budget</>} prov={<Prov kind="computed" />}>
        <p className="wb-note">
          For each index <Tex tex="e" />, run the definition with index <Tex tex="e" /> on its own index. The halting function says whether this halts; a budget of steps can
          only confirm halting, never its absence.
        </p>
        <FuelControl value={fuel} onChange={setFuel} options={[100, 1_000, 20_000]} />
        <div className="rc-row">
          <button className="chip-btn" onClick={() => setFrom(0)} disabled={from === 0}>
            ← from 0
          </button>
          <button className="chip-btn" onClick={() => setFrom(Number(last) + 1)}>
            later →
          </button>
          <label className="rc-field">
            <input type="checkbox" checked={onlyUnary} onChange={(e) => setOnlyUnary(e.target.checked)} /> only indices of unary definitions
          </label>
        </div>
        <ul className="rc-legend">
          <li>
            <Tex tex="h(e, e) = 1" />: halted within the budget
          </li>
          <li>
            <Tex tex="h(e, e) = 0" />: <Tex tex="e" /> is not the index of a unary function
          </li>
          <li>
            <b>?</b>: no answer within {fuel.toLocaleString('en-US')} steps — not known
          </li>
        </ul>
        <div className="rc-scroll">
          <table className="rc-table" aria-label="The diagonal of the halting problem">
            <thead>
              <tr>
                <th scope="col" className="num">
                  e
                </th>
                <th scope="col">definition</th>
                <th scope="col" className="num">
                  <Tex tex="\varphi_e(e)" />
                </th>
                <th scope="col" className="num">
                  <Tex tex="h(e, e)" />
                </th>
                <th scope="col" className="num">
                  <Tex tex="d(e)" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.e)} className={r === selRow ? 'current' : ''}>
                  <td className="num">
                    <button className="rc-rowbtn" aria-pressed={r === selRow} onClick={() => setSel(r.e)} aria-label={`examine index ${r.e}`}>
                      {r.e.toString()}
                    </button>
                  </td>
                  <td className="wrap">{r.definition.ok ? <span className="rc-mono">{r.definition.text}</span> : <span className="rc-na">{r.definition.reason}</span>}</td>
                  <td className="num diag">
                    <OutcomeCell o={r.diag} fuel={fuel} compact />
                  </td>
                  <td className="num">{r.h === 'unknown' ? <span className="rc-unknown">?</span> : r.h}</td>
                  <td className="num">{r.d === 'unknown' ? <span className="rc-unknown">?</span> : r.d === 'undefined' ? <Tex tex="\uparrow" /> : r.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wb-note">
          The function of the proof is <Tex tex="d(y) = 1" /> if <Tex tex="h(y, y) = 0" />, and <Tex tex="d(y) = \mu x\,(x \ne x)" /> — undefined — otherwise. Where the budget
          settles <Tex tex="h(e, e)" />, <Tex tex="d(e)" /> can be filled in; the “?” rows are exactly where computing <Tex tex="d" /> would require solving the halting problem.
        </p>
      </Panel>
      {selRow && <Cases r={selRow} fuel={fuel} />}
    </div>
  );
}

function Cases({ r, fuel }: { r: HaltingRow; fuel: number }) {
  const e = fmtBig(r.e, 24);
  return (
    <Panel n={2} title={<>Could <Tex tex={`e = ${e}`} /> be an index of <Tex tex="d" />?</>} prov={<Prov kind="theorem">the proof’s two cases</Prov>}>
      <p className="wb-note">
        The proof of <Ref k="cmp:rec:hlt:thm:halting-problem" /> considers the value of <Tex tex="h(e, e)" />. Choose a row above to examine another index.
      </p>
      <div className="rc-cases">
        <div className={`rc-case ${r.h === 1 ? 'active' : r.h === 0 ? 'dim' : ''}`}>
          <b>Case <Tex tex="h(e, e) = 1" />.</b> Then <Tex tex="\varphi_e(e)" /> is defined, but <Tex tex="d(e)" /> is undefined. So <Tex tex="\varphi_e" /> and <Tex tex="d" />{' '}
          differ at <Tex tex="e" />.
          {r.h === 1 && r.diag.kind === 'value' && (
            <div className="rc-ok">
              This case holds here: <Tex tex={`\\varphi_{${e}}(${e}) = ${fmtBig(r.diag.value, 20)}`} /> was computed in {r.diag.calls} steps.
            </div>
          )}
        </div>
        <div className={`rc-case ${r.h === 0 ? 'active' : r.h === 1 ? 'dim' : ''}`}>
          <b>Case <Tex tex="h(e, e) = 0" />.</b> Then <Tex tex="e" /> is not an index of a unary function, or it is and <Tex tex="\varphi_e(e)" /> is undefined; but{' '}
          <Tex tex="d(e) = 1" /> is defined. Again they differ at <Tex tex="e" />.
          {r.h === 0 && <div className="rc-ok">This case holds here: {r.definition.ok ? '' : `index ${e} is ${r.definition.reason}.`}</div>}
        </div>
      </div>
      {r.h === 'unknown' ? (
        <p className="wb-note">
          For this index the budget of {fuel.toLocaleString('en-US')} steps does not tell which case holds: <Tex tex={`\\varphi_{${e}}(${e})`} /> may halt later, or never. The proof
          does not need to know. In both cases <Tex tex="e" /> is not an index of <Tex tex="d" /> — and that holds for every <Tex tex="e" />. Since every partial recursive function
          has an index, <Tex tex="d" /> is not partial recursive, so neither is <Tex tex="h" />.
        </p>
      ) : (
        <p className="wb-note">
          Either way <Tex tex="e" /> is not an index of <Tex tex="d" />. The argument is the same for every <Tex tex="e" />; this is why <Tex tex="d" />, and hence <Tex tex="h" />,
          cannot be partial recursive.
        </p>
      )}
      <NotAProof>
        The table is a finite window with a budget. The theorem is the case analysis, which covers every index, including those whose computations no budget could settle.
      </NotAProof>
    </Panel>
  );
}
