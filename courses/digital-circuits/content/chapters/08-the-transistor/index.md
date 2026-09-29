---
number: 8
title: The transistor
summary: A small current or voltage controls a large one, with no moving parts; and because the control has gain, every stage of a chain can clean up the errors of the one before, which is why digital circuits work at all.
duration: About 1 hour
prerequisites: [diodes-and-leds]
---

Here is the end of Chapter 7 again. A 5 V signal goes into four diode gates in a row, and each takes off a diode drop. By the fourth, a 1 has become 2.3 V, and a receiver that wants 3.5 V for a 1 has lost it.

::circuit{src="07-diodes-and-leds/circuits/diode-chain.json" title="Diode gates fade" n="8.1" caption="The problem of Chapter 7. Each diode gate loses about 0.65 V, because nothing in it adds energy. Click the input to make it 0 V: a low survives, and a high does not."}

The relay of Chapter 5 did not have this problem. Every relay closed a contact connected to *its own* battery, so whatever the coil had received, however weak or noisy, the next stage was handed a fresh, full-strength signal. But a relay is slow and it wears out. What we want is a relay without moving parts. In precise terms, a part with three properties:

1. It is **worked by electricity**: the output of one part can control the next.
2. It has **gain**: a small current or voltage at the control terminal governs a large current from a separate supply, so every stage regenerates the signal instead of consuming it.
3. It has **nothing that moves**, so it can switch millions, and then billions, of times a second.

The vacuum tube was the first thing to have all three.

:::history{year=1906 title="A wire grid in the valve" people="Lee de Forest" source="Sources: US Patent 841,387; Smithsonian National Museum of American History."}
Fleming’s valve had two electrodes. In 1906 Lee de Forest put a third between them: a zigzag of wire, the grid.

De Forest applied on 25 October 1906 for a patent on a “Device for amplifying feeble electrical currents” (US 841,387, granted on 15 January 1907).:cite[deforest-patent] In his tube, which he called the Audion, a hot filament boils off electrons and a plate collects them. The grid sits in the path. Make it slightly negative and it turns back the electrons; make it less negative and they stream through. A small change of voltage on the grid, which itself draws almost no current, makes a large change in the current to the plate: **the first electrical control of one current by another, with gain.**:cite[nmah-audion] The grid of the triode does the job that the base of a bipolar transistor and the gate of a MOSFET do later in this chapter, and the words *cathode*, *grid* and *plate* map to *emitter*, *base* and *collector* in a bipolar transistor, or *source*, *gate* and *drain* in a MOSFET. He filed a patent for the three-electrode form on 29 January 1907.
:::

:::history{year=1944 title="Colossus" people="Tommy Flowers" source="Sources: Copeland (2006); The National Museum of Computing."}
Colossus, built by the Post Office engineer Tommy Flowers to break the German Lorenz cipher, ran at Bletchley Park in early February 1944 with about 1,500 valves.

A valve switches in microseconds, a thousand times faster than a relay, and Colossus read its paper tape at 5,000 characters a second. The Mark 2, with 2,400 valves, entered service on 1 June 1944, and about ten Colossi were working by the end of the war.:cite[copeland2006]:cite[tnmoc-colossus] Engineers had doubted that so many valves could work together, because valves failed often, most of all when switched on. Flowers’s answer was to leave the machine running: it was never switched off. It was electronics at scale, and also the demonstration of the limit. A valve is a hot glowing filament in a glass bulb. It is large, fragile and hungry for power, and a machine of thousands of them fills a room and needs a team to keep it going.
:::

## A relay made of silicon

The switch that replaced the valve came out of Bell Labs at the end of 1947, and it took the p and n regions of the last chapter and stacked them.

:::history{year=1947 title="Two wires on a crystal of germanium" people="John Bardeen, Walter Brattain, William Shockley" source="Sources: Bardeen and Brattain (1948); Riordan and Hoddeson (1997); Computer History Museum; ETHW."}
On 16 December 1947 John Bardeen and Walter Brattain, at Bell Labs, made a signal grow stronger in a solid for the first time. On 23 December they showed it to the management.

Two gold contacts, a fraction of a millimetre apart, were pressed on a slab of germanium. A signal put on one came out of the other about a hundred times stronger.:cite[ethw-transistor] The demonstration on 23 December, with the device switched in and out of an audio circuit so that everyone could hear the difference, is the birthday of the transistor.:cite[chm-transistor] They published it in *Physical Review* in July 1948 as “The transistor, a semi-conductor triode”.:cite[bardeen1948] Their group leader, William Shockley, had been left out of the invention and was determined to do better. On 23 January 1948 he conceived a different device, based on the pn junction: a sandwich of three layers, with nothing to be adjusted by hand.:cite[chm-junction-transistor] He published the theory in 1949; junction transistors, and not point-contact ones, are what the rest of the industry was built on.:cite[shockley1949] Shockley, Bardeen and Brattain shared the Nobel Prize in Physics in 1956.
:::

### The bipolar transistor

A **bipolar junction transistor** (BJT) is a sandwich of three layers: **n**–**p**–**n** (or p–n–p). The layers are called the emitter, the base and the collector, and each has a wire. The base is very thin, less than a micrometre, and lightly doped. That is the whole trick.

Look at the two junctions in an NPN. The base–emitter junction is an ordinary diode, and when the base is about 0.65 V above the emitter it is forward-biased: electrons pour from the emitter into the base, as in the diode of Chapter 7. In a diode they would now recombine with holes and the current would end there. Here, the base is so thin and has so few holes that most of the electrons never meet one. They diffuse straight across and reach the far side, where the *other* junction, between base and collector, sits reverse-biased, with a strong field across it, exactly as in the reverse-biased diode of Chapter 7. The field sweeps them into the collector.

So there are two currents. A large one goes from emitter to collector: nearly all the electrons. A small one goes into the base: the few electrons that did recombine, and the holes that were needed to feed them. The size of both is set by a single number, the base–emitter voltage, through the same exponential as in the diode. The ratio of the two is nearly constant, because it is a matter of geometry, of how likely an electron is to recombine while crossing the base. It is the transistor’s **current gain**, β:

:::equation{#beta caption="In the active region the collector current is β times the base current."}
$$\term{ic}{I_C} = \term{beta}{\beta}\,\term{ib}{I_B}$$

```terms
ic:
  label: 'I_C, the collector current'
  what: 'The current entering the collector, in amperes. It comes mostly from the emitter, through the base.'
  why: 'It is set by the base–emitter voltage, I_C = I_S e^(V_BE/V_T): the same exponential as a diode, so a rise of 60 mV in V_BE multiplies it by ten.'
  effect: 'In the active region it hardly depends on the collector voltage at all, which makes the transistor a good current source.'
beta:
  label: 'β, the current gain'
  what: 'The ratio I_C ÷ I_B, about 100 for a small transistor such as the 2N3904 (a datasheet says 100 to 300, at 10 mA).'
  why: 'It measures how many of the electrons that enter the base cross it, against how many recombine inside. A thinner base has fewer recombinations and a larger β.'
  effect: 'It varies from part to part by a factor of two or three, and with temperature and current. A good circuit does not depend on its exact value.'
ib:
  label: 'I_B, the base current'
  what: 'The small current into the base, in amperes.'
  why: 'It is the price of the control: the electrons that recombine in the base, and the holes that replace them.'
  effect: '10 µA of base current can control about 1 mA of collector current, with β = 100.'
```
:::

That is gain: a small current, taken from one supply, controls a hundred times as much from another. And it explains the two ways the transistor is used. Whether the collector can actually carry β *I*<sub>B</sub> depends on the rest of the circuit, and that gives it three regions.

| Region | Base–emitter | Collector current |
|---|---|---|
| **Cut-off**: an open switch | under 0.5 V | none |
| **Active**: an amplifier | 0.6–0.7 V | *I*<sub>C</sub> = β *I*<sub>B</sub> |
| **Saturation**: a closed switch | 0.7–0.8 V, base overdriven | set by the circuit, less than β *I*<sub>B</sub>; *V*<sub>CE</sub> falls to 0.1–0.2 V |

A saturated transistor is a closed switch with a small voltage across it: the base is fed more current than the transistor could use, so the collector runs out of voltage before it runs out of current, and the current is whatever the load allows. The rule of thumb for a switch is to feed the base at least a tenth of the collector current, which is a *forced gain* of ten, well inside the transistor’s β of 100. A rule of thumb for an amplifier is to stay away from saturation altogether.

```quiz
q: 'In the next figure, a 4.7 kΩ resistor feeds the base of an NPN transistor from 5 V, and an LED with its own 330 Ω resistor hangs on the collector. You now make the base resistor twenty times bigger, 100 kΩ, and everything else stays the same. What do you expect?'
options:
  - text: 'Nothing changes: the transistor is a switch, and the switch is still on.'
    why: 'A switch needs enough base current to saturate. At 100 kΩ the base gets 43 µA, and with β = 100 the collector could carry only 4.3 mA, not the 9 mA that the LED’s resistor asks for.'
  - text: 'The LED goes out, because 43 µA is too small to turn the transistor on.'
    why: 'The transistor is on: it needs only about 0.65 V at the base, and 43 µA is plenty to keep the base–emitter junction conducting.'
  - text: 'The LED gets about half as bright: the collector current is β times 43 µA, which is 4.3 mA.'
    correct: true
    why: 'The transistor drops out of saturation into the active region, where I_C = β I_B. 100 × 43 µA = 4.3 mA against 9 mA before. It is no longer a switch; it is an amplifier with a gain of 100, and the LED is its load.'
```

::bjt-switch{n="8.2" caption="Slide the base resistor from 1 kΩ to 1 MΩ. At the small end the base current is far more than the LED needs: saturation, a closed switch, Ic ÷ Ib only about 10. At the large end Ic is exactly β times Ib, and the LED is a gauge of the base current. Then slide β: a better transistor gives more collector current for the same base current, until saturation hides the difference."}

:::lab[From switch to amplifier]
Use Figure 8.2.

1. At 4.7 kΩ (the starting value) the base takes 0.90 mA and the collector 9 mA: the region is *saturation* and the ratio is about 10. Try 1 kΩ: the base current is now 4.2 mA, and the collector current has not changed. More base current buys nothing once the LED’s resistor is the limit.
2. Raise the resistor to 47 kΩ and then 100 kΩ. At 100 kΩ the base current is 43 µA and the collector current 4.3 mA. Now the ratio is exactly 100, and the region has changed to *active*.
3. Go on to 1 MΩ: 4.4 µA in, 0.44 mA out, and the LED is a dim glow. The collector current follows the base current in proportion, over a factor of a hundred.
4. At 100 kΩ, slide β from 100 up to 200: the collector current doubles to 8.6 mA. Swap the transistor for a better one and the amplifier changes, but the switch, at 4.7 kΩ, does not. That is why a switch is designed for the *worst* β you might get and the amplifier is not designed that way.
5. Click the switch off: no base current, no collector current, cut-off.
:::

### The MOSFET

The bipolar transistor is controlled by a current. The **MOSFET** (metal–oxide–semiconductor field-effect transistor) is controlled by a *voltage*, and that changes what it takes to drive it.

Take a slab of p-type silicon, with two n-type regions near its surface, the **source** and the **drain**, separated by a gap. Above the gap, on a thin layer of insulating oxide (a few nanometres of silicon dioxide in a modern chip), lay a conducting plate: the **gate**. With the gate at 0 V there is no way for current to get from the source to the drain: each n region makes a junction with the p region, and the two junctions point in opposite directions, so one is always reverse-biased.

Now raise the gate’s voltage. The gate and the silicon below it form a **capacitor**, with the oxide as its dielectric (Chapter 4), and a positive gate attracts electrons to the surface of the silicon and pushes the holes away. Above a certain gate voltage, the **threshold voltage** *V*<sub>t</sub>, enough electrons have gathered in a thin layer under the oxide to join the source to the drain: a **channel** of n-type material has formed in the p-type silicon. **The charge on the gate capacitor *is* the channel.** Raise the voltage further and the channel gets richer, and conducts better.

The current follows a simple law, with two regimes (the “level-1” model that the simulator uses):

:::equation{#mos caption="Just above threshold, an n-channel MOSFET’s drain current grows with the square of the gate overdrive."}
$$\term{id}{I_D} = \frac{\term{k}{k}}{2}\,\bigl(\term{vgs}{V_{GS}} - \term{vt}{V_t}\bigr)^2$$

```terms
id:
  label: 'I_D, the drain current'
  what: 'The current from drain to source, in amperes, once the drain voltage is high enough (V_DS above V_GS − V_t: the saturation region).'
  why: 'The channel’s charge is proportional to the overdrive, and the speed of the carriers is too, so the current goes as the overdrive squared.'
  effect: 'Double the overdrive and the current quadruples.'
k:
  label: 'k, the transconductance parameter'
  what: 'A constant of the transistor in A/V², set by its width, length and oxide thickness. The simulator’s default is 0.02 A/V².'
  why: 'A wide, short channel with a thin oxide carries more current.'
  effect: 'A wider transistor is like several in parallel.'
vgs:
  label: 'V_GS, the gate voltage'
  what: 'The voltage from the gate to the source, in volts.'
  why: 'It is what pulls the electrons into the channel.'
  effect: 'Below V_t there is no channel and no current.'
vt:
  label: 'V_t, the threshold voltage'
  what: 'The gate voltage at which the channel forms: 1 V in the simulator, about 2 V for a 2N7000, a few tenths of a volt in a modern processor.'
  why: 'It is set by the doping and by the oxide.'
  effect: 'A lower threshold gives more current at a given voltage, but leaks more when off (Chapter 10).'
```
:::

For a small drain voltage the channel is a resistor whose value falls as the gate voltage rises, and that is how a MOSFET is used as a switch: with the gate high, it is a resistor of a few ohms or less; with the gate low, an open circuit.

```quiz
q: 'The gate of a MOSFET is a plate above an insulating layer. In steady state, with 5 V held on the gate, how much current flows into it?'
options:
  - text: 'About as much as the base of a bipolar transistor would need, a fraction of a milliamp.'
    why: 'The base of a BJT is a forward-biased junction: current has to flow for as long as it is on. A gate is not connected to the silicon at all.'
  - text: 'None, apart from a brief pulse of current while the gate capacitor charges up.'
    correct: true
    why: 'The oxide is an insulator. Charging the gate takes a little current, I = C dV/dt, for a moment; once the gate is at 5 V nothing flows.'
  - text: 'A few milliamps, because the drain current has to come from somewhere.'
    why: 'The drain current comes from the drain supply, through the channel to the source. None of it goes near the gate.'
```

::nmos-switch{n="8.3" caption="Turn the gate voltage down from 5 V. Nothing flows below the 1 V threshold; just above it the current rises fast (0.4 mA at 1.2 V, 2.6 mA at 1.5 V); by 2 V the LED’s resistor is the limit. The gate ammeter reads zero throughout: the MOSFET is controlled by a voltage, not a current. (The 10 MΩ resistor is the off-state leakage, and keeps the simulator’s drain node from floating.)"}

The two transistors differ in what they ask of whoever drives them:

| | Bipolar (NPN) | MOSFET (n-channel) |
|---|---|---|
| Controlled by | a current into the base (about 0.65 V across the junction) | a voltage on the gate |
| Input current, steady | *I*<sub>C</sub> ÷ β, milliamps for a power switch | none: the gate is an insulator |
| Fully on | 0.1–0.2 V across it (*V*<sub>CE(sat)</sub>) | a few ohms or less, so *I* × *R* |
| Cost of switching | charge in the base | charging the gate capacitor |
| Where you find it | amplifiers, drivers, analogue, the RTL and TTL of the 1960s and 70s | almost every logic gate made since about 1980 |

**A MOSFET draws no current to stay on.** One MOSFET output can therefore drive the gates of dozens of others without ever running out of current (Chapter 10 calls this *fan-out*): what it has to do is charge and discharge the capacitors of the gates it drives, and the time that takes is what limits a computer’s speed. The transistor is also tiny and easy to make in a flat process, so millions fit on a chip. Together those are the reasons why logic today is built from MOSFETs, and why Chapter 9 uses them.

## Gain is what makes digital work

Take a transistor and a resistor, and you have a gate. The NPN below is the transistor of Figure 8.2. Its collector is joined to the supply through a 1 kΩ resistor (a *pull-up*: Chapter 4), and its base is fed from the input through 4.7 kΩ. When the input is 0 V, the base gets no current, the transistor is cut off, and the pull-up brings the output to 5 V. When the input is 5 V, 0.9 mA flows into the base, the transistor saturates, and the output is pulled down to 0.05 V. The output is the opposite of the input. This is an **inverter**, a NOT gate, and because the resistor and the transistor are the whole circuit, it is called **resistor–transistor logic**, or **RTL**.

::circuit{src="08-the-transistor/circuits/rtl-inverter.json" title="An RTL inverter" n="8.4" current=true caption="Click the input. With the input at 0, the transistor is off and the output is 5.00 V. At 1 it is saturated: 0.9 mA flows into the base, 5 mA through the pull-up, and the output is 0.05 V. The current dots show where the energy goes: a low output means 5 mA through the 1 kΩ, all the time (Chapter 9 will fix that)."}

So far this is a NOT gate. What matters is what happens *between* the two clean states. Sweep the input from 0 V to 5 V, and plot the output: the **voltage transfer curve**.

::transfer-curve{n="8.5" caption="Slide the input. Below about 0.5 V the transistor is cut off and the output is flat at 4.25 V (5 V with nothing connected; 4.25 V when the next inverter’s base is drawing current). Above about 1 V it is saturated and the output is flat again, at 0.05 V. Between, the transistor is in its active region and the curve falls at up to 16 volts of output for every volt of input."}

Look at the shape. There are two flat parts at the ends, and a very steep part in the middle. In the middle the gain (the slope) reaches −15.6, at an input of 0.86 V. The band where the slope is steeper than −1 is only 0.4 V wide, from 0.56 V to 0.96 V. That shape, flat at the ends and steep in the middle, is the whole reason a computer works. Here is why.

Suppose the input is *nearly* right: it should be 5 V and it is 4.8 V, or it should be 0 V and it is 0.3 V. The inverter’s output has an error of its own, equal to the input’s error times the local slope. At the flat ends the slope is about 0.02, so an error of 0.3 V at the input becomes an error of a few millivolts at the output. The next inverter takes an even cleaner input, and the error is gone. Errors that could be tolerated have been removed, and it is the *flatness* that does it. This is **regeneration**, the restoration that the relay repeater of Chapter 5 achieved with a moving contact.

But flatness alone would be no good: a stage that always outputs the same thing is not a wire. Where the input really is undecided, in the middle between the two levels, the steepness takes over. A signal that lands there is *amplified* away from the middle, towards one end or the other, by a gain much larger than 1. The middle is a ridge and the ends are valleys: everything rolls downhill into one of the two valleys, however slightly it started off. **Gain in the middle, saturation at the ends: together they turn a continuous voltage into a 0 or a 1.**

The band in which the slope is −1 or steeper gives the **noise margins** (Chapter 10 defines them properly). For this inverter, an input below 0.56 V is solidly a 0 and above 0.96 V solidly a 1, and the outputs are 4.25 V and 0.05 V. So a 0 can pick up 0.56 − 0.05 = **0.5 V** of noise, and a 1 can lose 4.25 − 0.96 = **3.3 V**, before the next stage stops treating them as what they were. Half a volt for a 0 is not much, which is one of the reasons RTL did not last.

Now compare a diode stage. Its curve is a line of slope 0.98 shifted down by 0.65 V: never steeper than 1, and no flat parts to snap onto. Errors are not removed, and the level slides down at every stage. A plain wire, a slope of exactly 1, does not add errors but does not remove them either, and it does add noise at every stage. The curve of a stage is a function, and a chain is that function applied again and again.

:::programmer[A chain is a function applied to itself]
A chain of stages is `f(f(f(…f(x))))`. What happens to the value depends on what kind of function `f` is, exactly as in a numerical loop. If `f` has slope less than 1 everywhere it is a contraction, and the value converges to a fixed point: for the diode, that is 0 V (`x = max(0, x − 0.65)` gets there in eight steps). If `f` is the identity, nothing converges, and each bit of noise added stays for ever. If `f` is steep in the middle and flat at both ends, it converges to one of *two* attractors, wherever it started: that is `round()`, or `x > 2.5 ? 5 : 0`, computed by a transistor. A digital signal is an analogue one that has been rounded at every step, and the rounding function is a piece of hardware.
:::

```quiz
q: 'A signal goes through twenty stages, each of which adds a little noise. Which kind of stage can keep it clean?'
options:
  - text: 'A stage with a gain of exactly 1, so that it neither adds nor removes anything.'
    why: 'It passes on everything it receives, including the noise from the last stage, and adds its own. The noise accumulates like a random walk, as the square root of the number of stages.'
  - text: 'A stage with a gain of less than 1 everywhere, so that errors are made smaller at each stage.'
    why: 'Errors do shrink, but so does the signal, and a stage of this kind also cannot add back what it takes away. It is the diode chain of Figure 8.1.'
  - text: 'A stage that is very steep in the middle and flat at both ends, so that a level a little off is pushed back to the rails.'
    correct: true
    why: 'Steepness (gain above 1) is needed to decide an undecided input, and flatness (saturation) is needed to remove small errors from levels that are already decided. The two together make each stage a small quantiser.'
```

::noise-gauntlet{n="8.6" caption="A bit goes through twenty stages, and every stage adds noise. Start with the diode stage: even with the noise at 0, the 1 fades and is misread from about stage 5. Switch to the plain wire: the 1 survives, but the noise piles up. Switch to the inverter: the levels stay crisp and the noise does not build up. Then send a degraded 1 of 2 V (the inverter fixes it in one stage) and turn the noise up until even the inverter fails."}

:::lab[Run the gauntlet]
Use Figure 8.6, which is built on the real transfer curves: the engine measured them once, and each stage is a lookup in that table.

1. **Diode stage, noise 0, sending 1.** The level goes 5.0, 4.3, 3.6, 2.9, 2.3 V, the numbers of Figure 8.1, and falls below the 2.5 V line at stage 4: the red crosses start there. By stage 8 it is below 1 V. No amount of care in the design of the receiver can recover a signal that is gone.
2. **Wire, noise 0.2 V.** The bars wander, and the wander gets larger along the chain, as the square root of the number of stages: after 20 stages it is about 0.9 V. Look at “If the chain were longer”: with 20 stages hardly any bits are lost, with 100 stages about 80 of 400 are, and with 500 stages about half the bits are wrong, no better than guessing.
3. **Inverter, same noise.** The bars alternate between 0.05 V and 4.25 V with only the last stage’s own noise on top, however long the chain: with 500 stages fewer than 15 of 400 bits are lost. The noise added at one stage is corrected before it reaches the next.
4. **Degraded input.** Send a 1 at 2.0 V. The first inverter turns it into a clean 0.08 V, and by the second stage it is 4.25 V. A wire keeps the 2.0 V for ever, and the diode stage makes it about 1.4 V, then 0.8 V.
5. **Limits.** With the inverter, raise the noise past 0.3 V, then 0.5 V. Errors begin at 0.3 V (12 of 400 bits lost) and rise steeply. Restoration only works against errors smaller than the noise margin, 0.5 V for a 0 of this gate. A gate that does better than that is the subject of Chapters 9 and 10.
:::

The chain of relays at the end of Chapter 6 showed the same thing at the slow scale, and the telegraph repeater of Chapter 5 before it: **each stage takes power from its own supply and produces a fresh signal.** A relay does it with a moving contact, a valve with a hot filament, and a transistor with a few square micrometres of silicon.

## NOR, and your first part

The inverter has one transistor. Put a second in parallel with it, with its collector on the same output and its own base resistor, and you have something else: the output is pulled low if the first input *or* the second is high, and is high only if both are low. That is NOR.

::circuit{src="08-the-transistor/circuits/rtl-nor.json" title="An RTL NOR gate" n="8.7" caption="Click the inputs A and B. The output Y is 5 V only when both are 0; if either is 1, its transistor pulls Y down to 0.05 V, and with both on Y is a little lower still (0.04 V), because the two transistors share the current."}

NOR is enough on its own to build any logic circuit, as Chapter 11 will show. This is not only a curiosity. The computer that took astronauts to the Moon, the Apollo Guidance Computer, was built almost entirely from NOR gates of exactly this kind: RTL, with three inputs in each gate, two gates to an integrated circuit, and about 2,800 of those circuits in the flight version.:cite[shirriff2019]:cite[hall1996] Every instruction it executed was made by such gates, one small transistor after another.

:::key[Your first part]
You now have a working NOT gate: an NPN transistor, a 4.7 kΩ resistor on its base and a 1 kΩ pull-up, with three connections (IN, OUT and the supply). From here on you will stop drawing it as a transistor and two resistors. It becomes the **inverter**, the first part in your parts bin: a black box with a pin for the input and a pin for the output, which passes its checker when its output is high for a low input and low for a high one. Every later chapter builds from the parts in the bin, and the bin starts with this one.
:::

The RTL inverter has three faults, and the next two chapters remove them:

- It **wastes power**. Whenever the output is low, 5 mA flows from the supply through the pull-up: 25 mW per gate, even when nothing is happening. A chip of a million such gates, half of them low, would dissipate over 12 kW.
- It is **slow**. Pulling the output up goes through a 1 kΩ resistor, and every wire and gate input is a capacitor (Chapter 4), so a rising edge is an RC curve.
- Its **noise margin** for a 0 is half a volt, and each gate driven from an output takes base current, so an output can only feed a few inputs.

:::hood[How the engine models a BJT and a MOSFET]
Both models are short. The bipolar transistor is the **Ebers–Moll** model of 1954: two diodes, back to back, plus the “transport” of current between them.:cite[ebers1954] The engine’s version (`semiconductors.ts`, in the analog models) is:

```ts
// Ic = Is(e^(Vbe/Vt) − e^(Vbc/Vt)) − (Is/βR)(e^(Vbc/Vt) − 1)
// Ib = (Is/βF)(e^(Vbe/Vt) − 1) + (Is/βR)(e^(Vbc/Vt) − 1)
const iF = is * (ebe - 1);
const iR = is * (ebc - 1);
return {
  ic: iF - iR * (1 + 1 / BETA_R) - g * vbc,
  ib: iF / bf() + iR / BETA_R + g * (vbe + vbc),
```

`iF` is the current of the base–emitter diode, and `iR` that of the base–collector diode. Everything follows from these two lines. In the active region the collector is reverse-biased, `iR` is tiny, and *I*<sub>C</sub> = `iF` while *I*<sub>B</sub> = `iF` ÷ β: the current gain is a division by `bf()`. In saturation the collector junction also conducts, `iR` grows, and it is *subtracted* from `ic`: the collector current can no longer follow β *I*<sub>B</sub>. The engine tells the two apart with one line:

```ts
const region = vbe < 0.5 || ib <= 0 ? 'cutoff' : ic < 0.95 * bf() * ib ? 'saturation' : 'active';
```

Saturation is the state in which the collector current is less than 95 % of what the base current would allow. Each of the two junction voltages is passed through `pnjlim` (the limiter of Chapter 7), and the stamp fills the 3 × 3 block of the Newton matrix from the four derivatives (`gcbe`, `gcbc`, `gbbe`, `gbbc`). The model has no capacitance, no series resistance and no Early effect (the slight rise of *I*<sub>C</sub> with the collector voltage), and βR is fixed at 1.

The MOSFET is the **level-1** (Shichman–Hodges) model of 1968.:cite[shichman1968] The whole of its channel is this function of the overdrive `vov` = *V*<sub>GS</sub> − *V*<sub>t</sub> and the drain voltage:

```ts
if (vov <= 0) return { id: 0, gm: 0, gds: 0, region: 'off' as const };
if (vds < vov) {
  const f = vov * vds - (vds * vds) / 2;
  return { id: k * f * (1 + l * vds), …, region: 'linear' as const };
}
return { id: (k / 2) * vov * vov * (1 + l * vds), …, region: 'saturation' as const };
```

Off below threshold; a resistor-like parabola in the linear region; the square law of the equation above in saturation; `l` is λ, the slight slope of *I*<sub>D</sub> with drain voltage. The transistor is symmetrical, so if the drain voltage falls below the source’s the two swap roles, and the gate connects to nothing: the engine stamps no gate current at all, which is why the ammeter in Figure 8.3 reads zero. The gate’s capacitance is not modelled either. For the voltage limiting the engine uses SPICE’s `fetlim` and `limvds`, the counterparts of `pnjlim`.:cite[nagel1975]

The curves of the noise gauntlet come from this code. `widgets/vtc.ts` builds a netlist of two identical stages (one to measure, one as the load), sweeps an ideal source from −0.5 V to 5.5 V in steps of 20 mV, calls `settle()` on the engine at each step, and stores the output voltage. The whole sweep of both curves takes about 50 ms.
:::

:::real{parts="2N3904 (or any small NPN), red LED, 10 kΩ, 330 Ω, 4.7 kΩ, 1 kΩ, 1 MΩ, 5 V USB supply module, breadboard, multimeter"}
**A transistor switch.** The 2N3904 comes in a small black half-cylinder (TO-92). Hold it with the flat face towards you and the legs down: from left to right they are **E**mitter, **B**ase, **C**ollector. Wire the LED and the 330 Ω resistor in series from +5 V to the collector, and the emitter to ground. Connect the base to +5 V through the 10 kΩ resistor. The LED lights: the base takes (5 − 0.65) ÷ 10 kΩ = 0.43 mA and the collector carries about 9 mA, a forced gain of about 20. Measure the base–emitter voltage (about 0.65–0.7 V) and the collector–emitter voltage (0.05–0.2 V: saturation). Now replace the 10 kΩ with the 1 MΩ. The base current is 4 µA and, with a β of about 100–300, the collector current is 0.4–1.2 mA: the LED is dim, and you have measured the β of your transistor by dividing the two currents (the voltage across the 330 Ω resistor gives the collector current).

**An RTL inverter.** Make the pull-up 1 kΩ from +5 V to the collector (no LED now), the emitter on ground, and the input through the 4.7 kΩ resistor to the base. With the input at ground the output is at 5 V; with the input at 5 V it is at about 0.1 V. Build two more, with each output feeding the next input through its own 4.7 kΩ, and feed the first from a potentiometer between 0 V and 5 V: the last output jumps between the two levels as you pass about 1 V, and nowhere near the slow, sliding response of a chain of resistors.
:::

## Exercises

```quiz
q: 'An NPN transistor with β = 100 is to switch a 5 V relay whose coil takes 70 mA (Chapter 5). You drive the base from 5 V through a resistor, and want a forced gain of 10, so that it saturates even with a poor transistor. Which resistor is closest?'
options:
  - text: '43 kΩ, so that the base takes (5 − 0.7) ÷ 43 kΩ = 0.1 mA, and the collector gets β times that.'
    why: 'That gives 10 mA, far short of the 70 mA that the coil needs. The base must be fed a tenth of the collector current, not a hundredth.'
  - text: '560 Ω: the base takes 7.7 mA, a tenth of 70 mA plus some margin.'
    correct: true
    why: 'A forced gain of 10 means I_B = 70 mA ÷ 10 = 7 mA, and R = (5 − 0.7) ÷ 7 mA = 610 Ω. The nearest standard value below is 560 Ω (7.7 mA), which errs on the side of saturating.'
  - text: '4.3 Ω, because the resistor has to drop 4.3 V at 1 A.'
    why: 'The resistor is in the base circuit and carries only the base current, milliamps and not amps.'
```

```quiz
q: 'A transistor in a circuit has 0.3 V from base to emitter. What region is it in?'
options:
  - text: 'Cut-off: the base–emitter diode is far from conducting, so there is no base current and no collector current.'
    correct: true
    why: 'Below about 0.5 V a silicon junction passes only nanoamps, and with β = 100 the collector current is a hundred times that: still nothing. The transistor is an open switch.'
  - text: 'Active: a little base current gives a little collector current.'
    why: 'At 0.3 V the base current is about 10⁻¹¹ A: at 60 mV per decade, the exponential has not started yet.'
  - text: 'Saturation: the collector voltage is at its lowest.'
    why: 'Saturation needs plenty of base current. There is none here.'
```

```quiz
q: 'Why does a chain of RTL inverters restore a degraded signal, when a chain of diode gates does not?'
options:
  - text: 'RTL inverters are faster, so there is no time for the signal to decay.'
    why: 'Speed has nothing to do with it: a slow chain of inverters restores just as well.'
  - text: 'Each inverter has a supply of its own, and a transfer curve that is steep in the middle and flat at both ends, so its output level depends on which side of the middle the input is, and not on how far it is from the ideal.'
    correct: true
    why: 'The energy comes from the supply, not the input, so the output can be bigger than the input; and the flat ends mean that small errors on the input are not passed on to the output.'
  - text: 'Inverters use transistors, and transistors have a voltage drop of 0.7 V that cancels the loss.'
    why: 'The base–emitter voltage is the reason a transistor needs about 0.7 V to turn on, but it has nothing to do with restoration.'
```

```parsons
title: 'A degraded 1 enters an inverter chain'
prompt: 'Put these events in order for a 1 of only 2.0 V, sent into a chain of RTL inverters (0.9 V is the switching threshold).'
lines:
  - 'The first inverter’s input is 2.0 V, well above its threshold of about 0.9 V.'
  - 'The base current is about 0.3 mA, more than the 0.05 mA that saturation needs, so the transistor saturates.'
  - 'The first output is pulled down to about 0.08 V: a clean 0.'
  - 'The second inverter’s input is 0.08 V, far below 0.5 V, so its transistor is cut off.'
  - 'The pull-up brings the second output to 4.25 V: a clean 1, and the damage has been undone.'
  - 'From then on every output is at 0.06 V or 4.25 V, whatever noise is added.'
distractors:
  - 'The first inverter passes the 2.0 V on, less 0.7 V for the transistor.'
  - 'Each inverter amplifies the 2.0 V by its gain of −15, up to 30 V.'
```

:::challenge[A three-input NOR]
Add a third input C to the NOR gate of Figure 8.7. (a) How many transistors and how many resistors? (b) When only C is high, how much current flows through the pull-up? (c) When all three are high, how much current does the supply provide in total, given that 0.9 mA flows into each base? Then say what changes if you connect the output of this gate to the inputs of ten other gates. (Answers: (a) three transistors, three base resistors and one pull-up; (b) about 5 mA, since the pull-up sees 5 V less 0.05 V across 1 kΩ, however many transistors are on; (c) 5 mA through the pull-up plus 3 × 0.9 mA into the bases, about 7.7 mA. With ten gates connected, the output must supply 10 × 0.9 mA = 9 mA when high, more than the pull-up can give: its output falls from 4.25 V to about 0.9 V, which is the threshold, and the next stages misread it. That is the fan-out limit of RTL.)
:::

## What’s next

The transistor has given us what the relay had and the diode lacked: control by a small signal, gain that restores it, and a thousand times the speed. In its simplest logic form, RTL, a transistor and a resistor make a NOT, and two make a NOR; and that is enough to build a computer, and a computer has been built, one that went to the Moon.

But the resistor is a poor partner. It burns power whenever the output is low, it sets the speed of every rising edge, and it limits how many gates one output can drive. What if the pull-up were also a transistor, one that is on exactly when the pull-down is off? Then a stage would never conduct from supply to ground, except for the instant of switching, and the resistor would be gone. Chapter 9 makes that switch with a second kind of MOSFET, the p-channel one, and the result, **CMOS**, is what every chip in your pocket is made of.
