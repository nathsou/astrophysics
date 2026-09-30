/**
 * The RV32I core on the board, through the FPGA flow onto vFPGA-L: with its register file in flip-flops (as the reference
 * design has it) and in block RAM. Each must fit, route with no overused node, and run on the fabric simulator in agreement
 * with the RTL simulator. The numbers that Chapter 31 quotes are checked here: how big each is, how fast, and how long the
 * fit takes.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { check, elaborate, type RtlDesign } from '$lib/hdl';
import { fromRtl, runFlow, type FlowResult } from '$lib/pld/fpga';
import { checkPlacement } from '$lib/pld/fpga/place';
import { checkRouting } from '$lib/pld/fpga/route';
import { bindBoard, emptyBoardInputs } from '$lib/studio/fpga/board';
import { FabricSim, boardPorts } from '$lib/studio/fpga/fabric-sim';
import { buildHierarchy } from '$lib/studio/fpga/hierarchy';
import { buildIndex } from '$lib/studio/fpga/crossmap';
import { summarise } from '$lib/studio/fpga/result';
import { assembleOrThrow } from '$lib/sim/cpu/rv32i';
import { FITS } from './widgets/budget';
import { rv32BoardSource } from './widgets/rv32-board';

vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });

const walk = assembleOrThrow(readFileSync(new URL('./programs/rv32-walk.asm', import.meta.url), 'utf8'), 'rv32-walk');

interface Fit {
  design: RtlDesign;
  flow: FlowResult;
  cpuMs: number;
}

function fit(registers: 'flip-flops' | 'block RAM'): Fit {
  const design = elaborate(check(rv32BoardSource(walk, registers)).program, 'Rv32Board');
  const c0 = process.cpuUsage();
  const flow = runFlow(fromRtl(design), { device: 'L' });
  const c = process.cpuUsage(c0);
  const cpuMs = (c.user + c.system) / 1000;
  const u = flow.report.utilisation;
  console.log(`rv32 with ${registers}: ${u.cells.used} cells (${u.luts} LUTs, ${u.flipFlops} flip-flops, ${u.blockRams.used} block RAMs), ${flow.routing.iterations.length} routing iterations, fmax ${flow.timing.fmaxMHz.toFixed(1)} MHz, ${cpuMs.toFixed(0)} ms cpu`);
  return { design, flow, cpuMs };
}

let flops: Fit;
let ram: Fit;
beforeAll(() => {
  flops = fit('flip-flops');
  ram = fit('block RAM');
});

function runOnFabric(f: Fit, cycles: number) {
  const result = summarise(f.flow);
  const binding = bindBoard(boardPorts(f.design));
  expect(binding.errors).toEqual([]);
  const sim = new FabricSim(f.flow.device, result.bits, { ports: result.ports, binding, design: f.design, periodNs: result.critical.periodNs });
  sim.setInputs(emptyBoardInputs());
  let mismatches = 0;
  const seen: number[] = [];
  let leds = 0;
  for (let i = 0; i < cycles; i++) {
    sim.clock();
    mismatches += sim.compare().mismatches.length;
    const l = sim.board().leds.reduce<number>((v, b, k) => v | (b === 1 ? 1 << k : 0), 0);
    if (l !== leds) seen.push((leds = l));
  }
  return { mismatches, seen, checked: sim.compare().checked };
}

describe.each([['flip-flops'], ['block RAM']] as const)('RV32I with its registers in %s, on vFPGA-L', (name) => {
  const get = () => (name === 'flip-flops' ? flops : ram);

  test('fits, and routes with zero overused nodes', () => {
    const { flow } = get();
    expect(flow.device.size).toBe('L');
    expect(flow.routing.success).toBe(true);
    expect(flow.routing.overused).toBe(0);
    expect(flow.routing.iterations.length).toBeLessThanOrEqual(30);
    expect(checkPlacement(flow.packed, flow.device, flow.placement)).toEqual([]);
    expect(checkRouting(flow.packed, flow.routing, flow.device)).toEqual([]);
    expect(flow.timing.fmaxMHz).toBeGreaterThan(5);
  });

  test('the decoded bitstream runs the walking light and agrees with the RTL simulator on every output, every cycle', () => {
    const r = runOnFabric(get(), name === 'flip-flops' ? 400 : 700);
    expect(r.mismatches).toBe(0);
    expect(r.checked).toBeGreaterThan(20);
    expect(r.seen.slice(0, 4)).toEqual([1, 2, 4, 8]);
  });
});

describe('the numbers of Chapter 31', () => {
  test('the cell budget figure quotes what the flow reports', () => {
    for (const [id, fit, regs] of [['rv32-flops', flops, 'register_file'], ['rv32-ram', ram, 'register_file']] as const) {
      const f = FITS.find((x) => x.id === id)!;
      const u = fit.flow.report.utilisation;
      expect([f.total, f.flipFlops, f.blockRams, f.capacity]).toEqual([u.cells.used, u.flipFlops, u.blockRams.used, fit.flow.device.counts.lcs]);
      expect(f.fmaxMHz).toBeCloseTo(fit.flow.timing.fmaxMHz, 1);
      expect(f.seconds).toBeGreaterThan(fit.cpuMs / 1000 / 2);
      expect(f.seconds).toBeLessThan((fit.cpuMs / 1000) * 2);
      const tree = buildHierarchy(buildIndex(summarise(fit.flow), fit.flow.device, undefined))[0]!;
      const core = tree.children[0]!.children;
      const regTotal = core.find((n) => n.name === regs)!.total;
      const aluTotal = core.find((n) => n.name === 'arithmetic')!.total;
      expect(f.segments.map((s) => s.cells)).toEqual([regTotal, aluTotal, u.cells.used - regTotal - aluTotal]);
    }
  });

  test('the register file is most of the core, and block RAM removes it', () => {
    const u = flops.flow.report.utilisation;
    const v = ram.flow.report.utilisation;
    // Flip-flops: about 4,700 cells, over half of the device; block RAM: about a third of that.
    expect(u.cells.used).toBeGreaterThan(4500);
    expect(u.cells.used).toBeLessThan(4900);
    expect(u.cells.used / flops.flow.device.counts.lcs).toBeGreaterThan(0.55);
    expect(v.cells.used).toBeGreaterThan(1400);
    expect(v.cells.used).toBeLessThan(1600);
    expect(v.blockRams.used).toBe(4);
    expect(u.blockRams.used).toBe(0);
    expect(u.flipFlops).toBeGreaterThan(1100);
    expect(v.flipFlops).toBeLessThan(100);
    // The register file alone is about two thirds of the flip-flop core.
    const index = buildIndex(summarise(flops.flow), flops.flow.device, undefined);
    const tree = buildHierarchy(index)[0]!;
    const regs = tree.children.flatMap((c) => c.children).find((n) => n.name === 'register_file')!;
    const alu = tree.children.flatMap((c) => c.children).find((n) => n.name === 'arithmetic')!;
    expect(regs.total / u.cells.used).toBeGreaterThan(0.6);
    expect(regs.total / u.cells.used).toBeLessThan(0.75);
    expect(alu.total).toBeGreaterThan(600);
    expect(alu.total).toBeLessThan(900);
  });

  test('the faster clock and the shorter fit of the block RAM version', () => {
    expect(flops.flow.timing.fmaxMHz).toBeGreaterThan(11);
    expect(flops.flow.timing.fmaxMHz).toBeLessThan(15);
    expect(ram.flow.timing.fmaxMHz).toBeGreaterThan(flops.flow.timing.fmaxMHz * 1.3);
    expect(ram.cpuMs).toBeLessThan(flops.cpuMs / 2);
    expect(flops.cpuMs).toBeGreaterThan(10_000);
  });

  test('the register file alone: flip-flops against block RAM', () => {
    const regfile = readFileSync(new URL('../../designs/regfile.dcl', import.meta.url), 'utf8').split('\ntest ')[0]!;
    const inRam = `module RegFile(
  clk: clock,
  rs1_address: bits<5>,
  rs2_address: bits<5>,
  rd_address: bits<5>,
  rd_write: bit,
  rd_value: bits<32>,
) -> (rs1_value: bits<32>, rs2_value: bits<32>) {
  mem x: [bits<32>; 32] = [0; 32]
  x.write(rd_address, rd_value, rd_write && rd_address != 0)
  rs1_value = x.read(rs1_address)
  rs2_value = x.read(rs2_address)
}
`;
    const a = runFlow(fromRtl(elaborate(check(regfile).program, 'RegFile')), { device: 'L' });
    const b = runFlow(fromRtl(elaborate(check(inRam).program, 'RegFile')), { device: 'L' });
    expect(a.report.utilisation.cells.used).toBeGreaterThan(3000);
    expect(a.report.utilisation.flipFlops).toBeGreaterThan(1000);
    expect(b.report.utilisation.cells.used).toBeLessThan(5);
    expect(b.report.utilisation.blockRams.used).toBe(4);
    expect(b.timing.fmaxMHz).toBeGreaterThan(a.timing.fmaxMHz * 2);
    console.log(`register file: ${a.report.utilisation.cells.used} cells and ${a.timing.fmaxMHz.toFixed(1)} MHz in flip-flops; ${b.report.utilisation.cells.used} cells, 4 block RAMs and ${b.timing.fmaxMHz.toFixed(1)} MHz in block RAM`);
  });
});
