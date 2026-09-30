---
number: 1
title: Scales and natural units
summary: The electronvolt, the rule that short distances need high energies, and the unit system in which ħ = c = 1, so that mass, energy and momentum are the same kind of quantity.
duration: About 1½ hours
prerequisites: [anatomy-of-a-collision]
---

A particle physicist will say that the Higgs boson has a mass of 125 GeV, that it lives for about 10⁻²² seconds, and that it is produced in a collision with a cross-section of 50 picobarns. There are four unfamiliar units in that sentence, and none of them is an SI unit. They are not affectations. They are the units in which the numbers come out close to 1, and they rest on a convention, *natural units*, that removes two of the fundamental constants from every equation. This chapter sets up that convention, because every later chapter uses it, and then uses it to answer the question that shapes all of experimental particle physics: how much energy does it take to look at something small?

## The electronvolt

An **electronvolt** (eV) is the energy an electron gains when it is accelerated through a potential difference of one volt:

$$1\ \text{eV} = 1.602\,176\,634 \times 10^{-19}\ \text{J}.$$

That is a tiny number of joules and a convenient one for atoms. Visible light consists of photons of 2 to 3 eV. Ionising a hydrogen atom takes 13.6 eV. The rearrangement of electrons in chemistry, from a burning match to a battery, costs a few eV per atom. A medical X-ray photon carries a few tens of keV (10³ eV), and the nuclear reactions that power stars (see the [fusion chapter of the astrophysics course](/astrophysics/ch/fusion/)) are measured in MeV (10⁶ eV). Particle physics lives above that, in **GeV** (10⁹ eV) and **TeV** (10¹² eV). A proton at rest has an energy of 0.938 GeV, so that "1 GeV" is about the energy in a proton's mass. The Large Hadron Collider, the machine that Chapter 0 introduced, accelerates protons to 6.8 TeV each.

One proton at 6.8 TeV carries $6.8\times10^{12} \times 1.6\times10^{-19}$ J, a little over a microjoule: the kinetic energy of a mosquito in slow flight. The extraordinary thing about the LHC is not the amount of energy but its concentration: a microjoule delivered to an object a femtometre across.

```numeric
id: proton-joules
title: A proton in joules
prompt: A proton in the LHC has an energy of 6.8 TeV. What is this in joules?
answer: 1.0895e-6
unit: J
tolerance: 0.02
hints:
  - 1 TeV = 10¹² eV, and 1 eV = 1.602 × 10⁻¹⁹ J.
explain: "6.8 × 10¹² × 1.602 × 10⁻¹⁹ J = 1.09 × 10⁻⁶ J, a microjoule. A mosquito of 2 mg at 1 m/s has ½mv² = 10⁻⁶ J."
```

Because the electronvolt measures energy, and energy and mass are two forms of one thing (Chapter 2), particle physicists measure masses in eV as well, meaning the **rest energy** *mc*²: the electron is 0.511 MeV, the muon 105.7 MeV, the proton 938.3 MeV, the Z boson 91.19 GeV, the Higgs boson 125.2 GeV, the top quark 172.6 GeV.:cite[pdg2024] Measuring momentum in eV as well (strictly, in eV/*c*) completes the set, and is the start of the convention to come.

## Short distances need high energies

Why would anyone build a twenty-seven kilometre machine to study things a trillionth of a trillionth the size of a pea? Because looking at something means scattering something off it, and the probe has to be *smaller than what you want to see*. A wave cannot resolve details smaller than its wavelength. A quantum particle of momentum *p* behaves as a wave of wavelength λ = *h*/*p* (Chapter 3), so the smaller the detail, the larger the momentum. For a particle moving near the speed of light, energy and momentum are interchangeable (*E* ≈ *pc*), and the rule of thumb is

:::equation{#resolution caption="To resolve a length L you need a probe of energy of at least about hc/L."}
$$\term{E}{E} \;\gtrsim\; \frac{\term{hc}{hc}}{\term{L}{L}}, \qquad hc = 1239.84\ \text{eV·nm} = 1.2398\ \text{GeV·fm}$$

```terms
E:
  label: 'E, the probe energy'
  what: The energy of the photon or electron (or any fast particle) used to look at the target.
  why: A fast particle of energy E has momentum E/c, hence wavelength hc/E.
  effect: Double the energy and the finest detail you can resolve is halved.
hc:
  label: 'hc, Planck’s constant times the speed of light'
  what: A conversion factor between a wavelength and an energy. It is 1239.84 eV·nm, or, in the units of particle physics, 1.2398 GeV·fm.
  why: It is the one combination of Planck’s constant and the speed of light that turns a length into an energy, and therefore the exchange rate between "how small" and "how hard".
  effect: Visible light, 500 nm, is 2.5 eV. A proton-sized length of 1 fm is 1.24 GeV.
L:
  label: 'L, the size to be resolved'
  what: The length of the smallest feature you want to see.
  why: A probe smaller than L is needed to tell the features apart.
  effect: A nucleus is about 10 fm, a proton about 1 fm, and the smallest scale probed so far, in collisions at the LHC, is about 10⁻¹⁹ m = 10⁻⁴ fm.
```
:::

The factor of 2π that separates *h* from ħ is a matter of convention, and this is a rule of thumb, but the trend is exact: **a hundred times smaller needs a hundred times more energy**. Drag the slider to see the ladder.

::scale-zoom{n="1.1" caption="The size of things against the energy needed to resolve them, and the apparatus that got there. Each step down in size needs a probe of proportionally higher energy. The bottom of the ladder, 10⁻¹⁹ m, is where the LHC's collisions between quarks and gluons probe; nothing smaller has been resolved, and nothing has yet been seen inside a quark or an electron."}

:::history{year=1911 title="The nucleus, from alphas that bounced back" people="Ernest Rutherford, Hans Geiger, Ernest Marsden" source="Sources: Rutherford (1911); Hofstadter (1956)."}
In 1909 Hans Geiger and Ernest Marsden, working in Ernest Rutherford's laboratory at Manchester, fired alpha particles (helium nuclei of about 5–8 MeV) at a thin gold foil. Nearly all went straight through, and roughly one in several thousand bounced back. Rutherford later said it was as if a 15-inch shell had bounced off a sheet of tissue paper.

In 1911 he showed that the result required the atom's positive charge and most of its mass to sit in a region much smaller than the atom: from the energy of the alphas he could say that the nucleus of gold was smaller than 3.4 × 10⁻¹² cm = 34 fm, thousands of times smaller than the atom.:cite[rutherford1911] The alphas could not get much closer to the centre than about 30 fm: their energy could not overcome the electric repulsion any further. To see the inside of the nucleus and then the proton, physicists needed more energetic probes, and they found them in electron accelerators: in the 1950s Robert Hofstadter's electrons at Stanford measured the proton's size,:cite[hofstadter1956] and at SLAC in 1967–1968 electrons of 20 GeV saw the quarks inside it (Chapter 13). Chapter 4 reruns the first of these experiments.
:::

## Natural units

The rule $E \gtrsim hc/L$ has two constants in it, and they are in every equation of quantum mechanics and relativity. **Natural units** remove them by choosing units in which

$$\hbar = 1, \qquad c = 1.$$

This is not an approximation. It is a choice of the units of length and time such that the speed of light is 1 (one unit of length per unit of time: light travels one *light-second* per second) and the quantum of action is 1. The consequence is that dimensions collapse: *every* quantity can be expressed in a power of one unit of energy, conventionally the GeV.

| Quantity | SI dimension | Natural units | Conversion |
|---|---|---|---|
| Energy, momentum, mass | J, kg m/s, kg | GeV | *E* = *mc*², *p* → *pc*; 1 GeV/*c*² = 1.783 × 10⁻²⁷ kg |
| Length | m | GeV⁻¹ | 1 GeV⁻¹ = ħ*c*/GeV = 0.1973 fm |
| Time | s | GeV⁻¹ | 1 GeV⁻¹ = ħ/GeV = 6.582 × 10⁻²⁵ s |
| Cross-section (an area) | m² | GeV⁻² | 1 GeV⁻² = (ħ*c*)²/GeV² = 0.3894 mb |
| Temperature | K | GeV | *k*<sub>B</sub>*T*; 1 eV ≙ 11 604.5 K |
| Electric charge | C | (dimensionless) | *e* = √(4πα) with α = 1/137.04 |

The constant you need most is the exchange rate between lengths and energies:

$$\hbar c = 197.327\ \text{MeV·fm} = 0.197327\ \text{GeV·fm}.$$

If you know it, you can restore units at the end of any calculation: write the answer in natural units (a number of GeV to some power), multiply by powers of ħ and *c* until the dimensions are right. A few examples, each of them worth remembering:

- **The range of a force.** A force carried by a particle of mass *m* has a range of about 1/*m* in natural units: ħ*c*/(*mc*²). For the pion (140 MeV) this is 197.3/139.6 = 1.4 fm, the range of the nuclear force (Chapter 10).
- **The Compton wavelength of the electron**: ħ*c*/(0.511 MeV) = 386 fm.
- **A lifetime from a width.** An unstable particle has a *width* Γ in GeV and a mean lifetime τ = ħ/Γ = 6.582 × 10⁻²⁵ GeV·s / Γ. The Z boson has Γ = 2.4955 GeV, so τ = 2.64 × 10⁻²⁵ s, which is why the Z can never be seen flying through a detector; Chapter 3 explains the connection.

```numeric
id: z-lifetime
title: The lifetime of the Z
prompt: The Z boson has a width of Γ = 2.4955 GeV. What is its mean lifetime τ = ħ/Γ in seconds? (ħ = 6.582 × 10⁻²⁵ GeV·s.)
answer: 2.6376e-25
unit: s
tolerance: 0.01
hints:
  - In natural units τ = 1/Γ, and 1 GeV⁻¹ = 6.582 × 10⁻²⁵ s.
```

### Cross-sections and the barn

A **cross-section** σ is an area: the effective target the collision presents. Nuclear physicists measured it in **barns**, 1 b = 10⁻²⁸ m² = 100 fm², about the cross-sectional area of a uranium nucleus, and the name stuck (the name is usually traced to wartime work at Purdue University). Processes at the LHC are rare, and cross-sections are quoted in **picobarns** (10⁻¹² b) and **femtobarns** (10⁻¹⁵ b). The total cross-section for producing a Higgs boson in a collision of two protons at 13 TeV is of order 50 pb; for an inelastic proton–proton collision of any kind it is about 80 mb, more than a billion times larger. Chapter 3 shows how a cross-section and a beam intensity together give the number of events per second.

### The unit converter

The two tables above are exactly what the converter below computes. It is also available on any page from the units icon in the top bar.

::units-converter{n="1.2" caption="Type a value in any unit. The natural-unit form is shown first. For a length or a time, the energy scale it corresponds to is shown too: try 1 fm, or 2.5e-19 m (the LHC's best resolution), or 2.6376e-25 s."}

:::fermi[How many protons' worth of energy in one LHC proton?]
A proton at rest has *mc*² = 0.938 GeV. The LHC gives each proton 6.8 TeV = 6,800 GeV. So the energy is 6,800 / 0.938 ≈ 7,200 times the proton's own rest energy: its Lorentz factor is γ ≈ 7,250. At that γ the proton's speed differs from *c* by a part in 10⁸: about 3 m/s slower than light, or 10⁻⁸ of *c*. (Check: 1 − β ≈ 1/(2γ²) = 9.5 × 10⁻⁹, and 9.5 × 10⁻⁹ × 3 × 10⁸ m/s ≈ 2.9 m/s.)
:::

## Programmer's view: units as types

:::programmer
Unit errors have destroyed spacecraft, and natural units make them easier to commit, since a number in GeV and a number in GeV⁻¹ look the same on screen. The library's convention is therefore strict: **everything in `hep` is in GeV unless its name says otherwise** (`decayLengthMm`, `widthToLifetime` returning seconds), and the functions in `hep/units` convert between the two. Converting at the boundary, once, is the same discipline as parsing input once at the edge of a program: inside, there is one representation.
:::

## Where the constants come from

Natural units are older than particle physics. In 1899, before the quantum had a name, Max Planck noticed that his new constant *h*, together with the speed of light *c* and Newton's constant of gravitation *G*, could be combined into a unit of length, of mass and of time that did not depend on any human artefact, and that would keep their meaning for any civilisation, including a non-human one.:cite[planck1899] The **Planck length** √(ħ*G*/*c*³) = 1.6 × 10⁻³⁵ m and the **Planck energy** 1.22 × 10¹⁹ GeV are the scales at which gravity becomes as strong as the other forces and where our theories of it are expected to fail. The LHC reaches 10⁻¹⁹ m, sixteen orders of magnitude above the Planck length. Chapter 32 returns to the gap.

:::experiments
In the experiments' software the same convention holds: four-momenta are in GeV, but positions in a detector are in millimetres, times in nanoseconds, and magnetic fields in tesla, because those are the units of the hardware. The two are connected by a few constants that every framework defines once. ROOT's `TMath`, Geant4's `CLHEP::` system of units and the Python `scipy.constants` or `particle` and `hepunits` libraries all provide them. In the Geant4 convention the base units are millimetre, nanosecond, MeV, positron charge, kelvin, mole, candela and radian. This course's `hep` library uses GeV, mm and ns inside the detector model, and a function whose name says so whenever it leaves the GeV system.
:::

## What comes next

Everything in the course is now expressible: energies in GeV, lengths in GeV⁻¹ or femtometres, times in GeV⁻¹ or seconds. [Chapter 2](/chapters/relativity-for-particles/) gives the first substantial use of the convention, in four-vectors and the invariant mass, and turns 100,000 real collisions into a histogram with peaks. [Appendix C](/appendix/units/) collects the conversions, the metric and the detector coordinates in one place.

## Further reading

- The Particle Data Group's *Review of Particle Physics*, sections on constants and units (:cite[pdg2024]).
- The CODATA recommended values of the fundamental physical constants, for the values of ħ, *c*, *e* and *k*<sub>B</sub> used here (:cite[codata2018]).
