---
number: 28
title: Inside an FPGA
summary: A sea of tiny memories that can each be any function, wires that can be joined in thousands of ways, and one long string of bits that says which. Configure a small one by hand, then watch the tools do it.
duration: About 2 hours
prerequisites: [cplds, building-blocks]
---

How many transistors does it take to be *any* logic gate? A 4-input NAND gate takes eight. A circuit that can be a NAND, or an XOR, or one of 65,536 other functions of four inputs, takes a memory of sixteen bits, and a bit of the static RAM of Chapter 20 is six transistors: 96 transistors before we have counted the multiplexer that reads the memory, or a single wire to bring the inputs in. That is more than twelve times the cost of the gate it might turn out to be.

Now do it a few thousand times, and add the wires. Every wire on the chip must be able to reach many others, and every choice of connection is a switch, and every switch is a bit of memory as well. Most of the chip is memory and switches that will never be used by any one design. Anyone who counted transistors in the early 1980s would have called this a waste, and would have been right, for the transistors of the time.

:::history{year=1985 title="The XC2064, and a bet on Moore’s law" people="Ross Freeman, Bernard Vonderschmitt, Jim Barnett, Xilinx"}
Ross Freeman was a director of engineering at the chip maker Zilog when he had the idea, and left to found Xilinx in 1984 with Bernard Vonderschmitt and James Barnett.:cite[ethw-fpga] The idea was a chip full of small configurable logic blocks in a sea of configurable wiring, all set by bits in a memory on the chip. Colleagues found it an outrageous use of silicon. Freeman’s answer was that Moore’s law would keep making transistors cheaper, and that a chip built from them would cost less than the months of design and the mask sets of a custom one.:cite[spectrum-fpga] The priority date of his patent is 12 March 1984; it was granted in 1989.:cite[freeman-patent]

The first product, the XC2064 of 1985, was an 8 × 8 array of 64 configurable logic blocks, each a small lookup function of four inputs with storage, and its configuration lived in SRAM that had to be loaded every time the power came on.:cite[ethw-fpga] Freeman died in 1989, aged 41, and was inducted into the National Inventors Hall of Fame in 2009.
:::

That bet paid off so thoroughly that the chip inside a router, a radio base station or a scanner in a hospital may well be an FPGA, a **field-programmable gate array**: a chip made once, in millions, and given its function afterwards by whoever buys it. Chapters 25 to 27 followed the family up to its fixed-function cousins. This chapter opens the FPGA itself, and by its end you will have configured a small one bit by bit.

## A lookup table is a tiny memory

The unit of logic in an :term[FPGA]{id=fpga} is the :term[lookup table]{id=lut}, or LUT, which Chapter 13 introduced as a multiplexer whose data inputs are stored constants. Here is the same idea as a memory. A LUT with *k* inputs holds 2ᵏ bits. The inputs are the address, the stored bit at that address is the output, and the truth table you would write on paper is what is stored. Nothing is computed: the answer is looked up.

```quiz
q: 'A 4-input LUT stores 16 bits. How many different functions of its four inputs can it be programmed to compute?'
options:
  - text: 16, one for each bit.
    why: 'Each bit is an *entry* of the truth table, not a function. Choose every bit independently, and the choices multiply.'
  - text: 256, because 16 × 16.
    why: 'The bits are chosen independently, so the number of combinations is 2 × 2 × … × 2 sixteen times, not 16 × 16.'
  - text: 65,536, because each of the 16 bits can be 0 or 1 independently.
    correct: true
    why: 'Sixteen independent bits are 2¹⁶ = 65,536 patterns, and each pattern is a different truth table, so a different function. That is every function of four inputs there is: a LUT4 can be any of them.'
  - text: About 4 billion.
    why: 'That is 2³², the number of patterns of 32 bits. A LUT4 has only 16 stored bits.'
```

::lut-explorer{n="28.1" caption="Flip the four inputs at the bottom to walk down the tree: each input chooses between the two halves of what is left, and one stored bit reaches the output. Click a stored bit to change the function, or type one (I0 ^ I1, or a & (b | c)) and see the 16 bits it becomes. Try parity and then majority. Which stored bits does the input I3 decide between?"}

The picture on the right of the LUT is the multiplexer tree that reads the memory: 15 two-way multiplexers, the first rank chosen by I0, the next by I1, and so on. It is the same tree as the 8:1 multiplexer of Chapter 13, one rank deeper. A LUT is a function in the sense a programmer means it: `table[index]`, with the index made of the four input bits. The synthesis tools of Chapter 30 do what a compiler does with a function that has a finite domain: they replace the code by its table.

:::programmer[A LUT is a memoised function]
Any pure function of four bits is a lookup in a 16-entry array. Hardware does not run the function, and it does not run the same time whatever the function is: `XOR`, `AND` and a hundred-gate monster all take the same 0.5 ns in the vFPGA, because they are all the same read of the same memory. That is why FPGA timing is dominated not by the logic but by how many LUTs there are on a path, and by the wires between them.
:::

Sixteen bits is a choice, not a law. Each extra input doubles the memory. It also lets one LUT do more, so that a function needs fewer LUTs and fewer levels of them, until the LUT is bigger than most of the functions it is asked to hold. Experiments from 1990 onwards, beginning with Jonathan Rose and his colleagues at Toronto, found that four inputs gave the smallest chip,:cite[rose1990] and four it stayed for fifteen years, until Xilinx moved to six with the Virtex-5 in 2006.:cite[xilinx-wp284] Chapter 30 shows the trade on a small example: the same eight-input parity needs seven 2-input LUTs, but only three 4-input ones.

:::history{year=2006 title="Six inputs" people="Xilinx, Altera"}
For years a LUT had four inputs. As transistors shrank, the wires between LUTs mattered more and more next to the LUTs themselves, so the FPGA makers made the LUTs bigger, to have fewer of them on a path. Altera’s Stratix II of 2004 split the difference with an *adaptive* LUT of eight inputs that can act as one large function or as two smaller ones.:cite[electronicdesign-alm] In May 2006 Xilinx announced the Virtex-5, on a 65 nm process, with a six-input LUT of 64 bits as its logic element, which can also be split into two smaller functions that share inputs.:cite[eetimes-virtex5] A six-input LUT needs four times the memory of a four-input one, and holds any function of six inputs that would otherwise need up to seven 4-input LUTs and three levels of them.
:::

## The logic cell

A LUT computes; it does not remember. Most designs are synchronous (Chapter 17), so each LUT is paired with a flip-flop that can catch its output on a clock edge. The pair is the :term[logic cell]{id=logic-cell}, and its third part is a piece of logic that does one job better than a LUT: carrying. A ripple-carry adder is a chain of full adders (Chapter 14) in which each stage waits for the one before, and passing a carry through a LUT and a wire per bit is expensive. So the cell has a **dedicated carry path**, running straight from each cell to the next, and a multiplexer that picks whether the cell’s output is the LUT or the flip-flop.

The vFPGA’s logic cell is modelled on that of the Lattice iCE40 and is described by 25 bits: 16 for the LUT and nine flags. The flags say whether the output comes from the flip-flop, whether the flip-flop obeys a clock enable, whether it has a set or reset and which kind, what it holds at power-up, and how the carry chain is joined. The carry output of every cell is the majority of its two operand inputs and the carry that arrives, MAJ(I1, I2, carry in), which is exactly the carry of a full adder, and the LUT, fed the same inputs, makes the sum.

::circuit{src="28-inside-an-fpga/circuits/logic-cell.json" n="28.2" title="A logic cell in miniature" mode="logic" speed=1e-6 caption="The four toggles on the left are the stored bits of a LUT with two inputs, and A and B choose which of them reaches the output: the bits are a truth table, read in the order A + 2B. As drawn it is an XOR. Set the bits to 1000 and it is an AND, to 1110 an OR. Then turn on Use flip-flop: the output now changes only when you press Clock, and the LUT’s answer waits in the flip-flop."}

:::lab[Make the cell into things]
Use Figure 28.2.

1. Set the four bits to make an AND (only bit 3 set), an OR (bits 1, 2 and 3), a NAND and an XNOR. In each case check all four settings of A and B. Nothing about the circuit changed except four stored bits: this is what “programmable” means.
2. Turn on Use flip-flop, set A to 1 and B to 0 with the XOR table, and look at Out: still 0. Press Clock. The LUT’s answer has been waiting at the flip-flop’s input, and now it is out. Change A and note that Out does not follow until the next press.
3. With the flip-flop on and the XOR table, set B to 1 and press Clock; then set A to 1 and press again. The output gives 0 (1 XOR 1). Every synchronous design in the course is a network of exactly this: a LUT, then a register.
:::

The cell also explains a rule that the tools of Chapter 30 will follow. Eight logic cells sit together in a **tile**, and the eight share one clock, one clock-enable pin and one set/reset pin, which cuts the routing that each cell would otherwise need. Two flip-flops that need different clocks or different enables cannot share a tile. The carry chain runs up a column of tiles, cell after cell: in the vFPGA a signal takes 0.1 ns to cross from one cell’s carry to the next, against 0.5 ns to pass through a LUT and at least 0.4 ns to travel by the shortest wire to the next tile, so a 32-bit carry chain takes about 3 ns where 32 LUTs and their wires would take about 29. The course’s toolchain fits a 32-bit adder in exactly 32 cells on one chain, and its longest path, pad to pad, is about 8 ns.

## The wires are the chip

If the LUTs are the cities, the wires are the roads, and everything you know about cities applies: the roads are most of the land. An FPGA is a grid of tiles, and between and around them run **wire segments** of different lengths, with programmable switches where they cross. The vFPGA has three kinds; the Lattice iCE40 it is modelled on has span-4 and span-12 wires and links to the neighbouring tiles.

- **Span 1**: wires that reach the next tile.
- **Span 4**: wires that reach the tile four away, and pass the three between them without touching them.
- **Span 12**: the long lines that cross a third of a large chip.

A signal chooses its way through two kinds of programmable multiplexer.

- The :term[switch box]{id=switch-box} sits at every tile, and drives the wires that start there. Its multiplexer for each wire can choose from wires arriving at the tile from the same direction (to go straight on), from the two perpendicular directions (to turn), and from the tile’s own outputs.
- The :term[connection box]{id=connection-box} sits in front of every input pin of a logic cell, and chooses which of the wires that arrive at the tile it will read.

Every wire has exactly one driver, the multiplexer at its start, and a multiplexer with *n* inputs takes ⌈log₂(*n* + 1)⌉ configuration bits: the extra one is the choice “nothing”. Such **single-driver** wiring is what the vFPGA has, so every configuration means something and no two outputs can fight over a wire. The older way, in the XC2000 and its early successors, was a bidirectional wire joined to its neighbours by pass transistors, so that a configuration could join two outputs together. A study of 2004 found that the move that Altera and Xilinx made to directional, single-driver wires saved about a quarter of the routing area and 9 % of the delay.:cite[lemieux2004]

Why three lengths? Every switch that a signal passes costs delay, so a wire that skips tiles skips their switches. The figure below is the fastest way across a row of tiles, for the wires you allow, with the delays of the vFPGA’s published model: a multiplexer costs 0.1 ns, and the wires 0.2, 0.4 and 0.8 ns for spans 1, 4 and 12.

::wire-reach{n="28.3" caption="Set the distance to 30 tiles, with span-1 wires only: thirty hops and 9.1 ns. Now allow spans 4 and 12: five hops and 3.0 ns. Then find the distances where a wire overshoots and comes back (11 tiles, for example, goes 12 tiles and one back). The bars compare the three sets at the distance you chose."}

A long wire is faster per tile but costs a multiplexer input at every switch box that can start one, and a wire in the fabric that nothing else can use while it is carrying a signal. So a chip is built with a mix, a lot of short wires and a few long ones, and a router that must decide which net deserves the long one. That is the problem Chapter 30 calls routing.

```quiz
q: 'On vFPGA-M, the 32-bit ALU of the RV32I core has a critical path of about 35 ns. About how much of that time is spent in the wires and their multiplexers, rather than in the LUTs and the pins?'
options:
  - text: 'About a tenth: wires are just wires.'
    why: 'On a chip a wire is a chain of switches, and each switch is a small resistor driving a capacitor. The tools count every one.'
  - text: 'Between a half and two thirds.'
    correct: true
    why: 'The report of Chapter 30 splits the path into nets and cells, and the nets take a little over half of the ALU’s path. On the larger vFPGA-L, the wires of the register file’s path take nearly two thirds.'
  - text: 'About nine tenths.'
    why: 'That would leave about 3.5 ns for thirty-odd LUTs at 0.5 ns each. The LUTs are a real part of the delay too.'
```

The same imbalance shows in the number of bits. Here are the configuration bits of a logic tile on the vFPGA-M and vFPGA-L: 128 for the eight LUTs, 72 for the flags of the cells, 4 for the clock, and 282 for the routing multiplexers, so routing takes 58 % of a tile’s 486 bits. The real chip is more extreme: a logic tile of the iCE40 has 54 × 16 = 864 configuration bits, of which the eight logic cells use 160, about a fifth.:cite[prjicestorm] Where the bits are is where the switches are, and where the switches are is where the area and the delay are.

## Where the bits live

Every LUT bit, every flag and every routing choice is a bit of memory, and together they are the :term[bitstream]{id=bitstream}. Chapter 25 listed the ways to hold a bit. Almost all large FPGAs use the last on that list, plain SRAM, for the reason given there: it is made in the same process as the logic, so it improves whenever the logic does. What it costs is **volatility**. SRAM forgets, so the configuration lives in a separate memory, usually a flash chip on the board next to the FPGA, and is copied into the FPGA every time the power comes on. For the small iCE40 HX1K that is 34,112 bytes; for the HX8K, 136,448.:cite[tn1248] At one bit per clock of a 12 MHz SPI link, the HX1K takes 23 ms to load, and until it has, its pins are inputs and its logic does not exist.

The smallest part of the bit is a **cell**, and the figure below is one, at transistor level, controlling one switch. Two inverters feeding each other hold a value for as long as they have power, and two access transistors, opened by the word line, let a write override them. The cell’s output, Q, is not read through anything. It is wired straight to the gate of a pass transistor in the routing, which is therefore on if the bit is 1, and off if it is 0. Every switch in the fabric is such a transistor, and the loading of a bitstream is writing them all.

::circuit{src="28-inside-an-fpga/circuits/config-bit.json" n="28.4" title="A configuration bit is a switch" mode="logic" speed=1 caption="At power-up the cell is in an arbitrary state, so first write it: set Bit line to 1 and Bit line B to 0 (a write needs both, opposite), then raise the Word line and lower it. The pass transistor on the right now conducts, and Signal out follows Signal in. Change the bit lines and the input freely: with the Word line low the cell holds. Write a 0 and the switch opens; the pull-down makes the output 0."}

The bits are not loaded one by one but in :term[frames]{id=config-frame}: a frame is a column of the chip’s configuration memory, written all at once, like a row of a RAM. In the vFPGA a frame is one tile column, and vFPGA-S has 4, vFPGA-M 16 and vFPGA-L 36. The bitstream file is the frames one after another, each closed by a checksum, so that a loader can refuse a file with even a single flipped bit.

The volatility has a second consequence. SRAM is as vulnerable to a cosmic ray as any other memory, but in an FPGA a flipped bit does not corrupt some data: it *changes the circuit*. A bit in a routing multiplexer connects the wrong wire, and a bit in a LUT changes the function. The error stays until the bit is rewritten. Space and avionics designers deal with it by :term[scrubbing]{id=scrubbing}: reading the frames back continually, comparing each with what it should be and rewriting the wrong ones.:cite[seu-scrubbing] Try it on the XOR gate that you will build in a moment:

::upset-census{n="28.5" caption="Strike at random, and watch the counter of rays. Most bits belong to tiles this design does not use, and most strikes are harmless, but not all. Use Where the ray hits to see the other case: a flip in the file, before loading, is caught by the frame checksum. Then run the census, which flips every one of the 1,772 bits in turn (about a second), and marks the critical ones in red."}

The census says that 42 of the 1,772 bits, 2.4 %, matter: all 16 bits of the LUT, 22 of the routing selects, one cell flag, and the three pad bits that would turn a pad the wrong way round. The percentage is small because the design is tiny, an XOR gate on a chip of 32 logic cells. A design that fills the chip has a much larger share of critical bits, and a space mission that cannot afford the flips has three choices: scrub, triple every part of the design and vote, or use a device whose bits are not SRAM. The last leads to the chapter’s other technologies.

Notice that all 16 bits of the LUT matter, though the XOR uses only two of its four inputs. The two unused inputs are not tied to anything, so they float, and the tools write a table that ignores them by repeating the XOR pattern four times. A single flip then leaves the table dependent on a floating input for one pair of the used inputs, and the output becomes unknown. That is what the by-hand check calls “an input of the LUT is not connected”.

:::history{year=1988 title="Actel and the antifuse" people="Actel, Amr Mohsen, Esmat Hamdy"}
An SRAM FPGA needs its configuration reloaded at every power-up, and can be upset by a cosmic ray. Actel, founded in 1985 by Amr Mohsen and Esmat Hamdy, shipped its first FPGAs, the ACT 1010 and ACT 1020, in 1988, and built them on a different idea.:cite[eejournal-actel] Instead of memory cells and pass transistors, its wiring was made of **antifuses** (Chapter 25): a thin insulator between two layers of metal that a programming voltage punches through, leaving a permanent link that Actel called a “programmable low-impedance circuit element”.:cite[actel-act1] The link is a piece of wire and much smaller than a transistor switch, so the chip was fast and dense, it worked the moment it was powered, and a particle could not flip it. The price was that it could be programmed only once, and the process was less standard. Antifuse FPGAs are still made, for space and defence.

Flash-based FPGAs are a third kind: they keep a floating-gate cell (Chapter 25) at each switch, so they are instant-on and reprogrammable, at the cost of a slower and bulkier switch than SRAM.
:::

## Everything else on the die

A fabric of LUTs and wires is universal: an FPGA with nothing else could be anything. It would also be wasteful, in the way that building every multiplication out of adders is wasteful, and the box below puts a number on how wasteful. So the fabric is joined by :term[hard blocks]{id=hard-block}, ordinary custom circuits placed in columns among the tiles, for the jobs that most designs need.

:::history{year=2007 title="How much does programmability cost?" people="Ian Kuon, Jonathan Rose"}
In 2006 two researchers at the University of Toronto, Ian Kuon and Jonathan Rose, set out to measure what the flexibility of an FPGA costs. They built the same benchmark circuits for a 90 nm FPGA and, with a standard synthesis flow, as standard-cell chips in the same 90 nm process, and compared them. For circuits that use only the FPGA’s general logic, the FPGA needed on average 35 times the area, ran 3.4 to 4.6 times slower and used about 14 times the dynamic power. When the circuits could use the hard multipliers and block RAMs, the area gap fell, to as little as 18 times on some benchmarks.:cite[kuon-rose]

The numbers say what the plan of Chapter 32 will keep in view: an FPGA is a bargain when you make few of a thing, or need to change it, and a bad one at a million units.
:::

- **Block RAM.** A LUT is a 16-bit memory, and a register file of 32 × 32 bits made of them would take 64 LUTs and many wires. Dedicated RAM columns hold thousands of bits at a small cost. The vFPGA has 4 Kbit blocks that can be 256 words of 16 bits, or 512 × 8, 1,024 × 4 or 2,048 × 2, with one read port and one write port. The Xilinx Virtex of 1998 was the first Xilinx family to have them, with 4,096 bits each.:cite[wiki-virtex]
- **Multipliers and DSP slices.** The course’s toolchain builds a 16-bit multiplier (the low half of the product) from 261 logic cells, more than a fifth of the vFPGA-M. The Virtex-II of 2000 added hard 18 × 18 multipliers, and later families made a slice that multiplies and accumulates.:cite[wiki-virtex]
- **Transceivers and processors.** The Virtex-II Pro of 2002 put one to four PowerPC processor cores and multi-gigabit serial transceivers into the fabric.:cite[hpcwire-v2pro] Today’s largest FPGAs carry whole ARM processors.
- **I/O blocks.** The pads at the edge are logic too, but different logic. Each pad has a direction bit (two, with the pull-up, in the vFPGA), and in a real chip also its voltage standard, its drive strength, and often a flip-flop and a delay line right at the pin.
- **Clocks.** A clock must reach thousands of flip-flops at the same instant, and cannot go through ordinary routing. **Clock networks** are trees of dedicated wires with buffers, reaching every tile with small skew; the vFPGA has 4 of them (S) or 8 (M and L), each driven by its own dedicated pad, and a tile chooses one for all its flip-flops. The model makes the trees perfect, with the same delay to every flip-flop, which real ones are not quite. A :term[PLL]{id=pll} (phase-locked loop) makes new clocks from an old one by multiplying and dividing its frequency, to turn a board’s 12 MHz oscillator into, say, 48 MHz for the fabric.

So an FPGA is a fabric, and columns of hard blocks in it, in the proportions that the market of the year wants. A chip for signal processing has more multipliers; a chip for networking has more transceivers. The vFPGA takes the middle road: M and L have RAM columns and no multipliers.

## Configure one by hand

Now do it. The chip below is the vFPGA-S: 2 × 2 tiles, 32 logic cells, 16 pads, 1,772 configuration bits. Your job is to make pad P2 show P0 XOR P1. You will need one logic cell to hold the XOR truth table, three routes (from each of the two pads into the LUT, and from the LUT to the third pad), and the pad P2 set to be an output. The check at the top simulates the *decoded bits* for all four input pairs, so “not yet” means the bits do not do it, and the reason is in red under the table.

::fpga-by-hand{n="28.6" caption="Zoom until you see a tile, and click the LUT nearest the pads; type I0 ^ I1 in its function box, and see 0x6666 appear. Then click a pad’s pin and choose what drives it, and route the pad P0 to the LUT’s I0, P1 to I1, and the LUT’s output to P2, tick P2 as an output. The Bits view shows every bit that changes as you click, and the logic view under it is recovered from the bits alone. Stuck? Show a solution loads a working one, and Clear starts again."}

:::lab[Read the bits]
Use Figure 28.6.

1. Press *Clear*, and look at the Bits view: all 1,772 bits are 0, and the check says nothing is connected. An empty FPGA does nothing.
2. Type `I0 ^ I1` into the LUT. Exactly eight bits change to 1. Which eight, and why those? (Every row where the two used inputs differ: the table repeats over the two unwired inputs, 0110 four times.)
3. Route the pads to the LUT. Each route adds a few 1 bits: click on one and read what it controls. A routing bit is the number of an input of a multiplexer: 0 means “nothing”, 1 the first input, and so on.
4. Tick P2 as an output, connect the LUT to it, and watch the goal turn to *reached*. Count the 1 bits: **19** out of 1,772.
5. Zoom out to the chip and back in to a logic cell. Every level of the view is a different way to look at the same bits: the die, the tile, the cell, the LUT’s bits. The multiplexer trees of Figure 28.1 are inside each cell; the pass transistors of Figure 28.4 are inside each multiplexer.
:::

One XOR gate on a 32-cell chip is hardly a design. To see how far it scales, here is the counter of Chapter 29, fitted on the same chip by the course’s tools. You have just done by hand the whole job of a place-and-route tool, for one gate; Chapter 30 takes the tool’s stages one at a time.

::fpga-studio{n="28.7" design="counter" size="S" views="chip,logic,bits,report" caption="The 4-bit counter as the tools configured it: six logic cells in one tile. In the Logic view select a gate and its cell lights up on the chip; select a cell on the chip and its LUT bits appear in the Bits view. Zoom to logic-cell level to see the truth tables, and use the Report for the utilisation. How many of the 32 cells does it use, and how many of the 1,772 bits are set?"}

:::lab[Read a design’s bits]
Use Figure 28.7.

1. In the Report, read the utilisation: **6 of the 32 logic cells**, 1 of 4 tiles, and 8 pads. Four of the six cells hold a flip-flop, one for each bit of the count.
2. In the Logic view, click one of the counter’s gates. The chip view shows where the cells that implement it were put, and the Bits view lights the bits that configure them.
3. Zoom the chip view to logic-cell level and read the tables. The cell of `value[0]` is a NOT of one of its inputs (its own output): a flip-flop that toggles on every clock. The cell of `value[1]` is an XOR of two inputs: that bit toggles when the bit below it is 1. Where did the counter’s `enable` and `clear` go? Not into a LUT: the flip-flop in each cell has a clock-enable and a reset input of its own, driven by the tile’s two shared pins, so the two multiplexers of Chapter 29’s gate count have disappeared into the cell.
4. Count the set bits in the Bits view: about 110 of the 1,772, some 6 %. (The exact number depends on the placer’s and router’s choices.)
:::

## Under the hood

:::hood[Decoding a bitstream into a circuit]
When the Studio runs the chip, it does not run the design you wrote: it runs what the bits say. `decodeBitstream` in `src/lib/pld/fpga/decode.ts` starts from every cell, pad or RAM that has any bit set, and walks *backwards* through the routing multiplexers, reading each one’s select field, to find everything that drives what is used:

```ts
// Walk backwards through the multiplexers.
while (stack.length) {
  const n = stack.pop()!;
  const kind = dev.nodeKind[n]!;
  const x = dev.nodeX[n]!;
  const y = dev.nodeY[n]!;
  if (kind === NK.LCO) makeAlive(x, y, dev.nodeIdx[n]!);
  else if (kind === NK.PADI) makePadAlive(dev.padAt(x, y, dev.nodeIdx[n]!));
  else if (kind === NK.RAMO) makeRamAlive(x, y);
  else if (kind === NK.GCLK) mark(dev.inList[dev.inStart[n]!]!);
  else mark(readSelect(dev, bits, n).input);
}
```

`readSelect` is the multiplexer of Figure 28.4 in code: it takes the select bits of a node, and returns which of its inputs they name (a code of 0, or a code larger than the number of inputs, means nothing):

```ts
const code = getBits(bits, off, dev.cfgWidth[n]!);
const ninputs = dev.inStart[n + 1]! - dev.inStart[n]!;
return { code, input: code >= 1 && code <= ninputs ? dev.inList[dev.inStart[n]! + code - 1]! : -1 };
```

Everything that the walk reaches becomes an element of the digital engine of Chapter 15: a `fpga-mux` for every multiplexer on the way, with only its selected input connected and the delay of the vFPGA’s model; an `fpga-lut4` for every cell whose truth table is a 16-bit parameter, evaluated as `truth[I0 + 2·I1 + 4·I2 + 8·I3]`; an `fpga-dff` when the cell’s bypass bit picks the flip-flop. An unknown or floating input makes a LUT’s output unknown only if the table actually depends on it. That is why the tools repeat a table over the inputs they leave unwired, and why, in Figure 28.5, every one of the XOR’s 16 table bits is critical: one flipped bit makes the table depend on an unwired input for one pair of the used ones.

The same decoding gives the recovered logic view of Figure 28.6. A combinational loop made by hand-configured routing is kept in the netlist, and the engine reports it, so the chip you watch running can be wrong in exactly the ways a real one can.
:::

## Build it for real

:::real{parts="an iCE40 board (an iCEstick, an iCEBreaker or any board with an iCE40 HX1K, HX8K or UP5K), a USB cable, the open-source tools Yosys, nextpnr-ice40 and Project IceStorm"}
Blink an LED on the iCE40, and then find your LUT in its bitstream.

1. Write the smallest design that uses a LUT: a counter whose top bit drives an LED. On an iCEstick, whose 12 MHz clock is on pin 21 and whose five LEDs are on pins 99, 98, 97, 96 and 95 (check the pins against your board’s documentation):

   ```verilog title="blink.v"
   module top (input clk, output led);
     reg [23:0] count = 0;
     always @(posedge clk) count <= count + 1;
     assign led = count[23];   // 12 MHz / 2^24 = 0.7 Hz
   endmodule
   ```

   ```text title="icestick.pcf"
   set_io clk 21
   set_io led 99
   ```

2. Build it with the open-source tools, which are the subject of the real lab of Chapter 30:

   ```sh
   yosys -p "synth_ice40 -top top -json blink.json" blink.v
   nextpnr-ice40 --hx1k --package tq144 --json blink.json --pcf icestick.pcf --asc blink.asc
   icepack blink.asc blink.bin
   iceprog blink.bin
   ```

   The LED blinks. Read what Yosys reported: the counter should come out as 24 flip-flops (`SB_DFF`), a carry chain (`SB_CARRY`) and about as many 4-input LUT cells (`SB_LUT4`), a small fraction of the HX1K’s 1,280 logic cells.

3. Now find the LUT. `blink.asc` is a text file with one section per tile, and `icebox_explain blink.asc` prints what the bits that are set mean. Look at a `.logic_tile` section: 16 rows of 54 bits, the shape of the chip’s configuration frames. Project IceStorm’s bitstream documentation says where the 16 LUT bits of each of the tile’s eight cells are among them;:cite[prjicestorm] use it to read out the table of one counter cell. It is an XOR of two of its inputs, as the cell of `value[1]` was in Figure 28.7, on real silicon.

The tiles of the iCE40 have 8 cells, as those of the vFPGA do, because the vFPGA is modelled on them. What differs is stated at the top of `src/lib/pld/devices/vfpga.ts`: the real chip’s wires can be tapped along their length, and it has extra “local track” stages between the wires and the LUTs.:cite[ds1040]
:::

## Exercises

```quiz
q: 'A tile of the vFPGA has 8 logic cells, each with 25 configuration bits. One tile has eight AND cells and another has eight XOR cells, wired in the same way. Which of the tile’s bits can differ?'
options:
  - text: All 200 cell bits.
    why: 'Nine of a cell’s 25 bits are flags, which say how the cell is used (flip-flop or not, carry or not), and the wiring is in other bits again. Both tiles use the cells the same way.'
  - text: 'Only the truth-table bits: 96 of them, since an AND table (0x8888) and an XOR table (0x6666) differ in three places out of every four.'
    correct: true
    why: 'A cell’s table is the only thing that says *what* it computes. The two tables, written over two used inputs and repeated over the others, are 1000 and 0110 repeated, which differ in 12 of 16 places, and 8 × 12 = 96.'
  - text: Only 8, one per cell.
    why: 'The tables 1000 and 0110 differ in three of their four places, not one.'
```

```quiz
q: 'An FPGA’s configuration is in SRAM, loaded from a flash chip at power-up. What happens to the pins of the FPGA while it is loading?'
options:
  - text: 'They are inputs (high impedance) until the configuration has arrived and the chip enters user mode.'
    correct: true
    why: 'Until the bitstream has been loaded, no pad has been told to be an output, and no flip-flop has an initial value. Boards must be designed to be safe with the FPGA’s pins floating for tens of milliseconds, which is why they have pull-up and pull-down resistors on lines like chip-selects.'
  - text: They all output 0.
    why: 'An output pad is itself a configuration bit (pad direction); that bit has not yet been loaded, so the pad does not drive anything.'
  - text: They keep whatever the previous configuration set.
    why: 'The memory is SRAM, and is empty at power-up, so there is no previous configuration.'
```

```quiz
q: 'A cosmic ray flips a bit in the configuration memory of an SRAM FPGA that runs a design in which nothing has changed since the last power-up. The chip is not scrubbed. When is the error corrected?'
options:
  - text: At the next clock cycle, because the flip-flops are re-loaded.
    why: 'The flip-flops hold data, not configuration. The bit that flipped is in the configuration memory, which is read by nothing during operation.'
  - text: 'When the configuration is rewritten: at the next power-up, or by a scrubber that reads the frames back and rewrites the wrong one.'
    correct: true
    why: 'The configuration bits are never rewritten during operation, so an upset stays until something writes it again. A scrubber compares each frame with a stored copy or a checksum, and rewrites it, often while the design runs.'
  - text: 'Never: the design is permanently damaged.'
    why: 'The silicon is fine: the flip is a state, not damage. A rewrite fixes it.'
```

```parsons
title: 'What happens when an SRAM FPGA is powered on'
prompt: 'Put the steps in the order they happen.'
lines:
  - 'The supply rises and the configuration SRAM powers up in arbitrary states; every pad is an input.'
  - 'The FPGA reads its bitstream from the flash chip, frame by frame.'
  - 'Each frame is checked against its checksum and written into the configuration memory.'
  - 'The flip-flops are set to their initial values from the configuration.'
  - 'The chip enters user mode: pads set to output start driving, and the design runs.'
distractors:
  - 'The flash chip writes the design into the LUTs by running the synthesis tool.'
  - 'The FPGA compiles the source of the design into routing.'
```

```bug
title: 'Sizing a LUT'
prompt: 'A designer wants to know how many 4-input LUTs are needed to hold a 5-input function in the worst case, and writes down a chain of reasoning. Click the first line that is wrong.'
lines:
  - 'A 4-input LUT holds any function of 4 inputs.'
  - 'A 5-input function f(a, b, c, d, e) can be split on e: f = e ? f1(a, b, c, d) : f0(a, b, c, d).'
  - 'Each of f0 and f1 is a function of 4 inputs, so each fits in one LUT4: 2 LUTs.'
  - 'The choice between them, by e, is a multiplexer, which a LUT cannot do, so a fixed multiplexer is needed in front of the output.'
  - 'So a 5-input function needs at most 2 LUT4s and a multiplexer.'
wrong: 3
why: 'A multiplexer *is* a function (of three inputs: f0, f1 and e), so it fits in a LUT4. The worst case is three LUT4s. FPGA makers of the LUT4 era built the multiplexer in for exactly this reason: a dedicated one combines two LUT4s into a LUT5.'
notes:
  '0': 'True: 2¹⁶ tables.'
  '1': 'This is Shannon expansion, the identity of Chapter 11.'
  '2': 'Correct: with e removed, each half depends on four inputs.'
```

:::challenge[A LUT6 in LUT4s]
A LUT6 holds 64 bits. Show that any function of six inputs can be built from at most seven LUT4s, and compare the number of stored bits. How many levels of LUTs, and therefore of wire, does the LUT4 version have?

*Answer.* Split on two inputs, e and f: the function is a 4:1 multiplexer, selected by e and f, of four functions of the remaining four inputs. Each is one LUT4: four LUT4s. A 4:1 multiplexer has six inputs and is itself three 2:1 multiplexers, each a function of three inputs, so three LUT4s (Figure 30.2 finds it). Total: 4 + 3 = 7 LUT4s, or 112 stored bits against the LUT6’s 64, and three levels of LUTs where the LUT6 has one. The LUT6 is smaller in bits and faster: that is the argument for six inputs. Its cost is that a function of only four inputs wastes three quarters of a LUT6’s memory, unless the cell can be split into two smaller functions, as the adaptive LUTs of Altera and the LUT6 of Xilinx can.
:::

An exercise in routing. In Figure 28.6 you did everything; here the cells are placed for you, and only the wires are yours.

```route
id: 28-inside-an-fpga/route-two-pairs
title: Wire up the placed cells
prompt: |
  Three logic cells of a vFPGA-S are already set up: `LC(1,1,0)` computes `I0 & I1`, `LC(2,1,0)` computes `I0 & I1`, and `LC(1,2,0)` computes `I0 | I1`. Pads **P0**, **P1** and **P2** are inputs and **P8** is an output. Route the six nets in the list so that **P8 = P1 & (P0 | P2)**: P0 and P1 into the first cell, P1 and P2 into the second, both results into the third, and the third to P8.

  Work from each sink back towards its source, as the hardware does. Choose a sink in the list, and the panel shows the inputs of the multiplexer that drives it, each labelled with the signal it carries right now. Choose one; if it is a wire that does not yet carry the net’s signal, carry on with that wire’s own multiplexer. Every wire has a single multiplexer, so two nets cannot share a wire: you will have to find each of them a road of its own.
hints:
  - 'P1 feeds two inputs, one in each of the first two cells. Route the first, then route the second: its last wire can start from a wire the first route already uses, because it carries the same signal.'
  - 'If a choice says it carries another net, take another: using a wire that carries a different net would connect the two (the check calls it a short).'
  - 'Stuck for a free road? The chip view shows which wires are in use. There are four wires in every direction from every tile, and the pads sit on the edge of the die.'
explain: |
  Each sink took between two and four multiplexers, and every wire was chosen by exactly one. That is all routing is: for each net, a tree of multiplexer settings from its source to its sinks, in which no wire is used by two nets. The router of Chapter 30 does this for thousands of nets at once, and when two of them want the same wire it makes one of them pay more, until everyone has a road. The check simulated the fabric and found `P8 = P1 & (P0 | P2)` for all eight input combinations.
fabric:
  pads: { P0: in, P1: in, P2: in, P8: out }
  cells:
    - { at: [1, 1, 0], lut: "I0 & I1" }
    - { at: [2, 1, 0], lut: "I0 & I1" }
    - { at: [1, 2, 0], lut: "I0 | I1" }
nets:
  - { name: a, from: P0, to: ["LC(1,1,0).I0"] }
  - { name: b, from: P1, to: ["LC(1,1,0).I1", "LC(2,1,0).I0"] }
  - { name: c, from: P2, to: ["LC(2,1,0).I1"] }
  - { name: d, from: "LC(1,1,0)", to: ["LC(1,2,0).I0"] }
  - { name: e, from: "LC(2,1,0)", to: ["LC(1,2,0).I1"] }
  - { name: f, from: "LC(1,2,0)", to: [P8] }
outputs: { P8: "P1 & (P0 | P2)" }
solution:
  - [P0, "LC(1,1,0).I0"]
  - [P1, "LC(1,1,0).I1"]
  - [P1, "LC(2,1,0).I0"]
  - [P2, "LC(2,1,0).I1"]
  - ["LC(1,1,0)", "LC(1,2,0).I0"]
  - ["LC(2,1,0)", "LC(1,2,0).I1"]
  - ["LC(1,2,0)", P8]
```

## What’s next

You now know what an FPGA is made of, and how a design *lives* in one: a few dozen LUT tables, a few hundred routing choices and a handful of flags, packed into a bitstream. Nobody sets those by hand except once, to see how. A design of any size is written as text, and Chapter 29 introduces the language, DCL, in which the rest of the course describes hardware. Chapter 30 then takes the compiled result through the tools that decide which cell, which wire and which bit, for a design too large to configure by hand: the toolchain that turned your 6-cell counter into about a hundred set bits, and can do the same to the 3,000-cell register file of a CPU.
