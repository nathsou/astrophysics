# `hep/chamber`: particles in cloud and bubble chambers

Pure TypeScript (no DOM, no Svelte, no Node-only APIs; every random number comes from the `Rng` you pass in).
Exposed to the reader's exercises as `hep/chamber`.

```ts
import { simulateTrack, fitCircle, radiusOfCurvature } from 'hep/chamber';
import { rng } from 'hep/random';

const set = simulateTrack({
  pdg: 13, p: 0.3, direction: [1, 0, 0], position: [0, 0, 0],
  bField: 1, medium: 'air+alcohol vapour', rng: rng(1),
});
set.primary.points;   // [{ x, y, z, p, dedx, s, visible, layer }, …]  mm, GeV/c, MeV/mm
```

## Conventions

- Millimetres; x to the right, y up, z towards the viewer: the picture plane is x–y. GeV and GeV/c.
- The field is along z: `bField > 0` points out of the page. A positive charge then circles **clockwise**, F = q v × B.
  The radius is R[m] = p⊥[GeV/c] / (0.29979 · |q| · B[T]).
- Every track has `neutral`; a neutral particle leaves no ionisation (`dedx = 0`), so physically there is no track: the
  polyline is only there so that a teaching figure can draw it dashed or hide it.

## API

| Function | What it does |
|---|---|
| `simulateTrack(opts)` | One particle and everything it makes → `TrackSet { tracks, primary, bField, medium, plates, bounds }` |
| `simulateEvent({ particles: [...], ...})` | Several injected particles in one event; ids run across all of them |
| `ionisationLoss(species, pMeV, material, cut?)`, `radiativeLoss`, `totalLoss`, `mipLoss(material, restricted?)` | Mean energy loss, MeV cm²/g |
| `csdaRange(species, T, material)`, `energyFromRange` | Range in mm |
| `highland(pMeV, beta, charge, x/X0)` | RMS projected multiple-scattering angle |
| `radiusOfCurvature(pT, B, q)`, `momentumFromRadius(R, B, q)`, `sagitta(R, L)` | Helix geometry (metres) |
| `fitCircle(points)`, `circleThrough(a, b, c)`, `angleAt(v, a, b)`, `chargeSign(orientation, B)` | The scanner's measurements |
| `measureTrack(track, B, medium, noise?)` | Length, ionisation in units of a minimum-ionising particle, and a circle fit per visible stretch (per side of a plate) |
| `makePicture(preset, seed, opts)` | Ready-made pictures: `cloud-alpha`, `cloud-beta`, `cloud-muon`, `cloud-mixed`, `cloud-shower`, `anderson`, `omega`, `v0`, `pair`, `cloud:alpha,mu-,e+` (composed) |
| `cloudArrival(kind, rng, setup)` | One arrival in a cloud chamber (alpha, beta, cosmic muon, background, shower) |
| `andersonPicture(seed)`, `andersonExposure(seed)` | Anderson's positron track and further exposures of the same apparatus |
| `omegaPicture`, `v0Picture`, `pairPicture` | Bubble-chamber events |

### `simulateTrack` options

`pdg`; `p4` (GeV) or `p` (GeV/c) or `T` (GeV) with `direction`; `position` (mm); `bField` (T); `medium`
(`'air+alcohol vapour'`, `'liquid hydrogen'`, `'propane'`); `rng`; `plates: [{ y0, y1, material? }]` (lead by default, opaque);
`bounds`; `sensitiveZ` (a cloud chamber's thin sensitive layer); `decays`, `lifetimeScale` (0.01 makes decays in flight 100 times more
likely, for teaching); `forceDecayAt: { [pdg]: mm }`; `forceConversionAt: [mm, …]`; `channel: { [pdg]: [product pdgs] }` (choose a
decay channel, e.g. `{ 310: [211, -211] }`); `deltaRays` (rate scale, 0 = off); `fluctuations`; `multipleScattering`; `scatterTail`;
`maxStep`, `maxPath`, `maxTracks`; `endAt` (end the track by an interaction after this path, e.g. a beam particle striking a proton).

A `Track` has `points` (x, y, z in mm; `p` in GeV/c; `dedx` in MeV/mm restricted to delta-ray energies below the material's cut;
`s` path length; `visible`; `layer`: 0 = the chamber medium, i + 1 = plate i), `kinks` (multiple-scattering tail, decays, bremsstrahlung), `end`
(`range`, `decay`, `exit`, `conversion`, `interaction`, `stopped`), `endDetail`, `children`, and the truth (`pdg`, `charge`, `p0`).

## Physics and approximations

- Ionisation: Bethe–Bloch with the Sternheimer density effect for heavy particles (ln(1 + x) in place of ln x so the Bragg peak
  is smooth, and below the peak the loss falls in proportion to the velocity); Ziegler-style effective charge for the alpha
  particle (coefficient adjusted to 170 so that the range in air agrees with the tabulated 3.5–4 cm); the Rohrlich–Carlson collision loss for electrons
  and positrons. Bohr straggling (Gaussian).
- Radiative loss of electrons: E/X0 with low-energy suppression, as discrete photons above max(0.3 MeV, 2 % of E) and a continuous
  part below. Photons convert with (7/9)/X0 at high energy and a rising threshold behaviour; the pair shares the energy with a flat
  distribution and a p⊥ ≈ m_e. Compton scattering and the photoelectric effect are **not** modelled (low-energy photons just leave).
- Multiple scattering: Highland's formula per step (with the logarithm evaluated for the cumulative thickness in the material), two
  independent projected angles, and a single-scattering tail ∝ 1/θ² beyond max(0.08 rad, 5σ) that produces visible kinks.
- Delta rays: produced as separate electron tracks above the material's cut (5 keV in gas, 100 keV in liquids, 2 MeV in lead).
- Decays: branching fractions and masses from `hep/particles`; two-body decays isotropic in the rest frame, three or more bodies by
  accept–reject over `phaseSpace`, muon decay with the Michel spectrum. Neutrinos are not tracked. π⁺, μ± and K⁺ stopping in the
  chamber decay at rest; positrons annihilate at rest into two photons.
- Hadronic interactions in the liquid are not modelled, except where a preset forces them (`endAt`).

## What the numbers come to (the tests assert these)

- Alpha of 5 MeV in air: CSDA range **37 mm** (3.5–4.5 cm required); 5.3 MeV (polonium-210): about 40 mm.
- Minimum-ionising dE/dx in liquid hydrogen 4.04 MeV cm²/g (PDG 4.034); a 1 GeV/c muon 4.17, i.e. within 2 % of 4.1 × ρ = 0.29 MeV/cm.
- Lead: minimum 1.122 MeV cm²/g; air 1.815.
- A 1 GeV/c muon through 5 mm of lead: the simulated projected angle (central 50 %) is within 12 % of Highland's θ0 = 12.9 mrad.
- R = p⊥/(0.29979 B): a fitted 0.3 GeV/c muon track in 1 T has R = 1.0 m within 3 %.
- Plate crossing: the exit momentum is smaller, the energy lost equals the integral of the mean dE/dx, and the radius on the exit side
  scales with the momentum.

## Numbers typed from memory that the reviewer should check

- Sternheimer density-effect parameters (C, x0, x1, a, k, δ0) for air, liquid hydrogen and lead; the radiation length and
  critical energy of liquid hydrogen (63.04 g/cm², 344.8 MeV) and of propane (45.2 g/cm²; critical energy approximate); the
  propane parameters in general. Sources: PDG "Atomic and nuclear properties of materials", Sternheimer, Berger and Seltzer (1984).
- `ANDERSON` in `events.ts`: field 1.5 T (15 kG), plate 6 mm, momenta 63 and 23 MeV/c **as reported by Anderson** (Phys. Rev. 43, 491 (1933)).
- `omegaPicture`: the K⁻ beam of 5 GeV/c; the published Ω⁻ mass 1686 ± 12 MeV (Barnes et al., Phys. Rev. Lett. 12, 204 (1964)). Whether
  the K⁰ of the original event was seen to decay is not asserted; here it is followed as a K_S and decays to π⁺π⁻.
- The polonium-210 alpha energy (5.30 MeV) and the β endpoint (1 MeV) are typical values, not measurements of a named source.
