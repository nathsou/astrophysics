---
number: 29
title: Finding the Higgs
summary: The whole pipeline, from a proton collision to a fitted peak at 125 GeV, run on the course's own simulation, and the same four-lepton analysis then run unchanged on real events recorded by CMS. What the 4 July 2012 announcement said, and how much of it you can reproduce.
duration: About 3½ hours
prerequisites: [the-statistics-of-discovery, a-needle-in-a-haystack, the-higgs-mechanism]
---

On Wednesday 4 July 2012, at a seminar at CERN, the two big experiments of Chapter 0 presented their latest results in the search for the Higgs boson. The seminar was timed as a curtain-raiser to the year's major particle-physics conference, which was starting in Melbourne.:cite[cern-higgs-2012] Joe Incandela of CMS and Fabiola Gianotti of ATLAS, the spokespersons of the two collaborations, each showed a histogram with a small peak at a mass of about 125 GeV. Each experiment reported an excess of events over the expected background at that mass, large enough by the standards of Chapter 28 to be called an observation. ATLAS quoted a local significance of 5.9σ (a p-value of $1.7\times10^{-9}$) and a mass of 126.0 ± 0.4 (stat.) ± 0.4 (syst.) GeV; CMS quoted 5.0σ and 125.3 ± 0.4 (stat.) ± 0.5 (syst.) GeV.:cite[atlashiggs2012,cmshiggs2012] The titles of the two papers that followed said what was claimed, and what was not: ATLAS reported "the observation of a new particle in the search for the Standard Model Higgs boson", CMS "the observation of a new boson at a mass of 125 GeV". The particle was *consistent with* the Higgs boson of Chapter 26. Whether it *was* the Higgs boson was left to the measurements of Chapter 30.

:::history{year=2012 title="4 July 2012" people="Fabiola Gianotti, Joe Incandela, the ATLAS and CMS collaborations" source="Sources: CERN press release, 4 July 2012; ATLAS (2012) Phys. Lett. B 716, 1; CMS (2012) Phys. Lett. B 716, 30."}
The data that the two experiments showed that day were the whole of the 2011 data at a collision energy of 7 TeV and about half of the 2012 data so far, at 8 TeV: for ATLAS 4.8 fb⁻¹ and 5.8 fb⁻¹, for CMS up to 5.1 fb⁻¹ and 5.3 fb⁻¹.:cite[atlashiggs2012,cmshiggs2012] Both used several decay channels, with the two cleanest, H → γγ and H → ZZ* → 4ℓ, providing the peaks, and both found the same thing at about the same mass, independently. The announcement was made at CERN with the two spokespersons, and CERN's press release said that the experiments had observed a particle consistent with the long-sought Higgs boson.:cite[cern-higgs-2012] The papers were submitted at the end of July and published in *Physics Letters B* that autumn.

Almost half a century separated the theorists' papers of 1964 (Chapter 26) from this talk.
:::

:::history{year=2000 title="LEP's last months" people="The ALEPH, DELPHI, L3 and OPAL collaborations" source="Source: LEP Working Group for Higgs Boson Searches (2003), Phys. Lett. B 565, 61."}
The search for the Higgs boson did not begin with the LHC. The Large Electron–Positron collider (LEP, Chapter 21), which occupied the same tunnel, ran from 1989 to 2000 and searched for the process e⁺e⁻ → ZH, in which a Z boson radiates a Higgs boson. In its final year LEP was pushed to its highest energy to reach as high a Higgs mass as possible, and in the autumn of 2000 a few candidate events suggested a mass near 115 GeV. The combination of the four experiments found a small excess of events at about that mass, at the level of about two standard deviations: not evidence, and not nothing. It also excluded, at 95 % confidence, a Standard Model Higgs boson with a mass below 114.4 GeV.:cite[lephiggs2003] The machine was closed in November 2000 and taken out of the tunnel to make room for the LHC. A Higgs boson at 125 GeV, about 10 GeV above the limit that LEP set, was just out of the reach of the machine that preceded the LHC.
:::

## Two small channels

The Higgs boson of 125 GeV decays most often to a pair of b quarks (58 %, Chapter 30), and that is the decay that is not used for the discovery. The reason is the background. The decay produces two jets, and pairs of jets with b quarks are made by the strong force in numbers that exceed the signal by a factor of a million or more. A peak of a few thousand events could never be seen above that. The discovery used instead the two channels in which the mass can be measured to better than 2 %, and the background is smaller:

- **H → γγ**, with a branching fraction of 0.23 %. The final state is two photons, which the electromagnetic calorimeter measures with an energy resolution of the order of one per cent. The invariant mass of the pair has a narrow peak. The background is mostly the :term[irreducible]{id=irreducible-background} continuum of real photon pairs (qq̄ → γγ and gg → γγ), and a *reducible* part in which one or both "photons" are really jets whose π⁰ → γγ decays look like a photon.
- **H → ZZ\* → 4ℓ**, with a branching fraction of about 0.012 % for four electrons or muons. A Z boson of 91 GeV and a second, off-shell Z\* (Chapter 26) each decay to a lepton pair. The four leptons are measured precisely by the tracker and the muon chambers, and the mass of the four-lepton system is the Higgs mass. There are very few events, and almost no background in the narrow peak. The backgrounds are the irreducible qq̄ → ZZ\* → 4ℓ and the reducible ones with jets and heavy-flavour decays.

The numbers show why these two compensate for each other. In this course's simulation (a leading-order calculation, with the signal multiplied by a constant K = 3.4 that stands for the higher orders, Chapter 27), a data set of 10 fb⁻¹ at 8 TeV holds about 440 H → γγ events before any selection, and the 13.9 fb⁻¹ of the CMS open data of this chapter (2.3 fb⁻¹ at 7 TeV and 11.6 at 8 TeV) hold about 31 produced H → 4ℓ events. The diphoton channel has more events but a signal of about one per cent of the background in the window. The four-lepton channel has about a dozen events and a signal that is comparable to the background.

```predict
q: 'After the selection, the diphoton channel has a few hundred signal events on a continuum of a few thousand in the peak window, and the four-lepton channel a few signal events on a background of about the same size. Which of the two channels would you expect to give the larger expected significance?'
options:
  - text: The four-lepton channel, because the signal is as large as the background.
    why: 'A large S/B helps, but significance is set by the statistics too. With so few events (s ≈ 8, b ≈ 5) the Asimov formula of Chapter 28 gives about 3.1σ.'
  - text: The diphoton channel, because it has a hundred times more events.
    why: 'It has more events, but they sit on a background about a hundred times larger than the signal, and the significance goes as s/√b. In the course’s simulation the diphoton channel gives about 6σ, which is bigger than the 3σ of the four-lepton one, but not by a factor that reflects the ratio of the event counts.'
  - text: Both are of the same order, within a factor of two or so.
    correct: true
    why: 'A large number of events on a large background (s/√b) and a few events on a small background give comparable significances. In the two 2012 discovery papers each of the two channels gave evidence by itself, and neither alone gave a discovery; it was the combination that reached 5σ.'
```

## The whole pipeline

Everything in the course has been leading to this figure. The pipeline of Chapter 0, six stages, is run here for the Higgs boson: the **machine** sets the beams (in the two figures below, the Control Room's presets: 13.6 TeV and an average of ten simultaneous pile-up collisions), the **generator** makes a Higgs boson (and the background it competes with) with leading-order matrix elements, a parton shower and the toy hadronisation, the **detector** turns the particles into hits and calorimeter energy, **reconstruction** turns those into photons, electrons and muons, the **trigger** decides whether the event would have been kept, and the **analysis** selects, histograms and fits. The pipeline widget runs the stages live, and lets you open the Control Room to change any one of them.

::pipeline{preset="higgs-gamgam" n="29.1" caption="The whole chain for H → γγ, over the irreducible diphoton background: machine → generator → detector → reconstruction → trigger → analysis. Each stage shows its counters. If you have written a function in an earlier chapter and switched on use my code, the stage that uses it says so."}

::pipeline{preset="higgs-4l" n="29.2" caption="The same chain for H → ZZ* → 4ℓ. The generator has no ZZ* continuum of its own, so this preset builds one from the same pieces: leading-order qq̄ → ZZ* → 4ℓ. This preset has a switch between the simulation and real data: the real data are the 278 four-lepton candidates of the CMS Open Data education sample (2011 and 2012), put through the same selection. Do not compare the heights: the simulation is scaled to 100 fb⁻¹ at 13.6 TeV, the real data are 13.9 fb⁻¹ at 7 and 8 TeV. Look at where the real events fall. The diphoton preset has no such switch, because no real diphoton sample is shipped with the course (the section on real data below says why)."}

Two warnings before reading numbers off these figures. First, the two presets are the Control Room's, not the ones that made the 2012 discovery: the machine runs at 13.6 TeV with on average ten pile-up collisions per crossing, the detector is the Control Room's default model, and the result is scaled to 100 fb⁻¹ with the leading-order cross-sections and no higher-order factor (the note under each histogram says so). The peak position, the width and the significance that the widget prints belong to that configuration and to its pseudo-data (a Poisson fluctuation of the simulated histogram); they are not the 2012 numbers and they are not the numbers of the rest of this chapter. Second, the page opens with a precomputed sample so that the histogram is there at once; *Run live* runs the same code in your browser, with your own functions if you have switched them on. The figures are the way to see every stage at work. The analysis of the rest of the chapter uses a separate simulation, built for it, at 8 TeV and without pile-up (below).

Each stage has a cost in signal that can be counted. For the diphoton channel the course's own samples (made once, with fixed seeds, by `scripts/data/higgs-sim.ts`, so that the page does not have to simulate 100,000 events when you open it) give the cut flow of the table below, for a data set equivalent to 9.99 fb⁻¹ at 8 TeV. It is a *simulation*: it is not data, and its normalisation is leading order.

| Stage | H → γγ signal | γγ continuum (truth mass 95–175 GeV) |
|---|---|---|
| Produced in the window (generator) | 441.9 | 100,000 |
| Two reconstructed photons | 376.9 (85 %) | 73,779 (74 %) |
| Trigger | 295.1 | 52,575 |
| both \|η\| < 2.4 | 285.2 | 50,206 |
| pT > m/3 and m/4 | 261.4 | 41,747 |
| Isolated | 257.5 | 41,450 |
| 105 < mγγ < 160 GeV | 257.5 | 26,518 |

The signal has lost 42 % on the way, mostly in finding two photons (15 % of the events have fewer) and in the trigger (22 % of those that remained), and the continuum 73 %, partly in the mass window. After all this, the signal is 1 % of the background: S/B = 0.0097. The efficiencies are all quantities that can be computed exactly because the simulation has a truth record, which a real experiment has to estimate: the trigger efficiency, for instance, is measured in real data from Z → ee events using the "tag and probe" method.

:::experiments
In the experiments each of the six stages is a large production system. The generators are **Pythia**, **Herwig** and **MadGraph5_aMC@NLO**, at higher order than this course's leading order; the detector simulation is **Geant4**, which tracks every particle through a model of the detector with millions of volumes; the reconstruction is each experiment's own software (**CMSSW** for CMS and **Athena** for ATLAS), run on the Worldwide LHC Computing Grid (Chapter 27); the trigger is run in emulation on the simulated events. What the analyst receives is a compact file with the reconstructed physics objects, in a format that both experiments write in the ROOT file format (Chapter 27) and have reduced, in the latest releases, to a few kilobytes per event. The analysis, of the kind this chapter does, then runs on those files, today often with columnar tools such as ROOT's **RDataFrame**, which is the same idea as the course's `EventTable`. The course's toy samples are the same kind of file, a hundred thousand times smaller.
:::

## Truth and reconstruction, once more

The simulation keeps a record of what really happened in each event, the *truth*, next to what the detector and the algorithms saw, the *reconstruction* (the through-line of Chapter 0). For a Higgs event this means that one can compare, event by event, the two photons that the Higgs boson decayed into with the two photon candidates that the reconstruction found. The figure shows one such event.

::truth-reco-compare{sample="hgg" n="29.3" caption="A simulated H → γγ event, truth and reconstruction side by side. Select a reconstructed photon to see the truth particle it was matched to. In real data only the reconstruction exists."}

In 15 % of the simulated H → γγ events the reconstruction does not find two photons (the usual reasons are a photon that converted in the tracker into an electron pair, one that fell outside the acceptance, and two that merged into one cluster). The efficiency is a statement that can only be made with truth, and it is used to correct the measured yield back to a cross-section. It is also the reason a real analysis depends on its simulation: the efficiency of a real detector cannot be measured by comparison with the truth, and is estimated from the simulation, which is itself checked against data in control regions (Chapter 28).

## Choosing the selection

A selection is the set of cuts that keep the signal and reject the background. Each cut costs some signal and removes some background, and the best one is not the tightest. The criterion is the expected significance of Chapter 28, $Z = \sqrt{2[(s+b)\ln(1+s/b) - s]}$, which is the function `significance` that you wrote there. The toy figure below has a narrow mass peak on a large background, and a "photon quality" score that tends to be higher for real photons. Move the three cuts and watch $Z$.

::cut-optimiser{n="29.4" caption="A toy signal and background in two variables, and the expected significance as a function of the cuts. Tightening a cut removes background faster than signal, up to a point, and after that the signal runs out. The optimum, found by the library's selectionOptimiser, is one button away. It is a compromise, not 'as tight as possible'."}

```cuts
id: cuts-diphoton-toy
title: Optimise the selection of a toy diphoton sample
prompt: 'A toy sample has 150 signal events with a mass near 125 GeV (resolution 2.5 GeV) and a photon-quality score that tends to be high, on 20,000 background events with a falling mass spectrum and a lower score. Choose the mass window and the minimum score to reach an expected significance within 10 % of the best that the library finds.'
config:
  seed: 29
  signal:
    events: 2500
    yield: 150
    vars:
      m: { dist: normal, mean: 125, sigma: 2.5 }
      d: { dist: normal, mean: 0.72, sigma: 0.17, min: 0, max: 1 }
  background:
    events: 25000
    yield: 20000
    vars:
      m: { dist: exponential, mean: 35, offset: 100, max: 160 }
      d: { dist: normal, mean: 0.4, sigma: 0.22, min: 0, max: 1 }
variables:
  - { name: m, label: 'm(γγ)', unit: GeV, kind: window, lo: 100, hi: 160, step: 0.5 }
  - { name: d, label: 'photon quality', kind: min, lo: 0, hi: 1, step: 0.01 }
par: auto
hints:
  - 'A window of about ±1 to ±1.5 times the resolution around 125 GeV is usually near the best: a narrower one loses signal, a wider one only adds background.'
  - 'The quality cut works the same way. A cut around the middle of the signal’s distribution, much higher than the background’s, tends to maximise Z.'
explain: 'The best selection keeps a window of a few GeV around the peak and a quality cut that removes most of the background while keeping about half of the signal. Going much tighter loses the signal faster than the background, which is the rule that the expected significance expresses.'
```

For the full simulation, the selection of this course follows the ones that the experiments use for H → γγ: both photons reconstructed and within the acceptance (|η| < 2.4), identified as isolated, with transverse momenta above fractions of the diphoton mass (one third for the leading photon, one quarter for the second). The fractions of the mass, as opposed to fixed thresholds, are a deliberate choice: a fixed threshold on the transverse momentum would shape the mass spectrum by itself, and would carve out a turn-on in the background that a smooth function would not fit.

## The diphoton mass fit

Now the analysis proper. After the selection, the diphoton mass is histogrammed in 1 GeV bins from 105 to 160 GeV. The model that is fitted is a peak on a smooth background:

:::equation{#massfit caption="The model fitted to the diphoton mass spectrum: a signal peak whose shape is fixed from the simulation, on a smooth background, with a free yield for each."}
$$\term{nm}{n(m)} = \term{ns}{N_s}\,f_\text{sig}\!\big(m - \term{dm}{\Delta m}\big) + \term{nb}{N_b}\,f_\text{bkg}(m;\ \term{bp}{\vec b}), \qquad m_H = m_H^\text{sim} + \Delta m$$

```terms
nm:
  label: 'n(m), the expected number of events per GeV'
  what: The model's prediction for the diphoton mass spectrum, in events per GeV at mass m.
  why: The fit compares it with the observed counts in each bin by the Poisson likelihood of Chapter 28.
  effect: Away from 125 GeV only the background term matters, and it is what sets the denominator of the significance.
ns:
  label: '$N_s$, the signal yield'
  what: The number of events in the peak, a free parameter of the fit, positive for an excess and allowed to be negative for a deficit.
  why: It is the measurement. $N_s$ divided by the number expected is the signal strength μ of Chapter 30.
  effect: The fit reports it with its uncertainty. A yield of 240 ± 47 events is five standard deviations from zero.
dm:
  label: 'Δm, the shift of the peak'
  what: How far the observed peak is from the position it has in the simulation, in GeV. It is a free parameter of the fit.
  why: The mass is measured relative to the simulation. The simulation fixes the shape (the width, the tail), and the data fix where it is.
  effect: A shift of 0.25 GeV in the error means the mass is measured to 0.25 GeV, statistically. A mis-calibration of the energy scale shifts every peak, and it is the leading systematic uncertainty.
nb:
  label: '$N_b$, the background yield'
  what: The number of background events in the fit range, free in the fit.
  why: The background is fitted from the data in the sidebands, away from the peak, not taken from the simulation.
  effect: 'It is the largest number in the fit: about 26,000 events for 240 of signal.'
bp:
  label: 'b, the background shape parameters'
  what: 'The parameters of the smooth function that describes the continuum: the coefficients of a Bernstein polynomial, or the slope of an exponential.'
  why: Their choice is a modelling decision. A function that does not describe the continuum can make a fake signal, or hide a real one.
  effect: The figure lets you change the function. This simulated continuum has a shoulder near 105 GeV that a single exponential does not follow, and the fitted yield moves with the choice.
```
:::

The shape of the signal comes from the simulation, as in the experiments. Fitted to the simulated H → γγ events that pass the selection, the line shape of this detector model is not a single Gaussian: it is a narrow core of width 0.74 GeV that holds 88 % of the events, and a wider component of 1.9 GeV, centred a little lower. The peak sits at 126.8 GeV for a generated mass of 125.2 GeV: the toy detector's photon energy scale is about 1.3 % high. This is a **systematic uncertainty** of the kind Chapter 28 described, made visible: in the real experiments the energy scale is calibrated, among other things, with the Z boson, and its uncertainty is the main systematic uncertainty on the mass in these channels.:cite[atlashiggs2012,cmshiggs2012] Here the shape is a template, and it is the *shift* from it that is fitted.

::higgs-hunt{n="29.5" caption="The diphoton analysis on simulated events, end to end. The data set is built from the course's own pipeline: 100,000 continuum events (9.99 fb⁻¹ at 8 TeV) and a Poisson number of H → γγ events. Change the selection and the cut flow updates; the histogram is fitted with a signal peak on a background of your choice. Reveal the truth to see which events are signal. The simulation has no photon-like jets and no K factor for the continuum, so the continuum is smaller and the significance better than in a real analysis of the same luminosity."}

For the data set shown first (seed 1, the whole 9.99 fb⁻¹, the standard selection) the fit with a Bernstein polynomial of the third order gives

| Quantity | Fit result | Simulation truth |
|---|---|---|
| Signal yield | 242 ± 47 events | 243 signal events in the data set |
| Mass of the peak | 125.06 ± 0.25 GeV | 125.2 GeV (generated) |
| Local significance | 5.3σ (p = 5 × 10⁻⁸) | |
| Goodness of fit | χ²/ndf = 44.7/49, p = 0.65 | |

and it is consistent with what was generated: this is a closure test, and a test of the machinery of the fit, not a measurement. Repeated for twenty data sets that differ in the signal events drawn, the signal yield is recovered without a significant bias (the mean pull is 0.2), and the local significance averages 5.9σ with a spread of 0.4. The test of those values is in `src/lib/sims/part7/higgs-analysis.test.ts`.

Three honest caveats belong with those numbers. First, the significance is *better than in the real experiments*. The simulated detector is a better calorimeter than a real one (a core resolution of 0.74 GeV, where the experiments' papers have a resolution of the order of 1 to 2 GeV), the continuum has no photon-like jets, and there are no categories to optimise and no systematic uncertainties, which would all be included in a real fit. For the same reasons the number is a statement about *this* chain and not a prediction for ATLAS or CMS. Second, the background shape matters: switch the function to a single exponential and the fit quality and the yield change, because the simulated continuum has a feature a single exponential does not describe; the choice of the function has to be made, and tested on background-only data, before the signal region is looked at. Third, the significance quoted is :term[local]{id=local-significance}: the mass was free in the fit, and the global significance is smaller by the look-elsewhere effect of Chapter 28, which for a mass range of tens of GeV and a resolution of 1 GeV is a trial factor of tens.

```numeric
id: significance-from-p
title: From a p-value to a number of standard deviations
prompt: 'ATLAS reported a local p-value of 1.7 × 10⁻⁹ for the excess at 126 GeV. What is that in standard deviations (one-sided)?'
answer: 5.91
unit: σ
tolerance: 0.004
hints:
  - 'Z is the value for which the one-sided upper tail of a Gaussian equals p. 5σ is 2.87 × 10⁻⁷ and 6σ is 9.9 × 10⁻¹⁰.'
explain: 'The p-value lies between those of 5σ and 6σ, closer to 6σ: Z = 5.91. It is the library function pToZ (1.7e-9) and ATLAS quoted it as 5.9σ.'
```

```numeric
id: mass-resolution
title: The mass resolution of a diphoton peak
prompt: 'For a Higgs boson of 125.2 GeV decaying symmetrically, the two photons have equal energies. Take each photon’s energy resolution to be 1.5 % and neglect the uncertainty on the angle between them. What is the resolution on the diphoton mass, in GeV? (For two massless particles m² = 2E₁E₂(1 − cos θ).)'
answer: 1.33
unit: GeV
tolerance: 0.02
hints:
  - 'δm/m = ½ √((δE₁/E₁)² + (δE₂/E₂)²), since m ∝ √(E₁E₂).'
explain: 'δm/m = ½ √2 × 1.5 % = 1.06 %, and 1.06 % of 125.2 GeV is 1.33 GeV. The peak is a few GeV wide, which is why the background under it is not negligible.'
```

## The four-lepton peak

The four-lepton channel needs its own analysis, and its own care. The selection looks for four leptons (electrons or muons) that make two pairs of opposite charge and the same flavour, as for H → ZZ* → 4e, 4μ and 2e2μ. The pair whose mass is closest to the Z mass is called Z₁ and the other Z₂. There are thresholds on the transverse momenta of the leptons, 20 and 10 GeV for the two hardest and a lower one for the others, and on the masses of the pairs: Z₁ between 40 and 120 GeV, and Z₂ above 12 GeV (it is the off-shell Z\*, and can be light). The mass of the four leptons together is the quantity to histogram. The function that does this, `analyse4l` in `src/lib/sims/part7/higgs.ts`, uses only what every source of events has: the four-vectors, the charges and the flavours. That is the whole point of the next section.

Run on the course's simulated H → ZZ* → 4ℓ events, the same chain as above gives a four-lepton peak. Only 17 % of the 6,000 generated events have four reconstructed leptons, and 13 % pass the trigger and the selection; the simulated peak has a mean of 124.4 GeV and a width of 1.6 GeV. The flavour composition is odd: the course's detector reconstructs more four-electron events (228) than four-muon ones (163), the opposite of a real detector, and the probable cause (not checked) is that the toy muon system needs muons of a momentum that the soft leptons from the off-shell Z\* often do not reach. For the same reason, and because the leading-order cross-section is smaller than the real one even with the factor K, the course's simulation expects about four selected H → 4ℓ events in the 13.9 fb⁻¹ of the next section, about 40 % of what the simulation of CMS expects there.

## The same analysis on real data

Everything so far has been simulation. This section runs the four-lepton analysis on **real data**.

The data are 278 candidate events recorded by the CMS experiment in 2011 and 2012, which the CMS open-data education programme released as small tables, one row per event, with the four-vectors, the charges and the flavours of the four leptons. The course ships them as they are (`static/data/h4l-cms-opendata.json`; the manifest beside it gives the source, the licence, the selection and the checksum). They come from copies on GitHub of files from the CERN Open Data portal. The portal itself could not be reached when the course was written, so the record numbers are those that the copy states, and the licence is the one the copy states: CC BY 4.0 (the portal's terms for CMS derived data are CC0; both allow what the course does, with attribution).:cite[cms-4l-open-data,cms-h4l-example] The accompanying notebook also contains four histograms from CMS's own simulation of the backgrounds (ZZ, Z/γ\* + X and tt̄) and of a 125 GeV Higgs signal, weighted to the luminosity of the data (2.3 fb⁻¹ at 7 TeV and 11.6 fb⁻¹ at 8 TeV, as the notebook's plot title says); the figure uses them as the backgrounds. The notebook says that these events are about half of the four-lepton data that was publicly available from 2011 and 2012, and they are not the data set of the discovery paper.

The point of the exercise is the **swap**. The course's analysis, `analyse4l`, takes four leptons as plain objects with a flavour, a charge and a four-vector, and does not know where they came from. The figure has one button that changes the source of the events, from the real events to simulated pseudo-data, and nothing else changes.

::four-lepton-swap{n="29.6" caption="One analysis, two sources. With the button on real data, the 278 CMS events pass through the course's four-lepton selection and the mass is histogrammed; the stacked histograms are CMS's own simulated backgrounds (ZZ, Z/γ* + X, tt̄) and a simulated 125 GeV Higgs signal, from the notebook that accompanies the data. With the button on simulation, the points are pseudo-data: the same backgrounds plus the course's own simulated Higgs events, Poisson-fluctuated. Change the thresholds and watch both."}

What the real data show. All 278 events pass the course's selection: they had already been selected by CMS with similar cuts, so the analysis has nothing to remove. That is a result in itself, a check that two independently written selections agree. Of the 278, 102 lie in the plot range (70 to 181 GeV) and the rest, 176 events, above it. The peak between 85 and 97 GeV, with 44 events, is the Z boson itself decaying to four leptons (one of its lepton pairs radiating a second pair through a virtual photon), which the simulated ZZ histogram also contains; the rest of the spectrum is the continuum. The new feature is between 121 and 130 GeV, the three 3 GeV bins in which the simulation puts the signal. There the CMS simulation expects 8.2 events from a Standard Model Higgs boson and 4.7 from the background, and the data contain **12**. The expected total is 12.9. Of the pieces of Chapter 28:

| Quantity | Value |
|---|---|
| Observed in 121–130 GeV | 12 |
| Expected background (CMS simulation) | 4.66 |
| Expected signal (CMS simulation, Standard Model) | 8.20 |
| Poisson p-value of 12 or more for b = 4.66 | 0.0031, a local significance of 2.7σ |
| Signal strength μ from a fit of all 37 bins, with the templates fixed | 0.92 ± 0.40 |
| Significance of that fit against the background-only one | 3.3σ |

The numbers deserve some care. The window was chosen from the simulated signal, not from the data, but the data had been looked at when it was chosen: the value is *post hoc* and local, and a window set in advance, with the data blinded (Chapter 28), would have been the honest way. The 12 events are a sample of a size at which Poisson fluctuations are of order 3. The fit finds a signal strength of 0.92 ± 0.40 relative to the Standard Model Higgs boson of the notebook's simulation, which is compatible with 1: the data cannot tell a Standard Model Higgs boson from one with a rate of half or one and a half times as large. And the three numbers do not agree on the significance (2.7σ for the counting window, 3.3σ for the fit), because they use different information; neither is a discovery on its own. What can be said is that the real events have an excess near 125 GeV, of the size that the Standard Model predicts, in a channel with very low background. The 12 events in the window are listed in the figure, with their masses, flavours, years and run and event numbers: they are individual collisions that happened at the LHC and can be looked up.

The fit of the signal strength goes through the function `fitLikelihood` of Chapter 28. If you have written it and installed it, the fit above is *your* fit.

```ts
// the swap: the same function, two sources of events
const real = cmsEvents.map((e) => analyse4l(e));        // Event4l from the CMS files
const simulated = courseEvents.map((e) => analyse4l(e)); // Event4l from the course's pipeline
```

:::programmer
The swap is **dependency injection** at the level of the data. `analyse4l` depends on an interface (a list of leptons with a flavour, a charge and a four-vector), not on a class, a file format or a generator, and the two sources are two implementations of it. This is also why the course keeps the *truth* out of the analysis: a function that reads the truth record cannot be run on real data, because the real data have none. A bug that appears only when you swap the source is almost always an assumption that was hidden in the interface: here, that the simulated events have isolation variables and the real ones do not, and the course's analysis therefore uses neither.
:::

:::hood[Converting open data into the course's format]
The real files are tables of text (CSV), one row per event, with 41 columns: the run and event numbers, and for each of four leptons a flavour code, an energy, three momentum components, and derived quantities. The preparation script `scripts/data/h4l.py` reads six of them with the Python standard library and writes two things. One is a compact JSON file for the figure, with the four-vectors as published. The other is the same events in the format that the pipeline widget reads for real data, `objects-f32-v1` (described at the top of `src/lib/hep/pipeline/real.ts`): one row per reconstructed object, eight 32-bit floats, in event order. The conversion of a lepton is a few lines:

```python
pt = math.hypot(px, py)
eta = math.asinh(pz / pt)
phi = math.atan2(py, px)
kind = 0 if abs(pid) == 13 else 1        # 0 muon, 1 electron
rows.append((float(event), float(kind), pt, eta, phi, E, float(charge), -1.0))   # isolation: not in the files
```

A check is built in: the mass of the four leptons recomputed from the four-vectors reproduces the mass in the file's own column to at most 0.006 GeV (the files carry six significant figures). Both outputs have a manifest with the source, the licence, the selection and the SHA-256 of each source file and of the output. The simulated samples have the same structure, written by `scripts/data/higgs-sim.ts`, with the generator, detector, reconstruction and trigger of the course; that script and its output are 1.8 MB in all.
:::

## Real diphoton data: not shipped

The course does not ship a real diphoton data set. The diphoton data of the ATLAS Open Data release are files of hundreds of megabytes to gigabytes, and the CERN Open Data and ATLAS Open Data portals could not be reached from the environment in which the course was written, so no real diphoton file could be obtained and checked, and none is included. The analysis of the diphoton channel in this chapter therefore runs on simulation, and says so.

You can run the same analysis on the real ATLAS data outside the course. ATLAS provides a notebook, *How to rediscover the Higgs boson yourself!*, in its notebook collection (`13-TeV-examples/uproot_python/HyyAnalysis.ipynb` in the repository `atlas-outreach-data-tools/notebooks-collection-opendata`), which reads the 13 TeV diphoton data from the ATLAS Open Data portal with the Python library `uproot`, applies the cuts (photon quality, transverse momenta, isolation, the fractions of the mass that this chapter used) and fits a polynomial background plus a Gaussian peak.:cite[atlas-open-data] The course's `::higgs-hunt` figure and the pipeline widget are ready for the result: if a real diphoton file is added under `static/data/` in the format described in `scripts/data/README-higgs.md` (a real-data manifest and a table of photons, in the pipeline widget's `objects-f32-v1` format, or a small JSON of the two photons of each event), the figures offer it as a source, with nothing to change in the code. `scripts/data/gamgam-atlas-opendata.py` is a template for writing such a file from the ATLAS Open Data; it has *not* been run, for the reason above, and says so in its header.

## What was not done

It is worth saying what a real analysis does that this one did not, because the gap is the reason the experiments needed years.

- **Reducible backgrounds.** Photons that are really jets, and the Z + jets and top backgrounds to four leptons, are not simulated. In the real analyses they are estimated from the data in control regions.
- **Categories.** The experiments divide the events into classes with different resolution and different signal-to-background (photons in the barrel or the endcaps, converted or not, with different production signatures), fit them simultaneously and combine them. This is the main reason a real analysis gets more significance from a given data set than a single mass histogram does.
- **Systematic uncertainties.** The fit here has no nuisance parameters except the shape of the background: no energy scale, no resolution, no efficiency or luminosity uncertainty (Chapter 28).
- **Pile-up.** The collisions here have no other collisions overlaid. In 2012 there were of the order of twenty collisions per crossing, which complicates the selection of the right vertex and the isolation of the photons.
- **The look-elsewhere effect** and the combination of channels, which turn the local significance of each channel into the global one for the discovery.

None of these makes the analysis here wrong. Each is a place where this chapter's number would move.

:::experiments
**HEPData** (hepdata.net) is the repository where the experiments publish the numbers behind the figures of their papers: histograms, cross-sections, covariance matrices, in a machine-readable form. It is the place to look for the published diphoton and four-lepton mass spectra of the Higgs papers (the portal could not be reached when this chapter was written, and the course does not include them). The **CERN Open Data portal** (opendata.cern.ch) and the **ATLAS Open Data portal** (opendata.atlas.cern) release actual events, in reduced formats, for education and for research; the four-lepton files of this chapter are from the education branch of the first. The analysis frameworks of the two experiments, CMSSW and Athena, produce the files on the grid. The columnar tools that read them (Python's `uproot` and `awkward`, ROOT's RDataFrame) work on arrays of values for all the events at once, as the course's `EventTable` does. In all of them the unit of work is the same as here: select, histogram, fit, and compare with the simulation.
:::

```fermi
id: higgs-per-run2
title: Higgs bosons in the Run 2 data
prompt: 'The Higgs production cross-section at 13 TeV is several tens of picobarns; take 50 pb. ATLAS recorded about 140 fb⁻¹ of good data in Run 2 (2015 to 2018). About how many Higgs bosons were produced in that data in one experiment?'
answer: 7e6
factor: 3
hints:
  - Number of events = cross-section × integrated luminosity. 1 pb = 1000 fb.
explain: "50 pb = 5 × 10⁴ fb, and 5 × 10⁴ fb × 140 fb⁻¹ ≈ 7 × 10⁶: about seven million Higgs bosons, most of which were never identified: the H → γγ branching fraction of about 0.2 % leaves some 16,000 diphoton decays before acceptance and selection, among a continuum background many times larger."
```

## What comes next

The peak has been found, in the simulation and in the real data. [Chapter 30](/chapters/measuring-the-higgs/) asks whether it is the Higgs boson of Chapter 26: its production and decay rates, its spin and parity, the proportionality of its couplings to mass, and the shape of its potential.

## Further reading

- The two discovery papers: ATLAS, *Observation of a new particle in the search for the Standard Model Higgs boson with the ATLAS detector at the LHC*, and CMS, *Observation of a new boson at a mass of 125 GeV with the CMS experiment at the LHC* (:cite[atlashiggs2012,cmshiggs2012]).
- CERN's press release of 4 July 2012 (:cite[cern-higgs-2012]).
- The LEP Higgs search that preceded the LHC's (:cite[lephiggs2003]).
- The CMS open-data education materials and the Higgs-to-four-lepton example on which the notebook is based (:cite[cms-4l-open-data,cms-h4l-example]); the ATLAS Open Data portal and notebooks (:cite[atlas-open-data]).
