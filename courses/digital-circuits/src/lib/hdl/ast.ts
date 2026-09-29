/**
 * The DCL abstract syntax tree. Every node has a `span`. Parenthesised expressions keep a `paren` node so
 * that the formatter reproduces them exactly.
 */
import type { Span } from './span';

export interface Ident {
  name: string;
  span: Span;
}

// ---------------------------------------------------------------------------------------------- types

export type TypeExpr =
  /** `bit`, `bits<N>`, `signed<N>`, `clock`, `int`, or a struct/enum/alias name (with optional arguments). */
  | { kind: 'named'; name: Ident; args: Expr[]; span: Span }
  /** `[T; N]` */
  | { kind: 'array'; elem: TypeExpr; size: Expr; span: Span };

// --------------------------------------------------------------------------------------- expressions

export type BinaryOp = '*' | '+' | '-' | '<<' | '>>' | '&' | '^' | '|' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||';
export type UnaryOp = '!' | '~' | '-';

export interface MatchArm {
  /** Alternatives `p | q`; an empty list means `_`. */
  patterns: Expr[];
  wildcard: boolean;
  body: Expr;
  span: Span;
}

export interface NamedArg {
  name: Ident;
  value: Expr;
  span: Span;
}

export type Expr =
  | { kind: 'number'; value: bigint; text: string; span: Span }
  | { kind: 'string'; value: string; text: string; span: Span }
  | { kind: 'name'; name: string; span: Span }
  | { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr; opSpan: Span; span: Span }
  | { kind: 'unary'; op: UnaryOp; operand: Expr; span: Span }
  | { kind: 'paren'; inner: Expr; span: Span }
  /** `{ expr }` */
  | { kind: 'block'; inner: Expr; span: Span }
  | { kind: 'if'; cond: Expr; then: Expr; else: Expr; span: Span; multiline: boolean }
  | { kind: 'match'; scrutinee: Expr; arms: MatchArm[]; span: Span; keywordSpan: Span; multiline: boolean }
  /** `f(args)`, `f<generics>(args)` for built-ins and `fn`s. */
  | { kind: 'call'; callee: Ident; generics: Expr[]; args: Expr[]; span: Span; multiline: boolean }
  /** `x.read(addr)` */
  | { kind: 'method'; target: Expr; method: Ident; args: Expr[]; span: Span; multiline: boolean }
  | { kind: 'field'; target: Expr; field: Ident; span: Span }
  | { kind: 'index'; target: Expr; index: Expr; span: Span }
  | { kind: 'slice'; target: Expr; hi: Expr; lo: Expr; span: Span }
  /** `[a, b, c]` */
  | { kind: 'array'; elems: Expr[]; span: Span; multiline: boolean }
  /** `[value; count]` */
  | { kind: 'repeat'; value: Expr; count: Expr; span: Span }
  /** `S { a: x, b: y }` */
  | { kind: 'struct'; name: Ident; fields: NamedArg[]; span: Span; multiline: boolean }
  /** `bits<12>(0)`, `signed<8>(x)`, `bit(1)`: a typed literal or a conversion. */
  | { kind: 'typed'; type: TypeExpr; arg: Expr; span: Span }
  /** A type used as an argument, as in `random(bits<8>)`. */
  | { kind: 'type'; type: TypeExpr; span: Span }
  /** Only in tests: `sim Module<args>(port: value, …)`. */
  | { kind: 'sim'; module: Ident; generics: Expr[]; args: NamedArg[]; span: Span; multiline: boolean }
  /** Placeholder produced by error recovery. */
  | { kind: 'error'; span: Span };

// ------------------------------------------------------------------------------------ module items

export interface Port {
  name: Ident;
  type: TypeExpr;
  doc?: string;
  span: Span;
}

export interface GenericParam {
  name: Ident;
  /** Always `int` for now. */
  type: TypeExpr;
  span: Span;
}

/** The target of `next`: `x` or `x[i]`. */
export interface NextTarget {
  name: Ident;
  index?: Expr;
  span: Span;
}

export type ModuleItem =
  | { kind: 'let'; name: Ident; type?: TypeExpr; value: Expr; doc?: string; span: Span }
  | { kind: 'const'; name: Ident; type?: TypeExpr; value: Expr; doc?: string; span: Span }
  | { kind: 'reg'; name: Ident; type: TypeExpr; init: Expr; clock?: Ident; doc?: string; span: Span }
  | { kind: 'mem'; name: Ident; type: TypeExpr; init?: Expr; clock?: Ident; doc?: string; span: Span }
  | { kind: 'next'; target: NextTarget; value: Expr; span: Span }
  | {
      kind: 'inst';
      name: Ident;
      module: Ident;
      generics: Expr[];
      args: NamedArg[];
      doc?: string;
      span: Span;
      multiline: boolean;
    }
  | { kind: 'assign'; target: Ident; value: Expr; span: Span }
  /** `m.write(addr, data, enable)` */
  | { kind: 'write'; mem: Ident; args: Expr[]; span: Span }
  | { kind: 'for'; var: Ident; from: Expr; to: Expr; body: ModuleItem[]; span: Span };

// ------------------------------------------------------------------------------------ test statements

export type TestStmt =
  | { kind: 'let'; name: Ident; type?: TypeExpr; value: Expr; span: Span }
  /** `name = expr` (a test variable) or `inst.port = expr` (an input of a simulated instance). */
  | { kind: 'set'; target: Expr; value: Expr; span: Span }
  | { kind: 'step'; count?: Expr; clock?: Ident; span: Span }
  | { kind: 'expect'; cond: Expr; span: Span }
  | { kind: 'print'; args: Expr[]; span: Span }
  | { kind: 'for'; var: Ident; from: Expr; to: Expr; body: TestStmt[]; span: Span };

// ------------------------------------------------------------------------------------ top-level items

export interface ModuleDecl {
  kind: 'module';
  top: boolean;
  name: Ident;
  generics: GenericParam[];
  inputs: Port[];
  outputs: Port[];
  /** Whether the output list `-> (…)` was written. */
  hasOutputs: boolean;
  body: ModuleItem[];
  doc?: string;
  span: Span;
  /** Layout hints for the formatter: the source had a line break inside the port lists. */
  inputsMultiline: boolean;
  outputsMultiline: boolean;
  /** The offsets of the `)` closing the input and output lists (for comments before them). */
  inputsEnd: number;
  outputsEnd: number;
  /** The offset of the `}` closing the body. */
  bodyEnd: number;
  /** The header had a syntax error: the module is not checked, to avoid follow-up errors. */
  headerError?: boolean;
}

export interface FnDecl {
  kind: 'fn';
  name: Ident;
  generics: GenericParam[];
  params: Port[];
  ret: TypeExpr;
  body: Expr;
  doc?: string;
  span: Span;
  paramsMultiline: boolean;
  /** The offset of the `)` closing the parameters. */
  paramsEnd: number;
  bodyMultiline: boolean;
}

export interface StructDecl {
  kind: 'struct';
  name: Ident;
  fields: Port[];
  doc?: string;
  span: Span;
  multiline: boolean;
}

export interface EnumDecl {
  kind: 'enum';
  name: Ident;
  variants: Ident[];
  /** `@onehot`, `@gray` or none (binary). */
  encoding: 'binary' | 'onehot' | 'gray';
  attrSpan?: Span;
  doc?: string;
  span: Span;
  multiline: boolean;
}

export interface TypeAliasDecl {
  kind: 'type';
  name: Ident;
  type: TypeExpr;
  doc?: string;
  span: Span;
}

export interface ConstDecl {
  kind: 'const';
  name: Ident;
  type?: TypeExpr;
  value: Expr;
  doc?: string;
  span: Span;
}

export interface TestDecl {
  kind: 'test';
  name: string;
  nameSpan: Span;
  body: TestStmt[];
  span: Span;
}

export type Item = ModuleDecl | FnDecl | StructDecl | EnumDecl | TypeAliasDecl | ConstDecl | TestDecl;

export interface Program {
  file: string;
  items: Item[];
  span: Span;
}

/** Deep copy of a node without spans or layout hints, for comparing ASTs in tests. */
export function stripSpans(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripSpans);
  if (typeof node === 'bigint') return `${node}n`;
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (
        k === 'span' || k === 'opSpan' || k === 'keywordSpan' || k === 'nameSpan' || k === 'attrSpan' ||
        k === 'multiline' || k === 'inputsMultiline' || k === 'outputsMultiline' || k === 'paramsMultiline' ||
        k === 'bodyMultiline' || k === 'bodyEnd' || k === 'headerError' || k === 'inputsEnd' || k === 'outputsEnd' || k === 'paramsEnd'
      )
        continue;
      out[k] = stripSpans(v);
    }
    return out;
  }
  return node;
}
