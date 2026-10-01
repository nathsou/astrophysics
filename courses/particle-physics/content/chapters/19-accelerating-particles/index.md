---
number: 19
title: Accelerating particles
summary: How a proton is taken from rest to 6.8 TeV with a few megavolts. Radio-frequency cavities, linacs, the cyclotron and its relativistic limit, the synchrotron, the principle of phase stability, and the chain of machines that feeds the LHC.
duration: About 2½ hours
prerequisites: [relativity-for-particles]
---

The LHC gives each proton an energy of 6.8 TeV. Nowhere in the machine is there a voltage of 6.8 million megavolts, or anything close to it. The accelerating system of each beam is eight superconducting metal cavities, which together can apply at most about 16 MV (the design value).:cite[lhc-design] The proton goes round a ring 26.7 km long, 11,245 times a second, and each time it passes through the cavities it is pushed a little. Going from the injection energy of 450 GeV to 6.8 TeV needs a gain of 6,350 GeV. If the ramp takes twenty minutes, the gain per turn is about 0.47 MeV, out of the 16 MeV available, and the proton crosses the same cavities thirteen million times.

That arrangement works only if two conditions hold. The push must have the right sign every time, which means the field in the cavity must reverse in step with the proton's motion to within a fraction of a nanosecond. And a proton that is slightly early or late must be pushed back towards the right timing rather than away from it, or the beam would be lost within a few thousand turns. The second condition is not obvious. It took until 1944–45 for anyone to see that it can be met, and it is the reason every large accelerator since has been built the way it is.

This chapter follows the ideas in the order they were found. First the obvious approach, one large voltage, and why it stops at a few million volts. Then the trick of using a small voltage many times, in a line of tubes (the linear accelerator) and in a circle (the cyclotron and the synchrotron). Then the principle that keeps the beam together, *phase stability*, the subject of the chapter's main figure. The last section follows a proton along CERN's chain of machines, from a bottle of hydrogen to the LHC. The magnets that keep the beam on its path are the subject of Chapter 20; here they appear only as devices that bend the orbit into a circle.

## One big voltage

A particle of charge *q* falling through a potential difference *V* gains an energy *qV*. For a proton, one electron-volt of energy is one volt of potential: a 6.8 TeV proton has fallen through 6.8 × 10¹² V. The first accelerators were built to do that, with as high a voltage as could be made.

In 1932 John Cockcroft and Ernest Walton, at the Cavendish Laboratory in Cambridge, used a generator that multiplied a transformer's alternating voltage with a cascade of rectifiers and capacitors to accelerate protons in an evacuated tube towards a target of lithium.:cite[cockcroft1932] Another family of machines, the Van de Graaff generators, carries charge on a moving belt to a hollow metal terminal and lets it accumulate. Both give a steady (direct-current) voltage, so both are **electrostatic accelerators**, and both share one limit: at some voltage the insulation fails. Dry air at atmospheric pressure breaks down in a field of about 3 MV per metre. Better insulating gases and careful shaping of the electrodes gain a factor of a few, not a factor of a thousand. An electrostatic machine reaches some megavolts, and no more.

:::history{year=1932 title="Cockcroft and Walton split the lithium nucleus" people="John Cockcroft, Ernest Walton" source="Sources: Cockcroft and Walton (1932); the Nobel Prize in Physics 1951."}
Nuclei had been broken before, by the alpha particles of natural radioactivity. The question of the early 1930s was whether a machine could do the same with particles it accelerated itself, and with how much energy. Gamow's theory of tunnelling (1928) suggested that protons of a few hundred keV might be enough to enter a light nucleus, far less than the millions of volts the alpha particles had suggested.

Cockcroft and Walton built a voltage multiplier that gave protons of up to about 700 keV, aimed them at lithium, and saw alpha particles emerging: a proton had entered a ⁷Li nucleus, and the nucleus had split into two helium nuclei. They reported it in 1932, and the observation is dated to 14 April.:cite[cockcroft1932] It was the first nuclear reaction produced with an artificially accelerated beam, and they shared the 1951 Nobel Prize in Physics for it. The lesson was that protons of a few hundred keV could do nuclear physics; what followed was a race to ever higher energies, for ever higher goals.
:::

```fermi
id: electrostatic-length
title: An electrostatic LHC
prompt: 'Suppose the 6.8 TeV beam of the LHC were made in one go by falling through a steady electric field of 3 MV per metre (about what dry air withstands) along a straight line. How long, in metres, would the machine be?'
answer: 2.3e6
unit: m
factor: 3
hints:
  - 6.8 TeV is 6.8 × 10¹² eV, so a proton needs to fall through 6.8 × 10¹² V.
  - Length = voltage divided by field.
explain: "L = 6.8 × 10¹² V / (3 × 10⁶ V/m) = 2.3 × 10⁶ m, or 2,300 km: Geneva to beyond Moscow. Even a good accelerating structure, at about 20 MV/m, would need 340 km. The LHC is 27 km in circumference, and its protons pass the cavities millions of times because the cavities are the only place where they gain energy. Everything that follows is about reusing a small voltage."
```

## Small pushes, in step: the linear accelerator

The way round the insulation limit was found by the Norwegian engineer Rolf Widerøe in 1928. Do not apply a high voltage once: apply a modest voltage many times, and never let it act against the particle. Widerøe's arrangement is a row of metal tubes in a vacuum, **drift tubes**, alternately connected to the two terminals of an alternating-voltage source.:cite[wideroe1928] A particle crossing the gap between two tubes is pushed if the gap's field points the right way. Inside a tube it is shielded from the field and simply drifts. If the tube is long enough that the voltage has reversed by the time the particle reaches the next gap, the particle is pushed again, and so on down the line. The energy after *n* gaps is *n* times what one gap gives, with no voltage larger than one gap's ever applied.

:::history{year=1928 title="A voltage used twice" people="Rolf Widerøe" source="Sources: Widerøe (1928); Bryant (1994); Lawrence and Livingston (1932)."}
Rolf Widerøe described the principle in 1928 and demonstrated it: a radio-frequency source delivering about 25 kV at about 1 MHz gave potassium ions an energy of about 50 keV, twice the applied voltage, because the ions crossed two gaps.:cite[wideroe1928,bryant1994] It was the first time a particle had been given more energy than the largest voltage in the apparatus, and it showed that the limit of the electrostatic machines was not a limit of nature.

The paper was in German, in an electrical-engineering journal. Ernest Lawrence, a young physicist at the University of California, is usually said to have been led by it, around 1929, to the idea of replacing the row of tubes by a single gap traversed again and again, with the particles made to go in circles. That idea became the cyclotron.:cite[bryant1994,lawrence1932]
:::

The part that needs calculating is the length of the tubes. The voltage changes sign every half period, so the particle must take exactly half a period to cross each tube. At an RF frequency *f* the half period is 1/(2*f*), and a particle moving at a speed β*c* covers β*c*/(2*f*) in that time.

:::equation{#drift-tube caption="The length of the n-th drift tube: the distance the particle covers in half an RF period."}
$$\term{Ln}{L_n} = \term{beta}{\beta_n}\,\frac{\term{c}{c}}{2\,\term{f}{f}} = \frac{\beta_n\,\term{lam}{\lambda}}{2}, \qquad \lambda = \frac{c}{f}$$

```terms
Ln:
  label: 'Lₙ, the length of a drift tube'
  what: The length of the tube that follows the n-th accelerating gap, in metres.
  why: The particle must cross it in half an RF period, so that the field has reversed when it reaches the next gap.
  effect: Short at low speed, longer as the particle speeds up; at β close to 1 every tube is half an RF wavelength long.
beta:
  label: 'βₙ, the speed'
  what: The particle's speed after n gaps, as a fraction of the speed of light.
  why: It sets how far the particle goes in half an RF period.
  effect: A 10 MeV proton has β = 0.145 and a 50 MeV proton 0.314.
c:
  label: 'c, the speed of light'
  what: 299,792,458 m/s.
  why: β is a fraction of it, so βc is the speed in metres per second.
  effect: At 200 MHz, c/2f = 0.75 m, the tube length for a particle at the speed of light.
f:
  label: 'f, the RF frequency'
  what: The number of oscillations of the accelerating voltage per second, in hertz.
  why: Its inverse is the period that sets the timing.
  effect: A higher frequency means shorter tubes and a more compact machine, but harder engineering.
lam:
  label: 'λ, the RF wavelength'
  what: c/f, the distance a radio wave travels in one period.
  why: It expresses the tube length as a fraction of the wave.
  effect: 1.50 m at 200 MHz, and 0.75 m at 400 MHz, the LHC's frequency.
```
:::

For a proton of 10 MeV in a 200 MHz linac, β = 0.145 and the tube is 10.9 cm long; at 50 MeV it is 23.5 cm. Try other values below, where each gap adds the same energy.

::drift-tubes{n="19.1" caption="A row of drift tubes, each βλ/2 long. Raise the frequency and the tubes shorten. The first tubes are much shorter than the later ones, because the speed grows fast at low energy, and the lengths approach λ/2 when β nears 1. The last two numbers show the cost: hundreds of gaps, and more than a hundred metres, to reach the 160 MeV of CERN's Linac4 at these settings. Real linacs have a much higher field in each gap, several structure types, and focusing magnets inside the tubes; this figure keeps only the timing."}

The timing condition has a consequence. The particle gets the full push only if it crosses the gap at the crest of the field, and one that arrives a little earlier or later gets a different push. A linac therefore does not accelerate a continuous stream. It accelerates **bunches**: groups of particles short enough, compared with the RF period, to see nearly the same field. Particles arriving at the wrong phase are not accelerated, and the machine delivers a beam chopped into bunches, one per RF period.

**Linac4** at CERN is a linear accelerator of this kind. It accelerates negative hydrogen ions (a proton with two electrons) to 160 MeV in several types of structure, one after another as the speed grows, at RF frequencies of 352 and 704 MHz.:cite[linac4] It began to feed CERN's accelerators in 2020, replacing the older Linac2, which reached 50 MeV.:cite[ls2-booster] Negative ions are used for a reason we meet in the last section. A linac reaches a high energy only by being long: its energy is its length times its accelerating gradient, and protons of several TeV would need a line of hundreds of kilometres. To reach them, the structure must be folded into a circle.

## Going round in circles: the cyclotron

Lawrence's idea was to replace the row of tubes by one gap and to bring the particle back to it with a magnetic field. A charged particle in a uniform field *B* moves on a circle. Balancing the magnetic force *qvB* against the centripetal force γ*mv*²/*r* gives *r* = γ*mv*/(*qB*) = *p*/(*qB*), which is the rule *p* = 0.3 *B* *r* (GeV/*c*, tesla, metres) of Chapter 5. The time to go once round is 2π*r*/*v*, and at low speed *r* is proportional to *v*, so the speed cancels:

:::equation{#cyclotron-frequency caption="The revolution frequency of a charged particle in a magnetic field. At low speed it does not depend on the radius or on the energy."}
$$\term{fc}{f_c} = \frac{\term{q}{q}\,\term{B}{B}}{2\pi\,\term{gam}{\gamma}\,\term{m}{m}}$$

```terms
fc:
  label: 'f_c, the cyclotron frequency'
  what: The number of times per second the particle goes round its circle, in hertz.
  why: It is the frequency at which the gap's voltage must alternate to push the particle on every passage.
  effect: For a proton it is 15.25 MHz in 1 T, and 22.9 MHz in 1.5 T: radio frequencies, hence RF.
q:
  label: 'q, the charge'
  what: The particle's electric charge, in coulombs (1.602 × 10⁻¹⁹ C for a proton).
  why: The magnetic force on a moving charge is proportional to q.
  effect: An alpha particle has twice a proton's charge and about four times its mass, so it runs at about half the frequency.
B:
  label: 'B, the magnetic field'
  what: The field strength in tesla, assumed uniform.
  why: A stronger field bends the path more tightly and makes the particle go round faster.
  effect: Doubling B doubles the frequency and halves the radius at a given momentum.
gam:
  label: 'γ, the Lorentz factor'
  what: E/mc² = 1 + T/mc² for kinetic energy T.
  why: A relativistic particle behaves as if it were γ times heavier, so it goes round more slowly.
  effect: γ = 1.1 for a proton of 94 MeV, where the frequency has already dropped by 9%. At the LHC, γ is 480 at injection and 7,250 at 6.8 TeV.
m:
  label: 'm, the rest mass'
  what: The particle's mass at rest, in kilograms (1.673 × 10⁻²⁷ kg for a proton).
  why: A heavier particle is harder to turn, so it takes longer to go once round.
  effect: An electron is 1,836 times lighter than a proton and runs 1,836 times faster in the same field.
```
:::

The frequency depends on *q*, *B* and *m* and on nothing else: a particle at a small radius and one at a large radius go round in the same time. A **cyclotron** exploits this. Two hollow half-discs ("dees") sit in a vacuum between the poles of a magnet, with a gap between them, and an alternating voltage at the cyclotron frequency is applied. A proton injected at the centre crosses the gap and is pushed, moves on a larger semicircle inside a dee (shielded from the electric field), returns to the gap half a period later when the voltage has reversed, and is pushed again. It spirals outwards, gaining energy at each of two crossings per turn. The whole machine is one magnet and one fixed-frequency oscillator, and its energy is limited by the radius of the magnet rather than by a voltage.

:::history{year=1931 title="A magnet in place of a long line of tubes" people="Ernest Lawrence, M. Stanley Livingston" source="Sources: Lawrence and Livingston (1932); the Nobel Prize in Physics 1939."}
Lawrence, working at Berkeley with his student M. Stanley Livingston, built the first small working cyclotron in 1931. In a paper sent to *Physical Review* in February 1932 they reported protons of more than a million electron-volts from a machine 28 cm (11 inches) across, using an alternating voltage of only about 4,000 V: the protons went round more than 300 times.:cite[lawrence1932] That was an energy no insulator of the time could have held as a voltage, reached from a few kilovolts. Lawrence received the 1939 Nobel Prize in Physics.

The cyclotron made accelerator physics an industry. Lawrence's laboratory built ever larger machines through the 1930s, with the magnet's radius, and the money to build it, as the limit. Cyclotrons are still built in large numbers, for making the radioactive isotopes used in medicine and for treating cancer with protons.
:::

### The relativistic limit

The formula above has a γ in it, and γ is not constant. When the proton's kinetic energy reaches 94 MeV, which is 10% of its rest energy, γ = 1.1 and the revolution frequency is 9% lower than at the start. The oscillating voltage was tuned to the slow proton; the fast proton reaches the gap a little later in each cycle than on the turn before, and is pushed a little less. After some tens or hundreds of turns it arrives when the field has gone through zero, is pushed backwards, and loses energy. A fixed-frequency cyclotron has a limit that depends on the energy gained per turn and not on the size of the magnet.

```predict
q: 'A cyclotron has a fixed RF frequency. Its designer wants protons of higher energy, so she doubles the voltage across the gap, keeping everything else the same. The protons now reach (roughly) what maximum energy, compared with before?'
options:
  - text: The same energy, because the limit is set by the magnet's radius.
    why: 'The magnet radius would limit the energy if nothing else did. Here the limit comes first: the protons fall out of step with the RF, whatever the radius.'
  - text: About twice the energy, because each turn gives twice as much.
    why: 'Doubling the gain per turn also doubles how fast γ grows, so the protons slip out of step after fewer turns. The two effects do not simply multiply.'
  - text: About 1.4 times the energy, the square root of two.
    correct: true
    why: 'The phase slip per turn is proportional to γ − 1, which grows as the number of turns n times the gain per turn g. The total slip after n turns goes as g n², and the proton falls out of step when it reaches a fixed amount, so n goes as 1/√g and the energy, g n, as √g. Raise the voltage in the figure below and watch.'
```

::cyclotron-limit{n="19.2" caption="A toy cyclotron: two gap crossings per turn, each gaining eV cos φ, where φ is the proton's phase on the RF wave. In the fixed-frequency machine, raise the voltage and watch the limiting energy rise as its square root; for 100 kV it is of the order of 10 MeV, and the proton then slides off the back of the wave and loses energy (the phase plot leaves the shaded band). The isochronous machine keeps the revolution time constant by letting the magnetic field rise with radius; the frequency-modulated one lowers the RF frequency as the proton gets heavier. Neither meets the limit, in this model."}

Two remedies were found. One is to shape the magnet so that its field rises with radius in exactly the way that keeps the revolution frequency constant, *B* ∝ γ. This **isochronous cyclotron** is how the machines that give protons some hundreds of MeV, for medicine and isotope production, work. The other remedy is to lower the RF frequency as the proton speeds up, so that the wave stays in step however heavy the proton gets. That is the **synchrocyclotron**. Its disadvantage is that only protons at the right phase are accelerated, so the beam comes in pulses, one per frequency sweep, instead of continuously. Its advantage is that relativity sets no limit: the energy rises as far as the magnet allows. CERN's first accelerator was a synchrocyclotron.

:::history{year=1957 title="CERN's first accelerator" people="CERN" source="Source: CERN's history pages (the CERN70 timeline)."}
CERN's convention came into force in 1954 (Chapter 0). Its first accelerator, the 600 MeV synchrocyclotron (the SC), started up in 1957 and provided the laboratory's first beams for particle and nuclear physics. From 1964 it concentrated on nuclear physics, leaving particle physics to the newer Proton Synchrotron. In 1967 it began supplying beams to ISOLDE, a facility for short-lived radioactive nuclei that still runs today. The SC was shut down in 1990, after 33 years.:cite[cern-sc]

It was a modest machine, and while larger ones were being built it gave the young laboratory something to do: its first experiments, its first technicians and its first habits of working together.
:::

The synchrocyclotron's cure contains the idea that matters for the rest of the chapter. The RF frequency is being changed to follow one particular proton, the **synchronous** one. Every other proton either falls behind it or runs ahead, and it turns out that, with the sweep done in the right sense, they do not drift away: they oscillate about it. That was noticed in the mid-1940s, and it needs a section of its own. First, the next machine.

## The synchrotron

A magnet as large as the orbit is expensive, and at 6.8 TeV a cyclotron magnet would be a disc 2.8 km in radius, even at 8 T. The alternative is to keep the orbit at a fixed radius ρ and to raise the magnetic field as the proton's momentum rises, so that *B*(*t*) = *p*(*t*)/(0.3 ρ) is always the field that holds the radius. The magnets are then needed only along a thin ring, and the beam travels in a narrow vacuum pipe. This is the **synchrotron**. The magnet field must be ramped in step with the momentum, and so must the RF frequency, which is always a whole number *h* (the **harmonic number**) times the revolution frequency:

$$f_\text{RF} = h\, f_\text{rev}, \qquad f_\text{rev} = \frac{\beta c}{C}.$$

For the LHC, *C* = 26,658.883 m, so a proton at practically the speed of light goes round 11,245.5 times a second, and with *h* = 35,640 the RF frequency is 400.79 MHz.:cite[lhc-design] Because the protons are already extremely relativistic at 450 GeV (1 − β = 2.2 × 10⁻⁶), the revolution frequency changes by only about two parts in a million during the whole ramp to 6.8 TeV, and the RF frequency by about 870 Hz out of 400 MHz. A synchrocyclotron must change its frequency by tens of percent. An electron synchrotron hardly changes its RF frequency at all, because electrons are relativistic almost from the start.

There is a consequence for the beam's structure. The RF wave has *h* crests around the ring, and each is a place where a bunch can sit and be accelerated. These *h* places are the **RF buckets**. In the LHC, *h* = 35,640, and ten buckets fit in each 25 ns interval, the LHC's bunch spacing. Only one in ten is ever filled, which is why the beam is made of bunches 25 ns apart, not 2.5 ns apart. Of the 3,564 slots of 25 ns around the ring, 2,808 are filled in the design beam; the others are gaps, for the injection kickers to rise and for the beam-dump magnets to fire (Chapter 21).

```numeric
id: lhc-rf-frequency
title: The LHC's RF frequency, from its geometry
prompt: 'The LHC has a circumference of 26,658.883 m, and protons travel at practically the speed of light (299,792,458 m/s). The harmonic number is 35,640. What RF frequency, in MHz, follows?'
answer: 400.79
unit: MHz
tolerance: 0.001
hints:
  - The revolution frequency is c/C.
  - Multiply it by the harmonic number h.
```

## Phase stability

This is the core of the chapter, and the question is the one in the opening. A proton goes through the cavity on every turn. The synchronous proton arrives at the moment at which the RF wave gives it exactly the energy the ring needs: zero in a machine coasting at fixed energy, a few hundred keV per turn in a ramp. Another proton arrives slightly earlier or later in the wave, and gets a different push. Will it be brought back to the synchronous one, or pushed away?

To answer, we need to know how a change in energy changes the time of arrival. Two effects act, and they oppose each other. A proton with more momentum moves faster: its speed β rises, though very little at high energy. But it also moves on a larger orbit, because the magnets bend it less, and a longer path takes longer. The fractional change in path length per fractional change in momentum is the **momentum compaction factor** α<sub>c</sub>, a property of the ring's magnets. The fractional change in speed is Δβ/β = Δ*p*/(*p*γ²). The revolution time is *C*/(β*c*), so its fractional change is Δ*C*/*C* − Δβ/β:

:::equation{#slip caption="The slip factor: how much the revolution time changes when the momentum changes. Its sign decides where on the RF wave the synchronous particle must sit."}
$$\frac{\Delta \term{T}{T}}{T} = \term{eta}{\eta}\,\frac{\Delta \term{p}{p}}{p}, \qquad \eta = \term{alpha}{\alpha_c} - \frac{1}{\gamma^2}$$

```terms
T:
  label: 'T, the revolution time'
  what: The time to go once round the ring, in seconds: T = C/(βc).
  why: It decides when the particle arrives at the cavity on its next turn.
  effect: For the LHC, T = 88.9 µs, hardly different between 450 GeV and 6.8 TeV.
eta:
  label: 'η, the slip factor'
  what: The fractional change in revolution time per fractional change in momentum. Positive above transition, negative below.
  why: It says whether a proton with extra energy arrives late (η > 0) or early (η < 0) on its next turn.
  effect: At the LHC's injection η = +3.2 × 10⁻⁴: a proton with 0.1% more momentum takes 28 ps longer per turn.
p:
  label: 'p, the momentum'
  what: The particle's momentum; Δp/p is its fractional deviation from the synchronous particle's.
  why: It is what the magnets act on: a proton of different momentum follows a different orbit.
  effect: The bunch drawn in the RF-bucket figure has a spread Δp/p of 3 × 10⁻⁴.
alpha:
  label: 'α_c, the momentum compaction factor'
  what: The fractional change in orbit length per fractional change in momentum, set by the magnet layout.
  why: It measures how much longer the path is for a proton that is bent less.
  effect: 3.2 × 10⁻⁴ for the LHC (design value), so that γ_t = 1/√α_c = 55.7.
```
:::

Both terms of η are fixed by the machine and the energy. At low energy 1/γ² is large and wins: η < 0, and a proton with more energy goes round *faster* and arrives early. At high energy 1/γ² is small and α<sub>c</sub> wins: η > 0, and a proton with more energy goes round *slower*, because its path is longer. The energy at which the two cancel is the **transition energy**, at γ<sub>t</sub> = 1/√α<sub>c</sub>. For the LHC, γ<sub>t</sub> = 55.7, which is 52 GeV; the machine works from 450 GeV to 6.8 TeV, above transition all the time, and never has to cross it. The PS at CERN does cross it while accelerating from 2 GeV to 26 GeV, and needs a special procedure at that moment, since the stable phase changes sides.

Now the RF. A particle that crosses the cavity at phase φ, measured from the zero of the voltage, gains an energy *eV* sin φ, where *V* is the peak voltage. Suppose the synchronous particle arrives at φ<sub>s</sub>. Above transition, a particle arriving *late* has too much energy, since more energy means a slower lap and a later arrival. To restore it, the cavity must give it *less* energy than the synchronous particle got, and that happens on the side of the wave where the voltage is falling. A particle arriving *early* has too little energy, and on the falling side it gets more than the synchronous particle. Below transition the signs reverse and the synchronous phase must be on the rising side. **The synchronous particle must sit on the side of the wave where late particles get less.**

```predict
q: 'Above transition, a proton arrives at the cavity later than the synchronous one. What must the cavity do to bring it back in step?'
options:
  - text: Give it more energy than the synchronous proton, to catch up.
    why: 'That is the intuition from everyday speed: a late runner must go faster. But above transition a proton with more energy goes round slower (its longer path outweighs its higher speed), so it would be later still.'
  - text: Give it less energy than the synchronous proton.
    correct: true
    why: 'Above transition, more energy means a longer lap, so a late proton is one with too much energy, and it must lose some. The sign of the slip factor is the whole point.'
  - text: Nothing: a late proton will arrive on time by itself.
    why: 'Without the cavity’s restoring push, a proton of the wrong energy keeps the wrong revolution time for ever, and its lateness grows by the same amount on every turn.'
```

Put the two pieces together. Write Δφ for a proton's phase relative to the synchronous one and Δ*E* for its energy offset. Each turn the cavity changes the energy, and the changed energy changes the arrival time on the next turn. With *h* the harmonic number, *V* the peak voltage, and β and *E* the speed and energy of the synchronous proton:

:::equation{#standard-map caption="One turn of longitudinal motion, in two lines. This is the map that the RF-bucket figure iterates."}
$$\Delta \term{E}{E}' = \Delta E + \term{eV}{eV}\,\big[\sin(\term{phis}{\varphi_s} + \term{dphi}{\Delta\varphi}) - \sin\varphi_s\big], \qquad \Delta\varphi' = \Delta\varphi + \frac{2\pi\,\term{h}{h}\,\eta\,\Delta E'}{\term{b2E}{\beta^2 E}}$$

```terms
E:
  label: 'ΔE, the energy offset'
  what: The energy of this proton minus the synchronous proton's, in GeV. The prime marks its value one turn later.
  why: It is one of the two coordinates of the proton in longitudinal phase space.
  effect: At the LHC's injection the edge of the bucket is at 0.45 GeV, and the bunch in the figure has offsets of about 0.1 GeV.
eV:
  label: 'eV, the energy scale of the RF'
  what: The proton's charge times the peak cavity voltage: the most energy it can gain in one turn.
  why: It multiplies the sine, and so sets how strongly the cavity pulls a proton back.
  effect: 8 MV at the LHC's injection, 16 MV at top energy in the design.
phis:
  label: 'φ_s, the synchronous phase'
  what: The phase of the RF wave at which the synchronous proton crosses the cavity.
  why: sin φ_s sets the energy the synchronous proton gains each turn.
  effect: Zero gain in a ring at constant energy. In a twenty-minute ramp of the LHC it is about 3% of the peak voltage.
dphi:
  label: 'Δφ, the phase offset'
  what: This proton's phase minus the synchronous proton's, in radians; one RF period is 2π.
  why: It is the other coordinate of the proton in longitudinal phase space.
  effect: One RF period at the LHC is 2.5 ns, so a bunch of length 30° (σ) is about 0.2 ns long.
h:
  label: 'h, the harmonic number'
  what: The RF frequency divided by the revolution frequency: the number of buckets around the ring.
  why: A proton late by a time δt is late by 2πhδt/T in RF phase, so h converts time into phase.
  effect: 35,640 for the LHC.
b2E:
  label: 'β²E, the synchronous energy times β²'
  what: The factor that converts the energy offset into a fractional momentum offset: Δp/p = ΔE/(β²E).
  why: The slip factor is defined for Δp/p, not for ΔE.
  effect: At the LHC it is almost exactly 450 GeV at injection and 6.8 TeV at the top.
```
:::

For small offsets the sine can be replaced by its slope, the two lines become the equations of an oscillator, and a proton oscillates about the synchronous one with a **synchrotron tune** (oscillations per turn) set by the slope of the wave at the synchronous phase:

:::equation{#synchrotron-tune caption="The synchrotron tune: the number of oscillations about the synchronous particle per turn, for small amplitudes."}
$$\term{Qs}{Q_s} = \sqrt{\frac{-\,h\,\eta\,eV\cos\varphi_s}{2\pi\,\beta^2 E}}$$

```terms
Qs:
  label: 'Q_s, the synchrotron tune'
  what: The number of complete oscillations in phase and energy per turn. It is small, so each oscillation takes many turns.
  why: It says how quickly errors in timing and energy are corrected; a small value means a soft restoring force.
  effect: At the LHC's injection (450 GeV, 8 MV) Q_s = 5.7 × 10⁻³, one oscillation in 177 turns, or 64 Hz. At 6.8 TeV and 16 MV it is 2.1 × 10⁻³, or 23 Hz.
```
:::

The square root contains −η cos φ<sub>s</sub>, which must be positive for the motion to be an oscillation: η cos φ<sub>s</sub> must be negative. **That is phase stability**: above transition (η > 0) the synchronous phase must be where the cosine is negative, on the falling side of the wave; below transition, on the rising side. For large amplitudes the curvature of the sine matters and the motion is that of a pendulum. There is a boundary beyond which oscillation turns into rotation, the **separatrix**, and everything inside it is the **RF bucket**. A proton inside circulates round the synchronous point for ever, in this idealisation. A proton outside it slips away, turn by turn, and is lost from the accelerating process.

:::history{year=1945 title="The principle of phase stability" people="Vladimir Veksler, Edwin McMillan" source="Sources: Veksler (1944, 1945); McMillan (1945); Elder and others (1947)."}
In the Soviet Union, in 1944, Vladimir Veksler published the idea that particles could be kept in step with an RF field by using the dependence of their revolution time on energy. In 1945, independently, Edwin McMillan at Berkeley wrote the same principle into a paper proposing a new machine, which he named the synchrotron.:cite[veksler1944,mcmillan1945] Their result freed accelerators from the limit of the cyclotron in two ways at once: the RF frequency may change during acceleration, which gave the synchrocyclotron and the synchrotron, and the orbit may stay at a fixed radius, which gave the ring. McMillan and Veksler shared the Atoms for Peace Award in 1963.

The first machines built on the principle were electron synchrotrons, in 1946 and after. In a 70 MeV one at the General Electric laboratory in Schenectady, the light emitted by the electrons was seen by eye for the first time, in 1947; Chapter 21 returns to it.:cite[elder1947]
:::

::rf-bucket{n="19.3" caption="The LHC's RF bucket at injection: 450 GeV protons, 400 MHz. Each dot is a proton; the horizontal axis is its phase on the RF wave, the vertical axis its momentum offset. Play, and the protons circulate about the synchronous point (the cross). The amber curve is the separatrix. Press Overfill the bucket: the bunch is larger than the bucket, and the protons outside it turn red and are lost. Raise the acceleration percentage (the energy gain as a fraction of the RF crest): the bucket shrinks, and at 100% it would vanish. Lower the RF voltage and the bucket narrows as the square root of the voltage."}

Three features of the figure repay a look. First, the stationary bucket (no acceleration, φ<sub>s</sub> = π above transition) is the widest, with a half-height in Δ*p*/*p* of 2*Q*<sub>s</sub>/(*h* |η|): at 450 GeV and 8 MV, ±1.0 × 10⁻³, or ±0.45 GeV. Second, acceleration shrinks the bucket, because the wave must be tilted to give the synchronous particle some push; when the whole crest is used for acceleration the bucket has gone. There is a maximum acceleration rate for a given voltage. Third, what matters to the beam is the *area* of the bucket, in units of energy times time. The LHC's at injection is 1.4 eV·s, and a bunch injected with a longitudinal emittance larger than that loses its tail.

:::programmer
The RF system is a clock-distribution problem. Every bunch in the machine must be tied to one shared clock to a fraction of a nanosecond, and the clock must follow the beam as its revolution time changes. Synchrotrons do this with feedback loops of the same family as the phase-locked loop that keeps a radio tuned to a station: the phase of the bunches is measured against the cavity voltage, and the error steers the RF frequency. The two-line map above is also a familiar object, a **discrete-time dynamical system** with two state variables and an update rule, here iterated 11,245 times a second. What the beam physicist asks of it is what a programmer would ask of any control loop: is the fixed point stable, and how large is its basin of attraction? The basin is the bucket.
:::

:::hood[Why the map updates the energy first]
The library's `stepLongitudinal` does what the equations say, in this order (from `src/lib/hep/machine/longitudinal.ts`):

```ts
export function stepLongitudinal(q: LongParticle, p: RfParams): void {
  q.dE += eV(p) * (Math.sin(p.phiS + q.dphi) - Math.sin(p.phiS));
  q.dphi += (2 * Math.PI * p.harmonic * p.eta * q.dE) / (betaSquared(p) * p.energy);
}
```

The second line uses the energy *after* the kick, `q.dE`, which the first line has just updated. The order matters. It makes the map **symplectic**: it preserves areas in the (Δφ, ΔE) plane, as the real motion does (Liouville's theorem), so it neither creates nor destroys emittance. Written with the old energy in both lines, the obvious way to discretise two coupled equations (explicit Euler), every step would enlarge the area a little and orbits would spiral outwards, at a rate invisible in a hundred turns and fatal in a million. This chapter's tests follow a small oscillation for 10⁵ turns with both orderings: the invariant of the motion stays constant to a few parts in 10³ with the library's order and grows by orders of magnitude with the other. The LHC's protons make about 10⁷ turns in a ramp, and a simulation of them must not add its own heating.
:::

## Bunches, buckets and trains

The vocabulary is worth fixing. A **bucket** is a region of phase space: the place where a proton could be. A **bunch** is protons in a bucket. The LHC has 35,640 buckets and fills at most 2,808 of them, in **trains** of bunches 25 ns apart, with gaps between trains. The design bunch holds about 1.15 × 10¹¹ protons and is 7.55 cm long (rms, at 7 TeV), which is 36° of RF phase at 400 MHz.:cite[lhc-design] The bunch length is a quantity that returns in Chapter 21, because it sets how far along the beam axis the collisions are spread.

## Feeding the LHC: the injector chain

No single machine covers the range from a hydrogen atom to 6.8 TeV. A ring's magnets can be ramped usefully only over a limited range, as a rule of thumb a factor of 10 to 20 in field, partly because at low fields the magnets' remanent magnetisation makes the field hard to reproduce. So each machine takes the beam from the previous one and multiplies its momentum by about that much. The LHC's dipole field goes from 0.54 T at injection to 8.1 T at 6.8 TeV, a factor of 15. The PS takes the beam from 2.8 to 26 GeV/*c* (9.4 times), the SPS from 26 to 450 GeV/*c* (17 times) and the LHC from 450 to 6,800 (15 times).

::injector-chain{n="19.4" caption="CERN's proton injector chain, with the rings drawn to scale. Pick a stage. After the Booster the speed is so close to that of light that the revolution frequency is set by the circumference alone, and the magnetic rigidity Bρ (the momentum in tesla-metres) grows by a factor of 260 from the PS to the LHC. The SPS's circumference is eleven times the PS's (6,911 m and 628 m)."}

The stages, in order:

1. **The source.** Hydrogen gas is ionised in a discharge, and the ions are pulled out and formed into a beam. The first accelerator, Linac4, takes negative hydrogen ions, H⁻, for a reason given in stage 3.
2. **Linac4** takes the H⁻ ions to 160 MeV.:cite[linac4]
3. **The Proton Synchrotron Booster** (PSB) is four small synchrotron rings of 157 m circumference, stacked one above another, which take the beam to 2 GeV of kinetic energy.:cite[ls2-booster] On entering, the H⁻ ions pass through a thin foil that strips off both electrons and leaves bare protons. The injected beam and the circulating one therefore have opposite charge until the moment of stripping, and the new protons can be added to those already circulating, which no arrangement of magnets could do for beams of the same sign (phase-space density cannot be raised by magnets alone: Liouville's theorem). This is how a high intensity is built up.
4. **The Proton Synchrotron** (PS), 628 m in circumference and CERN's machine from 1959 (Chapter 20), takes the protons from 2 GeV to about 26 GeV. It also reshapes the bunches, splitting each into smaller ones, until they are 25 ns apart, the spacing the LHC needs.
5. **The Super Proton Synchrotron** (SPS), 6.9 km in circumference in its own tunnel, took its first beam on 3 May 1976 and reached its design energy of 400 GeV on 17 June that year.:cite[sps-start] In the LHC chain it takes the beam from 26 to 450 GeV. In 1981 it also became a proton–antiproton collider, the machine that discovered the W and Z bosons (Chapter 23).
6. **The LHC.** Bunches from the SPS are injected in batches into two rings, one for each direction. The RF and the magnets then ramp together from 450 GeV to 6.8 TeV.

The energies are quoted as usually given for the LHC cycle; the machines run other cycles for CERN's other experiments, on a schedule that changes every few seconds.

```quiz
q: 'Why does the LHC need a chain of several machines in front of it, instead of one large injector?'
options:
  - text: Because protons cannot be made at energies below 450 GeV.
    why: 'Protons are made easily at rest: a hydrogen discharge is enough. The difficulty is getting them to a high energy, not making them.'
  - text: Because each ring's magnets and RF work well over a limited range of energy, about a factor of 10 to 20, so several rings are needed to cover a factor of several tens of thousands.
    correct: true
    why: 'From Linac4’s 160 MeV to the LHC’s 6.8 TeV is a factor of about 40,000 in kinetic energy, and each machine covers a factor of 10 to 20 in momentum. The field at injection must be large enough to be reproducible, which limits the range of a given ring.'
  - text: Because the LHC's RF cannot capture protons unless they are already relativistic.
    why: 'A synchrotron can capture slow protons in principle: the PS Booster does. The limit is on the range of the magnets.'
```

:::experiments
CERN's machines are operated from the CERN Control Centre, and their behaviour is predicted by simulation programs that play, at production scale, the role of this chapter's toolkit. **MAD-X** (Methodical Accelerator Design) computes the optics of a lattice, the subject of Chapter 20. **SixTrack** follows particles through a ring for millions of turns. **BLonD** (Beam Longitudinal Dynamics) simulates the RF bucket with effects this chapter leaves out, such as the interaction of a bunch with its own electromagnetic fields, which can make a bunch unstable. The course's `hep/machine` library has none of those collective effects. It is the ideal single-particle picture, and the prose says where the real machine departs from it.
:::

```numeric
id: slip-factor-injection
title: Is the LHC above transition at injection?
prompt: 'The LHC’s momentum compaction factor is α_c = 3.225 × 10⁻⁴ (design). At injection the protons have an energy of 450 GeV (γ = 479.6). What is the slip factor η = α_c − 1/γ², in units of 10⁻⁴?'
answer: 3.18
unit: × 10⁻⁴
tolerance: 0.02
hints:
  - 1/γ² = 1/479.6².
  - 1/γ² is 0.0435 × 10⁻⁴, small beside α_c.
explain: "η = 3.225 × 10⁻⁴ − 0.0435 × 10⁻⁴ = 3.18 × 10⁻⁴. It is positive, so the LHC is above transition at 450 GeV and stays so: η only rises towards α_c as the energy increases."
```

## What comes next

The cavities push the beam, and a ring's dipole magnets bend it into a circle. Nothing so far explains why the beam stays in a pipe a few centimetres across for ten hours, going round a hundred million times. A proton that leaves the axis even by a millimetre moves away at an angle, and without a force pulling it back it would reach the wall within metres. Chapter 20 adds the second system of the machine: the magnets that steer the beam, and the quadrupoles that squeeze it. The mathematics is another particle oscillating about a reference, this time in the transverse directions, and the tool is the transfer matrix. Chapter 21 then puts the two together in order to collide.

## Further reading

- The LHC Design Report, Volume I, for the machine's parameters including the RF system (:cite[lhc-design]); the shorter review by Evans and Bryant covers the same ground (:cite[evans2008]).
- McMillan's 1945 paper is short and readable (:cite[mcmillan1945]).
- For the history of the machines, see Bryant's brief history of accelerators (:cite[bryant1994]) and, for CERN's, the article on the Proton Synchrotron's sixtieth anniversary (:cite[cern-ps-60]).
