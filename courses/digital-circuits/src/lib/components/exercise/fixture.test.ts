/**
 * The examples in tools/markdown/fixtures/exercises.md are real: each `solution` passes its checker, each debug
 * `start` fails it, asm solutions pass their tests and their starting code does not, measure answers come out right.
 */
import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { partsResolver } from '$lib/partsbin/store-core';
import { runCheck, startCircuit, type BuildInput } from './circuit/spec';
import { checkAsm, type AsmInput } from './asm/run';
import { expectedValue, type MeasureInput } from './measure/probe';
import { checkMeasurement } from '$lib/sim/check';

const root = path.resolve(import.meta.dirname, '../../../..');
const parse = (md: string) => [...md.matchAll(/```(build|debug|golf|measure|asm)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, data: YAML.parse(m[2]!) as Record<string, unknown> }));
const parts = partsResolver(false);
const fixtureBlocks = parse(readFileSync(path.join(root, 'tools/markdown/fixtures/exercises.md'), 'utf8'));
const blocks = fixtureBlocks;
const byKind = (k: string, list = fixtureBlocks) => list.filter((b) => b.kind === k).map((b) => b.data);

describe('fixture exercises', () => {
  test('all five kinds are there', () => {
    expect(new Set(blocks.map((b) => b.kind))).toEqual(new Set(['build', 'debug', 'golf', 'measure', 'asm']));
  });
  for (const kind of ['build', 'debug', 'golf']) {
    for (const data of byKind(kind)) {
      const input = data as unknown as BuildInput;
      test(`${input.id}: the starting circuit ${kind === 'debug' || !input.solution ? 'is checked' : 'fails'}, the solution passes`, () => {
        const start = runCheck(input, startCircuit(input), parts);
        if (input.solution) {
          const r = runCheck(input, input.solution, parts);
          expect(r.problems).toEqual([]);
          expect(r.pass, JSON.stringify(r.comb?.failures ?? r.seq?.counterexample ?? r.scenarios?.failures ?? r.violations)).toBe(true);
          expect(start.pass).toBe(false);
        } else expect(start.pass).toBe(false);
      });
    }
  }
  for (const data of byKind('measure')) {
    const input = data as unknown as MeasureInput;
    test(`${input.id}: the expected value is what the reader should type`, () => {
      const want = expectedValue(input, input.circuit);
      expect(want).not.toBeNaN();
      const shown = input.unit === 'V' ? `${want} V` : `${want * 1000} mA`;
      expect(checkMeasurement(shown, want, input.tolerance ?? 0.05).pass).toBe(true);
      if (input.probe?.voltage) expect(want).toBeCloseTo(8, 1);
      if (input.answer) expect(want).toBeCloseTo(0.002, 6);
    });
  }
  for (const data of byKind('asm')) {
    const input = data as unknown as AsmInput;
    test(`${input.id}: the solution passes, the starting code does not`, () => {
      const r = checkAsm(input, input.solution!);
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(r.results.flatMap((x) => x.failures)).toEqual([]);
      expect(r.pass).toBe(true);
      expect(checkAsm(input, input.start!).pass).toBe(false);
    });
  }
});

/** The same promises for the exercises of every real chapter, so a broken exercise fails the tests, not the reader. */
const chaptersDir = path.join(root, 'content/chapters');
const chapters = existsSync(chaptersDir) ? readdirSync(chaptersDir).filter((d) => existsSync(path.join(chaptersDir, d, 'index.md'))) : [];
for (const ch of chapters) {
  const list = parse(readFileSync(path.join(chaptersDir, ch, 'index.md'), 'utf8'));
  if (!list.length) continue;
  describe(`chapter ${ch}: exercises`, () => {
    for (const data of list.filter((b) => ['build', 'debug', 'golf'].includes(b.kind)).map((b) => b.data)) {
      const input = data as unknown as BuildInput;
      test(`${input.id}: solution passes${input.start ? ', start fails' : ''}`, () => {
        for (const f of ['start', 'solution'] as const) if (typeof input[f] === 'string') input[f] = JSON.parse(readFileSync(path.join(chaptersDir, input[f] as string), 'utf8'));
        expect(input.solution, 'exercises need a solution').toBeDefined();
        const r = runCheck(input, input.solution!, parts);
        expect(r.problems).toEqual([]);
        expect(r.pass, JSON.stringify(r.comb?.failures ?? r.seq?.counterexample ?? r.scenarios?.failures ?? r.violations)).toBe(true);
        expect(runCheck(input, startCircuit(input), parts).pass).toBe(false);
      });
    }
    for (const data of list.filter((b) => b.kind === 'asm').map((b) => b.data)) {
      const input = data as unknown as AsmInput;
      test(`${input.id}: the solution passes its tests`, () => {
        const r = checkAsm(input, input.solution!);
        expect(r.results.flatMap((x) => x.failures)).toEqual([]);
        expect(r.pass).toBe(true);
      });
    }
    for (const data of list.filter((b) => b.kind === 'measure').map((b) => b.data)) {
      const input = data as unknown as MeasureInput;
      test(`${input.id}: the expected value can be computed`, () => {
        if (typeof input.circuit === 'string') input.circuit = JSON.parse(readFileSync(path.join(chaptersDir, input.circuit), 'utf8'));
        if (typeof input.src === 'string' && !input.circuit) input.circuit = JSON.parse(readFileSync(path.join(chaptersDir, input.src), 'utf8'));
        expect(expectedValue(input, input.circuit)).not.toBeNaN();
      });
    }
  });
}
