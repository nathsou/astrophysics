---
number: III
title: 'How we got here: reason with theories'
summary: Program verifiers needed decision procedures long before the name SMT existed. From the Stanford Pascal Verifier and Nelson and Oppen's combination of theories in 1979, through Simplify and ESC/Java, to SMT-LIB, DPLL(T) and solvers such as Z3; and, separately, symbolic execution, an idea of 1976 that waited thirty years for its solvers.
duration: About 15 minutes
---

Part II reduced questions to Booleans. That works for hardware, where everything is bits, and for puzzles, where everything is finite. Programs are different. Their variables are integers that can grow, arrays indexed by other variables, pointers, functions called with values nobody listed in advance. You can still turn a program's correctness into a formula, but the formula speaks about numbers, arrays and functions, and a SAT solver does not know what x + 1 > x means. Part III is about solvers that do: **satisfiability modulo theories** (SMT). The name dates from the early 2000s. The idea is twenty-five years older, and it was born inside program verifiers.

## Verifiers need decision procedures

A program verifier of the 1970s worked the way the one in Part IV of this course does: it took a program annotated with assertions, generated *verification conditions* (formulas that are valid exactly when the annotations are right), and tried to prove them. The Stanford Pascal Verifier, documented in 1979, was one of the first systems to do this for a real programming language.:cite[luckham1979] Its verification conditions mixed arithmetic, arrays, records and the program's own functions, and proving them by hand defeated the purpose.

Greg Nelson and Derek Oppen, both at Stanford (Oppen was one of the verifier's authors), found a way to build a prover for such mixtures. Separate decision procedures already existed for some theories on their own: for linear arithmetic, for equality with uninterpreted functions, for arrays. Nelson and Oppen showed how to make them **cooperate**: purify the formula so that each part speaks one theory, let each procedure work on its part, and have them exchange the equalities between shared variables that each one discovers, until one finds a contradiction or none can say more.:cite[nelson1979] Five years later Robert Shostak, at SRI, gave a different combination method, built around a fast procedure for equality and theories with canonical forms.:cite[shostak1984] The combination of theories is still the architecture of every SMT solver; chapter 12 shows the simplest theory at its centre, equality with uninterpreted functions, and its algorithm, congruence closure.

## Simplify and extended static checking

One of the most influential of these provers was Simplify, written by David Detlefs, Greg Nelson and James Saxe at the DEC (later Compaq) Systems Research Center.:cite[detlefs2005] It combined Nelson–Oppen cooperation with a way to use quantified axioms, *E-matching*, that chapter 19 returns to. Simplify was the engine of **ESC/Java**, the *extended static checker* that read Java programs with lightweight annotations and warned about null dereferences, array index errors and violated contracts.:cite[flanagan2002] ESC/Java made a deliberate trade: it was neither sound nor complete, but it was automatic, and it found real bugs in real code. Its architecture, a language of contracts compiled to verification conditions for an automatic prover, lives on in verifiers such as Boogie and Dafny, and in the verifier of chapter 16 onwards.

## A name, a format and a competition

By the early 2000s there were several provers for combinations of theories, each with its own input language and its own benchmarks, and no way to compare them. The **SMT-LIB** initiative, started in 2003, defined standard theories, a common input format and a shared library of benchmarks; the first SMT competition was held in 2005, alongside the conference on Computer Aided Verification.:cite[barrett2005] The course's solver prints its queries in SMT-LIB format, so you can run any of them through another solver.

At the same time, the best SAT solvers had become dramatically faster (Part II), and the question was how to put a CDCL solver in charge of the Boolean structure while theory solvers handled the rest. The answer, worked out by Robert Nieuwenhuis, Albert Oliveras and Cesare Tinelli and their colleagues, is **DPLL(T)**: the SAT solver assigns truth values to the formula's atoms, a theory solver checks whether the assignment is consistent, and when it is not, the theory solver returns a short explanation that the SAT solver learns as a clause.:cite[nieuwenhuis2006] Chapter 12 builds this conversation and lets you watch it. Each theory then needs a solver that is incremental, can backtrack, and explains its conflicts: for linear arithmetic, Bruno Dutertre and Leonardo de Moura's version of the simplex method, which chapter 13 implements, became the standard.:cite[dutertre2006]

The solvers that followed, Yices, the CVC family and Microsoft's Z3 among them, turned SMT into infrastructure.:cite[demoura2008] They sit inside program verifiers, symbolic executors, test generators, compilers' translation validators, cloud providers' policy analysers and smart-contract checkers. Chapter 14 shows two of those uses: proving compiler peephole rewrites with Alive, and asking questions about access policies.:cite[lopes2015]

## The ceiling

There is a limit that no engineering removes. In 1900 David Hilbert asked, as the tenth of his famous problems, for a procedure to decide whether a polynomial equation with integer coefficients has a solution in integers. In 1970 Yuri Matiyasevich, completing two decades of work by Martin Davis, Hilary Putnam and Julia Robinson, proved that no such procedure exists.:cite[matiyasevich1970] So no solver can decide arbitrary formulas with multiplication of integer variables, and every verifier that handles them will sometimes answer *unknown*. Chapter 13 shows where the line falls (linear arithmetic is decidable; nonlinear real arithmetic is too, at a price; nonlinear integer arithmetic is not) and what a solver does at the line.

## Symbolic execution: the other story

In 1976 James King proposed running a program on **symbolic** inputs: instead of x = 3, x is an unknown, every branch splits the run in two, and each path carries a *path condition*, the constraints on the inputs that lead down it.:cite[king1976] Solve a path condition and you have a test input that takes that path. The idea was right and the solvers were not ready: path conditions over integers and arrays were exactly the formulas that 1970s provers struggled with.

It came back thirty years later. DART, in 2005, combined concrete and symbolic execution to steer random testing down new paths.:cite[godefroid2005] In 2008 KLEE generated high-coverage tests for systems programs by symbolic execution of their compiled code,:cite[cadar2008] and SAGE applied *whitebox fuzzing* to large Windows applications at Microsoft.:cite[godefroid2008] Both rested on SMT solvers fast enough to answer thousands of queries per run. Chapter 15 builds a symbolic executor on the course's solver, and finds its limit: loops make the tree of paths infinite, which is why Part IV needs invariants.

::timeline{part="III"}

## In this part

- **Chapter 12, Equality and functions.** First-order logic in brief, uninterpreted functions, congruence closure, and DPLL(T).
- **Chapter 13, Arithmetic.** Simplex, Farkas certificates, integers with branch and bound, and why a solver says *unknown*.
- **Chapter 14, Bits and arrays.** Machine arithmetic by bit-blasting, arrays, and a court for compiler rewrites.
- **Chapter 15, Symbolic execution.** Paths, path conditions, generated tests, and the explosion of paths.

As in Part II, every *unsatisfiable* answer comes with a certificate that a small checker verifies: a DRAT proof for the Boolean part, and for each theory step its own evidence, from a chain of equalities to a set of Farkas multipliers.
