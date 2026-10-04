---
number: 25
title: For every N
summary: 'Chapter 4 checked two-phase commit with three shards. A bank has more. Proofs for every number of nodes at once: why no finite set of checks suffices in general, a fragment of logic where a small number does (Bernays, Schönfinkel and Ramsey, 1928–30), and the Ivy method of reading counterexamples drawn as small networks. Two-phase commit and ring leader election, for every N.'
duration: About 1 hour 15 minutes
---

Every system so far had a size written into it: `instance Shard = 3`, two processes, six cells. The explorer's verdict on two-phase commit in chapter 4 said so: *for three shards*. The Ledger will run on however many shards it needs, and next year that number will change. A proof that holds only for three shards is a proof about a system nobody deploys.

## Checking more sizes is not enough

The obvious remedy is to check 4 shards, then 5, then as many as the computer can manage. It does not work, for two reasons. The state space grows exponentially with the number of nodes, so the sizes run out quickly. And no finite number of sizes is enough in general: Krzysztof Apt and Dexter Kozen showed in 1986 that whether a property holds for every number of copies of a finite-state process is undecidable.:cite[apt1986] Some bugs need many nodes to appear, and no algorithm can say in general how many.

What does work is the method of chapter 23: an inductive invariant. An invariant such as "no shard has committed while another has aborted" talks about all shards with `forall`, and induction asks whether it is preserved by every step, which says nothing about how many shards there are. The question is how to check consecution, Inv ∧ T ∧ ¬Inv′, when the number of shards is not fixed. That is a formula of first-order logic, and first-order logic is undecidable too. But not all of it.

## A fragment where small is enough

In 1928 Paul Bernays and Moses Schönfinkel, and in 1930 Frank Ramsey, studied formulas whose quantifiers all come in one order: some existential ones first, then universal ones, ∃x₁…∃xₖ ∀y₁…∀yₘ φ, with no function symbols.:cite[bernays1928,ramsey1930] They showed that whether such a formula can be satisfied is decidable, by an argument a programmer can follow. If the formula has a model of any size, take the k elements that the existential variables name (and the constants). The universal part, which held for *all* elements, still holds when only these remain. So the formula has a model with at most k elements. To decide it, try every size from 1 to k.

Now look at consecution for two-phase commit. Inv is a list of `forall` statements: universal. T is a step with some parameters (*the shard that votes*): existential, since the step is taken by some shard. ¬Inv′ is the negation of a `forall`: an existential, *some shards that break the invariant*. Put together, the formula is in the Bernays–Schönfinkel–Ramsey class, and a counterexample to induction, if there is one, needs at most as many shards as the step's parameters plus the invariant's variables. The workshop below computes that number, checks every instance up to it with the SAT encoding of chapter 10, and so decides consecution **for every number of shards**.

Three things take a formula out of the class, and the workshop rejects them with an explanation:

- **alternation**: an `exists` inside a `forall` ("every node has a successor"), which hides a function from nodes to nodes;
- **functions from nodes to nodes**, such as `var next: Node -> Node`, for the same reason;
- **counting**: `#votes == 3` is not first-order at all. Chapter 4's coordinator counted its votes; here it checks `forall s: Shard :: s in votes`, which says the same without a number.

This is the approach of **Ivy**, by Oded Padon, Kenneth McMillan, Aurojit Panda, Mooly Sagiv and Sharon Shoham (2016): model the protocol so that its verification conditions stay in a decidable fragment, so that every check gets a definite answer, and show each counterexample to induction as a small picture for the person to generalise from.:cite[padon2016]

```quiz
q: 'The invariant has two `forall` variables, and the step has one parameter. How many shards can a counterexample to induction need?'
options:
  - text: Two.
    why: 'The step''s parameter can be a third shard, different from both witnesses.'
  - text: At most three.
    correct: true
    why: 'The negated invariant names two shards, the step one more. Any counterexample, of any size, can be shrunk to those three (or fewer, if some coincide), and the shrunken one is still a counterexample.'
  - text: There is no bound.
    why: 'In general, no; in this fragment, yes. That is what Bernays, Schönfinkel and Ramsey proved.'
```

## Two-phase commit, for every number of shards

Here is chapter 4's protocol with the shard type left without a size, and only the `consistent` invariant. The checker reports that a counterexample needs at most three shards, finds one with two, and draws it: each shard with its resource manager's state, its messages in the network, and whether its vote was counted. Read it and ask the question of chapter 23: can this state happen?

:::param-workshop{title="Two-phase commit for every N" goal="Proved for every number of shards: every check passed on every instance up to the bound, and the logic says no larger instance can hide a counterexample. The explorer of chapter 4 needed every state of three shards; this proof needed a handful of small SAT queries."}
```vouch
enum RM { working, prepared, committed, aborted }

system TwoPhase {
  symmetric type Shard
  enum Kind { prepare, yes, no, commit, abort }
  struct Msg { kind: Kind, shard: Shard }
  enum Decision { undecided, will_commit, will_abort }

  var rm: Shard -> RM = working
  var decision: Decision = undecided
  var votes: set<Shard> = {}
  var net: set<Msg> = {}
  var up: bool = true

  action send_prepare(s: Shard) when up && decision == undecided {
    net = net + {Msg { kind: prepare, shard: s }}
  }
  action vote_yes(s: Shard) when rm[s] == working && (Msg { kind: prepare, shard: s }) in net {
    rm[s] = prepared
    net = net + {Msg { kind: yes, shard: s }}
  }
  action vote_no(s: Shard) when rm[s] == working {
    rm[s] = aborted
    net = net + {Msg { kind: no, shard: s }}
  }
  action count_vote(s: Shard) when up && decision == undecided && (Msg { kind: yes, shard: s }) in net {
    votes = votes + {s}
  }
  action decide_commit when up && decision == undecided && (forall s: Shard :: s in votes) {
    decision = will_commit
  }
  action decide_abort when up && decision == undecided && (exists s: Shard :: (Msg { kind: no, shard: s }) in net) {
    decision = will_abort
  }
  action send_decision(s: Shard) when up && decision != undecided {
    net = net + {Msg { kind: if decision == will_commit { commit } else { abort }, shard: s }}
  }
  action learn_commit(s: Shard) when rm[s] == prepared && (Msg { kind: commit, shard: s }) in net { rm[s] = committed }
  action learn_abort(s: Shard) when (rm[s] == prepared || rm[s] == working) && (Msg { kind: abort, shard: s }) in net {
    rm[s] = aborted
  }
  action lose(m: Msg) when m in net { net = net - {m} }
  action crash when up { up = false }

  invariant consistent: forall s: Shard, t: Shard :: !(rm[s] == committed && rm[t] == aborted)
  // Add invariants here.
}
```
:::

The first CTI has two shards. The coordinator has decided to commit and one shard has committed, but the other is still `working`: it votes no and aborts. That state is impossible: the coordinator decides to commit only after counting every shard's vote, and a shard whose yes vote was counted is no longer working. Each such observation is an invariant over all shards. Six are enough:

- a committed shard implies `decision == will_commit`;
- a commit message in the network implies `decision == will_commit`, and an abort message implies `decision == will_abort`;
- if the decision is to commit, every shard's vote was counted;
- a counted vote, or a yes message, means the shard is no longer `working`, and if it has aborted, the decision was to abort.

Write them one at a time and watch the CTIs change. When the last one goes in, the proof covers every number of shards, a network that loses, duplicates and reorders messages, and a coordinator that may crash.

```quiz
q: 'The proof never mentions three shards, yet the checker reports "a counterexample needs at most 3 shards". Where does the 3 come from?'
options:
  - text: From `instance Shard = 3` in chapter 4's model.
    why: 'This model has no instance size at all.'
  - text: From the formulas. The largest check involves two shards named by the broken invariant `consistent` and one more as the step's parameter.
    correct: true
    why: 'Each check has its own bound; the largest is three. A bigger instance cannot contain a counterexample that a smaller one lacks, because the counterexample can be shrunk to the shards it names.'
  - text: 'It is a heuristic: most bugs show up with three shards.'
    why: 'For formulas in this fragment it is not a heuristic but a theorem. For formulas outside it, the checker refuses to give a bound.'
```

## Leader election on a ring

In 1979 Ernest Chang and Rosemary Roberts published an algorithm for electing a leader among processes arranged in a ring, each with a unique identifier, without knowing how many there are.:cite[chang1979] Each process sends its identifier to the next one round the ring. A process that receives an identifier larger than its own passes it on; a smaller one is dropped. An identifier that comes all the way back to its owner must be the largest: its owner is the leader.

The ring and the identifiers never change, so they are described by **facts**: `btw[x, y, z]` says that going round the ring from x, y comes before z, and `le[x, y]` that x's identifier is at most y's. The facts are universal statements, the standard axioms of a cyclic order and of a total order, so they stay within the fragment. This is Ivy's model of the protocol, in Vouch.:cite[padon2016] The picture places the nodes round the ring, labels each with the rank of its identifier, and draws the messages in transit as arrows.

:::param-workshop{title="Chang and Roberts, for every ring" ring="btw" order="le" goal="Proved: in a ring of any size, with any arrangement of identifiers, at most one process ever declares itself leader, and the leader has the largest identifier. The checker needed instances of up to six nodes, because a receive step names three nodes and the last invariant three more."}
```vouch
system Ring {
  type Node

  // The ring and the identifiers never change. btw[x, y, z]: going round the ring from x, y comes before z.
  // le[x, y]: the identifier of x is at most that of y.
  var btw: (Node, Node, Node) -> bool
  var le: (Node, Node) -> bool
  fact ring: forall w: Node, x: Node, y: Node, z: Node ::
    (btw[x, y, z] ==> btw[y, z, x]) &&
    (btw[w, x, y] && btw[w, y, z] ==> btw[w, x, z]) &&
    (btw[w, x, y] ==> !btw[w, y, x]) &&
    (w != x && w != y && x != y ==> btw[w, x, y] || btw[w, y, x])
  fact order: forall x: Node, y: Node, z: Node ::
    le[x, x] && (le[x, y] && le[y, z] ==> le[x, z]) && (le[x, y] && le[y, x] ==> x == y) && (le[x, y] || le[y, x])

  var leader: set<Node> = {}
  // pending[v, n]: a message carrying v's identifier is waiting at n.
  var pending: (Node, Node) -> bool = false

  // n sends its own identifier to the next node, m.
  action send(n: Node, m: Node) when forall z: Node :: z != n && z != m ==> btw[n, m, z] {
    pending[n, m] = true
  }
  // n receives v's identifier: its own has come back (n is the leader), or a larger one is passed on to m.
  action receive(v: Node, n: Node, m: Node) when pending[v, n] && (forall z: Node :: z != n && z != m ==> btw[n, m, z]) {
    if v == n {
      leader = leader + {n}
    } else if le[n, v] {
      pending[v, m] = true
    }
  }

  invariant one_leader: forall a: Node, b: Node :: a in leader && b in leader ==> a == b
  invariant leader_max: forall n: Node, m: Node :: n in leader ==> le[m, n]
  invariant back_home: forall n: Node, m: Node :: pending[n, n] ==> le[m, n]
  // One more invariant: about a message in transit, and the nodes it has already passed.
}
```
:::

The first two invariants say what the algorithm is for; the third, that an identifier that has come home is the largest. The checker's CTI shows why they are not enough: a message carrying a small identifier waits at a node, though it has passed a node with a larger identifier on the way, which would have dropped it. That cannot happen, and saying so is the missing invariant: if v's identifier is waiting at n, every node m between v and n has an identifier at most v's. In Vouch: `forall n: Node, m: Node, v: Node :: pending[v, n] && btw[v, m, n] ==> le[m, v]`.

:::history
**Decidable fragments.** Bernays and Schönfinkel's paper and Ramsey's were contributions to the *Entscheidungsproblem*, Hilbert's question of whether first-order logic is decidable.:cite[bernays1928,ramsey1930] Church and Turing answered no for the whole logic in 1936,:cite[church1936,turing1936] which made the decidable classes found before it more interesting, not less. Ramsey's paper is better known for a combinatorial theorem it proved along the way, the start of what is now called Ramsey theory.:cite[ramsey1930] Eighty-six years later, Padon and colleagues built Ivy around the same class, with distributed protocols modelled so that their verification conditions stay within it, and every check therefore gets a definite answer.:cite[padon2016]
:::

:::hood
**The course's parameterised checker.** `src/lib/fv/param/fragment.ts` walks every expression with its polarity, so that a `forall` under a negation counts as an existential, and rejects alternation, counting, and functions between node values. For each action and each invariant, it adds up the node values the check can name: the action's parameters (including nodes inside struct parameters such as a message), the existential quantifiers of its guard, the variables of the negated invariant, and state variables that hold a node. `src/lib/fv/param/param.ts` then decides each check on every instance size up to that bound, with one incremental SAT solver per size. Two symmetry arguments keep the instances small: a step's node parameters are checked only up to renaming (the first node it uses is node 0, the next new one node 1), and so are the witnesses of the broken invariant. Facts that mention only variables no action changes are assumed in every state; any other fact is checked like an invariant.
:::

:::proved
**What did we prove?** For two-phase commit: with any number of shards, any message loss, duplication or reordering, and a coordinator that may crash, no shard commits while another aborts. For Chang and Roberts: on a ring of any size, at most one node is ever leader, and it has the largest identifier. Both rest on the SAT encoding of each small instance and on the small-model property of the fragment. Neither says anything about progress: two-phase commit may block, and the ring may never elect anyone if messages stop being delivered.
:::

## What comes next

Part V proved properties of systems by finding invariants, by hand, with k-induction, with IC3, and for every N. Part VI changes the deal: instead of proving exactly what you ask, it computes an over-approximation of everything a program can do, automatically, and accepts that it will sometimes raise an alarm about a state that cannot happen. [Chapter 26](/chapters/abstract-interpretation/) starts with intervals.

## Further reading

- Padon, McMillan, Panda, Sagiv and Shoham's paper describes Ivy and its decidable modelling.:cite[padon2016]
- Chang and Roberts's note presents the leader election algorithm.:cite[chang1979]
- Apt and Kozen's short paper shows why no general method can decide properties for every number of processes.:cite[apt1986]
