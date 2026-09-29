import { describe, expect, it } from 'vitest';
import { enumerate, parseTy, showTm, asDecl } from '../src/engines/inhabit.ts';
import { run } from './util.ts';

const progs = (ty: string, limit = 12) => enumerate(parseTy(ty), limit).terms.map(showTm);

describe('inhabitant enumeration', () => {
  it('finds no program of α → β', () => {
    const e = enumerate(parseTy('α → β'));
    expect(e.terms).toEqual([]);
    expect(e.truncated).toBe(false);
  });
  it('finds only the identity for α → α', () => {
    expect(progs('α → α')).toEqual(['fun x => x']);
  });
  it('finds the two booleans for α → α → α', () => {
    expect(progs('α → α → α').sort()).toEqual(['fun x y => x', 'fun x y => y']);
  });
  it('finds the Church numerals for (α → α) → α → α', () => {
    const e = enumerate(parseTy('(α → α) → α → α'), 4);
    expect(e.terms.map(showTm)).toEqual(['fun f x => x', 'fun f x => f x', 'fun f x => f (f x)', 'fun f x => f (f (f x))']);
    expect(e.truncated).toBe(true);
  });
  it('counts the programs of the chapter 2 presets', () => {
    const count = (ty: string) => {
      const e = enumerate(parseTy(ty), 12);
      return e.truncated ? Infinity : e.terms.length;
    };
    for (const ty of ['α → β → α', '(α → β) → α → β', '(α → β → γ) → β → α → γ', '(α × β → γ) → α → β → γ', '(α → β → γ) → α × β → γ']) expect(count(ty)).toBe(1);
    expect(count('(α → γ) → (β → γ) → α → β → γ')).toBe(2);
    expect(count('α → (α → α) → α')).toBe(Infinity);
    expect(count('((α → β) → α) → α')).toBe(0);
  });
  it('swaps pairs', () => {
    expect(progs('α × β → β × α')).toEqual(['fun p => (p.2, p.1)']);
  });
  it('produces declarations the kernel accepts', () => {
    for (const ty of ['(α → β) → (β → γ) → α → γ', 'α × β → β × α', '(α → α) → α → α', '((α → β) → α) → (α → β) → β']) {
      const e = enumerate(parseTy(ty), 5);
      for (const t of e.terms) {
        const r = run(asDecl(parseTy(ty), t));
        expect(r.errors).toEqual([]);
      }
    }
  });
});

import { judge, parseF, theoremDecl, forces, showF } from '../src/engines/props.ts';

describe('propositional oracle', () => {
  const provable = [
    'p → p',
    'p ∧ q → q ∧ p',
    'p ∨ q → q ∨ p',
    '(p → q) → ¬q → ¬p',
    '¬(p ∨ q) ↔ ¬p ∧ ¬q',
    '¬¬(p ∨ ¬p)',
    '(p → q → r) ↔ (p ∧ q → r)',
    '((p → q) → p) → ¬¬p',
    '¬¬¬p → ¬p',
    'p ∧ (q ∨ r) → (p ∧ q) ∨ (p ∧ r)',
    '(p ∨ q → r) → (p → r) ∧ (q → r)',
    '((p ∨ ¬p) → False) → False',
    'False → p',
    'p → True',
    '(p ↔ q) → (q ↔ p)',
  ];
  it('proves intuitionistic tautologies, with terms the kernel accepts', () => {
    const src: string[] = [];
    provable.forEach((s, i) => {
      const f = parseF(s);
      const v = judge(f);
      expect(v.kind, s).toBe('provable');
      if (v.kind === 'provable') src.push(theoremDecl(f, v.term, `t${i}`));
    });
    const r = run(src.join('\n\n'));
    if (r.errors.length) console.log(src.join('\n\n'), r.errors);
    expect(r.errors).toEqual([]);
  });
  it('finds Kripke countermodels for classical-only laws', () => {
    for (const s of ['p ∨ ¬p', '¬¬p → p', '((p → q) → p) → p', '(p → q) ∨ (q → p)', '¬(p ∧ q) → ¬p ∨ ¬q', '(¬p → ¬q) → q → p']) {
      const f = parseF(s);
      const v = judge(f);
      expect(v.kind, s).toBe('classical');
      if (v.kind === 'classical') {
        expect(v.model, s).toBeDefined();
        expect(forces(v.model!, 0, f)).toBe(false);
      }
    }
  });
  it('finds falsifying valuations', () => {
    const v = judge(parseF('p → q'));
    expect(v.kind).toBe('false');
    expect(showF(parseF('¬¬p → p ∧ q'))).toBe('¬¬p → p ∧ q');
  });
});
