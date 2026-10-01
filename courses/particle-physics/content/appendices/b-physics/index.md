---
number: B
title: Physics primers
summary: Special relativity and quantum mechanics in the two pages each that the course needs, with pointers to the astrophysics course's fuller primers.
---

Special relativity and quantum mechanics are taught in the main chapters where they are used (Chapters 2 and 3). This appendix collects the results in one place, for quick reference and for readers who have met them before.

## Special relativity

**Postulates.** The laws of physics are the same in every frame moving at constant velocity, and the speed of light in vacuum, *c* = 299 792 458 m/s, is the same in all of them.

**Consequences** (γ = 1/√(1 − β²), β = *v*/*c*):

- *Time dilation.* A clock moving at speed *v* runs slow: the interval measured in the lab is Δ*t* = γ Δ*τ*, where Δ*τ* is the time on the moving clock (its proper time). A muon's mean lifetime at rest is 2.197 µs, so a muon with γ = 30 (energy 3.2 GeV) lives, on the lab's clock, 66 µs and travels on average γ*β**c*τ = 20 km: that is why muons made in the upper atmosphere reach the ground (Chapter 10).
- *Length contraction.* A rod moving along its length is shorter by 1/γ.
- *Velocity addition.* Velocities along one direction do not simply add: *w* = (*u* + *v*)/(1 + *uv*/*c*²). Rapidities do add (Chapter 2).
- *Energy and momentum.* *E* = γ*mc*², *p* = γ*mv*, and therefore *E*² = (*pc*)² + (*mc*²)². A particle at rest has energy *mc*²; a massless particle has *E* = *pc* and moves at *c*. The kinetic energy is (γ − 1)*mc*².
- *Four-vectors.* Energy and momentum form a four-vector whose invariant length is the mass (Chapter 2). Its components mix under a boost, and the length does not.

For the derivations and the geometry of spacetime diagrams, see the [relativity chapter of the astrophysics course](/astrophysics/ch/relativity/).

## Quantum mechanics

**Waves and particles.** A quantum object propagates as a wave and is detected as a particle. A particle of momentum *p* has a wavelength λ = *h*/*p* (de Broglie, 1924), and a photon of frequency *f* has energy *E* = *hf*. The wave gives the *probability* of detection at each point: the probability density is the squared modulus of a complex amplitude ψ.

**Superposition and interference.** If a process can happen in two indistinguishable ways, with amplitudes *A*<sub>1</sub> and *A*<sub>2</sub>, the probability is |*A*<sub>1</sub> + *A*<sub>2</sub>|², not |*A*<sub>1</sub>|² + |*A*<sub>2</sub>|². The cross term is the interference. Feynman diagrams (Chapter 15) are a bookkeeping device for adding amplitudes.

**Uncertainty.** Δ*x* Δ*p* ≥ ħ/2, and Δ*E* Δ*t* ≳ ħ/2: a state that lives for a short time has an uncertain energy, which is why short-lived particles have broad mass peaks (Chapter 3).

**Spin.** Particles carry an intrinsic angular momentum, spin, in units of ħ. The electron, muon and quarks have spin ½; the photon, gluon, W and Z have spin 1; the Higgs boson has spin 0. A spin-½ particle has two states along any axis (up and down), described by the Pauli matrices (appendix A).

**Identical particles.** Particles of half-integer spin (**fermions**) obey the Pauli exclusion principle: no two identical ones can occupy the same state. Particles of integer spin (**bosons**) can, and prefer to. This one rule gives the structure of atoms, the stability of neutron stars, and the need for the colour charge of Chapter 13.

**Decay and rates.** A quantum transition from an initial state to a final state happens with a rate given by Fermi's golden rule, Γ = 2π |*M*|² ρ: the square of a matrix element times the density of final states. In the language of Chapter 3, Γ is the decay width and the lifetime is τ = ħ/Γ. For a fuller treatment, see the [quantum primer of the astrophysics course](/astrophysics/ch/primer-quantum/).

```numeric
id: b-muon-decay-length
title: How far does a muon fly?
prompt: A muon with γ = 30 has a proper lifetime of 2.197 µs. Taking β ≈ 1, how far, in kilometres, does it travel on average before decaying?
answer: 19.8
tolerance: 0.02
unit: km
explain: "The mean decay length is γ β c τ = 30 × 3 × 10⁸ m/s × 2.197 × 10⁻⁶ s = 19.8 km. Without time dilation it would be 0.66 km."
```

## Further reading

- R. P. Feynman, *QED: The Strange Theory of Light and Matter* (Princeton, 1985), for interference and amplitudes without mathematics.
- The [astrophysics course's primers](/astrophysics/ch/primer-quantum/) on quantum mechanics and on [waves](/astrophysics/ch/primer-waves/).
