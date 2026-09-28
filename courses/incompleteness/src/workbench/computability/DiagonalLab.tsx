// The table of Un(e, x) = φₑ(x) (section "The Universal Partial Computable Function"), the diagonal
// argument against a total universal function ("No Universal Computable Function"), and the
// halting function h(e, x) ("The Halting Problem") — with every cell computed with a budget.

import { useMemo, useState } from 'react';
import { Panel } from '../coding';
import { NotAProof, Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { enumerateUnary, phi, showDefinition, termOf } from '../../engine/computability/indices';
import { UNARY_EXAMPLES } from '../../engine/computability/examples';
import { exampleIndex, Big, FuelControl, OutcomeCell, OutcomeLegend, indexStore, phiStatus, type Status } from './shared';

type Mode = 'universal' | 'nou' | 'halting';

interface Row {
  e: bigint;
  label: string;
  cells: Status[];
}

function useTable(rowsKind: 'indices' | 'unary', start: number, rows: number, cols: number, fuel: number): Row[] {
  return useMemo(() => {
    const es =
      rowsKind === 'unary'
        ? enumerateUnary({ from: BigInt(start), count: rows, maxIndex: BigInt(start) + 50_000n }).map((u) => u.e)
        : Array.from({ length: rows }, (_, i) => BigInt(start + i));
    return es.map((e) => ({ e, label: showDefinition(termOf(e)), cells: Array.from({ length: cols }, (_, x) => phiStatus(e, BigInt(x), fuel)) }));
  }, [rowsKind, start, rows, cols, fuel]);
}

function TableControls(p: {
  rowsKind: 'indices' | 'unary';
  setRowsKind: (k: 'indices' | 'unary') => void;
  start: number;
  setStart: (n: number) => void;
  size: number;
  setSize: (n: number) => void;
  fuel: number;
  setFuel: (n: number) => void;
  fuelLabel?: string;
}) {
  return (
    <div className="ct-controls">
      <div className="seg" role="radiogroup" aria-label="which rows">
        <button role="radio" aria-checked={p.rowsKind === 'indices'} className={`chip-btn ${p.rowsKind === 'indices' ? 'current try' : ''}`} onClick={() => p.setRowsKind('indices')}>
          every index
        </button>
        <button role="radio" aria-checked={p.rowsKind === 'unary'} className={`chip-btn ${p.rowsKind === 'unary' ? 'current try' : ''}`} onClick={() => p.setRowsKind('unary')}>
          one-place definitions only
        </button>
      </div>
      <label>
        from index{' '}
        <input
          className="ct-inline-input"
          value={p.start}
          onChange={(ev) => {
            const v = Number(ev.target.value.replace(/\D/g, '') || '0');
            p.setStart(Math.min(10_000_000, v));
          }}
          inputMode="numeric"
          aria-label="first index"
        />
      </label>
      <label>
        size{' '}
        <select className="fi-examples" value={p.size} onChange={(ev) => p.setSize(Number(ev.target.value))} aria-label="table size">
          {[6, 8, 12, 16].map((n) => (
            <option key={n} value={n}>
              {n} × {n}
            </option>
          ))}
        </select>
      </label>
      <FuelControl fuel={p.fuel} setFuel={p.setFuel} max={10_000} />
    </div>
  );
}

function RowHead({ row }: { row: Row }) {
  return (
    <th className="row" scope="row" title={row.label}>
      <button className="ct-rowbtn" onClick={() => indexStore.set(row.e.toString())} title={`${row.label} — make this the chapter's index e`}>
        φ<sub>{row.e.toString()}</sub>
      </button>
    </th>
  );
}

/** Un′_N(e, x): φₑ(x) if it halts within N calls, and 0 otherwise — total and computable. */
function bounded(o: Status): { v: bigint; byDefault: boolean } {
  return o.kind === 'value' ? { v: o.value, byDefault: false } : { v: 0n, byDefault: true };
}

export function DiagonalLab({ mode }: { mode: Mode }) {
  const [rowsKind, setRowsKind] = useState<'indices' | 'unary'>(mode === 'universal' ? 'indices' : 'unary');
  const [start, setStart] = useState(mode === 'halting' ? 40 : 0);
  const [size, setSize] = useState(8);
  const [fuel, setFuel] = useState(mode === 'nou' ? 30 : 1000);
  const table = useTable(rowsKind, start, size, size, fuel);
  const diagonal = mode !== 'universal';

  // nou: cells where Un′_N said 0 by default, but more fuel gives a different value — first in
  // the table shown, then among the first few hundred one-place definitions
  const missed = useMemo(() => {
    if (mode !== 'nou') return [];
    const out: { e: bigint; x: number; v: bigint; shown: boolean }[] = [];
    const tryCell = (e: bigint, x: number, shown: boolean) => {
      if (out.length >= 3 || out.some((m) => m.e === e)) return;
      const o0 = phi(e, BigInt(x), fuel);
      if (o0.kind !== 'outOfFuel') return;
      const o = phi(e, BigInt(x), fuel * 50);
      if (o.kind === 'value' && o.value !== 0n) out.push({ e, x, v: o.value, shown });
    };
    for (const r of table) r.cells.forEach((_, x) => tryCell(r.e, x, true));
    // Small indices code tiny definitions that either finish fast or never; the chapter's
    // examples (with large indices) need more calls as the input grows.
    for (const ex of UNARY_EXAMPLES) {
      if (out.length >= 3) break;
      for (let x = 0; x < 16 && out.length < 3; x++) tryCell(exampleIndex(ex), x, false);
    }
    return out;
  }, [mode, table, fuel]);

  const title = mode === 'universal' ? <>The table of Un(e, x) = φ<sub>e</sub>(x)</> : mode === 'nou' ? <>A total candidate Un′ and its diagonal</> : <>The halting function h(e, x)</>;
  const cellOf = (o: Status) => {
    if (mode === 'nou') {
      const b = bounded(o);
      return (
        <span className={`ct-o ${b.byDefault ? 'fuel' : 'value'}`} title={b.byDefault ? 'no answer within the budget (or not a function): Un′ says 0 by default' : undefined}>
          {b.v.toString()}
          {b.byDefault ? '*' : ''}
        </span>
      );
    }
    if (mode === 'halting') {
      if (o.kind === 'value') return <span className="ct-o value" title="halted: h = 1">1</span>;
      if (o.kind === 'outOfFuel') return <span className="ct-o fuel" title={`no answer within ${fuel} calls: h(e, x) is not known`}>?</span>;
      return (
        <span className="ct-o undef" title={o.kind === 'undefined' ? `undefined: ${o.reason}` : 'not a one-place definition: nothing ever halts'}>
          0
        </span>
      );
    }
    return <OutcomeCell o={o} fuel={fuel} compact />;
  };

  return (
    <Panel n={1} title={title} prov={<Prov kind="computed" />}>
      {mode === 'nou' && (
        <p className="wb-note">
          <Prov kind="added" /> Here is a total computable function that tries to be universal: <Tex tex="\mathrm{Un}'_N(e, x) = \varphi_e(x)" /> if that computation halts within
          N calls, and <Tex tex="0" /> otherwise (marked *). The budget below is N. Its diagonal gives <Tex tex="d(x) = \mathrm{Un}'_N(x, x) + 1" />.
        </p>
      )}
      {mode === 'halting' && (
        <p className="wb-note">
          <Tex tex="h(e, x) = 1" /> if <Tex tex="\varphi_e(x)" /> is defined and <Tex tex="0" /> otherwise. Each cell shows what running for the budget establishes: 1 (it halted), 0
          (certainly undefined — hover for the reason) or ? (no answer yet).
        </p>
      )}
      <TableControls rowsKind={rowsKind} setRowsKind={setRowsKind} start={start} setStart={setStart} size={size} setSize={setSize} fuel={fuel} setFuel={setFuel} />
      <div className="ct-table-wrap">
        <table className="ct-table">
          <thead>
            <tr>
              <th className="row" scope="col">
                {mode === 'nou' ? <Tex tex="\mathrm{Un}'_N(e,x)" /> : mode === 'halting' ? <Tex tex="h(e,x)" /> : <Tex tex="\varphi_e(x)" />}
              </th>
              {Array.from({ length: size }, (_, x) => (
                <th key={x} scope="col">
                  x={x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={r.e.toString()}>
                <RowHead row={r} />
                {r.cells.map((c, x) => (
                  <td key={x} className={diagonal && x === i ? 'diag' : ''}>
                    {cellOf(c)}
                  </td>
                ))}
              </tr>
            ))}
            {mode === 'nou' && (
              <tr className="ct-drow">
                <th className="row" scope="row">
                  d(x)
                </th>
                {Array.from({ length: size }, (_, x) => {
                  const r = table[x];
                  if (!r) return <td key={x} />;
                  const b = bounded(r.cells[x]);
                  return (
                    <td key={x} title={`row ${x} (φ_${r.e}) has ${b.v} at x = ${x}; d has ${b.v + 1n}`}>
                      <span className="ct-o value">{(b.v + 1n).toString()}</span>
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {mode === 'nou' ? (
        <p className="ct-legend">* no answer within N calls (or not a function): the candidate answers 0. Highlighted: the diagonal, row x at argument x.</p>
      ) : mode === 'universal' ? (
        <OutcomeLegend fuel={fuel} />
      ) : null}
      {mode === 'universal' && (
        <p className="wb-note">
          Row e is the function <Tex tex="\varphi_e" />; the rows list every partial computable function (many times over). Each cell was computed by one and the same
          program, which decodes e and runs the definition on x — the idea of the universal function. (The engine’s program is TypeScript; the theorem says that such a
          program also exists as a partial recursive definition.)
        </p>
      )}
      {mode === 'nou' && (
        <>
          <p className="wb-note">
            <Tex tex="d" /> differs from row x at argument x, for every x in the table (and beyond it, by definition). <Tex tex="d" /> is total and computable. So if{' '}
            <Tex tex="\mathrm{Un}'_N" /> listed <em>every</em> total computable function as one of its rows, <Tex tex="d" /> would be some row k and would have to differ from
            itself at k. The only way out: <Tex tex="\mathrm{Un}'_N" /> is not universal. Indeed, where it answered 0 by default it can be wrong:
          </p>
          {missed.length ? (
            <ul className="ct-checks">
              {missed.map((m) => (
                <li key={`${m.e}-${m.x}`}>
                  {m.shown ? (
                    <>
                      <Tex tex={`\\mathrm{Un}'_N(${m.e}, ${m.x}) = 0`} />, but with {fuel * 50} calls <Tex tex={`\\varphi_{${m.e}}(${m.x}) = ${m.v}`} />.
                    </>
                  ) : (
                    <>
                      <Tex tex={`\\mathrm{Un}'_N(e, ${m.x}) = 0`} />, but with {fuel * 50} calls <Tex tex={`\\varphi_e(${m.x}) = ${m.v}`} />, for the index e = <Big n={m.e} max={16} /> of{' '}
                      {UNARY_EXAMPLES.find((u) => exampleIndex(u) === m.e)?.label ?? 'a definition'} (not in the part of the table shown).
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="wb-note">(No such cell in this part of the table with this budget — try a smaller budget or other rows.)</p>
          )}
          <NotAProof>
            The table shows one candidate failing. The theorem says every total computable candidate fails, and the diagonal argument is what shows it.
          </NotAProof>
        </>
      )}
    </Panel>
  );
}
