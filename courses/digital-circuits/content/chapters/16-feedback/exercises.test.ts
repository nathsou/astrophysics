import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { runCheck, startCircuit, type BuildInput } from '$lib/components/exercise/circuit/spec';
import { partsResolver } from '$lib/partsbin/store-core';

const md = readFileSync(fileURLToPath(new URL('./index.md', import.meta.url)), 'utf8');
const chapters = fileURLToPath(new URL('../', import.meta.url));
const blocks = [...md.matchAll(/```(build|golf|debug)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as BuildInput }));
const parts = partsResolver(false);
const file = (v: unknown) => (typeof v === 'string' ? JSON.parse(readFileSync(chapters + v, 'utf8')) : v);

describe('exercise blocks of Chapter 16', () => {
  test('the SR latch build exercise is there', () => {
    expect(blocks.map((b) => b.spec.id)).toEqual(['feedback/sr-latch']);
    expect(blocks[0]!.spec.part).toBe('sr-latch');
    expect(blocks[0]!.spec.allowed).toEqual(['nor']);
  });
  for (const b of blocks) {
    test(`${b.spec.id}: the solution passes and the empty canvas does not`, () => {
      const input = { ...b.spec, solution: file(b.spec.solution), start: file(b.spec.start) } as BuildInput;
      const r = runCheck(input, input.solution!, parts);
      expect(r.problems, r.headline).toEqual([]);
      expect(r.violations).toEqual([]);
      expect(r.pass).toBe(true);
      expect(runCheck(input, startCircuit(input), parts).pass).toBe(false);
    });
  }
  test('two NAND gates are not accepted by the rules of the exercise, and a NOR latch with the outputs swapped fails', () => {
    const input = { ...blocks[0]!.spec, solution: file(blocks[0]!.spec.solution) } as BuildInput;
    const bad = structuredClone(input.solution!);
    for (const c of bad.components) if (c.type === 'nor') c.type = 'nand';
    const r = runCheck(input, bad, parts);
    expect(r.pass).toBe(false);
    expect(r.violations.join(' ')).toMatch(/Not allowed/);
    const swapped = structuredClone(input.solution!);
    for (const c of swapped.components) if (c.id === 'S') c.id = 'tmp';
    for (const c of swapped.components) if (c.id === 'R') c.params = { ...c.params, name: 'S' };
    for (const c of swapped.components) if (c.id === 'tmp') c.params = { ...c.params, name: 'R' };
    expect(runCheck(input, swapped, parts).pass).toBe(false);
  });
});
