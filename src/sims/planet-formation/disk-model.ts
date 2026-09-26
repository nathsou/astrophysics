// A minimal-mass-solar-nebula (MMSN) disk model shared by the Chapter 8 figures and page script.
// CGS units internally unless stated. Hayashi (1981): Σ_gas = 1700 (r/AU)^-3/2 g cm⁻², T = 280 (r/AU)^-1/2 K.

export const AU_CM = 1.495978707e13;
export const YR_S = 3.15576e7;
export const G_CGS = 6.674e-8;
export const MSUN_G = 1.98847e33;
export const MEARTH_G = 5.9722e27;
export const KB = 1.380649e-16;
export const MH = 1.6735e-24;
export const MU = 2.34; // mean molecular weight of H₂ + He gas
export const SIGMA_SB = 5.670374e-5;

export interface Disk {
  /** Gas surface density scale relative to the MMSN. */
  sigmaScale: number;
  /** Stellar luminosity (L☉) for the irradiation temperature. */
  L: number;
  /** Stellar mass (M☉). */
  M: number;
}

export const mmsn = (): Disk => ({ sigmaScale: 1, L: 1, M: 1 });

export const sigmaGas = (d: Disk, rAU: number) => 1700 * d.sigmaScale * rAU ** -1.5;
/** Solid surface density, ×4.2 beyond the snow line (Hayashi's ice enhancement). */
export const sigmaSolid = (d: Disk, rAU: number, snowAU = 2.7 * Math.sqrt(d.L)) =>
  7.1 * d.sigmaScale * rAU ** -1.5 * (rAU > snowAU ? 4.2 : 1);
export const temperature = (d: Disk, rAU: number) => 280 * d.L ** 0.25 * rAU ** -0.5;
export const soundSpeed = (T: number) => Math.sqrt((KB * T) / (MU * MH)); // cm/s
export const omega = (d: Disk, rAU: number) => Math.sqrt((G_CGS * d.M * MSUN_G) / (rAU * AU_CM) ** 3); // s⁻¹
export const vKep = (d: Disk, rAU: number) => omega(d, rAU) * rAU * AU_CM; // cm/s
/** Aspect ratio h = H/r = c_s / v_K. */
export const aspect = (d: Disk, rAU: number) => soundSpeed(temperature(d, rAU)) / vKep(d, rAU);
export const rhoMid = (d: Disk, rAU: number) => sigmaGas(d, rAU) / (Math.sqrt(2 * Math.PI) * aspect(d, rAU) * rAU * AU_CM);
/** Headwind parameter η = −½ h² dlnP/dlnr; for Σ ∝ r^-3/2, T ∝ r^-1/2, dlnP/dlnr = −13/4. */
export const eta = (d: Disk, rAU: number) => (13 / 8) * aspect(d, rAU) ** 2;
/** Mean free path of H₂ molecules (cm). */
export const mfp = (d: Disk, rAU: number) => (MU * MH) / (rhoMid(d, rAU) * 2e-15);

/** Stokes number of a grain of radius s (cm) and material density rhoS (g cm⁻³) at the midplane. */
export function stokes(d: Disk, rAU: number, s: number, rhoS = 1.6): number {
  const cs = soundSpeed(temperature(d, rAU));
  const vth = Math.sqrt(8 / Math.PI) * cs;
  let ts = (rhoS * s) / (rhoMid(d, rAU) * vth); // Epstein
  const lam = mfp(d, rAU);
  if (s > (9 / 4) * lam) ts *= (4 * s) / (9 * lam); // Stokes regime (low Reynolds number)
  return ts * omega(d, rAU);
}

/** Radial drift speed (cm/s, positive = inward) of a solid with Stokes number St. */
export const driftSpeed = (d: Disk, rAU: number, St: number) => (2 * eta(d, rAU) * vKep(d, rAU) * St) / (1 + St * St);

/** Invert stokes() for s by bisection in log space. */
export function sizeForStokes(d: Disk, rAU: number, St: number, rhoS = 1.6): number {
  let lo = -6, hi = 9;
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (lo + hi);
    if (stokes(d, rAU, 10 ** mid, rhoS) < St) lo = mid; else hi = mid;
  }
  return 10 ** (0.5 * (lo + hi));
}

/** Isolation mass (M⊕) for feeding-zone half-width b Hill radii. */
export function isolationMass(d: Disk, rAU: number, b = 10): number {
  const r = rAU * AU_CM;
  const m = (2 * Math.PI * b * r * r * sigmaSolid(d, rAU)) ** 1.5 / Math.sqrt(3 * d.M * MSUN_G);
  return m / MEARTH_G;
}

/** Viscous timescale r²/ν (yr) for an α-disk. */
export const viscousTime = (d: Disk, rAU: number, alpha: number) => 1 / (alpha * aspect(d, rAU) ** 2 * omega(d, rAU)) / YR_S;

/** Snow line radius (AU) for an optically thin irradiated disk with T = 280 L^¼ r^-½ K and T_ice. */
export const snowLine = (L: number, Tice = 170) => (280 / Tice) ** 2 * Math.sqrt(L);
