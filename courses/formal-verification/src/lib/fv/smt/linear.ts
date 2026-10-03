/**
 * Linear integer forms: Σ cᵢ·tᵢ + c where the tᵢ are "arithmetic atoms" (variables, function applications, array
 * reads, and products of two non-constants, which the linear solver treats as opaque). Arithmetic literals are
 * normalised to `form ≤ k`, `form ≥ k` or `form = k` with coprime integer coefficients; over the integers this
 * normalisation tightens bounds (x + y < 3 becomes x + y ≤ 2; 2x ≤ 5 becomes x ≤ 2), and an equation whose
 * coefficients' gcd does not divide the constant is false outright.
 */
import { gcd } from '../logic/rational';
import type { Term } from '../logic/term';

export interface Linear {
  coeffs: Map<Term, bigint>;
  constant: bigint;
}

/** Linearise an integer term. Non-linear products are kept as atoms. */
export function linearize(t: Term, scale = 1n, out: Linear = { coeffs: new Map(), constant: 0n }): Linear {
  switch (t.op) {
    case 'num':
      out.constant += scale * t.value!;
      return out;
    case 'add':
      for (const a of t.args) linearize(a, scale, out);
      return out;
    case 'sub':
      linearize(t.args[0]!, scale, out);
      linearize(t.args[1]!, -scale, out);
      return out;
    case 'neg':
      return linearize(t.args[0]!, -scale, out);
    case 'mul': {
      const [a, b] = t.args as [Term, Term];
      if (a.op === 'num') return linearize(b, scale * a.value!, out);
      if (b.op === 'num') return linearize(a, scale * b.value!, out);
      break;
    }
  }
  const c = (out.coeffs.get(t) ?? 0n) + scale;
  if (c === 0n) out.coeffs.delete(t);
  else out.coeffs.set(t, c);
  return out;
}

export type Rel = 'le' | 'ge' | 'eq';

export interface Constraint {
  /** Coprime integer coefficients, sorted by term id; the first is positive. */
  coeffs: [Term, bigint][];
  rel: Rel;
  k: bigint;
}

export type Normalized = { kind: 'const'; value: boolean } | { kind: 'constraint'; c: Constraint };

const floorDiv = (a: bigint, b: bigint) => {
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
};
const ceilDiv = (a: bigint, b: bigint) => -floorDiv(-a, b);

/** Normalise `lhs rel rhs` (rel among le, lt, ge, gt, eq) over the integers. */
export function normalize(op: 'le' | 'lt' | 'ge' | 'gt' | 'eq', lhs: Term, rhs: Term): Normalized {
  const l = linearize(lhs);
  linearize(rhs, -1n, l);
  // l.coeffs·t + l.constant  op  0
  let k = -l.constant;
  let rel: Rel;
  if (op === 'lt') {
    rel = 'le';
    k -= 1n;
  } else if (op === 'gt') {
    rel = 'ge';
    k += 1n;
  } else rel = op;
  let coeffs = [...l.coeffs].sort((a, b) => a[0].id - b[0].id);
  if (!coeffs.length) {
    const value = rel === 'le' ? 0n <= k : rel === 'ge' ? 0n >= k : k === 0n;
    return { kind: 'const', value };
  }
  if (coeffs[0]![1] < 0n) {
    coeffs = coeffs.map(([t, c]) => [t, -c]);
    k = -k;
    if (rel !== 'eq') rel = rel === 'le' ? 'ge' : 'le';
  }
  const g = coeffs.reduce((acc, [, c]) => gcd(acc, c), 0n);
  if (g > 1n) {
    coeffs = coeffs.map(([t, c]) => [t, c / g]);
    if (rel === 'eq') {
      if (k % g !== 0n) return { kind: 'const', value: false };
      k /= g;
    } else k = rel === 'le' ? floorDiv(k, g) : ceilDiv(k, g);
  }
  return { kind: 'constraint', c: { coeffs, rel, k } };
}

/** The constraint a negated literal asserts: ¬(f ≤ k) is f ≥ k+1, ¬(f ≥ k) is f ≤ k−1 (¬(f = k) is not a bound). */
export function negate(c: Constraint): Constraint | null {
  if (c.rel === 'eq') return null;
  return c.rel === 'le' ? { coeffs: c.coeffs, rel: 'ge', k: c.k + 1n } : { coeffs: c.coeffs, rel: 'le', k: c.k - 1n };
}

export const formKey = (coeffs: [Term, bigint][]) => coeffs.map(([t, c]) => `${c}*${t.id}`).join('+');
