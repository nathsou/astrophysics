---
number: 7
title: Building a detector
summary: The layers of a collider detector, in order, and why. A tracker in a magnetic field, an electromagnetic and a hadron calorimeter, and a muon system. What each particle looks like, how precisely each layer measures, why a detector must leave no gaps, and how to trade field, size and depth against cost in a design of your own.
duration: About 2½ hours
prerequisites: [particles-through-matter]
---

Chapter 0 described ATLAS and CMS, the two general-purpose detectors at the LHC, from outside: thousands of tonnes, sized like a building. This chapter is about how they are put together inside, and the answer is more orderly than the size suggests. A collider detector is an **onion**. A particle produced at the centre crosses a series of concentric layers, each designed to take a different measurement, and which layers it leaves a trace in is how it is identified. Chapter 5 gave the first layer, a tracker in a magnetic field. Chapter 6 gave the physics of the next ones: electrons and photons stop in a few tens of radiation lengths, hadrons in a few interaction lengths, muons not at all. Here they are assembled.

The figures in this chapter use the course's own detector, *Onion*, a fast simulation described in the library notes of `hep/detector`. It is a simplified detector built for this course (a barrel of concentric cylinders, no endcap disks, a uniform field), and its numbers are its own, not those of CMS or ATLAS. Where the chapter compares the two real designs it says so, and uses the library's `cms-like` and `atlas-like` presets, which are approximate, design-level descriptions.

## The layers, from the inside out

**The beam pipe and the tracker.** At the centre is the vacuum pipe in which the beams travel, made as thin as possible. Around it is the **tracker**: several layers of position-sensitive sensors, closest to the beam where the particle density is highest, in a magnetic field that bends the tracks (Chapter 5). The tracker must be the innermost detector and as light as possible, because anything a particle crosses before it is measured scatters it (Chapter 6) and degrades the measurement. It measures the charge and momentum of every charged particle, the point from which each one came, and, from the intersection of tracks, the vertices of the collision and of decays.

**The electromagnetic calorimeter (ECAL).** Outside the tracker is a dense, thick layer that makes electrons and photons shower, and absorbs all of their energy: some 25 radiation lengths, which is 22 cm of lead tungstate in the course detector. Its resolution is excellent (a few percent per $\sqrt{\text{GeV}}$) because showers of electrons and photons are narrow and regular. Hadrons pass through it, depositing a little.

**The hadron calorimeter (HCAL).** Behind the ECAL is a much thicker layer of absorber (steel or brass), in which hadrons make their showers. Some ten interaction lengths, 1.7 m of iron in the course detector. Its resolution is poorer. A hadron's energy is measured by the two calorimeters together.

**The solenoid.** The magnet that makes the field of the tracker is a large coil. Where it sits relative to the calorimeters is one of the choices that distinguish the two LHC detectors, below. It must be thick enough to carry its current and strong enough to hold the force, and it is a source of material that particles must cross.

**The muon system.** Outside everything else is the only part of the detector that most particles never reach. After the tracker, the ECAL, the HCAL and the coil, only muons (and neutrinos, which do not interact) remain. Chambers outside the absorber record the muon's path a second time, often in a second magnetic field.

The order is not arbitrary. The tracker is first because it must not disturb what it measures. The ECAL is before the HCAL because electromagnetic showers are short and a calorimeter in which they stop early is a good one: if the HCAL came first, an electron would shower in its coarse material and be badly measured. Both calorimeters are before the muon system because they act as an absorber that the muon system needs: the thicker it is, the purer the muons. A detector built in this order separates the particles by *which layers they reach*. Figure 7.1 fires six kinds of particle through the course detector and shows what each does.

::onion-signatures{n="7.1" caption="One simulated particle of each kind fired through the course detector (hep/detector, the onion preset: 8 tracker layers to 1.1 m, a 25 X₀ ECAL, a 10 λ HCAL and 4 muon stations out to 7 m) and the average over 40 of them. Dots: tracker hits (white), ECAL cells (blue), HCAL cells (orange), muon-chamber hits (red); radii are compressed so that the tracker is visible. The table gives the mean number of tracker hits, the energy in each calorimeter and the number of muon-chamber hits."}

The patterns are the particle's **signature**, and a short list covers nearly everything:

| Particle | Tracker | ECAL | HCAL | Muon system |
|---|---|---|---|---|
| Electron | track | shower, all its energy | little | none |
| Photon | none (a *conversion* may show a pair of tracks) | shower, all its energy | little | none |
| Muon | track | a trace, about a third of a GeV | a trace | track |
| Charged hadron (π, K, p) | track | a little | shower | none |
| Neutral hadron (n, K<sub>L</sub>) | none | a little | shower | none |
| Neutrino | none | none | none | none |
| Jet (a spray of the above, close together) | many tracks | photons of the π⁰s | most of the energy | none |

```predict
q: 'A particle leaves a curved track in the tracker, and then deposits 20 GeV in the electromagnetic calorimeter and almost nothing in the hadron calorimeter. Its track has a momentum of 20 GeV/c. What is it most likely to be?'
options:
  - text: An electron.
    correct: true
    why: 'Its energy equals its momentum (E/p ≈ 1, as for any light fast particle), and all of it is in the ECAL, which is what an electromagnetic shower does. A charged pion of 20 GeV would have gone through the ECAL (about one interaction length thick) with a small deposit and showered in the HCAL. A muon would leave a trace only. The pattern "track + ECAL only + E ≈ p" is how electrons are found (Chapter 8).'
  - text: A charged pion.
    why: 'A pion is a hadron. The ECAL is about one interaction length thick, so a pion usually either goes through it nearly unnoticed or starts to shower there only partway, and in either case the bulk of its energy ends in the hadron calorimeter. Almost nothing in the HCAL, and the whole of the energy in the ECAL, is the signature of an electromagnetic shower.'
  - text: A muon.
    why: 'A muon is minimum-ionising and leaves only a small trace (a few hundred MeV) in the ECAL. It would not deposit 20 GeV there.'
```

::particle-gun-3d{n="7.2" caption="Fire one particle of your choice into a simulated detector: choose its kind, transverse momentum, direction and the magnetic field. The truth (the particle's path, dotted or wavy where it leaves no track) and the reconstruction are overlaid. Try the photon and the neutron, which leave no track, and the neutrino, which leaves nothing. This display uses the event display's own simplified detector model, not the library's detector simulation."}

## How precisely: resolution

What matters to a physicist is not only *what* each layer sees but how well it measures. The three sets of detectors have different formulae for their resolution, and the difference decides where each is used.

The **tracker**'s relative resolution on transverse momentum is Chapter 5's: a term that grows linearly with $p_T$ (the position errors) added in quadrature to a constant (multiple scattering),

$$\frac{\sigma(p_T)}{p_T} \;=\; a\,p_T \;\oplus\; b,$$

where ⊕ means adding in quadrature, $\sqrt{(a p_T)^2 + b^2}$. It is best at low momentum and *worsens* as the particle gets stiffer.

A **calorimeter** works the other way. Its resolution on the energy $E$ is conventionally written as three terms added in quadrature:

:::equation{#calo-res caption="The relative energy resolution of a calorimeter: a stochastic term that falls as 1/√E, a constant term, and a noise term that falls as 1/E. At high energy the constant term wins."}
$$\frac{\sigma(E)}{E} \;=\; \frac{\term{a}{a}}{\sqrt{E}} \;\oplus\; \term{b}{b} \;\oplus\; \frac{\term{c}{c}}{E}$$

```terms
a:
  label: 'a, the stochastic term'
  what: A number, in units of √GeV, that comes from the counting statistics of the shower. The signal is proportional to the number of particles in the shower (Chapter 6), which fluctuates as the square root of the number, so the relative error falls as 1/√E.
  why: It is the fundamental limit of the technology. A homogeneous crystal calorimeter, in which all the shower is measured, has a small a (about 3 %/√E for CMS-like lead tungstate in the course's preset). A sampling calorimeter, which measures only a fraction of the shower, has a larger one (10 %/√E for an ATLAS-like liquid-argon calorimeter in the preset), and a hadron calorimeter larger still (50–100 %/√E).
  effect: Quadruple the energy and this term halves.
b:
  label: 'b, the constant term'
  what: |
    A fractional error that does not depend on the energy: non-uniformity of the material, imperfect calibration of the cells, leakage out of the back, dead material.
  why: It is a property of the detector as built, not of the physics. It is the floor below which the resolution cannot fall however energetic the particle.
  effect: At 100 GeV it usually dominates a good calorimeter. Typical values are 0.3–1 % for electromagnetic and 3–5 % for hadronic calorimeters.
c:
  label: 'c, the noise term'
  what: The electronic noise of the readout, in GeV, summed over the cells in the shower. It is a fixed absolute error, so relative to the energy it falls as 1/E.
  why: Every cell fluctuates a little even when nothing hits it, and a shower is read from many cells.
  effect: It matters only at low energy, a few GeV and below.
```
:::

The two behave oppositely with energy. Figure 7.3 compares them for the course detector and for the two design-level presets, so that the answer to the question "which is more precise?" can be read off. For the course detector the ECAL ($2.7\%/\sqrt{E}\oplus0.3\%$ plus noise) is 1.0 % at 10 GeV and 0.4 % at 100 GeV. The tracker gives 0.5 % at 10 GeV and 1.7 % at 100 GeV (the formula of Chapter 5 with the detector's layers). The curves cross at about 26 GeV: *below* it the tracker is the better way to measure an electron's energy (through its momentum), *above* it the calorimeter is. For hadrons, with the HCAL at $100\%/\sqrt{E}\oplus5\%$, the crossover is far higher, at a few hundred GeV (about 400 GeV in the course detector), which is why a charged hadron's momentum is taken from the tracker over almost the whole range of energies it has at the LHC.

::resolution-crossover{n="7.3" caption="The relative resolution of the tracker's momentum measurement (from Chapter 5's formula applied to the preset's layers) and of the calorimeters' energy measurement (the preset's a/√E ⊕ b ⊕ c/E), for the course detector and the library's CMS-like and ATLAS-like presets. 'Show simulated points' adds the same quantities from simulating particles with the detector module and fitting them. The presets use approximate public numbers; the figure is a comparison of design choices, not of the real detectors' published performance."}

An ideal analysis uses all of this at once, which is the purpose of *particle flow* in Chapter 8: the best instrument for each particle in each range of energy.

```numeric
id: ecal-res-50
title: A calorimeter's resolution at 50 GeV
prompt: 'The course detector''s ECAL has a stochastic term of 2.7 %/√E and a constant term of 0.3 %. Ignoring noise, what is its relative energy resolution σ(E)/E for a 50 GeV electron, in percent?'
answer: 0.49
unit: '%'
tolerance: 0.03
hints:
  - 'Add the two terms in quadrature: σ/E = √((0.027)²/E + (0.003)²) with E in GeV.'
explain: "(0.027)²/50 = 1.46 × 10⁻⁵ and (0.003)² = 9 × 10⁻⁶. Their sum is 2.36 × 10⁻⁵, whose square root is 4.86 × 10⁻³ = 0.49 %. At this energy the stochastic term is still larger, but the constant term is already 0.3 %, and at 1 TeV it would give 0.3 % ⊕ 0.085 % = 0.31 %: the floor."
```

## Detectors that read electronically

Early particle detectors gave pictures, and a person looked at them. A collider produces millions of events a second, and what is needed is a detector that gives signals a computer can read. Two inventions, three decades apart, made the tracker of the LHC possible.

The first was the **multiwire proportional chamber**. A plane of thin parallel wires, each at a positive voltage, sits in a gas between two grounded planes. A charged particle ionises the gas; the electrons drift towards the nearest wire, where the field is so strong that each one makes an avalanche of further ionisation, which gives a signal large enough to read. Each wire gives its own signal, and so the plane tells which wire was nearest to the particle. The wires are typically a millimetre or two apart, and several planes in sequence give a track.

:::history{year=1968 title="Wires instead of photographs" people="Georges Charpak and colleagues" source="Sources: Charpak et al. (1968), Nuclear Instruments and Methods 62, 262; Nobel Prize in Physics 1992."}
In 1968 Georges Charpak and his colleagues at CERN published a paper on the use of multiwire proportional counters to select and localise charged particles.:cite[charpak1968] Proportional counters, single wires in gas, were old, and the new thing was a plane of many wires in the same gas volume, each of which worked independently of its neighbours and could be read out electronically. It meant that a detector could give a particle's position directly to a computer, at a high rate, with no film to develop and no person to scan it. Chambers of this kind were taken up widely because of that, and they are the ancestors of the gas-based trackers still used. Charpak received the Nobel Prize in Physics in 1992 for the invention and development of particle detectors, in particular the multiwire proportional chamber.:cite[nobel-charpak]
:::

The second was the **silicon detector**. In a thin wafer of silicon, divided into strips or pixels, a charged particle makes electron–hole pairs: Chapter 6 gave 116 keV on average in 300 μm, which at 3.6 eV per pair is some 32,000 pairs. Electrodes collect them, and the strip or pixel that gives a signal says where the particle crossed. No gas and no amplification by avalanche is needed: the signal is already large enough. The position resolution is set by the pitch of the strips (tens of micrometres) and is much better than a wire chamber's, and the sensor is thin and light, so there is little scattering.

:::history{year=1983 title="A telescope of silicon strips" people="B. Hyams, J. Kemmer and colleagues" source="Source: Hyams et al. (1983), Nuclear Instruments and Methods 205, 99."}
In the early 1980s experiments at CERN began to put silicon microstrip detectors in the beam to follow particles with a precision of micrometres. A paper of 1983 describes a "telescope" of six such detectors, with a resolution of 5 μm for minimum-ionising particles, tested in a beam of 175 GeV/*c*, for experiments on the production of short-lived particles.:cite[hyams1983] The motive is a matter of scale. A particle containing a charm quark, such as the $D^0$, travels on average only $c\tau = 0.12$ mm before it decays (the library's particle table gives 0.123 mm), and the $D^+$ 0.31 mm: to see that a decay vertex is displaced from the production vertex by that distance, the tracks must be measured to a few micrometres. Later, silicon strips and pixels became the detectors closest to the collision point at every collider experiment, including the LHC's, for the same reason: they are how a decay a fraction of a millimetre from the beam is told from the collision itself (Chapter 24).
:::

## Hermeticity and missing momentum

A detector tells us what it saw. The neutrino was not seen, and it carries off energy and momentum. How can one conclude anything about it?

Chapter 2 gave the answer. Before the collision the colliding partons carry no momentum *transverse* to the beam (to a good approximation), so the transverse momenta of everything produced must add up to zero. If the vector sum of the transverse momenta of everything the detector saw is not zero, the difference must have been carried away by something unseen, and

$$\vec p_T^{\ \text{miss}} \;=\; -\sum_{\text{visible}} \vec p_T$$

is an estimate of the transverse momentum of the neutrinos (or of whatever else is invisible). Chapter 23 uses it to find the W boson. It requires that *everything else* be seen: every particle that is not a neutrino must be measured, in every direction, or the sum is wrong. A detector with this property is called **hermetic**, from the sealed jar of the alchemists, and the requirement determines the design.

The beam pipe is a hole and cannot be closed. Charged hadrons and photons produced at small angles to the beam leave through it, and since the production of particles in a proton–proton collision is roughly uniform in pseudorapidity, there are many. If the detector's calorimeters extended only to $|\eta| < 2.5$, the acceptance of the tracker, how much would be lost? Compare two assumptions:

```numeric
id: isotropic-outside
title: The fraction outside the tracker
prompt: 'Suppose particles were emitted isotropically. What percentage of them would go at |η| > 2.5, outside the tracker''s acceptance? (η = −ln tan(θ/2); for an isotropic distribution the fraction at polar angles in a range is the fraction of the sphere''s area, and cos θ = tanh η.)'
answer: 1.34
unit: '%'
tolerance: 0.03
hints:
  - The fraction of the sphere with |cos θ| > cos θ₀ is 1 − cos θ₀. Here cos θ₀ = tanh 2.5.
explain: "tanh 2.5 = 0.9866, so 1 − 0.9866 = 1.34 %: only one particle in 75 would escape. But collisions do not produce particles isotropically: the number per unit of η is roughly constant, out to |η| of about 5 or more. Then the fraction of the particles in |η| < 5 that are at |η| > 2.5 is half. The beam pipe's hole, 9° from the beam at η = 2.5 and 0.8° at η = 5, is at the centre of the action, and that is why both LHC detectors have forward calorimeters reaching |η| ≈ 5."
```

The same requirement shows up in the small things: the cracks between calorimeter modules, the cables and cooling pipes that must leave the detector, the dead channels. An *energy deposit in the gap* is lost, and a hot cell makes energy that was not there. Both fake a missing momentum. The reconstruction of Chapter 8 calculates it from every calorimeter cell and every muon.

::event-display-widget{sample="wenu" n="7.4" views="rphi,rz" caption="A simulated W → eν event in the event display's simplified detector model. The electron is a track ending in an ECAL tower; the neutrino leaves nothing, and the missing transverse momentum, drawn as a dotted arrow, points the way it went. Select an object to see its details. Step through further events with the buttons. The events come from the display's own event generator and are a stand-in, not the library's simulation of a real W production."}

## ATLAS and CMS: two designs

At the LHC, two general-purpose detectors, ATLAS and CMS, were designed from the start to address the same physics with different choices, so that an observation in one could be checked in the other. The central choice was the magnet.:cite[atlas2008,cms2008]

- **CMS** (Compact Muon Solenoid) has *one* large superconducting solenoid, 3.8 T, which encloses the tracker, the electromagnetic calorimeter (lead-tungstate crystals) and the hadron calorimeter (brass and scintillator). Outside the coil is an iron yoke that returns the flux, with the muon chambers embedded in it. The muon's momentum is measured twice, in the tracker at high field and in the yoke. The design is compact (hence the name) and has a very strong field in the tracker, which gives a high momentum resolution.
- **ATLAS** has *two* magnet systems. A thinner solenoid, 2 T, surrounds the tracker and sits in front of the calorimeters, whose electromagnetic part is liquid argon interleaved with lead, and whose hadronic part is iron with plastic scintillator. Outside the calorimeters are large *air-core toroids*, coils shaped like doughnuts that make a field without iron. A muon crossing them is bent but not scattered by iron, so its momentum can be measured by the muon system alone, over a much longer path. The consequence is that ATLAS is much larger than CMS, yet about half its weight (Chapter 0 gave the numbers).

Neither choice is better. A strong field in a small volume gives the best momentum measurement of the tracker per unit cost; a weaker field over a large volume with little material gives the muon system more independence. The library's `cms-like` and `atlas-like` presets reproduce the contrast in the parameters of this chapter: 3.8 T and a crystal ECAL with $a \approx 3\%$ for the first; 2 T, a coarser sampling ECAL with $a \approx 10\%$, a finer HCAL ($50\%/\sqrt{E}$) and a muon system with a large lever arm, the toroids being approximated by a solenoid-like return field of 0.5 T, for the second. Both are approximate and simplified (no endcaps, one effective material per calorimeter), and the tracker of the ATLAS-like preset has coarse outer layers standing in for a straw tracker.

| | course detector | `cms-like` | `atlas-like` |
|---|---|---|---|
| Solenoid field | 3.8 T | 3.8 T | 2 T |
| Tracker layers, outer radius | 8, 1.1 m | 14, 1.08 m | 12, 1.07 m |
| ECAL stochastic / constant term | 2.7 % / 0.3 % | 2.8 % / 0.3 % | 10 % / 0.7 % |
| HCAL stochastic / constant term | 100 % / 5 % | 100 % / 5 % | 50 % / 3 % |
| Muon stations (radius) | 4–7 m | 4–7 m | 5–9.5 m |
| Field in the muon region | −1.8 T | −2 T | 0.5 T (stand-in for the toroids) |

(Values from `presets` in `hep/detector`: rounded design-level numbers. Figure 7.3 shows what they imply.)

## Designing a detector

A design is a set of choices that trade one resolution against another and all of them against cost. The tracker's momentum resolution goes as $1/(BL^2)$ (Chapter 5): the field $B$ and the radius $L$ are the dials. But the radius is not free: the calorimeters and the muon system are outside the tracker, so a larger tracker means a larger everything. The field has a cost too: the energy stored in a magnet is $B^2/(2\mu_0)$ times its volume, and in the toy model below its price rises as that energy to the power 0.7. The calorimeters' depth sets how much of a shower they contain: too shallow and the energy leaks out of the back, as Chapter 6 showed; too deep and the cost rises for nothing. The choice of technology, crystals or a sampling calorimeter, trades resolution for money.

Figure 7.5 is a detector designer. Set the field, the radius of the tracker, the number of strip layers, the depths of the calorimeters and the technology of the ECAL. The page builds the detector described, fires particles at it with the library's `simulate`, fits the muon tracks with the circle fit of Chapter 5 and measures what comes out, and compares each number with a goal. The **cost model is a toy**: its shape follows how real costs scale (silicon by area, the magnet by stored energy to the 0.7 power, crystals and absorber by volume) but its prices are round numbers made up for the exercise, in "budget units", and it says nothing about what any real detector cost.

::detector-designer{n="7.5" caption="The detector designer: a three-layer pixel detector plus a chosen number of strip layers out to the chosen radius, an ECAL and HCAL of chosen depth and an ECAL technology, in a solenoid of chosen field, with a muon system outside. The numbers on the right are measured by simulating muons, electrons and pions in the design with the detector module (200 muons at each of two momenta, 100 electrons and 200 pions at each energy), with the muon tracks fitted by the library's circle fit on their own hits, so the pattern recognition is taken as perfect. The cost and the goals are a toy; the simulation numbers are the course detector's physics. The event display below the table shows one particle fired into the design. The numbers fluctuate by 5–10 % from one design to the next."}

:::challenge[Meet every goal for under 90 units]
The default design, which is close to the course detector, costs about 82 units of the 100 budget and misses one goal: it measures the momentum of 100 GeV muons to 2.2 %, not 1.5 %. Which knob improves it for the least cost? Find a design that meets every goal, and costs less than 90. (One solution: a field of 4.5 T, a tracker out to 1.3 m with four strip layers, a 22 X₀ ECAL and a 9 λ HCAL costs about 87 units and gives 1.3 %.) Then find out what happens to the electron measurement if you change the ECAL to the cheaper technology, and what happens to the pion's if you make the hadron calorimeter shallower.
:::

The exercise is, in miniature, the problem the collaborations faced. Real designs have more constraints (radiation damage, the speed of the readout, access for repair, the size of the cavern) and more people, and take over a decade. But the shape is the same: no choice improves one number without a price somewhere else.

## Under the hood: a detector as a data structure

The simulation of Chapter 7's detector is a loop over particles, and for each one a loop over layers. A layer is a cylinder (radius, half-length, resolution, material), and the geometric question "where does this helix meet this cylinder?" is answered in closed form (Chapter 5), so no spatial index is needed for a barrel of eight layers. The calorimeter is the other case: it is a grid of cells in $(\eta, \phi)$, and a shower deposits energy in a few of the tens of thousands of cells. The library therefore stores only the cells that have energy, in a hash map keyed by a single integer, rather than a full array:

```ts
// hep/detector/simulate.ts
class CellAcc {
  /** One map per (calorimeter, layer), keyed by (ieta + 4096) × nPhi + iphi (small integers, so V8 hashes them fast). */
  private maps: (Map<number, number> | undefined)[] = new Array(32);
  add(cal: number, layer: number, ieta: number, iphi: number, nPhi: number, e: number, truth: number): void {
    const key = (ieta + 4096) * nPhi + iphi;
    ...
```

A *sparse* representation, as a real readout has: most channels of a detector see nothing in a given event. The **digitisation** of a tracker hit, the step from the true crossing point to the number the electronics would report, is a few lines. A dead channel is a fixed, pseudo-random function of the position, so that the same channel is dead in every event (as in a real detector, where a dead module stays dead), and the surviving hit is the true position displaced by a Gaussian of the layer's resolution:

```ts
if (cfg.deadFraction > 0) {
  const phi = Math.atan2(oy, ox);
  dead = hash32(L.idx, Math.floor((phi * L.r) / L.pitchRPhi), Math.floor(oz / L.pitchZ)) / 4294967296 < cfg.deadFraction;
}
if (!dead) {
  const dT = gauss(c) * L.sRPhi;
  const dz = L.sZ > 0 ? gauss(c) * L.sZ : 0;
  c.hits.push({ layer: L.idx, x: ox - (dT * oy) / L.r, y: oy + (dT * ox) / L.r, z: oz + dz, truth: w.truth, edep });
}
```

The resolution of the calorimeter is not coded as a formula either. Each shower's energy is multiplied by a Poisson draw of mean $E/a^2$ (scaled back), so that the $a/\sqrt{E}$ term *emerges* from counting, and the constant and noise terms are added to it; the three terms of the resolution equation are then a result to be checked, not an input, and the library's tests check them.

:::programmer
A detector is a **data-acquisition system**, and the vocabulary is familiar. The sensors are sampled at a fixed rate, converted by an ADC, compared with a *threshold* (a cell is kept only if its energy is above about twice its noise: *zero suppression*, which turns an array of mostly zeros into a sparse list), time-stamped and sent on. The thresholds are a trade: too low and noise fills the bandwidth, too high and low-energy particles are lost. Dead and noisy channels are an operational fact, like a failing disk, and the calibration constants are configuration data that must be versioned, since the same event reconstructed with different constants gives different physics.
:::

:::experiments
The detectors at the LHC are described, in their own papers, as the sum of their subsystems: a silicon pixel and strip tracker, calorimeters, and a muon spectrometer, with ATLAS and CMS each adding detectors in the forward direction.:cite[atlas2008,cms2008] The question "what did the detector see?" is answered in practice by a *geometry description*, a file listing every volume with its material and position, which feeds both the simulation and the reconstruction so that they agree. The experiments' simulation software reads this description and tracks every particle through every volume with Geant4 (Chapter 6); the reconstruction uses a simplified version of it. The course's `DetectorConfig` plays the same role in a much smaller form: eight cylinders, two calorimeters and four stations, in one object that `simulate` and `reconstruct` both read.
:::

:::real{parts="A phone camera as a pixel detector"}
The sensor in a phone's camera is a silicon pixel detector, built on the same physics as the silicon detectors of this chapter. With the lens covered, an ordinary phone can record the signals of cosmic-ray muons and of radioactivity as bright spots in the dark frames. Appendix G describes a way to try it: how to record, how to find the hits in the frames with a few lines of code, and what to expect. See [Appendix G](/appendix/build-it-for-real/).
:::

## What comes next

A detector is an instrument that records hits, cells and chamber signals. A physicist needs particles: this track belongs to a 20 GeV muon, this deposit to an electron, this set of energy to a jet. The step between the two, from hits to objects, is software, and it is the subject of [Chapter 8](/chapters/reconstruction/): finding the tracks among thousands of hits, fitting them with a Kalman filter, locating the vertices, clustering the calorimeter cells and combining everything into particles, then measuring how well it was done by comparing with the simulated truth.

## Further reading

- The ATLAS and CMS detector papers, for the two designs described by their own collaborations (:cite[atlas2008,cms2008]).
- Charpak's 1968 paper and the Nobel Foundation's page on his prize (:cite[charpak1968,nobel-charpak]), and the 1983 paper on the silicon telescope (:cite[hyams1983]).
- The Particle Data Group's review chapter on particle detectors at accelerators, for the resolution formulae and the typical parameters of every kind of detector (:cite[pdg2024]).
