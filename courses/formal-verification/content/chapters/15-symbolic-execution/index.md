---
number: 15
title: Symbolic execution
summary: 'Run a program on symbolic inputs. Every branch splits the run in two; each path carries a path condition; the solver decides which paths are feasible and produces a test input for each one. It finds the input that reaches a hard branch and the input that breaks a check, and it shows why loops need something more.'
duration: About 1 hour 15 minutes
---

A test runs a program on one input and learns about one path through it. Part III's solvers make a different kind of run possible: run the program on inputs that are *unknowns*, and keep track of what must be true of them for the run to go the way it goes. This is **symbolic execution**, proposed by James King in 1976.:cite[king1976] It is the bridge between this part and the next: it turns a program into formulas, one path at a time.

## Symbolic values and path conditions

Take a small function:

```vouch
fn classify(x: int, y: int) -> int {
  let d = x - y
  if d > 10 {
    if x < 0 {
      return 2
    }
    return 1
  }
  return 0
}
```

Run it with x and y unknown, call them X and Y. The first statement gives d the *symbolic value* X − Y. At the first `if`, the run cannot know which way to go, so it goes both ways. Down the *then* side it records the **path condition** X − Y > 10; down the *else* side, X − Y ≤ 10. At the second `if`, the *then* side splits again: X − Y > 10 ∧ X < 0 returns 2, X − Y > 10 ∧ X ≥ 0 returns 1.

Each path condition describes exactly the inputs that take that path. Ask a solver for a model of it, and you have a **test input** for the path: X = −20, Y = −40 returns 2. If a path condition is unsatisfiable, the path is **infeasible**: no input takes it, and the explorer stops there.

```quiz
q: 'In classify, what is the path condition of the path that returns 0?'
options:
  - text: X − Y ≤ 10
    correct: true
    why: 'The path takes the else side of the first if and nothing else; X < 0 is never tested on it.'
  - text: X − Y ≤ 10 ∧ X ≥ 0
    why: 'The test x < 0 is inside the first branch. A path that never reaches it adds nothing about X.'
  - text: X − Y ≤ 10 ∨ X ≥ 0
    why: 'A path condition is the conjunction of the decisions on one path; a disjunction would describe several paths at once.'
```

## The path tree

The explorer below executes a function symbolically, one node at a time. Each node is a branch decision; the edges are labelled T and F. Squares are finished paths, each with a test input the solver produced. The reference interpreter replays every test, and the listing marks in green the statements those replays reached. A cross is an infeasible direction.

The function guards a branch with an equation that random testing would essentially never satisfy. The solver satisfies it at once.

:::path-tree{title="A hard branch" fn="check_code"}
```vouch
fn check_code(code: int, salt: int) -> int
  requires 0 <= salt < 1000
{
  if code > 1000000 {
    if code * 3 + 7 == salt * 5 + 3000100 {
      assert salt != 432
      return 2
    }
    return 1
  }
  return 0
}
```
:::

Press *Explore all*. Three paths, three tests, every statement reached. The path through the assertion has two tests of a different kind. Its own test, *code = 1,000,031, salt = 0*, passes the assertion, because the explorer asks for an input that satisfies every check on the path. Then each check gets a query of its own: *is there an input that reaches this check and fails it?* For the assertion, the answer is code = 1,000,751 and salt = 432, and the interpreter confirms that the assertion fails on it.

Be the solver first. This function returns `true` for exactly one input:

```vouch
fn lock(x: int) -> bool
  requires 0 <= x < 1000
{
  if x * 7 % 1000 == 3 {
    return true
  }
  return false
}
```

```numeric
id: symbolic-execution/lock
title: Pick the lock
prompt: |
  Which x reaches `return true` in `lock`? A random test finds it with probability 1 in 1,000 per try. You can do better with a little modular arithmetic.
answer: 429
tolerance: 0
explain: '7 × 143 = 1001, which is 1 modulo 1000, so multiplying by 143 undoes multiplying by 7: x = 3 × 143 = 429, and 7 × 429 = 3003 leaves 3. The explorer finds it with one query: the solver turns `x * 7 % 1000` into a quotient q and a remainder r with 7x = 1000q + r and 0 ≤ r < 1000, all linear.'
hints:
  - You need 7x to end in 003. Which multiple of 7 is one more than a multiple of 1000?
```

## Every check, on every path

The tree is not only a test generator. Everything the interpreter checks at run time becomes a question on each path: an array index in bounds, a divisor not zero, a machine-integer operation that does not overflow, an assertion, the postcondition. Here is a function from every programming course:

:::path-tree{title="Absolute value" fn="abs"}
```vouch
fn abs(x: i32) -> i32
  ensures result >= 0
{
  if x < 0 {
    return -x
  }
  return x
}
```
:::

Both paths have passing tests, x = −1 and x = 0. But the negative path also has a failing check: for x = −2,147,483,648, the most negative 32-bit integer, `-x` does not fit in 32 bits. Two tests that cover every line and every branch would never have found it. One symbolic run did, because it asked the question for *all* inputs on that path.

## Path explosion

Each branch can double the number of paths. A function with n independent `if` statements in sequence has 2ⁿ paths:

:::path-tree{title="Four independent branches" fn="score"}
```vouch
fn score(a: int, b: int, c: int, d: int) -> int {
  var s = 0
  if a > 0 { s = s + 1 }
  if b > 0 { s = s + 2 }
  if c > 0 { s = s + 4 }
  if d > 0 { s = s + 8 }
  return s
}
```
:::

Sixteen paths for four branches, and the tests are what you would expect: one per combination of signs. Add a fifth `if` in the editor and there are 32. This is **path explosion**, and it is the central problem of symbolic execution. Real tools fight it. KLEE, for example, uses search heuristics to choose which path to extend next, and caches and simplifies its solver queries.:cite[cadar2008]

Merging is worth a second look. If the two paths of an `if` are merged at the join, a variable gets an *if-then-else* value (*s = if a > 0 then 1 else 0*) and one formula covers both paths. The number of formulas stays linear in the size of the program; the formulas grow instead. Part IV's verifier does exactly this, and chapter 17 shows the price.

```quiz
q: 'A function has 30 if statements in sequence, each testing a different input. A symbolic executor that does not merge paths needs how many solver queries to explore it completely, roughly?'
options:
  - text: About 30.
    why: 'That is the number of branches on one path. Every combination of directions is a separate path.'
  - text: About a billion.
    correct: true
    why: '2³⁰ is about 1.07 billion paths, and at least one query per path. Merging at the joins would need a handful of larger queries instead.'
  - text: Infinitely many.
    why: 'Without loops the tree is finite: 2³⁰ leaves.'
```

## Loops

A loop is a branch that repeats: each test of the condition splits the run in two again. With no bound on the number of iterations, the tree is infinite. The explorer unrolls each loop a fixed number of times; the path that would iterate once more is **cut** (the dashed circles).

Here is the binary search of chapter 0, written over the mathematical integers so that the midpoint cannot overflow. Its contract only claims that a returned index holds the key, so it holds whether or not the array is sorted, and the explorer is free to pick any array.

:::path-tree{title="Binary search, unrolled" fn="search" unroll=3}
```vouch
fn search(a: [int], key: int) -> int
  ensures result == -1 || (0 <= result < len(a) && a[result] == key)
{
  var lo = 0
  var hi = len(a)
  while lo < hi {
    let mid = lo + (hi - lo) / 2
    if a[mid] < key {
      lo = mid + 1
    } else if a[mid] > key {
      hi = mid
    } else {
      return mid
    }
  }
  return -1
}
```
:::

With 3 iterations unrolled, the tree has 22 paths and 8 cut nodes. Raise the bound to 4: 46 paths and 16 cuts. Every extra iteration roughly doubles the tree, and every bound leaves cut paths behind, because some array is long enough to need one more iteration. No finite unrolling covers every input. The tests are still valuable. But *for all inputs* needs a different idea: a statement about every iteration at once, the **loop invariant** of chapter 18.

:::bridge{course=compiler-backends chapter=cfg}
*SSA to Silicon* draws programs as control-flow graphs. A symbolic executor walks paths through that graph; a loop is a cycle, and the tree of paths through a cycle is infinite. The verifier of Part IV cuts each cycle at its loop header with an invariant.
:::

## Concrete and symbolic together

Symbolic execution needs a model of everything the program does: every library call, every system call, every instruction. Real programs call code that no solver models. **Concolic testing** (concrete plus symbolic), introduced by DART in 2005, runs the program on a concrete input and records the symbolic path condition alongside.:cite[godefroid2005] When a branch involves something the solver cannot handle, the concrete value stands in for it. To explore a new path, negate one decision of the recorded path, solve, and run again with the new input.

KLEE (2008) applied symbolic execution to compiled systems code. Run on all 89 stand-alone programs of GNU Coreutils, it generated tests whose line coverage beat the developers' own test suite, and it found serious bugs, including three in Coreutils that had been missed for over 15 years.:cite[cadar2008] SAGE (2008) applied the concolic idea to file parsers in large Windows applications, a technique its authors called *whitebox fuzzing*.:cite[godefroid2008]

:::history
**An idea that waited for its solver.** King's 1976 paper described EFFIGY, an interactive symbolic executor for a simple PL/I-style language, with debugging features, a simple test manager and a program verifier in the same system.:cite[king1976] The idea was sound, but path conditions over integers and arrays needed decision procedures that did not yet exist at the speed required. When fast SMT solvers arrived in the 2000s, symbolic execution came back as DART, KLEE and SAGE.:cite[godefroid2005,cadar2008,godefroid2008] *How we got here (Part III)* tells the story.
:::

:::hood
**The course's symbolic executor.** `src/lib/fv/symex/symex.ts` reuses the verification-condition generator of Part IV (`src/lib/fv/vouch/vc/gen.ts`) with a *fork oracle*: at each branch, instead of exploring both sides and merging them, the generator asks the oracle which way to go. The explorer re-executes the function from the start for each node, following the recorded decisions, and stops at the first new branch; the solver decides which directions are feasible. Re-execution is simpler than saving and restoring states, and fast enough for small functions. Every test is replayed by the reference interpreter (`src/lib/fv/vouch/interp/`), and the coverage shown is the interpreter's, not the explorer's prediction. Branches inside expressions (`&&`, `||`, `if … else …` as a value) are not forked; they stay inside the formulas.
:::

:::proved
**What did we prove?** Each test proves that its path is feasible, and the replay confirms what it does. Each failing check is a real bug, replayed. A tree with no cut nodes and no unknown nodes covers every path, so the absence of failing checks then means the function is correct for all inputs, with no invariants needed. A tree with cut nodes proves nothing about the paths it cut: it is a bounded result, like chapter 10's bounded model checking, and the explorer says so.
:::

## What comes next

Part III ends here. The solvers can decide formulas about equality, arithmetic, bits and arrays, and symbolic execution turns a program into such formulas, path by path, until loops get in the way. [Part IV](/parts/prove-programs/) turns a whole program, loops included, into a finite set of formulas: the verification conditions. Its first step is to say what a program should do: [chapter 16](/chapters/specifications-and-contracts/), specifications and contracts.

## Further reading

- King's 1976 paper is short and still a clear statement of the idea.:cite[king1976]
- The KLEE paper is a good account of what it takes to make symbolic execution work on real code.:cite[cadar2008]
