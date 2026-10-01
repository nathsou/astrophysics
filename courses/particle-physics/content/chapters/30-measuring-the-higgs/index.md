---
number: 30
title: Measuring the Higgs
summary: "A peak at 125 GeV is not yet the Higgs boson of Chapter 26. What it takes to show that: how the particle is made and decays, its spin and parity, couplings that follow mass, a self-coupling that has not yet been measured, and what the numbers say about the future of the vacuum."
duration: About 2½ hours
prerequisites: [finding-the-higgs, the-higgs-mechanism]
---

On 4 July 2012 the two experiments announced a new particle with a mass near 125 GeV that decays to two photons and to four leptons (Chapter 29). A peak in a mass spectrum shows that something exists. It does not show that it is the particle of Chapter 26: a neutral scalar whose couplings are in proportion to the masses of the particles it couples to, sitting at the bottom of a potential of the shape that this chapter calls the Mexican hat. The Standard Model makes a list of very specific predictions about it, and the experiments' work after 2012 has been to check them one at a time. This chapter goes through the list. For each item, it says what the prediction is, how it is tested, and what has so far been found, taking care to say only what is established.

## How a Higgs boson is made

A proton collision makes a Higgs boson in four main ways. All of them follow from the rule that the Higgs couples to mass.

- **Gluon fusion.** Two gluons from the colliding protons turn into a Higgs boson. Gluons are massless and have no mass to couple to, so this happens through a loop: the gluons couple to a loop of quarks, and the quarks couple to the Higgs boson. The top quark dominates the loop, because its coupling is by far the largest. Gluon fusion is the most frequent way by a large margin, roughly nine times in ten.
- **Vector-boson fusion.** Two quarks each radiate a W or a Z, and the two bosons fuse into a Higgs boson, leaving the two quarks as jets close to the beam, one on each side. It makes a few per cent of the Higgs bosons and has a distinctive signature.
- **Associated production with a W or a Z (Higgs-strahlung).** A quark and an antiquark make a W or a Z, which radiates a Higgs boson. The W or Z can be seen decaying to leptons, which gives a clean handle on a decay that is otherwise hard to find, such as H → bb̄.
- **Associated production with a top-quark pair (ttH).** Gluons make a pair of top quarks and one of them radiates a Higgs boson. It is rare, about one Higgs boson in a hundred, and it is the one process that measures the top quark's coupling to the Higgs boson directly.

The shares are rounded values of the calculations that the LHC Higgs Cross Section Working Group collects in its reports; they change a little with the energy of the collisions.:cite[lhchxswg2017] The total cross-section is of order several tens of picobarns at the LHC's energies (Chapter 27).

The loop in gluon fusion carries a lesson. If the only particle in the loop were the top quark, the rate would be proportional to the square of its coupling, and measuring the rate would measure that coupling. But any heavy particle that carries colour would also contribute, whether or not it was discovered on its own. So gluon fusion measures the *sum* of everything in the loop, and ttH, in which the top couples to the Higgs directly, is the check that the sum is what it seems. Comparing the two is a test for new heavy coloured particles.

## How it decays

For the Higgs boson of mass 125.2 GeV the Standard Model gives definite branching fractions. The partial width into a pair of fermions is the formula that Chapter 26 hinted at: the coupling squared times the phase space.

:::equation{#ffwidth caption="The partial width of the Higgs boson into a fermion pair, at leading order. It is proportional to the square of the fermion's mass."}
$$\Gamma(H\to f\bar f) = \frac{\term{nc}{N_c}\,\term{gf}{G_F}\,\term{mh}{m_H}\,\term{mf}{m_f}^{2}}{4\sqrt2\,\pi}\,\term{beta}{\beta}^{3}, \qquad \beta = \sqrt{1 - \frac{4m_f^2}{m_H^2}}$$

```terms
nc:
  label: '$N_c$, the number of colours'
  what: 3 for a quark and 1 for a lepton. A quark can have any of three colours, and each is a separate final state.
  why: It is a counting factor. It triples the rate into any quark pair, relative to a lepton of the same mass.
  effect: It is why bb̄ (a quark) is more than three times as frequent as ττ would be for the same mass.
gf:
  label: '$G_F$, the Fermi constant'
  what: The strength of the weak interaction at low energy, 1.1664 × 10⁻⁵ GeV⁻². It is 1/(√2 v²).
  why: |
    It carries the scale v of the Higgs field: the coupling of the Higgs boson to a fermion is $m_f$/v, and the square of that coupling is $m_f^2$ $G_F$ √2.
  effect: A fixed constant. It sets the overall size of every width in the Higgs sector.
mh:
  label: '$m_H$, the Higgs boson mass'
  what: 125.2 GeV. It sets how much energy there is to share between the two decay products.
  why: A decay width grows with the energy available. A heavier Higgs boson would decay faster.
  effect: Raising $m_H$ raises every width, and the total width rises very steeply once the WW and ZZ channels open fully near 160 GeV.
mf:
  label: '$m_f$, the fermion mass'
  what: The mass of the fermion in the final state.
  why: The coupling to the Higgs is proportional to it, and the width is proportional to the coupling squared.
  effect: Doubling the mass quadruples the width. The tau, at 1.78 GeV, is 17 times heavier than the muon, and H → ττ is 280 times more frequent than H → μμ.
beta:
  label: 'β, the velocity of the decay products'
  what: The velocity of each fermion in the Higgs boson's rest frame, as a fraction of the speed of light. It is close to 1 for any fermion much lighter than $m_H$/2.
  why: The factor β³ is the phase-space suppression, which switches the decay off as $m_f$ approaches $m_H$/2.
  effect: For the bottom quark, β = 0.99. For the top quark (172.6 GeV), 2m_t exceeds $m_H$ and the decay H → tt̄ is forbidden.
```
:::

```predict
q: 'The W boson (80 GeV) is nineteen times heavier than the bottom quark (4.2 GeV), and the Higgs boson couples to mass. Which of H → bb̄ and H → WW* is more frequent at a Higgs mass of 125 GeV?'
options:
  - text: H → WW*, because the W is far heavier and so couples much more strongly.
    why: 'The coupling is indeed larger, by a lot. But 125 GeV is less than 2 × 80 GeV: the Higgs boson does not have enough energy to make two real W bosons, and one of them must be off the mass shell, which costs a large suppression.'
  - text: H → bb̄, even though the coupling is much weaker.
    correct: true
    why: 'H → bb̄ happens 58 % of the time and H → WW* 21 %. The W pair is threshold-suppressed, because the Higgs boson is lighter than two W masses. The b quarks have three colours and an almost free phase space. At 160 GeV, where two real W bosons can be made, the situation reverses and WW dominates (try the figure).'
  - text: They are about the same.
    why: 'They are not. The numbers are 58 % and 21 % at 125 GeV. The mass dependence of the figure is what makes the decay pattern so different at different Higgs masses.'
```

::higgs-branching{n="30.1" caption="The branching fractions of the Higgs boson against its mass, from the library's leading-order widths (hep/sm). At the measured mass the largest is bb̄, then WW*, gg, ττ, cc̄, ZZ*, γγ and μμ. Drag the mass: below about 135 GeV the bottom channel dominates, near 160 GeV the W pair opens and takes over. The table beside the plot compares this calculation with the course's particle table at 125.2 GeV."}

At 125.2 GeV the library's leading-order calculation gives these shares. The differences from the particle table, which comes from calculations at higher order in the strong force and from the Working Group's reviewed values, are the corrections that the leading-order formula omits.

| Channel | This course's LO calculation | Particle table | Observed |
|---|---|---|---|
| H → bb̄ | 60.2 % | 58.2 % | 2018 (ATLAS and CMS):cite[atlashbb2018,cmshbb2018] |
| H → WW* | 21.6 % | 21.4 % | 2012 |
| H → gg | 4.9 % | 8.2 % | not seen as a decay (the coupling is seen in production) |
| H → ττ | 7.0 % | 6.3 % | Run 1 combination:cite[atlascms2016] |
| H → cc̄ | 3.6 % | 2.9 % | not yet |
| H → ZZ* | 2.35 % | 2.62 % | 2012 |
| H → γγ | 0.25 % | 0.23 % | 2012 |
| H → μμ | 0.025 % | 0.022 % | evidence only |

The gg row is the one that differs most. H → gg goes through the top-quark loop with the strong coupling, and the corrections from the strong force are large (for the closely related production cross-section the full prediction is about three times the leading-order one, Chapter 29), so the comparison for that row says little about the physics. Elsewhere the agreement is at the level of 10 to 25 %, which is what leading order can do. A check that needs no calculation is the ratio of the two lepton rates. Both decays have the same colour factor and nearly the same phase space, so the ratio of branching fractions is the ratio of masses squared: $(m_\tau/m_\mu)^2 = (1.777/0.1057)^2 = 283$. The table's values give $0.0627/0.00022 = 285$.

The total width, the sum of all the partial widths, is 3.7 MeV at LO in the library and 4.1 MeV in the table. Using $\tau = \hbar/\Gamma$, that is a lifetime of about $1.6\times10^{-22}$ s, six hundred times longer than the Z boson's, but still too short for the Higgs boson to leave any trace of its flight in a detector. A width of 4 MeV is hundreds of times smaller than the detector's resolution on the mass, about 1 to 2 GeV, so the width of the observed peak is the experimental resolution and cannot be read off it. The width must be inferred from more indirect measurements.

```numeric
id: mumu-from-tautau
title: Predict H → μμ from H → ττ
prompt: 'The branching fraction of H → ττ is 6.27 %. Using the rule that the coupling is proportional to mass (and ignoring the small phase-space and colour differences, which are the same for the two), predict the branching fraction of H → μμ, as a percentage. The masses are mτ = 1.777 GeV and mμ = 0.1057 GeV.'
answer: 0.0222
unit: '%'
tolerance: 0.03
hints:
  - 'The partial widths are in the ratio of the masses squared: Γ(μμ)/Γ(ττ) = (mμ/mτ)².'
explain: 'BR(μμ) = 6.27 % × (0.1057/1.777)² = 6.27 % × 3.54 × 10⁻³ = 0.0222 %. The particle table gives 0.022 %. The measurement of this decay is hard: one Higgs boson in 4,500 decays to two muons, and the muon pairs from the Z boson and from the continuum are a vast background (the hump and peaks of Chapter 2). CMS reported evidence for it from Run 2,:cite[cmshmumu2021] which is why the figure of couplings below has a ring for the muon.'
```

## Is it spin 0?

The Higgs boson of Chapter 26 has no spin. Its field has a single value at each point, with no direction. What does the data say about the spin of the particle at 125 GeV, and about its parity (the behaviour under reflection in a mirror, Chapter 22)?

The first piece of evidence comes from a decay and needs no further measurement. In 1948 Landau and, independently, Yang showed that a particle of spin 1 cannot decay to two photons.:cite[landau1948,yang1950] The Higgs candidate decays to two photons, so it is not spin 1. That leaves 0, 2, and higher.

The rest comes from angles. A spin-0 particle has no preferred direction, and so its decay products come out isotropically in its rest frame (for a decay into two photons, a flat distribution in the cosine of the angle between a photon and the beam direction, measured in the Higgs boson's rest frame). A spin-2 particle can have a different distribution of the same angle. When the particle decays into two Z bosons which each decay into two leptons, there are more angles: the angle between the two Z decay planes, and the angles of the leptons in the Z rest frames. These depend on the spin and, for a spin-0 particle, on its parity: a scalar ($0^+$) and a pseudoscalar ($0^-$) give different distributions of the angle between the two decay planes, even though both have spin 0. The experiments compared the observed distributions of these angles, and of the masses of the two Z bosons, with those predicted for the alternatives. The conclusion in both ATLAS and CMS was that the data are consistent with a scalar of spin 0 and positive parity, and that the alternatives tested (a pseudoscalar, spin 1, and spin 2 with several kinds of coupling) are disfavoured by the data.:cite[atlasspin2015,cmsspin2015] The wording matters. The alternatives that have been tested are rejected at high confidence; a small admixture of something other than the pure scalar coupling, at the level of tens of per cent in the coupling to the Z, has not been excluded, and the limits improve with each data set.

The simulated Higgs events of the course's generator use the angular correlations of a scalar, derived from the vector-boson couplings (Chapter 29 described that stage, `hep/gen`), so that the four-lepton events in the course's simulation have the distributions that this test is about.

```quiz
q: 'Which observation alone excludes that the particle at 125 GeV has spin 1?'
options:
  - text: Its decay to two photons, by the Landau–Yang theorem.
    correct: true
    why: 'A spin-1 particle cannot decay to two photons, whatever its mass. The observation of the H → γγ peak is therefore enough. The remaining possibilities (spin 0, 2, …) need angular distributions.'
  - text: Its production in gluon fusion.
    why: 'Production through gluons does not settle the spin: the process is also allowed for spin 0 and spin 2. The decay to two photons is what excludes spin 1.'
  - text: Its mass of 125 GeV.
    why: 'The mass says nothing about the spin. Particles of all spins have masses over a wide range.'
```

## Couplings in proportion to mass

The central prediction is the one of Chapter 26: the coupling of the Higgs boson to each massive particle is in proportion to its mass. For a fermion, $y_f = \sqrt2\,m_f/v$; for the W and Z, the coupling is proportional to $m_V^2/v$. The measurements cannot be of the couplings directly. They are of **rates**: the number of Higgs bosons produced and seen to decay in a given way, divided by the Standard Model's prediction. This ratio is the :term[signal strength]{id=signal-strength} $\mu$. A rate depends on the couplings both at production and at decay, and so a measurement of $\mu$ in a given channel is a measurement of a product of couplings squared divided by the total width. The usual way to put it all together is the :term[kappa framework]{id=kappa-framework}: each coupling is multiplied by a modifier $\kappa$, with $\kappa=1$ being the Standard Model, and the data are fitted for the $\kappa$'s.:cite[atlascms2016]

A convenient way to display the result is the straight line of the figure. Plot, on logarithmic axes, the quantity $\kappa_f m_f/v$ for each fermion and $\sqrt{\kappa_V}\,m_V/v$ for each boson, against the mass of the particle. In the Standard Model all of them lie on the line $y = m/v$ with a slope of 1. The line crosses nearly four orders of magnitude in mass, from the muon (0.1057 GeV) to the top quark (172.6 GeV). It is built here from the library's masses and from $v$ of Chapter 26. The figure shows the prediction, and the status of each particle, for the following reason.

::coupling-line{n="30.2" caption="The Standard Model's prediction for the coupling of the Higgs boson to each particle, against the particle's mass, on logarithmic axes: a straight line of slope 1. The markers say how far each coupling has been tested: filled for an observed decay or production process, ringed for evidence, open diamonds for particles whose coupling has not been measured. The figure does not draw measured values. ATLAS and CMS publish them in a plot of the same form, with error bars, in two papers of 2022 listed below. The slider tilts the line, y ∝ m^(1+ε), to show what a departure from proportionality to the mass would look like."}

The measured coupling strengths are not drawn on the figure, because their values come from the combinations of the two experiments and cannot be reproduced here faithfully. The place to look is the pair of papers in which ATLAS and CMS each summarised ten years of Higgs measurements.:cite[atlasnature2022,cmsnature2022] Their figure of couplings against mass is of this form. Three things can be said in words. The couplings that have been measured, to the W, the Z, the top quark, the bottom quark and the tau lepton, are consistent with the line within their uncertainties, which for the best-measured ones are at the level of ten per cent or better. The coupling to the muon has been seen with a lower significance and is also consistent with the line. And the couplings to the lightest fermions, the electron and the first-generation quarks, have not been measured at all: the electron's coupling would give $\mathrm{BR}(H\to e^+e^-) \approx 5\times10^{-9}$, too small to find.

That the particles of three generations, the weak bosons and a decay that goes through a loop with the top quark all agree on one line over four decades is a strong test of the idea of Chapter 26. If the mass of the electron had some other origin than the Higgs field, there would be no reason for its coupling to follow the line. The slider shows how much a deviation would show: an exponent of 1.1 instead of 1 puts the muon off the line by a factor of $(0.1057/125)^{0.1} = 0.5$.

:::programmer
A **signal strength** is a ratio of an observed rate to an expected one, and the κ framework is a regression test with parameters: every coupling is multiplied by a modifier whose expected value is 1, and a measured κ that differs from 1 by more than its uncertainty is a failing test that says exactly which feature of the model is wrong. Compare a unit test for each of the predictions of Chapter 26, rather than one test that the code runs. The straight-line figure is a test report in which each particle is one assertion. The tests that have not yet been run (the electron, the light quarks) are shown as skipped, not as passed.
:::

:::hood[The partial widths in the library]
`higgsWidths(mH)` in `hep/sm` computes the leading-order partial widths from the equation above and from the standard formulae for the loop-induced decays. The fermion case is a few lines (the Fermi constant, the colour factor and the factor β³ come straight from the equation):

```ts
const fermionW = (m: number, Nc: number) => {
  const beta = Math.sqrt(Math.max(0, 1 - (4 * m * m) / (mH * mH)));
  return (Nc * G_F * mH * m * m * beta ** 3) / (4 * Math.SQRT2 * Math.PI);
};
const bb = fermionW(runningMass(5, mH), 3);
```

Note `runningMass(5, mH)`: the quark mass in the formula is not the 4.18 GeV of the particle table but the **running mass** at the scale of the Higgs mass, about 3.0 GeV. A quark mass depends on the energy scale at which it is probed, because of the strong force (Chapter 18), and using the mass at the scale of the decay rather than the table's is the largest correction to the bb̄ width. The same applies to the charm quark. The decays to γγ and gg go through loops of the top quark, the bottom quark, the tau and, for photons, the W, and the library computes the loop functions. The test `src/lib/sims/part7/higgs-facts.test.ts` compares the branching fractions with the particle table, within the 10 to 25 per cent that leading order allows (and records that H → gg is off by a larger factor).
:::

:::experiments
ATLAS and CMS publish the Higgs couplings in the form of the κ framework and, increasingly, in the form of **simplified template cross-sections**: Higgs production is divided into regions of the kinematics of the Higgs boson and of the particles produced with it, and the rate in each region is measured, so that the result does not depend on one particular theory.:cite[lhchxswg2017] The combination of the two experiments' Run 1 data fitted both experiments' measurements together, with a common statistical treatment of the nuisance parameters that they share (Chapter 28).:cite[atlascms2016] The tools are the profile-likelihood machinery of Chapter 28 with several hundreds of nuisance parameters; the plot of couplings against mass is a visualisation of the result of that fit.
:::

## The self-coupling and the shape of the potential

Everything so far tests the Higgs field's coupling to other particles. The mechanism of Chapter 26 has another consequence that is, so far, untested: the shape of the potential itself. Expanding the potential around the vacuum, as in Chapter 26, gives

:::equation{#selfc caption="The Higgs potential expanded around the vacuum. The cubic and quartic terms are the Higgs boson's interactions with itself, and the Standard Model fixes them from the mass and v."}
$$V(h) = \tfrac12\,\term{mh2}{m_H^2}\,h^2 + \term{kl}{\kappa_\lambda}\,\lambda v\,h^3 + \tfrac14\,\lambda\,h^4, \qquad \lambda = \frac{m_H^2}{2v^2},\quad \kappa_\lambda = 1\ \text{in the Standard Model}$$

```terms
mh2:
  label: '$m_H^2$, the Higgs mass squared'
  what: The curvature of the potential at the vacuum. The first term is the Higgs boson's mass term.
  why: It is measured, from the peak. 125.2 GeV.
  effect: It also fixes the other two terms through $\lambda = m_H^2/(2v^2)$, if the Standard Model's potential is right.
kl:
  label: '$\kappa_\lambda$, the trilinear modifier'
  what: The ratio of the Higgs boson's coupling to itself (the h³ term) to the Standard Model's value. It is 1 if the potential is the Standard Model's.
  why: It is the one parameter that measures the shape of the potential near the minimum. A different shape (a different dynamics behind electroweak symmetry breaking) shows up as $\kappa_\lambda \ne 1$.
  effect: At $\kappa_\lambda = 1$ the trilinear coupling is $3m_H^2/v$ = 191 GeV.
```
:::

The trilinear term can be measured only through a process in which a Higgs boson splits into two, or two are made at once. The signature is **di-Higgs production**, in which a collision makes two Higgs bosons. There are two main diagrams. In one a virtual Higgs boson, made through the top-quark loop of gluon fusion, splits into two through the trilinear coupling. In the other, the two Higgs bosons are radiated directly from the top-quark loop. The two **interfere destructively** in the Standard Model, so the cross-section, of the order of 30 fb at the LHC's energy, is a thousand and more times smaller than that of a single Higgs boson, and its dependence on $\kappa_\lambda$ is not a simple one.:cite[lhchxswg2017] The result of the searches so far is that the self-coupling is not measured: the data set limits on $\kappa_\lambda$ that are several units wide and include the Standard Model value. The projection for the High-Luminosity LHC (below) is of a measurement, at the level of a few tens of per cent, if the data are combined.:cite[hllhc2019]

::potential-slice{n="30.3" slider=true caption="The Higgs potential along the real direction, with the trilinear coupling scaled by κλ. At κλ = 1 (the Standard Model) the valley on the left is a mirror image of the vacuum. Slide κλ and the shape changes, in the range of values that the present limits have not yet excluded. A measurement of the trilinear coupling fixes the third derivative of the potential at the vacuum, and nothing else: the shape far from h = 0 is an extrapolation, not a measurement."}

```fermi
id: hh-count
title: Pairs of Higgs bosons at the High-Luminosity LHC
prompt: 'The Standard Model cross-section for making two Higgs bosons is about 30 fb at 13–14 TeV. The High-Luminosity LHC plans to deliver about 3,000 fb⁻¹ to each of ATLAS and CMS. How many Higgs pairs are made in each experiment? (Before any decay, trigger or selection.)'
answer: 9.0e4
unit: pairs
factor: 3
hints:
  - N = σ × L_int, with both in the same units (fb and fb⁻¹).
explain: 'N = 30 fb × 3,000 fb⁻¹ = 9 × 10⁴ pairs. The decays that can be seen are rare: the favoured combination of H → bb̄ (58 %) with H → γγ (0.23 %), in either order, is 2 × 0.58 × 0.0023 = 0.27 % of the pairs, about 240 events before the detector efficiency. That is why the analysis is very hard, and why it takes the whole of the High-Luminosity LHC and both experiments to measure the self-coupling at a precision of tens of per cent.'
```

## The future of the vacuum

The Higgs field sits in the vacuum where the potential is lowest, as far as is known. Is that the lowest point of the potential, over all values of the field, including the ones that are very large? This is a question about the whole shape of the potential, and it can be asked with the measured masses. The self-coupling $\lambda$ is not a constant. Like the electromagnetic coupling (Chapter 16), it runs with the energy scale. At high energy the loops of the top quark, which couples strongly to the Higgs field, push $\lambda$ down, and the loops of the W and Z push it up. Which wins depends on the masses of the Higgs boson and of the top quark. For the measured values $\lambda$ is found to decrease with energy and to cross zero at an enormous energy; above it the potential at large field values turns over and falls, and the vacuum we live in would not be the lowest state of the field. It would be :term[metastable]{id=metastable-vacuum}: stable on any time scale of interest, because the transition to the lower state needs a very improbable fluctuation, but not absolutely stable.:cite[degrassi2012,buttazzo2013]

The careful calculations that reach this conclusion work to two loops and beyond, and the scale at which $\lambda$ crosses zero is of order $10^{10}$ GeV, within an order of magnitude or so, with the largest uncertainty coming from the measured mass of the top quark.:cite[buttazzo2013] The conclusion is hedged for a reason: the result depends on the extrapolation of the Standard Model over many orders of magnitude of energy, which assumes that nothing new appears. New particles, if they exist, would change the running. What the calculation shows is that the measured values of the Higgs and top masses put the Standard Model close to the boundary between stable and metastable, which is a curiosity that nobody has explained.

The figure runs the equations at one loop with rounded inputs. It is a toy and gets the crossing scale a factor of ten or so too low, but it shows the effect, and above all it shows how the answer moves with the top-quark mass.

::vacuum-running{n="30.4" caption="A one-loop toy of the running of the Higgs self-coupling λ with the energy scale (Chapter 30 explains the equations). With the measured top mass λ falls through zero at about 10⁹ GeV in this toy (the careful calculations find about 10¹⁰). Drag the top mass: a light top keeps λ positive up to the Planck mass, a heavy one pulls the crossing down by orders of magnitude."}

## The High-Luminosity LHC

All of this is waiting for more data. The **High-Luminosity LHC** (HL-LHC) is an upgrade of the machine and the experiments, with a design that aims at about 3,000 fb⁻¹ of data for each of ATLAS and CMS, about twenty times as much as Run 2, with a planned start of operation around 2030.:cite[hllhc2020] The beams would be squeezed tighter at the collision points, with the magnets and the focusing of Chapters 20 and 21, and the detectors replaced in part, since the number of collisions in one crossing rises to well over a hundred (Chapter 21). The experiments' projections for the Higgs programme are of couplings to the W, Z, top, bottom, tau and muon at the level of a few per cent, of the Zγ decay and of rarer ones, and of the first measurement of the self-coupling through di-Higgs production.:cite[hllhc2019] The projections are not measurements, and they depend on assumptions about systematic uncertainties that Chapter 28 warned about. What a different machine could add is a separate question: collisions of electrons and positrons at about 240 GeV make a Higgs boson together with a Z, and the energy and momentum of the Z fix the mass of whatever recoils against it, so the Higgs bosons can be counted without looking at how they decay, which gives a model-independent measurement of the couplings. Chapter 32 returns to such machines.

:::history{year=2013 title="The Nobel Prize for the mechanism" people="François Englert, Peter Higgs" source="Source: The Nobel Prize in Physics 2013, press release."}
On 8 October 2013 the Royal Swedish Academy of Sciences announced that the Nobel Prize in Physics 2013 was awarded jointly to François Englert and Peter W. Higgs, for the theoretical discovery of a mechanism that contributes to our understanding of the origin of mass of subatomic particles, and which was confirmed by the discovery of the predicted particle by the ATLAS and CMS experiments at the LHC.:cite[nobel2013] A Nobel Prize goes to at most three people, so the experimental collaborations, which number thousands, could not share it. Robert Brout, the co-author of Englert's 1964 paper (Chapter 26), had died in 2011. The citation names the mechanism and the confirmation of the particle: the first part is the work of the 1964 papers, the second the work of the thousands of people of the two experiments and the accelerator.
:::

:::history{year=2018 title="The b quark and the top quark, seen to couple" people="The ATLAS and CMS collaborations" source="Sources: ATLAS (2018) Phys. Lett. B 786, 59; CMS (2018) Phys. Rev. Lett. 121, 121801; CMS (2018) Phys. Rev. Lett. 120, 231801; ATLAS (2018) Phys. Lett. B 784, 173."}
Two of the most important tests of the line of couplings had to wait until 2018. The Higgs boson decays to a pair of b quarks more often than to anything else, but the decay is buried: pairs of b-jets are made in great numbers by QCD (Chapter 18), and the decay can be seen only in the rarer events in which the Higgs boson is produced together with a W or a Z that decays to leptons. In August 2018 ATLAS and CMS each reported the observation of H → bb̄, at 5.4σ and 5.6σ respectively.:cite[atlashbb2018,cmshbb2018] Earlier that year the production of a Higgs boson together with a top-quark pair, ttH, had been observed by CMS at 5.2σ and by ATLAS at 6.3σ.:cite[cmstth2018,atlastth2018] The first established the Higgs boson's coupling to the heaviest quark that it can decay into, and the second its coupling to the top quark, which is the largest coupling of all and cannot be tested in a decay, because the Higgs boson is lighter than two top quarks. Both are on the filled markers of the figure.
:::

## What comes next

The Higgs boson completes the Standard Model: every particle of the list of Chapters 9 to 26 has been found, and the mechanism that gives the W, the Z and the fermions their masses has a particle, with the predicted spin, parity and couplings, within the accuracy so far reached. The rest of the course is about what the Standard Model does not contain. [Chapter 31](/chapters/neutrinos/) turns to the neutrinos, which have masses that the version of the Higgs mechanism in this chapter does not give them; [Chapter 32](/chapters/beyond-the-standard-model/) to dark matter, the asymmetry between matter and antimatter, and the questions that the Higgs field itself raises, such as why its mass is so much lighter than the Planck scale; and [Chapter 33](/chapters/particle-physics-in-the-world/) to what particle physics has given to the rest of the world.

## Further reading

- The two summaries of ten years of Higgs physics: ATLAS and CMS, both in *Nature* (:cite[atlasnature2022,cmsnature2022]).
- The Run 1 combination of ATLAS and CMS couplings, the first in which both experiments' data are fitted together (:cite[atlascms2016]).
- On vacuum stability: Degrassi et al., and Buttazzo et al. (:cite[degrassi2012,buttazzo2013]).
- The HL-LHC Technical Design Report, and the Higgs section of the Yellow Report on the HL-LHC physics case (:cite[hllhc2020,hllhc2019]).
- The Nobel Prize press release (:cite[nobel2013]).
