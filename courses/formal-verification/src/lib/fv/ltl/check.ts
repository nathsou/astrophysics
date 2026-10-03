/**
 * Checking temporal properties of systems (chapter 3), the automata-theoretic way (Vardi and Wolper, 1986):
 * translate the negation of the property into a Büchi automaton, explore the product of the system with that
 * automaton, and look for a fair accepting cycle. If there is one, it is a lasso-shaped counterexample: a path
 * that runs into a cycle that repeats forever while violating the property and treating every fair process
 * fairly. If there is none, the property holds in this instance.
 *
 * Cycles are found with strongly connected components and the Emerson–Lei treatment of fairness: an SCC is fair
 * when each weakly fair actor is either disabled somewhere in it or takes a step in it, and each strongly fair
 * actor that is enabled somewhere in it takes a step in it (otherwise its enabled states are removed and the SCC
 * re-examined). Nested depth-first search is the memory-frugal alternative described in the chapter.
 *
 * Every counterexample is certified independently: its steps are replayed, the property is evaluated on the
 * lasso and found false, and the cycle's fairness is checked.
 */
import type * as A from '../vouch/syntax/ast';
import type { SystemRuntime, State } from '../vouch/interp/system';
import type { EngineOptions, Trace, Verdict } from '../engines';
import { enumerate, type Value } from '../vouch/interp/values';
import { RuntimeFailure } from '../vouch/interp/eval';
import { evalLasso, fromExpr, not, type Atom } from './ltl';
import { toBuchi } from './buchi';
import { describeInstance } from '../explore/explorer';

export interface LtlOptions extends EngineOptions {
  maxStates?: number;
  /** Apply the system's fairness declarations (default true). */
  fairness?: boolean;
  /** Allow stuttering steps (the system pausing) everywhere (default true, as in TLA+). */
  stutter?: boolean;
}

interface SysNode {
  state: State;
  succ: { to: number; actor: string; label: string }[];
  enabled: Set<string>;
  atoms?: boolean[];
}

interface Fairness {
  actor: string;
  strong: boolean;
  label: string;
}

export function checkProperty(rt: SystemRuntime, prop: A.PropDecl, opts: LtlOptions = {}): Verdict {
  const t0 = Date.now();
  const checked = rt.checked;
  const atoms: Atom[] = [];
  const phi = fromExpr(prop.expr, atoms, {
    bind: new Map(),
    domain: (b) => {
      const s = checked.refs.get(b)!;
      return enumerate(s.ty) ?? [];
    },
    sym: (b) => checked.refs.get(b)!.id,
  });
  const aut = toBuchi(not(phi));
  const subject = `property ${prop.name ?? ''}`.trim();
  const instance = describeInstance(rt);
  const fair: Fairness[] = [];
  if (opts.fairness ?? true) {
    for (const f of rt.info.fairness) {
      for (const t of f.targets) {
        if (rt.info.actions.some((a) => a.decl.name === t.name)) fair.push({ actor: `a:${t.name}`, strong: f.strength === 'strong', label: `${f.strength} fairness of ${t.name}` });
        rt.instances.forEach((inst, i) => {
          if (inst.proc.decl.name === t.name) fair.push({ actor: `p:${i}`, strong: f.strength === 'strong', label: `${f.strength} fairness of ${inst.name}` });
        });
      }
    }
  }

  // ── The system's state graph, built on demand ──
  const sys: SysNode[] = [];
  const sysIndex = new Map<string, number>();
  const sysNode = (s: State): number => {
    const k = rt.key(s);
    let i = sysIndex.get(k);
    if (i === undefined) {
      i = sys.length;
      sys.push({ state: s, succ: [], enabled: new Set() });
      sysIndex.set(k, i);
      pending.push(i);
    }
    return i;
  };
  const pending: number[] = [];
  const atomVals = (i: number): boolean[] => {
    const n = sys[i]!;
    if (!n.atoms) {
      const env = rt.env(n.state);
      n.atoms = atoms.map((a) => {
        const e = { ...env, vals: new Map([...env.vals, ...a.bind]) };
        return !!rt.runner.ev.eval(a.expr, e);
      });
    }
    return n.atoms;
  };
  const expandSys = (i: number) => {
    const n = sys[i]!;
    const { succs, failures } = rt.successors(n.state);
    if (failures.length) throw failures[0]!.failure;
    for (const s of succs) {
      const actor = s.label.kind === 'process' ? `p:${s.label.instance}` : `a:${s.label.name}`;
      n.enabled.add(actor);
      n.succ.push({ to: sysNode(s.state), actor, label: s.label.text });
    }
    // Stuttering: the system may pause (as in TLA+). Without fairness, nothing forces it to move on, so a
    // liveness property can fail by stuttering forever; fairness rules out the unfair pauses.
    if (opts.stutter ?? true) n.succ.push({ to: i, actor: 'stutter', label: succs.length ? '(the system pauses)' : '(nothing can move)' });
    else if (!succs.length) n.succ.push({ to: i, actor: 'stutter', label: '(nothing can move)' });
  };

  try {
    // ── The product, explored breadth-first from the initial pairs ──
    const { states: inits } = rt.initial();
    const prodIndex = new Map<string, number>();
    const prod: { s: number; q: number; succ: { to: number; actor: string; label: string }[]; parent: number }[] = [];
    const matches = (s: number, q: number) => {
      const v = atomVals(s);
      const node = aut.nodes[q]!;
      return node.pos.every((a) => v[a]) && node.neg.every((a) => !v[a]);
    };
    const addProd = (s: number, q: number, parent: number): number => {
      const k = `${s}:${q}`;
      let i = prodIndex.get(k);
      if (i === undefined) {
        i = prod.length;
        prod.push({ s, q, succ: [], parent });
        prodIndex.set(k, i);
      }
      return i;
    };
    const roots: number[] = [];
    for (const s0 of inits) {
      const s = sysNode(s0);
      for (const q of aut.initial) if (matches(s, q)) roots.push(addProd(s, q, -1));
    }
    const max = opts.maxStates ?? 2_000_000;
    let budgetHit = false;
    for (let i = 0; i < prod.length; i++) {
      if (opts.signal?.aborted || (opts.timeout && Date.now() - t0 > opts.timeout)) {
        budgetHit = true;
        break;
      }
      if (prod.length > max) {
        budgetHit = true;
        break;
      }
      const p = prod[i]!;
      const sn = sys[p.s]!;
      if (!sn.succ.length) expandSys(p.s);
      for (const e of sn.succ) for (const q2 of aut.succ[p.q]!) if (matches(e.to, q2)) p.succ.push({ to: addProd(e.to, q2, i), actor: e.actor, label: e.label });
      if ((i & 1023) === 0) opts.onProgress?.({ stats: { states: sys.length, product: prod.length } });
    }
    const stats = () => ({ states: sys.length, product: prod.length, automaton: aut.nodes.length, ms: Date.now() - t0 });
    if (budgetHit) {
      return { engine: 'ltl', status: 'timeout', subject, badge: { kind: 'unknown', reason: 'the state space is too large for the budget' }, certificate: { kind: 'none', checked: false, checker: '' }, assumptions: [instance], stats: stats(), span: prop.span };
    }

    // ── Fair accepting SCCs ──
    const accepting = aut.accepting;
    const sccOf = (nodes: number[]): number[][] => tarjan(nodes, (v) => prod[v]!.succ.map((e) => e.to));
    const nontrivial = (c: number[]) => c.length > 1 || prod[c[0]!]!.succ.some((e) => e.to === c[0]);
    const findFair = (comp: number[]): number[] | undefined => {
      if (!nontrivial(comp)) return undefined;
      const inC = new Set(comp);
      const taken = new Set<string>();
      for (const v of comp) for (const e of prod[v]!.succ) if (inC.has(e.to)) taken.add(e.actor);
      // Generalised Büchi acceptance.
      for (const F of accepting) if (!comp.some((v) => F.has(prod[v]!.q))) return undefined;
      // Weak fairness: disabled somewhere, or taken.
      for (const f of fair.filter((x) => !x.strong)) {
        if (taken.has(f.actor)) continue;
        if (comp.some((v) => !sys[prod[v]!.s]!.enabled.has(f.actor))) continue;
        return undefined;
      }
      // Strong fairness: if enabled somewhere, it must be taken; otherwise drop the states where it is enabled.
      for (const f of fair.filter((x) => x.strong)) {
        if (taken.has(f.actor)) continue;
        const keep = comp.filter((v) => !sys[prod[v]!.s]!.enabled.has(f.actor));
        if (keep.length === comp.length) continue;
        for (const sub of tarjanWithin(keep, (v) => prod[v]!.succ.map((e) => e.to))) {
          const r = findFair(sub);
          if (r) return r;
        }
        return undefined;
      }
      return comp;
    };
    let fairComp: number[] | undefined;
    for (const comp of sccOf(roots)) {
      fairComp = findFair(comp);
      if (fairComp) break;
    }
    if (!fairComp) {
      return {
        engine: 'ltl',
        status: 'verified',
        subject,
        badge: { kind: 'exhaustive', states: sys.length, instance },
        certificate: { kind: 'state-space', checked: false, checker: 'the model checker itself (no independent certificate)', detail: `No fair cycle violates the property among ${prod.length.toLocaleString('en-GB')} product states.` },
        assumptions: [instance, ...fair.map((f) => f.label)],
        stats: stats(),
        span: prop.span,
      };
    }

    // ── Build the lasso ──
    const comp = new Set(fairComp);
    const entry = fairComp.reduce((best, v) => (pathLen(prod, v) < pathLen(prod, best) ? v : best), fairComp[0]!);
    const prefix: number[] = [];
    for (let v = entry; v >= 0; v = prod[v]!.parent) prefix.unshift(v);
    // Waypoints in the cycle: one node per acceptance set, one edge per fair actor that can move.
    const waypoints: { node?: number; actor?: string }[] = [];
    for (const F of accepting) {
      const n = fairComp.find((v) => F.has(prod[v]!.q));
      if (n !== undefined) waypoints.push({ node: n });
    }
    for (const f of fair) {
      const edge = fairComp.find((v) => prod[v]!.succ.some((e) => e.actor === f.actor && comp.has(e.to)));
      if (edge !== undefined) waypoints.push({ actor: f.actor });
      else if (!f.strong) {
        const off = fairComp.find((v) => !sys[prod[v]!.s]!.enabled.has(f.actor));
        if (off !== undefined) waypoints.push({ node: off });
      }
    }
    const cyclePath = cycleThrough(entry, waypoints, comp, prod);
    const loopNodes = cyclePath; // starts at entry, ends just before returning to entry
    const allNodes = [...prefix, ...loopNodes.slice(1)];
    const labels: string[] = [];
    const actors: string[] = [];
    const nodesSeq = [...prefix, ...loopNodes.slice(1), entry];
    for (let k = 0; k + 1 < nodesSeq.length; k++) {
      const e = prod[nodesSeq[k]!]!.succ.find((x) => x.to === nodesSeq[k + 1]);
      labels.push(e?.label ?? '?');
      actors.push(e?.actor ?? '?');
    }
    const trace: Trace = {
      steps: allNodes.map((v, i) => ({
        label: i ? labels[i - 1] : undefined,
        actor: i ? actors[i - 1] : undefined,
        state: { values: rt.describe(sys[prod[v]!.s]!.state) },
      })),
      loopsTo: prefix.length - 1,
    };
    // ── Certificate: replay, evaluate the property on the lasso, check the cycle's fairness ──
    const lassoStates = allNodes.map((v) => sys[prod[v]!.s]!);
    const replayed = certifyLasso(rt, lassoStates, labels, prefix.length - 1, atoms, phi, fair, actors);
    return {
      engine: 'ltl',
      status: 'violated',
      subject,
      badge: { kind: 'violated', replayed },
      certificate: { kind: 'lasso', checked: replayed, checker: 'lasso replay: steps re-executed, property evaluated on the lasso, fairness of the cycle checked' },
      assumptions: [instance, ...fair.map((f) => f.label)],
      stats: stats(),
      trace,
      message: `A run that ${prefix.length > 1 ? `starts with ${prefix.length - 1} step${prefix.length === 2 ? '' : 's'} and then ` : ''}repeats a cycle of ${loopNodes.length} step${loopNodes.length === 1 ? '' : 's'} forever violates the property.`,
      span: prop.span,
    };
  } catch (e) {
    if (e instanceof RuntimeFailure) return { engine: 'ltl', status: 'error', subject, badge: { kind: 'error', reason: e.message }, certificate: { kind: 'none', checked: false, checker: '' }, assumptions: [], stats: {}, message: e.message, span: e.span };
    throw e;
  }
}

function pathLen(prod: { parent: number }[], v: number): number {
  let n = 0;
  for (let k = v; k >= 0; k = prod[k]!.parent) n++;
  return n;
}

/** A cycle from `entry` back to `entry` inside `comp` that passes the waypoints (nodes, or edges by an actor). */
function cycleThrough(entry: number, waypoints: { node?: number; actor?: string }[], comp: Set<number>, prod: { succ: { to: number; actor: string }[] }[]): number[] {
  // Shortest non-empty path from `from` whose last edge satisfies `goal`; returns the nodes after `from`.
  const shortest = (from: number, goal: (e: { to: number; actor: string }) => boolean): number[] => {
    const parent = new Map<number, number>();
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const v = queue.shift()!;
      for (const e of prod[v]!.succ) {
        if (!comp.has(e.to)) continue;
        if (goal(e)) {
          const out = [e.to];
          for (let k = v; k !== from; k = parent.get(k)!) out.unshift(k);
          return out;
        }
        if (!seen.has(e.to)) {
          seen.add(e.to);
          parent.set(e.to, v);
          queue.push(e.to);
        }
      }
    }
    return [];
  };
  const path: number[] = [entry];
  let cur = entry;
  for (const w of waypoints) {
    if (w.node !== undefined && w.node === cur) continue;
    const seg = w.node !== undefined ? shortest(cur, (e) => e.to === w.node) : shortest(cur, (e) => e.actor === w.actor);
    path.push(...seg);
    if (seg.length) cur = seg[seg.length - 1]!;
  }
  const back = shortest(cur, (e) => e.to === entry);
  path.push(...back.slice(0, -1));
  return path;
}

function certifyLasso(rt: SystemRuntime, nodes: SysNode[], labels: string[], loop: number, atoms: Atom[], phi: ReturnType<typeof not>, fair: Fairness[], actors: string[]): boolean {
  // 1. Every step is a real step of the system (or stuttering in a state with no step).
  const keys = nodes.map((n) => rt.key(n.state));
  for (let i = 0; i < nodes.length; i++) {
    const nextKey = i + 1 < nodes.length ? keys[i + 1] : keys[loop];
    const { succs } = rt.successors(nodes[i]!.state);
    const stutter = labels[i]!.startsWith('(') && nextKey === keys[i];
    const ok = stutter || succs.some((s) => s.label.text === labels[i] && rt.key(s.state) === nextKey);
    if (!ok) return false;
  }
  // 2. The property is false on the lasso.
  const vals = nodes.map((n) => {
    const env = rt.env(n.state);
    return atoms.map((a) => !!rt.runner.ev.eval(a.expr, { ...env, vals: new Map([...env.vals, ...a.bind]) }));
  });
  if (evalLasso(phi, nodes.length, loop, (i, a) => vals[i]![a]!)) return false;
  // 3. The cycle is fair.
  const cycleActors = new Set(actors.slice(loop));
  const cycle = nodes.slice(loop);
  for (const f of fair) {
    if (cycleActors.has(f.actor)) continue;
    const enabledAt = cycle.map((n) => rt.successors(n.state).succs.some((s) => (s.label.kind === 'process' ? `p:${s.label.instance}` : `a:${s.label.name}`) === f.actor));
    if (f.strong ? enabledAt.some(Boolean) : enabledAt.every(Boolean)) return false;
  }
  return true;
}

/** Tarjan's strongly connected components, iteratively, over the nodes reachable from `roots`. */
export function tarjan(roots: number[], succ: (v: number) => number[]): number[][] {
  return tarjanCore(roots, succ, () => true);
}

/** SCCs of the subgraph induced by `nodes`. */
function tarjanWithin(nodes: number[], succ: (v: number) => number[]): number[][] {
  const allowed = new Set(nodes);
  return tarjanCore(nodes, (v) => succ(v).filter((w) => allowed.has(w)), (v) => allowed.has(v));
}

function tarjanCore(roots: number[], succ: (v: number) => number[], allowed: (v: number) => boolean): number[][] {
  const index = new Map<number, number>();
  const low = new Map<number, number>();
  const onStack = new Set<number>();
  const stack: number[] = [];
  const out: number[][] = [];
  let counter = 0;
  for (const r of roots) {
    if (index.has(r) || !allowed(r)) continue;
    const work: { v: number; kids: number[]; i: number }[] = [{ v: r, kids: succ(r), i: 0 }];
    index.set(r, counter);
    low.set(r, counter++);
    stack.push(r);
    onStack.add(r);
    while (work.length) {
      const top = work[work.length - 1]!;
      if (top.i < top.kids.length) {
        const w = top.kids[top.i++]!;
        if (!index.has(w)) {
          index.set(w, counter);
          low.set(w, counter++);
          stack.push(w);
          onStack.add(w);
          work.push({ v: w, kids: succ(w), i: 0 });
        } else if (onStack.has(w)) low.set(top.v, Math.min(low.get(top.v)!, index.get(w)!));
      } else {
        work.pop();
        if (work.length) {
          const parent = work[work.length - 1]!.v;
          low.set(parent, Math.min(low.get(parent)!, low.get(top.v)!));
        }
        if (low.get(top.v) === index.get(top.v)) {
          const comp: number[] = [];
          let w: number;
          do {
            w = stack.pop()!;
            onStack.delete(w);
            comp.push(w);
          } while (w !== top.v);
          out.push(comp);
        }
      }
    }
  }
  return out;
}

export type { Value };
