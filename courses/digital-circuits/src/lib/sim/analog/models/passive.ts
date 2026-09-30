import {
  CapacitorState,
  G_OPEN,
  InductorState,
  bool,
  conductance,
  currentSource,
  num,
  relax,
  si,
  volt,
  type AcceptContext,
} from '../device';
import { registerAnalogModel } from './registry';

/**
 * Passive parts. State keys:
 *  - resistor: { burned, power (W, now), heat (0–1: 0.5 at the rated power, 1 = burning out) }.
 *  - capacitor: { burned, value (V across it, 1 relative to 2), charge (C) }.
 *  - inductor: { current (A, through the inductance from 1 to 2) }.
 *  - potentiometer: { position }.
 *  - lamp: { brightness (0–1), burned, temperature (K), resistance (Ω), power (W) }.
 * setParam: any catalog parameter.
 *
 * Thermal models:
 *  - resistor: θ, the power relative to the rating, filtered with τ = 0.5 s; burns (→ open) when θ
 *    reaches 2 (twice the rating for long enough: 0.35 s at 4×, 0.1 s at 10×).
 *  - lamp: normalised filament temperature T (1 at the rated power, ambient T₀ = 0.1, about
 *    2700 K × T), resistance R = R_hot·T with R_hot = V_rated²/P_rated (so cold = R_hot/10), and a
 *    first-order thermal lag τ·dT/dt = (P/P_rated)(1 − T₀) − (T − T₀) with τ = 50 ms. At a steady
 *    voltage V, T² − 0.1·T = 0.9·(V/V_rated)². Brightness ((T − T_glow)/(T_rated − T_glow))^1.4,
 *    clamped to 0–1, with T_glow = 0.32 (about 860 K: the first dull red) and T_rated = 1. Since
 *    T = 0.1 + 0.9·P/P_rated at a steady state, the glow starts near 25 % of the rated power, is a
 *    dull red around 35 % (brightness 0.07), half bright at 72 % of the power (0.52: a lamp at
 *    85 % of its rated current) and full at 100 %.
 *    Burns (→ open) above T = 1.45, which a steady 1.47 × the rated voltage reaches.
 */

const RESISTOR_TAU = 0.5;
const RESISTOR_BURN = 2;

registerAnalogModel('resistor', (env) => {
  const p = { ...env.element.params };
  const [a, b] = [env.nodes[0]!, env.nodes[1]!];
  const R = () => Math.max(1e-6, num(p, 'resistance', 1000));
  let burned = false;
  let theta = 0;
  const g = () => (burned ? G_OPEN : 1 / R());
  const v = (x: Float64Array) => volt(x, a) - volt(x, b);
  return {
    stamp(c) {
      conductance(c, a, b, g());
    },
    accept(c: AcceptContext) {
      const rating = num(p, 'power', 0.25);
      if (burned || !(rating > 0)) return;
      const P = v(c.x) ** 2 * g();
      theta = relax(theta, P / rating, c.h, RESISTOR_TAU);
      if (theta >= RESISTOR_BURN) {
        burned = true;
        env.message('warning', `${env.element.id} burned out: ${si(P, 'W')} in a ${si(rating, 'W')} resistor.`);
        return true;
      }
    },
    current: (pin, x) => (pin === 0 ? 1 : -1) * g() * v(x),
    state: (x) => ({ burned, power: v(x) ** 2 * g(), heat: Math.min(1, theta / RESISTOR_BURN) }),
    setParam(key, value) {
      p[key] = value;
    },
    reset() {
      burned = false;
      theta = 0;
    },
  };
});

// ---------------------------------------------------------------------------------------------
// Capacitor: companion model. An electrolytic (polarised) reversed by more than 1 V, or any
// capacitor above 1.1× its voltage rating, fails after 10 ms of abuse and becomes a short (0.1 Ω).

const CAP_SHORT = 10;
const CAP_ABUSE_TIME = 0.01;

registerAnalogModel('capacitor', (env) => {
  const p = { ...env.element.params };
  const [a, b] = [env.nodes[0]!, env.nodes[1]!];
  const C = () => Math.max(0, num(p, 'capacitance', 1e-6));
  const cap = new CapacitorState(C(), a, b);
  let burned = false;
  let abuse = 0;
  const init = () => {
    cap.C = C();
    cap.reset(num(p, 'initial', 0));
    burned = false;
    abuse = 0;
  };
  init();
  return {
    stamp(c) {
      if (burned) conductance(c, a, b, CAP_SHORT);
      else cap.stamp(c);
    },
    accept(c) {
      if (burned) return;
      cap.accept(c.x);
      const v = cap.v;
      const rating = num(p, 'voltageRating', 50);
      const reversed = bool(p, 'polarised') && v < -1;
      const over = rating > 0 && Math.abs(v) > 1.1 * rating;
      abuse = reversed || over ? abuse + c.h : 0;
      if (abuse > CAP_ABUSE_TIME) {
        burned = true;
        env.message(
          'warning',
          reversed
            ? `${env.element.id} burned out: ${si(-v, 'V')} reversed across an electrolytic capacitor (pin 1 is +). It is now a short circuit.`
            : `${env.element.id} burned out: ${si(Math.abs(v), 'V')} across a ${si(rating, 'V')} capacitor. It is now a short circuit.`,
        );
        return true;
      }
    },
    reactives: () => (burned ? [] : [cap]),
    current: (pin, x) => (pin === 0 ? 1 : -1) * (burned ? CAP_SHORT * cap.voltage(x) : cap.current(x)),
    state: (x) => ({ burned, value: cap.voltage(x), charge: cap.C * cap.voltage(x) }),
    setParam(key, value) {
      p[key] = value;
      cap.C = C();
    },
    reset: init,
  };
});

// ---------------------------------------------------------------------------------------------
// Inductor: branch-current model with its winding resistance, and 100 kΩ in parallel standing in
// for the winding's capacitance and losses, so interrupting the current gives a large but finite
// spike (I × 100 kΩ) rather than an infinite one.

export const INDUCTOR_PARALLEL = 1e5;

registerAnalogModel('inductor', (env) => {
  const p = { ...env.element.params };
  const [a, b] = [env.nodes[0]!, env.nodes[1]!];
  const k = env.branch();
  const ind = new InductorState(num(p, 'inductance', 0.01), Math.max(1e-6, num(p, 'resistance', 1)), a, b, k);
  const v = (x: Float64Array) => volt(x, a) - volt(x, b);
  return {
    stamp(c) {
      ind.stamp(c);
      conductance(c, a, b, 1 / INDUCTOR_PARALLEL);
    },
    accept(c) {
      ind.accept(c.x);
    },
    reactives: () => [ind],
    current: (pin, x) => (pin === 0 ? 1 : -1) * (x[k]! + v(x) / INDUCTOR_PARALLEL),
    state: (x) => ({ current: x[k]! }),
    setParam(key, value) {
      p[key] = value;
      ind.L = Math.max(1e-12, num(p, 'inductance', 0.01));
      ind.R = Math.max(1e-6, num(p, 'resistance', 1));
    },
    reset() {
      ind.reset();
    },
  };
});

// ---------------------------------------------------------------------------------------------
// Potentiometer: A–W = R·position, W–B = R·(1 − position), each at least 10 mΩ.

registerAnalogModel('potentiometer', (env) => {
  const p = { ...env.element.params };
  const [a, b, w] = [env.nodes[0]!, env.nodes[1]!, env.nodes[2]!];
  const pos = () => Math.min(1, Math.max(0, num(p, 'position', 0.5)));
  const R = () => Math.max(1e-3, num(p, 'resistance', 1e4));
  const gAW = () => 1 / Math.max(0.01, R() * pos());
  const gWB = () => 1 / Math.max(0.01, R() * (1 - pos()));
  return {
    stamp(c) {
      conductance(c, a, w, gAW());
      conductance(c, w, b, gWB());
    },
    current(pin, x) {
      const iA = gAW() * (volt(x, a) - volt(x, w));
      const iB = gWB() * (volt(x, b) - volt(x, w));
      return pin === 0 ? iA : pin === 1 ? iB : -(iA + iB);
    },
    state: () => ({ position: pos() }),
    setParam(key, value) {
      p[key] = value;
    },
    reset() {},
  };
});

// ---------------------------------------------------------------------------------------------
// Lamp: a filament whose resistance follows its temperature.

const LAMP_T0 = 0.1;
const LAMP_TAU = 0.05;
const LAMP_BURN_T = 1.45;
const LAMP_RATED_K = 2700;
/** Normalised temperature where the filament starts to glow, and the exponent of the brightness curve. */
const LAMP_T_GLOW = 0.32;
const LAMP_T_RATED = 1;
const LAMP_BRIGHTNESS_EXP = 1.4;

registerAnalogModel('lamp', (env) => {
  const p = { ...env.element.params };
  const [a, b] = [env.nodes[0]!, env.nodes[1]!];
  const Vr = () => Math.max(1e-3, num(p, 'ratedVoltage', 6));
  const Pr = () => Math.max(1e-6, num(p, 'ratedPower', 0.3));
  const Rhot = () => (Vr() * Vr()) / Pr();
  /** Committed temperature, and the temperature at the end of the step being solved. */
  let T = LAMP_T0;
  let Tn = LAMP_T0;
  let rate = 0;
  let burned = false;
  const g = () => (burned ? G_OPEN : 1 / (Rhot() * Tn));
  const v = (x: Float64Array) => volt(x, a) - volt(x, b);
  const dTdt = (T: number, v2: number) => {
    const P = v2 / (Rhot() * T);
    return ((P / Pr()) * (1 - LAMP_T0) - (T - LAMP_T0)) / LAMP_TAU;
  };
  /** Temperature after h seconds at voltage² v2: explicit sub-steps, small enough to be stable. */
  const heat = (T0: number, v2: number, h: number) => {
    const stiffness = (1 + ((v2 / (Rhot() * Pr())) * (1 - LAMP_T0)) / (LAMP_T0 * LAMP_T0)) / LAMP_TAU;
    const nsub = Math.max(1, Math.ceil(h / Math.min(2e-4, 0.5 / stiffness)));
    const hs = h / nsub;
    let t = T0;
    for (let s = 0; s < nsub; s++) t = Math.max(LAMP_T0, t + hs * dTdt(t, v2));
    return t;
  };
  return {
    // The filament's temperature at the end of the step depends on the voltage across it, so the
    // lamp is solved with the step (Newton–Raphson) rather than lagging a step behind.
    nonlinear: true,
    stamp(c) {
      if (burned) {
        conductance(c, a, b, G_OPEN);
        return;
      }
      const v0 = v(c.x);
      Tn = heat(T, v0 * v0, c.h);
      const R = Rhot() * Tn;
      // dI/dv = 1/R − v/R²·dR/dv, with dR/dv from one explicit step of the heat equation.
      const dTdv = Tn > LAMP_T0 ? (c.h * 2 * v0 * (1 - LAMP_T0)) / (Rhot() * T * Pr() * LAMP_TAU) : 0;
      const gd = 1 / R - (v0 / (R * R)) * Rhot() * dTdv;
      conductance(c, a, b, gd);
      currentSource(c, a, b, v0 / R - gd * v0);
    },
    accept(c) {
      if (burned) return;
      const v2 = v(c.x) ** 2;
      T = Tn = heat(T, v2, c.h);
      rate = dTdt(T, v2);
      if (T > LAMP_BURN_T) {
        burned = true;
        env.message('warning', `${env.element.id} burned out: ${si(Math.sqrt(v2), 'V')} across a ${si(Vr(), 'V')} lamp.`);
        return true;
      }
    },
    maxStep: () => (!burned && Math.abs(rate) > 0.1 ? 2e-3 : Infinity),
    current: (pin, x) => (pin === 0 ? 1 : -1) * g() * v(x),
    state(x) {
      const u = Math.max(0, Math.min(1, (T - LAMP_T_GLOW) / (LAMP_T_RATED - LAMP_T_GLOW)));
      return {
        brightness: burned ? 0 : u ** LAMP_BRIGHTNESS_EXP,
        burned,
        temperature: T * LAMP_RATED_K,
        resistance: burned ? Infinity : Rhot() * T,
        power: v(x) ** 2 * g(),
      };
    },
    setParam(key, value) {
      p[key] = value;
    },
    reset() {
      T = Tn = LAMP_T0;
      rate = 0;
      burned = false;
    },
  };
});
