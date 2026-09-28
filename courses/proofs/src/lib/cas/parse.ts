/**
 * A forgiving parser for the maths learners type: `n(n+1)/2`, `2^(n+1) - 1`, `√2`, `x² + 2xy`,
 * `|a - b| ≤ |a| + |b|`, `(n+1)!`, `binom(n, k)`.
 *
 * - Implicit multiplication: `2n`, `n(n+1)`, `(a+b)(a-b)`, `xy` (unknown multi-letter words are
 *   split into single letters; known function and constant names are not).
 * - `^` and `**` are powers (right-associative); `-x^2` is `-(x^2)`.
 * - Unicode: · × − ÷ ² ³ √ ≤ ≥ ≠ π and Greek letters.
 * - Subscripts: `a_1`, `x_n`, `a_{12}` become single symbols.
 * - Relations may be chained: `a = b ≤ c`.
 * - Finite sums and products: `sum(k^2, k, 1, n)` is Σ_{k=1}^{n} k², likewise `prod`.
 */
import { Rat } from './rational';
import { add, div, fn, mul, neg, num, pow, sqrt, sub, sym, type Expr, type Rel } from './expr';

export class ParseError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
  }
}

/** Functions the parser knows. The value is the arity (−1 for variadic). */
export const FUNCTIONS: Record<string, number> = {
  sqrt: 1,
  sin: 1,
  cos: 1,
  tan: 1,
  exp: 1,
  ln: 1,
  log: 1,
  abs: 1,
  floor: 1,
  ceil: 1,
  fact: 1,
  binom: 2,
  gcd: 2,
  lcm: 2,
  max: -1,
  min: -1,
  mod: 2,
  sum: 4,
  prod: 4,
};

/** Named constants (represented as zero-argument functions). */
export const CONSTANTS = new Set(['pi', 'e']);

const GREEK: Record<string, string> = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', λ: 'lambda', μ: 'mu',
  ν: 'nu', ξ: 'xi', ρ: 'rho', σ: 'sigma', τ: 'tau', φ: 'phi', ϕ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega', π: 'pi',
};
const GREEK_NAMES = new Set(Object.values(GREEK));

export interface ParseOptions {
  /** Names parsed as function applications `f(x)` rather than products `f·(x)`. */
  functions?: string[];
  /** Treat `e` as a variable instead of Euler's number (default false). */
  eIsVariable?: boolean;
  /** Extra multi-letter variable names, e.g. `["N1", "delta"]`. */
  variables?: string[];
}

type Tok =
  | { t: 'num'; v: string; pos: number }
  | { t: 'id'; v: string; pos: number }
  | { t: 'op'; v: string; pos: number }
  | { t: 'rel'; v: Rel; pos: number }
  | { t: 'end'; pos: number };

const SUPERSCRIPTS: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

function tokenize(src: string, known: (word: string) => boolean): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const start = i;
    if (/[0-9.]/.test(c)) {
      while (i < src.length && /[0-9]/.test(src[i]!)) i++;
      if (src[i] === '.' && /[0-9]/.test(src[i + 1] ?? '')) {
        i++;
        while (i < src.length && /[0-9]/.test(src[i]!)) i++;
      } else if (c === '.') throw new ParseError('Unexpected “.”', i);
      toks.push({ t: 'num', v: src.slice(start, i), pos: start });
      continue;
    }
    if (SUPERSCRIPTS[c]) {
      let digits = '';
      while (i < src.length && SUPERSCRIPTS[src[i]!]) digits += SUPERSCRIPTS[src[i++]!];
      toks.push({ t: 'op', v: '^', pos: start }, { t: 'num', v: digits, pos: start });
      continue;
    }
    if (GREEK[c]) {
      i++;
      let name = GREEK[c]!;
      name += readSubscript();
      toks.push({ t: 'id', v: name, pos: start });
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      while (i < src.length && /[A-Za-z]/.test(src[i]!)) i++;
      let name = src.slice(start, i);
      // Digits directly after a single letter are a subscript: x1, a2.
      if (name.length === 1 && /[0-9]/.test(src[i] ?? '') && !/[0-9]/.test(src[start - 1] ?? '')) {
        const s = i;
        while (i < src.length && /[0-9]/.test(src[i]!)) i++;
        name += '_' + src.slice(s, i);
      }
      const sub = readSubscript();
      if (name.length > 1 && !name.includes('_') && !known(name)) {
        // An unknown word is a product of letters (xy → x·y); a subscript stays on the last letter.
        for (let j = 0; j < name.length; j++) toks.push({ t: 'id', v: name[j]! + (j === name.length - 1 ? sub : ''), pos: start + j });
      } else toks.push({ t: 'id', v: name + sub, pos: start });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '!=' || two === '==') {
      toks.push({ t: 'rel', v: two === '==' ? '=' : (two as Rel), pos: start });
      i += 2;
      continue;
    }
    if (two === '**') {
      toks.push({ t: 'op', v: '^', pos: start });
      i += 2;
      continue;
    }
    const rels: Record<string, Rel> = { '=': '=', '<': '<', '>': '>', '≤': '<=', '≥': '>=', '≠': '!=', '⩽': '<=', '⩾': '>=' };
    if (rels[c]) {
      toks.push({ t: 'rel', v: rels[c]!, pos: start });
      i++;
      continue;
    }
    const ops: Record<string, string> = { '+': '+', '-': '-', '−': '-', '–': '-', '*': '*', '·': '*', '×': '*', '⋅': '*', '/': '/', '÷': '/', '^': '^', '!': '!', '(': '(', ')': ')', '[': '(', ']': ')', '{': '(', '}': ')', ',': ',', '|': '|', '√': '√' };
    if (ops[c]) {
      toks.push({ t: 'op', v: ops[c]!, pos: start });
      i++;
      continue;
    }
    throw new ParseError(`Unexpected “${c}”`, i);
  }
  toks.push({ t: 'end', pos: src.length });
  return toks;

  function readSubscript(): string {
    if (src[i] !== '_') return '';
    const s = i;
    i++;
    if (src[i] === '{') {
      const close = src.indexOf('}', i);
      if (close < 0) throw new ParseError('Unclosed subscript', s);
      const inner = src.slice(i + 1, close).replace(/\s+/g, '');
      i = close + 1;
      return '_' + inner;
    }
    const m = /^[A-Za-z0-9]+/.exec(src.slice(i));
    if (!m) throw new ParseError('Empty subscript', s);
    i += m[0].length;
    return '_' + m[0];
  }
}

class Parser {
  private i = 0;
  private absDepth = 0;
  private readonly fns: Set<string>;
  private readonly vars: Set<string>;
  private readonly toks: Tok[];
  private readonly opts: ParseOptions;

  constructor(toks: Tok[], opts: ParseOptions) {
    this.toks = toks;
    this.opts = opts;
    this.fns = new Set(opts.functions ?? []);
    this.vars = new Set(opts.variables ?? []);
  }

  private get tok(): Tok {
    return this.toks[this.i]!;
  }
  private isOp(v: string): boolean {
    const t = this.tok;
    return t.t === 'op' && t.v === v;
  }
  private expectOp(v: string): void {
    if (!this.isOp(v)) throw new ParseError(`Expected “${v}”`, this.tok.pos);
    this.i++;
  }

  atEnd(): boolean {
    return this.tok.t === 'end';
  }

  chain(): { exprs: Expr[]; rels: Rel[] } {
    const exprs = [this.expr()];
    const rels: Rel[] = [];
    while (this.tok.t === 'rel') {
      rels.push(this.tok.v);
      this.i++;
      exprs.push(this.expr());
    }
    if (!this.atEnd()) throw new ParseError(`Unexpected “${describe(this.tok)}”`, this.tok.pos);
    return { exprs, rels };
  }

  expr(): Expr {
    let left = this.term();
    for (;;) {
      if (this.isOp('+')) {
        this.i++;
        left = add(left, this.term());
      } else if (this.isOp('-')) {
        this.i++;
        left = sub(left, this.term());
      } else return left;
    }
  }

  private startsPrimary(): boolean {
    const t = this.tok;
    if (t.t === 'num' || t.t === 'id') return true;
    if (t.t === 'op' && (t.v === '(' || t.v === '√')) return true;
    return t.t === 'op' && t.v === '|' && this.absDepth === 0;
  }

  private term(): Expr {
    let left = this.unary();
    for (;;) {
      if (this.isOp('*')) {
        this.i++;
        left = mul(left, this.unary());
      } else if (this.isOp('/')) {
        this.i++;
        left = div(left, this.unary());
      } else if (this.startsPrimary()) {
        left = mul(left, this.power());
      } else return left;
    }
  }

  private unary(): Expr {
    if (this.isOp('-')) {
      this.i++;
      return neg(this.unary());
    }
    if (this.isOp('+')) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }

  private power(): Expr {
    const base = this.postfix();
    if (this.isOp('^')) {
      this.i++;
      return pow(base, this.unary());
    }
    return base;
  }

  private postfix(): Expr {
    let e = this.primary();
    while (this.isOp('!')) {
      this.i++;
      e = fn('fact', e);
    }
    return e;
  }

  private args(): Expr[] {
    this.expectOp('(');
    const saved = this.absDepth;
    this.absDepth = 0;
    const out = [this.expr()];
    while (this.isOp(',')) {
      this.i++;
      out.push(this.expr());
    }
    this.absDepth = saved;
    this.expectOp(')');
    return out;
  }

  private primary(): Expr {
    const t = this.tok;
    if (t.t === 'num') {
      this.i++;
      return num(Rat.parse(t.v));
    }
    if (t.t === 'op' && t.v === '(') {
      this.i++;
      const saved = this.absDepth;
      this.absDepth = 0;
      const e = this.expr();
      this.absDepth = saved;
      this.expectOp(')');
      return e;
    }
    if (t.t === 'op' && t.v === '|') {
      this.i++;
      this.absDepth++;
      const e = this.expr();
      this.absDepth--;
      this.expectOp('|');
      return fn('abs', e);
    }
    if (t.t === 'op' && t.v === '√') {
      this.i++;
      return sqrt(this.postfix());
    }
    if (t.t === 'id') return this.identifier(t.v, t.pos);
    throw new ParseError(t.t === 'end' ? 'Expression ends too early' : `Unexpected “${describe(t)}”`, t.pos);
  }

  private identifier(name: string, pos: number): Expr {
    this.i++;
    const known = (n: string) => n in FUNCTIONS || this.fns.has(n);
    if (known(name)) {
      if (this.isOp('(')) {
        const args = this.args();
        const arity = FUNCTIONS[name];
        if (arity !== undefined && arity >= 0 && args.length !== arity) throw new ParseError(`${name} takes ${arity} argument${arity > 1 ? 's' : ''}`, pos);
        if (name === 'sqrt') return sqrt(args[0]!);
        return fn(name, ...args);
      }
      if (name in FUNCTIONS && FUNCTIONS[name] === 1) {
        // sin x, ln x: the argument is the next power-level operand.
        const arg = this.power();
        return name === 'sqrt' ? sqrt(arg) : fn(name, arg);
      }
      throw new ParseError(`${name} needs arguments in brackets`, pos);
    }
    if (name === 'pi' || (name === 'e' && !this.opts.eIsVariable)) return fn(name);
    return sym(name);
  }
}

function describe(t: Tok): string {
  return t.t === 'end' ? 'end' : t.v;
}

function knownWords(opts: ParseOptions): (word: string) => boolean {
  const fns = new Set(opts.functions ?? []);
  const vars = new Set(opts.variables ?? []);
  return (w) => w in FUNCTIONS || CONSTANTS.has(w) || fns.has(w) || vars.has(w) || GREEK_NAMES.has(w);
}

export function parseExpr(src: string, opts: ParseOptions = {}): Expr {
  const p = new Parser(tokenize(src, knownWords(opts)), opts);
  const { exprs, rels } = p.chain();
  if (rels.length) throw new ParseError('Expected an expression, not a relation', 0);
  return exprs[0]!;
}

export function parseChain(src: string, opts: ParseOptions = {}): { exprs: Expr[]; rels: Rel[] } {
  return new Parser(tokenize(src, knownWords(opts)), opts).chain();
}
