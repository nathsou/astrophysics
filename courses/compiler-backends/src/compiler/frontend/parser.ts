import { BUILTINS, CompileError, type BinOp, type Expr, type FuncDecl, type GlobalDecl, type Pos, type Program, type Stmt } from './ast';

export type TokKind = 'num' | 'id' | 'kw' | 'op' | 'eof';
export interface Token {
  k: TokKind;
  s: string;
  v?: bigint;
  pos: Pos;
}

const KEYWORDS = new Set(['fn', 'let', 'if', 'else', 'while', 'for', 'in', 'return', 'break', 'continue', 'global']);
const OPS = ['<<=', '>>=', '..', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
  '+', '-', '*', '/', '%', '&', '|', '^', '<', '>', '=', '!', '~', '(', ')', '{', '}', '[', ']', ',', ';'];

export function lex(src: string): Token[] {
  const toks: Token[] = [];
  let i = 0, line = 1, col = 1;
  const adv = (n: number) => {
    for (let j = 0; j < n; j++) {
      if (src[i] === '\n') { line++; col = 1; } else col++;
      i++;
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { adv(1); continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') adv(1); continue; }
    if (c === '/' && src[i + 1] === '*') {
      adv(2);
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) adv(1);
      adv(2);
      continue;
    }
    const pos = { line, col };
    if (/[0-9]/.test(c)) {
      const m = /^(0x[0-9a-fA-F_]+|0b[01_]+|[0-9_]+)/.exec(src.slice(i))!;
      const text = m[0].replace(/_/g, '');
      toks.push({ k: 'num', s: m[0], v: BigInt(text), pos });
      adv(m[0].length);
      continue;
    }
    if (c === "'") {
      const m = /^'(\\.|[^\\'])'/.exec(src.slice(i));
      if (!m) throw new CompileError('bad character literal', pos);
      const body = m[1];
      const esc: Record<string, number> = { n: 10, t: 9, '0': 0, '\\': 92, "'": 39, r: 13 };
      const v = body.length === 2 ? esc[body[1]] ?? body.charCodeAt(1) : body.charCodeAt(0);
      toks.push({ k: 'num', s: m[0], v: BigInt(v), pos });
      adv(m[0].length);
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      toks.push({ k: KEYWORDS.has(m[0]) ? 'kw' : 'id', s: m[0], pos });
      adv(m[0].length);
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new CompileError(`unexpected character '${c}'`, pos);
    toks.push({ k: 'op', s: op, pos });
    adv(op.length);
  }
  toks.push({ k: 'eof', s: '<eof>', pos: { line, col } });
  return toks;
}

const PREC: Record<string, number> = {
  '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6,
  '<': 7, '<=': 7, '>': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10,
};

class Parser {
  i = 0;
  constructor(private toks: Token[]) {}
  get t() { return this.toks[this.i]; }
  /** position just past the last consumed token */
  get end(): Pos {
    const t = this.toks[Math.max(0, this.i - 1)];
    return { line: t.pos.line, col: t.pos.col + t.s.length };
  }
  /** stamp a freshly built node with its end position */
  fin<T extends Expr | Stmt | FuncDecl | GlobalDecl>(n: T): T {
    n.end = this.end;
    return n;
  }
  next() { return this.toks[this.i++]; }
  is(s: string) { return (this.t.k === 'op' || this.t.k === 'kw') && this.t.s === s; }
  eat(s: string) { if (this.is(s)) { this.i++; return true; } return false; }
  expect(s: string) {
    if (!this.is(s)) throw new CompileError(`expected '${s}' but found '${this.t.s}'`, this.t.pos);
    return this.next();
  }
  ident() {
    if (this.t.k !== 'id') throw new CompileError(`expected identifier but found '${this.t.s}'`, this.t.pos);
    return this.next();
  }

  program(): Program {
    const funcs: FuncDecl[] = [], globals: GlobalDecl[] = [];
    while (this.t.k !== 'eof') {
      if (this.is('fn')) funcs.push(this.func());
      else if (this.is('global')) globals.push(this.global());
      else throw new CompileError(`expected 'fn' or 'global' at top level, found '${this.t.s}'`, this.t.pos);
    }
    return { funcs, globals };
  }

  global(): GlobalDecl {
    const pos = this.expect('global').pos;
    const name = this.ident().s;
    let size = 1, isArray = false;
    if (this.eat('[')) {
      const n = this.next();
      if (n.k !== 'num') throw new CompileError('array size must be a number', n.pos);
      size = Number(n.v);
      isArray = true;
      this.expect(']');
    }
    const init: bigint[] = [];
    if (this.eat('=')) {
      if (this.eat('[')) {
        while (!this.is(']')) {
          init.push(this.constExpr());
          if (!this.eat(',')) break;
        }
        this.expect(']');
        if (!isArray) { size = init.length; isArray = true; }
      } else init.push(this.constExpr());
    }
    if (init.length > size) throw new CompileError(`too many initialisers for '${name}'`, pos);
    this.expect(';');
    return this.fin({ name, size, isArray, init, pos });
  }

  constExpr(): bigint {
    const neg = this.eat('-');
    const n = this.next();
    if (n.k !== 'num') throw new CompileError('global initialisers must be constants', n.pos);
    return neg ? -n.v! : n.v!;
  }

  func(): FuncDecl {
    const pos = this.expect('fn').pos;
    const name = this.ident().s;
    this.expect('(');
    const params: string[] = [];
    while (!this.is(')')) {
      params.push(this.ident().s);
      if (!this.eat(',')) break;
    }
    this.expect(')');
    const body = this.block();
    return this.fin({ name, params, body, pos, endLine: this.toks[this.i - 1].pos.line });
  }

  block(): Stmt[] {
    this.expect('{');
    const out: Stmt[] = [];
    while (!this.is('}')) {
      if (this.t.k === 'eof') throw new CompileError("unterminated block: expected '}'", this.t.pos);
      out.push(this.stmt());
    }
    this.expect('}');
    return out;
  }

  stmt(): Stmt {
    const pos = this.t.pos;
    if (this.eat('let')) {
      const name = this.ident().s;
      let size: number | undefined;
      if (this.eat('[')) {
        const n = this.next();
        if (n.k !== 'num') throw new CompileError('array size must be a number', n.pos);
        size = Number(n.v);
        if (size < 1 || size > 200) throw new CompileError('local arrays must have 1..200 elements', n.pos);
        this.expect(']');
      }
      const init = this.eat('=') ? this.expr() : undefined;
      if (init && size !== undefined) throw new CompileError('local arrays cannot have initialisers', pos);
      this.expect(';');
      return this.fin({ k: 'let', name, size, init, pos });
    }
    if (this.eat('if')) return this.ifRest(pos);
    if (this.eat('while')) {
      const cond = this.expr();
      const body = this.block();
      return this.fin({ k: 'while', cond, body, pos });
    }
    if (this.eat('for')) {
      const name = this.ident().s;
      this.expect('in');
      const from = this.expr();
      this.expect('..');
      const to = this.expr();
      const body = this.block();
      return this.fin({ k: 'for', name, from, to, body, pos });
    }
    if (this.eat('return')) {
      const e = this.is(';') ? undefined : this.expr();
      this.expect(';');
      return this.fin({ k: 'return', e, pos });
    }
    if (this.eat('break')) { this.expect(';'); return this.fin({ k: 'break', pos }); }
    if (this.eat('continue')) { this.expect(';'); return this.fin({ k: 'continue', pos }); }
    const e = this.expr();
    if (this.eat('=')) {
      if (e.k !== 'var' && e.k !== 'index') throw new CompileError('left side of assignment must be a variable or element', pos);
      const value = this.expr();
      this.expect(';');
      return this.fin({ k: 'assign', target: e, value, pos });
    }
    const compound = ['+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='].find((o) => this.is(o));
    if (compound) {
      this.next();
      if (e.k !== 'var' && e.k !== 'index') throw new CompileError('left side of assignment must be a variable or element', pos);
      const r = this.expr();
      this.expect(';');
      return this.fin({ k: 'assign', target: e, value: this.fin({ k: 'bin', op: compound.slice(0, -1) as BinOp, l: e, r, pos }), pos });
    }
    this.expect(';');
    return this.fin({ k: 'expr', e, pos });
  }

  ifRest(pos: Pos): Stmt {
    const cond = this.expr();
    const then = this.block();
    let els: Stmt[] | undefined;
    if (this.eat('else')) {
      const p2 = this.t.pos;
      els = this.eat('if') ? [this.ifRest(p2)] : this.block();
    }
    return this.fin({ k: 'if', cond, then, else: els, pos });
  }

  expr(minPrec = 1): Expr {
    let l = this.unary();
    for (;;) {
      const t = this.t;
      const p = t.k === 'op' ? PREC[t.s] : undefined;
      if (p === undefined || p < minPrec) return l;
      this.next();
      const r = this.expr(p + 1);
      l = this.fin({ k: 'bin', op: t.s as BinOp, l, r, pos: t.pos });
    }
  }

  unary(): Expr {
    const t = this.t;
    if (this.eat('-') || this.eat('!') || this.eat('~')) {
      const e = this.unary();
      if (t.s === '-' && e.k === 'num') return this.fin({ k: 'num', v: -e.v, pos: t.pos });
      return this.fin({ k: 'un', op: t.s as '-' | '!' | '~', e, pos: t.pos });
    }
    return this.postfix();
  }

  postfix(): Expr {
    let e = this.primary();
    while (this.is('[')) {
      const pos = this.next().pos;
      const idx = this.expr();
      this.expect(']');
      e = this.fin({ k: 'index', base: e, idx, pos });
    }
    return e;
  }

  primary(): Expr {
    const t = this.next();
    if (t.k === 'num') return this.fin({ k: 'num', v: t.v!, pos: t.pos });
    if (t.k === 'id') {
      if (this.eat('(')) {
        const args: Expr[] = [];
        while (!this.is(')')) {
          args.push(this.expr());
          if (!this.eat(',')) break;
        }
        this.expect(')');
        return this.fin({ k: 'call', name: t.s, args, pos: t.pos });
      }
      return this.fin({ k: 'var', name: t.s, pos: t.pos });
    }
    if (t.k === 'op' && t.s === '(') {
      const e = this.expr();
      this.expect(')');
      return e;
    }
    throw new CompileError(`unexpected '${t.s}' in expression`, t.pos);
  }
}

export function parse(src: string): Program {
  return parseTokens(lex(src));
}

/** Parse an already-lexed token stream (the pipeline keeps the tokens as a stage of their own). */
export function parseTokens(toks: Token[]): Program {
  const prog = new Parser(toks).program();
  check(prog);
  return prog;
}

/** Name resolution and arity checks, so later stages can assume a well-formed program. */
function check(prog: Program) {
  const funcs = new Map<string, FuncDecl>();
  const globals = new Set<string>();
  for (const g of prog.globals) {
    if (globals.has(g.name)) throw new CompileError(`duplicate global '${g.name}'`, g.pos, 'check');
    globals.add(g.name);
  }
  for (const f of prog.funcs) {
    if (funcs.has(f.name) || BUILTINS[f.name]) throw new CompileError(`duplicate function '${f.name}'`, f.pos, 'check');
    if (globals.has(f.name)) throw new CompileError(`'${f.name}' is already a global`, f.pos, 'check');
    funcs.set(f.name, f);
  }
  if (!funcs.has('main')) throw new CompileError("program has no 'main' function", { line: 1, col: 1 }, 'check');
  for (const f of prog.funcs) {
    const scopes: Set<string>[] = [new Set(f.params)];
    const declared = (n: string) => scopes.some((s) => s.has(n)) || globals.has(n);
    let loops = 0;
    const expr = (e: Expr): void => {
      switch (e.k) {
        case 'num': return;
        case 'var':
          if (!declared(e.name)) throw new CompileError(`undefined variable '${e.name}'`, e.pos, 'check');
          return;
        case 'bin': expr(e.l); expr(e.r); return;
        case 'un': expr(e.e); return;
        case 'index': expr(e.base); expr(e.idx); return;
        case 'call': {
          const target = funcs.get(e.name);
          const arity = target ? target.params.length : BUILTINS[e.name]?.arity;
          if (arity === undefined) throw new CompileError(`undefined function '${e.name}'`, e.pos, 'check');
          if (arity !== e.args.length) throw new CompileError(`'${e.name}' expects ${arity} argument(s), got ${e.args.length}`, e.pos, 'check');
          e.args.forEach(expr);
        }
      }
    };
    const block = (b: Stmt[]) => {
      scopes.push(new Set());
      b.forEach(stmt);
      scopes.pop();
    };
    const stmt = (s: Stmt): void => {
      switch (s.k) {
        case 'let': if (s.init) expr(s.init); scopes[scopes.length - 1].add(s.name); return;
        case 'assign': expr(s.target); expr(s.value); return;
        case 'if': expr(s.cond); block(s.then); if (s.else) block(s.else); return;
        case 'while': expr(s.cond); loops++; block(s.body); loops--; return;
        case 'for':
          expr(s.from); expr(s.to);
          loops++;
          scopes.push(new Set([s.name]));
          block(s.body);
          scopes.pop();
          loops--;
          return;
        case 'return': if (s.e) expr(s.e); return;
        case 'break': case 'continue':
          if (!loops) throw new CompileError(`'${s.k}' outside of a loop`, s.pos, 'check');
          return;
        case 'expr': expr(s.e); return;
      }
    };
    block(f.body);
  }
}
