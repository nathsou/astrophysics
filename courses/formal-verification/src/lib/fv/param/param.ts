/**
 * Parameterised verification (chapter 25): prove that a system's invariants are inductive for every number of
 * nodes, in the style of Ivy (Padon, McMillan, Panda, Sagiv and Shoham, 2016).
 *
 * The parameter types (`type Node`) are left without a size. `fragment.ts` checks that the verification
 * conditions lie in the decidable ∃*∀* fragment and computes, for each check, how many nodes a counterexample can
 * name. Each check is then decided on every instance size from 1 to that number, with chapter 10's SAT encoding of
 * the system at that size. Unsatisfiable at every size means valid for every size; a model is a counterexample to
 * induction on a small instance, drawn as nodes.
 *
 * Facts (`fact ring: …`) describe parts of the state that never change, such as the ring or the order of the
 * identifiers. They are assumed in the initial states and in the state before each step, and must be preserved
 * like invariants, which they are, trivially, when no action changes what they mention.
 */
import type { Verdict } from '../engines';
import type { Checked } from '../vouch/check/checker';
import type { Ty } from '../vouch/check/types';
import { SystemRuntime } from '../vouch/interp/system';
import type { Value } from '../vouch/interp/values';
import { and, not, or, type StepInstance } from '../bmc/symbolic';
import { SystemModel, IncrementalSolver, type CertifiedQuery } from '../ic3/model';
import { analyse, type Fragment, type Counts } from './fragment';

export interface ParamCti {
  kind: 'initiation' | 'consecution';
  /** Instance size (per parameter type). */
  sizes: Record<string, number>;
  /** Slot names and types, and their values before and after the step (or in the initial state). */
  slots: { name: string; ty: Ty | undefined; before: Value; after?: Value }[];
  /** The step taken, as text (consecution). */
  step?: string;
  /** Obligations false after the step (or in the initial state). */
  failing: string[];
}

export interface ParamSize {
  sizes: Record<string, number>;
  checks: number;
  /** Ground instances of the universally quantified formulas at this size. */
  groundInstances: number;
  ms: number;
}

export interface ParamResult {
  status: 'proved' | 'cti' | 'outside' | 'unknown';
  fragment: Fragment;
  /** The largest instance size needed, per parameter type. */
  bound: Record<string, number>;
  sizes: ParamSize[];
  cti?: ParamCti;
  certificate?: { queries: CertifiedQuery[]; checked: boolean };
  ms: number;
  message?: string;
}

export interface ParamOptions {
  timeout?: number;
  signal?: AbortSignal;
  /** Time for re-checking the proofs at every size (ms); 0 skips the check. */
  certifyBudget?: number;
  /** Stop at this size even if the fragment says more is needed (the result is then 'unknown'). */
  maxSize?: number;
}

const need = (c: Counts, sort: string) => Math.max(1, c.get(sort) ?? 0);

export function checkParameterised(checked: Checked, system: string, opts: ParamOptions = {}): ParamResult {
  const t0 = Date.now();
  const deadline = t0 + (opts.timeout ?? 20000);
  const info = checked.containers.get(system);
  if (!info || info.kind !== 'system') throw new Error(`No system called ${system}`);
  const fragment = analyse(checked, info);
  const done = (r: Omit<ParamResult, 'fragment' | 'ms'>): ParamResult => ({ ...r, fragment, ms: Date.now() - t0 });
  if (fragment.error) return done({ status: 'outside', bound: {}, sizes: [], message: fragment.error.message });
  const sortTys = info.atoms.filter((t) => t.k === 'atom') as (Ty & { k: 'atom'; size?: number })[];
  const bound: Record<string, number> = {};
  for (const s of fragment.sorts) bound[s] = Math.max(...[...fragment.init, ...fragment.step.flat()].map((c) => need(c, s)));
  const maxSize = opts.maxSize ?? 8;
  if (Object.values(bound).some((b) => b > maxSize)) return done({ status: 'unknown', bound, sizes: [], message: `A counterexample could need ${JSON.stringify(bound)} nodes, more than this checker tries (${maxSize}).` });

  // Every combination of sizes up to the bounds (one parameter type is the usual case).
  let combos: Record<string, number>[] = [{}];
  for (const s of fragment.sorts) combos = combos.flatMap((c) => Array.from({ length: bound[s]! }, (_, i) => ({ ...c, [s]: i + 1 })));
  const saved = sortTys.map((t) => t.size);
  const obligations = fragment.obligations;
  const sizes: ParamSize[] = [];
  const certQueries: CertifiedQuery[] = [];
  try {
    for (const combo of combos) {
      if (Date.now() > deadline || opts.signal?.aborted) return done({ status: 'unknown', bound, sizes, message: 'Out of time.' });
      const t1 = Date.now();
      sortTys.forEach((t) => (t.size = combo[t.name]));
      const fits = (c: Counts) => fragment.sorts.every((s) => combo[s]! <= need(c, s));
      const rt = new SystemRuntime(checked, system);
      // Only the step instances whose node parameters are in first-use order (see `canonical`).
      const m = new SystemModel(rt, undefined, (_a, args) => canonical(args));
      const enc = m.enc;
      const inc = new IncrementalSolver(m.pool);
      const holdsS = obligations.map((o) => enc.holds(o.expr, m.S));
      const holdsS2 = obligations.map((o) => enc.holds(o.expr, m.S2));
      const statics = fragment.staticFacts.map((f) => enc.holds(f, m.S));
      const actI = inc.guarded(m.init, 'init');
      const actT = inc.guarded(and(m.trans, ...holdsS, ...statics), 'step');
      const notInit = holdsS.map((h, j) => inc.guarded(not(h), `¬${obligations[j]!.name}`));
      const notNext = holdsS2.map((h, j) => inc.guarded(not(h), `¬${obligations[j]!.name}′`));
      let checks = 0;
      const cti = (kind: ParamCti['kind'], j: number, step?: StepInstance): ParamResult => {
        const model = inc.model;
        const before = m.decode(model, m.S);
        const after = kind === 'consecution' ? m.decode(model, m.S2) : undefined;
        const hit = m.selectors.find((s) => model[s.sel]);
        const failing = obligations.filter((_, k) => !evalAt(kind === 'consecution' ? holdsS2[k]! : holdsS[k]!, model)).map((o) => o.name);
        void j;
        return done({
          status: 'cti', bound, sizes,
          cti: { kind, sizes: combo, slots: rt.slots.map((s, i) => ({ name: s.name, ty: s.ty, before: before[i]!, after: after?.[i] })), step: (hit?.step ?? step)?.text, failing },
        });
      };
      // Initiation: an initial state violating an obligation.
      for (let j = 0; j < obligations.length; j++) {
        if (!fits(fragment.init[j]!)) continue;
        checks++;
        const r = inc.solve([actI, notInit[j]!], () => Date.now() > deadline);
        if (r === 'sat') return cti('initiation', j);
        if (r === 'unknown') return done({ status: 'unknown', bound, sizes, message: 'Out of time.' });
      }
      // Consecution: per action (its step instances switched on, the others off) and per obligation.
      for (let a = 0; a < info.actions.length; a++) {
        // Nodes are interchangeable (nothing in Vouch names a particular one), so a step needs checking only for
        // its parameters up to renaming: the first node used is node 0, the next new one node 1, and so on.
        const mine = m.selectors.filter((s) => s.step.action === info.actions[a]!.decl && canonical(s.step.args));
        const others = m.selectors.filter((s) => !mine.includes(s)).map((s) => -s.sel);
        if (!mine.length) continue;
        for (let j = 0; j < obligations.length; j++) {
          if (!fits(fragment.step[a]![j]!)) continue;
          checks++;
          const broken = witnessBroken(checked, enc, m.S2, obligations[j]!.expr, mine, combo);
          const neg = broken ? inc.guarded(broken, `¬${obligations[j]!.name}′ (canonical witnesses)`) : notNext[j]!;
          const r = inc.solve([actT, ...others, neg], () => Date.now() > deadline);
          if (r === 'sat') return cti('consecution', j, mine[0]!.step);
          if (r === 'unknown') return done({ status: 'unknown', bound, sizes, message: 'Out of time.' });
        }
      }
      sizes.push({ sizes: combo, checks, groundInstances: groundInstances(fragment, combo, obligations.length, info.actions.length), ms: Date.now() - t1 });
      if (opts.certifyBudget) {
        const until = Date.now() + opts.certifyBudget / combos.length;
        certQueries.push(m.certify([m.init, not(and(...holdsS))], until));
        certQueries.push(m.certify([m.trans, ...holdsS, not(and(...holdsS2))], until));
      }
    }
  } finally {
    sortTys.forEach((t, i) => (t.size = saved[i]));
  }
  return done({ status: 'proved', bound, sizes, certificate: opts.certifyBudget ? { queries: certQueries, checked: certQueries.every((q) => q.checked) } : undefined });
}

/**
 * The negation of `forall x1 … xk :: body` in S′, with the witnesses restricted to first-use order after the
 * step's own parameters: a witness is a node the parameters already use, or the next new node. Renaming the
 * nodes the step does not use turns any counterexample into one of these, so nothing is lost. Undefined when
 * the obligation is not of that shape.
 */
function witnessBroken(checked: Checked, enc: SystemModel['enc'], S2: SystemModel['S2'], e: import('../vouch/syntax/ast').Expr, steps: { step: StepInstance; sel: number }[], sizes: Record<string, number>): import('../sat/encode').Formula | undefined {
  if (e.k !== 'quant' || e.q !== 'forall') return undefined;
  const syms = e.binders.map((b) => checked.refs.get(b));
  if (syms.some((sy) => !sy || (sy.ty as Ty).k !== 'atom')) return undefined;
  const sorts = syms.map((sy) => (sy!.ty as Ty & { k: 'atom' }).name);
  // Group the step instances by how many nodes of each type their parameters use.
  const groups = new Map<string, { used: Record<string, number>; sels: number[] }>();
  for (const st of steps) {
    const used: Record<string, number> = {};
    const visit = (v: Value) => {
      if (v !== null && typeof v === 'object' && v.t === 'atom') used[v.type] = Math.max(used[v.type] ?? 0, v.i + 1);
      else if (v !== null && typeof v === 'object' && v.t === 'struct') Object.values(v.fields).forEach(visit);
      else if (v !== null && typeof v === 'object' && v.t === 'tuple') v.items.forEach(visit);
    };
    st.step.args.forEach(visit);
    const k = JSON.stringify(used);
    const g = groups.get(k) ?? groups.set(k, { used, sels: [] }).get(k)!;
    g.sels.push(st.sel);
  }
  const parts: import('../sat/encode').Formula[] = [];
  for (const g of groups.values()) {
    const tuples: Value[][] = [];
    const go = (i: number, acc: Value[], next: Record<string, number>) => {
      if (i === sorts.length) return void tuples.push(acc);
      const s = sorts[i]!;
      const n = sizes[s] ?? 0;
      const limit = Math.min(n - 1, next[s] ?? 0);
      for (let x = 0; x <= limit; x++) go(i + 1, [...acc, { t: 'atom', type: s, i: x } as Value], x === (next[s] ?? 0) ? { ...next, [s]: x + 1 } : next);
    };
    go(0, [], { ...g.used });
    const bad = or(...tuples.map((t) => not(enc.holdsWith(e.body, S2, new Map(syms.map((sy, i) => [sy!.id, t[i]!]))))));
    parts.push(and(or(...g.sels.map((v): import('../sat/encode').Formula => ({ k: 'var', v }))), bad));
  }
  return or(...parts);
}

/** Are the parameter values in first-use order (per type)? */
function canonical(args: Value[]): boolean {
  const next = new Map<string, number>();
  const visit = (v: Value): boolean => {
    if (v === null || typeof v !== 'object') return true;
    if (v.t === 'atom') {
      const n = next.get(v.type) ?? 0;
      if (v.i > n) return false;
      if (v.i === n) next.set(v.type, n + 1);
      return true;
    }
    if (v.t === 'struct') return Object.values(v.fields).every(visit);
    if (v.t === 'tuple') return v.items.every(visit);
    return true;
  };
  return args.every(visit);
}

function evalAt(f: import('../sat/encode').Formula, model: boolean[]): boolean {
  switch (f.k) {
    case 'const':
      return f.value;
    case 'var':
      return !!model[f.v];
    case 'not':
      return !evalAt(f.a, model);
    case 'and':
      return f.args.every((x) => evalAt(x, model));
    case 'or':
      return f.args.some((x) => evalAt(x, model));
    case 'imp':
      return !evalAt(f.a, model) || evalAt(f.b, model);
    case 'iff':
      return evalAt(f.a, model) === evalAt(f.b, model);
    case 'xor':
      return evalAt(f.a, model) !== evalAt(f.b, model);
  }
}

/** Ground instances of the universal quantifiers assumed in the queries, at these sizes (an indication of the work). */
function groundInstances(frag: Fragment, sizes: Record<string, number>, obligations: number, actions: number): number {
  const per = frag.universals.reduce((n, sorts) => n + sorts.reduce((p, s) => p * (sizes[s] ?? 1), 1), 0);
  return per * Math.max(1, obligations) * Math.max(1, actions);
}

export function paramVerdicts(checked: Checked, system: string, r: ParamResult): Verdict[] {
  const info = checked.containers.get(system)!;
  const sizeText = (s: Record<string, number>) => Object.entries(s).map(([k, v]) => `${v} ${k}${v === 1 ? '' : 's'}`).join(', ');
  return info.invariants.map((inv): Verdict => {
    const name = inv.name ?? 'invariant';
    const subject = `invariant ${name} for every instance size`;
    const stats = { 'sizes checked': r.sizes.length, 'ground instances': r.sizes.reduce((n, s) => n + s.groundInstances, 0), ms: r.ms };
    if (r.status === 'proved') {
      return {
        engine: 'param', status: 'verified', subject, badge: { kind: 'verified', scope: 'every number of ' + r.fragment.sorts.join(' and ') + ' values' },
        certificate: { kind: 'drat', checked: !!r.certificate?.checked, checker: r.certificate ? (r.certificate.checked ? 'the DRAT checker (every size up to the bound)' : 'not re-checked in time') : 'not re-checked' },
        assumptions: ['the verification conditions are in the decidable ∃*∀* fragment, so instances up to the computed size are enough', 'the SAT encoding of each instance matches the system’s semantics'],
        stats, message: `The invariants are inductive for every size: checked on every instance up to ${sizeText(r.bound)}, which is enough for these formulas.`, span: inv.span,
      };
    }
    if (r.status === 'cti' && r.cti?.failing.includes(name)) {
      return {
        engine: 'param', status: 'unknown', subject, badge: { kind: 'unknown', reason: 'not inductive' }, certificate: { kind: 'none', checked: false, checker: '' }, assumptions: [], stats,
        message: `Not inductive: a counterexample to ${r.cti.kind} with ${sizeText(r.cti.sizes)}.`, span: inv.span,
      };
    }
    return { engine: 'param', status: 'unknown', subject, badge: { kind: 'unknown', reason: r.status === 'outside' ? 'outside the decidable fragment' : 'not proved' }, certificate: { kind: 'none', checked: false, checker: '' }, assumptions: [], stats, message: r.message ?? 'Another obligation is not inductive.', span: inv.span };
  });
}
