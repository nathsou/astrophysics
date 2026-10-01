---
number: 21
title: Colliding beams
summary: How many collisions a pair of bunches produces, and what it costs. Luminosity derived from the beam geometry, β* and the crossing angle, pile-up, integrated luminosity, synchrotron radiation and why the LHC collides protons, the energy stored in the beam, and the accident of 2008. The reader writes the luminosity formula.
duration: About 3 hours
prerequisites: [steering-and-focusing]
---

When two bunches cross in the middle of ATLAS or CMS, each contains about 1.15 × 10¹¹ protons (the design value), so there are 1.3 × 10²² pairs of protons that could collide. In the design beam, on average about 26 of those pairs do. A given pair has a chance of about two in 10²¹ of interacting, and the machine is built so that a crossing happens 31 million times a second. The chance follows from comparing two areas: the proton's inelastic cross-section, about 80 millibarns or 8 × 10⁻²⁶ cm², and the effective area of overlap of the two bunches at the crossing point, which is 3.5 × 10⁻⁵ cm² when each bunch is 17 micrometres wide.

That ratio is the subject of the chapter. Chapter 2 showed that colliding beams put all of their energy into making new particles, where a fixed target wastes most of it on the motion of the wreckage, and said the price would be paid here. The price is density: two beams crossing are far more dilute than a block of liquid hydrogen. This chapter derives the rate of collisions from the shape of the beams, finds out what sets it, and follows it through to the number of overlapping collisions in each event and the amount of data collected. Then it turns to the two costs of a circular collider: the energy that light electrons radiate away, and the energy that heavy protons store.

## Rate = cross-section × luminosity

Chapter 3 defined the rate of any process as *R* = σ*L*, the cross-section of the process times a quantity *L* that depends only on the beams, the :term[luminosity]{id=luminosity}. Its unit is a cross-section per second inverted: cm⁻² s⁻¹. The LHC's design value is 10³⁴ cm⁻² s⁻¹.:cite[lhc-design] With an inelastic cross-section of about 80 mb = 8 × 10⁻²⁶ cm², the rate of proton–proton collisions is 10³⁴ × 8 × 10⁻²⁶ ≈ 8 × 10⁸ per second.

```fermi
id: collisions-per-second
title: Collisions per second at the LHC
prompt: 'The LHC’s design luminosity is 10³⁴ cm⁻² s⁻¹ at each of its two high-luminosity collision points. The inelastic proton–proton cross-section is about 80 mb, and 1 mb = 10⁻²⁷ cm². About how many inelastic collisions happen per second at one collision point?'
answer: 8e8
unit: s⁻¹
factor: 3
hints:
  - Rate = cross-section × luminosity.
  - 80 mb = 80 × 10⁻²⁷ cm².
explain: "8 × 10⁻²⁶ cm² × 10³⁴ cm⁻² s⁻¹ = 8 × 10⁸ per second at each point: nearly a billion collisions a second. Chapter 0 found that about one collision in 1.6 × 10⁹ makes a Higgs boson, so the Higgs rate is about half a boson per second at each point, and most of them are not recorded. Finding the rare ones among the billion is what the trigger of Chapter 27 is for."
```

A fixed-target experiment has a much higher luminosity. A beam of *N* protons spilled over a time *T* onto a target of length ℓ and density *n* gives *L* = (*N*/*T*) *n* ℓ. Take the 3.2 × 10¹⁴ protons of one LHC beam spilled over one second (the SPS does extract beams over seconds for its fixed-target experiments), onto a metre of liquid hydrogen (0.071 g/cm³, which is 4.2 × 10²² protons per cm³). Then *L* = 3.2 × 10¹⁴ × 4.2 × 10²⁴ = 1.4 × 10³⁹ cm⁻² s⁻¹, a hundred thousand times the collider's. The catch is the energy. A 7 TeV beam on a stationary proton has √*s* = √(2 × 7,000 × 0.938) = 115 GeV, where the collider has 14,000. The top quark and the Higgs boson are out of reach for the fixed target. A collider accepts a luminosity a hundred thousand times lower in exchange for an energy more than a hundred times higher, and the rest of this chapter is about how it is made as high as it is.

### The first colliders

Until the 1960s a collider was an idea whose rate looked hopeless. Bruno Touschek proposed in 1960 a small ring in which electrons and positrons (the antiparticle of the electron, Chapter 9) would circulate in opposite directions in the same magnets, which is possible because their charges are opposite.

:::history{year=1961 title="AdA, the first electron–positron ring" people="Bruno Touschek and colleagues, Frascati" source="Source: INFN Frascati's account of Touschek and AdA."}
The ring was named AdA (*Anello di Accumulazione*, an accumulation ring) and was built at the Frascati laboratory near Rome. It stored its first beams on 27 February 1961.:cite[ada-history] The intensities at Frascati were too low for useful collisions, and in July 1962 AdA was moved to the Laboratoire de l'Accélérateur Linéaire at Orsay, near Paris, where a linear accelerator could fill it faster. There, in 1963–64, electron–positron collisions were observed. The ring also showed a loss mechanism that limits the lifetime of dense bunches: scattering among the particles of one bunch, now called the Touschek effect. AdA did not do physics of its own. It showed that the method works.
:::

For protons the lesson was the same, with larger numbers. The Intersecting Storage Rings (ISR) at CERN were two rings in which proton beams crossed.

:::history{year=1971 title="The Intersecting Storage Rings" people="Kjell Johnsen and colleagues at CERN" source="Sources: CERN's accounts of the ISR; Myers (chapter on the ISR)."}
The ISR was the world's first hadron collider. Its first proton–proton collisions were announced on 27 January 1971, and it ran until 1984 with beams of about 30 GeV each and a collision energy of up to 62 GeV.:cite[cern-isr] A fixed-target beam would need about 2,000 GeV to match 62 GeV in the centre of mass, far above any accelerator of the time.

Its lasting contribution was a way to fill a collider. Bunches from the injector were added one after another to a coasting beam by RF stacking, up to currents of tens of amperes (57 A at most), and in 1982, with superconducting focusing magnets at one crossing point, the machine reached a luminosity of 1.4 × 10³² cm⁻² s⁻¹, a record that stood until 1991.:cite[myers-isr]
:::

### The formula, from the geometry

Two bunches of *N* protons each pass through each other. If the transverse densities of the bunches, normalised to 1, are ρ₁(*x*, *y*) and ρ₂(*x*, *y*), the number of collisions in one crossing is σ *N*² ∫ρ₁ρ₂ d*x* d*y*: each of the *N* protons of one bunch meets, on average, a target of *N*ρ₂ per unit area. For two identical Gaussian bunches of widths σ<sub>x</sub> and σ<sub>y</sub> the overlap integral is 1/(4π σ<sub>x</sub>σ<sub>y</sub>). With *n* bunch pairs crossing per turn and *f* turns per second, the rate is σ *N*² *n* *f*/(4π σ<sub>x</sub>σ<sub>y</sub>), and the luminosity is what multiplies σ:

:::equation{#luminosity caption="The luminosity of two equal bunches crossing head-on. It depends on the beams alone."}
$$\term{L}{L} = \frac{\term{N}{N}^2\,\term{n}{n}\,\term{f}{f}}{4\pi\,\term{sx}{\sigma_x}\,\term{sy}{\sigma_y}}$$

```terms
L:
  label: 'L, the luminosity'
  what: The number of collisions per second per unit cross-section, in cm⁻² s⁻¹ (or m⁻² s⁻¹).
  why: The rate of any process is its cross-section times this number, so it is the machine's half of every rate.
  effect: 10³⁴ cm⁻² s⁻¹ in the design, about 2 × 10³⁴ at the peak of recent runs, and 5 × 10³⁴ planned for the high-luminosity upgrade.
N:
  label: 'N, the bunch population'
  what: The number of protons in each bunch (assumed equal in the two beams).
  why: It appears squared, so doubling the protons in both beams gives four times the collisions.
  effect: 1.15 × 10¹¹ in the design. One limit on it is the electromagnetic force each beam exerts on the other.
n:
  label: 'n, the number of colliding bunch pairs'
  what: The number of bunches in each beam that meet bunches of the other beam at this collision point.
  why: Each crossing contributes, so n multiplies the rate.
  effect: 2,808 in the design, out of 3,564 possible slots of 25 ns.
f:
  label: 'f, the revolution frequency'
  what: The number of turns per second, c/C, which is 11,245.5 Hz for the LHC.
  why: Each bunch crosses its partner once per turn.
  effect: Fixed by the circumference. The crossing rate n·f is 31.6 million per second.
sx:
  label: 'σx, the horizontal beam size'
  what: The rms width of the bunch in x at the collision point, in metres.
  why: The overlap integral is inversely proportional to it, so the smaller the beams, the denser the target.
  effect: 16.6 µm in the design, equal to σy since the beams are round at the collision point.
sy:
  label: 'σy, the vertical beam size'
  what: The rms height of the bunch in y at the collision point, in metres.
  why: It enters in the same way as σx.
  effect: Electron colliders such as LEP used flat beams, much narrower vertically than horizontally.
```
:::

:::deeper[The overlap integral]
For one transverse coordinate a Gaussian bunch has ρ(*x*) = exp(−*x*²/2σ²)/(σ√(2π)). Two identical ones overlap as ∫ρ² d*x* = (1/(2πσ²)) ∫ exp(−*x*²/σ²) d*x* = (1/(2πσ²)) σ√π = 1/(2σ√π). The two coordinates are independent, so the product is 1/(4π σ<sub>x</sub>σ<sub>y</sub>). For bunches of different widths σ² is replaced by (σ₁² + σ₂²)/2 in each coordinate; the course, like the machine's design, uses equal bunches. The formula counts the collisions of one crossing in which the bunches pass through each other without changing shape, which is an idealisation. The real corrections (the next few paragraphs) are tens of per cent, not factors of ten.
:::

The beam size at the collision point is the one from Chapter 20: σ*² = ε β*, where ε = ε<sub>n</sub>/γ is the geometric emittance (the normalised emittance divided by the Lorentz factor) and β* is the value of the β function at the collision point. The luminosity is then

$$L = \frac{N^2\, n\, f\,\gamma}{4\pi\,\varepsilon_n\,\beta^*}\cdot F,$$

where *F* ≤ 1 accounts for the crossing angle, below. Each factor is a knob, and each has a cost.

- ***N*** is limited by the forces each beam exerts on the other and by instabilities, which grow with the current. The injectors must also deliver it.
- ***n*** is limited by the 25 ns spacing, by the gaps needed for the injection kickers and the beam dump, and by the stored energy (below).
- **ε<sub>n</sub>** is set by the quality of the injector chain. A proton beam's emittance cannot be reduced in a ring at high energy, and the technique that reduces it at low energy was found at CERN, in the next card.
- **β\*** is set by the strength of the quadrupoles next to the collision point, the inner triplet, and by the aperture they provide. Near the point the β function grows as β(*s*) = β* + *s*²/β*, so a small β* means a beam that is very wide in the triplet, and the smaller β* is, the larger the aperture must be. The LHC's design β* is 0.55 m.

:::history{year=1972 title="Stochastic cooling" people="Simon van der Meer" source="Sources: van der Meer (CERN/ISR-PO/72-31, 1972); van der Meer's Nobel lecture (1984)."}
A beam's emittance cannot be reduced by magnets alone (Liouville's theorem), so something else has to act on the particles. Simon van der Meer, an engineer at CERN, conceived :term[stochastic cooling]{id=stochastic-cooling} in 1968 during work at the ISR, and described it in a report of August 1972.:cite[vandermeer1972] A sensor (a pickup) on one side of the ring measures the average position of a small sample of the particles that pass it. A corrector (a kicker) on the other side, reached by a signal that crosses the ring by a shorter path than the particles take, gives that same sample a kick that reduces the average error. Each sample is a small part of the beam, so each kick is noisy, but the average error is reduced on every pass, and over many turns the emittance falls. Even van der Meer and his colleagues at first thought the idea far-fetched, since the ISR's beams were dense enough without it, and the first experimental demonstration in the ISR came in the mid-1970s.

The consequence was the first proton–antiproton collider. Antiprotons are made in small numbers by hitting a target with protons, and they come out with a wide spread of momenta. With stochastic cooling they could be accumulated for a day in a ring (the Antiproton Accumulator), squeezed into a dense beam of about 10¹¹ antiprotons, and injected into the SPS, which began running as the SppS collider in 1981. Two experiments there, UA1 and UA2, found the W and Z bosons in 1983, and Carlo Rubbia and van der Meer shared the 1984 Nobel Prize in Physics (Chapter 23).:cite[vandermeer1984]
:::

With the design values (*N* = 1.15 × 10¹¹, *n* = 2,808, *f* = 11,245.5 Hz, ε<sub>n</sub> = 3.75 µm, β* = 0.55 m, γ = 7,460), σ* = 16.6 µm and the head-on luminosity is 1.20 × 10³⁴ cm⁻² s⁻¹. The design value of 10³⁴ is lower because of the crossing angle.

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
explain: "σ*² = 2.765 × 10⁻¹⁰ m² (σ* = 16.6 µm). N² n f = 1.3225 × 10²² × 2,808 × 11,245.5 = 4.18 × 10²⁹ s⁻¹. Divided by 4π σ*² = 3.47 × 10⁻⁹ m², this is 1.20 × 10³⁸ m⁻² s⁻¹ = 1.20 × 10³⁴ cm⁻² s⁻¹."
```

### The crossing angle

Bunches are 25 ns apart, which is 7.5 m. For tens of metres on either side of the collision point the two beams share one vacuum pipe, and if they met head-on, the bunches would meet not only at the collision point but every 3.75 m along the shared pipe. These parasitic collisions are unwanted. The beams therefore cross at a small angle, which the design fixes at 285 µrad in total.:cite[lhc-design] The price is that the bunches overlap less. Each is 7.5 cm long (rms) and 17 µm wide, and at an angle of 285 µrad the half-angle of 142 µrad moves the axis of each bunch sideways by 11 µm over half a bunch length, two-thirds of its width. The **Piwinski angle** φ = θσ<sub>z</sub>/(2σ*), with θ the full crossing angle and σ<sub>z</sub> the bunch length, measures this, and the loss is

$$F = \frac{1}{\sqrt{1 + \varphi^2}}.$$

At the design values φ = 0.65 and *F* = 0.84, so *L* = 0.84 × 1.20 × 10³⁴ = 1.01 × 10³⁴ cm⁻² s⁻¹. The same angle costs more as β* shrinks, since σ* falls and φ rises. **Crab cavities**, RF cavities that tilt each bunch so that the two meet face to face, recover the loss, and they are part of the high-luminosity upgrade at the end of the chapter.

```predict
q: 'The LHC’s focusing is upgraded so that β* falls from 0.55 m to 0.275 m, with everything else (including the 285 µrad crossing angle) unchanged. By what factor does the luminosity rise?'
options:
  - text: Not at all, since β* does not appear in the crossing angle.
    why: 'β* sets the beam size σ* = √(εβ*), and the beam size is in the denominator of the luminosity.'
  - text: Exactly 2, since L is proportional to 1/β*.
    why: 'That is true of the head-on luminosity. But a smaller beam is also more sensitive to the crossing angle, so the geometric factor F falls as well.'
  - text: 'By a little less than 2: about 1.76.'
    correct: true
    why: 'The head-on luminosity doubles, but the Piwinski angle φ = θσz/2σ* rises from 0.65 to 0.92, so F falls from 0.84 to 0.74, and the net gain is 2 × 0.74/0.84 = 1.76. This is why a lower β* goes together with crab cavities in the upgrade.'
```

::bunch-overlap{n="21.1" caption="Two bunches crossing at the LHC's design parameters, seen from above. The scales along and across the beam differ by a factor of about a thousand, so the bunches are drawn in their true proportions along each axis but not to a common scale. Raise the crossing angle and the shaded overlap loses its ends. Shrink β* and the width falls while the angle matters more. Switch on the crab cavities and the bunches meet face on. The hourglass option draws the beam size away from the focus, σ(s) = σ*√(1 + (s/β*)²)."}

One further correction is the **hourglass effect**. The beam is narrowest at the collision point and wider on either side, so the ends of a long bunch collide in a region where the beam is wider. The reduction is about 1% at the design β* and σ<sub>z</sub> = 7.55 cm, and about 10% at β* = 0.15 m, which is why the bunch length is one of the quantities a low-β* design must watch.

## Pile-up

The 1.3 × 10²² pairs of one crossing produce on average μ = σ<sub>inel</sub> *L*/(*n* *f*) collisions: the rate of collisions divided by the rate of crossings. At the design luminosity and 80 mb, μ = 25.6. The number in a given crossing is a Poisson random variable with that mean (Chapter 3), so crossings with 10 or with 40 collisions are common.

These overlapping collisions are :term[pile-up]{id=pile-up}. The detector cannot choose between them: it records the crossing, and every collision in it. One is the hard collision that made the trigger fire (Chapter 27). The others are mostly glancing and leave a few tens of low-energy particles each, which overlap the tracks and calorimeter deposits of the interesting one. Their vertices are spread along the beam axis over the width of the luminous region, σ<sub>z</sub>/√(2(1 + φ²)), which is 4.5 cm at the design values, and the tracker's resolution in *z* is fine enough to tell them apart (Chapter 8). Pile-up rose beyond the design value as the luminosity did. The peak in Run 2 (2015–2018) was about 60,:cite[boyd2020] and the high-luminosity upgrade plans for more than a hundred.:cite[hllhc-tdr]

```numeric
id: pileup-run3
title: Pile-up at twice the design luminosity
prompt: 'A recent LHC fill has a peak luminosity of 2 × 10³⁴ cm⁻² s⁻¹ with 2,400 colliding bunches (f = 11,245.5 Hz). Take σ_inel = 80 mb. What is the mean number of collisions per crossing?'
answer: 59
unit: collisions
tolerance: 0.03
hints:
  - μ = σ L/(n f), with σ = 80 × 10⁻²⁷ cm².
explain: "μ = 80 × 10⁻²⁷ × 2 × 10³⁴ / (2,400 × 11,245.5) = 1.6 × 10⁸ / 2.70 × 10⁷ = 59. Doubling the luminosity with fewer bunches more than doubles the pile-up: what matters to the detectors is the luminosity per crossing."
```

::collider-dashboard{mode="lhc" n="21.2" caption="The collider dashboard. Start from the design parameters, or from the Run 3-like or high-luminosity presets, and change the bunch population, number of bunches, emittance, β* and crossing angle. The luminosity and pile-up come from the formulas of this chapter (with your own luminosity function once it passes its tests, below). The picture is one bunch crossing, seeded: the dots are the collision vertices along the beam axis, the filled one being the hard collision and the open ones pile-up. The lower panels show the energy in the beam and what synchrotron radiation costs, the subjects of the next sections. The presets are illustrative, not the machine's official tables."}

Try to hold the design luminosity with fewer bunches and watch the pile-up rise; then try the high-luminosity-like preset, which is not levelled and reaches a pile-up of more than 200. For a given luminosity, *more bunches with fewer collisions each* is better for the experiments, and the number of bunches is limited by the 25 ns spacing and the stored energy. The alternative that the upgrade plans is **levelling**: holding the luminosity constant during a fill by adjusting β* or the overlap of the beams, so that pile-up stays within what the detectors can handle.

:::programmer
Luminosity is a **throughput**: the machine's side of a rate, independent of which process you look for. A detector's trigger sees a stream with a fixed arrival rate (the crossing rate, 40 MHz at most) and a variable batch size per item (the pile-up, Poisson distributed). It is the problem of sizing a queue. The arrival rate *n f* is fixed by the clock, so the only way to raise the throughput is to make each batch bigger, and what limits that is the processing time per batch, here the number of overlapping collisions the detector can untangle. Chapter 27 returns to it from the other side, when the trigger must reduce 31 million crossings a second to about a thousand events a second.
:::

## Integrated luminosity and the fill

The luminosity is a rate. The number of events of a process in a dataset is *N* = σ ∫*L* d*t*, the cross-section times the :term[integrated luminosity]{id=integrated-luminosity}. It is measured in inverse femtobarns, 1 fb⁻¹ = 10³⁹ cm⁻². A process with a cross-section of 50 pb = 5 × 10⁴ fb, in a dataset of 100 fb⁻¹, is expected to occur 5 million times, which is of the order of the number of Higgs bosons made in the LHC's second run. How many can be *seen* is the subject of Chapters 27 to 29.

The luminosity is not constant during a fill. Every collision removes protons from the beams (burn-off), and other processes remove them too, with a lifetime that the model below takes as 20 hours. The beam intensity *y* = *N*/*N*₀ obeys d*y*/d*t* = −*y*/τ<sub>o</sub> − *y*²/τ<sub>b</sub>, where τ<sub>b</sub> = *N*₀/(*k*σ*L*₀) is the burn-off time for *k* collision points, and the luminosity goes as *L* = *L*₀ *y*². At the design luminosity the initial burn-off time of the intensity is 56 hours, so that of the luminosity is 28 hours; at 2 × 10³⁴ they are 28 and 14 hours. The luminosity falls during a fill, and at some point it is better to dump the beams, refill and start again than to wait. A cycle of *T* hours of collisions and a turnaround of a few hours has the highest average luminosity at a particular *T*.

::fill{n="21.3" caption="One fill of the LHC in a simple model: luminosity decays as protons are burnt off and lost by other processes. The lower plot is the average luminosity over a whole cycle (fill plus turnaround) as a function of the fill length, which has a maximum. With a peak of 2 × 10³⁴, a 20 h lifetime from other losses and a 3 h turnaround, the best fill is about 5.4 hours long and gives an average of 0.86 × 10³⁴, or 0.74 fb⁻¹ per day. These are the model's numbers, not the machine's records."}

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

The equation d*y*/d*t* = −*y*/τ<sub>o</sub> − *y*²/τ<sub>b</sub> is Bernoulli's. The substitution *u* = 1/*y* turns it into the linear d*u*/d*t* = *u*/τ<sub>o</sub> + 1/τ<sub>b</sub>, whose solution with *u*(0) = 1 is *u* = (1 + τ<sub>o</sub>/τ<sub>b</sub>) e<sup>*t*/τ<sub>o</sub></sup> − τ<sub>o</sub>/τ<sub>b</sub>, the denominator in the code. Passing `Infinity` for a lifetime switches that mechanism off. With burn-off alone, *y* = 1/(1 + *t*/τ<sub>b</sub>) decays as a power law rather than an exponential. The integrated luminosity is the integral of this function (Simpson's rule, in `integratedLuminosity`), and the best fill length is found by a scan over *T* of that integral divided by *T* plus the turnaround. A closed form is worth having when the function is evaluated for every movement of a slider.
:::

## Synchrotron radiation

A charged particle on a circle is accelerating, and accelerating charges radiate. In a synchrotron the light is called :term[synchrotron radiation]{id=synchrotron-radiation}. It was first seen in a 70 MeV electron synchrotron at General Electric in 1947, as visible light through a glass vacuum tube.:cite[elder1947] It is both the limit of electron rings and the basis of the synchrotron light sources used across science. The energy a particle of charge *e* radiates in one turn of a circle of radius ρ rises with the fourth power of γ:

:::equation{#radiation caption="The energy radiated by a particle in one turn of a circular ring."}
$$\term{U}{U_0} = \frac{\term{e}{e}^2}{3\,\term{eps0}{\varepsilon_0}}\,\frac{\term{beta}{\beta}^3\,\term{gam}{\gamma}^4}{\term{rho}{\rho}} \;\approx\; 88.46\ \mathrm{keV}\;\frac{E^4\,[\mathrm{GeV}^4]}{\rho\,[\mathrm{m}]}\quad\text{(electrons)}$$

```terms
U:
  label: 'U₀, the energy lost per turn'
  what: The energy the particle radiates in one revolution, which the RF system must replace.
  why: If it is more than the RF can give, the beam cannot be kept at that energy.
  effect: For an electron at 104.5 GeV in LEP, about 3.4 to 3.5 GeV per turn. For a proton at 6.8 TeV in the LHC, 5.9 keV.
e:
  label: 'e, the elementary charge'
  what: 1.602 × 10⁻¹⁹ C, the charge of the particle.
  why: Radiated energy goes as the square of the charge.
  effect: An ion with charge Ze radiates Z² times as much as a proton of the same mass and energy.
eps0:
  label: 'ε₀, the vacuum permittivity'
  what: 8.854 × 10⁻¹² F/m, which sets the strength of the electric force in SI units.
  why: It converts the charge squared into an energy times a length.
  effect: Together with e it gives e²/(3ε₀) = 9.7 × 10⁻²⁸ J·m.
beta:
  label: 'β, the speed'
  what: The speed as a fraction of the speed of light; for the particles here, practically 1.
  why: It enters as the third power, because the loss per turn is the radiated power times the time of a turn.
  effect: Indistinguishable from 1 at these energies.
gam:
  label: 'γ, the Lorentz factor'
  what: E/mc², the energy divided by the rest energy.
  why: Radiation rises as γ⁴, so at a given energy it falls as 1/m⁴.
  effect: 'γ = 204,000 for a 104.5 GeV electron and 7,250 for a 6.8 TeV proton: the electron''s γ is 28 times larger at an energy 65 times smaller.'
rho:
  label: 'ρ, the bending radius'
  what: The radius of the circle on which the particle is bent, in metres.
  why: A tighter bend means more acceleration and more radiation, and a larger ring radiates less at the same energy.
  effect: About 3,000 m for LEP and 2,804 m for the LHC, which share a tunnel.
```
:::

The loss per turn is the radiated power, from Larmor's formula made relativistic, multiplied by the time of one turn. The number 88.46 keV is what the constants come to for an electron, with *E* in GeV and ρ in metres. The decisive fact is the mass dependence. At the same energy and radius a proton radiates (*m*<sub>e</sub>/*m*<sub>p</sub>)⁴ = 8.8 × 10⁻¹⁴ of what an electron does, so an electron radiates 1.1 × 10¹³ times more.

```predict
q: 'An electron and a proton, each of energy 100 GeV, go round the same ring. Roughly how does the energy each radiates per turn compare?'
options:
  - text: They radiate the same, since the energy and the radius are the same.
    why: 'The radiated energy depends on γ⁴, not on E⁴ alone, and at a given energy γ is inversely proportional to the mass.'
  - text: The electron radiates about 2,000 times more, in proportion to the mass ratio.
    why: 'That would be the answer if the loss went as 1/m. It goes as 1/m⁴, since it rises with γ⁴ and γ = E/mc².'
  - text: The electron radiates about 10¹³ times more.
    correct: true
    why: '(1,836)⁴ = 1.1 × 10¹³. An electron of 100 GeV would lose about 3 GeV per turn in a ring of LEP’s size. A proton of the same energy would lose about a quarter of a millielectronvolt.'
```

### LEP and the LHC

**LEP**, the Large Electron–Positron collider, was built in the 27 km tunnel that the LHC now occupies. Its first beam circulated on 14 July 1989, and it was shut down on 2 November 2000.:cite[cern-lep] Its highest beam energy, 104.5 GeV, was reached in 2000 (209 GeV in the centre of mass). At that energy each electron radiated about 3.4 to 3.5 GeV per turn, 3.3% of its energy. The figure depends on the bending radius, which this course's library takes as 3,026 m, while other sources give about 3,100 m; the two give 3.49 and 3.41 GeV. The RF system had to put all of that back on every turn. Its total voltage was about 3.6 GV,:cite[lep-wpair] so at 104.5 GeV the loss was 94 to 96% of the voltage available. The electrons rode nearly at the crest of the RF wave: the synchronous phase of Chapter 19, with sin φ<sub>s</sub> = *U*₀/*V*, was about 70° or more, and the bucket was a small fraction of the size it has with no acceleration.

:::history{year=1989 title="LEP" people="CERN" source="Sources: CERN, 'LEP shuts down after eleven years of forefront research'; CERN's LEP pages."}
The Large Electron–Positron collider was built in a new tunnel of 27 km, on average about 100 m underground, the tunnel that the LHC later reused. The first beam circulated on 14 July 1989. In its first phase it ran at the Z boson's mass, a beam energy of about 45.6 GeV, and measured the Z's properties precisely (Chapter 23). From 1996 superconducting cavities were added, and in the second phase, LEP2, the energy was raised in steps past the threshold for making W⁺W⁻ pairs to 209 GeV in the centre of mass in 2000. LEP was shut down at 8:00 on 2 November 2000, to make way for the LHC.:cite[cern-lep]
:::

::radiation-wall{n="21.4" caption="The energy radiated per turn against beam energy, on logarithmic axes, for an electron (solid) and a proton (dashed) in the same ring. The dashed horizontal line is the RF voltage per turn. LEP's electrons (the LEP button) meet the RF line at about 105.6 GeV, the ceiling in this model, which is close to where LEP stopped. The LHC button puts the ring at the LHC's radius with its 16 MV of RF: the proton curve is thirteen orders of magnitude lower and nowhere near. Drag the radius to the right to see what a larger ring gives an electron machine."}

This is why LEP stopped near 209 GeV. The loss goes as *E*⁴/ρ, so the RF voltage needed at a given radius goes as the fourth power of the energy. To double LEP's beam energy in the same ring one would need 16 times the RF voltage, about 58 GV instead of 3.6. To reach 150 GeV per beam with the same voltage, the bending radius would have to be 12.3 km instead of 3.0 km. The scaling cannot be avoided: the options are a larger ring or a collider in which the electrons do not go round a circle.

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
explain: "150⁴ = 5.06 × 10⁸, so 88.46 × 5.06 × 10⁸ = 4.48 × 10¹⁰ keV·m, and dividing by 3.63 × 10⁶ keV gives ρ = 12,340 m. That is four times LEP's radius for 44% more energy, with no margin left for the bucket, so a real machine needs more. This is why circular electron–positron colliders now under study are in tunnels of the order of ninety kilometres."
```

The LHC's protons are in the same tunnel at 6.8 TeV and radiate 5.9 keV per turn (6.7 keV at 7 TeV). The photons have a critical energy of 40 to 44 eV, in the ultraviolet. The whole design beam, a current of 0.58 A, radiates about 3.9 kW, which is not nothing for a machine at 1.9 K, and the LHC intercepts the light with a beam screen held at a higher temperature than the magnets, as the design report describes.:cite[lhc-design] But against the 362 MJ in the beam the radiation is negligible, and it is not what limits the proton. An *electron* at 6.8 TeV in the LHC ring would lose 6.7 × 10⁷ GeV in a turn, ten thousand times its own energy, so it could not be accelerated at all.

### Why the LHC collides protons

Protons remove the radiation limit and leave two others, the size of the ring and the field of its magnets. By *p* = 0.3 *B*ρ, the 8 T of the LHC's dipoles at ρ = 2.8 km gives 7 TeV. The price is that a proton is not elementary. A proton–proton collision is a collision of two quarks or gluons, each carrying a fraction of its proton's momentum (Chapter 13), and the energy of the collision is not fixed but spread over a wide range, well below the beams' 13.6 TeV. The beam energy is a stock that the collisions draw on. A proton collider therefore explores a wide range of energies at once, and is a machine for *searching*: a new particle in that range can be made whatever its exact mass. An electron–positron collider makes collisions of the full beam energy in a clean environment and is a machine for *measuring*: LEP measured the Z boson's mass and width to a precision the LHC has not matched (Chapter 23). The two kinds complement each other.

## Energy in the beam

At 7 TeV, with 2,808 bunches of 1.15 × 10¹¹ protons, one beam stores 362 MJ (the design value).:cite[lhc-design] The Run 3-like parameters of the dashboard (illustrative) give 418 MJ at 6.8 TeV. As equivalences, 362 MJ is the energy of 87 kg of TNT, or of a 400-tonne train at 153 km/h, or enough to heat 590 kg of copper from 20 °C to its melting point and melt it (using approximate handbook values for copper). These are not statements about danger. The point is that the energy is delivered in microseconds by a beam half a millimetre wide to a few cubic centimetres of whatever it hits.

The machine is protected by several systems built on one principle: the default action is to :term[dump the beam]{id=beam-dump}. A set of fast kicker magnets, which can rise within the **abort gap**, a stretch of about 3 µs left empty on purpose in the bunch pattern, push the whole beam out of the ring into a transfer line leading to an absorber of graphite, where the beam is spread over a large area before it arrives.:cite[lhc-design] Collimators, blocks of hard material placed a few millimetres from the beam, intercept protons that stray from the core before they reach a magnet. The superconducting magnets need protection too, because a small local loss of protons can warm the superconductor enough to make it lose its superconductivity and start to heat itself: a :term[quench]{id=quench}.

:::programmer
Machine protection is **fail-safe design**. The beam may circulate only while a permit signal is asserted by every system that could have an objection: power converters, cryogenics, collimators, loss monitors, the experiments. The permit must be refreshed continuously, and its absence, for whatever reason, including a cut cable or a crashed controller, is read as a request to dump. It is the same idea as the watchdog timer or dead-man switch of any embedded system, and the lesson is the same: build the safety system so that silence means no. The price is false alarms, and the designers accept them.
:::

## The accident of 19 September 2008

The LHC's first beams circulated on 10 September 2008. On 19 September, during powering tests of the main dipole circuit in one of the eight sectors (sector 3–4), a fault occurred in an electrical connection between two magnets. CERN's analysis, published on 16 October 2008, gave the cause as a faulty electrical connection between two of the accelerator's magnets. An electrical arc punctured the enclosure holding the liquid helium, helium was released, and there was mechanical damage to magnets and contamination of the vacuum system. CERN estimated that at most 24 dipole and 5 quadrupole magnets would need to be repaired.:cite[cern-incident]

:::history{year=2008 title="The accident, and the first 7 TeV collisions" people="CERN" source="Sources: CERN's analysis of the incident (16 October 2008); CERN Courier, 'The LHC is back' (2009); CERN, 'LHC research programme gets underway' (30 March 2010)."}
The fault was in the electrical connections of the magnets. The beam played no part. The repairs, which included cleaning the vacuum system and replacing magnets, took about a year, and beams circulated in the LHC again on 20 November 2009.:cite[cern-restart]

The first collisions at 7 TeV in the centre of mass (3.5 TeV per beam, half the design energy) were recorded on 30 March 2010 at 13:06 Central European Summer Time, which CERN announced as the start of the LHC research programme.:cite[cern-2010] The machine ran at that energy in 2010 and 2011, and at 6.5 TeV per beam from 2015, after a long shutdown in which the magnet interconnections were consolidated. The present runs are at 6.8 TeV per beam.:cite[boyd2020]
:::

## The future: HL-LHC and beyond

The **High-Luminosity LHC** (HL-LHC) is a rebuilding of the collision regions: new quadrupoles next to the collision points, made of niobium–tin (a superconductor that reaches higher fields than niobium–titanium) with a larger aperture, which allows a smaller β*; crab cavities to recover the crossing-angle loss; and other equipment. It aims at a levelled luminosity of 5 × 10³⁴ cm⁻² s⁻¹ and an integrated luminosity of order 3,000 fb⁻¹, at a pile-up of about 130 (at 80 mb).:cite[hllhc-tdr] As of this writing the long shutdown that installs the new equipment began in mid-2026, and operation of the upgraded machine is planned for about 2030.:cite[hllhc-schedule] The schedule has moved before.

Beyond that the options follow from this chapter's two limits, and none is decided. A circular electron–positron collider in a tunnel of about 90 km, the **FCC-ee** (the first stage of the Future Circular Collider study at CERN), would push the radiation limit to about 180 GeV per beam by its size. With a bending radius near 10 km, my assumption for the estimate, the loss at 182.5 GeV is about 10 GeV per turn, against LEP's 3.5. A later proton collider in the same tunnel, with dipoles of about 14 T, would reach 42 TeV per beam at ρ = 10 km, a collision energy approaching 100 TeV. The CERN Feasibility Study Report was published in 2025 and states that it implies no commitment by the member states; the decision belongs to the European Strategy process.:cite[fcc2025] Linear colliders avoid radiation by not bending the beam, and pay with a length that grows as the energy divided by the accelerating gradient. A muon collider, with particles 207 times heavier than electrons, would radiate about 10⁹ times less at the same energy, at the price of a particle that lives 2.2 microseconds. All of these are studies and proposals. The course's machine has none of them.

## You write: the luminosity

The machine stage of the course's pipeline turns beam parameters into a luminosity and a pile-up, and the later stages take both from it. The function at its centre is the one derived above. The library's `machineStage` calls `luminosity(params)` through the hook, so once yours passes its tests, the dashboard and the Control Room use it.

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
    expect(luminosity({ ...DESIGN, crossingAngle: -DESIGN.crossingAngle }) / a).toBeCloseTo(1, 12);
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
ATLAS and CMS measure their own luminosity, since the machine's beam parameters are not known well enough. Dedicated detectors count something proportional to it, such as the collisions seen in the forward calorimeters or in rings of small counters round the beam pipe, and these are calibrated against the beams themselves in **van der Meer scans**: the beams are moved across each other in small steps while the rates are recorded, and the widths of the resulting curve give the effective beam overlap directly. The method is due to van der Meer, in the late 1960s at the ISR. The precision reached is of the order of one per cent, and it enters every cross-section measurement (Chapters 23 and 30). The course's machine stage replaces all of this by the formula you wrote. It computes the luminosity from the beam parameters, then the pile-up, then the positions of the collision vertices along the beam axis, which are Gaussian with the width of the luminous region. The real machine adds the structure of the bunch trains, the decay of the luminosity during a fill and the differences between bunches.
:::

## What comes next

The machine is complete as far as this course takes it: particles are accelerated (Chapter 19), held in orbit (Chapter 20) and collided at a known rate with a known pile-up (this chapter). The next chapters are about what the collisions make. Chapter 22 is about the weak force, and Chapter 23 shows the W and Z bosons being found at the SppS and measured at LEP, two of the machines of this chapter's history.

## Further reading

- The LHC Design Report (:cite[lhc-design]) and Evans and Bryant's review, "LHC Machine" (:cite[evans2008]), for the parameters, the magnets and the protection systems.
- CERN's summary of the analysis of the 19 September 2008 incident (:cite[cern-incident]).
- The HL-LHC Technical Design Report, for the upgrade's parameters (:cite[hllhc-tdr]), and the FCC Feasibility Study Report, for the proposals that follow it (:cite[fcc2025]).
- Van der Meer's Nobel lecture, for stochastic cooling in his own words (:cite[vandermeer1984]).
