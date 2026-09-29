import { describe, expect, test } from 'vitest';
import { netlist } from './flat';
import { ScopeModel, riseTime } from './scope-model';
import { ScopeRig, planAdvance } from './scope-rig';

describe('planAdvance', () => {
  test('fast sweeps are limited to a few sweeps per frame, slow ones are sped up', () => {
    expect(planAdvance(1 / 60, 10e-6)).toBeCloseTo(4 * 10e-6 * 1.05, 12);
    expect(planAdvance(1 / 60, 0.1)).toBeCloseTo(1 / 60, 12);
    // A 10 s sweep gets boosted 5×: a whole sweep takes 2 real seconds.
    expect(planAdvance(1 / 60, 10)).toBeCloseTo(5 / 60, 12);
  });
});

function rcRig(R: number, C: number, timebase: number, timeScale = 1) {
  const c = netlist();
  c.add('G', 'siggen', { '-': 'gnd', '+': 'in' }, { waveform: 'square', frequency: 1 / (10 * timebase * timeScale), amplitude: 2.5, offset: 2.5, rise: Math.max(1e-12, timebase / 1000) * timeScale });
  c.add('R', 'resistor', { '1': 'in', '2': 'out' }, { resistance: R });
  c.add('C', 'capacitor', { '1': 'out', '2': 'gnd' }, { capacitance: C * timeScale });
  const model = new ScopeModel(2, timebase, { mode: 'auto', channel: 0, level: 2.5, position: 0.1 });
  return new ScopeRig(c.build(), [c.net('in'), c.net('out')], model, { timeScale });
}

describe('ScopeRig', () => {
  test('an RC circuit on a triggered scope: every sweep shows the same exponential', () => {
    const rig = rcRig(1000, 1e-6, 1e-3); // τ = 1 ms, 1 ms/div: the generator's half period is 5 τ
    for (let i = 0; i < 60; i++) rig.step(1 / 60);
    const m = rig.model;
    expect(m.sweeps.length).toBeGreaterThan(3);
    for (const sw of m.sweeps) expect(sw.triggered).toBe(true);
    const sw = m.last!;
    // 0 → 63.2 % of 5 V takes τ = 1 ms, measured on the raw points of the sweep.
    const t63 = riseTime(sw.raw, 1, 0.05, 5 * (1 - Math.exp(-1)) + 0.02);
    expect(t63).not.toBeNull();
    expect(t63!).toBeGreaterThan(0.95e-3);
    expect(t63!).toBeLessThan(1.05e-3);
    // The charge curve reaches 99 % by 5τ (just before the falling edge).
    const raw = sw.raw!;
    expect(Math.max(...raw.v[1]!)).toBeGreaterThan(4.9);
    rig.dispose();
  });

  test('time scaling: 50 Ω × 10 pF shows τ = 0.5 ns', () => {
    const rig = rcRig(50, 10e-12, 1e-9, 1000);
    for (let i = 0; i < 60; i++) rig.step(1 / 60);
    const sw = rig.model.last!;
    expect(sw).toBeDefined();
    const t63 = riseTime(sw.raw, 1, 0.05, 5 * (1 - Math.exp(-1)) + 0.02);
    expect(t63!).toBeGreaterThan(0.45e-9);
    expect(t63!).toBeLessThan(0.55e-9);
    rig.dispose();
  });

  test('the recorder is trimmed so memory stays bounded', () => {
    const rig = rcRig(1000, 1e-6, 1e-3);
    for (let i = 0; i < 300; i++) rig.step(1 / 60);
    expect(rig.rec.times().length).toBeLessThan(20000);
    rig.dispose();
  });
});
