---
number: 0
title: Anatomy of a collision
summary: What CERN is, what the Large Hadron Collider does, and one proton collision followed from the beams to a single entry in a histogram. The six stages of that journey are the six things you will build.
duration: About 1 hour
---

Forty million times a second, somewhere under the French–Swiss border, a pair of proton bunches crosses in the middle of a detector the size of a cathedral. Most of the time nothing interesting happens. Every now and then two protons collide hard enough that a few of their constituents meet head-on, and for a few billionths of a billionth of a second there is enough concentrated energy to produce short-lived particles that were abundant in the early universe and are also made in natural high-energy collisions. It sounds like a thought experiment. It is a facility, with a shift rota, and some of the data it produces can be downloaded by anyone.

This course teaches the physics behind those collisions, and it teaches it by making you build a miniature of the apparatus. This first chapter sets the scene: who runs the machine, what it does, and the path that one collision takes from two beams of protons to a number in a histogram. Each step of that path is something you will write, run and test yourself.

## What CERN is

**CERN** is a European laboratory for particle physics, on the border between France and Switzerland, just outside Geneva. The name is an acronym of its first, provisional name in French, *Conseil Européen pour la Recherche Nucléaire* (European Council for Nuclear Research); the permanent name, European Organization for Nuclear Research, kept the letters. It was founded in 1954 by twelve European countries, in the aftermath of a war that had scattered Europe's physicists and left its laboratories poor, on the idea that a facility too expensive for any one of them could be built by all of them. It has about two dozen member states today, and its experiments are run by thousands of physicists from universities all over the world, including countries that are not members.:cite[cern-history]

:::history{year=1954 title="Europe builds a laboratory together" people="Isidor Rabi, Pierre Auger, Edoardo Amaldi, Niels Bohr" source="Source: CERN, 'Our history'."}
In December 1950 the American physicist Isidor Rabi, speaking at a UNESCO conference in Florence, proposed that European countries should set up a regional laboratory for nuclear physics. The scientists involved (Pierre Auger, Edoardo Amaldi, Niels Bohr and others) found governments willing to pay for it, and on 29 September 1954 the convention that created CERN came into force, with twelve founding states.

CERN's first accelerator, a 600 MeV synchrocyclotron, began work in 1957. Its second, the 28 GeV Proton Synchrotron (1959), is still running today: it is the first stage of the chain that feeds the Large Hadron Collider. Laboratories of this kind are built to last.:cite[cern-history]
:::

Particle physics is an expensive, collaborative science because of the rule of Chapter 1: to see things a hundred times smaller you need a probe a hundred times more energetic. A machine that can see inside a proton is a machine of many kilometres. A detector that can record what comes out is a machine of thousands of tonnes.

## The Large Hadron Collider

The **Large Hadron Collider** (LHC) is a ring of 26.7 kilometres in circumference, in a tunnel about a hundred metres underground, dug in the 1980s for an earlier collider and reused. Inside it, two beams of protons travel in opposite directions in two separate vacuum pipes, steered by about 1,200 superconducting dipole magnets cooled to 1.9 K, colder than outer space, and brought to collide at four points around the ring. The name says what it does: *hadron* is the word for particles made of quarks, like the proton, and the machine makes them collide head-on. Each beam has an energy of 6.8 TeV, so that the total energy in a collision is 13.6 TeV. The beams are made of about 2,800 bunches, each holding roughly 10¹¹ protons, which pass through each other every 25 nanoseconds (40 million times a second). Because the bunches are tightly squeezed where they cross, a typical crossing produces several dozen proton–proton collisions at once. Almost all of them are glancing; in rare crossings, one is a violent one.:cite[lhc-design]

It is not the first machine of its kind at CERN, and it is not the largest ambition of the field, but it is the most powerful collider ever built. It first circulated beams on 10 September 2008, and collided them at 7 TeV on 30 March 2010 after an accident in which a faulty electrical connection damaged a large part of the ring (Chapter 21 tells that story). It found the Higgs boson in 2012 (Chapters 26–30), and from July 2022 it has been running at 13.6 TeV.

### The four big experiments

At four points on the ring, the two beams are brought together, and at each sits a detector:

- **ATLAS** and **CMS** are general-purpose detectors, built to an independent design so that each can confirm the other's discoveries. CMS (Compact Muon Solenoid) weighs about 14,000 tonnes and is about 21 metres long, and is built around a huge superconducting magnet. ATLAS is 46 metres long and 25 metres across, and weighs about 7,000 tonnes. Each is operated by a collaboration of several thousand physicists.
- **LHCb** is specialised in particles that contain bottom quarks, and studies the small differences between matter and antimatter.
- **ALICE** is specialised in collisions of lead nuclei, which the LHC also provides for a few weeks each year, and studies matter at temperatures of trillions of degrees.

This course follows ATLAS and CMS. The data you will meet in Chapter 2 are from CMS.

## One collision, six steps

Follow one collision through the whole apparatus. The figure below walks through the six steps; the rest of this course is the detail.

::collision-journey{n="0.1" caption="One collision, step by step. The diagram is a schematic cross-section of a detector seen along the beam: the beam pipe in the middle, then the tracker, the electromagnetic calorimeter (ECAL), the solenoid magnet, the hadron calorimeter (HCAL) and the muon chambers. The particles are a Z boson's two muons, a jet, an electron and a neutrino: a busier event than most."}

1. **The machine** decides how many collisions there are and how hard. The number of collisions per second is the *luminosity* of the beams, and the size of a collision's energy comes from the magnets and the radio-frequency cavities that accelerate the beams. You will build a model of a collider ring, and of its luminosity, in Part V.
2. **The generator** is physics: given two protons colliding at 13.6 TeV, what comes out, and with what probabilities? The answer is computed from the theory of quarks, gluons and their interactions, with a fair amount of random numbers: particle physics is a probabilistic science, and the simulation of an event is a Monte Carlo simulation. Parts I to IV teach the physics the generator is made from.
3. **The detector** is the apparatus: layers of sensors around the collision point, in a magnetic field. The detector simulation takes the particles the generator produced and works out what the sensors would record. Part II builds it.
4. **The signals** are what the detector reports: hits in a tracker, energy in calorimeter cells. In real data these are all there is. In simulation they are accompanied by the *truth*: what really happened. Comparing them is how you measure how well you understand your apparatus.
5. **Reconstruction** is the software that turns signals back into physics objects: tracks, electrons, muons, jets, missing momentum. It is an inverse problem. Chapter 8 is where you write part of it.
6. **The trigger and the analysis.** The detectors see 40 million crossings per second and can store only about a thousand of them. A trigger decides, in microseconds, which ones to keep. Then the analysis, a program of selections and statistics, turns millions of kept events into a histogram, a measurement, a discovery. Part VII builds both, and finishes with the search for the Higgs boson in your own data.

The rest of this chapter's subject is the word **your**. Every stage has a reference implementation built into the course, and the exercises ask you to write some of its functions yourself, in TypeScript, in the browser. Once your function passes its tests you can tell the pipeline to use it instead of the built-in one: the **Control Room** page runs the whole chain and shows you which parts are yours. The chain is complete and runs from the first chapter. What changes is how much of it you understand.

## Why simulate?

Two reasons, one practical and one deeper. The practical one: nobody can see what the detector sees except by comparing with a prediction. Every measurement at the LHC is a comparison between data and a simulation of what the theory says, and the simulation has to be good enough that the difference means something. The deeper one: a simulation makes the physics concrete. A statement like "the Z boson decays to two muons 3.4 % of the time" becomes a table entry and a random number; a statement like "a muon leaves a track that curves in the field" becomes a few lines of code you can read.

:::programmer
Think of the LHC as a very large data-processing system. The "data source" is a physical process that cannot be replayed or paused: events arrive at 40 MHz, each a megabyte or so. The "pipeline" has a hard real-time stage (the trigger, which has microseconds to decide whether to keep an event) followed by large batch jobs on a worldwide computing grid. The "tests" are the detector's calibration data and the simulation. And the "spec" is a theory that predicts the output distribution, with a precision that, in the best cases, has been confirmed to ten significant figures. The course follows the data through the system, one stage at a time.
:::

```fermi
id: higgs-rate
title: How rare is a Higgs boson?
prompt: At 13 TeV the total cross-section for producing a Higgs boson in a proton–proton collision is about 50 pb, and the inelastic cross-section for any proton–proton collision is about 80 mb. About how many collisions are there for each one that makes a Higgs boson?
answer: 1.6e9
factor: 3
hints:
  - Divide the inelastic cross-section by the Higgs one. First put them in the same unit; 1 mb = 10⁹ pb.
explain: "80 mb = 8 × 10¹⁰ pb, so the ratio is 8 × 10¹⁰ / 50 = 1.6 × 10⁹: about one collision in two billion makes a Higgs boson, and most of the time it decays into something that is hard to tell from ordinary collisions. Finding it took the collisions of years. Chapters 26 to 30 tell how."
```

```predict
q: 'The LHC delivers 40 million bunch crossings per second. ATLAS and CMS can write about a thousand events per second to permanent storage. Roughly what fraction of the crossings is kept?'
options:
  - text: About one in two, since the detectors are built to record everything that matters.
    why: 'Recording everything would mean about 40 million events per second, each a megabyte or so: tens of terabytes every second, far beyond any storage system.'
  - text: About one in a hundred.
    why: 'One in a hundred would still be 400,000 events per second, which is several hundred times what can be written.'
  - text: About one in 40,000.
    correct: true
    why: '1,000 / 40,000,000 = 1 / 40,000. Deciding which 1 in 40,000 to keep, in microseconds and without throwing away the rare physics, is the problem of Chapter 27.'
```

## How the course works

- **Chapters** are in an order that follows the physics and, in parallel, the pipeline: each part adds the stage that its physics needs. You can read them in any order that respects the prerequisites listed at the top of each one.
- **Predict, then reveal.** At the points where intuition is usually wrong, a question asks you to commit to an answer before the chapter shows you the result.
- **Exercises** include calculations, Fermi estimates (an order-of-magnitude answer to a question with no data: the answer is correct if it is within a factor of three), conceptual questions, and code. Code exercises run in your browser, against hidden tests; when one passes, your function is saved and offered to the pipeline.
- **Real data.** The course ships small samples of real data released by CERN's experiments under open licences, and uses them whenever they make the chapter better than a simulation could.
- **Units.** Energies are in GeV and the course uses natural units (Chapter 1). The units page, in the top bar, converts between them and the everyday ones.
- **Maths.** Algebra, calculus, vectors and matrices, complex numbers and probability. [Appendix A](/appendix/maths/) has short primers; special relativity and quantum mechanics are taught from the start, where they are needed.
- **Astrophysics.** The [astrophysics course](/astrophysics/) in this collection tells the other half of several stories here (stars, the early universe, dark matter). The two courses link to each other where they overlap.

## What comes next

[Chapter 1](/chapters/scales-and-units/) gives you the units and the scales. [Chapter 2](/chapters/relativity-for-particles/) writes the first function of your pipeline, on real data.

## Further reading

- CERN's own account of its history and its experiments (:cite[cern-history]).
- The LHC Design Report, for the machine's numbers (:cite[lhc-design]).
