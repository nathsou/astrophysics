# hep/fields

Numerics for the field-theory interactives (Chapters 14, 17, 18, 26). Pure TypeScript: seeded (`Rng` from `hep/random`), no DOM, no Svelte, no Node APIs. From the reader's exercises: `import { ... } from 'hep/fields'`.

| Module | Exports |
|---|---|
| `constants` (as `constants`) | `HBARC_GEV_FM`, `HBARC_MEV_FM`, `HBAR_GEV_S`, `G_F`, `M_ELECTRON_MEV` (copies of `hep/units`, checked by a test) |
| `fft` | `fft(re, im, inverse?)` radix-2 in place, `fft2(re, im, rows, cols)`, `hann(n)`, `isPow2` |
| `bessel` | `besselI(n, x)`, `besselIScaled(n, x)` (= e^−x I_n), `besselI0/1`, `besselRatio(x)` = I₁/I₀ |
| `lattice` | `KGChain` (1D periodic Klein–Gordon chain, leapfrog: `step`, `run`, `energy`, `energyDensity`, `centroid`, `pluck`, `addPacket` (clean one-way packet), `addNoise`, `modeEnergies`, `set({m, lambda})`), `KGSheet` (2D), `defaultKG`, `isStable`, dispersion: `omegaContinuum`, `omegaLattice`, `omegaNumerical`, `groupVelocityLattice`, `particleVelocity`, `measureDispersion(params, rng, nt, stepsPerSample)` (2D FFT of φ(x,t) from seeded noise), `fitVelocity` |
| `yukawa` | `rangeFm(mMeV)`, `massFromRangeMeV(R)`, `massInElectronMasses`, `virtualLifetimeS`, `yukawaShape`, `yukawaPotentialMeV`, `yukawaForceMeVPerFm`, `propagator(q, m)` |
| `gauge` | U(1) phase grid with link field: `makePhaseField`, `zeroLinks`, `rotate`, `rotateGlobal`, `randomAngles`, `transformLinks`, `energyNaive`, `energyCovariant`, `plaquette(s)`, `fieldEnergy`, `setUniformFlux`, `addFluxTube`, `maxFluxDifference`, `wrapAngle` |
| `u1lattice` | `U1Lattice(L, rng, hot?)` 2D compact U(1): `sweepMetropolis(beta, delta, hits)`, `sweepHeatbath(beta)`, `meanPlaquette`, `wilsonLoop(R, T, window?)`, `loadLinks`; `vonMises`, `blockStats`, `metropolisDelta`; exact `exactPlaquette(β) = I₁/I₀`, `exactWilson`, `exactStringTension` |
| `string` | `StringModel` (1D yo-yo string, exact energy accounting), `defaultStringParams`, `cornellPotential`, `cornellForce`, `coulombForce`, `thresholdLength`, `fragment(rng, params)` (Lund-like jet of pseudoscalar mesons, exact E, p, charge), `rapidityPlateau`, `mesonId` |
| `higgs` | `V_EW_GEV` (from G_F), `lambdaFromMass`, `higgsMass`, `muSquared`, `vevFromMu`, `hatDepth`, `yukawaCoupling`, `massFromYukawa`, `potential`, `radialMass2`, `goldstoneMass2`, `hatU`, `HatBall` (damped ball on the hat) |
| `spectrum` | `spectrumEntries()` (SM masses from `hep/particles`), `neutrinoBand()`, `withYukawa`, `NEUTRINO_LIMIT_EV`, `NEUTRINO_HEAVIEST_LOWER_EV` |

Notes: the classes avoid TypeScript parameter properties (they break Node's type-stripping mode). The chain needs a power-of-two length for the FFT helpers. The optional WebGPU backend for the lattice gauge demo lives with the widget (`src/lib/sims/fields/gpu.ts`), not here.

Tests: `npx vitest run src/lib/hep/fields src/lib/sims/fields`.
