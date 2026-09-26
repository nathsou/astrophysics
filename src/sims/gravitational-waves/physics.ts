// Shared gravitational-wave physics for Chapter 20 (sims + page script).
//
// Conventions: geometric units G = c = 1 with the TOTAL mass M = 1 for the inspiral timeline,
// so time and length are both measured in M (1 M = G M / c³ seconds = G M / c² metres).
// Real-unit conversions use T_sun = G M☉ / c³ = 4.925 µs.

export const G = 6.6743e-11;
export const C = 2.99792458e8;
export const MSUN = 1.98847e30;
export const T_SUN = (G * MSUN) / C ** 3; // 4.925e-6 s
export const L_SUN_GEOM = (G * MSUN) / C ** 2; // 1477 m
export const MPC = 3.0856775814913673e22;
export const YR = 3.15576e7;
export const C5_OVER_G = C ** 5 / G; // 3.63e52 W

export const chirpMass = (m1: number, m2: number) => Math.pow(m1 * m2, 3 / 5) / Math.pow(m1 + m2, 1 / 5);
export const symMassRatio = (m1: number, m2: number) => (m1 * m2) / (m1 + m2) ** 2;

/** Leading-order (Newtonian) chirp, physical units. Mc in M☉, f in Hz (GW frequency), τ in s. */
export const tauFromF = (Mc: number, f: number) => (5 / 256) * Math.pow(Math.PI * f, -8 / 3) * Math.pow(Mc * T_SUN, -5 / 3);
export const fFromTau = (Mc: number, tau: number) => (1 / Math.PI) * Math.pow(5 / (256 * tau), 3 / 8) * Math.pow(Mc * T_SUN, -5 / 8);
export const fdot = (Mc: number, f: number) => (96 / 5) * Math.pow(Math.PI, 8 / 3) * Math.pow(Mc * T_SUN, 5 / 3) * Math.pow(f, 11 / 3);
/** Number of GW cycles between f1 and f2 (Newtonian). */
export const nCycles = (Mc: number, f1: number, f2: number) =>
  (1 / (32 * Math.pow(Math.PI, 8 / 3))) * Math.pow(Mc * T_SUN, -5 / 3) * (Math.pow(f1, -5 / 3) - Math.pow(f2, -5 / 3));
/** GW frequency at the Schwarzschild ISCO for total mass M (M☉): f = 1/(6^{3/2} π G M/c³) ≈ 4.4 kHz / M. */
export const fISCO = (M: number) => 1 / (Math.pow(6, 1.5) * Math.PI * M * T_SUN);

/** Remnant of a non-spinning BBH merger (fits to NR: Buonanno/Kidder/Lehner-style, good to a few %). */
export function remnant(eta: number) {
  const Mf = 1 - (1 - Math.sqrt(8 / 9)) * eta - 0.4333 * eta * eta - 0.4392 * eta ** 3; // in units of M
  const chi = Math.sqrt(12) * eta - 3.871 * eta * eta + 4.028 * eta ** 3;
  // l=m=2 fundamental QNM (Berti, Cardoso & Will 2006 fits)
  const wHat = 1.5251 - 1.1568 * Math.pow(1 - chi, 0.1292); // M_f ω
  const Q = 0.7 + 1.4187 * Math.pow(1 - chi, -0.499);
  const omegaQNM = wHat / Mf; // in 1/M
  const tauD = (2 * Q) / omegaQNM; // in M
  return { Mf, chi, omegaQNM, tauD };
}

/** A precomputed source-frame timeline sampled uniformly in time (units of M, t = 0 at peak amplitude). */
export interface Timeline {
  n: number;
  t0: number;
  dt: number;
  tEnd: number;
  tISCO: number;
  eta: number;
  /** Interleaved [Φ_gw, A, ω_gw, separation] per sample, f32 for GPU upload. */
  data: Float32Array;
  /** Same in f64 for CPU sampling. */
  phase: Float64Array;
  amp: Float64Array;
  omega: Float64Array;
  sep: Float64Array;
  peakAmp: number;
  rem: ReturnType<typeof remnant>;
}

/**
 * Build the waveform timeline:
 *  1. Newtonian quadrupole inspiral from separation r0 to the ISCO (r = 6M):
 *       M ω_orb(τ) = (1/8) (η τ / 5M)^(-3/8),   A = 4 η (M ω_orb)^(2/3)
 *  2. a stylised merger: ω_gw rises from 2ω_ISCO to the QNM frequency along a cubic Hermite curve
 *     that matches the inspiral slope, while the amplitude grows ~1.5×;
 *  3. ringdown: ω_gw = ω_QNM, A ∝ exp(−t/τ_d).
 * The phase is the running integral of ω_gw (trapezoid rule, float64).
 */
export function buildTimeline(eta: number, r0 = 15, n = 16384): Timeline {
  const rem = remnant(eta);
  const wIsco = Math.pow(6, -1.5);
  const tauOf = (w: number) => (5 / eta) * Math.pow(8 * w, -8 / 3); // time to Newtonian coalescence
  const w0 = Math.pow(r0, -1.5);
  const tau0 = tauOf(w0), tauI = tauOf(wIsco);
  const inspDur = tau0 - tauI;
  // merger segment
  const wg1 = 2 * wIsco;
  const slope1 = (2 * (3 / 8) * wIsco) / tauI; // dω_gw/dt at ISCO: ω ∝ τ^(-3/8)
  const dW = rem.omegaQNM - wg1;
  const Tm = Math.min(60, Math.max(12, (2 * dW) / slope1));
  const ringDur = 9 * rem.tauD;
  const t0 = -(inspDur + Tm);
  const tISCO = -Tm;
  const tEnd = ringDur;
  const dt = (tEnd - t0) / (n - 1);
  const phase = new Float64Array(n), amp = new Float64Array(n), omega = new Float64Array(n), sep = new Float64Array(n);
  const A1 = 4 * eta * Math.pow(wIsco, 2 / 3);
  const Apk = 1.5 * A1;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * dt;
    let w: number, A: number, r: number;
    if (t <= tISCO) {
      const tau = tauI + (tISCO - t);
      const wo = 0.125 * Math.pow((eta * tau) / 5, -3 / 8);
      w = 2 * wo; A = 4 * eta * Math.pow(wo, 2 / 3); r = Math.pow(wo, -2 / 3);
    } else if (t <= 0) {
      const s = (t - tISCO) / Tm; // 0..1
      // cubic Hermite: value wg1 → ω_QNM, slope slope1·Tm → 0
      const h00 = 2 * s ** 3 - 3 * s * s + 1, h10 = s ** 3 - 2 * s * s + s, h01 = -2 * s ** 3 + 3 * s * s;
      w = h00 * wg1 + h10 * slope1 * Tm + h01 * rem.omegaQNM;
      const ss = s * s * (3 - 2 * s);
      A = A1 + (Apk - A1) * ss;
      r = Math.max(0, 6 * (1 - s)); // plunge: separation shrinks to zero at the peak
    } else {
      w = rem.omegaQNM; A = Apk * Math.exp(-t / rem.tauD); r = 0;
    }
    omega[i] = w; amp[i] = A; sep[i] = r;
    phase[i] = i === 0 ? 0 : phase[i - 1] + 0.5 * dt * (w + omega[i - 1]);
  }
  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { data[4 * i] = phase[i]; data[4 * i + 1] = amp[i]; data[4 * i + 2] = omega[i]; data[4 * i + 3] = sep[i]; }
  return { n, t0, dt, tEnd, tISCO, eta, data, phase, amp, omega, sep, peakAmp: Apk, rem };
}

/** Linear interpolation into a timeline array; returns 0 before the start (the wavefront hasn't arrived). */
export function sample(tl: Timeline, arr: Float64Array, t: number): number {
  const x = (t - tl.t0) / tl.dt;
  if (x <= 0) return arr[0];
  if (x >= tl.n - 1) return arr[tl.n - 1];
  const i = Math.floor(x), f = x - i;
  return arr[i] * (1 - f) + arr[i + 1] * f;
}

/** Peters (1964) orbit-averaged decay: time to merger (s) for masses in M☉, initial a (m), e. */
export function petersMergerTime(m1: number, m2: number, a0: number, e0: number): number {
  const M = m1 + m2;
  const beta = (64 / 5) * (G ** 3 * m1 * m2 * M * MSUN ** 3) / C ** 5;
  // integrate dt = da / |da/dt| along the e(a) curve, stepping in ln a
  let a = a0, e = e0, t = 0;
  const dadt = (a: number, e: number) => {
    const e2 = e * e;
    return (-beta * (1 + (73 / 24) * e2 + (37 / 96) * e2 * e2)) / (a ** 3 * Math.pow(1 - e2, 3.5));
  };
  const deda = (a: number, e: number) => {
    const e2 = e * e;
    return ((19 / 12) * e * (1 + (121 / 304) * e2) * (1 - e2)) / (a * (1 + (73 / 24) * e2 + (37 / 96) * e2 * e2));
  };
  const aEnd = a0 * 1e-4;
  const steps = 4000;
  const h = Math.log(aEnd / a0) / steps; // negative
  for (let k = 0; k < steps; k++) {
    // RK2 in u = ln a for both e and t
    const f = (a: number, e: number) => [a * deda(a, e), a / dadt(a, e)] as const;
    const [de1, dt1] = f(a, e);
    const am = a * Math.exp(h / 2), em = Math.min(0.999999, Math.max(0, e + (h / 2) * de1));
    const [de2, dt2] = f(am, em);
    e = Math.min(0.999999, Math.max(0, e + h * de2));
    t += h * dt2;
    a *= Math.exp(h);
    void dt1;
  }
  // remaining circular tail from aEnd: T = a^4 / (4 β)
  t += a ** 4 / (4 * beta);
  return t;
}

/** Kepler III: semi-major axis (m) from period (s) and total mass (M☉). */
export const aFromP = (P: number, M: number) => Math.cbrt((G * M * MSUN * P * P) / (4 * Math.PI * Math.PI));

/** Radix-2 in-place complex FFT (re, im Float64Array of power-of-two length). inverse → unscaled. */
export function fft(re: Float64Array, im: Float64Array, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}
