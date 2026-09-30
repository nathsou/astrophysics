/**
 * A 4-input LUT as the course draws it: 16 bits and a tree of multiplexers. Conversions between a truth table and
 * an expression (for the LUT explorer and for naming what a hand-configured LUT computes).
 */
import { evalExpr, exprVars, parseExpr, ExprError } from '../../pld/twolevel/expr';
import { qmCover } from '../../pld/twolevel/qm';
import { cubeToString } from '../../pld/twolevel/cube';

export const LUT_NAMES = ['I0', 'I1', 'I2', 'I3'] as const;

/** Names accepted in an expression: I0…I3, or a…d / A…D. */
const ALIAS: Record<string, number> = { I0: 0, I1: 1, I2: 2, I3: 3, a: 0, b: 1, c: 2, d: 3, A: 0, B: 1, C: 2, D: 3 };

export class LutExpressionError extends Error {}

/** The truth table an expression over I0…I3 (or a…d) defines. Bit r is the output when I0 + 2·I1 + 4·I2 + 8·I3 = r. */
export function truthFromExpression(text: string): number {
  let expr;
  try {
    expr = parseExpr(text);
  } catch (e) {
    if (e instanceof ExprError) throw new LutExpressionError(e.message);
    throw e;
  }
  for (const v of exprVars(expr)) if (!(v in ALIAS)) throw new LutExpressionError(`${v} is not an input of a LUT: use I0, I1, I2 and I3 (or a, b, c, d)`);
  let truth = 0;
  for (let r = 0; r < 16; r++) if (evalExpr(expr, (name) => (r >> ALIAS[name]!) & 1)) truth |= 1 << r;
  return truth;
}

/** The inputs the output depends on. */
export function dependsOn(truth: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    let dep = false;
    for (let r = 0; r < 16 && !dep; r++) if (!((r >> i) & 1) && ((truth >> r) & 1) !== ((truth >> (r | (1 << i))) & 1)) dep = true;
    if (dep) out.push(i);
  }
  return out;
}

/** A readable expression for a truth table over the given input names (`I0 ^ I1`, `!I0 & I2 | I1 & I2`). */
export function lutExpression(truth: number, names: readonly string[] = LUT_NAMES): string {
  const t = truth & 0xffff;
  if (t === 0) return '0';
  if (t === 0xffff) return '1';
  const deps = dependsOn(t);
  const n = deps.length;
  const vars = deps.map((i) => names[i] ?? LUT_NAMES[i]!);
  // The table over the dependent inputs only: variable j of the reduced function is deps[j] (most significant first).
  const value = (m: number): number => {
    let r = 0;
    for (let j = 0; j < n; j++) if ((m >> (n - 1 - j)) & 1) r |= 1 << deps[j]!;
    return (t >> r) & 1;
  };
  const on: number[] = [];
  for (let m = 0; m < 1 << n; m++) if (value(m)) on.push(m);
  if (n >= 2) {
    const parity = on.every((m) => popcount(m) % 2 === 1) && on.length === 1 << (n - 1);
    const coparity = on.every((m) => popcount(m) % 2 === 0) && on.length === 1 << (n - 1);
    if (parity) return vars.join(' ^ ');
    if (coparity) return `!(${vars.join(' ^ ')})`;
  }
  if (n === 1) return on[0] === 1 ? vars[0]! : `!${vars[0]}`;
  const cover = qmCover(n, on);
  const terms = cover.cubes.map((c) => {
    const s = cubeToString(c, n);
    const lits: string[] = [];
    for (let j = 0; j < n; j++) if (s[j] === '1') lits.push(vars[j]!);
    else if (s[j] === '0') lits.push(`!${vars[j]}`);
    return lits.join(' & ') || '1';
  });
  return terms.join(' | ');
}

const popcount = (x: number): number => {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
};

/**
 * The values along the mux tree for a truth table and the inputs' levels: level 0 is the 16 stored bits, level 1
 * the 8 values after I0 has chosen (one of each pair), level 2 the 4 after I1, level 3 the 2 after I2, level 4 the
 * output after I3. `selected[l]` is the index chosen at each level (−1 where an input is unknown).
 */
export function muxTree(truth: number, inputs: readonly (0 | 1 | -1)[]): { levels: number[][]; selected: number[]; output: number } {
  const levels: number[][] = [Array.from({ length: 16 }, (_, r) => (truth >> r) & 1)];
  const selected: number[] = [];
  for (let l = 0; l < 4; l++) {
    const prev = levels[l]!;
    const sel = inputs[l] ?? 0;
    const next: number[] = [];
    for (let i = 0; i < prev.length / 2; i++) next.push(sel === -1 ? -1 : prev[2 * i + sel]!);
    // Unknown select: the pair only matters if the two agree.
    if (sel === -1) for (let i = 0; i < next.length; i++) next[i] = prev[2 * i] === prev[2 * i + 1] ? prev[2 * i]! : -1;
    levels.push(next);
    selected.push(sel === -1 ? -1 : sel);
  }
  return { levels, selected, output: levels[4]![0]! };
}

/** The LUT row for input levels (−1 if any is unknown). */
export const lutRow = (inputs: readonly (0 | 1 | -1)[]): number => {
  let r = 0;
  for (let i = 0; i < 4; i++) {
    const v = inputs[i] ?? 0;
    if (v === -1) return -1;
    r |= v << i;
  }
  return r;
};

export const hex4 = (truth: number): string => `0x${(truth & 0xffff).toString(16).padStart(4, '0')}`;
