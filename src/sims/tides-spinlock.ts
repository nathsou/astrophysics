// Secondary figure: spin-orbit locking. An elongated body on an eccentric orbit feels a torque
// from its own tidal bulge whenever its spin rate differs from its instantaneous orbital angular
// rate; that torque relaxes the spin toward a resonance (1:1 for low e, higher p:q ratios such as
// Mercury's 3:2 for larger e). We integrate the (heavily simplified) spin ODE alongside the orbit.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

const GM = 4 * Math.PI * Math.PI;

export default defineSim({
  mount({ host, params }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const a = 1, e = +(params.e ?? 0.35);
    const period = Math.sqrt(a ** 3);
    const s = {
      ecc: e,
      spinRate: 3.2, // initial spin, in orbits⁻¹ (multiples of mean motion)
      theta: 0, // orbital true anomaly (integrated via Kepler)
      phi: 0, // body orientation
      M: 0, // mean anomaly
      k: 0.9, // torque strength (arbitrary units, tunable for a legible relaxation time)
    };

    function keplerSolve(M: number, ecc: number): number {
      let E = M;
      for (let i = 0; i < 6; i++) E -= (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E));
      return E;
    }

    function orbitState(M: number, ecc: number) {
      const E = keplerSolve(M, ecc);
      const r = a * (1 - ecc * Math.cos(E));
      const th = 2 * Math.atan2(Math.sqrt(1 + ecc) * Math.sin(E / 2), Math.sqrt(1 - ecc) * Math.cos(E / 2));
      const n = (2 * Math.PI) / period;
      const thetaDot = (n * Math.sqrt(1 - ecc * ecc)) / ((1 - ecc * Math.cos(E)) ** 2);
      return { r, th, thetaDot };
    }

    function step(h: number) {
      const n = (2 * Math.PI) / period;
      s.M += n * h;
      const { th, thetaDot, r } = orbitState(s.M, s.ecc);
      s.theta = th;
      // Torque ∝ sin(2·lag angle) ∝ sin(2(θ − φ)), scaled by 1/r⁶ (tidal torque falls off fast)
      // and damped so that φ relaxes toward whichever resonance thetaDot spends most time near.
      const lag = s.theta - s.phi;
      const torque = (s.k / r ** 6) * Math.sin(2 * lag);
      s.spinRate += torque * h;
      s.phi += s.spinRate * h;
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const scale = Math.min(W, H) / 2.6;
      const b = a * Math.sqrt(1 - s.ecc * s.ecc), c = a * s.ecc;

      ctx.strokeStyle = pal.faint; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.ellipse(cx - c * scale, cy, a * scale, b * scale, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
      g.addColorStop(0, '#fff6dd'); g.addColorStop(0.3, '#f0b35a'); g.addColorStop(1, 'rgba(240,179,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();

      const { r, th } = orbitState(s.M, s.ecc);
      const bx = cx + r * Math.cos(th) * scale, by = cy - r * Math.sin(th) * scale;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(-s.phi);
      ctx.fillStyle = pal.series[1];
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = pal.bg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(15, 0); ctx.stroke();
      ctx.restore();

      const ratio = s.spinRate; // in units of mean motion
      readout1.set(`Spin / mean motion ≈ ${fmt(ratio, 3)}   (1:1 pancake, Mercury's real lock is 3:2 at e ≈ 0.206)`);
      readout2.set(`Eccentricity e = ${fmt(s.ecc, 3)} — try e ≳ 0.2 and start the spin near 3:2`);
    }

    const loop = new Loop(step, render, 1 / 240);
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.slider('Eccentricity', { min: 0, max: 0.6, value: s.ecc, step: 0.01 }, (v) => (s.ecc = v));
    panel.slider('Initial spin (× mean motion)', { min: 0.5, max: 4, value: s.spinRate, step: 0.05 }, (v) => (s.spinRate = v));
    panel.button('Reset', () => { s.M = 0; s.phi = 0; loop.invalidate(); });
    const readout1 = panel.readout('');
    const readout2 = panel.readout('');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
