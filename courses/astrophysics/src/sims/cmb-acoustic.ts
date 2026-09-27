// Chapter 27: acoustic oscillations of the photon–baryon fluid, mode by mode.
// Tight-coupling solution with a constant potential Ψ (units Ψ/3 = 1, adiabatic start):
//   Θ_eff(k, η) = (1+3R) cos(k r_s(η)) − 3R,   r_s(η) ≈ c_s η.
// Every mode starts at the same value; recombination (η = η*) freezes each at its current phase.
// Peaks of Θ_eff² occur at k r_s* = nπ; baryons (R) shift the zero point and make odd peaks taller.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const MODES = [0.5, 1, 1.5, 2, 3];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));';
    host.append(wrap);
    const s1 = createStage(wrap, { aspect: 1.3 });
    const s2 = createStage(wrap, { aspect: 1.3 });
    const left = new Plot(s1.canvas, { x: { min: 0, max: 1, label: 'time η / η*  (conformal)' }, y: { min: -5, max: 5, label: 'Θ + Ψ   (units of |Ψ|/3)' }, title: 'Five modes in a potential well' });
    const right = new Plot(s2.canvas, { x: { min: 0, max: 4, label: 'k r_s* / π   (∝ ℓ)' }, y: { min: 0, max: 20, label: '(Θ + Ψ)²' }, title: 'Power vs wavenumber' });

    let R = 0.6, damping = true, tau = 0, hold = 0;
    // (the damped form keeps the zero point at −3R and shrinks the oscillation around it)
    const thetaD = (kap: number, t: number) => {
      const d = damping ? Math.exp(-(((kap * t) / 3) ** 2)) : 1; // diffusion damping grows with k and time
      return (1 + 3 * R) * d * Math.cos(Math.PI * kap * t) - 3 * R;
    };

    const loop = new Loop((dt) => {
      if (tau < 1) tau = Math.min(1, tau + dt / 7);
      else if ((hold += dt) > 3) { tau = 0; hold = 0; }
    }, render, 1 / 60);

    function render() {
      left.draw(() => {
        left.hline(-3 * R, { label: `equilibrium −3R = ${fmt(-3 * R, 2)}` });
        left.hline(0, { color: pal.grid, dash: [] });
        MODES.forEach((kap, i) => {
          const n = 200, xs = new Float64Array(n + 1), ys = new Float64Array(n + 1);
          for (let j = 0; j <= n; j++) { xs[j] = (j / n) * tau; ys[j] = thetaD(kap, xs[j]); }
          left.line(xs, ys, { color: pal.series[i % 5], width: 1.6 });
          left.point(tau, thetaD(kap, tau), { color: pal.series[i % 5], r: 4 });
        });
        if (tau >= 1) left.vline(1, { label: 'recombination: frozen', color: pal.accent });
      });
      right.draw(() => {
        for (let n = 1; n <= 3; n++) right.vline(n, { label: n === 1 ? 'k r_s = π' : `${n}π`, color: pal.faint });
        right.fn((k) => thetaD(k, Math.max(tau, 1e-3)) ** 2, { color: pal.accent, width: 2 });
        MODES.forEach((kap, i) => right.point(kap, thetaD(kap, tau) ** 2, { color: pal.series[i % 5], r: 4.5 }));
        right.text(tau >= 1 ? 'odd peaks (compressions) taller when R > 0' : `η/η* = ${tau.toFixed(2)}`, right.m.l + 8, right.m.t + 14, { color: pal.muted });
      });
      rRatio.set(fmt(((1 + 6 * R) / 1) ** 2, 3));
    }

    s1.onResize((w, h, d) => { left.resize(w, h, d); loop.invalidate(); });
    s2.onResize((w, h, d) => { right.resize(w, h, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Restart', () => { tau = 0; hold = 0; loop.invalidate(); });
    panel.slider('Baryon loading R', { min: 0, max: 1.5, value: R, step: 0.01 }, (v) => { R = v; loop.invalidate(); });
    panel.toggle('Silk damping', damping, (v) => { damping = v; loop.invalidate(); });
    const rRatio = panel.readout('1st/2nd peak power (undamped) =');

    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
