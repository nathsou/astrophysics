import { describe, expect, test, vi } from 'vitest';
import { createDigitalEngine } from '../../sim/digital';
import { getVFpga, TILE_BRAM } from '../devices/vfpga';
import { FabricConfig, parseBitstream } from '../devices/vfpga-config';
import { attachTestbench, decodeBitstream } from './decode';

// Whole-flow tests are heavy when other test files run at the same time.
vi.setConfig({ testTimeout: 180_000 });

/** A configured fabric on the engine with logic switches on the named input pads. */
function start(cfg: FabricConfig, inputs: number[]) {
  const d = cfg.device;
  const fab = decodeBitstream(d, cfg.bits);
  attachTestbench(fab, inputs.map((i) => d.pads[i]!.name));
  const eng = createDigitalEngine(fab);
  const set = (pad: number, v: boolean | number) => eng.setParam(`TB:${d.pads[pad]!.name}`, 'on', !!v);
  const read = (pad: number) => eng.logic(fab.fabric.padNets.get(d.pads[pad]!.name)!);
  return { fab, eng, set, read };
}

describe('hand-configured vFPGA-S', () => {
  const d = getVFpga('S');

  test('a LUT wired between three pads computes XOR of two pins', () => {
    const cfg = new FabricConfig(d);
    // Pads 0 and 1 are inputs, pad 9 the output; the LUT of cell 0 in tile (1, 1) holds the XOR truth table.
    cfg.setLut(1, 1, 0, 0x6666);
    cfg.route(d.padIn(0), d.lcIn(1, 1, 0, 0));
    cfg.route(d.padIn(1), d.lcIn(1, 1, 0, 1));
    cfg.route(d.lcOut(1, 1, 0), d.padOut(9));
    cfg.setPad(9, { output: true });
    const { eng, set, read } = start(cfg, [0, 1]);
    for (let v = 0; v < 4; v++) {
      set(0, v & 1);
      set(1, (v >> 1) & 1);
      eng.advance(50e-9);
      expect(read(9)).toBe((v & 1) ^ ((v >> 1) & 1));
    }
  });

  test('a cosmic ray: flipping truth-table bits changes the function on exactly those rows', () => {
    const cfg = new FabricConfig(d);
    cfg.setLut(1, 1, 0, 0x6666);
    cfg.route(d.padIn(0), d.lcIn(1, 1, 0, 0));
    cfg.route(d.padIn(1), d.lcIn(1, 1, 0, 1));
    cfg.route(d.lcOut(1, 1, 0), d.padOut(9));
    cfg.setPad(9, { output: true });
    // Rows 1, 5, 9 and 13 are the rows with I0 = 1 and I1 = 0 (the other inputs are not connected): flip all four.
    for (const row of [1, 5, 9, 13]) cfg.flip(d.tileCfgOffset[d.tid(1, 1)]! + d.clkBits + 1 + row);
    const { eng, set, read } = start(cfg, [0, 1]);
    const out: number[] = [];
    for (let v = 0; v < 4; v++) {
      set(0, v & 1);
      set(1, (v >> 1) & 1);
      eng.advance(50e-9);
      out.push(read(9));
    }
    expect(out).toEqual([0, 0, 1, 0]);
  });

  test('two cross-coupled LUTs make an SR latch: combinational loops are kept and simulated', () => {
    const cfg = new FabricConfig(d);
    // Q = NOR(R, Qn) in cell 0; Qn = NOR(S, Q) in cell 1 (NOR of I0, I1 = 0x1111).
    cfg.setLut(1, 1, 0, 0x1111);
    cfg.setLut(1, 1, 1, 0x1111);
    cfg.route(d.padIn(0), d.lcIn(1, 1, 0, 0)); // R
    cfg.route(d.lcOut(1, 1, 1), d.lcIn(1, 1, 0, 1));
    cfg.route(d.padIn(1), d.lcIn(1, 1, 1, 0)); // S
    cfg.route(d.lcOut(1, 1, 0), d.lcIn(1, 1, 1, 1));
    cfg.route(d.lcOut(1, 1, 0), d.padOut(9));
    cfg.setPad(9, { output: true });
    const { eng, set, read } = start(cfg, [0, 1]);
    set(0, 0);
    set(1, 1); // set
    eng.advance(50e-9);
    expect(read(9)).toBe(1);
    set(1, 0); // hold
    eng.advance(50e-9);
    expect(read(9)).toBe(1);
    set(0, 1); // reset
    eng.advance(50e-9);
    expect(read(9)).toBe(0);
    set(0, 0); // hold
    eng.advance(50e-9);
    expect(read(9)).toBe(0);
  });

  test('a LUT fed by its own output through an inverting table oscillates (the engine does not choke)', () => {
    const cfg = new FabricConfig(d);
    cfg.setLut(1, 1, 0, 0x5555);
    cfg.select(d.lcIn(1, 1, 0, 0), d.lcOut(1, 1, 0));
    cfg.route(d.lcOut(1, 1, 0), d.padOut(9));
    cfg.setPad(9, { output: true });
    const { eng, fab } = start(cfg, []);
    // The loop itself (the output pad's buffer would swallow pulses this short).
    const net = fab.fabric.nodeNet[d.lcOut(1, 1, 0)]!;
    const rec = eng.watch([net]);
    eng.advance(100e-9);
    const values = Array.from(rec.values()[0]!);
    expect(values.filter((v) => v === 0).length).toBeGreaterThan(5);
    expect(values.filter((v) => v === 1).length).toBeGreaterThan(5);
  });

  test('a flip-flop on the global clock, with the bypass mux selecting it', () => {
    const cfg = new FabricConfig(d);
    const clkPad = d.gbPads[0]!;
    // D from pad 5, clock from the pad of global 0, Q to pad 9. The LUT passes I0.
    cfg.setLc(1, 1, 0, { lut: 0xaaaa, ff: true });
    cfg.setTileClock(1, 1, 0);
    cfg.route(d.padIn(5), d.lcIn(1, 1, 0, 0));
    cfg.route(d.lcOut(1, 1, 0), d.padOut(9));
    cfg.setPad(9, { output: true });
    const { eng, set, read } = start(cfg, [5, clkPad]);
    set(clkPad, 0);
    set(5, 1);
    eng.advance(20e-9);
    expect(read(9)).toBe(0);
    set(clkPad, 1);
    eng.advance(20e-9);
    expect(read(9)).toBe(1);
    set(clkPad, 0);
    set(5, 0);
    eng.advance(20e-9);
    expect(read(9)).toBe(1);
    set(clkPad, 1);
    eng.advance(20e-9);
    expect(read(9)).toBe(0);
  });

  test('carry logic: two cells and a read-out cell add two 2-bit numbers', () => {
    const cfg = new FabricConfig(d);
    let xor3 = 0; // I1 ^ I2 ^ I3 (I0 is unused)
    for (let r = 0; r < 16; r++) xor3 |= (((r >> 1) ^ (r >> 2) ^ (r >> 3)) & 1) << r;
    cfg.setLc(1, 1, 0, { lut: xor3, i3Carry: true, carryChain: false, carryConst: 0 });
    cfg.setLc(1, 1, 1, { lut: xor3, i3Carry: true, carryChain: true });
    cfg.setLc(1, 1, 2, { lut: 0xff00, i3Carry: true, carryChain: true }); // reads the carry out through I3
    // a0 = pad 0, b0 = pad 1 → cell 0; a1 = pad 2, b1 = pad 3 → cell 1; sums to pads 9, 10; carry to pad 11.
    cfg.route(d.padIn(0), d.lcIn(1, 1, 0, 1));
    cfg.route(d.padIn(1), d.lcIn(1, 1, 0, 2));
    cfg.route(d.padIn(2), d.lcIn(1, 1, 1, 1));
    cfg.route(d.padIn(3), d.lcIn(1, 1, 1, 2));
    for (const [cell, pad] of [[0, 9], [1, 10], [2, 11]] as const) {
      cfg.route(d.lcOut(1, 1, cell), d.padOut(pad));
      cfg.setPad(pad, { output: true });
    }
    const { eng, set, read } = start(cfg, [0, 1, 2, 3]);
    for (let v = 0; v < 16; v++) {
      const a = v & 3;
      const b = v >> 2;
      set(0, a & 1);
      set(2, (a >> 1) & 1);
      set(1, b & 1);
      set(3, (b >> 1) & 1);
      eng.advance(50e-9);
      const sum = a + b;
      expect([read(9), read(10), read(11)]).toEqual([sum & 1, (sum >> 1) & 1, sum >> 2]);
    }
  });

  test('a configuration survives the bitstream file', () => {
    const cfg = new FabricConfig(d);
    cfg.setLut(1, 1, 0, 0x6666);
    cfg.route(d.padIn(0), d.lcIn(1, 1, 0, 0));
    const again = parseBitstream(cfg.encode(), d);
    expect(Array.from(again)).toEqual(Array.from(cfg.bits));
    expect(decodeBitstream(d, again).elements.length).toBe(decodeBitstream(d, cfg.bits).elements.length);
  });

  test('an unconfigured device decodes to an empty netlist', () => {
    const fab = decodeBitstream(d, new Uint8Array(d.totalBits));
    expect(fab.elements).toEqual([]);
  });
});

describe('hand-configured block RAM (vFPGA-M)', () => {
  test('asynchronous read of initial contents through two pads', () => {
    const m = getVFpga('M');
    const t = [...Array(m.width * m.height).keys()].find((k) => m.tileKind[k] === TILE_BRAM)!;
    const x = m.tileX(t);
    const y = m.tileY(t);
    const cfg = new FabricConfig(m);
    cfg.setBram(x, y, { mode: 0, asyncRead: true, contents: [0x0001, 0x0000, 0x8001, 0x0002] });
    cfg.route(m.padIn(0), m.ramIn(x, y, 0)); // RADDR0
    cfg.route(m.padIn(1), m.ramIn(x, y, 1)); // RADDR1
    cfg.route(m.ramOut(x, y, 0), m.padOut(60));
    cfg.route(m.ramOut(x, y, 15), m.padOut(61));
    cfg.setPad(60, { output: true });
    cfg.setPad(61, { output: true });
    const { eng, set, read } = start(cfg, [0, 1]);
    const words = [0x0001, 0x0000, 0x8001, 0x0002];
    for (let a = 0; a < 4; a++) {
      set(0, a & 1);
      set(1, a >> 1);
      eng.advance(50e-9);
      expect([read(60), read(61)]).toEqual([words[a]! & 1, words[a]! >> 15]);
    }
  });
});
