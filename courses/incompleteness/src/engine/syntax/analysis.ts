// Structural facts about a formula, indexed by node id: parents, subtrees, and which quantifier
// binds each variable occurrence. Views use this to link an occurrence to everything related
// to it.

import { children, walk, type Formula, type Node, type NodeId } from './ast.ts';

export interface Analysis {
  root: Node;
  byId: Map<NodeId, Node>;
  parent: Map<NodeId, NodeId | null>;
  /** pre-order list of ids */
  order: NodeId[];
  /** var occurrence id → the quantifier binding it (absent: free) */
  binder: Map<NodeId, NodeId>;
  /** quantifier id → occurrences it binds (not counting the variable written after it) */
  bound: Map<NodeId, NodeId[]>;
  /** variable index → its free occurrences */
  free: Map<number, NodeId[]>;
  /** ids of the variable written right after a quantifier */
  binderVars: Set<NodeId>;
}

export function analyze(root: Node): Analysis {
  const byId = new Map<NodeId, Node>();
  const parent = new Map<NodeId, NodeId | null>();
  const order: NodeId[] = [];
  walk(root, (n, p) => {
    byId.set(n.id, n);
    parent.set(n.id, p ? p.id : null);
    order.push(n.id);
  });
  const binder = new Map<NodeId, NodeId>();
  const bound = new Map<NodeId, NodeId[]>();
  const free = new Map<number, NodeId[]>();
  const binderVars = new Set<NodeId>();
  const go = (n: Node, scopes: { id: NodeId; index: number }[]) => {
    if (n.k === 'var') {
      const b = [...scopes].reverse().find((s) => s.index === n.index);
      if (b) {
        binder.set(n.id, b.id);
        bound.get(b.id)!.push(n.id);
      } else {
        if (!free.has(n.index)) free.set(n.index, []);
        free.get(n.index)!.push(n.id);
      }
      return;
    }
    if (n.k === 'forall' || n.k === 'exists') {
      bound.set(n.id, []);
      binderVars.add(n.v.id);
      go(n.body, [...scopes, { id: n.id, index: n.v.index }]);
      return;
    }
    for (const c of children(n)) go(c, scopes);
  };
  go(root, []);
  return { root, byId, parent, order, binder, bound, free, binderVars };
}

/** The ids of a node and all its descendants. */
export function subtreeIds(a: Analysis, id: NodeId): NodeId[] {
  const n = a.byId.get(id);
  if (!n) return [id];
  const out: NodeId[] = [];
  walk(n, (m) => out.push(m.id));
  return out;
}

/** The ids related to a node: for an occurrence, its binder and the other occurrences it binds. */
export function related(a: Analysis, id: NodeId): { binder?: NodeId; siblings: NodeId[] } {
  const n = a.byId.get(id);
  if (!n) return { siblings: [] };
  if (n.k === 'var') {
    // The variable written after a quantifier: relate to what that quantifier binds.
    const p = a.parent.get(id);
    if (p && a.binderVars.has(id)) return { binder: p, siblings: a.bound.get(p) ?? [] };
    const b = a.binder.get(id);
    if (b) return { binder: b, siblings: a.bound.get(b) ?? [] };
    return { siblings: a.free.get(n.index) ?? [] };
  }
  if (n.k === 'forall' || n.k === 'exists') return { binder: id, siblings: a.bound.get(id) ?? [] };
  return { siblings: [] };
}

export function isFormula(n: Node): n is Formula {
  return !(n.k === 'var' || n.k === 'const' || n.k === 'app' || n.k === 'numeral');
}
