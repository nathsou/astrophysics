---
number: 4
title: Messages and failures
summary: Distributed systems as processes that share nothing but a network that loses, duplicates and reorders messages, and machines that crash. Two-phase commit for the Ledger, the scenario in which it blocks, and refinement, the idea that a protocol implements a specification.
duration: About 1 hour 30 minutes
---

The Ledger, the small bank that runs through this course, keeps its accounts on several machines, called **shards**. A transfer between accounts on different shards changes two machines, and it must change both or neither: a debit without the matching credit destroys money, and a credit without the debit creates it. That requirement is called **atomic commit**, and the standard protocol for it, **two-phase commit**, has been used in databases since the 1970s.:cite[gray1978]

Its correctness argument is short. Its behaviour when machines crash is not, and the classic failure of two-phase commit is not that it does something wrong but that it can stop doing anything at all. This chapter models the protocol over an unreliable network, plays the network's part, and checks the protocol against a specification of what atomic commit means.

## The network is an input

Processes on different machines share no memory. They communicate by sending messages, and the network that carries them is the part of the system that nobody controls. A realistic model of a network lets it:

- **lose** a message;
- **delay** it for any length of time, so that messages arrive in any order;
- **duplicate** it, because a sender that hears nothing sends again;

and lets machines **crash**, stopping without warning.

Vouch has no built-in network. The usual way to model one, in Vouch as in TLA+, is a state variable holding the set of messages that have been sent and not yet lost. Sending adds a message to the set. Receiving is an action whose guard says that a suitable message is in the set; it does not remove the message, so the same message can be received again, which models duplication for free. Because any enabled action may fire at any time, any message can be received at any time after it is sent, which models delay and reordering. Loss is one more action, which removes a message from the set, and a crash is an action that sets a flag the crashed machine's actions depend on.

```vouch title="The network, in a few lines"
struct Msg { kind: Kind, shard: Shard }
var net: set<Msg> = {}

action lose(m: Msg) when m in net { net = net - {m} }
```

The environment's choices, which message arrives next and which is lost, are now nondeterministic choices of the explorer, exactly like the scheduler's choices in Chapter 2. The explorer tries all of them.

## Two-phase commit

One machine acts as the **coordinator**. Each shard has a **resource manager** in one of four states: *working* on the transaction, *prepared* (it has promised to commit if asked), *committed* or *aborted*.

1. **Prepare.** The coordinator asks every shard to prepare.
2. **Vote.** A shard that can commit makes its changes durable, becomes *prepared*, and votes *yes*. A shard that cannot votes *no* and aborts.
3. **Decide.** If every vote is *yes*, the coordinator decides *commit*; if any vote is *no*, it decides *abort*.
4. **Inform.** The coordinator sends the decision to every shard, and each prepared shard commits or aborts accordingly.

The crucial rule is in step 2. A prepared shard has given up its right to decide alone: it has promised to commit if the coordinator says so, so it cannot abort on its own; and it does not know whether the others voted yes, so it cannot commit on its own either. It must wait for the coordinator.

Here is the protocol in Vouch, with three shards (`instance Shard = 3`), the network as a set of messages, and a coordinator that can crash.

```vouch title="two-phase.vouch"
enum RM { working, prepared, committed, aborted }

system TwoPhase {
  symmetric type Shard
  instance Shard = 3
  enum Kind { prepare, yes, no, commit, abort }
  struct Msg { kind: Kind, shard: Shard }
  enum Decision { undecided, will_commit, will_abort }

  var rm: Shard -> RM = working          // each shard's resource manager
  var decision: Decision = undecided     // the coordinator's decision
  var votes: set<Shard> = {}             // the yes votes the coordinator has counted
  var net: set<Msg> = {}
  var up: bool = true                    // the coordinator has not crashed

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
  action decide_commit when up && decision == undecided && #votes == 3 { decision = will_commit }
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

  invariant consistent: !(exists s, t: Shard :: rm[s] == committed && rm[t] == aborted)
}
```

A few things are new. `symmetric type Shard` with `instance Shard = 3` declares three interchangeable shard identities: the explorer may treat states that differ only by a renaming of the shards as one state (the symmetry reduction of Chapter 2). A struct literal in a guard is written in parentheses, `(Msg { … }) in net`, so that its braces are not mistaken for the action's body. And `#votes` is the number of elements of the set `votes`.

The invariant `consistent` is the safety half of atomic commit: no shard has committed while another has aborted.

```predict
q: 'The network may lose any message, deliver messages in any order and deliver the same message twice, and the coordinator may crash at any moment. Does `consistent` hold?'
options:
  - text: No. Losing the commit message to one shard lets it abort while another commits.
    why: 'A prepared shard cannot abort on its own: `learn_abort` needs an abort message, and the coordinator sends abort only if it decided to abort. Losing a message delays a shard; it does not make it decide the other way.'
  - text: Yes. Whatever the network and the crash do, no two shards disagree.
    correct: true
    why: 'Two-phase commit is safe under message loss, duplication, reordering and crashes. Its weakness is not safety. Run the explorer on the chart below to confirm it, then look for its real weakness.'
  - text: Only if no message is lost.
    why: 'Loss can make shards wait, never disagree.'
```

## Be the network

The chart below shows the protocol as a **message sequence chart**: one vertical line per participant, time running down, a dot for each step and an arrow for each message. You choose every step: the protocol's steps, and the network's and the coordinator's failures, in red. Try to make two shards disagree. Then try something more modest: leave a shard *stuck*, prepared and waiting for a decision that can never arrive.

:::msc{title="Two-phase commit over an unreliable network" lanes='["coordinator","shard 0","shard 1","shard 2","network"]' laneType="Shard" actors='{"send_prepare":"coordinator","count_vote":"coordinator","send_decision":"coordinator","lose":"network"}' routes='{"prepare":["coordinator","@"],"yes":["@","coordinator"],"no":["@","coordinator"],"commit":["coordinator","@"],"abort":["coordinator","@"]}' receives='{"vote_yes":"prepare","count_vote":"yes","decide_abort":"no","learn_commit":"commit","learn_abort":"abort"}' adversary='["lose","crash"]'}
```vouch
enum RM { working, prepared, committed, aborted }

system TwoPhase {
  symmetric type Shard
  instance Shard = 3
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
  action decide_commit when up && decision == undecided && #votes == 3 { decision = will_commit }
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

  invariant consistent: !(exists s, t: Shard :: rm[s] == committed && rm[t] == aborted)
  invariant not_blocked: up || !(exists s: Shard :: rm[s] == prepared && !((Msg { kind: commit, shard: s }) in net) && !((Msg { kind: abort, shard: s }) in net))
}
```
Black steps are the protocol's; red ones belong to the environment. A dashed arrow is a message still in flight; a red cross marks a lost one. The second invariant, `not_blocked`, describes the stuck state: the coordinator is down and some prepared shard has no decision on its way.
:::

Three steps are enough. The coordinator asks shard 0 to prepare; shard 0 votes yes and becomes prepared; the coordinator crashes. Shard 0 now holds its locks (it promised to commit, so it must keep the changes ready) and waits. It cannot commit, because it does not know the others' votes; it cannot abort, because the coordinator might have decided to commit before crashing. Until the coordinator recovers, shard 0 is **blocked**, and so is every transaction that needs the accounts it has locked.

This is the well-known weakness of two-phase commit, and it is why the explorer says `not_blocked` fails while `consistent` holds: the protocol is safe but not *non-blocking*. Real systems run the coordinator's decision through a replicated log so that another machine can take over; Gray and Lamport's *Paxos Commit* does exactly that.:cite[gray2006]

:::hood
**Why not just time out?** A prepared shard that hears nothing for a minute might be tempted to abort. If the coordinator had in fact decided *commit* and told shard 1 before crashing, shard 1 commits and shard 0 aborts, and money is created or destroyed. You can check this in the model by adding an action `timeout(s: Shard) when !up && rm[s] == prepared { rm[s] = aborted }`: the explorer then finds a violation of `consistent`. Every fix for blocking has to replace the coordinator, not ignore it.
:::

## A glimpse of impossibility

Could a cleverer protocol avoid blocking altogether? In 1985 Michael Fischer, Nancy Lynch and Michael Paterson proved a sharp limit. In an **asynchronous** system, one with no bound on message delays, no deterministic protocol can guarantee that a group of processes always reaches agreement if even one process may crash.:cite[flp1985] The reason, roughly, is that a crashed process and a very slow one look the same from outside, and there is always a schedule of delays that keeps the protocol undecided.

The result does not make consensus impossible in practice. It says that a protocol must give up something: Paxos and Raft never decide wrongly, and decide as soon as the network behaves well for long enough, but in the worst case they can be kept undecided.:cite[lamport1998] Checking such protocols means checking safety for all schedules, and liveness under assumptions about the network. That is exactly the split of Chapter 3.

## Specifications and refinement

The invariant `consistent` captures part of what two-phase commit is for. Here is a fuller answer, written as a separate, much simpler system: the **specification** of atomic commit, in the style of Gray and Lamport's TLA+ specification *TCommit*.:cite[gray2006] It has no coordinator, no messages and no votes; only the resource managers, and the rules for how their states may change.

```vouch title="commit.vouch: the specification"
system Commit {
  symmetric type Shard
  instance Shard = 3
  var rm: Shard -> RM = working

  action prepare(s: Shard) when rm[s] == working { rm[s] = prepared }
  action decide_commit(s: Shard) when rm[s] == prepared && (forall t: Shard :: rm[t] == prepared || rm[t] == committed) {
    rm[s] = committed
  }
  action decide_abort(s: Shard) when (rm[s] == working || rm[s] == prepared) && !(exists t: Shard :: rm[t] == committed) {
    rm[s] = aborted
  }

  invariant consistent: !(exists s, t: Shard :: rm[s] == committed && rm[t] == aborted)
}
```

A shard may commit only when every shard is prepared or committed; a shard may abort only if nobody has committed. That is all atomic commit means. Up to renaming the shards, the specification has 13 reachable states, few enough to understand completely.

Two-phase commit **refines** this specification if every run of the protocol, viewed only through the resource managers' states, is a run of the specification. Each step of the protocol must either change `rm` in a way the specification allows, or leave `rm` unchanged. The second case is essential: sending a prepare message, counting a vote or losing a message changes nothing the specification can see. These are **stuttering steps**, and refinement must allow them, because a detailed implementation always takes more steps than its abstract specification. This is why TLA+ builds stuttering into every specification (Chapter 3), and it makes refinement just logical implication: the protocol's runs are a subset of the specification's runs.:cite[lamport1994,abadi1991]

In Vouch, a system declares what it refines:

```vouch
system TwoPhase {
  …
  refines Commit
}
```

When the two systems have variables of the same name (`rm` here), the **refinement mapping** is the obvious one. Otherwise, `refines Commit via { rm = … }` gives, for each variable of the specification, an expression over the implementation's state. The explorer then checks two things: every initial state of the protocol maps to an initial state of the specification, and every reachable step maps to a step of the specification or to a stutter. The chart can show this mapping: each step of the protocol, on the right, labelled with the specification step it implements.

:::msc{title="Two-phase commit, seen through the specification" lanes='["coordinator","shard 0","shard 1","shard 2","network"]' laneType="Shard" actors='{"send_prepare":"coordinator","count_vote":"coordinator","send_decision":"coordinator","lose":"network"}' routes='{"prepare":["coordinator","@"],"yes":["@","coordinator"],"no":["@","coordinator"],"commit":["coordinator","@"],"abort":["coordinator","@"]}' receives='{"vote_yes":"prepare","count_vote":"yes","decide_abort":"no","learn_commit":"commit","learn_abort":"abort"}' adversary='["lose"]' refinement="true"}
```vouch
enum RM { working, prepared, committed, aborted }

system Commit {
  symmetric type Shard
  instance Shard = 3
  var rm: Shard -> RM = working

  action prepare(s: Shard) when rm[s] == working { rm[s] = prepared }
  action decide_commit(s: Shard) when rm[s] == prepared && (forall t: Shard :: rm[t] == prepared || rm[t] == committed) {
    rm[s] = committed
  }
  action decide_abort(s: Shard) when (rm[s] == working || rm[s] == prepared) && !(exists t: Shard :: rm[t] == committed) {
    rm[s] = aborted
  }
}

system TwoPhase {
  symmetric type Shard
  instance Shard = 3
  enum Kind { prepare, yes, no, commit, abort }
  struct Msg { kind: Kind, shard: Shard }
  enum Decision { undecided, will_commit, will_abort }

  var rm: Shard -> RM = working
  var decision: Decision = undecided
  var votes: set<Shard> = {}
  var net: set<Msg> = {}

  action send_prepare(s: Shard) when decision == undecided { net = net + {Msg { kind: prepare, shard: s }} }
  action vote_yes(s: Shard) when rm[s] == working && (Msg { kind: prepare, shard: s }) in net {
    rm[s] = prepared
    net = net + {Msg { kind: yes, shard: s }}
  }
  action vote_no(s: Shard) when rm[s] == working {
    rm[s] = aborted
    net = net + {Msg { kind: no, shard: s }}
  }
  action count_vote(s: Shard) when decision == undecided && (Msg { kind: yes, shard: s }) in net { votes = votes + {s} }
  action decide_commit when decision == undecided && #votes == 3 { decision = will_commit }
  action decide_abort when decision == undecided && (exists s: Shard :: (Msg { kind: no, shard: s }) in net) { decision = will_abort }
  action send_decision(s: Shard) when decision != undecided {
    net = net + {Msg { kind: if decision == will_commit { commit } else { abort }, shard: s }}
  }
  action learn_commit(s: Shard) when rm[s] == prepared && (Msg { kind: commit, shard: s }) in net { rm[s] = committed }
  action learn_abort(s: Shard) when (rm[s] == prepared || rm[s] == working) && (Msg { kind: abort, shard: s }) in net { rm[s] = aborted }
  action lose(m: Msg) when m in net { net = net - {m} }

  refines Commit
}
```
Each step of the protocol, on the right: the specification step it implements, or · for a stuttering step. Ask the explorer to check the refinement for all reachable states.
:::

```verify
id: messages-and-failures/refine
title: Make the coordinator refine the specification
prompt: |
  This coordinator is in a hurry: it commits as soon as **two** shards have voted yes. The explorer reports that `TwoPhase refines Commit` fails, with a run in which one shard commits while another is still working. Fix the coordinator so that the refinement holds. The specification is locked.
starter: |
  enum RM { working, prepared, committed, aborted }

  system Commit {
    symmetric type Shard
    instance Shard = 3
    var rm: Shard -> RM = working

    action prepare(s: Shard) when rm[s] == working { rm[s] = prepared }
    action decide_commit(s: Shard) when rm[s] == prepared && (forall t: Shard :: rm[t] == prepared || rm[t] == committed) {
      rm[s] = committed
    }
    action decide_abort(s: Shard) when (rm[s] == working || rm[s] == prepared) && !(exists t: Shard :: rm[t] == committed) {
      rm[s] = aborted
    }
  }

  system TwoPhase {
    symmetric type Shard
    instance Shard = 3
    enum Kind { prepare, yes, no, commit, abort }
    struct Msg { kind: Kind, shard: Shard }
    enum Decision { undecided, will_commit, will_abort }

    var rm: Shard -> RM = working
    var decision: Decision = undecided
    var votes: set<Shard> = {}
    var net: set<Msg> = {}

    action send_prepare(s: Shard) when decision == undecided { net = net + {Msg { kind: prepare, shard: s }} }
    action vote_yes(s: Shard) when rm[s] == working && (Msg { kind: prepare, shard: s }) in net {
      rm[s] = prepared
      net = net + {Msg { kind: yes, shard: s }}
    }
    action vote_no(s: Shard) when rm[s] == working {
      rm[s] = aborted
      net = net + {Msg { kind: no, shard: s }}
    }
    action count_vote(s: Shard) when decision == undecided && (Msg { kind: yes, shard: s }) in net { votes = votes + {s} }
    action decide_commit when decision == undecided && #votes >= 2 { decision = will_commit }
    action decide_abort when decision == undecided && (exists s: Shard :: (Msg { kind: no, shard: s }) in net) { decision = will_abort }
    action send_decision(s: Shard) when decision != undecided {
      net = net + {Msg { kind: if decision == will_commit { commit } else { abort }, shard: s }}
    }
    action learn_commit(s: Shard) when rm[s] == prepared && (Msg { kind: commit, shard: s }) in net { rm[s] = committed }
    action learn_abort(s: Shard) when (rm[s] == prepared || rm[s] == working) && (Msg { kind: abort, shard: s }) in net { rm[s] = aborted }
    action lose(m: Msg) when m in net { net = net - {m} }

    refines Commit
  }
locked: [[1, 16]]
solution: |
  action decide_commit when decision == undecided && #votes == 3 { decision = will_commit }
hints:
  - Read the counterexample. Which shard is still working when another commits, and why did the coordinator decide anyway?
  - The specification lets a shard commit only when every shard is prepared or committed.
success: '`TwoPhase refines Commit` now holds in every reachable state of the three-shard instance. Every run of your protocol, seen through `rm`, is a run of the specification.'
lines: 24
```

The refinement check is a stronger result than the invariant. The invariant says the protocol avoids one bad outcome. The refinement says that *everything* the protocol does to the resource managers is something atomic commit allows, so any property proved of the 13-state specification holds of the protocol too. This is the method of TLA+, and the method of the Ledger's capstone in Chapter 28: prove properties of a small specification, then show that the real system refines it.

:::industry
**TLA+ at Amazon, and two-phase commit everywhere.** Two-phase commit and its relatives run inside most distributed databases. Amazon's engineers used TLA+ on replication and fault-tolerance protocols of this kind in services such as DynamoDB and S3. The models were small, the bugs were real, and the precise specifications were valuable in their own right.:cite[newcombe2015] TLA+ checks refinement with the same mapping-and-stuttering idea as this chapter.
:::

:::proved
**What did we prove?** For three shards, with a network that loses, duplicates and reorders messages: two-phase commit never lets shards disagree, and every reachable step of the protocol is a step of the atomic-commit specification or a stutter. With a coordinator that can crash, a shard can be blocked: a replayed three-step trace shows it. The *holds* results trust the explorer's search and the refinement mapping (which says what the protocol's state means), and they cover three shards only. Chapter 25 proves the same protocol for any number of shards.
:::

## What comes next

The network in this chapter was careless: it lost and reordered messages, but never invented any. [Chapter 5](/chapters/the-adversary/) replaces it with an attacker, who reads every message, sends whatever it can construct, and breaks a security protocol that was trusted for seventeen years.

## Further reading

- Gray and Lamport's *Consensus on transaction commit* gives the TLA+ specification of atomic commit used here, two-phase commit, and Paxos Commit, which does not block.:cite[gray2006]
- Fischer, Lynch and Paterson's paper is short, and its proof idea, an endless sequence of undecided states, is worth seeing once.:cite[flp1985]
- Abadi and Lamport's paper explains when refinement mappings exist, and why stuttering and auxiliary variables are needed.:cite[abadi1991]
