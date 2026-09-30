/**
 * DCL code as static HTML, with the same structure as the Shiki blocks of the other languages
 * (`<pre class="shiki …"><code><span class="line">…`), so the page's code-block styles apply. Colours come
 * from the `--code-*` design tokens through the `--shiki-light` / `--shiki-dark` variables that
 * `.shiki span` reads (app.css), so both themes follow the tokens and there is one grammar: the
 * compiler's lexer (`../highlight.ts`).
 *
 * Node-importable (the Markdown compiler calls it at build time): explicit `.ts` extensions, no other imports.
 */
import { tokenize, type HighlightKind } from '../highlight.ts';

const TOKEN: Record<HighlightKind, string | undefined> = {
  keyword: '--code-keyword',
  type: '--code-type',
  number: '--code-number',
  string: '--code-string',
  comment: '--code-comment',
  doc: '--code-comment',
  operator: '--code-punct',
  punctuation: '--code-punct',
  identifier: undefined,
  function: '--code-fn',
  module: '--code-type',
};

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The CSS custom property that holds the colour of a kind of token (the editor uses the same). */
export const tokenColourVar = (kind: HighlightKind): string | undefined => TOKEN[kind];

/** Highlights one line of a token stream into `<span>`s. */
function span(text: string, kind: HighlightKind): string {
  const v = TOKEN[kind];
  if (!v) return escape(text);
  const italic = kind === 'comment' || kind === 'doc' ? ';font-style:italic' : '';
  const bold = kind === 'doc' ? ';font-weight:500' : '';
  return `<span class="tok-${kind}" style="--shiki-light:var(${v});--shiki-dark:var(${v})${italic}${bold}">${escape(text)}</span>`;
}

/** A DCL source text as the HTML of a code block (without the surrounding `<figure>`). */
export function highlightDclHtml(code: string): string {
  const src = code.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  const tokens = tokenize(src);
  // Cut the source into pieces at every token boundary and at newlines, then group the pieces by line.
  const lines: string[] = [];
  let line = '';
  const emit = (text: string, kind?: HighlightKind) => {
    const parts = text.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) {
        lines.push(line);
        line = '';
      }
      if (part) line += kind ? span(part, kind) : escape(part);
    });
  };
  let pos = 0;
  for (const t of tokens) {
    if (t.from < pos) continue;
    if (t.from > pos) emit(src.slice(pos, t.from));
    emit(src.slice(t.from, t.to), t.kind);
    pos = t.to;
  }
  if (pos < src.length) emit(src.slice(pos));
  lines.push(line);
  const body = lines.map((l) => `<span class="line">${l}</span>`).join('\n');
  return `<!-- svelte-ignore a11y_no_noninteractive_tabindex --><pre class="shiki shiki-themes bench-light bench-dark dcl" style="--shiki-light:var(--code-def);--shiki-dark:var(--code-def);--shiki-light-bg:var(--pn);--shiki-dark-bg:var(--pn)" tabindex="0"><code>${body}</code></pre>`;
}
