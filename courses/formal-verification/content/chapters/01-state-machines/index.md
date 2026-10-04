---
number: 1
title: State machines
summary: Systems as a state and the steps that change it. Write a model, let the explorer visit every reachable state, and read the counterexample when an invariant fails. The Die Hard jugs, a lock that expires, and a sliding puzzle with an unreachable half.
duration: About 1 hour 15 minutes
---

In the 1995 film *Die Hard with a Vengeance*, the villain leaves a bomb by a fountain with two empty jugs, one of 3 gallons and one of 5. The bomb goes off unless someone puts exactly 4 gallons on a scale. The heroes have a few minutes, a tap, and no measuring marks.

You can solve it with a pencil. Here is another way, which will become the main idea of this part of the course: describe the puzzle as a *system*, a state and the steps that change it, and claim that the big jug **never** holds 4 gallons. Then ask a machine to check the claim in every state the system can reach. If the claim were true, the bomb could not be defused. The machine finds that it is false, and the evidence it prints, the sequence of steps that leads to 4 gallons, is the solution.

This chapter is about that kind of machine, the **explicit-state model checker**, and the kind of model it checks.

## A system is a state and its steps

Here is the puzzle in Vouch.

```vouch title="die-hard.vouch"
system DieHard {
  var small: 0..=3 = 0
  var big: 0..=5 = 0

  action fill_small { small = 3 }
  action fill_big { big = 5 }
  action empty_small { small = 0 }
  action empty_big { big = 0 }
  action small_to_big {
    let pour = min(small, 5 - big)
    small, big = small - pour, big + pour
  }
  action big_to_small {
    let pour = min(big, 3 - small)
    small, big = small + pour, big - pour
  }

  invariant not_four: big != 4
}
```

A `system` has three kinds of member.

- **State variables** (`var`), each with a type and an initial value. The type `0..=3` is the integers from 0 to 3 inclusive; `0..3` would exclude the 3. Small, finite types matter here: they are what makes the number of states finite. The **state** of the system is the value of every state variable, here a pair such as `small = 1, big = 5`.
- **Actions**, each a step the system can take. An action reads the current state and writes the next one. Its body runs as one indivisible step: nothing else happens in between. `small, big = small - pour, big + pour` assigns both variables at once, from the old values.
- **Invariants**, each a condition that is claimed to hold in every state the system can reach.

There is no `main` and no order. In any state, *any* action may be the next step. A system is **nondeterministic**: it describes all the things that could happen, not one thing that does. That is the point. The tap does not choose which jug to fill next; whoever stands at the fountain does, and the model has to cover every choice.

:::programmer
A system is a state machine where every transition is allowed unless something forbids it. If you have written a reducer (`(state, event) → state`) for a user interface, you have written most of a system: the actions are the event handlers, and the explorer plays every possible sequence of events against them.
:::

An action can be **guarded**: `action release when held { … }` can only be taken in states where `held` is true. An action can also take **parameters**: `action acquire(c: 1..3)` is really two actions, `acquire(c = 1)` and `acquire(c = 2)`, one for each value of the parameter. The jug puzzle needs neither, because every action is always possible. Pouring into a full jug pours nothing.

## The state graph

Draw every state the system can reach as a dot, and every step as an arrow. Start at the initial state, `small = 0, big = 0`. From there, `fill_small` leads to `(3, 0)`, `fill_big` to `(0, 5)`, and the four others lead back to `(0, 0)` itself. Follow every arrow from every new dot until no new dots appear. What you have is the **state graph**, and the dots are the **reachable states**.

Checking an invariant is now simple to state: is there a reachable state where it is false? If there is, a path from the initial state to it is a **counterexample**: a run of the system, step by step, that ends in a bad state.

```predict
q: 'The two jugs could in principle hold 4 × 6 = 24 combinations of whole gallons. How many of them are reachable from (0, 0) by filling, emptying and pouring?'
options:
  - text: All 24.
    why: 'Pouring always fills one jug or empties the other, so states such as (1, 1), where both jugs are partly full, cannot be reached.'
  - text: About half.
    correct: true
    why: 'After every step at least one jug is full or empty. The 16 reachable states are exactly those combinations; states like (1, 2) are unreachable.'
  - text: Only the 8 with a full or an empty jug.
    why: 'There are 16 combinations with at least one jug full or empty, and every one of them is reachable.'
```

The widget below is the **state-space explorer**. The model is on the left; on the right, the explorer draws the reachable states, one column per number of steps from the start. Select a state to see its values and the actions enabled in it, and walk the graph by hand by choosing actions. Or let the explorer visit the states one at a time, in the order described in the next section.

:::state-space{title="The Die Hard jugs"}
```vouch
system DieHard {
  var small: 0..=3 = 0
  var big: 0..=5 = 0

  action fill_small { small = 3 }
  action fill_big { big = 5 }
  action empty_small { small = 0 }
  action empty_big { big = 0 }
  action small_to_big {
    let pour = min(small, 5 - big)
    small, big = small - pour, big + pour
  }
  action big_to_small {
    let pour = min(big, 3 - small)
    small, big = small + pour, big - pour
  }

  invariant not_four: big != 4
}
```
Try to reach 4 gallons by hand first: select a state, then choose an enabled action. Then press *Run BFS to the end*. The red state breaks `not_four`, and the highlighted path, replayed in the table below, is a shortest solution to the puzzle.
:::

The explorer's answer is a six-step solution: fill the big jug, pour it into the small one (leaving 2), empty the small one, pour the 2 gallons into it, fill the big jug again and top up the small one, which takes exactly 1 gallon and leaves 4. There are other solutions, but none shorter, and the next section says why the explorer is sure.

:::note
The model checker was asked to prove `big != 4` and refused, with a counterexample. Using a verifier to solve a puzzle this way, by claiming that the goal is unreachable and reading the counterexample, is a standard trick, and the jugs are a favourite first example for model checkers.
:::

## Breadth-first search

The explorer visits states in **breadth-first** order. It keeps a queue of states that it has found but not yet *expanded*, and a set of every state it has seen.

1. Put the initial states in the queue and in the set.
2. Take the oldest state from the queue. For each enabled action, compute the next state. If the next state is new, check every invariant in it, add it to the set, and add it to the back of the queue.
3. Repeat until the queue is empty: then every reachable state has been visited.

Because the queue is first in, first out, the states are visited in order of their distance from the start: all states one step away, then all states two steps away, and so on. So the first bad state found is a closest one, and the path to it, recovered by remembering which state each one was found from, is a **shortest counterexample**. Shortest counterexamples are much easier to read than long ones, which is why explicit-state checkers use breadth-first search when they can.

```quiz
q: 'In the jug model, the explorer has just expanded the initial state (0, 0) and found (3, 0) and (0, 5), in that order. Which state does it expand next, and which new states does that produce?'
options:
  - text: '(0, 5): it was found last, so it is on top of the stack.'
    why: 'That is depth-first search, which uses a stack. Breadth-first search uses a queue: oldest first.'
  - text: '(3, 0), which produces (3, 5) and (0, 3).'
    correct: true
    why: '(3, 0) was found first, so it is expanded first. From it, `fill_big` gives (3, 5) and `small_to_big` gives (0, 3); the other actions lead back to states already seen.'
  - text: '(3, 0), which produces (0, 0), (3, 5) and (0, 3).'
    why: '(0, 0) is already in the set of seen states, so it is not added again. That check is what makes the search finish.'
```

The set of seen states is what makes the search terminate: a state is expanded at most once, so the work is proportional to the number of reachable states times the number of actions. It is also what costs memory. A real model checker stores millions or billions of states, and much of its engineering goes into storing them compactly. The explorer in this course stores each state as a string key in a hash set, which is simple and fine up to a few hundred thousand states.

When the queue empties without a bad state, the explorer has visited every reachable state, and the invariant holds in all of them. That is a proof, but a proof about this model only. The badge says so: *all 16 states of system DieHard*.

## Invariants of a protocol: a lock with a lease

Puzzles are a good way to learn the explorer, but its real use is on systems whose bad states are not wanted. Here is a small one, adapted from a common design for distributed locks.

A lock service hands a lock to one client at a time. Clients can crash while holding the lock, so a lock is granted as a **lease**: it expires after a fixed time, and the service can then give it to someone else. A client that holds the lock uses a shared resource, and stops when it has finished.

```vouch title="lease.vouch"
system Lease {
  var owner: 0..3 = 0          // 0 when the lock is free, otherwise the client that holds it
  var clock: 0..=3 = 0         // time since the lock was granted
  var uses1: bool = false      // client 1 is using the resource
  var uses2: bool = false

  action acquire(c: 1..3) when owner == 0 {
    owner = c
    clock = 0
    if c == 1 { uses1 = true } else { uses2 = true }
  }
  action tick when owner != 0 && clock < 3 { clock = clock + 1 }
  action expire when owner != 0 && clock == 3 { owner = 0 }
  action done(c: 1..3) when (c == 1 && uses1) || (c == 2 && uses2) {
    if c == 1 { uses1 = false } else { uses2 = false }
    if owner == c { owner = 0 }
  }

  invariant one_at_a_time: !(uses1 && uses2)
}
```

The invariant says what the lock is for: the two clients never use the resource at the same time. Does it hold?

:::state-space{title="A lock with a lease"}
```vouch
system Lease {
  var owner: 0..3 = 0
  var clock: 0..=3 = 0
  var uses1: bool = false
  var uses2: bool = false

  action acquire(c: 1..3) when owner == 0 {
    owner = c
    clock = 0
    if c == 1 { uses1 = true } else { uses2 = true }
  }
  action tick when owner != 0 && clock < 3 { clock = clock + 1 }
  action expire when owner != 0 && clock == 3 { owner = 0 }
  action done(c: 1..3) when (c == 1 && uses1) || (c == 2 && uses2) {
    if c == 1 { uses1 = false } else { uses2 = false }
    if owner == c { owner = 0 }
  }

  invariant one_at_a_time: !(uses1 && uses2)
}
```
Run the search. The counterexample is six steps long: client 1 takes the lock and is slow, the lease expires, and client 2 takes the lock while client 1 is still using the resource.
:::

This bug is not hypothetical. It happens in real systems whenever a client pauses for longer than its lease: a garbage-collection pause, a swapped-out process, a network delay. The usual fix is for the client to know when its own lease ends and to stop before then (or for the resource to reject stale clients, using a number that increases with each grant). In the model, the simplest version of the first fix is that expiry also ends the client's use:

```vouch
action expire when owner != 0 && clock == 3 {
  owner = 0
  uses1 = false
  uses2 = false
}
```

That assumes the client and the service agree on the time, which is itself something to check in a more detailed model.

```model
id: state-machines/lease-invariant
title: Say what the lock is for
prompt: |
  Write the invariant of the lease lock: the property that the lock is supposed to guarantee. Your line replaces `@model` in two versions of the system. It must **fail** on the original lease (above) and **hold** on the version where expiry also stops the client. An invariant that is true of every state, such as `true`, holds on both, and so does not catch the bug.
starter: |
  invariant safe: true
cases:
  - name: The lease from the text
    expect: fails
    why: The explorer finds the six-step counterexample.
    code: |
      system Lease {
        var owner: 0..3 = 0
        var clock: 0..=3 = 0
        var uses1: bool = false
        var uses2: bool = false
        action acquire(c: 1..3) when owner == 0 {
          owner = c
          clock = 0
          if c == 1 { uses1 = true } else { uses2 = true }
        }
        action tick when owner != 0 && clock < 3 { clock = clock + 1 }
        action expire when owner != 0 && clock == 3 { owner = 0 }
        action done(c: 1..3) when (c == 1 && uses1) || (c == 2 && uses2) {
          if c == 1 { uses1 = false } else { uses2 = false }
          if owner == c { owner = 0 }
        }
        @model
      }
  - name: Expiry stops the client
    expect: holds
    why: Every reachable state has at most one client using the resource.
    code: |
      system Lease {
        var owner: 0..3 = 0
        var clock: 0..=3 = 0
        var uses1: bool = false
        var uses2: bool = false
        action acquire(c: 1..3) when owner == 0 {
          owner = c
          clock = 0
          if c == 1 { uses1 = true } else { uses2 = true }
        }
        action tick when owner != 0 && clock < 3 { clock = clock + 1 }
        action expire when owner != 0 && clock == 3 {
          owner = 0
          uses1 = false
          uses2 = false
        }
        action done(c: 1..3) when (c == 1 && uses1) || (c == 2 && uses2) {
          if c == 1 { uses1 = false } else { uses2 = false }
          if owner == c { owner = 0 }
        }
        @model
      }
solution: |
  invariant safe: !(uses1 && uses2)
hints:
  - The lock is meant to stop two clients from using the resource at once. Which variables say that a client is using it?
  - '`!(uses1 && uses2)`, or equivalently `!uses1 || !uses2`.'
lines: 3
```

Notice what the exercise checks: not that your invariant holds, but that it tells the two systems apart. An invariant that holds everywhere is useless as a specification, and a stronger claim than necessary, such as "the lock is always free", fails on the correct system too. Testing a specification against systems you know to be right and wrong is a habit the course will keep coming back to.

## Half of a puzzle is out of reach

The explorer is just as useful when the invariant *holds*, because then the state count is information too. Take the sliding-block puzzle that became a craze in 1880, the 15 puzzle, scaled down to two rows of three squares: five numbered tiles and a gap. A move slides a tile next to the gap into it.

:::state-space{title="A 2 × 3 sliding puzzle"}
```vouch
system Slide {
  var board: [0..6] = [1, 2, 3, 5, 4, 0]
  var blank: 0..6 = 5

  action move(to: 0..6)
    when (to == blank - 1 && blank % 3 != 0) || (to == blank + 1 && blank % 3 != 2) || to == blank - 3 || to == blank + 3
  {
    board[blank] = board[to]
    board[to] = 0
    blank = to
  }

  invariant unsolved: board != [1, 2, 3, 4, 5, 0]
}
```
The board is a sequence of six squares, read left to right and top to bottom, with 0 for the gap. It starts with tiles 4 and 5 swapped. Run the search: the invariant holds, so the solved position is never reached, and the explorer visits 360 states.
:::

There are 6! = 720 ways to place five tiles and a gap on six squares. The explorer reaches exactly half of them, whatever the starting position. The reason is a quantity that no move can change: a **parity** computed from the order of the tiles and the position of the gap. Swapping two tiles changes the parity, and a legal move never does, so the positions split into two halves that cannot reach each other. The explorer *observes* that only half the states are reachable; it does not explain why. Proving it for every size of board needs an argument that does not enumerate, an inductive invariant, and Chapter 23 proves this one.

:::bridge{course=proofs chapter=invariants}
Proofcraft's chapter on invariants proves the parity argument for the 15-puzzle by hand, along with other puzzles that are settled by a quantity no move can change.
:::

## Under the hood: what the explorer does with Vouch

The explorer does not work on the text of the model. Vouch's type checker resolves every name and type; then the reference interpreter, the same one that runs programs in Part IV, provides two operations: the **initial states**, and the **successors** of a state, each labelled with the action and parameters that produced it. Everything the explorer knows about the system comes through those two functions, which is what lets the same search run on any model.

Each state is stored as a key, a string that encodes the values of all the variables, in a hash set. When an invariant fails, the explorer has the chain of parents back to an initial state. Before it reports the counterexample, it **replays** it: it starts again from the initial state and asks the interpreter for each step's successor, checking that the step leads to the next state of the trace. A bug in the explorer's bookkeeping could produce a path that is not a real run; a replayed trace is a real run. That is why the badge says *counterexample replayed*.

When the invariant holds, there is no such short certificate. The evidence is the whole search: if the explorer had a bug that skipped some states, the result would be wrong, and nothing small would show it. The badge says what was established, *all 360 states of system Slide*, and the *Engine* line names the explorer as the thing you are trusting. Chapter 11 shows how to turn a set of reachable states into a certificate that a solver can check, and Chapter 23 how to replace the search by an invariant that can be checked one step at a time.

:::hood
**When the algorithm appeared.** Breadth-first search over a graph is older than computers. The first model checkers (Clarke and Emerson's in 1981, Queille and Sifakis's CESAR in 1982) explored state graphs to check temporal properties, the subject of Chapter 3.:cite[clarke1981,queille1982] What changed afterwards was scale. SPIN and TLC store states compactly, use disk and many processors, and reduce the number of states that need storing (Chapter 2).
:::

::bio-card{id=clarke-emerson-sifakis}

## How big is a state space?

The jugs have 16 reachable states, the lease 29, the puzzle 360. Real models are larger, and the number of states grows *multiplicatively*. Each variable multiplies the count by the number of values it can take; each process multiplies it again. A model with ten variables of ten values each has up to 10¹⁰ states. That is still within the reach of a disk-backed model checker, but each further variable multiplies it by ten.

This is the **state explosion problem**, and it is the subject of the rest of Part I and much of Parts II and V. Part I fights it with small models: three processes instead of thirty, a lease of three ticks instead of thirty seconds. The course's badges always name the instance (*all 29 states of system Lease*), so that you never mistake a result about the small model for a result about the system.

:::industry
**Model checking at Bell Labs and at Amazon.** Gerard Holzmann's SPIN was built to check telephone-switching protocols at Bell Labs, and its models were written by the engineers who wrote the switches.:cite[holzmann1997] Three decades later, engineers at Amazon Web Services used TLA+ and its explicit-state checker TLC on the designs of DynamoDB, S3 and other services, and found serious bugs that design reviews, code reviews and testing had missed. The shortest trace exhibiting one bug in DynamoDB was 35 steps long.:cite[newcombe2015] In both cases the models were small, much smaller than the systems, and that was enough: most design bugs show up with two or three clients.
:::

:::proved
**What did we prove?** For the jugs: that 4 gallons *can* be measured, with a replayed six-step trace as the certificate. For the puzzle: that from the swapped position, the solved position cannot be reached, by visiting all 360 reachable states. The second result trusts the explorer's search (no certificate is re-checked) and is about this model only: one board size, one starting position. For the lease: a replayed trace, so the bug is real *in the model*. Whether the real lock service has it depends on whether the model's assumptions (one shared clock, three ticks to a lease) describe it.
:::

## What comes next

The systems in this chapter take one step at a time and the steps are whole actions. Real concurrent programs are made of threads whose small steps interleave in any order. [Chapter 2](/chapters/interleavings/) models threads, finds a famous wrong algorithm for mutual exclusion, and counts how fast the states multiply.

## Further reading

- Clarke and Emerson's paper and Queille and Sifakis's paper are where model checking began; both are short and readable.:cite[clarke1981,queille1982]
- Holzmann's article on SPIN describes the engineering of a production explicit-state model checker.:cite[holzmann1997]
- Newcombe and colleagues' report from Amazon is the best short account of why engineers adopt model checking.:cite[newcombe2015]
