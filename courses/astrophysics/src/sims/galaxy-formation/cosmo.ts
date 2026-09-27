// Shared helpers for chapter 23 sims: flat ΛCDM time–redshift relation, code units, a seeded RNG
// and the toy initial conditions for the assembly flagship.

export const H0 = 67.7; // km/s/Mpc
export const OM = 0.31;
export const OL = 0.69;
const H0_perGyr = (H0 * 1e3) / 3.0857e22 * 3.15576e16; // H0 in 1/Gyr (≈ 0.0692)

/** Cosmic time (Gyr) at redshift z, flat matter + Λ (radiation neglected). */
export function ageAt(z: number): number {
  const x = Math.sqrt(OL / OM) * Math.pow(1 + z, -1.5);
  return (2 / (3 * H0_perGyr * Math.sqrt(OL))) * Math.asinh(x);
}
/** Inverse of ageAt. */
export function redshiftAt(tGyr: number): number {
  const s = Math.sinh(1.5 * H0_perGyr * Math.sqrt(OL) * tGyr) / Math.sqrt(OL / OM);
  return Math.pow(s, -2 / 3) - 1;
}
export const AGE_NOW = ageAt(0);

// ---- code units for the flagship: G = 1, M = 1.5e12 Msun, L = 250 kpc ----
const Gsi = 6.6743e-11, Msun = 1.98847e30, kpc = 3.0857e19, kB = 1.380649e-23, mp = 1.67262e-27;
export const UNIT_M = 1.5e12; // Msun
export const UNIT_L = 250; // kpc
const Lm = UNIT_L * kpc, Mkg = UNIT_M * Msun;
export const UNIT_T_S = Math.sqrt((Lm * Lm * Lm) / (Gsi * Mkg));
export const UNIT_T_GYR = UNIT_T_S / 3.15576e16; // ≈ 1.52
export const UNIT_V_KMS = Lm / UNIT_T_S / 1e3; // ≈ 161
const UNIT_RHO_CGS = (Mkg / (Lm * Lm * Lm)) * 1e-3; // g/cm^3
export const FB = 0.157; // cosmic baryon fraction Ωb/Ωm
const MU = 0.6;
/** T = tconv · σ²_3D(code): kT = μ m_p σ_1D². */
export const TCONV = (MU * mp * (UNIT_V_KMS * 1e3) ** 2) / (3 * kB);
/** t_cool(code) = COOLK · T / (ρ_code · Λ₂₂) with n = f_b ρ / (μ m_p). */
export const COOLK = (1.5 * 1.380649e-16) / (((FB * UNIT_RHO_CGS) / (MU * 1.67262e-24)) * 1e-22 * UNIT_T_S);

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STRIDE = 12; // floats per particle (3 × vec4)

/**
 * Toy initial conditions: ~40 Plummer clumps (mass function dN/dM ∝ M^-1.9) plus a smooth
 * component, inside a sphere of radius ~1.6 (400 kpc), with a slight net rotation about z.
 * Layout: [nsrc DM sources][DM tracers][gas]. Only the sources carry gravitating mass.
 */
export function makeICs(N: number, nsrc: number, seed: number) {
  const rnd = mulberry32(seed * 7919 + 17);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const K = 40, fSmooth = 0.2;
  const cm: number[] = [], cx: number[][] = [], cv: number[][] = [], ca: number[] = [];
  let tot = 0;
  for (let k = 0; k < K; k++) {
    const m = k === 0 ? 0.12 : Math.pow(1 - rnd() * (1 - Math.pow(60, -0.9)), -1 / 0.9) * 0.002;
    cm.push(m); tot += m;
  }
  const Omega = 0.28;
  for (let k = 0; k < K; k++) {
    cm[k] *= (1 - fSmooth) / tot;
    let p: number[];
    if (k === 0) p = [0, 0, 0];
    else {
      let tries = 0;
      do {
        const r = 0.35 + 1.25 * Math.pow(rnd(), 0.6);
        const u = 2 * rnd() - 1, ph = 2 * Math.PI * rnd(), s = Math.sqrt(1 - u * u);
        p = [r * s * Math.cos(ph), r * s * Math.sin(ph), r * u * 0.8];
      } while (++tries < 30 && cx.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 0.22));
    }
    cx.push(p);
    // bulk motion: slow infall + rotation about z + small random peculiar velocity
    cv.push([-0.08 * p[0] - Omega * p[1] + 0.08 * gauss(), -0.08 * p[1] + Omega * p[0] + 0.08 * gauss(), -0.08 * p[2] + 0.08 * gauss()]);
    ca.push(0.075 * Math.cbrt(cm[k] / 0.05));
  }
  const cdf: number[] = [];
  let acc = 0;
  for (const m of cm) { acc += m; cdf.push(acc); }

  const data = new Float32Array(N * STRIDE);
  const nDM = N >> 1;
  const sample = (i: number, type: number, scale: number) => {
    const o = i * STRIDE;
    const r0 = rnd();
    let k = cdf.findIndex((c) => r0 < c);
    let x: number, y: number, z: number, vx: number, vy: number, vz: number;
    if (k < 0) {
      // smooth component: uniform sphere of radius 1.6
      let a: number, b: number, c: number;
      do { a = 2 * rnd() - 1; b = 2 * rnd() - 1; c = 2 * rnd() - 1; } while (a * a + b * b + c * c > 1);
      x = 1.6 * a; y = 1.6 * b; z = 1.6 * c * 0.8;
      vx = -0.08 * x - Omega * y + 0.1 * gauss(); vy = -0.08 * y + Omega * x + 0.1 * gauss(); vz = -0.08 * z + 0.1 * gauss();
    } else {
      const a = ca[k] * scale;
      const u = 0.02 + 0.9 * rnd();
      const r = a / Math.sqrt(Math.pow(u, -2 / 3) - 1);
      const mu = 2 * rnd() - 1, ph = 2 * Math.PI * rnd(), s = Math.sqrt(1 - mu * mu);
      const sig = Math.sqrt(cm[k] / (6 * ca[k])) * Math.pow(1 + (r * r) / (a * a), -0.25);
      x = cx[k][0] + r * s * Math.cos(ph); y = cx[k][1] + r * s * Math.sin(ph); z = cx[k][2] + r * mu;
      vx = cv[k][0] + sig * gauss(); vy = cv[k][1] + sig * gauss(); vz = cv[k][2] + sig * gauss();
    }
    data.set([x, y, z, type, vx, vy, vz, 0, 4, 1, 0, 0], o);
  };
  for (let i = 0; i < N; i++) sample(i, i < nDM ? 0 : 1, i < nDM ? 1 : 1.4);

  // Remove centre-of-mass position/velocity of the sources; measure the spin parameter.
  const c = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < nsrc; i++) for (let j = 0; j < 3; j++) { c[j] += data[i * STRIDE + j] / nsrc; c[3 + j] += data[i * STRIDE + 4 + j] / nsrc; }
  for (let i = 0; i < N; i++) for (let j = 0; j < 3; j++) { data[i * STRIDE + j] -= c[j]; data[i * STRIDE + 4 + j] -= c[3 + j]; }
  const m = 1 / nsrc;
  let Jx = 0, Jy = 0, Jz = 0, Kin = 0, W = 0;
  for (let i = 0; i < nsrc; i++) {
    const o = i * STRIDE;
    const [x, y, z, , vx, vy, vz] = data.subarray(o, o + 7);
    Jx += m * (y * vz - z * vy); Jy += m * (z * vx - x * vz); Jz += m * (x * vy - y * vx);
    Kin += 0.5 * m * (vx * vx + vy * vy + vz * vz);
    for (let j = i + 1; j < nsrc; j++) {
      const q = j * STRIDE;
      W -= (m * m) / Math.sqrt((x - data[q]) ** 2 + (y - data[q + 1]) ** 2 + (z - data[q + 2]) ** 2 + 6e-4);
    }
  }
  const lambda = Math.hypot(Jx, Jy, Jz) * Math.sqrt(Math.abs(Kin + W));
  return { data, nDM, lambda };
}
