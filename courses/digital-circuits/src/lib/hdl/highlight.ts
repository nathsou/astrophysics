/**
 * Syntax highlighting from the compiler's own lexer (HDL.md, *Highlighting*): the Markdown compiler uses
 * it at build time for code blocks and the CodeMirror editor uses it live, so there is one grammar.
 * It never fails: unknown characters and unterminated strings or comments are still classified.
 *
 * This module and the lexer import only `./span.ts`, with explicit extensions, so that build tools can load
 * them with Node's type stripping.
 */
import { KEYWORDS, TYPE_NAMES, lex, type Token } from './lexer.ts';

export type HighlightKind =
  | 'keyword'
  | 'type'
  | 'number'
  | 'string'
  | 'comment'
  | 'doc'
  | 'operator'
  | 'punctuation'
  | 'identifier'
  | 'function'
  | 'module';

export interface HighlightToken {
  from: number;
  to: number;
  kind: HighlightKind;
}

const PUNCTUATION = new Set(['(', ')', '[', ']', '{', '}', ',', ';', ':', '.', '@']);
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const SCREAMING = /^[A-Z][A-Z0-9_]*$/;
/** PascalCase names (modules, structs, enums), but not SCREAMING_CASE constants. */
const typeLike = (s: string) => PASCAL.test(s) && !(s.length > 1 && SCREAMING.test(s));

/** Classifies every token and comment of a DCL source, in order. */
export function tokenize(source: string): HighlightToken[] {
  const { tokens, comments } = lex(source);
  const toks = tokens.filter((t) => t.kind !== 'newline' && t.kind !== 'eof');
  const out: HighlightToken[] = [];
  /** Depth of `<…>` that open generic arguments (so their `>` is punctuation, not an operator). */
  let angle = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    const prev = toks[i - 1];
    const next = toks[i + 1];
    const kind = classify(t, prev, next, toks[i - 2], toks[i - 3]);
    let k: HighlightKind = kind;
    if (t.kind === 'op' && t.text === '<' && prev && (prev.kind === 'ident' && (TYPE_NAMES.has(prev.text) || typeLike(prev.text)))) {
      angle++;
      k = 'punctuation';
    } else if (t.kind === 'op' && angle > 0 && (t.text === '>' || t.text === '>>')) {
      angle = Math.max(0, angle - t.text.length);
      k = 'punctuation';
    }
    out.push({ from: t.span.start, to: t.span.end, kind: k });
  }
  for (const c of comments) out.push({ from: c.span.start, to: c.span.end, kind: c.kind === 'doc' ? 'doc' : 'comment' });
  return out.sort((a, b) => a.from - b.from);
}

function classify(t: Token, prev: Token | undefined, next: Token | undefined, prev2?: Token, prev3?: Token): HighlightKind {
  switch (t.kind) {
    case 'keyword':
      return 'keyword';
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'op':
      return PUNCTUATION.has(t.text) ? 'punctuation' : 'operator';
    case 'error':
      return 'punctuation';
    case 'ident': {
      if (TYPE_NAMES.has(t.text)) return 'type';
      if (prev?.kind === 'keyword' && (prev.text === 'module' || prev.text === 'sim')) return 'module';
      // `inst name: Module`
      if (prev?.text === ':' && prev2?.kind === 'ident' && prev3?.kind === 'keyword' && prev3.text === 'inst') return 'module';
      if (prev?.kind === 'keyword' && prev.text === 'fn') return 'function';
      if (next?.kind === 'op' && next.text === '(' && !typeLike(t.text)) return 'function';
      if (typeLike(t.text)) return 'type';
      return 'identifier';
    }
    default:
      return 'identifier';
  }
}

export { KEYWORDS };
