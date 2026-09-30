import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import type { Circuit } from '$lib/sim/netlist/types';
import { makeRig, sendPulse, stages, summary } from './pulse';

const circuit = JSON.parse(readFileSync(fileURLToPath(new URL('../circuits/pulse-chain.json', import.meta.url)), 'utf8')) as Circuit;

function run(model: 'inertial' | 'transport', width: number) {
  const rig = makeRig(circuit, model);
  const rec = rig.engine.watch(rig.traces.map((t) => t.net));
  sendPulse(rig.engine, width);
  return stages(rec.times(), rec.values());
}

describe('a pulse through buffers of 1, 2, 3 and 4 ns', () => {
  test('inertial: a pulse travels until it meets a buffer slower than it is long', () => {
    expect(run('inertial', 0.5).map((s) => s.passed)).toEqual([false, false, false, false]);
    expect(run('inertial', 1.5).map((s) => s.passed)).toEqual([true, false, false, false]);
    expect(run('inertial', 2.5).map((s) => s.passed)).toEqual([true, true, false, false]);
    expect(run('inertial', 3.5).map((s) => s.passed)).toEqual([true, true, true, false]);
    expect(run('inertial', 5).map((s) => s.passed)).toEqual([true, true, true, true]);
  });
  test('inertial: a pulse that gets through keeps its width', () => {
    for (const s of run('inertial', 4.5)) expect(s.width).toBeCloseTo(4.5, 3);
  });
  test('transport: every pulse gets through every buffer', () => {
    for (const w of [0.5, 1.5, 2.5, 3.5]) {
      const list = run('transport', w);
      expect(list.map((s) => s.passed)).toEqual([true, true, true, true]);
      for (const s of list) expect(s.width).toBeCloseTo(w, 3);
    }
  });
  test('a pulse exactly as long as the delay gets through', () => {
    expect(run('inertial', 1).map((s) => s.passed)).toEqual([true, false, false, false]);
  });
  test('the sentences', () => {
    expect(summary(run('inertial', 2.5), 2.5)).toMatch(/first 2 buffers and is swallowed by B3, whose delay is 3 ns/);
    expect(summary(run('inertial', 0.5), 0.5)).toMatch(/swallowed by the first buffer/);
    expect(summary(run('transport', 0.5), 0.5)).toMatch(/all four buffers, still 0.5 ns wide/);
  });
});
