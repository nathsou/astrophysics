import { describe, expect, it } from 'vitest';
import { getVFpga } from '../../pld/devices/vfpga';
import { readLc } from '../../pld/devices/vfpga-config';
import { HandDevice, XOR_GOAL, checkGoal, layoutRecovered, recover, xorSolution } from './hand';
import { flowOf } from './fixture.test-util';

const dev = getVFpga('S');

describe('by hand (vFPGA-S)', () => {
  it('starts empty and does not meet the goal', () => {
    const h = new HandDevice();
    expect(h.bits.every((b) => b === 0)).toBe(true);
    const c = checkGoal(dev, h.bits, XOR_GOAL);
    expect(c.ok).toBe(false);
    expect(c.problems.join(' ')).toMatch(/P2/);
    expect(c.rows).toHaveLength(4);
  });

  it('edits LUT bits, flags and pads, with undo and redo', () => {
    const h = new HandDevice();
    h.toggleLutBit(1, 2, 0, 5);
    expect(readLc(dev, h.bits, 1, 2, 0).lut).toBe(1 << 5);
    h.toggleLutBit(1, 2, 0, 5);
    expect(readLc(dev, h.bits, 1, 2, 0).lut).toBe(0);
    h.setLut(1, 2, 0, 0x6666);
    h.setFlag(1, 2, 0, 'ff', true);
    expect(readLc(dev, h.bits, 1, 2, 0)).toMatchObject({ lut: 0x6666, ff: true });
    const v = h.version;
    h.undo();
    expect(readLc(dev, h.bits, 1, 2, 0).ff).toBe(false);
    h.undo();
    expect(readLc(dev, h.bits, 1, 2, 0).lut).toBe(0);
    expect(h.version).toBeGreaterThan(v);
    h.redo();
    expect(readLc(dev, h.bits, 1, 2, 0).lut).toBe(0x6666);
    expect(h.canRedo).toBe(true);
    h.setLut(1, 2, 0, 0x6666); // no change: not recorded
    h.setPad('P2', true);
    expect(h.canRedo).toBe(false);
  });

  it('lists a multiplexer’s inputs and selects one', () => {
    const h = new HandDevice();
    const pin = dev.lcIn(1, 2, 0, 0);
    const choices = h.muxChoices(pin);
    expect(choices.length).toBeGreaterThan(4);
    expect(choices.every((c) => !c.selected)).toBe(true);
    h.select(pin, choices[2]!.node);
    const after = h.muxChoices(pin);
    expect(after.filter((c) => c.selected).map((c) => c.node)).toEqual([choices[2]!.node]);
    expect(h.usedNodes()).toContain(pin);
    h.select(pin, -1);
    expect(h.muxChoices(pin).some((c) => c.selected)).toBe(false);
    expect(h.muxChoices(dev.lcOut(1, 2, 0))).toEqual([]); // outputs have no multiplexer
    expect(() => h.select(pin, dev.lcOut(2, 2, 0))).toThrow(); // not one of its inputs
  });

  it('meets the XOR goal with the worked solution, and the check names what is missing along the way', () => {
    const bits = xorSolution(dev);
    const c = checkGoal(dev, bits, XOR_GOAL);
    expect(c.problems).toEqual([]);
    expect(c.rows.map((r) => r.got)).toEqual([0, 1, 1, 0]);
    expect(c.ok).toBe(true);

    // Without the pad set to output.
    const h = new HandDevice(dev, bits);
    h.setPad('P2', false);
    expect(checkGoal(dev, h.bits, XOR_GOAL).problems.join(' ')).toMatch(/input, not output/);
    // With the wrong function: AND.
    const h2 = new HandDevice(dev, bits);
    h2.setLut(1, 2, 0, 0x8888);
    const wrong = checkGoal(dev, h2.bits, XOR_GOAL);
    expect(wrong.ok).toBe(false);
    expect(wrong.rows.map((r) => r.ok)).toEqual([true, false, false, false]);
    // With the LUT’s second input disconnected.
    const h3 = new HandDevice(dev, bits);
    h3.select(dev.lcIn(1, 2, 0, 1), -1);
    expect(checkGoal(dev, h3.bits, XOR_GOAL).ok).toBe(false);
  });

  it('routes by shortest free path', () => {
    const h = new HandDevice();
    expect(h.autoRoute(dev.padIn(0), dev.lcIn(1, 2, 3, 2))).toBe(true);
    expect(h.usedNodes().length).toBeGreaterThan(1);
  });

  it('recovers the logic from the bits: pads, a LUT computing XOR, and the pad it drives', () => {
    const rec = recover(dev, xorSolution(dev));
    const lut = rec.nodes.find((n) => n.kind === 'lut')!;
    expect(lut.truth).toBe(0x6666);
    expect(lut.expression).toMatch(/P0 \^ P1|P1 \^ P0/);
    expect(lut.used).toEqual([0, 1]);
    expect(rec.nodes.filter((n) => n.kind === 'pad-in').map((n) => n.label).sort()).toEqual(['P0', 'P1']);
    const out = rec.nodes.find((n) => n.kind === 'pad-out')!;
    expect(out.label).toBe('P2');
    expect(rec.nodes[out.inputs[0]!]).toBe(lut);
    expect(rec.loops).toEqual([]);
    const lay = layoutRecovered(rec);
    expect(lay.col[rec.nodes.indexOf(lut)]).toBeGreaterThan(0);
    expect(lay.col[rec.nodes.indexOf(out)]).toBeGreaterThan(lay.col[rec.nodes.indexOf(lut)]!);
    for (const n of rec.nodes.filter((x) => x.kind === 'pad-in')) expect(lay.col[rec.nodes.indexOf(n)]).toBe(0);
  });

  it('recovers a placed and routed design and finds a loop made by hand', () => {
    const f = flowOf('counter', 'Counter', 'S');
    const rec = recover(f.device, f.result.bits);
    expect(rec.nodes.filter((n) => n.kind === 'lut').length).toBe(f.result.cells.length);
    expect(rec.nodes.filter((n) => n.kind === 'lut' && n.ff).length).toBe(4);
    expect(rec.loops).toEqual([]);
    const lay = layoutRecovered(rec);
    expect(lay.columns).toBeGreaterThan(2);
    // Two LUTs feeding each other, no flip-flop: a combinational loop.
    const h = new HandDevice();
    h.setLut(1, 1, 0, 0x5555); // NOT I0
    h.setLut(1, 1, 1, 0x5555);
    h.autoRoute(dev.lcOut(1, 1, 0), dev.lcIn(1, 1, 1, 0));
    h.autoRoute(dev.lcOut(1, 1, 1), dev.lcIn(1, 1, 0, 0));
    const r2 = recover(dev, h.bits);
    expect(r2.loops.length).toBeGreaterThan(0);
  });
});
