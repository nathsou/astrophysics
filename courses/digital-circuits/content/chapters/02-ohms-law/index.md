---
number: 2
title: Resistance and Ohm’s law
summary: Ohm’s and Kirchhoff’s laws, dividers, power and ratings — and the magic smoke.
duration: About 1.5 hours
prerequisites: [charge-voltage-current]
---

Electronics engineers say that circuits run on magic smoke: it is sealed inside every component at the factory, and once it has escaped, the component stops working. This chapter is about keeping the smoke in. It is also about the handful of rules that let you predict, before you build anything, what a circuit will do, and, as it happens, the same rules explain the smoke.

Start with a prediction. You take a red LED and connect it straight across a 9 V battery, with nothing else in the circuit.

```quiz
q: 'What happens when a red LED is connected directly across a 9 V battery?'
options:
  - text: 'It lights, and is a little brighter than usual.'
    why: 'Brighter than usual, yes, for a very short time. Read the next options: what happens to a part that is asked to carry far more current than it can?'
  - text: 'It lights normally: the battery gives the LED only as much current as it needs.'
    why: 'A very common belief, and wrong. A battery fixes the *voltage*; the current is decided by whatever is connected to it. The LED does not ask for a current; it conducts, and the battery pushes.'
  - text: 'It flashes brilliantly and dies within a fraction of a second.'
    correct: true
    why: 'Once an LED conducts it has almost no resistance, so nothing limits the current. The simulator reports about 3 A, a hundred times what the LED can stand. By the end of this chapter you will be able to calculate that number, and the resistor that prevents it.'
  - text: 'Nothing: 9 V is too low for an LED.'
    why: 'An LED needs less than 2 V to light. The trouble is that 9 V is far too much.'
```

## Resistance and Ohm’s law

In Chapter 1’s lab a 1 kΩ resistor turned every volt into a milliampere: 3 V gave 3 mA, 9 V gave 9 mA. A resistor is a component that makes the current through it proportional to the voltage across it. The constant of proportionality is its :term[resistance]{id=resistance} *R*, measured in ohms (Ω), and the rule is :term[Ohm’s law]{id=ohms-law}:

:::equation{#ohm caption="Ohm’s law: one equation, three ways round."}
$$V = I\,R \qquad\Longleftrightarrow\qquad I = \frac{V}{R} \qquad\Longleftrightarrow\qquad R = \frac{V}{I}$$
:::

One ohm is one volt per ampere. The equation reads best as a cause and an effect: put a voltage *across* a resistor and the resistor decides the current *through* it. Across 5 V, a 1 kΩ resistor passes 5 mA; a 330 Ω resistor passes 15 mA; a 10 kΩ resistor passes half a milliampere. Resistors are the standard way to choose a current, and choosing currents is most of what a designer of digital circuits does at the edges of a chip.

Ohm’s law is a property of some materials, not a law of nature. Metals and carbon obey it well; a lamp filament does not, because its resistance rises as it gets hot (the 6 V, 0.3 W lamp of Chapter 1 is 120 Ω when lit, about a tenth of that when cold); and diodes and LEDs, which you meet in Chapter 7, do not even come close. The simulator honours all of this: it has the equation only where it is true.

:::note[Why wires do not count]
Copper is a resistor too, but a very small one. A metre of 1 mm² copper wire has a resistance of about 17 mΩ (copper’s resistivity is 1.7 × 10⁻⁸ Ω·m, and *R* = ρ*L*/*A*). A 10 A current through it drops only 0.17 V, which is why circuit diagrams treat wires as perfect conductors and every point on one wire as having the same voltage. It is also why a long, thin extension lead can get warm: the drop is small, but the power is not, as the next section will show.
:::

:::history{year=1827 title="Ohm’s Die galvanische Kette" people="Georg Simon Ohm" source="Sources: Ohm (1827); Caneva (1978); Hunt (1994)."}
In 1827 a schoolteacher published the law that every electrician now uses, and most German physicists could not follow it.

Georg Simon Ohm taught mathematics and physics at a Jesuit school in Cologne, and did his experiments with home-made apparatus. In his book *Die galvanische Kette, mathematisch bearbeitet* (“The galvanic circuit, treated mathematically”), published in Berlin in 1827, he derived the relation between voltage, current and resistance, modelling the current on Fourier’s theory of heat: charge flowing down a difference of potential as heat flows down a difference of temperature.:cite[ohm1827]

The book was badly received. In the 1820s few German physicists had the mathematics to read it, and those who could disliked its approach: one hostile review came from Georg Pohl in Berlin, and a critic is often quoted as dismissing it as “a web of naked fancies”.:cite[caneva1978] Ohm’s hopes of a university post faded, and it took until 1841 for the Royal Society in London to award him its Copley Medal. In 1852, two years before his death, he became professor of experimental physics in Munich. The unit of resistance carries his name; it was adopted internationally by the International Electrical Congress in Paris in 1881.:cite[hunt1994]
:::

## Power, energy and heat

Chapter 1 defined voltage as energy per coulomb and current as coulombs per second. Multiply them and the coulombs cancel:

$$V \times I = \frac{E}{Q} \times \frac{Q}{t} = \frac{E}{t}$$

Energy per second is :term[power]{id=power}, measured in watts (W). So the power delivered to anything, whatever it is, is:

:::equation{#power caption="Power is voltage times current. For a resistor, Ohm’s law gives two more forms."}
$$P = V\,I = I^2 R = \frac{V^2}{R}$$
:::

In a resistor all of that power becomes heat. Which of the three forms you use depends on what you know: 5 V across 1 kΩ is *V*²/*R* = 25 mW; 20 mA through 390 Ω is *I*²*R* = 156 mW; 2 A from a 5 V charger is *V I* = 10 W.

Two consequences are worth remembering. First, the power depends on the *square* of the voltage or current. Double the voltage across a resistor and the current doubles too, so the power is four times as great. Second, every resistor has a **power rating**, the heat it can lose without damage. The common resistors in this course are ¼ W (250 mW) parts: they are fine with 25 mW, warm with 156 mW and sizzle at 1 W.

```quiz
q: 'A resistor has 5 V across it and dissipates 25 mW. You raise the voltage to 10 V. What is the power now?'
options:
  - text: '50 mW: twice the voltage, twice the power.'
    why: 'Twice the voltage also gives twice the *current*, and the power is voltage times current.'
  - text: '100 mW.'
    correct: true
    why: 'P = V²/R: doubling V multiplies the power by four. Voltage and current both double, and the two doublings multiply.'
  - text: '25 mW: it is the same resistor.'
    why: 'The resistance is the same, but the voltage across it, and so the current and the power, are not.'
```

Energy is power times time: a watt for a second is a joule. A 100 W lamp burning for ten hours uses a kilowatt-hour, the unit on the electricity bill; a AA cell (1.5 V, 2,500 mAh, or 9,000 C) holds 13.5 kJ, which is 3.75 Wh.

:::note[Why the grid uses high voltage]
The same power can be sent as a small voltage and a big current or the other way round. But the wires lose *I*²*R*, so ten times the voltage means a tenth of the current for the same power, and *a hundredth* of the heat lost in the cables. That is why power lines run at hundreds of kilovolts and your phone charger steps that down in stages. The chips in this course have the opposite problem: a modern processor dissipates 100 W in a few square centimetres, and *all* of it is heat.
:::

## Series and parallel

Real circuits have more than one resistor, and two ways of joining them.

In :term[series]{id=series}, resistors are joined end to end. The same current has to pass through each, and the voltages add, so the total resistance is the sum:

$$R = R_1 + R_2 + \dots$$

In :term[parallel]{id=parallel}, resistors are joined side by side across the same two points. They all have the same voltage across them, and the currents add. Each resistor takes *V*/*R*, so the *reciprocals* add:

$$\frac{1}{R} = \frac{1}{R_1} + \frac{1}{R_2} + \dots \qquad\text{for two: } R = \frac{R_1 R_2}{R_1 + R_2}$$

Two things follow. A parallel combination is always smaller than the smallest resistor in it, because you have given the current an extra path: 1 kΩ ∥ 1 kΩ is 500 Ω, and 1 kΩ ∥ 1 MΩ is 999 Ω, not much less than 1 kΩ. And in series the *largest* resistor dominates, as in parallel the smallest does. A 1 MΩ resistor in series with a 100 Ω one is, for practical purposes, 1 MΩ.

:::programmer[Conductance adds in parallel]
The reciprocal of resistance is :term[conductance]{id=conductance}, *G* = 1/*R*, measured in siemens (S). In terms of *G* the rules are the ones a programmer would guess: in parallel the conductances simply add, like lanes on a road each carrying its own traffic, and in series the *resistances* add, like the latencies of stages in a pipeline. The simulator works in conductances throughout, as the box near the end of this chapter shows.
:::

To see what series and parallel do, think about two lamps.

```quiz
q: 'Two identical 6 V lamps are connected to a 6 V battery: one pair in series, and the other pair in parallel. Which pair is brighter?'
options:
  - text: 'The series pair: the current goes through both lamps, so they get more.'
    why: 'In series the two lamps *share* the battery’s 6 V, so each gets only half of it.'
  - text: 'The parallel pair: each lamp is connected directly across the battery.'
    correct: true
    why: 'Each parallel lamp gets the battery’s full 6 V. In series each gets 3 V: a lamp at half voltage gives about a tenth of its full light.'
  - text: 'They are equally bright: the battery supplies the same energy either way.'
    why: 'The battery supplies about twice the current for the parallel pair, and so about twice the power, and the lamps at full voltage give ten times the light.'
```

::circuit{src="02-ohms-law/circuits/series-parallel.json" n="2.1" title="Two lamps: in series, and in parallel" scale=1.2 current=true caption="The same battery and the same lamps, joined two ways. Hover over a lamp for its voltage and current. In series each lamp has about 3 V and the battery supplies 47 mA; in parallel each has 6 V and the battery supplies 100 mA, twice one lamp’s 50 mA."}

Notice the numbers. The parallel pair takes exactly twice the current of one lamp (each lamp has its own path to the battery), and the series pair takes *not* half of it: 47 mA, not 25. That is Ohm’s law failing quietly. At 3 V each lamp filament is cooler, so its resistance has dropped to about 63 Ω from 120 Ω, and the current is higher than the arithmetic with hot resistances would suggest. A resistor would have done what the equation says; a lamp is not a resistor.

## Voltage dividers

Put two resistors in series across a battery and you have a :term[voltage divider]{id=voltage-divider}. The current is the same in both: *I* = *V*in / (*R*₁ + *R*₂). The voltage across the lower one is that current times *R*₂:

:::equation{#divider caption="The voltage divider: the output is the input times the lower resistor’s share of the total."}
$$V_\text{out} = V_\text{in}\,\frac{R_2}{R_1 + R_2}$$
:::

Equal resistors give half the input. If the lower resistor is a ninth of the upper one, the output is a tenth of the input, because *R*₂/(*R*₁ + *R*₂) = 1/(9 + 1). The two drops always add up to the battery: the divider takes the battery’s voltage and splits it in proportion to the resistances.

::divider-lab{n="2.2" caption="Change the battery and the two resistors and compare the voltmeter with the formula. Try making R1 ten times bigger than R2, then swap them. The voltmeter across R1 shows the rest of the battery’s voltage."}

The formula assumes *nothing else is connected to the output*. When something is, it is in parallel with *R*₂, and lowers the lower resistance. A divider of two 10 kΩ resistors gives half its input, but connect a 10 kΩ load to the output and the lower half becomes 10 kΩ ∥ 10 kΩ = 5 kΩ, so the output falls to 5/(10 + 5) = one third. A divider works when the load is much larger than *R*₂, which is one reason inputs of logic chips are made to draw almost no current.

Dividers are everywhere in digital circuits, in two forms.

**Level references.** A divider makes any voltage between 0 and the supply. Two equal resistors give half the supply, the mid-point that comparators and analogue-to-digital converters (Chapter 24) use as a reference; a 1 kΩ and 2 kΩ pair turns a 5 V signal into 5 × 2/3 = 3.3 V, which is how a 5 V output is often connected to a 3.3 V input.

**Pull-ups.** The most common resistor in digital design is a divider with one resistor replaced by a switch. Connect a chip’s input to the supply through a 10 kΩ :term[pull-up]{id=pull-up} resistor, and to ground through a button. Released, nothing pulls current through the resistor, so there is no drop across it and the input sits at the supply voltage: a logic 1. Pressed, the button shorts the input to ground: a 0, with 5 V / 10 kΩ = 0.5 mA flowing through the resistor. The resistor *pulls the input up* to a defined level when nothing else is driving it.

::circuit{src="02-ohms-law/circuits/pull-up.json" n="2.3" title="A pull-up resistor" current=true caption="Hold the button down (click and hold, or press Space). The voltage at the input falls from 5 V to 0 V, and 0.5 mA flows through the resistor while you press. Choose Logic to see the wire’s colour show a logic 1 or a 0."}

Without the resistor, the input would be left *floating* when the button is released, connected to nothing, and could read as either level, or wander with every nearby signal. Chapter 10 returns to that.

## Kirchhoff’s laws

Ohm’s law is about one component. Two rules of Gustav Kirchhoff’s cover a whole circuit, and together with Ohm’s law they are enough to solve *any* network of resistors.

**The :term[current law]{id=kcl}.** The currents flowing *into* a junction add up to the currents flowing *out* of it. Charge does not pile up at a junction, and it does not vanish, so what arrives must leave. It is the rule you used when you saw that the same 50 mA passed through every part of a loop.

**The :term[voltage law]{id=kvl}.** Going round any closed loop, the voltage rises and falls add up to zero. In terms of Chapter 1: a coulomb that goes round a loop and returns to where it started has the same energy as before, so whatever it gained in the battery it must have lost in the resistors. In the divider, the battery’s 9 V rise equals the 6 V and the 3 V drops.

::kcl-lab{n="2.4" caption="Three ammeters around a junction. Change R2 and R3 and watch: whatever the resistors are, the current arriving through A1 equals the currents leaving through A2 and A3 added together."}

:::history{year=1845 title="Kirchhoff’s laws, as a student" people="Gustav Robert Kirchhoff" source="Sources: Kirchhoff (1847); Encyclopaedia Britannica."}
In 1845 a 21-year-old student in Königsberg worked out the two rules that let you solve any electrical network.

Gustav Kirchhoff was born in Königsberg in 1824 and studied there under the physicist Franz Neumann. Ohm had treated a single circuit; Kirchhoff, still a student, asked what happens in a network with many branches, and found the two rules named after him, the conservation of charge at a junction and of energy round a loop.:cite[kirchhoff1847] He published a first account in 1845 and the general solution in 1847, in a paper that showed how to choose independent loops by picking a spanning tree of the network. That paper is often counted among the first uses of graph theory.

He went on to more famous work: with Robert Bunsen in Heidelberg he founded spectroscopy in 1859–60 and formulated the law of thermal radiation that also carries his name.:cite[britannica-kirchhoff]
:::

:::programmer[A circuit is a graph]
Draw a circuit and forget the symbols, and what is left is a graph. The **nodes** are the points that are joined by wire, and so are at one voltage; the **branches** (edges) are the components, each joining two nodes. Kirchhoff’s current law says the *flow* into every node equals the flow out, which is flow conservation at each vertex. His voltage law says you can assign every node a single number, its voltage, so that the voltage across a branch is the difference of its ends’ numbers, which makes the loop law true automatically. So solving a circuit means finding one number per node:

```ts
interface Branch { from: number; to: number; g: number }  // g = 1/R, in siemens
const current = (b: Branch, v: number[]) => b.g * (v[b.from]! - v[b.to]!);
// the current law at node k: sum of current(b, v) over the branches leaving k is 0
```

That is a system of linear equations, one per node. The box at the end of this chapter shows how the simulator writes them down and solves them.
:::

## The voltage landscape

Now bring the pieces together in one picture. The circuit below has a battery and four resistors: R1 from the battery to a node A; from A, a path straight to ground through R2; and a second path from A through R3 to a node B and through R4 to ground. Here is the trick that makes it readable: **draw every node at a height equal to its voltage.**

Then a wire is a flat plateau, because everything on it has the same voltage. A resistor is a slope, from the higher voltage down to the lower one. The battery is a lift, as tall as its voltage. And a current is a stream of balls rolling downhill, up the lift, and round again. Each ball stands for a fixed amount of charge, and going down a slope, it gives its energy to the resistor as heat.

The picture makes both of Kirchhoff’s laws visible. *Voltage law:* walk round any loop and you go down exactly as much as you go up, because you come back to where you started. *Current law:* the balls that reach the junction at A split between the two slopes leaving it, and as many leave as arrive.

```quiz
q: 'In the landscape below, R1 is the first slope, from the battery down to node A. If you turn R1 up from 1 kΩ to 10 kΩ, what happens to the height of node A?'
options:
  - text: 'It rises: a bigger resistor holds back more voltage.'
    why: 'It does hold back more voltage, but on *its own* side: the bigger R1 takes a bigger share of the battery’s 9 V, leaving less for what comes after it.'
  - text: 'It falls: R1 takes a bigger share of the 9 V drop, so less is left at A.'
    correct: true
    why: 'This is the divider again. R1 is the upper resistor, and the node after it sits at the *lower* resistor’s share of the total. A bigger R1 lowers that share.'
  - text: 'It does not change: A is fixed by the battery.'
    why: 'The battery fixes the height of the *lift*. The plateaus after a resistor are set by how the total drop is shared.'
```

::voltage-landscape{n="2.5" caption="Drag the landscape to turn it; hover over a plateau, a slope or the lift for numbers. Change the battery and the resistors and watch the terrain reshape, while the balls keep the currents honest. The table and the two lines under the picture give the exact numbers."}

:::lab[Reshape the landscape]
1. Leave the resistors as they are and raise the battery from 9 V to 12 V. Every height scales by the same factor, and so does every current: nothing else changes. This is why circuits are called linear.
2. Set the battery to 9 V again and turn R1 down to its minimum. The first slope nearly vanishes and node A rises to about 8 V, almost the top of the lift, since little voltage is dropped across R1. Now turn R1 up to its maximum and watch A sink.
3. Turn R2 up to 10 kΩ (a very gentle branch). The balls now prefer the other path, but the *sum* of the currents in the two branches stays equal to the current in R1: check it in the line under the picture.
4. Which resistor has the steepest slope? Which has the fastest balls? They are not always the same: the slope is set by *I*·*R*, the speed of the balls by *I* alone.
5. Compare with the schematic: hover over R3 in the picture and its symbol lights up. Find the same node in both.
:::

## Ratings, and the magic smoke

Every part has limits. A resistor can lose only so much heat, an LED can carry only so much current, a capacitor can hold only so many volts. Go past the limit and the part fails, permanently, and the way it fails, with a puff, is the magic smoke. The simulator knows each part’s rating and burns it when it is exceeded for long enough, which makes it a safe place to find out what the limits are.

Here is the prediction from the start of the chapter. The LED is red, and the battery is 9 V; the switch is open.

::circuit{src="02-ohms-law/circuits/led-no-resistor.json" n="2.6" title="An LED straight on a battery" current=true caption="Close the switch, then press Reset (the arrow at the top right of the frame) to replace the LED. Watch the ammeter in the first instants: the reading before the LED gives out is the current it was asked to carry."}

The reason is in the numbers. A red LED conducts once it has about 1.85 V across it, and above that it behaves like a small resistor of a couple of ohms. With 9 V from the battery, 7.15 V is left over, and the only things left to limit the current are the LED’s 2 Ω, the battery’s internal 0.2 Ω and the ammeter’s 0.1 Ω: the current is 7.15 V / 2.3 Ω = 3 A, a hundred times more than the LED’s 30 mA limit. It is dissipating some 24 W in a plastic bead 5 mm across, and it lasts well under a tenth of a second.

The cure is a resistor in series, which takes the leftover voltage. The design rule has three steps:

1. Choose the current the LED should carry: 20 mA is a good, bright value for a red LED.
2. The resistor must drop everything the LED does not: 9 V − 1.85 V ≈ 7 V.
3. Ohm’s law gives the value: *R* = 7 V / 20 mA ≈ 350 Ω. Resistors come in a standard series of values, the E12 series (10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82, and their tens multiples), so choose the next value *up*, 390 Ω, so that the current is a little less than the target rather than a little more.

The check: the current is (9 − 1.9) V / 390 Ω = 18 mA, and the power in the resistor is *I*²*R* = 0.018² × 390 = 0.13 W, comfortably inside a ¼ W part. Try it yourself, and try the values either side.

::led-resistor{n="2.7" caption="Slide through the E12 resistors and read the LED’s current, the resistor’s power and the verdict. Which is the smallest value that keeps the current at or below 20 mA? What happens with 47 Ω?"}

:::warning[Do not try this with a real LED]
The simulator lets a virtual LED die as often as you like. A real one, on a real 9 V battery, will pop, can get hot enough to burn, and may throw a splinter of plastic. Always put the resistor in first.
:::

## Under the hood

:::hood[How the simulator solves a circuit: nodes, stamps and LU]
The analog engine has one job: given the circuit, find the voltage of every node. It uses **nodal analysis**. Write Kirchhoff’s current law for each node: the currents leaving it through the resistors add up to whatever is injected. A resistor of conductance *g* between nodes *a* and *b* carries *g*(*V*<sub>a</sub> − *V*<sub>b</sub>) from *a* to *b*, so the equation for node *a* has *g* on its diagonal and −*g* in the column of *b*. Solving the network is solving a system of linear equations, *A* **x** = **b**, with one row per node. Each component *stamps* its own contribution into the matrix. Here is the resistor’s entire model (`src/lib/sim/analog/models/passive.ts`), and the stamping function it calls (`device.ts`):

```ts
registerAnalogModel('resistor', (env) => {
  const p = { ...env.element.params };
  const [a, b] = [env.nodes[0]!, env.nodes[1]!];
  const R = () => Math.max(1e-6, num(p, 'resistance', 1000));
  ...
  const g = () => (burned ? G_OPEN : 1 / R());
  return {
    stamp(c) {
      conductance(c, a, b, g());
    },
```

```ts
/** A conductance g between nodes a and b. */
export function conductance(c: StampContext, a: number, b: number, g: number): void {
  const n = c.n;
  const A = c.A;
  if (a >= 0) {
    A[a * n + a] = A[a * n + a]! + g;
    if (b >= 0) {
      A[a * n + b] = A[a * n + b]! - g;
      A[b * n + a] = A[b * n + a]! - g;
    }
  }
  if (b >= 0) A[b * n + b] = A[b * n + b]! + g;
}
```

A node index of −1 means ground, whose voltage is zero and which therefore needs no equation: the `if (a >= 0)` tests just skip it. A battery is stamped the same way: its small internal resistance as a conductance, with a current source in parallel (its EMF divided by that resistance). An *ideal* voltage source, such as the bench supply, adds one more unknown, its current, and one more equation (*V*₊ − *V*₋ = the set voltage); that is what makes the method “modified” nodal analysis. When a resistor burns, `g` becomes `G_OPEN`, 10⁻¹² S, and the next stamp lays down an open circuit.

Each step of the engine clears the matrix, lets every device stamp itself, and solves (`engine.ts`):

```ts
A.fill(0);
b.fill(0);
...
for (const d of this.devices) d.stamp(ctx);

if (!this.factored || !sameMatrix(A, this.Af)) {
  this.Af.set(A);
  lu.factor(A);
  ...
}
this.consistent = lu.solve(b, xn, this.Af);
```

The solver is **LU decomposition**, which is Gaussian elimination remembered as two triangular matrices, so that a new right-hand side costs only two sweeps. Here is its inner loop (`lu.ts`), which subtracts a multiple of the pivot row from each row below it, after choosing the largest entry in the column as the pivot for accuracy, followed by the two sweeps that solve:

```ts
const inv = 1 / piv;
const rk = k * n;
for (let i = k + 1; i < n; i++) {
  const ri = i * n;
  const l = a[ri + k]! * inv;
  if (l === 0) continue;
  a[ri + k] = l;
  for (let j = k + 1; j < n; j++) a[ri + j] = a[ri + j]! - l * a[rk + j]!;
}
```

```ts
for (let i = 1; i < n; i++) {
  const ri = i * n;
  let s = y[i]!;
  for (let j = 0; j < i; j++) s -= a[ri + j]! * y[j]!;
  y[i] = s;
}
...
for (let i = n - 1; i >= 0; i--) {
  const ri = i * n;
  let s = y[i]!;
  for (let j = i + 1; j < n; j++) s -= a[ri + j]! * x[j]!;
  x[i] = s / a[ri + i]!;
}
```

Notice the check `sameMatrix`: when only the right-hand side changes, or nothing at all, the factorisation is reused, and a linear circuit costs a few multiplications per step. The voltage landscape above is exactly this: each time you move a slider, one `setParam` and one `settle()`, and the engine hands back the node voltages.
:::

:::deeper[Solving a three-node network by hand]
Take the landscape’s circuit with 9 V, R1 = 1 kΩ, R2 = 2 kΩ and R3 = R4 = 1 kΩ. The battery fixes node P at 9 V; the unknowns are the voltages *V*_A and *V*_B. Work in conductances (in millisiemens): *g*₁ = 1, *g*₂ = 0.5, *g*₃ = *g*₄ = 1. Kirchhoff’s current law at each node says what leaves through resistors equals what arrives:

$$\text{A:}\quad g_1(9 - V_A) = g_2 V_A + g_3 (V_A - V_B)$$
$$\text{B:}\quad g_3 (V_A - V_B) = g_4 V_B$$

Collect the unknowns on the left, as the stamps do:

$$\begin{pmatrix} g_1 + g_2 + g_3 & -g_3 \\ -g_3 & g_3 + g_4 \end{pmatrix}\begin{pmatrix} V_A \\ V_B \end{pmatrix} = \begin{pmatrix} 9\,g_1 \\ 0 \end{pmatrix} \quad\Rightarrow\quad \begin{pmatrix} 2.5 & -1 \\ -1 & 2 \end{pmatrix}\begin{pmatrix} V_A \\ V_B \end{pmatrix} = \begin{pmatrix} 9 \\ 0 \end{pmatrix}$$

The diagonal entries are the total conductance leaving each node; the off-diagonal ones are minus the conductance between two nodes. That is what the stamps produce. Now eliminate, exactly as the LU loop does. The second row gives *V*_A = 2*V*_B; putting it into the first row: 5*V*_B − *V*_B = 9, so *V*_B = 2.25 V and *V*_A = 4.5 V. The currents follow from Ohm’s law: 4.5 mA through R1, 2.25 mA through R2 and 2.25 mA through R3 and R4. Check both laws: 4.5 = 2.25 + 2.25 at A, and 9 = 4.5 + 4.5 round the first loop. These are the numbers the landscape shows when you first open it.
:::

## Build it for real

:::real{parts="breadboard, 9 V battery with clip, red LED, 390 Ω resistor (¼ W), 10 kΩ and 20 kΩ resistors, multimeter, jumper wires"}
**LED and resistor.** On the breadboard connect the battery’s + lead to one end of the 390 Ω resistor, the other end of the resistor to the LED’s *long* leg (the anode) and the LED’s short leg (the cathode) to the battery’s − lead. The LED should light, and it is happy to stay lit. Then measure: with the meter on DC volts, the voltage across the resistor should be about 7 V and across the LED about 1.9 V, adding up to the battery’s 9 V (Kirchhoff’s voltage law), and the meter set to the mA range *in series* should read about 18 mA. If the LED does not light, it is the wrong way round; swap its legs.

**A divider.** Join the 10 kΩ and 20 kΩ resistors end to end across the battery. Predict the voltage across the 20 kΩ one (9 × 20/30 = 6 V) and the current (0.3 mA), then measure both. Now connect your meter’s own input as a load: an ordinary meter is 10 MΩ, which barely disturbs a 20 kΩ resistor. Replace the 20 kΩ by a 10 MΩ resistor and the meter’s own resistance halves it. That is loading, and it is why the simulator’s voltmeter is 10 MΩ too.
:::

## Exercises

```quiz
q: 'A 330 Ω resistor is connected across a 5 V supply. What current flows, and how much power does it dissipate?'
options:
  - text: '15 mA and 76 mW.'
    correct: true
    why: 'I = V/R = 5/330 = 15.2 mA, and P = V·I = 5 × 0.0152 = 76 mW, comfortably inside a ¼ W rating.'
  - text: '66 mA and 330 mW.'
    why: 'You have multiplied where you should have divided: 5 × 330 is not a current. Ohm’s law is I = V/R.'
  - text: '15 mA and 250 mW.'
    why: 'The current is right, but 250 mW is the resistor’s *rating*, not its dissipation. P = V·I gives 76 mW.'
```

```quiz
q: 'A 9 V battery feeds a divider of R1 = 6 kΩ (upper) and R2 = 3 kΩ (lower). What is the voltage at the junction between them, and what does the battery supply?'
options:
  - text: '3 V, and 1 mA.'
    correct: true
    why: 'The total is 9 kΩ, so I = 9/9000 = 1 mA, and the lower resistor drops 1 mA × 3 kΩ = 3 V. Check with the formula: 9 × 3/(6 + 3) = 3 V.'
  - text: '6 V, and 1 mA.'
    why: 'That is the voltage across R1, the *upper* resistor. The output is measured across the lower one.'
  - text: '4.5 V, and 1.5 mA.'
    why: 'The output is half the input only when the two resistors are equal. Here R1 is twice R2.'
```

```quiz
q: 'A divider of two 10 kΩ resistors is loaded by a 10 kΩ resistor connected from the output to ground. The unloaded output was 4.5 V from 9 V. What is it now?'
options:
  - text: '3 V.'
    correct: true
    why: 'The load is in parallel with the lower resistor: 10 kΩ ∥ 10 kΩ = 5 kΩ. The divider is now 10 kΩ over 5 kΩ, and 9 × 5/(10 + 5) = 3 V.'
  - text: '4.5 V: the divider does not care what is connected to it.'
    why: 'It cares a great deal. The load becomes part of the lower resistance.'
  - text: '2.25 V.'
    why: 'That would be a load of about 3.3 kΩ. Work out the parallel combination first.'
```

```quiz
q: 'Three currents meet at a junction. Two flow in, of 3 mA and 5 mA. The third flows out. What is it?'
options:
  - text: '8 mA.'
    correct: true
    why: 'Kirchhoff’s current law: what flows in, 3 + 5 = 8 mA, must flow out.'
  - text: '2 mA.'
    why: 'That would be the difference. The law says the currents in and out are equal in total, so the one that leaves carries both.'
  - text: 'It depends on the resistors.'
    why: 'The resistors decide how the current *divides* between branches, but not how much arrives: charge is conserved.'
```

:::challenge[Pick the resistor]
You want a green LED (forward voltage about 2.1 V, at 10 mA) to shine from a 5 V USB supply. Calculate the resistor by the three-step rule, choose the next E12 value up, and check the resistor’s power. (Answer: (5 − 2.1)/0.01 = 290 Ω, so 330 Ω; it passes about 8.8 mA and dissipates 26 mW.) Then work out what a 3.3 V supply would need for a blue LED at 3.1 V and 10 mA, and notice how little is left over for the resistor to do: (3.3 − 3.1)/0.01 = 20 Ω, a value whose accuracy matters a great deal. Chapter 7 explains why LED voltages differ.
:::

## What’s next

You now have the working laws of every circuit in this course: Ohm’s law for a component, Kirchhoff’s laws for how components join, power and ratings for how far they can be pushed, and the divider for making any voltage you need. Chapter 3 is an interlude: before going further you will meet the instruments you have been using in the simulator, the multimeter, the bench supply, the oscilloscope and the logic probe, and learn what each one measures and how it can mislead you. Then Chapter 4 adds time to the story with the capacitor.
