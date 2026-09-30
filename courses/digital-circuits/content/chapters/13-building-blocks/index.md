---
number: 13
title: Building blocks
summary: 'Multiplexers, decoders, encoders, comparators and parity checkers: the standard circuits that every design is made of, why a multiplexer is a lookup table, and how four bits become a digit on a seven-segment display.'
duration: About 1½ hours
prerequisites: [boolean-algebra, simplifying-logic]
---

Look at the display of a microwave oven, a lift or a cheap calculator. Each digit is seven bars, any of which can be lit, and behind the glass there is a chip that receives a number as four wires (1 0 1 1, say) and lights exactly the bars that draw an 11, or rather a B. Nobody wrote a font. Somewhere between the four wires and the seven bars is a circuit that has *memorised what every digit looks like*, and by the end of this chapter you will have built it.

The circuit is made of a few standard parts. Chapter 11 showed that gates can be combined to compute any function, and Chapter 12 showed how to make the result small. But designers do not draw every circuit from gates. A small number of functions turn up so often that they have names, symbols and their own chips, and a good designer thinks in them the way a programmer thinks in `map` and `sort` rather than in loops and comparisons: a *multiplexer* that chooses, a *decoder* that points, an *encoder* that names, a *comparator* that judges and a *parity* checker that catches errors.

Every one of them is a sum of products from Chapter 11, and the first, the multiplexer, is more than it looks.

## Choosing one of several

In software you write `y = s ? b : a`, and in an array you write `table[i]`. Both *select*: of several values, the one that a control value asks for. The hardware version is the :term[multiplexer]{id=multiplexer} (mux), also called a data selector. A **2:1 multiplexer** has two data inputs D0 and D1, a select input S, and one output Y. When S is 0, Y follows D0; when S is 1, Y follows D1.

Chapter 11 ended by building this in the synthesiser: Y = ¬S·D0 + S·D1. Two AND gates, one of which is enabled by S and the other by ¬S, and an OR to merge them. One of the two ANDs is always shut, so only the chosen input gets through.

::circuit{src="13-building-blocks/circuits/mux2.json" title="A 2:1 multiplexer from gates" n="13.1" mode="logic" speed=1e-6 caption="Click D0, D1 and S. With S at 0 the upper AND is shut and Y copies D0 (through the lower one); with S at 1 the lower one is shut and Y copies D1. Four gates in all: one inverter, two ANDs and an OR."}

:::programmer[`?:` is a multiplexer]
A ternary `s ? b : a` compiles to a multiplexer, and so does every `if` that assigns a variable in both branches. The circuit has no jump. It computes *both* `a` and `b`, all the time, and the multiplexer selects one. That is why hardware conditionals cost area: every branch that can be selected is a piece of circuit that exists whether or not it is chosen. An array lookup `table[i]` is a wider multiplexer, with the elements as data inputs and `i` as the select.
:::

### Wider selectors are trees

To choose from four inputs you need two select bits, S1 and S0, that together count 0 to 3. Do not design a new circuit: use the one you have. Two 2:1 multiplexers, both controlled by S0, choose within the pairs (D0, D1) and (D2, D3); a third, controlled by S1, chooses between the two winners. Seven 2:1 multiplexers make an 8:1, and in general a 2<sup>*k*</sup>:1 multiplexer is a tree of 2<sup>*k*</sup> − 1 two-way multiplexers in *k* levels, with the select bits as the level controls.

::mux-tree{n="13.2" caption="Click the data inputs to flip them and the select buttons to move the path. The select bits, read as a binary number, are the number of the data input that reaches the output: 101 is D5. The first level is controlled by S0, the next by S1 and the last by S2."}

A 2:1 multiplexer takes four gates in the version above, so an 8:1 built naively takes 28. Real chips do better, since a CMOS multiplexer can be made of the transmission gates of Chapter 9 (about six transistors for each 2:1 stage), and the 74HC151 packs an 8:1 into one 16-pin package.:cite[nexperia-74hc151]

### A multiplexer is a lookup table

Now do something odd with the 4:1 multiplexer: take its data inputs D0 to D3 off the signals and wire each of them to a constant, a 0 or a 1. The select inputs S1 and S0 are now the only inputs left, and the output is a function of them. Which function depends on the constants: D0 is the value at S1 S0 = 00, D1 at 01, and so on. *The constants are the truth table.*

```quiz
q: 'A 4:1 multiplexer has six inputs: four data inputs and two selects. You may wire each data input to 0 or to 1, and use the selects as the inputs of a function. How many different functions of S1 and S0 can you make?'
options:
  - text: Four, one for each data input that could be selected.
    why: 'That counts which input is chosen, not which constants are wired. Each of the four data inputs can be a 0 or a 1, independently of the others.'
  - text: Sixteen.
    correct: true
    why: 'Four data inputs, two choices for each: 2 × 2 × 2 × 2 = 16. And there are exactly sixteen functions of two variables (Chapter 11: 2 to the power 2² ), so every one of them is on the list, AND, OR, XOR and the rest.'
  - text: Only the ones with a name, such as AND, OR and XOR.
    why: 'Nothing restricts the constants. Each of the sixteen patterns of four bits is a function of two variables, named or not.'
```

The multiplexer is therefore a **:term[lookup table]{id=lut}** (LUT): a circuit that stores a truth table and reads it out row by row. With *k* select inputs it has 2<sup>*k*</sup> stored bits, and it can be *any* of the 2<sup>2<sup>*k*</sup></sup> functions of *k* inputs: 16 for two, 256 for three, 65,536 for four. There is no gate structure to design. To change the function you change the stored bits.

::lut-explorer{n="13.3" caption="Pick a function, or click the stored bits yourself: each bit is one row of the truth table (the row's inputs are written beside it). Then click the inputs A, B, C and follow the highlighted path. The word in hexadecimal is all there is to the function: 0x96 is XOR, 0xE8 is the majority."}

:::lab[Set the bits]
1. Choose 3 inputs and **XOR**. The stored bits are 0110 1001 read from the top, which is `0x96`. Set A, B and C to 000, then 001, then 011: the output is 1 whenever an odd number of inputs are 1. Now click bit 7 alone. You have changed the function on exactly one row, and on that row only.
2. Pick **Majority**. Its bits are `0xE8` = 1110 1000: the last four rows have two or three 1s among the inputs, except the row 100. Check row 011 and row 101.
3. Now make **your own**: clear all bits with *All zero*, and then set only bit 6. The formula line reads A·B·¬C. A lookup table that holds a single 1 is a decoder output: a circuit that recognises one pattern.
4. Change to 4 inputs and choose **Prime**. There is no formula (the minimiser gives a long sum), but a lookup table does not need one, since it stores the answer. That is what a lookup table is for.
:::

The multiplexer view also explains something that Chapter 11 left as a trick. Any function can be split on one variable: *f* = ¬*x* · *f*(x = 0) + *x* · *f*(x = 1), the two halves being simpler functions of the remaining variables. That is a 2:1 multiplexer whose select is *x* and whose data inputs are the halves, and applying it again and again is the tree of the figure. Claude Shannon's expansion, which he used in the 1937 thesis, is a multiplexer.

:::key[A mux is a lookup table]
A 2<sup>*k*</sup>:1 multiplexer with constants on its data inputs is a *k*-input function with 2<sup>*k*</sup> configuration bits. Part VI is built on this. An FPGA is mostly lookup tables (usually with four to six inputs) whose bits are loaded when it powers up, and Chapter 28 opens one. A PAL or a ROM does the same job with a different structure.
:::

:::hood[How the engine evaluates a multiplexer, and unknown selects]
The digital engine has a `mux` block with a parameter for the number of select bits (`src/lib/sim/digital/models/blocks.ts`). Its model does not just index an array. It also has to say what the output is when the select input is *unknown* (X, a wire nobody has driven yet), and it does so without being needlessly pessimistic:

```ts
evaluate(sim: DigitalSim): void {
  readBus(sim.nets, this.s, 0, this.s.length);
  const sel = bus.value;
  const unk = bus.unknown;
  let y = -1;
  for (let i = 0; i < this.d.length; i++) {
    if ((i & ~unk) !== sel) continue;
    const v = input(sim.nets[this.d[i]!]!);
    y = y < 0 ? v : merge(y, v);
  }
  sim.drive(this.main[0]!, y, this.delay);
}
```

`bus.value` holds the select bits that are known and `bus.unknown` a mask of the ones that are not. The loop visits every data input that *could* be selected: input *i* qualifies when its number agrees with the known bits, whatever the unknown ones are. `merge` combines two values into one when they agree and into X when they do not. So if the unknown select bit chooses between two inputs that are both 1, the output is a definite 1: a real multiplexer does not care which of two identical values it passes. A gate-level model built from ANDs and ORs would say X here, because it cannot see that the two branches are equal. The chapter's tests check both cases.

Each output change is scheduled `this.delay` nanoseconds after its cause (1 ns unless the part says otherwise), like every gate: the block is a *behavioural* model of a multiplexer, with the delay of one stage.
:::

## Pointing: decoders

The multiplexer takes many inputs and passes one on. A **:term[decoder]{id=decoder}** does the opposite job of pointing at one of many. It has *n* address inputs and 2<sup>*n*</sup> outputs, and exactly one output, the one whose number is on the inputs, is 1 while all the others are 0. A pattern of outputs with a single 1 is called :term[one-hot]{id=one-hot}.

The circuit is the recipe of Chapter 11: every output is the AND of all the inputs and their complements, one *minterm* each, so a 2-to-4 decoder is two inverters and four AND gates. The extra input EN, an *enable*, is ANDed into every output, so that with EN = 0 nothing at all is selected. It turns out to be as useful as the address bits.

::circuit{src="13-building-blocks/circuits/decoder.json" title="A 2-to-4 decoder" n="13.4" mode="logic" speed=1e-6 caption="Click A1 and A0 to count from 0 to 3 in binary: the output with that number lights, and only that one. Then turn EN off and every output goes dark. Each output is a three-input AND of an address pattern and the enable."}

A **demultiplexer** sends one data signal to one of several outputs. It is a decoder in disguise: use the data as the enable, and the addressed output is 1 exactly when the data is 1, while all others stay 0. (The digital engine has both blocks, and the 74HC138 is sold as a decoder *and* demultiplexer for this reason.)

### Address decoding

The decoder's best-known job is **address decoding**. A computer with 16 address wires can address 65,536 bytes of memory, but memory chips are small: say eight chips of 8 KiB (8,192 bytes) each. Every chip has 13 address pins, A12 to A0, and all eight chips share them. What tells them apart is the top three address bits A15, A14, A13, which go into a 3-to-8 decoder whose eight outputs are the *chip selects*. Address 0x0000 to 0x1FFF selects the first chip, 0x2000 to 0x3FFF the second, and so on: each chip appears at its own stretch of the address space, and the decoder is what draws the boundaries. The 74HC138 has three enable inputs, so the CPU's other signals can gate the whole decoder.:cite[nexperia-74hc138] Chapter 20 does exactly this with a memory array.

### A decoder and an OR gate make any function

Chapter 11 said that any function is the OR of the minterms of its 1 rows. A decoder produces every minterm. Wire the decoder outputs whose numbers are 1 rows into an OR gate, and you have *any function you like of n inputs*, with no simplification at all. Here is the full adder of Chapter 6 built this way, with the outputs Σm(1, 2, 4, 7) for the sum and Σm(3, 5, 6, 7) for the carry.

::circuit{src="13-building-blocks/circuits/decoder-or.json" title="Any function: a decoder and OR gates" n="13.5" mode="logic" speed=1e-6 caption="The decoder is the 3-to-8 one of the exercises, drawn as a box. Click A, B and C. The decoder lights the output with the number ABC read as binary; the sum is the OR of the outputs 1, 2, 4 and 7, and the carry the OR of 3, 5, 6 and 7. Together they count the 1s among the inputs."}

It is a lookup table again, from the other side: a decoder plus OR gates is the shape of a **ROM**, where the decoder addresses a row and the OR gates (a diode, or a transistor, wherever a stored 1 is) read the row’s bits out. Chapter 20 builds memories this way, and in Chapter 25 the fuses of a programmable ROM are the choice of which decoder outputs feed which OR gate.

:::programmer[One-hot is `1 << n`]
A decoder computes `1 << n` for a wire of *n* bits, with each output bit a separate wire: `y = 1 << a`. The reverse, a priority encoder below, is a "find first set" instruction (`clz`, `ctz`, `bsr`) that your processor also has, and both are just circuits. When a software engineer says a value is "one-hot", the hardware sense is the same.
:::

## Naming: encoders

An **:term[encoder]{id=encoder}** is the inverse of a decoder: 2<sup>*n*</sup> inputs, of which one is expected to be 1, and *n* outputs that say which. A keyboard is the obvious application. Eight keys, each a switch that makes its own wire 1, go into an encoder, and three wires come out carrying the number of the key that is down. The circuit is nothing but OR gates: output bit A0 is 1 if the key is 1, 3, 5 or 7 (the numbers with the low bit set), so it is the OR of those four keys, and A1 and A2 are ORs in the same way.

That works only if at most one key is down at a time. People do not type like that.

```quiz
q: 'A plain 8-key encoder ORs the key numbers together, bit by bit. You press keys 3 and 4 at exactly the same moment. What does it report?'
options:
  - text: Key 3, since it has the lower number.
    why: 'An encoder has no notion of "first" or "lower". Each output bit is an OR over the inputs, and it does not know how many inputs are 1.'
  - text: Key 4, since it has the higher number.
    why: 'That describes a *priority* encoder, which has extra logic for it. The plain encoder just ORs.'
  - text: Key 7, which nobody pressed.
    correct: true
    why: 'Key 3 is 011 and key 4 is 100. ORed bit by bit they give 111 = 7. Every wrong answer that an encoder can give is an OR of the right ones.'
```

The cure is a :term[priority encoder]{id=priority-encoder}: when several inputs are 1 it reports the **highest**-numbered one and ignores the rest. Both kinds also have a third output, *valid* (V), which is 1 if any input is 1. Without it, code 0 could mean "key 0" or "no key at all", and the two cannot be told apart. Try both on the keys below.

::key-encoder{n="13.6" caption="Press one key, then two at once (click them; a key stays down until you click it again). The plain encoder gives a number that may belong to no key at all; the priority encoder always reports the highest key. Try keys 3 and 4, then 0 and 7."}

A priority encoder is also the natural circuit for **interrupts**. A processor has several devices that can ask for its attention (timer, keyboard, disk, network), each on its own request line, and when several ask at once someone must decide whom to serve first. The request lines go into a priority encoder, and its output is the *number* of the most urgent device: the interrupt controller of the original PC, an Intel 8259, works like this, and the 74HC148 is the same idea in one 16-pin package.:cite[ti-sn74hc148]

:::programmer[A priority encoder is an `if` chain]
```c
if      (req[7]) code = 7;
else if (req[6]) code = 6;
else if (req[5]) code = 5;
/* … */
else             code = 0;
```
The order of the branches is the priority. Compare a `switch` over a *one-hot* value or a `match` with disjoint patterns: no order is needed, all branches are tested at once, and the hardware is a plain decoder or a plain multiplexer. An `if`–`else` chain costs a chain of logic in which every branch waits for all the branches before it, so a long chain is slower than a `match`, and hardware descriptions (Chapter 29) let you choose which one you mean.
:::

## Comparing numbers

A **:term[comparator]{id=comparator}** takes two numbers and says how they compare. The easy question is *equality*. Two numbers are equal when every pair of bits is equal, and each pair is the XNOR of Chapter 11, "1 when the inputs are the same". Four XNOR gates and one AND, which is 1 only if every XNOR is 1: A = B.

The harder one is *magnitude*, which of the two is bigger. Compare as you would two numbers on paper: start at the **most significant** bit. If A3 = 1 and B3 = 0 then A is greater, whatever the lower bits say. If they are equal, the decision passes to the next bit down. So

**A > B** = A3·¬B3 + (A3 = B3)·A2·¬B2 + (A3 = B3)(A2 = B2)·A1·¬B1 + (A3 = B3)(A2 = B2)(A1 = B1)·A0·¬B0

with the equality of bit *i* the XNOR you already built. Each term says "all the bits above this one are equal, and here A has a 1 where B has a 0". The last output is free: A < B is exactly when neither A > B nor A = B, a single NOR gate.

::circuit{src="13-building-blocks/circuits/comparator.json" title="A 4-bit comparator from gates" n="13.7" mode="logic" speed=1e-6 caption="Set A and B as 4-bit numbers (A3 and B3 are the top bits). Try 0110 against 0101, where the top two bits agree and bit 1 decides; then 1000 against 0111, where the top bit alone decides, whatever the rest say. EQ, LT and GT are never on together."}

Fifteen gates for four bits (four XNOR, one AND for EQ, four inverters, four ANDs of growing width, one OR and one NOR). The AND terms get wider as the bit gets lower, and the delay does not grow with the number of bits, because the whole thing is two-level logic after the XNORs. Chapter 14 meets the same idea again: the carry of an adder is also "all the bits above are decided", and doing it in two levels is called carry lookahead. The 74HC85 is a 4-bit magnitude comparator with extra inputs for cascading several chips into a wider one.:cite[nexperia-74hc85]

:::lab[Read the comparator]
1. Set A = B = 0000 and change one bit at a time in *both* numbers, keeping them equal. EQ stays on. Then change one bit of A only: EQ goes off, and one of LT and GT comes on.
2. Set A = 0111 and B = 1000. GT is off, LT is on, although *every* lower bit of A is bigger than the lower bits of B. The top bit decides, and the lower comparisons are ignored. In the drawing, find the AND that turned GT off (all its inputs need equal top bits).
3. Where in the circuit would a fifth bit go? What gets wider? (One more XNOR, one more inverter, one more AND term; the AND for EQ and every existing term gets one more input, and the OR that collects GT gets one more input.)
:::

## Parity: catching a flipped bit

The XOR gate of Chapter 11 has one more property: A ⊕ B ⊕ C ⊕ … is 1 exactly when an odd number of the inputs are 1. Chain XORs, or better, join them in a tree so that the depth grows as log₂ *n*, and you have a **:term[parity]{id=parity}** generator. Add its output to the data as one extra bit, and the total number of 1s in the word is always even (*even parity*). Now suppose that one bit is flipped on its way through a wire or a memory cell. The number of 1s becomes odd, and a second XOR tree over all the bits, data *and* parity, says so: its output is 1 for an error.

::circuit{src="13-building-blocks/circuits/parity.json" title="Parity across a noisy wire" n="13.8" mode="logic" speed=1e-6 caption="Set four data bits. P is the parity bit the sender adds. E1 and E2 flip a bit of the data on its way to the receiver, like noise on the wire. Flip E1: ERR lights, because the receiver sees an odd number of 1s. Flip E2 as well: ERR goes out, for the two errors cancel. Parity catches one error, and misses two."}

Parity detects *every* single-bit error and every error of an odd number of bits, and it is blind to an even number. It costs one bit per word, and it cannot say *where* the error is. The 74HC280 is a 9-bit generator and checker for a byte plus parity.:cite[nexperia-74hc280]

Repair needs more bits. In 1950 Richard Hamming, at Bell Laboratories, showed how: use several parity bits, each covering a different, overlapping subset of the data bits, chosen so that the *pattern* of failing checks spells out the position of the error in binary.:cite[hamming1950] A **Hamming code** for four data bits uses three check bits (seven bits in all). The three checks give a 3-bit number: 0 means no error, and 5 means "bit number 5 flipped". That number goes into a decoder that pulls up one line, and an XOR on each bit (an XOR with 1 inverts, from Chapter 11) puts the bit right. The memory of a server carries such a code on every word, typically 8 check bits for 64 data bits, and repairs one flipped bit per word without anyone noticing. It is a compact use of the parts of this chapter: XOR trees, a decoder and inverters.

## The seven-segment decoder

Back to the display. A seven-segment digit has seven bars labelled a to g, and each one is lit or dark. For each of the sixteen values of the four input bits, the decoder must say which of the bars are lit: seven functions of four variables. The hexadecimal digits A to F are drawn as A, b, C, d, E and F (lower case b and d, so that they are not mistaken for 8 and 0), and the 6, 7 and 9 have their tails. Some displays and decoders draw them without; the table below is the one used in this course.

:::history{year=1955 title="The Nixie tube" people="Haydu Brothers, Burroughs Corporation"}
The Nixie tube was a glass bulb, filled with neon, that held ten wire cathodes bent into the shapes of the digits 0 to 9, stacked one behind the other.:cite[boos2018] Connect one cathode to ground, with about 170 V across the tube, and the gas glows orange around that digit alone.

Burroughs Corporation introduced the Nixie in 1955 after buying the Haydu Brothers, a small maker of vacuum tubes in Plainfield, New Jersey, whose design it developed.:cite[boos2018] The name is usually explained as short for "NIX I", *Numeric Indicator eXperimental* number 1.:cite[wiki-nixie] In the late 1950s and the 1960s Nixies were everywhere: in laboratory instruments, calculators and stock tickers.:cite[boos2018]

To light one digit you must choose one of ten cathodes: a *decoder* with ten one-hot outputs. The seven-segment display that replaced it works in the opposite way. Its seven bars are *shared* by every digit, so each digit lights several of them at once, and the logic that maps a number to a shape has to be worked out, not just pointed. That is the circuit below.
:::

The idea of drawing digits from bars is older than electronics. A patent filed by Frank W. Wood in 1908 already built numerals from lamps behind slotted shapes, with the aim of using as few lamps for each character as possible.:cite[wood1908] What is new is that, once each bar is one output of a logic circuit, a display is a truth table with seven output columns.

**Every segment is a Boolean function of four variables**, and Chapter 12’s tools apply. Take segment e, the bottom left bar. Which digits light it? In hexadecimal, 0, 2, 6, 8, A, b, C, E and F. Write it as a 16-row table, find the minimal sum of products, and you have its equation.

```quiz
q: 'A decimal clock only ever shows the digits 0 to 9, so the six input codes 1010 to 1111 never occur, and the decoder is free to do anything with them: they are don’t-cares (Chapter 12 used that freedom to shrink segment a). Compared with a decoder that must also draw the letters A to F, how much smaller are the minimal equations of the seven segments, all together?'
options:
  - text: 'A few per cent smaller: six of sixteen inputs are freed, but most of the logic is still needed.'
    why: 'Don’t-cares are worth more than their share of the rows, because a group on a K-map can grow into any of them. Each free cell can double the size of a group, and a group twice as big has one literal fewer.'
  - text: About half the size.
    correct: true
    why: 'Adding up the literals of the minimal equations of all seven segments: 81 with the letters, 42 without. The unused codes 1010 to 1111 sit next to almost every other code, so the groups can grow across them.'
  - text: 'The same size: the outputs for the unused codes must still be something.'
    why: 'It is that freedom that matters. Choosing them to suit the equations is exactly what a don’t-care is for.'
```

Now for the flagship. Use the keypad, the four bit switches or the counter to feed the decoder. The display is driven by the minimised equations, evaluated as the gates would, so it shows what the logic says. Then switch to **Equations**. Every segment has its own formula, the digits that light it and the gate circuit of that formula on the digital engine. The two modes for the six unused codes show how much freedom is worth.

::seven-seg-decoder{n="13.9" caption="Set a digit with the bit switches or the keypad, or press Count. Switch to Equations and click a segment or a row: the chips show which digits light it, and the gate circuit below runs on the digital engine, with toggles you can click. Then change Hex to Decimal: the six dashed digits become don’t-cares, and the formulas and circuits shrink."}

:::lab[Read the equations]
1. In **Hex** mode press 8. All seven segments light. Now press 0: every segment but g is on. Click segment g in *Equations* view: it is lit for 2, 3, 4, 5, 6, 8, 9, A, b, d, E, F, and dark for 0, 1, 7 and C.
2. Choose segment **c**: in hex mode its formula has five terms and ten literals, in decimal mode only three, `¬D1 + D0 + D2`. Read it as words: the bottom right bar is lit unless D1 is 1 while D0 and D2 are both 0, and the only *decimal* digit like that is 2. (The bar is missing from a 2, as you can see on the display.)
3. Choose segment **e**. In hex mode it needs four terms and eight literals, `¬D2·¬D0 + D1·¬D0 + D3·D1 + D3·D2`. Switch to decimal: the last two terms disappear, because they only matter for A, b, E and F, and the formula is `¬D2·¬D0 + D1·¬D0`. Look at the chips to see which digits light the bar.
4. In decimal mode press A, b, C, d, E and F. The decoder was free to do anything with these codes, and what it does is a curiosity, not a glyph: the equations were never asked to draw a letter.
:::

Look at the last line of the widget. Minimising each segment separately is not the same as minimising the circuit: the seven equations have 28 different product terms among them in hexadecimal mode, but several segments can share a term, and a term that is built once can feed seven ORs. Minimised *together*, which is Chapter 12’s method extended to several outputs (Chapter 26’s Espresso-style tools automate it), the hexadecimal decoder needs just 14 product terms and 30 gates (4 inverters, 14 ANDs and 12 ORs: an OR has at most eight inputs, and five of the segments need more), and the decimal decoder 9 terms and 18 gates. This is the way a PLA, the chip of Chapter 25, is programmed: one shared plane of AND gates, and for every output a choice of which of them to OR.

Whichever way you build it, the decoder is one lookup table with seven outputs. A ROM of 16 words of 7 bits holds it without any logic design at all, which is why cheap devices often did it that way, and why the exercise below has a par.

## Build the parts

These are the parts of Part III that go into your parts bin, from the multiplexer to the comparator. Chapter 14 will use several of them.

```build
id: blocks/mux2
title: A 2:1 multiplexer
part: mux2
allowed: [not, and, or]
prompt: |
  Build a **2:1 multiplexer** from NOT, AND and OR gates: **Y = D0** when **S = 0**, and **Y = D1** when **S = 1**. The pins are on the canvas. When it passes, it goes into your parts bin as **MUX2**.
hints:
  - Each data input needs a gate that lets it through only for one value of S. Which gate lets a signal through when another signal is 1?
  - S enables D1 directly; D0 needs the opposite of S.
explain: |
  Y = ¬S·D0 + S·D1: an inverter, two ANDs and an OR (Figure 13.1). Everything else in the chapter, from the 8:1 tree to the lookup table, is made of these.
solution: 13-building-blocks/exercises/mux2.json
```

```build
id: blocks/mux4
title: A 4:1 multiplexer from 2:1 parts
part: mux4
allowed: ['part:mux2']
prompt: |
  Build a **4:1 multiplexer** using only your **MUX2** parts (pick them from the parts palette). The inputs are D0 to D3, and the select bits S0 and S1; Y is the data input whose number is S1 S0.
hints:
  - You need three MUX2 parts.
  - Two of them choose within a pair, using the same select bit. Which select bit, S0 or S1?
  - The third chooses between the two winners, using the other select bit.
explain: |
  Two MUX2 parts controlled by S0 choose within the pairs (D0, D1) and (D2, D3), and a third, controlled by S1, chooses between the two winners: the tree of Figure 13.2. The 8:1 multiplexer is two of these and one more.
solution: 13-building-blocks/exercises/mux4.json
```

```build
id: blocks/dec2-4
title: A 2-to-4 decoder
part: dec2-4
prompt: |
  Build a **2-to-4 decoder** with an enable. While **EN = 1**, output Y*n* is 1 for the address whose number is A1 A0 (with A0 the low bit) and every other output is 0. While **EN = 0**, all four outputs are 0.
hints:
  - Each output is an AND of the two address bits, each either straight or inverted, and the enable.
  - A three-input AND gate is a two-input one with its Inputs parameter set to 3.
explain: |
  Two inverters and four three-input ANDs (Figure 13.4). Every output is one minterm of the address, and the enable shuts them all at once.
solution: 13-building-blocks/exercises/dec2-4.json
```

```build
id: blocks/comparator
title: A 4-bit comparator
part: comparator
prompt: |
  Build a **4-bit comparator**. It takes two unsigned numbers, A (A3 is the top bit) and B, and gives **EQ** when A = B, **LT** when A < B and **GT** when A > B. Exactly one of the three is 1 for any inputs.
hints:
  - XNOR gives you the equality of each bit; AND collects them for EQ.
  - GT is a sum of four terms, one per bit, from the top. Term *i* says that all bits above *i* are equal and that A has a 1 where B has a 0.
  - LT is neither GT nor EQ. One gate does it.
explain: |
  Four XNORs, one AND (EQ), four inverters on B, four ANDs that grow from two inputs to five (the GT terms), one OR and one NOR for LT: 15 gates, the circuit of Figure 13.7.
solution: 13-building-blocks/exercises/comparator.json
```

```golf
id: blocks/seg7-golf
title: Seven-segment golf
part: seg7
par: 30
metric: gates
allowed: [not, and, or, nand, nor, xor, xnor]
prompt: |
  Build the **seven-segment decoder**: the four inputs D0 (low bit) to D3 are a hexadecimal digit 0–F, and the outputs a to g light the bars of its glyph (the table in the chapter). Use as **few gates** as you can. Par is **30**. You can set a gate to have up to eight inputs, so a wide OR is one gate.
hints:
  - Build one segment first. Its equation is in the flagship figure; the checker shows which digits are wrong.
  - Do not minimise each segment on its own. Terms that two segments share can be built once. Look for the same AND in several equations.
  - A four-input AND recognises one input pattern (a minterm); segments that light for the same digits can share it.
explain: |
  The par is the multi-output minimum for the hexadecimal decoder: 14 shared product terms, each an AND of up to four (complemented) inputs, 4 inverters and the ORs that collect them for each segment (five of the seven have more terms than a gate has inputs, and take two gates each), which is 30 gates. Minimised one segment at a time, the same decoder takes more. If you beat 30 with XORs, or with terms that split into common factors, you have found what a two-level minimiser cannot: multi-level logic, as in Chapter 12’s section *Beyond two levels*.
solution: 13-building-blocks/exercises/seg7.json
```

:::challenge[A 16-bit multiplexer, without building it]
A 16:1 multiplexer chooses among sixteen inputs. How many 2:1 multiplexers does it need as a tree? How many gates is that at four gates each? And how many select bits at each level? (15 two-way multiplexers, which is 60 gates; four select bits, S0 for the first level of 8 multiplexers, S1 for the 4 in the second, S2 for the 2, S3 for the last one.) Now suppose you needed the same 16 data inputs as a *lookup table* instead: how many bits do you store, and how many different functions could it be? (16 bits; 65,536.)
:::

## Build it for real

:::real{parts="74HC04, 74HC08, 74HC02, common-cathode 7-segment display, 330 Ω resistor, 4-way DIP switch, 4 × 10 kΩ resistors, 5 V USB supply module, breadboard, jumper wires"}
**One segment of the decoder, in three gates.** In decimal mode the formula of segment e is ¬D2·¬D0 + D1·¬D0, which is ¬D0·(¬D2 + D1) and, by De Morgan, ¬(D0 + D2·¬D1): an inverter on D1, an AND of D2 with that, and a NOR of the result with D0. That is one gate each from a 74HC04, a 74HC08 and a 74HC02. Wire the four DIP switches to D3 to D0 with a 10 kΩ pull-down resistor on each (so that an open switch is a firm 0, Chapter 10), and connect the NOR output through the 330 Ω resistor to segment e of a common-cathode display, its common pin to ground. Set the switches to 0, 2, 6 and 8 and the segment lights; for 1, 3, 4, 5, 7 and 9 it does not. (Check the pin-out of your display, and use the same 5 V supply everywhere.)

Now add the other six segments from the formulas in the flagship figure, and you will see why an integrated decoder exists. The 74HC4511 does all seven, with latches for holding the digit, a lamp test and a blanking input, and it blanks the display for every input above 9 instead of drawing letters.:cite[nexperia-74hc4511] Connect it to your DIP switches and compare its digits with the ones in this chapter (the function table in the datasheet shows exactly which segments each code lights), while your own decoder can draw whatever glyphs you like.
:::

## What’s next

We can choose, point, name, compare and check. What we cannot yet do is *compute*: nothing so far has added, and the numbers on these displays have been abstract patterns of bits. Chapter 14 fills that gap. It gives the bit patterns meaning as numbers, unsigned and signed, builds the adder out of the XOR and AND of Chapter 6 and the multiplexers and comparators of this one, and asks the question that decides how fast a computer can be: how long does a carry take to travel from the bottom of a word to the top?
