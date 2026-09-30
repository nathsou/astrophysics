/**
 * The Hough transform for track finding in the transverse plane.
 *
 * Parametrisation (for tracks that come from the origin). A track leaves the origin at azimuth φ₀ and curves with
 * signed curvature κ = 1/R (in 1/mm; κ > 0 turns towards increasing φ, counter-clockwise; a *positive* particle in a
 * field along +z has κ < 0). A point of the track at distance r from the origin then has azimuth φ with
 *
 *     sin(φ − φ₀) = κ r / 2        ⇔        κ = 2 sin(φ − φ₀) / r,
 *
 * which is the chord of a circle through the origin: a circle of radius R subtends the angle φ − φ₀ = asin(r/2R) at
 * the origin. The **accumulator** is a grid over (φ₀, κ). A hit (r, φ) is compatible with every (φ₀, κ) on the curve
 * κ = 2 sin(φ − φ₀)/r, so it votes once in each φ₀ column whose direction is within ±90° of the hit's azimuth (the
 * track moves outwards), in the κ bin that formula gives. All hits of one track give the same (φ₀, κ) and pile
 * their votes into one cell: a track is a peak. A φ₀ bin is an interval, so within it the hit's curve crosses a few κ bins
 * (more for hits close to the origin, where a small change of φ₀ moves κ a lot): the hit votes in all of them.
 *
 * Layout of `accumulator`: index = iAngle · nCurv + iCurv, with φ₀ ∈ [−π, π) in `nAngle` equal bins and κ ∈
 * [−maxCurv, +maxCurv] in `nCurv` equal bins. It is periodic in φ₀.
 */
export interface HoughOptions {
  nAngle?: number;
  nCurv?: number;
  /** Largest |κ| in 1/mm. pT = 0.3 B/(1000 κ) GeV: the default 0.004 covers pT > 0.23 GeV at B = 3.8 T. */
  maxCurv?: number;
  /** Peaks need at least this many votes (default 4). */
  minVotes?: number;
  /** At most this many peaks are returned (default 500). */
  maxPeaks?: number;
}

export interface HoughPeak {
  /** Azimuth of the track direction at the origin. */
  phi0: number;
  /** Signed curvature in 1/mm. */
  curvature: number;
  votes: number;
}

export interface HoughResult {
  accumulator: Float32Array;
  nAngle: number;
  nCurv: number;
  peaks: HoughPeak[];
}

/**
 * Reference for the hook `reco.houghTransform`: fill the accumulator from `hits` (x, y in mm) and return it with its
 * local maxima, strongest first. A peak is a cell that is at least as large as its eight neighbours (periodic in φ₀)
 * and larger than the ones before it in scan order (so a plateau gives one peak); its position is the vote-weighted
 * centroid of the 3 × 3 cells around it.
 */
export function houghTransform(hits: readonly { x: number; y: number }[], opts: HoughOptions = {}): HoughResult {
  const nAngle = opts.nAngle ?? 256;
  const nCurv = opts.nCurv ?? 64;
  const maxCurv = opts.maxCurv ?? 0.004;
  const minVotes = opts.minVotes ?? 4;
  const maxPeaks = opts.maxPeaks ?? 500;
  const acc = new Float32Array(nAngle * nCurv);
  const cosA = new Float64Array(nAngle);
  const sinA = new Float64Array(nAngle);
  const dA = (2 * Math.PI) / nAngle;
  for (let j = 0; j < nAngle; j++) {
    const a = -Math.PI + (j + 0.5) * dA;
    cosA[j] = Math.cos(a);
    sinA[j] = Math.sin(a);
  }
  const scale = nCurv / (2 * maxCurv);
  const halfA = dA / 2;
  const cosH = Math.cos(halfA);
  const sinH = Math.sin(halfA);
  for (const h of hits) {
    const r = Math.hypot(h.x, h.y);
    if (r < 1e-9) continue;
    const cp = h.x / r;
    const sp = h.y / r;
    const k2 = 2 / r;
    for (let j = 0; j < nAngle; j++) {
      // the track moves outwards: only directions within ±90° of the hit's own azimuth are possible (otherwise
      // (φ₀ + π, −κ) would describe the same circle run backwards and every track would make two peaks)
      const cd = cp * cosA[j]! + sp * sinA[j]!;
      if (cd <= 0) continue;
      // sin(φ − φ₀) = sinφ cosφ₀ − cosφ sinφ₀; κ at the two edges of the φ₀ bin (a bin is an interval of φ₀, so the
      // hit's curve crosses a range of κ bins within it, and all of them are voted for)
      const s0 = sp * cosA[j]! - cp * sinA[j]!; // sin(φ − φ₀) at the bin centre
      const sLo = s0 * cosH + cd * sinH; // φ₀ → φ₀ − half a bin
      const sHi = s0 * cosH - cd * sinH; // φ₀ → φ₀ + half a bin
      let b0 = Math.floor((k2 * Math.min(sLo, sHi) + maxCurv) * scale);
      let b1 = Math.floor((k2 * Math.max(sLo, sHi) + maxCurv) * scale);
      if (b1 < 0 || b0 >= nCurv) continue;
      if (b0 < 0) b0 = 0;
      if (b1 >= nCurv) b1 = nCurv - 1;
      const base = j * nCurv;
      for (let b = b0; b <= b1; b++) acc[base + b]! += 1;
    }
  }
  const peaks: HoughPeak[] = [];
  for (let j = 0; j < nAngle; j++) {
    for (let b = 0; b < nCurv; b++) {
      const v = acc[j * nCurv + b]!;
      if (v < minVotes) continue;
      let isMax = true;
      let sw = 0, sa = 0, sb = 0;
      for (let da = -1; da <= 1 && isMax; da++) {
        const jj = (j + da + nAngle) % nAngle;
        for (let db = -1; db <= 1; db++) {
          const bb = b + db;
          if (bb < 0 || bb >= nCurv) continue;
          const u = acc[jj * nCurv + bb]!;
          if (u > v || (u === v && (da < 0 || (da === 0 && db < 0)))) {
            isMax = false;
            break;
          }
          sw += u;
          sa += u * da;
          sb += u * db;
        }
      }
      if (!isMax) continue;
      peaks.push({
        phi0: -Math.PI + (j + 0.5 + sa / sw) * dA,
        curvature: -maxCurv + (b + 0.5 + sb / sw) / scale,
        votes: v,
      });
    }
  }
  peaks.sort((p, q) => q.votes - p.votes);
  if (peaks.length > maxPeaks) peaks.length = maxPeaks;
  for (const p of peaks) if (p.phi0 > Math.PI) p.phi0 -= 2 * Math.PI;
  else if (p.phi0 <= -Math.PI) p.phi0 += 2 * Math.PI;
  return { accumulator: acc, nAngle, nCurv, peaks };
}
