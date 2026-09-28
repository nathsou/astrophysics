// A book example, transcribed and handed to the checker (for Formal-mode annotations and short
// displays): the tree, the checker's verdict and its messages.

import { useMemo, useState } from 'react';
import { check, linearize } from '../../engine/proof/nd';
import { ndMessage, ndTex, ndText } from '../../engine/proof/ndlang';
import { exampleById } from '../../engine/proof/ndExamples';
import { Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { NDTree } from './NDTree';
import './nd.css';

export function ExampleCheck({ id }: { id: string }) {
  const ex = exampleById(id)!;
  const d = useMemo(() => ex.build(), [ex]);
  const c = useMemo(() => check(d), [d]);
  const numbers = useMemo(() => new Map(linearize(d).map((x, i) => [x.id, i + 1])), [d]);
  const [sel, setSel] = useState<string | null>(null);
  const st = sel ? c.steps.get(sel) : null;
  return (
    <div className="ndb">
      <div className="ann-title">
        {c.valid ? <Prov kind="checked">Checked: {c.size} steps</Prov> : <Prov kind="failed">Rejected by the checker</Prov>}
        <span>
          <Tex tex={`${ex.gamma.map(ndTex).join(', ')} \\vdash ${ndTex(d.concl)}`} />
        </span>
      </div>
      <NDTree root={d} check={c} selected={sel} onSelect={(x) => setSel(x === sel ? null : x)} numbers={numbers} small />
      {st && (
        <p className="ndb-hint" aria-live="polite">
          Step {numbers.get(sel!)}: {st.ok ? 'accepted' : st.errors.map(ndMessage).join('; ')}. Depends on: {st.open.length ? st.open.map((o) => `${ndText(o.formula)}${o.label !== undefined ? ` [${o.label}]` : ''}`).join('; ') : 'nothing'}.
        </p>
      )}
      {c.errors.length > 0 && (
        <ul className="ndb-errors" style={{ fontSize: 13 }}>
          {c.errors.map((e, i) => (
            <li key={i}>
              step {numbers.get(e.id)}: {ndMessage(e.message)}
            </li>
          ))}
        </ul>
      )}
      {ex.incorrect && <p className="ndb-hint">The book gives this derivation as incorrect; the checker agrees.</p>}
      {ex.note && <p className="ndb-hint">{ex.note}</p>}
    </div>
  );
}
