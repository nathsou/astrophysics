/**
 * b-tagging: is this jet likely to contain a b hadron?
 *
 * A B hadron lives about 1.5 ps, so after a typical boost it flies a few millimetres before it decays: its decay products
 * do not point back to the primary vertex. Two signatures are used:
 *
 *  - **Impact-parameter significance.** For each good track near the jet axis, the transverse impact parameter d0 with
 *    respect to the primary vertex divided by its uncertainty, signed positive when the point of closest approach lies ahead of
 *    the vertex along the jet (the lifetime sign: decay products of something that flew out). Prompt tracks give a
 *    symmetric, unit-width distribution; b decay products a long positive tail. The jet's 1st, 2nd and 3rd largest
 *    significances are the first features.
 *  - **Secondary vertex.** A vertex of two or more displaced tracks with significant flight distance from the primary vertex,
 *    in the jet's direction: its presence, invariant mass (charm and bottom decays differ), flight-distance significance
 *    and track multiplicity.
 *
 * The features are combined by a logistic function whose weights were fitted on simulated b and light jets in the course
 * detector (see README.md for how, and the measured efficiency and mistag rate). Reference for the hook `reco.bTag`.
 */
import { hook } from '../hooks.ts';
import type { P4 } from '../kinematics/index.ts';
import { deltaPhi } from '../kinematics/index.ts';
import { impactParameter, findSecondaryVertices, type RecoVertex } from './vertex.ts';
import type { RecoTrack } from './types.ts';

export interface BTagOptions {
  /** Tracks within this ΔR of the jet axis count (default 0.4). */
  cone?: number;
  minPt?: number;
  /** Track quality: at least this many hits, χ²/ndof below `maxChi2`, |d0| and |dz| w.r.t. the primary vertex below these (mm). */
  minHits?: number;
  maxChi2?: number;
  maxD0?: number;
  maxDz?: number;
  /** Sign the impact parameters with the jet axis (default true). */
  lifetimeSign?: boolean;
}

export interface BTagInfo {
  /** The b-tag score in [0, 1]; 0.5 is the medium working point (≈ 78 % efficiency for b jets and ≈ 1 % for light jets at pT ≈ 50 GeV; 0.85 gives ≈ 70 % and ≈ 0.2 %, see README.md). */
  score: number;
  /** The logistic argument (log-odds). */
  discriminant: number;
  features: number[];
  /** Signed 2-D impact-parameter significances of the selected tracks, largest first. */
  significances: number[];
  /** Indices (into the input track list) of the tracks used. */
  tracks: number[];
  /** The secondary vertex chosen for the jet, if any. */
  vertex?: RecoVertex;
}

/** Weights of the logistic function: bias, then the features listed in `bTagFeatures`. Fitted on simulation (see README.md). */
export const BTAG_WEIGHTS = [-5.701, 0.978, 0.408, 1.14, 1.351, 0.03, 1.483, -0.479, 0.125];

const etaOf = (p: P4) => {
  const pt = Math.hypot(p.px, p.py);
  return pt > 0 ? Math.asinh(p.pz / pt) : 0;
};

/**
 * The features the tag uses: [ln(1+S₁), ln(1+S₂), ln(1+S₃), number of tracks with S > 3 (capped at 6), SV found,
 * SV mass (GeV, capped at 5), ln(1 + flight significance/10), SV track multiplicity (capped at 6)], where S_k is the
 * k-th largest lifetime-signed significance (≥ 0 counted as 0).
 */
export function bTagFeatures(sig: number[], sv?: RecoVertex): number[] {
  const pos = (k: number) => Math.max(0, Math.min(60, sig[k] ?? 0));
  return [
    Math.log1p(pos(0)),
    Math.log1p(pos(1)),
    Math.log1p(pos(2)),
    Math.min(6, sig.filter((s) => s > 3).length),
    sv ? 1 : 0,
    sv ? Math.min(5, sv.mass ?? 0) : 0,
    sv ? Math.log1p(Math.min(200, sv.lxySig ?? 0) / 10) : 0,
    sv ? Math.min(6, sv.tracks.length) : 0,
  ];
}

/** The tag with its ingredients. `vertices` holds the event's vertices: the primary one (kind 'primary') and any secondary ones already found. */
export function bTagInfo(jet: P4, tracks: readonly RecoTrack[], vertices: readonly RecoVertex[], opts: BTagOptions = {}): BTagInfo {
  const cone = opts.cone ?? 0.4;
  const minPt = opts.minPt ?? 1;
  const minHits = opts.minHits ?? 6;
  const maxChi2 = opts.maxChi2 ?? 5;
  const maxD0 = opts.maxD0 ?? 2;
  const maxDz = opts.maxDz ?? 5;
  const pv = vertices.find((v) => v.kind === 'primary') ?? { x: 0, y: 0, z: 0 };
  const ipFn = hook('reco.impactParameter', impactParameter);
  const je = etaOf(jet), jp = Math.atan2(jet.py, jet.px);
  const sel: number[] = [];
  const sig: { s: number; i: number }[] = [];
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i]!;
    if (t.pt < minPt || (t.nLayers ?? t.hits.length) < minHits || t.chi2 / Math.max(1, t.ndof) > maxChi2) continue;
    if (Math.hypot(t.eta - je, deltaPhi(t.phi, jp)) > cone) continue;
    const ip = ipFn(t, pv, opts.lifetimeSign === false ? undefined : jet);
    if (Math.abs(ip.d0) > maxD0 || Math.abs(ip.dz) > maxDz) continue;
    sel.push(i);
    sig.push({ s: ip.significance, i });
  }
  sig.sort((a, b) => b.s - a.s);
  const significances = sig.map((x) => x.s);
  // secondary vertex: one already found in the jet's direction, or find one from the jet's tracks
  let sv: RecoVertex | undefined;
  const inJet = (v: RecoVertex) => Math.hypot(etaDir(v, pv) - je, deltaPhi(Math.atan2(v.y - pv.y, v.x - pv.x), jp)) < 0.3;
  for (const v of vertices) if (v.kind === 'secondary' && inJet(v) && (!sv || (v.lxySig ?? 0) > (sv.lxySig ?? 0))) sv = v;
  if (!sv && sel.length >= 2) {
    const cand = sel.map((i) => tracks[i]!);
    const found = findSecondaryVertices(cand, pv);
    for (const v of found) {
      const vv: RecoVertex = { ...v, tracks: v.tracks.map((k) => sel[k]!) };
      if (inJet(vv) && (!sv || (vv.lxySig ?? 0) > (sv.lxySig ?? 0))) sv = vv;
    }
  }
  const features = bTagFeatures(significances, sv);
  let z = BTAG_WEIGHTS[0]!;
  for (let k = 0; k < features.length; k++) z += BTAG_WEIGHTS[k + 1]! * features[k]!;
  return { score: 1 / (1 + Math.exp(-z)), discriminant: z, features, significances, tracks: sel, vertex: sv };
}

function etaDir(v: RecoVertex, pv: { x: number; y: number; z: number }): number {
  const r = Math.hypot(v.x - pv.x, v.y - pv.y);
  return Math.asinh((v.z - pv.z) / Math.max(r, 1e-9));
}

/**
 * The b-tag score of a jet in [0, 1] (see the file header). Reference for the hook `reco.bTag`; `bTagScore` called from
 * the reconstruction goes through the hook.
 */
export function bTagScore(jet: P4, tracks: RecoTrack[], vertices: RecoVertex[]): number {
  return bTagInfo(jet, tracks, vertices).score;
}
