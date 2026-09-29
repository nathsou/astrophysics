---
number: 3
title: 'Interlude: the bench'
summary: "How to measure a circuit without wrecking it. A multimeter, a bench supply with a current limit, an oscilloscope with a function generator, and a logic probe: what each one does, how each one disturbs the circuit, and the classic mistakes."
duration: About 1½ hours
prerequisites: [ohms-law]
---

A circuit is invisible. You cannot see that a wire is at 5 V and its neighbour at 0 V, or that a current of 3 mA is running through a resistor, or that a signal has just glitched for 20 nanoseconds. A programmer who wants to know what a program is doing has `print`, a debugger and a profiler. A circuit builder has **instruments**, and there are five that this course, and most electronics benches, live on. From here on the figures let you use them, and the physical experiments in the *Build it for real* boxes call for the first of them, a multimeter, which costs about the price of a sandwich.

This chapter is a tour. It shows what each instrument measures, how it is connected, what it does to the circuit it measures (every instrument is a part of the circuit, and none is perfect), and the mistake that each one invites. The chapter has one flagship, a guided lab: you will measure a voltage divider with a multimeter, and then find a broken part in a dead circuit with nothing but the meter.

| Instrument | How it goes in | The classic mistake |
|---|---|---|
| Multimeter, volts | *across* the part (in parallel) | disturbing a high-resistance circuit |
| Multimeter, amps | *in the path* (in series) | across a battery: a blown fuse |
| Multimeter, ohms | across the part, *power off* | measuring a live circuit |
| Bench supply | to the circuit’s supply terminals | connecting a load before setting the limit |
| Oscilloscope | probe on the point, clip on ground | an untriggered display; a clip on a live point |
| Logic probe | tip on the point | trusting it between the two levels |

## The multimeter

A :term[multimeter]{id=multimeter} is a voltmeter, an ammeter and an ohmmeter in one box, with a dial that says which of them you want. It has two leads: a **black** one that goes into the socket marked COM, and a **red** one that goes into a socket for the quantity you want. What you do with the probes at the other ends depends on what you measure, and the rule is different for each.

### Voltage: across the part

A voltage is a difference between two points (Chapter 1), so a voltmeter needs *two* points: it reads the voltage of the point under the red probe, *relative to* the point under the black one. Put the probes on either side of the part you care about, in **parallel** with it. The circuit does not have to be interrupted.

::circuit{src="03-the-bench/circuits/meter-voltage.json" n="3.1" title="A voltmeter goes across the part" caption="A 9 V battery across R1 = 6 kΩ and R2 = 3 kΩ. The voltmeter is across R2 and reads 3 V, a third of 9 V, as the divider formula of Chapter 2 says. Nothing in the circuit had to be broken to put it there."}

Swap the probes and the reading changes sign: −3 V. That is not a fault, only the meter saying that the red probe is at the *lower* voltage.

A good voltmeter draws almost no current from what it measures: a typical digital meter presents a resistance of about **10 MΩ** across its probes.:cite[fluke-87v] Across R2, that is 3 kΩ in parallel with 10 MΩ, which is 2.999 kΩ: the meter has changed the circuit by a hair. Keep that number in mind, because it will not always be a hair.

### Current: in the path

Current is different. Voltage is between two points; current is *through* a wire, so the only way to measure it is to make the current flow through the meter. You must **break the circuit and put the meter in the gap**, in **series** with the rest. An ammeter is almost a piece of wire: the one in the simulator has 0.1 Ω, and a real meter on its mA range has a fraction of an ohm to a few ohms. The voltage lost across it, called its *burden voltage*, is small: 0.1 Ω × 1 mA = 0.1 mV.

::circuit{src="03-the-bench/circuits/meter-current.json" n="3.2" title="An ammeter goes in the path" caption="The same loop, with the ammeter in series. 9 V through 9 kΩ is 1 mA, and the meter reads it. The current is the same at every point of a series loop, so it does not matter where in the loop the meter goes."}

Now the mistake. Take a meter set to the current range and put its probes *across* a battery, as you would to measure a voltage. You have connected a 0.1 Ω wire across a source that can deliver a great deal of current: in our model, 9 V ÷ (0.1 Ω + 0.2 Ω) = **30 A**, and a real 9 V battery can still supply several amps. The meter’s current input is protected by a **fuse** rated for a few hundred milliamps (the 440 mA of a Fluke 87V is typical), which blows in a fraction of a second, and the meter then reads “0.000” on every current range until you open it and replace the fuse. On a cheap meter without a fuse on the amps input, something inside burns. Every electronics teacher has done it, and the tour below lets you do it once without consequences.

The rule to keep: **an ammeter is a wire, so it goes where you would put a wire; a voltmeter is a gap, so it goes where you would put a gap**. Also: read the socket the red lead is in. Moving the dial from V to A without moving the lead from the V socket to the A socket is the second version of the same mistake.

### Resistance, and why the power must be off

To measure resistance the meter runs a small current of its own through the part (typically a fraction of a milliamp on the low ranges) and measures the voltage that results, *R* = *V* ÷ *I*. That only works if the meter’s current is the *only* current. So:

1. Measure resistance only in a circuit with the **power off**. In a live circuit the circuit’s own voltages drive currents through the part, far larger than the meter’s, and the reading is nonsense (and can damage the meter).
2. Even with the power off, the meter finds every path between its probes. A resistor still soldered in a circuit is measured in parallel with whatever else connects its two ends, and the reading is usually lower than the marking. For an accurate value, lift one leg.
3. An open circuit reads **OL** (“over limit”) or **1**, meaning more resistance than the range can show. It is the meter’s way of saying “infinity”.

The :term[continuity]{id=continuity} range is the same measurement with a beeper: it beeps if the resistance is below a threshold of some tens of ohms. It is the fastest way to find out whether two points are joined (a wire, a closed switch, a good fuse) or not, and it is what you use to check a breadboard.

### The meter is part of the circuit

We said that a voltmeter reads 10 MΩ. So let us make it matter. The divider below is made of two equal resistors and a 10 V source, so the middle should be at exactly 5 V. Before you look, work it out for the case of *huge* resistors:

```quiz
q: 'Two 10 MΩ resistors divide 10 V, so the middle point is at 5 V. You measure it with a digital multimeter whose input resistance is 10 MΩ. What does it read?'
options:
  - text: '5.00 V: a meter reads what is there.'
    why: 'It would, if the meter drew no current. But a 10 MΩ input is a 10 MΩ resistor across the lower half of the divider, and it is not negligible next to another 10 MΩ.'
  - text: '3.33 V'
    correct: true
    why: 'The meter is in parallel with the lower resistor: 10 MΩ ∥ 10 MΩ = 5 MΩ. The divider becomes 10 MΩ over 5 MΩ, so the middle is at 10 V × 5 ÷ (10 + 5) = 3.33 V.'
  - text: '0 V: the meter shorts the divider out.'
    why: 'A meter of 10 MΩ is not a short. It only changes the ratio.'
```

::meter-loading{n="3.3"}

This is the same effect as in any measurement: **looking at something disturbs it**. A voltmeter that draws current changes the voltage it reads, and the error is big when the circuit’s own resistance (here 5 MΩ, the two resistors in parallel) is comparable to the meter’s. Two rules:

- For less than 1 % error, the meter’s resistance must be at least about 100 times that of the point being measured. A 10 MΩ meter is fine for anything below about 100 kΩ, and has trouble above 1 MΩ.
- Old analogue meters had a resistance of 20 kΩ per volt of range (200 kΩ on the 10 V range), and were much worse. Bench meters often offer a *high-Z* setting of 10 GΩ and above for exactly this reason.

The same thing happens with every instrument, and with the humble `print` statement too: a debugging `print` changes the timing of the program it is watching. What matters is knowing by how much.

### The flagship: a tour of the multimeter

Time to use one. The circuit in the tour is a 9 V battery with a power switch, then a column of parts down to ground. The meter (its dial, its LCD and its two probes) is the box on the right; the circles labelled with letters are **test points**. Click a test point or use the boxes to place the probes. The meter is *simulated with the circuit*: the reading you get has already been affected by the meter.

::bench-tour{n="3.4"}

:::lab[What to notice]
1. **Voltage.** The drops across R1 and R2 add up to the battery’s voltage, and the smaller resistor gets the smaller share. Try putting the probes the wrong way round.
2. **Current.** A series loop has one current. Then, deliberately, read amps across the battery. You should see the fuse blow. Press *Replace fuse* and carry on.
3. **Resistance.** Switch the power on and try the ohms range. The meter says ERR: the simulator is telling you that the reading is meaningless. On a real meter you would get numbers.
4. **The fault.** Use whichever method suits you: with power on, the open resistor is the only part with a voltage across it; with the power off, it is the only one that reads OL. Then press **New fault** and do it again with another resistor. With power on you may notice that the reading across the open part is a little below the battery’s 9 V: the meter itself lets a microamp trickle through the LED, which sits at about 1.4 V at that current.
:::

## The bench supply

Batteries are inconvenient to change and to adjust. A bench :term[power supply]{id=bench-supply} is a box that turns the mains into a voltage that you set with a knob, and it is what powers experiments. It has a second knob, and this one is the important one for the beginner: a :term[current limit]{id=current-limit}.

The supply has two modes:

- **Constant voltage (CV).** The normal mode. The supply holds the voltage you set, whatever the load draws, provided the current is below the limit. This is what a battery does.
- **Constant current (CC).** If the load tries to draw *more* than the limit, the supply stops holding the voltage and instead holds the current at the limit, letting its voltage fall as far as necessary. A lamp on the front panel shows which mode is active.

A current limit is a circuit breaker with a soft landing: instead of tripping, the supply politely refuses to give more. Which is why the procedure for connecting anything is: **set the voltage, set the limit, and only then connect the load**. With a short circuit across the leads (or a wire) the supply goes into CC mode at once; turn the current knob until the ammeter reads the limit you want, then remove the wire. It takes ten seconds, and a mistake in the wiring of the circuit then costs you a lit CC lamp instead of a burnt part.

::supply-lab{n="3.5"}

:::lab[LEDs and current limits]
1. Choose **LED, no resistor**, connect it with the limit at 500 mA, and watch it die. A red LED is rated for about 30 mA, and an ideal 5 V source across it is a very large overvoltage: the current through the diode rises exponentially with voltage (Chapter 7).
2. Set the limit to 20 mA and connect again. The supply goes into CC mode: the voltage sags to about 1.9 V, which is the LED’s forward voltage, and the LED lights at a current you chose. **You have turned an overvoltage into a lit LED by turning a knob.**
3. Choose **1 kΩ resistor** and limit 1 mA. The resistor would take 5 mA at 5 V, so the supply’s voltage falls to 1 V: *V* = *I* × *R*, with the current fixed and the voltage left to find. In CC mode, the load decides the voltage.
4. Choose **Short circuit**. In CV mode the voltage would be zero and the current infinite; in CC mode the output collapses to a few millivolts at the limit.
:::

## Ground: measuring relative to something

Every voltage in this chapter has been a difference between the red and the black probe, and we have used the word :term[ground]{id=ground} for the reference point from which everything else is measured. It matters more than it looks. **A voltage is a difference between two points, and the “voltage at a point” is a shorthand for the difference between that point and ground.** The figure shows what that means. It is the divider of Figure 3.1 again; move the ground symbol.

::reference-lab{n="3.6"}

Move the ground to the middle and the top of the divider is at +6 V and the bottom at −3 V. Nothing in the circuit has changed: the same current flows, the same 6 V is across R1 and 3 V across R2. What changed is where you started counting. It is like altitude: a mountain’s height depends on whether you count from sea level or the valley floor, but the climb from one point on it to another does not.

Two consequences follow.

- **In a schematic, ground is a choice.** The supplies in this chapter and every logic circuit in this course put ground at the lowest voltage, so that everything else is positive, but there is nothing to force that.
- **An oscilloscope is different.** Its ground clip is connected, through the instrument, to the earth of the mains socket. Clip it to a point of a circuit that is not at ground potential and you short that point to earth through the scope. The habit is to clip the ground lead to the circuit’s ground and put the probe tip on the point being measured, always.

## The oscilloscope

A voltmeter shows the value of a voltage *now*, as a number. Many voltages in electronics change too fast for that: a clock ticks a million times a second, a bus carries data in bursts, a switch bounces for a millisecond. An :term[oscilloscope]{id=oscilloscope} draws a graph of voltage against time, fast enough to see all that. The vertical axis is the voltage, the horizontal axis is time, and the trace crosses the screen from left to right, repeatedly, so that a repeating signal appears to stand still.

The screen is divided into a grid of **divisions**, ten across and eight up. Three knobs matter most:

- :term[Timebase]{id=timebase} (seconds per division): the horizontal scale. At 1 ms/div, the ten divisions across the screen show 10 ms.
- **Volts per division**: the vertical scale. At 2 V/div, the eight divisions up show 16 V.
- :term[Trigger]{id=trigger}: the knob that makes a repeating signal stand still, and the one that beginners find hardest.

To try them you need a signal, and the instrument that makes one is the :term[function generator]{id=function-generator}: a box with a knob for the shape of the wave (square, sine or triangle), the frequency, the amplitude and an offset. It is a source of the kind the analog engine calls `siggen`. The figure below wires one to a scope.

```quiz
q: 'A 1 kHz square wave is on the scope. The scope is set to a timebase of 0.5 ms/div and its trigger is switched OFF: each sweep starts as soon as the last one finishes. What does the display show?'
options:
  - text: 'A stable picture of five periods.'
    why: 'That is what a triggered scope would show. Without a trigger nothing ties the start of the sweep to the signal.'
  - text: 'A smeared, unstable picture: the edges appear at a different place on each sweep.'
    correct: true
    why: 'Each sweep begins wherever the wave happens to be at that moment, so the successive sweeps do not line up. On a real scope, overlapping traces of every phase of the wave look like a blur.'
  - text: 'Nothing: the scope does not draw without a trigger.'
    why: 'A scope in free-run mode draws all the time. It just draws each sweep starting at a random phase.'
```

::scope-lab{n="3.7"}

The screen starts with the trigger off, and you can see the problem. The scope sweeps a trace across the screen in 5 ms, then flies back and sweeps again. The signal has a period of 1 ms, and the scope has no idea where in that period each sweep begins, so every sweep draws the square wave shifted in time from the last. The brighter trace is the newest sweep; the fainter ones behind it are the afterglow of earlier sweeps, just as on a real analogue scope, and together they form a smear.

The trigger cures it. It watches one signal, waits for it to cross a level (the **trigger level**) in one direction (the **slope**, rising or falling), and starts each sweep at that moment. Now every sweep starts at the same point of the wave, so the sweeps lie on top of one another and the picture is still. The marker at the top of the screen shows where on the screen the trigger point is, and the arrow at the right edge is the level.

:::programmer[The trigger is a conditional breakpoint]
A debugger lets you run a program at full speed and stop when a condition is true: `break if x > 5`. A scope’s trigger is the same idea for a signal: capture (start the sweep) when the voltage crosses 2.5 V going up. Without it you see a random slice of history; with it you see “what happened around that event”, and you can see what came *before* it too, because the trigger point sits a division or two in from the left edge (pre-trigger). The **single** mode is the equivalent of “break once”: wait for the condition, capture a screen of history around it, and hold.
:::

:::lab[Learn the scope]
1. **Free run.** With the trigger *Off*, find the smear. Change the frequency: nothing improves, because the problem is not the signal.
2. **Trigger.** Set the mode to *Auto*, slope *Rising*, level 2.5 V. The picture locks. Change the level to 0.5 V: the trigger point moves, and you can see the edge at the marker. Change it to 6 V, above the signal: nothing crosses, and *Auto* falls back to free-run so that you still see something (the status on the screen says *Auto*, rather than *Trig’d*). A scope that showed nothing when it lost its trigger would look broken.
3. **Timebase.** At 0.5 ms/div the screen shows five periods. Turn it to 0.1 ms/div and the ten divisions cover 1 ms, exactly one period. Turn it to 10 ms/div and the square wave becomes a dense grey band: there are 10 periods in every division, too close to resolve.
4. **Volts per division.** Take the amplitude to 1 V and the scale to 0.5 V/div. The wave fills the screen. It is the same trace with a magnifier.
5. **Cursors.** Switch the cursors on. Put T1 on one rising edge and T2 on the next: Δt is the period (1 ms) and 1/Δt the frequency (1 kHz). Put V1 on the low level and V2 on the high one: ΔV is the peak-to-peak amplitude. Cursors are how you read numbers off a graph that a scope draws.
6. **Waveforms.** Switch to a sine wave and a triangle. Now the trigger level matters visibly: a sine crosses every level at a different phase of its cycle, so moving the level slides the whole wave to the left or the right. The level chooses *where in the wave* the sweep starts.
:::

### Probes are capacitors

One more thing that connects this chapter to the next. The lead of a scope is a long piece of shielded wire, and the probe tip you touch to a circuit adds a capacitance to it, in parallel with the resistance of the input. A typical 10× probe has a resistance of 10 MΩ and a capacitance of about 10 to 15 pF.:cite[horowitz-hill2015] The 10 MΩ is kind to the circuit for the reason you have just seen; the capacitance is not, for a reason you will see in Chapter 4: 10 pF on a wire that a gate drives through 50 Ω adds a time constant of half a nanosecond to every edge. The scope is a part of the circuit, and here it makes edges slower than they are.

:::history{year=1897 title="Braun’s cathode-ray tube" people="Karl Ferdinand Braun" source="Sources: Braun (1897); Nobel Prize (1909); Thomson (1897)."}
Until digital scopes took over, every oscilloscope screen was a descendant of a glass tube built by a professor at Strasbourg: a beam of electrons that you can steer with a current.

Karl Ferdinand Braun, a German physicist who worked on electrical oscillations, wanted to see what a rapidly alternating current was doing. In 1897 he published a paper, “On a method for the demonstration and study of the time course of variable currents”, with a tube that has since carried his name.:cite[braun1897] The tube was a cathode-ray tube: a glass bulb from which the air was pumped out, with a **cold cathode** that shot a beam of electrons down the tube towards a screen coated with a material that glows where the beam strikes it. The beam passed through a small hole to make it narrow, and then between coils. The current to be studied flowed through the coils, and its magnetic field pushed the beam sideways, so that the glowing spot on the screen moved to and fro with the current. To see the way it varied *in time*, Braun looked at the screen in a rotating mirror, which drew the spot out into a curve.

It was the same year that J. J. Thomson showed that the “rays” in such tubes were streams of particles a thousand times lighter than the lightest atom, the electrons.:cite[thomson1897] Braun’s tube turned them into a pen. Later tubes replaced the mirror with a second deflection that swept the beam across the screen at a steady speed, the *time base* that you set in seconds per division, and heated the cathode so that the beam was brighter. Braun shared the 1909 Nobel Prize in Physics with Guglielmo Marconi for their contributions to wireless telegraphy.:cite[nobel-braun] His tube, in improved forms, went on to become the oscilloscope, the radar display and the television set.
:::

:::hood[How the simulated scope gets its samples]
A real digital scope samples the input at a fixed rate into memory, say a billion samples a second. Our scope is fed by the analog engine, which does *not* sample at a fixed rate: it takes a step of whatever size the circuit needs (Chapter 4 explains how), tiny at an edge and large on a plateau. The engine’s `watch()` method returns a *recorder* that stores the voltage of the nets you ask for at *every* accepted step, so nothing that the engine computed is thrown away:

```ts
// src/lib/sim/analog/engine.ts, at the end of every accepted step
for (const r of this.recorders) r.push(tNew, (net) => this.voltage(net));

watch(nets: number[]): Recorder {
  const r = new SampleRecorder(nets, () => this.t, (rec) => this.recorders.delete(rec));
  this.recorders.add(r);
  r.push(this.t, (net) => this.voltage(net));
  return r;
}
```

That is an *irregular* recording, and a screen needs a value for each pixel column. So the scope **resamples** it: 500 columns across the ten divisions, and for each column the smallest and the largest value the signal takes inside it. This is the **peak-detect** mode of a real scope, and it is why a glitch narrower than a pixel still shows up as a vertical stroke. From `content/chapters/03-the-bench/widgets/scope-model.ts`:

```ts
for (let c = 0; c < cols; c++) {
  const a = t0 + c * dt;
  const b = a + dt;
  // … (skip columns before the first or after the last recorded point)
  let lo = valueAt(times, values, lo0);   // the signal at the column's left edge
  let hi = lo;
  while (j < n && times[j]! <= b) {       // every recorded point inside the column
    if (times[j]! > a) {
      const v = values[j]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    j++;
  }
  const vb = valueAt(times, values, hi0); // and at its right edge
  if (vb < lo) lo = vb;
  if (vb > hi) hi = vb;
  min[c] = lo;
  max[c] = hi;
}
```

The trigger uses the same recording. `findCrossing` looks for the first pair of consecutive points that straddle the trigger level, and *interpolates* between them, so the trigger point is exact even when the recorded points are far apart, and the sweep starts a fixed time before that instant (the pre-trigger). Each finished sweep is kept as a min/max envelope, and the last eight are drawn with fading brightness, which is the afterglow. When the trigger is off, `process()` starts each sweep where the last one ended, plus a short “retrace”: that is what makes the smear.

One last detail: the page cannot afford to simulate a real second of a nanosecond circuit in every 16 ms frame, nor wait 100 seconds for a sweep of 10 s/div. So each frame advances the engine by at most four sweeps’ worth of simulated time, and slow sweeps run faster than real time so that none takes more than about two seconds. For circuits in nanoseconds the scope also takes a `timeScale`: it simulates a circuit with a million times the capacitance and divides the times by a million. The shape of an RC curve depends only on *t*/*RC*, so nothing looks different, and Chapter 4’s “wire” figure needs no picosecond steps.
:::

## The logic probe

The cheapest instrument on the bench is a **logic probe**: a pen with a pointed tip and three lamps. It knows one thing about the point you touch: is it a *high*, a *low*, or *pulsing*? It compares the voltage on its tip with two thresholds. Above about 70 % of the supply is HIGH, below about 30 % is LOW, and in between it shows nothing at all, which is itself a piece of information: the point is neither, and something is wrong. A pulse stretcher inside lights the PULSE lamp for a tenth of a second after any edge, so that even a one-microsecond pulse gives a visible flash.

::logic-probe{n="3.8"}

Try each of the three cases. A voltage of 2.5 V is exactly the kind of level that a logic circuit is meant never to have, and the reason is the same as the probe’s: an input that sees it can decide either way, or both. Chapter 10 will explore what that does to real gates. A wire connected to nothing, a *floating* input, is no better: it can float to either level, and it picks up any noise nearby. The probe shows nothing there, and the habit of tying unused inputs to a level starts here.

The other logic instrument is the **logic analyser**, a multi-channel version of the probe that records many wires at once and shows them as waveforms, and can decode the protocols on them. Chapter 24 uses one, on a UART.

## Build it for real

:::real{parts="a digital multimeter (a £10–£20 one will do), a 9 V battery, two resistors of different values, a breadboard, jumper wires"}
A cheap multimeter is the first tool to buy, and it is worth understanding its dial. Whatever the make, the positions are much the same:

| Dial position | What it does |
|---|---|
| **OFF** | Everything disconnected. Leave the dial here when you have finished, or the battery goes flat. |
| **DC volts**: V with a straight line (⎓) | Measures the voltage between the probes, in parallel. Choose a range *above* the voltage you expect (or **auto**). All the voltages in this course are DC. |
| **AC volts**: V with a wavy line (~) | For mains and audio. You will not need it here, and mains is not for beginners. |
| **Ohms**: Ω | Measures resistance, with the power off. |
| **Continuity and diode**: a diode symbol and sound waves | Beeps when the resistance between the probes is low. The diode test shows the forward voltage of a diode (Chapter 7). |
| **Amps**: A or mA, with ⎓ | Measures current *in series*. It uses a *different socket* for the red lead, and a fuse. |

Three sockets: **COM** (the black lead, always), **VΩmA** (the red lead for volts, ohms and small currents), and **10 A** (the red lead for big currents). If you have the red lead in a current socket and the dial on volts, the meter will happily short whatever you touch. Get into the habit of returning the red lead to the volts socket as soon as you have measured a current.

Try three things. Measure the battery: red to +, black to −, on the 20 V range. You should read 9.3 V or so for a new one. Measure a resistor, out of the circuit, on a range above its marked value, and compare it with the marking (5 % of the marked value is normal: gold means 5 %). Then build the divider of Figure 3.1 on the breadboard, measure the two voltages, and check that they add up.
:::

## Exercises

```quiz
q: 'You want to know how much current the LED of a circuit draws. Where does the multimeter go, and how is the dial set?'
options:
  - text: 'In series with the LED: break the circuit, put the meter in the gap, red lead in the current socket, dial on A.'
    correct: true
    why: 'Current flows through the meter, so the meter has to be in the path. Then return the red lead to the volts socket.'
  - text: 'Across the LED, dial on A.'
    why: 'That puts a 0.1 Ω wire across the LED: nearly all the current takes the meter route, the LED goes out, and if the LED is across a supply the fuse can blow.'
  - text: 'Across the LED, dial on V: the meter converts volts to amps.'
    why: 'A voltmeter reads the voltage across the LED (about 2 V), which says almost nothing about its current: an LED’s voltage hardly changes between 1 mA and 20 mA.'
```

```quiz
q: 'A series chain of R1, R2, R3 and an LED, on 9 V, does not light. With the power on, you measure across each part: R1 reads 0.00 V, R2 reads 8.9 V, R3 reads 0.00 V, the LED reads 0.00 V. Which part has failed?'
options:
  - text: 'R2, which is open-circuit.'
    correct: true
    why: 'If R2 were fine, some current would flow round the loop and lower part would drop some voltage. Nothing flows, so the parts that work drop nothing; the whole battery voltage appears across the one place where the loop is broken.'
  - text: 'R1 and R3, which read zero.'
    why: 'Zero volts across a resistor means no current is flowing through it, not that it is faulty. In a broken series loop every good part reads zero.'
  - text: 'The LED, which reads zero.'
    why: 'A dead LED that was open would show the battery voltage across itself; zero means the LED carries no current, because something else is blocking it.'
```

```quiz
q: 'You measure a resistor marked 4.7 kΩ while it is soldered into a working, switched-on circuit. The meter, on the ohms range, reads 1.2 kΩ. What is the best conclusion?'
options:
  - text: 'The reading means nothing: the circuit was powered, and there are other paths in parallel. Switch off, lift one leg of the resistor and measure again.'
    correct: true
    why: 'The meter’s own test current is tiny compared with the circuit’s. And with the power off, the resistor would still be measured in parallel with everything that connects its two ends, which lowers the reading.'
  - text: 'The resistor has drifted and is now 1.2 kΩ.'
    why: 'Resistors do drift, but by a few per cent, not by a factor of four.'
  - text: 'The meter is faulty.'
    why: 'The meter is probably fine. It measured what it was connected to: a live circuit.'
```

```quiz
q: 'A meter of 10 MΩ input resistance measures the middle of a divider of two 100 kΩ resistors from 10 V. About how much smaller than 5 V does it read?'
options:
  - text: 'About 0.5 % smaller (4.975 V).'
    correct: true
    why: 'The meter in parallel with the lower 100 kΩ gives 99.0 kΩ, and the divider is 100 kΩ over 99.0 kΩ: 10 V × 99.0 ÷ 199.0 = 4.975 V. The rule: the error is about R_source ÷ R_meter = 50 kΩ ÷ 10 MΩ = 0.5 %.'
  - text: 'About 33 % smaller.'
    why: 'That is the error for a divider of two 10 MΩ resistors, where the meter’s resistance equals the circuit’s. Here the circuit is 100 times lower.'
  - text: 'Not at all: a meter never disturbs a circuit.'
    why: 'It always does; the question is whether it matters. Here it is half a per cent.'
```

```quiz
q: 'A bench supply is set to 5 V with a current limit of 20 mA. You connect a 100 Ω resistor. What does the supply show?'
options:
  - text: '2 V and 20 mA, in constant-current mode (the CC lamp is lit).'
    correct: true
    why: '5 V across 100 Ω would need 50 mA, over the limit. The supply holds the current at 20 mA and lets the voltage fall to V = I × R = 20 mA × 100 Ω = 2 V.'
  - text: '5 V and 50 mA, in constant-voltage mode.'
    why: 'That is what would happen with a limit above 50 mA. Here the load asks for more than the limit allows.'
  - text: '5 V and 20 mA.'
    why: 'Voltage and current are tied by Ohm’s law: with 100 Ω, 20 mA means 2 V.'
```

```quiz
q: 'A scope shows a steady 1 kHz square wave. The timebase is 0.2 ms/div. How many complete periods fit across the ten divisions?'
options:
  - text: '2'
    correct: true
    why: 'The screen shows 10 × 0.2 ms = 2 ms; the period is 1 ÷ 1 kHz = 1 ms. Two periods.'
  - text: '5'
    why: 'That would be true at 0.5 ms/div, a screen of 5 ms.'
  - text: '10'
    why: 'Ten is the number of divisions, not periods.'
```

## What’s next

You now have the instruments: a meter that goes across for volts and in series for amps, a supply that limits itself, a scope that shows time, and a probe that knows high from low. The scope is going to be used at once, in Chapter 4, to watch something that a meter could never show: a voltage that takes time to change, because there is a capacitor in the way. And along the way you will meet the most important idea of this course that isn’t digital: that nothing in a circuit ever changes instantly.
