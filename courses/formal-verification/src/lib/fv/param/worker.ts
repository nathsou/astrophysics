/** The parameterised check in a Web Worker (chapter 25): progress per instance size, then the result. */
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { BmcError } from '../bmc/symbolic';
import { RuntimeFailure } from '../vouch/interp/eval';
import { checkParameterised, type ParamCti, type ParamSize } from './param';

export type ParamRequest = { source: string; system?: string; timeout: number; certifyBudget: number };
export type ParamEvent =
  | { kind: 'error'; message: string }
  | { kind: 'start'; sorts: string[]; obligations: string[] }
  | { kind: 'size'; size: ParamSize; bound: Record<string, number> }
  | { kind: 'result'; status: 'proved' | 'cti' | 'outside' | 'unknown'; bound: Record<string, number>; message?: string; cti?: ParamCti; certified?: boolean; ms: number }
  | { kind: 'done' };

const post = (e: ParamEvent) => postMessage(e);

addEventListener('message', (e: MessageEvent<ParamRequest>) => {
  try {
    const p = parse(e.data.source);
    const c = check(p.program);
    const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) throw new BmcError(errs.map((d) => d.message).join(' '));
    const sys = (c.program.decls.find((d) => d.k === 'system') as { name: string } | undefined)?.name;
    const name = e.data.system ?? sys;
    if (!name) throw new BmcError('The code has no system.');
    const info = c.containers.get(name)!;
    post({ kind: 'start', sorts: info.atoms.filter((t) => t.k === 'atom').map((t) => (t as { name: string }).name), obligations: info.invariants.map((i) => i.name ?? 'invariant') });
    const r = checkParameterised(c, name, { timeout: e.data.timeout, certifyBudget: e.data.certifyBudget, onSize: (size, bound) => post({ kind: 'size', size, bound }) });
    post({ kind: 'result', status: r.status, bound: r.bound, message: r.message, cti: r.cti, certified: r.certificate?.checked, ms: r.ms });
  } catch (err) {
    post({ kind: 'error', message: err instanceof BmcError || err instanceof RuntimeFailure ? err.message : String(err) });
  }
  post({ kind: 'done' });
});
