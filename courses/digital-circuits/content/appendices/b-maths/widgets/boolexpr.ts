/**
 * A tiny Boolean-expression parser for Appendix B's laws table and equivalence checker.
 *
 * Syntax: variables are single capital letters A–Z; constants 0 and 1; NOT is ¬x, !x, ~x or a trailing
 * apostrophe (x'); AND is · , *, & or juxtaposition of two operands; XOR is ⊕ or ^; OR is + or |.
 * Precedence, tightest first: NOT, AND, XOR, OR. Brackets group.
 */

export type Expr =
  | { k: 'const'; v: boolean }
  | { k: 'var'; name: string }
  | { k: 'not'; a: Expr }
  | { k: 'and' | 'or' | 'xor'; a: Expr; b: Expr };

export class ParseError extends Error {
  constructor(
    message: string,
    readonly at: number,
  ) {
    super(message);
  }
}

type Tok = { t: 'var' | 'const' | 'not' | 'and' | 'or' | 'xor' | 'open' | 'close' | 'prime' | 'end'; text: string; at: number };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (/\s/.test(ch)) continue;
    if (/[A-Z]/.test(ch)) out.push({ t: 'var', text: ch, at: i });
    else if (ch === '0' || ch === '1') out.push({ t: 'const', text: ch, at: i });
    else if ('¬!~'.includes(ch)) out.push({ t: 'not', text: ch, at: i });
    else if (ch === "'" || ch === '′' || ch === '’') out.push({ t: 'prime', text: ch, at: i });
    else if ('·*&∧.'.includes(ch)) out.push({ t: 'and', text: ch, at: i });
    else if ('⊕^'.includes(ch)) out.push({ t: 'xor', text: ch, at: i });
    else if ('+|∨'.includes(ch)) out.push({ t: 'or', text: ch, at: i });
    else if (ch === '(') out.push({ t: 'open', text: ch, at: i });
    else if (ch === ')') out.push({ t: 'close', text: ch, at: i });
    else throw new ParseError(`Unexpected “${ch}”. Use capital letters, 0, 1, ¬ ' · + ⊕ and brackets.`, i);
  }
  out.push({ t: 'end', text: '', at: src.length });
  return out;
}

export function parse(src: string): Expr {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p]!;
  const next = () => toks[p++]!;

  function or(): Expr {
    let a = xor();
    while (peek().t === 'or') {
      next();
      a = { k: 'or', a, b: xor() };
    }
    return a;
  }
  function xor(): Expr {
    let a = and();
    while (peek().t === 'xor') {
      next();
      a = { k: 'xor', a, b: and() };
    }
    return a;
  }
  const startsOperand = (t: Tok) => t.t === 'var' || t.t === 'const' || t.t === 'not' || t.t === 'open';
  function and(): Expr {
    let a = not();
    for (;;) {
      if (peek().t === 'and') next();
      else if (!startsOperand(peek())) break;
      a = { k: 'and', a, b: not() };
    }
    return a;
  }
  function not(): Expr {
    if (peek().t === 'not') {
      next();
      return { k: 'not', a: not() };
    }
    let a = atom();
    while (peek().t === 'prime') {
      next();
      a = { k: 'not', a };
    }
    return a;
  }
  function atom(): Expr {
    const t = next();
    if (t.t === 'var') return { k: 'var', name: t.text };
    if (t.t === 'const') return { k: 'const', v: t.text === '1' };
    if (t.t === 'open') {
      const e = or();
      if (peek().t !== 'close') throw new ParseError('A bracket is not closed.', peek().at);
      next();
      return e;
    }
    throw new ParseError(t.t === 'end' ? 'The expression ends too soon.' : `Unexpected “${t.text}”.`, t.at);
  }

  if (peek().t === 'end') throw new ParseError('Type an expression.', 0);
  const e = or();
  if (peek().t !== 'end') throw new ParseError(`Unexpected “${peek().text}”.`, peek().at);
  return e;
}

export function evaluate(e: Expr, env: Record<string, boolean>): boolean {
  switch (e.k) {
    case 'const':
      return e.v;
    case 'var':
      return env[e.name] ?? false;
    case 'not':
      return !evaluate(e.a, env);
    case 'and':
      return evaluate(e.a, env) && evaluate(e.b, env);
    case 'or':
      return evaluate(e.a, env) || evaluate(e.b, env);
    case 'xor':
      return evaluate(e.a, env) !== evaluate(e.b, env);
  }
}

export function variables(e: Expr, into = new Set<string>()): string[] {
  if (e.k === 'var') into.add(e.name);
  else if (e.k === 'not') variables(e.a, into);
  else if (e.k === 'and' || e.k === 'or' || e.k === 'xor') {
    variables(e.a, into);
    variables(e.b, into);
  }
  return [...into].sort();
}

export interface Equivalence {
  equal: boolean;
  vars: string[];
  rows: number;
  /** The first assignment on which the two sides differ. */
  counterexample?: { env: Record<string, boolean>; left: boolean; right: boolean };
}

/** Compare two expressions on every assignment of the variables that occur in either. */
export function equivalent(left: Expr | string, right: Expr | string): Equivalence {
  const l = typeof left === 'string' ? parse(left) : left;
  const r = typeof right === 'string' ? parse(right) : right;
  const vars = [...new Set([...variables(l), ...variables(r)])].sort();
  const rows = 2 ** vars.length;
  for (let i = 0; i < rows; i++) {
    const env: Record<string, boolean> = {};
    vars.forEach((v, k) => (env[v] = Boolean((i >> (vars.length - 1 - k)) & 1)));
    const a = evaluate(l, env);
    const b = evaluate(r, env);
    if (a !== b) return { equal: false, vars, rows, counterexample: { env, left: a, right: b } };
  }
  return { equal: true, vars, rows };
}

/** Truth-table rows of an expression, first variable most significant. */
export function truthTable(e: Expr | string): { vars: string[]; rows: { env: Record<string, boolean>; value: boolean }[] } {
  const x = typeof e === 'string' ? parse(e) : e;
  const vars = variables(x);
  const rows = Array.from({ length: 2 ** vars.length }, (_, i) => {
    const env: Record<string, boolean> = {};
    vars.forEach((v, k) => (env[v] = Boolean((i >> (vars.length - 1 - k)) & 1)));
    return { env, value: evaluate(x, env) };
  });
  return { vars, rows };
}
