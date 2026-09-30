import { describe, expect, it } from 'vitest';
import { describeBit } from '../../pld/devices/vfpga-config';
import { cellIdOfSource, isBelow, resolveFpga, sourceIdOf, whereIs } from './crossmap';
import { flowOf } from './fixture.test-util';
import { EMPTY_FPGA_PROBE, fpgaRefKey } from './types';

const HIER = `
module Adder(a: bits<4>, b: bits<4>) -> (s: bits<4>) {
  s = a + b
}
module Acc(clk: clock, x: bits<4>) -> (total: bits<4>) {
  reg r: bits<4> = 0
  inst add: Adder(a: r, b: x)
  next r = add.s
  total = r
}
`;

describe('cross-probing', () => {
  const { result, index, link, device } = flowOf('counter', 'Counter', 'S');

  it('has the counter placed on the small device with cells and nets', () => {
    expect(result.size).toBe('S');
    expect(result.cells.length).toBeGreaterThan(3);
    expect(result.nets.length).toBeGreaterThan(3);
    expect(result.ports.find((p) => p.name === 'clk')?.clock).toBe(true);
  });

  it('parses source ids', () => {
    expect(cellIdOfSource('Counter/add#4')).toBe(4);
    expect(cellIdOfSource('clk')).toBe(-1);
    expect(sourceIdOf('Counter', 'add', 4)).toBe('Counter/add#4');
    expect(isBelow('Cpu.alu', 'Cpu')).toBe(true);
    expect(isBelow('Cpu', 'Cpu')).toBe(true);
    expect(isBelow('Cpux', 'Cpu')).toBe(false);
  });

  it('gives nothing for no selection', () => {
    expect(resolveFpga(index, null)).toBe(EMPTY_FPGA_PROBE);
    expect(resolveFpga(null, { kind: 'line', line: 3 })).toBe(EMPTY_FPGA_PROBE);
  });

  it('turns a source line into its cells, nets, bits and gates', () => {
    // Line 12 of counter.dcl: `next value = if clear { 0 } else if enable { value + 1 } else { value }`.
    const p = resolveFpga(index, { kind: 'line', line: 12 });
    expect(p.lines.has(12)).toBe(true);
    expect(p.cells.size).toBeGreaterThan(0);
    expect(p.tiles.size).toBeGreaterThan(0);
    expect(p.bits.size).toBeGreaterThanOrEqual(25 * p.cells.size);
    expect(p.elements.size).toBeGreaterThan(0);
    for (const c of p.cells) expect(result.cellIndex[c]).toBeDefined();
    for (const b of p.bits) expect(b).toBeLessThan(device.totalBits);
  });

  it('turns a module into all its cells', () => {
    const p = resolveFpga(index, { kind: 'module', path: 'Counter' });
    expect(p.cells.size).toBe(result.cells.length);
  });

  it('turns a cell into its source, its truth-table bits and the nets around it', () => {
    const c = result.cells[0]!;
    const p = resolveFpga(index, { kind: 'cell', x: c.x, y: c.y, k: c.k });
    expect(p.cells.has(`${c.x},${c.y},${c.k}`)).toBe(true);
    for (let b = 0; b < 16; b++) expect(p.bits.has(c.bitOffset + b)).toBe(true);
    expect(p.lines.size).toBeGreaterThan(0);
    expect(p.nets.size).toBeGreaterThan(0);
  });

  it('turns a net into its cells and the multiplexer bits along its route', () => {
    const i = result.nets.findIndex((n) => n.nodes.length > 3);
    const p = resolveFpga(index, { kind: 'net', net: i });
    expect(p.nets.has(i)).toBe(true);
    expect(p.cells.size).toBeGreaterThan(0);
    let muxBits = 0;
    for (const b of p.bits) if (describeBit(device, b).category === 'mux') muxBits++;
    expect(muxBits).toBeGreaterThan(0);
  });

  it('turns a configuration bit back into its cell and source line', () => {
    const c = result.cells[0]!;
    const p = resolveFpga(index, { kind: 'bit', index: c.bitOffset + 3 });
    expect(p.cells.has(`${c.x},${c.y},${c.k}`)).toBe(true);
    expect(p.lines.size).toBeGreaterThan(0);
    // A routing multiplexer bit gives the net that uses it.
    const net = result.nets.find((n) => n.nodes.length > 3)!;
    const node = net.nodes.find((n) => device.cfgOffset[n]! >= 0)!;
    const q = resolveFpga(index, { kind: 'bit', index: device.cfgOffset[node]! });
    expect(q.nets.size).toBeGreaterThan(0);
  });

  it('turns a gate of the logic view into cells (and back through the line)', () => {
    const gate = [...link.elements.entries()].find(([, e]) => e.cell >= 0 && e.kind === 'add');
    expect(gate).toBeDefined();
    const p = resolveFpga(index, { kind: 'element', id: gate![0] });
    expect(p.cells.size).toBeGreaterThan(0);
    expect(p.lines.size).toBeGreaterThan(0);
    // The line's probe contains the same gate.
    const line = [...p.lines][0]!;
    expect(resolveFpga(index, { kind: 'line', line }).elements.has(gate![0])).toBe(true);
  });

  it('turns a port into its pad tile and net', () => {
    const p = resolveFpga(index, { kind: 'port', name: 'enable' });
    expect(p.ports.has('enable')).toBe(true);
    expect(p.tiles.size).toBeGreaterThan(0);
    expect(p.nets.size).toBeGreaterThan(0);
    expect(whereIs(index, 'enable').pads.length).toBe(1);
  });

  it('has distinct keys for distinct refs', () => {
    const keys = [{ kind: 'line', line: 1 }, { kind: 'module', path: 'a' }, { kind: 'cell', x: 1, y: 2, k: 3 }, { kind: 'net', net: 3 }, { kind: 'bit', index: 4 }, { kind: 'port', name: 'p' }].map((r) => fpgaRefKey(r as never));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('follows a hierarchy: a child module selects only its own cells', () => {
    const h = flowOf('hier', 'Acc', 'S', HIER);
    expect(h.index.modulePaths.length).toBeGreaterThanOrEqual(2);
    const child = h.index.modulePaths.find((p) => p.includes('add'))!;
    expect(child).toBeDefined();
    const all = resolveFpga(h.index, { kind: 'module', path: h.index.modulePaths.find((p) => !p.includes('.'))! });
    const sub = resolveFpga(h.index, { kind: 'module', path: child });
    expect(sub.cells.size).toBeGreaterThan(0);
    expect(sub.cells.size).toBeLessThan(all.cells.size + 1);
    expect(sub.modules.has(child)).toBe(true);
  });
});
