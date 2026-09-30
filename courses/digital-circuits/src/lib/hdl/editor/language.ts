/**
 * Language data for DCL: comment tokens, brackets to close, and indentation. There is no grammar (highlighting
 * is `tokens.ts`); the "language" is a stream parser that only marks lines as read, so that CodeMirror's
 * language features (indent on input, bracket closing, commenting) have something to attach to.
 */
import { StreamLanguage, indentService } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tokenize } from '../index';

const stub = StreamLanguage.define<null>({
  startState: () => null,
  token(stream) {
    stream.skipToEnd();
    return null;
  },
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '[', '{', '"'] },
    indentOnInput: /^\s*[})\]]$/,
  },
});

/** Operators that continue the previous statement when they begin a line (HDL.md, *Statements and newlines*). */
const CONTINUES = new Set(['+', '-', '*', '&', '|', '^', '==', '!=', '<', '<=', '>', '>=', '&&', '||', '<<', '>>', '.', '=>']);
/** …and when they end one (a comma does not: it separates items). */
const ENDS_OPEN = new Set(['+', '-', '*', '&', '|', '^', '==', '!=', '<', '<=', '>', '>=', '&&', '||', '<<', '>>', '=', '->', '=>']);

/** Indentation by nesting: two spaces per open `{`, `(` or `[`, and two more for a continuation line. */
export function indentFor(text: string, lineStart: number, unit = 2): number {
  const upTo = text.slice(0, lineStart);
  const stack: string[] = [];
  let lastText = '';
  for (const t of tokenize(upTo)) {
    if (t.kind === 'comment' || t.kind === 'doc') continue;
    const s = upTo.slice(t.from, t.to);
    if (t.kind === 'punctuation') {
      if (s === '{' || s === '(' || s === '[') stack.push(s);
      else if (s === '}' || s === ')' || s === ']') stack.pop();
    }
    lastText = s;
  }
  const lineEnd = text.indexOf('\n', lineStart);
  const line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
  const first = /^\s*(\S+)/.exec(line)?.[1] ?? '';
  const startsWithCloser = /^[)\]}]/.test(first);
  let n = stack.length - (startsWithCloser ? 1 : 0);
  // Inside parentheses a continuation is already indented by the parenthesis; at statement level it gets one more.
  const inParens = stack[stack.length - 1] === '(' || stack[stack.length - 1] === '[';
  if (!inParens && !startsWithCloser) {
    const op = /^(\|\||&&|==|!=|<=|>=|<<|>>|=>|[-+*&|^<>.])/.exec(first)?.[1];
    if ((op && CONTINUES.has(op)) || ENDS_OPEN.has(lastText)) n++;
  }
  return Math.max(0, n) * unit;
}

export const dclLanguage: Extension = [
  stub,
  indentService.of((ctx, pos) => {
    const line = ctx.lineAt(pos);
    return indentFor(ctx.state.doc.toString(), line.from, ctx.unit);
  }),
];
