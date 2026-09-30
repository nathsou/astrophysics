import { describe, expect, test } from 'vitest';
import { FabricConfig } from '$lib/pld/devices/vfpga-config';
import { buildFabric, device, nodeLabel, nodeOf, traceDriver } from '../fabric';
import { checkRoute, netStatus, solutionBits, startBits, type RouteInput } from './model';

const input: RouteInput = {
  id: 't/route',
  fabric: { pads: { P0: 'in', P1: 'in', P2: 'in', P8: 'out' }, cells: [{ at: [1, 1, 0], lut: 'I0 & I1' }, { at: [2, 1, 0], lut: 'I0 & I1' }, { at: [1, 2, 0], lut: 'I0 | I1' }] },
  nets: [
    { name: 'a', from: 'P0', to: ['LC(1,1,0).I0'] },
    { name: 'b', from: 'P1', to: ['LC(1,1,0).I1', 'LC(2,1,0).I0'] },
    { name: 'c', from: 'P2', to: ['LC(2,1,0).I1'] },
    { name: 'd', from: 'LC(1,1,0)', to: ['LC(1,2,0).I0'] },
    { name: 'e', from: 'LC(2,1,0)', to: ['LC(1,2,0).I1'] },
    { name: 'f', from: 'LC(1,2,0)', to: ['P8'] },
  ],
  outputs: { P8: 'P1 & (P0 | P2)' },
  solution: [['P0', 'LC(1,1,0).I0'], ['P1', 'LC(1,1,0).I1'], ['P1', 'LC(2,1,0).I0'], ['P2', 'LC(2,1,0).I1'], ['LC(1,1,0)', 'LC(1,2,0).I0'], ['LC(2,1,0)', 'LC(1,2,0).I1'], ['LC(1,2,0)', 'P8']],
};

describe('route: names', () => {
  const dev = device();
  test('pads are sources and sinks, cells have outputs and inputs', () => {
    expect(nodeLabel(dev, nodeOf(dev, 'P3', 'source'))).toBe('P3');
    expect(nodeLabel(dev, nodeOf(dev, 'P3', 'sink'))).toBe('P3');
    expect(nodeOf(dev, 'P3', 'source')).not.toBe(nodeOf(dev, 'P3', 'sink'));
    expect(nodeLabel(dev, nodeOf(dev, 'LC(1,2,0)', 'source'))).toBe('LC(1,2,0)');
    expect(nodeLabel(dev, nodeOf(dev, 'LC(1,2,0).I3', 'sink'))).toBe('LC(1,2,0).I3');
    expect(() => nodeOf(dev, 'LC(1,2,0)', 'sink')).toThrow(/cell's output/);
    expect(() => nodeOf(dev, 'LC(1,2,0).I0', 'source')).toThrow(/cell's input/);
    expect(() => nodeOf(dev, 'nonsense', 'sink')).toThrow(/not a pad/);
  });
});

describe('route: the check', () => {
  test('bare cells: every sink is open, nothing passes', () => {
    const r = checkRoute(input, startBits(input));
    expect(r.pass).toBe(false);
    expect(r.legal).toBe(false);
    expect(r.locked).toBe(true);
    expect(r.problems).toHaveLength(7);
    expect(r.problems[0]).toBe('Net a: LC(1,1,0).I0 is not connected to anything yet.');
    expect(r.nets.every((n) => !n.done)).toBe(true);
  });

  test('the solution routes every sink and the fabric computes the function', () => {
    const r = checkRoute(input, solutionBits(input));
    expect(r).toMatchObject({ pass: true, legal: true, functionOk: true, problems: [], rows: [] });
    expect(r.nets.every((n) => n.done)).toBe(true);
  });

  test('a sink that reads another net’s wire is shorted to it', () => {
    const dev = device();
    const cfg = new FabricConfig(dev, buildFabric(input.fabric, false).bits);
    // Route a and c, then make net c’s sink read whatever net a’s first wire carries: connect I1 of the second cell to P0.
    cfg.route(nodeOf(dev, 'P0', 'source'), nodeOf(dev, 'LC(1,1,0).I0', 'sink'));
    cfg.route(nodeOf(dev, 'P0', 'source'), nodeOf(dev, 'LC(2,1,0).I1', 'sink'));
    const s = netStatus(input, cfg.bits);
    expect(s[2]!.sinks[0]).toMatchObject({ state: 'short', drivenBy: 'net a (P0)' });
    expect(s[0]!.done).toBe(true);
    const r = checkRoute(input, cfg.bits);
    expect(r.problems).toContain('Net c: LC(2,1,0).I1 is driven by net a (P0), not by P2: two nets share a wire.');
    expect(r.legal).toBe(false);
  });

  test('a legal routing of the wrong function is reported with the pad levels', () => {
    const wrong: RouteInput = { ...input, outputs: { P8: 'P0 & P1 | P2' } };
    const r = checkRoute(wrong, solutionBits(input));
    expect(r.legal).toBe(true);
    expect(r.functionOk).toBe(false);
    expect(r.pass).toBe(false);
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows[0]).toMatchObject({ differ: ['P8'] });
  });

  test('the cells and pads are placed for the reader: changing a LUT bit is refused', () => {
    const bits = solutionBits(input).slice();
    new FabricConfig(device(), bits).setLut(1, 1, 0, 0xffff);
    const r = checkRoute(input, bits);
    expect(r.locked).toBe(false);
    expect(r.pass).toBe(false);
    expect(r.problems[0]).toMatch(/already placed/);
  });

  test('following a chain of multiplexers back to its source', () => {
    const dev = device();
    const bits = solutionBits(input);
    const t = traceDriver(dev, bits, nodeOf(dev, 'LC(1,2,0).I0', 'sink'));
    expect(nodeLabel(dev, t.source)).toBe('LC(1,1,0)');
    expect(t.path.length).toBeGreaterThanOrEqual(2);
    expect(traceDriver(dev, startBits(input), nodeOf(dev, 'LC(1,2,0).I0', 'sink')).source).toBe(-1);
  });
});
