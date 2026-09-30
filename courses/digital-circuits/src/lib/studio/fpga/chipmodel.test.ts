import { describe, expect, it } from 'vitest';
import { getVFpga } from '../../pld/devices/vfpga';
import { buildChipModel, moduleHue, tileModule, tileUse } from './chipmodel';
import { HandDevice, xorSolution } from './hand';
import { flowOf } from './fixture.test-util';

describe('chip model', () => {
  it('counts configured cells like the flow does and knows each cell’s module', () => {
    const { result, device, index } = flowOf('counter', 'Counter', 'S');
    const m = buildChipModel(device, result.bits, result, index);
    expect(m.usedCount).toBe(result.cells.length);
    expect(m.modules).toEqual(['Counter']);
    for (const c of result.cells) {
      expect(m.cellModule.get(`${c.x},${c.y},${c.k}`)).toBe(0);
      expect(m.cellLabel.get(`${c.x},${c.y},${c.k}`)).toBe(c.label);
    }
    const c0 = result.cells[0]!;
    expect(tileUse(m, c0.x, c0.y)).toBeGreaterThan(0);
    expect(tileModule(m, c0.x, c0.y)).toBe(0);
    expect(tileModule(m, 0, 0)).toBe(-1);
    expect(m.routing.count).toBeGreaterThan(5);
    expect(m.wireNet.size).toBeGreaterThan(0);
    expect(m.criticalNodes.size).toBeGreaterThan(0);
    expect(m.criticalCells.size).toBeGreaterThan(0);
    for (const k of m.criticalCells) expect(result.cellIndex[k]).toBeDefined();
    expect(m.padPort.size).toBe(result.ports.length);
  });

  it('draws a hand configuration from its bits alone', () => {
    const dev = getVFpga('S');
    const m = buildChipModel(dev, xorSolution(dev));
    expect(m.usedCount).toBe(1);
    expect(tileUse(m, 1, 2)).toBe(1);
    expect(m.routing.count).toBeGreaterThanOrEqual(3);
    expect(m.criticalNodes.size).toBe(0);
    expect(buildChipModel(dev, new HandDevice().bits).routing.count).toBe(0);
  });

  it('separates the modules of a hierarchical design by colour index', () => {
    expect(new Set([0, 1, 2, 3, 4, 5, 6, 7].map(moduleHue)).size).toBe(8);
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) expect(Math.abs(moduleHue(i) - moduleHue(j))).toBeGreaterThan(20);
  });
});
