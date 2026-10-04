---
number: 19
title: Quantifiers, ghosts and lemmas
summary: 'Specifications about whole arrays: sortedness, permutations, sums. How an SMT solver uses a quantifier (by instantiating it, guided by triggers) and how that goes wrong (matching loops). Ghost code that exists only for the proof, lemmas that are proofs written as functions, and the craft of debugging a proof that fails. Insertion sort and the Ledger''s conservation of money, verified.'
duration: About 1 hour 30 minutes
---

The specifications that matter for real code are about collections: the array is sorted, the output is a permutation of the input, the total of the balances does not change. They need quantifiers (*for every index*) and functions defined by recursion (*the sum of the first n elements*). Chapter 12 decided formulas without quantifiers; this chapter shows what a solver does with them, why it sometimes cannot finish, and how a person helps it.

## Sorted, and a permutation

Chapter 16 specified sorting: the result is sorted, and its multiset of elements equals the input's. Here is insertion sort with that specification. The outer loop keeps the prefix `b[0..i)` sorted; the inner loop moves the next element down into place by swapping it with its left neighbour. The invariants of the inner loop are the most intricate in the course so far: the elements of `b[0..i]` other than the one being moved are in order, and everything to the left of the moving element is smaller than everything to its right.

```verify
id: quantifiers-ghosts-and-lemmas/insertion-sort
title: Insertion sort is a permutation
prompt: |
  The invariants below prove that the result is sorted, but the third postcondition, that the result is a permutation of the input, does not verify. Add the invariant each loop needs. The rest of the code is locked.
starter: |
  pred sorted(a: [int]) {
    forall i, j :: 0 <= i < j < len(a) ==> a[i] <= a[j]
  }

  fn insertion_sort(a: [int]) -> [int]
    ensures len(result) == len(a)
    ensures sorted(result)
    ensures multiset(result) == multiset(a)
  {
    var b = a
    var i = 1
    while i < len(b)
      invariant 1 <= i
      invariant len(b) == len(a)
      invariant forall p, q :: 0 <= p < q < i && q < len(b) ==> b[p] <= b[q]
      decreases len(b) - i
    {
      var j = i
      while j > 0 && b[j - 1] > b[j]
        invariant 0 <= j <= i < len(b)
        invariant len(b) == len(a)
        invariant forall p, q :: 0 <= p < q <= i && q != j ==> b[p] <= b[q]
        invariant j < i ==> b[j] <= b[j + 1]
        invariant forall p :: 0 <= p < j ==> forall q :: j < q <= i ==> b[p] <= b[q]
        decreases j
      {
        b = b[j - 1 := b[j]][j := b[j - 1]]
        j = j - 1
      }
      i = i + 1
    }
    return b
  }
locked: [[1, 12], [16, 19], [25, 33]]
solution: |
  pred sorted(a: [int]) {
    forall i, j :: 0 <= i < j < len(a) ==> a[i] <= a[j]
  }

  fn insertion_sort(a: [int]) -> [int]
    ensures len(result) == len(a)
    ensures sorted(result)
    ensures multiset(result) == multiset(a)
  {
    var b = a
    var i = 1
    while i < len(b)
      invariant 1 <= i
      invariant len(b) == len(a)
      invariant multiset(b) == multiset(a)
      invariant forall p, q :: 0 <= p < q < i && q < len(b) ==> b[p] <= b[q]
      decreases len(b) - i
    {
      var j = i
      while j > 0 && b[j - 1] > b[j]
        invariant 0 <= j <= i < len(b)
        invariant len(b) == len(a)
        invariant multiset(b) == multiset(a)
        invariant forall p, q :: 0 <= p < q <= i && q != j ==> b[p] <= b[q]
        invariant j < i ==> b[j] <= b[j + 1]
        invariant forall p :: 0 <= p < j ==> forall q :: j < q <= i ==> b[p] <= b[q]
        decreases j
      {
        b = b[j - 1 := b[j]][j := b[j - 1]]
        j = j - 1
      }
      i = i + 1
    }
    return b
  }
hints:
  - A loop invariant is all the verifier knows about the variables a loop modifies. Neither loop says anything about which elements b holds.
  - Each swap preserves the multiset of elements. Say so in both loops.
success: 'Swaps never create or destroy an element, so the multiset is an invariant of both loops, and the verifier proves each swap preserves it by counting: a swap adds one occurrence of each value where it removes one.'
lines: 33
```

:::bridge{course=proofs-are-programs chapter=sorting}
*Proofs Are Programs* proves a sort correct in a proof assistant, with the same two halves: the output is sorted and a permutation of the input. There the proofs are written out as terms; here the solver finds them, guided by the invariants.
:::

## How a solver uses a quantifier

A formula with a quantifier, such as ∀k. 0 ≤ k < n ⟹ a[k] ≥ 0, is a promise about infinitely many values. A solver cannot use all of them. It uses the quantifier the way a person does: it picks a few values of k that look relevant and **instantiates** the formula with them, adding a[i] ≥ 0 for a particular i. The question is which values.

The technique that SMT solvers use is **E-matching**, from Simplify, the prover behind ESC/Java.:cite[detlefs2005] Each quantifier has one or more **triggers**: patterns, such as `a[k]`, that must appear in the formula for an instance to be worth making. Whenever the solver's e-graph (chapter 12) contains a term matching the pattern, say `a[i + 1]`, it instantiates the quantifier with k = i + 1. The trigger keeps the solver from instantiating blindly: a fact about `a[k]` is only useful where some `a[...]` is mentioned.

Vouch picks triggers automatically, and you can write your own in braces: `forall y {f(y)} :: …`.

### Matching loops

Triggers can go wrong. Take a function f known only to drop by one at each step: ∀y. f(y) = f(y + 1) + 1, with trigger `f(y)`. Instantiating it for f(x) produces the term f(x + 1), which matches the trigger again, which produces f(x + 2), and so on forever. This is a **matching loop**. When the goal follows from a few instances, the solver finds them before the loop matters. When it does not, the solver keeps going until it hits its limit.

The proof debugger below shows every obligation of the code, and for each one the instances the solver made, round by round. Select the second lemma's obligation.

:::proof-debugger{title="A matching loop"}
```vouch
pure fn f(x: int) -> int

// Two instances are enough: f(x) = f(x + 1) + 1 = f(x + 2) + 2.
lemma two_steps(x: int)
  requires forall y {f(y)} :: f(y) == f(y + 1) + 1
  ensures f(x) == f(x + 2) + 2
{}

// Not provable (f could be y ↦ −y): the solver instantiates forever.
lemma never(x: int)
  requires forall y {f(y)} :: f(y) == f(y + 1) + 1
  ensures f(x) > 0
{}
```
:::

The first lemma needs two instances. The second is not provable, and the instance list shows the loop: x, then x + 1, then x + 2, one new instance per round, until the solver stops at its round limit and answers *unknown*. Matching loops are one of the main reasons verifiers time out, and the usual cures are better triggers or limiting how often a definition may be unfolded.

```quiz
q: 'A quantifier ∀k. a[k] ≥ 0 has the trigger a[k]. The formula mentions a[i] and a[j + 1], and nothing else involving a. Which instances will E-matching make?'
options:
  - text: k = i and k = j + 1.
    correct: true
    why: 'Each term matching the pattern a[…] gives one instance. Nothing else in the formula mentions a, so no other value of k is tried.'
  - text: k = 0, 1, 2, … up to a limit.
    why: 'That would be blind enumeration. Triggers exist to avoid it: only values that appear in matching terms are used.'
  - text: None until the solver finds a counterexample.
    why: 'Instances are made as soon as matching terms exist, before and during the search; they are how the solver finds that there is no counterexample.'
```

## Recursive definitions

`sorted` is a quantifier; a sum is a recursive function. Vouch's `pure fn` can be recursive, with a `decreases` clause that shows it terminates. The verifier turns the definition into an axiom with the function call as its trigger: whenever `sum(a, n)` appears, it may be unfolded once into `sum(a, n − 1) + a[n − 1]`. Unfolding produces a *limited* copy of the function that does not trigger the axiom again, so the definition cannot loop the way f did. The price is that the solver unfolds each call only one level, and anything that needs more is up to you.

## Lemmas: proofs as functions

A **lemma** is a function whose body is a proof. Its contract is the statement; calling it adds that statement, instantiated with the arguments, to what the caller knows. A lemma's body can call the lemma itself on smaller arguments, and a recursive call with a decreasing measure is exactly a proof by induction: the call is the induction hypothesis.

:::bridge{course=proofs-are-programs chapter=induction}
*Proofs Are Programs* develops the same idea from the other side: a proof by induction is a recursive function, and the recursion must terminate for the proof to mean anything. Vouch's `decreases` on a lemma is that termination check.
:::

The Ledger keeps account balances in an array, and its central property is that a transfer does not change the total. Updating one cell changes the sum by the difference between the new and the old value. Proving it needs induction on the length of the array.

```verify
id: quantifiers-ghosts-and-lemmas/sum-update
title: The sum-over-update lemma
prompt: |
  `sum_update` states how the sum of the first n elements changes when cell i is updated. The statement is right, but with an empty body the verifier cannot prove it: it unfolds `sum` only one level. Write the proof: a recursive call on a smaller n (the induction hypothesis), guarded so that it stops at the base case.
starter: |
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
  }
locked: [[1, 12]]
solution: |
  {
    if n > 0 {
      sum_update(a, n - 1, i, v)
    }
  }
hints:
  - For n = 0 both sums are 0, and the solver sees that by unfolding once. For n > 0, unfold sum(·, n) one level by hand and use the lemma for n − 1.
  - The body is one `if` and one recursive call.
success: 'The recursive call is the induction hypothesis for n − 1; the solver unfolds both sums once and does the arithmetic. The `decreases n` clause is the proof that the induction is well-founded.'
lines: 14
```

With the lemma, the Ledger's transfer can be shown to conserve money: call it once for each of the two updates.

:::workbench{title="Transfers conserve the total" minLines=30}
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

fn transfer(a: [int], from: int, to: int, amount: int) -> [int]
  requires 0 <= from < len(a) && 0 <= to < len(a) && from != to
  requires 0 <= amount <= a[from]
  ensures len(result) == len(a)
  ensures sum(result, len(result)) == sum(a, len(a))
{
  let b = a[from := a[from] - amount]
  sum_update(a, len(a), from, a[from] - amount)
  let c = b[to := b[to] + amount]
  sum_update(b, len(b), to, b[to] + amount)
  return c
}
```
:::

Delete the two lemma calls and the postcondition of `transfer` no longer verifies. Nothing about the program changed: the calls are proof steps, not computation.

## Ghost code

Lemma calls are one kind of **ghost code**: code that exists for the proof and is erased before the program runs. Vouch also has ghost variables (`ghost var`), which can record information the program does not need but the proof does, such as an earlier value or a count. The rules keep ghosts honest: ghost code may read the real variables, but it may not write them or influence anything the real program does, so erasing it cannot change what the program computes.

## Debugging a failed proof

When a proof fails, the verifier says which obligation and, if it can, gives a counterexample. Three situations are common:

1. **A real bug.** The counterexample replays: the interpreter fails on those inputs. Fix the code.
2. **A missing invariant or postcondition.** The counterexample does not replay. It is a state the proof cannot rule out because something it needs was never written down, as in chapter 18's counterexamples to induction or chapter 16's caller that saw only `max`'s contract.
3. **A missing proof step.** The solver answers *unknown*: it ran out of instances or time. The fact it needs is true but out of its reach, and a lemma call or an intermediate `assert` gives it the missing step.

For the second and third, the standard technique is **assert bisection**: add an `assert` halfway through the code, stating what you believe holds there. If the assertion fails, the problem is before it; if it holds and the postcondition still fails, the problem is after. Repeat until the failing step is one line, which is usually enough to see what the solver is missing. Use the debugger below: add `assert` statements to `transfer` without the lemma calls, and watch which ones prove.

:::proof-debugger{title="Where does the proof break?"}
```vouch
pure fn sum(a: [int], n: int) -> int
  requires 0 <= n <= len(a)
  decreases n
{
  if n == 0 { 0 } else { sum(a, n - 1) + a[n - 1] }
}

fn transfer(a: [int], from: int, to: int, amount: int) -> [int]
  requires 0 <= from < len(a) && 0 <= to < len(a) && from != to
  requires 0 <= amount <= a[from]
  ensures len(result) == len(a)
  ensures sum(result, len(result)) == sum(a, len(a))
{
  let b = a[from := a[from] - amount]
  let c = b[to := b[to] + amount]
  return c
}
```
:::

::museum{exhibit=timsort-2015}

In 2015, Stijn de Gouw and colleagues tried to verify the sort used by OpenJDK for objects, TimSort, with the KeY verifier. TimSort keeps a stack of sorted runs and relies on an invariant about their lengths. Writing that invariant down for the proof showed that the code did not always maintain it, so that the stack could overflow on large, specially built inputs and the sort could throw an exception.:cite[degouw2015] Debugging the failed proof found the bug.

:::history
**Quantifiers in automated provers.** Simplify, built by David Detlefs, Greg Nelson and James Saxe for the Extended Static Checker projects, handled quantifiers with triggers and E-matching in a prover that otherwise decided ground formulas; its 2005 journal paper describes the design and its matching heuristics.:cite[detlefs2005] Modern SMT solvers kept the approach. The TimSort episode is one of several where the attempt to state an invariant precisely, not the solver, was what found the bug.:cite[degouw2015]
:::

:::hood
**What the debugger shows.** The course's solver (`src/lib/fv/smt/solver.ts`, with E-matching in `src/lib/fv/smt/quant.ts`) records every quantifier instance it makes and the round it was made in; the debugger groups them by quantifier. Instances are made in rounds: after each round the SAT search runs again with the new instances as clauses. A recursive function f is axiomatised as f(x) = body with recursive calls to a limited copy f′, plus f(x) = f′(x), so that each appearance of f can be unfolded once and no more.
:::

:::proved
**What did we prove?** Insertion sort returns a sorted permutation of its input, for arrays of every length. `transfer` conserves the sum, assuming the lemma, which is itself proved by induction. When a quantified proof fails with *unknown*, the solver has not shown that the goal is false; it has run out of instances. That is why a failed quantified proof usually needs a person: to supply the instance (a lemma call, an assertion) that the triggers did not find.
:::

## What comes next

Every array in this chapter was a value: `a[i := v]` is a new array. Real data structures hide their representation behind operations. [Chapter 20](/chapters/data-abstraction/) verifies a data structure against an abstract specification: representation invariants, abstraction functions, and the simulation square.

## Further reading

- Detlefs, Nelson and Saxe's paper on Simplify explains E-matching and triggers in detail.:cite[detlefs2005]
- De Gouw and colleagues' paper tells the TimSort story, including the inputs that break it.:cite[degouw2015]
