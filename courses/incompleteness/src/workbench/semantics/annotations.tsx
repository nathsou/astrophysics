// Computed material attached to blocks of the book's text in Formal mode.

import { useMemo } from 'react';
import { parseFormula } from '../../engine/syntax/parse';
import { satisfies } from '../../engine/semantics/satisfaction';
import { assignment } from '../../engine/semantics/assignment';
import { bookSatisfactionExample } from '../../engine/semantics/examples';
import { pureStructure } from '../../engine/semantics/structure';
import { S, showSolValue, solAleph1SetAsPrinted, solAssignment, solCountSet, solCountSetAsPrinted, solInfSet, solInfSetAsPrinted, solSatisfies } from '../../engine/semantics/sol';
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

/** The formulas Inf(X) and Count(X) as printed, evaluated on a three-element domain. */
export function PrintedFormulaCheck({ which }: { which: 'inf' | 'count' }) {
  const r = useMemo(() => {
    const M = pureStructure([0, 1, 2]);
    const X = S.X(0, 1);
    const set = which === 'inf' ? [0] : [0, 1];
    const s = solAssignment({ rel: [{ X, tuples: set.map((e) => [e]) }] });
    const printed = solSatisfies(M, s, which === 'inf' ? solInfSetAsPrinted(X) : solCountSetAsPrinted(X));
    const fixed = solSatisfies(M, s, which === 'inf' ? solInfSet(X) : solCountSet(X));
    return { set, printed, fixed };
  }, [which]);
  const setText = `{${r.set.join(', ')}}`;
  return (
    <div>
      <div className="ann-title sans">
        <b>{which === 'inf' ? 'Inf(X) as printed, on a finite set' : 'Count(X) as printed, on a proper subset'}</b> <Prov kind="computed" />
      </div>
      {which === 'inf' ? (
        <p className="small">
          On the domain {'{'}0, 1, 2{'}'} with s(X) = {setText} (finite), the formula as printed is <TruthBadge t={r.printed.truth} />
          {r.printed.quantifier?.witness && <> — witness u = {showSolValue(r.printed.quantifier.witness)}</>}. It does not require u to map X into X. With the conjunct ∀x (X(x) → X(u(x))) added, it is <TruthBadge t={r.fixed.truth} /> (all 27 functions u tried).
        </p>
      ) : (
        <p className="small">
          On the domain {'{'}0, 1, 2{'}'} with s(X) = {setText} (countable), the formula as printed is <TruthBadge t={r.printed.truth} />: Y may be the whole domain, which contains z and is closed under u, so “X = Y” forces X to be everything. With X ⊆ Y in place of X = Y it is <TruthBadge t={r.fixed.truth} />.
        </p>
      )}
    </div>
  );
}

/** Aleph₁(X) as printed in 8.12 holds of finite sets (X is one of its own subsets). */
export function PrintedAleph1Check() {
  const rows = useMemo(() => {
    const M = pureStructure([0, 1, 2]);
    const X = S.X(0, 1);
    return [[], [0], [0, 1, 2]].map((set) => ({ set, truth: solSatisfies(M, solAssignment({ rel: [{ X, tuples: set.map((e) => [e]) }] }), solAleph1SetAsPrinted(X)).truth }));
  }, []);
  return (
    <div>
      <div className="ann-title sans">
        <b>Aleph₁(X) as printed, on finite sets</b> <Prov kind="computed" />
      </div>
      <p className="small">
        On the domain {'{'}0, 1, 2{'}'}, the formula as printed is{' '}
        {rows.map((r, i) => (
          <span key={i}>
            {i > 0 && (i === rows.length - 1 ? ' and ' : ', ')}
            <TruthBadge t={r.truth} /> for s(X) = {'{'}
            {r.set.join(', ')}
            {'}'}
          </span>
        ))}
        . Every finite X satisfies it: its first conjunct quantifies over all subsets Y of X, including X itself, so X must be finite or of size ℵ₀, and the second conjunct
        rules out ℵ₀. The intended condition is that X is infinite, not countable, and every proper subset is finite, countable, or equinumerous with X. As printed, the
        continuum hypothesis ∀X (Aleph₁(X) ↔ Cont(X)) of <a href="#/s/sol.set.pow?mode=intuition">the next section</a> is false in every structure (take X = ∅). Finitely many
        small cases illustrate the slip; the argument in this note is what shows it.
      </p>
    </div>
  );
}
