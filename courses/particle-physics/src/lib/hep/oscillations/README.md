# `hep/oscillations`: neutrino oscillations (Chapter 31)

Three-flavour oscillation probabilities in vacuum and in matter, the PMNS matrix, and the neutrino-mass observables. Pure TypeScript, no DOM, no
randomness. Import as `hep/oscillations` in the reader's code or `$lib/hep/oscillations` in widgets. Tests: `npx vitest run src/lib/hep/oscillations`.

**Units, without exception:** baseline `L` in km, energy `E` in GeV, `Δm²` in eV², angles in radians, densities in g/cm³, masses in eV. (The rest of `hep` is in GeV; this module
is in the units of the oscillation literature, so that the famous constant appears as itself.)

```ts
import { probability, probabilities3, defaultParams, OSC_PHASE_CONSTANT } from 'hep/oscillations';

probability(Math.PI / 4, 2.5e-3, 495.6, 1);           // two flavours: sin²2θ sin²(1.267 Δm² L/E) = 1.000
const p = defaultParams();                            // approximate NuFIT 6.0, normal ordering
const P = probabilities3(p, 295, 0.6, { matter: 2.6 });   // P[α][β] = P(ν_α → ν_β), α, β = e, μ, τ
P[1][0];                                              // P(ν_μ → ν_e) for a T2K-like beam
```

## Exports

| Name | What |
|---|---|
| `OSC_PHASE_CONSTANT` | 1.26693…: the phase Δm² L/(4E ħc) = this × Δm²[eV²] L[km] / E[GeV]. Derived from `hep/units` (ħc), not typed in; a test repeats the derivation step by step |
| `phase(dm2, L, E)`, `oscillationLength(dm2, E)` | the dimensionless phase; L_osc = πE/(1.267 Δm²) ≈ 2.48 E/Δm² km |
| `probability(θ, dm2, L, E)` | **the hook `oscillations.probability`**: P(ν_α → ν_β) = sin²2θ sin²(1.267 Δm² L/E), two flavours. Reference: `probabilityTwoFlavourReference`. The widgets call `probability`, so "use my code" changes their curves |
| `OscParams` | `{ theta12, theta13, theta23, deltaCP, dm21, dm31 }`. `dm31 > 0` is the normal ordering, `dm31 < 0` the inverted one |
| `pmns(θ12, θ13, θ23, δ)` | the PMNS matrix (PDG parametrisation, rows e μ τ, columns ν₁ ν₂ ν₃), as `CMat3 = { re, im }`; `mixingSquared(U)`, `jarlskog(p)`, `mul3`, `dagger3`, `conj3` |
| `paramsFromSin2(s12, s13, s23, δ°, dm21, dm3l, ordering)`, `defaultParams(ordering)`, `GLOBAL_FIT_APPROX` | parameters from the quantities the fits quote. `dm3l` is \|Δm²₃ℓ\| (ℓ = 1 normal, 2 inverted) |
| `probabilities3(p, L, E, opts)` | the 3×3 matrix P[α][β]; `opts = { matter?: density \| Layer[], Ye?, anti? }`. `probability3(p, α, β, L, E, opts)` for one entry |
| `evolutionOperator`, `hamiltonian`, `evolve` | the pieces: S = exp(−iHL) for H = (1/2E) U diag(0, Δm²₂₁, Δm²₃₁) U† + diag(V, 0, 0), by scaling and squaring of the Taylor series |
| `matterPotential(ρ, Ye)` | V = √2 G_F N_e = 7.63 × 10⁻¹⁴ eV · Y_e · ρ[g/cm³] |
| `probabilityTwoFlavourMatter`, `resonanceEnergy` | the closed-form two-flavour MSW result and the resonance energy, to check the numerical propagation against |
| `solarSurvival(θ12, dm21, E, ρ, Ye)` | the adiabatic two-flavour solar P_ee (a toy: one production density, no non-adiabatic term) |
| `neutrinoMasses`, `sumOfMasses`, `betaDecayMass`, `majoranaMass`, `majoranaRange` | the three masses from the lightest, Σm, m_β (KATRIN) and m_ββ (neutrinoless double-beta decay) with Majorana phases |

## Conventions

* `P[α][β]` is P(ν_α → ν_β); the evolution operator's entry `S[β][α]` is the amplitude.
* Antineutrinos (`anti: true`): U → U\* (δ → −δ) and V → −V.
* Matter: constant-density layers, propagated exactly (no expansion in θ₁₃ or Δm²₂₁/Δm²₃₁). Only the charged-current potential is included (the neutral-current part is the same for every flavour).
  Y_e defaults to 0.5. There is no built-in Earth model: pass `Layer[]` yourself.
* Majorana phases do not enter oscillations; they enter `majoranaMass` only.

## What is approximate

* `GLOBAL_FIT_APPROX` is rounded from the NuFIT 6.0 global fit (Esteban et al., JHEP 12 (2024) 216) and the PDG review; sin²θ₂₃ (0.47) and δ (212°) are not well determined. Do not quote them as results.
* Sterile neutrinos, non-standard interactions, decoherence and wave-packet effects are not modelled. Averaging over the energy spread of a real beam or detector is the caller's job.
* `solarSurvival` is the adiabatic limit at one production density; the real solar model integrates over the production region and includes the Sun's profile.

## Tests

The phase constant against a step-by-step unit conversion; unitarity of U; unitarity of the evolution (rows and columns of P sum to 1) in vacuum and matter, for neutrinos and
antineutrinos; the two-flavour limit of the numerical three-flavour propagation against the closed MSW formula to 10⁻⁶; layers compose; the CP difference equals 16 J sin Δ₂₁ sin Δ₃₁ sin Δ₃₂;
the resonance near 10 GeV; the floors of Σm (0.059 eV and 0.099 eV); the absence of a zero of m_ββ in the inverted ordering.
