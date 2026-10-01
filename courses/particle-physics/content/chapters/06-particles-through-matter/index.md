---
number: 6
title: Particles through matter
summary: How charged particles lose energy by ionisation, why a track wanders, how electrons and photons make showers of their own kind and hadrons make showers of another, why a muon goes through everything, and why a neutrino goes through even that. Each particle's way of interacting is the signature a detector reads.
duration: About 2½ hours
prerequisites: [tracks]
---

A detector is a block of matter placed in the path of particles, and particles do not all treat a block of matter alike. An electron of 10 GeV, sent into a few centimetres of lead, gives up all its energy there. A muon of the same energy goes through and comes out the other side having lost a few percent. A neutron is not much troubled until it hits a nucleus, which it may do a few tens of centimetres in. A neutrino, in the time it takes you to read this sentence, has passed through the lead and the Earth as well. These differences are not a nuisance to be corrected for. They are how the particles are told apart, and the structure of every detector in this course, a tracker, then calorimeters, then muon chambers, follows from them.

```predict
q: 'Four particles, each with 10 GeV of energy, are fired at a block of lead 10 cm thick: an electron, a muon, a charged pion and a neutrino. Which one deposits (nearly) all of its energy in the block?'
options:
  - text: The electron.
    correct: true
    why: 'An electron of 10 GeV starts a shower that is 95 % contained within about 16 radiation lengths, which in lead (0.56 cm each) is 9 cm. The block holds it. The muon loses only about 130 MeV (1.1 MeV cm²/g × 11.35 g/cm³ × 10 cm), because lead is thin for it. The pion has not travelled even one interaction length, which is 17.6 cm in lead, and the neutrino does not interact at all.'
  - text: The charged pion, because it is heavy and strongly interacting.
    why: 'Strong interactions are strong, but a nuclear interaction length in lead is 17.6 cm, so a 10 cm block is about half of one: more than half of the pions (57 %) cross it without interacting at all, and the rest deposit only part of their energy. The electron is the one that is stopped, because the electromagnetic cascade has a much shorter length scale.'
  - text: The muon, because it is the most massive of the charged leptons.
    why: 'A muon is heavier than an electron, which is exactly why it radiates and scatters less. It is minimum-ionising: it loses about 1.1 MeV for each g/cm² of lead, about 130 MeV in this block, and keeps going.'
  - text: The neutrino, because it has no charge for the lead to resist.
    why: 'Having no charge it does not ionise the lead, and it has no strong interaction either. Its only chance is the weak interaction, which is so weak that a 10 GeV neutrino would need tens of millions of kilometres of iron to have an even chance of interacting. It leaves the block unseen.'
```

This chapter works out what each particle does and how big the effect is, using the numbers in the course's own material table (`hep/detector`, rounded from the Particle Data Group's tables of material properties:cite[pdg2024]). The first half is about charged particles that keep their identity as they cross matter: they lose energy to ionisation and change direction by scattering. The second half is about the particles that do not: the electrons and photons, and the hadrons, that multiply into showers.

## Energy loss by ionisation

Chapter 5 described the loss of energy by a charged particle to the electrons of the atoms along its path, which makes a track visible. The mean rate of that loss, per unit of the mass of material crossed, is the :term[stopping power]{id=stopping-power}, and it is given by the **Bethe–Bloch formula**. It is the most important formula in the subject after $p = 0.3BR$, and its shape is worth understanding before its details.

:::equation{#bethe caption="The mean energy lost by ionisation by a particle of charge ze and speed βc in a material, per g/cm² crossed. The shape: it falls as 1/β² at low speed, passes a minimum near βγ ≈ 3–4, and rises slowly (logarithmically) at high speed until the density effect flattens it."}
$$-\left\langle \frac{dE}{dx}\right\rangle \;=\; \term{K}{K}\,\term{z}{z^2}\,\frac{\term{ZA}{Z}}{A}\,\frac{1}{\term{beta}{\beta^2}}\left[\frac12\ln\frac{2m_ec^2\,\beta^2\gamma^2\,\term{Wmax}{W_{\max}}}{\term{I}{I^2}} \;-\; \beta^2 \;-\; \frac{\term{delta}{\delta(\beta\gamma)}}{2}\right]$$

```terms
K:
  label: 'K, a constant'
  what: K = 4π N_A r_e² m_e c² = 0.307 MeV cm²/mol. It collects Avogadro's number, the classical radius of the electron and the electron's rest energy.
  why: It is the strength of the electromagnetic collision between a charged particle and a free electron, times the number of electrons per mole.
  effect: It sets the overall scale. With Z/A near 0.5 for most materials, it gives the typical few MeV cm²/g of the minimum.
z:
  label: 'z, the charge of the projectile'
  what: The charge of the particle in units of the proton's charge. It is 1 for an electron, muon, pion or proton, and 2 for an alpha particle.
  why: The force from the particle on an atomic electron is proportional to z, and the energy transferred to the square of the force.
  effect: An alpha particle, with z = 2, loses four times as much energy per unit length as a proton of the same speed. This is why its track is so thick.
ZA:
  label: 'Z/A, the electrons per unit mass'
  what: The atomic number divided by the atomic mass, in mol/g. It counts the electrons per gram of material, and is near 0.5 for everything except hydrogen (1.0) and the heaviest nuclei (about 0.4).
  why: The loss is to electrons, so what matters is how many are there to hit per gram.
  effect: Lead has Z/A = 0.40, water 0.56, so per gram water is the better absorber of ionisation loss. Per centimetre, lead is far better, because it is 11 times as dense.
beta:
  label: 'β², the speed squared'
  what: The particle's speed as a fraction of the speed of light, squared.
  why: |
    A slow particle spends longer near each electron and so gives it a bigger kick: the energy transferred goes as 1/β².
  effect: For βγ below 1 the loss climbs steeply as the particle slows. This is the Bragg peak, where a stopping particle deposits most of its energy at the end of its path.
Wmax:
  label: 'W_max, the largest energy a single collision can transfer'
  what: The most energy the particle can hand to one atomic electron, which depends on the particle's mass and speed. For a particle much heavier than the electron it is about 2 m_e c² β²γ².
  why: Distant collisions give small energy transfers and close ones large; the logarithm sums over all of them up to the largest possible.
  effect: It grows as the particle gets faster, which is the origin of the slow logarithmic rise of the loss at high energy.
I:
  label: 'I, the mean excitation energy'
  what: |
    A property of the material that stands for the typical energy needed to excite or ionise its atoms: 173 eV for silicon, 286 eV for iron, 823 eV for lead, 75 eV for water. It is found by measurement, not calculation.
  why: Collisions that transfer less than this cannot excite the atom. It sets the lower end of the logarithm.
  effect: It enters only logarithmically, so a large error in I is a small error in the loss.
delta:
  label: 'δ(βγ), the density effect'
  what: A correction that grows with βγ. At high speed the electric field of the passing particle polarises the atoms between it and the distant electrons, which screens them from the particle.
  why: It removes the distant collisions from the sum and so cancels most of the logarithmic rise.
  effect: Without it the loss would keep rising for ever. With it the "relativistic rise" is only about 10–60 % above the minimum, for βγ up to 1,000.
```
:::

The formula is a sum of the energy given to all the atomic electrons the particle passes, and each of its factors has a plain reading. The charge enters squared (a stronger force transfers more energy). The $1/\beta^2$ says that a slow particle, which lingers near each electron, loses more. The logarithm adds up the contributions of collisions of all distances, from the nearest to the largest that is geometrically possible. The correction $\delta$ switches off the far ones in dense materials. The shape of the result (Figure 6.1) is the same for every singly-charged particle: only the position on the horizontal axis changes with the mass.

:::history{year=1930 title="A formula for how fast a charge loses energy" people="Hans Bethe, Niels Bohr" source="Sources: Bethe (1930), Annalen der Physik 397, 325; Bethe (1932), Zeitschrift für Physik 76, 293; Bohr (1913)."}
Niels Bohr had worked out in 1913 a classical formula for the energy a fast charged particle loses to the electrons of the atoms it passes.:cite[bohr1913] In 1930 Hans Bethe, then a young physicist working with Arnold Sommerfeld in Munich, redid the calculation with quantum mechanics (the electrons of an atom cannot take any energy: only the amounts that move them to another state), in a long paper in the *Annalen der Physik*.:cite[bethe1930] This is the non-relativistic form of what is now called the Bethe formula; in 1932 he published the relativistic version, which has the term in $\beta^2$ and is the formula above (without the density correction, which Fermi worked out in 1940 and Sternheimer later parametrised for many materials).:cite[bethe1932,fermi1940,chambers-sternheimer1984]

The formula has outlived almost everything else in the subject of its time, because it is accurate to a few percent for every charged particle from a slow proton to a muon of a thousand GeV, and every detector built since has used it to compute how much signal to expect.
:::

::stopping-power{n="6.1" caption="The mean energy loss by ionisation, −dE/dx in MeV cm²/g, against momentum for four particles in five materials, from the library's Bethe–Bloch (left; the curves start at βγ = 0.1, below which the formula does not apply), and the range of the chosen particle (right). At the same momentum a heavier particle is slower and loses more. The curves have the same shape; the minimum falls at βγ ≈ 3–4, which is at 0.4 GeV/c for a muon and 3.3 GeV/c for a proton. The numbers for the minimum agree with the Particle Data Group's tables to within 2 %. Switch off the density effect to see what it does."}

Four things in the figure matter in practice.

- **The minimum.** Near $\beta\gamma \approx 3$–$4$ the loss is smallest, and it is nearly the same for every material when expressed per g/cm²: 1.66 MeV cm²/g in silicon, 1.45 in iron, 1.12 in lead, 1.99 in water. A particle at the minimum is called :term[minimum ionising]{id=minimum-ionising-particle}, and an extraordinary number of particles at the LHC are very close to it, because a particle of any mass with a momentum of a few times its mass is. A muon in a detector is a minimum-ionising particle. This is why Chapter 5's cosmic muon makes the same thin track in a cloud chamber whatever its energy.
- **The rise at low momentum** is how slow particles are told apart from fast ones. At a given momentum a proton is much slower than a pion, so it ionises far more. Measuring $dE/dx$ and the momentum (from the curvature) gives the mass, and that is how a pion, a kaon and a proton are separated at momenta below a few GeV/*c*. Chapter 9 uses this.
- **The relativistic rise** above the minimum is slow, about 10–60 % up to $\beta\gamma = 1000$ with the density effect. A TeV muon loses hardly more by ionisation than a 10 GeV one.
- **The range.** A particle that loses energy at the rate $S(E) = -dE/dx$ stops after a distance $R = \int_0^{T} dE/S(E)$, where $T$ is its kinetic energy. The right-hand plot is that integral. A 100 MeV proton has a range of 7.7 g/cm² in water (the library gives 7.71 and the NIST tables of proton stopping power 7.72:cite[nist-pstar]), about 7.7 cm, which is why protons of that energy are used to treat tumours deep in the body (Chapter 33): most of the energy is deposited at the end of the range, in the Bragg peak.

```numeric
id: si-300um
title: What a particle leaves in a silicon pixel
prompt: 'A minimum-ionising particle crosses a silicon sensor 300 μm thick at normal incidence. Silicon has a density of 2.329 g/cm³ and its minimum energy loss is 1.66 MeV cm²/g. What is the mean energy lost in the sensor, in keV?'
answer: 116
unit: keV
tolerance: 0.03
hints:
  - The thickness in g/cm² is 0.03 cm × 2.329 g/cm³ = 0.0699 g/cm².
explain: "1.66 MeV cm²/g × 0.0699 g/cm² = 0.116 MeV = 116 keV. At about 3.6 eV per electron–hole pair in silicon, that is some 32,000 pairs, enough for an amplifier to see; the most probable signal is lower, about 78 keV, because of the tail described next."
```

### The fluctuations of a thin layer

The Bethe–Bloch formula is the *mean* loss. In a thin layer the actual loss varies a great deal from particle to particle, because most collisions transfer a little energy but a rare few transfer a lot, and a thin layer may contain none of the rare ones or one. The distribution (the :term[Landau distribution]{id=landau-distribution}) has a sharp peak and a long tail towards high values, and it was worked out by Lev Landau in 1944.:cite[landau1944] The peak, the **most probable loss**, is lower than the mean, and in a layer of silicon 300 μm thick it is about two thirds of it. Figure 6.2 shows the distribution of the loss of 20,000 simulated muons in layers of different thickness.

::landau-loss{n="6.2" caption="The energy lost by minimum-ionising muons in a thin layer of material: a peak (the most probable value), a tail of rare large losses (delta rays) and a mean from Bethe–Bloch that lies above the peak. The thicker the layer, the closer the peak comes to the mean and the more nearly Gaussian the distribution. The samples are from the library's sampleEnergyLoss, a Landau distribution with a Bichsel peak position, cut at the largest possible single transfer."}

For a detector the lesson is that a pixel's signal cannot be used as a precise measure of a particle's $dE/dx$: one must average several (a *truncated mean* that discards the highest values is the standard remedy). A thick layer smooths the fluctuations out, and that is why a calorimeter, which is thick, measures energy well.

## Scattering: why tracks wander

A charged particle is also deflected by the electric fields of the atomic nuclei it passes. Each deflection is tiny, but there are very many, and the sum is a random walk in angle. The result is :term[multiple Coulomb scattering]{id=multiple-scattering}: after crossing a thickness $x$ of material the direction has changed by a random angle with a roughly Gaussian distribution, whose width is given with about 11 % accuracy by Highland's formula.:cite[chambers-highland1975]

:::equation{#highland caption="The width of the projected scattering angle of a particle of momentum p and speed βc after crossing a thickness x of a material with radiation length X0 (Highland, valid to about 11 % for 10⁻³ < x/X0 < 100)."}
$$\term{th}{\theta_0} \;=\; \frac{13.6\ \text{MeV}}{\term{bp}{\beta c\,p}}\;\term{zz}{z}\;\sqrt{\term{xx}{x/X_0}}\;\Big[\,1 + 0.038\ln\big(x z^2/(X_0\beta^2)\big)\Big]$$

```terms
th:
  label: 'θ₀, the width of the scattering angle'
  what: The standard deviation of the angle, projected on one plane, between the direction of the particle before and after the material. The space angle is √2 times larger.
  why: The angle is the sum of many small independent kicks, so it is Gaussian and its width is what is needed to describe it.
  effect: A 1 GeV/c muon crossing 5 mm of lead is deflected by about 13 milliradians.
bp:
  label: 'βcp, speed times momentum'
  what: The product of the particle's speed (in units of c) and its momentum, in MeV. For a fast particle β ≈ 1 and it is just the momentum.
  why: A particle with more momentum is stiffer and is turned less by the same kick.
  effect: Double the momentum and the scattering angle halves. This is why scattering matters at low momentum and does not at high.
zz:
  label: 'z, the charge of the particle'
  what: The charge in units of e.
  why: The deflecting force is proportional to the charge.
  effect: An alpha particle (z = 2) scatters twice as much as a proton of the same momentum and speed.
xx:
  label: 'x/X₀, the thickness in radiation lengths'
  what: The thickness of material crossed, divided by the material's radiation length (defined below).
  why: A radiation length measures how strongly a material scatters, since both scattering and radiation come from the electric field of the nucleus. A thickness of one X₀ always scatters the same, whatever the material.
  effect: The angle grows as the square root of the thickness, as for any random walk. Four times the material gives twice the angle.
```
:::

The thickness is measured in :term[radiation lengths]{id=radiation-length}, a unit this chapter will come to use constantly. The radiation length $X_0$ of a material is defined by radiation (the energy a high-energy electron loses by emitting photons, next section) but it is also the natural unit of scattering, because both effects come from the same electric field of the nucleus. It depends on the material mostly through the charge of its nuclei: for a material of atomic number $Z$ and mass number $A$ it is roughly $716\,A/\big(Z(Z+1)\ln(287/\sqrt{Z})\big)$ g/cm². That formula gives 6.3 g/cm² for lead (the library's table has 6.37) and 14.1 for iron (13.84). Divide by the density to get a length:

| Material | X₀ (g/cm²) | X₀ (cm) | λ<sub>I</sub> (cm) | E<sub>c</sub> (MeV) | Molière radius (cm) | minimum dE/dx (MeV cm²/g) |
|---|---|---|---|---|---|---|
| Silicon | 21.8 | 9.37 | 46.5 | 40.2 | 4.9 | 1.66 |
| Iron | 13.8 | 1.76 | 16.8 | 21.7 | 1.7 | 1.45 |
| Copper | 12.9 | 1.44 | 15.3 | 19.4 | 1.6 | 1.40 |
| Lead | 6.37 | 0.561 | 17.6 | 7.43 | 1.6 | 1.12 |
| Lead tungstate (PbWO₄) | 7.39 | 0.893 | 22.3 | 9.3 | 2.0 | 1.23 |
| Water | 36.1 | 36.1 | 83.3 | 78.3 | 9.8 | 1.99 |

(The table is the library's `materials`, rounded; the columns for λ<sub>I</sub>, E<sub>c</sub> and the Molière radius are explained below. Air has $X_0 = 304$ m.) A tracking layer of silicon 300 μm thick is $3.2\times 10^{-3}$ of a radiation length, which is why a silicon tracker scatters little: a 1 GeV/*c* muon crossing it is deflected by about 0.6 mrad. Eight such layers with their supports and cables are the tracker's material budget, and the scattering term of Chapter 5's formula is computed from it.

## Radiation and the critical energy

A charged particle accelerated by the electric field of a nucleus radiates. A light particle is accelerated more, and the energy lost to radiation per unit length at a given energy goes as the inverse square of the mass, so for muons it is $(0.511/105.7)^2 \approx 2\times 10^{-5}$ of what it is for electrons. For electrons the effect is large. A high-energy electron radiates photons (this is :term[bremsstrahlung]{id=bremsstrahlung}, "braking radiation") at a rate proportional to its energy, and the energy loss per unit length is

$$ -\left(\frac{dE}{dx}\right)_{\rm rad} = \frac{E}{X_0}, \qquad\text{so}\qquad E(x) = E_0\,e^{-x/X_0}. $$

That is the definition of the radiation length: *the distance over which an electron's energy falls, by radiation alone, to $1/e$ of its value*. A photon of high energy converts into an electron–positron pair in the field of a nucleus, with a mean free path of $9/7$ of a radiation length.

Ionisation loss, in contrast, is nearly independent of energy: a few MeV per $X_0$. So at low energy ionisation wins and at high energy radiation wins, and between the two there is an energy at which they are equal. That is the :term[critical energy]{id=critical-energy} $E_c$: about 7.4 MeV in lead, 22 MeV in iron and 78 MeV in water, and it will determine how a shower stops. Figure 6.3 shows the crossing, computed from the library's electron stopping power.

::critical-energy{n="6.3" caption="Energy lost by an electron in one radiation length of material, to ionisation (dashed, nearly constant) and to radiation (solid, equal to the electron's energy E). They cross at the critical energy, which Rossi's definition places at the point where the ionisation loss per radiation length equals the energy. Below it an electron is soaked up by ionisation; above it radiation dominates and a shower grows. The crossing computed from the library's Bethe–Bloch agrees with the library's table of critical energies to 2 % for all five materials."}

## Electromagnetic showers: Heitler's model

Put the two processes together. A high-energy electron radiates a photon (taking a share of its energy); the photon converts into an electron and a positron (sharing its energy between them); each of those radiates, and so on. The number of particles multiplies and the energy per particle falls, until the energy per particle is below $E_c$ and ionisation takes over. This is an :term[electromagnetic shower]{id=electromagnetic-shower}, and a model by Walter Heitler captures its essentials with almost no mathematics.:cite[heitler1954]

Heitler's model has three rules.

1. A particle (an electron, positron or photon) travels one *splitting length* $d = X_0\ln 2$, and then splits into two particles which share its energy equally. An electron radiates a photon and keeps half the energy; a photon makes a pair and gives each half.
2. After $n$ splitting lengths there are $N = 2^n$ particles, each with energy $E_0/2^n$.
3. Splitting stops, and the particle deposits its energy by ionisation, when its energy falls to $E_c$.

Rule 3 gives the end of the shower: $E_0/2^{n_{\max}} = E_c$, so

$$ n_{\max} = \frac{\ln(E_0/E_c)}{\ln 2}, \qquad N_{\max} = 2^{n_{\max}} = \frac{E_0}{E_c}, \qquad t_{\max} = n_{\max}\,X_0\ln 2 = X_0\ln\frac{E_0}{E_c}. $$

Three consequences explain why calorimeters work. First, **the number of particles at the maximum is proportional to the energy**: a 100 GeV electron in lead ($E_c = 7.43$ MeV) produces about 13,000 particles at the maximum, a 10 GeV electron about 1,300. A calorimeter that counts, in effect, the particles, measures the energy. Second, since the particles are counted, the error is statistical, $\sqrt N$, so the relative resolution is $\propto 1/\sqrt{N} \propto 1/\sqrt{E_0}$: the better for more energetic particles. Third, **the depth of the shower grows only as the logarithm of the energy**: ten times the energy needs only $\ln 10 = 2.3$ more radiation lengths, not ten times more material.

```predict
q: 'A calorimeter block of lead just contains the showers of electrons of 10 GeV (about 16 radiation lengths, 95 % containment). How much deeper does it need to be to contain the showers of electrons of 100 GeV?'
options:
  - text: Ten times deeper, since the energy is ten times larger.
    why: 'That would be so if the shower grew by a fixed distance for each GeV. It does not: each splitting length doubles the number of particles, so the number grows exponentially with depth and a factor of ten in energy costs only a fixed extra depth.'
  - text: About 3 radiation lengths deeper (from about 16 to about 20 X₀).
    correct: true
    why: 'Heitler''s model gives t_max = X₀ ln(E₀/E_c), so a factor of 10 adds ln 10 = 2.3 X₀ at the maximum, and the full containment depth grows by a similar amount: the library''s shower profile gives 16.5 X₀ for 10 GeV and 19.7 X₀ for 100 GeV, a difference of 3.2 X₀ (1.8 cm of lead). This is why the electromagnetic calorimeters of the LHC experiments are about 25 radiation lengths deep whatever the energy of the electrons they will see, up to the TeV.'
  - text: The same depth, since containment is a matter of the material, not the energy.
    why: 'The depth does depend on the energy, but only slowly (as ln E). 25 X₀ is deep enough for the energies at the LHC, but a block that contained 1 GeV electrons well (13 X₀) would let 100 GeV electrons leak.'
```

The real shower is messier. Photons and electrons do not split exactly in half, the number of particles in a generation counts photons as well as electrons, and the energy sharing is random. A better description is a smooth profile in depth, a gamma distribution, with a maximum at $t_{\max} = \ln(E_0/E_c) - 0.5$ for an electron (and $+0.5$ for a photon) in units of $X_0$.:cite[pdg2024] The toy and the better description agree on the scaling, and differ in the details by factors of order one (Heitler's tree has its maximum at $\ln(E_0/E_c)$ rounded up to a whole number of splitting lengths, so it is between 0.5 and 1.2 $X_0$ deeper than the profile's). The shower's *width* is set by the :term[Molière radius]{id=moliere-radius}, $R_M = 21.2\ \text{MeV}\times X_0/E_c$ (1.6 cm in lead, about 10 cm in water), the radius of a cylinder around the axis that holds about 90 % of the energy: the multiple scattering of the low-energy particles spreads the shower sideways, and the scale of that spreading is the same in every material when measured in $R_M$. A shower is a thin pencil, a couple of centimetres across in lead, and one calorimeter cell is about the width of one.

Figure 6.4 is the shower lab. Choose a particle, its energy and a material, and the page draws what the library computes: for an electron or photon, Heitler's cascade (using the library's `heitlerShower`, or yours, once you have written it) and the energy deposited against depth; for a pion, the hadronic profile of the next section; for a muon, the energy it loses.

::shower-lab{n="6.4" caption="The shower lab: fire an electron, a photon, a pion or a muon into lead, iron, copper or water. For an electron or photon the page shows the first five splittings of Heitler's tree, the number of particles in every generation (with equal halves, as in the model, or with random energy sharing, where 'Fire again' shows the shower-to-shower fluctuation), and the depth profile of the energy deposited with the shower maximum and the depth that contains 95 %. Move the thickness slider to see how much of the energy a block of that thickness contains. The numbers come from hep/detector's heitlerShower, longitudinalProfile, Bethe–Bloch and muon-range functions; the picture is a model, not a full simulation."}

```fermi
id: heitler-counts
title: The particles in a shower
prompt: 'A 100 GeV electron enters a block of lead (critical energy 7.43 MeV). Using Heitler''s model, about how many particles are there at the shower maximum?'
answer: 13459
factor: 3
hints:
  - The number at the maximum is N_max = E₀/E_c. Convert E_c to GeV.
explain: "N_max = 100 GeV / 0.00743 GeV ≈ 13,500. The maximum is at t_max = X₀ ln(E₀/E_c) = 0.561 cm × ln 13,459 = 0.561 × 9.5 ≈ 5.3 cm into the lead (the better profile puts it at 5.1 cm). That is how a block of lead the size of a hand turns a single 100 GeV electron into some ten thousand charged particles and photons, whose total energy can be measured."
```

## You write: Heitler's shower

The model is a few lines of code, and the reference one in the library is the version the shower lab uses. You write it; once your function passes its tests, Figure 6.4 will run on yours.

```code
id: heitler-shower
title: Heitler's toy shower
hook: detector.heitlerShower
prompt: |
  Implement `heitlerShower(E0, Ec, rng?)`. Start with one particle of energy `E0` (GeV). In each generation `g = 0, 1, 2, …`
  every particle with energy above `Ec` splits in two: with no `rng` the energy is shared equally, and with an `rng` the first
  particle takes a fraction `f` drawn uniformly between 0.1 and 0.9 (use `uniform(rng, 0.1, 0.9)` from `hep/random`) and the second
  takes the rest. A particle with energy `Ec` or less does not split: it stops and deposits its energy.

  Return a `HeitlerShower`. Its `generations` has one entry per generation: `generation` (g), `depthX0` (g · ln 2, the depth in
  radiation lengths), `count` (the number of particles in that generation), `meanEnergy` (the mean energy per particle, GeV),
  `stopped` (how many of them have `Ec` or less) and `deposited` (their total energy). The shower ends when a generation has no particle
  left to split. Also return `nMax` (the largest `count`), `maxGeneration` (the first generation that reaches it), `tMaxX0`
  (its depth, `maxGeneration · ln 2`), `totalDeposited` (the sum of all the `deposited`: it must equal `E0`) and `totalParticles` (the sum of all the `count`).
starter: |
  import type { HeitlerShower, HeitlerGeneration } from 'hep/detector';
  import { uniform, type Rng } from 'hep/random';

  export function heitlerShower(E0: number, Ec: number, rng?: Rng): HeitlerShower {
    const generations: HeitlerGeneration[] = [];
    // Keep the list of the energies of the particles of the current generation, starting with [E0].
    // For each generation: count them, find the mean energy, let those above Ec split in two
    // (equal halves, or a random fraction if there is an rng) and let the others stop and deposit their energy.
    return { E0, Ec, generations, nMax: 0, maxGeneration: 0, tMaxX0: 0, totalDeposited: 0, totalParticles: 0 };
  }
tests: |
  import { test, expect } from '@pp/test';
  import { heitlerShower } from 'solution';
  import { rng } from 'hep/random';

  test('with equal sharing, 64 GeV with Ec = 1 GeV gives 7 generations of 1, 2, 4, … 64 particles', () => {
    const s = heitlerShower(64, 1);
    expect(s.generations.length).toBe(7);
    s.generations.forEach((g, i) => {
      expect(g.generation).toBe(i);
      expect(g.count).toBe(2 ** i);
      expect(g.meanEnergy).toBeCloseTo(64 / 2 ** i, 9);
      expect(g.depthX0).toBeCloseTo(i * Math.LN2, 12);
    });
    expect(s.nMax).toBe(64);
    expect(s.maxGeneration).toBe(6);
    expect(s.tMaxX0).toBeCloseTo(6 * Math.LN2, 12);
    expect(s.totalParticles).toBe(127);
  });

  test('the number of particles doubles in every generation, and only the last generation stops', () => {
    const s = heitlerShower(100, 0.00743);
    const gens = s.generations;
    for (let i = 1; i < gens.length; i++) expect(gens[i]!.count).toBe(2 * gens[i - 1]!.count);
    for (let i = 0; i < gens.length - 1; i++) expect(gens[i]!.stopped).toBe(0);
    expect(gens.at(-1)!.stopped).toBe(gens.at(-1)!.count);
  });

  test('the maximum is at ln(E0/Ec) rounded up to a whole number of splitting lengths, with about E0/Ec particles', () => {
    for (const [E0, Ec] of [[100, 0.00743], [10, 0.0217], [1000, 0.0783], [5, 0.04]] as const) {
      const s = heitlerShower(E0, Ec);
      const t = Math.log(E0 / Ec);
      expect(s.tMaxX0).toBeGreaterThanOrEqual(t - 1e-9);
      expect(s.tMaxX0).toBeLessThan(t + Math.LN2);
      expect(s.nMax).toBeGreaterThanOrEqual(E0 / Ec - 1e-9);
      expect(s.nMax).toBeLessThan(2 * (E0 / Ec) + 1e-9);
      expect(s.maxGeneration).toBe(Math.ceil(Math.log2(E0 / Ec)));
    }
  });

  test('energy is conserved: everything deposited adds up to E0, for equal and random sharing', () => {
    expect(heitlerShower(50, 0.0074).totalDeposited).toBeCloseTo(50, 9);
    for (let seed = 1; seed <= 15; seed++) {
      const s = heitlerShower(50, 0.0074, rng(seed));
      expect(Math.abs(s.totalDeposited / 50 - 1)).toBeLessThan(1e-9);
      expect(s.generations.reduce((a, g) => a + g.deposited, 0)).toBeCloseTo(s.totalDeposited, 9);
      expect(s.generations.reduce((a, g) => a + g.count, 0)).toBe(s.totalParticles);
    }
  });

  test('with random sharing the shower fluctuates but is reproducible, and every stopped particle has Ec or less', () => {
    const a = heitlerShower(20, 0.01, rng(3));
    const b = heitlerShower(20, 0.01, rng(3));
    const c = heitlerShower(20, 0.01, rng(4));
    expect(a.totalParticles).toBe(b.totalParticles);
    expect(a.totalParticles).not.toBe(c.totalParticles);
    const stopped = a.generations.reduce((n, g) => n + g.stopped, 0);
    // all stopped particles have E ≤ Ec, so there are at least E0/Ec of them; each has at least 0.1 Ec, so at most 10 E0/Ec
    expect(stopped).toBeGreaterThanOrEqual(20 / 0.01 - 1e-9);
    expect(stopped).toBeLessThanOrEqual(10 * (20 / 0.01));
    for (const g of a.generations) if (g.stopped > 0) expect(g.deposited / g.stopped).toBeLessThanOrEqual(0.01 * (1 + 1e-12));
  });
solution: |
  import type { HeitlerShower, HeitlerGeneration } from 'hep/detector';
  import { uniform, type Rng } from 'hep/random';

  export function heitlerShower(E0: number, Ec: number, rng?: Rng): HeitlerShower {
    const generations: HeitlerGeneration[] = [];
    let energies: number[] = [E0];
    let totalDeposited = 0;
    let totalParticles = 0;
    for (let g = 0; energies.length > 0; g++) {
      const next: number[] = [];
      let sum = 0;
      let stopped = 0;
      let deposited = 0;
      for (const e of energies) {
        sum += e;
        if (e <= Ec) {
          stopped++;
          deposited += e;
        } else {
          const f = rng ? uniform(rng, 0.1, 0.9) : 0.5;
          next.push(e * f, e * (1 - f));
        }
      }
      generations.push({ generation: g, depthX0: g * Math.LN2, count: energies.length, meanEnergy: sum / energies.length, deposited, stopped });
      totalDeposited += deposited;
      totalParticles += energies.length;
      energies = next;
    }
    let nMax = 0;
    let maxGeneration = 0;
    for (const gen of generations) {
      if (gen.count > nMax) {
        nMax = gen.count;
        maxGeneration = gen.generation;
      }
    }
    return { E0, Ec, generations, nMax, maxGeneration, tMaxX0: maxGeneration * Math.LN2, totalDeposited, totalParticles };
  }
hints:
  - 'Keep an array `energies` for the current generation. A `for` loop over generations that runs while the array is not empty builds the next array: a particle above Ec pushes two energies, `e * f` and `e * (1 - f)`.'
  - 'Energy conservation is automatic if you only ever deposit the energy of the particles that stop, and split the others exactly: e * f + e * (1 − f) = e.'
  - 'The maximum: loop over the generations and keep the first one whose `count` is strictly larger than the best so far.'
```

:::programmer
A shower is a **branching process**, a tree that grows by recursion until a stopping condition, like a recursive divide-and-conquer algorithm whose recursion ends when the problem is small enough. The "problem size" is the energy and the base case is $E \le E_c$. The total work (the number of particles) is proportional to the input ($E_0/E_c$), and the depth of recursion to its logarithm: exactly the behaviour of a balanced binary tree over $N$ items. The energy resolution has the same origin as the error of a Monte Carlo estimate: the calorimeter effectively counts $N \propto E$ particles with Poisson fluctuations, so the relative error is $1/\sqrt{N}$, the one fact you need to know about sampling.
:::

## Hadronic showers

A hadron, a particle made of quarks, such as a pion, a proton or a neutron, is subject to the strong interaction as well as the electromagnetic one. A charged hadron ionises like any other charged particle, but in addition it can collide with an atomic *nucleus*. In such a collision the nucleus breaks up and new hadrons are made (mostly pions), which have their own collisions. The distance a hadron travels before its first nuclear collision is exponentially distributed, with mean the :term[nuclear interaction length]{id=interaction-length} $\lambda_I$, which is longer than the radiation length by a large factor: 17.6 cm in lead and 16.8 cm in iron (against 0.56 and 1.76 cm). The reason is that a nucleus is a small target. The cascade that follows is called a :term[hadronic shower]{id=hadronic-shower}.

A hadronic shower is deeper, wider and messier than an electromagnetic one. It is deeper because $\lambda_I$ is long; its maximum is at about $(0.2\ln E + 0.7)$ interaction lengths (E in GeV), and 95 % of a 100 GeV shower is within about 6 $\lambda_I$ of the first interaction in the library's model. That is why hadron calorimeters are made from thick absorber of iron or copper, about 8–10 interaction lengths deep; the HCAL of the course detector is 10 $\lambda_I$ of iron, 1.7 metres. It is messier because a good part of the energy goes into things that cannot be seen: neutrinos from pion decays, the energy it takes to break up nuclei and slow neutrons. Part of the energy goes into $\pi^0$ mesons, which decay at once to two photons and start electromagnetic showers inside the hadronic one. As a result the response of a real calorimeter to hadrons is lower than to electrons of the same energy and the resolution is worse: the course detector's HCAL has $\sigma/E = 100\%/\sqrt{E} \oplus 5\%$, the ECAL 2.7 %/$\sqrt{E}$ ⊕ 0.3 %. (The symbol ⊕ means addition in quadrature.) The library does not simulate the particles of a hadronic shower one by one: it draws the visible energy from a gamma-distributed profile with these resolution terms.

A rule of thumb follows. The electromagnetic calorimeter is the first layer a hadron meets, and is made of a short-$X_0$ material in a few tens of radiation lengths; for hadrons that same layer is only about one interaction length thick. So many hadrons begin their shower there, and the rest in the hadronic calorimeter behind it. The same shower is measured by both, and a detector design has to say which to trust (Chapter 8).

## Muons: the particle that goes through

A muon is 207 times as heavy as an electron, so it radiates $4\times10^{4}$ times less, and it does not take part in the strong interaction. It loses energy by ionisation at the minimum rate, and at high energies by radiation too; the energy at which the two are equal is a few hundred GeV in iron (about 340 GeV in the library's approximate model, against 347 GeV in the standard tables:cite[pdg2024]). Below that it is simply a minimum-ionising particle: a 10 GeV/*c* muon has a mean range of about 7 m of iron and a 100 GeV/*c* muon of 54 m (the library's `muonRange`). A detector surrounded by a metre or two of steel is therefore opaque to everything except muons (and neutrinos), and anything that comes out of the far side is almost certainly a muon. That is what a **muon system** is: a set of detectors outside all the absorber (Chapter 7).

## Light from fast particles

Two further effects are used for particle identification, not for measuring energy. Both are small, and both come from the same fact: a charged particle moving faster than light does in a medium disturbs it.

**:term[Cherenkov radiation]{id=cherenkov-radiation}.** The speed of light in a medium of refractive index $n$ is $c/n$, and a particle can travel faster than that without breaking any law, since its speed is below $c$. When it does, it emits light at a fixed angle to its path, as a boat's wake forms a cone, with

$$ \cos\theta_C = \frac{1}{n\beta}, $$

and nothing at all when $\beta < 1/n$. In water ($n = 1.33$) the threshold is $\beta = 0.75$, the angle at $\beta \to 1$ is $41°$, and a muon radiates only above a momentum of 120 MeV/*c*, an electron above a kinetic energy of 0.26 MeV. Measuring the angle and the momentum gives the speed and so the mass; measuring only whether the light is there tells whether the particle was above a threshold. Large tanks of water or ice, viewed by light sensors on their walls, detect neutrinos this way (Chapter 31): the neutrino interacts and produces a fast electron or muon, which makes the light.

:::history{year=1934 title="A glow that was not fluorescence" people="Pavel Cherenkov, Ilya Frank, Igor Tamm" source="Sources: Cherenkov (1934), Doklady Akademii Nauk SSSR 2, 451; Frank and Tamm (1937); Nobel Prize in Physics 1958."}
In 1934 Pavel Cherenkov, working in Moscow, published observations of visible light from pure liquids bombarded with the gamma rays of a radioactive source, under the title "Visible emission of clean liquids by action of γ radiation".:cite[cherenkov1934] The light was not the ordinary fluorescence that was already known. Three years later Ilya Frank and Igor Tamm explained it as the coherent radiation of a charged particle moving faster than light in the medium.:cite[frank1937] The three shared the 1958 Nobel Prize in Physics.:cite[nobel-cherenkov] Cherenkov counters, and later the huge water tanks of neutrino physics, are the descendants.
:::

**:term[Transition radiation]{id=transition-radiation}.** When a very fast particle crosses the boundary between two materials with different dielectric properties it emits radiation, a few X-ray photons, with a total energy that grows with the particle's Lorentz factor $\gamma$. A stack of many thin foils with gaps between them multiplies the number of boundaries. Since $\gamma$ is $E/m$, an electron radiates when a pion of the same momentum does not: this is used to tell electrons from pions at momenta where other methods fail. The straw-tube tracker of ATLAS is interleaved with radiator material for exactly this purpose.:cite[atlas2008]

## Why neutrinos escape

Everything above came from the electromagnetic interaction, or the strong. A neutrino has neither. It has no electric charge, so it does not ionise and does not radiate, and it is not a hadron, so it feels no strong interaction. It interacts only through the weak force, Chapter 22's subject, and the weak interaction is feeble at ordinary energies: at a few GeV the cross-section of a neutrino with a nucleon is about $0.7\times10^{-38}\ \mathrm{cm^2}$ for each GeV of the neutrino's energy.:cite[pdg2024] A cross-section is an area, and so is a measure of how big a target a nucleon appears to be to the neutrino. It is $10^{-38}$ cm², against $10^{-26}$ cm² (tens of millibarns) for a proton–proton collision.

```fermi
id: neutrino-mfp
title: The mean free path of a neutrino in iron
prompt: 'A neutrino of 10 GeV crosses iron (density 7.87 g/cm³). Take its cross-section per nucleon to be 0.7 × 10⁻³⁸ cm² for each GeV of energy, and the number of nucleons per cm³ of iron to be density × Avogadro''s number (about 6 × 10²³ per gram). What is its mean free path, in kilometres?'
answer: 3.0e7
unit: km
factor: 3
hints:
  - The cross-section at 10 GeV is 7 × 10⁻³⁸ cm². The number of nucleons per cm³ is about 7.87 × 6.02 × 10²³ = 4.7 × 10²⁴.
  - The mean free path is 1/(n σ), in centimetres. Divide by 10⁵ for kilometres.
explain: "n σ = 4.7 × 10²⁴ × 7 × 10⁻³⁸ = 3.3 × 10⁻¹³ per cm, so the mean free path is 3 × 10¹² cm = 3 × 10⁷ km. The diameter of the Earth is 1.3 × 10⁴ km, so an Earth made of iron throughout would be some 2,400 times too thin to stop half of the 10 GeV neutrinos crossing it. A detector three metres thick catches about one in 10¹⁰. To see neutrinos anyway, experiments need very large numbers of them and very massive detectors (Chapter 31). At the LHC the neutrinos of a collision cannot be detected, only deduced, from the momentum that is missing (Chapter 7)."
```

## Under the hood: material effects as random numbers

The library does not simulate matter atom by atom. It treats each effect as a random number drawn from a distribution that was worked out once, and the draws are cheap. The ionisation loss in a thin layer is a Landau-distributed number with a mean from Bethe–Bloch:

```ts
// hep/detector/physics.ts
export function landau(rng: Rng, mpv = 0, xi = 1): number {
  return mpv + xi * (landauLambda(rng) - LANDAU_MODE);
}

export function mostProbableLoss(mat: Material | string, xGcm2: number, betaGamma: number, z = 1): number {
  // Bichsel's form of the Landau–Vavilov peak: Δp = ξ [ ln(2 m_e c² β²γ² / I) + ln(ξ/I) + 0.200 − β² − δ(βγ) ]
  ...
}
```

where `landauLambda` inverts the cumulative distribution from a table of its quantiles, so that drawing a number takes one table lookup, with no integration. Multiple scattering is a Gaussian draw with the width of Highland's formula, applied as two independent kicks in the two transverse planes. An electromagnetic shower in the calorimeter is not tracked particle by particle: its energy is spread over depth by a gamma distribution with the shape given in the previous sections,

```ts
export function longitudinalProfile(E0: number, t: number, Ec: number, kind: 'electron' | 'photon' = 'electron'): number {
  if (t <= 0) return 0;
  const { a, b } = showerShape(E0, Ec, kind);   // b = 0.5, a = 1 + b·t_max, t_max = ln(E0/Ec) ∓ 0.5
  return E0 * Math.exp(Math.log(b) + (a - 1) * Math.log(b * t) - b * t - lnGamma(a));
}
```

and the visible energy of the whole shower is multiplied by a Poisson draw, so that the $a/\sqrt{E}$ term of the resolution *emerges* from the counting statistics instead of being put in by hand. The calorimeter's constant term and electronic noise are added to it. The whole detector simulation is therefore a pipeline of distributions, one per effect, and it runs at about 10⁴ simple events per second.

:::experiments
The tool the experiments use for this is **Geant4**, a simulation toolkit developed at CERN and by a worldwide collaboration. It follows each particle in small steps through a three-dimensional model of the detector, choosing at each step whether an interaction happens from tables of measured and calculated cross-sections, and creating the secondary particles. It reproduces the showers in far more detail than this chapter's parametrisation, and it is correspondingly slow, enough that experiments generate most of their simulated events with simpler and faster parametrisations (a "fast simulation") and reserve the full one for the cases where details matter. The two LHC detectors made different choices of calorimeter, too: CMS's electromagnetic calorimeter is a block of lead-tungstate crystals in which the shower is entirely contained and entirely measured (a *homogeneous* calorimeter), and ATLAS's is made of plates of lead interleaved with liquid argon, in which only a fraction of the shower's energy is sampled (a *sampling* calorimeter), which is cheaper and coarser. The library's `cms-like` and `atlas-like` presets (Chapter 7) differ in just this way, in the stochastic term $a$ of the resolution.
:::

## What comes next

Everything in this chapter is a property of one particle in one material. A detector must be made of several materials in the right order, with the right thicknesses, and with a magnetic field, so that a single event is sorted into its tracks, its electromagnetic showers, its hadronic showers and its muons, and so that what is *missing* can be inferred. [Chapter 7](/chapters/building-a-detector/) puts the pieces together as an onion of concentric layers and lets you design one within a budget. Chapter 8 writes the software that turns what the layers record back into particles.

## Further reading

- The Particle Data Group's review chapters on the passage of particles through matter and on the atomic and nuclear properties of materials (:cite[pdg2024]); every number in the table is rounded from them.
- Bethe's 1930 paper and Landau's of 1944 for the originals (:cite[bethe1930,landau1944]), and Highland's short note on multiple scattering (:cite[chambers-highland1975]).
- Heitler's *The Quantum Theory of Radiation* for the toy model (:cite[heitler1954]), and Cherenkov's 1934 paper for the glow (:cite[cherenkov1934]).
