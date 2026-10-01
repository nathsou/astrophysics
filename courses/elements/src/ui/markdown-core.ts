// Markdown for the modern versions (no React here, so the tests can use it), with a few extensions:
//
//   $…$, $$…$$            KaTeX
//   [[1.47]]              a citation (item id), previewed on hover; [[1.47|text]] with other text
//   @AB, @angle(ABC)      a label linked to the figure, like the labels of Heath's text;
//                         the kind may be angle, triangle, circle, arc, figure, line, point, solid, plane, number
//   :::gap Title … :::    a callout: gap (rigour), code (a programmer's view), history, leads (where it leads), note, modern
//   ::widget-name{a=1}    an interactive widget on a line of its own

import katex from 'katex';
import { Marked } from 'marked';
import { highlightCode } from './code-highlight';
import { byId, citeLabel, hrefOf } from '../text';
import type { Kind } from '../geometry/resolve';

export const marked = new Marked({ gfm: true, breaks: false });

export interface MdLabel {
  label: string;
  kind: Kind;
}

const CALLOUTS: Record<string, string> = {
  gap: 'A gap in the argument',
  code: 'A programmer’s view',
  history: 'History',
  leads: 'Where it leads',
  note: 'Note',
  modern: 'Modern proof',
};

export const mathErrors: string[] = [];

export function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: false, output: 'html' });
  } catch (e) {
    mathErrors.push(`${tex}: ${(e as Error).message}`);
    return `<span class="math-error" title="${escapeHtml(String((e as Error).message))}">${escapeHtml(tex)}</span>`;
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

marked.use({ renderer: {
  code({ text, lang }) {
    const language = lang?.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    const html = ['ts', 'typescript', 'js', 'javascript'].includes(language) ? highlightCode(text, escapeHtml) : escapeHtml(text);
    return `<pre tabindex="0"><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${html}\n</code></pre>\n`;
  },
} });

/** Markdown (with the extensions above, but no widgets) to HTML. */
export function mdToHtml(src: string): string {
  const stash: string[] = [];
  const keep = (html: string) => `\u0000${stash.push(html) - 1}\u0000`;
  let s = src;
  // code first, so that $ and @ inside code are left alone
  s = s.replace(/```[\s\S]*?```/g, (m) => `\n\n${keep(marked.parse(m) as string)}\n\n`);
  s = s.replace(/`[^`\n]+`/g, (m) => keep(`<code>${escapeHtml(m.slice(1, -1))}</code>`));
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, t: string) => keep(renderMath(t.trim(), true)));
  s = s.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_, pre: string, t: string) => pre + keep(renderMath(t, false)));
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_, id: string) => {
    const [ref, text] = id.split('|');
    const e = byId.get(ref.trim());
    return keep(e ? `<a class="cite k-${e.kind}" href="${hrefOf(ref.trim())}" data-cite="${ref.trim()}">${escapeHtml(text ?? citeLabel(ref.trim()))}</a>` : `<span class="cite missing">${escapeHtml(ref)}</span>`);
  });
  s = s.replace(/@(?:(angle|triangle|circle|arc|figure|line|point|solid|plane|number)\(([A-Z][A-Z0-9′']*)\)|([A-Z][A-Z0-9′']*)\b)/g, (_, kind: string | undefined, l1: string | undefined, l2: string | undefined) => {
    const label = l1 ?? l2!;
    return keep(`<span class="lab linked md-lab" data-label="${label}" data-kind="${kind ?? ''}">${label}</span>`);
  });
  // callouts
  s = s.replace(/^:::(\w+)[ \t]*(.*)\n([\s\S]*?)^:::[ \t]*$/gm, (_, kind: string, title: string, body: string) => {
    const t = title.trim() || CALLOUTS[kind] || kind;
    return `\n\n${keep(`<aside class="callout ${kind}"><div class="callout-title">${escapeHtml(t)}</div>${restore(marked.parse(body) as string, stash)}</aside>`)}\n\n`;
  });
  const html = marked.parse(s) as string;
  return restore(html, stash);
}

function restore(html: string, stash: string[]): string {
  let prev = '';
  let out = html;
  while (out !== prev) {
    prev = out;
    // Keep block placeholders out of paragraphs so browsers do not insert empty paragraphs.
    out = out.replace(/<p>\u0000(\d+)\u0000<\/p>/g, (match, i: string) => /^<(?:pre|aside)\b/.test(stash[Number(i)]) ? stash[Number(i)] : match);
    out = out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => stash[Number(i)]);
  }
  return out;
}

/** Splits Markdown into prose chunks and widget lines. */
export function splitWidgets(src: string): ({ md: string } | { widget: string; props: Record<string, string> })[] {
  const out: ({ md: string } | { widget: string; props: Record<string, string> })[] = [];
  let buf: string[] = [];
  for (const line of src.split('\n')) {
    const m = /^::([a-z][\w-]*)(\{(.*)\})?\s*$/.exec(line);
    if (m) {
      if (buf.length) out.push({ md: buf.join('\n') });
      buf = [];
      const props: Record<string, string> = {};
      for (const kv of (m[3] ?? '').matchAll(/(\w+)=(?:"([^"]*)"|(\S+))/g)) props[kv[1]] = kv[2] ?? kv[3];
      out.push({ widget: m[1], props });
    } else buf.push(line);
  }
  if (buf.length) out.push({ md: buf.join('\n') });
  return out;
}

/** All labels (@AB) of a modern text, in order, for linking with the figure. */
export function mdLabels(src: string): MdLabel[] {
  const out: MdLabel[] = [];
  const clean = src.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '').replace(/\$\$[\s\S]+?\$\$/g, '').replace(/\$[^$\n]+?\$/g, '');
  for (const m of clean.matchAll(/@(?:(angle|triangle|circle|arc|figure|line|point|solid|plane|number)\(([A-Z][A-Z0-9′']*)\)|([A-Z][A-Z0-9′']*)\b)/g)) {
    out.push({ label: m[2] ?? m[3], kind: (m[1] as Kind) ?? null });
  }
  return out;
}

