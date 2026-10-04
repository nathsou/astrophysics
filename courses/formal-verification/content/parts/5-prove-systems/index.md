---
number: V
title: 'How we got here: prove systems'
summary: 'From invariants invented by hand for concurrent programs in the 1970s to machines that find them: k-induction with a SAT solver (2000), IC3 (2011), and decidable logics for protocols of any size, an idea from 1928 put to work by Ivy in 2016. Then verified distributed systems built from the ground up.'
duration: About 15 minutes
---

Part I checked systems by visiting their states, Part II by encoding a bounded number of steps as a formula. Both answer *is there a bad run of this length, in this instance?* Part V asks for more: a proof that no bad state is ever reached, by any run of any length. The tool is the one chapter 18 used for loops, an inductive invariant. The story of Part V is how the job of finding such invariants moved from the person to the machine.

## Invariants for concurrent programs

Proving a sequential program correct with Hoare's rules was hard enough. A concurrent one adds a new problem: an assertion that holds in one process can be broken by a step of another. In 1976 Susan Owicki and David Gries extended Hoare logic to parallel programs by adding exactly that check, **interference freedom**: every assertion in the proof of one process must be preserved by every step of the others.:cite[owicki1976] A year later Leslie Lamport proved multiprocess programs correct with invariants of the whole system state, the method that chapter 23 automates.:cite[lamport1977]

Over the next fifteen years the method became a discipline. Amir Pnueli's temporal logic of 1977 gave a language for properties of systems that run forever (chapter 3),:cite[pnueli1977] and Zohar Manna and Pnueli's books of 1992 and 1995 set out the specification of reactive systems and the proof rules for their safety properties, with invariants at the centre.:cite[manna1992,manna1995] Lamport's Temporal Logic of Actions (1994) proves safety the same way: an invariant, and a proof that every action preserves it.:cite[lamport1994] In all of this, the invariant came from a person. The proof rules checked it; nothing proposed it.

## Machines check the step

The checking could be automated as soon as solvers were good enough. In 2000 Mary Sheeran, Satnam Singh and Gunnar Stålmarck combined induction with a SAT solver to prove safety properties of hardware designs, and introduced **k-induction**: if no k consecutive states that satisfy the property can be followed by one that violates it, and no run shorter than k violates it, the property holds.:cite[sheeran2000] A property too weak to be inductive by itself may still be k-inductive, as Peterson's algorithm is in chapter 23, at k = 17. The method was a natural partner of bounded model checking, which had appeared the year before and supplies the base case.:cite[biere1999]

## Machines find the invariant

k-induction proves what it is given, or fails. The breakthrough came in 2011, when Aaron Bradley published IC3, an algorithm that **builds** an inductive invariant, one clause at a time, from the counterexamples to induction it meets.:cite[bradley2011] It never unrolls the transition relation, and it never stores the reachable states; it keeps a short sequence of over-approximations and refines them with many small SAT queries. Bradley's implementation placed third in the hardware model checking competition of 2010, against tools that combined many engines.:cite[bradley2011] Niklas Eén, Alan Mishchenko and Robert Brayton reimplemented it the same year as property-directed reachability (PDR).:cite[een2011] Chapter 24 runs it step by step. Its answer is an invariant that anyone can re-check with three SAT queries, which is why IC3's proofs, unlike those of a BDD-based model checker, come with short certificates.

## For every N

The same years brought systems whose size is a parameter: a protocol for any number of nodes, a cache for any number of processors. Krzysztof Apt and Dexter Kozen had shown in 1986 that properties of such families are undecidable in general.:cite[apt1986] One way through is to stay in a fragment of logic where they are not. Paul Bernays and Moses Schönfinkel in 1928, and Frank Ramsey in 1930, had found such a fragment while working on Hilbert's decision problem: formulas whose existential quantifiers all come before the universal ones, with no function symbols, have small models, so their satisfiability can be decided.:cite[bernays1928,ramsey1930] In 2016 Oded Padon, Kenneth McMillan, Aurojit Panda, Mooly Sagiv and Sharon Shoham built **Ivy** around that fragment. Protocols are modelled so that their verification conditions stay inside it, every check therefore terminates with an answer, and every counterexample to induction is shown as a small picture for the user to generalise.:cite[padon2016] Chapter 25 proves two-phase commit and a ring leader election that way, for every N.

## Verified distributed systems

Model checkers and invariant finders work on models. In 2015 two projects verified distributed systems down to running code. IronFleet, at Microsoft Research, used Dafny to prove a Paxos-based replicated state machine and a sharded key-value store correct, from a high-level specification to the implementation.:cite[hawblitzel2015] Verdi, at the University of Washington, offered a framework in the Coq proof assistant for implementing distributed systems and verifying them under models of network faults.:cite[wilcox2015] Both rely on invariants of the whole distributed state, written by people and checked by machine. Chapter 28, the Ledger capstone, follows their method on a small scale, and chapter 29 looks at what such proofs leave out.

::timeline{part="V"}

## In this part

- **Chapter 23, Inductive invariants.** Counterexamples to induction, strengthening by hand, k-induction, and the parity of the 15 puzzle.
- **Chapter 24, IC3.** Frames, relative induction, generalisation and propagation, run event by event.
- **Chapter 25, For every N.** A decidable fragment of logic, two-phase commit for every number of shards, and leader election on rings of any size.

Every proof in this part ends in a certificate: unsatisfiable SAT queries whose DRAT proofs the course re-checks, or an invariant that three such queries confirm.
