// Secondary figure: the white dwarf mass–radius relation from the exact Chandrasekhar equation of
// state, found by shooting-integrating hydrostatic equilibrium outward from a chosen central density.
//
// Physics: fully degenerate electrons at zero temperature. Let x = p_F/(m_e c) (relativity parameter).
//   P(x) = (pi me^4 c^5 / 3h^3) f(x),   f(x) = x(2x^2-3)sqrt(x^2+1) + 3 asinh(x)
//   rho(x) = (8 pi mu_e mp / 3h^3) (me c)^3 x^3
// f(x) -> (8/5) x^5 as x->0 (non-relativistic, P ~ rho^{5/3}) and f(x) -> 2x^4 as x->infinity
// (relativistic, P ~ rho^{4/3}), which is why the star has a maximum mass (Chandrasekhar limit).
//
// We integrate dP/dr = -G m rho / r^2, dm/dr = 4 pi r^2 rho outward from r=0 with RK4 in a
// log-adaptive step, inverting P(x) by bisection at each step (f is monotonic), until P falls to
// zero: that r is the radius, that m is the mass.

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { G, h, c, me, mp, Msun, Rsun } from '../lib/physics/constants';

const A_PRESS = (Math.PI * me ** 4 * c ** 5) / (3 * h ** 3);
const B_RHO_PER_MUE = (8 * Math.PI * mp * (me * c) ** 3) / (3 * h ** 3); // rho = B_RHO_PER_MUE * mu_e * x^3

function fOfX(x: number): number {
  if (x < 1e-4) return 1.6 * x ** 5 * (1 - 0.75 * x * x); // series, avoids cancellation
  return x * (2 * x * x - 3) * Math.sqrt(x * x + 1) + 3 * Math.asinh(x);
}
function pressureOfX(x: number): number { return A_PRESS * fOfX(x); }
function rhoOfX(x: number, muE: number): number { return B_RHO_PER_MUE * muE * x ** 3; }

/** Invert P(x) by bisection (f is smooth and strictly increasing for x>0). */
function xOfPressure(P: number, xHi0: number): number {
  if (P <= 0) return 0;
  let lo = 0, hi = Math.max(xHi0, 1e-6);
  while (pressureOfX(hi) < P) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (pressureOfX(mid) < P) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

interface Star { r: Float64Array; m: Float64Array; P: Float64Array; n: number; R: number; M: number }

/** Shoot-integrate one star from a central relativity parameter xc. Returns radius/mass profile. */
function integrateStar(xc: number, muE: number, maxPts = 4000): Star {
  const rho_c = rhoOfX(xc, muE);
  const P_c = pressureOfX(xc);
  let r = 1.0, m = (4 / 3) * Math.PI * r ** 3 * rho_c, P = P_c - (2 / 3) * Math.PI * G * rho_c ** 2 * r ** 2;
  const rs = new Float64Array(maxPts), ms = new Float64Array(maxPts), Ps = new Float64Array(maxPts);
  let n = 0;
  rs[n] = r; ms[n] = m; Ps[n] = P; n++;
  let x = xc;
  const deriv = (rr: number, mm: number, PP: number): [number, number] => {
    const xx = xOfPressure(Math.max(PP, 0), x);
    const rho = rhoOfX(xx, muE);
    return [4 * Math.PI * rr * rr * rho, rr > 0 ? -(G * mm * rho) / (rr * rr) : 0];
  };
  while (n < maxPts && P > P_c * 1e-9 && r < 1e11) {
    const h_ = Math.max(r * 0.02, 10);
    const [k1m, k1P] = deriv(r, m, P);
    const [k2m, k2P] = deriv(r + h_ / 2, m + (h_ / 2) * k1m, P + (h_ / 2) * k1P);
    const [k3m, k3P] = deriv(r + h_ / 2, m + (h_ / 2) * k2m, P + (h_ / 2) * k2P);
    const [k4m, k4P] = deriv(r + h_, m + h_ * k3m, P + h_ * k3P);
    m += (h_ / 6) * (k1m + 2 * k2m + 2 * k3m + k4m);
    P += (h_ / 6) * (k1P + 2 * k2P + 2 * k3P + k4P);
    r += h_;
    x = xOfPressure(Math.max(P, 0), x);
    rs[n] = r; ms[n] = m; Ps[n] = Math.max(P, 0); n++;
    if (P <= 0) break;
  }
  return { r: rs, m: ms, P: Ps, n, R: r, M: m };
}

/** Sweep central density to build the whole mass–radius curve (cached per mu_e). */
function buildCurve(muE: number, nPts = 60) {
  const Ms: number[] = [], Rs: number[] = [];
  for (let i = 0; i < nPts; i++) {
    const xc = 10 ** (-2 + (i / (nPts - 1)) * 3.4); // 0.01 .. ~25
    const s = integrateStar(xc, muE, 2000);
    Ms.push(s.M / Msun); Rs.push(s.R / Rsun);
  }
  return { Ms, Rs };
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0.15, max: 1.6, label: 'mass (M☉)' },
      y: { min: 0.001, max: 0.03, log: true, label: 'radius (R☉)' },
      title: 'White dwarf mass–radius relation',
    });
    stage.onResize((w, hh, dpr) => { plot.resize(w, hh, dpr); draw(); });
    onThemeChange(() => { pal = palette(); draw(); });

    let muE = 2.0;
    let xc = 1.0; // current star shown as a point, draggable via slider
    let curve = buildCurve(muE);
    const MchAnalytic = () => 5.836 / (muE * muE); // Msun, standard closed form

    const panel = new Panel(host);
    const roM = panel.readout('Mass');
    const roR = panel.readout('Radius');
    const roRho = panel.readout('Central density');
    const roMch = panel.readout('Chandrasekhar limit');
    panel.slider('Central density parameter x꜀ = p_F/mₑc', { min: 0.02, max: 30, value: xc, log: true, step: 0.001 }, (v) => { xc = v; draw(); });
    panel.slider('μₑ (mean mass per electron)', { min: 2.0, max: 2.2, value: muE, log: false, step: 0.01 }, (v) => { muE = v; curve = buildCurve(muE); draw(); });

    function draw() {
      const star = integrateStar(xc, muE, 2000);
      const M = star.M / Msun, R = star.R / Rsun;
      roM.set(`${fmt(M, 4)} M☉`);
      roR.set(`${fmt(R, 4)} R☉ (${fmt(star.R / 1000, 3)} km)`);
      roRho.set(`${fmt(rhoOfX(xc, muE) / 1000, 3)} g/cm³`);
      roMch.set(`${fmt(MchAnalytic(), 4)} M☉`);

      // reference non-relativistic power law R ∝ M^(-1/3), calibrated to this curve's low-mass
      // (non-relativistic) limit — same EOS, just the x≪1 series for f(x).
      const i0 = 4; // a safely non-relativistic point on the sweep
      const Cref = curve.Rs[i0] * curve.Ms[i0] ** (1 / 3);

      plot.draw(() => {
        plot.fn((M_) => Cref * M_ ** (-1 / 3), { color: pal.muted, dash: [4, 4], width: 1.25 });
        plot.line(curve.Ms, curve.Rs, { color: pal.series[0], width: 2.25 });
        plot.vline(MchAnalytic(), { color: pal.bad, label: 'M_Ch' });
        plot.point(M, R, { r: 5, color: pal.accent, stroke: pal.fg });
        plot.point(1.00, 0.0084, { r: 3.5, color: pal.series[2], label: 'Sirius B' });
        plot.text('dashed: R ∝ M⁻¹/³ (non-relativistic limit of the same EOS)', plot.m.l + 8, plot.m.t + 14, { color: pal.muted, size: 10.5 });
      });
    }
    draw();

    return { setVisible() {}, destroy() {} };
  },
});
