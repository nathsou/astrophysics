/**
 * Physics and simulation behind "Electrons in a wire".
 *
 * Two parts:
 *  - the numbers (drift speed, electrons per second, signal speed, formatting), all in SI units;
 *  - `WireSim`, a deliberately schematic picture of the free electrons of a copper wire: each one
 *    jiggles thermally (frequent random scattering) and, once the field has reached it, also drifts.
 *
 * The picture cannot be to scale, and the widget says so. In a real wire the drift is about 10⁻⁹ of the
 * thermal speed, so the simulation takes the *ratio* from the physics and multiplies it by an
 * exaggeration factor the reader chooses. Everything is deterministic for a given seed.
 */

/** Elementary charge (C), exact since the 2019 SI. */
export const E_CHARGE = 1.602176634e-19;
/** Free electrons per m³ in copper: one per atom, 8.96 g/cm³ and 63.55 g/mol. */
export const N_COPPER = 8.49e28;
/** Speed of light in vacuum (m/s). */
export const C_LIGHT = 299792458;
/** Root-mean-square thermal speed of a free electron at 300 K, √(3kT/m) (m/s). */
export const V_THERMAL = 1.17e5;
/** Typical velocity factor of insulated wire and cable: the signal travels at about 0.66 c. */
export const VELOCITY_FACTOR = 0.66;

/** Drift speed v = I / (n·A·q), in m/s, for a current in amperes and an area in mm². */
export function driftSpeed(current: number, areaMm2: number, n = N_COPPER, q = E_CHARGE): number {
  return Math.abs(current) / (n * areaMm2 * 1e-6 * q);
}

/** Electrons crossing a section of the wire every second: I / q. */
export function electronsPerSecond(current: number, q = E_CHARGE): number {
  return Math.abs(current) / q;
}

/** Speed at which a change of the field travels along the wire (m/s). */
export function signalSpeed(velocityFactor = VELOCITY_FACTOR): number {
  return velocityFactor * C_LIGHT;
}

/** Time for the signal to cover `length` metres of wire (s). */
export function crossingTime(length: number, velocityFactor = VELOCITY_FACTOR): number {
  return length / signalSpeed(velocityFactor);
}

/** How much the picture exaggerates the ratio drift ÷ thermal speed. */
export type Exaggeration = 1 | 1e6 | 1e9;

/** The drift on screen, as a fraction of the on-screen thermal speed, capped so the picture stays readable. */
export function displayDriftRatio(current: number, areaMm2: number, exaggeration: Exaggeration): { ratio: number; capped: boolean } {
  const raw = (driftSpeed(current, areaMm2) / V_THERMAL) * exaggeration;
  const cap = 2;
  return { ratio: Math.min(raw, cap), capped: raw > cap };
}

// ---------------------------------------------------------------------------------------------
// Formatting.

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };

/** Scientific notation with real superscripts: sci(6.24e18) → "6.2×10¹⁸". */
export function sci(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return '–';
  if (x === 0) return '0';
  const [m, e] = x.toExponential(digits - 1).split('e');
  const exp = String(Number(e));
  return `${m}×10${[...exp].map((c) => SUP[c] ?? c).join('')}`;
}

const SUP_BACK: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '−' };

/**
 * Turn runs of Unicode superscripts into <sup> elements ("6.2×10¹⁸" → "6.2×10<sup>18</sup>"): monospace fonts give
 * every superscript digit a full cell. The input is our own formatted text, so the result is safe for {@html}.
 */
export function supHtml(text: string): string {
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => `<sup>${[...run].map((c) => SUP_BACK[c] ?? c).join('')}</sup>`);
}

function sig3(x: number): string {
  return String(Number(x.toPrecision(3)));
}

/** A speed in m/s as "0.0735 mm/s", "12 µm/s", "1.2 m/s" …; anything down to a micrometre per second is shown in mm/s. */
export function formatSpeed(v: number): string {
  if (v === 0) return '0 m/s';
  if (v >= 1e3) return `${sci(v)} m/s`;
  if (v >= 1) return `${sig3(v)} m/s`;
  if (v >= 1e-6 * 0.9995) return `${sig3(v / 1e-3)} mm/s`;
  if (v >= 1e-9 * 0.9995) return `${sig3(v / 1e-6)} µm/s`;
  return `${sig3(v / 1e-9)} nm/s`;
}

/** A length in metres as "0.88 mm", "26.4 cm", "0.33 µm". */
export function formatLength(m: number): string {
  if (m === 0) return '0 mm';
  if (m >= 1) return `${sig3(m)} m`;
  if (m >= 1e-2) return `${sig3(m / 1e-2)} cm`;
  if (m >= 1e-4) return `${sig3(m / 1e-3)} mm`;
  if (m >= 1e-7) return `${sig3(m / 1e-6)} µm`;
  return `${sig3(m / 1e-9)} nm`;
}

/** A current in amperes for the slider: "10 mA", "1 A". */
export function formatAmps(a: number): string {
  if (a >= 1) return `${sig3(a)} A`;
  return `${sig3(a * 1e3)} mA`;
}

// ---------------------------------------------------------------------------------------------
// The picture.

/** Mulberry32, a small seeded PRNG. */
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

/** Field switch-on and switch-off events at the left end of the wire (display seconds). */
export interface FieldEvent {
  t: number;
  on: boolean;
}

export interface WireSimOptions {
  seed?: number;
  /** Electrons per px². */
  density?: number;
  /** Display thermal speed (px/s). */
  thermal?: number;
  /** Mean time between scattering events (display seconds). */
  tau?: number;
  /** Display seconds the field front takes to cross the whole width. */
  crossing?: number;
  /** Electron radius (px): they bounce off the walls at this distance. */
  radius?: number;
}

/** Number of positions kept in the tagged electron's trail. */
export const TRAIL_LENGTH = 90;

export class WireSim {
  width: number;
  height: number;
  readonly density: number;
  readonly thermal: number;
  readonly tau: number;
  readonly crossing: number;
  readonly radius: number;
  /** Display time (s). */
  t = 0;
  count = 0;
  x = new Float32Array(0);
  y = new Float32Array(0);
  vx = new Float32Array(0);
  vy = new Float32Array(0);
  /** Each electron's current drift velocity along x (px/s): eased towards the target when the field reaches it. */
  drift = new Float32Array(0);
  readonly events: FieldEvent[] = [];
  /** Trail of the tagged electron (index 0), oldest first, as x, y pairs, with wrap-arounds unrolled. */
  readonly trail: number[] = [];
  /** Net displacement of the tagged electron along x since it was tagged (px, wrap-arounds unrolled). */
  taggedDx = 0;
  private readonly rand: () => number;

  constructor(width: number, height: number, options: WireSimOptions = {}) {
    this.width = width;
    this.height = height;
    this.density = options.density ?? 1 / 420;
    this.thermal = options.thermal ?? 90;
    this.tau = options.tau ?? 0.05;
    this.crossing = options.crossing ?? 1.6;
    this.radius = options.radius ?? 3;
    this.rand = rng(options.seed ?? 1);
    this.resize(width, height);
  }

  /** The display speed of the field front (px/s). */
  get frontSpeed(): number {
    return this.width / this.crossing;
  }

  private thermalSpeed(): number {
    // A spread of speeds around the typical one (not exactly Maxwell–Boltzmann; it only has to look alive).
    return this.thermal * (0.55 + 0.9 * this.rand());
  }

  private randomise(i: number): void {
    const a = this.rand() * 2 * Math.PI;
    const s = this.thermalSpeed();
    this.vx[i] = Math.cos(a) * s;
    this.vy[i] = Math.sin(a) * s;
  }

  /**
   * Change the size of the wire. Electrons keep their relative positions; some are added or removed so
   * the density stays the same. The tagged electron (index 0) always survives.
   */
  resize(width: number, height: number): void {
    const oldW = this.width;
    const oldH = this.height;
    const target = Math.max(1, Math.round(width * height * this.density));
    const old = this.count;
    if (target !== old || this.x.length === 0) {
      const grow = <T extends Float32Array>(a: T): T => {
        const b = new Float32Array(target) as T;
        b.set(a.subarray(0, Math.min(old, target)));
        return b;
      };
      this.x = grow(this.x);
      this.y = grow(this.y);
      this.vx = grow(this.vx);
      this.vy = grow(this.vy);
      this.drift = grow(this.drift);
      this.count = target;
    }
    const sx = oldW > 0 ? width / oldW : 1;
    const sy = oldH > 0 ? height / oldH : 1;
    const keep = Math.min(old, target);
    for (let i = 0; i < keep; i++) {
      this.x[i] = this.x[i]! * sx;
      this.y[i] = this.y[i]! * sy;
    }
    for (let i = keep; i < target; i++) {
      this.x[i] = this.rand() * width;
      this.y[i] = this.radius + this.rand() * (height - 2 * this.radius);
      this.randomise(i);
      this.drift[i] = 0;
    }
    this.width = width;
    this.height = height;
  }

  /** Close or open the switch at the left end of the wire (now, in display time). */
  setSwitch(on: boolean): void {
    const last = this.events.at(-1);
    if (last && last.on === on) return;
    if (!last && !on) return;
    this.events.push({ t: this.t, on });
    if (this.events.length > 8) this.events.splice(0, this.events.length - 8);
  }

  /** Is the field on at position x (px from the switch)? The latest change that has reached x decides. */
  fieldAt(x: number, t = this.t): boolean {
    const v = this.frontSpeed;
    for (let k = this.events.length - 1; k >= 0; k--) {
      const e = this.events[k]!;
      if (e.t + x / v <= t) return e.on;
    }
    return false;
  }

  /** Position of the front of the latest change (px), or undefined if it has passed the whole wire. */
  frontX(t = this.t): number | undefined {
    const e = this.events.at(-1);
    if (!e) return undefined;
    const x = (t - e.t) * this.frontSpeed;
    return x >= this.width ? undefined : Math.max(0, x);
  }

  /**
   * Advance the picture by `dt` display seconds. `driftPx` is the drift speed (px/s) that electrons in
   * the field acquire, directed towards −x (electrons drift against the conventional current, which
   * flows from the switch along +x).
   */
  step(dt: number, driftPx: number): void {
    if (!(dt > 0)) return;
    const { width, height, radius } = this;
    const pScatter = 1 - Math.exp(-dt / this.tau);
    const ease = 1 - Math.exp(-dt / 0.25);
    const lo = radius;
    const hi = height - radius;
    for (let i = 0; i < this.count; i++) {
      if (this.rand() < pScatter) this.randomise(i);
      const target = this.fieldAt(this.x[i]!) ? -driftPx : 0;
      this.drift[i] = this.drift[i]! + (target - this.drift[i]!) * ease;
      const dx = (this.vx[i]! + this.drift[i]!) * dt;
      let x = this.x[i]! + dx;
      let y = this.y[i]! + this.vy[i]! * dt;
      if (y < lo) {
        y = 2 * lo - y;
        this.vy[i] = Math.abs(this.vy[i]!);
      } else if (y > hi) {
        y = 2 * hi - y;
        this.vy[i] = -Math.abs(this.vy[i]!);
      }
      y = Math.min(hi, Math.max(lo, y));
      x = ((x % width) + width) % width;
      this.x[i] = x;
      this.y[i] = y;
      if (i === 0) {
        this.taggedDx += dx;
        this.trail.push(this.taggedDx, y);
        if (this.trail.length > TRAIL_LENGTH * 2) this.trail.splice(0, 2);
      }
    }
    this.t += dt;
  }

  /** Mean velocity along x of the electrons whose position satisfies `where` (px/s, including drift). */
  meanVx(where: (x: number) => boolean = () => true): number {
    let s = 0;
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      if (!where(this.x[i]!)) continue;
      s += this.vx[i]! + this.drift[i]!;
      n++;
    }
    return n ? s / n : 0;
  }
}
