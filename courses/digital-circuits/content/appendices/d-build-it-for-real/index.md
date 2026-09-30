---
number: D
title: Build it for real
summary: "Every lab of the course in one place, with one bill of materials for all of them and a minimal kit for Parts I to IV; the tools and the safety rules; how a breadboard is wired; and what the simulator leaves out that a real bench does not."
duration: Look things up
prerequisites: []
---

Every chapter of the course ends its story in a simulator, and most end it with a box called *Build it for real*: a short experiment on a breadboard, with cheap parts, that shows the same thing on a bench. None of the boxes is needed to follow the course; each is there because a circuit you have wired yourself, with a meter on it, teaches something that a figure cannot. This appendix collects them so that you can plan, buy once and build as you go.

It has five parts. **The labs** lists every box with the parts it names. **The bill of materials** merges all the parts lists into one, with quantities and a minimal kit. **Tools and safety** says what the bench needs besides parts, and how not to hurt yourself or the parts. **Breadboard technique** covers the habits that decide whether a circuit works the first time. **From the simulator to the bench** lists what the figures idealise and a real circuit does not.

Both the list of labs and the bill of materials are made from the chapters themselves: each lab is the `:::real` box of its chapter, and each part is a word of that box’s parts list. When a chapter changes its list, a test of this appendix fails until this page has caught up, so the page cannot quietly disagree with the chapters.

## The labs

There is a lab in every chapter from 0 to 30 and one in Chapter 32. The first ones need nothing but a battery and a multimeter; the logic labs of Parts III to V put one to three 74HC chips on a breadboard and light an LED; Part VI is different, because there the object is a programmable chip and the parts list is a programmer, a cable and a board. Each entry links to the section of its chapter that holds the lab.

::lab-index{n="D.1"}

A few of the labs stand apart. Chapter 0’s costs nothing (an old keyboard), Chapter 3’s is mostly about the multimeter’s dial, Chapter 29’s has nothing to wire (it only says which board the later chapters will use), and Chapter 32’s is a look at the silicon of an old memory chip through its quartz window.

## Bill of materials

Every part named in the parts list of any lab is in the table below, once, in a group with its relatives. Three columns matter.

- **All labs** is the most of that part that any *single* lab needs. Labs are built, tested and taken apart one at a time, so the quantities are not summed: a kit with eight LEDs is enough for every lab, even though a dozen labs use LEDs.
- **Minimal** is the same number over the labs of Parts I to IV (Chapters 1 to 20), a dash if no lab of those parts uses the part. It is the smallest kit that covers every lab from the first multimeter to the first RAM.
- **Chapters** lists the chapters whose labs use the part, as links; a number in the tooltip means more than one is needed there.

::bill-of-materials{n="D.2"}

A few things about how the table is made.

- **Alternatives are counted as written.** A list that says “1N4148 or 1N4007” or “SRAM or EEPROM (a 62256 or a 28C16)” names both, and the bill counts both once. You need one of the pair; the minimal kit includes the ones that Parts I to IV name.
- **Where a lab’s text asks for more than its list says, the bill follows the text.** Chapter 6’s relay gates need a second relay, a second diode and a second switch; Chapter 8’s inverter chain needs two more 2N3904s, its own 4.7 kΩ resistors and pull-ups, and a potentiometer; Chapter 14’s eight-bit adder needs a second 74HC283; Chapter 16’s ring oscillator needs a 74HC04, three 100 kΩ resistors and three 1 µF capacitors; the pull-down resistors of Chapters 20, 23 and 25 are counted; and Chapter 2’s loading demonstration needs a 10 MΩ resistor. The parts lists of those chapters say less than their text, and the bill is the safe side.
- **No prices, no suppliers.** They change, and nothing in the course depends on one. Buy the resistors and capacitors as assorted kits, and the logic chips in the DIP package, because DIP is what fits across the gap of a breadboard (the CPLD of Chapter 27 is the exception, and its lab says how to mount it).
- **Software is free.** PulseView, Yosys, nextpnr-ice40 and Project IceStorm cost nothing and have no quantity.

### The minimal kit

Chapters 1 to 20 need no programmer, no microcontroller, no logic analyser and no FPGA board. The minimal kit is what those labs share: a multimeter, a breadboard with jumper wires and a 5 V USB supply module, a 9 V battery and two AA cells, resistors and capacitors in the values of the table, LEDs, potentiometers, a 1N4148 diode, a 2N3904, a 2N7000 and a BS250, a 5 V relay, switches and pushbuttons, a 7-segment display, an NE555, the 74HC00, 02, 03, 04, 08, 14, 32, 74, 86, 161, 283 and 595, and a 62256 static RAM. Tick “I have the minimal kit” in the table to mark all of it, then use the parts of Parts V and VI as you reach them.

## Tools and safety

### What the bench needs

The parts are the small part of a bench. The tools below are what the labs use, and each one is used for something specific.

| Tool | What the course uses it for | Where |
|---|---|---|
| Solderless breadboard and jumper wires | Every circuit from Chapter 2 to Chapter 27. Nothing is soldered, except that the CPLD of Chapter 27 is a surface-mount chip, which comes on a breakout board or a ready-made dev board. | Chapters 2–27; [technique below](#breadboard-technique) |
| 5 V supply | A USB supply module that plugs into the breadboard rails powers every logic circuit. A 9 V battery or AA cells power the first labs. A bench supply with an adjustable current limit is a luxury, but its procedure (set the voltage, set the limit, then connect the load) is the safest way to try a circuit for the first time. | [Chapter 3](/chapters/the-bench/) |
| Multimeter | Voltage in parallel, current in series (a different socket, and a fuse), resistance with the power off, and continuity to check a wire, a switch or a breadboard rail. Any digital meter will do; its 10 MΩ input is the one the simulator’s voltmeter copies. | [Chapters 1](/chapters/charge-voltage-current/), [2](/chapters/ohms-law/) and [3](/chapters/the-bench/); used in most labs of Parts I and II |
| Logic analyser, with sigrok and PulseView | An 8-channel, 24 MHz USB logic analyser, the cheap kind, with the free PulseView program on the computer. It records several wires at once and decodes SPI and UART. Set its sample rate to at least four times the fastest signal. | [Chapter 24](/chapters/talking-to-the-world/) |
| Oscilloscope (optional) | Nothing in the labs needs one: the labs that would show a nanosecond effect (a glitch, a carry) slow it down until an LED shows it. A scope is worth having if you go on, and Chapter 3 says how to use one; its probe adds about 10–15 pF and its ground clip goes to circuit ground and nowhere else. | [Chapter 3](/chapters/the-bench/); Chapters 14 and 15 |
| Arduino Uno or Nano | A 5 V microcontroller board as a source of SPI signals for the analyser (Chapter 24), and as an EEPROM programmer if you have no other (Chapter 25). Any 5 V board with SPI works. | Chapters [24](/chapters/talking-to-the-world/) and [25](/chapters/programmable-logic/) |
| Universal programmer for EEPROMs and GALs | A TL866-class programmer, with the open-source minipro program, writes the 28C16 EEPROM and the ATF22V10C GAL. The GAL is a 24-pin device and needs the adapter the programmer sells for 24-pin PLDs. | Chapters [25](/chapters/programmable-logic/) and [26](/chapters/pals-and-gals/) |
| JTAG adapter: FT232H and OpenOCD | An FT232H USB breakout board, with OpenOCD on the computer, reads the ATF1502AS’s IDCODE, boundary-scans a pin and programs the chip. The FT232H’s I/O is 3.3 V; check that the CPLD’s inputs accept it. The vendor route is Microchip’s ISP software and its ATDH1150USB cable. | [Chapter 27](/chapters/cplds/) |
| iCE40 board and the open toolchain | An iCEBreaker (an iCE40UP5K), an iCEstick (HX1K) or any board with an iCE40 HX1K, HX8K or UP5K, and a USB cable. On the computer: Yosys for synthesis, nextpnr-ice40 for place and route, and Project IceStorm (`icepack`, `iceprog`, `icebox_explain`, `icetime`) for the bitstream and the board. | Chapters [28](/chapters/inside-an-fpga/), [29](/chapters/describing-hardware/) and [30](/chapters/netlist-to-bitstream/) |
| Odds and ends | A stopwatch (Chapter 4: time a capacitor’s discharge), a small screwdriver (Chapter 0), a 10× loupe or USB microscope and a bright lamp (Chapter 32). | Chapters 0, 4, 32 |

The oscilloscope is the only instrument of Chapter 3 that the labs do not ask for, and the only one that costs real money. Everything else on the list, including the programmer, the analyser and the FPGA board, is optional in the sense that skipping it costs you one lab and not a chapter.

### Safety

The course is built to be safe to try at home, and it stays that way as long as a few rules hold. They are short, and each comes from a chapter that says why.

- **Low voltage only, and mains never.** Nothing in any lab needs more than 9 V, and the labs run from a USB supply module, AA cells or a 9 V battery. Nothing in the course asks you to open anything that plugs into a wall, and Chapter 0 and Chapter 6 say so in as many words: never anything that runs from the mains, and a household staircase switch is not to be opened. If a circuit you build ever needs a mains-powered part, buy it ready-made and sealed.
- **Every LED has a resistor.** An LED is a diode, and its current rises exponentially with voltage (Chapter 7): connected straight to a supply, even for a moment, it dies. The resistor is the current limit. [Chapter 2](/chapters/ohms-law/) gives the rule for choosing it, and the values in the labs (220 Ω to 1 kΩ at 5 V, 390 Ω at 9 V) keep a red LED between about 3 and 18 mA. A USB supply module has no adjustable current limit like the bench supply of Chapter 3, so the resistors are your limit.
- **Never put a meter’s current range across a supply.** An ammeter is a wire. Chapter 3 shows what happens: the fuse in the meter’s current input blows, and on a cheap meter without one something burns. After measuring a current, put the red lead back in the volts socket.
- **Polarity.** An electrolytic capacitor has a stripe on its negative leg, which goes to ground; reversed, it can fail noisily (Chapter 4). An LED’s long leg is the anode, its short leg the cathode (Chapter 2). A diode’s stripe is its cathode (Chapter 5). A battery clip has a red wire for + and a black one for −.
- **A relay needs its diode.** Switching off a relay’s coil makes a voltage spike of hundreds of volts, and the flyback diode, across the coil with its stripe towards the positive side, is what stops it destroying the transistor (Chapters 5 and 6). Fit it first, and do not take it out “to see what happens”: that is what the simulator is for.
- **Never exceed the chip’s supply on an input, or go below ground.** A 74HC input must stay between 0 V and the chip’s own supply, 5 V in every lab. A higher voltage on an input drives current through its protection diodes into the supply (Appendix A, [Logic levels](/appendix/reference/#logic-levels)). That is also the rule for anything that talks to a 3.3 V device: a 5 V output on a 3.3 V input is over its absolute maximum.
- **Tie every input somewhere, and never join two outputs.** A floating CMOS input picks up hum and can sit in the middle of the range, where the chip draws current (Chapter 10). Two push-pull outputs on one wire, at different levels, are the bus contention of Chapter 10, and they can damage a chip: the wired-AND lab uses the open-drain 74HC03 for that reason and forbids the 74HC00.
- **Do not over-drive an output.** A 74HC output can source or sink about 25 mA, and a whole chip about 50 mA (Appendix A, from the data sheets:cite[ti-sn74hc-family]). LEDs on 74HC outputs go through a resistor of 330 Ω or more.
- **Static.** MOSFET gates are damaged by static, so touch something earthed first (Chapter 9). Keep CMOS chips in their foam or tube until you use them, and hold them by the body.
- **Power off before you rewire.** Unplug the USB supply, or lift one rail wire, before you move a jumper: a jumper that falls across the two rails of a live board is a short circuit.
- **Do not open a chip.** Chapter 32’s look at a die is through the quartz window of an old EPROM, and it warns not to remove the lid of that chip or any other: the lid is glued, and taking a package apart takes acids.

## Breadboard technique

A breadboard is forgiving, and it is also where most first attempts fail, for a handful of reasons that have nothing to do with the logic. These are the habits that avoid them.

### How the holes are joined

The five holes of a column, on one side of the central gap, are one piece of metal inside the board. The two halves of a column are not joined to each other, which is why a chip straddles the gap and each of its pins gets a strip of its own. The long rails along the edges run the length of the board and are for power: one for the supply, one for ground. Use the strip and the rail buttons below, or point at any hole, to see what the board joins to it.

::breadboard-diagram{n="D.3"}

Two habits follow from the drawing.

- **Wire the supply first.** Put the chip in, then its two supply pins to the rails, then the decoupling capacitor, and only then the signals. If a circuit misbehaves, the supply pins and the ground are the first things to check with the meter (continuity from the chip’s ground pin to the supply’s ground; 5 V between its VCC and GND pins).
- **Check the rails on a full-size board.** Some full-size boards split their rails in the middle, so that the two halves are not joined. The drawing above does not; if yours does, join the halves with a jumper, or test with the multimeter’s continuity range before you trust it.

### Power pins, and a capacitor at each chip

Every 74HC chip has its supply on the top right and its ground on the bottom left, except the NE555, whose ground is pin 1 (Appendix A, [Pinouts of the lab chips](/appendix/reference/#pinouts-of-the-lab-chips)). The table gives the pins of every chip in the labs, so that you can wire the supply before anything else.

| Chip | Pins | VCC | GND | Source |
|---|---|---|---|---|
| 74HC00 | 14 | 14 | 7 | App. A |
| 74HC02 | 14 | 14 | 7 | App. A |
| 74HC03 | 14 | 14 | 7 | data sheet:cite[ti-sn74hc03] |
| 74HC04 | 14 | 14 | 7 | App. A |
| 74HC08 | 14 | 14 | 7 | App. A |
| 74HC14 | 14 | 14 | 7 | Ch 17 |
| 74HC32 | 14 | 14 | 7 | App. A |
| 74HC74 | 14 | 14 | 7 | App. A |
| 74HC86 | 14 | 14 | 7 | App. A |
| 74HC161 | 16 | 16 | 8 | App. A |
| 74HC283 | 16 | 16 | 8 | App. A |
| 74HC595 | 16 | 16 | 8 | App. A |
| NE555 | 8 | 8 | 1 | App. A |
| 62256 SRAM | 28 | 28 | 14 | Ch 20 |
| ATF22V10C | 24 | 24 | 12 | Ch 26 |

The other thing a chip needs at its supply is a capacitor. When a gate switches, it takes a sudden gulp of current, and without a reservoir nearby the supply rail dips for a few nanoseconds, enough to upset its neighbours. A **100 nF ceramic capacitor** from VCC to GND, as close to the chip as the board allows, is that reservoir: the labs of Chapters 24, 26 and 27 include it, and the CPLD of Chapter 27 wants one at each supply pin. Add one to every chip, even where a lab does not say so. It is the cheapest reliability you can buy, and on a breadboard, whose long, loose wires are inductive, it matters more than on a printed circuit.

### Floating inputs, pull-ups and pull-downs

A CMOS input that is connected to nothing is not at 0: it is at whatever it picks up, and it can sit in the middle of the range, where both output transistors conduct (Chapter 10, “An input nobody drives”). Every input must go somewhere. The labs use a handful of standard ways, and the table lists them.

| Input | Tie it to | Why | Where |
|---|---|---|---|
| An unused input of a gate | 0 V (or +5 V), never left open | A floating input drifts through the forbidden zone; the chip draws current and its output flickers | Chapters [10](/chapters/real-gates/), [12](/chapters/simplifying-logic/), [15](/chapters/timing/) |
| An input driven by a switch | 10 kΩ to 0 V (a pull-down), and the switch to +5 V | With the switch open the input is a firm 0 instead of open | Chapters [13](/chapters/building-blocks/), [14](/chapters/arithmetic/), [21](/chapters/datapath/), [23](/chapters/running-programs/) |
| An active-low input worked by a button | 10 kΩ to +5 V (a pull-up), and the button to 0 V | The input is 1 until the button is pressed | Chapters [16](/chapters/feedback/) and [21](/chapters/datapath/) |
| The preset and clear of a 74HC74 | +5 V, both | They are active low; open, they would clear or set the flip-flop at random | Chapters [17](/chapters/the-clock/) and [19](/chapters/state-machines/) |
| A 74HC595’s clear and output enable | Clear to +5 V, output enable to 0 V | Both are active low | Chapters [18](/chapters/registers-and-counters/) and [24](/chapters/talking-to-the-world/) |
| The reset and load of a 74HC161 that should just count, and its count enables | +5 V, all four | Reset and load are active low, so +5 V holds them off; the two enables are active high, so +5 V lets it count | [Chapter 18](/chapters/registers-and-counters/) |
| An SRAM’s data pin, fed by a switch | 1 kΩ in series | If the chip drives the pin while the switch does too, the resistor limits the fight | [Chapter 20](/chapters/memory/) |

A pull resistor of 10 kΩ is a compromise: small enough to hold the input firmly against stray pick-up, large enough that the button or switch wastes only 0.5 mA at 5 V when it connects the other way.

### Debouncing

A mechanical switch does not close cleanly: the contacts touch, spring apart and touch again for a millisecond or so, occasionally tens of milliseconds, and a fast circuit counts every touch.:cite[ganssle-debounce] Anything that responds to an edge (a counter, a flip-flop that toggles, a state machine) needs a debounced button. The labs use four cures.

| Cure | How | Where |
|---|---|---|
| A resistor and a capacitor in front of a Schmitt-trigger inverter | 10 kΩ and 1 µF give τ = 10 ms, longer than the bounce; the 74HC14’s two thresholds turn the slow ramp into one clean edge | [Chapter 4](/chapters/capacitors-and-time/) (the theory), [Chapter 17](/chapters/the-clock/) (the lab) |
| A two-way button on an SR latch | The first touch of a contact sets or clears the latch and later bounces change nothing | [Chapter 16](/chapters/feedback/) |
| A slow clock instead of a button | The 555 astable of Chapter 17 at about 1.5 Hz gives a clean clock with no button at all | [Chapters 17](/chapters/the-clock/) and [18](/chapters/registers-and-counters/) |
| Waiting in software | After an edge, stop looking for longer than the longest bounce (the course’s board waits 10 ms) | [Chapter 24](/chapters/talking-to-the-world/) |

### Reading a datasheet pinout

A chip’s pin numbers are always drawn as if you were looking at it from above, with the notch (or a dot) at the top. Pin 1 is the first pin to the left of the notch, and the numbers run counter-clockwise: down the left side, up the right. Appendix A draws the pinouts of every chip in the labs as DIP packages ([Pinouts of the lab chips](/appendix/reference/#pinouts-of-the-lab-chips)), with each pin named and numbered, and it gives the habits that save an evening: power first, decouple, tie off unused inputs, remember that the 74HC02 is not laid out like the 00, 08, 32 and 86, and remember that pin *names* differ between makers although the pin *numbers* never do.:cite[ti-sn74hc-family] The data sheet of the exact part number on your chip is the authority, and Texas Instruments’ data sheets are at `www.ti.com/lit/ds/symlink/<part>.pdf`.

Parts that are not chips have orientations too, and getting one wrong is the commonest reason a lab does not work.

| Part | Orientation | Where |
|---|---|---|
| LED | The long leg is the anode and goes towards the +; the short leg is the cathode | [Chapter 2](/chapters/ohms-law/) |
| Electrolytic capacitor | The stripe marks the negative leg, which goes to ground | [Chapter 4](/chapters/capacitors-and-time/) |
| Diode (1N4148) | The stripe is the cathode; across a relay coil it points towards +5 V | [Chapter 5](/chapters/relays/) |
| 2N3904 (TO-92) | Flat face towards you, legs down: emitter, base, collector, left to right | [Chapter 8](/chapters/the-transistor/) |
| 2N7000 and BS250 (TO-92) | The same case, but the source and drain legs are swapped between the two: read each data sheet before pushing either in | [Chapter 9](/chapters/cmos/) |
| Relay | The coil is 70 Ω and the contacts are COM, NC (closed at rest) and NO (open at rest); with the power off, test them with continuity | [Chapter 5](/chapters/relays/) |
| Potentiometer as a rheostat | Use the middle pin and one end pin, and join the unused end pin to the middle one | [Chapter 7](/chapters/diodes-and-leds/) |
| 7-segment display | Check the pinout of your own display; a common-cathode one has its common pin to ground | [Chapter 13](/chapters/building-blocks/) |
| 62256 SRAM (28-pin DIP) | Pin 1 is A14, and the pinout is in the lab | [Chapter 20](/chapters/memory/) |

## From the simulator to the bench

The simulator is a model, and a model is an argument about what does not matter. Appendix C lists everything it leaves out ([What the simulator does not model](/appendix/simulator/#what-the-simulator-does-not-model)). Most of that list is invisible in a lab; the items below are the ones that show, roughly in the order in which a beginner meets them.

| The simulator | On the bench | What to do |
|---|---|---|
| **Every part of a type is identical.** No tolerance, no ageing, no temperature. | Resistors are 5 % off (a gold band), an electrolytic capacitor from −10 % to +50 %, a threshold or a gain differs from chip to chip and from transistor to transistor. Your measured τ is 8 s or 12 s, not 10 (Chapter 4). | Expect a spread. Compare your reading with the prediction to within the tolerances, not to the digit. |
| **Wires are ideal:** no resistance, no capacitance, no inductance, no crosstalk. | A breadboard strip and every jumper add capacitance and pick up noise. Chapter 10’s 5 pF per input is meant to include a few centimetres of wire. | Keep wires short and tidy, keep signals apart from each other, and do not use a breadboard for anything fast. |
| **The supply is an ideal 5 V.** There is no noise and no droop, and so no decoupling. | The rail dips for a few nanoseconds whenever gates switch (Appendix A). | A 100 nF capacitor at every chip. |
| **Gates have no power pins.** A gate in the simulator has inputs and an output, and works. | A chip does nothing until its VCC and GND pins are wired, and it has a fixed number of gates, in a fixed order of pins. | Wire the supply first. |
| **A gate’s delay is a parameter,** 1 ns by default, the same for every load. | A 74HC gate takes about 8 ns, and longer the more inputs it drives (Chapter 10). | Do not trust a bench circuit above a few megahertz, and never a breadboard one. |
| **The digital engine has no voltages:** 0, 1, unknown and floating. | Real levels are voltages with thresholds, a forbidden zone and noise margins (Chapter 10). A floating input is not a tidy Z: it drifts, and picks up hum from your fingers (Chapter 9). | Never leave an input open. |
| **Switches are ideal unless told to bounce.** | Every real pushbutton bounces (Chapters 4 and 17). | Debounce, as above. |
| **Parts have generic values.** | The 2N7000’s threshold is about 2 V, not the simulator’s 1 V, so the CMOS inverter’s jump is over a narrower range than in Figure 9.3. | Read the data sheet of your part. |
| **Nothing burns** except as an event the simulator announces (a resistor over its rating). | An overloaded LED, a reversed capacitor or a short across a supply is a smell, and a dead part. | Follow the safety rules above, and add the resistor. |
| **The FPGA and CPLD models are the course’s own.** The vFPGA’s delays come from a published table, and the vCPLD-32 is not a real part. | A real fitter reports different LUT counts and a different fmax, and the Studio cannot write a JED file for the vCPLD-32 (Chapter 27). | Compare on purpose: Chapter 30 lines up the tools’ reports with the course’s, and Chapters 26 and 27 ask you to report a difference. |
| **The GAL22V10 is a faithful model,** and its JEDEC file programs a real ATF22V10. | If the chip does something other than the Studio predicts, either the model or your wiring is wrong (Chapter 26). | Check the wiring first, then write to the author: that physical comparison is the check the model needs. |

When a circuit works in the simulator and not on the bench, check in this order: the supply pins, with the meter (5 V between VCC and GND, and continuity from the chip’s ground pin to the supply’s); then every input, for one that is floating; then the decoupling capacitor; and only then the wiring against the figure, hole by hole.
