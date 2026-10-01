---
number: 16
title: QED
summary: The first cross-section of the course, σ(e⁺e⁻ → μ⁺μ⁻) = 4πα²/3s with its 1 + cos²θ angular distribution, derived with helicity amplitudes and measured on a virtual collider. Then Bhabha scattering, the electron's magnetic moment, the running of α, and the R ratio that counts three colours of quark.
duration: About 3 hours
prerequisites: [feynman-diagrams]
---

An electron and a positron, colliding head-on with a total energy of 10 GeV, have a probability of turning into a pair of muons that quantum electrodynamics gives as a number: 0.8685 nanobarns. Double the energy and it is four times smaller. The prediction needs one diagram, one coupling constant and no fitted parameter, and measurements at electron–positron colliders agree with it (with one exception that Chapter 23 explains, the Z boson).

This chapter computes that number, and the shape of the angular distribution that goes with it. It then shows the collider that measures both, in simulation, and uses the same theory to explain three things that look unrelated: the electron's magnetic moment, the strength of the electromagnetic force changing with energy, and the fact that quarks come in three colours.

## One diagram, one cross-section

Figure 15.1's diagram is e⁺e⁻ → γ* → μ⁺μ⁻: the pair annihilates into a virtual photon (Chapter 14 says what that means), which makes a pair of muons. At centre-of-mass energies well above the muon mass, 0.1057 GeV, the masses can be ignored. The amplitude, written in Chapter 15, has two currents joined by a photon propagator 1/*s*. The cross-section needs two more inputs. The first is the flux of incoming particles. The second is the phase space of the two outgoing particles, which for massless particles in the centre-of-mass frame gives, for the differential cross-section per unit solid angle,

:::equation{#dsigma caption="The differential cross-section of a two-body process with massless particles in the centre-of-mass frame."}
$$\frac{d\sigma}{d\Omega} = \frac{\term{M2}{\overline{|\mathcal M|^2}}}{64\pi^2\,\term{s}{s}}$$

```terms
M2:
  label: '|M|², the squared amplitude'
  what: The squared modulus of the amplitude of Chapter 15, summed over the spin states of the final particles and averaged over those of the initial ones.
  why: 'It carries all the dynamics: the couplings, the propagator and the spins. The rest of the formula is kinematics (flux and phase space).'
  effect: For e⁺e⁻ → μ⁺μ⁻ it is e⁴(1 + cos²θ), where e² = 4πα.
s:
  label: 's, the squared centre-of-mass energy'
  what: s = (p₁ + p₂)² = E_cm², the invariant introduced in Chapter 2. For two beams of energy E each, s = 4E².
  why: It is the only energy scale of a massless process. The flux, the phase space and the propagator each contribute a power of it.
  effect: The cross-section has dimensions of GeV⁻², so with s the only scale it must be proportional to 1/s.
```
:::

Here $\overline{|\mathcal M|^2}$ is the squared amplitude, averaged over the four spin states of the incoming pair and summed over those of the outgoing pair. What remains is to compute it.

The result, derived below with helicity amplitudes, is

:::equation{#result caption="The tree-level QED cross-section of e⁺e⁻ → μ⁺μ⁻, for massless leptons."}
$$\frac{d\sigma}{d\Omega} = \frac{\term{alpha}{\alpha}^2}{4\,\term{s2}{s}}\,\bigl(1 + \term{cos}{\cos^2\theta}\bigr), \qquad \sigma = \frac{4\pi\alpha^2}{3s} = \frac{86.8\ \text{nb}}{s\,[\text{GeV}^2]}$$

```terms
s2:
  label: 's, the squared centre-of-mass energy'
  what: The same invariant as in the previous equation, s = (p₁ + p₂)² = E_cm².
  why: It is the only energy scale of the process, so the cross-section must fall as 1/s.
  effect: At double the energy the cross-section is a quarter.
alpha:
  label: 'α, the fine-structure constant'
  what: The electromagnetic coupling, α = e²/4π = 1/137.036 at low energy. It is the strength of the coupling of a charged particle to the photon.
  why: Each of the two vertices contributes a factor e to the amplitude, so the cross-section has e⁴ = (4πα)², that is α².
  effect: A theory with a coupling twice as strong would have four times the cross-section. At the high energies of Chapter 23 the value of α to use changes (see "A coupling that runs" below).
cos:
  label: 'θ, the angle of the μ⁻ to the e⁻ beam'
  what: The polar angle of the outgoing muon, measured from the direction of the incoming electron.
  why: 'The 1 + cos²θ is the signature of the spin of the particles: it is what a spin-½ fermion pair produced through a spin-1 photon gives.'
  effect: 'The distribution is symmetric in cos θ: as many muons go forward as backward. It is lowest at 90° and twice as large along the beam.'
```
:::

The second form uses $\int(1+\cos^2\theta)\,d\Omega = 16\pi/3$. The numerical form follows from α = 1/137.036 and ħ*c* = 0.19733 GeV·fm: 4πα²/3 = 2.2306 × 10⁻⁴, and (ħ*c*)² = 0.38938 GeV²·mb, so σ = 2.2306 × 10⁻⁴ × 0.38938 mb/*s* = 86.85 nb/*s*, with *s* in GeV². The course's `hep/sm` computes it as `sigmaMuMuQedNb`. Three of its values:

| √*s* | σ(e⁺e⁻ → μ⁺μ⁻), photon exchange | Comment |
|---|---|---|
| 10 GeV | 0.8685 nb = 868.5 pb | |
| 30 GeV | 96.5 pb | an energy reached by the PETRA collider of Chapter 18 |
| 91.19 GeV | 10.4 pb | photon exchange alone: the real value at the Z mass is about 190 times larger (Chapter 23) |

The last line is a warning. The formula holds in a world with only photon exchange, and our world has other vector bosons. At 91 GeV the Z boson's propagator becomes almost singular and the cross-section rises to about 2 nb.

```fermi
id: qed-rate-per-hour
title: Muon pairs per hour
prompt: 'A collider with a luminosity of 10³¹ cm⁻² s⁻¹ (a value chosen for the estimate) runs at √s = 10 GeV. Using σ = 86.8 nb/s[GeV²] and 1 nb = 10⁻³³ cm², about how many μ⁺μ⁻ pairs does it produce in one hour?'
answer: 31.3
unit: per hour
factor: 3
hints:
  - σ(10 GeV) = 86.8/100 nb = 0.868 nb = 8.68 × 10⁻³⁴ cm².
  - The rate is L × σ (Chapter 3), and an hour is 3600 s.
explain: "Rate = L σ = 10³¹ cm⁻² s⁻¹ × 8.68 × 10⁻³⁴ cm² = 8.7 × 10⁻³ s⁻¹, so 31 pairs an hour, or about 750 a day. Muon pairs are rare in absolute terms, which is why e⁺e⁻ colliders needed years to gather their samples and why the luminosity, a subject of Part V, is the figure of merit of a machine."
```

```predict
q: 'A muon pair is produced in an e⁺e⁻ annihilation at 10 GeV. Measured from the direction of the incoming electron, in which directions do the muons go?'
options:
  - text: 'Equally in every direction: a virtual photon has no memory of the beams.'
    why: 'The photon has spin 1 and the fermions are massless, so helicity is conserved at each vertex. That forces the spin of the photon to lie along the beam axis and gives the pair a direction. The distribution is not isotropic.'
  - text: Mostly at 90° to the beams, because the electron and positron annihilate at rest.
    why: 'The pair does not annihilate “at rest”: it collides at high energy. The distribution has its minimum at 90°, not its maximum.'
  - text: Preferentially along the beam axis, forward and backward equally often, as 1 + cos²θ.
    correct: true
    why: 'That is the result of the calculation below. It is twice as likely along the beam line as at 90°, and symmetric between the two directions. The symmetry breaks only when the Z boson is added, which gives forward–backward asymmetry (Chapter 23).'
```

:::deeper[Deriving 1 + cos²θ with helicity amplitudes]
The approach uses the spin directly and avoids the trace of four Dirac matrices that most textbooks use. Take all four fermions massless, and work in the centre-of-mass frame with the e⁻ along +*z* and the μ⁻ at angle θ to it in the *x*–*z* plane.

**Step 1: helicity selection.** The vertex is ψ̄γ<sup>μ</sup>ψ, which for a massless fermion splits into a left-handed and a right-handed part that do not mix. Consequently the electron and the positron must have *opposite* helicities (e⁻<sub>R</sub>e⁺<sub>L</sub> or e⁻<sub>L</sub>e⁺<sub>R</sub>): their spins point the same way along the beam, total *J*<sub>*z*</sub> = ±1, which is the spin of the photon. The same holds for the muon pair. Of the 16 combinations of helicities, four have a non-zero amplitude: two initial times two final.

**Step 2: the amplitude is a product of two currents.** With the propagator 1/*s*,

$$\mathcal M = \frac{e^2}{s}\,J_e\cdot J_\mu, \qquad J_e^\mu = \bar v(p_2)\gamma^\mu u(p_1),\quad J_\mu^\mu = \bar u(k_1)\gamma^\mu v(k_2).$$

Multiplying the two-component spinors (in the chiral basis the electron current for e⁻<sub>R</sub>e⁺<sub>L</sub> reduces to a 2×2 sandwich $v^\dagger\sigma^\mu u$), the current for the electron pair along ±*z* is

$$J_e = -\sqrt{s}\,(0,\;1,\;i,\;0).$$

Its components along *x* and *y* form the combination (1, *i*), which is the polarisation of a spin-1 object with *J*<sub>*z*</sub> = +1: the virtual photon inherits the spin of the pair.

**Step 3: the muon current.** For μ⁻<sub>R</sub>μ⁺<sub>L</sub> along the *z* axis the same calculation gives $-\sqrt s\,(0,1,-i,0)$. For the direction at angle θ, rotate that vector about the *y* axis:

$$J_\mu = -\sqrt{s}\,(0,\;\cos\theta,\;-i,\;-\sin\theta).$$

The other final helicity, μ⁻<sub>L</sub>μ⁺<sub>R</sub>, has $+i$ in place of $-i$.

**Step 4: contract.** With the metric (+, −, −, −), $J_e\cdot J_\mu = -(J_e^xJ_\mu^x + J_e^yJ_\mu^y + J_e^zJ_\mu^z)$. For the first case this is $-s\,(\cos\theta + i\cdot(-i)) = -s(1+\cos\theta)$; for the other final helicity it is $-s\,(\cos\theta - 1) = s\,(1-\cos\theta)$. Hence, with $e^2/s$ in front,

| initial | final | $|\mathcal M|$ |
|---|---|---|
| e⁻<sub>R</sub> e⁺<sub>L</sub> | μ⁻<sub>R</sub> μ⁺<sub>L</sub> | $e^2(1+\cos\theta)$ |
| e⁻<sub>R</sub> e⁺<sub>L</sub> | μ⁻<sub>L</sub> μ⁺<sub>R</sub> | $e^2(1-\cos\theta)$ |
| e⁻<sub>L</sub> e⁺<sub>R</sub> | μ⁻<sub>R</sub> μ⁺<sub>L</sub> | $e^2(1-\cos\theta)$ |
| e⁻<sub>L</sub> e⁺<sub>R</sub> | μ⁻<sub>L</sub> μ⁺<sub>R</sub> | $e^2(1+\cos\theta)$ |

The factors $(1\pm\cos\theta)/2$ are the rotation functions $d^1_{11}$ and $d^1_{1,-1}$ of a spin-1 state. They are also what angular-momentum conservation requires: when the electron and muon have the same handedness, a muon that goes backwards (θ = π) would need the photon's spin along *z* to flip, and the amplitude vanishes there.

**Step 5: square, add, average.** $\sum|\mathcal M|^2 = 2e^4[(1+\cos\theta)^2 + (1-\cos\theta)^2] = 4e^4(1+\cos^2\theta)$. Averaging over the four initial helicity states divides by four: $\overline{|\mathcal M|^2} = e^4(1+\cos^2\theta)$. With $e^2 = 4\pi\alpha$ and the formula for dσ/dΩ above,

$$\frac{d\sigma}{d\Omega} = \frac{16\pi^2\alpha^2(1+\cos^2\theta)}{64\pi^2 s} = \frac{\alpha^2}{4s}(1+\cos^2\theta),\qquad \sigma = \frac{\alpha^2}{4s}\cdot\frac{16\pi}{3} = \frac{4\pi\alpha^2}{3s}.$$

**Checks.** The course's test suite repeats the calculation with explicit Dirac spinors for all 16 helicity configurations, finds exactly four non-zero amplitudes with the moduli in the table, their squares summing to $4e^4(1+\cos^2\theta)$, and compares $2\pi\,d\sigma/d\Omega$ with the library's `ee2mumuDiffXsec`. The same angular factors would come out of the textbook calculation with traces; helicities make it visible that the shape comes from spin. A scalar mediator would give $\sin^2\theta$; spin ½ with a spin-1 photon gives $1+\cos^2\theta$.
:::

## The virtual collider

The figure below simulates an e⁺e⁻ collider using the course's generator: the matrix element of the derivation, with seeded random numbers. Choose a final state and an energy. The machine runs for an integrated luminosity, the number of collisions is a Poisson random number with mean σ*L*, and each collision gets an angle from the differential cross-section. You then do what an experimenter does with the counts: divide by the luminosity to get a cross-section, histogram the angles, and compare with theory.

::ee-collider{n="16.1" caption="A virtual e⁺e⁻ collider. The events are generated by hep/gen (hard process only, so the figure shows the angles and the rates, not the showers that come in Chapter 18). The detector is perfect: every event is seen. The 'data' are therefore simulated, not measured. On the left, the angular distribution of the outgoing μ⁻ with the curve (3/8)(1 + cos²θ); on the right, σ against √s for the chosen final state with the point cross-section 4πα²/3s dashed. The Z switch adds the Z boson's exchange (Chapter 23). The second tab, below, scans the energy to extract R."}

Things to try:

1. **Final state μ⁺μ⁻, √s = 10 GeV, luminosity 20 pb⁻¹.** About 17,000 events. The measured σ = *N*/*L* lies within its error of 0.8685 nb; the angular histogram follows 1 + cos²θ; the forward–backward asymmetry A<sub>FB</sub> = (N<sub>F</sub> − N<sub>B</sub>)/(N<sub>F</sub> + N<sub>B</sub>), which counts muons with cos θ > 0 against those with cos θ < 0, is zero within its error.
2. **Double the energy.** σ falls to a quarter, as 1/*s*: on the logarithmic plot the cross-section is a straight line of slope −2.
3. **Reduce the luminosity** to 0.1 pb⁻¹ and watch the error bars grow as 1/√*N*: a cross-section measured from *N* events has a relative uncertainty of 1/√*N* (Poisson statistics, Chapter 3).
4. **Switch to quarks.** At 10 GeV the cross-section is 3.6 times that of muon pairs; the angular distribution is the same (quarks, too, have spin ½). Section "R and the colours" explains the factor.
5. **Switch on the Z, and move to √s = 91 GeV.** The cross-section jumps by a factor of about 190. The forward–backward asymmetry is small on the peak itself (about 0.016 in the library's model) but large just beside it: about −0.3 at 88 GeV and +0.3 at 95 GeV.

:::equation{#counts caption="A cross-section from counting: the first stage of the course's analysis."}
$$\hat\sigma = \frac{\term{N}{N}}{\term{L}{L}\,\term{eps}{\varepsilon}} \;\pm\; \frac{\sqrt N}{L\,\varepsilon}$$

```terms
N:
  label: 'N, the number of events counted'
  what: How many events of the wanted kind were recorded in the run.
  why: The number of collisions of a rare process in a fixed time is a Poisson random variable, with variance equal to its mean, so its uncertainty is √N.
  effect: A hundred times more events means ten times smaller relative error.
L:
  label: 'L, the integrated luminosity'
  what: The integral of the instantaneous luminosity over the run, in inverse cross-section units (pb⁻¹ = events per pb of cross-section).
  why: 'It is the conversion between a count and a cross-section: the expected count is σ L ε.'
  effect: Luminosity is the machine's contribution (Part V); cross-section is the theory's.
eps:
  label: 'ε, the efficiency'
  what: The fraction of events of this kind that the detector, the trigger and the selection record and keep.
  why: Not every event is seen. Without the correction the measured cross-section is too small by the factor ε.
  effect: The virtual collider has ε = 1 by construction. In a real experiment ε is measured, from simulation and from data, and its uncertainty is one of the main systematic errors (Chapter 28).
```
:::

```numeric
id: qed-count-error
title: The precision of a count
prompt: 'The virtual collider records 17,000 muon pairs. What is the relative statistical uncertainty on the cross-section, 1/√N, in per cent?'
answer: 0.767
unit: '%'
tolerance: 0.02
hints:
  - 1/√17000 = 1/130.4.
explain: "1/√17000 = 0.00767, or 0.77 %. To reach a statistical precision of 0.1 % needs a million events. That is the scale of the samples the LEP experiments collected on the Z peak, and the reason the systematic uncertainties, not the statistical ones, limit the most precise results (Chapters 23 and 28)."
```

### Write the differential cross-section

```code
id: qed-dsigma
title: The differential cross-section of e⁺e⁻ → μ⁺μ⁻
hook: gen.dsigmaEeMuMu
prompt: |
  Implement `dsigmaEeMuMu(s, cosTheta)`, the tree-level differential cross-section of e⁺e⁻ → μ⁺μ⁻ through a photon, per unit cos θ, in GeV⁻²:

  $$\frac{d\sigma}{d\cos\theta} = \frac{\pi\alpha^2}{2s}\,(1+\cos^2\theta),$$

  that is $2\pi\,d\sigma/d\Omega$ from the derivation above. Take α from `ALPHA_0` in `hep/sm` (1/137.036). The generator's process `ee->mumu-qed` calls the function to draw the angle of every muon and to integrate the cross-section, so once your function passes, *use my code* makes your formula drive the virtual collider.
starter: |
  import { ALPHA_0 } from 'hep/sm';

  /** dσ/dcosθ in GeV⁻² for s = E_cm² in GeV². */
  export function dsigmaEeMuMu(s: number, cosTheta: number): number {
    // π α² (1 + cos²θ) / (2 s)
    return 0;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { dsigmaEeMuMu } from 'solution';
  import { ALPHA_0 } from 'hep/sm';
  import { crossSection, getProcess } from 'hep/gen';
  import { rng } from 'hep/random';
  import { hooks } from 'hep';

  test('matches the closed form at several points', () => {
    for (const [s, c] of [[100, 0], [100, 0.5], [25, -0.8], [8317, 1]] as const) {
      const want = (Math.PI * ALPHA_0 * ALPHA_0 * (1 + c * c)) / (2 * s);
      expect(dsigmaEeMuMu(s, c)).toBeCloseTo(want, 14);
    }
  });

  test('forward–backward symmetric, and twice as large along the beam as at 90°', () => {
    expect(dsigmaEeMuMu(50, 0.7)).toBeCloseTo(dsigmaEeMuMu(50, -0.7), 15);
    expect(dsigmaEeMuMu(50, 1) / dsigmaEeMuMu(50, 0)).toBeCloseTo(2, 12);
  });

  test('falls as 1/s', () => {
    expect(dsigmaEeMuMu(400, 0.3) / dsigmaEeMuMu(100, 0.3)).toBeCloseTo(0.25, 12);
  });

  test('its integral over cos θ is 4πα²/3s', () => {
    const s = 100;
    const n = 2000;
    let acc = 0;
    for (let i = 0; i < n; i++) acc += dsigmaEeMuMu(s, -1 + (2 * (i + 0.5)) / n) * (2 / n);
    expect(acc).toBeCloseTo((4 * Math.PI * ALPHA_0 * ALPHA_0) / (3 * s), 12);
  });

  test('used by the generator, the Monte Carlo cross-section agrees with the closed form', () => {
    hooks.setOverride('gen.dsigmaEeMuMu', dsigmaEeMuMu);
    try {
      const cs = crossSection(getProcess('ee->mumu-qed'), 10, 20000, rng(3));
      expect(Math.abs(cs.pull ?? 99)).toBeLessThan(4);
    } finally {
      hooks.setOverride('gen.dsigmaEeMuMu', undefined);
    }
  });
solution: |
  import { ALPHA_0 } from 'hep/sm';

  export function dsigmaEeMuMu(s: number, cosTheta: number): number {
    return (Math.PI * ALPHA_0 * ALPHA_0 * (1 + cosTheta * cosTheta)) / (2 * s);
  }
hints:
  - 'The formula is in the prompt. Watch the units: s is in GeV², α is dimensionless, and the result is in GeV⁻².'
  - 'A common slip is to write 4πα²/3s (the total) instead of the differential cross-section, or α/4s without the factor 2π (which belongs to dΩ → dcosθ).'
```

## Bhabha scattering: two diagrams that interfere

The process e⁺e⁻ → e⁺e⁻ has the same initial and final state, so it gets a second diagram: the electron and positron can exchange a photon and be deflected, instead of annihilating. The first is the s-channel, the second the t-channel, in the notation of Chapter 15 where *t* = (*p*<sub>1</sub> − *k*<sub>1</sub>)². Homi Bhabha calculated it in 1936.:cite[p4-bhabha1936] With massless electrons, the cross-section is

$$\frac{d\sigma}{d\cos\theta} = \frac{\pi\alpha^2}{s}\left[\frac{t^2+u^2}{s^2} + \frac{s^2+u^2}{t^2} + \frac{2u^2}{st}\right],\qquad t = -\tfrac{s}{2}(1-\cos\theta),\quad u = -\tfrac{s}{2}(1+\cos\theta).$$

The three terms are the s-channel squared, the t-channel squared and their interference. The first is exactly the e⁺e⁻ → μ⁺μ⁻ shape, (1 + cos²θ)/2 in units of πα²/*s*; the course's tests check this, and that the three add up to the library's `bhabhaDiffXsec`. The interference is negative, as it must be for identical fermions in the two channels (the relative sign from Fermi statistics, Chapter 3).

::angular-shapes{n="16.2" caption="Bhabha scattering in its three parts, on a logarithmic scale. The s-channel part is e⁺e⁻ → μ⁺μ⁻ and is flat. The t-channel part has a 1/(1 − cos θ)² pole: at small angles the electron and positron barely notice each other and the photon exchange is Rutherford scattering, with the 1/sin⁴(θ/2) of Chapter 4. Near θ = 0 the total is that pole."}

At small angles the t-channel term dominates completely. Near θ = 0, *t* → −*s*θ²/4 and the formula tends to $(\pi\alpha^2/s)\cdot 2s^2/t^2 \propto 1/\sin^4(\theta/2)$, the Rutherford formula of Chapter 4, with the electron scattering off the field of the positron. At 10 GeV and within |cos θ| < 0.9 the Bhabha cross-section is 39 nb, forty-five times that of muon pairs, and the forward peak carries most of it. Because the small-angle cross-section is so large and so well calculable, Bhabha scattering is the standard way to count collisions in an e⁺e⁻ collider: measure how many Bhabha events you see at small angles, divide by the calculated cross-section, and you have the luminosity. The LEP experiments did this, and Chapter 23 returns to the consequences of the precision.

## Generating the events: Monte Carlo and unweighting

The collider figure needs to turn a formula into events. Two techniques make this work, and both are the first appearance of ideas that run through the rest of the course.

**Monte Carlo integration.** To integrate a function *f*(*x*) over an interval, evaluate it at *N* random points and average: $\int_a^b f\,dx \approx (b-a)\langle f\rangle$, with an error $(b-a)\,\sigma_f/\sqrt N$. The error falls as $1/\sqrt N$ whatever the dimension of the integral, which is why it is used for integrals over the phase space of several particles. The generator's `crossSection(process, sqrtS, nEvents)` does this and returns the cross-section with its error, next to the analytic value where one exists. For e⁺e⁻ → μ⁺μ⁻ the integrand is 1 + cos²θ, and the Monte Carlo result agrees with 4πα²/3s within the error, as the test suite demands.

**Unweighting.** Integration gives a cross-section. A generator must also produce *events*, each a full set of particle momenta, distributed as the theory says, so that a detector simulation can process them one at a time. The simplest way is **accept–reject**, which you met in Chapter 4: draw a point *x* uniformly, compute its weight *w* = *f*(*x*), and accept it with probability *w*/*w*<sub>max</sub>, where *w*<sub>max</sub> is at least the largest weight. The accepted points are distributed as *f*, with all weights equal to one. The fraction of points kept, the **efficiency**, is ⟨*w*⟩/*w*<sub>max</sub>: for 1 + cos²θ under a flat bound of 2 it is (4/3)/2 = 2/3, which the test suite checks. A weight much larger than typical makes the efficiency poor, which is why real generators spend effort on importance sampling and on the VEGAS algorithm that learns a good sampling density.

```code
id: qed-unweight
title: 'Unweighting: accept–reject'
hook: gen.unweight
prompt: |
  Implement `unweight(w, wMax, rng)`: given the weight `w` of a generated point and the largest weight `wMax`, return `true` if the point is kept. A point must be kept with probability `w / wMax`, using one call of `rng()` (a uniform random number in [0, 1)). A weight above `wMax` is always kept.

  The generator's `Unweighter`, which keeps a running maximum, calls your function for every event of every hadron-collider process and for the initial-state-radiation sampler, so a wrong function biases every distribution that comes out.
starter: |
  import type { Rng } from 'hep/random';

  /** Keep a point of weight w with probability w / wMax. */
  export function unweight(w: number, wMax: number, rng: Rng): boolean {
    // one uniform random number: keep if rng() * wMax < w
    return true;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { unweight } from 'solution';
  import { rng } from 'hep/random';

  function fraction(w: number, wMax: number, n: number, seed: number): number {
    const r = rng(seed);
    let k = 0;
    for (let i = 0; i < n; i++) if (unweight(w, wMax, r)) k++;
    return k / n;
  }

  test('a zero weight is never kept, a weight at or above the maximum always is', () => {
    expect(fraction(0, 3, 2000, 1)).toBe(0);
    expect(fraction(3, 3, 2000, 2)).toBe(1);
    expect(fraction(5, 3, 2000, 3)).toBe(1);
  });

  test('the acceptance probability is w / wMax', () => {
    const n = 40000;
    for (const p of [0.1, 0.5, 0.9]) {
      const f = fraction(p * 7, 7, n, 11);
      expect(Math.abs(f - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / n));
    }
  });

  test('it uses the random number generator it is given, and only that', () => {
    const a = rng(5);
    const b = rng(5);
    const seqA = Array.from({ length: 50 }, () => unweight(0.4, 1, a));
    const seqB = Array.from({ length: 50 }, () => unweight(0.4, 1, b));
    expect(seqA).toEqual(seqB);
    expect(seqA.some((x) => x)).toBe(true);
    expect(seqA.some((x) => !x)).toBe(true);
  });

  test('unweighting 1 + cos²θ gives ⟨cos²θ⟩ = 0.4 and an efficiency of 2/3', () => {
    const r = rng(9);
    let kept = 0, trials = 0, c2 = 0;
    while (kept < 20000) {
      const c = 2 * r() - 1;
      trials++;
      if (unweight(1 + c * c, 2, r)) {
        kept++;
        c2 += c * c;
      }
    }
    expect(c2 / kept).toBeGreaterThan(0.39);
    expect(c2 / kept).toBeLessThan(0.41);
    expect(kept / trials).toBeGreaterThan(0.65);
    expect(kept / trials).toBeLessThan(0.685);
  });
solution: |
  import type { Rng } from 'hep/random';

  export function unweight(w: number, wMax: number, rng: Rng): boolean {
    return rng() * wMax < w;
  }
hints:
  - 'Draw u = rng() once. Then u × wMax is uniform on [0, wMax), and it is below w with probability w / wMax.'
  - 'A weight larger than wMax gives a probability larger than one, and the comparison is then always true, which is the behaviour the prompt asks for.'
```

:::programmer
Event generation is **sampling from a distribution you can evaluate but not invert**, and the tools are the ones a programmer knows from randomised algorithms. Accept–reject is rejection sampling. A weighted event, with a weight instead of a rejection, is **importance sampling**: draw from an easier distribution and correct with the ratio. VEGAS adapts the easier distribution to the integrand, bin by bin, the way an adaptive quadrature refines where the function varies. The hook system is a **strategy pattern**: the generator calls `hook('gen.unweight', unweight)` for each event, and if your function is installed it takes the place of the reference, which is why an exercise can be tested in isolation and then run inside the whole pipeline.
:::

:::hood[Unweighting and the running maximum]
The reference `unweight` is one line, in `hep/gen/integrate.ts`:

```ts
export function unweight(w: number, wMax: number, r: Rng): boolean {
  return r() * wMax < w;
}
```

Around it sits `Unweighter`, which does not know the true maximum weight of a multi-dimensional integrand in advance and so keeps a *running* maximum. The decision is exactly the line above, with the running maximum in place of `wMax`:

```ts
accept(w: number, r: Rng): boolean {
  const s = this.state;
  s.trials++;
  if (!(w > 0)) return false;
  let ok: boolean;
  if (w > s.max) {
    s.max = w;
    s.overweight++;
    ok = true;
  } else {
    ok = hook('gen.unweight', unweight)(w, s.max, r);
  }
  if (ok) s.accepted++;
  return ok;
}
```

A point heavier than the maximum so far raises it and is kept, which makes the heaviest weights slightly over-represented early in a run; the initial-state-radiation sampler avoids this by warming the maximum up with a fixed seed before it generates. VEGAS (class `Vegas` in the same file) divides each dimension into 50 bins and, after each iteration, moves the bin edges so that each bin holds an equal share of ∫f²: bins become narrow where the integrand is large, and the sample follows it.
:::

## What the loops do

The tree-level cross-section is the first term of a series. The others, in the diagrams of Figure 15.2, are small, and yet measured to astonishing precision. One of them is **the magnetic moment of the electron**.

An electron has a magnetic moment, the strength of its response to a magnetic field, which is conventionally written $\mu = g\,\frac{e\hbar}{2m}\,S$ with *S* the spin in units of ħ. Dirac's equation (Chapter 9) predicts exactly *g* = 2. The vertex correction of Chapter 15, in which the electron emits and reabsorbs a photon while it interacts with the external field, changes the value to

:::equation{#g2 caption="The anomalous magnetic moment of the electron, as a series in α/π. The first coefficient is Schwinger's."}
$$\term{ae}{a_e} \equiv \frac{g-2}{2} = \tfrac12\left(\frac{\alpha}{\pi}\right) + C_2\left(\frac{\alpha}{\pi}\right)^2 + C_3\left(\frac{\alpha}{\pi}\right)^3 + \cdots, \quad C_2 = -0.32848,\; C_3 = 1.18124,\; C_4 \approx -1.912,\; C_5 \approx 6.7$$

```terms
ae:
  label: 'aₑ, the anomalous magnetic moment'
  what: The fractional excess of the electron's g-factor over Dirac's value 2, a_e = (g − 2)/2.
  why: Dirac's equation gives a_e = 0 exactly. Every nonzero term comes from loop diagrams, in which the electron interacts with the quantum field around it.
  effect: The measured value is 0.00115965218059, so the electron's magnetic moment is larger than Dirac's by about 0.116 %.
C2:
  label: 'Cₙ, the coefficients'
  what: Pure numbers, from the sum of all n-loop diagrams. The coefficient at order α is exactly 1/2. At order α² it is C₂ = 197/144 + π²/12 − (π²/2) ln 2 + (3/4) ζ(3) = −0.328479 (Petermann, Sommerfield, 1957); at order α³, C₃ = 1.18124 (Laporta and Remiddi, 1996); C₄ and C₅ are known numerically.
  why: Each adds a finite, calculable contribution after renormalisation, and the number of diagrams grows quickly with the order.
  effect: The series alternates and its coefficients are of order one, so each term is smaller than the last by about α/π = 2.3 × 10⁻³.
```
:::

The first term, **Schwinger's**, is one diagram: *a*<sub>e</sub> = α/2π = 0.0011614. The second and third coefficients were found by Petermann and Sommerfield (1957) and by Laporta and Remiddi (1996),:cite[p4-petermann1957,p4-sommerfield1957,p4-laporta1996] and the numbers of diagrams at orders α, α², α³, α⁴ and α⁵ are 1, 7, 72, 891 and 12,672.:cite[p4-aoyama2012] Adding the terms shown, with the current value of α, gives 0.001159652176. The measurement is *a*<sub>e</sub> = 0.00115965218059 with an uncertainty of 13 in the last two digits,:cite[p4-fan2023] so theory and experiment agree to eight significant figures from these terms alone. The remaining 4.6 × 10⁻¹² comes from loops of particles other than the electron, which are in the full calculation: muons and taus (about 2.7 × 10⁻¹²), and quarks and hadrons (about 1.7 × 10⁻¹²).

The first-term-alone estimate is within 0.15 % of the measurement: one diagram. The electron's magnetic moment is the most precisely tested prediction of physics. Chapter 32 returns to the same quantity for the muon, where the heavier particle is more sensitive to new physics and the agreement is the subject of an open question.

:::history{year=1947 title="The Lamb shift, g − 2, and Schwinger's α/2π" people="Willis Lamb, Robert Retherford, Polykarp Kusch, Henry Foley, Julian Schwinger" source="Sources: Lamb and Retherford (1947); Kusch and Foley (1948); Schwinger (1948); Nobel Foundation (1955)."}
Dirac's equation for the hydrogen atom says that the 2S<sub>1/2</sub> and 2P<sub>1/2</sub> levels have exactly the same energy. In 1947, at Columbia University, Willis Lamb and Robert Retherford used a microwave technique to measure the difference and found the 2S level higher, by about 1000 MHz.:cite[p4-lamb1947] The result was discussed at the Shelter Island conference that June (Chapter 15). Hans Bethe calculated, within weeks, a shift of the right size by treating the electron's interaction with the radiation field and discarding the infinite energy that a free electron would have anyway, which is absorbed into its mass.:cite[p4-bethe1947] The modern value of the splitting is 1057.8 MHz, an energy of 4.4 μeV.

In the same months Polykarp Kusch and Henry Foley, also at Columbia, measured the *g*-factors of atoms in a magnetic field, from which the electron's own *g* follows, and found it about 0.1 % above Dirac's value: *g* = 2.00238 ± 0.00006, as they reported it.:cite[p4-kusch1948] In 1948 Julian Schwinger calculated the first correction, *a* = α/2π = 0.00116, in agreement.:cite[p4-schwinger1948] Lamb and Kusch shared the 1955 Nobel Prize in Physics for the two measurements.:cite[p4-nobel1955] The work of 1947–48 is what turned quantum electrodynamics from a formalism that gave infinities into a theory that could be tested: the calculated numbers were finite and matched. The diagrams of Chapter 15 were the next step.
:::

## A coupling that runs

The bubbles in the photon line, which Figure 15.2 shows, have a physical effect larger than the vertex correction: they change the strength of the electromagnetic force with the energy at which you look. A charge in vacuum polarises the vacuum: virtual electron–positron pairs appear around it, and the member of each pair with the opposite sign sits slightly closer than the other, which screens the charge. From a distance the charge looks smaller. Probed at higher energy, which means at shorter distance (Chapter 1), one penetrates the screening and sees more of the bare charge. The coupling grows with energy.

For a fermion of mass *m* and charge *Q*<sub>f</sub>, at a scale *Q* well above *m*, the bubble gives a shift:

:::equation{#running caption="The one-loop running of the fine-structure constant: each charged fermion with mass below Q adds a logarithm."}
$$\frac{1}{\term{aq}{\alpha(Q)}} = \frac{1}{\alpha(0)} - \frac{1}{3\pi}\sum_f N_c\,Q_f^2\left[\ln\frac{\term{Q2}{Q^2}}{m_f^2} - \frac53\right]$$

```terms
aq:
  label: 'α(Q), the coupling at scale Q'
  what: The effective fine-structure constant for a process in which the photon carries momentum Q. It is what to put in the cross-section at that energy.
  why: The vacuum-polarisation bubbles screen the charge at long distances. Closer in, less screening is seen.
  effect: 1/α = 137.036 at Q = 0 and about 128.96 at Q = 91 GeV, when the charged fermions of the Standard Model are included. The coupling is larger at high energy.
Q2:
  label: 'Q², the squared momentum transfer'
  what: The square of the energy scale of the process. For e⁺e⁻ → μ⁺μ⁻ it is s.
  why: The size of the logarithm is set by the ratio of the scale to the fermion's mass, and fermions heavier than Q do not contribute (they decouple).
  effect: Each factor of ten in Q lowers 1/α by (2 ln 10)/(3π) × N_c Q_f² = 0.49 N_c Q_f² for every fermion lighter than Q. The lightest fermions contribute the most logarithm, and the quarks carry a colour factor of three.
```
:::

The figure plots 1/α(*Q*) from the library, which sums the same kind of loops for every charged fermion, each switched on at its own mass.

::running-couplings{which="alpha" n="16.3" caption="The running of 1/α with energy, from hep/sm. Only fermion loops are included (the electron, muon and tau, and the quarks, the lightest of which are given an effective mass of 80 MeV to stand in for the hadronic part, which cannot be calculated from diagrams at low energy and is taken from data in practice). The curve gives 1/137.036 at zero and 1/128.96 at the Z mass. The dotted line is the conventional value 1/127.95, which is a different quantity: it is the MS-bar coupling, a scheme in which the W boson's loop and the top quark's are treated differently, and is the one that enters electroweak fits. The difference of one unit between 128.96 and 127.95 is bookkeeping, not a disagreement."}

The shift of 1/α from 137.036 to about 129 is a rise of the coupling by 6.3 % between zero energy and the Z mass. Of the total shift Δα = 0.059, about 0.031 comes from the loops of the three charged leptons (at one loop) and the rest, about 0.027, from quarks. That 6 % matters at the precision of Part VI. It enters the prediction of the Z boson's properties, and the muon-pair cross-section at 91 GeV is computed with the coupling at 91 GeV, not at zero. The generator in this course uses α(0) in its photon exchange by default and offers `alpha: 'running'`; the difference is the size of the running, an effect of about 13 % in the cross-section (since σ ∝ α²) at 91 GeV.

The same kind of calculation in the strong interaction has the opposite sign. The gluons' self-coupling makes the strong coupling *fall* with energy. That is the subject of Chapter 18.

## R and the colours

If quarks have charge *Q*<sub>q</sub> and the same spin and electromagnetic coupling as the muon, then e⁺e⁻ → q q̄ has exactly the cross-section of e⁺e⁻ → μ⁺μ⁻ multiplied by $Q_q^2$, times the number of colours *N*<sub>c</sub> = 3, since a quark–antiquark pair can be made in any of the colours (Chapter 13). The quarks are not seen individually (Chapter 18 explains why), but the total number of hadrons produced is the sum over quark flavours that are kinematically allowed. The **R ratio** is

:::equation{#rratio caption="The R ratio at leading order: the sum of the squared charges of the quarks that can be produced, times the number of colours."}
$$R(s) \equiv \frac{\sigma(e^+e^-\to\text{hadrons})}{\sigma(e^+e^-\to\mu^+\mu^-)} = \term{Nc}{N_c}\sum_{q}\term{Qq}{Q_q^2}\qquad (2m_q < \sqrt s)$$

```terms
Nc:
  label: 'N_c, the number of colours'
  what: The number of colour states of a quark (Chapter 13). A quark–antiquark pair can be produced in N_c ways, each with the same probability.
  why: 'Each colour is a separate final state, and the cross-section adds them: the rate is proportional to the number of ways.'
  effect: With N_c = 3, R is three times larger than it would be without colour.
Qq:
  label: 'Q_q, the electric charge of quark q'
  what: 'In units of the proton''s charge: +2/3 for u, c, t and −1/3 for d, s, b.'
  why: The photon couples to charge, so the amplitude is proportional to Q_q and the cross-section to its square.
  effect: The up-type quarks contribute 4/9 each and the down-type 1/9 each.
```
:::

Each new flavour switches on when the collision energy is enough to make its pair, √*s* > 2*m*<sub>q</sub>, and R climbs a step:

| Quarks available | R with N<sub>c</sub> = 3 | Without colour |
|---|---|---|
| u, d, s | 3 × (4/9 + 1/9 + 1/9) = 2 | 2/3 |
| + c | 2 + 3 × 4/9 = 10/3 | 10/9 |
| + b | 10/3 + 3 × 1/9 = 11/3 | 11/9 |

The staircase is the fingerprint of the charges, and its height is the number of colours. Without colour every step would be a third as high. The figure below scans the energy with pseudo-data from the generator, and lets you choose the number of colours in the model curve.

::ee-collider{tab="scan" title="Counting colours with R" n="16.4" caption="The R ratio from pseudo-data (three colours are built into the generator), with the model curve for a chosen number of colours. N_c = 3 has a χ² close to the number of points; one, two, four or five colours are rejected. The steps sit at 2m_c and 2m_b of the model, about 2.5 and 8.4 GeV. In real data, where quarks appear as mesons, the charm step is at about 3.7–4 GeV and the bottom step at 10.5–11 GeV, with the narrow J/ψ and Υ resonances on top. The top quark, at 2m_t ≈ 345 GeV, is out of reach of these colliders."}

The data of the real experiments, compiled by the Particle Data Group, follow the same staircase.:cite[pdg2024]

Two refinements deserve to be known. First, **gluon radiation** multiplies the quark rate by $1 + \alpha_s/\pi$, about 1.05 at 30 GeV: a quark that radiates a gluon is still a hadronic final state. Switch it on in the widget and the plateaus rise by a few per cent: R is one of the places where the strong coupling can be measured from e⁺e⁻ data (Chapter 18). Second, the thresholds. A charm quark does not appear alone: the pair becomes hadrons, including the narrow J/ψ (3.097 GeV) and the open-charm mesons D and D̄, each 1.865 GeV, whose pair threshold is at 3.73 GeV. The same holds for bottom, with the Υ family at 9.46 GeV and the B mesons (5.28 GeV each, threshold 10.56 GeV). The resonances are the spikes that Chapter 24 labels on the dimuon map, and the smooth staircase of the model is what they sit on.

```numeric
id: qed-r-above-b
title: R between the b and t thresholds
prompt: 'Above the b threshold and below the t threshold, five quark flavours can be produced. Using R = N_c Σ Q_q² with three colours, what is R at leading order?'
answer: 3.6667
unit: ''
tolerance: 0.005
hints:
  - Add the squared charges of u, d, s, c, b. Then multiply by 3.
explain: "The squared charges are 4/9 + 1/9 + 1/9 + 4/9 + 1/9 = 11/9, and three colours give 11/3 = 3.667. Gluon radiation raises it by α_s/π to about 3.8 at 30 GeV. Without colour it would be 11/9 = 1.22, a factor of three too low. The measured values sit on the coloured staircase."
```

```quiz
q: 'A theorist proposes that quarks come in N_c = 4 colours instead of three. What would be the R ratio between the charm and bottom thresholds (u, d, s, c produced), at leading order?'
options:
  - text: 10/3, as before, since colour does not affect the electric charge.
    why: 'The colour does not change the charge of each quark, but it multiplies the number of final states. R is proportional to N_c.'
  - text: 40/9 = 4.44.
    correct: true
    why: 'R = N_c × (4/9 + 1/9 + 1/9 + 4/9) = N_c × 10/9. With N_c = 4: 40/9. The measured values are close to 10/3 with a few per cent of gluon radiation on top, not 40/9: this is how the hadronic cross-section counts colours.'
  - text: 10/9 × 3 = 10/3 again, because one of the colours is unobservable.
    why: 'All of the colours are made with equal probability, and all produce hadrons; none is unobservable. The count is N_c.'
```

## In the experiments

:::experiments
The first e⁺e⁻ colliders were rings of a few metres to hundreds of metres in circumference: **SPEAR** at Stanford (Stanford Positron Electron Asymmetric Rings), whose data found the J/ψ in 1974 (Chapter 24); **PETRA** at DESY in Hamburg (Chapter 18); and **LEP** at CERN, which ran from 1989 to 2000 at energies up to 209 GeV in a tunnel of 27 km that the LHC now occupies (Chapter 21). The cross-sections of this chapter are what those machines measured.

Real generators include what the virtual collider omits. **Initial-state radiation**, where the electron or positron emits a photon before the collision, lowers the energy of the collision that reaches the photon or Z, so the cross-section seen at a given nominal √s is a smeared version of the ideal one (the `isr` option of the course's generator). The programs used for LEP data, **KKMC** (for e⁺e⁻ → f f̄) and **BHLUMI** (for small-angle Bhabha scattering, used for the luminosity), sum the radiation of many photons to all orders in the leading logarithm. The accelerator-physics background is in Part V.
:::

## What comes next

The chapter has computed e⁺e⁻ → μ⁺μ⁻ from a drawing, and in doing so has introduced a method: a cross-section from an amplitude, an angular distribution from spin, an event sample from a random-number generator, a measurement from a count and a luminosity. [Chapter 17](/chapters/symmetry-and-gauge/) asks why the photon exists at all, and finds the answer in a symmetry: require that the phase of the electron's wave function can be chosen independently at each point, and the electromagnetic field is forced on you. That same argument, with matrices in place of a phase, gives the gluons of [Chapter 18](/chapters/qcd/), where the coupling falls with energy rather than grows, and where the quarks of this chapter are finally seen as jets.

## Further reading

- Peskin and Schroeder, *An Introduction to Quantum Field Theory*, section 5.1 for e⁺e⁻ → μ⁺μ⁻ with traces and with helicity amplitudes (:cite[p4-peskin1995]).
- The Particle Data Group's review, the sections on the R ratio and on the electroweak model's running couplings (:cite[pdg2024]).
- Lamb and Retherford (1947), Kusch and Foley (1948) and Schwinger (1948) for the original papers (:cite[p4-lamb1947,p4-kusch1948,p4-schwinger1948]).
- The measurement of the electron's magnetic moment and the tenth-order calculation (:cite[p4-fan2023,p4-aoyama2012]).
