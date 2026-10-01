/** Filling a droplet field from a ready-made picture (a still photograph of a simulated event). */
import { MATERIALS, mipLoss, type Material, type Picture, type Track } from '$lib/hep/chamber';
import { rng as makeRng } from '$lib/hep/random';
import { DropletField, FOREVER, dropletsForTrack } from './droplets';

/** The minimum-ionising dE/dx of the picture's medium, restricted to the delta-ray cut, in MeV/mm. */
export function mipPerMm(mat: Material): number {
  return (mipLoss(mat, true) * mat.density) / 10;
}

/**
 * Fill `field` with the droplets (or bubbles) of every visible track of the picture, frozen (they never fade), and return
 * the tracks that belong in the picture (charged ones, and the neutral ones so that they can be drawn dashed on request).
 * `spread` is the time (s) over which the droplets appear, for a short growing animation.
 */
export function fillFromPicture(pic: Picture, field: DropletField, seed: number, spread = 0.2): Track[] {
  const rng = makeRng(seed * 31 + 5);
  const mat = pic.medium === 'liquid hydrogen' ? MATERIALS.hydrogen : pic.medium === 'propane' ? MATERIALS.propane : MATERIALS.air;
  const mip = mipPerMm(mat);
  field.clear();
  const kept: Track[] = [];
  for (const t of pic.set.tracks) {
    if (t.neutral) {
      kept.push(t);
      continue;
    }
    if (!t.points.some((q) => q.visible)) continue;
    kept.push(t);
    field.append(dropletsForTrack(t, rng, { kind: pic.kind, birth: 0.02 + rng() * spread, life: FOREVER, mip, id: t.id }));
  }
  return kept;
}
