import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { partsResolver } from '$lib/partsbin/store-core';
import { golfScore, runCheck, startCircuit, type BuildInput } from '$lib/components/exercise/circuit/spec';

/**
 * The exercises of Chapter 13: every `build` and `golf` block must be solvable: its own `solution` passes its checker
 * within the rules of the exercise, the empty starting circuit fails it, and the golf par is met.
 */
const here = fileURLToPath(new URL('./', import.meta.url));
const chapters = path.resolve(here, '..');
const md = readFileSync(path.join(here, 'index.md'), 'utf8');
const blocks = [...md.matchAll(/```(build|golf|debug)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as BuildInput }));
const parts = partsResolver(false);
for (const b of blocks) if (typeof b.spec.solution === 'string') b.spec.solution = JSON.parse(readFileSync(path.join(chapters, b.spec.solution), 'utf8'));

describe('exercise blocks', () => {
  test('the chapter builds mux2, mux4, dec2-4 and the comparator, and has the seven-segment golf', () => {
    expect(blocks.map((b) => b.spec.id)).toEqual(['blocks/mux2', 'blocks/mux4', 'blocks/dec2-4', 'blocks/comparator', 'blocks/seg7-golf']);
    expect(blocks.map((b) => b.spec.part)).toEqual(['mux2', 'mux4', 'dec2-4', 'comparator', 'seg7']);
  });
  for (const b of blocks) {
    test(`${b.spec.id}: the solution passes and the empty canvas does not`, () => {
      expect(b.spec.solution).toBeDefined();
      const r = runCheck(b.spec, b.spec.solution!, parts);
      expect(r.problems, r.headline).toEqual([]);
      expect(r.violations).toEqual([]);
      expect(r.pass).toBe(true);
      expect(runCheck(b.spec, startCircuit(b.spec), parts).pass).toBe(false);
    });
  }
  test('the golf solution scores exactly par (30)', () => {
    const g = blocks.find((b) => b.kind === 'golf')!;
    const r = runCheck(g.spec, g.spec.solution!, parts);
    expect(g.spec.par).toBe(30);
    expect(golfScore(g.spec, r.cost!)?.strokes).toBe(0);
  });
  test('the comparator solution uses the fifteen gates the explanation says', () => {
    const c = blocks.find((b) => b.spec.id === 'blocks/comparator')!;
    expect(runCheck(c.spec, c.spec.solution!, parts).cost?.gates).toBe(15);
  });
});
