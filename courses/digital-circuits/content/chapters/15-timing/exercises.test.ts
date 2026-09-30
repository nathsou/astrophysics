import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { runCheck, type BuildInput } from '$lib/components/exercise/circuit/spec';

const md = readFileSync(fileURLToPath(new URL('./index.md', import.meta.url)), 'utf8');
const chapters = fileURLToPath(new URL('../', import.meta.url));
const block = YAML.parse([...md.matchAll(/```debug\n([\s\S]*?)```/g)][0]![1]!) as BuildInput;
const file = (v: unknown) => (typeof v === 'string' ? JSON.parse(readFileSync(chapters + v, 'utf8')) : v);
const input = { ...block, start: file(block.start), solution: file(block.solution) } as BuildInput;

describe('the gated-clock debug exercise', () => {
  test('the starting circuit fails on the hazard, and only there', () => {
    const r = runCheck(input, input.start!);
    expect(r.pass).toBe(false);
    expect(r.scenarios!.failures.map((f) => f.scenario)).toEqual(['A keeps switching, B = D = 1: no edge on F']);
    expect(r.scenarios!.failures[0]).toMatchObject({ target: 'FLAG.Q', expected: 'low', got: 'high' });
  });
  test('the solution, with the consensus term, passes both scenarios', () => {
    const r = runCheck(input, input.solution!);
    expect(r.problems).toEqual([]);
    expect(r.pass).toBe(true);
  });
  test('tying F high is no fix: it loses the case where D is 0', () => {
    const cheat = structuredClone(input.start!);
    const f = cheat.components.find((c) => c.id === 'F')!;
    f.type = 'const';
    f.params = { value: 1 };
    // Detach everything that fed the old OR gate: the constant stands alone at the same position.
    const r = runCheck(input, cheat);
    expect(r.pass).toBe(false);
  });
  test('making the inverter instantaneous hides the hazard in the simulator (and the text says that is no fix)', () => {
    const c = structuredClone(input.start!);
    const n = c.components.find((x) => x.id === 'A′')!;
    n.params = { ...n.params, delay: 0 };
    expect(runCheck(input, c).pass).toBe(true);
  });
});
