---
number: 23
title: Inductive invariants
summary: 'Part I checked a system''s invariants by visiting every reachable state. Induction proves them without visiting anything: show that the invariant holds initially and that every step preserves it. Most true invariants are not inductive as stated. Counterexamples to induction, strengthening, k-induction, and the parity argument behind the 15 puzzle.'
duration: About 1 hour 10 minutes
---

Part I proved that Peterson's algorithm keeps two processes out of their critical sections at the same time by visiting all 20 of its reachable states. That works for 20 states, and for a few million. It does not work for a system whose state space is too big to enumerate, or infinite. Chapter 18 already met the alternative, for loops: find an invariant that holds on entry and is preserved by every iteration, and you have proved it for every iteration without running any. The same idea works for whole systems, and this chapter applies it to the models of Part I.

## From loops to systems

A system has initial states and steps, like a loop with an entry and a body. A condition Inv is an **inductive invariant** when

1. **initiation**: Inv holds in every initial state, and
2. **consecution**: every step from any state satisfying Inv leads to a state satisfying Inv.

Then, by induction on the number of steps, Inv holds in every reachable state. If Inv also implies the property you care about, the property is proved. The two conditions are questions for a SAT solver: with the system encoded as formulas (chapter 10's I(S) and T(S, S′)), initiation asks whether I(S) ∧ ¬Inv(S) is satisfiable, and consecution whether Inv(S) ∧ T(S, S′) ∧ ¬Inv(S′) is. Two unsatisfiable answers make a proof.

The important word in consecution is *any*. The solver does not know which states are reachable; it considers every state that satisfies Inv, reachable or not. That is what makes the proof cheap, and also what makes it fail on true invariants.

## True but not inductive

Here is Peterson's algorithm from chapter 2, with its mutual exclusion invariant and nothing else. The explorer proved it by enumeration. Check it by induction:

:::induction-workshop{title="Peterson's algorithm, by induction" k=1 maxK=20}
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

The base light is green: the initial state satisfies the invariant. The step light is red, and the solver has produced a **counterexample to induction** (a CTI): a state that satisfies the invariant, and a step from it to a state that does not. In the state on the left, P(0) is in its critical section, P(1) is at `wait`, both flags are raised, and `turn` is 1. P(1)'s `await` sees `turn == 1` and enters. Both are in the critical section.

The algorithm is not wrong. That first state is **unreachable**: P(1) set `turn` to 0 in its `yield` step, just before it started to wait, and P(0) could only have entered its critical section afterwards if `turn` was still 0, since P(1)'s flag was raised. `turn` can only become 1 again through P(0)'s own `yield`, which comes before P(0)'s `wait`, not after. Mutual exclusion holds in every reachable state; it is just not inductive, because induction also asks about states nobody can reach.

```quiz
q: 'The induction check reports a counterexample to induction. What does that prove about the invariant?'
options:
  - text: The invariant is false.
    why: 'Only a run from an initial state shows that. A CTI''s first state may be unreachable, as Peterson''s is.'
  - text: Nothing about its truth. The invariant, as stated, cannot be proved by plain induction.
    correct: true
    why: 'The CTI shows that the invariant is not inductive. It may still hold in every reachable state; then it needs strengthening.'
  - text: The system has a bug in the step shown.
    why: 'The step is fine from the states the system can actually reach. The trouble is the starting state.'
```

## Strengthening

The cure is the one from chapter 18: **strengthen** the invariant with facts that rule out the unreachable states, until the conjunction is inductive. Each new fact must itself be true of every reachable state (otherwise the base case fails), and the conjunction must be preserved as a whole. The facts usually come from reading the CTI and asking *why can't this state happen?* The argument two paragraphs up says why: when P(1) is waiting, it set `turn` to 0 itself, and P(0) can only be in its critical section if `turn` is still 0. Written as an invariant: `!(P(0) at critical && P(1) at wait) || turn == 0`.

That one fact is not enough. Check it, and a new CTI appears, now about the flags: both processes are waiting, but neither flag is raised, so P(0) walks into its critical section while `turn` is 1. The flags follow the program counters: `flag[i]` is true exactly when process i is not at `want`. Each answer to *why can't this happen?* becomes an invariant, and the workshop checks the conjunction of them all.

:::induction-workshop{title="Make mutual exclusion inductive" k=1 maxK=1 goal="All the invariants together are inductive: that is a proof of mutual exclusion for every reachable state, and you never enumerated one. The certificate is two unsatisfiable SAT queries, re-checked by the DRAT checker."}
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
  // Add invariants here, one per line, until the step light turns green.
}
```
:::

If you are stuck: four invariants are enough. Two say what the flags mean (`flag[0] == !(P(0) at want)`, and the same for P(1)); two say what `turn` must be when one process is in its critical section and the other waits (the fact above, and its mirror image with the processes swapped).

```quiz
q: 'You add an invariant that holds initially but is false in some reachable state, and check with k = 1. What does the workshop show?'
options:
  - text: The proof goes through, since the other invariants are inductive.
    why: 'Every conjunct must be preserved. Along the run that breaks the new invariant, some step from a state satisfying all of them leads out.'
  - text: The step fails with a CTI. With a larger k, the base search finds the run that breaks the invariant.
    correct: true
    why: 'With k = 1 the base case looks only at the initial states, where the new invariant holds. The step fails. The CTI may even start in a reachable state, and raising k lets the base search reach the run that refutes the invariant. Either way there is no proof, as there should not be.'
  - text: The base light turns red at once.
    why: 'Only if the invariant is false in an initial state. With k = 1, the base case looks no further.'
```

## k-induction

Strengthening by hand is the reliable method, but there is a cheaper trick that sometimes suffices. Plain induction fails on Peterson because one unreachable state satisfying the invariant leads out of it. What about longer stretches? **k-induction**, proposed by Mary Sheeran, Satnam Singh and Gunnar Stålmarck in 2000 for verifying hardware, replaces both conditions::cite[sheeran2000]

1. **base**: no run of fewer than k steps from an initial state breaks the invariant (bounded model checking, chapter 10), and
2. **step**: any k consecutive states satisfying the invariant are followed by a state satisfying it.

A CTI for k-induction must be a path of k states, all satisfying the invariant, that leaves it at the end. The longer the path, the harder it is for unreachable states to provide one. The step also requires the k states to be different from one another: without that, a single unreachable state with a self-loop would defeat every k, and with it the method is complete for finite systems, since no path can repeat a state forever.

Go back to the first workshop and move the slider. With k = 2 the CTI has three states; the solver keeps finding longer and longer unreachable paths into the bad state, until at **k = 17** there are none: Peterson's mutual exclusion invariant, alone, is 17-inductive. That is a proof, with no strengthening. It is also an opaque one. The four invariants above say *why* the algorithm works; "17-inductive" says only that the unreachable part of the state space has no path of 17 states into the bad state.

:::bridge{course=digital-circuits chapter=state-machines}
Sheeran, Singh and Stålmarck designed k-induction for hardware: their experiments verified FPGA cores.:cite[sheeran2000] *Digital Circuits* builds such machines from flip-flops and logic. The invariants of a circuit are facts about its registers, and the registers that a designer can never drive into a bad combination are exactly the unreachable states that defeat plain induction.
:::

## Half the positions of the 15 puzzle

In 1879, William Woolsey Johnson and William Story published a proof that half of the arrangements of the sliding *15 puzzle* cannot be reached from the solved one, however the tiles are slid.:cite[johnson1879] The argument is an invariant, and a parity argument at that. Number the cells row by row, read the tiles in that order ignoring the blank, and count the **inversions**: pairs of tiles where a larger number comes before a smaller one. A horizontal move does not change the reading order. On a board with an odd number of columns, a vertical move carries one tile past an even number of others, which changes the count by an even number. So the parity of the number of inversions never changes. The solved board has none; a board with two tiles swapped has one; no sequence of moves connects them. (On the 15 puzzle's four columns, a vertical move changes the parity, and the invariant must add the row of the blank, which changes with it.)

Below is the same puzzle on a board of 2 rows and 3 columns, with five tiles. The invariant `unswapped` says that the board with tiles 4 and 5 exchanged is never reached. It is true, and nowhere near inductive: half of the 720 arrangements are unreachable,:cite[johnson1879] and they are connected to each other by moves just as the reachable ones are. Two facts about the representation are given (the blank is where `blank` says, and no tile appears twice). Add the parity invariant. The number of inversions is

`sum([#{ j: Cell | j > i && board[j] != 0 && board[i] > board[j] } | i in 0..6])`

that is, for each cell i, the number of later cells holding a smaller tile, added up.

:::induction-workshop{title="An unreachable board" k=1 maxK=12 goal="Proved: no sequence of moves swaps two tiles. The SAT solver needs about a second; the DRAT proof it produced is several thousand lines long, and checking it takes the course's deliberately simple checker much longer, so the certificate is checked in the background."}
```vouch
system Puzzle {
  type Cell = 0..6
  // board[c] is the tile in cell c, numbered row by row (two rows of three); 0 is the blank.
  var board: Cell -> 0..6
  var blank: Cell = 5
  init {
    board[0] = 1
    board[1] = 2
    board[2] = 3
    board[3] = 4
    board[4] = 5
    board[5] = 0
  }

  action up when blank >= 3 {
    board[blank] = board[blank - 3]
    board[blank - 3] = 0
    blank = blank - 3
  }
  action down when blank < 3 {
    board[blank] = board[blank + 3]
    board[blank + 3] = 0
    blank = blank + 3
  }
  action left when blank % 3 != 0 {
    board[blank] = board[blank - 1]
    board[blank - 1] = 0
    blank = blank - 1
  }
  action right when blank % 3 != 2 {
    board[blank] = board[blank + 1]
    board[blank + 1] = 0
    blank = blank + 1
  }

  // Tiles 4 and 5 exchanged, everything else solved.
  invariant unswapped: !(board[0] == 1 && board[1] == 2 && board[2] == 3 && board[3] == 5 && board[4] == 4 && board[5] == 0)
  invariant blank_ok: board[blank] == 0
  invariant distinct: forall i: Cell, j: Cell :: i != j ==> board[i] != board[j]
}
```
:::

Try k-induction first: no k up to 12 proves `unswapped`. The unreachable half of the puzzle is as large and as well connected as the reachable half, so there are paths of every length that stay in it and end on the swapped board. Only an invariant that separates the two halves can prove the claim, and parity is that invariant.

```quiz
q: 'Why do `blank_ok` and `distinct` have to be invariants, though they look like facts about the representation?'
options:
  - text: They are needed for the base case.
    why: 'The initial board satisfies them trivially. They matter for the step.'
  - text: Without them, consecution would consider boards with two blanks or a repeated tile, where a move can change the parity.
    correct: true
    why: 'Induction ranges over every value of the variables, not only well-formed boards. A board where `blank` points at a tile, or where a tile is duplicated, breaks the parity argument, so the invariant must exclude it.'
  - text: The solver cannot handle functions without them.
    why: 'It can. These are facts the proof needs, not the solver.'
```

:::history
**Induction for systems.** Proving concurrent programs correct with assertions and invariants goes back to Susan Owicki and David Gries's method for parallel programs (1976) and Leslie Lamport's proofs of multiprocess programs (1977);:cite[owicki1976,lamport1977] *How we got here (Part V)* tells that story. Mechanising the step with a SAT solver is more recent: Sheeran, Singh and Stålmarck introduced k-induction in 2000 to check safety properties of hardware designs.:cite[sheeran2000] Johnson and Story's parity proof is older than any of it, and is still the standard example of an invariant that separates a state space into two halves that never meet.:cite[johnson1879]
:::

:::hood
**The course's k-induction.** `src/lib/fv/ic3/kind.ts` reuses chapter 10's encoding of a system as formulas over Boolean variables. The base case is the bounded model checker of chapter 10, whose counterexamples are replayed by the interpreter. The step unrolls k + 1 fresh states, asserts the invariants in the first k and the negation in the last, adds a constraint that the states are pairwise different, and asks one incremental SAT solver. When the step is unsatisfiable, both final queries are built again on a fresh solver with proof logging, and the DRAT checker of chapter 8 checks the proofs: that is the certificate. In the step, a transition that would fail a run-time check (an `assert`, an overflow) leads nowhere, so such failures are left to the explorer and the bounded model checker. Counting modulo 2 is encoded as an exclusive or of the counted conditions, which keeps the parity proof small.
:::

:::proved
**What did we prove?** For Peterson's model: in every reachable state, at most one process is in its critical section. For the puzzle: no sequence of moves exchanges two tiles. Both for the models as written: two processes, atomic reads and writes (for Peterson); a board of 2 × 3 (for the puzzle; the 15 puzzle needs the blank's row too). The proofs rest on the SAT encoding of the models; the certificates are the DRAT proofs of the final queries.
:::

## What comes next

Strengthening is the hard part, and it was done by hand here, by reading CTIs. [Chapter 24](/chapters/ic3/) shows an algorithm that does it automatically: IC3 learns, from one counterexample to induction after another, clauses that rule out unreachable states, and stops when they add up to an inductive invariant.

## Further reading

- Sheeran, Singh and Stålmarck's paper introduces k-induction with a SAT solver.:cite[sheeran2000]
- Johnson and Story's notes prove which positions of the 15 puzzle can be reached.:cite[johnson1879]
