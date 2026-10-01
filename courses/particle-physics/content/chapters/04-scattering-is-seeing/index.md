---
number: 4
title: Scattering is seeing
summary: How to learn what something is made of by throwing particles at it. Rutherford's law derived from a classical orbit, the differential cross-section, why resolution is set by the momentum transferred, how form factors measured the size of the proton, and the sampling problem hidden in 1/sin⁴(θ/2).
duration: About 2½ hours
prerequisites: [quantum-essentials]
---

Nearly everything this course describes was found by the same experiment. You cannot look inside a gold atom or a proton with a lens, so you fire something small at it and record where the something goes. If it passes straight through, the target is mostly empty. If it bounces back, there is something hard in there. If the pattern of angles has a particular shape, the shape tells you how big the hard thing is and how its charge is spread. Ernest Rutherford's group did this with alpha particles and gold foil, Robert Hofstadter's with electrons and protons, and at the LHC the target is a proton and the probe is another proton. This chapter takes the experiment apart: what is measured, what the answer should be if the target is a point, and what changes when it is not.

```predict
q: 'A narrow beam of 5.5 MeV alpha particles hits a thin gold foil. A detector at 30° from the beam direction counts N alphas per minute. If the nucleus is a point carrying the atom''s positive charge, about how many alphas per minute does an identical detector count at 60°?'
options:
  - text: About N/2, because 60° is twice 30°.
    why: 'The count would fall in proportion to the angle if the force were a gentle one. A repulsive 1/r² force acting at close range does much more.'
  - text: About N/4.
    why: 'Closer, but the fall is steeper than the square of the angle.'
  - text: About N/14.
    correct: true
    why: 'Rutherford''s law says the rate is proportional to 1/sin⁴(θ/2). The ratio is (sin 15° / sin 30°)⁴ = (0.259 / 0.5)⁴ = 0.072, one part in 14. The rest of the chapter derives the law and tests it.'
  - text: 'Practically none, because alphas are not deflected through large angles.'
    why: 'That was what the older model of the atom predicted. The surprise of 1909 was that large deflections occur, rarely, and with a fixed pattern.'
```

## What a scattering experiment measures

A scattering experiment has three parts: a beam of particles of known kind and energy, a target, and a detector that can be placed at any angle θ from the beam direction. What the detector records is a count of particles per second at that angle. To compare experiments, the count has to be divided by what depends on the apparatus: how many particles were fired, how many target nuclei were in the way, and how large the detector looks from the target. What is left depends only on the physics, and it is the :term[**differential cross-section**]{id=differential-cross-section}.

Chapter 3 defined a cross-section σ as an area that the target presents to the beam, and the rate as σ times the luminosity. The differential cross-section d*σ*/dΩ is the same idea resolved by direction. The :term[**solid angle**]{id=solid-angle} Ω measures a cone of directions in steradians, as an angle measures a fan of directions in radians. The whole sphere is 4π sr, and the ring of directions between polar angles θ and θ + dθ has the solid angle d*Ω* = 2π sin θ dθ.

:::equation{#dcs caption="The number of particles counted in a small detector at angle θ. The factor d σ/dΩ is what the physics supplies."}
$$\term{dN}{\mathrm{d}N} = \term{Nb}{N_\text{beam}}\;\term{nt}{n_t}\;\frac{\mathrm{d}\term{sig}{\sigma}}{\mathrm{d}\term{Om}{\Omega}}\;\mathrm{d}\Omega$$

```terms
dN:
  label: 'dN, the number counted'
  what: The number of scattered particles that arrive in the small solid angle dΩ around the direction θ.
  why: It is what the detector reports.
  effect: It is proportional to everything on the right, so doubling the beam or the foil thickness doubles the count.
Nb:
  label: 'N_beam, the number fired'
  what: How many particles of the beam hit the foil during the run.
  why: Each particle has the same, small chance of scattering into the detector.
  effect: Counting for ten times as long gives ten times the counts, and a relative uncertainty smaller by √10.
nt:
  label: 'n_t, the target nuclei per unit area'
  what: The number of nuclei in the beam's path per unit of foil area (density times thickness, divided by the mass of one atom).
  why: The foil is thin enough that each alpha meets at most one nucleus closely, so the chances add.
  effect: For 0.4 µm of gold it is 2.4 × 10⁻⁸ per fm². A thicker foil gives more counts but eventually several scatterings per alpha.
sig:
  label: 'σ, the cross-section'
  what: An area; the integral of dσ/dΩ over all directions.
  why: dσ/dΩ is a probability density in direction, per beam particle and per target nucleus.
  effect: Quoted in fm² here (1 fm² = 10 mb), in barns in general.
Om:
  label: 'Ω, the solid angle'
  what: A measure of a cone of directions in steradians; the detector subtends a small dΩ.
  why: The count is the density per steradian times the steradians the detector covers.
  effect: A detector at a large angle covers the same dΩ as one at a small angle, but sees very different counts.
```
:::

The dependence on angle is the whole content of the measurement, and the next sections work out what it is for the simplest target.

## Rutherford's law from a classical orbit

An alpha particle is a helium nucleus: charge *z* = 2 in units of the proton's charge, mass 3.727 GeV, and a kinetic energy *T* of about 5 MeV from a typical radioactive source. A gold nucleus has charge *Z* = 79. Both are positive, so they repel with the Coulomb force, *F* = *zZ*α ħ*c*/*r*², where α = 1/137 is the fine-structure constant and ħ*c* = 197.3 MeV·fm (Chapter 1). The product α ħ*c* = 1.44 MeV·fm is all the electromagnetism there is in the problem.

The alpha is 7,300 times heavier than an electron, so the atom's electrons barely deflect it. The gold nucleus is 49 times heavier than the alpha, and for this derivation it is treated as fixed.

**The distance scale.** Fire an alpha straight at the nucleus. It slows as it climbs the Coulomb potential and stops at the distance *d* where all its kinetic energy has become potential energy:

$$T = \frac{zZ\alpha\hbar c}{d} \quad\Longrightarrow\quad d = \frac{zZ\alpha\hbar c}{T}.$$

For 5.5 MeV alphas (the energy of those from americium-241, a common source) on gold, *d* = 2 × 79 × 1.44 MeV·fm / 5.5 MeV = 41.4 fm. For 7.7 MeV, the top of the range of the alphas from radium and its decay products, it is 29.5 fm. This is the closest an alpha of that energy can get to a gold nucleus. The nucleus itself is about 7 fm across, so the alphas never touch it; they probe the Coulomb field outside it, which is that of a point charge whatever the nucleus is made of.

**The orbit.** A particle that is not aimed straight at the nucleus, but passes with an :term[**impact parameter**]{id=impact-parameter} *b* (the distance by which it would miss if it were not deflected), moves on a hyperbola, the orbit of every inverse-square repulsion. Conservation of energy and of angular momentum determine it, and the angle through which it is bent turns out to depend only on the ratio of the two lengths in the problem:

:::equation{#orbit caption="The deflection angle for an alpha particle passing a point nucleus with impact parameter b. At b = d/2 it is deflected through 90°."}
$$\tan\frac{\term{th}{\theta}}{2} = \frac{\term{d}{d}}{2\,\term{b}{b}}, \qquad d = \frac{\term{zZ}{zZ}\,\alpha\hbar c}{\term{T}{T}}$$

```terms
th:
  label: 'θ, the deflection angle'
  what: The angle between the alpha's direction before and after it passes the nucleus.
  why: A strong push (a close pass) bends the path through a large angle.
  effect: θ → 0 for b ≫ d (a distant pass) and θ → 180° for b → 0 (head-on, the alpha turns back).
d:
  label: 'd, the head-on distance of closest approach'
  what: How close the alpha gets if aimed straight at the nucleus, in fm.
  why: It is where the kinetic energy has all become Coulomb energy. It is the one length of the problem.
  effect: Larger for a heavier nucleus and slower alphas.
b:
  label: 'b, the impact parameter'
  what: The perpendicular distance from the nucleus to the alpha's undeflected path.
  why: It sets how hard and how long the alpha is pushed.
  effect: At b = d/2 the deflection is 90°.
zZ:
  label: 'zZ, the product of the charges'
  what: The charge of the alpha (z = 2) times the charge of the nucleus (Z = 79 for gold), in units of e.
  why: The Coulomb force is proportional to it.
  effect: Quadruple the nuclear charge and d quadruples.
T:
  label: 'T, the alpha''s kinetic energy'
  what: The kinetic energy of the alpha far from the nucleus, in MeV.
  why: A faster alpha is harder to deflect.
  effect: At 7.7 MeV d = 29.5 fm for gold; at 5.5 MeV, 41.4 fm.
```
:::

:::deeper[The orbit in six lines]
Let the alpha have momentum *p* far away, so that the speed *v* satisfies *pv* = 2*T*, and let *k* = *zZ*α ħ*c*. Since the collision is elastic, the alpha leaves with the same speed and its momentum has changed by Δ*p* = 2*p* sin(θ/2), along the axis of symmetry of the hyperbola. Place the nucleus at the origin and measure the polar angle φ of the alpha's position from that axis; φ runs from −φ₀ to +φ₀ with φ₀ = π/2 − θ/2.

The component of the force along the axis is (*k*/*r*²) cos φ. Angular momentum *L* = *pb* is conserved, so d*φ*/d*t* = *L*/(*mr*²), and the impulse along the axis is

$$\Delta p = \int F_{\text{axis}}\,\mathrm{d}t = \int_{-\varphi_0}^{\varphi_0}\frac{k\cos\varphi}{r^2}\,\frac{m r^2}{pb}\,\mathrm{d}\varphi = \frac{2km}{pb}\sin\varphi_0 = \frac{2k}{vb}\cos\frac{\theta}{2},$$

in which *r* has cancelled. Setting this equal to 2*p* sin(θ/2) gives tan(θ/2) = *k*/(*pvb*) = *k*/(2*Tb*) = *d*/(2*b*). The orbit itself is *r*(φ) = (2*b*²/*d*)/(ε cos φ − 1) with ε = √(1 + (2*b*/*d*)²); Figure 4.1 draws it. Its closest point, at φ = 0, is (*d*/2)(1 + 1/sin(θ/2)): *d* for a head-on collision, and larger for gentler passes.
:::

::rutherford-orbits{n="4.1" caption="The classical paths of alpha particles past a gold or silver nucleus. The path with the chosen impact parameter is highlighted; the shaded bands are the impact parameters between b and b + 4 fm, and the shaded wedge is where those alphas end up. A calculation of the exact classical orbit, not a simulation of many alphas. Try b = d/2 (90°), and watch the closest approach on the highlighted path against the nuclear radius."}

**From orbit to cross-section.** All alphas whose impact parameters lie between *b* and *b* + d*b*, in a ring of area 2π*b* d*b* around the nucleus, are deflected into angles between θ and θ + dθ, that is into the solid angle 2π sin θ dθ. The ratio of the two areas is the cross-section per steradian, and with *b* = (*d*/2) cot(θ/2) it can be evaluated in one line: d*b*/dθ = −(*d*/4)/sin²(θ/2) and *b*/sin θ = (*d*/4)/sin²(θ/2). The result is :term[**Rutherford's formula**]{id=rutherford-scattering}:

:::equation{#rutherford caption="Rutherford's differential cross-section for scattering from a point charge. The count rate falls as the fourth power of sin(θ/2)."}
$$\frac{\mathrm{d}\sigma}{\mathrm{d}\Omega} = \frac{b}{\sin\theta}\left|\frac{\mathrm{d}b}{\mathrm{d}\theta}\right| = \left(\frac{\term{d2}{d}}{4}\right)^{2}\frac{1}{\sin^{4}(\term{th2}{\theta}/2)} = \left(\frac{zZ\,\alpha\hbar c}{4\,T}\right)^{2}\frac{1}{\sin^{4}(\theta/2)}$$

```terms
d2:
  label: 'd, the head-on distance of closest approach'
  what: zZαħc/T, in fm.
  why: "It is the only length in the problem, so the cross-section, an area, has to be built from it: (d/4)² is the scale."
  effect: At 5.5 MeV on gold, (d/4)² = 107 fm², and dσ/dΩ = 428 fm² per steradian at 90°.
th2:
  label: 'θ, the scattering angle'
  what: The angle between the incoming and outgoing directions of the alpha.
  why: Small angles come from distant passes, which are far more numerous than close ones.
  effect: "The 1/sin⁴(θ/2) shape: 14 times more alphas at 30° than at 60°, and 1/θ⁴ at small angles."
```
:::

Four things to take from it:

- The cross-section is proportional to (*zZ*)²: silver (*Z* = 47) scatters (47/79)² = 0.35 as strongly as gold, at the same thickness per nucleus.
- It is proportional to 1/*T*²: halving the alpha energy quadruples the counts at every angle.
- It is proportional to 1/sin⁴(θ/2): between 30° and 60° the rate drops by 13.9 and, between 10° and 150°, by a factor of 15,000.
- It has no free parameter. Given the foil, the energy and the number of alphas, the prediction is an absolute number of counts at each angle.

The numbers show why only careful counting could test it. For 5.5 MeV alphas and a gold foil 0.4 µm thick there are *n*<sub>t</sub> = 2.4 × 10⁻⁸ nuclei per fm². The cross-section for scattering through more than 90° is π(*d*/2)² = 1,345 fm², so the chance of an alpha doing so is 3.2 × 10⁻⁵: one in 31,000. Scattering through 10° or more is 130 times more likely, 4 per thousand.

The same calculation in quantum mechanics, for waves rather than orbits, gives exactly the same cross-section for a pure Coulomb force. The alphas' wavelength is ħ/*p* = 197.3 MeV·fm / 202.5 MeV = 0.97 fm, 40 times smaller than *d*, so the classical picture was a good one to use, and the coincidence is Rutherford's good fortune.

:::history{year=1913 title="Testing the formula" people="Hans Geiger, Ernest Marsden, Ernest Rutherford" source="Sources: Geiger and Marsden (1909); Rutherford (1911); Geiger and Marsden (1913); Thomson (1904)."}
Chapter 1 told how in 1909 Geiger and Marsden found alphas reflected from metal foils through more than 90°, and how Rutherford concluded in 1911 that an atom's charge sits in a nucleus much smaller than the atom. Two further points complete the story. The older model of the atom, J. J. Thomson's, spread the positive charge through a sphere the size of the atom with the electrons embedded in it (it is often called the plum-pudding model). In it a passing alpha receives many small kicks and leaves at a small angle; large deflections are possible only by an accumulation of unlikely kicks, and are exceedingly rare.:cite[thomson1904] The counts were counted by eye: each alpha that struck a zinc sulphide screen made a flash of light, seen through a microscope in a dark room.:cite[geiger-marsden1909]

Rutherford's paper of 1911 derived the formula for single scattering and listed what it predicts: the number of alphas scattered should vary with the angle as 1/sin⁴(θ/2), in proportion to the foil's thickness, to the square of the nuclear charge, and as the inverse square of the alpha's energy.:cite[rutherford1911] Geiger and Marsden's paper of 1913 tested the four dependences (angle, thickness, atomic weight of the foil, and speed of the alphas) and found them consistent with it.:cite[geiger-marsden1913] That is the sense in which Rutherford's nucleus was an experimental result and not an interpretation: a formula with no adjustable constant predicted four independent dependences, and they were found.
:::

## Geiger and Marsden, rebuilt

Figure 4.2 repeats the measurement as a simulation. It fires alpha particles at a thin foil of gold or silver, and counts how many land in each of fourteen 10° bins between 10° and 150°. The number that scatter at all through more than 10° is drawn from a Poisson distribution with the mean the formula gives (Chapter 3). The angle of each of them is drawn by the function `scattering.sampleRutherfordAngle`, which is the one you write at the end of this chapter, so with *use my code* on, your sampler produces the counts. The counts are divided by the solid angle of each bin, plotted on logarithmic axes, and compared with the formula and with a fit.

::geiger-marsden{n="4.2" caption="Geiger and Marsden's measurement, simulated. Points: the counts in 10° bins per steradian, with √N error bars. Orange curve: Rutherford's formula with no free parameters. Dashed: a fit of K sin⁻ᵖ(θ/2), with K and the exponent p free. The readout gives p and the nuclear charge implied by the count rate. Plum pudding: an illustrative Gaussian standing for many small deflections, with an adjustable width. A simulation of single Rutherford scattering by a heavy nucleus in a thin foil, using the library's sampler: multiple scattering, atomic screening (below about a quarter of a degree) and nuclear recoil are not modelled."}

Things to try. Fire 10⁶ alphas, then 3 × 10⁹: the error bars shrink as 1/√N and the fitted exponent closes on 4. Bins that caught no alpha have no point; at large angles and few alphas some are empty. Change the foil from gold to silver: the curve drops by the factor 0.35 at every angle, and the nuclear charge read from the count rate follows. Halve the alpha energy: the counts go up by four. Switch on the plum pudding: whatever its width, a Gaussian that fits the small-angle core falls through the floor of the plot at large angles, where the counts are very far above it. That is the experimental finding of 1909, in one picture.

The fitted exponent and nuclear charge come with a caveat that the simulation shares with the real experiment: the nuclear charge is read from the normalisation, so it is only as good as the knowledge of the foil's thickness and of the number of alphas. Geiger and Marsden varied the angle, the thickness, the foil material and the speed one at a time for that reason.

Rutherford's formula has limits, and it is useful to know where they are:

- **Small angles.** A pure Coulomb force has an infinite range: the total cross-section ∫(dσ/dΩ) dΩ diverges because ever more distant passes give ever smaller angles. In a real atom the electrons screen the nucleus beyond the Thomas–Fermi radius, about 11,000 fm for gold, and the formula fails for deflection angles below roughly *d*/(11,000 fm) = 0.004 rad = 0.2°. This is why the sampler below needs a smallest angle θ<sub>min</sub>.
- **Large energies.** The closest approach at 180° is *d*. When it is as small as the nuclear radius (about 7 fm for gold, from the rule *R* ≈ 1.2 *A*<sup>1/3</sup> fm), the alpha feels the strong nuclear force, and the formula fails. That needs *T* = *zZ*α ħ*c*/*R* = 32.5 MeV, about six times the energy of the alphas of radioactive decay.
- **Recoil and relativity.** For light nuclei the target recoils, and for fast particles the force law changes. The next sections handle the second.

```fermi
id: fraction-back
title: One alpha in how many bounces back?
prompt: 'A gold foil is 1 µm thick (density 19.3 g/cm³, atomic mass 197 g/mol, N_A = 6.02 × 10²³ per mole). Alphas of 5.5 MeV hit it. Using σ(θ > 90°) = π(d/2)² with d = zZ α ħc/T and α ħc = 1.44 MeV·fm, what fraction of the alphas is scattered through more than 90°? (1 cm² = 10²⁶ fm².)'
answer: 7.9e-5
factor: 3
hints:
  - Nuclei per cm² = density × thickness × N_A / A. Convert to nuclei per fm².
  - 'd = 2 × 79 × 1.44 / 5.5 = 41.4 fm, so σ = π (20.7 fm)² = 1,345 fm².'
explain: 'n_t = 19.3 × 10⁻⁴ cm × 6.02 × 10²³ / 197 = 5.9 × 10¹⁸ per cm² = 5.9 × 10⁻⁸ per fm². Probability = n_t σ = 5.9 × 10⁻⁸ × 1,345 = 7.9 × 10⁻⁵, about one alpha in 12,600. Geiger and Marsden found a few per ten thousand reflected from thin foils, consistent in size with this, and an old model of the atom would have put the fraction at an immeasurably small number.'
```

```numeric
id: closest-approach
title: How close can a 7.7 MeV alpha get?
prompt: 'Alphas from the decay of polonium-214, in the radium series, have an energy of 7.7 MeV. How close in fm do they get to a gold nucleus (Z = 79) in a head-on collision? Use d = zZ α ħc / T with α ħc = 1.44 MeV·fm.'
answer: 29.55
unit: fm
tolerance: 0.01
hints:
  - 'z = 2 for the alpha; zZ = 158.'
explain: 'd = 158 × 1.44 / 7.7 = 29.5 fm. That is the figure of about 30 fm in Chapter 1: thousands of times smaller than the atom, four times larger than the nucleus.'
```

## Resolution is momentum transferred

An alpha of 5.5 MeV has a de Broglie wavelength of 0.97 fm, so, by the rule of Chapter 1, it should be able to resolve details of that size. Yet Rutherford's experiment could only say that the nucleus is smaller than *d* ≈ 30 fm. The two statements do not contradict one another. The alpha was **unable to approach** closer than *d*: the Coulomb repulsion turned it back, and a probe cannot show detail in a place it does not go. A good probe needs both a short wavelength and a way of getting close. An electron, which is attracted by a nucleus instead of repelled, and is not affected by the strong force, goes right through.

What the scattered probe resolves is set by how hard it was hit. In an elastic scattering the particle keeps its energy and changes the direction of its momentum **p** through θ, so the :term[momentum transfer]{id=momentum-transfer}, the momentum given to the target, has the length

:::equation{#qtransfer caption="The momentum transferred in elastic scattering through an angle θ, and the length it resolves."}
$$\term{q}{q} = 2\,\term{p}{p}\,\sin\frac{\theta}{2}, \qquad \text{resolution} \;\approx\; \frac{\hbar}{q} = \frac{\hbar c}{qc}$$

```terms
q:
  label: 'q, the momentum transfer'
  what: The size of the change of the probe's momentum, which equals the momentum given to the target (when the target's recoil energy is negligible).
  why: The initial and final momenta have the same length p and differ in direction by θ, so they and their difference form an isosceles triangle with base 2p sin(θ/2).
  effect: Large for hard collisions (big angle, fast probe) and small for glancing ones.
p:
  label: 'p, the probe''s momentum'
  what: The momentum of the incoming particle.
  why: A faster particle has a shorter wavelength.
  effect: For a fast particle p ≈ E, so higher energy means a smaller length resolved.
```
:::

This is the uncertainty principle of Chapter 3 in practice: a scattering that gives the target momentum *q* localises the point of interaction to about ħ/*q*. A glancing collision of a fast electron has a small *q* and says nothing about fine detail; a head-on one has *q* = 2*p* and sees as sharply as the probe's wavelength allows. In practice you measure at many angles, and the angle at which the cross-section starts to deviate from the point-charge law tells you the size.

For a 500 MeV electron scattered from a proton through 60°, the electron's energy afterwards (the proton recoils) is 394.8 MeV, and the momentum transfer is *Q* = 0.444 GeV, so the length resolved is ħ*c*/*Q* = 0.444 fm. That is half the proton's size. For 5.5 MeV alphas scattering from gold at 150°, the same formula gives *q* = 2*p* sin 75° = 391 MeV, a resolution of 0.50 fm, but, as above, they never get there. The ratio is the point: a probe resolves what it can reach.

```numeric
id: electron-resolution
title: What a 500 MeV electron resolves
prompt: 'An electron of 0.5 GeV scatters elastically from a proton (mass 0.938 GeV) through 60°. The momentum transfer is Q² = 2EE′(1 − cos θ), with E′ = E/(1 + (E/M)(1 − cos θ)) the electron''s energy afterwards. What length ħc/Q does this resolve, in fm? (ħc = 0.1973 GeV·fm.)'
answer: 0.4441
unit: fm
tolerance: 0.02
hints:
  - 'First E′ = 0.5/(1 + (0.5/0.938) × 0.5) = 0.395 GeV.'
  - 'Then Q² = 2 × 0.5 × 0.395 × 0.5 = 0.197 GeV², so Q = 0.444 GeV.'
explain: 'ħc/Q = 0.1973/0.4443 = 0.444 fm. Half the radius of the proton is within reach of electrons of this energy, which is why Hofstadter''s beams of a few hundred MeV could see its extent.'
```

## Electrons, spin and the size of the proton

Replace the alphas by electrons and the gold nucleus by a proton. The electron is a point (nothing has been found inside it), it has spin ½ and it is relativistic: at 500 MeV its mass is irrelevant. Two things change in the formula. The relativistic electron has *pv* = *E* in place of 2*T*, and its spin brings an extra factor, cos²(θ/2), which means that a fast electron is never scattered straight backwards by a point charge. The result, for a point charge *Z* and electron energy *E*, is **Mott's formula**:

$$\left(\frac{\mathrm{d}\sigma}{\mathrm{d}\Omega}\right)_{\text{Mott}} = \left(\frac{Z\alpha\hbar c}{2E\sin^2(\theta/2)}\right)^{2}\cos^{2}\frac{\theta}{2}$$

(with the recoil of the target neglected, which is not safe for a proton at large angles, and the proton's magnetic moment also ignored).:cite[mott1929] It is Rutherford's formula with *T* replaced by *E*/2 and the extra factor.

If the proton is not a point but has its charge spread out with density ρ(**r**), electrons scattered from different parts of it add up as waves: the amplitudes from the different charge elements are added with phases that depend on the momentum transferred (Chapter 3's rule). The sum is the Fourier transform of the charge distribution, called the **form factor**, and the cross-section is the point-charge one multiplied by its square. This Fourier transform is the :term[**form factor**]{id=form-factor}:

:::equation{#formfactor caption="Scattering from an extended charge: the point-charge cross-section times the square of the form factor, the Fourier transform of the charge density. At small q it measures the root-mean-square radius."}
$$\left(\frac{\mathrm{d}\sigma}{\mathrm{d}\Omega}\right) = \left(\frac{\mathrm{d}\sigma}{\mathrm{d}\Omega}\right)_{\text{point}}\;|\term{F}{F(q)}|^{2}, \qquad F(q) = \int \term{rho}{\rho(\vec r)}\,e^{\,i\vec q\cdot\vec r/\hbar}\,\mathrm{d}^3r \;\approx\; 1 - \frac{q^2\,\term{r2}{\langle r^2\rangle}}{6\hbar^2}$$

```terms
F:
  label: 'F(q), the form factor'
  what: The amplitude, relative to a point charge, for the extended charge to scatter an electron with momentum transfer q without breaking up.
  why: Waves scattered from different parts of the charge cancel in part when the wavelength ħ/q is shorter than the size.
  effect: F = 1 for a point or at q → 0; F falls as q increases past ħ/R, where R is the size.
rho:
  label: 'ρ(r), the charge density'
  what: The electric charge per unit volume at position r, normalised so that its integral is 1 (the charge of the proton).
  why: Each element of charge scatters the electron; they add as waves.
  effect: A smoother, more spread-out density has a form factor that falls faster with q.
r2:
  label: '⟨r²⟩, the mean square radius'
  what: The average of r² over the charge distribution; its square root is the root-mean-square (charge) radius.
  why: Expanding the exponential to second order and averaging over directions gives the leading dependence on q.
  effect: The slope of F at q = 0 measures ⟨r²⟩, which is how the radius of the proton is defined.
```
:::

The expansion is two lines: e<sup>*i***q**·**r**/ħ</sup> ≈ 1 + *i***q**·**r**/ħ − (**q**·**r**)²/2ħ²; the linear term averages to zero, and the average of (**q**·**r**)² over directions is *q*²*r*²/3. The result is general: whatever the shape, *F* ≈ 1 − *q*²⟨*r*²⟩/6ħ². Common shapes have closed forms. An exponential density e<sup>−*r*/*a*</sup> gives *F* = 1/(1 + *q*²*a*²/ħ²)², called the **dipole** form, with ⟨*r*²⟩ = 12*a*². A uniform sphere gives an oscillating form factor with zeros, and a Gaussian a Gaussian.

:::history{year=1955 title="The proton turns out to have a size" people="Robert Hofstadter, Robert McAllister" source="Sources: Hofstadter and McAllister (1955); Hofstadter (1956); CODATA (2022); Pohl et al. (2010)."}
Robert Hofstadter and his collaborators at Stanford's High Energy Physics Laboratory used a linear electron accelerator to scatter electrons of a few hundred MeV from nuclei and from hydrogen. For nuclei the angular distributions showed diffraction-like fall-offs from which a charge distribution, with a smooth edge, could be read.:cite[hofstadter1956] For hydrogen, in 1955, the counts at large angles were lower than the point-charge formula predicts: the proton has a finite extent.:cite[hofstadter-mcallister1955] The root-mean-square radius that came out of these first analyses lay between about 0.7 and 0.8 fm, depending on the analysis; the figure of 0.74 fm is one of those quoted from this period.:cite[hofstadter1956] Hofstadter shared the 1961 Nobel Prize in Physics for these studies of the structure of nucleons.:cite[nobel1961]

The radius has been remeasured many times since, by electron scattering and by the spectroscopy of hydrogen. A measurement in 2010 using muonic hydrogen, in which a muon replaces the electron, gave a value smaller than the one then recommended (about 0.88 fm), and a debate known as the proton radius puzzle followed.:cite[pohl2010] The 2022 CODATA recommended value is 0.84075(64) fm, close to the muonic-hydrogen one.:cite[codata2022] The radius is the root-mean-square of the charge distribution, defined by the slope of the form factor at zero momentum transfer. The proton has no sharp edge, and the number is a property of the slope, which has to be extrapolated from data at small but non-zero *q*: the extrapolation is where the difficulty lies.
:::

Figure 4.3 puts the pieces together. Choose a charge distribution and a radius, and an electron energy and angle; the figure computes the momentum transfer for elastic scattering from a proton, the length it resolves, and how strongly the cross-section is suppressed. For the proton with a radius of 0.84 fm and the dipole form, at 500 MeV and 60° (*Q* = 0.444 GeV), |*F*|² = 0.35, so the cross-section is about a third of that of a point. At 2 GeV and 60° the electron resolves 0.14 fm, and |*F*|² is 4 × 10⁻³. The form factor can be used backwards: measure the cross-section at several *Q*, divide by the point-charge one, and the shape of |*F*|² gives the charge distribution.

For the dipole form, the radius fixes Λ² = 12(ħ*c*)²/⟨*r*²⟩: for 0.84 fm that is 0.66 GeV², and the value of Λ² = 0.71 GeV² often quoted for an empirical fit to proton data corresponds to 0.81 fm. The dipole is an empirical shape that approximates what the measured proton form factor does over a range of *Q*; the measured one is close to it, but not identical.

::form-factor-lab{n="4.3" caption="Resolution and form factors. Left: the squared form factor of the chosen charge distribution against the momentum transfer; the dot is where an electron of the chosen energy and angle scattering elastically from a proton sits. Right: a SCHEMATIC of what a probe of that resolution would show of a proton. The thresholds between the three pictures are illustrative; the transition is gradual, and Chapter 13 shows the real measurements. The curves are calculations for assumed shapes, not data."}

```quiz
q: 'Why did Hofstadter use electrons, rather than alpha particles, to measure the size of the proton?'
options:
  - text: Electrons have a shorter wavelength at the same energy, and nothing else matters.
    why: 'The wavelength matters, but not alone: the second point is that an alpha is stopped by Coulomb repulsion and, being a strongly interacting nucleus, would be scattered by the nuclear force as well.'
  - text: Electrons feel only the electromagnetic force, are point-like, and can be given a short wavelength without being turned back by the proton''s charge.
    correct: true
    why: 'The electron''s scattering depends on the proton''s electric charge distribution alone, and a few hundred MeV gives a wavelength of 0.4 fm or less. Both conditions (short wavelength, clean interaction) are needed.'
  - text: Electrons are heavier than alphas, so they carry more momentum.
    why: 'An electron is 7,300 times lighter than an alpha. At the same energy it has less momentum than an alpha, but the relativistic electron reaches a much higher momentum for the energy that accelerators can give.'
```

## Elastic and inelastic scattering

In the scattering above, the proton stays a proton. This is :term[**elastic scattering**]{id=elastic-scattering}: the target is left in its ground state, and the energy and the direction of the electron are tied together. For an electron of energy *E* scattering through θ from a target of mass *M*, the energy afterwards is fixed:

:::equation{#elastic caption="Elastic scattering fixes the electron's final energy for each angle. Any other final energy means that the target was excited or broken up."}
$$\term{Ep}{E'} = \frac{E}{1 + (E/\term{M}{M})(1-\cos\theta)}, \qquad \term{W}{W}^2 = M^2 + 2M\,\nu - Q^2$$

```terms
Ep:
  label: 'E′, the electron''s final energy'
  what: The energy of the scattered electron, if the proton is left intact.
  why: It follows from conservation of energy and momentum with the proton recoiling.
  effect: Equal to E at small angles or high mass, and smaller as the proton recoils harder.
M:
  label: 'M, the mass of the target'
  what: 0.938 GeV for the proton.
  why: The recoil energy is of order Q²/2M.
  effect: A heavy target barely recoils, which is why the alpha-on-gold derivation could ignore it.
W:
  label: 'W, the mass of what the proton became'
  what: The invariant mass of the hadronic system after the collision, computed from the energy lost by the electron, ν = E − E′, and the momentum transferred, Q² = −(p − p′)².
  why: It is the invariant mass of Chapter 2 applied to the target's final state.
  effect: W = M for elastic scattering; W ≈ 1.23 GeV for the Δ(1232), the first excited state; W larger for a break-up into several hadrons.
```
:::

If the electron comes out with less energy than that, the missing energy went into the target. Either the proton was excited to a short-lived state of higher mass (the first is the Δ⁺ of 1.232 GeV in the particle table, with a width of 117 MeV, Chapter 12), or it was broken up and the final state holds several hadrons: this is :term[**inelastic scattering**]{id=inelastic-scattering}. A spectrum of scattered-electron energies at fixed angle shows an elastic peak at E′, then bumps from the excited states, then a continuum.

The elastic channel fades with *Q*: for the dipole form |*F*|² falls as *Q*⁻⁸ at high *Q*, so a proton is very unlikely to survive a hard collision intact. What happens in the other channel was the surprise of the late 1960s. At SLAC, the Stanford Linear Accelerator Center, electrons of up to about 20 GeV were scattered from protons, and at momentum transfers where the elastic cross-section had become negligible, the inelastic cross-section turned out to be large and to fall only slowly with *Q*, as if the electron were scattering from point-like constituents inside the proton.:cite[bloom1969,breidenbach1969] Those constituents were the quarks. Chapter 13 tells that story, including the picture on the right of Figure 4.3 (a proton at a resolution of 0.1 fm showing three hard points) in real data. The progression is the same one that ran from Rutherford's alphas (resolution limited to 30 fm) to Hofstadter's electrons (0.4 fm) to SLAC (0.1 fm and below) to the LHC (10⁻⁴ fm, Chapter 1):

| Probe | Energy | Resolution | What it showed |
|---|---|---|---|
| Alpha particles on gold | 5–8 MeV | closest approach 30–45 fm | the atom has a nucleus, smaller than 30 fm |
| Electrons on protons, Stanford | a few hundred MeV | about 0.4 fm | the proton has a size, about 0.8 fm |
| Electrons on protons, SLAC | up to about 20 GeV | about 0.1 fm and below | point-like constituents (Chapter 13) |
| Proton collisions, LHC | 13.6 TeV | about 10⁻⁴ fm | nothing smaller found so far (Chapter 1) |

## Under the hood: sampling a density that diverges

To simulate scattering, a program has to draw angles with the probability density that the formula gives. The angular density follows from d*σ*/dΩ by multiplying by the solid angle of a ring, 2π sin θ:

$$f(\theta)\;\propto\;\frac{\sin\theta}{\sin^4(\theta/2)} = \frac{2\cos(\theta/2)}{\sin^{3}(\theta/2)} \;\longrightarrow\; \frac{16}{\theta^{3}}\quad(\theta\to 0).$$

It is largest at the smallest angle θ<sub>min</sub> and diverges as θ → 0, which is why the sampler needs a cut θ<sub>min</sub> (the screening angle above, or a detector's acceptance). The simplest generator of random numbers from a density is :term[**accept–reject**]{id=accept-reject}: propose an angle uniformly in [θ<sub>min</sub>, π], draw a height uniformly between 0 and a ceiling that the density never exceeds, and keep the angle if the height falls under the density. The cost is set by the ceiling. Here the ceiling must be *f*(θ<sub>min</sub>), and the fraction of the box that lies under the curve, which is the **efficiency**, is

$$\varepsilon_{\text{flat}} = \frac{\int f\,\mathrm{d}\theta}{f(\theta_{\min})\,(\pi-\theta_{\min})} \approx \frac{\theta_{\min}}{2\pi}.$$

For θ<sub>min</sub> = 1° the efficiency is 0.28 %: 358 proposals, and so 716 random numbers, for every angle kept. For θ<sub>min</sub> = 0.001 rad it is 1 in 6,300. The cost grows without limit as the cut is lowered, and the physics (small angles are the most probable ones) wants the cut as low as it can go. Figure 4.4 shows it: nearly all the trials are rejected because the density drops by orders of magnitude away from θ<sub>min</sub>.

**:term[Importance sampling]{id=importance-sampling}** fixes this by proposing from a distribution that looks like the density. Here the density behaves as 16/θ³ at small angles, and the function 16/θ³ can be sampled exactly by inverse transform (Chapter 3), because its cumulative distribution is 1/θ<sub>min</sub>² − 1/θ² up to normalisation: θ = (1/θ<sub>min</sub>² − *u*(1/θ<sub>min</sub>² − 1/π²))<sup>−1/2</sup> for a uniform *u*. The proposal is then corrected by accept–reject with probability *f*(θ)/(16/θ³) = cos *x* (*x*/sin *x*)³, with *x* = θ/2, which never exceeds 1, so the envelope really does lie above the density, and stays close to 1 over most of the range. The efficiency is above 99 % for every θ<sub>min</sub> below 0.3 rad, and approaches 100 % as θ<sub>min</sub> falls. In the library (`hep/scattering`):

```ts
export function sampleImportance(r: Rng, thetaMin: number): { theta: number; trials: number } {
  const inv0 = 1 / (thetaMin * thetaMin);
  const inv1 = 1 / (Math.PI * Math.PI);
  for (let trials = 1; ; trials++) {
    const theta = 1 / Math.sqrt(inv0 - r() * (inv0 - inv1));   // proposal: density ∝ 1/θ³
    const x = theta / 2;
    if (r() <= Math.cos(x) * (x / Math.sin(x)) ** 3) return { theta, trials };   // accept with f / envelope
  }
}
```

::sampler-compare{n="4.4" caption="Trials of accept–reject for Rutherford scattering. Each dot is one proposed angle with a random height under the envelope; grey dots fall above the density and are rejected. With the flat envelope the efficiency is about θmin/2π and the picture is almost all grey; with the envelope 16/θ³ nearly every dot is kept. Move the smallest angle: the flat method gets worse as it falls, the other does not. The dots are a seeded sample of trials; the efficiencies are exact."}

For this particular density there is a better method still. The integral of *f* is elementary, ∫*f* dθ = −2/sin²(θ/2), so the cumulative distribution can be inverted exactly: with *u*<sub>0</sub> = sin(θ<sub>min</sub>/2), sin(θ/2) = 1/√(1/*u*<sub>0</sub>² − *u*(1/*u*<sub>0</sub>² − 1)) for a uniform *u*, and every random number gives an angle (`sampleRutherfordInverse` in the library). The importance sampler is the one to learn, because it works when the density is known only pointwise, as with the matrix elements of the later chapters; the inverse transform is the one to use when the integral can be done. In the event generator of Chapter 16 the same idea appears as *importance sampling with weighted events*.

:::programmer
A differential cross-section is a probability density in disguise, and simulating a scattering experiment is sampling from it. Rejection sampling needs a proposal *q* and a constant *M* such that *f* ≤ *M q*; it costs *M* proposals per sample, so the whole art is in making *q* hug *f*. This is the same trade-off as picking a pivot for quicksort, a hash function, or a proposal distribution in a Markov chain: a bad proposal is still correct, and unusably slow. Notice what the test of your sampler can and cannot check. A χ² comparison with the exact distribution catches a wrong density. It cannot catch a sampler that is right but slow, so the tests below also count the random numbers used.
:::

### Write it yourself

Write the function that draws a Rutherford scattering angle between θ<sub>min</sub> and π. The starter is the flat accept–reject sampler described above: it is correct and, as you will see in the tests, too slow at small θ<sub>min</sub>. Change the proposal. Your sampler is the one the flagship figure uses when *use my code* is on.

```code
id: rutherford-sampler
title: Sample the Rutherford scattering angle
hook: scattering.sampleRutherfordAngle
prompt: |
  Implement `sampleRutherfordAngle(r, thetaMin)`, returning an angle $\theta \in [\theta_{\min}, \pi]$ whose density is proportional to

  $$f(\theta) = \frac{\sin\theta}{\sin^4(\theta/2)} = \frac{2\cos(\theta/2)}{\sin^3(\theta/2)}.$$

  The starter proposes $\theta$ uniformly and keeps it with probability $f(\theta)/f(\theta_{\min})$. That is correct but takes about $2\pi/\theta_{\min}$ tries per angle, so the tests (which allow only a few random numbers per angle) fail for small $\theta_{\min}$.

  Use **importance sampling**: propose from the density proportional to $1/\theta^3$ on $[\theta_{\min}, \pi]$, which you can sample by inverse transform, and accept with probability $\cos x\,(x/\sin x)^3$ where $x = \theta/2$ (this is $f(\theta)\,\theta^3/16$, at most 1). Or invert the cumulative distribution exactly, if you prefer. Use only `r()` for random numbers.
starter: |
  import type { Rng } from 'hep';

  // The (unnormalised) density of the angle: sin θ / sin⁴(θ/2) = 2 cos(θ/2) / sin³(θ/2).
  const density = (theta: number) => (2 * Math.cos(theta / 2)) / Math.sin(theta / 2) ** 3;

  export function sampleRutherfordAngle(r: Rng, thetaMin: number): number {
    const top = density(thetaMin); // the density is largest at the smallest angle
    for (;;) {
      const theta = thetaMin + (Math.PI - thetaMin) * r(); // a flat proposal: hopeless for small thetaMin
      if (r() * top <= density(theta)) return theta;
    }
  }
tests: |
  import { test, expect } from '@pp/test';
  import { sampleRutherfordAngle } from 'solution';
  import { rng } from 'hep';
  import type { Rng } from 'hep';
  import { chi2Sf } from 'hep/analysis';

  // A generator that counts its random numbers and gives up after `limit` of them.
  function counted(seed: number, limit: number) {
    const base = rng(seed);
    let n = 0;
    const r = (() => {
      if (++n > limit) throw new Error(`used more than ${limit} random numbers: too many tries per angle (a flat proposal needs about 2π/θmin)`);
      return base();
    }) as Rng;
    Object.assign(r, { fork: base.fork, seed: base.seed });
    return { r, used: () => n };
  }

  // The cumulative distribution of the angle on [θmin, π].
  const cdf = (t: number, tm: number) => {
    const a = 1 / Math.sin(tm / 2) ** 2;
    return (a - 1 / Math.sin(t / 2) ** 2) / (a - 1);
  };
  function chi2Uniform(xs: number[], tm: number, bins = 40) {
    const c = new Array(bins).fill(0);
    for (const t of xs) c[Math.min(bins - 1, Math.floor(cdf(t, tm) * bins))]++;
    const e = xs.length / bins;
    return c.reduce((s: number, o: number) => s + (o - e) ** 2 / e, 0);
  }

  test('every angle lies between thetaMin and π', () => {
    for (const tm of [0.3, 0.05]) {
      const r = rng(1);
      for (let i = 0; i < 2000; i++) {
        const t = sampleRutherfordAngle(r, tm);
        expect(t).toBeGreaterThanOrEqual(tm);
        expect(t).toBeLessThanOrEqual(Math.PI);
      }
    }
  });

  test('the angles follow the Rutherford density (χ² test, thetaMin = 0.3)', () => {
    const r = rng(2);
    const xs = Array.from({ length: 40000 }, () => sampleRutherfordAngle(r, 0.3));
    const chi2 = chi2Uniform(xs, 0.3);
    expect(chi2Sf(chi2, 39), `χ² = ${chi2.toFixed(1)} for 39 degrees of freedom`).toBeGreaterThan(1e-3);
  });

  test('small angles are cheap: thetaMin = 0.002 with at most 10 random numbers per angle on average', () => {
    const { r, used } = counted(3, 10 * 20000);
    const xs = Array.from({ length: 20000 }, () => sampleRutherfordAngle(r, 0.002));
    expect(used() / 20000).toBeLessThan(10);
    const chi2 = chi2Uniform(xs, 0.002);
    expect(chi2Sf(chi2, 39), `χ² = ${chi2.toFixed(1)}`).toBeGreaterThan(1e-3);
  });

  test('most of the angles are just above thetaMin: 89 % are below 3 × thetaMin', () => {
    const tm = 0.002;
    const { r } = counted(4, 10 * 20000);
    let below = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (sampleRutherfordAngle(r, tm) < 3 * tm) below++;
    const p = cdf(3 * tm, tm);
    expect(Math.abs(below / N - p)).toBeLessThan(5 * Math.sqrt((p * (1 - p)) / N));
  });

  test('the same seed gives the same angles', () => {
    const a = Array.from({ length: 5 }, ((r) => () => sampleRutherfordAngle(r, 0.1))(rng(9)));
    const b = Array.from({ length: 5 }, ((r) => () => sampleRutherfordAngle(r, 0.1))(rng(9)));
    expect(a).toEqual(b);
  });
solution: |
  import type { Rng } from 'hep';

  export function sampleRutherfordAngle(r: Rng, thetaMin: number): number {
    const inv0 = 1 / (thetaMin * thetaMin);
    const inv1 = 1 / (Math.PI * Math.PI);
    for (;;) {
      // proposal: density proportional to 1/θ³ on [thetaMin, π], by inverse transform
      const theta = 1 / Math.sqrt(inv0 - r() * (inv0 - inv1));
      // accept with probability f(θ) / (16/θ³) = cos x (x / sin x)³, with x = θ/2; this is at most 1
      const x = theta / 2;
      if (r() <= Math.cos(x) * (x / Math.sin(x)) ** 3) return theta;
    }
  }
hints:
  - 'The cumulative distribution of the density 1/θ³ on [θmin, π] is (1/θmin² − 1/θ²) / (1/θmin² − 1/π²). Invert it: 1/θ² = 1/θmin² − u (1/θmin² − 1/π²).'
  - 'The ratio of the wanted density to the envelope 16/θ³ is cos(θ/2) (θ/2 / sin(θ/2))³. It is 1 as θ → 0 and falls to 0 at θ = π.'
  - 'The exact alternative: with u₀ = sin(θmin/2), sin(θ/2) = 1/√(1/u₀² − u (1/u₀² − 1)) for a uniform u, and θ = 2 arcsin of that.'
```

:::experiments[In the experiments]
Rutherford scattering is still a working method. In **Rutherford backscattering spectrometry**, used in materials science, a beam of helium ions of an MeV or two is fired at a sample and the energy of the ions that come back through large angles is recorded; the cross-section is Rutherford's, and the energy loss tells which element and what depth the scattering happened at. In particle physics, **deep inelastic scattering** continued after SLAC at **HERA**, the electron–proton collider at DESY in Hamburg, which ran from 1992 to 2007 and collided electrons or positrons with protons at much higher energy; its data, like those of SLAC, are the subject of Chapter 13. In simulation, **Geant4**, the program with which the large experiments simulate how particles go through matter (Chapter 6), has models for how a charged particle scatters from the nuclei of the material, including ones that sample single scatterings from a Rutherford-like cross-section with atomic screening: the screening angle plays the role of θ<sub>min</sub> above.
:::

## What comes next

The experiment of this chapter, a beam, a target and a detector placed at an angle, is what the rest of the course keeps doing, with the resolution growing from tens of femtometres to 10⁻⁴ fm. Two threads continue. The first is the question of what the target was made of at each resolution: Chapter 13 returns to the proton with SLAC's electrons, and finds the quarks. The second is the means of seeing. A scattered particle is useful only if you can measure where it went and how fast, which is the subject of [Part II](/chapters/tracks/): [Chapter 5](/chapters/tracks/) begins with the path of a charged particle in a magnetic field, and with the cloud chamber, in which Wilson's droplets made such paths visible.

## Further reading

- Ernest Rutherford's 1911 paper and Geiger and Marsden's of 1913, in the bibliography below (:cite[rutherford1911,geiger-marsden1913]).
- Robert Hofstadter's review of electron scattering and nuclear structure, which collects the Stanford work (:cite[hofstadter1956]).
- David Griffiths, *Introduction to Elementary Particles*, for cross-sections, form factors and the Mott formula at the level of this chapter (:cite[griffiths2008]).
- The Particle Data Group's *Review of Particle Physics* for the standard formulae of kinematics and of scattering (:cite[pdg2024]).
