// Secondary figure: the Schwarzschild criterion via the "rising blob" argument.
// A blob of gas is nudged upward, expands adiabatically (∇_ad = 0.4) and is compared to the
// ambient temperature profile (∇_rad, set by the slider). If the blob stays hotter (and hence
// less dense) than its surroundings at every height, buoyancy keeps pushing it up: unstable
// (convective). If the environment cools faster than the blob, the blob sinks back: stable.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

export default defineSim({
  mount({ host, onDestroy }) {
    const stage = createStage(host, { aspect: 16 / 9, maxDpr: 2 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0, max: 1, label: 'height (arbitrary units, 0 = deep interior)' },
      y: { min: 0.4, max: 1.02, label: 'T / T₀' },
      title: 'Rising blob vs. surroundings',
    });
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const s = { gradRad: 0.6, z0: 0.3, running: true, zb: 0.3, vb: 0.15, t: 0 };
    const gradAd = 0.4;

    const Tenv = (z: number) => Math.max(0.05, 1 - s.gradRad * z);
    const Tblob = (z: number, z0: number) => Math.max(0.05, 1 - gradAd * z - (1 - gradAd * z0 - Tenv(z0)));

    function render() {
      plot.draw(() => {
        plot.fn(Tenv, { color: pal.series[0], width: 2.25 });
        const z0 = s.z0;
        plot.fn((z) => Tblob(z, z0), { color: pal.series[2], width: 2.25, dash: [5, 4] });
        plot.point(z0, Tenv(z0), { color: pal.muted, r: 4 });
        // the blob itself, moved by its own buoyancy (see step)
        const unstable = s.gradRad > gradAd;
        plot.point(s.zb, Tblob(s.zb, z0), { color: unstable ? pal.bad : pal.good, r: 6 });
        plot.text(unstable ? 'blob stays hotter → buoyant → convection' : 'blob cools below ambient → sinks back → stable',
          plot.m.l + 8, plot.m.t + 16, { color: unstable ? pal.bad : pal.good });
      });
    }

    // Buoyancy: acceleration ∝ the blob's temperature excess over its surroundings (hotter means
    // less dense at equal pressure). Released with a small upward nudge, a blob in a stable layer
    // oscillates about its start (a buoyancy wave); in an unstable one it runs away upward.
    function restart() { s.zb = s.z0; s.vb = 0.15; s.t = 0; }
    function step(h: number) {
      if (!s.running) return;
      const a = 12 * (Tblob(s.zb, s.z0) - Tenv(s.zb)) / Tenv(s.zb);
      s.vb += a * h;
      s.zb += s.vb * h;
      s.t += h;
      if (s.zb > 0.99 || s.zb < 0.01 || s.t > 6) restart();
    }

    const panel = new Panel(host);
    panel.slider('|dT/dr|_rad (environment)', { min: 0.05, max: 1.0, value: s.gradRad, step: 0.01 }, (v) => { s.gradRad = v; restart(); });
    panel.readout('|dT/dr|_ad (adiabatic, fixed)').set('0.400');
    panel.slider('Starting height z₀', { min: 0.05, max: 0.6, value: s.z0, step: 0.01 }, (v) => { s.z0 = v; restart(); });
    panel.playPause(() => !s.running, (p) => (s.running = !p));
    const rCrit = panel.readout('Criterion');

    const loop = new Loop(step, () => { render(); rCrit.set(s.gradRad > gradAd ? `∇_rad (${fmt(s.gradRad, 2)}) > ∇_ad (0.40) → convective` : s.gradRad < gradAd ? `∇_rad (${fmt(s.gradRad, 2)}) < ∇_ad (0.40) → radiative` : '∇_rad = ∇_ad → marginal (neutral)'); }, 1 / 60);
    stage.onResize((w, h2, dpr) => { plot.resize(w, h2, dpr); loop.invalidate(); });
    onDestroy(() => {});
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
