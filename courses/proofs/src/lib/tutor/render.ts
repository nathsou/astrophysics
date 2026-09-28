/**
 * A tiny renderer for tutor replies: paragraphs, bullet lists, **bold**, *italic*, `code` and
 * $…$ / $$…$$ maths via KaTeX. Everything else is escaped.
 */
import katex from 'katex';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s: string): string {
  const out: string[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|`([^`]+)`/g;
  let last = 0;
  for (let m; (m = re.exec(s)); ) {
    out.push(fmt(esc(s.slice(last, m.index))));
    if (m[3] !== undefined) out.push(`<code>${esc(m[3])}</code>`);
    else out.push(katex.renderToString(m[1] ?? m[2]!, { displayMode: m[1] !== undefined, throwOnError: false }));
    last = m.index + m[0].length;
  }
  out.push(fmt(esc(s.slice(last))));
  return out.join('');
}

function fmt(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
}

export function renderReply(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
      return `<p>${inline(block)}</p>`;
    })
    .join('');
}

/** Turn rendered course HTML back into text with $TeX$ (KaTeX keeps the source in an annotation). */
export function htmlToText(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]+>/g, '');
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  for (const k of doc.querySelectorAll('.katex-display, .katex')) {
    if (k.closest('.katex') !== k && k.classList.contains('katex')) continue;
    const tex = k.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    if (tex !== undefined && tex !== null) k.replaceWith(k.classList.contains('katex-display') ? `$$${tex}$$` : `$${tex}$`);
  }
  for (const p of doc.querySelectorAll('p, li, br')) p.append('\n');
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}
