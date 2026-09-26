// Scene data for the "Powers of Ten" zoom (scales-zoom): frames, a small real star catalogue,
// planetary elements and procedural generators for the Oort cloud, the Milky Way, the Local Group
// and the cosmic web. Everything here runs once on the CPU in f64 and is packed into f32 buffers
// in *layer-local* units (R⊕, AU, pc, kpc, Mpc) so every GPU coordinate stays O(1)–O(10⁴).

import { blackbodyRGB } from '../../lib/physics/blackbody';

export const R_EARTH = 6.371e6;
export const AU = 1.495978707e11;
export const PC = 3.0856775814913673e16;
export const KPC = 1e3 * PC;
export const MPC = 1e6 * PC;
export const LY = 9.4607304725808e15;

// ---------------------------------------------------------------- frames (row-major 3×3, f64)
export type M3 = number[];
const DEG = Math.PI / 180;
const eps = 23.4393 * DEG;
/** Equatorial (ICRS) → ecliptic. World frame = ecliptic J2000, origin at the Sun. */
export const EQ2ECL: M3 = [1, 0, 0, 0, Math.cos(eps), Math.sin(eps), 0, -Math.sin(eps), Math.cos(eps)];
// Equatorial → galactic (J2000). Galactic → equatorial is its transpose.
const EQ2GAL: M3 = [
  -0.0548755604, -0.8734370902, -0.4838350155,
  0.4941094279, -0.44482963, 0.7469822445,
  -0.867666149, -0.1980763734, 0.4559837762,
];
const T = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
export const mul3 = (a: M3, b: M3): M3 => {
  const o = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) o[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c];
  return o;
};
export const apply3 = (m: M3, v: number[]) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
export const GAL2ECL = mul3(EQ2ECL, T(EQ2GAL));
export const IDENT: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export const sph = (lonDeg: number, latDeg: number) => {
  const l = lonDeg * DEG, b = latDeg * DEG;
  return [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
};

// ---------------------------------------------------------------- random numbers
export function rng(seed: number) {
  let s = seed >>> 0;
  const u = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const g = () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
  return { u, g };
}

// ---------------------------------------------------------------- point buffers
/** Interleaved vec4<f32>: xyz in layer units, w = bit-cast packed RGBA8 (A = brightness). */
export class Points {
  f: Float32Array;
  u: Uint32Array;
  n = 0;
  constructor(public cap: number) {
    this.f = new Float32Array(cap * 4);
    this.u = new Uint32Array(this.f.buffer);
  }
  push(x: number, y: number, z: number, rgb: readonly number[], a: number) {
    if (this.n >= this.cap) return;
    const i = this.n++ * 4;
    this.f[i] = x; this.f[i + 1] = y; this.f[i + 2] = z;
    const q = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
    this.u[i + 3] = (q(rgb[0]) | (q(rgb[1]) << 8) | (q(rgb[2]) << 16) | (q(a) << 24)) >>> 0;
  }
  pushV(v: number[], rgb: readonly number[], a: number) { this.push(v[0], v[1], v[2], rgb, a); }
  view() { return this.f.subarray(0, Math.max(1, this.n) * 4); }
}

// ---------------------------------------------------------------- planets (J2000 mean elements)
// a [AU], e, i, Ω, ϖ, L [deg]
const EL: [string, number, number, number, number, number, number, number[]][] = [
  ['Mercury', 0.387098, 0.20563, 7.005, 48.331, 77.456, 252.251, [0.75, 0.7, 0.65]],
  ['Venus', 0.723332, 0.006772, 3.395, 76.68, 131.533, 181.98, [1, 0.9, 0.7]],
  ['Earth', 1.0, 0.016709, 0.0, 0, 102.947, 100.464, [0.45, 0.65, 1]],
  ['Mars', 1.523679, 0.0934, 1.85, 49.558, 336.041, 355.453, [1, 0.5, 0.3]],
  ['Jupiter', 5.2044, 0.0489, 1.303, 100.464, 14.331, 34.396, [1, 0.85, 0.65]],
  ['Saturn', 9.5826, 0.0565, 2.485, 113.665, 92.432, 49.954, [1, 0.9, 0.6]],
  ['Uranus', 19.2184, 0.046381, 0.773, 74.006, 170.964, 313.232, [0.6, 0.9, 1]],
  ['Neptune', 30.11, 0.008678, 1.77, 131.784, 44.971, 304.88, [0.4, 0.6, 1]],
  ['Pluto', 39.48, 0.2488, 17.16, 110.3, 224.07, 238.93, [0.9, 0.8, 0.7]],
];

function kepler(a: number, e: number, i: number, O: number, w: number, M: number) {
  let E = M;
  for (let k = 0; k < 20; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cO = Math.cos(O), sO = Math.sin(O), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
  return [
    xv * (cO * cw - sO * sw * ci) - yv * (cO * sw + sO * cw * ci),
    xv * (sO * cw + cO * sw * ci) - yv * (sO * sw - cO * cw * ci),
    xv * (sw * si) + yv * (cw * si),
  ];
}

export interface Planet { name: string; pos: number[]; color: number[]; a: number }
export const planets: Planet[] = EL.map(([name, a, e, i, O, pw, L, color]) => ({
  name, a, color,
  pos: kepler(a, e, i * DEG, O * DEG, (pw - O) * DEG, ((L - pw) * DEG) % (2 * Math.PI)),
}));
export const EARTH_AU = planets[2].pos;

/** Orbit polylines as a line-list (pairs of vertices), AU. */
export function orbitLines(): Points {
  const seg = 256;
  const out = new Points(EL.length * seg * 2);
  for (const [, a, e, i, O, pw, , color] of EL) {
    let prev: number[] | null = null;
    for (let k = 0; k <= seg; k++) {
      const p = kepler(a, e, i * DEG, O * DEG, (pw - O) * DEG, (k / seg) * 2 * Math.PI);
      if (prev) { out.pushV(prev, color, 0.55); out.pushV(p, color, 0.55); }
      prev = p;
    }
  }
  return out;
}

/** Moon orbit in Earth radii (Earth layer). */
export const MOON_POS = (() => { const r = 60.27, th = 2.1; return [r * Math.cos(th), r * Math.sin(th) * Math.cos(5.1 * DEG), r * Math.sin(th) * Math.sin(5.1 * DEG)]; })();
export function moonOrbit(): Points {
  const out = new Points(256 * 2);
  const c = Math.cos(5.1 * DEG), s = Math.sin(5.1 * DEG);
  let prev: number[] | null = null;
  for (let k = 0; k <= 256; k++) {
    const th = (k / 256) * 2 * Math.PI;
    const p = [60.27 * Math.cos(th), 60.27 * Math.sin(th) * c, 60.27 * Math.sin(th) * s];
    if (prev) { out.pushV(prev, [0.6, 0.65, 0.8], 0.5); out.pushV(p, [0.6, 0.65, 0.8], 0.5); }
    prev = p;
  }
  return out;
}

// Voyager 1 (2026): ~169 AU towards RA 17h13m, Dec +12°.
export const VOYAGER1_AU = apply3(EQ2ECL, sph(258.3, 12.0)).map((v) => v * 169);

/** Planets as bright points + asteroid belt + Kuiper belt + Voyager (AU). */
export function solarPoints(): Points {
  const { u, g } = rng(7);
  const out = new Points(34000);
  for (const p of planets) out.pushV(p.pos, p.color, 1);
  out.pushV(VOYAGER1_AU, [0.7, 1, 0.8], 0.8);
  for (let k = 0; k < 16000; k++) { // main belt, 2.1–3.3 AU, Kirkwood-ish gaps
    let a = 2.1 + 1.2 * u();
    if (Math.abs(a - 2.5) < 0.03 || Math.abs(a - 2.82) < 0.03) a += 0.06;
    const th = u() * 2 * Math.PI, inc = g() * 0.12, r = a * (1 + g() * 0.06);
    out.push(r * Math.cos(th), r * Math.sin(th), r * Math.sin(inc), [0.85, 0.75, 0.6], 0.03 + 0.08 * u());
  }
  for (let k = 0; k < 16000; k++) { // Kuiper belt 30–50 AU, plutinos at 39.4
    const a = u() < 0.25 ? 39.4 + g() * 0.6 : 42 + 5 * g();
    const th = u() * 2 * Math.PI, inc = g() * 0.18;
    out.push(a * Math.cos(th), a * Math.sin(th), a * Math.sin(inc), [0.7, 0.8, 1], 0.04 + 0.1 * u());
  }
  return out;
}

/** Oort cloud, units of AU: flattened inner (Hills) cloud + isotropic outer cloud. */
export function oortPoints(n: number): Points {
  const { u, g } = rng(11);
  const out = new Points(n);
  for (let k = 0; k < n; k++) {
    const inner = u() < 0.35;
    const r = inner ? 2000 * Math.pow(10, u() * 1.0) : 2e4 * Math.pow(10, u() * 0.75);
    let v = [g(), g(), g()];
    if (inner) v[2] *= 0.45;
    const l = Math.hypot(v[0], v[1], v[2]);
    v = v.map((x) => (x / l) * r);
    out.pushV(v, [0.72, 0.82, 1], 0.12 + 0.18 * u());
  }
  return out;
}

// ---------------------------------------------------------------- nearby stars (pc, equatorial)
// name, RA°, Dec°, distance pc, Teff K, absolute V magnitude, label?
type Star = [string, number, number, number, number, number, number];
export const STARS: Star[] = [
  ['Sirius', 101.287, -16.716, 2.64, 9940, 1.42, 1], ['Canopus', 95.988, -52.696, 95, 7350, -5.53, 1],
  ['α Centauri', 219.902, -60.834, 1.34, 5790, 4.38, 1], ['Proxima', 217.429, -62.68, 1.3, 3042, 15.5, 0],
  ['Arcturus', 213.915, 19.182, 11.3, 4286, -0.3, 1], ['Vega', 279.235, 38.784, 7.68, 9602, 0.58, 1],
  ['Capella', 79.172, 45.998, 13.1, 4970, -0.48, 0], ['Rigel', 78.634, -8.202, 260, 12100, -7.84, 1],
  ['Procyon', 114.826, 5.225, 3.51, 6530, 2.66, 1], ['Achernar', 24.429, -57.237, 42.7, 15000, -2.77, 0],
  ['Betelgeuse', 88.793, 7.407, 168, 3600, -5.85, 1], ['Hadar', 210.956, -60.373, 120, 25000, -5.42, 0],
  ['Altair', 297.696, 8.868, 5.13, 7700, 2.22, 1], ['Acrux', 186.65, -63.099, 99, 28000, -4.19, 0],
  ['Aldebaran', 68.98, 16.509, 20, 3910, -0.63, 1], ['Antares', 247.352, -26.432, 170, 3570, -5.28, 1],
  ['Spica', 201.298, -11.161, 77, 22400, -3.55, 1], ['Pollux', 116.329, 28.026, 10.4, 4666, 1.08, 0],
  ['Fomalhaut', 344.413, -29.622, 7.7, 8590, 1.72, 1], ['Deneb', 310.358, 45.28, 800, 8500, -8.4, 1],
  ['Mimosa', 191.93, -59.689, 85, 27000, -3.92, 0], ['Regulus', 152.093, 11.967, 24, 12460, -0.52, 0],
  ['Adhara', 104.656, -28.972, 124, 22200, -4.11, 0], ['Castor', 113.65, 31.888, 15.6, 10286, 0.59, 0],
  ['Shaula', 263.402, -37.104, 175, 25000, -5.05, 0], ['Bellatrix', 81.283, 6.35, 77, 22000, -2.78, 0],
  ['Elnath', 81.573, 28.607, 41, 13600, -1.42, 0], ['Alnilam', 84.053, -1.202, 600, 27500, -6.4, 0],
  ['Alnitak', 85.19, -1.943, 226, 29000, -5.25, 0], ['Mintaka', 83.002, -0.299, 380, 29500, -4.99, 0],
  ['Saiph', 86.939, -9.67, 200, 26000, -4.65, 0], ['Polaris', 37.955, 89.264, 133, 6015, -3.6, 1],
  ['Alioth', 193.507, 55.96, 25, 9020, -0.21, 0], ['Dubhe', 165.932, 61.751, 37.7, 4660, -1.1, 0],
  ['Mizar', 200.981, 54.925, 26, 9000, 0.33, 0], ['Alkaid', 206.885, 49.313, 31.9, 15540, -0.6, 0],
  ['Merak', 165.46, 56.382, 24.4, 9377, 0.41, 0], ['Phecda', 178.458, 53.695, 25.5, 9355, 0.36, 0],
  ['Megrez', 183.857, 57.033, 24.7, 9480, 1.33, 0], ['Mirfak', 51.081, 49.861, 155, 6350, -5.1, 0],
  ['Wezen', 107.098, -26.393, 490, 6390, -6.87, 0], ['Sargas', 264.33, -42.998, 83, 7268, -2.75, 0],
  ['Kaus Australis', 276.043, -34.385, 44, 9960, -1.44, 0], ['Avior', 125.628, -59.509, 185, 3800, -4.58, 0],
  ['Menkalinan', 89.882, 44.948, 25, 9350, -0.1, 0], ['Alhena', 99.428, 16.399, 33.5, 9260, -0.6, 0],
  ['Peacock', 306.412, -56.735, 55, 17800, -1.81, 0], ['Mirzam', 95.675, -17.956, 150, 23150, -3.95, 0],
  ['Alphard', 141.897, -8.659, 55, 4120, -1.69, 0], ['Hamal', 31.793, 23.462, 20.2, 4480, 0.47, 0],
  ['Algol', 47.042, 40.956, 28, 13000, -0.07, 0], ['Denebola', 177.265, 14.572, 11, 8500, 1.92, 0],
  ['Schedar', 10.127, 56.537, 70, 4660, -1.99, 0], ["Barnard's Star", 269.452, 4.693, 1.83, 3134, 13.2, 1],
  ['Wolf 359', 164.12, 7.015, 2.41, 2800, 16.6, 1], ['Lalande 21185', 165.834, 35.97, 2.55, 3547, 10.46, 0],
  ['Luyten 726-8', 24.75, -17.95, 2.68, 2670, 15.4, 0], ['Ross 154', 282.455, -23.836, 2.97, 3340, 13.07, 0],
  ['ε Eridani', 53.233, -9.458, 3.22, 5084, 6.19, 1], ['Lacaille 9352', 346.47, -35.85, 3.29, 3688, 9.75, 0],
  ['61 Cygni', 316.73, 38.75, 3.49, 4526, 7.49, 0], ['ε Indi', 330.84, -56.79, 3.64, 4630, 6.89, 0],
  ['τ Ceti', 26.017, -15.938, 3.65, 5344, 5.68, 1], ['Groombridge 34', 4.6, 44.02, 3.56, 3700, 10.3, 0],
  ["Kapteyn's Star", 77.92, -45.02, 3.93, 3570, 10.9, 0], ['TRAPPIST-1', 346.622, -5.041, 12.4, 2566, 18.4, 1],
  ['Pleiades', 56.871, 24.105, 136, 12258, -2.4, 1], ['η Carinae', 161.265, -59.685, 2300, 36000, -8.6, 1],
  ['μ Cephei', 325.877, 58.78, 940, 3750, -7.6, 0],
];

export const starPos = (s: Star) => apply3(EQ2ECL, sph(s[1], s[2])).map((v) => v * s[3]);

/** Catalogue + procedural field stars, units pc, ecliptic axes (so the layer rotation is identity). */
export function starPoints(nField: number): Points {
  const { u, g } = rng(23);
  const out = new Points(STARS.length + nField + 1);
  for (const s of STARS) {
    const a = Math.max(0.12, Math.min(1, 0.45 + (1.5 - s[5]) / 12));
    out.pushV(starPos(s), blackbodyRGB(s[4]), a);
  }
  for (let k = 0; k < nField; k++) {
    // uniform in a 700 pc disc, exponential in height (h = 0.25 kpc), in galactic axes
    const r = 700 * Math.sqrt(u()), th = u() * 2 * Math.PI;
    const z = -250 * Math.log(u() + 1e-9) * (u() < 0.5 ? -1 : 1) * 0.6;
    const x = r * Math.cos(th), y = r * Math.sin(th);
    const p = apply3(GAL2ECL, [x, y, z]);
    const q = u();
    let Tk: number, a: number;
    if (q < 0.45) { Tk = 3000 + 1500 * u(); a = 0.05 + 0.08 * u(); }
    else if (q < 0.8) { Tk = 5000 + 2000 * u(); a = 0.08 + 0.14 * u(); }
    else if (q < 0.93) { Tk = 7500 + 2500 * u(); a = 0.15 + 0.25 * u(); }
    else if (q < 0.97) { Tk = 11000 + 15000 * u(); a = 0.3 + 0.4 * u(); }
    else { Tk = 3500 + 800 * u(); a = 0.25 + 0.3 * u(); } // red giants
    out.pushV(p, blackbodyRGB(Tk), a * (0.9 + 0.2 * g()));
  }
  return out;
}

// ---------------------------------------------------------------- galaxies
export const R_SUN_GC = 8.18; // kpc (GRAVITY 2019)

interface GalOpts {
  n: number; rd: number; arms: number; pitch: number; bulge: number; bar: number; h: number;
  seed: number; dust?: Points | null; young?: number;
}

/**
 * Procedural barred spiral: exponential disc with logarithmic arms, a triaxial bar/bulge,
 * blackbody-coloured populations and a separate list of dust "absorber" particles.
 * Output in kpc, galaxy frame (disc in xy); `xf` maps to the layer frame.
 */
export function spiral(out: Points, o: GalOpts, xf: (v: number[]) => number[]) {
  const { u, g } = rng(o.seed);
  const tanP = Math.tan(o.pitch * DEG);
  const barAng = -27 * DEG; // bar major axis ~27° from Sun–GC line (MW)
  const armTheta = (r: number, arm: number) => (arm * 2 * Math.PI) / o.arms + Math.log(r / 1.5) / tanP;
  for (let k = 0; k < o.n; k++) {
    const q = u();
    if (q < o.bulge) {
      // bar/bulge: old, red-yellow
      let x = g() * o.bar, y = g() * o.bar * 0.38, z = g() * o.bar * 0.3;
      const c = Math.cos(barAng), s = Math.sin(barAng);
      [x, y] = [x * c - y * s, x * s + y * c];
      out.pushV(xf([x, y, z]), blackbodyRGB(3800 + 1200 * u()), 0.35 + 0.3 * u());
      continue;
    }
    // disc radius from Gamma(2) (exponential surface density)
    const r = -o.rd * Math.log(u() * u() + 1e-9) + 0.6;
    if (r > o.rd * 6.5) { k--; continue; }
    const inArm = u() < 0.62;
    let th: number;
    if (inArm) {
      const arm = Math.floor(u() * o.arms);
      th = armTheta(r, arm) + g() * 0.2 * (1 + 0.15 * r / o.rd);
    } else th = u() * 2 * Math.PI;
    const young = inArm && u() < (o.young ?? 0.45);
    const z = g() * (young ? o.h * 0.35 : o.h) * (1 + r / (4 * o.rd));
    const p = [r * Math.cos(th), r * Math.sin(th), z];
    if (young) {
      const hii = u() < 0.035;
      if (hii) out.pushV(xf(p), [1, 0.35, 0.5], 0.9);
      else out.pushV(xf(p), blackbodyRGB(8000 + 22000 * u() * u()), 0.45 + 0.4 * u());
    } else out.pushV(xf(p), blackbodyRGB(4200 + 2600 * u()), 0.25 + 0.3 * u());
    // dust lanes trail the arms on their inner (concave) edge
    if (o.dust && inArm && u() < 0.3) {
      const th2 = th - 0.12;
      o.dust.pushV(xf([r * Math.cos(th2), r * Math.sin(th2), g() * o.h * 0.15]), [1, 1, 1], 0.6 + 0.4 * u());
    }
  }
}

/** Milky Way, kpc, galactocentric with galactic axes (Sun at (−8.18, 0, 0.02)). */
export function milkyWay(n: number) {
  const pts = new Points(n);
  const dust = new Points(Math.ceil(n * 0.2));
  // mirror y so arms trail for the MW's clockwise rotation seen from the NGP
  spiral(pts, { n, rd: 2.6, arms: 4, pitch: 12, bulge: 0.14, bar: 1.6, h: 0.3, seed: 3, dust }, (v) => [v[0], -v[1], v[2]]);
  return { pts, dust };
}

// Local Group + nearby groups: name, l°, b°, d [Mpc], type (0 spiral, 1 dwarf, 2 irregular, 3 elliptical), size kpc, weight, label
type Gal = [string, number, number, number, number, number, number, number];
export const LOCAL: Gal[] = [
  ['Andromeda (M31)', 121.17, -21.57, 0.765, 0, 30, 1, 1], ['Triangulum (M33)', 133.61, -31.33, 0.84, 0, 9, 0.35, 1],
  ['LMC', 280.47, -32.89, 0.05, 2, 5, 0.25, 1], ['SMC', 302.8, -44.3, 0.062, 2, 2.5, 0.12, 1],
  ['Sagittarius dSph', 5.6, -14.2, 0.026, 1, 2, 0.04, 0], ['NGC 6822', 25.3, -18.4, 0.5, 2, 1.5, 0.05, 1],
  ['IC 1613', 129.7, -60.6, 0.73, 2, 1.8, 0.04, 0], ['M32', 121.15, -22.0, 0.763, 3, 1, 0.05, 0],
  ['M110', 120.72, -21.14, 0.8, 3, 2, 0.06, 0], ['Leo I', 226, 49.1, 0.254, 1, 0.8, 0.02, 0],
  ['Fornax', 237.1, -65.7, 0.147, 1, 1, 0.02, 0], ['Sculptor', 287.5, -83.2, 0.086, 1, 0.8, 0.015, 0],
  ['WLM', 75.9, -73.6, 0.93, 2, 1.5, 0.03, 0], ['IC 10', 119, -3.3, 0.8, 2, 1, 0.03, 0],
  ['Leo A', 196.9, 52.4, 0.8, 2, 0.8, 0.015, 0], ['Pegasus dIrr', 94.8, -43.6, 0.92, 2, 0.8, 0.015, 0],
  ['Draco', 86.4, 34.7, 0.076, 1, 0.5, 0.01, 0], ['Ursa Minor', 105, 44.8, 0.076, 1, 0.5, 0.01, 0],
  ['Carina', 260.1, -22.2, 0.105, 1, 0.5, 0.01, 0], ['Sextans', 243.5, 42.3, 0.086, 1, 0.6, 0.01, 0],
  ['Phoenix', 272.2, -68.9, 0.415, 2, 0.6, 0.01, 0], ['Tucana', 322.9, -47.4, 0.88, 1, 0.5, 0.01, 0],
  ['Antlia', 263.1, 22.3, 1.3, 1, 0.5, 0.01, 0], ['NGC 185', 120.8, -14.5, 0.62, 3, 1, 0.03, 0],
  ['NGC 147', 119.8, -14.3, 0.68, 3, 1, 0.03, 0],
  ['M81 group', 142.1, 40.9, 3.6, 0, 18, 0.6, 1], ['M82', 141.4, 40.6, 3.55, 2, 6, 0.2, 0],
  ['Centaurus A', 309.5, 19.4, 3.8, 3, 20, 0.6, 1], ['Sculptor Galaxy (NGC 253)', 97.4, -88, 3.5, 0, 14, 0.4, 1],
  ['M83', 314.6, 32, 4.7, 0, 12, 0.35, 0], ['Maffei 1', 135.9, -0.55, 3.0, 3, 10, 0.3, 0],
];
export const galPosMpc = (g: Gal) => sph(g[1], g[2]).map((v) => v * g[3]);

/** Local Group points in Mpc, galactic axes centred on the Sun. */
export function localGroup(n: number): Points {
  const { u, g } = rng(99);
  const out = new Points(n + 500);
  const wsum = LOCAL.reduce((s, x) => s + x[6], 0);
  LOCAL.forEach((gal, gi) => {
    const c = galPosMpc(gal);
    const count = Math.max(150, Math.round((n * gal[6]) / wsum));
    const s = gal[5] / 1000; // kpc→Mpc
    // random disc orientation (M31 given its real ~77° inclination-ish tilt)
    const nx = g(), ny = g(), nz = g();
    const nl = Math.hypot(nx, ny, nz);
    const nrm = gi === 0 ? [0.3, -0.85, 0.43] : [nx / nl, ny / nl, nz / nl];
    const t1 = normalize(cross(nrm, [0.3, 0.2, 1]));
    const t2 = cross(nrm, t1);
    const xf = (v: number[]) => [0, 1, 2].map((k) => c[k] + (v[0] * t1[k] + v[1] * t2[k] + v[2] * nrm[k]) * s / 10);
    if (gal[4] === 0) spiral(out, { n: count, rd: 10 / 3.2, arms: 2, pitch: 16, bulge: 0.2, bar: 1.2, h: 0.2, seed: 50 + gi }, xf);
    else {
      for (let k = 0; k < count; k++) {
        const flat = gal[4] === 3 ? 0.7 : 0.9;
        const r = gal[4] === 2 ? 4 : 3;
        const v = [g() * r, g() * r * flat, g() * r * (gal[4] === 2 ? 0.4 : flat)];
        const T = gal[4] === 2 ? 5000 + 12000 * u() : 3800 + 1500 * u();
        out.pushV(xf(v), blackbodyRGB(T), 0.3 + 0.3 * u());
      }
    }
  });
  return out;
}

// Superclusters / clusters seeded into the web: name, l, b, d Mpc, richness
export const CLUSTERS: [string, number, number, number, number][] = [
  ['Virgo Cluster', 283.8, 74.5, 16.5, 3], ['Fornax Cluster', 236.7, -53.6, 19, 1.5],
  ['Norma Cluster (Great Attractor)', 325.3, -7.3, 68, 3], ['Coma Cluster', 58, 88, 100, 4],
  ['Perseus Cluster', 150.6, -13.3, 73, 3], ['Centaurus Cluster', 302.4, 21.6, 48, 2],
  ['Hydra Cluster', 269.6, 26.5, 54, 2], ['Shapley Supercluster', 312, 31, 200, 6],
  ['Hercules Supercluster', 31.5, 44.5, 150, 3],
];
export const clusterPos = (c: [string, number, number, number, number]) => sph(c[1], c[2]).map((v) => v * c[3]);

const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: number[]) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return a.map((x) => x / l); };

/**
 * Cosmic web in Mpc (galactic axes, centred on us). Three nested shells with node spacing
 * ~45 Mpc, ~230 Mpc and ~1.3 Gpc so that the web looks filamentary at every zoom level up to
 * the particle horizon, while the particle budget stays bounded. Nodes = Poisson "clusters",
 * filaments = links to the 3 nearest neighbours, points scattered along each link.
 */
export function cosmicWeb(budget: number): Points {
  const out = new Points(budget);
  const shells: { R: number; rin: number; N: number; per: number; gain: number; seed: number }[] = [
    { R: 420, rin: 0, N: 2600, per: 0.42, gain: 0.35, seed: 5 },
    { R: 2600, rin: 400, N: 4200, per: 0.3, gain: 0.6, seed: 6 },
    { R: 14000, rin: 2500, N: 5200, per: 0.28, gain: 1.0, seed: 8 },
  ];
  for (const sh of shells) {
    const { u, g } = rng(sh.seed);
    const nodes: number[][] = [];
    const mass: number[] = [];
    if (sh.rin === 0) for (const c of CLUSTERS) { nodes.push(clusterPos(c)); mass.push(c[4]); }
    while (nodes.length < sh.N) {
      const p = [u() * 2 - 1, u() * 2 - 1, u() * 2 - 1];
      if (p[0] ** 2 + p[1] ** 2 + p[2] ** 2 > 1) continue;
      nodes.push(p.map((x) => x * sh.R * 1.05));
      mass.push(Math.min(6, 0.3 / Math.pow(u() + 0.02, 0.8)));
    }
    const spacing = sh.R * Math.cbrt((4 / 3) * Math.PI / sh.N);
    const budgetShell = Math.floor(budget * sh.per);
    const perNode = budgetShell / sh.N;
    // neighbour search on a uniform grid
    const cell = spacing * 1.2, dim = Math.ceil((2.2 * sh.R) / cell);
    const grid = new Map<number, number[]>();
    const key = (p: number[]) => { const i = Math.floor(p[0] / cell + dim / 2), j = Math.floor(p[1] / cell + dim / 2), k = Math.floor(p[2] / cell + dim / 2); return (i * dim + j) * dim + k; };
    nodes.forEach((p, i) => { const kk = key(p); (grid.get(kk) ?? grid.set(kk, []).get(kk)!).push(i); });
    const keep = (p: number[]) => { const r = Math.hypot(p[0], p[1], p[2]); return r >= sh.rin && r <= sh.R; };
    const rgbCl = [1, 0.86, 0.7], rgbFil = [0.75, 0.82, 1];
    nodes.forEach((p, i) => {
      const i0 = Math.floor(p[0] / cell + dim / 2), j0 = Math.floor(p[1] / cell + dim / 2), k0 = Math.floor(p[2] / cell + dim / 2);
      const cand: [number, number][] = [];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const lst = grid.get(((i0 + a) * dim + j0 + b) * dim + k0 + c);
        if (lst) for (const j of lst) if (j > i) cand.push([j, Math.hypot(nodes[j][0] - p[0], nodes[j][1] - p[1], nodes[j][2] - p[2])]);
      }
      cand.sort((x, y) => x[1] - y[1]);
      const nCl = Math.round(perNode * 0.35 * Math.min(3, mass[i]));
      for (let k = 0; k < nCl; k++) {
        const s = spacing * 0.035 * Math.sqrt(mass[i]);
        const q = [p[0] + g() * s, p[1] + g() * s, p[2] + g() * s];
        if (keep(q)) out.pushV(q, rgbCl, Math.min(1, sh.gain * (0.35 + 0.3 * u())));
      }
      for (const [j, d] of cand.slice(0, 3)) {
        if (d > spacing * 1.7) continue;
        const nF = Math.round(perNode * 0.22 * (d / spacing));
        const b = nodes[j];
        for (let k = 0; k < nF; k++) {
          const t = u(), s = d * 0.035;
          const q = [p[0] + (b[0] - p[0]) * t + g() * s, p[1] + (b[1] - p[1]) * t + g() * s, p[2] + (b[2] - p[2]) * t + g() * s];
          if (keep(q)) out.pushV(q, rgbFil, sh.gain * (0.15 + 0.2 * u()));
        }
      }
    });
  }
  return out;
}

// JADES-GS-z14-0: RA 53.083°, Dec −27.866°, comoving distance ≈ 10.1 Gpc (z = 14.3).
export const JADES_MPC = apply3(mul3(EQ2GAL, IDENT), sph(53.083, -27.866)).map((v) => v * 10100);
/** Comoving radius of the last-scattering surface, m (≈ 13.9 Gpc ≈ 45 Gly). */
export const R_CMB = 13.9e3 * MPC;
