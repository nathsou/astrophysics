import { describe, expect, test } from 'vitest';
import type { Circuit } from '../../sim/netlist/types';
import { connect } from '../../sim/netlist/connect';
import '../../sim/netlist/catalog';
import {
  addWire,
  cleanSpikes,
  duplicateSelection,
  emptySelection,
  extract,
  freeOffset,
  jog,
  mirrorSelection,
  moveSegment,
  moveSelection,
  normalise,
  paste,
  place,
  removeSelection,
  renameId,
  rerouteWire,
  rotateSelection,
  selectInBox,
  setLabel,
  setParam,
  uniqueId,
  type Selection,
} from './ops';
import { layoutOf, type Pt } from './layout';

const sel = (ids: string[], wires: number[] = []): Selection => ({ ids: new Set(ids), wires: new Set(wires) });
const empty = (): Circuit => ({ version: 1, components: [], wires: [] });

/** Are two pins on one net? */
function joined(c: Circuit, a: string, b: string): boolean {
  const { pinNet } = connect(c);
  return pinNet.get(a) !== undefined && pinNet.get(a) === pinNet.get(b);
}
const pinAt = (c: Circuit, id: string, pin: string): Pt => {
  const p = layoutOf(c).byId.get(id)!.pins.find((x) => x.pin === pin)!;
  return [p.x, p.y];
};
/** Every segment of every wire is horizontal or vertical. */
const orthogonal = (c: Circuit) => c.wires.every((w) => w.points.every((p, i) => i === 0 || p[0] === w.points[i - 1]![0] || p[1] === w.points[i - 1]![1]));

/** R1 — R2 in a row with a wire between: R1.2 at (4,0) to R2.1 at (8,0). */
function pair(): Circuit {
  return {
    version: 1,
    components: [
      { id: 'R1', type: 'resistor', x: 0, y: 0 },
      { id: 'R2', type: 'resistor', x: 8, y: 0 },
    ],
    wires: [{ points: [[4, 0], [8, 0]] }],
  };
}

describe('ids and placing', () => {
  test('unique ids use the part-type prefix and fill gaps', () => {
    let c = empty();
    for (let i = 0; i < 3; i++) c = place(c, 'resistor', i * 6, 0).circuit;
    expect(c.components.map((x) => x.id)).toEqual(['R1', 'R2', 'R3']);
    c = removeSelection(c, sel(['R2']));
    expect(uniqueId(c, 'resistor')).toBe('R2');
    expect(uniqueId(c, 'nand')).toBe('U1');
    expect(uniqueId(c, 'sub:foo')).toBe('X1');
  });

  test('place keeps only non-default parameters and names labels apart', () => {
    let r = place(empty(), 'resistor', 2, 2, { rot: 90, params: { resistance: 470 } });
    expect(r.circuit.components[0]).toEqual({ id: 'R1', type: 'resistor', x: 2, y: 2, rot: 90, params: { resistance: 470 } });
    r = place(r.circuit, 'label', 0, 8);
    r = place(r.circuit, 'label', 0, 10);
    expect(r.circuit.components.filter((c) => c.type === 'label').map((c) => c.params?.name)).toEqual(['A', 'B']);
  });

  test('placing a part with a pin on a wire splits the wire into a junction', () => {
    const base: Circuit = { version: 1, components: [], wires: [{ points: [[0, 0], [12, 0]] }] };
    const c = place(base, 'resistor', 4, 0).circuit;
    expect(c.wires.map((w) => w.points)).toEqual([[[0, 0], [4, 0]], [[4, 0], [8, 0]], [[8, 0], [12, 0]]]);
    expect(joined(c, 'R1.1', 'R1.1')).toBe(true);
  });
});

describe('normalise', () => {
  test('splits a wire at a T-junction and keeps the connectivity', () => {
    const c: Circuit = {
      version: 1,
      components: [
        { id: 'R1', type: 'resistor', x: 0, y: 0 },
        { id: 'R2', type: 'resistor', x: 12, y: 0 },
        { id: 'R3', type: 'resistor', x: 6, y: 4, rot: 90 },
      ],
      wires: [{ points: [[4, 0], [12, 0]] }, { points: [[6, 0], [6, 4]] }],
    };
    const n = normalise(c);
    expect(n.wires).toHaveLength(3);
    expect(joined(n, 'R1.2', 'R2.1')).toBe(true);
    expect(joined(n, 'R1.2', 'R3.1')).toBe(true);
    expect(connect(n).junctions).toEqual([[6, 0]]);
  });

  test('merges two wires that meet end to end, but not at a junction or a pin', () => {
    const two: Circuit = { version: 1, components: [], wires: [{ points: [[0, 0], [4, 0]] }, { points: [[4, 0], [4, 4]] }] };
    expect(normalise(two).wires.map((w) => w.points)).toEqual([[[0, 0], [4, 0], [4, 4]]]);
    const t: Circuit = { ...two, wires: [...two.wires, { points: [[4, 0], [8, 0]] }] };
    expect(normalise(t).wires).toHaveLength(3);
    const atPin: Circuit = { version: 1, components: [{ id: 'R1', type: 'resistor', x: 4, y: 0 }], wires: two.wires };
    expect(normalise(atPin).wires).toHaveLength(2);
  });

  test('drops zero-length wires and duplicates and merges collinear points', () => {
    const c: Circuit = { version: 1, components: [], wires: [{ points: [[0, 0], [0, 0]] }, { points: [[0, 0], [2, 0], [4, 0]] }, { points: [[4, 0], [0, 0]] }] };
    expect(normalise(c).wires.map((w) => w.points)).toEqual([[[0, 0], [4, 0]]]);
  });

  test('does not connect wires that only cross', () => {
    const c: Circuit = { version: 1, components: [], wires: [{ points: [[0, 2], [8, 2]] }, { points: [[4, 0], [4, 4]] }] };
    expect(normalise(c).wires).toHaveLength(2);
    expect(connect(normalise(c)).junctions).toEqual([]);
  });

  test('spurs are removed', () => {
    expect(cleanSpikes([[0, 0], [4, 0], [2, 0]])).toEqual([[0, 0], [2, 0]]);
    expect(cleanSpikes([[0, 2], [4, 2], [4, 0]])).toEqual([[0, 2], [4, 2], [4, 0]]);
  });
});

describe('wires', () => {
  test('addWire connects the pins it touches', () => {
    const c = addWire({ ...pair(), wires: [] }, [[4, 0], [8, 0]]);
    expect(joined(c, 'R1.2', 'R2.1')).toBe(true);
  });

  test('a wire ending on the middle of another connects (and splits) it', () => {
    const c0: Circuit = { version: 1, components: [{ id: 'R1', type: 'resistor', x: 0, y: 4, rot: 0 }, { id: 'R2', type: 'resistor', x: 12, y: 4 }], wires: [{ points: [[4, 4], [12, 4]] }] };
    const c = addWire(c0, [[8, 4], [8, 8]]);
    expect(c.wires).toHaveLength(3);
    expect(connect(c).junctions).toEqual([[8, 4]]);
  });

  test('moveSegment shifts a segment and keeps the ends', () => {
    const c: Circuit = { version: 1, components: [], wires: [{ points: [[0, 0], [0, 4], [8, 4], [8, 8]] }] };
    const r = moveSegment(c, 0, 1, 2);
    expect(r.circuit.wires[0]!.points).toEqual([[0, 0], [0, 6], [8, 6], [8, 8]]);
    expect(r.wire).toBe(0);
    // A straight wire moved sideways becomes a Z with both ends where they were.
    const s: Circuit = { version: 1, components: [], wires: [{ points: [[0, 0], [8, 0]] }] };
    expect(moveSegment(s, 0, 0, 3).circuit.wires[0]!.points).toEqual([[0, 0], [0, 3], [8, 3], [8, 0]]);
    // The first segment of an L: the start stays, a corner is added.
    const l: Circuit = { version: 1, components: [], wires: [{ points: [[0, 0], [8, 0], [8, 6]] }] };
    expect(moveSegment(l, 0, 0, 2).circuit.wires[0]!.points).toEqual([[0, 0], [0, 2], [8, 2], [8, 6]]);
  });
});

describe('redrawing a wire', () => {
  test('rerouteWire replaces a wandering wire by an L between its ends', () => {
    const c: Circuit = { version: 1, components: [], wires: [{ points: [[0, 0], [0, 6], [4, 6], [4, 2], [10, 2], [10, 4]] }] };
    expect(rerouteWire(c, 0, 'h').wires[0]!.points).toEqual([[0, 0], [10, 0], [10, 4]]);
    expect(rerouteWire(c, 0, 'v').wires[0]!.points).toEqual([[0, 0], [0, 4], [10, 4]]);
    expect(rerouteWire(c, 5)).toBe(c);
  });
});

describe('moving keeps wires attached', () => {
  test('moving one part drags the wire end along with a jog, all orthogonal', () => {
    const c = moveSelection(pair(), sel(['R2']), 2, 3);
    expect(joined(c, 'R1.2', 'R2.1')).toBe(true);
    expect(orthogonal(c)).toBe(true);
    expect(c.components.find((x) => x.id === 'R2')).toMatchObject({ x: 10, y: 3 });
    expect(c.wires).toHaveLength(1);
    expect(c.wires[0]!.points[0]).toEqual([4, 0]);
    expect(c.wires[0]!.points.at(-1)).toEqual([10, 3]);
  });

  test('moving along the wire just stretches it', () => {
    const c = moveSelection(pair(), sel(['R2']), 4, 0);
    expect(c.wires[0]!.points).toEqual([[4, 0], [12, 0]]);
  });

  test('moving both parts and the wire between them moves it wholesale', () => {
    const c = moveSelection(pair(), sel(['R1', 'R2']), 0, 4);
    expect(c.wires[0]!.points).toEqual([[4, 4], [8, 4]]);
    expect(joined(c, 'R1.2', 'R2.1')).toBe(true);
  });

  test('a moved pin drags every wire attached to it', () => {
    const c0: Circuit = {
      version: 1,
      components: [
        { id: 'R1', type: 'resistor', x: 0, y: 0 },
        { id: 'R2', type: 'resistor', x: 8, y: 0 },
        { id: 'R3', type: 'resistor', x: 8, y: 6 },
      ],
      wires: [{ points: [[4, 0], [8, 0]] }, { points: [[4, 0], [4, 6], [8, 6]] }],
    };
    const c = moveSelection(c0, sel(['R1']), 0, 2);
    expect(joined(c, 'R1.2', 'R2.1')).toBe(true);
    expect(joined(c, 'R1.2', 'R3.1')).toBe(true);
    expect(orthogonal(c)).toBe(true);
  });

  test('moves by zero change nothing; the input circuit is never mutated', () => {
    const c = pair();
    const snapshot = JSON.stringify(c);
    expect(moveSelection(c, sel(['R1']), 0, 0)).toBe(c);
    moveSelection(c, sel(['R1']), 3, 3);
    expect(JSON.stringify(c)).toBe(snapshot);
  });
});

describe('rotate and mirror', () => {
  test('rotating a part turns it clockwise about its origin and its wires follow', () => {
    const c = rotateSelection(pair(), sel(['R2']));
    const r2 = c.components.find((x) => x.id === 'R2')!;
    expect(r2).toMatchObject({ x: 8, y: 0, rot: 90 });
    expect(pinAt(c, 'R2', '1')).toEqual([8, 0]);
    expect(pinAt(c, 'R2', '2')).toEqual([8, 4]);
    expect(joined(c, 'R1.2', 'R2.1')).toBe(true);
  });

  test('four turns come back', () => {
    let c = pair();
    for (let i = 0; i < 4; i++) c = rotateSelection(c, sel(['R1']));
    expect(c.components[0]).toMatchObject({ x: 0, y: 0, rot: 0 });
  });

  test('a group rotates about its middle', () => {
    const c = rotateSelection(pair(), sel(['R1', 'R2'], [0]));
    expect(orthogonal(c)).toBe(true);
    expect(joined(c, 'R1.2', 'R2.1')).toBe(true);
    // R1 was to the left of R2 and is now above it.
    expect(pinAt(c, 'R1', '1')[1]).toBeLessThan(pinAt(c, 'R2', '1')[1]);
  });

  test('mirroring left–right puts the far pin on the other side of a single part', () => {
    const c = mirrorSelection(pair(), sel(['R1']));
    expect(pinAt(c, 'R1', '1')).toEqual([0, 0]);
    expect(pinAt(c, 'R1', '2')).toEqual([-4, 0]);
    expect(c.components[0]).toMatchObject({ flip: true, rot: 0 });
    expect(joined(c, 'R1.2', 'R2.1')).toBe(true);
  });

  test('mirroring a vertical part left–right keeps it vertical, and twice is the identity', () => {
    const c0: Circuit = { version: 1, components: [{ id: 'D1', type: 'diode', x: 6, y: 0, rot: 90 }], wires: [] };
    const once = mirrorSelection(c0, sel(['D1']));
    expect(pinAt(once, 'D1', 'K')).toEqual([6, 4]);
    const twice = mirrorSelection(once, sel(['D1']));
    expect(pinAt(twice, 'D1', 'K')).toEqual(pinAt(c0, 'D1', 'K'));
    expect(pinAt(twice, 'D1', 'A')).toEqual(pinAt(c0, 'D1', 'A'));
  });

  test('mirroring top–bottom swaps the pins of a vertical part', () => {
    const c0: Circuit = { version: 1, components: [{ id: 'D1', type: 'diode', x: 6, y: 0, rot: 90 }], wires: [] };
    const c = mirrorSelection(c0, sel(['D1']), 'y');
    expect(pinAt(c, 'D1', 'A')).toEqual([6, 0]);
    expect(pinAt(c, 'D1', 'K')).toEqual([6, -4]);
  });

  test('a mirrored part on a rotated part mirrors as seen on screen (all four rotations)', () => {
    for (const rot of [0, 90, 180, 270] as const) {
      const c0: Circuit = { version: 1, components: [{ id: 'Q1', type: 'npn', x: 10, y: 10, rot, flip: false }], wires: [] };
      const c = mirrorSelection(c0, sel(['Q1']));
      const before = layoutOf(c0).byId.get('Q1')!.pins;
      const after = layoutOf(c).byId.get('Q1')!.pins;
      for (const p of before) {
        const q = after.find((x) => x.pin === p.pin)!;
        expect([q.x, q.y]).toEqual([20 - p.x, p.y]);
      }
    }
  });
});

describe('deleting', () => {
  test('deleting a part removes the wires that only hung from it', () => {
    const c = removeSelection(pair(), sel(['R2']));
    expect(c.components.map((x) => x.id)).toEqual(['R1']);
    expect(c.wires).toEqual([]);
  });

  test('deleting a part leaves a wire that still joins something else', () => {
    const c0: Circuit = {
      version: 1,
      components: [
        { id: 'R1', type: 'resistor', x: 0, y: 0 },
        { id: 'R2', type: 'resistor', x: 8, y: 0 },
        { id: 'R3', type: 'resistor', x: 8, y: 6 },
      ],
      wires: [{ points: [[4, 0], [8, 0]] }, { points: [[4, 0], [4, 6], [8, 6]] }],
    };
    const c = removeSelection(c0, sel(['R2']));
    expect(joined(c, 'R1.2', 'R3.1')).toBe(true);
    expect(c.wires).toHaveLength(1);
    expect(c.wires[0]!.points).toEqual([[4, 0], [4, 6], [8, 6]]);
  });

  test('deleting the middle of a T merges what is left of the run', () => {
    const c0: Circuit = {
      version: 1,
      components: [
        { id: 'R1', type: 'resistor', x: 0, y: 0 },
        { id: 'R2', type: 'resistor', x: 12, y: 0 },
        { id: 'R3', type: 'resistor', x: 6, y: 4, rot: 90 },
      ],
      wires: [{ points: [[4, 0], [6, 0]] }, { points: [[6, 0], [12, 0]] }, { points: [[6, 0], [6, 4]] }],
    };
    const c = removeSelection(c0, sel(['R3']));
    expect(c.wires.map((w) => w.points)).toEqual([[[4, 0], [12, 0]]]);
  });

  test('a selected wire is deleted on its own', () => {
    const c = removeSelection(pair(), sel([], [0]));
    expect(c.wires).toEqual([]);
    expect(c.components).toHaveLength(2);
  });

  test('deleting nothing changes nothing observable', () => {
    const c = removeSelection(pair(), emptySelection);
    expect(c.components).toHaveLength(2);
    expect(c.wires).toHaveLength(1);
  });
});

describe('duplicate and paste', () => {
  test('duplicating copies parts with new ids, and the wires between them', () => {
    const r = duplicateSelection(pair(), sel(['R1', 'R2']), 0, 6);
    expect(r.ids).toEqual(['R3', 'R4']);
    expect(r.circuit.components.find((c) => c.id === 'R3')).toMatchObject({ x: 0, y: 6 });
    expect(r.circuit.wires).toHaveLength(2);
    expect(joined(r.circuit, 'R3.2', 'R4.1')).toBe(true);
    expect(joined(r.circuit, 'R1.2', 'R3.2')).toBe(false);
  });

  test('a copy never lands on a wire or a pin of the circuit it came from', () => {
    // R1 and R2 with a wire between; the +2,+2 copy of R1 would put its pin on that wire.
    const c: Circuit = {
      version: 1,
      components: [
        { id: 'R1', type: 'resistor', x: 0, y: 0 },
        { id: 'R2', type: 'resistor', x: 8, y: 0 },
        { id: 'R3', type: 'resistor', x: 0, y: 2 },
      ],
      wires: [{ points: [[4, 0], [8, 0]] }],
    };
    const r = duplicateSelection(c, sel(['R1']), 2, 2);
    const added = r.circuit.components.find((x) => x.id === r.ids[0])!;
    for (const p of layoutOf(r.circuit).byId.get(added.id)!.pins) {
      expect(r.circuit.components.filter((x) => x.id !== added.id).every((x) => layoutOf(r.circuit).byId.get(x.id)!.pins.every((q) => q.x !== p.x || q.y !== p.y))).toBe(true);
    }
    // Nothing got connected to the copy.
    expect(joined(r.circuit, `${added.id}.1`, 'R1.1')).toBe(false);
    expect(joined(r.circuit, `${added.id}.2`, 'R1.2')).toBe(false);
    expect(r.circuit.wires).toHaveLength(1);
  });

  test('a part put where another one already is steps aside', () => {
    const c: Circuit = { version: 1, components: [{ id: 'R1', type: 'resistor', x: 10, y: 10 }], wires: [] };
    const frag = { components: [{ id: '_', type: 'resistor', x: 10, y: 10 }], wires: [] };
    expect(freeOffset(c, frag, 0, 0)).not.toEqual([0, 0]);
    const empty: Circuit = { version: 1, components: [], wires: [] };
    expect(freeOffset(empty, frag, 0, 0)).toEqual([0, 0]);
    const [dx, dy] = freeOffset(c, frag, 0, 0);
    const moved = layoutOf({ ...c, components: [{ id: 'R2', type: 'resistor', x: 10 + dx, y: 10 + dy }] }).byId.get('R2')!.box;
    const orig = layoutOf(c).byId.get('R1')!.box;
    expect(moved.x0 >= orig.x1 || moved.x1 <= orig.x0 || moved.y0 >= orig.y1 || moved.y1 <= orig.y0).toBe(true);
  });

  test('a single part does not take the wire with it', () => {
    const r = duplicateSelection(pair(), sel(['R1']), 2, 2);
    expect(r.circuit.wires).toHaveLength(1);
  });

  test('paste twice gives distinct ids; custom labels survive, default ones do not', () => {
    const c0: Circuit = { version: 1, components: [{ id: 'R1', type: 'resistor', x: 0, y: 0, label: 'load' }, { id: 'R2', type: 'resistor', x: 0, y: 4, label: 'R2' }], wires: [] };
    const frag = extract(c0, sel(['R1', 'R2']));
    const a = paste(c0, frag, 8, 0);
    const b = paste(a.circuit, frag, 16, 0);
    expect(new Set(b.circuit.components.map((c) => c.id)).size).toBe(6);
    expect(a.circuit.components.find((c) => c.id === a.ids[0])!.label).toBe('load');
    expect(a.circuit.components.find((c) => c.id === a.ids[1])!.label).toBeUndefined();
  });
});

describe('properties', () => {
  test('setParam stores only differences from the default', () => {
    let c = setParam(pair(), 'R1', 'resistance', 4700);
    expect(c.components[0]!.params).toEqual({ resistance: 4700 });
    c = setParam(c, 'R1', 'resistance', 1000);
    expect(c.components[0]!.params).toBeUndefined();
  });

  test('changing a gate\'s input count keeps its wires on the moved output pin', () => {
    const c0: Circuit = {
      version: 1,
      components: [
        { id: 'U1', type: 'and', x: 0, y: 0 },
        { id: 'IN1', type: 'toggle', x: -8, y: 0 },
        { id: 'OUT1', type: 'indicator', x: 12, y: 1 },
      ],
      wires: [{ points: [[6, 1], [12, 1]] }, { points: [[-5, 0], [0, 0]] }],
    };
    const c = setParam(c0, 'U1', 'inputs', 4);
    expect(joined(c, 'U1.Y', 'OUT1.A')).toBe(true);
    expect(pinAt(c, 'U1', 'Y')).toEqual([6, 3]);
    expect(joined(c, 'U1.A', 'IN1.Y')).toBe(true);
    expect(orthogonal(c)).toBe(true);
  });

  test('labels and renaming', () => {
    expect(setLabel(pair(), 'R1', 'pull-up').components[0]!.label).toBe('pull-up');
    expect('label' in setLabel(setLabel(pair(), 'R1', 'x'), 'R1', undefined).components[0]!).toBe(false);
    expect(renameId(pair(), 'R1', 'RA').components[0]!.id).toBe('RA');
    const same = pair();
    expect(renameId(same, 'R1', 'R2')).toBe(same);
    expect(renameId(same, 'R1', '  ')).toBe(same);
  });
});

describe('selecting by rectangle', () => {
  test('parts that meet the box and wires wholly inside it', () => {
    const c = pair();
    expect([...selectInBox(c, { x0: -1, y0: -2, x1: 5, y1: 2 }).ids]).toEqual(['R1']);
    const all = selectInBox(c, { x0: -1, y0: -2, x1: 13, y1: 2 });
    expect([...all.ids].sort()).toEqual(['R1', 'R2']);
    expect([...all.wires]).toEqual([0]);
    expect(selectInBox(c, { x0: 5, y0: -1, x1: 7, y1: 1 }).wires.size).toBe(0);
  });
});

describe('jog', () => {
  test('keeps the first segment orientation', () => {
    expect(jog([[0, 0], [8, 0]], [0, 3], true)).toEqual([[0, 3], [8, 3], [8, 0]]);
    expect(jog([[0, 0], [0, 8]], [3, 0], true)).toEqual([[3, 0], [3, 8], [0, 8]].slice(0, 3).length ? [[3, 0], [3, 8], [0, 8]] : []);
  });
});

describe('normalise keeps every committed circuit electrically identical', () => {
  const files = import.meta.glob<Circuit>(['../examples/*.json', '/content/chapters/*/circuits/*.json'], { eager: true, import: 'default' });

  /** The partition of pins into nets, as a sorted list of sorted groups. */
  const partition = (c: Circuit) => {
    const { pinNet } = connect(c);
    const groups = new Map<number, string[]>();
    for (const [pin, net] of pinNet) groups.set(net, [...(groups.get(net) ?? []), pin]);
    return [...groups.values()].map((g) => g.sort()).sort((a, b) => a[0]!.localeCompare(b[0]!));
  };

  test('there are circuits to check', () => {
    expect(Object.keys(files).length).toBeGreaterThan(3);
  });

  for (const [path, circuit] of Object.entries(files)) {
    test(path.replace(/^.*\/(?=[^/]+\/circuits|examples)/, ''), () => {
      const n = normalise(circuit);
      expect(partition(n)).toEqual(partition(circuit));
      expect(n.wires.every((w) => w.points.length >= 2)).toBe(true);
      // Idempotent.
      expect(normalise(n).wires).toEqual(n.wires);
    });
  }
});

describe('circuits with subcircuits', () => {
  const sub: Circuit = {
    version: 1,
    title: 'Inverter pair',
    components: [
      { id: 'pA', type: 'port', x: 0, y: 0, params: { name: 'A', dir: 'in' } },
      { id: 'pY', type: 'port', x: 10, y: 0, params: { name: 'Y', dir: 'out' } },
    ],
    wires: [],
  };
  const c: Circuit = {
    version: 1,
    components: [
      { id: 'IN1', type: 'toggle', x: 0, y: 0 },
      { id: 'X1', type: 'sub:inv2', x: 8, y: 0 },
    ],
    wires: [{ points: [[3, 0], [8, 0]] }],
    subcircuits: { inv2: sub },
  };

  test('a subcircuit block moves, rotates and deletes like any part, and its wires follow', () => {
    const moved = moveSelection(c, sel(['X1']), 0, 4);
    expect(joined(moved, 'IN1.Y', 'X1.A')).toBe(true);
    expect(moved.wires).toHaveLength(1);
    const turned = rotateSelection(c, sel(['X1']));
    expect(turned.components.find((x) => x.id === 'X1')!.rot).toBe(90);
    expect(joined(turned, 'IN1.Y', 'X1.A')).toBe(true);
    expect(removeSelection(c, sel(['X1'])).wires).toEqual([]);
  });

  test('normalise, place and duplicate keep the subcircuit definitions', () => {
    expect(normalise(c).subcircuits).toBe(c.subcircuits);
    const r = duplicateSelection(c, sel(['X1']));
    expect(r.circuit.components.find((x) => x.id === r.ids[0])!.type).toBe('sub:inv2');
    expect(r.circuit.subcircuits).toBe(c.subcircuits);
  });
});
