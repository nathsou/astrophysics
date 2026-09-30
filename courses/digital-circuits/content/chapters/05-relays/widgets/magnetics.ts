/**
 * The physics behind the electromagnet figure: the field of a straight wire (Ørsted's compass),
 * of a solenoid, and of a solenoid with an iron core, and the pull on an iron plate.
 * SI units throughout.
 */

/** Permeability of free space, T·m/A. */
export const MU0 = 4e-7 * Math.PI;
/** Horizontal component of the Earth's field where Ørsted worked (Copenhagen), tesla. About 17 µT; rounded up. */
export const EARTH_HORIZONTAL = 20e-6;
/** Flux density at which soft iron saturates (tesla). Real soft iron saturates near 2 T; a small core is lower. */
export const IRON_SATURATION = 1.6;
/** How much a rod of soft iron in a coil multiplies the field. A closed iron circuit can do several thousand; an open rod far less. */
export const IRON_GAIN = 500;

/** Field at distance `r` (m) from a long straight wire carrying `i` amperes. */
export function wireField(i: number, r: number): number {
  return (MU0 * i) / (2 * Math.PI * Math.max(r, 1e-4));
}

/** Angle (degrees) a compass needle turns away from north when the wire's field points at right angles to the Earth's. */
export function compassDeflection(bWire: number, bEarth = EARTH_HORIZONTAL): number {
  return (Math.atan2(bWire, bEarth) * 180) / Math.PI;
}

/** Field inside a long solenoid of `turns` turns and length `length` (m) carrying `i` amperes, in air. */
export function solenoidField(turns: number, i: number, length: number): number {
  return (MU0 * turns * i) / Math.max(length, 1e-3);
}

/**
 * Field inside the same solenoid with an iron core: the air value times the core's gain, bent over
 * smoothly at saturation (B → B_sat however hard you drive it).
 */
export function ironCoreField(turns: number, i: number, length: number, gain = IRON_GAIN, saturation = IRON_SATURATION): number {
  const linear = gain * solenoidField(turns, i, length);
  return saturation * Math.tanh(linear / saturation);
}

/** Pull (newtons) on an iron plate touching a pole face of area `area` (m²) where the flux density is `b`: F = B²A / 2μ₀. */
export function pullForce(b: number, area: number): number {
  return (b * b * area) / (2 * MU0);
}

/** Mass (kg) that force lifts against gravity. */
export const liftableMass = (force: number): number => force / 9.81;

/** Format a flux density: "1.3 mT", "20 µT", "0.63 T". */
export function formatTesla(b: number): string {
  const a = Math.abs(b);
  if (a >= 0.1) return `${b.toFixed(2)} T`;
  if (a >= 1e-3) return `${(b * 1e3).toPrecision(2)} mT`;
  if (a >= 1e-6) return `${(b * 1e6).toPrecision(2)} µT`;
  return `${(b * 1e9).toPrecision(2)} nT`;
}
