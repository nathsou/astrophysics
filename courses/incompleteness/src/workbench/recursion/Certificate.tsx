// Why a definition is primitive recursive: the clause of the inductive definition that applies at
// each node, with the arity conditions it needs.

import { useState, type ReactNode } from 'react';
import type { RF } from '../../engine/recursive/rf';
import { arity } from '../../engine/recursive/rf';
import { certificate, stage, type Certificate } from '../../engine/computability/primrec';
import { Tex } from '../../ui/Tex';
import { Prov } from '../../ui/Prov';
import { Ref } from '../../formal/FormalText';
import { nameTex } from './common';

const CLAUSE: Record<number, string> = {
  0: 'basic function of chapter 4',
  1: 'clause 1: zero',
  2: 'clause 2: succ',
  3: 'clause 3: projection',
  4: 'clause 4: composition',
  5: 'clause 5: primitive recursion',
};

function condition(c: Certificate): ReactNode {
  const n = c.node;
  if (n.k === 'comp') {
    const k = n.gs.length;
    const fa = arity(n.f);
    return (
      <>
        <Tex tex={`f`} /> is {fa.ok ? fa.arity : '?'}-place and there {k === 1 ? 'is' : 'are'} {k} inner function{k === 1 ? '' : 's'}, {k === 1 ? '' : 'all '}{c.arity}-place ✓
      </>
    );
  }
  if (n.k === 'rec') {
    const k = c.arity - 1;
    return (
      <>
        <Tex tex="f" /> is {k}-place (<Tex tex="k \ge 1" />), <Tex tex="g" /> is {k + 2}-place ✓
      </>
    );
  }
  if (n.k === 'basic') return <>primitive recursive by the definitions in <Ref k="cmp:rec:exa:sec" /> (it abbreviates one)</>;
  return null;
}

export function CertificateView({ f }: { f: RF }) {
  const c = certificate(f);
  if (!c.ok) {
    return (
      <div className="rc-cert">
        <p className="wb-note danger">Not a primitive recursive definition: {c.errors[0]?.message}.</p>
      </div>
    );
  }
  const s = stage(f);
  return (
    <div className="rc-cert">
      <p className="wb-note">
        Read from the leaves up, this is the argument that the function is primitive recursive, in the form of the book’s proof for <Tex tex="\mathrm{add}" />: each node is
        justified by one clause of the definition from the nodes below it.{' '}
        {s !== null && (
          <>
            The definition appears at stage <Tex tex={`S_{${s}}`} /> (a basic function is at stage 0; each composition or recursion adds one).
          </>
        )}
      </p>
      <CertNode c={c.cert} depth={0} />
      <p className="sans small muted">
        <Prov kind="computed" /> built by checking the definition node by node.
      </p>
    </div>
  );
}

function CertNode({ c, depth }: { c: Certificate; depth: number }): ReactNode {
  const [open, setOpen] = useState(depth < 3);
  const cond = condition(c);
  const s = stage(c.node);
  return (
    <div className="rc-node">
      <div className="rc-line">
        {c.children.length > 0 ? (
          <button className="rc-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={open ? 'fold' : 'unfold'}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="rc-toggle-space" aria-hidden="true" />
        )}
        {c.name ? <Tex tex={c.name.tex} /> : <Tex tex={c.children.length ? (c.node.k === 'comp' ? '\\mathrm{Comp}' : '\\mathrm{Rec}') : nameTex(c.node)} />}
        <span className="rc-tag clause">{CLAUSE[c.clause]}</span>
        <span className="rc-tag">{c.arity}-place</span>
        {s !== null && <span className="rc-tag">stage {s}</span>}
        {cond && <span className="rc-hint">{cond}</span>}
      </div>
      {open && c.children.length > 0 && (
        <div className="rc-children">
          {c.children.map((ch) => (
            <CertNode key={ch.id} c={ch} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
