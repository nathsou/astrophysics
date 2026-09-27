// Renders the structured upstream text (src/content/source/*.json).

import { Fragment, useState, type ReactNode } from 'react';
import type { Block, EnvKind, Inline, ProofTreeNode, SourceLoc } from '../content/schema';
import { assembleDisplay } from './display';
import { Tex } from '../ui/Tex';
import { Prov } from '../ui/Prov';
import { inspect } from '../ui/store';
import { sourceIndex, sourceUrl, loadUpstreamLines } from '../content/source';

export type Annotations = Record<string, ReactNode>;

export interface FormalContext {
  sectionId: string;
  annotations?: Annotations;
}

const ENV_LABEL: Partial<Record<EnvKind, string>> = {
  defn: 'Definition', prop: 'Proposition', thm: 'Theorem', lem: 'Lemma', cor: 'Corollary', ex: 'Example', prob: 'Problem',
  rem: 'Remark', conv: 'Convention', explain: 'Explanation', digress: 'Digression', history: 'History', intro: 'Introduction',
};

const THEOREMISH = new Set<EnvKind>(['prop', 'thm', 'lem', 'cor']);

/** The key under which annotations attach to a block: its label, or section:kind:ordinal. */
export function annotationKeys(sectionId: string, blocks: Block[]): Map<Block, string> {
  const keys = new Map<Block, string>();
  const counts = new Map<string, number>();
  for (const b of blocks) {
    if (b.t !== 'env') continue;
    const n = (counts.get(b.kind) ?? 0) + 1;
    counts.set(b.kind, n);
    keys.set(b, b.label ?? `${sectionId}:${b.kind}:${n}`);
  }
  return keys;
}

export function FormalBlocks({ blocks, ctx }: { blocks: Block[]; ctx: FormalContext }) {
  const keys = annotationKeys(ctx.sectionId, blocks);
  return (
    <>
      {blocks.map((b) => {
        const key = keys.get(b);
        const note = key ? ctx.annotations?.[key] : undefined;
        return (
          <Fragment key={b.id}>
            <BlockView b={b} ctx={ctx} />
            {note && <div className="annotation">{note}</div>}
          </Fragment>
        );
      })}
    </>
  );
}

function BlockView({ b, ctx }: { b: Block; ctx: FormalContext }): ReactNode {
  switch (b.t) {
    case 'p':
      return (
        <p className="ol-p" id={anchor(b.id)}>
          <Inlines c={b.c} />
        </p>
      );
    case 'display':
      return (
        <div className="ol-display" id={anchor(b.id)}>
          {b.rows.filter((r) => r.label).map((r) => <span key={r.label} id={anchor(r.label!)} />)}
          {b.error ? <span className="tex-error" title={b.error}>{b.src}</span> : <Tex tex={assembleDisplay(b.env, b.rows)} display />}
        </div>
      );
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul';
      return (
        <Tag className="ol-list" id={anchor(b.id)}>
          {b.items.map((it) => (
            <li key={it.id} id={it.label ? anchor(it.label) : undefined} className={it.marker ? 'has-marker' : undefined}>
              {it.marker && (
                <span className="ol-marker">
                  <Inlines c={it.marker} />
                </span>
              )}
              <FormalBlocks blocks={it.c} ctx={ctx} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'table':
      return (
        <div className="ol-table-wrap" id={anchor(b.id)}>
          <table className="ol-table">
            <tbody>
              {b.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>
                      <Inlines c={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'prooftree':
      return (
        <div className="ol-tree" id={anchor(b.id)}>
          <TreeNode n={b.root} />
        </div>
      );
    case 'env':
      return <EnvView b={b} ctx={ctx} />;
  }
}

function EnvView({ b, ctx }: { b: Extract<Block, { t: 'env' }>; ctx: FormalContext }) {
  const name = ENV_LABEL[b.kind];
  const id = anchor(b.label ?? b.id);
  if (b.kind === 'proof') {
    return (
      <div className="ol-proof" id={id}>
        <span className="ol-proof-head">
          {b.title ? <Inlines c={b.title} /> : 'Proof'}.
        </span>{' '}
        <FormalBlocks blocks={b.c} ctx={ctx} />
        <span className="qed" aria-label="end of proof">∎</span>
        <SourceTag loc={b.loc} />
      </div>
    );
  }
  if (b.kind === 'quote' || b.kind === 'center') {
    return (
      <blockquote className={`ol-${b.kind}`} id={id}>
        <FormalBlocks blocks={b.c} ctx={ctx} />
      </blockquote>
    );
  }
  const numbered = b.number !== undefined;
  return (
    <section className={`ol-env ol-${b.kind} ${numbered ? 'numbered' : 'aside'}`} id={id} aria-label={`${name ?? b.kind} ${b.number ?? ''}`}>
      <header className="ol-env-head">
        <span className="ol-env-name">
          {name} {b.number}
        </span>
        {b.title && (
          <span className="ol-env-title">
            (<Inlines c={b.title} />)
          </span>
        )}
        {THEOREMISH.has(b.kind) && <Prov kind="theorem">general result</Prov>}
        <SourceTag loc={b.loc} />
      </header>
      <div className="ol-env-body">
        <FormalBlocks blocks={b.c} ctx={ctx} />
      </div>
    </section>
  );
}

function TreeNode({ n }: { n: ProofTreeNode }) {
  return (
    <div className="tree-node">
      {n.premises.length > 0 && (
        <div className="tree-premises">
          {n.premises.map((p, i) => (
            <TreeNode key={i} n={p} />
          ))}
        </div>
      )}
      <div className={`tree-concl line-${n.line}`}>
        {n.left && (
          <span className="tree-left">
            <Inlines c={n.left} />
          </span>
        )}
        <span className="tree-formula">
          <Inlines c={n.c} />
        </span>
        {n.right && (
          <span className="tree-right">
            <Inlines c={n.right} />
          </span>
        )}
      </div>
    </div>
  );
}

export function Inlines({ c }: { c: Inline[] }): ReactNode {
  return (
    <>
      {c.map((x, i) => (
        <InlineView key={i} x={x} />
      ))}
    </>
  );
}

function InlineView({ x }: { x: Inline }): ReactNode {
  switch (x.t) {
    case 'text':
      return x.v;
    case 'math':
      return x.error ? (
        <span className="tex-error" title={`Could not render: ${x.error}`}>
          {x.src}
        </span>
      ) : (
        <Tex tex={x.tex} />
      );
    case 'em':
      return (
        <em>
          <Inlines c={x.c} />
        </em>
      );
    case 'strong':
      return (
        <strong>
          <Inlines c={x.c} />
        </strong>
      );
    case 'quote':
      return (
        <>
          {x.single ? '‘' : '“'}
          <Inlines c={x.c} />
          {x.single ? '’' : '”'}
        </>
      );
    case 'term':
      return <span className="ol-term">{x.v}</span>;
    case 'ref':
      return <Ref k={x.key} />;
    case 'cite':
      return <span className="ol-cite">[{x.keys.join('; ')}]</span>;
    case 'link':
      return (
        <a href={x.href} target="_blank" rel="noreferrer">
          <Inlines c={x.c} />
        </a>
      );
    case 'footnote':
      return <Footnote c={x.c} />;
    case 'unsupported':
      return (
        <span className="ol-unsupported" title="The converter could not translate this LaTeX; it is shown as written.">
          {x.raw}
        </span>
      );
  }
}

function Footnote({ c }: { c: Block[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="ol-footnote">
      <button className="fn-mark" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Footnote">
        *
      </button>
      {open && (
        <span className="fn-body">
          {c.map((b) => (b.t === 'p' ? <Inlines key={b.id} c={b.c} /> : null))}
        </span>
      )}
    </span>
  );
}

export function Ref({ k }: { k: string }) {
  const target = sourceIndex.labels[k];
  if (!target) {
    return (
      <span className="ol-ref external" title={`${k} — in a part of the book not included in this edition yet`}>
        [{k.split(':').slice(3).join(':') || k}]
      </span>
    );
  }
  const at = target.kind === 'section' || target.kind === 'chapter' ? '' : `&at=${anchor(k)}`;
  const href = `#/s/${target.sectionId}?mode=formal${at}`;
  return (
    <a className="ol-ref" href={href}>
      {target.text}
    </a>
  );
}

export function anchor(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

/** A small link to the exact lines of the upstream LaTeX, and a way to view them. */
export function SourceTag({ loc }: { loc: SourceLoc }) {
  const url = sourceUrl(loc);
  const where = `${loc.file.split('/').pop()}:${loc.line}${loc.endLine !== loc.line ? `–${loc.endLine}` : ''}`;
  return (
    <span className="source-tag">
      <button
        className="source-btn"
        title={`View the LaTeX source (${where})`}
        onClick={async () => {
          inspect({ key: `src:${where}`, kicker: 'LaTeX source', title: where, body: <p className="muted">Loading…</p> }, true);
          const lines = await loadUpstreamLines(loc);
          inspect(
            {
              key: `src:${where}:loaded`,
              kicker: 'LaTeX source',
              title: where,
              body: (
                <>
                  <p className="muted">
                    {loc.repo} · pinned commit · <a href={url} target="_blank" rel="noreferrer">open on GitHub ↗</a>
                  </p>
                  <pre className="latex-src">{lines}</pre>
                </>
              ),
            },
            true,
          );
        }}
      >
        ¶ {where}
      </button>
    </span>
  );
}
