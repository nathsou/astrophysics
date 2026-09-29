/** The hover card: type, doc comment and hardware cost of what is under the pointer. */
import { hoverTooltip, type Tooltip } from '@codemirror/view';
import type { Analysis } from './analysis';
import { hoverAt } from './queries';

export function hoverDom(h: NonNullable<ReturnType<typeof hoverAt>>): HTMLElement {
  const el = document.createElement('div');
  el.className = 'dcl-hover';
  const add = (cls: string, text: string, tag = 'div') => {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    el.append(e);
  };
  if (h.what) add('what', h.what);
  if (h.signature) add('sig', h.signature, 'code');
  if (h.doc) add('doc', h.doc);
  if (h.cost) add('cost', h.cost);
  if (h.construct) add('cost', h.construct);
  return el;
}

/** A hover extension that reads the analysis lazily (it may still be null while the first one runs). */
export function dclHover(get: () => Analysis | undefined) {
  return hoverTooltip(
    (view, pos): Tooltip | null => {
      const a = get();
      if (!a) return null;
      // A stale analysis (the text has changed since) would point at the wrong things.
      if (a.source !== view.state.doc.toString()) return null;
      const h = hoverAt(a, pos);
      if (!h) return null;
      return { pos: h.from, end: h.to, above: true, create: () => ({ dom: hoverDom(h) }) };
    },
    { hoverTime: 250 },
  );
}
