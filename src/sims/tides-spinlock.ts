// Secondary figure: spin-orbit locking. An elongated body on an eccentric orbit feels a torque
// from its own tidal bulge whenever its spin rate differs from its instantaneous orbital angular
// rate; that torque relaxes the spin toward a resonance (1:1 for low e, higher p:q ratios such as
// Mercury's 3:2 for larger e). We integrate the (heavily simplified) spin ODE alongside the orbit.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

// Units: a = 1, orbital period = 1, so the mean motion is n = 2π. The spin obeys
//   φ'' = −ε n² (a/r)³ sin 2(φ − θ)  −  κ n (a/r)⁶ (φ' − θ'),
// a permanent-asymmetry torque (which can trap the spin in a p:q resonance) plus a dissipative
// tidal torque (which drags the spin toward the orbital angular rate, hardest at periapsis).
// ε and κ are hugely exaggerated so that capture takes tens of orbits instead of millions of years.
const N_MEAN = 2 * Math.PI;
const EPS = 0.05, KAPPA = 0.02;
const RES: [number, string][] = [[1, '1:1 (synchronous, like the Moon)'], [1.5, '3:2 (like Mercury)'], [2, '2:1'], [2.5, '5:2'], [3, '3:1']];

export default defineSim({
  mount({ host, params }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const a = 1;
    const s = {
      ecc: +(params.e ?? 0.206),
      spin0: 1.7, // initial spin, in units of the mean motion
      w: 0, // spin angular velocity
      phi: 0, // body orientation
      M: 0, // mean anomaly
      orbits: 0,
      phiAtOrbit: 0,
      avgRatio: 1.7,
    };
    function reset() { s.w = s.spin0 * N_MEAN; s.phi = 0; s.M = 0; s.orbits = 0; s.phiAtOrbit = 0; s.avgRatio = s.spin0; }
    reset();

    function keplerSolve(M: number, ecc: number): number {
      let E = M;
      for (let i = 0; i < 8; i++) E -= (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E));
      return E;
    }

    function orbitState(M: number, ecc: number) {
      const E = keplerSolve(M, ecc);
      const r = a * (1 - ecc * Math.cos(E));
      const th = 2 * Math.atan2(Math.sqrt(1 + ecc) * Math.sin(E / 2), Math.sqrt(1 - ecc) * Math.cos(E / 2));
      const thetaDot = (N_MEAN * Math.sqrt(1 - ecc * ecc)) / ((1 - ecc * Math.cos(E)) ** 2);
      return { r, th, thetaDot };
    }

    function step(h: number) {
      const { th, thetaDot, r } = orbitState(s.M, s.ecc);
      const acc = -EPS * N_MEAN * N_MEAN / r ** 3 * Math.sin(2 * (s.phi - th)) - KAPPA * N_MEAN / r ** 6 * (s.w - thetaDot);
      s.w += acc * h;
      s.phi += s.w * h;
      s.M += N_MEAN * h;
      if (s.M >= 2 * Math.PI * (s.orbits + 1)) { // once per orbit: average spin over that orbit
        s.orbits++;
        s.avgRatio = (s.phi - s.phiAtOrbit) / (2 * Math.PI);
        s.phiAtOrbit = s.phi;
      }
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const scale = Math.min(W, H) / 2.6;
      const cx = W / 2 + a * s.ecc * scale * 0.5, cy = H / 2;
      const b = a * Math.sqrt(1 - s.ecc * s.ecc), c = a * s.ecc;

      ctx.strokeStyle = pal.faint; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx - c * scale, cy, a * scale, b * scale, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
      g.addColorStop(0, '#fff6dd'); g.addColorStop(0.3, '#f0b35a'); g.addColorStop(1, 'rgba(240,179,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();

      const { r, th } = orbitState(s.M, s.ecc);
      const bx = cx + r * Math.cos(th) * scale, by = cy - r * Math.sin(th) * scale;
      // the direction to the star, for comparison with the body's long axis
      ctx.strokeStyle = pal.faint; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(-s.phi);
      ctx.fillStyle = pal.series[1];
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.fg; // a marker on one end of the long axis, to see it turn
      ctx.beginPath(); ctx.arc(12, 0, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      const ratio = s.avgRatio;
      const near = RES.reduce((p, q) => (Math.abs(q[0] - ratio) < Math.abs(p[0] - ratio) ? q : p));
      const locked = Math.abs(near[0] - ratio) < 0.03 && s.orbits > 3;
      readout1.set(`${fmt(ratio, 3)}${locked ? ` → locked in ${near[1]}` : ''}`);
      readout2.set(`${s.orbits}`);
    }

    const loop = new Loop(step, render, 1 / 240);
    loop.timeScale = 2; // two orbits per second
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.slider('Eccentricity', { min: 0, max: 0.6, value: s.ecc, step: 0.01 }, (v) => { s.ecc = v; reset(); loop.invalidate(); });
    panel.slider('Initial spin (× orbital rate)', { min: 0.5, max: 4, value: s.spin0, step: 0.05 }, (v) => { s.spin0 = v; reset(); loop.invalidate(); });
    panel.button('Reset', () => { reset(); loop.invalidate(); });
    const readout1 = panel.readout('Spin ÷ mean orbital rate (last orbit)');
    const readout2 = panel.readout('Orbits');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
