---
number: 0
title: What happens when you press a key?
summary: A zoom from the keyboard to the silicon lattice, the digital abstraction, and a map of the course.
duration: About 25 minutes
prerequisites: []
---

You press the letter A. A few milliseconds later an “a” appears on the screen, and nothing you can see explains how. There is no wire from your finger to the letter. Between the two lie a switch, a scanning circuit, a chip that speaks USB, a processor running instructions, and, underneath all of it, billions of transistors made of a crystal grown from sand, with a few impurities added on purpose.

This course tells the story of that stack from the bottom up, from a battery and a switch to a computer you have built yourself, and then put on a programmable chip. This prologue tells it once from the top down, as a zoom: eight levels and about eight powers of ten, from a 45 cm keyboard to a 5 nm patch of crystal. Take the tour, or drag the slider, and read the caption at each level.

::keyboard-zoom{n="0.1"}

Each level is *made of* the next, and you can use each without knowing how the next works, which is what makes computers possible at all. Every caption ends with the chapter that opens the level up.

## Seven steps from finger to silicon

**1. A switch closes.** Under the key is a switch: two springy metal contacts, or a rubber dome that presses two pads together. A typical mechanical switch triggers about 2 mm into 4 mm of travel, and its whole job is to *join two wires* while the key is down. For a few milliseconds after contact it stutters, opening and closing several times (the contacts *bounce*), one of the first problems you will meet, in Chapter 4. Shannon showed in 1937 that a network of switches can compute, which is Chapter 6.

**2. A circuit scans a grid.** A keyboard with 104 keys does not have 104 wires to its controller. The keys are arranged in a :term[matrix]{id=key-matrix} of rows and columns, with one switch at each crossing that can join a row wire to a column wire. The controller drives *one row at a time* and looks at all the columns: a column that reads high while row 3 is driven means the key at row 3 of that column is down. It repeats this hundreds or thousands of times a second.

```quiz
q: 'A keyboard has 104 keys, wired as a matrix of 8 rows and 13 columns. How many wires must reach the controller chip?'
options:
  - text: '104: one for each key.'
    why: 'That is how it would be with no matrix. The whole point of the grid is to avoid it.'
  - text: '21: eight rows and thirteen columns.'
    correct: true
    why: 'A key is found by its row and its column, so 8 + 13 = 21 wires reach 8 × 13 = 104 keys. Ten times fewer wires, at the price of a little scanning.'
  - text: '8 × 13 = 104, since each crossing needs its own pair.'
    why: 'Each crossing does not need its own wires. The row wire and the column wire are shared by every key along them.'
```

Here is a scanner in miniature. Two rows, two columns, four keys: a clock stands in for the controller, driving row 0 and then row 1 (in real life it runs a thousand times faster). Hold a key down and watch which column lights up, and *when*.

::circuit{src="00-press-a-key/circuits/matrix.json" n="0.2" title="A keyboard matrix, scanned" mode="logic" speed=1 traces="R0,R1,C0,C1" caption="Click and hold the Q, A, W and S keys (the round buttons). A key sets its column high only while its row is being driven, so the controller can tell which key it is from the time slot in which the column goes high. Hold Q and A together: column 0 stays high in both slots, and the controller finds both. In gates, a key is an AND of its row and its button, and a column is an OR of the keys along it."}

:::lab[Be the controller]
1. Hold **Q** and look at the timing diagram. Which of R0 and R1 does column 0 follow?
2. Release Q and hold **A**. Column 0 follows the other row. That is all the controller needs to tell Q from A.
3. Hold **Q** and **S** together. Column 0 pulses with R0, column 1 with R1. Two keys, found separately, in the same scan.
4. Now hold **Q** and **A**. Column 0 stays high in both slots. Can you still tell which keys are down? (Yes: high in the R0 slot means Q, high in the R1 slot means A.)
:::

:::note[Ghosts]
Real key matrices need a diode at every key. Without it, three keys pressed at the corners of a rectangle let current sneak backwards through the fourth crossing, and the controller sees a “ghost” fourth key. The gates above only conduct one way, so they cannot show this. Chapter 7 introduces the diode.
:::

**3. Bits go down the cable.** The controller has found “row 1, column 0”, looks it up in a table (the *HID usage code* for “a” is 4) and puts it in an eight-byte report. To send it, it turns bits into voltages on two wires, D+ and D−. In USB a 0 is a *change* of line state and a 1 is *no change*, which lets the receiver recover the sender’s clock from the data itself; after six 1s in a row a 0 is inserted so that the line keeps changing. The report travels in a *packet*: a synchronising pattern, a type, the data, and a checksum. Try it.

::usb-bits{n="0.3"}

**4. A processor runs instructions.** The computer’s USB controller checks the checksum, stores the report and interrupts the processor, which runs a few thousand instructions to decide that the “a” goes to the window with the cursor in it, and to draw it. A processor core executes billions of instructions a second. An instruction such as ADD is carried out by an **ALU** (arithmetic logic unit), on operands waiting in **registers**: a register is a row of 64 one-bit memories.

**5. Registers and adders are made of gates.** A one-bit adder is a handful of logic gates: an XOR for the sum, an AND for the carry. A 64-bit adder is 64 of them side by side, plus a little logic to make the carries quick. A register bit is a **flip-flop**, a few gates connected in a loop so that they remember. *Everything* a computer does is a very large collection of such gates, and Chapters 11 to 24 build them.

**6. Gates are made of transistors.** In today’s chips a gate is built from **CMOS** transistors, switches worked not by a magnet but by a voltage. A NAND gate is four of them, and a processor contains tens of billions. Chapters 8 and 9 explain the transistor, and why pairing one that conducts for a high input with one that conducts for a low makes a gate that uses almost no power except when it switches.

**7. Transistors are made of doped silicon.** A transistor is a piece of silicon crystal in which some regions have a few atoms replaced by phosphorus, which adds a spare electron, or by boron, which leaves a hole where one should be. Each region conducts differently, and at the boundaries between them current can be made to flow or stop. In the heavily doped source and drain of a transistor, up to about one atom in 500 is a dopant.:cite[sze2007] That tiny fraction changes the crystal’s conductivity by many orders of magnitude. It is Chapter 7’s subject.

The zoom shows two more things that the steps skip: the circuit board that carries the controller (between steps 2 and 3), and the layers of metal wire that join the gates to one another (between steps 5 and 6).

```quiz
q: 'ENIAC (1945), an early general-purpose electronic digital computer, had 17,468 vacuum tubes, each one a switch. Apple’s M2 Ultra processor (2023) has 134 billion transistors. About how many times as many switches is that?'
options:
  - text: 'About a thousand times as many.'
    why: 'Only 17 million. A thousand times as many would be 17 million.'
  - text: 'About a hundred thousand times as many.'
    why: 'That would be 1.7 billion. Chips are far past that.'
  - text: 'About eight million times as many.'
    correct: true
    why: '134 × 10⁹ ÷ 17,468 ≈ 7.7 × 10⁶. About seven orders of magnitude between them, in 78 years.'
  - text: 'About eight billion times as many.'
    why: 'That would be 140 trillion transistors. The largest chips have hundreds of billions.'
```

:::history{year=1945 title="ENIAC" people="J. Presper Eckert, John Mauchly and the ENIAC team" source="Sources: Weik (1961); Apple (2023)."}
ENIAC, finished in 1945 at the University of Pennsylvania, filled a room with 17,468 vacuum tubes. It could do 5,000 additions a second. An Apple M2 Ultra has 134 billion transistors, some 7.7 million times as many switches.

The Army had asked for a machine to calculate artillery firing tables. The result weighed more than 30 tons, took up about 167 square metres and used about 150 kW of electricity. According to the 1961 account by Martin Weik of the Ballistic Research Laboratories, it contained 17,468 vacuum tubes, 7,200 crystal diodes, 1,500 relays, 70,000 resistors, 10,000 capacitors and about five million hand-soldered joints.:cite[weik1961] It could add two ten-digit numbers in 200 microseconds.

Seventy-eight years later, Apple’s M2 Ultra joined two dies in one package and held 134 billion transistors.:cite[apple-m2-ultra] Nothing about *what* a switch does has changed: it is a device whose state is controlled by something other than itself. Everything that has changed is how small, cheap and fast the switch can be made. Chapter 32 tells how.
:::

## The digital abstraction

Why can billions of switches work together without their errors piling up? Because of a promise.

A wire carries a voltage, and a voltage is a continuous quantity: 2.71 V, 4.9998 V, 0.3 V. A computer built to be sensitive to it would be an analogue computer, and every bit of noise (a neighbouring wire, a bad contact, heat) would change its answer. A digital circuit treats a wire more crudely, and that crudeness is the :term[digital abstraction]{id=digital-abstraction}. It agrees to divide the voltage range into just two regions and one gap: for 5 V logic, **above 3.5 V is a 1, below 1.5 V is a 0, and in between nobody promises anything.**:cite[ti-sn74hc04] And it builds every gate to keep the promise on the *output* side: a gate sends out 0.1 V or 4.9 V, never anything in the gap. So a 1 leaves a gate at 4.9 V and can lose up to 1.4 V on the way, to noise, to resistance, to the neighbours, before it reaches the next gate, and the next gate will still read it as a 1 and send out a fresh 4.9 V. That 1.4 V is the :term[noise margin]{id=noise-margin}.

::thresholds{n="0.4"}

Notice what happened: the message did not get a little worse at every stage. It stayed *exactly* the same, or it was lost. That is why billions of gates can switch billions of times a second and every answer still be exactly right. It is the idea of the relay repeater of Chapter 5, restoring a fading telegraph signal, and Chapter 8 shows how a transistor’s gain does it with no moving parts. The rest of the course studies when the promise holds, and the analogue effects that strain it: delay, glitches, metastability.

:::programmer[An abstraction with a contract]
The digital abstraction is an interface, like an API: a precondition (inputs above 3.5 V or below 1.5 V), a postcondition (outputs above 4.9 V or below 0.1 V), and so you can reason about each gate in isolation and compose them. When the contract is broken (a signal in the gap, a change too close to a clock edge) the behaviour is *undefined*, as in C: it may work, it may fail, and it may work on Tuesday.
:::

:::hood[How the zoom is drawn]
Each of the eight levels is drawn in one frame of 640 × 400 units, and is what you would see if you zoomed into a small rectangle of the level above, its *focus*. The real width of each picture is known (45 cm, 12 cm, 35 mm, 14 mm, 5 mm, 30 µm, 1.6 µm, 5 nm), so a focus rectangle is the frame divided by the ratio of the two widths, and the scale bar is honest even where the drawings are diagrams. Between two levels the camera does not zoom linearly (it would seem to slow down as it went in) but along the curve of van Wijk and Nuij, in which the visible rectangle shrinks exponentially while its centre moves so that the focus exactly fills the frame at the end.

```ts
/** Fraction of the way the visible rectangle has moved to the focus when the zoom is `t` (0..1) of the way there. */
export function pan(t: number, S: number): number {
  if (S <= 1 + 1e-9) return t;
  return (1 - S ** -t) / (1 - 1 / S);
}
```

`S` is the zoom factor from one level to the next: 3.75 from the keyboard to the circuit board, 167 from the die to a block of gates, 320 from one gate to the crystal. The tests check that consecutive levels stay locked together at every step. With reduced motion the slider steps from level to level and nothing moves.
:::

## How the course climbs

The course starts at the bottom of that zoom and works upwards. Each part uses only what the ones before it built.

| Part | Chapters | What you build |
|---|---|---|
| **I. Electricity, just enough** | [1 Charge, voltage and current](/chapters/charge-voltage-current/), [2 Ohm’s law](/chapters/ohms-law/), [3 The bench](/chapters/the-bench/), [4 Capacitors](/chapters/capacitors-and-time/), [5 Relays](/chapters/relays/) | Circuits with a battery, a switch and a relay; the instruments you will use |
| **II. Switches that compute** | 6 Shannon’s switches, 7 Semiconductors, 8 The transistor, 9 CMOS, 10 Real gates | Logic from relays, then from transistors: an inverter and a NAND gate |
| **III. Logic** | 11 to 15 | Boolean algebra, simplification, multiplexers, decoders, adders, timing |
| **IV. Memory and time** | 16 to 20 | Latches, flip-flops, counters, state machines, memories |
| **V. Build a computer** | 21 to 24 | A datapath, a control unit, an instruction set and programs, all from your own parts |
| **VI. Programmable logic** | 25 to 31 | PROMs, PALs, CPLDs, FPGAs; a hardware language; your CPU on a virtual chip |
| **Epilogue** | 32 | From one breadboard to billions of transistors |

There are a few tools that come with it:

- **The :term[parts bin]{id=parts-bin}.** When you build a part (an inverter, a full adder, a flip-flop, a counter) and it passes its checker, it goes into your bin as a black box with fixed pins, and later chapters build from the bin. The CPU in Part V is made entirely of your own parts. Skipping an exercise never blocks a later chapter: every part has a reference version, and you can switch between yours and the reference.
- **The bench.** Every live circuit runs on a simulator written for this course: click its switches, hover over any wire for its voltage, watch current as moving dots. The bench is a sandbox, with a multimeter, an oscilloscope and a logic analyser, where you can wire up anything you like. Chapter 3 is a tour.
- **The Device Studio.** In Part VI you program *virtual chips*, from a PROM up to an FPGA, and see the logic you meant and the configuration bits of the chip side by side, linked element by element.
- **History cards.** The flip cards like the one about ENIAC put each idea at the moment somebody had it, and are collected on a timeline in Appendix H.
- **Under the hood** boxes show how the simulator or toolchain does what you just saw, with a piece of its real code. **Deeper** boxes hold the calculus. Every chapter reads perfectly well with both closed.
- **Build it for real.** Most chapters have an optional lab in real parts at 5 V or below: an LED, a relay, a 74HC gate, and finally an FPGA. You can follow the course without ever picking up a soldering iron.

:::real{parts="an old USB keyboard (unplugged), a small screwdriver, a multimeter"}
The best introduction to this chapter costs nothing. Unplug an old USB keyboard, take off a few keycaps (a flat screwdriver, gently), and unscrew the back. Under the keys you will find either a plastic membrane with printed tracks or a circuit board with a switch at every position. Follow the tracks to the black chip near the cable: that is the controller of level 3 in the zoom. If you have a multimeter, set it to continuity (Chapter 3) and touch its probes to the two pads of one switch; press the key and hear the beep. You are the controller. Never open anything that is plugged in, and never anything that runs from the mains.
:::

## What's next

Chapter 1 goes to the very bottom of the stack: what is actually moving in a wire, how fast, and what a volt is. Chapter 2 adds resistors and Ohm’s law, and by Chapter 5 you will have the first switch that is worked by another circuit, the relay. When you reach the end of the course you will be able to come back to the zoom above and explain every level of it.
