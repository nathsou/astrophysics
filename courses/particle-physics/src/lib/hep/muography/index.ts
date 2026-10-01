/**
 * `hep/muography`: a toy model of muon radiography (Chapter 33): cosmic-ray muons at sea level, their absorption by rock, and the counts
 * a detector behind a structure would record.
 *
 * Units: energies in GeV, thickness in g/cm² ("mass thickness": length × density), flux in cm⁻² s⁻¹ sr⁻¹ (GeV⁻¹), angles in radians, zenith
 * angle θ from the vertical. Everything is deterministic; draw the Poisson noise with `hep/random` yourself.
 *
 * The physics, in three steps, each deliberately simple:
 *   1. The spectrum of muons at sea level: the parametrisation of Gaisser as given in the PDG review "Cosmic rays":
 *        dN/dE dΩ = 0.14 E^−2.7 [ 1/(1 + 1.1 E cosθ/115 GeV) + 0.054/(1 + 1.1 E cosθ/850 GeV) ]   cm⁻² s⁻¹ sr⁻¹ GeV⁻¹.
 *      It is meant for E above about 100 GeV/cosθ and zenith angles below about 70°: muography uses only muons that can cross tens of metres
 *      of rock, which is that range. At low energies the angular distribution is close to cos²θ (`lowEnergyIntensity`).
 *   2. Energy loss in rock: the continuous approximation −dE/dx = a + bE with a and b constants of the right size for "standard rock"
 *      (Z = 11, A = 22, ρ = 2.65 g/cm³): the range is R(E) = ln(1 + bE/a)/b and the minimum energy to cross X is (a/b)(e^{bX} − 1).
 *      Real tables have energy-dependent a and b, and fluctuations in the radiative losses; the PDG's muon tables are the reference.
 *   3. Counts: N = I(> E_min(X), θ) · A cosθ · ΔΩ · T for a flat detector of area A, a solid-angle bin ΔΩ and a live time T.
 * Not modelled: the detector's efficiency and angular resolution, scattering in the rock, the charge ratio, low-energy muons that scatter into
 * the acceptance, the atmosphere's seasonal variation, and every background of a real measurement.
 */

/** Muon stopping power constants in rock (GeV cm²/g, cm²/g): −dE/dx = a + b E. "Of the right size", not a fit. */
export interface EnergyLoss {
  a: number;
  b: number;
}
export const STANDARD_ROCK: EnergyLoss = { a: 2.0e-3, b: 4.0e-6 };
/** The density of standard rock in g/cm³. */
export const STANDARD_ROCK_DENSITY = 2.65;

/** PDG: the vertical intensity of muons above 1 GeV at sea level, about 70 m⁻² s⁻¹ sr⁻¹ (about 1 cm⁻² min⁻¹ on a horizontal detector). In cm⁻² s⁻¹ sr⁻¹. */
export const SEA_LEVEL_VERTICAL_INTENSITY = 70e-4;

/** Low-energy angular distribution: I(θ) = I_v cos²θ (cm⁻² s⁻¹ sr⁻¹, integrated above 1 GeV). */
export function lowEnergyIntensity(theta: number, vertical = SEA_LEVEL_VERTICAL_INTENSITY): number {
  const c = Math.cos(theta);
  return c > 0 ? vertical * c * c : 0;
}

/** Gaisser's differential intensity dN/(dE dΩ) of muons of energy E (GeV) at zenith angle θ, cm⁻² s⁻¹ sr⁻¹ GeV⁻¹. */
export function differentialFlux(E: number, theta: number): number {
  const c = Math.cos(theta);
  if (!(c > 0) || !(E > 0)) return 0;
  return 0.14 * Math.pow(E, -2.7) * (1 / (1 + (1.1 * E * c) / 115) + 0.054 / (1 + (1.1 * E * c) / 850));
}

/** The intensity above an energy threshold, ∫_E^∞ dN/dE dE (cm⁻² s⁻¹ sr⁻¹), by Gauss–Legendre quadrature in ln E. */
export function integralFlux(Emin: number, theta: number): number {
  if (!(Emin > 0)) return 0;
  const lo = Math.log(Emin), hi = Math.log(Math.max(Emin * 1.0001, 1e6));
  const n = 64;
  // composite Gauss–Legendre (5 points) on n panels
  const xs = [-0.9061798459386640, -0.5384693101056831, 0, 0.5384693101056831, 0.9061798459386640];
  const ws = [0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665, 0.2369268850561891];
  let sum = 0;
  const h = (hi - lo) / n;
  for (let i = 0; i < n; i++) {
    const mid = lo + (i + 0.5) * h;
    for (let k = 0; k < 5; k++) {
      const lnE = mid + 0.5 * h * xs[k]!;
      const E = Math.exp(lnE);
      sum += 0.5 * h * ws[k]! * differentialFlux(E, theta) * E;
    }
  }
  return sum;
}

/** The mean range (g/cm²) of a muon of energy E (GeV): R = ln(1 + bE/a)/b. */
export function range(E: number, loss: EnergyLoss = STANDARD_ROCK): number {
  return Math.log(1 + (loss.b * E) / loss.a) / loss.b;
}
/** The energy (GeV) a muon needs to cross X g/cm² on average: (a/b)(e^{bX} − 1). The inverse of `range`. */
export function minimumEnergy(X: number, loss: EnergyLoss = STANDARD_ROCK): number {
  return (loss.a / loss.b) * Math.expm1(loss.b * X);
}
/** The energy (GeV) after crossing X g/cm², or 0 if the muon stops: E e^{−bX} − (a/b)(1 − e^{−bX}). */
export function energyAfter(E: number, X: number, loss: EnergyLoss = STANDARD_ROCK): number {
  const v = E * Math.exp(-loss.b * X) - (loss.a / loss.b) * (1 - Math.exp(-loss.b * X));
  return Math.max(0, v);
}

/** The intensity (cm⁻² s⁻¹ sr⁻¹) of muons that have crossed X g/cm² of rock at zenith angle θ. */
export function transmittedIntensity(X: number, theta: number, loss: EnergyLoss = STANDARD_ROCK): number {
  return integralFlux(minimumEnergy(X, loss), theta);
}

/** Mass thickness in g/cm² of `lengthM` metres of material of density `density` (g/cm³). */
export const massThickness = (lengthM: number, density: number): number => lengthM * 100 * density;

/**
 * The expected number of muons in a direction bin behind X g/cm² of rock: I(>E_min(X), θ) · A cosθ · ΔΩ · T.
 * areaM2 in m², solidAngle in sr, seconds in s.
 */
export function expectedCount(X: number, theta: number, areaM2: number, solidAngle: number, seconds: number, loss: EnergyLoss = STANDARD_ROCK): number {
  return transmittedIntensity(X, theta, loss) * areaM2 * 1e4 * Math.cos(theta) * solidAngle * seconds;
}

// ── a two-dimensional structure ─────────────────────────────────────────────────────────────────

export interface Box {
  /** Horizontal position of the centre (m, from the pyramid's axis) and height of the centre (m above the base). */
  x: number;
  z: number;
  /** Full width and full height (m). */
  w: number;
  h: number;
}

export interface Pyramid2D {
  /** Base width (m) and height (m) of the triangular cross-section, centred on x = 0, base at z = 0. */
  base: number;
  height: number;
}

/** The length (m) a ray from (x0, z0) in direction (dx, dz) (unit) spends inside a box, or 0. The slab method. */
export function lengthInBox(x0: number, z0: number, dx: number, dz: number, b: Box): number {
  let tmin = 0, tmax = Infinity;
  const slabs: [number, number, number, number][] = [
    [x0, dx, b.x - b.w / 2, b.x + b.w / 2],
    [z0, dz, b.z - b.h / 2, b.z + b.h / 2],
  ];
  for (const [o, d, lo, hi] of slabs) {
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return 0;
    } else {
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return 0;
    }
  }
  return Math.max(0, tmax - tmin);
}

/** The distance (m) from a point inside the triangle to its boundary along a ray, for a ray going upwards (dz > 0). */
export function exitDistance(x0: number, z0: number, dx: number, dz: number, p: Pyramid2D): number {
  // The two sloping faces: |x| / (base/2) + z / height = 1.
  const half = p.base / 2;
  const k = 1 / half, m = 1 / p.height;
  let best = Infinity;
  for (const sgn of [1, -1]) {
    // sgn·x·k + z·m = 1
    const den = sgn * dx * k + dz * m;
    if (den <= 1e-12) continue;
    const t = (1 - (sgn * x0 * k + z0 * m)) / den;
    if (t > 0 && t < best) best = t;
  }
  return best;
}

/**
 * The rock thickness (g/cm²) seen from a detector at (x0, z0) inside the pyramid, looking up at zenith angle θ in the plane of the cross-section
 * (θ > 0 towards +x). A hidden chamber (an empty box) removes its length of rock.
 */
export function slantThickness(p: Pyramid2D, detector: { x: number; z: number }, theta: number, density: number, chamber?: Box | null): number {
  const dx = Math.sin(theta), dz = Math.cos(theta);
  const total = exitDistance(detector.x, detector.z, dx, dz, p);
  if (!Number.isFinite(total)) return 0;
  const inChamber = chamber ? Math.min(total, lengthInBox(detector.x, detector.z, dx, dz, chamber)) : 0;
  return massThickness(total - inChamber, density);
}

/** The hook names registered by this module (none: muography has no reader exercise). */
export const HOOKS = [] as const;
