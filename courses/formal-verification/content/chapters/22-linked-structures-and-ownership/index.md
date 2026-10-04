---
number: 22
title: Linked structures and ownership
summary: 'A list has no fixed size, so its description must be recursive. List segments, unfolding and folding, a symbolic execution of list reversal step by step, and the memory-safety errors it catches: null dereferences, use after free, double free and leaks. Then Smallfoot and Infer, and Rust, whose borrow checker does the same accounting in the type system.'
duration: About 1 hour 20 minutes
---

Chapter 21 described heaps one cell at a time: `a.val |-> 1 ** b.val |-> 2`. That works for a fixed number of objects. A linked list can have any number of nodes, and a function that reverses one must work for all of them. Its description has to be recursive, and the verifier must be able to open the recursion when the code looks inside the list, and close it again when the code is done.

## Lists of any length

A list starting at x is either empty, or a first node followed by a list. In separation logic that is a definition by cases:

- **`list(x)`** holds when x is null and the heap is empty, *or* when x is not null and the heap splits into `x.val |-> v ** x.next |-> n ** list(n)` for some values v and n.
- **`lseg(x, y)`** (a list segment) is the same with y in place of null: following `next` from x reaches y, and the segment owns every node on the way, but not y itself. `list(x)` is `lseg(x, null)`.

The separating conjunction does a lot of quiet work here. Because the first node and the rest of the list are separate, the first node cannot appear again in the rest: the list has no cycles and no node is shared. A heap with a cycle does not satisfy `list(x)`, however it is split.

```quiz
q: 'x points to node A, whose next is B, whose next is A again (a cycle of two nodes). Does list(x) hold?'
options:
  - text: Yes, both nodes are reachable from x.
    why: 'Reachability is not enough. Unfolding twice would need A''s fields in two separate parts of the heap, which is impossible.'
  - text: No. Following next never reaches null, and a node cannot be in two separate parts of the heap.
    correct: true
    why: 'list(x) needs a finite chain ending in null, each node owned exactly once. The heap diagram in chapter 21 says the same: following next from x goes round a cycle.'
  - text: Only if the heap has no other nodes.
    why: 'Other nodes do not matter: list(x) fails on the two nodes of the cycle alone.'
```

The predicate says nothing about the values stored in the nodes: it describes the **shape** of the heap. That is a deliberate limit of this chapter's verifier. Shape alone already rules out the errors that crash programs, and it is the part that tools like Infer check at scale. Values can be added with a predicate that also carries the list's contents as a sequence; the proofs become longer, not different in kind.

## Unfold, work, fold

A symbolic heap, as in chapter 21, is a list of facts joined by ∗ plus some pure facts. When the code reads `cur.next` and the heap holds `list(cur)`, there is no `cur.next ↦ …` fact to read from. The verifier **unfolds** the predicate: it splits into the two cases of the definition. If the code has checked `cur != null`, the empty case is contradictory and disappears; otherwise the verifier reports a possible null dereference. In the remaining case, the heap holds `cur.val ↦ v ∗ cur.next ↦ n ∗ list(n)` with fresh names v and n, and the read succeeds.

At the end of a loop iteration the opposite step is needed. The invariant is stated with predicates, and the heap now holds loose points-to facts. The verifier **folds** them back: `x.val ↦ v ∗ x.next ↦ y ∗ list(y)` is `list(x)`. Josh Berdine, Cristiano Calcagno and Peter O'Hearn described this kind of symbolic execution, with unfolding, folding and the frame inference of chapter 21, in 2005, as the engine of their prover Smallfoot.:cite[berdine2005]

Step through list reversal. The loop keeps two lists: `prev`, the part already reversed, and `cur`, the part still to do. Its invariant says only that they are two separate lists. At each step, watch the heap: the unfold opens `list(cur₁)`, the assignment `cur.next = prev` changes one points-to fact, and at the end of the iteration the node at `cur₁` together with `list(prev₁)` folds into the new `list(prev)`. Values written with a subscript, like `prev₁`, are the values the variables had at the start of the iteration.

:::heap-stepper{fn="reverse" title="List reversal, symbolically"}
```vouch
class Node {
  val: int
  next: ref Node?
}

fn reverse(x: ref Node?) -> ref Node?
  requires list(x)
  ensures list(result)
{
  var prev: ref Node? = null
  var cur = x
  while cur != null
    invariant list(prev) ** list(cur)
  {
    let n = cur.next
    cur.next = prev
    prev = cur
    cur = n
  }
  return prev
}
```
:::

The proof never mentions the length of the list, and never says that x and the result are different or the same. The invariant's ∗ guarantees that the reversed part and the remaining part share no node, which is exactly why `cur.next = prev` cannot create a cycle.

```verify
id: linked-structures-and-ownership/reverse-invariant
title: The reversal invariant
prompt: |
  This version of `reverse` has a weaker invariant: it describes only the part still to do. Run it and read the error, then strengthen the invariant. Only the invariant line can change.
starter: |
  class Node {
    val: int
    next: ref Node?
  }

  fn reverse(x: ref Node?) -> ref Node?
    requires list(x)
    ensures list(result)
  {
    var prev: ref Node? = null
    var cur = x
    while cur != null
      invariant list(cur)
    {
      let n = cur.next
      cur.next = prev
      prev = cur
      cur = n
    }
    return prev
  }
locked: [[1, 12], [14, 21]]
solution: |
  invariant list(prev) ** list(cur)
hints:
  - The error says the loop body leaves nodes the invariant does not describe. Which nodes are they, and where are they in the program's state?
  - Every node is either in the part already reversed or in the part still to do.
success: 'The weak invariant drops the reversed nodes at every iteration: they are still allocated, but no assertion owns them, so the verifier reports a leak. Once the invariant owns both parts, every node is accounted for at every step.'
lines: 21
```

## What goes wrong with memory

Because every access needs a points-to fact, the verifier catches the classic memory errors of languages with manual memory management, such as C:

- **Null dereference.** Reading `x.next` when x may be null: unfolding `list(x)` leaves the empty case.
- **Use after free.** `free x` removes x's points-to facts from the heap. A later access finds none.
- **Double free.** Freeing x a second time finds nothing to free.
- **Leak.** At a return, the postcondition must describe the whole heap that is left (the rule of chapter 21). Facts left over describe memory that is still allocated but that nobody owns any more.

The verdicts follow the course's rules for honesty. A null dereference, a use after free or a double free is replayed: the verifier builds lists of zero to three nodes that satisfy the precondition, runs the function in the interpreter, and reports a violation only if the run fails the same way. A leak cannot be seen at run time, so a leak of a node the verifier knows exists is reported as a violation found by the analysis, not replayed; a leak of a list that might be empty is reported as possible.

```verify
id: linked-structures-and-ownership/free-all
title: Freeing a list
prompt: |
  `free_all` must free every node of a list. This version frees each node and then reads its `next` field. Run it: the verifier reports a use after free, and the interpreter confirms it. Fix the body; the contract and the loop invariant are locked.
starter: |
  class Entry {
    amount: int
    next: ref Entry?
  }

  fn free_all(x: ref Entry?)
    requires list(x)
    ensures emp
  {
    var cur = x
    while cur != null
      invariant list(cur)
    {
      free cur
      cur = cur.next
    }
  }
locked: [[1, 12]]
solution: |
  {
    var cur = x
    while cur != null
      invariant list(cur)
    {
      let n = cur.next
      free cur
      cur = n
    }
  }
hints:
  - The next node's address is stored in the node being freed. Save it first.
success: 'Reading the next pointer before the free keeps the rest of the list reachable. The postcondition emp says the function leaves nothing allocated, so forgetting the free entirely would be reported too, as a leak.'
lines: 17
```

```verify
id: linked-structures-and-ownership/undo
title: Undoing the last entry
prompt: |
  A journal is a list whose first node is the latest entry. `undo` must remove that entry and return the rest of the journal. This version returns the rest but forgets the first node. Fix it; the contract is locked.
starter: |
  class Entry {
    amount: int
    next: ref Entry?
  }

  fn undo(journal: ref Entry) -> ref Entry?
    requires list(journal)
    ensures list(result)
  {
    return journal.next
  }
locked: [[1, 8]]
solution: |
  {
    let rest = journal.next
    free journal
    return rest
  }
hints:
  - When undo returns, the caller owns only the list it gets back. Where is the first node then?
success: 'The first node is now freed, and the caller owns exactly the rest of the list. The parameter''s type, ref Entry without a question mark, says the journal is not empty, so the verifier knows the first node exists and the leak in the starter was definite.'
lines: 11
```

```quiz
q: '`fn clear(x: ref Node?) -> ref Node?` with contract `requires list(x)` and `ensures list(result)` just returns null. What does the verifier report?'
options:
  - text: A definite leak.
    why: 'Only if the list is known to have a node. x may be null, and then list(x) is empty and nothing leaks.'
  - text: A possible leak.
    correct: true
    why: 'If x is not null, its nodes are lost. If x is null, the function is correct. The verdict is "unknown", with the leak explained: the analysis cannot rule it out, but cannot confirm it for every input either.'
  - text: Nothing; list(null) holds.
    why: 'The postcondition list(null) holds, but the heap left over, list(x), must also be accounted for.'
```

## Shape analysis at scale

Smallfoot verified functions that came with pre- and postconditions. To analyse code nobody had annotated, the verifier must also guess what a function needs. In 2009, Calcagno, Dino Distefano, O'Hearn and Hongseok Yang added **bi-abduction**: when the heap at a call lacks part of what the callee needs, the analysis infers the missing part (the *anti-frame*) and adds it to the caller's own precondition, while frame inference finds what the callee leaves alone.:cite[calcagno2009] Each function is analysed once, on its own, and the results compose. That is what made the analysis scale to millions of lines.

The team's start-up, Monoidics, joined Facebook in 2013, and its analyser became **Infer**. By 2015, Infer ran on the code changes developers submitted for review in Facebook's mobile apps and wrote comments where it found potential problems, and its authors reported that the fix rate for the issues it raised was hovering around 80 per cent.:cite[calcagno2015,fbinfer2015] Facebook open-sourced Infer on 11 June 2015.:cite[fbinfer2015]

:::history
**From proofs to bug reports.** Smallfoot (2005) proved small programs with annotations.:cite[berdine2005] Bi-abduction (2009) removed the need for annotations.:cite[calcagno2009] Infer (2015) moved the technique into code review, where a report has to be fast, about the change in front of the developer, and right often enough to be worth reading.:cite[calcagno2015] Part of what made this work is a change of goal: Infer reports likely bugs rather than proving the absence of all of them, and keeps quiet when unsure. *How we got here (Part IV)* follows the line from Hoare logic to these tools.
:::

## Ownership as permission accounting

Every proof in this chapter tracks the same thing: who owns which cell. A points-to fact is a **permission** to read and write a cell, and ∗ ensures that no cell is owned twice. John Boyland made the accounting finer in 2003 with **fractional permissions**: the permission to an object is a number between 0 and 1. Writing needs the whole of it, 1; reading needs any part above 0. A permission can be split, half to one thread and half to another, and both can read, but neither can write until the halves are joined again.:cite[boyland2003]

Rust's borrow checker enforces a discipline of the same shape, in the type system, at compile time. A variable that owns an object holds the whole permission. A shared borrow `&a` lets the borrower read while the owner keeps reading too; a mutable borrow `&mut a` hands over everything, so the owner cannot even read until the borrow ends; a move transfers ownership for good; and dropping (freeing) the object requires that no borrow is still alive. Since Rust 1.31 and the 2018 edition, a borrow ends at its last use rather than at the end of its scope (**non-lexical lifetimes**).:cite[rust2018]

The tracker below models this with fractions: a shared borrow takes half of what the lender holds, and the permission returns when the borrow's last use is past. It is a teaching model of the idea, not of Rust: the real borrow checker reasons about lifetimes and places in a control-flow graph, not about fractions.

::permission-tracker{programs='[{"name": "Shared reads", "code": "let a = new\nlet r = &a\nlet s = &a\nread r\nread s\nwrite a"}, {"name": "Write while shared", "code": "let a = new\nlet r = &a\nwrite a\nread r"}, {"name": "Two &mut", "code": "let a = new\nlet m = &mut a\nlet n = &mut a\nwrite m\nwrite n"}, {"name": "Use after move", "code": "let a = new\nlet b = a\ndrop b\nread a"}, {"name": "Dangling borrow", "code": "let a = new\nlet r = &a\ndrop a\nread r"}]' caption="Click a line to see who holds what after it. In “Shared reads”, the write to a is accepted because r and s are no longer used: their halves have come back. Move the line read r to the end and the write is rejected."}

```quiz
q: 'In the tracker, `let m = &mut a` is followed by `read a` and then `write m`. Why is `read a` rejected?'
options:
  - text: Because a was moved.
    why: 'A mutable borrow is not a move: a gets its permission back when m is no longer used.'
  - text: Because m holds all of the permission, and m is still used afterwards.
    correct: true
    why: 'A mutable borrow takes the whole permission so that the borrower can write while nobody else reads. Since m is used after read a, the borrow is alive and a holds nothing.'
  - text: Because reading needs the whole permission.
    why: 'Reading needs only some of it. a has none at all while m is alive.'
```

Ownership types give the frame for free. A function that takes `&mut x` cannot touch any object it was not handed, and the caller's other objects are untouched without any assertion saying so. That is chapter 21's frame rule, built into the type checker.

## Verifying Rust

Several verifiers use this: the type checker has already proved the separation, so specifications need only talk about values.

- **Prusti** (2019) reads Rust's types and borrows and builds the permission part of the proof from them, so a user writes only the functional part of a specification.:cite[astrauskas2019]
- **Creusot** (2022) handles mutable borrows with *prophecies*: a value standing for what the borrowed object will hold when the borrow ends, which lets a specification say what a function does through a `&mut` before it is known.:cite[denis2022]
- **Verus** (2023) writes specifications and proofs in Rust itself, verifies them with an SMT solver, and represents permissions as *linear ghost* values that the borrow checker tracks like any other value: a proof can hold, split and hand over the permission to a raw pointer.:cite[lattuada2023]

Behind them is a result about Rust itself. Rust's guarantees hold for safe code, but its standard library is built with `unsafe` code that the compiler does not check. RustBelt (2018) gave a machine-checked safety proof, in a separation logic, for a realistic subset of Rust, including libraries that use `unsafe` internally.:cite[jung2018]

:::hood
**The course's heap verifier.** `src/lib/fv/heap/symheap.ts` is a Smallfoot-style symbolic executor. A symbolic heap is a pure part and a list of atoms: points-to facts and list segments. Unfolding happens when an access needs a points-to fact that only a segment can provide; folding happens in the entailment check, which matches the goal's segments against chains of points-to facts and segments in the heap. Entailment is checked with the course's SMT solver for the pure parts. A leak is definite when what is left over contains a points-to fact or a segment the solver proves non-empty. Errors other than leaks are replayed in the interpreter (`src/lib/fv/heap/verdicts.ts`). The permission tracker (`widgets/perm.ts`) is separate and small: about a hundred lines.
:::

:::proved
**What did we prove?** For `reverse`: on every list, of every length, the function never dereferences null, touches only nodes of its input, and returns a list made of exactly those nodes, with no leak. Not proved: that the result holds the input's values in reverse order. The predicate tracks shape, not contents. The proofs come from symbolic execution and are not re-checked by an independent checker; the badge says so.
:::

## What comes next

Part IV ends here: programs with loops, specifications, data and heaps, verified one function at a time. Part V turns back to systems that run forever, the subject of Part II, with the proof techniques built since. [Chapter 23](/chapters/inductive-invariants/) asks what makes an invariant of a whole system provable, and what to do when it is true but not inductive.

## Further reading

- Berdine, Calcagno and O'Hearn's 2005 paper describes the symbolic execution behind Smallfoot.:cite[berdine2005]
- Calcagno and colleagues' 2015 paper tells how Infer was deployed at Facebook.:cite[calcagno2015]
- Jung and colleagues' RustBelt paper is the reference for what Rust's type system guarantees, and why.:cite[jung2018]
