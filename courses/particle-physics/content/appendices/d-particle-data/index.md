---
number: D
title: Particle data
summary: The Standard Model at a glance, and a table of every particle in the course's library, with its PDG code, mass, width or lifetime, charge, spin and main decays. The table is generated from the same data the generator, the decays and the reaction checker use.
duration: Look things up
prerequisites: []
---

This appendix is for looking things up. The first part draws the Standard Model's fundamental particles on one mass axis. The second is a table of all 55 particles in the course's library, generated from the library's own table: the same entries that the event generator decays, that the conservation checker of [Chapter 11](/chapters/conservation-laws/) reads, and that the detector simulation follows through the apparatus. If this page and a chapter ever disagree about a mass, one of them has a bug.

The values are rounded from the Particle Data Group's *Review of Particle Physics* (2024 edition), the standard compilation of what has been measured about particles.:cite[pdg2024] The PDG is the reference to check before quoting a number from this course: its entries carry uncertainties, discussion and the primary sources, which the course's table leaves out.

## The Standard Model at a glance

The fundamental particles are of two kinds. **Fermions**, which have spin ½, make up matter: six quarks and six leptons, in three **generations** of two quarks and two leptons each. **Bosons** carry the forces and, in the case of the Higgs boson, give the other particles their masses. Each fermion has an antiparticle with opposite charges.

::sm-chart{n="D.1" caption="The twelve fermions and the bosons on one logarithmic mass axis, from the course's particle table (so from the PDG 2024 values, rounded). Quarks are circles, charged leptons diamonds, bosons squares. The top quark is the heaviest particle known, 172.6 GeV, about 340,000 times the electron. The three neutrinos are not on the axis: their masses are not zero (Chapter 31) but are below 0.45 eV (the direct limit of KATRIN), more than a million times lighter than the electron. The photon and the gluon are massless."}

| | Generation 1 | Generation 2 | Generation 3 | Electric charge | Spin |
|---|---|---|---|---|---|
| Up-type quarks | u, 2.16 MeV | c, 1.27 GeV | t, 172.57 GeV | +2/3 | ½ |
| Down-type quarks | d, 4.67 MeV | s, 93.4 MeV | b, 4.18 GeV | −1/3 | ½ |
| Charged leptons | e⁻, 0.511 MeV | μ⁻, 105.66 MeV | τ⁻, 1.777 GeV | −1 | ½ |
| Neutrinos | ν_e | ν_μ | ν_τ | 0 | ½ |

| Boson | Symbol | Mass | Force or role | Spin |
|---|---|---|---|---|
| Photon | γ | 0 | electromagnetism | 1 |
| Gluon | g | 0 | strong force (eight kinds, carrying colour) | 1 |
| W | W⁺, W⁻ | 80.369 GeV | weak force (charged current) | 1 |
| Z | Z | 91.188 GeV | weak force (neutral current) | 1 |
| Higgs boson | H | 125.20 GeV | field that gives masses (Chapter 26) | 0 |

The quark masses are the "current" masses used in the Standard Model's equations, except for the top quark's, which is the pole mass. A quark is never seen alone, so what an experiment can measure is the mass of hadrons (Chapter 13). The pattern of the fermion masses, which run over five orders of magnitude from the electron to the top quark with no known rule, is the *flavour puzzle* of [Chapter 32](/chapters/beyond-the-standard-model/).

## The table

::particle-table{n="D.2" caption="Every particle in hep/particles. Filter by kind, search by name, symbol or PDG code, and sort by mass or code. Antiparticles are not listed: negate the PDG code (the antiparticle of the muon, code 13, is code −13; particles that are their own antiparticles, such as the photon and the π⁰, have no separate entry). A width Γ is given for particles that decay too fast to have a measurable flight path, and a lifetime τ for the others; the two are related by τ = ħ/Γ (Chapter 3)."}

### How to read it

- **PDG code.** The Monte Carlo numbering scheme of the Particle Data Group, used by every generator and analysis tool in the field. Quarks are 1 to 6 (d, u, s, c, b, t); the charged leptons are 11, 13, 15 and their neutrinos 12, 14, 16; the gluon is 21, the photon 22, the Z 23, the W⁺ 24 and the Higgs boson 25. Hadrons are built from their quark content: a meson's code has the digits of its two quarks and its spin, a baryon's the digits of its three. 211 is π⁺ (u d̄), 321 is K⁺ (u s̄), 2212 is the proton (u u d) and 2112 the neutron (u d d). Antiparticles have the negative code.
- **Mass.** In MeV or GeV. The neutrinos have mass zero in the table, because the table is that of the Standard Model as the generator uses it; they are not massless (Chapter 31). The masses of broad resonances, such as the ρ meson and the Δ baryon, are the centres of their peaks, and their widths are comparable with the mass differences between neighbouring particles.
- **Width or lifetime.** A particle that decays by the strong interaction lives about $10^{-23}$ s, which is the time light takes to cross it; its mass peak has a width of tens to hundreds of MeV, and the table gives the width. A particle that decays by the weak interaction (the charged pions and kaons, the muon, the hyperons, the heavy-flavour hadrons) lives long enough to travel measurable distances and the table gives the lifetime. A stable particle is marked so; the neutron, which is stable in a nucleus and decays in 878 s when free, has a lifetime in the table.
- **Charge, spin, B.** The electric charge in units of $e$, the spin in units of $\hbar$, and the baryon number (⅓ for a quark, 1 for a baryon). The library's own table stores the charge as 3Q, the spin as 2J and the baryon number as 3B, so that everything is an integer.
- **Main decays.** The three largest branching fractions of the library's reduced decay table, with the fractions in per cent. The table lists the modes that matter for the course; the fractions of a particle need not add up to 100 %, and the generator renormalises them (see the notes in Appendix E on what the decay stage does and does not do).

```quiz
q: 'A reconstruction program prints a particle with the PDG code −13. What is it?'
options:
  - text: An antimuon, μ⁺.
    correct: true
    why: 'The muon μ⁻ has code 13. The negative code is its antiparticle, μ⁺. The charged leptons are 11, 13, 15 for e, μ, τ, so the sign tells particle from antiparticle.'
  - text: A muon neutrino.
    why: 'The muon neutrino has code 14. The codes 12, 14, 16 are the neutrinos.'
  - text: A hadron containing a strange antiquark.
    why: 'Quarks and antiquarks are codes ±1 to ±6 (the strange quark is 3). A hadron has a code of three or more digits, such as 321 for the K⁺.'
```

## Where the numbers come from, and what they are not

The mass, width or lifetime and main decay modes of each particle come from the PDG's 2024 review, rounded to the precision that the course uses; the library's tests check that the table is self-consistent (every listed decay mode of every particle conserves charge, baryon number and lepton number). It is **not** a complete table. It has the hadrons that the chapters and the generator use (the light mesons and baryons of the Eightfold Way, the charm and bottom hadrons, the quarkonia that appear on the dimuon map), and a few lists are known to be incomplete: for example, the decay tables of the hadrons contain only the main channels, the vector kaons K\* and the excited heavy-flavour states are absent (the hadronisation stage replaces them with the nearest particle of the same flavour). Where an exercise depends on a value, the exercise says so.

The neutrino parameters of Chapter 31, the Higgs couplings of Chapter 30 and the coupling constants and widths computed by the generator (Appendix F, `hep/sm`) are not in this table.
