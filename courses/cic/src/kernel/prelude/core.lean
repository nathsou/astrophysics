/-! The course prelude: a small fragment of Lean 4's core library,
    written in the course language and checked by the course kernel. -/

/-- The identity function. -/
def id {α : Sort u} (a : α) : α := a

/-- Function composition. -/
def Function.comp {α : Sort u} {β : Sort v} {δ : Sort w} (f : β → δ) (g : α → β) : α → δ :=
  fun x => f (g x)
infixr:90 " ∘ " => Function.comp

/-- The natural numbers: zero, and the successor of a natural number. -/
inductive Nat : Type where
  | zero : Nat
  | succ (n : Nat) : Nat

/-- The booleans. -/
inductive Bool : Type where
  | false : Bool
  | true : Bool

/-- Equality: the smallest reflexive relation. -/
inductive Eq : α → α → Prop where
  | refl (a : α) : Eq a a
infix:50 " = " => Eq

/-- The true proposition, with exactly one proof. -/
inductive True : Prop where
  | intro : True

/-- The false proposition: no constructors, hence no proofs. -/
inductive False : Prop

/-- Negation is implication into False. -/
def Not (a : Prop) : Prop := a → False
prefix:40 "¬" => Not

/-- Conjunction: a proof of `a ∧ b` is a pair of proofs. -/
structure And (a b : Prop) : Prop where
  intro ::
  left : a
  right : b
infixr:35 " ∧ " => And

/-- Disjunction: a proof of `a ∨ b` is a proof of one side, tagged. -/
inductive Or (a b : Prop) : Prop where
  | inl (h : a) : Or a b
  | inr (h : b) : Or a b
infixr:30 " ∨ " => Or

/-- Logical equivalence. -/
structure Iff (a b : Prop) : Prop where
  intro ::
  mp : a → b
  mpr : b → a
infix:20 " ↔ " => Iff

/-- Existential quantification: a witness together with a proof. -/
inductive Exists {α : Sort u} (p : α → Prop) : Prop where
  | intro (w : α) (h : p w) : Exists p

/-- Pairs. -/
structure Prod (α : Type u) (β : Type v) where
  mk ::
  fst : α
  snd : β
infixr:35 " × " => Prod

/-- Tagged unions. -/
inductive Sum (α : Type u) (β : Type v) where
  | inl (val : α) : Sum α β
  | inr (val : β) : Sum α β
infixr:30 " ⊕ " => Sum

/-- The type with one element. -/
inductive Unit : Type where
  | unit : Unit

/-- The type with no elements. -/
inductive Empty : Type

/-- Lists. -/
inductive List (α : Type u) where
  | nil : List α
  | cons (head : α) (tail : List α) : List α
infixr:67 " :: " => List.cons

/-- Optional values. -/
inductive Option (α : Type u) where
  | none : Option α
  | some (val : α) : Option α

/-- Dependent pairs. -/
structure Sigma {α : Type u} (β : α → Type v) where
  mk ::
  fst : α
  snd : β fst

/-- A value together with a proof that it satisfies a predicate. -/
structure Subtype {α : Sort u} (p : α → Prop) where
  mk ::
  val : α
  property : p val

-- ---------------------------------------------------------------------------
-- logic

theorem rfl {α : Sort u} {a : α} : a = a := Eq.refl a

theorem Eq.symm {α : Sort u} {a b : α} (h : a = b) : b = a :=
  Eq.rec (motive := fun x _ => x = a) rfl h

theorem Eq.trans {α : Sort u} {a b c : α} (h₁ : a = b) (h₂ : b = c) : a = c :=
  Eq.rec (motive := fun x _ => a = x) h₁ h₂

theorem Eq.subst {α : Sort u} {motive : α → Prop} {a b : α} (h₁ : a = b) (h₂ : motive a) : motive b :=
  Eq.rec (motive := fun x _ => motive x) h₂ h₁

theorem congrArg {α : Sort u} {β : Sort v} {a₁ a₂ : α} (f : α → β) (h : a₁ = a₂) : f a₁ = f a₂ :=
  Eq.rec (motive := fun x _ => f a₁ = f x) rfl h

def Ne {α : Sort u} (a b : α) : Prop := ¬(a = b)
infix:50 " ≠ " => Ne

def False.elim {C : Sort u} (h : False) : C :=
  False.rec (motive := fun _ => C) h

def absurd {a : Prop} {b : Sort v} (h₁ : a) (h₂ : ¬a) : b :=
  False.elim (h₂ h₁)

theorem trivial : True := True.intro

theorem Or.elim {a b c : Prop} (h : a ∨ b) (left : a → c) (right : b → c) : c :=
  Or.rec (motive := fun _ => c) left right h

-- ---------------------------------------------------------------------------
-- natural numbers

namespace Nat

def pred : Nat → Nat
  | zero => zero
  | succ n => n

def add : Nat → Nat → Nat
  | n, zero => n
  | n, succ m => succ (add n m)

def mul : Nat → Nat → Nat
  | _, zero => zero
  | n, succ m => add (mul n m) n

def sub : Nat → Nat → Nat
  | n, zero => n
  | n, succ m => pred (sub n m)

end Nat

infixl:65 " + " => Nat.add
infixl:70 " * " => Nat.mul
infixl:65 " - " => Nat.sub

/-- The order on natural numbers, as an inductive predicate. -/
inductive Nat.le (n : Nat) : Nat → Prop where
  | refl : Nat.le n n
  | step {m : Nat} (h : Nat.le n m) : Nat.le n (m + 1)

def Nat.lt (n m : Nat) : Prop := Nat.le (n + 1) m
def Nat.ge (n m : Nat) : Prop := Nat.le m n
def Nat.gt (n m : Nat) : Prop := Nat.lt m n
infix:50 " ≤ " => Nat.le
infix:50 " < " => Nat.lt
infix:50 " ≥ " => Nat.ge
infix:50 " > " => Nat.gt

-- ---------------------------------------------------------------------------
-- booleans

def not : Bool → Bool
  | Bool.true => Bool.false
  | Bool.false => Bool.true

def and : Bool → Bool → Bool
  | Bool.true, b => b
  | Bool.false, _ => Bool.false

def or : Bool → Bool → Bool
  | Bool.true, _ => Bool.true
  | Bool.false, b => b

-- ---------------------------------------------------------------------------
-- lists

namespace List

def append {α : Type u} : List α → List α → List α
  | nil, bs => bs
  | cons a as, bs => cons a (append as bs)

def length {α : Type u} : List α → Nat
  | nil => Nat.zero
  | cons _ as => Nat.succ (length as)

def map {α : Type u} {β : Type v} (f : α → β) : List α → List β
  | nil => nil
  | cons a as => cons (f a) (map f as)

end List

infixl:65 " ++ " => List.append

-- ---------------------------------------------------------------------------
-- well-founded relations

/-- `Acc r x`: every descending `r`-chain from `x` is finite. -/
inductive Acc {α : Sort u} (r : α → α → Prop) : α → Prop where
  | intro (x : α) (h : (y : α) → r y x → Acc r y) : Acc r x

/-- A relation is well-founded if every element is accessible. -/
inductive WellFounded {α : Sort u} (r : α → α → Prop) : Prop where
  | intro (h : (a : α) → Acc r a) : WellFounded r

init_quot

-- ---------------------------------------------------------------------------
-- Lean's three axioms

/-- Propositional extensionality: equivalent propositions are equal. -/
axiom propext {a b : Prop} : (a ↔ b) → a = b

/-- Related elements have equal classes in the quotient. -/
axiom Quot.sound {α : Sort u} {r : α → α → Prop} {a b : α} : r a b → Quot.mk r a = Quot.mk r b

/-- `Nonempty α` says that `α` has an element, without saying which. -/
inductive Nonempty (α : Sort u) : Prop where
  | intro (val : α) : Nonempty α

/-- The axiom of choice: an element of any nonempty type. It has no computational content. -/
axiom Classical.choice {α : Sort u} : Nonempty α → α
