// Variable assignments and x-variants (section "Variable Assignments").
//
// A variable assignment s for M maps each variable to an element of |M|. Here an assignment is
// a finite map from variable indices to elements; variables it does not mention have no value
// (evaluating them is reported, never guessed). s[m/x] is the assignment that agrees with s
// except that it assigns m to x; the x-variants of s are exactly the assignments s[m/x].

import { varIndex, varName } from '../syntax/language.ts';

export type Assignment<E> = ReadonlyMap<number, E>;

/**
 * An assignment from entries keyed by variable index or by variable name ("x", "y", "x_0",
 * "v7"): assignment({ x: 1, y: 2 }) or assignment([[0, 1], [1, 2]]).
 */
export function assignment<E>(entries: Readonly<Record<string, E>> | Iterable<readonly [number, E]> = []): Assignment<E> {
  const out = new Map<number, E>();
  if (Symbol.iterator in Object(entries)) {
    for (const [i, e] of entries as Iterable<readonly [number, E]>) out.set(i, e);
    return out;
  }
  for (const [k, e] of Object.entries(entries as Record<string, E>)) {
    const i = /^\d+$/.test(k) ? Number(k) : varIndex(k);
    if (i === null) throw new Error(`“${k}” is not a variable`);
    out.set(i, e);
  }
  return out;
}

/** s[m/x]: agrees with s except that it assigns m to the variable x (given by index). */
export function variant<E>(s: Assignment<E>, x: number, m: E): Assignment<E> {
  const out = new Map(s);
  out.set(x, m);
  return out;
}

/** Whether s2 is an x-variant of s1: they differ at most in what they assign to x. */
export function isXVariant<E>(s1: Assignment<E>, s2: Assignment<E>, x: number): boolean {
  const vars = new Set([...s1.keys(), ...s2.keys()]);
  for (const y of vars) {
    if (y === x) continue;
    if (s1.has(y) !== s2.has(y) || s1.get(y) !== s2.get(y)) return false;
  }
  return true;
}

/** All x-variants s[m/x] of s, one for each m in the domain (in domain order). */
export function xVariants<E>(domain: readonly E[], s: Assignment<E>, x: number): Assignment<E>[] {
  return domain.map((m) => variant(s, x, m));
}

/** Every assignment of elements of the domain to the given variables (|domain|^n of them). */
export function allAssignments<E>(domain: readonly E[], vars: readonly number[], base: Assignment<E> = new Map()): Assignment<E>[] {
  let out: Assignment<E>[] = [base];
  for (const x of vars) out = out.flatMap((s) => xVariants(domain, s, x));
  return out;
}

/** "x ↦ 1, y ↦ 2" (by variable index order). */
export function showAssignment<E>(s: Assignment<E>, show: (e: E) => string = String): string {
  if (s.size === 0) return '(empty assignment)';
  return [...s.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([i, e]) => `${varName(i)} ↦ ${show(e)}`)
    .join(', ');
}
