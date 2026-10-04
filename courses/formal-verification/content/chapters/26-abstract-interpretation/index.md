---
number: 26
title: Abstract interpretation
summary: 'Run the program on descriptions of sets of values instead of values, and every loop finishes in a few steps. Signs and intervals, joins at the end of a branch, fixpoints at a loop head, widening to make sure the iteration stops, and the price: alarms that may be false. Ariane 5 and Heartbleed, re-enacted.'
duration: About 1 hour 10 minutes
---

Everything in Parts IV and V asked for something: a contract, an invariant, a bound. The tools then checked exactly that, and said *unknown* when they could not. Part VI changes the deal. An **abstract interpreter** asks for nothing. It runs the program on descriptions of sets of states (*x is between 0 and 10*, *y is positive*) instead of on states, finishes in a predictable time, and reports every operation that might fail. It never misses a failure. The price is that some of its reports, called **alarms**, are about failures that cannot happen. This chapter builds one and measures that price.

## Abstract values

Suppose all you track about each integer variable is its sign: negative, zero, positive, or a combination. Multiplying two positive numbers gives a positive number; adding a positive and a negative one gives anything. Those rules are enough to show that `10 / (x * x)` never divides by zero when `x > 0`, without knowing x.

Signs are an **abstract domain**: a set of abstract values, each standing for a set of concrete ones, with an operation on abstract values for each operation of the program. The rules must be **sound**: the abstract result of an operation contains every concrete result it could stand for. They need not be exact, and usually are not: the sign of a positive plus a negative is "anything", although for the particular numbers it is one of the three.

**Intervals** are a more precise domain: each variable is bounded below and above, [lo, hi], where either bound may be infinite. Adding [0, 10] and [1, 5] gives [1, 15]; multiplying [−2, 3] by [4, 5] gives [−10, 15]. A comparison narrows: after `if x < 10`, the then-branch knows that x is at most 9. At the end of an if, where the two branches meet, the two intervals are **joined**: the smallest interval containing both.

## Loops and fixpoints

Loops are where an abstract interpreter earns its keep. Run `i = 0; while i < n { i = i + 1 }` on intervals: on entry, i is 0. After one pass through the body, i may be 0 (not yet started) or 1, so at the loop head i is in [0, 1]; after two passes, [0, 2]; and so on. The state at the loop head grows until one more pass adds nothing: a **fixpoint**, an interval that contains every value i can have at the head, however many times the loop runs. It is an invariant, found without anyone writing it.

For this loop, with n unbounded, the sequence [0, 1], [0, 2], [0, 3], … never stops growing. Patrick and Radhia Cousot's 1977 paper, which founded the subject, gave the remedy: **widening**.:cite[cousot1977] After a few iterations, a bound that is still moving jumps straight to infinity. The iteration then stops in a bounded number of steps, at an interval that is sound but coarse: [0, +∞]. A **narrowing** step afterwards can win back some precision, by running the body once more from the widened state and keeping finite bounds where they appear.

Here is the analyser. Each line shows the abstract state after it; the loop head (shaded) shows the fixpoint, and the panel below it lists the iterations. Click a variable's value to see it on a number line, against the values the function actually takes on sample inputs: the interval must contain every dot.

:::interval-analyser{title="Counting, on intervals" fn="count"}
```vouch
fn count(n: int) -> int
  requires n >= 0
{
  var i = 0
  while i < n {
    i = i + 1
  }
  return i
}
```
:::

Turn widening off. Without it the iteration does not stop: the analyser gives up after 40 iterations and says that what it shows is not a fixpoint. Then turn widening on and change when it starts: widening at once loses nothing here, and waiting longer only costs iterations. With other loops, waiting longer keeps bounds that widening would throw away.

```quiz
q: 'The loop `i = 0; while i < 100 { i = i + 1 }` is analysed with intervals and no widening. Roughly how many iterations does the loop head need before it stops growing?'
options:
  - text: One.
    why: 'After one pass, i is in [0, 1] at the head, and the next pass adds 2.'
  - text: About a hundred.
    correct: true
    why: 'Each pass adds one value: [0, 1], [0, 2], …, [0, 100]. Then one more pass adds nothing. With 100 replaced by n, unbounded, it would never stop, which is why widening exists.'
  - text: It never stops.
    why: 'Here the bound is the constant 100, so the chain is finite: it stops at [0, 100].'
```

:::bridge{course=compiler-backends chapter=liveness}
The fixpoint iteration is the same as the one a compiler uses for liveness: start from nothing, apply each block's transfer function, join where control-flow paths meet, repeat until nothing changes. Liveness needs no widening because its values come from a finite set, the program's variables; intervals over the integers do not.
:::

## Soundness means false alarms

The analyser checks every operation that can fail: assertions, divisions, array indices, conversions and the arithmetic of machine integers. A check is **proved** when the abstract state rules out the failure, and an **alarm** otherwise. Proved checks are guarantees, for every input. Alarms are not accusations: the abstract state may contain states that the program never reaches.

To triage an alarm, the course does what an engineer would: it looks for an input that really fails. It runs the function on boundary values (the ends of each type, 0, ±1, the constants in the code), then asks the symbolic executor of chapter 15 for an input that makes the same check fail. A failure the interpreter replays **confirms** the alarm. If none is found, the alarm stays **unconfirmed**: possibly false, possibly a failure that needs more loop iterations than were explored.

## Ariane 5, re-enacted

On 4 June 1996, about forty seconds after lift-off, the first Ariane 5 broke up. The inquiry board traced the failure to the inertial reference system. Software reused from Ariane 4 converted a 64-bit floating-point value, the horizontal bias, to a 16-bit signed integer. On Ariane 5's trajectory the value was larger than it had ever been on Ariane 4, the conversion failed, and the backup system, running the same software, had already failed the same way.:cite[lions1996]

The re-enactment below is much simpler: integers instead of floating point, and invented numbers. The precondition describes Ariane 4's flight envelope, within which the analyser proves that the conversion always fits. Change 20000 to 70000, for a faster rocket, and analyse again.

:::interval-analyser{title="The horizontal bias" fn="horizontal_bias"}
```vouch
// A re-enactment: the real code was Ada, with floating-point values.
fn horizontal_bias(hv: i32) -> i16
  requires 0 <= hv <= 20000   // the envelope the software was designed for
{
  let bh = hv / 2
  return bh as i16
}
```
:::

With the new envelope, the conversion check becomes an alarm, and triage confirms it: an input near the top of the envelope makes the interpreter fail at the conversion. The analysis did not need to know about rockets. It needed the precondition, and the precondition is exactly what changed between the two launchers.

## Heartbleed, re-enacted

In 2014 a bug called Heartbleed was found in OpenSSL's heartbeat handler. A heartbeat request carries some bytes and a length field, and the reply echoes the bytes. The handler copied as many bytes as the length field claimed, not as many as the request contained, so a request that lied about its length received the server's memory beyond it.:cite[durumeric2014] Here is the same mistake over a sequence of integers:

:::interval-analyser{title="A heartbeat handler" fn="heartbeat"}
```vouch
fn heartbeat(request: [int], claimed: int) -> [int]
  requires claimed >= 0
{
  var reply: [int] = []
  var i = 0
  while i < claimed {
    reply = reply ++ [request[i]]
    i = i + 1
  }
  return reply
}
```
:::

The index check is an alarm, and triage confirms it with a request that is shorter than it claims. Now fix the handler: add, before the loop,

```vouch
  if claimed > len(request) {
    return []
  }
```

and analyse again. The bug is gone, but the alarm stays, unconfirmed. At the loop head the analyser knows that i is between 0 and +∞, and that the request's length is at least 0; what it would need is the relation i < len(request), and an interval, one variable at a time, cannot express a relation between two variables. That is a **false alarm**, the characteristic cost of abstract interpretation. [Chapter 27](/chapters/better-abstractions/) removes this one with a domain that tracks relations.

```quiz
q: 'An analyser reports no alarm for a function. What does that guarantee?'
options:
  - text: The function is correct.
    why: 'Only the checks the analyser makes are covered: run-time errors, here. Whether the function computes the right result is a separate question, for a specification and a verifier.'
  - text: None of the checked operations can fail, for any input that satisfies the precondition.
    correct: true
    why: 'The abstract states contain every reachable state, so a check proved on them holds on every run. That is soundness.'
  - text: The function was tested on enough inputs.
    why: 'No input was run to obtain the result. The sample runs in the widget only illustrate it.'
```

## The Ledger's fees

The Ledger charges a fee on each transfer: the amount times a rate in basis points (hundredths of a per cent), divided by 10000. Amounts and rates are 32-bit unsigned integers. The analyser finds an alarm on the multiplication, and triage confirms it: a large amount times a large rate overflows. Add a precondition that bounds the amount (the Ledger can refuse transfers above some limit) so that every check is proved. What is the largest limit that works?

:::interval-analyser{title="Exercise: a fee that cannot overflow" fn="fee" goal="Every check is proved: with this limit on the amount, the fee computation cannot overflow for any rate up to 100%."}
```vouch
fn fee(amount: u32, rate_bp: u32) -> u32
  requires rate_bp <= 10000
{
  return amount * rate_bp / 10000
}
```
:::

:::history
**From compilers to rockets.** Gary Kildall's 1973 paper described program analyses for compiler optimisation as the iteration of transfer functions over a lattice until nothing changes.:cite[kildall1973] Patrick and Radhia Cousot's 1977 paper turned that iteration into a theory of sound approximation: any semantics, any abstract domain connected to it, fixpoints, and widening and narrowing to compute them in finite time.:cite[cousot1977] The theory reached industrial scale with Astrée, built by Bruno Blanchet, the Cousots and their colleagues, which in 2003 showed that an analyser designed for a family of safety-critical embedded programs could prove the absence of run-time errors in them with few or no false alarms.:cite[blanchet2003] *How we got here (Part VI)* tells the rest of the story, including what happened after the Ariane 5 inquiry.
:::

:::hood
**The course's analyser.** `src/lib/fv/absint/analyse.ts` interprets a function's syntax directly: an if joins its branches, a loop iterates from its entry state, widening after a delay (2 iterations by default) and narrowing once, and records each loop-head state for the panel. A second pass, with every loop head fixed at its final state, makes the checks. The domains are in `domain.ts` (signs, intervals) and `octagon.ts`; interval arithmetic, in `interval.ts`, is tested for soundness against every pair of values in small random intervals. Triage (`triage.ts`) runs boundary inputs through the interpreter, then the symbolic executor of chapter 15; only a failure the interpreter replays counts as confirmed.
:::

:::proved
**What did we prove?** For each proved check: the operation cannot fail, for any input satisfying the precondition, in the analysed function. Nothing about the function's result. The Ariane and Heartbleed functions are re-enactments, much smaller than the code they stand for; the original errors are documented in the cited reports.
:::

## What comes next

Intervals forget every relation between variables. [Chapter 27](/chapters/better-abstractions/) keeps some of them (octagons, polyhedra), and then abstracts a program by the truth of a few predicates, refining them automatically when a counterexample turns out to be spurious.

## Further reading

- The Cousots' 1977 paper introduced abstract interpretation, widening and narrowing.:cite[cousot1977]
- Blanchet and colleagues' paper describes the design of Astrée.:cite[blanchet2003]
- The Ariane 5 inquiry board's report is short and readable.:cite[lions1996]
