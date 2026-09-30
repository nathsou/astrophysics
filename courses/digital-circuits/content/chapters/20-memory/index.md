---
number: 20
title: Memory
summary: How a computer stores billions of bits. A cell made of gates, the six-transistor SRAM cell, the DRAM cell that leaks and must be refreshed, ROM and flash, and why memory comes in layers.
duration: About 2 hours
prerequisites: [state-machines]
---

A flip-flop remembers one bit, and a state machine of a few of them can run a traffic light. A phone has 8 GB of memory: 69 billion bits. Build each with a flip-flop of about 20 transistors and you need 1.4 *trillion* transistors, more than ten times as many as the biggest processors ever made have in all. Yet the memory chips in that phone are a few square millimetres of silicon each, and cost a few pounds.

The trick is that a memory bit does not have to be a flip-flop, and it does not have to compute anything. It only has to hold a value, be found by its address, and give it up when asked. Strip a bit down to what that needs and it costs six transistors, or one transistor and one very small capacitor, or a single wire threaded through a ring of iron. This chapter goes down through those designs, and then back up through the layers that a computer puts between its processor and its bulk memory to hide how slow the cheap kinds are.

## One bit, from gates

The gates you already have make a bit. Chapter 17's D latch is a pair of cross-coupled NAND gates with a little steering logic in front of them, and it can be used as a memory *cell*: **D** is the data, and the **word line** WL says when to listen. While WL is 1 the cell follows D; when WL falls it keeps the last value, for as long as it has power.

```quiz
q: 'The cell below is four NAND gates and one inverter. In the standard CMOS design of Chapter 9 a NAND gate has 4 transistors and an inverter has 2. How many transistors does it have, opened up?'
options:
  - text: '10'
    why: 'That is a D latch built with a lighter design (transmission gates); this one is made of complete NAND gates.'
  - text: '18'
    correct: true
    why: 'Four NANDs × 4 transistors + 1 inverter × 2 = 18. Press Switches on the dial to count them.'
  - text: '32'
    why: 'That would be eight-transistor gates. A NAND gate is only 4.'
```

::circuit{src="20-memory/circuits/latch-cell.json" title="A memory bit from gates" n="20.1" dial=true mode="logic" speed=1e-6 caption="The cell starts with WL and D both on, so it holds a 1. Turn D off: the cell follows (WL is on). Turn WL off, then change D: the cell holds its bit. Now press Switches on the dial to open the gates up into their transistors, and run the same test: 18 transistors for one bit."}

Eighteen transistors per bit works, and would be far too expensive: a memory chip has to be a *lattice*, millions of cells sharing wires, and a cell can afford only what it strictly needs. The next sections strip it down. First, though, how do you find one cell among millions?

## Many bits: word lines and bit lines

Put four D latches side by side, sharing one write enable, and you have a **register**: a word of four bits (Chapter 18). Put several registers under one another and you have a memory of several words. To use it you need two things: a way to say *which word*, and a way to move data in and out on shared wires.

- The **address** says which word. The address bits go into a **decoder** (Chapter 13), which raises exactly one of its outputs, the :term[word line]{id=word-line} of that word. A memory of 2<sup>*n*</sup> words needs *n* address bits: 8 words, 3 bits; 4 billion words, 32 bits.
- The :term[bit lines]{id=bit-line}, one per bit of the word, run *through* all the words. Every cell of a column hangs on the same bit line, and only the cell whose word line is high is connected to it. Data goes in and out along the bit line.

Here is the smallest useful memory, four words of two bits, built as a real circuit: a write decoder, four registers and two multiplexers that pick the word to read. It is a *register file*, and yours will be the heart of the datapath in Chapter 21.

::circuit{src="20-memory/circuits/register-file.json" title="A register file" n="20.2" mode="logic" speed=1e-6 caption="Write a word: set the address A1 A0 and the data D1 D0, turn WE on and press the clock button. Change the address to read any word back. Write to word 2 and check that no other word changes. The decoder raises one write line; the two multiplexers pick the word that is read."}

Notice what the write enable does and does not do. The clock says *when* the registers listen, the write enable together with the decoder says *which one* does, and the data lines are shared by all four. A glitch on a write line would write garbage into a word, which is why Chapter 15 said a signal that acts must come straight from a register.

A memory is also a lookup table: address in, word out. That is what makes a ROM (Chapter 25) a truth table, and an FPGA (Chapter 28) a sea of tiny memories. The rest of this chapter is about how cheaply a cell can be made.

## Six transistors: the SRAM cell

The gated latch has two layers of gates in it that a memory cell does not need. Look at the heart of it: two inverters, each feeding the other. That loop has two stable states (Chapter 16), and needs only four transistors. To get a bit in and out you add **two access transistors**, one on each side, with their gates on the word line. Six transistors in all, the **6T cell** of a :term[static RAM]{id=sram} (SRAM): "static" because it holds its value for as long as the power is on, with no further attention.

::circuit{src="20-memory/circuits/sram-cell.json" title="The six-transistor SRAM cell" n="20.3" mode="logic" caption="The inverter pair in the middle holds the bit (the lamps Q and Q̄). To write, turn D and D̄ to complementary values, turn WE on so that the drivers connect them to the bit lines BL and B̄L, raise WL, then lower WL and WE. Try writing a 1 with D and D̄ both at 1: nothing happens. To read, set both D and D̄ to 1, pulse WE (this charges both bit lines high), and then raise WL: the cell pulls one bit line down."}

Two features of the 6T cell deserve attention.

**Both bit lines carry the bit.** BL takes the value, B̄L its opposite. That doubles the wires, and buys three things: writing is a fair fight, since the driver pulls one side of the cell down and the cell's own loop does the rest; reading needs only the *difference* between the two lines, which is far more robust than a level; and noise that hits both lines equally cancels.

**Writing is a fight, and the transistors are sized to win it in the right order.** To write, the driver pulls one node of the cell towards 0 through an access transistor, against the cell's own pull-up that is trying to hold it at 1. The access transistor wins because the pull-up is made *weak*. Reading, on the other hand, must not flip the cell: the bit line, precharged high, is connected to a node the cell holds at 0 through the access transistor, and the node must not be pulled up enough to flip. That works because the cell's pull-down is made *strong*. The same three sizes are in the figure (`strength` on the transistors): pull-downs strong, access transistors normal, pull-ups weak. Make them all equal and, as the tests of the switch-level engine confirm, a write leaves the cell at X.

:::lab[Try to break the cell]
1. Write a 1, then a 0, then a 1 again, using the procedure in the caption. Confirm with the lamps that Q and Q̄ are always opposite.
2. Lower WL and play with D, D̄ and WE. The cell holds: with the word line low, the bit lines are not connected.
3. Write a 1, then set *both* D and D̄ to 0, turn WE on and pulse WL. Both sides of the cell are pulled down at once, and when WL falls the two inverters race: the lamps go to X, undefined, and the simulator says the circuit oscillates. A write needs *opposite* values on the two bit lines.
4. Do the read: with a 1 stored, precharge both lines, release, and raise WL. Which line falls? Check that the cell still holds its 1 afterwards.
:::

## The memory explorer

The explorer puts this into a whole memory: an address decoder, eight word lines, four columns of bit lines and a cell at every crossing. Write a word and read it back, and watch each line light in turn. The same array can be built from any of three kinds of cell (the last two are the subject of the next sections), and the differences show up in the *frames* of each operation.

::memory-explorer{n="20.4" caption="Choose SRAM, set the word with the four D switches, pick an address and press Write; then press Read. Use Step by step to move through the frames, and watch the solid (driven) and dashed (floating) bit lines. Then switch to DRAM and repeat: the read now has an extra step. The ROM refuses to be written."}

:::lab[Read the frames]
1. With SRAM, write 1010 to address 3 and read it. Find the frame in which a bit line is 100 mV below its partner: that small difference is all a sense amplifier needs.
2. Switch to DRAM and write 1010 again. In the read, look at the *Word line* frame: each bit line moves by only 67 mV from its precharge level, and the cell itself is left at the in-between voltage. The value has been destroyed by being read. The *Restore* frame puts it back.
3. Switch to ROM and read the addresses one after another. The word lines are the same, but the cells are transistors that pull the bit line down.
:::

## One transistor and a capacitor: DRAM

Even six transistors are a lot. A :term[dynamic RAM]{id=dram} (DRAM) cell has one, and a capacitor. The capacitor holds the bit as charge (Chapter 4): full for a 1, empty for a 0. The transistor is the access switch, with its gate on the word line. That is a cell of a fraction of the area of a 6T cell, which is why main memory is DRAM: the cheapest bit that can be found by address and rewritten as often as you like.

::circuit{src="20-memory/circuits/dram-cell.json" title="The DRAM cell" n="20.5" mode="logic" caption="Write a 1: D on, WE on, WL on, then WL off and WE off. The cell lamp stays lit: the capacitor holds the charge. Now precharge the bit line low (D off, WE on, WE off), and raise WL: the big bit line drags the cell down, and the 1 is gone. Reading a DRAM cell destroys what it reads."}

The price is in two problems that the capacitor brings.

**Reading is destructive, and the signal is tiny.** The cell holds a few tens of femtofarads (10<sup>−15</sup> F) and it is connected to a bit line that is a long wire touching thousands of transistors, several times its capacitance. When the access transistor turns on, the cell does not drive the bit line: the two share their charge, and the bit line barely moves.

:::equation{#charge-sharing caption="The bit line after a cell has shared its charge with it: the two capacitances are connected in parallel, and charge is conserved."}
$$\term{vbl}{V_{bl}} = \frac{\term{cs}{C_s}\,\term{vcell}{V_{cell}} + \term{cbl}{C_{bl}}\,\term{vpre}{V_{pre}}}{C_s + C_{bl}}$$

```terms
vbl:
  label: 'V_bl, the bit line voltage afterwards'
  what: 'The voltage of the bit line, and of the cell, once they have shared their charge, in volts.'
  why: 'Connected together, the two capacitors must have the same voltage, and the total charge Cs·Vcell + Cbl·Vpre cannot change.'
  effect: 'It lies between the precharge voltage and the cell''s voltage, much closer to the precharge.'
cs:
  label: 'C_s, the cell capacitance'
  what: 'The storage capacitor, about 20 fF here.'
  why: 'A bigger capacitor moves the bit line more and stores charge that lasts longer, but it takes more chip area.'
  effect: 'Doubling Cs roughly doubles the signal.'
vcell:
  label: 'V_cell, the cell voltage before'
  what: 'The voltage the cell held: 1.2 V for a fresh 1, 0 V for a 0, and less than 1.2 V for a 1 that has been leaking.'
  why: 'It is the stored bit. The read must find out which side of the precharge voltage it is on.'
  effect: 'A leaked 1 gives a smaller swing, and below a limit the sense amplifier cannot tell it from a 0.'
cbl:
  label: 'C_bl, the bit line capacitance'
  what: 'The capacitance of the whole bit line, about 160 fF here, eight times the cell.'
  why: 'A bit line is a long wire with a transistor of every cell in its column attached.'
  effect: 'A longer bit line, with more cells on it, makes the swing smaller.'
vpre:
  label: 'V_pre, the precharge voltage'
  what: 'The voltage the bit line was set to before the word line rose: half the supply, 0.6 V.'
  why: 'With the line at the halfway level the cell can push it up (for a 1) or down (for a 0) by the same amount.'
  effect: 'The swing is measured from here.'
```
:::

With the numbers of the figure, a full cell moves the bit line by (1.2 − 0.6) V × 20/(20 + 160) = **67 mV**, up for a 1 and down for a 0. That is the whole signal. A :term[sense amplifier]{id=sense-amplifier} on every column turns it into a full 0 or 1. It is a pair of cross-coupled inverters, the loop that you have just seen holding an SRAM bit, with its two sides connected to the bit line and to a reference: it is balanced on the hump of the double well of Chapter 16, and the small difference tips it one way or the other, after which the loop drives the line the rest of the way. The amplified bit line, still connected to the cell through the access transistor, then **writes the value back** into the capacitor that the read had emptied. Every read of a DRAM row is a read followed by a write, and the *Restore* frame of the explorer shows it.

**The charge leaks away.** The transistor is not a perfect switch, and the capacitor is not a perfect insulator: junction leakage, the tiny current through the off transistor and the dielectric drain the charge of a stored 1 continuously, as an exponential, V(*t*) = V<sub>dd</sub>e<sup>−*t*/τ</sup>. It is still a 1 as long as the swing it gives the bit line is larger than the sense amplifier can resolve (about 30 mV in this model): for these numbers the cell must stay above 0.87 V, that is, 72 % of the supply. How long does that take?

```quiz
q: 'A DRAM cell has just been written with a 1 and nothing touches it. Roughly how long does the 1 stay readable, in a real chip at 85 °C?'
options:
  - text: Nanoseconds, like the delay of a gate.
    why: 'A gate has to be fast; a DRAM cell is designed to hold, and the leak is very slow indeed.'
  - text: 'From about a tenth of a second for the weakest cells to seconds or more for the typical ones.'
    correct: true
    why: 'Retention times are spread over a wide range (a log-normal distribution): the median cell keeps its bit for seconds at 85 °C, and the weakest of billions, the “tail”, for around a tenth of a second or less. The refresh interval must be shorter than the weakest cell: JEDEC specifies 64 ms.'
  - text: 'Years, since a capacitor holds its charge as long as nothing connects to it.'
    why: 'That is flash, which stores its charge on a floating gate inside thick insulator. A DRAM capacitor is a few tens of femtofarads on a thin dielectric, next to a transistor that leaks.'
```

The remedy is :term[refresh]{id=refresh}: every row is read and written back before its charge has fallen too far. The DDR4 standard sends 8192 refresh commands in a 64 ms window: one every 7.8 µs, each refreshing a few rows, so that every row is restored once in 64 ms.:cite[jedec-jesd79-4] The interval is set by the *weakest* cell of the whole chip, out of billions, and that is what makes the numbers hard: a chip with 17 billion cells has a long tail of leaky ones.:cite[liu-raidr2012] It is also set by temperature: leakage grows quickly with heat, and the standard halves the interval (to 32 ms) above 85 °C.

::dram-leak{n="20.6" caption="Sixty-four cells hold a pattern. With No refresh, press Run at 1 s/s and watch every stored 1 drain (the chart shows the weakest, the median and the strongest cell). Set the refresh to 64 ms: nothing is lost. Try 250 ms, then 1 s: the weak cells die. Then set the temperature to 105 °C with a 64 ms refresh, and see why the standard halves it."}

:::lab[Feel the refresh]
1. With *No refresh* and *All 1s*, run at 1 s/s. Note when the first ✗ appears and the time shown as *weakest 1 lasts*. At 85 °C it is about 159 ms for this array.
2. Choose *64 ms* and run for a while: zero bits lost. The refreshes are spread over the interval, one row after another.
3. Choose *250 ms*. The weakest cell is now refreshed after it has crossed the limit, and its bit is lost. That cell is the reason the interval cannot be longer.
4. Go back to 64 ms and raise the temperature to 105 °C: the weakest cell now lasts about 40 ms and the refresh is too slow. Set 32 ms and it holds.
:::

Refresh has a running cost. Each refresh command keeps a bank busy for a time t<sub>RFC</sub> that grows with the size of the chip: 350 ns for an 8 Gbit DDR4 chip, 550 ns for 16 Gbit. Every 7.8 µs that is **4.5 %** of the time for the first and **7 %** for the second, during which that memory cannot be read. Bigger chips have more rows to refresh in the same 64 ms, so a DRAM gets worse at this as it grows, and much of the design of a modern memory controller is scheduling refreshes where they will hurt least.

:::history{year=1949 title="Memories that had to be refreshed" people="Freddie Williams, Tom Kilburn, Maurice Wilkes"}
The first electronic computer memories were dynamic too. In 1946–47 Freddie Williams and Tom Kilburn at Manchester found that a bit could be stored as a spot of charge on the face of a cathode-ray tube, and read back by the tiny current it changed in a metal plate; the spots faded within a fraction of a second and had to be read and redrawn continually. Their **Williams tube** held the 1,024 bits, 32 words of 32, of the Manchester Baby, which ran its first program on 21 June 1948.:cite[ethw-baby] A year later, on 6 May 1949, Maurice Wilkes’s EDSAC at Cambridge ran its first program from a memory of **mercury delay lines**: a pulse of sound sent down a tube of mercury arrives at the far end a moment later, is amplified and sent round again, and a word is available only when its pulse comes past. It held 512 words of 17 bits, and 1,024 from 1952.:cite[chm-edsac] Both are regenerative memories, and both survive in a DRAM: a bit that lasts a short time, kept alive by reading it and writing it back.
:::

:::history{year=1968 title="One transistor, one capacitor" people="Robert Dennard, IBM"}
Robert Dennard, at IBM's Thomas J. Watson Research Center, invented the one-transistor DRAM cell in 1966, and IBM filed the patent in 1967; it was granted on 4 June 1968 (US 3,387,286, *Field-effect transistor memory*).:cite[dennard-patent]:cite[ibm-dram] The first commercial DRAM was not made of it. Honeywell's William Regitz had proposed a three-transistor dynamic cell, and Intel, working with him, introduced the 1103 in October 1970: 1,024 bits in an 18-pin package, on a p-channel MOS process, with that three-transistor cell.:cite[intel-1103] It was cheap enough to displace magnetic-core memory in most computers, and by 1971 it was the best-selling memory chip in the world. The single-transistor cell took over from about the mid-1970s, with the 4-kilobit chips, and every DRAM since has been some version of it. (Dennard is also the name behind the scaling rules of Chapter 10.)
:::

## Memory that keeps its bits: ROM and flash

SRAM and DRAM are :term[volatile]{id=volatile}: switch the power off and the bits are gone. Something has to hold the first instructions of a computer, and it has to be there when the power comes on. That is a :term[ROM]{id=rom} (read-only memory), and its cells are the simplest of all: a bit is a transistor at a crossing of a word line and a bit line, or the absence of one.

::rom-weave{n="20.7" caption="The eight words are the ASCII codes of APOLLO 8. Pick an address to read a word (the row of set line and the threaded crossings light up), click a crossing to change one bit, or weave your own eight characters. Switch between the core rope of the Apollo Guidance Computer and a mask ROM, where a transistor stands at each 1."}

In a **mask ROM** the pattern of transistors is decided by one layer of the chip, made when the chip is made: cheap in millions and fixed for ever. The idea is older than the transistor: in 1969 the computer that guided Apollo 11 to the Moon kept its 36,864 words of program in **core rope**, wires threaded by hand through, or round, tiny magnetic cores, and the wire's path *was* the bit. Chapter 25 continues with ROMs you can program (fuses, EPROM, flash), and what a ROM says about logic: it is a truth table with the address as the input.

:::history{year=1953 title="Rings of iron" people="Jay Forrester, An Wang"}
Magnetic **core memory** stored a bit in the direction of magnetisation of a ring of ferrite a millimetre or two across, and kept it with no power at all. An Wang’s patent of 1955 covers the use of cores to store bits;:cite[wang-patent] the arrangement that made it practical is Jay Forrester’s **coincident-current** array, in which a core is flipped only where the currents in one row wire and one column wire, each too weak alone, add up. It went into MIT’s Whirlwind computer in the summer of 1953 as an array of 32 × 32 cores for each of 16 bits.:cite[chm-whirlwind-core]:cite[forrester-patent] For twenty years it was *the* computer memory: fast, reliable and non-volatile, until DRAM became cheaper. (“Core dump” is still what programmers call a memory dump.)
:::

:::history{year=1969 title="Software woven into wire" people="MIT Instrumentation Laboratory, Raytheon"}
The Apollo Guidance Computer had 2,048 words of erasable core memory and 36,864 words of fixed memory in core rope, 16 bits each. The rope was made in six modules of 512 cores; a wire passed through a core for a 1 and round it for a 0, and each core carried the 192 bits of twelve words.:cite[righto-rope] The rope was woven at Raytheon from the programmers’ finished code, and a change to the program meant a new rope: which is why it was frozen weeks before a mission.
:::

The one kind of non-volatile memory that you can write as well as read, and that is small and cheap enough to hold gigabytes, is :term[flash memory]{id=flash-memory}. Its cell is a transistor with a second gate, the *floating gate*, buried in insulator: electrons put there stay for years and raise the transistor's threshold voltage Vt. To read, apply a voltage between the erased and the programmed Vt and see whether the transistor conducts. To write, push electrons onto the floating gate with a high voltage, in small **pulses**, checking after each; to erase, take them all off at once, and in flash that can only be done for a whole **block** of cells.

::flash-cell{n="20.8" caption="Choose the bits per cell and a value, and press Program: each pulse raises Vt by a step, and after each one the cell is checked against the window of its level. Press Read to compare Vt with the references, and Erase to start again. Then move from SLC (1 bit) to QLC (4 bits): the windows shrink, the pulses get smaller and more numerous, and the margin between levels falls to a fifth of a volt."}

A cell that stores two, three or four bits (**MLC, TLC, QLC**) uses 4, 8 or 16 levels of Vt instead of two: the same transistor, more capacity, but the levels are close together and the smallest drift (the electrons leak; neighbouring cells interfere; the oxide wears every time it is stressed by an erase) crosses one.:cite[cai2017] The result is a trade of capacity for endurance: roughly 100,000 erase cycles for SLC, 10,000 for MLC, 3,000 for TLC and 1,000 for QLC, as orders of magnitude. A solid-state drive hides that with spare blocks, error-correcting codes and *wear levelling*, which spreads writes over all the cells.

:::history{year=1984 title="Flash" people="Fujio Masuoka, Toshiba"}
Fujio Masuoka and his colleagues at Toshiba invented flash memory around 1980. They presented a NOR flash cell at the International Electron Devices Meeting in December 1984, and the denser NAND flash three years later, in 1987.:cite[masuoka1984]:cite[masuoka1987] The name is said to have been suggested by a colleague, Shōji Ariizumi, because erasing a whole block at once reminded him of the flash of a camera.:cite[spectrum-nand] NAND flash, whose cells are strung in series and read a page at a time, is in every phone and solid-state drive today.
:::

## The hierarchy

You now have memories that differ by a factor of a million in speed and a factor of a hundred in cost per bit, and no single kind is best at both. The answer is to use them all: a small, fast memory next to the processor, a larger one behind it, and so on, with the *right* data kept in the fast one. That is the :term[memory hierarchy]{id=memory-hierarchy}.

::memory-hierarchy{n="20.9" caption="Round numbers for a desktop or server of the 2020s: the exact values depend on the chip. Switch on human time, where one nanosecond lasts a second: a trip to main memory takes a minute and twenty seconds, a solid-state drive nearly a day, a hard disk three months. Then move the hit-rate sliders."}

```quiz
q: 'A processor’s L1 cache answers in 1 ns and finds the data 95 % of the time. The L2 (4 ns) finds it 80 % of the rest, and the L3 (15 ns) 70 % of what is left; main memory takes 80 ns. What is the average time of an access?'
options:
  - text: About 1.6 ns.
    correct: true
    why: '1 + 0.05 × (4 + 0.20 × (15 + 0.30 × 80)) = 1.59 ns. Only one access in 20 leaves the L1, one in 100 leaves the L2, and one in 330 goes to main memory, which is what keeps the average near the fastest level.'
  - text: About 5 ns, the average of the four times.
    why: 'The levels are not used equally. The 1 ns L1 answers nineteen accesses out of twenty, so it counts nineteen times as much as the L2.'
  - text: About 20 ns, one quarter of the way to the memory time.
    why: 'The average is weighted by how often each level is reached, and misses are rare: the slow levels contribute in proportion to the small fraction of accesses that get to them.'
```

It works because programs are *local*: they touch the same data again soon (temporal locality) and the data next to it (spatial locality). A :term[cache]{id=cache} keeps recently used lines of 64 bytes in fast SRAM, so most accesses never leave it. The formula is the one in the caption, the **average memory access time**: the hit time of a level plus its miss rate times the time of the level below. Try the sliders: raising the L1 hit rate from 95 % to 99 % takes the average from 1.6 ns to 1.1 ns, 30 % less, though it looks like a small change. A miss to main memory costs the time of eighty L1 hits, and a miss to a disk is a hundred thousand times worse again.:cite[hennessy-patterson2019]

Every level of the table is one of the cells of this chapter. The registers are flip-flops; the caches are SRAM (six transistors per bit, so they are small: megabytes, and take up much of the area of a processor); main memory is DRAM (one transistor and a capacitor, gigabytes, refreshed every 64 ms); the solid-state drive is NAND flash; and the disk is not silicon at all. Everything you know about the computer's performance, from why a loop over an array is faster than a loop over a linked list to why adding cores does not make things faster, has an answer somewhere in that table.

:::hood[Two ways to simulate a memory]
The simulator has two models of a memory, and the difference is the point of the abstraction dial. A RAM *block* of the parts bin is behavioural: an array of numbers with a write on the rising clock edge, and a read that follows the address (`src/lib/sim/digital/models/blocks.ts`):

```ts
if (rising) {
  const we = control(nets[this.we]!, 0);
  if (we !== 0) {
    readBus(nets, this.a, 0, this.a.length);
    …
      if (we === 1) {
        readBus(nets, this.di, 0, this.di.length);
        this.mem[addr] = bus.value;
        this.unknown[addr] = bus.unknown;
      } else {
        // Unknown write enable: the word may or may not have been written.
        this.unknown[addr] = this.dataMask;
```

A lookup and a store: microseconds, however many words. At the gate level, the same memory is what this chapter drew: the cell is transistors, and the switch-level engine has to solve them. It models an SRAM cell with *strengths* (a supply beats a driven transistor, which beats a weak pull-up, which beats stored charge), and it models a DRAM cell with *charge* (a node cut off from every supply keeps its value, and when two such nodes are joined the larger capacitance wins: exactly the sharing of the charge equation). A 16 × 16 array of SRAM cells, 1,632 transistors with its drivers, builds in about 45 ms and needs about 0.6 ms for each row it reads or writes (the timings printed by `memory.test.ts`), far slower than the block’s array lookup, and a 256 × 8 RAM would have 12,288 transistors in its cells alone.

So the dial opens gates, and stops at a memory. When you press *Switches* on a circuit that contains a RAM block, the check that decides whether a circuit can be opened refuses, and says why (`src/lib/sim/expand/expand.ts`):

```ts
} else if (!KEPT.has(c.type)) {
  reason ??= `${c.id} (${getDef(c.type)?.name ?? c.type}) has no transistor-level version`;
}
```

A block is an abstraction that has no transistor-level version, and the dial is grey for it. What you *can* do is build the cells yourself, as Figures 20.1 and 20.3 do, and simulate a *small* array at the level below: which is what tells you that reading an SRAM does not upset it, or that reading a DRAM does. The simulator switches models when you tell it to, by choosing the parts; a memory is behavioural when it is big and structural when it is small enough to look at.
:::

## Exercises

```quiz
q: 'A memory has 1,048,576 words (1 Mi). How many address bits, and how many AND gates in a one-stage decoder that has a word line for each word?'
options:
  - text: '20 address bits, and 1,048,576 AND gates of 20 inputs.'
    correct: true
    why: '2²⁰ = 1,048,576. A flat decoder is one AND per word line, each looking at all 20 bits. Real memories split it in two stages (a row decoder and a column decoder), so that they need about 2 × 2¹⁰ gates of 10 inputs instead.'
  - text: '10 address bits, and 1,024 AND gates.'
    why: '10 bits give 2¹⁰ = 1,024 words. Half of 20 is not half of the words.'
  - text: '20 address bits, and 20 AND gates.'
    why: 'Each word line needs its own gate, since each is a different minterm of the address: one gate cannot drive 2²⁰ different lines.'
```

```quiz
q: 'Why does a DRAM read have to be followed by a write, but an SRAM read does not?'
options:
  - text: 'A DRAM cell shares its charge with the much bigger bit line, which leaves the cell at the in-between voltage; an SRAM cell is a loop of inverters that drives the bit line without changing.'
    correct: true
    why: 'The DRAM cell has no drive of its own: it is a capacitor, and sharing charge with the bit line empties it. The SRAM cell is an active circuit and its loop restores itself, at the price of six transistors.'
  - text: 'Because the DRAM is slower.'
    why: 'Speed is a consequence, not the reason.'
  - text: 'Because DRAM is refreshed.'
    why: 'Refresh is the *same* operation (read a row and write it back), used to fight the leak. The read is destructive first, whether or not there was a leak.'
```

```quiz
q: 'A DDR4 chip’s cells are cooled from 85 °C to 65 °C. What happens to the retention time, and to the refresh needed?'
options:
  - text: 'Retention roughly quadruples, but the standard interval stays 64 ms.'
    correct: true
    why: 'Retention doubles for about every 10 °C of cooling, so 20 °C gives four times. The standard is written for the worst case (the weakest cell at the top of the normal range), so a cool chip has spare margin that only a smarter controller could use.'
  - text: 'Retention is unchanged: temperature affects logic, not capacitors.'
    why: 'Leakage grows strongly with temperature: that is why the interval is halved above 85 °C.'
  - text: 'Retention halves and refresh must be twice as often.'
    why: 'The other way round: cooler is better.'
```

Three exercises follow. In the first you build the block that turns an address into a single write line; in the second you fix one with a slip; in the third you do the arithmetic of the DRAM sensing yourself.

```build
id: memory/write-decoder
title: A write decoder
prompt: |
  A memory has four words. The address is the two bits **A1 A0**, and **WE** says whether to write. Build the block that turns them into four write lines: **W0, W1, W2, W3**. Exactly one line, the one whose number is on A1 A0, may be 1, and only while WE is 1; with WE at 0 all four are 0.
spec:
  truthTable:
    inputs: [A1, A0, WE]
    outputs: [W0, W1, W2, W3]
    rows: ["000 0000", "001 1000", "010 0000", "011 0100", "100 0000", "101 0010", "110 0000", "111 0001"]
allowed: [not, and, or, nand, nor]
hints:
  - Each write line is one AND of three things. For W2 (address 10), which three?
  - 'W2 = A1 · ¬A0 · WE. You need the complements of A1 and A0: two inverters, shared by all four lines.'
explain: |
  Two inverters and four three-input ANDs: six gates. It is a 2→4 decoder with an enable, as in Chapter 13, and it is the decoder of Figure 20.2. A flat decoder for 2ⁿ words needs 2ⁿ gates of n + 1 inputs, which is why real memories split the address in two.
solution: 20-memory/exercises/decoder-solution.json
```

```debug
id: memory/two-lines
title: Two word lines at once
prompt: |
  This write decoder has a slip. Write to address 3 and *two* write lines go high at once, so two words get the same data. Find the input combination, and the line that is wrong, and fix the circuit.
spec:
  truthTable:
    inputs: [A1, A0, WE]
    outputs: [W0, W1, W2, W3]
    rows: ["000 0000", "001 1000", "010 0000", "011 0100", "100 0000", "101 0010", "110 0000", "111 0001"]
allowed: [not, and, or, nand, nor]
start: 20-memory/exercises/decoder-start.json
solution: 20-memory/exercises/decoder-solution.json
hints:
  - Try the four addresses with WE = 1 and see which lines light up.
  - W3 is 1 for address 10 as well as 11. What is it missing?
fault: The gate for W3 has only two inputs, A1 and WE, and no A0. It is therefore high whenever A1 and WE are, that is, for address 10 as well as 11, and W2 is high at the same time. On a real memory that writes the same data into two words, or shorts two cells that hold different values onto the same bit line.
```

```measure
id: memory/bitline-swing
title: The signal that a DRAM read gets
question: 'A DRAM cell of 20 fF holds a 1, at 1.2 V. It is connected to a bit line of 160 fF that was precharged to 0.6 V, and they share their charge. By how much does the bit line voltage rise? (Give it in millivolts: type, for instance, 12 mV.)'
unit: V
answer: 66.7 mV
tolerance: 0.03
hints:
  - The charge is conserved, so (20 fF × 1.2 V + 160 fF × 0.6 V) = (20 fF + 160 fF) × V. Solve for V, and subtract the 0.6 V.
  - The result is 0.6 + 0.6 × 20/180 volts.
explain: |
  V = (20 × 1.2 + 160 × 0.6)/180 = 0.6667 V, so the line rises by 66.7 mV, one ninth of the 0.6 V the cell was above the precharge level. A cell that had leaked to 0.9 V would move it by only 33 mV: near the limit of what the sense amplifier can tell from noise.
```

```measure
id: memory/refresh-cost
title: The cost of refresh
question: 'A DDR4 memory chip receives a refresh command every 7.8 µs, and each one keeps it busy for 350 ns. What fraction of the time is it refreshing? (A decimal number: 0.05 would be one time in twenty.)'
answer: 0.0448
tolerance: 0.03
hints:
  - The fraction is the busy time divided by the interval, 350 ns / 7.8 µs.
explain: |
  350 / 7812.5 = 0.0448: 4.5 % of the time. The same calculation for a 16 Gbit chip, which needs 550 ns per command, gives 0.070, that is 7 %.
```

## Build it for real

:::real{parts="62256 (32K × 8 SRAM, 28-pin DIP), 8-way DIP switch, pushbutton, 8 × LEDs, 8 × 1 kΩ resistors, 8 × 330 Ω resistors, 4 × 10 kΩ resistors, 5 V USB supply module, breadboard, jumper wires"}
**Read and write a 62256 SRAM by hand.** This is Chapter 20's cell array in a chip: 32,768 words of 8 bits, with 15 address lines. The pins are: A0 to A14 on pins 10, 9, 8, 7, 6, 5, 4, 3, 25, 24, 21, 23, 2, 26 and 1; data I/O0 to I/O7 on pins 11, 12, 13, 15, 16, 17, 18 and 19; chip enable **CE̅** on pin 20, output enable **OE̅** on pin 22, write enable **WE̅** on pin 27; +5 V on pin 28 and ground on pin 14 (the bars mean active low). Put A0, A1 and A2 on three DIP switches (with 10 kΩ pull-down resistors) and tie all the other address pins to ground: you have eight words, like the explorer. Tie CE̅ to ground. **To write:** set OE̅ high, so that the chip does not drive the data pins; set a word on the data switches, each one connected to its I/O pin through a **1 kΩ** resistor, and pulse WE̅ low with the pushbutton (a 10 kΩ pull-up resistor to +5 V holds WE̅ high until you press it). **To read:** open all the data switches, set WE̅ high and OE̅ low, and the eight LEDs (each through a 330 Ω resistor from its I/O pin to ground) show the word at the address. Never drive an I/O pin from a switch while OE̅ is low: the chip is driving it too, and the two fight (Chapter 10); the 1 kΩ resistors limit the current if you forget. Turn the power off and on again: the contents are random. That is the difference between this chip and the flash memory of a phone.
:::

## What’s next

You have now built all the parts of the last four chapters: registers, counters, state machines and memories. Part V puts them together. Chapter 21 connects an arithmetic unit, a register file like the one of Figure 20.2 and a shared bus, and gives you the control lines to work by hand: *you* are the control unit, and one clock cycle moves one word from a register, through the ALU, and back. Chapter 22 replaces you with a state machine, and Chapter 23 gives it a program to read from a memory, the ROM and RAM that you have just made.
