---
number: 17
title: The clock
summary: A latch listens when told, a flip-flop only at an instant, and a clock makes a million such instants line up. Setup and hold, how fast a clock can go, where clocks come from, and how to let the untidy outside world in.
duration: About 2 hours
prerequisites: [feedback, timing]
---

A modern processor completes about three billion clock ticks every second, and nothing in it is allowed to look at anything else between one tick and the next. That sounds like a restriction, and it is the opposite: it is what lets a billion transistors, each with its own delay, behave like a machine you can reason about. Without it, every circuit would be a race in which the answer depends on which wire happens to be shorter.

Chapter 16 gave us memory: a loop of gates that holds a bit. What it did not give us is control over *when* the bit changes. An SR latch obeys its inputs the moment they move, whatever else is going on. Try the following before reading on.

```quiz
q: 'A D latch is transparent while EN is 1: Q follows D. You wire its inverted output Q̄ back to its own D input and set EN to 1. What does Q do?'
options:
  - text: It settles into 0 or 1 and stays there.
    why: 'It cannot. If Q is 0, then Q̄ is 1, so D is 1, so Q becomes 1, so Q̄ becomes 0, so D becomes 0. Every value it takes is the signal to change to the other one.'
  - text: It flips once, when EN rises, and then holds.
    why: 'Nothing in a transparent latch notices “once”. While EN is 1 the loop from Q round to D is closed and stays closed.'
  - text: It flips again and again, as fast as the gates can, for as long as EN is 1.
    correct: true
    why: 'A transparent latch with an inverting loop is a ring oscillator of length two: Q chases its own opposite, changing every gate delay. The next figure shows it.'
```

## A latch that listens only when told

The SR latch has two inputs, S and R, and three situations: set, reset, hold. To store a bit you would rather have one wire carrying the *data* and another saying *when*. That is the **:term[D latch]{id=d-latch}**. Its inputs are D (the data) and EN (enable, or “gate”), and it does one of two things:

- while EN is 1 it is **transparent**: Q simply follows D, as if the latch were a piece of wire;
- while EN is 0 it is **opaque**: Q keeps the value D had at the moment EN fell.

Building it costs one inverter and two NAND gates in front of an SR latch made of two more NANDs. The first pair steers D into the latch only while EN is 1: the top gate sends the *set* signal S = D·EN, the bottom one the *reset* R = D̄·EN. When EN is 0 both are inactive and the loop simply holds. S and R can never both be active, so the forbidden state of the SR latch is designed out.

::circuit{src="17-the-clock/circuits/d-latch.json" title="A D latch from five gates" n="17.1" caption="Click D and EN (the small switches). With EN at 1, flip D and Q follows it at once. Set EN to 0 and flip D as much as you like: Q keeps the value it had when EN fell. The two NANDs on the left turn D and EN into set and reset signals; the two on the right are the SR latch of Chapter 16, in its NAND form."}

Transparency is what makes a latch dangerous. Any signal that travels round a loop back to its own input while the latch is open will chase itself. The figure below is your prediction: a latch whose D input is wired to its own Q̄.

::circuit{src="17-the-clock/circuits/latch-race.json" title="A latch racing itself" n="17.2" speed=2e-9 window=16e-9 traces="EN,Q" caption="EN starts at 1. Q flips every nanosecond, the delay of the latch: a two-nanosecond period, 500 MHz, from one part and one wire. Click EN to 0 and Q freezes in whichever state it was in; click it back and the race resumes."}

This is not a contrived example. Suppose a counter is built from latches: its next value is computed from its current value and fed back to its own input. While the latch is open, the new value ripples round and is computed *again*, and again. Every design that stores state in latches has to make sure the loop is never open while the signal is in it. The simplest way to guarantee that is the idea of the next section.

## Two latches make an edge

Make a **pair**: a first latch (the *master*) that is open while the clock is low, followed by a second (the *slave*) that is open while the clock is high. At any moment at most one of them is transparent, so a signal can never run all the way through:

- while CLK is 0 the master is open and follows D; the slave is closed and holds the old output;
- at the instant CLK rises the master closes, freezing what D was, and the slave opens, showing that frozen value at Q;
- while CLK is 1 the slave shows the master's frozen value; the master is closed, so D can change as it likes and nothing happens.

The output changes only at the rising edge, and it takes the value D had just *before* that edge. This is the **:term[D flip-flop]{id=flip-flop}**. The master–slave pair is the textbook way to build one; real chips, such as the 74HC74, use variations of it that need fewer gates but behave in the same way.:cite[ti-sn74hc-family]

::circuit{src="17-the-clock/circuits/master-slave.json" title="Two latches make a flip-flop" n="17.3" speed=1e-7 window=400e-9 traces="CLK,D,M.Q,S.Q" caption="The clock runs at 10 MHz; the figure runs at 100 ns per second, so a cycle takes one second. Click D at any moment. The master output M follows D while CLK is low, and Q (the slave) changes only when CLK rises. Watch the two traces: M moves at any time in the low half, Q moves only on the rising edge."}

:::lab[Break the pattern]
In Figure 17.3, click D just after a rising edge and again just before the next one. Q does not change in between; it changes at the following edge, to whatever D is *then*. Now click D twice in the same low half-cycle, so that D ends where it started: M moves out and back, and Q never notices. The flip-flop samples; it does not follow.
:::

:::programmer[A double buffer]
If you have written a game loop or a cellular automaton you know the trick: compute the next frame from a copy of the current one, so that updating one cell does not change what its neighbours see. The master–slave pair is that copy in hardware. The master holds the “next frame” while it is being computed, and the slave, which everyone else reads, changes all at once when the clock says the frame is done.
:::

The payoff is immediate. Wire Q̄ back to D again, as in the race, but with a flip-flop in place of the latch.

::circuit{src="17-the-clock/circuits/toggle-ff.json" title="A flip-flop divides by two" n="17.4" speed=1e-7 window=400e-9 traces="CLK,FF.Q" caption="The same feedback that made the latch race now makes an orderly divide-by-two: Q changes on every rising edge of CLK, so it has half the frequency. The loop is closed all the time, but the flip-flop only looks at D at the edge, and by then D is stable."}

Where the latch produced 500 MHz of nonsense, the flip-flop gives exactly one change per clock. Chapter 18 chains such toggles into counters.

### In DCL, a flip-flop is one line

From here on the course writes hardware in DCL as well as drawing it. In DCL a flip-flop is a `reg`, and `next` is the value that will be there after the next rising edge: the D input.

::snippet-playground{id="toggle" n="17.5" tab="run" caption="The toggle flip-flop of Figure 17.4 as a DCL module. Press Step clock and watch q alternate; open the Circuit tab to find the single flip-flop and the inverter, and press Run tests. Notice what the module does not mention: which clock edge, how long the data must be stable, or how fast the gates are. DCL describes what happens at each tick, and leaves the physics to the chip."}

Look at what the language will *not* let you write. There is no `latch`, and if you try to make one out of a loop, the compiler stops you with the very error Chapter 16 would have predicted.

::snippet-playground{id="latch" n="17.6" tab="code" circuit=false tests=false caption="Try to hold a value without a register: the output feeds its own definition. The compiler reports a combinational loop and says to use `reg`. A design that cannot contain a transparent latch cannot contain the race of Figure 17.2. If you would rather have the latch, Chapter 16 shows how to build one from gates."}

DCL goes further. A `clock` can only be passed from a port to a register: it cannot be computed, inverted or ANDed with anything, so a gated clock (the source of endless trouble in real designs) cannot be written down. Every register in a module is on one clock and changes at the same instant, just like the master–slave pair. The rest of the chapter is about the physical conditions under which that idealisation is true.

## The contract: set-up, hold and clock to Q

An edge-triggered flip-flop is not a magic instant. Inside, the master latch needs time to close and its value needs time to reach the slave. So every flip-flop comes with three numbers that make up a contract between it and the circuit around it:

- **:term[set-up time]{id=setup-time}** t<sub>su</sub>: the data must be stable for this long *before* the clock edge;
- **:term[hold time]{id=hold-time}** t<sub>h</sub>: the data must stay stable for this long *after* the edge;
- **:term[clock-to-Q delay]{id=clock-to-q}** t<sub>cq</sub>: after the edge, the new Q appears this long later.

The set-up and hold times together mark out a small window around the edge, the **aperture**, during which D must not change. For the 74HC family they are a few nanoseconds to tens of nanoseconds, depending on the supply voltage and part; for the flip-flops inside a modern FPGA or processor, a small fraction of a nanosecond.:cite[ti-sn74hc-family] What happens if D does change inside the aperture is the interesting part.

```quiz
q: 'A flip-flop has a set-up time of 2 ns. The data input changes from 0 to 1 only 0.6 ns before the rising clock edge. What does Q do?'
options:
  - text: It takes the new value, 1, because the data arrived before the edge.
    why: 'The data arrived, but not early enough for the master latch to have taken it in: 0.6 ns is less than the 2 ns the flip-flop needs.'
  - text: It keeps the old value, 0, because the data was late.
    why: 'It might, and it might not. The flip-flop was in the middle of deciding when the input moved, and it does not always decide the same way.'
  - text: 'Nobody can say: Q may be either, and it may spend a while in between.'
    correct: true
    why: 'This is metastability, which Chapter 16 met in a latch as a ball balanced on a hump. The flip-flop can settle either way, and how long it takes is random.'
```

::aperture-lab{n="17.7" caption="Drag the data change across the clock edge. Outside the shaded aperture (2 ns of set-up before the edge, 1 ns of hold after it) Q is clean: it either takes the new value or keeps the old one. Inside, Q goes unknown, hatched red, for a random time and then settles to either value. Press Run 200 times to see how long it stays undecided, and change τ to see what a slower flip-flop does."}

The figure runs the real flip-flop model of the course's simulator: outside the window the answer is deterministic, inside it Q is unknown (X) for a random time and then settles to a random 0 or 1. The distribution of that time is exponential: a wait of one τ is common, ten τ is rare, and there is no time after which it is impossible. The box at the end of the chapter shows the code that decides it.

:::note[The model is a box; the truth is a slope]
The simulator's aperture has sharp edges: inside it Q is metastable, outside it never is. A real flip-flop is smoother: the *probability* of going metastable falls off exponentially the further the data change is from the middle of the aperture, so the “window” depends on what failure rate you are prepared to accept. The data sheet's set-up and hold times are chosen so that failures are rare enough. Chapter 16's ball on the hump is the physical picture, and Ginosar's tutorial is the standard reference for the real thing.:cite[ginosar2011]
:::

## Synchronous design

The contract is a promise about one flip-flop. The design method that keeps it for a whole circuit is **:term[synchronous design]{id=synchronous-design}**:

1. all state lives in flip-flops, and all of them have the *same* clock;
2. between flip-flops there is only combinational logic (gates with no loops);
3. every path from one flip-flop's Q, through gates, to another's D must be fast enough that the data is stable at D one set-up time before the *next* edge.

Rule 3 is arithmetic. Let the launching flip-flop see a clock edge at time zero. Its Q changes at t<sub>cq</sub>, the signal takes t<sub>pd</sub> to cross the gates (the propagation delay of Chapter 15, taken along the critical path), and it must arrive t<sub>su</sub> before the next edge, which comes one clock period T later:

:::equation{#min-period caption="The shortest clock period a path allows."}
$$\term{t}{T} \ge \term{tcq}{t_\text{cq}} + \term{tpd}{t_\text{pd}} + \term{tsu}{t_\text{su}}$$

```terms
t:
  label: 'T, the clock period'
  what: The time between one rising clock edge and the next, in seconds. Its inverse is the clock frequency.
  why: Everything that has to happen between two flip-flops must fit inside it.
  effect: Halve it and the same path has half the time; the design runs twice as fast, if it still fits.
tcq:
  label: 't_cq, clock to Q'
  what: How long after the clock edge the launching flip-flop's output has its new value.
  why: The data cannot start its journey through the gates before this.
  effect: A slower flip-flop takes a bite out of every path in the design.
tpd:
  label: 't_pd, propagation delay'
  what: The delay of the slowest chain of gates between the two flip-flops (Chapter 15's critical path).
  why: It is the part of the budget the designer can change, by simplifying the logic or by cutting the path with a register.
  effect: Every extra gate on the critical path adds its delay to the minimum period.
tsu:
  label: 't_su, set-up time'
  what: How long before the next edge the data must have arrived and stopped moving.
  why: The capturing flip-flop needs this long to take the data in.
  effect: A larger set-up time shortens what is left for the gates.
```
:::

The clock frequency of the whole chip is limited by the *worst* such path in the design, and its maximum is f<sub>max</sub> = 1/T<sub>min</sub>. It is why a chip's speed is quoted for a clock and not for a gate.

```quiz
q: 'A path has a clock-to-Q of 2 ns, 5 ns of gates and a set-up time of 1 ns. What is the highest clock frequency it allows?'
options:
  - text: 200 MHz (a period of 5 ns, the gates alone)
    why: 'The gates are not the only thing between the edges. The launching flip-flop takes 2 ns before its output even moves, and the capturing one needs 1 ns of notice.'
  - text: 143 MHz (a period of 7 ns)
    why: 'That leaves out the set-up time of the capturing flip-flop.'
  - text: 125 MHz (a period of 8 ns)
    correct: true
    why: '2 + 5 + 1 = 8 ns. The flip-flops cost three of the eight.'
  - text: 8 MHz
    why: 'The period is 8 ns, and 1 / 8 ns is 125 MHz. 8 MHz would need a period of 125 ns.'
```

::break-the-clock{n="17.8" caption="A launching flip-flop, a chain of gates and a capturing flip-flop, running on the digital engine. Drag Clock period down: the data edge D2 slides right, relative to the clock, until it reaches the shaded aperture and Q2 goes unknown. Then use Gates in the path to lengthen the path, and Clock skew to move the capture clock later or earlier."}

:::lab[Break it three ways]
1. **Too fast.** Press *Set the period to the limit* and then drag the period down by half a nanosecond at a time. At the limit the slack is zero; just below it, D2 arrives inside the aperture and Q2 goes unknown at some of the edges. Below about 8 ns the path is longer than the period, and the failures stop announcing themselves: Q2 holds the value from an earlier cycle, and the design is wrong without any hint of why.
2. **Skew as a loan.** Put the period a little under the limit and drag the skew to +2 ns. The design works again: the capture clock is later, so the data has more time. But look at the hold slack, which fell by the same 2 ns.
3. **Hold.** Press *Short path, skewed clock*: no gates, +2 ns of skew. The data launched by this edge reaches FF2 while it is still looking at the last one, and the design fails at *every* period. Drag the period to 40 ns and nothing improves.
:::

The third experiment is the one to remember. A set-up violation is cured by slowing the clock. A **hold** violation is not: the race is between the data and the *same* clock edge, so the period cancels out of the inequality. Hold time is repaired by adding delay to the short path (or by fixing the skew), and has to be right before the chip is made, because no clock speed will rescue it afterwards.

The same arithmetic explains why real flip-flops work in a chain with nothing between them, as in a shift register (Chapter 18): a wire of no delay meets hold time only because a flip-flop's clock-to-Q (1.5 ns here) is longer than its hold time (0.8 ns) when the two clocks arrive together. The shift register works *because* the flip-flop designers made hold shorter than clock-to-Q.

:::note[Clock skew]
A chip's clock has to reach millions of flip-flops, and wires and buffers are not identical: the clock arrives at different flip-flops at slightly different times. That difference is **:term[clock skew]{id=clock-skew}**. Designers build **clock trees**, balanced branching networks of buffers that try to deliver the edge to every flip-flop at the same moment, and static timing analysis (Chapter 30) checks both slacks on every path in the design with the skew that the layout actually produced. The widget's skew slider is that number for one path.
:::

Speeding up a design is therefore the art of shortening the worst path. The standard trick is **pipelining**: cut a long path in two by putting flip-flops in the middle. The period can halve, at the cost of one more clock of latency, and two extra flip-flops' worth of t<sub>cq</sub> and t<sub>su</sub>. This is exactly what processor designers do, and Chapter 21 uses it.

## Where a clock comes from

A clock is an oscillator: something that goes round and round without help. The oscillator of Chapter 16, a ring of inverters, has a period fixed by gate delays, which vary with temperature, supply voltage and chip. A resistor and a capacitor give a period fixed by an RC constant that the designer can choose, and that is what a 555 does. For a clock that must keep time, the standard answer is a sliver of quartz.

Quartz is **piezoelectric**: squeeze it and it produces a voltage, apply a voltage and it deforms. Cut to the right shape it is also a very good mechanical resonator, ringing at one frequency for a long time after a tap, and an oscillator circuit that takes its feedback from the crystal is locked to that frequency. The crystal in a wristwatch is cut to vibrate at 32 768 Hz, which is 2<sup>15</sup>: fifteen toggle flip-flops of the kind in Figure 17.4, one after another, turn it into exactly one pulse per second. A typical accuracy is on the order of 20 parts per million, which is under two seconds a day.:cite[wiki-crystal-oscillator]

:::history{year=1927 title="Quartz keeps the beat" people="Walter Cady, Warren Marrison, J. W. Horton"}
In 1921 Walter Cady, a physicist at Wesleyan University, showed that a quartz plate could control the frequency of a vacuum-tube oscillator; he published his study of the piezo-electric resonator in 1922.:cite[cady1922]

At Bell Telephone Laboratories, Warren Marrison and J. W. Horton took the idea further. They built a clock whose time base was a quartz oscillator, with the crystal's 50 kHz signal divided down by a chain of electronic frequency dividers until it was slow enough to drive a synchronous motor. It was shown in public in October 1927, and by 1929 quartz oscillators were being used as time standards in several countries.:cite[marrison1948,nihf-marrison,wiki-crystal-oscillator] A dividing chain of flip-flops is the same circuit you will build in Chapter 18.
:::

A quartz crystal is the right choice when frequency matters. When it does not, and you only need a steady beat for a blinking light, a timer or a debouncing delay, the cheapest part in the catalogue is the 555.

### The 555, from its block diagram

The 555 is eight pins and about two dozen transistors, and it is a clock on a chip. Inside there is a chain of three equal resistors that makes two voltages, one third and two thirds of the supply; two comparators that watch a capacitor against them; an SR latch, our Chapter 16 circuit, that remembers which comparator spoke last; and a transistor that discharges the capacitor. Outside you add one capacitor and two resistors. The capacitor charges through R1 and R2 until it reaches two thirds of the supply; the upper comparator then *resets* the latch, which turns on the transistor and makes the capacitor discharge through R2 alone; when it reaches one third, the lower comparator *sets* the latch, the transistor turns off, and the cycle starts again. Two thresholds, and a latch that remembers which of them was crossed last, are what make the circuit oscillate instead of settling.

::circuit{src="17-the-clock/circuits/astable-555.json" title="A 555 astable from its parts" n="17.9" speed=0.05 window=0.2 traces="OUT" caption="The blocks of a 555, built from the course's parts and running on the analog engine: three 5 kΩ resistors, two comparators, an SR latch of NOR gates and a transistor that discharges the capacitor. Watch the CAP wire change colour as C1 charges and discharges, and the OUT lamp blink about 15 times a second. R1 = 1 kΩ, R2 = 10 kΩ, C1 = 4.7 µF."}

The frequency of this astable is f = 1.44 / ((R1 + 2·R2)·C) and the output is high for a fraction (R1 + R2)/(R1 + 2·R2) of the time. It comes from the exponential charging law of Chapter 4: each half-cycle is a swing of a factor of two in the remaining distance to the supply, which takes ln 2 = 0.693 time constants; the charge time is 0.693·(R1 + R2)·C and the discharge time 0.693·R2·C. The figure below solves the whole circuit each time you move a slider.

::astable-555{n="17.10" caption="The analog engine runs the 555 of Figure 17.9 for a few cycles every time you move a slider, and the numbers below compare it with the formula. Try R1 = 1 kΩ with R2 = 47 kΩ for a nearly square wave, and note that the duty cycle can never fall below 50 %; at the other end, R1 = 1 MΩ with R2 = 1 kΩ gives an output that is high for almost the whole cycle, with a brief low pulse."}

An RC oscillator is only as good as its parts: the 555's timing error is about a percent, and it drifts with temperature and supply.:cite[ti-ne555] For a blinking lamp that does not matter; for the clock of a computer that must talk to a serial line, it does, which is why microcontrollers carry a crystal.

:::history{year=1971 title="The chip that outsold everything" people="Hans Camenzind, Signetics"}
Hans Camenzind designed the 555 in 1971 under contract to Signetics. His first design, reviewed in the summer of that year, used a constant-current source and nine pins; the second, passed in October 1971, cut the pins to eight, so that the chip fitted an 8-pin package instead of a 14-pin one. Signetics put it on sale in 1972 as the SE555 and NE555.:cite[chm-555,camenzind2005]

There is a well-known story that it is called the 555 because of its three 5 kΩ resistors. The resistors are real, but Camenzind himself wrote that the name came from a Signetics manager's liking for the number.:cite[camenzind2005] More than fifty years on it is still made in enormous numbers: one estimate, from 2017, is more than a billion a year.:cite[eejournal-555]
:::

## The world does not wait for your clock

Everything above assumes the data at D arrives on time. A synchronous design is a small walled town, and its inputs come from outside the wall: a person pressing a button, a signal from another chip with its own clock, a sensor. These signals change at any moment, and sooner or later one of them will change inside the aperture. A signal that comes from a different time base is called **asynchronous**, and the way in, which Chapter 16 described, is a :term[synchroniser]{id=synchroniser}: two flip-flops in a row.

The first flip-flop takes the risk. If it goes metastable, its output is unknown for a random time. The second flip-flop does not look at it until the next edge, a whole clock period later, and by then the first has almost certainly settled. The output of the second is a clean 0 or 1, and one cycle late.

::circuit{src="17-the-clock/circuits/synchroniser.json" title="A two-flip-flop synchroniser" n="17.11" speed=1e-8 window=400e-9 traces="CLK,ASYNC,FF1.Q,FF2.Q" caption="The async input runs at 13.7 MHz, unrelated to the 100 MHz clock, so it moves inside the aperture of FF1 from time to time. This figure exaggerates the flip-flops (3 ns set-up, 2 ns hold, 3 ns clock to Q, τ = 2 ns) so that you can see the effect: FF1.Q goes unknown, hatched red, from time to time, and FF2.Q stays clean almost always. Watch for long enough and FF2 fails too."}

How safe is it? Each extra period of waiting multiplies the odds by a huge factor.

:::deeper[How often does a synchroniser fail?]
A flip-flop that is given a time t<sub>r</sub> to resolve fails to do so with probability about e<sup>−t<sub>r</sub>/τ</sup>. Averaged over all the ways the asynchronous data can fall relative to the clock, the mean time between failures is

MTBF = e<sup>t<sub>r</sub>/τ</sup> / (T<sub>w</sub> · f<sub>clk</sub> · f<sub>data</sub>)

where T<sub>w</sub> is the width of the aperture and f<sub>data</sub> the rate at which the data changes. Take a 100 MHz clock, data changing at 10 MHz, T<sub>w</sub> = 0.1 ns and τ = 0.1 ns (round numbers for illustration). With one flip-flop, t<sub>r</sub> is nearly zero and the MTBF is 1/(10<sup>−10</sup> × 10<sup>8</sup> × 10<sup>7</sup>) = 10 µs: the circuit fails a hundred thousand times a second. With the second flip-flop the resolution time is nearly a whole period, about 8 ns after clock-to-Q and set-up: e<sup>80</sup> ≈ 5.5 × 10<sup>34</sup>, so the MTBF becomes about 5 × 10<sup>29</sup> seconds, some 10<sup>22</sup> years. The exponential is what makes the fix so effective. It also shows the price of speed: raise the clock, and t<sub>r</sub> falls in step.:cite[ginosar2011,kleeman1987]
:::

The most familiar asynchronous input is a push button.

### Debouncing

A mechanical switch does not close cleanly. The contacts touch, spring apart and touch again, for a millisecond or so and occasionally for tens of milliseconds, and a fast circuit sees each touch as a press.:cite[ganssle-debounce] Wired straight to a flip-flop that toggles, one press toggles it an unpredictable number of times.

There are two cures. An analogue one puts a resistor and capacitor in front of a Schmitt trigger (Chapter 4): the capacitor smooths over the chatter and the two thresholds give a single clean edge. The digital one, which needs no extra parts if there is a clock, is to wait: accept a new level only after the input has held it for longer than the longest bounce. That is what DCL's standard-library `Debouncer` does.

::debounce-lab{n="17.12" caption="A push button pressed at 8 ms and released at 36 ms, with 4 ms of contact chatter after each. The debouncer's window is a number of 1 ms clock cycles. Drag the window below the bounce, to about 2 ms, and press again a few times: sometimes a quiet moment inside the chatter counts as a steady value and an extra edge gets through. Then lengthen the window past the bounce, and the clean output is one press and one release."}

Here is the module, written in three ways: as plain code, as a diagram (a synchroniser feeding a counter), and as a working design. It uses the debouncer to make a push button toggle a lamp: the circuit of the *Build it for real* lab.

::snippet-playground{id="press-toggle" n="17.13" tab="run" caption="A debounced push button toggling a lamp. Set button to 1 and Step clock 12 times: the lamp turns on, once. The tests chatter the button, then press and release it; open the Circuit tab to find the synchroniser, the counter that measures the window, and the edge detector. The window here is four cycles."}

:::hood[How a flip-flop knows it was given too little time]
Chapter 16 showed how the digital engine makes a latch metastable: Q goes to X and a wake-up is scheduled after a random time of mean τ (`goMetastable`, then `wake`). The flip-flop uses the same two functions, and adds the part that this chapter is about, deciding *when*. It remembers the time of its clock's last rising edge and the time its data inputs last changed, and compares them with `setup` and `hold` whenever either moves (`src/lib/sim/digital/models/sequential.ts`). When a data input changes, it checks the hold time against the last edge:

```ts
if (now - this.lastEdge < this.hold && !clearing) {
  const dt = now - this.lastEdge;
  this.goMetastable(sim, Math.max(0, this.lastEdge + this.clkToQ - now));
  sim.message('warning', `${this.id}: hold time violated. …`, this.id);
}
```

And on a rising edge, it checks the set-up time against the last change of data:

```ts
const since = now - this.lastDataChange;
if (since < this.setup) {
  this.endMetastable(sim);
  this.goMetastable(sim, this.clkToQ);
  sim.message('warning', `${this.id}: set-up time violated. …`, this.id);
  return;
}
```

Two subtleties are visible. Q does not go unknown at once but `clkToQ` after the edge, as a real output would, and a hold violation *after* the edge still delays that moment until the clock-to-Q has passed. And the check is the aperture with sharp edges, as the note above says: a change `setup` before the edge is harmless and a change just inside it is not.

Everything else in this chapter's figures is an ordinary use of the engine. *Break the clock* builds the launch flip-flop, the chain of buffers and the capture flip-flop with a `NetlistBuilder` (`widgets/clocking.ts`), runs it, and compares each capture with what the arithmetic of the chapter predicts; the tests check the two agree across a grid of periods, skews and path lengths, except right at the boundary. The histograms of the aperture figure are 200 separate engines with 200 seeds, since one engine's random numbers, seeded, would give the same sequence every time.
:::

## Exercises

Two parts, from the ground up. Build a D latch out of NAND gates, then a flip-flop out of two latches. Each one you finish goes into your parts bin and is used again by the register and counter of Chapter 18.

```build
id: clock/d-latch
title: A D latch from NAND gates
part: d-latch
allowed: [nand, not]
prompt: |
  Build a **D latch**: while EN is 1, Q follows D; while EN is 0, Q keeps its value. Q̄ is the opposite of Q. The pins D, EN, Q and Qn are on the canvas. You may use NAND gates and inverters. When it passes, the circuit goes into your parts bin as **D latch**.
hints:
  - Start from an SR latch made of two cross-coupled NAND gates. In this form its inputs are active low: a low S̄ sets Q and a low R̄ resets it.
  - In front of it, two NAND gates decide when D may reach the latch. What must each of them see for S̄ and R̄ to stay high (do nothing) while EN is 0?
  - Both need EN. One also sees D, the other sees D inverted. Five gates in all, counting the inverter.
explain: |
  NAND(D, EN) is low only when D and EN are both 1, and that sets Q. NAND(D̄, EN) is low only when D is 0 and EN is 1, and that resets Q. With EN at 0 both stay high, and the cross-coupled pair holds. D can never set and reset at once, so the forbidden input of the SR latch cannot happen.
solution: {"version":1,"title":"D latch from NAND gates","engine":"digital","components":[{"id":"D","type":"port","x":5,"y":2,"params":{"name":"D","dir":"in"},"label":""},{"id":"EN","type":"port","x":12,"y":8,"params":{"name":"EN","dir":"in"},"label":""},{"id":"N1","type":"not","x":8,"y":13,"label":""},{"id":"G1","type":"nand","x":16,"y":2,"label":""},{"id":"G2","type":"nand","x":16,"y":11,"label":""},{"id":"G3","type":"nand","x":28,"y":3,"label":""},{"id":"G4","type":"nand","x":28,"y":10,"label":""},{"id":"Q","type":"port","x":41,"y":4,"flip":true,"params":{"name":"Q","dir":"out"},"label":""},{"id":"Qn","type":"port","x":41,"y":11,"flip":true,"params":{"name":"Qn","dir":"out"},"label":""}],"wires":[{"points":[[5,2],[16,2]]},{"points":[[6,2],[6,13],[8,13]]},{"points":[[12,8],[14,8]]},{"points":[[14,4],[14,11]]},{"points":[[14,4],[16,4]]},{"points":[[14,11],[16,11]]},{"points":[[13,13],[16,13]]},{"points":[[22,3],[28,3]]},{"points":[[22,12],[28,12]]},{"points":[[34,4],[41,4]]},{"points":[[37,4],[37,7],[25,7],[25,10],[28,10]]},{"points":[[34,11],[41,11]]},{"points":[[39,11],[39,8],[26,8],[26,5],[28,5]]}]}
```

```build
id: clock/d-flip-flop
title: A flip-flop from two latches
part: d-flip-flop
allowed: ['part:d-latch', not]
prompt: |
  Build a **D flip-flop** that copies D to Q on each rising edge of CLK, using two of your **D latch** parts and an inverter. The pins D, CLK, Q and Qn are on the canvas.
hints:
  - The first latch is open while the clock is low; the second while it is high.
  - The output of the first latch is the input of the second.
  - The inverter gives one of the two latches the opposite phase of the clock.
explain: |
  The master is open while CLK is low, so it follows D and closes at the rising edge, when the slave opens and passes on the value the master held. Q changes only at the edge. Two latches and an inverter: the pair of Figure 17.3.
solution: {"version":1,"title":"D flip-flop from two D latches","engine":"digital","components":[{"id":"D","type":"port","x":5,"y":2,"params":{"name":"D","dir":"in"},"label":""},{"id":"CLK","type":"port","x":5,"y":8,"params":{"name":"CLK","dir":"in"},"label":""},{"id":"N1","type":"not","x":8,"y":8,"label":""},{"id":"M","type":"part:d-latch","x":14,"y":2,"label":"master"},{"id":"S","type":"part:d-latch","x":30,"y":2,"label":"slave"},{"id":"Q","type":"port","x":40,"y":2,"flip":true,"params":{"name":"Q","dir":"out"},"label":""},{"id":"Qn","type":"port","x":40,"y":4,"flip":true,"params":{"name":"Qn","dir":"out"},"label":""}],"wires":[{"points":[[5,2],[14,2]]},{"points":[[5,8],[8,8]]},{"points":[[6,8],[6,11],[26,11],[26,4],[30,4]]},{"points":[[13,8],[13,4],[14,4]]},{"points":[[20,2],[30,2]]},{"points":[[36,2],[40,2]]},{"points":[[36,4],[40,4]]}]}
```

```debug
id: clock/debug-flip-flop
title: A flip-flop on the wrong edge
prompt: |
  This is meant to be a rising-edge D flip-flop, built like the last one from two latches. It does not work: Q lags behind D by half a clock cycle. Find out why and fix it.
spec:
  reference: d-flip-flop
start: {"version":1,"title":"A flip-flop that fires on the wrong edge","engine":"digital","components":[{"id":"D","type":"port","x":5,"y":2,"params":{"name":"D","dir":"in"},"label":""},{"id":"CLK","type":"port","x":5,"y":8,"params":{"name":"CLK","dir":"in"},"label":""},{"id":"N1","type":"not","x":22,"y":8,"label":""},{"id":"M","type":"part:d-latch","x":14,"y":2,"label":"master"},{"id":"S","type":"part:d-latch","x":30,"y":2,"label":"slave"},{"id":"Q","type":"port","x":40,"y":2,"flip":true,"params":{"name":"Q","dir":"out"},"label":""},{"id":"Qn","type":"port","x":40,"y":4,"flip":true,"params":{"name":"Qn","dir":"out"},"label":""}],"wires":[{"points":[[5,2],[14,2]]},{"points":[[5,8],[10,8],[10,4],[14,4]]},{"points":[[10,8],[10,11],[19,11],[19,8],[22,8]]},{"points":[[27,8],[28,8],[28,4],[30,4]]},{"points":[[20,2],[30,2]]},{"points":[[36,2],[40,2]]},{"points":[[36,4],[40,4]]}]}
solution: {"version":1,"title":"D flip-flop from two D latches","engine":"digital","components":[{"id":"D","type":"port","x":5,"y":2,"params":{"name":"D","dir":"in"},"label":""},{"id":"CLK","type":"port","x":5,"y":8,"params":{"name":"CLK","dir":"in"},"label":""},{"id":"N1","type":"not","x":8,"y":8,"label":""},{"id":"M","type":"part:d-latch","x":14,"y":2,"label":"master"},{"id":"S","type":"part:d-latch","x":30,"y":2,"label":"slave"},{"id":"Q","type":"port","x":40,"y":2,"flip":true,"params":{"name":"Q","dir":"out"},"label":""},{"id":"Qn","type":"port","x":40,"y":4,"flip":true,"params":{"name":"Qn","dir":"out"},"label":""}],"wires":[{"points":[[5,2],[14,2]]},{"points":[[5,8],[8,8]]},{"points":[[6,8],[6,11],[26,11],[26,4],[30,4]]},{"points":[[13,8],[13,4],[14,4]]},{"points":[[20,2],[30,2]]},{"points":[[36,2],[40,2]]},{"points":[[36,4],[40,4]]}]}
hints:
  - Set D, then raise CLK. Has Q changed by the time CLK is high? When does it change?
  - Which latch is open while CLK is high, and which is open while it is low?
fault: The inverter is on the slave's clock instead of the master's. The master is open while CLK is high and the slave while it is low, so Q takes D at the falling edge, half a cycle late. The master is the latch that must be open while the clock is low.
```

```quiz
q: 'A design fails timing with a **hold** violation on one short path. Which of these could fix it?'
options:
  - text: Run the whole design at a lower clock frequency.
    why: 'Hold compares the data with the same clock edge that launched it, so the period is not in the inequality. The design fails at every speed, however slow.'
  - text: Add delay, for example a buffer, to the short path.
    correct: true
    why: 'The data must not arrive before the capturing flip-flop has finished with the old value. More delay in the path is exactly what hold wants, and it costs only set-up slack, which a short path has to spare.'
  - text: Use a faster flip-flop with a shorter clock-to-Q.
    why: 'The opposite: a shorter clock-to-Q makes the new data arrive sooner, which makes hold worse.'
```

```quiz
q: 'A synchroniser of two flip-flops fails once in a hundred years. Which change most improves it?'
options:
  - text: Use a clock twice as fast.
    why: 'A faster clock gives each flip-flop half the time to settle, and e to the power of a half the time over τ is enormously worse. It also doubles how often the input can fall in the aperture.'
  - text: Add a third flip-flop in the chain.
    correct: true
    why: 'It gives the signal one more full period to resolve, and each period multiplies the mean time between failures by e^(T/τ), a factor in the billions or far more. The price is one more cycle of latency.'
  - text: Use a faster clock for the first flip-flop only.
    why: 'The first flip-flop is the one that may go metastable, and it needs *longer* to resolve, not less.'
```

## Build it for real

:::real{parts="NE555 (or LMC555), 74HC74, 74HC14, LED, 1 kΩ resistor, 4.7 kΩ, 47 kΩ and 10 kΩ resistors, 10 µF and 1 µF capacitors, 10 nF capacitor, push button, 5 V USB supply module, breadboard, jumper wires"}
**A 555 astable.** Pin 1 of the 555 goes to ground, pin 8 and pin 4 (reset) to +5 V. Put 4.7 kΩ (R1) from +5 V to pin 7 (discharge), and 47 kΩ (R2) from pin 7 to pin 6 (threshold); tie pins 6 and 2 (trigger) together, and put the 10 µF electrolytic capacitor from pin 2 to ground, its stripe (negative) to ground. Add 10 nF from pin 5 to ground to keep the reference steady. Pin 3 is the output: an LED and a 1 kΩ resistor from pin 3 to ground blinks about 1.5 times a second (f = 1.44/((4.7 kΩ + 2 × 47 kΩ) × 10 µF)). Try a 1 µF capacitor for fifteen blinks a second, and put a finger on the capacitor's leg to feel how sensitive the timing is.

**A debounced button toggling a flip-flop.** A 74HC74 holds two D flip-flops: ground is pin 7 and +5 V pin 14. For the first, tie pin 1 (clear) and pin 4 (preset), both active low, to +5 V; tie pin 6 (Q̄) to pin 2 (D), the toggle of Figure 17.4; put the LED with its 1 kΩ resistor on pin 5 (Q); and the clock input is pin 3. First press a button, with a 10 kΩ pull-down, straight into pin 3, and count how many presses it takes to see a toggle that goes the wrong way. Then put a 10 kΩ resistor from the button to a node with a 1 µF capacitor to ground (a time constant of 10 ms), feed that node through two inverters of a 74HC14 (pins 1–2 and 3–4; ground pin 7, +5 V pin 14), and take pin 4 to the clock. The Schmitt-trigger inputs turn the slow RC ramp into one clean edge, and the LED toggles once per press. Tie the unused inputs of the 74HC14 and the second flip-flop to ground or +5 V (Chapter 10).
:::

## What’s next

We now have a bit that changes when the clock says so, a rule for how fast the clock may run, and a way to tame the world outside. One flip-flop remembers one bit. Chapter 18 puts many together: a **register** is a row of flip-flops that share a clock and load together, a **counter** is a row of flip-flops that add one at every tick, and a **shift register** passes a pattern along the row. It builds the counter twice, once the lazy way in which each flip-flop clocks the next (which shows up on a logic analyser as a ripple of wrong numbers) and once the synchronous way that this chapter argued for, and you will hear the difference in octaves.
