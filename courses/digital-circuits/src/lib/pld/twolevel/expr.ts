/**
 * Boolean expressions as text, and conversion to and from covers.
 *
 * Syntax (precedence from tightest): NOT, AND, XOR, OR; parentheses; constants 0 and 1.
 *
 *   NOT  !a  ~a  /a  ¬a  a'
 *   AND  a & b   a && b   a * b   a · b   a ∧ b
 *   XOR  a ^ b   a ⊕ b
 *   OR   a | b   a || b   a + b   a # b   a ∨ b
 *
 * So `A & !B | C`, `A * /B + C` (PALASM/GALasm style) and `A·B' + C` all parse. Names are letters,
 * digits and underscores, starting with a letter or underscore.
 *
 * Truth tables use one row per line, inputs and outputs separated by `|`:
 *
 *   A B C | Y Z
 *   0 0 - | 1 0      '-' in an input: both values (a cube)
 *   1 1 1 | - 1      '-' (or x) in an output: don't care
 *
 * Unlisted input combinations are 0. The Berkeley PLA format of Espresso (.i/.o/.ilb/.ob/.p/.e,
 * type fd) is also read and written.
 */
import {
  ONE,
  ZERO,
  coverProduct,
  getVar,
  scc,
  setVar,
  universe,
  type Cover,
  type Cube,
} from './cube';
import { complement } from './unate';

export type Expr =
  | { kind: 'const'; value: 0 | 1 }
  | { kind: 'var'; name: string }
  | { kind: 'not'; arg: Expr }
  | { kind: 'and'; args: Expr[] }
  | { kind: 'or'; args: Expr[] }
  | { kind: 'xor'; args: Expr[] };

export class ExprError extends Error {
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(message);
    this.name = 'ExprError';
  }
}

type Tok = { t: 'name'; v: string; at: number } | { t: 'op'; v: string; at: number } | { t: 'const'; v: 0 | 1; at: number } | { t: 'end'; at: number };

const OPS: [string, string][] = [
  ['&&', '&'],
  ['||', '|'],
  ['&', '&'],
  ['*', '&'],
  ['·', '&'],
  ['∧', '&'],
  ['|', '|'],
  ['+', '|'],
  ['#', '|'],
  ['∨', '|'],
  ['^', '^'],
  ['⊕', '^'],
  ['!', '!'],
  ['~', '!'],
  ['/', '!'],
  ['¬', '!'],
  ["'", "'"],
  ['’', "'"],
  ['(', '('],
  [')', ')'],
];

function tokenise(text: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i));
    if (m) {
      out.push({ t: 'name', v: m[0], at: i });
      i += m[0].length;
      continue;
    }
    if (ch === '0' || ch === '1') {
      if (/[0-9A-Za-z_]/.test(text[i + 1] ?? '')) throw new ExprError(`Unexpected '${text.slice(i, i + 2)}'`, i);
      out.push({ t: 'const', v: ch === '1' ? 1 : 0, at: i });
      i++;
      continue;
    }
    const op = OPS.find(([s]) => text.startsWith(s, i));
    if (!op) throw new ExprError(`Unexpected character '${ch}'`, i);
    out.push({ t: 'op', v: op[1], at: i });
    i += op[0].length;
  }
  out.push({ t: 'end', at: text.length });
  return out;
}

export function parseExpr(text: string): Expr {
  const toks = tokenise(text);
  let p = 0;
  const peek = () => toks[p]!;
  const isOp = (v: string) => {
    const t = peek();
    return t.t === 'op' && t.v === v;
  };
  const parseOr = (): Expr => {
    const args = [parseXor()];
    while (isOp('|')) {
      p++;
      args.push(parseXor());
    }
    return args.length === 1 ? args[0]! : { kind: 'or', args };
  };
  const parseXor = (): Expr => {
    const args = [parseAnd()];
    while (isOp('^')) {
      p++;
      args.push(parseAnd());
    }
    return args.length === 1 ? args[0]! : { kind: 'xor', args };
  };
  const parseAnd = (): Expr => {
    const args = [parseNot()];
    while (isOp('&')) {
      p++;
      args.push(parseNot());
    }
    return args.length === 1 ? args[0]! : { kind: 'and', args };
  };
  const parseNot = (): Expr => {
    if (isOp('!')) {
      p++;
      return { kind: 'not', arg: parseNot() };
    }
    let e = parseAtom();
    while (isOp("'")) {
      p++;
      e = { kind: 'not', arg: e };
    }
    return e;
  };
  const parseAtom = (): Expr => {
    const t = peek();
    if (t.t === 'name') {
      p++;
      return { kind: 'var', name: t.v };
    }
    if (t.t === 'const') {
      p++;
      return { kind: 'const', value: t.v };
    }
    if (t.t === 'op' && t.v === '(') {
      p++;
      const e = parseOr();
      if (!isOp(')')) throw new ExprError("Expected ')'", peek().at);
      p++;
      return e;
    }
    throw new ExprError(t.t === 'end' ? 'Unexpected end of expression' : `Unexpected '${text.slice(t.at, t.at + 1)}'`, t.at);
  };
  const e = parseOr();
  if (peek().t !== 'end') throw new ExprError(`Unexpected '${text.slice(peek().at, peek().at + 1)}'`, peek().at);
  return e;
}

/** Variable names in order of first appearance. */
export function exprVars(e: Expr, into: string[] = []): string[] {
  switch (e.kind) {
    case 'var':
      if (!into.includes(e.name)) into.push(e.name);
      break;
    case 'not':
      exprVars(e.arg, into);
      break;
    case 'and':
    case 'or':
    case 'xor':
      for (const a of e.args) exprVars(a, into);
      break;
  }
  return into;
}

export function evalExpr(e: Expr, env: (name: string) => number): 0 | 1 {
  switch (e.kind) {
    case 'const':
      return e.value;
    case 'var':
      return env(e.name) ? 1 : 0;
    case 'not':
      return evalExpr(e.arg, env) ? 0 : 1;
    case 'and':
      return e.args.every((a) => evalExpr(a, env)) ? 1 : 0;
    case 'or':
      return e.args.some((a) => evalExpr(a, env)) ? 1 : 0;
    case 'xor':
      return (e.args.reduce((s, a) => s ^ evalExpr(a, env), 0) & 1) as 0 | 1;
  }
}

/** Convert an expression to a cover over the given variables (unknown names are an error). */
export function exprToCover(e: Expr, vars: string[]): Cover {
  const n = vars.length;
  const index = new Map(vars.map((v, i) => [v, i]));
  const rec = (x: Expr): Cube[] => {
    switch (x.kind) {
      case 'const':
        return x.value ? [universe(n)] : [];
      case 'var': {
        const i = index.get(x.name);
        if (i === undefined) throw new ExprError(`Unknown signal '${x.name}'`, 0);
        const c = universe(n);
        setVar(c, i, ONE);
        return [c];
      }
      case 'not': {
        if (x.arg.kind === 'var') {
          const i = index.get(x.arg.name);
          if (i === undefined) throw new ExprError(`Unknown signal '${x.arg.name}'`, 0);
          const c = universe(n);
          setVar(c, i, ZERO);
          return [c];
        }
        return complement(rec(x.arg), n);
      }
      case 'and':
        return x.args.reduce<Cube[]>((acc, a) => coverProduct({ n, cubes: acc }, { n, cubes: rec(a) }).cubes, [universe(n)]);
      case 'or':
        return scc(x.args.flatMap(rec), n);
      case 'xor': {
        let acc = rec(x.args[0]!);
        for (const a of x.args.slice(1)) {
          const b = rec(a);
          const nA = complement(acc, n);
          const nB = complement(b, n);
          acc = scc([...coverProduct({ n, cubes: acc }, { n, cubes: nB }).cubes, ...coverProduct({ n, cubes: nA }, { n, cubes: b }).cubes], n);
        }
        return acc;
      }
    }
  };
  return { n, cubes: rec(e) };
}

/** Parse an expression to a cover. Variables default to those of the expression, in order. */
export function parseSop(text: string, vars?: string[]): { vars: string[]; cover: Cover } {
  const e = parseExpr(text);
  const v = vars ?? exprVars(e);
  return { vars: v, cover: exprToCover(e, v) };
}

export interface FormatStyle {
  and: string;
  or: string;
  not: (name: string) => string;
  zero: string;
  one: string;
}

export const STYLES = {
  /** A & !B | C */
  c: { and: ' & ', or: ' | ', not: (s: string) => '!' + s, zero: '0', one: '1' },
  /** A * /B + C (PALASM, GALasm, galette) */
  galette: { and: ' * ', or: ' + ', not: (s: string) => '/' + s, zero: 'GND', one: 'VCC' },
  /** A·B̄ + C with a combining overline */
  math: { and: '·', or: ' + ', not: (s: string) => [...s].map((ch) => ch + '̅').join(''), zero: '0', one: '1' },
  /** AB' + C */
  prime: { and: '', or: ' + ', not: (s: string) => s + "'", zero: '0', one: '1' },
} satisfies Record<string, FormatStyle>;

export function cubeToText(c: Cube, vars: string[], style: FormatStyle = STYLES.c): string {
  const lits: string[] = [];
  for (let i = 0; i < vars.length; i++) {
    const v = getVar(c, i);
    if (v === ONE) lits.push(vars[i]!);
    else if (v === ZERO) lits.push(style.not(vars[i]!));
    else if (v === 0) return style.zero;
  }
  return lits.length ? lits.join(style.and) : style.one;
}

/** Print a cover as a sum of products. */
export function coverToText(F: Cover, vars: string[], style: FormatStyle = STYLES.c): string {
  if (F.cubes.length === 0) return style.zero;
  return F.cubes.map((c) => cubeToText(c, vars, style)).join(style.or);
}

export interface Equation {
  name: string;
  expr: Expr;
  text: string;
  line: number;
}

/** Parse "Y = expr" equations, one per line or separated by ';'. Lines starting with // or # are comments. */
export function parseEquations(text: string): Equation[] {
  const out: Equation[] = [];
  text.split('\n').forEach((raw, lineNo) => {
    const line = raw.replace(/\/\/.*$/, '');
    if (/^\s*#/.test(line)) return;
    for (const part of line.split(';')) {
      if (!part.trim()) continue;
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(part);
      if (!m) throw new ExprError(`Line ${lineNo + 1}: expected "name = expression"`, 0);
      out.push({ name: m[1]!, expr: parseExpr(m[2]!), text: m[2]!.trim(), line: lineNo + 1 });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Multi-output functions and truth tables

/** A multi-output function: per output, an on-set cover and a don't-care cover. */
export interface BoolFunction {
  inputs: string[];
  outputs: string[];
  on: Cover[];
  dc: Cover[];
}

function rowCube(bits: string, n: number, where: string): Cube {
  if (bits.length !== n) throw new Error(`${where}: expected ${n} input values, got ${bits.length}`);
  const c = universe(n);
  for (let i = 0; i < n; i++) {
    const ch = bits[i]!;
    if (ch === '0') setVar(c, i, ZERO);
    else if (ch === '1') setVar(c, i, ONE);
    else if (ch !== '-' && ch !== 'x' && ch !== 'X') throw new Error(`${where}: bad input value '${ch}'`);
  }
  return c;
}

/** Parse the `inputs | outputs` truth-table form. */
export function parseTruthTable(text: string): BoolFunction {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/(\/\/|#).*$/, '').trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('Empty truth table');
  const [head, ...rows] = lines;
  const [ins, outs] = head!.split('|');
  if (outs === undefined) throw new Error("Truth table header must separate inputs from outputs with '|'");
  const inputs = ins!.trim().split(/\s+/).filter(Boolean);
  const outputs = outs.trim().split(/\s+/).filter(Boolean);
  const n = inputs.length;
  const on: Cube[][] = outputs.map(() => []);
  const dc: Cube[][] = outputs.map(() => []);
  rows.forEach((row, r) => {
    const [a, b] = row.split('|');
    if (b === undefined) throw new Error(`Row ${r + 1}: missing '|'`);
    const where = `Row ${r + 1}`;
    const c = rowCube(a!.replace(/\s+/g, ''), n, where);
    const vals = b.replace(/\s+/g, '');
    if (vals.length !== outputs.length) throw new Error(`${where}: expected ${outputs.length} output values`);
    [...vals].forEach((ch, o) => {
      if (ch === '1') on[o]!.push(c);
      else if (ch === '-' || ch === 'x' || ch === 'X') dc[o]!.push(c);
      else if (ch !== '0') throw new Error(`${where}: bad output value '${ch}'`);
    });
  });
  return {
    inputs,
    outputs,
    on: on.map((cubes) => ({ n, cubes })),
    dc: dc.map((cubes) => ({ n, cubes })),
  };
}

/** Print a full truth table (small n only). `values(m)` gives '0', '1' or '-' per output. */
export function formatTruthTable(inputs: string[], outputs: string[], values: (m: number) => string[]): string {
  const n = inputs.length;
  const lines = [`${inputs.join(' ')} | ${outputs.join(' ')}`];
  for (let m = 0; m < 2 ** n; m++) {
    const bits = inputs.map((name, i) => String((m >>> (n - 1 - i)) & 1).padEnd(name.length));
    const outs = values(m).map((v, o) => v.padEnd(outputs[o]!.length));
    lines.push(`${bits.join(' ')} | ${outs.join(' ')}`.trimEnd());
  }
  return lines.join('\n');
}

/** Parse Berkeley PLA format (Espresso's input format; types f, fd and fr are read as on/dc). */
export function parsePla(text: string): BoolFunction {
  let ni = -1;
  let no = -1;
  let inputs: string[] | null = null;
  let outputs: string[] | null = null;
  let type = 'fd';
  const on: Cube[][] = [];
  const dc: Cube[][] = [];
  text.split('\n').forEach((raw, lineNo) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const where = `Line ${lineNo + 1}`;
    if (line.startsWith('.')) {
      const [kw, ...rest] = line.split(/\s+/);
      if (kw === '.i') ni = Number(rest[0]);
      else if (kw === '.o') no = Number(rest[0]);
      else if (kw === '.ilb') inputs = rest;
      else if (kw === '.ob') outputs = rest;
      else if (kw === '.type') type = rest[0] ?? 'fd';
      return;
    }
    if (ni < 0 || no < 0) throw new Error(`${where}: .i and .o must come before the terms`);
    while (on.length < no) {
      on.push([]);
      dc.push([]);
    }
    const parts = line.split(/\s+/);
    const inBits = parts.length > 1 ? parts.slice(0, -1).join('') : line.slice(0, ni);
    const outBits = parts.length > 1 ? parts[parts.length - 1]! : line.slice(ni);
    const c = rowCube(inBits, ni, where);
    [...outBits].forEach((ch, o) => {
      if (ch === '1' || ch === '4') on[o]!.push(c);
      else if (ch === '-' || ch === '2') {
        if (type !== 'f') dc[o]!.push(c);
      }
    });
  });
  const n = ni;
  while (on.length < no) {
    on.push([]);
    dc.push([]);
  }
  return {
    inputs: inputs ?? Array.from({ length: n }, (_, i) => `x${i}`),
    outputs: outputs ?? Array.from({ length: no }, (_, i) => `f${i}`),
    on: on.map((cubes) => ({ n, cubes })),
    dc: dc.map((cubes) => ({ n, cubes })),
  };
}

/** Write Berkeley PLA format (type fd). */
export function formatPla(f: BoolFunction): string {
  const n = f.inputs.length;
  const rows: string[] = [];
  const cubeStr = (c: Cube) => {
    let s = '';
    for (let i = 0; i < n; i++) s += '~01-'[getVar(c, i)]!;
    return s;
  };
  f.outputs.forEach((_, o) => {
    for (const c of f.on[o]!.cubes) rows.push(`${cubeStr(c)} ${f.outputs.map((_, k) => (k === o ? '1' : '0')).join('')}`);
    for (const c of f.dc[o]!.cubes) rows.push(`${cubeStr(c)} ${f.outputs.map((_, k) => (k === o ? '-' : '0')).join('')}`);
  });
  return [
    `.i ${n}`,
    `.o ${f.outputs.length}`,
    `.ilb ${f.inputs.join(' ')}`,
    `.ob ${f.outputs.join(' ')}`,
    '.type fd',
    `.p ${rows.length}`,
    ...rows,
    '.e',
    '',
  ].join('\n');
}

/** Build a multi-output function from equations over the given inputs (defaults: names in order of use). */
export function functionFromEquations(text: string, inputs?: string[]): BoolFunction {
  const eqs = parseEquations(text);
  const names = inputs ?? (() => {
    const seen: string[] = [];
    for (const e of eqs) exprVars(e.expr, seen);
    return seen.filter((v) => !eqs.some((e) => e.name === v));
  })();
  const n = names.length;
  return {
    inputs: names,
    outputs: eqs.map((e) => e.name),
    on: eqs.map((e) => exprToCover(e.expr, names)),
    dc: eqs.map(() => ({ n, cubes: [] })),
  };
}
