/**
 * Name resolution and type checking (HDL.md, *Types*, *Expressions*, *Literals*, *Items*, *Clocks*).
 *
 * The checker works per module *specialisation*: a module with its generic arguments bound. It unrolls
 * `for` loops, evaluates constants, inlines `fn` calls and types every expression, producing a
 * `ModuleSpec` of typed expressions (`TExpr`) that elaboration turns into RTL. Checking concrete
 * specialisations keeps every width a plain number, so width rules are exact. Every non-generic module is
 * checked on its own; a generic module is checked for each instantiation (and each `sim` in a test).
 *
 * Literals are typed bidirectionally: `checkAgainst(e, T)` pushes an expected type into an expression
 * (through `if`, `match`, and the arithmetic and bitwise operators), while `infer(e)` computes a type
 * bottom-up. An expression made only of untyped literals infers to `int` (a compile-time value) or `lit`
 * (hardware whose width is still unknown, re-checked when a context appears).
 */
import type {
  ConstDecl, EnumDecl, Expr, FnDecl, Ident, Item, ModuleDecl, ModuleItem, NamedArg, Program, StructDecl,
  TestDecl, TestStmt, TypeAliasDecl, TypeExpr,
} from './ast';
import { DiagnosticSink, type Diagnostic } from './diagnostics';
import { parse } from './parser';
import { NO_SPAN, SourceFile, type Span } from './span';
import { findStd } from './std/index';
import {
  BIT, CLOCK, ERROR, INT, LIT, bits, bitsNeeded, clog2, fold, indexWidth, isBit, isUntyped, mask, typeEq,
  typeToString, walkTExpr, widthOf, type BinOp, type TExpr, type TExprOf, type Type,
} from './tir';

// ------------------------------------------------------------------------------------------ results

export interface PortInfo {
  name: string;
  type: Type;
  span: Span;
  doc?: string;
}

export interface LetSpec {
  name: string;
  type: Type;
  expr: TExpr;
  span: Span;
}

export interface RegSpec {
  name: string;
  type: Type;
  init: bigint;
  /** The name of the clock input that clocks it. */
  clock: string;
  /** `next r = …` */
  next?: TExpr;
  /** `next r[i] = …` for every element of an array register. */
  elemNext?: TExpr[];
  span: Span;
}

export interface MemSpec {
  name: string;
  elem: Type;
  depth: number;
  init: bigint[];
  clock: string;
  reads: { addr: TExpr; span: Span }[];
  write?: { addr: TExpr; data: TExpr; en: TExpr; span: Span };
  span: Span;
}

export interface InstSpec {
  name: string;
  spec: ModuleSpec;
  /** Data inputs of the child, keyed by port name. */
  conns: Map<string, TExpr>;
  /** Clock inputs of the child → the parent's clock input connected to it. */
  clocks: Map<string, string>;
  span: Span;
}

/** A checked module specialisation. */
export interface ModuleSpec {
  /** `Name` or `Name<8, 4>`. */
  key: string;
  name: string;
  decl: ModuleDecl;
  generics: Map<string, bigint>;
  inputs: PortInfo[];
  outputs: PortInfo[];
  clocks: string[];
  lets: Map<string, LetSpec>;
  regs: Map<string, RegSpec>;
  mems: Map<string, MemSpec>;
  insts: Map<string, InstSpec>;
  assigns: Map<string, TExpr>;
  /** For each output, the inputs it depends on combinationally. */
  combDeps: Map<string, Set<string>>;
  /** Whether checking this specialisation (or a child) reported an error. */
  hasErrors: boolean;
  /** Where each named signal is declared (for the editor and the waveform). */
  declSpans: Map<string, Span>;
}

export type TestPlanStmt =
  | { k: 'sim'; name: string; spec: ModuleSpec; inits: Map<string, TExpr>; span: Span }
  | { k: 'let'; name: string; expr: TExpr; span: Span }
  | { k: 'setvar'; name: string; expr: TExpr; span: Span }
  | { k: 'setport'; sim: string; port: string; expr: TExpr; span: Span }
  | { k: 'step'; count?: TExpr; clock?: string; span: Span }
  | { k: 'expect'; cond: TExpr; text: string; span: Span }
  | { k: 'print'; args: (string | TExpr)[]; span: Span }
  | { k: 'for'; var: string; from: TExpr; to: TExpr; body: TestPlanStmt[]; span: Span };

export interface TestPlan {
  name: string;
  span: Span;
  body: TestPlanStmt[];
  /** False when the test's statements have type errors (it is then not run). */
  ok: boolean;
}

export interface CheckOptions {
  file?: string;
  /** Resolve unknown module names in the standard library (default true). */
  std?: boolean;
  /** Report naming-convention warnings (default true). */
  lint?: boolean;
  /** Also check test blocks (default true). */
  tests?: boolean;
}

export interface CheckResult {
  diagnostics: Diagnostic[];
  program: TypedProgram;
}

/** The result of checking: the AST plus a checker that specialises modules on demand. */
export class TypedProgram {
  constructor(
    readonly ast: Program,
    readonly source: SourceFile,
    private checker: Checker,
    readonly tests: TestPlan[],
  ) {}

  /** Every module specialisation checked so far. */
  get specs(): Map<string, ModuleSpec> {
    return this.checker.specs;
  }

  /** The modules declared in this file, by name. */
  get modules(): Map<string, ModuleDecl> {
    const m = new Map<string, ModuleDecl>();
    for (const i of this.ast.items) if (i.kind === 'module') m.set(i.name.name, i);
    return m;
  }

  /** The module marked `top`, if any. */
  get top(): string | undefined {
    for (const i of this.ast.items) if (i.kind === 'module' && i.top) return i.name.name;
    return undefined;
  }

  /** Checks (or returns) the specialisation of `name` with these generic arguments. */
  specialize(name: string, generics: (number | bigint)[] = []): { spec?: ModuleSpec; diagnostics: Diagnostic[] } {
    return this.checker.specializeByName(name, generics.map((g) => BigInt(g)));
  }

  /** Source files of the standard library modules pulled in by name. */
  sourceOf(file: string): SourceFile | undefined {
    return this.checker.files.get(file);
  }
}

// ------------------------------------------------------------------------------------------ scopes

interface LetEntry {
  item: Extract<ModuleItem, { kind: 'let' }>;
  scope: Scope;
  uniq: string;
  state: 'new' | 'checking' | 'done';
  type?: Type;
  expr?: TExpr;
}
interface ConstEntry {
  item: Extract<ModuleItem, { kind: 'const' }> | ConstDecl;
  scope: Scope | null;
  state: 'new' | 'checking' | 'done';
  value?: TExpr;
}
interface RegEntry {
  item: Extract<ModuleItem, { kind: 'reg' }>;
  scope: Scope;
  uniq: string;
  type?: Type;
  nexts: { index?: number; expr: TExpr; span: Span }[];
}
interface MemEntry {
  item: Extract<ModuleItem, { kind: 'mem' }>;
  scope: Scope;
  uniq: string;
  checked?: boolean;
  spec?: MemSpec;
}
interface InstEntry {
  item: Extract<ModuleItem, { kind: 'inst' }>;
  scope: Scope;
  uniq: string;
  state: 'new' | 'checking' | 'done';
  inst?: InstSpec;
}

type Binding =
  | { k: 'input'; port: PortInfo }
  | { k: 'output'; port: PortInfo }
  | { k: 'let'; e: LetEntry }
  | { k: 'const'; e: ConstEntry }
  | { k: 'reg'; e: RegEntry }
  | { k: 'mem'; e: MemEntry }
  | { k: 'inst'; e: InstEntry }
  /** Generic parameters, loop variables, inlined function parameters. */
  | { k: 'value'; value: TExpr; span: Span }
  | { k: 'testvar'; name: string; type: Type; span: Span }
  | { k: 'sim'; name: string; spec: ModuleSpec; span: Span };

class Scope {
  readonly map = new Map<string, { b: Binding; span: Span }>();
  constructor(readonly parent: Scope | null) {}
  lookup(name: string): Binding | undefined {
    for (let s: Scope | null = this; s; s = s.parent) {
      const hit = s.map.get(name);
      if (hit) return hit.b;
    }
    return undefined;
  }
  names(): string[] {
    const out: string[] = [];
    for (let s: Scope | null = this; s; s = s.parent) out.push(...s.map.keys());
    return out;
  }
}

/** What is being checked: a module specialisation, a function body, or a test. */
interface Ctx {
  scope: Scope;
  mod: ModState | null;
  test: boolean;
  fnStack: string[];
  file: string;
}

interface ModState {
  spec: ModuleSpec;
  lets: LetEntry[];
  consts: ConstEntry[];
  regs: RegEntry[];
  mems: MemEntry[];
  insts: InstEntry[];
  actions: { item: ModuleItem; scope: Scope }[];
  assignSpans: Map<string, Span>;
  memReads: Map<string, number>;
  unrolled: number;
}

// ------------------------------------------------------------------------------------------ helpers

const STD_SYNCHRONIZER = 'Synchronizer';
const MAX_UNROLL = 65536;
const MAX_WIDTH = 1 << 16;

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length]![b.length]!;
}

function suggest(name: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = editDistance(name, c);
    if (d < bestD && d <= Math.max(1, Math.floor(name.length / 3))) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

function listWords(items: string[], verbSingular: string, verbPlural: string): string {
  if (items.length === 1) return `${items[0]} ${verbSingular}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]} ${verbPlural}`;
}

const BIN_OPS: Record<string, BinOp> = {
  '+': 'add', '-': 'sub', '*': 'mul', '&': 'and', '|': 'or', '^': 'xor', '<<': 'shl', '>>': 'shr',
  '==': 'eq', '!=': 'ne', '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge',
};
const ARITH = new Set(['+', '-', '*', '&', '|', '^']);
const COMPARE = new Set(['==', '!=', '<', '<=', '>', '>=']);

const BUILTINS = new Set([
  'concat', 'repeat', 'zext', 'sext', 'trunc', 'reverse', 'any', 'all', 'count_ones', 'signed', 'bits', 'bit',
  'clog2', 'random',
]);

const RE_PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const RE_SNAKE = /^_?[a-z][a-z0-9_]*$|^_$/;
const RE_SCREAMING = /^[A-Z][A-Z0-9_]*$/;

/** The name of a top-level item (tests have a string name and a name span). */
function itemIdent(item: Item): Ident {
  return item.kind === 'test' ? { name: item.name, span: item.nameSpan } : item.name;
}

function toPascal(s: string): string {
  return s.replace(/(^|_)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
}
function toSnake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

// ------------------------------------------------------------------------------------------ checker

type StdLoader = (name: string) => { file: string; source: string } | undefined;
let stdLoader: StdLoader = findStd;
/** Replaces the function that finds the standard-library file declaring a module (for tests and tools). */
export function setStdLoader(loader: StdLoader | null): void {
  stdLoader = loader ?? findStd;
}

export class Checker {
  readonly sink = new DiagnosticSink();
  readonly specs = new Map<string, ModuleSpec>();
  readonly files = new Map<string, SourceFile>();
  private building = new Set<string>();
  private globals = new Map<string, { item: Item; file: string; std: boolean }>();
  private typeCache = new Map<string, Type | 'resolving'>();
  private globalConsts = new Map<string, ConstEntry>();
  private loadedStd = new Set<string>();
  private currentFile: string;

  constructor(
    readonly program: Program,
    source: SourceFile,
    readonly options: Required<CheckOptions>,
  ) {
    this.files.set(source.name, source);
    this.currentFile = source.name;
    this.addItems(program.items, source.name, false);
  }

  private addItems(items: Item[], file: string, std: boolean): void {
    for (const item of items) {
      if (item.kind === 'test') continue;
      const name = item.name.name;
      const prev = this.globals.get(name);
      if (prev) {
        if (prev.std && !std) {
          this.globals.set(name, { item, file, std });
        } else if (!std) {
          this.sink.error('duplicate', `\`${name}\` is declared twice`, item.name.span, 'second declaration', {
            secondary: [{ span: itemIdent(prev.item).span, label: 'first declared here' }],
          });
        }
        continue;
      }
      this.globals.set(name, { item, file, std });
      if (item.kind === 'const') this.globalConsts.set(name, { item, scope: null, state: 'new' });
    }
  }

  /** Looks up a top-level item, loading the standard library file that declares it if needed. */
  private global(name: string): { item: Item; file: string; std: boolean } | undefined {
    const g = this.globals.get(name);
    if (g) return g;
    if (!this.options.std) return undefined;
    const found = stdLoader(name);
    if (!found || this.loadedStd.has(found.file)) return undefined;
    this.loadedStd.add(found.file);
    const parsed = parse(found.source, found.file);
    this.files.set(found.file, parsed.source);
    for (const d of parsed.diagnostics) this.sink.add(d);
    this.addItems(parsed.program.items, found.file, true);
    return this.globals.get(name);
  }

  private text(span: Span): string {
    const f = this.files.get(span.file);
    if (!f) return '…';
    const t = f.text.slice(span.start, span.end);
    return t.length <= 40 && !t.includes('\n') ? t : 'x';
  }

  private err(code: string, message: string, span: Span, label?: string, extra: Partial<Diagnostic> = {}): TExpr {
    this.sink.error(code, message, span, label, extra);
    return { k: 'const', v: 0n, t: ERROR, span };
  }

  private errT(span: Span): TExpr {
    return { k: 'const', v: 0n, t: ERROR, span };
  }

  // ------------------------------------------------------------------------------------- entry points

  run(): TestPlan[] {
    if (this.options.lint) this.lint();
    const tops = this.program.items.filter((i): i is ModuleDecl => i.kind === 'module' && i.top);
    for (const extra of tops.slice(1)) {
      this.sink.error('multiple-top', 'only one module can be `top`', extra.name.span, 'second `top` module', {
        secondary: [{ span: tops[0]!.name.span, label: 'first `top` module' }],
        help: ['`top` marks the module bound to the virtual board; remove it from the others'],
      });
    }
    for (const item of this.program.items) {
      if (item.kind === 'module' && item.generics.length === 0 && !item.headerError) this.getSpec(item, [], item.name.span, this.currentFile);
      else if (item.kind === 'fn' && item.generics.length === 0) this.checkFnStandalone(item);
      else if (item.kind === 'const') this.ensureConst(this.globalConsts.get(item.name.name)!);
      else if (item.kind === 'struct' || item.kind === 'enum' || item.kind === 'type') this.namedType(item.name.name, item.name.span);
    }
    const tests: TestPlan[] = [];
    if (this.options.tests) for (const item of this.program.items) if (item.kind === 'test') tests.push(this.checkTest(item));
    return tests;
  }

  specializeByName(name: string, generics: bigint[]): { spec?: ModuleSpec; diagnostics: Diagnostic[] } {
    const before = this.sink.list.length;
    const g = this.global(name);
    if (!g || g.item.kind !== 'module') {
      this.sink.error('unknown-module', `unknown module \`${name}\``, this.program.span, undefined);
      return { diagnostics: this.sink.list.slice(before) };
    }
    const spec = this.getSpec(g.item, generics, g.item.name.span, g.file);
    return { spec: spec ?? undefined, diagnostics: this.sink.list.slice(before) };
  }

  // ------------------------------------------------------------------------------------------- lint

  private lint(): void {
    const warn = (id: Ident, what: string, style: 'PascalCase' | 'snake_case' | 'SCREAMING_CASE') => {
      const re = style === 'PascalCase' ? RE_PASCAL : style === 'snake_case' ? RE_SNAKE : RE_SCREAMING;
      if (re.test(id.name)) return;
      const fix = style === 'PascalCase' ? toPascal(id.name) : style === 'snake_case' ? toSnake(id.name) : toSnake(id.name).toUpperCase();
      this.sink.warning('naming', `${what} \`${id.name}\` should be ${style}`, id.span, undefined, { help: [`rename it to \`${fix}\``] });
    };
    const ports = (ps: { name: Ident }[]) => ps.forEach((p) => warn(p.name, 'port', 'snake_case'));
    const items = (list: ModuleItem[]) => {
      for (const i of list) {
        if (i.kind === 'let' || i.kind === 'reg' || i.kind === 'mem' || i.kind === 'inst') warn(i.name, i.kind === 'inst' ? 'instance' : i.kind, 'snake_case');
        else if (i.kind === 'const') warn(i.name, 'constant', 'SCREAMING_CASE');
        else if (i.kind === 'for') {
          warn(i.var, 'loop variable', 'snake_case');
          items(i.body);
        }
      }
    };
    for (const item of this.program.items) {
      switch (item.kind) {
        case 'module':
          warn(item.name, 'module', 'PascalCase');
          item.generics.forEach((g) => warn(g.name, 'generic parameter', 'SCREAMING_CASE'));
          ports(item.inputs);
          ports(item.outputs);
          items(item.body);
          break;
        case 'fn':
          warn(item.name, 'function', 'snake_case');
          ports(item.params);
          break;
        case 'struct':
          warn(item.name, 'struct', 'PascalCase');
          item.fields.forEach((f) => warn(f.name, 'field', 'snake_case'));
          break;
        case 'enum':
          warn(item.name, 'enum', 'PascalCase');
          item.variants.forEach((v) => warn(v, 'variant', 'PascalCase'));
          break;
        case 'type':
          warn(item.name, 'type', 'PascalCase');
          break;
        case 'const':
          warn(item.name, 'constant', 'SCREAMING_CASE');
          break;
      }
    }
  }

  // ------------------------------------------------------------------------------------------ types

  private namedType(name: string, span: Span): Type | undefined {
    const cached = this.typeCache.get(name);
    if (cached === 'resolving') {
      this.sink.error('recursive-type', `the type \`${name}\` contains itself`, span, 'recursive type', {
        notes: ['hardware has a fixed size, so a type cannot contain itself'],
      });
      return ERROR;
    }
    if (cached) return cached;
    const g = this.global(name);
    if (!g || (g.item.kind !== 'struct' && g.item.kind !== 'enum' && g.item.kind !== 'type')) return undefined;
    this.typeCache.set(name, 'resolving');
    let t: Type;
    const item = g.item as StructDecl | EnumDecl | TypeAliasDecl;
    const saved = this.currentFile;
    this.currentFile = g.file;
    const ctx: Ctx = { scope: new Scope(null), mod: null, test: false, fnStack: [], file: g.file };
    if (item.kind === 'struct') {
      const seen = new Map<string, Span>();
      const fields: { name: string; type: Type }[] = [];
      for (const f of item.fields) {
        const prev = seen.get(f.name.name);
        if (prev) this.sink.error('duplicate', `field \`${f.name.name}\` is declared twice`, f.name.span, undefined, { secondary: [{ span: prev, label: 'first declared here' }] });
        seen.set(f.name.name, f.name.span);
        const ft = this.resolveType(f.type, ctx);
        if (ft.k === 'clock') this.sink.error('clock-misuse', 'a struct field cannot be a clock', f.type.span, undefined, { notes: ['clocks can only be passed through ports'] });
        fields.push({ name: f.name.name, type: ft });
      }
      if (!fields.length) this.sink.error('empty-type', `struct \`${name}\` has no fields`, item.name.span);
      t = { k: 'struct', name, fields };
    } else if (item.kind === 'enum') {
      const n = item.variants.length;
      const seen = new Map<string, Span>();
      for (const v of item.variants) {
        const prev = seen.get(v.name);
        if (prev) this.sink.error('duplicate', `variant \`${v.name}\` is declared twice`, v.span, undefined, { secondary: [{ span: prev, label: 'first declared here' }] });
        seen.set(v.name, v.span);
      }
      if (!n) this.sink.error('empty-type', `enum \`${name}\` has no variants`, item.name.span);
      const codes = item.variants.map((_, i) =>
        item.encoding === 'onehot' ? 1n << BigInt(i) : item.encoding === 'gray' ? BigInt(i ^ (i >> 1)) : BigInt(i),
      );
      const w = item.encoding === 'onehot' ? Math.max(1, n) : indexWidth(Math.max(1, n));
      t = { k: 'enum', name, variants: item.variants.map((v) => v.name), codes, w, encoding: item.encoding };
    } else {
      t = this.resolveType(item.type, ctx);
    }
    this.currentFile = saved;
    this.typeCache.set(name, t);
    return t;
  }

  private resolveType(te: TypeExpr, ctx: Ctx): Type {
    if (te.kind === 'array') {
      const elem = this.resolveType(te.elem, ctx);
      const n = this.constInt(te.size, ctx, 'an array size');
      if (n === undefined) return ERROR;
      if (n < 1n || n > BigInt(MAX_WIDTH)) {
        this.sink.error('bad-size', `array size must be between 1 and ${MAX_WIDTH}`, te.size.span, `this is ${n}`);
        return ERROR;
      }
      if (elem.k === 'clock') {
        this.sink.error('clock-misuse', 'arrays of clocks are not allowed', te.span, undefined, { notes: ['clocks can only be passed through ports, one at a time'] });
        return ERROR;
      }
      if (elem.k === 'int') {
        this.sink.error('bad-type', 'arrays of `int` are not hardware', te.span);
        return ERROR;
      }
      return elem.k === 'error' ? ERROR : { k: 'array', elem, n: Number(n) };
    }
    const name = te.name.name;
    const argCount = (n: number) => {
      if (te.args.length !== n) {
        this.sink.error('bad-type', `\`${name}\` takes ${n === 0 ? 'no' : n} argument${n === 1 ? '' : 's'}`, te.span, `${te.args.length} given`, {
          help: n === 1 ? [`write \`${name}<N>\``] : undefined,
        });
        return false;
      }
      return true;
    };
    switch (name) {
      case 'bit':
        argCount(0);
        return BIT;
      case 'clock':
        argCount(0);
        return CLOCK;
      case 'int':
        argCount(0);
        return INT;
      case 'bits':
      case 'signed': {
        if (!argCount(1)) return ERROR;
        const w = this.constInt(te.args[0]!, ctx, 'a width');
        if (w === undefined) return ERROR;
        if (w < 1n || w > BigInt(MAX_WIDTH)) {
          this.sink.error('bad-width', `a width must be between 1 and ${MAX_WIDTH}`, te.args[0]!.span, `this is ${w}`);
          return ERROR;
        }
        return bits(Number(w), name === 'signed');
      }
    }
    const t = this.namedType(name, te.name.span);
    if (!t) {
      const b = ctx.scope.lookup(name);
      const cands = [...this.globals.keys()].filter((k) => {
        const g = this.globals.get(k)!;
        return g.item.kind === 'struct' || g.item.kind === 'enum' || g.item.kind === 'type';
      });
      this.sink.error('unknown-type', `unknown type \`${name}\``, te.name.span, b ? 'this is a value, not a type' : undefined, {
        help: (() => {
          const s = suggest(name, [...cands, 'bit', 'bits', 'signed', 'clock', 'int']);
          return s ? [`did you mean \`${s}\`?`] : undefined;
        })(),
      });
      return ERROR;
    }
    argCount(0);
    return t;
  }

  /** Evaluates a compile-time integer expression. */
  private constInt(e: Expr, ctx: Ctx, what: string): bigint | undefined {
    const te = this.infer(e, ctx);
    if (te.t.k === 'error') return undefined;
    if (te.t.k === 'lit') {
      this.sink.error('not-constant', `${what} must be a compile-time integer`, e.span, 'this needs a width to be evaluated');
      return undefined;
    }
    if (te.k !== 'const') {
      this.sink.error('not-constant', `${what} must be a compile-time constant`, e.span, 'this depends on signals', {
        help: ['use literals, generic parameters, `const`s and loop variables'],
      });
      return undefined;
    }
    return te.v;
  }

  // ------------------------------------------------------------------------------------ specialisation

  private specKey(name: string, generics: bigint[]): string {
    return generics.length ? `${name}<${generics.join(', ')}>` : name;
  }

  private getSpec(decl: ModuleDecl, generics: bigint[], useSpan: Span, file: string): ModuleSpec | null {
    const key = this.specKey(decl.name.name, generics);
    const done = this.specs.get(key);
    if (done) return done;
    if (this.building.has(key)) {
      this.sink.error('recursive-module', `module \`${decl.name.name}\` contains itself`, useSpan, 'recursive instance', {
        notes: ['hardware is finite: a module cannot contain an instance of itself'],
      });
      return null;
    }
    this.building.add(key);
    const saved = this.currentFile;
    this.currentFile = file;
    const errorsBefore = this.sink.errorCount;
    const spec = this.buildSpec(decl, generics, key, file);
    spec.hasErrors ||= this.sink.errorCount > errorsBefore;
    this.currentFile = saved;
    this.building.delete(key);
    this.specs.set(key, spec);
    return spec;
  }

  private buildSpec(decl: ModuleDecl, generics: bigint[], key: string, file: string): ModuleSpec {
    const spec: ModuleSpec = {
      key, name: decl.name.name, decl, generics: new Map(), inputs: [], outputs: [], clocks: [], lets: new Map(),
      regs: new Map(), mems: new Map(), insts: new Map(), assigns: new Map(), combDeps: new Map(), hasErrors: false,
      declSpans: new Map(),
    };
    const scope = new Scope(null);
    const mod: ModState = {
      spec, lets: [], consts: [], regs: [], mems: [], insts: [], actions: [], assignSpans: new Map(), memReads: new Map(), unrolled: 0,
    };
    const ctx: Ctx = { scope, mod, test: false, fnStack: [], file };

    decl.generics.forEach((g, i) => {
      const v = generics[i] ?? 0n;
      spec.generics.set(g.name.name, v);
      this.bind(scope, g.name, { k: 'value', value: { k: 'const', v, t: INT, span: g.name.span }, span: g.name.span });
      if (g.type.kind !== 'named' || g.type.name.name !== 'int') {
        this.sink.error('bad-type', 'generic parameters must be `int`', g.type.span, undefined, { help: [`write \`${g.name.name}: int\``] });
      }
    });

    for (const [list, out] of [[decl.inputs, spec.inputs], [decl.outputs, spec.outputs]] as const) {
      for (const p of list) {
        const type = this.resolveType(p.type, ctx);
        const info: PortInfo = { name: p.name.name, type, span: p.name.span, doc: p.doc };
        out.push(info);
        spec.declSpans.set(p.name.name, p.name.span);
        if (list === decl.outputs) {
          if (type.k === 'clock') this.sink.error('clock-misuse', 'an output cannot be a clock', p.type.span, undefined, {
            notes: ['clocks come into a design through its inputs; a generated clock would be a gated clock'],
            help: ['output an enable signal instead'],
          });
          this.bind(scope, p.name, { k: 'output', port: info });
        } else {
          if (type.k === 'clock') spec.clocks.push(p.name.name);
          this.bind(scope, p.name, { k: 'input', port: info });
        }
        if (type.k === 'int') this.sink.error('bad-type', 'a port cannot be an `int`', p.type.span, undefined, { help: ['use `bits<N>`, or make it a generic parameter'] });
      }
    }

    this.collect(decl.body, scope, '', mod, ctx);

    // Check every declaration and statement.
    for (const e of mod.consts) this.ensureConst(e);
    for (const e of mod.lets) this.ensureLet(e, ctx);
    for (const e of mod.regs) this.checkReg(e, mod, ctx);
    for (const e of mod.mems) this.checkMem(e, mod, ctx);
    for (const e of mod.insts) this.ensureInst(e, ctx);
    for (const a of mod.actions) this.checkAction(a.item, { ...ctx, scope: a.scope }, mod);

    this.finishRegs(mod);
    for (const out of spec.outputs) {
      if (out.type.k === 'clock') continue;
      if (!spec.assigns.has(out.name)) {
        this.sink.error('unassigned-output', `output \`${out.name}\` is never assigned`, out.span, 'declared here', {
          help: [`assign it once in the module body: \`${out.name} = …\``],
        });
      }
    }
    this.analyse(spec, mod);
    return spec;
  }

  private bind(scope: Scope, id: Ident, b: Binding): void {
    const prev = scope.map.get(id.name);
    if (prev) {
      this.sink.error('duplicate', `\`${id.name}\` is declared twice`, id.span, 'second declaration', {
        secondary: [{ span: prev.span, label: 'first declared here' }],
      });
      return;
    }
    scope.map.set(id.name, { b, span: id.span });
  }

  /** Binds the declarations of a block (unrolling `for` loops after the block's own names are known). */
  private collect(items: ModuleItem[], scope: Scope, suffix: string, mod: ModState, ctx: Ctx): void {
    const loops: Extract<ModuleItem, { kind: 'for' }>[] = [];
    for (const item of items) {
      switch (item.kind) {
        case 'let': {
          const e: LetEntry = { item, scope, uniq: item.name.name + suffix, state: 'new' };
          mod.lets.push(e);
          this.bind(scope, item.name, { k: 'let', e });
          mod.spec.declSpans.set(e.uniq, item.name.span);
          break;
        }
        case 'const': {
          const e: ConstEntry = { item, scope, state: 'new' };
          mod.consts.push(e);
          this.bind(scope, item.name, { k: 'const', e });
          break;
        }
        case 'reg': {
          const e: RegEntry = { item, scope, uniq: item.name.name + suffix, nexts: [] };
          mod.regs.push(e);
          this.bind(scope, item.name, { k: 'reg', e });
          mod.spec.declSpans.set(e.uniq, item.name.span);
          break;
        }
        case 'mem': {
          const e: MemEntry = { item, scope, uniq: item.name.name + suffix };
          mod.mems.push(e);
          this.bind(scope, item.name, { k: 'mem', e });
          mod.spec.declSpans.set(e.uniq, item.name.span);
          break;
        }
        case 'inst': {
          const e: InstEntry = { item, scope, uniq: item.name.name + suffix, state: 'new' };
          mod.insts.push(e);
          this.bind(scope, item.name, { k: 'inst', e });
          mod.spec.declSpans.set(e.uniq, item.name.span);
          break;
        }
        case 'for':
          loops.push(item);
          break;
        default:
          mod.actions.push({ item, scope });
      }
    }
    for (const loop of loops) {
      const lctx = { ...ctx, scope };
      const from = this.constInt(loop.from, lctx, 'a loop bound');
      const to = this.constInt(loop.to, lctx, 'a loop bound');
      if (from === undefined || to === undefined) continue;
      if (to - from > BigInt(MAX_UNROLL) || (mod.unrolled += Number(to > from ? to - from : 0n)) > MAX_UNROLL) {
        this.sink.error('loop-too-long', `this loop unrolls into more than ${MAX_UNROLL} copies`, loop.span, undefined, {
          notes: ['`for` is unrolled at compile time: every iteration becomes hardware'],
        });
        continue;
      }
      for (let i = from; i < to; i++) {
        const inner = new Scope(scope);
        inner.map.set(loop.var.name, { b: { k: 'value', value: { k: 'const', v: i, t: INT, span: loop.var.span }, span: loop.var.span }, span: loop.var.span });
        this.collect(loop.body, inner, `${suffix}#${i}`, mod, ctx);
      }
    }
  }

  private ensureConst(e: ConstEntry): TExpr {
    if (e.state === 'done') return e.value!;
    const span = e.item.name.span;
    if (e.state === 'checking') {
      this.sink.error('cycle', `the constant \`${e.item.name.name}\` depends on itself`, span, 'defined in terms of itself');
      return this.errT(span);
    }
    e.state = 'checking';
    const ctx: Ctx = { scope: e.scope ?? new Scope(null), mod: null, test: false, fnStack: [], file: e.item.span.file };
    let v: TExpr;
    if (e.item.type) {
      const t = this.resolveType(e.item.type, ctx);
      v = this.checkAgainst(e.item.value, t, ctx);
    } else {
      v = this.infer(e.item.value, ctx);
      if (v.t.k === 'lit') v = this.noContext(e.item.value, `give the constant a type: \`const ${e.item.name.name}: bits<N> = …\``);
    }
    if (v.t.k !== 'error' && v.k !== 'const') {
      v = this.err('not-constant', `the value of \`${e.item.name.name}\` is not a compile-time constant`, e.item.value.span, 'this depends on signals', {
        help: ['use `let` for a wire'],
      });
    }
    if (v.t.k === 'clock') v = this.err('clock-misuse', 'a constant cannot be a clock', e.item.value.span);
    e.value = { ...v, span: e.item.value.span };
    e.state = 'done';
    return e.value;
  }

  private ensureLet(e: LetEntry, ctx: Ctx): { type: Type } {
    if (e.state === 'done') return { type: e.type! };
    if (e.item.type && !e.type) {
      e.type = this.resolveType(e.item.type, { ...ctx, scope: e.scope });
      if (e.type.k === 'clock') {
        this.sink.error('clock-misuse', 'a `let` cannot be a clock', e.item.type.span, undefined, {
          notes: ['clocks can only be passed through ports; they cannot be computed or stored'],
        });
        e.type = ERROR;
      }
      if (e.type.k === 'int') {
        this.sink.error('bad-type', 'a `let` is a wire and cannot be an `int`', e.item.type.span, undefined, { help: ['use `const` for a compile-time integer'] });
        e.type = ERROR;
      }
    }
    if (e.state === 'checking') {
      if (e.type) return { type: e.type };
      this.sink.error('cannot-infer', `cannot infer the type of \`${e.item.name.name}\`: its value depends on itself`, e.item.name.span, undefined, {
        help: [`give it a type: \`let ${e.item.name.name}: bits<N> = …\``],
      });
      e.type = ERROR;
      return { type: ERROR };
    }
    e.state = 'checking';
    const lctx = { ...ctx, scope: e.scope };
    let expr: TExpr;
    if (e.type) expr = this.checkAgainst(e.item.value, e.type, lctx);
    else {
      expr = this.infer(e.item.value, lctx);
      if (isUntyped(expr.t)) {
        expr = this.noContext(e.item.value, `give it a type: \`let ${e.item.name.name}: bits<N> = …\`, or use \`const\``);
      }
      if (expr.t.k === 'clock') expr = this.err('clock-misuse', 'a `let` cannot be a clock', e.item.value.span);
      e.type = expr.t;
    }
    e.expr = expr;
    e.state = 'done';
    ctx.mod?.spec.lets.set(e.uniq, { name: e.uniq, type: e.type, expr, span: e.item.name.span });
    if (!ctx.mod) void 0;
    return { type: e.type };
  }

  private regType(e: RegEntry, ctx: Ctx): Type {
    if (!e.type) {
      e.type = this.resolveType(e.item.type, { ...ctx, scope: e.scope });
      if (e.type.k === 'clock' || e.type.k === 'int') {
        this.sink.error(e.type.k === 'clock' ? 'clock-misuse' : 'bad-type', `a register cannot hold ${e.type.k === 'clock' ? 'a clock' : 'an `int`'}`, e.item.type.span);
        e.type = ERROR;
      }
    }
    return e.type;
  }

  private clockFor(onClock: Ident | undefined, what: string, name: Ident, mod: ModState): string {
    const clocks = mod.spec.clocks;
    if (onClock) {
      if (!clocks.includes(onClock.name)) {
        this.sink.error('clock-misuse', `\`${onClock.name}\` is not a clock input of this module`, onClock.span, undefined, {
          help: clocks.length ? [`the clock inputs are ${clocks.map((c) => `\`${c}\``).join(', ')}`] : [`add an input \`${onClock.name}: clock\``],
        });
      }
      return onClock.name;
    }
    if (clocks.length === 1) return clocks[0]!;
    if (clocks.length === 0) {
      this.sink.error('clock-misuse', `${what} \`${name.name}\` needs a clock, but this module has no clock input`, name.span, undefined, {
        help: ['add an input `clk: clock`'],
        notes: ['a module with registers or memories must have exactly one `clock` input'],
      });
      return '';
    }
    this.sink.error('clock-misuse', `this module has several clocks, so ${what} \`${name.name}\` must say which one clocks it`, name.span, undefined, {
      help: [`add \`on ${clocks[0]}\` (the clocks are ${clocks.map((c) => `\`${c}\``).join(', ')})`],
    });
    return clocks[0]!;
  }

  private checkReg(e: RegEntry, mod: ModState, ctx: Ctx): void {
    const t = this.regType(e, ctx);
    const clock = this.clockFor(e.item.clock, 'register', e.item.name, mod);
    let init = 0n;
    if (t.k !== 'error') {
      const v = this.checkAgainst(e.item.init, t, { ...ctx, scope: e.scope });
      if (v.k === 'const') init = v.v;
      else if (v.t.k !== 'error') {
        this.sink.error('not-constant', 'the initial value of a register must be a constant', e.item.init.span, 'this depends on signals', {
          notes: ['the power-up value is loaded with the configuration, before any logic runs'],
        });
      }
    }
    mod.spec.regs.set(e.uniq, { name: e.uniq, type: t, init, clock, span: e.item.name.span });
  }

  private checkMem(e: MemEntry, mod: ModState, ctx: Ctx): void {
    if (e.checked) return;
    e.checked = true;
    const t = this.resolveType(e.item.type, { ...ctx, scope: e.scope });
    const clock = this.clockFor(e.item.clock, 'memory', e.item.name, mod);
    if (t.k !== 'array') {
      if (t.k !== 'error') this.sink.error('bad-type', 'a memory must have an array type `[T; N]`', e.item.type.span, typeToString(t));
      return;
    }
    let init: bigint[] = new Array<bigint>(t.n).fill(0n);
    if (e.item.init) {
      const v = this.checkAgainst(e.item.init, t, { ...ctx, scope: e.scope });
      if (v.k === 'const') {
        const w = BigInt(widthOf(t.elem));
        init = init.map((_, i) => (v.v >> (BigInt(i) * w)) & mask(Number(w)));
      } else if (v.t.k !== 'error') this.sink.error('not-constant', 'the initial contents of a memory must be constant', e.item.init.span);
    }
    const spec: MemSpec = { name: e.uniq, elem: t.elem, depth: t.n, init, clock, reads: [], span: e.item.name.span };
    e.spec = spec;
    mod.spec.mems.set(e.uniq, spec);
  }

  private ensureInst(e: InstEntry, ctx: Ctx): InstSpec | undefined {
    if (e.state === 'done') return e.inst;
    if (e.state === 'checking') return e.inst;
    e.state = 'checking';
    const item = e.item;
    const ictx = { ...ctx, scope: e.scope };
    const g = this.global(item.module.name);
    if (!g || g.item.kind !== 'module') {
      const mods = [...this.globals.values()].filter((x) => x.item.kind === 'module').map((x) => itemIdent(x.item).name);
      const s = suggest(item.module.name, mods);
      this.sink.error('unknown-module', `unknown module \`${item.module.name}\``, item.module.span, g ? `this is a ${g.item.kind}, not a module` : undefined, {
        help: s ? [`did you mean \`${s}\`?`] : undefined,
      });
      e.state = 'done';
      return undefined;
    }
    const decl = g.item;
    const generics: bigint[] = [];
    if (item.generics.length !== decl.generics.length) {
      this.sink.error('bad-generics', `\`${decl.name.name}\` takes ${decl.generics.length} generic argument${decl.generics.length === 1 ? '' : 's'}`, item.module.span, `${item.generics.length} given`, {
        help: decl.generics.length ? [`write \`${decl.name.name}<${decl.generics.map((p) => p.name.name).join(', ')}>(…)\``] : undefined,
      });
      e.state = 'done';
      return undefined;
    }
    for (const a of item.generics) {
      const v = this.constInt(a, ictx, 'a generic argument');
      if (v === undefined) {
        e.state = 'done';
        return undefined;
      }
      generics.push(v);
    }
    const child = this.getSpec(decl, generics, item.module.span, g.file);
    if (!child) {
      e.state = 'done';
      return undefined;
    }
    const inst: InstSpec = { name: e.uniq, spec: child, conns: new Map(), clocks: new Map(), span: item.name.span };
    e.inst = inst;
    ctx.mod?.spec.insts.set(e.uniq, inst);
    this.connect(child, item.args, item.name, item.module, ictx, (port, value) => inst.conns.set(port, value), (port, clk) => inst.clocks.set(port, clk));
    e.state = 'done';
    return inst;
  }

  /** Checks port connections of an instance (or a `sim`). */
  private connect(
    child: ModuleSpec, args: NamedArg[], instName: Ident, module: Ident, ctx: Ctx,
    setData: (port: string, value: TExpr) => void, setClock: (port: string, clock: string) => void, test = false,
  ): void {
    const seen = new Map<string, Span>();
    for (const a of args) {
      const port = child.inputs.find((p) => p.name === a.name.name);
      const prev = seen.get(a.name.name);
      if (prev) {
        this.sink.error('double-connection', `input \`${a.name.name}\` is connected twice`, a.name.span, undefined, { secondary: [{ span: prev, label: 'first connected here' }] });
        continue;
      }
      seen.set(a.name.name, a.name.span);
      if (!port) {
        const isOut = child.outputs.some((p) => p.name === a.name.name);
        const s = suggest(a.name.name, child.inputs.map((p) => p.name));
        this.sink.error('unknown-port', isOut ? `\`${a.name.name}\` is an output of \`${child.name}\`, not an input` : `\`${child.name}\` has no input \`${a.name.name}\``, a.name.span, undefined, {
          help: isOut ? [`read it as \`${instName.name}.${a.name.name}\``] : s ? [`did you mean \`${s}\`?`] : undefined,
        });
        continue;
      }
      if (port.type.k === 'clock') {
        if (test) {
          this.sink.error('clock-misuse', 'a simulated instance\'s clock is driven by `step`', a.span, undefined, { help: ['remove this connection'] });
          continue;
        }
        const v = a.value;
        const b = v.kind === 'name' ? ctx.scope.lookup(v.name) : undefined;
        if (v.kind !== 'name' || !b || b.k !== 'input' || b.port.type.k !== 'clock') {
          this.sink.error('clock-misuse', `the clock \`${port.name}\` must be connected to a clock input`, v.span, 'not a clock input of this module', {
            notes: ['clocks cannot be computed, so a gated clock is impossible; use an enable signal instead'],
          });
          continue;
        }
        setClock(port.name, v.name);
        continue;
      }
      const value = this.checkAgainst(a.value, port.type, ctx);
      setData(port.name, value);
    }
    const missing = child.inputs.filter((p) => !seen.has(p.name) && !(test && p.type.k === 'clock'));
    if (missing.length && !test) {
      const names = missing.map((p) => `\`${p.name}\``);
      this.sink.error('unconnected-input', `${missing.length === 1 ? 'input' : 'inputs'} ${listWords(names, 'is', 'are')} not connected`, instName.span, `instance of \`${module.name}\``, {
        help: [`connect every input: ${missing.map((p) => `\`${p.name}: …\``).join(', ')}`],
      });
    }
  }

  private checkAction(item: ModuleItem, ctx: Ctx, mod: ModState): void {
    switch (item.kind) {
      case 'assign': {
        const b = ctx.scope.lookup(item.target.name);
        if (!b || b.k !== 'output') {
          const what = !b ? undefined : b.k === 'input' ? 'an input' : b.k === 'let' ? 'a `let`' : b.k === 'reg' ? 'a register' : `a ${b.k}`;
          this.sink.error('bad-assignment', b ? `cannot assign to \`${item.target.name}\`: it is ${what}` : `unknown output \`${item.target.name}\``, item.target.span, undefined, {
            help: b?.k === 'reg' ? [`registers change only at the clock edge: \`next ${item.target.name} = …\``] : b?.k === 'input' ? ['inputs are read-only'] : b ? [`\`${item.target.name}\` gets its value where it is declared`] : (() => {
              const s = suggest(item.target.name, mod.spec.outputs.map((o) => o.name));
              return s ? [`did you mean \`${s}\`?`] : [`declare it as an output: \`-> (${item.target.name}: …)\``];
            })(),
          });
          this.infer(item.value, ctx);
          return;
        }
        const value = this.checkAgainst(item.value, b.port.type, ctx);
        const prev = mod.assignSpans.get(item.target.name);
        if (prev) {
          this.sink.error('double-assignment', `output \`${item.target.name}\` is assigned twice`, item.target.span, 'second assignment', {
            secondary: [{ span: prev, label: 'first assigned here' }],
            notes: ['an output is driven by exactly one piece of logic'],
            help: ['combine the two values with `if` or `match` in a single assignment'],
          });
          return;
        }
        mod.assignSpans.set(item.target.name, item.target.span);
        mod.spec.assigns.set(item.target.name, value);
        return;
      }
      case 'next': {
        const name = item.target.name;
        const b = ctx.scope.lookup(name.name);
        if (!b || b.k !== 'reg') {
          this.sink.error('bad-next', b ? `\`${name.name}\` is not a register` : `unknown register \`${name.name}\``, name.span, undefined, {
            help: b?.k === 'output' ? [`assign an output with \`${name.name} = …\``] : b ? ['`next` gives the value of a `reg` after the clock edge'] : undefined,
          });
          this.infer(item.value, ctx);
          return;
        }
        const t = this.regType(b.e, ctx);
        if (item.target.index) {
          if (t.k !== 'array') {
            if (t.k !== 'error') this.sink.error('bad-next', `\`${name.name}\` is not an array register`, item.target.index.span, typeToString(t), {
              help: [`write \`next ${name.name} = …\` for the whole register`],
            });
            return;
          }
          const i = this.constInt(item.target.index, ctx, 'the element index of `next`');
          if (i === undefined) return;
          if (i < 0n || i >= BigInt(t.n)) {
            this.sink.error('index-out-of-range', `index ${i} is out of range for \`${name.name}\``, item.target.index.span, `the register has elements 0 to ${t.n - 1}`);
            return;
          }
          const v = this.checkAgainst(item.value, t.elem, ctx);
          b.e.nexts.push({ index: Number(i), expr: v, span: item.target.span });
        } else {
          const v = this.checkAgainst(item.value, t, ctx);
          b.e.nexts.push({ expr: v, span: item.target.span });
        }
        return;
      }
      case 'write': {
        const b = ctx.scope.lookup(item.mem.name);
        if (!b || b.k !== 'mem') {
          this.sink.error('bad-write', b ? `\`${item.mem.name}\` is not a memory` : `unknown memory \`${item.mem.name}\``, item.mem.span);
          return;
        }
        this.checkMem(b.e, mod, ctx);
        const m = b.e.spec;
        if (!m) return;
        if (item.args.length !== 3) {
          this.sink.error('bad-call', '`write` takes 3 arguments: address, data and enable', item.span, `${item.args.length} given`);
          return;
        }
        if (m.write) {
          this.sink.error('too-many-writes', `memory \`${item.mem.name}\` can have only one write port`, item.span, 'second write', {
            secondary: [{ span: m.write.span, label: 'first write here' }],
            help: ['combine the writes with `if` into a single `write`'],
          });
          return;
        }
        const addr = this.checkAgainst(item.args[0]!, bits(indexWidth(m.depth)), ctx);
        const data = this.checkAgainst(item.args[1]!, m.elem, ctx);
        const en = this.checkAgainst(item.args[2]!, BIT, ctx);
        m.write = { addr, data, en, span: item.span };
        return;
      }
    }
  }

  /** `next` coverage: every register has exactly one `next` (or one per element of an array register). */
  private finishRegs(mod: ModState): void {
    for (const e of mod.regs) {
      const r = mod.spec.regs.get(e.uniq);
      if (!r) continue;
      const name = e.item.name.name;
      e.nexts.sort((a, b) => a.span.start - b.span.start);
      const whole = e.nexts.filter((n) => n.index === undefined);
      const elems = e.nexts.filter((n) => n.index !== undefined);
      if (e.nexts.length === 0) {
        this.sink.error('missing-next', `register \`${name}\` has no \`next\` value`, e.item.name.span, 'declared here', {
          help: [`give its value after each clock edge: \`next ${name} = …\` (to hold it, \`next ${name} = ${name}\`)`],
        });
        continue;
      }
      if (whole.length > 1 || (whole.length && elems.length)) {
        const second = whole.length > 1 ? whole[1]! : elems[0]!;
        this.sink.error('double-next', `register \`${name}\` has more than one \`next\``, second.span, 'another `next`', {
          secondary: [{ span: whole[0]!.span, label: 'first `next` here' }],
          notes: ['a register has exactly one next value; an array register can instead have one per element'],
        });
        continue;
      }
      if (whole.length) {
        r.next = whole[0]!.expr;
        continue;
      }
      const t = r.type;
      if (t.k !== 'array') continue;
      const byIndex = new Map<number, { expr: TExpr; span: Span }>();
      let ok = true;
      for (const n of elems) {
        const prev = byIndex.get(n.index!);
        if (prev) {
          this.sink.error('double-next', `element ${n.index} of register \`${name}\` has more than one \`next\``, n.span, 'another `next`', {
            secondary: [{ span: prev.span, label: 'first `next` for this element' }],
          });
          ok = false;
          continue;
        }
        byIndex.set(n.index!, n);
      }
      const missing: number[] = [];
      for (let i = 0; i < t.n; i++) if (!byIndex.has(i)) missing.push(i);
      if (missing.length) {
        const ranges: string[] = [];
        for (let k = 0; k < missing.length; ) {
          let j = k;
          while (j + 1 < missing.length && missing[j + 1] === missing[j]! + 1) j++;
          if (j - k < 2) for (let x = k; x <= j; x++) ranges.push(`${missing[x]}`);
          else ranges.push(`${missing[k]} to ${missing[j]}`);
          k = j + 1;
        }
        this.sink.error('reg-array-coverage', `not every element of register \`${name}\` has a \`next\``, e.item.name.span, `${missing.length === 1 ? 'element' : 'elements'} ${listWords(ranges.slice(0, 6).concat(ranges.length > 6 ? [`${ranges.length - 6} more ranges`] : []), 'has', 'have')} no \`next\``, {
          help: [`add \`next ${name}[i] = …\` for the missing elements (\`next ${name}[i] = ${name}[i]\` holds one)`],
        });
        ok = false;
      }
      if (ok) r.elemNext = Array.from({ length: t.n }, (_, i) => byIndex.get(i)!.expr);
    }
  }

  // ------------------------------------------------------------------------- dataflow and clock domains

  private analyse(spec: ModuleSpec, mod: ModState): void {
    // Graph nodes: L:let, O:output, I:inst.port (instance output), C:inst.port (instance input), P:input.
    const depsCache = new Map<string, string[]>();
    const exprDeps = (root: TExpr): string[] => {
      const out: string[] = [];
      walkTExpr(root, (e) => {
        if (e.k !== 'ref') return;
        if (e.ref === 'let') out.push('L:' + e.name);
        else if (e.ref === 'instout') out.push('I:' + e.name);
        else if (e.ref === 'input') out.push('P:' + e.name);
      });
      return out;
    };
    const deps = (node: string): string[] => {
      const hit = depsCache.get(node);
      if (hit) return hit;
      let d: string[] = [];
      const key = node.slice(2);
      switch (node[0]) {
        case 'L': {
          const l = spec.lets.get(key);
          if (l) d = exprDeps(l.expr);
          break;
        }
        case 'O': {
          const a = spec.assigns.get(key);
          if (a) d = exprDeps(a);
          break;
        }
        case 'I': {
          const dot = key.lastIndexOf('.');
          const inst = spec.insts.get(key.slice(0, dot));
          const port = key.slice(dot + 1);
          if (inst) for (const input of inst.spec.combDeps.get(port) ?? []) if (inst.conns.has(input)) d.push(`C:${inst.name}.${input}`);
          break;
        }
        case 'C': {
          const dot = key.lastIndexOf('.');
          const inst = spec.insts.get(key.slice(0, dot));
          const c = inst?.conns.get(key.slice(dot + 1));
          if (c) d = exprDeps(c);
          break;
        }
      }
      depsCache.set(node, d);
      return d;
    };

    // Cycle detection (iterative DFS, reporting each loop once).
    const color = new Map<string, 1 | 2>();
    const inReportedCycle = new Set<string>();
    const roots = [...[...spec.lets.keys()].map((k) => 'L:' + k), ...[...spec.assigns.keys()].map((k) => 'O:' + k),
      ...[...spec.insts.values()].flatMap((i) => [...i.conns.keys()].map((p) => `C:${i.name}.${p}`))];
    for (const root of roots) {
      if (color.has(root)) continue;
      const stack: { node: string; i: number }[] = [{ node: root, i: 0 }];
      const path: string[] = [root];
      color.set(root, 1);
      while (stack.length) {
        const top = stack[stack.length - 1]!;
        const ds = deps(top.node);
        if (top.i >= ds.length) {
          color.set(top.node, 2);
          stack.pop();
          path.pop();
          continue;
        }
        const next = ds[top.i++]!;
        const c = color.get(next);
        if (c === 1) {
          const cycle = path.slice(path.indexOf(next));
          if (!cycle.some((n) => inReportedCycle.has(n))) {
            cycle.forEach((n) => inReportedCycle.add(n));
            this.reportCycle(cycle, spec);
          }
          continue;
        }
        if (c === 2) continue;
        color.set(next, 1);
        stack.push({ node: next, i: 0 });
        path.push(next);
      }
    }

    // Combinational dependencies of each output on the inputs (used by parents' loop detection).
    for (const out of spec.outputs) {
      const seen = new Set<string>();
      const inputs = new Set<string>();
      const todo = ['O:' + out.name];
      while (todo.length) {
        const n = todo.pop()!;
        if (seen.has(n)) continue;
        seen.add(n);
        if (n.startsWith('P:')) inputs.add(n.slice(2));
        else todo.push(...deps(n));
      }
      spec.combDeps.set(out.name, inputs);
    }

    this.checkDomains(spec, mod);
  }

  private displayName(node: string): string {
    const name = node.slice(2).replace(/#(-?\d+)/g, '[$1]');
    return name;
  }

  private reportCycle(cycle: string[], spec: ModuleSpec): void {
    // Start at the node declared first in the source.
    const spanOf = (n: string): Span | undefined => {
      const key = n.slice(2);
      if (n[0] === 'L') return spec.lets.get(key)?.span;
      if (n[0] === 'O') return spec.outputs.find((o) => o.name === key)?.span;
      return spec.insts.get(key.slice(0, key.lastIndexOf('.')))?.span;
    };
    let best = 0;
    cycle.forEach((n, i) => {
      const a = spanOf(n);
      const b = spanOf(cycle[best]!);
      if (a && (!b || a.start < b.start)) best = i;
    });
    const rotated = [...cycle.slice(best), ...cycle.slice(0, best)];
    // Instance inputs and outputs appear as `inst.port`; drop the input half of each crossing.
    const names: string[] = [];
    for (const n of rotated) {
      if (n[0] === 'C') continue;
      names.push(this.displayName(n));
    }
    names.push(names[0]!);
    const span = spanOf(rotated[0]!) ?? spec.decl.name.span;
    this.sink.error('comb-loop', 'combinational loop', span, names.join(' → '), {
      notes: ['a loop without a register holds state without a clock (a latch); use `reg`'],
    });
  }

  private checkDomains(spec: ModuleSpec, mod: ModState): void {
    if (spec.clocks.length < 2) return;
    // The clock domains a value comes from: the clocks of the registers and memories it reads.
    const memo = new Map<TExpr, Set<string>>();
    const letMemo = new Map<string, Set<string>>();
    const visiting = new Set<string>();
    const domainOf = (root: TExpr): Set<string> => {
      const hit = memo.get(root);
      if (hit) return hit;
      const out = new Set<string>();
      walkTExpr(root, (e) => {
        if (e.k === 'memread') {
          const m = spec.mems.get(e.mem);
          if (m) out.add(m.clock);
        }
        if (e.k !== 'ref') return;
        if (e.ref === 'reg') {
          const r = spec.regs.get(e.name);
          if (r) out.add(r.clock);
        } else if (e.ref === 'let') {
          if (visiting.has(e.name)) return;
          let d = letMemo.get(e.name);
          if (!d) {
            visiting.add(e.name);
            const l = spec.lets.get(e.name);
            d = l ? domainOf(l.expr) : new Set();
            visiting.delete(e.name);
            letMemo.set(e.name, d);
          }
          d.forEach((c) => out.add(c));
        } else if (e.ref === 'instout') {
          const inst = spec.insts.get(e.name.slice(0, e.name.lastIndexOf('.')));
          if (!inst) return;
          for (const c of inst.clocks.values()) out.add(c);
          if (inst.spec.name !== STD_SYNCHRONIZER) for (const v of inst.conns.values()) domainOf(v).forEach((c) => out.add(c));
        }
      });
      memo.set(root, out);
      return out;
    };
    const check = (value: TExpr, clock: string, what: string, span: Span) => {
      const foreign = [...domainOf(value)].filter((c) => c !== clock && c !== '');
      if (!foreign.length) return;
      this.sink.error('clock-domain', `${what} is clocked by \`${clock}\` but reads a value clocked by ${foreign.map((c) => `\`${c}\``).join(' and ')}`, span, 'crosses clock domains', {
        notes: ['a value from another clock domain can change just before the clock edge and make a flip-flop metastable'],
        help: [`pass it through the standard library's \`Synchronizer\` (clocked by \`${clock}\`) first`],
      });
    };
    for (const r of spec.regs.values()) {
      for (const n of [r.next, ...(r.elemNext ?? [])]) if (n) check(n, r.clock, `register \`${this.displayName('R:' + r.name)}\``, r.span);
    }
    for (const m of spec.mems.values()) {
      if (m.write) for (const v of [m.write.addr, m.write.data, m.write.en]) check(v, m.clock, `memory \`${m.name}\``, m.write.span);
      for (const rd of m.reads) check(rd.addr, m.clock, `memory \`${m.name}\``, rd.span);
    }
    for (const inst of spec.insts.values()) {
      if (inst.spec.name === STD_SYNCHRONIZER || inst.clocks.size !== 1) continue;
      const clock = [...inst.clocks.values()][0]!;
      for (const [port, v] of inst.conns) check(v, clock, `input \`${port}\` of \`${inst.name}\``, v.span);
    }
    void mod;
  }

  // ------------------------------------------------------------------------------------ functions

  private checkFnStandalone(fn: FnDecl): void {
    const scope = new Scope(null);
    const ctx: Ctx = { scope, mod: null, test: false, fnStack: [fn.name.name], file: fn.span.file };
    const params: Type[] = [];
    for (const p of fn.params) {
      const t = this.resolveType(p.type, ctx);
      params.push(t);
      if (t.k === 'clock') this.sink.error('clock-misuse', 'a function parameter cannot be a clock', p.type.span, undefined, { notes: ['functions are combinational logic; clocks can only be passed through module ports'] });
      this.bind(scope, p.name, { k: 'value', value: { k: 'ref', ref: 'input', name: p.name.name, t, span: p.name.span }, span: p.name.span });
    }
    const ret = this.resolveType(fn.ret, ctx);
    this.checkAgainst(fn.body, ret, ctx);
  }

  private callFn(fn: FnDecl, call: Extract<Expr, { kind: 'call' }>, ctx: Ctx): TExpr {
    if (ctx.fnStack.includes(fn.name.name)) {
      return this.err('recursive-fn', `function \`${fn.name.name}\` calls itself`, call.callee.span, 'recursive call', {
        notes: ['functions are inlined into hardware, so they cannot be recursive'],
      });
    }
    if (call.args.length !== fn.params.length) {
      return this.err('bad-call', `\`${fn.name.name}\` takes ${fn.params.length} argument${fn.params.length === 1 ? '' : 's'}`, call.span, `${call.args.length} given`);
    }
    const scope = new Scope(null);
    const fctx: Ctx = { scope, mod: null, test: ctx.test, fnStack: [...ctx.fnStack, fn.name.name], file: fn.span.file };
    // Infer generic parameters from arguments whose parameter type is `bits<G>` or `signed<G>`.
    const genericNames = new Set(fn.generics.map((g) => g.name.name));
    const inferred = new Map<string, bigint>();
    const args: (TExpr | undefined)[] = [];
    fn.params.forEach((p, i) => {
      const t = p.type;
      if (t.kind === 'named' && (t.name.name === 'bits' || t.name.name === 'signed') && t.args.length === 1 && t.args[0]!.kind === 'name' && genericNames.has(t.args[0]!.name)) {
        const a = this.infer(call.args[i]!, ctx);
        args[i] = a;
        if (a.t.k === 'bits') inferred.set(t.args[0]!.name, BigInt(a.t.w));
        else if (a.t.k !== 'error') args[i] = this.noContext(call.args[i]!, 'give the argument a width, as in `bits<8>(1)`');
      }
    });
    for (const g of fn.generics) {
      const v = inferred.get(g.name.name);
      if (v === undefined) {
        return this.err('cannot-infer', `cannot infer the generic parameter \`${g.name.name}\` of \`${fn.name.name}\``, call.callee.span, undefined, {
          help: [`use \`${g.name.name}\` as the width of a parameter, as in \`x: bits<${g.name.name}>\``],
        });
      }
      scope.map.set(g.name.name, { b: { k: 'value', value: { k: 'const', v, t: INT, span: g.name.span }, span: g.name.span }, span: g.name.span });
    }
    fn.params.forEach((p, i) => {
      const t = this.resolveType(p.type, fctx);
      const arg = args[i] ? this.coerce(args[i]!, t, call.args[i]!, ctx) : this.checkAgainst(call.args[i]!, t, ctx);
      scope.map.set(p.name.name, { b: { k: 'value', value: arg, span: p.name.span }, span: p.name.span });
    });
    const ret = this.resolveType(fn.ret, fctx);
    const saved = this.currentFile;
    const body = this.checkAgainst(fn.body, ret, fctx);
    this.currentFile = saved;
    return body;
  }

  // ------------------------------------------------------------------------------------ expressions

  private noContext(e: Expr, help?: string): TExpr {
    return this.err('literal-no-context', 'this literal has no type', e.span, 'its width cannot be inferred from the context', {
      help: [help ?? 'give it a type: `bits<N>(value)`, or declare a `const` with a type'],
    });
  }

  /** Converts an inferred expression to type `t`, or reports why it cannot. */
  private coerce(te: TExpr, t: Type, e: Expr, ctx: Ctx): TExpr {
    if (te.t.k === 'error' || t.k === 'error') return te.t.k === 'error' ? te : { ...te, t: ERROR };
    if (te.t.k === 'lit') return this.checkAgainst(e, t, ctx);
    if (te.t.k === 'int') {
      if (t.k === 'int') return te;
      if (te.k !== 'const') {
        if (t.k !== 'bits') return this.err('type-mismatch', 'type mismatch', e.span, `int, expected ${typeToString(t)}`);
        return { k: 'intcast', a: te, t, span: e.span };
      }
      return this.literal(te.v, t, e);
    }
    if (typeEq(te.t, t)) return te;
    return this.mismatch(te.t, t, e);
  }

  private mismatch(actual: Type, expected: Type, e: Expr): TExpr {
    const text = this.text(e.span);
    if (actual.k === 'bits' && expected.k === 'bits') {
      if (actual.w !== expected.w) {
        const help =
          actual.w < expected.w
            ? actual.w === 1 && !actual.signed
              ? `extend it explicitly: zext(${text}, ${expected.w})`
              : `extend it explicitly: sext(${text}, ${expected.w}) or zext(${text}, ${expected.w})`
            : `truncate it explicitly: trunc(${text}, ${expected.w}) or ${text}[${expected.w - 1}:0]`;
        return this.err('width-mismatch', 'width mismatch', e.span, `${typeToString(actual)}, expected ${typeToString(expected)}`, { help: [help] });
      }
      return this.err('type-mismatch', 'type mismatch', e.span, `${typeToString(actual)}, expected ${typeToString(expected)}`, {
        help: [`convert it explicitly: ${expected.signed ? 'signed' : 'bits'}(${text})`],
      });
    }
    if (actual.k === 'clock') return this.clockMisuse(e);
    return this.err('type-mismatch', 'type mismatch', e.span, `${typeToString(actual)}, expected ${typeToString(expected)}`);
  }

  private clockMisuse(e: Expr): TExpr {
    return this.err('clock-misuse', 'a clock cannot be used as data', e.span, 'this is a clock', {
      notes: ['clocks can only be passed through ports, so a gated clock is impossible to write'],
      help: ['use an enable signal instead'],
    });
  }

  /** A literal value of type t (checking that it fits). */
  private literal(v: bigint, t: Type, e: Expr): TExpr {
    if (t.k === 'int') return { k: 'const', v, t, span: e.span };
    if (t.k !== 'bits') {
      if (t.k === 'error') return this.errT(e.span);
      return this.err('type-mismatch', 'type mismatch', e.span, `a number, expected ${typeToString(t)}`, {
        help: t.k === 'enum' ? [`use a variant, such as \`${t.name}.${t.variants[0]}\``] : undefined,
      });
    }
    const w = BigInt(t.w);
    const ok = t.signed ? v >= -(1n << (w - 1n)) && v < 1n << w : v >= 0n && v < 1n << w;
    if (!ok) {
      const need = v < 0n ? 'a negative number is not a bit pattern' : `${v} needs ${bitsNeeded(v)} bits`;
      return this.err('literal-too-wide', `literal does not fit \`${typeToString(t)}\``, e.span, need, {
        help: v < 0n ? ['use a `signed<N>` type, or subtract from zero: `0 - x`'] : [`use a wider type, or a value below ${1n << w}`],
      });
    }
    return { k: 'const', v: v & mask(t.w), t, span: e.span };
  }

  /** Checks e against an expected type, pushing the type into literals. */
  checkAgainst(e: Expr, t: Type, ctx: Ctx): TExpr {
    if (t.k === 'error') {
      this.infer(e, ctx);
      return this.errT(e.span);
    }
    if (t.k === 'int') {
      const te = this.infer(e, ctx);
      if (te.t.k === 'int' || te.t.k === 'error') return te;
      if (te.t.k === 'lit') return this.err('not-constant', 'expected a compile-time integer', e.span);
      return this.err('type-mismatch', 'expected a compile-time integer', e.span, typeToString(te.t));
    }
    // A compile-time integer expression (`WIDTH - 1`) is evaluated first, then checked to fit as a whole.
    if ((e.kind === 'binary' || e.kind === 'unary' || e.kind === 'paren') && this.constCandidate(e, ctx)) {
      const te = this.infer(e, ctx);
      if (te.t.k === 'int' && te.k === 'const') return this.literal(te.v, t, e);
      if (te.t.k === 'error') return te;
      if (te.t.k !== 'lit' && te.t.k !== 'int') return this.coerce(te, t, e, ctx);
    }
    switch (e.kind) {
      case 'number':
        return this.literal(e.value, t, e);
      case 'paren':
      case 'block':
        return this.checkAgainst(e.inner, t, ctx);
      case 'if': {
        const c = this.condition(e.cond, ctx);
        const a = this.checkAgainst(e.then, t, ctx);
        const b = this.checkAgainst(e.else, t, ctx);
        return fold({ k: 'mux', c, a, b, t, span: e.span });
      }
      case 'match':
        return this.matchExpr(e, t, ctx);
      case 'binary':
        if (ARITH.has(e.op)) {
          if (t.k !== 'bits') break;
          const a = this.checkAgainst(e.left, t, ctx);
          const b = this.checkAgainst(e.right, t, ctx);
          return this.arith(e, a, b);
        }
        if (e.op === '<<' || e.op === '>>') {
          if (t.k !== 'bits') break;
          const a = this.checkAgainst(e.left, t, ctx);
          const b = this.shiftAmount(e.right, ctx);
          return fold({ k: 'bin', op: BIN_OPS[e.op]!, a, b, t: a.t.k === 'error' || b.t.k === 'error' ? ERROR : t, span: e.span });
        }
        break;
      case 'unary':
        if (e.op === '~' || e.op === '-') {
          if (t.k !== 'bits') break;
          const a = this.checkAgainst(e.operand, t, ctx);
          return fold({ k: 'un', op: e.op === '~' ? 'not' : 'neg', a, t: a.t.k === 'error' ? ERROR : t, span: e.span });
        }
        break;
      case 'array': {
        if (t.k !== 'array') break;
        if (e.elems.length !== t.n) {
          return this.err('type-mismatch', 'wrong number of elements', e.span, `${e.elems.length} elements, expected ${t.n}`);
        }
        const elems = e.elems.map((x) => this.checkAgainst(x, t.elem, ctx));
        return fold({ k: 'array', elems, t, span: e.span });
      }
      case 'repeat': {
        if (t.k !== 'array') break;
        const n = this.constInt(e.count, ctx, 'an array length');
        if (n === undefined) return this.errT(e.span);
        if (n !== BigInt(t.n)) return this.err('type-mismatch', 'wrong number of elements', e.count.span, `${n} elements, expected ${t.n}`);
        const v = this.checkAgainst(e.value, t.elem, ctx);
        return fold({ k: 'array', elems: new Array<TExpr>(t.n).fill(v), t, span: e.span });
      }
    }
    const te = this.infer(e, ctx);
    return this.coerce(te, t, e, ctx);
  }

  /** Whether an expression is built only from literals, constants, generic parameters and loop variables. */
  private constCandidate(e: Expr, ctx: Ctx): boolean {
    switch (e.kind) {
      case 'number':
        return true;
      case 'paren':
      case 'block':
        return this.constCandidate(e.inner, ctx);
      case 'unary':
        return this.constCandidate(e.operand, ctx);
      case 'binary':
        return this.constCandidate(e.left, ctx) && this.constCandidate(e.right, ctx);
      case 'call':
        return e.callee.name === 'clog2' && !ctx.scope.lookup('clog2');
      case 'name': {
        const b = ctx.scope.lookup(e.name);
        if (b) return b.k === 'const' || (b.k === 'value' && b.value.k === 'const');
        return this.globals.get(e.name)?.item.kind === 'const';
      }
      default:
        return false;
    }
  }

  private arith(e: Extract<Expr, { kind: 'binary' }>, a: TExpr, b: TExpr): TExpr {
    if (a.t.k === 'error' || b.t.k === 'error') return this.errT(e.span);
    const t = a.t;
    if (t.k !== 'bits' && t.k !== 'int') {
      return this.err('bad-operand', `\`${e.op}\` needs bits operands`, e.left.span, typeToString(t), {
        help: t.k === 'enum' ? ['only `==`, `!=` and `match` apply to enums'] : undefined,
      });
    }
    return fold({ k: 'bin', op: BIN_OPS[e.op]!, a, b, t, span: e.span });
  }

  private condition(e: Expr, ctx: Ctx): TExpr {
    const te = this.infer(e, ctx);
    if (te.t.k === 'error') return te;
    if (te.t.k === 'bits' && te.t.w === 1 && !te.t.signed) return te;
    if (isUntyped(te.t)) return this.coerce(te, BIT, e, ctx);
    return this.err('bad-condition', 'a condition must be a `bit`', e.span, typeToString(te.t), {
      help: te.t.k === 'bits' ? [`compare it explicitly, for example \`${this.text(e.span)} != 0\``] : undefined,
    });
  }

  private shiftAmount(e: Expr, ctx: Ctx): TExpr {
    const te = this.infer(e, ctx);
    if (te.t.k === 'error') return te;
    if (te.t.k === 'int' && te.k === 'const') {
      if (te.v < 0n) return this.err('bad-operand', 'a shift amount cannot be negative', e.span);
      return { k: 'const', v: te.v, t: bits(bitsNeeded(te.v)), span: e.span };
    }
    if (te.t.k === 'int') return { k: 'intcast', a: te, t: bits(32), span: e.span };
    if (te.t.k === 'lit') return this.noContext(e);
    if (te.t.k !== 'bits') return this.err('bad-operand', 'a shift amount must be `bits<M>`', e.span, typeToString(te.t));
    return te;
  }

  private logicOperand(e: Expr, op: string, ctx: Ctx): TExpr {
    const te = this.infer(e, ctx);
    if (te.t.k === 'error') return te;
    if (isUntyped(te.t)) return this.coerce(te, BIT, e, ctx);
    if (isBit(te.t)) return te;
    if (te.t.k === 'clock') return this.clockMisuse(e);
    return this.err('bad-operand', `\`${op}\` needs \`bit\` operands`, e.span, typeToString(te.t), {
      help: te.t.k === 'bits'
        ? op === '!'
          ? ['use `~` for a bitwise not, or compare explicitly: `x == 0`']
          : [`compare explicitly (\`${this.text(e.span)} != 0\`), or use \`${op[0]}\` for a bitwise operation`]
        : undefined,
    });
  }

  /** Infers the type of an expression bottom-up. */
  infer(e: Expr, ctx: Ctx): TExpr {
    switch (e.kind) {
      case 'number':
        return { k: 'const', v: e.value, t: INT, span: e.span };
      case 'string':
        return this.err('bad-expression', 'strings are allowed only in `print`', e.span);
      case 'error':
        return this.errT(e.span);
      case 'paren':
      case 'block': {
        const inner = this.infer(e.inner, ctx);
        return inner;
      }
      case 'name':
        return this.name(e, ctx);
      case 'unary': {
        if (e.op === '!') {
          const a = this.logicOperand(e.operand, '!', ctx);
          if (a.t.k === 'error') return a;
          return fold({ k: 'un', op: 'not', a, t: BIT, span: e.span });
        }
        const a = this.infer(e.operand, ctx);
        if (a.t.k === 'error') return a;
        if (a.t.k === 'int') {
          // `~` needs a width, so `~0` waits for its context.
          if (a.k === 'const') return e.op === '-' ? { k: 'const', v: -a.v, t: INT, span: e.span } : { k: 'const', v: 0n, t: LIT, span: e.span };
          return { k: 'un', op: e.op === '-' ? 'neg' : 'not', a, t: INT, span: e.span };
        }
        if (a.t.k === 'lit') return { k: 'const', v: 0n, t: LIT, span: e.span };
        if (a.t.k !== 'bits') {
          if (a.t.k === 'clock') return this.clockMisuse(e.operand);
          return this.err('bad-operand', `\`${e.op}\` needs a bits operand`, e.operand.span, typeToString(a.t));
        }
        return fold({ k: 'un', op: e.op === '~' ? 'not' : 'neg', a, t: a.t, span: e.span });
      }
      case 'binary':
        return this.binary(e, ctx);
      case 'if': {
        const c = this.condition(e.cond, ctx);
        const a = this.infer(e.then, ctx);
        const b = this.infer(e.else, ctx);
        if (a.t.k === 'error' || b.t.k === 'error') return this.errT(e.span);
        if (!isUntyped(a.t)) {
          const b2 = this.coerce(b, a.t, e.else, ctx);
          return fold({ k: 'mux', c, a, b: b2, t: a.t, span: e.span });
        }
        if (!isUntyped(b.t)) {
          const a2 = this.coerce(a, b.t, e.then, ctx);
          return fold({ k: 'mux', c, a: a2, b, t: b.t, span: e.span });
        }
        if (c.k === 'const' && a.k === 'const' && b.k === 'const' && a.t.k === 'int' && b.t.k === 'int') {
          return { k: 'const', v: c.v ? a.v : b.v, t: INT, span: e.span };
        }
        return { k: 'const', v: 0n, t: LIT, span: e.span };
      }
      case 'match':
        return this.matchExpr(e, undefined, ctx);
      case 'call':
        return this.call(e, ctx);
      case 'method':
        return this.method(e, ctx);
      case 'field':
        return this.field(e, ctx);
      case 'index':
        return this.index(e, ctx);
      case 'slice': {
        const a = this.infer(e.target, ctx);
        if (a.t.k === 'error') return a;
        if (a.t.k !== 'bits') {
          if (isUntyped(a.t)) return this.noContext(e.target);
          return this.err('bad-operand', 'only bit vectors can be sliced', e.target.span, typeToString(a.t));
        }
        const hi = this.constInt(e.hi, ctx, 'a slice bound');
        const lo = this.constInt(e.lo, ctx, 'a slice bound');
        if (hi === undefined || lo === undefined) return this.errT(e.span);
        if (lo < 0n || hi >= BigInt(a.t.w) || hi < lo) {
          return this.err('bad-slice', hi < lo ? 'the slice bounds are reversed' : 'slice out of range', e.span, hi < lo ? `write [${lo}:${hi}]` : `${typeToString(a.t)} has bits ${a.t.w - 1} to 0`);
        }
        return fold({ k: 'slice', a, lo: Number(lo), t: bits(Number(hi - lo + 1n)), span: e.span });
      }
      case 'array': {
        if (!e.elems.length) return this.err('bad-expression', 'an array cannot be empty', e.span);
        const elems = e.elems.map((x) => this.infer(x, ctx));
        const typed = elems.find((x) => !isUntyped(x.t) && x.t.k !== 'error');
        if (elems.some((x) => x.t.k === 'error')) return this.errT(e.span);
        if (!typed) return { k: 'const', v: 0n, t: LIT, span: e.span };
        const coerced = elems.map((x, i) => this.coerce(x, typed.t, e.elems[i]!, ctx));
        return fold({ k: 'array', elems: coerced, t: { k: 'array', elem: typed.t, n: elems.length }, span: e.span });
      }
      case 'repeat': {
        const v = this.infer(e.value, ctx);
        const n = this.constInt(e.count, ctx, 'an array length');
        if (v.t.k === 'error' || n === undefined) return this.errT(e.span);
        if (n < 1n) return this.err('bad-size', 'an array needs at least one element', e.count.span);
        if (isUntyped(v.t)) return { k: 'const', v: 0n, t: LIT, span: e.span };
        return fold({ k: 'array', elems: new Array<TExpr>(Number(n)).fill(v), t: { k: 'array', elem: v.t, n: Number(n) }, span: e.span });
      }
      case 'struct':
        return this.structLit(e, ctx);
      case 'typed': {
        const t = this.resolveType(e.type, ctx);
        if (t.k === 'error') return this.errT(e.span);
        if (t.k !== 'bits') return this.err('bad-type', 'only `bits<N>` and `signed<N>` can be used as typed literals', e.type.span);
        const a = this.infer(e.arg, ctx);
        if (a.t.k === 'error') return a;
        if (isUntyped(a.t)) return this.coerce(a, t, e.arg, ctx);
        if (a.t.k === 'bits' && a.t.w === t.w) return a.t.signed === t.signed ? a : fold({ k: 'cast', a, t, span: e.span });
        return this.mismatch(a.t, t, e.arg);
      }
      case 'type':
        return this.err('bad-expression', 'a type is not a value', e.span, undefined, { help: ['types are used as arguments of `random(…)` only'] });
      case 'sim':
        return this.err('bad-expression', '`sim` can only be used in a test, as `let x = sim M(…)`', e.span);
    }
  }

  private binary(e: Extract<Expr, { kind: 'binary' }>, ctx: Ctx): TExpr {
    const op = e.op;
    if (op === '&&' || op === '||') {
      const a = this.logicOperand(e.left, op, ctx);
      const b = this.logicOperand(e.right, op, ctx);
      if (a.t.k === 'error' || b.t.k === 'error') return this.errT(e.span);
      return fold({ k: 'bin', op: op === '&&' ? 'and' : 'or', a, b, t: BIT, span: e.span });
    }
    if (op === '<<' || op === '>>') {
      const a = this.infer(e.left, ctx);
      if (a.t.k === 'error') return a;
      if (a.t.k === 'clock') return this.clockMisuse(e.left);
      if (a.t.k === 'int' && a.k === 'const') {
        const b = this.infer(e.right, ctx);
        if (b.k === 'const' && b.t.k === 'int') return { k: 'const', v: op === '<<' ? a.v << b.v : a.v >> b.v, t: INT, span: e.span };
        if (b.t.k === 'error') return b;
        this.shiftAmount(e.right, ctx);
        return { k: 'const', v: 0n, t: LIT, span: e.span };
      }
      if (a.t.k === 'lit') {
        this.shiftAmount(e.right, ctx);
        return { k: 'const', v: 0n, t: LIT, span: e.span };
      }
      if (a.t.k === 'int') {
        const b = this.infer(e.right, ctx);
        if (b.t.k !== 'int') return this.err('bad-operand', 'shifting a run-time integer needs an integer amount', e.right.span);
        return { k: 'bin', op: BIN_OPS[op]!, a, b, t: INT, span: e.span };
      }
      if (a.t.k !== 'bits') return this.err('bad-operand', `\`${op}\` needs a bits operand`, e.left.span, typeToString(a.t));
      const b = this.shiftAmount(e.right, ctx);
      if (b.t.k === 'error') return this.errT(e.span);
      return fold({ k: 'bin', op: BIN_OPS[op]!, a, b, t: a.t, span: e.span });
    }
    const a = this.infer(e.left, ctx);
    const b = this.infer(e.right, ctx);
    if (a.t.k === 'error' || b.t.k === 'error') return this.errT(e.span);
    if (a.t.k === 'clock') return this.clockMisuse(e.left);
    if (b.t.k === 'clock') return this.clockMisuse(e.right);
    let l = a;
    let r = b;
    if (!isUntyped(a.t)) r = this.coerce(b, a.t, e.right, ctx);
    else if (!isUntyped(b.t)) l = this.coerce(a, b.t, e.left, ctx);
    if (l.t.k === 'error' || r.t.k === 'error') return this.errT(e.span);
    const bothUntyped = isUntyped(l.t) && isUntyped(r.t);
    if (COMPARE.has(op)) {
      if (bothUntyped) {
        if (l.t.k === 'int' && r.t.k === 'int' && !(e.left.kind === 'number' && e.right.kind === 'number')) {
          if (l.k === 'const' && r.k === 'const') return { k: 'const', v: this.cmp(op, l.v, r.v), t: BIT, span: e.span };
          return { k: 'bin', op: BIN_OPS[op]!, a: l, b: r, t: BIT, span: e.span };
        }
        return this.noContext(e.left.kind === 'number' ? e.left : e.right, 'give one side a type: `bits<N>(value)`, or compare with a typed signal');
      }
      const t = l.t;
      if (t.k === 'enum' && op !== '==' && op !== '!=') {
        return this.err('bad-operand', `\`${op}\` does not apply to enums`, e.opSpan, undefined, { help: ['only `==`, `!=` and `match` apply to enums'] });
      }
      if ((t.k === 'array' || t.k === 'struct') && op !== '==' && op !== '!=') {
        return this.err('bad-operand', `\`${op}\` does not apply to ${t.k === 'array' ? 'arrays' : 'structs'}`, e.opSpan);
      }
      return fold({ k: 'bin', op: BIN_OPS[op]!, a: l, b: r, t: BIT, span: e.span });
    }
    // Arithmetic and bitwise operators.
    if (bothUntyped) {
      if (l.t.k === 'int' && r.t.k === 'int') {
        if (l.k === 'const' && r.k === 'const') return fold({ k: 'bin', op: BIN_OPS[op]!, a: l, b: r, t: INT, span: e.span });
        return { k: 'bin', op: BIN_OPS[op]!, a: l, b: r, t: INT, span: e.span };
      }
      return { k: 'const', v: 0n, t: LIT, span: e.span };
    }
    return this.arith(e, l, r);
  }

  private cmp(op: string, a: bigint, b: bigint): bigint {
    const r = op === '==' ? a === b : op === '!=' ? a !== b : op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
    return r ? 1n : 0n;
  }

  private name(e: Extract<Expr, { kind: 'name' }>, ctx: Ctx): TExpr {
    const b = ctx.scope.lookup(e.name);
    if (b) return this.bindingValue(b, e, ctx);
    const g = this.global(e.name);
    if (g) {
      if (g.item.kind === 'const') return { ...this.ensureConst(this.globalConsts.get(e.name)!), span: e.span };
      const what = g.item.kind === 'module' ? 'a module' : g.item.kind === 'fn' ? 'a function' : 'a type';
      return this.err('bad-expression', `\`${e.name}\` is ${what}, not a value`, e.span, undefined, {
        help: g.item.kind === 'enum' ? [`use a variant: \`${e.name}.${(g.item as EnumDecl).variants[0]?.name ?? 'A'}\``] : g.item.kind === 'fn' ? [`call it: \`${e.name}(…)\``] : undefined,
      });
    }
    if (e.name === '_') return this.err('bad-expression', '`_` is allowed only as a match pattern', e.span);
    const s = suggest(e.name, [...ctx.scope.names(), ...[...this.globals.keys()].filter((k) => this.globals.get(k)!.item.kind === 'const')]);
    return this.err('unknown-name', `unknown name \`${e.name}\``, e.span, 'not declared', { help: s ? [`did you mean \`${s}\`?`] : undefined });
  }

  private bindingValue(b: Binding, e: Extract<Expr, { kind: 'name' }>, ctx: Ctx): TExpr {
    switch (b.k) {
      case 'input':
        if (b.port.type.k === 'clock') return this.clockMisuse(e);
        return { k: 'ref', ref: 'input', name: b.port.name, t: b.port.type, span: e.span };
      case 'output':
        return this.err('read-output', `cannot read the output \`${e.name}\``, e.span, 'outputs are write-only inside the module', {
          help: [`compute the value in a \`let\` and assign both: \`let v = …\` then \`${e.name} = v\``],
        });
      case 'let': {
        const { type } = this.ensureLet(b.e, ctx.mod ? ctx : { ...ctx });
        return { k: 'ref', ref: 'let', name: b.e.uniq, t: type, span: e.span };
      }
      case 'const':
        return { ...this.ensureConst(b.e), span: e.span };
      case 'reg':
        return { k: 'ref', ref: 'reg', name: b.e.uniq, t: this.regType(b.e, ctx), span: e.span };
      case 'mem':
        return this.err('bad-expression', `\`${e.name}\` is a memory`, e.span, undefined, { help: [`read it with \`${e.name}.read(address)\``] });
      case 'inst':
        return this.err('bad-expression', `\`${e.name}\` is an instance`, e.span, undefined, { help: [`read one of its outputs: \`${e.name}.port\``] });
      case 'value':
        // Keep non-constant values (inlined arguments) shared, so they become hardware once.
        return b.value.k === 'const' ? { ...b.value, span: e.span } : b.value;
      case 'testvar':
        return { k: 'ref', ref: 'testvar', name: b.name, t: b.type, span: e.span };
      case 'sim':
        return this.err('bad-expression', `\`${e.name}\` is a simulated instance`, e.span, undefined, { help: [`read one of its ports: \`${e.name}.port\``] });
    }
  }

  private field(e: Extract<Expr, { kind: 'field' }>, ctx: Ctx): TExpr {
    const f = e.field.name;
    if (e.target.kind === 'name') {
      const b = ctx.scope.lookup(e.target.name);
      if (b?.k === 'inst') {
        const inst = this.ensureInst(b.e, ctx);
        if (!inst) return this.errT(e.span);
        const out = inst.spec.outputs.find((o) => o.name === f);
        if (!out) {
          const isIn = inst.spec.inputs.some((i) => i.name === f);
          const s = suggest(f, inst.spec.outputs.map((o) => o.name));
          return this.err('unknown-port', isIn ? `\`${f}\` is an input of \`${inst.spec.name}\`` : `\`${inst.spec.name}\` has no output \`${f}\``, e.field.span, undefined, {
            help: isIn ? ['only outputs of an instance can be read'] : s ? [`did you mean \`${s}\`?`] : undefined,
          });
        }
        return { k: 'ref', ref: 'instout', name: `${inst.name}.${f}`, t: out.type, span: e.span };
      }
      if (b?.k === 'sim') {
        const port = [...b.spec.inputs, ...b.spec.outputs].find((p) => p.name === f);
        if (!port) {
          const s = suggest(f, [...b.spec.inputs, ...b.spec.outputs].map((p) => p.name));
          return this.err('unknown-port', `\`${b.spec.name}\` has no port \`${f}\``, e.field.span, undefined, { help: s ? [`did you mean \`${s}\`?`] : undefined });
        }
        if (port.type.k === 'clock') return this.err('clock-misuse', 'a clock cannot be read', e.span, undefined, { help: ['use `step` to pulse it'] });
        return { k: 'ref', ref: 'simport', name: `${b.name}.${f}`, t: port.type, span: e.span };
      }
      if (!b) {
        const t = this.namedType(e.target.name, e.target.span);
        if (t && t.k === 'enum') {
          const i = t.variants.indexOf(f);
          if (i < 0) {
            const s = suggest(f, t.variants);
            return this.err('unknown-variant', `\`${t.name}\` has no variant \`${f}\``, e.field.span, undefined, { help: s ? [`did you mean \`${t.name}.${s}\`?`] : [`the variants are ${t.variants.join(', ')}`] });
          }
          return { k: 'const', v: t.codes[i]!, t, span: e.span };
        }
      }
    }
    const a = this.infer(e.target, ctx);
    if (a.t.k === 'error') return a;
    if (a.t.k !== 'struct') return this.err('bad-field', `\`${this.text(e.target.span)}\` has no fields`, e.field.span, typeToString(a.t));
    let lo = widthOf(a.t);
    for (const fd of a.t.fields) {
      lo -= widthOf(fd.type);
      if (fd.name === f) return fold({ k: 'slice', a, lo, t: fd.type, span: e.span });
    }
    const s = suggest(f, a.t.fields.map((x) => x.name));
    return this.err('bad-field', `\`${a.t.name}\` has no field \`${f}\``, e.field.span, undefined, { help: s ? [`did you mean \`${s}\`?`] : undefined });
  }

  private index(e: Extract<Expr, { kind: 'index' }>, ctx: Ctx): TExpr {
    const a = this.infer(e.target, ctx);
    if (a.t.k === 'error') return a;
    const n = a.t.k === 'array' ? a.t.n : a.t.k === 'bits' ? a.t.w : 0;
    if (!n) {
      if (isUntyped(a.t)) return this.noContext(e.target);
      return this.err('bad-operand', `\`${this.text(e.target.span)}\` cannot be indexed`, e.target.span, typeToString(a.t));
    }
    const i = this.infer(e.index, ctx);
    if (i.t.k === 'error') return this.errT(e.span);
    const elemT: Type = a.t.k === 'array' ? a.t.elem : BIT;
    const iw = indexWidth(n);
    if (i.k === 'const' && (i.t.k === 'int' || i.t.k === 'bits')) {
      if (i.v < 0n || i.v >= BigInt(n)) {
        return this.err('index-out-of-range', `index ${i.v} is out of range`, e.index.span, `${typeToString(a.t)} has ${a.t.k === 'array' ? 'elements' : 'bits'} 0 to ${n - 1}`);
      }
      if (a.t.k === 'array') return fold({ k: 'elem', a, i: Number(i.v), t: elemT, span: e.span });
      return fold({ k: 'slice', a, lo: Number(i.v), t: BIT, span: e.span });
    }
    if (i.t.k === 'int' && ctx.test) {
      const ic: TExpr = { k: 'intcast', a: i, t: bits(iw), span: e.index.span };
      return a.t.k === 'array' ? { k: 'index', a, i: ic, t: elemT, span: e.span } : { k: 'bitidx', a, i: ic, t: BIT, span: e.span };
    }
    if (i.t.k === 'lit') return this.noContext(e.index);
    if (i.t.k !== 'bits' || i.t.signed || i.t.w !== iw) {
      const label = `${typeToString(i.t)}, expected bits<${iw}>`;
      const help =
        i.t.k === 'bits' && !i.t.signed
          ? i.t.w < iw
            ? `extend it explicitly: zext(${this.text(e.index.span)}, ${iw})`
            : `use the low bits: ${this.text(e.index.span)}[${iw - 1}:0]`
          : `use a \`bits<${iw}>\` value`;
      return this.err('index-width', `a dynamic index into ${n} ${a.t.k === 'array' ? 'elements' : 'bits'} must have type \`bits<${iw}>\``, e.index.span, label, {
        help: [help],
        notes: ['a dynamic index becomes a multiplexer with one select line per index bit'],
      });
    }
    if (a.t.k === 'array') return { k: 'index', a, i, t: elemT, span: e.span };
    return { k: 'bitidx', a, i, t: BIT, span: e.span };
  }

  private method(e: Extract<Expr, { kind: 'method' }>, ctx: Ctx): TExpr {
    const m = e.method.name;
    if (e.target.kind === 'name') {
      const b = ctx.scope.lookup(e.target.name);
      if (b?.k === 'mem') {
        if (ctx.mod) this.checkMem(b.e, ctx.mod, ctx);
        const spec = b.e.spec;
        if (m === 'write') return this.err('bad-expression', '`write` is a statement, not a value', e.span, undefined, { help: [`write it on its own line: \`${e.target.name}.write(address, data, enable)\``] });
        if (m !== 'read') return this.err('bad-call', `memories have \`read\` and \`write\`, not \`${m}\``, e.method.span);
        if (!spec) return this.errT(e.span);
        if (e.args.length !== 1) return this.err('bad-call', '`read` takes one argument: the address', e.span, `${e.args.length} given`);
        const addr = this.checkAgainst(e.args[0]!, bits(indexWidth(spec.depth)), ctx);
        if (spec.reads.length >= 2) {
          return this.err('too-many-reads', `memory \`${e.target.name}\` has at most two read ports`, e.span, 'third read', {
            secondary: spec.reads.map((r, i) => ({ span: r.span, label: `read port ${i}` })),
            help: ['read into a `let` once and reuse the value'],
          });
        }
        const port = spec.reads.length;
        spec.reads.push({ addr, span: e.span });
        return { k: 'memread', mem: spec.name, port, addr, t: spec.elem, span: e.span };
      }
    }
    this.infer(e.target, ctx);
    return this.err('bad-call', `unknown method \`${m}\``, e.method.span, undefined, { help: ['only memories have methods: `m.read(address)` and `m.write(address, data, enable)`'] });
  }

  private structLit(e: Extract<Expr, { kind: 'struct' }>, ctx: Ctx): TExpr {
    const t = this.namedType(e.name.name, e.name.span);
    if (!t || t.k !== 'struct') {
      return this.err('unknown-type', t ? `\`${e.name.name}\` is not a struct` : `unknown struct \`${e.name.name}\``, e.name.span);
    }
    const values = new Map<string, TExpr>();
    for (const f of e.fields) {
      const fd = t.fields.find((x) => x.name === f.name.name);
      if (!fd) {
        this.sink.error('bad-field', `\`${t.name}\` has no field \`${f.name.name}\``, f.name.span);
        continue;
      }
      if (values.has(f.name.name)) {
        this.sink.error('duplicate', `field \`${f.name.name}\` is given twice`, f.name.span);
        continue;
      }
      values.set(f.name.name, this.checkAgainst(f.value, fd.type, ctx));
    }
    const missing = t.fields.filter((f) => !values.has(f.name));
    if (missing.length) {
      return this.err('missing-field', `missing ${missing.length === 1 ? 'field' : 'fields'} ${missing.map((f) => `\`${f.name}\``).join(', ')}`, e.name.span, undefined);
    }
    return fold({ k: 'struct', fields: t.fields.map((f) => values.get(f.name)!), t, span: e.span });
  }

  private call(e: Extract<Expr, { kind: 'call' }>, ctx: Ctx): TExpr {
    const name = e.callee.name;
    const g = ctx.scope.lookup(name) ? undefined : this.global(name);
    if (g && g.item.kind === 'fn') return this.callFn(g.item, e, ctx);
    if (!BUILTINS.has(name)) {
      if (g && g.item.kind === 'module') {
        return this.err('bad-call', `\`${name}\` is a module, not a function`, e.callee.span, undefined, { help: [`instantiate it: \`inst u: ${name}(…)\``] });
      }
      const fns = [...this.globals.values()].filter((x) => x.item.kind === 'fn').map((x) => itemIdent(x.item).name);
      const s = suggest(name, [...fns, ...BUILTINS]);
      return this.err('unknown-name', `unknown function \`${name}\``, e.callee.span, undefined, { help: s ? [`did you mean \`${s}\`?`] : undefined });
    }
    const argc = (n: number): boolean => {
      if (e.args.length === n) return true;
      this.sink.error('bad-call', `\`${name}\` takes ${n} argument${n === 1 ? '' : 's'}`, e.span, `${e.args.length} given`);
      return false;
    };
    /** A hardware operand whose width is known. */
    const typed = (x: Expr, allowSigned = true): TExpr => {
      const te = this.infer(x, ctx);
      if (te.t.k === 'error') return te;
      if (isUntyped(te.t)) return this.noContext(x);
      if (te.t.k === 'clock') return this.clockMisuse(x);
      if (te.t.k !== 'bits' || (!allowSigned && te.t.signed)) {
        return this.err('bad-operand', `\`${name}\` needs a ${allowSigned ? 'bits' : 'bits<N>'} value`, x.span, typeToString(te.t));
      }
      return te;
    };
    switch (name) {
      case 'concat': {
        if (!e.args.length) return this.err('bad-call', '`concat` needs at least one argument', e.span);
        const parts = e.args.map((x) => typed(x));
        if (parts.some((p) => p.t.k === 'error')) return this.errT(e.span);
        return fold({ k: 'concat', parts, t: bits(parts.reduce((s, p) => s + widthOf(p.t), 0)), span: e.span });
      }
      case 'repeat': {
        if (!argc(2)) return this.errT(e.span);
        const a = typed(e.args[0]!);
        const n = this.constInt(e.args[1]!, ctx, 'the repeat count');
        if (a.t.k === 'error' || n === undefined) return this.errT(e.span);
        if (n < 1n) return this.err('bad-call', 'the repeat count must be at least 1', e.args[1]!.span);
        return fold({ k: 'repeat', a, n: Number(n), t: bits(widthOf(a.t) * Number(n)), span: e.span });
      }
      case 'zext':
      case 'sext':
      case 'trunc': {
        if (!argc(2)) return this.errT(e.span);
        const a = typed(e.args[0]!);
        const n = this.constInt(e.args[1]!, ctx, 'the width');
        if (a.t.k !== 'bits' || n === undefined) return this.errT(e.span);
        const w = a.t.w;
        if (n < 1n || n > BigInt(MAX_WIDTH)) return this.err('bad-width', `a width must be between 1 and ${MAX_WIDTH}`, e.args[1]!.span);
        const t = bits(Number(n), a.t.signed);
        if (name === 'trunc') {
          if (n > BigInt(w)) return this.err('bad-width', `\`trunc\` cannot widen ${typeToString(a.t)} to ${n} bits`, e.args[1]!.span, undefined, { help: [`use zext(…, ${n}) or sext(…, ${n})`] });
          return fold({ k: 'slice', a, lo: 0, t, span: e.span });
        }
        if (n < BigInt(w)) return this.err('bad-width', `\`${name}\` cannot narrow ${typeToString(a.t)} to ${n} bits`, e.args[1]!.span, undefined, { help: [`use trunc(…, ${n})`] });
        return fold({ k: 'ext', a, signed: name === 'sext', t, span: e.span });
      }
      case 'reverse': {
        if (!argc(1)) return this.errT(e.span);
        const a = typed(e.args[0]!);
        if (a.t.k === 'error') return a;
        return fold({ k: 'reverse', a, t: a.t, span: e.span });
      }
      case 'any':
      case 'all': {
        if (!argc(1)) return this.errT(e.span);
        const a = typed(e.args[0]!);
        if (a.t.k === 'error') return a;
        return fold({ k: 'reduce', op: name === 'any' ? 'or' : 'and', a, t: BIT, span: e.span });
      }
      case 'count_ones': {
        if (!argc(1)) return this.errT(e.span);
        const a = typed(e.args[0]!);
        if (a.t.k === 'error') return a;
        return fold({ k: 'popcount', a, t: bits(bitsNeeded(BigInt(widthOf(a.t)))), span: e.span });
      }
      case 'signed':
      case 'bits': {
        if (!argc(1)) return this.errT(e.span);
        const a = this.infer(e.args[0]!, ctx);
        if (a.t.k === 'error') return a;
        if (isUntyped(a.t)) return this.noContext(e.args[0]!, `give it a width: \`${name}<N>(value)\``);
        if (name === 'bits' && (a.t.k === 'enum' || a.t.k === 'struct' || a.t.k === 'array')) return fold({ k: 'cast', a, t: bits(widthOf(a.t)), span: e.span });
        if (a.t.k !== 'bits') return this.err('bad-operand', `\`${name}\` converts bit vectors`, e.args[0]!.span, typeToString(a.t));
        return fold({ k: 'cast', a, t: bits(a.t.w, name === 'signed'), span: e.span });
      }
      case 'bit': {
        if (!argc(1)) return this.errT(e.span);
        return this.checkAgainst(e.args[0]!, BIT, ctx);
      }
      case 'clog2': {
        if (!argc(1)) return this.errT(e.span);
        const n = this.constInt(e.args[0]!, ctx, 'the argument of `clog2`');
        if (n === undefined) return this.errT(e.span);
        if (n < 1n) return this.err('bad-call', '`clog2` needs a positive argument', e.args[0]!.span);
        return { k: 'const', v: clog2(n), t: INT, span: e.span };
      }
      case 'random': {
        if (!ctx.test) return this.err('bad-call', '`random` can only be used in tests', e.span);
        if (!argc(1)) return this.errT(e.span);
        const arg = e.args[0]!;
        const te: TypeExpr | undefined =
          arg.kind === 'type' ? arg.type : arg.kind === 'name' ? { kind: 'named', name: { name: arg.name, span: arg.span }, args: [], span: arg.span } : undefined;
        if (!te) return this.err('bad-call', '`random` takes a type, as in `random(bits<8>)`', arg.span);
        const t = this.resolveType(te, ctx);
        if (t.k === 'error') return this.errT(e.span);
        if (t.k === 'clock' || t.k === 'int') return this.err('bad-call', `cannot generate a random ${typeToString(t)}`, arg.span);
        return { k: 'random', t, span: e.span };
      }
    }
    return this.errT(e.span);
  }

  private matchExpr(e: Extract<Expr, { kind: 'match' }>, expected: Type | undefined, ctx: Ctx): TExpr {
    const sel = this.infer(e.scrutinee, ctx);
    let selT = sel.t;
    if (selT.k === 'error') {
      for (const a of e.arms) this.infer(a.body, ctx);
      return this.errT(e.span);
    }
    if (isUntyped(selT)) {
      this.noContext(e.scrutinee, 'match on a typed value');
      selT = ERROR;
    } else if (selT.k !== 'bits' && selT.k !== 'enum') {
      this.sink.error('bad-operand', `cannot match on ${typeToString(selT)}`, e.scrutinee.span, undefined, { help: ['match on a `bits<N>` value or an enum'] });
      selT = ERROR;
    }
    // Patterns.
    const armValues: bigint[][] = [];
    const seen = new Map<bigint, Span>();
    let wildcard: Span | undefined;
    let valuesOk = selT.k !== 'error';
    for (const arm of e.arms) {
      const vals: bigint[] = [];
      if (arm.wildcard) {
        if (wildcard) this.sink.error('overlapping-arms', 'more than one `_` arm', arm.span, 'second `_`', { secondary: [{ span: wildcard, label: 'first `_` here' }] });
        wildcard = arm.span;
      }
      for (const p of arm.patterns) {
        if (selT.k === 'error') continue;
        const pv = this.checkAgainst(p, selT, ctx);
        if (pv.t.k === 'error') {
          valuesOk = false;
          continue;
        }
        if (pv.k !== 'const') {
          this.sink.error('bad-pattern', 'a match pattern must be a constant', p.span, 'this depends on signals', { help: ['use `if` to compare with a signal'] });
          valuesOk = false;
          continue;
        }
        const prev = seen.get(pv.v);
        if (prev) {
          this.sink.error('overlapping-arms', 'match arms overlap', p.span, `${this.patternText(pv.v, selT)} is already matched`, {
            secondary: [{ span: prev, label: 'first matched here' }],
            notes: ['arm order does not matter in a `match`, so each value may appear in only one arm'],
          });
          continue;
        }
        seen.set(pv.v, p.span);
        vals.push(pv.v);
      }
      armValues.push(vals);
    }
    // Coverage.
    if (valuesOk && !wildcard && selT.k !== 'error') {
      const missing = this.missingValues(selT, seen);
      if (missing.length) {
        const selText = e.scrutinee.kind === 'name' ? `\`${e.scrutinee.name}: ${typeToString(selT)}\`` : `\`${typeToString(selT)}\``;
        this.sink.error('match-incomplete', `this match does not cover every value of ${selText}`, e.keywordSpan, listWords(missing, 'is missing', 'are missing'), {
          help: ['add the missing arms, or `_ => …`'],
        });
      }
    } else if (valuesOk && wildcard && selT.k !== 'error' && this.missingValues(selT, seen).length === 0) {
      this.sink.warning('unreachable-arm', 'the `_` arm is never used', wildcard, 'every value is already matched');
    }
    // Arm bodies.
    let t = expected;
    const bodies: (TExpr | undefined)[] = e.arms.map(() => undefined);
    if (!t) {
      e.arms.forEach((a, i) => {
        const b = this.infer(a.body, ctx);
        bodies[i] = b;
        if (!t && !isUntyped(b.t) && b.t.k !== 'error') t = b.t;
      });
      if (!t) {
        if (bodies.some((b) => b!.t.k === 'error')) return this.errT(e.span);
        return { k: 'const', v: 0n, t: LIT, span: e.span };
      }
    }
    const tt = t;
    const typedBodies = e.arms.map((a, i) => (bodies[i] ? this.coerce(bodies[i]!, tt, a.body, ctx) : this.checkAgainst(a.body, tt, ctx)));
    if (selT.k === 'error' || typedBodies.some((b) => b.t.k === 'error')) return this.errT(e.span);
    const arms: { values: bigint[]; body: TExpr }[] = [];
    let dflt: TExpr | undefined;
    e.arms.forEach((a, i) => {
      if (a.wildcard) dflt = typedBodies[i];
      if (armValues[i]!.length) arms.push({ values: armValues[i]!, body: typedBodies[i]! });
    });
    return fold({ k: 'match', sel, arms, dflt, t: tt, span: e.span });
  }

  private patternText(v: bigint, t: Type): string {
    if (t.k === 'enum') {
      const i = t.codes.indexOf(v);
      return `${t.name}.${t.variants[i] ?? v}`;
    }
    return String(v);
  }

  private missingValues(t: Type, seen: Map<bigint, Span>): string[] {
    if (t.k === 'enum') {
      return t.codes.filter((c) => !seen.has(c)).map((c) => this.patternText(c, t));
    }
    if (t.k !== 'bits') return [];
    const size = 1n << BigInt(t.w);
    const covered = [...seen.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const gaps: [bigint, bigint][] = [];
    let next = 0n;
    for (const v of covered) {
      if (v > next) gaps.push([next, v - 1n]);
      next = v + 1n;
    }
    if (next < size) gaps.push([next, size - 1n]);
    const out: string[] = [];
    let count = 0;
    for (const [a, b] of gaps) {
      if (out.length >= 6) {
        count++;
        continue;
      }
      if (b - a < 3n) for (let v = a; v <= b; v++) out.push(String(v));
      else out.push(`${a} to ${b}`);
    }
    if (out.length > 6) {
      count += out.length - 6;
      out.length = 6;
    }
    if (count) out.push(`${count} more`);
    return out;
  }

  // ------------------------------------------------------------------------------------------ tests

  private checkTest(test: TestDecl): TestPlan {
    const before = this.sink.errorCount;
    const scope = new Scope(null);
    const ctx: Ctx = { scope, mod: null, test: true, fnStack: [], file: test.span.file };
    const sims: string[] = [];
    const body = this.testStmts(test.body, ctx, sims);
    return { name: test.name, span: test.span, body, ok: this.sink.errorCount === before };
  }

  private testStmts(stmts: TestStmt[], ctx: Ctx, sims: string[]): TestPlanStmt[] {
    const out: TestPlanStmt[] = [];
    for (const s of stmts) {
      switch (s.kind) {
        case 'let': {
          if (s.value.kind === 'sim') {
            const sim = s.value;
            const g = this.global(sim.module.name);
            if (!g || g.item.kind !== 'module') {
              this.sink.error('unknown-module', `unknown module \`${sim.module.name}\``, sim.module.span);
              break;
            }
            const generics: bigint[] = [];
            let ok = true;
            if (sim.generics.length !== g.item.generics.length) {
              this.sink.error('bad-generics', `\`${sim.module.name}\` takes ${g.item.generics.length} generic argument${g.item.generics.length === 1 ? '' : 's'}`, sim.module.span, `${sim.generics.length} given`);
              break;
            }
            for (const a of sim.generics) {
              const v = this.constInt(a, ctx, 'a generic argument');
              if (v === undefined) ok = false;
              else generics.push(v);
            }
            if (!ok) break;
            const spec = this.getSpec(g.item, generics, sim.module.span, g.file);
            if (!spec) break;
            const inits = new Map<string, TExpr>();
            this.connect(spec, sim.args, s.name, sim.module, ctx, (p, v) => inits.set(p, v), () => {}, true);
            this.bind(ctx.scope, s.name, { k: 'sim', name: s.name.name, spec, span: s.name.span });
            sims.push(s.name.name);
            out.push({ k: 'sim', name: s.name.name, spec, inits, span: s.span });
            break;
          }
          let expr: TExpr;
          if (s.type) expr = this.checkAgainst(s.value, this.resolveType(s.type, ctx), ctx);
          else {
            expr = this.infer(s.value, ctx);
            if (expr.t.k === 'lit') expr = this.noContext(s.value, `give it a type: \`let ${s.name.name}: bits<N> = …\``);
          }
          this.bind(ctx.scope, s.name, { k: 'testvar', name: s.name.name, type: expr.t, span: s.name.span });
          out.push({ k: 'let', name: s.name.name, expr, span: s.span });
          break;
        }
        case 'set': {
          const target = s.target;
          if (target.kind === 'field' && target.target.kind === 'name') {
            const b = ctx.scope.lookup(target.target.name);
            if (b?.k === 'sim') {
              const port = b.spec.inputs.find((p) => p.name === target.field.name);
              if (!port) {
                const isOut = b.spec.outputs.some((p) => p.name === target.field.name);
                this.sink.error('bad-assignment', isOut ? `\`${target.field.name}\` is an output of \`${b.spec.name}\`` : `\`${b.spec.name}\` has no input \`${target.field.name}\``, target.field.span, undefined, {
                  help: isOut ? ['a test drives inputs and checks outputs'] : undefined,
                });
                break;
              }
              if (port.type.k === 'clock') {
                this.sink.error('clock-misuse', 'a clock is driven by `step`', target.span);
                break;
              }
              out.push({ k: 'setport', sim: b.name, port: port.name, expr: this.checkAgainst(s.value, port.type, ctx), span: s.span });
              break;
            }
          }
          if (target.kind === 'name') {
            const b = ctx.scope.lookup(target.name);
            if (b?.k === 'testvar') {
              out.push({ k: 'setvar', name: b.name, expr: this.checkAgainst(s.value, b.type, ctx), span: s.span });
              break;
            }
          }
          this.sink.error('bad-assignment', 'a test can assign an input of a simulated instance (`c.port = …`) or a test variable', target.span);
          break;
        }
        case 'step': {
          if (!sims.length) this.sink.error('bad-step', '`step` needs a simulated instance', s.span, undefined, { help: ['create one first: `let c = sim Module(…)`'] });
          const count = s.count ? this.checkAgainst(s.count, INT, ctx) : undefined;
          out.push({ k: 'step', count, clock: s.clock?.name, span: s.span });
          break;
        }
        case 'expect': {
          const cond = this.checkAgainst(s.cond, BIT, ctx);
          out.push({ k: 'expect', cond, text: this.files.get(s.cond.span.file)?.text.slice(s.cond.span.start, s.cond.span.end) ?? '', span: s.cond.span });
          break;
        }
        case 'print': {
          const args = s.args.map((a) => {
            if (a.kind === 'string') return a.value;
            const v = this.infer(a, ctx);
            return v.t.k === 'lit' ? this.noContext(a) : v;
          });
          out.push({ k: 'print', args, span: s.span });
          break;
        }
        case 'for': {
          const from = this.checkAgainst(s.from, INT, ctx);
          const to = this.checkAgainst(s.to, INT, ctx);
          const inner = new Scope(ctx.scope);
          inner.map.set(s.var.name, { b: { k: 'testvar', name: s.var.name, type: INT, span: s.var.span }, span: s.var.span });
          const body = this.testStmts(s.body, { ...ctx, scope: inner }, sims);
          out.push({ k: 'for', var: s.var.name, from, to, body, span: s.span });
          break;
        }
      }
    }
    return out;
  }
}

/** Parses and checks a DCL source text. */
export function check(source: string, options: CheckOptions = {}): CheckResult {
  const file = options.file ?? 'input.dcl';
  const parsed = parse(source, file);
  const opts: Required<CheckOptions> = { file, std: options.std ?? true, lint: options.lint ?? true, tests: options.tests ?? true };
  const checker = new Checker(parsed.program, parsed.source, opts);
  for (const d of parsed.diagnostics) checker.sink.add(d);
  const tests = checker.run();
  const diagnostics = [...checker.sink.list].sort((a, b) =>
    a.span.file === b.span.file ? a.span.start - b.span.start : a.span.file === file ? -1 : b.span.file === file ? 1 : a.span.file < b.span.file ? -1 : 1,
  );
  return { diagnostics, program: new TypedProgram(parsed.program, parsed.source, checker, tests) };
}

export { NO_SPAN };
export type { TExprOf };
