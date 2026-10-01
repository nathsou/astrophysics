---
number: 22
title: The weak force
summary: A missing share of energy makes Pauli invent the neutrino, Fermi gives it a theory, and a cobalt crystal at a hundredth of a kelvin shows that nature can tell left from right. The weak force is the first to break a law that looked like geometry.
duration: About 2½ hours
prerequisites: [conservation-laws, feynman-diagrams, symmetry-and-gauge]
---

Take a neutron that is free, in a vacuum, at rest. After about fifteen minutes on average (the mean life is 878 s) it turns into a proton and an electron. The masses are in the particle table: 939.565 MeV for the neutron, 938.272 MeV for the proton, 0.511 MeV for the electron. The neutron is heavier by 1.293 MeV, which is 0.782 MeV more than the electron's rest energy, so the electron can be made and there is energy to spare.

Chapter 2 gave the rule for a decay into two bodies. The daughters' momenta follow from the three masses alone, so the electron's energy is **fixed**. A physicist who has read that chapter and looks at a neutron decay should expect every electron to come out with the same kinetic energy, and the function `twoBodyMomentum` will say what it is.

```predict
q: 'A free neutron decays, and the only things that leave are a proton and an electron. The electron’s kinetic energy is measured for many decays. What does the histogram look like?'
options:
  - text: A single narrow line at 0.78 MeV.
    correct: true
    why: 'For a decay into two bodies, energy and momentum conservation fix the electron’s energy in the neutron’s rest frame: the library’s twoBodyMomentum(m_n, m_p, m_e) gives a momentum of 1.187 MeV, hence a kinetic energy of 0.7816 MeV. Every electron would have it. That is the prediction; the next paragraphs are about what was seen instead.'
  - text: A smooth hump from 0 up to about 0.78 MeV.
    why: 'That is what is seen, and it cannot come from two bodies. The question asks what two bodies would give. A hump needs a third particle to share the energy in different proportions from decay to decay.'
  - text: Two lines, one for each possible spin orientation of the neutron.
    why: 'Spin does not change the energy of the electron. The neutron has one mass, the proton one, the electron one, and the two-body formula involves nothing else.'
```

What is measured, in neutron decay and in every other beta decay, is a smooth hump.

::beta-spectrum{n="22.1" caption="The kinetic energy of the electron in beta decay. The bars are simulated electrons drawn from the three-body spectrum, the smooth curve is the same spectrum, and the red line is where a two-body decay would put every electron (for the neutron, at 0.7816 MeV, which is just below the end-point at 0.7823 MeV, because the recoiling proton takes a tiny kinetic energy). The electrons range from zero energy up to the end-point, and their mean is well below it. Switch to the tritium preset: the shape stays, the scale changes by a factor of forty. The spectrum is phase space only; the real ones are distorted at low energies by the nucleus's electric charge."}

The figure is computed, not measured. It says what a third, invisible particle would do, and it reproduces the shape that experimenters had drawn by hand decades before anyone had a name for that particle. This chapter tells how that particle was proposed, found, given a theory, and used to show that nature is not the same in a mirror.

## A missing share of the energy

:::history{year=1914 title="A smooth spectrum where lines were expected" people="James Chadwick, Charles Ellis, William Wooster" source="Sources: Chadwick (1914); Ellis and Wooster (1927)."}
In 1914, at the Physikalisch-Technische Reichsanstalt in Berlin, James Chadwick measured the speeds of the electrons (beta rays) emitted by radium B and radium C (isotopes of lead and bismuth) by bending them in a magnetic field, as in Chapter 5. He found a continuous band of intensity with a few sharp lines on top of it.:cite[chadwick1914] The lines were understood in time as electrons knocked out of atoms by the nucleus's own gamma rays. The band was the puzzle: a nucleus that goes from one definite state to another, losing a definite amount of energy, should give electrons of one energy.

There was an escape: perhaps the electrons lost energy on their way out, or were measured badly. In 1927 Charles Ellis and William Wooster at Cambridge closed it. They put a beta emitter, radium E (bismuth-210), inside a calorimeter thick enough to stop the electrons and measured the heat. The heat per decay was about 0.35 MeV, which is the **average** of the continuous spectrum, and not the end-point energy of about 1 MeV. The energy that was not in the electron was not in the detector either.:cite[ellis1927] Either energy was not conserved in beta decay, or something was carrying it away unseen.
:::

Niels Bohr was willing to consider the first option: that energy conservation holds only on average for single atomic events.:cite[brown1978] Wolfgang Pauli was not. He proposed the second.

:::history{year=1930 title="Dear radioactive ladies and gentlemen" people="Wolfgang Pauli, Enrico Fermi" source="Sources: Pauli's letter of 4 December 1930, in the English translation given by Brown (1978); Fermi (1934)."}
On 4 December 1930 Pauli wrote an open letter to a meeting of radioactivity specialists in Tübingen. It opens with the address "Dear radioactive ladies and gentlemen" (in the original, *Liebe Radioaktive Damen und Herren*). He would not be there in person, he explained, because a ball in Zürich required him.:cite[brown1978]

The letter proposes a "desperate remedy": there might be electrically neutral particles of spin ½ inside nuclei, which obey the exclusion principle, and which are emitted together with the electron in beta decay, so that the energy of the electron and the new particle add up to a constant. About the mass he wrote that it should be of the same order as the electron's and in any case not larger than 0.01 proton masses.:cite[brown1978] Pauli called the particle a *neutron*. In 1932 Chadwick gave that name to the heavy neutral particle that really is in nuclei, and Enrico Fermi, in Rome, renamed Pauli's lighter one the **neutrino**, Italian for "little neutral one".:cite[brown1978]
:::

The particle had to be neutral, or the charge would not balance and it would leave tracks. It had to be very light, or the electron's end-point would be lowered. And there was a second argument, independent of energy, which is worth doing because it needs only one line of arithmetic. The neutron has spin ½. A proton has spin ½ and an electron has spin ½. Add two spins of ½ and any orbital motion, which contributes whole units: the total is a whole number, never ½. A decay into a proton and an electron alone would break the conservation of angular momentum. A third particle with spin ½ fixes both the energy and the angular momentum. With it, the decay is

$$n \to p + e^- + \bar\nu_e,$$

where the bar marks an **antineutrino**: the particle emitted along with an electron is, by the lepton-number rule of Chapter 11, the antiparticle of the one emitted along with a positron.

## Fermi's theory

Pauli had a particle and no theory. In 1933 and 1934 Fermi provided one, by taking the newest field theory of the day, the quantum electrodynamics of Chapter 16, and making the simplest change that would let a neutron turn into a proton. A field that creates an electron and an antineutrino, and a field that changes a neutron into a proton, meet at a single point: a four-fermion **contact interaction** with one strength, which today is written $G_F$ and called **Fermi's constant**.:cite[fermi1934z,fermi1934nc]

:::history{year=1933 title="Fermi's paper, and a journal that declined it" people="Enrico Fermi" source="Sources: Fermi (1934), both versions; Wilson (1968); Schwartz (2017)."}
Fermi published the theory in Italian in *Il Nuovo Cimento* and in German in the *Zeitschrift für Physik*, both in 1934.:cite[fermi1934nc,fermi1934z] According to the account usually given, he first sent a short version to *Nature*, which declined it as containing speculations too remote from reality to be of interest to its readers.:cite[wilson1968] The further story, that the editors later regretted it publicly, is not supported by Fermi's biographer, who examined it.:cite[schwartz2017]

The theory made predictions that a measurement could confirm: the shape of the electron spectrum, the relation between the energy released and the lifetime, and the value of a single constant, $G_F$, that every weak decay shares. They were confirmed, each to the precision of its day.
:::

The diagram for the decay is the first in which the **weak force** appears. At the level of the quarks, a down quark of the neutron turns into an up quark, and an electron and an antineutrino appear at the same point.

::feynman{process="d > u e- nu_e~" forces="fermi" n="22.2" caption="Beta decay of a quark, drawn as Fermi saw it: four fermion lines meeting at one point. The down quark d becomes an up quark u, and an electron and an antineutrino are created. In the neutron, the other two quarks are spectators: udd becomes uud, a proton."}

The theory's content is a rate. For a decay with small energy release, Fermi's calculation gives a rate proportional to $G_F^2$ times the fifth power of the energy released, times a number that depends on the nuclei. The cleanest case to compute is that of a particle with no complications from nuclei at all: the muon, which decays into an electron and two neutrinos.

:::equation{#muon-rate caption="The muon's decay rate in Fermi's theory, at leading order, for a negligible electron mass."}
$$\term{Gamma}{\Gamma_\mu} = \frac{\term{GF}{G_F}^{2}\,\term{mmu}{m_\mu}^{5}}{192\,\pi^{3}}$$

```terms
Gamma:
  label: 'Γ_μ, the muon decay rate'
  what: The probability per unit time that a muon decays. Its inverse, in natural units, is the mean lifetime.
  why: It is the measurable quantity that fixes G_F, and the cleanest one, because a muon is a lepton with no strong interaction to correct it.
  effect: Γ = 3.0 × 10⁻¹⁹ GeV, which is a mean lifetime τ = ħ/Γ of 2.19 μs, within 0.5 % of the measured 2.197 μs.
GF:
  label: 'G_F, Fermi’s constant'
  what: The strength of the four-fermion interaction. It has the dimensions of an inverse energy squared, and the value 1.1664 × 10⁻⁵ GeV⁻².
  why: The same number governs every weak decay of leptons, so a single measurement (the muon lifetime) fixes it for all of them.
  effect: A rate goes as G_F², so a constant a thousand times smaller would mean decays a million times slower.
mmu:
  label: 'm_μ, the muon mass'
  what: 0.10566 GeV. The only energy scale in the decay of a muon at rest.
  why: By dimensions, a rate is an energy, and G_F² has dimension energy⁻⁴, so the rate must be G_F² times an energy to the fifth power.
  effect: 'The fifth power is steep: a particle ten times heavier, with the same coupling, would decay a hundred thousand times faster. Chapter 24 uses this for the b quark.'
```
:::

The factor 192π³ comes from integrating over the three-body phase space of the decay. The reader who wants to see where the fifth power of the mass comes from can follow the dimensional argument in the terms above: the rate has the units of an energy, $G_F^2$ carries energy$^{-4}$, and the muon mass is the only energy in the problem.

```numeric
id: muon-lifetime-from-gf
title: The muon's lifetime from Fermi's constant
prompt: 'Use Γ = G_F² m_μ⁵ / (192π³) with G_F = 1.1664 × 10⁻⁵ GeV⁻² and m_μ = 0.10566 GeV to find the mean lifetime τ = ħ/Γ of the muon, in microseconds. (ħ = 6.582 × 10⁻²⁵ GeV·s.)'
answer: 2.187
unit: μs
tolerance: 0.01
hints:
  - 'm_μ⁵ = (0.10566)⁵ = 1.3 × 10⁻⁵ GeV⁵. G_F² = 1.36 × 10⁻¹⁰ GeV⁻⁴.'
  - 'Γ comes out near 3 × 10⁻¹⁹ GeV. Then τ = 6.582 × 10⁻²⁵ GeV·s divided by Γ.'
explain: 'Γ = 3.009 × 10⁻¹⁹ GeV, so τ = 6.582 × 10⁻²⁵ / 3.009 × 10⁻¹⁹ = 2.187 × 10⁻⁶ s. The measured lifetime is 2.1970 μs. The 0.5 % difference is the size of the electromagnetic corrections that the leading-order formula leaves out. The MuLan experiment at the Paul Scherrer Institute (PSI, Switzerland) measured the lifetime to a part in a million and used the formula, with those corrections, to give the most precise value of G_F.'
```

The measurement of the muon lifetime is also the measurement of $G_F$. The MuLan experiment at PSI recorded about $10^{12}$ muon decays and found $\tau_\mu = 2\,196\,980.3 \pm 2.2$ ps, hence $G_F = 1.1663787(6)\times10^{-5}\ \text{GeV}^{-2}$.:cite[mulan2013] The constant has dimensions of energy⁻², which means that it defines an energy: $G_F^{-1/2} = 293$ GeV. Put another way, the weak interaction is weak only because ordinary decays happen at energies far below 293 GeV. The rate of a process at energy $E$ is, by dimensions, $G_F^2E^5$, and compared with the energy itself, $(G_FE^2)^2$. At $E$ of a few GeV this is $10^{-9}$ or so. At a few hundred GeV it stops being small, and Fermi's theory, taken literally, cannot be right there: the cross-section it gives grows with the collision energy squared and would eventually exceed the largest value that the conservation of probability allows. Something must change at those energies. Chapter 23 shows what.

## Catching the ghost

Fermi's theory also gave the probability that a neutrino will interact, and the answer was discouraging.

:::fermi[How thick a wall stops an antineutrino?]
The reaction that Fermi's theory predicts for an antineutrino from a reactor is $\bar\nu_e + p \to n + e^+$, the beta decay turned around (the inverse beta decay). At a few MeV its cross-section is of order $6\times10^{-44}$ cm². (The measured value by Cowan and Reines was $6.3\times10^{-44}$ cm².:cite[cowan1956])

Water has two hydrogen nuclei per molecule, each a proton. One gram of water is 1/18 mole, so the number of free protons per cm³ is $n = 2 \times 6.02\times10^{23}/18 = 6.7\times10^{22}$ cm⁻³. The mean free path is $1/(n\sigma)$, which is $1/(6.7\times10^{22}\times6.3\times10^{-44}) = 2.4\times10^{20}$ cm $= 2.4\times10^{18}$ m. A light-year is $9.46\times10^{15}$ m, so this is about **250 light-years of water**. A ball of water as wide as the Earth (1.3 × 10⁷ m) would stop about one antineutrino in $2\times10^{11}$. The neutrinos that leave the Sun pass through the Earth almost untouched.
:::

```fermi
id: solar-neutrino-flux
title: Solar neutrinos through your thumbnail
prompt: 'The Sun radiates 3.8 × 10²⁶ W. It gets that power from turning four protons into a helium nucleus, which releases about 26 MeV and makes two neutrinos. (1 MeV = 1.6 × 10⁻¹³ J; the Earth is 1.5 × 10¹³ cm from the Sun.) How many neutrinos cross each square centimetre at the Earth every second?'
answer: 6.5e10
unit: cm⁻² s⁻¹
factor: 2
hints:
  - 'The number of helium nuclei made per second is the power divided by the energy per nucleus. Two neutrinos for each.'
  - 'Spread them over a sphere of radius 1.5 × 10¹³ cm: area 4πr².'
explain: 'Helium nuclei per second: 3.8 × 10²⁶ W / (26 × 1.6 × 10⁻¹³ J) = 9 × 10³⁷. Neutrinos: twice that, 1.8 × 10³⁸ per second. The sphere has area 4π(1.5 × 10¹³)² = 2.8 × 10²⁷ cm², so the flux is 6.5 × 10¹⁰ cm⁻² s⁻¹: about sixty billion through every square centimetre, every second, and through you as you read this, nearly all of them without the slightest effect, for the reason of the previous estimate. The astrophysics course follows the chain in its chapter on [fusion](/astrophysics/ch/fusion/), and Chapter 31 here returns to solar neutrinos.'
```

:::history{year=1956 title="The neutrino is caught" people="Clyde Cowan, Frederick Reines" source="Sources: Bethe and Peierls (1934); Cowan et al. (1956)."}
In 1934 Bethe and Peierls estimated the cross-section and concluded that "there is no practically possible way of observing the neutrino".:cite[bethe1934] In 1956 Clyde Cowan and Frederick Reines, of the Los Alamos laboratory, proved them wrong with a nuclear reactor at the Savannah River Plant in South Carolina, which makes antineutrinos at a rate that puts of the order of $10^{13}$ through each square centimetre of a detector close to it every second.:cite[cowan1956]

The detector was a sandwich. Two tanks of water in which cadmium chloride was dissolved were placed between three tanks of liquid scintillator, which flashes when a charged particle crosses it. An antineutrino that turns a proton into a neutron and a positron gives two signals. First, at once, the positron annihilates with an electron and two photons of 0.511 MeV are seen in the scintillator. Then the neutron, slowed down by the water, is captured by a cadmium nucleus, which emits gamma rays a few microseconds later. A flash followed by a second flash at the right delay and in the right place is the signature. They saw nearly three such pairs per hour with the reactor on, more than with it off, and they reported "the detection of the free neutrino".:cite[cowan1956] Reines received the Nobel Prize in Physics in 1995.
:::

:::programmer
The Cowan–Reines trigger is a **join on an event-time window**. The prompt pulse and the delayed pulse are two records in one stream, and only pairs with the delay between roughly a microsecond and ten microseconds, and inside the same tank, count. Stream-processing frameworks have this as a built-in (a windowed join). What matters for correctness is the same as in software: the background is a **rate**, so a window twice as wide admits twice as much accidental coincidence. A neutrino detector's whole sensitivity comes from making the window narrow enough that the accidental rate is below the signal rate, and then subtracting what is left by running with the reactor off.
:::

## Left and right

Until 1956 every known interaction, in every process that had been looked at, gave the same result in a mirror as it did without one. That is **parity**: if you reflect a process in a mirror, you get an image of a process that could happen, with the same probability.

To reflect a three-dimensional experiment, invert all three coordinates, $\vec x \to -\vec x$. A vector that points in a direction, like a momentum or a position, reverses. A quantity built from two such vectors, like angular momentum $\vec r\times\vec p$, does not: both factors flip and the product stays. The spin of a particle behaves like angular momentum. It is an **axial vector**, which in words is a *sense of rotation*: a current loop circulating anticlockwise, seen from above, is still circulating anticlockwise in a mirror placed below it.

That gives a clean test. Take a spin $\vec J$ and a momentum $\vec p$. Their dot product $\vec J\cdot\vec p$ changes sign under reflection, since $\vec p$ changes and $\vec J$ does not. If a law respects parity, then in any process the average of $\vec J\cdot\vec p$ must be zero: the probability of an emission along the spin is the same as against it. If an experiment finds a non-zero average, the law does not respect parity.

:::history{year=1956 title="The τ–θ puzzle and a question nobody had asked" people="Tsung-Dao Lee, Chen Ning Yang" source="Sources: Lee and Yang (1956); Nobel Foundation (1957)."}
By 1956 two strange particles had the same mass and the same lifetime, to the accuracy of the measurements, but decayed differently: one into two pions and the other into three. The two-pion final state has even parity and the three-pion state odd parity, so if parity is conserved they must be different particles. Yet everything else about them was the same. The simplest explanation was that they were one particle (the K⁺ of today's tables, whose table entry lists both decays) and that parity is not conserved in its decay.

Lee and Yang, working at Columbia and at Princeton, asked what experiments actually established parity conservation in weak interactions, and found that there were none. The evidence for parity was in strong and electromagnetic processes. They proposed tests with polarised nuclei and with pion and muon decays.:cite[leeyang1956] The Nobel Prize in Physics for 1957 went to the two of them.:cite[nobel1957]
:::

```predict
q: 'In a nucleus all of whose spins have been lined up, beta decay sends electrons out in all directions. If the weak force respected parity, how would the number emitted along the nuclear spin compare with the number emitted against it?'
options:
  - text: They would be equal.
    correct: true
    why: 'Reflect the experiment in a mirror below the source. The spin stays, the electrons’ directions along the axis reverse. If the mirror image is an allowed process with the same probability, the numbers along and against must be the same. Any difference shows that the two pictures are different, which is exactly what a violation of parity means.'
  - text: More would go along the spin, since the nucleus’s spin is the only direction it has.
    why: 'The nucleus does have a direction, but the mirror image of the experiment reverses the electrons’ direction relative to the spin. If the law respected the mirror, the image would show an equal and opposite excess, which is a contradiction unless the excess is zero.'
  - text: More would go against the spin, since the electron carries away charge.
    why: 'The charge is the same on both sides of the spin axis. Nothing in a parity-respecting law distinguishes along from against.'
```

### What was observed

:::history{year=1957 title="A cobalt crystal at a hundredth of a kelvin" people="Chien-Shiung Wu, Ernest Ambler, Raymond Hayward, Dale Hoppes, Ralph Hudson" source="Sources: Wu et al. (1957); Garwin, Lederman and Weinrich (1957)."}
Chien-Shiung Wu, of Columbia University, collaborated with low-temperature physicists of the National Bureau of Standards in Washington to do the experiment Lee and Yang had proposed. The source was the isotope cobalt-60, which decays by beta emission into an excited state of nickel-60, which immediately emits two gamma rays. The cobalt sat in a crystal which was cooled to about a hundredth of a kelvin by demagnetisation, and a magnetic field lined up the nuclear spins.

A scintillating crystal counted the electrons along the field. The anisotropy of the gamma rays, which also depends on the polarisation of the nuclei but not on parity, served as a thermometer. The observation was this: **more electrons were emitted opposite to the direction of the nuclear spin than along it**, and the difference went away as the crystal warmed and the nuclei lost their alignment. Reversing the field reversed which way the asymmetry went in the apparatus, so it followed the spin and not the laboratory.:cite[wu1957]

Independently, and within days, Richard Garwin, Leon Lederman and Marcel Weinrich at Columbia saw the same kind of asymmetry in the decay of muons made from pions, which is a second, different proof that parity fails in weak decays (and that so does charge conjugation, the exchange of particles and antiparticles).:cite[garwin1957]
:::

What the experiment measured is a **distribution in angle**. Let $\theta$ be the angle between the electron's direction and the nuclear spin. For polarised nuclei, the electron's angular distribution takes the form

:::equation{#wu caption="The angular distribution of electrons from polarised nuclei. A term in cos θ is a correlation between a momentum and a spin, and it is forbidden if parity is conserved."}
$$\term{W}{W(\theta)} \;\propto\; 1 + \term{a}{A\,P\,\beta}\;\cos\theta$$

```terms
W:
  label: 'W(θ), the angular distribution'
  what: The relative probability that a beta-decay electron leaves at an angle θ from the nuclear spin axis.
  why: Reflecting the experiment changes cos θ into −cos θ. If W(θ) is not symmetric under that change, the mirror image is a different experiment with different outcomes.
  effect: With a zero in front of the cos θ term, the electrons leave equally along and against the spin.
a:
  label: 'A P β, the size of the asymmetry'
  what: The product of three numbers. A is a property of the decay (the asymmetry parameter). P is the degree of polarisation of the nuclei, from 0 (random) to 1 (all aligned). β is the electron's speed in units of the speed of light.
  why: The asymmetry needs all three. No polarisation, no direction to be asymmetric about, so P = 0 gives a flat distribution, which is why warming the crystal removed the effect. A parity-respecting law has A = 0.
  effect: 'For the cobalt-60 decay the theory of the next section gives A = −1, and the fastest electrons have β near 0.8. So 1 + a cos θ with a down to about −0.8 at full polarisation: for those electrons, nine times more go against the spin than along it.'
```
:::

An asymmetry of the form $A P \beta$ was exactly what the result showed. The figure lets you run it.

::mirror{n="22.3" caption="Wu's experiment, and its mirror image. Left: nature, with the nuclear spin up and more electrons leaving downwards, against the spin. Right: the mirror image of the same electrons, reflected in a horizontal mirror below the source. The spin (a sense of rotation, drawn here by the current loop that sets it) does not change, and the electrons' vertical component does, so in the image more of them leave upwards, along the spin. No such image has ever been seen in a weak decay. The histograms show cos θ. Set the control to the parity-respecting case and the two pictures become indistinguishable. Warm the crystal (raise the temperature) and the asymmetry shrinks. The polarisation curve and the electron positions are schematic, and the number of decays is yours to choose: watch how many are needed before the asymmetry stands out from the statistical fluctuation."}

The figure's last readout gives the number that the experimenters cared about: the asymmetry in units of its statistical uncertainty. With only a few dozen decays the result is a coin toss. With a few thousand it is unmistakable.

:::programmer
Parity is a **symmetry of a function**, and a violation is a failed **property-based test**. A property test says: for any input $x$ and any transformation $T$, `f(T(x))` should equal `T(f(x))`, or be related to it in a stated way. Wu's experiment is that test with $f$ = "where do the electrons go", $T$ = mirror, and input = a polarised nucleus. The property failed. What makes the result uncomfortable is that the property had passed on everything tested before: a bug in one module of a large system, in a component nobody had tested this way. The remedy is what physicists did: find exactly the inputs on which the property fails (only weak interactions), and rewrite the specification to include the asymmetry, not to throw the symmetry away everywhere.
:::

## Helicity and V − A

The moving electron has two properties that do not change under a boost along its direction: its momentum $\vec p$ and the component of its spin along that momentum. The second, divided by the spin magnitude, is the **helicity**, $h = \pm 1$ in units of ½: **right-handed** when the spin points along the motion (as a right-handed screw turns when it advances) and **left-handed** when it points against it. A particle with mass can be overtaken by an observer who moves faster, who then sees its momentum reversed and its spin unchanged: its helicity is not invariant. A massless particle moves at the speed of light and cannot be overtaken, so for it helicity is a fixed property.

The experiments of 1957 and 1958 showed the pattern. The Wu asymmetry scales with the electron's speed β, as if fast electrons came out with a preferred helicity. And in 1958 Maurice Goldhaber, Lee Grodzins and Andrew Sunyar measured what the neutrino does.

:::history{year=1958 title="The neutrino spins the same way every time" people="Maurice Goldhaber, Lee Grodzins, Andrew Sunyar" source="Source: Goldhaber, Grodzins and Sunyar (1958)."}
Goldhaber, Grodzins and Sunyar at Brookhaven National Laboratory used the isomer europium-152m, which captures an atomic electron and so emits a neutrino and an excited samarium nucleus. The nucleus recoils against the neutrino and then emits a gamma ray. A gamma ray that is emitted in the direction of the recoil, and therefore opposite to the neutrino, carries the same helicity as the neutrino had, and only those gamma rays have enough energy to be absorbed again by a samarium target through resonant scattering. They measured the circular polarisation of those gamma rays, with magnetised iron, and concluded that the neutrino is **left-handed**: its helicity is negative.:cite[goldhaber1958]
:::

The same year, Richard Feynman and Murray Gell-Mann, and independently George Sudarshan and Robert Marshak, proposed a form for the weak interaction that explained all of this together.:cite[feynman1958,sudarshan1958] The vertex is not the simple product of Fermi's theory. It contains a difference of two kinds of current: a **vector** current $\bar\psi\gamma^\mu\psi$, which is what electromagnetism has, and an **axial-vector** current $\bar\psi\gamma^\mu\gamma^5\psi$, which behaves as a vector under rotation but reverses differently under a mirror. The combination is **V − A**.

:::equation{#va caption="The weak interaction for muon decay in the V − A form, at low energy."}
$$\mathcal{L}_\text{int} = -\frac{\term{GF}{G_F}}{\sqrt2}\,\big[\bar\nu_\mu\,\term{va}{\gamma^\mu(1-\gamma^5)}\,\mu\big]\,\big[\bar e\,\gamma_\mu(1-\gamma^5)\,\nu_e\big] + \text{h.c.}$$

```terms
va:
  label: 'γ^μ (1 − γ⁵), the V − A vertex'
  what: A 4 × 4 matrix acting on the spinor of a fermion. The γ^μ is the vector part, the γ⁵ term is the axial part, and their difference is (twice) a projector that keeps only the left-handed component of the fermion field.
  why: It is the single algebraic fact that carries the violation of parity. Electromagnetism has γ^μ alone and respects parity. With γ^μ(1 − γ⁵) the interaction sees only left-handed particles (and right-handed antiparticles).
  effect: A left-handed neutrino is produced, a right-handed one is not. For a particle with mass, the wrong-handed piece is not zero but small, by an amount that the next paragraph computes.
```
:::

The bracket $[\bar\nu_\mu\,\gamma^\mu(1-\gamma^5)\,\mu]$ is a current that turns a muon into its neutrino. The other bracket makes an electron and an antineutrino. The factor $(1-\gamma^5)$ equals twice the **projector** $P_L = (1-\gamma^5)/2$ onto left-handed **chirality**. Chirality is the property of the field that the interaction sees. For a massless particle it is the same as helicity. For one with mass it is not, and a particle that is *left-chiral* is a mixture of the two helicities.

:::deeper[The mixture of helicities]
For a particle of energy $E$, momentum $p$ and speed $\beta = p/E$, the Dirac spinor of positive helicity, in the chiral basis, has a left-chiral upper part of squared size $E - p$ and a right-chiral lower part of squared size $E + p$. (For the state of negative helicity the two are exchanged.) The total is $2E$. The weak interaction couples only to the upper part, so the probability that a particle made by it has **positive helicity** is

$$\frac{E-p}{2E} = \frac{1-\beta}{2} \approx \frac{m^2}{4E^2},$$

where the last form is for $E \gg m$. For an ultrarelativistic particle that is tiny. For a particle at rest it is ½, since a particle at rest has no helicity at all, and left and right are equally well represented. The squared mass in that formula is the origin of every helicity suppression.
:::

The consequence is easiest to see in a decay with only two bodies, where the spins have nowhere to hide.

## Why π → eν is rare

The charged pion (Chapter 10) decays to a muon and a neutrino 99.988 % of the time, and to an electron and a neutrino only 0.012 % of the time. An electron is more than 200 times lighter than a muon, so there is more energy to spare: the electron emerges with 69.8 MeV of momentum, the muon with 29.8 MeV. If anything, the electron should be the more likely. The pion does the opposite.

The reason is helicity. The pion has spin 0 and decays at rest, so the lepton and the neutrino fly apart back to back, and their spins, along the common axis, must cancel. For $\pi^+ \to \ell^+ \nu$, the neutrino is left-handed: its spin points against its motion. The antilepton, flying the other way, must then have its spin pointing against *its* motion too, to cancel: negative helicity. The weak interaction makes antiparticles right-handed. So the antilepton comes out with the helicity that the weak force **disfavours**, which it can do only by the small mass-dependent piece.

::helicity-suppression{n="22.4" caption="Left: the spin bookkeeping of π⁺ → ℓ⁺ν. The weak force makes the neutrino left-handed, so the spins can only cancel if the antilepton has the wrong helicity. Right: the rate against the lepton's mass, relative to the muon. The rate rises as m², peaks near 81 MeV, and falls to zero when the lepton is as heavy as the pion. Move the slider to the electron (0.511 MeV): its probability of the wrong helicity is 1.3 × 10⁻⁵, and its rate is 10⁻⁴ of the muon's. The slider's right end shows what a lepton almost as heavy as the pion would do."}

The squared mass $m_\ell^2$ from the helicity probability, multiplied by the ordinary phase-space factors for a two-body decay, gives the rate, and the ratio of the two modes, in which the pion's decay constant and the couplings cancel, is

:::equation{#pion-ratio caption="The ratio of the electron and muon modes of the charged pion, at leading order."}
$$\frac{\Gamma(\pi^+\to e^+\nu_e)}{\Gamma(\pi^+\to\mu^+\nu_\mu)} = \term{helicity}{\left(\frac{m_e}{m_\mu}\right)^{2}}\;\term{phase}{\left(\frac{m_\pi^2-m_e^2}{m_\pi^2-m_\mu^2}\right)^{2}}$$

```terms
helicity:
  label: '(m_e/m_μ)², the helicity factor'
  what: The squared ratio of the lepton masses. It comes from the probability that the antilepton has the helicity that the weak force disfavours, which is proportional to the lepton's mass squared.
  why: It is the suppression. It is tiny, 2.34 × 10⁻⁵, because the electron is 207 times lighter than the muon.
  effect: Double the electron's mass and the rate of π → eν is four times larger.
phase:
  label: 'the phase-space factor'
  what: The factor (1 − m_ℓ²/m_π²)² of each decay, which comes from the lepton's momentum and energy in the decay, taken for the electron over the muon. It equals 1 for a massless lepton and is smaller for a heavy one. The ratio is 5.49.
  why: The electron has more energy to spare than the muon, so it is favoured. The helicity suppression is large enough to beat that advantage by a factor of about 10⁴, but it does not cancel it.
  effect: Together the factors give 1.283 × 10⁻⁴.
```
:::

The two factors are 2.339 × 10⁻⁵ from the helicity and 5.487 from the phase space, and their product is **1.283 × 10⁻⁴**. The particle table gives branching fractions of 0.00012 and 0.99988, which make a ratio of 1.2 × 10⁻⁴ to the two digits that the table keeps. The measured value is $(1.2327 \pm 0.0023)\times10^{-4}$.:cite[pdg2024] The 4 % difference between it and the leading-order formula is of the size that electromagnetic corrections produce, and with them the prediction agrees with the measurement to a fraction of a per cent.

:::history{year=1958 title="A suppressed decay is found, at the predicted size" people="Tullio Fazzini, Giuseppe Fidecaro, Alec Merrison, Hans Paul, Alvin Tollestrup" source="Source: Fazzini et al. (1958)."}
At the CERN synchrocyclotron, the laboratory's first accelerator (Chapter 19), Fazzini and colleagues looked for the decay of the pion to an electron in 1958. They found it at a fraction near $1.2\times10^{-4}$ of the muon decays, which is what V − A gives: a rare decay, but not absent.:cite[fazzini1958] It was one of the early results that favoured V − A over the alternative forms of the interaction, for which the electron mode would not be suppressed so strongly.
:::

The same test has been repeated over the decades at higher precision, and it serves a second purpose. The W boson (Chapter 23) couples equally to electrons and to muons, and the agreement of the measured ratio with the prediction, which takes that for granted, confirms it at the per-mille level. The ratio of electron to muon decays is a measurement of the equality of the two leptons' weak couplings.

```numeric
id: pion-ratio
title: The helicity-suppressed ratio
prompt: 'Compute Γ(π→eν)/Γ(π→μν) = (m_e/m_μ)² × ((m_π² − m_e²)/(m_π² − m_μ²))² with m_e = 0.51100 MeV, m_μ = 105.658 MeV and m_π = 139.570 MeV. Give the answer in units of 10⁻⁴.'
answer: 1.283
unit: × 10⁻⁴
tolerance: 0.005
hints:
  - 'The helicity factor is (0.511/105.658)² = 2.34 × 10⁻⁵.'
  - 'The phase-space factor is ((139.570² − 0.511²)/(139.570² − 105.658²))² = 5.49.'
explain: 'The product is 2.339 × 10⁻⁵ × 5.487 = 1.283 × 10⁻⁴. The measured value is 1.233 × 10⁻⁴; the difference of 4 % is the order of magnitude of the radiative corrections.'
```

```quiz
q: 'A π⁻ at rest decays to a muon and an antineutrino. Which statement about their spins is correct?'
options:
  - text: The antineutrino is right-handed, so the spins can only cancel if the muon's spin points along its own motion, the helicity that the weak interaction disfavours for a particle.
    correct: true
    why: 'The pion has spin 0, so the spins along the axis cancel. The antineutrino from a π⁻ has its spin along its motion. The muon flies the other way, so to cancel that spin its own spin must point along the antineutrino’s direction of motion, which is along the muon’s own motion too: positive helicity. The weak interaction makes particles with negative helicity, so this is the suppressed choice, available only through the small (1 − β)/2 piece. It is the mirror image of the π⁺ case in the text.'
  - text: Both are left-handed, because the weak interaction only makes left-handed particles.
    why: 'The antineutrino is right-handed. The weak force makes left-handed particles and right-handed antiparticles.'
  - text: Both are right-handed, since the total spin must be zero.
    why: 'Two right-handed particles flying apart would have spins that cancel, but the weak interaction makes right-handed antiparticles, not right-handed particles, and the muon here is a particle. The muon’s helicity is indeed positive; that is the problem, not the solution.'
```

## What the ledger loses

Chapter 11 collected the conservation laws in a ledger. Parity was not in it, because it was not a law to be counted: it was taken for granted, as the statement that physics does not depend on which way you look. After 1957 it goes into the ledger as a law that **holds for gravity, electromagnetism and the strong force and is violated, maximally, by the weak force**. So does charge conjugation, the exchange of particles and antiparticles. The two violations are not independent: the weak interaction is approximately unchanged by doing both at once, which was the hope of 1957 and which the next chapters put to the test.

::ledger-strike{stage="22" n="22.5" caption="The ledger after Chapter 22. Parity and charge conjugation are struck through in the weak column: the weak force violates them. The combination CP (a reflection plus an exchange of particles and antiparticles) still seems to hold. Chapter 24 strikes it through as well, and Chapter 31 will strike through the separate lepton numbers."}

One consequence is sometimes put as a language problem. Left and right had always been conventions that can only be explained by pointing at an object. The weak force supplies a physical definition: a message that describes the Wu experiment lets the receiver find out which of their hands corresponds to our left, provided they are made of matter and not antimatter.

:::hood[Drawing an electron direction from 1 + a cos θ]
The Mirror figure needs, for each simulated decay, a value of $\cos\theta$ drawn from the distribution $(1 + a\cos\theta)/2$ on $[-1, 1]$. It does not use accept–reject, which wastes draws when $a$ is near $\pm1$. It inverts the cumulative distribution instead, which for this density is a quadratic:

```ts
/** Draw cosθ from (1 + a cosθ)/2 on [−1, 1] by inverting the cumulative distribution. */
export function sampleCosTheta(r: Rng, a: number): number {
  const u = r();
  if (Math.abs(a) < 1e-9) return 2 * u - 1;
  // F(c) = (c + 1)/2 + a (c² − 1)/4 = u  →  a c² + 2 c + (2 − a − 4u) = 0
  const disc = 1 - a * (2 - a - 4 * u);
  const c = (-1 + Math.sqrt(Math.max(0, disc))) / a;
  return Math.max(-1, Math.min(1, c));
}
```

One uniform number gives one sample, at a fixed cost, with no rejection. The root with the plus sign is the one that lies in $[-1, 1]$. The `Math.max(0, …)` guards a discriminant that rounding has made slightly negative at $a = \pm1$. The test that goes with it draws 200,000 values for several $a$ and checks that the mean of $\cos\theta$ is $a/3$ and that the fraction in the forward hemisphere is $\tfrac12 + a/4$. The beta spectrum of Figure 22.1, whose density has no such simple inverse, uses `acceptReject` from `hep/random` instead: the two techniques of Chapter 4, each where it fits. The mirror image in the figure is not a second simulation. It is the same samples with the sign of $\cos\theta$ reversed, which is what reflection does.
:::

:::experiments
The weak force's descendants are still the subject of precision work. The **KATRIN** experiment (Karlsruhe Tritium Neutrino) measures the electron spectrum of the beta decay of tritium, the hydrogen isotope with two neutrons, the same phase-space hump as Figure 22.1 for an end-point of 18.6 keV, and looks at the last few electron-volts below the end-point. If the neutrino has a mass, the spectrum ends slightly early and bends before the end. KATRIN's 2022 result is an upper limit of 0.8 eV on the mass of the electron antineutrino (Chapter 31 returns to it).:cite[katrin2022] The **MuLan** measurement of the muon lifetime, at the PSI in Switzerland, recorded about $10^{12}$ muon decays in a polarised beam stopped in a target surrounded by a scintillator array, and is what fixes $G_F$.:cite[mulan2013] At higher energies, the parity violation of the weak force is measured every day in the **asymmetries** of Z decays at LEP (Chapter 23).
:::

## What comes next

Fermi's theory and V − A describe low-energy weak processes with one constant. They cannot be complete, because the predicted rates grow without limit as the energy rises. The constant $G_F$ has the dimension of an inverse energy squared, and $G_F^{-1/2} = 293$ GeV is an energy scale. A force that looks like a point interaction at low energy and gives something finite at high energy is what you get when it is carried by a heavy particle, as Yukawa's force (Chapter 14) is carried by a pion: the heavy exchange looks like a contact only when the energy is much smaller than the mass. The scale 293 GeV suggests a mass of order 100 GeV. [Chapter 23](/chapters/w-and-z/) finds the carriers, the W and the Z, and puts the weak force and electromagnetism together in one theory.

## Further reading

- Laurie Brown's article on the idea of the neutrino, for Pauli's letter in English (:cite[brown1978]).
- Lee and Yang's paper of 1956, which is short and readable, and Wu's of 1957 (:cite[leeyang1956,wu1957]).
- Feynman and Gell-Mann, *Theory of the Fermi interaction* (:cite[feynman1958]).
- The Particle Data Group's review articles on the muon, the pion and the electroweak model (:cite[pdg2024]).
