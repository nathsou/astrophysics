/**
 * The explicit-state explorer (Part I): breadth-first search over every reachable state of a system, checking
 * invariants (and, optionally, deadlock) in each one. BFS finds a shortest counterexample. Every counterexample is
 * replayed through the reference semantics before it is reported; with symmetry reduction the replay also turns
 * the canonical representatives back into a concrete path.
 *
 * The search is incremental (`Exploration.run(budget)`), so the state-space widget can animate it, and it can keep
 * the graph it explores for drawing.
 */
import type { SystemRuntime, State, StepLabel } from '../vouch/interp/system';
import type { Verdict, Trace, EngineOptions } from '../engines';
import type * as A from '../vouch/syntax/ast';
import { RuntimeFailure } from '../vouch/interp/eval';
import { canonicalizer } from './symmetry';

export interface ExploreOptions extends EngineOptions {
  /** Invariants to check, by name (default: all). */
  invariants?: string[];
  /** Report states with no enabled step (and processes not finished) as deadlocks. */
  deadlock?: boolean;
  /** Stop after this many states (the badge then says "bounded"). */
  maxStates?: number;
  /** Identify states that differ only by a permutation of a `symmetric type`. */
  symmetry?: boolean;
  /** Keep nodes and edges for drawing (small systems only). */
  keepGraph?: boolean;
  /** Stop at the first violation (default true). */
  stopAtFirst?: boolean;
}

export interface GraphNode {
  id: number;
  depth: number;
  key: string;
  initial: boolean;
  /** Names of the invariants this state violates. */
  bad: string[];
  deadlock: boolean;
}

export interface GraphEdge {
  from: number;
  to: number;
  label: string;
  actor: string;
}

interface Entry {
  state: State;
  parent: number;
  label?: StepLabel;
  depth: number;
}

export class Exploration {
  readonly entries: Entry[] = [];
  readonly index = new Map<string, number>();
  private frontier = 0;
  readonly invariants: { name: string; expr: A.Expr; span: A.Node['span'] }[];
  readonly violations = new Map<string, { at: number; failure?: RuntimeFailure; stepLabel?: StepLabel }>();
  transitions = 0;
  done = false;
  readonly nodes: GraphNode[] = [];
  readonly edges: GraphEdge[] = [];
  private canon: (s: State) => string;
  readonly started = Date.now();
  stepFailure?: { from: number; label: StepLabel; failure: RuntimeFailure };

  constructor(
    readonly rt: SystemRuntime,
    readonly opts: ExploreOptions = {},
  ) {
    this.invariants = rt.info.invariants
      .filter((i) => !opts.invariants || opts.invariants.includes(i.name ?? ''))
      .map((i, k) => ({ name: i.name ?? `invariant ${k + 1}`, expr: i.expr, span: i.span }));
    this.canon = opts.symmetry ? canonicalizer(rt) : (s) => rt.key(s);
    const { states, failures } = rt.initial();
    if (failures.length) this.stepFailure = { from: -1, label: failures[0]!.label, failure: failures[0]!.failure };
    for (const s of states) this.add(s, -1, undefined, 0);
  }

  private add(s: State, parent: number, label: StepLabel | undefined, depth: number): number {
    const k = this.canon(s);
    const existing = this.index.get(k);
    if (existing !== undefined) return existing;
    const id = this.entries.length;
    this.entries.push({ state: s, parent, label, depth });
    this.index.set(k, id);
    const bad: string[] = [];
    for (const inv of this.invariants) {
      if (this.violations.has(inv.name)) continue;
      try {
        if (!this.rt.holds(inv.expr, s)) {
          bad.push(inv.name);
          this.violations.set(inv.name, { at: id });
        }
      } catch (e) {
        if (!(e instanceof RuntimeFailure)) throw e;
        bad.push(inv.name);
        this.violations.set(inv.name, { at: id, failure: e });
      }
    }
    if (this.opts.keepGraph) this.nodes.push({ id, depth, key: k, initial: parent < 0, bad, deadlock: false });
    return id;
  }

  get size(): number {
    return this.entries.length;
  }

  /** Expand up to `budget` states. Returns true when the search is over. */
  run(budget = Infinity): boolean {
    const max = this.opts.maxStates ?? Infinity;
    const stopAtFirst = this.opts.stopAtFirst ?? true;
    let n = 0;
    while (this.frontier < this.entries.length && n < budget) {
      if (this.opts.signal?.aborted) return (this.done = true);
      if (stopAtFirst && (this.violations.size > 0 || this.stepFailure)) return (this.done = true);
      if (this.entries.length >= max) return (this.done = true);
      const id = this.frontier++;
      const e = this.entries[id]!;
      const { succs, failures } = this.rt.successors(e.state);
      if (failures.length && !this.stepFailure) this.stepFailure = { from: id, label: failures[0]!.label, failure: failures[0]!.failure };
      if (this.opts.deadlock && !succs.length && !this.allDone(e.state)) {
        if (!this.violations.has('deadlock')) this.violations.set('deadlock', { at: id });
        if (this.opts.keepGraph) this.nodes[id]!.deadlock = true;
      }
      for (const s of succs) {
        this.transitions++;
        const to = this.add(s.state, id, s.label, e.depth + 1);
        if (this.opts.keepGraph) this.edges.push({ from: id, to, label: s.label.text, actor: s.label.kind === 'process' ? `p${s.label.instance}` : s.label.name });
      }
      n++;
    }
    if (this.frontier >= this.entries.length) this.done = true;
    return this.done;
  }

  allDone(s: State): boolean {
    if (!this.rt.instances.length) return false;
    return this.rt.instances.every((_, i) => this.rt.pcLabel(s, i) === 'done');
  }

  /** The path of states and labels from an initial state to entry `id`. */
  path(id: number): { states: State[]; labels: StepLabel[] } {
    const states: State[] = [];
    const labels: StepLabel[] = [];
    for (let k = id; k >= 0; k = this.entries[k]!.parent) {
      states.unshift(this.entries[k]!.state);
      const l = this.entries[k]!.label;
      if (l) labels.unshift(l);
    }
    return { states, labels };
  }

  /** Statistics so far. */
  stats(): Record<string, number> {
    const depth = this.entries.length ? this.entries[this.entries.length - 1]!.depth : 0;
    return { states: this.entries.length, transitions: this.transitions, depth, ms: Date.now() - this.started };
  }
}

/**
 * Replay a path through the reference semantics: from a real initial state, each label must lead to a state with
 * the same canonical key. Returns the concrete states, or undefined if the path is not real.
 */
export function replay(rt: SystemRuntime, path: { states: State[]; labels: StepLabel[] }, canon: (s: State) => string): State[] | undefined {
  const { states: inits } = rt.initial();
  const first = inits.find((s) => canon(s) === canon(path.states[0]!));
  if (!first) return undefined;
  let cur: State = first;
  const out: State[] = [cur];
  for (let i = 0; i < path.labels.length; i++) {
    const want = canon(path.states[i + 1]!);
    const next: { state: State } | undefined = rt.successors(cur).succs.find((s) => canon(s.state) === want);
    if (!next) return undefined;
    cur = next.state;
    out.push(cur);
  }
  return out;
}

export function toTrace(rt: SystemRuntime, states: State[], labels: StepLabel[]): Trace {
  return {
    steps: states.map((s, i) => ({
      label: i ? labels[i - 1]!.text : undefined,
      actor: i ? (labels[i - 1]!.kind === 'process' ? `p${labels[i - 1]!.instance}` : labels[i - 1]!.name) : undefined,
      state: { values: rt.describe(s) },
    })),
  };
}

/** Run the explorer to completion and report one verdict per invariant (and for deadlock, if asked). */
export function explore(rt: SystemRuntime, opts: ExploreOptions = {}): { verdicts: Verdict[]; exploration: Exploration } {
  const x = new Exploration(rt, opts);
  const timeout = opts.timeout ? Date.now() + opts.timeout : Infinity;
  while (!x.run(2000)) {
    opts.onProgress?.({ stats: x.stats() });
    if (Date.now() > timeout) break;
  }
  const canon = opts.symmetry ? canonicalizer(rt) : (s: State) => rt.key(s);
  const instance = describeInstance(rt);
  const complete = x.done && !opts.signal?.aborted && !(opts.maxStates && x.size >= opts.maxStates) && Date.now() <= timeout;
  const verdicts: Verdict[] = [];
  const names = [...x.invariants.map((i) => i.name), ...(opts.deadlock ? ['deadlock'] : [])];
  for (const name of names) {
    const v = x.violations.get(name);
    const inv = x.invariants.find((i) => i.name === name);
    if (v) {
      const p = x.path(v.at);
      const concrete = replay(rt, p, canon);
      const replayed = !!concrete && (name === 'deadlock' || !!v.failure || !rt.holds(inv!.expr, concrete.at(-1)!));
      verdicts.push({
        engine: 'explore',
        status: 'violated',
        subject: name === 'deadlock' ? 'no deadlock' : `invariant ${name}`,
        badge: { kind: 'violated', replayed },
        certificate: { kind: 'trace', checked: replayed, checker: 'trace replay by the reference interpreter' },
        assumptions: [instance],
        stats: x.stats(),
        trace: toTrace(rt, concrete ?? p.states, p.labels),
        message: v.failure ? v.failure.message : name === 'deadlock' ? `A reachable state where nothing can move (${p.labels.length} steps from the start).` : `The invariant ${name} fails after ${p.labels.length} step${p.labels.length === 1 ? '' : 's'}.`,
        span: inv?.span,
      });
    } else if (x.stepFailure) {
      const p = x.stepFailure.from >= 0 ? x.path(x.stepFailure.from) : { states: [], labels: [] };
      verdicts.push({
        engine: 'explore',
        status: 'violated',
        subject: name === 'deadlock' ? 'no deadlock' : `invariant ${name}`,
        badge: { kind: 'violated', replayed: true },
        certificate: { kind: 'trace', checked: true, checker: 'trace replay by the reference interpreter' },
        assumptions: [instance],
        stats: x.stats(),
        trace: p.states.length ? toTrace(rt, p.states, p.labels) : undefined,
        message: `The step ${x.stepFailure.label.text} fails: ${x.stepFailure.failure.message}`,
        span: x.stepFailure.failure.span,
      });
    } else if (complete) {
      verdicts.push({
        engine: 'explore',
        status: 'verified',
        subject: name === 'deadlock' ? 'no deadlock' : `invariant ${name}`,
        badge: { kind: 'exhaustive', states: x.size, instance },
        certificate: { kind: 'state-space', checked: false, checker: 'the explorer itself (no independent certificate)', detail: 'Every reachable state was visited.' },
        assumptions: [instance, ...(opts.symmetry ? ['states that differ by a permutation of a symmetric type behave alike'] : [])],
        stats: x.stats(),
        span: inv?.span,
      });
    } else {
      verdicts.push({
        engine: 'explore',
        status: opts.signal?.aborted ? 'unknown' : 'timeout',
        subject: name === 'deadlock' ? 'no deadlock' : `invariant ${name}`,
        badge: { kind: 'bounded', bound: x.stats().depth!, what: 'depth' },
        certificate: { kind: 'none', checked: false, checker: '' },
        assumptions: [instance],
        stats: x.stats(),
        message: `Stopped after ${x.size.toLocaleString('en-GB')} states without finding a violation.`,
        span: inv?.span,
      });
    }
  }
  return { verdicts, exploration: x };
}

export function describeInstance(rt: SystemRuntime): string {
  const sizes = rt.info.atoms.filter((a) => a.k === 'atom').map((a) => `${(a as { size?: number }).size ?? 0} ${(a as { name: string }).name}${(a as { size?: number }).size === 1 ? '' : 's'}`);
  return sizes.length ? `this instance (${sizes.join(', ')})` : `system ${rt.info.decl.name}`;
}
