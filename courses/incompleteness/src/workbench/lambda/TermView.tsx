// An interactive lambda term. It renders the engine's print tokens (so the layout and the
// parentheses are exactly the engine's), and uses the node ids they carry to
//   - link a binder and the occurrences it binds (hover or focus either),
//   - offer each redex (λx.M)N as a button on its λ (click to contract),
//   - offer each binder as a button (click to α-rename),
//   - mark what the last step changed: the contractum, the copies of the argument, renamed variables.

import { useMemo, useState } from 'react';
import { binderMap, numeralOfLabel, printTokens, print, type LambdaPrintOptions, type NodeId, type PrintToken, type Redex, type Term } from '../../engine/lambda/lambda';
import './lambda.css';

export interface TermMarks {
  /** Root of the contractum of the last step. */
  contractum?: NodeId;
  /** Nodes that are copies of the argument of the last redex. */
  copies?: ReadonlySet<NodeId>;
  /** Variables and binders renamed by the last step. */
  renamed?: ReadonlySet<NodeId>;
}

export interface TermViewProps {
  term: Term;
  opts?: LambdaPrintOptions;
  redexes?: Redex[];
  onContract?: (redex: Redex) => void;
  onBinder?: (absId: NodeId) => void;
  /** The redex a strategy would contract next. */
  next?: NodeId | null;
  /** A redex highlighted from outside (e.g. hovering it in a list). */
  highlight?: NodeId | null;
  marks?: TermMarks;
  /** Largest number of tokens rendered interactively (default 2500). */
  maxTokens?: number;
  ariaLabel?: string;
}

function tokenText(t: PrintToken) {
  if (t.kind === 'label') {
    const n = numeralOfLabel(t.text);
    if (n !== null) return <span className="lam-num">{n}</span>;
  }
  return t.text;
}

export function TermView({ term, opts = {}, redexes, onContract, onBinder, next, highlight, marks, maxTokens = 2500, ariaLabel }: TermViewProps) {
  const tokens = useMemo(() => printTokens(term, opts), [term, opts]);
  const binders = useMemo(() => binderMap(term), [term]);
  const redexByAbs = useMemo(() => new Map((redexes ?? []).map((r) => [r.abs, r])), [redexes]);
  const [hover, setHover] = useState<{ kind: 'bind'; binder: NodeId } | { kind: 'free'; name: string } | { kind: 'redex'; id: NodeId } | null>(null);

  if (tokens.length > maxTokens) {
    const text = print(term, opts);
    return (
      <div className="lam-term lam-term-plain" aria-label={ariaLabel}>
        <p className="wb-note">This term has {tokens.length} symbols; it is shown as plain text (the first 4000 characters), without the interactive links.</p>
        <code>{text.length > 4000 ? `${text.slice(0, 4000)}…` : text}</code>
      </div>
    );
  }

  const redexHi = hover?.kind === 'redex' ? hover.id : (highlight ?? null);
  const classes = (t: PrintToken): string => {
    const c: string[] = [`lam-t-${t.kind}`];
    if (redexHi && t.owners.includes(redexHi)) c.push('lam-in-redex');
    if (next && t.owners.includes(next)) c.push('lam-in-next');
    if (marks?.contractum && t.owners.includes(marks.contractum)) c.push('lam-in-contractum');
    if (marks?.copies?.has(t.id)) c.push('lam-copy');
    if (marks?.renamed?.has(t.id)) c.push('lam-renamed');
    if (hover?.kind === 'bind') {
      if ((t.kind === 'binder' && t.id === hover.binder) || (t.kind === 'var' && binders.get(t.id) === hover.binder)) c.push('lam-linked');
    } else if (hover?.kind === 'free' && t.kind === 'var' && binders.get(t.id) === null && t.text === hover.name) c.push('lam-linked');
    return c.join(' ');
  };
  const leave = () => setHover(null);

  return (
    <div className="lam-term" role="group" aria-label={ariaLabel ?? 'λ-term'} onMouseLeave={leave}>
      {tokens.map((t, i) => {
        const cls = classes(t);
        const r = (t.kind === 'lambda' || t.kind === 'label') && t.id ? redexByAbs.get(t.id) : undefined;
        if (r && onContract) {
          return (
            <button
              key={i}
              type="button"
              className={`${cls} lam-handle`}
              onMouseEnter={() => setHover({ kind: 'redex', id: r.id })}
              onFocus={() => setHover({ kind: 'redex', id: r.id })}
              onBlur={leave}
              onClick={() => onContract(r)}
              aria-label={`Contract the redex whose function binds ${r.param}${r.leftmostOutermost ? ' (leftmost-outermost)' : ''}`}
              title={`Contract this redex: (λ${r.param}.M) N → M[N/${r.param}]`}
            >
              {tokenText(t)}
            </button>
          );
        }
        if (t.kind === 'binder') {
          const enter = () => setHover({ kind: 'bind', binder: t.id });
          return onBinder ? (
            <button key={i} type="button" className={`${cls} lam-binder-btn`} onMouseEnter={enter} onFocus={enter} onBlur={leave} onClick={() => onBinder(t.id)} aria-label={`Bound variable ${t.text}: rename it`} title="Hover: see what this λ binds. Click: rename it (α-conversion).">
              {t.text}
            </button>
          ) : (
            <span key={i} className={cls} onMouseEnter={enter}>
              {t.text}
            </span>
          );
        }
        if (t.kind === 'var') {
          const b = binders.get(t.id) ?? null;
          return (
            <span key={i} className={`${cls} ${b ? 'lam-bound' : 'lam-free'}`} onMouseEnter={() => setHover(b ? { kind: 'bind', binder: b } : { kind: 'free', name: t.text })} title={b ? 'bound' : 'free'}>
              {t.text}
            </span>
          );
        }
        return (
          <span key={i} className={cls}>
            {tokenText(t)}
          </span>
        );
      })}
    </div>
  );
}

/** A term as static text (no interaction), with numerals drawn with a bar; long terms are cut. */
export function TermInline({ term, opts = {}, max = 160 }: { term: Term; opts?: LambdaPrintOptions; max?: number }) {
  const toks = useMemo(() => printTokens(term, opts), [term, opts]);
  let len = 0;
  const out: PrintToken[] = [];
  for (const t of toks) {
    if (len + t.text.length > max) break;
    out.push(t);
    len += t.text.length;
  }
  return (
    <span className="lam-inline">
      {out.map((t, i) => (
        <span key={i} className={`lam-t-${t.kind}`}>
          {tokenText(t)}
        </span>
      ))}
      {out.length < toks.length && '…'}
    </span>
  );
}
