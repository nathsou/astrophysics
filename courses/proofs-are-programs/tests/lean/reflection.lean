inductive Form where
  | var (x : Nat)
  | tru
  | fls
  | and (a b : Form)
  | or (a b : Form)
  | imp (a b : Form)
  | not (a : Form)

def Form.denote (ρ : Nat → Prop) : Form → Prop
  | .var x => ρ x
  | .tru => True
  | .fls => False
  | .and a b => a.denote ρ ∧ b.denote ρ
  | .or a b => a.denote ρ ∨ b.denote ρ
  | .imp a b => a.denote ρ → b.denote ρ
  | .not a => ¬ a.denote ρ

def Form.eval (v : Nat → Bool) : Form → Bool
  | .var x => v x
  | .tru => true
  | .fls => false
  | .and a b => a.eval v && b.eval v
  | .or a b => a.eval v || b.eval v
  | .imp a b => !a.eval v || b.eval v
  | .not a => !a.eval v

/-- every variable of f is below f.bound -/
def Form.bound : Form → Nat
  | .var x => x + 1
  | .tru => 0
  | .fls => 0
  | .and a b => Nat.max a.bound b.bound
  | .or a b => Nat.max a.bound b.bound
  | .imp a b => Nat.max a.bound b.bound
  | .not a => a.bound

def setVar (v : Nat → Bool) (x : Nat) (b : Bool) : Nat → Bool :=
  fun y => if y = x then b else v y

/-- try every value of the variables below n -/
def checkAll : Nat → (Nat → Bool) → Form → Bool
  | 0, v, f => f.eval v
  | n + 1, v, f => checkAll n (setVar v n true) f && checkAll n (setVar v n false) f

def taut (f : Form) : Bool := checkAll f.bound (fun _ => false) f

#eval taut (.imp (.and (.var 0) (.var 1)) (.var 0))
#eval taut (.or (.var 0) (.not (.var 0)))
#eval taut (.imp (.var 0) (.var 1))

theorem eval_congr (f : Form) (v w : Nat → Bool) (h : ∀ y, y < f.bound → v y = w y) : f.eval v = f.eval w := by
  induction f with
  | var x => exact h x (by simp [Form.bound])
  | tru => rfl
  | fls => rfl
  | and a b iha ihb =>
    simp only [Form.eval]
    rw [iha (fun y hy => h y (by simp [Form.bound]; omega)), ihb (fun y hy => h y (by simp [Form.bound]; omega))]
  | or a b iha ihb =>
    simp only [Form.eval]
    rw [iha (fun y hy => h y (by simp [Form.bound]; omega)), ihb (fun y hy => h y (by simp [Form.bound]; omega))]
  | imp a b iha ihb =>
    simp only [Form.eval]
    rw [iha (fun y hy => h y (by simp [Form.bound]; omega)), ihb (fun y hy => h y (by simp [Form.bound]; omega))]
  | not a iha =>
    simp only [Form.eval]
    rw [iha (fun y hy => h y (by simp [Form.bound]; omega))]

theorem checkAll_sound (n : Nat) (v : Nat → Bool) (f : Form) (h : checkAll n v f = true) :
    ∀ w, (∀ y, n ≤ y → w y = v y) → f.eval w = true := by
  induction n generalizing v with
  | zero =>
    intro w hw
    have : w = v := funext (fun y => hw y (Nat.zero_le y))
    rw [this]
    exact h
  | succ n ih =>
    intro w hw
    simp [checkAll] at h
    cases hb : w n with
    | true =>
      apply ih (setVar v n true) h.1 w
      intro y hy
      by_cases hyn : y = n
      · simp [setVar, hyn, hb]
      · simp [setVar, hyn]
        exact hw y (by omega)
    | false =>
      apply ih (setVar v n false) h.2 w
      intro y hy
      by_cases hyn : y = n
      · simp [setVar, hyn, hb]
      · simp [setVar, hyn]
        exact hw y (by omega)

/-- w below n, and false above -/
def restrict (w : Nat → Bool) (n : Nat) : Nat → Bool := fun y => if y < n then w y else false

theorem taut_eval (f : Form) (h : taut f = true) (w : Nat → Bool) : f.eval w = true := by
  have h1 : f.eval w = f.eval (restrict w f.bound) :=
    eval_congr f w _ (fun y hy => by simp [restrict, hy])
  have h2 : f.eval (restrict w f.bound) = true :=
    checkAll_sound f.bound (fun _ => false) f h _ (fun y hy => by
      have : ¬ y < f.bound := by omega
      simp [restrict, this])
  rw [h1, h2]

theorem eval_denote (ρ : Nat → Prop) (v : Nat → Bool) (hv : ∀ x, v x = true ↔ ρ x) (f : Form) :
    f.eval v = true ↔ f.denote ρ := by
  induction f with
  | var x => exact hv x
  | tru => simp [Form.eval, Form.denote]
  | fls => simp [Form.eval, Form.denote]
  | and a b iha ihb => simp [Form.eval, Form.denote, iha, ihb]
  | or a b iha ihb => simp [Form.eval, Form.denote, iha, ihb]
  | imp a b iha ihb =>
    simp only [Form.eval, Form.denote]
    rw [← iha, ← ihb]
    cases a.eval v <;> cases b.eval v <;> simp
  | not a iha =>
    simp only [Form.eval, Form.denote]
    rw [← iha]
    cases a.eval v <;> simp

theorem taut_sound (f : Form) (h : taut f = true) (ρ : Nat → Prop) : f.denote ρ :=
  (eval_denote ρ (fun x => @decide (ρ x) (Classical.propDecidable (ρ x))) (fun x => by simp) f).mp (taut_eval f h _)

def atoms : List Prop → Nat → Prop
  | [], _ => False
  | p :: _, 0 => p
  | _ :: ps, n + 1 => atoms ps n

example (p q r : Prop) : (p → q) → (q → r) → p → r :=
  taut_sound (.imp (.imp (.var 0) (.var 1)) (.imp (.imp (.var 1) (.var 2)) (.imp (.var 0) (.var 2)))) rfl (atoms [p, q, r])

theorem peirce (p q : Prop) : ((p → q) → p) → p :=
  taut_sound (.imp (.imp (.imp (.var 0) (.var 1)) (.var 0)) (.var 0)) rfl (atoms [p, q])




inductive Even2 : Nat → Prop where
  | zero : Even2 0
  | add_two (n : Nat) (h : Even2 n) : Even2 (n + 2)

def isEven2 : Nat → Bool
  | 0 => true
  | 1 => false
  | n + 2 => isEven2 n

theorem isEven_sound : (n : Nat) → isEven2 n = true → Even2 n
  | 0, _ => .zero
  | 1, h => nomatch h
  | n + 2, h => by
    rw [isEven2] at h
    exact .add_two n (isEven_sound n h)

example : Even2 100 := isEven_sound 100 rfl

theorem small (x y : Nat) (h1 : x + y ≤ 3) (h2 : 5 ≤ x) : False := by omega

theorem foo : (n : Nat) → n + 0 = n
  | 0 => rfl
  | n + 1 => by
    have := foo n
    rfl

example (a b : Nat) (h : Nat.max a b < 3) : a < 3 ∧ b < 3 := by omega
example (a b : Nat) : Nat.min a b ≤ a := by omega

theorem t1 (f : Nat → Option Nat) (n : Nat) : (f n).isSome = true ∨ f n = none := by
  cases h : f n with
  | none => right; rfl
  | some k => left; rfl

theorem apply_unknown (h : ∀ w, (∀ y, 0 ≤ y → w y = 0) → w 1 = 0) : True := trivial
