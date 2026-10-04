---
number: 7
title: Inside a SAT solver
summary: How a solver decides a formula with thousands of variables. Unit propagation and backtracking (DPLL, 1962); learning from conflicts and jumping back past irrelevant decisions (GRASP, 1996); watched literals, VSIDS and restarts (Chaff and after). You drive a CDCL solver step by step and predict what it learns.
duration: About 1 hour 30 minutes
---

A SAT solver is backtracking search with a memory. It guesses a value for a variable, follows the consequences, and when the consequences contradict each other it backs up. That much was in Davis, Logemann and Loveland's procedure of 1962.:cite[davis1962] What makes modern solvers different is what they do with a contradiction: they work out *why* it happened, write the reason down as a new clause so that the same mistake is never made twice, and jump back past every decision that had nothing to do with it. This is **conflict-driven clause learning** (CDCL), introduced in GRASP in 1996 and made fast by Chaff in 2001.:cite[marquessilva1996,moskewicz2001] This chapter takes it apart.

:::programmer
**CDCL is backtracking search with memoisation of failures.** A plain backtracking search rediscovers the same dead end in every branch that leads to it. CDCL caches each dead end as a clause, so that the whole family of branches that would hit it is cut off before it is entered.
:::

## Unit propagation

Start with what a solver does without guessing. A clause is **unit** when all its literals but one are false: then the last one must be true. Making it true may make other clauses unit, and so on. This chain reaction is **unit propagation**, and solvers spend most of their time doing it.

Consider the clauses below, with a partial assignment that sets x₁ true.

| Clause | With x₁ true |
|---|---|
| ¬x₁ ∨ x₂ | unit: x₂ must be true |
| ¬x₂ ∨ x₃ | then unit: x₃ must be true |
| ¬x₁ ∨ ¬x₃ ∨ x₄ | then unit: x₄ must be true |

One decision forced three more values. Propagation can also find a **conflict**: a clause whose literals are all false. Then the current assignment cannot be extended to a model, and something must be undone.

## DPLL: decide, propagate, backtrack

The procedure of Davis, Logemann and Loveland, **DPLL**, alternates three moves.

1. **Propagate** until no clause is unit.
2. If a clause is false, **backtrack**: undo the most recent decision that has not been tried both ways, and try its other value.
3. Otherwise, if every variable has a value, the formula is satisfied. If not, **decide**: pick an unassigned variable and a value, and go back to 1.

Each decision opens a new **decision level**. Everything propagated after the decision belongs to its level, and backtracking undoes whole levels. The sequence of assignments, in order, is the **trail**.

DPLL is complete: on an unsatisfiable formula it explores every branch and reports *unsatisfiable*. Its weakness is that it learns nothing. If the conflict was caused by decisions made long ago, it flips the most recent decision anyway, explores the same doomed subtree again with a different irrelevant choice, and rediscovers the same conflict, exponentially many times.

## Learning from a conflict

When propagation finds a false clause, the solver knows exactly how every literal on the trail got its value: a decision, or a **reason**, the clause that became unit and forced it. These reasons form the **implication graph**: one node per assigned literal, with an arrow from each other literal of a literal's reason to it. A conflict is a node that is reached from both a literal and its negation.

Here is the example from the GRASP paper, as the stepper below shows it.:cite[marquessilva1999] Nine clauses over thirteen variables. Make the decisions ¬x₉, ¬x₁₀, ¬x₁₁, x₁₂, x₁₃ (one per level, propagating after each), and finally x₁. Propagation then forces x₂, x₃, x₄, x₅ and x₆, and clause 6, ¬x₅ ∨ ¬x₆, is false.

::cdcl-stepper{clauses='[[-1,2],[-1,3,9],[-2,-3,4],[-4,5,10],[-4,6,11],[-5,-6],[1,7,-12],[1,8],[-7,-8,-13]]' nvars=13 caption="The CDCL stepper. Decide with the buttons (x or ¬x), propagate one clause at a time or all at once, and press Learn and backjump at a conflict. Decisions have a blue border; each implied literal carries the number of the clause that forced it. Solver's step makes the solver's own choice: propagate if possible, otherwise decide the lowest unassigned variable false."}

Which clause should the solver learn? Each *cut* through the implication graph that separates the decisions from the conflict gives a valid clause: the negation of the literals on the decision side of the cut, which together lead to the conflict. Cut right next to the decisions and you learn "these six decisions are incompatible", which is true and nearly useless, because those exact six decisions will never be made again. Cut right at the conflict and you learn the conflict clause itself, which you already had.

GRASP's answer is the cut at the **first unique implication point** (1-UIP): the literal of the current decision level, closest to the conflict, through which every path from the level's decision to the conflict passes. In the example it is x₄. Everything about the conflict at the current level goes through x₄; x₄ together with ¬x₁₀ and ¬x₁₁, from earlier levels, forces x₅ and x₆ and so the conflict. The learned clause says that this combination is impossible:

$$
\lnot x_4 \lor x_{10} \lor x_{11}
$$

The solver computes it by **resolution**, walking backwards along the trail: start with the false clause, and repeatedly resolve it with the reason of its literal of the current level that was assigned last, until only one literal of the current level remains. That literal is the UIP. The stepper shows the steps.

## Backjumping

The learned clause has one literal from the current level (¬x₄) and two from earlier levels (x₁₀ from level 2 and x₁₁ from level 3). If the solver jumps back to level 3, the highest of the others, and undoes everything after it, the learned clause is **unit** there: x₁₀ and x₁₁ are false, so ¬x₄ is forced. The decisions x₁₂ and x₁₃ at levels 4 and 5, which had nothing to do with the conflict, are thrown away.

This is **non-chronological backtracking**, or **backjumping**. DPLL would have flipped the last decision, x₁, and kept x₁₂ and x₁₃, irrelevant as they were. CDCL jumps back to the level where the new clause first has something to say.

```predict
q: 'After learning ¬x₄ ∨ x₁₀ ∨ x₁₁ and jumping back to level 3, can the solver ever again assign x₄ true while x₁₀ and x₁₁ are both false?'
options:
  - text: Yes, after a restart, when the learned clauses are cleared.
    why: 'Restarts undo the assignment, not the learned clauses. The clause stays (unless the solver later deletes it as useless, which it may do for clauses that are not involved in recent conflicts).'
  - text: No. The learned clause is part of the formula now, and propagation forbids that combination in every branch.
    correct: true
    why: 'That is the memoisation. The clause is implied by the original formula (it was derived by resolution), so adding it changes nothing about satisfiability, and it prunes every future branch that would contain the same combination.'
  - text: Only if x₁ is false.
    why: 'The learned clause does not mention x₁: whatever x₁ is, x₄ with ¬x₁₀ and ¬x₁₁ leads to the same conflict. Learning generalised the conflict beyond the decision that revealed it.'
```

## Drive the solver

Now you make the predictions. The formula below says that four pigeons fit into three holes with at most one pigeon per hole. It is unsatisfiable. The solver makes its own decisions (each time, the lowest unassigned variable, set to false), and at each conflict above level 0 (there are five) you predict the learned clause, among three candidates, and the level it jumps back to. Three correct predictions solve the exercise.

::cdcl-stepper{clauses='[[1,2,3],[4,5,6],[7,8,9],[10,11,12],[-1,-4],[-1,-7],[-1,-10],[-4,-7],[-4,-10],[-7,-10],[-2,-5],[-2,-8],[-2,-11],[-5,-8],[-5,-11],[-8,-11],[-3,-6],[-3,-9],[-3,-12],[-6,-9],[-6,-12],[-9,-12]]' nvars=12 names='["","p1h1","p1h2","p1h3","p2h1","p2h2","p2h3","p3h1","p3h2","p3h3","p4h1","p4h2","p4h3"]' drive=true id="inside-a-sat-solver/drive" caption="Drive mode. pᵢhⱼ means pigeon i is in hole j. Use Solver's step to advance; at each conflict, choose the clause the solver learns (A, B or C) and the backjump level, then check."}

Two of the five learned clauses are a single literal, such as ¬p1h3: a fact true in every model, if there were one. Those send the solver back to level 0, where nothing is assumed. The last conflict happens at level 0 itself, and a conflict with no decisions to undo is a proof that the formula is unsatisfiable.

## Making it fast

GRASP's ideas are what the solver does. Making it fast took further ideas, and each one came with a measurement.

- **Watched literals** (Chaff, 2001). To find unit clauses, the stepper above inspects every clause after every assignment, which is fine for nine clauses and hopeless for a million. A clause can only become unit when one of its last two unassigned literals is assigned false. So each clause *watches* two of its literals, and an assignment only visits the clauses that watch the literal that just became false. Backtracking costs nothing, because watches stay valid when assignments are undone.:cite[moskewicz2001]
- **VSIDS** (Chaff, 2001). Which variable to decide next? Keep a score per variable, bump the scores of the variables in each learned clause, and decay all scores over time; decide on the highest. The solver focuses on the variables involved in recent conflicts, which in structured problems are the variables that matter.:cite[moskewicz2001]
- **Restarts.** Every so often, undo all decisions and start the search again, keeping the learned clauses and the VSIDS scores. Search times on similar problems vary wildly, and Gomes, Selman and Kautz showed that restarts cut off the long unlucky runs.:cite[gomes1998] The course's solver restarts on Michael Luby's schedule, 1, 1, 2, 1, 1, 2, 4, … times a constant, which is within a logarithmic factor of the best possible schedule for an unknown distribution of run times.:cite[luby1993]
- **Phase saving.** When a variable is decided again after a backjump or a restart, give it the value it last had: the solver returns quickly to the part of the search space it was exploring.:cite[pipatsrisawat2007]
- **Clause deletion.** Learned clauses accumulate. Keep the ones that are likely to be useful: Glucose's measure, the **literal block distance** (the number of distinct decision levels among a clause's literals), turned out to predict usefulness well, and low-LBD clauses are kept.:cite[audemard2009]

The course's solver (`src/lib/fv/sat/solver.ts`, about 700 lines) has all of these. The benchmark below switches them on one at a time.

The conflict counts below are the same on every machine (the solver is deterministic); the times are your browser's. Each idea pays off where the formula has the structure it bets on: the Sudoku and the random formula show the large wins, and the queens are easy for everything.

::ideas-bench{caption="What each idea buys, measured in your browser on four formulas. The full solver is not the fastest on every formula, and a solver can lose on a small instance what it wins on a large one: these are four data points, not a ranking."}

```quiz
q: 'On the pigeonhole formula, learning alone needs the fewest conflicts, and adding VSIDS multiplies them by about six. What does that show?'
options:
  - text: The course's VSIDS has a bug.
    why: 'The same heuristic cuts the random formula from about 12,000 conflicts to about 1,500. It is doing its job; the job does not suit this formula.'
  - text: Heuristics are bets on structure. VSIDS bets that the variables of recent conflicts matter most; in a formula as symmetric as the pigeonhole principle there is no such structure to find, and the fixed order happens to be lucky.
    correct: true
    why: 'Every pigeon and every hole is interchangeable, so focusing on recent conflicts buys nothing. Chapter 8 shows that this formula is hard for every CDCL solver as it grows, whatever its heuristics: the number of conflicts must grow exponentially.'
  - text: The pigeonhole formula is satisfiable, and VSIDS is designed for unsatisfiable formulas.
    why: 'Seven pigeons do not fit in six holes: the formula is unsatisfiable, as the results show. VSIDS is not specific to either answer.'
```

## Under the hood: the course's solver

The stepper and the real solver share the algorithm and differ in engineering. The real one stores literals as integers (2v for v, 2v + 1 for ¬v), keeps the watches in arrays per literal, and keeps the unassigned variables in a binary heap ordered by VSIDS score. Its conflict analysis also *minimises* learned clauses, removing literals implied by the others. Two features matter for the rest of the course:

- **Proof output.** With `proof: true`, the solver writes every learned clause and every deletion to a DRAT proof, which Chapter 8's checker verifies independently.
- **A theory hook.** After each round of propagation, the solver can ask a *theory* whether the current assignment is consistent with what the variables mean. That turns it into the core of the SMT solver of Part III (DPLL(T)).

:::hood
**When the algorithms appeared.** DPLL: 1962, replacing the memory-hungry elimination of Davis and Putnam (1960).:cite[davis1960,davis1962] Clause learning and non-chronological backjumping: GRASP, 1996, adapting ideas from constraint satisfaction and truth maintenance.:cite[marquessilva1996] Watched literals and VSIDS: Chaff, 2001, which replaced counting the false literals of every clause and static branching heuristics. MiniSat (2003) put it all in a few thousand lines and became the solver everyone extended.:cite[een2003]
:::

:::industry
**SAT solvers in the toolchain.** CDCL solvers sit inside hardware model checkers and equivalence checkers (Chapter 10), SMT solvers (Part III), package managers (Chapter 6), test generators, and AWS's policy analysers. The annual SAT competitions keep pushing them: most improvements since MiniSat have been refinements of these same ideas, together with *inprocessing* (simplifying the formula during search).
:::

:::proved
**What did we prove?** When the solver says *satisfiable*, its model can be checked by evaluating every clause, and the course does. When it says *unsatisfiable*, the stepper's run contains the evidence: each learned clause was derived by resolution from clauses that were already there. The course's real solver writes that evidence down as a proof. [Chapter 8](/chapters/proofs-of-unsatisfiability/) checks it.
:::

## What comes next

A solver that says *unsatisfiable* is asking to be believed. [Chapter 8](/chapters/proofs-of-unsatisfiability/) shows what a proof of unsatisfiability looks like, why checking one is much easier than finding one, and why some true statements, such as the pigeonhole principle, have no short proofs of this kind at all.

## Further reading

- Marques-Silva and Sakallah's journal paper on GRASP explains conflict analysis with the example used here.:cite[marquessilva1999]
- The Chaff paper is short, and a model of engineering by measurement.:cite[moskewicz2001]
- Eén and Sörensson's MiniSat paper describes a complete modern solver in a few pages.:cite[een2003]
