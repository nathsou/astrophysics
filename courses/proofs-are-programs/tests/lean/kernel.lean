inductive Tm where
  | var (i : Nat)
  | sort (l : Nat)
  | pi (A B : Tm)
  | lam (b : Tm)
  | app (f a : Tm)
  | ann (t T : Tm)
  | nat
  | zero
  | succ (n : Tm)
deriving DecidableEq

def Tm.shift (d c : Nat) : Tm → Tm
  | .var i => if i < c then .var i else .var (i + d)
  | .sort l => .sort l
  | .pi A B => .pi (A.shift d c) (B.shift d (c + 1))
  | .lam b => .lam (b.shift d (c + 1))
  | .app f a => .app (f.shift d c) (a.shift d c)
  | .ann t T => .ann (t.shift d c) (T.shift d c)
  | .nat => .nat
  | .zero => .zero
  | .succ n => .succ (n.shift d c)

/-- replace variable j by s (and lower the variables above j, whose binder disappears) -/
def Tm.subst : Tm → Nat → Tm → Tm
  | .var i, j, s => if i = j then s else if j < i then .var (i - 1) else .var i
  | .sort l, _, _ => .sort l
  | .pi A B, j, s => .pi (A.subst j s) (B.subst (j + 1) (s.shift 1 0))
  | .lam b, j, s => .lam (b.subst (j + 1) (s.shift 1 0))
  | .app f a, j, s => .app (f.subst j s) (a.subst j s)
  | .ann t T, j, s => .ann (t.subst j s) (T.subst j s)
  | .nat, _, _ => .nat
  | .zero, _, _ => .zero
  | .succ n, j, s => .succ (n.subst j s)

def Tm.norm : Nat → Tm → Tm
  | 0, t => t
  | fuel + 1, .app f a =>
    match f.norm fuel with
    | .lam b => (b.subst 0 (a.norm fuel)).norm fuel
    | f' => .app f' (a.norm fuel)
  | fuel + 1, .ann t _ => t.norm fuel
  | fuel + 1, .pi A B => .pi (A.norm fuel) (B.norm fuel)
  | fuel + 1, .lam b => .lam (b.norm fuel)
  | fuel + 1, .succ n => .succ (n.norm fuel)
  | _ + 1, t => t

def fuel : Nat := 100

def conv (a b : Tm) : Bool := a.norm fuel == b.norm fuel

def lookup : List Tm → Nat → Option Tm
  | [], _ => none
  | A :: _, 0 => some (A.shift 1 0)
  | _ :: Γ, i + 1 => (lookup Γ i).map (Tm.shift 1 0)

def expect (r : Option Tm) : Option Tm → Option Tm
  | none => r
  | some E =>
    match r with
    | some T => if conv T E then some E else none
    | none => none

def sortOf (T : Tm) : Option Nat :=
  match T.norm fuel with
  | .sort l => some l
  | _ => none

def tc (Γ : List Tm) : Tm → Option Tm → Option Tm
  | .var i, E => expect (lookup Γ i) E
  | .sort l, E => expect (some (.sort (l + 1))) E
  | .pi A B, E =>
    match (tc Γ A none).bind sortOf, (tc (A :: Γ) B none).bind sortOf with
    | some l₁, some l₂ => expect (some (.sort (Nat.max l₁ l₂))) E
    | _, _ => none
  | .lam b, some E =>
    match E.norm fuel with
    | .pi A B =>
      match tc (A :: Γ) b (some B) with
      | some _ => some E
      | none => none
    | _ => none
  | .lam _, none => none
  | .app f a, E =>
    match tc Γ f none with
    | some F =>
      match F.norm fuel with
      | .pi A B =>
        match tc Γ a (some A) with
        | some _ => expect (some (B.subst 0 a)) E
        | none => none
      | _ => none
    | none => none
  | .ann t T, E =>
    match (tc Γ T none).bind sortOf with
    | some _ =>
      match tc Γ t (some T) with
      | some _ => expect (some T) E
      | none => none
    | none => none
  | .nat, E => expect (some (.sort 0)) E
  | .zero, E => expect (some .nat) E
  | .succ n, E =>
    match tc Γ n (some .nat) with
    | some _ => expect (some .nat) E
    | none => none

-- the polymorphic identity: fun A x => x  :  (A : Type 0) → A → A
def idTy : Tm := .pi (.sort 0) (.pi (.var 0) (.var 1))
def idTm : Tm := .ann (.lam (.lam (.var 0))) idTy

#eval tc [] idTy none
#eval tc [] idTm none
#eval tc [] (.app idTm .nat) none
#eval tc [] (.app (.app idTm .nat) (.succ .zero)) none
#eval tc [] (.app (.app idTm .nat) .nat) none
#eval tc [] (.ann (.sort 0) (.sort 0)) none
-- a type that computes: (fun T => T) nat
#eval tc [] (.ann .zero (.app (.ann (.lam (.var 0)) (.pi (.sort 0) (.sort 0))) .nat)) none

example : tc [] idTm none = some idTy := by decide
example : tc [] (.ann (.sort 0) (.sort 0)) none = none := by decide

theorem subst_shift (t : Tm) (j : Nat) (s : Tm) : (t.shift 1 j).subst j s = t := by
  induction t generalizing j s with
  | var i =>
    by_cases h : i < j
    · have h₁ : i ≠ j := by omega
      have h₂ : ¬ j < i := by omega
      simp [Tm.shift, Tm.subst, h, h₁, h₂]
    · have h₁ : i + 1 ≠ j := by omega
      have h₂ : j < i + 1 := by omega
      simp [Tm.shift, Tm.subst, h, h₁, h₂]
  | sort l => rfl
  | pi A B ihA ihB => simp [Tm.shift, Tm.subst, ihA, ihB]
  | lam b ih => simp [Tm.shift, Tm.subst, ih]
  | app f a ihf iha => simp [Tm.shift, Tm.subst, ihf, iha]
  | ann t T iht ihT => simp [Tm.shift, Tm.subst, iht, ihT]
  | nat => rfl
  | zero => rfl
  | succ n ih => simp [Tm.shift, Tm.subst, ih]


example (i j : Nat) (h₂ : ¬ j < i) : (if j < i then Tm.var (i - 1) else Tm.var i) = Tm.var i := by rw [if_neg h₂]
example (i j : Nat) (h₂ : ¬ j < i) : (if j < i then i - 1 else i) = i := by rw [if_neg h₂]
