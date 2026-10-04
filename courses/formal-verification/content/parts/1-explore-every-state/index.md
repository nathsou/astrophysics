---
number: I
title: 'How we got here: explore every state'
summary: Model checking began as a reaction against proving concurrent programs by hand. From Dijkstra's mutual exclusion problem to TLA+ at Amazon, by way of temporal logic and two independent inventions.
duration: About 15 minutes
---

Part I is about systems whose behaviour is not one computation but many: threads that interleave, messages that arrive in any order, attackers that choose what to send. Its method, *model checking*, is to build a finite model of the system and let a program visit every state of it. This essay is about where that idea came from, and why it took twenty years to become a technology.

## A problem with a one-page solution

In 1965 Edsger Dijkstra published a one-page paper in *Communications of the ACM*, *Solution of a problem in concurrent programming control*. Several processes share a resource, such as a printer or a data structure, and at most one of them may use it at a time. The only tools are reads and writes of shared variables, each of them atomic. Dijkstra gave a solution for any number of processes and argued, in prose, that it was correct.:cite[dijkstra1965]

The problem looked small, and it invited replies. In January 1966 the same journal printed a letter from Harris Hyman proposing a simpler solution for two processes. It was wrong: there is an order of steps in which both processes enter the critical section together.:cite[hyman1966] Chapter 2 finds that order in a few milliseconds. In 1966 it took readers to find it, by hand.

Hyman's letter became the standard example of a pattern that kept recurring. Concurrent algorithms are short, and their correctness arguments are long. The arguments consider the cases their authors thought of, and the bugs live in the interleavings nobody wrote down. Gary Peterson's two-process algorithm of 1981 was striking because it was short enough to check by hand; his paper was called *Myths about the mutual exclusion problem*.:cite[peterson1981]

## Logics for programs that do not stop

Proofs about sequential programs, in the style of Floyd and Hoare (Part IV), relate a program's input to its output. An operating system, a network protocol or a lock manager has no output in that sense: it is not supposed to stop. What can one say about it?

In 1977 Leslie Lamport separated two kinds of property. A *safety* property says that something bad never happens: two processes are never in the critical section together. A *liveness* property says that something good eventually happens: a process that wants to enter eventually does.:cite[lamport1977] The same year Amir Pnueli proposed to state such properties in *temporal logic*, a logic with operators for "always" and "eventually", borrowed from philosophers who had studied reasoning about time, and to reason about programs in it.:cite[pnueli1977] Both kinds of property, and Pnueli's logic, are the subject of Chapter 3. Bowen Alpern and Fred Schneider later gave safety and liveness precise definitions, and showed that every property is the intersection of one of each.:cite[alpern1985]

::bio-card{id=pnueli}

## Checking instead of proving

Temporal logic gave a language; proofs in it were as laborious as other proofs. The decisive step was to stop proving. If a system has finitely many states, whether it satisfies a temporal formula can be *decided* by a program that explores the states.

The idea arrived twice, independently. Edmund Clarke and his student Allen Emerson, at Harvard, presented it at a workshop on the logics of programs in 1981, and called it *model checking*: the system is a model of the formula, in the logician's sense, and the program checks that it is.:cite[clarke1981] In Grenoble, Jean-Pierre Queille and Joseph Sifakis built a tool, CESAR, that checked the same kind of question, and published it in 1982.:cite[queille1982] The three shared the Turing Award for 2007.:cite[acm-turing2007]

::bio-card{id=clarke-emerson-sifakis}

The first model checkers handled systems with thousands of states. Real systems have far more, because the number of states multiplies with every process and every variable: the *state explosion* that drives Part II and Part V. But the method had a property that proofs lacked. When the property failed, the checker did not just fail to finish a proof; it printed a *counterexample*, the sequence of steps that led to the bad state. Engineers could read a counterexample. That is still the main reason model checking is used.

In 1986 Moshe Vardi and Pierre Wolper recast the problem in terms of automata: translate the negation of the property into an automaton over infinite runs, run it in lockstep with the system, and look for a run that the automaton accepts. Such a run is a counterexample, and it can always be found in the shape of a lasso: a path followed by a loop.:cite[vardi1986] Chapter 3's checker works this way.

## Tools from the telephone company

At Bell Labs, Gerard Holzmann had been building verifiers for telephone-switching protocols since 1980. The tool that grew out of that work, SPIN, took models written in a C-like language, explored their states with careful engineering (bit-state hashing, partial-order reduction, compressed state storage) and checked properties in linear temporal logic. It was released publicly in 1991 and received the ACM Software System Award for 2001, the award that Unix and TeX had received before it.:cite[holzmann1997,acm-spin] SPIN made model checking something a software engineer could run, rather than a research result.

A second line came from process algebra. Tony Hoare's *Communicating sequential processes* (1978) described programs as processes that interact only by passing messages.:cite[hoare1978] In Oxford, CSP acquired a mathematical semantics, and in 1991 a small company, Formal Systems (Europe), built FDR, a tool that checked whether one CSP process *refined* another: whether every behaviour of an implementation was allowed by a specification.:cite[brookes-roscoe-fdr] In 1995 Gavin Lowe used FDR to find an attack on the Needham–Schroeder authentication protocol, seventeen years after the protocol was published.:cite[lowe1995,lowe1996] Chapter 5 re-enacts the attack.

## TLA+ and the industrial turn

Lamport, meanwhile, had been designing a language in which a system and its properties are both formulas of one logic. The *temporal logic of actions* (TLA, 1994) describes a system by its initial states and its possible steps, and builds in *stuttering*: steps that change nothing visible. Stuttering makes refinement, the relation between a specification and a more detailed design, simply logical implication.:cite[lamport1994] Chapter 4 uses this idea. In 1999 Yuan Yu, Panagiotis Manolios and Lamport built TLC, an explicit-state model checker for TLA+ specifications.:cite[yu1999]

::bio-card{id=lamport}

For years TLA+ was used mostly by researchers and hardware designers. In 2015 a group of engineers at Amazon Web Services reported that they had used it on ten large systems, including DynamoDB and S3, that it had found subtle bugs that review and testing had missed, and that engineers had learned it in a few weeks.:cite[newcombe2015] The paper was widely read. TLA+ is now used in industry for distributed protocols, and the course's systems borrow its ideas: actions with guards, stuttering, fairness and refinement.

## What Part I does

The five chapters of Part I follow this history. Chapter 1 explores the states of small systems; Chapter 2 adds threads and Dijkstra's problem; Chapter 3 adds temporal logic and fairness; Chapter 4 adds an unreliable network and refinement; Chapter 5 adds an attacker. Every result is a state count or a counterexample, and every counterexample is replayed before it is shown. What Part I does not do is escape the explosion: its badges say *all states of 3 processes*, never *any number*. Parts II and V take up that problem.

::timeline{part="I"}
