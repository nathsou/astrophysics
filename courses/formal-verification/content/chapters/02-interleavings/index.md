---
number: 2
title: Interleavings
summary: Threads as processes whose small steps interleave in any order. Lose an update yourself, break a published mutual exclusion algorithm by choosing the schedule, deadlock two transfers, and count how fast the states multiply.
duration: About 1 hour 30 minutes
---

In January 1966 *Communications of the ACM* printed a short letter from Harris Hyman with a simple solution to a problem Edsger Dijkstra had posed the year before: how can two processes take turns using a shared resource, if all they can do is read and write shared variables? The letter gave a dozen lines of code and no proof.:cite[hyman1966] The code was wrong. There is an order in which the two processes can take their steps that lets both of them use the resource at once.

::museum{exhibit=hyman-1966}

The bug is not in any one line. Each process, read on its own, does something sensible. The bug is in an *interleaving*: an order of the two processes' steps that the author did not consider. This chapter is about such orders. By the end of it you will find Hyman's bug by playing the scheduler yourself, and then watch the explorer find the shortest bad interleaving among all of them.

## Threads as processes

In Chapter 1 a system was a set of actions, any of which could fire in any state. Concurrent programs are usually written differently: each thread is sequential code, and the threads run *at the same time*. Vouch has a construct for this, the `process`.

```vouch title="lost-update.vouch"
system LostUpdate {
  var balance: int = 100
  var deposited: 0..=2 = 0

  process Deposit(id: 0..2) {
    var t = 0
    read: t = balance
    add: t = t + 50
    write: balance = t
      deposited = deposited + 1
  }

  invariant conserved: balance == 100 + 50 * deposited
}
```

`process Deposit(id: 0..2)` declares one process for each value of `id`: two deposits of 50 into one account, running concurrently. Each has a local variable `t`. Its body is divided into **steps** by **labels**: `read:`, `add:` and `write:`. Everything from one label to the next happens as one indivisible step, so the `write` step stores the balance and counts the deposit together. Between steps, the other process may run.

This is the model of concurrency the whole of Part I uses: **interleaving**. The processes do not literally run at the same instant. At each moment, one of the processes that can take a step does so, and which one is up to the *scheduler*, which the model treats as an adversary. Every order of steps is possible, and the invariant must hold in all of them.

Where the labels go matters, because labels decide what is atomic. Here `read`, `add` and `write` are separate steps, as they would be in machine code: load the balance into a register, add, store it back. Put the whole update after one label and it becomes atomic, as if protected by a lock.

The ghost variable `deposited` counts completed deposits, so the invariant can say what conservation means: the balance is always 100 plus 50 for each deposit made.

:::interleavings{title="Two deposits into one account"}
```vouch
system LostUpdate {
  var balance: int = 100
  var deposited: 0..=2 = 0

  process Deposit(id: 0..2) {
    var t = 0
    read: t = balance
    add: t = t + 50
    write: balance = t
      deposited = deposited + 1
  }

  invariant conserved: balance == 100 + 50 * deposited
}
```
You are the scheduler. Each lane is one process; the highlighted line is the step it will take next. Choose who moves until the invariant breaks, then let the explorer search every interleaving.
:::

```predict
q: 'Each deposit takes three steps, so a run of the two deposits is an order of six steps: 20 orders in all (choose which three of the six positions belong to the first deposit). In how many of them is an update lost?'
options:
  - text: In 2 of the 20, the orders where both read before either writes, one way round or the other.
    why: 'Both reading before either writes is the problem, but it happens in far more than two orders: the steps in between can come in any order.'
  - text: In about half of them.
    why: 'Count the safe orders instead. An update survives only if one deposit reads after the other has written, and then the second deposit must run entirely after the first.'
  - text: In 18 of the 20.
    correct: true
    why: 'Only the two orders in which one deposit runs from start to finish before the other starts are safe. In every other order, both read the old balance. The bug is not rare among interleavings; it is rare in testing only because the operating system rarely preempts a thread between those two instructions.'
```

The lost update is the most common concurrency bug there is: two threads read a value, both compute a new one from what they read, and the second write erases the first. It is what the **Ledger**, the small bank that runs through this course, would do to two concurrent transfers into one account if its updates were not atomic. The fix is to make the read-modify-write one step: in real code, with a lock, an atomic instruction or a transaction.

```verify
id: interleavings/fix-lost-update
title: Make the deposit atomic
prompt: Change the `Deposit` process so that no interleaving loses an update. The state variables and the invariant are locked. (Real code would use a lock or an atomic instruction; in the model, a step is atomic when it has one label.)
starter: |
  system LostUpdate {
    var balance: int = 100
    var deposited: 0..=2 = 0

    process Deposit(id: 0..2) {
      var t = 0
      read: t = balance
      add: t = t + 50
      write: balance = t
        deposited = deposited + 1
    }

    invariant conserved: balance == 100 + 50 * deposited
  }
locked: [[1, 4], [12, 13]]
solution: |
  system LostUpdate {
    var balance: int = 100
    var deposited: 0..=2 = 0

    process Deposit(id: 0..2) {
      update: balance = balance + 50
        deposited = deposited + 1
    }

    invariant conserved: balance == 100 + 50 * deposited
  }
hints:
  - Labels mark the points where another process may run. Which points are the problem?
  - Put the read, the addition and the write after a single label.
success: The explorer now visits every interleaving and finds no state where the invariant fails. Notice how few states there are left.
lines: 13
```

## Mutual exclusion

Dijkstra's problem asks for more than an atomic update. Each process alternates between a **non-critical section**, where it works alone, and a **critical section**, where it uses the shared resource. The goal is **mutual exclusion**: at most one process in its critical section at a time. The rules make it hard: the only atomic operations are single reads and writes of shared variables, so there is no lock to use; a solution has to *build* one. Dijkstra published a solution for any number of processes in 1965, and credited the first correct solution for two processes to the Dutch mathematician Th. J. Dekker.:cite[dijkstra1965,dijkstra1965ewd123]

Hyman's proposal used two flags, each saying "I want to enter", and a variable `turn`. A process sets its flag; while it is not its turn, it waits for the other's flag to go down and then takes the turn; then it enters. In Vouch:

```vouch title="hyman.vouch"
system Hyman {
  type Proc = 0..2
  var flag: Proc -> bool = false
  var turn: Proc = 0

  process P(me: Proc) {
    loop {
      want: flag[me] = true
      test: while turn != me {
        wait: await !flag[1 - me]
        take: turn = me
      }
      critical: flag[me] = false
    }
  }

  invariant mutex: !(P(0) at critical && P(1) at critical)
}
```

Two new constructs appear. `flag: Proc -> bool` is a function from processes to Booleans, an array indexed by process. `await c` blocks until `c` is true: a process at `wait` can take its step only in a state where the other's flag is down. And the invariant uses `P(0) at critical`, which is true when process 0 is about to take the step labelled `critical`, that is, when it is inside its critical section. The step labelled `critical` is the *exit*: it lowers the flag and loops back.

:::interleavings{title="Hyman's algorithm" exhibit="hyman-1966"}
```vouch
system Hyman {
  type Proc = 0..2
  var flag: Proc -> bool = false
  var turn: Proc = 0

  process P(me: Proc) {
    loop {
      want: flag[me] = true
      test: while turn != me {
        wait: await !flag[1 - me]
        take: turn = me
      }
      critical: flag[me] = false
    }
  }

  invariant mutex: !(P(0) at critical && P(1) at critical)
}
```
Get both processes to `critical` at once. Hint: start with process 1, the one whose turn it is not, and pause it at the right moment.
:::

The bad schedule goes like this. Process 1 wants to enter; it is not its turn, and process 0's flag is down, so it passes the `wait`. Now pause it, just before it takes the turn. Process 0 wants to enter, finds `turn == 0` and walks straight into its critical section. Now resume process 1: it sets `turn = 1`, finds that it is now its turn, and enters too. Each process checked a condition that was true when it checked it, and was false by the time it acted. That gap between a check and the action that depends on it has a name, a **time-of-check to time-of-use** race, and it is the shape of many concurrency bugs and security holes.

:::history{year=1981 title="Peterson's two lines" people="Gary Peterson" source="Source: Peterson (1981)."}
Fifteen years after Hyman, Gary Peterson published a two-process algorithm in a note titled *Myths about the mutual exclusion problem*. It uses the same two flags and `turn` as Hyman's, in a different order: a process raises its flag, then **gives the turn away**, then waits until either the other process does not want to enter or the turn has come back. It is short enough that its correctness argument fits in a paragraph, and it became the standard textbook example.:cite[peterson1981]
:::

```vouch title="peterson.vouch"
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

:::interleavings{title="Peterson's algorithm"}
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
Try the same trick. Then let the explorer search: it visits every reachable state and finds none with both processes in the critical section.
:::

The explorer's verdict for Peterson is *all 20 states*: every reachable state has been checked. That is a complete proof, for this model: two processes, atomic reads and writes, any interleaving. It says nothing about three processes (Peterson's algorithm as written is for two), and nothing about a processor that reorders memory operations, which the box at the end of the chapter takes up.

```model
id: interleavings/mutex-property
title: State mutual exclusion
prompt: |
  Write the invariant that says the two processes are never in their critical sections at the same time, using `P(0) at critical` and `P(1) at critical`. Your line replaces `@model` in Hyman's and Peterson's algorithms. It must **fail** on Hyman's and **hold** on Peterson's.
starter: |
  invariant mutex: true
cases:
  - name: Hyman (1966)
    expect: fails
    why: The explorer finds the interleaving in which both enter.
    code: |
      system Hyman {
        type Proc = 0..2
        var flag: Proc -> bool = false
        var turn: Proc = 0
        process P(me: Proc) {
          loop {
            want: flag[me] = true
            test: while turn != me {
              wait: await !flag[1 - me]
              take: turn = me
            }
            critical: flag[me] = false
          }
        }
        @model
      }
  - name: Peterson (1981)
    expect: holds
    why: Every one of its 20 reachable states has at most one process in the critical section.
    code: |
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
        @model
      }
solution: |
  invariant mutex: !(P(0) at critical && P(1) at critical)
hints:
  - '`P(0) at critical` is true when process 0 is in its critical section.'
  - Both of them at once must never happen.
lines: 3
```

## Locks and deadlock

Real programs do not build locks out of flags; they use the operating system's. Locks introduce a different failure. Here are two transfers in the Ledger, one from account A to account B and one from B to A. Each must hold the locks of both accounts while it moves the money, and each takes them one at a time.

```vouch title="lock-order.vouch"
system LockOrder {
  var lock_a: 0..3 = 0    // 0 when free, otherwise who holds it
  var lock_b: 0..3 = 0

  process AtoB() {
    take_a: await lock_a == 0
      lock_a = 1
    take_b: await lock_b == 0
      lock_b = 1
    move: lock_a = 0
      lock_b = 0
  }
  process BtoA() {
    take_b: await lock_b == 0
      lock_b = 2
    take_a: await lock_a == 0
      lock_a = 2
    move: lock_b = 0
      lock_a = 0
  }
}
```

Taking a lock is an `await` followed by an assignment in the same step: wait until the lock is free and take it, atomically, as a real lock does. There is no invariant to state. The explorer checks systems of processes for something else as well: a **deadlock**, a reachable state where no process can move although not all of them have finished.

:::interleavings{title="Two transfers, two locks"}
```vouch
system LockOrder {
  var lock_a: 0..3 = 0
  var lock_b: 0..3 = 0

  process AtoB() {
    take_a: await lock_a == 0
      lock_a = 1
    take_b: await lock_b == 0
      lock_b = 1
    move: lock_a = 0
      lock_b = 0
  }
  process BtoA() {
    take_b: await lock_b == 0
      lock_b = 2
    take_a: await lock_a == 0
      lock_a = 2
    move: lock_b = 0
      lock_a = 0
  }
}
```
Two steps are enough: each transfer takes its first lock, and then each waits forever for the other's.
:::

Each transfer holds one lock and waits for the other: a cycle of waiting, and neither can move. The standard cure is a **lock order**: every transfer takes the locks in the same order, say by account number, whichever direction the money goes. Then no cycle can form.

```verify
id: interleavings/lock-order
title: Order the locks
prompt: Change `BtoA` so that the system cannot deadlock. It must still hold both locks during `move`, and release them both.
starter: |
  system LockOrder {
    var lock_a: 0..3 = 0
    var lock_b: 0..3 = 0

    process AtoB() {
      take_a: await lock_a == 0
        lock_a = 1
      take_b: await lock_b == 0
        lock_b = 1
      move: lock_a = 0
        lock_b = 0
    }
    process BtoA() {
      take_b: await lock_b == 0
        lock_b = 2
      take_a: await lock_a == 0
        lock_a = 2
      move: lock_b = 0
        lock_a = 0
    }
  }
locked: [[1, 12]]
solution: |
  process BtoA() {
    take_a: await lock_a == 0
      lock_a = 2
    take_b: await lock_b == 0
      lock_b = 2
    move: lock_b = 0
      lock_a = 0
  }
hints:
  - Deadlock needs a cycle of processes, each waiting for a lock that the next one holds.
  - If both transfers take `lock_a` first, can one of them hold `lock_b` while waiting for `lock_a`?
success: No deadlock in any of the 12 reachable states. Lock ordering is how databases and kernels avoid this kind of cycle.
lines: 20
```

## Counting the interleavings

How many states does a concurrent system have? Take the deposit model and add processes. Each new deposit has its own program counter and its own local variable, and the steps of all the deposits can interleave in any order.

| Deposits | Reachable states | Transitions | States with partial-order reduction |
|---:|---:|---:|---:|
| 1 | 4 | 3 | 4 |
| 2 | 22 | 28 | 20 |
| 3 | 175 | 288 | 147 |
| 4 | 1,916 | 3,788 | 1,499 |
| 5 | 26,789 | 61,970 | 19,520 |
| 6 | 452,118 | 1,204,014 | 306,559 |

*Counted by the course's explorer, for `n` deposits of 10 into one account, each with three steps (read, add, write).*

```predict
q: 'Each extra deposit multiplies the number of states by roughly 10 to 17. Roughly how many states would 10 deposits have?'
options:
  - text: About 10,000.
    why: 'Six deposits already have more than 450,000 states.'
  - text: About 10 million.
    why: 'Four more deposits multiply 450,000 by something like 10⁴ to 10⁵.'
  - text: Several billion or more.
    correct: true
    why: '452,118 × 15⁴ ≈ 2 × 10¹⁰. That is beyond an explorer in a browser, and at the edge of what a disk-based model checker can store. This is the state explosion problem.'
```

This is **state explosion**. The count multiplies with each process because every process's position combines with every other's. Explicit-state model checkers fight it in several ways, and you can see two of them in the explorer.

**Symmetry reduction.** If processes are interchangeable, a state and the state with two processes' roles swapped behave the same way, so the explorer need store only one of them. Vouch supports this for values of a type declared `symmetric`: the two-phase commit protocol in Chapter 4 has interchangeable shards, and the explorer then keeps one state per class of renamings. Our deposits are not declared that way, so the table does not use it.

**Partial-order reduction.** Many interleavings differ only in the order of steps that do not affect each other. The `add` step touches only the deposit's own local variable `t`; it commutes with every step of every other process. So when a process is about to take such a step, the explorer can take it alone, without also trying all the other processes first, as long as the step is invisible to the invariant. The last column of the table shows the effect. It is modest, because the course's reduction only reduces purely local steps; SPIN's partial-order reduction uses a finer notion of independence and saves much more.:cite[holzmann1997] Press *Let the explorer search* in any of the scheduler widgets above to see the two counts for that model.

Neither technique changes the shape of the curve. They divide the count; they do not stop it from multiplying. The real answers to state explosion are in later parts: represent sets of states symbolically (Part II), or prove an invariant that covers any number of processes (Part V).

## Under the hood: processes are actions

The explorer of Chapter 1 understood only actions. Processes are **compiled** into the same form. Each process gets a hidden variable, its **program counter** (`pc`), which records the label it is at. The body is compiled to instructions (statements, `await`, branches and jumps) and each label becomes a point where a step ends. A process step is then an action like any other: in a state where the process is at label ℓ, run the instructions from ℓ until the next label, and set `pc` to that label. If an `await` on the way is false, the step is not enabled.

```text title="P(me) of Peterson, compiled (simplified)"
0  label want
1  flag[me] = true
2  label yield
3  turn = 1 - me
4  label wait
5  await !flag[1 - me] || turn == me
6  label critical
7  flag[me] = false
8  jmp 0
```

`P(0) at critical` is then just a test of P(0)'s program counter, and the traces you saw in the scheduler widgets show each process's `pc` as a column. TLA+ users write the program counter by hand, which makes the translation explicit; PlusCal, a language for algorithms that compiles to TLA+, does it automatically in the same way.

:::hood
**What the step granularity assumes.** A model is only as good as its choice of atomic steps. Each Vouch step must correspond to something that really is atomic: a single read or write of a word-sized variable, an atomic instruction, or a region protected by a lock. Making steps larger than the real ones hides bugs (the lost update vanishes if read-add-write is one step); making them smaller only costs states. When in doubt, split.
:::

:::history{year=1985 title="The Therac-25" people="Nancy Leveson, Clark Turner" source="Source: Leveson and Turner (1993)."}
Between 1985 and 1987 a radiation therapy machine, the Therac-25, gave six patients massive overdoses. Nancy Leveson and Clark Turner's investigation found many causes: software reused from earlier machines that had had hardware interlocks, which the Therac-25 lacked; poor error messages that operators learned to ignore; and race conditions between the task that handled the operator's editing of the treatment data and the task that set up the machine. A fast operator could change the data in a way that one task saw and the other did not.:cite[leveson1993]

The course does not re-enact the Therac-25: its code was not published in a form that can be modelled faithfully, and its failure had many causes beyond the race. The lesson for this chapter is the race itself. Two tasks shared data, and the correctness of each depended on an interleaving that testing at human speed rarely produced.
:::

::::deeper
**◇ Weak memory.** Every model in this chapter assumes **sequential consistency**: steps happen one at a time, and every read sees the latest write. Modern processors do not work that way. On x86, a write goes first into a **store buffer**, private to the core, and reaches memory later; meanwhile, the core's reads of other locations go to memory. The *store-buffering* test makes this visible: thread 0 writes `x = 1` then reads `y`; thread 1 writes `y = 1` then reads `x`. Under sequential consistency, at least one thread must read 1. With store buffers, both can read 0.

You can model the buffers in Vouch: the write goes into a pending flag, and a separate action flushes it to memory at some later time.

:::state-space{title="Store buffering"}
```vouch
system StoreBuffering {
  var x: 0..2 = 0
  var y: 0..2 = 0
  var r0: 0..3 = 2
  var r1: 0..3 = 2
  var pending0: bool = false
  var pending1: bool = false

  process T0() {
    write: pending0 = true
    read: r0 = y
  }
  process T1() {
    write: pending1 = true
    read: r1 = x
  }
  action flush0 when pending0 {
    x = 1
    pending0 = false
  }
  action flush1 when pending1 {
    y = 1
    pending1 = false
  }

  invariant not_both_zero: !(r0 == 0 && r1 == 0)
}
```
`r0` and `r1` start at 2, meaning "not read yet". Run the search: both threads read 0 when both writes are still in their buffers.
:::

Peterson's algorithm is broken on such hardware without memory fences, for exactly this reason: a process can read the other's flag before its own write to `flag[me]` is visible. Verifying code for weak memory models means modelling the hardware's memory model precisely, which was itself a research project for x86.:cite[sewell2010]
::::

:::industry
**Where interleavings are checked.** SPIN was designed for exactly this chapter's kind of model: communicating processes with small steps, checked for invariants and deadlocks, and it was built for and used on the software of telephone switches and on communication protocols.:cite[holzmann1997] Systematic concurrency testing tools apply the same idea to real code: they take control of the thread scheduler and explore schedules deliberately instead of waiting for the operating system to produce a bad one.
:::

:::proved
**What did we prove?** For Peterson's algorithm: mutual exclusion in all 20 reachable states, for two processes under sequential consistency. For the fixed deposits and the ordered locks: their invariant, and freedom from deadlock, in every reachable state of these small instances. Each *holds* result trusts the explorer's search; each *violated* result (Hyman, the lost update, the deadlock) comes with a trace that the interpreter replayed. None of these results covers more processes, or a weaker memory model.
:::

## What comes next

Mutual exclusion is a **safety** property: something bad never happens. Peterson's algorithm also promises that a process that wants to enter eventually does, a **liveness** property, and no invariant can express that. [Chapter 3](/chapters/eventually/) adds temporal logic, and finds infinite runs in which a process waits forever.

## Further reading

- Dijkstra's *Cooperating sequential processes* (1965) presents a series of failed attempts at mutual exclusion before the correct ones, which is still the best way to learn why the problem is hard.:cite[dijkstra1965ewd123]
- Leveson and Turner's investigation of the Therac-25 is a classic account of how software, process and people combined to fail.:cite[leveson1993]
- Holzmann's SPIN paper covers partial-order reduction and the other techniques that make explicit-state checking scale.:cite[holzmann1997]
