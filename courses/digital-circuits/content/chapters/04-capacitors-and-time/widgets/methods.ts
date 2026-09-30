/**
 * Backward Euler against the trapezoidal rule, on the stiffest simple step there is: 5 V switched onto R and C
 * with a fixed time step h, which is a multiple of τ = RC. Both methods are run by the real analog engine
 * (`fixedStep: true`), so what you see is what the simulator does when it is not allowed to choose its own steps.
 */
import { createAnalogEngine } from '$lib/sim/analog';
import { netlist } from '../../03-the-bench/widgets/flat';

export interface MethodCurves {
  /** Sample times in units of τ (0, h/τ, 2h/τ, …). */
  t: number[];
  euler: number[];
  trapezoidal: number[];
  exact: number[];
}

export const VS = 5;

/** Run `steps` fixed steps of `hOverTau`·τ with both methods. */
export function methodCurves(hOverTau: number, steps = 14): MethodCurves {
  const R = 1000;
  const C = 1e-9;
  const tau = R * C;
  const h = hOverTau * tau;
  const one = (method: 'euler' | 'trapezoidal') => {
    const c = netlist();
    c.add('B', 'battery', { '-': 'gnd', '+': 'in' }, { voltage: VS, resistance: 0.2 });
    c.add('R', 'resistor', { '1': 'in', '2': 'out' }, { resistance: R });
    c.add('C', 'capacitor', { '1': 'out', '2': 'gnd' }, { capacitance: C });
    const e = createAnalogEngine(c.build(), { method, fixedStep: true, step: h });
    const rec = e.watch([c.net('out')]);
    e.advance(steps * h);
    return { t: Array.from(rec.times()), v: Array.from(rec.values()[0]!) };
  };
  const eu = one('euler');
  const tr = one('trapezoidal');
  return { t: eu.t.map((x) => x / tau), euler: eu.v, trapezoidal: tr.v, exact: eu.t.map((x) => VS * (1 - Math.exp(-x / tau))) };
}

/** The factor by which each method multiplies the error at every step, for h = hOverTau·τ. */
export function amplification(hOverTau: number): { euler: number; trapezoidal: number } {
  return { euler: 1 / (1 + hOverTau), trapezoidal: (1 - hOverTau / 2) / (1 + hOverTau / 2) };
}
