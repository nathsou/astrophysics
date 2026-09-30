---
number: 1
title: Charge, voltage and current
summary: What flows in a wire, how fast, and where the water analogy breaks.
duration: About 1 hour
prerequisites: [press-a-key]
---

Flip a light switch and the lamp is on. Not “soon”, not “after a moment”: on. Something has travelled from the switch to the lamp, and it did so too quickly for you to notice. The obvious candidate is the thing every textbook says flows in a wire: electrons. So here is a question to hold on to for the rest of this section, and to answer before you read on.

```quiz
q: 'A wire carries a current of 1 ampere, about what a small lamp or a phone charger draws. How fast do the electrons in the wire move along it?'
options:
  - text: Close to the speed of light, about 300,000 km/s.
    why: 'That is how fast the *news* travels. The electrons themselves are far slower, as you are about to see.'
  - text: About as fast as a car, tens of metres per second.
    why: 'Far too fast. In an ordinary copper wire an electron would take hours to travel a single metre.'
  - text: About walking pace, a metre per second.
    why: 'Still 10,000 times too fast.'
  - text: 'Slower than a snail: a fraction of a millimetre per second.'
    correct: true
    why: 'For 1 A in a 1 mm² copper wire the average drift is 0.07 mm/s, about fourteen times slower than a garden snail. The computation is a few lines further down.'
```

If that surprised you, good. This chapter takes the picture of “electricity” that most people carry around and replaces it with one that predicts numbers. We need only three quantities to do it: **charge**, **current** and **voltage**. By the end you will be able to say how many electrons pass through an LED every second, what a 9 V battery actually gives to each of them, why the arrows in circuit diagrams appear to point the wrong way, and why the lamp comes on at once even though the electrons crawl.

## Charge

Matter is made of atoms, and atoms of a heavy nucleus with positive :term[charge]{id=charge} and a cloud of light electrons with negative charge. The two kinds attract each other and each kind repels itself. That is the whole of the rule, and everything in this course, from a lamp to a processor, is a consequence of it and of one more fact: charge is never created or destroyed, only moved.

Charge is measured in **:term[coulombs]{id=coulomb}** (C). The charge of one electron is tiny and exact:

$$e = 1.602\,176\,634 \times 10^{-19}\ \text{C}$$

The number is exact because since 2019 the SI *defines* the ampere by fixing the value of *e*.:cite[bipm2019] Turn it round and one coulomb is the charge of 6.24 × 10¹⁸ electrons, more than six billion billion. The next figure lets you feel the range: drag the handle, or press one of the chips, and see how many electrons familiar amounts of charge represent.

::charge-counter{n="1.1" caption="Drag the handle (or use the arrow keys) to change the number of electrons. The axis is logarithmic: each tick is a hundred thousand times the last. Which is bigger, a static shock or a nanoampere for a second?"}

A copper wire is full of charge, positive and negative, and the two cancel. Each copper atom gives up about one electron to a shared “sea” that can wander through the metal, while the ions it leaves behind stay in the crystal. Copper has 8.5 × 10²⁸ of these free electrons in every cubic metre, so a wire of 1 mm² cross-section and a metre long holds 8.5 × 10²² of them, a charge of 13,600 C. That is more than a AA cell can deliver in its whole life. Hold on to that comparison: it will matter when we get to the water analogy.

## Current: charge in motion

A wire that is neutral and still does nothing. What does something is charge *moving*. The :term[current]{id=current} through a wire is the amount of charge passing a point each second:

:::equation{#current caption="Current is a rate: coulombs per second are amperes."}
$$I = \frac{Q}{t}$$
:::

The unit is the **:term[ampere]{id=ampere}** (A), one coulomb per second, and it is one of the seven base units of the SI. So a current of 1 A means 6.24 × 10¹⁸ electrons crossing any section of the wire every second. The currents you will meet in this course range over a great many powers of ten, and it helps to have a feel for them:

| Current | What draws it | Electrons per second |
|---|---|---|
| 1 nA | leakage of a good logic input | 6 × 10⁹ |
| 1 mA | a dim indicator LED | 6 × 10¹⁵ |
| 20 mA | a bright LED | 1.2 × 10¹⁷ |
| 50 mA | the small lamp in the next figure | 3.1 × 10¹⁷ |
| 2 A | a phone charger | 1.2 × 10¹⁹ |

Current is measured with an **ammeter**, which you insert *into* the loop so that the whole current flows through it, like a flow meter cut into a pipe. In the figure below the ammeter reads the current of the lamp. A **voltmeter** is different: it is connected *across* a component, to two points, and compares them; we are about to see what it compares.

::circuit{src="01-charge-voltage-current/circuits/simple.json" n="1.2" title="A battery, a switch and a lamp" current=true caption="Click the switch to open and close it. With it closed, the ammeter (in series) reads 50 mA, the same everywhere in the loop; the voltmeter (across the lamp) reads about 6 V. Hover over any wire or part for its voltage and current. The moving dots show conventional current: the “Under the hood” box further down says why the dots are not electrons."}

Notice that the current is the *same* all the way round the loop. The lamp does not use up any charge. What goes in at one end comes out at the other, every electron of it; what the lamp turns into light and heat is *energy*. Where does that energy come from, and how much of it does each electron carry?

## Voltage: energy per charge

To push a charge through a lamp takes energy, and the lamp turns that energy into heat and light. The :term[voltage]{id=voltage} between two points tells you how much energy each coulomb of charge gains or gives up in going from one to the other:

:::equation{#voltage caption="Voltage is energy per unit of charge: joules per coulomb are volts."}
$$V = \frac{E}{Q}$$
:::

The unit is the **:term[volt]{id=volt}** (V): one joule per coulomb. A 9 V battery gives every coulomb that passes through it 9 J of energy. That is not much energy: it would lift a 100 g apple about nine metres. But a lamp passing 50 mA is being handed 0.05 C every second, so it receives 0.05 × 6 = 0.3 J per second, which is 0.3 W. You may notice that this is voltage times current. It is, and Chapter 2 makes a habit of it.

Two things about voltage are easy to get wrong.

**Voltage is always between two points.** There is no such thing as “the voltage of a wire”, only the voltage of one point *relative to* another. Circuit diagrams pick one point, called :term[ground]{id=ground}, and measure everything else from it; that is all “the 5 V rail” means. It is the same idea as height: nobody has a height, only a height above sea level, and a change of reference changes every number but none of the differences.

**Voltage is not amount of energy.** It is energy *per coulomb*. A static shock from a doorknob is a few thousand volts, but it carries about 0.3 µC, so its total energy is under a millijoule and you barely feel it. A car battery is only 12 V, but it holds about 200,000 C, and its energy, 2.6 MJ, is why a spanner dropped across its terminals glows red hot. A single AA cell is 1.5 V and holds 9,000 C, so it stores 1.5 × 9,000 = 13.5 kJ.

:::history{year=1800 title="Galvani’s frogs and Volta’s pile" people="Luigi Galvani, Alessandro Volta" run="Run the original" source="Sources: Galvani (1791); Volta (1800); Pancaldi (2003); Nicholson (1800); Hunt (1994)."}
In 1800 Alessandro Volta announced a stack of metal discs that made electricity flow steadily for the first time, after nearly a decade of arguing with a colleague in Bologna about the twitching legs of frogs.

Luigi Galvani, professor of anatomy at Bologna, had noticed that the leg of a dissected frog twitched when a scalpel touched the nerve while a nearby electrical machine sparked, and later when a brass hook through the spinal cord touched an iron railing. In 1791 he published his conclusion: the twitching was caused by “animal electricity”, made by the frog’s own body.:cite[galvani1791]

Alessandro Volta, professor of physics at Pavia, repeated the experiments and came to the opposite view. The frog was only a very sensitive detector; the electricity came from the *contact of two different metals*. To prove it, he took away the frog. He piled discs of zinc and silver (or copper), each pair separated by cloth or card soaked in brine, and found that the taller the pile, the stronger the effect. He described it in a letter to Sir Joseph Banks, President of the Royal Society, dated 20 March 1800.:cite[volta1800] It was the first battery: before it, electricity came in brief discharges from friction machines and Leyden jars; now there was a source that gave a steady current for as long as the chemicals lasted.

Both men were partly right. Volta’s pile does not run on contact but on a chemical reaction between the metals and the brine, as chemists would soon show, and Galvani was right that nerves are electrical.:cite[pancaldi2003] Within weeks of Volta’s letter, William Nicholson and Anthony Carlisle used a pile to split water into hydrogen and oxygen.:cite[nicholson1800] The unit of voltage, the volt, is named after Volta; the International Electrical Congress in Paris adopted it in 1881.:cite[hunt1994]
:::

::::run-original{title="Galvani’s frogs and Volta’s pile"}
::circuit{src="01-charge-voltage-current/circuits/volta.json" n="1.3" title="Volta’s pile, rebuilt" scale=1.2 current=true caption="A pile of five cells of about 1 V each, in series, lights a lamp. Close a bypass switch to take one cell out of the stack: the voltage drops by one cell’s worth and the lamp dims. In series, voltages add."}
::::

Volta’s pile shows the rule for stacking sources. Put cells **in series**, each one’s + to the next one’s −, and the energy each coulomb picks up in one cell is *added* to what it picks up in the next. Five cells of 1 V make 5 V. That is how a 9 V battery is built: six little 1.5 V cells in one case. More cells, more energy per coulomb, and, as you found by closing the bypass switches, more brightness.

## Which way does the current go?

Look at the diagram above: current flows *out* of the battery’s + terminal, round the loop, and *back into* the − terminal. Now look at what we said the charge carriers are. Electrons have negative charge, and they are pushed *towards* the + terminal. So the electrons go round the loop the opposite way to the arrows.

The reason is history. In the late 1740s Benjamin Franklin proposed that electricity was a single fluid, present in every body, and that rubbing moved some of it from one body to another. The body with an excess he called positive, and the one with a deficit negative. Rub a glass rod with silk and one of them gains and the other loses: he had to guess which, and he guessed that the glass gained.:cite[franklin1751] It was a coin toss, and he lost: what moves in rubbing is electrons, and the glass is the one that *loses* them. But by the time J. J. Thomson identified the electron in 1897,:cite[thomson1897] the convention of drawing current from + to − was in every textbook, every circuit and every symbol.

We keep it. The arrow of :term[conventional current]{id=conventional-current} points the way *positive* charge would flow, from + round to −. Nothing physical depends on the choice. A positive charge moving right and a negative charge moving left do the same job, in the same circuit, with the same effect on every meter. (There are tiny effects that tell them apart, like the Hall effect, but none that a logic circuit cares about.) In this course:

- **Current** always means conventional current, from + to −. The moving dots in the live figures follow it, and so do the arrows inside the symbols of diodes and LEDs (Chapter 7 will explain why those arrows help).
- **Electrons**, in the negative-charge sense, go the other way. We will say so whenever it matters. In some semiconductors the carriers really *are* positive (they are missing electrons, called holes), so the convention turns out not to be a mistake at all.

## How fast do the electrons move?

Return to the question at the top, and compute it. Suppose a current *I* flows in a wire of cross-section *A* made of a metal with *n* free electrons per cubic metre, each of charge *e*, and that they all drift at the same average speed *v*. In one second the electrons in a length *v* of wire pass a given section. That is a volume *A v*, holding *n A v* electrons, which is a charge of *n A v e*. That charge per second is the current, so:

$$I = n\,A\,v\,e \qquad\Longrightarrow\qquad v = \frac{I}{n\,A\,e}$$

For copper *n* is 8.5 × 10²⁸ per cubic metre, one free electron per atom.:cite[ashcroft1976] With *I* = 1 A and *A* = 1 mm² = 10⁻⁶ m², the drift speed is 1 / (8.5 × 10²⁸ × 10⁻⁶ × 1.6 × 10⁻¹⁹) = 7.3 × 10⁻⁵ m/s, or **0.07 mm/s**.

:::deeper[Where the formula comes from, and where n comes from]
Take a section of the wire and count the charge that crosses it in a short time Δ*t*. Every electron closer to it than *v*Δ*t* will cross in that time, provided it drifts towards the section at speed *v*. Those electrons fill a cylinder of length *v*Δ*t* and cross-section *A*, so their number is *n A v*Δ*t* and their charge Δ*Q* = *n A v*Δ*t*·*e*. Dividing by Δ*t*:

$$I = \frac{\Delta Q}{\Delta t} = n\,A\,v\,e$$

Dividing by the area gives the current *density* *J* = *I*/*A* = *n e v*, the form you will meet in physics books: the flow of charge through each square millimetre is set by how many carriers there are, how fast they drift and what each one carries.

Where does *n* = 8.5 × 10²⁸ m⁻³ come from? Copper has a density of 8.96 g/cm³ and a molar mass of 63.55 g/mol, so a cubic metre (8.96 × 10⁶ g) holds 8.96 × 10⁶ / 63.55 = 1.41 × 10⁵ mol of atoms, and with the Avogadro constant 6.02 × 10²³ per mole that is 8.49 × 10²⁸ atoms. Each contributes about one electron to the free “sea”.
:::

The formula says the drift speed is proportional to the current and *inversely* proportional to the cross-section: the same current through a fatter wire needs each electron to move less. For 1 A in ordinary household cable (2.5 mm², the size of the wire behind a UK or European socket) it gives 0.03 mm/s. For a 1 mm² wire it gives 0.07 mm/s, which is 26 cm in an hour and a *metre in four hours*.

The electrons do not go anywhere quickly. Yet the lamp lights at once. Play with the next figure to see how both things are true.

::electrons-in-a-wire{n="1.4" caption="Close the switch and watch the amber field front race down the wire while the electrons behind it start to drift. Change the current and the thickness: the readouts are real numbers. Only the picture is exaggerated: at true scale nothing visible would happen."}

What you have just seen is the difference between two speeds that are easy to confuse.

- The :term[drift speed]{id=drift-speed} is the average speed at which the electrons make progress along the wire: about 0.07 mm/s in that wire.
- The **signal speed** is how fast a *change* travels: the front of the field that pushes the electrons. In insulated wire or cable it is typically between 0.6 and 0.99 of the speed of light; here I have used 0.66 c, so a metre of wire takes about 5 ns. In a circuit-board track it is about 15 cm per nanosecond.

Both are true because the wire is *already full*. It is a tube packed with free electrons, all already there, all jiggling about at random at about 10⁵ m/s. Push on one end, and the field, which travels at nearly the speed of light, reaches every electron along the wire at almost the same moment and each starts to drift. There is no queue of electrons waiting to arrive from the battery; the electrons that light the lamp are the ones that were already in the filament. What the battery supplies is the push, not the passengers.

It also explains what a wire does at 50 Hz, the frequency of mains electricity in Europe: the push reverses 100 times a second, and each electron in a 1 mm² wire carrying 1 A shuffles back and forth over about 0.3 µm, less than the wavelength of light, for as long as the lamp is on. Nobody has ever run out of electrons in a wall socket.

:::programmer[A wire is a queue that is already full]
Think of a FIFO queue of fixed length with every slot occupied. When you enqueue an item at the tail, every other item shuffles one slot along and one drops off the head, *immediately*. The latency of the operation is the time for the shuffle to propagate, which is short and fixed, and it has nothing to do with how fast any single item then moves. That is the wire: latency, the propagation time of the field, is about 5 ns per metre, while the *throughput* in items per second is set by the current. The two are independent numbers. Five nanoseconds per metre is nothing to a lamp, but it matters to a computer: in a 3 GHz processor one clock cycle lasts 0.33 ns, in which a signal on a circuit board travels only about 6 cm (Chapter 15 comes back to this).
:::

:::note[Faster than the drift, slower than the wire]
Even the random jiggling has a speed you can estimate: at room temperature the classical formula √(3*k*T*/*m*) gives 1.2 × 10⁵ m/s. Quantum mechanics, which forbids two electrons from sharing a state, actually makes the fastest electrons in copper move at about 1.6 × 10⁶ m/s.:cite[ashcroft1976] Either way the thermal jiggle is a billion times faster than the drift, and it averages to zero: for every electron going one way, another is going the other. It is only the tiny bias on top of it that is current.
:::

:::hood[The dots in the live circuits are not electrons]
Every live circuit in this course can show current as moving dots, and now you know they cannot show electrons at their true speed: at 1 A they would move 0.07 mm/s, a fraction of a pixel a minute. The bench draws the dots with the function below (`src/lib/bench/currents.ts`). It maps the *logarithm* of the current to a speed in pixels per second, so that a microampere and an ampere can both be seen:

```ts
export function dotSpeed(current: number): number {
  const a = Math.abs(current);
  if (!(a > 1e-8)) return 0;
  const s = Math.min(1.25, (Math.log10(a) + 8) / 8);
  return Math.sign(current) * (14 + 110 * s);
}
```

A microampere (10⁻⁶ A) gives 41 px/s, a milliampere 83 px/s and an ampere 124 px/s. A million times more current, only three times faster dots. What the dots *do* tell you faithfully is the direction (from + to −) and where the current flows and where it does not. The engine reports the current into every pin of every part; the renderer then works out the current in each section of wire from Kirchhoff’s current law, starting at the ends and adding up towards the middle, the rule that Chapter 2 introduces.
:::

## The water analogy, and where it fails

Faced with charge, current and voltage, almost everyone reaches for water in pipes. It is a good analogy, so good that it is worth using until it breaks. Here is the mapping:

| Water in pipes | Electricity | |
|---|---|---|
| Water | Charge | it is conserved and cannot be made from nothing |
| Flow rate (litres per second) | Current (coulombs per second) | the same everywhere in a closed loop |
| Pressure difference | Voltage | between two points |
| Pump | Battery | supplies the push |
| Narrow pipe | Resistor | the narrower, the more push per unit flow |
| Closed valve | Open switch | nothing flows |
| Tank that fills up | Capacitor (Chapter 4) | stores charge, and the level is the voltage |
| One-way valve | Diode (Chapter 7) | flow in one direction only |

That gets you a long way. A loop of pipe with a pump has the same flow everywhere in it, just as a series circuit has the same current: charge, like water, does not pile up or vanish. A pipe that is pinched needs more pressure for the same flow. Two pumps in series give twice the push. Even what a lamp does is right: a water wheel in the loop uses up no water at all, but it uses up pressure.

Where it breaks matters as much as where it works, because every failure is a place where a misconception hides.

1. **Pressure has a zero; voltage does not.** Pressure is measured from a vacuum, and a pipe that is “at 3 bar” means something absolute. Voltage is only ever a *difference*. A bird sitting on a 10,000 V line is not electrocuted, because it touches only one point and its body is all at the same voltage. Change the ground and every number changes but no current does. There is no pipe analogy for this, and it is why “ground” is a choice.
2. **A battery is not a tank of electrons.** In the analogy the pump moves water from a tank; you might imagine the battery holds electrons and gives them out until it is empty. It does not. The electrons in the loop were there already, in the wire and in the lamp, and they go round and round; the battery is closer to the *pump*, and what it stores is chemical energy, which it uses to give each coulomb a push. When a battery goes flat, it is out of energy, not out of electrons. (Remember: a metre of thin wire has more free charge in it than a AA cell delivers in its whole life.)
3. **Wires do not leak, and open circuits do not spill.** Cut a pipe and water pours out. Cut a wire and nothing leaves it (an open switch is an *air gap*, and charge does not cross air); a current stops the moment the loop is broken, at all points at once, and the electrons on either side stay put. Nothing in the analogy makes this so clean.
4. **Water has inertia, and electrons hardly have any.** A long pipe full of moving water is hard to stop and makes the pipes bang when you close a tap too fast (“water hammer”). The electrons in a wire have almost no inertia in this sense; what does resist a change of current is a *magnetic field*, which water has no equivalent for at all. Chapter 5 is about it.
5. **Water does not produce a magnetic field.** A current in a wire pushes a compass needle, and two parallel currents attract. You cannot get that from any pipe, and it is the whole basis of the relay.

:::question[Where would a transistor go?]
Chapter 8 introduces the transistor: a valve whose opening is set by a small voltage instead of by a hand. In the pipe picture, what would that look like? A tap turned not by a person but by the *pressure* in a second, thin pipe. Keep the picture: in the next few chapters you will find that almost everything in a computer is a tap worked by the pressure of another tap.
:::

## Lab: how does the current follow the voltage?

You have met three quantities and no rule connecting them. Let us look for one. In the next figure a battery drives a 1 kΩ resistor. You will measure the current for several battery voltages, and look for a pattern before Chapter 2 gives it a name.

::battery-lab{n="1.5" caption="Slide the battery voltage and read the ammeter."}

:::lab[Voltage in, current out]
1. Set the battery to 3 V and read the current from the ammeter. Then 6 V, 9 V and 12 V. Write down each pair.
2. Predict the current at 1.5 V before you set it. Then check.
3. For each pair, divide the voltage in volts by the current in amperes. What do you notice about the answers?
4. Watch the dots as you slide. They barely change speed although the current changes a great deal, for the reason in the box above: they use a log scale.

What you should find: the current is *proportional* to the voltage. Doubling the voltage doubles the current, and the ratio *V*/*I* is 1,000 every time. The number is a property of the resistor, not of the battery. Not exactly 1,000 to the last digit, though: the ammeter and the battery each have a little resistance of their own (0.1 Ω and 0.2 Ω in the simulator), and they add to the 1 kΩ. Chapter 2 gives this ratio a name and uses it everywhere.
:::

:::real{parts="multimeter, AA cell, 9 V battery, 100 Ω resistor, 1 kΩ resistor, two leads with crocodile clips"}
Measure a real battery with a multimeter. Set the meter to DC volts (a straight line, sometimes with dots under it) at a range above the battery voltage, put the black lead in the COM socket and the red lead in the V socket, and touch the probes to the two terminals, red to +.

1. A fresh alkaline AA cell reads about 1.5 to 1.6 V and a fresh 9 V battery about 9.5 V. If the meter shows a minus sign, the leads are the wrong way round: it is measuring a voltage relative to the other probe, and the sign tells you which way.
2. Now connect a resistor across the cell, 100 Ω for the AA (15 mA) or 1 kΩ for the 9 V (9 mA), keeping it connected only long enough to read. The reading falls a little: some of the cell’s voltage is used up in pushing current through *its own* internal resistance, which is r = (V<sub>open</sub> − V<sub>loaded</sub>)/I. For a fresh cell it is a fraction of an ohm, and for a nearly flat one it can be tens of ohms: that is how you tell a dead battery from a good one.
3. **Never** connect the meter to a battery with the leads in the current (A) sockets or with the dial on a current range. An ammeter is nearly a wire, and it makes a short circuit across the battery.
:::

## Exercises

```quiz
q: 'A phone charger delivers 2 A. How many electrons pass through the cable every second?'
options:
  - text: About 1.2 × 10¹⁹.
    correct: true
    why: 'One ampere is 6.24 × 10¹⁸ electrons per second, so 2 A is twice that: 1.25 × 10¹⁹.'
  - text: About 2.
    why: 'That is the number of amperes. One coulomb is 6.24 × 10¹⁸ electrons, and 2 A is 2 coulombs per second.'
  - text: About 3 × 10⁻¹⁹.
    why: 'You have divided instead of multiplying: that is the charge of two electrons in coulombs. The number of electrons is the charge divided by *e*.'
```

```quiz
q: 'A 9 V battery pushes 0.5 C of charge round a circuit. How much energy has it given to the charge?'
options:
  - text: 4.5 J.
    correct: true
    why: 'Voltage is energy per coulomb, so energy = V × Q = 9 × 0.5 = 4.5 J.'
  - text: 18 J.
    why: 'That is 9 divided by 0.5. Voltage is energy per charge, so the energy is the voltage *times* the charge.'
  - text: 9 J.
    why: 'A 9 V battery gives 9 J to each coulomb, and here there is only half a coulomb.'
```

```quiz
q: 'The same 1 A current flows first through a 1 mm² copper wire, then through a 2 mm² wire of the same metal. How does the drift speed of the electrons change?'
options:
  - text: It halves.
    correct: true
    why: 'v = I/(nAe). Doubling the area doubles the number of electrons sharing the flow, so each has to drift half as fast.'
  - text: It doubles.
    why: 'It is the other way round: a fatter wire has more carriers per unit length, so each needs to move less to carry the same current.'
  - text: It stays the same, because the current does.
    why: 'The current is the same, but the *number* of carriers carrying it has doubled, so the speed of each has to change.'
```

```quiz
q: 'You want to measure the current through a lamp, and the voltage across it. Where do you connect the two meters?'
options:
  - text: The ammeter in series with the lamp; the voltmeter across it.
    correct: true
    why: 'The ammeter must have the whole current flowing through it, so it goes in the loop; the voltmeter compares the two ends of the lamp, so it goes across them.'
  - text: Both in series with the lamp.
    why: 'A voltmeter in series would break the circuit: it has a resistance of millions of ohms and hardly any current flows through it.'
  - text: Both across the lamp.
    why: 'An ammeter across the lamp would short it out: it is nearly a wire, so nearly all the current would go through the meter, not the lamp.'
```

```quiz
q: 'Which of these does the water analogy get *wrong*?'
options:
  - text: A battery holds a store of electrons that it releases into the circuit.
    correct: true
    why: 'The electrons are already in the wires and the components. A battery stores chemical energy, and does work on the charge that is already in the circuit.'
  - text: The current is the same at every point of a series loop.
    why: 'That is right, in the analogy and in the circuit: charge (like water) is conserved.'
  - text: A narrower pipe gives a smaller flow for the same pressure.
    why: 'Right, and it is the same with resistors, as Chapter 2 will show.'
```

:::challenge[Snail versus signal]
A signal on a wire travels at 0.66 c and the drift of the electrons in it is 0.07 mm/s. How many times faster is the signal? (About 2.7 × 10¹².) Now find how long the average electron would take to travel from a wall socket to a lamp 3 m away, if it went there at all. (About 11 hours.) It doesn’t: in an AC circuit it goes back and forth, and would never arrive. What then *is* it that arrives?
:::

## What’s next

You now have three quantities and a feel for their sizes: charge in coulombs, current in amperes as a rate of flow, and voltage in volts as energy per coulomb. In the lab you also caught a glimpse of a rule: for a given resistor, the current is proportional to the voltage. Chapter 2 turns that observation into Ohm’s law, adds power, and shows how a handful of resistors can divide, limit and share voltage, which is what nearly every digital circuit does at its inputs.
