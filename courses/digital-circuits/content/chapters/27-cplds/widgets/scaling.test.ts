import { describe, expect, test } from 'vitest';
import { advantage, blocked, monolithic, muxBits, SIZES } from './scaling';
import { BIT_COUNT, FB_BITS, FUNCTION_BLOCKS, ARRAY_OFFSET, ENABLE_OFFSET } from '$lib/pld/devices/vcpld32-arch';

describe('the crossbar arithmetic of Chapter 27', () => {
  test('at 32 macrocells the blocked count is the vCPLD-32’s own: 4 blocks of 1,920 array bits and 144 multiplexer bits', () => {
    const b = blocked(32);
    expect(b.blocks).toBe(FUNCTION_BLOCKS);
    expect(b.array).toBe(4 * (ENABLE_OFFSET - ARRAY_OFFSET));
    expect(b.array).toBe(7680);
    expect(b.matrix).toBe(4 * ARRAY_OFFSET);
    expect(b.matrix).toBe(576);
    expect(b.total).toBe(8256);
    // The rest of the 9,024 configuration bits are term enables, macrocell bits and the USERCODE.
    expect(BIT_COUNT - b.total).toBe(768);
    expect(FB_BITS * 4 + 32 + 32).toBe(BIT_COUNT);
  });

  test('one array in which every term sees every signal: 20 M² crosspoints, 20,480 at 32 macrocells, with 128-input AND gates', () => {
    const m = monolithic(32);
    expect(m.array).toBe(20480);
    expect(m.fanIn).toBe(128);
    for (const s of SIZES) expect(monolithic(s).array).toBe(20 * s * s);
  });

  test('doubling the macrocells quadruples the single array and only doubles the blocked device (plus a bit per multiplexer)', () => {
    for (const s of SIZES.slice(0, -1)) {
      const next = (s * 2) as (typeof SIZES)[number];
      expect(monolithic(next).array / monolithic(s).array).toBe(4);
      expect(blocked(next).array / blocked(s).array).toBe(2);
      expect(blocked(next).total / blocked(s).total).toBeLessThan(2.2);
    }
  });

  test('the gap grows with size: 2.5 times at 32 macrocells, nearly twenty times at 256', () => {
    expect(advantage(32)).toBeGreaterThan(2.4);
    expect(advantage(32)).toBeLessThan(2.5);
    expect(advantage(256)).toBeGreaterThan(19);
    expect(advantage(256)).toBeLessThan(20);
    expect(advantage(512)).toBeGreaterThan(advantage(256));
    expect(blocked(256).fanIn).toBe(48);
  });

  test('multiplexer width', () => {
    expect(muxBits(64)).toBe(6);
    expect(muxBits(512)).toBe(9);
  });
});

describe('the crossover', () => {
  test('with eight macrocells one array is smaller (the matrix is overhead); from sixteen the blocks win', () => {
    expect(advantage(8)).toBeLessThan(1);
    expect(advantage(16)).toBeGreaterThan(1);
  });
});
