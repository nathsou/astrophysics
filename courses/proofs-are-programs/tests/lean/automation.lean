theorem s1 (xs ys : List Nat) : (xs ++ []).length + 0 = xs.length := by simp
theorem s2 (p q : Prop) (hp : p) : p ∧ (q ∨ True) := by simp [hp]
theorem s3 (a b : Nat) (h : a = b) : a + 0 = b := by simp [h]
theorem s4 : 2 ^ 10 = 1024 := by decide
theorem s5 : [1, 2, 3].length = 3 ∧ 7 % 3 = 1 := by decide
theorem s6 (a b : Nat) (h1 : a < b) (h2 : b < 10) : a + 1 < 10 := by omega
theorem s7 (x y : Nat) : 2 * x + y ≠ 2 * x + y + 1 := by omega
theorem s8 (n : Nat) : n * n ≥ 0 := by omega
def double (n : Nat) : Nat := n + n
theorem s9 (n : Nat) : double n = 2 * n := by
  unfold double
  omega
theorem s10 (n : Nat) : double n = 2 * n := by simp [double]; omega
theorem s12 (xs : List Nat) (f : Nat → Nat) : (xs.map f).length = xs.length := by simp
theorem s13 (p : Nat → Prop) (h : ∀ n, p n) : p 3 ∧ p 4 := by simp [h]
theorem s14 : ∀ n : Nat, n < 5 → n * n < 25 := by decide
theorem s15 (a : Nat) (h : a + 3 = 7) : a = 4 := by simp at h; exact h
theorem s16 (a b : Nat) : a + b + 0 = b + a := by simp [Nat.add_comm]
theorem s17 (x : Nat) : x + 1 ≠ 0 := by simp
theorem s19 (xs : List Nat) : xs ++ [1] ≠ [] := by simp
theorem s20 (a b : Nat) (h : a ≤ b) : a * 2 ≤ b * 2 := by omega
theorem s21 (p q : Prop) (h : p ∧ q) : q := by simp_all
theorem s22 (a b c : Nat) (h1 : a = b) (h2 : b = c) : a = c := by simp_all
