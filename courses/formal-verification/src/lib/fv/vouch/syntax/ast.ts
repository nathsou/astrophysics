/**
 * The Vouch abstract syntax tree. Every node carries its source span; the type checker records types in a side
 * table keyed by node (see check/types.ts), so the tree itself stays plain data.
 */
import type { Span } from './lexer';

export interface Node {
  span: Span;
}

export interface Ident extends Node {
  name: string;
}

// ───────────────────────────── Types ─────────────────────────────

export type TypeExpr =
  | ({ k: 'named'; name: string; args: TypeExpr[] } & Node)
  | ({ k: 'range'; lo: Expr; hi: Expr; inclusive: boolean } & Node)
  | ({ k: 'seq'; elem: TypeExpr } & Node)
  | ({ k: 'func'; params: TypeExpr[]; result: TypeExpr } & Node)
  | ({ k: 'ref'; cls: string; nullable: boolean } & Node)
  | ({ k: 'enum'; variants: Ident[] } & Node)
  | ({ k: 'tuple'; elems: TypeExpr[] } & Node)
  | ({ k: 'rel'; cols: TypeExpr[]; mult: Multiplicity } & Node);

export type Multiplicity = 'one' | 'lone' | 'some' | 'set';

// ───────────────────────────── Expressions ─────────────────────────────

export type BinOp =
  | '+' | '-' | '*' | '/' | '%' | '++'
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | '&&' | '||' | '==>' | '<==' | '<==>'
  | 'in' | '!in'
  | '&' | '|' | '^' | '<<' | '>>'
  | '**' | '|->'
  | 'until' | '~>'
  | '.';

export type UnOp = '-' | '!' | '~' | '#' | '^' | '*' | 'always' | 'eventually' | 'next';

export interface Binder extends Node {
  name: string;
  type?: TypeExpr;
  /** `forall i in 0..n` */
  range?: { lo: Expr; hi: Expr; inclusive: boolean } | { set: Expr };
}

export type Expr =
  | ({ k: 'int'; value: bigint } & Node)
  | ({ k: 'bool'; value: boolean } & Node)
  | ({ k: 'null' } & Node)
  | ({ k: 'emp' } & Node)
  | ({ k: 'var'; name: string } & Node)
  | ({ k: 'unary'; op: UnOp; arg: Expr } & Node)
  | ({ k: 'binary'; op: BinOp; left: Expr; right: Expr } & Node)
  /** Chained comparisons: `0 <= i < j <= n` (all < / <= or all > / >=). */
  | ({ k: 'chain'; ops: ('<' | '<=' | '>' | '>=')[]; args: Expr[] } & Node)
  | ({ k: 'call'; callee: string; calleeSpan: Span; args: Expr[]; inout: boolean[] } & Node)
  | ({ k: 'index'; target: Expr; indices: Expr[] } & Node)
  | ({ k: 'slice'; target: Expr; lo?: Expr; hi?: Expr } & Node)
  | ({ k: 'update'; target: Expr; index: Expr; value: Expr } & Node)
  | ({ k: 'field'; target: Expr; name: string; nameSpan: Span } & Node)
  | ({ k: 'struct'; name: string; fields: { name: string; value: Expr; span: Span }[] } & Node)
  | ({ k: 'seqlit'; elems: Expr[] } & Node)
  | ({ k: 'setlit'; elems: Expr[]; multi: boolean } & Node)
  | ({ k: 'tuple'; elems: Expr[] } & Node)
  | ({ k: 'quant'; q: 'forall' | 'exists'; binders: Binder[]; triggers: Expr[][]; body: Expr } & Node)
  /** `{ x: T | p }` (a set), or `[f(k) | k in lo..hi]` (a sequence, `seq: true`, with `value`). */
  | ({ k: 'comprehension'; binders: Binder[]; body: Expr; value?: Expr; seq?: boolean } & Node)
  | ({ k: 'mult'; m: 'some' | 'no' | 'one' | 'lone'; arg: Expr } & Node)
  | ({ k: 'if'; cond: Expr; then: Expr; else: Expr } & Node)
  | ({ k: 'match'; scrutinee: Expr; arms: { pattern: Pattern; body: Expr; span: Span }[] } & Node)
  | ({ k: 'block'; lets: { name: string; type?: TypeExpr; value: Expr; span: Span }[]; body: Expr } & Node)
  | ({ k: 'old'; arg: Expr } & Node)
  | ({ k: 'at'; proc: Expr; label: string; labelSpan: Span } & Node)
  | ({ k: 'cast'; arg: Expr; type: TypeExpr } & Node)
  | ({ k: 'new'; cls: string; fields: { name: string; value: Expr; span: Span }[] } & Node);

export type Pattern =
  | ({ k: 'wild' } & Node)
  | ({ k: 'variant'; name: string; binds: Ident[] } & Node)
  | ({ k: 'lit'; value: Expr } & Node);

// ───────────────────────────── Statements ─────────────────────────────

export interface LoopSpec {
  invariants: Labelled<Expr>[];
  decreases?: Expr[];
}

export interface Labelled<T> {
  label?: string;
  value: T;
  span: Span;
}

export type LValue = Expr; // var, index, field (checked by the type checker)

export type Stmt =
  | ({ k: 'let'; name: string; nameSpan: Span; type?: TypeExpr; init?: Expr; mutable: boolean; ghost: boolean } & Node)
  | ({ k: 'assign'; target: LValue; op: '=' | '+=' | '-=' | '*='; value: Expr } & Node)
  /** `let a, b = f(x)` / `x, y = y, x` (parallel assignment) */
  | ({ k: 'multi'; targets: LValue[]; values: Expr[]; declare: boolean; mutable: boolean } & Node)
  | ({ k: 'if'; cond: Expr; then: Block; else?: Block | (Stmt & { k: 'if' }) } & Node)
  | ({ k: 'while'; cond: Expr; spec: LoopSpec; body: Block } & Node)
  | ({ k: 'for'; v: string; vSpan: Span; lo: Expr; hi: Expr; inclusive: boolean; spec: LoopSpec; body: Block } & Node)
  | ({ k: 'loop'; body: Block } & Node)
  | ({ k: 'match'; scrutinee: Expr; arms: { pattern: Pattern; body: Block; span: Span }[] } & Node)
  | ({ k: 'return'; value?: Expr } & Node)
  | ({ k: 'break' } & Node)
  | ({ k: 'assert'; cond: Expr; label?: string } & Node)
  | ({ k: 'assume'; cond: Expr } & Node)
  | ({ k: 'expr'; expr: Expr } & Node)
  | ({ k: 'block'; body: Block } & Node)
  | ({ k: 'label'; label: string; labelSpan: Span; stmt: Stmt } & Node)
  | ({ k: 'await'; cond: Expr } & Node)
  | ({ k: 'atomic'; body: Block } & Node)
  | ({ k: 'choose'; name: string; nameSpan: Span; type: TypeExpr; where?: Expr } & Node)
  | ({ k: 'free'; target: Expr } & Node)
  | ({ k: 'skip' } & Node);

export interface Block extends Node {
  stmts: Stmt[];
}

// ───────────────────────────── Declarations ─────────────────────────────

export interface Param extends Node {
  name: string;
  type: TypeExpr;
  mode: 'in' | 'inout';
  ghost: boolean;
}

export interface Spec {
  requires: Labelled<Expr>[];
  ensures: Labelled<Expr>[];
  decreases?: Expr[];
  reads?: Expr[];
  modifies?: Expr[];
}

export type FnFlavour = 'fn' | 'pure' | 'pred' | 'lemma';

export interface FnDecl extends Node {
  k: 'fn';
  flavour: FnFlavour;
  ghost: boolean;
  name: string;
  nameSpan: Span;
  params: Param[];
  result?: { name?: string; type: TypeExpr; span: Span };
  spec: Spec;
  /** Executable bodies are blocks; pure functions and predicates have an expression body. */
  body?: Block | Expr;
  doc?: string;
}

export interface ConstDecl extends Node {
  k: 'const';
  name: string;
  nameSpan: Span;
  type?: TypeExpr;
  value: Expr;
}

export interface EnumDecl extends Node {
  k: 'enum';
  name: string;
  nameSpan: Span;
  variants: { name: string; span: Span; fields: { name: string; type: TypeExpr; span: Span }[] }[];
}

export interface StructDecl extends Node {
  k: 'struct' | 'class';
  name: string;
  nameSpan: Span;
  fields: { name: string; type: TypeExpr; span: Span; ghost: boolean }[];
}

export interface TypeDecl extends Node {
  k: 'type';
  /** Several names may be declared at once: `type Dir, File`. */
  names: Ident[];
  def?: TypeExpr;
  symmetric: boolean;
}

export interface VarDecl extends Node {
  k: 'var';
  name: string;
  nameSpan: Span;
  type: TypeExpr;
  init?: Expr;
  ghost: boolean;
}

export interface ActionDecl extends Node {
  k: 'action';
  name: string;
  nameSpan: Span;
  params: Param[];
  guard?: Expr;
  body: Block;
}

export interface ProcessDecl extends Node {
  k: 'process';
  name: string;
  nameSpan: Span;
  params: Param[];
  body: Block;
}

export interface PropDecl extends Node {
  k: 'invariant' | 'property' | 'fact' | 'check' | 'run' | 'constraint';
  name?: string;
  nameSpan?: Span;
  expr: Expr;
  /** `check … for 4` */
  scope?: number;
}

export interface FairnessDecl extends Node {
  k: 'fairness';
  strength: 'weak' | 'strong';
  targets: Ident[];
}

export interface InstanceDecl extends Node {
  k: 'instance';
  type: string;
  size: number;
}

export interface InitDecl extends Node {
  k: 'init';
  body: Block;
}

export interface RelDecl extends Node {
  k: 'rel';
  name: string;
  nameSpan: Span;
  type: TypeExpr;
}

export interface RefinesDecl extends Node {
  k: 'refines';
  spec: string;
  mapping: { name: string; value: Expr; span: Span }[];
}

export interface SolveDecl extends Node {
  k: 'solve' | 'count';
}

export type Member =
  | FnDecl
  | ConstDecl
  | EnumDecl
  | StructDecl
  | TypeDecl
  | VarDecl
  | ActionDecl
  | ProcessDecl
  | PropDecl
  | FairnessDecl
  | InstanceDecl
  | InitDecl
  | RelDecl
  | RefinesDecl
  | SolveDecl;

export interface ContainerDecl extends Node {
  k: 'system' | 'world' | 'problem';
  name: string;
  nameSpan: Span;
  members: Member[];
}

export type Decl = FnDecl | ConstDecl | EnumDecl | StructDecl | TypeDecl | ContainerDecl;

export interface Program extends Node {
  decls: Decl[];
}

/** A child-first walk over every expression inside an expression. */
export function forEachSubExpr(e: Expr, f: (e: Expr) => void): void {
  const go = (x: Expr | undefined) => x && forEachSubExpr(x, f);
  switch (e.k) {
    case 'unary':
    case 'old':
    case 'mult':
      go(e.arg);
      break;
    case 'cast':
      go(e.arg);
      break;
    case 'binary':
      go(e.left);
      go(e.right);
      break;
    case 'chain':
      e.args.forEach(go);
      break;
    case 'call':
      e.args.forEach(go);
      break;
    case 'index':
      go(e.target);
      e.indices.forEach(go);
      break;
    case 'slice':
      go(e.target);
      go(e.lo);
      go(e.hi);
      break;
    case 'update':
      go(e.target);
      go(e.index);
      go(e.value);
      break;
    case 'field':
      go(e.target);
      break;
    case 'struct':
    case 'new':
      e.fields.forEach((x) => go(x.value));
      break;
    case 'seqlit':
    case 'setlit':
    case 'tuple':
      e.elems.forEach(go);
      break;
    case 'quant':
    case 'comprehension':
      for (const b of e.binders) {
        if (b.range && 'set' in b.range) go(b.range.set);
        else if (b.range) {
          go(b.range.lo);
          go(b.range.hi);
        }
      }
      e.k === 'quant' && e.triggers.flat().forEach(go);
      go(e.body);
      e.k === 'comprehension' && go(e.value);
      break;
    case 'if':
      go(e.cond);
      go(e.then);
      go(e.else);
      break;
    case 'match':
      go(e.scrutinee);
      e.arms.forEach((a) => go(a.body));
      break;
    case 'block':
      e.lets.forEach((l) => go(l.value));
      go(e.body);
      break;
    case 'at':
      go(e.proc);
      break;
  }
  f(e);
}

export function isBlock(x: Block | Stmt): x is Block {
  return 'stmts' in x;
}
