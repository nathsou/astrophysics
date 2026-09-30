import { describe, expect, test } from 'vitest';
import { buildAdder, levelsFor, measure, sweep, valueAt, worstCase } from './carry';

describe('both adders add', () => {
  for (const kind of ['ripple', 'lookahead'] as const)
    for (const n of [1, 2, 3, 4, 5, 8, 11, 16]) {
      test(`${kind}, ${n} bits: random operands and the corner cases`, () => {
        const adder = buildAdder(kind, n);
        const max = 2 ** n - 1;
        const pairs: [number, number][] = [[0, 0], [max, 1], [max, max], [1, max], [Math.floor(max / 2), Math.ceil(max / 2)]];
        let seed = n * 7919;
        const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
        for (let k = 0; k < 12; k++) pairs.push([Math.floor(rnd() * (max + 1)), Math.floor(rnd() * (max + 1))]);
        for (const [a, b] of pairs) {
          const m = measure(kind, n, a, b, adder);
          expect(m.final, `${a} + ${b}`).toBe(a + b);
          expect(valueAt(m, m.settleNs + 1)).toBe(a + b);
        }
      });
    }
});

describe('timing', () => {
  test('the ripple adder’s critical path is 2n − 1 ns, and its worst case takes exactly that', () => {
    for (let n = 2; n <= 16; n++) {
      const [a, b] = worstCase(n);
      const adder = buildAdder('ripple', n);
      expect(adder.depth, `${n} bits`).toBe(2 * n - 1);
      expect(measure('ripple', n, a, b, adder).settleNs, `${n} bits`).toBe(2 * n - 1);
    }
  });
  test('the lookahead adder’s critical path is 2·⌈log₂ n⌉ + 2 ns, and no addition is slower', () => {
    for (let n = 2; n <= 16; n++) {
      const adder = buildAdder('lookahead', n);
      expect(adder.depth, `${n} bits`).toBeLessThanOrEqual(2 * levelsFor(n) + 2);
      const [a, b] = worstCase(n);
      expect(measure('lookahead', n, a, b, adder).settleNs).toBeLessThanOrEqual(adder.depth);
    }
  });
  test('no measured settling time exceeds the critical path, for either adder', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (const kind of ['ripple', 'lookahead'] as const) {
      const adder = buildAdder(kind, 12);
      for (let k = 0; k < 40; k++) {
        const m = measure(kind, 12, Math.floor(rnd() * 4096), Math.floor(rnd() * 4096), adder);
        expect(m.settleNs).toBeLessThanOrEqual(adder.depth);
      }
    }
  });
  test('the sweep: lookahead is a little faster at 4 bits and more than three times faster at 16, for more gates', () => {
    const s = sweep(4, 16);
    const at = (n: number) => s.find((p) => p.n === n)!;
    expect([at(4).ripple, at(4).lookahead]).toEqual([7, 5]);
    expect([at(8).ripple, at(8).lookahead]).toEqual([15, 7]);
    expect([at(16).ripple, at(16).lookahead]).toEqual([31, 9]);
    expect([at(4).rippleGates, at(4).lookaheadGates, at(16).rippleGates, at(16).lookaheadGates]).toEqual([17, 23, 77, 179]);
    for (let i = 1; i < s.length; i++) {
      expect(s[i]!.ripple - s[i - 1]!.ripple).toBe(2);
      expect(s[i]!.lookahead).toBeGreaterThanOrEqual(s[i - 1]!.lookahead);
    }
    // Doubling the width adds two gate delays to the lookahead adder, and doubles the ripple adder's.
    expect(at(8).lookahead - at(4).lookahead).toBe(2);
    expect(at(16).lookahead - at(8).lookahead).toBe(2);
  });
  test('the quiet case: when no carry is generated the ripple adder is fast too', () => {
    const m = measure('ripple', 16, 0x5555, 0xaaaa);
    expect(m.settleNs).toBeLessThanOrEqual(3);
    expect(m.final).toBe(0xffff);
  });
  test('the events the engine processes for the worst case (quoted in the hood box)', () => {
    const [a, b] = worstCase(16);
    const r = measure('ripple', 16, a, b);
    const l = measure('lookahead', 16, a, b);
    expect([r.events, l.events]).toEqual([91, 125]);
  });
});
