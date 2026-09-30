---
number: 15
title: Timing
summary: Every gate takes time, so a circuit that is right on paper can be wrong for a few nanoseconds. Propagation and contamination delay, the critical path that sets a circuit’s speed, hazards and glitches, and why a gate ignores a pulse that is too short.
duration: About 1½ hours
prerequisites: [real-gates, boolean-algebra, arithmetic]
---

Take a wire, call its value A, and AND it with its own inverse. On paper the answer is 0, always: a signal cannot be 1 and 0 at once, and Chapter 11’s complement law says so in three symbols, A · A′ = 0. Put the wire into a circuit and it is the safest output there is. So a circuit whose output is *always* 0 must be dull to watch.

```quiz
q: 'The output Y = A · A′ is made from an AND gate and an inverter, and A goes from 0 to 1. What does Y do?'
options:
  - text: It stays at 0.
    why: 'That is what the algebra says, and it is what the circuit does once everything has settled. But between the moment A changes and the moment the inverter has caught up, the two inputs of the AND gate disagree with the algebra.'
  - text: It rises to 1 for a moment and falls back to 0.
    correct: true
    why: 'A reaches the AND gate at once, and the inverter’s output, A′, takes a gate delay to follow. For that short time A is 1 and A′ is still 1, so the AND gate sees 1 · 1 and answers 1. Then A′ arrives, and Y falls back.'
  - text: It depends on which input of the AND gate the inverter is connected to.
    why: 'An AND gate is symmetrical, so swapping its inputs changes nothing. What matters is which of the two signals is late, and it is always the one that has passed through the inverter.'
```

::circuit{src="15-timing/circuits/race.json" title="A signal racing its own inverse" n="15.1" mode="logic" speed=4e-9 traces="A,A′,Y" window=20e-9 caption="Click the switch A, and watch the timing diagram. The circuit is a wire, an inverter and an AND gate, and its output is 0 in every steady state. The little pulse on Y is real: the simulator gives the inverter 2 ns and the AND gate 1 ns, and this circuit runs at four nanoseconds per second."}

What you have just seen is called a :term[glitch]{id=glitch}, and hardly any real circuit is free of them. This chapter is about time, the thing that the truth tables of Chapters 6 to 14 left out. A truth table says what a circuit computes once it has settled. It says nothing about how long that takes, or what the outputs do on the way. The answers decide how fast a computer can run, and they explain a family of bugs that no amount of staring at the logic will find.

## A gate takes time

Chapter 10 measured it. When the input of a gate crosses half the supply, the output takes a little while to follow: the gate has to charge or discharge the wire and the inputs it drives. That interval, from input at 50 % to output at 50 %, is the :term[propagation delay]{id=propagation-delay}, written *t*<sub>pd</sub>. It is short and it is never zero. The 74HC04 inverter of Chapter 10 has a data-sheet delay of the order of ten nanoseconds on a 5 V supply, with the guaranteed maximum some two or three times the typical figure;:cite[nexperia-74hc04] a leading-edge chip today has gates that switch in perhaps ten to twenty picoseconds, three orders of magnitude faster, and a dozen or so gates between two registers is all a 5 GHz clock allows. A gate in an FPGA (Chapter 28) takes a few tenths of a nanosecond, and the wire to the next one, often, more.

There are two delays, not one. The datasheet of any gate gives a *typical* value and a *maximum*, because the delay of a real gate depends on things nobody controls: the temperature, the supply, the batch of silicon the chip came from, and what the gate drives. Turn that round for a circuit, and two numbers appear.

:::key[Two delays]
The **propagation delay** *t*<sub>pd</sub> of a circuit is the *longest* time from an input change to the moment every output has settled. The :term[contamination delay]{id=contamination-delay} *t*<sub>cd</sub> is the *shortest* time before *any* output can start to change. In between, at any moment, an output may be wrong, or right by luck; nothing guarantees it.
:::

“Contamination” is an odd word and a good one: it is the first moment at which the old answer is spoiled. Before *t*<sub>cd</sub> the output is still the answer to the *previous* inputs; after *t*<sub>pd</sub> it is the answer to the new ones. Chapter 17 will use both: a register may only capture a signal that is steady, so the signal must have finished changing before the clock edge (*t*<sub>pd</sub> sets how early) and must not start changing again too soon after it (*t*<sub>cd</sub> sets how late).

The simulator has the same idea in its own units. Every gate has a delay parameter in nanoseconds (1 ns unless the circuit says otherwise), each gate has one value, and the digital engine is exact and deterministic: the same circuit gives the same waveforms every time. Real delays vary, so what you see in this chapter is the *shape* of the problem, and not a prediction for any chip.

:::history{year=1968 title="Grace Hopper’s nanosecond" people="Grace Hopper"}
By the late 1960s Rear Admiral Grace Hopper had a way of answering the question “why can’t computers be faster?” She handed the questioner a piece of wire.

Each piece was about 30 cm (11.8 inches) long, the distance that light travels in a nanosecond: 299,792,458 m/s divided by a thousand million is 29.98 cm.:cite[nmah-hopper-nanoseconds] Signals in a real wire are slower, roughly two thirds of that, so a nanosecond is a distance you can hold, and a chip that wants to be fast has to be small. For a microsecond she brought a coil of wire nearly 1,000 feet long, and for a picosecond, as components shrank, a few grains of pepper.:cite[nmah-hopper-nanoseconds] The Smithsonian’s National Museum of American History keeps a bundle of about a hundred of her wires, which she brought to hand out to its docents at a lecture in March 1985.:cite[nmah-hopper-nanoseconds] The dating of the habit is looser than the length: the museum says “the late 1960s”, and one catalogue of physical visualisations gives 1968.:cite[dataphys-hopper]
:::

## Paths, and the slowest of them

A signal that leaves an input has to pass through some gates to reach an output. Call each such route a **path**; its delay is the sum of the delays of the gates on it. Different paths have different lengths, because circuits are not made of one gate after another in a row: the signal has many ways through, and the short ways and the long ways all end at the same output.

Then *t*<sub>pd</sub> is the length of the **longest path**, and *t*<sub>cd</sub> the length of the shortest. The longest is called the :term[critical path]{id=critical-path}: it is the one that decides when the circuit is finished, and so how fast it can be used. Speed up a gate that is not on it and the circuit is no faster, which is the reason engineers stop optimising most of a design and look hard at one path.

```quiz
q: 'An AND of eight inputs can be built as a chain of seven two-input AND gates, each taking the previous gate’s output and one new input (((x0·x1)·x2)·x3)…, or as a balanced tree, four gates in the first layer, two in the second, one in the third. With 2 ns per gate, how much faster is the tree?'
options:
  - text: 'Not faster: both have seven gates.'
    why: 'Both have seven gates, but a signal does not pass through all of them. In the chain it may pass through every one; in the tree, through three.'
  - text: About twice as fast, 6 ns against 14 ns.
    correct: true
    why: 'The chain’s longest path goes from the first input through all seven gates, 7 × 2 = 14 ns. In the tree every path is three gates long, 3 × 2 = 6 ns. Same function, same number of gates, and the tree is 2.3 times as fast.'
  - text: About seven times as fast.
    why: 'The tree still has three layers of gates in every path, and each takes its 2 ns.'
```

The figure below draws a circuit as a graph, one box for each gate with its delay, and lights the longest path. Switch between the five circuits, click a gate to change its delay, and watch the answer move, or fail to move.

::critical-path{n="15.2" caption="Start with the AND chain, then the AND tree: the same function, restructured. Then the four-bit adder: click a gate on the lit path and make it slower, then a gate off the path (the slack under its delay says how much slower it may get before it matters). Press the button at the bottom to check the answer against the digital engine."}

:::lab[Find the bottleneck]
1. On **AND chain** the lit path runs from *x*0 through all seven gates: 14 ns. Read *t*<sub>cd</sub>, 2 ns, too: the last input has a single gate to pass. Switch on *Show the shortest path*.
2. Switch to **AND tree**. Every path is now three gates long, and 6 ns; *t*<sub>cd</sub> equals *t*<sub>pd</sub>, and every gate has slack 0, because they are all on a critical path. The circuit is balanced: nothing can be sped up alone.
3. On **4-bit adder**, click the second XOR gate of the sum (*s*1), which is off the critical path. Raise its delay from 3 to 6 ns and *t*<sub>pd</sub> does not change; click one of the carry gates *t*1 or *c*2 and any change goes straight into *t*<sub>pd</sub>.
4. Press **Check on the simulator**. It builds the same gates in the digital engine, flips every input from each of the 512 starting states and reports the latest output change: 19 ns, exactly the critical path.
5. Switch to **False path**: two multiplexers in a row with the same select *s*. The lit path is 11 ns, from *x* through three slow inverters and both multiplexers. Press the button: the simulator’s worst case is 9 ns, and it comes from flipping *s*. The lit path is *false*: to pass the first multiplexer the signal needs *s* = 0, and to pass the second it needs *s* = 1. Static analysis counts it anyway.
:::

:::programmer[Timing analysis is a longest-path problem]
A combinational circuit is a directed acyclic graph: gates are nodes, wires are edges, and a delay hangs on every node. Finding the critical path of a DAG is the algorithm you would write for the longest chain of dependent tasks in a build system:

```ts
for (const id of topologicalOrder) {
  const gate = node[id];
  late[id] = gate.delay + Math.max(0, ...gate.inputs.map((i) => late[i]));
}
const tpd = Math.max(...outputs.map((o) => late[o]));
```

One pass in topological order, so the time is proportional to the number of wires, and the same pass with `min` instead of `max` gives *t*<sub>cd</sub>. A second pass backwards gives each gate its :term[slack]{id=slack}, the delay it could gain without changing *t*<sub>pd</sub>. This is :term[static timing analysis]{id=static-timing-analysis}, and it is how every chip is signed off: no simulation, no input patterns, just a walk over the graph with the delays of a library of gates. Chapter 30 runs it on a placed and routed FPGA design to report *f*<sub>max</sub>.

Two things make it harder than the sketch. The number of paths grows exponentially with depth, so real tools never list paths; they propagate arrival times, as above, and only trace back the few that fail. And the longest path may be a :term[false path]{id=false-path}: a route that no input pattern can make the signal travel, because the gates on it block each other. Static analysis errs on the safe side and reports it anyway, and the last step of the lab above shows one.
:::

## The adder that is not finished

Chapter 14 built the adder that everything else in a computer uses. A ripple-carry adder is a chain of full adders, each passing its carry to the next, and the chain is the critical path: the top bit cannot be right until the carry has travelled through every bit below it. Each stage adds two gate delays to the carry, and the four-bit adder of the last figure has a critical path of 19 ns; an eight-bit one has 35.

Slow the carry down to something you can see. The adder below holds 1111 + 0000 + 0 = 15. Set the carry-in to 1: the right answer is 16, and the carry must get through all four stages to make it.

::ripple-settle{n="15.3" caption="Press the button and read the number under the waveforms while the carry ripples. The four-bit adder settles 16 ns after the carry-in changes; the eight-bit one takes twice as long. Try both."}

For those 16 ns the adder is a liar. The sum bits drop out one by one, and the number on the outputs falls through 15, 14, 12, 8 and 0 before the carry arrives and it jumps to 16. A register that sampled the outputs at any of those moments would store a number that no one asked for, and that is the whole reason a clock has to be slow enough: the period must be longer than the critical path. Chapter 14’s carry-lookahead adder is built to shorten exactly this path, at the cost of more gates.

## Hazards: right on paper, wrong for a moment

The adder’s outputs are wrong while the carry is still on its way, and everyone expects that. The next surprise is that an output can be wrong even when it *should not change at all*. The circuit at the start of the chapter was a small example; here is the general case.

Take the function F = A · B + A′ · C, and set B = C = 1. Then F = A + A′ = 1, whatever A is. Implement it as Chapter 11 taught, an AND gate for each term and an OR gate to join them, with an inverter for A′. The Karnaugh map of Chapter 12 for the function is:

| | BC = 00 | 01 | 11 | 10 |
|---|---|---|---|---|
| **A = 0** | 0 | 1 | **1** | 0 |
| **A = 1** | 0 | 0 | **1** | 1 |

The term A′ · C is the pair of 1s in the top row (BC = 01 and 11); the term A · B is the pair in the bottom row (BC = 11 and 10). The two loops *touch* at the column BC = 11, and they do not overlap. A change of A when B = C = 1 moves the inputs from one cell of the boldface pair to the other, that is, from one loop to the other, and the output is 1 at both ends of the trip. In the circuit, what happens is this. When A falls, the AND gate for A · B turns off after one gate delay, and the AND gate for A′ · C turns on after an inverter delay *plus* a gate delay, which is later. For the difference of the two times, both inputs of the OR gate are 0, and F drops to 0.

:::key[Static hazards]
A :term[static hazard]{id=static-hazard} is a glitch on an output that should stay put. A **static-1 hazard** is a dip in an output that should stay at 1, and it lives at the seam between two product terms that are adjacent on the K-map and not covered by a common term. A **static-0 hazard** is a blip up in an output that should stay at 0, and it is the same thing in a product of sums.
:::

The cure comes from the algebra. The :term[consensus theorem]{id=consensus-theorem} says A · B + A′ · C + B · C = A · B + A′ · C: the third term is *redundant*, it changes no row of the truth table, and that is why a minimiser (Chapter 12) throws it away. But it is the term that covers the seam: when B = C = 1 the gate for B · C is 1 whatever A does, and the OR gate never sees all of its inputs at 0. **Redundant logic that makes a circuit hazard-free is the only kind of redundancy worth its gates.** Huffman’s 1957 paper on designing hazard-free switching networks gave the systematic recipe;:cite[huffman1957] for a two-level circuit and a change of one input it comes to including every prime implicant, consensus terms and all.

```quiz
q: 'F = A·B + A′·C is built with two AND gates, an OR gate and an inverter, with 2 ns in the inverter and 1 ns in each of the other gates. B = C = 1, and you flip A. In which direction does F glitch?'
options:
  - text: When A falls from 1 to 0.
    correct: true
    why: 'A · B turns off after 1 ns. A′ rises after 2 ns, and A′ · C turns on after 3 ns. For 2 ns neither term is 1. When A rises the order is reversed: A · B turns on after 1 ns, A′ · C turns off after 3 ns, so the two overlap and F stays at 1.'
  - text: When A rises from 0 to 1.
    why: 'Rising A turns the term A · B on (1 ns) before it turns the term A′ · C off (3 ns), so the terms overlap and the OR never lets go. The gap opens on the other edge.'
  - text: In both directions.
    why: 'It depends which way the *late* signal is late. The inverted path is the slow one, so only one direction opens a gap.'
  - text: 'In neither: the simulator gives every gate the same delay.'
    why: 'The delays are not the same: the inverter is on one of the two paths and not on the other, and that is the entire source of the gap.'
```

Now hunt for them. The figure below is the circuit with a switch at every input and a timing diagram of every wire that matters. The table under it lists every transition of the circuit, 24 of them for three inputs. Flip the switches, one at a time and let the circuit settle, and each transition you try is filled in: a flat line for an output that stayed still, a step for one that changed, red for a glitch. Then add the consensus term with the toggle and try again.

::glitch-hunt{n="15.4" caption="Level one is the circuit above: with B and C at 1, flip A. Then hunt: how many of the 24 transitions glitch? Add the consensus term, and go through the same transitions again. Try the other circuits (a product of sums, a multiplexer made of NAND gates, a function of four inputs), and try the sliders: at 0 ns the two paths change together and there is nothing to race."}

:::lab[The hazard, the fix and the race]
1. Flip A on the first circuit. On the diagram, find A · B falling at 1 ns, A′ rising at 2 ns, A′ · C rising at 3 ns, and F dipping between 2 and 4 ns. The table marks the cell.
2. Switch on **Add the consensus term (B·C)** and repeat. The OR gate has a third input, B · C, which is 1 all the time and never lets the output fall. The table has no red in it, whichever of the 24 transitions you try.
3. Move to **Product of sums**, F = (A + B)(A′ + C). Its hazard is a static-0: the output rises for a moment where it should stay at 0. Find the transition (B = C = 0, A rising) and note that the consensus term now is B + C.
4. Choose **Multiplexer** (Chapter 13’s two-way switch, from NAND gates). The hazard is at A = B = 1 with S falling: both data inputs agree, yet the output blinks when you change *which one is selected*. This is the hazard in every multiplexer that is not built with care.
5. Drag **Inverter delay** to 0 ns. The hazard vanishes: A′ and A change together, so the OR gate never sees a gap. In real hardware two paths are never exactly equally long, and nobody gets to choose the inverter’s delay by moving a slider; hazards are a property of a circuit that no amount of tidy design can simulate away.
6. Set the delay back to 2 ns and choose **Four inputs**: F = A · B + A′ · C + B′ · D has 64 transitions, and four of them glitch. Find them, then find the two consensus terms that remove them. (The last figure of the chapter and the next section explain what the delay model buttons do.)
:::

:::deeper[Finding hazards without a stopwatch]
Simulating every delay is one way to find a hazard. Eichelberger showed in 1965 that you do not need any delays at all.:cite[eichelberger1965] Give the input that is about to change the value X, “unknown”, and evaluate the circuit with the three-valued logic of Chapter 10, the same X that the digital engine uses for wires nobody drives: an AND with a 0 input is 0 even if another input is X, an OR with a 1 input is 1, and otherwise X spreads. If the output stays a known value, the change is safe. If it becomes X, the output *might* glitch.

For F = A · B + A′ · C with B = C = 1 and A = X, both product terms are X · 1 = X, and X + X = X: hazard. With the consensus term added, the OR has a third input B · C = 1 · 1 = 1, and 1 dominates, so F = 1: safe. The test needs one evaluation per input and starting state, instead of a simulation with time, which is why it scales to circuits of millions of gates. (For a change of two or more inputs at once, X is still right, but the consensus terms of this chapter are no longer enough. Nothing at gate level can save you from those, which is why synchronous design of Chapter 17 does not try.)
:::

### Dynamic hazards

A :term[dynamic hazard]{id=dynamic-hazard} is the same thing at the wrong moment: an output that *should* change once changes three times, 0 → 1 → 0 → 1, or 1 → 0 → 1 → 0. It needs at least three paths of different lengths from the changing input to the output, so a two-level circuit that has its consensus terms in has none for a change of one input (a standard result of hazard theory). Multi-level circuits can have them, and they are harder to remove, because there is no consensus term to add. In practice designers do not chase them. They design so that the glitches are harmless, as the next sections show, and they check the cases where they are not.

## A gate that does not care about a short pulse

You may have noticed that the glitch on F above is exactly as wide as the difference between the two paths, and that the sliders can make it narrower. There is a limit to how narrow a pulse can get and still be a pulse. In Figure 15.4, put **Inverter delay** at 0.5 ns and the delay model at **Inertial**: there is no glitch, although the paths still differ by 0.5 ns. Switch to **Transport**, and it is back.

The simulator has two ideas of a delay, and they are two ways of thinking about what a gate is.

- :term[Transport delay]{id=transport-delay} says a gate is a piece of wire: whatever goes in comes out later, exactly as it was. An input change at time *t* produces an output change at *t* + *t*<sub>pd</sub>, for every change, including a pulse a hundred times shorter than the delay. Long wires and transmission lines behave like this.
- :term[Inertial delay]{id=inertial-delay} says a gate is a piece of wire *with a capacitor on its output*, which is what a gate is (Chapter 10). The output moves toward its new value only as fast as the capacitor charges, and if the input changes back before the output has crossed the threshold, the output turns round without ever getting there: the pulse is swallowed. In the simulation’s terms, a pulse shorter than the gate’s delay is not passed on.

Real gates are inertial, more or less, and a pulse only a little shorter than the delay produces an output that starts to rise, turns round and falls: a runt pulse that does not reach a proper 1. Runts are dangerous for the reason Chapter 16 explains at length. The figure below sends one pulse through a chain of four buffers whose delays are 1, 2, 3 and 4 ns, under both models.

```quiz
q: 'A 1.5 ns pulse arrives at the input of a buffer with a 2 ns delay. What comes out?'
options:
  - text: 'Nothing with inertial delay; a 1.5 ns pulse, 2 ns later, with transport delay.'
    correct: true
    why: 'With inertial delay a pulse shorter than the delay is swallowed, and 1.5 ns < 2 ns. Transport delay passes everything, unchanged in width and shifted by the delay.'
  - text: 'A 1.5 ns pulse, 2 ns later, under both models.'
    why: 'That is transport delay. Inertial delay is the default in the simulator (and in most of real hardware), and it filters pulses shorter than the gate’s delay.'
  - text: 'A pulse of 0.5 ns, the difference between the pulse and the delay.'
    why: 'Neither model shrinks a pulse. A pulse comes out at its full width or not at all; in real gates a pulse just below the limit becomes a runt, smaller in height, not in width.'
```

::pulse-filter{n="15.5" caption="Drag the pulse width from 0.25 ns up to 5 ns. On the left, inertial delay: the pulse dies at the first buffer that is slower than it is long. On the right, transport delay: it goes through all four, always the same width. A pulse exactly as wide as a buffer’s delay gets through that buffer."}

What the two models are for is a matter of taste and truth. Inertial is right for gates, and makes the simulation quieter: many small glitches vanish, as they do in silicon. Transport is right for wires and for asking a pessimistic question: *could* this circuit ever glitch, if some gate were faster than we think? A designer who wants a circuit to be safe checks it under transport delay, since a glitch that is only filtered by inertia will come back if the gates change.

:::hood[How the event queue schedules, and cancels]
The digital engine (`src/lib/sim/digital/engine.ts`) never steps time in fixed slices. Every change of an output is an *event*, “this pin takes this value at this time”, and the events wait in a priority queue ordered by time (`queue.ts`, a binary heap in typed arrays, so pushing and popping never allocate). Simulation is a loop: take the earliest event, apply it to its wire, and evaluate the gates that read the wire, which schedule new events a gate delay into the future. Time jumps from event to event, so a circuit that does nothing for a microsecond costs nothing.

A gate’s evaluation ends in a call to `drive`, and that is where the two delay models differ:

```ts
drive(slot: number, value: number, delay: number): void {
  ...
  const pend = this.drvPending[slot]!;
  if (this.inertial) {
    if (pend !== 0) {
      // Same value already on its way: keep the earlier change.
      if (this.drvPendVal[slot] === value) return;
      this.drvSerial[slot] = this.drvSerial[slot]! + 1;
      this.drvPending[slot] = 0;
      this.drvPendVal[slot] = NONE;
    }
    if (this.drvValue[slot] === value) return;
  } else if ((pend !== 0 ? this.drvPendVal[slot] : this.drvValue[slot]) === value) return;
  this.queue.push(this.now + delay, slot, value, this.drvSerial[slot]!);
  ...
}
```

With inertial delay a new value first *cancels* whatever the output had pending, and then schedules itself (unless the output already has that value). Cancelling is the whole swallowing: a pulse is a change to 1 followed, less than one delay later, by a change back to 0, and the second cancels the first before it has happened. Nothing is removed from the heap: each output carries a *serial number*, cancelling adds one to it, and every event carries the number that was current when it was pushed. When an event comes off the queue with an old number it is dropped:

```ts
if (q.pSerial !== this.drvSerial[target]) continue;
```

That is lazy deletion, and it turns cancelling into a single addition. Transport delay is the same function with the block that bumps the serial left out: nothing is cancelled, and every change gets through.

One more rule explains why setting the inverter delay to 0 in the glitch hunt removes the glitch. Events at the same time are handled in *delta cycles*: first every change due now is applied to its wire, and only then is every gate whose input changed evaluated once. If A · B falls and A′ · C rises at the same instant, the OR gate is evaluated after both, sees a 1 among its inputs, and never schedules the dip. Two changes at one time are a tie, not a race, and the engine has no way to make one of them win. Real hardware has no ties, and that is what hazards are.
:::

## Do glitches matter?

Once you know they exist you meet them everywhere, and it is tempting to believe they must all be removed. They do not. Whether a glitch matters depends on who is listening to the wire, and there are two kinds of listener.

A **sampled** signal is looked at only at chosen moments: the input of a register on a clock edge. A glitch on it is harmless as long as it is over before the moment of sampling, that is, as long as the circuit has settled in time. Synchronous design, the subject of Chapter 17, is the discipline of making that true: a clock slower than *t*<sub>pd</sub>, and so anything wrong for a few nanoseconds is invisible. All the combinational circuits of this course so far are used this way, and nearly all the glitches of a computer are harmless in this sense. (They do cost energy: each one charges and discharges the capacitance of a wire, and Chapter 10 priced that.)

An **acting** signal does something at once, and its every edge counts. A glitch on any of these is a bug that can strike once in a million cycles and leave no trace:

- the **clock** of a register: a glitch is an extra clock edge, so a counter skips a value;
- an **asynchronous reset or preset**: a glitch on it clears a register at a random moment;
- a **latch enable**: a glitch opens the latch for a moment and lets the wrong data in;
- a **chip select or write strobe**: a glitch on the write line of a memory (Chapter 20) writes garbage into a word;
- a **wire that goes to another chip** and is used as an interrupt, a handshake or a strobe.

The rule that designers follow is short: *a signal that acts must come straight from a register, not from logic.* A register’s output changes once per clock and only just after the edge, glitch-free by construction; logic that has to feed a clock or a reset is first registered, so that the glitches die before the wire is used. The other way, adding the consensus terms of this chapter, is the fix for the few places where the signal must be direct.

Here is a small case. The circuit below is the hazard of the last section attached to something that reacts: a flip-flop whose clock input is the output F, and whose data input is tied to 1. Its output Q says whether F has *ever* risen. In the circuit, A is a clock, and B and D are constants 1, so F should stay at 1 for ever and Q should stay at 0.

```debug
id: timing/gated-clock
title: The flag that will not stay down
prompt: |
  The flip-flop FLAG is clocked by **F = A·B + A′·D**. A is a 10 MHz clock, B and D are constant 1, so F should be 1 for ever and never produce a rising edge; the flag Q should stay at 0. It does not stay at 0. Fix the circuit **without changing what F computes**: when D is 0, F must still follow A.

  (The simulator gives the inverter 2 ns and every other gate 1 ns. You can change any gate’s delay, and the check will accept an inverter with no delay at all. Ask yourself whether real gates would ever agree to that, and cover the glitch instead.)
spec:
  scenarios:
    - name: 'A keeps switching, B = D = 1: no edge on F'
      expect: { 'FLAG.Q': low }
      settle: 300e-9
    - name: 'D = 0: F follows A, so the flag is set'
      set: { 'D.value': 0 }
      expect: { 'FLAG.Q': high }
      settle: 300e-9
start: 15-timing/exercises/gated-start.json
solution: 15-timing/exercises/gated-solution.json
hints:
  - Which edge of A makes F dip, and between which two product terms does the output hand over?
  - The two terms A·B and A′·D are adjacent on the K-map. What term covers both of the cells at the seam? Add a gate for it and give the OR gate a third input.
fault: 'F = A·B + A′·D has a static-1 hazard when B = D = 1 and A falls: A·B turns off before A′·D turns on, and F dips to 0 and rises again. That rising edge clocks the flag. Adding the consensus term B·D, which is 1 all the while, keeps the OR gate’s output at 1 and removes the edge.'
```

## Exercises

```quiz
q: 'F = A·B + B′·C is built with an inverter for B′, two AND gates and an OR gate. With A = C = 1, which change of B can make F glitch, given that the inverter is slower than the rest?'
options:
  - text: B falling from 1 to 0.
    correct: true
    why: 'A · B turns off at once, and B′ is late in rising, so B′ · C turns on after A · B has gone: for the gap, F is 0. (The consensus term is A · C, which is 1 all the while.)'
  - text: B rising from 0 to 1.
    why: 'Here the late signal is B′ *falling*, which turns B′ · C off after A · B has already turned on: the terms overlap and F stays at 1.'
  - text: A falling from 1 to 0, with B = C = 1.
    why: 'With B = 1 the term B′ · C is 0 and F = A · B = A, so F is *supposed* to change with A. A change that is supposed to happen is not a static hazard.'
  - text: C changing, with A = B = 1.
    why: 'With A = B = 1 the term A · B is 1 and holds F at 1 whatever C does.'
```

```quiz
q: 'A circuit has four inputs a, b, c, d. g1 = NAND(a, b) takes 1.5 ns. g2 = NOT(g1) takes 1 ns. g3 = NOR(c, d) takes 2 ns. The output is y = AND(g2, g3), and takes 2 ns. What is t_pd?'
options:
  - text: 4.5 ns
    correct: true
    why: 'The paths are a → g1 → g2 → y = 1.5 + 1 + 2 = 4.5 ns, and c → g3 → y = 2 + 2 = 4 ns. The longest is 4.5 ns; the shortest, 4 ns, is t_cd.'
  - text: 4 ns
    why: 'That is the shorter path, c → g3 → y, and it is t_cd. The propagation delay is the longest path.'
  - text: 6.5 ns
    why: 'That adds up every gate: 1.5 + 1 + 2 + 2. A signal does not pass through all of them; g1, g2 and g3 are on different branches, and no path goes through both g2 and g3.'
```

```quiz
q: 'An 8-bit ripple-carry adder, built as in Figure 15.2, has t_pd = 35 ns: 3 ns for the first XOR, then eight AND–OR carry stages of 4 ns each. A designer needs a correct sum every 25 ns. Which single change is enough?'
options:
  - text: Make the XOR gates faster, 1 ns instead of 3.
    why: 'Only one XOR is on the critical path (the one at the start), so this saves 2 ns: 33 ns. The path runs along the carry chain, and a gate that is not on it, or that appears once, cannot pay for eight stages.'
  - text: Make the AND and OR gates of the carry chain 1 ns each instead of 2.
    correct: true
    why: 'Each carry stage drops from 4 ns to 2 ns, so the path is 3 + 8 × 2 = 19 ns, comfortably under 25. This is the only choice that attacks the gates the critical path is made of.'
  - text: 'Nothing can help: an 8-bit ripple adder cannot be faster than 25 ns.'
    why: 'It is a matter of the gates. With faster carry gates the same structure is fast enough; and Chapter 14’s lookahead adder changes the structure to shorten the chain itself.'
```

:::challenge[The one gate you can speed up]
In Figure 15.2’s four-bit adder, an XOR takes 3 ns, an AND 2 ns and an OR 2 ns, and *t*<sub>pd</sub> is 19 ns. You may make *one kind* of gate 1 ns faster, everywhere it appears. Which kind gives the biggest gain, and how much?

*Answer.* The critical path is *a*0 → *p*0 (XOR) → *t*0 (AND) → *c*1 (OR) → *t*1 (AND) → *c*2 (OR) → *t*2 (AND) → *c*3 (OR) → *t*3 (AND) → *c*4 (OR): one XOR, four ANDs and four ORs. Speeding up the ANDs saves 4 ns (19 → 15) and so does speeding up the ORs; speeding up the XORs saves only 1 ns. Do both the ANDs and the ORs and you save 8 ns, to 11 ns. (Try it in the figure: click each gate on the lit path and lower its delay.) The lesson is that a critical path is made of the gates that repeat, which is why Chapter 14’s lookahead adder shortens the chain by changing its structure, not by tuning the gates.
:::

## Build it for real

:::real{parts="74HC14, 74HC08, 74HC32, 100 kΩ resistor, 1 µF capacitor, LED, 1 kΩ resistor, breadboard, 5 V USB supply module, jumper wires"}
**A glitch you can see.** Nanosecond glitches need an oscilloscope, so slow the inverter down until the glitch lasts a tenth of a second. Build F = A · B + A′ · C with B = C = 1, as in Figure 15.4, from a 74HC08 (four AND gates) and a 74HC32 (four OR gates), and make A′ with a 74HC14 *Schmitt* inverter behind a 100 kΩ resistor and a 1 µF capacitor to ground. The Schmitt input matters: it is the one inverter of the family whose output stays clean when its input changes as slowly as this (an ordinary gate would sit in the forbidden zone of Chapter 10, drawing current and perhaps oscillating).

Wire the AND gates and the OR: the 74HC08’s pins 1 and 2 are the first AND (A on pin 1, +5 V on pin 2), pins 4 and 5 the second (A′ on pin 4, +5 V on pin 5); the outputs, pins 3 and 6, go to pins 1 and 2 of the 74HC32, whose output on pin 3 drives the LED through the 1 kΩ resistor. A goes to pin 1 of the 74HC08 *and*, through the 100 kΩ resistor, to pin 1 of the 74HC14, whose pin 2 is A′ and goes to pin 4 of the 74HC08. The 1 µF capacitor connects pin 1 of the 74HC14 to ground. All three chips need +5 V on pin 14 and ground on pin 7, and **every unused input of every gate must be tied to ground** (Chapter 10: a floating input is a bug that works on Tuesdays).

Touch A to +5 V: the LED lights. Move A to ground: the AND for A · B goes off at once and A′ rises only when the capacitor has fallen below the Schmitt trigger’s lower threshold, about 1.4 V typically,:cite[nexperia-74hc14] which takes RC ln(5 ÷ 1.4) ≈ 1.3 RC, roughly 0.13 s. The LED goes dark for about that long, and comes back: the static-1 hazard, slowed down by a factor of ten million. Move A back up: no blink, as the K-map said. Then add the consensus term: a third AND gate with both inputs at +5 V (pins 9 and 10 of the 74HC08) whose output, pin 8, goes to pin 4 of the 74HC32, with pin 5 of the 74HC32 taking F from its pin 3 and pin 6 driving the LED instead. The consensus term is 1 the whole time, and the blink is gone.
:::

## What’s next

Everything so far has a property that we took for granted: the outputs depend on the present inputs and on nothing else. Give a circuit the same inputs and it gives the same answer, however it got there. That is a very strong limit. It cannot count, since it does not know what it counted last; it cannot remember which key you pressed, or that it is halfway through adding two numbers. A machine that computes needs a **memory**, and the memory has to be made of the same gates.

The trick is one wire, drawn from the output of a gate back to its own input. That is **feedback**, and Chapter 16 finds two things in it: a ring of inverters that cannot stop oscillating, and the loop of two gates that remembers a bit. It also finds the worst consequence of everything in this chapter, a wire that a gate cannot decide to make 0 or 1.
