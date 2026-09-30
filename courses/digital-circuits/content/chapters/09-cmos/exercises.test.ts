import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { runCheck, type BuildInput } from '$lib/components/exercise/circuit/spec';

/**
 * The circuit exercises of Chapter 9: each `build` block must be solvable, that is, its own `solution` passes
 * the part's checker (on the switch-level engine) within the rules of the exercise, and they are the three parts
 * that the parts bin expects from this chapter.
 */
const md = readFileSync(fileURLToPath(new URL('./index.md', import.meta.url)), 'utf8');
const blocks = [...md.matchAll(/```(build|golf|debug)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as BuildInput }));

describe('exercise blocks', () => {
  test('the chapter builds the inverter, the NAND and the NOR', () => {
    expect(blocks.map((b) => b.spec.part)).toEqual(['not', 'nand', 'nor']);
  });
  for (const b of blocks) {
    test(`${b.spec.id}: the solution passes, with transistors only`, () => {
      expect(b.spec.solution).toBeDefined();
      const kinds = new Set(b.spec.solution!.components.map((c) => c.type));
      expect([...kinds].filter((k) => !['port', 'nmos', 'pmos', 'rail', 'ground'].includes(k))).toEqual([]);
      const r = runCheck(b.spec, b.spec.solution!);
      expect(r.problems, r.headline).toEqual([]);
      expect(r.violations).toEqual([]);
      expect(r.pass).toBe(true);
    });
  }
  test('an inverter with the two transistors swapped fails', () => {
    const b = blocks[0]!;
    const broken = JSON.parse(JSON.stringify(b.spec.solution));
    for (const c of broken.components) c.type = c.type === 'pmos' ? 'nmos' : c.type === 'nmos' ? 'pmos' : c.type;
    expect(runCheck(b.spec, broken).pass).toBe(false);
  });
});
