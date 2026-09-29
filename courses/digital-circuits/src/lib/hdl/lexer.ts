/**
 * The DCL lexer.
 *
 * It produces tokens with spans, a separate list of comments (for the formatter and the highlighter), and
 * `newline` tokens only where a line break ends a statement (HDL.md, *Statements and newlines*). A line
 * break between the last token A of a line and the first token B of the next line is a statement end
 * unless:
 *
 * - it is inside an unclosed `(` or `[`;
 * - A is a binary operator, `=`, `,`, `->` or `{` (and, since no statement can end with them, a unary
 *   operator, `.`, `..`, `:`, `=>` or `@`);
 * - B cannot begin a statement: a binary or unary operator, `.`, `)`, `]`, `else` (and `}`, `,`, `..`,
 *   `:`, `=`, `->`, `=>`, which cannot begin a statement either).
 *
 * `;` is a separate token, which the parser treats like a statement-ending newline.
 *
 * Error recovery: when a line inside an unclosed `(` or `[` starts with a keyword that only begins an item
 * or statement (`let`, `module`, …), the brackets are assumed to be unclosed by mistake and the line break
 * ends the statement, so that one missing `)` does not swallow the rest of the file.
 */
import type { Diagnostic } from './diagnostics.ts';
import { SourceFile, type Span } from './span.ts';

export const KEYWORDS = new Set([
  'module', 'top', 'fn', 'struct', 'enum', 'type', 'const', 'let', 'reg', 'mem', 'next', 'inst', 'for',
  'in', 'if', 'else', 'match', 'on', 'test', 'sim', 'step', 'expect', 'print',
]);

/** Built-in type names. They are ordinary identifiers to the parser; the highlighter marks them as types. */
export const TYPE_NAMES = new Set(['bit', 'bits', 'signed', 'clock', 'int']);

export type TokenKind = 'ident' | 'keyword' | 'number' | 'string' | 'op' | 'newline' | 'eof' | 'error';

export interface Token {
  kind: TokenKind;
  /** The source text (for `newline` tokens: `"\n"`). */
  text: string;
  span: Span;
  /** For numbers: the value. */
  value?: bigint;
  /** For strings: the unescaped contents. */
  str?: string;
  /** True when a line break separates this token from the previous token (comments excluded). */
  lineStart: boolean;
}

export type CommentKind = 'line' | 'block' | 'doc';

export interface Comment {
  kind: CommentKind;
  /** The full text including the `//`, `///` or `/* *\/` markers. */
  text: string;
  span: Span;
}

export interface LexResult {
  tokens: Token[];
  comments: Comment[];
  diagnostics: Diagnostic[];
  source: SourceFile;
}

// Longest first.
const OPERATORS = [
  '->', '=>', '==', '!=', '<=', '>=', '<<', '>>', '&&', '||', '..',
  '+', '-', '*', '&', '|', '^', '!', '~', '<', '>', '=', '.', ',', ':', ';', '(', ')', '[', ']', '{', '}', '@',
];

export const BINARY_OPERATORS = new Set([
  '*', '+', '-', '<<', '>>', '&', '^', '|', '==', '!=', '<', '<=', '>', '>=', '&&', '||',
]);
const UNARY_OPERATORS = new Set(['!', '~', '-']);

/** A line ending with one of these continues on the next line. */
const CONTINUE_AFTER = new Set([...BINARY_OPERATORS, ...UNARY_OPERATORS, '=', ',', '->', '{', '(', '[', '.', '..', ':', '=>', '@']);
/** A line starting with one of these continues the previous line. */
const CONTINUE_BEFORE = new Set([...BINARY_OPERATORS, ...UNARY_OPERATORS, '.', ')', ']', '}', ',', '..', ':', '=', '->', '=>']);
/** Keywords that can only begin an item or a statement: used to recover from unclosed brackets. */
const STATEMENT_KEYWORDS = new Set([
  'module', 'top', 'fn', 'struct', 'enum', 'type', 'const', 'let', 'reg', 'mem', 'next', 'inst', 'for', 'test',
  'step', 'expect', 'print',
]);

function isIdentStart(c: number): boolean {
  return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95;
}
function isIdentPart(c: number): boolean {
  return isIdentStart(c) || (c >= 48 && c <= 57);
}
function isDigit(c: number): boolean {
  return c >= 48 && c <= 57;
}

/** Tokens and comments without any newline processing. */
function scan(src: SourceFile, diags: Diagnostic[]): { tokens: Token[]; comments: Comment[] } {
  const text = src.text;
  const tokens: Token[] = [];
  const comments: Comment[] = [];
  let i = 0;
  let sawNewline = true;
  const n = text.length;
  const err = (start: number, end: number, message: string, label?: string, help?: string) =>
    diags.push({ severity: 'error', code: 'syntax', message, span: src.span(start, end), label, help: help ? [help] : undefined });

  while (i < n) {
    const c = text.charCodeAt(i);
    if (c === 10) {
      sawNewline = true;
      i++;
      continue;
    }
    if (c === 32 || c === 9 || c === 13) {
      i++;
      continue;
    }
    const start = i;
    // Comments.
    if (c === 47 && text.charCodeAt(i + 1) === 47) {
      let e = text.indexOf('\n', i);
      if (e < 0) e = n;
      let end = e;
      if (end > i && text.charCodeAt(end - 1) === 13) end--;
      const body = text.slice(i, end);
      const isDoc = body.startsWith('///') && !body.startsWith('////');
      comments.push({ kind: isDoc ? 'doc' : 'line', text: body.trimEnd(), span: src.span(i, end) });
      i = e;
      continue;
    }
    if (c === 47 && text.charCodeAt(i + 1) === 42) {
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (text.charCodeAt(j) === 47 && text.charCodeAt(j + 1) === 42) {
          depth++;
          j += 2;
        } else if (text.charCodeAt(j) === 42 && text.charCodeAt(j + 1) === 47) {
          depth--;
          j += 2;
        } else j++;
      }
      if (depth > 0) err(i, i + 2, 'unterminated block comment', 'this comment is never closed', 'close it with `*/`');
      comments.push({ kind: 'block', text: text.slice(i, j), span: src.span(i, j) });
      if (text.slice(i, j).includes('\n')) sawNewline = true;
      i = j;
      continue;
    }
    const push = (kind: TokenKind, end: number, extra: Partial<Token> = {}) => {
      tokens.push({ kind, text: text.slice(start, end), span: src.span(start, end), lineStart: sawNewline, ...extra });
      sawNewline = false;
      i = end;
    };
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdentPart(text.charCodeAt(j))) j++;
      const word = text.slice(i, j);
      push(KEYWORDS.has(word) ? 'keyword' : 'ident', j);
      continue;
    }
    if (isDigit(c)) {
      let j = i;
      let radix = 10;
      let digitsStart = i;
      if (c === 48 && (text[i + 1] === 'x' || text[i + 1] === 'X')) {
        radix = 16;
        digitsStart = i + 2;
      } else if (c === 48 && (text[i + 1] === 'b' || text[i + 1] === 'B')) {
        radix = 2;
        digitsStart = i + 2;
      }
      j = digitsStart;
      while (j < n && isIdentPart(text.charCodeAt(j))) j++;
      const digits = text.slice(digitsStart, j);
      const valid = radix === 16 ? /^[0-9a-fA-F_]*$/ : radix === 2 ? /^[01_]*$/ : /^[0-9_]*$/;
      const clean = digits.replace(/_/g, '');
      let value = 0n;
      if (!valid.test(digits)) {
        const bad = [...digits].findIndex((ch) => !valid.test(ch));
        const kind = radix === 16 ? 'hexadecimal' : radix === 2 ? 'binary' : 'decimal';
        err(digitsStart + bad, digitsStart + bad + 1, `invalid digit \`${digits[bad]}\` in ${kind} literal`, 'not a digit here');
      } else if (clean.length === 0) {
        err(i, j, 'number literal with no digits', 'digits expected after the prefix');
      } else {
        value = BigInt((radix === 16 ? '0x' : radix === 2 ? '0b' : '') + clean);
      }
      push('number', j, { value });
      continue;
    }
    if (c === 34) {
      let j = i + 1;
      let s = '';
      let closed = false;
      while (j < n) {
        const ch = text[j]!;
        if (ch === '"') {
          closed = true;
          j++;
          break;
        }
        if (ch === '\n') break;
        if (ch === '\\' && j + 1 < n) {
          const e = text[j + 1]!;
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
          j += 2;
          continue;
        }
        s += ch;
        j++;
      }
      if (!closed) err(i, j, 'unterminated string', 'this string is never closed', 'close it with `"` on the same line');
      push('string', j, { str: s });
      continue;
    }
    let matched = '';
    for (const op of OPERATORS) {
      if (text.startsWith(op, i)) {
        matched = op;
        break;
      }
    }
    if (matched) {
      push('op', i + matched.length);
      continue;
    }
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    err(i, i + ch.length, `unexpected character \`${ch}\``, 'not part of DCL');
    push('error', i + ch.length);
  }
  tokens.push({ kind: 'eof', text: '', span: src.span(n, n), lineStart: true });
  return { tokens, comments };
}

/** Lexes a DCL source text. */
export function lex(text: string, file = 'input.dcl'): LexResult {
  const source = new SourceFile(file, text);
  const diagnostics: Diagnostic[] = [];
  const raw = scan(source, diagnostics);
  const tokens: Token[] = [];
  let depth = 0;
  let prev: Token | undefined;
  for (const t of raw.tokens) {
    if (prev && t.lineStart) {
      let significant = true;
      if (depth > 0) {
        if (t.kind === 'keyword' && STATEMENT_KEYWORDS.has(t.text)) depth = 0;
        else significant = false;
      }
      if (significant && isOp(prev) && CONTINUE_AFTER.has(prev.text)) significant = false;
      if (significant && ((t.kind === 'op' && CONTINUE_BEFORE.has(t.text)) || (t.kind === 'keyword' && t.text === 'else'))) significant = false;
      if (significant && t.kind !== 'eof') {
        tokens.push({ kind: 'newline', text: '\n', span: source.span(prev.span.end, prev.span.end), lineStart: false });
      }
    }
    if (t.kind === 'op') {
      if (t.text === '(' || t.text === '[') depth++;
      else if ((t.text === ')' || t.text === ']') && depth > 0) depth--;
    }
    tokens.push(t);
    prev = t;
  }
  return { tokens, comments: raw.comments, diagnostics, source };
}

function isOp(t: Token): boolean {
  return t.kind === 'op';
}
