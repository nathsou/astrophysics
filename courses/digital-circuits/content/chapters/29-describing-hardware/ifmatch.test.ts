import { describe, expect, it } from 'vitest';
import { check } from '$lib/hdl';
import { SELECTOR_BITS, measure, pickSource } from './widgets/ifmatch';

describe('if chain against match', () => {
  it('generates DCL that compiles for every size and style', () => {
    for (const n of SELECTOR_BITS) {
      for (const style of ['if', 'match'] as const) {
        const { diagnostics } = check(pickSource(style, n));
        expect(diagnostics.filter((d) => d.severity === 'error'), `${style} ${n}`).toEqual([]);
      }
    }
  });

  it('builds a chain of N−1 multiplexers per bit for an if, and no multiplexers for a match', () => {
    for (const k of SELECTOR_BITS) {
      const n = 2 ** k;
      expect(measure('if', k).muxes).toBe((n - 1) * 8);
      expect(measure('match', k).muxes).toBe(0);
    }
  });

  it('makes the if chain deeper than the match for eight arms, and the chain grows with the arms', () => {
    const chain8 = measure('if', 3);
    const parallel8 = measure('match', 3);
    expect(chain8.depth).toBeGreaterThan(parallel8.depth);
    expect(chain8.gateEquivalents).toBeGreaterThan(parallel8.gateEquivalents);
    expect(measure('if', 4).depth).toBeGreaterThan(measure('if', 2).depth);
  });
});
