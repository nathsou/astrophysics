/**
 * LTL over named propositions, for the trace lab and the `ltl` exercises: `always (req ~> grant)`,
 * `eventually always p`, `p until q`. Formulas are written in Vouch's syntax and parsed by its expression parser;
 * every plain name is a proposition.
 */
import type * as A from '../vouch/syntax/ast';
import { parseExpr } from '../vouch/syntax/parser';
import { and, F, Fev, G, not, or, T, U, X, type Ltl } from './ltl';

export interface PropFormula {
  ltl: Ltl;
  /** Proposition names, by atom id. */
  props: string[];
}

export function parseProp(text: string, known?: string[]): PropFormula | { error: string } {
  const r = parseExpr(text);
  const err = r.diagnostics.find((d) => d.severity === 'error');
  if (!r.expr || err) return { error: err?.message ?? 'This is not a formula.' };
  const props: string[] = [];
  const atom = (name: string): Ltl => {
    if (known && !known.includes(name)) throw new Error(`There is no proposition called “${name}”. Use ${known.map((k) => `\`${k}\``).join(', ')}.`);
    let i = props.indexOf(name);
    if (i < 0) i = props.push(name) - 1;
    return { k: 'atom', id: i };
  };
  const go = (x: A.Expr): Ltl => {
    switch (x.k) {
      case 'var':
        return atom(x.name);
      case 'bool':
        return x.value ? T : F;
      case 'unary':
        if (x.op === '!') return not(go(x.arg));
        if (x.op === 'always') return G(go(x.arg));
        if (x.op === 'eventually') return Fev(go(x.arg));
        if (x.op === 'next') return X(go(x.arg));
        break;
      case 'binary': {
        const a = () => go(x.left);
        const b = () => go(x.right);
        switch (x.op) {
          case '&&':
            return and(a(), b());
          case '||':
            return or(a(), b());
          case '==>':
            return or(not(a()), b());
          case '<==>': {
            const l = a();
            const m = b();
            return and(or(not(l), m), or(not(m), l));
          }
          case 'until':
            return U(a(), b());
          case '~>':
            return G(or(not(a()), Fev(b())));
        }
        break;
      }
    }
    throw new Error('Use propositions, !, &&, ||, ==>, <==>, always, eventually, next, until and ~> (leads to).');
  };
  try {
    return { ltl: go(r.expr), props };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** A lasso trace over named propositions: positions 0…n−1, then back to `loop` forever. */
export interface PropTrace {
  states: string[][];
  loop: number;
}
