import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { partsResolver } from '$lib/partsbin/store-core';
import { golfScore, runCheck, startCircuit, type BuildInput } from '$lib/components/exercise/circuit/spec';

/**
 * The exercises of Chapter 14: every `build` and `golf` block must be solvable: its own `solution` passes its checker
 * within the rules of the exercise, the empty canvas fails it, and the golf par is met.
 */
const here = fileURLToPath(new URL('./', import.meta.url));
const chapters = path.resolve(here, '..');
const md = readFileSync(path.join(here, 'index.md'), 'utf8');
const blocks = [...md.matchAll(/```(build|golf|debug)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as BuildInput }));
const parts = partsResolver(false);
for (const b of blocks) if (typeof b.spec.solution === 'string') b.spec.solution = JSON.parse(readFileSync(path.join(chapters, b.spec.solution), 'utf8'));

describe('exercise blocks', () => {
  test('the chapter builds half-adder, full-adder, adder8 and shifter, and has the NAND full-adder golf', () => {
    expect(blocks.map((b) => b.spec.id)).toEqual(['arith/half-adder', 'arith/full-adder', 'arith/adder8', 'arith/shifter', 'arith/fa-nand-golf']);
    expect(blocks.map((b) => b.spec.part)).toEqual(['half-adder', 'full-adder', 'adder8', 'shifter', 'full-adder']);
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
  test('the golf solution scores exactly par (9 NAND gates)', () => {
    const g = blocks.find((b) => b.kind === 'golf')!;
    const r = runCheck(g.spec, g.spec.solution!, parts);
    expect(g.spec.par).toBe(9);
    expect(golfScore(g.spec, r.cost!)?.strokes).toBe(0);
    expect(r.cost?.byType).toEqual({ nand: 9 });
  });
  test('the shifter is 40 MUX2 parts, the adder 8 full adders and 8 XORs, as the explanations say', () => {
    const count = (id: string, type: string) => blocks.find((b) => b.spec.id === id)!.spec.solution!.components.filter((c) => c.type === type).length;
    expect(count('arith/shifter', 'part:mux2')).toBe(40);
    expect(count('arith/adder8', 'part:full-adder')).toBe(8);
    expect(count('arith/adder8', 'part:xor')).toBe(8);
  });
});
