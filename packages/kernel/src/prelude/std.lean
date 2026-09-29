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

-- ---------------------------------------------------------------------------
-- arithmetic

namespace Nat

@[simp] theorem add_zero (n : Nat) : n + 0 = n := rfl
theorem add_succ (n m : Nat) : n + succ m = succ (n + m) := rfl
theorem add_one (n : Nat) : n + 1 = succ n := rfl
/-- simp writes successors as `n + 1` -/
@[simp] theorem succ_eq_add_one (n : Nat) : succ n = n + 1 := rfl

@[simp] theorem zero_add (n : Nat) : 0 + n = n := by
  induction n with
  | zero => rfl
  | succ n ih => rw [add_succ, ih]

theorem succ_add (n m : Nat) : succ n + m = succ (n + m) := by
  induction m with
  | zero => rfl
  | succ m ih => rw [add_succ, add_succ, ih]

theorem add_comm (n m : Nat) : n + m = m + n := by
  induction m with
  | zero => rw [zero_add]
  | succ m ih => rw [add_succ, succ_add, ih]

theorem add_assoc (n m k : Nat) : n + m + k = n + (m + k) := by
  induction k with
  | zero => rfl
  | succ k ih => rw [add_succ, add_succ, add_succ, ih]

theorem add_left_comm (n m k : Nat) : n + (m + k) = m + (n + k) := by
  rw [← add_assoc, ← add_assoc, add_comm n m]

theorem add_right_comm (n m k : Nat) : n + m + k = n + k + m := by
  rw [add_assoc, add_assoc, add_comm m k]

theorem succ_inj {n m : Nat} (h : succ n = succ m) : n = m := congrArg pred h

theorem succ_ne_zero (n : Nat) : succ n ≠ 0 := fun h => nomatch h

theorem add_right_cancel {n m k : Nat} : n + k = m + k → n = m := by
  induction k with
  | zero => intro h; exact h
  | succ k ih => intro h; exact ih (succ_inj h)

theorem add_left_cancel {n m k : Nat} : k + n = k + m → n = m := by
  intro h
  rw [add_comm k n, add_comm k m] at h
  exact add_right_cancel h

@[simp] theorem add_right_cancel_iff (n m k : Nat) : (n + k = m + k) = (n = m) :=
  propext ⟨add_right_cancel, fun h => h ▸ rfl⟩

@[simp] theorem add_left_cancel_iff (n m k : Nat) : (k + n = k + m) = (n = m) :=
  propext ⟨add_left_cancel, fun h => h ▸ rfl⟩

theorem eq_zero_of_add_eq_zero_left {n m : Nat} (h : n + m = 0) : m = 0 := by
  cases m with
  | zero => rfl
  | succ m => cases h

@[simp] theorem mul_zero (n : Nat) : n * 0 = 0 := rfl
theorem mul_succ (n m : Nat) : n * succ m = n * m + n := rfl

@[simp] theorem zero_mul (n : Nat) : 0 * n = 0 := by
  induction n with
  | zero => rfl
  | succ n ih => rw [mul_succ, ih]

@[simp] theorem mul_one (n : Nat) : n * 1 = n := by
  rw [mul_succ, mul_zero, zero_add]

theorem succ_mul (n m : Nat) : succ n * m = n * m + m := by
  induction m with
  | zero => rfl
  | succ m ih => rw [mul_succ, mul_succ, ih, add_succ, add_succ, add_right_comm]

@[simp] theorem one_mul (n : Nat) : 1 * n = n := by
  rw [succ_mul, zero_mul, zero_add]

theorem mul_comm (n m : Nat) : n * m = m * n := by
  induction m with
  | zero => rw [zero_mul]
  | succ m ih => rw [mul_succ, succ_mul, ih]

theorem left_distrib (n m k : Nat) : n * (m + k) = n * m + n * k := by
  induction k with
  | zero => rfl
  | succ k ih => rw [add_succ, mul_succ, mul_succ, ih, add_assoc]

theorem mul_add (n m k : Nat) : n * (m + k) = n * m + n * k := left_distrib n m k

theorem right_distrib (n m k : Nat) : (n + m) * k = n * k + m * k := by
  rw [mul_comm, left_distrib, mul_comm k n, mul_comm k m]

theorem add_mul (n m k : Nat) : (n + m) * k = n * k + m * k := right_distrib n m k

theorem mul_assoc (n m k : Nat) : n * m * k = n * (m * k) := by
  induction k with
  | zero => rfl
  | succ k ih => rw [mul_succ, mul_succ, ih, left_distrib]

-- ---------------------------------------------------------------------------
-- order

theorem le_refl (n : Nat) : n ≤ n := Nat.le.refl
theorem le_succ (n : Nat) : n ≤ n + 1 := Nat.le.step Nat.le.refl
theorem le_step {n m : Nat} (h : n ≤ m) : n ≤ m + 1 := Nat.le.step h
theorem lt_succ_self (n : Nat) : n < n + 1 := Nat.le.refl

theorem le_trans {n m k : Nat} (h₁ : n ≤ m) (h₂ : m ≤ k) : n ≤ k := by
  induction h₂ with
  | refl => exact h₁
  | step _ ih => exact Nat.le.step ih

theorem zero_le (n : Nat) : 0 ≤ n := by
  induction n with
  | zero => exact Nat.le.refl
  | succ n ih => exact Nat.le.step ih

theorem succ_le_succ {n m : Nat} (h : n ≤ m) : n + 1 ≤ m + 1 := by
  induction h with
  | refl => exact Nat.le.refl
  | step _ ih => exact Nat.le.step ih

theorem not_succ_le_zero (n : Nat) : ¬(n + 1 ≤ 0) := fun h => nomatch h

theorem le_of_succ_le_succ {n m : Nat} (h : n + 1 ≤ m + 1) : n ≤ m := by
  cases h with
  | refl => exact Nat.le.refl
  | step h' => exact le_trans (le_succ n) h'

theorem le_of_lt {n m : Nat} (h : n < m) : n ≤ m := le_trans (le_succ n) h
theorem lt_of_lt_of_le {n m k : Nat} (h₁ : n < m) (h₂ : m ≤ k) : n < k := le_trans h₁ h₂
theorem lt_of_le_of_lt {n m k : Nat} (h₁ : n ≤ m) (h₂ : m < k) : n < k := le_trans (succ_le_succ h₁) h₂
theorem lt_trans {n m k : Nat} (h₁ : n < m) (h₂ : m < k) : n < k := le_trans h₁ (le_of_lt h₂)
theorem lt_irrefl (n : Nat) : ¬(n < n) := by
  induction n with
  | zero => exact not_succ_le_zero 0
  | succ n ih => exact fun h => ih (le_of_succ_le_succ h)

theorem le_antisymm {n m : Nat} (h₁ : n ≤ m) (h₂ : m ≤ n) : n = m := by
  cases h₁ with
  | refl => rfl
  | step h => exact absurd (lt_of_le_of_lt h h₂) (lt_irrefl n)

theorem le_add_right (n k : Nat) : n ≤ n + k := by
  induction k with
  | zero => exact Nat.le.refl
  | succ k ih => exact Nat.le.step ih

theorem le_add_left (n k : Nat) : n ≤ k + n := by
  rw [add_comm]
  exact le_add_right n k

theorem lt_succ_of_le {n m : Nat} (h : n ≤ m) : n < m + 1 := succ_le_succ h
theorem le_of_lt_succ {n m : Nat} (h : n < m + 1) : n ≤ m := le_of_succ_le_succ h

def ble : Nat → Nat → Bool
  | 0, _ => Bool.true
  | _ + 1, 0 => Bool.false
  | n + 1, m + 1 => ble n m

def decLe : (n m : Nat) → Decidable (n ≤ m)
  | 0, m => Decidable.isTrue (zero_le m)
  | n + 1, 0 => Decidable.isFalse (not_succ_le_zero n)
  | n + 1, m + 1 =>
    match decLe n m with
    | Decidable.isTrue h => Decidable.isTrue (succ_le_succ h)
    | Decidable.isFalse h => Decidable.isFalse (fun h' => h (le_of_succ_le_succ h'))

end Nat

instance instDecidableLeNat (n m : Nat) : Decidable (n ≤ m) := Nat.decLe n m
instance instDecidableLtNat (n m : Nat) : Decidable (n < m) := Nat.decLe (n + 1) m

-- ---------------------------------------------------------------------------
-- lists

namespace List

@[simp] theorem nil_append {α : Type u} (as : List α) : [] ++ as = as := rfl
@[simp] theorem cons_append {α : Type u} (a : α) (as bs : List α) : (a :: as) ++ bs = a :: (as ++ bs) := rfl

@[simp] theorem append_nil {α : Type u} (as : List α) : as ++ [] = as := by
  induction as with
  | nil => rfl
  | cons a as ih => simp [ih]

@[simp] theorem append_assoc {α : Type u} (as bs cs : List α) : (as ++ bs) ++ cs = as ++ (bs ++ cs) := by
  induction as with
  | nil => rfl
  | cons a as ih => simp [ih]

@[simp] theorem length_nil {α : Type u} : length ([] : List α) = 0 := rfl
@[simp] theorem length_cons {α : Type u} (a : α) (as : List α) : length (a :: as) = length as + 1 := rfl

@[simp] theorem length_append {α : Type u} (as bs : List α) : length (as ++ bs) = length as + length bs := by
  induction as with
  | nil => simp
  | cons a as ih => simp [ih, Nat.succ_add]

@[simp] theorem map_nil {α : Type u} {β : Type v} (f : α → β) : map f [] = [] := rfl
@[simp] theorem map_cons {α : Type u} {β : Type v} (f : α → β) (a : α) (as : List α) : map f (a :: as) = f a :: map f as := rfl

@[simp] theorem map_append {α : Type u} {β : Type v} (f : α → β) (as bs : List α) : map f (as ++ bs) = map f as ++ map f bs := by
  induction as with
  | nil => rfl
  | cons a as ih => simp [ih]

end List
