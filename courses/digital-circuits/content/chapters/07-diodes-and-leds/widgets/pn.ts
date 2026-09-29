/**
 * The physics of the pn-junction figure (Chapter 7), and the small particle simulation that draws it.
 *
 * Two parts:
 *  - Device physics, in real units: built-in voltage, depletion width, and the I–V curve of a silicon
 *    junction as a function of doping and applied voltage. These are the numbers the readouts show.
 *  - `PnSim`, a qualitative animation of the carriers. It is a picture, not a device simulator: majority
 *    carriers jiggle on their own side, cross the depletion edge with a probability that rises steeply
 *    with the forward voltage, and recombine after a random time. Its crossing probability is drawn
 *    less steeply than reality (a factor of ten per 0.2 V instead of per 60 mV), because no animation
 *    could show a factor of 10^6 in the rate of anything. The I–V plot and the readouts are exact.
 *
 * All the tunable numbers are constants at the top, so tests and the widget agree.
 */

/** Elementary charge (C), Boltzmann constant (J/K), temperature (K): kT/q = 25.85 mV. */
export const Q = 1.602176634e-19;
export const KB = 1.380649e-23;
export const TEMPERATURE = 300;
export const VT = (KB * TEMPERATURE) / Q;
/** Intrinsic carrier density of silicon at 300 K (cm⁻³). */
export const NI = 1.0e10;
/** Silicon atoms per cm³. */
export const N_SILICON = 5.0e22;
/** Permittivity of silicon: 11.7 × 8.854·10⁻¹⁴ F/cm. */
export const EPS_SI = 11.7 * 8.854e-14;
/** Silicon's bandgap (eV). */
export const BANDGAP_SI = 1.12;

/** Doping range of the slider (per side, cm⁻³) and the reference value of the default. */
export const DOPING_MIN = 1e15;
export const DOPING_MAX = 1e18;
export const DOPING_DEFAULT = 1e16;

/** Bias range of the slider (V). */
export const BIAS_MIN = -5;
export const BIAS_MAX = 1;

/** Series resistance of the neutral regions and contacts (Ω): what bends the curve straight above 0.8 V. */
export const R_SERIES = 2;
/** Saturation current at the default doping (A). It scales inversely with doping. */
export const IS_DEFAULT = 1e-14;
/** Generation (leakage) current at zero bias, default doping (A). It grows with the depletion width. */
export const IG_ZERO = 5e-12;

/** Built-in voltage of a junction with acceptor density `na` and donor density `nd` (cm⁻³). */
export function builtInVoltage(na: number, nd: number = na): number {
  return VT * Math.log((na * nd) / (NI * NI));
}

/** The junction voltage can approach Vbi but the formula for the width needs Vbi − V > 0. */
const V_MARGIN = 0.05;

/**
 * Width of the depletion region (µm) at applied voltage `v` (positive = forward bias):
 * W = √( 2ε (Vbi − V) / q · (1/Na + 1/Nd) ). Beyond Vbi − 0.05 V the width is held at its minimum,
 * as in a real diode where the junction voltage stops rising while the series resistance takes the rest.
 */
export function depletionWidth(v: number, na: number, nd: number = na): number {
  const vbi = builtInVoltage(na, nd);
  const drop = Math.max(V_MARGIN, vbi - v);
  const w = Math.sqrt(((2 * EPS_SI * drop) / Q) * (1 / na + 1 / nd)); // cm
  return w * 1e4;
}

/** How far the region reaches into each side (µm): the lighter-doped side gets more of it. */
export function depletionSplit(w: number, na: number, nd: number = na): { p: number; n: number } {
  return { p: (w * nd) / (na + nd), n: (w * na) / (na + nd) };
}

/** Saturation current (A) for a doping level: the fewer dopants, the more minority carriers, the larger Is. */
export const saturationCurrent = (doping: number): number => (IS_DEFAULT * DOPING_DEFAULT) / doping;

/** Generation current (A): thermal electron–hole pairs made inside the depletion region, ∝ its width. */
export function generationCurrent(v: number, doping: number): number {
  return IG_ZERO * (depletionWidth(v, doping) / depletionWidth(0, doping));
}

/**
 * Current through the diode (A, positive from p to n) at applied voltage v. The junction obeys
 * Shockley's equation with the generation–recombination term of the depletion region added:
 * I = Is (e^(Vj/Vt) − 1) + Ig (e^(Vj/2Vt) − 1), with Vj = V − I·Rs. In reverse bias the exponentials
 * vanish and I → −(Is + Ig), the leakage; in forward bias the first term takes over above a few nA.
 * The series resistance makes the equation implicit, so it is solved by bisection.
 */
export function diodeCurrent(v: number, doping: number = DOPING_DEFAULT): number {
  const is = saturationCurrent(doping);
  const ig = generationCurrent(v, doping);
  const at = (vj: number) => is * Math.expm1(vj / VT) + ig * Math.expm1(vj / (2 * VT));
  if (v <= 0) return at(v);
  // Find vj in [0, v] with vj + Rs·I(vj) = v.
  let lo = 0;
  let hi = v;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (mid + R_SERIES * at(mid) > v) hi = mid;
    else lo = mid;
  }
  return at((lo + hi) / 2);
}

/** Junction voltage (across the depletion region only) at applied voltage v. */
export function junctionVoltage(v: number, doping: number = DOPING_DEFAULT): number {
  if (v <= 0) return v;
  return v - R_SERIES * diodeCurrent(v, doping);
}

/** Volts of forward bias for the current to grow tenfold: Vt·ln 10 = 59.5 mV. */
export const DECADE_VOLTS = VT * Math.LN10;

/** "1 dopant atom in 5 million silicon atoms" for a doping density in cm⁻³. */
export function dopingRatio(doping: number): string {
  const per = N_SILICON / doping;
  if (per >= 1e6) return `1 in ${trimNumber(per / 1e6)} million`;
  return `1 in ${trimNumber(per / 1e3)} thousand`;
}
const trimNumber = (x: number): string => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, '');

/** A current formatted with an SI prefix and two or three significant digits: 5.8 mA, 12 pA. */
export function formatCurrent(i: number): string {
  const a = Math.abs(i);
  const sign = i < 0 ? '−' : '';
  if (a === 0) return '0 A';
  const units: [number, string][] = [
    [1, 'A'],
    [1e-3, 'mA'],
    [1e-6, 'µA'],
    [1e-9, 'nA'],
    [1e-12, 'pA'],
    [1e-15, 'fA'],
  ];
  for (const [f, u] of units) {
    if (a >= f * 0.9995 || u === 'fA') {
      const x = a / f;
      return `${sign}${x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)} ${u}`;
    }
  }
  return '0 A';
}

// ---------------------------------------------------------------------------------------------
// The particle picture.

/** Tunable numbers of the animation (pixels and seconds of the drawing, not of the device). */
export const SIM = {
  /** Thermal random walk, px per √s. */
  jiggle: 90,
  /** Drift of a minority carrier away from the junction, px/s. */
  drift: 30,
  /** Speed of a carrier swept across the depletion region by the field, px/s. */
  swept: 420,
  /** Mean time a minority carrier lives before it recombines (s). */
  lifetime: 1.6,
  /** Crossing probability per attempt at V = Vbi, and the voltage scale of its fall (V per e-fold). */
  crossMax: 0.5,
  crossScale: 0.09,
  /** Thermally generated pairs per second per side at zero bias. */
  generation: 1.2,
  /** Majority carriers per side at 10¹⁶ cm⁻³ and 640 px wide, and how many more per decade of doping. */
  baseCount: 60,
  perDecade: 34,
  /** Depletion region drawing: pixels at 4 µm, and the exponent that keeps thin regions visible. */
  pxAt4um: 170,
  pxExponent: 0.75,
};

/** Depletion width on screen (px) for a width in µm. */
export const depletionPx = (widthUm: number): number => SIM.pxAt4um * Math.pow(widthUm / 4, SIM.pxExponent);

/** Probability that a majority carrier that reaches the depletion edge gets across, at bias v. */
export function crossingProbability(v: number, doping: number): number {
  const vbi = builtInVoltage(doping);
  return Math.min(SIM.crossMax, SIM.crossMax * Math.exp((v - vbi) / SIM.crossScale));
}

/** Majority carriers drawn per side for a doping level and a canvas width. */
export function carrierCount(doping: number, width: number): number {
  const n = SIM.baseCount + SIM.perDecade * (Math.log10(doping) - 16);
  return Math.max(12, Math.round((n * width) / 640));
}

export type Kind = 'hole' | 'electron';
export type Mode = 'major' | 'minor' | 'swept' | 'fading';

export interface Carrier {
  kind: Kind;
  x: number;
  y: number;
  mode: Mode;
  /** Remaining life of a minority carrier (s). */
  life: number;
  /** 0–1: fades in when it enters at a contact, out when it leaves. */
  alpha: number;
}

export interface Flash {
  x: number;
  y: number;
  /** Seconds since the recombination. */
  age: number;
}

/** A small, fast, seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FLASH_SECONDS = 0.7;

export class PnSim {
  readonly carriers: Carrier[] = [];
  readonly flashes: Flash[] = [];
  /** Junction position and depletion edges (px). */
  centre = 0;
  left = 0;
  right = 0;
  bias = 0;
  doping = DOPING_DEFAULT;
  /** Counters since creation, for tests and for the readout of what the animation is doing. */
  crossings = 0;
  recombinations = 0;
  generated = 0;
  private rand: () => number;
  private gauss: () => number;
  private spare: number | undefined;

  constructor(
    public width: number,
    public height: number,
    seed = 1,
  ) {
    this.rand = rng(seed);
    this.gauss = () => {
      if (this.spare !== undefined) {
        const s = this.spare;
        this.spare = undefined;
        return s;
      }
      const u = Math.max(1e-12, this.rand());
      const r = Math.sqrt(-2 * Math.log(u));
      const t = 2 * Math.PI * this.rand();
      this.spare = r * Math.sin(t);
      return r * Math.cos(t);
    };
    this.centre = width / 2;
    this.setBias(0);
    this.populate();
  }

  /** Pixel margin of the picture inside the canvas (contacts are drawn there). */
  static readonly margin = 14;

  resize(width: number, height: number): void {
    const kx = width / this.width;
    this.width = width;
    this.height = height;
    for (const c of this.carriers) {
      c.x *= kx;
      c.y = Math.min(height - PnSim.margin, Math.max(PnSim.margin, c.y));
    }
    this.centre = width / 2;
    this.setBias(this.bias);
    this.rebalance();
  }

  setBias(v: number): void {
    this.bias = v;
    const w = depletionWidth(v, this.doping);
    const px = Math.min(this.width * 0.42, depletionPx(w));
    const split = depletionSplit(w, this.doping);
    const total = split.p + split.n;
    this.left = this.centre - (px * split.p) / total;
    this.right = this.centre + (px * split.n) / total;
    // Carriers that are now inside the depletion region are pushed out to its edge.
    for (const c of this.carriers) {
      if (c.mode !== 'major') continue;
      if (c.kind === 'hole' && c.x > this.left) c.x = this.left - this.rand() * 6;
      if (c.kind === 'electron' && c.x < this.right) c.x = this.right + this.rand() * 6;
    }
  }

  setDoping(doping: number): void {
    this.doping = doping;
    this.setBias(this.bias);
    this.rebalance();
  }

  private spawnMajor(kind: Kind, faded: boolean): void {
    const m = PnSim.margin;
    const x = kind === 'hole' ? m + this.rand() * Math.max(1, this.left - m) : this.right + this.rand() * Math.max(1, this.width - m - this.right);
    this.carriers.push({ kind, x, y: m + this.rand() * (this.height - 2 * m), mode: 'major', life: 0, alpha: faded ? 0 : 1 });
  }

  private populate(): void {
    const n = carrierCount(this.doping, this.width);
    for (let i = 0; i < n; i++) {
      this.spawnMajor('hole', false);
      this.spawnMajor('electron', false);
    }
  }

  /** How many majority carriers of a kind are on screen (not counting the ones fading out). */
  majorityCount(kind: Kind): number {
    return this.carriers.filter((c) => c.kind === kind && c.mode === 'major').length;
  }

  /** Add or remove majority carriers until each side has the number the doping asks for. */
  rebalance(): void {
    const target = carrierCount(this.doping, this.width);
    for (const kind of ['hole', 'electron'] as const) {
      let have = this.majorityCount(kind);
      while (have < target) {
        this.spawnMajor(kind, true);
        have++;
      }
      if (have > target) {
        // Retire the ones nearest the contact: they leave through it.
        const mine = this.carriers.filter((c) => c.kind === kind && c.mode === 'major').sort((a, b) => (kind === 'hole' ? a.x - b.x : b.x - a.x));
        for (let i = 0; i < have - target; i++) mine[i]!.mode = 'fading';
      }
    }
  }

  private edge(kind: Kind): number {
    return kind === 'hole' ? this.left : this.right;
  }

  /** Advance the picture by dt seconds (real time, at most 0.05). */
  step(dt: number): void {
    dt = Math.min(dt, 0.05);
    const m = PnSim.margin;
    const sq = Math.sqrt(dt);
    const pCross = crossingProbability(this.bias, this.doping);
    const genRate = SIM.generation * (depletionWidth(this.bias, this.doping) / depletionWidth(0, this.doping)) ** 1;
    const dead = new Set<Carrier>();

    for (const c of this.carriers) {
      c.alpha = c.mode === 'fading' ? c.alpha - dt * 3 : Math.min(1, c.alpha + dt * 3);
      if (c.mode === 'fading') {
        if (c.alpha <= 0) dead.add(c);
        continue;
      }
      if (c.mode === 'swept') {
        c.x += (c.kind === 'electron' ? 1 : -1) * SIM.swept * dt;
        c.y = Math.min(this.height - m, Math.max(m, c.y + this.gauss() * SIM.jiggle * 0.3 * sq));
        const past = c.kind === 'electron' ? c.x > this.right + 4 : c.x < this.left - 4;
        if (past) {
          // It arrives as a majority carrier of the other side; the contact end lets one go to keep the count.
          c.mode = 'major';
        }
        continue;
      }
      let x = c.x + this.gauss() * SIM.jiggle * sq;
      const y = c.y + this.gauss() * SIM.jiggle * sq;
      c.y = y < m ? 2 * m - y : y > this.height - m ? 2 * (this.height - m) - y : y;
      c.y = Math.min(this.height - m, Math.max(m, c.y));
      const home = c.kind === 'hole' ? 'p' : 'n';
      const inP = (px: number) => px < this.left;
      const inN = (px: number) => px > this.right;
      if (c.mode === 'major') {
        // Majority carriers stay on their own side; at the depletion edge they cross with probability pCross.
        const edge = this.edge(c.kind);
        if (home === 'p' ? x > edge : x < edge) {
          if (this.rand() < pCross) {
            c.mode = 'minor';
            c.life = -Math.log(Math.max(1e-6, this.rand())) * SIM.lifetime;
            x = home === 'p' ? this.right + 2 + this.rand() * 6 : this.left - 2 - this.rand() * 6;
            this.crossings++;
            // The contact supplies a fresh majority carrier at once.
            this.spawnMajor(c.kind, true);
          } else x = 2 * edge - x;
        }
        if (x < m) x = 2 * m - x;
        if (x > this.width - m) x = 2 * (this.width - m) - x;
        c.x = x;
        continue;
      }
      // Minority carrier: wanders, drifts away from the junction, recombines when its time is up.
      const away = c.kind === 'hole' ? 1 : -1;
      x += away * SIM.drift * dt;
      if (c.kind === 'hole' ? !inN(x) : !inP(x)) x = c.kind === 'hole' ? this.right + 1 : this.left - 1;
      if (x < m) x = 2 * m - x;
      if (x > this.width - m) x = 2 * (this.width - m) - x;
      c.x = x;
      c.life -= dt;
      if (c.life <= 0) {
        this.flashes.push({ x: c.x, y: c.y, age: 0 });
        this.recombinations++;
        dead.add(c);
        // The electron it met (or the hole) is replaced from the far contact.
        this.spawnMajor(c.kind === 'hole' ? 'electron' : 'hole', true);
      }
    }

    // Thermal generation: a minority carrier near the depletion edge is swept across at once.
    for (const kind of ['electron', 'hole'] as const) {
      if (this.rand() < genRate * dt) {
        const x = kind === 'electron' ? this.left - this.rand() * 26 : this.right + this.rand() * 26;
        this.carriers.push({ kind, x, y: m + this.rand() * (this.height - 2 * m), mode: 'swept', life: 0, alpha: 1 });
        this.generated++;
      }
    }

    if (dead.size) {
      for (let i = this.carriers.length - 1; i >= 0; i--) if (dead.has(this.carriers[i]!)) this.carriers.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]!;
      f.age += dt;
      if (f.age > FLASH_SECONDS) this.flashes.splice(i, 1);
    }
    this.rebalance();
  }
}
