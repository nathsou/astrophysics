---
number: 18
title: Loop invariants and termination
summary: 'The missing piece of program proofs. What an invariant must do (the three lights), why holding in every reachable state is not enough, counterexamples to induction and how to use them, heuristics for finding invariants, and termination measures, with the Zune freeze as the cautionary tale. Binary search and the Dutch national flag, fully verified.'
duration: About 1 hour 30 minutes
---

Every loop in chapter 17 came with its invariant already written. That was the easy part of the story. A loop runs an unknown number of times, so a verifier cannot follow it; it needs one statement that is true at the top of every iteration, the **loop invariant**, and in all but the simplest loops someone has to write it. This chapter is about finding invariants, checking them, and repairing them when the verifier says no.

## What an invariant must do

An invariant I for a loop `while c { body }` has three jobs. The verifier checks each one separately, and the course shows them as three lights:

1. **It holds on entry.** The precondition and the code before the loop establish I.
2. **It is preserved.** From any state satisfying I and the loop condition c, one iteration of the body leads to a state satisfying I again.
3. **It is strong enough.** When the loop exits, I together with ¬c gives what the rest of the function needs.

The first two together make I **inductive**: true before the first iteration, and true after each iteration if it was true before. By induction on the number of iterations, it holds at the top of every iteration, however many there are. The third light is what makes it useful.

The workshop below has a loop that sums 1 + 2 + … + n. The blue dots are the states the loop actually reaches for n = 6, one per iteration, plotted as (i, s). The green region is where your invariant holds. The lights are the verifier's three checks.

:::invariant-workshop{x="i" y="s" params='{"n": 6}' invariant="0 <= i <= n" title="Sum to n" id="loop-invariants/sum"}
```vouch
fn sum_to(n: int) -> int
  requires n >= 0
  ensures 2 * result == n * (n + 1)
{
  var i = 0
  var s = 0
  while i < n {
    i = i + 1
    s = s + i
  }
  return s
}
```
:::

`0 <= i <= n` holds on entry and is preserved, but it is not strong enough: it says nothing about s, so at the exit the verifier cannot conclude anything about the result. Add a conjunct that relates s to i, and all three lights turn green.

```quiz
q: 'An invariant has green lights for entry and preservation, and a red light for "strong enough". What does that tell you?'
options:
  - text: The program is wrong.
    why: 'Not necessarily. The invariant is true and inductive, but it does not say enough to prove the postcondition. Most first attempts look like this.'
  - text: The invariant is true of every iteration but too weak; strengthen it with a fact about the variables the postcondition mentions.
    correct: true
    why: 'Entry and preservation make it a real invariant. The exit check fails because it does not carry enough information out of the loop. Add what the postcondition needs, in terms of the loop variables.'
  - text: The invariant is false in some reachable state.
    why: 'Then entry or preservation would fail (or both). A true but weak invariant passes those two checks.'
```

## True is not enough: counterexamples to induction

Now type `s >= i` into the workshop. Every blue dot is inside the green region: the sum of 1 to i is at least i, so the formula holds in every state the loop reaches. And yet the preservation light is red.

The verifier does not know which states are reachable. It checks preservation from *every* state that satisfies the invariant and the loop condition, and it found one where one iteration breaks it: a state with i negative, such as i = −2 and s = −2. Then i becomes −1 and s becomes −3, which is less than i. This state is never reached by a real run, but nothing in `s >= i` rules it out. It is a **counterexample to induction** (CTI): a pair of states, drawn in red, that shows the invariant is not inductive.

A CTI is not a bug in the program. It is a hole in the invariant, and the fix is to **strengthen** the invariant so that it excludes the CTI's first state. Here, add `0 <= i`. The general lesson is the most important one in this chapter: an invariant must be *inductive*, not merely true, and a property that is true is often not inductive on its own. Strengthening it is the normal way to find an invariant, and chapters 23 and 24 automate the same loop for whole systems.

## Where invariants come from

There is no algorithm that finds invariants in general: if there were, it would decide properties of programs that are known to be undecidable (chapter 29 returns to these limits). But there are good heuristics, and David Gries collected them in *The Science of Programming* (1981).:cite[gries1981] Two of the most useful:

- **Replace a constant by a variable.** The postcondition of `sum_to` is 2s = n(n + 1). The loop computes the sum one term at a time, and at the top of each iteration it has summed up to i rather than up to n. Replace n by i: 2s = i(i + 1). Together with 0 ≤ i ≤ n, that is the invariant.
- **Delete a conjunct.** If the postcondition is a conjunction P ∧ Q and the loop exits when Q becomes true, then P alone may be the invariant. Binary search is the standard example below.

A third source is the code itself: whatever the loop body keeps true about the variables it updates, such as a bound or a relation between two counters, usually belongs in the invariant.

```invariant
id: loop-invariants/power
title: Powers
prompt: |
  `power` computes bᵉ by repeated multiplication. Its invariant says only that k stays in range, which is not enough. Add the invariant that relates r to k. `pow` is the specification, defined recursively.
starter: |
  pure fn pow(b: int, e: int) -> int
    requires e >= 0
    decreases e
  {
    if e == 0 { 1 } else { b * pow(b, e - 1) }
  }

  fn power(b: int, e: int) -> int
    requires e >= 0
    ensures result == pow(b, e)
  {
    var r = 1
    var k = 0
    while k < e
      invariant 0 <= k <= e
      decreases e - k
    {
      r = r * b
      k = k + 1
    }
    return r
  }
locked: [[1, 14], [17, 23]]
solution: |
  pure fn pow(b: int, e: int) -> int
    requires e >= 0
    decreases e
  {
    if e == 0 { 1 } else { b * pow(b, e - 1) }
  }

  fn power(b: int, e: int) -> int
    requires e >= 0
    ensures result == pow(b, e)
  {
    var r = 1
    var k = 0
    while k < e
      invariant 0 <= k <= e
      invariant r == pow(b, k)
      decreases e - k
    {
      r = r * b
      k = k + 1
    }
    return r
  }
hints:
  - Replace a constant by a variable. The postcondition says r == pow(b, e) at the end; what is true after k iterations?
success: 'r == pow(b, k) is the postcondition with e replaced by k. The proof of preservation unfolds pow(b, k + 1) once into b · pow(b, k), using its definition.'
lines: 23
```

## Binary search, fully verified

Binary search keeps an interval [lo, hi) in which the key must be, if it is in the array at all. Its postcondition says: if the result is non-negative it points at the key; if it is negative, the key is nowhere in the array. *Delete a conjunct*: everything to the left of lo is smaller than the key, everything from hi on is larger, and the loop exits when the interval is empty, at which point the two facts cover the whole array.

```invariant
id: loop-invariants/binary-search
title: The invariant of binary search
prompt: |
  The loop below has only its bounds as an invariant, and the second postcondition (the key is absent when the result is −1) does not verify. Add the invariants that say what the loop knows about the elements outside [lo, hi).
starter: |
  pred sorted(a: [int]) {
    forall i, j :: 0 <= i < j < len(a) ==> a[i] <= a[j]
  }

  fn search(a: [int], key: int) -> int
    requires sorted(a)
    ensures 0 <= result ==> result < len(a) && a[result] == key
    ensures result < 0 ==> key !in a
  {
    var lo = 0
    var hi = len(a)
    while lo < hi
      invariant 0 <= lo <= hi <= len(a)
      decreases hi - lo
    {
      let mid = lo + (hi - lo) / 2
      if a[mid] < key {
        lo = mid + 1
      } else if key < a[mid] {
        hi = mid
      } else {
        return mid
      }
    }
    return -1
  }
locked: [[1, 12], [14, 25]]
solution: |
  pred sorted(a: [int]) {
    forall i, j :: 0 <= i < j < len(a) ==> a[i] <= a[j]
  }

  fn search(a: [int], key: int) -> int
    requires sorted(a)
    ensures 0 <= result ==> result < len(a) && a[result] == key
    ensures result < 0 ==> key !in a
  {
    var lo = 0
    var hi = len(a)
    while lo < hi
      invariant 0 <= lo <= hi <= len(a)
      invariant forall i :: 0 <= i < lo ==> a[i] < key
      invariant forall i :: hi <= i < len(a) ==> key < a[i]
      decreases hi - lo
    {
      let mid = lo + (hi - lo) / 2
      if a[mid] < key {
        lo = mid + 1
      } else if key < a[mid] {
        hi = mid
      } else {
        return mid
      }
    }
    return -1
  }
hints:
  - When the loop sets lo = mid + 1, what does it know about a[mid] and, because the array is sorted, about everything before it?
  - Two quantified invariants, one for each side of the interval.
success: 'This is the binary search of chapter 0, with mathematical integers (so the midpoint cannot overflow). The two quantified invariants are the deleted conjunct: together with lo == hi at the exit, they say the key is nowhere.'
lines: 25
```

## The Dutch national flag

Edsger Dijkstra used this problem in *A Discipline of Programming* (1976) to show how a program can be derived from its invariant.:cite[dijkstra1976] An array holds values 0, 1 and 2 (the three colours of the flag); rearrange it, in one pass and by swapping, so that all the 0s come first, then the 1s, then the 2s. The invariant divides the array into four regions: 0s before lo, 1s between lo and mid, unknown between mid and hi, and 2s from hi on. Each iteration shrinks the unknown region by one.

:::workbench{title="The Dutch national flag" minLines=30}
```vouch
fn dutch_flag(a: [int]) -> [int]
  requires forall k :: 0 <= k < len(a) ==> 0 <= a[k] <= 2
  ensures len(result) == len(a)
  ensures multiset(result) == multiset(a)
  ensures forall i, j :: 0 <= i < j < len(result) ==> result[i] <= result[j]
{
  var b = a
  var lo = 0
  var mid = 0
  var hi = len(a)
  while mid < hi
    invariant 0 <= lo <= mid <= hi <= len(b) && len(b) == len(a)
    invariant multiset(b) == multiset(a)
    invariant forall k :: 0 <= k < len(b) ==> 0 <= b[k] <= 2
    invariant forall k :: 0 <= k < lo ==> b[k] == 0
    invariant forall k :: lo <= k < mid ==> b[k] == 1
    invariant forall k :: hi <= k < len(b) ==> b[k] == 2
    decreases hi - mid
  {
    if b[mid] == 0 {
      b = b[lo := b[mid]][mid := b[lo]]
      lo = lo + 1
      mid = mid + 1
    } else if b[mid] == 1 {
      mid = mid + 1
    } else {
      hi = hi - 1
      b = b[mid := b[hi]][hi := b[mid]]
    }
  }
  return b
}
```
:::

All six invariants are needed. Delete the third one, which says every value is 0, 1 or 2: the invariant about the 2s is no longer preserved, because the verifier no longer knows that a value that is neither 0 nor 1 must be 2.

## Termination

Partial correctness says nothing about loops that never end. To prove termination, give each loop a **measure** with `decreases`: an integer expression that is never negative while the loop runs and gets strictly smaller at every iteration. A non-negative integer cannot decrease forever, so the loop stops. Floyd's 1967 paper already proved termination this way, with a measure that decreases around every loop.:cite[floyd1967]

On 31 December 2008, Microsoft's Zune 30 music players froze at start-up.:cite[cnn2008zune] The cause was a loop in the clock driver that converted a count of days since 1980 into a year.:cite[citp2009zune]

::museum{exhibit=zune-2008}

```verify
id: loop-invariants/zune
title: The Zune freeze
exhibit: zune-2008
prompt: |
  This is the loop as it was widely published, with the leap-year rule simplified to every fourth year (which is right for every year from 1901 to 2099). Its measure says `days` decreases. The verifier disagrees: read the state it reports, then fix the loop so that it always makes progress or stops. The function should still return the year that contains the given day.
starter: |
  pure fn leap(y: int) -> bool {
    y % 4 == 0
  }

  fn year_of(day: int) -> int
    requires day >= 1
  {
    var days = day
    var year = 1980
    while days > 365
      decreases days
    {
      if leap(year) {
        if days > 366 {
          days = days - 366
          year = year + 1
        }
      } else {
        days = days - 365
        year = year + 1
      }
    }
    return year
  }
locked: [[1, 11], [20, 25]]
solution: |
  pure fn leap(y: int) -> bool {
    y % 4 == 0
  }

  fn year_of(day: int) -> int
    requires day >= 1
  {
    var days = day
    var year = 1980
    while days > 365
      decreases days
    {
      if leap(year) {
        if days > 366 {
          days = days - 366
          year = year + 1
        } else {
          break
        }
      } else {
        days = days - 365
        year = year + 1
      }
    }
    return year
  }
hints:
  - The state the verifier shows has days = 366 in a leap year. What does the loop body do then?
  - On day 366 of a leap year the answer is the current year. Leave the loop.
success: 'With days = 366 in a leap year, the original loop could not stop (days was greater than 365) and could not make progress (days was not greater than 366). One `decreases` clause finds it; one `break` fixes it. Tests on any other day of the decade would have passed.'
lines: 25
```

:::history
**Invariants, from proofs to programs.** Floyd's 1967 paper introduced assertions that must hold every time control passes a point in a flowchart, which for a loop is an invariant, and Hoare's 1969 rule for `while` made the invariant the heart of the proof.:cite[floyd1967,hoare1969] Dijkstra and Gries turned the method around: write the invariant first and derive the loop from it, so that the proof and the program are developed together.:cite[dijkstra1976,gries1981] The binary searches that Bloch found broken in 2006 failed because of machine arithmetic, which a proof over mathematical integers does not model.:cite[bloch2006]
:::

:::hood
**Two views of the same checks.** The workshop uses the course's small weakest-precondition calculator (`src/lib/fv/wp/wp.ts`): entry is *precondition ⟹ wp(code before the loop, I)*, preservation is *I ∧ c ⟹ wp(body, I)*, and the exit check is *I ∧ ¬c ⟹ wp(code after the loop, postcondition)*. A counterexample to induction is a model of the negated preservation check; the workshop runs the body on it to draw the second state. The verifier behind the exercises (`src/lib/fv/vouch/vc/gen.ts`) makes the same checks, plus well-definedness, bounds and overflow, and names a counterexample to induction only when the solver produced a real model.
:::

:::proved
**What did we prove?** An inductive invariant that is strong enough proves the postcondition for every number of iterations, and a measure proves that the number is finite. Without a measure, a verified loop is only partially correct, and the badge lists the assumption. Invariants are part of the proof, not of the specification: a wrong invariant cannot make a wrong program verify, it can only make a right one fail to.
:::

## What comes next

The invariants in this chapter already use quantifiers: *for all i before lo*. [Chapter 19](/chapters/quantifiers-ghosts-and-lemmas/) is about specifications over whole arrays: sortedness and permutation, ghost code that exists only for the proof, lemmas, and what happens inside the solver when a quantifier is instantiated.

## Further reading

- Gries's *The Science of Programming* teaches the development of loops from their invariants, with many worked examples.:cite[gries1981]
- Felten's short post on the Zune bug walks through the loop.:cite[citp2009zune]
