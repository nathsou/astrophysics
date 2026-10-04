import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { runCommand } from './encode';
import { Runner } from '../vouch/interp/exec';
import { Heap, type Env } from '../vouch/interp/eval';
import { rel, type Value } from '../vouch/interp/values';

const load = (src: string) => {
  const c = check(parse(src).program);
  const errs = c.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.message).join('\n'));
  return c;
};
const cmd = (c: ReturnType<typeof load>, world: string, name: string) => c.containers.get(world)!.checks.find((x) => x.name === name)!;

/** Count instances by repeatedly excluding the ones found. */
function countInstances(src: string, world: string, name: string, scope: number): number {
  const c = load(src);
  const exclude: boolean[][] = [];
  for (;;) {
    const r = runCommand(c, world, cmd(c, world, name), { scope, proof: false, exclude });
    if (!r.found) return exclude.length;
    expect(r.instanceChecked).toBe(true);
    exclude.push(r.model!);
    if (exclude.length > 2000) throw new Error('too many');
  }
}

describe('relational encoder', () => {
  it('finds the cycle in the file-system model, and none once directories hang off the root', () => {
    const src = readFileSync(new URL('../vouch/examples/file-system.vouch', import.meta.url), 'utf8');
    const c = load(src);
    const r = runCommand(c, 'FileSystem', cmd(c, 'FileSystem', 'no_dir_contains_itself'));
    expect(r.found).toBe(true);
    expect(r.instanceChecked).toBe(true);
    const fixed = src.replace('  check no_dir_contains_itself', '  fact reachable: forall d: Dir :: d in root.*~parent\n  check no_dir_contains_itself');
    const c2 = load(fixed);
    for (const scope of [2, 3, 4]) {
      const r2 = runCommand(c2, 'FileSystem', cmd(c2, 'FileSystem', 'no_dir_contains_itself'), { scope });
      expect(r2.found).toBe(false);
      expect(r2.proofChecked).toBe(true);
    }
  });

  it('respects multiplicities', () => {
    const src = (mult: string) => `world W {
  type A, B
  rel f: A -> ${mult} B
  run any: true for 2
}`;
    // Scope 2: universes (a, b) with a, b in 0..2 atoms; count relations per multiplicity.
    const total = (per: (b: number) => number) => {
      let n = 0;
      for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) n += per(b) ** a;
      return n;
    };
    expect(countInstances(src('one'), 'W', 'any', 2)).toBe(total((b) => b));
    expect(countInstances(src('lone'), 'W', 'any', 2)).toBe(total((b) => b + 1));
    expect(countInstances(src('some'), 'W', 'any', 2)).toBe(total((b) => 2 ** b - 1));
    expect(countInstances(src('set'), 'W', 'any', 2)).toBe(total((b) => 2 ** b));
  });

  it('agrees with the interpreter on every relation over up to 2 atoms', () => {
    const formulas = [
      'some r',
      'no r',
      'forall a: A :: lone a.r',
      'r.r in r',
      '~r == r',
      'exists a: A :: a in a.^r',
      '#r == 2',
      '#r <= 1',
      'some { a: A | no a.r }',
      'A in A.r',
      'forall a: A :: a.*r == A',
      'one r && some ~r',
      'r - ~r == r',
      '(r & ~r) in r',
      'forall a, b: A :: a in b.r ==> b in a.r',
    ];
    for (const phi of formulas) {
      const src = `world W {
  type A
  rel r: A -> A
  run p: ${phi} for 2
}`;
      const c = load(src);
      const w = c.containers.get('W')!;
      const rSym = w.rels[0]!;
      const runner = new Runner(c, { fuel: 100000 });
      let expected = 0;
      for (let n = 0; n <= 2; n++) {
        const pairs: [number, number][] = [];
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pairs.push([i, j]);
        for (let mask = 0; mask < 1 << pairs.length; mask++) {
          const tuples = pairs.filter((_, k) => mask & (1 << k)).map(([i, j]) => [{ t: 'atom' as const, type: 'A', i }, { t: 'atom' as const, type: 'A', i: j }] as Value[]);
          const env: Env = { vals: new Map([[rSym.id, rel(2, tuples)]]), heap: new Heap(), universe: new Map([['A', n]]) };
          if (runner.ev.eval(w.checks[0]!.expr, env) === true) expected++;
        }
      }
      expect(countInstances(src, 'W', 'p', 2), phi).toBe(expected);
    }
  });
});
