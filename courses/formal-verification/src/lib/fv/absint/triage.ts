/**
 * Alarm triage (chapter 26): an alarm from abstract interpretation may be real or false. Symbolic execution
 * (chapter 15) looks for an input that makes the same check fail on the same line; when it finds one and the
 * interpreter replays the failure, the alarm is confirmed. When it finds none within its bounds, the alarm stays
 * unconfirmed: possibly false, possibly a failure that needs more loop iterations than were explored.
 */
import type { Checked, FnInfo } from '../vouch/check/checker';
import { SymbolicExplorer } from '../symex/symex';
import { Runner } from '../vouch/interp/exec';
import { show, type Value } from '../vouch/interp/values';
import type { Ty } from '../vouch/check/types';
import type * as A from '../vouch/syntax/ast';
import type { Check, CheckKind } from './analyse';

export interface Triaged extends Check {
  verdict: 'proved' | 'confirmed' | 'unconfirmed';
  /** For a confirmed alarm: the failing input, replayed by the interpreter. */
  input?: string;
  failure?: string;
}

/** Interpreter failure kinds for each check. */
const RUN_KIND: Record<CheckKind, string[]> = { assert: ['assert'], division: ['division'], index: ['bounds'], overflow: ['overflow', 'range'], nat: ['overflow', 'range'], conversion: ['narrowing'] };

/** Boundary values for a parameter: the type's ends, 0, ±1, and the integer constants in the code (and ±1 around them). */
function boundary(ty: Ty, consts: bigint[]): Value[] | undefined {
  const ints = (lo: bigint | null, hi: bigint | null): Value[] => {
    const cand = new Set<bigint>([0n, 1n, -1n, 2n, ...consts.flatMap((c) => [c, c - 1n, c + 1n])]);
    if (lo !== null) [lo, lo + 1n].forEach((x) => cand.add(x));
    if (hi !== null) [hi, hi - 1n].forEach((x) => cand.add(x));
    return [...cand].filter((x) => (lo === null || x >= lo) && (hi === null || x <= hi)).sort((a, b) => (a < b ? -1 : 1));
  };
  switch (ty.k) {
    case 'int':
      return ints(null, null);
    case 'nat':
      return ints(0n, null);
    case 'range':
      return ints(ty.lo, ty.hi - 1n);
    case 'mach': {
      const b = BigInt(ty.bits);
      return ty.signed ? ints(-(1n << (b - 1n)), (1n << (b - 1n)) - 1n) : ints(0n, (1n << b) - 1n);
    }
    case 'bool':
      return [false, true];
  }
  return undefined;
}

function constantsIn(e: unknown, out: bigint[] = []): bigint[] {
  if (!e || typeof e !== 'object') return out;
  const x = e as { k?: string; value?: unknown };
  if (x.k === 'int' && typeof x.value === 'bigint') out.push(x.value);
  for (const v of Object.values(e)) if (v && typeof v === 'object') constantsIn(v, out);
  return out;
}

/** Run the function on combinations of boundary values (a bounded number), looking for the alarm's failure. */
function testBoundaries(checked: Checked, info: FnInfo, alarms: Check[], lineOf: (off: number) => number): Map<Check, { input: string; failure: string }> {
  const found = new Map<Check, { input: string; failure: string }>();
  const consts = [...new Set(constantsIn(info.decl as A.FnDecl))].slice(0, 12);
  const doms = info.params.map((p) => boundary(p.ty, consts));
  if (doms.some((d) => !d)) return found;
  let combos: Value[][] = [[]];
  for (const d of doms as Value[][]) {
    combos = combos.flatMap((c) => d.map((v) => [...c, v]));
    if (combos.length > 4000) combos = combos.filter((_, i) => i % 2 === 0);
  }
  for (const args of combos.slice(0, 4000)) {
    const r = new Runner(checked, { fuel: 20_000 }).run(info.decl.name, args);
    if (r.discarded || !r.failure) continue;
    for (const a of alarms) {
      if (found.has(a)) continue;
      if (RUN_KIND[a.kind].includes(r.failure.kind) && lineOf(r.failure.span.start) === a.line) {
        found.set(a, { input: info.params.map((p, i) => `${p.name} = ${show(args[i]!)}`).join(', '), failure: r.failure.message });
      }
    }
    if (found.size === alarms.length) break;
  }
  return found;
}

const SYMEX_KIND: Record<CheckKind, string[]> = { assert: ['assert'], division: ['division'], index: ['bounds'], overflow: ['overflow', 'range'], nat: ['overflow', 'range'], conversion: ['narrowing'] };

export function triage(checked: Checked, info: FnInfo, source: string, checks: Check[], opts: { maxUnroll?: number; maxNodes?: number } = {}): { checks: Triaged[]; explored: number; unroll: number } {
  const alarms = checks.filter((c) => c.status === 'alarm');
  if (!alarms.length) return { checks: checks.map((c) => ({ ...c, verdict: 'proved' })), explored: 0, unroll: 0 };
  const unroll = opts.maxUnroll ?? 8;
  const ex = new SymbolicExplorer(checked, info, source, { maxUnroll: unroll, maxNodes: opts.maxNodes ?? 150, timeout: 2000 });
  // First, cheap concrete runs on boundary values; then symbolic execution for what they did not confirm.
  const byTest = testBoundaries(checked, info, alarms, (o) => ex.lineOf(o));
  const left = alarms.filter((a) => !byTest.has(a));
  const failures = left.length ? ex.all().nodes.flatMap((n) => n.failures).filter((f) => f.replayed) : [];
  return {
    explored: ex.nodes.length,
    unroll,
    checks: checks.map((c): Triaged => {
      if (c.status === 'proved') return { ...c, verdict: 'proved' };
      const t = byTest.get(c);
      if (t) return { ...c, verdict: 'confirmed', input: t.input, failure: t.failure };
      const f = failures.find((x) => SYMEX_KIND[c.kind].includes(x.kind) && ex.lineOf(x.span.start) === c.line);
      return f ? { ...c, verdict: 'confirmed', input: f.input, failure: f.message } : { ...c, verdict: 'unconfirmed' };
    }),
  };
}
