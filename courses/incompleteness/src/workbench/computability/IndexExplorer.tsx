// Section "Introduction" (computability theory): the enumeration φ₀, φ₁, φ₂, … made concrete.
// An index e is decoded to a definition (this edition's coding, see indices.ts) and run.

import { useMemo, useState } from 'react';
import { Panel } from '../coding';
import { Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { useStore } from '../../ui/store';
import { decodeIndex, enumerateUnary, showDefinition } from '../../engine/computability/indices';
import { FuelControl, IndexPicker, IndexSummary, OutcomeCell, OutcomeLegend, indexStore, parseNat, phiStatus, Big } from './shared';

export function CodingNote() {
  return (
    <p className="wb-note">
      <Prov kind="added">this edition’s coding</Prov> The book leaves the coding of definitions open (any systematic one will do). The indices here code the definitions of the
      recursive-functions chapter — zero, succ, <Tex tex="P^n_i" />, composition, primitive recursion, unbounded search — with the book’s pairing function{' '}
      <Tex tex="J" />, so that <em>every</em> number codes exactly one definition tree: <Tex tex="\#\mathrm{zero} = 0" />, <Tex tex="\#\mathrm{succ} = 1" />,{' '}
      <Tex tex="\#P^n_i = 2 + 4J(i, n{-}1{-}i)" />, <Tex tex="\#\mathrm{Comp} = 3 + 4J(\ldots)" />, <Tex tex="\#\mathrm{Rec} = 4 + 4J(\ldots)" />,{' '}
      <Tex tex="\#\mu = 5 + 4\,\#f" />.
    </p>
  );
}

export function IndexExplorer() {
  const text = useStore(indexStore);
  const e = parseNat(text);
  const [fuel, setFuel] = useState(1000);
  const [cols, setCols] = useState(10);
  const d = useMemo(() => (e === null ? null : decodeIndex(e)), [e]);
  const row = useMemo(() => (e === null ? [] : Array.from({ length: cols }, (_, x) => phiStatus(e, BigInt(x), fuel))), [e, fuel, cols]);
  const firsts = useMemo(() => enumerateUnary({ count: 24, maxIndex: 5000n }), []);
  return (
    <div className="workbench">
      <Panel n={1} title="An index and its definition" prov={<Prov kind="computed" />}>
        <CodingNote />
        <IndexPicker value={text} onChange={indexStore.set} />
        {e !== null && (
          <>
            <p className="sans small">
              e = <Big n={e} />
            </p>
            <IndexSummary e={e} />
          </>
        )}
      </Panel>

      {e !== null && d && (
        <Panel n={2} title={<>The values φ<sub>e</sub>(x)</>} prov={<Prov kind="computed" />}>
          <div className="ct-controls">
            <FuelControl fuel={fuel} setFuel={setFuel} />
            <label>
              inputs 0 …{' '}
              <select value={cols} onChange={(ev) => setCols(Number(ev.target.value))} className="fi-examples" aria-label="number of inputs">
                {[5, 10, 20, 30].map((c) => (
                  <option key={c} value={c}>
                    {c - 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="ct-table-wrap">
            <table className="ct-table" aria-live="polite">
              <thead>
                <tr>
                  <th className="row" scope="col">
                    x
                  </th>
                  {row.map((_, x) => (
                    <th key={x} scope="col">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="row" scope="row">
                    <Tex tex="\varphi_e(x)" />
                  </th>
                  {row.map((o, x) => (
                    <td key={x}>
                      <OutcomeCell o={o} fuel={fuel} compact />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <OutcomeLegend fuel={fuel} />
          <Explain row={row} fuel={fuel} />
        </Panel>
      )}

      <Panel n={3} title="The start of the enumeration" prov={<Prov kind="computed" />}>
        <p className="wb-note">
          The first well-formed one-place definitions, in the order of their indices. Every other index below the last one shown codes a tree that is not a
          one-place definition (so <Tex tex="\varphi_e" /> is nowhere defined for it). Note the repetitions: the constant 0 function appears again and again.
        </p>
        <ul className="ct-stage-list">
          {firsts.map((u) => (
            <li key={u.e.toString()}>
              <button className="ct-rowbtn" onClick={() => indexStore.set(u.e.toString())}>
                φ<sub>{u.e.toString()}</sub>
              </button>{' '}
              <code className="ct-deftext">{showDefinition(u.rf)}</code>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Explain({ row, fuel }: { row: ReturnType<typeof phiStatus>[]; fuel: number }) {
  const counts = { value: 0, undefined: 0, outOfFuel: 0, notAFunction: 0 };
  row.forEach((o) => counts[o.kind]++);
  if (counts.notAFunction) return <p className="wb-note">This index does not code a one-place definition, so there is no computation to run: this is decided from e alone.</p>;
  return (
    <p className="wb-note">
      {counts.value} value{counts.value === 1 ? '' : 's'} computed
      {counts.undefined ? `, ${counts.undefined} certainly undefined (hover for the reason)` : ''}
      {counts.outOfFuel ? `, ${counts.outOfFuel} with no answer within ${fuel} calls — more fuel may produce a value, or the computation may never end; the table cannot tell which` : ''}.
    </p>
  );
}
