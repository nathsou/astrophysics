/**
 * The DCL formatter: one canonical style (HDL.md, *Formatter*).
 *
 * - 2-space indentation, no semicolons (statements sharing a line are split), lines of at most 100 columns;
 * - a list (ports, connections, arguments, match arms, fields) stays on one line if it fits and was
 *   written on one line; otherwise it gets one element per line and a trailing comma;
 * - long operator chains break before the operator, which continues the statement (HDL.md, *Statements
 *   and newlines*);
 * - `} else {` on one line;
 * - comments are preserved; blank lines are kept (at most one), and top-level blocks are separated by one.
 *
 * `format(format(x)) === format(x)`, and formatting never changes the AST.
 */
import type { Expr, Item, MatchArm, ModuleItem, NamedArg, Port, TestStmt, TypeExpr, GenericParam } from './ast';
import type { Diagnostic } from './diagnostics';
import { breakParent, flatWidth, group, hardline, ifBreak, indent, join, line, printDoc, softline, type Doc } from './doc';
import type { Comment } from './lexer';
import { parse } from './parser';
import type { SourceFile } from './span';

export interface FormatResult {
  /** The formatted text, or the input unchanged when it has syntax errors. */
  output: string;
  diagnostics: Diagnostic[];
  changed: boolean;
}

const WIDTH = 100;

const PREC: Record<string, number> = {
  '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3, '|': 4, '^': 5, '&': 6, '<<': 7, '>>': 7,
  '+': 8, '-': 8, '*': 9,
};

interface Spanned {
  span: { start: number; end: number };
}

class Formatter {
  private ci = 0;
  constructor(
    private src: SourceFile,
    private comments: Comment[],
  ) {}

  private lineOf(offset: number): number {
    return this.src.position(offset).line;
  }

  /** Comments that start before `offset` and have not been printed yet. */
  private takeBefore(offset: number): Comment[] {
    const out: Comment[] = [];
    while (this.ci < this.comments.length && this.comments[this.ci]!.span.start < offset) out.push(this.comments[this.ci++]!);
    return out;
  }

  /** A comment on the same line as `end`, starting before `limit`. */
  private takeTrailing(end: number, limit: number): Comment | undefined {
    const c = this.comments[this.ci];
    if (c && c.span.start >= end && c.span.start < limit && this.lineOf(c.span.start) === this.lineOf(end)) {
      this.ci++;
      return c;
    }
    return undefined;
  }

  private commentDoc(c: Comment): Doc {
    // Block comments keep their inner line structure.
    // Continuation lines keep their indentation relative to the comment's first line.
    const parts = c.text.split('\n').map((p) => p.replace(/\r$/, ''));
    const col = c.span.col - 1;
    const strip = (p: string) => {
      let k = 0;
      while (k < col && p[k] === ' ') k++;
      return p.slice(k);
    };
    return join(hardline, parts.map((p, i) => (i === 0 ? p : p.trimStart().startsWith('*') ? ' ' + p.trimStart() : strip(p))));
  }

  /**
   * Statements or items of a block, one per line, with comments and blank lines. `lastLine` is the line
   * of the opening token (so a blank line right after `{` is dropped).
   */
  private body<T extends Spanned>(items: T[], print: (item: T) => Doc, close: number, openLine: number, blankBetween?: (a: T, b: T) => boolean): Doc[] {
    const out: Doc[] = [];
    let lastLine = openLine;
    let first = true;
    let prev: T | undefined;
    const sep = (startLine: number, forceBlank = false) => {
      if (!first) {
        out.push(hardline);
        if (forceBlank || startLine - lastLine >= 2) out.push(hardline);
      }
      first = false;
    };
    items.forEach((item, idx) => {
      const force = !!prev && !!blankBetween && blankBetween(prev, item);
      let firstEntry = true;
      for (const c of this.takeBefore(item.span.start)) {
        sep(this.lineOf(c.span.start), firstEntry && force);
        firstEntry = false;
        out.push(this.commentDoc(c));
        lastLine = this.lineOf(c.span.end);
      }
      sep(this.lineOf(item.span.start), firstEntry && force);
      const doc = print(item);
      const inner = this.takeBefore(item.span.end);
      for (const c of inner) out.push(this.commentDoc(c), hardline);
      out.push(doc);
      const next = items[idx + 1];
      const trailing = this.takeTrailing(item.span.end, next ? next.span.start : close);
      if (trailing) out.push(' ', trailing.text);
      lastLine = this.lineOf(item.span.end);
      prev = item;
    });
    for (const c of this.takeBefore(close)) {
      sep(this.lineOf(c.span.start));
      out.push(this.commentDoc(c));
      lastLine = this.lineOf(c.span.end);
    }
    return out;
  }

  /** A bracketed, comma-separated list that breaks to one element per line (with trailing comma). */
  private list<T extends Spanned>(open: string, close: string, elems: T[], print: (e: T) => Doc, closeOffset: number, multiline: boolean, pad = false): Doc {
    if (elems.length === 0) {
      const dangling = this.takeBefore(closeOffset);
      if (!dangling.length) return open + close;
      return group([open, indent([hardline, join(hardline, dangling.map((c) => this.commentDoc(c)))]), hardline, close], true);
    }
    const parts: Doc[] = [];
    let forced = multiline;
    elems.forEach((e, i) => {
      const leading = this.takeBefore(e.span.start);
      if (i > 0) parts.push(line);
      for (const c of leading) {
        parts.push(this.commentDoc(c), hardline);
        forced = true;
      }
      parts.push(print(e));
      const inner = this.takeBefore(e.span.end);
      if (inner.length) {
        forced = true;
        parts.push(' ', join(' ', inner.map((c) => c.text)), breakParent);
      }
      parts.push(i < elems.length - 1 ? ',' : ifBreak(','));
      const next = elems[i + 1];
      const trailing = this.takeTrailing(e.span.end, next ? next.span.start : closeOffset);
      if (trailing) {
        parts.push(' ', trailing.text, breakParent);
        forced = true;
      }
    });
    const dangling = this.takeBefore(closeOffset);
    for (const c of dangling) {
      parts.push(hardline, this.commentDoc(c));
      forced = true;
    }
    const edge = pad ? line : softline;
    return group([open, indent([edge, ...parts]), edge, close], forced);
  }

  // ----------------------------------------------------------------------------------------- program

  program(items: Item[], end: number): string {
    const isBlock = (i: Item) => i.kind === 'module' || i.kind === 'fn' || i.kind === 'test' || ((i.kind === 'struct' || i.kind === 'enum') && i.multiline);
    const docs = this.body(items, (i) => this.item(i), end, 0, (a, b) => isBlock(a) || isBlock(b));
    const text = printDoc(docs, WIDTH);
    return text.length ? text + '\n' : '';
  }

  item(item: Item): Doc {
    switch (item.kind) {
      case 'module': {
        const inputsClose = item.outputs.length || item.hasOutputs ? (item.outputs[0]?.span.start ?? item.bodyEnd) : item.bodyEnd;
        const inputs = this.list('(', ')', item.inputs, (p) => this.port(p), this.closeParen(item.inputs, inputsClose), item.inputsMultiline);
        const outputs = item.hasOutputs
          ? this.list('(', ')', item.outputs, (p) => this.port(p), this.closeParen(item.outputs, item.bodyEnd), item.outputsMultiline)
          : '';
        const name: Doc = [item.top ? 'top module ' : 'module ', item.name.name, this.generics(item.generics)];
        // The input list breaks first when the header is too long; then the output list, if still needed.
        const whole = flatWidth([name, inputs, item.hasOutputs ? ' -> ' : '', outputs, ' {']);
        if (whole > WIDTH) forceBreak(inputs);
        if (item.hasOutputs && (whole > WIDTH ? 5 + flatWidth(outputs) + 2 : whole) > WIDTH) forceBreak(outputs);
        const header: Doc[] = [name, inputs];
        if (item.hasOutputs) header.push(' -> ', outputs);
        header.push(' {');
        const body = this.body(item.body, (i) => this.moduleItem(i), item.bodyEnd, this.lineOf(item.span.start));
        if (body.length === 0) return [...header, '}'];
        return [...header, indent([hardline, ...body]), hardline, '}'];
      }
      case 'fn': {
        const head: Doc[] = ['fn ', item.name.name, this.generics(item.generics)];
        head.push(this.list('(', ')', item.params, (p) => this.port(p), this.closeParen(item.params, item.ret.span.start), item.paramsMultiline));
        head.push(' -> ', this.type(item.ret), ' {');
        return [...head, group([indent([line, this.expr(item.body)]), line, '}'], item.bodyMultiline)];
      }
      case 'struct':
        return ['struct ', item.name.name, ' ', this.list('{', '}', item.fields, (p) => this.port(p), item.span.end - 1, item.multiline, true)];
      case 'enum':
        return [
          item.encoding !== 'binary' || item.attrSpan ? `@${item.encoding} ` : '',
          'enum ', item.name.name, ' ',
          this.list('{', '}', item.variants.map((v) => ({ span: v.span, name: v.name })), (v) => v.name, item.span.end - 1, item.multiline, true),
        ];
      case 'type':
        return ['type ', item.name.name, ' = ', this.type(item.type)];
      case 'const':
        return ['const ', item.name.name, item.type ? [': ', this.type(item.type)] : '', ' = ', this.expr(item.value)];
      case 'test': {
        const body = this.body(item.body, (s) => this.testStmt(s), item.span.end - 1, this.lineOf(item.span.start));
        const head = ['test ', JSON.stringify(item.name), ' {'];
        if (body.length === 0) return [...head, '}'];
        return [...head, indent([hardline, ...body]), hardline, '}'];
      }
    }
  }

  /** The offset of the `)` closing a port list, approximated by searching back from the next token. */
  private closeParen(ports: Port[], nextStart: number): number {
    const text = this.src.text;
    let i = nextStart - 1;
    const floor = ports.length ? ports[ports.length - 1]!.span.end : 0;
    while (i > floor && text[i] !== ')') i--;
    return Math.max(i, floor);
  }

  generics(gs: GenericParam[]): Doc {
    if (!gs.length) return '';
    return ['<', join(', ', gs.map((g) => [g.name.name, ': ', this.type(g.type)])), '>'];
  }

  port(p: Port): Doc {
    return [p.name.name, ': ', this.type(p.type)];
  }

  type(t: TypeExpr): Doc {
    if (t.kind === 'array') return ['[', this.type(t.elem), '; ', this.expr(t.size), ']'];
    if (!t.args.length) return t.name.name;
    return [t.name.name, '<', join(', ', t.args.map((a) => this.expr(a))), '>'];
  }

  moduleItem(i: ModuleItem): Doc {
    switch (i.kind) {
      case 'let':
        return ['let ', i.name.name, i.type ? [': ', this.type(i.type)] : '', ' = ', this.expr(i.value)];
      case 'const':
        return ['const ', i.name.name, i.type ? [': ', this.type(i.type)] : '', ' = ', this.expr(i.value)];
      case 'reg':
        return ['reg ', i.name.name, ': ', this.type(i.type), ' = ', this.expr(i.init), i.clock ? [' on ', i.clock.name] : ''];
      case 'mem':
        return ['mem ', i.name.name, ': ', this.type(i.type), i.init ? [' = ', this.expr(i.init)] : '', i.clock ? [' on ', i.clock.name] : ''];
      case 'next':
        return ['next ', i.target.name.name, i.target.index ? ['[', this.expr(i.target.index), ']'] : '', ' = ', this.expr(i.value)];
      case 'inst':
        return [
          'inst ', i.name.name, ': ', i.module.name,
          i.generics.length ? ['<', join(', ', i.generics.map((g) => this.expr(g))), '>'] : '',
          this.list('(', ')', i.args, (a) => this.namedArg(a), i.span.end - 1, i.multiline),
        ];
      case 'assign':
        return [i.target.name, ' = ', this.expr(i.value)];
      case 'write':
        return [i.mem.name, '.write', this.list('(', ')', i.args, (a) => this.expr(a), i.span.end - 1, false)];
      case 'for': {
        const body = this.body(i.body, (x) => this.moduleItem(x), i.span.end - 1, this.lineOf(i.span.start));
        const head = ['for ', i.var.name, ' in ', this.expr(i.from), '..', this.expr(i.to), ' {'];
        if (!body.length) return [...head, '}'];
        return [...head, indent([hardline, ...body]), hardline, '}'];
      }
    }
  }

  testStmt(s: TestStmt): Doc {
    switch (s.kind) {
      case 'let':
        return ['let ', s.name.name, s.type ? [': ', this.type(s.type)] : '', ' = ', this.expr(s.value)];
      case 'set':
        return [this.expr(s.target), ' = ', this.expr(s.value)];
      case 'step':
        return ['step', s.count ? [' ', this.expr(s.count)] : '', s.clock ? [' on ', s.clock.name] : ''];
      case 'expect':
        return ['expect ', this.expr(s.cond)];
      case 'print':
        return ['print ', join(', ', s.args.map((a) => this.expr(a)))];
      case 'for': {
        const body = this.body(s.body, (x) => this.testStmt(x), s.span.end - 1, this.lineOf(s.span.start));
        const head = ['for ', s.var.name, ' in ', this.expr(s.from), '..', this.expr(s.to), ' {'];
        if (!body.length) return [...head, '}'];
        return [...head, indent([hardline, ...body]), hardline, '}'];
      }
    }
  }

  namedArg(a: NamedArg): Doc {
    return [a.name.name, ': ', this.expr(a.value)];
  }

  // ------------------------------------------------------------------------------------- expressions

  expr(e: Expr): Doc {
    switch (e.kind) {
      case 'number':
      case 'string':
        return e.text;
      case 'name':
        return e.name;
      case 'error':
        return '';
      case 'binary': {
        const prec = PREC[e.op]!;
        // Flatten a left-associative chain of the same precedence.
        const operands: Expr[] = [];
        const ops: string[] = [];
        let cur: Expr = e;
        while (cur.kind === 'binary' && PREC[cur.op] === prec && prec !== 3) {
          operands.unshift(cur.right);
          ops.unshift(cur.op);
          cur = cur.left;
        }
        if (prec === 3) {
          return group([this.expr(e.left), indent([line, e.op, ' ', this.expr(e.right)])]);
        }
        operands.unshift(cur);
        const rest = ops.map((op, i) => [line, op, ' ', this.expr(operands[i + 1]!)]);
        return group([this.expr(operands[0]!), indent(rest)]);
      }
      case 'unary':
        return [e.op, this.expr(e.operand)];
      case 'paren':
        return ['(', this.expr(e.inner), ')'];
      case 'block':
        return group(['{', indent([line, this.expr(e.inner)]), line, '}']);
      case 'if': {
        const parts: Doc[] = ['if ', this.expr(e.cond), ' {', indent([line, this.expr(e.then)])];
        let rest: Expr = e.else;
        while (rest.kind === 'if') {
          parts.push(line, '} else if ', this.expr(rest.cond), ' {', indent([line, this.expr(rest.then)]));
          rest = rest.else;
        }
        parts.push(line, '} else {', indent([line, this.expr(rest)]), line, '}');
        return group(parts, e.multiline);
      }
      case 'match':
        return ['match ', this.expr(e.scrutinee), ' ', this.list('{', '}', e.arms, (a) => this.arm(a), e.span.end - 1, e.multiline, true)];
      case 'call':
        return [e.callee.name, this.list('(', ')', e.args, (a) => this.expr(a), e.span.end - 1, e.multiline)];
      case 'method':
        return [this.expr(e.target), '.', e.method.name, this.list('(', ')', e.args, (a) => this.expr(a), e.span.end - 1, e.multiline)];
      case 'field':
        return [this.expr(e.target), '.', e.field.name];
      case 'index':
        return [this.expr(e.target), '[', this.expr(e.index), ']'];
      case 'slice':
        return [this.expr(e.target), '[', this.expr(e.hi), ':', this.expr(e.lo), ']'];
      case 'array':
        return this.list('[', ']', e.elems, (a) => this.expr(a), e.span.end - 1, e.multiline);
      case 'repeat':
        return ['[', this.expr(e.value), '; ', this.expr(e.count), ']'];
      case 'struct':
        return [e.name.name, ' ', this.list('{', '}', e.fields, (a) => this.namedArg(a), e.span.end - 1, e.multiline, true)];
      case 'typed':
        return [this.type(e.type), '(', this.expr(e.arg), ')'];
      case 'type':
        return this.type(e.type);
      case 'sim':
        return [
          'sim ', e.module.name,
          e.generics.length ? ['<', join(', ', e.generics.map((g) => this.expr(g))), '>'] : '',
          this.list('(', ')', e.args, (a) => this.namedArg(a), e.span.end - 1, e.multiline),
        ];
    }
  }

  arm(a: MatchArm): Doc {
    const pats: Doc[] = a.patterns.map((p) => this.expr(p));
    if (a.wildcard) pats.unshift('_');
    return [join(' | ', pats), ' => ', this.expr(a.body)];
  }
}

function forceBreak(d: Doc): void {
  if (typeof d === 'object' && !Array.isArray(d) && d.t === 'group') d.broken = true;
}

/** Formats a DCL source text; returns it unchanged (with the syntax errors) if it does not parse. */
export function formatResult(source: string, file = 'input.dcl'): FormatResult {
  const parsed = parse(source, file);
  if (parsed.diagnostics.some((d) => d.severity === 'error')) {
    return { output: source, diagnostics: parsed.diagnostics, changed: false };
  }
  const f = new Formatter(parsed.source, parsed.comments);
  const output = f.program(parsed.program.items, source.length);
  return { output, diagnostics: parsed.diagnostics, changed: output !== source };
}

/** Formats a DCL source text in the canonical style (unchanged if it has syntax errors). */
export function format(source: string, file = 'input.dcl'): string {
  return formatResult(source, file).output;
}
