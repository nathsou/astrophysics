def double : Nat → Nat
  | 0 => 0
  | n + 1 => double n + 2

#eval double 21

#eval [1, 2, 3] ++ [4, 5]
#eval List.map double [1, 2, 3]
#eval (fun (x : Nat) => if x < 3 then Bool.true else Bool.false) 2
#eval (3, [Bool.true])

inductive Expr where
  | num (n : Nat)
  | var (x : Nat)
  | add (a b : Expr)
  | mul (a b : Expr)
deriving DecidableEq

def eval (env : Nat → Nat) : Expr → Nat
  | Expr.num n => n
  | Expr.var x => env x
  | Expr.add a b => eval env a + eval env b
  | Expr.mul a b => eval env a * eval env b

def simpConst : Expr → Expr
  | Expr.add (Expr.num a) (Expr.num b) => Expr.num (a + b)
  | e => e

#eval eval (fun x => x + 10) (Expr.add (Expr.num 2) (Expr.mul (Expr.var 1) (Expr.num 3)))
#eval simpConst (Expr.add (Expr.num 2) (Expr.num 3))
#test ∀ (n : Nat), double n = n + n
#test ∀ (n m : Nat), n + m = m * n -- expect-error
#test ∀ (env : Nat → Nat) (e : Expr), eval env (simpConst e) = eval env e
#test ∀ (xs ys : List Nat), List.length (xs ++ ys) = List.length xs -- expect-error
#eval decide (Expr.num 1 = Expr.num 1)
