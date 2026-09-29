
inductive Expr where
  | num (n : Nat)
  | var (x : Nat)
  | add (a b : Expr)
  | mul (a b : Expr)

def eval (env : Nat → Nat) : Expr → Nat
  | Expr.num n => n
  | Expr.var x => env x
  | Expr.add a b => eval env a + eval env b
  | Expr.mul a b => eval env a * eval env b

inductive Instr where
  | push (n : Nat)
  | load (x : Nat)
  | add
  | mul

def exec (env : Nat → Nat) : List Instr → List Nat → List Nat
  | [], s => s
  | Instr.push n :: is, s => exec env is (n :: s)
  | Instr.load x :: is, s => exec env is (env x :: s)
  | Instr.add :: is, b :: a :: s => exec env is ((a + b) :: s)
  | Instr.mul :: is, b :: a :: s => exec env is ((a * b) :: s)
  | _ :: is, s => exec env is s

def compile : Expr → List Instr
  | Expr.num n => [Instr.push n]
  | Expr.var x => [Instr.load x]
  | Expr.add a b => compile a ++ compile b ++ [Instr.add]
  | Expr.mul a b => compile a ++ compile b ++ [Instr.mul]

theorem compile_correct (env : Nat → Nat) (e : Expr) (rest : List Instr) (s : List Nat) :
    exec env (compile e ++ rest) s = exec env rest (eval env e :: s) := by
  induction e generalizing rest s with
  | num n => rfl
  | var x => rfl
  | add a b iha ihb => simp [compile, List.append_assoc, iha, ihb, exec, eval]
  | mul a b iha ihb => simp [compile, List.append_assoc, iha, ihb, exec, eval]

