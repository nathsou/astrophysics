// Mass models for the rotation-curve lab (see src/sims/milky-way-rotation.ts).
// All lengths in kpc, masses in M_sun, velocities in km/s.
import { besselI0, besselI1, besselK0, besselK1 } from './bessel';

/** G in kpc (km/s)^2 / M_sun. */
export const G_ASTRO = 4.30091e-6;

export interface DiskParams { M: number; Rd: number } // disk (or gas disk) mass, scale length
export interface BulgeParams { M: number; a: number } // Hernquist mass, scale radius
export interface HaloParamsNFW { rho0: number; rs: number }
export interface HaloParamsISO { rho0: number; rc: number }

/** Freeman (1970) exponential-disk rotation speed squared. y = r/(2Rd). */
export function vDisk2(r: number, { M, Rd }: DiskParams): number {
  if (r <= 0 || M <= 0 || Rd <= 0) return 0;
  const sigma0 = M / (2 * Math.PI * Rd * Rd);
  const y = r / (2 * Rd);
  const bracket = besselI0(y) * besselK0(y) - besselI1(y) * besselK1(y);
  return Math.max(0, 4 * Math.PI * G_ASTRO * sigma0 * Rd * y * y * bracket);
}

/** Hernquist (1990) bulge: v^2 = GM r / (r+a)^2. */
export function vBulge2(r: number, { M, a }: BulgeParams): number {
  if (r <= 0 || M <= 0) return 0;
  return (G_ASTRO * M * r) / (r + a) ** 2;
}

/** NFW halo enclosed mass and v^2 = GM(<r)/r. */
export function vHaloNFW2(r: number, { rho0, rs }: HaloParamsNFW): number {
  if (r <= 0 || rho0 <= 0 || rs <= 0) return 0;
  const x = r / rs;
  const Menc = 4 * Math.PI * rho0 * rs ** 3 * (Math.log(1 + x) - x / (1 + x));
  return (G_ASTRO * Menc) / r;
}

/** Pseudo-isothermal (cored) halo: rho = rho0 / (1 + (r/rc)^2), closed-form v^2. */
export function vHaloISO2(r: number, { rho0, rc }: HaloParamsISO): number {
  if (r <= 0 || rho0 <= 0 || rc <= 0) return 0;
  return 4 * Math.PI * G_ASTRO * rho0 * rc * rc * (1 - (rc / r) * Math.atan(r / rc));
}

export interface ModelParams {
  bulge: BulgeParams;
  disk: DiskParams;
  gas: DiskParams;
  halo: HaloParamsNFW | HaloParamsISO;
  haloType: 'nfw' | 'iso';
  noDarkMatter: boolean;
}

/** Total circular speed (km/s) from quadrature sum of components. */
export function vTotal(r: number, p: ModelParams): number {
  const vb2 = vBulge2(r, p.bulge);
  const vd2 = vDisk2(r, p.disk);
  const vg2 = vDisk2(r, p.gas);
  const vh2 = p.noDarkMatter ? 0 : p.haloType === 'nfw' ? vHaloNFW2(r, p.halo as HaloParamsNFW) : vHaloISO2(r, p.halo as HaloParamsISO);
  return Math.sqrt(Math.max(0, vb2 + vd2 + vg2 + vh2));
}

/** Simple MOND prediction (Milgrom's "simple" interpolating function) from the baryons alone. */
export function vMond(r: number, p: ModelParams, a0 = 3700): number {
  // a0 in (km/s)^2/kpc, standard value ≈ 3.7e3 (km/s)^2/kpc ≈ 1.2e-10 m/s^2.
  const vb2 = vBulge2(r, p.bulge) + vDisk2(r, p.disk) + vDisk2(r, p.gas);
  const gN = vb2 / r; // Newtonian acceleration from baryons
  if (gN <= 0) return 0;
  const g = (gN + Math.sqrt(gN * gN + 4 * gN * a0)) / 2; // simple mu-function interpolation
  return Math.sqrt(g * r);
}

/** Generic Nelder–Mead simplex minimiser. Returns the best point found. */
export function nelderMead(f: (x: number[]) => number, x0: number[], opts: { iters?: number; step?: number } = {}): number[] {
  const n = x0.length;
  const iters = opts.iters ?? 400;
  const step = opts.step ?? 0.1;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] *= 1 + step;
    if (p[i] === x0[i]) p[i] += step;
    simplex.push(p);
  }
  let fvals = simplex.map(f);
  const alpha = 1, gamma = 2, rho = 0.5, sigma = 0.5;
  for (let it = 0; it < iters; it++) {
    const order = fvals.map((v, i) => i).sort((a, b) => fvals[a] - fvals[b]);
    simplex = order.map((i) => simplex[i]);
    fvals = order.map((i) => fvals[i]);
    const best = fvals[0], worst = fvals[n];
    if (!Number.isFinite(best) || Math.abs(worst - best) < 1e-10 * (Math.abs(best) + 1e-10)) break;
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) centroid[k] += simplex[i][k] / n;
    const reflect = centroid.map((c, k) => c + alpha * (c - simplex[n][k]));
    const fr = f(reflect);
    if (fr < fvals[0]) {
      const expand = centroid.map((c, k) => c + gamma * (reflect[k] - c));
      const fe = f(expand);
      simplex[n] = fe < fr ? expand : reflect;
      fvals[n] = Math.min(fe, fr);
    } else if (fr < fvals[n - 1]) {
      simplex[n] = reflect;
      fvals[n] = fr;
    } else {
      const contract = centroid.map((c, k) => c + rho * (simplex[n][k] - c));
      const fc = f(contract);
      if (fc < fvals[n]) {
        simplex[n] = contract;
        fvals[n] = fc;
      } else {
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[i].map((v, k) => simplex[0][k] + sigma * (v - simplex[0][k]));
          fvals[i] = f(simplex[i]);
        }
      }
    }
  }
  const order = fvals.map((v, i) => i).sort((a, b) => fvals[a] - fvals[b]);
  return simplex[order[0]];
}

/** Approximate observed rotation-curve data points, for display only (labelled as such in the UI). */
export const MW_DATA: { r: number; v: number; err: number }[] = [
  { r: 1, v: 200, err: 20 }, { r: 2, v: 210, err: 15 }, { r: 3, v: 218, err: 12 },
  { r: 4, v: 223, err: 10 }, { r: 5, v: 226, err: 9 }, { r: 6, v: 228, err: 8 },
  { r: 7, v: 229, err: 7 }, { r: 8.2, v: 230, err: 7 }, { r: 10, v: 232, err: 8 },
  { r: 12, v: 233, err: 10 }, { r: 14, v: 233, err: 12 }, { r: 16, v: 232, err: 14 },
  { r: 18, v: 230, err: 16 }, { r: 20, v: 228, err: 18 },
];

export const NGC3198_DATA: { r: number; v: number; err: number }[] = [
  { r: 1, v: 80, err: 8 }, { r: 2, v: 115, err: 7 }, { r: 3, v: 130, err: 6 },
  { r: 4, v: 140, err: 5 }, { r: 5, v: 148, err: 5 }, { r: 7, v: 152, err: 5 },
  { r: 10, v: 154, err: 5 }, { r: 14, v: 154, err: 6 }, { r: 18, v: 152, err: 6 },
  { r: 22, v: 150, err: 7 }, { r: 26, v: 149, err: 8 }, { r: 30, v: 150, err: 9 },
];
