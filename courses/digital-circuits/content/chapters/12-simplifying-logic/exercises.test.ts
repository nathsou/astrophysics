import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { golfScore, runCheck, type BuildInput } from '$lib/components/exercise/circuit/spec';
import { minGates, tableOf, type Kind, type Target } from './widgets/search';

/**
 * The gate-golf exercises of Chapter 12: each block's own solution passes its checker and scores exactly par,
 * and par is the true minimum: an exhaustive search finds no circuit with one gate fewer.
 */
const md = readFileSync(fileURLToPath(new URL('./index.md', import.meta.url)), 'utf8');
const blocks = [...md.matchAll(/```(golf|build|debug)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as BuildInput }));

const targets: Record<string, Target> = {
  'simplify/majority-golf': tableOf(3, (b) => +(b[0]! + b[1]! + b[2]! >= 2) as 0 | 1),
  'simplify/mux-golf': tableOf(3, (b) => (b[0]! ? b[2]! : b[1]!) as 0 | 1),
  'simplify/seg-a-golf': tableOf(4, (b) => {
    const m = b[0]! * 8 + b[1]! * 4 + b[2]! * 2 + b[3]!;
    return m >= 10 ? null : ([0, 2, 3, 5, 6, 7, 8, 9].includes(m) ? 1 : 0);
  }),
};

describe('golf blocks', () => {
  test('three golf exercises', () => {
    expect(blocks.map((b) => b.spec.id)).toEqual(Object.keys(targets));
  });
  for (const b of blocks) {
    test(`${b.spec.id}: the solution passes and scores par`, () => {
      const r = runCheck(b.spec, b.spec.solution!);
      expect(r.problems, r.headline).toEqual([]);
      expect(r.violations).toEqual([]);
      expect(r.pass).toBe(true);
      expect(golfScore(b.spec, r.cost!)?.strokes).toBe(0);
    });
    test(`${b.spec.id}: par is optimal (no circuit of par − 1 gates)`, () => {
      const kinds = b.spec.allowed as Kind[];
      const fan = kinds.length && b.spec.id === 'simplify/seg-a-golf' ? 4 : 3;
      expect(minGates(targets[b.spec.id]!, kinds, b.spec.par!, fan)).toBe(b.spec.par);
    }, 300_000);
  }
});
