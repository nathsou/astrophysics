theorem t2 {α : Sort u} {β : α → Sort v} {f g : (x : α) → β x} (h : ∀ x, f x = g x) : True :=
  let eqv (f g : (x : α) → β x) : Prop := ∀ x, f x = g x
  let q := Quot.sound (r := eqv) (a := f) h
  trivial
