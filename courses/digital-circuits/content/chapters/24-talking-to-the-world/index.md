---
number: 24
title: Talking to the world
summary: A store to an address lights an LED, dims it, makes a voltage or sends a byte down a wire; a load reads a switch, a voltage or a byte coming back. See how the address decoder does it, how pulses make a dimmer and a converter, how a comparator turns a DAC into an ADC, and how UART, SPI and I²C move bytes down one, three or two wires.
duration: About 3 hours
prerequisites: [running-programs]
---

Everything Octet has done so far has been inside its own 256 bytes. Its only sign of life has been a light, and a light is a good place to start, because the way a program turns one on is the whole story of how it talks to the world.

```quiz
q: 'An Octet program executes ST [0xF8], R0 with R0 = 0x81 (binary 1000 0001). What does the board do?'
options:
  - text: 'It stores 0x81 in RAM at address 0xF8, like any other store.'
    why: 'Addresses 0xF0 to 0xFF are not RAM. The store goes out on the bus like any other, but at that address there is no memory to listen to it.'
  - text: 'It lights LEDs 7 and 0, the leftmost and rightmost, and they stay lit until the next store.'
    correct: true
    why: 'The LEDS register at 0xF8 is a latch on the data bus. A store to that address loads it, and each of its eight bits drives one LED: bit 7 is the one on the left. Nothing else in the CPU is involved: the CPU stored a byte, and something happened to be listening.'
  - text: 'It lights the two LEDs for one clock cycle only, and then they go out.'
    why: 'A store lasts one clock cycle, but the register that catches it holds its value. The LEDs stay lit until a later store changes them.'
  - text: 'Nothing: to use an LED a program needs a special output instruction.'
    why: 'Some CPUs have one (the x86 `out`), but Octet does not. Its devices are in the memory map, which is what makes a plain store enough.'
```

This chapter opens the black box in that answer, and then goes through the ways a program can say something to the physical world and hear something back: by lights and switches, by *how long* a pin is on (which makes a dimmer, and, with a capacitor, a voltage), by voltages that become numbers and numbers that become voltages, and by bytes sent one bit at a time down one, two or four wires.

## An address is a wire

Octet’s CPU has one bus, and every device on it sees every transfer. In a store, the CPU puts an address on eight address wires, the data on eight data wires, and raises a write-enable line, WE. RAM answers when the address is one of its 240 bytes. The other 16 addresses, 0xF0 to 0xFF, belong to the devices: 8 for the LED matrix and one each for the LEDs, switches, buttons, hex display, console, random-number generator, PWM output and DAC and ADC. What decides which device answers is an **address decoder**, a circuit that watches the address wires and raises exactly one *chip select* line. It is the decoder of Chapter 13, used for its real job.

::circuit{src="24-talking-to-the-world/circuits/address-decoder.json" n="24.1" title="An address decoder" mode="logic" speed=1e-6 caption="The eight switches are the address wires, A7 first; it starts at 0xF8. Exactly one lamp is lit, always: change the address to 0x40 (RAM), then 0xF3 (the matrix), then 0xFC (the console). The top four bits all being 1 selects region F: an AND gate for the devices, and its NAND for RAM. Inside the region, a 4-to-16 decoder on the low four bits picks the device."}

The decoder’s output is only half of it. A device that *listens* also needs to know when to load. The LED register is eight flip-flops (the register of Chapter 18) whose clock enable is the chip select for 0xF8 ANDed with WE: they take the byte on the data wires when a store to that address happens, and no other time. A device that *talks*, such as the switches, puts its byte on the data wires (through tri-state drivers, Chapter 10) when its chip select is high and WE is low. That is all there is to memory-mapped I/O, which the reference card calls :term[memory-mapped I/O]{id=memory-mapped-io}: a read or a write of a special address opens a door, and there is no more machinery in the CPU than for RAM.

:::programmer[Device registers are `volatile`]
In C, a device register is a pointer to a fixed address, `#define LEDS (*(volatile uint8_t *)0xF8)`, and `LEDS = 0x81;` is the whole driver. The keyword `volatile` tells the compiler that this is not ordinary memory: a load may return a different value each time (the switches) and a store has an effect even if nothing reads it back (the LEDs), so it must not cache, reorder or delete the accesses. Without it, `while (!(BUTTONS & 1));` is an infinite loop at best, and no code at all at worst.
:::

:::hood[How the interpreter maps the devices]
The reference interpreter does what the decoder does, with a `switch` (`src/lib/sim/cpu/octet/machine.ts`). Below 0xF0 a write goes to the memory array; above, the address picks a device:

```ts
write(address: number, value: number): void {
  const a = address & 0xff;
  const v = value & 0xff;
  if (a < OCTET_MEMORY.ioBase) {
    this.memory[a] = v;
    return;
  }
  const b = this.board;
  switch (a) {
    case OCTET_IO.LEDS:
      return b.writeLeds(v);
    case OCTET_IO.SWITCHES:
    case OCTET_IO.BUTTONS:
      return;
    case OCTET_IO.HEX:
      return b.writeHex(v);
    …
```

A store to the switches is ignored, as it would be by the hardware: nobody is listening. The `read` function has the opposite side effects: reading CONSOLE consumes the character it returns, and reading RANDOM steps the random-number generator, as they would in hardware, where the read itself is what pulses the device’s strobe. That is why the interpreter’s memory view uses `peek`, which looks without touching, and why a program that runs into the device region and *fetches* an instruction from CONSOLE would eat a character.
:::

## Waiting for the world

A program reads a device with a load, and gets the value the device had at that instant. To wait for something, it has to keep asking. The loop that copies the switches to the LEDs asks again and again, and so does the one that waits for a key:

```text
wait:   LD   R0, [BUTTONS]
        LDI  R1, 1          ; BTN0 is bit 0
        AND  R0, R1
        JZ   wait           ; not pressed: look again
```

This is :term[polling]{id=polling}. It costs nothing in hardware and everything in cycles: while it waits, the CPU does nothing else, and each look takes 23 cycles, so a button held for 100 ms is looked at some 4,000 times. The alternative is to let the device *tell* the CPU. A CPU with :term[**interrupts**]{id=interrupt} has an input pin for the request; at the end of the current instruction it saves the program counter (and the flags), jumps to a fixed address and runs a handler, and a return-from-interrupt instruction resumes the program where it left off.

:::note[Octet has no interrupts]
Octet’s instruction set has no interrupt pin, no vector and no return-from-interrupt: the only way to notice a button is to look. That is a real limit, and it shapes every program on the board: the reaction timer of Chapter 23 polls the button between the steps of its timing loop, and a program that must do two things at once has to interleave them in one loop. Adding interrupts would take one input to the control unit’s FSM (Chapter 22), a few states to push PC and jump to a vector, and one more instruction; that is the kind of extension Chapter 31 makes easy to try.
:::

## Buttons, pins and bounce

A :term[**GPIO**]{id=gpio} pin (general-purpose input/output) is a wire with a bit of logic at each end. As an output it is a register bit and a driver: the LEDS register’s eight bits are eight output pins, each with an LED on it. As an input it is a comparator with a threshold, which turns the voltage on the wire into a bit that a load can read. A button is wired the way Chapter 10 taught: a pull-up resistor holds the pin high, and the button pulls it to ground, so the pin reads 1 when the button is open and 0 when it is pressed. (The Octet board’s BUTTONS register inverts that for you: a 1 is a press.)

::circuit{src="24-talking-to-the-world/circuits/gpio-button.json" n="24.2" title="A button on a pin" speed=0.001 window=0.02 traces="PIN" caption="Press and hold the button, and watch the trace of the pin. This button, unlike the ideal ones of earlier chapters, bounces: its contacts touch, spring apart and touch again for a few milliseconds, seeded from the same generator as the rest of the course, so each press is a little different. The pull-up gives 5 V while the contact is open, and 0 V while it is closed. Release it and count the bounces again."}

To a program that reads the pin every 25 µs, those milliseconds of flicker are dozens of presses.

```quiz
q: 'A program counts rising edges of BTN0 (0 to 1). You press the button once, and its contacts bounce for about 3 ms. The loop reads the button every 25 µs. What is the count?'
options:
  - text: '1, since there was one press.'
    why: 'The program cannot know there was one press. It only sees the levels it reads, and during the bounce they go 1, 0, 1, 0, 1 many times faster than a person can press.'
  - text: 'Several: one for every time the contact closes during the bounce.'
    correct: true
    why: 'Every closure that lasts longer than the 25 µs between reads is a rising edge, so the count is 1 plus the number of bounces (contacts typically chatter for 1 to 5 ms). Chapter 17 fixed this in hardware, with a filter and a Schmitt trigger. Software can do it with a timer.'
  - text: '0, because the bounce is too fast to see.'
    why: 'The bounces last from tens of microseconds to a millisecond, and the loop looks every 25 µs. It sees most of them.'
```

The software fix costs nothing but a delay: after an edge, stop looking for longer than the longest bounce, then look again. The board’s button here bounces for 1 to 5 ms, the range that Ganssle measured on real switches,:cite[ganssle-debounce] and the debounced program waits 10 ms after each edge. Try both.

::io-board{title="Count the presses" program="count-naive" n="24.3" caption="Press BTN0 (click and hold, or Space) and release it. The analyser shows the pin, bounce and all; the display counts rising edges. With the board’s seeded bounce one press counts 5 or 6 (it depends on where the program is in its loop when the contact first closes) and the release adds three more. Then choose the debounced program from the list, press Reset, and press again: one press, one count, however long the bounce. Untick BTN0 bounces to see the naive program work perfectly on a perfect button."}

## Dimming with pulses

An LED that is fully on or fully off is easy to drive from a pin. An LED that is *half* bright is not, because a pin does not have a half: it is 0 V or 5 V. And a resistor or a transistor in the middle would burn the difference as heat. The trick is not to change how bright the light is but *how long* it is on. Switch it on for a quarter of every millisecond and off for the rest, and the eye, which does not follow flicker much faster than a few tens of hertz, sees a light a quarter as bright as full. That is :term[pulse-width modulation]{id=pwm}, PWM: a fixed frequency, and a *duty cycle* that says what fraction of each period the output is high.

The hardware is a counter and a comparator. The counter counts round and round, the duty is a number in a register, and the output is high while the count is below the duty:

::circuit{src="24-talking-to-the-world/circuits/pwm-generator.json" n="24.4" title="A PWM generator" mode="logic" speed=0.005 window=0.032 traces="CLK,PWM" caption="A 4-bit counter, a comparator and four switches for the duty (B2 is set: duty 4 of 16 = 25 %). The output goes high at the start of every count of 16 and falls when the count reaches the duty. Set the switches to 1000 (8 of 16, 50 %), then 1100. Octet’s PWM register is the same circuit with 8 bits: the duty is n/256, the period 256 clock cycles."}

A PWM signal is a stream of pulses, and something that *averages* turns it into a voltage. The simplest averager is a resistor and a capacitor, the low-pass filter of Chapter 4: the capacitor charges a little during each pulse and discharges a little between them, and its voltage settles at the average of the pulse train, 5 V × the duty.

::circuit{src="24-talking-to-the-world/circuits/pwm-filter.json" n="24.5" title="PWM through an RC filter" speed=0.02 window=0.06 traces="SRC,OUT" caption="A 1 kHz pulse train of 25 % duty through 1 kΩ and 10 µF, so τ = 10 ms. The output climbs like a charging capacitor and settles at 1.25 V with a small ripple. The voltmeter reads the average."}

```quiz
q: 'A 5 V pin is high for 25 % of every millisecond and low the rest. It drives 1 kΩ and 10 µF as above. What will a multimeter, with a slow reading, show across the capacitor?'
options:
  - text: '5 V, since the pin is high for part of the time.'
    why: 'The pin is high a quarter of the time. The capacitor smooths the pulses, so it settles at their average, not their peak.'
  - text: 'About 1.25 V, with a small ripple.'
    correct: true
    why: 'The average of the pulses is 25 % of 5 V. The time constant is 1 kΩ × 10 µF = 10 ms, ten periods, so the capacitor barely moves within one pulse: a ripple of 5 V × 0.25 × 0.75 / (1 kHz × 10 ms) = 0.094 V.'
  - text: '0 V, since it is low most of the time.'
    why: 'The capacitor stores charge from every pulse and loses it only through the resistor, slowly. It settles at the average.'
  - text: 'It flickers between 0 and 5 V, which the meter averages to 2.5 V.'
    why: 'The capacitor prevents the flicker. And the average of 0 and 5 V would be 2.5 V only for a duty of 50 %.'
```

::pwm-lab{n="24.6" caption="Drag the duty and the average follows it. Choose 100 Hz with 1 µF (τ = 1 ms, only a tenth of a period): the output follows the pulses almost to the rails, no filter at all. Choose 10 kHz with 10 µF: ripple below a millivolt. Then press From power-on and watch the capacitor charge like 1 − e^(−t/τ) towards the average before it settles."}

:::lab[Dim it by hand]
1. Set the lab to 25 % at 1 kHz and 10 µF. The average is 1.25 V, and the ripple 0.09 V. Drag the duty to 75 %: the average follows, and the ripple is the same.
2. Press *From power-on*. The capacitor charges like 1 − e^(−t/τ): after one time constant, 10 ms, it has reached 63 % of the way to the average.
3. Move to 10 kHz and 10 µF. The ripple falls by a factor of ten, since it is proportional to 1/*f*. Now 1 kHz with 1 µF: the ripple grows about tenfold, since it is also proportional to 1/τ (only roughly, because τ is now just one period).
4. Choose 100 Hz with 1 µF. The filter no longer averages: τ is a tenth of a period. It is the picture of a filter that is too small.
:::

:::deeper[Where the ripple estimate comes from]
Let the filter settle at its average, V<sub>avg</sub> = *D*·V. During the high part of a period, of length *DT*, the capacitor is charged through R from V toward V; it gains about (V − V<sub>avg</sub>)·*DT*/τ, provided τ is long against *T* so that the rate hardly changes. During the low part, of length (1 − *D*)*T*, it loses V<sub>avg</sub>·(1 − *D*)*T*/τ. In a steady state these are equal (both come to V·*D*(1 − *D*)*T*/τ), and that common amount is the peak-to-peak ripple:

ripple ≈ V · *D*(1 − *D*) / (*f* τ).

It is largest at 50 % duty, falls in proportion to the frequency and to the capacitor, and is what the lab shows: at 1 kHz, 10 µF and 25 % it is 0.094 V, and at 10 kHz it is ten times less. (The estimate fails when τ is not long against the period, which the lab’s 100 Hz and 1 µF setting shows.)
:::

The LED needs no filter, only the eye. On the Octet board the PWM pin is high while an 8-bit counter, counting clock cycles, is below the PWM register. Run the program that raises the register from 0 to 255 and back:

::io-board{title="A breathing LED" program="pwm-fade" n="24.7" caption="The analyser shows the PWM pin over 1.5 ms, about six periods of 256 µs. As the register rises the pulses widen; the LED below is as bright as the average. Zoom the analyser out to 4× and step the clock speed down to 10 kHz to watch the duty change from period to period."}

The same idea is used to drive a display of many LEDs from few pins. An 8 × 8 LED matrix has 64 LEDs but 16 pins: the row and column wires. To light a picture, the hardware lights one row at a time, very quickly, with the columns of that row’s pattern, and moves to the next row. Each row is lit for an eighth of the time, so the eye averages it, with the same trade as PWM: eight times the current in each pulse for the same brightness. This is *multiplexing*, and the board’s matrix registers, which hold a whole picture, are what the scanning hardware reads.

## From numbers to voltages

PWM makes a voltage from a duty cycle, slowly. A :term[**digital-to-analogue converter**]{id=dac} (DAC) makes one at once: it takes a number and puts the corresponding voltage on a wire. The obvious circuit is a set of resistors, one per bit, so that bit *k* contributes a current 2<sup>*k*</sup> times bigger than bit 0: R, R/2, R/4, and so on. It works, but the resistors must be accurate to better than one part in 2<sup>*n*</sup>, and an 8-bit DAC needs a resistor of R/128. The **R-2R ladder** does the same with two values only:

::circuit{src="24-talking-to-the-world/circuits/r2r-dac.json" n="24.8" title="A 4-bit R-2R ladder DAC" speed=1 caption="Each switch puts 0 V or 5 V on its 2R resistor; the voltmeter reads the ladder’s output, the MSB end. Set 1000: 2.5 V. Set 0100: 1.25 V; 0001: 0.3125 V. Then predict 1011 before you set it (11/16 of 5 V = 3.4375 V). The output is always 5 V × code / 16."}

Why does it work? Look into the ladder from any node towards the LSB end: you always see 2R to ground, the terminating resistor alone at the last node, and at every other node the 2R of the switch in parallel with the rest of the ladder, R + 2R, which together are 2R again. Every node therefore has two equal 2R paths, so a signal that crosses one rung of the ladder loses exactly half its voltage, and the bit that is one rung further away counts half as much. Each bit is worth half the one above it, which is what a binary number is.:cite[horowitz-hill2015] Octet’s DAC register makes 256 levels of 5/256 = 19.5 mV. A program that writes it steadily upwards makes a staircase:

::io-board{title="A wave from software" program="triangle" n="24.9" caption="The triangle program counts up 0 to 255 and back, storing every value in the DAC register. The analyser draws the DAC pin in volts: 256 steps of 19.5 mV, too fine to see, which is the point. Zoom in to 1× on a short window by choosing ½× a few times, or slow the clock: each step is a store, 16 cycles of the loop. The waveform’s period is 9.7 ms, about 100 Hz."}

:::history{year=1937 title="Pulse-code modulation" people="Alec Reeves" source="Sources: Engineering and Technology History Wiki, Pulse Code Modulation; IEEE-USA InSight; Wikipedia, Alec Reeves."}
In 1937, in ITT’s Paris laboratory, Alec Reeves worked out how to send speech as numbers.

A telephone line adds noise to a voltage; noise on a number can be removed, since a pulse is either there or it is not. Reeves proposed to measure the voltage of the speech at regular instants (sampling), round each measurement to one of a fixed number of levels (quantising), and send the number for each as a group of pulses, which is a DAC’s input turned into a stream. He filed a French patent for it in 1938.:cite[ethw-pcm] No equipment was built at the time; the transistors and switching circuits that could do it did not exist, and the method was first used in earnest in the 1960s telephone network. Every ADC and DAC in this chapter is a version of his two steps: an ADC samples and quantises, and a DAC turns the numbers back into a voltage.
:::

## From voltages to numbers

The opposite job is harder. An :term[**analogue-to-digital converter**]{id=adc} (ADC) must decide what number a voltage is, and the only instrument that a digital circuit has for that is the :term[comparator]{id=voltage-comparator}: two inputs, and an output that says which is higher. But a comparator plus the DAC you just built is enough. Put a guess on the DAC, and ask the comparator whether the input is above it.

::circuit{src="24-talking-to-the-world/circuits/sar-adc.json" n="24.10 " title="A comparator, a DAC and an unknown voltage" speed=1 caption="The unknown input Vin, at the top right, is 3.5 V. The lamp lights when Vin is above the DAC’s output, Vdac. Find the code by flipping switches, like a game of higher or lower: try 1000 (2.5 V), and keep the bit if the lamp is lit; then try the next bit down. You need only four guesses. Which code do you land on?"}

```quiz
q: 'A 4-bit converter has a 5 V full scale and an input of 3.5 V. Guessing from the top bit down and keeping a bit whenever the input is still above the DAC, how many guesses does it take, and what is the result?'
options:
  - text: '16 guesses, one for every code: the answer is 11.'
    why: 'That is a *counting* converter, which counts up until the DAC passes the input, and it needs as many guesses as the answer. The binary search does not need to try every code.'
  - text: '4 guesses, and the answer is 1011 = 11.'
    correct: true
    why: 'Try 1000 = 2.5 V: the input is above, keep the bit. Try 1100 = 3.75 V: the input is below, drop it. Try 1010 = 3.125 V: above, keep. Try 1011 = 3.4375 V: above, keep. Four guesses, one per bit, and 1011 = 11, the number of whole steps of 0.3125 V below 3.5 V.'
  - text: '4 guesses, and the answer is 1100 = 12, because the input rounds up.'
    why: 'The search finds the largest code whose voltage is still below the input, so it rounds *down*. 12 would be 3.75 V, above the input.'
  - text: '2 guesses, since the answer is close to the middle.'
    why: 'Every bit needs a guess, however close the input is to a code. The search cannot know what the next bit is without asking.'
```

This is the :term[**successive-approximation ADC**]{id=sar}, and the register that runs the search is called a SAR: it tries the top bit alone, keeps it if the comparator says the input is still above the DAC, and then does the same for the next bit down. It is binary search on the answer, so an *n*-bit conversion takes *n* comparisons rather than 2<sup>*n*</sup>: 8 for a byte instead of 255. Most microcontroller ADCs work this way.

::sar-adc{n="24.11" caption="The analogue half is real: an R-2R ladder and a comparator, solved by the analogue engine every time a bit is set. Slide the input voltage, press Next step, and follow the search. The dashed line is Vin; each dot is the DAC voltage of one guess, green if Vin was above it (keep the bit) and red if below (drop it). Switch to 8 bits: the same search, twice the steps. Try an input just above a code’s voltage, such as 2.5 V and then 2.51 V."}

Octet’s board has the two halves and no register to run them: the DAC (write to 0xFF), and a comparator whose output is bit 7 of BUTTONS. The comparator is 1 when the analogue input is *above* the DAC’s output. The search is a program: for each bit from the top, set it in a trial value, write the trial to the DAC, read the comparator, keep the bit if the answer was 1. One detail is easy to get wrong. The comparator says “above”, not “above or equal”, so if the input is exactly the trial value the bit is dropped, and the search stops one short of an exact match. The last step is to write the result to the DAC and ask once more.

## One wire at a time

A byte has eight bits, and the simplest way to send it is on eight wires. That works on a board and fails at a distance: eight wires cost eight pins on each chip and eight conductors in each cable, and the signals must arrive together, though they drift by different amounts. A **serial** link sends the bits one after another on one wire, and pays in time. There are three common ways to do it, which differ in what they do about the question that every serial link has to answer: *when is a bit?*

### UART: agree on a speed

A :term[UART]{id=uart} has no clock wire. Sender and receiver agree beforehand on a bit time (the :term[*baud rate*]{id=baud}), and the line idles high. A frame begins with a **start bit**, the line going low, which tells the receiver to start its own timer; it then samples the line in the middle of each bit time: eight data bits, least significant first, and a high **stop bit** that returns the line to idle. That is “8N1”: 8 data bits, no parity, 1 stop bit. The frame for the letter A, 0x41, is 0 1 0 0 0 0 0 1 0 1 with start bit first, and it takes 10 bit times; at 9600 baud, 1.04 ms.

:::history{year=1874 title="The baud" people="Émile Baudot" run="Run the original" source="Sources: Britannica, Jean-Maurice-Émile Baudot; Wikipedia, Baud."}
The unit of signalling speed is named after a telegraph engineer, and a UART’s frame is his idea in a modern form.

In 1874 Émile Baudot, of the French telegraph service, patented a telegraph code in which every character was a combination of five signals of equal duration, on or off: 32 combinations, enough for the alphabet and the machine’s control functions.:cite[britannica-baudot] Equal-length signals meant a machine, not a person with a key, could send and receive, and that a receiver only needed to know the length of one signal. The number of signal changes per second in such a line came to be called the *baud*.:cite[wiki-baud] A UART is the same arrangement in silicon: equal-length bits, an agreed speed, and a start signal so that the receiver can find the first one.
:::

::::run-original{title="The baud"}
::circuit{src="24-talking-to-the-world/circuits/uart-tx.json" n="24.12" title="A UART frame, from gates" mode="logic" speed=1e-3 window=2e-3 traces="CLK,TX" caption="A 4-bit counter steps through the 16 positions of a frame at 9600 Hz, one bit time each: position 0 is the start bit (0), positions 1 to 8 are the data bits D0 to D7 (through a multiplexer), and positions 9 to 15 are the stop bit and idle (1). A flip-flop cleans up the multiplexer’s output. The switches hold 0x41, the letter A: click them to send another byte. The trace shows the frame."}
::::

The receiver has no clock wire, only the *edges* of the data, so its timer runs from the falling edge of the start bit and drifts until the next start bit: a stop bit every ten bit times lets it resynchronise. Two ends whose clocks differ by more than about 5 % will get the frame wrong, and a receiver at the wrong baud rate gets garbage rather than an error: try it.

::serial-lab{protocol="uart" n="24.13" caption="Type a message. The transmitter puts its frames on the wire; the receiver decodes them with its own settings, and the boxes under the waveform are what it read. Set the receiver to 4800 baud, or to 8E1 (a parity bit that the transmitter does not send), and see the decode go wrong, or flag framing errors. “find it” makes the receiver measure the shortest pulse and work out the baud rate itself, which works for ordinary text."}

:::history{year=1960 title="RS-232" people="Electronic Industries Association" source="Sources: Wikipedia, RS-232; Analog Devices, Fundamentals of RS-232 Serial Communications."}
The UART’s wires were standardised before anyone put one on a chip.

The Electronic Industries Association first published Recommended Standard 232 on 1 May 1960, to connect a terminal to a modem, and the version of 1969, RS-232-C, stayed in use for decades.:cite[wiki-rs232] Its signal levels were nothing like logic’s: a 1 is a voltage between −3 V and −15 V and a 0 is between +3 V and +15 V, so the line can carry a signal over a long cable and survive the noise, and a chip has to translate to and from 0 and 5 V.:cite[adi-rs232] Modern boards leave the wire out and connect the UART’s 0/5 V pins straight to a USB adapter, but the frame format is 1960’s.
:::

Octet has no UART. It has pins and time, which is enough: a program can make the frame itself, by writing to a pin at exactly the right moments. It is called :term[*bit-banging*]{id=bit-banging}, and needs a subroutine and an exact count of clock cycles. Here the program sends “Hi!” on LED 0, one bit every 104 cycles (at the board’s 1 MHz that is 9615 baud, within 0.2 % of 9600). Between stores the code has to take exactly 104 cycles on every path, so the shorter paths are padded with NOPs. The analyser is attached to LED 0 and decodes the frames.

::io-board{title="The board and its analyser" program="uart" n="24.14" caption="Press Run: the program sends H, i and ! on LED 0, and the analyser shows the last 4.5 ms of the pin with the UART decoder’s boxes underneath, and the terminal below spells what they decode to. Slow the clock to 10 kHz to watch the bits go by. Open the source, and change a padding NOP or the wait loop: the frames get longer or shorter, and the decode goes wrong when the bit time drifts away from 104 cycles. Choose other programs from the list to see the PWM pin, the DAC, and the button on the same analyser."}

:::hood[The decoder]
The decoders of this chapter (`widgets/protocols.ts`) are what a bench analyser runs: they read a recording, one row per change of any pin, and return boxes. The UART decoder finds a falling edge on an idle line, checks that the line is still low in the middle of the start bit, and then samples in the middle of each bit:

```ts
for (let i = 0; i < n; i++) {
  const bit = isHigh(levelAt(s, e.t + T * (1.5 + i))) ? 1 : 0;
  byte |= bit << i;
  ones += bit;
}
…
const framingError = !isHigh(levelAt(s, e.t + T * (k + 0.5)));
```

`T * (1.5 + i)` is the middle of data bit *i*: the start bit is the first bit time, and the sample is half a bit time into the bit. A stop bit that is not high is a framing error. Without a given baud rate the decoder takes *T* to be the shortest time between two edges in the recording, which is one bit time for any ordinary data. The same recordings feed the SPI and I²C decoders, and the tests decode what the circuits of this chapter put on their wires, as well as generated waveforms, and check that a wrong baud rate, a wrong SPI mode or a wrong parity setting is never quietly right. The decoders implement the bench’s `Decoder` interface, so the logic analyser instrument (`src/lib/bench/instruments`) offers them too once the chapter has loaded them.
:::

### SPI: send the clock too

If the receiver could see *when* each bit is, the two ends would not need to agree on a speed. **SPI** (:term[Serial Peripheral Interface]{id=spi}) adds a clock wire: the sender changes the data on one edge of the clock and the receiver samples it on the other, so the receiver never has to guess a bit time. It has four wires: SCK (the clock), MOSI (controller out, peripheral in), MISO (the other way) and a chip select CS for each peripheral, pulled low for the duration of a transfer. Bits go out at the same time in both directions, so a transfer exchanges a byte in each direction. The speed is whatever the slower end can do, and there are four *modes*, from the clock’s idle level (CPOL) and which edge samples (CPHA); both ends must use the same one.

The register in the circuit below is what a 74HC595 is: a shift register that takes a bit for every rising edge of SCK, and a storage register that copies all eight bits to the outputs on the rising edge of a second clock, which we connect to the chip select. The controller is a counter and a multiplexer, the same trick as the UART transmitter, and it runs the clock only while CS is low.

::circuit{src="24-talking-to-the-world/circuits/spi-595.json" n="24.15" title="An SPI controller and a 74HC595" mode="logic" speed=2e-6 window=40e-6 traces="CLK,CS,SCK,MOSI" caption="The switches D0 to D7 hold the byte 0xA5. Watch the trace: CS falls, eight pulses of SCK carry the bits, most significant first, and when CS rises the storage register copies the byte to the eight lamps Q7 to Q0. Change a switch in the middle of a transfer: the lamps do not change until the next latch."}

::serial-lab{protocol="spi" n="24.16" caption="Set the bytes to send and the controller’s mode, and the receiver’s: with the same mode the receiver reads exactly what was sent, on both wires, at once. Set the receiver to a different mode and the decoded bytes are wrong, without any error: the receiver samples the data just as it changes. SPI has no acknowledgement, and no way to know."}

### I²C: two wires, many devices

SPI needs a chip-select wire for every peripheral. **I²C** (:term[“I squared C”]{id=i2c}) puts everything on two wires shared by every device: SCL, the clock, and SDA, the data, and gives each device an *address* instead. A transaction begins with a START, a falling SDA while SCL is high (data never changes while the clock is high, except here, which is what makes it a marker), then an address byte (seven bits and a read/write bit); the device with that address pulls SDA low during a ninth clock, the **acknowledge**, and then data bytes follow, each acknowledged the same way. A STOP, a rising SDA with SCL high, ends it.:cite[nxp-i2c]

The wires are shared, so nobody can drive them high: two devices that disagreed would short the supply through each other. Both wires are **open-drain**: every device can only pull the line down, through a transistor, and a pull-up resistor lifts it when everyone lets go. The wire is therefore the AND of all the devices (Chapter 10’s wired-AND), and that is what lets a device acknowledge: it pulls down a line the controller has released. The price is speed. The line rises through the pull-up resistor into the capacitance of the wire and all the inputs, an RC charging curve, while it falls through a transistor, fast.

::circuit{src="24-talking-to-the-world/circuits/i2c-bus.json" n="24.17" title="An I²C line" speed=1e-6 window=20e-6 traces="SDA,in_MASTER,in_SLAVE" caption="A 4.7 kΩ pull-up and 200 pF of bus capacitance (a few devices and some wire), with two open-drain drivers. Switch the master on and off, then the device: the line is high only when neither is pulling it down. Watch the edges: it falls almost at once, and rises like a capacitor charging. From 30 % to 70 % of 5 V takes about 0.85 R C = 0.8 µs, inside the 1,000 ns that the specification allows at 100 kHz."}

:::history{year=1982 title="Two wires for a television" people="Philips Semiconductors" source="Sources: NXP, UM10204 I²C-bus specification; Wikipedia, I²C."}
The bus that connects most of the small chips in a phone or a monitor began with televisions.

It was developed at Philips in the early 1980s for the chips inside its television sets, which needed to talk to one another with two wires instead of a bundle, and the first parts that spoke it came out in 1982, at 100 kbit/s and with 7-bit addresses.:cite[wiki-i2c] A specification was first published in 1992, with a 400 kbit/s fast mode and 10-bit addresses, and the maximum rise time of 1,000 ns at 100 kHz and 400 pF of bus capacitance are still in the current one.:cite[nxp-i2c]
:::

::serial-lab{protocol="i2c" n="24.18" caption="A write of two bytes to the device at 0x48: START, the address and a W, then an ACK from the device after each byte, and STOP. Change the direction to read: the device sends the bytes, and the controller acknowledges all but the last, which it NACKs to say it has had enough. Untick “present on the bus”: nobody pulls SDA low in the ninth clock, so the address gets a NACK, drawn in red, and the controller gives up."}

## Write programs

Four short programs for the board, each with tests on its inputs and outputs. The first three are polling programs: they read a device and act on it. The last is the successive-approximation converter, which you can then compare with the one on the board above.

```asm
id: io/wait-button
title: Wait for the button
isa: octet
prompt: |
  Wait until **BTN0** is pressed, then copy the eight switches to the LEDs and stop. While BTN0 is not pressed the program must keep waiting: pressing another button (BTN1 to BTN3) must not release it. Remember that the BUTTONS register also has bit 7 (the comparator) and bits 1 to 3 (the other buttons): you must look at bit 0 only.
hints:
  - 'BUTTONS is a byte, and BTN0 is its lowest bit. AND it with 1 and the answer is 0 or 1.'
  - 'A loop that reads, masks and jumps back while the result is zero is polling.'
explain: |
  Mask the byte with 1: `AND` leaves a 0 or a 1, and sets Z, so `JZ` loops while the button is up. Without the mask, a press of BTN1 or the comparator bit would release the wait. After it, the switches are read once and copied: reading is a load, writing a store.
start: |2
  ; Wait for BTN0, then LEDS <- SWITCHES.
          HLT
tests:
  - { name: "BTN0 pressed: copy the switches", setup: { buttons: 1, switches: 0x5a }, expect: { leds: 0x5a } }
  - { name: "all four buttons pressed", setup: { buttons: 15, switches: 0xc3 }, expect: { leds: 0xc3 } }
  - { name: "no button: keeps waiting", setup: { buttons: 0, switches: 0x5a }, expect: { halted: false, leds: 0 } }
  - { name: "only BTN1: keeps waiting", setup: { buttons: 2, switches: 0x5a }, expect: { halted: false, leds: 0 } }
solution: |2
  wait:   LD   R0, [BUTTONS]
          LDI  R1, 1
          AND  R0, R1         ; BTN0 alone
          JZ   wait
          LD   R0, [SWITCHES]
          ST   [LEDS], R0
          HLT
```

```asm
id: io/popcount
title: How many switches are on?
isa: octet
prompt: |
  Count how many of the eight switches are on and show the count (0 to 8) on the hex display, as the single value written to HEX.
hints:
  - 'Read the switches once into a register. Then look at one bit at a time: SHR puts the lowest bit in the carry flag.'
  - 'After SHR R0, JNC skips the counting when the bit was 0. Stop when R0 becomes 0, so that leading zeros cost nothing.'
  - 'OR R0, R0 sets Z from R0 without changing it: a way to ask “is it zero?”.'
explain: |
  A loop that shifts the byte right until it is zero, adding the carry each time: at most eight rounds, and fewer when the high bits are 0. This is the *population count*, which many CPUs have as one instruction (Octet has not).
start: |2
  ; HEX <- the number of switches that are on.
          HLT
tests:
  - { name: "none", setup: { switches: 0 }, expect: { hex: 0 } }
  - { name: "all", setup: { switches: 255 }, expect: { hex: 8 } }
  - { name: "A5", setup: { switches: 0xa5 }, expect: { hex: 4 } }
  - { name: "only the top one", setup: { switches: 0x80 }, expect: { hex: 1 } }
  - { name: "7F", setup: { switches: 0x7f }, expect: { hex: 7 } }
solution: |2
          LD   R0, [SWITCHES]
          LDI  R1, 0          ; the count
  loop:   OR   R0, R0
          JZ   done           ; nothing left to shift
          SHR  R0             ; C = the lowest bit
          JNC  loop
          INC  R1
          JMP  loop
  done:   ST   [HEX], R1
          HLT
```

```asm
id: io/upper
title: Shout
isa: octet
prompt: |
  Read the characters typed on the console until there are no more (CONSOLE reads **0** when nothing is waiting), and print each one back in **capital letters**: `a` to `z` become `A` to `Z`, everything else is printed unchanged. Then stop.
hints:
  - 'A lower-case letter is 32 more than the capital: in ASCII, `a` is 97 and `A` is 65.'
  - 'A letter is between ''a'' and ''z''. CMP R0, R1 with R1 = ''a'' sets C when R0 is below it; with ''z'' + 1 it sets C when R0 is a letter or below.'
  - 'Reading CONSOLE consumes the character, so read it once per turn and keep it in a register.'
explain: |
  Compare with 'a', and with 'z' + 1: a character in between is a lower-case letter, and 32 is subtracted from it. Note the test on `{`, which comes just after `z` in ASCII and must be left alone.
start: |2
  ; Print what is typed, in capitals.
          HLT
tests:
  - { name: "hello", setup: { input: "hello" }, expect: { console: "HELLO" } }
  - { name: "mixed", setup: { input: "Hello, World! 42" }, expect: { console: "HELLO, WORLD! 42" } }
  - { name: "nothing", setup: { input: "" }, expect: { console: "" } }
  - { name: "just outside the letters", setup: { input: "@`az{[" }, expect: { console: "@`AZ{[" } }
solution: |2
  loop:   LD   R0, [CONSOLE]
          OR   R0, R0
          JZ   done
          LDI  R1, 'a'
          CMP  R0, R1
          JC   print          ; below 'a': leave it
          LDI  R1, 'z' + 1
          CMP  R0, R1
          JNC  print          ; above 'z': leave it
          LDI  R1, 32
          SUB  R0, R1         ; a lower-case letter: make it a capital
  print:  ST   [CONSOLE], R0
          JMP  loop
  done:   HLT
```

```asm
id: io/sar
title: A successive-approximation ADC
isa: octet
prompt: |
  The analogue input is a voltage that the test sets. The board has a DAC (a store to **DAC**, 0xFF, sets its output to n/256 of 5 V) and a comparator (bit 7 of **BUTTONS**, 1 when the input is *above* the DAC’s output). Using them, find the input as a number from 0 to 255 by binary search, and leave it in **R0**. (Reading the ADC register directly would pass the tests, and would miss the point.)
hints:
  - 'Try the top bit first: put 0x80 on the DAC and read the comparator. If it says “above”, keep the bit. Then try the next bit down, with the bits you have kept so far.'
  - 'Bit 7 of a byte is the N flag after `OR R3, R3`, so `JNN` skips a step when the comparator says 0.'
  - 'The comparator says “above”, not “above or equal”. An input equal to the trial makes it drop the bit, so after the eight steps you may be one short. Write the result to the DAC and ask the comparator one last time.'
explain: |
  The loop tries each bit from 0x80 down, keeping it when the comparator says the input is above the trial value. Because the comparator is strict, the result is the input minus one for any input above zero, and 0 for an input of 0 or 1: a last comparison, of the result itself, adds the missing one. This is exactly what the board’s program does, and what a hardware SAR does in its last cycle.
start: |2
  ; R0 <- the analogue input, by binary search with the DAC and the comparator.
          HLT
tests:
  - { name: "0", setup: { adc: 0 }, expect: { regs: { R0: 0 } } }
  - { name: "1", setup: { adc: 1 }, expect: { regs: { R0: 1 } } }
  - { name: "100", setup: { adc: 100 }, expect: { regs: { R0: 100 } } }
  - { name: "127", setup: { adc: 127 }, expect: { regs: { R0: 127 } } }
  - { name: "128", setup: { adc: 128 }, expect: { regs: { R0: 128 } } }
  - { name: "200", setup: { adc: 200 }, expect: { regs: { R0: 200 } } }
  - { name: "254", setup: { adc: 254 }, expect: { regs: { R0: 254 } } }
  - { name: "255", setup: { adc: 255 }, expect: { regs: { R0: 255 } } }
solution: |2
          LDI  R0, 0          ; the result so far
          LDI  R1, 0x80       ; the bit being tried
  try:    MOV  R2, R0
          OR   R2, R1         ; the trial value
          ST   [DAC], R2
          LD   R3, [BUTTONS]
          OR   R3, R3         ; N = bit 7 = the comparator
          JNN  next           ; below the DAC: drop the bit
          MOV  R0, R2         ; above it: keep the bit
  next:   SHR  R1
          JNZ  try
          ST   [DAC], R0      ; the comparator is strict: one last comparison
          LD   R3, [BUTTONS]
          OR   R3, R3
          JNN  done
          INC  R0
  done:   HLT
```

::io-board{title="One answer, on the board" program="sar" n="24.19" caption="The board’s own version of the last exercise, for comparison. Move the analogue input, press Reset and Run, and watch the analyser: the DAC steps towards the input in eight moves, each half the size of the one before, and the hex display shows the result."}

:::challenge[Make the board play a tune]
Octet’s DAC and a loop can make a musical note: write a square wave to the DAC (0 and 255, alternately) with a delay in between, and connect the DAC to the analyser to measure the frequency. At the board’s 1 MHz clock a delay of *k* turns of a 10-cycle loop gives a half-period of about 10*k* µs. Make a 440 Hz A (a half-period of 1.14 ms: about 113 turns), and then a program that plays the scale by looking up the delay of each note in a table. How accurate is the pitch, and what limits it? (Every instruction takes a whole number of cycles, so the delay has a granularity; think about which note’s pitch is worst.)
:::

## Build it for real

:::real{parts="Arduino Uno (or any 5 V board), 74HC595, 8 × LED, 8 × 330 Ω, 100 nF capacitor, 8-channel USB logic analyser (24 MHz, sigrok-compatible), sigrok PulseView, breadboard, jumper wires"}
**A 74HC595 on SPI, watched by a logic analyser.** The shift register of Figure 24.15 is a real chip, and the Arduino’s SPI hardware is a real controller. Wire the 595 (check the pin numbers against the datasheet)::cite[nexperia-74hc595] VCC (pin 16) to +5 V with the 100 nF capacitor from VCC to ground next to it, GND (pin 8) to ground, output enable OE̅ (13) to ground, and clear SRCLR̅ (10) to +5 V. Data SER (14) goes to Arduino pin 11 (MOSI), the shift clock SRCLK (11) to pin 13 (SCK), and the storage clock RCLK (12) to pin 10, which will be the chip select. The eight outputs QA to QH (pins 15 and 1 to 7) each go through a 330 Ω resistor to an LED to ground. This sketch shifts a single lit LED along the row:

```text
#include <SPI.h>
const int LATCH = 10;
void setup() { pinMode(LATCH, OUTPUT); SPI.begin(); }
void loop() {
  for (int i = 0; i < 8; i++) {
    SPI.beginTransaction(SPISettings(500000, MSBFIRST, SPI_MODE0));
    digitalWrite(LATCH, LOW);
    SPI.transfer(1 << i);
    digitalWrite(LATCH, HIGH);      // the rising edge copies the byte to the outputs
    SPI.endTransaction();
    delay(100);
  }
}
```

Now clip the analyser’s channels 0, 1 and 2 to pins 13, 11 and 10 (and its ground to the Arduino’s), and open PulseView. Select the analyser, set the sample rate to at least 2 MHz (four times the 500 kHz clock or more), and start a capture. Add the **SPI** decoder with clock D0, MOSI D1 and chip select D2: it shows the bytes 0x01, 0x02, 0x04 … as boxes, the same as Figure 24.16. Then move the same probes to the Arduino’s TX pin (pin 1) with `Serial.begin(9600); Serial.println("Hi!");` in a sketch, add the **UART** decoder at 9600 baud, and read the letters. If they come out wrong, change the baud rate in the decoder: that is the experiment of Figure 24.13 on real wire.:cite[sparkfun-pulseview]
:::

:::real{parts="8 × 10 kΩ, 9 × 20 kΩ (or 2 × 10 kΩ each), 5 V USB supply module, multimeter, breadboard, jumper wires"}
**An R-2R DAC with resistors.** Build Figure 24.8 with 10 kΩ for R and 20 kΩ (two 10 kΩ in series) for 2R, from a 5 V supply: the four bits are four jumper wires you move between +5 V and ground. Measure the output with the multimeter for all sixteen codes, and compare with 5 V × code / 16. Resistors of 1 % tolerance keep the four-bit steps within a few millivolts; the multimeter’s 10 MΩ input loads the ladder by a part in a thousand. Which code’s step is the worst?
:::

## What’s next

The Octet now has a datapath, a control unit, programs and a body: its own pins and buses and the ability to talk over wires. But everything so far has run in a simulator on your screen, and one tool has been missing: a way to put *your* CPU onto a chip. Part VI begins with the smallest chips that can be configured: a ROM that holds a truth table in fuses, and the programmable logic arrays that evolved from it. They are the first devices in this course that the reader programs, and the road that ends in Chapter 31, where the Octet you built runs on a virtual FPGA and, with the same design, on a real one.
