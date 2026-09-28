// Church numerals and truth values as terms, and recognising them (up to α-equivalence).
//
// Chapter "Lambda Definability", section "Introduction": n̄ ≡ λf x. fⁿ(x), so 0̄ is λf x. x and
// 3̄ is λf x. f(f(f x)). Section "Truth Values and Relations": true ≡ λx.λy.x, false ≡ λx.λy.y.

import type { Term } from './term.ts';
import { app, lam, variable, withLabel } from './term.ts';

const OVERLINE = '̄';

/** The display label of n̄: each digit carries a combining overline ("2̄", "1̄0̄"). */
export function numeralLabel(n: number): string {
  return [...String(n)].map((d) => d + OVERLINE).join('');
}

/** The value of a numeral label ("2̄" → 2), or null. */
export function numeralOfLabel(label: string): number | null {
  const m = /^(?:[0-9]̄)+$/.test(label) ? label.replace(/̄/g, '') : null;
  return m === null ? null : Number(m);
}

/** The Church numeral n̄ ≡ λf.λx.fⁿ(x), labelled n̄. */
export function churchNumeral(n: number): Term {
  if (!Number.isInteger(n) || n < 0) throw new Error(`churchNumeral: ${n} is not a natural number`);
  let body: Term = variable('x');
  for (let i = 0; i < n; i++) body = app(variable('f'), body);
  return withLabel(lam('f', lam('x', body)), numeralLabel(n));
}

/** If M is (α-equivalent to) a Church numeral n̄, returns n; no reduction is done. */
export function numeralValue(t: Term): number | null {
  if (t.k !== 'abs' || t.body.k !== 'abs') return null;
  const f = t.param;
  const x = t.body.param;
  let cur = t.body.body;
  let n = 0;
  // Occurrences of f refer to the outer binder only if the inner one is a different name.
  while (cur.k === 'app' && f !== x && cur.fn.k === 'var' && cur.fn.name === f) {
    n++;
    cur = cur.arg;
  }
  return cur.k === 'var' && cur.name === x ? n : null;
}

/** true ≡ λx.λy.x, false ≡ λx.λy.y (labelled). */
export function churchBoolean(b: boolean): Term {
  return withLabel(lam('x', lam('y', variable(b ? 'x' : 'y'))), b ? 'true' : 'false');
}

/** If M is (α-equivalent to) true or false, returns it; no reduction is done. */
export function booleanValue(t: Term): boolean | null {
  if (t.k !== 'abs' || t.body.k !== 'abs' || t.body.body.k !== 'var') return null;
  const v = t.body.body.name;
  if (v === t.body.param) return false;
  if (v === t.param) return true;
  return null;
}
