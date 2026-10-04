---
number: 20
title: Data abstraction and refinement
summary: 'Verifying a data structure against what it represents. Abstract state kept as ghost state, representation invariants, and the simulation square that every operation must close; a ring-buffer queue verified against a sequence; and what goes wrong when an invariant is broken while someone else runs, the re-entrancy behind the DAO.'
duration: About 1 hour 15 minutes
---

Programs hide their data behind operations. A queue is a sequence to its users, whatever it is inside: a linked list, a pair of stacks, an array used as a circle. Users reason about the sequence; the implementation manipulates the array. Verifying the implementation means proving that the two views agree, for every operation and every state. This chapter shows how, with the method Tony Hoare published in 1972.:cite[hoare1972]

## Two views of one queue

A **ring buffer** stores a queue of bounded size in an array of fixed capacity. The elements occupy `count` consecutive cells starting at `head`, wrapping around from the last cell to the first. Pushing writes the cell after the last element; popping moves `head` forward. Nothing is ever shifted.

The specification is a sequence. In Vouch, the sequence the buffer represents is a **ghost field**, `items`: it exists for the proof, is updated alongside the real fields, and is erased when the program runs for real. Two pieces of specification tie it to the representation:

- the **representation invariant**: the conditions under which the fields make sense at all (a non-empty array, `head` within it, `count` at most its length);
- the **abstraction**: what sequence the fields represent. Here it is stated as part of the invariant, that `items[k]` is the element in the k-th occupied cell.

Together they are the predicate `valid`, and every operation requires it and ensures it.

:::workbench{title="A ring-buffer queue" minLines=40}
```vouch
struct Queue {
  data: [int],
  head: int,
  count: int,
  ghost items: [int],
}

// Where the k-th element of the queue lives in the buffer.
pure fn slot(q: Queue, k: int) -> int {
  if q.head + k < len(q.data) { q.head + k } else { q.head + k - len(q.data) }
}

// The representation invariant, and the abstraction (items) tied to the representation.
pred valid(q: Queue) {
  len(q.data) > 0 && 0 <= q.head < len(q.data) && 0 <= q.count <= len(q.data) &&
  len(q.items) == q.count &&
  forall k :: 0 <= k < q.count ==> q.items[k] == q.data[slot(q, k)]
}

fn push(q: Queue, x: int) -> Queue
  requires valid(q) && q.count < len(q.data)
  ensures valid(result)
  ensures result.items == q.items ++ [x]
{
  let tail = slot(q, q.count)
  return Queue { data: q.data[tail := x], head: q.head, count: q.count + 1, items: q.items ++ [x] }
}

fn front(q: Queue) -> int
  requires valid(q) && q.count > 0
  ensures result == q.items[0]
{
  return q.data[q.head]
}

fn pop(q: Queue) -> Queue
  requires valid(q) && q.count > 0
  ensures valid(result)
  ensures result.items == q.items[1..]
{
  let h = if q.head + 1 < len(q.data) { q.head + 1 } else { 0 }
  return Queue { data: q.data, head: h, count: q.count - 1, items: q.items[1..] }
}
```
:::

Each operation's postcondition is written entirely in terms of `items`: push appends, pop drops the first element, front returns it. A user of the queue needs nothing else. The array, `head` and the wrap-around arithmetic appear only in the bodies and in `valid`.

## The simulation square

For each operation, the proof obligation has a shape that Hoare's paper made famous. Start from a concrete state. Going one way, run the concrete operation, then read off the abstract state. Going the other way, read off the abstract state first, then run the abstract operation on it. The two paths must arrive at the same abstract state: the square must **commute**. If every square commutes, any sequence of operations on the buffer looks, from outside, exactly like the same sequence of operations on a sequence.

The view below runs the Vouch code above in the interpreter. Push and pop, and watch the buffer wrap around while the sequence stays a sequence. After each operation, its square is drawn with the result of the check on this one state. The verdicts at the top come from the verifier, and they are about every state.

:::abstraction-view{capacity=5}
```vouch
struct Queue {
  data: [int],
  head: int,
  count: int,
  ghost items: [int],
}

// Where the k-th element of the queue lives in the buffer.
pure fn slot(q: Queue, k: int) -> int {
  if q.head + k < len(q.data) { q.head + k } else { q.head + k - len(q.data) }
}

// The representation invariant, and the abstraction (items) tied to the representation.
pred valid(q: Queue) {
  len(q.data) > 0 && 0 <= q.head < len(q.data) && 0 <= q.count <= len(q.data) &&
  len(q.items) == q.count &&
  forall k :: 0 <= k < q.count ==> q.items[k] == q.data[slot(q, k)]
}

fn push(q: Queue, x: int) -> Queue
  requires valid(q) && q.count < len(q.data)
  ensures valid(result)
  ensures result.items == q.items ++ [x]
{
  let tail = slot(q, q.count)
  return Queue { data: q.data[tail := x], head: q.head, count: q.count + 1, items: q.items ++ [x] }
}

fn front(q: Queue) -> int
  requires valid(q) && q.count > 0
  ensures result == q.items[0]
{
  return q.data[q.head]
}

fn pop(q: Queue) -> Queue
  requires valid(q) && q.count > 0
  ensures valid(result)
  ensures result.items == q.items[1..]
{
  let h = if q.head + 1 < len(q.data) { q.head + 1 } else { 0 }
  return Queue { data: q.data, head: h, count: q.count - 1, items: q.items[1..] }
}
```
:::

:::bridge{course=proofs-are-programs chapter=compiler}
*Proofs Are Programs* proves a compiler correct with the same picture: compiling then running the machine code must agree with running the source program, step for step. The source language is the abstract state, the machine the concrete one, and the proof is a simulation.
:::

```quiz
q: 'Why is `valid(q)` both a precondition and a postcondition of every operation?'
options:
  - text: Because each operation needs it to work correctly, and must hand it on to the next operation.
    correct: true
    why: 'This is how a representation invariant works: it holds between operations. Each operation may assume it on entry (push needs head within the array, for instance) and must re-establish it on exit, so that the next operation can assume it in turn.'
  - text: Because the verifier cannot otherwise read the ghost field.
    why: 'Ghost fields can be read anywhere in specifications. The invariant is about which states make sense, not about access.'
  - text: Because valid(q) is the abstraction function.
    why: 'It contains the abstraction (how items relates to the array), but its role in the contracts is that of an invariant: assumed on entry, re-established on exit.'
```

```verify
id: data-abstraction/pop
title: Pop from the ring
prompt: |
  Write the body of `pop`: it must remove the front element by moving `head` forward (wrapping to 0 at the end of the array) and decrementing `count`, and update the ghost field to match. Everything else is locked.
starter: |
  struct Queue {
    data: [int],
    head: int,
    count: int,
    ghost items: [int],
  }

  // Where the k-th element of the queue lives in the buffer.
  pure fn slot(q: Queue, k: int) -> int {
    if q.head + k < len(q.data) { q.head + k } else { q.head + k - len(q.data) }
  }

  // The representation invariant, and the abstraction (items) tied to the representation.
  pred valid(q: Queue) {
    len(q.data) > 0 && 0 <= q.head < len(q.data) && 0 <= q.count <= len(q.data) &&
    len(q.items) == q.count &&
    forall k :: 0 <= k < q.count ==> q.items[k] == q.data[slot(q, k)]
  }

  fn push(q: Queue, x: int) -> Queue
    requires valid(q) && q.count < len(q.data)
    ensures valid(result)
    ensures result.items == q.items ++ [x]
  {
    let tail = slot(q, q.count)
    return Queue { data: q.data[tail := x], head: q.head, count: q.count + 1, items: q.items ++ [x] }
  }

  fn front(q: Queue) -> int
    requires valid(q) && q.count > 0
    ensures result == q.items[0]
  {
    return q.data[q.head]
  }

  fn pop(q: Queue) -> Queue
    requires valid(q) && q.count > 0
    ensures valid(result)
    ensures result.items == q.items[1..]
  {
    return q
  }
locked: [[1, 39]]
solution: |
  {
    let h = if q.head + 1 < len(q.data) { q.head + 1 } else { 0 }
    return Queue { data: q.data, head: h, count: q.count - 1, items: q.items[1..] }
  }
hints:
  - The new head is one cell further, unless that falls off the end of the array.
  - The new items are all but the first of the old ones, `q.items[1..]`.
success: 'The verifier proved the square for pop: valid(result) holds, and the new ghost sequence is the old one without its first element. The element at slot k of the new queue is the one at slot k + 1 of the old, which the solver establishes from the wrap-around arithmetic.'
lines: 42
```

## Invariants at the boundary, and what crosses it

A representation invariant holds *between* operations, not during them. Inside push, after the array is written but before `count` is incremented, the fields do not describe any queue. That is fine as long as no one looks. The danger is code that calls out while the invariant is broken: if the callee can call back into the object, it sees a state that the object's own operations assume never happens.

::museum{exhibit=dao-2016}

In 2016, a smart contract on the Ethereum network called the DAO lost a large share of the funds it held to exactly this pattern. Its withdrawal operation sent funds to the caller before updating its own record of the caller's balance. Sending funds to a contract runs that contract's code, and the attacker's code called the withdrawal again, while the balance record still showed the money as there.:cite[atzei2017]

The bank below is a simplified re-enactment. Its invariant is the Ledger's: the recorded balances add up to the funds the bank holds. `call_out` stands for sending funds to an account, which runs code the bank does not control; all the bank may assume is that this code, which may call back into the bank, preserves the invariant, provided the invariant holds when it is called.

:::workbench{title="Re-entrancy" minLines=44}
```vouch
pure fn sum(a: [int], n: int) -> int
  requires 0 <= n <= len(a)
  decreases n
{
  if n == 0 { 0 } else { sum(a, n - 1) + a[n - 1] }
}

lemma sum_update(a: [int], n: int, i: int, v: int)
  requires 0 <= i < len(a) && 0 <= n <= len(a)
  ensures sum(a[i := v], n) == sum(a, n) + (if i < n { v - a[i] } else { 0 })
  decreases n
{
  if n > 0 {
    sum_update(a, n - 1, i, v)
  }
}

struct Bank { balance: [int], pot: int }

// The bank's invariant: the recorded balances add up to the funds it holds.
pred inv(b: Bank) {
  sum(b.balance, len(b.balance)) == b.pot
}

// Sending funds runs the recipient's code, which may call back into the bank.
fn call_out(inout b: Bank, who: int, amount: int)
  requires inv(b)
  ensures inv(b) && len(b.balance) == len(old(b.balance))

// The DAO's order: send first, update the record after.
fn withdraw(inout b: Bank, who: int)
  requires inv(b) && 0 <= who < len(b.balance)
  ensures inv(b)
{
  let amount = b.balance[who]
  b.pot = b.pot - amount
  call_out(b, who, amount)
  sum_update(b.balance, len(b.balance), who, 0)
  b.balance = b.balance[who := 0]
}

// Update the record first, then send.
fn withdraw_safely(inout b: Bank, who: int)
  requires inv(b) && 0 <= who < len(b.balance)
  ensures inv(b)
{
  let amount = b.balance[who]
  sum_update(b.balance, len(b.balance), who, 0)
  b.balance = b.balance[who := 0]
  b.pot = b.pot - amount
  call_out(b, who, amount)
}
```
:::

The verifier rejects `withdraw` twice. At the call, it cannot show the invariant: the funds have gone but the balance has not changed, so the callee would see a broken bank. And at the end, it cannot show the invariant either: zeroing the balance *after* the call uses the balance from before it, but the callee may have changed it, and in the attack it did. `withdraw_safely` updates its own state first and calls out last, with the invariant restored, and it verifies. Smart-contract developers call this rule *checks, effects, interactions*.

:::history
**Abstraction and its proofs.** Hoare's 1972 paper introduced the abstraction function and the invariant of a representation, and the commuting diagram that relates operations on the representation to operations on the abstraction.:cite[hoare1972] The same idea, under the name **refinement**, runs through this course: chapter 4 checked that two-phase commit refines atomic commit, and the capstone in chapter 28 stacks refinements from a specification to an implementation. The DAO attack of 2016 made re-entrancy the best-known bug class of smart contracts, and it is first in Atzei, Bartoletti and Cimoli's survey of attacks on Ethereum contracts.:cite[atzei2017]
:::

:::hood
**Ghost fields in the course's tools.** The interpreter executes ghost code like any other (the abstraction view relies on it to show the abstract state), and the type checker rejects ghost code that writes to real state, so erasing ghost code cannot change what a program computes. The verifier treats a struct as a tuple of values, so `Queue { … }` is an ordinary value and `push` returns a new one; chapter 21 deals with objects that live in a heap and can be shared.
:::

:::proved
**What did we prove?** Every operation of the ring buffer takes a valid buffer representing a sequence s to a valid buffer representing the right sequence (s with x appended, or s without its first element). A user who only knows the contracts can reason about the queue as a sequence. For the bank, `withdraw_safely` preserves the invariant even if the callee calls back into the bank, under the assumption about callees stated in `call_out`'s contract; that assumption is the whole of what the proof knows about the outside world.
:::

## What comes next

The queue and the bank are values: the verifier never had to ask whether two variables refer to the same object. Real programs share mutable objects through pointers, and sharing breaks the simplest rules of Hoare logic. [Chapter 21](/chapters/the-heap/) introduces separation logic, which reasons about the heap one disjoint piece at a time.

## Further reading

- Hoare's 1972 paper is short and introduced the method used in this chapter.:cite[hoare1972]
- Atzei, Bartoletti and Cimoli survey the attacks on Ethereum smart contracts, starting with the DAO.:cite[atzei2017]
