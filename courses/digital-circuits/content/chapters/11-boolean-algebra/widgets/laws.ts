/**
 * The laws checker: are two Boolean expressions the same function? Checked by perfect induction, over every
 * assignment of the variables, with the first assignment that tells them apart as a counterexample.
 */
import { ExprError, STYLES, coverToText, evalExpr, exprToCover, exprVars, minimise, parseExpr, type Expr } from '$lib/pld/twolevel';

export const MAX_VARS = 6;

export interface LawsRow {
  m: number;
  env: Record<string, number>;
  left: number;
  right: number;
}

export type LawsResult =
  | {
      ok: true;
      vars: string[];
      rows: LawsRow[];
      equal: boolean;
      differing: number;
      counterexample?: LawsRow;
      /** The smallest sum of products of each side (Quine–McCluskey). */
      minimal: { left: string; right: string };
    }
  | { ok: false; side: 'left' | 'right' | 'both'; message: string; offset?: number };

function parse(text: string, side: 'left' | 'right'): { e: Expr } | { error: LawsResult } {
  if (!text.trim()) return { error: { ok: false, side, message: 'Type an expression.' } };
  try {
    return { e: parseExpr(text) };
  } catch (err) {
    if (err instanceof ExprError) return { error: { ok: false, side, message: err.message, offset: err.offset } };
    throw err;
  }
}

export function checkLaws(leftText: string, rightText: string): LawsResult {
  const l = parse(leftText, 'left');
  if ('error' in l) return l.error;
  const r = parse(rightText, 'right');
  if ('error' in r) return r.error;
  const vars = exprVars(r.e, exprVars(l.e, []));
  if (vars.length > MAX_VARS) return { ok: false, side: 'both', message: `That is ${vars.length} variables; the table stops at ${MAX_VARS} (64 rows).` };
  const n = vars.length;
  const rows: LawsRow[] = Array.from({ length: 2 ** n }, (_, m) => {
    const env = Object.fromEntries(vars.map((v, i) => [v, (m >> (n - 1 - i)) & 1]));
    return { m, env, left: evalExpr(l.e, (x) => env[x]!), right: evalExpr(r.e, (x) => env[x]!) };
  });
  const bad = rows.filter((x) => x.left !== x.right);
  const min = (e: Expr) => {
    const cover = exprToCover(e, vars);
    return coverToText(minimise(cover), vars, STYLES.c);
  };
  return {
    ok: true,
    vars,
    rows,
    equal: bad.length === 0,
    differing: bad.length,
    counterexample: bad[0],
    minimal: { left: n === 0 ? String(rows[0]!.left) : min(l.e), right: n === 0 ? String(rows[0]!.right) : min(r.e) },
  };
}

export interface Law {
  id: string;
  name: string;
  left: string;
  right: string;
  note: string;
}

export const LAWS: Law[] = [
  { id: 'dist2', name: 'Second distributive law', left: 'A + B & C', right: '(A + B) & (A + C)', note: 'The surprising one: OR distributes over AND, just as AND distributes over OR. Nothing like it holds in ordinary algebra.' },
  { id: 'dist1', name: 'Distributive law', left: 'A & (B | C)', right: 'A & B | A & C', note: 'AND distributes over OR, as in school algebra.' },
  { id: 'absorb', name: 'Absorption', left: 'A | A & B', right: 'A', note: 'If A is 1 the whole thing is 1; if A is 0, both terms are 0. B never matters.' },
  { id: 'demorgan1', name: 'De Morgan (NAND)', left: '!(A & B)', right: '!A | !B', note: 'Not both is the same as at least one is not.' },
  { id: 'demorgan2', name: 'De Morgan (NOR)', left: '!(A | B)', right: '!A & !B', note: 'Neither is the same as both are not.' },
  { id: 'xor', name: 'XOR as AND and OR', left: 'A ^ B', right: '(A | B) & !(A & B)', note: 'One of them, but not both.' },
  { id: 'consensus', name: 'Consensus', left: 'A & B | !A & C | B & C', right: 'A & B | !A & C', note: 'The third term is redundant: whenever B·C is 1, one of the other two already is.' },
  { id: 'wrong', name: 'A tempting mistake', left: '!(A & B)', right: '!A & !B', note: 'Pushing the bar through without changing AND to OR. The checker finds the row where it fails.' },
];
