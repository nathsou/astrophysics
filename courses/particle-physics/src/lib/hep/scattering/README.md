# `hep/scattering`: Rutherford scattering, form factors and the samplers behind Chapter 4

Pure TypeScript, no DOM, seeded randomness only. Import as `hep/scattering` (or `$lib/hep/scattering`). Tests: `scattering.test.ts` (`npx vitest run src/lib/hep/scattering`).

Units: alpha-particle formulas take the kinetic energy in **MeV** (names end in `Fm`, `Fm2`, `Mev`), electron formulas take GeV; lengths in fm, cross-sections in fm² (1 fm² = 10 mb), angles in radians.
Model limits: the target is infinitely heavy (no recoil), the projectile is non-relativistic (Rutherford) or ultra-relativistic (Mott), only the Coulomb force acts. Screening, multiple scattering and nuclear forces are not in the formulas.

## The classical orbit

| function | what |
|---|---|
| `closestApproachFm(z, Z, tMeV)` | d = zZ α ħc / T, the head-on distance of closest approach |
| `impactParameterFm(θ, z, Z, T)`, `deflectionAngle(b, z, Z, T)` | b = (d/2) cot(θ/2) and its inverse θ = 2 arctan(d/2b) |
| `minApproachFm(θ, z, Z, T)` | (d/2)(1 + 1/sin(θ/2)): closest approach on the path scattered through θ |
| `rutherfordDiffXsecFm2(θ, z, Z, T)` | dσ/dΩ = (d/4)² / sin⁴(θ/2), fm²/sr |
| `rutherfordXsecAboveFm2(θ0, …)`, `rutherfordXsecBinFm2(θa, θb, …)` | σ(θ > θ0) = π b(θ0)², and the exact integral over a bin |
| `thomasFermiRadiusFm(Z)`, `screeningAngle(z, Z, T)` | where electrons screen the nucleus, and the angle below which Rutherford's law fails |

## Sampling the angle

The density of the angle is f(θ) ∝ sin θ / sin⁴(θ/2) = 2 cos(θ/2) / sin³(θ/2) on [θmin, π]; it diverges like 16/θ³.

| function | what |
|---|---|
| `sampleRutherfordAngle(r, thetaMin)` | **the reference of the hook `scattering.sampleRutherfordAngle`** (Chapter 4's exercise): importance sampling |
| `sampleImportance(r, θmin)` | proposal 1/θ³ by inverse transform, accepted with cos x (x/sin x)³, x = θ/2 (at most 1); returns `{ theta, trials }` |
| `sampleFlatAcceptReject(r, θmin)` | the naive method: correct, but needs about 2π/θmin trials per angle |
| `sampleRutherfordInverse(r, θmin)` | the exact inverse of the cumulative distribution, one random number per angle |
| `rutherfordAnglePdf`, `rutherfordAngleCdf`, `rutherfordAngleDensity`, `rutherfordAngleNorm` | the density, its integral 2 cot²(θmin/2), and the cumulative distribution |
| `flatEfficiency(θmin)`, `importanceEfficiency(θmin)` | the exact efficiencies of the two accept–reject schemes (θmin/2π, and above 0.99 for θmin ≤ 0.3) |

## A thin foil (the Geiger–Marsden experiment)

`Foil`, `GOLD`, `SILVER` (0.4 µm), `nucleiPerFm2`, `scatterProbability(foil, T, θmin)`, `expectedCountsInBin`, `ringSolidAngle`, and
`fireAlphas(r, foil, T, nAlpha, θmin, edges)`: the number scattered through more than θmin is Poisson, each angle comes from the hook
`scattering.sampleRutherfordAngle`, so the reader's sampler (when installed) produces the counts. `fitAnglePower(edges, counts)` is a Poisson maximum-likelihood
fit of dN/dΩ = K sin⁻ᵖ(θ/2) (K profiled analytically, p by golden-section search, uncertainty from the profile likelihood, bin integrals by Gauss–Legendre), returning
`{ p, pLo, pHi, K, K4, delta4 }`; `gaussianPerSr` is the illustrative "plum pudding" Gaussian.

## Electrons and form factors

`mottDiffXsecFm2(θ, Z, EGeV)`; `formFactor(shape, qGeV, rmsFm)` for `'point' | 'uniform' | 'exponential' | 'gaussian'` (every shape has F → 1 − q²⟨r²⟩/6 at small q);
`dipoleLambda2(rms)` = 12(ħc)²/⟨r²⟩; `elasticScatteredEnergy`, `elasticQ2` (electron on a target of mass M), `resolutionFm(Q)` = ħc/Q, `reducedWavelengthFm(p)`, `hadronicMass(M, ν, Q²)`.

## Verified numbers (from the tests)

5.5 MeV alphas on gold: d = 41.4 fm, dσ/dΩ(90°) = 428 fm²/sr, the rate falls by 13.9 from 30° to 60°; at 7.69 MeV d = 29.6 fm. 0.4 µm of gold holds 2.36 × 10⁻⁸ nuclei per fm²;
1 µm of gold scatters 7.9 × 10⁻⁵ of 5.5 MeV alphas through more than 90°. Flat accept–reject efficiency θmin/2π (1 in 6,300 at θmin = 0.001 rad); importance sampling above 99 %.
Dipole Λ² = 0.662 GeV² for r = 0.84 fm (0.71 GeV² ↔ 0.811 fm). A 500 MeV electron scattered elastically from a proton through 60° leaves with 394.8 MeV, Q = 0.444 GeV, resolving 0.444 fm.
