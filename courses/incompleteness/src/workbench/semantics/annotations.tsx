// Computed material attached to blocks of the book's text in Formal mode.

import { useMemo } from 'react';
import { parseFormula } from '../../engine/syntax/parse';
import { satisfies } from '../../engine/semantics/satisfaction';
import { assignment } from '../../engine/semantics/assignment';
import { bookSatisfactionExample } from '../../engine/semantics/examples';
import { Prov } from '../../ui/Prov';
import { TruthBadge } from './TraceTree';
import './sem.css';

const CLAIMS: [string, boolean][] = [
  ['R(b, f(a, b))', true],
  ['R(x, f(a, b))', false],
  ['R(a, a) → (R(b, x) ∨ R(x, b))', true],
  ['∃x (R(b, x) ∨ R(x, b))', true],
  ['∃x (R(b, x) ∧ R(x, b))', false],
  ['∀x (R(x, a) → R(a, x))', true],
  ['∀x (R(a, x) → R(x, a))', false],
  ['∀x (R(a, x) → ∃y R(x, y))', true],
  ['∃x (R(a, x) ∧ ∀y R(x, y))', false],
];

/** The claims of the book's worked example, evaluated by the engine. */
export function BookExampleClaims() {
  const rows = useMemo(() => {
    const M = bookSatisfactionExample();
    const s = assignment({ x: 1, y: 1, z: 1 });
    return CLAIMS.map(([f, book]) => ({ f, book, t: satisfies(M, s, parseFormula(f), { trace: false }).truth }));
  }, []);
  return (
    <div>
      <div className="ann-title sans">
        <b>The example’s claims, recomputed</b> <Prov kind="computed" />
      </div>
      <table className="sem-compare">
        <thead>
          <tr>
            <th scope="col">M, s ⊨ …? (s(v) = 1 for all v)</th>
            <th scope="col">the text</th>
            <th scope="col">computed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.f}>
              <td className="sem-ftext">{r.f}</td>
              <td className="c">
                <TruthBadge t={r.book} />
              </td>
              <td className="c">
                <TruthBadge t={r.t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted sans">Explore mode shows the full trace for each, with the x-variants the text discusses.</p>
    </div>
  );
}
