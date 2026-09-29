/-! The standard library of *Proofs Are Programs*, loaded after the core prelude.
    Everything here is written in the course language and checked by the
    course kernel; the tactics and `simp` rely on the lemmas it provides. -/

-- ---------------------------------------------------------------------------
-- equality

/-- Cast along an equation of types. -/
def Eq.mp {α β : Sort u} (h : α = β) (a : α) : β :=
  Eq.rec (motive := fun x _ => x) a h

/-- Cast backwards along an equation of types. -/
def Eq.mpr {α β : Sort u} (h : α = β) (b : β) : α :=
  Eq.rec (motive := fun x _ => x) b (Eq.symm h)

theorem congrFun {α : Sort u} {β : α → Sort v} {f g : (x : α) → β x} (h : f = g) (a : α) : f a = g a :=
  @Eq.rec _ f (fun (k : (x : α) → β x) (_ : f = k) => f a = k a) rfl g h

theorem congr {α : Sort u} {β : Sort v} {f₁ f₂ : α → β} {a₁ a₂ : α} (h₁ : f₁ = f₂) (h₂ : a₁ = a₂) : f₁ a₁ = f₂ a₂ :=
  Eq.trans (congrFun h₁ a₁) (congrArg f₂ h₂)

theorem Ne.symm {α : Sort u} {a b : α} (h : a ≠ b) : b ≠ a :=
  fun h' => h (Eq.symm h')

/-- Function extensionality, derived from quotients (as in Lean). -/
theorem funext {α : Sort u} {β : α → Sort v} {f g : (x : α) → β x} (h : ∀ x, f x = g x) : f = g :=
  let eqv (f g : (x : α) → β x) : Prop := ∀ x, f x = g x
  let extfunApp (f : Quot eqv) (x : α) : β x := Quot.lift (fun f => f x) (fun _ _ h => h x) f
  show extfunApp (Quot.mk eqv f) = extfunApp (Quot.mk eqv g) from congrArg extfunApp (Quot.sound (r := eqv) h)

-- ---------------------------------------------------------------------------
-- propositions as values of Prop

theorem Iff.refl (a : Prop) : a ↔ a := ⟨fun h => h, fun h => h⟩
theorem Iff.rfl {a : Prop} : a ↔ a := Iff.refl a
theorem Iff.symm {a b : Prop} (h : a ↔ b) : b ↔ a := ⟨h.mpr, h.mp⟩
theorem Iff.trans {a b c : Prop} (h₁ : a ↔ b) (h₂ : b ↔ c) : a ↔ c :=
  ⟨fun x => h₂.mp (h₁.mp x), fun x => h₁.mpr (h₂.mpr x)⟩

theorem not_false : ¬False := fun h => h
theorem of_eq_true {p : Prop} (h : p = True) : p := Eq.mpr h trivial
theorem eq_true {p : Prop} (h : p) : p = True := propext ⟨fun _ => trivial, fun _ => h⟩
theorem eq_false {p : Prop} (h : ¬p) : p = False := propext ⟨h, fun f => False.elim f⟩
theorem not_of_eq_false {p : Prop} (h : p = False) : ¬p := fun hp => Eq.mp h hp
theorem eq_self {α : Sort u} (a : α) : (a = a) = True := eq_true rfl

theorem implies_congr {p₁ p₂ q₁ q₂ : Prop} (h₁ : p₁ = p₂) (h₂ : q₁ = q₂) : (p₁ → q₁) = (p₂ → q₂) :=
  congr (congrArg (fun a b => a → b) h₁) h₂

theorem forall_congr {α : Sort u} {p q : α → Prop} (h : ∀ a, p a = q a) : (∀ a, p a) = (∀ a, q a) :=
  congrArg (fun P => ∀ a, P a) (funext h)

theorem And.left' {a b : Prop} (h : a ∧ b) : a := h.1

-- simp lemmas about the connectives
@[simp] theorem true_and (p : Prop) : (True ∧ p) = p := propext ⟨fun h => h.2, fun h => ⟨trivial, h⟩⟩
@[simp] theorem and_true (p : Prop) : (p ∧ True) = p := propext ⟨fun h => h.1, fun h => ⟨h, trivial⟩⟩
@[simp] theorem false_and (p : Prop) : (False ∧ p) = False := propext ⟨fun h => h.1, fun h => False.elim h⟩
@[simp] theorem and_false (p : Prop) : (p ∧ False) = False := propext ⟨fun h => h.2, fun h => False.elim h⟩
@[simp] theorem true_or (p : Prop) : (True ∨ p) = True := propext ⟨fun _ => trivial, fun _ => Or.inl trivial⟩
@[simp] theorem or_true (p : Prop) : (p ∨ True) = True := propext ⟨fun _ => trivial, fun _ => Or.inr trivial⟩
@[simp] theorem false_or (p : Prop) : (False ∨ p) = p :=
  propext ⟨fun h => Or.elim h (fun f => False.elim f) (fun x => x), fun h => Or.inr h⟩
@[simp] theorem or_false (p : Prop) : (p ∨ False) = p :=
  propext ⟨fun h => Or.elim h (fun x => x) (fun f => False.elim f), fun h => Or.inl h⟩
@[simp] theorem not_true_eq_false : (¬True) = False := propext ⟨fun h => h trivial, fun f => False.elim f⟩
@[simp] theorem not_false_eq_true : (¬False) = True := propext ⟨fun _ => trivial, fun _ h => h⟩
@[simp] theorem true_implies (p : Prop) : (True → p) = p := propext ⟨fun h => h trivial, fun h _ => h⟩
@[simp] theorem implies_true (α : Sort u) : (α → True) = True := propext ⟨fun _ => trivial, fun _ _ => trivial⟩
@[simp] theorem false_implies (p : Prop) : (False → p) = True := propext ⟨fun _ => trivial, fun _ f => False.elim f⟩
@[simp] theorem and_self (p : Prop) : (p ∧ p) = p := propext ⟨fun h => h.1, fun h => ⟨h, h⟩⟩
@[simp] theorem or_self (p : Prop) : (p ∨ p) = p := propext ⟨fun h => Or.elim h (fun x => x) (fun x => x), fun h => Or.inl h⟩
@[simp] theorem iff_self (p : Prop) : (p ↔ p) = True := eq_true (Iff.refl p)
@[simp] theorem ne_eq {α : Sort u} (a b : α) : (a ≠ b) = ¬(a = b) := rfl

-- ---------------------------------------------------------------------------
-- decidability

/-- A decision procedure for `p`: either a proof of `p` or a proof of `¬p`. -/
class inductive Decidable (p : Prop) : Type where
  | isFalse (h : ¬p) : Decidable p
  | isTrue (h : p) : Decidable p

/-- Run a decision procedure: `true` if the proposition holds. -/
def Decidable.decide (p : Prop) [h : Decidable p] : Bool :=
  match h with
  | Decidable.isFalse _ => Bool.false
  | Decidable.isTrue _ => Bool.true

/-- Types with a decision procedure for equality. -/
abbrev DecidableEq (α : Sort u) : Sort (max 1 u) := (a b : α) → Decidable (a = b)

/-- Decide whether `a = b`, using the type's `DecidableEq` instance. -/
def decEq {α : Sort u} [inst : DecidableEq α] (a b : α) : Decidable (a = b) := inst a b

theorem of_decide_eq_true {p : Prop} [inst : Decidable p] (h : Decidable.decide p = Bool.true) : p :=
  match inst, h with
  | Decidable.isTrue hp, _ => hp
  | Decidable.isFalse _, h => nomatch h

theorem of_decide_eq_false {p : Prop} [inst : Decidable p] (h : Decidable.decide p = Bool.false) : ¬p :=
  match inst, h with
  | Decidable.isFalse hp, _ => hp
  | Decidable.isTrue _, h => nomatch h

theorem decide_eq_true {p : Prop} [inst : Decidable p] (hp : p) : Decidable.decide p = Bool.true :=
  match inst with
  | Decidable.isTrue _ => rfl
  | Decidable.isFalse h => absurd hp h

theorem decide_eq_false {p : Prop} [inst : Decidable p] (hp : ¬p) : Decidable.decide p = Bool.false :=
  match inst with
  | Decidable.isFalse _ => rfl
  | Decidable.isTrue h => absurd h hp

/-- `if c then t else e` -/
def ite {α : Sort u} (c : Prop) [h : Decidable c] (t e : α) : α :=
  match h with
  | Decidable.isTrue _ => t
  | Decidable.isFalse _ => e

/-- `if h : c then t h else e h` -/
def dite {α : Sort u} (c : Prop) [h : Decidable c] (t : c → α) (e : ¬c → α) : α :=
  match h with
  | Decidable.isTrue hc => t hc
  | Decidable.isFalse hc => e hc

theorem if_pos {c : Prop} [h : Decidable c] (hc : c) {α : Sort u} {t e : α} : ite c t e = t :=
  match h with
  | Decidable.isTrue _ => rfl
  | Decidable.isFalse hnc => absurd hc hnc

theorem if_neg {c : Prop} [h : Decidable c] (hnc : ¬c) {α : Sort u} {t e : α} : ite c t e = e :=
  match h with
  | Decidable.isFalse _ => rfl
  | Decidable.isTrue hc => absurd hc hnc

theorem dif_pos {c : Prop} [h : Decidable c] (hc : c) {α : Sort u} {t : c → α} {e : ¬c → α} : dite c t e = t hc :=
  match h with
  | Decidable.isTrue _ => rfl
  | Decidable.isFalse hnc => absurd hc hnc

theorem dif_neg {c : Prop} [h : Decidable c] (hnc : ¬c) {α : Sort u} {t : c → α} {e : ¬c → α} : dite c t e = e hnc :=
  match h with
  | Decidable.isFalse _ => rfl
  | Decidable.isTrue hc => absurd hc hnc

instance instDecidableTrue : Decidable True := Decidable.isTrue trivial
instance instDecidableFalse : Decidable False := Decidable.isFalse (fun h => h)

instance instDecidableAnd {p q : Prop} [dp : Decidable p] [dq : Decidable q] : Decidable (p ∧ q) :=
  match dp with
  | Decidable.isTrue hp =>
    match dq with
    | Decidable.isTrue hq => Decidable.isTrue ⟨hp, hq⟩
    | Decidable.isFalse hq => Decidable.isFalse (fun h => hq h.2)
  | Decidable.isFalse hp => Decidable.isFalse (fun h => hp h.1)

instance instDecidableOr {p q : Prop} [dp : Decidable p] [dq : Decidable q] : Decidable (p ∨ q) :=
  match dp with
  | Decidable.isTrue hp => Decidable.isTrue (Or.inl hp)
  | Decidable.isFalse hp =>
    match dq with
    | Decidable.isTrue hq => Decidable.isTrue (Or.inr hq)
    | Decidable.isFalse hq => Decidable.isFalse (fun h => Or.elim h hp hq)

instance instDecidableNot {p : Prop} [dp : Decidable p] : Decidable (¬p) :=
  match dp with
  | Decidable.isTrue hp => Decidable.isFalse (fun h => h hp)
  | Decidable.isFalse hp => Decidable.isTrue hp

instance instDecidableImp {p q : Prop} [dp : Decidable p] [dq : Decidable q] : Decidable (p → q) :=
  match dp with
  | Decidable.isFalse hp => Decidable.isTrue (fun h => absurd h hp)
  | Decidable.isTrue hp =>
    match dq with
    | Decidable.isTrue hq => Decidable.isTrue (fun _ => hq)
    | Decidable.isFalse hq => Decidable.isFalse (fun h => hq (h hp))

instance instDecidableIff {p q : Prop} [dp : Decidable p] [dq : Decidable q] : Decidable (p ↔ q) :=
  match dp with
  | Decidable.isTrue hp =>
    match dq with
    | Decidable.isTrue hq => Decidable.isTrue ⟨fun _ => hq, fun _ => hp⟩
    | Decidable.isFalse hq => Decidable.isFalse (fun h => hq (h.mp hp))
  | Decidable.isFalse hp =>
    match dq with
    | Decidable.isTrue hq => Decidable.isFalse (fun h => hp (h.mpr hq))
    | Decidable.isFalse hq => Decidable.isTrue ⟨fun h => absurd h hp, fun h => absurd h hq⟩

-- ---------------------------------------------------------------------------
-- booleans

def Bool.decEq : (a b : Bool) → Decidable (a = b)
  | Bool.false, Bool.false => Decidable.isTrue rfl
  | Bool.false, Bool.true => Decidable.isFalse (fun h => nomatch h)
  | Bool.true, Bool.false => Decidable.isFalse (fun h => nomatch h)
  | Bool.true, Bool.true => Decidable.isTrue rfl

instance instDecidableEqBool : DecidableEq Bool := Bool.decEq

-- ---------------------------------------------------------------------------
-- natural numbers

def Nat.decEq : (n m : Nat) → Decidable (n = m)
  | Nat.zero, Nat.zero => Decidable.isTrue rfl
  | Nat.zero, Nat.succ _ => Decidable.isFalse (fun h => nomatch h)
  | Nat.succ _, Nat.zero => Decidable.isFalse (fun h => nomatch h)
  | Nat.succ n, Nat.succ m =>
    match Nat.decEq n m with
    | Decidable.isTrue h => Decidable.isTrue (congrArg Nat.succ h)
    | Decidable.isFalse h => Decidable.isFalse (fun h' => h (congrArg Nat.pred h'))

instance instDecidableEqNat : DecidableEq Nat := Nat.decEq
