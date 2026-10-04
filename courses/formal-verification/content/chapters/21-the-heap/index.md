---
number: 21
title: 'The heap: separation logic'
summary: 'Programs that share mutable objects through pointers break the simplest rules of Hoare logic: an assignment through one pointer can change what another sees. Separation logic fixes this by describing the heap in disjoint pieces. Points-to, the separating conjunction, footprints, and the frame rule that lets a proof about a small piece of the heap extend to all of it.'
duration: About 1 hour 15 minutes
---

Every program so far has worked on values: a sequence, a struct, a number. `a[i := v]` made a new array and left the old one alone. Real programs keep objects in a **heap** and refer to them through pointers, and two pointers may refer to the same object. That one fact, **aliasing**, breaks the assignment rule of chapter 17, and fixing it took thirty years.

## Aliasing breaks the assignment rule

The assignment axiom says that to know Q after `x = e`, check Q with e substituted for x before. For a field, the natural version would be: to know Q after `x.val = 1`, check Q with 1 substituted for `x.val` before. Try it on Q = `y.val == 2`. The formula does not mention `x.val`, so the substitution changes nothing, and the rule gives

{ y.val == 2 } x.val = 1 { y.val == 2 }

which is false whenever x and y point to the same object. The assignment changed `y.val` without mentioning it. A correct rule must account for every other name the same object might have, and with pointers stored in other objects, those names are unbounded.

```quiz
q: 'The precondition is x.val == 0 && y.val == 0. After `x.val = 5`, what is known about y.val?'
options:
  - text: y.val == 0, since only x.val was assigned.
    why: 'Only if x and y are different objects. If x == y, then y.val is 5.'
  - text: Either 0 or 5, depending on whether x and y are the same object.
    correct: true
    why: 'Without knowing that x and y are distinct, both are possible. A verifier has to track which pointers may be equal, or require them to be distinct.'
  - text: Nothing at all.
    why: 'Something is known: y.val is 0 or 5. The trouble is that the plain assignment rule cannot say so.'
```

The second problem is the **frame problem**. A function that updates one object should not need a postcondition listing every other object in the program as unchanged, yet without such a list a caller cannot know what survived the call. Rod Burstall described techniques for programs that alter data structures in 1972, already noticing that the parts of a structure a program does not touch are the key to reasoning about it.:cite[burstall1972] The general solution came at the turn of the century.

## Separation logic

**Separation logic**, developed by John Reynolds, Peter O'Hearn, Hongseok Yang and others around 2000–2002, describes the heap in pieces.:cite[ohearn2001,reynolds2002] Its assertions are about a part of the heap, not about the whole, and its key connective says that two parts do not overlap:

- **`x.f |-> v`** (points-to): the heap consists of exactly one cell, field f of the object x, and it holds v. It also says that x is not null: null has no fields.
- **`P ** Q`** (the separating conjunction, written ∗ on paper): the heap can be split into two *disjoint* parts, one satisfying P and the other Q.
- **`emp`**: the heap is empty.

The cells an assertion describes are its **footprint**. `x.val |-> 1 ** y.val |-> 2` is false when x and y are the same object, because the two footprints would be the same cell. Aliasing is ruled out by the assertion itself, without a separate x ≠ y.

The diagram below links an assertion to a heap. Hover a conjunct to highlight its footprint. Click a variable or a pointer field (•), then an object, to redirect it, and watch the separating conjunction fail when two conjuncts claim the same cell.

::heap-diagram{heap='{"objs": [{"id": "a", "fields": {"val": 1, "next": "b"}}, {"id": "b", "fields": {"val": 2, "next": "c"}}, {"id": "c", "fields": {"val": 3, "next": null}}], "vars": {"x": "a", "y": "b", "z": "c"}}' assertion='["x.val |-> 1", "y.val |-> 2", "x.next |-> y", "lseg(y, null)"]' caption="A heap and an assertion. Each conjunct's footprint lights up when you hover it. Here x.next ↦ y and lseg(y, null) are fine separately, but lseg(y, null) includes y.val, which y.val ↦ 2 already claims. Delete one of them, or redirect y to a to alias it with x."}

The starting assertion fails, and not because anything in it is false: `y.val |-> 2` is true, and so is `lseg(y, null)`. They fail *together*, because the list segment from y claims every field of every node it passes, including `y.val`. Delete `y.val |-> 2` and the assertion holds. Then redirect y to a: now `x.val |-> 1` and the list segment from y overlap at `a.val`.

## The frame rule

Separation logic's assertions are about the part of the heap a command uses. The **frame rule** says that this is enough:

$$
\frac{\{P\}\ C\ \{Q\}}{\{P \ast R\}\ C\ \{Q \ast R\}}
$$

If C, run on a heap described by P, ends in a heap described by Q, then run on a bigger heap, P together with any separate part R, it ends in Q together with the same R, untouched. (C must not assign to variables that R mentions.) The part R is the **frame**. The rule is sound because C cannot even reach R: a command that went outside its footprint would have no proof of {P} C {Q} in the first place, since the points-to it needs would not be there.

The frame rule is what makes separation-logic proofs **local**. A function is specified and verified with only the cells it touches, and every caller keeps whatever else it owns. Below, `swap` exchanges two values. Its contract mentions only `a.val` and `b.val`. `three` owns a third cell, and calls `swap` without saying anything about it. The verifier finds the frame (`c.val ↦ 3`) by subtracting `swap`'s precondition from what `three` owns, and adds it back after the call.

:::workbench{title="Local reasoning" minLines=26}
```vouch
class Cell {
  val: int
}

// x and y are ghost parameters: logical variables naming the old values.
fn swap(a: ref Cell, b: ref Cell, ghost x: int, ghost y: int)
  requires a.val |-> x ** b.val |-> y
  ensures a.val |-> y ** b.val |-> x
{
  let t = a.val
  a.val = b.val
  b.val = t
}

fn three(a: ref Cell, b: ref Cell, c: ref Cell)
  requires a.val |-> 1 ** b.val |-> 2 ** c.val |-> 3
  ensures a.val |-> 2 ** b.val |-> 1 ** c.val |-> 3
{
  swap(a, b, 1, 2)
}
```
:::

Change the call to `swap(a, a, 1, 2)`. The verifier rejects it: `swap`'s precondition needs two separate cells, and the caller has only one with that name. In Hoare logic with plain conjunction, the same call would have needed a precondition `a != b` stated and checked by hand, in every function that might be passed two references.

```quiz
q: 'A function f has contract {list(x)} f(x) {list(x)}. A caller owns list(x) ** list(y). What does the caller know about y after calling f(x)?'
options:
  - text: Nothing; f might have changed it.
    why: 'f''s precondition gives it only list(x). By the frame rule, the rest, list(y), is untouched.'
  - text: list(y) still holds, with the same nodes and values.
    correct: true
    why: 'list(y) is the frame. Separation guarantees that the two lists share no node, so f cannot reach y''s nodes at all.'
  - text: list(y) holds only if f's postcondition mentions y.
    why: 'That is the frame problem the frame rule removes: f''s contract does not mention y, and does not need to.'
```

```verify
id: the-heap/bump-both
title: Two updates, two frames
prompt: |
  `bump` increments one cell. `bump_both` must increment two separate cells by calling `bump` twice. The body below calls it once. Fix it; the contracts are locked. Notice that you do not need to say anything about the cell you are not updating: the frame rule keeps it.
starter: |
  class Cell {
    val: int
  }

  fn bump(c: ref Cell, ghost n: int)
    requires c.val |-> n
    ensures c.val |-> n + 1
  {
    c.val = c.val + 1
  }

  fn bump_both(a: ref Cell, b: ref Cell, ghost x: int, ghost y: int)
    requires a.val |-> x ** b.val |-> y
    ensures a.val |-> x + 1 ** b.val |-> y + 1
  {
    bump(a, x)
  }
locked: [[1, 15]]
solution: |
  {
    bump(a, x)
    bump(b, y)
  }
hints:
  - At each call, the verifier takes bump's precondition out of the heap you own and keeps the rest as the frame.
success: 'At the first call, the frame is b.val ↦ y; at the second, a.val ↦ x + 1. Each call is verified against bump''s contract alone, and the frames carry everything else across.'
lines: 17
```

## Other ways to frame

Separation logic is not the only answer to the frame problem. Dafny uses **dynamic frames**: each method declares the set of objects it may modify (its `modifies` clause), the set is an ordinary value that specifications can compute with, and the verifier checks that the method writes nothing else.:cite[leino2010] Rust's ownership types, which chapter 22 turns to, solve a large part of the problem in the type system: a mutable reference is guaranteed not to alias any other live reference, so the frame comes for free.

:::history
**From Burstall to Reynolds.** Burstall's 1972 paper gave techniques for describing linked lists and the parts of them a program changes.:cite[burstall1972] For the next quarter of a century, verifying pointer programs meant stating and checking non-aliasing facts by hand. Separation logic grew out of a series of papers by Reynolds, O'Hearn, Ishtiaq and Yang around 2000, which Reynolds's 2002 paper surveys; O'Hearn, Reynolds and Yang's 2001 paper set out local reasoning and the frame rule.:cite[ohearn2001,reynolds2002] *How we got here (Part IV)* follows the line to Smallfoot and Infer.
:::

:::hood
**The course's heap verifier.** Heap functions (those with `ref` parameters or heap assertions) go to `src/lib/fv/heap/symheap.ts`, a symbolic executor over *symbolic heaps*: a pure part (equalities, arithmetic) and a list of points-to facts and list segments joined by ∗. A field read or write needs the matching points-to fact; a call subtracts the callee's precondition from the current heap, and what is left is the frame; a return must account for the whole heap. The diagram above uses a separate concrete evaluator (`widgets/heap.ts`): it computes each conjunct's footprint on an actual heap and checks that the footprints are disjoint.
:::

:::proved
**What did we prove?** A verified heap function never reads or writes a cell its precondition does not give it, never dereferences null, and returns with exactly the heap its postcondition describes. By the frame rule, every caller's other objects are untouched. The verdicts of the heap verifier come from symbolic execution, not from an SMT certificate: the course does not re-check its proofs independently, and the badge says so.
:::

## What comes next

`swap` and `bump` work on single cells. [Chapter 22](/chapters/linked-structures-and-ownership/) handles structures of any size: list segments, fold and unfold, a symbolic execution of list reversal step by step, memory-safety errors, and Rust's ownership as a form of the same accounting.

## Further reading

- Reynolds's 2002 paper introduces separation logic with many examples.:cite[reynolds2002]
- O'Hearn, Reynolds and Yang's paper introduces the frame rule and local reasoning.:cite[ohearn2001]
