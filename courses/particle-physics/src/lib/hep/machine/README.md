# hep/machine: the accelerator toolkit (Stage 1)

Pure TypeScript, no DOM, seeded randomness only. Import as `hep/machine` (or `$lib/hep/machine`). Tests: `*.test.ts` next to the code.

Hooks for the reader's code (`hooks.setOverride`): `machine.trackThroughLattice`, `machine.luminosity`, `machine.trackLongitudinal`.

## optics.ts (Chapter 20)
- 2×2 matrices `Mat2 = [a, b, c, d]`: `mul`, `multiplyInOrder`, `det`, `trace`, `apply`, `IDENTITY`; elements `drift(L)`, `thinQuad(kl)`, `thinLens(f)`, `quad(k, L, plane)`, `sectorDipole(L, rho, n, plane)`, longitudinal `rfKick(slope)`, `slipDrift(L, eta)`.
  Convention: k > 0 focuses in x (defocuses in y), k in m⁻².
- Lattices: `Element` = drift | quad | thinQuad | dipole | sextupole; `matrixOf`, `oneTurnMatrix`, `repeat`, `sliceLattice`, `latticeLength`.
- Stability and Twiss: `isStable(M)` (|Tr M| < 2), `periodicTwiss(M)` → {stable, trace, mu, tune, beta, alpha, gamma}, `propagateTwiss`, `opticsAlong(lattice, plane, {start, maxStep})` (β(s), α(s), accumulated phase, tune with its integer part), `tuneOf`, `chromaticity` (finite difference), `solveStrengthForPhaseAdvance`.
- FODO: `fodoThin(f, L)`, `fodoPhaseAdvance` (sin(μ/2) = L/2f = L_cell/4f), `fodoBetaMax/Min` (β± = L_cell(1 ± sin(μ/2))/sin μ), `fodoCell({kF, kD, quadLength, gap, nDipoles, dipoleLength, dipoleAngle})`; `lhcArcCell(k)`, `lhcArcCellDesign(muDeg, E)` (lhcCell.ts).
- Tracking: `trackThroughLattice(lattice, x0, xp0, nTurns, plane)` → `{x, xp}` (length nTurns, index i = start of turn i, x[0] = x0; goes through the hook), `referenceTrackThroughLattice`.
- Tunes: `fft(re, im)`, `tuneFromTurns(x, xp?)` (Hann window, zero padding, parabolic peak; folded to (0, ½] with x only, (0, 1) with x and x′).
- Beam: `beamSigma`, `beamDivergence`, `geometricEmittance`, `normalisedEmittance`, `emittanceFromParticles`, `phaseSpaceEllipse`; resonances `resonanceLines(maxOrder)`, `resonanceDistance(Qx, Qy, maxOrder)`.

## fields.ts
`momentumFromField(B, rho)` (p = 0.29979 B ρ), `fieldFromMomentum`, `bendingRadius`, `rigidity`, `quadStrength`, `gradientFromStrength`, `revolutionFrequency`, `betaOf`, `gammaOf`; the preset `LHC` (each number is commented with its source, "LHC Design Report, CERN-2004-003"; **to be verified by the reviewer**), `lhcDipoleField(E)` (8.33 T at 7 TeV, 8.09 T at 6.8 TeV), `lhcDipoleAngle()`.

## longitudinal.ts (Chapter 19)
Standard map ΔE′ = ΔE + eV[sin(φs + Δφ) − sin φs], Δφ′ = Δφ + 2π h η ΔE′/(β²E). `RfParams {harmonic, voltage (V), phiS, eta, energy (GeV), mass, charge}`; `slipFactor`, `transitionGamma`, `transitionEnergy`, `phaseJumpAtTransition`, `stablePhase`, `synchrotronTune` (+ `Exact`, `synchrotronFrequency`), `hamiltonian`, `bucketGeometry` (separatrix, half-height, area), `separatrix`, `stationaryHalfHeight`, `stationaryBucketArea`, `movingBucketHeightRatio`, `bucketAreaEVs`, `stepLongitudinal`, `inBucket`, `trackLongitudinal(particles, params, nTurns)` (marks `lost`), `longitudinalHistory`, `lhcRf(E, V)`.

## radiation.ts, protection.ts, luminosity.ts (Chapter 21)
- `energyLossPerTurn`, `electronLossKeV` (88.46 E⁴/ρ), `protonLossKeV`, `electronToProtonLossRatio`, `criticalEnergyEV`, `radiatedPowerW`, `energyForLossFraction`, preset `LEP`.
- `beamStoredEnergyMJ`, `storedEnergyMJ`, `tntKg`, `trainSpeedKmH`, `trainEnergyMJ`, `copperMeltedKg`, `fieldEnergyDensity`.
- `luminosity(p: LumiParams)` in cm⁻² s⁻¹ (hook `machine.luminosity`; `referenceLuminosity`), `geometricFactor`, `sigmaStar`, `pileup(L, nb, frev, σ_inel)`, `SIGMA_INEL_MB = 80` (approximate), `interactionRate`, `bunchCrossings(nEvents, rng, mu)` (Poisson counts), `collisionVertices`, `luminousRegionSigmaZ`, `fillingPattern(nb)` (simplified 3564-slot pattern), `luminosityAt`, `burnOffTime`, `integratedLuminosity`, `optimalFill`, `machineStage(config)` → `{lumi, mu, bunchSpacingNs, sqrtS, crossingRateHz, maxCrossingRateHz, params}`; presets `LHC_DESIGN`, `RUN3_LIKE` (illustrative, not an official table).

## Verified numbers (from the tests)
LEP, 104.5 GeV, ρ = 3026 m: 3.49 GeV per turn (3.41 with ρ = 3096 m). LHC protons: 6.66 keV per turn at 7 TeV, 5.93 keV at 6.8 TeV; critical energy 43.8 eV. LHC design luminosity 1.009 × 10³⁴ cm⁻² s⁻¹ (F = 0.840, σ* = 16.6 µm, μ = 25.6). Stored energy 362 MJ = 86.6 kg TNT. Synchrotron tune at 7 TeV 2.04 × 10⁻³ (23 Hz); injection bucket 1.43 eV·s. Arc cell tuned to 90°: β 181/31.5 m, gradient 203 T/m (the 223 T/m quoted in the preset is the design peak).
