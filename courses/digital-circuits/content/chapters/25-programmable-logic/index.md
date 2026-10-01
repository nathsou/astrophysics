---
number: 25
title: Logic you can program
summary: A ROM is a truth table, a PLA is two of them side by side, and a handful of physical tricks (fuses, antifuses, floating gates, SRAM) decide how a chip remembers what you told it to be.
duration: About 1½ hours
prerequisites: [simplifying-logic, real-gates]
---

Take the back off a piece of equipment from the 1970s and you find a board of white rectangles. There are forty or eighty of them, each a 7400-series package with a handful of gates inside (Chapter 10 met the family), and between them run copper tracks that someone drew by hand. Every gate of every chip is somewhere on that board because a designer put it there. If the logic has to change, the board changes: new tracks, new chips, a new run through the factory.

Now suppose the logic is a *table*. A decoder that turns a digit into the seven segments of a display is a table of ten rows and seven columns, and Chapter 12 showed how to boil any such table down to a small pile of gates. But a table can also be stored, not simplified. Store the ten rows in a memory, and let the digit be the address. Nothing is left to design, and to change the decoder you change the contents.

That is the whole idea of this chapter, and of Part VI: **build the chip once, and decide what it does afterwards, by writing bits into it.** The chip is generic; the bits are the design. The rest of the chapter is how that can be done: with a memory, with a better structure than a memory, and with the physical tricks that make the bits stay put.

## Why not make your own chip?

You could, of course, design a custom chip. It would be smaller and faster than a board of standard parts and use much less power. But making a chip has a cost that does not depend on how many you make. Someone has to design it, someone has to make the photographic masks that pattern each layer of silicon, and the first wafer has to be run and tested before you know it works. Engineers call it the :term[non-recurring engineering]{id=nre} cost, or **NRE**. Then each chip costs a little to make. The total for a run of *N* chips is

::::equation{#nre-cost caption="What a run of N parts costs: a fixed price for the first one, and a price for each one after that."}
$$\term{total}{C(N)} = \term{nre}{C_{\text{NRE}}} + \term{unit}{c}\,N$$

```terms
total:
  label: 'C(N), the total cost'
  what: The cost of having N working parts in your hands.
  why: The first part pays for all the design and tooling. Every later part adds only its own manufacturing cost.
  effect: Divide by N for the cost per part, which falls towards c as N grows, but never below it.
nre:
  label: 'C_NRE, the non-recurring cost'
  what: 'What must be spent before the first part exists: design, verification, masks, test programs.'
  why: It is paid once whether you make ten parts or ten million.
  effect: For a custom chip in a modern process it runs from hundreds of thousands to many millions of dollars. For a chip you buy off a shelf it is zero, because somebody else has already paid it and spread it over millions of buyers.
unit:
  label: 'c, the cost per part'
  what: The cost of making, testing and (for a board) assembling one more.
  why: 'Silicon, packaging, test time; for a board of standard chips, also every chip, the board and the soldering.'
  effect: A custom chip has the lowest c, because it contains exactly the logic you need and nothing more.
```
::::

The numbers below are made up for the arithmetic, not taken from any product: a custom chip with an NRE of \$40,000 and a unit cost of \$1, against a board of standard chips that costs \$6 for each unit assembled.

```quiz
q: 'At what volume does the custom chip become cheaper than the board of standard chips?'
options:
  - text: About 800 units.
    why: 'That would need an NRE of only \$4,000. Work it out: the custom chip saves \$5 on every unit, and it must first earn back \$40,000.'
  - text: About 8,000 units.
    correct: true
    why: 'C(N) is equal for both at \$40,000 + \$1 × N = \$6 × N, so N = 40,000 ÷ 5 = 8,000. Below that the board is cheaper; above it the custom chip wins.'
  - text: About 80,000 units.
    why: 'That would need the saving per unit to be only 50 cents. Here it is \$5.'
```

So a custom chip only pays when you sell thousands of them, and a start-up building a few hundred units, an engineer building one prototype, or a designer who has just found a bug will never get there. A third kind of part is needed: one made by the million, bought off a shelf like a 7400, but able to become any logic after it leaves the factory. The customer supplies the last step. That is the :term[programmable logic device]{id=pld}, or PLD, and this part of the course is about its family tree.

| | Standard chips | Custom chip | Programmable |
|---|---|---|---|
| NRE | none | very high | none |
| Cost per unit | high | low | medium |
| Time to a working design | days | months | hours |
| Fixing a bug | new tracks | new masks, new NRE | write a new file |
| Speed and power | good | best | between the two |

Those hours matter as much as the dollars. A design that takes an afternoon to fix, instead of a quarter, gets tried more often, and a design tried more often is a better design.

## A ROM is a truth table

The simplest programmable logic device is a memory that only reads. Give it an address and it puts on its output wires the word stored there. Look at it the other way round and it is a truth table: **the address is the input, the word is the output**, and there is one row for every combination of inputs. A :term[ROM]{id=rom} with four address lines and seven data lines is *any* function of four inputs and seven outputs, for whichever function you store.

Here is a ROM with four words of four bits, built from diodes. (You met the diode as a logic gate in Chapter 7; this is that gate, many times over.) The switches on the left are the *word lines*: close one and it puts 5 V on a horizontal wire. Wherever a diode stands at a crossing, that voltage passes through it onto the vertical *bit line* and lights the lamp at the top. Each bit line has a resistor to ground to pull it down when no diode is feeding it.

```quiz
q: 'In the ROM below, the wiring stores the squares of 0, 1, 2 and 3 in binary: 0000, 0001, 0100, 1001. You close the switches for Word 2 and Word 3 together. What appears on the bit lines?'
options:
  - text: 0100, the smaller word wins.
    why: 'Nothing arbitrates between the words. Both word lines are at 5 V, and each diode does its own job.'
  - text: 1101, the two words ORed together.
    correct: true
    why: 'Each bit line is a diode OR gate (Figure 7.7): it is high if any connected diode has a high word line on the other end. Word 2 gives 0100, word 3 gives 1001, and 0100 OR 1001 = 1101. In a real ROM an address decoder makes sure that only one word line is ever high.'
  - text: Nothing lights, because two word lines short the supply.
    why: 'Both word lines are outputs of ideal switches at 5 V, and the diodes only pass current one way. No current flows between the word lines.'
```

::circuit{src="25-programmable-logic/circuits/diode-rom.json" n="25.1" title="A diode-matrix ROM" caption="Close a Word switch: that word appears on the bit lamps, a diode drop (about 0.65 V) below 5 V. There is one diode for every 1 in the table and none for a 0. Try two words together and see the diodes OR them." speed=1}

Three things about this picture are worth noticing.

- **The table is the wiring.** To store a different table you put the diodes elsewhere. The contents of a ROM are a pattern of connections, and a pattern of connections is what a fuse map is.
- **A ROM is a fixed AND plane followed by a programmable OR plane.** The address decoder that raises exactly one word line is an AND gate for each row, the AND of every address bit, true or complemented: a :term[minterm]{id=minterm}. The diodes on the bit lines are OR gates that add up the minterms where the output is 1. So a ROM is Chapter 11’s sum of minterms, drawn as a grid. That is why *any* function fits.
- **It is wasteful.** For *n* address lines the decoder has 2ⁿ rows, whatever function you store. The next section counts what that costs.

### Mask ROM and PROM

A ROM whose diodes (or transistors, in silicon) are placed while the chip is made is a :term[mask ROM]{id=mask-rom}. The pattern is one layer of the chip, so the chip maker charges NRE for the mask, and the table is fixed for ever. Mask ROMs held the operating systems of home computers, and they are still the cheapest way to store a table in millions of chips.

A :term[PROM]{id=prom}, a programmable ROM, puts a **fuse** at every crossing. The chip leaves the factory with every connection made, so every fuse is intact and every bit reads the same. The user *blows* the fuses that should not be there by passing a current pulse through them. Blowing is one way: a blown fuse stays blown.

:::history{year=1956 title="Chow’s PROM, for a missile" people="Wen Tsing Chow"}
The programmable read-only memory was invented in 1956 by Wen Tsing Chow, an engineer at the Arma Division of the American Bosch Arma Corporation in Garden City, New York.

The Air Force wanted a more flexible and secure way to store the target constants in the airborne computer of the Atlas E/F intercontinental missile, whose guidance computer was the first production airborne digital computer. The patent was held under a secrecy order for several years. The verb we still use, *burning* a PROM, comes from the original patent, since one of the first implementations burned through the whiskers inside diodes with an overload of current.:cite[wiki-prom]
:::

The figure below is a PROM with 4 address lines, 7 data lines and 112 fuses. It is meant to be a BCD-to-seven-segment decoder: the address is a digit from 0 to 9, and each data line drives one segment (a to g) of a display. In this model a virgin fuse reads 0, and blowing it makes the bit read 1. Real families differ, and some read the other way round.

```quiz
q: 'Digits 0 to 9 are to appear on the display, and codes 10 to 15 may show blank. The table of seven segments has a 1 wherever a segment is lit. How many of the 112 fuses must be blown?'
options:
  - text: 112, every one of them.
    why: 'Then every bit would read 1, and every digit would light all seven segments and show an 8.'
  - text: 49, one for every lit segment of the ten digits.
    correct: true
    why: 'Digits 0 to 9 light 6, 2, 5, 5, 4, 5, 6, 3, 7 and 6 segments, which adds up to 49. Blank codes need nothing, because a virgin bit already reads 0. (The 6 and the 9 light six segments each: the display draws them with a tail.)'
  - text: 70, seven for each of the ten digits.
    why: 'Only the segments that light need a blown fuse. A digit 1 needs two.'
```

::prom-fuses{example="seven-segment" n="25.2" caption="Click the fuses that should read 1 (each click sends a programming pulse). The address switches choose a word, and the display shows what the PROM says against what it should say. A blown fuse cannot be repaired, so a fuse blown by mistake stays wrong. New part gives you a fresh chip. Program it for me to watch the pulses."}

:::lab[Blow the decoder]
Use Figure 25.2.

1. Set the address to 0000 and look at the target display: a zero, lit on every segment but g. Blow the fuses of a to f in word 0. The counter at the top says how many words are right.
2. Work through the ten digits, using the address switches to check each word against the target. Count the fuses you blow (the widget does, too). You should end at 49.
3. Blow a fuse that should not be blown, on purpose. Then try to put it right. You cannot: a fuse is one way, so a wrong bit in a PROM cannot be repaired by the same route. Real designers program a spare part and *verify* the words before trusting it, which is why the widget compares the chip with the table after every pulse.
4. Press *New part*, then *Program it for me* and watch the pulses go in, one fuse at a time.
:::

The Studio shows the same chip with its fuse map as data. Here is a PROM programmed with the same table; the *bits* view lists every fuse of the chip, with its address and data bit, and the *source* pane is the table that a programmer would be given.

::device-studio{device="prom" example="seven-segment" views="source,chip,bits" n="25.3" caption="Edit a row of the truth table in the source pane and watch the fuse map change. In the bits view, hover a fuse for its word and data bit. Try the other examples with the device picker: the 2-bit adder is a table of 16 words of 3 bits."}

## Two planes

A ROM stores a row for every input combination, and most of those rows are wasted. The seven-segment decoder uses ten of its sixteen rows. A decoder that ignores an input, or a circuit that sets a flag when a 16-bit address lies in a certain block, would leave nearly all of a 65,536-word ROM unused. But we do not need the whole decoder. To say "the address is in this block" we need one AND gate, whose inputs are the address bits that matter, and whose other bits we simply *do not connect*.

That is the idea of the :term[programmable logic array]{id=pla}, or PLA. Take the ROM’s two planes and make both programmable:

- the **AND plane** has, for each :term[product term]{id=product-term}, a fuse at every input, in true and complemented form, so it can be wired to AND *any* combination of literals;
- the **OR plane** has, for each output, a fuse from every product term, so the output ORs *any* set of terms.

Every output is a sum of products, exactly the form of Chapters 11 and 12: the AND plane makes the products, and the OR plane makes the sums. The number of product terms is fixed by the chip (16 in our virtual one), and **all the outputs share them**: a term that two outputs both need is built once and wired into both ORs. Chapter 12’s minimiser is now a *fitter*: given the outputs, find the fewest terms.

Datasheets draw a PLA as a grid, with the wires of the gates drawn as a single line each. A cross (×) where an input wire meets a product-term wire means the connection is made; a dot or nothing means it is not. (The gates in the planes have dozens of inputs, so drawing one wire per input would fill the page.) The chip view of the PLA in the Studio uses the same notation: a cross is an intact fuse, and a crossing with nothing on it has been blown.

::::figure{caption="A PLA in datasheet notation, for the two functions X = A·B and Y = A·B + C̄. The AND plane has two product terms, both wired to the inputs with crosses; the OR plane adds term 1 to X, and both terms to Y."}
```text
                  inputs   A   Ā   B   B̄   C   C̄
                           │   │   │   │   │   │
   term 1  A·B    ─────────×───┼───×───┼───┼───┼──── AND
   term 2  C̄      ─────────┼───┼───┼───┼───┼───×──── AND
                           │   │   │   │   │   │
                                  OR plane
                            term 1 ──×───×──
                            term 2 ──┼───×──
                                     X   Y
```
::::

For the full adder of Chapter 6, the sum is 1 for an odd number of inputs, and the carry is 1 for two or more. A PLA needs product terms for both.

```quiz
q: 'How many product terms does a PLA need for the sum and the carry of a full adder together (inputs A, B, Cin)?'
options:
  - text: 3.
    why: 'The carry needs three terms (A·B, A·Cin, B·Cin), but the sum is parity of three inputs, and no product of fewer than three literals is 1 only where an odd number of inputs are 1.'
  - text: 7.
    correct: true
    why: 'The sum needs four (one for each of the odd combinations 100, 010, 001, 111; parity cannot be shortened) and the carry needs three. The sum terms are all of three literals, so none can be shared with a carry term of two. You can instead build the carry from four terms and share the 111 term with the sum, but the total is still 7.'
  - text: 8, one for each row of the truth table.
    why: 'That is a ROM’s way of doing it, one word line for every input combination. A PLA can leave an input out of a term, so that one term covers two rows, and seven terms are enough.'
```

Now try it yourself. The chip below is a virgin PLA of 8 inputs, 16 product terms and 8 outputs: 392 fuses in all, every one intact. An intact fuse is a connection, so a virgin part has every product term wired to every input in both forms. Such a term contains both A and Ā, which is never true, and it is wired to every output, which stays 0 because a term that is always 0 adds nothing to an OR. **You program a PLA by blowing away everything you do not want.**

::pla-planes{example="full-adder" n="25.4" caption="Program a full adder. In the AND plane, choose the literals of each product term; in the OR plane choose which outputs (S, COUT) add it up. The table on the right compares the array with the target for all eight inputs. Hover a product term to light it across both planes. Show a solution wires it the way the fitter would."}

:::lab[Wire a full adder]
Use Figure 25.4. (In the widget a click toggles a fuse, so you can undo a mistake, which a real fuse would not allow.)

1. Program one product term by hand. Take T0 and make it A·B. On its row, keep the fuse of the *true* form of A and of B, and blow the other fourteen: the complement fuses of A and B, and both fuses of CIN and I3 to I7. When the row has only its two crosses left, the term is alive, and because a virgin OR plane connects every term to every output, it has just added itself to S and COUT.
2. Look at the table. COUT is now right in the rows where A and B are both 1, but S has gone wrong in the row A = 1, B = 1, CIN = 0 (it shows 1, and should show 0). In the OR plane blow the fuse that joins T0 to S, and S is right again: the term now feeds COUT only.
3. The whole adder needs seven terms of this kind, four for S (three literals each) and three for COUT (two literals each), which is nearly a hundred clicks. Press *New part* and then *Show a solution*: the programmer sends the pulses one after another, and the table ends with eight ticks and “7 product terms in use”. The fitter used seven too, and 7 of the 16 terms leaves 9 for other outputs. A chip with more outputs fills up quickly, and Chapter 26 shows what happens then.
:::

## ROM or PLA?

Which is better, a ROM or a PLA? It depends on the function, and the two costs behave very differently as the number of inputs *n* grows.

- A ROM has 2ⁿ words. It doubles with every input, whatever the function.
- A PLA has as many product terms as the function needs. How many *that* is depends on the function, from one term (an address decoder) to 2ⁿ⁻¹ (parity).

```quiz
q: 'A control circuit has 16 inputs and one output that is 1 exactly when the 16-bit address is 0xF000 or above. What does it cost in a ROM, and what in a PLA?'
options:
  - text: 'A ROM of 65,536 words; a PLA of 1 product term.'
    correct: true
    why: 'The output is the AND of the top four address bits: one product term of four literals. The ROM must have a row for all 2¹⁶ = 65,536 inputs, whatever they are used for. That is 65,536 bits against one AND gate.'
  - text: 'About the same, since both hold the same function.'
    why: 'They hold the same function, but in very different forms. The ROM writes out the whole truth table, and the PLA writes only what matters.'
  - text: 'A ROM of 16 words; a PLA of 16 terms.'
    why: 'A ROM has one word for every combination of the inputs, and 16 inputs give 65,536 combinations. The 16 is the number of inputs, not the number of words.'
```

::rom-vs-pla{n="25.5" caption="Choose a function and slide the inputs. The plot is logarithmic: a straight line is an exponential. Address decode: the PLA stays at one term while the ROM doubles at every step. Any request: the PLA grows as n². Parity: the worst case, where the PLA is bigger than the ROM. The chips show whether the function would fit the course’s vPLA or a Signetics 82S100."}

The plot has a moral. A ROM does not care what is stored, and is the right choice for a table with no structure: the shapes of the letters of a font, the bit patterns of a microprogram. A PLA exploits structure, and is the right choice for control logic, decoders and state machines, whose outputs depend on a few inputs at a time and share terms. And nothing helps parity or arithmetic, which is why adders are built from gates, not from a PLA (Chapter 14).

:::history{year=1975 title="The first field-programmable logic arrays" people="Bill Sievers, Ron Cline, Intersil, Signetics"}
In June 1975 Intersil introduced the IM5200, advertised as the first PLA that could be programmed electrically in the field. It had 48 product terms. A month or two later Signetics announced the 82S100, made by adapting its PROM technology, with the same number of terms and two more input pins: 16 inputs, 48 product terms and 8 outputs, in a 28-pin package. It was about twice as fast, and it became the successful one; the Intersil part suffered from poor yields.:cite[wiki-pld]

The 82S100 is the model for the course’s vPLA, scaled down to 8 inputs, 16 terms and 8 outputs so that you can see every fuse.:cite[signetics-82s100] The idea was not quite new: mask-programmed arrays had existed since about 1970, but a customer could not program them.
:::

## How a chip remembers

Everything so far said *fuse* and left out how one works. There are several answers, and they matter more than they seem to, because the technology decides whether a chip can be erased, whether it remembers with the power off, how big and fast it is, and what happens when a cosmic ray hits it.

**Fuses.** In a bipolar PROM the fuse is a thin film of nichrome (nickel and chromium) or titanium–tungsten, a micrometre or so wide, in series with a transistor. To blow it, the programmer pushes a pulse of some tens of milliamps through it (the exact figures depend on the part), enough to heat the film to its melting point in a microsecond or so. The link melts into a gap. It is fast, permanent and needs no power to remember, and it cannot be undone.

**Antifuses.** An :term[antifuse]{id=antifuse} is the opposite: it starts open. Two layers of metal are separated by a very thin insulator, and a programming voltage of several times the supply punches through it and leaves a small conducting filament of a few hundred ohms. Actel built FPGAs from them in the late 1980s.:cite[actel-act1] They are small and fast (a filament is a piece of wire, and much smaller than a transistor switch) and hard to read from the outside, but, like fuses, one-time.

**Floating gates.** Now a different idea, and the one behind nearly every chip that can be reprogrammed. Take an ordinary transistor and put a second gate between the control gate and the channel, completely surrounded by insulator, so that it is a :term[floating gate]{id=floating-gate}: not connected to anything. Charge put on it stays there for years, and it shifts the voltage at which the transistor turns on, its :term[threshold voltage]{id=threshold-voltage}. With no charge the transistor conducts when the control gate is at the read voltage of 5 V, and reads as 1. With enough electrons on the floating gate the same 5 V is not enough, and the cell reads 0.

::programming-cells{n="25.6" mode="floating" caption="Three cells; pick one. Floating gate: program it with three pulses and read it (each pulse adds a smaller share of charge, and the threshold climbs past the 5 V read voltage), then erase it, first with ultraviolet light (2½ minutes at a time: it reads 1 after two rounds, but a real erase runs to about 20 minutes so that the margin is safe) and then with an erase pulse. Fuse: send 25 mA for 4 µs, then try 10 mA, or 25 mA for only 0.5 µs, on a fresh part. Antifuse: try 6 V, then 12 V. The numbers are round and illustrative."}

- **:term[EPROM]{id=eprom}** (erasable programmable ROM). The programming pulse is a high voltage on the drain (in later cells with a raised control gate as well) that makes some of the electrons in the channel hot enough to jump the insulator onto the floating gate. To erase it, ultraviolet light through a quartz window in the package gives the trapped electrons enough energy to escape again. The window is why EPROMs have that recognisable lid, and why it is covered with a label: sunlight would erase them, slowly.
- **:term[EEPROM]{id=eeprom}** and **flash**. The charge can also be put on and taken off by :term[tunnelling]{id=fowler-nordheim}: with a very thin insulator and a strong electric field (some 10 million volts per centimetre), electrons cross it although they do not have the energy to climb over it, in a process described in 1928 by Ralph Fowler and Lothar Nordheim.:cite[fowler1928] No light is needed. The chip erases *electrically*, and, in a flash device, a whole block at a time. Each cycle damages the oxide a little, which is why flash has a limited number of erase cycles (typically 10⁴ to 10⁶).

:::history{year=1971 title="The EPROM, and a quartz window" people="Dov Frohman-Bentchkowsky, Intel"}
In 1971 Intel announced the 1702, a 2,048-bit PROM that could be erased by ultraviolet light and used again. It was designed by Dov Frohman-Bentchkowsky, who had joined Intel in 1969 to work on the fundamental research that produced the device: a transistor with a polysilicon gate buried in pure silicon dioxide, which he called FAMOS, the floating-gate avalanche-injection MOS transistor. Its charge was put there by avalanche breakdown, and taken away by ultraviolet light through a quartz window in the package.:cite[chm-eprom] He described it in a paper in the *IEEE Journal of Solid-State Circuits* the same year.:cite[frohman1971]

Until then a mistake in a ROM meant a new mask. With the EPROM, a programmer could try, look, erase and try again: an afternoon instead of weeks. It was the first commercially successful non-volatile memory technology, and every flash drive and phone today is its descendant.
:::

**SRAM.** The last answer is to use no exotic physics at all. Store the configuration in ordinary static RAM cells (Chapter 20), which control the routing switches and lookup tables directly. Nothing has to be blown, charged or discharged in a special way, and the chip is programmed as often as you like, at the speed of the clock. The price is that **SRAM forgets when the power goes off**, so the configuration must be loaded from an external memory every time the device starts, in milliseconds to a second, and that memory holds the whole design. It also makes the chip vulnerable to a *single-event upset*: a cosmic ray or an alpha particle that flips one configuration bit changes the circuit itself. Chapter 28 comes back to this.

| Cell | Erasable | Keeps data | Radiation |
|---|---|---|---|
| Fuse | no | yes | robust |
| Antifuse | no | yes | robust |
| EPROM | UV lamp | yes | UV erases |
| EEPROM, flash | yes | yes | tolerant |
| SRAM | yes | **no** | bit flips |

*Keeps data* means non-volatile: the cell holds its contents with the power off. *Erasable* means what it takes to change the contents: for a fuse or an antifuse, nothing can; for EPROM, an ultraviolet lamp and a chip taken out of its socket; for EEPROM and flash, an electrical erase that only wears the cell (10⁴ to 10⁶ times, typically); for SRAM, a write in nanoseconds. In density, fuses and EPROM cells are small, antifuses smallest of all and SRAM cells large; in speed, antifuse routing and SRAM logic are the fastest and the rest are good. Fuses were used in the bipolar PROMs and first PLAs, antifuses in space and defence FPGAs, EPROM in PLDs and microcontrollers of the 1970s to 1990s, EEPROM and flash in GALs, CPLDs, microcontrollers and SSDs, and SRAM in most FPGAs, where a single flipped bit changes the design.

The table explains a good deal. Devices meant to switch on and work at once, such as a GAL that decodes the addresses of a computer, must be non-volatile, so they use EEPROM cells. Devices meant for the largest designs use SRAM, because it is built in the same process as the logic and ordinary memory, and follows every improvement in it. And a satellite designer may take an antifuse device, because a fuse that is blown cannot be flipped by a particle.

## Under the hood

:::hood[From fuses to outputs]
The course’s PLA does not store its truth table. It stores fuses, and evaluates the fuses (`src/lib/pld/devices/pla.ts`). An intact fuse means *connected*, as it does on a real fuse device, so a term is the AND of the inputs whose fuses are intact, and a term with both fuses of an input intact contains `x·x̄` and is never true:

```ts
for (let t = 0; t < this.size.terms; t++) {
  let v: 0 | 1 = 1;
  for (let i = 0; i < n && v; i++) {
    if (!this.andFuses[(t * n + i) * 2] && !x[i]) v = 0;
    if (!this.andFuses[(t * n + i) * 2 + 1] && x[i]) v = 0;
  }
  terms.push(v);
}
```

Each input has two fuses in the array `andFuses`, at indices `2 × (t × n + i)` (the true form) and one more (the complement). A term starts at 1, and every intact fuse can make it 0: the true-form fuse if the input is 0, the complement fuse if it is 1. The OR plane does the same for outputs, and a last fuse per output (`polarityFuses`) decides whether the OR is inverted:

```ts
for (let o = 0; o < this.size.outputs; o++) {
  let s: 0 | 1 = 0;
  for (let t = 0; t < this.size.terms; t++) if (terms[t] && !this.orFuses[t * this.size.outputs + o]) s = 1;
  sums.push(s);
  outputs.push((this.polarityFuses[o] ? 1 - s : s) as 0 | 1);
}
```

The evaluator never sees the truth table you typed, only the 392 fuse bits, so what the chip view animates is what the bits say. The reverse direction is `decodeTerm`, which reads a term back from its fuses:

```ts
const tr = !this.andFuses[this.andIndex(t, i, 'true')];
const co = !this.andFuses[this.andIndex(t, i, 'complement')];
if (tr && co) {
  pattern += 'x';
  contradiction = true;
} else if (tr) {
  pattern += '1';
  literals++;
} else if (co) {
  pattern += '0';
  literals++;
} else pattern += '-';
```

This is how the Studio draws the logic view, and how it tells you what an unknown fuse map does: the hardware is the *only* source of truth, and the schematic is recovered from it. The PROM works the same way, but simpler: `Prom.read` is a loop over the fuses of one word, and `plan()`, which turns a table into pulses, refuses a change that would need a blown fuse to be repaired, with the message *the fuse is already blown, so the bit cannot change back to 0*.
:::

## Build it for real

:::real{parts="28C16 EEPROM (or 28C64 or 28C256), Arduino Nano or Uno, two 74HC595 shift registers, 7-segment display (common cathode), 8 × 330 Ω resistors, 4 × 10 kΩ resistors, 5 V USB supply, 4 DIP switches, breadboard"}
An EEPROM such as the 28C16 (2,048 words of 8 bits, 24 pins) is a PROM you can rewrite as often as you like: to write a byte, you put the address and data on the pins and pulse the write-enable line low, and after a few milliseconds the byte is stored. Use it as the seven-segment decoder of Figure 25.2. Wire four DIP switches to address lines A0 to A3 with 10 kΩ pull-down resistors, tie the higher address lines (A4 to A10) to ground, and connect the data lines D6 down to D0 through the 330 Ω resistors to the segments a to g of the display, its common cathode to ground.

To write the table you need a programmer. A universal programmer will do it directly, from a file of 16 bytes (an erased EEPROM reads 0xFF, every segment lit, so write 0x00 into addresses 10 to 15 to blank them). If you have an Arduino, the *Arduino EEPROM programmer* is a popular first project: two 74HC595 shift registers drive the address and output-enable lines from three Arduino pins, the Arduino drives the data lines and the write pulse, and a sketch loops over the table writing each byte and reading it back to verify. The bytes are the course’s table: `0x7e 0x30 0x6d 0x79 0x33 0x5b 0x5f 0x70 0x7f 0x7b` for the digits 0 to 9, with segment a in bit 6 (data line D6) and segment g in bit 0. After the write, unplug the Arduino, flip the DIP switches through the sixteen combinations, and read the digits: **a chip with no gates in it, and it decodes**.

Then change the table, and the same chip displays letters instead. That is the difference between logic in wires and logic in a memory. Everything runs from the 5 V supply; the resistors matter, because a segment without one is an LED without one (Chapter 7).
:::

## Exercises

```quiz
q: 'Why must a bipolar PROM be programmed with a pulse that is strong enough and long enough (Figure 25.6), not just strong?'
options:
  - text: 'Because the link heats up over a time set by its thermal mass: a strong pulse that is too short never gets it to the melting point.'
    correct: true
    why: 'The link warms as an exponential with a time constant of microseconds. At 20 mA the model’s link needs about 1.7 µs to reach its melting point (25 mA: 0.9 µs), and 15 mA takes for ever: a shorter or weaker pulse leaves it intact.'
  - text: 'Because the fuse must be charged before it can blow.'
    why: 'A fuse stores no charge. It is a resistor that heats up with the current through it.'
  - text: 'Because a short pulse can be undone by a second one.'
    why: 'Nothing can be undone: a fuse that has not blown is intact, and one that has blown is gone.'
```

```quiz
q: 'A GAL-style device is used to decode the addresses of a computer, and has to work the instant the power comes on. Which programming technology fits, and which does not?'
options:
  - text: 'EEPROM cells fit. SRAM cells do not, because they forget the design when the power goes off and would first need loading from another memory.'
    correct: true
    why: 'A non-volatile cell (fuse, antifuse, EPROM, EEPROM, flash) holds its configuration with the power off, so the device works as soon as its supply is up. SRAM configuration is loaded at every power-up, which takes time and an external memory.'
  - text: 'SRAM cells fit, because they are the fastest to program.'
    why: 'Speed of programming is irrelevant here; what matters is that the device must already be configured when the power comes on.'
  - text: 'Antifuses fit only if the design is going to change.'
    why: 'An antifuse cannot change: it is one-time. It is non-volatile, though, which is what this question is about.'
```

```quiz
q: 'A PLA has 8 inputs and 16 product terms. Which of these functions of 8 inputs will not fit in it?'
options:
  - text: 'Parity of all eight inputs.'
    correct: true
    why: 'Parity of 8 inputs needs 2⁷ = 128 product terms (Figure 25.5), far beyond 16. It would fit a 256-word ROM (as a single bit) with room to spare.'
  - text: 'Whether any of the eight inputs is 1.'
    why: 'That is 8 terms of one literal each, and fits with 8 left over.'
  - text: 'Whether the top four inputs are all 1.'
    why: 'That is a single product term of four literals.'
```

```bug
title: 'Correcting a PROM'
prompt: 'A designer has programmed a fuse PROM with a seven-segment table and finds, when testing, that word 6 shows a digit with the wrong segment. Click the first step that cannot work.'
lines:
  - 'Read back the word at address 6 and compare it with the table: bit e reads 1, but should read 0.'
  - 'A blown fuse reads 1, so bit e in word 6 has been blown by mistake.'
  - 'Put the part back in the programmer and send it a pulse to restore the fuse of bit e in word 6.'
  - 'Verify all sixteen words again.'
  - 'If the word is still wrong, program a new part.'
wrong: 2
why: 'A blown fuse is a gap in a piece of metal. No pulse can put the metal back, and the model’s planner refuses to plan a change that would need one. What you can do is program a new part with the right table (line 4). If the extra 1 is at an address the design never uses, you might live with it: that is what a *don’t-care* is.'
notes:
  '0': 'A sensible first step: read, compare, find the bad bit.'
  '1': 'A correct diagnosis: in this family a blown fuse reads 1.'
```

:::challenge[Fuses for a table]
A PROM has 5 address lines and 8 data lines. How many fuses does it have, and how many must be blown to store a table in which every word has exactly three 1s? Now the same function is put into a PLA of 8 inputs, 16 product terms and 8 outputs (392 fuses, all intact at first): how many fuses does the fit of a full adder blow? Is a blown fuse in a PLA a connection that has been *made* or *removed*?

*Answer.* A PROM has 32 × 8 = 256 fuses, and the table needs 32 × 3 = 96 to be blown. The fitter for the full adder blows 215 of the 392 fuses (Figure 25.4’s *Show a solution* does it): a blown fuse in a PLA *removes* a connection, and the other 177 fuses stay intact.
:::

Two exercises on the virtual devices of this chapter. Each is checked on the device itself, on its fuses, never on the text you typed.

```fit
id: 25-programmable-logic/excess-3
title: A code converter in seven terms
device: pla
prompt: |
  A decimal digit in **BCD** is four bits, **D C B A** (D is the most significant), for the ten codes 0000 to 1001. **Excess-3**, a code that old calculators used because it makes subtraction easier, stores the digit plus three: 0 is 0011, 1 is 0100 and 9 is 1100. Program the PLA to convert BCD to excess-3, **E3 E2 E1 E0**.

  The source pane holds the truth table of the ten digits, and the fitter needs 9 of the 16 product terms for it. Do it in **7**. The codes 10 to 15 never occur in BCD, so what the PLA does for them is yours to choose.
hints:
  - 'A row whose outputs are all `-` is a don’t care: the fitter may make those outputs 0 or 1, whichever needs fewer terms. Add one for each of the six unused codes (1010 to 1111).'
  - 'Don’t cares alone are not enough. The fitter can also build an output inverted, with the polarity fuse putting it right again: put `# @polarity auto` on a line of its own and let it choose for each output.'
explain: |
  Each trick alone leaves the table at 9 terms; together they need only 7. The don’t cares let the fitter grow a term over codes that cannot happen, so that one product covers several digits, and the polarity fuse lets an output that is mostly 1 be built as the complement of a short sum. The other six terms go unused, ready for another function.
spec:
  truthTable:
    inputs: [D, C, B, A]
    outputs: [E3, E2, E1, E0]
    rows: ["0000 0011", "0001 0100", "0010 0101", "0011 0110", "0100 0111", "0101 1000", "0110 1001", "0111 1010", "1000 1011", "1001 1100"]
budget: { terms: 7 }
start: |
  # @title BCD to excess-3
  D C B A | E3 E2 E1 E0
  0 0 0 0 | 0 0 1 1
  0 0 0 1 | 0 1 0 0
  0 0 1 0 | 0 1 0 1
  0 0 1 1 | 0 1 1 0
  0 1 0 0 | 0 1 1 1
  0 1 0 1 | 1 0 0 0
  0 1 1 0 | 1 0 0 1
  0 1 1 1 | 1 0 1 0
  1 0 0 0 | 1 0 1 1
  1 0 0 1 | 1 1 0 0
solution: |
  # @title BCD to excess-3
  # @polarity auto
  D C B A | E3 E2 E1 E0
  0 0 0 0 | 0 0 1 1
  0 0 0 1 | 0 1 0 0
  0 0 1 0 | 0 1 0 1
  0 0 1 1 | 0 1 1 0
  0 1 0 0 | 0 1 1 1
  0 1 0 1 | 1 0 0 0
  0 1 1 0 | 1 0 0 1
  0 1 1 1 | 1 0 1 0
  1 0 0 0 | 1 0 1 1
  1 0 0 1 | 1 1 0 0
  1 0 1 0 | - - - -
  1 0 1 1 | - - - -
  1 1 0 0 | - - - -
  1 1 0 1 | - - - -
  1 1 1 0 | - - - -
  1 1 1 1 | - - - -
```

```decode
id: 25-programmable-logic/read-the-planes
title: Read the two planes
device: pla
prompt: |
  Someone programmed a PLA with three inputs, **A**, **B** and **C**, and two outputs, **X** and **Y**, and sent you only its fuse map. Read it: which function of A, B and C does each output compute?

  Take it one row at a time. In the AND plane, a pair of fuses for an input is (the input, its complement): if only the first is intact the term contains the input, if only the second is intact it contains the complement, if both are blown the input is left out. The OR plane says which terms each output adds up; the last row says which outputs are inverted on the way out.
hints:
  - 'Write each term as a product first. `T1`, for example, has only the complement fuse of A intact, only the true fuse of B, and both fuses of C blown: it is `!A & B`.'
  - 'Y is the sum of its terms and then inverted. Work the sum out, then apply De Morgan’s law (Chapter 11) to the whole thing.'
explain: |
  X is the sum of the terms of its column, `!A & B | A & !B & C`. Y’s terms add up to `!A & !C | !B`, and the blown fuse in the last row inverts that: `!(!A & !C | !B)`, which by De Morgan is `B & (A | C)`. The source asked for Y to be built inverted (`# @polarity Y=low`); here it saves nothing, since both forms need two terms, but this is what a fuse map looks like when it does.
source: |
  # @polarity Y=low
  X = !A & B | A & !B & C
  Y = A & B | B & C
inputs: [A, B, C]
outputs: [X, Y]
answers: [expression, table]
solution: |
  X = !A & B | A & !B & C
  Y = B & (A | C)
```

## What’s next

A ROM is a truth table you can write. A PLA is a better one, with two programmable planes, but it has two costs. Its OR plane is large (every output must be able to see every term), which makes it slow, and 82S100-type parts were expensive. In 1978 an engineer at Monolithic Memories asked a shrewd question: *does the OR plane need to be programmable at all?* Fix it, give each output its own small group of product terms, and the chip gets faster and cheaper. Add a flip-flop to each output and it can hold a state. Chapter 26 follows that idea through the PAL, and then through the GAL, which replaced the fuses with erasable cells so that the same 24-pin chip could be programmed again and again, and which you can program on the real thing.
