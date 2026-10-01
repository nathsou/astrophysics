---
number: G
title: Build it for real
summary: Four optional labs with kit lists, safety rules, steps and what you should see. A dry-ice cloud chamber, a Geiger counter and a salt substitute, a desktop muon detector, and the camera of a phone as a pixel detector. Each says which chapter it belongs to.
---

Everything in the course runs in a browser. These four labs are for anyone who wants to see the same physics with their own apparatus. None is needed for the chapters, and none needs anything hard to buy. Each is tied to a chapter: the chapters' *Build it for real* boxes link here.

Costs are given as rough ranges **as of writing** (2026), in US dollars, with no recommendation of any brand or seller: prices vary by country and change, so treat them as an order of magnitude. Where a design belongs to someone else, the appendix says so and links to it.

## Safety first

:::warning[The rules for every lab]
- **Use only exempt, everyday materials.** The only radioactive material in these labs is the natural potassium in a food-grade salt substitute, and the cosmic rays and the radon in the air that are there anyway. **Do not buy, collect or use radioactive sources.** That excludes old luminous watch and instrument dials (they may contain radium), lantern mantles and welding rods that contain thorium, uranium glass and ore samples, and the sources of smoke detectors. They are not needed for anything here, they can be hazardous if broken or swallowed, and in many countries they are regulated.
- **No high voltage.** Do not build, open or repair anything that makes hundreds or thousands of volts. This rules out spark chambers and photomultiplier tubes, and the power supply of a Geiger counter: buy a finished counter that is powered by batteries or USB, keep its case closed, and follow its manual. The muon detector of Lab 3 and the phone of Lab 4 run on batteries or a USB supply (a silicon photomultiplier typically works at a few tens of volts, far below the kilovolts of a photomultiplier tube; check the project's documentation).
- **Dry ice** is at about −78 °C. Handle it with insulated gloves or tongs, never with bare skin, and never seal it in an airtight container: as it warms it turns to gas and the pressure can burst the container. Use it in a ventilated room, not in a small closed space or a car, because the carbon dioxide it releases can displace air.
- **Isopropyl alcohol** is flammable and its vapour is a mild irritant. Keep it away from flames, hot surfaces and anything that sparks; work with ventilation; do not swallow it; keep it out of the reach of children. Wear eye protection when pouring.
- **Soldering** (Lab 3) has its own hazards: a hot iron, fumes (ventilate) and lead in some solders. Follow the usual precautions.
- Supervise children, and read the safety data of everything you buy.
:::

## Lab 1: a dry-ice cloud chamber

**Chapter 5.** What you see is Figure 5.1's picture, for real: the tracks of charged particles made visible as lines of droplets.

**Kit** (about US$15–50 in all, plus the dry ice, a few dollars):

- a clear container with a lid, plastic or glass, in which a tall, flat-bottomed box such as a clear food storage box or a small aquarium works (it should be wide enough to see into);
- a flat metal tray or sheet of a few millimetres' thickness that is a little larger than the container's floor, painted black or covered with black paper (it carries the dry ice and gives the dark background);
- a strip of felt or blotting paper, or a sponge, that fits round the top of the inside of the container;
- isopropyl alcohol of 90 % purity or higher (the more it is diluted with water, the worse it works);
- dry ice, in pellets or a block, which a supplier of ice or a supermarket may stock;
- a strong, narrow light: a torch or an LED lamp, ideally one that can be shone sideways through the container, and a dark room;
- insulated gloves, a pair of tongs, eye protection.

**Steps.**

1. Soak the felt in alcohol until it is wet but not dripping, and fix it round the inside of the container's base. Turn the container over, so that its base is on top and its open end rests on the black plate: the felt is now at the top of the chamber, which will be the warm side, and the plate is the floor, which will be the cold side.
2. Put the dry ice under the plate (a shallow tray of dry ice with the plate on it, or the plate lying directly on a block), so that the plate becomes very cold. Place the container on the plate.
3. Wait five to ten minutes in the dark. Alcohol evaporates from the warm felt and sinks as vapour towards the cold plate, cooling as it goes. Near the plate there is a layer, a centimetre or two thick, in which the vapour is *supersaturated*: it is ready to condense and has nothing to condense on.
4. Shine the torch along the layer, from the side, and look from the side or above with a dark background behind. You should see a faint mist of droplets falling slowly.

**What you should see, and what it means.** Every few seconds a thin white line appears in the layer and fades in a second or so. A *long, thin, straight* line, crossing much of the chamber, is a cosmic-ray muon (Chapter 10), a minimum-ionising particle (Chapter 6). A *short, thick, straight* line a few centimetres long is an alpha particle, likely from the decay of radon or its products in the air; it is thick because it ionises heavily. A *short, wiggly* line is an electron, scattered by the atoms in its way: from the gamma rays of natural radioactivity, or a knock-on electron from a muon. Compare each with Figure 5.1. The simulated chamber's three kinds of track are drawn with the same physics.

**Going further.** The chamber of Figure 5.1 has a magnetic field switch; yours does not, and a magnet strong enough to bend the tracks of fast particles is far beyond a home experiment (at 0.1 T a 10 MeV/*c* electron has a radius of 33 cm, from $R = p/(0.3B)$). The simulated chamber is the place to add the field. Do not add radioactive sources: the natural background is enough.

## Lab 2: a Geiger counter and a salt substitute

**Chapter 3** (decay as a random process, Poisson statistics) **and Chapter 28** (counting statistics).

Potassium is a natural element, essential to life, and 0.0117 % of it is the isotope potassium-40, which is radioactive, with a half-life of 1.248 billion years. About 89 % of its decays are beta decays to calcium-40, emitting an electron with up to 1.31 MeV of energy, and about 11 % are electron captures to argon-40 followed by a gamma ray of 1.46 MeV (the fractions are quoted slightly differently by different compilations).:cite[k40-wiki] A food-grade **salt substitute** sold for people who need to limit sodium is mostly potassium chloride, KCl. It is a safe, everyday source with a known activity.

Take the numbers from the data. The number of ⁴⁰K atoms in a gram of natural potassium is $(N_A/39.10)\times 1.17\times10^{-4} = 1.8\times10^{18}$. The decay constant is $\lambda = \ln 2/T_{1/2} = 1.76\times10^{-17}\ \mathrm{s^{-1}}$, so a gram of potassium has an activity of $\lambda N = 31.7$ Bq (the becquerel, one decay per second). Potassium chloride is 52.4 % potassium by mass (39.10 out of 74.55), so **1 g of KCl has 16.6 Bq, and 100 g has about 1.7 kBq**. (These numbers are computed in the course's tests, so that the text and the arithmetic agree.) That is a weak source. A Geiger counter placed next to it will register only a fraction of those decays, since the counter covers a small solid angle and its efficiency for betas and gammas is low, and many of the betas never leave the salt.

```numeric
id: g-kcl-activity
title: The activity of a bag of salt substitute
prompt: 'Potassium chloride is 52.4 % potassium by mass. Natural potassium has a specific activity of 31.7 Bq per gram (from the 0.0117 % of potassium-40). What is the activity, in becquerels, of 250 g of potassium chloride?'
answer: 4155
unit: Bq
tolerance: 0.03
hints:
  - The mass of potassium in 250 g of KCl is 0.524 × 250 g = 131 g.
explain: "131 g × 31.7 Bq/g = 4,150 Bq, about 16.6 Bq per gram of salt. Most of the decays are beta decays whose electrons are absorbed in the salt itself; a thin-window Geiger tube sees only those from the surface, and only if it faces the salt."
```

**Kit** (US$50–200, depending on the counter): a finished Geiger counter with a thin end window (the manual should say that it detects beta particles; a counter that detects only gamma rays will see less), a clock or timer, a pencil and paper or a spreadsheet, and 100–500 g of potassium-chloride salt substitute in a plastic bag or shallow dish. (Do not buy or use any other source.)

**Steps.**

1. **Background.** Count for a fixed time, say one minute, with no salt nearby; repeat at least twenty times and write down each count. The mean count is the background rate, which depends on the tube, the building and the place; a few tens per minute is typical for a small tube. The counts in different minutes differ.
2. **Poisson.** Make a histogram of the counts. The variance of the counts should equal their mean, as for a Poisson distribution (Chapter 3 shows why: the decays are independent random events). A ratio of variance to mean well away from 1 means the counts are not independent, or there is a drift.
3. **The source.** Place the bag or dish flat against the end window and count again, twenty times. The mean count is higher. The difference is the signal, with an uncertainty from both means: $\sigma^2 = \bar n_{\text{salt}}/N + \bar n_{\text{bg}}/N$ for $N$ counts of each.
4. **Check the physics.** Put a sheet of paper, then thin aluminium foil, then a few millimetres of plastic between the salt and the tube. Electrons of about 1 MeV are stopped by about half a centimetre of plastic (see the stopping powers of Chapter 6); gamma rays of 1.46 MeV are hardly absorbed at all. The part of the signal that comes from betas should fall as the absorber thickens, and the part that comes from gamma rays should barely change.

**What you should see.** A rate with an excess over background, and counts that are Poisson-distributed. How big an excess depends on the counter and the sample, and with a small tube it may be modest; if you see nothing beyond the fluctuations, count for longer and use more salt: the signal-to-noise ratio improves as the square root of the counting time. The fit of the Poisson distribution to the counts is the same exercise as Chapter 28's, on a source you can hold.

## Lab 3: a desktop muon detector

**Chapter 10** (the cosmic-muon rate, its dependence on zenith angle and altitude) **and Chapter 28** (analysing your own data).

**The CosmicWatch desktop muon detector** is an open project, started at the Massachusetts Institute of Technology by Spencer Axani and collaborators, that describes how to build a particle detector from a block of plastic scintillator (a plastic that emits a flash of light when a charged particle crosses it), a silicon photomultiplier (a small silicon device that turns a few photons into an electrical pulse) and a small circuit board that counts and time-stamps the pulses and records them.:cite[cosmicwatch2018] The original paper, published in 2018, gives a cost of under US$100 in parts; prices have changed since, so check the project's current parts list. **The design is released under the Creative Commons Attribution–NonCommercial 4.0 licence (CC BY-NC 4.0), so this course links to the project and does not copy its files, its data or its instructions.** Please read the project's own documentation, which is kept up to date:cite[cosmicwatch-v3x]. The project's site is cosmicwatch.lns.mit.edu.

A single detector counts every particle that makes a flash, including the gamma rays of natural radioactivity. Two detectors, one stacked above the other and wired to count only the events in which both fire within a few tens of nanoseconds of each other, count mostly muons: a *coincidence*. A trigger of the kind explained in Chapter 27 is a coincidence of that sort.

**Expected rate.** The flux of cosmic-ray muons at sea level is about 70 m⁻² s⁻¹ sr⁻¹ for muons coming from straight above with energy above 1 GeV, and falls with the angle $\theta$ from the vertical roughly as $\cos^2\theta$; the integral over the sky gives about **one muon per square centimetre per minute** through a horizontal surface.:cite[pdg-cosmic] (The course's tests check that the first number gives the second: $70\times(\pi/2)$ per m² per second, which is 0.88 per cm² per minute.) A scintillator of 25 cm² (check the area in the project's documentation) is crossed by about 25 muons a minute; the coincidence of two stacked detectors counts only those that cross both, so fewer, and a single detector counts more, because it also sees the gamma rays of natural radioactivity.

```fermi
id: g-muon-rate
title: Muons through a desktop detector
prompt: A horizontal scintillator 5 cm × 5 cm is crossed by cosmic-ray muons at the sea-level rate of about 1 per cm² per minute. How many muons pass through it in an hour?
answer: 1500
unit: muons
factor: 3
hints:
  - The area is 25 cm². The rate through it is 25 per minute.
explain: "25 cm² × 1 per cm² per minute = 25 per minute, so 25 × 60 = 1,500 in an hour. A single detector will count more than that, since it also sees the gamma rays of natural radioactivity, and a coincidence of two detectors a few centimetres apart will count fewer (the pair accepts only the tracks that cross both)."
```

**Steps.**

1. Build (or buy) two detectors, following the project's instructions: each detector is a plastic scintillator wrapped to keep the light in, a silicon photomultiplier and a circuit. Soldering is needed for the circuit boards.
2. Log the counts for hours: the logs have a time stamp for each event. Let the detectors run on a table, not on a metal surface, and away from sources of electrical noise.
3. **Rate and uncertainty.** Count per hour for a day. The counts are Poisson, with an uncertainty of $\sqrt{N}$: with 1,500 muons per hour, 2.6 %.
4. **Zenith angle.** Tilt the stack through angles from the horizontal to the vertical (or lay it on its side) and measure the coincidence rate at each angle for an hour or more. The rate should fall roughly as $\cos^2\theta$ of the angle between the stack's axis and the vertical, though the finite size of the detectors rounds it.
5. **Altitude and shielding.** On a mountain or in an aeroplane the rate rises; under thick concrete or underground it falls. Do not take the equipment anywhere that is not allowed; check the rules for electronic devices on aircraft.

**What you should see.** A rate of the order of those above, a Poisson scatter, a clear fall with zenith angle, and (with a lot of data) small changes with the atmospheric conditions. Chapter 28 shows how to fit the zenith-angle distribution, with an uncertainty, from your own data.

## Lab 4: the camera of a phone as a pixel detector

**Chapter 7** (silicon detectors) **and Chapter 8** (clustering and reconstruction).

The sensor in a phone's camera is a silicon pixel detector, a chip of millions of pixels of a few micrometres across. It is built to register photons, but an ionising particle that crosses a pixel's sensitive layer makes electron–hole pairs just as a photon does, and it too leaves a signal. If the camera is covered, so that no light reaches it, the particles are what is left, and they appear as bright pixels or small groups of pixels in an otherwise dark picture. The *Distributed Electronic Cosmic-ray Observatory* (DECO) and CRAYFIS (*Cosmic RAYs Found In Smartphones*) are research projects that did exactly this with phones, and published their analyses.:cite[deco2015,crayfis2016]

**Kit** (no cost beyond a phone you already have): a smartphone, a piece of opaque tape or a lens cap that excludes *all* light (check by looking at a picture taken with the cap on: it should be uniformly dark, with only noise), and a way to get the frames onto a computer.

**The catches.** The camera software normally hides what you are looking for: phones apply noise reduction, remove isolated bright pixels (they look like defects), compress video in a way that destroys single-pixel signals, and sometimes shut the camera off. Raw (unprocessed) images from a camera app that can save them, or a research app (check whether the projects above still provide one: availability changes), are far better than a compressed video. Different phones behave differently, and you may find that yours cannot do it: that is a result too. Heat increases the sensor's noise, so let the phone cool down between exposures.

**Steps.**

1. Cover the lens completely. Take many dark frames (a long exposure, or a series of short ones), in a raw format if you can.
2. **Find the hits.** Average a set of dark frames to get the *pedestal* of each pixel; subtract it from a frame; a pixel more than, say, five standard deviations of the noise above the pedestal is a hit candidate. A few lines of code do it:

```ts
// frame: a 2-D array of pixel values (height × width), pedestal and sigma: the average and standard deviation per pixel of the dark frames
function hits(frame: number[][], pedestal: number[][], sigma: number[][], nSigma = 5): { x: number; y: number; value: number }[] {
  const out: { x: number; y: number; value: number }[] = [];
  for (let y = 0; y < frame.length; y++) {
    for (let x = 0; x < frame[y]!.length; x++) {
      const v = frame[y]![x]! - pedestal[y]![x]!;
      if (v > nSigma * sigma[y]![x]!) out.push({ x, y, value: v });
    }
  }
  return out;
}
```

3. **Cluster.** Group hit pixels that touch (the eight neighbours of a pixel) into clusters, as the calorimeter cells of Chapter 8 are, with a breadth-first search. A cluster is one particle (or one noise event).
4. **Classify.** The number of pixels in a cluster and its shape tell something about the particle. The DECO project named the common shapes; roughly, a short round spot is a particle that deposits its energy in a small region, a long thin straight track is a particle that crosses the sensor at a shallow angle, and a curly "worm" is a low-energy electron that scatters.:cite[deco2015]
5. **Count.** The rate of clusters per unit area of the sensor and time. How a particle appears depends on its direction through the thin sensitive layer: one that crosses at a steep angle lights few pixels, one that crosses at a shallow angle lights a line of them. The sensor is small and the rate is low, so be patient: expect to need many minutes or hours to see more than a handful.
6. **Compare with background.** A dark frame with a hot pixel appears in the same place every time; a particle hit does not. Discard any pixel that is bright in more than a small fraction of the frames.

**What you should see.** In a camera that records the particles at all: occasional isolated bright clusters in dark frames, at random positions and times, which are the same kind of thing as a hit in the silicon pixels of Chapter 7, and from which the clustering of Chapter 8 recovers something about the particle. A phone that records no clusters (because its software removes them) is the lesson of the *Catches* paragraph.

## Summary

| Lab | Chapter | Cost (as of writing) | Time | What it shows |
|---|---|---|---|---|
| Dry-ice cloud chamber | 5 | US$15–50 plus dry ice | an evening | tracks of alphas, electrons and muons; ionisation and scattering |
| Geiger counter and potassium chloride | 3, 28 | US$50–200 | a few hours | random decay; Poisson counting; absorption of betas |
| CosmicWatch muon detector | 10, 28 | under US$100 in parts per detector in the 2018 paper; check the current list | a weekend to build, days of data | the cosmic-muon rate; zenith-angle dependence |
| Phone camera | 7, 8 | none | an evening | hits in a silicon pixel detector; clustering |

```quiz
q: 'You want a source to see how a Geiger counter responds to radioactivity. Which of these is acceptable under the rules of this appendix?'
options:
  - text: A bag of potassium-chloride salt substitute from the supermarket.
    correct: true
    why: 'It is an everyday food product whose only radioactivity is the natural potassium-40 in it, about 17 Bq per gram, a negligible and well-understood source. It is the source this appendix uses.'
  - text: A luminous watch dial from a grandparent, since it is old and the paint is only a little radioactive.
    why: 'Old luminous dials may contain radium, which is hazardous if the paint is broken or swallowed, and is regulated in many countries. Do not use them.'
  - text: A thoriated welding rod or a lantern mantle, which are easy to buy.
    why: 'They contain thorium, a radioactive element. They are not exempt, they can release dust, and they are not needed: the potassium salt does the job.'
  - text: The americium from a smoke detector.
    why: 'It is a sealed source that is safe in the detector and not outside it. Do not open a smoke detector, and do not use the source.'
```

## Further reading

- The PDG review of cosmic rays, for the muon flux and its angular dependence (:cite[pdg-cosmic]).
- The CosmicWatch paper and its repository, for the design and the current instructions (:cite[cosmicwatch2018,cosmicwatch-v3x]).
- The DECO and CRAYFIS papers, for the analysis of particle hits in camera sensors (:cite[deco2015,crayfis2016]).
