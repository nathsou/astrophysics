/**
 * The Vouch parser: hand-written recursive descent with error recovery, so that the language server can offer
 * types, hovers and completions in code that is still being written.
 *
 * Precedence, from loosest to tightest (docs/VOUCH.md, "Expressions"):
 *   forall/exists (extend as far right as possible)
 *   <==>    ==> (right) <== (left)    until ~>    ||    && **    comparisons (chained) in !in |-> at
 *   |    ^    &    << >>    + - ++    * / %    as    unary (- ! ~ # ^ * always eventually next)    postfix
 */
import { lex, type Span, type Token } from './lexer';
import type * as A from './ast';
import { diag, type Diagnostic } from '../diagnostics';

export interface ParseResult {
  program: A.Program;
  diagnostics: Diagnostic[];
  tokens: Token[];
}

class ParseError extends Error {}

const COMPARE = new Set(['==', '!=', '<', '<=', '>', '>=', 'in', '!in', '|->']);
const STMT_START_KW = new Set(['let', 'var', 'ghost', 'if', 'while', 'for', 'loop', 'match', 'return', 'break', 'assert', 'assume', 'await', 'atomic', 'choose', 'free', 'skip']);
const DECL_START = new Set(['fn', 'pure', 'pred', 'lemma', 'ghost', 'const', 'enum', 'struct', 'class', 'type', 'symmetric', 'system', 'world', 'problem']);
const MEMBER_START = new Set([...DECL_START, 'var', 'init', 'action', 'process', 'invariant', 'property', 'fairness', 'instance', 'refines', 'rel', 'fact', 'check', 'run', 'constraint', 'solve', 'count']);

export function parse(src: string): ParseResult {
  const p = new Parser(src);
  const program = p.program();
  return { program, diagnostics: p.diagnostics, tokens: p.tokens };
}

/** Parse a single expression (used by tests, the LSP and exercises that ask for a formula). */
export function parseExpr(src: string): { expr?: A.Expr; diagnostics: Diagnostic[] } {
  const p = new Parser(src);
  try {
    p.skipNewlines();
    const expr = p.expr();
    p.skipNewlines();
    if (p.peek().kind !== 'eof') p.error(p.peek().span, 'parse/trailing', `Unexpected “${p.peek().value}” after the expression.`);
    return { expr, diagnostics: p.diagnostics };
  } catch (e) {
    if (e instanceof ParseError) return { diagnostics: p.diagnostics };
    throw e;
  }
}

class Parser {
  tokens: Token[];
  pos = 0;
  diagnostics: Diagnostic[] = [];
  /** Inside an `if`/`while` condition a `Name {` is a block, not a struct literal. */
  private noStruct = false;

  constructor(readonly src: string) {
    this.tokens = lex(src);
    for (const t of this.tokens) if (t.kind === 'error') this.diagnostics.push(diag('error', 'lex/error', t.message ?? 'Unexpected input.', t.span));
    this.tokens = this.tokens.filter((t) => t.kind !== 'error');
  }

  // ── Token helpers ──
  peek(n = 0): Token {
    return this.tokens[Math.min(this.pos + n, this.tokens.length - 1)]!;
  }
  next(): Token {
    const t = this.peek();
    if (this.pos < this.tokens.length - 1) this.pos++;
    return t;
  }
  is(value: string, n = 0): boolean {
    const t = this.peek(n);
    return (t.kind === 'op' || t.kind === 'kw') && t.value === value;
  }
  isIdent(n = 0): boolean {
    return this.peek(n).kind === 'ident';
  }
  eat(value: string): Token | undefined {
    if (this.is(value)) return this.next();
    return undefined;
  }
  expect(value: string, what?: string): Token {
    if (this.is(value)) return this.next();
    const t = this.peek();
    this.error(t.span, 'parse/expected', `Expected ${what ?? `“${value}”`} but found ${describe(t)}.`);
    throw new ParseError();
  }
  ident(what = 'a name'): A.Ident {
    const t = this.peek();
    // Soft keywords (count, set, run, …) are allowed as names.
    if (t.kind === 'ident' || (t.kind === 'kw' && ['count', 'some', 'no', 'one', 'lone', 'set', 'run', 'check', 'fact', 'rel', 'solve', 'instance', 'init', 'next', 'weak', 'strong', 'via', 'where'].includes(t.value))) {
      this.next();
      return { name: t.value, span: t.span };
    }
    this.error(t.span, 'parse/expected-name', `Expected ${what} but found ${describe(t)}.`);
    throw new ParseError();
  }
  error(span: Span, code: string, message: string): void {
    // One error per position is enough.
    if (this.diagnostics.some((d) => d.span.start === span.start && d.severity === 'error')) return;
    this.diagnostics.push(diag('error', code, message, span));
  }
  skipNewlines(): void {
    while (this.peek().kind === 'newline') this.next();
  }
  span(start: number): Span {
    const prev = this.tokens[Math.max(0, this.pos - 1)]!;
    return { start, end: Math.max(start, prev.span.end) };
  }
  /** Skip to the next newline at this nesting level or to a closing brace (for error recovery in blocks). */
  recoverStmt(): void {
    let depth = 0;
    while (this.peek().kind !== 'eof') {
      const t = this.peek();
      if (t.kind === 'newline' && depth === 0) return;
      if (t.value === '{' && t.kind === 'op') depth++;
      if (t.value === '}' && t.kind === 'op') {
        if (depth === 0) return;
        depth--;
      }
      this.next();
    }
  }
  /** Skip to the next declaration keyword at the start of a line. */
  recoverDecl(starts: Set<string>): void {
    let depth = 0;
    while (this.peek().kind !== 'eof') {
      const t = this.peek();
      if (t.kind === 'op' && t.value === '{') depth++;
      if (t.kind === 'op' && t.value === '}') {
        if (depth === 0) return;
        depth--;
      }
      this.next();
      if (depth === 0 && this.peek().kind === 'kw' && starts.has(this.peek().value) && this.atLineStart(this.peek())) return;
    }
  }

  /** Is the token the first thing on its source line? */
  atLineStart(t: Token): boolean {
    let i = t.span.start - 1;
    while (i >= 0 && (this.src[i] === ' ' || this.src[i] === '\t')) i--;
    return i < 0 || this.src[i] === '\n';
  }

  // ── Program and declarations ──
  program(): A.Program {
    const decls: A.Decl[] = [];
    this.skipNewlines();
    while (this.peek().kind !== 'eof') {
      const start = this.pos;
      try {
        const d = this.decl();
        if (d) decls.push(d);
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        this.recoverDecl(DECL_START);
      }
      if (this.pos === start) this.next();
      this.skipNewlines();
    }
    return { decls, span: { start: 0, end: this.src.length } };
  }

  decl(): A.Decl | undefined {
    const t = this.peek();
    if (t.kind === 'kw') {
      switch (t.value) {
        case 'fn':
        case 'pure':
        case 'pred':
        case 'lemma':
        case 'ghost':
          return this.fnDecl();
        case 'const':
          return this.constDecl();
        case 'enum':
          return this.enumDecl();
        case 'struct':
        case 'class':
          return this.structDecl();
        case 'type':
        case 'symmetric':
          return this.typeDecl();
        case 'system':
        case 'world':
        case 'problem':
          return this.container();
      }
    }
    this.error(t.span, 'parse/decl', `Expected a declaration (fn, pure fn, pred, lemma, const, enum, struct, type, system, world or problem) but found ${describe(t)}.`);
    throw new ParseError();
  }

  docBefore(start: number): string | undefined {
    // A run of // comments directly above the declaration is its documentation (shown on hover).
    const before = this.src.slice(0, start).split('\n');
    before.pop();
    const lines: string[] = [];
    while (before.length && /^\s*\/\/\/?/.test(before.at(-1)!)) lines.unshift(before.pop()!.replace(/^\s*\/\/\/?\s?/, ''));
    return lines.length ? lines.join('\n') : undefined;
  }

  fnDecl(): A.FnDecl {
    const start = this.peek().span.start;
    let ghost = false;
    let flavour: A.FnFlavour = 'fn';
    if (this.eat('ghost')) ghost = true;
    if (this.eat('pure')) {
      flavour = 'pure';
      this.expect('fn', '“fn” after “pure”');
    } else if (this.eat('pred')) flavour = 'pred';
    else if (this.eat('lemma')) {
      flavour = 'lemma';
      ghost = true;
    } else this.expect('fn', '“fn”');
    if (flavour === 'pure' || flavour === 'pred') ghost = ghost || false;
    const name = this.ident('a function name');
    const params = this.params();
    let result: A.FnDecl['result'];
    if (this.eat('->')) {
      const rs = this.peek().span.start;
      if (this.is('(') && (this.peek(1).kind === 'ident') && this.is(':', 2)) {
        this.next();
        const rn = this.ident();
        this.expect(':');
        const type = this.type();
        this.expect(')');
        result = { name: rn.name, type, span: this.span(rs) };
      } else {
        result = { type: this.type(), span: this.span(rs) };
      }
    }
    if (flavour === 'pred' && !result) result = { type: { k: 'named', name: 'bool', args: [], span: name.span }, span: name.span };
    const spec = this.specClauses();
    let body: A.FnDecl['body'];
    this.skipNewlinesBefore('{');
    if (this.is('{')) {
      body = flavour === 'pure' || flavour === 'pred' ? this.exprBlock() : this.block();
    }
    return { k: 'fn', flavour, ghost, name: name.name, nameSpan: name.span, params, result, spec, body, span: this.span(start), doc: this.docBefore(start) };
  }

  /** Allow `{` on the line after a signature or contract. */
  skipNewlinesBefore(value: string): void {
    let n = 0;
    while (this.peek(n).kind === 'newline') n++;
    if (n && this.is(value, n)) this.pos += n;
  }

  params(): A.Param[] {
    const out: A.Param[] = [];
    if (!this.is('(')) return out;
    this.next();
    while (!this.is(')') && this.peek().kind !== 'eof') {
      const start = this.peek().span.start;
      let ghost = false;
      let mode: 'in' | 'inout' = 'in';
      if (this.eat('ghost')) ghost = true;
      if (this.eat('inout')) mode = 'inout';
      // `a, b: int` declares several parameters of one type.
      const names = [this.ident('a parameter name')];
      while (this.is(',') && this.peek(1).kind === 'ident' && (this.is(',', 2) || this.is(':', 2))) {
        this.next();
        names.push(this.ident());
      }
      this.expect(':', '“:” and a type');
      const type = this.type();
      for (const n of names) out.push({ name: n.name, type, mode, ghost, span: { start: names.length > 1 ? n.span.start : start, end: type.span.end } });
      if (!this.eat(',')) break;
    }
    this.expect(')');
    return out;
  }

  specClauses(): A.Spec {
    const spec: A.Spec = { requires: [], ensures: [] };
    for (;;) {
      let n = 0;
      while (this.peek(n).kind === 'newline') n++;
      const t = this.peek(n);
      if (t.kind !== 'kw' || !['requires', 'ensures', 'decreases', 'reads', 'modifies'].includes(t.value)) break;
      this.pos += n;
      this.next();
      if (t.value === 'requires' || t.value === 'ensures') {
        const lbl = this.labelled(() => this.expr());
        (t.value === 'requires' ? spec.requires : spec.ensures).push(lbl);
      } else {
        const list = [this.expr()];
        while (this.eat(',')) list.push(this.expr());
        if (t.value === 'decreases') spec.decreases = list;
        else if (t.value === 'reads') spec.reads = list;
        else spec.modifies = list;
      }
    }
    return spec;
  }

  labelled<T>(f: () => T): A.Labelled<T> {
    const start = this.peek().span.start;
    let label: string | undefined;
    if (this.isIdent() && this.is(':', 1)) {
      label = this.next().value;
      this.next();
    }
    const value = f();
    return { label, value, span: this.span(start) };
  }

  constDecl(): A.ConstDecl {
    const start = this.next().span.start;
    const name = this.ident();
    const type = this.eat(':') ? this.type() : undefined;
    this.expect('=');
    const value = this.expr();
    return { k: 'const', name: name.name, nameSpan: name.span, type, value, span: this.span(start) };
  }

  enumDecl(): A.EnumDecl {
    const start = this.next().span.start;
    const name = this.ident('an enum name');
    this.expect('{');
    const variants: A.EnumDecl['variants'] = [];
    this.skipNewlines();
    while (!this.is('}') && this.peek().kind !== 'eof') {
      const v = this.ident('a variant name');
      const fields: { name: string; type: A.TypeExpr; span: Span }[] = [];
      if (this.eat('(')) {
        while (!this.is(')')) {
          const fs = this.peek().span.start;
          const f = this.ident('a field name');
          this.expect(':');
          fields.push({ name: f.name, type: this.type(), span: this.span(fs) });
          if (!this.eat(',')) break;
        }
        this.expect(')');
      }
      variants.push({ name: v.name, span: v.span, fields });
      this.eat(',');
      this.skipNewlines();
    }
    this.expect('}');
    return { k: 'enum', name: name.name, nameSpan: name.span, variants, span: this.span(start) };
  }

  structDecl(): A.StructDecl {
    const kw = this.next();
    const name = this.ident('a name');
    this.expect('{');
    const fields: A.StructDecl['fields'] = [];
    this.skipNewlines();
    while (!this.is('}') && this.peek().kind !== 'eof') {
      const fs = this.peek().span.start;
      const ghost = !!this.eat('ghost');
      this.eat('var');
      const f = this.ident('a field name');
      this.expect(':');
      fields.push({ name: f.name, type: this.type(), span: this.span(fs), ghost });
      this.eat(',');
      this.skipNewlines();
    }
    this.expect('}');
    return { k: kw.value as 'struct' | 'class', name: name.name, nameSpan: name.span, fields, span: this.span(kw.span.start) };
  }

  typeDecl(): A.TypeDecl {
    const start = this.peek().span.start;
    const symmetric = !!this.eat('symmetric');
    this.expect('type');
    const names = [this.ident('a type name')];
    while (this.eat(',')) names.push(this.ident('a type name'));
    const def = this.eat('=') ? this.type() : undefined;
    return { k: 'type', names, def, symmetric, span: this.span(start) };
  }

  container(): A.ContainerDecl {
    const kw = this.next();
    const kind = kw.value as 'system' | 'world' | 'problem';
    const name = this.ident(`a ${kind} name`);
    this.skipNewlinesBefore('{');
    this.expect('{');
    const members: A.Member[] = [];
    this.skipNewlines();
    while (!this.is('}') && this.peek().kind !== 'eof') {
      const start = this.pos;
      try {
        members.push(this.member(kind));
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        this.recoverDecl(MEMBER_START);
      }
      if (this.pos === start) this.next();
      this.skipNewlines();
    }
    this.expect('}');
    return { k: kind, name: name.name, nameSpan: name.span, members, span: this.span(kw.span.start) };
  }

  member(kind: 'system' | 'world' | 'problem'): A.Member {
    const t = this.peek();
    const start = t.span.start;
    if (t.kind === 'kw') {
      switch (t.value) {
        case 'fn':
        case 'pure':
        case 'pred':
        case 'lemma':
          return this.fnDecl();
        case 'ghost':
          if (this.is('var', 1)) {
            this.next();
            const v = this.varMember(start);
            v.ghost = true;
            return v;
          }
          return this.fnDecl();
        case 'const':
          return this.constDecl();
        case 'enum':
          return this.enumDecl();
        case 'struct':
        case 'class':
          return this.structDecl();
        case 'type':
        case 'symmetric':
          return this.typeDecl();
        case 'var':
          return this.varMember(start);
        case 'init': {
          this.next();
          return { k: 'init', body: this.block(), span: this.span(start) };
        }
        case 'action': {
          this.next();
          const name = this.ident('an action name');
          const params = this.params();
          let guard: A.Expr | undefined;
          if (this.eat('when')) guard = this.withNoStruct(() => this.expr());
          this.skipNewlinesBefore('{');
          const body = this.is('{') ? this.block() : { stmts: [], span: this.span(start) };
          return { k: 'action', name: name.name, nameSpan: name.span, params, guard, body, span: this.span(start) };
        }
        case 'process': {
          this.next();
          const name = this.ident('a process name');
          const params = this.params();
          this.skipNewlinesBefore('{');
          return { k: 'process', name: name.name, nameSpan: name.span, params, body: this.block(), span: this.span(start) };
        }
        case 'invariant':
        case 'property':
        case 'fact':
        case 'check':
        case 'run':
        case 'constraint': {
          this.next();
          let name: A.Ident | undefined;
          if ((this.isIdent() || this.peek().kind === 'kw') && this.is(':', 1) && !this.is('::', 1)) {
            name = this.ident();
            this.next();
          }
          const expr = this.expr();
          let scope: number | undefined;
          if ((t.value === 'check' || t.value === 'run') && this.eat('for')) {
            const n = this.next();
            if (n.kind !== 'int') this.error(n.span, 'parse/scope', 'Expected a scope (a number) after “for”.');
            else scope = Number(n.int);
          }
          return { k: t.value as A.PropDecl['k'], name: name?.name, nameSpan: name?.span, expr, scope, span: this.span(start) };
        }
        case 'fairness': {
          this.next();
          const s = this.next();
          if (s.value !== 'weak' && s.value !== 'strong') {
            this.error(s.span, 'parse/fairness', 'Expected “weak” or “strong” after “fairness”.');
            throw new ParseError();
          }
          const targets = [this.ident('an action or process name')];
          while (this.eat(',')) targets.push(this.ident('an action or process name'));
          return { k: 'fairness', strength: s.value as 'weak' | 'strong', targets, span: this.span(start) };
        }
        case 'instance': {
          this.next();
          const ty = this.ident('a type name');
          this.expect('=');
          const n = this.next();
          if (n.kind !== 'int') this.error(n.span, 'parse/instance', 'Expected the instance size (a number).');
          return { k: 'instance', type: ty.name, size: Number(n.int ?? 1n), span: this.span(start) };
        }
        case 'rel': {
          this.next();
          const name = this.ident('a relation name');
          this.expect(':');
          return { k: 'rel', name: name.name, nameSpan: name.span, type: this.relType(), span: this.span(start) };
        }
        case 'refines': {
          this.next();
          const spec = this.ident('the specification system’s name');
          const mapping: A.RefinesDecl['mapping'] = [];
          if (this.eat('via')) {
            this.expect('{');
            this.skipNewlines();
            while (!this.is('}')) {
              const ms = this.peek().span.start;
              const n = this.ident();
              this.expect('=');
              mapping.push({ name: n.name, value: this.expr(), span: this.span(ms) });
              this.eat(',');
              this.skipNewlines();
            }
            this.expect('}');
          }
          return { k: 'refines', spec: spec.name, mapping, span: this.span(start) };
        }
        case 'solve':
        case 'count':
          this.next();
          return { k: t.value as 'solve' | 'count', span: this.span(start) };
      }
    }
    this.error(t.span, 'parse/member', `Expected a ${kind} member but found ${describe(t)}.`);
    throw new ParseError();
  }

  varMember(start: number): A.VarDecl {
    this.expect('var');
    const name = this.ident('a variable name');
    this.expect(':', '“:” and a type');
    const type = this.type();
    const init = this.eat('=') ? this.expr() : undefined;
    return { k: 'var', name: name.name, nameSpan: name.span, type, init, ghost: false, span: this.span(start) };
  }

  // ── Types ──
  type(): A.TypeExpr {
    const start = this.peek().span.start;
    let t = this.typeAtom();
    if (this.is('->')) {
      this.next();
      const result = this.type();
      const params = t.k === 'tuple' ? t.elems : [t];
      t = { k: 'func', params, result, span: this.span(start) };
    }
    return t;
  }

  relType(): A.TypeExpr {
    const start = this.peek().span.start;
    const cols = [this.typeAtom()];
    let mult: A.Multiplicity = 'set';
    while (this.eat('->')) {
      if (this.peek().kind === 'kw' && ['one', 'lone', 'some', 'set'].includes(this.peek().value)) mult = this.next().value as A.Multiplicity;
      cols.push(this.typeAtom());
    }
    return { k: 'rel', cols, mult, span: this.span(start) };
  }

  typeAtom(): A.TypeExpr {
    const t = this.peek();
    const start = t.span.start;
    // Ranges: 0..3, -1..=1, 0..N
    if (t.kind === 'int' || (t.kind === 'op' && t.value === '-') || (t.kind === 'ident' && (this.is('..', 1) || this.is('..=', 1)))) {
      const lo = this.additive();
      const inclusive = !!this.eat('..=');
      if (!inclusive) this.expect('..', '“..” (a range type such as 0..3)');
      const hi = this.additive();
      return { k: 'range', lo, hi, inclusive, span: this.span(start) };
    }
    if (this.eat('[')) {
      const elem = this.type();
      this.expect(']');
      return { k: 'seq', elem, span: this.span(start) };
    }
    if (this.eat('(')) {
      const elems = [this.type()];
      while (this.eat(',')) elems.push(this.type());
      this.expect(')');
      return elems.length === 1 ? elems[0]! : { k: 'tuple', elems, span: this.span(start) };
    }
    if (this.is('{')) {
      this.next();
      const variants: A.Ident[] = [];
      while (!this.is('}')) {
        variants.push(this.ident('an enumeration value'));
        if (!this.eat(',')) break;
      }
      this.expect('}');
      return { k: 'enum', variants, span: this.span(start) };
    }
    if (this.is('ref')) {
      // not a keyword; handled below as ident
    }
    if (t.kind === 'ident' && t.value === 'ref') {
      this.next();
      const cls = this.ident('a class name');
      const nullable = !!this.eat('?');
      return { k: 'ref', cls: cls.name, nullable, span: this.span(start) };
    }
    if (t.kind === 'kw' && t.value === 'set') {
      // `set<T>`
      this.next();
      return { k: 'named', name: 'set', args: this.typeArgs(), span: this.span(start) };
    }
    const name = this.ident('a type');
    const args = this.is('<') ? this.typeArgs() : [];
    return { k: 'named', name: name.name, args, span: this.span(start) };
  }

  typeArgs(): A.TypeExpr[] {
    this.expect('<', '“<” and type arguments');
    const args = [this.type()];
    while (this.eat(',')) args.push(this.type());
    // `>>` closes two levels: split it.
    if (this.is('>>')) {
      const t = this.peek();
      t.value = '>';
      t.span = { start: t.span.start + 1, end: t.span.end };
      return args;
    }
    this.expect('>');
    return args;
  }

  // ── Statements ──
  block(): A.Block {
    const start = this.expect('{').span.start;
    const stmts: A.Stmt[] = [];
    this.skipNewlines();
    while (!this.is('}') && this.peek().kind !== 'eof') {
      const before = this.pos;
      try {
        stmts.push(this.stmt());
        if (!this.is('}') && this.peek().kind !== 'newline' && this.peek().kind !== 'eof') {
          this.error(this.peek().span, 'parse/newline', `Expected a new line before ${describe(this.peek())}: Vouch puts one statement per line.`);
          throw new ParseError();
        }
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        this.recoverStmt();
      }
      if (this.pos === before) this.next();
      this.skipNewlines();
    }
    this.expect('}');
    return { stmts, span: this.span(start) };
  }

  withNoStruct<T>(f: () => T): T {
    const saved = this.noStruct;
    this.noStruct = true;
    try {
      return f();
    } finally {
      this.noStruct = saved;
    }
  }

  loopSpec(): A.LoopSpec {
    const spec: A.LoopSpec = { invariants: [] };
    for (;;) {
      let n = 0;
      while (this.peek(n).kind === 'newline') n++;
      const t = this.peek(n);
      if (t.kind !== 'kw' || (t.value !== 'invariant' && t.value !== 'decreases')) break;
      this.pos += n;
      this.next();
      if (t.value === 'invariant') spec.invariants.push(this.labelled(() => this.withNoStruct(() => this.expr())));
      else {
        const list = [this.withNoStruct(() => this.expr())];
        while (this.eat(',')) list.push(this.withNoStruct(() => this.expr()));
        spec.decreases = list;
      }
    }
    this.skipNewlinesBefore('{');
    return spec;
  }

  stmt(): A.Stmt {
    const t = this.peek();
    const start = t.span.start;
    // Labels: `name: stmt` (process steps, named assertions).
    const softLabel = t.kind === 'kw' && ['count', 'some', 'no', 'one', 'lone', 'set', 'run', 'check', 'fact', 'rel', 'solve', 'instance', 'init', 'next', 'weak', 'strong', 'via', 'where'].includes(t.value);
    if ((t.kind === 'ident' || softLabel) && this.is(':', 1) && !this.is('::', 1)) {
      this.next();
      this.next();
      this.skipNewlines();
      const stmt = this.stmt();
      return { k: 'label', label: t.value, labelSpan: t.span, stmt, span: this.span(start) };
    }
    if (t.kind === 'kw') {
      switch (t.value) {
        case 'let':
        case 'var':
        case 'ghost': {
          let ghost = false;
          if (t.value === 'ghost') {
            ghost = true;
            this.next();
          }
          const kw = this.next();
          if (kw.value !== 'let' && kw.value !== 'var') {
            this.error(kw.span, 'parse/ghost', 'Expected “let” or “var” after “ghost”.');
            throw new ParseError();
          }
          const mutable = kw.value === 'var';
          const name = this.ident('a variable name');
          if (this.is(',')) {
            const targets: A.Expr[] = [{ k: 'var', name: name.name, span: name.span }];
            while (this.eat(',')) {
              const n = this.ident();
              targets.push({ k: 'var', name: n.name, span: n.span });
            }
            this.expect('=');
            const values = [this.expr()];
            while (this.eat(',')) values.push(this.expr());
            return { k: 'multi', targets, values, declare: true, mutable, span: this.span(start) };
          }
          const type = this.eat(':') ? this.type() : undefined;
          const init = this.eat('=') ? this.expr() : undefined;
          return { k: 'let', name: name.name, nameSpan: name.span, type, init, mutable, ghost, span: this.span(start) };
        }
        case 'if':
          return this.ifStmt();
        case 'while': {
          this.next();
          const cond = this.withNoStruct(() => this.expr());
          const spec = this.loopSpec();
          return { k: 'while', cond, spec, body: this.block(), span: this.span(start) };
        }
        case 'for': {
          this.next();
          const v = this.ident('a loop variable');
          this.expect('in');
          const lo = this.withNoStruct(() => this.additive());
          const inclusive = !!this.eat('..=');
          if (!inclusive) this.expect('..', '“..” (for i in lo..hi)');
          const hi = this.withNoStruct(() => this.additive());
          const spec = this.loopSpec();
          return { k: 'for', v: v.name, vSpan: v.span, lo, hi, inclusive, spec, body: this.block(), span: this.span(start) };
        }
        case 'loop':
          this.next();
          return { k: 'loop', body: this.block(), span: this.span(start) };
        case 'atomic':
          this.next();
          return { k: 'atomic', body: this.block(), span: this.span(start) };
        case 'match': {
          this.next();
          const scrutinee = this.withNoStruct(() => this.expr());
          this.expect('{');
          const arms: { pattern: A.Pattern; body: A.Block; span: Span }[] = [];
          this.skipNewlines();
          while (!this.is('}') && this.peek().kind !== 'eof') {
            const as = this.peek().span.start;
            const pattern = this.pattern();
            this.expect('=>');
            let body: A.Block;
            if (this.is('{')) body = this.block();
            else {
              const s = this.stmt();
              body = { stmts: [s], span: s.span };
            }
            arms.push({ pattern, body, span: this.span(as) });
            this.eat(',');
            this.skipNewlines();
          }
          this.expect('}');
          return { k: 'match', scrutinee, arms, span: this.span(start) };
        }
        case 'return': {
          this.next();
          const value = this.peek().kind === 'newline' || this.is('}') ? undefined : this.expr();
          return { k: 'return', value, span: this.span(start) };
        }
        case 'break':
          this.next();
          return { k: 'break', span: this.span(start) };
        case 'skip':
          this.next();
          return { k: 'skip', span: this.span(start) };
        case 'assert': {
          this.next();
          const l = this.labelled(() => this.expr());
          return { k: 'assert', cond: l.value, label: l.label, span: this.span(start) };
        }
        case 'assume':
          this.next();
          return { k: 'assume', cond: this.expr(), span: this.span(start) };
        case 'await':
          this.next();
          return { k: 'await', cond: this.expr(), span: this.span(start) };
        case 'free':
          this.next();
          return { k: 'free', target: this.expr(), span: this.span(start) };
        case 'choose': {
          this.next();
          const n = this.ident('a variable name');
          this.expect(':');
          const type = this.type();
          const where = this.eat('where') ? this.expr() : undefined;
          return { k: 'choose', name: n.name, nameSpan: n.span, type, where, span: this.span(start) };
        }
      }
    }
    if (this.is('{')) return { k: 'block', body: this.block(), span: this.span(start) };
    // Assignment, parallel assignment, or an expression statement (a call).
    const first = this.expr();
    if (this.is(',')) {
      const targets = [first];
      while (this.eat(',')) targets.push(this.expr());
      this.expect('=');
      const values = [this.expr()];
      while (this.eat(',')) values.push(this.expr());
      return { k: 'multi', targets, values, declare: false, mutable: true, span: this.span(start) };
    }
    for (const op of ['=', '+=', '-=', '*='] as const) {
      if (this.eat(op)) {
        const value = this.expr();
        return { k: 'assign', target: first, op, value, span: this.span(start) };
      }
    }
    return { k: 'expr', expr: first, span: this.span(start) };
  }

  ifStmt(): A.Stmt & { k: 'if' } {
    const start = this.expect('if').span.start;
    const cond = this.withNoStruct(() => this.expr());
    this.skipNewlinesBefore('{');
    const then = this.block();
    let els: A.Block | (A.Stmt & { k: 'if' }) | undefined;
    if (this.eat('else')) {
      els = this.is('if') ? this.ifStmt() : this.block();
    }
    return { k: 'if', cond, then, else: els, span: this.span(start) };
  }

  pattern(): A.Pattern {
    const t = this.peek();
    const start = t.span.start;
    if (t.kind === 'ident' && t.value === '_') {
      this.next();
      return { k: 'wild', span: t.span };
    }
    if (t.kind === 'ident') {
      this.next();
      const binds: A.Ident[] = [];
      if (this.eat('(')) {
        while (!this.is(')')) {
          binds.push(this.ident('a name to bind'));
          if (!this.eat(',')) break;
        }
        this.expect(')');
      }
      return { k: 'variant', name: t.value, binds, span: this.span(start) };
    }
    return { k: 'lit', value: this.unary(), span: this.span(start) };
  }

  // ── Expressions ──
  expr(): A.Expr {
    return this.iff();
  }

  private bin(op: A.BinOp, left: A.Expr, right: A.Expr): A.Expr {
    return { k: 'binary', op, left, right, span: { start: left.span.start, end: right.span.end } };
  }

  iff(): A.Expr {
    let left = this.implies();
    while (this.is('<==>')) {
      this.next();
      left = this.bin('<==>', left, this.implies());
    }
    return left;
  }

  implies(): A.Expr {
    const left = this.temporal();
    if (this.is('==>')) {
      this.next();
      return this.bin('==>', left, this.implies());
    }
    if (this.is('<==')) {
      let l = left;
      while (this.eat('<==')) l = this.bin('<==', l, this.temporal());
      return l;
    }
    return left;
  }

  temporal(): A.Expr {
    let left = this.or();
    while (this.is('until') || this.is('~>')) {
      const op = this.next().value as 'until' | '~>';
      left = this.bin(op, left, this.or());
    }
    return left;
  }

  or(): A.Expr {
    let left = this.and();
    while (this.is('||')) {
      this.next();
      left = this.bin('||', left, this.and());
    }
    return left;
  }

  and(): A.Expr {
    let left = this.compare();
    while (this.is('&&') || this.is('**')) {
      const op = this.next().value as '&&' | '**';
      left = this.bin(op, left, this.compare());
    }
    return left;
  }

  compare(): A.Expr {
    const first = this.bitor();
    const t = this.peek();
    if ((t.kind === 'op' || t.kind === 'kw') && COMPARE.has(t.value)) {
      // Chains of < <= (or > >=): 0 <= i < n
      if (['<', '<=', '>', '>='].includes(t.value)) {
        const ops: ('<' | '<=' | '>' | '>=')[] = [];
        const args = [first];
        while (['<', '<=', '>', '>='].includes(this.peek().value) && this.peek().kind === 'op') {
          ops.push(this.next().value as '<');
          args.push(this.bitor());
        }
        if (ops.length === 1) return this.bin(ops[0]!, args[0]!, args[1]!);
        const up = ops.every((o) => o === '<' || o === '<=');
        const down = ops.every((o) => o === '>' || o === '>=');
        if (!up && !down) this.error({ start: first.span.start, end: args.at(-1)!.span.end }, 'parse/chain', 'A chain of comparisons must go one way: all < and <=, or all > and >=.');
        return { k: 'chain', ops, args, span: { start: first.span.start, end: args.at(-1)!.span.end } };
      }
      this.next();
      const right = this.bitor();
      return this.bin(t.value as A.BinOp, first, right);
    }
    return first;
  }

  bitor(): A.Expr {
    let left = this.bitxor();
    while (this.is('|') && !this.comprehensionBar) {
      this.next();
      left = this.bin('|', left, this.bitxor());
    }
    return left;
  }
  private comprehensionBar = false;

  bitxor(): A.Expr {
    let left = this.bitand();
    while (this.is('^')) {
      this.next();
      left = this.bin('^', left, this.bitand());
    }
    return left;
  }

  bitand(): A.Expr {
    let left = this.shift();
    while (this.is('&')) {
      this.next();
      left = this.bin('&', left, this.shift());
    }
    return left;
  }

  shift(): A.Expr {
    let left = this.additive();
    while (this.is('<<') || this.is('>>')) {
      const op = this.next().value as '<<' | '>>';
      left = this.bin(op, left, this.additive());
    }
    return left;
  }

  additive(): A.Expr {
    let left = this.multiplicative();
    while (this.is('+') || this.is('-') || this.is('++')) {
      const op = this.next().value as '+' | '-' | '++';
      left = this.bin(op, left, this.multiplicative());
    }
    return left;
  }

  multiplicative(): A.Expr {
    let left = this.castExpr();
    while (this.is('*') || this.is('/') || this.is('%')) {
      const op = this.next().value as '*' | '/' | '%';
      left = this.bin(op, left, this.castExpr());
    }
    return left;
  }

  castExpr(): A.Expr {
    let e = this.unary();
    while (this.is('as')) {
      this.next();
      const type = this.typeAtom();
      e = { k: 'cast', arg: e, type, span: { start: e.span.start, end: type.span.end } };
    }
    return e;
  }

  /** `^r`, `*r`, `~r` or `(e)`: the right operand of a join, with its prefix operators applied to a primary only. */
  relationalOperand(): A.Expr {
    const t = this.peek();
    const start = t.span.start;
    if (t.kind === 'op' && ['^', '~', '*'].includes(t.value)) {
      this.next();
      return { k: 'unary', op: t.value as A.UnOp, arg: this.relationalOperand(), span: this.span(start) };
    }
    return this.primary();
  }

  unary(): A.Expr {
    const t = this.peek();
    const start = t.span.start;
    // Relational closure (`^r`, `*r`): binds tighter than a following join, so `^parent.x` is `(^parent).x`.
    if (t.kind === 'op' && (t.value === '^' || t.value === '*')) {
      return this.postfix(this.relationalOperand());
    }
    if ((t.kind === 'op' && ['-', '!', '~', '#', '^', '*'].includes(t.value)) || (t.kind === 'kw' && ['always', 'eventually'].includes(t.value)) || (t.kind === 'kw' && t.value === 'next' && this.startsExpr(1))) {
      this.next();
      const arg = this.unary();
      // Fold negative literals so that -1 is a literal (and 0..-1 ranges print as written).
      if (t.value === '-' && arg.k === 'int') return { k: 'int', value: -arg.value, span: this.span(start) };
      return { k: 'unary', op: t.value as A.UnOp, arg, span: this.span(start) };
    }
    if (t.kind === 'kw' && ['some', 'no', 'one', 'lone'].includes(t.value) && this.startsExpr(1)) {
      this.next();
      const arg = this.unary();
      return { k: 'mult', m: t.value as 'some', arg, span: this.span(start) };
    }
    return this.postfix();
  }

  startsExpr(n: number): boolean {
    const t = this.peek(n);
    if (t.kind === 'ident' || t.kind === 'int') return true;
    if (t.kind === 'op') return ['(', '[', '{', '-', '!', '~', '#', '^'].includes(t.value);
    if (t.kind === 'kw') return ['true', 'false', 'null', 'old', 'forall', 'exists', 'if'].includes(t.value);
    return false;
  }

  postfix(first?: A.Expr): A.Expr {
    let e = first ?? this.primary();
    for (;;) {
      if (this.is('[')) {
        this.next();
        // Slices and updates.
        if (this.is('..')) {
          this.next();
          const hi = this.is(']') ? undefined : this.expr();
          this.expect(']');
          e = { k: 'slice', target: e, hi, span: this.span(e.span.start) };
          continue;
        }
        const first = this.expr();
        if (this.eat(':=')) {
          const value = this.expr();
          this.expect(']');
          e = { k: 'update', target: e, index: first, value, span: this.span(e.span.start) };
          continue;
        }
        if (this.eat('..')) {
          const hi = this.is(']') ? undefined : this.expr();
          this.expect(']');
          e = { k: 'slice', target: e, lo: first, hi, span: this.span(e.span.start) };
          continue;
        }
        const indices = [first];
        while (this.eat(',')) indices.push(this.expr());
        this.expect(']');
        e = { k: 'index', target: e, indices, span: this.span(e.span.start) };
        continue;
      }
      if (this.is('.')) {
        // `.name` is a field (or a relational join, decided by types); `.^r`, `.~r`, `.(e)` are joins.
        if (this.peek(1).kind === 'ident' || (this.peek(1).kind === 'kw' && ['set', 'count', 'next'].includes(this.peek(1).value))) {
          this.next();
          const n = this.next();
          e = { k: 'field', target: e, name: n.value, nameSpan: n.span, span: this.span(e.span.start) };
          continue;
        }
        if (this.is('^', 1) || this.is('~', 1) || this.is('*', 1) || this.is('(', 1)) {
          this.next();
          // Closure and transpose bind tighter than join: `u.has.*inherits.grants` is `((u.has).(*inherits)).grants`.
          e = this.bin('.', e, this.relationalOperand());
          continue;
        }
        break;
      }
      // `P(i) at label`: where a process is.
      if (this.is('at') && e.k === 'call') {
        this.next();
        const label = this.ident('a label');
        e = { k: 'at', proc: e, label: label.name, labelSpan: label.span, span: { start: e.span.start, end: label.span.end } };
        continue;
      }
      break;
    }
    return e;
  }

  primary(): A.Expr {
    const t = this.peek();
    const start = t.span.start;
    if (t.kind === 'int') {
      this.next();
      return { k: 'int', value: t.int!, span: t.span };
    }
    if (t.kind === 'kw') {
      switch (t.value) {
        case 'true':
        case 'false':
          this.next();
          return { k: 'bool', value: t.value === 'true', span: t.span };
        case 'null':
          this.next();
          return { k: 'null', span: t.span };
        case 'emp':
          this.next();
          return { k: 'emp', span: t.span };
        case 'old': {
          this.next();
          this.expect('(');
          const arg = this.expr();
          this.expect(')');
          return { k: 'old', arg, span: this.span(start) };
        }
        case 'forall':
        case 'exists':
          return this.quantifier();
        case 'if': {
          this.next();
          const cond = this.withNoStruct(() => this.expr());
          const then = this.braced();
          this.skipNewlinesBefore('else');
          this.expect('else', '“else” (an if expression needs both branches)');
          const els = this.is('if') ? this.primary() : this.braced();
          return { k: 'if', cond, then, else: els, span: this.span(start) };
        }
        case 'match': {
          this.next();
          const scrutinee = this.withNoStruct(() => this.expr());
          this.expect('{');
          const arms: { pattern: A.Pattern; body: A.Expr; span: Span }[] = [];
          this.skipNewlines();
          while (!this.is('}') && this.peek().kind !== 'eof') {
            const as = this.peek().span.start;
            const pattern = this.pattern();
            this.expect('=>');
            const body = this.is('{') ? this.braced() : this.expr();
            arms.push({ pattern, body, span: this.span(as) });
            this.eat(',');
            this.skipNewlines();
          }
          this.expect('}');
          return { k: 'match', scrutinee, arms, span: this.span(start) };
        }
        case 'new': {
          this.next();
          const cls = this.ident('a class name');
          const fields = this.is('{') ? this.fieldInits() : [];
          return { k: 'new', cls: cls.name, fields, span: this.span(start) };
        }
        case 'set': // `set(a)` as a function
        case 'count':
        case 'next':
          break;
      }
    }
    // Soft keywords are names where they cannot be anything else (an enumeration value called `no`, a function `count`).
    if (t.kind === 'ident' || (t.kind === 'kw' && ['set', 'count', 'some', 'no', 'one', 'lone', 'next', 'run', 'check', 'fact', 'rel', 'solve', 'instance', 'init', 'weak', 'strong', 'via', 'where'].includes(t.value))) {
      this.next();
      if (this.is('(')) {
        this.next();
        const args: A.Expr[] = [];
        const inout: boolean[] = [];
        this.skipNewlines();
        while (!this.is(')') && this.peek().kind !== 'eof') {
          inout.push(!!this.eat('inout'));
          args.push(this.expr());
          this.skipNewlines();
          if (!this.eat(',')) break;
          this.skipNewlines();
        }
        this.expect(')');
        return { k: 'call', callee: t.value, calleeSpan: t.span, args, inout, span: this.span(start) };
      }
      // Struct literal: Name { field: value, … } (not in an if/while condition).
      if (!this.noStruct && this.is('{') && /^[A-Z]/.test(t.value) && ((this.isIdent(1) && this.is(':', 2)) || this.is('}', 1))) {
        return { k: 'struct', name: t.value, fields: this.fieldInits(), span: this.span(start) };
      }
      return { k: 'var', name: t.value, span: t.span };
    }
    if (t.kind === 'op') {
      if (t.value === '(') {
        this.next();
        this.skipNewlines();
        const saved = this.noStruct;
        this.noStruct = false;
        const first = this.expr();
        const elems = [first];
        while (this.eat(',')) elems.push(this.expr());
        this.noStruct = saved;
        this.skipNewlines();
        this.expect(')');
        if (elems.length > 1) return { k: 'tuple', elems, span: this.span(start) };
        // Keep the parentheses' span so diagnostics and hovers cover them.
        return { ...first, span: this.span(start) };
      }
      if (t.value === '[') {
        this.next();
        const elems: A.Expr[] = [];
        this.skipNewlines();
        // Sequence comprehension: [f(k) | k in lo..hi]
        if (!this.is(']') && this.hasBarAhead()) {
          this.comprehensionBar = true;
          let value: A.Expr;
          try {
            value = this.expr();
          } finally {
            this.comprehensionBar = false;
          }
          this.expect('|');
          const binders = this.binders();
          this.expect(']');
          return { k: 'comprehension', binders, body: { k: 'bool', value: true, span: value.span }, value, seq: true, span: this.span(start) };
        }
        while (!this.is(']') && this.peek().kind !== 'eof') {
          elems.push(this.expr());
          this.skipNewlines();
          if (!this.eat(',')) break;
          this.skipNewlines();
        }
        this.expect(']');
        return { k: 'seqlit', elems, span: this.span(start) };
      }
      if (t.value === '{') {
        this.next();
        this.skipNewlines();
        // Set comprehension: { x: T | p } or { x in S | p }
        if (this.isIdent() && (this.is(':', 1) || this.is('in', 1)) && this.hasBarAhead()) {
          const binders = this.binders();
          this.expect('|');
          const body = this.expr();
          this.skipNewlines();
          this.expect('}');
          return { k: 'comprehension', binders, body, span: this.span(start) };
        }
        const elems: A.Expr[] = [];
        while (!this.is('}') && this.peek().kind !== 'eof') {
          elems.push(this.expr());
          this.skipNewlines();
          if (!this.eat(',')) break;
          this.skipNewlines();
        }
        this.expect('}');
        return { k: 'setlit', elems, multi: false, span: this.span(start) };
      }
    }
    this.error(t.span, 'parse/expr', `Expected an expression but found ${describe(t)}.`);
    throw new ParseError();
  }

  /** Is there a `|` before the closing brace of the current `{ … }`? */
  hasBarAhead(): boolean {
    let depth = 0;
    for (let n = 0; ; n++) {
      const t = this.peek(n);
      if (t.kind === 'eof') return false;
      if (t.kind === 'op' && ['(', '[', '{'].includes(t.value)) depth++;
      if (t.kind === 'op' && [')', ']', '}'].includes(t.value)) {
        if (depth === 0) return false;
        depth--;
      }
      if (depth === 0 && t.kind === 'op' && t.value === '|') return true;
    }
  }

  fieldInits(): { name: string; value: A.Expr; span: Span }[] {
    this.expect('{');
    const out: { name: string; value: A.Expr; span: Span }[] = [];
    this.skipNewlines();
    while (!this.is('}') && this.peek().kind !== 'eof') {
      const s = this.peek().span.start;
      const n = this.ident('a field name');
      this.expect(':');
      out.push({ name: n.name, value: this.expr(), span: this.span(s) });
      this.skipNewlines();
      if (!this.eat(',')) break;
      this.skipNewlines();
    }
    this.expect('}');
    return out;
  }

  /** `{ let x = e … ; result }`: the body of a pure function, an if-expression branch or a match arm. */
  braced(): A.Expr {
    return this.exprBlock();
  }

  exprBlock(): A.Expr {
    const start = this.expect('{').span.start;
    this.skipNewlines();
    const lets: { name: string; type?: A.TypeExpr; value: A.Expr; span: Span }[] = [];
    while (this.is('let')) {
      const ls = this.next().span.start;
      const n = this.ident('a name');
      const type = this.eat(':') ? this.type() : undefined;
      this.expect('=');
      lets.push({ name: n.name, type, value: this.expr(), span: this.span(ls) });
      this.skipNewlines();
    }
    const saved = this.noStruct;
    this.noStruct = false;
    const body = this.expr();
    this.noStruct = saved;
    this.skipNewlines();
    this.expect('}');
    if (!lets.length) return { ...body, span: body.span };
    return { k: 'block', lets, body, span: this.span(start) };
  }

  binders(): A.Binder[] {
    const out: A.Binder[] = [];
    for (;;) {
      const group: A.Ident[] = [this.ident('a bound variable')];
      while (this.is(',') && this.isIdent(1) && (this.is(',', 2) || this.is(':', 2) || this.is('in', 2) || this.is('::', 2) || this.is('{', 2) || this.is('|', 2))) {
        this.next();
        group.push(this.ident());
      }
      let type: A.TypeExpr | undefined;
      let range: A.Binder['range'];
      if (this.eat(':')) type = this.type();
      else if (this.eat('in')) {
        const lo = this.withNoStruct(() => {
          this.comprehensionBar = true;
          try {
            return this.bitor();
          } finally {
            this.comprehensionBar = false;
          }
        });
        if (this.is('..') || this.is('..=')) {
          const inclusive = this.next().value === '..=';
          const hi = this.withNoStruct(() => this.additive());
          range = { lo, hi, inclusive };
        } else range = { set: lo };
      }
      for (const g of group) out.push({ name: g.name, type, range, span: g.span });
      if (this.is(',') && this.isIdent(1)) {
        this.next();
        continue;
      }
      break;
    }
    return out;
  }

  quantifier(): A.Expr {
    const t = this.next();
    const start = t.span.start;
    const binders = this.binders();
    const triggers: A.Expr[][] = [];
    while (this.is('{')) {
      this.next();
      const trig = [this.expr()];
      while (this.eat(',')) trig.push(this.expr());
      this.expect('}');
      triggers.push(trig);
    }
    this.expect('::', '“::” before the body of the quantifier');
    this.skipNewlines();
    const body = this.expr();
    return { k: 'quant', q: t.value as 'forall' | 'exists', binders, triggers, body, span: { start, end: body.span.end } };
  }
}

function describe(t: Token): string {
  if (t.kind === 'eof') return 'the end of the file';
  if (t.kind === 'newline') return 'the end of the line';
  if (t.kind === 'int') return `the number ${t.value}`;
  if (t.kind === 'ident') return `the name “${t.value}”`;
  if (t.kind === 'kw') return `the keyword “${t.value}”`;
  return `“${t.value}”`;
}
