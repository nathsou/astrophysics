/**
 * Propositional logic: parse formulas, evaluate them, build truth tables, decide tautology,
 * satisfiability and equivalence (with a counter-assignment), and convert to normal forms.
 *
 * Syntax (ASCII or Unicode):  ¬ ~ !   ∧ & /\   ∨ | \/   → -> =>   ↔ <-> <=>   ⊕ xor   ↑ nand   ↓ nor
 * Constants: ⊤ T true 1, ⊥ F false 0. Variables: letters with optional digits/primes (p, q, r1, A).
 * Precedence (tightest first): ¬, ∧/↑, ∨/⊕/↓, →, ↔. → is right-associative.
 */

export type Formula =
  | { k: 'var'; name: string }
  | { k: 'const'; value: boolean }
  | { k: 'not'; a: Formula }
  | { k: 'and' | 'or' | 'imp' | 'iff' | 'xor' | 'nand' | 'nor'; a: Formula; b: Formula };

export type BinOp = 'and' | 'or' | 'imp' | 'iff' | 'xor' | 'nand' | 'nor';

export const V = (name: string): Formula => ({ k: 'var', name });
export const Not = (a: Formula): Formula => ({ k: 'not', a });
export const Bin = (k: BinOp, a: Formula, b: Formula): Formula => ({ k, a, b });

export class LogicParseError extends Error {
  pos: number;
  constructor(msg: string, pos: number) {
    super(msg);
    this.pos = pos;
  }
}

type Tok = { t: 'var'; v: string; pos: number } | { t: 'op'; v: string; pos: number } | { t: 'const'; v: boolean; pos: number } | { t: 'end'; pos: number };

const OPS: [string, string][] = [
  ['<->', 'iff'], ['<=>', 'iff'], ['->', 'imp'], ['=>', 'imp'], ['/\\', 'and'], ['\\/', 'or'],
  ['↔', 'iff'], ['⇔', 'iff'], ['→', 'imp'], ['⇒', 'imp'], ['∧', 'and'], ['&', 'and'], ['∨', 'or'], ['|', 'or'],
  ['¬', 'not'], ['~', 'not'], ['!', 'not'], ['⊕', 'xor'], ['↑', 'nand'], ['↓', 'nor'], ['(', '('], [')', ')'],
];
const WORD_OPS: Record<string, string> = { and: 'and', or: 'or', not: 'not', implies: 'imp', iff: 'iff', xor: 'xor', nand: 'nand', nor: 'nor' };
const CONSTS: Record<string, boolean> = { '⊤': true, '⊥': false, T: true, F: false, true: true, false: false, '1': true, '0': false };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  outer: while (i < src.length) {
    if (/\s/.test(src[i]!)) {
      i++;
      continue;
    }
    for (const [s, v] of OPS) {
      if (src.startsWith(s, i)) {
        out.push({ t: 'op', v, pos: i });
        i += s.length;
        continue outer;
      }
    }
    if (src[i] === '⊤' || src[i] === '⊥' || src[i] === '0' || src[i] === '1') {
      out.push({ t: 'const', v: CONSTS[src[i]!]!, pos: i });
      i++;
      continue;
    }
    const m = /^[A-Za-z][A-Za-z0-9_']*/.exec(src.slice(i));
    if (m) {
      const w = m[0];
      if (WORD_OPS[w.toLowerCase()]) out.push({ t: 'op', v: WORD_OPS[w.toLowerCase()]!, pos: i });
      else if (w === 'T' || w === 'F' || w === 'true' || w === 'false') out.push({ t: 'const', v: CONSTS[w]!, pos: i });
      else out.push({ t: 'var', v: w, pos: i });
      i += w.length;
      continue;
    }
    throw new LogicParseError(`Unexpected “${src[i]}”`, i);
  }
  out.push({ t: 'end', pos: src.length });
  return out;
}

export function parseFormula(src: string): Formula {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i]!;
  const isOp = (v: string) => {
    const t = peek();
    return t.t === 'op' && t.v === v;
  };

  const iff = (): Formula => {
    let a = imp();
    while (isOp('iff')) {
      i++;
      a = Bin('iff', a, imp());
    }
    return a;
  };
  const imp = (): Formula => {
    const a = or();
    if (isOp('imp')) {
      i++;
      return Bin('imp', a, imp());
    }
    return a;
  };
  const or = (): Formula => {
    let a = and();
    for (;;) {
      const t = peek();
      if (t.t === 'op' && (t.v === 'or' || t.v === 'xor' || t.v === 'nor')) {
        i++;
        a = Bin(t.v as BinOp, a, and());
      } else return a;
    }
  };
  const and = (): Formula => {
    let a = unary();
    for (;;) {
      const t = peek();
      if (t.t === 'op' && (t.v === 'and' || t.v === 'nand')) {
        i++;
        a = Bin(t.v as BinOp, a, unary());
      } else return a;
    }
  };
  const unary = (): Formula => {
    if (isOp('not')) {
      i++;
      return Not(unary());
    }
    const t = peek();
    if (t.t === 'var') {
      i++;
      return V(t.v);
    }
    if (t.t === 'const') {
      i++;
      return { k: 'const', value: t.v };
    }
    if (isOp('(')) {
      i++;
      const f = iff();
      if (!isOp(')')) throw new LogicParseError('Expected “)”', peek().pos);
      i++;
      return f;
    }
    throw new LogicParseError(t.t === 'end' ? 'Formula ends too early' : `Unexpected “${t.t === 'op' ? t.v : ''}”`, t.pos);
  };

  const f = iff();
  if (peek().t !== 'end') throw new LogicParseError('Unexpected symbol', peek().pos);
  return f;
}

export function variables(f: Formula, out: Set<string> = new Set()): string[] {
  const go = (g: Formula) => {
    if (g.k === 'var') out.add(g.name);
    else if (g.k === 'not') go(g.a);
    else if (g.k !== 'const') {
      go(g.a);
      go(g.b);
    }
  };
  go(f);
  return [...out].sort();
}

export type Assignment = Record<string, boolean>;

export function evaluate(f: Formula, env: Assignment): boolean {
  switch (f.k) {
    case 'var':
      return env[f.name] ?? false;
    case 'const':
      return f.value;
    case 'not':
      return !evaluate(f.a, env);
  }
  const a = evaluate(f.a, env);
  const b = evaluate(f.b, env);
  switch (f.k) {
    case 'and':
      return a && b;
    case 'or':
      return a || b;
    case 'imp':
      return !a || b;
    case 'iff':
      return a === b;
    case 'xor':
      return a !== b;
    case 'nand':
      return !(a && b);
    case 'nor':
      return !(a || b);
  }
}

/** All assignments of the variables, in the conventional order (TT…T first, as in most textbooks). */
export function assignments(vars: string[]): Assignment[] {
  const n = vars.length;
  const out: Assignment[] = [];
  for (let m = 0; m < 1 << n; m++) {
    const env: Assignment = {};
    vars.forEach((v, i) => (env[v] = ((m >> (n - 1 - i)) & 1) === 0));
    out.push(env);
  }
  return out;
}

export interface TruthTable {
  vars: string[];
  rows: { env: Assignment; value: boolean }[];
}

export function truthTable(f: Formula, vars = variables(f)): TruthTable {
  return { vars, rows: assignments(vars).map((env) => ({ env, value: evaluate(f, env) })) };
}

export function isTautology(f: Formula): { ok: true } | { ok: false; counter: Assignment } {
  for (const env of assignments(variables(f))) if (!evaluate(f, env)) return { ok: false, counter: env };
  return { ok: true };
}

export function satisfying(f: Formula): Assignment | null {
  for (const env of assignments(variables(f))) if (evaluate(f, env)) return env;
  return null;
}

/** Are f and g equivalent? If not, an assignment on which they differ. */
export function equivalent(f: Formula, g: Formula): { ok: true } | { ok: false; counter: Assignment } {
  const vars = [...new Set([...variables(f), ...variables(g)])].sort();
  for (const env of assignments(vars)) if (evaluate(f, env) !== evaluate(g, env)) return { ok: false, counter: env };
  return { ok: true };
}

/** Does the conclusion follow from the premises (true in every row where all premises are)? */
export function entails(premises: Formula[], conclusion: Formula): { ok: true } | { ok: false; counter: Assignment } {
  const vars = [...new Set([...premises.flatMap((p) => variables(p)), ...variables(conclusion)])].sort();
  for (const env of assignments(vars)) {
    if (premises.every((p) => evaluate(p, env)) && !evaluate(conclusion, env)) return { ok: false, counter: env };
  }
  return { ok: true };
}

// ── Normal forms and functional completeness ────────────────────────────────

const andAll = (fs: Formula[]): Formula => (fs.length ? fs.reduce((a, b) => Bin('and', a, b)) : { k: 'const', value: true });
const orAll = (fs: Formula[]): Formula => (fs.length ? fs.reduce((a, b) => Bin('or', a, b)) : { k: 'const', value: false });

/** Disjunctive normal form read off a truth table: one conjunction per true row. */
export function dnfFromTable(vars: string[], value: (env: Assignment) => boolean): Formula {
  return orAll(assignments(vars).filter(value).map((env) => andAll(vars.map((v) => (env[v] ? V(v) : Not(V(v)))))));
}

export function cnfFromTable(vars: string[], value: (env: Assignment) => boolean): Formula {
  return andAll(assignments(vars).filter((e) => !value(e)).map((env) => orAll(vars.map((v) => (env[v] ? Not(V(v)) : V(v))))));
}

/** Rewrite using NAND only (Sheffer, 1913). */
export function toNand(f: Formula): Formula {
  const nand = (a: Formula, b: Formula) => Bin('nand', a, b);
  const not = (a: Formula) => nand(a, a);
  switch (f.k) {
    case 'var':
    case 'const':
      return f;
    case 'not':
      return not(toNand(f.a));
  }
  const a = toNand(f.a);
  const b = toNand(f.b);
  switch (f.k) {
    case 'nand':
      return nand(a, b);
    case 'and':
      return not(nand(a, b));
    case 'or':
      return nand(not(a), not(b));
    case 'imp':
      return nand(a, not(b));
    case 'nor':
      return not(nand(not(a), not(b)));
    case 'iff': {
      const x = nand(a, b);
      return not(nand(nand(a, x), nand(b, x)));
    }
    case 'xor': {
      const x = nand(a, b);
      return nand(nand(a, x), nand(b, x));
    }
  }
}

export function size(f: Formula): number {
  if (f.k === 'var' || f.k === 'const') return 1;
  if (f.k === 'not') return 1 + size(f.a);
  return 1 + size(f.a) + size(f.b);
}

// ── Printing ─────────────────────────────────────────────────────────────────

const SYMBOL: Record<BinOp, string> = { and: '∧', or: '∨', imp: '→', iff: '↔', xor: '⊕', nand: '↑', nor: '↓' };
const TEX: Record<BinOp, string> = { and: '\\land', or: '\\lor', imp: '\\to', iff: '\\leftrightarrow', xor: '\\oplus', nand: '\\uparrow', nor: '\\downarrow' };
const PREC: Record<Formula['k'], number> = { var: 9, const: 9, not: 8, and: 7, nand: 7, or: 6, xor: 6, nor: 6, imp: 5, iff: 4 };

function print(f: Formula, sym: (op: BinOp) => string, notSym: string, paren: (s: string) => string, varName: (v: string) => string): string {
  const go = (g: Formula, parentPrec: number, rightOfImp = false): string => {
    let s: string;
    switch (g.k) {
      case 'var':
        return varName(g.name);
      case 'const':
        return g.value ? '⊤' : '⊥';
      case 'not':
        return notSym + go(g.a, PREC.not);
      default: {
        const p = PREC[g.k];
        // → is right-associative: a → (b → c) prints without brackets.
        const left = go(g.a, g.k === 'imp' ? p + 1 : p);
        const right = go(g.b, g.k === 'imp' ? p : p + 1, g.k === 'imp');
        s = `${left} ${sym(g.k)} ${right}`;
        return p < parentPrec || (p === parentPrec && !rightOfImp && g.k === 'imp') ? paren(s) : s;
      }
    }
  };
  return go(f, 0);
}

export function show(f: Formula): string {
  return print(f, (op) => SYMBOL[op], '¬', (s) => `(${s})`, (v) => v);
}

export function formulaTex(f: Formula): string {
  return print(
    f,
    (op) => TEX[op],
    '\\lnot ',
    (s) => `(${s})`,
    (v) => v.replace(/^([A-Za-z]+)(\d+)$/, '$1_{$2}'),
  ).replace(/⊤/g, '\\top').replace(/⊥/g, '\\bot');
}
