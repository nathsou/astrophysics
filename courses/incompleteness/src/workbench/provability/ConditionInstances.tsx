// Instances of the derivability conditions for sentences the reader chooses (section 5.6).

import { useState } from 'react';
import { imp, prov, tex, tryParsePF, type PF } from '../../engine/provability/pl';
import { Tex } from '../../ui/Tex';
import { Prov } from '../../ui/Prov';
import './provability.css';

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const p = tryParsePF(value);
  return (
    <label className="ci-field">
      <span className="fi-label">{label}</span>
      <input className={`fi-field ${p.ok ? '' : 'invalid'}`} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      {!p.ok && <span className="pv-error">{p.error}</span>}
    </label>
  );
}

export function ConditionInstances() {
  const [a, setA] = useState('G');
  const [b, setB] = useState('_|_');
  const pa = tryParsePF(a);
  const pb = tryParsePF(b);
  const A: PF | null = pa.ok ? pa.value : null;
  const B: PF | null = pb.ok ? pb.value : null;
  const P = (f: PF) => prov(f);
  const rows: { name: string; kind: string; body: string | null }[] = [
    { name: 'P1', kind: 'rule', body: A && `\\text{if } T \\vdash ${tex(A)} \\text{ then } T \\vdash ${tex(P(A))}` },
    { name: 'P2', kind: 'derivable', body: A && B && `T \\vdash ${tex(imp(P(imp(A, B)), imp(P(A), P(B))))}` },
    { name: 'P3', kind: 'derivable', body: A && `T \\vdash ${tex(imp(P(A), P(P(A))))}` },
    { name: 'P4', kind: 'rule, not needed', body: A && `\\text{if } T \\vdash ${tex(P(A))} \\text{ then } T \\vdash ${tex(A)}` },
    { name: 'reflection', kind: 'derivable exactly when T ⊢ A (Löb)', body: A && `T \\vdash ${tex(imp(P(A), A))}\\;?` },
  ];
  return (
    <div className="workbench pv">
      <p className="wb-note">
        <Prov kind="computed">instances</Prov> Choose sentences A and B (letters, <code>~</code>, <code>&amp;</code>, <code>|</code>, <code>-&gt;</code>, <code>_|_</code>,{' '}
        <code>Prov(…)</code>, <code>Con</code>). Each condition is a schema: these are its instances for your choice. Nested quotes are nested Gödel numerals — the numeral inside{' '}
        <Tex tex="\ulcorner \mathsf{Prov}(\ulcorner A\urcorner)\urcorner" /> is part of the formula being coded.
      </p>
      <div className="fi-row">
        <Field label="A" value={a} onChange={setA} />
        <Field label="B" value={b} onChange={setB} />
      </div>
      <table className="rr-table ci-table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">
                <b>{r.name}</b>
                <div className="muted small">{r.kind}</div>
              </th>
              <td className="ci-inst">{r.body ? <Tex tex={r.body} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
