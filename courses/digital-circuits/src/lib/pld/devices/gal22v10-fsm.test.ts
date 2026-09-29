import { describe, expect, test } from 'vitest';
import { mulberry32 } from '../twolevel/random';
import { Gal22v10 } from './gal22v10';
import { fitGal22v10, pinLevelsFor } from './gal22v10-fit';
import { FsmError, fsmToGalDesign, type GalFsm } from './gal22v10-fsm';

const TRAFFIC: GalFsm = {
  title: 'Traffic lights',
  signature: 'TL',
  inputs: ['CAR', 'T'],
  states: ['MainGreen', 'MainAmber', 'SideGreen', 'SideAmber'],
  transitions: [
    { from: 'MainGreen', to: 'MainAmber', when: 'CAR & T' },
    { from: 'MainAmber', to: 'SideGreen' },
    { from: 'SideGreen', to: 'SideAmber', when: '!CAR | T' },
    { from: 'SideAmber', to: 'MainGreen' },
  ],
  outputs: [
    { name: 'MG', states: ['MainGreen'] },
    { name: 'MA', states: ['MainAmber'] },
    { name: 'MR', states: ['SideGreen', 'SideAmber'] },
    { name: 'SG', states: ['SideGreen'] },
    { name: 'SA', states: ['SideAmber'] },
    { name: 'SR', states: ['MainGreen', 'MainAmber'] },
    { name: 'BOTH', expr: 'CAR & T & MG' }, // a Mealy-style output using another output as an input
  ],
  resetInput: 'RST',
};

/** An independent table-driven model of the machine. */
function step(fsm: GalFsm, state: string, inputs: Record<string, number>): string {
  for (const t of fsm.transitions.filter((x) => x.from === state)) {
    const g = t.when ?? '1';
    // Guards used here are simple: evaluate with Function over the input names.
    const f = new Function(...Object.keys(inputs), `return (${g.replace(/!/g, '!').replace(/&/g, '&&').replace(/\|/g, '||')}) ? 1 : 0;`);
    if (f(...Object.values(inputs))) return t.to;
  }
  return state;
}

describe('FSM to GAL22V10', () => {
  for (const encoding of ['binary', 'gray', 'one-hot'] as const) {
    test(`traffic-light machine, ${encoding} encoding: the chip follows the table on random input sequences`, () => {
      // One-hot needs 4 state bits, leaving room for only 6 more outputs.
      const d = fsmToGalDesign({ ...TRAFFIC, encoding, outputs: TRAFFIC.outputs!.slice(0, encoding === 'one-hot' ? 6 : 7) });
      const fit = fitGal22v10(d.design);
      const g = new Gal22v10(fit.fuses);
      const rng = mulberry32(7);
      let state = 'MainGreen'; // reset state = power-up state
      const stateOf = (s: { pins: ArrayLike<number> }) => {
        let code = 0;
        for (const b of d.stateBits) code = code * 2 + (s.pins[fit.pinOf[b]!] ? 1 : 0);
        return Object.entries(d.codes).find(([, c]) => c === code)?.[0];
      };
      expect(stateOf(g.evaluate({}))).toBe(state);
      for (let t = 0; t < 300; t++) {
        const inputs = { CAR: rng.chance(0.5) ? 1 : 0, T: rng.chance(0.5) ? 1 : 0, RST: rng.chance(0.05) ? 1 : 0 };
        if (inputs.RST) {
          const s = g.evaluate(pinLevelsFor(fit, inputs));
          state = 'MainGreen';
          expect(stateOf(s)).toBe(state);
        }
        const s = g.clock(pinLevelsFor(fit, inputs));
        state = inputs.RST ? 'MainGreen' : step(TRAFFIC, state, inputs);
        expect(stateOf(s), `t=${t} ${JSON.stringify(inputs)}`).toBe(state);
        // Moore outputs follow the state.
        const lamp = (n: string) => s.pins[fit.pinOf[n]!];
        if (encoding !== 'one-hot') expect(lamp('BOTH')).toBe(inputs.CAR && inputs.T && state === 'MainGreen' ? 1 : 0);
        expect([lamp('MG'), lamp('MA'), lamp('MR'), lamp('SG'), lamp('SA'), lamp('SR')]).toEqual([
          state === 'MainGreen' ? 1 : 0,
          state === 'MainAmber' ? 1 : 0,
          state.startsWith('Side') ? 1 : 0,
          state === 'SideGreen' ? 1 : 0,
          state === 'SideAmber' ? 1 : 0,
          state.startsWith('Main') ? 1 : 0,
        ]);
      }
    });
  }

  test('binary encoding of 4 states needs 2 bits and uses the reset state 00', () => {
    const d = fsmToGalDesign(TRAFFIC);
    expect(d.stateBits).toEqual(['Q1', 'Q0']);
    expect(d.codes).toEqual({ MainGreen: 0, MainAmber: 1, SideGreen: 2, SideAmber: 3 });
    expect(d.design.ar).toBe('RST');
  });

  test('a reset state whose code has ones is stored inverted so that AR and power-up give it', () => {
    const d = fsmToGalDesign({ ...TRAFFIC, reset: 'SideAmber', resetInput: undefined });
    const fit = fitGal22v10(d.design);
    for (const b of d.stateBits) expect(fit.outputs.find((o) => o.name === b)!.polarity).toBe('low');
    const g = new Gal22v10(fit.fuses);
    const s = g.evaluate({});
    expect(d.stateBits.map((b) => s.pins[fit.pinOf[b]!])).toEqual([1, 1]);
  });

  test('a three-state counter: the unused code is a don’t care', () => {
    const fsm: GalFsm = {
      inputs: ['EN'],
      states: ['A', 'B', 'C'],
      transitions: [
        { from: 'A', to: 'B', when: 'EN' },
        { from: 'B', to: 'C', when: 'EN' },
        { from: 'C', to: 'A', when: 'EN' },
      ],
      outputs: [{ name: 'DONE', states: ['C'] }],
      resetInput: 'RST',
    };
    const d = fsmToGalDesign(fsm);
    const fit = fitGal22v10(d.design);
    const strict = fitGal22v10({ ...d.design, outputs: d.design.outputs.map((o) => ({ ...o, dc: undefined })) });
    expect(d.design.outputs[0]!.dc).toBeDefined();
    expect(fit.termsUsed).toBeLessThanOrEqual(strict.termsUsed);
    const g = new Gal22v10(fit.fuses);
    let n = 0;
    const rng = mulberry32(21);
    for (let t = 0; t < 100; t++) {
      const en = rng.chance(0.6) ? 1 : 0;
      const s = g.clock(pinLevelsFor(fit, { EN: en }));
      if (en) n = (n + 1) % 3;
      expect(s.pins[fit.pinOf.Q1!]! * 2 + s.pins[fit.pinOf.Q0!]!).toBe(n);
      expect(s.pins[fit.pinOf.DONE!]).toBe(n === 2 ? 1 : 0);
    }
  });

  test('errors', () => {
    expect(() => fsmToGalDesign({ ...TRAFFIC, transitions: [{ from: 'X', to: 'MainGreen' }] })).toThrow(FsmError);
    expect(() => fsmToGalDesign({ ...TRAFFIC, encoding: [0, 1, 1, 2] })).toThrow(/distinct/);
    expect(() => fsmToGalDesign({ ...TRAFFIC, stateBits: ['A'] })).toThrow(/2 state bits/);
    expect(() => fsmToGalDesign({ ...TRAFFIC, outputs: [{ name: 'Z' }] })).toThrow(/needs states or expr/);
  });
});
