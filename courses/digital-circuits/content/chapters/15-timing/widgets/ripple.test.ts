import { describe, expect, test } from 'vitest';
import { makeAdder, readWord, rest, sequence } from './ripple';

describe('the ripple-carry adder settling', () => {
  test('adding a carry to 1111: the word counts down through 14, 12, 8, 0 and only then reaches 16', () => {
    const a = makeAdder(4);
    rest(a);
    expect(readWord(a)).toBe(15);
    const rec = a.engine.watch(a.word);
    const t0 = a.engine.time;
    a.engine.setParam('cin', 'on', true);
    a.engine.advance(100e-9);
    const seq = sequence(rec.times(), rec.values(), t0);
    expect(seq.map((s) => s.value)).toEqual([15, 14, 12, 8, 0, 16]);
    expect(readWord(a)).toBe(16);
    // The last change is at t_pd after the flip, and each stage of the carry takes 4 ns.
    const last = (seq[seq.length - 1]!.at - t0) * 1e9;
    expect(last).toBeCloseTo(a.tpd - 3, 6); // the carry out at 16 ns: the critical path to c4 is 19 ns from a0, 16 ns from cin
    expect(seq.map((s) => Math.round((s.at - t0) * 1e9))).toEqual([0, 3, 7, 11, 15, 16]);
  });

  test('eight bits take twice as long', () => {
    const a = makeAdder(8);
    rest(a);
    const rec = a.engine.watch(a.word);
    const t0 = a.engine.time;
    a.engine.setParam('cin', 'on', true);
    a.engine.advance(200e-9);
    const seq = sequence(rec.times(), rec.values(), t0);
    expect((seq[seq.length - 1]!.at - t0) * 1e9).toBeCloseTo(32, 6);
    expect(seq[seq.length - 1]!.value).toBe(256);
  });
});
