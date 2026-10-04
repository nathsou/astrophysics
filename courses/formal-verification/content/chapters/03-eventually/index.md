---
number: 3
title: Eventually
summary: Safety says nothing bad happens; liveness says something good eventually does. Temporal logic for properties of infinite runs, counterexamples shaped like lassos, and fairness, the assumption that keeps the scheduler from starving a process forever.
duration: About 1 hour 30 minutes
---

On 4 July 1997 the Mars Pathfinder landed on Mars. A few days later its computer began resetting itself, losing data each time. Engineers at the Jet Propulsion Laboratory reproduced the problem on a replica of the spacecraft with tracing turned on, and found the cause. A high-priority task that managed the spacecraft's information bus needed a lock held by a low-priority task that gathered weather data. A medium-priority communications task, which needed neither, kept preempting the low-priority task, so the lock was never released, the bus task never ran, and a watchdog timer concluded that something had gone badly wrong and reset the computer. The fix was a switch in the real-time operating system, *priority inheritance*, turned on by a short program uploaded to the spacecraft.:cite[jones1997]

::museum{exhibit=pathfinder-1997}

Nothing bad ever *happened* on Pathfinder in the sense of Chapter 2. No two tasks were in a critical section together; no invariant failed. What went wrong was that something good, the bus task getting its turn, never happened. No invariant can say that, because an invariant is a property of single states, and "never happens" is a property of whole runs. This chapter is about properties of runs, the logic for writing them, and the counterexamples that refute them.

## Safety and liveness

In 1977 Leslie Lamport drew the line that this chapter is built on.:cite[lamport1977]

- A **safety property** says that *something bad never happens*: two processes are never in the critical section together; the balance is never negative. If a safety property fails, it fails at some point, and a finite prefix of the run shows it: the counterexamples of Chapters 1 and 2 were finite traces ending in a bad state.
- A **liveness property** says that *something good eventually happens*: a process that wants to enter the critical section eventually does; every request is eventually answered. No finite prefix can refute a liveness property, because the good thing might still happen later. A counterexample has to be an *infinite* run in which it never does.

Bowen Alpern and Fred Schneider later made the two notions precise, and proved that every property of runs is the conjunction of a safety property and a liveness property.:cite[alpern1985] The two halves need different tools. Invariants handle safety. For liveness we need a language for "eventually", and a way to find infinite counterexamples with a finite search.

```quiz
q: 'Which of these is a liveness property?'
options:
  - text: The account balance is never negative.
    why: 'Safety: a run that violates it has a first state with a negative balance, and the prefix up to that state already shows the violation.'
  - text: Every message sent is eventually delivered.
    correct: true
    why: 'Liveness: no finite prefix refutes it, because an undelivered message might still be delivered later. Only an infinite run in which it never arrives is a counterexample.'
  - text: A message is never delivered before it is sent.
    why: 'Safety: a violation is a delivery with no earlier send, visible at the moment of delivery.'
  - text: Every message is delivered within 5 seconds.
    why: 'This is a safety property in disguise. A violation happens at a definite moment, 5 seconds after the send, and a finite prefix shows it. Deadlines turn liveness into safety.'
```

## Temporal logic

Amir Pnueli's 1977 proposal was to state properties of runs in a **temporal logic**: ordinary logic plus operators that talk about the future of a run.:cite[pnueli1977] A run is an infinite sequence of states. A formula holds of a run *from a position*, and holds of the run when it holds from position 0. The operators of **linear temporal logic** (LTL), in Vouch's spelling, are:

| Formula | Holds from position *i* when… |
|---|---|
| `p` (a condition on states) | `p` is true in state *i* |
| `next φ` | φ holds from position *i* + 1 |
| `always φ` | φ holds from every position *j* ≥ *i* |
| `eventually φ` | φ holds from some position *j* ≥ *i* |
| `φ until ψ` | ψ holds from some *j* ≥ *i*, and φ holds from every position from *i* to *j* − 1 |
| `φ ~> ψ` (leads to) | `always (φ ==> eventually ψ)`: every φ is followed, sooner or later, by a ψ |

The operators combine. `always eventually p` says that `p` is true infinitely often: however far you go, there is a `p` later. `eventually always p` says that from some point on, `p` stays true for ever. The mutual exclusion invariant of Chapter 2 is the LTL formula `always !(P(0) at critical && P(1) at critical)`, so invariants are a special case.

## Lassos

How can a finite program evaluate a formula on an infinite run? It cannot, on an arbitrary infinite run. But a system with finitely many states, run forever, must eventually revisit a state, and if a property fails on some run, it fails on a run of a special shape: a **lasso**, a finite prefix followed by a cycle repeated for ever.:cite[vardi1986] A lasso is finite to write down, and every LTL formula can be evaluated on it.

The **trace lab** below is a lasso over two propositions, `p` and `q`. Click a cell to make a proposition true or false at that position, and choose where the loop returns. Each formula's row shows, for every position, whether it holds of the run from that position; the first column is its value for the whole run.

::trace-lab{caption="The trace lab. The trace is the positions shown, then the loop repeated forever (shaded). Select a formula to see its automaton below; add your own."}

```predict
q: 'Set the trace to: position 0 has p, position 1 has q, and the loop returns to 0, so the run alternates p, q, p, q, … forever. Which of `always eventually q` and `eventually always q` holds?'
options:
  - text: Both.
    why: '`eventually always q` needs a point after which q never stops. In the alternating run q is false at every other position, forever.'
  - text: Only `always eventually q`.
    correct: true
    why: 'q comes back every other step, so it holds infinitely often. It never holds continuously from some point on. Try it in the lab: the two formulas differ exactly on runs like this one.'
  - text: Only `eventually always q`.
    why: '`eventually always q` is the stronger of the two: from some point on, q at every position. The alternating run is not like that.'
```

Evaluating a formula on a lasso works from the inside out, one subformula at a time, with one value per position. `always φ` at position *i* needs φ at every position the run will ever visit from *i*: the rest of the prefix and the whole cycle. `eventually φ` needs φ at one of them. That is why the per-position rows in the lab are consistent with each other: every position inside the loop sees the same future, up to rotation.

```ltl
id: eventually/request-grant
title: Every request is answered
prompt: |
  A server receives requests and grants them. Write the requirement **every request is eventually followed by a grant** in LTL, using the propositions `req` and `grant`. Your formula is checked against a bank of lasso traces, each marked with whether the requirement holds on it.
props: [req, grant]
starter: eventually grant
traces:
  - { states: [[req], [], [grant]], loop: 0, holds: true }
  - { states: [[req], [grant], []], loop: 2, holds: true, why: 'After the grant at position 1 there are no more requests, so nothing is owed.' }
  - { states: [[grant], [req], []], loop: 1, holds: false, why: 'The request at position 1 is never followed by a grant: a grant before the request does not count.' }
  - { states: [[], []], loop: 0, holds: true, why: 'With no requests at all, the requirement is satisfied vacuously.' }
  - { states: [[req, grant], [req], []], loop: 1, holds: false, why: 'The request at position 1 waits for ever.' }
  - { states: [[req], [grant], [req], [grant]], loop: 2, holds: true }
solution: req ~> grant
hints:
  - '`eventually grant` only asks for one grant, anywhere. A grant before the first request satisfies it.'
  - 'It must hold after *every* request: `always (req ==> …)`.'
  - '`always (req ==> eventually grant)`, which Vouch also writes `req ~> grant`.'
success: '`req ~> grant` is one of the most common liveness requirements. It says nothing about how soon; that would be a safety property with a deadline.'
```

## Liveness in a system

Peterson's algorithm promises more than mutual exclusion: a process that is waiting to enter eventually does. In Vouch:

```vouch
property progress: forall p: Proc :: always (P(p) at wait ==> eventually P(p) at critical)
```

The checker's question is: is there an infinite run of the system on which some process waits and never enters? Here is the model. Check it with and without the line `fairness weak P` taken into account.

:::liveness{title="Peterson's algorithm, progress"}
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

  property progress: forall p: Proc :: always (P(p) at wait ==> eventually P(p) at critical)
  fairness weak P
}
```
Without fairness, the checker finds a lasso in which a process reaches `wait` and then is simply never scheduled again. With weak fairness, that run is excluded, and the property holds.
:::

The counterexample without fairness is legitimate, and slightly disappointing. Process 0 reaches `wait`, and from then on the scheduler never runs it again: either process 1 runs forever, or nothing runs at all (the system *stutters*, taking steps that change nothing, the way TLA+ models a system that simply pauses). Process 0 never enters, but not because of the algorithm: because nobody let it move.

## Fairness

A **fairness** assumption rules out runs in which the scheduler neglects a process for ever. It comes in two strengths.

- **Weak fairness** of a process: if, from some point on, the process can *continuously* take a step, then it eventually does. A process that is ready to run and stays ready cannot be ignored for ever.
- **Strong fairness**: if the process can take a step *infinitely often* (even if it is also blocked infinitely often), then it eventually does.

Real schedulers are usually weakly fair: a runnable thread gets the processor eventually. Strong fairness is a stronger promise, the kind a lock with a fair queue makes.

The difference matters when a process's step is enabled only intermittently. Here a greedy process grabs a shared resource, releases it, and grabs it again, in a loop. A polite process waits for the resource to be available. The polite process's step is enabled only in the moments between the greedy one's release and its next grab.

:::liveness{title="A greedy process and a polite one"}
```vouch
system Spin {
  var available: bool = true

  process Greedy() {
    loop {
      take: await available
        available = false
      give: available = true
    }
  }
  process Polite() {
    loop {
      want: await available
        available = false
      use: available = true
    }
  }

  property polite_gets_in: always eventually Polite() at use
  fairness weak Greedy, Polite
}
```
With weak fairness the property fails: the cycle *take, give, take, give…* is weakly fair to the polite process, because it is not *continuously* able to move. Edit the last line to `fairness strong Greedy, Polite` and check again.
:::

```predict
q: 'Under strong fairness, the polite process gets in. What does that guarantee about a real lock?'
options:
  - text: That a real lock with this code will never starve the polite thread.
    why: 'Only if the real scheduler and lock are strongly fair, which most locks are not: a spinlock gives no such promise, and a thread that is woken just after the resource has been taken again can lose every race.'
  - text: That the algorithm is correct under the assumption that the scheduler is strongly fair.
    correct: true
    why: 'Fairness is an assumption about the environment, and the result depends on it. The badge lists it among the assumptions. Whether your platform provides it is a separate question.'
  - text: Nothing, because fairness assumptions make every property true.
    why: 'Fairness excludes only runs that neglect an enabled process for ever. A property can still fail on a fair run, and the checker would show you that run.'
```

Fairness is an **assumption**, and the badges list it. A liveness result proved under weak fairness says: *if* the scheduler is weakly fair, the property holds. That is the honest statement, and choosing which fairness to assume is part of modelling. Pathfinder's scheduler was a strict priority scheduler. It was not fair to the low-priority task at all, which is why priority inversion could starve the bus task behind it.

## Under the hood: automata

The course's liveness checker follows the *automata-theoretic* approach of Vardi and Wolper.:cite[vardi1986]

1. **Negate the property.** A counterexample is a run that satisfies `!φ`.
2. **Translate `!φ` into a Büchi automaton.** A Büchi automaton reads an infinite sequence of states and accepts it if its run passes through accepting states infinitely often. Every LTL formula has one, built by a tableau construction that splits each formula into what must hold now and what must hold next (the course uses the construction of Gerth, Peled, Vardi and Wolper).:cite[gerth1995] The trace lab shows the automaton of the selected formula.
3. **Build the product** of the system and the automaton: pairs (system state, automaton state), where the system takes a step and the automaton reads the new state.
4. **Search the product for an accepting cycle** reachable from the start. The course finds the strongly connected components of the product with Tarjan's algorithm and looks for a component that contains accepting states and, when fairness is on, satisfies every fairness condition.:cite[tarjan1972] SPIN uses *nested depth-first search* instead, which needs less memory.:cite[courcoubetis1992]
5. **Extract the lasso**: a path to the component and a cycle inside it.

Before showing the lasso, the course *certifies* it: it replays the steps through the interpreter, evaluates the original formula on the lasso with the same position-by-position evaluation as the trace lab, and checks that the cycle is fair. A bug in the automaton construction or the product could produce a run that is not a counterexample; a certified lasso is one.

:::hood
**Stuttering.** Every state of the system also has a *stuttering* step to itself: the system may pause. This follows TLA+, where systems are allowed to take steps that change nothing, so that a more detailed model can refine a more abstract one (Chapter 4). Its consequence is that, without fairness, almost no liveness property holds: the system can always stop. Fairness is what rules out stopping for ever while something can still move.
:::

## Branching time, briefly

LTL describes runs one at a time: a property holds of the system if it holds of *every* run. The first model checkers used a different logic, **CTL** (computation tree logic), which can also talk about the *possibility* of futures.:cite[clarke1981] In CTL, `EF p` says "there is a run on which `p` eventually holds", and `AG EF reset` says "from every reachable state, it is always possible to get back to a reset state". No LTL formula can say the second, and some LTL formulas (such as `eventually always p`) have no CTL equivalent.

The two logics coexist. CTL model checking is a fixpoint computation over the state graph and is efficient, which made it the logic of the early symbolic model checkers (Chapter 11). LTL is closer to how engineers think about requirements on runs, and SPIN and TLA+ use it. The course uses LTL throughout.

:::industry
**Liveness in practice.** Liveness properties, such as "every client request eventually receives a response", are part of most TLA+ specifications of distributed systems, and testing cannot establish them at all, because no test runs forever. In hardware, liveness properties such as "every bus request is eventually granted" are routinely model-checked, usually after turning them into safety properties with a bound ("within 16 cycles"), which is cheaper to check.
:::

:::proved
**What did we prove?** Peterson's progress property, for two processes, assuming weak fairness of both: every reachable state of the product of the system and the property's automaton was explored, and no fair accepting cycle exists. The certificate for *holds* is the search itself, so the result trusts the checker. For *violated*, the certificate is the lasso, replayed and re-evaluated. The polite process gets in under strong fairness, an assumption about the scheduler that real systems often do not provide.
:::

## What comes next

So far the processes have shared memory. [Chapter 4](/chapters/messages-and-failures/) puts them on different machines, connected by a network that can lose, duplicate and reorder their messages, and checks a protocol that the Ledger needs: two-phase commit.

## Further reading

- Lamport's 1977 paper introduces safety and liveness informally; Alpern and Schneider's three pages make them precise.:cite[lamport1977,alpern1985]
- Pnueli's paper is the origin of temporal logic in computer science.:cite[pnueli1977]
- Vardi and Wolper's paper explains why automata are the right tool for LTL model checking.:cite[vardi1986]
- Mike Jones's page relays Glenn Reeves's account of the Pathfinder resets, and is short and vivid.:cite[jones1997]
