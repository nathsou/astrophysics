// What happens when a restriction of the kernel is lifted.

import { For, createSignal } from 'solid-js';
import { Playground } from '../Playground.tsx';

interface Exploit {
  id: string;
  title: string;
  option: string;
  verdict: 'inconsistent' | 'harmless' | 'weaker';
  text: string;
  code: string;
}

const EXPLOITS: Exploit[] = [
  {
    id: 'tit',
    title: 'Type : Type',
    option: 'kernel.typeInType',
    verdict: 'inconsistent',
    text: 'Collapsing the universe hierarchy lets Girard’s paradox through (here in Hurkens’ version, Chapter 10). The proof of False does not normalise.',
    code: `set_option kernel.typeInType true
def P (X : Type) : Type := X → Prop
def U : Type := (X : Type) → (P (P X) → X) → P (P X)
def tau (t : P (P U)) : U := fun (X : Type) (f : P (P X) → X) (p : P X) => t (fun (x : U) => p (f (x X f)))
def sigma (s : U) : P (P U) := s U (fun t => tau t)
def Delta : P U := fun y => (∀ (p : P U), sigma y p → p (tau (sigma y))) → False
def Omega : U := tau (fun p => ∀ (x : U), sigma x p → p x)
def D : Prop := ∀ (p : P U), sigma Omega p → p (tau (sigma Omega))
theorem lem1 : ∀ (p : P U), (∀ (x : U), sigma x p → p x) → p Omega :=
  fun p H1 => H1 Omega (fun x => H1 (tau (sigma x)))
theorem lem2 : D → False :=
  fun d => d Delta (fun x H2 H3 => H3 Delta H2 (fun p => H3 (fun y => p (tau (sigma y))))) (fun p => d (fun y => p (tau (sigma y))))
theorem lem3 : D := fun p => lem1 (fun y => p (tau (sigma y)))
theorem paradox : False := lem2 lem3`,
  },
  {
    id: 'pos',
    title: 'Non-positive types',
    option: 'kernel.positivity',
    verdict: 'inconsistent',
    text: 'A constructor that consumes its own type allows self-application (Chapter 12).',
    code: `set_option kernel.positivity false
inductive Bad : Type where
  | mk : (Bad → False) → Bad
def self (b : Bad) : False := match b with
  | Bad.mk f => f b
theorem oops : False := self (Bad.mk self)`,
  },
  {
    id: 'elim',
    title: 'Large elimination from Prop',
    option: 'kernel.restrictPropElim',
    verdict: 'inconsistent',
    text: 'Computing data from proofs contradicts proof irrelevance (Chapter 14).',
    code: `set_option kernel.restrictPropElim false
inductive MyOr (a b : Prop) : Prop where
  | inl (h : a) : MyOr a b
  | inr (h : b) : MyOr a b
def pick {a b : Prop} (h : MyOr a b) : Bool :=
  MyOr.rec (motive := fun _ => Bool) (fun _ => Bool.true) (fun _ => Bool.false) h
theorem same : pick (MyOr.inl trivial : MyOr True True) = pick (MyOr.inr trivial : MyOr True True) := rfl
theorem bad : Bool.true = Bool.false := same
theorem oops : False := nomatch bad`,
  },
  {
    id: 'rec',
    title: 'General recursion',
    option: '(not an option)',
    verdict: 'inconsistent',
    text: 'The elaborator refuses non-structural recursion, because `def bad : False := bad` would prove False. The kernel itself never sees recursive definitions.',
    code: `def bad : False := bad
theorem oops : False := bad`,
  },
  {
    id: 'impred',
    title: 'Predicative Prop',
    option: 'kernel.impredicativeProp',
    verdict: 'weaker',
    text: 'Making Prop predicative is safe, but polymorphic propositions such as ∀ p : Prop, p → p no longer live in Prop.',
    code: `set_option kernel.impredicativeProp false
#check ∀ (p : Prop), p → p
theorem id_prop : ∀ (p : Prop), p → p := fun p h => h`,
  },
  {
    id: 'pi',
    title: 'No proof irrelevance',
    option: 'kernel.proofIrrelevance',
    verdict: 'harmless',
    text: 'Without definitional proof irrelevance, distinct proofs are no longer definitionally equal; the logic stays consistent (Rocq works this way for its Prop).',
    code: `set_option kernel.proofIrrelevance false
theorem pi (p : Prop) (h₁ h₂ : p) : h₁ = h₂ := rfl`,
  },
  {
    id: 'eta',
    title: 'No η',
    option: 'kernel.eta',
    verdict: 'harmless',
    text: 'Without η, a function is not definitionally equal to its η-expansion. Consistent, but less convenient.',
    code: `set_option kernel.eta false
example (f : Nat → Nat) : (fun x => f x) = f := rfl`,
  },
];

export function BreakIt() {
  const [sel, setSel] = createSignal(0);
  const e = () => EXPLOITS[sel()];
  return (
    <div class="widget wide breakit">
      <div class="widget-head">
        <span class="widget-title">Break the kernel</span>
        <div class="seg" style={{ 'flex-wrap': 'wrap' }}>
          <For each={EXPLOITS}>
            {(x, i) => (
              <button class={sel() === i() ? 'on' : ''} onClick={() => setSel(i())}>
                {x.title}
              </button>
            )}
          </For>
        </div>
      </div>
      <div class="widget-body sans" style={{ 'font-size': '0.88rem' }}>
        <span class={`badge ${e().verdict === 'inconsistent' ? 'err' : e().verdict === 'weaker' ? 'warn' : 'ok'}`}>{e().verdict}</span> <code>{e().option}</code> — {e().text}
      </div>
      {(() => {
        const x = e();
        return <Playground code={x.code} title={x.title} class="breakit-pg" />;
      })()}
    </div>
  );
}
