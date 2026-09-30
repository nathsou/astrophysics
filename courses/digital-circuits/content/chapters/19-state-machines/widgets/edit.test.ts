import { describe, expect, test } from 'vitest';
import { validate } from './fsm';
import { addInput, addOutput, addState, addTransition, defaultTransition, freshName, makeReset, moveState, removeInput, removeOutput, removeState, removeTransition, renameState, setPatternChar, setStateOutput, setTransitionOutput } from './edit';
import { BLANK, TRAFFIC_LIGHT, VENDING } from './presets';

describe('states', () => {
  test('a fresh name is never a duplicate, whatever the case', () => {
    expect(freshName(BLANK)).toBe('S0');
    expect(freshName({ ...BLANK, states: [{ name: 's0', out: '0' }] })).toBe('S1');
  });
  test('add and remove: arrows go with a removed state', () => {
    const a = addState(TRAFFIC_LIGHT);
    expect(a.states.map((s) => s.name)).toEqual(['Red', 'RedAmber', 'Green', 'Amber', 'S0']);
    expect(a.states[4]!.out).toBe('000');
    const r = removeState(a, 'Green');
    expect(r.transitions.every((t) => t.from !== 'Green' && t.to !== 'Green')).toBe(true);
    expect(r.transitions).toHaveLength(2);
    expect(removeState({ ...BLANK, states: [BLANK.states[0]!] }, 'Off').states).toHaveLength(1);
  });
  test('the number of states is capped', () => {
    let f = TRAFFIC_LIGHT;
    for (let i = 0; i < 20; i++) f = addState(f);
    expect(f.states).toHaveLength(12);
  });
  test('renaming carries the arrows and refuses duplicates', () => {
    const r = renameState(TRAFFIC_LIGHT, 'Green', 'Go');
    expect(r.states[2]!.name).toBe('Go');
    expect(r.transitions.find((t) => t.to === 'Go')!.from).toBe('RedAmber');
    expect(validate(r)).toEqual([]);
    expect(renameState(TRAFFIC_LIGHT, 'Green', 'red')).toBe(TRAFFIC_LIGHT);
    expect(renameState(TRAFFIC_LIGHT, 'Green', '  ')).toBe(TRAFFIC_LIGHT);
  });
  test('reset and order', () => {
    expect(makeReset(TRAFFIC_LIGHT, 'Green').states.map((s) => s.name)).toEqual(['Green', 'Red', 'RedAmber', 'Amber']);
    expect(moveState(TRAFFIC_LIGHT, 'Red', 1).states.map((s) => s.name)).toEqual(['RedAmber', 'Red', 'Green', 'Amber']);
    expect(moveState(TRAFFIC_LIGHT, 'Red', -1)).toBe(TRAFFIC_LIGHT);
  });
  test('state outputs', () => {
    expect(setStateOutput(TRAFFIC_LIGHT, 'Amber', 0, true).states[3]!.out).toBe('110');
  });
});

describe('arrows', () => {
  test('add, drop duplicates, remove', () => {
    let f = addTransition(BLANK, { from: 'Off', to: 'Off', when: '0' });
    expect(f.transitions).toHaveLength(3);
    expect(addTransition(f, { from: 'Off', to: 'Off', when: '0' })).toBe(f);
    f = removeTransition(f, 0);
    expect(f.transitions).toHaveLength(2);
  });
  test('Mealy arrows carry outputs', () => {
    const f = addTransition(VENDING, { from: 'Empty', to: 'Empty', when: '00' });
    expect(f.transitions.at(-1)!.out).toBe('0');
    expect(setTransitionOutput(f, f.transitions.length - 1, 0, true).transitions.at(-1)!.out).toBe('1');
  });
  test('default and pattern editing', () => {
    expect(defaultTransition(VENDING)).toEqual({ from: 'Empty', to: 'Has5', when: '--', out: '0' });
    expect(setPatternChar('--', 1, '1')).toBe('-1');
  });
});

describe('ports', () => {
  test('a new input is a don’t-care in every pattern; removing one takes its column', () => {
    const a = addInput(TRAFFIC_LIGHT, 'enable');
    expect(a.transitions.every((t) => t.when === '1-')).toBe(true);
    expect(validate(a).filter((p) => p.level === 'error')).toEqual([]);
    expect(removeInput(a, 0).transitions.every((t) => t.when === '-')).toBe(true);
  });
  test('outputs are added and removed across states and Mealy arrows', () => {
    const a = addOutput(TRAFFIC_LIGHT, 'walk');
    expect(a.states.every((s) => s.out.length === 4)).toBe(true);
    const m = removeOutput(addOutput(VENDING, 'change'), 1);
    expect(m.outputs).toEqual(['dispense']);
    expect(m.transitions.every((t) => t.out!.length === 1)).toBe(true);
  });
  test('the last output stays', () => {
    expect(removeOutput(BLANK, 0)).toBe(BLANK);
  });
});
