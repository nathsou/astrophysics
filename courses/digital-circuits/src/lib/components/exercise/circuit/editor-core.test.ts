import { describe, expect, test } from 'vitest';
import { EditorCore } from './editor-core';
import { portsStart, runCheck, startCircuit, violations, golfScore, golfName, type BuildInput } from './spec';
import { partsResolver } from '$lib/partsbin/store-core';
import { referenceOf } from '$lib/partsbin/parts';

const halfAdderInput: BuildInput = {
  id: 'ha',
  spec: { truthTable: { inputs: ['A', 'B'], outputs: ['S', 'C'], rows: ['00 00', '01 10', '10 10', '11 01'] } },
  allowed: ['and', 'or', 'not', 'xor'],
};

function solve(): EditorCore {
  const ed = new EditorCore(startCircuit(halfAdderInput), { locked: (c) => c.type === 'port' });
  const x = ed.place('xor');
  const a = ed.place('and');
  const pins = (id: string) => ed.pins().filter((p) => p.comp === id).map((p) => p.ref);
  expect(pins(x)).toEqual([`${x}.A`, `${x}.B`, `${x}.Y`].filter((r) => pins(x).includes(r)));
  ed.connect('A.p', `${x}.A`);
  ed.connect('B.p', `${x}.B`);
  ed.connect('A.p', `${a}.A`);
  ed.connect('B.p', `${a}.B`);
  ed.connect(`${x}.Y`, 'S.p');
  ed.connect(`${a}.Y`, 'C.p');
  return ed;
}

describe('start circuit', () => {
  test('ports for the spec’s pins', () => {
    const c = startCircuit(halfAdderInput);
    expect(c.components.map((x) => `${x.id}:${x.params?.dir}`)).toEqual(['A:in', 'B:in', 'S:out', 'C:out']);
    expect(portsStart(['X'], ['Y']).components).toHaveLength(2);
  });
  test('from a part', () => {
    const c = startCircuit({ id: 'x', part: 'full-adder' });
    expect(c.components.filter((x) => x.params?.dir === 'in').map((x) => x.id)).toEqual(['A', 'B', 'CIN']);
  });
  test('from an FSM adds the clock', () => {
    const c = startCircuit({ id: 'f', spec: { fsm: { inputs: ['X'], outputs: ['Z'], initial: 'a', states: { a: { out: '0', next: { '0': 'a', '1': 'a' } } } } } });
    expect(c.components.filter((x) => x.params?.dir === 'in').map((x) => x.id)).toEqual(['X', 'CLK']);
  });
});

describe('editing', () => {
  test('an empty start fails, a wired half adder passes', () => {
    const empty = runCheck(halfAdderInput, startCircuit(halfAdderInput));
    expect(empty.pass).toBe(false);
    const ed = solve();
    const r = runCheck(halfAdderInput, ed.circuit);
    expect(r.problems).toEqual([]);
    expect(r.pass).toBe(true);
    expect(r.cost).toMatchObject({ gates: 2 });
  });
  test('undo and redo', () => {
    const ed = new EditorCore(startCircuit(halfAdderInput));
    const n = ed.circuit.components.length;
    ed.place('and');
    expect(ed.circuit.components).toHaveLength(n + 1);
    ed.undo();
    expect(ed.circuit.components).toHaveLength(n);
    expect(ed.canRedo).toBe(true);
    ed.redo();
    expect(ed.circuit.components).toHaveLength(n + 1);
  });
  test('locked parts stay when deleting', () => {
    const ed = new EditorCore(startCircuit(halfAdderInput), { locked: (c) => c.type === 'port' });
    ed.select(['A']);
    ed.remove();
    expect(ed.circuit.components.some((c) => c.id === 'A')).toBe(true);
    const g = ed.place('and');
    ed.remove();
    expect(ed.circuit.components.some((c) => c.id === g)).toBe(false);
  });
  test('new parts do not land on top of each other', () => {
    const ed = new EditorCore(startCircuit(halfAdderInput));
    const a = ed.place('and');
    const b = ed.place('and');
    const ca = ed.circuit.components.find((c) => c.id === a)!;
    const cb = ed.circuit.components.find((c) => c.id === b)!;
    expect(ca.x === cb.x && ca.y === cb.y).toBe(false);
  });
  test('moving keeps wires attached; rotating and swapping types work', () => {
    const ed = solve();
    const before = ed.circuit.wires.length;
    ed.select(['U1']);
    ed.nudge(2, 0);
    expect(runCheck(halfAdderInput, ed.circuit).pass).toBe(true);
    expect(ed.circuit.wires.length).toBeGreaterThanOrEqual(before - 1);
    expect(ed.swapType('U2', 'or')).toBe(true);
    expect(runCheck(halfAdderInput, ed.circuit).pass).toBe(false);
    expect(ed.swapType('U2', 'not')).toBe(false); // different pins
    ed.undo();
    expect(runCheck(halfAdderInput, ed.circuit).pass).toBe(true);
    ed.select(['U1']);
    ed.rotate();
    expect(ed.circuit.components.find((c) => c.id === 'U1')!.rot).toBe(90);
  });
  test('removing a wire', () => {
    const ed = solve();
    const n = ed.circuit.wires.length;
    ed.removeWire(0);
    expect(ed.circuit.wires.length).toBeLessThan(n);
    expect(runCheck(halfAdderInput, ed.circuit).pass).toBe(false);
  });
  test('parts from the bin can be placed and wired', () => {
    const parts = partsResolver(false);
    const input: BuildInput = { id: 'fa', part: 'half-adder', allowed: ['part:*'] };
    const ed = new EditorCore(startCircuit(input), { parts });
    const x = ed.place('part:half-adder');
    ed.connect('A.p', `${x}.A`);
    ed.connect('B.p', `${x}.B`);
    ed.connect(`${x}.S`, 'S.p');
    ed.connect(`${x}.C`, 'C.p');
    const r = runCheck(input, ed.circuit, parts);
    expect(r.problems).toEqual([]);
    expect(r.pass).toBe(true);
  });
});

describe('rules', () => {
  test('allowed parts and budget', () => {
    const ed = solve();
    expect(violations(halfAdderInput, ed.circuit)).toEqual([]);
    const strict: BuildInput = { ...halfAdderInput, allowed: ['and', 'or', 'not'], budget: { gates: 1 } };
    const r = runCheck(strict, ed.circuit);
    expect(r.correct).toBe(true);
    expect(r.pass).toBe(false);
    expect(r.violations.join(' ')).toMatch(/Not allowed here: xor/);
    expect(r.violations.join(' ')).toMatch(/Uses 2 gates; the budget is 1/);
    expect(r.headline).toMatch(/rule/);
  });
  test('part:* allows parts', () => {
    expect(violations({ id: 'x', allowed: ['and'] }, { version: 1, components: [{ id: 'X', type: 'part:xor', x: 0, y: 0 }], wires: [] })).toHaveLength(1);
    expect(violations({ id: 'x', allowed: ['part:*'] }, { version: 1, components: [{ id: 'X', type: 'part:xor', x: 0, y: 0 }], wires: [] })).toEqual([]);
  });
});

describe('golf', () => {
  test('names and scores', () => {
    expect(golfName(-1)).toBe('Birdie');
    expect(golfName(0)).toBe('Par');
    expect(golfName(5)).toBe('+5');
    expect(golfName(-4)).toBe('Albatross');
    expect(golfScore({ par: 4, metric: 'gates' }, { gates: 3, transistors: 12, depth: 2, byType: {} })).toMatchObject({ strokes: -1, name: 'Birdie' });
    expect(golfScore({ par: 20, metric: 'transistors' }, { gates: 3, transistors: 22, depth: 2, byType: {} })).toMatchObject({ strokes: 2, name: 'Double bogey' });
    expect(golfScore({}, { gates: 3, transistors: 12, depth: 2, byType: {} })).toBeUndefined();
  });
});

describe('other spec kinds', () => {
  test('a reference part id as spec', () => {
    const input: BuildInput = { id: 'r', spec: { reference: 'half-adder' }, allowed: ['part:*'] };
    const parts = partsResolver(false);
    const c = referenceOf('half-adder')!;
    expect(runCheck(input, c, parts).pass).toBe(true);
  });
  test('scenarios', () => {
    const input: BuildInput = { id: 's', allowed: ['battery', 'switch', 'resistor', 'led'], spec: { scenarios: [{ set: { S1: true }, expect: { D1: 'lit' } }] } };
    const c = {
      version: 1 as const,
      engine: 'analog' as const,
      components: [
        { id: 'B1', type: 'battery', x: 4, y: 10, rot: 270 as const, params: { voltage: 9 } },
        { id: 'S1', type: 'switch', x: 8, y: 2 },
        { id: 'R1', type: 'resistor', x: 14, y: 2 },
        { id: 'D1', type: 'led', x: 24, y: 4, rot: 90 as const },
        { id: 'G1', type: 'ground', x: 4, y: 12 },
      ],
      wires: [
        { points: [[4, 6], [4, 2], [8, 2]] as [number, number][] },
        { points: [[12, 2], [14, 2]] as [number, number][] },
        { points: [[18, 2], [24, 2], [24, 4]] as [number, number][] },
        { points: [[24, 8], [24, 12], [4, 12], [4, 10]] as [number, number][] },
      ],
    };
    expect(runCheck(input, c).pass).toBe(true);
    c.components[3]!.rot = 270;
    expect(runCheck(input, c).pass).toBe(false);
  });
  test('a state machine', () => {
    const input: BuildInput = {
      id: 'f',
      spec: { fsm: { type: 'moore', inputs: ['T'], outputs: ['Q'], initial: 'off', states: { off: { out: '0', next: { '0': 'off', '1': 'on' } }, on: { out: '1', next: { '0': 'on', '1': 'off' } } } } },
      allowed: ['tff'],
    };
    const ed = new EditorCore(startCircuit(input));
    const t = ed.place('tff');
    ed.connect('T.p', `${t}.T`);
    ed.connect('CLK.p', `${t}.CLK`);
    ed.connect(`${t}.Q`, 'Q.p');
    const r = runCheck(input, ed.circuit);
    expect(r.problems).toEqual([]);
    expect(r.pass).toBe(true);
    expect(r.seq!.proven).toBe(true);
  });
});
