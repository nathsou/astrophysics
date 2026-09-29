---
number: 4
title: Capacitors and time
summary: A capacitor stores charge and cannot change its voltage at once. That one fact gives the exponential curve of RC circuits, the delay of every wire, the slow edge of I²C, and the bounce of every switch.
duration: About 1½ hours
prerequisites: [the-bench]
---

Many bench power supplies have a little LED to say that they are on. Switch one off and watch it. The LED does not snap off; it fades over a second or two. The mains is disconnected and nothing inside is burning, yet something is still pushing current through that LED, less and less of it as time goes by. What is doing it is a large component, an electrolytic capacitor of a few thousand microfarads, that was holding electric charge and is now letting it run out through the LED at a rate that shrinks as it empties.

That one behaviour, *the rate of change is proportional to what is left*, gives the exponential curve that is in every corner of electronics. It also explains something a programmer would never guess from a logic diagram: the signals inside a computer are never square. Every wire on a chip and every trace on a board is a tiny capacitor, and a gate has to fill it before the next gate can see a change. This chapter builds the idea from the ground up, measures it with the scope of Chapter 3, and follows it to four places where it bites: the speed limit of a wire, the slow edge of a bus, the bounce of a switch, and the way the simulator itself steps through time.

## A tank for charge

A :term[capacitor]{id=capacitor} is two conductors, the *plates*, separated by an insulator. Connect a battery across it and charge flows on to one plate and off the other, until the voltage between the plates equals the battery’s. Disconnect the battery and the charge stays: one plate has an excess of electrons, the other a deficit, and the insulator between them keeps the two apart. What has been stored is not energy in a wire but *charge on plates*, and the voltage across the capacitor is simply a measure of how much there is:

:::equation{#qcv caption="The charge on a capacitor is proportional to the voltage across it; the constant is its capacitance."}
$$\term{q}{Q} = \term{c}{C}\,\term{v}{V}$$

```terms
q:
  label: 'Q, the charge'
  what: The charge that has been moved from one plate to the other, in coulombs (C).
  why: This is what a capacitor stores. The current that flows in is the charge arriving each second, so the charge is the running total of the current, Q = ∑ I·Δt.
  effect: Double the voltage and twice the charge is stored, always.
c:
  label: 'C, the capacitance'
  what: How much charge the capacitor holds per volt, in farads (F). It is fixed by the geometry, C = ε A / d, and the insulator.
  why: Bigger plates hold more (area A), plates closer together hold more (gap d), and a better insulator (permittivity ε) holds more.
  effect: A larger C is a bigger bucket, so it takes more charge to change the voltage by a given amount.
v:
  label: 'V, the voltage'
  what: The voltage between the plates, in volts.
  why: It is the visible face of the stored charge. Nothing else about the capacitor's state can be measured from outside.
  effect: The voltage across a capacitor can only change as fast as charge can be moved on or off the plates.
```
:::

The unit of capacitance is the :term[farad]{id=farad} (F), and it is enormous. A parallel-plate capacitor of one farad, with the plates a millimetre apart in air, would need plates of area *A* = *C d* ÷ *ε*₀ = 1 × 0.001 ÷ 8.85 × 10⁻¹² ≈ 1.1 × 10⁸ m²: over a hundred square kilometres. Real capacitors get their capacitance from very thin insulators and very rolled-up plates, and the values you meet are far smaller: **µF** (10⁻⁶ F) for the big electrolytic capacitors of a power supply, **nF** (10⁻⁹) for the 100 nF ceramic that sits beside every chip, **pF** (10⁻¹²) for the capacitance of a wire.

Take a 1000 µF capacitor charged to 5 V. It holds *Q* = 1000 × 10⁻⁶ × 5 = 5 mC, which is 3 × 10¹⁶ electrons. Take a 10 pF wire at 5 V: it holds 50 pC, some 300 million. The second sounds like little, but a chip has a billion such wires.

The picture that has served since the 1740s is a **tank**. The capacitance is the tank’s cross-section, the charge is the volume of water in it, and the voltage is the water level. A wide tank (large *C*) needs a lot of water to raise its level a little; a narrow one (small *C*) shoots up with a cupful. Water only enters or leaves through a pipe, and the *flow* through the pipe is the current. That gives the rule of the whole chapter. Charge in equals current times time, so the level changes by

$$\Delta V = \frac{I\,\Delta t}{C}, \qquad\text{or}\qquad I = C\,\frac{\Delta V}{\Delta t}.$$

A steady 1 mA into 1000 µF raises the voltage by 1 V every second. And if the voltage is *not* changing, there is no current: a capacitor blocks a steady (DC) current entirely, and passes current only while its voltage is on the move. Most of what follows is what that implies when the water can enter only through a narrow pipe.

:::programmer[A capacitor is an accumulator]
In code, the voltage across a capacitor is a variable that is updated by a rule: `v += i * dt / C`. You can push current in and the variable climbs; you can pull it out and it falls; but you can never assign `v = 5` and have it jump, because that would need an infinite current for zero time. Every gate output in a logic diagram is drawn as if it did jump. This chapter is about the difference.
:::

:::history{year=1745 title="The Leyden jar" people="Ewald Georg von Kleist, Pieter van Musschenbroek" source="Sources: Heilbron (1979); Franklin (1751)."}
The first capacitor was a glass jar with water in it. Two experimenters, in two countries, found out how much a shock it could give.

On 11 October 1745, Ewald Georg von Kleist, a cleric in Cammin in Pomerania, tried to store electricity from a friction machine in a small medicine bottle, partly filled with alcohol, with a nail through the cork. When he touched the nail with one hand while holding the bottle with the other, he received a shock stronger than any he had had from the machine itself.:cite[heilbron1979] A few months later, in January 1746, Pieter van Musschenbroek at Leiden, working with his student Andreas Cunaeus, found the same thing with a glass jar of water held in the hand. Writing to Réaumur in Paris, he reported that he would not take a second shock for the kingdom of France. Jean-Antoine Nollet, who translated the letter, named the device the *Leyden jar*, and he and others went about Europe shocking people in chains to show off its power.:cite[heilbron1979]

Benjamin Franklin found what the jar really was: the glass, not the water or the metal, is what holds the charge apart, and one side has exactly as much positive as the other has negative.:cite[franklin1751] Coating the outside and the inside of a jar with metal foil turned it into a plate capacitor. A jar of about a litre has a capacitance of the order of 1 nF (our estimate, from *C* = ε*A*/*d* with glass of thickness 2 mm and a foil area of 300 cm²): a thousand times smaller than a modern 1 µF ceramic capacitor. Every capacitor since is a Leyden jar with better materials.
:::

## Charging through a resistor

Now put a resistor in the pipe. Connect an empty capacitor to a battery of voltage *V*ₛ through a resistor *R*, and think about what happens at the instant the switch closes. The capacitor is empty, so it has no voltage: the whole battery voltage is across the resistor, and the current is *V*ₛ ÷ *R*, just as Ohm’s law says. That current starts to fill the capacitor. But as the capacitor’s voltage climbs, the voltage across the resistor, which is the battery voltage *minus* the capacitor’s, falls, and so does the current. The fuller the tank, the slower it fills. The current is largest at the start and dies away, and so does the rate at which the voltage rises.

The circuit below is exactly that, with an LED in the pipe as a current gauge. The battery is 5 V, *R* = 470 Ω, and the capacitor 1000 µF.

::circuit{src="04-capacitors-and-time/circuits/charge-led.json" n="4.1" title="Filling a tank through a resistor" current=true speed=1 caption="Close Charge. The LED is brightest at the first instant, because an empty capacitor looks like a short circuit, and fades as the tank fills; the current dots slow down with it. The LED is dark after about three seconds even though the capacitor has only reached about 3.5 V: an LED conducts almost nothing below about 1.7 V, so it is a poor ammeter near the end. Press Reset (top right of the figure) to empty the capacitor."}

### The time constant

How fast is “slowly”? The circuit has two numbers, *R* and *C*, and the time it takes must come from them. A big resistor makes a narrow pipe (slower), and a big capacitor a wide tank (slower), so the time goes up with both. In fact it is their product: the unit of resistance times capacitance is (V/A) × (C/V) = C/A = seconds. That product is the :term[time constant]{id=time-constant}:

:::equation{#tau caption="The time constant of a resistor charging a capacitor."}
$$\term{tau}{\tau} = \term{r}{R}\,\term{c2}{C}$$

```terms
tau:
  label: 'τ, the time constant'
  what: The time in which the capacitor closes 63 % of the gap between its present voltage and the voltage it is heading for, in seconds.
  why: It is the one number that says how quickly the circuit responds, whatever its voltages are.
  effect: Everything happens in multiples of τ. After about 5τ the circuit has effectively finished.
r:
  label: 'R, the resistance'
  what: The resistance the charge has to flow through, in ohms.
  why: It sets the current for a given voltage difference, so it sets how fast the tank fills.
  effect: Ten times the resistance, ten times the time.
c2:
  label: 'C, the capacitance'
  what: The size of the tank, in farads.
  why: A bigger tank needs more charge for the same rise in voltage, and charge arrives at a rate set by the current.
  effect: Ten times the capacitance, ten times the time.
```
:::

Now for what τ means. Suppose the capacitor is empty and the battery is 5 V. At the start, the current is *V*ₛ/*R*, so the voltage would rise at *V*ₛ/(*RC*) volts per second, which is *V*ₛ/τ. If it *kept* rising at that rate, it would reach the battery voltage exactly at *t* = τ. It does not, because the current falls as it goes. Instead it reaches **63 %** of the battery voltage at *t* = τ (3.16 V of 5 V). The rule, which needs no calculus, is:

> In each time constant the capacitor closes 63 % of the gap that is left between its voltage and the battery’s.

The gap is 5 V at the start. After τ it is 37 % of that, 1.84 V. After 2τ it is 37 % of *that*, and so on: the gap is multiplied by 0.368 each time. Whenever the rule “the rate of change is proportional to what is left” holds, you get this pattern, and the pattern is called an exponential:

| Time | Gap remaining | Reached | Of 5 V |
|---|---|---|---|
| 0 | 100 % | 0 % | 0 V |
| τ | 36.8 % | 63.2 % | 3.16 V |
| 2τ | 13.5 % | 86.5 % | 4.32 V |
| 3τ | 5.0 % | 95.0 % | 4.75 V |
| 4τ | 1.8 % | 98.2 % | 4.91 V |
| 5τ | 0.67 % | 99.3 % | 4.97 V |

Five time constants is the rule of thumb for “done”: after 5τ the capacitor is within 1 % of its final voltage. And the curve never quite arrives: there is always a fraction of a gap left, so an engineer speaks of “settling to within 1 %” rather than “settling”.

```quiz
q: 'An empty 1 µF capacitor is connected to a 5 V battery through a 1 kΩ resistor, so τ = 1 ms. What is the voltage across the capacitor at exactly t = 1 ms?'
options:
  - text: '2.5 V, half way: the capacitor is half full after one time constant.'
    why: 'Half full comes sooner, after 0.69 τ. After a whole τ the capacitor has closed 63 % of the gap, which is more than half.'
  - text: '3.16 V, which is 63 % of 5 V.'
    correct: true
    why: 'In each time constant the capacitor closes 63 % of the gap that remains, and at the start the gap is the whole 5 V. So 0.63 × 5 V = 3.16 V.'
  - text: '5 V: the time constant is the time it takes to fill.'
    why: 'If the current stayed at its starting value the capacitor would be full at τ; but the current falls as the capacitor fills, so it is still 37 % of the way short.'
```

The next figure lets you check this against the circuit itself. A function generator drives a square wave (0 to 5 V) into a resistor and a capacitor, and the two channels of a scope show the generator (amber) and the capacitor (green). This is the scope of Chapter 3: the generator’s frequency is tied to the timebase so that one period fills the ten divisions, and the trigger holds the rising edge at the first division.

::rc-lab{n="4.2"}

:::lab[Read τ off the scope]
1. Leave *R* = 1 kΩ and *C* = 1 µF. The timebase is 1 ms per division, so the generator’s half period is 5 ms, five time constants. The green trace should reach nearly 5 V just before the falling edge.
2. The cursors are already on. Move **T1** to the rising edge of the generator (the amber step, at the first division, where the trigger marker points). Now drag **T2** until the readout says the capacitor has closed 63 % of the gap. The readout shows the voltage of the green trace at each cursor, so this is a matter of watching the numbers. The time between the cursors, Δt, is τ.
3. Press **Check my τ against R × C**. It reports how far your Δt is from *R* × *C*, and whether T2 is really at 63 %.
4. Now change *R* to 10 kΩ. The trace stretches past the end of the screen. Press **Autoset**: the scope picks the timebase whose ten divisions hold a whole period again, which is 10 ms per division. Repeat the measurement. Then try *C* = 10 nF and read a time in microseconds. It is always *R* × *C*.
:::

:::deeper[The exponential, properly]
The rule “the rate of change is proportional to what is left” is a differential equation. The current in the resistor is (*V*ₛ − *V*)/*R*, and it is the current that fills the capacitor, *I* = *C* d*V*/d*t*, so

$$\frac{dV}{dt} = \frac{V_s - V}{RC}.$$

Substituting *u* = *V*ₛ − *V* gives d*u*/d*t* = −*u*/τ, whose solution is *u* = *u*₀e^(−*t*/τ). With the capacitor empty at *t* = 0 this is

$$V(t) = V_s\left(1 - e^{-t/\tau}\right), \qquad \tau = RC.$$

At *t* = τ, *V* = *V*ₛ(1 − 1/e) = 0.632 *V*ₛ. The current is *I* = (*V*ₛ/*R*) e^(−*t*/τ): the same exponential, starting at *V*ₛ/*R*. Discharging is the mirror image, *V*(*t*) = *V*₀ e^(−*t*/τ), which is what the scope shows on each falling edge. The rate of change at any moment is (*V*ₛ − *V*)/τ, so the tangent to the curve at the origin hits the final voltage at *t* = τ: that is the “if it kept rising at that rate” picture of the text.
:::

### How long until the input sees a 1?

Digital circuits do not care about 63 %; they care about *thresholds*. A 5 V CMOS input reads a 1 above about 3.5 V (70 % of the supply), and a 0 below about 1.5 V. So the question that matters is the time to reach a given level. Solve the exponential for *t*:

$$t = \tau\,\ln\frac{V_s}{V_s - V}.$$

The logarithm is the inverse of the exponential: it turns “the gap has fallen to this fraction” into “this many time constants”. Some values for a supply of 5 V, charging from zero:

| Level reached | Fraction of 5 V | Time (in τ) |
|---|---|---|
| 1.5 V | 30 % | 0.36 τ |
| 2.5 V | 50 % | 0.69 τ |
| 3.5 V | 70 % | 1.20 τ |
| 4.5 V | 90 % | 2.30 τ |
| 4.95 V | 99 % | 4.6 τ |

Half way takes 0.69 τ, the natural logarithm of 2. Engineers quote the **10–90 % rise time** of an edge, which is 2.30 τ − 0.11 τ = 2.2 τ, and, for buses, the **30–70 % rise time**, which is 0.85 τ. The threshold table says something a designer needs: a signal that is going to be read at 70 % is *late by 1.2 τ*, and one read at 99 % by 4.6 τ. A clock period shorter than a few τ leaves the wire no time to arrive.

## Energy in the tank

A capacitor charged to *V* stores energy, and since the water picture makes it easy, here it is. Lifting the first dribble of charge costs nothing (the level is zero); lifting the last costs *V* per coulomb; on average, the cost is *V*/2 per coulomb, so filling a tank with charge *Q* takes *Q* × *V*/2 joules. With *Q* = *CV* that is

$$E = \tfrac{1}{2}\,C\,V^2.$$

Notice the square: double the voltage and the energy is four times bigger. Our 1000 µF at 5 V holds ½ × 0.001 × 25 = 12.5 mJ, which would lift a gram by about 1.3 cm; at 50 V it holds 1.25 J. That is why the big smoothing capacitor in a power supply is labelled with a maximum voltage, and why one charged to mains voltage can hurt.

There is a second fact that surprises people. Charging a capacitor from a battery of voltage *V* takes a total charge *CV* from the battery, and the battery delivers energy *Q V* = *CV*², which is *twice* what the capacitor stores. The other half, ½*CV*², is turned into heat, and it makes no difference what the resistance is: a large resistor takes a long time and dissipates the same half as a small one does in a moment. (The analog engine’s tests check the energy balance numerically: half stored, half heat.) A wire charged and discharged by a gate therefore costs *CV*² of the supply’s energy in every full cycle, whatever the wire’s resistance, and this will matter at 100 million cycles a second.

## Every wire is a capacitor

Now to the reason for all this in a course about digital circuits. A capacitor needs only two conductors and an insulator. A wire on a circuit board runs a millimetre or so above a sheet of copper that is connected to ground: two conductors and an insulator. A wire on a chip runs above the silicon and beside its neighbours: the same. A gate’s input is the gate of a transistor, which is a small capacitor by construction. **Every wire in a digital circuit is a capacitor between the signal and everything around it,** and every time a gate changes the level of a wire, it has to charge or discharge that capacitor, through its own output resistance, which is the pipe.

Some typical numbers, all approximate (they depend on the technology):

- A wire on a circuit board over a ground plane has about **1 pF per centimetre**.
- The input of a CMOS gate (a 74HC inverter, say) has about **3.5 pF**.:cite[nexperia-74hc04]
- A CMOS output pulls up or down through an output resistance of the order of tens of ohms; **50 Ω** is a fair round number.

So a gate driving a 5 cm trace and two other gates sees about 5 + 7 = 12 pF; call it 10 pF. Drive that through 50 Ω and you get τ = 50 Ω × 10 pF = **0.5 ns**. The output of the gate does not step from 0 V to 5 V: it climbs an exponential, and the next gate sees a level of 3.5 V, its threshold for “1”, 1.2 τ = 0.6 ns after the driving gate began. That is a real delay, and a chip is full of them.

::wire-delay{n="4.3"}

Watch the figure while you change the numbers. The metrics under the scope follow from the rules of the last sections:

- **Delay.** The next gate sees the edge at 50 %, after 0.69 τ = 0.35 ns for our 0.5 ns. Add that to every wire in a path and you have the reason that a processor’s clock cannot be arbitrarily fast.
- **Speed limit.** The wire must settle within each half period, which needs about 5 τ: a period of 10 τ, or a clock of 200 MHz for our wire. Try a 1 kΩ output into 1 nF (a heavily loaded net) and the same rule says 1 MHz.
- **Power.** Each full cycle costs *CV*², which for 10 pF at 5 V is 250 pJ. At 100 MHz that is 250 pJ × 10⁸ = **25 mW for a single wire**. A chip has tens of millions of wires and billions of transistor gates, which is where its watts come from, and it is why every generation of chips lowers its supply voltage (the *V*² term) and shrinks its wires (the *C* term). The formula *P* = *C V*² *f* is the first thing a chip designer computes.

:::key
A wire is not a line on a diagram. It is a capacitor, and every logic level on it is an exponential in progress. Delay ≈ 0.7 *RC*, maximum clock ≈ 1 ÷ (10 *RC*), power = *C V*² *f*: three consequences of the same fact. Chapter 10 comes back to it under the names *propagation delay* and *fan-out*.
:::

## A pull-up makes a slow edge

There is one place in the everyday world of small computers where this bites every engineer sooner or later, and that is the **I²C bus** (“eye-squared-see”), the two-wire connection between a microcontroller and its sensors, memories and displays. Its wires are :term[open-drain]{id=open-drain}: a chip can only *pull the wire down* (with a transistor that connects it to ground), never push it up. So that the wire can go high at all, there is a :term[pull-up resistor]{id=pull-up} from the wire to the supply. When every chip lets go, the resistor pulls the wire up.

Look at what that does to the two edges. The falling edge is made by a transistor, whose resistance when on is a few tens of ohms: fast. The rising edge is made by the pull-up resistor, of a few kilohms, charging the whole capacitance of the bus, which may be 100 pF or more from all the wires and pins: an exponential with τ = *R*ₚ × *C*ₑᵤₛ. A hundred times the resistance is a hundred times the time constant. The figure has both edges.

::pullup-lab{n="4.4"}

For a pull-up of 4.7 kΩ into 100 pF, τ = 0.47 µs and the 30–70 % rise time is 0.85 τ = 0.4 µs, as the figure shows. The I²C specification limits this rise time to **1000 ns** at the standard speed (100 kHz), **300 ns** in fast mode (400 kHz) and **120 ns** in fast-mode plus (1 MHz), with at most 400 pF on the bus.:cite[nxp-i2c] So the same circuit is fine at 100 kHz and too slow for 400 kHz. The rule for the largest pull-up follows at once:

$$R_p \le \frac{t_r}{0.85\,C_b}.$$

At 100 kHz and the full 400 pF, that is 1000 ns ÷ (0.85 × 400 pF) = 2.9 kΩ.

Why not use a tiny pull-up, then? Because when a chip pulls the wire *down*, the current goes through the pull-up resistor and into that chip’s transistor. The specification lets a chip pull only 3 mA with the wire below 0.4 V, so the resistor must be at least (5 V − 0.4 V) ÷ 3 mA = 1.5 kΩ (about 1 kΩ at 3.3 V). Between the two limits lies the design: the pull-up resistor of an I²C bus is picked by the bus capacitance. That is the reason that a bus with too many devices, or a long cable, works at 100 kHz and fails at 400. **I²C is slow because its rising edges are exponentials.** A push-pull (CMOS) driver, which pushes the wire up with a transistor as it pulls it down, has both edges fast, at the cost of not being able to share a wire: the contrast is Chapter 10’s subject, and you can see it by switching the figure’s driver.

## Switch bounce and how to filter it

One more place where a capacitor and a resistor matter, and the one that connects to relays (Chapter 5) and to the counters of Part IV. The contacts of a mechanical switch are springy pieces of metal. When you press a button, they touch, spring apart, touch again, and rattle for a while before they settle: that is :term[contact bounce]{id=contact-bounce}. The rattle lasts from a fraction of a millisecond to several milliseconds for a good switch, and it can be tens of milliseconds for a bad one.:cite[ganssle-debounce] To a person it is one press. To a circuit that reacts to every edge in a microsecond, it is a burst of presses.

The pushbutton in the simulator has a `bounce` option, and the next figure switches it on. The button pulls a line to ground through a pull-up resistor; the amber trace is the line itself, and the green one is the line after an RC low-pass filter, a 10 kΩ resistor and a capacitor you choose. The scope is in single-shot mode, so it waits for the first falling edge, captures one sweep and holds it. Under the scope is the count of presses that a logic input would register.

::debounce-lab{n="4.5"}

:::lab[Kill the bounce]
1. Press the button a few times. The raw line shows two or three bounces for each press, and no two are the same, which is why bounce is such a good source of bugs that only appear some of the time.
2. The green line falls smoothly, following an exponential with τ = 10 kΩ × 1 µF = 10 ms. The short pulses of the bounce are too brief to charge the capacitor by much, so it barely notices them. A logic input would see a single edge.
3. Slide the capacitor down to 10 nF (τ = 0.1 ms) and press again. The filter now follows the bounce, and the count goes back up. Somewhere between, there is a smallest capacitor that works; it is set by how long the longest bounce is compared with τ.
:::

The price of the filter is delay. The line falls to a low level in 1.2 τ, as the table says, which is 12 ms here: nobody notices that for a button, and it also filters the *release*. An RC alone has one more problem: the slowly falling line spends about 10 ms in the forbidden zone between 1.5 V and 3.5 V, and an ordinary logic input is not built to spend that long there (it may chatter, or draw extra current). The standard cure is a gate with a :term[Schmitt trigger]{id=schmitt-trigger} input, which has two thresholds, so that the output switches once, cleanly, and does not switch back until the input has moved a long way the other way. Chapter 10 builds one; here, the figure’s count of presses (which uses thresholds at 1.5 V and 3.5 V) plays that role.

:::programmer[Debouncing in software]
The same idea works without any hardware: accept a change on the input only after it has stayed the same for a while, for instance 10 ms.

```
if raw != state:
    if now - since >= 10 ms: state = raw
else:
    since = now
```

The software version filters as well as the RC, and costs no parts. The RC’s advantage is that it works with no processor at all, on a wire that goes to a counter or a flip-flop, which is why you will see 10 kΩ and 100 nF beside nearly every button in old circuits.
:::

## Under the hood: stepping through time

How does the simulator draw the curves of this chapter? A capacitor is defined by a *derivative*, *I* = *C* d*V*/d*t*, but the solver of Chapter 2 solves algebra: it finds the voltages of a resistor network. The bridge is a trick called a :term[companion model]{id=companion-model}. Chop time into steps of length *h*. Between step *n* and step *n*+1 the derivative is approximately the difference:

$$I_{n+1} = C\,\frac{V_{n+1} - V_n}{h}.$$

This is a *linear* relation between the new current and the new voltage, of the form *I* = *g* *V* + *j*: a resistor of conductance *g* = *C*/*h* in parallel with a current source *j* = −*g* *V*ₙ, which depends only on the *old* voltage. At each step the engine replaces every capacitor by that pair, solves the resistor network as before, stores the new voltages, and repeats. Here is the capacitor’s model, from `src/lib/sim/analog/device.ts`:

```ts
stamp(c: StampContext): void {
  // …
  if (c.method === 'trapezoidal') {
    this.g = (2 * this.C) / c.h;
    this.j = -this.g * this.v - this.i;
  } else {
    this.g = this.C / c.h;
    this.j = -this.g * this.v;
  }
  conductance(c, this.a, this.b, this.g);
  currentSource(c, this.a, this.b, this.j);
}
```

The `else` branch is what we just derived, the **backward Euler** method (“backward” because it uses the slope at the *new* end of the step). The `trapezoidal` branch averages the currents at the two ends of the step, *I*ₙ₊₁ = (2*C*/*h*)(*V*ₙ₊₁ − *V*ₙ) − *I*ₙ, and is more accurate for the same step: its error shrinks with the square of *h*, backward Euler’s only with *h*. So why does the engine not always use the better one? Try both on a stiff step, one where *h* is much bigger than τ:

::method-compare{n="4.6"}

Backward Euler gets the wrong shape but never goes wrong: each step multiplies the error by 1/(1 + *h*/τ), a number between 0 and 1, so it settles smoothly however long the step. The trapezoidal rule multiplies it by (1 − *h*/2τ)/(1 + *h*/2τ). For a step ten times τ that is −2/3: the error flips sign and shrinks by a third each step, so the answer **rings** around the truth. Push *h* higher and the factor goes to −1, and the ringing never dies. The trapezoidal rule is *A-stable* (it never blows up) but not *L-stable* (it does not damp stiff transients); backward Euler is both, but only first-order accurate.:cite[pillage1995]

The engine takes the best of both. After every jump (an edge of a source, a switch flipping) it starts with a step of a nanosecond or less, using backward Euler so that the discontinuity does not ring, then switches to the option chosen by the circuit. From `src/lib/sim/analog/engine.ts`:

```ts
const method: Method = !this.fixed && this.sinceBreak === 0 ? 'euler' : this.method;
const order = method === 'euler' ? 1 : 2;
// …
const r = this.lteRatio(h, method);
const factor = r > 0 ? 0.9 * Math.pow(r, -1 / (order + 1)) : MAX_GROW;
if (r > 1 && h > 2 * hmin) {
  h = Math.max(hmin, h * Math.max(0.2, Math.min(0.9, factor)));
  // …try again with a smaller step
}
```

The second half is **step control**. After each step the engine estimates the error it just made, the *local truncation error*, by comparing the answer with a polynomial fitted through the previous points. If the error is over the tolerance (`r > 1`), the step is thrown away and retried with a smaller one; if it is well under, the next step is bigger, by a factor of at most 4. So the engine takes tiny steps while the capacitor is changing quickly (at an edge), and huge ones when nothing is happening. That is why one second of a circuit with τ = 1 s costs a few hundred steps, and so does one edge of 0.5 ns: the cost is counted in time constants, not seconds. The same estimates keep the recorded points dense where a scope trace bends, which is what Chapter 3’s scope needs.:cite[nagel1975]

## Build it for real

:::real{parts="1000 µF electrolytic capacitor (10 V or more), 10 kΩ resistor, 100 Ω resistor, 470 Ω resistor, red LED, 5 V supply, multimeter, stopwatch (a phone will do), jumper wires"}
Both parts of this experiment are on a breadboard, at 5 V, and both use a capacitor whose time constant you can time with a stopwatch.

**Watch an LED fade.** Charge the 1000 µF capacitor from the 5 V supply through the 100 Ω resistor, which limits the first rush of current. **Mind the polarity:** an electrolytic capacitor has a stripe on the negative side, and it must go to ground; reversed, it can fail noisily. Then disconnect the supply and connect the capacitor across the red LED in series with the 470 Ω resistor. The LED lights and fades over a second or two, as in Figure 4.1 but running backwards: the capacitor discharges through the LED and 470 Ω, with τ ≈ 0.5 s.

**Measure τ with a stopwatch.** Charge the capacitor again, and put the multimeter across it, on the 20 V DC range. Disconnect the supply and connect the 10 kΩ resistor across the capacitor. The voltage now falls with τ = 10 kΩ × 1000 µF = 10 s. Start the stopwatch as you connect the resistor, and stop it when the meter says 1.84 V: 37 % of 5 V, one time constant. Repeat it for 2τ (0.68 V, about 20 s). Do not be surprised if you get 8 or 12 s rather than 10: electrolytic capacitors are guaranteed only to −10 % or +50 %. Notice that the meter’s own 10 MΩ input adds only 0.1 % to the load (Chapter 3), which is why it is safe to use here.
:::

## Exercises

```quiz
q: 'What is the time constant of a 4.7 kΩ resistor and a 22 µF capacitor?'
options:
  - text: '103 ms'
    correct: true
    why: 'τ = R × C = 4700 Ω × 22 × 10⁻⁶ F = 0.1034 s.'
  - text: '103 µs'
    why: 'That would be 22 nF, not 22 µF; the prefixes differ by a factor of a thousand.'
  - text: '0.21 s'
    why: 'That is double: it comes from adding the two values in the wrong units. τ is simply the product.'
```

```quiz
q: 'A 5 V supply charges a 100 nF capacitor through a 10 kΩ resistor (τ = 1 ms). How long until the capacitor reaches 2.5 V?'
options:
  - text: '0.69 ms'
    correct: true
    why: 'Half of the way to 5 V takes t = τ ln 2 = 0.69 τ. Every time to a threshold is τ ln(Vs / (Vs − V)), and here Vs / (Vs − V) = 2.'
  - text: '0.5 ms'
    why: 'That would be true if the voltage rose in a straight line, at its starting rate. The rate falls as the capacitor fills, so it takes longer than half a time constant.'
  - text: '1 ms'
    why: 'After a full time constant the capacitor has reached 63 % (3.16 V), well past 2.5 V.'
```

```quiz
q: 'The same circuit drives a 5 V CMOS input, which reads a 1 above 3.5 V. How long after the switch closes does the input see a 1?'
options:
  - text: '1.20 ms'
    correct: true
    why: 't = τ ln(5 / (5 − 3.5)) = τ ln(3.33) = 1.20 τ = 1.2 ms.'
  - text: '0.7 ms'
    why: 'That is the time to reach 2.5 V, half way. 3.5 V is 70 % of the supply, and takes longer.'
  - text: '5 ms'
    why: 'Five time constants is the time to be within 1 % of 5 V, which is much more than the input needs.'
```

```quiz
q: 'A logic output of 50 Ω drives a wire and inputs with 100 pF in total. What is the highest clock frequency for which the wire settles to 99 % in each half period?'
options:
  - text: 'About 20 MHz'
    correct: true
    why: 'τ = 50 Ω × 100 pF = 5 ns. Settling to 99 % takes 5τ = 25 ns, which is half a period, so the period is 50 ns, or 20 MHz. The rule is f ≈ 1 ÷ (10 RC).'
  - text: 'About 200 MHz'
    why: 'That is the answer for 10 pF. With ten times the capacitance, τ is ten times bigger and the clock ten times slower.'
  - text: 'About 2 MHz'
    why: 'You may have divided by 100 τ rather than 10 τ; half a period holds five time constants, so the whole period is ten.'
```

```quiz
q: 'A 10 pF wire is charged from 0 to 5 V through some resistor, once a microsecond. How much energy does the supply deliver in each charge, and where does it go?'
options:
  - text: '250 pJ, half stored in the wire, and half turned into heat in the resistor.'
    correct: true
    why: 'The supply delivers Q × V = C V² = 10 pF × 25 V² = 250 pJ. The capacitor holds ½CV² = 125 pJ; the other 125 pJ is heat in the resistor, and would be whatever the resistor was.'
  - text: '125 pJ, all stored in the wire.'
    why: 'That is what the capacitor holds, ½CV². The supply delivers twice as much, and the difference is dissipated as the current flows through the resistance.'
  - text: '125 pJ, of which none is wasted if the resistor is small enough.'
    why: 'The heat is independent of R: a smaller resistor charges the capacitor faster, with a bigger current for a shorter time, and the same total dissipation.'
```

```quiz
q: 'You want to debounce a button that bounces for up to 5 ms, with a 10 kΩ resistor. About how big should the capacitor be for τ to equal 10 ms?'
options:
  - text: '1 µF'
    correct: true
    why: 'C = τ ÷ R = 10 ms ÷ 10 kΩ = 1 µF.'
  - text: '100 nF'
    why: 'That gives τ = 1 ms, shorter than a long bounce: the filter would follow the rattle rather than smooth it.'
  - text: '10 µF'
    why: 'That would work, with τ = 100 ms, but the response would feel sluggish, and a slow release could be noticed.'
```

## What’s next

The capacitor stores charge, so it resists changes in *voltage*: the voltage across it cannot jump. There is a mirror-image component that resists changes in *current*. It is a coil of wire, it obeys the same exponential in a different guise (τ = *L* ÷ *R*), and when you put a lump of iron in it, it becomes a magnet that you can switch by electricity. Chapter 5 uses that magnet to move a switch, and the resulting device, the relay, is the first switch in this course that one circuit can use to control another. It is the step from wiring to logic.
