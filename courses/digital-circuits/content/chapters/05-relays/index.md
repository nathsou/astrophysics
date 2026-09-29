---
number: 5
title: Electromagnets and relays
summary: Current makes magnetism, magnetism moves a switch, and a relay at the end of a long telegraph line restores a signal that the line has weakened.
duration: About 1 hour
prerequisites: [capacitors-and-time]
---

Press a key at one end of a wire and light a lamp at the other. That is a telegraph, and by the 1830s it worked across a room, then across a town. But make the wire ten times longer and the lamp stops glowing, although the key, the battery and the lamp are all as good as before. The wire is to blame. Every kilometre of iron adds about 8 Ω, so a long line is a big resistor in series with the lamp, and the lamp gets a small fraction of the battery's power.

You cannot fix that with a bigger battery for ever. The fix that worked, and that matters for the rest of this course, was a new kind of switch: one that needs only a *whisper* of current to close, and then connects a fresh battery to the next stretch of wire. It was made from a wire wound in a coil, a lump of iron and a spring, and it is called a :term[relay]{id=relay}. At the end of the chapter you will run a telegraph line with and without one. Before that we need the physics of the coil, and, on the way, a nasty surprise that every relay driver has to deal with.

## Current makes magnetism

In 1820 the Danish physicist Hans Christian Ørsted was demonstrating a battery, according to the usual account at a lecture in April, when a compass needle on the bench swung away from north as the current started in a nearby wire. A current is not only heat in a wire: it is surrounded by a magnetic field, curling round the wire like a ribbon round a pole. Ørsted announced it that summer, in a short Latin pamphlet, and within months others all over Europe were repeating the experiment.:cite[oersted1820]

:::history{year=1820 title="Ørsted’s compass" people="Hans Christian Ørsted" source="Sources: Ørsted (1820); American Physical Society (2008)."}
A compass needle beside a wire swung when the battery was connected, and connected two subjects that everyone had assumed were unrelated: electricity and magnetism.

Ørsted had long suspected that the two forces were linked, but one might have expected the wire to act like a magnet pointing along it. What he found was stranger: the force on the needle was *sideways*, at right angles to the wire, and reversing the current reversed the swing. He described his experiments in a pamphlet dated 21 July 1820 and sent it to scientific societies across Europe.:cite[oersted1820]:cite[aps-oersted] Within weeks André-Marie Ampère in Paris had shown that two current-carrying wires attract or repel each other.
:::

The size of the effect is easy to state. At a distance *r* from a long straight wire carrying a current *I*, the field has strength

$$B = \frac{\mu_0 I}{2\pi r}, \qquad \mu_0 = 4\pi \times 10^{-7}\ \mathrm{T\,m/A}.$$

Field strength is measured in **tesla** (T). Put in numbers: 1 A at 1 cm gives 20 µT (that is 2 × 10⁻⁷ × 1 ÷ 0.01). The part of the Earth's field that points along the ground is about 20 µT where Ørsted worked, so a single ampere close to the compass is as strong as the Earth's own field. That is why Ørsted's experiment worked at all, and why it needed a battery with real current: a wire carrying a milliamp moves nothing.

```quiz
q: 'You wind a wire into a coil of 100 turns and put a rod of soft iron inside it. Compared with the same current in a single straight loop of wire, roughly how much stronger is the field inside?'
options:
  - text: 'About 100 times: one for each turn.'
    why: 'The turns do multiply the field by 100. But the iron does much more than that.'
  - text: 'Tens of thousands of times or more: 100 for the turns and hundreds more from the iron.'
    correct: true
    why: 'Each turn adds its own field (× 100), and soft iron has a relative permeability of hundreds to thousands (typically × 200–5,000 in a working core), because its atoms line up with the field and add their own. The two effects multiply. The pull, which goes as the square of the field, grows by some eight to ten orders of magnitude.'
  - text: 'About twice as strong: iron is only a little better than air.'
    why: 'Iron is not like air. Its little magnetic domains line up with the coil’s field and add enormously to it.'
```

The field of one turn is feeble, but the field lines of the turns all pass through the middle of the coil in the same direction, so they add: *N* turns give *N* times the field. Slide a rod of soft iron into the coil and the iron's own atomic magnets line up with the field and add theirs, multiplying it by a factor of hundreds. That is an :term[electromagnet]{id=electromagnet}. It has two properties that no permanent magnet has: it switches off, and it can be made as strong as you like, until the iron *saturates*, when all its atoms are lined up and nothing more can be added (about 1.6 T for the soft iron of a small core). Try it below.

::electromagnet{n="5.1"}

Notice how the pull on the plate jumps between stages 2 and 3: force goes as the *square* of the field (for a plate against the core, *F* = *B*²*A* ÷ 2*μ*₀), so a field 500 times stronger pulls with a force 250,000 times greater. The Englishman William Sturgeon made the first electromagnet that could lift more than its own weight in 1824: a horseshoe of iron wound with about 18 turns of bare copper wire (one of his models, a seven-ounce piece of iron, lifted nine pounds).:cite[sturgeon-britannica] Seven years later an American schoolteacher made a far bigger one.

:::history{year=1831 title="Henry’s magnets" people="Joseph Henry" source="Sources: Princeton Joseph Henry Project; Hochfelder (Smithsonian Institution Archives)."}
Joseph Henry, teaching at the Albany Academy in New York, wound insulated wire many times round an iron horseshoe, and lifted 750 pounds. Then he made the relay.

Sturgeon's magnets used bare wire, so the turns had to be kept apart or they would short-circuit each other. Henry insulated the wire with silk, so that he could wind many layers of turns close together. By 1831 his electromagnet at the Albany Academy lifted 750 pounds (about 340 kg).:cite[henry-albany] He also found that a magnet wound with many turns of thin wire ("intensity" magnet) worked best on a long line of high resistance, while a few turns of thick wire ("quantity" magnet) worked best close to the battery. In 1835 he used a small, sensitive intensity magnet at the end of a long wire to open and close the circuit of a big, powerful quantity magnet with its own battery: a **relay**, and the ancestor of every repeater in this chapter.:cite[hochfelder-henry]
:::

## A coil resists change

There is one more effect, and it matters for everything that follows: the moment you change the current in a coil, the coil pushes back.

Here is why. The field of the coil is proportional to the current. If the current changes, the field, and therefore the magnetic flux through the coil, changes, and a changing flux induces a voltage in the wire that made it. The direction is such that it *opposes* the change: try to increase the current and the coil pushes back; try to decrease it and the coil pushes forward. A coil is an **inductor**, and its property is its :term[inductance]{id=inductance} *L*, measured in henries (H). The voltage across it is proportional to how fast the current is changing:

:::equation{#inductor caption="An inductor’s voltage is its inductance times the rate of change of its current."}
$$\term{v}{V} = \term{l}{L}\,\frac{\term{di}{\Delta I}}{\term{dt}{\Delta t}}$$

```terms
v:
  label: 'V'
  what: The voltage across the coil, in volts.
  why: It is not proportional to the current, but to how fast the current is *changing*. A steady current, however large, produces no voltage across an ideal coil at all.
  effect: Double the rate of change and the voltage doubles.
l:
  label: 'L, the inductance'
  what: How strongly the coil resists change, in henries (H). It grows with the square of the number of turns and with the permeability of the core.
  why: A coil with more turns makes more flux for the same current, and each turn feels all of it.
  effect: A bigger L means a slower change for the same voltage. A small relay coil is about 0.1 H (it varies with the armature position).
di:
  label: 'ΔI'
  what: The change in the coil’s current over a short time Δt.
  why: What the coil opposes is *change*; its state is the current, and the current cannot jump.
  effect: The larger the change demanded in a short time, the larger the voltage the coil produces.
dt:
  label: 'Δt'
  what: The short time in which the current changed.
  why: The same change in a shorter time means a faster rate, and so a bigger voltage.
  effect: Halving the time doubles the voltage. In the limit of an instant change, the voltage is unbounded. Keep that in mind for the next section.
```
:::

The best picture is a flywheel. Think of the current as the flywheel's speed, and the voltage that you apply as the torque of the hand that pushes it. A heavy flywheel (large *L*) takes a long push to get up to speed, and once it is spinning it keeps spinning; you cannot make it change speed instantly, however hard you push. An older picture: a heavy paddle wheel in a pipe. Water (current) turns the wheel, and the wheel's inertia resists any change in the flow.

Compare this with the capacitor of Chapter 4, which resists changes in *voltage*: it is the mirror image, and the equations have the same form. Its flywheel is a bucket that has to fill before the level rises.

A coil connected to a battery, then, does not reach its final current at once. It climbs in an exponential curve towards *V* ÷ *R*, where *R* is the resistance of the wire, with a time constant τ = *L* ÷ *R* (the same shape as the RC curve of Chapter 4, but for current). The circuit below has two branches from one battery: a 60 Ω resistor, and a coil of 1 H whose wire also happens to have 60 Ω.

::circuit{src="05-relays/circuits/rl-coil.json" n="5.2" title="A resistor and a coil, side by side" current=true speed=0.02 caption="Close the switch. The resistor’s ammeter jumps to 100 mA at once; the coil’s climbs, taking about τ = L ÷ R = 1 H ÷ 60 Ω = 17 ms to reach 63 % of its final value, and about five times that to settle. (The figure runs 50 times slower than real life so that you can see it.)"}

:::programmer[A coil is a variable you cannot assign to]
Think of the current in a coil as a piece of *state* in a program: a variable that exists between events and is updated by a rule, `I += (V / L) * dt`. The voltage you apply changes the *rate*, and the state moves smoothly. You can never write `I = 0`; you can only push on it, and a load that demands an instant assignment gets an enormous voltage instead. The circuit simulator you are using does exactly that update, in small steps of *dt*: see the “Under the hood” box further on.
:::

:::deeper[The exponential]
With a voltage *V* applied to a coil of inductance *L* and wire resistance *R*, the voltage across the wire's resistance is *IR* and the rest, *V* − *IR*, appears across the inductance:

$$V - IR = L\,\frac{dI}{dt}.$$

This is the same first-order equation as the capacitor's, with the solution

$$I(t) = \frac{V}{R}\left(1 - e^{-t/\tau}\right), \qquad \tau = \frac{L}{R}.$$

After one time constant the current is 63 % of its final value, after two 86 %, after five 99.3 %. The energy stored in the field at the end is ½*LI*²: for a relay coil of 0.1 H carrying 71 mA, that is 0.25 mJ, small but, as we will see, not nothing.
:::

## Anatomy of a relay

A **relay** is an electromagnet arranged to work a switch. It has a **coil** wound round an iron **core**, and a hinged iron plate, the :term[armature]{id=armature}, held a small gap away from the core by a **spring**. When current flows in the coil, the core becomes a magnet and pulls the armature against the spring, and the armature moves one or more sets of **contacts**. When the current stops, the spring pulls the armature back.

The contacts of the simplest kind of relay form a changeover switch, like the one in the staircase light of Chapter 6. The moving contact, :term[COM]{id=contacts} ("common"), is attached to the armature. When the coil is off it rests against **NC**, the "normally closed" contact; when the coil is on it moves across to **NO**, the "normally open" one. Nothing here is normal in an absolute sense: the names describe the relay *at rest*, with no current in the coil.

The picture below is a relay in cross-section, driven by a real coil current from the simulator. Run it in slow motion.

::relay-cutaway{n="5.3"}

:::lab[Pull-in, drop-out and operate time]
1. Leave the speed at ×0.01. Press **Switch on (5 V)** and watch the coil current climb along its exponential. Notice that the armature does *not* start to move until the current crosses the **pull-in** line at 70 % of the rated current (50 mA, at 3.5 V). Then it moves, and the contacts follow: NC opens after about 30 % of the travel, and NO closes only when the armature arrives, about 5 ms after pull-in. A green light comes on only then.
2. Switch it off. The current dies away and the relay lets go, not at zero current but when it falls below the **drop-out** line, 30 % of rated (21 mA, 1.5 V).
3. Now try the slider. Drag the coil voltage slowly up from 0 V, and note where the armature snaps in. Drag it back down, and note where it lets go. The voltage at which it snaps in is more than twice the one at which it lets go: at 2 V it is released on the way up and pulled in on the way down.

That gap between the two thresholds is :term[hysteresis]{id=hysteresis}: the relay's state depends on its history as well as on the present current. Here is why it exists. The pull of a magnet grows steeply as the gap closes (roughly as the inverse square of the gap), while the spring pulls back about equally at all positions. To start the armature moving from far away, the coil has to make a big field; once it arrives, the gap is nearly zero and the same iron holds on with a much smaller current. Hysteresis is not a defect: it stops a relay chattering when the coil current hovers near the threshold, and it is exactly what a logic circuit needs, as later chapters will show.
:::

Real relays are not so tidy. Datasheets for a common 5 V relay such as the SRD-05VDC-SL-C give a 70 Ω coil (so 70 mA at 5 V), a guaranteed pull-in at 75 % of the rated voltage or below, a drop-out at 10 % or above, and operate and release times of about 10 ms and 5 ms.:cite[songle-srd] The simulator uses 70 % and 30 % and 5 ms, chosen for clarity. And the contacts bounce, exactly like the pushbutton contacts of Chapter 4: for about a millisecond after they touch they close and open several times. (In slow motion you can see the green lamp flicker.)

What does a relay give you? Three things, and they are the keys to everything else.

- **Power gain.** A weak current in the coil switches a strong one. Here a 70 mA control circuit switches a lamp on its own battery.
- **Isolation.** The coil circuit and the contact circuit are separate: no wire joins them. The lamp could be on a different battery, or on the mains (a job for a properly rated relay!).
- **Inversion.** The NC contact conducts when the coil is *off*. A relay can compute NOT. That, and its use in switching networks, is the subject of Chapter 6.

::circuit{src="05-relays/circuits/relay-lamp.json" n="5.4" title="A relay switches a lamp" current=true speed=0.1 caption="Close the switch on the left: 70 mA flows in the coil, and about 7 ms later the armature has moved and the lamp, on its own 6 V battery, lights with 50 mA. Open it again and it goes out. The current dots run at 0.1 × real speed; watch the delay between the switch and the lamp."}

## The surprise: the flyback spike

The coil has stored energy, ½*LI*², in its field, and, as with any flywheel, stopping it suddenly has consequences. If you open the switch in the coil's circuit, you demand that the current drop from 71 mA to zero in almost no time. The equation is *V* = *L* Δ*I*/Δ*t*, and with a Δ*t* of a microsecond, that means a very large voltage indeed: the coil produces whatever voltage it takes to keep the current flowing for a moment, even if that means jumping across an air gap. (The spark plugs of a petrol engine are lit by this effect: an ignition coil turns 12 V into 20 000 V or more by having its current interrupted.)

```quiz
q: 'A relay with a 5 V, 70 Ω coil carries its rated current, and a switch in series with the coil opens. What is the highest voltage you expect between the coil’s terminals, in the first moment afterwards?'
options:
  - text: '5 V: never more than the supply.'
    why: 'That is true of a resistor, but not of a coil. An inductor does not obey the supply; it obeys its own stored current.'
  - text: 'Hundreds of volts, or until something breaks down.'
    correct: true
    why: 'The current has nowhere to go, but the coil insists on continuing it, so its voltage rises until the switch contacts spark or the winding capacitance takes the current. The simulator’s coil peaks at about 500 V.'
  - text: '0 V: with the switch open, no current flows, so no voltage.'
    why: 'The current *was* flowing, and the coil will not let it stop at once: the change is the whole point.'
```

Try it. The two circuits below are identical except for a diode. Open the switch, and watch the scope.

::flyback-scope{n="5.5"}

Without a diode, the voltage at the switched end of the coil goes to about 500 V, then decays in about 15 µs (in a real relay the peak depends on the winding capacitance and on the switch, and can be anything from about a hundred volts to a few thousand, with a spark). With a :term[flyback diode]{id=flyback-diode} wired across the coil, the peak is 0.8 V above the supply and lasts for a millisecond or two.

How does the diode do it? A diode conducts in one direction only (Chapter 7 explains why). It is wired across the coil the *wrong* way round, so that in normal operation, with the coil's switched end below the supply, it is reverse-biased and does nothing. When the switch opens, the coil's end swings *up*, above the supply. The moment it is about 0.7 V above the supply, the diode conducts, and the current, instead of being stopped, finds a loop through the coil and the diode. The coil's energy runs out gently, through the winding resistance (and the diode), with the same time constant τ = *L* ÷ *R* ≈ 1.4 ms as when it started, and never produces a dangerous voltage.

The price is a delay. In the simulator, without a diode the coil current collapses in tens of microseconds and the relay starts to let go at once; with the diode it takes 1.3 ms for the current to fall below the drop-out threshold, so the contacts move a little later. That is why relays that must release quickly have a diode with a series resistor or a zener in place of a plain diode.

:::warning[Never do this with real parts]
The simulator lets you show a 500 V spike on a scope with no consequences. On a real circuit the switch is usually a transistor (Chapter 8), whose rating is about 40 V (for a 2N3904). A relay coil without a flyback diode, switched by a transistor, will destroy it, sometimes at once and sometimes after a hundred clicks. Every relay in this course has its diode.
:::

:::hood[How the simulator models a relay]
A relay in the analog engine is three things joined together: a coil, an armature and two contacts. The coil is an inductor in series with its resistance (the update `I += V/L dt` of the programmer's box, done properly by the companion model of Chapter 4). A real coil also has some capacitance between its turns, and losses in its iron; the model lumps both into one resistor in parallel with the coil, 100 times its winding resistance. That is what limits the spike (about 70 mA × 7 kΩ = 500 V), and it is the only reason that the engine has a spike to show:

```ts
// Coil: an inductor with its resistance between A and B, with 100 × its resistance in parallel
// (winding capacitance and eddy losses, lumped), so interrupting the coil current produces a spike
// of about I × 100·R_coil — hundreds of volts for a 5 V relay — unless a diode clamps it.
```

The factor is one line, `export const RELAY_PARALLEL_FACTOR = 100;`, and it is applied as a resistor of `1 / (RELAY_PARALLEL_FACTOR * R_coil)` siemens across A and B.

The armature is a small state machine, not a mass on a spring. It flips to *energised* when the coil current rises above 70 % of the rated current, and back when it falls below 30 %: that is the hysteresis. Each flip plans a sequence of contact events, and the engine lands a time step exactly on each one (a *breakpoint*: without them the solver would step across the event and be off by up to one step):

```ts
if (!energised && i >= RELAY_PULL_IN * rated) {
  energised = true;
  plan(c.t, true);
} else if (energised && i <= RELAY_DROP_OUT * rated) {
  energised = false;
  plan(c.t, false);
}
```

`plan` schedules the contact that opens at 30 % of the operate time (break before make: for a moment neither contact is closed), the one that closes at the end, and then a seeded burst of bounces:

```ts
events = [
  { t: t + 0.3 * op, contact: opening, closed: false },
  { t: t + op, contact: closing, closed: true },
];
```

The spike shows up as a warning in the figure. When the coil voltage exceeds `max(30, 3 × rated)` the model records the peak, and when it falls again the engine adds the message you saw under the scope. All of this is in `src/lib/sim/analog/models/switches.ts`.
:::

## The telegraph repeater

Back to the wire. A telegraph line is a long resistor, and the current in it is *I* = *V* ÷ (*R*ₗᵢₙₑ + *R*ₗₐₘₚ). The line's resistance grows in proportion to its length, about 8 Ω per kilometre for 4 mm iron wire, so a receiver that is fine at 10 km is starved at 200. That is not just a matter of the light being dimmer. A lamp (or a sounder, the electromagnet that clicked on a Morse telegraph) needs a certain *power* to do its job, and power falls faster than current: the line eats voltage, and the lamp's filament cools, so it glows less brightly still. In the figure below, a lamp that needs 10 mA at 12 V is on the end of the line.

Now put a relay at the far end instead of the lamp. The line only has to carry enough current to *pull in the relay*, a few milliamps into a sensitive coil (5 mW, where the lamp needs 120 mW, and Henry's "intensity" magnets were built for exactly this). The relay's contacts then connect a *local battery* to the lamp, and the lamp gets full power, however weak the line signal was, as long as it was enough to operate the relay.

::telegraph-repeater{n="5.6"}

:::lab[Send a message across 300 km]
1. Choose **Lamp on the line** and press **Send SOS** with the line at 80 km. The lamp glows faintly, if at all, and the strip chart shows a weak, rounded light against the key's clean pulses. Push the length up to 200 km: the lamp goes out completely, although the line-current readout still shows about 7 mA.
2. Switch to **Relay repeater**. The same line, the same key, and the message arrives at full brightness. Slide the length up to 300 km: it is still bright, and the power at the lamp is exactly the same as at 20 km. The signal at the relay's coil is only 4–5 mA, but it is *enough*.
3. Go on to 500 km, and the relay itself fails to pull in (it needs 3.5 mA and the line delivers about 2.9 mA): the message is stopped even here. The remedy is to put a repeater in the *middle* of the line, and another, and another. Telegraph lines were built with a repeater station every few hundred kilometres.
:::

This is more important than it may seem. A repeater does not amplify the *weak* signal in the sense of making it a little louder, which would amplify its noise too. It *decides* whether the line current means "key down" or "key up", and then sends out a brand new, clean, full-strength signal from its own battery. Whatever degradation the line inflicted on the last stretch is wiped out, and does not accumulate. The line's current can have been reduced to half, blurred by the coil's slowness, or corrupted by a bit of noise; if it is still clearly above the relay's threshold, the signal on the far side is perfect. This is the first :term[signal restoration]{id=signal-restoration} in the history of technology, and it is the reason a message can cross a continent with a chain of relays but not with a single very long wire. It is also exactly what a logic gate does at every stage of a computer: read a slightly damaged 0 or 1, and output a perfect one. Chapter 8 shows how a transistor's *gain* does the same job with no moving parts, and why without it digital circuits would not work.

:::history{year=1844 title="What hath God wrought" people="Samuel Morse, Alfred Vail" source="Sources: Smithsonian National Museum of American History; Hochfelder (Smithsonian Institution Archives)."}
On 24 May 1844 Samuel Morse tapped a Bible verse out of the Capitol in Washington to his partner Alfred Vail in Baltimore, 40 miles away. It arrived.

The line, funded by a $30,000 grant from Congress, ran between the Capitol and the Pratt Street station of the Baltimore and Ohio Railroad, and the message, chosen by Annie Ellsworth, the daughter of the Commissioner of Patents, was "What hath God wrought", from the Book of Numbers.:cite[nmah-wwgw] Vail, a skilled machinist, had built the first practical sending key and improved the relay magnets.:cite[loc-morse]

The line was about 64 km long. For longer lines the answer was the relay that Henry had demonstrated in the 1830s: according to historians of Henry's papers, Leonard Gale, a chemist who had worked with Henry, showed Morse how a relay could boost a signal over long distances.:cite[hochfelder-henry] What a relay repeated was a series of dots and dashes: a code of two states, on and off, that a relay could copy without loss. An electromagnet had become the first component of a digital network.
:::

:::history{year=1831 title="Faraday’s induction" people="Michael Faraday" source="Sources: Faraday (1832); Royal Institution; American Physical Society (2001)."}
On 29 August 1831 Michael Faraday wound two coils on an iron ring, connected one to a battery and the other to a galvanometer, and saw the needle flick, but only at the moment he made or broke the circuit.

Faraday wanted to know whether a magnet (or a current) could make a current in a neighbouring wire. He had tried, for years, with steady currents and steady magnets, and had seen nothing. The ring of soft iron, with a coil on each side, was a better idea: the iron carries the flux of the first coil round through the second. When he connected the battery, the galvanometer jumped and swung back; while the current was steady, nothing; when he disconnected the battery, it jumped the other way.:cite[faraday1832] It is *change* that induces a voltage, not the field itself, and that is the whole of the equation V = L ΔI/Δt. He went on to make a current by moving a magnet through a coil, and so to the dynamo, the transformer and the generator.:cite[aps-faraday] The unit of inductance, the henry, is named after Joseph Henry, who was working on the same effects in America.
:::

:::real{parts="5 V relay (SRD-05VDC-SL-C or similar), 2N3904, 1N4148 or 1N4007, 1 kΩ, 220 Ω, LED, pushbutton, 5 V USB supply"}
Wire the coil of the relay between +5 V and the collector of a 2N3904, and the emitter to ground. Put the pushbutton and the 1 kΩ resistor in series from +5 V to the transistor's base: pressing the button lets about 4 mA into the base, which is enough for the transistor to pass the relay's 70 mA (Chapter 8 explains how; for now, treat the transistor as a switch worked by a small current). **Put the diode across the coil, stripe (cathode) towards +5 V**, before you connect the supply. Connect the LED and its 220 Ω resistor from +5 V through the relay's NO contact (and COM to +5 V) to ground.

Press the button: the relay clicks, and the LED lights. Release it: another click, and the LED goes out. Measure the coil with your multimeter (Chapter 3) to check the 70 Ω, and, with power off, test the contacts for continuity: COM to NC is closed at rest, COM to NO is open. Do not take the diode out to see what happens: that is what the simulator is for.
:::

## Exercises

```quiz
q: 'A relay’s coil is rated 5 V and 70 Ω, pulls in at 50 mA and drops out at 21 mA. You raise the coil voltage slowly from 0 V to 4 V, and then lower it slowly to 2 V. What is the armature doing at 2 V?'
options:
  - text: 'Released: 2 V is below the pull-in voltage of 3.5 V.'
    why: 'That would be right if you had raised the voltage to 2 V from below. But you came down from 4 V, when the armature was already pulled in.'
  - text: 'Pulled in: it stays in until the current falls below 21 mA (1.5 V).'
    correct: true
    why: 'At 2 V the coil current is 29 mA, below the pull-in current but above the drop-out current. The armature is already against the core, where a small current is enough to hold it: hysteresis.'
  - text: 'Halfway: the armature follows the coil voltage smoothly.'
    why: 'It does not. The pull grows so steeply as the gap closes that the armature snaps from one end to the other.'
```

```quiz
q: 'A 5 V relay coil has 70 Ω of wire, and a 0.1 H inductance. About how long does the coil current take to reach 63 % of its final value after the switch closes?'
options:
  - text: '1.4 ms'
    correct: true
    why: 'τ = L ÷ R = 0.1 H ÷ 70 Ω = 1.43 ms. (Add the operate time of about 5 ms after the coil pulls in, and you see why a relay contact moves some 7 ms after the switch.)'
  - text: '7 ms'
    why: 'That is the delay until the contact actually closes: the coil takes 1.7 ms to reach the pull-in current, and the armature 5 ms more.'
  - text: '0.1 s'
    why: 'That is the number of henries, not seconds. τ = L ÷ R = 0.1 ÷ 70.'
```

```quiz
q: 'A telegraph engineer doubles the length of a line. Which change does a relay repeater at the far end make possible that a bigger battery on the line alone does not?'
options:
  - text: 'The far-end lamp gets a full-strength signal from its own battery, however weak the line signal, as long as the relay pulls in.'
    correct: true
    why: 'That is signal restoration: the relay reads the weak signal and sends a fresh one. A bigger line battery would help the lamp, but every doubling of length needs a doubling of voltage, and the insulators run out long before the money does.'
  - text: 'The relay amplifies the current in the line, so the line loses less.'
    why: 'The relay does not touch the line’s current. It only *reads* it.'
  - text: 'The relay reduces the resistance of the line.'
    why: 'The line’s resistance is a property of its wire and length. It stays the same.'
```

```parsons
title: 'The key closes'
prompt: 'Put these events in the order they happen when the key at the end of the line is pressed, with a relay repeater at the far end.'
lines:
  - 'Current starts to flow in the line and into the relay’s coil.'
  - 'The coil’s inductance holds the current back, and it climbs along an exponential.'
  - 'The current reaches the pull-in level, about 70 % of the rated coil current.'
  - 'The core’s magnetic pull overcomes the spring, and the armature moves.'
  - 'COM leaves NC, and about 5 ms after pull-in it reaches NO, bouncing for about a millisecond.'
  - 'The local battery’s current flows through the lamp, at full power.'
distractors:
  - 'The relay amplifies the line current until the lamp lights.'
  - 'The armature moves at once, because the magnetic field appears instantly.'
```

## What's next

You now have the first switch that is controlled by a signal instead of a finger, and, with it, three ideas: a weak current can control a strong one, the output of one stage can drive the input of the next, and a stage that reads and rewrites a signal restores it. The parts bin gets its first entry: the **relay**, with its coil, COM, NO and NC.

Chapter 6 puts relays and ordinary switches together and discovers that a network of them computes: switches in series are AND, in parallel OR, and a normally-closed contact is NOT. From there it is a short step to Shannon's thesis, a relay adder on a kitchen table, and, eventually, to a computer.
