---
number: 7
title: Semiconductors, diodes and LEDs
summary: Pure silicon hardly conducts, one dopant atom in a few million changes that, and joining two kinds makes a one-way valve for current that can also give light — and cannot, however many you chain, restore a fading signal.
duration: About 1 hour
prerequisites: [shannons-switches]
---

Relays computed, but they clicked. Every operation moved an armature, and an armature takes about 5 ms to arrive and wears out. To go faster, the switch has to lose its moving parts, and the only place to find such a switch is inside a crystal.

The crystal is silicon, and at first sight it is a poor choice. A cube of pure silicon conducts about 100,000,000,000 times worse than the same cube of copper. But add one atom of the right impurity for every few million silicon atoms, and it conducts half a million times better. Put two differently poisoned pieces side by side and you get something that has no counterpart among the switches of Chapter 6: a valve that lets current through one way and refuses it the other, with nothing moving inside it. If the crystal is made of the right material, that valve also glows.

Before the explanation, the behaviour. Two lamps hang from one battery. In front of each lamp is a **:term[diode]{id=diode}**, a two-legged part drawn as a triangle against a bar. One faces the way the current wants to go; the other faces the opposite way.

```quiz
q: 'A 6 V battery, a diode and a lamp in series. Turned one way round, the diode’s arrow points the way the current flows (from + through the lamp to −); turned the other way, it points against it. What does the lamp do in the two cases?'
options:
  - text: It is lit in both cases; the diode only makes it a little dimmer.
    why: 'A diode is not a resistor. Turned the wrong way round it does not merely restrict the current, it stops it.'
  - text: It is lit when the arrow points with the current, and dark when it points against it.
    correct: true
    why: 'Current flows in the direction the arrow points, from the anode (the flat side of the triangle) to the cathode (the bar), and not the other way.'
  - text: It is dark in both cases, because a diode has no way to pass a steady current.
    why: 'It passes a steady current perfectly well, in one direction.'
```

::circuit{src="07-diodes-and-leds/circuits/diode-lamp.json" title="One way only" n="7.1" current=true caption="Both branches hang from the same 6 V battery. On the left the diode points down, the way the current flows, and the lamp lights; the voltmeter across the diode reads about 0.8 V. On the right the diode points up, against the flow: the lamp is dark, the diode carries no current you could see, and the voltmeter across it reads the whole 6 V."}

Three numbers in that figure are worth keeping. A diode that conducts is not a wire: about **0.7 V** stays across it (0.8 V here, because the lamp takes 50 mA). A diode that blocks is not a gap: it holds off the whole battery voltage. And the terminals have names: current enters the **anode** (the triangle’s flat side) and leaves at the **cathode** (the bar; on a real diode, the stripe).

## Older than the theory

Diodes were in use for decades before anyone could say why they worked.

:::history{year=1874 title="A crystal that only conducts one way" people="Ferdinand Braun" source="Sources: Braun (1875); Computer History Museum, The Silicon Engine."}
In 1874 the 24-year-old Ferdinand Braun found that current through a metal-sulphide crystal, touched with a metal point, depended on which way it flowed.

Braun tried natural crystals such as galena (lead sulphide) and pyrite, and reported that their resistance depended on the direction and the size of the current, by as much as 30 %.:cite[braun1875] The paper was submitted to *Annalen der Physik und Chemie* on 23 November 1874. It was a curiosity for a quarter of a century, until radio needed something to turn the oscillations of an antenna into a current a headphone could use, and a crystal with a thin wire (the “cat’s whisker”) pressed on it was the cheapest detector available.:cite[chm-braun-rectifier] Nobody could explain it: the theory of electrons in crystals came only in the 1930s.:cite[riordan1997]
:::

:::history{year=1904 title="A light bulb that acts as a valve" people="John Ambrose Fleming" source="Sources: IEEE Milestone, Fleming Valve; British patent 24,850 (1904)."}
On 16 November 1904 John Ambrose Fleming applied for a British patent for “Improvements in instruments for detecting and measuring alternating electric currents”: a glass bulb with a hot filament and a metal plate.

Edison had noticed in the 1880s that current could cross the vacuum from a hot filament to a cold plate, and only in that direction. Fleming, a professor at University College London and a consultant to the Marconi company, turned the effect into a detector for radio signals, and called it a valve because it let current through one way only.:cite[fleming-patent] It behaves like Braun’s crystal by a completely different mechanism, and it was the ancestor of every vacuum tube.:cite[fleming-milestone] Two years later Lee de Forest would add a third electrode to it (Chapter 8).
:::

## Between a conductor and an insulator

Why does a crystal behave like this? It starts with the electrons.

In an isolated atom an electron can have only certain energies. In a crystal, where 5 × 10²² atoms per cubic centimetre sit within a fraction of a nanometre of each other, those allowed energies smear into broad :term[bands]{id=energy-band} with forbidden stretches between them. Two bands matter. The lower, the **valence band**, is full: its electrons are the ones that make the bonds between neighbouring atoms, and a full band cannot carry current, because there is nowhere for an electron to move to. The upper, the **conduction band**, is empty. An electron there is free: it can roam the crystal, and push it and it moves.

Between the two lies the :term[bandgap]{id=bandgap}, an energy that an electron must be given before it can conduct. In words: **an electron needs a minimum energy to become a carrier of current.** The size of the gap sorts materials:

| Material | Bandgap | What it does |
|---|---|---|
| Copper (and every metal) | none: the bands overlap | about 10²³ free electrons per cm³, always |
| Germanium | 0.66 eV | a :term[semiconductor]{id=semiconductor} |
| **Silicon** | **1.12 eV** | a semiconductor |
| Gallium arsenide | 1.42 eV | a semiconductor |
| Diamond | 5.5 eV | an insulator |
| Glass (silicon dioxide) | about 9 eV | an insulator |

The electron-volt (eV) is the energy of one electron across one volt, so 1.12 eV is the energy an electron gains falling through 1.12 V. Compare it with the heat in the room. The scale of thermal energy at 300 K is *kT*, only 0.026 eV. A gap of 1.12 eV is 43 times that; a few electrons in a trillion get lifted across it by a chance collision, and that fraction is all that pure silicon has. In pure silicon at room temperature there are about 10¹⁰ free electrons per cubic centimetre against 5 × 10²² atoms: one free electron for every five trillion atoms.:cite[sze2007] The nearly empty conduction band is why silicon is a poor conductor. The gap being *small*, unlike diamond’s, is why it is not a hopeless one. Light lifts electrons across it too: any photon above 1.12 eV (a wavelength under 1,100 nm) does, which is how a solar cell works.

Every time an electron leaves a bond it leaves a bond with an electron missing, called a :term[hole]{id=hole}. A neighbouring electron can step into the hole, and then the hole is where that electron was, so holes move, like positive charges. Think of a row of parked cars with one space in it: when a car moves up into the space, the space moves back.

```quiz
q: 'You heat a copper wire and a silicon crystal from 20 °C to 60 °C. What happens to their resistance?'
options:
  - text: 'Both go up: heat makes atoms vibrate more and get in the way of the electrons.'
    why: 'That is true of the copper, where the number of free electrons does not change. In silicon something more important happens.'
  - text: 'Copper’s goes up, silicon’s goes down.'
    correct: true
    why: 'In copper the carriers are already all there, and the extra vibration only scatters them. In silicon heat lifts more electrons across the gap, and the number of carriers grows exponentially, which outweighs the scattering. Semiconductors conduct better when they are warm. That is also why a diode or a transistor can run away with itself if its heat is not removed.'
  - text: 'Both go down, because the atoms move apart.'
    why: 'Thermal expansion is far too small an effect to matter here.'
```

## Doping: one atom in a few million

Pure silicon is no use for switches, but silicon that is impure *on purpose* is. Each silicon atom has four outer electrons, all used in bonds to four neighbours. Replace one atom in the lattice with **phosphorus**, which has five. Four of its electrons make bonds like the atom’s it replaced; the fifth has nowhere to go. It is held so loosely, by only 0.045 eV, less than twice the thermal energy at room temperature, that it wanders off into the conduction band at once. The phosphorus atom becomes a fixed positive ion in the lattice and donates a free electron. The result is **n-type** silicon (n for the negative carriers).

Now replace one atom with **boron**, which has three outer electrons. There is one bond too few, and a neighbouring electron falls into it, leaving a hole that wanders off. The boron becomes a fixed negative ion, and it accepts an electron: **p-type** silicon (p for the positive carriers).

Both kinds are electrically neutral, as a whole. An n-type crystal is full of electrons, and also full of the positive ions they came from. What has changed is what can *move*.

How many atoms does it take? Far fewer than you might expect. A :term[doping]{id=doping} of 10¹⁶ atoms per cm³ is one dopant atom for every five million silicon atoms. It puts 10¹⁶ free electrons in every cubic centimetre, a million times more than the thermal 10¹⁰, and the resistivity falls from about 230,000 Ω·cm to about 0.5 Ω·cm.:cite[sze2007] The crystal has to be extraordinarily pure to begin with, or the impurities you did not choose would swamp the ones you did.

```quiz
q: 'One phosphorus atom for every five million silicon atoms. By roughly what factor does that improve the conductivity of the silicon?'
options:
  - text: About twice.
    why: 'One atom in five million is a tiny change in the *material*, but not a tiny change in the number of free carriers, which is what conduction depends on.'
  - text: About a thousand times.
    why: 'Closer, but the pure crystal has only 10¹⁰ free electrons per cm³ to start with. The doping adds 10¹⁶.'
  - text: About half a million times.
    correct: true
    why: 'Every phosphorus atom donates an electron, so the doping adds 10¹⁶ per cm³ to the 10¹⁰ that pure silicon has: a million times as many carriers. The conductivity also depends on how far each moves, which goes down a little with more impurities, so the gain is a little under a million. It is the reason why one atom in five million is a big deal.'
```

## The pn junction

Grow a crystal that is p-type on the left and n-type on the right, with a sharp boundary in between. This is a :term[pn junction]{id=pn-junction}, and everything interesting happens in a strip a few tenths of a micrometre wide around that boundary.

Left alone, the junction settles in a fraction of a nanosecond:

1. **Diffusion.** The n side is crowded with free electrons, the p side has almost none. Like gas expanding into an empty room, the electrons spread across the boundary into the p side. Holes spread the other way.
2. **:term[Recombination]{id=recombination}.** An electron that crosses meets a hole, and they cancel: the electron drops into the bond and both cease to be carriers. Near the boundary, therefore, the carriers *disappear*.
3. **Exposed ions.** What is left in that strip is what could not move: fixed positive phosphorus ions on the n side, fixed negative boron ions on the p side. No carriers hide their charge any more. The strip is the :term[depletion region]{id=depletion-region}, so called because it has been emptied of carriers.
4. **A field appears.** Positive ions on one side and negative on the other make an electric field pointing from n to p. It pushes electrons back towards n and holes back towards p, opposing the diffusion.

The exchange stops when the pushing back balances the spreading. What remains is a **built-in voltage** across the depletion region, and its size is fixed by the doping:

:::equation{#vbi caption="The built-in voltage of a pn junction depends on the doping of each side, and only logarithmically."}
$$\term{vbi}{V_{bi}} = \term{vt}{V_T}\,\ln\frac{\term{na}{N_A}\,\term{nd}{N_D}}{\term{ni}{n_i}^2}$$

```terms
vbi:
  label: 'V_bi, the built-in voltage'
  what: 'The potential step across the depletion region at equilibrium, in volts. It is what a carrier has to climb to cross the junction.'
  why: 'It is exactly the voltage at which the pull of the field on the carriers balances the tendency of the crowd to spread out.'
  effect: 'About 0.7 V for silicon with 10¹⁶ dopants per cm³ on each side. It grows by only 60 mV for each factor of 10 in the doping of one side, so it is always less than the bandgap.'
vt:
  label: 'V_T = kT/q, the thermal voltage'
  what: 'The voltage that corresponds to the thermal energy of the crystal, 25.85 mV at 300 K.'
  why: 'Thermal jostling decides how many carriers have enough energy to climb a barrier, and this is its scale in volts.'
  effect: 'Warmer crystal, bigger V_T. It reappears in the diode equation below.'
na:
  label: 'N_A, acceptors'
  what: 'The density of boron atoms on the p side, per cm³.'
  why: 'Each acceptor gives one hole, and so sets the number of carriers that can spread.'
  effect: 'More doping means a larger step, though slowly, because the dependence is a logarithm.'
nd:
  label: 'N_D, donors'
  what: 'The density of phosphorus atoms on the n side, per cm³.'
  why: 'The same on the other side.'
  effect: 'Symmetrical with N_A.'
ni:
  label: 'n_i, the intrinsic density'
  what: 'The number of free electrons per cm³ in undoped silicon at 300 K, about 10¹⁰.'
  why: 'It is the minority-carrier density once you multiply by the doping: n × p = n_i² on each side.'
  effect: 'Anything that raises n_i (a higher temperature, a smaller bandgap) lowers the built-in voltage.'
```
:::

With 10¹⁶ per cm³ on each side, *V*<sub>bi</sub> = 0.02585 V × ln(10³² ÷ 10²⁰) = **0.71 V**, across a depletion region only 0.43 µm wide. That is a peak field of about 33,000 V per centimetre, from a voltage smaller than a pencil battery’s. The width follows from the geometry of the ions: the depletion region is as wide as it takes for their charge to make that voltage, so it is narrower with heavier doping (there are more ions per micrometre) and it grows as the square root of the total voltage across it.

You cannot measure *V*<sub>bi</sub> with a voltmeter across a diode: the metal contacts have voltage steps of their own that cancel it exactly, as they must, or an unconnected diode would be a battery that never ran out. The junction is a barrier, not a power supply.

Now for the part that makes it a diode: what happens when you *push* on it. The figure below is the flagship of this chapter. On the left is the p side, with holes as open circles; on the right the n side, with electrons as filled dots. In between is the depletion region, with its exposed ions, the field *E* and, under the picture, the barrier that a carrier has to climb. Below is the current the junction would carry. Before you slide anything, decide what you expect.

```quiz
q: 'You connect the p side of a junction to the − of a battery and the n side to the +, so that the applied voltage is negative (reverse bias). What happens to the depletion region?'
options:
  - text: It narrows, because the battery pushes carriers towards the junction.
    why: 'That is what happens the other way round. Here the battery’s + is on the n side and it attracts the electrons there away from the junction.'
  - text: It widens, because the battery pulls carriers away from the junction and uncovers more ions.
    correct: true
    why: 'The + on the n side pulls the free electrons away from the boundary, and the − on the p side does the same to the holes. More fixed ions are left exposed, so the region is wider and the barrier is higher (the built-in voltage plus the applied one), and nothing can cross it.'
  - text: 'It stays the same, because the built-in voltage is fixed by the doping.'
    why: 'The built-in voltage is fixed, but it is the *total* voltage across the region that sets its width, and that is the built-in voltage plus whatever the battery adds.'
```

::pn-junction{n="7.2" caption="Slide the applied voltage from −5 V up to +1 V (or drag on the I–V plot). The dot on the plot is the operating point. Try the Log button: the forward part of the curve becomes a straight line, which is what an exponential looks like. Then slide the doping. The animation is drawn less steeply than reality, but the plot, and the numbers next to it, are exact."}

:::lab[Turn the valve]
Use Figure 7.2 with the doping at 1×10¹⁶.

1. **No bias.** Carriers jiggle and hit the edge of the depletion region, and almost none get across. The current is exactly zero: whatever crosses one way is balanced by what crosses the other.
2. **:term[Reverse]{id=reverse-bias}.** Slide to −5 V. The region widens from 0.43 µm to 1.2 µm and the barrier grows to 5.7 eV. The only things that cross are the occasional pairs created by heat inside the region, swept over at once by the field. The current is about 14 pA, some 300 million times smaller than the few milliamps the same junction passes at +0.7 V.
3. **:term[Forward]{id=forward-bias}.** Slide up from 0 V. Below about 0.4 V hardly anything happens. Then the barrier gets low enough for many carriers to cross, and each becomes a *minority* carrier on the other side, lives for a moment and recombines, with a flash. Meanwhile the wires deliver new carriers from the contacts. That flow is the current. Note the current at 0.5 V, 0.6 V and 0.7 V.
4. **Doping.** Slide it up to 1×10¹⁸: the region gets thinner, the built-in voltage rises to 0.95 V and the knee of the curve moves right. With light doping the knee moves left.
:::

### The diode equation

The curve you have just plotted is described extremely well by one formula, due to William Shockley:

:::equation{#shockley caption="The current through a junction grows exponentially with the forward voltage."}
$$\term{i}{I} = \term{is}{I_S}\left(e^{V/V_T} - 1\right)$$

```terms
i:
  label: 'I, the current'
  what: 'The current through the diode from anode to cathode, in amperes.'
  why: 'It is the number of carriers per second that get over the barrier, and that number depends exponentially on the barrier height, which the voltage *V* lowers.'
  effect: 'At 0.6 V about 0.1 mA, at 0.7 V a few milliamps, at 0.8 V hundreds, until the resistance of the silicon and the wires takes over.'
is:
  label: 'I_S, the saturation current'
  what: 'A constant of the diode, about 10⁻¹⁴ A for a small silicon junction. It is minus the current for large reverse voltage: the leakage.'
  why: 'It is set by how many minority carriers there are near the junction, and that goes down as doping goes up.'
  effect: 'A diode with a smaller I_S needs a higher voltage for the same current: heavier doping moves the curve right.'
```
:::

Read it in two halves. With a reverse voltage, *V* is negative and the exponential vanishes, leaving *I* = −*I*<sub>S</sub>: a tiny constant current in the wrong direction. With a forward voltage, the exponential dominates and the “−1” does not matter. Each increase of *V* by *V*<sub>T</sub> ln 10 = **59.5 mV, about 60 mV**, multiplies the current by ten:

| Forward voltage | Current (10⁻¹⁴ A saturation current) |
|---|---|
| 0.5 V | about 2 µA |
| 0.56 V | about 20 µA |
| 0.6 V | about 0.1 mA |
| 0.66 V | about 1 mA |
| 0.7 V | about 5 mA |

The exponential is so steep that the answer to “what voltage is across a conducting silicon diode?” is nearly the same whatever the current: for every factor of ten it moves by only 60 mV. That is why textbooks say a diode “drops 0.7 V”. It is not a threshold; nothing switches at 0.7 V. It is the voltage at which the milliamps that we design circuits for happen to lie, and it is a fairly good rule of thumb: 0.6–0.7 V for a small silicon diode at a few milliamps. (It also falls by about 2 mV for every degree Celsius, so a diode is a fair thermometer.)

```quiz
q: 'A silicon diode carries 1 mA at 0.66 V. You raise the voltage across it by 120 mV, to 0.78 V (ignoring its series resistance). Roughly what does the current become?'
options:
  - text: About 1.2 mA, 20 % more.
    why: 'That would be the case for a resistor. A diode’s current is exponential in the voltage.'
  - text: About 2 mA, double.
    why: 'Each 60 mV multiplies the current by ten, not two.'
  - text: About 100 mA, a hundred times more.
    correct: true
    why: '120 mV is two steps of 60 mV, and each multiplies the current by ten. In practice the resistance of the silicon and of the wires will hold it below that, but the point stands: a small rise in voltage makes a very large rise in current.'
```

:::history{year=1940 title="The cracked silicon rod" people="Russell Ohl" source="Sources: Riordan and Hoddeson (1997); Computer History Museum, The Silicon Engine; US Patent 2,402,662."}
On 23 February 1940 Russell Ohl, at Bell Labs, shone a lamp on a cracked silicon rod, and a meter jumped: the rod was making electricity.

Ohl’s rod, cut from an ingot of the purest silicon he could get, had a crack across it, and when a bright light fell on it the current between the two sides of the crack jumped. He and the metallurgist Jack Scaff found that the crack marked the boundary between two regions of the ingot. As it cooled from the melt, its impurities had separated, so that one end had an excess of electrons and the other a deficit (Scaff and his colleague Henry Theuerer named them n and p). The boundary between them was the first pn junction, and it was a solar cell as well as a diode: the light lifted electrons across the gap in the depletion region, and the built-in field swept them apart.:cite[riordan1997]:cite[chm-ohl] Ohl’s patent, “Light-sensitive electric device”, was filed on 27 May 1941 and granted on 25 June 1946.:cite[ohl-patent] The junction was the key that Shockley used in 1948 to conceive the junction transistor, in Chapter 8.
:::

:::programmer[A function with no guard clause]
The diode equation is a function `current(voltage)` whose output grows tenfold for every 60 mV of input, with no upper bound in it: feed it 0.6 V and you get 0.1 mA, feed it 0.9 V and (ignoring the series resistance) you get about 8 A. A diode does not decide how much current to carry; it takes whatever the rest of the circuit allows, until it melts. It needs a guard from outside, like an unbounded loop needs a timeout, and the resistor in every LED circuit of this chapter is that guard.
:::

## Light from a junction

Recombination is where the energy of the junction goes. An electron in the conduction band that falls into a hole drops across the bandgap, and the energy it had over the gap has to go somewhere. In silicon it goes into vibrations of the lattice (heat). In some other semiconductors, the ones with a *direct* gap, it comes out as a **photon** of energy about equal to the bandgap. That junction is a :term[light-emitting diode]{id=led}, and the semiconductor decides the colour.

The rule is the one from the bandgap section: a photon of energy *E* has wavelength

$$\lambda = \frac{hc}{E} \approx \frac{1240\ \text{eV·nm}}{E}$$

so a bandgap of 1.9 eV emits at 1240 ÷ 1.9 ≈ 650 nm, which is red. Silicon, at 1.12 eV, would emit at 1,100 nm, in the infrared. But it does not emit at all, because its gap is *indirect*: an electron and a hole in silicon cannot recombine without help from a lattice vibration, which is rare, so nearly all of them give up their energy as heat. LEDs come from other crystals: compounds of the elements on either side of silicon in the periodic table.

::led-colour{n="7.3" caption="Slide the bandgap of the semiconductor (or press one of the real materials). The wavelength is 1240 ÷ the energy; the swatch is the colour your eye would see; the small circuit is a real LED of the nearest colour in the simulator, with its forward voltage and current on the meters. Below 1.65 eV the light is infrared and invisible."}

| Material | Gap | Light | Typical forward voltage |
|---|---|---|---|
| GaAs, gallium arsenide | 1.42 eV | infrared, ~870 nm | 1.2–1.4 V |
| GaAsP, gallium arsenide phosphide | ≈ 1.9 eV | red, ~650 nm | 1.8–2.1 V |
| GaP:N, nitrogen-doped gallium phosphide | ≈ 2.2 eV | green, ~565 nm | 2.0–2.2 V |
| InGaN, indium gallium nitride | 2.5–2.9 eV | blue and blue-green | 2.9–3.4 V |

The forward voltage is close to the gap in electron-volts, because getting carriers across the junction costs about that much energy per electron; the exact value varies from part to part. Blue LEDs need more than 3 V, and cannot be run from two AA cells.

:::history{year=1907 title="A crystal that glows" people="H. J. Round" source="Source: Round (1907)."}
In a letter of 9 February 1907, the Marconi engineer H. J. Round reported that a crystal of carborundum glowed yellow when a current passed through it.

Round was testing silicon-carbide crystals as radio detectors, and wrote in *Electrical World* that on applying 10 volts between two points on a crystal “the crystal gave out a yellowish light”.:cite[round1907] It was the first report of light from a solid-state diode. Nothing came of it. The light was faint, the efficiency tiny and no one could explain why it happened; the explanation, recombination across a gap, needed the theory of the 1930s and the junction of 1940.
:::

:::history{year=1962 title="The first visible LED" people="Nick Holonyak Jr." source="Sources: Holonyak and Bevacqua (1962); Physics Today (2022)."}
In the autumn of 1962 Nick Holonyak, at General Electric’s laboratory near Syracuse, made a diode from gallium arsenide phosphide that gave off red light.

Earlier infrared LEDs and lasers had been made of pure gallium arsenide. Holonyak had the idea of mixing in phosphorus, which widens the gap and so moves the emission into the visible: “bandgap engineering” before the name existed. His GaAsP junction, described in *Applied Physics Letters* in December 1962, was a laser (at 77 K, emitting about 710 nm), and the same device at room temperature was a red LED.:cite[holonyak1962]:cite[physicstoday-holonyak] Through the 1960s LEDs were expensive red indicator lamps; then GaP:N gave green and yellow, and in the 1970s they filled the displays of calculators and watches.
:::

:::history{year=1993 title="Blue, at last" people="Isamu Akasaki, Hiroshi Amano, Shuji Nakamura" source="Sources: Amano et al. (1989); Nakamura et al. (1992, 1994); Nobel Prize in Physics 2014, press release."}
Red and green LEDs had existed since the 1960s and 70s. Blue took another thirty years, and won the 2014 Nobel Prize in Physics.

The material was gallium nitride, whose gap is large enough for blue, but it was very hard to grow as a good crystal, and no one could make it p-type. Akasaki and his student Amano, at Nagoya, grew good GaN on sapphire and, in 1989, made it p-type with magnesium and an electron beam: the first GaN pn-junction LED.:cite[amano1989] Nakamura, at the small company Nichia, found in 1992 that simply heating the magnesium-doped GaN in nitrogen did the same, and by 1993–94 had an efficient blue LED of indium gallium nitride, more than a hundred times brighter than what existed.:cite[nakamura1992]:cite[nakamura1994] Blue made white LED lighting possible (a blue LED under a yellow phosphor), and the Nobel citation was “for the invention of efficient blue light-emitting diodes which has enabled bright and energy-saving white light sources”.:cite[nobel2014]
:::

## Why an LED needs a resistor

Everything in the diode equation says that an LED is a terrible thing to connect straight to a battery. Its voltage, at any interesting current, is nearly fixed: a red LED sits between about 1.7 V and 1.9 V from a fraction of a milliamp to a few tens. Put the ideal equation of a red LED into numbers, and each tenth of a volt matters:

| Voltage across the LED | Current |
|---|---|
| 1.70 V | 0.8 mA (dim) |
| 1.85 V | 15 mA (bright) |
| 2.00 V | 270 mA |
| 2.20 V | 13 A |

(In a real LED the resistance of the crystal takes over above a few hundred milliamps, but the current is still far too large.) Nothing supplies a voltage to a tenth of a volt, and the LED’s own voltage drifts with temperature, so we do not choose the voltage: we choose the current, with a resistor in series. The resistor takes up whatever the LED does not, and Ohm’s law sets the current. With a 9 V battery and a target of 15 mA,

$$R = \frac{V_{supply} - V_{LED}}{I} = \frac{9 - 1.85}{0.015} = 477\ \Omega \approx 470\ \Omega.$$

If the LED’s voltage is off by 0.1 V, the current changes by only 0.1 ÷ 470 = 0.2 mA: the resistor, unlike the LED, is *forgiving*.

```quiz
q: 'In the next figure, a 9 V battery drives a red LED through a 470 Ω resistor, and a switch can short out the resistor. What happens when you close the switch?'
options:
  - text: 'Nothing much: the LED gets a little brighter.'
    why: 'Remember the table: 0.15 V more across the LED means a hundred times the current, not a little more.'
  - text: 'The LED gets a great deal too much current, and burns out in a fraction of a second.'
    correct: true
    why: 'Without the resistor nothing stands between 9 V and a crystal that will pass whatever current it is given. The simulator’s LED is rated for 30 mA and is asked for amperes, so it fails within a few milliseconds.'
  - text: 'The LED goes out, because the current now takes the easy path through the switch.'
    why: 'The switch is in parallel with the *resistor*, not with the LED. The current still has to go through the LED to get home.'
```

::circuit{src="07-diodes-and-leds/circuits/led-resistor.json" title="An LED needs a resistor" n="7.4" current=true caption="With the switch open, the ammeter reads about 15 mA and the voltmeter about 1.85 V: the resistor drops the other 7.15 V. Close the switch, which takes the resistor out of the circuit, and see what happens (Reset in the frame’s corner brings the LED back)."}

That is the “magic smoke” of Chapter 2 in its commonest form. With a real LED it is usually a flash, and a dead LED.

::led-curve-lab{n="7.5" caption="The pot in series with a 220 Ω resistor limits the current of a red LED. Turn it slowly and note the LED voltage and the current at ten or more settings, from 0 kΩ (the most current) to 100 kΩ (the least)."}

:::lab[Plot a red LED’s curve]
Use Figure 7.5 (the real version of this lab is at the end of the chapter). The potentiometer is wired as a *variable resistor* in series with the 220 Ω resistor and the LED, so it sets the current, and you read the voltage that the LED needs to carry it.

1. At 0 kΩ the current is 14 mA and the LED voltage 1.88 V.
2. At 2 kΩ (about 2 % of the travel) it is about 1.5 mA and 1.73 V; at 20 kΩ about 0.17 mA and 1.62 V; at 100 kΩ about 35 µA and 1.54 V.
3. Plot voltage against the *logarithm* of the current. Over the whole range, a factor of 400 in current, the voltage moves by only about 0.34 V, or about **0.13 V for every factor of ten**. It is a straight line on those axes: an exponential, as the diode equation says. (The slope is twice that of a silicon diode’s 60 mV, because the “ideality factor” *n* in the equation is about 2 for this LED, which is normal for LEDs.)
4. Change the current from 14 mA to 15 mA, 7 % more, and the LED voltage moves by only 4 mV. The LED “does not care” how much current there is, so the resistor has to.
:::

## Diode logic

A diode is a switch with no coil. It is worked by the voltage across it, and the voltage can come from another gate’s output. So can diodes compute? Yes, a little. Chapter 6 built AND from switches in series and OR from switches in parallel. Here are the same functions built from :term[diodes and a resistor]{id=diode-logic}, with the input switches replaced by the outputs of other circuits (the logic switches A and B are 0 V or 5 V).

In an :term[AND]{id=and} gate the two diodes point at the inputs and share a resistor to the supply. If *both* inputs are high, no current flows in either diode, and the resistor pulls the output up to 5 V. If *either* input is low, its diode conducts, and the output is held one diode drop above it.

::circuit{src="07-diodes-and-leds/circuits/diode-and.json" title="A diode AND gate" n="7.6" caption="Click the switches A and B. The output Y is 5 V only when both are high. If either is low, that input pulls Y down through its diode, to 0.5 V: a diode drop above 0 V, not 0 V."}

In an :term[OR]{id=or} gate the diodes point the other way, into a shared resistor to ground. If either input is high, its diode conducts and carries the output up to a diode drop below it. Only if both are low does the resistor pull the output to 0 V.

::circuit{src="07-diodes-and-leds/circuits/diode-or.json" title="A diode OR gate" n="7.7" caption="Click the switches. Y follows the higher input, minus a diode drop: 4.45 V, not 5 V, when it is high."}

The truth tables are right: AND gives 1 only for 1 and 1, OR gives 0 only for 0 and 0. But look at the voltages. The AND gate’s low is 0.5 V, and the OR gate’s high is 4.45 V. Every input has lost about half a volt on its way through. One gate would not matter. What about several?

```quiz
q: 'Four diode OR gates in a row: the output of each is the input of the next, the first gets 5 V, and the other input of each gate is at 0 V. Each gate loses a diode drop of about 0.65 V. What does a receiver see at the end?'
options:
  - text: '5 V: the gates just pass the signal on.'
    why: 'Each gate’s output is a diode drop below its input; nothing puts the drop back.'
  - text: 'About 2.4 V: four diode drops off 5 V, and a 5 V logic gate would call that neither a 0 nor a 1.'
    correct: true
    why: 'The losses add: 5 V − 4 × 0.65 V ≈ 2.4 V. With a 74HC input, which needs 3.5 V to see a 1, the signal is gone after only two gates.'
  - text: '0 V: every diode blocks in the end.'
    why: 'The diodes keep conducting as long as their anode is more than about 0.5 V above their cathode. The level sinks, but not to zero at once.'
```

::circuit{src="07-diodes-and-leds/circuits/diode-chain.json" title="Four diode gates in a row" n="7.8" caption="Each stage is a diode OR gate whose other input is low (so its second diode, which would never conduct, is left out). The voltmeters read 4.29, 3.60, 2.94 and 2.32 V: about 0.65 V lost at each stage. Click the input to make it 0 V, and the whole chain reads zero."}

The loss is not a flaw that a better diode could repair. It is built into what a diode gate *is*:

- **No gain.** The output of a diode gate is powered by its own inputs. Nothing in the circuit adds energy, so the output can never be bigger than the input. A chain of them, like a long telegraph line, can only make a signal weaker. (Compare the relay chain of Chapter 6, where every stage was powered from its own battery.)
- **No NOT.** A diode conducts *more* when the voltage across it rises. Raise any input of a diode gate, and the output can only go up or stay the same, never down, so no diode circuit can make an output fall when an input rises. It is the same limitation as switches without relays: the function is *monotonic*. Without NOT the set is not complete: AND and OR alone can only build monotonic functions, and you cannot even get XOR, let alone an adder.
- **A drifting level.** Each stage shifts the level by a diode drop. Mix AND and OR gates and the highs sink and the lows rise until they meet.

So diode gates cannot be cascaded indefinitely. Engineers did use them (in the 1950s computers, and today in diode-matrix ROMs, where one level of gates is all that is needed), but only with something every one or two stages that restores the level and inverts. The relay of Chapter 6 was that something, and it was too slow. The something in Chapter 8 is a transistor.

:::hood[Newton–Raphson, and why the engine limits junction voltages]
A resistor is easy for a simulator: I = V/R is linear, and Chapter 2 showed how to solve a circuit of them as a system of linear equations. A diode is not linear. To find the voltage across a diode fed through 1 kΩ from 5 V, the engine has to solve

*V* + 1000 × *I*<sub>S</sub>(e<sup>*V*/*nV*<sub>T</sub></sup> − 1) = 5.

**Newton–Raphson** does it by repeated linearisation. At a guess *V*<sub>k</sub> it replaces the diode by its tangent line, a conductance *g* = d*I*/d*V* in parallel with a constant current source (the *companion model* of Chapter 4, applied to a diode instead of a capacitor), solves the resulting linear circuit exactly, and takes the answer as the next guess. Here is the diode’s stamp, from `semiconductors.ts` in the engine’s `analog/models` folder:

```ts
const nvt = dp.n * VT;
vd = pnjlim(c, volt(c.x, m) - volt(c.x, k), vd, nvt, vcrit(nvt, dp.is));
const g = GMIN + c.gmin;
const id = dp.is * (safeExp(vd / nvt) - 1) + g * vd;
const gd = (dp.is * safeExpD(vd / nvt)) / nvt + g;
conductance(c, m, k, gd);
currentSource(c, m, k, id - gd * vd);
```

Newton works beautifully near the answer, but the exponential is a cruel curve. Start from *V* = 0, where the tangent is nearly flat (*g* is only 5 × 10<sup>−8</sup> S): the linear circuit says almost no current flows, so almost the whole 5 V is across the diode, and the next guess is *V* = 5.0 V. There the diode would carry about 10<sup>39</sup> A and the tangent is near-vertical, so the next guess, 3.57 V, is still absurd, and from then on each iteration lowers the guess by only *nV*<sub>T</sub> = 45 mV. In this chapter’s test the plain method needs **about 70 iterations** to walk down from 5 V to 0.65 V, and with several junctions it can overshoot into numbers that overflow.

SPICE’s remedy, which the engine copies, is **junction voltage limiting**:

```ts
export function pnjlim(c: StampContext, vnew: number, vold: number, nvt: number, vcr: number): number {
  if (vnew > vcr && Math.abs(vnew - vold) > 2 * nvt) {
    let v: number;
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / nvt;
      v = arg > 0 ? vold + nvt * Math.log(arg) : vcr;
    } else {
      v = nvt * Math.log(vnew / nvt);
    }
    c.limited = true;
    return v;
  }
  return vnew;
}
```

Above the *critical voltage* `vcrit` (0.74 V for this diode), where the curve starts to bend hard, a proposed step of more than 2*nV*<sub>T</sub> is replaced by a logarithmic one, so the guess can never run away up the exponential. The first guess becomes 0.21 V instead of 5 V. It also sets `c.limited = true`, which tells the engine that this iterate is not the answer yet and must not be accepted, however small the change looks. In the test, the limited iteration reaches 0.650 V in **11 steps**: 0.21, 0.21, 0.42, 0.40, 0.62, 0.66, 0.652, 0.650, … `safeExp` is the second guard: beyond *x* = 80 it continues the exponential as a straight line, so that a wild iterate cannot overflow a 64-bit number. The transistor models of Chapter 8 use the same `pnjlim` on each of their junctions.

If Newton still fails after 40 iterations, the engine cuts the time step by eight and tries again, then falls back on *gmin stepping* (a large conductance from every node to ground, removed in stages); if all fails it accepts the last iterate and warns “The simulation did not converge”.:cite[nagel1975]
:::

:::real{parts="red LED, 220 Ω resistor, 100 kΩ potentiometer (linear), 5 V USB supply module, breadboard, multimeter, jumper wires"}
Plot the curve of Figure 7.5 on a breadboard. Wire, in series from +5 V: the 100 kΩ potentiometer as a variable resistor (use the middle pin and one end pin, and join the unused end pin to the middle pin, which is the standard way to make a rheostat), the 220 Ω resistor, and the red LED, its longer leg (the anode) on the resistor side, with its cathode to ground.

Set the meter to DC volts and put it across the LED. Start with the potentiometer at its low-resistance end and read the LED voltage (about 1.8–1.9 V for a red LED) and then the voltage across the 220 Ω resistor; the current is that voltage divided by 220 Ω, about 14 mA at the start. Turn the knob in about ten steps towards the high end, recording the pair each time. Near 100 kΩ the current is tens of microamps, a faint glow in a darkened room. Plot the LED voltage against the current on semi-log paper, or in a spreadsheet: a straight line, with a slope of 0.1–0.15 V per factor of 10. Try a green or a blue LED, and see the curve shift up.

Never connect an LED to a supply without a resistor, even for a moment.
:::

## Exercises

```quiz
q: 'You want a green LED (about 2.1 V) to take 10 mA from a 5 V supply. Which standard resistor is closest?'
options:
  - text: 220 Ω
    why: '(5 − 2.1) ÷ 220 = 13 mA. It would work, but it is not the closest to 10 mA.'
  - text: 270 Ω
    correct: true
    why: 'R = (5 − 2.1) ÷ 0.01 = 290 Ω. The nearest values in the standard E12 series are 270 Ω and 330 Ω, and 270 Ω is closer: it gives 10.7 mA, where 330 Ω gives 8.8 mA. Either is safe.'
  - text: 2.1 kΩ
    why: 'That would give 5 ÷ 2100 = 2.4 mA, a dim LED. It comes from dividing the supply by the LED’s voltage, and forgetting that the resistor drops only the *difference*.'
```

```quiz
q: 'You have only a 3.3 V supply. Which LED is likely to be harder to drive with a single resistor, at a steady 10 mA?'
options:
  - text: 'A red LED (1.9 V): the resistor drops 1.4 V, so R = 140 Ω.'
    why: 'That works well: 1.4 V across the resistor leaves plenty of room for the LED’s voltage to vary by a tenth of a volt or two.'
  - text: 'A blue LED (about 3.0–3.2 V): the resistor would have to drop only 0.1–0.3 V.'
    correct: true
    why: 'With so little voltage left over for the resistor, a small difference between one blue LED and the next, or a change in temperature, moves the current by a lot: a 0.1 V shift in the LED changes the current from 10 mA to nothing, or to 20 mA. The resistor can only “forgive” variations in the LED’s voltage if it drops a good part of the supply. That is why blue and white LEDs are usually driven from 5 V, or by a current source.'
  - text: 'They are equally easy: it is always R = V ÷ I.'
    why: 'R = ΔV ÷ I, where ΔV is what is left over after the LED, and how *big* that is decides how forgiving the circuit is.'
```

```quiz
q: 'Why can no circuit made only of diodes and resistors compute NOT?'
options:
  - text: 'Because diodes conduct only one way.'
    why: 'That is true of a diode, but it does not by itself forbid an output that falls when an input rises.'
  - text: 'Because raising an input can only raise or leave alone every voltage in such a circuit; an output that falls needs something that conducts less when its input rises, or a source that adds energy.'
    correct: true
    why: 'Diode circuits are monotonic, like series and parallel switches. A NOT gate needs an element that inverts (the normally-closed contact of a relay, or a transistor), and something that supplies power at the output.'
  - text: 'Because the diode drop makes the output too small.'
    why: 'The drop is why diode gates decay, but it is a different limitation from monotonicity.'
```

```parsons
title: 'A junction forms'
prompt: 'Put these events in the order they happen when a p-type and an n-type crystal are joined, with nothing else connected.'
lines:
  - 'Free electrons on the n side spread across the boundary, and holes spread the other way.'
  - 'Electrons and holes meet near the boundary and recombine: both stop being carriers.'
  - 'The fixed ions near the boundary are left uncovered: positive on the n side, negative on the p side.'
  - 'An electric field appears across the strip, pointing from n to p.'
  - 'The field pushes the carriers back until drift balances diffusion, and the spreading stops.'
  - 'A built-in voltage of about 0.7 V is left across a depletion region a few tenths of a micrometre wide.'
distractors:
  - 'The battery pushes the electrons across the boundary until the p side is full.'
  - 'The atoms move to the boundary to attract the electrons.'
```

:::challenge[Design an indicator]
A 5 V pin of a microcontroller can source at most 20 mA. Design a circuit that lights a red LED (1.9 V) and a green LED (2.1 V) from it, (a) with one resistor per LED, and (b) with both in series behind a single resistor. Work out the resistors for 8 mA, and say what changes if you replace one of the LEDs with a blue one (3.1 V). (Answers: (a) 390 Ω for the red and 360 Ω for the green; a blue LED would need only (5 − 3.1) ÷ 8 mA = 240 Ω, and its current would be much more sensitive to the exact supply. (b) In series, the resistor drops 5 − 1.9 − 2.1 = 1.0 V, so 125 Ω; but a blue and a red LED in series need 3.1 + 1.9 = 5.0 V and leave nothing for the resistor, so they do not work at all.)
:::

## What’s next

Diodes are switches with no moving parts, and this chapter followed two ideas from the electrons up to the LED on your desk: doping decides which carriers there are, and a junction between two dopings makes a one-way valve. But a diode is a *passive* switch. It is worked by the voltage across it, so its output can never be stronger than its input. Chain a few diode gates and the signal decays to nothing; ask one for a NOT and it cannot.

The relay of Chapter 5 had exactly what diodes lack: a small current in one circuit, from one battery, controlling a large current in another circuit, from a different battery, so that every stage restored the signal. What we need is a relay made of silicon: an electrically controlled switch with **gain**. Chapter 8 builds it by putting a third terminal on the junction. It is called the transistor, and it is the reason that a computer fits in your pocket.
