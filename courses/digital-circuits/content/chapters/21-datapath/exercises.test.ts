import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { partsResolver } from '$lib/partsbin/store-core';
import { runCheck, startCircuit, type BuildInput } from '$lib/components/exercise/circuit/spec';

/**
 * The exercises of Chapter 21: every `build` block can be solved. Its own `solution` passes its checker within the rules
 * of the exercise, and the empty canvas does not.
 */
const here = fileURLToPath(new URL('./', import.meta.url));
const chapters = path.resolve(here, '..');
const md = readFileSync(path.join(here, 'index.md'), 'utf8');
const blocks = [...md.matchAll(/```(build|golf|debug)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as BuildInput }));
const parts = partsResolver(false);
for (const b of blocks) if (typeof b.spec.solution === 'string') b.spec.solution = JSON.parse(readFileSync(path.join(chapters, b.spec.solution), 'utf8'));

describe('exercise blocks', () => {
  test('the chapter builds the bus, the ALU and the register file, and has the overflow exercise', () => {
    expect(blocks.map((b) => b.spec.id)).toEqual(['datapath/bus', 'datapath/alu', 'datapath/register-file', 'datapath/overflow']);
    expect(blocks.map((b) => b.spec.part)).toEqual(['bus', 'alu', 'register-file', undefined]);
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
  test('the bus is sixteen tri-state buffers, as the explanation says', () => {
    const bus = blocks.find((b) => b.spec.id === 'datapath/bus')!.spec.solution!;
    expect(bus.components.filter((c) => c.type === 'part:tri-state' || c.type === 'tristate')).toHaveLength(16);
  });
});
