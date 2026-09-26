// Chapter 8: gravitational focusing and runaway growth.
// Left: planetesimals approach an embryo (radius R, units GM = R = 1) on hyperbolic paths;
// the capture cross-section is π b_c² with b_c = R √(1 + v_esc²/v²).
// Right: two embryos grow by sweeping up planetesimals with the focused cross-section;
// when focusing dominates, dM/dt ∝ M^{4/3} and the bigger one runs away.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const NLINES = 29;

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));';
    host.append(wrap);
    const left = createStage(wrap, { aspect: 1.1 });
    const right = createStage(wrap, { aspect: 1.1 });
    const ctx = left.canvas.getContext('2d')!;
    const plot = new Plot(right.canvas, {
      x: { min: 0, max: 1, label: 'time (initial growth times)' },
      y: { min: 1, max: 1000, log: true, label: 'mass (initial units)' },
      title: 'Two embryos, same swarm',
    });

    let u = 0.3; // v∞ / v_esc
    let paths: { xs: Float32Array; ys: Float32Array; n: number; hit: boolean }[] = [];
    let extent = 4, tAnim = 0;

    function trace() {
      const vinf = u * Math.SQRT2;
      const bc = Math.sqrt(1 + 2 / (vinf * vinf));
      extent = Math.max(3, 1.35 * bc);
      const x0 = -extent * 1.15;
      paths = [];
      for (let k = 0; k < NLINES; k++) {
        const b = -extent + (2 * extent * (k + 0.5)) / NLINES;
        let x = x0, y = b;
        let r = Math.hypot(x, y);
        let vx = Math.sqrt(vinf * vinf + 2 / r), vy = 0;
        const xs = new Float32Array(3000), ys = new Float32Array(3000);
        let n = 0, hit = false;
        for (let s = 0; s < 60000 && n < 3000; s++) {
          r = Math.hypot(x, y);
          if (r < 1) { hit = true; break; }
          if (x > extent * 1.2 || Math.abs(y) > extent * 1.3 || (x < x0 - 0.01)) break;
          const h = 0.004 * Math.max(0.2, Math.min(r, 4)) ** 1.5 / Math.max(vinf, 0.2);
          let ir3 = 1 / (r * r * r);
          vx -= 0.5 * h * x * ir3; vy -= 0.5 * h * y * ir3;
          x += h * vx; y += h * vy;
          r = Math.hypot(x, y); ir3 = 1 / (r * r * r);
          vx -= 0.5 * h * x * ir3; vy -= 0.5 * h * y * ir3;
          if (s % 6 === 0) { xs[n] = x; ys[n] = y; n++; }
        }
        paths.push({ xs, ys, n, hit });
      }
      growth();
    }

    // Growth: dM/dt = M^{2/3} (1 + Θ₀ M^{2/3}),  Θ₀ = (v_esc/v)² for the M = 1 body.
    let g1: number[] = [], g2: number[] = [], ts: number[] = [];
    function growth() {
      const th0 = 1 / (u * u);
      let m1 = 1, m2 = 1.5, t = 0;
      g1 = [m1]; g2 = [m2]; ts = [0];
      const rate = (m: number) => m ** (2 / 3) * (1 + th0 * m ** (2 / 3)) / (1 + th0);
      while (m2 < 1000 && m1 < 1000 && t < 1e4) {
        const h = 0.002 * m2 / rate(m2);
        m1 += h * rate(m1); m2 += h * rate(m2); t += h;
        g1.push(m1); g2.push(m2); ts.push(t);
      }
      plot.o.x.max = t;
      rRatio.set(`${fmt(g2[g2.length - 1] / g1[g1.length - 1], 3)} (started at 1.5)`);
      rFocus.set(`${fmt(1 + 2 / (2 * u * u), 3)}×`);
    }

    const loop = new Loop(null, render);
    left.onResize(() => loop.invalidate());
    right.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    function render(_a: number, dt: number) {
      tAnim = (tAnim + dt * 0.35) % 1;
      const { width: W, height: H, dpr } = left;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const sc = Math.min(W, H) / (2.6 * extent);
      const cx = W / 2, cy = H / 2;
      const vinf = u * Math.SQRT2, bc = Math.sqrt(1 + 2 / (vinf * vinf));
      // capture cross-section
      ctx.strokeStyle = pal.accent; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, bc * sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = pal.accent; ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText('focused cross-section', cx + bc * sc * 0.72 + 4, cy - bc * sc * 0.72);
      // paths
      for (const p of paths) {
        ctx.strokeStyle = p.hit ? pal.series[0] : pal.faint;
        ctx.globalAlpha = p.hit ? 0.9 : 0.6; ctx.lineWidth = p.hit ? 1.4 : 1;
        ctx.beginPath();
        for (let i = 0; i < p.n; i++) { const X = cx + p.xs[i] * sc, Y = cy - p.ys[i] * sc; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.stroke();
        if (p.n) {
          const i = Math.min(p.n - 1, Math.floor(tAnim * p.n));
          ctx.globalAlpha = 1; ctx.fillStyle = p.hit ? pal.series[0] : pal.muted;
          ctx.beginPath(); ctx.arc(cx + p.xs[i] * sc, cy - p.ys[i] * sc, 2.2, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // embryo
      ctx.fillStyle = pal.series[1];
      ctx.beginPath(); ctx.arc(cx, cy, sc, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.fg;
      ctx.fillText('embryo (radius R)', cx - sc, cy + sc + 14);
      ctx.fillStyle = pal.muted;
      ctx.fillText(`v∞ = ${fmt(u, 2)} v_esc   b_c = ${fmt(bc, 3)} R`, 10, H - 10);

      plot.draw(() => {
        plot.line(ts, g1, { color: pal.series[1] });
        plot.line(ts, g2, { color: pal.series[0] });
        plot.line(ts, g2.map((m, i) => m / g1[i]), { color: pal.muted, dash: [4, 3] });
        plot.text('M₂', plot.px(ts[ts.length - 1]) - 22, plot.py(g2[g2.length - 1]) + 14, { color: pal.series[0] });
        plot.text('M₁', plot.px(ts[ts.length - 1]) - 22, plot.py(Math.max(1.2, g1[g1.length - 1])) - 6, { color: pal.series[1] });
        plot.text('M₂ / M₁', plot.m.l + 8, plot.py(g2[g2.length - 1] / g1[g1.length - 1]) - 6, { color: pal.muted });
      });
    }

    const panel = new Panel(host);
    panel.slider('Approach speed v∞/v_esc', { min: 0.05, max: 3, value: u, log: true }, (v) => { u = v; trace(); loop.invalidate(); });
    const rFocus = panel.readout('focusing factor 1 + v_esc²/v²');
    const rRatio = panel.readout('final M₂/M₁');
    trace();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
