---
number: 10
title: Real gates are analog
summary: Noise margins, fan-out, delay, power, open drain, tri-state and bus contention — what a gate really does when it is not a box with a 0 or a 1 coming out.
duration: About 1½ hours
prerequisites: [cmos, capacitors-and-time]
---

Every chapter since Chapter 6 has treated a gate as a box: a 0 or a 1 goes in, a 0 or a 1 comes out. But the box is made of transistors, and a transistor has never heard of 0 and 1. It knows about voltage. A gate that says “0” holds its output near 0 V, a gate that says “1” holds it near the supply, and in between the world is analog, continuous and slightly messy. This chapter opens the box, because the mess explains why chips are fast or slow, hot or cool, and how they sometimes destroy themselves.

Start with a question that the datasheet does not answer. The datasheet of the 74HC04, a chip with six inverters, promises that on a 5 V supply any input below 1.5 V is read as a 0 and any input above 3.5 V as a 1.:cite[ti-sn74hc04] It is silent about what lies in between.

```quiz
q: 'You set a potentiometer so that the input of a CMOS inverter on a 5 V supply sits at exactly 2.5 V, half way between the rails. What does the output do?'
options:
  - text: It is 0 V, because 2.5 V is not above 3.5 V, so the input is not a 1.
    why: 'The datasheet thresholds are guarantees, not switching points. Nothing forces the output to a rail when the input is between them.'
  - text: It is 5 V, because 2.5 V is below 3.5 V, so the input is not a 1 either way you round it.
    why: 'The same mistake from the other side. At 2.5 V the input lies between 1.5 V and 3.5 V, and there the datasheet promises nothing at all.'
  - text: Somewhere near the middle, and the chip draws extra current while it sits there.
    correct: true
    why: 'A balanced inverter switches at about half the supply, where its curve is steepest, and with the input half way both of its transistors are partly on at once. The output is in the middle too, and a current flows straight through the two transistors, from the supply to ground.'
```

That is the theme of the chapter: **a real gate is an analog circuit that is used in two corners of its range**. We look at the corners (transfer curve and noise margins), at the cost of driving a load (delay and fan-out) and of switching (power), at how outputs share a wire, and at what happens when two of them disagree.

## The transfer curve

Chapter 9 built the CMOS inverter: a p-channel transistor between the output and the supply, an n-channel transistor between the output and ground, and the two gates tied together as the input. Here it is on the analog engine, with an ammeter in the supply line.

::circuit{src="10-real-gates/circuits/inverter.json" n="10.1" title="A CMOS inverter, and what the supply gives it" current=true caption="Click the switch labelled In. The pMOS is on when the input is 0 (output pulled up to 5 V) and the nMOS is on when it is 1 (output pulled down to 0 V). Neither state has a path from the supply to ground, so the ammeter shows next to nothing."}

In each steady state one transistor is on and the other is off, so there is never a conducting path from the supply to ground. The supply gives a few picoamps of leakage in one state and, in the other, half a microamp that the voltmeter itself takes (its 10 MΩ across 5 V). That is the great virtue of CMOS, and it matters when we get to the power bill.

The input does not have to sit at a rail, though. Sweep it slowly from 0 V to 5 V, recording the output at each step, and you have the :term[voltage transfer curve]{id=transfer-curve} (VTC). The figure does exactly that on the analog engine: each point is a full solution of the circuit of an nMOS and a pMOS, and nothing is drawn from a formula.

::transfer-curve{n="10.2" caption="Drag Input Vin along the curve. Then change the pMOS strength, the threshold or the supply and watch VIL and VIH (the copper dots, where the slope is −1) and the noise margins move. The dashed diagonal is Vout = Vin. The noise slider adds interference to a 0 and a 1 sent by an identical gate, and the two boxes say whether the next gate still reads them correctly. The blue area is the current from the supply."}

The curve has three parts. On the left the input is low, the pMOS is on and the output sits at the supply; on the right the input is high and the output sits at 0 V. In the middle, over a narrow range of input, the output falls from one rail to the other. That steep middle is **gain**: a tenth of a volt at the input makes more than a volt at the output. Gain is what restores a degraded signal (Chapter 8), and it is also why the middle is dangerous: an input parked there is amplified into an output that is neither 0 nor 1.

### Four levels, two margins

Digital design does not use the whole curve. It uses four numbers that the maker guarantees, in the manner of a contract.

:::key
**Outputs promise** a level: a gate holding a 1 delivers at least :term[VOH]{id=voh}, and one holding a 0 delivers at most :term[VOL]{id=vol}. **Inputs promise to understand** a level: anything at or above :term[VIH]{id=vih} is read as a 1, and anything at or below :term[VIL]{id=vil} as a 0. Between VIL and VIH nothing is promised.
:::

For the inverter above the natural place for the promise to end is where the slope of the curve is −1. Beyond VIL and VIH the slope is shallower than 1, so a wobble at the input is *smaller* at the output, and noise is squeezed out as a signal passes through gate after gate. Between the two the slope is steeper and noise is amplified. The copper dots in the figure are these points.

The distance between what one gate sends and what the next needs is the :term[noise margin]{id=noise-margin}: how much interference a signal can pick up between two gates and still be read correctly.

::::equation{#noise-margins caption="A gate’s outputs must clear the next gate’s inputs by a margin: the noise that a 1, or a 0, can absorb."}
$$\term{nmh}{NM_H} = V_{OH} - V_{IH},\qquad \term{nml}{NM_L} = V_{IL} - V_{OL}$$

```terms
nmh:
  label: 'NMH, the high noise margin'
  what: How far a 1 can fall between one gate’s output and the next gate’s input before the receiver may misread it.
  why: The weakest 1 a gate may send is VOH, and the weakest 1 a gate must understand is VIH. The difference is the room in between.
  effect: For a 74HC on 5 V with a light load, VOH is at least 4.9 V and VIH is 3.5 V, so NMH is 1.4 V.
nml:
  label: 'NML, the low noise margin'
  what: How far a 0 can rise on its way to the next gate before the receiver may misread it.
  why: The worst 0 a gate may send is VOL, and the highest voltage a gate must still read as 0 is VIL.
  effect: For a 74HC on 5 V, VOL is at most 0.1 V and VIL is 1.5 V, so NML is 1.4 V.
```
::::

The guaranteed numbers are always worse than the ideal curve’s. The ideal inverter of Figure 10.2 has slope −1 at about 2.0 V and 3.0 V, a margin of 2 V on each side. The datasheet says 1.5 V and 3.5 V (it gives them as 30 % and 70 % of the supply), because it must hold for every chip off the production line, at every temperature, on every supply from 2 V to 6 V. The old bipolar family in the portrait below is far worse: TTL guarantees a 0 up to 0.8 V, a 1 from 2.0 V, and outputs of at most 0.4 V and at least 2.4 V, so its margins are only **0.4 V**.

:::deeper[Why slope −1?]
Take a long chain of identical inverters, and let the input of one stage be off its ideal level by a small error *δ*. Its output is then off by about *g*·*δ*, where *g* is the slope of the curve there, and the next stage sees that error in turn. After *k* stages the error is about *g*ᵏ*δ*.

Near the rails |*g*| ≪ 1 and errors die out geometrically: a slightly weak 1 is a perfect 1 after two or three stages. Near the middle |*g*| ≫ 1 and errors grow, driving the signal *away* from the middle to one rail or the other. The border between the two behaviours is |*g*| = 1, which is why VIL and VIH sit where the slope is −1. A signal outside VIL–VIH is one that gain will push to a rail, possibly the wrong one.
:::

:::lab[Find the margins]
Use Figure 10.2.

1. With the balanced inverter at 5 V (pMOS strength 1×, threshold 1 V), read VIL, VIH and the margins: about 2.0 V, 3.0 V and 2.0 V each. Drag Vin to 2.5 V: the supply gives about 5 mA, the current of two transistors that are both on.
2. Make the pMOS four times stronger. The switching point moves *up* to about 3.0 V, because a stronger pMOS keeps winning for longer as the input rises. NML grows to 2.7 V and NMH shrinks to 1.4 V: an unbalanced inverter trades one margin for the other, and its peak current nearly doubles.
3. Set the noise to 1.2 V. Both signals are read correctly, and the receiver’s outputs are 4.99 V and 0.01 V, cleaner than what went in: the gain removed the noise. Raise it to 2.1 V, just beyond the margin. The verdict becomes “forbidden zone”, yet the receiver’s outputs are still 4.5 V and 0.5 V. The gate has not failed; the datasheet has just stopped promising.
4. Change the supply to 1.8 V (the threshold moves to 0.5 V). The margins shrink to 0.8 V: the chip uses far less power, but a 0.8 V glitch is a much bigger fraction of a 1.8 V supply. The chapter returns to this.
:::

### An input nobody drives

Look at the blue strip again: almost no current between the rails and several milliamps in the middle. That explains what Chapters 2 and 3 promised to come back to: **never leave a CMOS input unconnected.** A floating input is a tiny capacitor with nothing to hold its charge, and it drifts with every stray field. With luck it settles at a rail. With less luck it wanders through the middle of the curve, where the gate draws several milliamps and its output flickers. Tie every unused input to the supply or to ground, or give it a level through a resistor (a pull-up or pull-down of 10 kΩ or so).

## What a gate can drive

Now connect the output to something. The something is the input of the next gate, and to the driver **that is a capacitor**: the gate of a transistor is one plate, the channel beneath it is the other, and a wafer-thin oxide is between them. The Chapter 4 numbers apply: about 3.5 pF for a 74HC input,:cite[nexperia-74hc04] which we shall round up to 5 pF to include a few centimetres of wire. Each extra input on a wire is another capacitor in parallel, and capacitors in parallel add.

The number of gate inputs that one output drives is its :term[fan-out]{id=fan-out}. In TTL, whose inputs draw a steady current, fan-out is a limit on current: an output can drive about ten inputs before its low level rises above the guaranteed 0.4 V. CMOS inputs draw no steady current, so its DC fan-out is very large, and the limit is time: the RC of Chapter 4.

```quiz
q: 'A gate’s output is connected to four gate inputs, and its rising edge takes 7 ns. You add eight more inputs to the same wire, so that it drives twelve. Roughly how long does the edge take now?'
options:
  - text: About 7 ns, because CMOS inputs draw no current.
    why: 'They draw no steady current, but each one is a capacitor, and the output must charge all of them through its own resistance.'
  - text: About 18 ns, between two and three times as long.
    correct: true
    why: 'The edge is an exponential with τ = R × C, and capacitances in parallel add. Twelve inputs plus the driver’s own capacitance come to about 65 pF where four made 25 pF, so the edge is 2.6 times as long. (Not three: the driver’s own capacitance is a fixed cost.)'
  - text: About 56 ns, eight times as long.
    why: 'Eight was the number of loads added, not the ratio. The edge scales with the total capacitance: twelve loads against four.'
```

::fan-out{n="10.3" caption="Drag the fan-out. The dashed trace is the output edge with a single load: every added load stretches it. The copper span is the 10–90 % rise time and the blue bar is the delay to half the supply. Compare both with the Chapter 4 estimates underneath."}

The inverter in the figure is a real nMOS/pMOS pair on the analog engine, with an on-resistance of about 100 Ω (a 74HC output is 50–100 Ω, depending on the part), and the loads are capacitors. Two numbers describe every edge:

- The :term[rise time]{id=rise-time} (and the fall time): how long the output takes to travel from 10 % to 90 % of its swing. For an RC edge it is 2.2 *RC*.
- The :term[propagation delay]{id=propagation-delay}: how long after the *input* crosses half the supply the *output* crosses half the supply, given by data sheets as *t*ₚLH (rising output) and *t*ₚHL (falling). For a pure RC it would be 0.69 *RC*.

:::lab[Measure delay against load]
1. Set the fan-out to 1 and read the rise time (about 2.8 ns) and the delay (1.3 ns).
2. Set it to 10, then 20: the rise time is about 15 ns and 28 ns. Each extra load costs about 1.4 ns, close to the Chapter 4 figure for one 5 pF load through 100 Ω, 2.2 × 100 Ω × 5 pF = 1.1 ns.
3. The delay is longer than 0.69 *RC* says: 11.6 ns measured for 20 loads against 7.3 ns. The formula assumes 100 Ω throughout, but the delay is measured from the moment the input is half way, when the driving transistor is only partly on (1.5 V above its threshold instead of 4 V) and its resistance is more like 270 Ω. The RC estimate is a good first guess, not a law.
4. Read the fastest clock at the bottom, from the rule of Chapter 4 (each half period at least 5τ). One load allows about 80 MHz; twenty loads allow 8 MHz.
:::

So **speed is spent on load**. A gate driving one neighbour a millimetre away is fast, and the same gate driving fifty gates across the chip is slow. Designers put buffers, gates with strong outputs, between a weak driver and a heavy load. Chapter 15 builds on this: the delay of a circuit is the sum of the delays of the gates along its path, and a gate has no single “delay”, because it depends on what the gate drives.

## The bill for switching

Chapter 4 showed that charging a wire’s capacitance *C* to the supply *V* and discharging it again takes *C V*² of energy from the supply, half heating the pull-up transistor and half the pull-down, whatever the resistance. Multiply by the cycles per second and add up over every node that switches:

::::equation{#dynamic-power caption="The dynamic power of CMOS logic: the energy of one cycle, times the cycles per second, over every node."}
$$\term{p}{P_{dyn}} = \term{alpha}{\alpha}\,\term{c}{C}\,\term{v}{V^2}\,\term{f}{f}$$

```terms
p:
  label: 'P, the dynamic power'
  what: The average power drawn from the supply by the switching of the logic, in watts.
  why: All of it is turned into heat in the transistors and wires.
  effect: On a chip it is the heat that a heat sink and a fan must remove.
alpha:
  label: 'α, the activity factor'
  what: The fraction of the capacitance that goes through a full charge and discharge in each clock cycle. It is 1 for a clock wire and far less for most logic.
  why: A gate draws energy only when its output changes.
  effect: Halve the activity and the power halves. Clock gating, which stops the clock to idle blocks, makes it small.
c:
  label: 'C, the switched capacitance'
  what: 'The sum of the capacitances of all the nodes that can switch: gates, drains and wires.'
  why: Each node takes C·V of charge from the supply on every rising edge.
  effect: Smaller transistors and shorter wires have less C. That is what shrinking a chip buys.
v:
  label: 'V², the supply voltage squared'
  what: The supply voltage, squared.
  why: The charge is C·V and it is delivered at V, so the energy is their product.
  effect: The strongest lever there is. Halve the supply and the power falls to a quarter.
f:
  label: 'f, the clock frequency'
  what: Cycles per second.
  why: Every cycle costs the same amount.
  effect: Double the clock and the power doubles, if nothing else changes.
```
::::

```quiz
q: 'A chip designed for 5 V is redesigned, with the same logic and the same clock, to run from 3.3 V. Roughly what fraction of the dynamic power does the new version use?'
options:
  - text: 66 %, since 3.3 is two thirds of 5.
    why: 'That would be right if power were proportional to voltage. It is proportional to the *square*: the charge is C·V and it is delivered at V.'
  - text: 44 %.
    correct: true
    why: '(3.3 / 5)² = 0.4356. Cutting the power of a chip by more than half was much of the reason for going from 5 V to 3.3 V.'
  - text: 30 %.
    why: 'That would need a supply of 2.7 V. Try the calculator: 3.3 V gives 44 %.'
```

::power-calculator{n="10.4" caption="Start with the billion-transistor chip: half a femtofarad per transistor, 0.8 V and 3 GHz. Raise the voltage towards 5 V, or the clock, and watch the power run through the 150 W line. The dashed curve is the same chip at 5 V. The other example is one gate driving a wire."}

With the numbers of the first preset (a billion transistors of half a femtofarad, one in ten switching each cycle, 0.8 V, 3 GHz), *P* = 0.1 × 10⁹ × 0.5 fF × (0.8 V)² × 3 GHz ≈ **96 W**, like a real desktop processor. Add 8 W of leakage and, on a die of 1.5 cm², that is about 70 W per square centimetre, some ten times the heat flux of a kitchen hotplate. The same logic on a 5 V supply would draw nearly 4 kW.

:::programmer[Power is a lever for your battery]
Operating systems use the formula directly. *Dynamic voltage and frequency scaling* lowers the clock and the voltage together when there is little to do. The maximum clock is roughly proportional to the voltage, so power goes as *V*² *f*, which is *f*³: half the clock takes an eighth of the power, and since the job takes twice as long, a quarter of the energy. A register that keeps its value costs nothing; the tax is on every bit that flips.
:::

### Leakage and the crowbar

There are two more contributions. The **crowbar current** flows while an input crosses the middle of its range, as in Figure 10.2, and both transistors conduct at once. It is small with fast edges and large with slow ones, a second reason to avoid floating inputs and to send slow signals through a Schmitt trigger (Chapter 4).

The other is :term[leakage]{id=leakage}, a fact about the transistors, not the circuit. A transistor with its gate at 0 V is *off*, but not perfectly: below the threshold the current falls off exponentially, by a factor of ten for every 80–100 mV or so of gate voltage (at best 60 mV, by thermodynamics). So a transistor with a low threshold is fast, and leaks. A billion transistors each leaking 10 nA make 10 A, which at 0.8 V is another 8 W drawn even when the clock stops. Chips switch off the supply to idle blocks (*power gating*) to fight it.

### Why the clock stopped

Power is also where this chapter joins the story of the last fifty years of computing. In 1974 a team at IBM led by Robert Dennard published a paper on very small transistors, with a rule that seemed too good to be true.

:::history{year=1974 title="Dennard scaling" people="Robert Dennard and colleagues, IBM"}
In October 1974 Robert Dennard and five colleagues at IBM’s Thomas J. Watson Research Center published “Design of ion-implanted MOSFET’s with very small physical dimensions”.

They showed that if every dimension of a MOSFET, its supply voltage and its oxide thickness are divided by the same factor *κ*, and the doping is multiplied by *κ*, the electric fields inside stay the same and the device goes on behaving as before, only smaller: *κ* times faster, with a power *κ*² smaller. Since *κ*² times as many fit in the same area, the power of a square millimetre of chip does not change.:cite[dennard1974] Looking back thirty years later, Mark Bohr of Intel described how the paper became the industry’s roadmap:cite[bohr2007]: each generation put twice the transistors on a chip, about 40 % faster, at the same power density.
:::

Check it with the formula. Shrink by *κ*: capacitance falls by *κ* (area by *κ*², oxide thickness by *κ*), voltage by *κ*, and the clock can rise by *κ*. The power of one transistor, *C V*² *f*, goes as (1/*κ*)(1/*κ*²)(*κ*) = 1/*κ*². With *κ*² times as many per unit area, the product is one: the chip does not get hotter.

::dennard-scaling{n="10.5" caption="Slide the generation from 0 to 12: each shrinks the transistors by 1/√2. With the voltage falling in step (green) the power of a square millimetre stays at ×1 for ever. With the voltage stuck (red) and the clock still rising it doubles every generation. With the voltage stuck and the clock frozen (amber) it still grows by 41 % a generation, so more and more of the chip must stay off."}

The rule stopped working around 2005, and the reason is leakage. To keep the fields constant the threshold has to fall with the supply, and a lower threshold means exponentially more leakage. By the early 2000s leakage was a large part of a chip’s power, so thresholds stopped falling, and with them the supply, at around a volt. Shrinking a transistor still made it smaller and cheaper, but no longer made a square millimetre cooler.

The industry had only ever followed the rule loosely: the supply stayed at 5 V into the 1990s, and designers spent the spare power on faster clocks and bigger chips. By the early 2000s the chips dissipated 100 W and more.:cite[bohr2007]

:::history{year=2004 title="The end of Dennard scaling" people="Intel, Herb Sutter"}
In May 2004 Intel cancelled the successor to its Pentium 4, code-named Tejas, a chip reportedly aimed at 7 GHz or more, and turned to chips with several cores.:cite[eetimes-tejas]

Intel’s fastest Pentium 4 ran at 3.8 GHz and was rated at 115 W. From the 4004 (740 kHz, 1971) to that chip the clock had risen about 5,000 times, a factor of about 1.7 every two years; in the twenty years since, the fastest clocks have risen by a factor of about 1.5. In March 2005 the software engineer Herb Sutter published “The free lunch is over”, telling programmers that the speed-up their programs got automatically from each new chip would stop, and that only concurrency could use more transistors.:cite[sutter2005]
:::

The consequences are all around you. Clocks have been 3–5 GHz for twenty years, and the extra transistors go into more cores, bigger caches and special-purpose units, each used only part of the time: much of a modern chip is “dark” at any moment, because with all of it on the chip would melt.

### Why the voltage fell

The supply of a logic chip has fallen from 5 V to a little below 1 V:

| Supply | Roughly when | Why it moved |
|---|---|---|
| 5 V | 1960s to early 1990s | Set by TTL; early CMOS copied it |
| 3.3 V | mid-1990s | Thinner oxide could not survive 5 V; power fell to 44 % |
| 2.5 V, 1.8 V | late 1990s to early 2000s | Each generation cut the oxide again |
| 1.2 V | 2000s | Oxide fields near their limit |
| about 1 V and below | since about 2010 | The floor: leakage and thin margins |

The reasons are three. *Power*, because of the square in *C V*² *f*. *Reliability*, because a gate oxide a few nanometres thick cannot stand more than a few megavolts per centimetre. And a floor: with a threshold of about 0.3 V, needed to keep leakage bearable, a supply of 0.7 V leaves little room for a transistor to be “on”, and as the 1.8 V setting of Figure 10.2 shows, the noise margins shrink in proportion.

## Sharing a wire

Several chips often have to talk over one wire: a bus that the processor, the memory and the peripherals all drive, or an interrupt line that any of a dozen devices can raise. Wiring outputs together fails for a plain CMOS gate, which is **push-pull**: the pMOS drives its output to the supply for a 1 and the nMOS to ground for a 0. Two that disagree short the supply to ground, as we shall see. There are two ways round.

### Open drain

The first is to let the output drive one way only. An :term[open-drain]{id=open-drain} output (*open collector* when the transistor is bipolar) has just the pull-down: an nMOS whose drain goes out to the wire, with no pMOS above it. To say 0 it pulls the wire to ground; to say 1 it lets go. A :term[pull-up resistor]{id=pull-up} to the supply, shared by everyone, provides the high level, as in the I²C bus of Chapter 4. Here two open-drain buffers share a wire.

::circuit{src="10-real-gates/circuits/wired-and.json" n="10.6" title="Open-drain outputs and a pull-up" current=true caption="Click the switches A and B: each is the value that one open-drain buffer wants to send. A 0 turns its transistor on and pulls the line to ground; a 1 turns it off and lets go. The line is high only when every driver has let go, so the LED shows A AND B. Turn on the current and see the milliamp through the pull-up whenever anyone pulls low."}

The wire is high only if *no* driver pulls it down, which is only if *all* the drivers say 1: two open-drain outputs on one wire compute the AND of their outputs with no AND gate. It is called a :term[wired-AND]{id=wired-and}, an AND made by the wiring. (The current dots show the price: whenever someone pulls low, 5 V ÷ 4.7 kΩ = 1.06 mA flows through the resistor into the conducting transistor.) The 74HC03, four NAND gates with open-drain outputs, is made for this.:cite[ti-sn74hc03]

The trick serves every **shared signal**. A computer’s interrupt line is a wired-AND (active low): any device can pull it down, and it stays low until all have let go. The I²C bus does the same on both wires, which also lets a slow device *stretch the clock* by holding the clock line low while it thinks. And devices with different supplies can share a bus, since an open-drain output never pushes the wire above its own supply.:cite[nxp-i2c] The price is speed, as Chapter 4 showed: the resistor makes the rising edge an exponential, which is why I²C runs at 100–400 kHz where a push-pull wire could manage tens of megahertz.

### Tri-state

The second way is to give the output a third state. A :term[tri-state]{id=tri-state} buffer has an *enable* input. Enabled, it drives 0 or 1 like any push-pull gate. Disabled, it disconnects, and its output is **high-impedance**, written Z: neither 0 nor 1, but *nothing*. Several tri-state outputs share a wire on the rule that at most one is enabled at a time. That is a :term[bus]{id=bus}.

::circuit{src="10-real-gates/circuits/tristate-bus.json" n="10.7" title="Two tri-state drivers on one bus" mode="logic" speed=1e-6 caption="Each driver has a data switch and an enable switch. With both enables off the bus is Z (dashed grey). Enable one driver and the bus takes its data. Enable both with different data and the bus becomes X (red and hatched): a fight. Enable both with the same data and nothing happens, so contention matters only when the drivers disagree."}

```quiz
q: 'Both drivers of Figure 10.7 are enabled. Driver 1 sends 1 and driver 2 sends 0. What does the digital engine show on the bus?'
options:
  - text: 0, because a 0 always wins over a 1 (a wired-AND).
    why: 'That is what an open-drain bus would do, with a pull-up. These drivers are push-pull: neither yields.'
  - text: 1, because a 1 always wins over a 0.
    why: 'Nothing wins. Each driver holds the wire firmly towards its own rail.'
  - text: X, unknown.
    correct: true
    why: 'Two drivers, two answers, and no rule to choose. The engine calls the value X and posts a warning. On a real chip the voltage would be somewhere in the middle and a large current would flow.'
```

### Contention

Two enabled drivers that disagree are in :term[bus contention]{id=bus-contention}, and that is a **bug**. In the digital engine the wire becomes X and a warning is posted. On a real board something worse happens, which the analog engine can show with the two outputs built from transistors.

::circuit{src="10-real-gates/circuits/contention.json" n="10.8" title="Two drivers fighting" current=true caption="Both drivers start by sending 1. Click In 2: driver 2 now pulls down while driver 1 pulls up. Watch the bus current, about 1.6 A from the supply through the pMOS, along the bus and down through the nMOS. Then the bond wires burn out. Use the Reset button of the frame to try again."}

When the inputs agree, both outputs are at the same level and nothing flows. When they disagree, the top transistor of one and the bottom transistor of the other are both on, a **short circuit through two transistors and the wire**, limited only by their resistances. In the figure it is about 1.6 A, from 5 V through about 3 Ω. Real outputs are weaker: a 74HC output of 50–100 Ω would carry 25–50 mA in a fight, at or above the ±25 mA that the datasheet allows through a pin,:cite[ti-sn74hc04] so the chip would get warm, the bus would carry garbage and, if it happened every cycle, the chips would fail. A driver for a computer’s memory bus is much stronger, and its contention worse.

The analog engine’s transistors have no rating, so each driver is joined to the bus by a 1 Ω resistor rated at 0.25 W, which stands for the bond wire, the hair of gold or aluminium that joins the silicon to the pin and is often what fuses in a real failure. A current of 1.6 A puts 2.4 W into each, ten times the rating. The engine tracks the heat and, after about a tenth of a second, the wire burns and becomes an open circuit, the current stops, and a message says where and why. That is the magic smoke, and the reason that a bus driver switches off *before* the next one switches on, with a guard time between them.

:::programmer[Contention is a data race in copper]
Two threads writing different values to one variable without a lock give a data race, whose result depends on timing. Two drivers writing different values to one wire without an arbiter give contention, whose result depends on transistor sizes. The tri-state enable is the lock, “at most one driver enabled” is mutual exclusion, and the gap between one driver letting go and the next taking over is the hand-off. The difference is that hardware pays for its races in heat as well as in wrong answers.
:::

:::hood[How the digital engine resolves a wire]
The digital engine (used from Chapter 11 on) has four values for a wire: 0, 1, X (unknown) and Z (nobody is driving). Every output pin is a *driver*, and a net’s value is the *resolution* of its drivers’ values, computed in `src/lib/sim/digital/engine.ts`:

```ts
private resolveMany(n: number, s: number, end: number): number {
  let has0 = false;
  let has1 = false;
  let hasX = false;
  for (let i = s; i < end; i++) {
    const v = this.drvValue[this.netDrvList[i]!];
    if (v === 0) has0 = true;
    else if (v === 1) has1 = true;
    else if (v === LX) hasX = true;
  }
  const contention = has0 && has1;
  ...
  return hasX || contention ? LX : has0 ? 0 : has1 ? 1 : LZ;
}
```

The last line is the whole rule. Any X, or a 0 against a 1, gives X; otherwise whichever known value is present wins; and if every driver says Z, the wire is Z. So Z *yields* to everything, which is what makes a tri-state bus work: a disabled driver has no vote. (A net with a single driver skips this function and takes its driver’s value directly.) The elided lines post the warning you saw, “Contention on net BUS: T1 drives 0 while T2 drives 1. The net is X, and real chips would be fighting (and heating up)”, once when the fight starts, and clear the flag when it ends.

The tri-state buffer itself is three lines (`src/lib/sim/digital/models/gates.ts`):

```ts
evaluate(sim: DigitalSim): void {
  const en = sim.nets[this.en]!;
  const v = en === 1 ? input(sim.nets[this.a]!) : en === 0 ? Z : X;
  sim.drive(this.out, v, this.delay);
}
```

An enable of 1 passes the data (a Z on the data input reads as X: a floating input is unknown), an enable of 0 drives Z, and an unknown enable drives X, since it might be on. What the digital engine cannot say is how a fight ends; the analog engine of Figure 10.8 can, because it has no resolution function at all: the wire’s voltage is whatever Kirchhoff’s current law makes it.
:::

## A family portrait

A **logic family** is a set of gates designed together, with the same supply, the same levels and outputs that can drive each other’s inputs. The table shows them in order of appearance, with typical numbers (rounded, and varying by part and by year).

| Family | Appeared | Supply | Levels (0 / 1) | Gate delay | Power per gate | Notes |
|---|---|---|---|---|---|---|
| RTL, resistor–transistor | 1961 | 3.6 V | ≈ 0.2 V / ≈ 1 V | 12 ns | 12 mW | A 1 is barely above a base–emitter drop: hardly any noise margin, and a fan-out of about 5 |
| DTL, diode–transistor | early 1960s | 5 V | ≈ 0.3 V / 3–4 V | 30 ns | 10 mW | Diodes for the AND, a transistor for the inversion; slow |
| TTL, 7400 series | 1963–66 | 5 V | ≤ 0.4 V / ≥ 2.4 V | 10 ns | 10 mW | Fast enough, cheap, robust: the standard for 25 years |
| ECL, emitter-coupled | 1962 | −5.2 V | ≈ −1.7 V / −0.9 V | 1–2 ns | 25–40 mW | Never saturates, so it is very fast, and very hot |
| NMOS | 1970s | 5 V (later) | TTL-compatible | 10–50 ns | 1 mW | An open-drain gate with a built-in pull-up: dense and cheap |
| CMOS, 74HC | early 1980s | 2–6 V | ≤ 0.1 V / ≥ VCC − 0.1 V | 8 ns | nanowatts at rest | Almost no static power; dynamic power *C V*² *f* |

In every early family some transistor stays on, with a current flowing, to hold one of the two levels, so the power is in milliwatts *per gate*: a chip of a hundred gates would need a fan. CMOS differs in kind, since neither transistor is on in either steady state and its power is dynamic. That single difference is why a billion-transistor chip is possible at all.

The levels also differed, so the families could not always talk. A TTL output high, at 2.4 V, is a guaranteed 1 for another TTL gate (VIH = 2.0 V) but not for a 5 V CMOS gate, whose VIH is 3.5 V. So the 74HC came with a variant, the 74HCT, with TTL thresholds at its inputs. The letters after “74” are the family; a 74HC00 has the same four NAND gates and the same pins as the 7400 of the 1960s, in a very different technology.

:::history{year=1964 title="The 7400 series" people="Texas Instruments, Sylvania"}
In 1963 Sylvania introduced the first standard family of transistor–transistor logic, and the next year Texas Instruments introduced the SN5400 series for military use, in ceramic packages. Its first product was the 5400, four two-input NAND gates in one package.

The version for everyone else, in a cheap plastic dual-in-line package, appeared in 1966 as the SN7400, and quickly took more than half of the logic market.:cite[chm-standard-logic] It gave a designer a documented family of gates, flip-flops, counters and adders with one 5 V supply and compatible levels, in a package that a breadboard could take. The numbers (7400 quad NAND, 7404 hex inverter, 7474 dual flip-flop, 74161 counter, 74283 adder) are still on parts lists today, sixty years and several technologies later, with the same pinouts.
:::

## Build it for real

:::real{parts="74HC04, 74HC03, 10 kΩ potentiometer, 4.7 kΩ resistor, 1 kΩ resistor, LED, multimeter (two if you have them), 5 V USB supply module, breadboard, jumper wires"}
**The transfer curve.** Power the 74HC04 from 5 V (pin 14 to +5 V, pin 7 to ground), tie the inputs of the five inverters you are not using to ground, and wire the 10 kΩ potentiometer between +5 V and ground with its wiper to the input of the sixth (pin 1). Measure the wiper voltage and the output (pin 2) against ground, with two meters or with one that you move, and write down the output for every 0.25 V of input, taking more points where it changes quickly. You will find a curve like Figure 10.2 with a threshold close to half the supply, but *much* steeper, because the ordinary 74HC04 is buffered, with three inverters in a row inside. (The 74HCU04 is the unbuffered kind, with the single stage of the page.) Afterwards put a meter on its mA range in series with the +5 V supply and compare what the chip takes in the middle of the range with what it takes at the ends.

**A wired-AND.** Use the 74HC03. Tie the inputs of the first gate (pins 1 and 2) together and to a jumper that you move between ground and +5 V, do the same for the second gate (pins 4 and 5), and join the two outputs (pins 3 and 6) into one wire. Put the 4.7 kΩ resistor from that wire to +5 V, and an LED with its 1 kΩ resistor from +5 V to the wire, so that the LED is lit when the wire is low. Try every combination and check that the wire is high only if *both* gates let go. (With its inputs tied together a NAND is an inverter, so a gate lets go when its input is 0, and the wire is high only when both inputs are 0.) Measure the low level: it should be a fraction of a volt. Do **not** try the same with a 74HC00, whose outputs are push-pull: joining two outputs at different levels is exactly the bug of Figure 10.8, and it can damage the chip.
:::

## Exercises

```quiz
q: 'A TTL gate guarantees a 1 of at least 2.4 V at its output and reads any input of 2.0 V or more as a 1. It guarantees a 0 of at most 0.4 V and reads anything of 0.8 V or less as a 0. What are its noise margins?'
options:
  - text: 0.4 V for a 1 and 0.4 V for a 0.
    correct: true
    why: 'NMH = VOH − VIH = 2.4 − 2.0 = 0.4 V, and NML = VIL − VOL = 0.8 − 0.4 = 0.4 V. Compare the 1.4 V of a 74HC on 5 V: CMOS survives noise that would confuse TTL.'
  - text: 2.4 V for a 1 and 0.8 V for a 0.
    why: 'Those are levels, not margins. A margin is the difference between an output level and the input level at the receiving end.'
  - text: 1.6 V for a 1 and 0.4 V for a 0.
    why: '1.6 V is VIH − VIL, the width of the forbidden zone, not a margin.'
```

```quiz
q: 'Which of these can safely share a wire with another output of the same kind?'
options:
  - text: Two push-pull outputs, both driving the same data.
    why: 'Only while they agree. During a transition one may switch before the other, and for a few nanoseconds they disagree. A design that relies on the outputs always being equal will burn a chip.'
  - text: Two open-drain outputs and a pull-up resistor.
    correct: true
    why: 'The only level ever driven is 0, and a 1 is what the resistor provides when nobody drives. However many disagree, the result is a 0: the wired-AND. The resistor limits the current to a milliamp or so.'
  - text: Two tri-state outputs, both enabled.
    why: 'Only with the same data, which is a fight waiting to happen. Tri-state outputs share a wire only if at most one is enabled at a time.'
```

```bug
title: 'The shared bus'
prompt: 'A designer wants two chips, A and B, to take turns driving a data line to a third chip, which listens. The design notes are below. Click the first line that makes the design unsafe.'
lines:
  - 'Chip A and chip B each have a push-pull output stage with an enable input.'
  - 'The outputs are connected to the same wire, which goes to the listener’s input.'
  - 'A’s enable is driven by a control signal S, and B’s enable by the inverse of S, through an inverter.'
  - 'Because S and its inverse are always opposite, exactly one chip is enabled at any time, so there is never any contention.'
  - 'When S changes, A is switched off and B on, and the listener sees B’s data.'
wrong: 3
why: 'An inverter has a delay. When S rises, A is enabled at once, but B’s enable (the inverse of S) falls only after the inverter’s delay, so for a few nanoseconds both drivers are enabled. If their data differ, the bus is in contention with a large current. “Always opposite” is true only after the inverter has settled. Real designs make the two enables *non-overlapping*: turn one driver off, wait, and only then turn the other on.'
notes:
  '0': 'Fine: a push-pull output with an enable is a tri-state buffer.'
  '2': 'A reasonable way to make the enables opposite. Read the next line for what it does not guarantee.'
```

:::challenge[Budget a chip]
A phone chip has 10 billion transistors, each with 0.3 fF of switched capacitance, on a 0.7 V supply and a 2 GHz clock. If all of them switched in every cycle (α = 1), how much power would it draw? The phone’s thermal budget is about 5 W: what activity factor fits?

*Answer.* *N C V*² *f* = 10¹⁰ × 0.3 × 10⁻¹⁵ F × (0.7 V)² × 2 × 10⁹ Hz ≈ 2,900 W. For 5 W, α = 5 ÷ 2,940 ≈ 0.0017: about one transistor in six hundred may switch in each cycle. The rest is idle logic with its clock gated, or memory, or *dark silicon*: transistors that are there for the moment they are needed, and off the rest of the time.
:::

## What’s next

We now know what is under a gate: an analog circuit, used in two corners, with margins that shrink with the supply, a delay that grows with the load, a power bill that grows with the frequency and the square of the voltage, and rules for sharing a wire. From here on we can treat a gate as a box again, but the box has a datasheet, and its contents come back: as glitches and hazards in Chapter 15, as metastability in Chapter 16, as setup and hold times in Chapter 17, as leaking DRAM in Chapter 20.

Chapter 11 begins Part III, where the questions are about logic alone: what a circuit of gates computes, when two circuits are the same, and how few kinds of gate we really need. The answer is Boolean algebra, the algebra that Shannon found in his relays.
