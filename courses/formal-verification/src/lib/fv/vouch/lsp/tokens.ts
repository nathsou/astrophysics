/**
 * Classifying tokens for highlighting (LSP semantic tokens). Separate from the server so the editor can use it on
 * the main thread (instant lexer-based highlighting) without loading the checker and the engines.
 */
import type { Checked } from '../check/checker';
import type { Sym } from '../check/symbols';
import { lex, lineCol, type Token } from '../syntax/lexer';

export const TOKEN_TYPES = ['keyword', 'variable', 'parameter', 'function', 'type', 'enumMember', 'property', 'number', 'string', 'operator', 'namespace', 'label'] as const;
export const TOKEN_MODIFIERS = ['declaration', 'readonly', 'specification', 'ghost'] as const;

const SPEC_KEYWORDS = new Set(['requires', 'ensures', 'invariant', 'decreases', 'modifies', 'reads', 'assert', 'assume', 'old', 'forall', 'exists', 'property', 'fairness', 'fact', 'check', 'constraint']);

export interface ClassifiedToken {
  start: number;
  length: number;
  type: (typeof TOKEN_TYPES)[number];
  modifiers: number;
}

/** Classify every token for highlighting: keywords, and names by what they resolve to. */
export function classify(text: string, c: Checked | undefined): ClassifiedToken[] {
  const toks = lex(text);
  const byStart = new Map<number, Sym>();
  if (c) {
    for (const [id, spans] of c.uses) for (const s of spans) byStart.set(s.start, c.symbols[id - 1]!);
    for (const s of c.symbols) if (!byStart.has(s.def.start)) byStart.set(s.def.start, s);
  }
  const out: ClassifiedToken[] = [];
  const kindOf = (s: Sym): ClassifiedToken['type'] =>
    s.kind === 'fn' ? 'function'
    : s.kind === 'type' ? 'type'
    : s.kind === 'variant' ? 'enumMember'
    : s.kind === 'param' ? 'parameter'
    : s.kind === 'process' || s.kind === 'action' || s.kind === 'container' ? 'namespace'
    : s.kind === 'field' ? 'property'
    : 'variable';
  for (let i = 0; i < toks.length; i++) {
    const t: Token = toks[i]!;
    const length = t.span.end - t.span.start;
    if (t.kind === 'kw') out.push({ start: t.span.start, length, type: 'keyword', modifiers: SPEC_KEYWORDS.has(t.value) ? 4 : 0 });
    else if (t.kind === 'int') out.push({ start: t.span.start, length, type: 'number', modifiers: 0 });
    else if (t.kind === 'string') out.push({ start: t.span.start, length, type: 'string', modifiers: 0 });
    else if (t.kind === 'ident') {
      const s = byStart.get(t.span.start);
      const prev = toks[i - 1];
      if (s) out.push({ start: t.span.start, length, type: kindOf(s), modifiers: (s.def.start === t.span.start ? 1 : 0) | (s.mutable ? 0 : 2) | (s.ghost ? 8 : 0) });
      else if (prev?.kind === 'op' && prev.value === '.') out.push({ start: t.span.start, length, type: 'property', modifiers: 0 });
      else if (toks[i + 1]?.value === ':' && toks[i + 1]?.kind === 'op' && toks[i + 2]?.value !== ':') out.push({ start: t.span.start, length, type: 'label', modifiers: 0 });
      else if (/^(int|nat|bool|[iu](8|16|32|64)|bv\d+|map|multiset|seq|ref)$/.test(t.value)) out.push({ start: t.span.start, length, type: 'type', modifiers: 0 });
    } else if (t.kind === 'op' && /^[=<>!&|*+\-/%^~#]+$|^\|->$/.test(t.value)) out.push({ start: t.span.start, length, type: 'operator', modifiers: 0 });
  }
  return out;
}

/** LSP's relative encoding: deltaLine, deltaStart, length, type, modifiers. Tokens never span lines here. */
export function encodeTokens(text: string, toks: ClassifiedToken[]): number[] {
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const t of toks.sort((a, b) => a.start - b.start)) {
    const { line, character } = lineCol(text, t.start);
    data.push(line - prevLine, line === prevLine ? character - prevChar : character, t.length, TOKEN_TYPES.indexOf(t.type), t.modifiers);
    prevLine = line;
    prevChar = character;
  }
  return data;
}

