import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import { runCheck } from '$lib/components/exercise/circuit/spec';
import { evalDag } from '../../11-boolean-algebra/widgets/layout';
import { allInputs, mealyToMoore, step, toFsmInput, toSnake } from './fsm';
import { toCircuit, toDag } from './netlist';
import { DETECTOR, PRESETS, TRAFFIC_LIGHT, VENDING } from './presets';
import { evalLogic, synthesise, type Encoding } from './synth';

const ENC: Encoding[] = ['binary', 'gray', 'onehot'];

describe('the gate network', () => {
  for (const p of PRESETS) {
    for (const e of ENC) {
      test(`${p.id} / ${e}: it computes the equations for every state and input`, () => {
        const s = synthesise(p.fsm, e);
        const dag = toDag(s);
        const k = s.codes.bits;
        for (const st of p.fsm.states) {
          const code = s.codes.code[st.name]!;
          for (const v of allInputs(p.fsm.inputs.length)) {
            const env: Record<string, number> = {};
            s.codes.names.forEach((q, i) => (env[q] = (code >> (k - 1 - i)) & 1));
            p.fsm.inputs.forEach((n, i) => (env[n] = v[i]!));
            const out = evalDag(dag, env);
            const want = evalLogic(s, code, v);
            s.codes.names.forEach((q, i) => expect(out[`D_${q}`]).toBe((want.next >> (k - 1 - i)) & 1));
            p.fsm.outputs.forEach((o, i) => expect(out[o]).toBe(+want.out[i]!));
          }
        }
      });
    }
  }
});

describe('the whole circuit', () => {
  for (const p of [...PRESETS.map((x) => x.fsm), mealyToMoore(DETECTOR)]) {
    for (const e of ENC) {
      test(`${p.title} / ${e}: clocked on the digital engine it follows the diagram`, () => {
        const s = synthesise(p, e);
        const c = toCircuit(s);
        const flat = flatten(c);
        const eng = createDigitalEngine(flat);
        const net = (id: string) => flat.elements.find((x) => x.id === id)!.pins[0]!;
        eng.advance(100e-9);
        let state = p.states[0]!.name;
        let a = 99;
        for (let n = 0; n < 60; n++) {
          a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
          const v = p.inputs.map((_, i) => (a >>> (9 + i)) & 1);
          p.inputs.forEach((name, i) => eng.setParam(`in_${name}`, 'on', !!v[i]));
          eng.advance(50e-9);
          const want = step(p, state, v);
          expect(p.outputs.map((o) => eng.logic(net(`out_${o}`))).join('')).toBe(want.out);
          eng.setParam('CLK', 'pressed', true);
          eng.advance(50e-9);
          eng.setParam('CLK', 'pressed', false);
          eng.advance(50e-9);
          state = want.next;
        }
        expect(eng.messages.filter((m) => m.level !== 'info')).toEqual([]);
      });
    }
  }
  test('with ports it passes the exercise checker against the state table, and it is proven equivalent', () => {
    for (const fsm of [TRAFFIC_LIGHT, VENDING, DETECTOR]) {
      for (const e of ENC) {
        const c = toCircuit(synthesise(fsm, e), { ports: true });
        const r = runCheck({ id: 'x', spec: { fsm: toFsmInput(fsm) }, allowed: ['not', 'and', 'or', 'dff'] }, c);
        expect(r.problems, `${fsm.title} ${e}`).toEqual([]);
        expect(r.pass, `${fsm.title} ${e}: ${r.headline}`).toBe(true);
        expect(r.seq!.proven).toBe(true);
      }
    }
  });
  test('gate counts of the drawing equal the cost model', () => {
    for (const p of PRESETS) {
      for (const e of ENC) {
        const s = synthesise(p.fsm, e);
        const c = toCircuit(s);
        const gates = c.components.filter((x) => ['and', 'or', 'not'].includes(x.type)).length;
        // Wide gates are split into trees in the drawing, so it can have more gates than the model, never fewer.
        expect(gates).toBeGreaterThanOrEqual(s.cost.gates);
        expect(c.components.filter((x) => x.type === 'dff')).toHaveLength(s.cost.flipFlops);
      }
    }
  });
  test('names survive: outputs are named as in the machine', () => {
    const c = toCircuit(synthesise(TRAFFIC_LIGHT, 'gray'));
    expect(c.components.map((x) => x.id)).toEqual(expect.arrayContaining(['in_tick', 'out_red', 'out_amber', 'out_green', 'CLK', 'FF_Q1', 'FF_Q0']));
    expect(toSnake('RedAmber')).toBe('red_amber');
  });
});
