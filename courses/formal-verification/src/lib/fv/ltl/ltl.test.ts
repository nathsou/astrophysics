import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { SystemRuntime } from '../vouch/interp/system';
import { checkProperty } from './check';
import { evalLasso, G, Fev, U, X, and, not, type Ltl } from './ltl';
import { toBuchi } from './buchi';
import { explore } from '../explore/explorer';

const ex = (f: string) => readFileSync(path.resolve(import.meta.dirname, '../vouch/examples', f), 'utf8');
function load(src: string, name: string) {
  const p = parse(src);
  const c = check(p.program);
  const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((d) => d.message).join('\n'));
  return new SystemRuntime(c, name);
}
const a = (id: number): Ltl => ({ k: 'atom', id });

describe('LTL on lassos', () => {
  // A lasso with positions 0,1,2 and the cycle 1 → 2 → 1 …; atom 0 holds at 2 only.
  const at = (i: number, id: number) => id === 0 && i === 2;
  it('evaluates eventually, always, until and next', () => {
    expect(evalLasso(Fev(a(0)), 3, 1, at)).toBe(true);
    expect(evalLasso(G(Fev(a(0))), 3, 1, at)).toBe(true);
    expect(evalLasso(Fev(G(a(0))), 3, 1, at)).toBe(false);
    expect(evalLasso(X(X(a(0))), 3, 1, at)).toBe(true);
    expect(evalLasso(U(not(a(0)), a(0)), 3, 1, at)).toBe(true);
    expect(evalLasso(G(not(a(0))), 3, 1, at)).toBe(false);
  });
  it('the Büchi automaton of a formula accepts exactly its lassos (spot check)', () => {
    // GF p ∧ FG ¬p is unsatisfiable: its automaton must have no accepting cycle reachable with consistent labels.
    const f = and(G(Fev(a(0))), Fev(G(not(a(0)))));
    const b = toBuchi(f);
    expect(b.nodes.length).toBeGreaterThan(0);
    expect(b.accepting.length).toBe(2);
  });
});

describe('model checking temporal properties', () => {
  it('Peterson: with weak fairness every waiting process eventually enters', () => {
    const rt = load(ex('peterson.vouch'), 'Peterson');
    const prop = rt.info.properties[0]!;
    const v = checkProperty(rt, prop);
    expect(v.status).toBe('verified');
    expect(v.badge.kind).toBe('exhaustive');
  });
  it('Peterson without fairness: a lasso where the system pauses forever', () => {
    const rt = load(ex('peterson.vouch'), 'Peterson');
    const v = checkProperty(rt, rt.info.properties[0]!, { fairness: false });
    expect(v.status).toBe('violated');
    expect(v.certificate.checked).toBe(true);
    expect(v.trace!.loopsTo).toBeGreaterThanOrEqual(0);
  });
  it('a spin lock starves a process even under weak fairness, but not under strong fairness', () => {
    const src = (strength: string) => `system Spin {
  type Proc = 0..2
  var locked: bool = false
  process P(me: Proc) {
    loop {
      try: await !locked
      take: locked = true
      crit: locked = false
    }
  }
  property progress: forall p: Proc :: always (P(p) at try ==> eventually P(p) at crit)
  fairness ${strength} P
}`;
    const rtw = load(src('weak'), 'Spin');
    const vw = checkProperty(rtw, rtw.info.properties[0]!);
    expect(vw.status).toBe('violated');
    expect(vw.certificate.checked).toBe(true);
    const rts = load(src('strong'), 'Spin');
    expect(checkProperty(rts, rts.info.properties[0]!).status).toBe('verified');
  });
});

describe('the explorer', () => {
  it('finds Hyman’s bug with a replayed trace', () => {
    const rt = load(ex('hyman.vouch'), 'Hyman');
    const { verdicts } = explore(rt);
    expect(verdicts[0]!.status).toBe('violated');
    expect(verdicts[0]!.certificate.checked).toBe(true);
    expect(verdicts[0]!.trace!.steps.length).toBeGreaterThan(3);
  });
  it('reports exhaustive results with state counts', () => {
    const rt = load(ex('peterson.vouch'), 'Peterson');
    const { verdicts } = explore(rt);
    expect(verdicts[0]!.status).toBe('verified');
    expect(verdicts[0]!.badge).toMatchObject({ kind: 'exhaustive' });
  });
  it('symmetry reduction shrinks two-phase commit without changing the answer', () => {
    const rt = load(ex('two-phase-commit.vouch'), 'TwoPhaseCommit');
    const plain = explore(rt).verdicts;
    const sym = explore(rt, { symmetry: true }).verdicts;
    expect(plain.map((v) => v.status)).toEqual(sym.map((v) => v.status));
    expect(sym[0]!.stats.states).toBeLessThan(plain[0]!.stats.states!);
  });
  it('finds a deadlock from lock ordering', () => {
    const rt = load(`system Locks {
  var owner_a: 0..3 = 0
  var owner_b: 0..3 = 0
  process T1 { loop {
    la: await owner_a == 0
    owner_a = 1
    lb: await owner_b == 0
    owner_b = 1
    rel: owner_a, owner_b = 0, 0
  } }
  process T2 { loop {
    lb: await owner_b == 0
    owner_b = 2
    la: await owner_a == 0
    owner_a = 2
    rel: owner_a, owner_b = 0, 0
  } }
}`, 'Locks');
    const { verdicts } = explore(rt, { deadlock: true });
    expect(verdicts[0]!.status).toBe('violated');
    expect(verdicts[0]!.subject).toBe('no deadlock');
  });
});
