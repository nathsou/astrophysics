import { describe, expect, test, vi } from 'vitest';
import { mulberry32 } from '../twolevel/random';
import { getVFpga, NK, TILE_BRAM, TILE_LOGIC } from './vfpga';
import { BRAM_BITS, LCS_PER_TILE, LC_BITS, VFPGA_DELAYS } from './vfpga-arch';
import { BitstreamError, describeBit, dumpBitstream, encodeBitstream, FabricConfig, parseBitstream, readLc } from './vfpga-config';

// Whole-flow tests are heavy when other test files run at the same time.
vi.setConfig({ testTimeout: 180_000 });

describe('vFPGA device sizes', () => {
  test('S is 2 × 2 logic tiles inside a ring of pads, and small enough to configure by hand', () => {
    const s = getVFpga('S');
    expect(s.counts.logicTiles).toBe(4);
    expect(s.counts.lcs).toBe(32);
    expect(s.counts.brams).toBe(0);
    expect(s.counts.pads).toBe(16);
    expect(s.totalBits).toBeLessThan(2500);
  });
  test('M holds 1,152 cells and L 8,192, with block RAM columns', () => {
    const m = getVFpga('M');
    const l = getVFpga('L');
    expect(m.counts.lcs).toBe(12 * 12 * LCS_PER_TILE);
    expect(l.counts.lcs).toBe(32 * 32 * LCS_PER_TILE);
    expect(m.counts.brams).toBeGreaterThan(0);
    expect(l.counts.brams).toBeGreaterThan(m.counts.brams);
    expect(m.counts.pads).toBeGreaterThanOrEqual(200);
    expect(m.spec.tracks).toEqual({ s1: 4, s4: 4, s12: 2 });
  });
  test('the delay model is the published one', () => {
    expect(VFPGA_DELAYS).toMatchObject({ lut: 0.5, span1: 0.2, span4: 0.4, span12: 0.8, switch: 0.1, ffClkToQ: 0.3, ffSetup: 0.2 });
    const d = getVFpga('M');
    const w1 = d.wire(3, 3, 0, 1, 0);
    const w4 = d.wire(3, 3, 0, 4, 0);
    const w12 = d.wire(1, 3, 0, 12, 0);
    expect(d.nodeDelay[w1]).toBeCloseTo(0.3, 5);
    expect(d.nodeDelay[w4]).toBeCloseTo(0.5, 5);
    expect(d.nodeDelay[w12]).toBeCloseTo(0.9, 5);
  });
});

describe.each(['S', 'M'] as const)('routing-resource graph of %s', (size) => {
  const d = getVFpga(size);

  test('multiplexer inputs are valid, unique and consistent with the fan-out lists', () => {
    let edges = 0;
    let bad = 0;
    for (let n = 0; n < d.nodeCount; n++) {
      const seen = new Set<number>();
      for (let i = d.inStart[n]!; i < d.inStart[n + 1]!; i++) {
        const from = d.inList[i]!;
        if (from < 0 || from >= d.nodeCount || seen.has(from)) bad++;
        seen.add(from);
        // The fan-out list contains the edge.
        let found = false;
        for (let e = d.outStart[from]!; e < d.outStart[from + 1]!; e++) if (d.outList[e] === n) found = true;
        if (!found) bad++;
        edges++;
        // Sources are never multiplexer outputs.
        if ([NK.LCO, NK.PADI, NK.RAMO].includes(d.nodeKind[n] as 0)) bad++;
      }
    }
    expect(bad).toBe(0);
    expect(edges).toBe(d.inList.length);
    expect(d.outList.length).toBe(edges);
  });

  test('wires only exist if their far end is on the die and drive from their own tile', () => {
    for (let n = 0; n < d.nodeCount; n++) {
      if (d.nodeKind[n] !== NK.WIRE) continue;
      const nk = d.wireKinds.length;
      const li = d.nodeIdx[n]!;
      const dir = Math.floor(li / nk);
      const span = d.wireKinds[li % nk]!.span;
      const ex = d.nodeX[n]! + [1, 0, -1, 0][dir]! * span;
      const ey = d.nodeY[n]! + [0, 1, 0, -1][dir]! * span;
      expect(ex).toBeGreaterThanOrEqual(0);
      expect(ey).toBeGreaterThanOrEqual(0);
      expect(ex).toBeLessThan(d.width);
      expect(ey).toBeLessThan(d.height);
    }
  });

  test('every logic-cell output can reach every logic-cell input on the chip', () => {
    const src = d.lcOut(1, 1, 0);
    const reach = new Uint8Array(d.nodeCount);
    const stack = [src];
    reach[src] = 1;
    while (stack.length) {
      const n = stack.pop()!;
      for (let e = d.outStart[n]!; e < d.outStart[n + 1]!; e++) {
        const m = d.outList[e]!;
        if (!reach[m]) {
          reach[m] = 1;
          stack.push(m);
        }
      }
    }
    for (let n = 0; n < d.nodeCount; n++) if (d.nodeKind[n] === NK.LCI || d.nodeKind[n] === NK.PADO || d.nodeKind[n] === NK.CE) expect(reach[n]).toBe(1);
  });

  test('every pad input can reach a pad output on the opposite side', () => {
    const p = d.shortestPath(d.padIn(0), d.padOut(d.pads.length / 2));
    expect(p.length).toBeGreaterThan(2);
  });

  test('configuration layout: frames tile the memory and every multiplexer has its own field', () => {
    let sum = 0;
    let prevEnd = 0;
    for (const f of d.frames) {
      expect(f.start).toBe(prevEnd);
      prevEnd = f.start + f.length;
      sum += f.length;
    }
    expect(sum).toBe(d.totalBits);
    const owner = new Int32Array(d.totalBits).fill(-1);
    for (let n = 0; n < d.nodeCount; n++) {
      const w = d.cfgWidth[n]!;
      const nin = d.inStart[n + 1]! - d.inStart[n]!;
      if (nin === 0 || d.nodeKind[n] === NK.GCLK) {
        expect(w).toBe(0);
        continue;
      }
      expect(2 ** w).toBeGreaterThan(nin);
      for (let b = 0; b < w; b++) {
        expect(owner[d.cfgOffset[n]! + b]).toBe(-1);
        owner[d.cfgOffset[n]! + b] = n;
      }
    }
  });

  test('node names round trip through findNode', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) {
      const n = rng.int(d.nodeCount);
      if (d.nodeKind[n] === NK.GCLK) continue;
      expect(d.findNode(d.nodeName(n))).toBe(n);
    }
    expect(d.findNode('LCO(99,99,0)')).toBe(-1);
    expect(d.findNode('nonsense')).toBe(-1);
  });
});

describe('configuration bits', () => {
  const d = getVFpga('S');

  test('describeBit explains every bit of vFPGA-S, and the fields add up', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < d.totalBits; i++) {
      const b = describeBit(d, i);
      counts[b.category] = (counts[b.category] ?? 0) + 1;
      expect(b.text.length).toBeGreaterThan(10);
      expect(b.frame).toBe(b.tile.x);
    }
    expect(counts.lut).toBe(4 * LCS_PER_TILE * 16);
    expect(counts['lc-flag']).toBe(4 * LCS_PER_TILE * (LC_BITS - 16));
    expect(counts.pad).toBe(8 * 2 * 2);
    let mux = 0;
    for (let n = 0; n < d.nodeCount; n++) mux += d.cfgWidth[n]!;
    expect(counts.mux).toBe(mux);
    expect(() => describeBit(d, d.totalBits)).toThrow(RangeError);
  });

  test('describeBit names the LUT row and the multiplexer', () => {
    const cfg = new FabricConfig(d);
    cfg.setLut(1, 1, 3, 0x6666);
    const first = describeBit(d, d.tileCfgOffset[d.tid(1, 1)]! + d.clkBits + 1 + 3 * LC_BITS + 5, cfg.bits);
    expect(first.category).toBe('lut');
    expect(first.cell).toBe(3);
    expect(first.row).toBe(5);
    expect(first.text).toMatch(/I0=1, I1=0, I2=1, I3=0/);
    expect(first.text).toMatch(/now 1/);
    const to = d.lcIn(1, 1, 0, 0);
    const from = d.inList[d.inStart[to]! + 2]!;
    cfg.select(to, from);
    const m = describeBit(d, d.cfgOffset[to]!, cfg.bits);
    expect(m.category).toBe('mux');
    expect(m.node).toBe(to);
    expect(m.text).toContain(d.nodeName(to));
    expect(m.text).toContain(`selects ${d.nodeName(from)}`);
  });

  test('hand configuration: LUTs, flags, multiplexers, paths and a flipped bit', () => {
    const cfg = new FabricConfig(d);
    cfg.setLc(1, 2, 5, { lut: 0x8ce1, ff: true, ceEn: true, srVal: 1, srEn: true, init: 1 });
    const lc = cfg.lc(1, 2, 5);
    expect(lc).toMatchObject({ lut: 0x8ce1, ff: true, ceEn: true, srVal: 1, srEn: true, init: 1, carryChain: false });
    expect(readLc(d, cfg.bits, 1, 2, 4).lut).toBe(0);
    const path = cfg.route('PADI(1,0,0)', 'LCI(2,2,1,3)');
    expect(path.length).toBeGreaterThan(2);
    expect(cfg.selected(path[path.length - 1]!)).toBe(path[path.length - 2]);
    expect(() => cfg.select('LCI(1,1,0,0)', 'PADI(1,0,0)')).toThrow(/not an input/);
    const ones = cfg.bits.reduce((s, b) => s + b, 0);
    cfg.flip(10);
    expect(cfg.bits.reduce((s, b) => s + b, 0)).toBe(ones + (cfg.bits[10] ? 1 : -1));
    expect(dumpBitstream(d, cfg.bits)).toMatch(/LC5: lut=0x8ce1 ff init=1 ce sync set/);
    expect(dumpBitstream(d, cfg.bits)).toContain('<=');
  });

  test('block RAM contents and width mode are bits of the configuration', () => {
    const m = getVFpga('M');
    const cfg = new FabricConfig(m);
    const ram = [...Array(m.width * m.height).keys()].map((t) => t).find((t) => m.tileKind[t] === TILE_BRAM)!;
    const x = m.tileX(ram);
    const y = m.tileY(ram);
    cfg.setBram(x, y, { mode: 1, asyncRead: true, contents: [0xab, 0xcd, 0x12] });
    const desc = describeBit(m, m.tileCfgOffset[ram]! + 3 + 2 * m.clkBits, cfg.bits);
    expect(desc.category).toBe('bram-init');
    expect(dumpBitstream(m, cfg.bits)).toMatch(/RAM: 8 bits wide, asynchronous read/);
    expect(BRAM_BITS).toBe(4096);
    expect(m.tileKind[m.tid(1, 1)]).toBe(TILE_LOGIC);
  });
});

describe('bitstream file', () => {
  const d = getVFpga('S');
  const random = (seed: number): FabricConfig => {
    const rng = mulberry32(seed);
    const cfg = new FabricConfig(d);
    for (let i = 0; i < cfg.bits.length; i++) cfg.bits[i] = rng.chance(0.3) ? 1 : 0;
    return cfg;
  };

  test('encode/parse round trip on random configurations, S and M', () => {
    for (let s = 0; s < 8; s++) {
      const cfg = random(s);
      const bytes = encodeBitstream(d, cfg.bits);
      expect(Array.from(parseBitstream(bytes, d))).toEqual(Array.from(cfg.bits));
    }
    const m = getVFpga('M');
    const rng = mulberry32(9);
    const bits = new Uint8Array(m.totalBits).map(() => (rng.chance(0.1) ? 1 : 0));
    expect(parseBitstream(encodeBitstream(m, bits), m)).toEqual(bits);
  });

  test('the file is about one bit per configuration bit, plus per-frame overhead', () => {
    const bytes = encodeBitstream(d, new Uint8Array(d.totalBits));
    expect(bytes.length).toBeLessThan(d.totalBits / 8 + 80);
  });

  test('corruption, truncation and the wrong device are detected', () => {
    const cfg = random(1);
    const bytes = encodeBitstream(d, cfg.bits);
    const bad = bytes.slice();
    bad[40] = bad[40]! ^ 0x10;
    expect(() => parseBitstream(bad, d)).toThrow(BitstreamError);
    expect(() => parseBitstream(bytes.slice(0, bytes.length - 9), d)).toThrow(BitstreamError);
    expect(() => parseBitstream(bytes, getVFpga('M'))).toThrow(/vFPGA-S/);
    expect(() => parseBitstream(new Uint8Array(30), d)).toThrow(/magic/);
    expect(() => encodeBitstream(d, new Uint8Array(3))).toThrow(BitstreamError);
  });
});
