/**
 * Shared machinery for the course's two assemblers (Octet and RV32I): diagnostics, a line tokenizer,
 * an expression parser and evaluator, and a symbol table whose constants (`.equ`) are evaluated
 * lazily, so they may refer to labels defined further down.
 *
 * Both assemblers are line based and two-pass:
 *
 * 1. **Pass 1** tokenizes and parses every line, checks operand shapes, assigns an address to every
 *    statement and defines the labels.
 * 2. **Pass 2** evaluates the operand expressions (now that every label is known) and emits bytes.
 *
 * Expressions are deliberately small: numbers, characters, symbols, `.` (the address of the current
 * statement), unary minus, `+`, `-` and parentheses, plus `%hi(…)` and `%lo(…)` where a dialect
 * allows them (RV32I).
 */

export type Severity = 'error' | 'warning';

/** A message about one place in the source. Lines and columns are 1-based. */
export interface Diagnostic {
  line: number;
  column: number;
  /** Number of characters the message refers to (at least 1). */
  length: number;
  message: string;
  severity: Severity;
}

/** Thrown inside the assemblers and turned into a {@link Diagnostic} for the current line. */
export class AsmError extends Error {
  constructor(
    message: string,
    readonly column: number,
    readonly length = 1,
  ) {
    super(message);
  }
}

export function errorAt(tok: Token, message: string): AsmError {
  return new AsmError(message, tok.column, Math.max(1, tok.length));
}

// ---------------------------------------------------------------------------------------------
// Tokens

export type TokenKind = 'ident' | 'number' | 'string' | 'punct' | 'eol';

export interface Token {
  kind: TokenKind;
  /** The source text (for strings: including the quotes). */
  text: string;
  /** Numbers and character literals: the value. */
  num?: number;
  /** Strings: the decoded characters as byte values. */
  bytes?: number[];
  /** 1-based column of the first character. */
  column: number;
  length: number;
}

export interface TokenizeOptions {
  /** Strings that start a comment running to the end of the line. */
  comments: string[];
}

const PUNCT = new Set([',', '[', ']', '(', ')', '+', '-', ':', '#', '=', '.']);

const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdentChar = (c: string) => /[A-Za-z0-9_.$]/.test(c);

/** Decode one escape sequence starting at `s[i]` (just after the backslash). */
function escape(s: string, i: number, column: number): { value: number; next: number } {
  const c = s[i];
  switch (c) {
    case 'n':
      return { value: 10, next: i + 1 };
    case 't':
      return { value: 9, next: i + 1 };
    case 'r':
      return { value: 13, next: i + 1 };
    case '0':
      return { value: 0, next: i + 1 };
    case 'e':
      return { value: 27, next: i + 1 };
    case '\\':
    case "'":
    case '"':
      return { value: c.charCodeAt(0), next: i + 1 };
    case 'x': {
      const m = /^[0-9A-Fa-f]{1,2}/.exec(s.slice(i + 1));
      if (!m) throw new AsmError('\\x must be followed by one or two hexadecimal digits', column + i - 1, 2);
      return { value: parseInt(m[0], 16), next: i + 1 + m[0].length };
    }
    default:
      throw new AsmError(`unknown escape sequence \\${c ?? ''}`, column + i - 1, 2);
  }
}

function charCode(ch: string, column: number): number {
  const code = ch.codePointAt(0)!;
  if (code > 255) throw new AsmError(`'${ch}' is not a single byte (only ASCII and Latin-1 characters fit)`, column, 1);
  return code;
}

/**
 * Split one source line into tokens. The returned list always ends with an `eol` token whose column
 * is just past the last non-comment character, so "expected …" errors can point there.
 */
export function tokenize(line: string, options: TokenizeOptions): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = line.length;
  outer: while (i < n) {
    const c = line[i]!;
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      continue;
    }
    for (const start of options.comments) if (line.startsWith(start, i)) break outer;
    const column = i + 1;
    // Numbers.
    if (/[0-9]/.test(c)) {
      const m = /^(0[xX][0-9A-Fa-f_]+|0[bB][01_]+|0[oO][0-7_]+|[0-9][0-9_]*)/.exec(line.slice(i))!;
      let text = m[0];
      const after = line[i + text.length];
      if (after !== undefined && /[A-Za-z0-9_]/.test(after)) {
        const bad = /^[A-Za-z0-9_]+/.exec(line.slice(i))![0];
        throw new AsmError(`'${bad}' is not a valid number`, column, bad.length);
      }
      const digits = text.replace(/_/g, '');
      let value: number;
      if (/^0[xX]/.test(digits)) value = parseInt(digits.slice(2), 16);
      else if (/^0[bB]/.test(digits)) value = parseInt(digits.slice(2), 2);
      else if (/^0[oO]/.test(digits)) value = parseInt(digits.slice(2), 8);
      else value = parseInt(digits, 10);
      if (Number.isNaN(value)) throw new AsmError(`'${text}' is not a valid number`, column, text.length);
      tokens.push({ kind: 'number', text, num: value, column, length: text.length });
      i += text.length;
      text = '';
      continue;
    }
    // Identifiers, directives (.org) and relocation functions (%hi).
    if (isIdentStart(c) || ((c === '.' || c === '%') && isIdentStart(line[i + 1] ?? ''))) {
      let j = i + 1;
      while (j < n && isIdentChar(line[j]!)) j++;
      const text = line.slice(i, j);
      tokens.push({ kind: 'ident', text, column, length: text.length });
      i = j;
      continue;
    }
    // Character literals: 'A', '\n'.
    if (c === "'") {
      let j = i + 1;
      let value: number;
      if (line[j] === '\\') {
        const e = escape(line, j + 1, 1);
        value = e.value;
        j = e.next;
      } else if (j < n && line[j] !== "'") {
        const ch = String.fromCodePoint(line.codePointAt(j)!);
        value = charCode(ch, j + 1);
        j += ch.length;
      } else throw new AsmError('empty character literal', column, 2);
      if (line[j] !== "'") throw new AsmError('unterminated character literal (expected a closing \')', column, j - i);
      const text = line.slice(i, j + 1);
      tokens.push({ kind: 'number', text, num: value, column, length: text.length });
      i = j + 1;
      continue;
    }
    // Strings.
    if (c === '"') {
      const bytes: number[] = [];
      let j = i + 1;
      for (;;) {
        if (j >= n) throw new AsmError('unterminated string (expected a closing ")', column, n - i);
        const ch = line[j]!;
        if (ch === '"') break;
        if (ch === '\\') {
          const e = escape(line, j + 1, 1);
          bytes.push(e.value);
          j = e.next;
        } else {
          const cp = String.fromCodePoint(line.codePointAt(j)!);
          bytes.push(charCode(cp, j + 1));
          j += cp.length;
        }
      }
      const text = line.slice(i, j + 1);
      tokens.push({ kind: 'string', text, bytes, column, length: text.length });
      i = j + 1;
      continue;
    }
    if (PUNCT.has(c)) {
      tokens.push({ kind: 'punct', text: c, column, length: 1 });
      i++;
      continue;
    }
    throw new AsmError(`unexpected character '${c}'`, column, 1);
  }
  // Column of the end-of-line token: just after the last token (or 1 on an empty line).
  const last = tokens[tokens.length - 1];
  const endColumn = last ? last.column + last.length : 1;
  tokens.push({ kind: 'eol', text: '', column: endColumn, length: 1 });
  return tokens;
}

/** A cursor over one line's tokens. */
export class TokenStream {
  private i = 0;
  constructor(readonly tokens: Token[]) {}

  peek(offset = 0): Token {
    return this.tokens[Math.min(this.i + offset, this.tokens.length - 1)]!;
  }
  next(): Token {
    const t = this.peek();
    if (this.i < this.tokens.length - 1) this.i++;
    return t;
  }
  atEnd(): boolean {
    return this.peek().kind === 'eol';
  }
  /** True (and consumes the token) if the next token is the punctuation `p`. */
  accept(p: string): boolean {
    const t = this.peek();
    if (t.kind === 'punct' && t.text === p) {
      this.next();
      return true;
    }
    return false;
  }
  isPunct(p: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.kind === 'punct' && t.text === p;
  }
  expect(p: string, what?: string): Token {
    const t = this.peek();
    if (t.kind === 'punct' && t.text === p) return this.next();
    throw errorAt(t, `expected ${what ?? `'${p}'`} but found ${describe(t)}`);
  }
  expectEnd(): void {
    const t = this.peek();
    if (t.kind !== 'eol') throw errorAt(t, `unexpected ${describe(t)} at the end of the statement`);
  }
}

/** A short human description of a token for error messages. */
export function describe(t: Token): string {
  switch (t.kind) {
    case 'eol':
      return 'the end of the line';
    case 'string':
      return 'a string';
    case 'number':
      return `'${t.text}'`;
    default:
      return `'${t.text}'`;
  }
}

// ---------------------------------------------------------------------------------------------
// Expressions

export type Expr =
  | { kind: 'num'; value: number; tok: Token }
  | { kind: 'sym'; name: string; tok: Token }
  | { kind: 'dot'; tok: Token }
  | { kind: 'neg'; arg: Expr; tok: Token }
  | { kind: 'bin'; op: '+' | '-'; left: Expr; right: Expr; tok: Token }
  | { kind: 'func'; name: string; arg: Expr; tok: Token };

export interface ExprOptions {
  /** Function names allowed as `name(expr)`, including any `%` prefix, e.g. `%hi`. */
  functions?: string[];
  /** Identifiers that may not be used as symbols (register names), with the message to show. */
  reserved?: (name: string) => string | undefined;
}

/** Parse an expression: `term (('+' | '-') term)*`. */
export function parseExpr(ts: TokenStream, options: ExprOptions = {}): Expr {
  let left = parseUnary(ts, options);
  for (;;) {
    const t = ts.peek();
    if (t.kind === 'punct' && (t.text === '+' || t.text === '-')) {
      ts.next();
      const right = parseUnary(ts, options);
      left = { kind: 'bin', op: t.text, left, right, tok: t };
    } else return left;
  }
}

function parseUnary(ts: TokenStream, options: ExprOptions): Expr {
  const t = ts.peek();
  if (t.kind === 'punct' && t.text === '-') {
    ts.next();
    return { kind: 'neg', arg: parseUnary(ts, options), tok: t };
  }
  if (t.kind === 'punct' && t.text === '+') {
    ts.next();
    return parseUnary(ts, options);
  }
  return parsePrimary(ts, options);
}

function parsePrimary(ts: TokenStream, options: ExprOptions): Expr {
  const t = ts.next();
  if (t.kind === 'number') return { kind: 'num', value: t.num!, tok: t };
  if (t.kind === 'punct' && t.text === '.') return { kind: 'dot', tok: t };
  if (t.kind === 'punct' && t.text === '(') {
    const e = parseExpr(ts, options);
    ts.expect(')', "')'");
    return e;
  }
  if (t.kind === 'ident') {
    const lower = t.text.toLowerCase();
    if (options.functions?.includes(lower)) {
      ts.expect('(', `'(' after ${t.text}`);
      const arg = parseExpr(ts, options);
      ts.expect(')', "')'");
      return { kind: 'func', name: lower, arg, tok: t };
    }
    if (t.text.startsWith('%')) throw errorAt(t, `unknown function '${t.text}'`);
    if (t.text.startsWith('.')) throw errorAt(t, `'${t.text}' is a directive, not a value`);
    const reserved = options.reserved?.(t.text);
    if (reserved) throw errorAt(t, reserved);
    return { kind: 'sym', name: t.text, tok: t };
  }
  if (t.kind === 'string') throw errorAt(t, 'a string cannot be used as a number here');
  throw errorAt(t, `expected a value but found ${describe(t)}`);
}

/** Environment for evaluating an expression. */
export interface EvalEnv {
  /** Address of the current statement (the value of `.`). */
  dot: number;
  /** Value of a symbol, or undefined if it is not known yet. May throw for undefined symbols. */
  lookup(name: string, tok: Token): number | undefined;
  /** Apply a function such as `%hi`. */
  func?(name: string, value: number, tok: Token): number;
}

/** Evaluate an expression; `undefined` means it refers to a symbol that is not known yet. */
export function evaluate(e: Expr, env: EvalEnv): number | undefined {
  switch (e.kind) {
    case 'num':
      return e.value;
    case 'dot':
      return env.dot;
    case 'sym':
      return env.lookup(e.name, e.tok);
    case 'neg': {
      const v = evaluate(e.arg, env);
      return v === undefined ? undefined : -v;
    }
    case 'bin': {
      const a = evaluate(e.left, env);
      const b = evaluate(e.right, env);
      if (a === undefined || b === undefined) return undefined;
      return e.op === '+' ? a + b : a - b;
    }
    case 'func': {
      const v = evaluate(e.arg, env);
      if (v === undefined) return undefined;
      if (!env.func) throw errorAt(e.tok, `unknown function '${e.name}'`);
      return env.func(e.name, v, e.tok);
    }
  }
}

/** The span (first column, length) an expression covers, for error messages. */
export function span(e: Expr): { column: number; length: number } {
  let lo = Infinity;
  let hi = -Infinity;
  const walk = (x: Expr): void => {
    lo = Math.min(lo, x.tok.column);
    hi = Math.max(hi, x.tok.column + x.tok.length);
    if (x.kind === 'neg' || x.kind === 'func') walk(x.arg);
    if (x.kind === 'bin') {
      walk(x.left);
      walk(x.right);
    }
  };
  walk(e);
  return { column: lo, length: Math.max(1, hi - lo) };
}

export function exprError(e: Expr, message: string): AsmError {
  const s = span(e);
  return new AsmError(message, s.column, s.length);
}

// ---------------------------------------------------------------------------------------------
// Symbols

export interface SymbolDef {
  name: string;
  kind: 'label' | 'equ';
  /** Labels: the address, once assigned. */
  value?: number;
  /** Constants: the defining expression and the address of the `.equ` statement. */
  expr?: Expr;
  dot?: number;
  line: number;
  column: number;
}

/**
 * The symbol table. Labels get their value in pass 1; constants are evaluated on first use (and
 * cached), so `.equ` may refer to symbols defined later. Circular definitions are reported.
 */
export class SymbolTable {
  readonly defs = new Map<string, SymbolDef>();

  /** `func` applies functions such as `%hi` inside constant definitions. */
  constructor(private readonly func?: EvalEnv['func']) {}

  private resolving = new Set<string>();
  private cache = new Map<string, number>();

  /** Define a symbol; returns an error message if the name is already taken. */
  define(def: SymbolDef): string | undefined {
    const old = this.defs.get(def.name);
    if (old) return `'${def.name}' is already defined on line ${old.line}`;
    this.defs.set(def.name, def);
    return undefined;
  }

  /**
   * The value of a symbol. With `final` set (pass 2), an undefined symbol is an error (with a
   * "did you mean" hint for a difference in case only); otherwise it reads as not known yet.
   */
  lookup(name: string, tok: Token, final: boolean): number | undefined {
    const def = this.defs.get(name);
    if (!def) {
      if (!final) return undefined;
      const lower = name.toLowerCase();
      const near = [...this.defs.keys()].find((k) => k.toLowerCase() === lower);
      throw errorAt(tok, `undefined symbol '${name}'${near ? ` (did you mean '${near}'? symbols are case-sensitive)` : ''}`);
    }
    if (def.kind === 'label') return def.value;
    const cached = this.cache.get(name);
    if (cached !== undefined) return cached;
    if (this.resolving.has(name)) throw errorAt(tok, `'${name}' is defined in terms of itself`);
    this.resolving.add(name);
    try {
      const v = this.evaluateDefinition(def, final);
      if (v !== undefined) this.cache.set(name, v);
      return v;
    } catch (e) {
      // Errors inside the definition are reported on the definition's own line; here, at the use.
      if (e instanceof AsmError && !e.message.startsWith('constant '))
        throw errorAt(tok, `constant '${name}' (line ${def.line}) cannot be evaluated: ${e.message}`);
      throw e;
    } finally {
      this.resolving.delete(name);
    }
  }

  /** Evaluate a constant's defining expression (errors point into the definition). */
  evaluateDefinition(def: SymbolDef, final: boolean): number | undefined {
    if (def.kind === 'label') return def.value;
    return evaluate(def.expr!, { dot: def.dot ?? 0, lookup: (n, t) => this.lookup(n, t, final), func: this.func });
  }

  /**
   * Evaluate every constant once more with `final` set, returning the errors (on the constants' own
   * lines), so mistakes in constants nobody uses are reported too.
   */
  checkConstants(): { line: number; error: AsmError }[] {
    const out: { line: number; error: AsmError }[] = [];
    for (const def of this.defs.values()) {
      if (def.kind !== 'equ') continue;
      this.resolving.add(def.name);
      try {
        const v = this.evaluateDefinition(def, true);
        if (v !== undefined) this.cache.set(def.name, v);
      } catch (e) {
        if (e instanceof AsmError) out.push({ line: def.line, error: e });
        else throw e;
      } finally {
        this.resolving.delete(def.name);
      }
    }
    return out;
  }

  /** Plain `name → value` for every symbol whose value is known. */
  values(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [name, def] of this.defs) {
      if (def.kind === 'label' && def.value !== undefined) out[name] = def.value;
      else {
        const v = this.cache.get(name);
        if (v !== undefined) out[name] = v;
      }
    }
    return out;
  }
}

/** Split source text into lines (accepting \n and \r\n). */
export function splitLines(source: string): string[] {
  return source.split(/\r?\n/);
}

/** Format diagnostics as `line:column: severity: message`, one per line (for tests and logs). */
export function formatDiagnostics(diagnostics: Diagnostic[], name = ''): string {
  return diagnostics
    .map((d) => `${name ? name + ':' : ''}${d.line}:${d.column}: ${d.severity}: ${d.message}`)
    .join('\n');
}

export function hex(value: number, digits: number): string {
  return value.toString(16).toUpperCase().padStart(digits, '0');
}
