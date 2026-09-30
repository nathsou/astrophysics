---
number: 14
title: Numbers and arithmetic
summary: 'How bit patterns become numbers, positive and negative; how gates add them, and why a carry rippling through a long word is the slowest thing a processor does; and how subtraction, shifting and multiplication come out of the same parts.'
duration: About 2 hours
prerequisites: [building-blocks, boolean-algebra]
---

Every programmer has seen this happen. An 8-bit signed counter stands at 127, something adds 1, and the counter reads −128.

```quiz
q: 'A signed 8-bit register holds 127 and the processor adds 1. What does the register hold afterwards?'
options:
  - text: 128, since 127 + 1 = 128.
    why: 'The largest number an 8-bit signed register can hold is 127, so 128 has nowhere to live. The register holds eight bits and that is all it has.'
  - text: −128, with no error reported by the adder.
    correct: true
    why: '127 is 01111111. Add 1 and the carries run all the way up: 10000000. Read as a signed (two’s complement) number, that is −128. The adder did exactly what an adder does; only the flags say that the answer does not fit.'
  - text: 0, because the register is full and wraps to the start.
    why: 'That is what an *unsigned* counter does at 255 + 1 = 256, which wraps to 0. A signed register reaches its limit half way round the wheel, at 127, and lands on −128.'
  - text: The processor stops with an error.
    why: 'Most do not. Hardware adds patterns of bits and reports a flag; whether anything happens is up to the software, which very often ignores it.'
```

Nothing in this chapter is magic. The adder in your processor is a circuit of the gates that you already know, and the strange behaviour above is what those gates do when a number has one bit too few. We shall see how a bit pattern becomes a number (and how a negative one), build an adder from a handful of gates, watch the *carry* travel through it and find out why that carry decides how fast a computer can count, and then get subtraction, shifting and multiplication almost for free.

## Numbers as patterns of bits

A word of *n* bits is a pattern of *n* zeros and ones, and the simplest way to read it as a number is the way you read decimal: each position has a **weight**, and the value is the sum of the weights of the positions that hold a 1. In decimal the weights are 1, 10, 100, and in binary they are 1, 2, 4, 8, 16, …, powers of two, with the least significant bit on the right. So 1101 is 8 + 4 + 0 + 1 = 13, and *n* bits give the numbers 0 to 2<sup>*n*</sup> − 1: 0 to 255 for 8 bits, 0 to 65,535 for 16, and 0 to 4,294,967,295 for 32. These are **unsigned** numbers.

Long strings of bits are unreadable, so we write them in :term[hexadecimal]{id=hexadecimal}. One hex digit is exactly four bits, with 0–9 for 0 to 9 and A–F for 10 to 15, so a byte is two digits and converting needs no arithmetic: 1101 0110 is D6, and 0xFF is eight ones. The seven-segment display of the last chapter is why the letters exist.

:::programmer[Integer types are widths]
`uint8_t`, `int16_t` and `long` are all words of a fixed number of bits, and every arithmetic operator is a circuit of that width: `+` on a `uint32_t` is a 32-bit adder. Overflow is not an exceptional event that the language detects. It is the adder's natural output when the true answer needs one more bit than the type has. C leaves *signed* overflow undefined; Java and Rust (in release builds) and every CPU simply wrap. This chapter builds the circuit that wraps.
:::

:::history{year=1703 title="Binary arithmetic" people="Gottfried Wilhelm Leibniz"}
In 1703 Leibniz published *Explication de l’Arithmétique Binaire*, an account of counting with only the characters 0 and 1, in the memoirs of the Paris Academy of Sciences.:cite[leibniz1703] He showed how to add, subtract, multiply and divide in base two, with the rule that 1 + 1 is 10, and had been working on the idea for years.

What prompted him to publish was a letter from the Jesuit Joachim Bouvet in Peking, who pointed out that the sixty-four hexagrams of the *I Ching*, attributed to the legendary Fu Xi, were the numbers 0 to 63 written in Leibniz’s notation, with a broken line for 0 and a whole one for 1. Leibniz sent his essay to the Academy within days.:cite[norman-leibniz] The volume that carries it, for the year 1703, was printed in 1705. Two and a half centuries later every digital computer did its arithmetic this way.
:::

## Negative numbers

Now the problem in the opening question. How do you write a negative number with only zeros and ones? There are three well-known answers, and the history of computer design is the discovery that the third is best.

**:term[Sign–magnitude]{id=sign-magnitude}** does what people do on paper: one bit is the sign, and the rest are the size. In 4 bits, 0101 is +5 and 1101 is −5. It is easy to read, and it has two zeros (0000 and 1000, +0 and −0), which every comparison must know about, and an adder for it needs to look at the signs and decide whether to add or subtract the magnitudes.

**:term[Ones’ complement]{id=ones-complement}** negates by inverting every bit, so −5 is the inverse of 0101, which is 1010. It has two zeros as well (0000 and 1111), and adding needs a strange correction, an *end-around carry*, in which a carry out of the top bit is fed back into the bottom.

**:term[Two’s complement]{id=twos-complement-ref}** negates by inverting every bit *and adding one*: −5 is 1010 + 1 = 1011. The top bit has the weight −2<sup>*n*−1</sup> (−8 in four bits) and the others their usual positive weights, so 1011 = −8 + 2 + 1 = −5. It has one zero and one more negative number than positive (−8 to +7). The table shows some of the sixteen patterns of four bits in each system (*Ones’* and *Two’s* are the complement systems).

| Bits | Unsigned | Sign–mag. | Ones’ | Two’s |
|---|---|---|---|---|
| 0000 | 0 | 0 | 0 | 0 |
| 0111 | 7 | 7 | 7 | 7 |
| 1000 | 8 | −0 | −7 | −8 |
| 1001 | 9 | −1 | −6 | −7 |
| 1010 | 10 | −2 | −5 | −6 |
| 1011 | 11 | −3 | −4 | −5 |
| 1100 | 12 | −4 | −3 | −4 |
| 1101 | 13 | −5 | −2 | −3 |
| 1110 | 14 | −6 | −1 | −2 |
| 1111 | 15 | −7 | −0 | −1 |

```quiz
q: 'In 4-bit two’s complement, which number does the pattern 1000 stand for?'
options:
  - text: −0, the negative zero, as in sign–magnitude.
    why: 'Two’s complement has no negative zero: that is one of its virtues. 0000 is the only zero.'
  - text: −8, the most negative number that fits.
    correct: true
    why: 'The top bit has weight −8 and all the others are 0, so the value is −8. It is also the one pattern that has no positive partner: −(−8) would be +8, which needs a fifth bit, so negating 1000 gives 1000 again.'
  - text: −1, since only one bit is set.
    why: 'The pattern for −1 is 1111: invert 0001 and add one. In two’s complement, −1 is all ones, at any width.'
  - text: 8, with the top bit being part of the magnitude.
    why: 'That is the unsigned reading. Two’s complement gives the top bit a negative weight.'
```

### The wheel

The reason that two's complement won is easiest to see on a wheel. Write the 16 patterns of four bits round a circle, 0000 at the top and counting clockwise. **Adding is walking clockwise**: 5 + 3 is three steps from 5. And when you walk past 1111 you arrive back at 0000, so the arithmetic is done *modulo* 16. That is unsigned arithmetic. But now read the same patterns differently: let the half of the wheel to the left of the top, 1000 to 1111, mean −8 to −1. Nothing about the walking changes, and the adder does not care. The wheel says that −3 is 13 steps clockwise from 0, and also three steps *anticlockwise*, and these are the same place.

::twos-wheel{n="14.1" caption="Drag the pointer round the wheel, or use Add and Subtract: the pointer walks, and C, V, N and Z report what a processor’s flags would say. Start at 5 and add 3 (in two’s complement the pointer crosses the red seam and lands on −8: overflow). Then switch the reading to ones’ complement or sign–magnitude and find the two zeros."}

:::key[Why two’s complement wins]
1. **One zero.** Testing for zero needs one comparison, and there is no −0.
2. **The same adder does both.** Signed and unsigned addition are the same walk round the wheel: the identical circuit gives the right pattern for both, and only your reading of it differs. Sign–magnitude needs extra logic.
3. **Negating is cheap:** −*x* = 2<sup>*n*</sup> − *x* = (2<sup>*n*</sup> − 1 − *x*) + 1, and 2<sup>*n*</sup> − 1 − *x* is just *x* with every bit inverted (there are no borrows when you subtract from all ones). Invert and add one: an XOR gate per bit and a carry in. That is subtraction, coming up.
:::

:::lab[Walk round the wheel]
1. Read the wheel as **two’s complement**, put the pointer on 5 and press *Add* with 3. The pointer lands on 1000, which reads −8. C is 0 (the unsigned answer, 8, is fine) but V is 1: the signed answer, 5 + 3 = 8, does not fit in four bits.
2. Put the pointer on 1111 (−1) and press +1. It lands on 0000. Now C is 1 (unsigned, 15 + 1 = 16 wrapped past the top) but V is 0, since −1 + 1 = 0 is a perfectly good signed answer. The same addition, and one reading calls it an error and the other does not.
3. Put the pointer on 1000 (−8) and press −1. The answer is 0111 = +7 and V is 1: −9 is out of range. Only the number *just past the seam* is ever wrong.
4. Switch to **Sign–magnitude** and find the two zeros. Then move the pointer anticlockwise by one from 0000: unlike in two’s complement, you do not arrive at −1.
:::

:::programmer[Two’s complement in code]
In C, `-x == ~x + 1` for two's-complement machines (which is every machine). Casting `int8_t` to `int16_t` copies the top bit into the new upper bits (:term[**sign extension**]{id=sign-extension}) so that −5 (11111011) becomes 1111111111111011, still −5: the wheel just got bigger, and the seam moved. And `>>` on a signed integer is an *arithmetic* shift, which copies the sign bit in from the left, while on an unsigned integer it is *logical* and shifts in zeros. Both come back in the shifter later in this chapter.
:::

## When the answer does not fit

The hardware adds two patterns and produces a pattern of the same width. It has no idea whether you meant them as signed or unsigned, so it reports **two** different facts, as separate :term[flags]{id=status-flags}, and software reads the one that matches what it meant.

- The **:term[carry flag]{id=carry-flag}** (C) is 1 when there is a carry out of the top bit. For unsigned numbers this means the sum does not fit: 15 + 1 = 16 needs a fifth bit.
- The **:term[overflow flag]{id=overflow}** (V) is 1 when the sum does not fit as a *signed* number. The rule in words: adding two numbers of the same sign gave an answer with the opposite sign. Adding a positive and a negative number can never overflow.

| Sum (4 bits) | Unsigned | Signed | Result | C | V |
|---|---|---|---|---|---|
| 0111 + 0001 | 7 + 1 | 7 + 1 | 1000 | 0 | **1** |
| 0101 + 0011 | 5 + 3 | 5 + 3 | 1000 | 0 | **1** |
| 1111 + 0001 | 15 + 1 | −1 + 1 | 0000 | **1** | 0 |
| 0011 + 1101 | 3 + 13 | 3 + (−3) | 0000 | **1** | 0 |
| 1000 + 1111 | 8 + 15 | −8 + (−1) | 0111 | **1** | **1** |
| 0101 + 1010 | 5 + 10 | 5 + (−6) | 1111 | 0 | 0 |

In hardware, V is a single XOR gate: the *carry into* the top bit against the *carry out of* it. If the top bit's inputs are both 0 or both 1 the carry in decides whether the sign flips; when the two carries differ, the sign bit is wrong. (The chapter's tests check that this rule agrees with the rule in words on every pair of 4-bit and 8-bit numbers.)

Flags are not there for show. The Octet of Part V has Z, C, N and V, and a conditional jump such as “jump if less than” is a test of a combination of them. Software that ignores them lives with the consequences:

:::note[Thirty-seven seconds]
On 4 June 1996 the first Ariane 5 rocket left Kourou and broke up 37 seconds later. The inquiry found that a program inherited from the Ariane 4 had converted a 64-bit floating-point number, the rocket’s horizontal velocity, into a 16-bit signed integer. Ariane 5 flew faster, the number did not fit, and the conversion raised an operand error that nobody had provided for, in both of the rocket’s redundant inertial reference systems.:cite[lions1996] It is the wheel of the last figure, with the pointer walking off the edge and the software not looking.
:::

## Adding, one column at a time

Adding two binary numbers works exactly as it does in decimal, column by column from the right, and it is simpler. In each column you add two digits and a carry from the column before, and the answer is a sum digit and a carry to the next column: 0 + 0 = 0, 0 + 1 = 1, and 1 + 1 = 10, a 0 and a carry of 1. Chapter 6 built the two-column table and the Model K that implements it, the **half adder**:

**S = A ⊕ B**, **C = A · B**: the sum is an XOR, and the carry an AND.

It is called half because it has nowhere to put the carry *coming in*. Every column but the first has one, so each needs a **:term[full adder]{id=full-adder}**, which adds three bits, A, B and a carry in CIN, and produces the sum S and a carry out COUT. Chapter 6’s challenge asked for the carry out as “at least two of the three inputs are 1”, and the sum as “an odd number of them are”. Both come out of two half adders and an OR, exactly as the exercise in this chapter will ask you to build:

::::equation{#full-adder caption="A full adder. The first half adder adds A and B; the second adds the carry in to that sum; the OR collects the two ways of making a carry."}
$$\begin{gathered}\term{s}{S = A \oplus B \oplus C_{in}} \\ \term{c}{C_{out} = A\,B + (A \oplus B)\,C_{in}}\end{gathered}$$

```terms
s:
  label: 'the sum bit'
  what: 1 when an odd number of A, B and the carry in are 1.
  why: XOR is associative, so the two half adders in a row give A ⊕ B ⊕ Cin.
  effect: It is the parity of the three inputs, which is why a staircase light with three switches works.
c:
  label: 'the carry out'
  what: 1 when at least two of the three inputs are 1.
  why: 'Either both A and B are 1 (a carry is *generated*), or exactly one of them is 1 and the carry in is 1 (a carry is *propagated*).'
  effect: This is the majority function of Chapter 6. The names generate and propagate return in carry lookahead.
```
::::

::circuit{src="14-arithmetic/circuits/full-adder.json" title="A full adder from five gates" n="14.2" mode="logic" speed=1e-6 dial=true caption="Click A, B and CIN. S and COUT together are the number of 1s among the three inputs, written in binary: 0, 1, 2 or 3. Then use the dial in the toolbar to open the gates into their transistors (Chapter 9): the same five gates, as switches."}

:::lab[A full adder counts]
1. Set A, B and CIN to all eight combinations. Write down COUT and S as a two-digit binary number. With one input at 1 it is 01, with two 10, with three 11: **a full adder counts the ones among its three inputs**.
2. That is why it works as the building block of every adder. Three bits of the same weight go in, and out come one bit of that weight and one of the next weight up.
3. Find in the drawing the two ANDs. One (A and B) *generates* a carry by itself whatever CIN is. The other (A ⊕ B, and CIN) passes the carry in on to the output, when exactly one of the inputs is 1. Remember the words generate and propagate.
:::

## Ripple carry

To add two *n*-bit numbers, use *n* full adders, one for each column, and join each carry out to the carry in of the next column up. The first column has no carry in, so it gets a 0 (or a half adder).

::circuit{src="14-arithmetic/circuits/ripple4.json" title="A 4-bit ripple-carry adder" n="14.3" mode="logic" speed=1e-6 caption="Set A and B as 4-bit numbers (A3 and B3 are the top bits) and read the sum on S3 to S0, with the fifth bit on COUT. Try 0111 + 0001: the carry generated in the lowest column has to pass through the next three before the top sum bit is right. Each FA box is the full adder of Figure 14.2."}

This is a **:term[ripple-carry adder]{id=ripple-carry}**, and it is the simplest circuit that adds. It is also slow in a way that scales badly. The sum bit of column 3 needs the carry out of column 2, which needs the carry out of column 1, which needs the carry out of column 0. In the worst case a carry is born in the lowest column and *ripples* through every column above it: a chain of gates as long as the word. The carry path through one full adder is two gates (an AND and an OR), so an *n*-bit ripple adder in this chapter’s gates takes 2*n* − 1 gate delays in the worst case: 7 for four bits, 15 for eight, 31 for sixteen and 127 for 64. **The delay grows in proportion to the width**, and doubling the word doubles the time.

That would be tolerable if adding were rare, but the adder is on the critical path of almost everything a processor does: an address, a counter, a loop, a comparison. A machine that takes 127 gate delays to add two 64-bit numbers cannot run faster than 1/127 of a gate’s speed, and a clock has to wait for the slowest thing.

## Looking ahead

The way out is to stop waiting. Look at one column again. It :term[*generates*]{id=generate-propagate} a carry by itself if both its bits are 1 (g = a·b), and it *propagates* an incoming carry if exactly one of its bits is 1 (p = a ⊕ b). The carry out is therefore

**c<sub>i+1</sub> = g<sub>i</sub> + p<sub>i</sub> · c<sub>i</sub>**

and g and p depend only on the inputs of that column, so *every column can compute them at once, in one gate delay*. Now unroll the recurrence. The carry into column 1 is g<sub>0</sub> + p<sub>0</sub>c<sub>0</sub>; substituting into the next,

**c<sub>2</sub> = g<sub>1</sub> + p<sub>1</sub>g<sub>0</sub> + p<sub>1</sub>p<sub>0</sub>c<sub>0</sub>**,

**c<sub>3</sub> = g<sub>2</sub> + p<sub>2</sub>g<sub>1</sub> + p<sub>2</sub>p<sub>1</sub>g<sub>0</sub> + p<sub>2</sub>p<sub>1</sub>p<sub>0</sub>c<sub>0</sub>**,

and so on. Every carry is now a sum of products of the g’s, the p’s and the input carry: *two levels of logic*, an AND layer and an OR, with no rippling. That is **:term[carry lookahead]{id=carry-lookahead}**.

::circuit{src="14-arithmetic/circuits/lookahead4.json" title="The carry unit of a 4-bit lookahead adder" n="14.4" mode="logic" speed=1e-6 caption="Its inputs are the generate and propagate signals g0 to g3 and p0 to p3 (set them by hand: in an adder they come from a·b and a ⊕ b) and the carry in C0. Each carry C1 to C4 is one layer of ANDs and an OR of them, and all four appear together. Set C0 and p0 to p3 to 1, and the carry runs through the whole unit in two gate delays. The AND with five inputs, t4_0, is the widest."}

Around this unit an adder needs one XOR and one AND per column to make p and g, and one XOR per column for the sum bit p ⊕ carry: 8 + 14 + 4 = 26 gates for four bits, against 20 for four full adders. That is the price of speed. (A chip that does this job, the 74182, is called a look-ahead carry generator.)

There is a catch, and the figure shows it. The wide ANDs grow with the position: the carry into column 15 would need an AND of 16 inputs and an OR of 17, and real gates have at most a handful. Designers therefore combine the (g, p) pairs of neighbouring groups in a **tree**: two groups with (G, P) and (G′, P′) merge into one whose generate is G + P·G′ (the upper group generates, or it propagates a carry that the lower group generated) and whose propagate is P·P′. A tree of such merges gives every carry after about log<sub>2</sub> *n* levels of them, instead of *n*. Doubling the word adds *one level*, two gate delays, instead of doubling the delay.

Which brings us to the race. Both adders below are built gate by gate on the digital engine, with a 1 ns delay for each gate, and both are given the same two numbers. The waveforms are the sum outputs, recorded change by change; drag the time slider (or press Play) to see the sum at any moment. Red marks an output that shows the wrong value.

```quiz
q: 'You add 0xFF and 0x01 in an 8-bit ripple-carry adder. Which sum bit is the last to settle to its final value?'
options:
  - text: 'The lowest sum bit: it is the first column, and the first column has the most work.'
    why: 'The lowest bit has *no* carry to wait for: it is an XOR of two inputs and settles after a single gate delay. It is the top that waits.'
  - text: 'All of them together, since all the columns work in parallel.'
    why: 'They start in parallel, but every column above the first must wait for the carry from below. That waiting is the whole difficulty.'
  - text: The highest sum bit and the carry out, after the carry has passed through every column.
    correct: true
    why: 'A carry is born in column 0 (1 + 1) and every column above it has A = 1 and B = 0, which passes a carry in straight on. So the carry rides through all eight columns, and the top bit is the last to become right. Watch it in the figure.'
```

::carry-race{n="14.5" caption="Set the width and press Play. On the ripple adder a wave of wrong (red) bits runs up the word, one column every two gate delays, and the answer is right only when the wave has passed. The lookahead adder finishes almost together, whatever the width. Push the width to 16, then choose No carries: with no carry to pass, the ripple adder is quick too (its worst case is what sets the clock). The chart shows the longest path for every width from 4 to 16."}

:::lab[Race the adders]
1. Set the width to 4 and press Play with *All ones + 1*. The ripple adder takes 7 ns and the lookahead adder 5 ns: barely a difference, and the lookahead adder has 23 gates against 17.
2. Move the slider up to 8 and to 16 bits. The ripple time is 2*n* − 1 ns: 15 and 31. The lookahead adder takes 7 ns and then 9 ns: each doubling of the width adds two gate delays. At 16 bits the lookahead adder is more than three times faster, and it has 179 gates against 77.
3. Choose **No carries**. The ripple adder is now finished after about 3 ns at any width. Carry rippling depends on the data: adding 0x5555 to 0xAAAA makes no carries at all. But a clock must be set for the worst case that could arrive, not the typical one.
4. Drag the time slider to 10 ns at 16 bits, with *All ones + 1*. How many of the seventeen outputs of the ripple adder are right? (Six: the lowest six sum bits. The other eleven are still red.) And the lookahead adder’s? (All of them: it finished at 9 ns.)
:::

:::hood[How the event queue produces the ripple]
The ripple in the figure is not drawn; it is *simulated*, by the course’s digital engine. The engine keeps a queue of scheduled changes, ordered by time. When a gate’s inputs change, the engine evaluates the gate and, instead of changing its output at once, schedules the change one gate delay later (`src/lib/sim/digital/engine.ts`):

```ts
drive(slot: number, value: number, delay: number): void {
  …
  this.queue.push(this.now + delay, slot, value, this.drvSerial[slot]!);
  this.drvPending[slot] = this.drvPending[slot]! + 1;
  this.drvPendVal[slot] = value;
}
```

The main loop takes every event that is due at the current time, applies it to its net, and wakes every gate that reads the net; those gates evaluate and schedule *their* outputs a delay later:

```ts
while (q.size > 0 && q.time[0] === t) {
  q.pop();
  …
  if (this.drvValue[target] !== v) {
    this.drvValue[target] = v;
    this.resolve(this.drvNet[target]!);
  }
}
```

`resolve` marks the gates that read the net as dirty, and, if a recorder is watching the net, appends the time and the new values to its trace: this is what the scrubber reads. There is no notion of “the ripple” anywhere. The carry chain is just events that cause events: one gate’s output changes at t, the next gate’s at t + 1 ns, and so on down the chain, 2 ns per column. The time to settle is the length of the longest chain of causes.

Counting the events the engine processes for the same worst-case addition (all ones plus one, 16 bits) gives the other side of the trade: **91 events for the ripple adder and 125 for the lookahead adder**. The lookahead adder finishes sooner, and it does so by doing more: more gates change, more often. In a chip each of those changes charges and discharges capacitance (Chapter 10’s CV²f), so the fast adder costs area *and* power. Both numbers are asserted in the chapter’s tests.
:::

:::history{year=1838 title="The anticipating carriage" people="Charles Babbage"}
Babbage met the carry problem in brass. Adding two forty-digit numbers on a machine of wheels and gears means that a 9 turning to 0 must pass a carry to the next wheel, which may itself be a 9, and so on up the column: a ripple whose time grows with the number of digits.

For his Analytical Engine, designed in the 1830s, Babbage devised the **anticipating carriage**: a mechanism that looked ahead along the wheels to see which of them would carry, and then carried in all of them in a single operation, whatever the number of digits.:cite[bromley1982] Allan Bromley’s study of the design of 1838 describes the mechanism in detail; the Analytical Engine itself was never completed. It is the same idea, and for the same reason, that electronic designers found again as *carry lookahead*.
:::

## Subtraction is addition

We showed that −*x* is the inverse of *x*, plus one. So A − B is A + ¬B + 1: **invert B and add, with a carry in of 1**. The circuit needs almost nothing more than the adder. Put an XOR gate on each bit of B, with a control input SUB as its other input. Chapter 11 said that XOR with 0 passes a bit through and with 1 inverts it. Wire SUB also to the carry in of the adder, and that is all. With SUB = 0, the circuit adds; with SUB = 1, it inverts B and adds 1, so it subtracts.

::circuit{src="14-arithmetic/circuits/addsub.json" title="An adder/subtractor" n="14.6" mode="logic" speed=1e-6 caption="Set A and B with their bits (the hex displays show them), and flip SUB. With SUB off the display shows A + B; on, A − B. Try 5 − 3, then 3 − 5 (which gives 14, and 14 is −2 as a signed number). The carry out is 1 when there is no borrow. Try 7 + 1: V lights, as in the wheel."}

Two things to notice. First, the *carry flag means something different* for subtraction: a carry out of A + ¬B + 1 is 1 when A ≥ B as unsigned numbers, that is, when **no** borrow was needed. Some processors invert it to make it a borrow flag; ARM does not, x86 does. Second, a comparison is a subtraction whose answer is thrown away. Whether A < B is then a test of flags: for unsigned numbers it is “no carry”, and for signed ones N ≠ V. The comparator of Chapter 13 did the same job with different gates.

The parts bin’s 8-bit adder/subtractor is this circuit with eight full adders in a row; the exercise below asks you to build it.

## Shifting

Multiplying by two in decimal is easy when the number is written in the base: 1234 × 10 = 12340, so every digit moves one place. In binary, multiplying by 2 does the same: **shifting left by one place** moves every bit up and puts a 0 in the vacated place. 0101 (5) becomes 1010 (10). Shifting right by one divides by 2 and rounds down: 1010 becomes 0101. Shifting by *k* places multiplies or divides by 2<sup>*k*</sup>.

For signed numbers the shift right must not lose the sign. The *logical* right shift puts a 0 at the top, which turns a negative number into a large positive one. The :term[**arithmetic** right shift]{id=arithmetic-shift} copies the sign bit into the empty places, so 11110000 (−16) shifted right by two is 11111100 (−4), still negative, and still −16 ÷ 4. It rounds toward −∞, not toward zero: −5 ÷ 2 gives −3.

A shifter that moves by one place per clock takes up to 7 cycles for a shift of 7. Real processors shift by any amount in one go, with a **:term[barrel shifter]{id=barrel-shifter}**, which is a beautiful use of the multiplexers of Chapter 13. A shift by *k* is a sum of shifts by 1, 2, 4, … according to the bits of *k*, so use one layer of multiplexers per bit: layer 0 shifts by 1 or does not, layer 1 by 2 or not, layer 2 by 4 or not. Three layers of eight 2:1 multiplexers do every shift from 0 to 7 in the time of three multiplexers.

::barrel-shifter{n="14.7" caption="Click bits of the input to change them, and the S buttons to set the shift amount. Each layer shifts by 1, 2 or 4 places or passes the word straight through, controlled by one bit of the amount. Switch between shifting left, shifting right, arithmetic right (start from a word with the top bit set) and rotating."}

The shifter in your parts bin is exactly this, with one more layer of multiplexers to reverse the word so that a left shifter also shifts right. A 32-bit barrel shifter is five layers of 32 multiplexers, about 160 of them, and no clock.

## Multiplying

Multiplication by hand is shifts and adds. To multiply 13 by 11, take each digit of the multiplier in turn; for every 1 write down the multiplicand shifted into that column, and for every 0 write down nothing; then add up the rows. In binary the digits are all 0 or 1, so a row is either the multiplicand or nothing, and **the hardware needs only a shifter, an adder and a register to keep the running product**.

::multiplier{n="14.8" caption="Press Next step to walk through the multiplier bits from the right: each 1 adds the multiplicand, shifted, to the running product. The default is 13 × 11 = 143. Try 15 × 15 = 225, the largest product of two 4-bit numbers, and then a multiplier with a single 1 bit (1, 2, 4 or 8): a multiplication by a power of two is only a shift."}

An *n*-bit multiplication takes *n* steps of an adder, so a sequential multiplier takes *n* clock cycles, and the product has up to 2*n* bits (15 × 15 = 225 needs 8). When speed matters the loop is *unrolled* into an array of AND gates and full adders that computes all the partial products at once: an 8 × 8 array multiplier uses 64 AND gates and 56 full adders, a hundred and twenty parts against one adder and a register, and no clock. Octet, the CPU we shall build in Part V, has no multiply instruction at all; Chapter 23 writes shift-and-add as a short program.

## Build the parts

These four parts go into the parts bin, where Part V will find them, and the last exercise is a golf.

```build
id: arith/half-adder
title: A half adder
part: half-adder
prompt: |
  Build a **half adder**: it adds two bits A and B, and gives the **sum S** and the **carry C**. The pins are on the canvas. When it passes, it goes into your parts bin as **HALF ADDER**.
hints:
  - Look at the truth table. Which gate is 1 exactly when the inputs differ? Which is 1 only when both are 1?
explain: |
  S = A ⊕ B and C = A · B: an XOR and an AND, the circuit of Stibitz’s Model K in Chapter 6.
solution: 14-arithmetic/exercises/half-adder.json
```

```build
id: arith/full-adder
title: A full adder from half adders
part: full-adder
allowed: [part:half-adder, or, part:or]
prompt: |
  Build a **full adder** from two of your **half adders** and an OR gate. It adds A, B and a carry in **CIN**, and gives the sum **S** and carry out **COUT**.
hints:
  - The first half adder adds A and B. Its sum is not the answer yet: there is still CIN to add.
  - The second half adder adds CIN to the first one’s sum. Its sum is S.
  - A carry is made by the first half adder or by the second. Never both at once. Which gate combines them?
explain: |
  Two half adders and an OR: the equation of Figure 14.2. When this passes, the full adder goes into your bin.
solution: 14-arithmetic/exercises/full-adder.json
```

```build
id: arith/adder8
title: An 8-bit adder/subtractor
part: adder8
allowed: [xor, part:xor, part:full-adder]
prompt: |
  Build an **8-bit adder/subtractor** from eight of your **full adders** and eight XOR gates. The inputs are A0 to A7 and B0 to B7 (bit 0 is the least significant) and **SUB**. With SUB = 0 the outputs S0 to S7 are A + B; with SUB = 1 they are A − B. **COUT** is the carry out.
hints:
  - Each bit of B goes through an XOR with SUB before it reaches its full adder.
  - The carry out of each full adder is the carry in of the next one up.
  - What should the carry in of bit 0 be for subtraction, and what for addition? SUB itself does both.
explain: |
  A ripple-carry chain of eight full adders, with the XORs that invert B for subtraction, and SUB as the first carry in: A − B = A + ¬B + 1. Its worst-case delay is about 8 × 2 gate delays; Part V’s ALU is built around it.
solution: 14-arithmetic/exercises/adder8.json
```

```build
id: arith/shifter
title: A barrel shifter
part: shifter
allowed: [part:mux2]
prompt: |
  Build an **8-bit barrel shifter** from your **MUX2** parts. The data inputs are D0 to D7; SH0 to SH2 give the shift amount, and **DIR** = 0 shifts left, **DIR** = 1 shifts right. Places emptied by the shift are filled with 0, and Y0 to Y7 are the outputs.
hints:
  - Three layers of multiplexers: the first shifts by 1 or not (select SH0), the second by 2 (SH1), the third by 4 (SH2).
  - A constant 0 is available from the palette as a Constant, for the places that are emptied.
  - Shifting right is shifting left of the reversed word. Reversing costs one row of multiplexers before and one after, controlled by DIR.
explain: |
  A row of MUX2s to reverse the word if DIR is set, three layers that each shift left by 1, 2 or 4 or pass the word through, and a row to reverse again. Forty multiplexers in all, and no clock.
solution: 14-arithmetic/exercises/shifter.json
```

```golf
id: arith/fa-nand-golf
title: A full adder in NAND gates
part: full-adder
par: 9
metric: gates
allowed: [nand]
prompt: |
  Build a **full adder** from **NAND gates only**, using as few as you can. Par is **9**. A full adder from XOR, AND and OR gates takes five, and each of them costs several NANDs if you translate it one gate at a time: this is a puzzle of *sharing*.
hints:
  - The XOR of two signals takes four NANDs; the first of them (NAND of the two inputs) is shared by the other three.
  - A full adder is two XORs, and the carry out is A·B + (A ⊕ B)·CIN. Both of those products are NANDs you have already made.
  - The carry out is a NAND of two NAND outputs that you already have.
explain: |
  Two four-NAND XORs (Chapter 11), chained, make the sum, and the carry out is NAND(NAND(A, B), NAND(A ⊕ B, CIN)), which reuses two of the gates already there. That is 4 + 4 + 1 = 9.
solution: 14-arithmetic/exercises/fa-nand.json
```

:::challenge[How slow is a 64-bit ripple adder?]
With 1 ns gates, the worst-case delay of an *n*-bit ripple adder in this chapter’s gates is 2*n* − 1 ns. What clock frequency does that allow for *n* = 64, if nothing else is slow? (127 ns is about 7.9 MHz.) Now suppose the gates were 100 times faster, like the ones in a modern chip (10 ps). Compute the same quantity for a lookahead adder whose delay is 2 log<sub>2</sub> *n* + 2 gates, and compare. Then explain why processors combine both ideas, with lookahead inside each group of four bits and a ripple, or another lookahead, between the groups. (The chip in the next section does this.)
:::

## Build it for real

:::real{parts="74HC283, 8-way DIP switch (or two 4-way), 8 × 10 kΩ resistors, 5 × LED, 5 × 330 Ω resistors, 5 V USB supply module, breadboard, jumper wires"}
**A 4-bit adder with a 74HC283.** The 74HC283 is a four-bit binary full adder with internal carry lookahead, in a 16-pin package.:cite[nxp-74hc283] Its pins (check them against your datasheet): the A inputs are pins 5, 3, 14 and 12 for A1 to A4, and the B inputs pins 6, 2, 15 and 11 for B1 to B4; the sum outputs are pins 4, 1, 13 and 10 for Σ1 to Σ4; C0 (the carry in) is pin 7, C4 (the carry out) is pin 9; ground is pin 8 and +5 V pin 16.

Wire each of the eight A and B inputs to a DIP switch that connects it to +5 V when closed, with a 10 kΩ pull-down resistor to ground on each input so that an open switch gives a firm 0 (Chapter 10: never leave an input floating). Tie C0 to ground. Put an LED with a 330 Ω series resistor on each of the four sum outputs and on C4. Add 5 + 3 (0101 and 0011): the LEDs show 1000. Add 15 + 1: the sum LEDs are dark and C4 is lit. Then try to see the *speed* of the carry: you cannot with LEDs, since a 74HC283 settles in some tens of nanoseconds, but a scope on C0 and C4 with 1111 + 0000 would show how long a carry takes to cross the chip.

Now take a second 74HC283 and join the first one’s C4 to the second one’s C0: an 8-bit adder made of two lookahead groups with a ripple between them, exactly the design of the challenge above.
:::

## What’s next

Look again at the waveforms of the carry race, before the red had gone. For a few nanoseconds the sum bits show numbers that are not the sum of anything: they are *glitches*, real values that appear on a wire, hold for a moment and are gone. Every circuit in this Part has been judged by the state it settles to, and every one passes through states on the way. Chapter 15 is about that time in between: propagation delay, the critical path that limits how fast a clock can run, and the glitches that a circuit can make for itself, even a correct one.
