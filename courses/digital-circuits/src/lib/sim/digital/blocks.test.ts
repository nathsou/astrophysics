import { describe, expect, test } from 'vitest';
import { NetlistBuilder, createDigitalEngine } from './index';
import { LX, LZ } from '../netlist/types';
import type { Params } from '../netlist/types';
import { getDef, pinsOf, withDefaults } from '../netlist/catalog';

const NS = 1e-9;

/**
 * A block with a constant source on each input pin (set with `set`) and a net on each output.
 * Constants can be 0, 1, X or Z.
 */
function bench(type: string, params: Params = {}, unconnected: string[] = []) {
  const def = getDef(type)!;
  const pins = pinsOf(def, withDefaults(def, params));
  const b = new NetlistBuilder();
  const map: Record<string, number> = {};
  for (const p of pins) {
    map[p.name] = b.net(p.name);
    if (p.dir === 'in' && !unconnected.includes(p.name)) b.add('const', `in:${p.name}`, { Y: map[p.name]! }, { value: 0 });
  }
  b.add(type, 'U', map, params);
  const e = createDigitalEngine(b.build());
  const h = {
    e,
    set(name: string, v: number) {
      e.setParam(`in:${name}`, 'value', v);
      return h;
    },
    setBus(prefix: string, bits: number, value: number) {
      for (let i = 0; i < bits; i++) h.set(`${prefix}${i}`, (value >> i) & 1);
      return h;
    },
    run(ns = 5) {
      e.advance(ns * NS);
      return h;
    },
    get: (name: string) => e.logic(map[name]!),
    bus(prefix: string, bits: number): number | undefined {
      let v = 0;
      for (let i = 0; i < bits; i++) {
        const x = e.logic(map[`${prefix}${i}`]!);
        if (x > 1) return undefined;
        v |= x << i;
      }
      return v;
    },
    clock() {
      h.set('CLK', 1).run();
      return h.set('CLK', 0).run();
    },
  };
  h.run();
  return h;
}

describe('combinational blocks', () => {
  test('mux selects the input numbered by S', () => {
    const h = bench('mux', { select: 2 });
    for (let d = 0; d < 16; d++) {
      h.setBus('D', 4, d);
      for (let s = 0; s < 4; s++) expect(h.setBus('S', 2, s).run().get('Y')).toBe((d >> s) & 1);
    }
    // An unknown select bit still gives a known output when both candidates agree.
    h.setBus('D', 4, 0b0101).set('S0', 0).set('S1', LX).run();
    expect(h.get('Y')).toBe(1);
    h.set('S0', 1).run();
    expect(h.get('Y')).toBe(0);
    h.set('D3', 1).run();
    expect(h.get('Y')).toBe(LX);
    expect(h.e.state('U')).toEqual({ value: undefined });
  });

  test('demux routes D to one output', () => {
    const h = bench('demux', { select: 2 });
    h.set('D', 1);
    for (let s = 0; s < 4; s++) expect(h.setBus('S', 2, s).run().bus('Y', 4)).toBe(1 << s);
    h.set('D', 0).run();
    expect(h.bus('Y', 4)).toBe(0);
  });

  test('decoder with enable', () => {
    const h = bench('decoder', { bits: 3 });
    h.set('EN', 1);
    for (let a = 0; a < 8; a++) expect(h.setBus('A', 3, a).run().bus('Y', 8)).toBe(1 << a);
    h.set('EN', 0).run();
    expect(h.bus('Y', 8)).toBe(0);
    // An unconnected EN reads as 1.
    const u = bench('decoder', { bits: 2 }, ['EN']);
    expect(u.setBus('A', 2, 2).run().bus('Y', 4)).toBe(4);
    // An unknown address bit (A = X0): the two candidate outputs Y0 and Y2 are X, the rest 0.
    u.set('A1', LX).run();
    expect([0, 1, 2, 3].map((i) => u.get(`Y${i}`))).toEqual([LX, 0, LX, 0]);
  });

  test('encoder and priority encoder', () => {
    const enc = bench('encoder', { bits: 2 });
    for (let i = 0; i < 4; i++) {
      enc.setBus('D', 4, 1 << i).run();
      expect([enc.bus('A', 2), enc.get('V')]).toEqual([i, 1]);
    }
    enc.setBus('D', 4, 0b0110).run();
    expect(enc.bus('A', 2)).toBe(3); // 1 | 2
    enc.setBus('D', 4, 0).run();
    expect([enc.bus('A', 2), enc.get('V')]).toEqual([0, 0]);

    const pri = bench('priority-encoder', { bits: 3 });
    pri.setBus('D', 8, 0b00101100).run();
    expect([pri.bus('A', 3), pri.get('V')]).toEqual([5, 1]);
    pri.set('D7', LX).run();
    expect([pri.bus('A', 3), pri.get('V')]).toEqual([undefined, 1]);
    pri.set('D7', 0).set('D1', LX).run();
    expect([pri.bus('A', 3), pri.get('V')]).toEqual([5, 1]); // lower X does not matter
  });

  test('adder: every sum of two 3-bit numbers and a carry', () => {
    const h = bench('adder', { bits: 3 });
    for (let a = 0; a < 8; a++) {
      for (let b = 0; b < 8; b++) {
        for (let c = 0; c < 2; c++) {
          h.setBus('A', 3, a).setBus('B', 3, b).set('CIN', c).run(2);
          const sum = a + b + c;
          expect(h.bus('S', 3), `${a}+${b}+${c}`).toBe(sum & 7);
          expect(h.get('COUT')).toBe(sum >> 3);
        }
      }
    }
    expect(h.e.state('U')).toEqual({ value: 7, carry: 1 }); // 7 + 7 + 1 = 15
  });

  test('adder: an unknown bit only spoils the bits above it (when the carry is not decided)', () => {
    const h = bench('adder', { bits: 4 });
    h.setBus('A', 4, 0b0001).setBus('B', 4, 0b0010).set('A2', LX).run();
    expect([0, 1, 2, 3].map((i) => h.get(`S${i}`))).toEqual([1, 1, LX, 0]);
    expect(h.get('COUT')).toBe(0);
  });

  test('magnitude comparator', () => {
    const h = bench('magnitude-comparator', { bits: 4 });
    for (const [a, b] of [[3, 3], [2, 9], [12, 5], [0, 0], [15, 14]] as const) {
      h.setBus('A', 4, a).setBus('B', 4, b).run();
      expect([h.get('EQ'), h.get('LT'), h.get('GT')]).toEqual([+(a === b), +(a < b), +(a > b)]);
    }
    // Decided by a higher bit even with an unknown low bit.
    h.setBus('A', 4, 8).setBus('B', 4, 1).set('A0', LX).run();
    expect([h.get('EQ'), h.get('LT'), h.get('GT')]).toEqual([0, 0, 1]);
    h.setBus('A', 4, 1).setBus('B', 4, 1).set('B0', LZ).run();
    expect([h.get('EQ'), h.get('LT'), h.get('GT')]).toEqual([LX, LX, LX]);
  });
});

describe('clocked blocks', () => {
  test('register loads on the edge while EN = 1; CLR clears at once', () => {
    const h = bench('register', { bits: 4 }, ['EN']);
    expect(h.bus('Q', 4)).toBe(0);
    h.setBus('D', 4, 0b1010).run();
    expect(h.bus('Q', 4)).toBe(0);
    h.clock();
    expect(h.bus('Q', 4)).toBe(0b1010);
    expect(h.e.state('U')).toEqual({ value: 0b1010 });
    h.set('CLR', 1).run();
    expect(h.bus('Q', 4)).toBe(0);
    h.set('CLR', 0).setBus('D', 4, 5).clock();
    expect(h.bus('Q', 4)).toBe(5);
    // Unknown data bits are stored as unknown, per bit.
    h.set('D3', LX).clock();
    expect([0, 1, 2, 3].map((i) => h.get(`Q${i}`))).toEqual([1, 0, 1, LX]);
  });

  test('counter counts, wraps, and raises CO on the last count', () => {
    const h = bench('counter', { bits: 3 });
    h.set('EN', 1).run();
    const seen: number[] = [];
    const co: number[] = [];
    for (let i = 0; i < 10; i++) {
      h.clock();
      seen.push(h.bus('Q', 3)!);
      co.push(h.get('CO'));
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 1, 2]);
    expect(co).toEqual([0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
    h.set('EN', 0).clock();
    expect(h.bus('Q', 3)).toBe(2);
    h.setBus('D', 3, 6).set('LOAD', 1).clock();
    expect(h.bus('Q', 3)).toBe(6);
    h.set('LOAD', 0).set('CLR', 1).run();
    expect(h.bus('Q', 3)).toBe(0);
  });

  test('counter driven by a clock element', () => {
    const b = new NetlistBuilder();
    const clk = b.net('CLK');
    const q = b.nets(4, 'Q');
    b.add('clock', 'C', { Y: clk }, { frequency: 1e6 });
    b.add('counter', 'U', { CLK: clk, Q0: q[0]!, Q1: q[1]!, Q2: q[2]!, Q3: q[3]! }, { bits: 4 });
    const e = createDigitalEngine(b.build());
    e.advance(20.2e-6);
    expect(e.state('U').value).toBe(20 % 16);
  });

  test('shift register', () => {
    const h = bench('shift-register', { bits: 4 }, ['EN']);
    const bits = [1, 0, 1, 1];
    for (const bit of bits) h.set('SI', bit).clock();
    // The first bit shifted in has reached Q3.
    expect(h.bus('Q', 4)).toBe(0b1011);
    expect(h.get('SO')).toBe(1);
    h.set('SI', 0).clock();
    expect(h.bus('Q', 4)).toBe(0b0110);
    expect(h.get('SO')).toBe(0);
  });

  test('lfsr with taps 0b1100 visits all 15 non-zero states', () => {
    const h = bench('lfsr', { bits: 4, taps: 12 });
    const seen = new Set<number>();
    for (let i = 0; i < 15; i++) {
      seen.add(h.bus('Q', 4)!);
      h.clock();
    }
    expect(seen.size).toBe(15);
    expect(seen.has(0)).toBe(false);
    expect(h.bus('Q', 4)).toBe(1); // back to the start
  });
});

describe('memories', () => {
  test('RAM: synchronous write, asynchronous read', () => {
    const h = bench('ram', { addrBits: 3, dataBits: 8 });
    const write = (a: number, d: number) => h.setBus('A', 3, a).setBus('DI', 8, d).set('WE', 1).clock().set('WE', 0).run();
    write(3, 0xa5);
    write(5, 0x5a);
    expect(h.setBus('A', 3, 3).run().bus('DO', 8)).toBe(0xa5);
    expect(h.setBus('A', 3, 5).run().bus('DO', 8)).toBe(0x5a);
    expect(h.setBus('A', 3, 0).run().bus('DO', 8)).toBe(0);
    // No write without WE.
    h.setBus('DI', 8, 0xff).clock();
    expect(h.bus('DO', 8)).toBe(0);
    const mem = h.e.memory('U')!;
    expect(mem).toBeInstanceOf(Uint8Array);
    expect(Array.from(mem)).toEqual([0, 0, 0, 0xa5, 0, 0x5a, 0, 0]);
    // Writing from outside updates the outputs.
    h.e.writeMemory('U', 0, 0x42);
    h.run();
    expect(h.bus('DO', 8)).toBe(0x42);
    expect(h.e.state('U')).toEqual({ value: 0x42 });
    // Reset is a power cycle: RAM is cleared.
    h.e.reset();
    expect(Array.from(h.e.memory('U')!)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test('RAM: 32-bit words and an unknown address', () => {
    const h = bench('ram', { addrBits: 2, dataBits: 32 });
    h.setBus('A', 2, 1).setBus('DI', 32, 0).set('DI31', 1).set('DI0', 1).set('WE', 1).clock();
    const mem = h.e.memory('U')!;
    expect(mem).toBeInstanceOf(Uint32Array);
    expect(mem[1]).toBe(0x80000001);
    expect(h.get('DO31')).toBe(1);
    h.set('A0', LX).run();
    expect(h.get('DO0')).toBe(LX);
    h.clock();
    expect(h.e.messages.some((m) => m.text.includes('unknown address'))).toBe(true);
  });

  test('ROM reads its hexadecimal contents', () => {
    const h = bench('rom', { addrBits: 2, dataBits: 8, contents: '0x12, 34,ff' });
    expect([0, 1, 2, 3].map((a) => h.setBus('A', 2, a).run().bus('DO', 8))).toEqual([0x12, 0x34, 0xff, 0]);
    h.e.setParam('U', 'contents', '1,2,3,4');
    h.run();
    expect(h.bus('DO', 8)).toBe(4);
    h.e.setParam('U', 'contents', 'zz');
    expect(h.e.messages.some((m) => m.level === 'warning' && m.text.includes('zz'))).toBe(true);
  });
});
