---
number: 10
title: Unrolling time
summary: 'Part I''s explorer stores every state it visits. Bounded model checking stores none: it copies the transition relation k times into one formula and asks a SAT solver for a run that breaks the property at step k. Hardware as a transition system, counterexamples as waveforms, and equivalence checking with a miter, where a million random tests miss a bug that a solver finds in milliseconds.'
duration: About 1 hour 30 minutes
---

The explorer of Part I works one state at a time. It keeps a set of every state it has seen, and that set is its limit: a system with two 16-bit registers has four billion states, and a system that reads a 32-bit input at every step has four billion successors per state. Hardware is full of such systems. By the late 1990s, model checking of hardware had moved from explicit sets to BDDs (chapter 11), which represent sets of states symbolically, and was running into their limits too.

In 1999 Biere, Cimatti, Clarke and Zhu proposed something cruder and, as it turned out, far more robust: forget about sets of states. To find a bug within k steps, write one propositional formula that is satisfiable exactly when such a bug exists, and hand it to a SAT solver.:cite[biere1999] They called it **bounded model checking** (BMC). This chapter builds it on the course's SAT solver.

## The unrolling

Take a system with state variables S. Chapter 6 showed how to describe a set of values with Boolean variables; do it for the whole state. Then three formulas describe the system:

- I(S): S is an initial state.
- T(S, S′): S′ follows from S by one step (some action, or some process step).
- P(S): the invariant holds in S.

Make k + 1 copies of the state variables, S₀ to S_k, one per time step, and write:

$$
I(S_0) \land T(S_0, S_1) \land T(S_1, S_2) \land \dots \land T(S_{k-1}, S_k) \land \lnot P(S_k)
$$

A satisfying assignment is a run of k steps from an initial state to a state where the invariant fails: a counterexample, with every intermediate state spelled out. If the formula is unsatisfiable, no run of exactly k steps breaks the invariant. Try k = 0, 1, 2, … in turn, and the first satisfiable bound gives a shortest counterexample, as breadth-first search did.

The course's encoder (`src/lib/fv/bmc/symbolic.ts`) builds I and T from a Vouch system by **symbolic execution** of its actions and process steps. Every variable of a finite type becomes one Boolean per possible value (the one-hot encoding of chapter 6), sets and functions become one Boolean per element, and bit-vectors become one Boolean per bit, with additions and comparisons as circuits. An action's body is executed on symbolic values: an `if` splits it into two paths with their path conditions, and the step formula says that one of the paths is taken. Every counterexample is then **replayed** by the reference runtime, step by step, before it is shown.

Here is chapter 1's water-jug puzzle again. Run bounded model checking on it.

:::bmc-lab{title="Die Hard, unrolled" maxK=8}
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
:::

Each row is one bound: the clauses the formula has so far (each bound adds one copy of T) and the time to solve it. Bounds 0 to 5 are unsatisfiable, and bound 6 finds the solution of the puzzle, the same six steps the explorer found. The waveform below the badge is the run: one row per variable, one column per step, values written where they change.

```predict
q: 'Bound 5 is unsatisfiable. What does that establish?'
options:
  - text: The big jug never holds 4 gallons.
    why: 'Only runs of exactly 5 steps were considered (and, by the earlier bounds, of 0 to 4). Bound 6 is satisfiable.'
  - text: No run of 5 steps or fewer reaches a state with 4 gallons in the big jug.
    correct: true
    why: 'Each bound k asks about runs of exactly k steps, and bounds 0 to 5 together cover every run of up to 5 steps. That is all a bounded check says.'
  - text: Nothing, since the solver may have missed a run.
    why: 'Within the bound the search is complete: UNSAT means no assignment satisfies the formula, so no run of that length exists.'
```

:::programmer
**One solver, many bounds.** The lab does not start from scratch at each bound. It keeps one SAT solver, adds a copy of T for each new step, and asks about ¬P(S_k) through an *assumption*: a fresh literal a_k, the clause (¬a_k ∨ ¬P(S_k)), and a call to the solver that assumes a_k is true. When the answer is UNSAT, the clause ¬a_k switches that question off for good. Everything the solver learned at earlier bounds stays valid and is reused. This is *incremental* SAT, and every production BMC tool works this way.
:::

## Deep in data, shallow in time

The water jugs have 16 reachable states; the explorer handles them instantly. BMC pays off when the state space is enormous but the bug is close to the start. A checksum over 16-bit words is the typical case: three steps deep, but each step reads any of 65,536 words.

:::bmc-lab{title="A 16-bit checksum" maxK=4 race=true}
```vouch
// A checksum over 16-bit words: rotate left by 5, then XOR in the next word.
// Can three words make the checksum zero?
system Checksum {
  var acc: bv16 = 0x1d0f
  var n: 0..4 = 0

  action feed(word: bv16) when n < 3 {
    acc = ((acc << 5) | (acc >> 11)) ^ word
    n = n + 1
  }

  invariant never_zero: n < 2 || acc != 0
}
```
:::

The solver finds two words that cancel the checksum in a few milliseconds. The explorer has to enumerate the 65,536 values of `word` at every step: press **Race the explorer** to compare (it is given four seconds). The formula, by contrast, treats `word` as sixteen unknown bits per step, and the rotation and XOR as small circuits over them: the size of the formula grows with the number of steps, not with the number of values.

The comparison runs the other way too. On a system with a few thousand reachable states and arithmetic on small ranges, the explorer is often faster than the course's BMC, because one-hot arithmetic makes large formulas (each sum is a case split over pairs of values). Production BMC tools encode every integer in binary and every operation as a circuit, which is what the bit-vector path of the course's encoder does.

## How deep is deep enough?

Bounded model checking finds bugs; on its own it never proves that there are none. If no counterexample of length up to k exists, a counterexample of length k + 1 still might.

There is a bound beyond which nothing new can happen. If every reachable state can be reached in at most d steps (d is the system's **diameter**), then checking up to d is a proof. Computing d exactly is as hard as the original problem, but Biere and his colleagues gave a bound that can itself be checked with SAT: the **recurrence diameter**, the length of the longest run that never repeats a state. Any state reachable at all is reachable by a run without repetitions, so if no run of length k + 1 can avoid repeating a state, checking up to k is complete.:cite[biere1999] For most systems the recurrence diameter is far too large to reach. Chapter 23 shows a better way to turn BMC into a proof: **k-induction**, which asks the solver to prove that k good steps always lead to a good next step.

## Hardware as a transition system

A synchronous circuit is a transition system by construction. Its **registers** (flip-flops) are the state; the **combinational logic** between them computes the next state from the current one and the inputs; the **clock** is the step. BMC on hardware unrolls exactly the way the lab does, and the counterexample comes out the way hardware engineers already read simulations: as a waveform.

:::bridge{course=digital-circuits chapter=registers-and-counters}
Registers, counters and shift registers, the state of a synchronous circuit, are built in *Digital Circuits from First Principles*. Each clock tick is one step of a transition system, and one copy of T in a BMC formula.
:::

## Equivalence checking: the miter

The most widely used formal method in chip design asks a simpler question than BMC: are two circuits the same function? A designer writes a register-transfer description; synthesis tools turn it into gates, then optimise, retime and rewrite those gates many times. After each transformation, the new netlist must compute exactly what the old one did.

The construction that turns this into SAT is the **miter**, named by Daniel Brand at IBM in 1993:cite[brand1993] feed the same input variables to both circuits, XOR each pair of corresponding outputs, and OR the XORs together. The miter's output is 1 exactly when the circuits disagree. Ask the SAT solver to make it 1: UNSAT means the circuits are equal on every input, and the DRAT proof certifies it; SAT gives an input on which they differ.

Below, a ripple-carry adder is checked against a carry-lookahead adder (4-bit blocks, and a second level of lookahead between blocks). The lookahead adder optionally has a planted bug: the carry into the top block forgets one product term, the one for a carry generated in block 0 and passed on by every block in between.

::miter-bench{id="unrolling-time/miter" caption="Random testing against the miter. With the bug planted, try 8 bits, then 32: the million random tests stop finding it, and the solver still finds it at once. Without the bug, the miter is UNSAT and the proof is checked."}

:::bridge{course=digital-circuits chapter=arithmetic}
Ripple-carry and carry-lookahead adders, generate and propagate signals, and why lookahead is faster, are the subject of *Digital Circuits*, chapter 14. The miter proves that the faster design computes the same sums.
:::

At 8 bits the planted bug shows up in about half of all random tests. At 32 bits it needs block 0 to produce a carry and six 4-bit blocks in a row to pass it on, about 1 in 36 million pairs: a million tests almost always pass. At 64 bits the odds are beyond any test campaign. The miter does not care about odds. It asks whether *any* input separates the circuits, and the solver's conflict analysis follows the carry chain to the one place where it breaks.

```quiz
q: 'The miter for two 32-bit adders is UNSAT, and the DRAT proof is checked. How many input pairs has that covered?'
options:
  - text: The pairs the solver tried before it gave up looking.
    why: 'A SAT solver does not try inputs one by one. UNSAT is a statement about every assignment, certified by the proof.'
  - text: All 2⁶⁴ pairs of 32-bit numbers.
    correct: true
    why: 'The miter is satisfiable exactly when some pair separates the circuits. UNSAT, with a checked proof, rules out every pair: about 1.8 × 10¹⁹ of them.'
  - text: About a million, the same as random testing, but faster.
    why: 'Random testing samples; the solver reasons. The proof covers every input, including the rare ones the planted bug lives in.'
```

## A toy Pentium bug

In 1994 a mathematician, Thomas Nicely, found that Intel's Pentium processor sometimes divided wrongly. The divider used SRT division, which produces several quotient bits per step by looking up the next quotient digit in a table indexed by the leading bits of the partial remainder and the divisor. Five entries of that table had been left out. Vaughan Pratt worked out that 1,738 pairs of single-precision operands give results wrong in some bit between the 14th and the 23rd, about one division in 40 billion at random.:cite[pratt1995,edelman1997] Intel replaced the chips and recorded a charge of $475 million.:cite[intel1995]

The divider below is a toy, much simpler than SRT: an 8-bit dividend, a 4-bit divisor normalised so its top bit is set (as floating-point mantissas are), two quotient bits per step, and a digit table with five cells never filled in. Like the Pentium's, the missing cells are at the edge of the table, reached only when the partial remainder is as large as it can be.

```model
id: unrolling-time/divider
title: Catch the missing table entries
prompt: |
  Write an invariant (one line, starting with `invariant`) that says the divider's answer is right once it has finished its four steps. It must be violated on the divider with the incomplete table and hold on the divider with the complete one. The explorer checks both.
starter: |
  invariant correct: true
cases:
  - name: The divider with five table entries missing
    expect: fails
    why: The search finds a dividend and a divisor that reach a missing cell. Read the trace's last step to see the wrong quotient digit.
    code: |
      system Divider {
        var n: 0..256       // the dividend: any 8-bit number
        var d: 8..16        // the divisor, normalised (top bit set)
        var r: int = 0      // the partial remainder
        var q: int = 0      // the quotient so far
        var i: 0..5 = 0     // steps taken

        // The next two bits of the dividend, from the top.
        pure fn pair(n: int, i: int) -> int {
          if i == 0 { n / 64 } else if i == 1 { (n / 16) % 4 } else if i == 2 { (n / 4) % 4 } else { n % 4 }
        }
        // Five cells of the digit table were never filled in.
        pure fn skipped(x: int, d: int) -> bool {
          (d == 9 && x == 35) || (d == 11 && x == 43) || (d == 12 && x == 47) || (d == 14 && x == 55) || (d == 15 && x == 59)
        }
        // The digit table: the largest k <= 3 with k * d <= x (except in the skipped cells).
        pure fn digit(x: int, d: int) -> int {
          if x >= 3 * d && !skipped(x, d) { 3 } else if x >= 2 * d { 2 } else if x >= d { 1 } else { 0 }
        }

        action step when i < 4 {
          let x = 4 * r + pair(n, i)
          let k = digit(x, d)
          r = x - k * d
          q = 4 * q + k
          i = i + 1
        }

        @model
      }
  - name: The divider with the complete table
    expect: holds
    why: Every one of the 2,048 dividend and divisor pairs gives the right quotient.
    code: |
      system Divider {
        var n: 0..256
        var d: 8..16
        var r: int = 0
        var q: int = 0
        var i: 0..5 = 0

        pure fn pair(n: int, i: int) -> int {
          if i == 0 { n / 64 } else if i == 1 { (n / 16) % 4 } else if i == 2 { (n / 4) % 4 } else { n % 4 }
        }
        pure fn digit(x: int, d: int) -> int {
          if x >= 3 * d { 3 } else if x >= 2 * d { 2 } else if x >= d { 1 } else { 0 }
        }

        action step when i < 4 {
          let x = 4 * r + pair(n, i)
          let k = digit(x, d)
          r = x - k * d
          q = 4 * q + k
          i = i + 1
        }

        @model
      }
solution: |
  invariant correct: i < 4 || q == n / d
hints:
  - The divider has finished when `i == 4`. Before that, `q` is only part of the quotient.
  - Integer division `n / d` gives the right answer to compare with.
success: 'The search finds an operand pair that walks into a missing cell, and the same property holds for all 2,048 operand pairs once the table is complete. A stronger invariant, `r < d`, catches the bug one step earlier: the moment the partial remainder grows too large.'
lines: 2
```

:::history
**After FDIV.** The Pentium episode is often cited as a turning point in industrial formal verification. Intel's engineers went on to apply formal methods to arithmetic units and, by 2009, reported verifying the execution engine of the Core i7 formally in place of most of its traditional simulation-based testing.:cite[kaivola2009] Today equivalence checking is a routine step of chip design, and SAT-based bounded model checking a standard way to search hardware designs for bugs.
:::

:::proved
**What did we prove?** A BMC counterexample is replayed by the reference runtime, so it is a real run of the system. "No violation up to bound k" covers every run of at most k steps, and nothing longer; the SAT answers at each bound are not separately certified here. A miter that is UNSAT, with a checked DRAT proof, proves that the two circuits, as encoded, compute the same function on every input; it trusts that the encoding of each gate is right.
:::

:::hood
**The course's BMC.** `src/lib/fv/bmc/symbolic.ts` turns a system into I, T and P by symbolic execution; `src/lib/fv/bmc/bmc.ts` unrolls it with one incremental solver and activation literals. Exactly-one constraints for one-hot variables use Sinz's sequential counter, with a linear number of clauses instead of the quadratic pairwise encoding.:cite[sinz2005] The tests run BMC and the explorer side by side on every example system and require the same verdicts and the same shortest counterexample lengths.
:::

## What comes next

BMC, like the explorer, can only say "nothing found up to here" on its own. [Chapter 11](/chapters/decision-diagrams/) (optional) returns to the other symbolic representation, BDDs, which can compute the whole reachable set and prove an invariant outright. Part III then leaves the Booleans behind: [Chapter 12](/chapters/equality-and-functions/) adds equality and functions to the solver.

## Further reading

- Biere, Cimatti, Clarke and Zhu's paper introduces BMC and its completeness bounds.:cite[biere1999]
- Pratt's and Edelman's papers explain the Pentium bug's mathematics, including why the missing entries were so rarely reached.:cite[pratt1995,edelman1997]
