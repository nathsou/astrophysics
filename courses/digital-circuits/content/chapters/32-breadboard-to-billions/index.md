---
number: 32
title: From breadboard to billions
summary: How the CPU you built becomes a chip with billions of transistors — scaling, lithography, the ASIC flow beside the FPGA flow, what a modern processor adds, open hardware, and where to go next.
duration: About 45 minutes
prerequisites: [cpus-on-a-chip]
---

In Chapter 22 you counted Octet gate by gate. With its 256 bytes of RAM it comes to 24,856 transistors, a little fewer than the Intel 8086 of 1978, the chip that started the x86 family. The processor of the iPhone 8, launched in 2017, had 4.3 billion. Apple’s M2 Ultra, of 2023, has 134 billion. That last chip is not a different kind of thing from Octet. It has registers, adders, a control unit, memory and a clock. It is the same design at a scale where nobody draws the gates. How did the world get from one to the other, and what would Octet have to add to become one of them?

```quiz
q: 'The Intel 4004 of 1971 had 2,300 transistors and the Apple M2 Ultra of 2023 has 134 billion: 58 million times as many. If the count had doubled at a steady rate over those 52 years, how often would it have doubled?'
options:
  - text: About every six months.
    why: 'That would be 104 doublings, a factor of 10³¹. Nothing in the figure below grows that fast.'
  - text: About every two years.
    correct: true
    why: 'A factor of 58 million is 2 to the power 25.8, so 25.8 doublings in 52 years: one every 2.0 years. Doubling every two years for half a century is a factor of 2²⁶, about 67 million.'
  - text: About every five years.
    why: 'Ten doublings in 52 years is a factor of only 1,000 or so. The real factor is about forty thousand times larger.'
```

## Fifty years on a straight line

The figure below has twenty real processors, from the 4004 to a chip the size of a whole wafer. Each point is a launch part, with the numbers its maker gave: the transistors on it, the name of its process, its clock, its die area and its power. Every number has a source, listed when you select the point, and the table of transistor counts that the collection started from is a useful map of the rest.:cite[wiki-transistor-count] Start with the transistors, and switch on the line that doubles every two years from the 4004.

::scaling-explorer{n="32.1" caption="Twenty processors on logarithmic axes. Click a point, or use the arrow keys, to see its numbers and sources. Show the doubling line for transistors, then try the other metrics: the clock and the power per square centimetre both change their behaviour in 2004 (switch on Split at 2004). Switch on Octet and RV32I to see where the course’s own designs fall."}

On a logarithmic axis a constant doubling time is a straight line, and the transistor counts follow one closely: a fit through all twenty chips doubles every 2.0 years, with r² = 0.98. This is :term[Moore’s law]{id=moores-law}, and the history card below tells how it began. Octet’s 24,856 transistors are what that line reached in 1978; its logic without the RAM, 12,568, is 1976. The RV32I core of Chapter 31, counted as gates, has about 84,000 transistors, which is 1982: about the size of a Motorola 68000 (68,000), the processor of the first Macintosh.

:::details[Where every number of Figure 32.1 comes from]
The figure’s numbers are the launch figures of each chip; the sources are, one by one:

- Intel 4004, 1971: :cite[wiki-intel-4004]
- MOS 6502, 1975: :cite[visual6502]
- Intel 8086, 1978: :cite[wiki-intel-8086]
- Motorola 68000, 1979: :cite[wiki-motorola-68000]
- Intel 80286, 1982: :cite[wiki-intel-80286]
- Intel 80386, 1985: :cite[wiki-i386]
- Intel 80486, 1989: :cite[wiki-i486]
- DEC Alpha 21064, 1992: :cite[wiki-alpha-21064]
- Intel Pentium (60 MHz), 1993: :cite[wiki-pentium-original]
- Pentium 4 (Willamette, 1.5 GHz), 2000: :cite[wiki-pentium-4]
- Pentium 4 (Prescott, 3.8 GHz), 2004: :cite[wiki-pentium-4]
- Core 2 Duo E6700 (Conroe), 2006: :cite[wiki-conroe]
- Core i7-920 (Bloomfield), 2008: :cite[wiki-bloomfield]
- Core i7-2600K (Sandy Bridge), 2011: :cite[wiki-sandy-bridge]
- Core i7-4770K (Haswell), 2013: :cite[wiki-haswell]
- Apple A11 Bionic, 2017: :cite[wiki-apple-a11]
- Apple M1, 2020: :cite[apple-m1]:cite[wiki-apple-m1]
- NVIDIA H100 (GH100), 2022: :cite[nvidia-hopper]:cite[wiki-hopper]
- Apple M2 Ultra, 2023: :cite[apple-m2-ultra]
- Cerebras WSE-3, 2024: :cite[cerebras-wse3]

Octet’s and the RV32I core’s numbers are measured with the course’s own tools, as the box *Counting Octet’s transistors* explains.
:::

:::history{year=1965 title="Moore’s law" people="Gordon Moore"}
In April 1965 Gordon Moore, then director of research at Fairchild Semiconductor, published an article in *Electronics* whose subtitle said that “by 1975, economics may dictate squeezing as many as 65,000 components on a single silicon chip”.

He drew a line through a handful of points: the number of components on the cheapest chip had roughly doubled every year since 1959, from about one to about sixty-four, and he extended it ten years.:cite[moore1965] In 1975, at the International Electron Devices Meeting, now at Intel, he looked back on the decade and revised the forecast to a doubling about every two years. He credited three things: bigger chips, finer lines, and what he called circuit and device cleverness.:cite[moore1975]

It was a forecast about economics, not a law of physics, and it came true because a whole industry planned its investments around it. The doubling in the figure above, fitted to twenty chips, is Moore’s second forecast.
:::

:::lab[Find the year the clock stopped]
1. Choose **Clock**, switch on **Split at 2004** and read the two trends. Until 2004 the clock rose by a factor of 1.29 a year, doubling every 2.7 years. After 2004 the fit is a factor of 0.99: flat. Then look at the points themselves: after Prescott (3.8 GHz, 2004) nothing in the figure is faster.
2. Choose **Transistors** with the split off. Does the line bend anywhere after 2004? It does not: the transistors kept doubling, and only the clock stopped.
3. Choose **Power per cm²**, split at 2004. Power per unit of area rose twentyfold from the Pentium (5 W/cm²) to Prescott (103 W/cm²), the highest of any chip in the figure, and then stopped rising. Why did the designers not go on? The next section has the answer.
:::

## The rule that stopped in 2004

Chapter 10 ended with :term[Dennard scaling]{id=dennard-scaling}: shrink a transistor’s dimensions and voltage by *κ*, and it gets *κ* times faster while a square millimetre of chip dissipates the same power. For thirty years a shrink meant faster and cheaper together, and clocks rose with it. The lab shows the end. Around 2004 the voltage stopped falling, because a lower threshold means exponentially more leakage (Chapter 10), and with the voltage stuck a faster clock means a hotter chip. Intel cancelled the successor to Prescott in May 2004 and turned to several cores.:cite[eetimes-tejas] In March 2005 Herb Sutter told programmers that the free lunch of ever faster processors was over.:cite[sutter2005]

:::key
Transistors kept doubling; clocks and power per area did not. Since 2004 the extra transistors have gone into **more of everything**: more cores, more cache, more special units, most of them idle most of the time.
:::

The other axis that changed its meaning is the one that gives a :term[process node]{id=process-node} its name. The 4004’s 10 µm was a length on the die. A “5 nm” chip has no 5 nm feature: since about 1997 the number has been a label chosen by the maker, and the projections for a process called 5 nm give a gate length of 18 nm, a contacted gate pitch of 51 nm and a tightest metal pitch of 30 nm.:cite[wiki-5nm] Chip designers now prefer to speak of density, and the last metric of the figure is exactly that: from 192 transistors per square millimetre on the 4004 to 133 million on the M1, a factor of 690,000.:cite[wong2020]

What kept density growing was a change of shape rather than of size. In 2011 Intel’s 22 nm process stood the channel up on its edge as a fin, so that the gate wraps it on three sides and controls it better (the :term[FinFET]{id=finfet});:cite[intel-22nm] in 2022 Samsung began production of a 3 nm process in which the gate surrounds the channel completely, in stacked ribbons (gate-all-around).:cite[samsung-3nm-gaa]

:::hood[Counting Octet’s transistors]
The number in the hook of this chapter is not an estimate made for the chapter. It is the cost model of gate golf (`src/lib/sim/check/cost.ts`), applied to the real gate-level Octet of Chapters 21 and 22. Each element has a transistor count, from the static CMOS designs of Chapter 9:

```ts
case 'nand':
case 'nor':
  return 2 * n;                         // two transistors per input
case 'xor':
case 'xnor':
  return 8 * (n - 1);                   // transmission-gate form
case 'dff':
  return 20;
case 'ram':
  return 6 * (1 << bits('addrBits', 4)) * bits('dataBits', 8);   // six-transistor cells
```

`costOfFlat` adds them up over the flattened netlist: 3,599 elements, gates and tri-state buffers and one RAM. The RAM is 256 × 8 × 6 = 12,288 transistors, half of the total; the CPU proper is 12,568. The test of this chapter rebuilds the CPU and checks both numbers, so that they cannot drift from the circuit. For the RV32I core the count is applied to the and-inverter graph of Chapter 30: 10,420 AND nodes at 6 transistors each and 1,089 flip-flops at 20 make about 84,000.
:::

## How a chip is made

About a dozen years after the first transistor came the idea that made chips possible, and it was not a smaller transistor but a different way of making them.

:::history{year=1959 title="Kilby and Noyce" people="Jack Kilby, Robert Noyce"}
On 12 September 1958 Jack Kilby of Texas Instruments showed his colleagues an oscillator whose transistor, resistor and capacitor had all been made in a single slice of germanium, the parts joined by fine wires put in by hand.:cite[chm-solid-circuit]

A few months later, in January 1959, Robert Noyce at Fairchild Semiconductor thought of the other half: build the parts in silicon covered by a layer of oxide, using Jean Hoerni’s planar process, and then print the wires on top as a layer of metal, so that nobody has to connect anything by hand. His patent was filed on 30 July 1959 and granted on 25 April 1961.:cite[noyce-patent]:cite[chm-monolithic-ic] Kilby’s idea was to make the parts together; Noyce’s was to make the wires together too, and only that can be repeated a billion times.
:::

An :term[integrated circuit]{id=integrated-circuit} is made by printing. The raw material is a :term[wafer]{id=wafer} of silicon 300 mm across, and hundreds of copies of a chip, each a :term[die]{id=die}, are printed on it at once and cut apart. The process is a loop of a few steps: put down a film, print a pattern on it with light, cut the pattern into the film, and change the silicon that is left uncovered. The step that prints is :term[photolithography]{id=photolithography}: a mask, like a photographic negative, is imaged onto a coat of :term[photoresist]{id=photoresist}, which dissolves in a developer wherever the light has struck it. The figure follows one transistor through the loop.

::litho-steps{n="32.2" caption="Step through the eight stages and read what changes. At step 4 the light is blocked where the mask has chrome; then slide the mask to the left or right and go on to step 7. The source and the drain move with the gate, and the channel between them always has the same length. That is the self-aligned gate: the polysilicon that is left after the etch is also the mask for the dopant."}

You have met every layer before: the doped silicon of Chapter 7, the oxide and gate of Chapter 8, the metal of the schematic. What is new is the *order*. The gate is printed first, and then it makes the mask for the source and the drain; two transistor edges that had to be lined up by eye are lined up by physics. A real chip repeats the loop for dozens of masks, with the wiring on ten or more levels of metal, and each layer must be placed on the last to within a few nanometres.

### How small can a line be?

The finest line the printer can draw is set by the light. It is given by the Rayleigh equation.

:::equation{#rayleigh caption="The smallest half-pitch a lithography machine can print."}
$$\term{cd}{CD} = \term{k1}{k_1}\,\frac{\term{lam}{\lambda}}{\term{na}{NA}}$$

```terms
cd:
  label: 'CD, the critical dimension'
  what: The smallest half-pitch of a pattern of lines that the machine prints, in nanometres.
  why: A chip’s finest features are repeated lines and spaces, and the half-pitch is the width of one line.
  effect: Halving CD doubles the number of lines that fit across a chip, and so quadruples the transistors per unit of area.
k1:
  label: 'k₁, the process factor'
  what: A number, 0.25 at the very least, that gathers everything clever about the process, from the shape of the mask to the way the light is shone on it.
  why: Physics allows no smaller value for a single exposure; the closer a process gets to 0.25, the more it depends on tricks such as masks that are deliberately distorted, and exposing the same layer more than once.
  effect: Lowering k₁ from 0.4 to 0.3 makes the lines a quarter thinner without changing the machine.
lam:
  label: 'λ, the wavelength'
  what: The wavelength of the light, 365 nm for the mercury lamps of the 1990s, 193 nm for the argon fluoride lasers of the last twenty years, 13.5 nm for extreme ultraviolet.
  why: Light cannot draw a pattern much finer than its own wavelength without help, because diffraction blurs the edges.
  effect: A shorter wavelength prints finer lines in proportion.
na:
  label: 'NA, the numerical aperture'
  what: How wide a cone of light the lens gathers, from 0 to 1 in air. Putting water between the lens and the wafer raises it to 1.35.
  why: The lens must catch the light that the mask diffracts; a wider lens catches more of it, and can resolve a finer pattern.
  effect: A larger NA prints finer lines in proportion, but makes the lens larger and the depth of focus shallower.
```
:::

::resolution{n="32.3" caption="Pick a machine and move k₁. With immersion at the limit of k₁ = 0.25 the 193 nm light prints lines 36 nm apart, five times finer than its own wavelength; EUV at k₁ = 0.32 prints the 13 nm that its maker quotes. The numerical apertures of the older machines are typical values."}

:::deeper[Where does 0.25 come from?]
A mask with lines of pitch *p* is a diffraction grating: light passing through it leaves in a straight beam and in beams at angles with sin *θ* = *λ*/*p*, *λ*/*p*, 2*λ*/*p* and so on. To form an image the lens must collect at least the straight beam and the first pair. The lens accepts angles up to arcsin NA, so it needs NA ≥ *λ*/*p*. Shining the light in obliquely makes the straight beam and one first-order beam pass on opposite sides of the lens, and the condition halves to *p* ≥ *λ*/(2 NA). The half-pitch is *p*/2, so CD ≥ *λ*/(4 NA): *k*₁ = 0.25.:cite[song2022] Below that pitch the lens sees only the straight beam, which carries no image at all.
:::

The machines have got better by both routes. Steppers with light of 365 nm made way for 248 nm and then 193 nm; immersing the last lens in water lifted NA from 0.93 to 1.35; masks were bent, and layers printed twice or four times, to bring *k*₁ down. The 193 nm machines reached their end, and the answer was a change of light. The :term[extreme ultraviolet]{id=euv} of 13.5 nm is made by firing a CO₂ laser at droplets of molten tin, 50,000 a second, and turning each into a plasma.:cite[asml-light] Nothing transmits it, not even glass or air, so the optics are all mirrors and the whole path is in a vacuum. ASML’s NXE:3400C, designed for volume production, was offered from the second half of 2019; a machine with a larger aperture, NA 0.55, takes the half-pitch that the equation gives from about 13 nm to about 8 nm.:cite[asml-euv]

The pattern lives on a :term[photomask]{id=photomask}, also called a reticle: a plate of quartz about 15 cm square, coated with chrome, whose image is reduced four times on its way to the wafer, so that the features of the mask are four times larger than those of the chip.:cite[wiki-photomask] The scanner exposes one field at a time, at most 26 mm by 33 mm, and steps across the wafer to expose the next. That field is the largest possible die, 858 mm², and a chip like NVIDIA’s H100 (814 mm²) is very close to it.:cite[wikichip-mask] The chip the size of a wafer in Figure 32.1 is made by connecting the fields across the lines between them. A whole set of masks costs millions of dollars at the leading edge, and is paid for once, before the first chip is made. That single fact shapes everything about how chips are designed.

## Two ways to a chip

The last chapters of Part VI followed a design from a description to the bits of an FPGA. A design bound for silicon takes a very similar road: the same language, the same first stages, and a different ending.

| Stage | FPGA (Chapter 30) | ASIC (standard cells) |
|---|---|---|
| Describe | RTL in DCL (or Verilog, VHDL) | the same RTL |
| Synthesise | to an and-inverter graph, then :term[technology mapping]{id=technology-mapping} to 4-input LUTs | to the same graph, then mapped to a **library** of cells: NAND, NOR, XOR, flip-flops and hundreds more, each with its area and delay |
| Place | LUTs into the fixed tiles of the chip, by :term[simulated annealing]{id=simulated-annealing} | cells into **rows** across a die of chosen size, macros such as RAMs first |
| Clock | dedicated networks and PLLs, already on the chip | a clock tree must be **designed** to reach every flip-flop together |
| Route | choose among the switches of wires that already exist (:term[PathFinder]{id=pathfinder}) | draw the wires on ten or more layers of metal |
| Time | one set of delays; report the fmax | many **corners** (fast and slow silicon, high and low voltage, hot and cold) at once |
| Check | that the design fits | that the layout obeys the design rules (DRC) and is the circuit that was synthesised (LVS) |
| Output | a :term[bitstream]{id=bitstream}: 832,592 bits for the vFPGA-L | GDSII: the shapes of every layer of every mask |
| After | load it in a second; load another tomorrow | :term[tape-out]{id=tape-out}, masks, weeks in a fab, packaging, test |

A :term[standard cell]{id=standard-cell} is the ASIC’s counterpart of a LUT. It is a small layout of one function, a NAND, a flip-flop, all of the same height so that they slot into rows and share power rails along the row (Chapter 9’s transistors, drawn once by hand and reused millions of times).:cite[weste-harris2011] The synthesiser has the same job as in Chapter 30, choosing which cells cover the graph, with an area and a delay in place of a LUT’s depth.

The difference shows in the cost. An FPGA is a chip made once in millions and rewired by whoever buys it, so its price is paid in silicon: a 90 nm FPGA used, on average, 35 times the area of the same logic in standard cells, was 3.4 to 4.6 times slower and used 14 times the dynamic power.:cite[kuon-rose] An :term[ASIC]{id=asic} avoids that price and pays another, the :term[NRE]{id=nre} of the masks and of the design, which is millions before the first chip. Over a few hundred units the FPGA wins; over millions the ASIC does. Most designs start as FPGAs, and a few graduate.

:::history{year=1980 title="The VLSI revolution" people="Carver Mead, Lynn Conway"}
In the 1970s chip design was the work of a few specialists at a few companies, with layout rules that belonged to each factory. Carver Mead of Caltech and Lynn Conway of Xerox PARC wrote them down in a form that anybody could use: simple design rules in a single unit, *λ*, half the smallest feature, so that a design drawn for one process could be shrunk to the next.

Conway taught the course at MIT in 1978. A year later a chip set called MPC79 did the same for twelve universities: 82 projects by 124 designers, sent in over the ARPANET, merged at PARC into shared wafers, and returned as packaged chips within weeks. The service passed to the University of Southern California in 1981 as MOSIS, and it still runs.:cite[conway-mpc79] The textbook, *Introduction to VLSI Systems*, was published in 1980.:cite[mead-conway1980]

The idea that a design could be separated from the factory that makes it, and that many designs could share one wafer, is exactly the idea of the ASIC flow above, and of the open shuttles below.
:::

## What a modern CPU adds

Octet and the RV32I core do one thing at a time, in the order that the program says. A chip in a phone or a laptop does hundreds of things at once and gets the same answer. Five ideas do it; each one is a seed that this course planted.

**Pipelining** (Chapter 15’s critical path, Chapter 17’s registers). Octet takes 5.5 cycles per instruction, because one bus does one transfer a cycle. Cut the work of an instruction into stages (fetch, decode, execute, memory, write back), put registers between them, and every stage can work on a different instruction at once. That is :term[pipelining]{id=pipelining}: the clock is set by the slowest stage instead of the whole instruction, and CPI, the cycles per instruction of Chapter 23’s :term[iron law]{id=iron-law}, gets close to 1. The price is hazards: an instruction that needs a result the previous one has not finished, or a branch that changes which instruction comes next. Pentium 4 Prescott had a pipeline of 31 stages.:cite[wiki-pentium-4]

**Caches** (Chapter 20’s :term[memory hierarchy]{id=memory-hierarchy}). A main memory takes about a hundred nanoseconds to answer, hundreds of cycles of a fast core, and every level between it and the registers is a smaller and faster :term[cache]{id=cache} that keeps what was used lately or nearby.:cite[hennessy-patterson2019] Much of the area of a modern chip is cache, and the hit rate matters more to a program than the clock.

**Branch prediction** (Chapter 19’s state machines). One instruction in about five is a branch, and a deep pipeline has fetched a dozen more before a branch is known. So the chip guesses (:term[branch prediction]{id=branch-prediction}), keeps going, and throws away what it fetched if it guessed wrong. The simplest good guess is a two-bit counter per branch, as small as a state machine can be. James Smith’s study of branch prediction strategies of 1981 compared counters of this kind with simpler guesses.:cite[smith1981] Here is one built from gates.

::circuit{src="32-breadboard-to-billions/circuits/predictor.json" n="32.4" title="A two-bit branch predictor" traces="T,S1,S0,WRONG" caption="TAKEN is the outcome of the branch that is about to be resolved; GUESS lights while the counter says taken. Set TAKEN, check whether WRONG lights, and press CLK to let the counter learn. Start from state 00 and press CLK with TAKEN on: the counter climbs to 11, and a single not-taken branch takes it only to 10, which still guesses taken. It takes two surprises to change its mind."}

Its next-state logic is two multiplexers chosen by the outcome, and the two flip-flops are the state of Chapter 19. The figure below runs it against simpler predictors on six patterns of branches.

::branch-predictor{n="32.5" caption="Choose a pattern, then move the slider to watch the predictors learn. On a loop, always guessing taken is wrong only at the exit, and the counter is as good once it has warmed up, while a one-bit predictor is wrong twice per loop (at the exit, and again at the first branch of the next round). On a branch that is rarely taken, always guessing taken is hopeless and the counter is right almost every time. On the alternating pattern the one-bit predictor is always wrong, and on the coin toss nothing does better than chance. The table turns the misses into cycles per instruction for the pipeline depth you choose."}

:::programmer[Why a sorted array is faster]
The same loop over the same numbers can run several times faster once the array is sorted. Nothing about the arithmetic changed. The loop’s `if (x >= 128)` was a coin toss on random data, wrong half the time, and on sorted data it is a run of “no” followed by a run of “yes”, which the counter predicts almost perfectly. You are now able to explain that in transistors.
:::

**Out-of-order execution** (Chapter 22’s control, Chapter 21’s datapath). Suppose a program adds two numbers that arrive late from memory, and then does other work that does not need the sum. A core that follows the program in order waits. A modern one (:term[out-of-order execution]{id=out-of-order}) keeps several hundred instructions in flight, works out which depend on which, and runs any whose inputs are ready, several a cycle, on several adders, committing the results in program order so that the outside cannot tell. The scheme is Tomasulo’s, first built in the floating-point unit of the IBM System/360 Model 91 in 1967.:cite[tomasulo1967]

**Many cores** (Chapter 10’s end of scaling, and its bus contention). When one core could no longer go faster, the transistors went into more of them. Each has its own caches, so the cores must agree on what memory contains, and they share a bus only by taking turns, the problem of Chapter 10 grown a thousandfold. A graphics or AI accelerator goes further: thousands of very simple cores that all do the same thing to different data.

None of these changes what a computer *is*. Everything above is built from the parts you have used: gates, registers, multiplexers, memories, state machines. The difference is scale and organisation.

## Open hardware

For most of the history of chips, everything on the last page of this chapter’s flow was closed: the instruction set was owned, the process rules were secret, and the tools were priced for companies. That is changing.

**An open instruction set.** :term[RISC-V]{id=risc-v} began at Berkeley in 2010, when Krste Asanović and his students wanted an instruction set for research that they could use, and share, without a licence.:cite[asanovic2014] It is now maintained by RISC-V International:cite[riscv-about], and its base integer set, RV32I, is the core of Chapter 31.:cite[riscv-spec] Anyone may build a RISC-V chip, and several companies do.

**Open process kits.** A chip can be made only by a factory, and a factory’s rules are kept in a *process design kit* (:term[PDK]{id=pdk}): design rules, transistor models and the standard cell library. In 2020 Google and SkyWater released the kit of SkyWater’s 130 nm process, SKY130, under an open licence, with free manufacturing for open designs.:cite[skywater-pdk]:cite[antmicro-sky130] GlobalFoundries opened a 180 nm process in 2022 and the German institute IHP a 130 nm process with SiGe transistors.:cite[gf180mcu-pdk]:cite[ihp-open-pdk]

**Open tools.** The synthesis tool of your own FPGA flow, Yosys,:cite[wolf2013] is also the front end of OpenLane, an automatic flow from RTL to the GDSII of the table above, built from Yosys, OpenROAD, Magic and Netgen, which has taped out real chips on SKY130.:cite[shalan2020]:cite[openlane]

**Shared wafers.** The economics of Mead and Conway’s MPC79, forty years on, is a :term[shuttle]{id=shuttle}, and the friendliest of them is Tiny Tapeout: each design takes a small tile, hundreds of tiles share one chip, and the cost of the masks is divided by all of them. A recent shuttle carried 316 designs.:cite[tinytapeout]:cite[tinytapeout-ttsky25b] Matt Venn, who started Tiny Tapeout, also teaches a course that walks a small design from an HDL to a chip on a shared wafer.:cite[zero-to-asic]

The path from DCL is short to describe. Rewrite the module in Verilog, or use a tool such as Amaranth or Chisel that produces it,:cite[amaranth]:cite[chisel] run the open flow with the SKY130 kit, and submit the result to a shuttle. A real chip arrives some months later, and in the middle of it is a design that started as text you wrote yourself.

## Build it for real

:::real{parts="a windowed EPROM (a 2764, 27C64 or similar; an old one from a junk box is ideal), a 10× loupe or a USB microscope, a bright lamp"}
**Look at a die.** Before the flash memory of Chapter 20, programs lived in chips erased by ultraviolet light through a quartz window in the package, the EPROMs of Chapter 25, and the window lets you look at the silicon without opening anything.

1. Hold the chip so that the light falls through the window at a slant, and look with the loupe. The bright square in the middle is the **die**.
2. Find the **bond wires**, each running from a pad at the edge of the die to a pin of the package. Count them and compare with the number of pins.
3. Look at the interior of the die. A memory is the most regular thing on a chip: you should see a large grid, and around it strips of decoders. Estimate how many rows and columns the grid has.
4. Compare with Figure 32.2: what you see are the last layers, the metal and the wires. Everything else is beneath them.

Do not try to remove the ceramic lid or to open any other chip: the lid is glued, and decapsulation uses acids.
:::

## Where to go next

You now have the whole picture at one small scale, and the next step is to go deeper down whichever branch pulled you most.

**Computer architecture.** Sarah Harris and David Harris’s *Digital Design and Computer Architecture, RISC-V edition* covers what this course did, in a different order, and goes on to single-cycle, multi-cycle and pipelined RISC-V processors, in HDL.:cite[harris-harris2021] Patterson and Hennessy’s *Computer Organization and Design, RISC-V edition* is the standard text on the hardware and software together,:cite[patterson-hennessy2020] and Hennessy and Patterson’s *Computer Architecture: A Quantitative Approach* is the reference for caches, out-of-order execution and multiprocessors.:cite[hennessy-patterson2019] Within this collection, [SSA to Silicon](../../../compiler-backends/#/ch/scheduling) picks up where Chapter 23 left off: instruction scheduling and a pipeline simulator, for the compiler that feeds a chip like this.

**Chips and circuits.** Weste and Harris’s *CMOS VLSI Design* is the book on how to make the gates of Chapter 9 fast, small and low in power.:cite[weste-harris2011] Mead and Conway’s is the classic.:cite[mead-conway1980] For the analogue side of everything, Horowitz and Hill’s *The Art of Electronics*.:cite[horowitz-hill2015]

**From the beginning, again.** Nisan and Schocken’s *The Elements of Computing Systems* (Nand2Tetris) builds a computer, an assembler, a compiler and an operating system, from one NAND gate up.:cite[nisan-schocken2021] Charles Petzold’s *Code* tells the story as a narrative,:cite[petzold2022] and Ben Eater’s videos build an 8-bit computer on breadboards, chip by chip.:cite[eater8bit]

**Boards and tools.** A cheap iCE40 board such as the iCEBreaker, with Yosys, nextpnr and Project IceStorm, runs everything in Chapter 31 for real.:cite[icebreaker]:cite[shah2019]:cite[icestorm-eetimes] Verilator turns Verilog into fast simulations,:cite[verilator] and a project that outgrows DCL will want one of the languages of Chapter 29 and the open flows above.

## The whole stack

The chapters of this course are one stack, and this is the last figure. It goes from a battery to a chip, one layer at a time; each layer is built from the one under it, and offers the one above it a simpler world. Select a layer for what it offers and the chapters that made it, and read the bars for how many transistors a typical instance has.

::whole-stack{n="32.6" caption="Eleven layers, bottom to top. Hover or focus a layer to open it and follow the links to its chapters. Between a NAND gate and Octet lie almost four orders of magnitude of transistors, between Octet and an M2 Ultra almost seven, and yet in every layer the same trick is played: build something that computes out of things that are simpler and less reliable, and hide how."}

Go back to the first figure of Chapter 0, the zoom from a keypress to the silicon. Every level of it is now something you have built, driven or measured. A key closes a switch. A switch feeds a gate, and gates make adders and registers. Registers and adders make a datapath, a control unit makes it run bytes, and a hardware language describes it, so that a toolchain can turn it into wires and bits for a chip that somebody, somewhere, has printed with light. The distance between the breadboard and the billions is not a new idea. Between the 4004 and the biggest chips of today lie twenty-six doublings, and each was the same idea again, on a smaller scale.

## Exercises

```quiz
q: 'A processor is sold as “3 nm”. What is 3 nm on it?'
options:
  - text: The width of the gate of its transistors.
    why: 'It was the gate length, once. It has not been for a long time: in a chip named for 5 nm, the projected gate length is 18 nm.'
  - text: The width of the smallest wire.
    why: 'The tightest metal pitch of a “5 nm” process is projected to be 30 nm, the half-pitch 15 nm. No wire is anywhere near 3 nm.'
  - text: Nothing on the chip; it is the name of a generation of process.
    correct: true
    why: 'Since about 1997 the number has been a marketing label, roughly a step in a series. Comparing chips by their transistors per square millimetre says more.'
```

```quiz
q: 'A program has one branch instruction in five, the predictor is wrong 5 % of the time, and a wrong guess costs 20 cycles. What is the CPI, if everything else takes one cycle?'
options:
  - text: 1.05
    why: 'That would be the misprediction rate added to 1, forgetting how often there is a branch and how much each miss costs.'
  - text: 1.2
    correct: true
    why: '1 + 0.2 × 0.05 × 20 = 1.2: one instruction in five is a branch, 5 % of those are wrong, each wrong guess costs 20 cycles. Twenty per cent of the machine’s time goes to guesses that were wrong.'
  - text: 2.0
    why: 'To get 2 the predictor would have to be wrong a quarter of the time, which is what the one-bit predictor manages on the loop of 8 in Figure 32.5.'
```

```quiz
q: 'A company will build 500 units of a device that needs a custom logic function, and expects to change it twice in the first year. Which way to a chip?'
options:
  - text: An ASIC, because it is faster and uses less power.
    why: 'It is faster and uses less power per chip, but the masks cost millions, spread over 500 units. Changes need new masks.'
  - text: An FPGA, because at this volume the price of the masks would exceed the cost of all the chips, and it can be reprogrammed.
    correct: true
    why: 'The FPGA costs several times more in silicon per function, but there is no NRE and a change is a new bitstream. The break-even depends on the design, but it is usually far more than 500 units, unless power or speed decide.'
  - text: A board of 74HC chips, as in the 1970s.
    why: 'A custom function of any size needs hundreds of chips, on a board that has to be designed, built and debugged 500 times. It is the FPGA of Chapter 28 that replaced such boards.'
```

:::challenge[Doubling time from two points]
The Intel 4004 (1971) had 2,300 transistors and NVIDIA’s H100 (2022) has 80 billion. Find the doubling time by hand. Then use it to predict the transistors on the largest chip of 2030, and compare with Cerebras’s 4 trillion of 2024.

*Answer.* The ratio is 80 × 10⁹ ÷ 2,300 = 3.5 × 10⁷, and log₂ of it is 25.05, so 25 doublings in 51 years: 2.04 years each. To 2030 is 59 years, or 59 ÷ 2.04 = 29 doublings, and 2,300 × 2²⁹ = 1.2 × 10¹². About a trillion, a third of what the wafer-scale chip of 2024 already has. The line runs through the biggest ordinary chips; a wafer-scale chip spends a whole wafer on one design, and is about three years’ doublings ahead of the line.
:::

## What’s next

There is no next chapter, only the ones you write. Appendix H collects everything the course has used: the glossary, with each term’s chapter; the timeline of every history card, from Volta’s pile to open silicon; and every source, grouped by the part of the course that cites it. The simulator, the toolchain and the reference material are in the other appendices. The rest is the chips in front of you. The cheapest way to understand any of them is the one this course began with: take it apart, and find the switches.
