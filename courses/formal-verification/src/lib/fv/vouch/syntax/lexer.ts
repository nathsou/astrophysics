/**
 * The Vouch lexer.
 *
 * Vouch has no semicolons: a newline ends a statement unless the line obviously continues (it ends with a binary
 * operator or a comma, or the newline is inside parentheses or brackets, or the next line starts with a binary
 * operator). The lexer emits NEWLINE tokens only where they can end something; the parser does the rest.
 *
 * Every operator has an ASCII spelling and, where mathematics has one, a Unicode spelling: ∀ ∃ ⟹ ⟸ ⟺ ≤ ≥ ≠ ∧ ∨ ¬ ∈ ∉
 * ∗ (separating conjunction) ↦ (points-to) ⇝ (leads to). Both lex to the same token, so the printer can use either.
 */

export interface Span {
  start: number;
  end: number;
}

export type TokKind = 'ident' | 'int' | 'string' | 'kw' | 'op' | 'newline' | 'eof' | 'error';

export interface Token {
  kind: TokKind;
  /** Canonical text: the ASCII spelling for operators, the identifier or keyword, the digits for numbers. */
  value: string;
  span: Span;
  /** For integers: the value. */
  int?: bigint;
  /** Error message for 'error' tokens. */
  message?: string;
}

export const KEYWORDS = new Set([
  // declarations
  'fn', 'pure', 'pred', 'lemma', 'ghost', 'const', 'enum', 'struct', 'type', 'class', 'system', 'world', 'problem',
  // statements
  'let', 'var', 'if', 'else', 'while', 'for', 'in', 'match', 'return', 'assert', 'assume', 'loop', 'await', 'atomic',
  'choose', 'where', 'free', 'skip', 'break',
  // specifications
  'requires', 'ensures', 'invariant', 'decreases', 'modifies', 'reads', 'old', 'forall', 'exists', 'inout',
  // systems
  'action', 'when', 'process', 'init', 'property', 'fairness', 'weak', 'strong', 'always', 'eventually', 'next', 'until',
  'at', 'instance', 'symmetric', 'refines', 'via',
  // worlds and problems
  'rel', 'fact', 'check', 'run', 'for', 'constraint', 'solve', 'count', 'some', 'no', 'one', 'lone', 'set',
  // values
  'true', 'false', 'null', 'emp', 'new', 'as',
]);

/** Keywords that may also be used as identifiers where the grammar is unambiguous (field names, `count`, `set`, …). */
export const SOFT_KEYWORDS = new Set(['count', 'some', 'no', 'one', 'lone', 'set', 'run', 'check', 'fact', 'rel', 'solve', 'instance', 'init', 'next', 'weak', 'strong', 'via', 'where']);

/** Unicode spellings → canonical ASCII. */
const UNICODE: Record<string, string> = {
  '∀': 'forall',
  '∃': 'exists',
  '⟹': '==>',
  '⇒': '==>',
  '⟸': '<==',
  '⇐': '<==',
  '⟺': '<==>',
  '⇔': '<==>',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '∧': '&&',
  '∨': '||',
  '¬': '!',
  '∈': 'in',
  '∉': '!in',
  '∗': '**',
  '↦': '|->',
  '⇝': '~>',
  '□': 'always',
  '◇': 'eventually',
  '·': '::',
  '→': '->',
};

/** Operators, longest first. */
const OPS = [
  '<==>', '|->', '==>', '<==', '!in', '..=', '>>=', '<<=',
  '==', '!=', '<=', '>=', '&&', '||', '->', '=>', '::', '..', '++', '**', '<<', '>>', ':=', '~>', '+=', '-=', '*=',
  '+', '-', '*', '/', '%', '<', '>', '!', '=', '(', ')', '[', ']', '{', '}', ',', ':', '.', '|', '&', '^', '~', '#', '@', '?',
];

/** Tokens after which a newline does not end the statement (the expression obviously continues). */
const CONTINUES_AFTER = new Set([
  '<==>', '==>', '<==', '==', '!=', '<=', '>=', '&&', '||', '->', '=>', '::', '..', '++', '**', '<<', '>>', ':=', '~>',
  '+', '-', '*', '/', '%', '<', '>', '!', '=', ',', ':', '.', '|', '&', '^', '|->', '..=', '+=', '-=', '*=',
]);
/** Tokens that, at the start of a line, continue the previous line. */
const CONTINUES_BEFORE = new Set(['<==>', '==>', '<==', '&&', '||', '**', '++', '~>', '|->', '.', '=>', 'until', 'else']);

export function lex(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let depth = 0; // ( and [ nesting: newlines inside are insignificant
  const braceStack: string[] = [];
  const push = (kind: TokKind, value: string, start: number, extra: Partial<Token> = {}) => out.push({ kind, value, span: { start, end: i }, ...extra });
  const pendingNewline = (at: number) => {
    const last = out.at(-1);
    if (!last || last.kind === 'newline') return;
    if (depth > 0) return;
    if (last.kind === 'op' && CONTINUES_AFTER.has(last.value)) return;
    if (last.kind === 'op' && last.value === '{') return;
    if (last.kind === 'kw' && ['requires', 'ensures', 'invariant', 'decreases', 'else', 'forall', 'exists', 'in', 'when', 'until', 'as', 'at'].includes(last.value)) return;
    out.push({ kind: 'newline', value: '\n', span: { start: at, end: at + 1 } });
  };

  while (i < src.length) {
    const c = src[i]!;
    // Whitespace and newlines.
    if (c === '\n') {
      pendingNewline(i);
      i++;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      continue;
    }
    // Comments.
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = i;
      i += 2;
      let nest = 1;
      while (i < src.length && nest > 0) {
        if (src[i] === '/' && src[i + 1] === '*') {
          nest++;
          i += 2;
        } else if (src[i] === '*' && src[i + 1] === '/') {
          nest--;
          i += 2;
        } else {
          if (src[i] === '\n') pendingNewline(i);
          i++;
        }
      }
      if (nest > 0) push('error', '/*', start, { message: 'This comment is never closed: add */.' });
      continue;
    }
    const start = i;
    // Numbers: decimal, 0x hex, 0b binary, with _ separators.
    if (/[0-9]/.test(c)) {
      let text = '';
      if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
        i += 2;
        while (i < src.length && /[0-9a-fA-F_]/.test(src[i]!)) text += src[i++];
        text = '0x' + text.replace(/_/g, '');
      } else if (c === '0' && (src[i + 1] === 'b' || src[i + 1] === 'B')) {
        i += 2;
        while (i < src.length && /[01_]/.test(src[i]!)) text += src[i++];
        text = '0b' + text.replace(/_/g, '');
      } else {
        while (i < src.length && /[0-9_]/.test(src[i]!)) text += src[i++];
        text = text.replace(/_/g, '');
      }
      if (text === '0x' || text === '0b') {
        push('error', text, start, { message: 'A number needs digits after its prefix.' });
        continue;
      }
      push('int', text, start, { int: BigInt(text) });
      continue;
    }
    // Identifiers and keywords (ASCII letters, digits, _ and ', like x' for a next-state copy).
    if (/[A-Za-z_]/.test(c)) {
      while (i < src.length && /[A-Za-z0-9_']/.test(src[i]!)) i++;
      const word = src.slice(start, i);
      // `when` (an action's guard) and `else` may start a line and still continue the previous one.
      if ((word === 'when' || CONTINUES_BEFORE.has(word)) && out.at(-1)?.kind === 'newline') out.pop();
      push(KEYWORDS.has(word) ? 'kw' : 'ident', word, start);
      continue;
    }
    // Strings (used only for messages).
    if (c === '"') {
      i++;
      let s = '';
      while (i < src.length && src[i] !== '"' && src[i] !== '\n') {
        if (src[i] === '\\' && i + 1 < src.length) {
          s += src[i + 1];
          i += 2;
        } else s += src[i++];
      }
      if (src[i] !== '"') {
        push('error', s, start, { message: 'This string is never closed: add ".' });
        continue;
      }
      i++;
      push('string', s, start);
      continue;
    }
    // Unicode operators.
    const cp = String.fromCodePoint(src.codePointAt(i)!);
    if (UNICODE[cp]) {
      i += cp.length;
      const v = UNICODE[cp]!;
      push(KEYWORDS.has(v) ? 'kw' : 'op', v, start);
      continue;
    }
    // ASCII operators, longest match first.
    const op = OPS.find((o) => src.startsWith(o, i) && !(o === '!in' && /[A-Za-z0-9_]/.test(src[i + 3] ?? '')));
    if (op) {
      // A newline before a continuing operator does not end the statement: drop it.
      if (CONTINUES_BEFORE.has(op) && out.at(-1)?.kind === 'newline') out.pop();
      i += op.length;
      if (op === '(' || op === '[') depth++;
      else if ((op === ')' || op === ']') && depth > 0) depth--;
      else if (op === '{') {
        braceStack.push(String(depth));
        depth = 0;
      } else if (op === '}') {
        depth = Number(braceStack.pop() ?? 0);
      }
      push('op', op, start);
      continue;
    }
    i += cp.length;
    push('error', cp, start, { message: `Unexpected character “${cp}”.` });
  }
  pendingNewline(i);
  out.push({ kind: 'eof', value: '', span: { start: src.length, end: src.length } });
  // `else` at the start of a line continues the `if` before it; so does a keyword-led continuation like `until`.
  for (let k = out.length - 1; k > 0; k--) {
    const t = out[k]!;
    if ((t.kind === 'kw' && (t.value === 'else' || t.value === 'until')) && out[k - 1]!.kind === 'newline') out.splice(k - 1, 1);
  }
  return out;
}

/** 0-based line and character of an offset (UTF-16 code units, as the LSP expects). */
export function lineCol(src: string, offset: number): { line: number; character: number } {
  let line = 0;
  let last = 0;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) {
      line++;
      last = i + 1;
    }
  }
  return { line, character: offset - last };
}

/** Offset of a 0-based line and character. */
export function offsetAt(src: string, line: number, character: number): number {
  let l = 0;
  let i = 0;
  while (l < line && i < src.length) {
    if (src.charCodeAt(i) === 10) l++;
    i++;
  }
  return Math.min(src.length, i + character);
}
