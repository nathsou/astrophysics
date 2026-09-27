// Lexer for the course's Lean-like surface language.

export type TokKind = 'ident' | 'num' | 'sym' | 'kw' | 'str' | 'dotIdent' | 'hole' | 'doc' | 'eof';

export interface Token {
  kind: TokKind;
  text: string;
  from: number;
  to: number;
  /** a newline occurs between the previous token and this one */
  nl: boolean;
  /** column of the token's first character */
  col: number;
}

export const KEYWORDS = new Set([
  'def',
  'theorem',
  'lemma',
  'example',
  'abbrev',
  'opaque',
  'axiom',
  'inductive',
  'structure',
  'mutual',
  'variable',
  'universe',
  'where',
  'fun',
  'let',
  'in',
  'match',
  'nomatch',
  'with',
  'show',
  'from',
  'sorry',
  'Prop',
  'Type',
  'Sort',
  'open',
  'namespace',
  'section',
  'end',
  'set_option',
  'infixl',
  'infixr',
  'infix',
  'prefix',
  'init_quot',
  'noncomputable',
  '#check',
  '#reduce',
  '#eval',
  '#whnf',
  '#print',
]);

export const COMMAND_KEYWORDS = new Set([
  'def',
  'theorem',
  'lemma',
  'example',
  'abbrev',
  'opaque',
  'axiom',
  'inductive',
  'structure',
  'mutual',
  'variable',
  'universe',
  'open',
  'namespace',
  'section',
  'end',
  'set_option',
  'infixl',
  'infixr',
  'infix',
  'prefix',
  'init_quot',
  'noncomputable',
  '#check',
  '#reduce',
  '#eval',
  '#whnf',
  '#print',
]);

const BASE_SYMBOLS = [
  ':=',
  '=>',
  '->',
  '<->',
  '::',
  '.{',
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
  '⟨',
  '⟩',
  '⦃',
  '⦄',
  ',',
  ':',
  ';',
  '|',
  '@',
  '→',
  '↦',
  'λ',
  'Π',
  '∀',
  '∃',
  '*',
  '□',
  '_',
  '.',
];

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉ₐₑₒₓₔₕₖₗₘₙₚₛₜᵢⱼ';

function isIdentStart(c: string): boolean {
  if (c === 'λ' || c === 'Π' || c === 'Σ' || c === '∀' || c === '∃') return false;
  return /[\p{L}_]/u.test(c) || c === '𝔹';
}

function isIdentRest(c: string): boolean {
  return isIdentStart(c) || /[0-9'!?]/.test(c) || SUBSCRIPTS.includes(c);
}

export class Lexer {
  private symbols: string[];

  constructor(
    readonly src: string,
    extraSymbols: string[] = [],
  ) {
    this.symbols = [];
    this.setSymbols(extraSymbols);
  }

  setSymbols(extra: string[]): void {
    const all = new Set([...BASE_SYMBOLS, ...extra]);
    this.symbols = [...all].sort((a, b) => b.length - a.length);
  }

  /** Lex one token starting at `pos`. */
  lexAt(pos: number): Token {
    const src = this.src;
    let i = pos;
    let nl = false;
    let docText: string | undefined;
    let docFrom = 0;
    // skip whitespace and comments
    for (;;) {
      if (i >= src.length) break;
      const c = src[i];
      if (c === '\n') {
        nl = true;
        i++;
      } else if (c === ' ' || c === '\t' || c === '\r') {
        i++;
      } else if (c === '-' && src[i + 1] === '-') {
        while (i < src.length && src[i] !== '\n') i++;
      } else if (c === '/' && src[i + 1] === '-') {
        const isDoc = src[i + 2] === '-' && src[i + 3] !== '/';
        const start = i;
        let depth = 1;
        i += 2;
        while (i < src.length && depth > 0) {
          if (src[i] === '/' && src[i + 1] === '-') {
            depth++;
            i += 2;
          } else if (src[i] === '-' && src[i + 1] === '/') {
            depth--;
            i += 2;
          } else {
            if (src[i] === '\n') nl = true;
            i++;
          }
        }
        if (isDoc) {
          docText = src.slice(start + 3, i - 2).trim();
          docFrom = start;
          // a doc comment is its own token
          return { kind: 'doc', text: docText, from: docFrom, to: i, nl, col: colOf(src, docFrom) };
        }
      } else break;
    }
    const from = i;
    const col = colOf(src, from);
    if (i >= src.length) return { kind: 'eof', text: '', from, to: from, nl: true, col };
    const c = src[i];

    // #command keywords
    if (c === '#') {
      let j = i + 1;
      while (j < src.length && /[a-z]/.test(src[j])) j++;
      return { kind: 'kw', text: src.slice(i, j), from, to: j, nl, col };
    }
    // string literal (used by notation commands)
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"' && src[j] !== '\n') j++;
      return { kind: 'str', text: src.slice(i + 1, j), from, to: Math.min(j + 1, src.length), nl, col };
    }
    // numbers
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      return { kind: 'num', text: src.slice(i, j), from, to: j, nl, col };
    }
    // ?x synthetic holes
    if (c === '?' && i + 1 < src.length && isIdentStart(src[i + 1])) {
      let j = i + 1;
      while (j < src.length && isIdentRest(src[j])) j++;
      return { kind: 'hole', text: src.slice(i + 1, j), from, to: j, nl, col };
    }
    // .ident (dot-identifier), only when not directly after an identifier or ')'
    if (c === '.' && i + 1 < src.length && isIdentStart(src[i + 1])) {
      const prev = i > 0 ? src[i - 1] : ' ';
      if (!isIdentRest(prev) && prev !== ')' && prev !== '⟩' && prev !== '}') {
        let j = i + 1;
        while (j < src.length && isIdentRest(src[j])) j++;
        return { kind: 'dotIdent', text: src.slice(i + 1, j), from, to: j, nl, col };
      }
    }
    // identifiers (with dotted components)
    if (isIdentStart(c) && !(c === '_' && !isIdentRest(src[i + 1] ?? ' '))) {
      let j = i;
      for (;;) {
        while (j < src.length && isIdentRest(src[j])) j++;
        // continue across '.' when followed by an identifier char or digit
        if (src[j] === '.' && j + 1 < src.length && (isIdentStart(src[j + 1]) || /[0-9]/.test(src[j + 1]))) {
          j++;
          continue;
        }
        break;
      }
      const text = src.slice(i, j);
      return { kind: KEYWORDS.has(text) ? 'kw' : 'ident', text, from, to: j, nl, col };
    }
    // symbols, longest match
    for (const s of this.symbols) {
      if (src.startsWith(s, i)) return { kind: 'sym', text: s, from, to: i + s.length, nl, col };
    }
    // any other single character (surrogate pairs kept together)
    const cp = src.codePointAt(i)!;
    const len = cp > 0xffff ? 2 : 1;
    return { kind: 'sym', text: src.slice(i, i + len), from, to: i + len, nl, col };
  }
}

function colOf(src: string, pos: number): number {
  const ln = src.lastIndexOf('\n', pos - 1);
  return pos - (ln + 1);
}
