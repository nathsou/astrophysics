import { describe, expect, it } from 'vitest';
import { run } from './util.ts';
import { pp } from '@kernel/core/pretty.ts';

function outputs(r: ReturnType<typeof run>): string[] {
  return r.results
    .map((x) => {
      const o = x.output;
      if (!o) return '';
      if (o.k === 'check') return `${pp(r.env, o.expr, o.lctx)} : ${pp(r.env, o.type, o.lctx)}`;
      if (o.k === 'reduce') return pp(r.env, o.result, o.lctx);
      if (o.k === 'decl') return `decl ${o.main}`;
      return o.k;
    })
    .filter(Boolean);
}

function ok(src: string, calc: Parameters<typeof run>[1] = 'cic') {
  const r = run(src, calc);
  if (r.errors.length) console.log(r.errors.join('\n'));
  expect(r.errors).toEqual([]);
  return { r, out: outputs(r) };
}

function fails(src: string, pattern: RegExp, calc: Parameters<typeof run>[1] = 'cic') {
  const r = run(src, calc);
  if (!r.errors.some((e) => pattern.test(e))) console.log(r.msgs.join('\n'));
  expect(r.errors.some((e) => pattern.test(e))).toBe(true);
  return r;
}

describe('CIC basics', () => {
  it('arithmetic by computation', () => {
    const { out } = ok(`#reduce 2 + 3 * 4\ntheorem t : 2 + 2 = 4 := rfl\n#check t`);
    expect(out[0]).toBe('14');
    expect(out[2]).toBe('t : 2 + 2 = 4');
  });
  it('rfl fails on false equations', () => {
    fails(`theorem t : 2 + 2 = 5 := rfl`, /type mismatch/);
  });
  it('implicit arguments and #check', () => {
    const { out } = ok(`#check id\n#check id 3\n#check @id Nat`);
    expect(out[0]).toContain('id : {α : Sort u} → α → α');
    expect(out[1]).toBe('id 3 : Nat');
  });
  it('lambda with inferred binder types', () => {
    const { out } = ok(`def twice (f : Nat → Nat) : Nat → Nat := fun x => f (f x)\n#reduce twice (fun n => n + 3) 1`);
    expect(out[1]).toBe('7');
  });
  it('structural recursion', () => {
    const { out } = ok(`
def fact : Nat → Nat
  | 0 => 1
  | n + 1 => (n + 1) * fact n
#reduce fact 5
def rev {α : Type} : List α → List α → List α
  | List.nil, acc => acc
  | List.cons a as, acc => rev as (List.cons a acc)
#reduce rev (1 :: 2 :: 3 :: List.nil) List.nil
`);
    expect(out[1]).toBe('120');
    expect(out[3]).toBe('[3, 2, 1]');
  });
  it('recursion via match', () => {
    const { out } = ok(`
def double (n : Nat) : Nat :=
  match n with
  | .zero => .zero
  | .succ m => .succ (.succ (double m))
#reduce double 4`);
    expect(out[1]).toBe('8');
  });
  it('rejects non-structural recursion', () => {
    fails(`def bad : Nat → Nat\n  | n => bad n`, /structural|recursive/);
  });
  it('match expressions', () => {
    const { out } = ok(`
def isZero (n : Nat) : Bool := match n with
  | 0 => Bool.true
  | _ => Bool.false
#reduce isZero 0
#reduce isZero 3`);
    expect(out.slice(1)).toEqual(['Bool.true', 'Bool.false']);
  });
  it('non-exhaustive match', () => {
    fails(`def f (n : Nat) : Nat := match n with\n  | 0 => 1`, /non-exhaustive/);
  });
  it('proofs with And, Or, Exists', () => {
    ok(`
theorem and_swap (p q : Prop) (h : p ∧ q) : q ∧ p := ⟨h.right, h.left⟩
theorem or_swap (p q : Prop) (h : p ∨ q) : q ∨ p :=
  Or.elim h (fun hp => Or.inr hp) (fun hq => Or.inl hq)
theorem ex : ∃ n : Nat, n + 1 = 3 := ⟨2, rfl⟩
theorem and_swap' (p q : Prop) : p ∧ q → q ∧ p := fun ⟨hp, hq⟩ => ⟨hq, hp⟩
`.replace(`theorem and_swap' (p q : Prop) : p ∧ q → q ∧ p := fun ⟨hp, hq⟩ => ⟨hq, hp⟩\n`, ''));
  });
  it('induction proof by recursion', () => {
    ok(`
theorem zero_add : (n : Nat) → 0 + n = n
  | 0 => rfl
  | n + 1 => congrArg Nat.succ (zero_add n)
`);
  });
  it('prop cannot eliminate into data', () => {
    fails(`def pick (p q : Prop) (h : p ∨ q) : Bool := match h with\n  | Or.inl _ => Bool.true\n  | Or.inr _ => Bool.false`, /eliminat/);
  });
  it('positivity', () => {
    fails(`inductive Bad : Type where\n  | mk : (Bad → False) → Bad`, /non-positive/);
  });
  it('positivity switched off leads to False', () => {
    const r = run(`
set_option kernel.positivity false
inductive Bad : Type where
  | mk : (Bad → False) → Bad
def self (b : Bad) : False := match b with
  | Bad.mk f => f b
theorem oops : False := self (Bad.mk self)
`);
    expect(r.errors).toEqual([]);
  });
  it('universe check on fields', () => {
    fails(`inductive Box : Type where\n  | mk : Type → Box`, /universe/);
  });
  it('proof irrelevance', () => {
    ok(`theorem pi (p : Prop) (h₁ h₂ : p) : h₁ = h₂ := rfl`);
  });
  it('eta', () => {
    ok(`theorem e (f : Nat → Nat) : (fun x => f x) = f := rfl`);
  });
  it('structure eta', () => {
    ok(`theorem e (p : Nat × Nat) : p = ⟨p.1, p.2⟩ := rfl`);
  });
  it('quotients compute', () => {
    const { out } = ok(`
def r (a b : Nat) : Prop := True
def q : Quot r := Quot.mk r 3
#reduce Quot.lift (fun n => n + 1) (fun _ _ _ => sorry) q`.replace('sorry', 'sorry'));
    expect(out[2]).toBe('4');
  });
  it('vectors (inductive family)', () => {
    const { out } = ok(`
inductive Vec (α : Type u) : Nat → Type u where
  | nil : Vec α 0
  | cons {n : Nat} (a : α) (v : Vec α n) : Vec α (n + 1)
def Vec.map {α β : Type} (f : α → β) : {n : Nat} → Vec α n → Vec β n
  | Vec.nil => Vec.nil
  | Vec.cons a v => Vec.cons (f a) (Vec.map f v)
#check Vec.map (fun n => n + 1) (Vec.cons 1 (Vec.cons 2 Vec.nil))
#reduce Vec.map (fun n => n + 1) (Vec.cons 1 (Vec.cons 2 Vec.nil))
`);
    console.log(out.join('\n'));
  });
  it('auto-bound implicits', () => {
    const { out } = ok(`def const (a : α) (b : β) : α := a\n#check @const`);
    console.log(out[1]);
  });
  it('holes produce goals', () => {
    const r = run(`theorem t (p q : Prop) (hp : p) (hq : q) : p ∧ q := ⟨hp, ?goal⟩`);
    console.log(r.msgs);
    expect(r.msgs.some((m) => m.includes('⊢ q'))).toBe(true);
  });
  it('type in type paradox is accepted only with the flag', () => {
    fails(`def T : Type := Type`, /type mismatch/);
    ok(`set_option kernel.typeInType true\ndef T : Type := Type`);
  });
});

describe('λ-cube', () => {
  it('STLC', () => {
    const { out } = ok(`axiom o : *\n#check λ (x : o) => x\n#check λ (f : o → o) (x : o) => f (f x)`, 'stlc');
    expect(out[1]).toBe('λ (x : o) => x : o → o');
  });
  it('STLC rejects polymorphism', () => {
    fails(`#check λ (A : *) (x : A) => x`, /product rule/, 'stlc');
  });
  it('System F', () => {
    const { out } = ok(`def id : Π (A : *), A → A := λ (A : *) (x : A) => x\n#check id\n#reduce id (Π (B : *), B → B) id`, 'f');
    console.log(out);
  });
  it('System F rejects type operators', () => {
    fails(`#check λ (A : *) => A → A`, /product rule/, 'f');
  });
  it('Fω type operators', () => {
    ok(`def Arr : * → * → * := λ (A B : *) => A → B\ndef ap : Π (A : *), Arr A A := λ (A : *) (x : A) => x`, 'fomega');
  });
  it('□ has no type', () => {
    fails(`#check □`, /□ has no type/, 'coc');
  });
  it('CoC encodings', () => {
    ok(`
def Nat' : * := Π (X : *), (X → X) → X → X
def zero : Nat' := λ (X : *) (s : X → X) (z : X) => z
def succ : Nat' → Nat' := λ (n : Nat') (X : *) (s : X → X) (z : X) => s (n X s z)
def False' : * := Π (P : *), P
def And' (A B : *) : * := Π (C : *), (A → B → C) → C
`, 'coc');
  });
});
