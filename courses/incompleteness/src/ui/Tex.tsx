import katex from 'katex';
import { memo } from 'react';

const cache = new Map<string, string>();

export function texToHtml(tex: string, display = false): string {
  const key = (display ? 'D' : 'I') + tex;
  let html = cache.get(key);
  if (html === undefined) {
    try {
      html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false, output: 'htmlAndMathml' });
    } catch (e) {
      html = `<span class="tex-error">${String(e)}</span>`;
    }
    if (cache.size > 4000) cache.clear();
    cache.set(key, html);
  }
  return html;
}

/** KaTeX-rendered mathematics. */
export const Tex = memo(function Tex({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const Tag = display ? 'div' : 'span';
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: texToHtml(tex, display) }} />;
});
