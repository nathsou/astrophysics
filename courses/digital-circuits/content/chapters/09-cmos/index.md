---
number: 9
title: CMOS
summary: Pair every switch that pulls an output up with one that pulls it down, so that exactly one of them is ever on. The result is a gate that draws no current while it holds a value, a way to turn any Boolean expression into transistors, and a switch that can pass a level.
duration: About 1½ hours
prerequisites: [the-transistor]
---

Chapter 8 ended with an inverter that works and a power bill that does not. Whenever the RTL inverter’s output is low, 5 mA flows from the supply through the pull-up resistor: 25 mW, spent on nothing but keeping a wire at 0 V. Scale that up. A modern processor has ten billion transistors or more, which is several billion gates. If half of four billion gates sat with their outputs low, each burning 25 mW, the chip would dissipate 50 MW, the output of a small power station, and your phone would be it.

The last paragraph of Chapter 8 already named the cure: make the pull-up a transistor too, one that is on exactly when the pull-down is off. Then the supply is never joined to ground through the gate, except for the instant that the gate switches. That idea is called **CMOS**, for :term[complementary metal–oxide–semiconductor]{id=cmos}, and it is what almost every digital chip made today is built from. This chapter builds the idea up from a single transistor, finds the rule that makes every CMOS gate work, and ends with a program that applies the rule for you: type a Boolean expression and it draws the transistors.

## Two kinds of switch

Chapter 6 showed that switches in series compute AND and switches in parallel compute OR, but that no arrangement of switches computes NOT, because every switch conducts *more* when it is closed. NOT needed a relay, with a normally-closed contact that conducts when its coil is off.

The MOSFET of Chapter 8 comes in two versions, and the second is that normally-closed contact.

- The **n-channel** transistor (:term[nMOS]{id=nmos}) is the one you met: electrons carry the current, and it conducts when its gate is a threshold voltage *above* its source. Gate high, switch on.
- The **p-channel** transistor (:term[pMOS]{id=pmos}) is its mirror image. The silicon is doped the other way round, holes carry the current, and it conducts when its gate is a threshold voltage *below* its source. With the source on the +5 V rail, a gate at 0 V is 5 V below the source and the channel forms; a gate at 5 V is level with the source and it does not. Gate low, switch on.

| | nMOS | pMOS |
|---|---|---|
| Conducts when the gate is | 1 (high) | 0 (low) |
| Carriers | electrons | holes |
| Its source sits at | the low end (ground side) | the high end (+5 V side) |
| At the same size, drive current | 1 | about ½ |

Neither kind takes a steady current at its gate (Chapter 8), so either can drive the gates of others. The last row is a fact about silicon, not about the design, and it will matter twice before the chapter is over: holes are slower than electrons. The :term[mobility]{id=mobility} of a charge carrier is its drift speed per unit of electric field. In lightly doped silicon it is about 1,400 cm/s for every V/cm for an electron and about 450 for a hole, three times less.:cite[sze2007] In the thin layer under a transistor’s gate the gap is smaller, and a p-channel transistor of the same size as an n-channel one carries roughly half the current.:cite[weste-harris2011] The simulator’s defaults say the same: an nMOS has *k* = 0.02 A/V² and a pMOS 0.01.

:::history{year=1959 title="A field-effect transistor that worked" people="Mohamed Atalla, Dawon Kahng" source="Sources: Atalla and Kahng (1960); Computer History Museum, The Silicon Engine."}
Field-effect transistors were proposed in the 1920s and 1930s, and no one could make one work until silicon could be given a clean surface.

At Bell Labs, Mohamed Atalla had shown in the 1950s that a layer of silicon dioxide, grown on silicon by heating it in oxygen, protects the surface and keeps its electrical properties steady. In late 1959 he and Dawon Kahng used that oxide as the insulator under a metal gate and made the first working metal–oxide–semiconductor transistor on silicon. They announced it in June 1960 at the Solid-State Device Research Conference in Pittsburgh, as the “silicon–silicon dioxide field induced surface device”.:cite[atalla-kahng1960] It was slower than the bipolar transistors of the day and at first drew little interest at Bell Labs, but other companies took it up within a few years.:cite[chm-mos1960] Everything in this chapter is built from a descendant of that device.
:::

A quick check of the rule before you use it.

```quiz
q: 'A single nMOS connects +5 V to an output wire and nothing else touches the wire. You turn the gate on (1), so the output goes to 5 V, and then turn it off again (0). Before you try the next figure: what is the output now?'
options:
  - text: 0 V, because the transistor is off and an off switch means 0.
    why: 'An off transistor is an open switch, and an open switch does not connect the wire to anything, ground included. Nothing pulls the wire to 0 V.'
  - text: Still 5 V, because nothing has taken the charge away.
    correct: true
    why: 'The wire is a small capacitor (Chapter 4), and the transistor charged it. With the switch open the charge has nowhere to go, so the wire holds its voltage until something drains it. A wire that has never been driven is different: it is unknown, the state called Z.'
  - text: Unknown, because a transistor that has been switched off cannot be trusted.
    why: 'The switch is perfectly well-behaved: it is open. The wire is not unknown, because it remembers what it was.'
```

::circuit{src="09-cmos/circuits/switches.json" title="An nMOS and a pMOS, each joined to +5 V" n="9.1" toolbar=false caption="Both outputs start undriven (grey dashed: Z, nothing connected). Click the top Gate: the nMOS turns on and the output goes to 1. Click it again: the output stays lit. Nothing is driving it, but the wire keeps its charge. The pMOS below is on when its Gate is 0, so click that one to 0."}

The figure shows why one transistor is not enough for a gate. An nMOS or a pMOS can *connect* the output to a rail, but neither can bring it back: to make the output 0 as well as 1, something has to connect it to the other rail, and it has to be done by the input, not by the reader.

## The inverter

Put the two together. A pMOS goes between +5 V and the output, and an nMOS between the output and ground. Tie their gates together and call the joint the input.

- **Input 0:** the pMOS is on and the nMOS is off. The output is joined to +5 V, and to nothing else: a 1.
- **Input 1:** the pMOS is off and the nMOS is on. The output is joined to ground, and to nothing else: a 0.

In both rows exactly one transistor is on. The pMOS is the **pull-up** and the nMOS the **pull-down**, and, unlike the resistor of Chapter 8, neither is ever pulling against the other. The whole gate is two transistors, one fewer part than RTL, and there is no resistor to choose.

::circuit{src="09-cmos/circuits/not.json" title="The CMOS inverter, at three levels" n="9.2" dial=true caption="Click the switch A: the LED shows NOT A. Then open the gate with the buttons in the title bar. Switches shows the two transistors as switches, green when on; the wire between them is driven from a rail in both states. Analog shows the same transistors as level-1 MOSFETs with a few femtofarads of capacitance, so the output takes time: about 0.19 ns to cross half way, in either direction."}

:::key[The abstraction dial]
This is the first figure with a dial: three buttons in its title bar that open the gate up, one level at a time, and carry the settings of your switches with you.

- **Logic** is what Chapters 6 to 8 used: gates, and the values 0 and 1.
- **Switches** replaces each gate by its transistors, each one a switch that is either on or off, simulated by the :term[switch-level]{id=switch-level} engine described at the end of this chapter. Values are 0, 1, X (unknown) and Z, with a *strength*.
- **Analog** replaces each transistor by the level-1 MOSFET of Chapter 8 and adds the capacitances that give a real wire and a real gate input their delay. Values are voltages.

The same figure, three answers of increasing cost and increasing detail. Whenever the circuit is small enough to be opened up (up to 400 transistors at the switch level and 48 at the analog level) the dial will be there.
:::

### Why there is no static current

The RTL inverter of Chapter 8 pulled 5 mA out of the supply for as long as its output stayed low. This one has two transistors in a chain between +5 V and ground, so what does the supply give?

```quiz
q: 'A CMOS inverter’s input is held at 0 V for a long time. How much current does the 5 V supply give it?'
options:
  - text: 'About 5 mA, as in the RTL inverter: a transistor is on, so current flows through it.'
    why: 'A transistor is on, but it is the pMOS, and it leads only to the output wire and to the gate of the next stage. The path to ground goes through the nMOS, which is off.'
  - text: About 0.5 mA, since two transistors in series share the voltage.
    why: 'In series, but one of them is off, and an off transistor passes almost nothing however much voltage is across it.'
  - text: 'Next to nothing, a few picoamps or nanoamps: only leakage through the transistor that is off.'
    correct: true
    why: 'The path from the supply to ground has to go through both transistors, and one of them is always off. The sweep below measures it: about 10 pA in the simulator.'
```

Now see it over the whole range. The next figure sweeps the input of an inverter slowly from 0 V to 5 V. Every point is a complete solution of the two transistors’ equations on the analog engine, not a formula.

::inverter-sweep{n="9.3" caption="Drag the input. The shaded bands say which transistors conduct. Below 1 V the pMOS holds the output at 5 V, above 4 V the nMOS holds it at 0 V, and the supply current (the lower panel) is zero. Only between 1 V and 4 V are both on, and then the output falls almost vertically. Try pMOS 1×, then the log axis."}

:::lab[Where the current goes]
Use Figure 9.3, with the pMOS at 2× (a pMOS twice as wide as the nMOS, which makes the two equally strong).

1. Set the input to 0 V. The pMOS conducts, the nMOS is off, the output is 5.00 V and the supply gives about 10 pA. Slide to 5 V: the picture is mirrored, with the nMOS conducting and the output at 0.00 V, and the supply gives nothing at all.
2. Slide slowly up from 1 V. Just above 1 V, the nMOS turns on while the pMOS has not yet turned off, and the supply current starts to flow. It peaks at 2.5 V, 23 mA, where both transistors are saturated and the output is at its steepest.
3. Change to pMOS 1×. A pMOS of the same size is half as strong, so the nMOS wins earlier: the output crosses 2.24 V at 2.24 V instead of at 2.5 V, and the peak is lower, 16 mA. Sizing the pMOS to twice the nMOS puts the switching point half way between the rails, which is where a logic gate wants it.
4. Switch the current axis to Log. The two ends of the curve are at about 10 pA, and the peak is at 23 mA: a factor of two billion. Zero is not exactly zero, but next to the peak it might as well be.
:::

So a CMOS gate has three states of affairs: the input at 0, at 1, or in transit. The steady states cost only leakage. The middle is crossed once per edge, in the time the edge takes, so a fast edge gives a short pulse of current, small against the other cost: to change the output, the gate has to charge or discharge the capacitance of the wire and the gates it drives. That charge, *C*&thinsp;*V*, comes from the supply on every rising edge and goes to ground on every falling one. A CMOS gate that is not switching uses nothing, and one that is switching uses power in proportion to how often. Chapter 10 puts numbers on that.

:::deeper[Where the switching point sits]
Both transistors are saturated at the switching point *V*<sub>m</sub>, so their currents are equal: *k*<sub>n</sub>(*V*<sub>m</sub> − *V*<sub>t</sub>)² = *k*<sub>p</sub>(*V*<sub>DD</sub> − *V*<sub>m</sub> − *V*<sub>t</sub>)². Take square roots and write *r* = √(*k*<sub>n</sub> / *k*<sub>p</sub>):

*V*<sub>m</sub> = (*V*<sub>DD</sub> + (*r* − 1)*V*<sub>t</sub>) / (1 + *r*).

With equal strengths *r* = 1 and *V*<sub>m</sub> = *V*<sub>DD</sub>/2 whatever the threshold. With the simulator’s defaults *r* = √2 and *V*<sub>m</sub> = (5 + 0.414) / 2.414 = 2.24 V, the value in the lab. A wide pMOS moves the switching point up, a wide nMOS moves it down; a designer who wants a gate that answers “1” to a slightly weak input skews the sizes on purpose.
:::

:::history{year=1963 title="Nanowatt logic" people="Frank Wanlass, Chih-Tang Sah" run="Run Wanlass’s inverter" source="Sources: Wanlass and Sah (1963); US Patent 3,356,858; Computer History Museum, The Silicon Engine; Weste and Harris (2011)."}
In February 1963 Frank Wanlass and Chih-Tang Sah, at Fairchild, presented a logic family with a standby power of a few nanowatts. The trick was to pair an n-channel and a p-channel transistor.

They gave the paper at the International Solid-State Circuits Conference, under the title “Nanowatt logic using field-effect metal-oxide semiconductor triodes”, and Wanlass filed a patent in June, “Low stand-by power complementary field effect circuitry”, which was granted in December 1967 as US 3,356,858.:cite[wanlass-sah1963]:cite[wanlass-patent] The circuits shown were an inverter, NOR gates and a flip-flop, all made of complementary pairs.:cite[shmj-cmos] It was not an easy technology to build in the 1960s, when a chip had to carry both kinds of transistor and keep the oxide clean, and the first CMOS chips were niche products, found where power was scarce: RCA sold its 4000-series logic from 1968.:cite[chm-cmos1963]:cite[rca-cd4000] By the 1980s a chip held hundreds of thousands of gates, and a gate that took current even when idle made a chip too hot to use. CMOS took over, and has held the field since.:cite[weste-harris2011]
:::

::::run-original{title="Nanowatt logic"}
::circuit{src="09-cmos/circuits/wanlass.json" n="9.4" title="A complementary pair, driving what a gate really drives" speed=2e-5 traces="IN,OUT" caption="The complementary pair of Wanlass’s patent, with a 1 µF capacitor standing in for the next gate (a real gate input is about a femtofarad, a billion times smaller, and the pulse a billion times shorter). Click In. The ammeter jumps to tens of milliamps for a few microseconds while the capacitor charges or discharges, and then falls to nothing again; the supply gives exactly C × V = 5 µC for each rising edge. In between there is no current at all."}
::::

## Series, parallel and duality

The inverter has one transistor in each network. To compute something other than NOT, each network can have several transistors in it, arranged as switches in series and in parallel, exactly as in Chapter 6. Take the pull-down network, the nMOS transistors between the output and ground:

- nMOS in **series** conduct when *all* their gates are 1: an AND.
- nMOS in **parallel** conduct when *any* gate is 1: an OR.

The pull-down connects the output to ground, so the output is 0 exactly when the pull-down conducts. A gate whose :term[pull-down network]{id=pdn} is *A* AND *B* therefore has the output NOT (*A* AND *B*), a :term[NAND]{id=nand}; one whose pull-down is *A* OR *B* has NOT (*A* OR *B*), a :term[NOR]{id=nor}. **CMOS gates always invert.** (An AND needs a NAND followed by an inverter, six transistors.)

The :term[pull-up network]{id=pun} has to be arranged so that it conducts in every case in which the pull-down does not, and in none in which it does. The rule that does this is a duality.

::circuit{src="09-cmos/circuits/nand.json" title="NAND: nMOS in series, pMOS in parallel" n="9.5" dial=true level="switch" caption="The gate is already open to Switches. Set A = 1, B = 0 and find the transistor that is off in the series stack: the path to ground is broken, and the pMOS on the B side, on because B is 0, pulls Y up. Then set both to 1, and count how many transistors are on: two, in the series stack."}

::circuit{src="09-cmos/circuits/nor.json" title="NOR: nMOS in parallel, pMOS in series" n="9.6" dial=true level="switch" caption="The dual: the two nMOS are side by side and the two pMOS in a stack. Y is 1 only when both inputs are 0, and only then is there a path through both pMOS transistors."}

:::key[Duality]
The pull-up network is the **dual** of the pull-down network: the same transistors, with every series connection replaced by a parallel one and every parallel connection by a series one. Exactly one of the two networks conducts for every input, so the output is always tied to one rail and never to both.
:::

The reason is :term[De Morgan’s law]{id=de-morgan} (Chapter 11 gives it a proper treatment). A pMOS conducts when its gate is 0, so a pMOS in series conducts when *all* its inputs are 0, that is, when NOT *A* AND NOT *B*, and a pMOS in parallel conducts when NOT *A* OR NOT *B*. So the pull-up of the dual network conducts when the pull-down’s expression, with every input complemented and AND swapped for OR, is 1. De Morgan says this is exactly NOT of the pull-down’s expression: the pull-up conducts precisely when the pull-down does not.

:::programmer[De Morgan in code]
In C the NAND gate’s two networks are `!(a && b)`. The nMOS stack computes `a && b` and pulls the output *down* if it is true. The pMOS pair computes `!a || !b` and pulls the output *up* if it is true. `!(a && b) == (!a || !b)` is the identity every programmer has used to simplify an `if`, and here it is a circuit: two expressions that are true in opposite rows, drawn as two networks that conduct in opposite rows.
:::

The switch-level engine’s netlist builder draws both networks in five lines each, and the duality is visible in the code. Here is the NAND (`src/lib/sim/switch/builder.ts`), and then the NOR:

```ts
/** CMOS NAND: parallel pMOS pull-up, series nMOS pull-down. */
nand(id: string, ins: number[], y: number): void {
  ins.forEach((a, i) => this.pmos(`${id}.p${i}`, a, this.vdd(), y));
  let top = y;
  ins.forEach((a, i) => {
    const bottom = i === ins.length - 1 ? this.gnd() : this.net();
    this.nmos(`${id}.n${i}`, a, top, bottom);
    top = bottom;
  });
}

/** CMOS NOR: series pMOS pull-up, parallel nMOS pull-down. */
nor(id: string, ins: number[], y: number): void {
  let top = this.vdd();
  ins.forEach((a, i) => {
    const bottom = i === ins.length - 1 ? y : this.net();
    this.pmos(`${id}.p${i}`, a, top, bottom);
    top = bottom;
  });
  ins.forEach((a, i) => this.nmos(`${id}.n${i}`, a, y, this.gnd()));
}
```

The same loop appears in each, once for all transistors between two nodes, and once for a chain, and the two functions swap them.

### Why designers prefer NAND

Logically NAND and NOR are twins: Chapter 11 shows that either alone can build any circuit. In silicon they are not. Look at what is in series. In a two-input NAND, a falling output has to go through two nMOS transistors, one after the other. In a NOR it is the *rising* output that goes through a stack, of two pMOS transistors. Series transistors add their resistances, so a stack of two is twice as slow as one transistor of the same size; to make up for it, each transistor in a stack of *k* has to be *k* times as wide.

And the pMOS transistors are the weak ones. Recall the last row of the table: a pMOS carries half what an nMOS of the same size does, so a pMOS has to be twice as wide to keep up. Count the width needed for every gate to drive its output as strongly as a unit inverter (an nMOS of width 1 and a pMOS of width 2, total 3), measured in units of the narrowest nMOS:

| Inputs | NAND, total width | NOR, total width |
|---|---|---|
| 1 (inverter) | 3 | 3 |
| 2 | 8 | 10 |
| 3 | 15 | 21 |
| 4 | 24 | 36 |

Every extra input adds to the NOR’s stack of pMOS transistors, which are already twice as wide, and makes each of them wider again. A four-input NOR ends up half as big again as a four-input NAND, or, at equal size, slower. Designers therefore build with NAND wherever they can, and a cell library with a good four-input NAND and a poor four-input NOR is normal. (The NOR gates of the Apollo Guidance Computer in Chapter 8 had no such problem: in RTL the transistors are all in parallel, and the pull-up is a single resistor, so there is no stack.) The gate compiler below has a switch that shows the widths.

The dial’s analog level shows the series effect. Its inverter takes 0.19 ns to cross half way, in either direction. In the NAND, with B held at 1, the output rises in 0.19 ns when A falls (one pMOS, as in the inverter) but takes 0.37 ns to fall when A rises: it has to discharge through two nMOS in series, almost exactly twice as slow. The NOR is the mirror image: 0.22 ns to fall, and 0.43 ns to rise through its stack of two pMOS. The dial gives its pMOS transistors twice the width of its nMOS ones, so its p-channel devices carry the same current as the n-channel ones; in real silicon the NOR’s slow edge is worse by that factor of two.

:::lab[Trace the path]
Use Figure 9.5, in Switches (and switch to Analog for the last step).

1. Set A = 0, B = 0. Which two pMOS transistors are on? Which nMOS transistors are off? (Both pMOS on, both nMOS off, Y = 1.)
2. Set A = 1, B = 0. Which transistors change? (The pMOS on A’s side turns off and the nMOS on A’s side turns on. The stack is still broken at B, so the pull-down does not conduct. The other pMOS is still on, so Y stays 1.)
3. Set A = 1, B = 1. Both pMOS are off and both nMOS are on. Y = 0.
4. In Analog, set B = 1 and toggle A, watching Y on the timing strip. The rising edge (A falling) is quick, the falling edge (A rising) about twice as slow: the first goes through one pMOS, the second through the stack of two nMOS.
:::

## Complex gates

Nothing forces a network to have only series or only parallel transistors. Any series–parallel network is a legitimate pull-down, and its dual a legitimate pull-up. Take the expression *A*·(*B* + *C*): *A* in series with the parallel pair *B*, *C*. As a pull-down it gives Y = NOT (*A*·(*B* + *C*)), one gate of six transistors, three nMOS and three pMOS. Such a gate is a :term[complex gate]{id=complex-gate} (an *and-or-invert*, or AOI, when it is a sum of products). Built from separate gates, NOT (*A*·*B* + *C*·*D*) would need two ANDs and a NOR, sixteen transistors in three stages; as a single complex gate it is eight transistors and one stage, which is smaller and faster, since each stage costs a delay.

Reading a gate from its pull-down network is easy. Going the other way, from an expression to a gate, is a mechanical procedure, and that is the flagship of the chapter.

### The compiler

The gate compiler takes an expression for Y and produces the transistor networks of a static CMOS gate. Its rules are the ones above, and a few more for things a single stage cannot do.

1. A stage is inverting, so a gate for Y = *e* needs a pull-down network that conducts when *e* is *false*: the network for NOT *e*.
2. A network can only hold AND (series) and OR (parallel): a transistor is on or off for its own input, so a NOT in the middle of an expression is impossible. The compiler pushes every NOT down to the variables by De Morgan’s law, and each variable that appears complemented costs an inverter (two transistors) to make it.
3. The pull-up is the dual of the pull-down.
4. There is a second way to build Y = *e*: a stage that makes NOT *e*, followed by an inverter. The compiler builds both and keeps whichever has fewer transistors. An AND comes out this way, as a NAND and an inverter.

```quiz
q: 'How many transistors does the CMOS gate for Y = NOT (A·(B + C)) need, before you compile it?'
options:
  - text: 4, like the NAND and the NOR.
    why: 'Three inputs need at least three nMOS and three pMOS: one of each per input.'
  - text: 6, one nMOS and one pMOS for each of the three inputs.
    correct: true
    why: 'The pull-down is A in series with (B parallel C): three nMOS. The pull-up is its dual, A parallel with (B series C): three pMOS.'
  - text: 8, the same as A·B + A·C would need.
    why: 'Writing it as A·B + A·C would need eight, since A is used twice. But the expression as given uses each input once, and each use is one nMOS and one pMOS. Factoring saves transistors.'
```

::gate-compiler{n="9.7" caption="Type an expression, or choose one of the examples. The drawing is a live circuit: click the switches A, B, C, or click a row of the truth table, and the transistors that conduct turn green. The table says which network conducts in each row, and the check underneath is run on the switch-level engine, on this drawing, for every row."}

:::lab[Compile some gates]
Use Figure 9.7.

1. Choose **NAND** and **NOR**, and switch on *Show widths*. The widths match the table above: 8 against 10.
2. Choose **¬(A·(B+C))**, the example of the text. Click through the eight rows. In each, exactly one of the two networks is marked, and in no row are both. Find the two rows in which the pull-down conducts through only one of B and C.
3. Type `!(A*B + A*C)`. It is the same function, and the compiler does not know that: it takes eight transistors, where the factored form takes six. **Algebra is area**: a gate is as small as the expression you give it, and Chapters 11 and 12 are about writing expressions that need fewer transistors.
4. Choose **AND**. A single stage cannot make an AND, and the compiler says so: it makes a NAND and follows it with an inverter, six transistors where the NAND alone takes four. That is why NAND, not AND, is the cheap gate.
5. Choose **XOR**. It takes twelve transistors, four of them inverters that make A′ and B′, and the drawing is the biggest so far. The **Carry** example, ¬(A·B + C·(A + B)), is the inverted carry of a full adder and takes ten, in one stage: a carry built from two ANDs and two ORs would take twenty-four.
6. Type a mistake, such as `A + `, and read what the compiler says.
:::

In practice, designers stop at three or four transistors in series. A stack of *k* transistors is *k* times slower to conduct through, and, because each of the stack’s middle nodes is a small capacitor that must charge as well, worse than that. The compiler stops at five inputs and thirty-six transistors, which is where the picture stops being readable.

:::hood[How the compiler checks itself]
The compiler is `content/chapters/09-cmos/widgets/compiler.ts`, and its core is two functions. The first pushes negations down to the variables, by De Morgan (`nnf(e, neg)` is the normal form of e, or of NOT e when `neg` is true):

```ts
case 'and':
case 'or': {
  // De Morgan: ¬(a·b) = ¬a + ¬b and ¬(a + b) = ¬a·¬b.
  const isAnd = (e.op === 'and') !== neg;
  const kids = e.args.map((a) => nnf(a, neg));
  const flat = kids.flatMap((k) => (isAnd ? ('and' in k ? k.and : [k]) : 'or' in k ? k.or : [k]));
  return isAnd ? { and: flat } : { or: flat };
}
```

The second builds the pull-up by swapping series and parallel:

```ts
export function dual(net: Net): Net {
  if ('leaf' in net) return net;
  return 'series' in net ? { parallel: net.series.map(dual) } : { series: net.parallel.map(dual) };
}
```

That is the whole of the duality rule. The drawing is made by the layout code that the abstraction dial uses, and, to make sure that the drawing joins what the compiler meant, the widget does not trust either of them. `verify` flattens the drawn circuit into a netlist exactly as the page does, creates a switch-level engine, and sets the input toggles to each row of the truth table in turn:

```ts
c.inputs.forEach((v, i) => engine.setParam(v, 'on', r.bits[i] === 1));
engine.settle();
const got = engine.logic(outNet);
```

It compares the output with the expression, and also asks whether the output was ever floating, unknown or contended. The **Checked** line under the figure is the result. The test suite runs the same check on 200 random expressions, drawn and simulated, and on every example.
:::

## Passing a level

Everything so far had the nMOS at the bottom, joined to ground, and the pMOS at the top, joined to +5 V. That is not an accident, and it is not a convention. It comes from a limit of the transistor as a switch: **an nMOS passes a 0 well and a 1 badly, and a pMOS the other way round.**

The reason is in the conducting condition. An nMOS conducts while its gate is at least *V*<sub>t</sub> above its *source*. Pass a 1 through it: the drain is at 5 V and the gate at 5 V, and the source, the end that the output is connected to, rises. As it rises, the gate-to-source voltage falls, and when the output reaches 5 V − *V*<sub>t</sub> the transistor is at its threshold and stops. With *V*<sub>t</sub> = 1 V, an nMOS passing a 5 V input yields 4 V. Pass a 0 and the source is at 0 V, the gate stays 5 V above it, and the transistor stays fully on: a clean 0.

A pMOS is symmetrical. Its source is the higher terminal, so passing a 1 keeps the gate far below the source, and the output reaches 5 V. But passing a 0 lowers the output until the source, the higher terminal, is only *V*<sub>t</sub> above the gate, at 1 V, and the transistor turns off with the output at 1 V.

```quiz
q: 'A 5 V logic 1 is passed through an nMOS whose gate is held at 5 V, into the input of the next gate (a capacitor). The threshold voltage is 1 V. What voltage arrives?'
options:
  - text: 5 V. The transistor is on, so it is a wire.
    why: 'It is on only while the gate is at least a threshold above the output end. As the output rises the transistor turns itself off.'
  - text: 4 V, a threshold below the gate.
    correct: true
    why: 'The output rises until the gate is only V_t above it: 5 V − 1 V = 4 V. Then the transistor is at threshold and stops conducting. The engine’s level-1 model gives 3.99 V.'
  - text: 1 V, the threshold.
    why: 'That is the level a pMOS gets stuck at when it tries to pass a 0. An nMOS passing a 1 stops a threshold *below* the gate voltage.'
```

::circuit{src="09-cmos/circuits/pass-gates.json" title="An nMOS and a pMOS in parallel, with a capacitor as the load" n="9.8" toolbar=false caption="Each transistor is enabled by its own gate switch: the nMOS is on when its gate is 1, the pMOS when its gate is 0, and at the start both are off. The capacitor is the input of the next gate: it keeps what it was given. Try the four combinations, each with In at 1 and at 0, and read the voltmeter."}

:::lab[Which transistor passes what?]
Use Figure 9.8. Set the nMOS gate to 1 and the pMOS gate to 1, so that only the nMOS is on.

1. Set In = 1. The output rises to about 4.0 V and stays there: an nMOS cannot pass a full 1. Set In = 0: the output falls to 0.00 V.
2. Turn the nMOS off (gate 0) and the pMOS on (gate 0), so that only the pMOS is on. Set In = 1: the output rises to 5.00 V. Set In = 0: it falls, but only to about 1 V (it takes a moment to get there, as the last few hundred millivolts go very slowly), and it stays there.
3. Turn both on: nMOS gate 1, pMOS gate 0. Set In = 1 and then 0. The output goes to 5.00 V and to 0.00 V. **One transistor of each kind, side by side, pass both levels in full.**
4. Turn both off. Whatever the input does, the capacitor keeps its value.

Slow, and not a wire: the transistors resist as they conduct, so the capacitor charges through them in a fraction of a microsecond here, and in picoseconds on a chip.
:::

The pair is called a :term[transmission gate]{id=transmission-gate}: an nMOS and a pMOS in parallel, controlled by a signal and its complement. It is a bidirectional switch that passes both values, and, unlike a gate, it has no supply of its own: it only connects. Two consequences follow.

**It can select.** A 2-to-1 multiplexer is two transmission gates, one to let each input through, with an inverter to make the select signal’s complement: six transistors, where a multiplexer of the gates above (an inverter and a complex gate followed by an inverter) takes twelve. It is smaller, but it does not restore the level (the output is only as good as the input, degraded by the on-resistance), so it needs a gate after it, which is why designs use these switches inside a cell and not across a chip.

**It can remember.** Look at what happens when it is turned off.

::circuit{src="09-cmos/circuits/sample-hold.json" title="A transmission gate that holds a value" n="9.9" toolbar=false caption="This figure runs on the switch-level engine. Out starts unknown (red, hatched): nothing has ever set it. Set Enable to 1 and the output follows In. Set Enable back to 0 and then change In: the output does not follow, and does not go to Z. It keeps the value it had, because the wire and the next gate’s input are a capacitor that nothing can charge or discharge. The little inverter makes ENb from Enable."}

With the gate off, the output node is connected to nothing, and its voltage stays where it was, for as long as the capacitor’s charge lasts. A real capacitor of a few femtofarads leaks its charge in milliseconds, but a circuit that refreshes it, or that only needs the value for a clock cycle, has a memory built from two transistors. That is a **dynamic node**. Chapter 16 uses transmission gates to build latches (with a feedback inverter that restores the charge), and Chapter 20 builds DRAM from a transmission gate that is a single nMOS and a capacitor whose only job is to remember.

:::hood[How the switch-level engine decides what a wire is]
The engine you used in Figures 9.1 and 9.9 is a Bryant-style switch-level simulator (`src/lib/sim/switch`), after Randal Bryant’s MOSSIM.:cite[bryant1984] Every node has a value, 0, 1 or X, and a *strength*. A node that has never been connected to anything reads Z; a node that has been connected and then cut off keeps its value at the weakest strength, *charge*, which is why the output in Figure 9.1 stays lit. The strengths, weakest first, are (a summary of the header of `engine.ts`):

```text
charge   small < normal < large    a node cut off from every supply keeps its value
weak     resistor, lamp, relay coil    a pull-up resistor loses to any transistor
driven   weak < normal < strong    transistor sizes
wire     closed switch or relay contact
supply   rails, ground, toggles, buttons, clocks, constants
```

The rule that turns these into a value is short. In the words of the solver’s header (`solve.ts`):

```ts
 * A node takes the value of the strongest signals that reach it; if the strongest ones disagree,
 * the node is X. A stronger signal *blocks* weaker ones at the node: they go no further. That is a
 * widest-path problem (maximise the minimum strength along a path), solved like Dijkstra's
 * algorithm with a bucket per strength level, strongest first.
```

A signal travelling from a supply through a chain of transistors is as strong as the weakest link in the chain, and a node takes whichever of 0 and 1 arrives strongest. That is why a static CMOS gate never has trouble: exactly one network conducts, so only one value arrives. It is also why a pull-up resistor (weak) loses to a transistor (driven), and why a memory cell can be written through a transistor that is stronger than the cell’s own weak feedback. The loop that does the widest-path search is:

```ts
for (let lvl = this.maxLevel; lvl > 0; lvl--) {
  const bucket = buckets[lvl]!;
  while (bucket.length > 0) {
    const n = bucket.pop()!;
    if (best[n] !== lvl) continue; // superseded by a stronger signal
    ...
      const ll = g.linkLevel[l]!;
      const s = ll < lvl ? ll : lvl;
      if (s > best[m]!) {
        best[m] = s;
        buckets[s]!.push(m);
      }
```

A bucket per strength level is enough because there are only a handful of levels, so the search is linear in the size of the network. And once a node has been solved from its strongest signals, one comparison decides its value:

```ts
const a0 = up0[n]! >= s;
const a1 = up1[n]! >= s;
...
if (can0 && can1) {
  v = VX;
```

If a 0 and a 1 of the same top strength both arrive, the node is X, and if the two are *driven* strengths the engine reports **contention**, a short circuit through transistors. In a CMOS gate that cannot happen, which is what the compiler’s check asserts: no row is contended, unknown or floating.

The engine works in *rounds*: it re-solves only the groups of nodes that a changed transistor or input touches, and, in the unit-delay mode of the dial’s Switches level, one round takes one nanosecond, so a change ripples through a chain of gates one stage at a time.
:::

## Build it for real

:::real{parts="2N7000 (n-channel), BS250 (p-channel), red LED, 330 Ω, 100 kΩ, 10 kΩ potentiometer, 5 V USB supply module, breadboard, multimeter"}
**A discrete CMOS inverter.** The 2N7000 and the BS250 are small n-channel and p-channel MOSFETs in the same black TO-92 package. Their pins are in a different order (the source and the drain legs are swapped), so read the pinout in the data sheet before you push either into the breadboard. Wire the BS250’s source to +5 V, the 2N7000’s source to ground, join the two drains (that is the output) and join the two gates (that is the input). Put the LED and its 330 Ω resistor from the output to ground.

With the input wired to ground, the pMOS is on and the LED lights; wired to +5 V, the nMOS is on and it goes out. With nothing but the meter on the output, it reads within a few millivolts of 5 V and of 0 V. Then open the supply line and put the meter in its current range, in series: in either steady state (with the LED disconnected) it reads nothing on the microamp scale, compared with the 5 mA of the RTL inverter of Chapter 8.

Connect the potentiometer between +5 V and ground with its wiper on the input, and turn it slowly. The output does not slide, it jumps, somewhere around the middle of the range, as in Figure 9.3, and for the short time that the wiper sits at the jump, the meter in the supply line reads a few milliamps: both transistors on at once. Never leave the input unconnected: a floating gate sits somewhere in the middle, both transistors half on, and picks up hum from your fingers. MOSFET gates are also damaged by static: touch something earthed first. The threshold of these parts (about 2 V for the 2N7000) is higher than the simulator’s 1 V, so the jump is over a narrower part of the range.
:::

## Exercises

The three gates of this chapter go into the parts bin. Build each one from transistors, and when it passes its checker it becomes a part that Part III can use, with the transistors hidden inside it.

```build
id: cmos/not
title: The CMOS inverter
part: not
allowed: [nmos, pmos]
prompt: |
  Build a **NOT** gate from one pMOS and one nMOS. The pins A and Y are already on the canvas. Place the transistors and the supply symbols (+5 V and ground), wire them, and press Check. The pMOS goes between +5 V and Y, the nMOS between Y and ground.
hints:
  - Both transistors have their gates joined to A, and their drains joined to Y.
  - The pMOS source goes to the +5 V rail and the nMOS source to ground.
explain: |
  Two transistors, a pull-up and a pull-down, with exactly one on for either input. This is the part that every other circuit in the book is made of, one way or another.
solution: {"version":1,"title":"NOT (CMOS)","engine":"switch","components":[{"id":"A","type":"port","x":3,"y":4,"params":{"name":"A","dir":"in"},"label":""},{"id":"P1","type":"pmos","x":6,"y":0},{"id":"N1","type":"nmos","x":6,"y":6},{"id":"VDD","type":"rail","x":9,"y":-2},{"id":"GND","type":"ground","x":9,"y":8},{"id":"Y","type":"port","x":12,"y":3,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[3,4],[6,4]]},{"points":[[6,0],[6,6]]},{"points":[[9,2],[9,4]]},{"points":[[9,3],[12,3]]}]}
```

```build
id: cmos/nand
title: The CMOS NAND
part: nand
allowed: [nmos, pmos]
prompt: |
  Build a two-input **NAND** from four transistors: two pMOS in parallel between +5 V and Y, and two nMOS in series between Y and ground.
hints:
  - The output falls only when both inputs are 1, so the nMOS transistors, which pull it down, must be in series.
  - Each pMOS has one input on its gate, and both are joined at the top to +5 V and at the bottom to Y.
explain: |
  Series nMOS, parallel pMOS. A on one nMOS and one pMOS, B on the other pair; exactly one network conducts for each of the four input rows.
solution: {"version":1,"title":"NAND (CMOS)","engine":"switch","components":[{"id":"A","type":"port","x":2,"y":0,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":2,"y":12,"params":{"name":"B","dir":"in"},"label":""},{"id":"P1","type":"pmos","x":6,"y":0},{"id":"P2","type":"pmos","x":14,"y":0},{"id":"N1","type":"nmos","x":12,"y":8},{"id":"N2","type":"nmos","x":12,"y":12},{"id":"VDD","type":"rail","x":13,"y":-4},{"id":"GND","type":"ground","x":15,"y":14},{"id":"Y","type":"port","x":22,"y":4,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[2,0],[6,0]]},{"points":[[4,0],[4,8],[12,8]]},{"points":[[2,12],[12,12]]},{"points":[[11,12],[11,0],[14,0]]},{"points":[[9,-2],[17,-2]]},{"points":[[13,-4],[13,-2]]},{"points":[[9,2],[9,4],[17,4],[17,2]]},{"points":[[15,6],[15,4]]},{"points":[[17,4],[22,4]]}]}
```

```build
id: cmos/nor
title: The CMOS NOR
part: nor
allowed: [nmos, pmos]
prompt: |
  Build a two-input **NOR** from four transistors. It is the dual of the NAND: swap the series and the parallel.
hints:
  - The output rises only when both inputs are 0, so the pMOS transistors, which pull it up, must be in series.
  - The nMOS transistors are side by side between Y and ground.
explain: |
  Series pMOS, parallel nMOS. It is the same drawing as the NAND with the two networks exchanged, which is what duality says.
solution: {"version":1,"title":"NOR (CMOS)","engine":"switch","components":[{"id":"A","type":"port","x":2,"y":0,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":2,"y":4,"params":{"name":"B","dir":"in"},"label":""},{"id":"P1","type":"pmos","x":12,"y":0},{"id":"P2","type":"pmos","x":12,"y":4},{"id":"N1","type":"nmos","x":6,"y":10},{"id":"N2","type":"nmos","x":14,"y":10},{"id":"VDD","type":"rail","x":15,"y":-4},{"id":"GND","type":"ground","x":13,"y":14},{"id":"Y","type":"port","x":22,"y":8,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[2,0],[12,0]]},{"points":[[4,0],[4,10],[6,10]]},{"points":[[2,4],[12,4]]},{"points":[[10,4],[10,10],[14,10]]},{"points":[[15,-4],[15,-2]]},{"points":[[15,6],[15,8]]},{"points":[[9,8],[17,8]]},{"points":[[17,8],[22,8]]},{"points":[[9,12],[17,12]]},{"points":[[13,12],[13,14]]}]}
```

```quiz
q: 'A three-input NOR gate is built in CMOS. How many transistors does it have, and what is in series?'
options:
  - text: 6 transistors; the three pMOS are in series and the three nMOS in parallel.
    correct: true
    why: 'A NOR pulls its output down if any input is 1, so the nMOS are in parallel; the output rises only if all three are 0, so the pMOS form a stack of three, which is why wide NORs are slow.'
  - text: 6 transistors; the three nMOS are in series and the three pMOS in parallel.
    why: 'That is a three-input NAND.'
  - text: 4 transistors, one of each kind for each pair of inputs.
    why: 'Each input needs one nMOS and one pMOS, so a three-input gate has six.'
```

```quiz
q: 'Why is a four-input NOR gate in CMOS bigger, for the same speed, than a four-input NAND?'
options:
  - text: 'It has more transistors.'
    why: 'It has eight, like the NAND.'
  - text: 'Its four pMOS transistors are in series, and a pMOS is only half as strong as an nMOS of the same size, so they all have to be made very wide.'
    correct: true
    why: 'The stack of four multiplies each transistor’s width by four, and the pMOS’s weakness by a further two: width 8 each, against 4 for the nMOS stack in the NAND. Total 36 against 24.'
  - text: 'A NOR uses more current when it is not switching.'
    why: 'No static gate does that: exactly one network conducts, and in the steady state the supply gives nothing.'
```

```quiz
q: 'In a static CMOS gate, when can the pull-up and the pull-down network conduct at the same time?'
options:
  - text: 'Only while an input is changing, and only briefly.'
    correct: true
    why: 'While the input is between the thresholds both transistors of an inverter conduct, and a pulse of current flows straight through: the middle of the sweep in Figure 9.3. It is short unless the input edge is slow.'
  - text: 'When the output is 1.'
    why: 'When the output is 1 the pull-up conducts and the pull-down does not.'
  - text: 'When the gate has more than two inputs.'
    why: 'The dual rule works for any number of inputs: the two networks conduct in opposite rows.'
```

:::challenge[Design a multiplexer]
A 2:1 multiplexer chooses A when S = 0 and B when S = 1: Y = S′·A + S·B. (a) Type the *inverted* multiplexer, `!(!S*A + S*B)`, into the gate compiler. How many transistors? (b) What would you add to get the true multiplexer? (c) The transmission-gate multiplexer described above takes six transistors. What does it give up? (Answers: (a) 10, of which two make S′; (b) an inverter, 12 in all; (c) it does not restore the level: a transmission-gate multiplexer passes its input through a resistance, so it needs a gate after it.)
:::

:::challenge[A full adder’s carry]
The carry out of a full adder is 1 when at least two of A, B and Cin are 1. Type `!(A*B + C*(A+B))` into the compiler and look at the drawing. (a) Count the transistors. (b) What is the tallest stack of transistors in either network? (c) The gate computes the *inverted* carry. What could the next stage of a ripple-carry adder (Chapter 14) do about that, short of adding an inverter? (Answers: (a) ten; (b) two: the pull-down is the A·B branch, two nMOS in series, in parallel with the C·(A + B) branch, and the pull-up is its dual, so a single stage, and no stack of three, computes the carry; (c) a full adder has the neat property that inverting all three inputs inverts both outputs. A stage that is fed the inverted carry therefore produces an inverted sum and an inverted carry, and stages can alternate between true and inverted signals without an inverter between them. This is the “mirror adder”.)
:::

## What’s next

You now have the three parts of the transistor’s logic: NOT, NAND and NOR, each of them a pull-up and a pull-down network that are never on together. You also have a rule, the duality of series and parallel, that turns any expression into a gate, and a switch, the transmission gate, that passes a level in both directions.

But the whole of this chapter treated a wire as a 0 or a 1, and a transistor as a switch that is either open or shut, apart from the sweep of Figure 9.3 and the analog level of the dial. The sweep showed the truth: in the middle of its range an inverter is an amplifier, its output is neither 0 nor 1, and how the gate behaves there sets how much noise it can tolerate. Chapter 10 opens the box: the transfer curve and the noise margins, the speed at which a gate can charge the capacitor of the next, the power it takes as the clock speeds up, and what happens when two outputs are joined and disagree.
