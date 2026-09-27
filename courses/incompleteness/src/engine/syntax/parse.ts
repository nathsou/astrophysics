// A parser for formulas in conventional notation.
//
//   ∀x (x = 0 ∨ ∃y x = y′)        forall x (x = 0 | exists y x = y')
//   ¬ ⊥,  A ∧ B,  A ∨ B,  A → B,  A ↔ B     (also ~ & | -> <->)
//   terms: variables x y z u w, x_1, v7; 0; numerals 3 (= 0′′′); t′; (s + t); (s × t) or s * t
//
// Quantifiers and ¬ bind tightly (∀x A ∧ B is (∀x A) ∧ B). ∧ binds tighter than ∨, then →
// (right-associative), then ↔. Named formulas registered in `abbreviations` (e.g. Prov) parse
// as `abbr` nodes.

import * as A from './ast.ts';
import type { Formula, Term } from './ast.ts';
import { constIndex, GENERIC_FN, GENERIC_OFFSET, GENERIC_PRED, varIndex } from './language.ts';
import { lit, named } from '../numbers/nat.ts';

export class ParseError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
  }
}

export interface Abbreviation {
  name: string;
  tex: string;
  /** Indices of the free variables of the named formula, in argument order. */
  params: number[];
  description: string;
}

export interface ParseOptions {
  abbreviations?: Abbreviation[];
}

type Tok = { t: string; pos: number };

const SYMBOLS: [string, string][] = [
  ['<->', '↔'], ['<=>', '↔'], ['->', '→'], ['=>', '→'], ['/\\', '∧'], ['\\/', '∨'], ['!=', '≠'], ['_|_', '⊥'],
  ['↔', '↔'], ['→', '→'], ['∧', '∧'], ['∨', '∨'], ['¬', '¬'], ['~', '¬'], ['&', '∧'], ['|', '∨'], ['∀', '∀'], ['∃', '∃'],
  ['⊥', '⊥'], ['⊤', '⊤'], ['≠', '≠'], ['=', '='], ['<', '<'], ['+', '+'], ['×', '×'], ['*', '×'], ['·', '×'],
  ["'", '′'], ['′', '′'], ['(', '('], [')', ')'], [',', ','], ['.', '.'],
];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  outer: while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    for (const [s, t] of SYMBOLS) {
      if (src.startsWith(s, i)) {
        out.push({ t, pos: i });
        i += s.length;
        continue outer;
      }
    }
    const m = /^(#?[A-Za-z][A-Za-z0-9]*(?:_\{?[A-Za-z0-9]+\}?)?|\d+)/.exec(src.slice(i));
    if (!m) throw new ParseError(`unexpected character “${c}”`, i);
    out.push({ t: m[1], pos: i });
    i += m[1].length;
  }
  out.push({ t: '<end>', pos: src.length });
  return out;
}

const WORDS: Record<string, string> = { forall: '∀', exists: '∃', not: '¬', and: '∧', or: '∨', bot: '⊥', top: '⊤' };

class Parser {
  toks: Tok[];
  i = 0;
  abbrs: Map<string, Abbreviation>;
  constructor(src: string, opt: ParseOptions) {
    this.toks = tokenize(src).map((t) => ({ ...t, t: WORDS[t.t] ?? t.t }));
    this.abbrs = new Map((opt.abbreviations ?? []).map((a) => [a.name, a]));
  }
  get peek() {
    return this.toks[this.i];
  }
  next() {
    return this.toks[this.i++];
  }
  expect(t: string) {
    const tok = this.next();
    if (tok.t !== t) throw new ParseError(`expected “${t}” but found ${tok.t === '<end>' ? 'the end' : `“${tok.t}”`}`, tok.pos);
    return tok;
  }

  formula(): Formula {
    return this.iff();
  }
  iff(): Formula {
    let a = this.imp();
    while (this.peek.t === '↔') {
      this.next();
      a = A.iff(a, this.imp());
    }
    return a;
  }
  imp(): Formula {
    const a = this.or();
    if (this.peek.t === '→') {
      this.next();
      return A.imp(a, this.imp());
    }
    return a;
  }
  or(): Formula {
    let a = this.and();
    while (this.peek.t === '∨') {
      this.next();
      a = A.or(a, this.and());
    }
    return a;
  }
  and(): Formula {
    let a = this.unary();
    while (this.peek.t === '∧') {
      this.next();
      a = A.and(a, this.unary());
    }
    return a;
  }
  unary(): Formula {
    const tok = this.peek;
    if (tok.t === '¬') {
      this.next();
      return A.not(this.unary());
    }
    if (tok.t === '∀' || tok.t === '∃' || ((tok.t === 'A' || tok.t === 'E') && this.isVarTok(this.toks[this.i + 1]))) {
      this.next();
      const vt = this.next();
      const index = varIndex(vt.t);
      if (index === null) throw new ParseError(`expected a variable after the quantifier, found “${vt.t}”`, vt.pos);
      if (this.peek.t === '.') this.next();
      const x = A.v(index);
      const body = this.unary();
      return tok.t === '∀' || tok.t === 'A' ? A.forall(x, body) : A.exists(x, body);
    }
    if (tok.t === '⊥') {
      this.next();
      return A.bot();
    }
    if (tok.t === '⊤') {
      this.next();
      return A.top();
    }
    if (tok.t === '(') {
      // Either a parenthesised formula or a parenthesised term starting an atomic formula.
      const save = this.i;
      try {
        this.next();
        const f = this.formula();
        this.expect(')');
        if (['=', '<', '≠', '+', '×', '′'].includes(this.peek.t)) throw new ParseError('term', this.peek.pos);
        return f;
      } catch {
        this.i = save;
      }
    }
    return this.atom();
  }
  isVarTok(t: Tok | undefined) {
    return !!t && varIndex(t.t) !== null;
  }
  atom(): Formula {
    const tok = this.peek;
    const abbr = this.abbrs.get(tok.t);
    if (abbr) {
      this.next();
      this.expect('(');
      const args = this.termList();
      if (args.length !== abbr.params.length) throw new ParseError(`${abbr.name} takes ${abbr.params.length} argument${abbr.params.length === 1 ? '' : 's'}`, tok.pos);
      return A.abbr(abbr.name, abbr.tex, abbr.params, args);
    }
    const p = GENERIC_PRED.indexOf(tok.t);
    if (p >= 0 && this.toks[this.i + 1]?.t === '(') {
      this.next();
      this.expect('(');
      const args = this.termList();
      return A.pred(args.length, GENERIC_OFFSET + p, args);
    }
    const l = this.term();
    const op = this.next();
    if (op.t === '=') return A.eq(l, this.term());
    if (op.t === '≠') return A.not(A.eq(l, this.term()));
    if (op.t === '<') return A.less(l, this.term());
    throw new ParseError(op.t === '<end>' ? 'incomplete formula: expected =, ≠ or <' : `expected =, ≠ or < but found “${op.t}”`, op.pos);
  }
  termList(): Term[] {
    const args: Term[] = [];
    if (this.peek.t !== ')') {
      args.push(this.term());
      while (this.peek.t === ',') {
        this.next();
        args.push(this.term());
      }
    }
    this.expect(')');
    return args;
  }
  term(): Term {
    let a = this.product();
    while (this.peek.t === '+') {
      this.next();
      a = A.plus(a, this.product());
    }
    return a;
  }
  product(): Term {
    let a = this.postfix();
    while (this.peek.t === '×') {
      this.next();
      a = A.times(a, this.postfix());
    }
    return a;
  }
  postfix(): Term {
    let a = this.primary();
    while (this.peek.t === '′') {
      this.next();
      a = A.succ(a);
    }
    return a;
  }
  primary(): Term {
    const tok = this.next();
    if (tok.t === '(') {
      const t = this.term();
      this.expect(')');
      return t;
    }
    if (/^\d+$/.test(tok.t)) return tok.t === '0' ? A.zero() : A.numeral(lit(BigInt(tok.t)));
    if (tok.t.startsWith('#')) return A.numeral(named(tok.t.slice(1), `\\mathrm{${tok.t.slice(1)}}`));
    const vi = varIndex(tok.t);
    if (vi !== null) return A.v(vi);
    const ci = constIndex(tok.t);
    if (ci !== null) return A.c(ci);
    const f = GENERIC_FN.indexOf(tok.t);
    if (f >= 0 && this.peek.t === '(') {
      this.next();
      const args = this.termList();
      return A.app(args.length, GENERIC_OFFSET + f, args);
    }
    if (tok.t === '<end>') throw new ParseError('incomplete: expected a term', tok.pos);
    throw new ParseError(`“${tok.t}” is not a term`, tok.pos);
  }
}

export function parseFormula(src: string, opt: ParseOptions = {}): Formula {
  const p = new Parser(src, opt);
  const f = p.formula();
  if (p.peek.t !== '<end>') throw new ParseError(`unexpected “${p.peek.t}”`, p.peek.pos);
  return f;
}

export function parseTerm(src: string): Term {
  const p = new Parser(src, {});
  const t = p.term();
  if (p.peek.t !== '<end>') throw new ParseError(`unexpected “${p.peek.t}”`, p.peek.pos);
  return t;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string; pos: number };

export function tryParseFormula(src: string, opt: ParseOptions = {}): ParseResult<Formula> {
  try {
    return { ok: true, value: parseFormula(src, opt) };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message, pos: e.pos };
    throw e;
  }
}

export function tryParseTerm(src: string): ParseResult<Term> {
  try {
    return { ok: true, value: parseTerm(src) };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, error: e.message, pos: e.pos };
    throw e;
  }
}
