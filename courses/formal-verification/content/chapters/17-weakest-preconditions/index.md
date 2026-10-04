---
number: 17
title: Weakest preconditions
summary: 'How a contract and a body become formulas. Hoare triples and the rules of Hoare logic; the weakest precondition, which computes backwards exactly what must hold before a statement; verification conditions and the SMT query a verifier sends; and why the textbook calculus can produce formulas exponentially larger than the program, and how verifiers avoid it.'
duration: About 1 hour 15 minutes
---

Chapter 16 wrote contracts and let the verifier check them. This chapter opens the verifier. Its job is to turn *this function meets this contract* into formulas that a solver can decide, and the method for doing that is fifty years old and fits on an index card.

## Hoare triples

A **Hoare triple** {P} S {Q} says: if P holds before S runs, and S terminates, then Q holds afterwards. P is the precondition, Q the postcondition, S a statement or a whole program. A contract is a triple: {requires} body {ensures}.

Robert Floyd introduced the idea in 1967, for flowcharts: attach an assertion to each arrow, and check that each box takes the assertion on its incoming arrow to the one on its outgoing arrow.:cite[floyd1967] Tony Hoare turned it into a logic in 1969, with an axiom or rule for each kind of statement.:cite[hoare1969] (Hoare's paper wrote the program in braces, P {S} Q; the braces later moved to the assertions.)

The rules for a small language:

- **Assignment.** {Q[x := e]} x = e {Q}. To know that Q holds after assigning e to x, check that Q with e in place of x holds before.
- **Sequence.** From {P} S₁ {R} and {R} S₂ {Q}, conclude {P} S₁; S₂ {Q}. The midpoint R is any assertion that works.
- **If.** From {P ∧ c} A {Q} and {P ∧ ¬c} B {Q}, conclude {P} if c {A} else {B} {Q}.
- **Consequence.** A stronger precondition or a weaker postcondition is always allowed: if P ⟹ P′ and {P′} S {Q′} and Q′ ⟹ Q, then {P} S {Q}.
- **While.** If I is an invariant, {I ∧ c} body {I}, then {I} while c {body} {I ∧ ¬c}.

The assignment axiom looks backwards, and it is meant to: it goes from the postcondition to the precondition.

```quiz
q: 'Which triple is an instance of the assignment axiom?'
options:
  - text: '{x > 0} y = x + 1 {y > 1}'
    why: 'True, but not an instance of the axiom: the axiom''s precondition for postcondition y > 1 is x + 1 > 1, which says the same thing only after simplification. With the consequence rule, the triple follows.'
  - text: '{x + 1 > 1} y = x + 1 {y > 1}'
    correct: true
    why: 'Substitute x + 1 for y in the postcondition y > 1 and you get exactly the precondition. That is the axiom, character for character.'
  - text: '{y > 1} y = x + 1 {x + 1 > 1}'
    why: 'This substitutes in the wrong direction. Before the assignment, y may be anything: y > 1 says nothing about x.'
```

## Weakest preconditions

The rules let you check a proof, but they do not say how to find the midpoints and preconditions. Edsger Dijkstra answered that in 1975. For a statement S and a postcondition Q, the **weakest precondition** wp(S, Q) is the weakest assertion P such that {P} S {Q}: it holds for exactly the states from which S is guaranteed to end in a state satisfying Q.:cite[dijkstra1975] And it can be computed, statement by statement, from the last statement back to the first:

$$
\begin{aligned}
\mathrm{wp}(x = e,\ Q) &= Q[x := e] \\
\mathrm{wp}(S_1;\ S_2,\ Q) &= \mathrm{wp}(S_1,\ \mathrm{wp}(S_2,\ Q)) \\
\mathrm{wp}(\textbf{if } c\ \{A\}\ \textbf{else}\ \{B\},\ Q) &= (c \Rightarrow \mathrm{wp}(A, Q)) \wedge (\neg c \Rightarrow \mathrm{wp}(B, Q)) \\
\mathrm{wp}(\textbf{assert } c,\ Q) &= c \wedge Q
\end{aligned}
$$

A function meets its contract when its precondition implies the weakest precondition of its body for its postcondition. That implication is the **verification condition**, and it goes to the solver.

The stepper below runs the calculus on a function that swaps two numbers without a temporary variable. The postcondition starts at the bottom; each step moves it up past one statement. Hover a statement to highlight the predicate just before it.

:::wp-stepper{title="Backwards through a swap"}
```vouch
fn swap_check(x: int, y: int) -> bool
  ensures result
{
  var a = x
  var b = y
  a = a + b
  b = a - b
  a = a - b
  return a == y && b == x
}
```
:::

The predicates grow as the substitutions pile up: *a − (a − b) = y* says, before the last assignment, what *a = y* will mean after it. At the top, the precondition (here *true*, since there is none) must imply the predicate, and the solver confirms that it does. Press *Show the SMT query* to see exactly what is sent: the negation of the verification condition, which must be unsatisfiable.

```quiz
q: 'What is wp(x = x + 1; y = 2 * x, y > 10)?'
options:
  - text: 'x > 4'
    correct: true
    why: 'Backwards: wp(y = 2 * x, y > 10) is 2x > 10. Then wp(x = x + 1, 2x > 10) is 2(x + 1) > 10, that is x > 4.'
  - text: 'x > 5'
    why: 'That would be right without the first assignment. The increment happens before the doubling, so x itself only needs to exceed 4.'
  - text: 'x + 1 > 10'
    why: 'This forgets the doubling. Start from the last statement: substitute 2x for y first.'
```

Now be the calculator. Each exercise shows a function without a precondition; type the weakest precondition that makes it verify. The solver checks both directions: your condition must be strong enough, and it must not be stronger than necessary.

:::wp-exercise{id="weakest-preconditions/double" title="Double and check"}
```vouch
fn double(x: int) -> int
  ensures result >= 10
{
  var y = x + 3
  y = 2 * y
  return y
}
```
:::

:::wp-exercise{id="weakest-preconditions/distance" title="Distance from five" hints='["Compute the two branches separately: when x > 5 the result is x - 5, otherwise 5 - x.", "Each branch fails for exactly one value of x. Which?"]'}
```vouch
fn distance(x: int) -> int
  ensures result > 0
{
  if x > 5 {
    return x - 5
  }
  return 5 - x
}
```
:::

## Building a proof by hand

The weakest precondition finds a proof automatically, but a proof in Hoare logic can also be built rule by rule, and doing it once makes the machinery concrete. Pick a goal, apply the rule that matches its first statement, and the goal splits into subgoals. The sequence rule needs a midpoint: take the weakest precondition of the rest (always good enough), or type your own. Every rule application produces side conditions, implications between formulas, and the solver checks them.

:::hoare-builder{title="A Hoare proof of max"}
```vouch
fn max(a: int, b: int) -> int
  ensures result >= a && result >= b && (result == a || result == b)
{
  var m = a
  if b > m {
    m = b
  }
  return m
}
```
:::

Try a wrong midpoint for the first sequence step, say `m == b`, and watch which side condition fails. A midpoint can be too weak (the rest of the proof cannot use it) or too strong (the first statement cannot establish it); the weakest precondition is the weakest that works, so it never fails for the second reason.

## Loops

The weakest precondition of a loop cannot be computed by substitution: the loop may run any number of times. Verifiers ask for an **invariant** I instead, and the loop contributes I as its precondition plus two side conditions, each for all values of the variables the loop modifies:

- I ∧ c ⟹ wp(body, I): an iteration preserves the invariant;
- I ∧ ¬c ⟹ Q: when the loop exits, the invariant gives what follows.

A third obligation, that the precondition before the loop implies I, comes from the rest of the calculation. Finding I is the subject of chapter 18.

## Exponential verification conditions

The rule for `if` copies the postcondition into both branches. One `if` doubles it; ten in sequence multiply it by about a thousand. The table measures this on a function with n branches in sequence, each updating x differently, counting the distinct subformulas of each method's formula:

::wp-growth{caption="Formula size for n branches in sequence. The textbook wp roughly doubles with each branch; the course's generator, which works forwards and merges branches at each join, adds the same small amount per branch. Bars are on a logarithmic scale."}

The exponential growth is real, and verifiers of the 1990s hit it. Cormac Flanagan and James Saxe showed in 2001 how to avoid it.:cite[flanagan2001] First convert the program to **passive form**: give each assignment a fresh version of its variable, so that x = x + 1 becomes *assume x₂ = x₁ + 1*. A passive program never overwrites anything, so the weakest precondition needs no substitution, and the postcondition no longer has to be copied into each path with a different meaning. This renaming is the same idea as the static single assignment form of compilers.

:::bridge{course=compiler-backends chapter=ssa}
*SSA to Silicon* builds static single assignment form, where every variable is assigned once and a φ-function merges the versions at a join. A verifier's passive form is the same construction: the φ becomes an equation that holds on the path the program took.
:::

The course's verification-condition generator takes the forward route, which amounts to the same thing: it executes the body symbolically, keeps one symbolic value per variable, and at the end of an `if` merges the two branches into one value, *if c then v₁ else v₂*. Shared subformulas are built once, so the formula grows by a constant per branch.

:::history
**From flowcharts to predicate transformers.** Floyd's 1967 paper attached assertions to the arrows of flowcharts and proved termination with a measure that decreases around every loop.:cite[floyd1967] Hoare's 1969 paper, *An axiomatic basis for computer programming*, gave the rules and argued that they could serve as the definition of a programming language.:cite[hoare1969] Dijkstra's 1975 paper on guarded commands introduced the weakest precondition and used it to derive programs from their specifications rather than to check them afterwards.:cite[dijkstra1975] *How we got here (Part IV)* tells the longer story.
:::

:::hood
**Two calculators.** The stepper and the rule builder use a small, separate implementation of the textbook calculus (`src/lib/fv/wp/wp.ts`) over a subset of Vouch: integer and Boolean variables, assignments, `if`, `while` with invariants, `assert`, `assume` and `return`. It exists to show the steps. The verifier that checks the rest of the course's programs (`src/lib/fv/vouch/vc/gen.ts`) works forwards on the whole language, with arrays, structures, quantifiers, machine integers and calls, and merges at joins as described above. Both send their formulas to the same SMT solver.
:::

:::proved
**What did we prove?** A valid verification condition proves the contract, assuming the calculus describes the language correctly. That assumption is real: a verifier's weakest-precondition rules are part of its trusted base, and a wrong rule (for overflow, for aliasing, for evaluation order) proves wrong things. The course's interpreter is the reference semantics, and every counterexample is replayed through it, which catches wrong rules that produce false alarms but not wrong rules that hide bugs.
:::

## What comes next

Every loop in this chapter came with its invariant. [Chapter 18](/chapters/loop-invariants/) is about finding one: what makes an invariant inductive, the three lights a verifier shows, counterexamples to induction, and termination.

## Further reading

- Hoare's 1969 paper is six pages long and very readable.:cite[hoare1969]
- Flanagan and Saxe's paper explains passive form and the exponential problem it solves.:cite[flanagan2001]
