import { describe, expect, test, vi } from 'vitest';
import { randomComb, runFabric, setInput, truthOf, type Bench } from './testutil';
import { runFlow, type FlowResult } from './flow';

// Whole-flow tests are heavy when other test files run at the same time.
vi.setConfig({ testTimeout: 180_000 });

/** Every output of the configured fabric for every input vector (exhaustive). */
function fabricTruth(res: FlowResult, bench: Bench): number[][] {
  const run = runFabric(res, bench);
  const rows: number[][] = [];
  for (let v = 0; v < 1 << bench.inputs.length; v++) {
    bench.inputs.forEach((id, i) => setInput(run, id, ((v >> i) & 1) === 1));
    run.engine.advance(200e-9);
    rows.push(bench.outputs.map((o) => run.engine.logic(run.outNet.get(o)!)));
  }
  return rows;
}

describe('round trip: netlist → flow → bitstream → decode → digital engine', () => {
  const cases: [number, number, number, number][] = [];
  for (let s = 1; s <= 24; s++) cases.push([s, 3 + (s % 8), 6 + ((s * 7) % 90), 1 + (s % 5)]);
  test.each(cases)('random netlist seed %i (%i inputs, %i gates, %i outputs)', (seed, nIn, gates, nOut) => {
    const bench = randomComb(seed, nIn, gates, nOut);
    const want = truthOf(bench);
    const res = runFlow(bench.nl, { seed });
    expect(fabricTruth(res, bench)).toEqual(want);
    expect(want.flat().every((v) => v <= 1)).toBe(true);
  });
});
