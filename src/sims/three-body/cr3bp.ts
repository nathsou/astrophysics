// Shared CR3BP maths for the Chapter 3 sims: rotating-frame effective potential, Lagrange points,
// Jacobi constant and the equations of motion. Units: total mass = 1, separation = 1, ω = 1 (so
// the orbital period of the two primaries is 2π). Primary (mass 1-μ) sits at (-μ, 0), secondary
// (mass μ) at (1-μ, 0).

export interface CR3BPState extends Float64Array {} // [x, y, vx, vy]

/** Effective potential Ω(x,y) = ½(x²+y²) + (1-μ)/r1 + μ/r2 (centrifugal + both gravity wells). */
export function omega(x: number, y: number, mu: number): number {
  const r1 = Math.hypot(x + mu, y);
  const r2 = Math.hypot(x - 1 + mu, y);
  return 0.5 * (x * x + y * y) + (1 - mu) / r1 + mu / r2;
}

export function omegaGrad(x: number, y: number, mu: number): [number, number] {
  const dx1 = x + mu, dx2 = x - 1 + mu;
  const r1 = Math.hypot(dx1, y), r2 = Math.hypot(dx2, y);
  const r1c = r1 * r1 * r1, r2c = r2 * r2 * r2;
  const ox = x - (1 - mu) * dx1 / r1c - mu * dx2 / r2c;
  const oy = y - (1 - mu) * y / r1c - mu * y / r2c;
  return [ox, oy];
}

/** Jacobi constant: C = 2Ω − v². Conserved along any CR3BP trajectory. */
export function jacobi(s: ArrayLike<number>, mu: number): number {
  return 2 * omega(s[0], s[1], mu) - (s[2] * s[2] + s[3] * s[3]);
}

/** Rotating-frame acceleration including the Coriolis terms: ẍ = 2ẏ + Ωx, ÿ = −2ẋ + Ωy. */
export function accel(s: ArrayLike<number>, mu: number): [number, number] {
  const [ox, oy] = omegaGrad(s[0], s[1], mu);
  return [2 * s[3] + ox, -2 * s[2] + oy];
}

/** One RK4 step of the CR3BP equations of motion, in place. */
export function rk4Step(s: Float64Array, mu: number, h: number) {
  const f = (x: number, y: number, vx: number, vy: number) => {
    const [ax, ay] = accel([x, y, vx, vy], mu);
    return [vx, vy, ax, ay];
  };
  const [x, y, vx, vy] = s;
  const k1 = f(x, y, vx, vy);
  const k2 = f(x + (h / 2) * k1[0], y + (h / 2) * k1[1], vx + (h / 2) * k1[2], vy + (h / 2) * k1[3]);
  const k3 = f(x + (h / 2) * k2[0], y + (h / 2) * k2[1], vx + (h / 2) * k2[2], vy + (h / 2) * k2[3]);
  const k4 = f(x + h * k3[0], y + h * k3[1], vx + h * k3[2], vy + h * k3[3]);
  for (let i = 0; i < 4; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}

export interface LagrangePoints {
  L1: [number, number]; L2: [number, number]; L3: [number, number];
  L4: [number, number]; L5: [number, number];
}

/** Newton's method for the three collinear points on y=0, refining the Hill-radius approximation. */
function solveCollinear(mu: number, x0: number): number {
  const g = (x: number) => {
    const d1 = x + mu, d2 = x - 1 + mu;
    return x - (1 - mu) * d1 / Math.abs(d1) ** 3 - mu * d2 / Math.abs(d2) ** 3;
  };
  let x = x0;
  for (let i = 0; i < 60; i++) {
    const eps = 1e-6;
    const dg = (g(x + eps) - g(x - eps)) / (2 * eps);
    const step = g(x) / dg;
    x -= step;
    if (Math.abs(step) < 1e-14) break;
  }
  return x;
}

export function lagrangePoints(mu: number): LagrangePoints {
  const rh = Math.cbrt(mu / 3); // Hill-radius approximation, used as the Newton seed
  const L1 = solveCollinear(mu, 1 - mu - rh);
  const L2 = solveCollinear(mu, 1 - mu + rh);
  const L3 = solveCollinear(mu, -1 - (5 / 12) * mu);
  const h3 = Math.sqrt(3) / 2;
  return { L1: [L1, 0], L2: [L2, 0], L3: [L3, 0], L4: [0.5 - mu, h3], L5: [0.5 - mu, -h3] };
}

/** Routh's stability criterion: L4/L5 are linearly stable iff μ < μ_c = ½(1 − √(23/27)). */
export const MU_CRIT = 0.5 * (1 - Math.sqrt(23 / 27));

export const PRESET_MU: Record<string, { mu: number; label: string }> = {
  earthMoon: { mu: 0.012150585, label: 'Earth–Moon' },
  sunJupiter: { mu: 0.0009537, label: 'Sun–Jupiter' },
  equal: { mu: 0.3, label: 'Equal-ish (μ = 0.3)' },
};
