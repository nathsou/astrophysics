/**
 * Verify every declaration of a Vouch document with the engines that apply, yielding between declarations so a
 * language server stays responsive and can cancel when the document changes.
 *
 * Today: systems go to the explicit-state explorer (invariants) and the LTL checker (properties); functions are
 * tested against their contracts on random inputs. The program verifier, the relational model finder and the
 * encoders plug in here as they land.
 */
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
        if (rt.info.invariants.length || deadlock) verdicts.push(...explore(rt, { timeout, signal: opts.signal, symmetry: true, deadlock }).verdicts);
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
    } else if (d.k === 'fn' && (d.flavour === 'fn' || d.flavour === 'lemma') && d.body) {
      const info = checked.fns.get(d.name)!;
      const verdicts = opts.fnVerifier?.(checked, info, opts) ?? proveOrTest(checked, info, opts);
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
