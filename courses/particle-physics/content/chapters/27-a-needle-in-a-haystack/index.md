---
number: 27
title: A needle in a haystack
summary: A Higgs boson is made in about one proton collision in a billion and the detectors can keep about one crossing in forty thousand. How the trigger chooses, what it costs to choose wrongly, how the real dimuon data still carry the trigger's fingerprints, and where the data go afterwards.
duration: About 3 hours
prerequisites: [the-higgs-mechanism, colliding-beams, reconstruction]
---

Chapter 26 ended with a prediction: a neutral particle of spin 0 and mass that nobody knew, which decays into the heaviest particles it can reach. Finding it is a counting problem before it is a physics problem. At the LHC's design luminosity, protons collide about 1.6 billion times a second and a Higgs boson appears about once. Each detector produces something like a megabyte per collision it looks at, and the computers can write about a gigabyte a second. Something has to decide, within millionths of a second, which crossings are worth keeping, and whatever it throws away is gone for ever. This chapter is about that decision, the statistics of the rates it has to manage, and the price of getting it wrong. It also uses the real dimuon data of Chapter 2 to look for the trigger's fingerprints, and ends with where the kept data go.

## Rate is cross-section times luminosity

Chapter 3 introduced the two numbers that set how often a process happens, and Chapter 21 showed how a machine makes the second one large. The first is the **cross-section** σ of the process: an area that measures how likely it is for one collision to make it (Chapter 1 gave the units, and the barn, the picobarn and the femtobarn). The second is the **instantaneous luminosity** $\mathcal L$, the number of particles per unit area and time that the colliding beams present to each other. The rate of the process, the number of times per second it happens, is their product:

:::equation{#rate caption="The rate of any process: its cross-section times the luminosity. The same equation gives the number of events in a data set when the luminosity is integrated over the running time."}
$$\term{R}{R} = \term{sigma}{\sigma}\,\term{L}{\mathcal{L}}, \qquad N = \sigma\int \mathcal L\,dt = \sigma\,\term{Lint}{L_\mathrm{int}}$$

```terms
R:
  label: 'R, the rate'
  what: The number of times per second that the process happens, in events per second (Hz).
  why: It is what a trigger system has to cope with. A process with a rate above the budget must be filtered, prescaled or thrown away.
  effect: A Higgs boson made at 1 Hz is one event among 1.6 billion inelastic collisions per second.
sigma:
  label: 'σ, the cross-section'
  what: The effective area of the target for the process. It is measured in barns (1 b = 10⁻²⁸ m²) and in the picobarns and femtobarns that the LHC needs. 1 pb = 10⁻³⁶ cm².
  why: It is the physics input. It comes from the theory (Chapters 15, 16 and 23) or is measured. The same collision can make many different final states, each with its own cross-section.
  effect: Inelastic proton–proton collisions have about 80 mb, a Higgs boson of any kind about 50 pb, which is 1.6 billion times less.
L:
  label: '𝓛, the instantaneous luminosity'
  what: A property of the beams alone, in cm⁻² s⁻¹. At the LHC it reached about 2 × 10³⁴ cm⁻² s⁻¹ in the later years of Run 2.
  why: It is set by the number of protons per bunch, the number of bunches, how tightly the beams are squeezed at the collision point and how often they cross (Chapter 21).
  effect: Double the luminosity and every rate doubles, the wanted ones and the unwanted ones alike.
Lint:
  label: '$L_{\mathrm{int}}$, the integrated luminosity'
  what: The luminosity added up over the time the detector was recording, in fb⁻¹ (inverse femtobarns). One fb⁻¹ is 10³⁹ cm⁻².
  why: Multiplied by a cross-section it gives the number of events of that process in the whole data set. It is the number that experiments quote to say how much data they have.
  effect: About 140 fb⁻¹ of good data were taken at 13 TeV in Run 2. At 50 pb, that is 7 million Higgs bosons produced.
```
:::

Two numbers give the scale of the haystack. The higher-order prediction for the production of a Higgs boson in proton–proton collisions at the LHC's energy is several tens of picobarns, and this course uses a round 50 pb (the leading-order calculation in the generator gives 14 pb, about a third of that, and Chapter 29 says what is done about it). The cross-section for any inelastic collision is about 80 mb = $8\times10^{10}$ pb. So **one collision in 1.6 billion** produces a Higgs boson. At $\mathcal L = 2\times10^{34}\ \text{cm}^{-2}\text{s}^{-1}$ the rates are

$$R_\text{inelastic} = 8\times10^{-26}\ \text{cm}^2 \times 2\times10^{34}\ \text{cm}^{-2}\text{s}^{-1} = 1.6\times10^{9}\ \text{s}^{-1}, \qquad R_H = 5\times10^{-35}\ \text{cm}^2 \times 2\times10^{34} = 1\ \text{s}^{-1}.$$

The particular Higgs decays that are easy to see are rarer still. The decay to two photons has a branching fraction of 0.23 % (from the course's particle table), which makes one event every seven minutes, before any selection. The decay to four electrons or muons through two Z bosons is about 0.012 %: about one every two hours.

::rate-ladder{n="27.1" caption="Rate = σ × L for a ladder of processes. Drag the luminosity and the data set. The bars are on a logarithmic scale of events per second; the dashed marks are the 40 MHz crossing rate, the 100 kHz that the first trigger level can pass on, and the 1 kHz that can be written to storage. The cross-sections are rounded, approximate values at 13 to 14 TeV: the point is the order of magnitude, not the digits. The Higgs rows use 'about 50 pb' (several tens of picobarns) and the branching fractions in the text."}

```fermi
id: higgs-count
title: Higgs bosons produced in Run 2
prompt: About 140 fb⁻¹ of proton–proton data at 13 TeV were recorded and judged good in Run 2 by each of ATLAS and CMS. Taking a Higgs production cross-section of 50 pb, how many Higgs bosons were produced in each experiment's data set? (1 fb⁻¹ = 1000 pb⁻¹.)
answer: 7.0e6
unit: events
factor: 3
hints:
  - N = σ × L_int. First convert 140 fb⁻¹ to pb⁻¹.
explain: "140 fb⁻¹ = 1.4 × 10⁵ pb⁻¹, so N = 50 pb × 1.4 × 10⁵ pb⁻¹ = 7 × 10⁶. Several million Higgs bosons were produced in each experiment. Only a small fraction can be used: the branching fractions you need are a fraction of a percent, the detector sees about half of the events, and the selection keeps a fraction of those. The analyses of Chapter 29 start from a few hundred to a few thousand events, not millions."
```

## Why not record everything?

Count what the detector would have to store. The ATLAS and CMS detectors each have of the order of $10^8$ readout channels (Chapter 7), and after the electronics have suppressed the channels with nothing in them a collision takes up about 1 MB. Crossings come every 25 ns, so the stream entering the trigger is

$$40\times10^{6}\ \text{s}^{-1} \times 1\ \text{MB} = 40\ \text{TB/s}.$$

It is not possible to write 40 terabytes a second to disk, or even to move them. (At this luminosity each crossing holds several dozen collisions, Chapter 21, and the detector reads the whole crossing at once, so the unit of the stream is the crossing.) Even if the storage existed, there would be some $4\times10^{14}$ crossings a year to analyse, almost all of them dead ends. The :term[trigger]{id=trigger} solves both problems by deciding early and keeping the crossings that could hold something. The rate of the stream is fixed by the machine (a crossing every 25 ns); the rate that can be kept is fixed by the budgets of the electronics, the network and the disks. A typical design is

| Stage | Input rate | Decision time | Output rate | Data rate out (1 MB/event) |
|---|---|---|---|---|
| Crossing | 40 MHz | | | |
| Level 1 (hardware) | 40 MHz | about 4 µs | about 100 kHz | about 100 GB/s |
| High-level trigger (software) | 100 kHz | about 0.1 s per event (spread over many cores) | about 1 kHz | about 1 GB/s |

These are round design figures: the experiments' real numbers differ by factors of order 1 from year to year and between ATLAS and CMS.:cite[cmstrigger2017,atlastrigger2017] Level 1 therefore keeps one crossing in 400, and the high-level trigger one in 100 of those, so that in the end **one crossing in 40,000 is kept**. Out of the 1.6 billion collisions every second, about a thousand events are written out. The trigger is the first place where the selection of the physics happens, and it happens before any human has looked at anything.

:::programmer
A trigger is a **stream filter with a latency budget and a bandwidth budget**. Input arrives at a fixed rate that cannot be paused or replayed. There is a deadline for the answer, set by the size of a buffer. There is a maximum rate of accepted items, set by the next stage. And a filter that keeps everything, or nothing, is useless: the design problem is to keep the most valuable items within those budgets. A prescale, which keeps only one item in $N$, is the same operation as sampling a log stream. The mistake you cannot fix afterwards is false negatives: an event that the filter dropped can never be recovered, while a false positive only costs bandwidth.
:::

## Level 1: four microseconds

The first stage, the :term[Level-1 trigger]{id=level-1-trigger}, has to decide about every crossing and cannot afford to look at most of the data. It is built from custom electronics, **field-programmable gate arrays** (FPGAs, chips whose logic can be rewired in software) and dedicated boards in an underground counting room, close to the detector but shielded from its radiation. It does not get the full event. Only two kinds of coarse information are sent to it in time:

- **Calorimeter towers**: the energy deposited in blocks of the calorimeters, summed over a patch of 0.1 in η and about 0.1 in φ, and converted to transverse energy $E_\mathrm T$. No tracks and no vertices, just energy in a grid.
- **Muon stubs**: short track segments in the muon chambers, with a rough estimate of $p_\mathrm T$ from the bend. The muon chambers are the outermost layer of the detector (Chapter 7), and only muons get there in numbers.

From these it builds candidate objects: electron or photon candidates (a narrow deposit), jets (a wide one), muons, the sum of jet energy $H_\mathrm T$, and missing transverse energy. A **trigger item** is a condition on one of them, such as "a muon with $p_\mathrm T$ above 25 GeV" or "two electron or photon candidates, each above 20 GeV".

The constraint that shapes all of this is time. A crossing happens every 25 ns and the detector cannot stop. The data of every crossing are written into a fixed-length memory on the detector and pushed along it, and 4 µs later the oldest ones are pulled off the end. The Level-1 decision has to reach the detector before the crossing it concerns falls out of the pipeline. At 25 ns per crossing, 4 µs is 160 crossings in flight at once. That is the latency budget: about 4 µs for CMS and about 2.5 µs for ATLAS.:cite[cmstrigger2017,atlastrigger2017] The figure uses 4 µs. A large part of it is used by the cables and the transport: light goes 1.2 km in 4 µs, and the signals travel more slowly than light in a cable.

::l1-pipeline{n="27.2" caption="Each square is one bunch crossing held in the Level-1 pipeline, coloured by the stage of the decision it has reached. The four stages are an illustrative split of the 4 µs budget (the experiments' own splits differ); the pipeline has 160 crossings. Stretch any stage and watch what happens when the decision comes later than the pipeline is long."}

The accepted crossings (about 100 thousand a second) are read out at full granularity and sent through the event builder to the next stage.

## The high-level trigger: software

The second stage, the :term[high-level trigger]{id=high-level-trigger} (HLT), gets the full event and time. It runs on a large farm of ordinary computers, tens of thousands of processor cores in each experiment, which run a fast version of the reconstruction of Chapter 8. It can fit tracks, find vertices, apply the same electron, photon, muon and jet algorithms as the final analysis with less precision, and apply isolation. It has of the order of a tenth of a second of processor time per event, tens of thousands of times what Level 1 had, and it rejects 99 % of what arrives. What comes out is written to disk at about a kilohertz: a little over a gigabyte a second.

The HLT is software, so it can be changed between one run and the next. That matters more than it sounds. A new search, or a correction to a calibration, is a change to the code of the trigger; Level 1, in hardware and firmware, is much less flexible, which is why its menu is designed conservatively and changed rarely.

## Menus, thresholds and prescales

What the trigger does is set by its :term[menu]{id=trigger-menu}: a list of items, each with a threshold at Level 1 and a corresponding one in the HLT, where each item's threshold and selection is tuned to the physics it serves. The numbers that matter are:

- The **threshold**. A cut on the object's $p_\mathrm T$ or $E_\mathrm T$. Lowering it raises the efficiency for the physics and the rate of everything else.
- The :term[prescale]{id=prescale}. A factor $N$ for which only one accepted event in $N$ is kept. A prescale of 1 is unprescaled. A highly prescaled low-threshold item keeps a small, unbiased sample of the abundant low-energy physics that is used to calibrate and to measure the efficiency of the others.
- The **budget**. The sum of the rates of all items, counting an event that passes several only once, must fit in the output rate of the stage, and it must do so at the highest luminosity of the fill, because the rates of the items grow with it.

The menu is an optimisation problem with a hard constraint. It also has an unusual property: the only events the experiment ever sees are the ones the menu keeps. An item that is set too tightly will not produce an error message. It will silently remove a part of the physics from every measurement that follows.

A threshold is not a sharp cut. The coarse quantities at Level 1 have poor resolution, so a muon of true $p_\mathrm T$ somewhat below the nominal threshold sometimes passes, and one somewhat above sometimes fails. The efficiency as a function of the true momentum rises along an S-shaped :term[turn-on curve]{id=turn-on-curve}, which for a resolution of σ and a threshold $x_{50}$ at which the efficiency is half of its final value is

:::equation{#turnon caption="The efficiency of a trigger item as a function of the true pT. It is 50 % of the plateau at the nominal threshold, and it needs several σ above it to reach the plateau."}
$$\varepsilon(p_\mathrm T) = \term{plateau}{\varepsilon_\infty}\cdot\tfrac12\left[1 + \operatorname{erf}\!\left(\frac{\term{pt}{p_\mathrm T} - \term{x50}{x_{50}}}{\sqrt2\,\term{sig}{\sigma}}\right)\right]$$

```terms
plateau:
  label: 'ε∞, the plateau efficiency'
  what: The efficiency far above the threshold, where the item fires whenever the object is there. It can be below 1 because of dead regions, inefficient chambers and the geometry.
  why: It is the number by which every measurement using the item has to correct.
  effect: A muon trigger might have a plateau of 0.90 to 0.95.
pt:
  label: 'pT, the true transverse momentum'
  what: The transverse momentum of the object, as it would be measured with the final precision offline.
  why: It is what the analysis cuts on. The trigger sees only a coarse version of it.
  effect: Above about x₅₀ + 2σ the item is fully efficient. An analysis that selects below it has to correct for the turn-on.
x50:
  label: 'x₅₀, the nominal threshold'
  what: The pT at which the efficiency is half of the plateau.
  why: It is the number in the menu, for example "25 GeV".
  effect: To use a trigger that is named for 25 GeV, an analysis selects objects with a pT of about 27 to 30 GeV, where the efficiency is no longer changing.
sig:
  label: 'σ, the resolution'
  what: The spread of the trigger's own measurement of the pT, in GeV. It is larger than the offline resolution, because the trigger has less time and less information.
  why: It sets how sharp the turn-on is.
  effect: At Level 1, σ of about 20 % of the pT is typical, and the turn-on is correspondingly soft. The HLT is sharper.
```
:::

```predict
q: 'In the course’s toy trigger model at 2 × 10³⁴ cm⁻² s⁻¹, a Level-1 single-muon item has a threshold of 25 GeV. By about what factor does its rate grow when the threshold is lowered to 15 GeV?'
options:
  - text: About 10 per cent higher, because the extra muons are few.
    why: 'The muon pT spectrum falls steeply with pT, and most muons are soft. A large step in threshold opens a large part of the spectrum.'
  - text: About three times higher.
    correct: true
    why: 'In the toy model the item’s rate is 0.7 kHz at 25 GeV and 2.0 kHz at 15 GeV, a factor 2.9. The spectrum of muons from decays of b and c hadrons, and from pions and kaons, falls steeply: the abundance of soft muons is what makes low thresholds expensive.'
  - text: About a hundred times higher.
    why: 'The rate does rise, but not that much. A factor of 100 would need the spectrum to fall by a factor of 100 between 15 and 25 GeV, and it does not fall that fast. The toy gives about 3.'
```

## Design a menu

The game below puts you where the trigger designers are. Eight items, each with a threshold and a prescale. The budget is 100 kHz at Level 1 and about 1 kHz out of the HLT. The events are **toy samples**, generated in code from simple distributions (Chapter 29 uses the full simulation), with rounded cross-sections, and the game keeps score of the physics you keep. Loosen everything and you are over budget, and the readout drops events at random, so every channel loses. Tighten everything and the rates are fine, and you have thrown away the Higgs.

::trigger-game{n="27.4" caption="Forty million crossings a second in, about a thousand events a second out. Each of the eight items has a Level-1 threshold and a prescale (the HLT threshold follows it). The bars show the rate of each item against the budget, and the table shows how much of each kind of physics survives. The samples are toy samples: minimum bias, dijets, W, Z, top pairs, H → γγ, H → 4ℓ and an invented SUSY-like benchmark, with rounded illustrative cross-sections at 13.6 TeV. The trigger logic is the library's."}

```trigger
id: menu-higgs
title: A menu for the Higgs within 150 Hz
prompt: 'Design a menu from four items (single muon, two muons, single electron, two photons) for the high luminosity of 2 × 10³⁴ cm⁻² s⁻¹, with the HLT output limited to 150 Hz and Level 1 limited to 100 kHz. The two signals are H → γγ and H → ZZ* → 4ℓ. The menu must keep a mean of at least 90 % of both. Raise the thresholds of the items that cost rate and do not help the Higgs, and keep the ones that do.'
hints:
  - 'H → γγ is triggered by the two-photon item. H → 4ℓ has four leptons, so the two-muon item (and the single-lepton items) see it.'
  - 'Start with everything loose and find which item uses most of the rate. It is usually a single-lepton item at a low threshold: nothing in the Higgs needs it.'
  - 'Prescaling an item by 10 divides its rate by 10 but also keeps only one signal event in ten. A prescale is for abundant physics, not for the signal.'
config:
  lumi: 2
  items: [SingleMu, DoubleMu, SingleEG, DoubleEG]
  n: 800
  seed: 1
budget:
  hltHz: 150
sample: [hgg, h4l]
par: 0.9
explain: 'One menu that passes: two photons above 10 GeV, two muons above 6 GeV, single muon at 40 GeV, single electron at 60 GeV. The two signals have several leptons or photons, so their efficiency is nearly preserved by the multi-object items, and the single-object items at high thresholds cost little rate.'
```

## What is left of the trigger in real data

The trigger is not something that happens before the data. It is part of them. Every distribution of real data is a distribution of *what the trigger kept*, and sometimes the trigger's settings show through. The real dimuon sample of Chapter 2 is an example, and this section investigates it. The broad hump between about 8 and 20 GeV in Figure 2.1 is not a particle. What shapes it?

Begin with what is in the file. The sample is 100,000 pairs of oppositely charged muons from CMS, recorded in 2011 (CERN Open Data record 5201 in the education sample, CC0).:cite[cms-open-data] It contains four-momenta and charges, and nothing about the trigger. Everything below is computed from those columns with the library, and the tests in `src/lib/sims/part7/dimuon-facts.test.ts` recompute every number.

**What the data show.** First the simplest thing: the muons. Every muon in the sample has $|\eta| < 2.4$, the largest value being 2.3998. A sharp edge like this is an acceptance: the muon chambers do not extend further. Then the transverse momenta. For each pair, sort the two muons into the harder and the softer. The distribution of the softer muon's $p_\mathrm T$ is not smooth. Counting pairs in bins of 0.25 GeV, it jumps:

| Step at | Pairs just below | Pairs just above | Ratio |
|---|---|---|---|
| 3 GeV (softer muon) | 795 | 1,482 | 1.9 |
| 4 GeV (softer muon) | 2,392 | 7,035 | 2.9 |
| 6 GeV (softer muon) | 2,554 | 4,384 | 1.7 |
| 8 GeV (softer muon) | 1,675 | 2,054 | 1.2 |
| 13 GeV (harder muon) | 642 | 920 | 1.4 |

A particle's pT spectrum does not have sharp jumps of a factor of 3 at round numbers. There is none at 5 or 7 GeV, where the spectrum keeps falling smoothly. These steps must have been put there by the selection.

**What it suggests (inference, not shown by the data).** A union of several trigger items with different $p_\mathrm T$ thresholds, each of which accepts events above its own cut, gives exactly this: steps at each threshold, in the variable the item cuts on. The steps at 3, 4, 6 and 8 GeV for the softer muon and 13 GeV for the harder are what a menu with a two-muon item at each of several thresholds, and an asymmetric one (a harder and a softer leg), would leave behind. The file does not say which trigger paths were used, and this has not been checked against the record's documentation; it is an inference from the shape.

The second step is the shape of the hump. Take the 47,363 pairs with a mass between 8 and 20 GeV. Of these, 88.6 % have a softer muon above 4 GeV, and 88.1 % have *both* muons below 10 GeV. Only 27.5 % have a softer muon above 6 GeV, and 6.3 % above 8 GeV. The hump is made almost entirely of two soft muons. Their directions are not random either: 89.1 % are more than 90 degrees apart in azimuth, and among the 17,064 pairs with both muons between 4 and 6 GeV, 88 % are within $0.1\pi$ of exactly back to back.

Why should two muons of about 5 GeV each have a mass of about 10 GeV? Because of the formula for the mass of two particles whose own masses can be neglected. In collider variables (Chapter 2's $p_\mathrm T$, η and φ), it is

:::equation{#mass-collider caption="The invariant mass of two (nearly) massless particles from their transverse momenta and the separation in rapidity and azimuth."}
$$\term{m}{m}^2 = 2\,\term{pt1}{p_{\mathrm T1}}\,p_{\mathrm T2}\left(\cosh\term{deta}{\Delta\eta} - \cos\term{dphi}{\Delta\phi}\right)$$

```terms
m:
  label: 'm, the invariant mass of the pair'
  what: The invariant mass of the two particles, in GeV, with their masses neglected.
  why: It is the quantity in every histogram of this chapter, and it is computed here from the variables the detector measures directly.
  effect: Two back-to-back muons of 4 GeV have a mass of at least 8 GeV, however they are pointing.
pt1:
  label: 'pT1, pT2, the transverse momenta'
  what: The transverse momentum of each particle, in GeV.
  why: They set the scale of the mass. For fixed angles the mass is proportional to the geometric mean √(pT1 pT2).
  effect: A trigger that requires both muons above 4 GeV sets a lower limit on pT1 pT2.
deta:
  label: 'Δη, the difference in pseudorapidity'
  what: The difference between the pseudorapidities of the two particles.
  why: Particles with different pseudorapidities are at different angles to the beam, so the pair has more longitudinal momentum and a larger mass.
  effect: cosh Δη ≥ 1, so a pair with Δη ≠ 0 is always heavier than the same pair at the same η.
dphi:
  label: 'Δφ, the azimuthal separation'
  what: The angle between the two particles' transverse momenta, between 0 and π.
  why: At Δφ = 0 the two travel in the same direction and, at equal η, their mass is zero. At Δφ = π they are back to back.
  effect: For Δη = 0 and Δφ = π, m = 2√(pT1 pT2).
```
:::

:::deeper[Where the formula comes from]
For a massless particle, $E = p_\mathrm T\cosh\eta$, $p_z = p_\mathrm T\sinh\eta$, $p_x = p_\mathrm T\cos\phi$, $p_y = p_\mathrm T\sin\phi$. The squared mass of a pair is $(E_1 + E_2)^2 - |\vec p_1 + \vec p_2|^2 = 2E_1E_2 - 2\vec p_1\cdot\vec p_2$ (using $E^2 = |\vec p|^2$ for each). Now $2E_1E_2 = 2p_{\mathrm T1}p_{\mathrm T2}\cosh\eta_1\cosh\eta_2$ and $\vec p_1\cdot\vec p_2 = p_{\mathrm T1}p_{\mathrm T2}(\cos\Delta\phi + \sinh\eta_1\sinh\eta_2)$, so the bracket is $\cosh\eta_1\cosh\eta_2 - \sinh\eta_1\sinh\eta_2 - \cos\Delta\phi = \cosh(\eta_1 - \eta_2) - \cos\Delta\phi$. The test in the repository checks it on the real pairs: for pairs above 8 GeV the median error of the massless formula is below 0.05 %.
:::

The derivation gives the edge. A trigger that demands both muons above a pT cut of 4 GeV accepts back-to-back central pairs (Δη = 0, Δφ = π) only if their mass is at least $2\times4 = 8$ GeV. Pairs that are nearly collinear can have a smaller mass even when both muons clear the cut. That is the low-mass resonances at 3 GeV and below, made with enough momentum that both muons pass. They are a different population, not back to back. Among the 17,064 pairs with both muons between 4 and 6 GeV, only 139 lie between 6 and 8 GeV in mass, and the mass distribution climbs from 824 in the 8 to 9 GeV bin to 4,149 in the next, which is the edge. The figure lets you verify it: raise the cut on the softer muon and the edge moves to twice the cut.

::dimuon-thresholds{n="27.3" caption="Real data: the 100,000 CMS muon pairs of Figure 2.1, with the pT of the softer muon (top) and the pair mass (bottom). The steps in the top histogram are marked. Raise the cut on the softer muon and the rising edge of the hump moves to twice the cut. Choose back to back and most of the hump stays; choose the rest and it disappears. All numbers are from the data; no simulation is involved."}

What produces two such soft muons, in pairs that are back to back in azimuth? The data do not say. The usual suspects (an inference) are muons from the decays of heavy-flavour hadrons (hadrons with a bottom or charm quark) and of pions and kaons in flight, produced in pairs of jets that recoil against each other, which would give roughly back-to-back directions and a steeply falling $p_\mathrm T$ spectrum. The trigger makes the **rising** edge of the hump and the physics makes the **falling** side, and the hump is the product of the two. The conclusion is not that Figure 2.1 is wrong. It is that an analysis of this sample that looked for a new particle in the 8 to 20 GeV region would need to measure and correct for the trigger efficiency, or avoid the region where it changes quickly.

:::hood[Rates from weighted events]
How does the game know that a muon item at 25 GeV costs 0.7 kHz? Not by running collisions at 2 × 10³⁴. Each toy sample is a few thousand events of one process, and the rate of the process is known independently: $R = \sigma\mathcal L$. Each event then stands for $R/N$ events per second, and the rate of an item is $R$ times the fraction of the sample that passes:

```ts
const PB_CM2 = 1e-36;
/** A rate in Hz: σ [pb] × L [cm⁻² s⁻¹] × efficiency. */
export const rateHz = (sigmaPb: number, lumi_cm2s: number, efficiency: number): number =>
  sigmaPb * PB_CM2 * lumi_cm2s * efficiency;
```

For the minimum-bias and dijet samples, which carry most of the rate, a flat sample would contain almost no events with a high-pT muon, which is exactly where the trigger switches on. They are therefore **stratified** in the scale of the hard scattering: events are generated in several ranges of that scale, each range with its own weight, so that the rare high-scale tail is sampled as well as the bulk. The efficiency and its uncertainty then come from the weights, `weightedEfficiency` (the error is $\sqrt{\sum w^2(p-\varepsilon)^2}/\sum w$), and the number of *effective* events, $(\sum w)^2/\sum w^2$, tells you when a rate is resting on too few events to trust. A prescale of $N$ is applied as an expected probability $1/N$ instead of being simulated event by event, which gives the smooth curve of the figure, not a noisy one, and is the same number on average.
:::

## Where the data go

The 1 GB/s that comes out of the HLT is the start of the data's path. It goes first to the CERN computer centre, then over dedicated links to centres around the world, because no single laboratory could store and process it. In the mid-2000s the four LHC experiments and CERN built a common system for doing so, the :term[Worldwide LHC Computing Grid]{id=wlcg} (WLCG): a network of computing centres arranged in tiers.:cite[wlcgtdr2005] **Tier 0**, at CERN, records the raw data and does a first reconstruction. About a dozen **Tier-1** centres, large national laboratories, keep a second copy, on tape, and reprocess it. More than a hundred **Tier-2** sites, mostly universities, simulate events and serve the physicists who analyse them. Dedicated networks link the top tiers, and a physicist submits a job to the system and does not have to know where it runs. The grid is what lets a student in Lisbon or Seoul analyse the data as if it were local.

```fermi
id: data-volume
title: Raw data per year
prompt: An LHC experiment writes events at 1 kHz, each of about 1 MB. In a year the LHC delivers collisions for roughly 10⁷ seconds. About how much raw data does one experiment record in a year, in bytes?
answer: 1.0e16
unit: bytes
factor: 3
hints:
  - Rate of data = 1000 events/s × 10⁶ bytes = 10⁹ bytes/s. Multiply by the running time.
explain: "10⁹ B/s × 10⁷ s = 10¹⁶ B = 10 PB (petabytes). Two experiments, and the copies on tape and the reconstructed and simulated data as well, which are as big or bigger than the raw data, bring the total into the hundreds of petabytes that the grid has to hold. The estimate is an order of magnitude: the experiments' real numbers differ by a factor of a few in either direction."
```

:::history{year=1989 title="“Vague but exciting”" people="Tim Berners-Lee, Mike Sendall" source="Sources: CERN, 'A short history of the Web'; Berners-Lee (1989)."}
In March 1989 Tim Berners-Lee, a software engineer working at CERN, wrote a short document called *Information Management: A Proposal*.:cite[bernerslee1989] CERN's experiments were run by collaborations of hundreds of people from universities in many countries, on many different kinds of computer, and information about how things worked was lost whenever someone left. Berners-Lee proposed linking documents on different machines with hypertext, in a system that anyone could add to. His supervisor, Mike Sendall, wrote on the front of the proposal the words that have become famous: "Vague but exciting".:cite[cernweb] He went on to build it: in 1990 he wrote the first browser and server, on a NeXT computer at CERN.:cite[cernweb] In April 1993 CERN made the underlying technology free for anyone to use.:cite[cernweb]

The Web, then, was a by-product of the same problem this chapter describes: a large collaboration that needed to share information across many computer systems. It was also the first of the tools built at CERN for that purpose. The grid, a decade later, extended the same idea from documents to computing.
:::

:::history{year=1995 title="ROOT, from the Fortran tools to C++" people="René Brun, Fons Rademakers" source="Source: Brun and Rademakers (1997)."}
By the mid-1990s the data-analysis tools of particle physics were written in Fortran, the most used being PAW, the Physics Analysis Workstation. At CERN, René Brun and Fons Rademakers started a replacement in C++ for the much larger data of the LHC, and in 1996 presented it at a computing conference as **ROOT**.:cite[brun1997] ROOT provides what an analysis needs: storage for events in files with columns that can be read separately, histograms, fits, plots, and an interpreter for interactive work. Both ATLAS and CMS store their data in ROOT files, and so do the open-data samples of the LHC experiments. In this course the `hep/analysis` module plays the role that ROOT plays in the experiments, for a much smaller set of tasks.
:::

:::history{year=2005 title="A computing grid for the LHC" people="The LHC experiments and CERN" source="Source: LHC Computing Grid Technical Design Report (2005)."}
No single centre could store or process the data of the LHC. In the early 2000s CERN and the experiments began the LHC Computing Grid project, and its Technical Design Report of June 2005 describes the tiered architecture that became the WLCG: a Tier-0 at CERN, Tier-1 centres with tape storage, and Tier-2 centres for simulation and analysis.:cite[wlcgtdr2005] The need was plain from the numbers of this chapter: the data would come at a gigabyte a second for the lifetime of the machine, from experiments whose members work in dozens of countries.
:::

:::experiments
**ATLAS** and **CMS** both use a two-level trigger, with small differences. In both, Level 1 is custom electronics fed by coarse calorimeter and muon-detector data, with a fixed latency of a few microseconds and an output of up to 100 kHz in Run 2; the HLT is software on a computer farm, with an output of the order of 1 kHz.:cite[cmstrigger2017,atlastrigger2017] (Earlier, ATLAS had three levels: its current design merged the last two in a single HLT.) The menu of each has hundreds of items, grouped into **streams**: a physics stream, and others for calibration and monitoring. Both experiments also keep some events in a reduced format, a few kilobytes, that allow a much higher rate within the same bandwidth: a trade in which information is given up for statistics. The trigger emulation of `hep/trigger` does what the experiments' **trigger emulators** do: it runs the decision logic on simulated events, so that menus can be designed and rates estimated before the collisions happen. The experiments' rates are measured during data-taking with **zero-bias** events, triggered only on the bunch crossing itself, which gives an unbiased sample of what the detector sees. The toy samples in this course's trigger game are much simpler: a few thousand events per process, with no pile-up.
:::

## You write: a Level-1 algorithm

The Level-1 logic of the library is a function that takes the coarse input of one crossing and a set of thresholds, and returns the names of the items that fired. Write it. Its reference implementation is in `hep/trigger`; yours will replace it in the pipeline's trigger stage when it passes its tests, and **use my code** will run it on the trigger game's samples.

```code
id: l1-algorithm
title: A Level-1 trigger
hook: trigger.l1Decision
prompt: |
  Implement `l1Decision(ev, thresholds)`. The input `ev` has two lists: `towers`, calorimeter towers `{ eta, phi, et }`, and
  `muonStubs`, `{ eta, phi, pt }`. `thresholds` maps an item name to its threshold in GeV, and the function returns the names of the items that fired.
  An item name such as `DoubleMu_Low` is the kind `DoubleMu` (the part before the underscore) with its own threshold. The kinds and their variables are:

  - `SingleMu`: the largest stub `pt` among stubs with |η| < 2.4. `DoubleMu`: the second largest (both stubs must reach the threshold).
  - `MET`: the magnitude of the vector sum of all towers' transverse energy, `√((Σ et cos φ)² + (Σ et sin φ)²)`.
  - `SingleEG` and `DoubleEG`: the `et` of the hardest and second hardest **electron/photon candidates**, found like this. Put the towers on the grid with `iEta = towerIEta(eta)` and `iPhi = towerIPhi(phi)` (φ wraps round at 64 cells), adding towers that fall in the same cell. Take the cells in order of decreasing energy (ties: smaller `iEta` first, then smaller `iPhi`). A cell is skipped if its energy is below 2 GeV (and so are all the later ones) or if it has already been used. Otherwise sum the 3 × 3 cells around it (`sum3`), find the highest of its eight neighbours (`best`), and mark all nine cells as used whether or not it becomes a candidate. It is a candidate, with `et = seed + best`, when `seed + best ≥ 0.85 × sum3`: a narrow shower, unlike a jet.
  - `SingleJet`, `DoubleJet` and `HT` are given: use the library's `l1Jets` (jets of 5 × 5 towers) as in the starter.

  An item fires when its variable is greater than 0 **and** at least its threshold. Items absent from `thresholds` are not evaluated.
starter: |
  import type { Level1Input } from 'hep/trigger';
  import { l1Jets, towerIEta, towerIPhi } from 'hep/trigger';

  const PHI_CELLS = 64;
  const wrap = (i: number) => ((i % PHI_CELLS) + PHI_CELLS) % PHI_CELLS;

  /** The second-largest, etc.: muon stub pT, largest first, inside |η| < 2.4. */
  function muonPts(ev: Level1Input): number[] {
    return []; // TODO
  }

  /** The transverse energy of the electron/photon candidates, hardest first. */
  function egEts(ev: Level1Input): number[] {
    return []; // TODO: grid, seed, 3 × 3 sum, narrowness
  }

  /** Missing transverse energy from the towers. */
  function met(ev: Level1Input): number {
    return 0; // TODO
  }

  export function l1Decision(ev: Level1Input, thresholds: Record<string, number>): string[] {
    const mu = muonPts(ev);
    const eg = egEts(ev);
    const jets = l1Jets(ev.towers);
    let ht = 0;
    for (const j of jets) if (j.et >= 30 && Math.abs(j.eta) < 2.4) ht += j.et;
    const variable: Record<string, number> = {
      SingleMu: mu[0] ?? 0,
      DoubleMu: mu[1] ?? 0,
      SingleEG: eg[0] ?? 0,
      DoubleEG: eg[1] ?? 0,
      SingleJet: jets[0]?.et ?? 0,
      DoubleJet: jets[1]?.et ?? 0,
      HT: ht,
      MET: met(ev),
    };
    const fired: string[] = [];
    for (const [name, thr] of Object.entries(thresholds)) {
      const x = variable[name.split('_')[0]!];
      if (x !== undefined && x > 0 && x >= thr) fired.push(name);
    }
    return fired;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { l1Decision } from 'solution';
  import { referenceL1Decision, towerEta, towerPhi } from 'hep/trigger';
  import { rng } from 'hep/random';

  const tower = (iEta: number, iPhi: number, et: number) => ({ eta: towerEta(iEta), phi: towerPhi(iPhi), et });
  const stub = (pt: number, eta = 0.3) => ({ eta, phi: 0.2, pt });
  const fire = (ev: any, thr: Record<string, number>) => [...l1Decision(ev, thr)].sort();

  test('SingleMu uses the hardest stub and DoubleMu the second hardest', () => {
    const ev = { towers: [], muonStubs: [stub(12), stub(30), stub(5)] };
    expect(fire(ev, { SingleMu: 25, DoubleMu: 10 })).toEqual(['DoubleMu', 'SingleMu']);
    expect(fire(ev, { SingleMu: 25, DoubleMu: 13 })).toEqual(['SingleMu']);
    expect(fire(ev, { SingleMu: 35 })).toEqual([]);
  });

  test('the muon system ends at |η| = 2.4', () => {
    expect(fire({ towers: [], muonStubs: [stub(40, 2.5)] }, { SingleMu: 20 })).toEqual([]);
    expect(fire({ towers: [], muonStubs: [stub(40, -2.39)] }, { SingleMu: 20 })).toEqual(['SingleMu']);
  });

  test('a threshold is inclusive, an empty event fires nothing, and a suffix names the same kind', () => {
    expect(fire({ towers: [], muonStubs: [stub(20)] }, { SingleMu: 20 })).toEqual(['SingleMu']);
    expect(fire({ towers: [], muonStubs: [] }, { SingleMu: 0, MET: 0, SingleEG: 0 })).toEqual([]);
    expect(fire({ towers: [], muonStubs: [stub(9), stub(7)] }, { DoubleMu_Low: 6, DoubleMu: 8 })).toEqual(['DoubleMu_Low']);
  });

  test('MET is the vector sum: one tower gives its own ET, two opposite towers cancel', () => {
    const one = { towers: [{ eta: 0.5, phi: 1.0, et: 40 }], muonStubs: [] };
    expect(fire(one, { MET: 39.9 })).toEqual(['MET']);
    expect(fire(one, { MET: 40.1 })).toEqual([]);
    const two = { towers: [{ eta: 0.5, phi: 1.0, et: 40 }, { eta: -0.5, phi: 1.0 - Math.PI, et: 40 }], muonStubs: [] };
    expect(fire(two, { MET: 1 })).toEqual([]);
  });

  test('an electron or photon is a narrow shower; a jet is not', () => {
    const narrow = [tower(3, 10, 20), tower(4, 10, 4), tower(3, 11, 1), tower(2, 9, 1)];
    expect(fire({ towers: narrow, muonStubs: [] }, { SingleEG: 23 })).toEqual(['SingleEG']);
    expect(fire({ towers: narrow, muonStubs: [] }, { SingleEG: 25 })).toEqual([]);
    const wide: ReturnType<typeof tower>[] = [];
    for (let de = -1; de <= 1; de++) for (let dp = -1; dp <= 1; dp++) wide.push(tower(3 + de, 10 + dp, de === 0 && dp === 0 ? 10 : 5));
    expect(fire({ towers: wide, muonStubs: [] }, { SingleEG: 5 })).toEqual([]);
  });

  test('towers that share a cell are added before anything else is decided', () => {
    const t = [tower(3, 10, 10), tower(3, 10, 12), tower(4, 10, 0.5)];
    expect(fire({ towers: t, muonStubs: [] }, { SingleEG: 22.5 })).toEqual(['SingleEG']);
    expect(fire({ towers: t, muonStubs: [] }, { SingleEG: 23 })).toEqual([]);
  });

  test('DoubleEG uses the second candidate, which is found only after the first 3 × 3 block has been used up', () => {
    const t = [tower(-10, 30, 30), tower(-9, 30, 3), tower(10, 40, 15), tower(11, 40, 3)];
    expect(fire({ towers: t, muonStubs: [] }, { SingleEG: 33, DoubleEG: 18 })).toEqual(['DoubleEG', 'SingleEG']);
    expect(fire({ towers: t, muonStubs: [] }, { DoubleEG: 19 })).toEqual([]);
  });

  test('φ wraps round: the neighbours of cell 0 include cell 63', () => {
    const t = [tower(2, 0, 20), tower(2, 63, 10), tower(2, 1, 10)];
    // seed 20 + best 10 = 30 < 0.85 × 40: not narrow. Without the wrap, cell 63 would be left out and the cluster would pass.
    expect(fire({ towers: t, muonStubs: [] }, { SingleEG: 25 })).toEqual([]);
  });

  test('jets use the library and HT sums the jets above 30 GeV', () => {
    const t: ReturnType<typeof tower>[] = [];
    for (let de = -2; de <= 2; de++) for (let dp = -2; dp <= 2; dp++) t.push(tower(5 + de, 20 + dp, de === 0 && dp === 0 ? 12 : 6));
    expect(fire({ towers: t, muonStubs: [] }, { SingleJet: 100, DoubleJet: 10, HT: 140, MET: 500 })).toEqual(['HT', 'SingleJet']);
  });

  test('it agrees with the reference trigger on 200 random crossings', () => {
    const r = rng(11);
    const thr = { SingleMu: 12, DoubleMu: 6, DoubleMu_Low: 4, SingleEG: 12, DoubleEG: 8, SingleJet: 40, DoubleJet: 30, HT: 100, MET: 20 };
    let busy = 0;
    for (let k = 0; k < 200; k++) {
      const towers: { eta: number; phi: number; et: number }[] = [];
      const nSoft = 5 + Math.floor(r() * 35);
      for (let i = 0; i < nSoft; i++) towers.push({ eta: (r() * 2 - 1) * 2.6, phi: (r() * 2 - 1) * Math.PI, et: 0.5 * Math.ceil(-Math.log(1 - r()) * 6) });
      const nNarrow = Math.floor(r() * 3);
      for (let i = 0; i < nNarrow; i++) {
        const ie = Math.floor((r() * 2 - 1) * 24), ip = Math.floor(r() * 64), seed = 0.5 * Math.ceil(r() * 100);
        towers.push(tower(ie, ip, seed), tower(ie + (r() < 0.5 ? 1 : -1), ip, 0.5 * Math.ceil(seed * 0.2)));
      }
      const muonStubs = Array.from({ length: Math.floor(r() * 4) }, () => ({ eta: (r() * 2 - 1) * 2.6, phi: (r() * 2 - 1) * Math.PI, pt: 0.5 * Math.ceil(r() * 70) }));
      const ev = { towers, muonStubs };
      const want = [...referenceL1Decision(ev, thr)].sort();
      if (want.length) busy++;
      expect(fire(ev, thr)).toEqual(want);
    }
    expect(busy).toBeGreaterThan(100);
  });
solution: |
  import type { Level1Input } from 'hep/trigger';
  import { l1Jets, towerIEta, towerIPhi } from 'hep/trigger';

  const PHI_CELLS = 64;
  const wrap = (i: number) => ((i % PHI_CELLS) + PHI_CELLS) % PHI_CELLS;

  function muonPts(ev: Level1Input): number[] {
    return ev.muonStubs.filter((m) => Math.abs(m.eta) < 2.4).map((m) => m.pt).sort((a, b) => b - a);
  }

  function egEts(ev: Level1Input): number[] {
    // 1. put the towers on the grid, adding those that share a cell
    const grid = new Map<string, { iEta: number; iPhi: number; et: number }>();
    const key = (ie: number, ip: number) => `${ie},${ip}`;
    for (const t of ev.towers) {
      const ie = towerIEta(t.eta);
      const ip = towerIPhi(t.phi);
      const c = grid.get(key(ie, ip));
      if (c) c.et += t.et;
      else grid.set(key(ie, ip), { iEta: ie, iPhi: ip, et: t.et });
    }
    const at = (ie: number, ip: number) => grid.get(key(ie, wrap(ip)))?.et ?? 0;
    // 2. hottest first; ties by position
    const cells = [...grid.values()].sort((a, b) => b.et - a.et || a.iEta - b.iEta || a.iPhi - b.iPhi);
    const used = new Set<string>();
    const out: number[] = [];
    for (const c of cells) {
      if (c.et < 2) break;
      if (used.has(key(c.iEta, c.iPhi))) continue;
      let sum3 = 0;
      let best = 0;
      for (let de = -1; de <= 1; de++) {
        for (let dp = -1; dp <= 1; dp++) {
          const v = at(c.iEta + de, c.iPhi + dp);
          sum3 += v;
          if ((de !== 0 || dp !== 0) && v > best) best = v;
          used.add(key(c.iEta + de, wrap(c.iPhi + dp)));
        }
      }
      const pair = c.et + best;
      if (pair >= 0.85 * sum3) out.push(pair);
    }
    return out.sort((a, b) => b - a);
  }

  function met(ev: Level1Input): number {
    let x = 0;
    let y = 0;
    for (const t of ev.towers) {
      x -= t.et * Math.cos(t.phi);
      y -= t.et * Math.sin(t.phi);
    }
    return Math.hypot(x, y);
  }

  export function l1Decision(ev: Level1Input, thresholds: Record<string, number>): string[] {
    const mu = muonPts(ev);
    const eg = egEts(ev);
    const jets = l1Jets(ev.towers);
    let ht = 0;
    for (const j of jets) if (j.et >= 30 && Math.abs(j.eta) < 2.4) ht += j.et;
    const variable: Record<string, number> = {
      SingleMu: mu[0] ?? 0,
      DoubleMu: mu[1] ?? 0,
      SingleEG: eg[0] ?? 0,
      DoubleEG: eg[1] ?? 0,
      SingleJet: jets[0]?.et ?? 0,
      DoubleJet: jets[1]?.et ?? 0,
      HT: ht,
      MET: met(ev),
    };
    const fired: string[] = [];
    for (const [name, thr] of Object.entries(thresholds)) {
      const x = variable[name.split('_')[0]!];
      if (x !== undefined && x > 0 && x >= thr) fired.push(name);
    }
    return fired;
  }
hints:
  - 'Muons are the easy part: filter by |η|, sort, and read the first and second entries. Do that first and check it against the tests.'
  - 'For the candidates, a `Map` from a string key such as `"iEta,iPhi"` to the summed energy is enough. Wrap φ with `((i % 64) + 64) % 64`, including for the cells of the 3 × 3 block that you mark as used.'
  - 'The electron/photon search must mark the whole 3 × 3 block as used even when the seed does not become a candidate: that is how a wide jet avoids producing a string of fake candidates.'
```

:::tip
Once it passes, your function can replace the reference in the pipeline's trigger stage. The reference and your function should then give the same rate to the last digit, because the tests demand identical decisions. A function that gives different decisions but plausible rates is a worse outcome than one that fails, since nothing flags it. It is the failure mode of every trigger change.
:::

## What comes next

The trigger has kept a thousand events a second and the grid has stored them. The next problem is to tell whether a few hundred of them are a particle, or a fluctuation of the ones that surround them. [Chapter 28](/chapters/the-statistics-of-discovery/) builds the tools: Poisson counting, likelihoods, fits, p-values and the meaning of five standard deviations. [Chapter 29](/chapters/finding-the-higgs/) then puts the whole of the pipeline, machine, generator, detector, reconstruction, trigger and analysis, to work on the Higgs boson.

## Further reading

- The CMS and ATLAS trigger papers for the real systems: *The CMS trigger system*, and *Performance of the ATLAS trigger system in 2015* (:cite[cmstrigger2017,atlastrigger2017]).
- The LHC Computing Grid Technical Design Report (:cite[wlcgtdr2005]).
- CERN's own short history of the Web (:cite[cernweb]), and Berners-Lee's 1989 proposal (:cite[bernerslee1989]).
- Brun and Rademakers on ROOT (:cite[brun1997]).
