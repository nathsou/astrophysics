/**
 * The gate compiler: a Boolean expression in, the series–parallel transistor networks of a static CMOS
 * gate out. Pure logic (no engines, no drawing); `gate.ts` draws the result and checks it against the
 * switch-level engine.
 *
 * Syntax (variables are single letters A–Z; spaces are ignored; an optional `Y =` in front is allowed):
 *
 *   NOT   !A  ~A  ¬A  A'  (a postfix prime)
 *   AND   A*B  A·B  A&B  A∧B, or just two things side by side: AB, A(B+C)
 *   XOR   A^B  A⊕B      (sugar for A·¬B + ¬A·B)
 *   OR    A+B  A|B  A∨B
 *
 * Precedence: NOT, then AND, then XOR, then OR.
 *
 * How it compiles. A static CMOS stage is a pull-down network (nMOS, between the output and ground) that
 * conducts when the output must be 0, and a pull-up network (pMOS, between +5 V and the output) that is
 * its dual: series and parallel swapped, the same signals on the gates. Because the pull-down conducts
 * when the *network expression* is 1, the stage computes the complement of that expression, so a gate
 * for Y = e needs a pull-down network for ¬e, written with every negation pushed onto a variable
 * (negation normal form, by De Morgan). A complemented variable costs an inverter. There is a second way
 * to build Y = e: a stage for ¬e followed by an inverter. The compiler builds both and keeps the smaller.
 */
import { leavesOf, stageTransistors, type Cell, type Net, type Stage } from '$lib/sim/expand/cells';

export type Expr = { op: 'var'; name: string } | { op: 'not'; a: Expr } | { op: 'and'; args: Expr[] } | { op: 'or'; args: Expr[] };

/** An expression with the negations pushed down to the variables (a literal is a variable or its complement). */
export type Nnf = { lit: string; neg: boolean } | { and: Nnf[] } | { or: Nnf[] };

export class ExprError extends Error {
  constructor(
    message: string,
    /** Index in the source text where the problem is, when there is one. */
    readonly at?: number,
  ) {
    super(message);
  }
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

type Tok = { t: 'var'; v: string; at: number } | { t: 'not' | 'and' | 'or' | 'xor' | 'lp' | 'rp' | 'prime'; at: number };

const SYMBOLS: Record<string, Tok['t']> = {
  '!': 'not', '~': 'not', '¬': 'not', "'": 'prime', '’': 'prime',
  '*': 'and', '·': 'and', '&': 'and', '∧': 'and', '.': 'and', '•': 'and',
  '+': 'or', '|': 'or', '∨': 'or',
  '^': 'xor', '⊕': 'xor',
  '(': 'lp', ')': 'rp',
};

function tokenise(src: string): Tok[] {
  const out: Tok[] = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (/\s/.test(ch)) continue;
    if (/[A-Za-z]/.test(ch)) out.push({ t: 'var', v: ch.toUpperCase(), at: i });
    else if (SYMBOLS[ch]) out.push({ t: SYMBOLS[ch]!, at: i } as Tok);
    else if (ch === '0' || ch === '1') throw new ExprError('Constants are not gates: a gate output is a function of its inputs. Use letters for inputs.', i);
    else throw new ExprError(`I do not know the symbol “${ch}”. Use letters for inputs and ! * + ^ ( ) for the operators.`, i);
  }
  return out;
}

const not = (a: Expr): Expr => ({ op: 'not', a });
const and = (args: Expr[]): Expr => (args.length === 1 ? args[0]! : { op: 'and', args });
const or = (args: Expr[]): Expr => (args.length === 1 ? args[0]! : { op: 'or', args });

/** Parse an expression. Throws `ExprError` with a message meant for the reader. */
export function parse(src: string): Expr {
  let text = src.trim();
  const eq = /^[Yy]\s*=\s*/.exec(text);
  if (eq) text = text.slice(eq[0].length);
  if (!text) throw new ExprError('Type an expression, for example !(A*(B+C)).');
  const offset = src.length - text.length;
  const toks = tokenise(text).map((t) => ({ ...t, at: t.at + offset }));
  let p = 0;
  const peek = () => toks[p];
  const fail = (msg: string, tok?: Tok): never => {
    throw new ExprError(msg, tok?.at ?? src.length);
  };

  // or := xor ('+' xor)*    xor := and ('^' and)*    and := unary (('*')? unary)*
  function parseOr(): Expr {
    const args = [parseXor()];
    while (peek()?.t === 'or') {
      p++;
      args.push(parseXor());
    }
    return or(args);
  }
  function parseXor(): Expr {
    let left = parseAnd();
    while (peek()?.t === 'xor') {
      p++;
      const right = parseAnd();
      left = or([and([left, not(right)]), and([not(left), right])]);
    }
    return left;
  }
  const startsUnary = (t: Tok | undefined) => t !== undefined && (t.t === 'var' || t.t === 'not' || t.t === 'lp');
  function parseAnd(): Expr {
    const args = [parseUnary()];
    for (;;) {
      const t = peek();
      if (t?.t === 'and') {
        p++;
        args.push(parseUnary());
      } else if (startsUnary(t)) args.push(parseUnary());
      else break;
    }
    return and(args);
  }
  function parseUnary(): Expr {
    const t = peek();
    if (!t) return fail('The expression ends too soon: something is missing after the last operator.');
    if (t.t === 'not') {
      p++;
      return not(parseUnary());
    }
    let e: Expr;
    if (t.t === 'var') {
      p++;
      e = { op: 'var', name: t.v };
    } else if (t.t === 'lp') {
      p++;
      e = parseOr();
      const close = peek();
      if (close?.t !== 'rp') return fail('A bracket is never closed.', t);
      p++;
    } else if (t.t === 'rp') return fail('A closing bracket has no opening one.', t);
    else return fail(`An operator (${text[t.at - offset]}) needs something in front of it.`, t);
    while (peek()?.t === 'prime') {
      p++;
      e = not(e);
    }
    return e;
  }

  const e = parseOr();
  const rest = peek();
  if (rest) fail(rest.t === 'rp' ? 'A closing bracket has no opening one.' : 'I did not expect that here.', rest);
  return e;
}

// ─── Evaluation and printing ─────────────────────────────────────────────────

export function variables(e: Expr): string[] {
  const seen = new Set<string>();
  const walk = (x: Expr): void => {
    if (x.op === 'var') seen.add(x.name);
    else if (x.op === 'not') walk(x.a);
    else x.args.forEach(walk);
  };
  walk(e);
  return [...seen].sort();
}

/** Evaluate under an assignment of 0/1 to the variables. */
export function evaluate(e: Expr, env: Record<string, number>): number {
  switch (e.op) {
    case 'var':
      return env[e.name] ? 1 : 0;
    case 'not':
      return 1 - evaluate(e.a, env);
    case 'and':
      return e.args.every((x) => evaluate(x, env)) ? 1 : 0;
    case 'or':
      return e.args.some((x) => evaluate(x, env)) ? 1 : 0;
  }
}

/** The expression as text, with the fewest brackets: `¬(A·(B+C))`. */
export function show(e: Expr): string {
  const go = (x: Expr, parent: 'or' | 'and' | 'not' | null): string => {
    switch (x.op) {
      case 'var':
        return x.name;
      case 'not':
        return `¬${go(x.a, 'not')}`;
      case 'and': {
        const s = x.args.map((a) => go(a, 'and')).join('·');
        return parent === 'not' ? `(${s})` : s;
      }
      case 'or': {
        const s = x.args.map((a) => go(a, 'or')).join(' + ');
        return parent === 'and' || parent === 'not' ? `(${s})` : s;
      }
    }
  };
  return go(e, null);
}

/** The same for a normal form; a complemented variable is written A′. */
export function showNnf(n: Nnf): string {
  const go = (x: Nnf, parent: 'or' | 'and' | null): string => {
    if ('lit' in x) return x.neg ? `${x.lit}′` : x.lit;
    if ('and' in x) return x.and.map((a) => go(a, 'and')).join('·');
    const s = x.or.map((a) => go(a, 'or')).join(' + ');
    return parent === 'and' ? `(${s})` : s;
  };
  return go(n, null);
}

// ─── Negation normal form ────────────────────────────────────────────────────

/** NNF of `e` (or of ¬e when `neg`), flattening nested ANDs and ORs. */
export function nnf(e: Expr, neg = false): Nnf {
  switch (e.op) {
    case 'var':
      return { lit: e.name, neg };
    case 'not':
      return nnf(e.a, !neg);
    case 'and':
    case 'or': {
      // De Morgan: ¬(a·b) = ¬a + ¬b and ¬(a + b) = ¬a·¬b.
      const isAnd = (e.op === 'and') !== neg;
      const kids = e.args.map((a) => nnf(a, neg));
      const flat = kids.flatMap((k) => (isAnd ? ('and' in k ? k.and : [k]) : 'or' in k ? k.or : [k]));
      return isAnd ? { and: flat } : { or: flat };
    }
  }
}

export function evalNnf(n: Nnf, env: Record<string, number>): number {
  if ('lit' in n) return (env[n.lit] ? 1 : 0) ^ (n.neg ? 1 : 0);
  if ('and' in n) return n.and.every((x) => evalNnf(x, env)) ? 1 : 0;
  return n.or.some((x) => evalNnf(x, env)) ? 1 : 0;
}

type Lit = { lit: string; neg: boolean };
const literals = (n: Nnf): Lit[] => ('lit' in n ? [n] : 'and' in n ? n.and.flatMap(literals) : n.or.flatMap(literals));

/** The signal on a transistor gate: `A`, or `An` for the complement of A (as in the library cells). */
export const signalOf = (l: Lit): string => (l.neg ? `${l.lit}n` : l.lit);

// ─── Networks ────────────────────────────────────────────────────────────────

/** Pull-down network: AND is series, OR is parallel; a leaf is a transistor on a literal's signal. */
function pullDown(n: Nnf): Net {
  if ('lit' in n) return { leaf: signalOf(n) };
  return 'and' in n ? { series: n.and.map(pullDown) } : { parallel: n.or.map(pullDown) };
}

/** The dual network: series and parallel swapped, the same signals (pMOS conduct when their gate is 0). */
export function dual(net: Net): Net {
  if ('leaf' in net) return net;
  return 'series' in net ? { parallel: net.series.map(dual) } : { series: net.parallel.map(dual) };
}

/** The complement of a gate signal: A ↔ An. */
const complement = (sig: string): string => (sig.length === 2 && sig.endsWith('n') ? sig[0]! : `${sig}n`);
export const signalLabel = (sig: string): string => (sig.length === 2 && sig.endsWith('n') ? `${sig[0]}′` : sig);

/**
 * When does the network conduct, as an expression over the input variables? Series is `·`, parallel is
 * `+`. An n-channel transistor conducts when its gate signal is 1 and a p-channel one (`p`) when it is 0,
 * so a pull-up network reads with every signal complemented.
 */
export function showNet(net: Net, p = false, parent: 'series' | 'parallel' | null = null): string {
  if ('leaf' in net) return signalLabel(p ? complement(net.leaf) : net.leaf);
  if ('series' in net) return net.series.map((n) => showNet(n, p, 'series')).join('·');
  const s = net.parallel.map((n) => showNet(n, p, 'parallel')).join(' + ');
  return parent === 'series' ? `(${s})` : s;
}

const inverter = (input: string, out: string): Stage => ({ out, pun: { leaf: input }, pdn: { leaf: input } });

export type Strategy = 'single' | 'inverted';

export interface Compiled {
  source: string;
  expr: Expr;
  /** Input variables, alphabetical. */
  inputs: string[];
  /** The cell: input inverters first, the main stage, then (for `inverted`) the output inverter. */
  cell: Cell;
  strategy: Strategy;
  /** The expression the main stage's pull-down network implements (its output is the complement of this). */
  pulledDown: Nnf;
  /** Pull-down and pull-up network of the main stage. */
  pdn: Net;
  pun: Net;
  transistors: number;
  /** Transistors in the main stage alone, and in the inverters around it. */
  core: number;
  helpers: number;
  /** The other way to build it, for comparison. */
  alternative: { strategy: Strategy; transistors: number };
}

const MAX_INPUTS = 5;
const MAX_TRANSISTORS = 36;

function build(expr: Expr, inputs: string[], strategy: Strategy): { cell: Cell; pulled: Nnf; pdn: Net; pun: Net } {
  // The stage's output is the complement of the expression its pull-down network implements ("pulled").
  // 'single': the stage drives Y itself, so pulled = ¬e. 'inverted': the stage drives m and an inverter
  // makes Y = ¬m, so m must be ¬e and pulled = e.
  const pulled = nnf(expr, strategy === 'single');
  const used = new Map<string, Lit>();
  for (const l of literals(pulled)) if (l.neg) used.set(l.lit, l);
  const stages: Stage[] = [...used.keys()].sort().map((v) => inverter(v, `${v}n`));
  const pdn = pullDown(pulled);
  const pun = dual(pdn);
  const out = strategy === 'single' ? 'Y' : 'm';
  stages.push({ out, pun, pdn });
  if (strategy === 'inverted') stages.push(inverter('m', 'Y'));
  return { cell: { inputs, stages }, pulled, pdn, pun };
}

const count = (cell: Cell) => cell.stages.reduce((n, s) => n + stageTransistors(s), 0);

/** Compile an expression (text or parsed) into a CMOS cell. Throws `ExprError`. */
export function compile(source: string | Expr): Compiled {
  const expr = typeof source === 'string' ? parse(source) : source;
  const inputs = variables(expr);
  if (inputs.length > MAX_INPUTS) throw new ExprError(`A gate with ${inputs.length} inputs is too big to draw legibly; ${MAX_INPUTS} at most.`);
  const a = build(expr, inputs, 'single');
  const b = build(expr, inputs, 'inverted');
  const ta = count(a.cell);
  const tb = count(b.cell);
  const strategy: Strategy = tb < ta ? 'inverted' : 'single';
  const pick = strategy === 'single' ? a : b;
  const transistors = strategy === 'single' ? ta : tb;
  if (transistors > MAX_TRANSISTORS) throw new ExprError(`That gate needs ${transistors} transistors; the drawing stops at ${MAX_TRANSISTORS}.`);
  const main = pick.cell.stages.find((s) => s.out === (strategy === 'single' ? 'Y' : 'm'))!;
  const core = stageTransistors(main);
  return {
    source: typeof source === 'string' ? source : show(source),
    expr,
    inputs,
    cell: pick.cell,
    strategy,
    pulledDown: pick.pulled,
    pdn: pick.pdn,
    pun: pick.pun,
    transistors,
    core,
    helpers: transistors - core,
    alternative: strategy === 'single' ? { strategy: 'inverted', transistors: tb } : { strategy: 'single', transistors: ta },
  };
}

// ─── Truth table ─────────────────────────────────────────────────────────────

export interface Row {
  /** Input values in the order of `inputs`. */
  bits: number[];
  env: Record<string, number>;
  expected: number;
}

/** Every input row of the expression, in binary counting order (the first variable is the most significant bit). */
export function rows(c: Pick<Compiled, 'expr' | 'inputs'>): Row[] {
  const n = c.inputs.length;
  return Array.from({ length: 1 << n }, (_, i) => {
    const bits = c.inputs.map((_, j) => (i >> (n - 1 - j)) & 1);
    const env = Object.fromEntries(c.inputs.map((v, j) => [v, bits[j]!]));
    return { bits, env, expected: evaluate(c.expr, env) };
  });
}

// ─── Sizing ──────────────────────────────────────────────────────────────────

/** How much wider a p-channel transistor must be to carry as much current as an n-channel one (hole vs electron mobility). */
export const MOBILITY_RATIO = 2;

/**
 * Width of every transistor, in units of the smallest n-channel transistor, so that the *worst-case*
 * conducting path of each network is as strong as the unit inverter's (one nMOS of width 1, one pMOS
 * of width `MOBILITY_RATIO`). A path through k transistors in series is k times as resistive, so each
 * must be k times as wide; a parallel branch that may be the only one conducting gets no discount.
 * Returned in the order of `transistorsOf(cell)`: per stage, the pull-up's transistors, then the pull-down's.
 */
export function widths(cell: Cell): number[] {
  const size = (net: Net, need: number, p: boolean): number[] => {
    if ('leaf' in net) return [need * (p ? MOBILITY_RATIO : 1)];
    if ('series' in net) return net.series.flatMap((n) => size(n, need * net.series.length, p));
    return net.parallel.flatMap((n) => size(n, need, p));
  };
  return cell.stages.flatMap((s) => [...size(s.pun, 1, true), ...size(s.pdn, 1, false)]);
}

export const totalWidth = (cell: Cell): number => widths(cell).reduce((a, b) => a + b, 0);

/** Signals on the transistor gates, in the same order as `widths`. */
export const gateSignals = (cell: Cell): string[] => cell.stages.flatMap((s) => [...leavesOf(s.pun), ...leavesOf(s.pdn)]);
