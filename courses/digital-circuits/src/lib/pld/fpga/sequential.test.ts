import { describe, expect, test, vi } from 'vitest';
import { adder, counter, datapath, lfsr, sequenceDetector } from './designs';
import { runFlow } from './flow';
import { runFabric, setInput, stimulus, traceFabric, traceOriginal, truthOf } from './testutil';

// Whole-flow tests are heavy when other test files run at the same time.
vi.setConfig({ testTimeout: 180_000 });

describe('sequential designs match cycle by cycle', () => {
  test('8-bit counter with enable and clear', () => {
    const bench = counter(8);
    const res = runFlow(bench.nl);
    const stim = stimulus(3, 120, 2, [0.85, 0.03]);
    // The counter must actually count.
    const want = traceOriginal(bench, stim);
    expect(new Set(want.map((r) => r.join(''))).size).toBeGreaterThan(20);
    expect(traceFabric(res, bench, stim)).toEqual(want);
    expect(res.report.utilisation.flipFlops).toBe(8);
  });

  test('sequence detector FSM', () => {
    const bench = sequenceDetector();
    const res = runFlow(bench.nl, { device: 'S' });
    const stim = stimulus(5, 200, 2, [0.5, 0.05]);
    const want = traceOriginal(bench, stim);
    expect(want.some((r) => r[0] === 1)).toBe(true);
    expect(traceFabric(res, bench, stim)).toEqual(want);
  });

  test('LFSR with load', () => {
    const bench = lfsr(10, 0b1001000000);
    const res = runFlow(bench.nl);
    const stim = stimulus(7, 150, 1, [0.02]);
    const want = traceOriginal(bench, stim);
    expect(traceFabric(res, bench, stim)).toEqual(want);
  });

  test('datapath with registers and adders on carry chains', () => {
    const bench = datapath(2, 2, 8, 3);
    const res = runFlow(bench.nl, { device: 'M' });
    expect(res.carry.chains.length).toBeGreaterThan(0);
    const stim = stimulus(11, 60, bench.inputs.length);
    expect(traceFabric(res, bench, stim)).toEqual(traceOriginal(bench, stim));
  });
});

describe('carry chains', () => {
  for (const kind of ['block', 'gates'] as const) {
    test(`${kind} adder: exhaustive equivalence and one cell per bit`, () => {
      const bench = adder(5, kind);
      const res = runFlow(bench.nl);
      expect(res.carry.chains.length).toBe(1);
      expect(res.carry.chains[0]!.stages.length).toBe(5);
      const want = truthOf({ ...bench });
      const run = runFabric(res, bench);
      const got: number[][] = [];
      for (let v = 0; v < 1 << bench.inputs.length; v++) {
        bench.inputs.forEach((id, i) => setInput(run, id, ((v >> i) & 1) === 1));
        run.engine.advance(300e-9);
        got.push(bench.outputs.map((o) => run.engine.logic(run.outNet.get(o)!)));
      }
      expect(got).toEqual(want);
      // 5 stages, a cell injecting the carry-in and a read-out cell for the carry-out; no LUT logic besides.
      expect(res.netlist.lcs.length).toBeLessThanOrEqual(7);
    });
  }

  test('constant carry-in and no carry-out: exactly one cell per bit', () => {
    const bench = adder(6, 'gates', false, false);
    const res = runFlow(bench.nl);
    expect(res.carry.chains.length).toBe(1);
    expect(res.netlist.lcs.length).toBe(6);
    expect(res.netlist.chains[0]!.length).toBe(6);
    const want = truthOf(bench);
    const run = runFabric(res, bench);
    for (let v = 0; v < 1 << bench.inputs.length; v += 7) {
      bench.inputs.forEach((id, i) => setInput(run, id, ((v >> i) & 1) === 1));
      run.engine.advance(300e-9);
      expect(bench.outputs.map((o) => run.engine.logic(run.outNet.get(o)!))).toEqual(want[v]);
    }
  });
});
