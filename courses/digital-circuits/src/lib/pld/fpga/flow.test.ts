import { describe, expect, test, vi } from 'vitest';
import { createDigitalEngine, NetlistBuilder } from '../../sim/digital';
import { getVFpga } from '../devices/vfpga';
import { parseBitstream } from '../devices/vfpga-config';
import { adder, counter, datapath, ramDesign, romDesign, sequenceDetector } from './designs';
import { FlowError } from './design';
import { runFlow } from './flow';
import type { LcNetlist } from './lcnet';
import { pack } from './pack';
import { checkPlacement, place } from './place';
import { formatReport } from './report';
import { checkRouting, route } from './route';
import { analyse, buildTimingGraph } from './sta';
import { probeCell, probeNode } from './crossprobe';
import { randomComb, runFabric, setInput, stimulus, traceFabric, traceOriginal, truthOf } from './testutil';

// Whole-flow tests are heavy when other test files run at the same time.
vi.setConfig({ testTimeout: 180_000 });

describe('legality of every stage', () => {
  const bench = datapath(2, 2, 8, 2);
  const res = runFlow(bench.nl, { device: 'M', seed: 4 });

  test('placement: right sites, one block per site, carry macros contiguous', () => {
    expect(checkPlacement(res.packed, res.device, res.placement)).toEqual([]);
  });

  test('routing: no overused node, every sink reached through legal multiplexer inputs', () => {
    expect(res.routing.success).toBe(true);
    expect(checkRouting(res.packed, res.routing, res.device)).toEqual([]);
    const used = new Map<number, number>();
    for (const t of res.routing.nets) for (const n of t.nodes) used.set(n, (used.get(n) ?? 0) + 1);
    expect([...used.values()].every((c) => c === 1)).toBe(true);
    // Every net with sinks is routed.
    expect(res.routing.nets.filter((t) => t.nodes.length > 0).length).toBe(res.packed.nets.length);
  });

  test('every cell sits in exactly one slot; chains are consecutive cells of one column', () => {
    const seen = new Set<string>();
    res.netlist.lcs.forEach((_, i) => {
      const at = res.bitgen.cellAt[i]!;
      const key = `${at.x},${at.y},${at.k}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    });
    expect(res.netlist.chains.length).toBeGreaterThan(0);
    for (const chain of res.netlist.chains) {
      const pos = chain.map((c) => res.bitgen.cellAt[c]!);
      pos.forEach((p, i) => {
        expect(p.x).toBe(pos[0]!.x);
        expect(p.y * 8 + p.k).toBe(pos[0]!.y * 8 + pos[0]!.k + i);
      });
    }
  });

  test('a flip-flop tile has one clock, and cells sharing its enable and reset agree', () => {
    for (const c of res.packed.clusters) {
      const clks = new Set<number>();
      const ces = new Set<number>();
      for (const s of c.slots) {
        const ff = s >= 0 ? res.netlist.lcs[s]!.ff : undefined;
        if (!ff) continue;
        clks.add(ff.clk);
        if (ff.ce >= 0) ces.add(ff.ce);
      }
      expect(clks.size).toBeLessThanOrEqual(1);
      expect(ces.size).toBeLessThanOrEqual(1);
    }
  });

  test('the bitstream file parses back to the generated bits and configures the same fabric', () => {
    const bits = parseBitstream(res.bitstream, res.device);
    expect(Array.from(bits)).toEqual(Array.from(res.bitgen.bits));
  });
});

describe('packing', () => {
  test('tiles are filled as far as clocks, enables and resets allow: a design does not spread over the device', () => {
    const res = runFlow(datapath(3, 6, 16, 2).nl, { device: 'M' });
    const p = res.packed;
    const filled = p.clusters.reduce((n, c) => n + c.slots.filter((s) => s >= 0).length, 0);
    expect(filled).toBe(p.netlist.lcs.length);
    // Full tiles but for a handful with unusual control sets: within a few tiles of the minimum.
    expect(p.clusters.length).toBeLessThanOrEqual(Math.ceil(p.netlist.lcs.length / 8) + 6);
    expect(p.clusters.length).toBeLessThan(res.device.counts.logicTiles * 0.6);
  });
});

describe('placement', () => {
  const bench = randomComb(11, 8, 80, 4);
  const first = runFlow(bench.nl, { seed: 3, device: 'M' });

  test('is deterministic for a seed, and differs between seeds', () => {
    const again = runFlow(bench.nl, { seed: 3, device: 'M' });
    expect(Array.from(again.placement.unitX)).toEqual(Array.from(first.placement.unitX));
    expect(Array.from(again.placement.unitY)).toEqual(Array.from(first.placement.unitY));
    expect(Array.from(again.bitgen.bits)).toEqual(Array.from(first.bitgen.bits));
    expect(again.placement.trace.steps.map((s) => s.cost)).toEqual(first.placement.trace.steps.map((s) => s.cost));
    const other = runFlow(bench.nl, { seed: 99, device: 'M' });
    expect(Array.from(other.placement.unitX)).not.toEqual(Array.from(first.placement.unitX));
  });

  test('annealing reduces the wirelength; the trace records the schedule', () => {
    const t = first.placement.trace;
    expect(first.placement.bb).toBeLessThan(t.initial.bb * 0.8);
    expect(t.steps.length).toBeGreaterThan(10);
    for (let i = 1; i < t.steps.length - 1; i++) expect(t.steps[i]!.temp).toBeLessThan(t.steps[i - 1]!.temp);
    expect(t.steps[t.steps.length - 1]!.temp).toBe(0);
    expect(t.steps[0]!.acceptRate).toBeGreaterThan(0.5);
    expect(t.steps[t.steps.length - 2]!.acceptRate).toBeLessThan(0.35);
    expect(t.steps.every((s) => s.rlim >= 1)).toBe(true);
    expect(t.snapshots.length).toBeGreaterThanOrEqual(3);
    expect(t.snapshots[0]!.x.length).toBe(first.packed.units.length);
    expect(t.snapshots[t.snapshots.length - 1]!.bb).toBeLessThan(t.snapshots[0]!.bb);
  });

  test('pin constraints are honoured, and clocks sit on their global pads', () => {
    const c = counter(4);
    const res = runFlow(c.nl, { device: 'S', pins: { en: 'P9', led0: 'P12' } });
    const padOf = (name: string) => res.device.pads[res.placement.unitPad[res.packed.portUnit[res.netlist.ports.findIndex((p) => p.name === name)]!]!]!.name;
    expect(padOf('en')).toBe('P9');
    expect(padOf('led0')).toBe('P12');
    expect(padOf('clk')).toBe(res.device.pads[res.device.gbPads[0]!]!.name);
    expect(() => runFlow(c.nl, { device: 'S', pins: { en: 'P99' } })).toThrow(/no such pad/);
  });
});

describe('placement with the congestion term', () => {
  const res = runFlow(datapath(3, 6, 16, 2).nl, { device: 'M', seed: 5 });
  /** Wire demand (q-corrected half-perimeter) of the busiest 3 × 3 bin relative to the average bin. */
  const peak = (pl: typeof res.placement) => {
    const dev = res.device;
    const nbx = Math.ceil(dev.width / 3);
    const nby = Math.ceil(dev.height / 3);
    const bins = new Float64Array(nbx * nby);
    let total = 0;
    for (const net of res.packed.nets) {
      const units = [...new Set([net.driverUnit, ...net.sinks.map((k) => k.unit)])];
      if (units.length < 2 || units.length > 64) continue;
      const xs = units.map((u) => pl.unitX[u]!);
      const ys = units.map((u) => pl.unitY[u]!);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const dem = x1 - x0 + (y1 - y0);
      total += dem;
      const [bx0, bx1, by0, by1] = [Math.floor(x0 / 3), Math.floor(x1 / 3), Math.floor(y0 / 3), Math.floor(y1 / 3)];
      const share = dem / ((bx1 - bx0 + 1) * (by1 - by0 + 1));
      for (let a = bx0; a <= bx1; a++) for (let b = by0; b <= by1; b++) bins[a * nby + b]! += share;
    }
    return Math.max(...bins) / (total / bins.length);
  };

  test('is legal, deterministic, and spreads the demand out at some cost in wirelength', () => {
    const flat = place(res.packed, res.device, { seed: 5, spread: 0 });
    const spread = place(res.packed, res.device, { seed: 5, spread: 4, spreadAt: 1 });
    const again = place(res.packed, res.device, { seed: 5, spread: 4, spreadAt: 1 });
    expect(checkPlacement(res.packed, res.device, spread)).toEqual([]);
    expect(Array.from(again.unitX)).toEqual(Array.from(spread.unitX));
    expect(Array.from(again.unitY)).toEqual(Array.from(spread.unitY));
    expect(peak(spread)).toBeLessThan(peak(flat));
    expect(spread.bb).toBeGreaterThanOrEqual(flat.bb * 0.95);
  });
});

describe('router options', () => {
  test('the present-congestion factor stops growing at its cap, and the box margin is a parameter', () => {
    const res = runFlow(datapath(3, 6, 16, 2).nl, { device: 'M', seed: 5 });
    const capped = route(res.packed, res.placement, res.device, { maxPresFac: 2, maxIterations: 6, graph: res.routing.graph });
    expect(capped.iterations.length).toBeGreaterThan(3);
    expect(Math.max(...capped.iterations.map((i) => i.presFac))).toBeLessThanOrEqual(2);
    // A box margin of zero must not stall the search (the box doubles when a path is not found): it terminates, and a
    // routing it reports as successful is legal.
    const tight = route(res.packed, res.placement, res.device, { bboxMargin: 0, marginGrowth: 0, maxIterations: 8 });
    expect(tight.iterations.length).toBeGreaterThan(0);
    if (tight.success) expect(checkRouting(res.packed, tight, res.device)).toEqual([]);
  });
});

describe('routing trace', () => {
  test('iterations record the overuse, which reaches zero', () => {
    const res = runFlow(datapath(3, 3, 16, 2).nl, { device: 'M' });
    const it = res.routing.iterations;
    expect(it[0]!.overused).toBeGreaterThan(0);
    expect(it[it.length - 1]!.overused).toBe(0);
    expect(it[0]!.rerouted).toBe(res.packed.nets.length);
    expect(res.routing.overusedNodes.length).toBeGreaterThan(0);
    expect(it.every((x) => x.presFac > 0)).toBe(true);
  });
});

describe('static timing analysis', () => {
  const dev = getVFpga('S');
  /** PI → n cells in a row → PO, hand built: delays are easy to add up. */
  function chain(registeredAt = -1): LcNetlist {
    const n = 4;
    const nl: LcNetlist = { nets: [], lcs: [], chains: [], ports: [], rams: [], sources: [], warnings: [] };
    nl.nets.push({ id: 0, name: 'a', node: -1, driver: { kind: 'port', port: 0 } });
    nl.ports.push({ name: 'a', dir: 'in', clock: registeredAt >= 0, net: 0, src: 0 });
    for (let i = 0; i < n; i++) {
      nl.nets.push({ id: i + 1, name: `n${i + 1}`, node: -1, driver: { kind: 'lc', lc: i } });
      nl.lcs.push({
        id: i, kind: 'lut', inputs: [i], fixedPins: false, tt: 0xaaaa, out: i + 1, i3Carry: false, carryChain: false, carryConst: 0, chain: -1, chainPos: -1, origins: [], label: `c${i}`,
        ff: i === registeredAt ? { clk: 0, ce: -1, sr: -1, srAsync: false, srVal: 0, init: 0 } : undefined,
      });
    }
    nl.ports.push({ name: 'y', dir: 'out', clock: false, net: n, src: 0 });
    return nl;
  }

  test('combinational chain: arrival times add up cell and connection delays', () => {
    const nl = chain();
    const p = pack(nl, dev);
    const tg = buildTimingGraph(p);
    expect(tg.cyclic).toBe(false);
    const r = analyse(tg, new Float64Array(tg.connections.length).fill(1));
    // pad in 0.5 + 5 connections × 1 + 4 LUTs × 0.5 + pad out 0.8
    expect(r.period).toBeCloseTo(0.5 + 5 + 2 + 0.8, 9);
    expect(r.fmaxMHz).toBeCloseTo(1000 / 8.3, 6);
    expect(r.path.map((s) => s.kind)).toEqual(['launch', 'net', 'cell', 'net', 'cell', 'net', 'cell', 'net', 'cell', 'net', 'capture']);
    expect(r.path[r.path.length - 1]!.arrival).toBeCloseTo(r.period, 9);
    // Every connection is on the one path: zero slack, full criticality.
    for (let c = 0; c < tg.connections.length; c++) {
      expect(r.slack[c]).toBeCloseTo(0, 9);
      expect(r.crit[c]).toBeCloseTo(1, 9);
    }
  });

  test('a flip-flop splits the path: set-up at D, clock-to-Q at Q', () => {
    const nl = chain(1);
    const p = pack(nl, dev);
    const tg = buildTimingGraph(p);
    const delays = new Float64Array(tg.connections.length).fill(1);
    const r = analyse(tg, delays);
    // Paths: pad → c0 → c1 (D): 0.5 + 1 + 0.5 + 1 + 0.5 + 0.2; c1.Q → c2 → c3 → pad: 0.3 + 1 + 0.5 + 1 + 0.5 + 1 + 0.8.
    const first = 0.5 + 1 + 0.5 + 1 + 0.5 + 0.2;
    const second = 0.3 + 1 + 0.5 + 1 + 0.5 + 1 + 0.8;
    expect(r.period).toBeCloseTo(Math.max(first, second), 9);
    expect(r.endpoint).toBe('y');
    // The shorter path has slack.
    const slacks = Array.from(r.slack).map((s) => +s.toFixed(6));
    expect(slacks.some((s) => s > 0)).toBe(true);
  });

  test('routed delays equal the fabric simulator’s: the slowest input-to-output delay measured in simulation is the STA period', () => {
    // A parity tree: every input can flip the output, so every path is sensitised.
    const b = new NetlistBuilder();
    const ins: number[] = [];
    for (let i = 0; i < 7; i++) {
      const n = b.net();
      b.add('toggle', `i${i}`, { Y: n });
      ins.push(n);
    }
    let acc = ins[0]!;
    ins.slice(1).forEach((n, i) => {
      const y = b.net();
      b.add('xor', `x${i}`, { A: acc, B: n, Y: y });
      acc = y;
    });
    b.add('indicator', 'y', { A: acc });
    const bench = { nl: b.build(), inputs: ins.map((_, i) => `i${i}`), outputs: ['y'] };
    const res = runFlow(bench.nl, { device: 'S' });
    const run = runFabric(res, bench);
    const out = run.outNet.get('y')!;
    const rec = run.engine.watch([out]);
    bench.inputs.forEach((id) => setInput(run, id, false));
    run.engine.advance(200e-9);
    let slowest = 0;
    for (const id of bench.inputs) {
      const t0 = run.engine.time;
      const before = rec.times().length;
      setInput(run, id, true);
      run.engine.advance(200e-9);
      const times = rec.times();
      // The output changes exactly once; its delay is the path delay of this input.
      expect(times.length).toBe(before + 1);
      slowest = Math.max(slowest, (times[times.length - 1]! - t0) * 1e9);
      setInput(run, id, false);
      run.engine.advance(200e-9);
    }
    expect(slowest).toBeCloseTo(res.timing.period, 2);
  });
});

describe('cross-probing', () => {
  const bench = counter(6);
  const res = runFlow(bench.nl, { device: 'S' });

  test('every cell knows the source elements it implements, with hierarchical paths', () => {
    expect(res.probe.cells.length).toBe(res.netlist.lcs.length);
    for (const c of res.probe.cells) {
      expect(c.sourceIds.length).toBeGreaterThan(0);
      expect(probeCell(res.probe, c.x, c.y, c.k)).toBe(c);
    }
    // The XOR and AND gates of bit 3 ended up in some cell.
    const where = res.probe.bySource['x3']!;
    expect(where.cells.length).toBeGreaterThan(0);
    // The flip-flop's cell lists the flip-flop.
    expect(res.probe.bySource['ff3']!.cells.length).toBe(1);
  });

  test('every routing node used maps to its net, whose sources are known', () => {
    for (const net of res.probe.nets) {
      expect(net.nodes.length).toBeGreaterThan(1);
      for (const n of net.nodes) expect(probeNode(res.probe, n)).toBe(net);
    }
    const q = res.probe.nets.find((n) => n.name === 'ff2')!;
    expect(q.sourceIds).toContain('ff2');
    expect(probeNode(res.probe, res.device.lcOut(1, 1, 7))?.name ?? 'unused').toBeTypeOf('string');
  });

  test('pads record the ports they carry', () => {
    expect(res.probe.bySource['clk']!.pads[0]).toMatch(/^P\d+ \(clk\) bit \d+/);
    expect(res.probe.bySource['led0']!.pads.length).toBe(1);
  });
});

describe('report', () => {
  test('utilisation, timing, stages', () => {
    const res = runFlow(counter(8).nl);
    const r = res.report;
    expect(r.device).toBe('vFPGA-S');
    expect(r.utilisation.flipFlops).toBe(8);
    expect(r.utilisation.cells.used).toBe(res.netlist.lcs.length);
    expect(r.utilisation.globalClocks.used).toBe(1);
    expect(r.utilisation.pads.used).toBe(res.netlist.ports.length);
    expect(r.timing.fmaxMHz).toBeGreaterThan(20);
    expect(r.timing.path[0]!.kind).toBe('launch');
    expect(r.timing.path.find((s) => s.kind === 'net')!.route!.length).toBeGreaterThan(1);
    expect(r.stages.map((s) => s.name)).toEqual(expect.arrayContaining(['synthesis', 'lut mapping', 'packing', 'placement', 'routing', 'timing analysis', 'bitstream']));
    expect(formatReport(r)).toMatch(/fmax .* MHz/);
    expect(r.sizes.lutDepth).toBeGreaterThan(0);
  });
});

describe('block RAM', () => {
  test('a RAM is mapped to a block RAM and behaves as the parts-bin RAM', () => {
    const bench = ramDesign(5, 8);
    const res = runFlow(bench.nl, { device: 'M', seed: 2 });
    expect(res.netlist.rams.length).toBe(1);
    expect(res.report.utilisation.blockRams.used).toBe(1);
    // Mostly writes at first, then reads.
    const stim = stimulus(21, 200, bench.inputs.length, [...Array(5).fill(0.5), ...Array(8).fill(0.5), 0.6]);
    expect(traceFabric(res, bench, stim)).toEqual(traceOriginal(bench, stim));
  });

  test('a wide, deep RAM is split into several block RAMs', () => {
    const bench = ramDesign(9, 20);
    const res = runFlow(bench.nl, { device: 'M', seed: 2 });
    expect(res.netlist.rams.length).toBe(Math.ceil(20 / 8));
    const stim = stimulus(23, 150, bench.inputs.length, [...Array(9).fill(0.5), ...Array(20).fill(0.5), 0.6]);
    expect(traceFabric(res, bench, stim)).toEqual(traceOriginal(bench, stim));
  });

  test('a ROM keeps its contents in the configuration bits', () => {
    const words = Array.from({ length: 32 }, (_, i) => (i * 37 + 5) & 0xff);
    const bench = romDesign(5, 8, words);
    const res = runFlow(bench.nl, { device: 'M' });
    expect(res.netlist.rams.length).toBe(1);
    const run = runFabric(res, bench);
    for (let a = 0; a < 32; a++) {
      bench.inputs.forEach((id, i) => setInput(run, id, ((a >> i) & 1) === 1));
      run.engine.advance(100e-9);
      const got = bench.outputs.reduce((s, o, i) => s | (run.engine.logic(run.outNet.get(o)!) << i), 0);
      expect(got).toBe(words[a]);
    }
  });

  test('S has no block RAM: the flow moves the design to a device that has', () => {
    const res = runFlow(ramDesign(4, 4).nl);
    expect(res.device.name).toBe('vFPGA-M');
    expect(() => runFlow(ramDesign(4, 4).nl, { device: 'S' })).toThrow(FlowError);
  });
});

describe('refusals', () => {
  test('a combinational loop is an error naming the elements', () => {
    const b = new NetlistBuilder();
    const a = b.net();
    const y = b.net();
    b.add('toggle', 't', { Y: a });
    const z = b.net();
    b.add('and', 'g1', { A: a, B: z, Y: y });
    b.add('not', 'g2', { A: y, Y: z });
    b.add('indicator', 'o', { A: y });
    let err: unknown;
    try {
      runFlow(b.build());
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FlowError);
    expect((err as FlowError).elements.sort()).toEqual(['g1', 'g2']);
    expect((err as FlowError).stage).toBe('synthesis');
  });

  test('a flip-flop clocked by logic is refused with advice', () => {
    const b = new NetlistBuilder();
    const c1 = b.net();
    const c2 = b.net();
    const d = b.net();
    const q = b.net();
    b.add('toggle', 'c1', { Y: c1 });
    b.add('toggle', 'c2', { Y: c2 });
    const gated = b.net();
    b.add('and', 'gate', { A: c1, B: c2, Y: gated });
    b.add('toggle', 'd', { Y: d });
    b.add('dff', 'ff', { D: d, CLK: gated, Q: q });
    b.add('indicator', 'o', { A: q });
    expect(() => runFlow(b.build())).toThrow(/clock enables/);
  });

  test('element types the FPGA cannot build are listed', () => {
    const b = new NetlistBuilder();
    const y = b.net();
    b.add('resistor', 'r', {});
    b.add('tristate', 'tri', { Y: y });
    expect(() => runFlow(b.build())).toThrow(/resistor, tristate/);
  });

  test('a design too big for S goes to M automatically; too many clocks are refused', () => {
    expect(runFlow(datapath(1, 1, 16, 2).nl).device.name).toBe('vFPGA-M');
    const b = new NetlistBuilder();
    const q: number[] = [];
    for (let i = 0; i < 9; i++) {
      const c = b.net();
      const d = b.net();
      b.add('toggle', `c${i}`, { Y: c });
      b.add('toggle', `d${i}`, { Y: d });
      const y = b.net();
      b.add('dff', `f${i}`, { D: d, CLK: c, Q: y });
      b.add('indicator', `o${i}`, { A: y });
      q.push(y);
    }
    expect(() => runFlow(b.build(), { device: 'M' })).toThrow(/9 clocks/);
  });

  test('undriven nets read as 0 and are reported', () => {
    const b = new NetlistBuilder();
    const y = b.net();
    b.add('or', 'g', { Y: y });
    b.add('indicator', 'o', { A: y });
    const res = runFlow(b.build());
    expect(res.log.some((l) => /no driver/.test(l))).toBe(true);
  });
});

describe('two clock domains', () => {
  test('flip-flops on different global clocks share a chip', () => {
    const b = new NetlistBuilder();
    const ca = b.net();
    const cb = b.net();
    const d = b.net();
    b.add('toggle', 'ca', { Y: ca });
    b.add('toggle', 'cb', { Y: cb });
    b.add('toggle', 'd', { Y: d });
    const qa = b.net();
    const qb = b.net();
    b.add('dff', 'fa', { D: d, CLK: ca, Q: qa });
    b.add('dff', 'fb', { D: d, CLK: cb, Q: qb });
    b.add('indicator', 'oa', { A: qa });
    b.add('indicator', 'ob', { A: qb });
    const res = runFlow(b.build(), { device: 'S' });
    expect(res.netlist.ports.filter((p) => p.clock).length).toBe(2);
    const run = runFabric(res, { inputs: ['ca', 'cb', 'd'], outputs: ['oa', 'ob'] });
    setInput(run, 'd', true);
    run.engine.advance(50e-9);
    setInput(run, 'ca', true);
    run.engine.advance(50e-9);
    expect([run.engine.logic(run.outNet.get('oa')!), run.engine.logic(run.outNet.get('ob')!)]).toEqual([1, 0]);
    setInput(run, 'cb', true);
    run.engine.advance(50e-9);
    expect(run.engine.logic(run.outNet.get('ob')!)).toBe(1);
  });
});

describe('larger equivalence checks', () => {
  test('a random 300-gate netlist with 10 inputs on M (exhaustive)', () => {
    const bench = randomComb(77, 10, 300, 8);
    const res = runFlow(bench.nl, { device: 'M' });
    const want = truthOf(bench);
    const run = runFabric(res, bench);
    for (let v = 0; v < 1 << 10; v++) {
      bench.inputs.forEach((id, i) => setInput(run, id, ((v >> i) & 1) === 1));
      run.engine.advance(300e-9);
      expect(bench.outputs.map((o) => run.engine.logic(run.outNet.get(o)!))).toEqual(want[v]);
    }
  });

  test('adder with a carry chain and the FSM survive re-running the flow with other seeds', () => {
    for (const seed of [1, 2, 3]) {
      const a = adder(4, 'gates');
      const res = runFlow(a.nl, { seed });
      const want = truthOf(a);
      const run = runFabric(res, a);
      for (let v = 0; v < 1 << a.inputs.length; v += 3) {
        a.inputs.forEach((id, i) => setInput(run, id, ((v >> i) & 1) === 1));
        run.engine.advance(200e-9);
        expect(a.outputs.map((o) => run.engine.logic(run.outNet.get(o)!))).toEqual(want[v]);
      }
      const f = sequenceDetector();
      const stim = stimulus(seed, 60, 2, [0.5, 0.05]);
      expect(traceFabric(runFlow(f.nl, { seed }), f, stim)).toEqual(traceOriginal(f, stim));
    }
  });
});
