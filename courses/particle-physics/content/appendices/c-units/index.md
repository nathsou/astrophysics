---
number: C
title: Units, constants and conventions
summary: Natural units, conversions, the metric, detector coordinates and the notation the course uses, collected in one place.
---

This appendix collects the conventions used throughout the course. The explanations are in [Chapter 1](/chapters/scales-and-units/) (units) and [Chapter 2](/chapters/relativity-for-particles/) (four-vectors and detector coordinates). The interactive converter is on the [units page](/units/).

## Natural units

Set ħ = *c* = 1. Then:

| Quantity | Natural unit | To SI |
|---|---|---|
| Energy, mass, momentum, temperature | GeV | 1 GeV = 1.602 × 10⁻¹⁰ J; 1 GeV/*c*² = 1.783 × 10⁻²⁷ kg; 1 eV ≙ 11 604.5 K |
| Length | GeV⁻¹ | 1 GeV⁻¹ = 0.197327 fm = 1.97327 × 10⁻¹⁶ m |
| Time | GeV⁻¹ | 1 GeV⁻¹ = 6.582 × 10⁻²⁵ s |
| Cross-section | GeV⁻² | 1 GeV⁻² = 0.3894 mb = 3.894 × 10⁸ pb |
| Velocity | 1 | *c* = 299 792 458 m/s |
| Electric charge | dimensionless | *e* = √(4πα), α = 1/137.036 |

To restore units, multiply by powers of ħ and *c* until the dimensions are right. The two most useful factors are ħ*c* = 197.327 MeV·fm and ħ = 6.582 × 10⁻²⁵ GeV·s.

## Prefixes

| Prefix | Symbol | Factor | | Prefix | Symbol | Factor |
|---|---|---|---|---|---|---|
| kilo | k | 10³ | | milli | m | 10⁻³ |
| mega | M | 10⁶ | | micro | µ | 10⁻⁶ |
| giga | G | 10⁹ | | nano | n | 10⁻⁹ |
| tera | T | 10¹² | | pico | p | 10⁻¹² |
| peta | P | 10¹⁵ | | femto | f | 10⁻¹⁵ |
| exa | E | 10¹⁸ | | atto | a | 10⁻¹⁸ |

## Cross-sections and luminosity

1 b = 10⁻²⁸ m² = 100 fm². The rate of a process is R = σ *L*, with *L* the instantaneous luminosity in cm⁻² s⁻¹. A luminosity of 10³⁴ cm⁻² s⁻¹ is 10 nb⁻¹ s⁻¹ (1 nb = 10⁻³³ cm²), so a process of 1 pb, which is 10⁻³ nb, occurs 10⁻² times per second. The **integrated luminosity** ∫*L* dt has units of inverse area: 1 fb⁻¹ contains 1,000 events of a 1 pb process.

## Four-vectors and the metric

The metric signature is (+, −, −, −). A four-momentum is *p* = (*E*, *p*<sub>x</sub>, *p*<sub>y</sub>, *p*<sub>z</sub>), its square is *p*² = *E*² − |**p**|² = *m*², and the product of two is *p*·*q* = *E*<sub>p</sub>*E*<sub>q</sub> − **p**·**q**. The Mandelstam variable *s* = (*p*<sub>1</sub> + *p*<sub>2</sub>)² is the squared centre-of-mass energy.

## Detector coordinates

| Quantity | Definition |
|---|---|
| *z* axis | Along the beam. The *x* axis points to the centre of the ring, *y* up. |
| Azimuth φ | Angle in the *x*–*y* plane from the *x* axis, in (−π, π]. |
| Polar angle θ | Angle from the *z* axis. |
| Transverse momentum *p*<sub>T</sub> | √(*p*<sub>x</sub>² + *p*<sub>y</sub>²) |
| Pseudorapidity η | −ln tan(θ/2) = asinh(*p*<sub>z</sub>/*p*<sub>T</sub>) |
| Rapidity *y* | ½ ln((*E* + *p*<sub>z</sub>)/(*E* − *p*<sub>z</sub>)) |
| Angular distance Δ*R* | √(Δη² + Δφ²) |
| Transverse mass *m*<sub>T</sub> | √(*m*² + *p*<sub>T</sub>²) |
| Impact parameters *d*<sub>0</sub>, *z*<sub>0</sub> | Distance of closest approach to the beam axis in the transverse plane, and the *z* coordinate there, relative to the primary vertex. |

Inside the detector model, lengths are in millimetres, times in nanoseconds, magnetic fields in tesla and energies in GeV. The radius of curvature of a particle of transverse momentum *p*<sub>T</sub> (GeV) in a field *B* (T) is ρ = *p*<sub>T</sub>/(0.29979 *B*) metres.

## Particle symbols and PDG codes

The course's particle table uses the Particle Data Group's Monte Carlo numbering: 1–6 for the quarks d, u, s, c, b, t; 11, 13, 15 for e, μ, τ and 12, 14, 16 for their neutrinos; 21 for the gluon, 22 the photon, 23 Z, 24 W⁺, 25 the Higgs boson; 211 π⁺, 111 π⁰, 321 K⁺, 2212 p, 2112 n. Negative numbers denote antiparticles.
