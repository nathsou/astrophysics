---
number: 16
title: Feedback
summary: Bend a wire back to its own input and a circuit acquires a past. A ring of inverters that cannot stop oscillating, a loop of two gates that remembers a bit, the SR latch, and the wire that a latch cannot decide to make 0 or 1.
duration: About 1½ hours
prerequisites: [timing, real-gates]
---

Every circuit so far has been a one-way street. Signals went in on the left, through gates, and out on the right, and no wire ever led back. That is why a truth table was enough to describe it, and why Chapter 15 could talk about a longest path: in a circuit with no loops, every signal has a beginning and an end. This chapter draws the one wire that breaks the rule. Take an output and connect it, through gates, to an input of the same circuit: that is :term[feedback]{id=feedback}. What was a function becomes something with a *past*.

Start with the simplest loop there is, and ask what it does.

```quiz
q: 'Three inverters are connected in a ring: the output of the first goes to the second, the second to the third, and the third back to the first. Each inverter takes 1 ns. What does a wire in the ring do?'
options:
  - text: It settles at 0.
    why: 'Suppose the first wire is 0. The first inverter’s output is then 1, the second inverter’s output is 0, and the third inverter’s output, which feeds the first, is 1. But the first wire was supposed to be 0. Three inversions turn 0 into 1, so the wire is being told to be the opposite of itself.'
  - text: It settles at 1.
    why: 'The same argument works from the other side: if the first wire is 1, three inversions tell it to be 0.'
  - text: It keeps changing between 0 and 1, every 3 ns.
    correct: true
    why: 'The wire is asked to be the opposite of itself, and it takes a gate delay to obey. So it never settles. It changes every time the edge has gone through one inverter and come round; a full period, one rise and one fall, takes six gate delays: 6 ns. (Every 3 ns it changes, but every 6 ns it repeats.)'
  - text: It depends on how the ring was powered up.
    why: 'The power-up state decides where the edge starts, and so the phase of the wave, but not whether there is one: an odd ring has no stable state at all.'
```

## A ring that cannot stop

The answer is worth working out properly, because it is the first thing a loop can do. Each inverter says “the opposite of what I see”. A ring of them is a set of demands: wire 2 must be the opposite of wire 1, wire 3 the opposite of wire 2, and wire 1 the opposite of wire 3. Go round the ring once and you have inverted the value some number of times, *n*. If *n* is even, the demands are consistent: with two inverters, wire 1 is the opposite of wire 2 and wire 2 the opposite of wire 1, and both are true when the wires differ. If *n* is odd, they contradict each other: wire 1 would have to be the opposite of itself, and no assignment of 0s and 1s satisfies all of them.

A circuit that cannot satisfy its own demands does the only thing left: it chases them. A change at the output of one inverter reaches the next one gate delay later, and the change at the last inverter comes round to the first, which flips again. The edge circles for ever. It has to go round *twice* to bring every wire back to where it began (once to make a wire 1, once to make it 0), so with *n* inverters of delay *d*:

:::key[The period of a ring oscillator]
An odd ring of *n* inverters, each with delay *d*, oscillates with period **2 × *n* × *d***. Three inverters of 1 ns oscillate with a period of 6 ns, a frequency of 167 MHz. Five inverters of the same kind, 10 ns, 100 MHz.
:::

```quiz
q: 'A ring of 3 inverters of 1 ns oscillates at 167 MHz. You replace it with a ring of 9 inverters of the same kind. What is the frequency now?'
options:
  - text: 56 MHz
    correct: true
    why: 'The period is 2 × 9 × 1 ns = 18 ns, three times as long as before, so the frequency is a third of 167 MHz, about 56 MHz. A longer ring is a slower one.'
  - text: 500 MHz
    why: 'The period grows with the number of inverters: the edge has more gates to go through on each lap. (3 × 167 MHz is what you would get if the ring ran faster with more inverters.)'
  - text: It stays at 167 MHz.
    why: 'Each inverter has the same delay, but the edge has three times as many of them to pass, so a lap takes three times as long.'
```

::ring-oscillator{n="16.1" caption="Choose the number of inverters and their delay. The ring is drawn as a ring, each wire coloured by its logic level, and the waveforms are the outputs of the first inverters. Turn the sound on (nothing plays until you do): the pitch is the real frequency divided by 125,000, so it goes up an octave when the frequency doubles. Then choose an even ring, and press Power up again."}

:::lab[Sing, and stop]
1. Start with three inverters of 1 ns. Read the measured period off the waveform, 6 ns, and compare it with the rule. Switch on the sound: a tone of about 1.3 kHz. The ring really does oscillate at 167 MHz; the sound is that frequency slowed by a factor of 125,000 so that a human ear can hear it.
2. Change to 5 and then 9 inverters, and listen to the pitch fall. Set the delay to 5 ns with nine inverters: 90 ns, 11 MHz, a deep hum near 90 Hz. Slow the ring down and the note falls; speed it up and it climbs.
3. Set the delay to 0 ns with an odd ring. The engine gives up: with no delay the ring would have to change infinitely often in no time. It says so, and turns the wires to X. (The *Under the hood* box explains how it notices.)
4. Choose 2 inverters. The tone stops, the waveforms go flat, and the ring is drawn in a steady pattern. Press **Power up again** a few times: it settles into one of two states. Try 4 inverters.
:::

:term[Ring oscillators]{id=ring-oscillator} are more useful than they sound. Chip designers put them on test chips, and often on production chips, to measure how fast the silicon is: the frequency is the gate delay read off directly, and it changes with the temperature and the supply. A ring whose delay is set by a control voltage is also one common way of making a clock on a chip.

## Two inverters remember

Now the even ring, which the lab has just shown. Take two inverters and cross-couple them: the output of each drives the input of the other. Its demands are consistent. Either wire 1 is 1 and wire 2 is 0, or the other way about, and *either* state satisfies both inverters. Nothing ever asks it to change, so it stays where it is for as long as it has power.

That is a memory. One bit, held by a circuit, with no clock, no capacitor, and no moving part. The two states are called **stable** because they hold: if noise nudges a wire a little the inverter that reads it pushes it straight back, since an inverter’s output moves the other way from its input and the loop *restores* whatever it is disturbed from. Compare the odd ring, where the loop amplifies a disturbance instead. A circuit with two stable states is called :term[bistable]{id=bistable}, and it is the most important idea in the digital half of the course. Every register, every SRAM cell in the cache of your processor, every flip-flop is a loop of this kind.

But the loop as drawn has a defect that the lab discovered: it has no input. It powers up in a state that nobody chose (in the simulator, the state is drawn by a seeded random number) and stays there. To *write* the bit we need a way to force the loop into one state or the other. Replace each inverter by a gate with an extra input that can override it, and we have the circuit of the next section. First, the story of the man who built it out of glass.

:::history{year=1918 title="Eccles and Jordan’s trigger relay" people="William Eccles, Frank Jordan"}
In 1918 two British physicists filed a patent for a circuit of two vacuum tubes that had two stable states. It is the first electronic flip-flop.

William Eccles and Frank Wilfred Jordan were professors at the City and Guilds Technical College in London. Their application, for “Improvements in Ionic Relays”, was filed on 21 June 1918 and published in 1920 as British patent 148,582.:cite[gb148582] The circuit joined two triodes so that each one’s output controlled the other’s input, a loop of two amplifiers that, once tipped one way, stayed there. They described it in a one-page note, “A trigger relay utilising three-electrode thermionic vacuum tubes”, in *The Electrician* of 19 September 1919.:cite[hoi-flipflop] They saw it as a relay for telegraphy and telephony (a device that changes state on a trigger and stays in it), not as a memory: the name *flip-flop*, and the use as one bit of storage in counters and computers, came later. Chapter 18 meets the scale-of-two counter of 1932, one of the first uses of the idea for counting.
:::

## The SR latch

Here is the same loop with two inputs. Each inverter becomes a **NOR gate**, an OR followed by an inversion: it is an inverter as long as its other input is 0, and it *forces its output to 0* when its other input is 1. Two NOR gates, cross-coupled, make the :term[SR latch]{id=sr-latch}. The inputs are called **S** (set) and **R** (reset); the outputs are **Q** and its opposite **Q̄**.

| S | R | What the latch does |
|---|---|---|
| 0 | 0 | **Hold**: keeps whatever it had |
| 1 | 0 | **Set**: Q becomes 1 (and Q̄ becomes 0) |
| 0 | 1 | **Reset**: Q becomes 0 (and Q̄ becomes 1) |
| 1 | 1 | **Forbidden**: both outputs are 0 |

::circuit{src="16-feedback/circuits/nor-latch.json" title="An SR latch from two NOR gates" n="16.2" mode="logic" speed=3e-9 traces="S,R,Q,Qn" window=24e-9 caption="Click the switches S and R, one at a time. Set the latch with S, then let go: Q stays at 1. That is the memory. Reset it with R. Watch the timing diagram: after each change the other gate follows one gate delay later. The latch powers up in a random state, which the simulator picks with a seeded random number."}

Follow the first rows through. Suppose the latch holds Q = 0 and Q̄ = 1 and you raise S. The lower NOR gate has a 1 on its input, so its output Q̄ is forced to 0. That 0 arrives at the *upper* NOR gate’s second input, and the upper gate now has two 0s (R and Q̄) and outputs 1: Q = 1. That 1 arrives back at the lower gate and confirms what S is already saying. Now drop S. The lower gate has S = 0 and Q = 1 on its inputs, and still outputs 0. The state is *held by the loop*: the two outputs keep each other where they are. That is the whole trick. The input has to be held only long enough for the signal to go round the loop once, about two gate delays; from then on, the circuit needs no more help.

You can also build the latch from NAND gates, which is the usual choice in CMOS (a NAND is smaller and faster than a NOR, Chapter 9). A NAND gate is an inverter while its other input is 1, and it forces its output to 1 when the other is 0. So the roles of 0 and 1 swap: the inputs are **active low**, written S̄ and R̄ (or /S and /R), and are 1 when nothing is happening.

::circuit{src="16-feedback/circuits/nand-latch.json" title="An SR latch from two NAND gates" n="16.3" mode="logic" speed=3e-9 traces="Sn,Rn,Q,Qn" window=24e-9 caption="Both inputs rest at 1. Click S̄ to bring it to 0: that sets the latch. Click it back to 1: it holds. Click R̄ to reset. What happens if you bring both to 0? Compare it with the NOR latch."}

:::programmer[A latch is a variable, and S and R are assignments]
An SR latch is one boolean variable. S is `q = 1`, R is `q = 0`, and with both low nothing is assigned. What makes it different from a variable in your program is that it is *level-sensitive*: as long as S is high, the assignment is happening, continuously. And the fourth row has no counterpart in software: asking for `q = 1` and `q = 0` in the same instant. A program executes one statement at a time and the second wins; in a circuit, both statements are executed at once by two gates that are wired against each other.
:::

:::note[Why the switches on a real button do not matter]
A pushbutton does not make contact once: for about a millisecond it touches, springs apart and touches again (Chapter 4 ended on this). If a button drives a counter, every bounce is a count. But if a two-way button (one contact for S̄, one for R̄) drives a NAND latch, the first touch sets the latch, and the bounces after it only re-assert what is already true: the output makes one clean step. This is the oldest debouncing circuit, and the exercises use it.
:::

### Build it

The SR latch goes into your parts bin. Build it from NOR gates, with the four pins already on the canvas.

```build
id: feedback/sr-latch
title: An SR latch from two NORs
part: sr-latch
allowed: [nor]
prompt: |
  Build an **SR latch** from two **NOR** gates: Q is 1 after S, 0 after R, and holds when both are 0. The pins S, R, Q and Qn are on the canvas. The checker never applies S = R = 1 (it is forbidden); it changes one input at a time, through every order of set, reset and hold.
hints:
  - Each NOR gate takes one of the inputs, S or R, and the *output of the other gate*. Draw the wire from each gate’s output to the other gate’s input.
  - Q is the output of the gate that has R as an input; Qn is the output of the gate that has S.
explain: |
  Two NOR gates, each fed by the output of the other. The wire from Q to the lower gate and the wire from Qn to the upper gate cross: that crossing is the feedback. When it passes, the circuit goes into your **parts bin** as **SR latch**, ready for the D latch of Chapter 17.
solution: 16-feedback/exercises/sr-latch.json
```

## The forbidden input, and why it is forbidden

The last row of the table says: S = 1 and R = 1 gives Q = 0 *and* Q̄ = 0. For a NOR latch that is what the gates do: each has a 1 on an input, so each outputs 0. It breaks the promise that Q̄ is the opposite of Q, but as long as you hold both inputs the circuit is at least in a definite state. The trouble comes when you let go.

Let go of both at once. Now each NOR gate has two 0s and would like to output 1, which each of them does, after its delay. Then each sees a 1 on the other’s output and would like to output 0. The gates are perfectly symmetrical, so nothing tells them which one should win: if their delays were exactly equal they would swing together, 1 and 1, 0 and 0, for ever, like two people meeting in a doorway who both step aside in the same direction. (The gate-level latch of the figure does exactly that in the simulator, with delays exactly equal, and it is one of the things the tests of this chapter check.) Real gates are never exactly equal; some difference of a few picoseconds decides, and the latch falls into one state or the other. But there is a case in between, where the difference is so small that the loop cannot decide *at once*, and that is the subject of the rest of the chapter.

The rule for using an SR latch is therefore: never let S and R be 1 together, or, if you must, let go of one of them first. The latch made from NAND gates has the same problem with both inputs at 0. A hardware designer says that the fourth row is “forbidden”, and means: the outcome of leaving it is not a function of the inputs.

## Metastability

The state that the latch cannot decide has a name: :term[metastability]{id=metastability}.

Stability has a shape, and the shape is worth drawing. Chapter 10 drew the transfer curve of an inverter: output voltage against input voltage, a curve that starts high, drops steeply through the middle and ends low. Now cross-couple two inverters. Wire 1’s voltage is the input of one and the output of the other, so the pair of curves, one drawn the usual way and one with its axes swapped, meet where the loop is in balance. They meet in **three** places. Two are at the ends: one wire at 0 and the other at 1, and the other way about. The third is in the middle, where both wires sit at the voltage at which an inverter’s output equals its input, about half the supply.

The two ends are stable, because there the curves are flat and a disturbance shrinks. The middle is a place where the curves cross steeply, and there a disturbance *grows*: if one wire is a little above the balance point, the other inverter pushes its wire a little further down, which makes the first go up a little more. The middle state exists, as a solution of the equations, and no more than that: it is like a pencil balanced on its point. The state of the latch is a ball on a landscape, and we can draw the landscape.

The figure has two valleys, one for each stable state, and a hump between them: the balanced state. S tilts the landscape towards the right-hand valley, R towards the left. Hold both and the two valleys merge into one bowl under the ball, which is the forbidden state where both outputs are 0. Let go of one at a time and the ball rolls into a valley, as you would expect. The interesting move is to hold both, and let go of both at the *same instant*.

```quiz
q: 'You hold S and R together and let go of both at the same instant, so that the latch is left balanced with no reason to prefer either state. What do you expect?'
options:
  - text: The latch settles at once, to 0.
    why: 'A perfectly symmetrical latch has nothing that favours 0. If it always chose 0, it would not be symmetrical.'
  - text: The latch stays balanced for ever.
    why: 'A ball balanced on the top of a hump is in a state of balance that cannot last: the smallest disturbance, and there is always some noise, makes it roll away. The question is how long it takes.'
  - text: It stays undecided for a short and unpredictable time, and then falls to 0 or to 1 at random.
    correct: true
    why: 'This is metastability. The balance is unstable, so a tiny difference grows, but the smaller the difference at the start, the longer it takes to grow big enough to matter, and the start is decided by noise. The time is random, and so is the side.'
```

::double-well{n="16.4" caption="Hold S and the ball rolls right; hold R and it rolls left. Then press the third button: it holds S and R together and lets go of both at the same instant. The ball is left on the hump, and the latch on the right (the digital engine’s SR latch, with its outputs in the timing diagram) goes unknown: X. After a random time it falls, and to a random side. Do it again a few times, and change the time constant τ."}

:::lab[Balance the ball]
1. Hold **S**: the landscape tilts, the left-hand valley disappears, and the ball rolls into the right-hand valley. The latch’s Q goes to 1. Let go: the landscape flattens, but the ball stays in its valley, which is why the latch remembers.
2. Do the same with **R**. Then hold **S** and **R**, and look: the two valleys have merged into a bowl, and the ball sits at the bottom, which is the hump’s position. Q and Q̄ are both 0 in the timing diagram.
3. Press the third button (or hold S and R and let go of *both* with one click). The ball stays on the top: the diagram shows Q and Q̄ hatched red, X, and the picture says how long it has been balanced. Then it falls, one way or the other. Press again and again: the waiting time is different every time, and the side is a toss of a coin.
4. Set τ to 5 ns and repeat: the ball hangs on for longer, on average. Set it to 0.5 ns: the latch is quicker to decide. τ is a property of the latch (how fast its loop amplifies); the waiting time is random, but its *average* is τ.
5. Now use the switches in the drawing of the latch instead of the buttons. Click S and R on, then off again one after the other. At *Slow* speed the latch’s 1 ns delay lasts about a second and a half of your time, so if you click the second switch within that, the latch still hangs; click it later and the first release has already decided. There is no metastability unless you are quick: the window is the gate delay.
:::

### The exponential

The waiting time is random, but not arbitrary. A latch that has been left balanced within a tiny distance *x*<sub>0</sub> of the top of the hump moves away from it at a rate proportional to its distance, so the distance grows *exponentially*: *x*(*t*) = *x*<sub>0</sub> e<sup>*t*/τ</sup>, and the latch has decided when *x* has grown to the size of a valley. The time constant τ is set by how fast the loop amplifies; the starting distance is set by noise, and it is different every time. A latch that starts very close to the top takes much longer than one that starts a little further off.

:::deeper[Why the chance of waiting falls as e^(−t/τ)]
Suppose the starting distance |*x*<sub>0</sub>| is equally likely to be anywhere in a small range up to some size *a* (the noise is smooth on that scale). The latch decides when |*x*<sub>0</sub>| e<sup>*t*/τ</sup> reaches the valley size Δ, that is, at time *t* = τ ln(Δ / |*x*<sub>0</sub>|). It is still undecided at time *T* if its starting distance is less than Δ e<sup>−*T*/τ</sup>, which has probability proportional to that distance: (Δ / *a*) e<sup>−*T*/τ</sup>. So the probability of still being undecided after a time *T* is proportional to e<sup>−*T*/τ</sup>, and once *T* is more than a few τ, the constant in front is all that is left of the starting conditions. Waiting one more τ divides the odds by e ≈ 2.7. Any waiting time worth worrying about is a rare tail of this distribution, and the tail is exponential.
:::

The digital engine draws the waiting time of its SR latch from exactly this distribution. The figure below releases 1,500 of them at once and times them.

```quiz
q: 'After 1 ns, one latch in ten is still undecided. Assuming the exponential law, about how many are still undecided after 2 ns?'
options:
  - text: One in twenty.
    why: 'That would be a straight-line decay: half as many after twice as long. The decay is exponential, and it is much faster: each extra nanosecond divides the number by the same factor.'
  - text: One in a hundred.
    correct: true
    why: 'e^(−t/τ) at t = 1 ns is 1/10, so at t = 2 ns it is (1/10)², one in a hundred. Every extra nanosecond divides the number by ten.'
  - text: 'One in ten still: the latch that has waited a nanosecond is no more likely to decide.'
    why: 'It is more likely to decide. What stays the same is the *fraction* of survivors that decide in the next nanosecond: nine in ten of those left, whenever you look. The number that are left falls by a factor of ten each nanosecond.'
```

::meta-survival{n="16.5" caption="1,500 latches, released at the same instant, on the digital engine. The red line is the measured fraction still undecided at each time; the dashed one is e to the minus t over τ. On the logarithmic axis an exponential is a straight line. Press Release 1,500 more for a new random set, change τ, and drag the wait slider to see what a longer wait buys."}

:::history{year=1973 title="Chaney and Molnar: the flip-flop that could not decide" people="T. J. Chaney, C. E. Molnar"}
In April 1973 two engineers published a two-page paper that told the industry a problem it had been ignoring was real.

The paper, “Anomalous behavior of synchronizer and arbiter circuits” in *IEEE Transactions on Computers*, reported observations of oscillatory and metastable behaviour of flip-flops when their inputs were in a logically undefined condition, such as the input that arrives too close to a clock edge in a synchroniser or an arbiter.:cite[chaney1973] Its abstract says that significant system failures had resulted from “this fundamentally inescapable problem”, which it calls generally not appreciated by system designers and users. Later work, such as Ginosar’s tutorial,:cite[ginosar2011] developed the mathematics (the exponential of this chapter) and the design rules that follow.
:::

## Why anyone cares

Metastability would be a curiosity if it were easy to avoid, and it is not. It happens whenever a latch or a flip-flop looks at a signal that can change at any moment, and there is no clock to say “now”: a button that you press, a network cable, a sensor, a signal from a chip running on another crystal. At some rate of arrival, some of the signals will change at the worst moment, within the latch’s decision window, and the latch will be left balanced. Nothing that can be done to the latch itself will stop it: the balance point is part of the shape of any circuit with two stable states (see it in the landscape).

What can be done is to *wait*. The chance that a latch is still undecided falls by a factor of e for every τ that passes, and τ is of the order of tens of picoseconds in recent processes, so a wait of a nanosecond is fifty or more τ, a factor of e<sup>50</sup> ≈ 5 × 10<sup>21</sup>. Wait for a whole clock period and the failure becomes as rare as you please. That is the idea of a :term[synchroniser]{id=synchroniser}: pass the doubtful signal through a first flip-flop, which may go metastable, and give it a full clock period to resolve before a second flip-flop looks at it, which will then almost certainly see a proper 0 or 1. Two flip-flops in a row, and the mean time between failures grows exponentially with the time allowed, in the form MTBF ∝ e<sup>*t*/τ</sup> divided by the rates at which the clock and the data arrive.:cite[ginosar2011] Chapter 17 builds it, and breaks it on purpose with the figure that violates setup and hold.

:::hood[How the digital engine models a balanced latch, and a loop with no delay]
The `srlatch` of the digital engine (`src/lib/sim/digital/models/sequential.ts`) is the SR latch of the last section as one part. When S and R are let go of together (both change within the latch’s own delay of leaving the forbidden state), it goes metastable. The code that does it is short:

```ts
protected goMetastable(sim: DigitalSim, delay: number): number {
  this.metastable = true;
  this.metaStart = sim.now + delay;
  this.setQ(sim, X, delay);
  const r = Math.round(-this.tau * Math.log(1 - sim.random()));
  sim.wakeAt(this.init.index, delay + r, RESOLVE);
  return r;
}
```

Q and Q̄ go to X after the delay, and a wake-up is scheduled for a random time later. The line with the logarithm is *inverse-transform sampling*: for a uniform random number *U* between 0 and 1, −τ ln(1 − *U*) has an exponential distribution with mean τ. The random number comes from the engine’s own seeded generator, so every run of a page shows the same sequence of waits, and the figure’s tests can assert statistics. When the wake-up arrives, the latch picks a side with a fair coin:

```ts
wake(sim: DigitalSim, tag: number): void {
  if (tag !== RESOLVE || !this.metastable) return;
  this.metastable = false;
  const v = sim.random() < 0.5 ? 0 : 1;
  this.setQ(sim, v, 0);
  sim.message('info', `${this.id} left the metastable state after ${fmtNs(sim.now - this.metaStart)}: Q settled to ${v}.`, this.id);
}
```

If the inputs change again in the meantime (a real set or reset) the latch abandons the wait: a metastable latch can still be forced. Flip-flops use the same two functions when their data changes inside the setup or hold window of Chapter 17.

Loops made of *gates*, like the ring and the NOR latch of Figures 16.1 and 16.2, are simulated as they are, with no special model, and that raises two problems. The first is how such a loop starts. At time 0 every output is unknown, X, and a loop of gates would stay X for ever. So at power-up the engine finds the loops (strongly connected groups of gates, by Tarjan’s algorithm), walks each once and gives every output that is still X a consistent value, picking a seeded random bit where the inputs do not decide it (`powerUp` in `engine.ts`): an odd ring then starts with one travelling edge, and an even ring or a latch settles in one of its two states, the state that you watch being chosen when you press *Power up again*.

The second is a loop with *no delay*. An odd ring of gates with delay 0 changes again in the same instant it has changed, so time never advances. The engine counts the delta cycles that it spends at one instant, and when the count passes a limit it stops and blames the loop:

```ts
if (deltas > this.maxDeltas - 64) {
  this.loopSuspects ??= new Set();
  for (let i = 0; i < this.dirtyCount; i++) this.loopSuspects.add(this.dirtyList[i]!);
  if (deltas > this.maxDeltas && !this.breakLoop(t, deltas)) break;
}
```

For its last 64 cycles the engine remembers which gates were being evaluated: those are the suspects, and `breakLoop` names them (“A loop with no delay through U1, U2, U3 does not settle … Its wires are set to X; give a gate in the loop a delay”) and sets their outputs to X, which is where such a loop ends up. That is the message you saw with the delay at 0 ns.
:::

## Exercises

```quiz
q: 'A ring of 7 inverters, each with a delay of 1.5 ns. What is the frequency of oscillation?'
options:
  - text: About 48 MHz.
    correct: true
    why: 'The period is 2 × 7 × 1.5 ns = 21 ns, and 1 / 21 ns = 47.6 MHz.'
  - text: About 95 MHz.
    why: 'That is 1 / (7 × 1.5 ns), which forgets that the edge must go round the ring twice for one full period: once for the rise and once for the fall.'
  - text: About 670 MHz.
    why: 'That is 1 / 1.5 ns, the speed of one inverter. The ring has seven of them in a loop, and the edge passes through each.'
```

```quiz
q: 'An SR latch made of NOR gates has S = 1 and R = 1, so both outputs are 0. You let go of R first, and a little later (well over a gate delay) of S. What is Q at the end?'
options:
  - text: 1
    correct: true
    why: 'After R is released, S = 1 and R = 0 is the set condition: Q goes to 1 and Q̄ to 0. When S is released later, the latch holds that. The order of release decides the result, which is why it is only the *simultaneous* release that is a problem.'
  - text: 0
    why: 'A 0 would need R to be the last input held. With S the last, the latch is set.'
  - text: Either, at random.
    why: 'Only if both were released within the latch’s decision window. A gate delay or more between them is enough for the first release to have taken effect.'
```

```quiz
q: 'A latch has τ = 20 ps. You want the probability that it is still undecided after your wait to be below 10⁻⁹. About how long must you wait?'
options:
  - text: About 9 τ = 180 ps.
    why: 'That takes the logarithm to base 10. The law is e^(−t/τ), whose natural logarithm is needed: e^(−9) is only 1.2 × 10⁻⁴.'
  - text: About 21 τ = 410 ps.
    correct: true
    why: 'We need e^(−t/τ) < 10⁻⁹, that is t/τ > ln(10⁹) = 20.7. So t > 20.7 × 20 ps = 414 ps. Each 2.3 τ buys another factor of ten.'
  - text: About 10⁹ τ.
    why: 'The probability falls exponentially with the time, not linearly: the waiting time needed grows only as the logarithm of how small a probability you want.'
```

:::challenge[Debounce a switch]
A two-way pushbutton has one contact that touches when it is pressed and another that touches when it is released, and the common terminal is grounded. Connect the two contacts to the S̄ and R̄ inputs of a NAND latch, each with a pull-up resistor to +5 V (so that a contact that is not touching gives a 1). What is Q when the button is pressed, while it is bouncing, and when it is released? And what would happen if you connected only *one* contact, to a single gate?

*Answer.* Before you touch anything, the R̄ contact is touching (so R̄ = 0) and S̄ is 1: Q = 0. Press the button: the R̄ contact leaves (R̄ goes to 1) and, a moment later, the S̄ contact arrives and S̄ goes to 0: Q = 1. If S̄ bounces, S̄ goes 0, 1, 0, 1, 0; with R̄ at 1 and S̄ at 1 the latch holds, and every 0 sets it again: Q stays 1 throughout. The bouncing never reaches the output, because the latch remembers. With one contact and a single gate the bounces would go straight through as a train of pulses, and only a delay (Chapter 17 uses a slow filter) could hide them.
:::

## Build it for real

:::real{parts="74HC00, 74HC04, 2 × pushbuttons, 2 × 10 kΩ resistors, 2 × LEDs, 2 × 1 kΩ resistors, 3 × 100 kΩ resistors, 3 × 1 µF capacitors, breadboard, 5 V USB supply module, jumper wires"}
**A NAND latch on a breadboard.** The 74HC00 is four NAND gates: the inputs of the gates are pins 1 and 2, 4 and 5, 9 and 10, and 12 and 13, the outputs are pins 3, 6, 8 and 11, and pin 14 is +5 V and pin 7 is ground.:cite[ti-sn74hc-family] Use two of them. Gate 1 is pins 1, 2 and 3, gate 2 is pins 4, 5 and 6. Connect pin 3 (Q) to pin 5, and pin 6 (Q̄) to pin 2: that is the loop. Pin 1 is S̄ and pin 4 is R̄: connect each to +5 V through a 10 kΩ pull-up resistor and to ground through a pushbutton, so that the input is 1 until the button is pressed. Put an LED and a 1 kΩ resistor from each of pins 3 and 6 to ground. **Tie the inputs of the unused gates (pins 9, 10, 12 and 13) to ground.**

Press S̄: Q’s LED lights and stays lit when you let go, and Q̄’s goes out. Press R̄: the other way round. Press both: both LEDs light, because the NAND latch’s forbidden state has both outputs at 1. Then release one button before the other: the latch takes the state that the *last* button held. Try to release both at exactly the same moment: with fingers you will manage a spread of some milliseconds, a million times too long to be a race, and the latch will always choose. (If you can build a circuit that releases both within a nanosecond, it is a very good way of finding a latch that hangs.)

**A ring oscillator slowed to a blink.** A three-inverter ring of 74HC04 gates oscillates at some tens of megahertz, much too fast to see. Slow it with an RC filter *after each inverter*, so the edge takes a noticeable time to get round: with three inverters (pins 1→2, 3→4 and 5→6 of the 74HC04), connect the output of each through a 100 kΩ resistor to the input of the next and a 1 µF capacitor from that input to ground, and close the ring from pin 6 back to the first input. Put an LED and a 1 kΩ resistor from pin 6 to ground, and tie the unused inputs (pins 9, 11 and 13) to ground. Each RC stage delays the signal (its time constant is 0.1 s here), and the loop oscillates at the frequency where the three stages together shift it by half a cycle. A rough estimate from the theory of the phase-shift oscillator is a frequency of about 0.28 ÷ RC, so a few blinks per second; expect it to be off by a third either way, since capacitors are loose parts and the thresholds vary from chip to chip. This is a demonstration, not a design: the slowly changing inputs leave the gate in the forbidden zone of Chapter 10, where both its transistors conduct and it draws current, so in a real circuit a Schmitt-trigger gate such as the 74HC14 does this job. It is the idea of Figure 16.1 again, with the delay of each stage supplied by a resistor and a capacitor instead of by the gate itself.
:::

## What’s next

We have a memory, and we have found its flaw. The SR latch remembers a bit, but you must tell it *what* to remember with two wires, and one combination of them is forbidden. It is also always listening: whenever S or R changes, so does Q, and you cannot say “now” and “not now”. A computer wants the opposite, a memory with *one* data wire that copies it on command, and only on command; and better, one that does it at a single well-defined instant, so that the circuits around it have the whole time between two such instants to settle, as Chapter 15 says they need.

That is the **clock**. Chapter 17 makes the D latch out of the SR latch, and the edge-triggered flip-flop out of two D latches back to back; it defines the setup and hold windows in which a flip-flop, like the latch you have just balanced, may lose its way; and it builds the synchroniser that keeps a stray signal from doing it. And it lets you break a clock on purpose, which is the best way to see what the clock is for.
