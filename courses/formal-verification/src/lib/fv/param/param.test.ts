import { describe, expect, it } from 'vitest';
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { checkParameterised } from './param';

function run(src: string, sys: string) {
  const p = parse(src);
  const c = check(p.program);
  const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.message).join('; '));
  return checkParameterised(c, sys, { timeout: 60000 });
}

const TPC = (inv: string) => `enum RM { working, prepared, committed, aborted }
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
  action decide_commit when up && decision == undecided && (forall s: Shard :: s in votes) { decision = will_commit }
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
${inv}
}`;
const RING = (inv: string) => `system Ring {
  type Node
  instance Node = 3

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

  // n sends its own identifier to the next node m.
  action send(n: Node, m: Node) when forall z: Node :: z != n && z != m ==> btw[n, m, z] {
    pending[n, m] = true
  }
  // n receives v's identifier: its own comes back (n is the leader), or a larger one is passed on.
  action receive(v: Node, n: Node, m: Node) when pending[v, n] && (forall z: Node :: z != n && z != m ==> btw[n, m, z]) {
    if v == n {
      leader = leader + {n}
    } else if le[n, v] {
      pending[v, m] = true
    }
  }

  invariant one_leader: forall a: Node, b: Node :: a in leader && b in leader ==> a == b
${inv}
}`;

const TPC_STRONG = `  invariant committed_ok: forall s: Shard :: rm[s] == committed ==> decision == will_commit
  invariant commit_msg: forall s: Shard :: (Msg { kind: commit, shard: s }) in net ==> decision == will_commit
  invariant abort_msg: forall s: Shard :: (Msg { kind: abort, shard: s }) in net ==> decision == will_abort
  invariant all_voted: forall s: Shard :: decision == will_commit ==> s in votes
  invariant counted: forall s: Shard :: s in votes ==> rm[s] != working && (rm[s] == aborted ==> decision == will_abort)
  invariant yes_msg: forall s: Shard :: (Msg { kind: yes, shard: s }) in net ==> rm[s] != working && (rm[s] == aborted ==> decision == will_abort)`;
const RING_STRONG = `  invariant leader_max: forall n: Node, m: Node :: n in leader ==> le[m, n]
  invariant back_home: forall n: Node, m: Node :: pending[n, n] ==> le[m, n]
  invariant passed: forall n: Node, m: Node, v: Node :: pending[v, n] && btw[v, m, n] ==> le[m, v]`;

describe('parameterised verification', () => {
  it('proves two-phase commit for every number of shards, once strengthened', () => {
    expect(run(TPC(''), 'TwoPhase').status).toBe('cti');
    const r = run(TPC(TPC_STRONG), 'TwoPhase');
    expect(r.status).toBe('proved');
    expect(r.bound).toEqual({ Shard: 3 });
  });
  it('proves ring leader election for every ring size', () => {
    const r = run(RING(RING_STRONG), 'Ring');
    expect(r.status).toBe('proved');
    expect(r.bound).toEqual({ Node: 6 });
    // Without the invariant about messages in transit, induction fails.
    expect(run(RING(RING_STRONG.split('\n').slice(0, 2).join('\n')), 'Ring').status).toBe('cti');
  });
  it('finds a counterexample when the ring forwards the smaller identifier', () => {
    const buggy = RING(RING_STRONG).replace('} else if le[n, v] {', '} else if le[v, n] {');
    expect(run(buggy, 'Ring').status).toBe('cti');
  });
  it('checks sizes up to the bound: a bug that needs three nodes', () => {
    const r = run(`system Marks {
  type Node
  var marked: set<Node> = {}
  action mark(n: Node) { marked = marked + {n} }
  invariant at_most_two: forall a: Node, b: Node, c: Node :: a in marked && b in marked && c in marked ==> a == b || b == c || a == c
}`, 'Marks');
    expect(r.status).toBe('cti');
    expect(r.cti!.sizes.Node).toBe(3);
  });
  it('rejects quantifier alternation and counting', () => {
    const alt = run(`system A {
  type Node
  var r: (Node, Node) -> bool = false
  action link(a: Node, b: Node) { r[a, b] = true }
  invariant total: forall a: Node :: exists b: Node :: r[a, b] || a == b
}`, 'A');
    expect(alt.status).toBe('outside');
    const count = run(`system C {
  type Node
  var s: set<Node> = {}
  action add(n: Node) { s = s + {n} }
  invariant few: #s <= 2
}`, 'C');
    expect(count.status).toBe('outside');
  });
});
