---
number: 10
title: Cosmic rays, pions and muons
summary: Particles from space strike the atmosphere and make showers. In those showers, a generation before any accelerator could reach the energies, physicists found the pion that Yukawa had predicted, and a heavier cousin of the electron that nobody had.
duration: About 2½ hours
prerequisites: [antimatter, particles-through-matter]
---

Hold out your hand, palm up. About once a second, a particle that was made in the upper atmosphere passes through it. Each is a **muon**, a particle like the electron but 207 times heavier. It was born as the decay product of a pion, which was made when a nucleus of the air was hit by a proton from space, 10 to 20 kilometres above you; it has travelled at 99.9 % of the speed of light or more, passed through the roof, and will pass through the floor and the first few metres of rock. A square centimetre of the ground is crossed by about one of them per minute.

```fermi
id: muons-palm
title: Muons through your hand
prompt: The Particle Data Group's rule of thumb is that a horizontal detector at sea level is crossed by about 1 cosmic-ray muon per cm² per minute. About how many muons cross your outstretched palm (take 100 cm²) in one minute?
answer: 100
factor: 3
hints:
  - The rate is proportional to the area. Multiply the rate per cm² by the number of cm².
explain: "100 cm² × 1 cm⁻² min⁻¹ = 100 per minute, a little under 2 per second. The rule of thumb is itself good to a factor of about 1.5 (the integral of the PDG's vertical intensity over the sky gives 0.66 cm⁻² min⁻¹ for muons above 1 GeV, Fig. 10.4), so the answer is between 70 and 170 per minute. They are minimum-ionising particles and pass through the hand without harm, as they pass through everything else: they are part of the natural background radiation at a level far below that of the radon in the air."
```

This chapter is about where those muons come from and what they taught. It is a history of a few years, 1912 to 1947, in which the only source of particles of more than a few MeV was the sky, and the instruments were balloons, cloud chambers and photographic plates. By the end of it the pion, the muon and (in Chapter 11) the strange particles had been found. The chapter's flagship is a toy simulation of one shower, and the physics it exercises is that of Chapter 2: special relativity makes a particle that lives for two microseconds cross fifteen kilometres.

## Where cosmic rays come from, and how they were found

In the early 1900s physicists used the electroscope, an instrument in which two thin gold leaves repel each other when they carry charge, and fall together when the air around them is ionised by radioactivity. Electroscopes were found to discharge slowly even when they were shielded from every known source. The obvious explanation was radioactivity in the ground, and it makes a prediction: climb away from the ground and the discharge rate should fall.

Victor Hess tested this in 1912 by carrying electroscopes in balloons. In seven flights between April and August he rose as high as about 5,300 metres. The rate fell a little just above the ground and then rose: between about 1,000 and 2,000 m it was increasing again, and at 4,000 to 5,200 m it was more than twice the rate at the ground. He concluded that a radiation of very high penetrating power enters the atmosphere from above.:cite[hess1912] The radiation was soon called **cosmic rays**.

:::history{year=1912 title="Hess takes an electroscope up in a balloon" people="Victor F. Hess" source="Source: Hess (1912)."}
Hess made seven balloon ascents in 1912, carrying sealed electroscopes with him. They showed the ionisation of the air falling as he left the ground, as expected if it came from radioactivity in the Earth, then increasing with height, until at 4,000–5,200 m it exceeded the ground-level rate by more than 100 %. The flight of 7 August 1912 reached about 5,300 m. Because the effect was the same by day and during a partial eclipse of the Sun, he argued that the Sun was not the source.:cite[hess1912] Hess shared the 1936 Nobel Prize in Physics with Carl Anderson, the discoverer of the positron (Chapter 9).:cite[nobel-physics]
:::

The primary cosmic rays are mostly protons, with some helium and heavier nuclei, and a tiny fraction of electrons; their energies run from below a GeV to more than $10^{20}$ eV. The flux falls steeply with energy: it steepens at about $3\times10^{15}$ eV, a feature called the knee.:cite[pdg-cosmic] The most energetic single particle ever recorded, by the Fly's Eye detector in Utah in 1991, had an energy of about $3\times10^{20}$ eV: some 50 joules, the kinetic energy of a well-thrown baseball, in one particle.:cite[bird1995] Their origin is a question of astrophysics: the lower energies are thought to be accelerated by the shock waves of supernova remnants (see [the astrophysics course](/astrophysics/ch/stellar-death/)), and the highest are still debated. For this course they matter as projectiles: nature supplies, free and without a licence, protons at energies that no accelerator on Earth can reach. A proton of $10^{15}$ eV hitting a stationary nucleon has $\sqrt{s} \approx \sqrt{2 E m_p} = 1.4$ TeV, comparable with the colliders of the 1980s and 1990s, and the LHC's 13.6 TeV takes a fixed-target energy of about $10^{17}$ eV (the Fermi estimate of Chapter 2).

## Air showers

A cosmic ray does not reach the ground. The atmosphere above sea level is a layer of 1,030 grams of air above each square centimetre, and the nuclear interaction length of a proton in air is about 80 g/cm², so the air is about 13 interaction lengths thick, and a proton makes its first interaction in the top tenth of it. What happens next is a cascade, which Pierre Auger and his colleagues identified in 1938 by observing that detectors separated by many metres fired in coincidence: an **extensive air shower**, the product of a single primary of $10^{15}$ eV or more.:cite[auger1939]

The cascade has three parts, and you can follow each with what you know.

- **The hadronic core.** The primary proton hits a nucleus of nitrogen or oxygen and makes tens of new particles, mostly pions: roughly one third neutral and two thirds charged. The proton and the charged pions go on, and interact again, and so on, with the energy shared among more and more particles.
- **The electromagnetic part.** A neutral pion decays in $8.4\times10^{-17}$ s, far too fast to interact, into two photons. Each photon makes an $e^+e^-$ pair (Chapter 9) in the field of an air nucleus, the electron and positron radiate photons (Chapter 6), and so on: the **electromagnetic shower** of Chapter 6, whose energy ends up as ionisation of the air. Most of the primary's energy ends up this way, and most of the electrons stop before the ground.
- **The muons.** A charged pion has two ways to end: it can interact with another nucleus, or decay to a muon and a neutrino. Which comes first depends on its energy. The decay length is $\gamma c\tau = (E/m_\pi)\times 7.8$ m (the lifetime from the particle table gives $c\tau = 7.80$ m), which grows in proportion to the energy, while the interaction length, measured in grams, becomes a larger *distance* as the air thins. High up, a pion of a few GeV decays; at a hundred GeV it more often interacts again. Muons interact only weakly and electromagnetically (they are the electron's heavy cousins), lose about 2 MeV for each g/cm² of air by ionisation, and so travel through the rest of the atmosphere with little hindrance. They are the part of the shower that reaches the ground in numbers.

**Heitler and Matthews' model.** A simple count explains how many muons to expect. In the model of James Matthews, which extends Walter Heitler's electromagnetic model, each hadronic interaction makes a fixed number of pions, one third neutral; the charged ones carry on until their energy falls to a critical value $E_c^\pi$ (about 20 GeV in the model, where decay beats interaction), when each one decays to a muon. The energy of the primary is shared out over the generations, so the number of muons is a power of the primary energy, $N_\mu \propto E_0^{\beta}$ with $\beta$ a little below 1, which Matthews puts at about 0.9.:cite[matthews2005] The same count makes the electromagnetic part grow in proportion to $E_0$. A heavier primary nucleus makes more muons, which is how experiments tell protons from iron.

### A toy shower

Here is a toy that does the counting honestly. A proton of $10^{13}$ to $10^{16}$ eV enters an isothermal atmosphere (the density falls by $e$ for each 7.5 km of height). Its hadronic cascade is followed particle by particle, with the multiplicity rising slowly with energy; every neutral pion's energy is set aside as electromagnetic; every charged pion either interacts again or decays, with the decay probability from its lifetime and its energy; and every muon is followed to the ground, losing 2 MeV per g/cm² and decaying with its own lifetime. The simplifications are listed at the foot of the figure and in the header of the code, and its absolute numbers are the toy's.

```predict
q: 'A muon of mass 0.106 GeV has a mean lifetime of 2.2 microseconds at rest, so it can travel about 660 metres at nearly the speed of light before it is likely to decay. Muons in the shower are born about 15 kilometres up. Without any effect of relativity, what fraction of them would reach the ground, to within an order of magnitude or so?'
options:
  - text: About a half, since muons are the most penetrating particles in a shower.
    why: 'Penetrating describes how a muon interacts with matter, not how long it lives. A muon decays whatever it passes through.'
  - text: About 10⁻¹⁰, which is to say none.
    correct: true
    why: 'The survival probability over a distance d is exp(−d/cτ) = exp(−15,000/660) = exp(−23) = 1.3 × 10⁻¹⁰. Out of the 20,000 or so muons of a 10¹⁵ eV shower, you would expect none to arrive. The muons that do arrive are the evidence that the clock of a fast particle runs slow.'
  - text: About one in ten.
    why: 'That would need the muon to travel a few cτ. 15 km is 23 times cτ, and the survival probability falls exponentially: exp(−23).'
```

::air-shower{n="10.1" seed=4 caption="A toy air shower, seeded and repeatable. Choose the primary's energy and the zenith angle, and switch the muons' time dilation off to see what the muons would do without it. The left panel shows a sample of the tracks (vertical and lateral scales differ); the right panel counts where the muons are born and how many arrive. A teaching toy: no kaons, no electromagnetic cascade, straight tracks, and one multiplicity law."}

Some numbers from the default setting (a vertical proton of $10^{15}$ eV, seed 4), which the tests pin down. The proton interacts for the first time about 21 km up. The cascade makes about 29,000 charged pions and about 21,000 muons. With time dilation 55 % of the muons arrive at the ground, some 11,600 of them, with a median energy of about 3.6 GeV: they lose a good fraction of their energy to ionisation on the way. Without dilation, the expected number of arrivals is only 1,360, 6 % of the muons, and 99 % of those are muons that were born in the lowest 3 km. It is not zero, because the pions of low energy decay at every height down to the ground, and the lowest of those make muons that need no dilation to arrive. It is a factor of 8.6 fewer, and it moves the arrivals from the whole atmosphere to the last two or three kilometres.

The toy also reproduces the expected scaling. The number of muons made by a $10^{16}$ eV primary divided by the number made by a $10^{15}$ eV primary is 8.3, which corresponds to $\beta = 0.92$, close to the 0.9 of Matthews' model; and a shower at a zenith angle of 60° delivers 32 % of its muons, where the vertical one delivers 55 %, because the muons have twice the air to cross. The absolute number of muons that a toy makes should not be trusted to better than a factor of two or three. Real air showers are simulated with codes such as CORSIKA (below).

## Yukawa's argument

The pion was predicted before it was found. In 1935 Hideki Yukawa asked how protons and neutrons are held together in a nucleus. The electromagnetic force acts through the exchange of a photon, and has a range that is infinite, because the photon is massless: the electric force falls as $1/r^2$ at all distances. A force between nucleons has a range of about the size of a nucleus, a few femtometres, beyond which it vanishes. Yukawa proposed that it was also the result of the exchange of a particle, and that a *massive* particle gives a short-range force.

The argument uses the uncertainty principle. To emit a particle of mass $m$ the nucleon has to borrow an energy $mc^2$, which it can do for a time of about $\hbar/mc^2$; in that time the particle can travel at most $c$ times as far, which gives a range

:::equation{#yukawa-range caption="Yukawa's range of a force carried by a particle of mass m."}
$$\term{R}{R} = \frac{\hbar}{m c} = \frac{\term{hbarc}{\hbar c}}{\term{mc2}{m c^2}}$$

```terms
R:
  label: 'R, the range of the force'
  what: The distance beyond which the force falls off exponentially, e^{−r/R}, instead of as a power of the distance.
  why: The borrowed energy mc² can be held for a time of about ħ/mc² only, and in that time the exchanged particle travels about c times that.
  effect: A massless exchanged particle (the photon) gives an infinite range, a heavy one a short range. The W, at 80 GeV, gives about 2.5 × 10⁻³ fm, the range of the weak force (Chapter 22).
hbarc:
  label: 'ħc, the conversion factor'
  what: 197.327 MeV fm (Chapter 1).
  why: It converts between an energy and a length, as every use of natural units does.
  effect: Using it, a range in femtometres gives a mass in MeV.
mc2:
  label: 'mc², the rest energy of the exchanged particle'
  what: The energy that must be borrowed to create the particle.
  why: It sets the time that the borrowing can last.
  effect: A range of 1.4 fm gives 141 MeV, which is 276 electron masses.
```
:::

The nuclear force has a range of about 1 to 2 fm. Inverted, the formula gives $mc^2 = \hbar c/R$: for 2 fm, 99 MeV, or 193 electron masses; for 1.4 fm, 141 MeV. Yukawa's prediction was of a particle with a mass of roughly two hundred electron masses, heavier than an electron, lighter than a proton: a **meson**, from the Greek for "middle". The derivation, and the Fourier transform that gives the $e^{-r/R}/r$ shape of the potential, are in Chapter 14. The figure below, which is the same one Chapter 14 uses, lets you move the mass and watch the range, or give a range and read off the mass.

::propagator{n="10.2" caption="Yukawa's argument. Left tab: the range of a force falls as the exchanged particle's mass grows. Right tab: the argument run backwards, from the nuclear force's range of 1 to 2 fm to a mass of 100 to 200 MeV."}

:::history{year=1935 title="Yukawa predicts a particle from the range of a force" people="Hideki Yukawa" source="Source: Yukawa (1935)."}
Yukawa, then a young lecturer at Osaka, published *On the interaction of elementary particles. I* in 1935 in the *Proceedings of the Physico-Mathematical Society of Japan*. It proposed a field of a new kind, whose quanta are massive and which couples to nucleons, and it estimated the mass of the quantum from the range of nuclear forces at about two hundred times the electron's.:cite[yukawa1935] A particle of about that mass turned up in cosmic rays two years later, and for a decade was taken to be it.
:::

## A particle of the right mass, and the wrong behaviour

In 1936 and 1937 Carl Anderson and Seth Neddermeyer, and independently Jabez Street and Edward Stevenson, studied the cosmic-ray particles that penetrate a thick metal plate, in cloud chambers. Many of them were neither electrons, which radiate and shower in metal, nor protons, which ionise too heavily for their momentum. Their mass was intermediate: between the electron's and the proton's, and apparently close to Yukawa's value.:cite[neddermeyer1937,street1937] The obvious conclusion was that cosmic rays had delivered Yukawa's meson.

:::history{year=1937 title="A particle of intermediate mass" people="Seth Neddermeyer, Carl Anderson, Jabez Street, Edward Stevenson" source="Sources: Neddermeyer and Anderson (1937); Street and Stevenson (1937)."}
Neddermeyer and Anderson reported in *Physical Review* in 1937 that the penetrating particles in cosmic rays at sea level behaved neither as electrons nor as protons.:cite[neddermeyer1937] Street and Stevenson reported a track in a cloud chamber whose curvature and ionisation indicated a mass intermediate between the electron's and the proton's.:cite[street1937] The particle was first called a mesotron, then the μ meson; the modern name is the muon, and its mass is 105.66 MeV, 206.77 electron masses: a little under Yukawa's estimate.
:::

The problem emerged over the next decade. Yukawa's particle is exchanged between nucleons, so it must interact strongly with nuclei. These particles did the opposite: they passed through very great thicknesses of matter, as a strongly interacting particle cannot. In 1947 Marcello Conversi, Ettore Pancini and Oreste Piccioni did the decisive experiment in Rome. A negative meson that stops in matter is captured by an atom and cascades down to the lowest orbit, where it either decays or is absorbed by the nucleus. Fermi, Teller and Weisskopf had calculated that, if the particle were Yukawa's, the nuclear absorption would take place enormously faster than the decay, so that a negative one stopped in a light element would not decay at all.:cite[ftw1947] Conversi, Pancini and Piccioni stopped negative particles in carbon and saw them decay, as the positive ones do.:cite[conversi1947] The cosmic-ray muon does not feel the nuclear force. It is not Yukawa's particle.

:::history{year=1947 title="Not the meson of the nuclear force" people="Marcello Conversi, Ettore Pancini, Oreste Piccioni" source="Sources: Conversi, Pancini and Piccioni (1947); Fermi, Teller and Weisskopf (1947)."}
The muon had been taken for the carrier of the nuclear force for ten years. Fermi, Teller and Weisskopf computed that a negative meson of Yukawa's kind, stopped in matter, should be absorbed by a nucleus far faster than it could decay.:cite[ftw1947] Conversi, Pancini and Piccioni, working in Rome during and just after the war, found the contrary for negative particles stopped in carbon: they decayed.:cite[conversi1947] The particle that cosmic rays had delivered at sea level was not the particle of the nuclear force. There was another one, and it was in the sky as well.
:::

:::note
**Who ordered that?** The muon has no role in ordinary matter that the electron does not already play, and no one had predicted it. Isidor Rabi is reported to have said, on hearing of it, "Who ordered that?" It is a well-known remark about the muon, and I give it here as one, not as a verified quotation. The question has not gone away: the electron, the muon and the tau (Chapter 24) are three copies of one pattern with different masses, and there is still no explanation of why there are three.
:::

## The pion

The meson that carries the nuclear force had to be found, and the place to look was the same: high in the atmosphere, where the charged pions made by the primary protons live for a short time before they decay, or collide. At the University of Bristol, Cecil Powell's group used **photographic emulsions**, plates with a gelatine layer a fraction of a millimetre thick that is loaded with silver bromide grains: a charged particle sensitises the grains along its path, and after development the track is a line of black dots, to be measured under a microscope. Emulsions were small, cheap, and accumulated tracks continuously, so they could be left on a mountain for weeks. Plates exposed at the Pic du Midi observatory in the Pyrenees, and later at Chacaltaya in the Bolivian Andes at more than 5,000 m, showed in 1947 a new kind of event: a slow meson coming to rest, and from the end of its track a second, lighter meson emerging.:cite[lattes1947]

The first was the pion, and the second the muon. The decay $\pi^+ \to \mu^+ \nu$ is a two-body decay at rest, so the muon always has the same energy. With the masses of the particle table, the muon's energy is

$$E_\mu = \frac{m_\pi^2 + m_\mu^2}{2 m_\pi} = 109.78\ \text{MeV},\qquad T_\mu = E_\mu - m_\mu = 4.12\ \text{MeV},$$

(Chapter 2's two-body formula), and so every such muon has the same range in the emulsion: a short track of fixed length, the signature that made the decay chain recognisable among the thousands of tracks on a plate. The muon in turn decays after 2.2 microseconds to an electron and two neutrinos, which one sees as a thin track leaving the end of the muon's track. The pion is the Yukawa meson: it feels the strong force, the nuclear force at long range, and its mass is 139.57 MeV, which Yukawa's argument gives for a range of 1.41 fm.

:::history{year=1947 title="The pion in the emulsions" people="César Lattes, Giuseppe Occhialini, Cecil Powell, Hugh Muirhead" source="Source: Lattes, Muirhead, Occhialini and Powell (1947)."}
The Bristol group's paper, *Processes involving charged mesons*, appeared in *Nature* on 24 May 1947. It described tracks in nuclear emulsions exposed at high altitude, in which a meson stopped and a lighter meson emerged from the end of its track.:cite[lattes1947] The heavier particle was the $\pi$ meson, the lighter the $\mu$. Powell received the Nobel Prize in Physics in 1950.:cite[nobel-physics]
:::

The sequence is completed by the decay of the pion: of the $\pi^+$'s decays, 99.988 % are to $\mu^+\nu_\mu$ and 0.012 % to $e^+\nu_e$, from the particle table. Why the second is so rare, though the electron mode has far more energy available, is a question about helicity that Chapter 22 answers.

## Why the muon reaches the ground

The muon's lifetime at rest is $\tau = 2.197\ \mu$s. The distance it travels in one lifetime at the speed of light is $c\tau = 658.6$ m. The probability that a muon survives a flight of length $d$ is a decay law, with the lifetime stretched by time dilation (Chapter 2):

:::equation{#muon-survival caption="The probability that a muon survives a distance d without decaying."}
$$P(d) = \exp\!\left(-\frac{\term{d}{d}}{\term{betagamma}{\beta\gamma}\,\term{ctau}{c\tau}}\right)\qquad \beta\gamma = \sqrt{\left(\frac{E}{m_\mu}\right)^2 - 1}$$

```terms
d:
  label: 'd, the distance flown'
  what: The path length from the point where the muon is born to the ground, measured in the frame of the Earth.
  why: It is what the muon has to cross, and for a particle on a straight line it is the height divided by the cosine of the zenith angle.
  effect: Doubling the distance squares the survival probability.
betagamma:
  label: 'βγ, the dilation factor times the speed'
  what: The momentum divided by the mass, p/m. For a particle moving at nearly the speed of light, it is about the energy divided by the mass.
  why: In the muon's own frame its clock reads the proper time, which runs slower than the Earth's by γ. The decay length in the Earth's frame is βγ cτ.
  effect: A 3 GeV muon has βγ = 28.4. A 100 GeV muon, 946.
ctau:
  label: 'cτ, the proper decay length'
  what: The speed of light times the mean lifetime at rest, 2.197 µs, which is 658.6 m.
  why: It is the distance a muon would travel in one lifetime if there were no relativity.
  effect: Without time dilation the exponent is d/cτ, and a 15 km flight gives exp(−22.8) = 1.3 × 10⁻¹⁰.
```
:::

A muon of 3 GeV born 15 km up has $\beta\gamma = 28.4$, a decay length of 18.7 km and a survival probability of $\exp(-15/18.7) = 0.45$. Without dilation the same muon would survive with a probability of $1.3\times10^{-10}$. There are two ways to describe this, and both give the same number. In the Earth's frame, the muon's clock runs slow by $\gamma$ and it lives 28 times longer than at rest. In the muon's own frame the clock is fine and the distance is what changes: the atmosphere moves towards the muon at nearly the speed of light, and its thickness is contracted by $\gamma$ to $15\ \text{km}/28.4 = 530$ m, less than $c\tau$. The astrophysics course tells the same story from the side of relativity ([Muons from the sky](/astrophysics/ch/relativity/)).

::muon-survival{n="10.3" caption="The probability that a muon reaches the ground, against its energy, for a chosen height of birth. The solid curve includes time dilation; the dashed line does not (and does not depend on energy). The dot follows the energy slider. No energy loss is included here; the shower toy includes it."}

:::history{year=1941 title="Rossi and Hall measure the dilation of a decay" people="Bruno Rossi, David B. Hall" source="Sources: Rossi and Hall (1941); Frisch and Smith (1963)."}
In 1941 Bruno Rossi and David Hall, at the University of Chicago, measured how the intensity of cosmic-ray muons (then called mesotrons) falls between two altitudes in Colorado, at Denver and at Echo Lake, about 1,600 m higher. They compared groups of different momentum, selected by the thickness of lead through which they passed, and found that the softer group decayed at about three times the rate of the more penetrating one, in agreement with the dilation of time for a moving clock. From the measurements at a momentum of about 500 MeV/c they deduced a mean lifetime at rest of $(2.4 \pm 0.3)\times10^{-6}$ s.:cite[rossi1941] In 1963 David Frisch and James Smith repeated the measurement with muons of selected speed, 0.995 c, counted on top of Mount Washington and again at sea level in Cambridge, Massachusetts: they found a dilation factor of $8.8 \pm 0.8$, against $8.4 \pm 2$ expected for their geometry.:cite[frisch1963]
:::

```numeric
id: muon-half
title: A muon that has an even chance
prompt: A muon is born 15 km above the ground. Ignoring energy loss, what total energy E, in GeV, gives it a 50 % chance of reaching the ground? (cτ = 658.6 m, muon mass 0.10566 GeV; use P = exp(−d/βγcτ).)
answer: 3.47
unit: GeV
tolerance: 0.03
hints:
  - Set P = 1/2. Then d/(βγ cτ) = ln 2, so βγ = d/(cτ ln 2).
  - 'Then E = m √(1 + (βγ)²).'
explain: "βγ = 15,000 / (658.6 × 0.6931) = 32.86, so γ = √(1 + 32.86²) = 32.88 and E = 0.10566 × 32.88 = 3.47 GeV. Muons above this energy have an even chance of arriving, and nearly all those above 10 GeV do."
```

### Write it yourself

The toy shower, the survival figure and the exercise above all use one small function. Write it, and the checker will compare it with the particle table's muon mass and lifetime.

:::note
**Compare the two lifetimes.** Use the survival figure with time dilation on and off at the same energy and altitude. Predict which curve lets more muons reach the ground, then explain the role of βγ in the decay length. No new code is needed to test that prediction.
:::

## How many muons: the flux at sea level

Averaged over the showers of every energy, the muons that arrive at sea level are a steady stream. The Particle Data Group's review of cosmic rays gives the integral intensity of vertical muons above 1 GeV/c at sea level as about 70 m$^{-2}$ s$^{-1}$ sr$^{-1}$, and the rule of thumb that experimenters use is about 1 cm$^{-2}$ min$^{-1}$ for a horizontal detector. The angular distribution of the muons at the ground is close to $\cos^2\theta$, with $\theta$ the angle from the vertical, for muons of about 3 GeV; at lower energy it is steeper, and at higher energy flatter, approaching $\sec\theta$.:cite[pdg-cosmic] The $\cos^2\theta$ law is the geometry of the toy shower in a few words: a muon at a large zenith angle crosses more air, loses more energy and decays more often.

::zenith-flux{n="10.4" caption="The muon intensity I(θ) = I₀ cos²θ with I₀ = 70 m⁻² s⁻¹ sr⁻¹, and the rate in a small detector pointed at the angle θ. The integral over the sky for a horizontal plate is (π/2) I₀ = 0.66 cm⁻² min⁻¹, to be compared with the rule of thumb of about 1."}

The rate through a horizontal plate is not the rate through a telescope that looks at the zenith, and the difference is a factor of $2/\pi$ times the solid angle: integrating the intensity over the hemisphere, with the extra factor of $\cos\theta$ because a tilted ray crosses a horizontal plate at a slant,

$$\Phi_\text{horizontal} = \int I_0\cos^2\theta\;\cos\theta\; d\Omega = 2\pi I_0\int_0^{\pi/2}\cos^3\theta\sin\theta\,d\theta = \frac{\pi}{2}I_0 .$$

For $I_0 = 70\ \text{m}^{-2}\text{s}^{-1}\text{sr}^{-1}$ that is 110 m$^{-2}$ s$^{-1}$, or 0.66 cm$^{-2}$ min$^{-1}$.

:::real{parts="A desktop muon detector"}
The rate and the angular dependence of this section can be measured with a few tens of pounds of parts. The **CosmicWatch** desktop muon detector, developed at MIT, is a block of plastic scintillator read by a silicon photomultiplier and a small microcontroller, and costs under \$100 to build; two of them in coincidence reject the background of radioactivity and give a clean muon count. The project is licensed for non-commercial use, so the course links to it and does not redistribute its files. Point two detectors at the zenith and measure the rate; tilt the pair and check the $\cos^2\theta$ law; take them up a mountain, or down a mine, and compare. [Appendix G](/appendix/build-it-for-real/) has the lab and the safety notes (no high voltage beyond what the kit supplies, and no sources). Chapter 28 uses the data for a fit.
:::

:::programmer
A decay is a **memoryless** process: the probability of decaying in the next instant does not depend on how long the particle has already lived. That is a constant hazard rate $1/\tau$, and the survival function $e^{-t/\tau}$ is the same one that a service with a constant failure rate has, or that a cache with random eviction has for its entries. A programmer would sample a lifetime with `-tau * Math.log(1 - u)` (inverse-transform sampling, Chapter 3), and that is all the simulation does. Time dilation changes only the *clock* the process runs against: the lifetime is drawn in the particle's proper time and converted to the lab's by the factor $\gamma$, as a timeout measured in CPU time would be converted to wall-clock time on a machine that is running slower.
:::

:::hood[Closed-form decay points in an exponential atmosphere]
The toy shower has to decide, for each of tens of thousands of pions, whether it decays or interacts, and where. Stepping through the atmosphere would be slow, and it is unnecessary. In an isothermal atmosphere the density is proportional to the depth, and the path length $dl$ for a depth step $ds$ is $dl = (H/\cos\theta)\,ds/s$, so the integral of $dl/L$ along the path, the quantity that an exponential decay law cares about, is a logarithm: $(H/\cos\theta)\ln(s_1/s_0)/L$. Setting it equal to a draw from a unit exponential and solving for $s_1$ gives the decay point directly:

```ts
// src/lib/sims/part3/airshower.ts
const gam = p.E / mPi;
const L = Math.sqrt(gam * gam - 1) * CTAU_PI_M;      // βγ·cτ in metres, from the particle table
sDec = p.s * Math.exp((expo(1) * L) / Hm);           // slant depth at which it decays
const sEnd = Math.min(sInt, sDec, slantTotal);       // the earliest of interaction, decay and the ground
```

The pion's interaction point `sInt` is a draw from an exponential in depth. The earliest of the three events ends the pion, and there is no loop. Muons, whose energy changes as they lose ionisation, are stepped in slices of 10 g/cm², with the closed form applied to each slice.
:::

:::experiments
Real air showers are simulated with **CORSIKA** (COsmic Ray SImulations for KAscade), a Monte Carlo program that follows every particle of the shower above an energy threshold through a model atmosphere, with interaction models tuned to accelerator data, including the LHC's.:cite[heck1998] The showers are detected by arrays on the ground. The **Pierre Auger Observatory** in Argentina, which is named after the discoverer of air showers, covers 3,000 km² with about 1,600 water tanks that detect the Cherenkov light of the shower's particles (Chapter 6), watched by fluorescence telescopes that see the glow of the nitrogen the shower excites in the sky.:cite[auger2015] The muon content of a shower is one of the clues to the mass of the primary, and whether the simulations produce as many muons as real showers contain is a live question. The course's toy cannot settle that, and does not try to.
:::

## What the sky taught

The sky gave the physicists of the 1930s and 1940s what the accelerators of the time could not: the positron, the muon, the pion, and in the next chapter the first strange particles. It also gave them a pair of puzzles that took decades to resolve. The muon looks like a heavy electron and is useless to the nucleus. The pion is Yukawa's meson, and its decay to a muon is a weak process, far slower than anything strong (Chapter 22). The next particles that cosmic rays delivered were stranger: they were made in strong interactions, in a hundred-billionth of a second or less, and then lived a hundred billion times longer than the strong force would allow. A conservation law that nobody had thought of explains it, and it is the subject of Chapter 11.

## What comes next

[Chapter 11](/chapters/conservation-laws/) collects what the particles of Chapters 9 and 10 have in common: charge, baryon number, lepton number, and a new quantity, discovered in cosmic rays, that explains why some particles live far longer than they should.

## Further reading

- The Particle Data Group's *Cosmic rays* review (:cite[pdg-cosmic]) for the energy spectrum, the composition, and the muon flux at sea level, with the numbers used here.
- Matthews' *A Heitler model of extensive air showers* (:cite[matthews2005]) is a five-page idea made precise: the toy of this chapter is its numerical sibling.
- Hess's 1912 paper (:cite[hess1912]) and the Bristol group's 1947 paper (:cite[lattes1947]) are both short and readable in translation.
