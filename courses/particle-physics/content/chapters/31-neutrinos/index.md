---
number: 31
title: Neutrinos
summary: For thirty years the Sun delivered a third of the neutrinos it should have. The missing two thirds had changed flavour on the way, which means that neutrinos have mass, which the Standard Model of the previous thirty chapters does not allow. This chapter derives the oscillation formula, builds the three-flavour matrix that governs it, and asks the questions it leaves open.
duration: About 2½ hours
prerequisites: [the-weak-force, the-higgs-mechanism]
---

In a tank of cleaning fluid 1.5 km underground in a gold mine in South Dakota, an experiment ran from 1967 for more than twenty years. The tank held 615 tonnes of tetrachloroethylene, and its job was to catch one thing: a neutrino from the Sun that turns an atom of chlorine-37 into an atom of radioactive argon-37. Every few weeks the experimenters flushed the tank with helium, collected the argon, and counted the atoms by their radioactivity. The Sun was making about sixty billion neutrinos through every square centimetre every second (Chapter 22 did the sum), and the theory of the Sun's core predicted how many of them the tank should catch. The tank caught about a third.:cite[davis1968,cleveland1998]

That discrepancy, the :term[solar neutrino problem]{id=solar-neutrino-problem}, lasted from 1968 to 2002. Its solution is not a flaw in the solar model, which was right. It is a property of the neutrino itself, and it is the first and so far the only laboratory evidence that the Standard Model as set out in this course is incomplete. A neutrino that is born as one kind can arrive as another, and a particle can only do that if it has mass.

## The solar neutrino problem

The Sun shines by fusing hydrogen into helium, a chain of reactions explained in the [fusion chapter of the astrophysics course](/astrophysics/ch/fusion/). Each completed chain converts four protons into a helium nucleus, two positrons and two electron neutrinos, and releases about 26 MeV. Chapter 22 explained why a neutrino passes through matter almost untouched, and the Sun is no obstacle: a neutrino from the core reaches the surface in a couple of seconds, while the light from the same reactions takes thousands of years or more.

John Bahcall's solar model predicted how many neutrinos of each energy the core makes. The most energetic ones, from the decay of boron-8, are rare but the easiest to catch, and the chlorine tank at the Homestake mine, designed by Raymond Davis, was sensitive to them through the reaction

$$\nu_e + {}^{37}\mathrm{Cl} \to {}^{37}\mathrm{Ar} + e^-,$$

which needs a neutrino of at least 0.814 MeV. Davis's result, averaged over more than twenty years, was a capture rate of $2.56 \pm 0.16 \pm 0.16$ SNU, about 30 % of the prediction. (One SNU, "solar neutrino unit", is $10^{-36}$ captures per target atom per second.)

:::history{year=1968 title="One third of the Sun" people="Raymond Davis Jr., John N. Bahcall" source="Sources: Davis, Harmer and Hoffman (1968); Cleveland et al. (1998)."}
Raymond Davis Jr. of Brookhaven National Laboratory put a tank of 615 tonnes of tetrachloroethylene into the Homestake gold mine in South Dakota, deep enough to shield it from cosmic rays. His first result, published in 1968, was an upper limit: fewer solar neutrinos than the theory of John Bahcall predicted.:cite[davis1968] Over the next two decades the measurement was refined to a rate of $2.56 \pm 0.16 \pm 0.16$ SNU, about 30 % of the solar-model prediction.:cite[cleveland1998]

For many years the neutrino physicists suspected the solar model and the solar-model physicists suspected the experiment. Neither was at fault. Davis shared the 2002 Nobel Prize in Physics with Masatoshi Koshiba, who built the Kamiokande detector in Japan, and Riccardo Giacconi.:cite[nobel2002]
:::

```fermi
id: homestake-atoms
title: Argon atoms in a tank
prompt: 'The Homestake tank held 615 tonnes of tetrachloroethylene, C₂Cl₄ (molar mass 165.8 g/mol). Chlorine-37 is 24.2 % of natural chlorine. The measured capture rate was 2.56 SNU, where 1 SNU is 10⁻³⁶ captures per target atom per second (Avogadro: 6.02 × 10²³ per mole). About how many argon atoms did the Sun make in the tank each day?'
answer: 0.48
unit: atoms per day
factor: 3
hints:
  - 'Moles of C₂Cl₄: 615 × 10⁶ g divided by 165.8 g/mol. Each molecule has four chlorine atoms.'
  - 'Multiply by 0.242 for chlorine-37, by Avogadro to get atoms, by 2.56 × 10⁻³⁶ per second, and by 86,400 s.'
explain: 'The tank holds 3.7 × 10⁶ mol of C₂Cl₄, so 1.5 × 10⁷ mol of chlorine and 3.6 × 10⁶ mol of chlorine-37: 2.2 × 10³⁰ atoms. At 2.56 × 10⁻³⁶ captures per atom per second that is 5.6 × 10⁻⁶ per second, or about 0.48 per day. One argon atom every two days, among 10³⁰ chlorine atoms, and the experiment found them. Counting them took chemistry and patience, not speed: the argon was swept out every few weeks and counted by its radioactivity.'
```

## Three ways out

There were three candidates for the culprit, and they were not equally respectable.

1. **The solar model is wrong.** The rate of boron-8 neutrinos depends very steeply on the temperature of the core (as roughly the 25th power), so a 5 % error in the central temperature changes it by a factor of three. But the same model explained the Sun's measured oscillations (its sound waves), which constrain the temperature to a fraction of a per cent.
2. **The experiment is wrong.** Other experiments, some with different detectors and thresholds (water Cherenkov detectors and gallium tanks), saw deficits of different sizes. They could not all be wrong in the same direction.
3. **The neutrinos change on the way.** Detectors sensitive only to the electron neutrino $\nu_e$ would see a deficit if some of them arrived as the other kinds, $\nu_\mu$ and $\nu_\tau$, which a chlorine tank cannot catch (a $\nu_\mu$ of a few MeV has too little energy to make a muon, so it cannot trigger the same reaction).

The third had been proposed long before the problem existed.

:::history{year=1957 title="A neutrino that turns into its antineutrino" people="Bruno Pontecorvo, Ziro Maki, Masami Nakagawa, Shoichi Sakata" source="Sources: Pontecorvo (1957, 1958); Maki, Nakagawa and Sakata (1962)."}
In 1957, a year after the neutrino was detected and the year parity violation shook physics (Chapter 22), Bruno Pontecorvo noticed an analogy. The neutral kaon and its antiparticle mix, so that a beam that starts as one kind is a superposition of two states with different masses and develops the other kind as it flies. If neutrinos had mass, he reasoned, a neutrino might likewise turn into an antineutrino.:cite[pontecorvo1957,pontecorvo1958] Only one kind of neutrino was known then.

After the muon neutrino was found in 1962, Ziro Maki, Masami Nakagawa and Shoichi Sakata wrote down the mixing of two flavours, and in the later 1960s Pontecorvo applied the idea to neutrinos from the Sun: a deficit of electron neutrinos would be a signature of oscillation.:cite[maki1962,pontecorvo1967] It took experiments in the sky, the Sun and the laboratory, between 1998 and 2002, to show that the idea was right.
:::

## The oscillation formula

Here is the argument, with the minimum of machinery. Suppose there are only two flavours, $\nu_e$ and $\nu_\mu$ (the full three-flavour case is the same idea with a larger matrix). The key assumption is that **the neutrinos that are produced and detected by the weak force are not the neutrinos that have definite mass**. A weak interaction makes a state of definite flavour, $\nu_\mu$ for instance, because it couples a muon to the neutrino (Chapter 22). Free propagation in empty space is governed by the energy, and the states of definite energy at a given momentum are the states of definite mass, $\nu_1$ and $\nu_2$ with masses $m_1$ and $m_2$. The two bases are related by a rotation through an angle $\theta$:

$$|\nu_\mu\rangle = \cos\theta\,|\nu_1\rangle + \sin\theta\,|\nu_2\rangle .$$

A $\nu_\mu$ born at time zero with momentum $p$ is therefore a superposition of two states with slightly different energies, $E_i = \sqrt{p^2 + m_i^2} \approx p + m_i^2/2p$ for neutrinos that are very light compared with their momentum. They advance in phase at slightly different rates, $e^{-iE_1 t}$ and $e^{-iE_2 t}$. After a time $t \approx L$ (with $c = 1$) the relative phase is $(E_2 - E_1)L = \Delta m^2 L/2E$, with $\Delta m^2 = m_2^2 - m_1^2$ and $E \approx p$ the neutrino's energy. If you then ask the weak force "is this still a $\nu_\mu$, or has it become a $\nu_e$?", you are projecting the evolved state back on the flavour states, and the interference between the two mass components gives the probability (derived in the box below):

:::equation{#oscillation caption="The two-flavour oscillation probability. The probability that a neutrino of one flavour is found as the other after a distance L oscillates between 0 and sin²2θ."}
$$P(\nu_\alpha \to \nu_\beta) = \term{mix}{\sin^2 2\theta}\;\sin^2\!\left(\frac{\term{dm}{\Delta m^2}\,\term{L}{L}}{4\,\term{E}{E}}\right) = \sin^2 2\theta\;\sin^2\!\left(1.267\,\frac{\Delta m^2[\mathrm{eV}^2]\,L[\mathrm{km}]}{E[\mathrm{GeV}]}\right)$$

```terms
mix:
  label: 'sin²2θ, the mixing'
  what: 'The square of the sine of twice the mixing angle θ between the flavour states and the mass states. It is the largest probability that the oscillation can reach.'
  why: 'If θ = 0 the flavour states are the mass states and nothing oscillates. If θ = 45° ("maximal mixing") sin²2θ = 1 and a beam of one flavour can turn completely into the other.'
  effect: 'Atmospheric neutrinos have sin²2θ close to 1; the angle θ₁₃ is small, with sin²2θ₁₃ about 0.09.'
dm:
  label: 'Δm², the squared-mass difference'
  what: 'The difference m₂² − m₁² of the squared masses of the two states of definite mass, in eV². Only the difference of squares matters, never the masses themselves.'
  why: 'It sets the rate at which the two components fall out of step, and so the length over which the oscillation repeats.'
  effect: 'The atmospheric splitting is about 2.5 × 10⁻³ eV², the solar one about 7.5 × 10⁻⁵ eV². Smaller Δm² needs a longer baseline to be seen.'
L:
  label: 'L, the distance travelled'
  what: 'The distance between the point where the neutrino is made and the point where it is detected, in km in the second form of the equation.'
  why: 'The phase difference grows in proportion to the time of flight, which for a neutrino that is almost massless is the distance divided by c.'
  effect: 'For fixed energy and Δm², the probability is zero at L = 0, first reaches its maximum at 1.267 Δm² L/E = π/2, and then repeats.'
E:
  label: 'E, the neutrino energy'
  what: 'The energy of the neutrino, in GeV in the second form. For a very light neutrino, E is also its momentum.'
  why: 'A faster neutrino is less sensitive to its mass: the energy difference between the two states, Δm²/2E, falls as E rises.'
  effect: 'Doubling the energy doubles the length of the oscillation. Only the combination L/E matters.'
```
:::

The constant $1.267$ is not a mystery: it is the conversion of units. In natural units the phase is $\Delta m^2 L/4E$ with $L$ in inverse eV. With $\hbar c = 197.327$ MeV·fm, one kilometre is $10^3\,\text{m}/\hbar c = 5.07 \times 10^{9}\ \text{eV}^{-1}$, so a squared-mass difference of $1\ \text{eV}^2$, a distance of $1$ km and an energy of $1$ GeV give a phase of $5.07 \times 10^{9} / (4 \times 10^{9}) = 1.267$. The library computes the constant from $\hbar c$ rather than typing it, and its tests repeat this arithmetic step by step.

:::deeper[Deriving the formula]
Let the mass states have energies $E_1$ and $E_2$ at the common momentum $p$. A neutrino born as $|\nu_\mu\rangle = \cos\theta\,|\nu_1\rangle + \sin\theta\,|\nu_2\rangle$ evolves into

$$|\nu_\mu(t)\rangle = \cos\theta\, e^{-iE_1 t}|\nu_1\rangle + \sin\theta\, e^{-iE_2 t}|\nu_2\rangle .$$

The electron-flavour state is the orthogonal combination, $|\nu_e\rangle = -\sin\theta\,|\nu_1\rangle + \cos\theta\,|\nu_2\rangle$. The amplitude to find it is

$$A = \langle\nu_e|\nu_\mu(t)\rangle = -\sin\theta\cos\theta\, e^{-iE_1 t} + \sin\theta\cos\theta\, e^{-iE_2 t} = \sin\theta\cos\theta\,\bigl(e^{-iE_2 t} - e^{-iE_1 t}\bigr).$$

Its squared modulus is $\sin^2\theta\cos^2\theta\,|e^{-i\phi}-1|^2$ with $\phi = (E_2 - E_1)t$, and $|e^{-i\phi} - 1|^2 = 2 - 2\cos\phi = 4\sin^2(\phi/2)$. Since $\sin\theta\cos\theta = \tfrac12\sin 2\theta$,

$$P(\nu_\mu \to \nu_e) = \sin^2 2\theta\,\sin^2\!\left(\frac{E_2 - E_1}{2}\,t\right).$$

For $m_i \ll p$, $E_2 - E_1 \approx (m_2^2 - m_1^2)/2p = \Delta m^2/2E$, and the neutrino travels $L \approx t$ (with $c = 1$), which gives $\sin^2(\Delta m^2 L/4E)$. The survival probability is $1 - P$. That the answer depends on the **square** of the masses, and that it vanishes if $m_1 = m_2$, are the two facts experiments rely on: oscillation proves that the masses differ, and so that at least one is not zero, but it cannot say what the masses are.
:::

Three properties of the formula decide how every experiment is built.

- **It depends only on $L/E$.** An experiment chooses its energy and its distance so that $1.267\,\Delta m^2 L/E$ is of order 1. For the atmospheric splitting $\Delta m^2 = 2.5 \times 10^{-3}\ \text{eV}^2$ and a 1 GeV neutrino, the first maximum is at $L = \pi E / (2 \times 1.267\,\Delta m^2) = 496$ km.
- **It is zero for a distance much shorter than the oscillation length.** Near the source the beam is still pure. That is why a "near detector" measures the beam before it has had time to change and a "far detector" measures it after.
- **It averages to $\tfrac12\sin^2 2\theta$** when many oscillations fit inside the detector's resolution: far above the first maximum the neutrinos have lost the phase, and the detector sees a fixed fraction.

::two-flavour{n="31.1" caption="The two-flavour formula, drawn by the library's function through the hook oscillations.probability. Drag Δm² and the energy: the pattern in L stretches or shrinks and the height stays at sin²2θ. If you have solved the exercise below and ticked use my code, it is your function that draws the curve."}

### You write: the oscillation probability

```code
id: oscillation-probability
title: The oscillation probability
hook: oscillations.probability
prompt: |
  Implement `probability(theta, dm2, L, E)`, the two-flavour probability $P(\nu_\alpha \to \nu_\beta) = \sin^2 2\theta\,\sin^2(1.267\,\Delta m^2 L/E)$.
  The angle `theta` is in radians, `dm2` in eV², `L` in km and `E` in GeV, as in the equation above. Your function drives the curve of
  Figure 31.1, and from there the library's two-flavour code: tick *use my code* and the figure uses it.
starter: |
  export function probability(theta: number, dm2: number, L: number, E: number): number {
    // P = sin²(2θ) · sin²(1.267 Δm² L / E)
    return 0;
  }
tests: |
  import { test, expect } from '@pp/test';
  import { probability } from 'solution';

  const K = 1.26693; // 1e3 / (4 ħc) with ħc in eV·m and E in eV

  test('maximal mixing at the first maximum gives probability 1', () => {
    const dm2 = 2.5e-3, E = 1;
    const L = Math.PI / 2 / (K * dm2 / E); // about 496 km
    expect(probability(Math.PI / 4, dm2, L, E)).toBeCloseTo(1, 3);
  });

  test('the probability at the first maximum is sin²2θ', () => {
    const dm2 = 7.5e-5, E = 0.004;
    const L = Math.PI / 2 / (K * dm2 / E);
    expect(probability(0.58, dm2, L, E)).toBeCloseTo(Math.sin(1.16) ** 2, 3);
  });

  test('no mixing, or no distance, means no oscillation', () => {
    expect(probability(0, 2.5e-3, 500, 1)).toBeCloseTo(0, 12);
    expect(probability(0.7, 2.5e-3, 0, 1)).toBeCloseTo(0, 12);
  });

  test('a reactor experiment at 1.65 km sees the small theta13 dip', () => {
    // sin²2θ13 = 0.092, Δm² = 2.5e-3 eV², 3.5 MeV antineutrinos
    const s = Math.sqrt(0.092);
    const theta = 0.5 * Math.asin(s);
    const expected = 0.092 * Math.sin(K * 2.5e-3 * 1.65 / 0.0035) ** 2;
    expect(probability(theta, 2.5e-3, 1.65, 0.0035)).toBeCloseTo(expected, 3);
  });

  test('the pattern repeats with the oscillation length, and does not depend on the sign of Δm²', () => {
    const dm2 = 2.5e-3, E = 2;
    const Losc = Math.PI * E / (K * dm2);
    expect(probability(0.6, dm2, 100 + Losc, E)).toBeCloseTo(probability(0.6, dm2, 100, E), 3);
    expect(probability(0.6, -dm2, 100, E)).toBeCloseTo(probability(0.6, dm2, 100, E), 12);
  });

  test('averaged over many oscillations the probability is half of sin²2θ', () => {
    let sum = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) sum += probability(0.5, 2.5e-3, 5000 + (i * 7919) / N, 1);
    expect(sum / N).toBeCloseTo(0.5 * Math.sin(1) ** 2, 2);
  });

  test('it is always a probability', () => {
    for (let i = 0; i < 200; i++) {
      const p = probability(i * 0.013, 1e-3 + i * 1e-5, 10 + i * 37, 0.5 + i * 0.1);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
solution: |
  export function probability(theta: number, dm2: number, L: number, E: number): number {
    const s2 = Math.sin(2 * theta);
    const s = Math.sin((1.267 * dm2 * L) / E);
    return s2 * s2 * s * s;
  }
hints:
  - 'The phase inside the second sine is 1.267 × Δm² × L / E. The first sine is of twice the angle, then both are squared.'
  - 'Two sines, each squared. The sign of Δm² cancels because the sine is squared.'
```

## How the oscillation was found

No single experiment shows it. Three independent kinds of neutrino, in three ranges of $L/E$, each showed a deficit, and each of them was an oscillation with its own mass splitting.

### Atmospheric neutrinos

When a cosmic ray strikes the upper atmosphere (Chapter 10), it makes pions, which decay to muons and muon neutrinos, and the muons decay to electrons and more neutrinos. The result is a shower of neutrinos in every direction, mostly $\nu_\mu$ and $\nu_e$ in a ratio of about two to one at low energy, with energies of about a GeV. A detector on the surface of the Earth sees neutrinos that were made overhead, 15 km away, and neutrinos that were made on the far side of the planet, 12,700 km away. By the symmetry of the flux the two numbers should be equal.

**Super-Kamiokande** (Super-K) is a tank of 50,000 tonnes of ultra-pure water in a mine at Kamioka in Japan, about 1 km below the surface, viewed by about 11,000 photomultiplier tubes on its walls. A muon neutrino that interacts in the water makes a muon, which moves faster than light travels in water and emits a cone of Cherenkov light (Chapter 6). The light cone strikes the wall as a ring, and its sharpness distinguishes a muon (a clean ring) from an electron (a fuzzy ring, because the electron showers). The direction of the ring gives the direction of the neutrino. In 1998 Super-K reported that $\nu_\mu$ coming from below were missing, roughly half of them, while those from above were not.:cite[fukuda1998]

:::history{year=1998 title="Muon neutrinos missing from below" people="Takaaki Kajita and the Super-Kamiokande collaboration" source="Source: Fukuda et al. (1998); Nobel Prize in Physics 2015."}
At the Neutrino '98 conference in Takayama, Japan, in June 1998, the Super-Kamiokande collaboration showed the number of muon-like events against the direction of the neutrino. Events from above matched the prediction; events from below, which had crossed the Earth, were deficient by about a half. The paper reporting "evidence for oscillation of atmospheric neutrinos", with 535 days of data, appeared in *Physical Review Letters* that year.:cite[fukuda1998]

Muon neutrinos were disappearing, and no excess of electron-like events appeared to compensate, so the natural candidate for what they were turning into was the tau neutrino. The 2015 Nobel Prize in Physics went to Takaaki Kajita, for the Super-Kamiokande result, and Arthur McDonald, for the Sudbury Neutrino Observatory, "for the discovery of neutrino oscillations, which shows that neutrinos have mass".:cite[nobel2015]
:::

::zenith-angle{n="31.2" caption="A toy of Super-K's result, simulated, not data. Muon neutrinos arrive at every zenith angle; the distance they have flown follows from the angle, from 15 km overhead to 12,700 km from below. The curve is the three-flavour survival probability at the atmospheric splitting, averaged over a power-law energy spectrum; the points are Poisson counts with a seed. Slide the lowest energy up: the oscillation moves to larger angles, and the up/down ratio changes. The flux is taken to be the same in all directions, which is only approximately true."}

The neutrinos from above are untouched, because 15 km is too short. Those that arrive horizontally, 400 km or so, are partly changed. Those from straight below have flown so far that the pattern has been averaged over a range of energies and the survival probability sits at about one half. The flat bottom of the curve is $1 - \tfrac12\sin^2 2\theta_{23}$, and it fixes that $\theta_{23}$ is close to $45^\circ$: this is the large angle.

### Solar neutrinos, again

Now the Sun. Neutrinos from the solar core travel 150 million km, which is far enough for the fast oscillation at the atmospheric splitting to have averaged out completely, but the slower one at $\Delta m^2_{21} \approx 7.5 \times 10^{-5}\ \text{eV}^2$ is also washed out in the energy spread of the source. What survives is a number: the average probability that an electron neutrino is still an electron neutrino, which in vacuum would be $1 - \tfrac12\sin^2 2\theta_{12} \approx 0.57$.

The boron-8 neutrinos that Davis caught are the highest in energy, a few MeV to 15 MeV, and for them there is a second effect, which changes the answer. A neutrino passing through matter feels the electrons in it: electron neutrinos scatter from them by exchanging a W, which muon and tau neutrinos cannot do. That adds a potential

$$V = \sqrt{2}\,G_F N_e \approx 7.63 \times 10^{-14}\ \text{eV} \times Y_e\,\rho\ [\text{g/cm}^3],$$

where $N_e$ is the density of electrons and $Y_e \approx 0.5$ to $0.67$ the number of electrons per nucleon. In the Sun's core, where the density is about 150 g/cm³, this potential competes with the mass splitting, and its effect grows with energy. Lincoln Wolfenstein (1978) and Stanislav Mikheyev and Alexei Smirnov (1985) showed that in a medium that changes slowly, a $\nu_e$ produced at the centre can leave the Sun almost entirely as the heavier mass state $\nu_2$, which has an electron-flavour content of only $\sin^2\theta_{12} \approx 0.31$.:cite[wolfenstein1978,mikheyev1985] This :term[MSW effect]{id=msw-effect} turns the vacuum average of 0.57 at low energy into 0.31 at high energy.

::solar-msw{n="31.3" caption="The probability that a solar electron neutrino arrives as an electron neutrino, for the adiabatic two-flavour MSW effect at the Sun's centre. It is a toy: one production density (150 g/cm³ by default, electron fraction 0.67), no spread of the production region, θ₁₃ neglected. Below a MeV the neutrino sees mostly vacuum and the value is 1 − ½sin²2θ₁₂; above 10 MeV it has become sin²θ₁₂. Davis's tank saw the high-energy end. Set the density to zero and the matter effect disappears."}

That explains why the chlorine tank caught less than any vacuum average could explain, but it does not yet show that the neutrinos have changed flavour: a deficit is a deficit. To demonstrate it, an experiment had to count the neutrinos that the tank could not see.

:::history{year=2001 title="The neutrinos were all there" people="Arthur McDonald and the Sudbury Neutrino Observatory collaboration" source="Sources: Ahmad et al. (2001, 2002); Nobel Prize in Physics 2015."}
The Sudbury Neutrino Observatory (SNO) was built 2 km under a nickel mine in Ontario, around 1,000 tonnes of heavy water, $\mathrm{D_2O}$, in an acrylic sphere. Heavy water allows three reactions. A charged-current reaction, $\nu_e + d \to p + p + e^-$, needs an electron neutrino. Elastic scattering on electrons responds to all three kinds, but mostly the electron kind. A **neutral-current** reaction, $\nu + d \to p + n + \nu$, breaks up the deuteron and is equally sensitive to all three flavours.

In 2001 SNO published the charged-current rate and, compared with Super-Kamiokande's scattering rate, found a signal of non-electron neutrinos from the Sun.:cite[ahmad2001] In 2002 it measured the neutral-current rate directly. The total flux of all flavours was what the solar model predicted; the electron neutrinos were about a third of it.:cite[ahmad2002]

The solar model had been right the whole time. Of the neutrinos that left the Sun as $\nu_e$, two thirds arrived as $\nu_\mu$ or $\nu_\tau$.
:::

### Reactors

A nuclear reactor is a source of electron antineutrinos, from the beta decays of its fission products, with energies of a few MeV and a flux known to a few per cent from the reactor's power. Put a detector at the right distance and the same formula applies to $\bar\nu_e \to \bar\nu_e$. Two distances matter.

At about 180 km, the **KamLAND** detector in Japan (a kilotonne of liquid scintillator in the Kamioka mine, surrounded by the reactors of Japan) tested the solar oscillation under laboratory conditions. Its first result, in 2003, was that the rate of antineutrinos was $0.611 \pm 0.085 \pm 0.041$ of the no-oscillation expectation, and in 2005 it saw the oscillation as a dip and a recovery in the spectrum, as a function of $L/E$.:cite[eguchi2003,araki2005] The solar neutrino problem had been reproduced with a man-made source, and the mass splitting $\Delta m^2_{21}$ was measured.

At about 1.7 km, an experiment sees the faster oscillation at $\Delta m^2_{31}$ and its small amplitude, which gives $\theta_{13}$. In 2012 the Daya Bay experiment in China reported that the electron antineutrinos at its far site were fewer than at its near sites by a few per cent, a disappearance with a significance of 5.2σ, and showed that $\theta_{13}$ is not zero.:cite[dayabay2012] That mattered because the third angle controls whether CP violation can be seen in neutrinos at all (see below).

A third, medium baseline, 53 km, is where the **JUNO** detector in China (20,000 tonnes of liquid scintillator) sits. Its first results, from 59 days of data in 2025, measured $\sin^2\theta_{12} = 0.3092 \pm 0.0087$ and $\Delta m^2_{21} = (7.50 \pm 0.12) \times 10^{-5}\ \text{eV}^2$, the most precise values for these two parameters at the time of writing.:cite[juno2025] At this distance the slow solar oscillation and the fast atmospheric ripple are visible together, which will in time say something about the mass ordering (below).

### Accelerators

The last kind is the one built for the purpose. A proton beam strikes a target, and the pions and kaons that come out are focused into a tunnel by a magnetic "horn", where they decay to muons and $\nu_\mu$. What remains at the end, after the muons are absorbed by rock, is a nearly pure beam of muon neutrinos, whose energy and direction are known. Aim it at a far detector.

- **K2K, then T2K** (Japan): a beam from J-PARC in Tokai to Super-Kamiokande, 295 km away, at an energy of 0.6 GeV, chosen for the first oscillation maximum.
- **NOvA** (United States): from Fermilab to northern Minnesota, 810 km.
- **CNGS** (Europe): protons of 400 GeV from the SPS at CERN made a beam of $\nu_\mu$ of about 17 GeV, sent 730 km underground to the Gran Sasso laboratory in Italy, where the **OPERA** detector waited for something that no one had seen: a tau neutrino that had *appeared* in a beam of muon neutrinos.

The reason is the logic of the evidence so far. Super-K, K2K and the others saw muon neutrinos *disappear*. Disappearance is consistent with oscillation into $\nu_\tau$, but also with other things (neutrino decay, absorption by something unknown). The proof is **appearance**: an event of the new kind that the beam did not contain. A $\nu_\tau$ makes a tau lepton when it interacts, and the tau lives only $2.9 \times 10^{-13}$ s, so a tau of 10 GeV flies about half a millimetre before it decays. OPERA's detector was a mass of lead plates interleaved with photographic emulsion, about 150,000 "bricks" of it, with a resolution of a micrometre, in which that half millimetre and the kink where the tau decays could be photographed.

```numeric
id: tau-flight
title: How far does the tau fly?
prompt: 'A tau lepton of energy 10 GeV is made in an OPERA brick. Using the mass 1.777 GeV and the mean lifetime 2.903 × 10⁻¹³ s from the particle table, what is its mean decay length βγcτ in millimetres? (c = 2.998 × 10⁸ m/s; take β ≈ 1 for the speed, but compute γ = E/m.)'
answer: 0.49
unit: mm
tolerance: 0.04
hints:
  - 'γ = E/m = 10/1.777. The proper decay length is cτ = 2.998 × 10⁸ m/s × 2.903 × 10⁻¹³ s = 87 µm.'
  - 'Multiply the two: about 5.6 × 87 µm.'
explain: 'γ = 10/1.777 = 5.63 and cτ = 87.0 µm, so the mean decay length is 5.63 × 87.0 µm = 0.49 mm: about half a millimetre, long enough to leave a visible track in emulsion and short enough to decay inside the brick. A lepton that lives 2.9 × 10⁻¹³ s can be photographed only because the emulsion has micrometre resolution.'
```

```predict
q: 'The CNGS beam of muon neutrinos (about 17 GeV) travels 730 km to OPERA. With the atmospheric splitting (2.5 × 10⁻³ eV²) and nearly maximal mixing, about what fraction of the neutrinos has changed into tau neutrinos when the beam arrives?'
options:
  - text: About a half, as in Super-Kamiokande.
    why: 'Super-K sees neutrinos of about 1 GeV, at which 730 km is more than a full oscillation. At 17 GeV the oscillation length is 17 times longer, and 730 km is a small fraction of it.'
  - text: About 2 %.
    correct: true
    why: 'The phase is 1.267 × 2.5 × 10⁻³ × 730/17 = 0.136, and sin²(0.136) is 0.018, which times sin²2θ ≈ 1 gives about 1.8 %. OPERA was far from the first maximum on purpose: the energy had to be above the tau-production threshold of about 3.5 GeV, which made the beam energetic and the oscillation slow. Few taus per neutrino, so a very intense beam and a heavy detector were needed.'
  - text: Essentially none, because the energy is too high.
    why: 'The probability is small but not zero: 1.8 %, not 0. Appearance is rare at this energy, not impossible.'
```

:::history{year=2015 title="The tau neutrino that was not in the beam" people="OPERA collaboration" source="Source: Agafonova et al. (2015)."}
The OPERA experiment took data in the CNGS beam from 2008 to 2012. A first candidate tau neutrino was announced in 2010. By 2015, with a fifth candidate in an enlarged sample and a better estimate of the background, the collaboration reported five events against an expected background of $0.25 \pm 0.05$, an excess of 5.1 standard deviations: a direct observation of $\nu_\mu \to \nu_\tau$ in appearance mode, as the oscillation requires.:cite[opera2015]

OPERA had been in the news earlier for a different reason, a reported speed of neutrinos faster than light that turned out to be a loose connector in a timing system; [Chapter 28](/chapters/the-statistics-of-discovery/) tells that story. The two results should not be confused: the oscillation result is firm and has been confirmed since by other experiments.
:::

## Three flavours: the PMNS matrix

With three flavours the mixing is a $3 \times 3$ unitary matrix, which is called the :term[PMNS matrix]{id=pmns-matrix} after Pontecorvo, Maki, Nakagawa and Sakata. It plays for leptons the role that the CKM matrix of Chapter 24 plays for quarks. A matrix of this kind has three rotation angles and one complex phase, and the standard way to write it is as a product of three rotations, one in each pair of states, with the phase attached to the one that mixes the first and third:

:::equation{#pmns caption="The PMNS matrix in the standard parametrisation: three rotations and a phase. Each angle is measured by a different kind of experiment."}
$$\begin{pmatrix}\nu_e\\ \nu_\mu\\ \nu_\tau\end{pmatrix} = \underbrace{\begin{pmatrix}1&0&0\\0&\term{c23}{c_{23}}&\term{s23}{s_{23}}\\0&-s_{23}&c_{23}\end{pmatrix}}_{\text{atmospheric}} \underbrace{\begin{pmatrix}\term{c13}{c_{13}}&0&\term{s13}{s_{13}}e^{-i\term{delta}{\delta}}\\0&1&0\\-s_{13}e^{i\delta}&0&c_{13}\end{pmatrix}}_{\text{reactor, beams}} \underbrace{\begin{pmatrix}\term{c12}{c_{12}}&\term{s12}{s_{12}}&0\\-s_{12}&c_{12}&0\\0&0&1\end{pmatrix}}_{\text{solar}} \begin{pmatrix}\nu_1\\ \nu_2\\ \nu_3\end{pmatrix}$$

```terms
c23:
  label: 'c₂₃ = cos θ₂₃'
  what: 'The cosine of the angle θ₂₃ that rotates between the second and third states. The abbreviation c_ij is cos θ_ij.'
  why: 'This is the atmospheric angle, because it controls how much of the third mass state is muon-like and how much is tau-like.'
  effect: 'θ₂₃ is close to 45° (sin²θ₂₃ is between about 0.45 and 0.57), so the third mass state is nearly half ν_μ and half ν_τ.'
s23:
  label: 's₂₃ = sin θ₂₃'
  what: 'The sine of θ₂₃ (s_ij is sin θ_ij).'
  why: 'Paired with c₂₃ it splits the third mass state between the muon and tau flavours.'
  effect: 'Whether θ₂₃ is just below or just above 45° (the "octant") is not yet known.'
c13:
  label: 'c₁₃ = cos θ₁₃'
  what: 'The cosine of the angle θ₁₃ between the first and third states. It is nearly 1, because θ₁₃ is small.'
  why: 'The reactor experiments at about 1.7 km measure θ₁₃ through the disappearance of electron antineutrinos at the atmospheric splitting.'
  effect: 'sin²θ₁₃ is about 0.022 (θ₁₃ is about 8.5°), so only about 2 % of the third mass state is electron-flavour.'
delta:
  label: 'δ, the CP phase'
  what: 'The one complex phase of the PMNS matrix, in radians or degrees. It enters as e^(±iδ) together with s₁₃.'
  why: 'A phase that cannot be removed makes neutrinos and antineutrinos oscillate differently, which is CP violation in the lepton sector. It needs all three angles to be non-zero, and θ₁₃ was the last to be found.'
  effect: 'Not yet determined. Global fits favour values in the region of 200° to 250°, with a wide uncertainty, and values that conserve CP (0° or 180°) are not excluded with confidence.'
s13:
  label: 's₁₃ = sin θ₁₃'
  what: 'The sine of the small angle θ₁₃. It multiplies the phase e^(−iδ) in the matrix, so it controls how large any CP violation can be.'
  why: 'The first row of the matrix says how much of each mass state is electron-flavour. s₁₃ is the electron-flavour content of the third state, and it is small.'
  effect: 's₁₃² ≈ 0.022, so s₁₃ ≈ 0.15. If it were zero, the phase δ would disappear from oscillations altogether.'
c12:
  label: 'c₁₂ = cos θ₁₂'
  what: 'The cosine of the solar angle θ₁₂ between the first and second states.'
  why: 'It is measured by solar neutrinos and by KamLAND and JUNO''s reactor antineutrinos at the solar splitting.'
  effect: 'sin²θ₁₂ is about 0.31 (θ₁₂ is about 34°): large, but not maximal.'
s12:
  label: 's₁₂ = sin θ₁₂'
  what: 'The sine of θ₁₂.'
  why: 'Paired with c₁₂ it gives the electron-flavour content of the first two mass states, 0.69 and 0.31.'
  effect: 'At high energy a solar neutrino leaves the Sun as ν₂, which is ν_e only s₁₂² ≈ 31 % of the time.'
```
:::

The values below are approximate global-fit values (the NuFIT 6.0 fit of 2024, rounded, with the PDG's review as a cross-check); the last column says who measured it.:cite[esteban2024,pdg2024]

| Parameter | Approximate value | Measured mainly by |
|---|---|---|
| $\sin^2\theta_{12}$ | 0.31 ($\theta_{12} \approx 34^\circ$) | solar neutrinos, KamLAND, JUNO |
| $\sin^2\theta_{23}$ | between about 0.45 and 0.57 ($\theta_{23}$ near $45^\circ$) | atmospheric neutrinos, T2K, NOvA |
| $\sin^2\theta_{13}$ | 0.022 ($\theta_{13} \approx 8.5^\circ$) | Daya Bay, RENO, Double Chooz, beams |
| $\delta$ | not determined; the fit's best value is near $210^\circ$ | beams (T2K, NOvA), in the future DUNE and Hyper-Kamiokande |
| $\Delta m^2_{21}$ | $7.5 \times 10^{-5}\ \text{eV}^2$ | solar neutrinos, KamLAND, JUNO |
| $\lvert\Delta m^2_{31}\rvert$ | $2.5 \times 10^{-3}\ \text{eV}^2$ | atmospheric neutrinos, beams, reactors |

Compare this with the quark mixing of Chapter 24. The CKM matrix is nearly diagonal: its off-diagonal elements are about $0.22$, $0.04$ and $0.004$. The PMNS matrix is not at all. Two of its angles are large and the third is not small by the same standard. Nobody knows why quarks and leptons mix so differently, and a theory of flavour that explains both is one of the open problems of the next chapter.

### The oscillation lab

The lab below computes the full $3 \times 3$ probabilities by propagating the neutrino through the Hamiltonian, exactly, at every point of the plot (the box *Under the hood* shows how). It starts from the global-fit values, labelled as such. Choose an experiment, then change the angles and see which of the three curves moves.

::oscillation-lab{n="31.4" caption="Three-flavour oscillation probabilities against L/E for a chosen initial flavour, in vacuum or through matter, for neutrinos or antineutrinos and either mass ordering. By default the curves are averaged over a 10 % spread of energies, as any detector's resolution would do (switch it off to see the full fast oscillations). Presets set the energy and baseline of real experiments; the orange line marks the baseline. The probabilities at that baseline are in the table below the plot, and they add up to 1. Things to try: (1) the reactor presets, and θ₁₃ to zero; (2) the Beam, 295 km preset, ν_μ → ν_e, antineutrinos against neutrinos, and the CP phase δ; (3) the DUNE-like preset, matter on and off, and the ordering."}

Three things to try in it show what the next experiments are after.

- **CP violation.** For the 295 km preset set the initial flavour to $\nu_\mu$ and look at the probability to become $\nu_e$. Now switch to antineutrinos. The difference between the two is the CP violation, and it is proportional to $\sin\delta$ times the :term[Jarlskog invariant]{id=jarlskog-invariant} $J = c_{12}s_{12}c_{23}s_{23}c_{13}^2 s_{13}\sin\delta$, which has a maximum of about 0.033. The quarks' $J$ (Chapter 24) is about $3 \times 10^{-5}$. In the lepton sector CP violation could be a thousand times larger than it is in the quark sector. Whether it is, nobody yet knows.
- **Matter.** For the longer baselines turn matter on. Electron neutrinos feel the same MSW potential as in the Sun, and the sign of the effect is opposite for antineutrinos. It also depends on a thing that vacuum oscillations cannot decide.
- **The mass ordering.** Switch between "normal" and "inverted".

## The mass ordering

Oscillations measure squared differences, and their signs are not all known. Matter effects in the Sun show that $m_2 > m_1$. The solar splitting $\Delta m^2_{21}$ is positive. But the larger splitting between the third state and the other two can be of either sign: the third state can be the heaviest, $m_1 < m_2 < m_3$ (:term[normal ordering]{id=mass-ordering}), or the lightest, $m_3 < m_1 < m_2$ (**inverted ordering**). Both fit every measurement so far. A global fit that includes Super-Kamiokande's atmospheric data prefers the normal ordering, with a $\Delta\chi^2$ of about six, which is an indication and no more.:cite[esteban2024]

The experiments that will decide are of three kinds: long-baseline beams through matter (NOvA now, and DUNE, a beam from Fermilab to liquid-argon detectors of about 70,000 tonnes in total in South Dakota, 1,300 km away, under construction); medium-baseline reactor experiments, which can see the interference of the two frequencies (JUNO); and atmospheric neutrinos in very large detectors (Hyper-Kamiokande, which is under construction, and ice and sea-water telescopes). Each is expected to need years of data.

## How heavy are they?

The mass splittings give a floor. If the lightest neutrino were massless, the normal ordering would give masses of $0$, $0.0087$ and $0.050$ eV, which add up to 0.059 eV, and the inverted ordering would give about $0.049$, $0.050$ and $0$ eV, which add up to about 0.099 eV (all computed from the splittings above in the library's tests). So the heaviest neutrino is at least 0.05 eV, which is about ten million times lighter than the electron. Everything above that floor is the question.

There are three ways to ask.

**Beta decay.** In a beta decay the neutrino takes some of the energy, and the electron's spectrum stops short of the full energy release by an amount that depends on the neutrino's mass, in a way that does not depend on any model. The **KATRIN** experiment in Karlsruhe measures the end of the spectrum of tritium decay with a spectrometer 23 m long, which selects electrons by their energy to a fraction of an eV. It measures an effective electron-neutrino mass $m_\beta = \sqrt{\sum_i |U_{ei}|^2 m_i^2}$. Its 2022 result was $m_\beta < 0.8$ eV at 90 % confidence level.:cite[katrin2022] In 2025, with 259 days of data (36 million electrons in the signal region), it tightened this to $m_\beta < 0.45$ eV.:cite[katrin2025] The experiment was due to finish data-taking in 2025 with a projected sensitivity of about 0.3 eV.

**Cosmology.** Neutrinos were abundant in the early universe and affect how structure grew. Their total mass shows up in the statistics of the cosmic microwave background and of galaxies. Analyses of Planck's data with baryon acoustic oscillations gave a bound of $\sum m_\nu < 0.12$ eV at 95 % confidence,:cite[planck2018] and the DESI survey's 2024 analysis, in the simplest cosmological model, pushed it to 0.072 eV.:cite[desi2024] These bounds are tighter than KATRIN's, but they assume a cosmological model, and the bound of 0.072 eV is not far above the floor of 0.059 eV for the normal ordering and below the 0.099 eV floor for the inverted one. If the model is right, it already favours the normal ordering; whether the model is right is a separate question.

**Neutrinoless double-beta decay.** The third method asks a different question, and it is the one whose answer decides more than a mass.

### Dirac or Majorana?

Every charged fermion has a distinct antiparticle. A neutrino has no electric charge, so nothing forbids it from being its own antiparticle. In 1937 Ettore Majorana wrote the theory of such a particle.:cite[majorana1937] A :term[Majorana neutrino]{id=majorana-neutrino} would be its own antiparticle; a :term[Dirac neutrino]{id=dirac-neutrino} would be distinct from its antineutrino, as an electron is from a positron. Oscillation experiments cannot tell them apart.

A Majorana neutrino would allow a process that the Standard Model forbids, because it violates lepton number: some nuclei that can only decay by emitting two electrons and two antineutrinos could instead emit two electrons and *nothing*. The process is called :term[neutrinoless double-beta decay]{id=neutrinoless-double-beta-decay}. The sum of the two electron energies would then be a sharp line at the energy release. The rate depends on the **effective Majorana mass** $m_{\beta\beta} = |\sum_i U_{ei}^2 m_i|$, in which the Majorana phases enter, so the three masses can add or cancel. The KamLAND-Zen experiment, which dissolves xenon-136 in the liquid scintillator of KamLAND, has set limits on $m_{\beta\beta}$ of 0.036 to 0.156 eV, the range coming from the uncertainty in the nuclear physics needed to turn a decay rate into a mass.:cite[kamlandzen2023]

::mass-bands{n="31.5" caption="The range of the effective Majorana mass m_ββ against the lightest neutrino mass, from the oscillation parameters, for the two orderings (all values of the unknown Majorana phases). The inverted ordering needs m_ββ of at least about 0.015 eV, within reach of the next generation of experiments. The normal ordering can reach zero through a cancellation. Vertical lines: KATRIN's 0.45 eV bound on m_β, and the lightest mass for which the three masses add up to 0.12 eV; horizontal lines: the 0.036 to 0.156 eV range of the KamLAND-Zen limit. If the neutrino is a Dirac particle there is no such band."}

If neutrinoless double-beta decay is seen, neutrinos are Majorana particles and lepton number is violated. If it is not seen at a sensitivity that covers the inverted ordering, neutrinos are either Dirac particles or in the normal ordering with a small lightest mass, and the experiments need to push further.

### Why so light?

For a Dirac neutrino the Higgs mechanism of Chapter 26 gives a mass through a Yukawa coupling $y$, with $m = yv/\sqrt{2}$ and $v = 246$ GeV. For $m = 0.05$ eV this needs $y \approx 3 \times 10^{-13}$. The electron's coupling is $3 \times 10^{-6}$, and the top quark's is about 1. A coupling a million times smaller than the electron's is not forbidden. It does ask for an explanation.

The most popular one needs the neutrino to be a Majorana particle. In the :term[seesaw]{id=seesaw-mechanism} mechanism a very heavy partner of mass $M$ (a right-handed neutrino, which has no weak interaction at all) mixes with the light one, and the light neutrino's mass is

$$m_\nu \approx \frac{m_D^2}{M},$$

where $m_D = yv/\sqrt{2}$ is an ordinary Higgs-type mass of the order of the electroweak scale or less. Making $M$ large makes $m_\nu$ small, hence the name.:cite[minkowski1977,mohapatra1980]

```numeric
id: seesaw-scale
title: The seesaw scale
prompt: 'In the seesaw formula m_ν ≈ m_D²/M, take a Dirac mass m_D = 100 GeV, comparable with the electroweak scale, and the neutrino mass m_ν = 0.05 eV = 5 × 10⁻¹¹ GeV. What heavy mass M, in GeV, does it need?'
answer: 2e14
unit: GeV
tolerance: 0.05
hints:
  - 'Solve for M = m_D²/m_ν, in GeV.'
explain: 'M = (100 GeV)² / (5 × 10⁻¹¹ GeV) = 10⁴ / (5 × 10⁻¹¹) GeV = 2 × 10¹⁴ GeV. That is about a hundred thousand times below the Planck scale and not far below the scale at which the three forces of the Standard Model come near to equal strength (Chapter 32). It is far beyond the reach of any collider, which is why the seesaw can be tested only indirectly, for example by looking for lepton-number violation in neutrinoless double-beta decay.'
```

A heavy Majorana neutrino has another consequence, which Chapter 32 takes up. Its decays in the early universe could favour matter over antimatter.

## The ledger

Chapter 11 collected the conservation laws in a ledger, and promised that some would be struck off. Parity went in Chapter 22 and CP in Chapter 24. Lepton flavour goes here. The individual lepton numbers $L_e$, $L_\mu$ and $L_\tau$ were conserved in every process the course has examined: a muon never decays to an electron and a photon, a $\nu_\mu$ makes a muon and never an electron. Oscillation is a process that changes them. A neutrino that is a $\nu_\mu$ when it is made can be detected as a $\nu_\tau$, and the three numbers are no longer separately conserved. Only the **total** lepton number $L = L_e + L_\mu + L_\tau$ is left in the ledger, and if neutrinos are Majorana particles even that is not exact.

There is an oddity in this. Lepton flavour is changed freely in neutrinos and not seen in charged leptons. The decay $\mu \to e\gamma$, which would turn a muon into an electron, has been looked for in the MEG experiment, which set a limit on its branching fraction of $4.2 \times 10^{-13}$ at 90 % confidence level.:cite[meg2016] The reason is that the neutrino masses are so small that the mixing, which enters the rate as $(\Delta m^2/M_W^2)^2$, suppresses the decay to a branching fraction of $10^{-50}$ or less. If a charged-lepton flavour change were ever seen, it would not come from the neutrinos.

## Under the hood, and in the experiments

:::programmer
Oscillation is a state vector evolving under a matrix, which a programmer would recognise as repeated multiplication by a transition matrix, with one difference. A Markov chain adds probabilities. Here the vector holds complex **amplitudes**, and the probability is the squared modulus at the end, so contributions from different paths interfere: they can cancel as well as add. That is the single difference between a random walk and a quantum one, and it is the origin of the $\sin^2$ in the formula. It also means that for three flavours the code is a $3 \times 3$ complex matrix exponential, $S = e^{-iHL}$.
:::

:::hood[A matrix exponential for an oscillating neutrino]
The library's `probabilities3` builds the Hamiltonian in the flavour basis, $H = \frac{1}{2E}U\,\mathrm{diag}(0, \Delta m^2_{21}, \Delta m^2_{31})\,U^\dagger + \mathrm{diag}(V,0,0)$, and the amplitude for $\nu_\alpha \to \nu_\beta$ is the $(\beta,\alpha)$ element of $e^{-iHL}$. The exponential is computed by scaling and squaring: halve $HL$ until its norm is small, sum the Taylor series, then square the result back up. The matter potential $V$ is constant inside a layer, so a path through several layers is a product of such exponentials.

```ts
export function evolve(H: CMat3, LeV: number): CMat3 {
  const A = scale3(H, LeV); // H·L: dimensionless, Hermitian; we want exp(−i A)
  // ... nrm is the largest row sum of |A_ij| ...
  let squarings = 0;
  while (nrm > 0.25) {
    nrm /= 2;
    squarings++;
  }
  const B = scale3(A, 1 / 2 ** squarings);
  // M = −iB, as (re, im) = (B.im, −B.re)
  let term = identity3();
  let sum = identity3();
  for (let k = 1; k <= 14; k++) {
    term = scale3(mul3(term, M), 1 / k);
    sum = add3(sum, term);
  }
  for (let s = 0; s < squarings; s++) sum = mul3(sum, sum);
  return sum;
}
```

Why not use the closed-form eigenvalue formulae? In vacuum there is one, and the module tests against it. In matter with all three flavours, a closed form exists but needs care when two eigenvalues are close, which they are when $\theta_{13}$ or $\Delta m^2_{21}$ is switched to zero in the lab. The exponential has no special cases. It is checked three ways: the rows and columns of the probability matrix sum to one to $10^{-9}$ (unitarity), the two-flavour limit agrees with the textbook MSW formula to $10^{-6}$, and the difference between neutrino and antineutrino in vacuum equals $16J \sin\Delta_{21}\sin\Delta_{31}\sin\Delta_{32}$, the Jarlskog form, for the default parameters.
:::

:::experiments
The experiments of this chapter share a toolkit. **Neutrino event generators** such as GENIE and NEUT play the role that Pythia plays for the LHC: they simulate how a neutrino of a given energy interacts with a nucleus, which is the hardest input to any long-baseline analysis, because a nucleus is not a free proton and the cross-sections are known to ten per cent at best. **Flux predictions** for a beam come from simulating the hadrons that make the neutrinos, constrained by dedicated hadron-production measurements, and a **near detector** measures the beam before it oscillates, so that most of the uncertainty cancels in the ratio of far to near. Global fits, such as the NuFIT collaboration's, combine all the results into one set of parameters. The toy of this chapter does none of this: it computes $P$ for a single energy and a single baseline. The real analyses average $P$ over the spectrum of neutrino energies and fit the observed event rates, in bins of energy, in the near and far detectors together.
:::

## What comes next

Neutrino masses are the first physics beyond the Standard Model that the experiments have proved. They are small, their ordering and their nature are unknown, and the best explanation of their smallness involves a particle that we cannot make. [Chapter 32](/chapters/beyond-the-standard-model/) asks what else is missing: the dark matter that makes up most of the matter in the universe, the asymmetry between matter and antimatter that the early universe left behind (and the possible role of the heavy neutrinos of the seesaw in it), the hierarchy of scales, and what the LHC has and has not found. It ends with a search of your own, simulated: a hypothetical new particle, the dimuon spectrum, and a limit.

## Further reading

- The Particle Data Group's review of neutrino masses, mixing and oscillations, in the *Review of Particle Physics* (:cite[pdg2024]), and the NuFIT collaboration's global fit (:cite[esteban2024]).
- The two papers of 1998 and 2001–2002 that earned the 2015 Nobel Prize: Super-Kamiokande (:cite[fukuda1998]) and SNO (:cite[ahmad2001,ahmad2002]).
- The KATRIN result of 2025 (:cite[katrin2025]) and the first JUNO result (:cite[juno2025]).
- The astrophysics course's chapter on [fusion](/astrophysics/ch/fusion/), for the Sun's neutrinos from the other side.
