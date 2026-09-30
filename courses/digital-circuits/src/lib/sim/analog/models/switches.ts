import { G_CLOSED, G_OPEN, InductorState, bool, conductance, num, si, volt, type AcceptContext } from '../device';
import { registerAnalogModel } from './registry';

/**
 * Switches and the relay. A closed contact is 10 mΩ, an open one 1 TΩ. State keys:
 *  - switch: { closed }. setParam 'closed'.
 *  - spdt: { throw (0: C–0 made, 1: C–1 made) }. setParam 'throw'.
 *  - pushbutton: { pressed, closed (the contact now, which bounces) }. setParam 'pressed', 'bounce'.
 *  - relay: { closed (COM–NO made), nc (COM–NC made), energised, coilCurrent (A), throw (1 when
 *    COM–NO is made), spike (peak flyback voltage of the last interruption, V; 0 if none) }.
 *    setParam: any catalog parameter.
 */

registerAnalogModel('switch', (env) => {
  const p = { ...env.element.params };
  const [a, b] = [env.nodes[0]!, env.nodes[1]!];
  const g = () => (bool(p, 'closed') ? G_CLOSED : G_OPEN);
  return {
    stamp(c) {
      conductance(c, a, b, g());
    },
    current: (pin, x) => (pin === 0 ? 1 : -1) * g() * (volt(x, a) - volt(x, b)),
    state: () => ({ closed: bool(p, 'closed') }),
    setParam(key, value) {
      p[key] = value;
    },
    reset() {},
  };
});

registerAnalogModel('spdt', (env) => {
  const p = { ...env.element.params };
  const [c0, t0, t1] = [env.nodes[0]!, env.nodes[1]!, env.nodes[2]!];
  const thr = () => (num(p, 'throw', 0) >= 0.5 ? 1 : 0);
  const g0 = () => (thr() === 0 ? G_CLOSED : G_OPEN);
  const g1 = () => (thr() === 1 ? G_CLOSED : G_OPEN);
  return {
    stamp(c) {
      conductance(c, c0, t0, g0());
      conductance(c, c0, t1, g1());
    },
    current(pin, x) {
      const i0 = g0() * (volt(x, t0) - volt(x, c0));
      const i1 = g1() * (volt(x, t1) - volt(x, c0));
      return pin === 1 ? i0 : pin === 2 ? i1 : -(i0 + i1);
    },
    state: () => ({ throw: thr() }),
    setParam(key, value) {
      p[key] = value;
    },
    reset() {},
  };
});

// ---------------------------------------------------------------------------------------------
// Contact bounce: after the first touch, the contact opens and closes a few more times before it
// settles. The burst lasts 1–5 ms (random, seeded) with 2–5 extra bounces at random times.

export interface ContactEvent {
  t: number;
  closed: boolean;
}

export function bounceBurst(random: () => number, t0: number, final: boolean, maxDuration = 5e-3, minDuration = 1e-3): ContactEvent[] {
  const duration = minDuration + (maxDuration - minDuration) * random();
  const pairs = 2 + Math.floor(random() * 4);
  const u: number[] = [];
  for (let i = 0; i < 2 * pairs; i++) u.push(random());
  u.sort((x, y) => x - y);
  const top = u[u.length - 1]!;
  return u.map((v, i) => ({
    t: t0 + (i === u.length - 1 ? duration : (duration * v) / top),
    // Odd events bounce away from the final position, even events come back to it.
    closed: i % 2 === 0 ? !final : final,
  }));
}

registerAnalogModel('pushbutton', (env) => {
  const p = { ...env.element.params };
  const [a, b] = [env.nodes[0]!, env.nodes[1]!];
  let closed = bool(p, 'pressed');
  let events: ContactEvent[] = [];
  const g = () => (closed ? G_CLOSED : G_OPEN);
  return {
    stamp(c) {
      conductance(c, a, b, g());
    },
    accept(c: AcceptContext) {
      let changed = false;
      while (events.length && events[0]!.t <= c.t * (1 + 1e-12)) {
        closed = events.shift()!.closed;
        changed = true;
      }
      return changed;
    },
    breakpoint: (t) => {
      for (const e of events) if (e.t > t) return e.t;
      return Infinity;
    },
    current: (pin, x) => (pin === 0 ? 1 : -1) * g() * (volt(x, a) - volt(x, b)),
    state: () => ({ pressed: bool(p, 'pressed'), closed }),
    setParam(key, value) {
      const was = bool(p, 'pressed');
      p[key] = value;
      const now = bool(p, 'pressed');
      if (key !== 'pressed' || now === was) return;
      closed = now;
      events = bool(p, 'bounce') ? bounceBurst(() => env.random(), env.time(), now) : [];
    },
    reset() {
      closed = bool(p, 'pressed');
      events = [];
    },
  };
});

// ---------------------------------------------------------------------------------------------
// Relay.
//
// Coil: an inductor with its resistance between A and B, with 100 × its resistance in parallel
// (winding capacitance and eddy losses, lumped), so interrupting the coil current produces a spike
// of about I × 100·R_coil — hundreds of volts for a 5 V relay — unless a diode clamps it.
//
// Armature: energised when |I_coil| rises above 70 % of the rated current (coil voltage / coil
// resistance), released when it falls below 30 % (hysteresis). The contacts follow the armature
// after the operate time (release uses the same time), break-before-make: the contact that opens
// does so at 30 % of the travel, the one that closes at the end, then bounces (seeded, 2–5
// bounces within min(1 ms, 20 % of the operate time)).

const RELAY_PULL_IN = 0.7;
const RELAY_DROP_OUT = 0.3;
export const RELAY_PARALLEL_FACTOR = 100;

interface RelayEvent {
  t: number;
  contact: 'no' | 'nc';
  closed: boolean;
}

registerAnalogModel('relay', (env) => {
  const p = { ...env.element.params };
  const [a, b, nNO, nCOM, nNC] = env.nodes as [number, number, number, number, number];
  const k = env.branch();
  const Rc = () => Math.max(1e-3, num(p, 'coilResistance', 70));
  const coil = new InductorState(num(p, 'coilInductance', 0.1), Rc(), a, b, k);
  let no = false;
  let nc = true;
  let energised = false;
  let events: RelayEvent[] = [];
  let spiking = false;
  let peak = 0;
  let lastSpike = 0;
  const gp = () => 1 / (RELAY_PARALLEL_FACTOR * Rc());
  const gNO = () => (no ? G_CLOSED : G_OPEN);
  const gNC = () => (nc ? G_CLOSED : G_OPEN);
  const vCoil = (x: Float64Array) => volt(x, a) - volt(x, b);

  function plan(t: number, on: boolean): void {
    const op = Math.max(1e-6, num(p, 'operateTime', 0.005));
    const opening: RelayEvent['contact'] = on ? 'nc' : 'no';
    const closing: RelayEvent['contact'] = on ? 'no' : 'nc';
    events = [
      { t: t + 0.3 * op, contact: opening, closed: false },
      { t: t + op, contact: closing, closed: true },
    ];
    const window = Math.min(1e-3, 0.2 * op);
    for (const e of bounceBurst(() => env.random(), t + op, true, window, window / 2)) events.push({ t: e.t, contact: closing, closed: e.closed });
  }

  return {
    stamp(c) {
      coil.stamp(c);
      conductance(c, a, b, gp());
      conductance(c, nCOM, nNO, gNO());
      conductance(c, nCOM, nNC, gNC());
    },
    accept(c: AcceptContext) {
      coil.accept(c.x);
      const rated = Math.max(1e-9, num(p, 'coilVoltage', 5) / Rc());
      const i = Math.abs(coil.i);
      if (!energised && i >= RELAY_PULL_IN * rated) {
        energised = true;
        plan(c.t, true);
      } else if (energised && i <= RELAY_DROP_OUT * rated) {
        energised = false;
        plan(c.t, false);
      }
      let changed = false;
      while (events.length && events[0]!.t <= c.t * (1 + 1e-12)) {
        const e = events.shift()!;
        if (e.contact === 'no') no = e.closed;
        else nc = e.closed;
        changed = true;
      }
      // Flyback: report the peak once the spike is over.
      const v = Math.abs(vCoil(c.x));
      const threshold = Math.max(30, 3 * num(p, 'coilVoltage', 5));
      if (v > threshold) {
        if (!spiking) peak = 0;
        spiking = true;
        peak = Math.max(peak, v);
      } else if (spiking) {
        spiking = false;
        lastSpike = peak;
        env.message(
          'warning',
          `${env.element.id}: a ${si(peak, 'V')} spike across the relay coil when its current was interrupted. A diode across the coil (a flyback diode) would absorb it.`,
        );
      }
      return changed;
    },
    reactives: () => [coil],
    breakpoint: (t) => {
      let next = Infinity;
      for (const e of events) if (e.t > t && e.t < next) next = e.t;
      return next;
    },
    current(pin, x) {
      const iCoil = x[k]! + gp() * vCoil(x);
      const iNO = gNO() * (volt(x, nNO) - volt(x, nCOM));
      const iNC = gNC() * (volt(x, nNC) - volt(x, nCOM));
      switch (pin) {
        case 0:
          return iCoil;
        case 1:
          return -iCoil;
        case 2:
          return iNO;
        case 4:
          return iNC;
        default:
          return -(iNO + iNC);
      }
    },
    state: (x) => ({ closed: no, nc, energised, coilCurrent: x[k]!, throw: no ? 1 : 0, spike: spiking ? peak : lastSpike }),
    setParam(key, value) {
      p[key] = value;
      coil.L = Math.max(1e-9, num(p, 'coilInductance', 0.1));
      coil.R = Rc();
    },
    reset() {
      coil.reset();
      no = false;
      nc = true;
      energised = false;
      events = [];
      spiking = false;
      peak = 0;
      lastSpike = 0;
    },
  };
});
