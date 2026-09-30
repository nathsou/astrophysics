/**
 * The glossary of the whole course, grouped A–Z. The data is `content/glossary.yaml`, read as text and parsed here, so
 * that the appendix always shows every entry that exists when the site is built.
 *
 * `inlineHtml` turns the little Markdown the entries use (`*emphasis*`, `**strong**`, `` `code` ``) into safe HTML.
 */
import YAML from 'yaml';
import raw from '$content/glossary.yaml?raw';

export interface Term {
  id: string;
  term: string;
  definition: string;
  /** Slug of the chapter (or appendix) that introduces the term. */
  chapter?: string;
  /** The definition as HTML. */
  html: string;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** `*em*`, `**strong**` and `code` to HTML; everything else is text. */
export function inlineHtml(md: string): string {
  return md
    .split(/(`[^`]+`)/)
    .map((part) => {
      if (part.length > 1 && part.startsWith('`') && part.endsWith('`')) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      return escapeHtml(part)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\s](?:[^*]*[^*\s])?)\*/g, '<em>$1</em>');
    })
    .join('');
}

export function parseGlossary(text: string): Term[] {
  const data = (YAML.parse(text) ?? {}) as Record<string, { term: string; definition: string; chapter?: string }>;
  return Object.entries(data).map(([id, e]) => ({ id, term: e.term, definition: e.definition, chapter: e.chapter, html: inlineHtml(e.definition) }));
}

const fold = (s: string) => s.replace(/[Øø]/g, 'o').replace(/[Ææ]/g, 'a').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** The letter a term is filed under: its first letter or digit, upper case, without accents; '#' for anything else. */
export function letterOf(term: string): string {
  const first = fold(term).match(/[A-Za-z0-9]/)?.[0];
  if (!first) return '#';
  return /[0-9]/.test(first) ? '#' : first.toUpperCase();
}

const sortKey = (t: string) => fold(t).replace(/^[^A-Za-z0-9]+/, '').toLowerCase();

export interface LetterGroup {
  letter: string;
  terms: Term[];
}

/** Terms grouped by letter, letters in order ('#' first), terms in alphabetical order within each group. */
export function groupByLetter(terms: Term[]): LetterGroup[] {
  const map = new Map<string, Term[]>();
  for (const t of terms) {
    const l = letterOf(t.term);
    (map.get(l) ?? map.set(l, []).get(l)!).push(t);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b)))
    .map(([letter, ts]) => ({ letter, terms: ts.sort((a, b) => sortKey(a.term).localeCompare(sortKey(b.term)) || a.term.localeCompare(b.term)) }));
}

export const ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

export const TERMS: Term[] = parseGlossary(raw);
