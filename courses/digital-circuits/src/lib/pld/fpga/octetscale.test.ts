/**
 * Octet on vFPGA-M. The plan sizes M so that Octet uses about two thirds of it (about 770 of its 1,152 cells).
 * There is no Octet design in DCL yet (`content/designs` has the counter, the traffic light, the ALU, the register
 * file and the RV32I core), so this stands in with the scalable gate-level datapath of `designs.ts` at that size:
 * registered ALUs and carry-chain counters, the same kind of logic (adders, multiplexers, a register file's worth of
 * flip-flops) with the same kind of connectivity. When Octet exists, add it here.
 */
import { describe, expect, test, vi } from 'vitest';
import { datapath } from './designs';
import { runFlow } from './flow';
import { checkRouting } from './route';
import { stimulus, traceFabric, traceOriginal } from './testutil';

vi.setConfig({ testTimeout: 300_000 });

describe('a design of Octet’s size on vFPGA-M', () => {
  test('two thirds of M (about 740 cells) fits, routes without overuse in a few iterations, and matches cycle by cycle', () => {
    const bench = datapath(4, 12, 16, 2);
    const res = runFlow(bench.nl, { device: 'M' });
    const cells = res.netlist.lcs.length;
    const cap = res.device.counts.lcs;
    expect(cells / cap).toBeGreaterThan(0.6);
    expect(cells / cap).toBeLessThan(0.7);
    expect(res.routing.success).toBe(true);
    expect(res.routing.overused).toBe(0);
    expect(res.routing.iterations.length).toBeLessThanOrEqual(30);
    expect(checkRouting(res.packed, res.routing, res.device)).toEqual([]);
    expect(res.timing.fmaxMHz).toBeGreaterThan(1);
    // Packed densely: well under all 144 tiles (the packer used to spread such a design over the whole device).
    expect(res.packed.clusters.length).toBeLessThan(res.device.counts.logicTiles * 0.8);
    const stim = stimulus(23, 40, bench.inputs.length);
    expect(traceFabric(res, bench, stim)).toEqual(traceOriginal(bench, stim));
  });

  test('a design that takes 86 % of the cells still routes', () => {
    const bench = datapath(5, 18, 16, 2);
    const res = runFlow(bench.nl, { device: 'M' });
    expect(res.netlist.lcs.length / res.device.counts.lcs).toBeGreaterThan(0.8);
    expect(res.routing.success).toBe(true);
    expect(res.routing.iterations.length).toBeLessThanOrEqual(40);
  });
});
