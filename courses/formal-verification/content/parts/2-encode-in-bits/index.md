---
number: II
title: 'How we got here: encode in bits'
summary: From an algebra of logic in 1847 to SAT solvers that handle millions of variables. Why satisfiability was declared hopeless in 1971 and became a commodity thirty years later, and how proofs of unsatisfiability made the answers trustworthy.
duration: About 15 minutes
---

Part I checked systems by listing their states, and ran into the wall of state explosion. Part II takes the other road: write the question as a formula of propositional logic and let a program search for an assignment that makes it true. The program is a **SAT solver**, and its history is one of the strangest in computing. The problem it solves was the first one proved to be, in a precise sense, as hard as any problem with checkable answers, and for twenty years that was taken as a reason not to try. Then, around the year 2000, solvers began to handle industrial problems with hundreds of thousands of variables, and they have not stopped improving.

## An algebra of thought

In 1847 George Boole, a self-taught mathematician who ran a school in Lincoln, published *The Mathematical Analysis of Logic*, and in 1854 *An Investigation of the Laws of Thought*.:cite[boole1847,boole1854] He treated propositions as quantities that could only be 0 or 1, and reasoning as algebra: x(1 − x) = 0, because nothing can be both true and false. Every encoding in Chapter 6 is Boolean algebra in this sense, and every circuit in your computer is too.

## Machines that reason

The first programs that decided propositional formulas were written as parts of theorem provers for first-order logic. In 1960 Martin Davis and Hilary Putnam described a procedure that eliminated variables one at a time by combining clauses.:cite[davis1960] It used too much memory, and in 1962 Davis, George Logemann and Donald Loveland replaced elimination by **search**: pick a variable, try a value, simplify, and backtrack on failure.:cite[davis1962] Their procedure, **DPLL**, is still the skeleton of every complete SAT solver. In 1965 J. Alan Robinson's **resolution** principle gave theorem proving its basic inference rule: from *A ∨ x* and *B ∨ ¬x*, conclude *A ∨ B*.:cite[robinson1965] Resolution is also the language in which solvers write their proofs (Chapter 8).

Two years later the Soviet logician G. S. Tseitin showed how to convert any formula into clauses without the exponential blow-up of the textbook method, by naming each subformula with a fresh variable.:cite[tseitin1968] Chapter 6 uses his transformation on every encoding.

## Hopeless

In 1971 Stephen Cook proved that every problem whose solutions can be checked quickly can be translated, quickly, into propositional satisfiability.:cite[cook1971] Leonid Levin found the same phenomenon independently in the Soviet Union, published in 1973.:cite[levin1973] SAT was **NP-complete**: a fast algorithm for it would give fast algorithms for thousands of other problems, from scheduling to protein folding, and almost everyone believes that no such algorithm exists.

The result was a landmark of theory, and for practice it read like a warning. SAT was the archetypal intractable problem, the thing you reduced *to* in order to show that something else was hard. The next two decades of SAT research produced important ideas (better branching heuristics, special cases that are easy, random formulas and their thresholds) but the general view was that only small instances could be solved.

## The turnaround

The change came from electronic design automation, where engineers had large Boolean problems and no choice but to solve them. In 1996 João Marques-Silva and Karem Sakallah's solver GRASP added **conflict-driven clause learning**: when the search fails, analyse why, record the reason as a new clause, and jump back past every decision that did not contribute.:cite[marquessilva1996] In 2001 a group at Princeton released **Chaff**, which made propagation cheap with **watched literals** and chose variables with the **VSIDS** heuristic, which favours variables involved in recent conflicts.:cite[moskewicz2001] Chaff solved problems one or two orders of magnitude faster than its predecessors. In 2003 Niklas Eén and Niklas Sörensson's **MiniSat** distilled these ideas into a short, clean program that anyone could read and extend.:cite[een2003] Annual SAT competitions, from 2002 onwards, turned improvement into a sport with public benchmarks. Chapter 7 builds a solver from exactly these ideas.

## Sets of states as formulas

Model checking took a parallel path. In 1986 Randal Bryant published **binary decision diagrams** (BDDs), a canonical, often compact representation of Boolean functions with efficient operations.:cite[bryant1986] A set of states is a Boolean function (true of the states in the set), so a BDD can represent billions of states at once. In 1990 Jerry Burch, Edmund Clarke, Kenneth McMillan, David Dill and L. J. Hwang published *Symbolic model checking: 10²⁰ states and beyond*, and McMillan's SMV checker made the technique practical for hardware.:cite[burch1990,mcmillan1993] Chapter 11 tells that story.

BDDs have a weakness: for some functions, multiplication among them, every BDD is huge. In 1999 Armin Biere, Alessandro Cimatti, Edmund Clarke and Yunshan Zhu proposed **bounded model checking**: unroll the system's transition relation *k* times into one big formula, and ask a SAT solver for a path of length *k* to a bad state.:cite[biere1999] As SAT solvers improved, bounded model checking overtook BDDs for finding bugs in hardware. Chapter 10 builds it.

## A chip that divided badly

In 1994 a mathematician found that Intel's new Pentium processor sometimes divided wrongly: a few entries in a lookup table used by its division algorithm were missing, and certain divisions came out slightly wrong. The error was rare, but its discovery was public and embarrassing, and Intel offered to replace the chips.:cite[pratt1995,edelman1997] The episode is often cited as one of the reasons the hardware industry invested heavily in formal verification: by 2009 Intel engineers reported verifying the execution engine of a Core i7 processor formally, in place of most of the traditional testing.:cite[kaivola2009] Chapter 10 re-enacts a toy version of the bug.

## Trust the answer, not the solver

A solver that says *satisfiable* hands over an assignment, which anyone can check. A solver that says *unsatisfiable* asks to be believed, and solvers have bugs. From 2013 the SAT community adopted proof formats, DRUP and then DRAT, in which a solver writes down a refutation that a small independent checker can verify, and SAT competitions came to require such proofs for unsatisfiable answers.:cite[heule2013,wetzler2014] The formats made possible record computations that would otherwise have been hard to believe: in 2016 Marijn Heule, Oliver Kullmann and Victor Marek settled the *Boolean Pythagorean triples* problem, a question in Ramsey theory, with a SAT computation whose proof, about 200 terabytes, was checked independently.:cite[heule2016] Chapter 8 is about such proofs, and the course's own solver writes them.

## Small worlds

Finally, SAT reached software design. Daniel Jackson's **Alloy** (2002) let designers describe a system with sets and relations, and searched, with a SAT solver, for a counterexample within a small bound on the number of objects.:cite[jackson2002] His *small scope hypothesis*, that most design flaws show up in small instances, was the same bet that Part I made with three processes, now applied to data. Jackson's book *Software Abstractions* (2006) made the method widely known.:cite[jackson2006] Chapter 9 builds small worlds of this kind.

::timeline{part="II"}
