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
  reading: 'Further reading',
};

const THEOREMISH = new Set<EnvKind>(['prop', 'thm', 'lem', 'cor']);

/** The key under which annotations attach to a block: its label, or section:kind:ordinal. */
export function annotationKeys(sectionId: string, blocks: Block[]): Map<Block, string> {
  const keys = new Map<Block, string>();
  const counts = new Map<string, number>();
  for (const b of blocks) {
    // Paragraphs are keyed by their block id (e.g. `sol.set.crd/p12`), which is unique in the book.
    if (b.t === 'p') {
      keys.set(b, b.id);
      continue;
    }
    // Environments by label, or by kind and position (`section:kind:n`).
    if (b.t !== 'env') continue;
    const n = (counts.get(b.kind) ?? 0) + 1;
    counts.set(b.kind, n);
    keys.set(b, b.label ?? `${sectionId}:${b.kind}:${n}`);
  }
  return keys;
}

/** `qed`: set the end-of-proof mark at the end of the last line of the last block. */
export function FormalBlocks({ blocks, ctx, qed = false }: { blocks: Block[]; ctx: FormalContext; qed?: boolean }) {
  const keys = annotationKeys(ctx.sectionId, blocks);
  return (
    <>
      {blocks.map((b, i) => {
        const key = keys.get(b);
        const note = key ? ctx.annotations?.[key] : undefined;
        return (
          <Fragment key={b.id}>
            <BlockView b={b} ctx={ctx} qed={qed && i === blocks.length - 1} />
            {note && <div className="annotation">{note}</div>}
          </Fragment>
        );
      })}
    </>
  );
}

/** The end-of-proof mark (∎), placed by CSS at the right edge of the line it ends. */
function Qed() {
  return (
    <span className="qed" role="img" aria-label="end of proof">
      ∎
    </span>
  );
}

function BlockView({ b, ctx, qed = false }: { b: Block; ctx: FormalContext; qed?: boolean }): ReactNode {
  const q = qed ? ' has-qed' : '';
  switch (b.t) {
    case 'p':
      return (
        <p className={`ol-p${q}`} id={anchor(b.id)}>
          <Inlines c={b.c} />
          {qed && <Qed />}
        </p>
      );
    case 'display':
      return (
        <div className={`ol-display${q}`} id={anchor(b.id)}>
          {b.rows.filter((r) => r.label).map((r) => <span key={r.label} id={anchor(r.label!)} />)}
          {b.error ? <span className="tex-error" title={b.error}>{b.src}</span> : <Tex tex={assembleDisplay(b.env, b.rows)} display />}
          {qed && <Qed />}
        </div>
      );
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul';
      return (
        <Tag className="ol-list" id={anchor(b.id)}>
          {b.items.map((it, i) => (
            <li key={it.id} id={it.label ? anchor(it.label) : undefined} className={it.marker ? 'has-marker' : undefined}>
              {it.marker && (
                <span className="ol-marker">
                  <Inlines c={it.marker} />
                </span>
              )}
              <FormalBlocks blocks={it.c} ctx={ctx} qed={qed && i === b.items.length - 1} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'table':
      return (
        <div className={`ol-table-wrap${q}`} id={anchor(b.id)}>
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
          {qed && <Qed />}
        </div>
      );
    case 'heading': {
      const H = b.level === 3 ? 'h3' : 'h4';
      return (
        <H className={`ol-heading${q}`} id={anchor(b.id)}>
          <Inlines c={b.c} />
          {qed && <Qed />}
        </H>
      );
    }
    case 'prooftree':
      return (
        <div className={`ol-tree${q}`} id={anchor(b.id)}>
          <TreeNode n={b.root} />
          {qed && <Qed />}
        </div>
      );
    case 'env':
      return <EnvView b={b} ctx={ctx} qed={qed} />;
  }
}

function EnvView({ b, ctx, qed = false }: { b: Extract<Block, { t: 'env' }>; ctx: FormalContext; qed?: boolean }) {
  const name = ENV_LABEL[b.kind];
  const id = anchor(b.label ?? b.id);
  if (b.kind === 'proof') {
    // A proof ending a proof (rare) keeps one mark: the inner one.
    const head = b.title ? <Inlines c={b.title} /> : 'Proof';
    return (
      <div className="ol-proof" id={id}>
        <SourceLabel loc={b.loc} className="ol-proof-head" name="Proof">
          {head}.
        </SourceLabel>{' '}
        <FormalBlocks blocks={b.c} ctx={ctx} qed />
        <SourceTag loc={b.loc} />
      </div>
    );
  }
  if (b.kind === 'defish') {
    return (
      <div className={`ol-defish${qed ? ' has-qed' : ''}`} id={id}>
        <FormalBlocks blocks={b.c} ctx={ctx} />
        {qed && <Qed />}
      </div>
    );
  }
  if (b.kind === 'quote' || b.kind === 'center') {
    return (
      <blockquote className={`ol-${b.kind}`} id={id}>
        <FormalBlocks blocks={b.c} ctx={ctx} qed={qed} />
      </blockquote>
    );
  }
  const numbered = b.number !== undefined;
  const heading = `${name ?? b.kind}${b.number !== undefined ? ` ${b.number}` : ''}`;
  return (
    <section className={`ol-env ol-${b.kind} ${numbered ? 'numbered' : 'aside'}`} id={id} aria-label={heading}>
      <header className="ol-env-head">
        <SourceLabel loc={b.loc} className="ol-env-name" name={heading}>
          {name} {b.number}
        </SourceLabel>
        {b.title && (
          <span className="ol-env-title">
            (<Inlines c={b.title} />)
          </span>
        )}
        {THEOREMISH.has(b.kind) && <Prov kind="theorem">general result</Prov>}
        <SourceTag loc={b.loc} />
      </header>
      <div className="ol-env-body">
        <FormalBlocks blocks={b.c} ctx={ctx} qed={qed} />
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
  const out: ReactNode[] = [];
  for (let i = 0; i < c.length; i++) {
    const x = c[i];
    const next = c[i + 1];
    // Keep math glued to a following hyphenated word ("λ-definable", "Σ1-complete"): the line
    // must not break between the formula and the hyphen.
    if (x.t === 'math' && next?.t === 'text' && /^[-‐–]\S/.test(next.v)) {
      const m = /^(\S+)([\s\S]*)$/.exec(next.v)!;
      out.push(
        <span key={i} className="nowrap">
          <InlineView x={x} />
          {m[1]}
        </span>,
      );
      if (m[2]) out.push(<Fragment key={`${i}+`}>{m[2]}</Fragment>);
      i++;
    } else out.push(<InlineView key={i} x={x} />);
  }
  return <>{out}</>;
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

function sourceWhere(loc: SourceLoc): string {
  return `${loc.file.split('/').pop()}:${loc.line}${loc.endLine !== loc.line ? `–${loc.endLine}` : ''}`;
}

/** Show the exact lines of the upstream LaTeX in the inspector (pinned). */
async function showSource(loc: SourceLoc) {
  const url = sourceUrl(loc);
  const where = sourceWhere(loc);
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
}

/**
 * The label of a theorem, definition or proof ("Lemma 5.3", "Proof."), which also opens its
 * LaTeX source in the inspector — the way to it on touch screens, where the source tag is hidden.
 */
function SourceLabel({ loc, className, name, children }: { loc: SourceLoc; className: string; name: string; children: ReactNode }) {
  return (
    <button type="button" className={`${className} ol-label-btn`} onClick={() => showSource(loc)} title={`${name}: view its LaTeX source (${sourceWhere(loc)})`} aria-label={`${name}: view its LaTeX source`}>
      {children}
    </button>
  );
}

/** A small link to the exact lines of the upstream LaTeX, and a way to view them. */
export function SourceTag({ loc }: { loc: SourceLoc }) {
  const where = sourceWhere(loc);
  return (
    <span className="source-tag">
      <button className="source-btn" title={`View the LaTeX source (${where})`} onClick={() => showSource(loc)}>
        ¶ {where}
      </button>
    </span>
  );
}
