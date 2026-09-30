/** Choosing the block RAM width mode: fewest blocks, then fewest wasted bits, then the fewest idle data pins. */
import { describe, expect, it } from 'vitest';
import { check, elaborate } from '../../hdl';
import { BRAM_WIDTHS } from '../devices/vfpga-arch';
import { runFlow } from './flow';
import { fromRtl } from './fromrtl';
import { bramMode } from './lcnet';

const blocksOf = (words: number, dataBits: number) => {
  const m = bramMode(words, dataBits);
  return { width: m < 0 ? 0 : BRAM_WIDTHS[m]!, blocks: m < 0 ? 0 : Math.ceil(dataBits / BRAM_WIDTHS[m]!) };
};

describe('bramMode', () => {
  it('puts Octet’s 240 × 8 into 512 × 8, not into 256 × 16 with half the width idle', () => {
    expect(BRAM_WIDTHS[bramMode(256, 8)]).toBe(8);
    expect(blocksOf(256, 8)).toEqual({ width: 8, blocks: 1 });
  });

  it('matches the word width when one block does either', () => {
    expect(blocksOf(256, 16)).toEqual({ width: 16, blocks: 1 });
    expect(blocksOf(256, 4)).toEqual({ width: 4, blocks: 1 });
    expect(blocksOf(128, 2)).toEqual({ width: 2, blocks: 1 });
    expect(blocksOf(16, 1)).toEqual({ width: 2, blocks: 1 });
    expect(blocksOf(2048, 2)).toEqual({ width: 2, blocks: 1 });
  });

  it('uses the fewest blocks first', () => {
    // 32 × 32 bits: two 16-wide blocks, where 8-wide would need four.
    expect(blocksOf(32, 32)).toEqual({ width: 16, blocks: 2 });
    // 1024 × 8: the 4-wide mode is the first deep enough, and two blocks are needed whatever the mode.
    expect(blocksOf(1024, 8)).toEqual({ width: 4, blocks: 2 });
    // 512 × 12: 8-wide needs two blocks, 16-wide is too shallow.
    expect(blocksOf(512, 12)).toEqual({ width: 8, blocks: 2 });
    // 100 × 24: 16-wide needs two blocks and leaves 8 pins idle; 8-wide needs three.
    expect(blocksOf(100, 24)).toEqual({ width: 16, blocks: 2 });
  });

  it('refuses a RAM that is deeper than any mode', () => {
    expect(bramMode(4096, 8)).toBe(-1);
    expect(bramMode(2049, 1)).toBe(-1);
  });

  it('never uses more blocks than the first-deep-enough rule did', () => {
    for (const words of [2, 16, 100, 240, 256, 300, 512, 700, 1024, 2000, 2048]) {
      for (const bits of [1, 2, 3, 4, 7, 8, 9, 12, 16, 17, 24, 32]) {
        const first = BRAM_WIDTHS.findIndex((w) => words <= 4096 / w);
        if (first < 0) continue;
        expect(blocksOf(words, bits).blocks, `${words} × ${bits}`).toBeLessThanOrEqual(Math.ceil(bits / BRAM_WIDTHS[first]!));
      }
    }
  });
});

describe('the flow maps a 240 × 8 memory', () => {
  const src = `module M(clk: clock, we: bit, addr: bits<8>, data: bits<8>) -> (q: bits<8>) {
  mem store: [bits<8>; 240] = [0; 240]
  store.write(addr, data, we)
  q = store.read(addr)
}`;
  it('to one block RAM of 512 × 8', () => {
    const r = check(src, { file: 'm.dcl' });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const flow = runFlow(fromRtl(elaborate(r.program, 'M')), { device: 'M' });
    expect(flow.netlist.rams).toHaveLength(1);
    expect(BRAM_WIDTHS[flow.netlist.rams[0]!.mode]).toBe(8);
  });
});
