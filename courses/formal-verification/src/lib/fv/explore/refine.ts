/**
 * Refinement checking (chapter 4): does every behaviour of an implementation, seen through a refinement mapping,
 * look like a behaviour of its specification? The mapping turns each implementation state into a specification
 * state (by default, variables with the same name). Then:
 *
 *   - every initial state must map to an initial state of the specification, and
 *   - every step must map either to a step the specification allows, or to no change at all (a *stuttering*
 *     step: the implementation did something the specification does not see, such as sending a message).
 *
 * This is how TLA+ checks that one specification implements another (Lamport 1994): refinement is implication,
 * and stuttering is what lets a detailed system take more steps than an abstract one.
 */
import type { Checked } from '../vouch/check/checker';
import { SystemRuntime, type State, type StepLabel } from '../vouch/interp/system';
import type { Verdict } from '../engines';
import { describeInstance, toTrace } from './explorer';
import { canonicalizer } from './symmetry';
import { show } from '../vouch/interp/values';

export interface RefinementOptions {
  timeout?: number;
  signal?: AbortSignal;
  maxStates?: number;
}

export class Refinement {
  readonly impl: SystemRuntime;
  readonly spec: SystemRuntime;
  private specSucc = new Map<string, Map<string, string>>();

  constructor(checked: Checked, implName: string) {
    this.impl = new SystemRuntime(checked, implName);
    const r = this.impl.info.refines;
    if (!r) throw new Error(`${implName} does not declare what it refines.`);
    this.spec = new SystemRuntime(checked, r.spec);
  }

  /** The specification state an implementation state stands for. */
  abstract(s: State): State {
    const r = this.impl.info.refines!;
    const env = this.impl.env(s);
    const vals = this.spec.info.vars.map((v) => {
      const m = r.mapping.find((x) => x.name === v.name);
      if (m) return this.impl.runner.ev.eval(m.value, env);
      const i = this.impl.info.vars.findIndex((w) => w.name === v.name);
      return s.vals[i]!;
    });
    return { vals };
  }

  /** The specification step from a to b (its label), "stutter" when a = b, or undefined when it is not allowed. */
  abstractStep(a: State, b: State): string | undefined {
    const ka = this.spec.key(a);
    const kb = this.spec.key(b);
    if (ka === kb) return 'stutter';
    let m = this.specSucc.get(ka);
    if (!m) {
      m = new Map();
      for (const x of this.spec.successors(a).succs) if (!m.has(this.spec.key(x.state))) m.set(this.spec.key(x.state), x.label.text);
      this.specSucc.set(ka, m);
    }
    return m.get(kb);
  }

  check(opts: RefinementOptions = {}): Verdict {
    const impl = this.impl;
    const specName = this.spec.info.decl.name;
    const subject = `${impl.info.decl.name} refines ${specName}`;
    const t0 = Date.now();
    const deadline = opts.timeout ? t0 + opts.timeout : Infinity;
    const canon = canonicalizer(impl);
    const specInit = new Set(this.spec.initial().states.map((s) => this.spec.key(s)));
    const entries: { state: State; parent: number; label?: StepLabel }[] = [];
    const index = new Map<string, number>();
    const fail = (at: number, extra: { label: StepLabel; state: State } | undefined, why: string): Verdict => {
      const states: State[] = [];
      const labels: StepLabel[] = [];
      for (let k = at; k >= 0; k = entries[k]!.parent) {
        states.unshift(entries[k]!.state);
        if (entries[k]!.label) labels.unshift(entries[k]!.label!);
      }
      if (extra) {
        states.push(extra.state);
        labels.push(extra.label);
      }
      return {
        engine: 'refine',
        status: 'violated',
        subject,
        badge: { kind: 'violated', replayed: true },
        certificate: { kind: 'trace', checked: true, checker: 'the reference interpreter (each step re-executed)' },
        assumptions: [describeInstance(impl)],
        stats: { states: entries.length, ms: Date.now() - t0 },
        trace: toTrace(impl, states, labels),
        message: why,
        span: impl.info.refines!.span,
      };
    };
    for (const s of impl.initial().states) {
      const a = this.abstract(s);
      const k = canon(s);
      if (index.has(k)) continue;
      index.set(k, entries.length);
      entries.push({ state: s, parent: -1 });
      if (!specInit.has(this.spec.key(a))) return fail(entries.length - 1, undefined, `An initial state of ${impl.info.decl.name} maps to ${this.describe(a)}, which is not an initial state of ${specName}.`);
    }
    for (let i = 0; i < entries.length; i++) {
      if (opts.signal?.aborted || Date.now() > deadline || (opts.maxStates && entries.length > opts.maxStates)) {
        return {
          engine: 'refine', status: 'unknown', subject, badge: { kind: 'bounded', bound: entries.length, what: 'states' },
          certificate: { kind: 'none', checked: false, checker: '' }, assumptions: [describeInstance(impl)], stats: { states: entries.length, ms: Date.now() - t0 },
          message: `Stopped after ${entries.length.toLocaleString('en-GB')} states without finding a step the specification forbids.`, span: impl.info.refines!.span,
        };
      }
      const s = entries[i]!.state;
      const a = this.abstract(s);
      for (const x of impl.successors(s).succs) {
        const b = this.abstract(x.state);
        if (this.abstractStep(a, b) === undefined) {
          return fail(i, x, `The step ${x.label.text} changes the specification state from ${this.describe(a)} to ${this.describe(b)}, which is not a step of ${specName}.`);
        }
        const k = canon(x.state);
        if (!index.has(k)) {
          index.set(k, entries.length);
          entries.push({ state: x.state, parent: i, label: x.label });
        }
      }
    }
    return {
      engine: 'refine',
      status: 'verified',
      subject,
      badge: { kind: 'exhaustive', states: entries.length, instance: describeInstance(impl) },
      certificate: { kind: 'state-space', checked: false, checker: 'the explorer itself (no independent certificate)', detail: 'Every reachable step was mapped to a step of the specification or to stuttering.' },
      assumptions: [describeInstance(impl), 'the refinement mapping says what the implementation’s state means'],
      stats: { states: entries.length, ms: Date.now() - t0 },
      span: impl.info.refines!.span,
    };
  }

  describe(a: State): string {
    return this.spec.info.vars.map((v, i) => `${v.name} = ${show(a.vals[i]!)}`).join(', ');
  }
}

export function checkRefinement(checked: Checked, implName: string, opts: RefinementOptions = {}): Verdict {
  return new Refinement(checked, implName).check(opts);
}
