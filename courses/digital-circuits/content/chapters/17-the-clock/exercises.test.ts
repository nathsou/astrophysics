import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { runCheck, startCircuit, type BuildInput } from '$lib/components/exercise/circuit/spec';
import { getPart } from '$lib/partsbin/parts';
import { partsResolver } from '$lib/partsbin/store-core';

/**
 * The circuit exercises of Chapter 17: each solution passes the checker (and only uses the parts the block allows),
 * and the starting circuit (empty ports, or the faulty circuit of a debug block) fails it.
 */
const md = readFileSync(fileURLToPath(new URL('./index.md', import.meta.url)), 'utf8');
const blocks = [...md.matchAll(/```(build|debug|golf)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as BuildInput }));

describe('the exercise blocks', () => {
  test('two builds and one debug', () => {
    expect(blocks.map((b) => `${b.kind}:${b.spec.id}`)).toEqual(['build:clock/d-latch', 'build:clock/d-flip-flop', 'debug:clock/debug-flip-flop']);
  });
  test('the builds name parts that exist', () => {
    for (const b of blocks) if (b.spec.part) expect(getPart(b.spec.part), b.spec.part).toBeDefined();
  });
  for (const b of blocks) {
    test(`${b.spec.id}: the solution passes`, () => {
      const r = runCheck(b.spec, b.spec.solution!, partsResolver(false));
      expect(r.problems, r.headline).toEqual([]);
      expect(r.violations).toEqual([]);
      expect(r.pass).toBe(true);
    });
    test(`${b.spec.id}: the starting circuit fails`, () => {
      const start = b.kind === 'debug' ? b.spec.start! : startCircuit(b.spec);
      const r = runCheck(b.spec, start, partsResolver(false));
      expect(r.pass).toBe(false);
    });
  }
});
