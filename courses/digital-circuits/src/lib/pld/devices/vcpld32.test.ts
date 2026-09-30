import { describe, expect, test } from 'vitest';
import {
  ARRAY_OFFSET,
  BIT_COUNT,
  ENABLE_OFFSET,
  FB_BITS,
  MC_INIT,
  MC_OE,
  MC_OFFSET,
  MC_REG,
  MC_TFF,
  MC_XOR,
  RESERVED_OFFSET,
  ROW_BITS,
  ROW_COUNT,
  USERCODE_OFFSET,
  arrayBit,
  bitsFromHex,
  bitsToHex,
  blankBits,
  decodeConfig,
  describeBit,
  getUsercode,
  interconnectBit,
  mcBit,
  setRow,
  setUsercode,
  steerBit,
  termEnableBit,
  toFuseMap,
  usercodeText,
  type Level,
} from './vcpld32-arch';
import { VCpld32, runSteps, simulate } from './vcpld32';

// -- A tiny assembler for hand-made configurations ---------------------------------------------------

class Builder {
  bits = blankBits();
  /** Input `k` of block `fb` selects source `src` (0–31 pin, 32–63 macrocell). */
  mux(fb: number, k: number, src: number): this {
    for (let b = 0; b < 6; b++) this.bits[interconnectBit(fb, k, b)] = (src >> b) & 1;
    return this;
  }
  /** Term `t` of block `fb`: enabled, with literals [input, complement?]. */
  term(fb: number, t: number, lits: [number, boolean?][]): this {
    this.bits[termEnableBit(fb, t)] = 1;
    for (const [k, c] of lits) this.bits[arrayBit(fb, t, k, !!c)] = 1;
    return this;
  }
  steer(fb: number, mc: number, slot: number, code: number): this {
    this.bits[steerBit(fb, mc, slot, 0)] = code & 1;
    this.bits[steerBit(fb, mc, slot, 1)] = (code >> 1) & 1;
    return this;
  }
  mc(fb: number, mc: number, f: { xor?: boolean; reg?: boolean; t?: boolean; init?: number; oe?: number }): this {
    if (f.xor) this.bits[mcBit(fb, mc, MC_XOR)] = 1;
    if (f.reg) this.bits[mcBit(fb, mc, MC_REG)] = 1;
    if (f.t) this.bits[mcBit(fb, mc, MC_TFF)] = 1;
    if (f.init) this.bits[mcBit(fb, mc, MC_INIT)] = 1;
    const oe = f.oe ?? 0;
    this.bits[mcBit(fb, mc, MC_OE)] = oe & 1;
    this.bits[mcBit(fb, mc, MC_OE + 1)] = (oe >> 1) & 1;
    return this;
  }
}

const pins = (levels: Record<number, number>) => {
  const p = new Array<number>(32).fill(0);
  for (const [k, v] of Object.entries(levels)) p[Number(k)] = v;
  return p;
};

describe('vCPLD-32 configuration layout', () => {
  test('sizes: 4 blocks of 2,240 bits (35 rows), 141 rows of 64 bits in all', () => {
    expect(FB_BITS).toBe(2240);
    expect(FB_BITS % ROW_BITS).toBe(0);
    expect(ROW_COUNT).toBe(141);
    expect(BIT_COUNT).toBe(141 * 64);
    expect(USERCODE_OFFSET).toBe(4 * FB_BITS);
    expect(4 * FB_BITS + 64).toBe(BIT_COUNT);
    // Within a block: 24 × 6 interconnect, 40 × 48 array, 40 enables, 8 × 16 macrocell bits, 8 reserved.
    expect(ARRAY_OFFSET).toBe(144);
    expect(ENABLE_OFFSET).toBe(144 + 40 * 48);
    expect(MC_OFFSET).toBe(ENABLE_OFFSET + 40);
    expect(RESERVED_OFFSET).toBe(MC_OFFSET + 8 * 16);
    expect(RESERVED_OFFSET + 8).toBe(FB_BITS);
  });

  test('describeBit agrees with the address functions for every bit', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < BIT_COUNT; i++) {
      const d = describeBit(i);
      counts[d.region] = (counts[d.region] ?? 0) + 1;
      expect(d.text.length).toBeGreaterThan(3);
      switch (d.region) {
        case 'interconnect':
          expect(interconnectBit(d.fb, d.input, d.index)).toBe(i);
          break;
        case 'and-array':
          expect(arrayBit(d.fb, d.term, d.input, d.complement)).toBe(i);
          expect(d.term).toBe(d.mc * 5 + d.slot);
          break;
        case 'term-enable':
          expect(termEnableBit(d.fb, d.term)).toBe(i);
          break;
        case 'macrocell': {
          if (d.field === 'steer') expect(steerBit(d.fb, d.mc, d.slot!, d.index)).toBe(i);
          else if (d.field === 'oe') expect(mcBit(d.fb, d.mc, MC_OE + d.index)).toBe(i);
          else expect(mcBit(d.fb, d.mc, { xor: MC_XOR, reg: MC_REG, tff: MC_TFF, init: MC_INIT }[d.field])).toBe(i);
          expect(d.io).toBe(d.fb * 8 + d.mc);
          break;
        }
        case 'usercode':
          expect(USERCODE_OFFSET + d.index).toBe(i);
          break;
        case 'reserved':
          break;
      }
    }
    expect(counts).toEqual({
      interconnect: 4 * 144,
      'and-array': 4 * 1920,
      'term-enable': 4 * 40,
      macrocell: 4 * 128,
      usercode: 32,
      reserved: 4 * 8 + 32,
    });
    expect(() => describeBit(-1)).toThrow();
    expect(() => describeBit(BIT_COUNT)).toThrow();
  });

  test('hex and USERCODE helpers round-trip', () => {
    const b = blankBits();
    for (let i = 0; i < BIT_COUNT; i += 7) b[i] = 1;
    expect(Array.from(bitsFromHex(bitsToHex(b)))).toEqual(Array.from(b));
    setUsercode(b, 'ABCD');
    expect(getUsercode(b)).toBe(0x41424344);
    expect(usercodeText(getUsercode(b))).toBe('ABCD');
    setUsercode(b, 0xdeadbeef);
    expect(getUsercode(b)).toBe(0xdeadbeef);
  });
});

describe('vCPLD-32 evaluated from its bits', () => {
  test('an erased device is inert: no pin driven, every term off', () => {
    const dev = new VCpld32();
    expect(dev.isBlank).toBe(true);
    const s = dev.evaluate({ pins: pins({ 3: 1 }) });
    expect(s.driven.some(Boolean)).toBe(false);
    expect(s.pins[3]).toBe(1);
    expect(s.terms.some((t) => t)).toBe(false);
  });

  test('one AND gate through the interconnect matrix: IO0 = IO8 & !IO9, and the pad follows the output enable', () => {
    const b = new Builder()
      .mux(0, 0, 8) // block 0 input 0 ← pin 8
      .mux(0, 1, 9) // input 1 ← pin 9
      .term(0, 0, [[0], [1, true]]) // MC0 slot 0
      .steer(0, 0, 0, 1)
      .mc(0, 0, { oe: 1 });
    const dev = new VCpld32(b.bits);
    for (const [a, c, want] of [[0, 0, 0], [1, 0, 1], [0, 1, 0], [1, 1, 0]] as const) {
      const s = dev.evaluate({ pins: pins({ 8: a, 9: c }) });
      expect(s.pins[0]).toBe(want);
      expect(s.driven[0]).toBe(true);
      expect(s.driven[8]).toBe(false);
      expect(s.pins[8]).toBe(a);
    }
  });

  test('term semantics: a disabled term is 0, an enabled empty term is 1, x AND !x is 0', () => {
    const b = new Builder()
      .mux(0, 0, 8)
      .term(0, 0, []) // MC0 slot 0: constant 1
      .steer(0, 0, 0, 1)
      .mc(0, 0, { oe: 1 })
      .term(0, 5, [[0], [0, true]]) // MC1 slot 0: contradiction
      .steer(0, 1, 0, 1)
      .mc(0, 1, { oe: 1 });
    b.bits[arrayBit(0, 10, 0, false)] = 1; // MC2 slot 0: literal connected but the term is disabled
    b.steer(0, 2, 0, 1).mc(0, 2, { oe: 1 });
    const s = new VCpld32(b.bits).evaluate({ pins: pins({ 8: 1 }) });
    expect([s.pins[0], s.pins[1], s.pins[2]]).toEqual([1, 0, 0]);
    const d = decodeConfig(b.bits);
    expect(d.fbs[0]!.terms.slice(0, 3).map((t) => t.kind)).toEqual(['true', 'off', 'off']);
    expect(d.fbs[0]!.terms[5]!.kind).toBe('false');
    expect(d.fbs[0]!.terms[10]!.kind).toBe('off');
  });

  test('the XOR bit inverts', () => {
    const b = new Builder().mux(0, 0, 8).term(0, 0, [[0]]).steer(0, 0, 0, 1).mc(0, 0, { oe: 1, xor: true });
    const dev = new VCpld32(b.bits);
    expect(dev.evaluate({ pins: pins({ 8: 0 }) }).pins[0]).toBe(1);
    expect(dev.evaluate({ pins: pins({ 8: 1 }) }).pins[0]).toBe(0);
  });

  test('the product-term allocator: macrocell 1 ORs its five terms with two of macrocell 0 and one of macrocell 2', () => {
    const b = new Builder();
    // Eight inputs I0..I7 on pins 8–15, block 0 inputs 0–7.
    for (let k = 0; k < 8; k++) b.mux(0, k, 8 + k);
    // MC1: own slots 0–4 (terms 5–9) on inputs 0–4; MC0 slots 0, 1 (terms 0, 1) steered up carry inputs 5, 6;
    // MC2 slot 0 (term 10) steered down carries input 7.
    for (let s = 0; s < 5; s++) b.term(0, 5 + s, [[s]]).steer(0, 1, s, 1);
    b.term(0, 0, [[5]]).steer(0, 0, 0, 2);
    b.term(0, 1, [[6]]).steer(0, 0, 1, 2);
    b.term(0, 10, [[7]]).steer(0, 2, 0, 3);
    b.mc(0, 1, { oe: 1 }).mc(0, 0, { oe: 1 });
    const cfg = decodeConfig(b.bits);
    const m1 = cfg.fbs[0]!.macrocells[1]!;
    expect(m1.orTerms).toEqual([5, 6, 7, 8, 9, 0, 1, 10]);
    expect(m1.borrowed).toBe(3);
    expect(cfg.fbs[0]!.macrocells[0]!.lent).toBe(2);
    expect(cfg.fbs[0]!.macrocells[0]!.borrowed).toBe(0);
    const dev = new VCpld32(b.bits);
    for (let m = 0; m < 256; m++) {
      const lv: Record<number, number> = {};
      for (let k = 0; k < 8; k++) lv[8 + k] = (m >> k) & 1;
      const s = dev.evaluate({ pins: pins(lv) });
      expect(s.pins[1]).toBe(m ? 1 : 0);
      // MC0 lent its terms away and has none of its own: it stays 0.
      expect(s.pins[0]).toBe(0);
      expect(s.sums[1]).toBe(m ? 1 : 0);
    }
  });

  test('steering off the ends of a block goes nowhere', () => {
    const b = new Builder().mux(0, 0, 8).term(0, 0, [[0]]).steer(0, 0, 0, 3).mc(0, 0, { oe: 1 });
    b.term(0, 39, [[0]]).steer(0, 7, 4, 2).mc(0, 7, { oe: 1 });
    const cfg = decodeConfig(b.bits);
    expect(cfg.fbs[0]!.terms[0]!.destMc).toBe(-1);
    expect(cfg.fbs[0]!.terms[39]!.destMc).toBe(-1);
    const s = new VCpld32(b.bits).evaluate({ pins: pins({ 8: 1 }) });
    expect(s.pins[0]).toBe(0);
    expect(s.pins[7]).toBe(0);
  });

  test('output enable modes: off, always, global GOE, product term', () => {
    const b = new Builder().mux(0, 0, 8);
    for (let m = 0; m < 4; m++) b.term(0, 5 * m, []).steer(0, m, 0, 1).mc(0, m, { oe: m });
    // MC3 (mode 3): slot 4 is its enable term: true when input 0 (pin 8) is 1.
    b.term(0, 19, [[0]]);
    const dev = new VCpld32(b.bits);
    let s = dev.evaluate({ pins: pins({}) });
    expect(s.driven.slice(0, 4)).toEqual([false, true, false, false]);
    s = dev.evaluate({ pins: pins({}), goe: 1 });
    expect(s.driven.slice(0, 4)).toEqual([false, true, true, false]);
    s = dev.evaluate({ pins: pins({ 8: 1 }) });
    expect(s.driven.slice(0, 4)).toEqual([false, true, false, true]);
    expect(s.oe.slice(0, 4)).toEqual([false, true, false, true]);
    // A pad that is not driven shows the external level.
    s = dev.evaluate({ pins: pins({ 0: 1 }) });
    expect(s.pins[0]).toBe(1);
    expect(s.mc[0]).toBe(1);
  });

  test('D and T flip-flops, power-up value and GSR', () => {
    const b = new Builder().mux(0, 0, 8);
    // MC0: D flip-flop of pin 8. MC1: T flip-flop toggling while pin 8 is 1, init 1. Both drive their pins.
    b.term(0, 0, [[0]]).steer(0, 0, 0, 1).mc(0, 0, { reg: true, oe: 1 });
    b.term(0, 5, [[0]]).steer(0, 1, 0, 1).mc(0, 1, { reg: true, t: true, init: 1, oe: 1 });
    const dev = new VCpld32(b.bits);
    let s = dev.evaluate({ pins: pins({}) });
    expect([s.pins[0], s.pins[1]]).toEqual([0, 1]); // power-up values
    // Inputs change but nothing happens until the clock.
    s = dev.evaluate({ pins: pins({ 8: 1 }) });
    expect([s.pins[0], s.pins[1]]).toEqual([0, 1]);
    s = dev.clock({ pins: pins({ 8: 1 }) });
    expect([s.pins[0], s.pins[1]]).toEqual([1, 0]);
    s = dev.clock({ pins: pins({ 8: 1 }) });
    expect([s.pins[0], s.pins[1]]).toEqual([1, 1]);
    s = dev.clock({ pins: pins({ 8: 0 }) });
    expect([s.pins[0], s.pins[1]]).toEqual([0, 1]);
    // GSR sends every flip-flop to its power-up value, asynchronously, and holds it.
    dev.clock({ pins: pins({ 8: 1 }) });
    s = dev.evaluate({ pins: pins({ 8: 1 }), gsr: 1 });
    expect([s.pins[0], s.pins[1]]).toEqual([0, 1]);
    s = dev.clock({ pins: pins({ 8: 1 }), gsr: 1 });
    expect([s.pins[0], s.pins[1]]).toEqual([0, 1]);
  });

  test('all flip-flops load at the same edge: two registers swap', () => {
    const b = new Builder().mux(0, 0, 32) // input 0 ← macrocell 0
      .mux(0, 1, 33); // input 1 ← macrocell 1
    b.term(0, 0, [[1]]).steer(0, 0, 0, 1).mc(0, 0, { reg: true, oe: 1 }); // MC0 ← MC1
    b.term(0, 5, [[0]]).steer(0, 1, 0, 1).mc(0, 1, { reg: true, oe: 1, init: 1 }); // MC1 ← MC0
    const dev = new VCpld32(b.bits);
    expect(dev.evaluate().mc.slice(0, 2)).toEqual([0, 1]);
    expect(dev.clock().mc.slice(0, 2)).toEqual([1, 0]);
    expect(dev.clock().mc.slice(0, 2)).toEqual([0, 1]);
  });

  test('feedback through a buried combinational macrocell, and a loop that does not settle', () => {
    // MC0 (buried, oe 0) = !pin 8; MC1 = MC0 & pin 9.
    const b = new Builder().mux(0, 0, 8).mux(0, 1, 32).mux(0, 2, 9);
    b.term(0, 0, [[0, true]]).steer(0, 0, 0, 1).mc(0, 0, { oe: 0 });
    b.term(0, 5, [[1], [2]]).steer(0, 1, 0, 1).mc(0, 1, { oe: 1 });
    const dev = new VCpld32(b.bits);
    expect(dev.evaluate({ pins: pins({ 8: 0, 9: 1 }) }).pins[1]).toBe(1);
    const s = dev.evaluate({ pins: pins({ 8: 1, 9: 1 }) });
    expect(s.pins[1]).toBe(0);
    expect(s.mc[0]).toBe(0);
    expect(s.driven[0]).toBe(false); // buried
    expect(s.stable).toBe(true);
    // An inverter fed by its own output oscillates.
    const c = new Builder().mux(0, 0, 32);
    c.term(0, 0, [[0, true]]).steer(0, 0, 0, 1).mc(0, 0, { oe: 1 });
    expect(new VCpld32(c.bits).evaluate().stable).toBe(false);
  });
});

describe('non-volatile configuration', () => {
  const counter = () => {
    // MC0: a T flip-flop that toggles every clock (term with no literals), init 0.
    const b = new Builder().term(0, 0, []).steer(0, 0, 0, 1).mc(0, 0, { reg: true, t: true, oe: 1 });
    setUsercode(b.bits, 'KEEP');
    return b.bits;
  };

  test('program() then powerCycle() keeps the bits; the flip-flops restart at their power-up values', () => {
    const dev = new VCpld32();
    dev.program(counter());
    expect(dev.usercode).toBe(0x4b454550);
    expect(dev.clock().mc[0]).toBe(1);
    expect(dev.clock().mc[0]).toBe(0);
    dev.clock();
    const before = Array.from(dev.bits);
    dev.powerCycle();
    expect(Array.from(dev.bits)).toEqual(before);
    expect(dev.evaluate().mc[0]).toBe(0);
    expect(dev.clock().mc[0]).toBe(1);
  });

  test('deterministic power-up: two cycles give identical snapshots', () => {
    const dev = new VCpld32(counter());
    dev.clock();
    dev.powerCycle();
    const a = dev.evaluate();
    dev.clock();
    dev.powerCycle();
    const b = dev.evaluate();
    expect(a).toEqual(b);
  });

  test('erase clears every bit; programming a row can set bits but not clear them', () => {
    const dev = new VCpld32(counter());
    expect(dev.isBlank).toBe(false);
    const row = dev.readRow(USERCODE_OFFSET / ROW_BITS);
    expect(row.some((x) => x)).toBe(true);
    const zeros = new Uint8Array(ROW_BITS);
    dev.programRow(USERCODE_OFFSET / ROW_BITS, zeros);
    expect(Array.from(dev.readRow(USERCODE_OFFSET / ROW_BITS))).toEqual(Array.from(row)); // unchanged
    const other = new Uint8Array(ROW_BITS);
    other[63] = 1;
    dev.programRow(USERCODE_OFFSET / ROW_BITS, other);
    expect(dev.readRow(USERCODE_OFFSET / ROW_BITS)[63]).toBe(1);
    expect(dev.readRow(USERCODE_OFFSET / ROW_BITS)[0]).toBe(row[0]);
    dev.erase();
    expect(dev.isBlank).toBe(true);
    expect(() => dev.readRow(ROW_COUNT)).toThrow();
    expect(() => dev.programRow(-1, zeros)).toThrow();
  });

  test('programming mode turns every output off and freezes the flip-flops', () => {
    const dev = new VCpld32(counter());
    dev.clock();
    dev.iscMode = true;
    const s = dev.clock();
    expect(s.driven.some(Boolean)).toBe(false);
    expect(s.q[0]).toBe(1);
    dev.iscMode = false;
    expect(dev.clock().mc[0]).toBe(0);
  });

  test('program() rejects a wrong-sized array; setBit and setRow', () => {
    expect(() => new VCpld32().program(new Uint8Array(10))).toThrow();
    const dev = new VCpld32();
    dev.setBit(termEnableBit(0, 0), 1);
    expect(dev.getBit(termEnableBit(0, 0))).toBe(1);
    const b = blankBits();
    setRow(b, 3, new Uint8Array(64).fill(1));
    expect(b.slice(192, 256).every((x) => x === 1)).toBe(true);
  });
});

describe('simulate helpers and the fuse map', () => {
  test('simulate runs a step sequence from power-up', () => {
    const b = new Builder().term(0, 0, []).steer(0, 0, 0, 1).mc(0, 0, { reg: true, t: true, oe: 1 });
    const out = simulate(b.bits, [{}, {}, {}, {}]);
    expect(out.map((s) => s.pins[0])).toEqual([1, 0, 1, 0]);
    const dev = new VCpld32(b.bits);
    const r = runSteps(dev, [{ clock: false }, { clock: true }, { clock: false }]);
    expect(r.map((s) => s.pins[0])).toEqual([0, 1, 1]);
  });

  test('the fuse map is JSON with the blocks, terms, macrocells and interconnect', () => {
    const b = new Builder().mux(0, 0, 40).term(0, 0, [[0]]).steer(0, 0, 0, 1).mc(0, 0, { reg: true, t: true, xor: true, oe: 3 });
    const map = toFuseMap(b.bits);
    const round = JSON.parse(JSON.stringify(map)) as typeof map;
    expect(round.device).toBe('vCPLD-32');
    expect(round.bitCount).toBe(9024);
    expect(round.fbs).toHaveLength(4);
    expect(round.fbs[0]!.interconnect).toHaveLength(24);
    expect(round.fbs[0]!.interconnect[0]).toEqual({ input: 0, source: 40, kind: 'macrocell', index: 8, name: 'MC8' });
    expect(round.fbs[0]!.terms).toHaveLength(40);
    expect(round.fbs[0]!.terms[0]).toMatchObject({ enabled: true, kind: 'product', dest: 'local', destMc: 0 });
    expect(round.fbs[0]!.terms[0]!.bits).toHaveLength(48);
    expect(round.fbs[0]!.terms[0]!.bits.startsWith('10')).toBe(true);
    expect(round.fbs[0]!.macrocells[0]).toMatchObject({ registered: true, type: 'T', xor: true, oe: 'product term', oeMode: 3 });
    expect(round.fbs[0]!.macrocells).toHaveLength(8);
    expect(round.columns).toHaveLength(48);
    expect(round.ones).toBeGreaterThan(5);
    // The device gives the same map.
    expect(new VCpld32(b.bits).fuseMap()).toEqual(map);
  });

  test('levels are 0 or 1', () => {
    const l: Level = 1;
    expect(l).toBe(1);
  });
});
