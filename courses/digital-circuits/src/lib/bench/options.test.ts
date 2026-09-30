import { describe, expect, it } from 'vitest';
import { engineOptions } from './options';
import { buildLevel } from './dial';
import { createDigitalEngine } from '../sim/digital';
import type { Circuit } from '../sim/netlist/types';

describe('::circuit engine options', () => {
  it('passes delayModel and seed to a digital engine', () => {
    expect(engineOptions('digital', {}, { delayModel: 'transport', seed: 3 }).options).toEqual({ delayModel: 'transport', seed: 3 });
    expect(engineOptions(undefined, {}, { delayModel: 'inertial' }).options).toEqual({ delayModel: 'inertial' });
  });
  it('gives no options when the props are absent', () => {
    expect(engineOptions('digital', {}, {})).toEqual({ options: {} });
  });
  it('keeps the options of the abstraction level and sends delayModel only to digital engines', () => {
    const level = { mode: 'unit-delay', unitDelay: 1e-9 };
    expect(engineOptions('switch', level, { delayModel: 'transport', seed: 7 }).options).toEqual({ seed: 7, ...level });
    expect(engineOptions('analog', { step: 1e-10, seed: 1 }, { seed: 7 }).options).toEqual({ seed: 1, step: 1e-10 });
  });
  it('reports bad values instead of passing them on', () => {
    const r = engineOptions('digital', {}, { delayModel: 'fast', seed: Number.NaN });
    expect(r.error).toMatch(/delayModel/);
    expect(r.options).toEqual({});
  });
});

/** A buffer chain fed by a 1 ns pulse: with 2 ns gates, inertial delay swallows it and transport delay does not. */
const pulse: Circuit = {
  version: 1,
  engine: 'digital',
  components: [
    { id: 'S', type: 'toggle', x: 0, y: 0 },
    { id: 'B1', type: 'buffer', x: 6, y: 0, params: { delay: 2 } },
    { id: 'P', type: 'probe', x: 16, y: 0, params: { name: 'Y' } },
  ],
  wires: [{ points: [[3, 0], [6, 0]] }, { points: [[11, 0], [16, 0]] }],
};

describe('options reach the digital engine', () => {
  const run = (props: { delayModel?: string }) => {
    const level = buildLevel(pulse, 'logic');
    const flat = level.netlist();
    const eng = createDigitalEngine(flat, engineOptions(level.kind, level.options, props).options);
    const out = flat.elements.find((e) => e.id === 'P')!.pins[0]!;
    eng.advance(10e-9);
    eng.setParam('S', 'on', true);
    eng.advance(1e-9);
    eng.setParam('S', 'on', false);
    let changes = 0;
    let last = eng.logic(out);
    for (let i = 0; i < 40; i++) {
      eng.advance(0.25e-9);
      const v = eng.logic(out);
      if (v !== last) changes++;
      last = v;
    }
    return { model: eng.delayModel, changes };
  };
  it('transport passes a pulse shorter than the gate delay, inertial swallows it', () => {
    expect(run({})).toEqual({ model: 'inertial', changes: 0 });
    expect(run({ delayModel: 'transport' })).toEqual({ model: 'transport', changes: 2 });
  });
});
