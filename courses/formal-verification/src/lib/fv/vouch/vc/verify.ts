/**
 * The program verifier: generate the obligations of a function (./gen.ts), discharge each with the SMT solver,
 * check every proof with the trusted certificate checker, and turn every failure into either a replayed
 * counterexample (the reference interpreter runs the function on the inputs the solver found, and fails) or an
 * honest "not proved" with the states the solver found (for a loop: a counterexample to induction).
 */
import type { Checked, FnInfo } from '../check/checker';
import type { Ty } from '../check/types';
import type { TraceStep, Verdict } from '../../engines';
import { evaluate, mvKey, not, num, smtlibScript, type Model, type MValue, type Term } from '../../logic/term';
import { SmtSolver, type SmtResult } from '../../smt/solver';
import { checkUnsatCertificate } from '../../smt/check/certificate';
import { Runner } from '../interp/exec';
import { seq, show, type Value } from '../interp/values';
import { generate, type FunctionVcs, type Obligation, type ObligationKind } from './gen';
import { Unsupported, type SVal } from './sval';

export interface ObligationResult {
  obligation: Obligation;
  status: 'proved' | 'failed' | 'unknown';
  smt: SmtResult;
  /** The certificate of a proof was re-checked. */
  certified?: boolean;
  /** For failures: what the solver's model says about the states. */
  states?: { label: string; values: { name: string; value: string }[] }[];
  /** For failures whose inputs replayed to a failing run. */
  replay?: { message: string; trace: TraceStep[]; inputs: string };
}

export interface FunctionResult {
  fn: string;
  vcs?: FunctionVcs;
  results: ObligationResult[];
  verdicts: Verdict[];
  unsupported?: string;
}

export interface ProgramVerifyOptions {
  /** Per-obligation SMT budget (ms). */
  timeout?: number;
  signal?: AbortSignal;
  /** Re-check proof certificates (default true). */
  certify?: boolean;
  /** Stop at the first failure (the language server does not, so every failing line is marked). */
  stopAtFirst?: boolean;
}

const KIND_TEXT: Record<ObligationKind, string> = {
  precondition: 'precondition of a call',
  postcondition: 'postcondition',
  'invariant-entry': 'loop invariant on entry',
  'invariant-preserved': 'loop invariant preserved',
  decreases: 'termination',
  assert: 'assertion',
  bounds: 'index in bounds',
  division: 'no division by zero',
  overflow: 'no overflow',
  narrowing: 'value fits its type',
  'well-formed': 'contract is well-defined',
};

export function verifyFunction(checked: Checked, info: FnInfo, opts: ProgramVerifyOptions = {}): FunctionResult {
  const name = info.decl.name;
  let vcs: FunctionVcs;
  try {
    vcs = generate(checked, info);
  } catch (e) {
    if (e instanceof Unsupported) return { fn: name, results: [], verdicts: [], unsupported: e.message };
    throw e;
  }
  const results: ObligationResult[] = [];
  for (const ob of vcs.obligations) {
    if (opts.signal?.aborted) break;
    const r = discharge(checked, info, vcs, ob, opts);
    results.push(r);
    if (opts.stopAtFirst && r.status !== 'proved') break;
  }
  return { fn: name, vcs, results, verdicts: toVerdicts(info, vcs, results) };
}

function discharge(checked: Checked, info: FnInfo, vcs: FunctionVcs, ob: Obligation, opts: ProgramVerifyOptions): ObligationResult {
  const certify = opts.certify ?? true;
  const solver = new SmtSolver({ proof: certify, timeout: opts.timeout ?? 4000, signal: opts.signal });
  for (const a of vcs.axioms) solver.assert(a);
  for (const h of ob.hyps) solver.assert(h);
  solver.assert(not(ob.goal));
  const smt = solver.solve();
  if (smt.status === 'unsat') {
    let certified = false;
    if (certify && smt.proof && smt.proof.lines.length < 400_000) certified = checkUnsatCertificate(smt.proof).ok;
    return { obligation: ob, status: 'proved', smt, certified };
  }
  if (!smt.model) return { obligation: ob, status: 'unknown', smt };
  const states = ob.snapshots.map((s) => ({ label: s.label, values: s.vars.map((v) => ({ name: v.name, value: render(v.value, v.ty, smt.model!) })) }));
  // Replay: run the function on the inputs from the model.
  const inputs = vcs.params.map((p) => toValue(p.value, p.sym.ty, smt.model!));
  if (inputs.every((x) => x !== undefined)) {
    const calls: string[] = [];
    const res = new Runner(checked, { fuel: 200_000, trace: 400, externals: modelFunctions(checked, smt.model, calls) }).run(info.decl.name, inputs as Value[]);
    if (res.failure && !['unbounded-quantifier', 'internal', 'fuel'].includes(res.failure.kind)) {
      const shown = vcs.params.map((p, i) => `${p.sym.name} = ${show(inputs[i]!)}`).join(', ') + (calls.length ? `, with the uninterpreted functions as the solver chose them: ${calls.join(', ')}` : '');
      return {
        obligation: ob,
        status: 'failed',
        smt,
        states,
        replay: {
          message: res.failure.message,
          inputs: shown,
          trace: res.trace.map((t) => ({ span: t.span, state: { values: Object.entries(t.vars).map(([n, value]) => ({ name: n, value, kind: 'var' as const })) } })),
        },
      };
    }
  }
  return { obligation: ob, status: smt.status === 'sat' ? 'failed' : 'unknown', smt, states };
}

function toVerdicts(info: FnInfo, vcs: FunctionVcs, results: ObligationResult[]): Verdict[] {
  const name = info.decl.name;
  const failing = results.filter((r) => r.status !== 'proved');
  const stats = {
    obligations: results.length,
    proved: results.length - failing.length,
    conflicts: results.reduce((s, r) => s + (r.smt.stats.conflicts ?? 0), 0),
    'quantifier instances': results.reduce((s, r) => s + (r.smt.stats.instances ?? 0), 0),
    ms: results.reduce((s, r) => s + (r.smt.stats.ms ?? 0), 0),
  };
  const assumptions = [
    'the SMT encoding of Vouch (the verification-condition generator, Tseitin, preprocessing) is correct',
    ...(vcs.unmeasuredLoops ? [`${vcs.unmeasuredLoops === 1 ? 'the loop' : `the ${vcs.unmeasuredLoops} loops`} without \`decreases\` terminate${vcs.unmeasuredLoops === 1 ? 's' : ''} (partial correctness)`] : []),
    ...calleeAssumptions(info),
  ];
  if (!failing.length) {
    const allCertified = results.every((r) => r.certified);
    return [{
      engine: 'vc',
      status: 'verified',
      subject: `${name} meets its contract`,
      badge: { kind: 'verified', scope: 'all inputs' },
      certificate: {
        kind: 'smt-proof',
        checked: allCertified,
        checker: allCertified ? 'the certificate checker (DRAT, Farkas, congruence, instances)' : 'some proofs were too large to re-check',
        detail: `${results.length} obligation${results.length === 1 ? '' : 's'}`,
      },
      assumptions,
      stats,
      message: results.length
        ? `All ${results.length} proof obligation${results.length === 1 ? '' : 's'} hold: ${summarise(results)}.`
        : info.decl.spec.ensures.length
          ? 'The contract holds by simplification alone: no proof obligation was left for the solver.'
          : 'There is nothing to prove: the function has no contract and no operation that can fail.',
      span: info.decl.nameSpan,
    }];
  }
  return failing.map((r) => {
    const ob = r.obligation;
    if (r.replay) {
      return {
        engine: 'vc',
        status: 'violated',
        subject: `${KIND_TEXT[ob.kind]}: ${ob.message.toLowerCase()}`,
        badge: { kind: 'violated', replayed: true },
        certificate: { kind: 'trace', checked: true, checker: 'the reference interpreter (the failing run is the certificate)' },
        assumptions: [],
        stats: { ...r.smt.stats },
        message: `${r.replay.message} Input: ${r.replay.inputs}.`,
        span: ob.span,
        trace: { steps: r.replay.trace },
      } satisfies Verdict;
    }
    const cti = ob.kind === 'invariant-preserved';
    const steps: TraceStep[] = (r.states ?? []).map((s) => ({ label: s.label, state: { values: s.values.map((v) => ({ ...v, kind: 'var' as const })) } }));
    const why =
      r.smt.status === 'unknown' && !r.states
        ? `The solver gave up (${r.smt.reason ?? 'unknown'}).`
        : cti
          ? 'Not proved: the invariant is not inductive. The solver found a state that satisfies the invariant and the loop condition, but after one iteration the invariant fails. This state may never occur in a real run: strengthen the invariant so that it excludes it.'
          : r.smt.status === 'sat'
            ? 'Not proved: the solver found values for which this check fails, but running the function on them does not fail, so they come from what the proof does not know (a loop invariant or a callee’s postcondition is too weak).'
            : `Not proved (${r.smt.reason ?? 'the solver could not decide'}).`;
    return {
      engine: 'vc',
      status: 'unknown',
      subject: `${KIND_TEXT[ob.kind]}: ${ob.message.toLowerCase()}`,
      badge: { kind: 'unknown', reason: cti ? 'counterexample to induction' : r.smt.status === 'sat' ? 'not proved' : (r.smt.reason ?? 'not proved') },
      certificate: { kind: 'none', checked: false, checker: '' },
      assumptions,
      stats: { ...r.smt.stats },
      message: why,
      span: ob.span,
      trace: steps.length ? { steps } : undefined,
    } satisfies Verdict;
  });
}

function calleeAssumptions(info: FnInfo): string[] {
  void info;
  return ['callees meet their contracts (each is verified on its own)'];
}

function summarise(results: ObligationResult[]): string {
  const counts = new Map<ObligationKind, number>();
  for (const r of results) counts.set(r.obligation.kind, (counts.get(r.obligation.kind) ?? 0) + 1);
  return [...counts].map(([k, n]) => `${n} × ${KIND_TEXT[k]}`).join(', ');
}

// ── Reading values back from a model ──

function mval(t: Term, m: Model): MValue | undefined {
  try {
    return evaluate(t, m);
  } catch {
    return undefined;
  }
}

/** A Vouch value from a symbolic value under a model (undefined if it cannot be read back). */
/** The model's interpretation of each uninterpreted (bodiless) pure function, for replaying counterexamples. */
function modelFunctions(checked: Checked, m: Model, calls: string[] = []): Map<string, (args: Value[]) => Value | undefined> {
  const out = new Map<string, (args: Value[]) => Value | undefined>();
  const toM = (a: Value): MValue | undefined => (typeof a === 'bigint' || typeof a === 'boolean' ? a : a !== null && typeof a === 'object' && a.t === 'enum' && !a.fields.length ? BigInt(a.tag) : undefined);
  for (const f of checked.fns.values()) {
    const d = f.decl;
    if (d.body || (d.flavour !== 'pure' && d.flavour !== 'pred')) continue;
    const resTy = f.result?.ty;
    out.set(d.name, (args) => {
      const keys = args.map(toM);
      if (keys.some((k) => k === undefined)) return undefined;
      const fun = m.funs.get(d.name);
      const x = fun?.entries.get(keys.map((k) => mvKey(k!)).join(',')) ?? fun?.def ?? (d.flavour === 'pred' || resTy?.k === 'bool' ? false : 0n);
      const v: Value | undefined = resTy?.k === 'enum' && typeof x === 'bigint' ? { t: 'enum', name: resTy.name, tag: Number(x), variant: resTy.variants[Number(x)]?.name ?? '?', fields: [] } : typeof x === 'bigint' || typeof x === 'boolean' ? x : undefined;
      if (v !== undefined) {
        const call = `${d.name}(${args.map(show).join(', ')}) = ${show(v)}`;
        if (!calls.includes(call)) calls.push(call);
      }
      return v;
    });
  }
  return out;
}

export function toValue(v: SVal, ty: Ty, m: Model): Value | undefined {
  switch (v.k) {
    case 'scalar': {
      const x = mval(v.t, m);
      if (x === undefined) return undefined;
      if (ty.k === 'enum') {
        const tag = Number(x as bigint);
        return { t: 'enum', name: ty.name, tag, variant: ty.variants[tag]?.name ?? '?', fields: [] };
      }
      if (ty.k === 'atom') {
        const s = (x as { u: string }).u ?? '';
        return { t: 'atom', type: ty.name, i: Math.abs(Number(s.split('!')[1] ?? 0)) % Math.max(1, ty.size ?? 1000) };
      }
      return x as Value;
    }
    case 'seq': {
      const n = mval(v.len, m);
      if (typeof n !== 'bigint' || n < 0n || n > 100_000n) return undefined;
      const elemTy = ty.k === 'seq' ? ty.elem : v.elemTy;
      const items: Value[] = [];
      for (let i = 0; i < Number(n); i++) {
        const x = toValue(v.at(num(i)), elemTy, m);
        if (x === undefined) return undefined;
        items.push(x);
      }
      return seq(items);
    }
    case 'struct': {
      const fields: Value[] = [];
      for (let i = 0; i < v.fields.length; i++) {
        const x = toValue(v.fields[i]!, v.ty.fields[i]!.ty, m);
        if (x === undefined) return undefined;
        fields.push(x);
      }
      return { t: 'struct', name: v.ty.name, fields };
    }
    case 'tuple': {
      const items: Value[] = [];
      for (let i = 0; i < v.items.length; i++) {
        const x = toValue(v.items[i]!, ty.k === 'tuple' ? ty.elems[i]! : { k: 'int' }, m);
        if (x === undefined) return undefined;
        items.push(x);
      }
      return { t: 'tuple', items };
    }
    default:
      return undefined;
  }
}

function render(v: SVal, ty: Ty, m: Model): string {
  const x = toValue(v, ty, m);
  return x === undefined ? '…' : show(x);
}

/** The SMT-LIB text of an obligation (for the VC inspector). */
export function obligationSmtlib(vcs: FunctionVcs, ob: Obligation): string {
  return smtlibScript([...vcs.axioms, ...ob.hyps, not(ob.goal)]) + '(check-sat)\n';
}
