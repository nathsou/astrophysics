example (n : Nat) : n < n + 1 := by omega
example (a b : Nat) (h : a < b) : a + 1 ≤ b := by omega
example (a b c : Nat) (h1 : a ≤ b) (h2 : b ≤ c) : a ≤ c := by omega
example (a b : Nat) (h1 : a ≤ b) (h2 : b ≤ a) : a = b := by omega
example (x y : Nat) (h : 2 * x + 3 = y) : x < y := by omega
example (x : Nat) (h : x + 5 ≤ 3) : False := by omega
example (x y : Nat) (h : x ≠ y) (h2 : x ≤ y) : x < y := by omega
example (a b : Nat) : a + b = b + a := by omega
example (a b : Nat) (h : a ≤ b) : a ≤ b + 7 := by omega
example (a b : Nat) : a ≤ a * 2 := by omega
theorem a1 (n : Nat) (h : n ≥ 5) : n - 5 + 5 = n := by omega
theorem a2 (a b : Nat) : a - b ≤ a := by omega
theorem a3 (a b : Nat) (h : a < b) : a - b = 0 := by omega
theorem a4 (a b c : Nat) : a - b - c = a - (b + c) := by omega
theorem a6 (x : Nat) (h : x - 3 = 2) : x = 5 := by omega
