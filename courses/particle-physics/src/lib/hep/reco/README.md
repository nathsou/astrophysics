# `hep/reco`: reconstruction

Stage 4 of the pipeline: from the detector's hits, calorimeter cells and muon-chamber hits (`DetectorEvent`) to tracks,
vertices, clusters, physics objects and jets (`RecoEvent`). Import as `hep/reco`.

```ts
import { presets, simulate } from 'hep/detector';
import { reconstruct } from 'hep/reco';

const det = simulate(truth, presets.onion, rng(1));          // hits, cells, muon hits
const reco = reconstruct(det, presets.onion, {}, truth);      // truth is optional: absent for real data
reco.tracks;      // RecoTrack[]   pT, η, φ, d0, z0 (relative to the primary vertex), χ², hits, truth link
reco.vertices;    // [primary, ...pile-up, ...secondary]
reco.objects;     // muons, electrons, photons, taus, jets (btag, isolation, truth link)
reco.met;         // missing pT from all calorimeter cells and the muons
```

`reconstruct` returns a `RecoEventFull`, a `RecoEvent` (from `hep/event`) with a few more fields: `RecoTrack` adds `tanLambda`,
`c`, `d0Raw`/`z0Raw` (relative to the beam line), `sigmaD0`, `sigmaZ0` and the covariance `cov` of (d0, φ0, c, z0, tanλ);
`RecoCluster` adds widths and truth energies; `RecoObjectX` adds `caloIsolation` and `variables` (E/p, H/E, …);
`RecoEventFull` adds `primaryVertex`, `pfCandidates` and `match`.

## Conventions

Natural units, GeV; mm; ns. z along the beam; φ in (−π, π]; η = −ln tan(θ/2). The solenoid field points along +z, so a
**positive particle turns clockwise seen from +z** (φ decreases along its path; the same as in `hep/detector`).
R[m] = pT[GeV] / (0.2998 B[T]). Helix parameters are the five **perigee parameters** relative to the beam line: d0 (signed:
positive when the point of closest approach lies to the left of the direction of motion seen from the origin), z0, φ0, tanλ
and the signed curvature c = q·0.2998 B/(1000 pT) in 1/mm (positive = clockwise). `Track.d0` and `Track.z0` are
relative to the primary vertex (d0 = −dxy to it, z0 = z of the track at its nearest transverse point minus z of the vertex);
the raw values are kept as `d0Raw`, `z0Raw`. `Track.hits` and `Vertex.tracks` are indices into the event's hit and track
lists. Everything random is seeded; nothing here calls `Math.random`.

## Hooks (`hook('reco.<name>', reference)`)

The reader's replacement goes in with `setOverride`, and every function below that calls the hook is then using it.

| Hook | Reference | Signature | Used by |
|---|---|---|---|
| `reco.circleFit` | `circleFit` | `(points: {x, y, sigma?}[]) => { xc, yc, R, chi2 }` | `fitTrack3D` (hence every track fit, and the Kalman seed) |
| `reco.houghTransform` | `houghTransform` | `(hits: {x, y}[], opts?) => { accumulator: Float32Array, nAngle, nCurv, peaks }` | `findTracks` with `seeding: 'hough'` |
| `reco.kalmanUpdate` | `kalmanUpdate` | `(state: {x, P}, meas: {z, R}, H) => { x, P, chi2 }` | `kalmanTrackFit` |
| `reco.impactParameter` | `impactParameter` | `(track, vertex, jet?) => { d0, sigma, significance, dz, sigmaDz, significanceZ }` | `reconstruct` (Track.d0/z0), `bTagInfo` |
| `reco.missingPt` | `missingPt` | `(objects: P4[]) => { x, y }` | `metFromEvent` (hence `reconstruct`) |
| `reco.bTag` | `bTagScore` | `(jet: P4, tracks, vertices) => number` | `buildObjects` (`RecoObject.btag`) |
| `reco.antiKt` | `antiKt` | `(particles: P4[], R, ptMin?) => { jets: P4[], constituents: number[][] }` | `clusterJets` (hence `buildObjects`) |

## API

Every function is pure and exported from `hep/reco`. Types are in the files named.

### Geometry and configuration (`geometry.ts`, `config.ts`, `calibrate.ts`)

- `geometryFromConfig(cfg: DetectorConfig | Partial<RecoGeometry>): RecoGeometry`: the flat description reconstruction uses
  (layers sorted by radius with `layerMap` for hits whose `layer` numbers are in another order, calorimeter cells, muon
  system, beam spot). Cached per configuration object. `DEFAULT_GEOMETRY` is a CMS-like stand-in for tests.
- `RecoConfig`, `DEFAULT_RECO_CONFIG`, `resolveConfig(rc?)`: every tunable parameter with its default (`ptMin` 0.5 GeV,
  `d0Max` 3 mm, `jetR` 0.4, `jetPtMin` 15 GeV, `chs` true, …). `reconstruct(det, cfg, rc?)` takes a `Partial<RecoConfig>`.
- `calibrateCalorimeters(cfg, opts?)`, `applyCalibration(geom, cal)`, `calibratedGeometry(cfg, rc?)`: test-beam style
  calibration of the ECAL and HCAL energy scales against the detector simulation (photons fix the ECAL, charged pions the
  HCAL). `reconstruct` does it once per configuration object (`autoCalibrate`, on by default; ~20–150 ms the first time).
  For the course detector the ECAL scale is 1.028 (the cells lose ~3 % of a shower below their noise thresholds) and the
  HCAL scale 1.13.

### Tracking

- `ptFromRadius(R_mm, bTesla)`, `radiusFromPt(pt, bTesla)`, `curvatureFromPt(pt, bTesla, q)`, `helixAt`, `helixAtRadius`,
  `arcToRadius`, `perigeeFromPoint`, `propagateToRadius`: helix geometry (`helix.ts`).
- `circleFit(points)` (**hook**): the **Taubin** algebraic fit (Newton solution of its characteristic polynomial, after
  Chernov and Lesort), weighted if points carry `sigma`. Like Kåsa it is closed form with no starting guess, but unlike
  Kåsa it is not biased towards small circles on the short arcs of high-pT tracks (a test shows the bias).
  `kasaFit(points)` is the simpler one, for comparison. `chi2 = Σ((distance − R)/σ)²`.
- `fitTrack3D(points: FitPoint[], bTesla, opts?): HelixFit`: circle in the transverse plane (through the hook) plus a
  least-squares line z = z0 + tanλ·s in arc length, giving pT, η, φ0, d0, z0, charge, χ² and ndof = 2n − 5. With
  `opts.scattering` the fit is a generalised-least-squares step with the **full covariance of hit resolution and multiple
  scattering** (the displacement at layer i from scattering in layer j is θ_j(s_i − s_j)); that makes χ²/ndof ≈ 1 and the
  parameter uncertainties right (pulls are N(0, 1) and agree with the Kalman fit).
- `houghTransform(hits, opts?)` (**hook**): Hough transform for tracks from the origin, parametrisation κ = 2 sin(φ − φ₀)/r.
  See the file header of `hough.ts`: κ > 0 turns towards increasing φ, hits vote only for φ₀ within ±90° of their own azimuth
  (otherwise each track makes a second peak at (φ₀ + π, −κ)), and a hit votes in every κ bin its φ₀ bin allows. Accumulator
  index = iAngle · nCurv + iCurv.
- `kalmanPredict(state, F, Q)`, `kalmanUpdate(state, meas, H)` (**hook**): the generic linear filter, Joseph-form update, χ².
- `kalmanTrackFit(hits, cfg, opts?): KalmanTrackFit`: fixed-seed Kalman track fit. State at a layer of radius r is
  (φ, z, ψ, tanλ, c); a hit measures (φ, z); exact helix propagation between layers with its Jacobian by finite differences;
  Highland process noise (with the change of pT that a polar kick causes); filter from the outermost hit inwards, then
  convert to perigee parameters with the full covariance. Returns χ², ndof and the filtered pulls. Not a combinatorial
  filter: hits are given.
- `findTracks(hits, cfg, rc?): RecoTrack[]`: see *Algorithms*.

### Vertices

- `fitVertex(tracks, opts?): RecoVertex`: weighted least squares with outlier rejection (χ² > 9 dropped, worst first);
  position, covariance, χ², ndof, `tracks` (kept), `rejected`.
- `findPrimaryVertices(tracks, rc?, beamSpot?): RecoVertex[]`: clustering in z0, fit, hard-scatter first (largest Σ pT²,
  `kind: 'primary'`, the rest `'pileup'`).
- `findSecondaryVertices(tracks, primary, opts?): RecoVertex[]`: from displaced tracks, with flight-distance significance,
  pointing, K⁰s and low-mass vetoes; `mass`, `lxy`, `lxySig`.
- `impactParameter(track, vertex, jet?)` (**hook**): signed transverse impact parameter (mm), uncertainty, significance; with a
  jet axis, the lifetime sign.

### Calorimetry

- `clusterCells(cells, geom, rc?): RecoCluster[]`: topological clustering (seed, grow, local-maximum splitting), calibrated
  energy, position, widths, depth.
- `matchTracksToClusters(tracks, clusters, calo, geom, maxDR?, minPt?, widthScale?)`, `extrapolateToRadius(track, r)`,
  `clusterP4(cluster, geom, zv?)`, `clusterGrid(...)`.

### Objects (`objects.ts`, `reconstruct.ts`)

- `particleFlow(tracks, clusters, geom, opts?): PFCandidate[]`: the simplified particle flow (charged hadrons from tracks,
  photons and neutral hadrons from the calorimeter excess).
- `findMuons(tracks, muonHits, geom, rc?)` with `predictStationHits(track, geom)`; `findElectronsPhotons(...)` (superclusters,
  E/p, H/E, conversions with `findConversions`); `trackIsolation`, `caloIsolation`; `findTaus(jets, tracks, rc?)`.
- `missingPt(objects)` (**hook**), `metFromEvent(cells, geom, muons?)`: missing pT and ΣE_T from all cells and muons.
- `buildObjects(tracks, vertices, clusters, det, geom, rc?, truth?)` and `reconstruct(det, cfg, rc?, truth?)`.

### Jets (`jets.ts`)

- `antiKt(particles, R, ptMin?)` (**hook**), `kt`, `cambridgeAachen`, `sequentialJets(particles, R, p, ptMin?, opts?)`
  (p = −1, 1, 0), `exclusiveJets(particles, n, p?)`, `jetMass(jet)`, `nSubjettiness(constituents, N, beta?, R0?)`, all returning
  `{ jets, constituents }` (constituents are indices into the input). O(N²) with a nearest-neighbour cache; tests check that
  a hard particle with soft ones gives a circle of radius R, and IRC safety (a soft ghost or a collinear split leaves the hard
  jets unchanged) on random events, for all three algorithms.

### b-tagging (`btag.ts`)

- `bTagScore(jet, tracks, vertices): number` (**hook**) in [0, 1]; `bTagInfo(...)` returns the ingredients (features,
  significances, secondary vertex). `BTAG_WEIGHTS`.

### Truth matching and performance measures (`match.ts`)

- `matchByHits(hitIdx, hits)`, `labelTracks(tracks, hits, minPurity?)`, `matchByDeltaR(eta, phi, candidates, maxDR?)`,
  `truthMatch(reco, hits, truth, opts?)`, `jetFlavour(jet, truth)`, `matchJetToParton(jet, truth)`.
- `efficiency(recoEvents, truthEvents, selection, opts?)`, `fakeRate(recoEvents, selection?, kind?)`: `Fraction`
  `{ value, k, n, error, low, high }` with the binomial standard error and a Wilson 68 % interval; `binomial(k, n)`.
- `resolution(values)`: mean, rms, median, robust σ68 and their errors.

### Test helpers (`synthetic.ts`, exported as `synthetic`)

Helical hits with scattering and smearing for a `RecoGeometry` (`simulateTrackHits`, `synthEvent`, `noiseHits`), truth events
for the real detector simulation (`truthEventFrom`, `minBiasTruth`, `jetParticles` for light, c and b jets).

## Algorithms

**Track finding.** Hits are binned per layer on a (z, φ) grid. *Seeds*: triplets of hits in three of the four innermost
layers, found pair by pair with windows from the allowed curvature (pT > `ptMin`), impact parameter and luminous-region z;
the layer combinations are (0,1,2), (1,2,3), then (0,1,3), (0,2,3) for tracks that lost a hit. Three passes: prompt tracks
(pT > 0.7 GeV, |d0| < 0.5 mm) with narrow windows first, then everything with the full acceptance on the hits that are left,
then the skipped-layer combinations. *Extension*: from the seed circle, layer by layer, the circle is intersected with the
layer's cylinder and the nearest hit inside a road is taken; the prediction is the seed circle plus a quadratic in r fitted
to the offsets of the hits found so far, and the road width is the variance of that extrapolation plus the layer resolution
plus the expected scattering displacement (times `roadSigmas` = 4). *Final fit*: `fitTrack3D` with scattering; cuts on
pT, |d0|, |z0|, χ²/ndof (< 4) and the number of hits (≥ 60 % of the layers, at most 6). *Ambiguity resolution*: candidates
ranked by hit count then χ²; one sharing more than `maxSharedHits` (1) hits with an accepted track is dropped; hits of accepted
tracks are removed from later seeds. `seeding: 'hough'` replaces the seeds by the peaks of the Hough transform followed by
two rounds of road collection and fit.

**Vertexing.** See `vertex.ts` header: Gauss–Newton on the exact signed distance of the vertex to each track's circle and
the z difference, with the tracks' own covariance. Primary vertices: prompt tracks smoothed in z by Gaussians of their z0
uncertainty (at least 0.1 mm); local maxima seed clusters; tracks go to the nearest seed within 4σ. Secondary vertices: tracks
with |IP significance| > 2.5, all pairs fitted, sorted by flight significance, greedily extended.

**Calorimetry.** Cells above a grow threshold (3σ of the cell noise, at least 50 MeV) that touch (26 neighbours, φ periodic)
form a group; a group with a cell above the seed threshold (8σ, at least 0.25 GeV ECAL / 0.5 GeV HCAL) is a cluster; a group
with several local maxima at least 3 cells apart is split between them.

**Particle flow.** Union-find over tracks, ECAL and HCAL clusters (track–cluster ΔR < 0.05/0.1 extended by the cluster's width;
ECAL–HCAL ΔR < 0.1). In a block: charged particles from the tracks; if the calibrated calorimeter energy exceeds the sum of
the momenta by more than 1.5 σ (from the calorimeter's resolution) and 1 GeV, the excess is a photon (ECAL share) and a neutral
hadron (HCAL share). Clusters with no track are photons or neutral hadrons. With `chs` the charged particles not associated with the
primary vertex are dropped. Neutral candidates below 0.5 GeV are not clustered into jets.

**Objects.** *Muons*: the track is continued through the calorimeters (mean muon energy loss from the detector's material),
bent in the solenoid with the lower momentum and, beyond the coil, in the return field (opposite sign); a window at each
station combines resolution, multiple scattering in the calorimeter steel and the track's own curvature and direction
uncertainty; ≥ 2 stations. *Electrons*: supercluster (ECAL clusters within |Δη| < 0.04, |Δφ| < 0.15) matched to an extrapolated
track, E/p in (0.6, 2), H/E < 0.15; four-vector from the supercluster energy along the track direction. *Photons*: supercluster
without a track, H/E < 0.1, ET above threshold; conversions are pairs of opposite-charge tracks whose circles touch (tangent point
beyond 10 mm) with a small pair mass at that point, pointing at the cluster (E/p in (0.6, 1.6)). *Isolation*: Σ pT of tracks from the
primary vertex in ΔR < 0.3 over pT (and calorimeter ET in the cone for `caloIsolation`). *Taus*: jets with 1 or 3 tracks in the core,
none in the annulus, visible mass < 1.8 GeV. *Jets*: anti-kT R = 0.4 on the particle-flow candidates with isolated leptons and
photons removed. *b-tag*: see below.

**b-tagging.** Features: ln(1 + S_k) for the three largest lifetime-signed impact-parameter significances of good tracks in ΔR < 0.4,
the number of tracks with S > 3, and for the secondary vertex in the jet its presence, mass, ln(1 + flight significance/10) and
track count; combined by a logistic function (`BTAG_WEIGHTS`, fitted on ~2,000 b and ~4,000 light simulated jets of 30–80 GeV,
η uniform in |η| < 2, in the course detector).

## Measured performance

All numbers are for the `onion` preset (4 pixel + 4 strip layers, 3.8 T), the code in this directory, and simulated events from
`hep/detector` (hard-scatter particles plus minimum-bias collisions from `synthetic.minBiasTruth`, about 25 charged particles
each, vertices spread with σz = 50 mm). They are what the tests and the scripts used to write this file measured; the statistical errors are
a few per cent for efficiencies and are quoted where they matter.

*Tracking* (12 pions per event, log-uniform pT from 0.5 to 100 GeV, |η| < 2.3, counting truth particles with ≥ 6 hits; ≈ 80
events at 0 pile-up, 40 at 20 and 50, 16 at 100):

| pile-up | 0.5–1 GeV | 1–2 GeV | 2–5 GeV | > 5 GeV | pT > 1 GeV | 1.6 < \|η\| < 2.3, pT > 1 | fake rate | tracks/event |
|---|---|---|---|---|---|---|---|---|
| 0 | 94.8 % | 97.9 % | 100 % | 100 % | 99.6 % | 98.5 % | 0 of 1,400 | 17 |
| 20 | 91.7 % | 93.7 % | 98.8 % | 100 % | 98.8 % | 96.7 % | 0 of 20,000 | 256 |
| 50 | 91.2 % | 92.8 % | 100 % | 100 % | 98.8 % | 95.8 % | 0 of 25,000 | 614 |
| 100 | 81.8 % (n = 22) | 100 % (n = 28) | 100 % | 99 % | 99.4 % | 100 % (n = 51) | ≈ 2 of 19,000 | 1,200 |

So at zero pile-up the efficiency for pT > 1 GeV is above 99 %, and the fake rate stays below 10⁻³ up to 100 pile-up collisions; with pile-up the
loss is concentrated at low pT and large |η|, where the seed triplets have fewer hits; the clone rate (two tracks for one
particle) is 0.3–0.4 %. A fake is a track whose best truth particle supplies less than half of its hits. The synthetic helper in
`synthetic.ts` (10 layers, 98 % hit efficiency, more forward acceptance) gives 96 % (0 pile-up), 93 % (20 and 50; pT > 1 GeV in
the tests, ≥ 6 of 10 hits required) and no fakes.

*Track parameters* (muons, |η| < 0.9): σ68 of (1/pT)/(1/pT)_true 0.40 % at 1 GeV, 0.33 % at 3 GeV, 0.36 % at 10 GeV, 0.67 % at
30 GeV, 1.8 % at 100 GeV, 5.5 % at 300 GeV. σ(d0) 44 µm at 1 GeV, 18 µm at 10 GeV, 10–11 µm at ≥ 100 GeV; σ(z0) 62, 25 and 16–19 µm.
Pull widths (rms of (measured − true)/quoted error) are 0.9–1.1 for d0 and z0 at every pT. Primary vertex: z resolution 7–8 µm, the
hard-scatter vertex found within 0.5 mm in 38/38 events at 0, 25 and 50 pile-up (quoted error 10 µm).

*Objects* (single particles plus 10 minimum-bias particles, pT 15–65 GeV): muons 100 % in |η| < 0.9 (the muon system's acceptance),
Z → μμ mass resolution σ68 = 0.5 % with mean shift < 0.2 %; electrons 95–96 % in |η| < 2.2 with σ68(pT) 1.0 % and E/p with mean 1.10 and σ68 0.09 (the bremsstrahlung tail);
photons 90–92 % (26 % convert in the tracker and 62 % of those are reconstructed as photons with the conversion pair), σ68 0.8 %;
jets found 100 %, pT response (vector sum of the reconstructed jets over the visible truth) 0.94 at 30 GeV to 1.04 at 120 GeV with σ68 ≈ 10–12 %; missing pT
about 5.5 GeV per component for a 20–70 GeV jet recoiling against a neutrino.

*b-tagging* (30–80 GeV jets, independent sample of 600 b and 1,200 light jets, `btag > 0.5`): b 74 ± 2 %, c 26 ± 2 %,
light 0.3 ± 0.2 %; `btag > 0.85`: b 68 %, c 15 %, light 0.17 %. At 20 pile-up collisions (charged-hadron subtraction on): b 72 ± 4 %, c 24 ± 4 %, light 0.7 ± 0.5 % (n = 141/148/297). The
light-jet rate is better than the ~1 % of a real detector because the simulation has no gluon splitting to heavy flavour, no hadronic interactions
in the material and no fake tracks; at 70 % b efficiency this tagger keeps 0.2 % of light jets. The weights were fitted on the same kind of
simulated jets that the test uses (different seeds); they are a calibration to the course detector, not a generic tagger.

*Speed* (one core of a busy machine, JIT warm; Z → μμ with about 15 underlying-event particles, `onion`): **0.55 ms/event (≈ 1,800
events/s)** without pile-up; **33 ms/event (≈ 30 events/s)** with 50 pile-up collisions (7,700 hits, 8,000 cells, 600 tracks). The
targets were 2,000 and 50; the tests assert half of them (1,000 and 25). At 50 pile-up the time divides as tracking 15–20 ms, primary vertices 3,
calorimeter clustering 5, objects (particle flow, jets, e/γ) 7, missing pT 1. The jet algorithm is O(N²) in the candidates; the neutral-candidate
threshold (0.5 GeV) and charged-hadron subtraction keep N below about 300.

## What was tested against the real detector module and what only against the synthetic helper

- *Real detector simulation (`hep/detector`):* every number in the section above; the calorimeter, muon-system, particle-flow,
  electron/photon/tau/jet/b-tag/MET code paths; the geometry adapter for all five presets (`minimal`, `onion`, `cms-like`,
  `atlas-like`, `sandbox`: each reconstructs muon pairs, an electron and a jet, with no fake tracks).
- *Synthetic helper only:* the unit tests of the circle fits, the Kalman filter and track fit (pulls), the GLS fit, the Hough
  transform, vertex fits (pulls), secondary vertices and conversions (hit patterns the detector rarely produces at the needed rate), and the
  pile-up scan of `tracking.test.ts`.

## What is not modelled

- **Tracker**: barrel layers only (the detector has no endcap disks; acceptance beyond a layer's half-length is what the layers give: in
  the `cms-like` preset the pixel layers stop at |z| = 270 mm, so seeds exist only for |η| ≲ 1.6 there). Seeds need three hits in the four
  innermost layers. No energy loss or bremsstrahlung in the fit (electron tracks are fitted with the pion mass and lose curvature
  accuracy when they radiate; this is why E/p has a tail), no kink or V⁰ finding beyond a K⁰s veto, no looper tracks (pT below
  about 0.25 GeV at 3.8 T), no alignment or calibration constants, dead channels are not known (they show up as missing hits).
- **Vertices**: no vertex-constrained refit of tracks, no adaptive/annealing vertex finder (clusters of less than ~0.5 mm merge), no
  correlation between the transverse and z parts of a track's covariance.
- **Calorimeter**: no shared-cell energy splitting between clusters, no η-dependent or non-linear calibration (one scale per
  calorimeter), no noise-only cells (the simulation makes none), no timing.
- **Particle flow and objects**: the expected calorimeter response of a hadron is its momentum (no momentum-dependent response
  and no ECAL/HCAL split), a block's neutral excess is shared between one photon and one neutral hadron, no neutral pile-up
  subtraction (no PUPPI, no area subtraction), no jet energy corrections, no lepton identification beyond the variables above (no shower
  shape, no muon-segment quality), taus only as narrow 1/3-prong jets. Muon momentum is the tracker's (no combined fit with the muon
  system), so the muon resolution at very high pT is the tracker's.
- **b-tagging**: a logistic combination of six quantities, no per-track probabilities, no charm/light separation beyond the vertex mass,
  and no calibration in data.
- **Truth matching**: a particle's truth link is that of the hits, so decay products and conversion electrons link to their parent; a
  jet's truth link is the nearest parton of the truth record (−1 if the record has none).

## Files

`config.ts` settings · `geometry.ts` detector description · `helix.ts` helix geometry · `fit.ts` circle and 3-D fits · `hough.ts` ·
`kalman.ts` · `tracking.ts` finder · `vertex.ts` · `calo.ts` · `calibrate.ts` · `jets.ts` · `btag.ts` · `objects.ts` particle flow,
leptons, photons, taus, isolation, MET · `match.ts` truth matching and statistics · `reconstruct.ts` the chain · `synthetic.ts` test
helpers · `material.ts` Highland · `linalg.ts` small matrices · `types.ts` extended event types · `*.test.ts`.
