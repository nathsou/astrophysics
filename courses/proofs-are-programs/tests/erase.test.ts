import { describe, expect, it } from 'vitest';
import { run } from './util.ts';
import { eraseToString } from '@kernel/eval/erase.ts';

describe('erasure view', () => {
  it('removes types and proofs', () => {
    const r = run(`def pos : { n : Nat // 0 < n } := ⟨3, by decide⟩
def idN {α : Type} (a : α) : α := a
def twice (n : Nat) : Nat := idN (n + n)
def safeDiv (n d : Nat) (h : 0 < d) : Nat := n / d
def use (n : Nat) : Nat := safeDiv n 2 (by decide)`);
    const show = (n: string) => eraseToString(r.env, (r.env.get(n) as { value: import('@kernel/core/expr.ts').Expr }).value);
    for (const n of ['pos', 'idN', 'twice', 'safeDiv', 'use']) console.log(n, ':=', show(n));
    expect(show('pos')).toBe('Subtype.mk 3');
    expect(show('use')).toBe('fun n => safeDiv n 2');
  });
});
