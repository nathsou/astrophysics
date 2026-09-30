import { describe, expect, it } from 'vitest';
import { getVFpga } from '../../pld/devices/vfpga';
import { edgesFromBits, edgesFromResult, nodesOf } from './routing';
import { xorSolution } from './hand';
import { flowOf } from './fixture.test-util';

describe('routing edges', () => {
  it('lists every driver → driven pair of the route trees, with their net', () => {
    const { result, device } = flowOf('counter', 'Counter', 'S');
    const e = edgesFromResult(result);
    const expected = result.route.nets.reduce((n, t) => n + t.nodes.length - 1, 0);
    expect(e.count).toBe(expected);
    for (let i = 0; i < e.count; i++) {
      const from = e.edges[3 * i]!;
      const to = e.edges[3 * i + 1]!;
      const net = e.edges[3 * i + 2]!;
      expect(net).toBeGreaterThanOrEqual(0);
      // The driven node's multiplexer can select the driver.
      expect(device.selectFor(to, from)).toBeGreaterThan(0);
    }
    expect(nodesOf(e).size).toBeGreaterThan(e.count / 2);
  });

  it('reads the same connections back from the bits alone', () => {
    const { result, device } = flowOf('counter', 'Counter', 'S');
    const fromFlow = edgesFromResult(result);
    const fromBits = edgesFromBits(device, result.bits);
    const key = (e: { edges: Int32Array; count: number }) => new Set(Array.from({ length: e.count }, (_, i) => `${e.edges[3 * i]}>${e.edges[3 * i + 1]}`));
    const a = key(fromFlow);
    const b = key(fromBits);
    // Every routed connection is in the bits; the bits may also select the clock multiplexers, which are not routed.
    for (const k of a) expect(b.has(k)).toBe(true);
  });

  it('draws a hand configuration: the three routes of the XOR solution', () => {
    const dev = getVFpga('S');
    const e = edgesFromBits(dev, xorSolution(dev));
    expect(e.count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < e.count; i++) expect(e.edges[3 * i + 2]).toBe(-1);
  });
});
