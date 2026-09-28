// Semantic notions on small structures: look for a model of Γ, or a countermodel to Γ ⊨ A,
// among all structures with domains {0}, {0, 1}, … for the symbols that occur.

import { useMemo, useState } from 'react';
import type { Formula } from '../../engine/syntax/ast';
import { tryParseFormula } from '../../engine/syntax/parse';
import { findCountermodel, findModel, signatureOf, countStructures, type ModelSearch } from '../../engine/semantics/countermodel';
import { trueIn } from '../../engine/semantics/satisfaction';
import { NotAProof, Prov } from '../../ui/Prov';
import { Panel } from '../coding';
import { FiniteTables } from './StructurePicker';
import { TruthBadge } from './TraceTree';
import './sem.css';

const PRESETS: { label: string; gamma: string; a: string }[] = [
  { label: '∀x ∃y R(x, y) ⊨ ∃y ∀x R(x, y)?', gamma: '∀x ∃y R(x, y)', a: '∃y ∀x R(x, y)' },
  { label: '∃y ∀x R(x, y) ⊨ ∀x ∃y R(x, y)?', gamma: '∃y ∀x R(x, y)', a: '∀x ∃y R(x, y)' },
  { label: 'strict linear orders ⊨ ∃x ∀y ¬y < x (a least element)?', gamma: '∀x ¬x < x\n∀x ∀y ((x < y ∨ y < x) ∨ x = y)\n∀x ∀y ∀z ((x < y ∧ y < z) → x < z)', a: '∃x ∀y ¬y < x' },
  { label: 'strict linear orders ⊨ ∀x ∃y x < y?', gamma: '∀x ¬x < x\n∀x ∀y ((x < y ∨ y < x) ∨ x = y)\n∀x ∀y ∀z ((x < y ∧ y < z) → x < z)', a: '∀x ∃y x < y' },
  { label: 'is ∀x P(x) → P(a) valid?', gamma: '', a: '∀x P(x) → P(a)' },
  { label: 'is ∃x (P(x) → ∀y P(y)) valid?', gamma: '', a: '∃x (P(x) → ∀y P(y))' },
  { label: 'Q1, Q2 ⊨ ⊥ on small domains?', gamma: '∀x ∀y (x′ = y′ → x = y)\n∀x ¬0 = x′', a: '⊥' },
];

export function CountermodelLab({ initial = 0 }: { initial?: number }) {
  const [gamma, setGamma] = useState(PRESETS[initial].gamma);
  const [a, setA] = useState(PRESETS[initial].a);
  const [maxSize, setMaxSize] = useState(3);
  const [result, setResult] = useState<{ kind: 'entails' | 'sat'; r: ModelSearch; gamma: Formula[]; A: Formula | null } | null>(null);
  const gs = useMemo(() => gamma.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => ({ l, p: tryParseFormula(l) })), [gamma]);
  const pa = useMemo(() => (a.trim() ? tryParseFormula(a) : null), [a]);
  const errors = [...gs.filter((g) => !g.p.ok).map((g) => `${g.l}: ${!g.p.ok ? g.p.error : ''}`), ...(pa && !pa.ok ? [`A: ${pa.error}`] : [])];
  const G = gs.flatMap((g) => (g.p.ok ? [g.p.value] : []));
  const A = pa && pa.ok ? pa.value : null;
  const sig = signatureOf(A ? [...G, A] : G);
  const counts = Array.from({ length: maxSize }, (_, i) => countStructures(sig, i + 1));
  const run = (kind: 'entails' | 'sat') => {
    if (errors.length) return;
    const r = kind === 'entails' && A ? findCountermodel(G, A, { maxSize }) : findModel(G, { maxSize });
    setResult({ kind, r, gamma: G, A });
  };
  return (
    <div className="workbench sem-lab">
      <Panel n={1} title="Sentences" prov={<Prov kind="computed" />}>
        <label className="fi-label" htmlFor="cm-preset">
          Examples
        </label>
        <select
          id="cm-preset"
          className="fi-examples sem-select"
          value=""
          onChange={(e) => {
            const p = PRESETS[Number(e.target.value)];
            if (!p) return;
            setGamma(p.gamma);
            setA(p.a);
            setResult(null);
          }}
        >
          <option value="">Examples…</option>
          {PRESETS.map((p, i) => (
            <option key={i} value={i}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="fi-label" htmlFor="cm-gamma">
          Γ (one sentence per line; may be empty)
        </label>
        <textarea id="cm-gamma" className="sem-sentences" value={gamma} onChange={(e) => setGamma(e.target.value)} spellCheck={false} />
        <label className="fi-label" htmlFor="cm-a">
          A
        </label>
        <input id="cm-a" className="fi-field" value={a} onChange={(e) => setA(e.target.value)} spellCheck={false} />
        {errors.length > 0 && <p className="fi-error">{errors.join('; ')}</p>}
        <div className="sem-options">
          <label className="sem-inline">
            domains of size 1 to
            <input type="number" min={1} max={5} value={maxSize} onChange={(e) => setMaxSize(Math.max(1, Math.min(5, Number(e.target.value) || 3)))} />
          </label>
          <span className="wb-note">
            Structures to try for these symbols: {counts.map((c, i) => `size ${i + 1}: ${c.toLocaleString('en-US')}`).join(', ')} (at most 300,000 in all).
          </span>
        </div>
        <div className="seg">
          <button className="chip-btn primary" disabled={!A || errors.length > 0} onClick={() => run('entails')}>
            Search for a countermodel to Γ ⊨ A
          </button>
          <button className="chip-btn" disabled={G.length === 0 || errors.length > 0} onClick={() => run('sat')}>
            Search for a model of Γ
          </button>
        </div>
      </Panel>
      {result && <Result {...result} />}
    </div>
  );
}

function Result({ kind, r, gamma, A }: { kind: 'entails' | 'sat'; r: ModelSearch; gamma: Formula[]; A: Formula | null }) {
  return (
    <Panel n={2} title={kind === 'entails' ? 'Countermodel search' : 'Model search'} prov={<Prov kind="computed" />}>
      <div aria-live="polite">
        {r.found ? (
          <>
            <p>
              <b>{kind === 'entails' ? 'Countermodel found' : 'Model found'}</b> (domain of size {r.size}, after {r.searched.toLocaleString('en-US')} structures).{' '}
              {kind === 'entails' ? 'It satisfies every sentence of Γ but not A — so Γ ⊭ A. One countermodel settles this.' : 'So Γ is satisfiable.'}
            </p>
            <FiniteTables M={r.structure} compact />
            <table className="sem-compare">
              <tbody>
                {[...gamma, ...(A ? [A] : [])].map((f, i) => {
                  const t = trueIn(r.structure, f, { trace: false });
                  return (
                    <tr key={i}>
                      <td className="c">
                        <TruthBadge t={t.truth} />
                      </td>
                      <td className="sem-ftext">
                        {t.text}
                        {A && i === gamma.length ? ' (A)' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : r.reason ? (
          <p className="wb-note danger">{r.reason}</p>
        ) : (
          <>
            <p>
              <b>None found</b> among the {r.searched.toLocaleString('en-US')} structures with domains of size {r.sizes.join(', ') || '—'}
              {r.stoppedAt ? ` (size ${r.stoppedAt.size} would need ${r.stoppedAt.count.toLocaleString('en-US')} more, beyond the budget)` : ''}.
            </p>
            <NotAProof>
              {kind === 'entails'
                ? 'No small countermodel does not mean Γ ⊨ A: a countermodel may need a larger (or infinite) domain. Entailment is a claim about every structure.'
                : 'No small model does not mean Γ is unsatisfiable: its models may all be larger, or infinite (Q1 and Q2 together have only infinite models).'}
            </NotAProof>
          </>
        )}
      </div>
    </Panel>
  );
}
