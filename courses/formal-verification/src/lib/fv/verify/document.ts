/**
 * Verify every declaration of a Vouch document with the engines that apply, yielding between declarations so a
 * language server stays responsive and can cancel when the document changes.
 *
 * Today: systems go to the explicit-state explorer (invariants) and the LTL checker (properties); functions are
 * tested against their contracts on random inputs. The program verifier, the relational model finder and the
 * encoders plug in here as they land.
 */
import { usesHeap } from '../heap/symheap';
import { heapVerdicts } from '../heap/verdicts';
import type { Checked, FnInfo } from '../vouch/check/checker';
import type { Verdict } from '../engines';
import { SystemRuntime } from '../vouch/interp/system';
import { explore } from '../explore/explorer';
import { checkProperty } from '../ltl/check';
import { checkRefinement } from '../explore/refine';
import { Runner } from '../vouch/interp/exec';
import { rng } from '../util/random';
import { randomValue } from './inputs';
import { show } from '../vouch/interp/values';
import { RuntimeFailure } from '../vouch/interp/eval';
import { hasErrors } from '../vouch/diagnostics';
import { verifyFunction } from '../vouch/vc/verify';
import { solveProblem, EncodeError } from '../problem/encode';
import { runCommand, WorldError, type WorldResult } from '../relational/encode';
import { bmc, bmcVerdicts } from '../bmc/bmc';
import { BmcError } from '../bmc/symbolic';
import { Reachability, reachVerdicts } from '../bdd/reach';
import type { Ty } from '../vouch/check/types';
import type * as A from '../vouch/syntax/ast';

export interface DeclVerdicts {
  /** Declaration name (a function, or a system). */
  decl: string;
  kind: 'fn' | 'system' | 'world' | 'problem';
  verdicts: Verdict[];
}

export interface VerifyOptions {
  signal?: AbortSignal;
  /** Per-engine time budget in milliseconds. */
  timeout?: number;
  /** Random tests per function. */
  tests?: number;
  /** Called after each declaration, so results can be shown as they arrive. */
  onDecl?: (d: DeclVerdicts) => void;
  /** Yield to the event loop between declarations. */
  yieldEvery?: () => Promise<void>;
  /** Extra verifiers, keyed by declaration kind (the program verifier registers itself here). */
  fnVerifier?: (checked: Checked, info: FnInfo, opts: VerifyOptions) => Verdict[] | undefined;
}

export async function verifyDocument(checked: Checked, opts: VerifyOptions = {}): Promise<DeclVerdicts[]> {
  const out: DeclVerdicts[] = [];
  if (hasErrors(checked.diagnostics)) return out;
  const timeout = opts.timeout ?? 8000;
  const pause = opts.yieldEvery ?? (() => new Promise<void>((r) => setTimeout(r, 0)));
  for (const d of checked.program.decls) {
    if (opts.signal?.aborted) break;
    let result: DeclVerdicts | undefined;
    if (d.k === 'system') {
      const verdicts: Verdict[] = [];
      try {
        const rt = new SystemRuntime(checked, d.name);
        // Systems of processes are also checked for deadlock: a state where no process can move, though some has not finished.
        const deadlock = rt.instances.length > 0;
        // Wide bit-vectors (16-bit registers, 32-bit inputs) are beyond explicit enumeration: bounded model checking instead.
        const wide = (t: Ty): boolean => (t.k === 'bv' && t.bits > 8) || (t.k === 'func' && wide(t.result));
        const bmcOnly = rt.info.vars.some((v) => wide(v.ty)) || rt.info.actions.some((a) => a.params.some((p) => wide(p.ty)));
        if (bmcOnly && rt.info.invariants.length) {
          try {
            verdicts.push(...bmcVerdicts(rt, bmc(rt, { maxK: 12, timeout, signal: opts.signal })));
          } catch (e) {
            if (!(e instanceof BmcError)) throw e;
            verdicts.push({ engine: 'bmc', status: 'error', subject: d.name, badge: { kind: 'error', reason: e.message }, certificate: { kind: 'none', checked: false, checker: '' }, assumptions: [], stats: {}, message: e.message, span: d.nameSpan });
          }
        } else if (rt.info.invariants.length || deadlock) {
          const t0 = Date.now();
          let vs = explore(rt, { timeout, signal: opts.signal, symmetry: true, deadlock }).verdicts;
          // Too many states to visit one by one: try symbolic reachability with BDDs on the invariants.
          if (vs.some((v) => v.status === 'timeout') && rt.info.invariants.length && !opts.signal?.aborted) {
            try {
              const reach = new Reachability(new SystemRuntime(checked, d.name));
              const r = reach.run({ timeout: Math.max(1000, timeout - (Date.now() - t0)) });
              if (r.done) {
                const sym = reachVerdicts(new SystemRuntime(checked, d.name), r, reach);
                vs = vs.map((v) => (v.status === 'timeout' ? sym.find((w) => w.subject === v.subject) ?? v : v));
              }
            } catch (e) {
              if (!(e instanceof BmcError)) throw e;
            }
          }
          verdicts.push(...vs);
        }
        if (rt.info.refines) {
          await pause();
          verdicts.push(checkRefinement(checked, d.name, { timeout, signal: opts.signal }));
        }
        for (const p of rt.info.properties) {
          await pause();
          if (opts.signal?.aborted) break;
          verdicts.push(checkProperty(rt, p, { timeout, signal: opts.signal }));
        }
      } catch (e) {
        if (!(e instanceof RuntimeFailure)) throw e;
        verdicts.push({ engine: 'explore', status: 'error', subject: d.name, badge: { kind: 'error', reason: e.message }, certificate: { kind: 'none', checked: false, checker: '' }, assumptions: [], stats: {}, message: e.message, span: e.span });
      }
      result = { decl: d.name, kind: 'system', verdicts };
    } else if (d.k === 'problem') {
      result = { decl: d.name, kind: 'problem', verdicts: [problemVerdict(checked, d.name, d.nameSpan)] };
    } else if (d.k === 'world') {
      const verdicts: Verdict[] = [];
      for (const cmd of checked.containers.get(d.name)!.checks) {
        if (opts.signal?.aborted) break;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { result: _raw, ...v } = worldVerdict(checked, d.name, cmd);
        verdicts.push(v);
        await pause();
      }
      result = { decl: d.name, kind: 'world', verdicts };
    } else if (d.k === 'fn' && (d.flavour === 'fn' || d.flavour === 'lemma') && d.body) {
      const info = checked.fns.get(d.name)!;
      // Heap programs (references, heap assertions) go to the separation-logic verifier.
      const verdicts = opts.fnVerifier?.(checked, info, opts) ?? (usesHeap(d) ? heapVerdicts(checked, info, '').verdicts : proveOrTest(checked, info, opts));
      result = { decl: d.name, kind: 'fn', verdicts };
    }
    if (result) {
      out.push(result);
      opts.onDecl?.(result);
    }
    await pause();
  }
  return out;
}

/** Run one command of a world (`check … for n` or `run … for n`) with the relational model finder. */
export function worldVerdict(checked: Checked, world: string, cmd: A.PropDecl, scope?: number, exclude?: boolean[][]): Verdict & { result?: WorldResult } {
  const name = cmd.name ?? (cmd.k === 'run' ? 'run' : 'check');
  try {
    const r = runCommand(checked, world, cmd, { scope, exclude });
    const stats = { scope: r.scope, 'relation variables': r.stats.primaryVars, variables: r.stats.vars, clauses: r.stats.clauses, ms: r.stats.ms };
    const describeInst = () => r.instance!.rels.map((x) => `${x.name} = {${x.tuples.map((t) => (t.length === 1 ? t[0] : `(${t.join(', ')})`)).join(', ')}}`).join('; ');
    const atoms = () => r.instance!.atoms.map((a) => `${a.names.length} ${a.type}`).join(', ');
    const scopeNote = `only instances with at most ${r.scope} atoms of each type were considered`;
    const base = { engine: 'relational', subject: cmd.k === 'run' ? `${name}: an instance` : `${name} holds`, stats, span: cmd.span, instance: r.instance, result: r };
    if (r.kind === 'check') {
      if (r.found) {
        return { ...base, status: 'violated', badge: { kind: 'violated', replayed: !!r.instanceChecked }, certificate: { kind: 'model', checked: !!r.instanceChecked, checker: 'the reference interpreter evaluates every fact and the property on the instance' }, assumptions: [], message: `Counterexample (${atoms()}): ${describeInst()}.` };
      }
      return { ...base, status: 'verified', badge: { kind: 'bounded', bound: r.scope, what: 'scope' }, certificate: { kind: 'drat', checked: !!r.proofChecked, checker: 'DRAT checker (the relational encoding is trusted)' }, assumptions: [scopeNote, 'the relational encoding into SAT is correct'], message: `No counterexample with up to ${r.scope} atoms of each type.` };
    }
    if (r.found) {
      return { ...base, status: 'verified', badge: { kind: 'instance', found: true, scope: r.scope }, certificate: { kind: 'model', checked: !!r.instanceChecked, checker: 'the reference interpreter evaluates every fact and the predicate on the instance' }, assumptions: [], message: `Instance (${atoms()}): ${describeInst()}.` };
    }
    return { ...base, status: 'violated', badge: { kind: 'instance', found: false, scope: r.scope }, certificate: { kind: 'drat', checked: !!r.proofChecked, checker: 'DRAT checker (the relational encoding is trusted)' }, assumptions: [scopeNote], message: `No instance with up to ${r.scope} atoms of each type: the facts and this predicate may contradict each other.` };
  } catch (e) {
    if (!(e instanceof WorldError)) throw e;
    return { engine: 'relational', status: 'error', subject: name, badge: { kind: 'error', reason: e.message }, certificate: { kind: 'none', checked: false, checker: '' }, assumptions: [], stats: {}, message: e.message, span: cmd.span };
  }
}

/** Solve or count a constraint problem; every solution is checked by the interpreter. */
export function problemVerdict(checked: Checked, name: string, span: Verdict['span']): Verdict {
  const info = checked.containers.get(name)!;
  const counting = info.goal === 'count';
  try {
    const r = solveProblem(checked, name, { limit: counting ? 10_000 : 1, keep: 1 });
    const allChecked = r.solutions.every((s) => s.checked);
    const sol = r.solutions[0];
    const shown = sol ? [...sol.values].map(([k, v]) => `${k} = ${show(v)}`).join(', ') : '';
    return {
      engine: 'sat',
      status: r.count > 0 && allChecked ? 'verified' : r.count > 0 ? 'error' : 'violated',
      subject: counting ? `the solutions of ${name}` : `a solution of ${name}`,
      badge: { kind: 'counted', count: r.count, more: r.more, solve: !counting },
      certificate: r.count > 0
        ? { kind: 'solutions', checked: allChecked, checker: 'the reference interpreter evaluates every constraint on the solution' }
        : { kind: 'none', checked: false, checker: 'no solution: the SAT solver’s answer (Chapter 8 checks such answers)' },
      assumptions: counting ? ['the encoding into SAT is correct (each solution found is checked; the count trusts the encoding and the solver)'] : [],
      stats: { solutions: r.count, 'cells': r.encoding.stats.cells, variables: r.encoding.cnf.nvars, clauses: r.encoding.stats.clauses, ms: r.ms },
      message: r.count === 0 ? 'No assignment satisfies every constraint.' : `${counting ? `${r.more ? 'More than ' : ''}${r.count.toLocaleString('en-GB')} solution${r.count === 1 ? '' : 's'}. One of them: ` : 'A solution: '}${shown}.`,
      span,
    };
  } catch (e) {
    if (!(e instanceof EncodeError)) throw e;
    return { engine: 'sat', status: 'error', subject: name, badge: { kind: 'error', reason: e.message }, certificate: { kind: 'none', checked: false, checker: '' }, assumptions: [], stats: {}, message: e.message, span };
  }
}

/**
 * Prove the function with the program verifier; when it uses something the verifier does not handle yet, test it
 * instead and say why.
 */
export function proveOrTest(checked: Checked, info: FnInfo, opts: VerifyOptions = {}): Verdict[] {
  const r = verifyFunction(checked, info, { timeout: Math.min(opts.timeout ?? 8000, 4000), signal: opts.signal });
  if (!r.unsupported) return r.verdicts;
  const tested = testFunction(checked, info, opts.tests ?? 200);
  return tested.map((v) => (v.status === 'violated' ? v : { ...v, message: `${v.message ?? ''} (Not proved: ${r.unsupported}.)`.trim() }));
}

/** The "tested" rung: run the function on random inputs that satisfy its precondition, with every contract checked. */
export function testFunction(checked: Checked, info: FnInfo, runs: number): Verdict[] {
  const r = rng(12345);
  let passed = 0;
  let discarded = 0;
  const subject = `${info.decl.name} meets its contract`;
  if (info.decl.flavour === 'lemma') return [];
  for (let i = 0; i < runs * 5 && passed < runs; i++) {
    const args = info.params.map((p) => randomValue(p.ty, r));
    if (args.some((a) => a === undefined)) {
      return [{ engine: 'test', status: 'unknown', subject, badge: { kind: 'unknown', reason: 'no random inputs for these parameter types' }, certificate: { kind: 'none', checked: false, checker: '' }, assumptions: [], stats: {} }];
    }
    const res = new Runner(checked, { fuel: 200_000, trace: 400 }).run(info.decl.name, args as never);
    if (res.discarded) {
      discarded++;
      continue;
    }
    if (res.failure && res.failure.kind !== 'unbounded-quantifier' && res.failure.kind !== 'fuel') {
      return [{
        engine: 'test',
        status: 'violated',
        subject,
        badge: { kind: 'violated', replayed: true },
        certificate: { kind: 'trace', checked: true, checker: 'the reference interpreter (the failing run is the certificate)' },
        assumptions: [],
        stats: { runs: passed + 1, discarded },
        message: `${res.failure.message} Input: ${info.params.map((p, k) => `${p.name} = ${show(args[k]!)}`).join(', ')}.`,
        span: res.failure.span,
        trace: { steps: res.trace.map((t) => ({ label: undefined, span: t.span, state: { values: Object.entries(t.vars).map(([name, value]) => ({ name, value, kind: 'var' as const })) } })) },
      }];
    }
    passed++;
  }
  return [{
    engine: 'test',
    status: 'unknown',
    subject,
    badge: { kind: 'tested', runs: passed, discarded },
    certificate: { kind: 'none', checked: false, checker: '' },
    assumptions: ['only the inputs that were tried'],
    stats: { runs: passed, discarded },
    message: `No failure on ${passed} random input${passed === 1 ? '' : 's'}${discarded ? ` (${discarded} discarded by the precondition)` : ''}. Testing checks some inputs; a proof would check all of them.`,
    span: info.decl.nameSpan,
  }];
}
