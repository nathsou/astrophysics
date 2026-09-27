// Secondary figure: the shooting method for a two-point boundary value problem.
// Real stellar-structure integration knows the *centre* (r=0, m=0) and the *surface* (r=R, P=0)
// but only guesses the central pressure P_c that connects them. Integrate outward from a guessed
// P_c; the surface radius where P first hits zero depends on that guess. Bisect on P_c until the
// computed surface lands on the target radius R — exactly what a real code's shooting/Henyey solver
// does, just with mass and luminosity added as extra unknowns to shoot for.
//
// We use the n=3, fixed-K polytrope (K calibrated so P_c = solar central pressure gives R = R_sun):
// increasing P_c makes the star denser and *smaller* here, so r_surface(P_c) is monotonic and a
// classic bisection converges in ~20 steps to machine precision.

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { G, Msun, Rsun } from '../lib/physics/constants';

const n = 3;
// K calibrated so that Pc = PC_SUN gives r_surface = Rsun (see src/sims/stellar-structure/laneemden.ts
// for the derivation of these solar central values from the n=3 Lane–Emden solution).
const PC_SUN = 1.2449297340013390e16;
const RHOC_SUN = 76387.67857694131;
const K = PC_SUN / Math.pow(RHOC_SUN, (n + 1) / n);
const TARGET_R = Rsun;

function rhoOfP(P: number) { return P > 0 ? Math.pow(P / K, n / (n + 1)) : 0; }

/** Integrate outward; returns the surface radius (where P first crosses zero) and the trial curve. */
function shoot(Pc: number, h = 3e4, rMax = 4 * Rsun) {
  let r = 1, m = 0, P = Pc;
  const rs: number[] = [r], ps: number[] = [P];
  while (r < rMax && P > 0) {
    const f = (rr: number, mm: number, PP: number): [number, number] => {
      const rho = rhoOfP(PP);
      return [4 * Math.PI * rr * rr * rho, rr > 0 ? -(G * mm * rho) / (rr * rr) : 0];
    };
    const [k1m, k1p] = f(r, m, P);
    const [k2m, k2p] = f(r + h / 2, m + (h / 2) * k1m, P + (h / 2) * k1p);
    const [k3m, k3p] = f(r + h / 2, m + (h / 2) * k2m, P + (h / 2) * k2p);
    const [k4m, k4p] = f(r + h, m + h * k3m, P + h * k3p);
    const mNext = m + (h / 6) * (k1m + 2 * k2m + 2 * k3m + k4m);
    const pNext = P + (h / 6) * (k1p + 2 * k2p + 2 * k3p + k4p);
    r += h; m = mNext; P = pNext;
    rs.push(r); ps.push(Math.max(P, 0));
    if (P <= 0) break;
  }
  // interpolate the last crossing
  let rSurf = r;
  if (rs.length > 1 && ps[ps.length - 1] <= 0) {
    const p0 = ps[ps.length - 2], p1 = ps[ps.length - 1], r0 = rs[rs.length - 2], r1 = rs[rs.length - 1];
    const t = p0 / (p0 - p1 || 1);
    rSurf = r0 + t * (r1 - r0);
  }
  return { rSurf, rs, ps, m };
}

export default defineSim({
  mount({ host }) {
    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0, max: 1.6 * Rsun / Rsun, label: 'r (R☉)' },
      y: { min: 0, max: 1.4, label: 'P / P_c(target)' },
    });
    let pal = palette();
    onThemeChange(() => { pal = palette(); draw(); });

    let lo = PC_SUN * 0.15, hi = PC_SUN * 8;
    const trials: { Pc: number; rs: number[]; ps: number[]; rSurf: number }[] = [];

    function trial(Pc: number) {
      const { rSurf, rs, ps } = shoot(Pc);
      trials.push({ Pc, rs, ps, rSurf });
      if (trials.length > 9) trials.shift();
      return rSurf;
    }

    function step() {
      const mid = Math.sqrt(lo * hi); // bisect in log(Pc), since Pc spans decades
      const rSurf = trial(mid);
      if (rSurf > TARGET_R) lo = mid; else hi = mid; // larger Pc -> smaller star
      draw();
    }

    function reset() { lo = PC_SUN * 0.15; hi = PC_SUN * 8; trials.length = 0; step(); }

    const panel = new Panel(host);
    panel.button('Shoot once (bisect)', step, true);
    panel.button('Reset', reset);
    const roPc = panel.readout('Current guess P_c');
    const roR = panel.readout('Surface radius reached');
    const roErr = panel.readout('Error vs target R☉');
    const roN = panel.readout('Trials so far');

    function draw() {
      plot.draw(() => {
        plot.vline(1, { color: pal.good, label: 'target R☉' });
        trials.forEach((t, i) => {
          const alpha = 0.25 + 0.75 * ((i + 1) / trials.length);
          const rs = t.rs.map((r) => r / Rsun);
          const ps = t.ps.map((p) => p / PC_SUN);
          plot.line(rs, ps, { color: pal.series[i % 5], alpha, width: i === trials.length - 1 ? 2.25 : 1.25 });
        });
      });
      const last = trials[trials.length - 1];
      if (last) {
        roPc.set(`${fmt(last.Pc, 4)} Pa`);
        roR.set(`${fmt(last.rSurf / Rsun, 5)} R☉`);
        roErr.set(`${fmt(Math.abs(last.rSurf - TARGET_R) / TARGET_R * 100, 3)}%`);
      } else {
        roPc.set('—'); roR.set('—'); roErr.set('—');
      }
      roN.set(String(trials.length));
    }

    stage.onResize((w, h, dpr) => { plot.resize(w, h, dpr); draw(); });
    step(); // show the first guess straight away
    return { setVisible() {}, destroy() {} };
  },
});
