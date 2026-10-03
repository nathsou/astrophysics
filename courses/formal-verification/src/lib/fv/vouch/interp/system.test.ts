import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from '../syntax/parser';
import { check } from '../check/checker';
import { SystemRuntime, type State } from './system';

const ex = (f: string) => readFileSync(path.resolve(import.meta.dirname, '../examples', f), 'utf8');

function load(src: string, name: string) {
  const p = parse(src);
  const c = check(p.program);
  const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((d) => d.message).join('\n'));
  return new SystemRuntime(c, name);
}

/** Plain BFS (the explorer engine is tested separately against this). */
function bfs(rt: SystemRuntime, inv?: string) {
  const { states } = rt.initial();
  const seen = new Map<string, { state: State; parent?: string; label?: string }>();
  const queue: State[] = [];
  for (const s of states) {
    seen.set(rt.key(s), { state: s });
    queue.push(s);
  }
  const invariant = inv ? rt.info.invariants.find((i) => i.name === inv)!.expr : undefined;
  while (queue.length) {
    const s = queue.shift()!;
    if (invariant && !rt.holds(invariant, s)) {
      const trace: string[] = [];
      for (let k: string | undefined = rt.key(s); k; k = seen.get(k)!.parent) if (seen.get(k)!.label) trace.unshift(seen.get(k)!.label!);
      return { states: seen.size, violation: s, trace };
    }
    const { succs, failures } = rt.successors(s);
    if (failures.length) throw failures[0]!.failure;
    for (const n of succs) {
      const k = rt.key(n.state);
      if (!seen.has(k)) {
        seen.set(k, { state: n.state, parent: rt.key(s), label: n.label.text });
        queue.push(n.state);
      }
    }
  }
  return { states: seen.size };
}

describe('systems', () => {
  it('Die Hard: the shortest way to 4 gallons takes 6 steps', () => {
    const rt = load(ex('die-hard.vouch'), 'DieHard');
    const r = bfs(rt, 'not_four');
    expect(r.violation).toBeDefined();
    expect(r.trace).toHaveLength(6);
    expect(rt.describe(r.violation!).find((x) => x.name === 'big')!.value).toBe('4');
  });
  it('Peterson: mutual exclusion holds in every reachable state', () => {
    const rt = load(ex('peterson.vouch'), 'Peterson');
    expect(rt.instances.map((i) => i.name)).toEqual(['P(0)', 'P(1)']);
    const r = bfs(rt, 'mutex');
    expect(r.violation).toBeUndefined();
    expect(r.states).toBeGreaterThan(10);
  });
  it('Hyman: both processes can reach the critical section', () => {
    const rt = load(ex('hyman.vouch'), 'Hyman');
    const r = bfs(rt, 'mutex');
    expect(r.violation).toBeDefined();
    expect(rt.at(r.violation!, rt.info.processes[0]!.sym, [0n], 'critical')).toBe(true);
    expect(rt.at(r.violation!, rt.info.processes[0]!.sym, [1n], 'critical')).toBe(true);
  });
  it('Two-phase commit with three shards keeps decisions consistent', () => {
    const rt = load(ex('two-phase-commit.vouch'), 'TwoPhaseCommit');
    expect(bfs(rt, 'consistent').violation).toBeUndefined();
    expect(bfs(rt, 'commit_means_yes').violation).toBeUndefined();
  });
  it('Needham–Schroeder: the intruder makes B believe it talks to A', () => {
    const rt = load(ex('needham-schroeder.vouch'), 'NeedhamSchroeder');
    const r = bfs(rt, 'responder_authenticated');
    expect(r.violation).toBeDefined();
    expect(r.trace!.some((t) => t.startsWith('a_start(p = I)'))).toBe(true);
  });
  it('action guards that draw parameters from a set only enumerate the set', () => {
    const rt = load(`system S {
  var pending: set<int> = {3, 5}
  var done: int = 0
  action take(n: int) when n in pending { pending = pending - {n}
 done = done + n }
}`, 'S');
    expect(bfs(rt).states).toBe(4);
  });
  it('choose makes a step nondeterministic, await blocks it', () => {
    const rt = load(`system S {
  var x: 0..4 = 0
  var go: bool = false
  action pick { choose v: 0..4 where v > 1
 x = v }
  process P { loop { s: await x == 3
 go = true } }
}`, 'S');
    const { states } = rt.initial();
    const { succs } = rt.successors(states[0]!);
    expect(succs.filter((s) => s.label.name === 'pick')).toHaveLength(2);
    expect(succs.filter((s) => s.label.kind === 'process')).toHaveLength(0);
  });
});
