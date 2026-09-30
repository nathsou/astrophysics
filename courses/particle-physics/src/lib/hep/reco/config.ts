/** Tunable parameters of the reconstruction. Every field has a default; pass a `Partial<RecoConfig>` to change some. */
export interface RecoConfig {
  // ── tracking ──
  /** Lowest pT (GeV) of a track the finder looks for. Seeds are searched for tracks above it. */
  ptMin: number;
  /** Largest |d0| (mm) of a seed relative to the beam line. Bigger values find displaced tracks but cost time. */
  d0Max: number;
  /** Largest |z0| (mm) of a seed. Default: five times the length of the luminous region. */
  z0Max: number;
  /** Smallest number of hits on a track. Default: 6, or all layers if there are fewer than 8. */
  minHits: number;
  /** Tracks with a worse χ²/ndof (with scattering included in the hit uncertainties) are dropped. */
  maxChi2PerDof: number;
  /** Two tracks may share at most this many hits; otherwise the worse one is dropped. */
  maxSharedHits: number;
  /** Half-width of the extension roads in units of the expected uncertainty. */
  roadSigmas: number;
  /** 'triplets' (pixel-triplet seeds) or 'hough' (seeds from peaks of the Hough transform in the transverse plane). */
  seeding: 'triplets' | 'hough';
  // ── vertices ──
  /** Minimum tracks for a primary vertex. */
  minVertexTracks: number;
  /** Tracks with |z0 − z_vertex| below this many σ are assigned to a vertex. */
  vertexAssocSigma: number;
  // ── calorimetry ──
  /**
   * Seed and growth thresholds (GeV, on raw cell energy) for topological clusters, per calorimeter. 0 means automatic,
   * from the calorimeter's cell noise σ: seed max(0.25, 8σ) GeV in the ECAL and max(0.5, 8σ) in the HCAL, growth max(0.05, 3σ).
   */
  ecalSeed: number;
  ecalGrow: number;
  hcalSeed: number;
  hcalGrow: number;
  /** Clusters below these energies (GeV) are dropped. */
  ecalClusterMin: number;
  hcalClusterMin: number;
  // ── objects ──
  /** Jet algorithm radius and minimum pT. */
  jetR: number;
  jetPtMin: number;
  /** Neutral particle-flow candidates below this pT (GeV) are not clustered into jets (they are mostly pile-up, and they cost time). */
  jetInputPtMin: number;
  /** Lepton and photon pT thresholds (GeV). */
  electronPtMin: number;
  muonPtMin: number;
  photonPtMin: number;
  tauPtMin: number;
  /** Charged-hadron subtraction: drop charged particles from pile-up vertices before jet clustering. */
  chs: boolean;
  /** Matching of reco tracks to truth: minimum fraction of hits from one particle. */
  matchPurity: number;
  /** Compute b-tag scores for jets. */
  bTag: boolean;
  /**
   * Calibrate the calorimeters' energy scale against the detector simulation before the first use of a configuration
   * (see `calibrateCalorimeters`; the result is remembered per configuration object). Turn it off for real data, or give the
   * scales directly in a `RecoGeometry`.
   */
  autoCalibrate: boolean;
}

export const DEFAULT_RECO_CONFIG: RecoConfig = {
  ptMin: 0.5,
  d0Max: 3,
  z0Max: 250,
  minHits: 0, // 0 = choose from the geometry
  maxChi2PerDof: 4,
  maxSharedHits: 1,
  roadSigmas: 4,
  seeding: 'triplets',
  minVertexTracks: 2,
  vertexAssocSigma: 4,
  ecalSeed: 0,
  ecalGrow: 0,
  hcalSeed: 0,
  hcalGrow: 0,
  ecalClusterMin: 0.5,
  hcalClusterMin: 1.0,
  jetR: 0.4,
  jetPtMin: 15,
  jetInputPtMin: 0.5,
  electronPtMin: 5,
  muonPtMin: 3,
  photonPtMin: 10,
  tauPtMin: 20,
  chs: true,
  matchPurity: 0.5,
  bTag: true,
  autoCalibrate: true,
};

export function resolveConfig(rc?: Partial<RecoConfig>): RecoConfig {
  return { ...DEFAULT_RECO_CONFIG, ...(rc ?? {}) };
}
