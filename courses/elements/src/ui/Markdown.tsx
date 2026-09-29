// The modern texts rendered in React: prose from markdown-core, widgets mounted in place, and
// citation previews.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { byId, longLabel } from '../text';
import { modernTitle } from '../content/modern';
import { widgets } from '../widgets/registry';
import { mdToHtml, splitWidgets } from './markdown-core';

export { mdLabels, mdToHtml } from './markdown-core';

interface Props {
  src: string;
  /** Maps a label occurrence to its key and colour. */
  labelInfo?: (label: string, kind: string) => { key: string; colour?: string } | null;
  hoverKey?: string | null;
  onHover?: (k: string | null) => void;
  className?: string;
}

export function Markdown({ src, labelInfo, hoverKey, onHover, className }: Props) {
  const parts = useMemo(() => splitWidgets(src).map((p) => ('md' in p ? { html: mdToHtml(p.md) } : p)), [src]);
  const ref = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState<{ id: string; x: number; y: number } | null>(null);

  const decorate = (html: string) =>
    labelInfo
      ? html.replace(/<span class="lab linked md-lab" data-label="([^"]+)" data-kind="([^"]*)">/g, (m, l: string, k: string) => {
          const info = labelInfo(l, k);
          if (!info) return m.replace('lab linked', 'lab');
          return `<span class="lab linked md-lab${info.key === hoverKey ? ' hovered' : ''}" data-key="${info.key}"${info.colour ? ` style="color:${info.colour}"` : ''}>`;
        })
      : html;

  const over = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    const c = t.closest('[data-cite]') as HTMLElement | null;
    if (c && ref.current) {
      const r = c.getBoundingClientRect();
      const base = ref.current.getBoundingClientRect();
      setPop({ id: c.dataset.cite!, x: r.left - base.left, y: r.bottom - base.top });
    }
    const l = t.closest('[data-key]') as HTMLElement | null;
    if (l) onHover?.(l.dataset.key!);
  };
  const out = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-cite]')) setPop(null);
    if (t.closest('[data-key]')) onHover?.(null);
  };

  const nodes: ReactNode[] = parts.map((p, i) => {
    if ('html' in p) return <div key={i} className="md-chunk" dangerouslySetInnerHTML={{ __html: decorate(p.html) }} />;
    const W = widgets[p.widget];
    if (!W) return <div key={i} className="callout gap">Unknown widget “{p.widget}”</div>;
    return (
      <div key={i} className="md-widget">
        <W {...p.props} />
      </div>
    );
  });

  const e = pop ? byId.get(pop.id) : undefined;
  return (
    <div ref={ref} className={`md ${className ?? ''}`} onPointerOver={over} onPointerOut={out} style={{ position: 'relative' }}>
      {nodes}
      {pop && e && (
        <span className="cite-pop floating" style={{ left: pop.x, top: pop.y + 4 }} role="tooltip">
          <span className="cite-pop-head">
            {longLabel(pop.id)}
            {modernTitle(pop.id) && <span className="cite-pop-title"> · {modernTitle(pop.id)}</span>}
          </span>
          <span className="cite-pop-text">{e.text}</span>
        </span>
      )}
    </div>
  );
}
