// Parsing lambda terms with the book's conventions (section "The Syntax of the Lambda Calculus"):
//   application associates to the left:  M N P Q  is  (((M N) P) Q);
//   λ takes the widest scope possible:   λx.M N P is  λx.((M N) P);
//   several binders:                     λx y z.M is  λx.λy.λz.M.
//
// Syntax accepted:
//   λx.M  or  \x.M;  λx y z.M;  parentheses;  application by juxtaposition;
//   variables  [a-z][a-z0-9_']*  (′ is accepted for ');
//   with `singleLetter: true`, variables are single letters (optionally x_1, x1, x′), as in the
//     book's λfx.f(fx) — so "fx" is f applied to x;
//   digits: Church numerals n̄ ≡ λf x. fⁿ(x) (a trailing combining overline, as in "2̄", is allowed);
//   ⟨M, N⟩ or <M, N>: the pair λf.f M N (section "Pairs and Predecessor");
//   Uppercase names (K, Y, Succ, IsZero, Ω, …): expanded from `defs` (default: BOOK_DEFS). An
//     exact match is tried first, then a case-insensitive one (so SUCC and TRUE work too).
//   The words true and false, written in lowercase as the book writes them, are the truth values
//     (when `defs` define True/False), not variables.
// Each expansion is a fresh copy (fresh ids), labelled with its name.

import type { Term } from './term.ts';
import { app, cloneFresh, freeVars, freshName, lam, variable, withLabel } from './term.ts';
import { churchNumeral } from './numerals.ts';
import { BOOK_DEFS, type Definition } from './defs.ts';

export class LambdaParseError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
  }
}

export interface LambdaParseOptions {
  /** Named terms for uppercase names. Default BOOK_DEFS; pass {} for none. */
  defs?: Record<string, string | Definition>;
  /** Variables are single letters (with optional digits/primes), as the book writes λfx.f(fx). */
  singleLetter?: boolean;
  /** Largest numeral accepted (default 2000). */
  maxNumeral?: number;
}

export type LambdaParseResult = { ok: true; value: Term } | { ok: false; error: string; pos: number };

type TokKind = 'lambda' | 'dot' | '(' | ')' | '<' | '>' | ',' | 'var' | 'name' | 'num' | 'end';
interface Tok {
  k: TokKind;
  text: string;
  pos: number;
}

function lex(src: string, singleLetter: boolean): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const primes = (s: string) => s.replace(/′/g, "'");
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if (ch === 'λ' || ch === '\\') toks.push({ k: 'lambda', text: ch, pos: i++ });
    else if (ch === '.') toks.push({ k: 'dot', text: ch, pos: i++ });
    else if (ch === '(' || ch === ')' || ch === ',') toks.push({ k: ch, text: ch, pos: i++ });
    else if (ch === '⟨' || ch === '<') toks.push({ k: '<', text: ch, pos: i++ });
    else if (ch === '⟩' || ch === '>') toks.push({ k: '>', text: ch, pos: i++ });
    else if ((m = rest.match(/^(?:true|false)(?![A-Za-z0-9_'′])/))) {
      // the book's truth values, written in lowercase as the book writes them
      toks.push({ k: 'name', text: m[0], pos: i });
      i += m[0].length;
    } else if ((m = rest.match(singleLetter ? /^[a-z](?:_?[0-9]+)?['′]*/ : /^[a-z][a-z0-9_'′]*/))) {
      toks.push({ k: 'var', text: primes(m[0]), pos: i });
      i += m[0].length;
    } else if ((m = rest.match(/^[A-ZΑ-Ω][A-Za-z0-9_'′]*/))) {
      toks.push({ k: 'name', text: primes(m[0]), pos: i });
      i += m[0].length;
    } else if ((m = rest.match(/^[0-9][0-9̄]*/))) {
      toks.push({ k: 'num', text: m[0].replace(/̄/g, ''), pos: i });
      i += m[0].length;
    } else throw new LambdaParseError(`unexpected character “${ch}”`, i);
  }
  toks.push({ k: 'end', text: '<end>', pos: src.length });
  return toks;
}

class Parser {
  toks: Tok[];
  i = 0;
  defs: Record<string, string | Definition>;
  opt: LambdaParseOptions;
  cache: Map<string, Term>;
  stack: string[];
  constructor(src: string, opt: LambdaParseOptions, cache: Map<string, Term>, stack: string[]) {
    this.opt = opt;
    this.defs = opt.defs ?? BOOK_DEFS;
    this.toks = lex(src, opt.singleLetter ?? false);
    this.cache = cache;
    this.stack = stack;
  }
  get peek(): Tok {
    return this.toks[this.i]!;
  }
  next(): Tok {
    return this.toks[this.i++]!;
  }
  expect(k: TokKind, what: string): Tok {
    const t = this.peek;
    if (t.k !== k) throw new LambdaParseError(t.k === 'end' ? `incomplete: expected ${what}` : `expected ${what}, found “${t.text}”`, t.pos);
    return this.next();
  }
  startsAtom(t: Tok): boolean {
    return t.k === 'var' || t.k === 'name' || t.k === 'num' || t.k === '(' || t.k === '<';
  }

  /** term := atom* [abstraction] (at least one item), folded to the left. */
  term(): Term {
    const items: Term[] = [];
    for (;;) {
      const t = this.peek;
      if (t.k === 'lambda') {
        items.push(this.abstraction());
        break;
      }
      if (!this.startsAtom(t)) break;
      items.push(this.atom());
    }
    if (items.length === 0) {
      const t = this.peek;
      throw new LambdaParseError(t.k === 'end' ? 'incomplete: expected a term' : `expected a term, found “${t.text}”`, t.pos);
    }
    return items.slice(1).reduce<Term>((f, a) => app(f, a), items[0]!);
  }

  abstraction(): Term {
    this.expect('lambda', 'λ');
    const params: string[] = [];
    while (this.peek.k === 'var') params.push(this.next().text);
    if (params.length === 0) {
      const t = this.peek;
      throw new LambdaParseError(
        t.k === 'name' ? (/^(true|false)$/.test(t.text) ? `“${t.text}” is the truth value, not a variable` : `a bound variable must be lowercase, not “${t.text}”`) : 'expected a variable after λ',
        t.pos,
      );
    }
    this.expect('dot', '“.” after the bound variables');
    const body = this.term();
    return params.reduceRight<Term>((b, p) => lam(p, b), body);
  }

  atom(): Term {
    const t = this.next();
    switch (t.k) {
      case 'var':
        return variable(t.text);
      case 'num': {
        const n = Number(t.text);
        const max = this.opt.maxNumeral ?? 2000;
        if (!(n <= max)) throw new LambdaParseError(`numeral ${t.text} is too large (at most ${max})`, t.pos);
        return churchNumeral(n);
      }
      case 'name':
        // lowercase true/false without a definition to expand: an ordinary variable
        if (/^[a-z]/.test(t.text) && !Object.keys(this.defs).some((k) => k.toLowerCase() === t.text)) return variable(t.text);
        return this.named(t);
      case '(': {
        const m = this.term();
        this.expect(')', '“)”');
        return m;
      }
      case '<': {
        const a = this.term();
        this.expect(',', '“,” between the components of ⟨M, N⟩');
        const b = this.term();
        this.expect('>', '“⟩”');
        const f = freshName('f', new Set([...freeVars(a), ...freeVars(b)]));
        return lam(f, app(app(variable(f), a), b));
      }
      default:
        throw new LambdaParseError(`expected a term, found “${t.text}”`, t.pos);
    }
  }

  named(t: Tok): Term {
    let key: string | undefined = Object.prototype.hasOwnProperty.call(this.defs, t.text) ? t.text : undefined;
    if (key === undefined) {
      const ci = Object.keys(this.defs).filter((k) => k.toLowerCase() === t.text.toLowerCase());
      if (ci.length === 1) key = ci[0];
    }
    if (key === undefined) throw new LambdaParseError(`unknown name “${t.text}”`, t.pos);
    const raw = this.defs[key]!;
    const def: Definition = typeof raw === 'string' ? { src: raw } : raw;
    let template = this.cache.get(key);
    if (!template) {
      if (typeof def.src !== 'string') template = def.src;
      else {
        if (this.stack.includes(key)) throw new LambdaParseError(`circular definition: ${[...this.stack, key].join(' → ')}`, t.pos);
        const sub = new Parser(def.src, { ...this.opt, singleLetter: false }, this.cache, [...this.stack, key]);
        try {
          template = sub.term();
          if (sub.peek.k !== 'end') throw new LambdaParseError(`unexpected “${sub.peek.text}”`, sub.peek.pos);
        } catch (e) {
          if (e instanceof LambdaParseError) throw new LambdaParseError(e.message.startsWith('in the definition') ? e.message : `in the definition of ${key}: ${e.message}`, t.pos);
          throw e;
        }
      }
      this.cache.set(key, template);
    }
    return withLabel(cloneFresh(template), def.label ?? key);
  }
}

export function parseLambda(src: string, opt: LambdaParseOptions = {}): Term {
  const p = new Parser(src, opt, new Map(), []);
  const t = p.term();
  if (p.peek.k !== 'end') throw new LambdaParseError(p.peek.k === ')' ? 'unbalanced “)”' : `unexpected “${p.peek.text}”`, p.peek.pos);
  return t;
}

export function tryParseLambda(src: string, opt: LambdaParseOptions = {}): LambdaParseResult {
  try {
    return { ok: true, value: parseLambda(src, opt) };
  } catch (e) {
    if (e instanceof LambdaParseError) return { ok: false, error: e.message, pos: e.pos };
    throw e;
  }
}
