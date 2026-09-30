import { describe, expect, test, vi } from 'vitest';
import { datapath } from './designs';
import { runFlow } from './flow';
import { runFabric, setInput } from './testutil';

vi.setConfig({ testTimeout: 300_000 });

const stages = (times: Record<string, number>) => Object.entries(times).map(([k, v]) => `${k} ${v.toFixed(0)} ms`).join(', ');

/** Cycles per second of the configured fabric on the digital engine, with a few inputs changing every cycle. */
function simRate(res: ReturnType<typeof runFlow>, bench: ReturnType<typeof datapath>): number {
  const run = runFabric(res, bench);
  const t0 = performance.now();
  let cycles = 0;
  for (; performance.now() - t0 < 1500; cycles++) {
    setInput(run, bench.inputs[cycles % bench.inputs.length]!, cycles % 3 === 0);
    setInput(run, 'clk', true);
    run.engine.advance(60e-9);
    setInput(run, 'clk', false);
    run.engine.advance(60e-9);
  }
  return cycles / ((performance.now() - t0) / 1000);
}

describe('performance (measured; the loose bounds are twice the targets)', () => {
  test('about 600 LUTs on vFPGA-M', () => {
    const bench = datapath(3, 10, 16, 2);
    const t0 = performance.now();
    const res = runFlow(bench.nl, { device: 'M' });
    const total = performance.now() - t0;
    console.log(`M: ${res.netlist.lcs.length} cells (${res.map.luts.length} LUTs), total ${total.toFixed(0)} ms (${stages(res.times)}); fmax ${res.timing.fmaxMHz.toFixed(1)} MHz; fabric simulation ${simRate(res, bench).toFixed(0)} cycles/s`);
    expect(res.map.luts.length).toBeGreaterThan(500);
    expect(total).toBeLessThan(20_000);
  });

  test('about 4,000 LUTs on vFPGA-L', () => {
    const bench = datapath(28, 48, 16, 2);
    const t0 = performance.now();
    const res = runFlow(bench.nl, { device: 'L' });
    const total = performance.now() - t0;
    console.log(`L: ${res.netlist.lcs.length} cells (${res.map.luts.length} LUTs), total ${total.toFixed(0)} ms (${stages(res.times)}); fmax ${res.timing.fmaxMHz.toFixed(1)} MHz; fabric simulation ${simRate(res, bench).toFixed(0)} cycles/s`);
    expect(res.map.luts.length).toBeGreaterThan(3800);
    expect(res.routing.success).toBe(true);
    expect(total).toBeLessThan(60_000);
  });
});
