import { describe, expect, test } from 'vitest';
import { exerciseClock, pinsOfSpec, type BuildInput } from './spec';

describe('the clock of an exercise', () => {
  test('a part with a clocked check is driven by its CLK', () => {
    expect(exerciseClock({ id: 't', part: 'd-flip-flop' })).toBe('CLK');
    expect(exerciseClock({ id: 't', part: 'counter' })).toBe('CLK');
  });
  test('latches and combinational parts have no clock, and an input called C is data', () => {
    expect(exerciseClock({ id: 't', part: 'd-latch' })).toBeUndefined();
    expect(exerciseClock({ id: 't', part: 'half-adder' })).toBeUndefined();
    const comb: BuildInput = { id: 't', spec: { truthTable: { inputs: ['A', 'B', 'C'], outputs: ['Y'], rows: ['000 0', '111 1'] } } };
    expect(exerciseClock(comb)).toBeUndefined();
  });
  test('an fsm exercise is clocked by CLK unless it says otherwise', () => {
    const fsm = { inputs: ['C'], outputs: ['Z'], initial: 'a', states: { a: { out: '0', next: { '-': 'a' } } } };
    expect(exerciseClock({ id: 't', spec: { fsm } })).toBe('CLK');
    expect(pinsOfSpec({ id: 't', spec: { fsm } })?.inputs).toEqual(['C', 'CLK']);
    expect(exerciseClock({ id: 't', spec: { fsm, clock: 'phi' } })).toBe('phi');
    expect(exerciseClock({ id: 't', spec: { fsm, clock: false } })).toBeUndefined();
  });
});
