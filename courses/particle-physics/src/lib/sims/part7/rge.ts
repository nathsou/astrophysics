/**
 * A ONE-LOOP TOY of the running of the Higgs self-coupling λ with the energy scale μ, to show why the top quark mass matters for the stability of the vacuum
 * (Chapter 30). It is a toy: the careful calculations (Degrassi et al. 2012; Buttazzo et al. 2013) work to two loops and beyond, with matching conditions at the
 * weak scale that are worked out with more care than the two rounded numbers below, and they find the scale at which λ crosses zero to be of the order of
 * 10¹⁰ GeV, about an order of magnitude above this toy's. What the toy does show correctly is the sign of the effect and its steep dependence on m_t.
 *
 * Equations (V = λ(|H|² − v²/2)², m_H² = 2λv², standard one-loop renormalisation-group equations of the Standard Model; t = ln μ, k = 1/16π²):
 *     dg₃/dt = −7 k g₃³            dg₂/dt = −(19/6) k g₂³          dg′/dt = (41/6) k g′³
 *     dy_t/dt = k y_t (9/2 y_t² − 8 g₃² − 9/4 g₂² − 17/12 g′²)
 *     dλ/dt  = k [24λ² + 12λ y_t² − 6y_t⁴ − 3λ(3g₂² + g′²) + 3/8 (2g₂⁴ + (g₂² + g′²)²)]
 * Initial values at μ = m_t (rounded, typical MS-bar values): g₂ = 0.6483, g′ = 0.3587, α_s(m_t) = 0.1085, y_t = 0.936 √2 m_t/v (the factor 0.936 is the
 * approximate size of the QCD correction between the pole mass and the MS-bar Yukawa coupling) and λ = 0.1264 for m_H = 125.2 GeV (rescaled as m_H² for other masses).
 */
import { V_EW_GEV } from '../../hep/fields/index.ts';

const K = 1 / (16 * Math.PI * Math.PI);
export const M_PLANCK_GEV = 1.22e19;

export type Couplings = [g3: number, g2: number, gp: number, yt: number, lambda: number];

export function beta(y: Couplings): Couplings {
  const [g3, g2, gp, yt, lam] = y;
  return [
    K * -7 * g3 ** 3,
    K * -(19 / 6) * g2 ** 3,
    K * (41 / 6) * gp ** 3,
    K * yt * (4.5 * yt * yt - 8 * g3 * g3 - 2.25 * g2 * g2 - (17 / 12) * gp * gp),
    K * (24 * lam * lam + 12 * lam * yt * yt - 6 * yt ** 4 - 3 * lam * (3 * g2 * g2 + gp * gp) + (3 / 8) * (2 * g2 ** 4 + (g2 * g2 + gp * gp) ** 2)),
  ];
}

export function initialCouplings(mt: number, mH: number): Couplings {
  const alphaS = 0.1085;
  return [Math.sqrt(4 * Math.PI * alphaS), 0.6483, 0.3587, (0.936 * Math.SQRT2 * mt) / V_EW_GEV, 0.1264 * (mH / 125.2) ** 2];
}

export interface Running {
  /** Scales in GeV and λ(μ), yt(μ) at those scales. */
  mu: number[];
  lambda: number[];
  yt: number[];
  /** The scale at which λ first crosses zero, or Infinity if it does not before the Planck mass. */
  zeroAt: number;
}

/** Run the couplings from μ = m_t up to the Planck mass with fourth-order Runge–Kutta in ln μ. */
export function runCouplings(mt: number, mH = 125.2, stepsPerE = 25): Running {
  let y = initialCouplings(mt, mH);
  let t = Math.log(mt);
  const tEnd = Math.log(M_PLANCK_GEV);
  const dt = 1 / stepsPerE;
  const mu = [mt], lambda = [y[4]], yt = [y[3]];
  let zeroAt = Infinity;
  const add = (a: Couplings, b: Couplings, h: number): Couplings => a.map((v, i) => v + h * b[i]!) as Couplings;
  while (t < tEnd) {
    const k1 = beta(y), k2 = beta(add(y, k1, dt / 2)), k3 = beta(add(y, k2, dt / 2)), k4 = beta(add(y, k3, dt));
    const yn = y.map((v, i) => v + (dt / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!)) as Couplings;
    if (zeroAt === Infinity && y[4] > 0 && yn[4] <= 0) zeroAt = Math.exp(t + (dt * y[4]) / (y[4] - yn[4]));
    y = yn;
    t += dt;
    mu.push(Math.exp(t));
    lambda.push(y[4]);
    yt.push(y[3]);
  }
  return { mu, lambda, yt, zeroAt };
}
