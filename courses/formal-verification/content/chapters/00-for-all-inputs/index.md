---
number: 0
title: For all inputs
summary: A binary search that was broken for nine years, a random tester that cannot find the bug, and a verifier that finds it in a second. What it means to check a program for all inputs, and the four ways the course will do it.
duration: About 1 hour
---

In June 2006 Joshua Bloch, then at Google, wrote a blog post with a tabloid headline: *Extra, extra – read all about it: nearly all binary searches and mergesorts are broken*. The binary search he had written for Java's standard library, he explained, contained a bug. It had been reported to Sun "when it broke someone's program, after lying in wait for nine years or so". The same bug was in the binary search that Jon Bentley had proved correct, and then tested, in *Programming Pearls*, one of the best-known books on programming ever written.:cite[bloch2006]

The bug is one line:

```java title="Java, before 2006"
int mid = (low + high) / 2;
```

`low` and `high` are indices into the array, so each is at most the array's length. When the array has 2³⁰ elements or more, `low + high` can exceed the largest `int`, 2³¹ − 1. The addition overflows, `mid` becomes negative, and the next array access throws an exception. Arrays of a billion elements were rare in 1997 and commonplace by 2006.

::museum{exhibit=binary-search-2006}

The program had been read by experts, published with a proof, used by millions of programs and tested. None of that helped, because each of those checks looked at *some* of the program's behaviours: the arrays the testers thought of, the cases the proof's author considered, the machines of the time. The bug lived in the rest.

This course is about checking *all* of a program's behaviours: every input, every schedule of its threads, every order in which the network delivers its messages, every move an attacker can make. It is called formal verification. This chapter shows you what it looks like, what it can and cannot promise, and how the course is organised.

## A race between a tester and a verifier

Here is the binary search, in **Vouch**, the small language this course uses. It reads like a mainstream language with three additions. `requires` says what the function needs from its caller: the array is sorted, and not too long. `ensures` says what it promises in return: if it returns a non-negative index, the key is there; if it returns a negative number, the key is nowhere in the array. And each loop carries an `invariant`, a statement about the variables that is true every time the loop's condition is tested, plus a `decreases` measure that shows the loop ends.

To keep the numbers small, the indices `lo` and `hi` are 8-bit integers (`i8`, from −128 to 127), and arrays have at most 127 elements. The bug is the same as Java's, scaled down: `lo + hi` overflows an `i8` once the array has 65 elements or more and the search moves to the right.

```predict
q: 'A random tester generates sorted arrays and keys, runs the search, and checks the contract and every arithmetic operation at run time. Like most testers, it tries mostly small arrays, here up to 16 elements. How many tests does it need to find the overflow?'
options:
  - text: About a hundred.
    why: 'The bug is not rare among *large* arrays. But an array of 16 elements has indices below 16, so `lo + hi` stays below 32 and an `i8` cannot overflow.'
  - text: About a million.
    why: 'No number of tests is enough: with arrays of at most 16 elements, `lo + hi` is at most 30, well below 127.'
  - text: It never finds it.
    correct: true
    why: 'The failing inputs all have 65 elements or more. A tester that never generates them can run forever. Java''s testers were in the same position: their arrays never had a billion elements.'
```

Now race them. The tester runs the program on random sorted arrays, checking every contract and every arithmetic operation as it goes. The verifier asks whether *any* input can make *any* check fail. Start the race; then move the slider so that the tester also tries large arrays, and race again.

::bug-race{caption="The bug race. Left lane: random tests, run by the course's reference interpreter, with a histogram of the array lengths tried. Right lane: the verifier, which returns either a proof or a counterexample that the interpreter replays. Edit the code and race again."}

The verifier answers in a fraction of a second. It does not try arrays at random. It turns the question "is there an input that makes `lo + hi` overflow?" into a logical formula and hands it to a solver, which either proves that no such input exists or produces one. Here it produces one: a sorted array of 65 elements or more and a key larger than most of them, which drives the search far enough to the right. Before the result is shown, the course's interpreter runs the function on exactly that input and confirms that it fails. The badge says so: *counterexample replayed*.

The tester's result depends on where you tell it to look. With arrays of up to 16 elements it runs twenty thousand tests and finds nothing. With arrays of up to 127 it finds the bug, eventually, because you have told it where the bug is. The verifier needed no such hint.

Now fix the program. Bloch's fix computes the midpoint without adding the two indices: `lo + (hi - lo) / 2`. The difference `hi - lo` is never negative and never larger than the array, so nothing overflows. Change the midpoint line in the race's editor and start the race again. The tester still finds nothing, as before. The verifier now says *verified for all inputs*.

```verify
id: for-all-inputs/fix-the-midpoint
title: Fix the midpoint
exhibit: binary-search-2006
prompt: The highlighted program is the overflowing binary search. Change only the line that computes `mid` so that the search verifies. The other lines are locked.
starter: |
  pred sorted(a: [int]) {
    forall i, j :: 0 <= i < j < len(a) ==> a[i] <= a[j]
  }

  fn search(a: [int], key: int) -> (r: int)
    requires sorted(a)
    requires len(a) <= 127
    ensures 0 <= r ==> r < len(a) && a[r] == key
    ensures r < 0 ==> key !in a
  {
    var lo: i8 = 0
    var hi: i8 = len(a) as i8
    while lo < hi
      invariant 0 <= lo <= hi <= len(a)
      invariant forall i :: 0 <= i < lo ==> a[i] < key
      invariant forall i :: hi <= i < len(a) ==> key < a[i]
      decreases hi - lo
    {
      let mid = (lo + hi) / 2
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
locked: [[1, 18], [20, 29]]
solution: |
  let mid = lo + (hi - lo) / 2
hints:
  - The problem is the sum `lo + hi`, which can exceed 127 even though each index is at most 127.
  - The distance `hi - lo` is between 0 and the array's length. Halve the distance and add it to `lo`.
success: The badge now says *verified for all inputs*. Expand it to see what was checked and what the result rests on.
lines: 16
```

Expand the verified badge. It lists what the verifier checked. There are *proof obligations*: each loop invariant on entry and after an iteration, each postcondition at each `return`, each array index, each arithmetic operation on an `i8`, and the termination measure. It shows the **certificate**, the evidence for the result, and says that a separate checker has re-checked it. And it lists what the result *assumes*. Every verified result in the course comes with that last list, because no proof proves everything.

:::programmer
**A counterexample is a failing test case found for you.** The verifier's output for the broken search is a test: an array, a key, and the line that fails. You can paste it into your test suite. The difference from testing is how the input was found. A tester samples the input space; a verifier reasons about all of it at once, and when the reasoning fails it produces a witness.
:::

## Testing, and the space it cannot cover

Edsger Dijkstra put the limit of testing in one sentence in 1970: "Program testing can be used to show the presence of bugs, but never to show their absence!":cite[dijkstra1970] The function above takes an array of up to 127 integers and a key. Even if each integer were a single byte, there would be more inputs than atoms in the observable universe. Testing samples that space. Good testers sample it cleverly, with small cases, edge cases, random cases and cases that cover every branch, and testing finds most of the bugs that are found in practice. But a sample is a sample, and a bug that needs an input nobody sampled survives.

Inputs are not only arguments. A program with two threads behaves differently depending on which thread runs first, and the scheduler is an input you do not control. A distributed system behaves differently depending on which messages the network loses, delays or duplicates, and the network is an input too. A security protocol has to work whatever an attacker sends, so the attacker's choices are inputs. Each of these spaces is enormous, and in each of them the dangerous behaviours tend to be rare: a race that needs one thread to be preempted between two particular instructions, a message lost at one particular moment. Part I of the course is about these inputs.

:::definition
**Formal verification** is checking that a system meets a precise specification for *all* of its behaviours: every input, every interleaving of its threads, every order of its messages, every move of an adversary, within a stated model of the system and its environment. The result is either a proof that no behaviour violates the specification, or a behaviour that does.
:::

Two phrases in that definition matter. *A precise specification*: the verifier checks the contract you wrote, not the one you meant, so writing specifications is a skill the course teaches (Chapter 16). *A stated model*: the verifier reasons about the program as the language defines it, the machine as the model describes it, the network as you allowed it to behave. Chapter 29 is about the gap between the model and the world.

## Four ways to check everything

How can a program check infinitely many inputs in finite time? There are four strategies, and each part of the course is built on one of them.

**Enumerate.** If the system has finitely many states, visit them all. A lock with two threads, a protocol with three participants, a puzzle: these have thousands or millions of states, and a computer can list millions of states per second. This is *explicit-state model checking*, the subject of Part I. It is complete for the instance you give it, and says nothing about bigger instances. The badge says *all 1,204 states of 3 processes*.

**Encode.** Turn the question into a formula of logic and let a solver search for a solution: a SAT solver for formulas over Booleans, an SMT solver for formulas over integers, arrays and functions. "Is there an input that makes `lo + hi` overflow?" becomes "is this formula satisfiable?". Solvers do not enumerate. They learn from failed attempts, and they handle problems with millions of variables. This is Parts II and III.

**Generalise.** Find a statement that is true at the start, preserved by every step, and strong enough to imply what you want. Then you have a proof for all executions, however long. The loop invariants in the binary search are such statements, and the verifier only checks that each one is preserved by a single arbitrary iteration. This is *deductive verification* (Part IV) and *inductive invariants* (Part V), and it is the idea that runs through the whole course: **find the invariant**.

**Approximate.** Compute, for every point of the program, a simple description that covers all the values that can occur there, such as "`x` is between 0 and 100". The description over-approximates: it may include values that never occur, so it can raise false alarms, but it never misses a real one. This is *abstract interpretation* (Part VI). It needs no annotations and runs on millions of lines.

```predict
q: 'Which strategy is the verifier using when it proves the binary search?'
options:
  - text: Enumerate. It tries every array.
    why: 'There are far too many arrays: more than 2¹⁰⁰⁰ of length 127 even with one-byte values. The verifier never lists them.'
  - text: Encode and generalise.
    correct: true
    why: 'The loop invariants generalise (they hold for every iteration), and each check they lead to is encoded as a formula for an SMT solver. Most program verifiers combine the two.'
  - text: Approximate.
    why: 'An abstract interpreter could prove the absence of overflow here, but it would not prove that the search returns the right index; that needs the invariants about the array contents.'
```

The strategies differ in what they promise, and the course never lets you forget the difference. Every result is reported with a **badge** that says how strong the claim is.

::badge-ladder{caption="The badge ladder. Every result in the course is reported with one of these badges. Select a badge to see what was checked, how, and what the result assumes."}

The rungs are different kinds of claim. *Tested* means some inputs passed. *Bounded* means every case up to a bound. *Exhaustive* means every state of one finite instance. *Verified* means all inputs, with a proof. *Violated* comes with a witness, and the witness has been replayed. *Unknown* is an honest answer when the engine could not decide, and it always says why. A verifier that never says *unknown* is either solving a very easy problem or lying.

## Don't trust, check

The verifier said *verified*. Why believe it? The verifier is a large program, and large programs have bugs. SAT and SMT solvers are faster than they are simple. Real solvers have returned wrong answers, which is why solver competitions now ask for proofs that can be checked (Chapter 8).

The course's answer, and the field's, is to split the work. The solver searches, which needs clever code. It writes down what it found as a **certificate**, and a separate *checker*, small and deliberately plain, checks the certificate. A wrong answer from the solver is then caught by the checker, unless the checker is also wrong. The checker is small enough to read, so that is much less likely.

- For a counterexample, the certificate is the counterexample itself: run the program on it and watch it fail. In the course, the reference interpreter does this before any counterexample is shown.
- For a proof that a formula has no solution, the certificate is a proof in a simple format (Chapter 8), and checking it is a mechanical walk.
- For a loop invariant, the certificate is the invariant: anyone can re-check that it is preserved by one iteration.

:::bridge{course=cic chapter=intro}
Proof assistants like Coq and Lean are built the same way: a large, untrusted system produces proofs, and a small kernel checks them. This is called the de Bruijn criterion, after the Dutch mathematician who designed the first such checker.
:::

The idea is older than computers that could run it. On 24 June 1949, at a conference in Cambridge for the inauguration of the EDSAC computer, Alan Turing gave a three-page paper called *Checking a large routine*.

:::history{year=1949 title="Turing's assertions" people="Alan Turing" source="Source: Turing (1949), as corrected and reprinted by Morris and Jones (1984)."}
"How can one check a routine in the sense of making sure that it is right?" Turing asked. His answer: "the programmer should make a number of definite assertions which can be checked individually, and from which the correctness of the whole programme easily follows." His example was a routine that computes a factorial using only addition, with two nested loops; he attached an assertion about the values of the variables to each point of its flow diagram.:cite[turing1949,morris1984]

He also asked how the checker could be sure that the routine stops, and answered with "a quantity which is asserted to decrease continually and vanish when the machine stops", the ancestor of the `decreases` clause in the binary search above. The paper was little read, and its notation was hard to follow. The same ideas were developed again, independently, by Robert Floyd in 1967 and Tony Hoare in 1969 (Chapter 17).:cite[morris1984]
:::

Turing's two ideas, assertions attached to program points and a decreasing measure, are exactly the `invariant` and `decreases` clauses of the binary search. What has changed since 1949 is who checks them. Turing imagined a person. In this course a solver checks them, and a smaller checker checks the solver.

:::proved
**What did we prove?** The fixed search meets its contract for every sorted array of at most 127 integers and every key. That covers every array index, every 8-bit operation and termination. The certificate is a set of SMT proofs, re-checked by the course's certificate checker. The result **assumes**: that Vouch means what its reference interpreter says it means; that the translation of the function into formulas is correct (it is not checked by the certificate); and that the contract says what you want. If `ensures` had been weaker, say only `ensures r < len(a)`, the badge would be just as green.
:::

## The course

The course is in seven parts, plus this prologue and an epilogue. Each part is built on one of the strategies above and opens with an essay, *How we got here*, on how its ideas developed.

- **Part I, Explore every state.** Systems as state machines; threads and their interleavings; properties that must *eventually* hold; distributed protocols with failures; an attacker. Explicit-state model checking finds the bugs and prints the traces.
- **Part II, Encode in bits.** Propositional logic, SAT solvers from the inside, proofs of unsatisfiability, bounded model checking of hardware and software, and (optionally) relational models and decision diagrams.
- **Part III, Reason with theories.** SMT: equality, arithmetic, bit-vectors and arrays, and symbolic execution.
- **Part IV, Prove programs.** Contracts, weakest preconditions, loop invariants, quantifiers and lemmas, data abstraction, and the heap.
- **Part V, Prove systems.** Inductive invariants, IC3 (optional), and protocols for any number of nodes.
- **Part VI, Approximate.** Abstract interpretation, and (optionally) better abstractions.
- **Part VII, Trust.** A capstone that verifies a small bank, the *Ledger*, layer by layer, and a chapter on what verified results really guarantee.

Three reading paths through the chapters are marked on the [course map](/#course-map): one for verifying code, one for distributed systems, and one for how the tools work inside.

**What you need.** You should be comfortable programming in a mainstream language. You need no logic or mathematics beyond school algebra: the logic is introduced as it is needed, and [Appendix A](/appendix/logic-primer/) is a primer for reference.

**Vouch** is a small language designed for this course: functions with contracts, systems of processes, small relational worlds and constraint problems. It runs in your browser, and so do all its tools: a SAT solver, an SMT solver, model checkers, a program verifier, and an interpreter that serves as the definition of the language. Nothing is sent to a server. The [Workbench](/workbench/) is a full-page editor with all of them, and [Appendix B](/appendix/vouch-reference/) is the language reference. Vouch also has a language server, so you can use it in your own editor.

**Exercises** ask you to fix, specify, model and verify; they are checked by the same tools, and progress is saved in your browser. Each chapter has at least one question that asks you to *predict* before it shows you the answer: commit to your answer first. The questions are placed where intuition usually goes wrong.

**The bug museum.** Many chapters re-enact a real failure: a published algorithm that was wrong, a protocol that was broken for seventeen years, a rocket that was lost. The [museum](/appendix/bug-museum/) collects them, and stamps each one *caught* when you catch it with the course's tools. You have just caught the first.

## What comes next

[Chapter 1](/chapters/state-machines/) starts Part I with the simplest thing a verifier can check: a system with a handful of states, every one of which can be visited.

## Further reading

- Joshua Bloch's post is short and worth reading in full, for the history and the fixes in several languages.:cite[bloch2006]
- Turing's paper, with Morris and Jones's corrections and commentary, shows how much of program proof was already there in 1949.:cite[morris1984]
- Dijkstra's *Notes on structured programming* is where the remark about testing comes from, and it is a good read on why programs should be designed to be reasoned about.:cite[dijkstra1970]
