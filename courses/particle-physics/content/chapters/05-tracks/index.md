---
number: 5
title: Tracks
summary: Charged particles leave lines of ionisation, and a magnetic field bends those lines. The radius of the bend gives the momentum, the direction of the bend gives the sign of the charge, and the thickness of the line says how fast the particle is. How well the radius can be measured sets how well the momentum is known.
duration: About 2½ hours
prerequisites: [relativity-for-particles]
---

Nobody has ever seen a particle. What can be seen is what a charged particle does to the matter it crosses: it knocks electrons off atoms along its path, and if the matter is prepared the right way, each of those disturbed atoms grows into something large enough to photograph. The result is a line, a *track*, and almost everything an experimenter knows about a particle in Part II of this course comes from reading one. The box below is a simulated cloud chamber, a few hundred millimetres across, in which particles arrive at random. Watch for a minute before reading on. Some tracks are short, straight and dense, some long, thin and straight, and some thin and twisted. By the end of the chapter you will be able to say what each one is, from the picture alone.

::cloud-chamber{n="5.1" source="mixed" caption="A simulated diffusion cloud chamber (air and alcohol vapour), seen from the side, with no magnetic field. Droplets form along the path of each charged particle and fade after a couple of seconds. The default source is a mixture; the buttons select alpha particles (helium nuclei from radioactive decay), beta particles (electrons from radioactive decay) or cosmic-ray muons alone. Click a track for its measured length and ionisation. Raise the field and watch the paths bend. The tracks are computed by the course's chamber model (hep/chamber); the droplets are drawn, not simulated one by one."}

## What a particle leaves behind

A charged particle passing through a gas interacts with the atoms it passes. Most of these interactions are tiny electrical kicks that strip an electron from an atom, leaving a free electron and a positive ion: an **ion pair**. The particle loses a little energy each time and hardly changes direction. The mean energy lost per unit length is called $dE/dx$ (Chapter 6 derives it); for now, treat it as a number that depends on the particle's charge and speed, and on the material.

It is also small enough that a fast particle is not stopped by a thin layer of gas. For a particle of the kind that loses the least (*minimum ionising*, a term Chapter 6 explains), air at sea level takes about 1.8 MeV for every gram per square centimetre it crosses.:cite[pdg2024] Air has a density of 1.2 × 10⁻³ g/cm³, so that is about 2.2 keV per centimetre. Creating an ion pair in air takes, on average, about 34 eV.:cite[pdg2024] Divide one by the other and a minimum-ionising particle leaves roughly 60 ion pairs in every centimetre it crosses.

```fermi
id: ion-pairs
title: Ion pairs along a track
prompt: A minimum-ionising particle loses about 1.8 MeV for each g/cm² of air it crosses. Air has a density of 1.2 × 10⁻³ g/cm³ and, on average, 34 eV are spent for each ion pair created. About how many ion pairs does such a particle leave along a track 10 cm long?
answer: 640
factor: 3
hints:
  - The mass of air crossed is density × length, in g/cm².
  - Multiply by the loss per g/cm² to get the energy lost, then divide by the energy per pair.
explain: "10 cm of air is 10 × 1.2 × 10⁻³ = 0.012 g/cm². The particle loses 1.8 MeV × 0.012 = 21.6 keV, and 21.6 keV / 34 eV ≈ 640 pairs. A few hundred ion pairs spread over 10 cm is a faint trail: each pair is a single electron and a single atom's worth of charge. That is why a detector must either amplify the signal (Chapter 7's wire and silicon detectors) or grow something visible around each pair (this chapter's chambers)."
```

A cloud chamber does the second. Its gas is saturated with the vapour of a liquid (in the chamber above, alcohol) and then made *supersaturated*, so that the vapour is ready to condense but has nothing to condense onto. The ions left by a passing particle are something to condense onto, and a string of tiny droplets appears along the path, bright against a dark background for a second or two. In the chamber of Figure 5.1 the supersaturation is kept up continuously by a temperature gradient, which is how the dry-ice chamber of [Appendix G](/appendix/build-it-for-real/) works.

:::history{year=1911 title="Wilson makes the paths visible" people="C. T. R. Wilson" source="Sources: Wilson (1911), Proc. R. Soc. A 85, 285; Nobel Prize in Physics 1927."}
Charles Thomson Rees Wilson, at the Cavendish Laboratory in Cambridge, had been studying how clouds form. In a paper published in 1911 he described a method by which "the tracks of individual α- or β-particles, or of ionising rays of any kind, through a moist gas" could be made visible, by letting the gas expand so that water condensed on the ions the particles had left.:cite[wilson1911] Wilson's chamber expanded suddenly, so that it was sensitive for a moment and had to be reset after each picture. The diffusion chamber in Figure 5.1, and the one in Appendix G, stay sensitive continuously, which is easier to build and the reason it is the version a person can make at home.

The cloud chamber gave physics its first photographs of individual particles, and for about four decades it was the principal instrument for discovering new ones. Wilson shared the 1927 Nobel Prize in Physics for it.:cite[nobel-wilson]
:::

## Four kinds of track

Return to Figure 5.1, set the source to *alpha*, then *beta*, then *muon*, and look at what each does.

- **An alpha particle** (a helium nucleus, charge +2, about 7,300 times the electron's mass) from a radioactive decay has a few MeV of energy. Its charge is twice the electron's, and the energy it loses goes as the square of the charge, so it ionises about four times as densely as a singly charged particle of the same speed; at the slow speed at which these alphas move, much more. The track is thick, straight and short: 5 MeV alphas stop in about 4 cm of air. Every alpha from one radioactive nucleus has the same energy, so every track from that source has the same length.
- **A beta particle** (an electron from the decay of a nucleus) is light, so it is easily knocked off course by the atoms it passes. Its track is thin and wandering, a sequence of short straight segments. Its energy is shared with a neutrino (Chapter 22), so its range varies from one track to the next.
- **A cosmic-ray muon** (Chapter 10) arrives from the sky with an energy of order a GeV. It is 207 times as heavy as an electron, so it scatters much less, and it is fast enough to be near the minimum of $dE/dx$: a long, thin, straight track, crossing the whole chamber.
- **Something with a branch.** Now and then an electron is knocked out of an atom with enough energy to leave a short track of its own, a *delta ray*, and sometimes a particle's track ends in a kink where it decayed. The chamber model includes both.

Two lessons. First, **the density of droplets along a track measures $dE/dx$**, which depends on the particle's charge and speed but (to first approximation) not on its energy or momentum directly. Second, **length is information too**: a particle that stops in the chamber has a range, and range depends on the particle's energy and kind. Together they let you tell an alpha from a proton, which look alike in every other way except the thickness of the line. We return to this when we measure tracks below.

## Bending in a magnetic field

Put the chamber in a magnetic field. A particle of charge $q$ moving at velocity $\vec v$ in a field $\vec B$ feels the force $\vec F = q\,\vec v\times\vec B$, which is perpendicular to both, so it changes the direction of the velocity but not its size. The magnetic force does no work: the particle's speed and energy stay the same. If the velocity is perpendicular to the field, the path is a circle, and that is the case that matters most because the detectors in this course have fields along the beam, and what the tracker sees is the motion in the plane *transverse* to the beam (Chapter 2).

Set the force equal to the mass times the centripetal acceleration. With the relativistic momentum $p = \gamma m v$ in place of $mv$ (the force law holds in that form; Chapter 2), a circle of radius $R$ requires $q v B = p v/R$, so $p = qBR$. In SI units that is a momentum in kg m/s. Particle physicists want GeV/c. One GeV/c is $10^9 e/c$ kg m/s, so dividing $p = q B R$ by it gives a convenient form:

:::equation{#p-bend caption="The momentum of a charged particle from the radius of its circle in a magnetic field. For a unit charge, p (in GeV/c) is 0.3 times B (in tesla) times R (in metres)."}
$$\term{pT}{p_T} = 0.2998\;\term{q}{|q|}\;\term{B}{B}\;\term{R}{R}\qquad [\,p_T\text{ in GeV/}c,\; B\text{ in T},\; R\text{ in m}\,]$$

```terms
pT:
  label: 'pT, the transverse momentum'
  what: The part of the momentum perpendicular to the field (for a detector with its field along the beam, perpendicular to the beam). It is what sets the radius of the circle in the transverse plane.
  why: A particle moving partly along the field feels no force from that part of its motion, so it spirals, and only the perpendicular part goes round. The full momentum is p = pT / cos λ, where λ is the angle between the track and the plane of the circle.
  effect: Double the transverse momentum and the circle's radius doubles.
q:
  label: '|q|, the charge'
  what: The size of the particle's charge in units of the proton's charge e. An electron, muon or proton has 1; an alpha particle 2.
  why: The magnetic force is proportional to the charge, so a more highly charged particle of the same momentum bends more, in a smaller circle.
  effect: At the same momentum an alpha particle's circle is half as big as a proton's.
B:
  label: 'B, the magnetic field'
  what: The strength of the field in tesla. The field of the CMS detector at the LHC is 3.8 T; a strong laboratory electromagnet is 1–2 T; the Earth's field is about 50 microtesla.
  why: The force grows in proportion to the field.
  effect: Doubling the field halves the radius of a given track.
R:
  label: 'R, the radius of curvature'
  what: The radius of the circle in the transverse plane, in metres. It is measured from three or more points on the track.
  why: It is the quantity the detector actually measures. Everything else in the formula is known.
  effect: A nearly straight track has a huge radius, and then small errors in the points make a large relative error in R (see the last section).
```
:::

The constant is $e c/(10^9\ \mathrm{V}) = 0.299\,792\,458$ if $p$ is in GeV/*c*, $B$ in T and $R$ in m: the speed of light in units of $10^9$ m/s. The library has it as `CURVATURE_CONSTANT` (`hep/detector`), and Chapter 20 will use the same formula for the LHC's own magnets, where the radius is fixed by the tunnel (about 2.8 km) and the momentum is 6.8 TeV, so that the field needed is 8 T. That sentence is the subject of Part V. For now, the same formula serves the opposite purpose: the field is known, the radius is measured, and the momentum is what is wanted.

A few numbers to hold in mind. A particle with $p_T = 1$ GeV/*c* in a 1 T field has a radius of 3.3 m. In the 3.8 T field of a detector like CMS, a track of 100 GeV/*c* has a radius of 88 m. The detector is about a metre across, so the track is a tiny arc of an enormous circle, nearly a straight line. Its bend is measured by the **sagitta** $s$, the distance from the middle of the arc to the straight line joining its ends. For a chord of length $L$ much shorter than $R$, geometry gives $s \approx L^2/(8R)$, and with $R$ from the formula above,

$$ s \;\approx\; \frac{0.3\,B\,L^2}{8\,p_T}\qquad [\text{m; } B \text{ in T, } L \text{ in m, } p_T \text{ in GeV/}c]. $$

With $L = 1$ m, $B = 2$ T and $p_T = 100$ GeV/*c*, the sagitta is 0.75 mm; at 1 GeV/*c* it is 75 mm. The whole art of momentum measurement at high energy is to measure a sub-millimetre deviation to a few percent, and Figure 5.2 lets you watch the sagitta shrink as the momentum rises.

::bending-lab{n="5.2" caption="A positive or negative particle enters a region of uniform field from the left. The circle's radius follows p = 0.3 |q| B R. The sagitta over a 1 m chord is computed exactly and from the approximation 0.3 |q| B L²/8p: they agree wherever the track is nearly straight and differ where it is not. Reverse the charge, or the field, and the bend reverses."}

```predict
q: 'A positively charged particle moves to the right across the page. A magnetic field points into the page (away from you). Which way does the particle bend?'
options:
  - text: Upwards, towards the top of the page.
    correct: true
    why: 'The force is q v × B. Take x to the right, y up and z out of the page, so that B points along −z. Then v × B = x̂ × (−ẑ) = +ŷ, and for a positive charge the force is along +y: up. The bend is anticlockwise. Reverse either the charge or the field and it bends down; reverse both and it bends up again. (A common slip is to bend the particle along the field or against the velocity: the force is perpendicular to both.)'
  - text: Downwards, towards the bottom of the page.
    why: 'That would be the answer for a negative particle, or for a field out of the page. Work it out from F = q v × B: x̂ × (−ẑ) = +ŷ.'
  - text: It does not bend, because the field is perpendicular to the page and the motion is in the page.
    why: 'The force is largest when the velocity is perpendicular to the field, which is exactly this case. A particle moving along the field would feel no force.'
```

```numeric
id: sagitta-cms
title: The sagitta of a stiff track
prompt: 'A track of transverse momentum 100 GeV/c crosses a tracker in a field of 3.8 T. What is the sagitta, in millimetres, of the arc over a chord of 1.1 m? (Use s = 0.3 B L²/(8 pT), and keep the units consistent: metres, tesla, GeV/c.)'
answer: 1.72
unit: mm
tolerance: 0.02
hints:
  - B = 3.8, L = 1.1, pT = 100. The result of the formula is in metres.
explain: "s = 0.2998 × 3.8 × 1.1² / (8 × 100) = 1.378 / 800 = 1.72 × 10⁻³ m = 1.72 mm. To measure the momentum of this track to 1 % the detector has to measure that sagitta to 17 micrometres, about the thickness of a fifth of a human hair, with several points spread over a metre."
```

### Weighing the electron

The same force law gave the first measurement of a fundamental particle's properties. A beam of charged particles crossing an electric field $E$ and a magnetic field $B$ at right angles is deflected by both. If the two are adjusted until the beam goes straight, the electric and magnetic forces balance, $qE = qvB$, and so the speed is $v = E/B$ whatever the charge and mass. With the electric field switched off, the magnetic field alone bends the beam along a circle of radius $R = mv/(qB)$, and therefore $q/m = v/(BR) = E/(B^2 R)$. Only the ratio of charge to mass appears, because the force is proportional to the first and the acceleration it causes inversely proportional to the second; a measurement of the path cannot separate them.

:::history{year=1897 title="The cathode-ray particle" people="J. J. Thomson" source="Sources: Thomson (1897), Philosophical Magazine 44, 293."}
In 1897 J. J. Thomson, working in the Cavendish Laboratory, published measurements of the ratio of mass to charge of the rays that come from the negative electrode of a discharge tube, by deflecting them in electric and magnetic fields.:cite[thomson1897] He found the same value whatever the gas in the tube and whatever the metal of the electrode, and it was about a thousand times smaller than the value for the hydrogen ion in electrolysis, the lightest charged particle known until then. In the units of the day the two numbers were of order $10^{-7}$ and $10^{-4}$; the modern values are $5.7\times 10^{-8}$ and $1.0\times 10^{-4}$, in grams per electromagnetic unit of charge. Thomson concluded that the rays were made of particles far lighter than any atom, which he called *corpuscles*, and that they were a constituent of all matter: a particle smaller than an atom, the first.

It is the same measurement as the tracks of this chapter: a charged particle, a field, and a radius. Thomson measured a ratio and could not say how large the charge was on its own; the charge of the electron was measured separately, later.
:::

::thomson-balance{n="5.3" caption="A cathode-ray tube in the manner of Thomson's experiment (an idealisation: Thomson's rays came from a discharge, and he determined their speed from the balance alone, without an accelerating voltage). Set the electric field, then adjust the magnetic field until the spot returns to the centre of the screen: then v = E/B. With the accelerating voltage known, e/m = v²/2V. Reveal the true value to see how close the reading is."}

## Reading a track

A track in a magnetic field carries several pieces of information, and the skill is to read them off in the right order.

1. **Sign of the charge.** The track curves one way or the other. If you know the direction of the field and the direction of motion, the sense of the curvature gives the sign. The direction of motion is usually obvious (the particle came from the source), and when it is not, we need a second clue.
2. **Momentum.** The radius gives the transverse momentum, $p_T = 0.3\,|q|\,B\,R$. For a track that also moves along the field the radius of the circle in the transverse plane is what counts, and the total momentum is larger by the dip angle.
3. **Ionisation** tells us how fast the particle is. A heavy particle at a given momentum is slower than a light one, and $dE/dx$ rises steeply at low speed. So the combination of *momentum from the curvature* and *speed from the ionisation* fixes the mass, and the mass names the particle (Chapter 9 uses exactly this).
4. **Range and scattering** give a second, independent handle on momentum and mass.

A trick makes the direction of motion clear. Insert a thin plate of metal in the chamber. A particle that crosses it loses energy, so its momentum is smaller after the plate than before, and its radius of curvature is smaller: the track is more sharply curved on the far side. The curve is tighter on the side the particle went *to*.

:::history{year=1932 title="A plate across the chamber" people="Carl D. Anderson" source="Source: Anderson (1933), Physical Review 43, 491."}
Carl Anderson at Caltech placed a cloud chamber in a magnetic field of about 15,000 gauss (1.5 T) and across its middle a 6 mm plate of lead, exactly to settle the direction of motion of cosmic-ray particles from the curvature on either side of the plate.:cite[chambers-anderson1933] Figure 5.4 is a simulated exposure of Anderson's apparatus. The question he faced, and the one posed to the reader by the widget, is: what were the direction of travel and the sign of the charge, and what kind of particle leaves this track? The second half of that question was not answered by the picture alone, and its answer is one of the great surprises of the century. It is the subject of Chapter 9; here, practise the measurement.
:::

::cloud-chamber{n="5.4" preset="anderson" caption="A re-simulation of an Anderson-style exposure: a chamber in a 1.5 T field with a 6 mm lead plate across it, and particles arriving from the cosmic rays. Use the scanning tools to measure the radius above and below the plate, and follow the guided reading. The widget reveals what each particle was only after you have committed to an answer; Chapter 9 explains why it mattered. The first exposure uses the momenta Anderson reported; the later ones are random."}

### Measure it yourself

The scanning table below is the same instrument on which physicists once measured film. Three tools: a **ruler** for lengths, a **three-point circle** that fits a circle through three points you click (and so gives a radius, and from it a momentum through $p_T = 0.3\,B\,R$), and an **angle** tool. Field, scale and sign conventions are printed beside the picture. Try it on the tracks labelled A, B and C, then answer the two exercises that follow.

::scan-table{n="5.5" preset="cloud:alpha,mu-,e+" seed=3 caption="A simulated picture with three labelled tracks in a 1 T field. Measure with the tools, then compare your numbers with the simulation's true values. Scale: the table shows millimetres on the chamber."}

```scan
id: scan-momentum
title: Measure the momentum and charge
prompt: 'In the picture above the field is 1 T. Use the circle tool on track B to measure its transverse momentum (GeV/c), and on track C to find its radius of curvature (mm) and the sign of its charge. Then use the ruler to measure the length of the alpha track A. A field pointing out of the page makes a positive charge turn clockwise. Tolerance: 15 %.'
config:
  preset: 'cloud:alpha,mu-,e+'
  seed: 3
answers:
  momentum: { track: B }
  radius: { track: C }
  charge: { track: C }
  length: { track: A }
tolerance: 0.15
hints:
  - A circle through three well-spaced points on the track gives the radius. Use p = 0.3 B R with R in metres.
  - 'Track C bends much more tightly than track B: a smaller radius means a smaller momentum.'
explain: The momentum of track B follows from its radius of about half a metre, 0.3 × 1 T × 0.53 m ≈ 0.16 GeV/c. Track C, a positron, curls in a radius of about 4 cm, which is only 13 MeV/c. The alpha track is about 4 cm long, as the range of a 5 MeV alpha particle in air should be.
```

```identify
id: identify-tracks
title: Name the particles
prompt: 'Three tracks, in a field of 1 T. Use their ionisation (how dense the droplets are), their length and their curvature to decide what each one is. Remember: a proton at this momentum is slow and ionises heavily; an electron is light and scatters; a muon goes straight through. The feedback names the clue each track gave.'
event:
  preset: cloud
  seed: 5
answers: [p, e-, mu+]
config:
  field: 1
```

## Bubble chambers

A cloud chamber is a gas, and a gas is a poor target: there is little matter in it for a particle to hit. For a physicist who wants particles to *collide* with nuclei, a dense target that also shows the tracks is worth a great deal. In 1952 Donald Glaser, at the University of Michigan, showed that a liquid held just above its boiling point, in a state in which it is ready to boil but has nothing to start the bubbles, would boil along the path of an ionising particle.:cite[glaser1952]

:::history{year=1952 title="Boiling along a track" people="Donald A. Glaser" source="Sources: Glaser (1952), Physical Review 87, 665; Nobel Prize in Physics 1960."}
Glaser's 1952 paper was titled "Some Effects of Ionizing Radiation on the Formation of Bubbles in Liquids". He used a small glass chamber of superheated liquid, diethyl ether, in which the passage of ionising radiation started bubbles.:cite[glaser1952] The bubble chamber that followed was run by expanding a liquid (a few hundred to a few thousand times a day at the big machines), with photographs taken a moment after the particles crossed. It took the place of the cloud chamber as the workhorse, because the liquid can be hydrogen: a bubble chamber filled with liquid hydrogen is a target of protons and a detector at once, which was exactly what was wanted for studying how particles interact with protons. By 1964 an 80-inch liquid-hydrogen chamber at Brookhaven National Laboratory, in the United States, was being used to discover a new hyperon (Chapter 12).:cite[chambers-barnes1964] Glaser received the Nobel Prize in Physics in 1960.:cite[nobel-glaser]
:::

In a bubble chamber the whole liquid sits in a magnetic field, and the tracks are curved arcs of bubbles. The picture below is a re-simulated event in liquid hydrogen. A neutral pion is made at an interaction that leaves no track of its own (the pion is neutral, and a neutral particle makes no ions) and decays at once to two photons. Photons are neutral as well, so they leave no track either, until each converts into an electron and a positron in the electric field of a nucleus. The electron and positron leave together, curve in opposite directions, and spiral inwards as they lose energy, because the lighter a particle is the more of its energy it loses per unit of momentum.

::bubble-chamber{n="5.6" preset="pair" caption="A re-simulated event in a liquid-hydrogen bubble chamber in a magnetic field: two photons, invisible on their way, each convert to an electron–positron pair. The pairs curve in opposite directions (opposite charges) and their tracks spiral as the particles slow down. This is a simulation from the course's chamber model, not a photograph."}

The pictures were the raw data of particle physics for about two decades: hundreds of thousands of photographs, examined by teams of people at scanning tables like the one above, and later by machines. An idea first published for machines to recognise tracks in bubble-chamber pictures gave Chapter 8 its first algorithm.

## How well can a momentum be measured?

The measurement is a circle fit, and a fit has an error. The error on the radius, and hence on $p_T$, depends on how many points are measured, how far apart, how accurately, and how strongly the track bends. The classic result is due to Robert Gluckstern, who worked it out in 1963 for bubble-chamber tracks.:cite[gluckstern1963] For a track measured at $N$ points equally spaced along a length $L$, each with an error $\sigma$ perpendicular to the track, with no multiple scattering,

:::equation{#gluckstern caption="The relative error of the transverse momentum from the position errors of the points (Gluckstern, valid for about ten points or more). It grows in proportion to pT and falls as the square of the lever arm."}
$$\frac{\term{sigpt}{\sigma(p_T)}}{p_T} \;=\; \frac{\term{sigma}{\sigma}\; p_T}{0.3\,\term{BB}{B}\,\term{LL}{L^2}}\;\sqrt{\frac{720}{\term{NN}{N}+4}}$$

```terms
sigpt:
  label: 'σ(pT), the error on the transverse momentum'
  what: The standard deviation of the fitted pT over many measurements of identical tracks. The relative error σ(pT)/pT is the quantity quoted as the momentum resolution.
  why: A detector's momentum resolution is what decides whether it can tell a particle of 100 GeV/c from one of 105.
  effect: It grows in proportion to pT. A stiff track is a nearly straight track, and a nearly straight track gives the circle fit almost nothing to work with.
sigma:
  label: 'σ, the position error of each point'
  what: The spread of each measured point about the true track, perpendicular to the track, in metres. Silicon pixels and strips reach 10–50 micrometres; wire chambers a few hundred.
  why: It is what the fit tries to average away.
  effect: Halve σ and the resolution halves.
BB:
  label: 'B, the magnetic field'
  what: The field in tesla.
  why: A stronger field bends the track more, so the same error on the points is a smaller fraction of the sagitta.
  effect: Doubling the field halves σ(pT)/pT.
LL:
  label: 'L, the lever arm'
  what: The length of track over which the points are spread, in metres (the radial extent, for a barrel tracker).
  why: |
    The sagitta grows as L², so the lever arm is the most powerful dial: a tracker twice as large gives a resolution four times better.
  effect: Doubling L divides σ(pT)/pT by four.
NN:
  label: 'N, the number of points'
  what: The number of measurements along the track.
  why: Averaging more points reduces the error, but only as the square root, so the first points matter more than the last.
  effect: Going from 10 to 40 points improves the resolution by a factor of about 1.9, not 4.
```
:::

The square root is $\sqrt{720/14} = 7.2$ for $N = 10$. With $\sigma = 50\ \mu$m, $L = 1$ m and $B = 2$ T, a 100 GeV/*c* track is measured to $50\times 10^{-6}\times 100/(0.3\times 2\times 1)\times 7.2 = 6\,\%$, and a 10 GeV/*c* track to 0.6 %. The resolution *worsens* in proportion to the momentum. That is the opposite of a calorimeter (Chapter 6), and it is why a real detector needs both.

If the tracker contains material, multiple Coulomb scattering (Chapter 6) kicks the particle sideways by a random angle at each layer, and this adds a term that does not depend on $p_T$ at all: $0.3\,B\,L\,\beta\,\sigma_{\rm MS}\sim$ (scattering angle) times $L$ divided by the sagitta, and the angle falls as $1/p$, exactly as the sagitta does. In the same units as above, for a total thickness $x/X_0$ of material (radiation lengths, Chapter 6),

$$ \left(\frac{\sigma(p_T)}{p_T}\right)_{\rm MS} \;\approx\; \frac{1.2\times 0.0136}{0.3\,B\,L\,\beta}\,\sqrt{\frac{x}{X_0}}, $$

with a coefficient of about 1.2 found from a simulation of the fit used in this chapter, and $\beta$ the particle's speed in units of *c*. The two terms add in quadrature. At low momentum scattering dominates and the resolution is flat; at high momentum the position error dominates and it rises linearly. Figure 5.7 lets you vary every dial and compare the formulae with a Monte Carlo of the circle fit (it runs the fit from this chapter's exercise once you have passed it).

::pt-resolution{n="5.7" caption="Left: one simulated track, seen sideways, as the distance of the measured points from the straight chord, with its true path; the points have errors of the stated size. Right: the relative momentum resolution against pT from the two terms of Gluckstern's formula (measurement error and multiple scattering) and their sum, with Monte Carlo points (orange): each is the spread of the pT fitted to 250 simulated tracks. The numbers are for this toy tracker: a uniform field, N equally spaced layers of the same error, material spread evenly. They are not the performance of any real detector."}

For the course detector of Chapter 7 (3.8 T, eight layers out to 1.1 m, pixels of 12 μm and strips of 40 μm), a simulation with the same free circle fit gives about 0.4 % at 10 GeV, about 1.8 % at 100 GeV and about 7.5 % at 400 GeV. These are the course detector's numbers; CMS and ATLAS have their own, and Chapter 7 is careful about which is which. A fit that is constrained to pass through the beam line does better, because it has one parameter fewer.

:::deeper[Where the formula comes from]
Take three points at $x = 0$, $L/2$ and $L$ on a nearly straight track, each measured with error $\sigma$. The sagitta is $s = y_{1/2} - (y_0 + y_L)/2$, and its error is $\sigma_s = \sigma\sqrt{1 + 2\cdot\tfrac14} = \sigma\sqrt{3/2}$. The relative error of $p_T$ equals that of $s$, because $s \propto 1/p_T$, and $s = 0.3\,B\,L^2/(8p_T)$ gives

$$\frac{\sigma(p_T)}{p_T} = \frac{\sigma_s}{s} = \sqrt{\tfrac32}\,\frac{8\,\sigma\,p_T}{0.3\,B\,L^2} = 9.8\,\frac{\sigma\,p_T}{0.3\,B\,L^2}.$$

Gluckstern's exact treatment of $N$ points replaces 9.8 by $\sqrt{720/(N+4)}$, which is 10.1 for $N = 3$ and falls as $1/\sqrt N$ for large $N$: the structure is the same, and the dependence on $B$, $L^2$, $\sigma$ and $p_T$ is fixed by the geometry of one sagitta. The factor 720 comes from fitting a parabola to the points by least squares and taking the variance of its curvature: for equally spaced points the variance of the quadratic coefficient is $720\,\sigma^2/(L^4\,(N+4))$ at large $N$, and the curvature of the parabola is $2\times$ the coefficient. The $L^4$ in that variance is the source of the $L^2$ in the formula.
:::

```fermi
id: field-for-1tev
title: A field for a 1 TeV track
prompt: A tracker has 10 points spread over 1 m, each with an error of 50 μm. What magnetic field, in tesla, would it need to measure the transverse momentum of a 1 TeV track to 1 % with the formula above? (Use σ(pT)/pT = σ pT/(0.3 B L²) × √(720/(N+4)).)
answer: 120
unit: T
factor: 3
hints:
  - The square root is √(720/14) ≈ 7.2. Put σ = 50×10⁻⁶ m, pT = 1000 GeV/c and L = 1 m.
  - Solve for B with the left-hand side equal to 0.01.
explain: "B = σ pT × 7.2 / (0.3 L² × 0.01) = 50×10⁻⁶ × 1000 × 7.2 / (0.3 × 0.01) ≈ 120 T. No magnet can do that over a metre. The remedies are the dials of the formula: a longer lever arm, which enters squared (4 m instead of 1 m needs only 7.5 T), or a better point resolution. That is why the LHC's muon systems, which measure the highest-momentum tracks of all, span several metres; Chapter 7 returns to it."
```

## You write: a circle fit

The fit that gives the radius is a small, self-contained piece of numerical code, and it is the first function of the detector stage that the reader writes. The approach is to rewrite the equation of a circle so that the unknowns appear *linearly*. A circle of centre $(x_c, y_c)$ and radius $R$ satisfies $x^2 + y^2 + Dx + Ey + F = 0$ with $D = -2x_c$, $E = -2y_c$ and $F = x_c^2 + y_c^2 - R^2$. For each measured point $(x_i, y_i)$ the left-hand side is not quite zero; choose $D$, $E$ and $F$ to minimise the sum of the squares. That is an ordinary linear least-squares problem, with the three unknowns multiplying the columns $x_i$, $y_i$ and $1$, and the target $-(x_i^2+y_i^2)$. It needs no starting guess and no iteration. This is the *Kåsa fit*, and it is what the exercise asks for, with one addition: a weight of $1/\sigma_i^2$ for each point.

:::programmer
The trick is one every engineer knows: a problem that looks non-linear (fitting a circle) becomes linear when the parametrisation is changed (fitting $D$, $E$, $F$). The cost is that the quantity being minimised is no longer the distance of the points from the circle, but an algebraic residual that overweights the points far from the centre; fits of this kind are *biased* when the noise is large compared to the curvature. The library's fit is a cousin (Taubin's) that removes most of the bias; the reader's fit is the simple version. The difference in the answer is a fraction of a percent for the tracks in this course and matters only for stiff tracks measured badly.
:::

```code
id: circle-fit
title: A circle fit that returns the momentum
hook: reco.circleFit
prompt: |
  Implement `circleFit(points)` for points `{ x, y, sigma? }` in millimetres: return the centre `(xc, yc)`, the radius `R` and
  `chi2 = Σ ((distance to the centre − R)/σ)²`, weighting each point by 1/σ² (σ = 1 if it is missing). Use the algebraic form
  x² + y² + D x + E y + F = 0 and solve the 2 × 2 normal equations. Then write `ptFromRadius(R, B)`, the
  transverse momentum in GeV/c of a unit-charge track of radius R (mm) in a field B (tesla).
  Two things to watch: subtract the weighted mean of the points first (the hits of a stiff track are almost on a line, and the algebra loses digits if you do not); and do not divide by
  a σ of zero.
starter: |
  import type { CirclePoint, CircleResult } from 'hep/reco';

  export function circleFit(points: readonly CirclePoint[]): CircleResult {
    // weights w = 1/σ²; centre the points on their weighted mean (u, v);
    // solve  [Suu Suv; Suv Svv] (uc, vc) = ½ (Suuu + Suvv, Svvv + Svuu);
    // then R = √(uc² + vc² + (Suu + Svv)/Σw), centre = mean + (uc, vc)
    return { xc: 0, yc: 0, R: 0, chi2: 0 };
  }

  export function ptFromRadius(R: number, B: number): number {
    // pT [GeV/c] = 0.2998 · B [T] · R [m]; R is given in millimetres
    return 0;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { circleFit, ptFromRadius } from 'solution';
  import { helix } from 'hep/detector';
  import { circleFit as library } from 'hep/reco';
  import { fromPtEtaPhiM } from 'hep/kinematics';
  import { rng, normal } from 'hep/random';

  const LAYERS = [50, 100, 150, 200, 300, 400, 600, 800];

  /** The hits of a muon from the origin in a field B (tesla): its helix meets each cylinder once. */
  function hits(pt: number, charge: number, B: number, phi: number, sigma: number, r = rng(1)) {
    const h = helix(fromPtEtaPhiM(pt, 0.3, phi, 0.10566), charge, [0, 0, 0], B);
    return LAYERS.map((R) => {
      const p = h.pointAt(h.intersectCylinder(R, 5000)!);
      return sigma > 0 ? { x: p[0] + normal(r) * sigma, y: p[1] + normal(r) * sigma, sigma } : { x: p[0], y: p[1] };
    });
  }

  test('points exactly on a circle give its centre and radius', () => {
    const pts = Array.from({ length: 12 }, (_, i) => {
      const a = -0.3 + (i * 1.4) / 11;
      return { x: 30 + 120 * Math.cos(a), y: -40 + 120 * Math.sin(a) };
    });
    const f = circleFit(pts);
    expect(f.xc).toBeCloseTo(30, 6);
    expect(f.yc).toBeCloseTo(-40, 6);
    expect(f.R).toBeCloseTo(120, 6);
    expect(f.chi2).toBeLessThan(1e-9);
  });

  test('a muon of 10 GeV in 2 T has a radius of 16.7 m: the fit finds it from hits that are almost in a line', () => {
    const f = circleFit(hits(10, -1, 2, 0.7, 0));
    expect(Math.abs(f.R / 16677.0 - 1)).toBeLessThan(2e-4);
    expect(ptFromRadius(f.R, 2)).toBeCloseTo(10, 2);
  });

  test('pT from the radius: 0.3 B R, with the radius in millimetres', () => {
    expect(ptFromRadius(1000, 1)).toBeCloseTo(0.299792458, 6);
    expect(ptFromRadius(16677, 2)).toBeCloseTo(10, 2);
  });

  test('a point with a huge uncertainty is (almost) ignored', () => {
    const good = hits(20, 1, 2, -1.2, 0);
    const bad = good.map((p, i) => (i === 4 ? { x: p.x + 5, y: p.y - 5, sigma: 1e6 } : { ...p, sigma: 0.05 }));
    const f = circleFit(bad);
    const g = circleFit(good.map((p) => ({ ...p, sigma: 0.05 })));
    expect(Math.abs(f.R / g.R - 1)).toBeLessThan(1e-3);
  });

  test('noisy hits: the fitted pT is unbiased, and as good as the library’s', () => {
    const r = rng(7);
    let ratio = 0;
    let worst = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const pts = hits(20, i % 2 ? 1 : -1, 3.8, -3 + 6 * r(), 0.05, r);
      const mine = ptFromRadius(circleFit(pts).R, 3.8);
      const lib = ptFromRadius(library(pts).R, 3.8);
      ratio += mine / 20;
      worst = Math.max(worst, Math.abs(mine / lib - 1));
    }
    expect(Math.abs(ratio / N - 1)).toBeLessThan(0.02);
    expect(worst).toBeLessThan(0.03);
  });

  test('χ² is about N − 3 for hits with the stated uncertainty', () => {
    const r = rng(11);
    let sum = 0;
    const N = 300;
    for (let i = 0; i < N; i++) sum += circleFit(hits(20, -1, 3.8, -3 + 6 * r(), 0.05, r)).chi2;
    const mean = sum / N;
    expect(mean).toBeGreaterThan(0.5 * (LAYERS.length - 3));
    expect(mean).toBeLessThan(1.6 * (LAYERS.length - 3));
  });
solution: |
  import type { CirclePoint, CircleResult } from 'hep/reco';

  export function circleFit(points: readonly CirclePoint[]): CircleResult {
    const n = points.length;
    const w = points.map((p) => 1 / (p.sigma ?? 1) ** 2);
    let sw = 0, mx = 0, my = 0;
    for (let i = 0; i < n; i++) {
      sw += w[i]!;
      mx += w[i]! * points[i]!.x;
      my += w[i]! * points[i]!.y;
    }
    mx /= sw;
    my /= sw;
    let Suu = 0, Svv = 0, Suv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
    for (let i = 0; i < n; i++) {
      const u = points[i]!.x - mx, v = points[i]!.y - my, wi = w[i]!;
      Suu += wi * u * u;
      Svv += wi * v * v;
      Suv += wi * u * v;
      Suuu += wi * u * u * u;
      Svvv += wi * v * v * v;
      Suvv += wi * u * v * v;
      Svuu += wi * v * u * u;
    }
    const det = Suu * Svv - Suv * Suv;
    const b1 = 0.5 * (Suuu + Suvv), b2 = 0.5 * (Svvv + Svuu);
    const uc = (b1 * Svv - b2 * Suv) / det;
    const vc = (b2 * Suu - b1 * Suv) / det;
    const R = Math.sqrt(uc * uc + vc * vc + (Suu + Svv) / sw);
    const xc = mx + uc, yc = my + vc;
    let chi2 = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(points[i]!.x - xc, points[i]!.y - yc) - R;
      chi2 += w[i]! * d * d;
    }
    return { xc, yc, R, chi2 };
  }

  export function ptFromRadius(R: number, B: number): number {
    return (0.299792458 * B * R) / 1000;
  }
hints:
  - 'With u = x − mean x and v = y − mean y, the circle is u² + v² + D u + E v + F′ = 0. Setting the derivatives of Σ w (u² + v² + D u + E v + F′)² to zero gives two equations (F′ drops out because Σ w u = Σ w v = 0).'
  - 'The centre in the shifted frame is (−D/2, −E/2) = (uc, vc), and R² = uc² + vc² + (Suu + Svv)/Σ w, where Suu = Σ w u².'
  - 'Write the 2 × 2 system as a matrix and solve it by Cramer''s rule: uc = (b1 Svv − b2 Suv)/det, vc = (b2 Suu − b1 Suv)/det.'
```

Once your function passes its tests it is saved as `reco.circleFit`. The library's own track fit calls it through the hook, and so does Figure 5.7, through a *use my code* toggle. From Chapter 8 the tracking algorithms use the same fit.

:::hood[The library's version]
`hep/reco` implements the same idea with Taubin's modification, which divides the algebraic residual by a measure of the circle's size and so removes most of the bias. Its core is a Newton iteration on a cubic, but the first lines are what you have just written:

```ts
let sum = 0, xm = 0, ym = 0;
for (let i = 0; i < n; i++) {
  const w = ws ? ws[i]! : 1;
  sum += w;
  xm += w * xs[i]!;
  ym += w * ys[i]!;
}
xm /= sum;
ym /= sum;
// centred moments Mxx, Myy, Mxy, Mxz, Myz, Mzz of (X, Y, Z = X² + Y²) follow
```

The subtraction of the mean is the important step: for a 100 GeV track in the course detector the points span a millimetre of sagitta on a metre of length, so the solution depends on the difference of numbers that differ only in the sixth digit. The helices themselves are computed in closed form, in `hep/detector`'s `helix.ts`, with one more numerical precaution. The position after an arc $s$ is $x = x_0 + (\sin\varphi - \sin\varphi_0)/\omega$, which has the form $0/0$ as the curvature $\omega$ goes to zero (a neutral particle, or a very stiff one), so the code writes it as $s\cos(\varphi_0 + \omega s/2)\,\mathrm{sinc}(\omega s/2)$, which is exact and stable:

```ts
const half = 0.5 * this.omega * sT;
const ph = this.phi0 + half;
const k = sT * sinc(half);
this.ox = this.vertex[0] + k * Math.cos(ph);
this.oy = this.vertex[1] + k * Math.sin(ph);
```

In a field that is not uniform the path has no closed form, and the usual method is a numerical integration of the equation of motion (a Runge–Kutta scheme of fourth order, as in the experiments' own software). The course detector keeps the field uniform inside the solenoid and in the return region, so it never needs one.
:::

:::experiments
The LHC experiments track in **silicon** close to the beam: ATLAS and CMS use pixel layers (squares of about 50 by 100 micrometres or smaller) and strips further out, and their tracker is the largest silicon detector ever built. ATLAS adds a *straw-tube* tracker outside its silicon, in which each of many thin tubes of gas with a wire at its centre records where a particle passed. **ALICE**, the LHC experiment built for lead collisions, uses a **time projection chamber**, a large cylinder of gas in which the ionisation electrons of a track drift to the end of the cylinder and are recorded, giving the whole track in three dimensions with a measurement of the ionisation along it. The track is found and fitted in software with the methods of Chapter 8; the open-source library **ACTS** ("A Common Tracking Software"), used by several experiments, implements them.:cite[acts2022] The course's own tracker (Chapter 7) is a toy in comparison: eight cylindrical layers, hits with Gaussian errors, and a uniform field.
:::

:::real{parts="A cloud chamber"}
A diffusion cloud chamber can be built at home from a clear plastic box, a block of dry ice, isopropyl alcohol, felt and a torch; in a few minutes of running, tracks of cosmic-ray muons and of alpha particles from the radon and its decay products in the air are visible. Appendix G gives the kit, the safety advice, the steps, what you should see, and how to tell the alphas, the electrons and the muons apart by the shapes you have learnt in this chapter. See [Appendix G](/appendix/build-it-for-real/).
:::

## What comes next

A track gives a momentum and a charge, and its thickness gives a speed, but it tells us nothing about *how* the particle lost its energy, or what happens when it meets a block of lead rather than a gas. The next chapter asks that: [Chapter 6](/chapters/particles-through-matter/) derives the energy loss that makes a track visible, explains the multiple scattering that limits how well a track can be measured at low momentum, and follows the particles that do not make tracks at all: the electrons and photons that shower, the hadrons that interact, the neutrinos that pass through everything. Chapter 7 then puts tracker and calorimeters together, and Chapter 8 writes the software that finds the tracks in a busy event. Chapter 9 returns to Anderson's photograph.

## Further reading

- C. T. R. Wilson's 1911 paper and J. J. Thomson's of 1897, in the bibliography below (:cite[wilson1911,thomson1897]).
- Glaser's 1952 paper (:cite[glaser1952]) and Gluckstern's 1963 article on the uncertainty of track momentum (:cite[gluckstern1963]).
- The Particle Data Group's review chapters on the passage of particles through matter and on particle detectors, for the formulae and the numbers used here (:cite[pdg2024]).
