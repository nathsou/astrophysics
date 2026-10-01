---
number: 33
title: Particle physics in the world
summary: The machines and methods of this course were built to answer questions about the smallest things, and some of them have found other uses. Positrons image tumours, protons treat them, cosmic-ray muons look inside a pyramid, hybrid pixel detectors count X-rays one by one, and a system for sharing documents between physicists became the Web. This chapter follows each from the physics to the application, and ends with where to go next.
duration: About 2 hours
prerequisites: [antimatter, particles-through-matter, a-needle-in-a-haystack]
---

The Great Pyramid of Giza is about 4,500 years old, and for most of that time its interior was known from the passages that people had walked. In 2017 a paper in *Nature* announced that it contains a large empty space, at least thirty metres long, above the Grand Gallery, that no one has entered. It was found without opening a single stone. The probe was cosmic-ray muons, the same particles as in the dimuon map of Chapter 2, and the detectors were the descendants of those built for experiments of particle physics.:cite[morishima2017]

This chapter is about such transfers. The field's habits are unusual: it builds instruments that detect single particles, it has to analyse data from them with statistics, it needs accelerators to make beams, and it has developed the computing to handle what comes out. Each of these has been put to use outside, and four cases are developed here. In each you will meet the physics of an earlier chapter again, in a place where its consequences matter to someone who is not a physicist.

One caution. It is easy to credit particle physics with everything that it touched, and the honest account is more modest. Some of what follows (the Web) was invented at CERN for its own needs. Some (proton therapy) was proposed by a physicist and developed by doctors. Some (muography) is a use of a natural beam, and the particle-physics contribution is the detector. Where a claim is general, it says so; where it is a date, it is cited.

## Seeing inside the body: PET

Chapter 9 introduced antimatter, and with it a medical technique. A **positron emission tomography** (:term[PET]{id=pet}) scan starts with a molecule that has been labelled with a radioactive atom that decays by emitting a positron. The usual one is fluorine-18, attached to a sugar, fluorodeoxyglucose. Cells that burn a lot of sugar, which means brain regions at work and many tumours, take up more of it. The nucleus decays, with a half-life of under two hours, emitting a positron; the positron travels about a millimetre in tissue, slows down, meets an electron and annihilates. The result is two photons of 511 keV each (the electron's rest energy, Chapter 1), emitted in almost exactly opposite directions, because the pair had almost no momentum to give (Chapter 2).

A ring of detectors around the patient surrounds the source. Two crystals that fire at the same moment have seen the two photons of one annihilation, and the decay must have happened somewhere on the line between them, the :term[line of response]{id=line-of-response}. A single line says little. Millions of them, each constraining the position of one decay, add up to a map of where the tracer is.

::pet-ring{n="33.1" caption="PET in two dimensions, simulated. The ring is the detectors; the thin lines are the first sixty lines of response; the dashed circles show where the tracer really is (two hot spots in a weaker warm background). The picture on the right is the sum of all the lines. With a few hundred coincidences nothing can be seen, with thousands the hot spots stand out of the noise: the statistical noise (Chapter 3) falls as the square root of the number of counts. A toy: no attenuation in the body, no scattered or random coincidences, no timing; the 'sharpen' option is an unsharp mask standing in for the filter of real reconstruction."}

The physics is Chapter 3's: each decay is a random event, so the image is a histogram with Poisson errors, and a low dose means low counts and a noisy image. The detector physics is that of Chapters 6 and 7: a 511 keV photon has to stop in a dense, fast scintillating crystal, whose light is turned into a signal. The crystals used in clinical scanners and those used in the electromagnetic calorimeters of particle experiments are cousins, and at CERN the *Crystal Clear* collaboration worked on both.

A real scanner adds a good deal. It corrects for the photons that are absorbed or scattered in the body, for coincidences between photons from two different decays, and for the dead time of the electronics. Newer ones measure the difference in the arrival times of the two photons to a few hundred picoseconds, which tells where along the line the decay was, and that improves the image a great deal. And reconstruction is the inverse problem of Chapter 8, solved by iterating a model of the scanner against the data.

### Pixels that count

A different transfer is in the sensors. A silicon pixel detector for the trackers of the LHC experiments (Chapter 7) is a thin silicon sensor, with each pixel connected by a bump of solder to its own tiny electronics chip, which amplifies and times the pulse. In the late 1990s the **Medipix** collaboration, which grew around CERN, used the same :term[hybrid pixel detector]{id=hybrid-pixel-detector} design to count individual X-ray photons: each pixel records one count for each photon above a threshold, and the threshold can be set to select the photon energy. A detector of that kind gives images without electronic noise (a pixel that sees no photon reports zero) and, with several thresholds, an image with a measure of the energy of the X-rays, in "colour". Successive generations, Medipix2, Medipix3 and Medipix4, have been developed by collaborations of research institutes, and the chips are used in X-ray imaging, in the study of materials, in measuring radiation on the International Space Station, and in medicine: a photon-counting CT scanner for imaging limbs, using Medipix technology, has been cleared by the US Food and Drug Administration.:cite[medipix]

```quiz
q: 'In a PET scanner, what exactly is the signal that tells the electronics that a decay has happened somewhere between two crystals?'
options:
  - text: One crystal fires with 511 keV.
    why: 'A single 511 keV photon could come from anywhere along its line of flight, or from a decay that is scattered or unrelated. Single hits are mostly discarded or used for calibration.'
  - text: Two crystals fire within a few nanoseconds of each other, each with about 511 keV.
    correct: true
    why: 'The two photons of one annihilation arrive within the time it takes light to cross the ring, a few nanoseconds. Requiring a coincidence of two hits in that window is the trigger of a PET scanner, the same idea as the coincidence of two muon counters in a cosmic-ray telescope, and it is what makes the line of response.'
  - text: Two crystals fire in a row, one after the other, a few microseconds apart.
    why: 'The photons are made together and fly at the speed of light; the delay between their arrivals is at most the light-travel time across the ring, a nanosecond or so, not microseconds.'
```

## Treating cancer: protons

In 1946 the physicist Robert Wilson, who was then at Harvard and was designing the cyclotron that was being built there, published a paper in the journal *Radiology* with the title "Radiological use of fast protons".:cite[wilson1946] It pointed out that the way protons lose energy in matter (Chapter 6) makes them a better tool for treating a deep tumour than the X-rays then used.

A beam of X-ray photons is absorbed roughly exponentially: it deposits most of its dose near the entrance and leaves some of it behind the tumour as well. A proton is different. Its energy loss, in the Bethe formula of Chapter 6, grows as the proton slows down, as $1/\beta^2$. A proton entering the body deposits energy slowly at first, and then, in the last few millimetres of its range, deposits most of its energy at once, in a sharp peak, the :term[Bragg peak]{id=bragg-peak}, and beyond it nothing. Choose the energy and you choose the depth at which it stops.

:::history{year=1946 title="Fast protons as a scalpel" people="Robert R. Wilson" source="Source: Wilson (1946)."}
Robert Wilson (1914–2000) had worked on the Manhattan Project and then became a professor at Harvard, where he took charge of its cyclotron. He published "Radiological use of fast protons" in *Radiology* in 1946, to bring the possibilities of high-energy charged particles to the attention of medical and biological workers. He noted the sharply defined range, the low dose to the skin and the ease with which the range could be controlled.:cite[wilson1946]:cite[wilsonfnal] Patients were first treated with proton beams in the 1950s, at the University of California's laboratory in Berkeley. Wilson became the first director of the Fermi National Accelerator Laboratory in 1967.
:::

::bragg-peak{n="33.2" caption="Dose against depth in water, from the course's Bethe–Bloch (the same function as in Chapter 6) integrated to give the range. Protons deposit little at first and most of it at the end of their range; the photon curve is an idealised exponential. Slide the energy to move the peak. Switch on the spread-out Bragg peak to cover a target of chosen depth and thickness with beams of many energies, weighted so that the total dose is flat across the target. A toy: no nuclear interactions, no beam energy spread and no lateral spread, so the peak is higher than a real one."}

The physics fits in a few lines. The range of a proton is the integral of $\mathrm{d}E/S(E)$, where $S$ is the stopping power, and the dose at depth $z$ is proportional to the stopping power at the energy the proton has when it arrives there. A 150 MeV proton has a range of 15.8 cm in water and a 200 MeV proton of 26.0 cm, close to the values in the NIST tables (the tests of the code check them within 3 %). A simple power law, $R \approx 0.0022\,E^{1.77}$ cm for $E$ in MeV, is a fit often used for estimates.:cite[pstar]

```numeric
id: proton-energy-depth
title: Energy for a given depth
prompt: 'A tumour lies 15 cm deep in soft tissue, which for protons behaves like water. Use the range–energy fit R ≈ 0.0022 E^1.77 (R in cm, E in MeV). What proton energy puts the Bragg peak at 15 cm? (Ignore the tissue in front of the tumour that is not water-like, such as lung or bone.)'
answer: 146
unit: MeV
tolerance: 0.03
hints:
  - 'Solve for E = (R/0.0022)^(1/1.77).'
  - '15/0.0022 = 6818; take the natural logarithm, divide by 1.77, exponentiate.'
explain: 'E = (15/0.0022)^(1/1.77) = 6818^0.565 = 146 MeV. A tumour at the centre of the body needs a beam of about 150 MeV, and the deepest ones 230 MeV or more: that is why the proton-therapy accelerators, cyclotrons and small synchrotrons, work at a few hundred MeV. Chapter 19 explained how they accelerate protons to that energy.'
```

A tumour is rarely thin, so a single Bragg peak covers too little. The treatment adds beams of different energies, each stopping a little deeper than the last, and the sum of their peaks is a flat plateau across the whole tumour with a sharp edge behind it. The tissue in front of the tumour gets less dose than it would from X-rays and the tissue behind it gets almost none. That is the reason for the effort: it matters most for tumours near the spine or the optic nerve, and in children, whose tissues are more sensitive. Whether the better dose distribution leads to better outcomes than the best X-ray methods has to be tested clinically for each kind of cancer, and it has been tested for some more than others; the physical argument by itself is only an argument.

:::hood[A Bragg curve from Bethe–Bloch]
The library calculates the range of a proton in water by integrating $\mathrm{d}T/S(T)$ over kinetic energy, with $S$ the mean mass stopping power from `bethe()` of `hep/detector`, the function of Chapter 6. The dose at depth $z$ is then the stopping power at the energy that gives the proton a residual range $R - z$, found by bisection on the range function.

```ts
export function protonRange(T: number): number {
  // ... cached ...
  const n = 400;
  const lo = Math.log(1), hi = Math.log(T);
  let g = 0, prev = 0;
  for (let i = 0; i <= n; i++) {
    const t = Math.exp(lo + ((hi - lo) * i) / n);
    const f = t / protonStoppingPower(t);
    if (i > 0) g += 0.5 * (f + prev) * ((hi - lo) / n);
    prev = f;
  }
  return g + 0.0025;
}
```

The integral is done in $\ln T$, so that the steps are fine where the stopping power changes fast, at low energy, and the constant at the end is the small range of a 1 MeV proton, below which the Bethe formula is not valid. The straggling of the range, which smooths the peak, is a Gaussian of 1.2 % of the range (the figure for protons in water). The point of the test against the NIST values is that nothing in the function is fitted to them.
:::

## Muography

The muons of Chapter 10 are made when cosmic rays strike the atmosphere, and they arrive at sea level at a rate of about one per square centimetre per minute on a horizontal surface, with the angular distribution close to $\cos^2\theta$ at low energy, where $\theta$ is the angle from the vertical.:cite[pdg2024] They are weakly absorbed: a muon loses energy to ionisation at about 2 MeV per g/cm² and, above a few hundred GeV, increasingly by radiation. In the model of this chapter a muon of 100 GeV can cross a couple of hundred metres of rock and one of a TeV about a kilometre (real tables differ by tens of per cent).

That makes them a probe, with two things in their favour: the beam is free, and it is penetrating. The measurement, :term[muography]{id=muography}, is the radiography that X-rays give, with a different beam. Place a detector behind a structure that you cannot open, count the muons that arrive from each direction, and compare with the number you would expect if the structure were solid. A direction in which more muons arrive than expected has less matter along it than expected. A void is a place with less matter.

```fermi
id: muons-per-day
title: Muons through a square metre
prompt: 'The Particle Data Group quotes a cosmic-ray muon rate at sea level of about 1 per cm² per minute on a horizontal detector. How many muons cross a horizontal square metre in a day?'
answer: 1.4e7
unit: muons per day
factor: 3
hints:
  - '1 m² = 10⁴ cm². A day has 24 × 60 = 1440 minutes.'
explain: '1 per cm² per minute × 10⁴ cm² × 1440 min = 1.44 × 10⁷ per day. Fourteen million muons a day through a square metre, 170 every second. Almost all of them are of low energy, a few GeV, and are stopped by a few metres of rock; the ones that matter for muography are the rare ones above 50 GeV or so, which are only about one per cent of the total.'
```

:::history{year=1970 title="Looking for a chamber in Khafre's pyramid" people="Luis Alvarez and collaborators" source="Source: Alvarez et al. (1970)."}
Luis Alvarez, who had won the 1968 Nobel Prize in Physics for his work with bubble chambers (Chapter 5), took the idea to Egypt. His team put spark chambers of about 4 m² in a chamber at the base of Khafre's pyramid, at Giza, and recorded the cosmic-ray muons that came through the stone above, looking for a direction in which the count was higher than the shape of the pyramid predicted. They published their result in *Science* in 1970: there was no hidden chamber in the part of the pyramid that the detector could see.:cite[alvarez1970] The method had been shown to work as a way of looking into a pyramid; what it needed was more muons than one detector could collect in the time, and better detectors.
:::

::muography{n="33.3" caption="A detector at the foot of a stone pyramid counts muons arriving at each angle in the plane of the section. The thicker the stone along a line of sight, the fewer muons get through; a hidden chamber makes the stone thinner for the directions that cross it, and the count rises. The plot on the right shows the counts with and without the chamber; below it, the data divided by the no-chamber expectation: the chamber is the excess in the orange bins. Switch the chamber off to see what noise alone looks like, and re-roll. A toy in two dimensions: a uniform pyramid of 230 m by 139 m, the PDG parametrisation of the sea-level muon spectrum, a continuous energy-loss model for rock, Poisson noise from a seed; no detector efficiency, no scattering, no backgrounds."}

```predict
q: 'A hidden chamber 6 m high lies on the vertical line of sight from the detector, in a pyramid whose stone along that line is about 90 m thick. It removes about 7 % of the stone. By roughly how much does the muon rate in that direction rise?'
options:
  - text: By about 0.07 %, a hundredth of the fractional change in thickness.
    why: 'Nothing scales down the change, and the flux is a steep function of thickness.'
  - text: By about 7 %, in proportion to the thickness removed.
    why: 'It would be 7 % if the muon rate were proportional to the thickness, but it is not. The rate falls with thickness much faster than that: each metre of rock removes the lowest-energy muons, and there are many more of those than of high-energy ones.'
  - text: By about 15 %.
    correct: true
    why: 'The flux of muons falls roughly as a power of the thickness, with an exponent a little above 2 at these depths (a muon that crosses 90 m needs about 45 GeV, and the number of muons above an energy falls steeply with energy). A 7 % reduction of the thickness then raises the rate by about 2.3 × 7 ≈ 16 %. The toy calculation of the library gives 16 % for 6 m out of 90 m, which is why a small void shows up clearly in a long exposure.'
```

:::history{year=2017 title="A void above the Grand Gallery" people="ScanPyramids collaboration" source="Sources: Morishima et al. (2017); Procureur et al. (2023)."}
The ScanPyramids project, started in 2015, used three kinds of muon detector on the Great Pyramid of Khufu: photographic **nuclear emulsions**, which record the track of a charged particle as a line of grains and need no electricity or readout; **scintillator hodoscopes**, planes of plastic bars of the kind used for triggering in particle experiments; and **gas detectors**, a family that descends from the multiwire chamber of Chapter 7. The first two were set up in the Queen's Chamber, inside the pyramid, and the gas detectors outside the pyramid.

In a paper in *Nature* in December 2017 the team reported a large void, which they called the Big Void, above the Grand Gallery: at least 30 m long, with a cross-section similar to that of the Gallery. It was seen by all three techniques, analysed independently.:cite[morishima2017] It was the first major internal structure found in the pyramid since the nineteenth century. A later paper, in 2023, used the same method to characterise a corridor-shaped structure behind the north face.:cite[procureur2023] What the void is for remains unknown: muons show where the stone is missing, and say nothing else.
:::

The method is limited by its statistics, which is why exposures last months. In the toy of the figure, a hidden chamber of 12 m by 5 m in a 20-day exposure with half a square metre of detector shows at a few standard deviations. Making the detector larger, or lengthening the exposure, improves the significance only as a square root (the statistics of Chapter 3), and the real measurements have to contend with what the toy leaves out: muons that scatter into the acceptance from the edge of the structure, the detectors' efficiencies, backgrounds from low-energy particles that mimic a muon, and the density of the stone, which is not uniform.

```numeric
id: muon-threshold-energy
title: The energy to cross a pyramid
prompt: 'In the course''s toy model a muon loses energy at −dE/dx = a + bE, with a = 2.0 × 10⁻³ GeV cm²/g and b = 4.0 × 10⁻⁶ cm²/g. The minimum energy for a muon to cross a mass thickness X is E_min = (a/b)(e^{bX} − 1). What is E_min, in GeV, for 100 m of limestone of density 2.4 g/cm³?'
answer: 50.4
unit: GeV
tolerance: 0.02
hints:
  - 'X = 100 m × 100 cm/m × 2.4 g/cm³ = 2.4 × 10⁴ g/cm².'
  - 'bX = 0.096. e^0.096 − 1 = 0.1008. a/b = 500 GeV.'
explain: 'X = 2.4 × 10⁴ g/cm², so bX = 0.096 and e^{bX} − 1 = 0.1008. With a/b = 500 GeV that is 50.4 GeV. The constants are of the right size for rock but not a fit: real energy-dependent tables (the PDG''s) differ by tens of per cent, and the toy says so in its documentation.'
```

The same technique has been used on other targets. Volcanoes, whose internal structure and conduits cannot be reached; archaeological sites; the inside of industrial plant; and the damaged reactors at Fukushima Daiichi, where a muon image in 2015 showed that the fuel had left the core of one reactor.:cite[bonechi2020] Muography is an application in which a particle physicist needs few of the machines of the field: the beam is natural, the detectors are small, and what is needed is the statistics and the calibration.

:::hood[Muons through rock in a few functions]
The module `hep/muography` has three pieces. The sea-level spectrum is the parametrisation of the PDG review, $\mathrm{d}N/\mathrm{d}E\,\mathrm{d}\Omega = 0.14\,E^{-2.7}\,[1/(1 + 1.1E\cos\theta/115\ \mathrm{GeV}) + 0.054/(1 + 1.1E\cos\theta/850\ \mathrm{GeV})]$. The energy loss gives the minimum energy for a thickness. The intensity behind rock is the spectrum integrated above that energy, in logarithmic steps.

```ts
export function minimumEnergy(X: number, loss: EnergyLoss = STANDARD_ROCK): number {
  return (loss.a / loss.b) * Math.expm1(loss.b * X);
}

export function transmittedIntensity(X: number, theta: number, loss: EnergyLoss = STANDARD_ROCK): number {
  return integralFlux(minimumEnergy(X, loss), theta);
}
```

`Math.expm1` computes $e^x - 1$ accurately for small $x$, which is where $bX$ is for thin rock: the subtraction of two numbers near 1 is the same kind of cancellation as in Chapter 2's $E^2 - p^2$. The parametrisation is valid for muons above about 100 GeV/$\cos\theta$, and the library says so, because integrating it down to 1 GeV overestimates the flux by an order of magnitude.
:::

## Other transfers

Beyond the cases above, particle physics has left some tools in other fields, and a few can be stated safely without numbers.

- **Accelerators.** The accelerators in hospitals and industry descend from the machines of Chapter 19: those that make the radioactive isotopes used in PET, those that deliver electron and photon beams for radiotherapy, and those that sterilise medical equipment.
- **Detectors and electronics.** Silicon sensors, scintillating crystals, and the fast, low-power readout chips developed for the experiments reappear in medical imaging, in security scanners, in X-ray crystallography at light sources and in space missions.
- **Superconducting magnets and cryogenics.** The LHC's dipoles (Chapter 20) are an extreme case of a technology that is used in MRI scanners, and the large-scale cryogenic and vacuum techniques have been transferred to other facilities.
- **Statistics and software.** The methods of Chapter 28 and the tools of the pipeline have been adopted, in some form, in other sciences.

It would be false to count each of these as an invention of particle physics: most were developed jointly with industry and other sciences, and many were shared in both directions. The case where the credit is clear is the next.

## The Web and the grid

In March 1989 Tim Berners-Lee, a software engineer working at CERN, wrote a proposal for a system for keeping track of information at the laboratory, titled "Information Management: A Proposal".:cite[bernerslee1989] The problem was local. CERN's experiments had thousands of physicists, who came from institutes all over the world and left again, using different kinds of computer, and the knowledge of how a thing worked was lost when the person who knew it went home. Berners-Lee proposed linking documents on different machines by **hypertext**, so that a reader could follow a reference from one to another. [Chapter 27](/chapters/a-needle-in-a-haystack/) has the story of the proposal, and the note his supervisor wrote on its cover. By the end of 1990 he had written the first browser and server.:cite[cernweb]

What turned a tool for a laboratory into the Web was a decision about who could use it.

:::history{year=1993 title="The Web is released into the public domain" people="CERN" source="Source: CERN, statement of 30 April 1993."}
On 30 April 1993 CERN issued a statement that put the software of the World Wide Web into the public domain: anyone could use, copy, modify and distribute it, without payment or royalties.:cite[cernpd1993] The Web had been written in a laboratory that had no interest in selling it, and the decision meant that it could be adopted without negotiation. By the end of 1993 there were more than 500 known web servers, and the Web carried about 1 % of the traffic on the Internet.:cite[cernweb] The rest is history that no longer belongs to particle physics.
:::

The Web is a case of a transfer that happened because the field had a problem that its size produced. The same applies to the computing infrastructure of Chapter 27. The LHC's experiments produce tens of petabytes of data a year, which no single centre could store or process, and the answer was the :term[Worldwide LHC Computing Grid]{id=wlcg}, a network of computing centres around the world that share the work and the data.:cite[wlcgtdr2005] The model of distributed computing with a common middleware, and the habit of making data and software open, spread from there to other sciences, and the CERN Open Data portal, from which this course takes its real events, is part of the same habit.

## What to explore next

This course covered the Standard Model, how it is measured, and the main open questions, and it did so by building the apparatus in miniature. If it interested you, here is where to go.

- **Run the pipeline on real data.** The CERN Open Data portal has the data of the CMS, ATLAS, LHCb and ALICE experiments, with documentation and examples; Chapter 29's analysis can be repeated on larger samples with the same logic. The Control Room of this course shows your own functions inside the whole chain.
- **Build something.** Appendix G describes a cloud chamber, a Geiger counter and a muon detector that you can make at home. The cosmic-ray muon rate of this chapter is one you can measure yourself, and its dependence on the zenith angle is the $\cos^2\theta$ of the toy.
- **Read the reviews.** The Particle Data Group's *Review of Particle Physics* is the reference for every number in this course (:cite[pdg2024]), and its review articles are a good second text on any topic.
- **Learn the theory properly.** The next step in rigour is a text on quantum field theory, for example Peskin and Schroeder (:cite[p4-peskin1995]), and an introductory text at the level of this one, such as Griffiths (:cite[griffiths2008]), for the physics without the formalism.
- **The other half of the story.** The [astrophysics course](/astrophysics/) in this collection covers what the universe does with these particles: stars, the early universe, dark matter and gravitational waves.

## Under the hood, and in the experiments

:::programmer
Every transfer in this chapter has the same structure, which a programmer will recognise: a **system built to a hard specification, then reused in a place where the specification is relaxed**. A detector built to time a particle to a nanosecond inside a radiation field turns out to be a very good camera. A hypertext system built for people who share no software works for everyone. A data-handling system built to tolerate the loss of any one of a hundred sites becomes infrastructure. Over-engineering for an extreme use is how general tools get made, and the cost is paid by the experiment that needs it.
:::

:::experiments
The detectors of the muographers are the instruments of Chapter 7 in smaller sizes. The nuclear-emulsion films of the ScanPyramids team were read with automated microscopes developed at Nagoya University for neutrino experiments, and are the same technology that OPERA used to see taus (Chapter 31). The scintillator and gas detectors come from the Japanese and French groups of the collaboration, and are of the kinds used for triggering and tracking in particle experiments. In the experiments' software the muon spectrum, energy loss and transport would be done with a full simulation such as Geant4, the toolkit that the LHC experiments use to simulate particles in matter, which follows every muon through a three-dimensional model of the structure, and the analysis would compare the counts in each direction with the prediction in the way this chapter does, with systematic uncertainties from the density and the detector response. The two-dimensional toy of this chapter is only the first step of that.
:::

## What comes next

This is the last chapter. The appendices collect what the course has used: [Appendix D](/appendix/particle-data/) is the table of the particles in the course, [Appendix E](/appendix/the-pipeline/) says what each stage of the pipeline models and what it leaves out, [Appendix F](/appendix/hep-reference/) is the reference for the library you have been writing against, and [Appendix H](/appendix/glossary-timeline/) has the glossary, the timeline of every history card and the bibliography.

## Further reading

- The ScanPyramids paper of 2017 (:cite[morishima2017]) and the review of muography by Bonechi, D'Alessandro and Giammanco (:cite[bonechi2020]).
- Wilson's 1946 paper (:cite[wilson1946]) and Alvarez's 1970 account (:cite[alvarez1970]).
- CERN's account of the origin of the Web (:cite[cernweb]) and its statement of 1993 (:cite[cernpd1993]).
- The Medipix collaboration's page at CERN's knowledge-transfer office (:cite[medipix]).
