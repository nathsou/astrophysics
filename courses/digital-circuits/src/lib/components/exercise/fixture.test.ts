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
import { checkHdl, type HdlInput } from './hdl/check';
import { checkFit, checkFitSource, pinsOf, type FitInput } from './fit/check';
import { blankPla } from '$lib/studio/adapters/pla';
import { artifactOf, checkDecode, deviceTruth, type DecodeInput } from './decode/model';
import { checkRoute, solutionBits, startBits, type RouteInput } from './route/model';
import { buildProblem, fromNames, score, type PlaceInput } from './place/model';

const root = path.resolve(import.meta.dirname, '../../../..');
const parse = (md: string) => [...md.matchAll(/```(build|debug|golf|measure|asm|hdl|fit|decode|route|place)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, data: YAML.parse(m[2]!) as Record<string, unknown> }));
const parts = partsResolver(false);
const fixtureBlocks = parse(readFileSync(path.join(root, 'tools/markdown/fixtures/exercises.md'), 'utf8'));
const blocks = fixtureBlocks;
const byKind = (k: string, list = fixtureBlocks) => list.filter((b) => b.kind === k).map((b) => b.data);

describe('fixture exercises', () => {
  test('all ten kinds are there', () => {
    expect(new Set(blocks.map((b) => b.kind))).toEqual(new Set(['build', 'debug', 'golf', 'measure', 'asm', 'hdl', 'fit', 'decode', 'route', 'place']));
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
  for (const data of byKind('hdl')) hdlTests(data as unknown as HdlInput);
  for (const data of byKind('fit')) fitTests(data as unknown as FitInput);
  for (const data of byKind('decode')) decodeTests(data as unknown as DecodeInput);
  for (const data of byKind('route')) routeTests(data as unknown as RouteInput);
  for (const data of byKind('place')) placeTests(data as unknown as PlaceInput);
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


/** The promises of the hardware exercises: each solution passes, each start fails (and compiles, where it is code). */
function hdlTests(input: HdlInput) {
  test(`${input.id}: the solution passes, the starting code compiles and fails`, () => {
    expect(input.solution, 'exercises need a solution').toBeDefined();
    const r = checkHdl(input, input.solution!);
    expect(r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message)).toEqual([]);
    expect(r.problems).toEqual([]);
    expect(r.tests.filter((t) => !t.passed)).toEqual([]);
    expect(r.equivalence?.rows ?? []).toEqual([]);
    expect(r.pass).toBe(true);
    if (input.reference) expect(checkHdl(input, input.reference).pass, 'the reference passes its own exercise').toBe(true);
    const start = checkHdl(input, input.start);
    expect(start.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message), 'the starting code compiles').toEqual([]);
    expect(start.problems).toEqual([]);
    expect(start.pass).toBe(false);
  });
}

function fitTests(input: FitInput) {
  test(`${input.id}: the solution fits and works, the start does not`, () => {
    expect(input.solution, 'exercises need a solution').toBeDefined();
    const r = checkFitSource(input, input.solution!);
    expect(r.errors).toEqual([]);
    expect(r.problems).toEqual([]);
    expect(r.rows, JSON.stringify(r.rows)).toEqual([]);
    expect(r.resources.filter((x) => !x.ok)).toEqual([]);
    expect(r.pass).toBe(true);
    if (input.blank && input.device === 'pla') {
      const p = pinsOf(input.spec);
      expect(checkFit(input, blankPla(p.inputs, p.outputs)).pass).toBe(false);
    }
    if (input.start) {
      // A start may be refused by the fitter (that is a failure too, and the reader reads why): it must not pass.
      expect(checkFitSource(input, input.start).pass).toBe(false);
    }
  });
}

function decodeTests(input: DecodeInput) {
  test(`${input.id}: the solution is equivalent to the device, nothing or a wrong answer is not`, () => {
    expect(input.solution, 'exercises need a solution').toBeDefined();
    const art = artifactOf(input);
    expect(art.grids.length + art.listings.length).toBeGreaterThan(0);
    const truth = deviceTruth(input);
    // A function that is constant on every output would make the exercise trivial.
    expect(new Set(truth.map((r) => r.join(''))).size).toBeGreaterThan(1);
    const r = checkDecode(input, { mode: 'expression', text: input.solution }, truth);
    expect(r.problems).toEqual([]);
    expect(r.rows, JSON.stringify(r.rows)).toEqual([]);
    expect(r.pass).toBe(true);
    expect(checkDecode(input, { mode: 'expression', text: input.outputs.map((o) => `${o} = 0`).join('\n') }, truth).pass).toBe(false);
    expect(checkDecode(input, { mode: 'expression', text: '' }, truth).pass).toBe(false);
    // The table and the module forms accept the same function.
    if ((input.answers ?? ['expression', 'table']).includes('table')) {
      const table = Object.fromEntries(input.outputs.map((o, i) => [o, truth.map((row) => row[i]!)]));
      expect(checkDecode(input, { mode: 'table', table }, truth).pass).toBe(true);
    }
  });
}

function routeTests(input: RouteInput) {
  test(`${input.id}: the solution routes every net and works, the bare cells do not`, () => {
    expect(input.solution, 'exercises need a solution').toBeDefined();
    const r = checkRoute(input, solutionBits(input));
    expect(r.problems).toEqual([]);
    expect(r.pass).toBe(true);
    expect(checkRoute(input, startBits(input)).pass).toBe(false);
  });
}

function placeTests(input: PlaceInput) {
  test(`${input.id}: the solution is legal and beats the annealer, the start does not`, () => {
    expect(input.solution, 'exercises need a solution').toBeDefined();
    const p = buildProblem(input);
    const s = score(input, p, fromNames(p, input.solution!));
    expect(s.problems).toEqual([]);
    expect(s.cost, `${s.cost} against the annealer's ${s.annealer}`).toBeLessThan(s.annealer);
    expect(s.beats).toBe(true);
    expect(score(input, p, p.start).beats).toBe(false);
  });
}

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
        // As the markdown compiler does (tools/markdown/compile.ts): a `spec.reference` that is a path is the circuit in that file.
        const ref = input.spec?.reference;
        if (typeof ref === 'string' && /\.json$/.test(ref)) input.spec!.reference = JSON.parse(readFileSync(path.join(chaptersDir, ref), 'utf8'));
        expect(input.solution, 'exercises need a solution').toBeDefined();
        const r = runCheck(input, input.solution!, parts);
        expect(r.problems).toEqual([]);
        expect(r.pass, JSON.stringify(r.comb?.failures ?? r.seq?.counterexample ?? r.scenarios?.failures ?? r.violations)).toBe(true);
        expect(runCheck(input, startCircuit(input), parts).pass).toBe(false);
      });
    }
    for (const b of list) {
      const data = b.data as unknown;
      if (b.kind === 'hdl') hdlTests(data as HdlInput);
      else if (b.kind === 'fit') fitTests(data as FitInput);
      else if (b.kind === 'decode') decodeTests(data as DecodeInput);
      else if (b.kind === 'route') routeTests(data as RouteInput);
      else if (b.kind === 'place') placeTests(data as PlaceInput);
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
