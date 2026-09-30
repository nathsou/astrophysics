import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { NetlistBuilder, createDigitalEngine } from '$lib/sim/digital';
import { codeBits, encode, encoderIsRight, priorityEncode } from './encode';

describe('encoders', () => {
  test('one key: both encoders give its number', () => {
    for (let i = 0; i < 8; i++) {
      const keys = Array.from({ length: 8 }, (_, j) => +(i === j));
      expect(encode(keys)).toEqual({ code: i, valid: 1 });
      expect(priorityEncode(keys)).toEqual({ code: i, valid: 1 });
    }
  });
  test('no key: code 0 but not valid', () => {
    expect(encode(Array(8).fill(0))).toEqual({ code: 0, valid: 0 });
    expect(priorityEncode(Array(8).fill(0))).toEqual({ code: 0, valid: 0 });
  });
  test('keys 1 and 2 at once: the plain encoder says 3, the priority encoder says 2', () => {
    const keys = [0, 1, 1, 0, 0, 0, 0, 0];
    expect(encode(keys).code).toBe(3);
    expect(priorityEncode(keys).code).toBe(2);
    expect(encoderIsRight(keys)).toBe(false);
  });
  test('keys 3 and 4 at once: the plain encoder says 7', () => {
    expect(encode([0, 0, 0, 1, 1, 0, 0, 0]).code).toBe(7);
  });
});

describe('the digital engine’s blocks agree, for every one of the 256 key patterns', () => {
  function rig(type: 'encoder' | 'priority-encoder') {
    const b = new NetlistBuilder();
    const d = b.nets(8, 'D');
    const a = b.nets(3, 'A');
    const v = b.net('V');
    d.forEach((n, i) => b.add('toggle', `T${i}`, { Y: n }));
    b.add(type, 'E', { ...Object.fromEntries(d.map((n, i) => [`D${i}`, n])), ...Object.fromEntries(a.map((n, i) => [`A${i}`, n])), V: v }, { bits: 3 });
    const e = createDigitalEngine(b.build());
    return { e, a, v };
  }
  for (const [type, model] of [['encoder', encode], ['priority-encoder', priorityEncode]] as const) {
    test(type, () => {
      const { e, a, v } = rig(type);
      for (let p = 0; p < 256; p++) {
        const keys = Array.from({ length: 8 }, (_, i) => (p >> i) & 1);
        keys.forEach((k, i) => e.setParam(`T${i}`, 'on', !!k));
        e.advance(20e-9);
        const want = model(keys);
        expect(a.map((n) => e.logic(n)), `pattern ${p}`).toEqual(codeBits(want.code, 3));
        expect(e.logic(v)).toBe(want.valid);
      }
    });
  }
});
