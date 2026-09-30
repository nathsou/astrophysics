import { describe, expect, it } from 'vitest';
import { bindBoard, emptyBoardInputs } from './board';
import { FabricSim, boardPorts } from './fabric-sim';
import { flowOf } from './fixture.test-util';

function simOf(name: string, top: string, device?: 'S' | 'M' | 'L') {
  const f = flowOf(name, top, device);
  const binding = bindBoard(boardPorts(f.design));
  const sim = new FabricSim(f.device, f.result.bits, { ports: f.result.ports, binding, design: f.design, periodNs: f.result.critical.periodNs });
  return { f, sim, binding };
}

describe('run from bits', () => {
  it('counts on the decoded bitstream and agrees with the RTL simulator', () => {
    const { sim } = simOf('counter', 'Counter');
    const inputs = emptyBoardInputs();
    inputs.free.enable = true;
    sim.setInputs(inputs);
    const seen: number[] = [];
    for (let i = 0; i < 20; i++) {
      sim.clock();
      const v = [0, 1, 2, 3].reduce((a, b) => a | (sim.output(`count[${b}]`) === 1 ? 1 << b : 0), 0);
      seen.push(v);
      expect(sim.compare().mismatches).toEqual([]);
    }
    expect(seen.slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(seen[15]).toBe(0); // wrapped after sixteen
    expect(sim.compare().checked).toBe(5);
    // Power-up returns to zero.
    sim.powerUp();
    expect(sim.output('count[0]')).toBe(0);
    expect(sim.cycles).toBe(0);
  });

  it('holds when disabled and clears synchronously', () => {
    const { sim } = simOf('counter', 'Counter');
    const inputs = emptyBoardInputs();
    inputs.free.enable = true;
    sim.setInputs(inputs);
    for (let i = 0; i < 5; i++) sim.clock();
    inputs.free.enable = false;
    sim.setInputs(inputs);
    for (let i = 0; i < 3; i++) sim.clock();
    const v = () => [0, 1, 2, 3].reduce((a, b) => a | (sim.output(`count[${b}]`) === 1 ? 1 << b : 0), 0);
    expect(v()).toBe(5);
    inputs.free.clear = true;
    sim.setInputs(inputs);
    sim.clock();
    expect(v()).toBe(0);
    expect(sim.compare().mismatches).toEqual([]);
  });

  it('detects a corrupted bitstream: flipping a LUT bit makes it disagree', () => {
    const f = flowOf('counter', 'Counter');
    const bits = f.result.bits.slice();
    const c = f.result.cells.find((x) => x.kind === 'lut' || x.kind === 'ff')!;
    for (let b = 0; b < 16; b++) bits[c.bitOffset + b] = bits[c.bitOffset + b]! ^ 1; // invert the whole table
    const binding = bindBoard(boardPorts(f.design));
    const sim = new FabricSim(f.device, bits, { ports: f.result.ports, binding, design: f.design, periodNs: 5 });
    const inputs = emptyBoardInputs();
    inputs.free.enable = true;
    sim.setInputs(inputs);
    let bad = 0;
    for (let i = 0; i < 20; i++) {
      sim.clock();
      bad += sim.compare().mismatches.length;
    }
    expect(bad).toBeGreaterThan(0);
  });

  it('follows the traffic light', () => {
    const { sim } = simOf('traffic-light', 'TrafficLight');
    const inputs = emptyBoardInputs();
    inputs.free.tick = true;
    sim.setInputs(inputs);
    const lamps = () => `${sim.output('red')}${sim.output('amber')}${sim.output('green')}`;
    expect(lamps()).toBe('100');
    sim.clock();
    expect(lamps()).toBe('110');
    sim.clock();
    expect(lamps()).toBe('001');
    sim.clock();
    expect(lamps()).toBe('010');
    sim.clock();
    expect(lamps()).toBe('100');
    expect(sim.compare().mismatches).toEqual([]);
  });

  it('reports the state of a cell and colours nodes by level', () => {
    const { sim, f } = simOf('counter', 'Counter');
    const inputs = emptyBoardInputs();
    inputs.free.enable = true;
    sim.setInputs(inputs);
    sim.clock();
    const c = f.result.cells.find((x) => x.kind === 'ff')!;
    const st = sim.cellState(c.x, c.y, c.k)!;
    expect(st).toBeDefined();
    expect(st.ff).toBeDefined();
    const net = f.result.nets.find((n) => n.nodes.length > 2)!;
    expect([0, 1]).toContain(sim.nodeLevel(net.nodes[0]!));
  });
});
