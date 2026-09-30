import { describe, expect, test } from 'vitest';
import type { Circuit } from '../../sim/netlist/types';
import { connect } from '../../sim/netlist/connect';
import { layoutOf } from '../editor/layout';
import { hitTest } from '../editor/hit';
import { GROUND, probeFromHit, probeLabel, probeNet, probePoint, renameInProbes, sameProbe } from './probes';

const c: Circuit = {
  version: 1,
  components: [
    { id: 'R1', type: 'resistor', x: 0, y: 0 },
    { id: 'R2', type: 'resistor', x: 8, y: 0 },
    { id: 'G1', type: 'ground', x: 12, y: 4 },
    { id: 'N1', type: 'label', x: 4, y: 6, params: { name: 'OUT' } },
  ],
  wires: [{ points: [[4, 0], [8, 0]] }, { points: [[12, 0], [12, 4]] }],
};
const conn = connect(c);

describe('probes', () => {
  test('a pin probe finds the net of that pin', () => {
    expect(probeNet({ pin: 'R1.2' }, c, conn)).toBe(conn.pinNet.get('R2.1'));
    expect(probeNet({ pin: 'R9.1' }, c, conn)).toBeUndefined();
  });
  test('a point on a wire finds the wire\'s net, including its interior', () => {
    expect(probeNet({ at: [6, 0] }, c, conn)).toBe(conn.pinNet.get('R1.2'));
    expect(probeNet({ at: [6, 2] }, c, conn)).toBeUndefined();
  });
  test('net names, ground and labels', () => {
    expect(probeNet(GROUND, c, conn)).toBe(conn.pinNet.get('G1.g'));
    expect(probeNet({ net: 'OUT' }, c, conn)).toBe(conn.pinNet.get('N1.n'));
    expect(probeNet({ net: 'nothing' }, c, conn)).toBeUndefined();
    expect(probeNet(undefined, c, conn)).toBeUndefined();
  });
  test('labels prefer the net name', () => {
    expect(probeLabel({ pin: 'R1.2' })).toBe('R1.2');
    expect(probeLabel({ pin: 'N1.n' }, conn, c)).toBe('OUT');
    expect(probeLabel({ at: [6, 0] })).toBe('(6, 0)');
    expect(probeLabel(GROUND)).toBe('GND');
    expect(probeLabel(undefined)).toBe('—');
  });
  test('clicks become probes: pins and wires yes, bodies no', () => {
    const l = layoutOf(c);
    expect(probeFromHit(hitTest(c, l, 4.2, 0.1))).toEqual({ pin: 'R1.2' });
    expect(probeFromHit(hitTest(c, l, 12, 2.1))).toEqual({ at: [12, 2] });
    expect(probeFromHit(hitTest(c, l, 2, 0.5))).toBeUndefined();
    expect(probeFromHit(undefined)).toBeUndefined();
  });
  test('marker positions', () => {
    const l = layoutOf(c);
    expect(probePoint({ pin: 'R2.2' }, l)).toEqual([12, 0]);
    expect(probePoint({ at: [3, 3] }, l)).toEqual([3, 3]);
    expect(probePoint({ net: 'GND' }, l)).toBeUndefined();
    expect(probePoint({ pin: 'X.1' }, l)).toBeUndefined();
  });
  test('equality', () => {
    expect(sameProbe({ pin: 'R1.1' }, { pin: 'R1.1' })).toBe(true);
    expect(sameProbe({ pin: 'R1.1' }, { at: [0, 0] })).toBe(false);
    expect(sameProbe({ at: [1, 2] }, { at: [1, 2] })).toBe(true);
    expect(sameProbe(undefined, undefined)).toBe(true);
  });
  test('renaming a part updates probes inside instrument settings', () => {
    const cfg = { channels: [{ probe: { pin: 'R1.2' } }, { probe: { pin: 'R10.1' } }, { probe: { at: [1, 1] } }], name: 'R1.2' };
    expect(renameInProbes(cfg, 'R1', 'RA')).toEqual({ channels: [{ probe: { pin: 'RA.2' } }, { probe: { pin: 'R10.1' } }, { probe: { at: [1, 1] } }], name: 'R1.2' });
  });
});
