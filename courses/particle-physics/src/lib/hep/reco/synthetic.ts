/**
 * Synthetic detector output for reconstruction tests and exercises: helical tracks in a uniform field with
 * multiple scattering and Gaussian smearing in the barrel layers of a `RecoGeometry`, optional noise hits and pile-up
 * tracks. It is a stand-in that does not depend on the detector module; the real detector simulation is tested in
 * the integration tests.
 */
import { normal, poisson, type Rng } from '../random/index.ts';
import type { Hit } from '../event/index.ts';
import { curvatureFromPt, propagateToRadius, type HelixState } from './helix.ts';
import { DEFAULT_GEOMETRY, type RecoGeometry } from './geometry.ts';

export interface SynthTrack {
  pt: number;
  eta: number;
  phi: number;
  charge: number;
  /** Production vertex (mm). */
  vertex: [number, number, number];
  /** Index for `Hit.truth`. */
  id: number;
  /** Collision this particle belongs to (0 = signal). */
  collision: number;
}

/** Highland's formula for the projected scattering angle, for a particle of momentum p (GeV) and thickness t = x/X0. */
export function highland(p: number, t: number, mass = 0.13957): number {
  if (t <= 0) return 0;
  const beta = p / Math.sqrt(p * p + mass * mass);
  return (0.0136 / (beta * p)) * Math.sqrt(t) * (1 + 0.038 * Math.log(t));
}

/** Hits of one track through the barrel layers, with multiple scattering and smearing. */
export function simulateTrackHits(r: Rng, t: SynthTrack, geom: RecoGeometry = DEFAULT_GEOMETRY, opts: { ms?: boolean; smear?: boolean; efficiency?: number } = {}): Hit[] {
  const ms = opts.ms ?? true;
  const smear = opts.smear ?? true;
  const eff = opts.efficiency ?? 1;
  const hits: Hit[] = [];
  const tanL0 = Math.sinh(t.eta);
  const p = t.pt * Math.cosh(t.eta);
  let st: HelixState = { x: t.vertex[0], y: t.vertex[1], z: t.vertex[2], psi: t.phi, tanLambda: tanL0, c: curvatureFromPt(t.pt, geom.bField, t.charge) };
  for (let i = 0; i < geom.layers.length; i++) {
    const L = geom.layers[i]!;
    const nxt = propagateToRadius(st, L.r);
    if (!nxt || nxt.ds <= 0) break;
    st = nxt;
    const z = st.z;
    if (Math.abs(z) > geom.zMax) break;
    if (r() < eff) {
      const phiPos = Math.atan2(st.y, st.x);
      const dphi = smear ? normal(r, 0, L.sigmaRPhi) / L.r : 0;
      hits.push({
        layer: i,
        x: L.r * Math.cos(phiPos + dphi),
        y: L.r * Math.sin(phiPos + dphi),
        z: z + (smear ? normal(r, 0, L.sigmaZ) : 0),
        truth: t.id,
      });
    }
    if (ms && L.xOverX0 > 0) {
      const lam = Math.atan(st.tanLambda);
      const cosInc = Math.abs(Math.cos(st.psi - Math.atan2(st.y, st.x)));
      const path = L.xOverX0 / (Math.max(0.2, cosInc) * Math.cos(lam));
      const th = highland(t.pt * Math.cosh(Math.asinh(st.tanLambda)), path);
      const dPsi = normal(r, 0, th) / Math.cos(lam);
      const dLam = normal(r, 0, th);
      const lam2 = lam + dLam;
      st = { ...st, psi: st.psi + dPsi, tanLambda: Math.tan(lam2), c: st.c * (Math.cos(lam) / Math.cos(lam2)) };
    }
  }
  return hits;
}

/** Uniformly random noise hits: on average `perLayer` in each layer. */
export function noiseHits(r: Rng, perLayer: number, geom: RecoGeometry = DEFAULT_GEOMETRY): Hit[] {
  const out: Hit[] = [];
  for (let i = 0; i < geom.layers.length; i++) {
    const L = geom.layers[i]!;
    const n = poisson(r, perLayer);
    const zl = L.r * Math.sinh(geom.etaMax);
    for (let k = 0; k < n; k++) {
      const ph = (r() * 2 - 1) * Math.PI;
      out.push({ layer: i, x: L.r * Math.cos(ph), y: L.r * Math.sin(ph), z: (2 * r() - 1) * zl, truth: -1 });
    }
  }
  return out;
}

/** A minimum-bias-like charged particle: flat in η, pT from a gamma(2) distribution with mean ≈ 0.55 GeV. */
export function minBiasTrack(r: Rng, id: number, vertex: [number, number, number], collision: number, etaMax = 2.5): SynthTrack {
  const pt = Math.max(0.15, -0.275 * Math.log((1 - r()) * (1 - r())));
  return { pt, eta: (2 * r() - 1) * etaMax, phi: (2 * r() - 1) * Math.PI, charge: r() < 0.5 ? 1 : -1, vertex, id, collision };
}

export interface SynthEvent {
  hits: Hit[];
  tracks: SynthTrack[];
}

/**
 * An event: the given signal tracks from the vertex (0, 0, zv), plus `pileup` minimum-bias collisions with about
 * `nchPerCollision` charged particles each, vertices spread in z with σ = geom.luminousZ, plus noise hits.
 */
export function synthEvent(
  r: Rng,
  signal: Omit<SynthTrack, 'id' | 'collision' | 'vertex'>[],
  opts: { pileup?: number; nchPerCollision?: number; zv?: number; noise?: number; geom?: RecoGeometry; ms?: boolean; efficiency?: number } = {},
): SynthEvent {
  const geom = opts.geom ?? DEFAULT_GEOMETRY;
  const zv = opts.zv ?? 0;
  const tracks: SynthTrack[] = [];
  const hits: Hit[] = [];
  const add = (t: SynthTrack) => {
    tracks.push(t);
    hits.push(...simulateTrackHits(r, t, geom, { ms: opts.ms, efficiency: opts.efficiency }));
  };
  for (const s of signal) add({ ...s, vertex: [0, 0, zv], id: tracks.length, collision: 0 });
  const nPU = opts.pileup ?? 0;
  for (let c = 1; c <= nPU; c++) {
    const v: [number, number, number] = [normal(r, 0, geom.beamSpotXY), normal(r, 0, geom.beamSpotXY), normal(r, 0, geom.luminousZ)];
    const n = poisson(r, opts.nchPerCollision ?? 25);
    for (let k = 0; k < n; k++) add(minBiasTrack(r, tracks.length, v, c, geom.etaMax));
  }
  if (opts.noise) hits.push(...noiseHits(r, opts.noise, geom));
  return { hits, tracks };
}
