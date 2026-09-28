// Computed panels attached to blocks of the book's text in Formal mode (chapter "Recursive Functions").

import { useMemo } from 'react';
import type { RF } from '../../engine/recursive/rf';
import { evaluate } from '../../engine/recursive/rf';
import { Added, Prov } from '../../ui/Prov';
import { Tex } from '../../ui/Tex';
import { CertificateView } from './Certificate';
import { DefTree } from './common';
import { ENTRIES } from './entries';

/** The official definition of a function of the library, as a tree, with a few values computed from it. */
export function OfficialDefinition({ name, samples }: { name: string; samples: bigint[][] }) {
  const entry = ENTRIES.find((e) => e.name === name)!;
  const f = useMemo(() => entry.build(), [entry]);
  const vals = useMemo(
    () =>
      samples.map((xs) => {
        const r = evaluate(f, xs, { fuel: 500_000, maxTraceDepth: -1 });
        return { xs, v: r.status === 'ok' ? r.value : undefined, calls: r.calls };
      }),
    [f, samples],
  );
  return (
    <Added label="Computed, from the official definition">
      <div className="ann-title sans">
        <b>
          The official definition of <Tex tex={entry.tex} />
        </b>{' '}
        <Prov kind="computed" />
      </div>
      <DefTree f={f} />
      <p className="sans small">
        Evaluated by this definition:{' '}
        {vals.map((v, i) => (
          <span key={i}>
            <Tex tex={`${entry.tex}(${v.xs.join(', ')}) = ${v.v ?? '?'}`} /> <span className="muted">({v.calls.toLocaleString('en-US')} calls)</span>
            {i < vals.length - 1 ? '; ' : '.'}
          </span>
        ))}
      </p>
    </Added>
  );
}

export function WhyPrimitiveRecursive({ f, title }: { f: RF; title: string }) {
  return (
    <Added label="Added for this edition">
      <div className="ann-title sans">
        <b>{title}</b> <Prov kind="computed" />
      </div>
      <CertificateView f={f} />
    </Added>
  );
}
