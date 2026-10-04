---
number: 24
title: 'IC3: the machine finds the invariant'
summary: 'Chapter 23 strengthened invariants by hand, one counterexample to induction at a time. IC3 does the same automatically: it keeps a sequence of over-approximations of the reachable states, blocks bad states by showing they have no predecessor, generalises each blocked state into a clause, and pushes clauses forward until two frames agree. The result is an inductive invariant, which is also its certificate.'
duration: About 1 hour
---

Every proof in chapter 23 went the same way: check, read the counterexample to induction, ask why its first state cannot happen, write the answer as an invariant, check again. The answers were small facts about the system, and each ruled out a set of unreachable states. In 2011 Aaron Bradley published an algorithm that runs this loop by itself, with a SAT solver asking the questions.:cite[bradley2011] He called it IC3. Niklas Eén, Alan Mishchenko and Robert Brayton reimplemented it the same year under the name **property-directed reachability** (PDR), and the two names now mean the same family of algorithms.:cite[een2011] This chapter takes it apart and runs it, one event at a time.

## Frames

IC3 never unrolls the transition relation, as bounded model checking does. It keeps a sequence of **frames** F0, F1, …, FN, each a set of states described by a conjunction of clauses:

- F0 is the set of initial states.
- Fi contains every state reachable in at most i steps. It may contain more: a frame is an **over-approximation**.
- Each frame contains the one before it: F0 ⊆ F1 ⊆ … ⊆ FN.
- No frame from F1 on contains a bad state, once IC3 has worked on it.
- A step from a state in Fi lands in Fi+1.

A new frame starts as *every state* and is cut down clause by clause. The clauses are where the work goes: each one says that some set of states, which the solver has shown to be unreachable within i steps, is not in Fi. The course stores a clause at the highest level where it holds; Fi is every clause stored at level i or above.

If two consecutive frames ever become equal, Fi = Fi+1, then Fi is an inductive invariant: it contains the initial states (because F0 ⊆ Fi), a step from it lands in Fi+1 = Fi, and it contains no bad state. That is the proof.

## Blocking a bad state

The main loop asks the solver for a state in FN that violates the property. If there is none, IC3 opens a new frame. If there is one, call it s; it must be shown unreachable in N steps, or turned into a counterexample. IC3 asks a **relative induction** question: is there a state in FN−1, other than s itself, with a step to s?

FN−1 ∧ ¬s ∧ T ∧ s′

If this is unsatisfiable, s cannot be reached in N steps: it has no predecessor in the previous frame. Then ¬s becomes a clause of FN, and of every frame below it (which is sound, since they are contained in FN). If the query is satisfiable, the model is a predecessor t, in FN−1, of the bad state. Now t must be blocked at level N − 1: a **proof obligation**. Obligations are handled lowest level first. If one reaches an initial state, the chain of predecessors is a real run from an initial state to the bad state: a counterexample, which the course replays in the interpreter.

## Generalisation

Blocking one state at a time would be exhaustive enumeration with extra steps. The heart of IC3 is to block a whole **cube** of states at once. A state is a conjunction of literals, one per variable: `turn == 0 && P(0) at critical && P(1) at critical && flag[0] && flag[1]`. If the relative induction query stays unsatisfiable when some literals are dropped, the smaller cube describes many states, none reachable in N steps, and the clause that blocks it rules them all out.

Two sources tell which literals to drop. The SAT solver's **unsatisfiable core**: the literals of s′ that the proof of unsatisfiability actually used, which are often few. Then a loop that tries to drop each remaining literal in turn, keeping the query unsatisfiable and the cube disjoint from the initial states. The generalised clause is the fact that a person would have written after reading a CTI, found by the solver instead.

## Propagation

After the bad states of FN are blocked, IC3 adds FN+1 and tries to push every clause of each frame forward: a clause c of Fi also holds in Fi+1 if no state of Fi has a step into ¬c, which is one more SAT query, Fi ∧ T ∧ ¬c′. Clauses that every step preserves move up. When all the clauses stored at some level i have moved up, Fi and Fi+1 are the same set of clauses: the fixpoint.

Here is the whole algorithm on the smallest system worth running. A counter goes from 0 to 5 and wraps round to 0; it is stored in a variable that could hold 0 to 7. The property is that it never shows 7. Plain induction fails (6 would step to 7), and the eight dots are all the states the variable can hold.

:::ic3-stepper{title="IC3 on a counter"}
```vouch
system Counter {
  var n: 0..8 = 0
  action tick { n = if n == 5 { 0 } else { n + 1 } }
  invariant never7: n != 7
}
```
:::

Follow the events. In F1, the state 7 is bad; its only predecessor would be 6, which is not initial, so 7 is blocked at level 1. In F2, 7 is bad again, and this time the solver finds a predecessor in F1, the state 6: a proof obligation at level 1. The state 6 has no predecessor among the initial states (5 wraps round to 0), so it is blocked; then 7 is blocked at level 2. When F3 opens, the clause ¬(n == 6) propagates: no state of F1 steps into 6. F1 is left with nothing of its own, so F1 = F2, and the invariant is `n != 7 && n != 6`. Every unreachable state, and nothing else, has been ruled out.

## Peterson, again

Now the system from chapter 23, with only its mutual exclusion invariant. It has 200 states that its variables can describe (four labels and *done* for each process, two flags and `turn`), of which 20 are reachable. Watch the frames close in on the reachable states, and the bad states (both processes in the critical section) fall outside every frame.

:::ic3-stepper{title="IC3 on Peterson's algorithm"}
```vouch
system Peterson {
  type Proc = 0..2
  var flag: Proc -> bool = false
  var turn: Proc = 0

  process P(me: Proc) {
    loop {
      want: flag[me] = true
      yield: turn = 1 - me
      wait: await !flag[1 - me] || turn == me
      critical: flag[me] = false
    }
  }

  invariant mutex: !(P(0) at critical && P(1) at critical)
}
```
:::

Compare IC3's invariant with the four facts of chapter 23. IC3 found the same ideas, in smaller pieces: `!(!flag[0] && P(0) at wait)` is half of "the flag is raised past `want`", and `!(turn == 1 && P(0) at critical && P(1) at wait)` is the fact about `turn`. Its clauses are not chosen for being readable, and some are implied by others. They need not be: the clauses together are inductive, and the certificate checks exactly that.

```quiz
q: 'At some event, a clause of F1 propagates to F2. What has the solver just shown?'
options:
  - text: The clause holds in every reachable state.
    why: 'Not yet. It has shown that the clause holds in F2, which still over-approximates the states reachable in two steps.'
  - text: No state of F1 has a step to a state that violates the clause.
    correct: true
    why: 'That is the propagation query, F1 ∧ T ∧ ¬c′, found unsatisfiable. So the clause holds in every state reachable from F1 in one step, which is what F2 requires.'
  - text: The clause is inductive on its own.
    why: 'It is inductive relative to F1, which may contain other clauses it depends on. Relative induction is weaker, and that is what makes IC3 work.'
```

```quiz
q: 'IC3 blocks a cube at level 3 and generalises it by dropping literals. Why must the smaller cube still contain no initial state?'
options:
  - text: Otherwise the solver would run out of time.
    why: 'Time is not the issue. Soundness is.'
  - text: Every frame must contain the initial states; a clause excluding an initial state would break F0 ⊆ F1 ⊆ … and could cut reachable states out of the invariant.
    correct: true
    why: 'The frames must over-approximate what is reachable. Dropping literals makes the cube bigger, and a cube that reached an initial state would exclude a state that is certainly reachable.'
  - text: The property would no longer hold in F3.
    why: 'Blocking more states can only help the property. The danger is blocking states that are reachable.'
```

## When the property is false

IC3 finds counterexamples too. Here is Hyman's algorithm from chapter 2, which lets both processes into the critical section. Step to the end: the chain of proof obligations reaches an initial state, and the chain, read from the initial state forward, is a run of the system that ends with both processes in the critical section. The interpreter replays it.

:::ic3-stepper{title="IC3 on Hyman's algorithm"}
```vouch
system Hyman {
  type Proc = 0..2
  var flag: Proc -> bool = false
  var turn: Proc = 0

  process P(me: Proc) {
    loop {
      want: flag[me] = true
      check: if turn != me {
        spin: await !flag[1 - me]
        take: turn = me
      }
      critical: flag[me] = false
    }
  }

  invariant mutex: !(P(0) at critical && P(1) at critical)
}
```
:::

## The invariant is the certificate

A model checker that visits every state, or a BDD that represents them all, has no short evidence to show for its answer: the evidence is the whole computation. IC3's answer is a formula. Anyone can check it with three SAT queries, without trusting IC3:

1. **initiation**: I ∧ ¬Inv is unsatisfiable;
2. **consecution**: Inv ∧ T ∧ ¬Inv′ is unsatisfiable;
3. **implication**: Inv ∧ ¬P is unsatisfiable.

The course runs the three queries again on a fresh solver, with proof logging, and the DRAT checker of chapter 8 checks the proofs. A bug in the IC3 implementation (a wrong generalisation, a clause pushed too far) cannot produce a false *verified*: at worst, the certificate is rejected.

:::history
**IC3 in hardware verification.** Bradley's implementation of IC3 placed third in the hardware model checking competition held with CAV in 2010, behind two mature verification systems that combined several engines, and his paper presented the algorithm in 2011.:cite[bradley2011] Eén, Mishchenko and Brayton reimplemented it under the name PDR and studied which of its parts matter for performance.:cite[een2011]
:::

:::hood
**The course's IC3.** `src/lib/fv/ic3/ic3.ts` uses one incremental SAT solver for every query. Each frame's clauses are added with an activation literal, so that "Fi" is a set of assumptions (the activation literals of levels i and above), and the transition relation, the initial states and the negated property are switched on the same way. Cubes have one literal per group of the state's encoding (the true value of a one-hot variable, or a Boolean with its polarity). Generalisation uses the solver's failed assumptions as the unsatisfiable core, then tries to drop each literal. A new clause removes the weaker clauses it subsumes. The stepper's dots are every model of the encoding's domain constraints, enumerated by SAT; their frame is computed from the clauses at each event.
:::

:::proved
**What did we prove?** For the counter and Peterson's model, the property holds in every reachable state, and the certificate is a formula anyone can re-check. For Hyman's model, a replayed run shows the property false. As in chapter 23, the proofs rest on the SAT encoding of the models, and transitions that would fail a run-time check are left to the explorer.
:::

## What comes next

Every system so far had a fixed size: two processes, three shards, six cells. [Chapter 25](/chapters/for-every-n/) asks for proofs that hold for every number of processes at once, where no state space can be enumerated and no SAT encoding is finite.

## Further reading

- Bradley's paper introduces IC3.:cite[bradley2011]
- Eén, Mishchenko and Brayton's paper describes PDR and its implementation.:cite[een2011]
