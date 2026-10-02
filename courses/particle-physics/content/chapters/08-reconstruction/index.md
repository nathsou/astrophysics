---
number: 8
title: Reconstruction
summary: From thousands of hits and calorimeter cells to tracks, vertices, electrons, photons, muons and jets. Seeding and its combinatorics, the Hough transform, the Kalman filter, vertex finding, clustering and particle flow, and how efficiency and fake rate are measured against the simulated truth.
duration: Three sessions, with optional implementation extensions
prerequisites: [building-a-detector]
---

:::note
**Read this chapter in three sessions.** Session 1: find candidate tracks. Session 2: update an estimate. Session 3: reconstruct the event. Each session has a stopping point; the section menu remembers where you paused.
:::


The detector of Chapter 7 does not report particles. It reports *signals*: a position in a silicon layer, an energy in a calorimeter cell, a hit in a muon chamber. In a crossing of the LHC's beams with fifty collisions at once, there are some 7,700 hits in the course detector's tracker alone, 8,000 calorimeter cells with energy, and a few hundred real particles somewhere in them (these numbers are from the library's notes on `hep/reco`), and nothing on a hit says which particle it came from. **:term[Reconstruction]{id=reconstruction}** is the software that works backwards from the signals to the particles. It is an *inverse problem*: the forward direction (given particles, what does the detector record?) is physics, and it is what the simulation of Chapter 7 computes. The inverse (given what it recorded, which particles?) has no formula, and it is solved by algorithms. This chapter writes two of them.

::event-display-widget{sample="pileup" n="8.1" views="rphi,rz" caption="A simulated Z → μ⁺μ⁻ event with pile-up, seen in the event display's simplified detector model. The two muons are in there, among the tracks of some thirty other collisions. The display draws the reconstructed objects and the calorimeter towers; with truth switched on it also draws what was really there. This display uses its own event generator, a stand-in for the library's simulation, which the figures later in the chapter use."}

Two ideas run through the chapter. The first is **truth and reconstruction**: every simulated event exists twice, as what the generator produced (the *truth*) and as what the algorithms found (the *reconstruction*), linked object by object. Simulated hits remember which particle made them, so every track the software finds can be asked: *which particle are you?* Comparing the two measures how good the software is, and is the only way to know. With real data only the reconstruction exists, so the numbers measured on simulation are what you trust when you use the software on data (Chapter 29 makes this point sharply). The second idea is that **reconstruction is mostly a combinatorial problem**. Finding the right hits is hard because there are so many wrong ways to choose them, and the algorithms of this chapter are, above all, ways of not trying most of the wrong ones.


:::note
**Session 1: find candidate tracks.** Compare seeding and the Hough transform. Predict the effect of an extra unrelated hit; stop before the Kalman filter.
:::

## Seeding and combinatorics

A track is one hit in each of several layers, lying on a smooth curve. The naive algorithm is to try every choice of one hit per layer and keep the ones that fit a helix. It cannot work. With 8 layers and about 900 hits in each (what a crossing with 50 pile-up collisions gives in the course detector, about 7,700 hits in all), there are $900^8 \approx 4\times10^{23}$ ways to choose one hit per layer.

```fermi
id: triplet-count
title: How many triplets of hits?
prompt: A crossing with 50 pile-up collisions leaves about 900 hits in each of the inner tracker layers. How many ways are there to choose one hit from each of the first three layers?
answer: 7.3e8
factor: 3
hints:
  - Choose a hit from layer 0 (900 ways), then from layer 1 (900 ways), then from layer 2 (900).
explain: "900³ = 7.3 × 10⁸. A computer can test that many triplets, but not in the few tens of milliseconds a reconstruction has, and it would find that nearly all of them are not tracks. The seeding of the next section reduces the number it has to test by a factor of a million, by asking of each pair of hits only whether a track with a reasonable momentum could pass through both."
```

A track finder breaks the problem in two. It first builds a :term[seed]{id=seed}, a small set of hits (usually three, in the innermost layers where the hits are most precise and the track is least affected by scattering) that *could* belong to one track. It then **extends** the seed outwards, layer by layer, looking in each for a hit near where the track would be. The search is cheap because of three kinds of constraint:

- **Windows.** A pair of hits in two adjacent layers defines a direction. Only hits in the third layer that lie within a narrow window around the extrapolation are tried. The width of the window is set by the lowest momentum of interest, because low-momentum tracks bend more, and by the position resolution and multiple scattering.
- **The beam line.** Tracks of interest come from the interaction region, so a circle through the three hits that misses the beam line by more than a few millimetres (an *impact parameter* cut) is rejected.
- **z consistency.** The straight line of hits in the $s$–$z$ plane must point at the luminous region.

The library's finder (`findTracks` in `hep/reco`) uses exactly these. Its seeds are triplets in three of the four innermost layers, in three passes (high-momentum prompt tracks with narrow windows first, then everything with the hits that are left over, then triplets that skip a layer). A seed is extended by a *road*: the circle through the seed is intersected with each next layer, the road is as wide as four times the uncertainty of the extrapolation, and the nearest hit in it is taken. The candidates are fitted, ranked by how many hits they have and then by $\chi^2$, and a candidate that shares more than one hit with a better one is dropped (*ambiguity resolution*). The hits of accepted tracks are removed from later seeds.

The cost of the whole procedure is dominated by the number of seeds, and it grows much faster than the number of collisions. The table is from the figure at the end of this chapter, run with the library's finder, for 5 simulated crossings at each pile-up (a hard collision with six pions plus the pile-up):

| Pile-up collisions | Hits | Seeds tried | Tracks found |
|---|---|---|---|
| 0 | 51 | 7 | 6 |
| 10 | 1,543 | 138 | 120 |
| 50 | 7,724 | 1,365 | 610 |
| 100 | 15,111 | 6,197 | 1,192 |
| 200 | 30,020 | 40,527 | 2,391 |

(Averages over the figure's 5 events per point, with its default settings.) Going from 50 to 200 collisions makes four times as many tracks and 30 times as many seeds, so the number of seeds grows about as the 2.5th power of the pile-up. That is the :term[combinatorial]{id=combinatorics} explosion of high-luminosity running, and it is why track reconstruction is among the most computing-intensive steps of an LHC experiment, and why the High-Luminosity LHC, planned for 140 to 200 collisions per crossing,:cite[hllhc-tdr] is a software problem as well as a hardware one.

```predict
q: 'In a crossing the number of hits in each layer doubles (twice the pile-up). Roughly how does the number of triplets of hits, one from each of three layers, change if nothing is done to restrict the search?'
options:
  - text: It doubles.
    why: 'That would be so if one went through the hits one by one. A triplet is a choice from each of three layers, and the choices multiply.'
  - text: It grows by a factor of 8.
    correct: true
    why: 'The number of triplets is N × N × N = N³, so doubling N multiplies it by 2³ = 8. The windows of the seeding reduce the constant, but not the way it grows: in the library the number of seeds went up by 4.5 when the pile-up doubled from 50 to 100, and by 6.5 from 100 to 200, between the quadratic and the cubic.'
  - text: It does not change, because the same real tracks are there.
    why: 'The real tracks do not matter for the cost: the algorithm has to reject every wrong triplet to find the right ones, and doubling the hits makes eight times as many wrong ones.'
```

## The Hough transform

There is another way to find a track, the :term[Hough transform]{id=hough-transform}, which does not choose hits at all. Think about what one hit can say. A hit at radius $r$ and azimuth $\varphi$ is compatible with many tracks: one for each direction in which a track could leave the origin, with the curvature that makes it reach this hit. A track from the origin with direction $\varphi_0$ and signed curvature $\kappa$ (the reciprocal of its radius, positive if it turns towards increasing azimuth) passes through a point at distance $r$ at the azimuth given by the chord of its circle:

:::equation{#hough caption="The azimuth at which a circle through the origin, with curvature κ, leaving at azimuth φ₀, crosses the radius r. Rearranged, it gives the curvature a track must have to reach a hit at (r, φ) if it leaves at φ₀: each hit is a curve in the (φ₀, κ) plane."}
$$\sin(\term{phi}{\varphi} - \term{phi0}{\varphi_0}) \;=\; \frac{\term{kappa}{\kappa}\,\term{r}{r}}{2}\qquad\Longleftrightarrow\qquad \kappa = \frac{2\sin(\varphi-\varphi_0)}{r}$$

```terms
phi:
  label: 'φ, the azimuth of the hit'
  what: The angle of the hit around the beam, from the x axis. It is measured.
  why: With r it is the hit's position in the transverse plane.
  effect: Rotating the whole event shifts every φ and φ₀ by the same amount and leaves κ unchanged.
phi0:
  label: 'φ₀, the direction of the track at the origin'
  what: The azimuth of the track's direction where it leaves the interaction point. It is one of the two unknowns.
  why: Together with the curvature it fixes the whole circle, if the track comes from the origin.
  effect: One value of φ₀ for each track; the other tracks have other values.
kappa:
  label: 'κ, the curvature of the track'
  what: One over the radius of the track's circle, in 1/mm, positive for a track that turns towards increasing azimuth. It is the other unknown, and gives the transverse momentum through pT = 0.3 B / κ.
  why: Stiff, high-momentum tracks have κ near zero; soft tracks have large |κ|. Its sign gives the sign of the charge.
  effect: At 3.8 T a track of pT = 1 GeV has |κ| = 0.00114 mm⁻¹.
r:
  label: 'r, the radius of the hit'
  what: The distance of the hit from the beam axis, in mm. It is known from which layer the hit is in.
  why: A hit at a small r is compatible with a wide range of curvatures (the curve in the plane is steep); a hit at a large r pins down the curvature better.
  effect: The hits in the inner layers vote across many cells and those in the outer layers across few, so the outer layers sharpen the peaks.
```
:::

Make a grid over the plane of $(\varphi_0, \kappa)$, the *accumulator*, and let every hit **vote**: add one to every cell on the curve $\kappa = 2\sin(\varphi - \varphi_0)/r$. The hits of one track all lie on a circle through the origin, so all their curves pass through the same point, the track's own $(\varphi_0, \kappa)$, which gets a vote from each. Random hits make curves that cross each other only occasionally. The tracks are therefore the **peaks** of the accumulator. The method never chooses a triplet: the work is proportional to the number of hits times the number of $\varphi_0$ bins.

:::history{year=1959 title="Tracks found by voting" people="Paul V. C. Hough" source="Sources: Hough (1959), Proc. Int. Conf. on High Energy Accelerators and Instrumentation, CERN; US patent 3,069,654 (filed 1960, granted 1962); Duda and Hart (1972)."}
Paul Hough was a physicist working on bubble-chamber pictures. At the International Conference on High-Energy Accelerators and Instrumentation held at CERN in September 1959 he presented a paper on the machine analysis of bubble-chamber pictures, on how a computer could recognise the tracks.:cite[hough1959] A patent application followed in March 1960, and the patent, "Method and means for recognizing complex patterns", was granted in December 1962; it describes the recognition of lines in photographs and is explicit that it is suited to the tracks of subatomic particles.:cite[hough1962] In essence the idea is to represent each point of a picture by the set of all the lines through it, and to look for the line that many points have in common. In 1972 Richard Duda and Peter Hart gave the transform the form used in image processing, by describing a line by its distance from the origin and the angle of its normal, and called it the Hough transformation.:cite[duda1972] A method made to find particle tracks in photographs is now part of nearly every computer-vision library, for finding lines, circles and edges.
:::

::hough-lab{n="8.2" caption="The Hough transform for tracks from the origin. Left: hits in the transverse plane, from a few tracks (with positions smeared by 50 μm) hidden among noise hits; the orange circles are the tracks found. Right: the accumulator, with φ₀ across and κ upwards; brightness is the number of votes. The peaks are circled in orange; the true tracks are dashed green. Change the number of tracks and noise hits, and the size of the cells, and watch the peaks stand out of the noise or drown in it. With 'use my code' the figure runs your houghTransform once you have written it below."}

The cost is the grid, and the grid has a resolution: too coarse and the votes of one track fall in the same cell but so do those of unrelated tracks; too fine and the votes of one track are spread over several cells because of the position errors, and no cell has enough. In a dense event the grid has another problem: hits of different tracks line up by accident, and the accumulator is full of peaks as high as the real ones. The method works well for a handful of tracks in a few layers, and is hopeless for the thousands of hits of a pile-up crossing. We return to this at the end of the chapter, where the figure lets the reader replace the library's triplet seeds with seeds from the transform.

```code
id: hough-transform
optional: true
title: A Hough transform
hook: reco.houghTransform
prompt: |
  Implement `houghTransform(hits, opts)` for tracks from the origin. The accumulator is an array of `nAngle × nCurv` cells (`Float32Array`, index
  `iAngle · nCurv + iCurv`), with φ₀ in `nAngle` equal bins covering [−π, π) and κ in `nCurv` equal bins covering [−maxCurv, +maxCurv].
  For each hit (x, y), with r = √(x² + y²) and azimuth φ = atan2(y, x) (skip hits with r ≈ 0): for each φ₀ bin whose **centre** is within ±90° of φ
  (that is, cos(φ − φ₀) > 0: the track moves outwards; without this rule every track would also make a second peak at (φ₀ + π, −κ)), compute κ = 2 sin(φ − φ₀)/r at the two **edges**
  of the bin, and add one vote to every κ bin between the two values (a φ₀ bin is an interval, so the hit's curve crosses several κ bins in it).
  Then find the peaks: a cell with at least `minVotes` votes that is at least as large as its eight neighbours (periodic in φ₀; a plateau counts once: of
  equal cells the one first in scan order wins). Return them strongest first, at most `maxPeaks`, as `{ phi0, curvature, votes }` with the cell's centre as position.
  The defaults are `nAngle` 256, `nCurv` 64, `maxCurv` 0.004, `minVotes` 4 and `maxPeaks` 500.
starter: |
  import type { HoughOptions, HoughResult, HoughPeak } from 'hep/reco';

  export function houghTransform(hits: readonly { x: number; y: number }[], opts: HoughOptions = {}): HoughResult {
    const nAngle = opts.nAngle ?? 256;
    const nCurv = opts.nCurv ?? 64;
    const maxCurv = opts.maxCurv ?? 0.004;
    const minVotes = opts.minVotes ?? 4;
    const maxPeaks = opts.maxPeaks ?? 500;
    const acc = new Float32Array(nAngle * nCurv);
    const peaks: HoughPeak[] = [];
    // 1. for each hit and each φ₀ bin: the κ range of the bin and the votes
    // 2. the peaks: local maxima of acc with at least minVotes, strongest first
    return { accumulator: acc, nAngle, nCurv, peaks };
  }
tests: |
  import { test, expect } from '@pp/test';
  import { houghTransform } from 'solution';
  import { helix } from 'hep/detector';
  import { fromPtEtaPhiM } from 'hep/kinematics';
  import { rng, normal } from 'hep/random';

  const LAYERS = [35, 70, 110, 160, 280, 500, 800, 1100];
  const B = 3.8;

  /** One track from the origin: its hits (smeared by 0.05 mm) and its true φ₀ and curvature κ (1/mm, positive = anticlockwise). */
  function track(pt: number, charge: number, phi: number, r = rng(1)) {
    const h = helix(fromPtEtaPhiM(pt, 0.2, phi, 0.13957), charge, [0, 0, 0], B);
    const hits = LAYERS.map((R) => {
      const p = h.pointAt(h.intersectCylinder(R, 5000)!);
      return { x: p[0] + 0.05 * normal(r), y: p[1] + 0.05 * normal(r) };
    });
    return { hits, phi0: h.phi0, kappa: h.omega };
  }
  const near = (p: { phi0: number; curvature: number }, t: { phi0: number; kappa: number }, nAngle: number) => {
    let d = Math.abs(p.phi0 - t.phi0);
    d = Math.min(d, 2 * Math.PI - d);
    return d < 2 * ((2 * Math.PI) / nAngle) && Math.abs(p.curvature - t.kappa) < Math.max(0.12 * Math.abs(t.kappa), 3 * (0.008 / 64));
  };

  test('the accumulator has nAngle × nCurv cells, and one hit votes in about half of the φ₀ columns', () => {
    const r = houghTransform([{ x: 500, y: 0 }], { nAngle: 64, nCurv: 32, minVotes: 1 });
    expect(r.accumulator).toBeInstanceOf(Float32Array);
    expect(r.accumulator.length).toBe(64 * 32);
    expect(r.nAngle).toBe(64);
    expect(r.nCurv).toBe(32);
    let columns = 0;
    for (let j = 0; j < 64; j++) {
      let s = 0;
      for (let b = 0; b < 32; b++) s += r.accumulator[j * 32 + b]!;
      if (s > 0) columns++;
    }
    expect(columns).toBeGreaterThan(24);
    expect(columns).toBeLessThanOrEqual(34);
  });

  test('three clean tracks give three peaks with nearly all their hits, strongest first, at the right place', () => {
    const ts = [track(3, -1, 0.5), track(12, 1, -2.0), track(0.8, 1, 2.4)];
    const r = houghTransform(ts.flatMap((t) => t.hits), { nAngle: 256, nCurv: 64, minVotes: 5 });
    expect(r.peaks.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < r.peaks.length; i++) expect(r.peaks[i - 1]!.votes).toBeGreaterThanOrEqual(r.peaks[i]!.votes);
    for (const t of ts) {
      const m = r.peaks.slice(0, 6).find((p) => near(p, t, 256));
      expect(m, `a peak near φ₀ = ${t.phi0.toFixed(2)}, κ = ${t.kappa.toExponential(2)}`).toBeTruthy();
      expect(m!.votes).toBeGreaterThanOrEqual(7);
    }
  });

  test('four tracks are found among 120 random noise hits', () => {
    const r0 = rng(5);
    const ts = [track(2, 1, 1.0, r0), track(5, -1, -0.4, r0), track(9, 1, 2.9, r0), track(1.5, -1, -2.6, r0)];
    const hits = ts.flatMap((t) => t.hits);
    for (let i = 0; i < 120; i++) {
      const R = LAYERS[Math.floor(r0() * LAYERS.length)]!;
      const a = -Math.PI + 2 * Math.PI * r0();
      hits.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
    }
    const r = houghTransform(hits, { nAngle: 256, nCurv: 64, minVotes: 6 });
    for (const t of ts) expect(r.peaks.some((p) => near(p, t, 256)), `track at φ₀ = ${t.phi0.toFixed(2)}`).toBe(true);
  });

  test('the φ₀ axis wraps around: a track pointing at φ₀ ≈ π is found', () => {
    const t = track(4, -1, 3.12);
    const r = houghTransform(t.hits, { nAngle: 128, nCurv: 48, minVotes: 6 });
    expect(r.peaks.length).toBeGreaterThan(0);
    expect(near(r.peaks[0]!, t, 128)).toBe(true);
  });

  test('options are respected and degenerate input is safe', () => {
    const t = track(6, 1, 0.3);
    const few = houghTransform(t.hits, { nAngle: 128, nCurv: 48, minVotes: 2, maxPeaks: 3 });
    expect(few.peaks.length).toBeLessThanOrEqual(3);
    const none = houghTransform([], { nAngle: 32, nCurv: 16 });
    expect(none.peaks.length).toBe(0);
    const origin = houghTransform([{ x: 0, y: 0 }, ...t.hits], { nAngle: 128, nCurv: 48, minVotes: 6 });
    expect(origin.accumulator.every((v) => Number.isFinite(v))).toBe(true);
    expect(origin.peaks.length).toBeGreaterThan(0);
  });
solution: |
  import type { HoughOptions, HoughResult, HoughPeak } from 'hep/reco';

  export function houghTransform(hits: readonly { x: number; y: number }[], opts: HoughOptions = {}): HoughResult {
    const nAngle = opts.nAngle ?? 256;
    const nCurv = opts.nCurv ?? 64;
    const maxCurv = opts.maxCurv ?? 0.004;
    const minVotes = opts.minVotes ?? 4;
    const maxPeaks = opts.maxPeaks ?? 500;
    const acc = new Float32Array(nAngle * nCurv);
    const dA = (2 * Math.PI) / nAngle;
    const scale = nCurv / (2 * maxCurv);
    const centre = (j: number) => -Math.PI + (j + 0.5) * dA;

    for (const h of hits) {
      const r = Math.hypot(h.x, h.y);
      if (r < 1e-9) continue;
      const phi = Math.atan2(h.y, h.x);
      for (let j = 0; j < nAngle; j++) {
        // only directions within ±90° of the hit's own azimuth (the track moves outwards)
        if (Math.cos(phi - centre(j)) <= 0) continue;
        // κ at the two edges of the φ₀ bin: every κ bin in between gets a vote
        const k1 = (2 * Math.sin(phi - (centre(j) - dA / 2))) / r;
        const k2 = (2 * Math.sin(phi - (centre(j) + dA / 2))) / r;
        let b0 = Math.floor((Math.min(k1, k2) + maxCurv) * scale);
        let b1 = Math.floor((Math.max(k1, k2) + maxCurv) * scale);
        if (b1 < 0 || b0 >= nCurv) continue;
        b0 = Math.max(b0, 0);
        b1 = Math.min(b1, nCurv - 1);
        for (let b = b0; b <= b1; b++) acc[j * nCurv + b]! += 1;
      }
    }

    // peaks: cells at least as large as their 8 neighbours (periodic in φ₀), a plateau counted once
    const peaks: HoughPeak[] = [];
    for (let j = 0; j < nAngle; j++) {
      for (let b = 0; b < nCurv; b++) {
        const v = acc[j * nCurv + b]!;
        if (v < minVotes) continue;
        let isMax = true;
        for (let da = -1; da <= 1 && isMax; da++) {
          for (let db = -1; db <= 1; db++) {
            if (da === 0 && db === 0) continue;
            const bb = b + db;
            if (bb < 0 || bb >= nCurv) continue;
            const u = acc[((j + da + nAngle) % nAngle) * nCurv + bb]!;
            if (u > v || (u === v && (da < 0 || (da === 0 && db < 0)))) {
              isMax = false;
              break;
            }
          }
        }
        if (isMax) peaks.push({ phi0: centre(j), curvature: -maxCurv + (b + 0.5) / scale, votes: v });
      }
    }
    peaks.sort((p, q) => q.votes - p.votes);
    if (peaks.length > maxPeaks) peaks.length = maxPeaks;
    return { accumulator: acc, nAngle, nCurv, peaks };
  }
hints:
  - 'For a hit and a φ₀ bin with centre c and width dA, the two κ values are 2 sin(φ − (c − dA/2))/r and 2 sin(φ − (c + dA/2))/r. Convert each to a bin with Math.floor((κ + maxCurv) × nCurv / (2 maxCurv)); clip the range to [0, nCurv − 1] and skip the hit for this column if the range lies outside.'
  - 'A cell is a peak if no neighbour is larger, and if of the neighbours that are equal none comes earlier in scan order (smaller iAngle, or the same iAngle and smaller iCurv): that gives a plateau a single peak.'
  - 'Wrap φ₀ with ((j + da + nAngle) % nAngle); do not wrap κ (the cells beyond ±maxCurv do not exist).'
```


:::note
**Session 2: update an estimate.** Understand one residual, its uncertainty and the gain. A variance is a squared uncertainty; doubling an uncertainty multiplies its variance by four. Predict whether a noisier measurement should move the estimate more or less. Full matrix implementation is optional.
:::

## The Kalman filter

Once the hits of a track have been found, the track must be *fitted*: the five parameters of its helix, and their uncertainties, estimated from the measured points. A least-squares fit does it all at once, and the circle fit of Chapter 5 is an example. But there is a better way, one that is also the way to *find* the hits in the first place. It adds one measurement at a time and keeps, at every step, the best estimate of the state so far and how uncertain it is. It is the :term[Kalman filter]{id=kalman-filter}, and it is one of the most widely used algorithms in engineering: it is how a phone's GPS receiver, for example, combines its noisy position fixes with a model of how fast you are moving.

The *state* $\vec x$ is the vector of what we want to know about the track at the layer we have reached: for the toy example in the figure below, its height and slope; for the library's fit, five numbers (the azimuth and $z$ of the point on the layer's cylinder, the direction, $\tan\lambda$ and the curvature). The filter also keeps the *covariance matrix* $P$ of the state, which says how well each component is known and how the errors of different components are correlated. At each layer it does two things.

**Predict.** The track moves on to the next layer. The state is propagated by the equations of motion (a helix in a field, a straight line without), and the covariance grows, both because the uncertainty of the state spreads as the track extrapolates (a small error in the slope becomes a larger error in height further out) and because the particle scatters, which adds a random kick.

**Update.** The next layer measures something, a position. The filter compares the measurement with the prediction, and moves the state by a fraction of the difference. The fraction, the **gain** $K$, is chosen by how well each is known: if the measurement is more precise than the prediction, follow it; if the prediction is better, hardly move.

:::equation{#kalman-predict caption="The prediction step of the Kalman filter: propagate the state with the equations of motion, and its covariance with the same matrix plus the process noise (the random kicks of scattering)."}
$$\vec x' = \term{F}{F}\,\vec x,\qquad \term{Pp}{P'} = F\,\term{P}{P}\,F^{\mathsf T} + \term{Q}{Q}$$

```terms
F:
  label: 'F, the propagation matrix'
  what: 'The matrix that carries the track parameters from one layer to the next. For a straight track with state (height, slope) and layers a distance Δx apart it is [[1, Δx], [0, 1]]: the new height is the old height plus the slope times Δx.'
  why: It is the equation of motion written as a matrix, linearised if the real motion is not linear (as for a helix).
  effect: 'It moves the state, and with Fᵀ it spreads the covariance: a small slope error becomes a larger height error with distance.'
P:
  label: 'P, the covariance of the state'
  what: A matrix whose diagonal holds the variances of the components of the state and whose off-diagonal entries hold their correlations. Its square roots are the uncertainties.
  why: It says how much to trust the current state against the next measurement, and it is the track's error matrix at the end.
  effect: Every update makes it smaller (a measurement adds information); every prediction makes it larger.
Pp:
  label: "P', the predicted covariance"
  what: The covariance of the state after it has been moved to the next layer.
  why: It is what the update step compares with the measurement's uncertainty.
  effect: It is larger than P in the direction in which the extrapolation amplifies errors, and in the directions that scattering disturbs.
Q:
  label: 'Q, the process noise'
  what: 'The covariance of the random kicks that the particle receives between layers: for multiple scattering, the variance of the change of direction, from Highland''s formula.'
  why: Without it the filter would trust old measurements for ever; with it the filter forgets a little at each layer.
  effect: More material or lower momentum means a larger Q and a filter that follows each new hit more closely.
```
:::

:::equation{#kalman-update caption="The measurement update: the innovation y, its covariance S, the gain K, the new state and covariance (in the numerically robust Joseph form), and the contribution of this measurement to the track's χ²."}
$$\vec y = \vec z - \term{H}{H}\vec x,\quad S = H P' H^{\mathsf T} + \term{R}{R},\quad K = P' H^{\mathsf T} S^{-1},\quad \vec x^{+} = \vec x + K\vec y,\quad P^{+} = (1-KH)\,P'\,(1-KH)^{\mathsf T} + K R K^{\mathsf T},\quad \chi^2 = \vec y^{\mathsf T} S^{-1}\vec y$$

```terms
H:
  label: 'H, the measurement matrix'
  what: The matrix that picks out of the state what the layer measures. A layer that measures only the height of a (height, slope) state has H = [1, 0].
  why: The detector measures positions, not slopes, so only some combinations of the state can be compared with the data.
  effect: Because the covariance links height and slope, a measurement of the height alone still improves the slope, through the gain.
R:
  label: 'R, the measurement covariance'
  what: 'The variance of the measurement: for a layer with position resolution σ it is σ² (a matrix, if several numbers are measured at once).'
  why: It says how far to trust the measurement.
  effect: A precise measurement (small R) pulls the estimate towards it; a poor one hardly changes anything.
```
:::

The structure is a weighted average, and in the simplest case, one number, it is exactly that. If the state is a single position with variance $P$ and the measurement $z$ has variance $R$, then the gain is $K = P/(P+R)$, the new estimate is $x + K(z - x)$, and the new variance is $P^+ = (1 - K)P$, which is smaller than both $P$ and $R$: $1/P^+ = 1/P + 1/R$. Information adds. For a state of several components the same algebra holds with matrices, and the off-diagonal entries of $P$ are what allow a measurement of one component to correct another. Figure 8.3 steps through a track layer by layer.

::kalman-lab{n="8.3" caption="A Kalman filter following a toy track (a straight line with small random kicks, measured in eight layers). Press 'Next layer' to see the prediction (blue, with its uncertainty), the measurement (black, with its error bar), the update (orange) and the numbers that produced it: innovation, gain, new state and χ². Change the measurement error and the scattering: with accurate measurements the gain is large and the estimate follows each point; with large scattering the filter forgets old measurements. With 'use my code' the update is your kalmanUpdate, from the exercise below."}

:::history{year=1960 title="A recursion for noisy measurements" people="Rudolf E. Kalman" source="Source: Kalman (1960), Journal of Basic Engineering 82, 35."}
In 1960 Rudolf Kalman, an engineer and mathematician, published in the *Journal of Basic Engineering* a paper on linear filtering and prediction. It recast the filtering problem as a recursion on a *state*: the optimal estimate is updated, step by step, by the *innovation*, the part of the latest measurement that could not have been predicted from the earlier ones, with a gain computed from the covariance of the error, so that no old measurement has to be stored.:cite[kalman1960] The work was not about particles. It was about estimating the state of a dynamical system from noisy measurements, the problem of guiding a vehicle, and the method has become standard throughout engineering.
:::

:::history{year=1987 title="The Kalman filter meets the track fit" people="Rudolf Frühwirth" source="Source: Frühwirth (1987), Nuclear Instruments and Methods A 262, 444."}
Track fitting in particle physics had grown up as a collection of iterative procedures: fit the first points, extrapolate, add a point, refit. In 1987 Rudolf Frühwirth published a paper, "Application of Kalman filtering to track and vertex fitting", showing that the proper theoretical framework for these procedures is the theory of linear filtering, the Kalman filter.:cite[fruhwirth1987] The match was natural: the particle is the vehicle, its state is the five parameters of its helix, the layers are the measurements, multiple scattering is the process noise. The advantage for a collider experiment is large. The filter adds one hit at a time, so the same code can *find* a track (try each hit in the next layer, keep the one the filter accepts) and fit it, the matrices stay small, and the covariance at every layer is available, which is exactly what is needed to decide where to look for the next hit. Track fitters based on it are used throughout the LHC experiments.
:::

The mathematics is a few lines and is the second exercise of the chapter. The code below has the matrix helpers written, since the course library keeps its own private; the task is to put the equations in.

```code
id: kalman-update
optional: true
title: A Kalman measurement update
hook: reco.kalmanUpdate
prompt: |
  Implement `kalmanUpdate(state, meas, H)`: `state = { x, P }` (the state vector and its covariance), `meas = { z, R }` (the measured vector and its covariance)
  and `H` the matrix that maps the state to the measurement. Return `{ x, P, chi2 }`: the updated state, its covariance, and the χ² of the measurement,
  yᵀ S⁻¹ y. Use the Joseph form for the covariance, P⁺ = (I − K H) P (I − K H)ᵀ + K R Kᵀ, which keeps it symmetric and positive when the
  gain is large. The helper functions are provided; do not modify the inputs.
starter: |
  type Mat = number[][];

  const transpose = (A: Mat): Mat => A[0]!.map((_, j) => A.map((row) => row[j]!));
  const mul = (A: Mat, B: Mat): Mat => A.map((row) => B[0]!.map((_, j) => row.reduce((s, a, k) => s + a * B[k]![j]!, 0)));
  const add = (A: Mat, B: Mat): Mat => A.map((row, i) => row.map((a, j) => a + B[i]![j]!));
  const sub = (A: Mat, B: Mat): Mat => A.map((row, i) => row.map((a, j) => a - B[i]![j]!));
  const vec = (A: Mat, x: number[]): number[] => A.map((row) => row.reduce((s, a, j) => s + a * x[j]!, 0));
  const identity = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  /** Inverse of a small square matrix by Gauss–Jordan elimination with partial pivoting. */
  function inverse(A: Mat): Mat {
    const n = A.length;
    const M = A.map((row, i) => [...row, ...identity(n)[i]!]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
      [M[c], M[p]] = [M[p]!, M[c]!];
      const d = M[c]![c]!;
      for (let j = 0; j < 2 * n; j++) M[c]![j]! /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r]![c]!;
        for (let j = 0; j < 2 * n; j++) M[r]![j]! -= f * M[c]![j]!;
      }
    }
    return M.map((row) => row.slice(n));
  }

  export function kalmanUpdate(
    state: { x: number[]; P: number[][] },
    meas: { z: number[]; R: number[][] },
    H: number[][],
  ): { x: number[]; P: number[][]; chi2: number } {
    // y = z − H x          the innovation
    // S = H P Hᵀ + R       its covariance
    // K = P Hᵀ S⁻¹         the gain
    // x⁺ = x + K y,   P⁺ = (I − K H) P (I − K H)ᵀ + K R Kᵀ,   χ² = yᵀ S⁻¹ y
    return { x: state.x, P: state.P, chi2: 0 };
  }
tests: |
  import { test, expect } from '@pp/test';
  import { kalmanUpdate } from 'solution';
  import { kalmanUpdate as library } from 'hep/reco';
  import { rng, normal } from 'hep/random';

  test('one number: x = 0 ± 2 and a measurement z = 2 ± 1 give 1.6 ± √0.8 and χ² = 0.8', () => {
    const r = kalmanUpdate({ x: [0], P: [[4]] }, { z: [2], R: [[1]] }, [[1]]);
    expect(r.x[0]).toBeCloseTo(1.6, 12);
    expect(r.P[0]![0]).toBeCloseTo(0.8, 12);
    expect(r.chi2).toBeCloseTo(0.8, 12);
  });

  test('a track state (height, slope) with no correlation: only the height is corrected, by the gain 4/4.25', () => {
    const r = kalmanUpdate({ x: [1, 0.3], P: [[4, 0], [0, 1]] }, { z: [2], R: [[0.25]] }, [[1, 0]]);
    expect(r.x[0]).toBeCloseTo(1 + (4 / 4.25) * 1, 12);
    expect(r.x[1]).toBeCloseTo(0.3, 12);
    expect(r.P[0]![0]).toBeCloseTo((4 * 0.25) / 4.25, 12);
    expect(r.P[1]![1]).toBeCloseTo(1, 12);
  });

  test('a correlated state: the measurement of the height also corrects the slope', () => {
    const r = kalmanUpdate({ x: [0, 0], P: [[1, 0.8], [0.8, 1]] }, { z: [1], R: [[0.5]] }, [[1, 0]]);
    // K = (1, 0.8)/1.5
    expect(r.x[0]).toBeCloseTo(1 / 1.5, 12);
    expect(r.x[1]).toBeCloseTo(0.8 / 1.5, 12);
    expect(r.P[1]![1]).toBeCloseTo(1 - (0.8 * 0.8) / 1.5, 12);
  });

  test('it agrees with the library on random states, covariances and two-dimensional measurements', () => {
    const g = rng(3);
    for (let t = 0; t < 40; t++) {
      const n = 5;
      // a random symmetric positive-definite covariance A Aᵀ + 0.1 I
      const A = Array.from({ length: n }, () => Array.from({ length: n }, () => normal(g)));
      const P = A.map((row, i) => A.map((_, j) => row.reduce((s, a, k) => s + a * A[j]![k]!, 0) + (i === j ? 0.1 : 0)));
      const x = Array.from({ length: n }, () => normal(g));
      const H = [[1, 0, 0, 0, 0], [0, 1, 0, 0, 0]];
      const R = [[0.3 + g(), 0.05], [0.05, 0.2 + g()]];
      const z = [normal(g), normal(g)];
      const mine = kalmanUpdate({ x, P }, { z, R }, H);
      const ref = library({ x, P }, { z, R }, H);
      mine.x.forEach((v, i) => expect(v).toBeCloseTo(ref.x[i]!, 9));
      mine.P.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(ref.P[i]![j]!, 9)));
      expect(mine.chi2).toBeCloseTo(ref.chi2, 9);
    }
  });

  test('the covariance stays symmetric and positive, and shrinks, even for a very precise measurement', () => {
    const P = [[1e4, 90], [90, 1]];
    const r = kalmanUpdate({ x: [0, 0], P }, { z: [1], R: [[1e-8]] }, [[1, 0]]);
    expect(Math.abs(r.P[0]![1]! - r.P[1]![0]!)).toBeLessThan(1e-9);
    expect(r.P[0]![0]!).toBeGreaterThanOrEqual(0);
    expect(r.P[1]![1]!).toBeGreaterThanOrEqual(0);
    expect(r.P[0]![0]!).toBeLessThan(1e-7);
    expect(r.P[1]![1]!).toBeCloseTo(1 - 8100 / 1e4, 6);
    expect(r.x[0]).toBeCloseTo(1, 6);
  });

  test('a measurement with an enormous error changes nothing, and the inputs are not modified', () => {
    const state = { x: [1, 2], P: [[1, 0.2], [0.2, 2]] };
    const copy = JSON.stringify(state);
    const r = kalmanUpdate(state, { z: [50], R: [[1e12]] }, [[1, 0]]);
    expect(r.x[0]).toBeCloseTo(1, 5);
    expect(r.x[1]).toBeCloseTo(2, 5);
    expect(JSON.stringify(state)).toBe(copy);
  });

  test('feeding measurements one at a time gives the weighted mean, and χ² adds up', () => {
    let s = { x: [0], P: [[1e6]] };
    const zs = [2.1, 1.8, 2.3, 1.9];
    let chi2 = 0;
    for (const z of zs) {
      const u = kalmanUpdate(s, { z: [z], R: [[0.04]] }, [[1]]);
      s = { x: u.x, P: u.P };
      chi2 += u.chi2;
    }
    const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
    expect(s.x[0]).toBeCloseTo(mean, 4);
    expect(Math.sqrt(s.P[0]![0]!)).toBeCloseTo(0.2 / Math.sqrt(4), 4);
    const ss = zs.reduce((a, z) => a + (z - mean) ** 2, 0) / 0.04;
    expect(chi2).toBeGreaterThan(ss - 1e-3);
  });
solution: |
  type Mat = number[][];

  const transpose = (A: Mat): Mat => A[0]!.map((_, j) => A.map((row) => row[j]!));
  const mul = (A: Mat, B: Mat): Mat => A.map((row) => B[0]!.map((_, j) => row.reduce((s, a, k) => s + a * B[k]![j]!, 0)));
  const add = (A: Mat, B: Mat): Mat => A.map((row, i) => row.map((a, j) => a + B[i]![j]!));
  const sub = (A: Mat, B: Mat): Mat => A.map((row, i) => row.map((a, j) => a - B[i]![j]!));
  const vec = (A: Mat, x: number[]): number[] => A.map((row) => row.reduce((s, a, j) => s + a * x[j]!, 0));
  const identity = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  /** Inverse of a small square matrix by Gauss–Jordan elimination with partial pivoting. */
  function inverse(A: Mat): Mat {
    const n = A.length;
    const M = A.map((row, i) => [...row, ...identity(n)[i]!]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
      [M[c], M[p]] = [M[p]!, M[c]!];
      const d = M[c]![c]!;
      for (let j = 0; j < 2 * n; j++) M[c]![j]! /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r]![c]!;
        for (let j = 0; j < 2 * n; j++) M[r]![j]! -= f * M[c]![j]!;
      }
    }
    return M.map((row) => row.slice(n));
  }

  export function kalmanUpdate(
    state: { x: number[]; P: number[][] },
    meas: { z: number[]; R: number[][] },
    H: number[][],
  ): { x: number[]; P: number[][]; chi2: number } {
    const Ht = transpose(H);
    const Hx = vec(H, state.x);
    const y = meas.z.map((z, i) => z - Hx[i]!);                      // innovation
    const S = add(mul(mul(H, state.P), Ht), meas.R);                 // its covariance
    const Sinv = inverse(S);
    const K = mul(mul(state.P, Ht), Sinv);                           // gain
    const Ky = vec(K, y);
    const x = state.x.map((xi, i) => xi + Ky[i]!);
    const IKH = sub(identity(state.x.length), mul(K, H));
    const P = add(mul(mul(IKH, state.P), transpose(IKH)), mul(mul(K, meas.R), transpose(K))); // Joseph form
    const Sy = vec(Sinv, y);
    const chi2 = y.reduce((s, yi, i) => s + yi * Sy[i]!, 0);
    return { x, P, chi2 };
  }
hints:
  - 'Compute in this order: y = z − H x; S = H P Hᵀ + R; K = P Hᵀ S⁻¹. Then x⁺ = x + K y.'
  - 'The Joseph form is (I − K H) P (I − K H)ᵀ + K R Kᵀ. With the helpers: add(mul(mul(IKH, P), transpose(IKH)), mul(mul(K, R), transpose(K))), where IKH = sub(identity(n), mul(K, H)).'
  - 'χ² = yᵀ S⁻¹ y: multiply S⁻¹ by y with `vec`, then take the dot product with y.'
```

Once your function passes its tests it is saved as `reco.kalmanUpdate`. The library's `kalmanTrackFit` calls it through the hook, so your update step then fits the tracks of the course detector: the pulls of the fit (how far each hit is from the track, in units of its expected error) should be a Gaussian of width 1, and when they are not, there is a bug.

:::programmer
The Kalman filter is **recursive least squares with a model of how the state changes**. If you have used an exponential moving average, you have used a Kalman filter with a fixed gain; the point of Kalman's is that the gain is *computed*, at every step, from how uncertain the current estimate and the new measurement are. The same code is in robotics (fusing wheel odometry with a laser), in GPS receivers, in the smoothing of a noisy sensor, and in game physics. A neat fact for a programmer: the filter processes data in a single pass with constant memory, whatever the number of measurements. A track fit with 8 layers or a vehicle with 8 million samples uses the same ten lines.
:::


:::note
**Session 3: reconstruct the event.** Combine tracks, vertices and clusters; finish by separating efficiency from fake rate. Use the supplied pipeline to test one prediction.
:::

## Vertices

Tracks from one collision should point back to one place. A **vertex fit** is the same problem as the track fit with the roles reversed: the unknown is a point, and each track is a measurement of it, with a covariance. It is a weighted least-squares problem for the point that is closest to all the tracks, and a track that is far from it by many standard deviations is dropped and the fit repeated: *outlier rejection*.

The collisions of one crossing are spread along the beam by about 5 cm, while the tracker locates a vertex to a few micrometres or tens of micrometres, so the clumps of Figure 8.4 are cleanly separated unless two collisions happen within about half a millimetre. The library's primary-vertex finder (`findPrimaryVertices`) smooths the $z$ positions of the tracks at their closest approach to the beam line with a Gaussian of the size of each track's own uncertainty, takes the local maxima as seeds, assigns each track to the nearest seed within four standard deviations, and fits. The vertex with the largest $\sum p_T^2$ of its tracks is called the **hard-scatter** :term[primary vertex]{id=primary-vertex}: it is the collision in which something interesting is most likely to have happened, and it is the one the analysis cares about. The other vertices are **pile-up** vertices.

::vertex-clusters{n="8.4" caption="The z position of the closest approach to the beam of each track found in one simulated crossing (grey histogram), the true collision positions (dotted grey lines), the fitted pile-up vertices (orange) and the fitted hard-scatter vertex (green), as the number of pile-up collisions increases. At 60 collisions roughly one vertex in ten is lost because two collisions are closer than the fit can separate. The track finding and the vertex finding are the library's own."}

Secondary vertices, where a heavy particle decays a fraction of a millimetre from the collision, use the same fit and are the subject of Chapter 24.

## Clusters, electrons, photons and muons

Calorimeter cells are reconstructed in the same spirit. A topological :term[cluster]{id=cluster} is built from a **seed** (a cell whose energy is well above its noise, say eight times) and the neighbouring cells above a lower threshold (three times the noise) that touch it, grown until no more qualify. A cluster with two separate maxima is split between them. The result is a list of clusters, each with an energy, a position and a size. The thresholds are the usual trade: too low and noise makes clusters, too high and the soft tails of a shower are lost, which biases the energy.

A cluster, a track and a muon-chamber hit are not yet a particle. To make particles, the software combines them. The rules follow the signatures of Chapter 7:

| Object | Built from | The main requirements (the library's) |
|---|---|---|
| Muon | a track continued into the muon system | the track, extrapolated through the calorimeters and the coil, finds hits in at least 2 of the 4 stations, within windows that include the scattering |
| Electron | a track matched to an ECAL cluster | E/p between 0.6 and 2 (the energy of the cluster divided by the track's momentum), hadronic energy behind the cluster under 15 % of it |
| Photon | an ECAL cluster with no track | hadronic fraction under 10 %; if a pair of tracks of opposite charge comes from one point (a *conversion*), they are linked to it |
| Jet | the particle-flow candidates | anti-k<sub>T</sub> clustering (Chapter 18) with a radius R = 0.4 |
| Missing p<sub>T</sub> | every cell and every muon | minus the vector sum of the transverse momenta |

Each object also gets an *isolation*: the energy or momentum of other particles in a cone around it, divided by its own. A lepton from the decay of a W or a Z is usually alone, and a lepton inside a jet, from the decay of a hadron, is not, so isolation is how the first kind is told from the second. Figure 8.5 shows the linked display of truth and reconstruction for an event with four electrons.

::truth-reco-compare{sample="h4e" n="8.5" caption="A simulated H → ZZ* → 4e event in the event display's simplified model, with the truth (left) and the reconstruction (right) linked: select an object in one and its counterpart is highlighted in the other, with the tracks and clusters it was made from. Where a truth particle has no counterpart it was lost; where a reconstructed object has no truth partner it is a fake."}

### Particle flow

Both calorimeters and the tracker measure a charged hadron: the tracker its momentum, the HCAL its energy. And a photon is measured by the ECAL alone. A jet is made of all of these mixed together: typically about two thirds of its energy is carried by charged hadrons, about a quarter by photons (from the decay of $\pi^0$ mesons) and about a tenth by neutral hadrons.:cite[cms-pf2017] (These fractions are typical and vary with the jet's energy.) A measurement of the jet that sums the calorimeter cells treats all of them as hadrons in an HCAL with a resolution of $100\%/\sqrt{E}$, throwing away the much better information of the tracker for the charged part.

**:term[Particle flow]{id=particle-flow}** reconstructs the *particles* of the jet and measures each with the best detector for it. A track is a charged hadron with the track's momentum. An ECAL cluster with no track is a photon. An HCAL cluster with no track is a neutral hadron. Where a track points at a cluster, the cluster's energy is *already counted* in the track, so it is not counted again; if the calorimeter has appreciably more than the track accounts for, the excess is a photon or a neutral hadron. The library's version links tracks and clusters by their angular distance, and treats the excess as a photon (from the ECAL share) and a neutral hadron (the HCAL share).

```numeric
id: pf-jet
title: What particle flow gains for a jet
prompt: 'A jet of 100 GeV has 65 GeV in charged hadrons, 25 GeV in photons and 10 GeV in neutral hadrons. In the course detector the tracker measures a 65 GeV charged hadron to about 1 %, the ECAL measures photons with σ/E = 2.7 %/√E, and the HCAL measures neutral hadrons with σ/E = 100 %/√E. Ignoring constant terms, what is the uncertainty on the jet energy, in GeV, when each part is measured by the best detector, and the three errors are added in quadrature?'
answer: 3.23
unit: GeV
tolerance: 0.03
hints:
  - 'The three errors: 0.01 × 65 = 0.65 GeV; 0.027 × √25 = 0.135 GeV; 1.0 × √10 = 3.16 GeV.'
explain: "√(0.65² + 0.135² + 3.16²) = √(0.42 + 0.018 + 10.0) = 3.23 GeV, about 3.2 % of the jet. If the calorimeters had to measure everything, the charged hadrons would be measured by the HCAL, with an error of 1.0 × √65 = 8.1 GeV, and the total would be √(8.1² + 0.135² + 3.16²) = 8.7 GeV: more than twice as large. The dominant remaining error is the neutral hadrons, a tenth of the energy, measured worst. Particle flow also needs the calorimeter cells of the charged hadrons not to be counted twice, which is where the real difficulty lies: the showers of nearby particles overlap, and in a dense jet the separation is not perfect, which is why real particle flow does not reach this ideal number."
```

## How good is it? Truth, efficiency and fake rate

Since every simulated hit remembers the particle that made it, every found track can be given a truth label (:term[truth matching]{id=truth-matching}). The rule the library uses is simple: the track is matched to the particle that supplied the largest share of its hits, if that share is at least half. A track with no such particle is a fake (the :term[fake rate]{id=fake-rate} is the fraction of tracks that are). Two numbers follow, the :term[tracking efficiency]{id=tracking-efficiency} and the fake rate:

:::equation{#efficiency caption="The tracking efficiency and fake rate are fractions, each with a binomial uncertainty: how many of the particles that could have been found were found, and how many of the tracks found are not real."}
$$\term{eff}{\varepsilon} = \frac{\term{k}{k}}{\term{nn}{n}}\ \pm\ \sqrt{\frac{\varepsilon\,(1-\varepsilon)}{n}},\qquad f = \frac{\text{fake tracks}}{\text{all tracks}}$$

```terms
eff:
  label: 'ε, the efficiency'
  what: The fraction of the reconstructible particles for which a matched track was found. Reconstructible usually means a charged particle with enough transverse momentum, inside the geometrical acceptance of the tracker, and (here) that left enough hits.
  why: It tells how many of the particles in the event the analysis can use, and, as a function of pT and η, what the detector is blind to.
  effect: 'An analysis must correct for it: a Z → μμ yield measured with 90 % efficient muons is 10 % low, and the correction is only as good as the efficiency measurement.'
k:
  label: 'k, the number found'
  what: The number of reconstructible particles for which a matching track exists.
  why: It is the numerator of the efficiency.
  effect: Counted over many events, so that the efficiency has a small statistical error.
nn:
  label: 'n, the number of reconstructible particles'
  what: The total number of reconstructible particles in the sample.
  why: 'It is the denominator of the efficiency, and sets its statistical uncertainty: with 100 particles and ε = 0.95, the error is 2 %.'
  effect: Quadrupling the sample halves the error.
```
:::

The library computes them from the truth links (`efficiency`, `fakeRate` and `binomial` in `hep/reco`), with the Wilson interval, which behaves at $\varepsilon = 0$ and $\varepsilon = 1$ where the formula above gives a zero error. Two further numbers come with them: the **resolution** of a measured quantity, the width of the distribution of (reconstructed − true), for which the robust choice is half the width of the central 68 % of the distribution, $\sigma_{68}$ (immune to the tails), and the **pull** of a fit parameter, (measured − true)/uncertainty, which should be a Gaussian of width 1 if the uncertainty is right.

```numeric
id: eff-error
title: The error on an efficiency
prompt: In a test sample 190 of the 200 reconstructible particles are matched to a track. What is the binomial standard error on the efficiency, in percent?
answer: 1.54
unit: '%'
tolerance: 0.03
hints:
  - The efficiency is ε = 190/200 = 0.95. The error is √(ε(1 − ε)/n).
explain: "√(0.95 × 0.05/200) = √(2.375 × 10⁻⁴) = 0.0154, or 1.5 %. To know an efficiency of 99.6 % to 0.1 % one needs about 4,000 particles, and to see a fake rate of 10⁻⁴ one needs far more tracks than that, which is why the library's tests quote its fake rates as 'none in 20,000 tracks' rather than as a number."
```

```quiz
q: 'A programmer reading this chapter thinks of the tracking efficiency and the fake rate in the language of classification. Which statement is right?'
options:
  - text: The efficiency is the recall (the fraction of the real particles that were found) and one minus the fake rate is the precision (the fraction of the tracks found that are real).
    correct: true
    why: 'Efficiency = true positives / (true positives + false negatives) = recall. The fake rate is the fraction of the reported tracks that are false positives, so 1 − fake rate = true positives / (true positives + false positives) = precision. Loosening the finder (fewer hits required, wider roads) raises the recall and lowers the precision, which is exactly the trade-off of the figure below.'
  - text: The efficiency is the precision and the fake rate is the false-positive rate (false positives divided by all the hits that were not on a track).
    why: 'The efficiency counts the particles that were found out of the ones that were there, which is recall. The fake rate of tracking is defined over the tracks found, not over all possible wrong combinations (a number that would be astronomically large, and meaningless), so it is 1 − precision.'
  - text: 'They are independent: improving one cannot affect the other.'
    why: 'They are linked by every cut. A looser selection finds more of the real tracks and also accepts more of the accidental combinations, and a tighter one does the opposite.'
```

## Tracking under growing pile-up

Everything is in place for the flagship figure. Each point of its curves is a set of simulated crossings with a given number of pile-up collisions: a hard collision with six charged pions of 1 to 31 GeV, plus the pile-up, simulated with `simulate` and reconstructed with `findTracks`, and then the tracks are compared with the truth. The reference curve (dashed) is the library's finder with its default settings. The orange curve is the finder with *your* settings: the number of hits required, the width of the roads, the largest $\chi^2$, the quality of the detector (noise hits, dead channels), and the seeding method (triplets or the Hough transform). And, when you have written the functions of the exercises, the toggle *use my code* runs the finder with your circle fit, your Hough transform and your Kalman update.

::pileup-tracking{n="8.6" caption="Tracking efficiency and fake rate against the number of pile-up collisions, for the library's finder (dashed) and for the settings you choose (solid), computed live with 5 simulated crossings per point by default. Below: the number of seeds tried per event, which is the cost of the algorithm, and one crossing seen along the beam with the tracks found. Things to try: (1) with the defaults, the finder is efficient up to 200 collisions but the cost grows by a factor of 6,000 from none to 200. (2) Require 3 hits only and open the roads to 8σ and the χ² to 20: the efficiency stays, and the fake rate climbs to a half and beyond. (3) Require all 8 hits with 3 % dead channels: the fake rate is zero, and half the particles are lost. (4) Switch to the Hough transform: it finds the tracks of a quiet event and almost nothing once there are ten pile-up collisions."}

What the figure shows, from the library's runs with the default 5 events per point (the numbers depend on the random events, and the statistical errors are a few percent):

- **The reference.** The efficiency for the signal pions is 97 % with no pile-up and 100 % at the other points; the fake rate is at most 0.1 % up to 200 collisions. The cost, as in the table of the seeding section, grows several thousand-fold in the number of seeds. A detector with eight precise layers and a finder tuned to it is very good at this problem, and the price is in the computing.
- **Loosening the finder** (3 hits required, roads of 8σ, χ²/ndof up to 20) leaves the efficiency near 100 % and the fake rate grows with pile-up: 1.6 % at 10 collisions, 22 % at 50, 43 % at 100 and 62 % at 200. More than half of the tracks reported at 200 collisions are accidental combinations of hits from different particles. A tracker that did this would give an analysis a large fake background; one that gave up the efficiency instead would lose real particles. Every real tracking algorithm sits somewhere on this trade-off.
- **Strict requirements** on a detector with dead channels lose real tracks: requiring all 8 layers with 3 % of the channels dead gives an efficiency of 37 to 67 % at the different points (about 55 % on average), with no fakes. The fix is the opposite of the previous one: *tolerate* a missing hit.
- **The Hough transform** gives 93 % at no pile-up, 3 % at 10 pile-up collisions and nothing beyond. The accumulator is filled with coincidences, and the road collected around each peak is wide, in the transverse plane only, so that in a dense event it picks up wrong hits. (A more careful implementation would use $z$ as well; the library's is the simplest one that shows how the method works.)

The experiments run tracking in *iterations*: a first pass with strict cuts finds the easy tracks with a negligible fake rate, their hits are removed, and a second pass with looser cuts searches the remaining hits for the harder ones, and so on. The library's three passes are a miniature of that.:cite[cms-tracking2014]

## Under the hood: seeds, windows and the update

The seeding of the library is a few lines of bookkeeping. The layer combinations for seeds, most valuable first, are:

```ts
// hep/reco/tracking.ts
function seedCombos(nLayers: number, nPix: number): [number, number, number][] {
  const m = Math.min(nLayers, Math.max(3, Math.min(4, nPix + 1)));
  const out: [number, number, number][] = [];
  if (m >= 3) out.push([0, 1, 2]);
  if (m >= 4) out.push([1, 2, 3], [0, 1, 3], [0, 2, 3]);
  return out;
}
```

The combination (0, 1, 2) is tried first on all the hits; the others, which skip a layer, catch tracks that left no hit in one of the inner layers (a dead channel, an inefficiency) and are run on the hits that are left. For each pair, the library looks up the hits of the next layer in a grid in $(z, \varphi)$, so that the cost of a window is the number of hits *in it* and not the number of hits in the layer. The grid is the spatial index of the chapter's title: without it the triplet loop would be quadratic in the hits per layer and with it, nearly linear for the same windows.

The update step of the filter is the equations of the chapter, in the library's matrix notation:

```ts
// hep/reco/kalman.ts
export function kalmanUpdate(state: KalmanState, meas: { z: number[]; R: number[][] }, H: number[][]) {
  const Ht = transpose(H);
  const y = vecSub(meas.z, matVec(H, state.x));
  const S = matAdd(matMul(matMul(H, state.P), Ht), meas.R);
  const Sinv = inverse(S);
  const K = matMul(matMul(state.P, Ht), Sinv);
  const x = vecAdd(state.x, matVec(K, y));
  const IKH = matSub(identity(state.x.length), matMul(K, H));
  const P = matAdd(matMul(matMul(IKH, state.P), transpose(IKH)), matMul(matMul(K, meas.R), transpose(K)));
  ...
}
```

The track fit calls it for each layer from the outermost hit inwards. Between layers, the state is propagated by the exact helix (not by a linear map) and the covariance by the matrix of derivatives of that propagation, taken numerically; this is the **extended** Kalman filter, the standard remedy when the motion is not linear. The scattering noise $Q$ is Highland's angle for the layer's thickness and the track's momentum.

:::experiments
In the experiments' software the same pieces appear with larger names. Tracks are found with a **combinatorial Kalman filter**: starting from a seed, the filter is extended through the layers, at each layer trying *every* compatible hit and keeping the candidates that survive as branches, so that the cost is controlled by how aggressively the branches are pruned. CMS describes a sequence of iterations of this, with different seeds and cuts, in its tracker paper.:cite[cms-tracking2014] The open-source library ACTS, introduced in Chapter 5, provides these algorithms to several experiments.:cite[acts2022] Objects are then built by *particle flow*, which CMS made the basis of its whole event reconstruction:cite[cms-pf2017]; ATLAS uses a related approach for jets. The course's version is smaller, and its library notes list what it leaves out: no energy loss or bremsstrahlung in the track fit (electron tracks are fitted as if they were pions, which is why the E/p of electrons has a tail), no looping low-momentum tracks, no alignment, no jet energy corrections.
:::

:::real{parts="Reconstruction in a camera"}
The phone-camera lab of Appendix G needs a small piece of reconstruction of its own: finding bright pixels in a dark frame, grouping neighbouring ones into a *cluster*, and telling a short dot from a long track. It is the calorimeter clustering of this chapter, on a frame of a few million pixels. See [Appendix G](/appendix/build-it-for-real/).
:::

## What comes next

The reconstruction here ends with tracks, vertices, clusters, electrons, photons, muons, jets and a missing momentum, each with a link to the truth, and with the simulation behind it. The pipeline now has a detector and software that reads it. Part III uses them to ask what the objects are: [Chapter 9](/chapters/antimatter/) returns to Anderson's photograph, and then the zoo of the particles themselves. Chapter 18 gives the jets their algorithm, Chapter 24 uses the vertices to find particles that live a fraction of a millimetre, and Chapter 27 asks how to decide, in a few microseconds, which of the 40 million crossings per second to keep.

## Further reading

- Hough's 1959 paper and the patent, and Duda and Hart's article that made the method a standard tool of image processing (:cite[hough1959,hough1962,duda1972]).
- Kalman's 1960 paper and Frühwirth's 1987 paper, where the filter meets the track fit (:cite[kalman1960,fruhwirth1987]).
- CMS's description of track and primary-vertex reconstruction, and of particle flow (:cite[cms-tracking2014,cms-pf2017]); the ACTS paper for an open-source implementation (:cite[acts2022]).
- The library notes in `src/lib/hep/reco/README.md` for what the course's reconstruction does, how well, and what it leaves out.
