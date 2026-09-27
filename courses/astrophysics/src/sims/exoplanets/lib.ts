// Shared helpers for the exoplanets chapter sims: synthetic light/RV curves, a box-transit
// model, chunked Box Least Squares and Lomb-Scargle periodogram generators, and a few
// closed-form relations (Kepler III, RV semi-amplitude, equilibrium temperature).
// Deliberately simplified relative to production pipelines (see the chapter's <Hood>).

import { G, Msun, Mearth, AU, Rsun, yr, CONST } from '../../lib/physics/constants';

const Mjup = CONST.Mjup.value;
const Rearth = CONST.Rearth.value;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal via Box-Muller, driven by a supplied uniform RNG. */
export function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export interface PlanetSpec {
  periodDays: number;
  radiusEarth: number;
  /** 0..1, fraction of orbit radius projected on the sky (b = a cos i / R*, roughly). */
  impactParam: number;
  t0Days: number; // mid-transit epoch
}

export interface StarSpec {
  radiusSun: number;
  massSun: number;
  tempK: number; // effective temperature, for limb darkening + Teq of planets
  limbU1: number; // quadratic limb-darkening coefficients
  limbU2: number;
}

/** Quadratic limb-darkening intensity profile, I(mu)/I(1). */
function limbDark(mu: number, u1: number, u2: number) {
  const x = 1 - mu;
  return 1 - u1 * x - u2 * x * x;
}

/**
 * Approximate transit light curve for one planet: numerically integrates a limb-darkened
 * stellar disc occulted by a uniform dark circle. Good enough for teaching; not Mandel & Agol's
 * exact analytic solution (see the chapter's Hood for why that matters in real pipelines).
 */
export function transitDepthAt(deltaPhase: number, p: PlanetSpec, star: StarSpec, aOverRstar: number): number {
  // Sky-plane separation between planet and star centre, in stellar radii.
  const theta = 2 * Math.PI * deltaPhase;
  const x = aOverRstar * Math.sin(theta);
  const y = p.impactParam; // approximate as constant during the (short) transit
  const d = Math.hypot(x, y); // centre separation in R*
  const rp = p.radiusEarth * Rearth / (star.radiusSun * Rsun); // Rp/R* dimensionless
  if (d >= 1 + rp) return 0; // no overlap
  // Monte-Carlo-free ring integration of the limb-darkened disc blocked by the planet.
  // Sample the overlap lens area weighted by local limb darkening, normalised by the
  // disc's total limb-darkened flux (analytic for the quadratic law).
  const totalFlux = 1 - star.limbU1 / 3 - star.limbU2 / 6; // ∫∫ I(mu) dA / (pi R*^2), quadratic law
  const N = 24;
  let blocked = 0;
  for (let i = 0; i < N; i++) {
    // radial samples across the planet's disc, integrated in polar coords centred on planet
    const rr = (rp * (i + 0.5)) / N;
    const dr = rp / N;
    const circumference = 2 * Math.PI * rr;
    const M = Math.max(6, Math.round((circumference / rp) * 3));
    let ringFlux = 0;
    for (let j = 0; j < M; j++) {
      const phi = (2 * Math.PI * j) / M;
      const px = x + rr * Math.cos(phi);
      const py = y + rr * Math.sin(phi);
      const r2 = px * px + py * py;
      if (r2 >= 1) continue; // sample lands outside the star
      const mu = Math.sqrt(Math.max(0, 1 - r2));
      ringFlux += limbDark(mu, star.limbU1, star.limbU2);
    }
    blocked += (ringFlux / M) * rr * dr * 2 * Math.PI;
  }
  return blocked / (Math.PI * totalFlux);
}

export interface SystemSpec {
  star: StarSpec;
  planets: PlanetSpec[];
}

export function semiMajorAxisAU(periodDays: number, starMassSun: number, planetMassEarth = 0) {
  const P = periodDays / 365.25;
  const Mtot = starMassSun + (planetMassEarth * Mearth) / Msun;
  return Math.cbrt(P * P * Mtot);
}

export function equilibriumTempK(star: StarSpec, aAU: number, albedo = 0.3) {
  return star.tempK * Math.sqrt((star.radiusSun * Rsun) / (2 * aAU * AU)) * Math.pow(1 - albedo, 0.25);
}

/** RV semi-amplitude K (m/s): K = (2*pi*G/P)^(1/3) * Mp sin(i) / (Mstar+Mp)^(2/3) / sqrt(1-e^2). */
export function rvSemiAmplitude(periodDays: number, starMassSun: number, planetMassEarth: number, incDeg: number, e = 0) {
  const P = periodDays * 86400;
  const Mstar = starMassSun * Msun;
  const Mp = planetMassEarth * Mearth;
  const sini = Math.sin((incDeg * Math.PI) / 180);
  const K = Math.pow((2 * Math.PI * G) / P, 1 / 3) * ((Mp * sini) / Math.pow(Mstar + Mp, 2 / 3)) / Math.sqrt(1 - e * e);
  return K; // m/s
}

/** Generate a synthetic light curve: correlated stellar "activity" noise + white noise + gaps + transits. */
export function generateLightCurve(opts: {
  system: SystemSpec;
  baselineDays: number;
  cadenceMinutes: number;
  noiseLevel: number; // relative, ~1e-4 to 1e-2
  activityLevel: number; // relative amplitude of slow variability
  gapFraction: number; // fraction of points removed in randomly placed chunks
  seed: number;
}) {
  const { system, baselineDays, cadenceMinutes, noiseLevel, activityLevel, gapFraction, seed } = opts;
  const rng = mulberry32(seed);
  const n = Math.floor((baselineDays * 1440) / cadenceMinutes);
  const t = new Float64Array(n);
  const flux = new Float64Array(n);
  const mask = new Uint8Array(n);

  // A few sinusoids at different periods/phases approximate rotation + granulation.
  const modes = Array.from({ length: 4 }, () => ({
    P: 2 + rng() * 18, // rotational modulation: days to weeks
    A: activityLevel * (0.3 + rng()),
    phi: rng() * 2 * Math.PI,
  }));

  // Random gap windows (data downlink / bad weather).
  const gaps: [number, number][] = [];
  let covered = 0;
  while (covered < gapFraction * baselineDays && gaps.length < 12) {
    const w = baselineDays * (0.01 + rng() * 0.04);
    const s = rng() * baselineDays;
    gaps.push([s, s + w]);
    covered += w;
  }

  const aOverRList = system.planets.map((p) => (semiMajorAxisAU(p.periodDays, system.star.massSun) * AU) / (system.star.radiusSun * Rsun));

  for (let i = 0; i < n; i++) {
    const day = (i * cadenceMinutes) / 1440;
    t[i] = day;
    let f = 1;
    for (const m of modes) f += m.A * Math.sin((2 * Math.PI * day) / m.P + m.phi);
    f += noiseLevel * gaussian(rng);
    for (let pi = 0; pi < system.planets.length; pi++) {
      const p = system.planets[pi];
      const phase = ((day - p.t0Days) / p.periodDays) % 1;
      const dphi = phase > 0.5 ? phase - 1 : phase; // nearest to 0
      if (Math.abs(dphi) < 0.05) f -= transitDepthAt(dphi, p, system.star, aOverRList[pi]);
    }
    flux[i] = f;
    mask[i] = gaps.some(([a, b]) => day >= a && day <= b) ? 0 : 1;
  }
  return { t, flux, mask };
}

/** Generate synthetic RV measurements for the (single, dominant) planet in the system. */
export function generateRV(opts: {
  system: SystemSpec;
  planetIndex: number;
  planetMassEarth: number;
  incDeg: number;
  nPoints: number;
  baselineDays: number;
  jitterMs: number; // m/s
  seed: number;
}) {
  const { system, planetIndex, planetMassEarth, incDeg, nPoints, baselineDays, jitterMs, seed } = opts;
  const rng = mulberry32(seed);
  const p = system.planets[planetIndex];
  const K = rvSemiAmplitude(p.periodDays, system.star.massSun, planetMassEarth, incDeg);
  const t: number[] = [], rv: number[] = [], err: number[] = [];
  for (let i = 0; i < nPoints; i++) {
    // irregular cadence, as real observing campaigns are
    const day = rng() * baselineDays;
    const phase = (2 * Math.PI * (day - p.t0Days)) / p.periodDays;
    const noise = jitterMs * gaussian(rng);
    t.push(day);
    rv.push(K * Math.sin(phase) + noise);
    err.push(jitterMs);
  }
  const order = t.map((_, i) => i).sort((a, b) => t[a] - t[b]);
  return { t: order.map((i) => t[i]), rv: order.map((i) => rv[i]), err: order.map((i) => err[i]), K };
}

/** One chunk of a generator-based scan: caller drives it a bit per animation frame. */
export interface ChunkedScan {
  progress(): number; // 0..1
  done(): boolean;
  step(budgetMs: number): void;
  periods: Float64Array;
  power: Float64Array;
  bestIndex(): number;
}

/**
 * Box Least Squares periodogram (Kovacs, Zucker & Mazeh 2002), simplified: for each trial
 * period, phase-fold, scan a small number of candidate box durations/phases via binning, and
 * keep the duration/phase that most improves the fit (maximises the SNR-like statistic
 * BLS uses: r*s^2/(1-r) with r the in-transit fraction and s the depth). Runs incrementally so
 * the main thread stays responsive.
 */
export function createBLS(t: Float64Array, flux: Float64Array, mask: Uint8Array, pMin: number, pMax: number, nPeriods: number): ChunkedScan {
  // Frequency grid fine enough that a transit cannot drift out of its box over the baseline:
  // adjacent trial frequencies must differ by less than (duration × f)/(2 × baseline), so the
  // grid is geometric in f (uniform in log f) and far denser than a naive linear grid.
  // nPeriods acts as a floor on the number of trial periods.
  const fMin = 1 / pMax, fMax = 1 / pMin;
  const baseline = Math.max(1, t[t.length - 1] - t[0]);
  const durMin = 0.06; // days: the shortest transit we look for (about 1.5 hours)
  const ratio = 1 + Math.min(durMin / (2 * baseline), Math.log(fMax / fMin) / nPeriods);
  const nP = Math.ceil(Math.log(fMax / fMin) / Math.log(ratio)) + 1;
  nPeriods = nP;
  const periods = new Float64Array(nPeriods);
  for (let i = 0; i < nPeriods; i++) periods[i] = 1 / (fMin * Math.pow(ratio, i));
  const power = new Float64Array(nPeriods);
  const nBins = 200;
  const durations = [0.01, 0.02, 0.035, 0.05, 0.08]; // fraction of period
  let idx = 0;
  const validIdx: number[] = [];
  for (let i = 0; i < t.length; i++) if (mask[i]) validIdx.push(i);
  const meanFlux = validIdx.reduce((s, i) => s + flux[i], 0) / validIdx.length;

  function scanPeriod(P: number): number {
    const binSum = new Float64Array(nBins);
    const binCount = new Float64Array(nBins);
    for (const i of validIdx) {
      let ph = (t[i] / P) % 1;
      if (ph < 0) ph += 1;
      const b = Math.min(nBins - 1, Math.floor(ph * nBins));
      binSum[b] += flux[i] - meanFlux;
      binCount[b] += 1;
    }
    let best = 0;
    // O(nBins * durations) direct scan over box start/width — nBins=200 keeps this cheap.
    for (const dur of durations) {
      const w = Math.max(1, Math.round(dur * nBins));
      for (let b0 = 0; b0 < nBins; b0++) {
        let sum = 0, cnt = 0;
        for (let k = 0; k < w; k++) { const b = (b0 + k) % nBins; sum += binSum[b]; cnt += binCount[b]; }
        if (cnt < 3) continue;
        const r = cnt / validIdx.length;
        const s = -sum / cnt; // positive if a dip
        if (s <= 0) continue;
        const stat = (r * s * s) / (1 - r + 1e-9);
        if (stat > best) best = stat;
      }
    }
    return best;
  }

  return {
    periods, power,
    progress: () => idx / nPeriods,
    done: () => idx >= nPeriods,
    bestIndex: () => { let bi = 0; for (let i = 1; i < nPeriods; i++) if (power[i] > power[bi]) bi = i; return bi; },
    step(budgetMs) {
      const t0 = performance.now();
      while (idx < nPeriods && performance.now() - t0 < budgetMs) {
        power[idx] = scanPeriod(periods[idx]);
        idx++;
      }
    },
  };
}

/** Lomb-Scargle periodogram (generalised, floating mean), incremental like the BLS scan above. */
export function createLombScargle(t: number[], y: number[], pMin: number, pMax: number, nFreq: number): ChunkedScan {
  const periods = new Float64Array(nFreq);
  const fMin = 1 / pMax, fMax = 1 / pMin;
  for (let i = 0; i < nFreq; i++) periods[i] = 1 / (fMin + ((fMax - fMin) * i) / (nFreq - 1));
  const power = new Float64Array(nFreq);
  const n = t.length;
  const mean = y.reduce((a, b) => a + b, 0) / n;
  const yc = y.map((v) => v - mean);
  const varY = yc.reduce((a, b) => a + b * b, 0) / n;
  let idx = 0;
  return {
    periods, power,
    progress: () => idx / nFreq,
    done: () => idx >= nFreq,
    bestIndex: () => { let bi = 0; for (let i = 1; i < nFreq; i++) if (power[i] > power[bi]) bi = i; return bi; },
    step(budgetMs) {
      const t0 = performance.now();
      while (idx < nFreq && performance.now() - t0 < budgetMs) {
        const omega = (2 * Math.PI) / periods[idx];
        let s2 = 0, c2 = 0;
        for (let i = 0; i < n; i++) { s2 += Math.sin(2 * omega * t[i]); c2 += Math.cos(2 * omega * t[i]); }
        const tau = Math.atan2(s2, c2) / (2 * omega);
        let ss = 0, cc = 0, sy = 0, cy = 0;
        for (let i = 0; i < n; i++) {
          const arg = omega * (t[i] - tau);
          const s = Math.sin(arg), c = Math.cos(arg);
          ss += s * s; cc += c * c; sy += yc[i] * s; cy += yc[i] * c;
        }
        const p = 0.5 * ((cy * cy) / (cc || 1e-12) + (sy * sy) / (ss || 1e-12)) / (varY * n || 1e-12);
        power[idx] = p;
        idx++;
      }
    },
  };
}

export { AU, Rsun, Rearth, Mjup, Mearth, Msun, yr, G };
