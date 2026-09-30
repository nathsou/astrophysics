/**
 * Octet through the whole FPGA flow onto vFPGA-M: it must fit, route without a single overused routing node, report
 * an Fmax, and the decoded bitstream, run on the fabric simulator, must agree with the RTL simulator and with the
 * reference interpreter. Then a different program is put into the bitstream without fitting again, and runs.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { check, elaborate, type RtlDesign } from '$lib/hdl';
import { fromRtl, runFlow, type FlowResult } from '$lib/pld/fpga';
import { checkPlacement } from '$lib/pld/fpga/place';
import { checkRouting } from '$lib/pld/fpga/route';
import { bindBoard, emptyBoardInputs } from '$lib/studio/fpga/board';
import { FabricSim, boardPorts } from '$lib/studio/fpga/fabric-sim';
import { summarise } from '$lib/studio/fpga/result';
import { OctetMachine, assembleOrThrow, octetProgram } from '$lib/sim/cpu/octet';
import { buildHierarchy } from '$lib/studio/fpga/hierarchy';
import { buildIndex } from '$lib/studio/fpga/crossmap';
import { FITS } from './widgets/budget';
import { octetSource, withProgram } from './widgets/octet-dcl';
import { loadProgram, patchProgram, usedRams } from './widgets/octet-fpga';

vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });

let design: RtlDesign;
let flow: FlowResult;
let cpuMs = 0;

beforeAll(() => {
  design = elaborate(check(octetSource, { file: 'octet.dcl' }).program, 'Octet');
  const c0 = process.cpuUsage();
  flow = runFlow(fromRtl(design), { device: 'M' });
  const c = process.cpuUsage(c0);
  cpuMs = (c.user + c.system) / 1000;
  console.log(`octet on ${flow.device.name}: ${flow.netlist.lcs.length} cells, ${flow.report.utilisation.flipFlops} flip-flops, ${flow.routing.iterations.length} routing iterations, fmax ${flow.timing.fmaxMHz.toFixed(1)} MHz, ${cpuMs.toFixed(0)} ms cpu`);
});

/** The virtual board around a fabric simulation of the fitted design. */
function board(result = summarise(flow), d = design) {
  const binding = bindBoard(boardPorts(d));
  expect(binding.errors).toEqual([]);
  const sim = new FabricSim(flow.device, result.bits, { ports: result.ports, binding, design: d, periodNs: result.critical.periodNs });
  const inputs = emptyBoardInputs();
  sim.setInputs(inputs);
  return { sim, inputs };
}

const ledsOf = (sim: FabricSim) => sim.board().leds.reduce<number>((v, b, i) => v | (b === 1 ? 1 << i : 0), 0);

describe('Octet on vFPGA-M', () => {
  test('fits well inside the device: cells, flip-flops and two block RAMs', () => {
    const u = flow.report.utilisation;
    expect(flow.device.size).toBe('M');
    expect(u.cells.used).toBeGreaterThan(400);
    expect(u.cells.used).toBeLessThan(flow.device.counts.lcs * 0.6);
    expect(u.flipFlops).toBeGreaterThan(100);
    expect(u.blockRams.used).toBe(2);
    expect(u.pads.used).toBeLessThan(flow.device.counts.pads);
  });

  test('routes with zero overused nodes on the first placement, through legal multiplexer inputs', () => {
    expect(flow.routing.success).toBe(true);
    expect(flow.routing.overused).toBe(0);
    expect(flow.routing.iterations.length).toBeLessThanOrEqual(30);
    expect(checkPlacement(flow.packed, flow.device, flow.placement)).toEqual([]);
    expect(checkRouting(flow.packed, flow.routing, flow.device)).toEqual([]);
  });

  test('reports an Fmax, and the fit is quick enough for a browser worker', () => {
    expect(flow.timing.fmaxMHz).toBeGreaterThan(20);
    expect(flow.report.timing.fmaxMHz).toBeCloseTo(flow.timing.fmaxMHz, 6);
    expect(cpuMs).toBeLessThan(60_000);
  });
});

describe('the decoded bitstream on the fabric simulator', () => {
  test('runs the program of the source, and agrees with the RTL simulator on every output, every cycle, and with the interpreter', () => {
    const { sim } = board();
    const ref = new OctetMachine();
    ref.load(assembleOrThrow(readFileSync(new URL('./programs/walk.asm', import.meta.url), 'utf8'), 'walk'));
    let mismatches = 0;
    let checked = 0;
    let leds = 0;
    const seen: number[] = [];
    let next = ref.step();
    let cycles = next;
    for (let i = 0; i < 700; i++) {
      sim.clock();
      const cmp = sim.compare();
      mismatches += cmp.mismatches.length;
      checked = cmp.checked;
      // The interpreter, one instruction at a time: when the fabric has clocked as many cycles as the instruction takes, they agree.
      if (sim.cycles === cycles) {
        expect(sim.compare().mismatches).toEqual([]);
        expect(ledsOf(sim)).toBe(ref.board.leds);
        cycles += (next = ref.step());
      }
      if (ledsOf(sim) !== leds) seen.push((leds = ledsOf(sim)));
    }
    expect(mismatches).toBe(0);
    expect(checked).toBeGreaterThan(40);
    expect(seen.slice(0, 5)).toEqual([1, 2, 4, 8, 16]);
    void next;
  });

  test('the reset button and the power-up button start the program again', () => {
    const { sim, inputs } = board();
    for (let i = 0; i < 200; i++) sim.clock();
    expect(ledsOf(sim)).not.toBe(0);
    sim.setInputs({ ...inputs, reset: true });
    sim.clock();
    sim.setInputs(inputs);
    expect(ledsOf(sim)).toBe(0);
    expect(sim.compare().mismatches).toEqual([]);
  });
});

describe('a program put into the bitstream without fitting again', () => {
  const result = () => summarise(flow);

  test('only bits of the two block RAMs change, and the file is valid', () => {
    const r = result();
    const p = assembleOrThrow(octetProgram('multiply').source, 'multiply');
    const patch = patchProgram(flow.device, r.bits, p.image);
    expect(patch.rams).toHaveLength(2);
    expect(usedRams(flow.device, patch.bits)).toEqual(patch.rams);
    // walk.asm to multiply.asm: a few hundred bits in all, out of the device's tens of thousands.
    expect(patch.changed).toBeGreaterThan(50);
    expect(patch.changed).toBeLessThan(2 * p.size * 8);
    expect(patch.changed).toBeLessThan(flow.device.totalBits / 20);
    // Loading the same program again changes nothing.
    expect(patchProgram(flow.device, patch.bits, p.image).changed).toBe(0);
    expect(patch.bitstream.length).toBe(r.bitstream.length);
  });

  test.each(['multiply', 'fibonacci', 'hello'])('%s runs on the patched chip and agrees with the interpreter', (id) => {
    const p = assembleOrThrow(octetProgram(id).source, id);
    const loaded = loadProgram(result(), flow.device, octetSource, p);
    expect(loaded.source).toBe(withProgram(octetSource, p));
    const { sim } = board(loaded.result, loaded.design);
    const ref = new OctetMachine();
    ref.load(p);
    ref.run();
    expect(ref.halted).toBe(true);
    for (let i = 0; i < ref.cycles + 4; i++) sim.clock();
    expect(sim.compare().mismatches).toEqual([]);
    expect(ledsOf(sim)).toBe(ref.board.leds);
    expect(sim.output('halted')).toBe(1);
    const digits = sim.board().digits;
    // The two right-hand digits are the HEX register.
    expect([digits[1], digits[0]]).toEqual([HEX[ref.board.hex >> 4], HEX[ref.board.hex & 15]]);
  });
});

const HEX = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71];

describe('the numbers of Chapter 31', () => {
  test('the cell budget figure quotes what the flow reports', () => {
    const u = flow.report.utilisation;
    const f = FITS.find((x) => x.id === 'octet')!;
    expect([f.total, f.flipFlops, f.blockRams, f.capacity]).toEqual([u.cells.used, u.flipFlops, u.blockRams.used, flow.device.counts.lcs]);
    expect(f.fmaxMHz).toBeCloseTo(flow.timing.fmaxMHz, 1);
    expect(f.seconds).toBeGreaterThan(cpuMs / 1000 / 2);
    expect(f.seconds).toBeLessThan((cpuMs / 1000) * 2);
    const tree = buildHierarchy(buildIndex(summarise(flow), flow.device, undefined))[0]!;
    const total = (name: string) => tree.children.find((c) => c.name === name)!.total;
    expect(f.segments.map((s) => s.cells)).toEqual([total('alu'), total('control'), u.cells.used - total('alu') - total('control')]);
  });

  test('cells, LUTs, carry cells, pads, and the share of the device', () => {
    const u = flow.report.utilisation;
    expect([u.cells.used, u.luts, u.flipFlops, u.carryCells, u.blockRams.used, u.pads.used]).toEqual([541, 532, 129, 9, 2, 60]);
    expect(Math.round(u.cells.percent)).toBe(47);
    expect(Math.round(u.tiles.percent)).toBe(47);
    expect(flow.timing.fmaxMHz.toFixed(1)).toBe('43.3');
    expect(flow.routing.iterations.length).toBe(12);
  });

  test('the block RAMs are set to 256 × 16 (Octet has 240 words of 8 bits) and the program is 4,096 configuration bits each', () => {
    const r = summarise(flow);
    const patch = patchProgram(flow.device, r.bits, new Uint8Array(240).fill(0xff));
    // 240 words of the low 8 bits of a 16-bit word: 1,920 bits of each RAM (a few were already 1, in the walk program).
    expect(patch.changed).toBeGreaterThan(2 * 1920 - 2 * 31 * 8);
    expect(patch.changed).toBeLessThanOrEqual(2 * 1920);
  });

  test('the critical path (16 cells, 14.6 of 23.1 ns of wire, ending in the RANDOM register), and the first placement that did not route', () => {
    expect(flow.timing.period).toBeCloseTo(23.1, 1);
    expect(flow.timing.endpoint).toBe('lfsr[0].lut');
    const path = flow.report.timing.path;
    expect(path.filter((p) => p.kind === 'cell')).toHaveLength(16);
    expect(path.filter((p) => p.kind === 'net').reduce((t, p) => t + p.delay, 0)).toBeCloseTo(14.6, 1);
    expect(flow.log).toContain('routing: 60 iteration(s), 11 overused nodes');
    expect(flow.log).toContain('routing failed; placing again with another seed');
    expect(flow.log.at(-2)).toMatch(/routing: 12 iteration\(s\), no overuse/);
  });

  test('changing WAIT from 8 to 2 in the walking light changes four bits: 0xF8 to 0xFE in each of the two block RAMs', () => {
    const r = summarise(flow);
    const walk = readFileSync(new URL('./programs/walk.asm', import.meta.url), 'utf8');
    const p = assembleOrThrow(walk.replace('WAIT, 8 ', 'WAIT, 2 '), 'walk2');
    expect(walk.includes('WAIT, 8 ')).toBe(true);
    expect(patchProgram(flow.device, r.bits, p.image).changed).toBe(4);
  });

  test('the bitstream: 182,920 bits, a file of 23,017 bytes; multiply.asm changes 352 bits, 0.19 %', () => {
    const r = summarise(flow);
    expect(flow.device.totalBits).toBe(182_920);
    expect(r.bitstream.length).toBe(23_017);
    const p = assembleOrThrow(octetProgram('multiply').source, 'multiply');
    const patch = patchProgram(flow.device, r.bits, p.image);
    expect(patch.changed).toBe(352);
    expect(patch.rams).toEqual(['11,9', '11,10']);
    expect((100 * patch.changed) / flow.device.totalBits).toBeCloseTo(0.19, 2);
  });
});
