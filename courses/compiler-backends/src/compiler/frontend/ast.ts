// AST for "Kiln", the tiny source language compiled throughout the course.
// Every value is a 64-bit signed integer; arrays decay to their address.

export interface Pos {
  line: number;
  col: number;
}

/** Just past the last character of a node (same line/col scheme as Pos). Set by the parser. */
export type End = { end?: Pos };

export type BinOp =
  | '+' | '-' | '*' | '/' | '%'
  | '&' | '|' | '^' | '<<' | '>>'
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | '&&' | '||';

export type UnOp = '-' | '!' | '~';

export type Expr = End & (
  | { k: 'num'; v: bigint; pos: Pos }
  | { k: 'var'; name: string; pos: Pos }
  | { k: 'bin'; op: BinOp; l: Expr; r: Expr; pos: Pos }
  | { k: 'un'; op: UnOp; e: Expr; pos: Pos }
  | { k: 'call'; name: string; args: Expr[]; pos: Pos }
  | { k: 'index'; base: Expr; idx: Expr; pos: Pos });

export type Stmt = End & (
  | { k: 'let'; name: string; size?: number; init?: Expr; pos: Pos }
  | { k: 'assign'; target: Expr; value: Expr; pos: Pos }
  | { k: 'if'; cond: Expr; then: Stmt[]; else?: Stmt[]; pos: Pos }
  | { k: 'while'; cond: Expr; body: Stmt[]; pos: Pos }
  | { k: 'for'; name: string; from: Expr; to: Expr; body: Stmt[]; pos: Pos }
  | { k: 'return'; e?: Expr; pos: Pos }
  | { k: 'break'; pos: Pos }
  | { k: 'continue'; pos: Pos }
  | { k: 'expr'; e: Expr; pos: Pos });

export interface FuncDecl extends End {
  name: string;
  params: string[];
  body: Stmt[];
  pos: Pos;
  endLine: number;
}

export interface GlobalDecl extends End {
  name: string;
  /** number of 64-bit words; scalars have size 1 */
  size: number;
  isArray: boolean;
  init: bigint[];
  pos: Pos;
}

export interface Program {
  funcs: FuncDecl[];
  globals: GlobalDecl[];
}

export class CompileError extends Error {
  constructor(
    message: string,
    public pos: Pos,
    public stage = 'parse',
  ) {
    super(`${pos.line}:${pos.col}: ${message}`);
  }
}

/** Functions provided by the runtime library (runtime.s). */
export const BUILTINS: Record<string, { arity: number; symbol: string; doc: string }> = {
  print: { arity: 1, symbol: 'print_int', doc: 'print(x) writes x in decimal followed by a newline' },
  putchar: { arity: 1, symbol: 'putchar', doc: 'putchar(c) writes the byte c to stdout' },
};
