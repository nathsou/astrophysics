---
number: 26
title: PALs and GALs
summary: Fix the OR plane, put a flip-flop and a polarity fuse on each output, make the cells erasable, and you have the chip that replaced a drawer of 7400s for twenty years, and a fuse file you can burn into a real one.
duration: About 1½ hours
prerequisites: [programmable-logic]
---

The PLA of Chapter 25 is general, and generality costs. In the 82S100 every one of the 8 outputs can add up any of the 48 product terms, so the OR plane is a grid of 384 fuses, and the signal on every term wire has to pass a fuse to reach each of eight OR gates, however few of them use it. All that wiring adds capacitance and delay. And in practice a designer uses the freedom rarely: most outputs of a real design need a handful of terms of their own, and the terms that two outputs share are the exception.

So suppose we take the freedom away. Give each output its own small group of product terms, wired to its own OR gate for ever, and let the designer program only the AND plane. The chip gets smaller, faster and cheaper, and the price is one thing.

```quiz
q: 'If each output of a PLA is given a fixed group of eight product terms of its own, and only the AND plane stays programmable, what can the chip no longer do?'
options:
  - text: Share a product term between two outputs, or give one output more than eight terms.
    correct: true
    why: 'A term now belongs to exactly one OR gate, so two outputs that need the same AND must build it twice, and an output that needs nine terms has nowhere to put the ninth. Every design has to fit those limits, and that is why fitting becomes a topic in this chapter.'
  - text: Compute an OR of the inputs.
    why: 'Every output still has its OR gate; only the choice of *which* terms it adds is fixed. An OR of single-literal terms is fine.'
  - text: Compute any function of the inputs at all.
    why: 'Any function that fits in eight terms is still possible, and many useful ones do. What you lose is the freedom to give one output more than its share.'
```

That trade was made in 1978, and it worked so well that the result, the **PAL**, became the first widely successful programmable logic device. This chapter follows it: how the PAL was made more useful by giving each output a macrocell, how the GAL made it erasable, and how you go from a set of equations to a file of fuses that a programmer can burn into a real chip.

## Programmable AND, fixed OR

The idea is to keep only what designers use. In a :term[PAL]{id=pal} (programmable array logic) the AND plane is programmable, as in a PLA, but each output has its own OR gate with a fixed number of product terms wired to it. Nothing is shared, and the OR plane needs no fuses at all: a smaller array, shorter wires and a faster chip. Programming is one plane, not two.

The names of the classic parts read like a code. A PAL16L8 has up to 16 inputs to the array (some are pins, some are feedback from the outputs), eight outputs, and the *L* says that they are combinational and active-low. The PAL16R8 has eight *registered* outputs, the 16R4 four registered and four not. They came in a 20-pin package, where the PLAs were in 28 pins.:cite[wiki-pal]

:::history{year=1978 title="The PAL" people="John Birkner, H. T. Chua, Andy Chan, Monolithic Memories"}
Monolithic Memories, Inc. (MMI), a Californian semiconductor company, introduced the PAL in March 1978. John Birkner and H. T. Chua, who worked with Andy Chan, traded some of the flexibility of the PLAs then on the market for speed and cost, keeping the programmable AND array and fixing the OR gates.:cite[wiki-pal] Their patent, filed in May 1977 and granted in November 1978, describes “a programmable array or matrix” interconnecting the inputs and the AND gates, whose outputs are “subgrouped and nonprogrammably connected” to the OR gates.:cite[us4124899] The name PAL is a trademark of MMI.

A design tool followed. **PALASM**, the PAL assembler, turned Boolean equations into the fuse pattern for the programmer, and MMI wrote it in FORTRAN IV and gave the source away.:cite[wiki-palasm] It is the ancestor of every equation-to-fuses tool since, including the fitter in this chapter.
:::

The first thing a fixed OR gate changes is how you think. In a PLA the question was “how many terms in all?”. In a PAL it is “how many terms *does each output need*?”, and Chapter 12 becomes the designer’s daily tool. Minimising an output is no longer a way to save area but a way to *fit*: an output that needs nine terms does not go in a macrocell that has eight, and the only remedy is to simplify it, or to split it in two.

## The output macrocell

At its simplest a PAL output is just an OR of terms. But a state machine needs registers, and a designer who wanted one from such a part needed a separate flip-flop chip. The obvious step is to put the flip-flop on the output, and around it a few multiplexers and fuses: the :term[output macrocell]{id=macrocell}. The one in the GAL22V10 has four ingredients.

- **A register or a wire.** A fuse selects whether the output is the OR of the terms directly (combinational), or the same value clocked into a D flip-flop first. The registered outputs are what turn a PAL into a state machine (Chapter 19).
- **A polarity fuse.** An XOR gate at the output, with one input tied to a fuse, inverts the output if the fuse says so. The pin can then be *active high* (1 means on) or *active low*. Why that matters is the next section.
- **An output enable.** The pin is driven through a tri-state buffer (Chapter 10) whose enable is its own product term, so that the output can be a bus driver, or can turn itself off to be an input.
- **Feedback.** The value of the macrocell goes back into the AND array as another input, so that any output can be used by the terms of another, or by its own: a register that depends on its own value is a counter.

```quiz
q: 'A macrocell is set to registered, and its Term 1 is 1 before the chip has ever been clocked. The polarity is active low. What does the pin show at power-up?'
options:
  - text: 0, because the term is 1 and the pin follows it.
    why: 'A registered output does not follow its terms, it follows the flip-flop, which is clocked only on a rising edge of the clock.'
  - text: 1, because the register powers up at 0 and an active-low pin shows its inverse.
    correct: true
    why: 'Every register of a GAL is cleared at power-up, so Q is 0. An active-low pin shows the inverse of Q, which is 1. The 1 on the term will reach the register only at the first clock edge. (An active-high registered pin would show 0.)'
  - text: Z, because nothing has been clocked.
    why: 'Z is the output-enable’s business. With the enable on, the pin is driven, and here it is driven by the register’s power-up state.'
```

::circuit{src="26-pals-and-gals/circuits/macrocell.json" n="26.1" title="An output macrocell" mode="logic" speed=1e-6 caption="Two product terms (switches) feed the OR gate. Flip Registered to send the sum through the flip-flop: now the pin changes only when you press Clock. Invert applies the polarity XOR after the register, as the GAL22V10 does. Turn Enable off and the pin goes to Z (dashed grey). The Feedback probe shows what goes back to the array: the pin when the output is combinational, and the flip-flop’s inverting output when it is registered."}

:::lab[Poke the macrocell]
Use Figure 26.1.

1. With Registered off, set Term 1, then Term 2, then both. The pin is the OR of the terms, and Feedback equals the pin.
2. Turn on Invert. The pin is now the NOR of the terms. The polarity fuse costs nothing, and it lets a macrocell hold *either* a function or its complement.
3. Turn Registered on, and set Term 1. Nothing happens until you press Clock: the pin shows the register, not the term. Press it: the pin follows. Clear Term 1: the pin does not change until the *next* press.
4. Look at the Feedback probe. With Registered on and Invert off, it is the *opposite* of the pin. The register’s output that goes back to the array is its inverting output, whatever the polarity, so a term that reads the state of its own output has the sign flipped in the fuse map. You will meet that again when you read a JEDEC file, and you will not notice it in an equation, because the fitter puts the sign right.
5. Turn Enable off. The pin floats to Z. This is how a macrocell becomes an input pin: the feedback still carries whatever the outside world puts on the wire.
:::

## Fitting: terms, limits and polarity

A designer writes equations, and something must turn them into fuses. The tool is a :term[fitter]{id=fitter}, and for a PAL or a GAL it has three jobs.

1. **Minimise** every output. The fitter uses the tools of Chapter 12, exact Quine–McCluskey for small functions and Espresso-style heuristics for larger ones, since the number of terms is the number that matters.
2. **Choose a polarity**, the true output or its complement, whichever needs fewer terms.
3. **Assign pins**, so that each output lands on a macrocell that has enough product terms.

The second job is a trick that comes from De Morgan’s laws (Chapter 11). If a function needs many terms, its *complement* may need few, and since each macrocell can invert its output for nothing, the designer can store the complement and let the XOR undo it. Take a lamp that lights unless a fault flag G is set, *or* all of A, B, C are on, *or* all of D, E, F are on:

`Y = !(G | A & B & C | D & E & F)`

Written as a sum of products, `Y` needs one term for every way of *not* triggering any of the three conditions: not G, and one of three not-A-B-C choices, and one of three not-D-E-F choices, which is 3 × 3 = 9 terms. Its complement is the three conditions ORed together: 3 terms.

```quiz
q: 'A GAL22V10 has macrocells with 8, 10, 12, 14 and 16 product terms. Y above needs 9 terms active high and 3 active low. Can Y go in the macrocell of pin 23, which has 8 terms?'
options:
  - text: No, because it needs 9 terms and 9 is more than 8.
    why: 'That is true active high, which is the way the equation is written. But the macrocell can store the complement and invert it on the way out.'
  - text: 'Yes, if the fitter stores the complement: 3 terms, inverted at the pin.'
    correct: true
    why: 'The pin shows Y whatever the macrocell stores, so the fitter is free to store /Y with 3 terms (`/Y = G + A*B*C + D*E*F`) and let the polarity XOR invert it. It fits in an 8-term macrocell with room to spare.'
  - text: Yes, because the OR gate is fixed and can simply ignore the extra term.
    why: 'The OR gate has exactly eight terms wired to it; there is no ninth. A function that needs nine terms in the polarity the macrocell holds will not fit.'
```

::polarity-demo{n="26.2" caption="This is the course’s real fitter. Choose System OK, put it in the 8-term macrocell of pin 23 and force Active high: it does not fit, and the message says what is needed and where there would be room. Switch to Active low, or to “Let the fitter choose”: 3 terms. All clear is the mirror case: 1 term active high, 4 active low. 5-input parity needs 16 terms whichever way round, so it fits only the two biggest macrocells."}

Notice the third preset: polarity is no help to parity. The complement of an odd number is an even number, and it is exactly as big. The only cure is to change the design: compute part of it somewhere else, in another output whose pin can be used as an input.

## From the PAL to the GAL

A PAL was programmed once, by blowing fuses, so a mistake or a change meant a new chip. Lattice Semiconductor’s answer, in 1985, was the :term[GAL]{id=gal}, *generic array logic*: a PAL whose fuses were replaced by EEPROM cells, the floating-gate cells of Chapter 25, which are erased electrically, with no ultraviolet lamp and no quartz window, and whose macrocells were made *configurable*, so that one part could stand in for many of the older PALs.:cite[wiki-gal] A GAL16V8, for instance, can act as a 16L8, a 16R8 or as several other members of the family, with the configuration written into cells alongside the array. The *V* stands for “variable”, and the cells were made in a low-power CMOS process, so the chips were also cooler than the bipolar PALs they replaced. Designers now programmed a chip, tried it, found the bug, erased the chip and tried again, all in an afternoon and with a single part.

:::history{year=1985 title="The GAL" people="Lattice Semiconductor"}
Lattice Semiconductor introduced the generic array logic device in 1985. It kept the PAL’s architecture, a programmable AND array feeding fixed OR gates, but stored the configuration in electrically erasable CMOS cells (E²CMOS), so that a chip could be erased and reprogrammed in seconds, and gave it output logic macrocells (OLMCs) that a designer could set to any of the PAL’s output styles.:cite[wiki-gal]

Its descendants were built by several companies. The **22V10**, a ten-macrocell device first made as a bipolar PAL, became the workhorse, and it is still made: Atmel’s ATF22V10, now Microchip’s, is a drop-in replacement for the Lattice part, programmed by the same JEDEC files. Chips of this kind decode the addresses of countless computers, arcade boards and instruments.
:::

## The GAL22V10

The GAL22V10 is the device the course models, with a fuse map identical to the real one. It has 24 pins, and this is what each is for:

- **pin 12 is ground and pin 24 is +5 V**;
- **pins 2 to 11 and 13** are dedicated inputs: eleven of them, and **pin 1** is a twelfth that doubles as the **clock** of the registers;
- **pins 14 to 23** are ten *I/O pins*, each with its own output macrocell. A macrocell can drive its pin, or be turned off so that the pin is an input.

The macrocells are not equal. From pin 23 down to pin 14 they have **8, 10, 12, 14, 16, 16, 14, 12, 10 and 8** product terms: 120 in all, and 130 with their output-enable terms. Two more rows in the array are special: a shared **asynchronous reset** (AR), which clears every register the moment it is true, and a **synchronous preset** (SP), which sets every register at the next clock edge.

The fuse map is the array and the configuration:

| Region | What it holds | Fuses |
|---|---|---|
| The AND array | 132 rows × 44 columns: the 22 signals, each in true and complement form. Rows: AR, then for each of the 10 macrocells an output-enable row followed by its product terms, then SP | 5,808 |
| Configuration | two fuses for each of the ten macrocells: registered or not, active high or low | 20 |
| Signature | eight bytes of the designer’s own, readable even when the chip is protected | 64 |
| Total | | **5,892** |

The array rows are 5,808 fuses, of which a small design connects a few dozen, as the Studio’s report will tell you.

## The flagship: fit a design

Everything in this chapter is in the Studio. Below is a GAL22V10 with a traffic-light controller in the source pane: the state machine of Chapter 19, whose two-bit state is held in the registered outputs Q1 and Q0, with six lamps decoded from it and an asynchronous reset. (Chapter 19 develops the design; here we only fit it.) The equations use the syntax the Studio accepts, `&`, `|`, `!` and `^`, with `.R` for a registered output. DCL, the course’s hardware language, arrives in Chapter 29 and replaces them.

::device-studio{device="gal22v10" example="traffic-light" views="source,chip,logic,bits,report" n="26.3" caption="Edit an equation and the fuse map follows. In the chip view, hover a fuse to see the input and the product term it joins, and a macrocell to see its configuration. Scroll or use the + and − buttons to zoom the chip, and drag to move it. The bits view lists all 5,892 fuses, and the report shows utilisation and the polarity the fitter chose. Download the JEDEC file (or the galette .pld) from the toolbar. The example picker is in the Source tab."}

:::lab[Fit three designs]
Use Figure 26.3.

1. **The traffic light.** Look at the report: 10 product terms in 8 macrocells. The two registers Q1 and Q0 take two terms each, and each of the six lamps one. Hover the fuses of the Q0 macrocell: they connect the state bits, CAR and T to its two product terms. Set CAR and T in the run bar and step the clock: watch the state move, and the lamps with it.
2. **A seven-segment decoder.** Pick *7-segment decoder* in the example picker of the Source tab. The equations list every lit digit as a sum of minterms, and the pragma `# @dc S* : D & (C | B)` says that codes 10 to 15 never occur, so the outputs are free there. The fitter needs **15 terms** for all seven segments (at most 3 for one segment), and it chose *active low* for all seven, since active high would have needed 25. Delete the `# @dc` line and fit again: **26 terms**. Knowing which inputs cannot happen is worth eleven product terms.
3. **Too many terms.** At the end of the decoder source, add the line `P = A ^ B ^ C ^ D ^ E ^ F`. The fitter refuses: *Output P needs 32 product terms (32 active high, 32 active low), more than any macrocell has (the largest, pins 18 and 19, have 16).* It tells you how to fix it: split the function. Now delete the F, and fit the parity of five inputs. It needs exactly 16 terms, takes one of the two 16-term macrocells (pin 18 or 19), and the segments move to the others.
:::

## The fuse file

The Studio’s output is a :term[JEDEC file]{id=jedec-file}, the format in which every PLD programmer of the last forty years is fed. JEDEC is the standards body of the semiconductor industry, and its standard JESD3 defines the text format for transferring a fuse map to a programmer.:cite[jedec-jesd3] The file is plain ASCII. It starts with a byte 02 (STX) and a description, then has a series of fields that each begin with a star, and it ends with a byte 03 (ETX) and a checksum:

- `*QF5892` says how many fuses the device has, and `*QP24` how many pins;
- `*F0` says that every fuse not listed is 0, and `*G0` that the security fuse is not set;
- each `*L` field starts at a fuse address and lists the states of the fuses from there on, a `0` for a connected crosspoint. A GAL row is 44 fuses, and unused rows are left out;
- `*C` is the **fuse checksum**: the sum of all the fuses, taken as bytes;
- after ETX comes the **transmission checksum**: the sum of every byte in the file from STX to ETX.

A programmer recomputes both checksums before it burns anything, which catches a bit that changed in transit, or a file edited by hand. The inspector below opens a real file from the fitter, line by line.

::jedec-anatomy{n="26.4" caption="Hover or focus a line to see what it is: a fuse line tells you its row of the array, the macrocell it belongs to and the equation it computes. Click a bit of a fuse line to flip that fuse. With “Rewrite the file” both checksums follow the change. Switch to “Edit by hand” and flip a fuse again: only the bit changes, the checksums in the file are now wrong, and the programmer refuses the file. To flip a fuse from the keyboard, type its number in the box."}

:::lab[Break a file]
Use Figure 26.4.

1. Select the `*C` line and read the fuse checksum (6A96 for the traffic light). It is the sum of the fuse map’s bytes, with fuse 0 in the least significant bit of the first byte.
2. Flip fuse 0 with *Rewrite the file*. The checksum moves by exactly 1, because you changed the lowest bit of the first byte. Flip fuse 7: it moves by 128. And the transmission checksum at the bottom moves with it, since it adds up the whole file, including the `*C` line.
3. Switch to *Edit by hand* and flip any fuse. Nothing else changes, and the verdict turns red: the file is now inconsistent with its own checksums, and a programmer would not burn it. That is the point of a checksum.
4. Look at the `*L` line for the row of the AR term: one bit is 0, and it belongs to RST. The file’s way of saying “reset is RST” is a single 0.
5. Pick the configuration line and read the ten pairs of fuses. Q1 and Q0 are registered and active high, and the six lamps are combinational.
:::

The signs in a fuse line are not always the signs you wrote. The register inside a macrocell feeds the array with its *inverting* output (Figure 26.1), so the fuse map holds the opposite of the literal for a registered, active-high output, and the inspector undoes the sign, so that the term it prints is the one you wrote: `CAR · T · /Q0`, though the fuses say `Q0`.

## Under the hood

:::hood[The fitter and the fuse numbers]
The fitter is `src/lib/pld/devices/gal22v10-fit.ts`. For each output it minimises the function both ways round, with the tools of Chapter 12, and chooses the polarity:

```ts
const high = canonical(minimise(on, dc, opts).cubes, n);
const low = canonical(minimiseComplement(on, dc, opts).cubes, n);
const pol = spec.polarity ?? (spec.registered ? 'high' : 'auto');
const cost = (c: Cube[]) => coverCost({ n, cubes: c });
const lowCheaper = (() => {
  const a = cost(low);
  const b = cost(high);
  return a.cubes < b.cubes || (a.cubes === b.cubes && a.literals < b.literals);
})();
const polarity: 'high' | 'low' = pol === 'auto' ? (lowCheaper ? 'low' : 'high') : pol;
```

The rule is the one of the polarity demo: fewer terms wins, and on a tie, fewer literals. Registered outputs default to active high, because a register powers up at 0 and an active-high output then powers up in the all-zero state that the equations assume. Then the pins. Outputs are placed *largest demand first*, each on the smallest free macrocell that has enough terms:

```ts
const order = work
  .map((w, i) => ({ w, i }))
  .filter(({ w }) => w.spec.pin === undefined)
  .sort((a, b) => b.w.need - a.w.need || a.i - b.i);
for (const { w } of order) {
  const pin = pinsWithAtLeast(Math.max(w.need, 0), free)[0];
  if (pin === undefined) throw overflow(w, free, undefined);
  free.delete(pin);
  take(w.spec.name, pin, 'output');
}
```

Placing the biggest output first is the classic rule for putting things of different sizes into slots of different sizes, and the reason why the 5-input parity of Figure 26.3 pushed the segments out of pins 18 and 19. If nothing fits, `overflow` builds the message you saw, listing the free macrocells that would have been big enough.

Then the fuses. Their numbering is fixed by the layout in `src/lib/pld/devices/gal22v10.ts`, quoted from its header:

```text
The array has 132 rows of 44 fuses (5,808 fuses): row 0 is the asynchronous reset (AR) term;
then, for each OLMC from pin 23 down to pin 14, one output-enable row followed by its product
term rows; row 131 is the synchronous preset (SP) term. […] fuse number = 44 × row + column.
```

So fuse 2116, say, is column 4 of row 48, and the pin of a signal decides its column: dedicated pin *p* at column 4(*p* − 1), macrocell pin *p* at column 2 + 4(23 − *p*), with the complement in the next column. That layout is not the course’s invention. It is the layout of galette, Simon Frankau’s Rust port of the assembler GALasm,:cite[galette] and the course’s JEDEC writer, in its `galette` style, produces byte for byte the file that galette writes, checked on galette’s own test cases (`gal22v10-galette.test.ts` runs them against a built copy of galette; frozen copies in `gal22v10-galette-cases.ts` run in the normal test suite). The file the Studio downloads has the same 5,892 fuses with a standard header (a `*QP24` field and capital letters in the checksums), and the chapter’s tests assemble the Studio’s `.pld` export with the galette-compatible assembler and check that the fuses are the same. So the same design gives the same fuses as the tool that people use to program real chips.

What the course has *not* done is compare the simulator’s account of what a programmed chip *does* (the macrocell in Figure 26.1) with a physical part. That model follows the datasheet’s description, but only the fuse map is checked against galette; the real lab below tests the rest.
:::

## Build it for real

:::real{parts="ATF22V10C in a 24-pin DIP, a TL866-class universal programmer (with the adapter it needs for 24-pin PLDs), 8 LEDs, 8 × 1 kΩ resistors, 555 timer circuit or another 1 Hz clock, 3 switches, 3 × 10 kΩ resistors, 100 nF capacitor, 5 V USB supply module, breadboard"}
The traffic light of Figure 26.3 in one chip.

1. In the Studio, fit the traffic-light example and download the **JEDEC file**.
2. Put the chip in the programmer’s socket, open the programmer’s software (the open-source *minipro* works with the TL866 family), choose the device (`minipro -l | grep 22V10` lists the exact names, including the ATF22V10C), and write the file. The software burns the fuses, reads them back and compares the fuse checksum with the one in the file: the checksum of Figure 26.4, at work.
3. Move the chip to the breadboard. Power: pin 24 to +5 V, pin 12 to ground, and a 100 nF capacitor across them. Inputs from the fitter’s report: the **clock** on pin 1 (the 1 Hz source), **CAR** on pin 2, **T** on pin 3, **RST** on pin 4, each with a 10 kΩ resistor to ground and a switch to +5 V. The **outputs**, each through a 1 kΩ resistor and an LED to ground: MG on pin 16, MA 17, MR 18, SG 19, SA 20 and SR 21. (The state bits Q1 and Q0 are on pins 14 and 15, and can have LEDs too.)
4. Power up and hold RST: main road green, side road red. Release it, set T high (the “timer has ticked” input) and CAR high: on each clock the lamps step through the sequence. The whole state machine, its register, its decoder and its reset, is in one 24-pin chip that contains no code, only fuses.

The outputs are TTL-level and not meant to drive much, which is why the LEDs go through 1 kΩ: a couple of milliamps light a modern LED enough. Erase and rewrite the chip with the other JEDEC files the Studio makes, and it becomes a counter, a decoder or an address decoder: the *generic* in generic array logic. If it does something other than the Studio predicts, write to the author: that is the physical comparison that the model needs.
:::

## Exercises

```quiz
q: 'The output `Z = !(A | B & C & D | E & F)` needs 6 product terms active high and 3 active low. The macrocell it must go in holds 4 terms. What should the fitter do?'
options:
  - text: 'Store the complement (3 terms) and let the polarity fuse invert it at the pin.'
    correct: true
    why: 'The pin then shows Z as required, the macrocell holds 3 of its 4 terms (`/Z = A + B*C*D + E*F`), and the fit succeeds. This is why every macrocell has a polarity XOR.'
  - text: 'Refuse the design: 6 terms is more than 4.'
    why: 'True only if the macrocell must hold the function itself. It may hold the complement, which needs only 3.'
  - text: 'Split the function over two macrocells and OR them at the pin.'
    why: 'Outputs cannot be ORed at the pin, and you do not need to: the complement fits in one macrocell.'
```

```quiz
q: 'What is the difference between a PAL and a GAL?'
options:
  - text: 'A GAL has erasable cells and configurable output macrocells; a PAL is one-time programmable, with fixed output types.'
    correct: true
    why: 'The GAL keeps the PAL’s architecture (programmable AND, fixed OR) and makes it erasable with EEPROM cells; one GAL can replace several PAL types by configuring its macrocells.'
  - text: 'A GAL has a programmable OR plane; a PAL does not.'
    why: 'Neither does. A programmable OR plane is what makes a PLA.'
  - text: 'A GAL is programmed with equations and a PAL with a truth table.'
    why: 'Both were programmed from equations, with PALASM and its descendants. The programmer, in both cases, is fed a JEDEC fuse file.'
```

```quiz
q: 'You add one line to a design and the fitter refuses it: “Output X needs 20 product terms (20 active high, 20 active low), more than any macrocell has”. Which fix will not work?'
options:
  - text: 'Choose active low.'
    correct: true
    why: 'Both polarities need 20 terms, and even the largest macrocell has 16, so the polarity does not help.'
  - text: 'Compute half of X in another output and use that output in the terms of X.'
    why: 'This works: the other output uses one macrocell, and its value feeds back into the array as a new input for X’s terms, which are then fewer.'
  - text: 'Find out which input combinations never occur and declare them don’t cares.'
    why: 'This can also work: as the seven-segment decoder showed, don’t cares can cut the number of terms a lot.'
```

```parsons
title: 'From equations to a working chip'
prompt: 'Put the steps of the flow of this chapter in order, from the designer’s equations to a chip that does the job.'
lines:
  - 'Write the equations of the outputs.'
  - 'Minimise every output, in both polarities.'
  - 'Choose the polarity that needs fewer product terms.'
  - 'Assign each output to a macrocell that has enough terms.'
  - 'Write the fuse map as a JEDEC file with its checksums.'
  - 'The programmer verifies the checksums, and burns and reads back the fuses.'
distractors:
  - 'Blow the fuses of the OR plane that the design does not use.'
  - 'Load the configuration into SRAM every time the chip powers up.'
```

```bug
title: 'Power-up of an active-low register'
prompt: 'A designer reasons about the power-up state of a registered, active-low output on a GAL22V10, whose LED is lit when the pin is 0, and expects the LED to be lit until the first clock edge. Click the first line of the reasoning that is wrong.'
lines:
  - 'The output is `LAMP`, a registered output, and its pin is active low: the LED is lit when the pin is 0.'
  - 'Every register of a GAL22V10 is cleared at power-up, so it holds Q = 0.'
  - 'An active-low pin shows the inverse of Q, so the pin shows 0 at power-up.'
  - 'A 0 on the pin lights the LED, so the LED is lit until the first clock edge loads the register.'
wrong: 2
why: 'The inverse of Q = 0 is 1, so an active-low registered pin powers up high, and this LED is off. An active-high pin shows Q itself and would power up at 0, which lights the LED. That is one reason the fitter defaults registered outputs to active high: the all-zero power-up state of the registers is then the all-zero state of the equations.'
notes:
  '0': 'A fair description of an active-low, registered output.'
  '1': 'True: in the GAL22V10 every register is cleared at power-up.'
```

:::challenge[A fuse map by hand]
The GAL22V10 has 5,892 fuses, and the traffic light connects 21 of the 5,808 array fuses (the Studio’s report says so). What fraction is that? How many of the 132 rows does the design use? Why does the JEDEC file for it have only 21 `*L` fields, and not 132 or 5,892?

*Answer.* 21 ÷ 5,808 is 0.36 %: a design that fits comfortably in the chip uses well under one per cent of its crosspoints, which is why programmable logic is so much larger than the logic it implements. Eleven rows carry logic: ten product terms and the AR row. The file has 21 `*L` fields: 19 array rows that contain a 1, one field for the configuration bits and one for the signature. The 19 are the 11 rows of logic and the 8 output-enable rows of the used macrocells, each a row of 1s (nothing connected, so always true, so the output is always driven). A row of all 0s connects everything, is never true and is the default, so the writer leaves those out.
:::

Two exercises on the GAL22V10. Each is checked on the configured device, not on your text.

```fit
id: 26-pals-and-gals/decade-counter
title: A decade counter in 14 terms
device: gal22v10
prompt: |
  The source pane holds the 4-bit binary counter of the Studio’s examples. Turn it into a **decade counter**: it counts 0, 1, … 9 and then goes back to 0, not on to 10. The inputs are **EN** (count enable), **CLR** (synchronous clear, which beats EN) and the clock on pin 1; the outputs are the four registered bits **Q3 Q2 Q1 Q0** and a carry **CO** that is 1 while the count is 9 and EN is 1.

  The binary counter needs 15 product terms. The decade counter must fit in **14**.
hints:
  - 'Only the steps from 7 to 8 and from 9 to 0 differ from binary counting. Q0 still toggles on every count, so its equation need not change.'
  - 'Bit 1 must not toggle on the step from 9 to 0 (a binary counter would carry into it), and on 8 nothing above Q0 changes either: think of Q1 as toggling when `EN & Q0 & !Q3`.'
  - 'Q3 toggles on the step from 7 to 8 (`Q0 & Q1 & Q2`) and on the step from 9 to 0 (`Q3 & Q0`). The carry is `EN & Q3 & Q0`.'
explain: |
  Toggle form: each bit is `!CLR & (Q ^ t)`, where the toggle condition `t` is when that bit must change. The decade counter differs from the binary one in two places only (Q1 must not toggle out of 9, and Q3 toggles on 9 as well as on 7). Writing every state out as minterms would take 15 terms, because the fitter cannot know that the states 10 to 15 never occur; telling it with `# @dc Q* : Q3 & (Q2 | Q1)` (Chapter 12’s don’t cares, as a pragma) lets the minterm form drop to 13. The toggle form is already 14.
spec:
  buses:
    Q: [Q3, Q2, Q1, Q0]
  ports:
    inputs: [EN, CLR]
    outputs: [Q3, Q2, Q1, Q0, CO]
  steps:
    - { name: "power-up", set: { CLR: 0, EN: 0 }, expect: { Q: 0, CO: 0 } }
    - { name: "count 1", set: { EN: 1 }, clock: 1, expect: { Q: 1, CO: 0 } }
    - { name: "count 2", clock: 1, expect: { Q: 2 } }
    - { name: "count 3", clock: 1, expect: { Q: 3 } }
    - { name: "count 4", clock: 1, expect: { Q: 4 } }
    - { name: "count 5", clock: 1, expect: { Q: 5 } }
    - { name: "count 6", clock: 1, expect: { Q: 6 } }
    - { name: "count 7", clock: 1, expect: { Q: 7 } }
    - { name: "count 8", clock: 1, expect: { Q: 8, CO: 0 } }
    - { name: "count 9: the carry lights", clock: 1, expect: { Q: 9, CO: 1 } }
    - { name: "the tenth edge wraps to 0", clock: 1, expect: { Q: 0, CO: 0 } }
    - { name: "three more counts", clock: 3, expect: { Q: 3 } }
    - { name: "EN low holds", set: { EN: 0 }, clock: 4, expect: { Q: 3, CO: 0 } }
    - { name: "CLR beats EN", set: { CLR: 1, EN: 1 }, clock: 1, expect: { Q: 0 } }
    - { name: "nine counts after CLR", set: { CLR: 0 }, clock: 9, expect: { Q: 9, CO: 1 } }
    - { name: "and round again", clock: 1, expect: { Q: 0 } }
budget: { terms: 14 }
start: |
  # @title Decade counter (still binary)
  # @clock CLK
  Q0.R = !CLR & (Q0 ^ EN)
  Q1.R = !CLR & (Q1 ^ (EN & Q0))
  Q2.R = !CLR & (Q2 ^ (EN & Q0 & Q1))
  Q3.R = !CLR & (Q3 ^ (EN & Q0 & Q1 & Q2))
  CO = EN & Q0 & Q1 & Q2 & Q3
solution: |
  # @title Decade counter
  # @clock CLK
  Q0.R = !CLR & (Q0 ^ EN)
  Q1.R = !CLR & (Q1 ^ (EN & Q0 & !Q3))
  Q2.R = !CLR & (Q2 ^ (EN & Q0 & Q1))
  Q3.R = !CLR & (Q3 ^ (EN & (Q0 & Q1 & Q2 | Q3 & Q0)))
  CO = EN & Q3 & Q0
```

```decode
id: 26-pals-and-gals/read-the-jedec
title: Read a JEDEC file
device: gal22v10
prompt: |
  A GAL22V10 was programmed from a file, and this is what is in it: the fuse rows of two outputs, **Y** on pin 19 and **Z** on pin 18, and their macrocell bits. The inputs are **A** (pin 2), **B** (pin 3), **C** (pin 4) and **D** (pin 5). Which function does each output compute?

  Read a row as Chapter 26 does: the 44 columns are the 22 signals of the array, a pair for each (the pin, then its complement), and a **0 connects** the signal to the term. Then the macrocell: S0 says whether the output is inverted on its way to the pin.
hints:
  - 'The pins across the top tell you which pair of columns belongs to which signal: find the pairs for pins 2, 3, 4 and 5, and ignore the rest, which are all 1s (not connected).'
  - 'The row of pin 18 has only one term, but look at its S0. An active-low output puts the sum through an inverter.'
explain: |
  Pin 19 has two terms, `A & !B` (A’s true fuse and B’s complement fuse intact) and `C & D`, and is active high, so **Y = A & !B | C & D**. Pin 18 has a single term, `A & B & C`, but S0 = 0 makes the output active low: the pin is the inverse of the sum, **Z = !(A & B & C)**. The output-enable rows are all 1s, which is the constant 1: the outputs are always driven.
source: |
  # @pins A=2 B=3 C=4 D=5 Y=19 Z=18
  # @polarity Z=low
  Y = A & !B | C & D
  Z = !(A & B & C)
inputs: [A, B, C, D]
outputs: [Y, Z]
answers: [expression, table]
solution: |
  Y = A & !B | C & D
  Z = !(A & B & C)
```

## What’s next

A GAL22V10 has ten outputs and 120 product terms, and every output that needs more than 16 terms must be split, and every design that needs more than ten macrocells will not fit. The obvious next step is to put several PALs on one chip and let them talk. Chapter 27 does: the CPLD is a set of PAL-like function blocks joined by an interconnect matrix, with a product-term allocator that lets an output that needs 20 terms borrow four from its neighbour, non-volatile cells so that it works the moment power is on, and a JTAG port to program it in place on the board.
