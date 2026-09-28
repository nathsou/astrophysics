// Appendix A7: random walks and diffusion. Many walkers start at the origin and take unit steps in
// random directions. One is highlighted with its full path. The cloud's rms radius grows as
// ℓ√N, not ℓN: measured values are plotted on log–log axes against both laws.
// Walker positions live in Float64Arrays; a frame advances all walkers by k steps (O(k·W)).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot, Series } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const MAXSTEPS = 20000;

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));';
    host.append(wrap);
    const cloud = createStage(wrap, { aspect: 1 });
    const plotStage = createStage(wrap, { aspect: 1 });
    const ctx = cloud.canvas.getContext('2d')!;
    const plot = new Plot(plotStage.canvas, {
      x: { min: 1, max: MAXSTEPS, log: true, label: 'number of steps N' },
      y: { min: 0.5, max: MAXSTEPS, log: true, label: 'distance from start (steps ℓ)' },
      title: 'How far do you get?',
    });

    let nW = 2000, speed = 8, steps = 0, nextSample = 1;
    const x = new Float64Array(5000), y = new Float64Array(5000);
    const path = new Float32Array(2 * (MAXSTEPS + 1));
    const rms = new Series(400), one = new Series(400);
    let view = 10; // half-width of view in step lengths, eased

    function reset() {
      x.fill(0); y.fill(0); steps = 0; nextSample = 1; rms.clear(); one.clear(); view = 10;
      path[0] = 0; path[1] = 0;
    }

    function advance() {
      if (steps >= MAXSTEPS) return;
      for (let i = 0; i < nW; i++) {
        const a = Math.random() * 2 * Math.PI;
        x[i] += Math.cos(a); y[i] += Math.sin(a);
      }
      steps++;
      path[2 * steps] = x[0]; path[2 * steps + 1] = y[0];
      if (steps >= nextSample) {
        rms.push(steps, rmsR());
        one.push(steps, Math.max(0.5, Math.hypot(x[0], y[0])));
        nextSample = Math.max(steps + 1, Math.ceil(steps * 1.08));
      }
    }

    function rmsR() {
      let s = 0;
      for (let i = 0; i < nW; i++) s += x[i] * x[i] + y[i] * y[i];
      return Math.sqrt(s / nW);
    }

    function step() {
      // cap the work at ~2×10⁵ walker-steps per frame
      const k = Math.min(Math.round(speed), Math.max(1, Math.floor(2e5 / nW)));
      for (let j = 0; j < k; j++) advance();
    }

    function render() {
      const { width: W, height: H, dpr } = cloud;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const R = rmsR();
      view += (Math.max(10, 2.6 * R) - view) * 0.08;
      const sc = Math.min(W, H) / 2 / view;
      const cx = W / 2, cy = H / 2;

      // walkers
      ctx.fillStyle = pal.series[0]; ctx.globalAlpha = 0.45;
      for (let i = 1; i < nW; i++) ctx.fillRect(cx + x[i] * sc - 1, cy - y[i] * sc - 1, 2, 2);
      ctx.globalAlpha = 1;

      // highlighted walker's path
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      const stride = Math.max(1, Math.floor(steps / 4000));
      for (let k = 0; k <= steps; k += stride) {
        const X = cx + path[2 * k] * sc, Y = cy - path[2 * k + 1] * sc;
        k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.lineTo(cx + x[0] * sc, cy - y[0] * sc);
      ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = pal.accent;
      ctx.beginPath(); ctx.arc(cx + x[0] * sc, cy - y[0] * sc, 4, 0, Math.PI * 2); ctx.fill();

      // rms circle and the straight-line distance N ℓ (usually far off-screen)
      ctx.strokeStyle = pal.accent2; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(cx, cy, R * sc, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pal.fg; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      ctx.fillStyle = pal.accent2;
      ctx.fillText('rms radius', cx + R * sc * 0.72 + 6, cy - R * sc * 0.72);
      ctx.fillStyle = pal.muted;
      ctx.fillText(`N = ${steps.toLocaleString('en-US')} steps`, 12, 20);
      if (steps > 0) ctx.fillText(`a straight line would be ${fmt(steps / R, 3)}× farther`, 12, H - 12);
      // scale bar: 10 steps
      const bar = 10 ** Math.floor(Math.log10(view));
      ctx.strokeStyle = pal.muted; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W - 14 - bar * sc, 20); ctx.lineTo(W - 14, 20); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(`${bar} ℓ`, W - 14, 36); ctx.textAlign = 'left';

      plot.draw(() => {
        plot.fn((n) => n, { color: pal.faint, dash: [5, 4] });
        plot.fn((n) => Math.sqrt(n), { color: pal.accent2, dash: [5, 4] });
        const [ax, ay] = one.linear();
        plot.line(ax, ay, { color: pal.accent, width: 1.2, alpha: 0.8 });
        const [rx, ry] = rms.linear();
        plot.line(rx, ry, { color: pal.series[0], width: 2.5 });
        plot.text('straight line: N ℓ', plot.px(30), plot.py(30) - 10, { color: pal.muted });
        plot.text('√N ℓ', plot.px(2000), plot.py(Math.sqrt(2000)) + 16, { color: pal.accent2 });
      });
      rN.set(steps.toLocaleString('en-US'));
      rR.set(`${fmt(R, 3)} ℓ`);
      rS.set(`${fmt(Math.sqrt(steps), 3)} ℓ`);
    }

    const loop = new Loop(step, render, 1 / 60);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    cloud.onResize(() => loop.invalidate());
    plotStage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset', () => { reset(); loop.invalidate(); });
    panel.slider('Steps per frame', { min: 1, max: 200, value: speed, log: true, step: 1, format: (v) => String(Math.round(v)) }, (v) => (speed = v));
    panel.slider('Walkers', { min: 100, max: 5000, value: nW, log: true, step: 50, format: (v) => String(Math.round(v)) }, (v) => { nW = Math.round(v); reset(); loop.invalidate(); });
    const rN = panel.readout('N');
    const rR = panel.readout('rms');
    const rS = panel.readout('√N ℓ');

    reset();
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
