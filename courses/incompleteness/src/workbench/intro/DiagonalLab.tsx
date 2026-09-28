// The diagonal argument of section 1.4, in a decidable toy setting.
//
// The rows are formulas A_0(x), A_1(x), … with one free variable. In the theorem, whether
// n ∈ D depends on whether Γ derives ¬A_n(n̄). In this toy, Γ is replaced by truth in 𝔑 and the
// formulas are Δ0, so every entry is decided by the semantics engine.

import { useMemo, useState } from 'react';
import { tryParseFormula } from '../../engine/syntax/parse';
import { freeVars } from '../../engine/syntax/ops';
import { formulaText } from '../../engine/syntax/print';
import { and, eq, numeral, not, or, v, type Formula } from '../../engine/syntax/ast';
import { evaluateInN } from '../../engine/semantics/standard';
import { lit } from '../../engine/numbers/nat';
import { Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { persist, persisted } from '../../ui/store';
import './intro.css';

const DEFAULT_ROWS = [
  'x = 0',
  '∃y (y < x′ ∧ x = y + y)',
  '0′ < x ∧ ∀y (y < x → ∀z (z < x → ¬ y × z = x))',
  'x < 0′′′',
  'x × x = x',
  '∃y (y < x′ ∧ x = y × y)',
];
const MAX_ROWS = 10;
const KEY = 'ic.intro.diagonal';

type Cell = boolean | 'unknown';

function truth(A: Formula, n: number): Cell {
  const r = evaluateInN(A, new Map([[0, BigInt(n)]]));
  return r.truth;
}

export function DiagonalLab() {
  const [rows, setRowsState] = useState<string[]>(() => persisted(KEY, DEFAULT_ROWS));
  const setRows = (r: string[]) => {
    setRowsState(r);
    persist(KEY, r);
  };
  const { parsed, problems, table } = useMemo(() => {
    const parsed = rows.map((r) => tryParseFormula(r));
    const problems = parsed.map((p) => {
      if (!p.ok) return p.error;
      if ([...freeVars(p.value)].some((i) => i !== 0)) return 'use x as the only free variable';
      return null;
    });
    const k = rows.length;
    const table: Cell[][] = parsed.map((p, i) => Array.from({ length: k }, (_, n) => (p.ok && !problems[i] ? truth(p.value, n) : ('unknown' as Cell))));
    return { parsed, problems, table };
  }, [rows]);
  const k = rows.length;
  const D: Cell[] = table.map((row, n) => (row[n] === 'unknown' ? 'unknown' : !row[n]));

  const addDefinitionOfD = () => {
    // x ∈ D (for x < k) iff x = n̄ ∧ ¬A_n(x) for some n < k: a Δ0 formula that agrees with D on 0, …, k−1.
    const parts: Formula[] = [];
    parsed.forEach((p, n) => {
      if (p.ok) parts.push(and(eq(v(0), numeral(lit(n))), not(p.value)));
    });
    if (parts.length === 0) return;
    const f = parts.slice(1).reduce((acc, p) => or(acc, p), parts[0]);
    setRows([...rows, formulaText(f)]);
  };

  const cellText = (c: Cell) => (c === 'unknown' ? '?' : c ? '1' : '0');
  return (
    <div className="workbench">
      <p className="wb-note">
        <Prov kind="added">toy model</Prov> Row <Tex tex="n" /> lists, for each number <Tex tex="m" />, whether <Tex tex="A_n(\overline m)" /> is true (1) or false (0). The theorem’s{' '}
        <Tex tex="D = \{n : \Gamma \vdash \lnot A_n(\overline n)\}" /> becomes <Tex tex="\{n : \mathfrak N \vDash \lnot A_n(\overline n)\}" /> here: flip the diagonal. The formulas are
        Δ0, so every entry is computed exactly <Prov kind="computed" />.
      </p>
      <div className="dg-wrap">
        <table className="dg-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">formula</span>
              </th>
              {Array.from({ length: k }, (_, m) => (
                <th key={m} scope="col">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, n) => (
              <tr key={n}>
                <th scope="row" className="dg-formula">
                  <span className="dg-name">
                    <Tex tex={`A_{${n}}(x)`} />
                  </span>
                  <input
                    className={`fi-field dg-input ${problems[n] ? 'invalid' : ''}`}
                    value={r}
                    onChange={(e) => setRows(rows.map((x, i) => (i === n ? e.target.value : x)))}
                    aria-label={`Formula A${n}`}
                    spellCheck={false}
                  />
                  {problems[n] && <span className="pv-error">{problems[n]}</span>}
                  <button className="chip-btn dg-del" onClick={() => setRows(rows.filter((_, i) => i !== n))} aria-label={`Remove A${n}`} disabled={rows.length <= 1}>
                    ×
                  </button>
                </th>
                {table[n].map((c, m) => (
                  <td key={m} className={`${m === n ? 'diag' : ''} ${c === true ? 'one' : ''}`}>
                    {cellText(c)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="dg-d">
              <th scope="row">
                <b>D</b> <span className="muted small">(flipped diagonal)</span>
              </th>
              {D.map((c, m) => (
                <td key={m} className={c === true ? 'one' : ''}>
                  {cellText(c)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="wb-note">
        D differs from row <Tex tex="n" /> in column <Tex tex="n" />, for every <Tex tex="n" />: so no row defines D. Try to beat it: the button adds a formula that agrees with the
        current D on all current columns. Adding it creates a new column — and D changes there.
      </p>
      <div className="fi-row">
        <button className="chip-btn primary" onClick={addDefinitionOfD} disabled={rows.length >= MAX_ROWS || problems.some(Boolean)}>
          Add a formula defining the current D
        </button>
        <button className="chip-btn" onClick={() => setRows([...rows, 'x = x'])} disabled={rows.length >= MAX_ROWS}>
          Add a row
        </button>
        <button className="chip-btn" onClick={() => setRows(DEFAULT_ROWS)}>
          Reset
        </button>
      </div>
      <p className="wb-note">
        In the theorem the list contains <em>all</em> formulas with one free variable, D is decidable (if Γ is), and Γ represents every decidable set — so some <Tex tex="A_d" /> would
        represent D, and row <Tex tex="d" /> would have to agree with D at column <Tex tex="d" />. The table shows why it cannot; the proof turns that into an inconsistency of Γ.
      </p>
    </div>
  );
}
