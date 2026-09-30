import type { ParamValue, Params } from '../../netlist/types';
import {
  G_OPEN,
  GMIN,
  GMIN_JUNCTION,
  VT,
  conductance,
  currentSource,
  fetlim,
  limvds,
  num,
  pnjlim,
  relax,
  safeExp,
  safeExpD,
  si,
  vcrit,
  volt,
  type AcceptContext,
  type AnalogDevice,
  type DeviceEnv,
  type StampContext,
} from '../device';
import { registerAnalogModel } from './registry';

/**
 * Semiconductors. State keys:
 *  - diode: { burned, current (A, anode → cathode), value (V across it) }.
 *  - led: { burned, brightness (0–1: current / maximum current), lit (current above 2 % of the
 *    maximum), current, value }.
 *  - npn / pnp: { region: 'cutoff' | 'active' | 'saturation', ic (A, into C for npn, out of C for
 *    pnp), ib (likewise for B), burned }.
 *  - nmos / pmos: { region: 'off' | 'linear' | 'saturation', id (A, drain current in the normal
 *    direction: into D for nmos, out of D for pmos) }.
 * setParam: any catalog parameter.
 *
 * Ratings: a diode, LED or BJT whose current, relative to its maximum, filtered with a time
 * constant (diode 100 ms, LED 20 ms, BJT 50 ms), reaches 1.5 burns out and becomes open.
 */

// ---------------------------------------------------------------------------------------------
// Diodes: Shockley junction I = Is·(e^(V/(n·Vt)) − 1) in series with Rs (an internal node between
// them), with GMIN_JUNCTION (1e-10 S, see device.ts) in parallel: reverse leakage beyond −Is, and a
// well-conditioned floating node when the diode is the only thing holding one. Reverse breakdown is not modelled.

interface DiodeParams {
  is: number;
  n: number;
  rs: number;
  maxCurrent: number;
}

const BURN_RATIO = 1.5;

/**
 * LED colours: forward voltage at 10 mA and series resistance, with n = 2. Is follows from them:
 * Is = 10 mA / e^((Vf − 10 mA·Rs)/(n·Vt)). Green is the classic GaP green (2.1 V); modern InGaN
 * greens are nearer 3 V.
 */
export const LED_COLOURS: Record<string, { vf: number; rs: number }> = {
  infrared: { vf: 1.2, rs: 1 },
  red: { vf: 1.85, rs: 2 },
  amber: { vf: 2.02, rs: 2 },
  yellow: { vf: 2.05, rs: 2 },
  green: { vf: 2.1, rs: 2 },
  blue: { vf: 3.05, rs: 5 },
  white: { vf: 3.1, rs: 5 },
};
const LED_N = 2;

export function ledParams(color: string, maxCurrent: number): DiodeParams {
  const c = LED_COLOURS[color] ?? LED_COLOURS.red!;
  const i = 0.01;
  return { is: i / Math.exp((c.vf - i * c.rs) / (LED_N * VT)), n: LED_N, rs: c.rs, maxCurrent };
}

function diodeDevice(env: DeviceEnv, p: Params, get: () => DiodeParams, led: boolean): AnalogDevice {
  const [a, k] = [env.nodes[0]!, env.nodes[1]!];
  const m = env.internal();
  let dp = get();
  let vd = 0;
  let burned = false;
  let theta = 0;
  const tau = led ? 0.02 : 0.1;
  const iA = (x: Float64Array) => (volt(x, a) - volt(x, m)) / dp.rs;
  return {
    nonlinear: true,
    stamp(c: StampContext) {
      conductance(c, a, m, 1 / dp.rs);
      if (burned) {
        conductance(c, m, k, G_OPEN);
        return;
      }
      const nvt = dp.n * VT;
      vd = pnjlim(c, volt(c.x, m) - volt(c.x, k), vd, nvt, vcrit(nvt, dp.is));
      const g = GMIN_JUNCTION + c.gmin;
      const id = dp.is * (safeExp(vd / nvt) - 1) + g * vd;
      const gd = (dp.is * safeExpD(vd / nvt)) / nvt + g;
      conductance(c, m, k, gd);
      currentSource(c, m, k, id - gd * vd);
    },
    accept(c: AcceptContext) {
      if (burned || !(dp.maxCurrent > 0)) return;
      const i = iA(c.x);
      theta = relax(theta, Math.max(0, i) / dp.maxCurrent, c.h, tau);
      if (theta >= BURN_RATIO) {
        burned = true;
        env.message(
          'warning',
          led
            ? `${env.element.id} burned out: ${si(i, 'A')} through a ${si(dp.maxCurrent, 'A')} LED. An LED needs a series resistor to limit its current.`
            : `${env.element.id} burned out: ${si(i, 'A')} through a diode rated ${si(dp.maxCurrent, 'A')}.`,
        );
        return true;
      }
    },
    current: (pin, x) => (pin === 0 ? 1 : -1) * iA(x),
    state(x) {
      const i = burned ? 0 : iA(x);
      const s = { burned, current: i, value: volt(x, a) - volt(x, k) };
      if (!led) return s;
      const brightness = Math.max(0, Math.min(1, i / dp.maxCurrent));
      return { ...s, brightness, lit: brightness > 0.02 };
    },
    setParam(key: string, value: ParamValue) {
      p[key] = value;
      dp = get();
    },
    reset() {
      vd = 0;
      burned = false;
      theta = 0;
    },
  };
}

registerAnalogModel('diode', (env) => {
  const p = { ...env.element.params };
  return diodeDevice(
    env,
    p,
    () => ({
      is: Math.max(1e-30, num(p, 'saturation', 2.5e-9)),
      n: Math.max(0.5, num(p, 'emission', 1.75)),
      rs: Math.max(1e-3, num(p, 'seriesResistance', 0.6)),
      maxCurrent: num(p, 'maxCurrent', 0.3),
    }),
    false,
  );
});

registerAnalogModel('led', (env) => {
  const p = { ...env.element.params };
  return diodeDevice(env, p, () => ledParams(String(p.color ?? 'red'), num(p, 'maxCurrent', 0.03)), true);
});

// ---------------------------------------------------------------------------------------------
// Bipolar transistors: Ebers–Moll transport model, βR = 1, no series resistances.
//   Ic = Is(e^(Vbe/Vt) − e^(Vbc/Vt)) − (Is/βR)(e^(Vbc/Vt) − 1)
//   Ib = (Is/βF)(e^(Vbe/Vt) − 1) + (Is/βR)(e^(Vbc/Vt) − 1)
// PNP: the same with every voltage and current negated. Pins: B, C, E.

const BETA_R = 1;

function bjt(env: DeviceEnv, pol: 1 | -1): AnalogDevice {
  const p = { ...env.element.params };
  const [B, C, E] = [env.nodes[0]!, env.nodes[1]!, env.nodes[2]!];
  let vbeOld = 0;
  let vbcOld = 0;
  let burned = false;
  let theta = 0;
  const Is = () => Math.max(1e-30, num(p, 'saturation', 1e-14));
  const bf = () => Math.max(1e-3, num(p, 'beta', 100));

  /** Normalised (npn) currents and derivatives at junction voltages vbe, vbc. */
  function evalAt(vbe: number, vbc: number, g: number) {
    const is = Is();
    const ebe = safeExp(vbe / VT);
    const ebc = safeExp(vbc / VT);
    const gf = (is * safeExpD(vbe / VT)) / VT;
    const gr = (is * safeExpD(vbc / VT)) / VT;
    const iF = is * (ebe - 1);
    const iR = is * (ebc - 1);
    return {
      ic: iF - iR * (1 + 1 / BETA_R) - g * vbc,
      ib: iF / bf() + iR / BETA_R + g * (vbe + vbc),
      gcbe: gf,
      gcbc: -gr * (1 + 1 / BETA_R) - g,
      gbbe: gf / bf() + g,
      gbbc: gr / BETA_R + g,
    };
  }
  const terminal = (x: Float64Array) => {
    const r = evalAt(pol * (volt(x, B) - volt(x, E)), pol * (volt(x, B) - volt(x, C)), GMIN);
    return { ic: r.ic, ib: r.ib };
  };

  return {
    nonlinear: true,
    stamp(c) {
      if (burned) return;
      const vcr = vcrit(VT, Is());
      const vbe = (vbeOld = pnjlim(c, pol * (volt(c.x, B) - volt(c.x, E)), vbeOld, VT, vcr));
      const vbc = (vbcOld = pnjlim(c, pol * (volt(c.x, B) - volt(c.x, C)), vbcOld, VT, vcr));
      const r = evalAt(vbe, vbc, GMIN + c.gmin);
      const n = c.n;
      const A = c.A;
      const add = (row: number, col: number, v: number) => {
        if (row >= 0 && col >= 0) A[row * n + col] = A[row * n + col]! + v;
      };
      const icEq = pol * (r.ic - r.gcbe * vbe - r.gcbc * vbc);
      const ibEq = pol * (r.ib - r.gbbe * vbe - r.gbbc * vbc);
      // Row C: current into C.
      add(C, B, r.gcbe + r.gcbc);
      add(C, E, -r.gcbe);
      add(C, C, -r.gcbc);
      // Row B: current into B.
      add(B, B, r.gbbe + r.gbbc);
      add(B, E, -r.gbbe);
      add(B, C, -r.gbbc);
      // Row E: current into E = −(into C + into B).
      add(E, B, -(r.gcbe + r.gcbc + r.gbbe + r.gbbc));
      add(E, E, r.gcbe + r.gbbe);
      add(E, C, r.gcbc + r.gbbc);
      if (C >= 0) c.b[C] = c.b[C]! - icEq;
      if (B >= 0) c.b[B] = c.b[B]! - ibEq;
      if (E >= 0) c.b[E] = c.b[E]! + (icEq + ibEq);
    },
    accept(c) {
      const max = num(p, 'maxCurrent', 0.2);
      if (burned || !(max > 0)) return;
      const { ic } = terminal(c.x);
      theta = relax(theta, Math.abs(ic) / max, c.h, 0.05);
      if (theta >= BURN_RATIO) {
        burned = true;
        env.message('warning', `${env.element.id} burned out: ${si(Math.abs(ic), 'A')} collector current in a transistor rated ${si(max, 'A')}.`);
        return true;
      }
    },
    current(pin, x) {
      if (burned) return 0;
      const { ic, ib } = terminal(x);
      return pol * (pin === 0 ? ib : pin === 1 ? ic : -(ic + ib));
    },
    state(x) {
      if (burned) return { burned, region: 'cutoff', ic: 0, ib: 0 };
      const { ic, ib } = terminal(x);
      const vbe = pol * (volt(x, B) - volt(x, E));
      const region = vbe < 0.5 || ib <= 0 ? 'cutoff' : ic < 0.95 * bf() * ib ? 'saturation' : 'active';
      return { burned, region, ic, ib };
    },
    setParam(key, value) {
      p[key] = value;
    },
    reset() {
      vbeOld = 0;
      vbcOld = 0;
      burned = false;
      theta = 0;
    },
  };
}

registerAnalogModel('npn', (env) => bjt(env, 1));
registerAnalogModel('pnp', (env) => bjt(env, -1));

// ---------------------------------------------------------------------------------------------
// MOSFETs: level 1 (Shichman–Hodges), with k = μCox·W/L:
//   off:        Vgs ≤ Vt                 Id = 0
//   linear:     Vds < Vgs − Vt           Id = k·((Vgs − Vt)·Vds − Vds²/2)·(1 + λVds)
//   saturation: Vds ≥ Vgs − Vt           Id = (k/2)·(Vgs − Vt)²·(1 + λVds)
// Symmetric: when Vds < 0 drain and source swap roles. PMOS: every voltage and current negated.
// The gate draws no current (no gate capacitance is modelled). Pin order: nmos G, D, S; pmos G, S, D.

function mosfet(env: DeviceEnv, pol: 1 | -1): AnalogDevice {
  const p = { ...env.element.params };
  const G = env.nodes[0]!;
  const D = pol === 1 ? env.nodes[1]! : env.nodes[2]!;
  const S = pol === 1 ? env.nodes[2]! : env.nodes[1]!;
  const pinD = pol === 1 ? 1 : 2;
  let vgsOld = 0;
  let vdsOld = 0;
  const vt = () => Math.abs(num(p, 'threshold', 1));
  const kp = () => Math.max(0, num(p, 'k', pol === 1 ? 0.02 : 0.01));
  const lambda = () => Math.max(0, num(p, 'lambda', 0.01));

  /** Normalised drain current for vgs, vds ≥ 0, and its derivatives. */
  function channel(vgs: number, vds: number) {
    const vov = vgs - vt();
    const k = kp();
    const l = lambda();
    if (vov <= 0) return { id: 0, gm: 0, gds: 0, region: 'off' as const };
    if (vds < vov) {
      const f = vov * vds - (vds * vds) / 2;
      return { id: k * f * (1 + l * vds), gm: k * vds * (1 + l * vds), gds: k * (vov - vds) * (1 + l * vds) + k * l * f, region: 'linear' as const };
    }
    return { id: (k / 2) * vov * vov * (1 + l * vds), gm: k * vov * (1 + l * vds), gds: (k / 2) * vov * vov * l, region: 'saturation' as const };
  }
  /** Normalised current from D to S at node voltages x (no limiting), with the region. */
  function drain(x: Float64Array) {
    const vgs = pol * (volt(x, G) - volt(x, S));
    const vds = pol * (volt(x, D) - volt(x, S));
    if (vds >= 0) return channel(vgs, vds);
    const r = channel(vgs - vds, -vds);
    return { ...r, id: -r.id };
  }

  return {
    nonlinear: true,
    stamp(c) {
      let vgs = pol * (volt(c.x, G) - volt(c.x, S));
      let vds = pol * (volt(c.x, D) - volt(c.x, S));
      let vgd = vgs - vds;
      const vgdOld = vgsOld - vdsOld;
      if (vdsOld >= 0) {
        vgs = fetlim(c, vgs, vgsOld, vt());
        vds = limvds(c, vgs - vgd, vdsOld);
        vgd = vgs - vds;
      } else {
        vgd = fetlim(c, vgd, vgdOld, vt());
        vds = -limvds(c, -(vgs - vgd), -vdsOld);
        vgs = vgd + vds;
      }
      vgsOld = vgs;
      vdsOld = vds;
      // Orientation: d and s are the nodes acting as drain and source for this iterate.
      const normal = vds >= 0;
      const d = normal ? D : S;
      const s = normal ? S : D;
      const r = normal ? channel(vgs, vds) : channel(vgd, -vds);
      const vgsN = normal ? vgs : vgd;
      const vdsN = normal ? vds : -vds;
      const n = c.n;
      const A = c.A;
      const add = (row: number, col: number, v: number) => {
        if (row >= 0 && col >= 0) A[row * n + col] = A[row * n + col]! + v;
      };
      // Current into d = pol·Id(vgs', vds'), linearised.
      add(d, G, r.gm);
      add(d, d, r.gds);
      add(d, s, -(r.gm + r.gds));
      add(s, G, -r.gm);
      add(s, d, -r.gds);
      add(s, s, r.gm + r.gds);
      const ieq = pol * (r.id - r.gm * vgsN - r.gds * vdsN);
      if (d >= 0) c.b[d] = c.b[d]! - ieq;
      if (s >= 0) c.b[s] = c.b[s]! + ieq;
      conductance(c, D, S, GMIN + c.gmin);
    },
    current(pin, x) {
      if (pin === 0) return 0;
      const i = pol * drain(x).id + (GMIN * (volt(x, D) - volt(x, S)));
      return pin === pinD ? i : -i;
    },
    state(x) {
      const r = drain(x);
      return { region: r.region, id: r.id };
    },
    setParam(key, value) {
      p[key] = value;
    },
    reset() {
      vgsOld = 0;
      vdsOld = 0;
    },
  };
}

registerAnalogModel('nmos', (env) => mosfet(env, 1));
registerAnalogModel('pmos', (env) => mosfet(env, -1));
