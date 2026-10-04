---
number: 8
title: Proofs of unsatisfiability
summary: When a solver says "no assignment works", why should you believe it? Resolution proofs, the RUP and DRAT certificates that real solvers write, a checker that catches a lying solver, and the pigeonhole principle, a true statement that has no short resolution proof.
duration: About 1 hour 15 minutes
---

When a SAT solver says *satisfiable*, it hands you a model, and you can check it by evaluating every clause: a few microseconds of work that needs no trust in the solver at all. When it says *unsatisfiable*, it is claiming that none of the 2ⁿ assignments works. You cannot check that by trying them. The solver is 700 lines of clever code, with heuristics, restarts and clause deletion, and every one of those lines could hide a bug that makes it give up on a branch too early.

This chapter is about the answer the field settled on: a solver that says *unsatisfiable* must also write down **why**, in a form that a much simpler program can check. Chapter 7's stepper already showed the idea. Every clause it learned was derived from clauses it already had, by a rule anyone can check. Write the derivations down and you have a proof.

## Resolution

The rule is **resolution**. From two clauses in which one variable appears with opposite signs, derive the clause made of everything else:

$$
\frac{A \lor x \qquad B \lor \lnot x}{A \lor B}
$$

It is sound: whatever assignment satisfies both premises satisfies the conclusion. If x is true, the second premise needs B; if x is false, the first needs A; either way A ∨ B holds. So if you derive the **empty clause** (a disjunction of nothing, which no assignment satisfies), the premises cannot all be true together. A derivation of the empty clause is a **refutation**: a proof that the clauses are unsatisfiable.

Try it. The five clauses below are unsatisfiable. Click two clauses to resolve them; the result is added to the list. Derive the empty clause.

::resolution-game{clauses='[[1,2],[-1,3],[-2,3],[-3,4],[-3,-4]]' names='["","a","b","c","d"]' id="proofs-of-unsatisfiability/game" caption="Resolution by hand. Resolving two clauses that clash on two variables gives a tautology, which the widget refuses: such a clause is true in every assignment and never helps."}

The converse holds too, and it is what makes resolution a proof system rather than a trick: every unsatisfiable set of clauses has a resolution refutation. Davis and Putnam's procedure of 1960 finds one by eliminating the variables one at a time with resolution. Robinson made resolution, lifted to first-order logic, the basis of automated theorem proving in 1965.:cite[davis1960,robinson1965]

```quiz
q: 'Clauses 1, a ∨ b, and 2, ¬a ∨ ¬b, clash on both a and b. Why is "resolving on both at once" to get the empty clause wrong?'
options:
  - text: It is not wrong, just unusual.
    why: 'The two clauses are satisfied together by a true and b false. If the empty clause followed from them, they would be unsatisfiable, and they are not.'
  - text: Resolution removes one variable. Resolving on a gives b ∨ ¬b, which is true in every assignment and says nothing.
    correct: true
    why: 'The rule removes exactly one complementary pair. Removing two at once is unsound, and it is one of the two classic ways to forge a refutation by hand (the other is dropping a literal).'
  - text: The empty clause can only come from two unit clauses.
    why: 'That is true of the last step of any refutation, but it is not why this step is wrong: it is wrong because it is not an instance of the rule.'
```

## A CDCL run is a resolution proof

Look back at chapter 7's conflict analysis: it started from the false clause and resolved it with the reasons of its literals, one at a time, until one literal of the current level was left. Each learned clause is the end of a chain of resolution steps. The final conflict, at level 0, resolves all the way down to the empty clause. So a CDCL solver that answers *unsatisfiable* has, in effect, built a resolution refutation. Here is the one the stepper builds for three pigeons in two holes.

::proof-dag{clauses='[[1,2],[3,4],[5,6],[-1,-3],[-1,-5],[-3,-5],[-2,-4],[-2,-6],[-4,-6]]' nvars=6 names='["","p11","p12","p21","p22","p31","p32"]' caption="The refutation of three pigeons in two holes built by chapter 7's stepper, drawn as a graph: pᵢⱼ means pigeon i is in hole j. Input clauses are at the top (dashed), and each derived clause sits below its two premises. Every step is re-checked by the resolution rule when you select it."}

A proof is a graph, not a tree: a clause can be a premise many times. Here the input clauses p21 ∨ p22 and p31 ∨ p32 are each used twice, and in larger proofs learned clauses are reused constantly: the solver's memoisation from chapter 7, seen from the proof's side.

## Checking is simpler than finding

To check a refutation, check each step: are the two premises present, do they clash on exactly the pivot, is the result exactly the rest? Each step is a few lines of code, and the whole check takes time proportional to the size of the proof. Finding the proof required search through an exponential space; checking it requires none. This asymmetry is the whole point. A checker can be small, plain and obviously right, and then the clever solver need not be trusted at all.

There is a catch: what you trust moves from the solver to the checker, and to the claim that the formula the checker was given is the one you meant. Chapter 6's encodings and chapter 29's discussion of trusted bases come back to that.

## RUP and DRAT: what real solvers write

Writing every resolution step is wasteful: a learned clause can take hundreds of resolutions. In 2003 Goldberg and Novikov observed that a checker can rediscover them.:cite[goldberg2003] To check a learned clause C, assume every literal of C false and run unit propagation over the clauses so far. If propagation reaches a conflict, C follows. This is **reverse unit propagation** (RUP), and every clause a CDCL solver learns passes it, because the propagation that led the solver to the conflict happens again.

So a proof becomes a list of the learned clauses, in order, ending with the empty clause. The **DRAT** format, from Heule, Hunt and Wetzler, adds two things: deletions, so that the checker can forget clauses when the solver does and stay fast, and a more general rule called RAT that covers the techniques solvers use to simplify formulas.:cite[heule2013,wetzler2014] DRAT is the format used to validate the results of the SAT competitions.:cite[heule2016drat]

Below, the course's real solver (the one with watched literals, VSIDS and restarts) solves a formula and writes a DRAT proof, and its trusted checker replays it.

::drat-replay{caption="A DRAT proof from the course's solver, checked by its trusted checker (src/lib/fv/sat/check/drat.ts, about 140 lines and deliberately plain). Click a line to see its RUP check."}

:::programmer
**This is the pattern of the whole course.** A clever, untrusted engine produces an answer with a certificate; a small, trusted checker validates the certificate. A model is the certificate for SAT, a DRAT proof for UNSAT, and later chapters add Farkas multipliers for arithmetic (chapter 13) and inductive invariants for programs (chapter 18). The badges you have seen since chapter 0 say which certificate was checked.
:::

## The lying solver

Now break a solver on purpose. The solver below has one bug, in conflict analysis: when a learned clause has literals from earlier decision levels, it drops the one from the lowest level. It looks like an optimisation (shorter clauses propagate more), and on many formulas it gives the right answer. On this one it says *unsatisfiable*. Check its proof.

::lying-solver{clauses='[[-8,-6,7],[2,-1,-5],[-5,-6,-2],[-2,5,-4],[1,4,7],[-6,2,7],[-7,2,-1],[-4,-3,-8],[-3,2,-6],[2,1,-7],[6,3,8],[-5,2,-4],[8,4,3],[4,-1,2],[-5,-2,4],[6,-4,1],[-6,5,7],[-2,-7,3],[-2,5,7],[-6,-3,-8],[-8,-6,-7],[4,1,-3],[8,3,-6],[2,-6,8],[2,7,3],[3,-2,4],[-7,-8,6],[-3,1,-8],[-1,-2,3],[-3,5,8]]' nvars=8 id="proofs-of-unsatisfiability/liar" caption="A random 3-SAT formula with 8 variables and 30 clauses. The lying solver is chapter 7's stepper with one line changed; both are in src/lib/fv/sat/resolution.ts."}

The checker does not know what the bug is, or that there is one. It only knows that the second line of the proof does not follow from what came before. That is enough to refuse the answer, and it would be enough whatever the bug had been. A bug in the solver can make it slow, or make it fail to answer, but as long as the checker is right it cannot make the pipeline say *unsatisfiable* about a satisfiable formula.

Checkers can be made very trustworthy. Tan, Heule and Myreen's cake_lpr checker is formally verified down to its machine code, in the CakeML compiler's toolchain.:cite[tan2021]

::bad-step{clauses='[[1,2],[-1,3],[-2,3],[-3,4],[-4,-1]]' steps='[{"from":[2,4],"on":3,"clause":[-1,4]},{"from":[6,5],"on":4,"clause":[-1]},{"from":[1,7],"on":1,"clause":[2]},{"from":[3,8],"on":2,"clause":[3]},{"from":[1,3],"on":2,"clause":[1]},{"from":[7,10],"on":1,"clause":[]}]' names='["","a","b","c","d"]' id="proofs-of-unsatisfiability/bad-step" title="Find the bad step" caption="A hand-written refutation with one wrong step. Select the step you think is wrong, then check. (Each step names its two premises by number.)"}

## Honest numbers: checking is not always faster

"Checking is easier than finding" is a statement about what you must trust, and about worst cases. It is not a promise that checking is quick. A RUP check repeats unit propagation for every learned clause, and the course's checker, which has no watched literals on purpose, is slower than the solver on large proofs: on nine pigeons in eight holes, the solver (learning, fixed order) finds its proof in about a tenth of a second and the checker needs a few seconds. Production checkers such as DRAT-trim go backwards from the empty clause and check only the clauses the proof actually uses, which often skips most of them.:cite[heule2013,wetzler2014]

## The pigeonhole principle

n + 1 pigeons do not fit into n holes with at most one pigeon per hole. Any child can see why: count. Before you run the solver, predict.

```predict
q: 'How does the number of conflicts a CDCL solver needs grow with the number of holes n, for n + 1 pigeons in n holes?'
options:
  - text: Linearly, since the formula grows only polynomially (n(n+1) variables).
    why: 'The formula is small, but the solver cannot count. It has to rule out the placements piece by piece.'
  - text: Polynomially, like n³.
    why: 'For resolution, and therefore for any CDCL solver, it is provably worse than any polynomial. Run the plot.'
  - text: Exponentially, for every CDCL solver whatever its heuristics.
    correct: true
    why: 'Haken proved in 1985 that every resolution refutation of these formulas has exponential size. A CDCL run is a resolution refutation, so no heuristic can save it.'
```

::pigeon-growth{caption="Conflicts needed for n + 1 pigeons in n holes, measured in your browser, on a logarithmic scale: a straight line means exponential growth. The fixed variable order is lucky on this formula (chapter 7 explained why VSIDS has nothing to work with here), but both lines climb steadily. An open circle marks a run stopped by the time limit."}

Haken's theorem says that every resolution refutation of the pigeonhole formulas has a number of clauses exponential in n.:cite[haken1985] Since every CDCL run that answers *unsatisfiable* contains a resolution refutation (with at most a polynomial number of steps per conflict), every CDCL solver needs exponentially many conflicts on these formulas. Better heuristics cannot help; the limit is in the proof system.

Stronger proof systems escape it. In 1976 Cook gave short proofs of the pigeonhole principle in **extended resolution**, which may introduce new variables as abbreviations for formulas, the same move as Tseitin's encoding in chapter 6.:cite[cook1976,tseitin1968] DRAT's RAT rule can express extended resolution, so short DRAT proofs of the pigeonhole principle exist.:cite[heule2016drat] Finding them is another matter: CDCL solvers do not introduce variables, which is why the pigeonhole principle remains a standard example of a formula that is easy for people and hard for solvers.

:::history
**The 200-terabyte proof.** Can the numbers 1, 2, 3, … be coloured red and blue so that no Pythagorean triple a² + b² = c² is all one colour? Ronald Graham had offered $100 for the answer. In 2016 Heule, Kullmann and Marek showed that 1 to 7824 can be coloured that way and 1 to 7825 cannot. The *cannot* came from a SAT solver, run with cube-and-conquer on 800 cores for about two days, and because a solver's word was not enough, they produced a DRAT proof of almost 200 terabytes and checked it. They published a 68-gigabyte compressed certificate from which anyone can rebuild the proof.:cite[heule2016]
:::

:::proved
**What did we prove?** When the course's SAT solver says *unsatisfiable*, the badge says it was certified only if the DRAT checker accepted the proof. What is then established: the CNF given to the checker has no satisfying assignment, assuming the checker (about 140 lines) is correct. Not established: that the CNF says what you meant. That is the encoding's job, and chapter 6's counts of solutions are one way to test it.
:::

:::hood
**What the course checks.** The SAT badge's certificate is either a model, evaluated clause by clause, or a DRAT proof, replayed by `src/lib/fv/sat/check/drat.ts` with RUP and RAT. The SMT solver of Part III writes the same proofs, with an extra kind of line for theory lemmas, each checked by its own small theory checker.
:::

## What comes next

SAT solvers are now a tool you can trust. Part II uses them in two directions. [Chapter 9](/chapters/small-worlds/) (optional) looks for counterexamples in small relational models, and [Chapter 10](/chapters/unrolling-time/) unrolls a system's transitions into one big formula, to find bugs within k steps or prove two circuits equivalent.

## Further reading

- Haken's paper is the start of proof complexity; Cook's two-page note shows how one new variable per abbreviation changes everything.:cite[haken1985,cook1976]
- Heule's note on DRAT is a short description of the format real solvers write.:cite[heule2016drat]
- Heule, Kullmann and Marek tell the story of the Pythagorean triples problem and its proof.:cite[heule2016]
