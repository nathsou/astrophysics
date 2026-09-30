import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { runCheck, startCircuit, type BuildInput } from '$lib/components/exercise/circuit/spec';
import { checkMeasurement } from '$lib/sim/check';
import type { Circuit } from '$lib/sim/netlist/types';
import { DRAM, swing, refreshInterval, refreshOverhead, TRFC_NS } from './widgets/dram';
import { expectedValue, type MeasureInput } from '$lib/components/exercise/measure/probe';

/**
 * The exercises of Chapter 20: the build and debug blocks are solvable and their starting circuits fail, and the
 * numbers that the measure blocks ask for are the ones the DRAM model computes.
 */
const here = fileURLToPath(new URL('./', import.meta.url));
const chapters = path.resolve(here, '..');
const md = readFileSync(path.join(here, 'index.md'), 'utf8');
const load = (p: string): Circuit => JSON.parse(readFileSync(path.join(chapters, p), 'utf8')) as Circuit;
const circuitBlocks = [...md.matchAll(/```(build|debug)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as BuildInput }));
const measures = [...md.matchAll(/```measure\n([\s\S]*?)```/g)].map((m) => YAML.parse(m[1]!) as MeasureInput);
for (const b of circuitBlocks) {
  if (typeof b.spec.solution === 'string') b.spec.solution = load(b.spec.solution);
  if (typeof b.spec.start === 'string') b.spec.start = load(b.spec.start);
}

describe('build and debug blocks', () => {
  test('a build and a debug exercise on the write decoder', () => {
    expect(circuitBlocks.map((b) => [b.kind, b.spec.id])).toEqual([['build', 'memory/write-decoder'], ['debug', 'memory/two-lines']]);
  });
  for (const b of circuitBlocks) {
    test(`${b.spec.id}: the solution passes within the rules, the starting circuit fails`, () => {
      const r = runCheck(b.spec, b.spec.solution!);
      expect(r.problems, r.headline).toEqual([]);
      expect(r.violations).toEqual([]);
      expect(r.pass).toBe(true);
      expect(runCheck(b.spec, startCircuit(b.spec)).pass).toBe(false);
    });
  }
  test('the slip is exactly the one the fault text says: W3 has no A0 input', () => {
    const d = circuitBlocks.find((b) => b.kind === 'debug')!;
    const start = d.spec.start as Circuit;
    const r = runCheck(d.spec, start);
    expect(r.comb!.pass).toBe(false);
    // The start circuit differs from the solution in one gate: a 2-input AND where the solution has 3.
    const sol = d.spec.solution as Circuit;
    const inputsOf = (c: Circuit) => c.components.filter((x) => x.type === 'and').map((x) => Number(x.params?.inputs ?? 2)).sort();
    expect(inputsOf(sol)).toEqual([3, 3, 3, 3]);
    expect(inputsOf(start)).toEqual([2, 3, 3, 3]);
  });
  test('the decoder has six gates, as the explanation says', () => {
    const b = circuitBlocks.find((x) => x.kind === 'build')!;
    expect(runCheck(b.spec, b.spec.solution!).cost?.gates).toBe(6);
  });
});

describe('measure blocks', () => {
  test('bit line swing: 66.7 mV, from the model', () => {
    const m = measures.find((x) => x.id === 'memory/bitline-swing')!;
    const want = swing(DRAM.vdd);
    expect(want * 1000).toBeCloseTo(66.667, 2);
    const expected = expectedValue(m);
    expect(expected).toBeCloseTo(want, 4);
    // The reader types millivolts with a prefix, or volts as a decimal.
    for (const ok of ['66.7 mV', '67 mV', '66.7 m', '0.0667']) expect(checkMeasurement(ok, expected, m.tolerance).pass, ok).toBe(true);
    for (const bad of ['67', '0.6', '33 mV', '133 mV']) expect(checkMeasurement(bad, expected, m.tolerance).pass, bad).toBe(false);
  });
  test('refresh cost: 4.48 %, from the model', () => {
    const m = measures.find((x) => x.id === 'memory/refresh-cost')!;
    const want = refreshOverhead(TRFC_NS[8]! * 1e-9) * 100;
    expect(want).toBeCloseTo(4.48, 2);
    expect(expectedValue(m)).toBeCloseTo(want / 100, 4);
    for (const ok of ['0.0448', '0.045', '0.0435']) expect(checkMeasurement(ok, expectedValue(m), m.tolerance).pass, ok).toBe(true);
    expect(checkMeasurement('4.48', expectedValue(m), m.tolerance).pass).toBe(false);
    expect(refreshInterval() * 1e6).toBeCloseTo(7.8125, 3);
  });
  test('the prompts quote the numbers of the model', () => {
    const swingQ = measures.find((x) => x.id === 'memory/bitline-swing')!.question!;
    expect(swingQ).toContain('20 fF');
    expect(swingQ).toContain('160 fF');
    expect(DRAM.cs).toBe(20e-15);
    expect(DRAM.cbl).toBe(160e-15);
  });
});
