/**
 * The RV32I core (content/designs/rv32i.dcl) through the whole FPGA flow onto vFPGA-L: it must fit, route without
 * a single overused routing node, report an Fmax, and the decoded bitstream, run on the fabric simulator, must
 * agree with the RTL simulator on a short program (Chapter 31's goal).
 *
 * The flow runs once for the file (it is the expensive part); the timings are printed for the record.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { check, elaborate } from '../../hdl';
import type { RtlDesign } from '../../hdl/rtl';
import { bindBoard, emptyBoardInputs } from '../../studio/fpga/board';
import { FabricSim, boardPorts } from '../../studio/fpga/fabric-sim';
import { summarise } from '../../studio/fpga/result';
import { NK } from '../devices/vfpga';
import { checkPlacement } from './place';
import { fromRtl } from './fromrtl';
import { runFlow, type FlowResult } from './flow';
import { checkRouting } from './route';

vi.setConfig({ testTimeout: 600_000, hookTimeout: 600_000 });

const source = readFileSync(new URL('../../../../content/designs/rv32i.dcl', import.meta.url), 'utf8');
let design: RtlDesign;
let flow: FlowResult;
let wallMs = 0;
let cpuMs = 0;

beforeAll(() => {
  design = elaborate(check(source, { file: 'rv32i.dcl' }).program);
  const cpu0 = process.cpuUsage();
  const t0 = performance.now();
  flow = runFlow(fromRtl(design), { device: 'L' });
  wallMs = performance.now() - t0;
  const c = process.cpuUsage(cpu0);
  cpuMs = (c.user + c.system) / 1000;
  const wires = flow.device.nodeKind.reduce((n, k) => n + (k === NK.WIRE ? 1 : 0), 0);
  console.log(
    `rv32i on ${flow.device.name}: ${flow.netlist.lcs.length} cells in ${flow.packed.clusters.length} of ${flow.device.counts.logicTiles} tiles, ` +
      `${flow.routing.iterations.length} routing iterations, ${flow.routing.stats.wire} of ${wires} wires (${((100 * flow.routing.stats.wire) / wires).toFixed(0)} %), ` +
      `fmax ${flow.timing.fmaxMHz.toFixed(1)} MHz; fit ${wallMs.toFixed(0)} ms wall, ${cpuMs.toFixed(0)} ms cpu (${Object.entries(flow.times).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')} ms)`,
  );
});

describe('RV32I core on vFPGA-L', () => {
  it('fits: the cells are well inside the device', () => {
    expect(flow.device.size).toBe('L');
    expect(flow.netlist.lcs.length).toBeGreaterThan(3500);
    expect(flow.netlist.lcs.length).toBeLessThan(flow.device.counts.lcs * 0.7);
    expect(flow.packed.clusters.length).toBeLessThan(flow.device.counts.logicTiles);
    expect(flow.netlist.ports.length).toBeLessThan(flow.device.counts.pads);
  });

  it('routes with zero overused nodes through legal multiplexer inputs', () => {
    expect(flow.routing.success).toBe(true);
    expect(flow.routing.overused).toBe(0);
    const last = flow.routing.iterations[flow.routing.iterations.length - 1]!;
    expect(last.overused).toBe(0);
    expect(flow.routing.iterations.length).toBeLessThanOrEqual(30);
    // ... on the first placement: the flow did not have to place again with another seed.
    expect(flow.log.some((l) => /placing again/.test(l))).toBe(false);
    expect(checkPlacement(flow.packed, flow.device, flow.placement)).toEqual([]);
    expect(checkRouting(flow.packed, flow.routing, flow.device)).toEqual([]);
  });

  it('reports a critical path and an Fmax', () => {
    expect(flow.timing.period).toBeGreaterThan(0);
    expect(Number.isFinite(flow.timing.fmaxMHz)).toBe(true);
    expect(flow.timing.fmaxMHz).toBeGreaterThan(1);
    expect(flow.report.timing.fmaxMHz).toBeCloseTo(flow.timing.fmaxMHz, 6);
  });

  it('is fast enough for the browser worker (target: under 60 s on a laptop)', () => {
    // The bound is loose: this suite runs beside many others on shared machines.
    expect(cpuMs).toBeLessThan(120_000);
  });
});

// ------------------------------------------------------------------------------------ a program on the fabric

const u32 = (v: number) => v >>> 0;
const R = (f7: number, rs2: number, rs1: number, f3: number, rd: number) => u32((f7 << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | 0x33);
const I = (imm: number, rs1: number, f3: number, rd: number, op = 0x13) => u32(((imm & 0xfff) << 20) | (rs1 << 15) | (f3 << 12) | (rd << 7) | op);
const S = (imm: number, rs2: number, rs1: number, f3: number) => u32((((imm >> 5) & 0x7f) << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | ((imm & 0x1f) << 7) | 0x23);
const B = (imm: number, rs2: number, rs1: number, f3: number) =>
  u32((((imm >> 12) & 1) << 31) | (((imm >> 5) & 0x3f) << 25) | (rs2 << 20) | (rs1 << 15) | (f3 << 12) | (((imm >> 1) & 0xf) << 8) | (((imm >> 11) & 1) << 7) | 0x63);

const PROGRAM = [
  I(100, 0, 0, 1), //           0: addi x1, x0, 100
  I(-3, 0, 0, 2), //            4: addi x2, x0, -3
  R(0, 2, 1, 0, 3), //          8: add  x3, x1, x2      97
  R(0x20, 1, 2, 0, 4), //       12: sub  x4, x2, x1      -103
  I(3, 1, 1, 5), //             16: slli x5, x1, 3       800
  I(0x400 | 1, 2, 5, 6), //     20: srai x6, x2, 1       -2
  R(0, 1, 2, 2, 7), //          24: slt  x7, x2, x1      1
  S(256, 3, 0, 2), //           28: sw   x3, 256(x0)
  I(256, 0, 2, 8, 0x03), //     32: lw   x8, 256(x0)     97
  B(8, 3, 8, 1), //             36: bne  x8, x3, +8      not taken
  I(1, 0, 0, 9), //             40: addi x9, x0, 1
  S(260, 5, 0, 2), //           44: sw   x5, 260(x0)
  0x00000073, //                48: ecall
];

describe('the decoded bitstream on the fabric simulator', () => {
  it('runs a short RV32I program and agrees with the RTL simulator on every output, every cycle', () => {
    const result = summarise(flow);
    const binding = bindBoard(boardPorts(design));
    expect(binding.errors).toEqual([]);
    const sim = new FabricSim(flow.device, result.bits, { ports: result.ports, binding, design, periodNs: result.critical.periodNs });
    const mem = new Uint8Array(1024);
    PROGRAM.forEach((w, i) => new DataView(mem.buffer).setUint32(i * 4, w, true));
    const dv = new DataView(mem.buffer);
    const bus = (name: string, width: number): number => {
      let v = 0;
      for (let i = 0; i < width; i++) {
        const b = sim.output(width > 1 ? `${name}[${i}]` : name);
        if (b !== 0 && b !== 1) throw new Error(`${name}[${i}] is ${b} after ${sim.cycles} cycles`);
        v |= b << i;
      }
      return v >>> 0;
    };
    const inputs = emptyBoardInputs();
    const drive = (name: string, width: number, value: number) => {
      for (let i = 0; i < width; i++) inputs.free[`${name}[${i}]`] = ((value >>> i) & 1) === 1;
    };
    const wordAt = (a: number) => dv.getUint32(a & 1020, true);
    let trap = 0;
    let mismatches = 0;
    let checked = 0;
    let cycles = 0;
    for (; cycles < 60 && trap === 0; cycles++) {
      // Outputs depend on the registers only; the memory answers combinationally, a store lands at the clock edge.
      const pc = bus('pc_out', 32);
      const address = bus('memory_address', 32);
      if (bus('memory_write', 1) === 1 && bus('memory_width', 2) === 2) dv.setUint32(address & 1020, bus('memory_data', 32), true);
      drive('instruction', 32, wordAt(pc));
      drive('memory_value', 32, wordAt(address));
      sim.setInputs(inputs);
      sim.clock();
      const cmp = sim.compare();
      mismatches += cmp.mismatches.length;
      checked = cmp.checked;
      trap = bus('trap_code', 2);
    }
    console.log(`fabric simulation: ${cycles} cycles, ${checked} output bits compared per cycle`);
    expect(mismatches).toBe(0);
    expect(checked).toBeGreaterThan(100);
    expect(trap).toBe(2); // ECALL
    expect(wordAt(256)).toBe(97);
    expect(wordAt(260)).toBe(800);
    // The RTL simulator running beside the fabric saw the same program.
    expect(Number(sim.rtl!.peek('register_file.x[8]'))).toBe(97);
    expect(Number(sim.rtl!.peek('register_file.x[9]'))).toBe(1);
    expect(Number(sim.rtl!.peek('register_file.x[6]'))).toBe(u32(-2));
    expect(Number(sim.rtl!.peek('register_file.x[4]'))).toBe(u32(-103));
  });
});
