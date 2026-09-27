// Lane–Emden equation solver, shared by the stellar-structure sims.
//
//   (1/xi^2) d/dxi( xi^2 dtheta/dxi ) = -theta^n ,   theta(0) = 1, theta'(0) = 0
//
// Rewritten as a first-order system in (theta, phi) with phi = xi^2 dtheta/dxi:
//   dtheta/dxi = phi / xi^2
//   dphi/dxi   = -xi^2 * max(theta, 0)^n
//
// xi = 0 is a removable singularity (phi/xi^2 -> 0/0), so we start from a short series expansion
// instead of xi = 0 itself, then hand off to fixed-step RK4. The star's surface is where theta
// first crosses zero (n < 5); we find it by linear interpolation between the last two samples.

export interface LaneEmdenProfile {
  n: number;
  xi: Float64Array;
  theta: Float64Array; // theta(xi), clamped at 0 for xi > xi1
  dtheta: Float64Array; // dtheta/dxi
  xi1: number; // first zero (surface)
  dthetaXi1: number; // dtheta/dxi at xi1 (always negative)
  rhoRatio: number; // rho_c / mean-rho = -xi1 / (3 dtheta/dxi(xi1))
  mp: number; // -xi1^2 * dtheta/dxi(xi1), the dimensionless mass integral
}

const SERIES_XI0 = 1e-4;

function seriesStart(n: number, xi: number): [theta: number, phi: number] {
  // theta(xi) = 1 - xi^2/6 + n*xi^4/120 - n(8n-5)*xi^6/15120 + ...  (standard Lane–Emden series)
  const xi2 = xi * xi;
  const theta = 1 - xi2 / 6 + (n * xi2 * xi2) / 120;
  // phi = xi^2 * dtheta/dxi
  const dtheta = -xi / 3 + (n * xi * xi2) / 30;
  return [theta, xi2 * dtheta];
}

function deriv(n: number, xi: number, theta: number, phi: number): [number, number] {
  const th = Math.max(theta, 0);
  const dtheta = xi > 1e-12 ? phi / (xi * xi) : 0;
  const dphi = -xi * xi * Math.pow(th, n);
  return [dtheta, dphi];
}

/** Integrate the Lane–Emden equation for polytropic index n. h is the RK4 step in xi. */
export function solveLaneEmden(n: number, h = 2e-3, xiMax = 400): LaneEmdenProfile {
  const xis: number[] = [];
  const thetas: number[] = [];
  const dthetas: number[] = [];

  let xi = SERIES_XI0;
  let [theta, phi] = seriesStart(n, xi);
  xis.push(0); thetas.push(1); dthetas.push(0);
  xis.push(xi); thetas.push(theta); dthetas.push(phi / (xi * xi));

  let xi1 = NaN, dthetaXi1 = NaN;
  while (xi < xiMax) {
    const [k1t, k1p] = deriv(n, xi, theta, phi);
    const [k2t, k2p] = deriv(n, xi + h / 2, theta + (h / 2) * k1t, phi + (h / 2) * k1p);
    const [k3t, k3p] = deriv(n, xi + h / 2, theta + (h / 2) * k2t, phi + (h / 2) * k2p);
    const [k4t, k4p] = deriv(n, xi + h, theta + h * k3t, phi + h * k3p);
    const thetaNext = theta + (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    const phiNext = phi + (h / 6) * (k1p + 2 * k2p + 2 * k3p + k4p);
    const xiNext = xi + h;

    if (thetaNext <= 0) {
      // linear interpolation of the zero crossing between (xi, theta) and (xiNext, thetaNext)
      const t = theta / (theta - thetaNext);
      xi1 = xi + t * (xiNext - xi);
      const dthetaHere = phi / (xi * xi);
      const dthetaNext = phiNext / (xiNext * xiNext);
      dthetaXi1 = dthetaHere + t * (dthetaNext - dthetaHere);
      xis.push(xi1); thetas.push(0); dthetas.push(dthetaXi1);
      break;
    }
    xi = xiNext; theta = thetaNext; phi = phiNext;
    xis.push(xi); thetas.push(theta); dthetas.push(phi / (xi * xi));
  }

  if (!Number.isFinite(xi1)) {
    // n -> 5: theta never reaches zero within xiMax (infinite radius). Report the truncation point.
    xi1 = xi;
    dthetaXi1 = phi / (xi * xi);
  }

  const rhoRatio = -xi1 / (3 * dthetaXi1);
  const mp = -xi1 * xi1 * dthetaXi1;
  return { n, xi: Float64Array.from(xis), theta: Float64Array.from(thetas), dtheta: Float64Array.from(dthetas), xi1, dthetaXi1, rhoRatio, mp };
}

/** Analytic solutions, used to sanity-check the numerics and to draw exact overlays. */
export function analyticTheta(n: 0 | 1 | 5, xi: number): number {
  if (n === 0) return 1 - (xi * xi) / 6;
  if (n === 1) return xi < 1e-8 ? 1 : Math.sin(xi) / xi;
  return 1 / Math.sqrt(1 + (xi * xi) / 3); // n = 5
}
export const ANALYTIC_XI1: Record<0 | 1 | 5, number> = { 0: Math.sqrt(6), 1: Math.PI, 5: Infinity };

/** theta at a given xi, linearly interpolated from a precomputed profile (theta clamped to 0 beyond xi1). */
export function thetaAt(p: LaneEmdenProfile, xi: number): number {
  if (xi <= 0) return 1;
  if (xi >= p.xi1) return 0;
  // binary search
  let lo = 0, hi = p.xi.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p.xi[mid] <= xi) lo = mid; else hi = mid;
  }
  const t = (xi - p.xi[lo]) / (p.xi[hi] - p.xi[lo] || 1);
  return p.theta[lo] + t * (p.theta[hi] - p.theta[lo]);
}

export interface StarModel {
  n: number;
  M: number; // kg
  R: number; // m
  mu: number; // mean molecular weight
  profile: LaneEmdenProfile;
  alpha: number; // R / xi1, length scale (m)
  rhoc: number; // kg/m^3
  Pc: number; // Pa
  Tc: number; // K
}

/** Build a physical star of given n, total mass M (kg) and radius R (m) from a Lane–Emden profile. */
export function buildStar(profile: LaneEmdenProfile, M: number, R: number, mu: number, G: number, mp_: number, kB: number): StarModel {
  const { n, xi1 } = profile;
  const alpha = R / xi1;
  const rhoc = (M * xi1) / (4 * Math.PI * R ** 3 * -profile.dthetaXi1);
  const Pc = ((4 * Math.PI * G) / (n + 1)) * rhoc * rhoc * alpha * alpha;
  const Tc = (Pc * mu * mp_) / (rhoc * kB);
  return { n, M, R, mu, profile, alpha, rhoc, Pc, Tc };
}

/** Physical profile at radius r (0..R): [rho, P, T, m(<r)]. */
export function starAt(star: StarModel, r: number): { rho: number; P: number; T: number; m: number } {
  const xi = Math.min(r / star.alpha, star.profile.xi1);
  const th = thetaAt(star.profile, xi);
  const rho = star.rhoc * Math.pow(Math.max(th, 0), star.n);
  const P = star.Pc * Math.pow(Math.max(th, 0), star.n + 1);
  const T = star.Tc * th;
  // m(<r): interpolate the dimensionless mass integral -xi^2 theta'(xi) at this xi
  let lo = 0, hi = star.profile.xi.length - 1;
  const xa = star.profile.xi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xa[mid] <= xi) lo = mid; else hi = mid;
  }
  const t = (xi - xa[lo]) / (xa[hi] - xa[lo] || 1);
  const dth = star.profile.dtheta[lo] + t * (star.profile.dtheta[hi] - star.profile.dtheta[lo]);
  const massInt = -xi * xi * dth;
  const m = star.M * (massInt / star.profile.mp);
  return { rho, P, T, m };
}
