import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { partsResolver } from '$lib/partsbin/store-core';
import { runCheck, startCircuit, type BuildInput } from '$lib/components/exercise/circuit/spec';
import { ROUTINES } from '../21-datapath/hardware/control-word';

/**
 * The exercises of Chapter 22: the `build` block can be solved (its solution passes and the empty canvas fails), the
 * `bug` block points at a real line, the `parsons` block gives the steps of CALL in the order the microprogram has them,
 * and the numbers the text quotes for the microprogram are right.
 */
const here = fileURLToPath(new URL('./', import.meta.url));
const chapters = path.resolve(here, '..');
const md = readFileSync(path.join(here, 'index.md'), 'utf8');
const blocks = (kind: string) => [...md.matchAll(new RegExp('```' + kind + '\\n([\\s\\S]*?)```', 'g'))].map((m) => YAML.parse(m[1]!) as Record<string, unknown>);
const parts = partsResolver(false);

describe('the build exercise', () => {
  const spec = blocks('build')[0] as unknown as BuildInput;
  if (typeof spec.spec?.reference === 'string') spec.spec.reference = JSON.parse(readFileSync(path.join(chapters, spec.spec.reference), 'utf8'));
  if (typeof spec.solution === 'string') spec.solution = JSON.parse(readFileSync(path.join(chapters, spec.solution), 'utf8'));
  test('the solution passes and the empty canvas does not', () => {
    expect(spec.id).toBe('control/condition');
    const r = runCheck(spec, spec.solution!, parts);
    expect(r.problems, r.headline).toEqual([]);
    expect(r.violations).toEqual([]);
    expect(r.pass).toBe(true);
    expect(runCheck(spec, startCircuit(spec), parts).pass).toBe(false);
  });
});

describe('the bug and parsons exercises', () => {
  test('the bug block points at a line, and the buggy POP really is wrong', () => {
    const b = blocks('bug')[0] as { lines: string[]; wrong: number };
    expect(b.wrong).toBeGreaterThanOrEqual(0);
    expect(b.wrong).toBeLessThan(b.lines.length);
    // The course's POP: MAR ← SP first, then Rd ← M[MAR] and SP ← SP + 1.
    const pop = ROUTINES.find((r) => r.name === 'POP')!;
    expect(pop.steps.map((s) => s.text)).toEqual(['MAR ← SP', 'Rd ← M[MAR]; SP ← SP + 1']);
  });
  test('the parsons block lists the steps of CALL in the order the microprogram has', () => {
    const p = blocks('parsons')[0] as { lines: string[]; distractors: string[] };
    const call = ROUTINES.find((r) => r.name === 'CALL')!;
    expect(p.lines).toEqual(call.steps.map((s) => s.text));
    for (const d of p.distractors) expect(call.steps.map((s) => s.text)).not.toContain(d);
  });
});

describe('the numbers the chapter quotes', () => {
  test('57 micro-instructions: 2 fetch, 1 decode, 54 for 22 routines, and ADD at 0x1D', () => {
    const total = ROUTINES.reduce((n, r) => n + r.steps.length, 0);
    expect(total).toBe(57);
    expect(ROUTINES.filter((r) => r.name !== 'FETCH' && r.name !== 'DECODE')).toHaveLength(22);
    expect(ROUTINES.filter((r) => r.name !== 'FETCH' && r.name !== 'DECODE').reduce((n, r) => n + r.steps.length, 0)).toBe(54);
    expect(ROUTINES.find((r) => r.name === 'ADD')!.start).toBe(0x1d);
    expect(ROUTINES.find((r) => r.name === 'LDI')!.start).toBe(5);
  });
});
