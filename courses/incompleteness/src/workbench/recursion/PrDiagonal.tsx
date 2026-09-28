// The diagonal argument of section "Non-Primitive Recursive Functions": list unary primitive
// recursive functions f₀, f₁, …, and h(x) = f_x(x) + 1 differs from every f_x at x. First on a
// short list of familiar functions; then on the enumeration of all unary primitive recursive
// definitions by index (this edition's coding), where codes that are not unary primitive
// recursive notations give the constant 0 function, as in the book.

import { useMemo, useState } from 'react';
import { R, type RF } from '../../engine/recursive/rf';
import * as Lib from '../../engine/computability/library';
import { gLevel, listDiagonal, prDiagonal, safeIndex } from '../../engine/computability/primrec';
import { showDefinition } from '../../engine/computability/indices';
import { Panel } from '../coding';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { fmtBig, OutcomeCell, useRemembered } from './common';

const LIST: { tex: string; build: () => RF }[] = [
  { tex: '\\mathrm{id}(x)', build: Lib.id },
  { tex: '\\mathrm{pred}(x)', build: Lib.pred },
  { tex: 'x + x', build: () => R.comp(Lib.add(), [R.proj(1, 0), R.proj(1, 0)]) },
  { tex: 'x \\cdot x', build: () => R.comp(Lib.mult(), [R.proj(1, 0), R.proj(1, 0)]) },
  { tex: '2^x', build: () => R.comp(Lib.exp(), [Lib.constN(2), R.proj(1, 0)]) },
  { tex: 'x!', build: Lib.fac },
  { tex: '\\chi_{\\mathrm{Prime}}(x)', build: Lib.prime },
  { tex: 'g_2(x) = 2^x x', build: () => gLevel(2) },
];

export function PrDiagonal() {
  const [mode, setMode] = useRemembered<'list' | 'all'>('prdiag.mode', 'list');
  return (
    <div className="workbench">
      <div className="seg" role="group" aria-label="Which list">
        <button className="chip-btn" aria-pressed={mode === 'list'} onClick={() => setMode('list')}>
          a short list
        </button>
        <button className="chip-btn" aria-pressed={mode === 'all'} onClick={() => setMode('all')}>
          all unary primitive recursive definitions
        </button>
      </div>
      {mode === 'list' ? <ShortList /> : <Enumeration />}
    </div>
  );
}

function ShortList() {
  const fs = useMemo(() => LIST.map((l) => l.build()), []);
  const fuel = 300_000;
  const rows = useMemo(() => listDiagonal(fs, LIST.length, fuel), [fs]);
  return (
    <Panel n={1} title={<>Diagonalizing a list: <Tex tex="h(x) = f_x(x) + 1" /></>} prov={<Prov kind="computed" />}>
      <p className="wb-note">
        Row <Tex tex="x" /> is the function <Tex tex="f_x" />, computed by its official primitive recursive definition. The diagonal function <Tex tex="h" /> adds 1 to the
        highlighted entry of each row, so it differs from row <Tex tex="x" /> at argument <Tex tex="x" /> — whatever the rows are.
      </p>
      <div className="rc-scroll">
        <table className="rc-table" aria-label="The list and its diagonal">
          <thead>
            <tr>
              <th scope="col">x</th>
              <th scope="col">
                <Tex tex="f_x" />
              </th>
              {LIST.map((_, y) => (
                <th key={y} scope="col" className="num">
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, x) => (
              <tr key={x}>
                <td className="num">{x}</td>
                <td>
                  <Tex tex={LIST[x].tex} />
                </td>
                {r.cells.map((c, y) => (
                  <td key={y} className={`num ${x === y ? 'diag' : ''}`}>
                    <OutcomeCell o={c} fuel={fuel} compact />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td />
              <th scope="row">
                <Tex tex="h(y)" />
              </th>
              {rows.map((r, y) => (
                <td key={y} className="num">
                  <b>{typeof r.h === 'bigint' ? r.h.toString() : '?'}</b>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="wb-note">
        <Tex tex="h" /> is computable — you just watched it being computed — and it is not any row of this list. The argument works for <em>every</em> list whose entries can be
        computed from their position: in particular for a list of all unary primitive recursive functions.
      </p>
    </Panel>
  );
}

function Enumeration() {
  const [from, setFrom] = useState(0);
  const [onlyPr, setOnlyPr] = useState(false);
  const fuel = 20_000;
  const span = onlyPr ? 400 : 24;
  const rows = useMemo(() => prDiagonal(BigInt(from), span, 0, fuel), [from, span]);
  const shown = onlyPr ? rows.filter((r) => r.row.kind === 'pr').slice(0, 24) : rows;
  const dbl = useMemo(() => safeIndex(R.comp(Lib.add(), [R.proj(1, 0), R.proj(1, 0)])), []);
  return (
    <Panel n={1} title={<>The list <Tex tex="f_0, f_1, f_2, \ldots" /> of all unary primitive recursive functions</>} prov={<Prov kind="computed" />}>
      <p className="wb-note">
        <Tex tex="f_e" /> is the function whose definition has index <Tex tex="e" />, if that definition is unary and primitive recursive; otherwise, as in the book, the constant{' '}
        <Tex tex="0" /> function. Definitions using μ do not count: the book numbers notations built from zero, succ, projections, Comp and Rec only. The indices are this
        edition’s bijective numbering (the book’s <Tex tex="\#(F)" /> is astronomically sparse), which changes nothing in the argument.
      </p>
      <div className="rc-row">
        <button className="chip-btn" onClick={() => setFrom(Math.max(0, from - span))} disabled={from === 0}>
          ← earlier
        </button>
        <span className="sans small">
          indices {from}–{from + span - 1}
        </span>
        <button className="chip-btn" onClick={() => setFrom(from + span)} disabled={from > 1_000_000}>
          later →
        </button>
        <label className="rc-field">
          <input type="checkbox" checked={onlyPr} onChange={(e) => setOnlyPr(e.target.checked)} /> hide the constant-0 rows
        </label>
      </div>
      <div className="rc-scroll">
        <table className="rc-table" aria-label="The diagonal of the enumeration">
          <thead>
            <tr>
              <th scope="col" className="num">
                e
              </th>
              <th scope="col">
                <Tex tex="f_e" />
              </th>
              <th scope="col" className="num">
                <Tex tex="f_e(e)" />
              </th>
              <th scope="col" className="num">
                <Tex tex="h(e) = f_e(e) + 1" />
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={String(r.row.e)}>
                <td className="num">{r.row.e.toString()}</td>
                <td className="wrap">{r.row.kind === 'pr' ? <span className="rc-mono">{showDefinition(r.row.rf)}</span> : <span className="rc-na">constant 0 ({r.row.why})</span>}</td>
                <td className="num diag">
                  <OutcomeCell o={r.diag} fuel={fuel} />
                </td>
                <td className="num">{typeof r.h === 'bigint' ? fmtBig(r.h, 20) : <span className="rc-unknown">{r.h}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="wb-note">
        Small indices code small definitions, so the first rows are dull: constants, <Tex tex="x + c" />, projections. Anything with a primitive recursion inside sits much
        further out — <Tex tex="x + x" />, as <span className="rc-mono">Comp(add; P^1_0, P^1_0)</span>, has index{' '}
        {dbl.ok ? <span className="rc-mono">{fmtBig(dbl.e, 30)}</span> : 'a very large number'}, and there <Tex tex="h" /> differs from it too.
      </p>
      <NotAProof>
        A finite part of the table. The argument that <Tex tex="h" /> is not primitive recursive covers every row at once: if <Tex tex="h = f_e" />, then{' '}
        <Tex tex="h(e) = f_e(e) + 1 \ne f_e(e)" />.
      </NotAProof>
    </Panel>
  );
}
