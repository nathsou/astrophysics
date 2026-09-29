inductive Vec (α : Type) : Nat → Type where
  | nil : Vec α 0
  | cons (x : α) (xs : Vec α n) : Vec α (n + 1)
def Vec.head {α : Type} {n : Nat} : Vec α (n + 1) → α
  | .cons x _ => x
def Vec.map {α β : Type} {n : Nat} (f : α → β) : Vec α n → Vec β n
  | .nil => .nil
  | .cons x xs => .cons (f x) (xs.map f)
def Vec.zip {α β : Type} {n : Nat} : Vec α n → Vec β n → Vec (α × β) n
  | .nil, .nil => .nil
  | .cons x xs, .cons y ys => .cons (x, y) (xs.zip ys)
def Vec.append {α : Type} {m n : Nat} : Vec α m → Vec α n → Vec α (n + m)
  | .nil, ys => ys
  | .cons x xs, ys => .cons x (xs.append ys)
def Vec.toList {α : Type} {n : Nat} : Vec α n → List α
  | .nil => []
  | .cons x xs => x :: xs.toList
def v : Vec Nat 3 := .cons 1 (.cons 2 (.cons 3 .nil))
example : v.head = 1 := rfl
#eval (v.zip (v.map (· * 10))).toList
def bad := (Vec.nil : Vec Nat 0).head -- expect-error
def half (n : { k : Nat // k % 2 = 0 }) : Nat := n.val / 2
example : half ⟨10, rfl⟩ = 5 := rfl
def succ' (n : Nat) : { m : Nat // m = n + 1 } := ⟨n + 1, rfl⟩
def big (xs : List Nat) : List Nat := xs.filter (fun x => 2 < x)
#test ∀ (xs ys : List Nat), (xs ++ ys).length = xs.length + ys.length
example : [1, 2] ≠ [1, 3] := by decide
example : (some 3, [true]) = (some 3, [true]) := by decide
