/**
 * From an LTL formula to a generalised Büchi automaton, by the tableau construction of Gerth, Peled, Vardi and
 * Wolper (1995). Each automaton state ("node") carries the literals that must hold in the system state it reads,
 * and the obligations left for the next step. Each `a U b` gives one acceptance set: the runs that keep postponing
 * b forever are rejected.
 */
import { id, nnf, type Ltl } from './ltl';

export interface BuchiNode {
  id: number;
  /** Predecessors; -1 stands for the initial pseudo-state. */
  incoming: Set<number>;
  /** Literals (atoms or negated atoms) that must hold when the automaton is in this node. */
  pos: number[];
  neg: number[];
  /** Formulas this node promises (for display). */
  old: string[];
}

export interface Buchi {
  nodes: BuchiNode[];
  initial: number[];
  /** succ[n] = nodes reachable in one step from node n. */
  succ: number[][];
  /** One set of node ids per until-subformula; an accepting run visits each set infinitely often. */
  accepting: Set<number>[];
}

interface Pending {
  incoming: Set<number>;
  todo: Ltl[];
  old: Map<string, Ltl>;
  next: Map<string, Ltl>;
}

export function toBuchi(f: Ltl): Buchi {
  const root = nnf(f);
  const nodes: (BuchiNode & { oldIds: Set<string>; nextIds: string[]; nextF: Ltl[] })[] = [];
  const untils: Ltl[] = [];
  const collect = (g: Ltl) => {
    if (g.k === 'U' && !untils.some((u) => id(u) === id(g))) untils.push(g);
    if ('a' in g) collect(g.a);
    if ('b' in g) collect((g as { b: Ltl }).b);
  };
  collect(root);

  const expand = (n: Pending): void => {
    if (!n.todo.length) {
      const key = [...n.old.keys()].sort().join('&') + '|' + [...n.next.keys()].sort().join('&');
      const same = nodes.find((m) => [...m.oldIds].sort().join('&') + '|' + [...m.nextIds].sort().join('&') === key);
      if (same) {
        for (const x of n.incoming) same.incoming.add(x);
        return;
      }
      const lits = [...n.old.values()];
      const node = {
        id: nodes.length,
        incoming: new Set(n.incoming),
        pos: lits.filter((l) => l.k === 'atom').map((l) => (l as { id: number }).id),
        neg: lits.filter((l) => l.k === 'not').map((l) => ((l as { a: { id: number } }).a).id),
        old: lits.map((l) => id(l)),
        oldIds: new Set(n.old.keys()),
        nextIds: [...n.next.keys()],
        nextF: [...n.next.values()],
      };
      nodes.push(node);
      expand({ incoming: new Set([node.id]), todo: [...node.nextF], old: new Map(), next: new Map() });
      return;
    }
    const [eta, ...rest] = n.todo;
    const k = id(eta!);
    if (n.old.has(k)) return expand({ ...n, todo: rest });
    const withOld = (extra: Ltl[], add: Ltl[] = [], nextAdd: Ltl[] = []): Pending => {
      const old = new Map(n.old);
      old.set(k, eta!);
      const todo = [...rest, ...add.filter((x) => !old.has(id(x)))];
      const next = new Map(n.next);
      for (const x of nextAdd) next.set(id(x), x);
      void extra;
      return { incoming: new Set(n.incoming), todo, old, next };
    };
    switch (eta!.k) {
      case 'false':
        return;
      case 'true':
        return expand({ ...n, todo: rest });
      case 'atom':
      case 'not': {
        const negated = eta!.k === 'atom' ? `!${k}` : k.slice(1);
        if (n.old.has(negated)) return; // contradiction
        return expand(withOld([]));
      }
      case 'and':
        return expand(withOld([], [eta!.a, eta!.b]));
      case 'or':
        expand(withOld([], [eta!.a]));
        expand(withOld([], [eta!.b]));
        return;
      case 'U':
        expand(withOld([], [eta!.a], [eta!]));
        expand(withOld([], [eta!.b]));
        return;
      case 'R':
        expand(withOld([], [eta!.b], [eta!]));
        expand(withOld([], [eta!.a, eta!.b]));
        return;
      case 'X':
        return expand(withOld([], [], [eta!.a]));
    }
  };
  expand({ incoming: new Set([-1]), todo: [root], old: new Map(), next: new Map() });

  const succ: number[][] = nodes.map(() => []);
  for (const m of nodes) for (const p of m.incoming) if (p >= 0) succ[p]!.push(m.id);
  const accepting = untils.map((u) => {
    const uid = id(u);
    const bid = id((u as { b: Ltl }).b);
    return new Set(nodes.filter((m) => !m.oldIds.has(uid) || m.oldIds.has(bid)).map((m) => m.id));
  });
  return {
    nodes: nodes.map(({ id: i, incoming, pos, neg, old }) => ({ id: i, incoming, pos, neg, old })),
    initial: nodes.filter((m) => m.incoming.has(-1)).map((m) => m.id),
    succ,
    accepting,
  };
}
