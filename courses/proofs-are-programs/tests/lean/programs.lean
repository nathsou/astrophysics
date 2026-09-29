structure Point where
  x : Nat
  y : Nat
def p : Point := { x := 1, y := 2 }
def q : Point := { y := 4, x := 3 }
def Point.add (a b : Point) : Point := ⟨a.x + b.x, a.y + b.y⟩
example : (p.add q).x = 4 := rfl
def xs : List Nat := [1, 2, 3]
example : xs.map (fun n => n * 10) = [10, 20, 30] := rfl
example : xs.length = 3 := rfl
example : 17 / 5 = 3 := rfl
example : 17 % 5 = 2 := rfl
def pos : { n : Nat // 0 < n } := ⟨3, by decide⟩
def nonzero : Type := { x : Nat // x ≠ 0 }
def neg : Bool → Bool
  | true => false
  | false => true
example : neg true = false := rfl
example : (some 3 : Option Nat) ≠ none := by simp
def r : Point := { x := 1 } -- expect-error
def r2 : Point := { x := 1, y := 2, z := 3 } -- expect-error
