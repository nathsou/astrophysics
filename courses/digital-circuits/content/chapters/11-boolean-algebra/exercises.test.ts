import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { golfScore, runCheck, type BuildInput } from '$lib/components/exercise/circuit/spec';

/**
 * The circuit exercises of Chapter 11: every `build`, `golf` and `debug` block must be solvable, that is, its
 * own `solution` passes its checker within the rules of the exercise, and a debug block's `start` fails it.
 */
const md = readFileSync(fileURLToPath(new URL('./index.md', import.meta.url)), 'utf8');
const blocks = [...md.matchAll(/```(build|golf|debug)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as BuildInput }));

describe('exercise blocks', () => {
  test('the chapter has the four parts and a debug exercise', () => {
    expect(blocks.map((b) => b.spec.id)).toEqual(['boolean/and', 'boolean/or', 'boolean/xor-golf', 'boolean/xnor', 'boolean/debug-nor']);
    expect(blocks.map((b) => b.spec.part).filter(Boolean)).toEqual(['and', 'or', 'xor', 'xnor']);
  });
  for (const b of blocks) {
    test(`${b.spec.id}: the solution passes`, () => {
      expect(b.spec.solution).toBeDefined();
      const r = runCheck(b.spec, b.spec.solution!);
      expect(r.problems, r.headline).toEqual([]);
      expect(r.violations).toEqual([]);
      expect(r.pass).toBe(true);
    });
  }
  test('the golf solution scores par', () => {
    const g = blocks.find((b) => b.kind === 'golf')!;
    const r = runCheck(g.spec, g.spec.solution!);
    expect(golfScore(g.spec, r.cost!)?.strokes).toBe(0);
  });
  test('the broken circuit of the debug exercise fails, and on the row the text says', () => {
    const d = blocks.find((b) => b.kind === 'debug')!;
    const r = runCheck(d.spec, d.spec.start!);
    expect(r.pass).toBe(false);
    expect(r.comb?.failures.length).toBeGreaterThan(0);
    // An OR of the inverses is a NAND: it disagrees with NOR when exactly one input is 1.
    expect(r.comb!.failures.map((f) => f.index).sort()).toEqual([1, 2]);
  });
});
