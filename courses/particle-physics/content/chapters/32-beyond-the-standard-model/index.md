---
number: 32
title: Beyond the Standard Model
summary: The Standard Model has passed every test the colliders could set it, and it is incomplete. This chapter lists what it leaves out (dark matter, the surplus of matter over antimatter, the hierarchy of scales, gravity), what the LHC has and has not found, the muon g − 2 episode in which an apparent crack closed, and what a search for new physics looks like when you run one yourself, in simulation.
duration: About 3 hours
prerequisites: [neutrinos, measuring-the-higgs, the-statistics-of-discovery]
---

On 3 June 2025 the Muon g − 2 experiment at Fermilab announced its final result, a measurement of how fast the spin of a muon turns in a magnetic field, accurate to 127 parts per billion. The number was a measurement of a property of one particle, with a prediction from the Standard Model to compare with. Since 2021 it had looked as though the two disagreed, at first by 4.2 standard deviations and, with the final number set against the prediction of 2020, by more than five: it would have been the first clear failure of the Standard Model in a precision measurement of this kind. In the days before the announcement, a new calculation of the prediction removed the disagreement. The story belongs in this chapter because it is the right size of lesson: how a crack in the theory is looked for, how it can close, and how much work stands between "a tension" and "new physics". The chapter returns to it near the end.

First, the list of reasons to expect that the Standard Model is not the whole story. They are not equally solid, and it helps to say which are which.

| Puzzle | What is observed or argued | Status |
|---|---|---|
| Neutrino masses | Neutrinos oscillate, so they have mass ([Chapter 31](/chapters/neutrinos/)) | Observed. The Standard Model has no neutrino mass; the cure is not unique |
| Dark matter | Five times more non-luminous matter than ordinary matter, from galaxies to the microwave background | Observed gravitationally. Its particle nature is unknown |
| Matter and antimatter | One baryon per 1.6 billion photons and no antibaryons | Observed. The Standard Model's CP violation is too small to explain it |
| The hierarchy | The Higgs mass is far smaller than the scale of gravity | An argument about naturalness, not a failed prediction |
| Gravity | General relativity has no quantum version that has been tested | A theoretical gap; no experiment contradicts the Standard Model here |
| Flavour | Why three generations, why these masses and mixings | A pattern in search of a reason |

## Dark matter

The astrophysics course gives the evidence in detail, and this section only collects what the particle physicist needs from it. In 1933 Fritz Zwicky noticed that the galaxies of the Coma cluster move too fast to be held by the visible matter, and in the 1970s Vera Rubin and Kent Ford found that stars at the edge of a spiral galaxy orbit as fast as those near its centre, when the visible mass thins out and they should be slowing down.:cite[zwicky1933,rubin1970] Gravitational lensing (the [lensing chapter](/astrophysics/ch/lensing/)), the growth of cosmic structure ([structure formation](/astrophysics/ch/structure/)) and above all the pattern of hot and cold spots in the cosmic microwave background (the [CMB chapter](/astrophysics/ch/cmb/)) agree. The [galactic dynamics chapter](/astrophysics/ch/galactic-dynamics/) explains how the rotation curves are measured.

:::history{year=1933 title="The missing mass" people="Fritz Zwicky, Vera Rubin, Kent Ford" source="Sources: Zwicky (1933); Rubin and Ford (1970); Planck Collaboration (2020)."}
In 1933 Fritz Zwicky, working at Caltech, applied the virial theorem to the motions of the galaxies in the Coma cluster and concluded that the cluster contained far more mass than its stars. He called it *dunkle Materie*, dark matter.:cite[zwicky1933] The idea attracted little attention for forty years, until Vera Rubin and Kent Ford measured the rotation of the Andromeda galaxy out to large radii in 1970 and found a curve that did not fall off.:cite[rubin1970]

Today the strongest numbers come from the cosmic microwave background. The Planck satellite's analysis gives a density of cold dark matter of $\Omega_c h^2 = 0.120 \pm 0.001$ and of ordinary (baryonic) matter $\Omega_b h^2 = 0.0224 \pm 0.0001$, where $h$ is the Hubble constant in units of 100 km/s/Mpc: the dark matter outweighs the ordinary matter by a ratio of $0.120/0.0224 \approx 5.4$.:cite[planck2018]
:::

What :term[dark matter]{id=dark-matter} is **not** is established better than what it is. It is not made of ordinary atoms: the abundances of the light elements made in the first minutes (the [big bang chapter](/astrophysics/ch/big-bang/)) and the microwave background both fix the density of baryons, and it is only a fifth of the total. It is not the neutrinos of the Standard Model either. Relic neutrinos contribute $\Omega_\nu h^2 = \sum m_\nu / 93.1\ \text{eV}$, and with the cosmological bound of Chapter 31, $\sum m_\nu < 0.12$ eV, that is at most $0.0013$, about one per cent of what is needed. A particle that light would also have been moving at nearly the speed of light when structure began to form, and the observed pattern of galaxies requires matter that was cold.

So dark matter needs a particle that the Standard Model does not contain. It must be neutral, stable on the age of the universe, and made in the right amount. There is no shortage of candidates (axions, sterile neutrinos, primordial black holes, whole hidden sectors of new particles), and the one that has had the most experimental effort is a heavy particle that interacts weakly, a :term[WIMP]{id=wimp}. The reason is an accident of arithmetic.

### The WIMP argument

Suppose the early universe, hot and dense, held a heavy particle $X$ in thermal equilibrium: made in collisions and annihilating in pairs. While the temperature $T$ is above the mass $m$, $X$ is as abundant as photons. As the universe cools below $m$, the equilibrium abundance falls exponentially, $e^{-m/T}$, because there is not enough energy to make new ones. Annihilation continues to remove them as long as particles can find each other. But the universe is also expanding, and eventually the particles are so far apart that they stop meeting: the annihilation :term[freezes out]{id=freeze-out}, and what is left stays as a constant number per comoving volume, which is the relic abundance.

::freeze-out{n="32.1" caption="Freeze-out of a heavy relic particle: the abundance per unit entropy follows the exponentially falling equilibrium value (dashed) until annihilation can no longer keep up, then stays constant. The final value fixes today's dark-matter density. A toy: s-wave annihilation with a constant cross-section, g* = 90, no co-annihilation. The relic density is inversely proportional to the cross-section; the button sets it to the measured value."}

The result depends on the annihilation cross-section and hardly at all on the mass. To get the observed density, the figure shows that the cross-section $\langle\sigma v\rangle$ must be about $2 \times 10^{-26}$ cm³/s (the figure usually quoted is "about $3 \times 10^{-26}$ cm³/s", and careful calculations give values of 2 to $3 \times 10^{-26}$). Is that a natural number? A weak-interaction annihilation has a cross-section of roughly $\pi\alpha_W^2/m^2$ with $\alpha_W \approx 1/30$. For a mass of 1 TeV this is $3.5 \times 10^{-9}$ GeV⁻², which is $4 \times 10^{-26}$ cm³/s: the right size. A particle with the strength of the weak force and a mass at the electroweak scale makes the right amount of dark matter. That coincidence is called the "WIMP miracle", and it is part of why the LHC and the underground detectors were built to look for such particles. It is not a proof. A different mass or coupling, or a different mechanism, can give the same abundance.

```numeric
id: wimp-cross-section
title: The WIMP cross-section
prompt: 'Estimate the annihilation cross-section of a heavy particle with weak-interaction strength α_W = 1/30 and mass m = 1 TeV = 1000 GeV, as σv ≈ π α_W² / m². Convert it from GeV⁻² to cm³/s using 1 GeV⁻² = 1.167 × 10⁻¹⁷ cm³/s. Give the answer in units of 10⁻²⁶ cm³/s.'
answer: 4.07
unit: 10⁻²⁶ cm³/s
tolerance: 0.05
hints:
  - 'π (1/30)² = 3.49 × 10⁻³, divided by (1000 GeV)² = 10⁶ GeV², gives the cross-section in GeV⁻².'
  - 'Multiply by 1.167 × 10⁻¹⁷ cm³/s per GeV⁻².'
explain: 'π/900 = 3.49 × 10⁻³, divided by 10⁶ gives 3.49 × 10⁻⁹ GeV⁻², and times 1.167 × 10⁻¹⁷ cm³/s that is 4.07 × 10⁻²⁶ cm³/s. The relic-density calculation wants 2 to 3 × 10⁻²⁶: the same order, from a coupling and a mass chosen for entirely different reasons.'
```

### What the searches have found

There are three ways to look for such a particle, and all three have been pursued for decades.

- **Direct detection.** If dark matter fills the Galaxy, a few of its particles pass through every detector on Earth, and an occasional one scatters off an atomic nucleus. The signal is a nucleus recoiling with a few keV, and the background is everything else, so the detectors are huge, very pure, and a long way underground. The **LUX-ZEPLIN (LZ)** experiment uses about seven tonnes of liquid xenon in a time-projection chamber, 1.5 km down in the former Homestake mine in South Dakota (where Davis's tank of Chapter 31 once stood). In its 2024 data (4.2 tonne-years of exposure) it saw no excess over its backgrounds, which excludes a spin-independent cross-section above $2.2 \times 10^{-48}$ cm² for a particle of 40 GeV.:cite[lz2025] A neutrino of 1 GeV scatters from a nucleon with a cross-section of about $10^{-38}$ cm²: the limit is billions of times smaller. The simplest WIMPs of the 1980s are excluded.
- **Indirect detection.** Dark-matter particles annihilating today in the Galactic centre or in dwarf galaxies would make gamma rays, positrons or antiprotons. Telescopes have looked, and have found nothing that cannot be explained otherwise, within large astrophysical uncertainties.
- **Colliders.** A dark-matter particle produced at the LHC would leave the detector unseen, like a neutrino (Chapter 23), and the signature would be missing transverse momentum recoiling against a jet, a photon or a Z. The searches have found no excess.

None of this rules out dark matter. It rules out the simplest versions of the particle with the simplest interactions, and it pushes the search to lighter, heavier, more weakly coupled or more complicated possibilities.

## More matter than antimatter

The laws of physics, as far as they have been tested, treat particles and antiparticles almost symmetrically. The hot early universe made them in equal numbers. They annihilated as it cooled. And yet the universe today contains galaxies, stars and people, made of baryons, and no corresponding quantity of antibaryons: if it had been exactly symmetric, almost everything would have annihilated into photons and nothing would have been left.

The leftover is measured by the ratio of baryons to photons, $\eta = n_B/n_\gamma$. The microwave background gives $\eta = (6.12 \pm 0.04) \times 10^{-10}$:cite[planck2018] and we can get the number from the two quantities we already have. The density of baryons follows from $\Omega_b h^2 = 0.0224$ and the critical density, $\rho_c = 1.054 \times 10^{-5}\,h^2$ GeV/cm³, divided by the proton mass; the photon density is that of a black body at 2.7255 K, which is 411 per cm³.

```numeric
id: baryon-photon-ratio
title: The baryon-to-photon ratio
prompt: 'The density of baryons is Ω_b h² times the critical density 1.054 × 10⁻⁵ GeV/cm³ (per h²), divided by the proton mass 0.938 GeV. The density of photons in the microwave background is 411 per cm³. With Ω_b h² = 0.0224, what is η, the number of baryons per photon? Give the answer in units of 10⁻¹⁰.'
answer: 6.1
unit: 10⁻¹⁰
tolerance: 0.05
hints:
  - 'Baryon density: 0.0224 × 1.054 × 10⁻⁵ GeV/cm³ / 0.938 GeV = 2.5 × 10⁻⁷ per cm³.'
  - 'Divide by 411 per cm³.'
explain: 'The baryon density is 0.0224 × 1.054 × 10⁻⁵ / 0.938 = 2.52 × 10⁻⁷ per cm³, and dividing by 411 gives η = 6.1 × 10⁻¹⁰. There is one baryon for every 1.6 billion photons. In the early universe, when quarks and antiquarks were as abundant as photons, this means that for every few billion antiquarks there were a few billion and one quarks. The one is us.'
```

:::history{year=1967 title="Three conditions for a world made of matter" people="Andrei Sakharov" source="Source: Sakharov (1967)."}
In 1967 the Soviet physicist Andrei Sakharov published a short paper on the :term[baryon asymmetry]{id=baryon-asymmetry} of the universe. It listed what a universe that begins symmetric would need in order to end up asymmetric, three conditions that have been known since as :term[Sakharov's conditions]{id=sakharov-conditions}.:cite[sakharov1967] There must be (1) processes that violate **baryon number**, otherwise no excess of baryons can arise; (2) violation of **C and CP**, otherwise every process that makes baryons is matched by one that makes antibaryons at the same rate; and (3) a departure from **thermal equilibrium**, otherwise the reverse processes undo any asymmetry.

The paper was written three years after Cronin and Fitch found CP violation in kaons (Chapter 24), and it was one of the first to connect it to cosmology. It also discussed the possibility that baryon number is not conserved and that the proton is therefore unstable, which is the subject of a later section.
:::

The Standard Model has a version of each ingredient, and each is too weak.

1. **Baryon number violation.** Baryon number is conserved at every order of perturbation theory, but a non-perturbative effect, the :term[sphaleron]{id=sphaleron}, violates it (and lepton number) at temperatures above the electroweak scale, when the Higgs field is not yet in its vacuum.:cite[kuzmin1985]
2. **CP violation.** The CKM phase of Chapter 24 is the only source, and its size in the Jarlskog invariant, $J \approx 3 \times 10^{-5}$, is far too small once the small quark masses are taken into account. The estimated asymmetry it could generate is many orders of magnitude below $10^{-10}$. It is not close to being enough. New measurements add detail, not a new source: in 2025 LHCb reported the first observation of CP violation in the decays of a baryon, $\Lambda_b \to p K^-\pi^+\pi^-$, a new place to look at a known phenomenon, with an asymmetry of about 2.5 % and a significance of 5.2 standard deviations.:cite[lhcb2025]
3. **Departure from equilibrium.** A first-order phase transition, in which bubbles of broken electroweak symmetry expand through the hot plasma, would do it. Lattice calculations found that for a Higgs boson as heavy as 125 GeV the transition is a smooth crossover, not a first-order jump.:cite[kajantie1996]

The most discussed way out ties this chapter to the previous one. A heavy Majorana neutrino of the seesaw mechanism could decay asymmetrically, producing more leptons than antileptons, because its decays violate CP; the sphalerons then convert part of the lepton excess into a baryon excess. This is :term[leptogenesis]{id=leptogenesis}.:cite[fukugita1986] It needs the same kind of heavy particle that explains why neutrinos are light, and it has no direct test: the particles are too heavy to be made. What can be tested is whether CP is violated in the *light* neutrinos, which is the question the next generation of beam experiments asks (Chapter 31), and whether neutrinos are Majorana particles.

## The hierarchy problem

The Higgs boson has a mass of 125 GeV. Gravity becomes strong at the Planck scale, $1.2 \times 10^{19}$ GeV, seventeen orders of magnitude higher (Chapter 1). Why should the electroweak scale be so low? This is the :term[hierarchy problem]{id=hierarchy-problem}.

The question is sharper than it sounds, because of how a scalar particle's mass behaves in quantum field theory. The mass of an electron is protected: if it were zero it would stay zero, by a symmetry (chirality, Chapter 22), and corrections to it are proportional to the mass itself. For a scalar like the Higgs boson there is no such protection, and its mass-squared receives loop corrections from every particle it couples to, which grow like the square of the highest energy $\Lambda$ at which the theory still holds. The largest comes from the top quark:

$$\delta m_H^2 \approx -\frac{3\,y_t^2}{8\pi^2}\,\Lambda^2 .$$

If $\Lambda$ is the Planck mass, the correction is about $5.6 \times 10^{36}$ GeV², whereas the Higgs mass squared is $m_H^2 = 1.6 \times 10^4$ GeV². The measured number is the difference of a "bare" term and this correction, and the two must cancel to thirty-two decimal places.

```fermi
id: hierarchy-digits
title: How precisely must two numbers cancel?
prompt: 'Take the top-quark correction δm² = 3 y_t² Λ² / (8π²), with y_t = √2 m_t / v = 0.99 (m_t = 172.6 GeV, v = 246.2 GeV) and Λ = 1.2 × 10¹⁹ GeV (the Planck mass). The Higgs boson has m_H = 125.2 GeV. By what factor is the correction larger than m_H²?'
answer: 3.5e32
unit: ''
factor: 3
hints:
  - 'δm² = 3 × 0.98 / (8π² = 78.96) × (1.2 × 10¹⁹)² GeV² ≈ 0.037 × 1.5 × 10³⁸ GeV².'
  - 'm_H² = 125.2² ≈ 1.57 × 10⁴ GeV². Divide.'
explain: 'The coefficient is 3 × 0.98 / 78.96 = 0.037. Λ² = 1.5 × 10³⁸ GeV², so the correction is 5.6 × 10³⁶ GeV². The Higgs mass squared is 1.57 × 10⁴ GeV². The ratio is 3.5 × 10³²: the bare parameter and the loop correction have to cancel to about 32 digits to leave the observed Higgs mass. That is not a contradiction, because the bare parameter is not observable. It is a coincidence that would require an explanation, and the explanations on offer (a symmetry that protects the mass, a lower cut-off, a landscape of universes) have all been looked for or are untestable.'
```

This is a :term[naturalness]{id=naturalness} argument. It does not say that the Standard Model is wrong. It says that if the theory is valid up to very high energies, the Higgs mass is a fine-tuned accident, and physicists generally prefer an explanation. The favourite one was that new particles appear near the TeV scale, whose own loops cancel the top quark's: this is the reason that the LHC was expected to find something beyond the Higgs boson. Supersymmetry is the best-developed such proposal.

### Supersymmetry, and what the LHC has not found

:term[Supersymmetry]{id=supersymmetry} (SUSY) is a symmetry that relates fermions to bosons. Every particle of the Standard Model gets a partner whose spin differs by one half: the quarks get spin-0 "squarks", the gluon a spin-½ "gluino", the photon and the Z and Higgs fields mix into spin-½ "neutralinos". Loops of the partners have the opposite sign to loops of the particles, and the Higgs mass correction cancels to the extent that the masses are equal. If supersymmetry were exact the partners would have the same masses as the particles, and they would have been seen long ago, so it must be broken: the partners are heavier, and the cancellation is good enough to explain the hierarchy only if they are not too heavy, roughly a TeV or so.

Supersymmetry has two further attractions, both of which this course has touched. In its minimal form it contains a stable lightest partner, the lightest neutralino, which is neutral, weakly interacting and heavy: a WIMP. And it changes the running of the three gauge couplings, as the figure shows.

::coupling-running{n="32.2" caption="One-loop running of the three gauge couplings, plotted as 1/α, which is a straight line in the logarithm of the energy at this order. In the Standard Model (solid) the three lines pass near each other, but not through one point. Add the superpartners (dashed) above the chosen mass and the lines bend so that the three meet, at about 2 × 10¹⁶ GeV and 1/α ≈ 25. A toy: one loop, a sharp threshold, no GUT-scale thresholds. The meeting depends mildly on the superpartner mass."}

The ATLAS and CMS experiments searched for the partners in proton collisions at 13 TeV, in final states with many jets, leptons and large missing transverse momentum (the partner decays chain down to the invisible lightest neutralino). In simplified models in which a gluino decays to quarks and a neutralino, gluinos with masses up to about 2.2 TeV are excluded in CMS's searches, squarks somewhat lower, and ATLAS reports limits of similar size; the exact numbers vary from model to model.:cite[sekmen2025] The limits are strong where the assumed decay chain gives a clean signature, and much weaker if the mass gaps are small (so the decay products are soft), if the lightest partner can itself decay, or if only the partners of the electroweak bosons and the top quark are light. None of this excludes supersymmetry; it makes the simplest versions, which would have solved the hierarchy problem with partners of a few hundred GeV, hard to maintain. Whether the problem is real, then, is a harder question than it was in 2008.

Other searches have been equally empty. Heavy resonances that would decay to a pair of leptons or jets, leptoquarks, heavy partners of the top quark, extra dimensions, excesses in dibosons: one had a moment of fame, the 750 GeV diphoton excess of 2015 and 2016, which reached a local significance of a few standard deviations and disappeared with more data (Chapter 28). The lesson of that chapter applies to all of them. A new-physics claim needs a significance that survives the look-elsewhere effect and independent confirmation. Searches in precision measurements are no different: in 2021 a set of LHCb results on the rates of $B$ decays to muons against electrons suggested that the two leptons were treated differently, which would have been a sign of new physics; the updated measurement in 2022 agreed with the Standard Model.:cite[lhcb2023]

## Run a search

The figure below is the chapter's flagship, and it is a search done from start to finish, in simulation, with the course's own pipeline. It is a **toy**, and the toy's limits are stated in the panel.

A hypothetical heavy particle $Z'$, a cousin of the Z boson with a higher mass, decays to two muons. You choose its mass and its coupling to quarks and leptons (as a multiple $g$ of the Z's coupling, so $g = 1$ is the "sequential" $Z'$ of the literature). The library's generator makes proton–proton collisions at 13.6 TeV and produces $Z'$ events, at leading order and with the course's parton distributions (Chapter 13), together with the Drell–Yan background of $\gamma^*/Z \to \mu\mu$ in the same mass range. A selection requires two muons with $|\eta| < 2.4$ and $p_T > 30$ GeV, each found with 95 % efficiency, and the dimuon mass is smeared by a resolution that worsens with mass. The result is a mass spectrum, in which a $Z'$ of sufficient strength shows as a bump above the smoothly falling background. The statistics library then does what Chapter 28 described: it computes, at each mass, the :term[CLs]{id=cls} limit on the signal strength, and the exclusion plot on the right shows which couplings are excluded at 95 % confidence at each mass.

::search-sandbox{n="32.3" caption="A search for a hypothetical Z′ boson, simulated: not data. Left, the dimuon mass spectrum for the chosen luminosity: the Drell–Yan background (grey), the background plus a Z′ of the chosen mass and coupling (orange), and pseudo-data drawn from a seed (blue points). Right, the coupling limit against mass: the observed limit (blue), the limit expected if there is no Z′ (dashed, with a ±1σ band), and your choice (a marker). Try: (1) turn off 'The Z′ exists' and watch the observed limit follow the expected one; (2) switch it on with a coupling above the limit and watch the bump; (3) raise the luminosity from 140 to 3000 fb⁻¹ and see how slowly the reach in mass grows; (4) re-roll the data."}

Three things are worth seeing in it.

**The limit moves with the data.** With the Z′ switched off, the observed limit scatters around the expected one, sometimes better, sometimes worse. When a signal is there but too small to be a discovery, the observed limit is *weaker* than expected, at the mass of the signal: a limit is a statement about what the data allow, and a signal makes more of the parameter space allowed. A real analysis blinds itself (Chapter 28) so that it cannot choose its selection after seeing which way the fluctuation fell.

**Luminosity buys mass slowly.** At 1 TeV the background is large and the limit improves as the square root of the luminosity. At 5 TeV the expected background is a fraction of an event, and the limit on the number of signal events is about three whatever the luminosity, so the limit on the cross-section improves nearly in proportion to the luminosity. But the cross-section for a heavy particle falls so steeply with mass (the parton distributions fall steeply at large $x$) that, in this toy, a factor of 21 in luminosity, from 140 to 3000 fb⁻¹, moves the expected mass limit for a $Z'$ of the Z's own coupling only from about 5.0 to about 6.2 TeV.

```predict
q: 'In the sandbox at a Z′ mass of 5 TeV the expected background is a fraction of an event, and the limit on the cross-section is close to the 3-event Poisson limit. You raise the luminosity from 140 fb⁻¹ to 1400 fb⁻¹. By what factor does the limit on the signal cross-section improve?'
options:
  - text: About 3, the square root of 10.
    why: 'The square-root rule is for a background that grows with the luminosity, so that the signal has to stand out of a fluctuation of size √b. With essentially no background the limit is set by Poisson statistics of zero or few events, which does not improve with the size of the sample, only with the rate.'
  - text: Nearly 10, in proportion to the luminosity.
    correct: true
    why: 'With no background the 95 % limit on the number of signal events is about 3, whatever the luminosity, so the limit on the cross-section is 3 divided by (efficiency × luminosity) and scales as 1/L. The widget shows nearly that: at 5 TeV the expected limit falls by a factor of about 7, not quite 10, because a little background remains. At 1 TeV, where the background is large, the gain is only about 3, the square root of 10.'
  - text: 'Not at all: the limit is set by the background.'
    why: 'There is almost no background at this mass. At 1 TeV the limit is background-limited; at 5 TeV it is not.'
```

**What it leaves out.** A real search has other backgrounds (top-quark pairs, dibosons, jets mistaken for muons), systematic uncertainties on the muon efficiency and on the parton distributions, a detector that is not a Gaussian smearing, and an NNLO calculation of the Drell–Yan spectrum rather than leading order. It uses not one mass but a scan, with a look-elsewhere correction. And it would use the real detector simulation and reconstruction of the earlier chapters: the toy replaces them with a selection and a smearing, and the course's full chain (Chapter 29) could be put in its place at a cost in time. The *structure* is the same, and every search for new physics at the LHC has it: a signal model, a background model, a selection, a statistical test, and a limit.

### You write: the CLs value

The limit in the sandbox rests on one function, CLs of a counting experiment. Chapter 28 derived it; here is the chance to write it.

```code
id: cls-counting
title: CLs for a counting experiment
hook: analysis.cls
prompt: |
  Implement `cls(nObs, s, b)`: the CLs value for a counting experiment that observed `nObs` events with an expected signal `s` and an expected background `b`.
  $\mathrm{CL}_{s+b} = P(N \le n_\mathrm{obs} \mid s+b)$ and $\mathrm{CL}_b = P(N \le n_\mathrm{obs} \mid b)$ are cumulative Poisson probabilities; return their ratio.
  The signal strength is excluded at 95 % confidence if CLs < 0.05. The library's limit-setting code (`upperLimit`, the sandbox) uses this function through the hook, so
  your version changes the limits in the sandbox once you tick *use my code*.
starter: |
  export function cls(nObs: number, s: number, b: number): number {
    // CLs = P(N ≤ nObs | s + b) / P(N ≤ nObs | b), with N Poisson
    return 1;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { cls } from 'solution';

  test('with no events seen, CLs = exp(−s), whatever the background', () => {
    expect(cls(0, 3, 0)).toBeCloseTo(Math.exp(-3), 10);
    expect(cls(0, 3, 10)).toBeCloseTo(Math.exp(-3), 10);
    expect(cls(0, 2.9957, 4)).toBeCloseTo(0.05, 4);
  });

  test('the textbook case: b = 3, nObs = 3, the 95 % limit is s = 5.395', () => {
    expect(cls(3, 5.395, 3)).toBeCloseTo(0.05, 3);
    expect(cls(3, 8, 3)).toBeLessThan(0.05);
    expect(cls(3, 3, 3)).toBeGreaterThan(0.05);
  });

  test('a downward fluctuation does not exclude a signal the experiment could not see', () => {
    // b = 10 expected, nothing observed. A tiny signal: CLs+b is minuscule (so a plain p-value would "exclude" it), CLs is not.
    const v = cls(0, 0.1, 10);
    expect(v).toBeCloseTo(Math.exp(-0.1), 8);
    expect(v).toBeGreaterThan(0.9);
  });

  test('CLs falls as the signal grows, and is 1 for no signal', () => {
    expect(cls(5, 0, 4)).toBeCloseTo(1, 12);
    let prev = 1;
    for (const s of [0.5, 1, 2, 4, 8, 16]) {
      const v = cls(5, s, 4);
      expect(v).toBeLessThan(prev);
      prev = v;
    }
  });

  test('a large excess leaves a large signal allowed', () => {
    expect(cls(30, 20, 10)).toBeGreaterThan(0.2);
    expect(cls(30, 40, 10)).toBeLessThan(0.05);
  });
solution: |
  function poissonCdf(k: number, mu: number): number {
    let term = Math.exp(-mu);
    let sum = term;
    for (let i = 1; i <= k; i++) {
      term *= mu / i;
      sum += term;
    }
    return Math.min(1, sum);
  }

  export function cls(nObs: number, s: number, b: number): number {
    const clsb = poissonCdf(nObs, s + b);
    const clb = poissonCdf(nObs, b);
    return clb > 0 ? clsb / clb : 0;
  }
hints:
  - 'The cumulative Poisson probability P(N ≤ k | μ) is the sum over i from 0 to k of e^(−μ) μ^i / i!. Build the terms by multiplying the last one by μ/i.'
  - 'CLs is the ratio of two such sums, one with mean s + b and one with mean b.'
```

## Unification and the proton

The third reason for expecting something beyond the Standard Model is its structure. It has three forces with three couplings, and gauge groups $\mathrm{U}(1)$, $\mathrm{SU}(2)$ and $\mathrm{SU}(3)$ (Chapter 17) that look as if they could be the pieces of one larger group. The first :term[grand unified theory]{id=grand-unification}, by Howard Georgi and Sheldon Glashow in 1974, put the three groups into $\mathrm{SU}(5)$, in which a single multiplet holds the quarks and leptons of one generation: quarks and leptons are different faces of one thing, so they can turn into one another.:cite[georgi1974] The couplings would then be equal at a high scale, and run apart at low energies.

The running is a calculation of Chapter 18's kind: the strong coupling falls with energy, the others do not, and each follows a simple equation at one loop. Figure 32.2 shows the result. In the Standard Model the three do not meet at a point. They come close, and the nearest approach in this one-loop toy is at about $2 \times 10^{14}$ GeV. With superpartners at the TeV scale, the lines meet at about $2 \times 10^{16}$ GeV, which is a part of the case for supersymmetry, although the argument is not as sharp as it first looked (the three do not meet *exactly* once thresholds and two loops are included, and the details depend on unknown particles near the unification scale).

Unification predicts something that can be tested: since a quark can turn into a lepton, :term[the proton can decay]{id=proton-decay}, for example to a positron and a neutral pion, $p \to e^+\pi^0$, through the exchange of a very heavy gauge boson. The lifetime scales as the fourth power of that boson's mass, so unification at $10^{16}$ GeV gives a lifetime of the order of $10^{35}$ years, and the minimal $\mathrm{SU}(5)$ model, whose unification scale is lower, predicted a much shorter one, which the large underground detectors built to test it excluded. The Super-Kamiokande detector (Chapter 31) is also the best proton-decay detector: 22,500 tonnes of water contain $7.5 \times 10^{33}$ protons, and with 450 kilotonne-years of data it saw no excess of candidates over the expected background. Its limit on the partial lifetime is $\tau/B(p \to e^+\pi^0) > 2.4 \times 10^{34}$ years at 90 % confidence.:cite[superk2020]

```fermi
id: proton-decay-rate
title: How many proton decays per year?
prompt: 'Super-Kamiokande contains 22.5 kilotonnes of water (H₂O, 18 g/mol; each molecule has 10 protons, counting those in the nuclei; Avogadro 6.02 × 10²³ per mole). If the proton decayed with a mean life of 10³⁴ years, how many decays per year would occur in the tank?'
answer: 0.75
unit: per year
factor: 3
hints:
  - 'Moles of water: 22.5 × 10⁹ g / 18 g/mol = 1.25 × 10⁹ mol. Multiply by Avogadro and by 10 protons per molecule.'
  - 'Divide by the lifetime, 10³⁴ years.'
explain: '22.5 × 10⁹ g / 18 g/mol = 1.25 × 10⁹ mol of water, which is 7.5 × 10³² molecules and 7.5 × 10³³ protons. With a mean life of 10³⁴ years the rate is 7.5 × 10³³ / 10³⁴ = 0.75 decays per year. So a tank of this size watching for a couple of decades can test lifetimes of order 10³⁴ to 10³⁵ years, a thousand million billion times the age of the universe, because the tank has so many protons. (Only decays to detectable final states and with the right kinematics count, and the detection efficiency is below one; the quoted limit takes these into account.)'
```

## Gravity

The Standard Model has no gravity. The force of gravity between two protons is $8 \times 10^{-37}$ of their electric repulsion, which is why particle physics can ignore it. At the Planck energy of $10^{19}$ GeV, the scale of Chapter 1, the ratio reaches one and a quantum theory of gravity is needed. No such theory has been tested. String theory is the best developed candidate, and its predictions are at energies far above any accelerator.

There was a hope that gravity might be strong at much lower energies if extra spatial dimensions exist, so that it could show up at the LHC as missing energy or as microscopic black holes. The searches for these signals at ATLAS and CMS have found nothing. The gravitational waves that LIGO detected from 2015 are classical waves of general relativity, not evidence for quantum gravity. A single graviton is far beyond any detector that can be built. The [gravitational-wave chapter](/astrophysics/ch/gravitational-waves/) of the astrophysics course tells that story.

## The muon g − 2

Back to the episode that opened the chapter. The muon has a magnetic moment, which makes it behave as a tiny bar magnet: in a magnetic field its spin precesses. For a pointlike particle with spin ½ the Dirac equation (Chapter 9) predicts that the ratio of the magnetic moment to the spin, in natural units, is $g = 2$. The measured value differs from 2 by a small amount, because the muon is surrounded by virtual particles (Chapters 14 to 16): Schwinger's first correction was $\alpha/2\pi$, the 0.00116 in the :term[anomalous magnetic moment]{id=anomalous-magnetic-moment} $a_\mu = (g-2)/2$. The same quantity for the electron has been measured and calculated to more than ten digits, and agrees. The muon is heavier, which makes it far more sensitive (by roughly $(m_\mu/m_e)^2 \approx 43{,}000$) to heavy particles in the loops, and that is the reason to measure it: if there are particles that nobody has seen, the muon would feel them first.

The measurement works as follows. Muons are injected into a ring with a precisely uniform magnetic field, where they circulate with a *cyclotron* frequency; their spins precess at a slightly different frequency, and the **difference** between the two is proportional to $a_\mu$:

$$\omega_a = a_\mu \frac{e B}{m_\mu}.$$

The muon decays to a positron that is emitted preferentially in the direction of the spin (a consequence of the parity violation of Chapter 22), so counting positrons above an energy threshold, as a function of time, gives a number that oscillates at $\omega_a$, on an exponential decay. The electric field needed to focus the beam would disturb the precession, except at one momentum, the :term[magic momentum]{id=magic-momentum}, at which $\gamma^2 = 1 + 1/a_\mu$, so that $\gamma = 29.3$ and $p = 3.094$ GeV. At that energy the muons live 64 µs, as time dilation (Chapter 10) makes them.

```numeric
id: magic-momentum
title: The magic momentum
prompt: 'At the magic momentum the electric focusing field does not affect the spin precession. The condition is a_μ = 1/(γ² − 1), which means that γβ = 1/√a_μ. With a_μ = 0.00116592 and m_μ = 0.10566 GeV, what is the momentum p = γβ m_μ in GeV?'
answer: 3.094
unit: GeV
tolerance: 0.005
hints:
  - 'γβ = 1/√0.00116592 = 29.29.'
  - 'Multiply by 0.10566 GeV.'
explain: 'γβ = 1/√0.00116592 = 29.29, so p = 29.29 × 0.10566 GeV = 3.094 GeV. The Lorentz factor itself is γ = √(1 + 1/a_μ) = 29.30, so the muon lifetime in the lab is 29.30 × 2.197 µs = 64.4 µs, long enough for the muons to circle the ring hundreds of times.'
```

:::history{year=2025 title="A crack that closed" people="Muon g − 2 collaborations at Brookhaven and Fermilab; the Muon g − 2 Theory Initiative" source="Sources: Bennett et al. (2006); Abi et al. (2021); the Muon g − 2 Collaboration (2025); Aliberti et al. (2025); Aoyama et al. (2020)."}
The first experiment used a ring at Brookhaven National Laboratory, with data from 1997 to 2001, and its final result in 2006 differed from the Standard Model prediction by about three standard deviations.:cite[bennett2006] The ring was moved in 2013 to Fermilab, where a new experiment, with more muons and a better knowledge of the field, published a first result in 2021 that agreed with Brookhaven's, and, combined with it, differed from the prediction of the Muon g − 2 Theory Initiative's 2020 white paper by 4.2 standard deviations.:cite[abi2021,aoyama2020]

The Fermilab experiment's final result came on 3 June 2025, from six years of data: $a_\mu = 116\,592\,0705(148) \times 10^{-12}$, a precision of 127 parts per billion, better than its design goal, and an experimental world average of $116\,592\,0715(145) \times 10^{-12}$.:cite[gm2final]

The prediction changed in the same year. The largest uncertainty in the theory is the contribution of virtual hadrons (the "hadronic vacuum polarisation"), which the 2020 white paper obtained from measurements of $e^+e^- \to$ hadrons through a dispersion relation, the cross-section ratio $R$ of Chapter 16. A lattice QCD calculation (Chapter 18) can instead compute the same quantity from first principles, and from 2021 the lattice results from several groups gave larger values, closer to the experiment.:cite[borsanyi2021] Meanwhile, a new $e^+e^-$ measurement by the CMD-3 experiment in Novosibirsk disagreed with the older ones that the data-driven prediction relied on.:cite[cmd32023] The 2025 white paper adopted the lattice calculations, giving $a_\mu = 116\,592\,033(62) \times 10^{-11}$, which agrees with the measurement.:cite[aliberti2025] The $e^+e^-$ data are in tension among themselves, and that internal disagreement is still being studied.
:::

::g-minus-2{n="32.4" caption="Published values of the muon's anomalous magnetic moment, a_μ = (g − 2)/2, as the difference from 116 592 000 in units of 10⁻¹¹, with one-standard-deviation error bars. Circles are measurements, squares are predictions. Choose a measurement and a prediction below the plot: the number of standard deviations between them is computed with the two uncertainties added in quadrature (our arithmetic, not a quoted significance). The final result against the 2020 prediction is more than five standard deviations; against the 2025 prediction it is less than one."}

What the episode shows is not that the muon g − 2 will never reveal new physics. It means that a discrepancy between a measurement and a theoretical prediction is only as good as the prediction, and a prediction with a complicated nonperturbative input is a model that can be wrong. Experiment and theory are tested together. In our terms (the *systematic uncertainty is a model that might be wrong*, Chapter 28), a five-sigma disagreement told us that one of the two had an error, not which. For now the best-measured number in the history of the muon matches the Standard Model's best calculation of it to better than one standard deviation.

## Where next

The question that every part of this chapter ends with is the same: where to look. Three kinds of facility answer it.

- **The LHC itself.** The High-Luminosity LHC upgrade (Chapter 21), planned to collect ten times the data of the whole LHC to date, will improve the sensitivity to rare processes and to heavy particles coupled weakly, and will measure the Higgs boson's couplings and, perhaps, its self-coupling (Chapter 30). It will not much extend the reach in mass.
- **A new collider.** The proposal furthest advanced at CERN is the Future Circular Collider: an electron–positron collider in a new tunnel of about 91 km, as a "Higgs and electroweak factory" (measuring the Higgs boson and the Z, W and top quark far more precisely than before), and later, in the same tunnel, a proton collider at a much higher energy. A feasibility study was completed in 2025, and on 22 May 2026 the CERN Council adopted an update of the European Strategy for Particle Physics that names the electron–positron stage as the preferred next flagship project; its construction depends on funding decisions that have not been taken.:cite[eustrategy] Other options under study elsewhere include linear electron–positron colliders and a muon collider.
- **Experiments that are not colliders.** Neutrino beams and detectors (Chapter 31), underground dark-matter detectors, precision measurements such as the electric dipole moment of the neutron and the g − 2 of the muon, searches for rare decays, and observations of the sky. Several of the strongest limits in this chapter came from them.

Nobody knows which of these will see something first. The Standard Model has been tested so far, and for so long, that a new particle at a scale the LHC can reach would no longer be a surprise only to those who had stopped believing the argument for it. The honest summary is the one in the table at the start of the chapter: there are things the theory leaves out, and no unambiguous sign of what lies beyond.

## Under the hood, and in the experiments

:::programmer
A search for new physics is a hypothesis test with the properties of a good test suite. The *signal model* is the specification; the *background model* is the baseline; a *blinded* analysis is a held-out test set; the *look-elsewhere effect* is multiple comparisons; and an upper limit is the answer to "what is the largest effect this test could have missed?" The sandbox reports that last number. A limit from a search with a downward fluctuation of the data should be as good as one from a fluctuation upwards, and the CLs prescription is a way to make sure it is not better: a limit better than the experiment's sensitivity would be a claim of power that the test does not have.
:::

:::hood[The sandbox's model of a search]
The sandbox builds a `CountingModel` (the type of `hep/analysis`): the expected signal for $\mu = 1$ in each mass bin, the expected background, and an optional relative uncertainty on the background normalisation. The signal histogram is one template, made once per mass from 1,500 generated events with a fixed seed. The signal strength $\mu = g^2$ scales the template, which uses the fact that the cross-section for a narrow $Z'$ grows as the square of the coupling: the same events are used for any $g$. The limits come from `upperLimit` and `clsModel`, the asymptotic formulae of Cowan, Cranmer, Gross and Vitells.

```ts
export function makeModel(t: SignalTemplate, bkg: Background, lumiFb: number, relUnc: number): CountingModel {
  const lumiPb = lumiFb * 1000;
  return {
    signal: t.fractions.map((f) => f * t.sigmaPb * lumiPb),
    background: bkg.counts(lumiPb),
    ...(relUnc > 0 ? { nuisance: { name: 'bkg', relUnc } } : {}),
  };
}
```

The background template is built once from thirty slices of the Drell–Yan spectrum between 300 GeV and 7 TeV, each with its own cross-section from the generator and an acceptance from its own generated events, and interpolated between slice centres (linear in $\ln m$ and $\ln \mathrm{d}\sigma/\mathrm{d}m$) onto the analysis bins. The expected limit, the dashed line, uses the **Asimov data set**: the data are replaced by their expectation under the background-only hypothesis, so that no random numbers are needed to say what the experiment *would* achieve.
:::

:::experiments
**ATLAS** and **CMS** do the same in a more elaborate way. The expected background is not simulated alone: it is **estimated from data** in control regions that have the same physics as the signal region but are free of signal, with the simulation used to extrapolate; the full likelihood has hundreds of nuisance parameters for the systematic uncertainties. The statistical models are described in standard formats (the HistFactory and RooStats frameworks inside ROOT, and a pure-Python implementation of HistFactory, `pyhf`), and both collaborations publish numerical results, and for some analyses the full likelihoods, on HEPData, a public database, so that theorists can test their own models against a search without access to the detector (a "reinterpretation"). Dedicated groups also search without a model, looking for any deviation in any final state, and use machine learning to look for unusual events. The course's sandbox has the same logical structure and none of the data or detector.
:::

## What comes next

[Chapter 33](/chapters/particle-physics-in-the-world/) leaves the questions of the universe for the uses of the field: the medical scanners and cancer treatments that came from detectors and accelerators, the cosmic-ray muons that have found a void in a pyramid, and the invention at CERN that most people use every day.

## Further reading

- The Particle Data Group's reviews of dark matter, supersymmetry, grand unification and the muon's anomalous magnetic moment, in the *Review of Particle Physics* (:cite[pdg2024]).
- The Fermilab final result and the Theory Initiative's 2025 update (:cite[gm2final,aliberti2025]).
- Sakharov's 1967 paper (:cite[sakharov1967]) and the Planck results for the cosmological numbers (:cite[planck2018]).
- The astrophysics course on [galactic dynamics](/astrophysics/ch/galactic-dynamics/), the [microwave background](/astrophysics/ch/cmb/) and [the big bang](/astrophysics/ch/big-bang/).
