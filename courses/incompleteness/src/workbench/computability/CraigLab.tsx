// Section "Computable Enumerability and Axiomatizable Theories": Craig's trick, on formulas.

import { useMemo, useState } from 'react';
import { Panel } from '../coding';
import { Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { FormulaView } from '../../ui/FormulaView';
import { tryParseFormula } from '../../engine/syntax/parse';
import { craigElement, inGamma } from '../../engine/computability/craig';
import type { Formula } from '../../engine/syntax/ast';

const DEFAULTS = ['0 = 0', '∀x x = x', '0 < 1 ∧ 0 < 1', '∀x ¬x′ = 0', '1 + 1 = 2'];

export function CraigLab() {
  const [list, setList] = useState<string[]>(DEFAULTS);
  const [test, setTest] = useState(() => copiesText(DEFAULTS[2], 3));
  const parsed = useMemo(() => list.map((s) => tryParseFormula(s)), [list]);
  const enumeration = (n: number): Formula | null => {
    const p = parsed[n];
    return p && p.ok ? p.value : null;
  };
  const gamma = useMemo(() => parsed.map((p, n) => (p.ok ? craigElement(p.value, n) : null)), [parsed]);
  const t = useMemo(() => tryParseFormula(test), [test]);
  const m = useMemo(() => (t.ok ? inGamma(t.value, enumeration) : null), [t, parsed]);
  return (
    <div className="workbench">
      <Panel n={1} title="An enumeration of a theory, and Γ" prov={<Prov kind="computed" />}>
        <p className="wb-note">
          Suppose <Tex tex="A_0, A_1, A_2, \ldots" /> lists the theorems of T (the first few are editable here — any sentences will do for the trick). Craig’s set puts{' '}
          <Tex tex="n + 1" /> copies of <Tex tex="A_n" /> into its n-th axiom:
        </p>
        <ol className="ct-formula-list" start={0}>
          {list.map((s, n) => (
            <li key={n}>
              <label className="sans small" htmlFor={`ct-craig-${n}`}>
                <Tex tex={`A_{${n}} =`} />
              </label>
              <input id={`ct-craig-${n}`} className={`fi-field ${parsed[n].ok ? '' : 'invalid'}`} value={s} onChange={(ev) => setList(list.map((x, j) => (j === n ? ev.target.value : x)))} spellCheck={false} />
              {!parsed[n].ok && <span className="fi-error">{(parsed[n] as { error: string }).error}</span>}
            </li>
          ))}
        </ol>
        <p className="ct-kicker">Γ</p>
        <ul className="ct-formula-list">
          {gamma.map((g, n) => (
            <li key={n} className="ct-scroll">
              {g ? <FormulaView node={g} /> : <span className="muted">—</span>}
            </li>
          ))}
          <li className="muted">…</li>
        </ul>
        <p className="wb-note">
          Γ axiomatizes the same theory: each axiom is equivalent to the theorem it copies. But Γ is <em>decidable</em>, even if deciding whether a sentence is a theorem is
          not: the number of copies says which single step of the enumeration to compute.
        </p>
      </Panel>

      <Panel n={2} title="Is a sentence in Γ?" prov={<Prov kind="computed" />}>
        <label className="fi-label" htmlFor="ct-craig-test">
          sentence F
        </label>
        <input id="ct-craig-test" className={`fi-field ct-wide ${t.ok ? '' : 'invalid'}`} value={test} onChange={(ev) => setTest(ev.target.value)} spellCheck={false} />
        <div className="seg" style={{ marginTop: 6 }}>
          {gamma.slice(0, 4).map(
            (g, n) =>
              g &&
              parsed[n].ok && (
                <button key={n} className="chip-btn" onClick={() => setTest(copiesText(list[n], n + 1))}>
                  axiom {n}
                </button>
              ),
          )}
          <button className="chip-btn" onClick={() => setTest(`${wrap(list[0])} ∧ ${wrap(list[0])}`)}>
            two copies of A₀
          </button>
        </div>
        {!t.ok && <p className="fi-error">{(t as { error: string }).error}</p>}
        {m && (
          <div aria-live="polite">
            <ol className="ct-steps">
              {m.tests.map((q, i) => (
                <li key={i}>
                  Read F as <b>{q.reading.k}</b> cop{q.reading.k === 1 ? 'y' : 'ies'} of <span className="ct-scroll"><FormulaView node={q.reading.B} /></span>: compare with{' '}
                  <Tex tex={`A_{${q.reading.n}}`} />
                  {q.An ? (
                    <>
                      {' '}= <FormulaView node={q.An} /> — {q.equal ? <b>the same sentence ✓</b> : 'different'}.
                    </>
                  ) : (
                    ' — not listed here (a real enumeration would compute it).'
                  )}
                </li>
              ))}
            </ol>
            <p>
              {m.member ? <span className="ct-verdict yes">F ∈ Γ</span> : <span className="ct-verdict no">F ∉ Γ</span>}{' '}
              <span className="sans small muted">— decided by computing at most two elements of the enumeration.</span>
            </p>
          </div>
        )}
        <p className="wb-note">
          <Prov kind="added" /> Two details are made explicit here: k copies go with <Tex tex="A_{k-1}" />, and a sentence can be read both as one copy of itself and as k
          copies of its left conjunct, so both readings are tried (an <Tex tex="A_0" /> such as <Tex tex="B \land B" /> is one copy of itself).
        </p>
      </Panel>
    </div>
  );
}

function wrap(s: string) {
  return /[∧∨→↔∀∃]/.test(s) ? `(${s})` : s;
}

function copiesText(s: string, k: number): string {
  let out = wrap(s);
  for (let i = 1; i < k; i++) out = `${wrap(s)} ∧ (${out})`;
  return out;
}
