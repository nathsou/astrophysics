# `hep/muography`: a toy model of muon radiography (Chapter 33)

Cosmic-ray muons at sea level, their absorption by rock, and the counts a detector behind a structure would record. Pure TypeScript, deterministic (draw the Poisson noise
with `hep/random`). Import as `hep/muography` or `$lib/hep/muography`. Tests: `npx vitest run src/lib/hep/muography`. No hook: Chapter 33 has no code exercise.

**Units:** energies in GeV; thickness in g/cm² (length × density); intensity in cm⁻² s⁻¹ sr⁻¹ (per GeV for the differential one); zenith angle θ from the vertical in radians; lengths of a structure in metres.

| Name | What |
|---|---|
| `differentialFlux(E, θ)`, `integralFlux(Emin, θ)` | Gaisser's parametrisation of the sea-level muon spectrum, as given in the PDG review "Cosmic rays". Valid for E above about 100 GeV/cosθ and θ below about 70°; it overestimates below 10 GeV (its integral above 1 GeV is about twelve times the PDG's 70 m⁻² s⁻¹ sr⁻¹), so never integrate it below a few GeV. `integralFlux` uses Gauss–Legendre panels in ln E |
| `SEA_LEVEL_VERTICAL_INTENSITY`, `lowEnergyIntensity(θ)` | the PDG's 70 m⁻² s⁻¹ sr⁻¹ above 1 GeV and its cos²θ angular distribution (the low-energy muons that dominate the surface count) |
| `STANDARD_ROCK = { a: 2.0e-3, b: 4.0e-6 }`, `range`, `minimumEnergy`, `energyAfter` | continuous energy loss −dE/dx = a + bE, constants of the right size for standard rock (Z = 11, A = 22, 2.65 g/cm³). R = ln(1 + bE/a)/b. **Not a fit**: the PDG muon tables have energy-dependent a and b |
| `transmittedIntensity(X, θ)`, `massThickness(L, ρ)`, `expectedCount(X, θ, A, ΔΩ, T)` | the intensity behind X g/cm², the mass thickness of a length of material, and N = I · A cosθ · ΔΩ · T |
| `Pyramid2D`, `Box`, `exitDistance`, `lengthInBox`, `slantThickness(pyramid, detector, θ, ρ, chamber?)` | a triangular cross-section with an empty box (the hidden chamber) removing its length of rock, for rays in the plane of the section |

What the model leaves out: the detector's efficiency and angular resolution, multiple scattering, the radiative fluctuations of the energy loss (straggling), muons of the charge ratio's other sign,
low-energy muons scattered into the acceptance, the rock's real composition and density variations, the third dimension, and every background. It shows why the method works and how long it takes; it is not a tool for measuring anything.

Sources to check before quoting numbers: PDG, *Cosmic rays* (the flux and Gaisser's formula) and the PDG muon stopping-power tables (the energy loss).
