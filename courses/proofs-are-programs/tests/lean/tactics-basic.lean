theorem t1 (p q : Prop) : p ∧ q → q ∧ p := by
  intro h
  exact ⟨h.2, h.1⟩

theorem t2 (p q : Prop) : p ∧ q → q ∧ p := by
  intro ⟨hp, hq⟩
  constructor
  · exact hq
  · exact hp

theorem t3 (p q : Prop) : p ∨ q → q ∨ p := by
  intro h
  cases h with
  | inl hp => right; exact hp
  | inr hq => left; exact hq

theorem t4 (p q : Prop) : p ∨ q → q ∨ p := by
  rintro (hp | hq)
  · exact Or.inr hp
  · exact Or.inl hq

theorem t5 (n : Nat) : n + 0 = n := by rfl

theorem t6 : 2 + 2 = 4 := by decide

theorem t7 (a b : Nat) (h : a = b) : b = a := by
  rw [h]

theorem t8 (α : Type) (xs : List α) : List.append xs List.nil = xs := by
  induction xs with
  | nil => rfl
  | cons x xs ih => simp [List.append, ih]

theorem t9 (p : Prop) (h : False) : p := by contradiction

theorem t10 (x : Nat) (h : Nat.succ x = 0) : False := by
  cases h

theorem t11 : ∃ n : Nat, n + 1 = 3 := by
  exists 2

theorem t12 (n : Nat) : 0 + n = n := by
  induction n with
  | zero => rfl
  | succ n ih => simp [Nat.add, ih]
theorem r14 (p q : Prop) (h : p ∨ q) (hnp : ¬p) : q := by
  cases h with
  | inl hp => exact absurd hp hnp
  | inr hq => exact hq
theorem r14b (p q : Prop) (h : p ∨ q) (hnp : ¬p) : q := by
  cases h
  · contradiction
  · assumption
theorem r14c (p q : Prop) (hnp : ¬p) (h : p ∨ q) : q := by
  cases h with
  | inl hp => contradiction
  | inr hq => exact hq
theorem za' (n : Nat) : 0 + n = n := by
  induction n with
  | zero => rfl
  | succ n ih => rw [Nat.add_succ, ih]
theorem goal_shape (n : Nat) : n + 1 = Nat.succ n := by
  cases n with
  | zero => rfl
  | succ m => rfl
