inductive Ty where
  | nat
  | bool
deriving DecidableEq

inductive Tm where
  | lit (n : Nat)
  | tt
  | ff
  | add (a b : Tm)
  | isZero (a : Tm)
  | if_ (c t e : Tm)
deriving DecidableEq

inductive HasType : Tm → Ty → Prop where
  | lit : HasType (.lit n) .nat
  | tt : HasType .tt .bool
  | ff : HasType .ff .bool
  | add : HasType a .nat → HasType b .nat → HasType (.add a b) .nat
  | isZero : HasType a .nat → HasType (.isZero a) .bool
  | if_ : HasType c .bool → HasType t T → HasType e T → HasType (.if_ c t e) T

inductive Value : Tm → Prop where
  | lit : Value (.lit n)
  | tt : Value .tt
  | ff : Value .ff

inductive Step : Tm → Tm → Prop where
  | addLit : Step (.add (.lit n) (.lit m)) (.lit (n + m))
  | addL : Step a a' → Step (.add a b) (.add a' b)
  | addR : Value a → Step b b' → Step (.add a b) (.add a b')
  | isZeroZero : Step (.isZero (.lit 0)) .tt
  | isZeroSucc : Step (.isZero (.lit (n + 1))) .ff
  | isZeroArg : Step a a' → Step (.isZero a) (.isZero a')
  | ifTrue : Step (.if_ .tt t e) t
  | ifFalse : Step (.if_ .ff t e) e
  | ifCond : Step c c' → Step (.if_ c t e) (.if_ c' t e)

theorem nat_canonical (h : HasType v .nat) (hv : Value v) : ∃ n, v = .lit n := by
  cases hv with
  | lit => exact ⟨_, rfl⟩
  | tt => cases h
  | ff => cases h

theorem bool_canonical (h : HasType v .bool) (hv : Value v) : v = .tt ∨ v = .ff := by
  cases hv with
  | lit => cases h
  | tt => exact .inl rfl
  | ff => exact .inr rfl

theorem progress (h : HasType t T) : Value t ∨ ∃ t', Step t t' := by
  induction h with
  | lit => exact .inl .lit
  | tt => exact .inl .tt
  | ff => exact .inl .ff
  | add ha hb iha ihb =>
    right
    cases iha with
    | inr hs =>
      obtain ⟨a', ha'⟩ := hs
      exact ⟨_, .addL ha'⟩
    | inl va =>
      cases ihb with
      | inr hs =>
        obtain ⟨b', hb'⟩ := hs
        exact ⟨_, .addR va hb'⟩
      | inl vb =>
        obtain ⟨n, rfl⟩ := nat_canonical ha va
        obtain ⟨m, rfl⟩ := nat_canonical hb vb
        exact ⟨_, .addLit⟩
  | isZero ha iha =>
    right
    cases iha with
    | inr hs =>
      obtain ⟨a', ha'⟩ := hs
      exact ⟨_, .isZeroArg ha'⟩
    | inl va =>
      obtain ⟨n, rfl⟩ := nat_canonical ha va
      cases n with
      | zero => exact ⟨_, .isZeroZero⟩
      | succ k => exact ⟨_, .isZeroSucc⟩
  | if_ hc ht he ihc iht ihe =>
    right
    cases ihc with
    | inr hs =>
      obtain ⟨c', hc'⟩ := hs
      exact ⟨_, .ifCond hc'⟩
    | inl vc =>
      cases bool_canonical hc vc with
      | inl h => rw [h]; exact ⟨_, .ifTrue⟩
      | inr h => rw [h]; exact ⟨_, .ifFalse⟩

theorem preservation (hs : Step t t') (h : HasType t T) : HasType t' T := by
  induction hs generalizing T with
  | addLit => cases h; exact .lit
  | addL _ ih =>
    cases h with
    | add ha hb => exact .add (ih ha) hb
  | addR _ _ ih =>
    cases h with
    | add ha hb => exact .add ha (ih hb)
  | isZeroZero => cases h; exact .tt
  | isZeroSucc => cases h; exact .ff
  | isZeroArg _ ih =>
    cases h with
    | isZero ha => exact .isZero (ih ha)
  | ifTrue =>
    cases h with
    | if_ _ ht _ => exact ht
  | ifFalse =>
    cases h with
    | if_ _ _ he => exact he
  | ifCond _ ih =>
    cases h with
    | if_ hc ht he => exact .if_ (ih hc) ht he

def Ty.denote : Ty → Type
  | .nat => Nat
  | .bool => Bool

inductive TTm : Ty → Type where
  | lit (n : Nat) : TTm .nat
  | tt : TTm .bool
  | ff : TTm .bool
  | add (a b : TTm .nat) : TTm .nat
  | isZero (a : TTm .nat) : TTm .bool
  | if_ (c : TTm .bool) (t e : TTm T) : TTm T

def TTm.eval : TTm T → T.denote
  | .lit n => n
  | .tt => true
  | .ff => false
  | .add a b => a.eval + b.eval
  | .isZero a => a.eval == 0
  | .if_ c t e => if c.eval then t.eval else e.eval

#eval (TTm.if_ (.isZero (.lit 0)) (.lit 1) (.lit 2)).eval
#eval (TTm.isZero (.add (.lit 2) (.lit 3))).eval

def TTm.erase : TTm T → Tm
  | .lit n => .lit n
  | .tt => .tt
  | .ff => .ff
  | .add a b => .add a.erase b.erase
  | .isZero a => .isZero a.erase
  | .if_ c t e => .if_ c.erase t.erase e.erase

theorem TTm.erase_typed (t : TTm T) : HasType t.erase T := by
  induction t with
  | lit n => exact .lit
  | tt => exact .tt
  | ff => exact .ff
  | add a b iha ihb => exact .add iha ihb
  | isZero a ih => exact .isZero ih
  | if_ c t e ihc iht ihe => exact .if_ ihc iht ihe

def check : (t : Tm) → (T : Ty) → Option { t' : TTm T // t'.erase = t }
  | .lit n, .nat => some ⟨.lit n, rfl⟩
  | .tt, .bool => some ⟨.tt, rfl⟩
  | .ff, .bool => some ⟨.ff, rfl⟩
  | .add a b, .nat =>
    match check a .nat, check b .nat with
    | some ⟨a', ha⟩, some ⟨b', hb⟩ => some ⟨.add a' b', by simp [TTm.erase, ha, hb]⟩
    | _, _ => none
  | .isZero a, .bool =>
    match check a .nat with
    | some ⟨a', ha⟩ => some ⟨.isZero a', by simp [TTm.erase, ha]⟩
    | none => none
  | .if_ c t e, T =>
    match check c .bool, check t T, check e T with
    | some ⟨c', hc⟩, some ⟨t', ht⟩, some ⟨e', he⟩ => some ⟨.if_ c' t' e', by simp [TTm.erase, hc, ht, he]⟩
    | _, _, _ => none
  | _, _ => none

#eval check (.if_ (.isZero (.lit 0)) (.lit 1) (.lit 2)) .nat
#eval check (.if_ (.isZero (.lit 0)) (.lit 1) .tt) .nat
#eval (check (.add (.lit 2) (.lit 3)) .nat).map (fun r => r.val.eval)

def run (t : Tm) (T : Ty) : Option T.denote :=
  (check t T).map (fun r => r.val.eval)

theorem check_typed (h : check t T = some r) : HasType t T := by
  rw [← r.property]

  exact r.val.erase_typed

theorem stuck : ¬ ∃ t', Step (.add (.lit 1) .tt) t' := by
  intro ⟨t', h⟩
  cases h with
  | addL h => cases h
  | addR _ h => cases h

example : ¬ Value (.add (.lit 1) .tt) := by
  intro h
  cases h

example : HasType (.if_ (.isZero (.lit 0)) (.lit 1) (.lit 2)) .nat :=
  .if_ (.isZero .lit) .lit .lit

example : HasType (.if_ (.isZero (.lit 0)) (.lit 1) (.lit 2)) .nat := by
  repeat constructor

theorem ill_typed : ¬ HasType (.add (.lit 1) .tt) T := by
  intro h
  cases h with
  | add _ hb => cases hb

example : Step (.add (.add (.lit 1) (.lit 2)) (.lit 3)) (.add (.lit 3) (.lit 3)) := .addL .addLit

inductive Steps : Tm → Tm → Prop where
  | refl : Steps t t
  | step : Step t t' → Steps t' t'' → Steps t t''

theorem safety (h : HasType t T) (hs : Steps t t') : Value t' ∨ ∃ t'', Step t' t'' := by
  induction hs with
  | refl => exact progress h
  | step s _ ih => exact ih (preservation s h)

theorem unique (h1 : HasType t T) (h2 : HasType t U) : T = U := by
  induction h1 generalizing U with
  | lit => cases h2; rfl
  | tt => cases h2; rfl
  | ff => cases h2; rfl
  | add _ _ _ _ => cases h2; rfl
  | isZero _ _ => cases h2; rfl
  | if_ _ _ _ _ iht _ =>
    cases h2 with
    | if_ _ ht' _ => exact iht ht'

def TTm.optIf : TTm T → TTm T
  | .if_ .tt t _ => t
  | .if_ .ff _ e => e
  | t => t

theorem TTm.optIf_eval (t : TTm T) : t.optIf.eval = t.eval := by
  cases t with
  | if_ c t e =>
    cases c <;> simp [TTm.optIf, TTm.eval]
  | _ => rfl

def Fin' (n : Nat) := { i : Nat // i < n }

def Fin'.last (n : Nat) : Fin' (n + 1) := ⟨n, by omega⟩
#eval (Fin'.last 4).val
