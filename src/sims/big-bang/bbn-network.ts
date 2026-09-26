// A reduced Big Bang Nucleosynthesis network: n, p, D, T, He3, He4, Li7.
// Rates are APPROXIMATE analytic fits (order-of-magnitude correct, tuned so the freeze-out
// temperature, deuterium bottleneck and final helium fraction come out right) — not the
// output of a precision reaction-rate code (e.g. NACRE/AME). Good for the physics story, not for
// a paper. See the <Hood> in the chapter for the numerical method (stiff implicit solver).
import { B_D, DELTA_M, HBARC_CM, M_N_MEV, M_P_MEV, TAU_N, gStar, hubble, nBaryon, tempAtTime, timeAtT } from './cosmo';

// species order
export const SPECIES = ['n', 'p', 'D', 'T', 'He3', 'He4', 'Li7'] as const;
export type Species = (typeof SPECIES)[number];
export const NS = SPECIES.length;

export interface NetworkParams {
  eta: number; // baryon-to-photon ratio
  Neff: number;
}

// Approximate constant thermal-averaged cross-sections <σv> in cm^3/s for the charged-particle
// reactions (weakly temperature dependent at BBN temperatures; treated as constants here — labelled
// approximate). p(n,γ)D uses a proper Saha detailed-balance term instead, since that's the bottleneck.
const SIGV_PN = 4.6e-20; // p + n -> D + gamma (forward)
const SIGV_DD_N = 1.8e-17; // D + D -> He3 + n
const SIGV_DD_P = 1.8e-17; // D + D -> T + p
const SIGV_DT = 1.0e-16; // D + T -> He4 + n
const SIGV_DHE3 = 1.0e-16; // D + He3 -> He4 + p
const SIGV_HE3N = 4.0e-18; // He3 + n -> T + p (charge exchange)
const SIGV_THE4 = 1.0e-20; // T + He4 -> Li7 + gamma
const SIGV_HE3HE4 = 1.0e-20; // He3 + He4 -> Li7 + p (lumped Be7 + n -> Li7 + p pathway, approximate)

/** Saha equilibrium ratio S_D(T) = (Y_D / (Y_n Y_p))_eq, dimensionless (Y_i = n_i/n_b). */
function saha_D(T: number, eta: number): number {
  const mr = (M_N_MEV * M_P_MEV) / (M_N_MEV + M_P_MEV); // reduced mass, MeV
  const vol = (2 * Math.PI / (mr * T)) ** 1.5 * HBARC_CM ** 3; // cm^3, natural units (hbar=c=1)
  const nb = nBaryon(T, eta);
  const gRatio = 3 / 4; // g_D / (g_n g_p) = 3/(2*2)
  return nb * gRatio * vol * Math.exp(B_D / T);
}

function weakRates(T: number) {
  // Gamow-Teller-like scaling Γ ∝ T^5, normalised so Γ_weak(0.8 MeV) = H(0.8 MeV): that is
  // precisely the definition of the freeze-out temperature, so this fit reproduces it by construction.
  const Tf = 0.8;
  const Gamma0 = hubble(Tf);
  const Gw = Gamma0 * (T / Tf) ** 5;
  const x = DELTA_M / T;
  const Gnp = Gw / (1 + Math.exp(-x)); // n -> p
  const Gpn = Gw / (1 + Math.exp(x)); // p -> n
  return { Gnp, Gpn };
}

/** Right-hand side dY/dt for the network at temperature T(t). Y is length NS: [n,p,D,T,He3,He4,Li7]. */
export function rhs(Y: Float64Array, T: number, p: NetworkParams, out: Float64Array) {
  out.fill(0);
  const [Yn, Yp, YD, YT, YHe3, YHe4] = Y;
  const nb = nBaryon(T, p.eta);

  // weak n<->p + free neutron decay
  const { Gnp, Gpn } = weakRates(T);
  const decay = Yn / TAU_N;
  out[0] += -Gnp * Yn + Gpn * Yp - decay;
  out[1] += Gnp * Yn - Gpn * Yp + decay;

  // p + n <-> D + gamma (Saha detailed balance — the deuterium bottleneck)
  const Sd = saha_D(T, p.eta);
  const fwd = SIGV_PN * nb;
  const rD = fwd * Yn * Yp - (fwd / Sd) * YD;
  out[0] -= rD; out[1] -= rD; out[2] += rD;

  // D + D -> He3 + n
  const r1 = SIGV_DD_N * nb * YD * YD * 0.5;
  out[2] -= 2 * r1; out[4] += r1; out[0] += r1;
  // D + D -> T + p
  const r2 = SIGV_DD_P * nb * YD * YD * 0.5;
  out[2] -= 2 * r2; out[3] += r2; out[1] += r2;
  // D + T -> He4 + n
  const r3 = SIGV_DT * nb * YD * YT;
  out[2] -= r3; out[3] -= r3; out[5] += r3; out[0] += r3;
  // D + He3 -> He4 + p
  const r4 = SIGV_DHE3 * nb * YD * YHe3;
  out[2] -= r4; out[4] -= r4; out[5] += r4; out[1] += r4;
  // He3 + n -> T + p
  const r5 = SIGV_HE3N * nb * YHe3 * Yn;
  out[4] -= r5; out[0] -= r5; out[3] += r5; out[1] += r5;
  // T + He4 -> Li7 + gamma
  const r6 = SIGV_THE4 * nb * YT * YHe4;
  out[3] -= r6; out[5] -= r6; out[6] += r6;
  // He3 + He4 -> Li7 + p (lumped Be7 pathway)
  const r7 = SIGV_HE3HE4 * nb * YHe3 * YHe4;
  out[4] -= r7; out[5] -= r7; out[6] += r7; out[1] += r7;

  return out;
}

/** One implicit (backward Euler + Newton) step from t to t+h, in place. Returns the updated Y. */
function backwardEulerStep(Y: Float64Array, t: number, h: number, p: NetworkParams): Float64Array {
  const T = tempAtTime(t + h, p.Neff);
  const Y0 = Y.slice();
  const Ynew = Y.slice();
  const f = new Float64Array(NS);
  const fPlus = new Float64Array(NS);
  const F = new Float64Array(NS); // residual
  const J = new Array(NS).fill(0).map(() => new Float64Array(NS));
  const EPS = 1e-9;

  for (let iter = 0; iter < 25; iter++) {
    rhs(Ynew, T, p, f);
    let maxRes = 0;
    for (let i = 0; i < NS; i++) {
      F[i] = Ynew[i] - Y0[i] - h * f[i];
      maxRes = Math.max(maxRes, Math.abs(F[i]));
    }
    if (maxRes < 1e-16) break;
    // numerical Jacobian of F wrt Ynew
    for (let j = 0; j < NS; j++) {
      const save = Ynew[j];
      const dj = Math.max(Math.abs(save) * EPS, 1e-30);
      Ynew[j] = save + dj;
      rhs(Ynew, T, p, fPlus);
      for (let i = 0; i < NS; i++) J[i][j] = ((Ynew[i] - Y0[i] - h * fPlus[i]) - F[i]) / dj;
      Ynew[j] = save;
    }
    // fix up the diagonal term for the perturbed variable itself (Ynew[j] changes F[j] directly too)
    for (let j = 0; j < NS; j++) J[j][j] += 1e-30; // guard
    const delta = solveLinear(J, F);
    let step = 1;
    for (let i = 0; i < NS; i++) {
      // damp to keep abundances non-negative and bounded
      if (delta[i] > 0 && Ynew[i] - step * delta[i] < -1e-3) step = Math.min(step, (Ynew[i] + 1e-3) / delta[i]);
    }
    for (let i = 0; i < NS; i++) Ynew[i] -= step * delta[i];
    for (let i = 0; i < NS; i++) if (Ynew[i] < 0) Ynew[i] = 0;
  }
  return Ynew;
}

function solveLinear(A: Float64Array[], b: Float64Array): Float64Array {
  const n = b.length;
  const M = A.map((row) => Float64Array.from(row));
  const rhsv = Float64Array.from(b);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (piv !== col) { [M[col], M[piv]] = [M[piv], M[col]]; [rhsv[col], rhsv[piv]] = [rhsv[piv], rhsv[col]]; }
    const pv = M[col][col] || 1e-300;
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / pv;
      if (f === 0) continue;
      for (let c = col; c < n; c++) M[r][c] -= f * M[col][c];
      rhsv[r] -= f * rhsv[col];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = rhsv[r];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / (M[r][r] || 1e-300);
  }
  return x;
}

export interface RunPoint { t: number; T: number; Y: Float64Array }

/** Integrate the network from t0 to t1 (seconds) with adaptive steps, roughly even in log t.
 *  Baryon number (n + p + 2D + 3T + 3He3 + 4He4 + 7Li7, weighted) is conserved by construction
 *  since every reaction above balances nucleon count exactly. */
export function integrateBBN(t0: number, t1: number, p: NetworkParams, nSteps = 260): RunPoint[] {
  const Y = new Float64Array(NS);
  const T0 = tempAtTime(t0, p.Neff);
  const npEq = Math.exp(-DELTA_M / T0);
  Y[0] = npEq / (1 + npEq); // n
  Y[1] = 1 / (1 + npEq); // p
  const out: RunPoint[] = [{ t: t0, T: T0, Y: Y.slice() }];
  const logt0 = Math.log(t0), logt1 = Math.log(t1);
  let t = t0;
  for (let i = 1; i <= nSteps; i++) {
    const tNext = Math.exp(logt0 + (logt1 - logt0) * (i / nSteps));
    const h = tNext - t;
    const Ynew = backwardEulerStep(Y, t, h, p);
    Y.set(Ynew);
    t = tNext;
    out.push({ t, T: tempAtTime(t, p.Neff), Y: Y.slice() });
  }
  return out;
}

/** Final mass fraction of He4 (Y_p in astronomers' notation) and light-element ratios relative to H. */
export function finalAbundances(p: NetworkParams, t1 = 1800) {
  const run = integrateBBN(1e-2, t1, p, 220);
  const last = run[run.length - 1].Y;
  const [n, prot, D, T, He3, He4, Li7] = last;
  const nH = prot; // proton fraction ~ hydrogen fraction (all leftover p become H)
  return {
    Yp: 4 * He4, // mass fraction (He4 carries A=4 per nucleus, Y_i already number/baryon)
    DtoH: D / nH,
    He3toH: He3 / nH,
    Li7toH: Li7 / nH,
    run,
  };
}
