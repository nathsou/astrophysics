def sub_gcd (a b : Nat) : Nat :=
  if a = 0 then b
  else if b = 0 then a
  else if a ≤ b then sub_gcd a (b - a)
  else sub_gcd (a - b) b
termination_by a + b
#eval sub_gcd 12 18
def merge : List Nat → List Nat → List Nat
  | [], ys => ys
  | xs, [] => xs
  | x :: xs, y :: ys => if x ≤ y then x :: merge xs (y :: ys) else y :: merge (x :: xs) ys
termination_by xs ys => xs.length + ys.length
example : merge [1] [2] = [1, 2] := by simp [merge]
theorem merge_nil (xs : List Nat) : merge [] xs = xs := by rw [merge]
def halve : Nat → Nat
  | 0 => 0
  | 1 => 0
  | n + 2 => halve n + 1
termination_by n => n
example : halve 10 = 5 := by simp [halve]
def bad (n : Nat) : Nat := bad (n + 1) -- expect-error
termination_by n
