inductive Ty where
  | nat
  | arrow (A B : Ty)
deriving DecidableEq

inductive Term where
  | var (i : Nat)
  | lit (n : Nat)
  | add (a b : Term)
  | lam (A : Ty) (body : Term)
  | app (f a : Term)

def lookup : List Ty → Nat → Option Ty
  | [], _ => none
  | A :: _, 0 => some A
  | _ :: Γ, i + 1 => lookup Γ i

inductive HasType : List Ty → Term → Ty → Prop where
  | var : lookup Γ i = some A → HasType Γ (.var i) A
  | lit : HasType Γ (.lit n) .nat
  | add : HasType Γ a .nat → HasType Γ b .nat → HasType Γ (.add a b) .nat
  | lam : HasType (A :: Γ) b B → HasType Γ (.lam A b) (.arrow A B)
  | app : HasType Γ f (.arrow A B) → HasType Γ a A → HasType Γ (.app f a) B

def infer (Γ : List Ty) : Term → Option Ty
  | .var i => lookup Γ i
  | .lit _ => some .nat
  | .add a b =>
    match infer Γ a, infer Γ b with
    | some .nat, some .nat => some .nat
    | _, _ => none
  | .lam A b =>
    match infer (A :: Γ) b with
    | some B => some (.arrow A B)
    | none => none
  | .app f a =>
    match infer Γ f, infer Γ a with
    | some (.arrow A B), some A' => if A = A' then some B else none
    | _, _ => none

#eval infer [] (.lam .nat (.add (.var 0) (.lit 1)))
#eval infer [] (.app (.lam .nat (.var 0)) (.lit 3))
#eval infer [] (.app (.lit 3) (.lit 3))

theorem infer_complete (h : HasType Γ t T) : infer Γ t = some T := by
  induction h with
  | var hl => simp [infer, hl]
  | lit => rfl
  | add _ _ iha ihb => simp [infer, iha, ihb]
  | lam _ ih => simp [infer, ih]
  | app _ _ ihf iha => simp [infer, ihf, iha]

theorem infer_sound (Γ : List Ty) (t : Term) (T : Ty) (h : infer Γ t = some T) : HasType Γ t T := by
  induction t generalizing Γ T with
  | var i => exact .var h
  | lit n =>
    simp [infer] at h
    rw [← h]
    exact .lit
  | add a b iha ihb =>
    simp only [infer] at h
    cases ha : infer Γ a with
    | none => simp [ha] at h
    | some A =>
      cases hb : infer Γ b with
      | none => cases A <;> simp [ha, hb] at h
      | some B =>
        cases A with
        | arrow _ _ => simp [ha, hb] at h
        | nat =>
          cases B with
          | arrow _ _ => simp [ha, hb] at h
          | nat =>
            simp [ha, hb] at h
            rw [← h]
            exact .add (iha Γ .nat ha) (ihb Γ .nat hb)
  | lam A b ih =>
    simp only [infer] at h
    cases hb : infer (A :: Γ) b with
    | none => simp [hb] at h
    | some B =>
      simp [hb] at h
      rw [← h]
      exact .lam (ih (A :: Γ) B hb)
  | app f a ihf iha =>
    simp only [infer] at h
    cases hf : infer Γ f with
    | none => simp [hf] at h
    | some F =>
      cases ha : infer Γ a with
      | none => cases F <;> simp [hf, ha] at h
      | some A' =>
        cases F with
        | nat => simp [hf, ha] at h
        | arrow A B =>
          by_cases e : A = A'
          · simp [hf, ha, e] at h
            rw [← h]
            rw [← e] at ha
            exact .app (ihf Γ _ hf) (iha Γ _ ha)
          · simp [hf, ha, e] at h

instance typable (Γ : List Ty) (t : Term) : Decidable (∃ T, HasType Γ t T) :=
  match h : infer Γ t with
  | some T => isTrue ⟨T, infer_sound Γ t T h⟩
  | none => isFalse (fun ⟨T, hT⟩ => by rw [infer_complete hT] at h; cases h)

example : ∃ T, HasType [] (.lam .nat (.add (.var 0) (.lit 1))) T := by decide
example : ¬ ∃ T, HasType [] (.lam .nat (.app (.var 0) (.var 0))) T := by decide

example : HasType [] (.app (.lam .nat (.var 0)) (.lit 3)) .nat := infer_sound _ _ _ rfl

theorem arrow_ne (A B : Ty) : A ≠ .arrow A B := by
  induction A generalizing B with
  | nat => intro h; cases h
  | arrow A₁ A₂ ih₁ _ =>
    intro h
    injection h with h₁ h₂
    exact ih₁ A₂ h₁

example : HasType [] (.lam .nat (.add (.var 0) (.lit 1))) (.arrow .nat .nat) :=
  .lam (.add (.var rfl) .lit)

theorem type_unique (h₁ : HasType Γ t A) (h₂ : HasType Γ t B) : A = B := by
  have e := infer_complete h₁
  rw [infer_complete h₂] at e
  injection e with e
  exact e.symm

theorem no_self_app (A : Ty) : ¬ ∃ T, HasType [] (.lam A (.app (.var 0) (.var 0))) T := by
  intro ⟨T, h⟩
  cases h with
  | lam hb =>
    cases hb with
    | app hf ha =>
      cases hf with
      | var e₁ =>
        cases ha with
        | var e₂ =>
          simp [lookup] at e₁ e₂
          rw [e₂] at e₁
          exact arrow_ne _ _ e₁
