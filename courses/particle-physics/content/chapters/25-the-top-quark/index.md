---
number: 25
title: The top quark
summary: The sixth quark is as heavy as an atom of rhenium. Its mass was estimated from its effects on the Z and the W before anyone had made one, it was found at Fermilab in 1995, and it decays so fast that it never forms a hadron. Reconstructing a pair of them from jets is a puzzle in combinatorics.
duration: About 2½ hours
prerequisites: [flavour, w-and-z, reconstruction]
---

The top quark has a mass of 172.57 GeV. An atom of rhenium, element 75, has a mass of 186.2 atomic mass units, which is 173.5 GeV: a single point-like quark weighs about as much as an atom of 75 electrons, 75 protons and the neutrons that go with them. It is the heaviest elementary particle known, 40 times heavier than the b quark of the same generation (Chapter 24) and more than 3 × 10⁵ times heavier than the electron.

A top quark's life lasts $5\times10^{-25}$ s. It is made, decays, and is gone before it could have travelled a sixth of the radius of a proton, even at the speed of light. This chapter tells how a particle that was never seen in a track was first estimated from its effects on other particles, then found; why its short life is not a technicality but changes what kind of particle it is; and how to put the pieces of a top quark pair back together from the jets and the missing momentum that a detector records.

## Why there had to be a top quark

When the bottom quark was found in 1977 (Chapter 24), the third generation was one member short. The up-type partner of the b, with charge +⅔, was missing, and the theory wants generations complete. In the electroweak theory the left-handed b quark and its partner form a doublet, as the u and d do; the Z's couplings to the b quark, which LEP measured, show that the left-handed b has the weak isospin −½ of the lower member of a doublet, and a lower member needs an upper one.:cite[lepewwg2006] The charges within a generation must also add up in a particular way for the theory to be consistent (Chapter 26 returns to this).

The question was the mass. The b is 4.18 GeV and the c 1.27 GeV: a top of 10 or 20 GeV looked natural, and it would have been in reach of the electron–positron colliders of the 1980s. Machines went up in energy, PETRA at DESY in Hamburg to 46.8 GeV and TRISTAN at KEK in Japan to above 60 GeV, and found nothing. Then the proton–antiproton collider at CERN and LEP excluded one range after another.:cite[campagnari1997] The top was much heavier than expected.

## A particle weighed before it was seen

The mass came first from its virtual effects. Chapter 23 predicted the W and Z masses from three numbers ($G_F$, $\alpha$ and $\sin^2\theta_W$) at tree level and said that corrections of a few per cent were not included. One of them is a loop in which the Z or the W turns for a moment into a pair of quarks, one of them a top, and back. The loop changes the **ρ parameter**, which measures the relative strength of the neutral and the charged weak currents, by

$$\Delta\rho = \frac{3\,G_F\,m_t^2}{8\sqrt2\,\pi^2},$$

the leading term. It grows as the **square** of the top mass. For $m_t = 172.6$ GeV, $\Delta\rho = 0.0093$, a correction of 0.9 %. At fixed $\alpha$, $G_F$ and $m_Z$ it raises the predicted W mass by about 0.5 GeV (the leading term), two-thirds of a per cent, which is large next to the precision of the Z mass (two parts in 10⁵) and, later, of the W mass. A loop of virtual particles that are too heavy to be produced still changes what can be measured, by an amount that grows with their mass.

::rho-parameter{n="25.1" caption="The top quark's contribution to the ρ parameter, Δρ = 3 G_F m_t²/(8√2π²), and the shift it causes in the predicted W mass (leading terms, on-shell definitions), against the top-quark mass. The curve is a parabola: doubling the mass quadruples the effect. The shaded band is the range from which the indirect determinations of the early 1990s pointed (about 170 GeV, with an uncertainty of the order of 20 GeV, which depended on the assumed mass of the Higgs boson), marked as approximate. The Higgs boson enters the corrections only logarithmically, so it is much more weakly constrained than the top."}

The idea was old. The loop's quadratic dependence on a mass that nobody could measure was one of the reasons for building high-precision machines. In the early 1990s the four LEP experiments had measured the Z's mass, its width, its partial widths and its asymmetries, and the SLD experiment at Stanford the left–right asymmetry, to a few parts in a thousand. Interpreted within the Standard Model, with the top mass as a free parameter, they preferred a value of about 170 GeV, with an uncertainty of around 20 GeV, which depended on the Higgs-boson mass assumed.:cite[campagnari1997] That was a prediction in a limited sense: it assumed that the Standard Model is correct, and was made in a model with another unknown, the Higgs mass. It was also a consistency check on the theory. If the direct mass had come out at 60 GeV or at 300 GeV, there would have been a conflict between the theory and the measurements.

:::history{year=1994 title="A mass from loops, before the particle" people="The LEP and SLD collaborations and the LEP Electroweak Working Group" source="Sources: LEP Electroweak Working Group (2006); Campagnari and Franklin (1997)."}
The LEP Electroweak Working Group combines the measurements of the four LEP experiments, and, with SLD, the results of the Z-pole programme. Its fits to the Z-pole data in 1993 and 1994 used the Standard Model to estimate the top mass from the corrections the top quark makes to the Z's properties: the combination of the Z lineshape, the asymmetries and the partial widths, in which the top enters through $\Delta\rho$ and a related correction to the $Zb\bar b$ coupling. The central value was around 170 GeV, with an uncertainty of the order of 20 GeV.:cite[campagnari1997,lepewwg2006]

An earlier hint was the oscillation of $B^0$ mesons, which ARGUS saw in 1987 and which depends on the top quark's mass through a loop (Chapter 24): it was faster than a light top would have given, which pointed to a heavy one.:cite[albrecht1987] The masses found by direct production a year later, 176 GeV and 199 GeV in the two experiments, agreed within their uncertainties with the fits.:cite[cdf1995,d01995] The agreement was an early confirmation that the loop corrections of the Standard Model are what the Z-pole data respond to.
:::

## The discovery

To make a top quark pair one needs a collision with at least $2m_t \approx 345$ GeV available to the quarks that collide. The proton–antiproton collisions of the **Tevatron**, the 6.3 km ring at **Fermilab** (Fermi National Accelerator Laboratory, near Chicago) which collided protons and antiprotons at a total energy of 1.8 TeV in the years 1992 to 1996, were the only ones that could do it. The two detectors were **CDF**, the Collider Detector at Fermilab, and **D0** (pronounced "D-zero", named after the point of the ring where it stood).

At the Tevatron most top pairs come from the annihilation of a quark and an antiquark. At the LHC most come from the fusion of two gluons.

::feynman{process="g g > t t~" index=0 n="25.2" caption="One of the diagrams for the production of a top–antitop pair at the LHC: two gluons, one from each proton, merge into a single virtual gluon, which turns into a top quark and an antitop quark. (Other diagrams, in which the two gluons exchange a top quark, contribute as well.) In the course's leading-order generator, 84 % of the pairs at 13 TeV come from gluon fusion; at the Tevatron's energy of 1.96 TeV, 95 % come from the annihilation of a quark and an antiquark (the generator's figures, not measured ones)."}

The top does not live long enough to be seen as a track. It decays by the weak force, almost always (99.8 % of the time, $|V_{tb}|^2 = 0.998$) to a W boson and a b quark. What the detectors see is the decay of the W and a jet of the b quark. A top quark pair therefore gives two W bosons and two b-jets, and the W's give the channels:

| Decay of the two W bosons | Fraction | What the detector sees |
|---|---|---|
| Both to quarks | 45 % | Six jets, two of them from b quarks. No lepton |
| One to a lepton (e or μ) and a neutrino, one to quarks | 29 % | One lepton, missing momentum, four jets, two of them b jets. The **lepton + jets** channel |
| Both to a lepton and a neutrino | 4.5 % | Two leptons, missing momentum, two b jets |

The fractions are those of the course's generator, from the W branching fractions in the particle table, and leave out the tau lepton (which decays to an electron or a muon with neutrinos or to hadrons, and is harder). Each W decays to a lepton pair 21 % of the time and to quarks 67 %. The lepton + jets channel is a favourite for mass measurements: it is a decent fraction of all the pairs, and a lepton of high transverse momentum is easy to identify and to trigger on (Chapter 27), where six jets are not. One of the W's is fully reconstructable from the two jets, and the other has a neutrino whose transverse momentum is the missing momentum of Chapter 23.

:::history{year=1995 title="Two experiments, one announcement" people="The CDF and D0 collaborations" source="Sources: Abe et al. (CDF, 1995); Abachi et al. (D0, 1995); Campagnari and Franklin (1997)."}
On 2 March 1995 the CDF and D0 collaborations announced, at Fermilab, that they had observed the top quark. Each published in *Physical Review Letters* with consecutive papers. CDF, with 67 inverse picobarns of data, found a signal that was inconsistent with the background by 4.8 standard deviations and measured a mass of $176\pm8\pm10$ GeV (statistical, then systematic uncertainty).:cite[cdf1995] D0 found 4.6 standard deviations and $199^{+19}_{-21}\pm22$ GeV.:cite[d01995] The two experiments had been looking for the same thing for years, and CDF had reported evidence, short of a discovery, in 1994.:cite[campagnari1997]

The channels used included events with a lepton and jets in which at least one jet was tagged as a b jet by a displaced vertex, the method of Chapter 24, and events with two leptons. The mass today, from the combination of direct measurements at the Tevatron and the LHC, is $172.57\pm0.29$ GeV.:cite[pdg2024] The two early values and the indirect value from the Z-pole fits were within 1.5 uncertainties of it.
:::

## Too heavy to hadronise

The top quark's weak decay is $t \to W b$. The calculation is the one that gave the muon's lifetime in Chapter 22, with the muon replaced by the top and a final state of a massive W and a b quark:

:::equation{#top-width caption="The decay width of the top quark into a W boson and a b quark, at leading order."}
$$\term{Gt}{\Gamma_t} = \frac{\term{GF}{G_F}\,\term{mt}{m_t}^3}{8\pi\sqrt2}\,\term{Vtb}{|V_{tb}|^2}\left(1-\term{r}{r}\right)^2\left(1+2r\right),\qquad r = \frac{m_W^2}{m_t^2}$$

```terms
Gt:
  label: 'Γ_t, the top-quark width'
  what: The decay rate of the top quark in GeV. At leading order, 1.48 GeV; with the first correction from the strong force, 1.34 GeV; the particle table gives 1.42 GeV.
  why: 'The lifetime is ħ/Γ, so the width tells how long a top quark lives: 4.6 × 10⁻²⁵ s for 1.42 GeV.'
  effect: It is about two-thirds of the W's total width (2.1 GeV) and seven times the energy scale of the strong force, Λ_QCD, which is the reason the top quark does not hadronise.
GF:
  label: 'G_F, Fermi’s constant'
  what: 1.1664 × 10⁻⁵ GeV⁻², from the muon lifetime (Chapter 22).
  why: The same constant governs every weak decay, including this one.
  effect: A rate goes as G_F².
mt:
  label: 'm_t, the top-quark mass'
  what: 172.57 GeV.
  why: 'The width goes as the cube of the mass, not the fifth power of the muon''s decay, because the W is produced on shell: this is a two-body decay. A top quark lives about 5 × 10¹⁸ times less long than a muon.'
  effect: 'The heavier the top, the shorter its life: Figure 25.3 lets you move it.'
Vtb:
  label: '|V_tb|², the CKM element'
  what: The square of the matrix element that couples t to b, 0.998. Almost 1.
  why: The top decays almost always to a b quark, since |V_ts|² and |V_td|² are 0.0017 and 0.00007.
  effect: A top quark that decays to a b quark and a W carries away its b quark as a b jet, which is why b-tagging works (Chapter 24).
r:
  label: 'r = m_W²/m_t², the phase-space factor'
  what: 0.217 for the real masses. The factor (1 − r)²(1 + 2r) = 0.880 is the suppression from the W's mass.
  why: 'The W is a heavy final state: 80 of the 172 GeV go to its mass.'
  effect: If the top were lighter than m_W + m_b, the decay would be forbidden.
```
:::

The result is a width of about 1.4 GeV, and a lifetime $\tau_t = \hbar/\Gamma_t = 6.58\times10^{-25}\ \text{GeV s}/1.42\ \text{GeV} = 4.6\times10^{-25}$ s.

Compare the time it takes the strong force to build hadrons. A free quark cannot exist alone (Chapter 18): when it is made, its colour field stretches, and within a time of the order of $\hbar/\Lambda_\text{QCD}$ the string breaks and the quark is dressed with antiquarks and quarks into hadrons. With $\Lambda_\text{QCD}\approx0.2$ GeV that is $6.58\times10^{-25}/0.2 = 3.3\times10^{-24}$ s.

```numeric
id: top-lifetime
title: The lifetime of the top quark, and the hadronisation time
prompt: 'The top quark has a width of 1.42 GeV. Compute its mean lifetime τ = ħ/Γ in units of 10⁻²⁵ s (ħ = 6.582 × 10⁻²⁵ GeV·s). Then compare it with the hadronisation time ħ/Λ_QCD for Λ_QCD = 0.2 GeV.'
answer: 4.635
unit: × 10⁻²⁵ s
tolerance: 0.01
hints:
  - 'τ = ħ/Γ = 6.582 × 10⁻²⁵ / 1.42.'
  - 'The hadronisation time is 6.582 × 10⁻²⁵ / 0.2 = 3.3 × 10⁻²⁴ s: seven times longer.'
explain: 'τ = 4.635 × 10⁻²⁵ s. The hadronisation time, 3.29 × 10⁻²⁴ s, is 7.1 times longer: the ratio is just Γ_t/Λ_QCD. The top quark decays seven times faster than the strong force can dress it. In that time, even at the speed of light it would travel cτ = 0.14 fm, a sixth of a proton radius.'
```

::time-scales{n="25.3" caption="Time scales on a logarithmic axis. The top quark lives for about 4.5 × 10⁻²⁵ s, shorter than the 3 × 10⁻²⁴ s it takes the strong force to dress a quark into hadrons (move Λ_QCD to see how robust the conclusion is), and about as long as the W and the Z. Move the top mass: at leading order the width grows roughly as the cube of the mass, so a top quark of 100 GeV would live about sixteen times longer. The b quark decays weakly in 10⁻¹² s, a million million times more slowly than the strong force acts, so it always hadronises and is found in B mesons; the c quark and the τ behave the same way. The top is the only quark that decays before it hadronises."}

The consequence is that there are **no top hadrons**. No $t\bar u$ meson and no $tud$ baryon. The top quark is the only quark that can be studied as a bare quark. What the detector records is not a spray of hadrons around a top, but the decay of the top itself: a W and a b quark, with their momenta in the directions that the top's own spin and the dynamics dictate. The spin of the top is not washed out by the strong force, since there is no time for it to be: it can be read from the decay products' angles, which the W's polarisation also carries. In the course's generator the W from a top decay has helicity fractions $F_0 = 0.70$ longitudinal and $F_L = 0.30$ left-handed, and no right-handed ones, which are the leading-order values and the lepton's angular distribution follows from them.

Another number goes with the mass. The top quark's coupling to the Higgs field, its **Yukawa coupling** (Chapter 26), is $y_t = \sqrt2\,m_t/v = 0.991$. It is the only fermion coupling of order one; every other one is below 0.03. Whether that is a coincidence or a hint is a question taken up in Chapters 26 and 30.

## Tops at the LHC

At the LHC the top quark is not a discovery but a signal and a background: a pair of them is made in about one inelastic collision in a hundred million, and a measurement of its properties is a test of the Standard Model, and the background to many searches. The leading-order cross-section of the course's generator at 13 TeV is 439 pb. The full calculation, with the higher-order terms of the strong force, gives about 830 pb,:cite[czakon2014] almost twice as large. The factor shows how much the first term of an expansion in $\alpha_s$ is missing here. At the Tevatron at 1.96 TeV the leading-order cross-section is 5.3 pb.

```fermi
id: top-pairs-per-second
title: Top pairs at the LHC
prompt: 'The cross-section for tt̄ production at the LHC at 13 TeV is about 830 pb. The luminosity of a typical fill was 2 × 10³⁴ cm⁻² s⁻¹ (1 pb = 10⁻³⁶ cm²). How many top-quark pairs are produced per second? And how many in a year of 10⁷ seconds of collisions?'
answer: 17
unit: s⁻¹
factor: 1.5
hints:
  - 'rate = σ L.'
  - '830 pb = 8.3 × 10⁻³⁴ cm².'
explain: 'σL = 8.3 × 10⁻³⁴ cm² × 2 × 10³⁴ cm⁻² s⁻¹ = 17 per second. Over 10⁷ s of collisions that is 1.7 × 10⁸ pairs, of which 29 % (5 × 10⁷) are in the lepton + jets channel. Fewer than half pass the selection of this chapter, and the pairs are mixed up with billions of other collisions: Chapter 27 is about how the trigger finds them. Compare the Tevatron: at 5 pb and the 3 × 10³² cm⁻² s⁻¹ of its later years the same arithmetic gives one pair per ten minutes or so, and in the 1990s, with a luminosity more than ten times lower, one every few hours: the discovery needed years of data.'
```

## Reconstructing a top pair

Take the lepton + jets channel. The event has a lepton (an electron or a muon), a missing transverse momentum, and four or more jets. The four quarks are the b quark and the antiquark from the two tops and the pair of light quarks (up and down type) from the W that decayed to jets. Call them $b_\ell$ (the b on the side of the lepton), $b_h$ (the b on the hadronic side) and $q$, $q'$. The aim is to reconstruct the mass of each top: $m_{jjb}$ for the hadronic top and $m_{\ell\nu b}$ for the leptonic one, and to find the same value in both.

Two puzzles arise. The first is the neutrino's momentum along the beam, which is not measured: it is the momentum that the W mass fixes. If the lepton and the neutrino come from a W of mass $m_W$, then $(p_\ell + p_\nu)^2 = m_W^2$, which given the neutrino's transverse momentum is a quadratic equation for $p_{z}^\nu$. It has two solutions, or none (when the measured missing momentum is too large, usually because of mismeasurement: the transverse mass of Chapter 23 exceeds $m_W$), and in that case the real part is taken. The library's `neutrinoPz` returns the solution with the smaller $|p_z|$.

The second puzzle is the **combinatorics**. There are $n$ jets and four quarks to match them to. The jets are not labelled. The number of ways to choose which is the $b_\ell$, which the $b_h$ and which two are the light quarks (unordered) is $n(n-1)(n-2)(n-3)/2$: 12 for four jets, 60 for five, 180 for six. Almost all of them are wrong. And a perfect assignment may not exist: a jet may be missing (outside the acceptance, or below threshold, or merged), and an extra jet from radiation may be there. This **combinatorial background** is the main difficulty in measuring the top-quark mass.

The method is the one that Chapter 8 used for tracks: score each hypothesis and keep the best. The score here is a $\chi^2$ built from the three masses that must be equal to known values:

:::equation{#top-chi2 caption="The χ² of one assignment of jets to quarks: how far the three reconstructed masses are from the masses they should have."}
$$\chi^2 = \left(\frac{m_{qq'}-m_W}{\term{sw}{\sigma_W}}\right)^2 + \left(\frac{m_{qq'b_h}-m_t}{\term{st}{\sigma_t}}\right)^2 + \left(\frac{m_{\ell\nu b_\ell}-m_t}{\sigma_t}\right)^2 \;[\;+\;\term{pen}{\text{penalty}}\times\text{b-tag mismatches}\;]$$

```terms
sw:
  label: 'σ_W, the width allowed for the W mass'
  what: 10 GeV in the course's reference. It stands for the resolution with which two jets give the W mass.
  why: 'A pair of jets is not a pair of quarks: radiation outside the cone, the neutrinos in jets and the finite resolution all smear the mass. The weight of each term is one over its expected uncertainty squared.'
  effect: A smaller σ_W trusts the W mass more, and prefers the pair that fits it.
st:
  label: 'σ_t, the width allowed for the top mass'
  what: 20 GeV in the reference.
  why: The same, for three jets or for a lepton, a neutrino and a jet; and here the neutrino's momentum is also uncertain.
  effect: A larger σ_t makes the top mass constraint weaker compared with the W's.
pen:
  label: 'the b-tag penalty'
  what: An optional amount added to χ² for each jet assigned as a b quark that was not tagged, and each tagged jet assigned as a light quark.
  why: 'It brings the b-tagging of Chapter 24 into the choice: assignments in which the b''s are the jets that were tagged are preferred.'
  effect: With a penalty of 10 or more, almost every assignment with the wrong b's is penalised away.
```
:::

The $\chi^2$ constraints use the masses of the W and the top as inputs, which is no problem for finding the right assignment, and an issue for measuring the top mass, since a measurement that includes its own answer is biased. Real mass measurements use the best assignment to select, then fit the shape of the distribution for the mass, or use a method that does not rely on it (see the box below).

```predict
q: 'An event has exactly four jets, and two of them are b-tagged. In how many ways can the four jets be assigned to b(ℓ), b(h), q and q′ if the two tagged jets are the b quarks and the other two are the light quarks (q and q′ are not distinguished)?'
options:
  - text: 12, the same as without b-tagging.
    why: 'Without any information on the b-tagging there are 4 × 3 × 1 = 12 assignments: 4 choices of b(ℓ), 3 of b(h), and the last two jets are q and q′. The tags remove many of them.'
  - text: 2.
    correct: true
    why: 'The tagged jets are the b quarks: which of the two is b(ℓ) and which b(h) is the only freedom, because q and q′ are interchangeable. That is 2 assignments, from 12, and the χ² of the leptonic and hadronic top masses chooses between them. A b-tag with an efficiency of about 75 % and a light-jet rate below 1 % (Chapter 24) can reduce the number of assignments by an order of magnitude. With real tags, which are not perfect, the penalty softens this.'
  - text: 1.
    why: 'There is one choice of the b’s as a pair, but they still have to be put on the leptonic and the hadronic side, which is a factor 2. The two tops’ masses decide it.'
```

### Write it yourself

```code
id: assign-top-jets
title: Assigning jets to the four quarks by χ²
hook: reco.assignTopJets
prompt: |
  Complete only the mass-mismatch score in the supplied assignment search: sum the squared pulls of the W mass and the two top masses. Enumeration, neutrino reconstruction and the optional b-tag penalty are provided. Predict how inflating sigmaW changes the influence of the W constraint.
starter: |
  import type { P4 } from 'hep';
  import { neutrinoPz, TOP_CHI2 } from 'hep/topreco';
  import { mass } from 'hep/kinematics';

  const add = (a: P4, b: P4): P4 => ({ E: a.E + b.E, px: a.px + b.px, py: a.py + b.py, pz: a.pz + b.pz });

  export function assignTopJets(
    jets: { p: P4; btag: number }[],
    lepton: P4,
    met: { x: number; y: number },
    opts: { btagPenalty?: number; maxJets?: number } = {},
  ) {
    const n = Math.min(jets.length, opts.maxJets ?? 6);
    if (n < 4) return null;
    const pen = opts.btagPenalty ?? 0;
    const { mW, mT, sigmaW, sigmaT, tagThreshold } = TOP_CHI2;
    const nu = neutrinoPz(lepton, met, mW);
    const neutrino: P4 = { E: Math.hypot(met.x, met.y, nu.pz), px: met.x, py: met.y, pz: nu.pz };
    const lnu = add(lepton, neutrino);
    const tagged = jets.slice(0, n).map((j) => j.btag > tagThreshold);
    let best: any = null;
    for (let bl = 0; bl < n; bl++) {
      const mLep = mass(add(lnu, jets[bl].p));
      for (let bh = 0; bh < n; bh++) {
        if (bh === bl) continue;
        for (let a = 0; a < n; a++) {
          if (a === bl || a === bh) continue;
          for (let b = a + 1; b < n; b++) {
            if (b === bl || b === bh) continue;
            const mw = mass(add(jets[a].p, jets[b].p));
            const mh = mass(add(add(jets[a].p, jets[b].p), jets[bh].p));
            let chi2 = 0 /* TODO: sum the three squared mass pulls */;
            if (pen) chi2 += pen * ((tagged[bl] ? 0 : 1) + (tagged[bh] ? 0 : 1) + (tagged[a] ? 1 : 0) + (tagged[b] ? 1 : 0));
            if (!best || chi2 < best.chi2) best = { bLep: bl, bHad: bh, q1: a, q2: b, chi2, mW: mw, mTopHad: mh, mTopLep: mLep, nuPz: nu.pz };
          }
        }
      }
    }
    return best;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { assignTopJets } from 'solution';
  import { assignTopJetsReference, neutrinoPz, TOP_CHI2 } from 'hep/topreco';
  import { generate } from 'hep/gen';
  import { rng } from 'hep/random';
  import { mass, fromPtEtaPhiM } from 'hep/kinematics';

  // Parton-level tt̄ → ℓ+jets events: the four quarks stand in for four jets.
  function partons(seed) {
    const r = rng(seed);
    for (;;) {
      const ev = generate('pp->ttbar->leptonjets', { sqrtS: 13000, shower: false, hadronise: false, decay: false }, r);
      const ps = ev.particles;
      const lep = ps.find((p) => p.status === 'final' && [11, 13].includes(Math.abs(p.pdg)));
      const nu = ps.find((p) => p.status === 'final' && [12, 14].includes(Math.abs(p.pdg)));
      if (!lep || !nu) continue;
      const tLep = ps[ps[lep.mothers[0]].mothers[0]];
      const bLep = ps.find((p) => Math.abs(p.pdg) === 5 && p.mothers[0] === tLep.id);
      const tHad = ps.find((p) => Math.abs(p.pdg) === 6 && p.id !== tLep.id);
      const bHad = ps.find((p) => Math.abs(p.pdg) === 5 && p.mothers[0] === tHad.id);
      const qs = ps.filter((p) => p.status === 'final' && Math.abs(p.pdg) <= 4 && Math.abs(ps[p.mothers[0]].pdg) === 24 && ps[p.mothers[0]].mothers[0] === tHad.id);
      if (qs.length !== 2) continue;
      return { lep: lep.p, met: { x: nu.p.px, y: nu.p.py }, bLep: bLep.p, bHad: bHad.p, q1: qs[0].p, q2: qs[1].p };
    }
  }
  function jetsOf(e, extra, seed) {
    const r = rng(seed);
    const list = [
      { p: e.bLep, btag: 0.9, role: 'bl' }, { p: e.bHad, btag: 0.9, role: 'bh' }, { p: e.q1, btag: 0.05, role: 'q' }, { p: e.q2, btag: 0.05, role: 'q' },
      ...extra.map((p) => ({ p, btag: 0.05, role: 'x' })),
    ];
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  }
  const extras = [fromPtEtaPhiM(30, 0.4, 1.0, 5), fromPtEtaPhiM(28, -1.0, -2.0, 4)];
  const P = (list) => list.map((x) => ({ p: x.p, btag: x.btag }));

  test('fewer than four jets: null', () => {
    const e = partons(1);
    expect(assignTopJets(P(jetsOf(e, [], 1)).slice(0, 3), e.lep, e.met)).toBeNull();
  });

  test('four different jets, q1 < q2, and the reported chi² is the formula', () => {
    const e = partons(5);
    const jets = P(jetsOf(e, extras, 3));
    const a = assignTopJets(jets, e.lep, e.met);
    expect(a.q1).toBeLessThan(a.q2);
    expect(new Set([a.bLep, a.bHad, a.q1, a.q2]).size).toBe(4);
    const nu = neutrinoPz(e.lep, e.met);
    const n4 = { E: Math.hypot(e.met.x, e.met.y, nu.pz), px: e.met.x, py: e.met.y, pz: nu.pz };
    const sum = (...ps) => ps.reduce((s, p) => ({ E: s.E + p.E, px: s.px + p.px, py: s.py + p.py, pz: s.pz + p.pz }), { E: 0, px: 0, py: 0, pz: 0 });
    const chi2 = ((mass(sum(jets[a.q1].p, jets[a.q2].p)) - TOP_CHI2.mW) / TOP_CHI2.sigmaW) ** 2
      + ((mass(sum(jets[a.q1].p, jets[a.q2].p, jets[a.bHad].p)) - TOP_CHI2.mT) / TOP_CHI2.sigmaT) ** 2
      + ((mass(sum(e.lep, n4, jets[a.bLep].p)) - TOP_CHI2.mT) / TOP_CHI2.sigmaT) ** 2;
    expect(a.chi2).toBeCloseTo(chi2, 8);
    expect(a.mTopHad).toBeCloseTo(mass(sum(jets[a.q1].p, jets[a.q2].p, jets[a.bHad].p)), 8);
    expect(a.nuPz).toBeCloseTo(nu.pz, 8);
  });

  test('it is the minimum: same result as the library on 40 events with extra jets', () => {
    for (let s = 1; s <= 40; s++) {
      const e = partons(100 + s);
      const jets = P(jetsOf(e, extras, s));
      const a = assignTopJets(jets, e.lep, e.met), b = assignTopJetsReference(jets, e.lep, e.met);
      expect(a.chi2).toBeCloseTo(b.chi2, 8);
      expect([a.bLep, a.bHad, a.q1, a.q2]).toEqual([b.bLep, b.bHad, b.q1, b.q2]);
    }
  });

  test('with no extra jets and exact four-vectors, the true assignment is found in most events', () => {
    let ok = 0, n = 0;
    for (let s = 1; s <= 50; s++) {
      const e = partons(200 + s);
      const list = jetsOf(e, [], s);
      const a = assignTopJets(P(list), e.lep, e.met);
      n++;
      if (list[a.bLep].role === 'bl' && list[a.bHad].role === 'bh') ok++;
    }
    expect(ok / n).toBeGreaterThan(0.7);
  });

  test('a large b-tag penalty makes the two b jets the tagged ones', () => {
    for (let s = 1; s <= 25; s++) {
      const e = partons(300 + s);
      const list = jetsOf(e, extras, s);
      const a = assignTopJets(P(list), e.lep, e.met, { btagPenalty: 1000 });
      expect(new Set([list[a.bLep].role, list[a.bHad].role])).toEqual(new Set(['bl', 'bh']));
    }
  });

  test('maxJets limits the jets considered', () => {
    const e = partons(9);
    const a = assignTopJets(P(jetsOf(e, extras, 1)), e.lep, e.met, { maxJets: 4 });
    for (const i of [a.bLep, a.bHad, a.q1, a.q2]) expect(i).toBeLessThan(4);
  });
solution: |
  import type { P4 } from 'hep';
  import { neutrinoPz, TOP_CHI2 } from 'hep/topreco';
  import { mass } from 'hep/kinematics';

  const add = (a: P4, b: P4): P4 => ({ E: a.E + b.E, px: a.px + b.px, py: a.py + b.py, pz: a.pz + b.pz });

  export function assignTopJets(
    jets: { p: P4; btag: number }[],
    lepton: P4,
    met: { x: number; y: number },
    opts: { btagPenalty?: number; maxJets?: number } = {},
  ) {
    const n = Math.min(jets.length, opts.maxJets ?? 6);
    if (n < 4) return null;
    const pen = opts.btagPenalty ?? 0;
    const { mW, mT, sigmaW, sigmaT, tagThreshold } = TOP_CHI2;
    const nu = neutrinoPz(lepton, met, mW);
    const neutrino: P4 = { E: Math.hypot(met.x, met.y, nu.pz), px: met.x, py: met.y, pz: nu.pz };
    const lnu = add(lepton, neutrino);
    const tagged = jets.slice(0, n).map((j) => j.btag > tagThreshold);
    let best: any = null;
    for (let bl = 0; bl < n; bl++) {
      const mLep = mass(add(lnu, jets[bl].p));
      for (let bh = 0; bh < n; bh++) {
        if (bh === bl) continue;
        for (let a = 0; a < n; a++) {
          if (a === bl || a === bh) continue;
          for (let b = a + 1; b < n; b++) {
            if (b === bl || b === bh) continue;
            const mw = mass(add(jets[a].p, jets[b].p));
            const mh = mass(add(add(jets[a].p, jets[b].p), jets[bh].p));
            let chi2 = ((mw - mW) / sigmaW) ** 2 + ((mh - mT) / sigmaT) ** 2 + ((mLep - mT) / sigmaT) ** 2;
            if (pen) chi2 += pen * ((tagged[bl] ? 0 : 1) + (tagged[bh] ? 0 : 1) + (tagged[a] ? 1 : 0) + (tagged[b] ? 1 : 0));
            if (!best || chi2 < best.chi2) best = { bLep: bl, bHad: bh, q1: a, q2: b, chi2, mW: mw, mTopHad: mh, mTopLep: mLep, nuPz: nu.pz };
          }
        }
      }
    }
    return best;
  }
hints:
  - 'Four nested loops: b(ℓ), b(h), then a < b for the two light jets, skipping indices already used. For six jets that is 180 assignments, which is nothing.'
  - 'Compute the leptonic top mass once per b(ℓ): it does not depend on the other three. Build the neutrino with E = √(px² + py² + pz²).'
  - 'neutrinoPz(lepton, met) returns { pz, complex }. The mismatches: a b-assigned jet with btag ≤ 0.5, or a light-assigned jet with btag > 0.5.'
```

Run it on the simulated events and the reconstruction pipeline you built, and the figure below uses your function (*use my code*).

::top-reconstruction{n="25.4" caption="591 simulated tt̄ → ℓ+jets events that passed a lepton + jets selection, from the whole course pipeline: the generator (with parton shower and hadronisation), the detector simulation, particle-flow reconstruction, anti-kT jets and the b-tagger of Chapter 24 (generated and reconstructed once, with fixed seeds). The histogram shows the mass of the three jets assigned to the hadronic top. In grey, every combination of three jets (each event counted once, with its combinations averaged): a broad hump with no peak. In orange, the best χ² assignment. In blue, the best with the b-tag penalty. In green, the correct assignment, known from the generator's truth, which is possible only in simulation. Raise the b-tag penalty, change the number of jets considered, and watch the peak near 172.5 GeV grow out of the combinatorial background. Step through events on the right: the circles are jets, blue-filled ones are b-tagged, the green outline marks a jet that the truth links to a quark, and the labels are the roles the χ² assigned. The table gives the fraction of events in which the full assignment is correct, among those in which all four quark jets exist among the jets used: with 6 jets and no b-tag information it is about one in six, with the b-tag penalty about one in three. The jets of this toy shower are more numerous than in the real thing, which makes the combinatorics harder than at the LHC."}

The figure shows two things at once. First, that the top peak is there, in the hadronic top's mass, once the right three jets are chosen. Second, that the assignment is far from perfect, even with the best method: in a third of the events at best. The remaining events add a broad shoulder under the peak. Experiments handle that by fitting the shape of the whole distribution, with signal and background templates, and not by counting events in a window.

:::programmer
The assignment problem is a **matching under a cost function**, the same shape as entity resolution, record linkage and multi-object tracking: unlabelled detections on one side, roles on the other, a cost for each pairing, and a search for the cheapest consistent matching. The brute force used here (180 assignments for six jets) is fine for six items and impossible for sixty: the Hungarian algorithm solves the pure one-to-one matching in $O(n^3)$ and a top-quark fit adds the coupled mass constraints that spoil it. What reduces the search is **pruning with side information**, which is the role of b-tagging: each tagged jet removes whole branches of the tree. It is the same trick as an index in a database or an early-exit in a search: use a cheap, partly reliable signal to cut the candidates before the expensive comparison.
:::

:::hood[Brute force with a shared sub-expression]
The reference `assignTopJetsReference` in `hep/topreco` is four nested loops. The one subtlety is that part of the χ² depends only on some of the indices, so it is computed in the outer loops and not the inner ones:

```ts
for (let bl = 0; bl < n; bl++) {
  const mLep = mass(add2(lnu, jets[bl]!.p));        // the leptonic top: depends on b(ℓ) only
  const cLep = ((mLep - mT) / sigmaT) ** 2;
  for (let bh = 0; bh < n; bh++) {
    if (bh === bl) continue;
    for (let a = 0; a < n; a++) {
      if (a === bl || a === bh) continue;
      for (let b = a + 1; b < n; b++) {              // b > a: q and q′ are not ordered
        if (b === bl || b === bh) continue;
        const mw = mass(add2(jets[a]!.p, jets[b]!.p));
        const mh = mass(add3(jets[a]!.p, jets[b]!.p, jets[bh]!.p));
        let chi2 = ((mw - mW) / sigmaW) ** 2 + ((mh - mT) / sigmaT) ** 2 + cLep;
        if (pen) chi2 += pen * ((tagged[bl]! ? 0 : 1) + (tagged[bh]! ? 0 : 1) + (tagged[a]! ? 1 : 0) + (tagged[b]! ? 1 : 0));
        if (!best || chi2 < best.chi2) best = { bLep: bl, bHad: bh, q1: a, q2: b, chi2, /* … */ };
      }
    }
  }
}
```

The neutrino is computed once before the loops: `neutrinoPz` solves $a\,p_z^{\ell} \pm E_\ell\sqrt{a^2 - p_T^{\ell\,2}p_T^{\nu\,2}}$ over $p_T^{\ell\,2}$ with $a = m_W^2/2 + \vec p_T^{\,\ell}\cdot\vec p_T^{\,\nu}$, and picks the root of smaller magnitude. The tests build parton-level events with exact four-vectors and check that the true assignment is found most of the time (not always: the choice of the neutrino root is wrong in about half of the events, and other assignments can fit better than the true one), that the reported χ² is the formula, and that the penalty does what it says. The widget calls `assignTopJets` through `hook('reco.assignTopJets', …)` for 591 events × 2 settings every time a slider moves: about 200,000 assignments, a few tens of milliseconds.
:::

:::experiments
The top-quark mass is the most precisely measured parameter of a quark, and the measurement is more elaborate than the one above. **ATLAS** and **CMS** (Chapter 0), and **CDF** and **D0** before them, use three families of methods: **template** fits, in which histograms of a mass estimator are simulated for a range of assumed top masses and compared with the data; **matrix-element** methods, which compute for each event the probability that it was produced by a top of each mass, summing over all the assignments of jets, with weights, instead of picking one; and **kinematic fits**, such as the likelihood fitter used by ATLAS, which fit all the four-vectors at once with the W and top masses as constraints, the generalisation of the χ² here. The b-tagging is a neural network, as in Chapter 24. The result is a mass with an uncertainty below 0.3 GeV, 0.2 %, and the leading uncertainties are no longer statistical: they come from the modelling of jets and of the hadronisation, and from a question of definition: the mass in the Monte Carlo generators that the templates are made with, and the "pole mass" of theory calculations, differ by a quantity of the order of a GeV.:cite[pdg2024] The course's pipeline (Chapter 0) and its generator are a toy version of the same chain.
:::

## What the sixth quark teaches

The Standard Model's quarks are now all in place: six quarks in three generations, whose mixing contains a source of CP violation, whose weak decays change flavour, and whose masses span five orders of magnitude, with the top at the end, close to the electroweak scale: $v/\sqrt2 = 174.1$ GeV is within 1 % of $m_t$. The question of why the top is so heavy is the same as the question of why the others are so light: what sets the masses of the fermions? The answer in the Standard Model is that they are given, by couplings to the Higgs field that are not predicted. It is the subject of Part VII.

## What comes next

Part VI is complete. The W, the Z and the quarks have been found, and the weak force and electromagnetism are two faces of one. But the theory contains something that has not yet been explained: the W and the Z have mass, and a mass term for them in a gauge theory is not allowed (Chapter 17). The theory was built with a mechanism that gives them mass without breaking the symmetry, and that mechanism predicts a new particle. [Chapter 26](/chapters/the-higgs-mechanism/) explains it.

## Further reading

- Campagnari and Franklin, *The discovery of the top quark*, a review that tells the story of the search and of the indirect determinations (:cite[campagnari1997]).
- The discovery papers by CDF and D0 (:cite[cdf1995,d01995]).
- The LEP Electroweak Working Group's report, for the Z-pole fits and the corrections that depend on the top mass (:cite[lepewwg2006]).
- The Particle Data Group's review of the top quark (:cite[pdg2024]).
