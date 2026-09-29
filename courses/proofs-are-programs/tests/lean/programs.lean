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
example : 2 ^ 10 = 1024 := by decide
inductive Weekday where
  | monday | tuesday | wednesday | thursday | friday | saturday | sunday
def Weekday.isWeekend : Weekday → Bool
  | .saturday | .sunday => true
  | _ => false
def Weekday.next : Weekday → Weekday
  | monday => tuesday
  | tuesday => wednesday
  | wednesday => thursday
  | thursday => friday
  | friday => saturday
  | saturday => sunday
  | sunday => monday
example : Weekday.sunday.next = Weekday.monday := rfl
inductive Tree (α : Type) where
  | leaf
  | node (left : Tree α) (value : α) (right : Tree α)
def Tree.size {α : Type} : Tree α → Nat
  | .leaf => 0
  | .node l _ r => l.size + 1 + r.size
namespace Tree
def mirror {α : Type} : Tree α → Tree α
  | leaf => leaf
  | node l v r => node r.mirror v l.mirror
end Tree
def Foo.length (xs : List Nat) : Nat := xs.length
example : [1, 2, 3].map (· * 2) = [2, 4, 6] := rfl
example (n : Nat) (h : (n == 3) = true) : n = 3 := by simp at h; exact h
def anon {α : Type} [DecidableEq α] (a b : α) : Bool := decide (a = b)
