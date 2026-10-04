---
number: IV
title: 'How we got here: prove programs'
summary: 'Proving programs correct is as old as programs. From assertion boxes in 1947 and Turing''s three-page proof in 1949, through Floyd, Hoare and Dijkstra, a backlash in 1979, and contracts in Eiffel, to the automatic verifiers that descend from ESC: Boogie, Dafny, Why3, Frama-C, KeY and SPARK. Then the heap, from Burstall to separation logic and Infer, and the Rust verifiers.'
duration: About 15 minutes
---

Parts II and III built solvers. Part IV puts them to the use they were first built for: proving that a program meets its specification for every input. The program verifier of chapter 16 onwards reads a function with its contract, turns each claim into a formula, and hands the formula to the solver of Part III. Every step of that pipeline has a history, and most of it was written before there was a solver to run it.

## Assertions before programming languages

The idea is as old as stored-program computers. In 1947, Herman Goldstine and John von Neumann's report on programming the IAS machine introduced flow diagrams, and among the boxes of those diagrams were **assertion boxes**: statements about the values of the variables that must hold whenever control passes that point.:cite[goldstine1947,jones2003] Two years later, at a conference in Cambridge, Alan Turing gave a three-page talk, *Checking a large routine*, that proved a small program correct: he annotated its steps with assertions, checked each step against them, and argued separately that it terminates.:cite[turing1949] Turing's point is the one this course makes in chapter 0: a programmer should help the checker by stating the assertions, so that each one can be checked on its own.

For more than a decade after that, while the first programming languages were being invented, the idea was little developed. They came back with John McCarthy, who argued in 1963 for a mathematical science of computation and gave a method, recursion induction, for proving properties of recursively defined functions,:cite[mccarthy1963] and with Peter Naur, who in 1966 proposed *general snapshots*: statements of what holds whenever the computation reaches a given point of the program, used to prove it correct.:cite[naur1966] They are the loop invariants of chapter 18 under another name.

## Floyd, Hoare and a crisis

Robert Floyd's 1967 paper made the method systematic. Attach an assertion to each edge of a flowchart; then each command, read between the assertions before and after it, gives a **verification condition**, a formula about values only; prove every verification condition and the program is correct. For termination, find a quantity that every loop decreases in a well-founded order.:cite[floyd1967] Two years later Tony Hoare recast this as a logic for structured programs, with the triple {P} S {Q} and a rule for each construct of the language: the axiomatic semantics of chapter 17.:cite[hoare1969]

The timing was not an accident. In October 1968 a NATO conference at Garmisch had gathered the people who built large systems, and its report described projects that were late, over budget and unreliable; the participants talked openly of a crisis in software, and the conference made the phrase *software engineering* popular.:cite[naur1969] Proofs of correctness were one of the answers on offer. Edsger Dijkstra pushed the answer furthest. His weakest-precondition calculus of 1975 computes, backwards from a postcondition, exactly what must hold before a program runs,:cite[dijkstra1975] and in *A Discipline of Programming* (1976) he argued that a program and its proof should be developed together, the proof leading.:cite[dijkstra1976] David Gries's *The Science of Programming* (1981) turned that view into a textbook, with heuristics for finding invariants that chapter 18 still uses.:cite[gries1981]

## The backlash

Not everyone was convinced. In 1979, Richard De Millo, Richard Lipton and Alan Perlis argued in *Communications of the ACM* that mathematicians come to believe a theorem through a social process: a proof is read, discussed, simplified, taught and used. Program verifications, long and dull and about one program, would never get that attention, so they would never earn that trust.:cite[demillo1979] In 1988 the philosopher James Fetzer went further: an algorithm is a mathematical object and can be proved correct, but a program runs on a physical machine, and no deduction can guarantee what a machine will do.:cite[fetzer1988] Both papers drew furious replies; Donald MacKenzie's history of computer proof tells the story of both controversies.:cite[mackenzie2001]

Both critiques left marks on this course. The answer to the first was to have machines check the proofs, so that nobody has to read them; the trust then moves to the checker, which is why the course's certificates are checked by small, separate programs. The answer to the second is honesty about the assumptions: every verdict in this course lists what it took for granted, and Part VII is about what a proof does not cover.

## Contracts and automatic verifiers

Meanwhile, specifications moved into programming languages. Bertrand Meyer's **design by contract**, built into his language Eiffel in the mid-1980s, made preconditions, postconditions and class invariants part of the code, checked at run time and read by the people calling it.:cite[meyer1986,meyer1992] Chapter 16 starts there.

The step from run-time checks to automatic proofs came from the DEC (later Compaq) Systems Research Center. Its Extended Static Checker for Modula-3, described in 1998, and then ESC/Java in 2002, read lightly annotated programs, generated verification conditions and sent them to the Simplify prover.:cite[detlefs1998,flanagan2002] ESC was deliberately neither sound nor complete; it was meant to find errors. Its successors at Microsoft Research kept the architecture and aimed for soundness: Spec#, a C# with contracts verified statically;:cite[barnett2005] **Boogie**, the intermediate verification language underneath it, a small language into which many source languages are translated and from which verification conditions are generated;:cite[barnett2006] and **Dafny**, a language designed for verification from the start.:cite[leino2010] The verifier in this course follows that design: Vouch, verification conditions, an SMT solver.

Other lines grew in parallel. **Why3** offers its own language, WhyML, also used as an intermediate language for verifying C, Java and Ada programs, and sends its conditions to many provers.:cite[filliatre2013] **Frama-C** is a platform of cooperating analyses for C, including deductive verification.:cite[kirchner2015] **KeY** verifies Java programs specified in the Java Modeling Language; it is the tool that found the bug in OpenJDK's sort in chapter 19.:cite[ahrendt2016,degouw2015] **SPARK**, a subset of Ada with contracts and its own proof tools, is aimed at high-integrity software in fields such as avionics and railways.:cite[barnes2003]

## The heap

Pointers were the hardest part. Rod Burstall's 1972 paper showed how to reason about programs that alter linked lists,:cite[burstall1972] but for the next quarter of a century proofs of pointer programs had to state and check, by hand, which pointers did not alias. Separation logic, developed around 2000–2002 by John Reynolds, Peter O'Hearn, Hongseok Yang and others, made non-aliasing part of the assertion language and gave the frame rule (chapter 21).:cite[ohearn2001,reynolds2002] Then it was automated: Smallfoot executed programs symbolically over separation-logic formulas in 2005, bi-abduction in 2009 inferred specifications instead of requiring them, and the start-up that built it, Monoidics, joined Facebook in 2013, where its analyser became Infer (chapter 22).:cite[berdine2005,calcagno2009,fbinfer2015]

## A grand challenge

In 2003 Hoare proposed the **verifying compiler** as a grand challenge for computing research: a compiler that would check the correctness of the programs it compiles, using the programmer's assertions.:cite[hoare2003] It has not been met in that form, but its pieces arrived. In 2009 the seL4 project published a machine-checked proof that the C code of an operating-system microkernel implements its specification.:cite[klein2009] Verifiers began to build on Rust's ownership types, which already prove the absence of aliasing that separation logic must otherwise establish: Prusti in 2019, Creusot in 2022, Verus in 2023.:cite[astrauskas2019,denis2022,lattuada2023] And verifiers moved into the editor: the Vouch language server in this course re-verifies a function each time you change it.

::timeline{part="IV"}

## In this part

- **Chapter 16, Specifications and contracts.** Requires, ensures, modular verification, and a bank of wrong programs that tests your specifications.
- **Chapter 17, Weakest preconditions.** Hoare triples, the wp calculus, and the formulas sent to the solver.
- **Chapter 18, Loop invariants and termination.** The missing piece, counterexamples to induction, and the Zune freeze.
- **Chapter 19, Quantifiers, ghosts and lemmas.** Sortedness and permutations, triggers, and lemmas as recursive proofs.
- **Chapter 20, Data abstraction and refinement.** Representation invariants and abstraction functions.
- **Chapter 21, The heap: separation logic.** Aliasing, the frame problem, points-to and the separating conjunction.
- **Chapter 22, Linked structures and ownership.** List segments, memory safety, and Rust's borrow checker as permission accounting.

Each verdict in this part comes with its evidence: the solver's certificate for a proof, a replayed run for a counterexample, and a plain *unknown*, with the reason, when neither is available.
