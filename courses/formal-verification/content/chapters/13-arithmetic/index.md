---
number: 13
title: Arithmetic
summary: 'The theory programs need most. Linear constraints and the simplex method as a feasibility checker; Farkas certificates, a few numbers that prove a system has no solution; integers, branch and bound and cuts; nonlinear arithmetic, undecidable over the integers and decidable over the reals; and the precise reasons a verifier answers unknown.'
duration: About 1 hour 30 minutes
---

Verification conditions are full of arithmetic: *0 ≤ i < n*, *balance + amount ≤ limit*, *lo + (hi − lo) / 2 < hi*. Chapter 12 built the architecture: a SAT solver chooses which atoms are true, and a theory solver checks that the choice makes sense. This chapter builds the theory solver for arithmetic. It has to answer one question, many thousands of times per proof: *does this conjunction of linear constraints have a solution?* When the answer is no, it must say why, in a form the SAT solver can learn from and a checker can verify.

## Constraints as a picture

With two variables, every linear constraint is a half-plane: *x + y ≤ 4* is everything on one side of a line. A conjunction of constraints is the intersection of half-planes, a convex region that may be empty. Deciding a conjunction means deciding whether that region is empty.

A solver for linear programming usually *optimises*: it looks for the best point of the region by some measure. A theory solver inside SMT only needs *some* point, or a proof that there is none. The standard algorithm for that is a variant of the **simplex method**. George Dantzig published the method in 1951 for optimisation problems in planning and logistics.:cite[dantzig1951] The feasibility-only version that SMT solvers use was published by Bruno Dutertre and Leonardo de Moura in 2006.:cite[dutertre2006]

## The simplex method as a repair loop

Dutertre and de Moura's simplex is a repair loop. Each linear form in a constraint, such as *x + y*, gets its own variable *s = x + y*, called a slack variable. Constraints then become bounds on single variables: *s ≤ 4*. The solver keeps two things:

1. A **tableau**: the equations that define the slack variables, kept solved for some of the variables in terms of the others.
2. An **assignment** of a rational value to every variable that satisfies all the equations, but not necessarily all the bounds.

When a variable violates one of its bounds, the solver moves it to the bound and lets the variables it depends on absorb the change. If the variable is defined in terms of others, it swaps roles with one of them first: that swap is a **pivot**. Each pivot fixes one violated bound and keeps the equations true, and a fixed rule for choosing which variables to swap (Bland's rule) guarantees that the loop terminates. It ends either with every bound satisfied, so the point is a solution, or with a violated bound that no swap can fix, which is a proof of infeasibility.

The course's solver starts with every variable at 0 and records where the point (x, y) goes after each pivot.

::simplex-view{constraints='["x + 2y >= 4", "3x + y >= 6", "x + y <= 5"]' caption="The simplex view. The shaded region satisfies every constraint. The course's simplex starts at (0, 0), which violates two constraints, and pivots until the point is inside. The constraints are editable."}

Edit the constraints: add `y >= 1`, or `x <= 3`, and step through the pivots again. Each pivot moves the point just far enough to make a violated constraint tight, so the point stops on the edge of the region, never in its middle: nothing asks it to go further.

```quiz
q: 'An SMT solver asks the simplex for a point satisfying x + y ≤ 4, x − y ≥ 1, y ≥ 1, x ≤ 3. It answers (2, 1). Why not the point (2.5, 1.2), further from the edges?'
options:
  - text: (2.5, 1.2) violates one of the constraints.
    why: 'Check it: 3.7 ≤ 4, 1.3 ≥ 1, 1.2 ≥ 1, 2.5 ≤ 3. It satisfies all four.'
  - text: The theory solver only needs some point; the first one the repair loop reaches will do.
    correct: true
    why: 'Feasibility is a yes-or-no question. The simplex stops as soon as no bound is violated, which is typically on the edge of the region. Optimising would be extra work for nothing.'
  - text: The simplex can only return integer points.
    why: 'The simplex works over the rationals; integers need more work, later in this chapter.'
```

## Farkas certificates

When the region is empty, the solver must explain why. The explanation is remarkably small. Take these constraints:

$$
2x + 3y \le 6, \qquad x - y \ge 2, \qquad y \ge 1
$$

Write each one as *something ≤ constant* (so *x − y ≥ 2* becomes *−x + y ≤ −2*), multiply by a non-negative number, and add:

$$
\begin{array}{rrcr}
1 \times & (2x + 3y & \le & 6) \\
2 \times & (-x + y & \le & -2) \\
5 \times & (-y & \le & -1) \\ \hline
& 0 & \le & -3
\end{array}
$$

The x terms cancel (2 − 2), the y terms cancel (3 + 2 − 5), and the sum says 0 ≤ −3. Multiplying an inequality by a non-negative number preserves it, and adding inequalities preserves them too, so any point satisfying the three constraints would satisfy 0 ≤ −3. There is no such point.

**Farkas's lemma**, published by Julius Farkas in 1902, says that this always works: a system of linear inequalities has no real solution *if and only if* some non-negative combination of them adds up to *0 ≤ c* with c negative.:cite[farkas1902] The multipliers are a **Farkas certificate**. They fall out of the simplex for free: when the loop gets stuck, the row of the tableau that blocks it holds the multipliers.

::simplex-view{constraints='["2x + 3y <= 6", "x - y >= 2", "y >= 1"]' caption="An empty region. Step through the pivots; when the simplex gets stuck, it shows its certificate. Each line multiplies one constraint, and the sum is an inequality that is false. Check the arithmetic yourself."}

This is the arithmetic counterpart of a DRAT proof (chapter 8): the solver may be long and clever, but its answer comes with a few rational numbers that anyone can check with a pencil. The course's trusted certificate checker does exactly that for every arithmetic conflict.

```numeric
id: arithmetic/farkas
title: Complete the certificate
prompt: |
  The constraints *x + y ≥ 6*, *x ≤ 2* and *2y ≤ 5* have no common solution. A certificate multiplies the first (rewritten as *−x − y ≤ −6*) by 1 and the second by 1. What multiplier must go on *2y ≤ 5* to make the y terms cancel? Give a decimal.
answer: 0.5
tolerance: 0.001
explain: 'With 0.5, the y terms are −1 + 0.5 × 2 = 0, the x terms −1 + 1 = 0, and the constants −6 + 2 + 2.5 = −1.5. The sum reads 0 ≤ −1.5, which is false. Multipliers may be fractions; only their signs matter.'
hints:
  - The first constraint contributes −y. What multiple of 2y cancels it?
```

## Integers

Programs mostly compute with integers, and a region with rational points need not contain an integer point. The constraint *2x − 2y = 1* has rational solutions everywhere along a line, but no integer one, because the left side is always even. The simplex alone would say *satisfiable*.

### Branch and bound

The classical fix is **branch and bound**, published by Ailsa Land and Alison Doig in 1960.:cite[landdoig1960] Solve over the rationals. If the point found has a fractional coordinate, say x = 1/2, then every integer solution has either x ≤ 0 or x ≥ 1: split the problem in two and solve each half. A branch whose region is empty is closed; a branch whose point is integral is a solution.

Below, the line *2x − 2y = 1* inside a box. Branch and bound closes every branch: there is no integer point.

::simplex-view{constraints='["2x - 2y = 1", "x >= 0", "x <= 3", "y >= 0", "y <= 3"]' integer=true caption="Branch and bound. Each subproblem adds one bound; select a node of the tree to see its region and the point the simplex found there. Grey dots are the integer points."}

Now delete the four bounds, leaving only `2x - 2y = 1`, and look at the tree again. Each branch still finds a rational point, one step further out along the line, and splits again. Nothing ever closes it: branch and bound **does not terminate** on this problem. The widget gives up after 40 subproblems; the course's SMT solver gives up after a few thousand branches and reports *unknown*.

### Cuts

The other classical idea is the **cutting plane**, from Ralph Gomory in 1958: derive a new constraint that every integer solution satisfies but the current rational point does not, and add it.:cite[gomory1958] The simplest cut needs no simplex at all. Divide a constraint by the greatest common divisor of its coefficients: *2x − 2y = 1* becomes *x − y = 1/2*, and since x − y is an integer, the constraint is false outright. For an inequality, round the constant: *2x + 2y ≥ 3* becomes *x + y ≥ 3/2*, so *x + y ≥ 2*.

The course's solver applies this tightening to every arithmetic atom before the search starts, so it refutes *2x − 2y = 1* at once, where the widget's plain branch and bound runs forever. Production solvers combine branch and bound with stronger cuts and other techniques.

### Decidable, and still unknown

Linear arithmetic over the integers (addition, constants, comparisons, quantifiers, but no multiplication of variables) is **decidable**: Mojżesz Presburger proved in 1929 that an algorithm can decide every sentence of it.:cite[presburger1929] So when a solver answers *unknown* on a linear integer problem, the limit is the procedure, not mathematics.

Here is such a case. Integer division by a constant is linear: the verifier replaces *t / 3* by a fresh integer q with 3q ≤ t ≤ 3q + 2. The identity below is true for every t ≥ 0 (try a few values), but the course's solver does not find the proof:

:::workbench{title="Three quotients" minLines=6}
```vouch
lemma thirds(t: int)
  requires t >= 0
  ensures t / 3 + (t + 1) / 3 + (t + 2) / 3 == t
{}
```
:::

The verdict is *unknown*, with the reason: branch and bound did not converge. It is not *violated*. The solver found no counterexample, and it does not claim one.

```quiz
q: 'Presburger arithmetic is decidable. Why can a solver for it still answer unknown?'
options:
  - text: Decidable means a correct algorithm exists, not that every solver implements one, or that it finishes within the time it is given.
    correct: true
    why: 'Complete decision procedures for Presburger arithmetic exist, but their worst case is very expensive. Solvers use faster, incomplete methods such as branch and bound and cuts, and stop when they run out of budget.'
  - text: Because division makes the problem nonlinear.
    why: 'Division by a constant is linear: it introduces a fresh variable with two linear bounds.'
  - text: Because the formula is false for some large t.
    why: 'Then the answer would be violated, with that t as the counterexample. Unknown says nothing either way.'
```

## Nonlinear arithmetic

Multiplying two variables changes everything.

**Over the integers, it is undecidable.** In 1900 David Hilbert asked, as the tenth of his problems, for a procedure deciding whether a polynomial equation with integer coefficients has an integer solution. In 1970 Yuri Matiyasevich completed the proof that no such procedure exists.:cite[matiyasevich1970] So no solver can decide every formula with integer multiplication, however clever. *How we got here (Part III)* tells the story.

**Over the reals, it is decidable.** Alfred Tarski gave a decision procedure for the real numbers with addition and multiplication in a RAND report in 1948, published in 1951.:cite[tarski1951] His procedure is far too slow to use. George Collins's cylindrical algebraic decomposition (1975) made it practical for small problems, though it remains doubly exponential in the number of variables.:cite[collins1975] The integers are harder than the reals: the reals have no gaps, and the integers' gaps are where undecidability lives.

:::bridge{course=incompleteness chapter=inc.req.und}
*Incompleteness* proves that no algorithm decides what even a weak theory of arithmetic proves, and so none decides first-order validity. Hilbert's tenth problem is a sharper version of the same limit: even equations between polynomials, with no quantifiers inside, cannot be decided over the integers.
:::

### What a solver does anyway

The course's solver uses **incremental linearisation**. A product *x·y* is treated as a new, opaque variable, and the linear solver runs as usual. If the point it finds is inconsistent, for example x = 2, y = 3 but x·y = 5, the solver adds a linear lemma that rules out the inconsistency and tries again. The lemmas are facts about multiplication:

- **Zero:** if x = 0, then x·y = 0.
- **Sign:** if x > 0 and y < 0, then x·y < 0, and so on.
- **Squares:** x·x ≥ 0.
- **Values:** if x = 2 and y = 3, then x·y = 6.

Many useful properties follow from a few lemmas. The certificate checker re-checks each lemma with interval reasoning, and a property that needs infinitely many lemmas makes the solver stop and say so:

:::workbench{title="Products" minLines=16}
```vouch
lemma square(x: int)
  ensures x * x >= 0
{}

lemma small_product(x: int, y: int)
  requires 2 <= x <= 3 && 2 <= y <= 3
  ensures x * y != 5
{}

// True: the case n = 3 of Fermat's Last Theorem. Out of reach of lemmas about signs and values.
lemma no_cubes(x: int, y: int, z: int)
  requires x >= 1 && y >= 1 && z >= 1
  ensures x * x * x + y * y * y != z * z * z
{}
```
:::

The first two are proved; the third is *unknown*, because the product lemmas did not converge. The statement is true (Andrew Wiles's proof of Fermat's Last Theorem covers it and every higher exponent):cite[wiles1995], but its proof is number theory, not arithmetic on signs and bounds.

```quiz
q: 'A colleague says: "The verifier said unknown on my nonlinear lemma, so the lemma might be false." What is the most accurate reply?'
options:
  - text: Yes, unknown means the solver suspects a counterexample.
    why: 'A suspected counterexample would be reported as one, and replayed. Unknown means the solver found neither a proof nor a counterexample.'
  - text: It might be false or true. Unknown means the solver gave up. Try a lemma that helps it, such as a bound or an intermediate fact.
    correct: true
    why: 'This is the practical response. A failed proof over an undecidable theory is information about the solver, not about the lemma. Part IV shows how intermediate assertions and lemmas guide a proof.'
  - text: No. Over the integers every true statement is eventually proved.
    why: 'Matiyasevich''s theorem rules that out for nonlinear integer arithmetic.'
```

## Why a verifier says unknown

This chapter has met the three reasons, and every *unknown* in the course gives one of them:

1. **The theory is undecidable.** Nonlinear integer arithmetic, and formulas with quantifiers (chapter 19). No solver is complete; this one stops after a budget.
2. **The theory is decidable, but the procedure is incomplete.** Branch and bound on linear integer problems. A better procedure might succeed.
3. **The budget ran out.** Time, conflicts or branches, on a problem the procedure would eventually solve.

An *unknown* is never shown as a failure of the code. The badge says *unknown* with its reason, and the counterexample panel stays empty, because there is no counterexample to replay.

## Exercise: share a budget

```verify
id: arithmetic/split
title: Share a budget fairly
prompt: |
  `split` divides a whole budget between three teams. The shares must add up to the total, and no share may exceed another by more than one. The starter code gives every team `total / 3`, which loses the remainder. Fix the body. Division by a constant is linear, so the proof stays in decidable territory.
starter: |
  struct Split { a: int, b: int, c: int }

  // Share a budget between three teams: the shares add up to the total,
  // and no team gets more than one unit more than another.
  fn split(total: int) -> Split
    requires total >= 0
    ensures result.a + result.b + result.c == total
    ensures 0 <= result.a <= result.b <= result.c <= result.a + 1
  {
    let share = total / 3
    return Split { a: share, b: share, c: share }
  }
locked: [[1, 9]]
solution: |
  {
    let a = total / 3
    let b = (total - a) / 2
    return Split { a: a, b: b, c: total - a - b }
  }
hints:
  - The counterexample has total = 2. Where do the two units go?
  - Give `a` a third, rounded down. Split what is left in two, rounded down, for `b`. Give `c` the rest.
success: 'Every share is computed from what is left, so the sum is exact by construction; the solver only has to check the bounds on a, b and c, which are linear. A formula with three independent quotients, such as `total / 3`, `(total + 1) / 3` and `(total + 2) / 3`, is also correct, but the course''s solver answers unknown on it: you saw why above.'
lines: 14
```

:::history
**From planning to proofs.** Dantzig's simplex method was published in 1951, in a Cowles Commission volume on the analysis of production and allocation.:cite[dantzig1951] Branch and bound (Land and Doig, 1960) and cutting planes (Gomory, 1958) came from operations research too.:cite[landdoig1960,gomory1958] Farkas's lemma is older than all of them: it appeared in 1902, in Farkas's theory of linear inequalities.:cite[farkas1902] The decidability results come from logic: Presburger's 1929 result, Tarski's decision procedure for the reals, and Matiyasevich's 1970 negative answer to Hilbert's tenth problem.:cite[presburger1929,tarski1951,matiyasevich1970] SMT solvers brought the two traditions together.
:::

:::hood
**The course's arithmetic solver.** `src/lib/fv/smt/simplex.ts` is Dutertre and de Moura's simplex over exact rationals (`src/lib/fv/logic/rational.ts`, built on JavaScript's `BigInt`), with Bland's rule for pivoting. `src/lib/fv/smt/linear.ts` normalises each atom: coefficients divided by their gcd, bounds tightened over the integers. Branch and bound and the product lemmas are added at the SAT solver's final check (`src/lib/fv/smt/solver.ts`) as ordinary clauses. Every arithmetic conflict carries its Farkas multipliers; the trusted checker (`src/lib/fv/smt/check/certificate.ts`) multiplies, adds and checks that the result is *0 ≤ c* with c negative, and checks each product lemma by interval arithmetic.
:::

:::proved
**What did we prove?** An arithmetic *unsatisfiable* is certified by Farkas multipliers for each conflict and a DRAT proof for the Boolean structure. Branch-and-bound splits (x ≤ k or x ≥ k + 1) are valid over the integers by definition and are checked as such. *Unknown* proves nothing either way, and the badge says which of the three reasons applied. Note also what the arithmetic is: Vouch's `int` is the mathematical integers, which never overflow. Machine integers are bit-vectors, the subject of chapter 14.
:::

## What comes next

[Chapter 14](/chapters/bits-and-arrays/) adds the theories that model machines: fixed-width integers that do overflow, and arrays. With them, a solver can check a compiler's peephole rewrites at every bit width, and answer questions about cloud access policies.

## Further reading

- Dutertre and de Moura's paper describes the simplex that every modern SMT solver uses, in ten pages.:cite[dutertre2006]
- Land and Doig's 1960 paper introduced branch and bound, and is readable today.:cite[landdoig1960]
