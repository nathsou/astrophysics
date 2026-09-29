// Appendix A6: a thrown ball with a live energy bar chart. Kinetic energy, potential energy and
// (optionally) heat dissipated by quadratic air drag; their sum is the conserved total.
// Units: SI. The ball is a 0.43 kg football; the drag coefficient k = ρ C_d A / 2m ≈ 0.013 m⁻¹.
// Integrated with RK4 at a fixed 1/240 s step (the loop's timeScale compresses long flights).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

const MASS = 0.43; // kg
const K_DRAG = 0.013; // m⁻¹ (quadratic drag, a = −k |v| v)

type World = 'earth' | 'mars' | 'moon';
const GRAV: Record<World, number> = { earth: 9.81, mars: 3.71, moon: 1.62 };

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    stage.canvas.style.touchAction = 'none';

    let v0 = 20, angle = 50, drag = false, world: World = 'earth';
    const s = new Float64Array(4); // x, y, vx, vy
    let heat = 0, E0 = 0, flying = false, idle = 0, t = 0;
    const trailX: number[] = [], trailY: number[] = [];

    const g = () => GRAV[world];
    const ke = () => 0.5 * MASS * (s[2] * s[2] + s[3] * s[3]);
    const pe = () => MASS * g() * s[1];

    function launch() {
      const a = (angle * Math.PI) / 180;
      s.set([0, 0, v0 * Math.cos(a), v0 * Math.sin(a)]);
      heat = 0; t = 0; E0 = ke(); flying = true; idle = 0;
      trailX.length = 0; trailY.length = 0;
      // Compress long flights (the Moon) so each throw lasts about three real seconds.
      const T = (2 * v0 * Math.sin(a)) / g();
      loop.timeScale = Math.max(1, T / 3);
    }

    function deriv(x: Float64Array, out: Float64Array) {
      const sp = Math.hypot(x[2], x[3]);
      const kd = drag ? K_DRAG * sp : 0;
      out[0] = x[2]; out[1] = x[3];
      out[2] = -kd * x[2]; out[3] = -g() - kd * x[3];
    }
    const k1 = new Float64Array(4), k2 = new Float64Array(4), k3 = new Float64Array(4), k4 = new Float64Array(4), tmp = new Float64Array(4);

    function step(h: number) {
      if (!flying) return;
      const prev = [s[0], s[1], s[2], s[3]];
      const eBefore = ke() + pe();
      deriv(s, k1);
      for (let i = 0; i < 4; i++) tmp[i] = s[i] + 0.5 * h * k1[i];
      deriv(tmp, k2);
      for (let i = 0; i < 4; i++) tmp[i] = s[i] + 0.5 * h * k2[i];
      deriv(tmp, k3);
      for (let i = 0; i < 4; i++) tmp[i] = s[i] + h * k3[i];
      deriv(tmp, k4);
      for (let i = 0; i < 4; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      t += h;
      // Heat = mechanical energy lost to drag (exactly zero without drag, up to RK4 round-off).
      if (drag) heat += Math.max(0, eBefore - (ke() + pe()));
      if (s[1] < 0) {
        // land: interpolate back to y = 0 so the bars end exactly on the ground
        const f = prev[1] / (prev[1] - s[1]);
        for (let i = 0; i < 4; i++) s[i] = prev[i] + f * (s[i] - prev[i]);
        s[1] = 0;
        flying = false;
      }
      if (trailX.length === 0 || Math.hypot(s[0] - trailX[trailX.length - 1], s[1] - trailY[trailY.length - 1]) > 0.004 * v0 * v0 / g()) {
        trailX.push(s[0]); trailY.push(s[1]);
      }
    }

    // world → screen mapping, refit to the drag-free range of the current throw
    let sc = 1, ox = 0, oy = 0, barX = 0;
    function fit() {
      const { width: W, height: H } = stage;
      const a = (angle * Math.PI) / 180;
      const R = Math.max((v0 * v0 * Math.sin(2 * a)) / g(), 1);
      const Hmax = Math.max((v0 * v0 * Math.sin(a) ** 2) / (2 * g()), 1);
      const Rv = (v0 * v0) / g(); // max range at 45°, keeps the scale steady while aiming
      barX = W * 0.7;
      const plotW = barX - 60, plotH = H - 70;
      sc = Math.min(plotW / Math.max(R, Rv * 0.6), plotH / Math.max(Hmax, Rv * 0.25));
      ox = 36; oy = H - 36;
    }
    const X = (x: number) => ox + x * sc;
    const Y = (y: number) => oy - y * sc;

    function arrow(x0: number, y0: number, x1: number, y1: number, col: string) {
      const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 2) return;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - 8 * Math.cos(a - 0.4), y1 - 8 * Math.sin(a - 0.4));
      ctx.lineTo(x1 - 8 * Math.cos(a + 0.4), y1 - 8 * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
    }

    function render(_alpha: number, frameDt: number) {
      if (!flying) {
        idle += frameDt;
        if (idle > 1.4 && !loop.paused) launch();
      }
      fit();
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';

      // ground
      ctx.strokeStyle = pal.axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(10, oy); ctx.lineTo(barX - 20, oy); ctx.stroke();

      // drag-free parabola for comparison
      const a = (angle * Math.PI) / 180, vx = v0 * Math.cos(a), vy = v0 * Math.sin(a);
      const T = (2 * vy) / g();
      ctx.strokeStyle = pal.faint; ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const tt = (T * i) / 80;
        const px = X(vx * tt), py = Y(vy * tt - 0.5 * g() * tt * tt);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke(); ctx.setLineDash([]);

      // trail
      ctx.strokeStyle = pal.series[0]; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < trailX.length; i++) i ? ctx.lineTo(X(trailX[i]), Y(trailY[i])) : ctx.moveTo(X(trailX[i]), Y(trailY[i]));
      ctx.lineTo(X(s[0]), Y(s[1]));
      ctx.stroke(); ctx.globalAlpha = 1;

      // ball + velocity arrow
      const bx = X(s[0]), by = Y(s[1]);
      if (flying) arrow(bx, by, bx + s[2] * 2.2, by - s[3] * 2.2, pal.accent);
      ctx.fillStyle = pal.fg;
      ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.muted;
      ctx.fillText(`x = ${fmt(s[0], 3)} m   y = ${fmt(s[1], 3)} m   t = ${fmt(t, 3)} s`, 14, 20);
      if (!flying) ctx.fillText('Drag on the field to aim', 14, 38);

      // energy bars
      const K = ke(), U = pe(), Q = heat;
      const bars = [
        { label: 'KE', v: K, col: pal.series[0] },
        { label: 'PE', v: U, col: pal.series[1] },
        { label: 'heat', v: Q, col: pal.series[2] },
      ];
      const top = 40, bot = H - 36, bh = bot - top;
      const bw = Math.min(34, (W - barX - 30) / 4.6);
      const unit = bh / Math.max(E0, 1e-9);
      ctx.strokeStyle = pal.axis;
      ctx.beginPath(); ctx.moveTo(barX - 6, bot); ctx.lineTo(W - 10, bot); ctx.stroke();
      bars.forEach((b, i) => {
        const x = barX + i * bw * 1.25;
        ctx.fillStyle = b.col;
        ctx.fillRect(x, bot - b.v * unit, bw, b.v * unit);
        ctx.fillStyle = pal.muted; ctx.textAlign = 'center';
        ctx.fillText(b.label, x + bw / 2, bot + 16);
      });
      // stacked total
      const xt = barX + 3 * bw * 1.25 + 4;
      let yy = bot;
      bars.forEach((b) => { ctx.fillStyle = b.col; ctx.fillRect(xt, yy - b.v * unit, bw, b.v * unit); yy -= b.v * unit; });
      ctx.strokeStyle = pal.fg; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(barX - 6, bot - E0 * unit); ctx.lineTo(W - 10, bot - E0 * unit); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pal.muted; ctx.fillText('sum', xt + bw / 2, bot + 16);
      ctx.textAlign = 'left';
      ctx.fillStyle = pal.fg;
      ctx.fillText(`E₀ = ${fmt(E0, 3)} J`, barX - 4, top - 14);
      ctx.textAlign = 'left';

      rK.set(`${fmt(K, 3)} J`); rU.set(`${fmt(U, 3)} J`); rQ.set(`${fmt(Q, 3)} J`);
      rE.set(`${fmt(K + U + Q, 5)} J`);
    }

    const loop = new Loop(step, render, 1 / 240);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize(() => loop.invalidate());

    // aim by dragging on the field
    let aiming = false;
    const aim = (e: PointerEvent) => {
      const r = stage.canvas.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      if (px > barX - 10) return;
      const dx = Math.max(1, px - ox), dy = Math.max(1, oy - py);
      angle = Math.min(85, Math.max(5, (Math.atan2(dy, dx) * 180) / Math.PI));
      sAngle.set(Math.round(angle));
      launch();
    };
    stage.canvas.addEventListener('pointerdown', (e) => { aiming = true; stage.canvas.setPointerCapture(e.pointerId); aim(e); });
    stage.canvas.addEventListener('pointermove', (e) => { if (aiming) aim(e); });
    stage.canvas.addEventListener('pointerup', () => (aiming = false));

    const panel = new Panel(host);
    panel.select<World>('Gravity', [
      { value: 'earth', label: 'Earth (9.81 m/s²)' },
      { value: 'mars', label: 'Mars (3.71 m/s²)' },
      { value: 'moon', label: 'Moon (1.62 m/s²)' },
    ], world, (v) => { world = v; launch(); });
    panel.slider('Launch speed', { min: 5, max: 35, value: v0, step: 0.5, unit: 'm/s' }, (v) => { v0 = v; launch(); });
    const sAngle = panel.slider('Angle', { min: 5, max: 85, value: angle, step: 1, unit: '°' }, (v) => { angle = v; launch(); });
    panel.toggle('Air drag', drag, (v) => { drag = v; launch(); });
    const rK = panel.readout('KE');
    const rU = panel.readout('PE');
    const rQ = panel.readout('Heat');
    const rE = panel.readout('Sum');

    launch();
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
