import { expect, test } from 'vitest';
import { step } from './fsm';
import { PRESETS, TRAFFIC_LIGHT } from './presets';
import { clock, resetCode } from './run';
import { synthesise } from './synth';

test('the clocked logic follows the diagram, for every preset and encoding', () => {
  for (const p of PRESETS) {
    for (const e of ['binary', 'gray', 'onehot'] as const) {
      const s = synthesise(p.fsm, e);
      let code = resetCode(s);
      let state = p.fsm.states[0]!.name;
      let a = 5;
      for (let n = 1; n <= 200; n++) {
        a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
        const v = p.fsm.inputs.map((_, i) => (a >>> (8 + i)) & 1);
        const c = clock(s, code, v, n);
        expect(c.agrees).toBe(true);
        expect(c.state).toBe(state);
        state = step(p.fsm, state, v).next;
        expect(c.next).toBe(state);
        code = c.nextCode;
      }
    }
  }
});

test('an unused code is reported as unknown, not as agreeing', () => {
  const s = synthesise(TRAFFIC_LIGHT, 'onehot');
  expect(clock(s, 0, [1], 1).agrees).toBe(false);
  expect(clock(s, 0, [1], 1).state).toBe('?');
});
