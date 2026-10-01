/** Spin-½ in a Stern–Gerlach apparatus (Chapter 3): the quantum rules, sampled with a seeded generator. */
import type { Rng } from '../../hep/random/index.ts';

/** The probability that a spin-½ particle prepared "up" along one axis is found "up" along an axis at angle θ to it: cos²(θ/2). */
export const probUp = (theta: number): number => Math.cos(theta / 2) ** 2;

/** The projections m = −s, −s + 1, …, +s of a spin s (given as 2s), in units of ħ. There are 2s + 1 of them. */
export function projections(twoS: number): number[] {
  return Array.from({ length: twoS + 1 }, (_, i) => (-twoS + 2 * i) / 2);
}

/** Send n unpolarised atoms of spin s through a Stern–Gerlach magnet: each comes out in one of 2s + 1 beams, all equally likely. */
export function firstMagnet(r: Rng, n: number, twoS: number): number[] {
  const counts = new Array<number>(twoS + 1).fill(0);
  for (let i = 0; i < n; i++) counts[Math.floor(r() * (twoS + 1))]!++;
  return counts;
}

/** Send n spin-½ atoms, all prepared "up" along z, through a second magnet whose axis is at angle θ to z. Returns the numbers found up and down. */
export function secondMagnet(r: Rng, n: number, theta: number): { up: number; down: number } {
  const p = probUp(theta);
  let up = 0;
  for (let i = 0; i < n; i++) if (r() < p) up++;
  return { up, down: n - up };
}

/**
 * What a classical magnetic moment would do: a little magnet with a random orientation has a z-component μ cosα with cosα uniform in [−1, 1],
 * so the deflection is spread continuously between −1 and +1 instead of falling into two beams.
 */
export function classicalDeflections(r: Rng, n: number): number[] {
  return Array.from({ length: n }, () => 2 * r() - 1);
}
