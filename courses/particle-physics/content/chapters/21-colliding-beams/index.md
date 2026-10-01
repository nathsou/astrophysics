---
number: 21
title: Colliding beams
summary: How many collisions a pair of bunches produces, and what it costs. Luminosity derived from the beam geometry, β* and the crossing angle, pile-up, integrated luminosity, synchrotron radiation and why the LHC collides protons, the energy stored in the beam, and the accident of 2008. The reader writes the luminosity formula.
duration: About 3 hours
prerequisites: [steering-and-focusing]
---

When two bunches cross in the middle of ATLAS or CMS, each contains about 1.15 × 10¹¹ protons (the design value), so there are 1.3 × 10²² pairs of protons that could collide. In the design beam, on average about 26 do. A pair of protons that passes through another bunch has roughly a two-in-10²¹ chance of interacting, and the machine is built so that this happens 31 million times a second. The proton is mostly empty space, in the sense that matters here: its cross-section is about 80 millibarns, which is 8 × 10⁻²⁶ cm², and a bunch that is 17 micrometres wide at the crossing point is a target of about 10⁻⁶ cm². The number of collisions depends on the ratio of the two.

That ratio is the subject of the chapter. Chapter 2 showed that colliding beams spend all of their energy on new particles, where a fixed target wastes most of it on the motion of the wreckage, and said the price would be paid here. The price is the density of the target: two beams crossing are far more dilute than a block of liquid hydrogen. This chapter derives the rate of collisions from the shape of the beams, finds out what sets it (and follows it through to the number of overlapping collisions in every event and the amount of data collected), then turns to the two costs of a circular collider: the energy that light electrons radiate away, and the energy that heavy protons store.

## Rate = cross-section × luminosity

Chapter 3 defined the rate of any process as *R* = σ*L*, the cross-section of the process times a quantity *L* that depends only on the beams, the **luminosity**. Its unit is the inverse of a cross-section per second: cm⁻² s⁻¹. The LHC's design value is 10³⁴ cm⁻² s⁻¹.:cite[lhc-design] With an inelastic cross-section of about 80 mb = 8 × 10⁻²⁶ cm², the rate of proton–proton collisions is 10³⁴ × 8 × 10⁻²⁶ ≈ 8 × 10⁸ per second.

```fermi
id: collisions-per-second
title: Collisions per second at the LHC
prompt: 'The LHC’s design luminosity is 10³⁴ cm⁻² s⁻¹. The inelastic proton–proton cross-section is about 80 mb, and 1 mb = 10⁻²⁷ cm². About how many inelastic collisions happen per second, in all of ATLAS and CMS together (two collision points that share the same luminosity)? Give your answer per second for one interaction point.'
answer: 8e8
unit: s⁻¹
factor: 3
hints:
  - Rate = cross-section × luminosity.
  - 80 mb = 80 × 10⁻²⁷ cm².
explain: "8 × 10⁻²⁶ cm² × 10³⁴ cm⁻² s⁻¹ = 8 × 10⁸ per second, for each of the two high-luminosity collision points: nearly a billion collisions a second. Out of them, about one in ten billion makes a Higgs boson (Chapter 0 gave one in 1.6 × 10⁹ for the total cross-section, and most of these are not recorded): the Higgs rate is a few per second at most, which is what the trigger of Chapter 27 has to find."
```

A fixed-target experiment has a much higher luminosity. A beam of *N* protons spilled over a time *T* onto a target of length ℓ and density *n* gives *L* = (*N*/*T*) *n* ℓ. Take the 3.2 × 10¹⁴ protons in one LHC beam, spilled over one second (the SPS does extract beams over seconds for its fixed-target experiments), onto a metre of liquid hydrogen (0.071 g/cm³, which is 4.2 × 10²² protons per cm³). Then *L* = 3.2 × 10¹⁴ × 4.2 × 10²⁴ = 1.4 × 10³⁹ cm⁻² s⁻¹, a hundred thousand times the collider's. The catch is the energy: a 7 TeV beam on a stationary proton has √*s* = √(2 × 7,000 × 0.938) = 115 GeV, where the collider has 14,000. Whatever needs more than 115 GeV, the top quark or the Higgs boson, is out of reach. A collider's luminosity is what is left after you have paid for the energy, and the rest of this section looks at how it is made.

### The formula, from the geometry

Two bunches of *N* protons each pass through each other. If the transverse densities of the bunches, normalised to 1, are ρ₁(*x*, *y*) and ρ₂(*x*, *y*), the number of collisions in one crossing is σ *N*² ∫ρ₁ρ₂ d*x* d*y*: each of the *N* protons of one bunch meets, on average, a target of *N* ρ₂ per unit area. For two identical Gaussian bunches, of widths σ<sub>x</sub> and σ<sub>y</sub>, the overlap integral is 1/(4π σ<sub>x</sub>σ<sub>y</sub>). With *n* bunch pairs crossing per turn and *f* turns per second, the rate is σ *N*² *n* *f*/(4π σ<sub>x</sub>σ<sub>y</sub>), and the luminosity is what multiplies σ:

:::equation{#luminosity caption="The luminosity of two equal bunches crossing head-on. It depends on the beams alone."}
$$\term{L}{L} = \frac{\term{N}{N}^2\,\term{n}{n}\,\term{f}{f}}{4\pi\,\term{sx}{\sigma_x}\,\term{sy}{\sigma_y}}$$

```terms
L:
  label: 'L, the luminosity'
  what: The number of collisions per second per unit cross-section, in cm⁻² s⁻¹ (or m⁻² s⁻¹).
  why: The rate of any process is its cross-section times this number, so it is the machine's half of every rate.
  effect: 10³⁴ cm⁻² s⁻¹ in the design, 2 × 10³⁴ in recent runs, and 5 × 10³⁴ planned for the high-luminosity upgrade.
N:
  label: 'N, the bunch population'
  what: The number of protons in each bunch (assumed equal in the two beams).
  why: It appears squared: doubling the protons in both beams gives four times the collisions.
  effect: 1.15 × 10¹¹ in the design; the limit is the electromagnetic force of one beam on the other.
n:
  label: 'n, the number of colliding bunch pairs'
  what: The number of bunches in each beam that meet bunches of the other beam at this collision point.
  why: Each crossing contributes, so n multiplies the rate.
  effect: 2,808 in the design, out of 3,564 possible slots of 25 ns.
f:
  label: 'f, the revolution frequency'
  what: The number of turns per second, c/C, 11,245.5 Hz for the LHC.
  why: Each bunch crosses its partner once per turn.
  effect: Fixed by the circumference; the crossing rate n·f is 31.6 million per second.
sx:
  label: 'σx, the horizontal beam size'
  what: The rms width of the bunch in x at the collision point, in metres.
  why: It is what the overlap integral is inversely proportional to: the smaller the beams, the denser the target.
  effect: 16.6 µm in the design, both σx and σy, since the beams are round at the collision point.
sy:
  label: 'σy, the vertical beam size'
  what: The rms height of the bunch in y at the collision point, in metres.
  why: It enters in the same way as σx.
  effect: Electron colliders such as LEP used flat beams, with σy about 60 times smaller than σx.
```
:::

:::deeper[The overlap integral]
For one transverse coordinate, a Gaussian bunch has ρ(*x*) = exp(−*x*²/2σ²)/(σ√(2π)). Two identical ones overlap as ∫ρ² d*x* = (1/(2πσ²)) ∫ exp(−*x*²/σ²) d*x* = (1/(2πσ²)) σ√π = 1/(2σ√π). The two coordinates are independent, so the product is 1/(4π σ<sub>x</sub>σ<sub>y</sub>). With unequal bunch sizes the widths add in quadrature, σ² → (σ₁² + σ₂²)/2 for each coordinate; the course, like the machine's design, uses equal bunches. The formula gives the collisions of a single crossing in which the bunches pass through each other with no change in shape, which is an idealisation, but the real corrections (the next few paragraphs) are the size of tens of per cent, not factors of ten.
:::

The beam size at the collision point is the one from Chapter 20: σ*² = ε β*, where ε = ε<sub>n</sub>/γ is the geometric emittance (normalised emittance divided by the Lorentz factor) and β* is the value of the β function at the collision point. The luminosity is then

$$L = \frac{N^2\, n\, f\,\gamma}{4\pi\,\varepsilon_n\,\beta^*}\cdot F,$$

where *F* ≤ 1 accounts for the crossing angle, below. Each factor is a knob, and each has a cost:

- **N** is limited by the forces each beam exerts on the other and by instabilities, which grow with the current. The injectors must also deliver it.
- **n** is limited by the 25 ns spacing, by the gaps needed for the injection kickers and the beam dump, and by the stored energy (below).
- **ε<sub>n</sub>** is set by the quality of the injector chain, since the emittance cannot be reduced in a ring except by damping (for electrons) or cooling (for protons, at low energy).
- **β\*** is set by the strength of the quadrupoles next to the collision point, called the inner triplet, and the aperture they provide: the beam is widest in the triplet, where the β function is at its largest, β(*s*) = β*(1 + (*s*/β*)²) at a distance *s* from the point. A beam of small β* is a beam that is very wide nearby: the smaller β*, the larger the magnet aperture needed. The LHC's design β* is 0.55 m.

With the design values (*N* = 1.15 × 10¹¹, *n* = 2,808, *f* = 11,245.5 Hz, ε<sub>n</sub> = 3.75 µm, β* = 0.55 m, γ = 7,460), σ* = 16.6 µm and the head-on luminosity is 1.20 × 10³⁴ cm⁻² s⁻¹. The design value of 10³⁴ is lower because of the crossing angle.

### The crossing angle

Bunches are 25 ns apart, which is 7.5 m, and for several tens of metres on either side of the collision point the two beams share one vacuum pipe. If the beams met head-on, the bunches would meet each other not only at the collision point but every 3.75 m along the shared pipe: parasitic collisions, which the detectors do not want and the beams' own dynamics cannot take. The beams cross instead at a small angle, which the LHC design fixes at 285 µrad in total.:cite[lhc-design] The price is that the two bunches overlap less, since each is 7.5 cm long and 17 µm wide, and they cross at an angle: the tilt of 142 µrad over the half-length of a bunch, 7.5 cm, is 11 µm, which is two-thirds of the bunch's width. The **Piwinski angle** φ = θσ<sub>z</sub>/(2σ*) measures that, with θ the full crossing angle and σ<sub>z</sub> the bunch length, and the loss is

$$F = \frac{1}{\sqrt{1 + \varphi^2}}.$$

At the design values φ = 0.65 and *F* = 0.84, so *L* = 0.84 × 1.20 × 10³⁴ = 1.01 × 10³⁴ cm⁻² s⁻¹. The same crossing angle costs more as β* shrinks, since σ* falls and φ rises. Crab cavities, RF cavities that tilt each bunch so that the two meet face to face, recover the loss; they are part of the high-luminosity upgrade.

```predict
q: 'The LHC’s focusing is upgraded so that β* falls from 0.55 m to 0.275 m, with everything else (including the 285 µrad crossing angle) unchanged. By what factor does the luminosity rise?'
options:
  - text: Exactly 1, since β* does not appear in the crossing angle.
    why: 'β* sets the beam size σ* = √(εβ*), and the beam size is in the denominator of the luminosity.'
  - text: Exactly 2, since L is proportional to 1/β*.
    why: 'That is true of the head-on luminosity. But a smaller beam is also more sensitive to the crossing angle, so the geometric factor F falls as well.'
  - text: By a little less than 2: about 1.76.
    correct: true
    why: 'The head-on luminosity doubles, but the Piwinski angle φ = θσz/2σ* rises from 0.65 to 0.92, so F falls from 0.84 to 0.74, and the net gain is 2 × 0.74/0.84 = 1.76. This is why HL-LHC needs crab cavities as well as new quadrupoles.'
```

::bunch-overlap{n="21.1" caption="Two bunches crossing at the LHC's design parameters. Drawn in true proportion along each axis, but the axes have different scales: the beam is about a thousand times longer than it is wide. Tilt the bunches by raising the angle, and the shaded overlap loses its ends. Shrink β* and watch the width fall and the angle matter more. Turn on the crab cavities and the bunches meet face on. The hourglass: the beam size away from the focus grows as √(1 + (s/β*)²); it matters little at the design values (0.99 of the luminosity is kept) and more as β* falls (0.90 at β* = 0.15 m)."}

There is one further effect in the formula's list: the **hourglass effect**. The beam is narrowest at the collision point and widens on either side, like the waist of an hourglass, and a bunch that is long compared with β* has its ends in a region where the beam is wider. The reduction is about 1% for the design β* and σ<sub>z</sub> = 7.55 cm, but grows to about 10% at β* = 0.15 m, which is why the bunch length is one of the things designers of a low-β* optics must watch.

```numeric
id: lumi-formula
title: The design luminosity by hand
prompt: 'Compute the head-on luminosity, in units of 10³⁴ cm⁻² s⁻¹, for N = 1.15 × 10¹¹, n = 2,808, f = 11,245.5 Hz, ε_n = 3.75 µm, β* = 0.55 m and γ = 7,460. First σ* = √(ε_n β*/γ), then L = N² n f/(4π σ*²), then convert from m⁻² to cm⁻².'
answer: 1.20
unit: × 10³⁴ cm⁻² s⁻¹
tolerance: 0.02
hints:
  - σ*² = 3.75 × 10⁻⁶ × 0.55/7,460 = 2.76 × 10⁻¹⁰ m².
  - 1 m⁻² = 10⁻⁴ cm⁻².
explain: "σ*² = 2.765 × 10⁻¹⁰ m² (σ* = 16.6 µm); N² n f = 1.3225 × 10²² × 2,808 × 11,245.5 = 4.18 × 10²⁹ s⁻¹; divided by 4π σ*² = 3.47 × 10⁻⁹ m² this is 1.20 × 10³⁸ m⁻² s⁻¹ = 1.20 × 10³⁴ cm⁻² s⁻¹."
```

## Pile-up

The 1.3 × 10²² pairs in one crossing produce, on average, *μ* = σ<sub>inel</sub> *L*/(*n* *f*) collisions: the rate of collisions divided by the rate of crossings. At the design luminosity and 80 mb, μ = 25.6 (the machine's planners of the 1990s expected a somewhat lower number, 19 to 20, because their estimate of the cross-section at 14 TeV was lower than the value measured since). The number of collisions in a crossing is a Poisson random variable with that mean (Chapter 3), so crossings with 10 or with 40 collisions are common, and one with none is rare.

These overlapping collisions are **pile-up**. The detector cannot choose: it records the crossing, and every collision of it. One of them is the hard collision that made the trigger fire (Chapter 27); the others are mostly glancing, and leave a few tens of particles each at low energy, which overlap the tracks and calorimeter deposits of the interesting one. Their vertices are spread along the beam axis with the width of the luminous region, σ<sub>z</sub>/√(2(1 + φ²)) = 4.5 mm at the design values, and the tracker's resolution in *z* is fine enough to tell them apart (Chapter 8). The LHC's pile-up rose well beyond the design value as the luminosity did: the highest in Run 2 (2015–2018) was about 60, and in the present runs the mean is of a similar size.:cite[boyd2020] The high-luminosity upgrade plans for more than a hundred.

```numeric
id: pileup-run3
title: Pile-up at twice the design luminosity
prompt: 'A recent LHC fill has a peak luminosity of 2 × 10³⁴ cm⁻² s⁻¹ with 2,400 colliding bunches (f = 11,245.5 Hz). Take σ_inel = 80 mb. What is the mean number of collisions per crossing?'
answer: 59
unit: collisions
tolerance: 0.03
hints:
  - μ = σ L/(n f), with σ = 80 × 10⁻²⁷ cm².
explain: "μ = 80 × 10⁻²⁷ × 2 × 10³⁴ / (2,400 × 11,245.5) = 1.6 × 10⁸ / 2.70 × 10⁷ = 59. Doubling the luminosity at fewer bunches more than doubles the pile-up: it is the luminosity per bunch crossing that matters to the detectors."
```

::collider-dashboard{mode="lhc" n="21.2" caption="The collider dashboard. Start from the design parameters, or from the Run 3-like or high-luminosity presets, and change the bunch population, number of bunches, emittance, β* and crossing angle. The luminosity and pile-up are computed with the formulas of this chapter (with your own `luminosity` function once it passes its tests, below). The picture is one bunch crossing, seeded: the dots are the collision vertices along the beam axis, filled for the hard collision and open for pile-up. The lower panels show the energy in the beam and what synchrotron radiation costs (the next sections). The presets are illustrative, not the machine's official tables."}

Try to reach the design luminosity with fewer bunches, and watch the pile-up rise; try the flat-top value for the high-luminosity upgrade and see the pile-up reach a hundred or more. The pile-up is the trade: for a given luminosity, *more bunches with fewer collisions each* is always better for the experiments, and the machine is limited in how many bunches it can store by the 25 ns spacing and the stored energy. The alternative of **levelling**, in which the luminosity is held constant by changing β* or the beam overlap during the fill, is how the high-luminosity machine will keep pile-up within what the detectors can handle.

:::programmer
Luminosity is a **throughput**: the machine's side of a rate, in units of events per second per unit of cross-section, independent of which process you look for. A detector's trigger sees a stream with a fixed arrival rate (the crossing rate, 40 MHz at most) and a variable batch size per item (the pile-up, Poisson distributed). The design problem is the same as sizing a queue: the arrival rate *n f* is fixed by the clock, so the only way to raise the throughput is to make each batch bigger, and what limits that is the processing time per batch, here the number of overlapping collisions the detector can untangle. Chapter 27 returns to it from the other side, when the trigger must reduce 31 million crossings per second to about a thousand events per second.
:::

## Integrated luminosity and the fill

The luminosity is a rate. The number of events of a process in a dataset is *N* = σ ∫*L* d*t*, the cross-section times the **integrated luminosity**. It is measured in inverse femtobarns, 1 fb⁻¹ = 10³⁹ cm⁻², so that a process with a cross-section of 50 pb = 5 × 10⁴ fb, in a dataset of 100 fb⁻¹, is expected to occur 5 million times (that is about the number of Higgs bosons produced in the LHC's second run; how many of them can be *seen* is the subject of Chapters 27 to 29).

The luminosity is not constant during a fill. Every collision removes two protons from the beams (burn-off), and the beams also lose protons, and emittance grows, by other processes with a lifetime of tens of hours. Beam intensity *y* = *N*/*N*₀ obeys d*y*/d*t* = −*y*/τ<sub>o</sub> − *y*²/τ<sub>b</sub>, where τ<sub>b</sub> = *N*₀/(*k*σ*L*₀) is the burn-off time for *k* collision points, and the luminosity goes as *L* = *L*₀ *y*². At the design luminosity the burn-off time constant is 56 hours for the intensity (and so 28 hours for the luminosity), at 2 × 10³⁴ it is 28 (14). The luminosity falls during a fill, and when it has fallen enough it is better to dump the beams, refill the machine and start again than to wait: a cycle of *T* hours of collisions and a turnaround of a few hours gives the highest average luminosity at a certain *T*.

::fill{n="21.3" caption="One fill of the LHC in a simple model: luminosity decays as protons are burnt off and lost otherwise. The lower plot is the average luminosity over a whole cycle, fill plus turnaround, as a function of the fill length, with a maximum: at a peak of 2 × 10³⁴, a 20 h lifetime from other losses and a 3 h turnaround, the best fill is about 5.4 hours long and gives an average of 0.86 × 10³⁴, or 0.74 fb⁻¹ per day. The numbers are a model's, not the machine's record: real fills are longer because operators also weigh the time needed to refill and the reliability of the machine."}

:::hood[Solving the burn-off equation]
The luminosity of a fill has a closed form, which the library implements in `luminosityAt` (from `hep/machine/luminosity.ts`):

```ts
export function luminosityAt(t: number, L0: number, tauBurn: number, tauOther: number): number {
  const rb = Number.isFinite(tauBurn) ? 1 / tauBurn : 0;
  let y: number;
  if (!Number.isFinite(tauOther)) y = 1 / (1 + rb * t);
  else y = 1 / ((1 + tauOther * rb) * Math.exp(t / tauOther) - tauOther * rb);
  return L0 * y * y;
}
```

The equation d*y*/d*t* = −*y*/τ<sub>o</sub> − *y*²/τ<sub>b</sub> is Bernoulli's: the substitution *u* = 1/*y* turns it into the linear d*u*/d*t* = *u*/τ<sub>o</sub> + 1/τ<sub>b</sub>, whose solution is *u* = (1 + τ<sub>o</sub>/τ<sub>b</sub>) e<sup>*t*/τ<sub>o</sub></sup> − τ<sub>o</sub>/τ<sub>b</sub>, which is the denominator in the code. Passing `Infinity` for a lifetime switches the mechanism off, and the code treats the two limits separately: with burn-off alone, *y* = 1/(1 + *t*/τ<sub>b</sub>) decays as a power law, not an exponential. The integrated luminosity is the integral of this function (Simpson's rule in `integratedLuminosity`), and the best fill length is found by a scan over *T* of the integral divided by *T* plus the turnaround. A closed form is worth the trouble when the function is evaluated inside a slider's callback.
:::

## Synchrotron radiation

A charged particle moving on a circle is accelerating, and accelerating charges radiate. In a synchrotron the radiated light is called **synchrotron radiation**. It was seen for the first time in a 70 MeV electron synchrotron built at General Electric in 1947, as visible light through a glass vacuum tube, and was at first a nuisance to the people building electron rings.:cite[elder1947] The power radiated by a particle of charge *e* and energy *E* moving on a circle of radius ρ rises with the fourth power of γ, and the energy lost in one turn is

:::equation{#radiation caption="The energy radiated by a particle in one turn of a circular ring."}
$$\term{U}{U_0} = \frac{e^2}{3\varepsilon_0}\,\frac{\term{beta}{\beta}^3\,\term{gam}{\gamma}^4}{\term{rho}{\rho}} \;\approx\; 88.46\ \mathrm{keV}\;\frac{E^4\,[\mathrm{GeV}^4]}{\rho\,[\mathrm{m}]}\quad\text{(electrons)}$$

```terms
U:
  label: 'U₀, the energy lost per turn'
  what: The energy the particle radiates in one revolution, which the RF system must replace.
  why: If it is more than the RF can give, the beam cannot be kept at that energy.
  effect: For an electron at 104.5 GeV in LEP, about 3.4 to 3.5 GeV per turn. For a proton at 6.8 TeV in the LHC, 5.9 keV.
beta:
  label: 'β, the speed'
  what: The speed as a fraction of the speed of light; for the particles here, practically 1.
  why: It enters as the third power: the loss per turn is the radiated power times the time of a turn.
  effect: Negligible difference from 1 at these energies.
gam:
  label: 'γ, the Lorentz factor'
  what: E/mc², the energy divided by the rest energy.
  why: Radiation rises as γ⁴, so it depends on the mass as 1/m⁴ at a given energy.
  effect: γ = 204,000 for a 104.5 GeV electron and 7,250 for a 6.8 TeV proton: the electron's γ is 28 times larger at an energy sixty-five times smaller.
rho:
  label: 'ρ, the bending radius'
  what: The radius of the circle on which the particle is bent, in metres.
  why: A tighter bend means more acceleration and more radiation; a larger ring radiates less at the same energy.
  effect: About 3,000 m for LEP and 2,804 m for the LHC, nearly the same tunnel.
```
:::

The formula follows from the power radiated by an accelerated charge (Larmor's formula, made relativistic), multiplied by the time of one turn; the number 88.46 keV is what the constants come to for an electron, with *E* in GeV and ρ in metres. The key fact is the mass dependence. At the same energy and radius, a proton radiates (*m*<sub>e</sub>/*m*<sub>p</sub>)⁴ = 8.8 × 10⁻¹⁴ times what an electron does: an electron radiates 1.1 × 10¹³ times more.

```predict
q: 'An electron and a proton, each of energy 100 GeV, go round the same ring. Roughly how does the energy each radiates per turn compare?'
options:
  - text: They radiate the same, since the energy and the radius are the same.
    why: 'The radiated energy depends on γ⁴, not on E⁴ alone, and at a given energy γ is inversely proportional to the mass.'
  - text: The electron radiates about 2,000 times more, in proportion to the mass ratio.
    why: 'That would be the answer if the loss went as 1/m. It goes as 1/m⁴, since it rises with γ⁴ and γ = E/mc².'
  - text: The electron radiates about 10¹³ times more.
    correct: true
    why: '(1,836)⁴ = 1.1 × 10¹³. An electron of 100 GeV would lose a few GeV per turn in a ring the size of LEP. A proton of the same energy would lose a fraction of a microelectronvolt.'
```

### LEP and the LHC

**LEP**, the Large Electron–Positron collider, was built in the 27 km tunnel that the LHC now occupies. Its first beam circulated on 14 July 1989, and it ran until 2 November 2000.:cite[cern-lep] At its highest beam energy, 104.5 GeV, reached in 2000 (a collision energy of 209 GeV), each electron radiated about 3.4 to 3.5 GeV in every turn, 3.3% of its energy. (The bending radius that gives the figure is not known to us better than the roughly 3,026 m the library carries, with about 3,100 m quoted elsewhere; they give 3.49 and 3.41 GeV.) Every turn, the RF system had to put back all of that. Its total voltage was about 3.6 GV, made by some 270 superconducting cavities and some dozens of copper ones:cite[lep-rf] so that at 104.5 GeV the energy lost per turn was some 94 to 96% of the voltage available. The electrons were riding nearly at the top of the RF wave, so that the synchronous phase of Chapter 19, with sin φ<sub>s</sub> = *U*₀/*V*, was above 70° and the bucket was a fraction of its usual size.

::radiation-wall{n="21.4" caption="The energy radiated per turn against beam energy, on logarithmic axes, for an electron (solid) and a proton (dashed) in the same ring. The dashed horizontal line is the RF voltage per turn. LEP's electrons (the LEP button) meet the RF line at about 105.6 GeV, the ceiling of this model, which is very close to where LEP stopped. The LHC button puts the ring at the LHC's radius and its 16 MV RF: the proton curve is thirteen orders of magnitude lower and is nowhere near. Drag the radius to the right to see what a larger ring would give an electron machine."}

This is the answer to the question of why LEP stopped near 209 GeV. The loss goes as *E*⁴/ρ, so the RF voltage needed at a given ring radius goes as the fourth power of the energy. To double the beam energy at a fixed ring, one needs 16 times the RF voltage, which in LEP's case would have been about 58 GV, not 3.6. To reach 150 GeV per beam with the same voltage, the ring's bending radius would have to be 12.3 km instead of 3.0 km. There is no ingenuity that changes the scaling: the options are the size of the ring, or a linear collider, in which the electrons do not go round a circle.

```numeric
id: lep-ring
title: A larger ring for electrons
prompt: 'With a total RF voltage of 3.63 GV, at what bending radius ρ, in metres, would an electron of 150 GeV lose exactly 3.63 GeV per turn? Use U₀ [keV] = 88.46 E⁴ [GeV⁴] / ρ [m].'
answer: 12340
unit: m
tolerance: 0.03
hints:
  - 3.63 GeV = 3.63 × 10⁶ keV.
  - ρ = 88.46 × 150⁴ / (3.63 × 10⁶) metres.
explain: "150⁴ = 5.06 × 10⁸, so 88.46 × 5.06 × 10⁸ = 4.48 × 10¹⁰ keV·m, and dividing by 3.63 × 10⁶ keV gives ρ = 12,340 m. That is four times LEP's radius, for 44% more energy, and with no margin left for the bucket: a real machine needs a radius larger still. This is why the electron–positron colliders now under study for a larger tunnel are of the order of ninety kilometres round."
```

The LHC's protons are in the same tunnel, at 6.8 TeV, and radiate 5.9 keV per turn, about 6.7 keV at 7 TeV. The photons have a critical energy of 40 to 44 eV, in the ultraviolet. A whole beam, with a current of 0.58 A in the design, radiates 3.9 kW, not small for a machine at 1.9 K, and the absorbers that intercept it are cooled at a higher temperature than the magnets. But against a beam energy of 362 MJ, it is negligible; the proton's limit is not radiation. An *electron* at 6.8 TeV in the LHC ring would lose 6.7 × 10⁷ GeV in a turn, ten thousand times its own energy, which means it could not be accelerated at all.

### Why the LHC collides protons

The proton is the choice that removes the radiation limit, and that leaves two other limits: the ring's size and the field of its magnets. By the rule *p* = 0.3 *B* ρ, the ring has to be large and the field high: the 8 T of the LHC's dipoles at ρ = 2.8 km is what gives 7 TeV. The price of the choice is that a proton is not an elementary particle. A collision of two protons is a collision of two quarks or gluons, each carrying a fraction of the proton's momentum (Chapter 13), and the energy of that collision is not fixed but spread over a broad range, less than the beams' 13.6 TeV. The energy of the proton beams is not the energy of the collisions; it is a stock that the collisions draw from. The consequence is that a proton collider explores a wide range of energies at the same time, and is a machine for *searching*: if a new particle exists with a mass below a few TeV, the collisions will have made it. An electron–positron collider makes collisions of the full beam energy in a clean environment, and is a machine for *measuring* precisely: LEP measured the Z boson's mass and width to a precision the LHC cannot match (Chapter 23). The two complement each other.

## Energy in the beam

At 7 TeV and with 2,808 bunches of 1.15 × 10¹¹ protons, the energy stored in one beam is 362 MJ (design value).:cite[lhc-design] The Run 3-like parameters of the dashboard (illustrative) give 418 MJ at 6.8 TeV.

| Comparison | Equal to 362 MJ |
|---|---|
| TNT | 87 kg |
| A 400-tonne train | at 153 km/h |
| Copper | enough to heat 590 kg from 20 °C to its melting point and melt it |

These are equivalences, not comparisons of danger: the energy is delivered in a few microseconds by a beam that is half a millimetre wide, to a volume of a few cubic centimetres of whatever it hits. The LHC holds two such beams, and about a thousand times more energy per unit length than any other proton machine before it. The LHC's magnets themselves store, in their fields, more energy still, about which the next section is written.

The machine is therefore protected by several systems, none of which is the subject of a chapter here, and all of which are designed on one principle, that the default action is to *dump the beam*. A set of fast kicker magnets, which can rise in less than the **abort gap**, a gap of about 3 µs (119 of the 3,564 slots of 25 ns, left empty on purpose) in the bunch pattern, pushes the whole beam out of the ring into a transfer line leading to an absorber block of graphite, where it is spread over a large area before it arrives. Collimators, blocks of hard material placed a few millimetres from the beam, intercept protons that have strayed from the core before they reach a magnet. And the superconducting magnets have their own protection, because a small loss of protons in one place, enough to warm the superconductor by a fraction of a kelvin, can make it lose its superconductivity and start to heat itself: a **quench**. The LHC's design report describes the systems.:cite[lhc-design]

:::programmer
Machine protection is **fail-safe design**. The beam may circulate only while a "permit" signal is being asserted by every system that could have an objection (the magnets' power converters, the cryogenics, the collimators, the beam-loss monitors, the experiments' own safety signals). The permit must be refreshed continuously, and its absence, whatever the reason, including a cable cut or a crashed controller, is interpreted as a request to dump. It is the same idea as the watchdog timer or dead-man switch of any embedded system, and the lesson is the same: a safety system should be built so that silence means "no". Its rate of false alarms is the price, and the LHC accepts dozens of unnecessary dumps a year for it.
:::

## The accident of 19 September 2008

The LHC's first beams circulated on 10 September 2008. On 19 September, during tests in which the current through the main dipole circuit of one of the eight sectors (sector 3–4) was being raised, a fault occurred in an electrical connection between two magnets. CERN's analysis, published on 16 October 2008, found the cause to be a faulty electrical connection between two of the accelerator's magnets: an electrical arc punctured the enclosure holding the liquid helium, and helium was released into the tunnel with mechanical damage to a large number of magnets, and contamination of the vacuum system. The CERN report counted serious damage to 24 of the main dipole magnets and 5 of the quadrupoles.:cite[cern-incident]

:::history{year=2008 title="The accident, and the first 7 TeV collisions" people="CERN" source="Sources: CERN's analysis of the incident (16 October 2008); CERN, 'LHC to restart in 2009'; CERN, 'LHC research programme gets underway' (30 March 2010)."}
No one was hurt, and the accident was a fault of a connection, not of the beam. The repairs, which included cleaning the vacuum and replacing magnets, took about a year. Beams circulated again in the LHC on 20 November 2009, a little over a year after the accident.:cite[cern-restart]

The first collisions at 7 TeV in the centre of mass (3.5 TeV per beam, half the design energy) were recorded on 30 March 2010, at 13:06 Central European Summer Time, which CERN declared the start of the LHC research programme.:cite[cern-2010] The machine ran at that energy in 2010 and 2011, at a little higher in 2012, and at 6.5 TeV per beam from 2015 after the connections throughout the ring had been reinforced; the present runs are at 6.8 TeV per beam.:cite[boyd2020]

What this chapter's stored-energy arithmetic adds: the energy released in the tunnel was that of the magnets' fields and helium, not that of the beam. Beam was not involved, and the incident shows that the protection of a machine is a matter of everything it stores, not only of the beam.
:::

The LHC's dipole circuit holds several gigajoules. The incident was the release of a fraction of that energy in a place where nothing had been designed to take it.

## Precursors: five machines that made it possible

The LHC stands on four earlier collider ideas, each one a solution to a problem in this chapter. Each has a story.

:::history{year=1961 title="AdA, the first electron–positron ring" people="Bruno Touschek and colleagues, Frascati" source="Sources: INFN Frascati's history of AdA; Bonolis and Pancheri's account (see the bibliography)."}
The idea of colliding beams was old, but until the late 1950s it was believed that the density of the beams in a ring would be too small for any collisions. Bruno Touschek, at the Frascati laboratory near Rome, proposed in 1960 a small ring in which electrons and positrons (the antiparticle of the electron, Chapter 9) would circulate in opposite directions in the same magnets, since their charges are opposite. The ring, named AdA (*Anello di Accumulazione*, an accumulation ring), stored its first beams on 27 February 1961.:cite[ada-history]

The intensities at Frascati were too low for useful collisions, and in July 1962 AdA was moved to the Laboratoire de l'Accélérateur Linéaire at Orsay, near Paris, where the linear accelerator could fill it faster. There, in 1963–64, electron–positron collisions were observed. The ring also showed a loss mechanism that limits the lifetime of dense bunches, scattering among the particles of the bunch itself, now called the Touschek effect. AdA did not do physics of its own; it showed that the method worked.
:::

:::history{year=1971 title="The Intersecting Storage Rings" people="Kjell Johnsen and colleagues at CERN" source="Sources: CERN's accounts of the ISR; Myers (chapter on the ISR)."}
The Intersecting Storage Rings (ISR) at CERN were two rings of protons that crossed at eight points, and it was the world's first hadron collider. The first proton–proton collisions were announced on 27 January 1971, and the machine ran until 1984, with beams of about 30 GeV each and a collision energy of up to 62 GeV.:cite[cern-isr] At the time it was a machine without a precedent and with a doubtful reputation: the collision energy was equivalent to a fixed-target beam of about 2,000 GeV, much more than any accelerator could make, but the luminosity was low by comparison with a fixed target and the physics of the day was at high momentum transfer, where rates are small. Its legacy is technical. It invented the way to fill a collider with protons: bunches from the injector are added one after another to a coasting beam by RF stacking, up to currents of tens of amperes (57 A at most), and the machine reached a luminosity of 1.4 × 10³² cm⁻² s⁻¹ in 1982 with superconducting focusing magnets at one crossing point, a record that stood until 1991.:cite[myers-isr]
:::

:::history{year=1972 title="Stochastic cooling" people="Simon van der Meer" source="Sources: van der Meer (CERN/ISR-PO/72-31, 1972); van der Meer's Nobel lecture (1984)."}
A beam's emittance can only be reduced in a ring if something other than the magnets acts on it, and for protons that something was found at the ISR. Simon van der Meer, an engineer at CERN, had the idea of **stochastic cooling** in 1968 and described it in an internal report in 1972.:cite[vandermeer1972] A sensor (a pickup) on one side of the ring measures the average position of a small sample of the particles that pass it; a corrector (a kicker) on the other side, reached by a cable shorter than the path of the particles across the ring, gives that same sample a kick that reduces the average error. Each sample is a small fraction of the beam, so each kick is noisy, but over many turns, the errors that do not average to zero average out, and the beam's emittance decreases. The idea seemed so far-fetched to some of its first readers that it was tried only after several years; it was shown to work in the ISR in the mid-1970s.

The consequence was the first proton–antiproton collider. Antiprotons are made in small numbers by hitting a target with protons, and come out with a wide spread of momenta. With stochastic cooling they could be accumulated for a day in a ring (the Antiproton Accumulator), compressed into a narrow, dense beam of some 10¹¹ antiprotons, and injected into the SPS, which became the SppS collider in 1981. UA1 and UA2 found the W and Z there in 1983, and Rubbia and van der Meer shared the 1984 Nobel Prize in Physics (Chapter 23).:cite[vandermeer1984]
:::

:::history{year=1989 title="LEP" people="CERN" source="Sources: CERN, 'LEP shuts down after eleven years of forefront research'; CERN's LEP pages."}
The Large Electron–Positron collider was built in a new tunnel of 27 km, 100 m underground, and is the ring that the LHC later reused. The first beam circulated on 14 July 1989. In its first phase it ran at the Z boson's mass, a beam energy of 45.6 GeV, and measured the Z's properties with a precision that was not thought possible (Chapter 23). From 1996, superconducting cavities were added, and in LEP2 the energy was raised in steps, past the threshold at which W⁺W⁻ pairs are made, to 209 GeV in the centre of mass in 2000. LEP was shut down at 8:00 on 2 November 2000, to make way for the LHC.:cite[cern-lep]
:::

## The future: HL-LHC and beyond

Three things limit the luminosity of the LHC as built: the triplet quadrupoles, which set the smallest β* the aperture allows; the crossing angle; and the radiation damage and pile-up in the detectors. The **High-Luminosity LHC** (HL-LHC) project is a rebuilding of the collision regions to address the first two: new quadrupoles next to the collision points made of niobium–tin, a superconductor that can make higher fields than NbTi, larger apertures and so a smaller β*; crab cavities to recover the crossing-angle loss; and other equipment. The design aims at a levelled luminosity of 5 × 10³⁴ cm⁻² s⁻¹ and an integrated luminosity of 3,000 fb⁻¹, in the machine's lifetime, about ten times what the LHC had by the end of Run 3, at a pile-up of about 130 (at 80 mb).:cite[hllhc-tdr] As of this writing the long shutdown that installs the new equipment began in mid-2026, with operation of the upgraded machine planned for about 2030.:cite[hllhc-schedule] The schedule has moved before.

Beyond that, the options follow from the chapter's two limits, and none is decided. A circular electron–positron collider in a tunnel of some 90 km (the **FCC-ee**, the first stage of the Future Circular Collider study at CERN) would push the radiation limit to about 180 GeV per beam by its size, where the LEP figure of 3.5 GeV per turn becomes of the order of 10 GeV per turn, at a far larger radius (using ρ ≈ 10 km, my assumption, in the formula above). A later proton machine in the same tunnel would need magnets of about 14 to 20 T to reach a collision energy of the order of 100 TeV. The CERN Feasibility Study was published in 2025 and explicitly does not commit the member states; the decision belongs to the European Strategy process.:cite[fcc2025] Linear colliders avoid radiation by not bending the beam, and pay with the length of the machine, which grows as the energy over the accelerating gradient. A muon collider, muons being 207 times heavier than electrons, would radiate about 10⁹ times less at the same energy, at the price of a particle whose lifetime is 2.2 microseconds. All of these are proposals and studies; the course's machine has none of them.

## You write: the luminosity

The machine stage of the course's pipeline turns beam parameters into a luminosity and a pile-up, and the detector stage takes both from it (the Control Room's machine pane shows the result). The function at its centre is the one you have just derived. The library's `machineStage` calls `luminosity(params)` through the hook, so once yours passes its tests, the dashboard, the Control Room and the pile-up overlay use it.

```code
id: luminosity
title: The luminosity of a collider
hook: machine.luminosity
prompt: |
  Implement `luminosity(p)` for two equal, round Gaussian bunches, and return it in **cm⁻² s⁻¹**.

  The parameters `p` (type `LumiParams`) are: `Nb` (protons per bunch), `nb` (colliding bunch pairs), `frev` (revolution frequency in Hz),
  `eps_n` (normalised emittance, m·rad), `betaStar` (m), `gamma` (Lorentz factor), `crossingAngle` (full angle in rad) and `sigmaZ` (bunch length in m).

  1. The beam size at the collision point: σ*² = ε β*, with the geometric emittance ε = ε_n/γ.
  2. The head-on luminosity: N² n f /(4π σ*²), which comes out in m⁻² s⁻¹.
  3. The crossing angle: multiply by F = 1/√(1 + φ²), where φ = θ σ_z /(2σ*).
  4. Convert to cm⁻² s⁻¹ (1 m⁻² = 10⁻⁴ cm⁻²).
starter: |
  import type { LumiParams } from 'hep/machine';

  export function luminosity(p: LumiParams): number {
    // σ*² = ε_n β*/γ;  L = N² n f / (4π σ*²) × F;  then convert m⁻² to cm⁻²
    return 0;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { luminosity } from 'solution';
  import type { LumiParams } from 'hep/machine';

  // The LHC design report's parameters at 7 TeV.
  const DESIGN: LumiParams = {
    Nb: 1.15e11, nb: 2808, frev: 11245.5, eps_n: 3.75e-6, betaStar: 0.55, gamma: 7000 / 0.9382720813, crossingAngle: 285e-6, sigmaZ: 0.0755,
  };
  const HEAD_ON: LumiParams = { ...DESIGN, crossingAngle: 0 };

  test('the LHC design parameters give about 1.0 × 10³⁴ cm⁻² s⁻¹', () => {
    const L = luminosity(DESIGN);
    expect(L).toBeGreaterThan(0.98e34);
    expect(L).toBeLessThan(1.03e34);
  });

  test('head-on, the result is N² n f /(4π σ*²), in cm⁻² s⁻¹', () => {
    const sigma2 = (DESIGN.eps_n * DESIGN.betaStar) / DESIGN.gamma;
    const expected = (DESIGN.Nb ** 2 * DESIGN.nb * DESIGN.frev) / (4 * Math.PI * sigma2) * 1e-4;
    expect(luminosity(HEAD_ON) / expected).toBeCloseTo(1, 9);
    expect(luminosity(HEAD_ON)).toBeGreaterThan(1.19e34);
    expect(luminosity(HEAD_ON)).toBeLessThan(1.21e34);
  });

  test('the units: a beam 10 µm wide gives 8.0 × 10³⁰ cm⁻² s⁻¹ for 10¹¹ protons, one bunch, 10 kHz', () => {
    // ε_n β*/γ = 10⁻⁶ × 1 / 10⁴ = 10⁻¹⁰ m², so σ* = 10 µm
    const p: LumiParams = { Nb: 1e11, nb: 1, frev: 1e4, eps_n: 1e-6, betaStar: 1, gamma: 1e4, crossingAngle: 0, sigmaZ: 0.1 };
    expect(luminosity(p) / 7.9577e30).toBeCloseTo(1, 4);
  });

  test('the luminosity goes as N², n, f, and as 1/β* when the beams meet head-on', () => {
    const L0 = luminosity(HEAD_ON);
    expect(luminosity({ ...HEAD_ON, Nb: 2 * HEAD_ON.Nb }) / L0).toBeCloseTo(4, 9);
    expect(luminosity({ ...HEAD_ON, nb: 2 * HEAD_ON.nb }) / L0).toBeCloseTo(2, 9);
    expect(luminosity({ ...HEAD_ON, frev: 3 * HEAD_ON.frev }) / L0).toBeCloseTo(3, 9);
    expect(luminosity({ ...HEAD_ON, betaStar: HEAD_ON.betaStar / 2 }) / L0).toBeCloseTo(2, 9);
  });

  test('the energy matters through γ: a higher-energy beam is narrower, and the luminosity rises in proportion', () => {
    expect(luminosity({ ...HEAD_ON, gamma: 2 * HEAD_ON.gamma }) / luminosity(HEAD_ON)).toBeCloseTo(2, 9);
  });

  test('a crossing angle with Piwinski angle 1 costs a factor √2', () => {
    const sigma = Math.sqrt((DESIGN.eps_n * DESIGN.betaStar) / DESIGN.gamma);
    const theta = (2 * sigma) / DESIGN.sigmaZ;
    expect(luminosity({ ...DESIGN, crossingAngle: theta }) / luminosity(HEAD_ON)).toBeCloseTo(1 / Math.SQRT2, 9);
  });

  test('the crossing angle costs more as β* shrinks', () => {
    const r = (b: number) => luminosity({ ...DESIGN, betaStar: b }) / luminosity({ ...HEAD_ON, betaStar: b });
    expect(r(0.275)).toBeLessThan(r(0.55));
    expect(r(0.55)).toBeLessThan(r(1.1));
  });

  test('the sign of the crossing angle does not matter, and the input is not changed', () => {
    const p = { ...DESIGN };
    const a = luminosity(p);
    expect(luminosity({ ...DESIGN, crossingAngle: -DESIGN.crossingAngle })).toBeCloseTo(a, -20);
    expect(p).toEqual(DESIGN);
  });
solution: |
  import type { LumiParams } from 'hep/machine';

  export function luminosity(p: LumiParams): number {
    const sigmaSq = (p.eps_n * p.betaStar) / p.gamma; // σ*² in m²
    const sigma = Math.sqrt(sigmaSq);
    const headOn = (p.Nb * p.Nb * p.nb * p.frev) / (4 * Math.PI * sigmaSq); // m⁻² s⁻¹
    const piwinski = (p.crossingAngle * p.sigmaZ) / (2 * sigma);
    const F = 1 / Math.sqrt(1 + piwinski * piwinski);
    return headOn * F * 1e-4; // cm⁻² s⁻¹
  }
hints:
  - 'The beam size comes from the emittance and β*: σ*² = ε_n β*/γ. The bunch population appears squared.'
  - 'A common slip is to leave the answer in m⁻² s⁻¹: the design value would then come out as 10³⁸.'
  - 'The Piwinski angle uses σ* (not σ*²), the full crossing angle and the bunch length: φ = θ σ_z/(2σ*).'
```

:::experiments
ATLAS and CMS measure their own luminosity, since the machine's beam parameters are not known well enough. Dedicated detectors count something proportional to it, such as the number of collisions seen in the forward calorimeters or in a ring of small counters around the beam pipe, and these are calibrated against the beams themselves in **van der Meer scans**: the beams are moved across each other in small steps while the rates are recorded, and the widths of the rate curve give σ<sub>x</sub> and σ<sub>y</sub> directly (the method is due to van der Meer, who proposed it at the ISR in 1968). The resulting precision is of the order of one per cent, and it enters every cross-section measurement (Chapters 23 and 30). The course's machine stage replaces all of this by the formula you wrote: it computes the luminosity from the beam parameters, then the pile-up, then the positions of the collision vertices along the beam axis, which are Gaussian with the width of the luminous region. The real machine adds the structure of the bunch trains, the decay of the luminosity during a fill and the differences between bunches; Chapter 27's trigger emulation uses the bunch-crossing timeline to count dead time.
:::

## What comes next

The machine is now complete as far as this course takes it: particles are accelerated (Chapter 19), held in orbit (Chapter 20) and collided at a known rate, with a known pile-up (this chapter). The next chapters are about what the collisions make. Chapter 22 begins with the weak force, the one that turns a neutron into a proton, and ends at the W and Z bosons that Chapter 23 shows being made by the machines of this chapter's history, in the SppS and LEP.

## Further reading

- The LHC Design Report (:cite[lhc-design]) and Evans and Bryant's review, "LHC Machine" (:cite[evans2008]), for the parameters, the magnets and the protection systems.
- CERN's summary of the analysis of the 19 September 2008 incident (:cite[cern-incident]).
- The HL-LHC Technical Design Report, for the upgrade's parameters (:cite[hllhc-tdr]), and the FCC Feasibility Study Report, for the proposals that follow it (:cite[fcc2025]).
- Van der Meer's Nobel lecture, for stochastic cooling in his own words (:cite[vandermeer1984]).
