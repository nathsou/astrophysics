---
number: A
title: Reference
summary: Schematic symbols, units and prefixes, the resistor colour code, preferred values, number systems, logic levels and the pinouts of the chips in the labs.
duration: Look things up
prerequisites: []
---

This appendix is for looking things up, not for reading straight through. Each section stands alone: the symbols the course draws, the units it measures in, the colour code on a resistor, the number systems of digital design, the voltages at which a gate decides between 0 and 1, and the pin numbers of the chips in the *Build it for real* labs. Where a table would be a chore to use, there is a small tool instead.

## Schematic symbols

Every circuit in the course is drawn by the same renderer, from a catalogue of component types. The gallery below draws each type exactly as the bench and the live figures do, with its name, the word that identifies it in a circuit file, and its pins. Nothing here is a picture: each symbol is a one-component circuit, drawn on the fly.

::symbol-gallery{n="A.1"}

A few conventions hold across all of them:

- **Signals flow from left to right, and from high voltage to low.** Supplies are on the left, loads on the right, the positive rail at the top and ground at the bottom. Logic inputs are on the left of a gate and its output on the right.
- **A dot is a connection; a crossing is not.** Wires that meet at a T-junction get a dot. Two wires that cross without a dot are two separate wires. An open circle on a pin means that nothing is connected to it.
- **Some things are the same wire without being drawn as one.** Every ground symbol is the same net; so is every supply rail of the same voltage, and so is every net label with the same name. Schematics use them to avoid a tangle of long wires.
- **The resistor is a zigzag, not a box.** That is the American (ANSI) symbol; European diagrams draw a plain rectangle (IEC). The course uses the zigzag, and so does most of the software you will meet.
- **Gates have a shape, and the shape tells you the function.** A rounded back is OR, a flat back is AND, a small circle at an output or input means “inverted”, and a triangle is a buffer. Chapter 11 uses that last fact to push inversions around a circuit, which is why the inverting circle is worth learning to see.
- **Every part has a reference designator**: R for resistors, C for capacitors, D for diodes and LEDs, Q for transistors, U for integrated circuits, S or SW for switches, K for relays, B for batteries. The number is only there to tell parts of the same kind apart.

## Units and SI prefixes

The course uses SI units throughout: seconds, volts, amperes and their relatives. Each derived unit is defined by a simple relation, and knowing it is the quickest way to check an equation: if the units on the two sides do not match, the equation is wrong.

| Quantity | Unit | Symbol | In other units |
|---|---|---|---|
| Time | second | s | |
| Frequency | hertz | Hz | 1/s |
| Electric charge | coulomb | C | A · s |
| Current | ampere | A | C/s |
| Voltage | volt | V | J/C = W/A |
| Resistance | ohm | Ω | V/A |
| Conductance | siemens | S | A/V = 1/Ω |
| Capacitance | farad | F | C/V |
| Inductance | henry | H | V · s/A |
| Energy | joule | J | W · s = V · C |
| Power | watt | W | J/s = V · A |

Values in electronics span more than twenty orders of magnitude, from a picofarad of stray capacitance to a gigahertz clock, so units come with prefixes. Each prefix is a power of ten; the ones you will use are these.

| Prefix | Symbol | Factor | Where the course meets it |
|---|---|---|---|
| tera | T | 10¹² | 1 TΩ, the resistance of an open switch in the simulator |
| giga | G | 10⁹ | a 1 GHz clock; a gigabyte |
| mega | M | 10⁶ | 1 MΩ, a 10 MΩ voltmeter; a 16 MHz clock |
| kilo | k | 10³ | 4.7 kΩ pull-up; 20 kHz |
| (none) | | 1 | 5 V; 330 Ω |
| milli | m | 10⁻³ | 20 mA through an LED; a 5 ms relay |
| micro | µ | 10⁻⁶ | 1 µF; a 100 µs bounce |
| nano | n | 10⁻⁹ | a 100 nF decoupling capacitor; a 10 ns gate delay |
| pico | p | 10⁻¹² | 10 pF of wire capacitance |
| femto | f | 10⁻¹⁵ | the capacitance of one gate input in a modern chip is of the order of a femtofarad |

The SI defines these prefixes.:cite[bipm2019] It has since added ronna, quetta, ronto and quecto (in 2022), but nothing in this course needs them.

### How the course writes units

- **A thin space between the number and the unit**: 4.7 kΩ, 5 V, 20 mA. In this text it is the narrow no-break space (U+202F), so that a value never breaks across two lines. There is **no** space between a prefix and its unit: *kΩ*, not *k Ω*.
- **Case matters.** *M* is mega and *m* is milli: a 1 MΩ resistor and a 1 mΩ one differ by a factor of a billion. *k* for kilo is lower case; *K* is the kelvin. Unit names are lower case (“volt”), and symbols named after a person are capitalised (V, A, Hz).
- **Symbols do not take an s**: 5 V, not 5 Vs. **µ** is the micro sign; in plain text without it, people write *u*, as in 4u7.
- **A proper minus sign** (−5 V) and **an en dash for ranges** (2–6 V).
- **Digits are grouped in threes** only when it helps: 65,535 in prose, 0xFFFF in code. Binary is grouped in fours: 1010 0101.
- **Bytes.** 1 kB is 1,000 bytes and 1 KiB (“kibibyte”) is 1,024. Memory chips are sized in powers of two, so the course says KiB when it means 1,024.

On a component or in a shop the decimal point is often replaced by the prefix letter, because a printed dot is easily lost: **4k7** is 4.7 kΩ, **2M2** is 2.2 MΩ, **0R47** is 0.47 Ω, **470R** is 470 Ω. The colour code below gets round the same problem by not printing digits at all.

:::tip[Mental arithmetic with prefixes]
Work with kilo, milli, micro and mega together and the prefixes cancel by themselves:

- volts ÷ kΩ = **mA**: 5 V across 1 kΩ is 5 mA. Volts ÷ MΩ = µA.
- kΩ × µF = **ms**: 10 kΩ × 100 nF = 10 × 0.1 = 1 ms. kΩ × nF = µs, and MΩ × µF = s.
- 1 ÷ kHz = **ms**, 1 ÷ MHz = **µs**, 1 ÷ GHz = **ns**. A 50 MHz clock has a period of 20 ns.
- Light and electric signals travel about 30 cm in 1 ns, which is why a metre of wire matters at 1 GHz.
:::

## The resistor colour code

Resistors are too small to print numbers on and too round to read them from any angle, so they wear coloured rings. The code is an international standard (IEC 60062).:cite[iec60062] Hold the resistor so that the bands are bunched together at the left end and read towards the right, and the gap that sets the last band apart is on the right.

- **Four bands** (the common case): two digits, a multiplier, a tolerance.
- **Five bands** (precision parts): three digits, a multiplier, a tolerance.
- **Six bands**: as five, then the temperature coefficient, the drift in parts per million for each kelvin.
- The **multiplier** is a power of ten, so for the colours black to green you can read it as “this many zeros”: red is two zeros, orange is three. Gold and silver, ×0.1 and ×0.01, are used for values below 10 Ω.
- A **gold** or **silver** band is never a digit. If your reading would start with one, you are holding the resistor the wrong way round.
- **No tolerance band** at all means ±20 %.
- A **single black band** is a zero-ohm link, a wire in the shape of a resistor, used so that a machine can place it.

The digits follow the spectrum after brown: red, orange, yellow, green, blue, violet, then grey and white for 8 and 9. Some common values: 220 Ω is red red brown; 330 Ω is orange orange brown; 1 kΩ is brown black red; 4.7 kΩ is yellow violet red; 10 kΩ is brown black orange; 100 kΩ is brown black yellow.

::colour-code{n="A.2"}

## Preferred values: the E series

Resistors and capacitors are not sold in every value. A shop stocks 4.7 kΩ and 5.6 kΩ, but not 5.0 kΩ, and the gaps are on purpose. The values follow the **E series** of preferred numbers (IEC 60063)::cite[iec60063] a geometric progression, with each value a fixed factor bigger than the last, rounded to two digits.

The factor is chosen so that the series has *N* steps in every decade (a factor of ten): each step multiplies by the *N*-th root of ten, and the series is named E*N*. For E12 that is 10^(1/12) = 1.21, a 21 % step; for E24 it is 10^(1/24) = 1.10, a 10 % step. The rounding to two digits makes a few values deviate from the ideal by up to about 4 % (33 for 31.6, 27 for 26.1), which is invisible at these tolerances.

The reason is tolerance. A value that can be 10 % off covers 0.9 to 1.1 of its nominal value, a span of about 22 %. Space the E12 values by 21 % and the tolerance ranges of neighbours just touch: any resistance you need is within a tolerance of *some* stocked value, and a manufacturer needs to offer only twelve nominal values per decade. The same holds for E24 with ±5 %, for E96 with ±1 %, and so on. The worst-case gap between your target and the nearest stocked value is half a step: 10 % for E12, 5 % for E24.

| Series | Values per decade | Typical tolerance | Where you meet it |
|---|---|---|---|
| E6 | 6 | ±20 % | old electrolytic capacitors |
| E12 | 12 | ±10 % | capacitors, inductors, cheap resistors |
| E24 | 24 | ±5 % | the everyday carbon-film resistor |
| E48 | 48 | ±2 % | |
| E96 | 96 | ±1 % | metal-film resistors; E96 values have three digits |
| E192 | 192 | ±0.5 % and better | precision |

The two everyday series, for one decade (multiply by 1, 10, 100 … for the others): E12 is the left column of each pair, and the E24 series adds the value in the right column.

| E12 | added by E24 | E12 | added by E24 | E12 | added by E24 |
|---|---|---|---|---|---|
| 10 | 11 | 27 | 30 | 56 | 62 |
| 12 | 13 | 33 | 36 | 68 | 75 |
| 15 | 16 | 39 | 43 | 82 | 91 |
| 18 | 20 | 47 | 51 | | |
| 22 | 24 | | | | |

E6 is every second E12 value: 10, 15, 22, 33, 47, 68. E96 does not use the two-digit values at all: its values are 10^(*k*/96) rounded to *three* digits (100, 102, 105, 107, 110, …, 976), which is how the 4.99 kΩ resistor of a precision circuit gets its odd-looking number. The colour-code tool above will tell you the nearest E12, E24 and E96 value to any resistance you type.

## Number systems

A computer stores numbers as patterns of bits, and people read them in **binary** (base 2), **octal** (base 8) or **hexadecimal** (base 16, “hex”). The last two are shorthand for binary: an octal digit stands for exactly three bits and a hex digit for exactly four, so converting between them needs no arithmetic. Programmers write the base as a prefix: `0b1010`, `0o12`, `0xA` and plain `10` are all ten.

| Decimal | Binary | Octal | Hex | | Decimal | Binary | Octal | Hex |
|---|---|---|---|---|---|---|---|---|
| 0 | 0000 | 0 | 0 | | 8 | 1000 | 10 | 8 |
| 1 | 0001 | 1 | 1 | | 9 | 1001 | 11 | 9 |
| 2 | 0010 | 2 | 2 | | 10 | 1010 | 12 | A |
| 3 | 0011 | 3 | 3 | | 11 | 1011 | 13 | B |
| 4 | 0100 | 4 | 4 | | 12 | 1100 | 14 | C |
| 5 | 0101 | 5 | 5 | | 13 | 1101 | 15 | D |
| 6 | 0110 | 6 | 6 | | 14 | 1110 | 16 | E |
| 7 | 0111 | 7 | 7 | | 15 | 1111 | 17 | F |

Hex is the standard because a byte is exactly two hex digits: `0xA5` is `1010 0101`. Octal survives in Unix file permissions (`0o755`) and in the older machines whose word sizes were multiples of three bits.

### Converting

- **Binary to hex**: split into groups of four from the right and read each from the table. `110101101` becomes `1 1010 1101`, which is hex `0x1AD` (the left group is padded with zeros). Hex to binary is the reverse.
- **Binary to decimal**: add the weights of the bits that are 1. The weights are the powers of two: for a byte, 128, 64, 32, 16, 8, 4, 2, 1. `1010 0101` is 128 + 32 + 4 + 1 = 165.
- **Decimal to binary**: go down the weights, subtracting each one that fits. For 165: 128 fits (37 left), 64 does not, 32 fits (5 left), 16 and 8 do not, 4 fits (1 left), 2 does not, 1 fits. The pattern of “fits” is `1010 0101`. The other way is to divide by 2 repeatedly and read the remainders from the bottom up.
- **How many bits?** *n* bits hold 2ⁿ patterns, so the values 0 to 2ⁿ − 1. A value *N* needs ⌈log₂(*N* + 1)⌉ bits.

Powers of two are worth knowing by heart: 2⁴ = 16, 2⁸ = 256, 2¹⁰ = 1,024 (1 KiB), 2¹⁶ = 65,536, 2²⁰ = 1,048,576 (1 MiB), 2³² = 4,294,967,296.

### Two’s complement

To store negative numbers, hardware uses **:term[two’s complement]{id=twos-complement-ref}**: an *n*-bit pattern is read like an ordinary binary number except that the top bit has weight −2ⁿ⁻¹ instead of +2ⁿ⁻¹. In eight bits the weights are −128, 64, 32, 16, 8, 4, 2, 1. So `1010 0101` is −128 + 32 + 4 + 1 = **−91**, whereas the same bits, read as an unsigned number, are 165. The bits do not know which they are; the *program* (or the instruction) decides, and the same adder does both.

| Bits | Unsigned range | Two’s-complement range |
|---|---|---|
| 4 | 0 to 15 | −8 to 7 |
| 8 | 0 to 255 | −128 to 127 |
| 16 | 0 to 65,535 | −32,768 to 32,767 |
| 32 | 0 to 4,294,967,295 | −2,147,483,648 to 2,147,483,647 |

- **The top bit is the sign**: 1 means negative. It is not a sign *flag* added to a magnitude: it is a digit with a negative weight.
- **To negate a number, invert every bit and add one.** For 91 = `0101 1011`: invert to `1010 0100`, add one to get `1010 0101`, which is −91 as above. Why it works: a number plus its inverted bits is `1111 1111`, which is −1, so the inverse is −1 − *x*, and adding one gives −*x*.
- **The range is lopsided**: there is one more negative number than positive ones. −128 has no positive partner, and negating it gives −128 again.
- **Sign extension**: to widen a signed number, copy the sign bit into the new bits on the left: `1011` (−5 in four bits) becomes `1111 1011` (−5 in eight). To widen an unsigned number, fill with zeros.
- **Addition is the same in both interpretations.** `0x05 + 0xFB` is `0x100`; with the carry dropped it is `0x00`, that is 5 + (−5) = 0. Two flags tell the interpretations apart: the **carry** says an *unsigned* result did not fit, and **overflow** says a *signed* one did not (two positives gave a negative, or two negatives a positive). `0x7F + 0x01 = 0x80` has no carry, but it is an overflow: 127 + 1 is −128. Chapter 14 builds the adder and shows where the two flags come from, and the Octet CPU of Appendix E has both.

::number-converter{n="A.3"}

## Logic levels

A digital input does not compare a voltage with a fixed line; it has two thresholds, and everything between them is undefined. **V**IH is the lowest voltage guaranteed to read as a 1, **V**IL the highest guaranteed to read as a 0. Outputs make a matching promise: a gate driving a 1 delivers at least **V**OH, and one driving a 0 at most **V**OL. The margin between the output promise and the input requirement is the **noise margin** (Chapter 10), and it is what lets a signal pick up a little noise on its way and still be read correctly.

The figures below are guaranteed worst cases from the data sheets and the JEDEC standards, so any part that meets its specification meets them. The 74HC row uses the 5 V supply of the labs; the data sheet gives 4.5 V, where V<sub>IH</sub> = 3.15 V and V<sub>IL</sub> = 1.35 V (70 % and 30 % of the supply), and interpolating the same percentages to 5 V gives 3.5 V and 1.5 V.:cite[ti-sn74hc04] The LVCMOS figures come from JEDEC’s interface standards.:cite[jedec-jesd8c,jedec-jesd8-7a]

::logic-levels{n="A.4"}

Three rules follow from the table.

1. **A 74HCT gate reads TTL and 3.3 V levels; a 74HC gate does not.** A 3.3 V output guarantees only about 3.1 V at light load, less than the 3.5 V a 74HC needs at 5 V. That is what the T in 74HCT is for.
2. **Never drive a lower-voltage input from a higher-voltage output** unless the datasheet says the input is tolerant. A 5 V output on a 3.3 V input exceeds the absolute maximum and current flows through the input’s protection diodes into the supply. Going down needs a resistive divider, a level translator or an open-drain output with a pull-up to the lower supply.
3. **Unused inputs must go somewhere.** A CMOS input has no idea what it is connected to when it is floating and will drift into the forbidden zone, where both output transistors conduct and the chip wastes current. Tie it to the supply or to ground.

## Pinouts of the lab chips

The chips of the *Build it for real* labs are all in DIP packages: two rows of pins 2.54 mm (0.1 inch) apart, the rows 7.62 mm apart, which is what fits across the gap of a breadboard. Hold the chip with the notch (or a dot) at the top; pin 1 is the first pin to the left of the notch, and the numbers run **counter-clockwise**: down the left side, then up the right.

::pinout-gallery{n="A.5"}

Some habits will save you an evening:

- **Power first.** Every 74HC chip has VCC at the top right and GND at the bottom left, except the 555 (GND at pin 1). Check both before anything else. The 74HC family works from 2 to 6 V; use 5 V from the USB supply of the kit. The NE555 needs 4.5 V or more.
- **Decouple.** Put a 100 nF ceramic capacitor between VCC and GND as close to each chip as the breadboard allows. When a gate switches it takes a sudden gulp of current, and without a nearby reservoir the supply rail dips for a few nanoseconds, enough to upset the neighbouring gates.
- **Tie off unused inputs**, as in the previous section. For the 74HC74 that means PRE and CLR high; for the 74HC595, SRCLR high and OE low.
- **The 74HC02 is not laid out like the other three-terminal gates.** The 00, 08, 32 and 86 all share one pinout (input, input, output, three times two, ground, then the second pair), and the 02 has its outputs where the others have inputs.
- **Pin names differ between makers.** The table above follows the Texas Instruments data sheets;:cite[ti-sn74hc-family,ti-ne555] the 74HC595 in particular appears as SH_CP, ST_CP and DS in some catalogues. The pin *numbers* are always the same. When in doubt, look for the data sheet of the exact part number on your chip.
- **Do not exceed the current limits.** A 74HC output may source or sink about 25 mA and a chip about 50 mA in all (Chapter 10), so an LED needs its resistor here as everywhere.
