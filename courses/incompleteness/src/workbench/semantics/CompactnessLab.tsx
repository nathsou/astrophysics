// Second-order logic is not compact: Γ = {¬Inf, A≥1, A≥2, …} is finitely satisfiable but not
// satisfiable. For a finite part Γ₀ with largest A≥k, a domain of k elements satisfies Γ₀
// (computed below); and every finite domain fails some A≥n.

import { useMemo, useState } from 'react';
import { atLeast, solFin, solTrueIn } from '../../engine/semantics/sol';
import { trueIn } from '../../engine/semantics/satisfaction';
import { pureStructure } from '../../engine/semantics/structure';
import type { Truth } from '../../engine/semantics/trace';
import { formulaText } from '../../engine/syntax/print';
import { NotAProof, Prov } from '../../ui/Prov';
import { Panel } from '../coding';
import { TruthBadge } from './TraceTree';
import './sem.css';

export function CompactnessLab() {
  const [k, setK] = useState(3);
  const rows = useMemo(() => {
    const M = pureStructure(Array.from({ length: k }, (_, i) => i));
    const out: { name: string; text: string; truth: Truth; inG0: boolean }[] = [];
    out.push({ name: '¬Inf', text: '¬∃u (∀x ∀y (u(x) = u(y) → x = y) ∧ ∃y ∀x y ≠ u(x))', truth: solTrueIn(M, solFin()).truth, inG0: true });
    for (let n = 1; n <= k + 1; n++) {
      const f = atLeast(n);
      out.push({ name: `A≥${n}`, text: n <= 3 ? formulaText(f) : `∃x₀ … ∃x${n - 1} (the ${n} are pairwise distinct)`, truth: trueIn(M, f, { trace: false }).truth, inG0: n <= k });
    }
    return out;
  }, [k]);
  return (
    <Panel title="A finite part of Γ, and a domain that satisfies it" prov={<Prov kind="computed" />}>
      <label className="sem-inline">
        Γ₀ = {'{'}¬Inf, A≥1, …, A≥k{'}'} with k =
        <input type="number" min={1} max={5} value={k} onChange={(e) => setK(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} />
      </label>
      <p className="wb-note">Each sentence evaluated in the structure with domain {'{'}0, …, {k - 1}{'}'} and no other symbols (¬Inf by running through all {k ** k} functions u):</p>
      <div className="sem-scroll">
        <table className="sem-compare">
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className={r.inG0 ? '' : 'differs'}>
                <td className="c">
                  <TruthBadge t={r.truth} />
                </td>
                <td className="sem-qname">{r.name}</td>
                <td className="sem-ftext">{r.text}</td>
                <td className="small sans">{r.inG0 ? 'in Γ₀' : 'not in Γ₀ — and false here'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p aria-live="polite">
        Every sentence of Γ₀ is true in a {k}-element domain, but A≥{k + 1} is not. Any domain satisfying ¬Inf is finite, of some size m, and then A≥(m+1) fails: no structure satisfies all of Γ.
      </p>
      <NotAProof>The table checks one k. The book’s argument covers every finite Γ₀ and every finite domain.</NotAProof>
    </Panel>
  );
}
