/**
 * Verdicts of the heap verifier. A proof is reported as verified (its certificate is the symbolic execution itself,
 * which is not re-checked). An error is replayed when possible: the precondition's lists are built concretely with
 * 0 to 3 nodes and the function is run in the interpreter; a null dereference or a use after free that happens
 * there is a confirmed violation. A leak cannot be seen at run time; it is reported as found by the analysis.
 */
import type { Checked, FnInfo } from '../vouch/check/checker';
import type * as A from '../vouch/syntax/ast';
import type { Verdict } from '../engines';
import { Runner } from '../vouch/interp/exec';
import { Heap } from '../vouch/interp/eval';
import type { Value } from '../vouch/interp/values';
import { HeapVerifier, type HeapError, type HeapResult } from './symheap';

const ASSUMPTIONS = [
  'the symbolic-heap prover is correct (its proofs are not re-checked by an independent checker)',
  'memory safety and shape only: the values stored in list nodes are not tracked by the list predicate',
];

/** Build concrete arguments for the precondition: lists of n nodes for list(p), objects for p.f ↦ c. */
function concreteInputs(checked: Checked, d: A.FnDecl, n: number): { args: Value[]; heap: Heap } | undefined {
  const heap = new Heap();
  const listCls = checked.program.decls.find((x) => x.k === 'class' && x.fields.some((f) => f.name === 'next')) as A.StructDecl | undefined;
  const lists = new Set<string>();
  const objects = new Map<string, Map<string, bigint | null>>();
  const visit = (e: A.Expr) => {
    if (e.k === 'call' && (e.callee === 'list' || e.callee === 'lseg') && e.args[0]?.k === 'var') lists.add(e.args[0].name);
    if (e.k === 'binary' && e.op === '|->' && e.left.k === 'field' && e.left.target.k === 'var') {
      const m = objects.get(e.left.target.name) ?? objects.set(e.left.target.name, new Map()).get(e.left.target.name)!;
      m.set(e.left.name, e.right.k === 'int' ? e.right.value : e.right.k === 'null' ? null : 0n);
    }
    if (e.k === 'binary') {
      visit(e.left);
      visit(e.right);
    }
  };
  d.spec.requires.forEach((r) => visit(r.value));
  const args: Value[] = [];
  for (const p of d.params) {
    if (p.type.k !== 'ref') {
      args.push(0n);
      continue;
    }
    if (lists.has(p.name) && listCls) {
      let next: Value = null;
      for (let i = 0; i < n; i++) {
        const fields = listCls.fields.map((f) => (f.name === 'next' ? next : f.type.k === 'ref' ? null : BigInt(n - i)));
        next = heap.alloc(listCls.name, fields);
      }
      args.push(next);
      continue;
    }
    const cls = checked.program.decls.find((x) => x.k === 'class' && x.name === (p.type as { cls: string }).cls) as A.StructDecl | undefined;
    if (!cls) return undefined;
    const given = objects.get(p.name);
    if (!given && p.type.nullable) {
      args.push(null);
      continue;
    }
    const fields = cls.fields.map((f) => (given?.has(f.name) ? (given.get(f.name) as Value) : f.type.k === 'ref' ? null : 0n));
    args.push(heap.alloc(cls.name, fields));
  }
  return { args, heap };
}

function replay(checked: Checked, d: A.FnDecl, err: HeapError): string | undefined {
  if (err.kind !== 'null' && err.kind !== 'freed') return undefined;
  for (let n = 0; n <= 3; n++) {
    const input = concreteInputs(checked, d, n);
    if (!input) return undefined;
    const r = new Runner(checked, { fuel: 50_000 }).run(d.name, input.args, input.heap);
    if (r.failure && (r.failure.kind === 'null' || r.failure.kind === 'use-after-free')) return `${r.failure.message} The interpreter fails this way on ${n === 0 ? 'empty lists' : `lists of ${n} node${n === 1 ? '' : 's'}`}.`;
  }
  return undefined;
}

export function heapVerdicts(checked: Checked, info: FnInfo, source: string): { verdicts: Verdict[]; result: HeapResult } {
  const d = info.decl;
  const result = new HeapVerifier(checked, source).verify(d.name);
  if (!result.errors.length) {
    return {
      result,
      verdicts: [{
        engine: 'heap',
        status: 'verified',
        subject: `${d.name} is memory-safe and meets its heap contract`,
        badge: { kind: 'verified', scope: 'all inputs' },
        certificate: { kind: 'none', checked: false, checker: 'the symbolic-heap prover (its proof is not re-checked)' },
        assumptions: ASSUMPTIONS,
        stats: { paths: result.paths, steps: result.steps.length },
        message: `Every path (${result.paths || 1}) was executed symbolically: no access outside the owned heap, the postcondition accounts for the whole heap at every return, and every loop invariant holds.`,
        span: d.nameSpan,
      }],
    };
  }
  const verdicts: Verdict[] = result.errors.map((e) => {
    const confirmed = replay(checked, d, e);
    if (confirmed) {
      return { engine: 'heap', status: 'violated', subject: e.message.split(':')[0]!, badge: { kind: 'violated', replayed: true }, certificate: { kind: 'trace', checked: true, checker: 'the reference interpreter (the failing run is the certificate)' }, assumptions: [], stats: {}, message: `${e.message} ${confirmed}`, span: e.span };
    }
    if (e.definite && (e.kind === 'leak' || e.kind === 'freed')) {
      return { engine: 'heap', status: 'violated', subject: e.message.split(':')[0]!, badge: { kind: 'violated', replayed: false }, certificate: { kind: 'none', checked: false, checker: 'the symbolic-heap analysis (a leak cannot be seen at run time)' }, assumptions: ASSUMPTIONS, stats: {}, message: e.message, span: e.span };
    }
    return { engine: 'heap', status: 'unknown', subject: e.message.split(':')[0]!, badge: { kind: 'unknown', reason: 'not proved' }, certificate: { kind: 'none', checked: false, checker: '' }, assumptions: ASSUMPTIONS, stats: {}, message: e.message, span: e.span };
  });
  return { verdicts, result };
}
