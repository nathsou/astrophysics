// Secondary figure: negative heat capacity.
// The virial theorem for a self-gravitating ball says 2K + U = 0, so the total energy E = K + U = -K.
// If the ball radiates energy away, E decreases (becomes more negative) — and since E = -K, the
// kinetic energy K, and hence the temperature, *increases*. Losing energy makes a star hotter.
// We integrate dE/dt = -L (a chosen "luminosity") analytically each frame: R ∝ 1/(-E), K = -E, T ∝ K.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot, Series } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

export default defineSim({
  mount({ host, onDestroy }) {
    host.style.display = 'flex';
    host.style.flexWrap = 'wrap';
    host.style.gap = '12px';
    const ballWrap = document.createElement('div');
    ballWrap.style.flex = '1 1 200px';
    ballWrap.style.maxWidth = '260px';
    const plotWrap = document.createElement('div');
    plotWrap.style.flex = '2 1 380px';
    host.append(ballWrap, plotWrap);

    const ballStage = createStage(ballWrap, { aspect: 1 });
    const plotStage = createStage(plotWrap, { aspect: 16 / 10 });
    const ballCtx = ballStage.canvas.getContext('2d')!;

    const plot = new Plot(plotStage.canvas, { x: { min: 0, max: 40, label: 't (arbitrary units)' }, y: { min: 0, max: 4, label: 'relative to start' } });
    plotStage.onResize((w, h, dpr) => plot.resize(w, h, dpr));

    let pal = palette();
    onThemeChange(() => { pal = palette(); });

    const E0 = -1; // initial total energy (units where K0 = 1, U0 = -2)
    let E = E0;
    let L = 0.015; // "luminosity": rate of energy loss, per unit time
    const seriesT = new Series(2000), seriesR = new Series(2000), seriesK = new Series(2000);

    function reset() { E = E0; seriesT.clear(); seriesR.clear(); seriesK.clear(); loop.simTime = 0; }

    const loop = new Loop((dt) => {
      E -= L * dt;
      if (-E > 40) reset(); // ball has collapsed to near-zero radius; start over
      const K = -E;
      const R = E0 / E; // R0 = 1
      seriesT.push(loop.simTime, K); // T/T0 = K/K0 = K
      seriesR.push(loop.simTime, R);
      seriesK.push(loop.simTime, K);
    }, render, 1 / 60);
    ballStage.onResize(() => loop.invalidate());

    function render() {
      const K = -E, R = E0 / E, U = -2 * K, T = K; // all in units of the initial value
      // ball
      const w = ballStage.width, h = ballStage.height, dpr = ballStage.dpr;
      ballCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ballCtx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h * 0.4;
      const rad = Math.min(w, h * 0.7) * 0.32 * Math.min(R, 1.6);
      const Tkelvin = 3000 * T;
      const grad = ballCtx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grad.addColorStop(0, blackbodyCSS(Tkelvin));
      grad.addColorStop(1, blackbodyCSS(Tkelvin, 0.55));
      ballCtx.beginPath(); ballCtx.arc(cx, cy, Math.max(rad, 2), 0, Math.PI * 2); ballCtx.fillStyle = grad; ballCtx.fill();
      // K / |U| bars
      const barY = h * 0.82, barH = 14, maxBar = w * 0.38, x0 = w * 0.08;
      ballCtx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ballCtx.fillStyle = pal.series[0];
      const kw = Math.min(maxBar, (K / 5) * maxBar);
      ballCtx.fillRect(x0, barY, kw, barH);
      ballCtx.fillStyle = pal.fg; ballCtx.textAlign = 'left'; ballCtx.textBaseline = 'middle';
      ballCtx.fillText(`K = ${fmt(K, 3)}`, x0 + kw + 6, barY + barH / 2);
      ballCtx.fillStyle = pal.series[3];
      const uw = Math.min(maxBar, (Math.abs(U) / 5) * maxBar);
      ballCtx.fillRect(x0, barY + barH + 8, uw, barH);
      ballCtx.fillText(`|U| = ${fmt(Math.abs(U), 3)}`, x0 + uw + 6, barY + barH + 8 + barH / 2);
      ballCtx.fillStyle = pal.muted;
      ballCtx.fillText(`R = ${fmt(R, 3)} R₀  ·  T = ${fmt(T, 3)} T₀`, x0, barY - 10);

      // time-series plot
      const [tx, ty] = seriesT.linear();
      const [, ry] = seriesR.linear();
      plot.o.x.max = Math.max(20, loop.simTime);
      plot.draw(() => {
        plot.line(tx, ty, { color: pal.series[0] });
        plot.line(tx, ry, { color: pal.series[2] });
        plot.text('K, T (heating up)', plot.m.l + 8, plot.m.t + 14, { color: pal.series[0], size: 10 });
        plot.text('R (shrinking)', plot.m.l + 8, plot.m.t + 28, { color: pal.series[2], size: 10 });
      });
    }

    const panel = new Panel(host);
    panel.slider('Energy loss rate L', { min: 0.002, max: 0.06, value: L, log: true }, (v) => { L = v; });
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset', reset);
    panel.el.style.flex = '1 1 100%'; // full-width control row under the ball and the plot

    onDestroy(() => loop.destroy());
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
