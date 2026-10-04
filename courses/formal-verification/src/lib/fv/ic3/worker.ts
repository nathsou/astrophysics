/**
 * k-induction and IC3 in a Web Worker, for the widgets of chapters 23 and 24. Results are posted as soon as they
 * are known; the certificates (DRAT checks of the final queries, which take longer than the proofs) follow.
 */
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { SystemRuntime, type State } from '../vouch/interp/system';
import { key } from '../vouch/interp/values';
import { BmcError } from '../bmc/symbolic';
import { RuntimeFailure } from '../vouch/interp/eval';
import { toTrace } from '../explore/explorer';
import type { Trace } from '../engines';
import { KInduction } from './kind';
import { Ic3, type Ic3Snapshot } from './ic3';
import { allStates, inCube, type Lit } from './model';

export type InductionRequest =
  | { engine: 'kind'; source: string; system?: string; k: number; timeout: number; certifyBudget: number }
  | { engine: 'ic3'; source: string; system?: string; timeout: number; certifyBudget: number; states?: boolean };

export interface ShownState {
  values: { name: string; value: string; kind: string }[];
  /** Truth of each invariant in this state. */
  holds: boolean[];
}

export type InductionEvent =
  | { kind: 'error'; message: string }
  | { kind: 'invariants'; names: string[] }
  | { kind: 'base'; depth: number; violations: { name: string; replayed: boolean; trace?: Trace; length: number }[] }
  | { kind: 'step'; k: number; inductive: boolean; cti?: ShownState[]; failing?: string[]; timedOut?: boolean }
  | { kind: 'ic3'; status: 'proved' | 'violated' | 'unknown'; frames: number; invariant?: string[]; trace?: Trace; replayed?: boolean; violated?: string; log: ShownSnapshot[]; states?: StateDot[]; stats: Record<string, number> }
  | { kind: 'certified'; checked: boolean; stopped: boolean; proofLines: number }
  | { kind: 'done' };

/** A snapshot of IC3 with cubes as text and, when the states are enumerated, each state's smallest frame. */
export interface ShownSnapshot {
  event: string;
  level?: number;
  frames: string[][];
  obligations: { level: number; cube: string }[];
  /** For each state (same order as `states`): 0 if initial, i if in Fi (smallest), frames + 1 if in none. */
  levels?: number[];
  /** The cube of the event, as the indices of the states it covers. */
  focus?: number[];
}

export interface StateDot {
  values: { name: string; value: string; kind: string }[];
  reachable: boolean;
  bad: boolean;
  initial: boolean;
}

const post = (e: InductionEvent) => postMessage(e);

function load(source: string, system?: string): SystemRuntime {
  const p = parse(source);
  const c = check(p.program);
  const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
  if (errs.length) throw new BmcError(errs.map((e) => e.message).join(' '));
  const sys = c.program.decls.find((d) => d.k === 'system') as { name: string } | undefined;
  const name = system ?? sys?.name;
  if (!name) throw new BmcError('The code has no system.');
  return new SystemRuntime(c, name);
}

function runKind(req: Extract<InductionRequest, { engine: 'kind' }>) {
  const rt = load(req.source, req.system);
  const names = rt.info.invariants.map((i) => i.name ?? 'invariant');
  post({ kind: 'invariants', names });
  const K = new KInduction(rt, { timeout: req.timeout, certifyBudget: 0 });
  const v = K.checkBase(req.k);
  post({ kind: 'base', depth: req.k - 1, violations: v.map((p) => ({ name: p.name, replayed: !!p.replayed, trace: p.states?.length ? toTrace(rt, p.states, p.labels ?? []) : undefined, length: p.foundAt ?? 0 })) });
  const r = K.checkStep(req.k);
  const shown = (vals: State['vals']): ShownState => ({ values: rt.describe({ vals }), holds: rt.info.invariants.map((i) => rt.holds(i.expr, { vals })) });
  post({ kind: 'step', k: req.k, inductive: r.inductive, cti: r.cti?.states.map(shown), failing: r.cti?.failing, timedOut: !r.inductive && !r.cti });
  if (r.inductive && !v.length && req.certifyBudget > 0) {
    const c = K.certify(req.k, Date.now() + req.certifyBudget);
    post({ kind: 'certified', checked: c.base.checked && c.step.checked, stopped: !!(c.base.stopped || c.step.stopped), proofLines: (c.base.proofLines ?? 0) + (c.step.proofLines ?? 0) });
  }
}

function runIc3(req: Extract<InductionRequest, { engine: 'ic3' }>) {
  const rt = load(req.source, req.system);
  post({ kind: 'invariants', names: rt.info.invariants.map((i) => i.name ?? 'invariant') });
  const engine = new Ic3(rt, { timeout: req.timeout, record: true, certifyBudget: 0 });
  const m = engine.m;
  const r = engine.run();
  // The state space, when it is small enough to draw.
  let states: StateDot[] | undefined;
  let models: boolean[][] | undefined;
  if (req.states) {
    models = allStates(m, 400);
    if (models) {
      const reach = new Set<string>();
      const init = rt.initial().states;
      const queue = [...init];
      const k = (s: State) => s.vals.map(key).join('|');
      init.forEach((s) => reach.add(k(s)));
      while (queue.length && reach.size < 5000) {
        const s = queue.pop()!;
        for (const t of rt.successors(s).succs) if (!reach.has(k(t.state))) (reach.add(k(t.state)), queue.push(t.state));
      }
      const initKeys = new Set(init.map(k));
      states = models.map((mod) => {
        const vals = m.decode(mod);
        const st = { vals };
        return { values: rt.describe(st), reachable: reach.has(k(st)), initial: initKeys.has(k(st)), bad: rt.info.invariants.some((i) => !rt.holds(i.expr, st)) };
      });
    }
  }
  const showCube = (c: Lit[]) => c.map((l) => m.showLit(l)).join(' && ');
  const levelOf = (snap: Ic3Snapshot, mod: boolean[], i: number): number => {
    if (states![i]!.initial) return 0;
    const N = snap.frames.length - 1;
    for (let lv = 1; lv <= N; lv++) if (!snap.frames.slice(lv).some((cs) => cs.some((c) => inCube(mod, c)))) return lv;
    return N + 1;
  };
  const eventCube = (s: Ic3Snapshot): Lit[] | undefined => ('cube' in s.event ? s.event.cube : 'clause' in s.event ? s.event.clause : undefined);
  const log: ShownSnapshot[] = r.log.map((s) => {
    const cube = s.event.k === 'blocked' ? s.event.clause : eventCube(s);
    return {
      event: describe(s, showCube),
      level: 'level' in s.event ? s.event.level : 'from' in s.event ? s.event.from : undefined,
      frames: s.frames.map((cs) => cs.map(showCube)),
      obligations: s.obligations.map((o) => ({ level: o.level, cube: showCube(o.cube) })),
      levels: models ? models.map((mod, i) => levelOf(s, mod, i)) : undefined,
      focus: models && cube ? models.flatMap((mod, i) => (inCube(mod, cube) ? [i] : [])) : undefined,
    };
  });
  post({ kind: 'ic3', status: r.status, frames: r.frames, invariant: r.invariant?.text, trace: r.trace?.trace, replayed: r.trace?.replayed, violated: r.trace?.violated, log, states, stats: r.stats });
  if (r.status === 'proved' && r.invariant && req.certifyBudget > 0) {
    const c = engine.certifyInvariant(r.invariant.cubes, Date.now() + req.certifyBudget);
    post({ kind: 'certified', checked: c.init.checked && c.step.checked && c.implies.checked, stopped: !!(c.init.stopped || c.step.stopped || c.implies.stopped), proofLines: (c.init.proofLines ?? 0) + (c.step.proofLines ?? 0) + (c.implies.proofLines ?? 0) });
  }
}

function describe(s: Ic3Snapshot, show: (c: Lit[]) => string): string {
  const e = s.event;
  switch (e.k) {
    case 'bad':
      return `F${e.level} contains a bad state: ${show(e.cube)}. Can it be reached in ${e.level} step${e.level === 1 ? '' : 's'}?`;
    case 'predecessor':
      return `It has a predecessor in F${e.level}: ${show(e.cube)}. That becomes a proof obligation at level ${e.level}.`;
    case 'blocked':
      return `Blocked at level ${e.level}: no state of F${e.level - 1} leads to it. Generalised, the clause ¬(${show(e.clause)}) is added to F1 … F${e.level}.`;
    case 'frame':
      return `A new frame F${e.level} (at first: every state).`;
    case 'propagated':
      return `The clause ¬(${show(e.clause)}) also holds in F${e.from + 1}: no state of F${e.from} leaves it.`;
    case 'fixpoint':
      return `F${e.level} and F${e.level + 1} have the same clauses: F${e.level} is an inductive invariant.`;
    case 'counterexample':
      return `The obligation reaches an initial state: a counterexample of ${e.length} step${e.length === 1 ? '' : 's'}.`;
  }
}

addEventListener('message', (e: MessageEvent<InductionRequest>) => {
  try {
    if (e.data.engine === 'kind') runKind(e.data);
    else runIc3(e.data);
  } catch (err) {
    post({ kind: 'error', message: err instanceof BmcError || err instanceof RuntimeFailure ? err.message : String(err) });
  }
  post({ kind: 'done' });
});
