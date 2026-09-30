/**
 * The DCL parser: tokens → AST, with error recovery. A syntax error is reported, the parser skips to the
 * end of the statement (a significant newline, `;`, or the `}` closing the enclosing block) and carries on,
 * so one call reports every independent error.
 */
import type {
  BinaryOp, Expr, GenericParam, Ident, Item, MatchArm, ModuleDecl, ModuleItem, NamedArg, Port, Program,
  TestStmt, TypeExpr, UnaryOp, FnDecl, StructDecl, EnumDecl,
} from './ast';
import type { Diagnostic } from './diagnostics';
import { lex, type Comment, type LexResult, type Token } from './lexer';
import { joinSpans, type SourceFile, type Span } from './span';

export interface ParseResult {
  program: Program;
  diagnostics: Diagnostic[];
  comments: Comment[];
  tokens: Token[];
  source: SourceFile;
}

class ParseError extends Error {}

/** Binary operator precedence, loosest = 1 (Rust's order, HDL.md *Expressions*). */
const PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3,
  '|': 4,
  '^': 5,
  '&': 6,
  '<<': 7, '>>': 7,
  '+': 8, '-': 8,
  '*': 9,
};
export const COMPARISON_PREC = 3;
/** Generic arguments and `<…>` in types are parsed above the comparisons, so `>` closes them. */
const GENERIC_ARG_PREC = 4;
/** Match patterns are parsed above `|`, which separates alternatives. */
const PATTERN_PREC = 5;

function describe(t: Token): string {
  switch (t.kind) {
    case 'newline':
      return 'end of line';
    case 'eof':
      return 'end of file';
    case 'ident':
      return `\`${t.text}\``;
    case 'keyword':
      return `keyword \`${t.text}\``;
    case 'number':
      return `number \`${t.text}\``;
    case 'string':
      return 'a string';
    default:
      return `\`${t.text}\``;
  }
}

class Parser {
  private pos = 0;
  private lastEnd = 0;
  readonly diags: Diagnostic[];
  private docs = new Map<number, string>();

  constructor(
    private toks: Token[],
    private lexed: LexResult,
  ) {
    this.diags = [...lexed.diagnostics];
    // Doc comments immediately before a token document the item or port starting there.
    let ci = 0;
    const comments = lexed.comments;
    let prevEnd = -1;
    for (const t of toks) {
      if (t.kind === 'newline') continue;
      let doc: string[] = [];
      while (ci < comments.length && comments[ci]!.span.start < t.span.start) {
        const c = comments[ci]!;
        if (c.span.start > prevEnd) {
          if (c.kind === 'doc') doc.push(c.text.replace(/^\/\/\/ ?/, ''));
          else doc = [];
        }
        ci++;
      }
      if (doc.length) this.docs.set(t.span.start, doc.join('\n'));
      prevEnd = t.span.end;
    }
  }

  // ----------------------------------------------------------------------------------- token helpers

  private get src(): SourceFile {
    return this.lexed.source;
  }
  peek(k = 0): Token {
    return this.toks[Math.min(this.pos + k, this.toks.length - 1)]!;
  }
  /** The next token that is not a newline. */
  peekSkipNl(): Token {
    let i = this.pos;
    while (this.toks[i]!.kind === 'newline') i++;
    return this.toks[i]!;
  }
  next(): Token {
    const t = this.toks[this.pos]!;
    if (this.pos < this.toks.length - 1) this.pos++;
    if (t.kind !== 'newline') this.lastEnd = t.span.end;
    return t;
  }
  at(text: string): boolean {
    const t = this.peek();
    return (t.kind === 'op' || t.kind === 'keyword') && t.text === text;
  }
  eat(text: string): Token | undefined {
    return this.at(text) ? this.next() : undefined;
  }
  skipNewlines(): void {
    while (this.peek().kind === 'newline' || this.at(';')) this.next();
  }
  span(start: number): Span {
    return this.src.span(start, Math.max(start, this.lastEnd));
  }
  error(message: string, span: Span, label?: string, help?: string): void {
    this.diags.push({ severity: 'error', code: 'syntax', message, span, label, help: help ? [help] : undefined });
  }
  fail(message: string, span: Span, label?: string, help?: string): never {
    this.error(message, span, label, help);
    throw new ParseError(message);
  }
  expect(text: string, context?: string): Token {
    const t = this.peek();
    if ((t.kind === 'op' || t.kind === 'keyword') && t.text === text) return this.next();
    // A newline where a token was expected: point just after the previous token.
    const span = t.kind === 'newline' ? t.span : t.span;
    this.fail(`expected \`${text}\`${context ? ' ' + context : ''}, found ${describe(t)}`, span, `expected \`${text}\``);
  }
  ident(what = 'a name'): Ident {
    const t = this.peek();
    if (t.kind !== 'ident') this.fail(`expected ${what}, found ${describe(t)}`, t.span, `expected ${what}`);
    this.next();
    return { name: t.text, span: t.span };
  }
  /** Consumes `>` closing generic arguments, splitting `>>` and `>=` when needed. */
  closeAngle(): void {
    const t = this.peek();
    if (t.kind === 'op' && (t.text === '>>' || t.text === '>=')) {
      const rest = t.text.slice(1);
      this.toks[this.pos] = { ...t, text: rest, span: this.src.span(t.span.start + 1, t.span.end) };
      this.lastEnd = t.span.start + 1;
      return;
    }
    this.expect('>', 'to close the generic arguments');
  }
  docAt(t: Token): string | undefined {
    return this.docs.get(t.span.start);
  }

  /** After a statement: a newline, `;`, or the end of the enclosing block. */
  endStatement(): void {
    const t = this.peek();
    if (t.kind === 'newline' || (t.kind === 'op' && t.text === ';')) {
      this.skipNewlines();
      return;
    }
    if (t.kind === 'eof' || (t.kind === 'op' && t.text === '}') || t.lineStart) return;
    this.fail(`expected the end of the statement, found ${describe(t)}`, t.span, 'expected a new line or `;` before this', 'put each statement on its own line, or separate them with `;`');
  }

  /**
   * Skips to the start of the next statement: after a newline or `;` at bracket depth 0, before a `}` that
   * closes the enclosing block, or before a keyword that starts an item on a new line.
   */
  synchronize(keepNewline = false): void {
    let depth = 0;
    const start = this.pos;
    while (true) {
      const t = this.peek();
      if (t.kind === 'eof') return;
      if ((this.pos > start || keepNewline) && t.lineStart && depth <= 0 && t.kind === 'keyword' && ITEM_KEYWORDS.has(t.text)) return;
      if (t.kind === 'op') {
        if (t.text === '{' || t.text === '(' || t.text === '[') depth++;
        else if (t.text === '}' || t.text === ')' || t.text === ']') {
          if (depth <= 0 && t.text === '}') return;
          depth--;
        } else if (t.text === ';' && depth <= 0) {
          if (!keepNewline) this.skipNewlines();
          return;
        }
      }
      if (t.kind === 'newline' && depth <= 0) {
        if (!keepNewline) this.skipNewlines();
        return;
      }
      this.next();
    }
  }

  // ------------------------------------------------------------------------------------------ program

  program(): Program {
    const items: Item[] = [];
    this.skipNewlines();
    while (this.peek().kind !== 'eof') {
      const before = this.pos;
      try {
        const item = this.item();
        if (item) items.push(item);
        this.endStatement();
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        this.synchronize();
        if (this.at('}')) this.next();
      }
      if (this.pos === before) this.next();
      this.skipNewlines();
    }
    return { file: this.src.name, items, span: this.src.span(0, this.src.text.length) };
  }

  item(): Item | undefined {
    const first = this.peek();
    const doc = this.docAt(first);
    const start = first.span.start;
    if (this.at('top') || this.at('module')) return this.moduleDecl(doc);
    if (this.at('fn')) return this.fnDecl(doc);
    if (this.at('struct')) return this.structDecl(doc);
    if (this.at('enum') || this.at('@')) return this.enumDecl(doc);
    if (this.at('type')) {
      this.next();
      const name = this.ident('a type name');
      this.expect('=');
      const type = this.type();
      return { kind: 'type', name, type, doc, span: this.span(start) };
    }
    if (this.at('const')) {
      this.next();
      const name = this.ident('a constant name');
      const type = this.eat(':') ? this.type() : undefined;
      this.expect('=');
      const value = this.expr();
      return { kind: 'const', name, type, value, doc, span: this.span(start) };
    }
    if (this.at('test')) return this.testDecl();
    if (this.peek().kind === 'ident' && ['let', 'reg', 'next', 'inst', 'mem'].includes(this.peek(0).text) === false) {
      // Fall through to the error below.
    }
    this.fail(
      `expected an item (\`module\`, \`fn\`, \`struct\`, \`enum\`, \`type\`, \`const\` or \`test\`), found ${describe(first)}`,
      first.span,
      'not allowed at the top level',
      ['let', 'reg', 'next', 'inst', 'mem', 'for'].includes(first.text) ? `\`${first.text}\` belongs inside a module body` : undefined,
    );
  }

  generics(): GenericParam[] {
    const out: GenericParam[] = [];
    if (!this.eat('<')) return out;
    while (!this.at('>')) {
      const start = this.peek().span.start;
      const name = this.ident('a generic parameter');
      this.expect(':', 'after the generic parameter name');
      const type = this.type();
      out.push({ name, type, span: this.span(start) });
      if (!this.eat(',')) break;
    }
    this.closeAngle();
    return out;
  }

  ports(what: string): { ports: Port[]; multiline: boolean; close: number } {
    this.expect('(', what);
    const multiline = this.peek().lineStart;
    const ports: Port[] = [];
    while (!this.at(')')) {
      const t = this.peek();
      const start = t.span.start;
      const name = this.ident('a port name');
      this.expect(':', 'after the port name');
      const type = this.type();
      ports.push({ name, type, doc: this.docAt(t), span: this.span(start) });
      if (!this.eat(',')) break;
    }
    if (!this.at(')')) this.fail(`expected \`,\` or \`)\` in the port list, found ${describe(this.peek())}`, this.peek().span, undefined);
    const close = this.next().span.start;
    return { ports, multiline, close };
  }

  moduleDecl(doc: string | undefined): ModuleDecl {
    const start = this.peek().span.start;
    const top = !!this.eat('top');
    this.expect('module');
    const name = this.ident('a module name');
    let generics: GenericParam[] = [];
    let inputs = { ports: [] as Port[], multiline: false, close: 0 };
    let outputs = { ports: [] as Port[], multiline: false, close: 0 };
    let hasOutputs = false;
    let headerError = false;
    try {
      generics = this.generics();
      inputs = this.ports('to start the input ports');
      if (this.eat('->')) {
        hasOutputs = true;
        outputs = this.ports('to start the output ports');
      }
      this.expect('{', 'to start the module body');
    } catch (e) {
      // Recover at the body's `{`, so that the errors inside the body are reported too.
      if (!(e instanceof ParseError)) throw e;
      headerError = true;
      while (!this.at('{')) {
        const t = this.peek();
        if (t.kind === 'eof' || (t.lineStart && t.kind === 'keyword' && TOP_KEYWORDS.has(t.text))) throw e;
        this.next();
      }
      this.next();
    }
    const body = this.moduleItems();
    const bodyEnd = this.peek().span.start;
    this.expect('}', 'to close the module body');
    return {
      kind: 'module', top, name, generics, inputs: inputs.ports, outputs: outputs.ports, hasOutputs, body, doc,
      span: this.span(start), inputsMultiline: inputs.multiline, outputsMultiline: outputs.multiline, bodyEnd,
      inputsEnd: inputs.close, outputsEnd: outputs.close,
      ...(headerError ? { headerError } : {}),
    };
  }

  fnDecl(doc: string | undefined): FnDecl {
    const start = this.next().span.start;
    const name = this.ident('a function name');
    const generics = this.generics();
    const params = this.ports('to start the parameters');
    this.expect('->', 'before the return type');
    const ret = this.type();
    this.expect('{', 'to start the function body');
    const bodyMultiline = this.peek().lineStart;
    const body = this.expr();
    this.skipNewlines();
    this.expect('}', 'to close the function body');
    return {
      kind: 'fn', name, generics, params: params.ports, ret, body, doc, span: this.span(start), paramsMultiline: params.multiline,
      paramsEnd: params.close, bodyMultiline,
    };
  }

  structDecl(doc: string | undefined): StructDecl {
    const start = this.next().span.start;
    const name = this.ident('a struct name');
    this.expect('{');
    const multiline = this.peek().lineStart;
    const fields: Port[] = [];
    this.skipNewlines();
    while (!this.at('}')) {
      const t = this.peek();
      const name = this.ident('a field name');
      this.expect(':', 'after the field name');
      const type = this.type();
      fields.push({ name, type, doc: this.docAt(t), span: this.span(t.span.start) });
      const comma = this.eat(',');
      const nl = this.peek().kind === 'newline';
      this.skipNewlines();
      if (!comma && !nl) break;
    }
    this.expect('}', 'to close the struct');
    return { kind: 'struct', name, fields, doc, span: this.span(start), multiline };
  }

  enumDecl(doc: string | undefined): EnumDecl {
    const start = this.peek().span.start;
    let encoding: EnumDecl['encoding'] = 'binary';
    let attrSpan: Span | undefined;
    if (this.eat('@')) {
      const attr = this.ident('an attribute');
      attrSpan = joinSpans(this.src.span(start, start + 1), attr.span);
      if (attr.name === 'onehot' || attr.name === 'gray' || attr.name === 'binary') encoding = attr.name;
      else this.error(`unknown attribute \`@${attr.name}\``, attr.span, 'expected `@onehot`, `@gray` or `@binary`');
      this.skipNewlines();
    }
    this.expect('enum');
    const name = this.ident('an enum name');
    this.expect('{');
    const multiline = this.peek().lineStart;
    const variants: Ident[] = [];
    this.skipNewlines();
    while (!this.at('}')) {
      variants.push(this.ident('a variant name'));
      const comma = this.eat(',');
      const nl = this.peek().kind === 'newline';
      this.skipNewlines();
      if (!comma && !nl) break;
    }
    this.expect('}', 'to close the enum');
    return { kind: 'enum', name, variants, encoding, attrSpan, doc, span: this.span(start), multiline };
  }

  testDecl(): Item {
    const start = this.next().span.start;
    const t = this.peek();
    if (t.kind !== 'string') this.fail(`expected the test's name as a string, found ${describe(t)}`, t.span, 'expected `"…"`');
    this.next();
    this.expect('{', 'to start the test body');
    const body = this.block(() => this.testStmt());
    this.expect('}', 'to close the test');
    return { kind: 'test', name: t.str ?? '', nameSpan: t.span, body, span: this.span(start) };
  }

  /** Statements until the closing `}` (not consumed), with recovery. */
  block<T>(parse: () => T | undefined): T[] {
    const out: T[] = [];
    this.skipNewlines();
    while (!this.at('}') && this.peek().kind !== 'eof') {
      const before = this.pos;
      try {
        const s = parse();
        if (s) out.push(s);
        this.endStatement();
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        this.synchronize();
        // A top-level keyword means the block's `}` is missing: stop here.
        const t = this.peek();
        if (t.kind === 'keyword' && TOP_KEYWORDS.has(t.text) && t.lineStart) break;
      }
      if (this.pos === before) this.next();
      this.skipNewlines();
    }
    return out;
  }

  moduleItems(): ModuleItem[] {
    return this.block(() => this.moduleItem());
  }

  moduleItem(): ModuleItem {
    const t = this.peek();
    const start = t.span.start;
    const doc = this.docAt(t);
    if (t.kind === 'keyword') {
      switch (t.text) {
        case 'let': {
          this.next();
          const name = this.ident();
          const type = this.eat(':') ? this.type() : undefined;
          this.expect('=', 'in `let`');
          const value = this.valueExpr();
          return { kind: 'let', name, type, value, doc, span: this.span(start) };
        }
        case 'const': {
          this.next();
          const name = this.ident('a constant name');
          const type = this.eat(':') ? this.type() : undefined;
          this.expect('=', 'in `const`');
          const value = this.valueExpr();
          return { kind: 'const', name, type, value, doc, span: this.span(start) };
        }
        case 'reg': {
          this.next();
          const name = this.ident('a register name');
          if (!this.at(':')) this.fail('a register needs a type', this.peek().span, 'expected `:` and a type', `write \`reg ${name.name}: bits<N> = 0\``);
          this.next();
          const type = this.type();
          if (!this.at('=')) this.fail('a register needs an initial value', this.peek().span, 'expected `=` and the power-up value', `write \`reg ${name.name}: … = 0\``);
          this.next();
          const init = this.valueExpr();
          const clock = this.eat('on') ? this.ident('a clock name') : undefined;
          return { kind: 'reg', name, type, init, clock, doc, span: this.span(start) };
        }
        case 'mem': {
          this.next();
          const name = this.ident('a memory name');
          this.expect(':', 'after the memory name');
          const type = this.type();
          const init = this.eat('=') ? this.expr() : undefined;
          const clock = this.eat('on') ? this.ident('a clock name') : undefined;
          return { kind: 'mem', name, type, init, clock, doc, span: this.span(start) };
        }
        case 'next': {
          this.next();
          const name = this.ident('a register name');
          let index: Expr | undefined;
          if (this.eat('[')) {
            index = this.expr();
            this.expect(']');
          }
          const target = { name, index, span: this.span(name.span.start) };
          this.expect('=', 'after the register');
          const value = this.valueExpr();
          return { kind: 'next', target, value, span: this.span(start) };
        }
        case 'inst': {
          this.next();
          const name = this.ident('an instance name');
          this.expect(':', 'after the instance name');
          const module = this.ident('a module name');
          const generics = this.genericArgs();
          const { args, multiline } = this.namedArgs('the port connections');
          return { kind: 'inst', name, module, generics, args, doc, span: this.span(start), multiline };
        }
        case 'for': {
          this.next();
          const v = this.ident('a loop variable');
          this.expect('in');
          const from = this.expr(GENERIC_ARG_PREC - 1, false);
          this.expect('..', 'in the range');
          const to = this.expr(0, false);
          this.expect('{', 'to start the loop body');
          const body = this.moduleItems();
          this.expect('}', 'to close the loop');
          return { kind: 'for', var: v, from, to, body, span: this.span(start) };
        }
      }
    }
    if (t.kind === 'ident') {
      if (this.peek(1).kind === 'op' && this.peek(1).text === '.' && this.peek(2).text === 'write') {
        const mem = this.ident();
        this.next();
        this.next();
        this.expect('(');
        const args = this.exprList(')');
        return { kind: 'write', mem, args, span: this.span(start) };
      }
      const target = this.ident();
      if (this.at('=')) {
        this.next();
        const value = this.valueExpr();
        return { kind: 'assign', target, value, span: this.span(start) };
      }
      this.fail(`expected \`=\` after \`${target.name}\`, found ${describe(this.peek())}`, this.peek().span, 'expected `=`', 'a statement starts with a keyword (`let`, `reg`, `next`, …) or with the name of an output being assigned');
    }
    this.fail(
      `expected a statement, found ${describe(t)}`,
      t.span,
      'a statement cannot start here',
      t.kind === 'op' ? 'a line starting with an operator continues the previous line; check the line above' : 'a statement starts with a keyword (`let`, `reg`, `next`, `inst`, …) or with the name of an output being assigned',
    );
  }

  testStmt(): TestStmt {
    const t = this.peek();
    const start = t.span.start;
    if (t.kind === 'keyword') {
      switch (t.text) {
        case 'let': {
          this.next();
          const name = this.ident();
          const type = this.eat(':') ? this.type() : undefined;
          this.expect('=', 'in `let`');
          const value = this.expr();
          return { kind: 'let', name, type, value, span: this.span(start) };
        }
        case 'step': {
          this.next();
          let count: Expr | undefined;
          const n = this.peek();
          if (n.kind !== 'newline' && n.kind !== 'eof' && !this.at(';') && !this.at('}') && !this.at('on') && !n.lineStart) count = this.expr();
          const clock = this.eat('on') ? this.ident('a clock name') : undefined;
          return { kind: 'step', count, clock, span: this.span(start) };
        }
        case 'expect': {
          this.next();
          return { kind: 'expect', cond: this.expr(), span: this.span(start) };
        }
        case 'print': {
          this.next();
          const args: Expr[] = [this.expr()];
          while (this.eat(',')) args.push(this.expr());
          return { kind: 'print', args, span: this.span(start) };
        }
        case 'for': {
          this.next();
          const v = this.ident('a loop variable');
          this.expect('in');
          const from = this.expr(GENERIC_ARG_PREC - 1, false);
          this.expect('..', 'in the range');
          const to = this.expr(0, false);
          this.expect('{', 'to start the loop body');
          const body = this.block(() => this.testStmt());
          this.expect('}', 'to close the loop');
          return { kind: 'for', var: v, from, to, body, span: this.span(start) };
        }
      }
    }
    if (t.kind === 'ident') {
      const target = this.postfix(this.primary(true));
      this.expect('=', 'to assign a value');
      const value = this.expr();
      return { kind: 'set', target, value, span: this.span(start) };
    }
    this.fail(`expected a test statement, found ${describe(t)}`, t.span, 'a test statement cannot start here', 'test statements are `let`, `step`, `expect`, `print`, `for` and `x.port = value`');
  }

  // --------------------------------------------------------------------------------------------- types

  type(): TypeExpr {
    const t = this.peek();
    const start = t.span.start;
    if (this.eat('[')) {
      const elem = this.type();
      this.expect(';', 'in the array type `[T; N]`');
      const size = this.expr();
      this.expect(']', 'to close the array type');
      return { kind: 'array', elem, size, span: this.span(start) };
    }
    const name = this.ident('a type');
    const args = this.genericArgs();
    return { kind: 'named', name, args, span: this.span(start) };
  }

  genericArgs(): Expr[] {
    const args: Expr[] = [];
    if (!this.eat('<')) return args;
    while (!this.at('>') && !this.at('>>') && !this.at('>=')) {
      args.push(this.expr(GENERIC_ARG_PREC));
      if (!this.eat(',')) break;
    }
    this.closeAngle();
    return args;
  }

  namedArgs(what: string): { args: NamedArg[]; multiline: boolean } {
    this.expect('(', `to start ${what}`);
    const multiline = this.peek().lineStart;
    const args: NamedArg[] = [];
    while (!this.at(')')) {
      const start = this.peek().span.start;
      const name = this.ident('a port name');
      this.expect(':', `after the port name (connections are written \`${name.name}: value\`)`);
      const value = this.expr();
      args.push({ name, value, span: this.span(start) });
      if (!this.eat(',')) break;
    }
    this.expect(')', `to close ${what}`);
    return { args, multiline };
  }

  exprList(close: string): Expr[] {
    const out: Expr[] = [];
    while (!this.at(close)) {
      out.push(this.expr());
      if (!this.eat(',')) break;
    }
    this.expect(close);
    return out;
  }

  // --------------------------------------------------------------------------------------- expressions

  /**
   * The value of a statement. On a syntax error, it skips to the end of the statement and returns an
   * `error` expression, so the statement still exists and the checker does not report it missing.
   */
  valueExpr(): Expr {
    const start = this.peek().span.start;
    try {
      return this.expr();
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      this.synchronize(true);
      return { kind: 'error', span: this.src.span(start, Math.max(start, this.lastEnd)) };
    }
  }

  /** `minPrec`: the loosest operator allowed. `structs`: whether `Name {` is a struct literal here. */
  expr(minPrec = 0, structs = true): Expr {
    let left = this.unary(structs);
    while (true) {
      const t = this.peek();
      if (t.kind !== 'op') break;
      const prec = PRECEDENCE[t.text];
      if (prec === undefined || prec <= minPrec) break;
      this.next();
      const right = prec === COMPARISON_PREC ? this.expr(prec, structs) : this.expr(prec, structs);
      if (prec === COMPARISON_PREC) {
        const n = this.peek();
        if (n.kind === 'op' && PRECEDENCE[n.text] === COMPARISON_PREC) {
          this.error('comparisons cannot be chained', n.span, 'second comparison', 'use `&&`: `a < b && b < c`');
        }
      }
      left = { kind: 'binary', op: t.text as BinaryOp, left, right, opSpan: t.span, span: joinSpans(left.span, right.span) };
    }
    return left;
  }

  unary(structs: boolean): Expr {
    const t = this.peek();
    if (t.kind === 'op' && (t.text === '!' || t.text === '~' || t.text === '-')) {
      this.next();
      const operand = this.unary(structs);
      return { kind: 'unary', op: t.text as UnaryOp, operand, span: joinSpans(t.span, operand.span) };
    }
    return this.postfix(this.primary(structs));
  }

  postfix(e: Expr): Expr {
    while (true) {
      if (this.at('.')) {
        this.next();
        const field = this.ident('a field, port or method name');
        if (this.at('(')) {
          this.next();
          const multiline = this.peek().lineStart;
          const args = this.exprList(')');
          e = { kind: 'method', target: e, method: field, args, span: this.span(e.span.start), multiline };
        } else {
          e = { kind: 'field', target: e, field, span: this.span(e.span.start) };
        }
        continue;
      }
      if (this.at('[')) {
        this.next();
        const first = this.expr();
        if (this.eat(':')) {
          const lo = this.expr();
          this.expect(']', 'to close the slice');
          e = { kind: 'slice', target: e, hi: first, lo, span: this.span(e.span.start) };
        } else {
          this.expect(']', 'to close the index');
          e = { kind: 'index', target: e, index: first, span: this.span(e.span.start) };
        }
        continue;
      }
      return e;
    }
  }

  primary(structs: boolean): Expr {
    const t = this.peek();
    const start = t.span.start;
    switch (t.kind) {
      case 'number':
        this.next();
        return { kind: 'number', value: t.value ?? 0n, text: t.text, span: t.span };
      case 'string':
        this.next();
        return { kind: 'string', value: t.str ?? '', text: t.text, span: t.span };
      case 'ident': {
        // Typed literals and conversions: bits<N>(x), signed<N>(x); types as arguments: random(bits<8>).
        if ((t.text === 'bits' || t.text === 'signed') && this.peek(1).text === '<') {
          const type = this.type();
          if (this.eat('(')) {
            const arg = this.expr();
            this.expect(')');
            return { kind: 'typed', type, arg, span: this.span(start) };
          }
          return { kind: 'type', type, span: type.span };
        }
        this.next();
        const callee: Ident = { name: t.text, span: t.span };
        if (this.at('(')) {
          this.next();
          const multiline = this.peek().lineStart;
          const args = this.exprList(')');
          return { kind: 'call', callee, generics: [], args, span: this.span(start), multiline };
        }
        if (structs && this.at('{') && /^[A-Z]/.test(t.text) && !this.peek().lineStart) {
          this.next();
          const multiline = this.peek().lineStart;
          const fields: NamedArg[] = [];
          this.skipNewlines();
          while (!this.at('}')) {
            const fs = this.peek().span.start;
            const name = this.ident('a field name');
            this.expect(':', 'after the field name');
            const value = this.expr();
            fields.push({ name, value, span: this.span(fs) });
            const comma = this.eat(',');
            const nl = this.peek().kind === 'newline';
            this.skipNewlines();
            if (!comma && !nl) break;
          }
          this.expect('}', 'to close the struct literal');
          return { kind: 'struct', name: callee, fields, span: this.span(start), multiline };
        }
        return { kind: 'name', name: t.text, span: t.span };
      }
      case 'keyword':
        if (t.text === 'if') return this.ifExpr();
        if (t.text === 'match') return this.matchExpr();
        if (t.text === 'sim') {
          this.next();
          const module = this.ident('a module name');
          const generics = this.genericArgs();
          const { args, multiline } = this.namedArgs('the initial input values');
          return { kind: 'sim', module, generics, args, span: this.span(start), multiline };
        }
        break;
      case 'op':
        if (t.text === '(') {
          this.next();
          const inner = this.expr();
          this.expect(')', 'to close the parenthesis');
          return { kind: 'paren', inner, span: this.span(start) };
        }
        if (t.text === '{') {
          this.next();
          this.skipNewlines();
          const inner = this.expr();
          this.skipNewlines();
          this.expect('}', 'to close the block');
          return { kind: 'block', inner, span: this.span(start) };
        }
        if (t.text === '[') {
          this.next();
          const multiline = this.peek().lineStart;
          if (this.at(']')) {
            this.next();
            return { kind: 'array', elems: [], span: this.span(start), multiline };
          }
          const first = this.expr();
          if (this.eat(';')) {
            const count = this.expr();
            this.expect(']', 'to close the array');
            return { kind: 'repeat', value: first, count, span: this.span(start) };
          }
          const elems = [first];
          if (this.eat(',')) elems.push(...this.exprList(']'));
          else this.expect(']', 'to close the array');
          return { kind: 'array', elems, span: this.span(start), multiline };
        }
        break;
    }
    if (t.kind === 'newline' || t.kind === 'eof') {
      this.fail('expected an expression, found the end of the line', t.span, 'the expression is missing', 'a line break ends the statement; to continue on the next line, end this line with an operator');
    }
    this.fail(`expected an expression, found ${describe(t)}`, t.span, 'expected an expression');
  }

  /** The body of an `if` branch: `{ expr }`. */
  branch(): { expr: Expr; multiline: boolean } {
    this.expect('{', 'to start the branch');
    const multiline = this.peek().lineStart;
    this.skipNewlines();
    const expr = this.expr();
    this.skipNewlines();
    this.expect('}', 'to close the branch');
    return { expr, multiline };
  }

  ifExpr(): Expr {
    const start = this.next().span.start;
    const cond = this.expr(0, false);
    const then = this.branch();
    let multiline = then.multiline;
    if (!this.at('else')) {
      this.fail('`if` needs an `else`', this.src.span(start, start + 2), 'this `if` has no `else` branch', 'hardware always produces a value: add `else { … }` (to keep a register, write its current value)');
    }
    this.next();
    let elseExpr: Expr;
    if (this.at('if')) {
      elseExpr = this.ifExpr();
      if (elseExpr.kind === 'if' && elseExpr.multiline) multiline = true;
    } else {
      const b = this.branch();
      multiline ||= b.multiline;
      elseExpr = b.expr;
    }
    return { kind: 'if', cond, then: then.expr, else: elseExpr, span: this.span(start), multiline };
  }

  matchExpr(): Expr {
    const kw = this.next();
    const scrutinee = this.expr(0, false);
    this.expect('{', 'to start the match arms');
    const multiline = this.peek().lineStart;
    const arms: MatchArm[] = [];
    this.skipNewlines();
    while (!this.at('}') && this.peek().kind !== 'eof') {
      const start = this.peek().span.start;
      const patterns: Expr[] = [];
      let wildcard = false;
      do {
        this.skipNewlines();
        if (this.peek().kind === 'ident' && this.peek().text === '_') {
          this.next();
          wildcard = true;
        } else patterns.push(this.expr(PATTERN_PREC));
      } while (this.eat('|'));
      this.expect('=>', 'after the pattern');
      const body = this.expr();
      arms.push({ patterns, wildcard, body, span: this.span(start) });
      const comma = this.eat(',');
      const nl = this.peek().kind === 'newline';
      this.skipNewlines();
      if (!comma && !nl && !this.at('}')) {
        this.fail(`expected \`,\` or \`}\` after the match arm, found ${describe(this.peek())}`, this.peek().span, 'expected `,`');
      }
    }
    this.expect('}', 'to close the match');
    return { kind: 'match', scrutinee, arms, span: this.span(kw.span.start), keywordSpan: kw.span, multiline };
  }
}

const TOP_KEYWORDS = new Set(['module', 'top', 'fn', 'struct', 'enum', 'type', 'test']);
const ITEM_KEYWORDS = new Set([...TOP_KEYWORDS, 'let', 'reg', 'mem', 'next', 'inst', 'const', 'for', 'step', 'expect', 'print']);

/** Parses a DCL source text. */
export function parse(text: string, file = 'input.dcl'): ParseResult {
  const lexed = lex(text, file);
  const p = new Parser(lexed.tokens, lexed);
  const program = p.program();
  return { program, diagnostics: p.diags, comments: lexed.comments, tokens: lexed.tokens, source: lexed.source };
}
