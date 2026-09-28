// Chapter 6 secondary figure: Sedov–Taylor blast wave. R(t) = ξ0 (E t² / ρ)^{1/5}, draggable
// E (SN energy) and ρ (ambient density / n). Left: shell expanding in physical space with a
// shaded "still coasting" vs "gone radiative" state. Right: log R vs log t with the 2/5 slope line.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { mp } from '../lib/physics/constants';

const XI0 = 1.15; // order-unity Sedov constant for a uniform ISM, adiabatic index 5/3
const PC = 3.0857e18; // cm
const YR = 3.156e7; // s

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:grid;grid-template-columns:${narrow ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1.15fr)'}`;
    host.append(wrap);
    const blastStage = createStage(wrap, { aspect: 1 });
    const plotStage = createStage(wrap, { aspect: 1 / 0.92 });
    blastStage.el.style[narrow ? 'borderBottom' : 'borderRight'] = '1px solid var(--rule)';
    const ctx = blastStage.canvas.getContext('2d')!;

    const plot = new Plot(plotStage.canvas, {
      x: { min: 10, max: 3e6, log: true, label: 't (yr)' },
      y: { min: 0.1, max: 300, log: true, label: 'R (pc)' },
      title: 'Blast radius vs time',
    });

    let logE51 = 0; // log10 of E in units of 1e51 erg
    let logN = 0; // log10 of ambient n in cm^-3
    let tMyr = 0.1; // current time on the curve (drag or slider)

    const R_of_t = (tSec: number, E: number, rho: number) => XI0 * (E * tSec * tSec / rho) ** (1 / 5); // cm

    function radiativeTime(n: number): number {
      // Very rough: the remnant becomes radiative once its cooling time drops below its age,
      // roughly t_cool ~ few×10^4 yr for n ~ 1 cm^-3 shocked gas; scales ~ n^{-0.55} (Cioffi 1988-ish).
      return 3e4 * n ** -0.55;
    }

    function render() {
      // cgs throughout: ρ = 1.4 n m_H in g cm⁻³ (the 1.4 accounts for helium; mp is in kg, hence 1e3)
      const E = 10 ** logE51 * 1e51, n = 10 ** logN, rho = 1.4 * n * mp * 1e3;
      const tRad = radiativeTime(n);
      // --- blast panel ---
      const { width: W, height: H, dpr } = blastStage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const Rmax_pc = R_of_t(Math.min(tMyr, 3) * 1e6 * YR, E, rho) / PC;
      const scale = Math.min(W, H) / (2.4 * Math.max(Rmax_pc, 5));
      // faded trail of earlier radii
      ctx.strokeStyle = pal.faint;
      for (let f = 0.2; f <= 1; f += 0.2) {
        const r = R_of_t(f * tMyr * 1e6 * YR, E, rho) / PC;
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(cx, cy, r * scale, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const R_pc = R_of_t(tMyr * 1e6 * YR, E, rho) / PC;
      const radiative = tMyr * 1e6 > tRad;
      ctx.strokeStyle = radiative ? pal.bad : pal.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, R_pc * scale, 0, Math.PI * 2); ctx.stroke();
      // hot interior glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R_pc * scale);
      g.addColorStop(0, 'rgba(255,140,60,0.35)');
      g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R_pc * scale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.fg;
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`R = ${fmt(R_pc, 3)} pc  at  t = ${fmt(tMyr, 3)} Myr`, 12, H - 32);
      ctx.fillStyle = radiative ? pal.bad : pal.muted;
      ctx.fillText(radiative ? 'radiative stage: shell has cooled, no longer adiabatic' : 'adiabatic Sedov–Taylor stage', 12, H - 14);

      // --- R(t) plot ---
      plot.draw(() => {
        const N = 200;
        const xs = new Float64Array(N), ys = new Float64Array(N);
        for (let i = 0; i < N; i++) {
          const t_yr = plot.o.x.min * (plot.o.x.max / plot.o.x.min) ** (i / (N - 1));
          xs[i] = t_yr; ys[i] = R_of_t(t_yr * YR, E, rho) / PC;
        }
        plot.line(xs, ys, { color: pal.series[0] });
        plot.vline(tRad, { color: pal.bad, label: 't_cool' });
        const Rnow = R_of_t(tMyr * 1e6 * YR, E, rho) / PC;
        plot.point(tMyr * 1e6, Rnow, { r: 5, color: pal.accent, stroke: pal.fg });
      });
    }

    const loop = new Loop(null, render, 1 / 30);
    blastStage.onResize(() => loop.invalidate());
    plotStage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    // drag on the R(t) plot to move the time marker
    plotStage.canvas.style.touchAction = 'none';
    let dragging = false;
    const setFromClientX = (clientX: number) => {
      const r = plotStage.canvas.getBoundingClientRect();
      const t_yr = Math.max(plot.o.x.min, Math.min(plot.o.x.max, plot.dx(clientX - r.left)));
      tMyr = t_yr / 1e6;
      loop.invalidate();
    };
    plotStage.canvas.addEventListener('pointerdown', (e) => { dragging = true; setFromClientX(e.clientX); });
    window.addEventListener('pointermove', (e) => { if (dragging) setFromClientX(e.clientX); });
    window.addEventListener('pointerup', () => { dragging = false; });

    const panel = new Panel(host);
    panel.slider('Explosion energy E', { min: -1, max: 1, value: logE51, step: 0.01, format: (v) => `${fmt(10 ** v, 2)}×10⁵¹ erg` }, (v) => { logE51 = v; loop.invalidate(); });
    panel.slider('Ambient density n', { min: -2, max: 2, value: logN, step: 0.01, format: (v) => `${fmt(10 ** v, 3)} cm⁻³` }, (v) => { logN = v; loop.invalidate(); });
    panel.slider('Time t', { min: Math.log10(10), max: Math.log10(3e6), value: Math.log10(tMyr * 1e6), step: 0.005, format: (v) => `${fmt(10 ** v / 1e6, 3)} Myr` }, (v) => { tMyr = 10 ** v / 1e6; loop.invalidate(); });

    loop.setVisible(true);
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
