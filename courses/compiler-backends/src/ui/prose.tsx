import type { ReactNode } from 'react';
import { GLOSSARY } from '../content/glossary';
import { hideTip, showTip } from './store';
import { ErrorBoundary } from './ErrorBoundary';

export function Figure({ title, caption, children, wide = true, controls, id }: { title?: ReactNode; caption?: ReactNode; children: ReactNode; wide?: boolean; controls?: ReactNode; id?: string }) {
  return (
    <figure className={`figure ${wide ? 'wide' : ''}`} id={id} style={{ marginLeft: 0, marginRight: 0 }}>
      <div className="figure-body">
        {(title || controls) && (
          <div className="figure-head">
            {title && <span className="title">{title}</span>}
            {controls}
          </div>
        )}
        <ErrorBoundary label="figure">{children}</ErrorBoundary>
      </div>
      {caption && <figcaption className="figure-caption">{caption}</figcaption>}
    </figure>
  );
}

const KIND_LABEL = { history: 'History', llvm: 'In real compilers', note: 'Note', arch: 'Architecture' } as const;

export function Aside({ kind = 'note', title, children }: { kind?: keyof typeof KIND_LABEL; title?: string; children: ReactNode }) {
  return (
    <aside className={`aside ${kind}`}>
      <span className="aside-kind">{title ?? KIND_LABEL[kind]}</span>
      {children}
    </aside>
  );
}

export function Callout({ kind = 'key', title, children }: { kind?: 'key' | 'try' | 'plain'; title?: string; children: ReactNode }) {
  return (
    <div className={`callout ${kind}`}>
      {(title || kind !== 'plain') && <span className="callout-title">{title ?? (kind === 'key' ? 'Key idea' : 'Try it')}</span>}
      {children}
    </div>
  );
}

export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const g = GLOSSARY[k];
  const reveal = (el: Element) => g && showTip(el, { info: { kind: 'term', term: k } });
  return <button type="button" className="term" aria-description={g?.def}
    onMouseEnter={e => reveal(e.currentTarget)} onMouseLeave={e => { if (document.activeElement !== e.currentTarget) hideTip(); }}
    onFocus={e => reveal(e.currentTarget)} onBlur={hideTip} onClick={e => reveal(e.currentTarget)}
    onKeyDown={e => { if (e.key === 'Escape') hideTip(); }}>{children ?? g?.term}</button>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd style={{ fontFamily: 'var(--mono)', fontSize: '0.8em', border: '1px solid var(--rule-2)', borderBottomWidth: 2, borderRadius: 5, padding: '0 5px', background: 'var(--panel)' }}>{children}</kbd>;
}

/** Small inline code-ish chip that explains itself on hover. */
export function Tip({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  const reveal = (el: Element) => showTip(el, { info: { kind: 'text', title, body } });
  return <button type="button" className="term" aria-description={body}
    onMouseEnter={e => reveal(e.currentTarget)} onMouseLeave={e => { if (document.activeElement !== e.currentTarget) hideTip(); }}
    onFocus={e => reveal(e.currentTarget)} onBlur={hideTip} onClick={e => reveal(e.currentTarget)}
    onKeyDown={e => { if (e.key === 'Escape') hideTip(); }}>{children}</button>;
}
