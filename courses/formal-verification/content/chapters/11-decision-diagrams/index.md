---
number: 11
title: Decision diagrams
summary: 'A Boolean function as a graph that is often small, always canonical, and cheap to combine: Bryant''s reduced ordered binary decision diagrams. Variable order, adders against multipliers, and symbolic model checking, which computes the set of all reachable states one image at a time, with the result exported as an invariant and checked by SAT.'
duration: About 1 hour 15 minutes
---

SAT solvers answer one question about a formula: is there a model? Sometimes you want the whole function in hand: to compare two functions, to count their models, to take the set of states reachable in one step and combine it with the next. In 1986 Randal Bryant showed that a simple restriction of an old idea, the binary decision diagram, gives a data structure for Boolean functions that is often small, is canonical (each function has exactly one), and supports every operation in time proportional to the sizes of its arguments.:cite[bryant1986,akers1978] Four years later it made model checking of hardware with astronomically many states possible.:cite[burch1990] This chapter is optional; the rest of the course uses SAT and SMT instead, and the last section says why.

## From a decision tree to a diagram

Take a function of a few variables and decide it one variable at a time: test a, and in each branch test b, and so on. With n variables that is a **decision tree** with 2ⁿ leaves, one per row of the truth table: as large as the truth table, and no more useful.

Two observations shrink it.

- If both branches of a test lead to the same thing, the test is useless: remove it.
- If two subtrees are identical, keep one copy and point to it twice.

Apply both everywhere, with the variables tested in the same order on every path, and the result is a **reduced ordered binary decision diagram** (BDD). Bryant's theorem: for a fixed variable order, every Boolean function has exactly one. Two formulas are equivalent if and only if they produce the same diagram, and with a table that shares identical nodes (the *unique table*), that is the same pointer.

Type a formula below. Solid lines lead to the branch where the variable is true, dashed lines to the branch where it is false.

::bdd-lab{formula="(a & b) | (c & d)" caption="The BDD lab. Operators: ! (not), & (and), | (or), ^ (xor), -> (implies), <-> (iff). Select a variable in the order and move it with the arrows: the function stays the same, the diagram does not."}

```quiz
q: 'Two formulas over the same variables give BDDs (with the same order) that are the same node in the unique table. What do you know?'
options:
  - text: The formulas are probably equivalent.
    why: 'Not probably: canonicity says each function has exactly one reduced ordered BDD for a given order. Same node, same function.'
  - text: The formulas are equivalent, and checking it took constant time once the BDDs were built.
    correct: true
    why: 'Equivalence is pointer equality. All the work went into building the two BDDs, which can be large; a SAT solver would instead search for an input on which they differ (the miter of chapter 10).'
  - text: The formulas are syntactically identical.
    why: 'Canonicity is about functions, not syntax. (a & b) | (a & c) and a & (b | c) give the same BDD.'
```

## Operations: apply

Every Boolean operation on BDDs comes from one recursive procedure. To compute f ∧ g, look at the top variable x of either, split both on it (Shannon's expansion: f = x ∧ f|ₓ₌₁ ∨ ¬x ∧ f|ₓ₌₀), combine the two halves recursively, and build the node for x from the results, sharing it through the unique table. With a cache of results already computed, each pair of nodes is visited once, so f ∧ g costs at most |f| × |g| steps. The course's package (`src/lib/fv/bdd/bdd.ts`) builds every operation from one such procedure, *if-then-else*, plus quantification: ∃x. f is f|ₓ₌₀ ∨ f|ₓ₌₁.

Counting is cheap too: the number of satisfying assignments of a BDD is computed in one pass over its nodes. That is how the lab knows how many of the 2ⁿ rows satisfy the formula, and how this chapter will count states in the billions.

## The order is everything

The size of a BDD depends on the variable order, sometimes enormously. The classic example is a comparator: are two n-bit numbers a and b equal? With the bits interleaved, a₀ b₀ a₁ b₁ …, the BDD checks one pair at a time and has 3n + 2 nodes. With all of a first, it must remember every bit of a before it sees b, and it has 3 · 2ⁿ − 1 nodes.

::bdd-lab{formula="(a0 <-> b0) & (a1 <-> b1) & (a2 <-> b2) & (a3 <-> b3)" order='["a0","a1","a2","a3","b0","b1","b2","b3"]' target=14 id="decision-diagrams/order" editable=false caption="Find an order that brings this 4-bit comparator down to 14 nodes. It starts with all of a before b: 47 nodes."}

Deciding whether an order can be improved is NP-complete,:cite[bollig1996] so BDD packages use heuristics: put related variables close together, and reorder dynamically when the diagrams grow. Rudell's *sifting*, the most widely used method, moves one variable at a time to its best position.:cite[rudell1993] For many functions a good order exists. For some, none does.

## Adders and multipliers

Addition has small BDDs: with the bits interleaved from the least significant up, every sum bit has a BDD linear in the width, because the only thing the diagram needs to remember as it moves up the bits is the carry. Multiplication is different. Bryant proved in 1991 that for the middle bit of the product of two n-bit numbers, *every* variable order gives a BDD of size exponential in n.:cite[bryant1991] The plot below builds both in your browser.

::arith-growth{caption="BDD sizes for one output bit, on a logarithmic scale. The adder grows by 3 nodes per bit; the multiplier's middle bit grows by a factor of more than 2 per bit, and random orders do no better than the interleaved one."}

```predict
q: 'The multiplier''s middle bit has about 5,000 nodes at 10 bits and grows by a factor of about 2.3 per bit. Roughly how many nodes would 32 bits need?'
options:
  - text: About 16,000, since the width only triples.
    why: 'That would be linear growth. The plot is a straight line on a logarithmic scale: exponential.'
  - text: About 2.3²² × 5,000, more than 10¹¹ nodes.
    correct: true
    why: 'Twenty-two more bits at a factor of about 2.3 each. Even at a few bytes per node, no machine can hold it, and Bryant''s theorem says no clever order can fix this.'
  - text: It depends on the order; a good order keeps it small.
    why: 'For addition, yes. For the middle bit of a multiplier, Bryant proved that every order gives exponential size.'
```

This is why multiplier verification went on to need other techniques: word-level reasoning, specialised decision diagrams, and later algebraic methods and SAT with careful encodings.

## Sets of states as BDDs

Here is the idea that made BDDs famous. A state of a system is an assignment to its Boolean state variables (chapter 10's encoding), so a **set of states** is a Boolean function: true exactly for the states in the set. A BDD can represent a huge set compactly when the set has structure, which sets of reachable states often do.

The transition relation T(S, S′) is a BDD too, over two copies of the variables. Then the states reachable in one step from a set X are its **image**:

$$
\mathrm{Image}(X)(S') = \exists S.\; X(S) \land T(S, S')
$$

computed with one combined and-and-quantify operation, then renamed from S′ back to S. Starting from the initial states, add images until nothing new appears:

$$
R_0 = I, \qquad R_{i+1} = R_i \lor \mathrm{Image}(R_i)
$$

Each iteration adds every state one step further, however many there are, without ever listing them. At the fixpoint, R is the set of all reachable states, and an invariant holds if and only if R ∧ ¬P is the empty BDD. This is **symbolic model checking**, introduced by Burch, Clarke, McMillan, Dill and Hwang in 1990 under the title *Symbolic model checking: 10²⁰ states and beyond*, and built into McMillan's SMV.:cite[burch1990,mcmillan1993]

:::reach-lab{title="Forty switches" race=true}
```vouch
system Switches {
  type Switch
  instance Switch = 40
  var on: Switch -> bool = false
  action flip(s: Switch) { on[s] = !on[s] }
  invariant not_all_on: exists s: Switch :: !on[s]
}
```
:::

Forty switches have 2⁴⁰, about 1.1 × 10¹², reachable states, and the invariant fails only in the one where every switch is on, forty steps from the start. The explorer stores states one at a time and stops after a few million. The BDD of each set of states stays tiny, because "any combination of at most i switches is on" has a simple structure, and the fixpoint is reached after forty images. Edit the system: make it 100 switches, or change the invariant so that it holds.

```quiz
q: 'At iteration 20 the table reports more than 10¹¹ reachable states in a BDD of a few hundred nodes. How is that possible?'
options:
  - text: The BDD stores a compressed list of the states.
    why: 'There is no list. A BDD is a decision procedure for membership: follow 40 tests from the root and reach 1 or 0.'
  - text: The set has structure ("at most 20 switches are on"), and a BDD represents a function by the decisions it needs, sharing every identical subproblem.
    correct: true
    why: 'After deciding some switches, what remains to know is only how many are on so far. That is about 20 distinct situations per level, so a few hundred nodes in all.'
  - text: The count is an estimate.
    why: 'The count is exact: model counting on a BDD is a single pass over its nodes, with exact integer arithmetic.'
```

## Don't trust the BDD package: check the invariant

A BDD package is clever code, with caches, unique tables and reordering, and it is exactly the kind of code this course does not trust. When reachability says an invariant holds, the course exports the reachable set R as a formula and asks the SAT solver three questions, each answered with a DRAT proof that the trusted checker verifies:

1. I ∧ ¬R is unsatisfiable: every initial state is in R.
2. R ∧ T ∧ ¬R′ is unsatisfiable: every step from R stays in R.
3. R ∧ ¬P is unsatisfiable: R implies the invariant.

Together these say that R is an **inductive invariant** that implies P, which proves P without trusting the BDDs that found R. A fixpoint is exactly an inductive set, and that is what makes the check possible. The same pattern, an engine that finds an invariant and a checker that verifies it, returns in chapter 23 (k-induction), chapter 24 (IC3) and chapter 27 (abstract interpretation).

:::reach-lab{title="Two-phase commit, three shards"}
```vouch
enum Vote { none, yes, no }
enum Decision { undecided, commit, abort }

system TwoPhaseCommit {
  symmetric type Shard
  instance Shard = 3
  var vote: Shard -> Vote = none
  var decision: Decision = undecided
  var told: Shard -> Decision = undecided

  action vote_yes(s: Shard) when vote[s] == none { vote[s] = yes }
  action vote_no(s: Shard) when vote[s] == none { vote[s] = no }
  action decide_commit when decision == undecided && (forall s: Shard :: vote[s] == yes) {
    decision = commit
  }
  action decide_abort when decision == undecided && (exists s: Shard :: vote[s] == no) {
    decision = abort
  }
  action inform(s: Shard) when decision != undecided && told[s] == undecided {
    told[s] = decision
  }

  invariant consistent: forall s, t: Shard :: told[s] != undecided && told[t] != undecided ==> told[s] == told[t]
  invariant commit_means_yes: decision == commit ==> forall s: Shard :: vote[s] == yes
}
```
:::

Open the badge: the certificate is the reachable set, re-checked as an inductive invariant by three SAT queries.

## BDDs or SAT?

BDDs and SAT solvers both handle Boolean functions, and for two decades they competed. BDDs compute everything about a function (all its models, its quantifications, its fixpoints), when they fit in memory; when they do not, they fail completely, and whether they fit depends on the variable order and on the function. A SAT solver computes one thing, a model or a refutation, but it degrades gracefully, and its learned clauses adapt to the problem. Bounded model checking (chapter 10) was proposed in 1999 precisely because BDD-based model checkers ran out of memory on designs that SAT solvers could still handle.:cite[biere1999] Today SAT-based methods, and IC3 above all (chapter 24), carry most of hardware model checking, while BDDs remain the tool of choice where whole functions are needed: equivalence of small circuits, synthesis, and counting.

:::history
**From Akers to SMV.** Decision diagrams for Boolean functions were described by Lee in 1959, as *binary-decision programs* for switching circuits, and by Akers in 1978, who used them to describe and test digital functions.:cite[lee1959,akers1978] Bryant's contribution in 1986 was the ordering and the reduction rules, which made them canonical, and the algorithms for operating on them.:cite[bryant1986] Burch, Clarke, McMillan, Dill and Hwang's paper of 1990 applied them to model checking, and McMillan's SMV system made symbolic model checking an industrial tool for hardware.:cite[burch1990,mcmillan1993]
:::

:::proved
**What did we prove?** When symbolic reachability says an invariant holds, the reachable set has been re-checked by SAT, with DRAT proofs, as an inductive invariant that implies the property: the result does not depend on the BDD package being correct. It still rests on the encoding of the system into Boolean variables (shared with BMC, and tested against the explorer) and on the instance (here, three shards). A violation is reported with a trace found by BMC to the same depth and replayed by the runtime.
:::

:::hood
**The course's BDDs.** `src/lib/fv/bdd/bdd.ts` is about 400 lines: a unique table keyed by (level, low, high), *if-then-else* with a computed table, restriction, existential quantification, the combined and-exists of image computation, renaming, model counting with exact integers, and conversion to and from formulas. `src/lib/fv/bdd/reach.ts` builds the transition relation one step instance at a time (with each step's auxiliary variables at the top of the order, then current and next-state variables interleaved), iterates images, and certifies the result. Its tests compare reachable-state counts with the explorer on every example system.
:::

## What comes next

Part II ends here. [Part III](/parts/reason-with-theories/) asks what happens when the variables are not Booleans: integers, functions, arrays, bit-vectors. [Chapter 12](/chapters/equality-and-functions/) begins with the simplest theory, equality.

## Further reading

- Bryant's 1986 paper is short and clear, and defines everything this chapter uses.:cite[bryant1986]
- *Symbolic model checking: 10²⁰ states and beyond* is the paper that brought BDDs to model checking.:cite[burch1990]
- McMillan's book describes SMV and symbolic model checking in depth.:cite[mcmillan1993]
