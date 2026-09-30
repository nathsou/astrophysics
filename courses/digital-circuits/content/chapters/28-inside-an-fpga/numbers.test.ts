import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { check, elaborate } from '$lib/hdl';
import { getVFpga } from '$lib/pld/devices/vfpga';
import { LCS_PER_TILE, LC_BITS, VFPGA_DELAYS as D } from '$lib/pld/devices/vfpga-arch';
import { fromRtl, runFlow } from '$lib/pld/fpga';
import { fpgaExample } from '$lib/studio/fpga/examples';
import { xorSolution } from '$lib/studio/fpga/hand';
import { runFpgaFlow } from '$lib/studio/fpga/result';
import { segmentAt } from '$lib/studio/fpga/bitlayout';
import { TILE_LOGIC } from '$lib/pld/devices/vfpga';

/** The numbers Chapter 28 quotes about the vFPGA and the tools, checked against the code that produces them. */
vi.setConfig({ testTimeout: 180_000 });
const design = (src: string, top: string) => elaborate(check(src, { file: `${top}.dcl` }).program, top);

describe('the three devices', () => {
  test('sizes: 32, 1,152 and 8,192 cells; 4, 16 and 36 frames; 1,772, 182,920 and 832,592 bits', () => {
    const [s, m, l] = (['S', 'M', 'L'] as const).map((z) => getVFpga(z));
    expect([s!.counts.lcs, m!.counts.lcs, l!.counts.lcs]).toEqual([32, 1152, 8192]);
    expect([s!.frames.length, m!.frames.length, l!.frames.length]).toEqual([4, 16, 36]);
    expect([s!.totalBits, m!.totalBits, l!.totalBits]).toEqual([1772, 182920, 832592]);
    expect([s!.counts.brams, m!.counts.brams, l!.counts.brams]).toEqual([0, 24, 64]);
  });

  test('a cell has 25 bits: 16 for the table and 9 flags', () => {
    expect(LC_BITS).toBe(25);
    expect(LC_BITS - 16).toBe(9);
  });

  test('a logic tile of M and L has 486 bits: 128 table, 72 flag, 4 clock and 282 routing (58 %)', () => {
    for (const z of ['M', 'L'] as const) {
      const d = getVFpga(z);
      const t = [...Array(d.width * d.height).keys()].find((i) => d.tileKind[i] === TILE_LOGIC)!;
      expect(d.tileCfgBits[t]).toBe(486);
      const x = d.tileX(t);
      const y = d.tileY(t);
      let lut = 0;
      let flag = 0;
      let clock = 0;
      let mux = 0;
      for (let b = d.tileCfgOffset[t]!; b < d.tileCfgOffset[t]! + 486; b++) {
        const seg = segmentAt(d, b)!;
        expect([seg.x, seg.y]).toEqual([x, y]);
        if (seg.cat === 'lut') lut++;
        else if (seg.cat === 'flag') flag++;
        else if (seg.cat === 'clock') clock++;
        else if (seg.cat === 'mux') mux++;
      }
      expect([lut, flag, clock, mux]).toEqual([LCS_PER_TILE * 16, LCS_PER_TILE * 9, 4, 282]);
      expect(Math.round((100 * mux) / 486)).toBe(58);
    }
  });

  test('the delay model: a mux 0.1 ns, wires 0.2, 0.4 and 0.8 ns; carry 0.1 ns per cell, a LUT 0.5 ns', () => {
    expect([D.switch, D.span1, D.span4, D.span12]).toEqual([0.1, 0.2, 0.4, 0.8]);
    expect([D.carryIn, D.lut]).toEqual([0.1, 0.5]);
    // 32 stages of a LUT and the shortest wire to the next tile, against 32 carry steps.
    expect(+(32 * (D.lut + D.switch + D.span1 + D.switch)).toFixed(1)).toBe(28.8 + 0.0);
    expect(+(31 * D.carryIn + D.carryData).toFixed(1)).toBe(3.4);
  });

  test('a multiplexer with n inputs has ceil(log2(n + 1)) select bits: 20 inputs take 5', () => {
    expect(Math.ceil(Math.log2(20 + 1))).toBe(5);
    const m = getVFpga('M');
    const widths = new Set<number>();
    for (let n = 0; n < m.nodeCount; n++) if (m.cfgWidth[n]! > 0) widths.add(m.cfgWidth[n]!);
    expect([...widths].sort((a, b) => a - b)).toContain(5);
  });
});

describe('the XOR by hand (Figure 28.6)', () => {
  test('the worked solution sets 19 of the 1,772 bits, eight of them in the LUT (0x6666)', () => {
    const d = getVFpga('S');
    const bits = xorSolution(d);
    expect(bits.reduce((a, b) => a + b, 0)).toBe(19);
    let lut = 0;
    for (let i = 0; i < bits.length; i++) if (bits[i] && segmentAt(d, i)?.cat === 'lut') lut++;
    expect(lut).toBe(8);
  });
});

describe('the counter in the Studio (Figure 28.7)', () => {
  test('six of the 32 cells, one of 4 tiles, 8 pads, four flip-flops, about 110 bits set', () => {
    const r = runFpgaFlow(design(fpgaExample('counter')!.source, 'Counter'), { device: 'S' });
    const u = r.report.utilisation;
    expect([u.cells.used, u.cells.total, u.tiles.used, u.tiles.total, u.pads.used, u.flipFlops]).toEqual([6, 32, 1, 4, 8, 4]);
    const set = r.bits.reduce((a, b) => a + b, 0);
    expect(set).toBeGreaterThan(100);
    expect(set).toBeLessThan(120);
  });
});

describe('what the tools build (the text of Chapters 28 and 30)', () => {
  const src = (name: string) => readFileSync(new URL(`../../designs/${name}.dcl`, import.meta.url), 'utf8');

  test('a 32-bit adder is 32 cells on one carry chain, about 8 ns pad to pad', () => {
    const f = runFlow(fromRtl(design('module Add(a: bits<32>, b: bits<32>) -> (s: bits<32>) {\n  s = a + b\n}\n', 'Add')), {});
    expect(f.report.utilisation.cells.used).toBe(32);
    expect(f.report.utilisation.carryCells).toBe(32);
    expect(f.report.timing.periodNs).toBeGreaterThan(7);
    expect(f.report.timing.periodNs).toBeLessThan(10);
  });

  test('a 16-bit multiplier (the low half of the product) takes 261 cells on the vFPGA-M', () => {
    const f = runFlow(fromRtl(design('module Mul(a: bits<16>, b: bits<16>) -> (p: bits<16>) {\n  p = a * b\n}\n', 'Mul')), {});
    expect(f.device.name).toBe('vFPGA-M');
    expect(f.report.utilisation.cells.used).toBe(261);
    expect(f.report.utilisation.cells.used / 1152).toBeGreaterThan(0.2);
  });

  test('the ALU on vFPGA-M: about half of the critical path is in nets (the text quotes the exact split; see the note in the chapter test of Chapter 30)', () => {
    // The packer, placer and router are still being tuned, so the exact figures (34.7 ns, 17.9 ns of nets, in the text)
    // move with them: what this test holds is the claim, that wires are about half of the path.
    const r = runFpgaFlow(design(src('alu'), 'Alu'));
    expect(r.deviceName).toBe('vFPGA-M');
    const nets = r.critical.steps.filter((s) => s.kind === 'net').reduce((a, s) => a + s.delay, 0);
    const share = nets / r.report.timing.periodNs;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.65);
  });
});
