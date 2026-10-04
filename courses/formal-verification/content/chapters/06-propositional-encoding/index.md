---
number: 6
title: Propositional encoding
summary: Write the question as a Boolean formula and let a solver find an answer. Variables, clauses and CNF; one-hot encodings and cardinality constraints; Tseitin's transformation; Sudoku, queens and package dependencies; why the problem is NP-complete, and where random formulas are hard.
duration: About 1 hour 15 minutes
---

When you ask a Linux package manager to install a program, it has to choose versions of dozens or hundreds of packages so that every dependency is met and no two conflicting packages are installed together. Deciding whether this is possible at all is NP-complete: as hard, in the worst case, as any problem in this chapter.:cite[mancinelli2006] openSUSE's package manager has handled it since 2008 by turning the question into a formula of propositional logic, one Boolean variable per package version, and handing it to a SAT solver.:cite[libsolv]

That move, from a question about some domain to a question about Boolean variables, is the subject of this chapter and the method of Part II. Part I listed the states of a system one by one and ran into the explosion of their number. A formula describes all of them at once, and a solver searches for one that satisfies it without listing the others. Chapter 7 shows how the solver does it. This chapter is about the encoding: how to say what you mean in clauses.

## Formulas and clauses

A **propositional formula** is built from Boolean variables with *and* (∧), *or* (∨) and *not* (¬). An **assignment** gives each variable the value true or false, and the formula is **satisfiable** if some assignment makes it true. A **SAT solver** is a program that decides satisfiability and, when the answer is yes, returns a satisfying assignment, a **model**.

Solvers do not accept arbitrary formulas. They take **conjunctive normal form** (CNF): an *and* of **clauses**, each clause an *or* of **literals**, each literal a variable or its negation.

$$
(x_1 \lor \lnot x_2) \land (x_2 \lor x_3 \lor \lnot x_4) \land (\lnot x_1)
$$

A clause is a constraint that rules out one kind of mistake. `(x₁ ∨ ¬x₂)` forbids exactly the assignments where x₁ is false and x₂ is true; the formula forbids the union of what its clauses forbid. Encoding a problem means writing its rules as clauses.

:::programmer
CNF is the solver's input format the way SQL is a database's. Solvers read it in the **DIMACS** format: one clause per line, variables as positive integers, negation as a minus sign, each clause ending with 0. The clauses above are `1 -2 0`, `2 3 -4 0` and `-1 0`. The course's solver reads and writes DIMACS, and so does every solver in the annual SAT competitions.
:::

## Encoding finite choices: one-hot

Most problems are not about Booleans. A Sudoku cell holds a digit; a meeting has a time slot; a package has a version. The standard way to encode a variable *x* with values 1 to *k* is **one-hot**: one Boolean *x = v* per value, plus clauses that say exactly one of them is true.

- **At least one**: the clause (x = 1 ∨ x = 2 ∨ … ∨ x = k).
- **At most one**: for every pair of values, ¬(x = v) ∨ ¬(x = w), which forbids the pair being true together. That is k(k − 1)/2 clauses.

Once the variables are one-hot, constraints are clauses over them. "Cells *a* and *b* differ" becomes, for each digit *v*, ¬(a = v) ∨ ¬(b = v). "Cell *a* holds 3" is the single clause (a = 3).

```quiz
q: 'A 9 × 9 Sudoku, one-hot encoded, has one Boolean per cell and digit. How many clauses say that each cell holds at most one digit?'
options:
  - text: '81'
    why: 'One clause per cell would only say "at least one". At most one needs a clause for every pair of digits in every cell.'
  - text: '2,916'
    correct: true
    why: 'Each cell has 9 × 8 / 2 = 36 pairs of digits, and there are 81 cells: 81 × 36 = 2,916 binary clauses. The pairwise encoding is quadratic; for larger domains, encodings with auxiliary variables are linear.'
  - text: '6,561'
    why: 'That is 81 × 81, the number of pairs of cells, not of digits.'
```

For large domains the pairwise encoding is wasteful, and there are better ones. Carsten Sinz's *sequential counter* encodes "at most *k* of these *n* variables are true" with about 2*nk* clauses and *nk* auxiliary variables.:cite[sinz2005] The course's encoder uses pairwise at-most-one, which is simplest to read; its library also has Sinz's encoding, for the cardinality constraints of Chapter 9.

## Vouch problems

Writing clauses by hand gets tedious after the first Sudoku. Vouch has a `problem` block in which you declare unknowns over small finite types and state constraints in ordinary logic. The course's encoder turns it into CNF: one-hot variables for every unknown, a case split for every expression (for each value it can take, the condition under which it takes it), quantifiers expanded over their finite types, and finally Tseitin's transformation (below). The solver then finds solutions, and every solution is checked by the reference interpreter, which evaluates the constraints on it.

Here is a 4 × 4 Sudoku: digits 1 to 4, each row, column and 2 × 2 box with no repeats, and seven given digits.

:::encoding-lab{title="A 4 × 4 Sudoku"}
```vouch
problem Sudoku4 {
  type Idx = 0..4
  type Digit = 1..=4
  var cell: (Idx, Idx) -> Digit

  constraint rows: forall r: Idx, c1: Idx, c2: Idx :: c1 != c2 ==> cell[r, c1] != cell[r, c2]
  constraint cols: forall c: Idx, r1: Idx, r2: Idx :: r1 != r2 ==> cell[r1, c] != cell[r2, c]
  constraint boxes: forall r1: Idx, c1: Idx, r2: Idx, c2: Idx ::
    r1 / 2 == r2 / 2 && c1 / 2 == c2 / 2 && (r1 != r2 || c1 != c2) ==> cell[r1, c1] != cell[r2, c2]
  constraint givens: cell[0, 0] == 1 && cell[0, 3] == 4 && cell[1, 1] == 4 && cell[1, 2] == 1 && cell[2, 2] == 2 && cell[3, 0] == 2 && cell[3, 3] == 3
  count
}
```
Edit the constraints and watch the encoding and the number of solutions change. Delete a given and count again; delete the boxes constraint and count again.
:::

`var cell: (Idx, Idx) -> Digit` declares 16 unknowns, one per cell, each with 4 possible values: 64 one-hot variables. The `count` at the end asks for the number of solutions rather than one solution. A well-made Sudoku has exactly one.

```predict
q: 'Remove the `givens` constraint, so the puzzle is an empty 4 × 4 grid with the row, column and box rules. How many solutions?'
options:
  - text: '4! = 24'
    why: 'That is the number of ways to fill one row. The other rows have fewer choices, but more than one.'
  - text: '288'
    correct: true
    why: 'There are 288 valid 4 × 4 Sudoku grids. Try it in the lab: the solver counts them by finding one, adding a clause that forbids it, and repeating until no solution is left.'
  - text: '(4!)⁴ = 331,776'
    why: 'That counts grids whose rows are permutations, ignoring the column and box rules.'
```

Counting is how the course checks encodings. An encoding that forgets a rule has too many solutions; one that adds a wrong rule has too few. A satisfiability check alone would miss both: the forgetful encoding is still satisfiable. The exercises below are graded by the exact count.

## Tseitin's transformation

The encoder's constraints are arbitrary formulas, with nested *and*, *or* and *implies*, and solvers want CNF. The textbook conversion pushes negations inwards and distributes *or* over *and*. It is correct, and it can be catastrophic. A disjunction of *n* conjunctions,

$$
(x_1 \land y_1) \lor (x_2 \land y_2) \lor \dots \lor (x_n \land y_n),
$$

becomes one clause for each way of choosing one variable from each pair: $2^n$ clauses.

In 1968 G. S. Tseitin gave a conversion that is linear.:cite[tseitin1968] Introduce a fresh variable for each subformula, and add clauses that say the variable *equals* its subformula. For *t* = (x ∧ y) the clauses are (¬t ∨ x), (¬t ∨ y) and (t ∨ ¬x ∨ ¬y). Then the whole formula becomes a single clause over the fresh variables, (t₁ ∨ t₂ ∨ … ∨ tₙ), plus three clauses per pair.

::blow-up{caption="Distributing against Tseitin's transformation on (x₁ ∧ y₁) ∨ … ∨ (xₙ ∧ yₙ). Both clause counts are computed by the course's encoder; the naive one is enumerated up to n = 14."}

The Tseitin formula is not *equivalent* to the original: it has extra variables. It is **equisatisfiable**: it is satisfiable exactly when the original is, and every model of it, restricted to the original variables, is a model of the original. That is all a solver needs. The fresh variables also turn out to help the solver, because they give it names for useful intermediate facts.

## NP-completeness, in one paragraph

Checking a proposed model is easy: evaluate the clauses. Finding one, as far as anyone knows, can take exponential time in the worst case. In 1971 Stephen Cook proved that SAT is **NP-complete**: every problem whose solutions can be checked in polynomial time can be translated into SAT in polynomial time.:cite[cook1971] Leonid Levin found the same phenomenon independently.:cite[levin1973] So a polynomial-time SAT algorithm would solve thousands of other problems quickly, and most researchers believe none exists. This chapter's encodings are, in effect, small hand-made instances of Cook's translation.

::bio-card{id=cook-levin}

Worst cases are not typical cases. Industrial SAT problems from hardware, software and planning, with millions of clauses, are routinely solved in seconds, because they have structure that solvers exploit. Chapter 7 shows how.

## Where random formulas are hard

Generate formulas at random: *n* variables and *m* clauses, each clause three literals chosen at random. With few clauses, almost every formula is satisfiable and easy to satisfy. With many, almost every formula is unsatisfiable, and a solver finds a contradiction quickly. In between, something happens.

```predict
q: 'As the ratio m/n of clauses to variables grows, the probability that a random 3-SAT formula is satisfiable drops from near 1 to near 0. Where is the drop, and where are the formulas hardest for a solver?'
options:
  - text: The drop is gradual between ratios 1 and 10, and the hardest formulas are the largest ones.
    why: 'The drop is sharp, and it gets sharper as n grows. Large ratios give large formulas that are easy to refute.'
  - text: The drop is sharp, near a ratio of about 4.3, and the hardest formulas are near the drop.
    correct: true
    why: 'This is the phase transition of random 3-SAT, observed experimentally by Mitchell, Selman and Levesque, with the crossover estimated at about 4.26. Generate the plot below to see it.'
  - text: The drop is near a ratio of 1, where there are as many clauses as variables.
    why: 'At a ratio of 1, almost every random 3-SAT formula is satisfiable; each clause rules out only one-eighth of the assignments to its three variables.'
```

::phase-transition{caption="The phase transition of random 3-SAT, computed in your browser. Green: the fraction of formulas that are satisfiable. Red: the median number of conflicts the solver needed. The dashed line marks the ratio 4.26."}

The fraction of satisfiable formulas falls from nearly 1 to nearly 0 around a ratio of 4.26, and the solver's work peaks there. David Mitchell, Bart Selman and Hector Levesque reported the peak in 1992, and James Crawford and Larry Auton estimated the crossover point at about 4.26 with large experiments.:cite[mitchell1992,crawford1996] The formulas near the threshold are *critically constrained*: each assignment is almost a solution, and there are many near-misses to explore. Random formulas are a useful benchmark precisely because they have no structure, which is the opposite of the formulas that come from real problems.

## Packages, queens and timetables

Here are three more encodings to try in the lab: change one, count, and see whether the number is what you expect.

**Eight queens.** Place *n* queens on an *n* × *n* board so that none attacks another. One unknown per column, its value the row of the column's queen; then rows differ, and diagonals differ. For *n* = 8 there are 92 solutions.

:::encoding-lab{title="n queens"}
```vouch
problem Queens {
  type Col = 0..8
  var row: Col -> 0..8

  constraint rows: forall i: Col, j: Col :: i < j ==> row[i] != row[j]
  constraint diagonals: forall i: Col, j: Col :: i < j ==> row[j] - row[i] != j - i && row[i] - row[j] != j - i
  count
}
```
Try 4, 5 and 6 queens by changing both 8s. Six queens have fewer solutions than five.
:::

**Dependencies.** One Boolean per package; a dependency is an implication, a conflict a negated conjunction.

:::encoding-lab{title="Installing an editor"}
```vouch
problem Install {
  enum Pkg { editor, spell, dict_en, dict_fr, gui, gtk3, gtk4 }
  var install: Pkg -> bool

  constraint want: install[editor]
  constraint depends: (install[editor] ==> install[spell] && install[gui])
    && (install[spell] ==> install[dict_en] || install[dict_fr])
    && (install[gui] ==> install[gtk3] || install[gtk4])
  constraint conflicts: !(install[gtk3] && install[gtk4]) && !(install[dict_en] && install[dict_fr])
  count
}
```
Four installations satisfy every dependency. Real package managers then *optimise*: prefer newer versions, fewer packages, no changes to what is installed. That turns SAT into MaxSAT or pseudo-Boolean optimisation, solved by the same engines.
:::

```encode
id: propositional-encoding/timetable
title: Timetable five exams
prompt: |
  Five exams, numbered 0 to 4, go into three slots, 0 to 2. Exams that share a student must be in different slots. The pairs that share students are **0 and 1, 0 and 2, 1 and 3, 2 and 3, and 3 and 4**. Exam 4 uses the results of exam 0, so it must be in a later slot (that constraint is already written). Add the clashes. The check counts your solutions: the right encoding has exactly 15.
starter: |
  problem Timetable {
    type Exam = 0..5
    type Slot = 0..3
    var slot: Exam -> Slot

    // Exams that share a student cannot be in the same slot.

    // Exam 4 needs the results of exam 0.
    constraint order: slot[0] < slot[4]
    count
  }
count: 15
solution: |
  problem Timetable {
    type Exam = 0..5
    type Slot = 0..3
    var slot: Exam -> Slot

    // Exams that share a student cannot be in the same slot.
    constraint clashes: slot[0] != slot[1] && slot[0] != slot[2] && slot[1] != slot[3]
      && slot[2] != slot[3] && slot[3] != slot[4]

    // Exam 4 needs the results of exam 0.
    constraint order: slot[0] < slot[4]
    count
  }
hints:
  - Without any clash constraint the solver counts 81 timetables (3 pairs of slots for exams 0 and 4, times 27 for the others).
  - 'One `!=` per pair that shares a student: `slot[0] != slot[1]`, and so on.'
success: 'Fifteen timetables. Notice what the count caught that satisfiability would not: leaving out one clash still gives a satisfiable problem, just with the wrong number of solutions.'
lines: 12
```

## Under the hood: counting by blocking

How does the course count 92 queen placements with a solver that only answers yes or no? It asks, gets a model, and adds a **blocking clause** that rules out exactly that model's assignment to the problem's unknowns, then asks again. When the answer is *unsatisfiable*, it has seen every solution. The blocking clause mentions only the one-hot variables, not Tseitin's fresh ones, because two models that differ only in auxiliary variables are the same solution. Each solution found is checked by the interpreter against the original constraints, so a bug in the encoder could make the count wrong but could not make a wrong solution look right.

Counting this way takes one solver call per solution, which is fine for dozens or thousands of solutions and hopeless for 10²⁰. Dedicated **model counters** use different algorithms (component caching, knowledge compilation), and counting is a much harder problem in theory than satisfiability.

:::industry
**SAT encodings at work.** Package managers (openSUSE's zypper and Fedora's DNF both use the SAT-based libsolv), hardware verification (Chapter 10), cryptanalysis, scheduling and configuration all use SAT through an encoding of this kind.:cite[libsolv] The encoding is often where the engineering is: the same problem can be easy or hopeless for a solver depending on how its constraints are written.
:::

:::proved
**What did we prove?** Each solution the lab shows was found by the SAT solver and **checked by the interpreter** against the original constraints. Each count trusts more: the encoder (that its clauses mean the same as the constraints) and the solver's final *unsatisfiable* answer, which says there are no more solutions. Chapter 8 shows how to check that answer independently.
:::

## What comes next

The solver has been a black box. [Chapter 7](/chapters/inside-a-sat-solver/) opens it: you will drive it step by step, choose its decisions, and see how it learns from its mistakes.

## Further reading

- The *Handbook of Satisfiability* is the reference for encodings and solvers; its chapters on CNF encodings and cardinality constraints are especially useful.:cite[biere2009]
- Mitchell, Selman and Levesque's paper is short and readable, and started a long line of work on phase transitions.:cite[mitchell1992]
- Mancinelli and colleagues show why package installation is hard, and how SAT tools handle real distributions.:cite[mancinelli2006]
