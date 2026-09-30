import type { Track, RecoEvent, Vertex, Cluster, RecoObject } from '../event/index.ts';

/** A reconstructed track with the extra information reconstruction keeps beyond the shared `Track`. */
export interface RecoTrack extends Track {
  /** Direction at the perigee (same as `phi`), tanλ = sinh η and signed curvature (1/mm). */
  tanLambda: number;
  c: number;
  /** Impact parameters relative to the beam line (x = y = 0), before any primary-vertex correction. */
  d0Raw: number;
  z0Raw: number;
  /** Expected uncertainties of d0 and z0 (mm), from the track error model (hit resolution and scattering). */
  sigmaD0: number;
  sigmaZ0: number;
  /** Covariance of (d0, φ0, c, z0, tanλ). */
  cov: number[][];
  /** Number of layers crossed without a hit, and the layers with hits. */
  nLayers: number;
}

export interface RecoCluster extends Cluster {
  /** Energy-weighted widths in η and φ. */
  etaWidth: number;
  phiWidth: number;
  /** Number of cells. */
  nCells: number;
  /** Depth (layer) of the energy-weighted centre. */
  depth: number;
  /** Truth particles (by index) contributing, with their summed cell energy (GeV), largest first. Only with truth. */
  truthEnergy?: { truth: number; energy: number }[];
}

export interface RecoObjectX extends RecoObject {
  /** Calorimeter-based isolation (energy in the cone, excluding the object), relative to pT. */
  caloIsolation?: number;
  /** For leptons: E/p, hadronic fraction, number of muon stations, etc. */
  variables?: Record<string, number>;
}

export interface MatchInfo {
  /** Truth particles (final-state, charged, in acceptance) that could be reconstructed, and how many were. */
  nTruthTracks: number;
  nMatchedTracks: number;
  nFakeTracks: number;
}

export interface RecoEventFull extends RecoEvent {
  tracks: RecoTrack[];
  clusters: RecoCluster[];
  objects: RecoObjectX[];
  vertices: Vertex[];
  /** Index of the hard-scatter primary vertex in `vertices` (−1 if none was found). */
  primaryVertex: number;
  /** Particle-flow candidates used for the jets. */
  pfCandidates?: import('./objects.ts').PFCandidate[];
  /** Truth-matching summary, present when the truth record was given. */
  match?: MatchInfo;
}
