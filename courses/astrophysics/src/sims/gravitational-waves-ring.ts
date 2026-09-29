// Chapter 20: a ring of free test masses in the TT gauge, deformed by a wave travelling along z
// (out of the screen). Proper displacements: δx = ½(h₊ x + h× y), δy = ½(h× x − h₊ y).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

type Mode = 'plus' | 'cross' | 'linear' | 'circular';
const N = 24;

export default defineSim({
  mount({ host, params, onDestroy }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 1.6 });
    const ctx = stage.canvas.getContext('2d')!;
    let mode: Mode = (params.mode as Mode) ?? 'plus';
    let psi = 0; // polarisation angle (rad)
    let amp = 0.35; // hugely exaggerated: real h ~ 1e-21
    let ph = 0;
    const trail = new Float32Array(2 * 120);
    let tn = 0;

    const strains = (): [number, number] => {
      const c = Math.cos(ph), s = Math.sin(ph);
      switch (mode) {
        case 'plus': return [amp * c, 0];
        case 'cross': return [0, amp * c];
        case 'linear': return [amp * c * Math.cos(2 * psi), amp * c * Math.sin(2 * psi)];
        case 'circular': return [amp * c, amp * s];
      }
    };

    const loop = new Loop((dt) => { ph += 2 * Math.PI * 0.5 * dt; }, render, 1 / 60);
    onDestroy(onThemeChange(() => { pal = palette(); loop.invalidate(); }));

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const R = Math.min(W, H) * 0.3;
      const cx = W * 0.4, cy = H / 2;
      const [hp, hx] = strains();
      // undisturbed ring
      ctx.strokeStyle = pal.faint; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
      // axes of the polarisation (principal stretch directions)
      const ang = 0.5 * Math.atan2(hx, hp);
      ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
      for (const a of [ang, ang + Math.PI / 2]) {
        ctx.beginPath(); ctx.moveTo(cx - 1.5 * R * Math.cos(a), cy + 1.5 * R * Math.sin(a)); ctx.lineTo(cx + 1.5 * R * Math.cos(a), cy + 1.5 * R * Math.sin(a)); ctx.stroke();
      }
      // deformed ring outline
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k <= 96; k++) {
        const th = (2 * Math.PI * k) / 96, x = Math.cos(th), y = Math.sin(th);
        const X = x + 0.5 * (hp * x + hx * y), Y = y + 0.5 * (hx * x - hp * y);
        k ? ctx.lineTo(cx + R * X, cy - R * Y) : ctx.moveTo(cx + R * X, cy - R * Y);
      }
      ctx.stroke();
      // particles
      for (let k = 0; k < N; k++) {
        const th = (2 * Math.PI * k) / N, x = Math.cos(th), y = Math.sin(th);
        const X = x + 0.5 * (hp * x + hx * y), Y = y + 0.5 * (hx * x - hp * y);
        ctx.fillStyle = k === 0 ? pal.accent2 : pal.fg;
        ctx.beginPath(); ctx.arc(cx + R * X, cy - R * Y, k === 0 ? 5 : 3.5, 0, 2 * Math.PI); ctx.fill();
        if (k === 0) { trail[2 * (tn % 120)] = cx + R * X; trail[2 * (tn % 120) + 1] = cy - R * Y; tn++; }
      }
      ctx.strokeStyle = pal.accent2; ctx.globalAlpha = 0.5; ctx.beginPath();
      for (let k = 0; k < Math.min(tn, 120); k++) { const j = (tn - 1 - k + 120) % 120; k ? ctx.lineTo(trail[2 * j], trail[2 * j + 1]) : ctx.moveTo(trail[2 * j], trail[2 * j + 1]); }
      ctx.stroke(); ctx.globalAlpha = 1;
      // centre + label
      ctx.fillStyle = pal.muted; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, 2 * Math.PI); ctx.fill();
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText('wave travels out of the screen (⊙ z)', cx, H - 12);
      // side meter: h+ and h× bars
      const bx = W * 0.8, bh = H * 0.32;
      ctx.textAlign = 'center';
      [['h₊', hp, pal.accent], ['h×', hx, pal.series[1]]].forEach(([lab, v, col], i) => {
        const x = bx + i * 44;
        ctx.strokeStyle = pal.axis; ctx.beginPath(); ctx.moveTo(x - 10, cy); ctx.lineTo(x + 10, cy); ctx.stroke();
        ctx.fillStyle = col as string;
        const hgt = ((v as number) / 0.6) * bh;
        ctx.fillRect(x - 7, cy - Math.max(hgt, 0), 14, Math.abs(hgt));
        ctx.fillStyle = pal.fg; ctx.fillText(lab as string, x, cy + bh + 18);
      });
      ctx.fillStyle = pal.muted; ctx.fillText('strain (×10²⁰ exaggeration)', bx + 22, cy - bh - 10);
    }

    stage.onResize(() => loop.invalidate());
    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    const sel = panel.select<Mode>('Polarisation', [
      { value: 'plus', label: '+ (plus)' }, { value: 'cross', label: '× (cross)' },
      { value: 'linear', label: 'linear at angle ψ' }, { value: 'circular', label: 'circular' },
    ], mode, (v) => { mode = v; tn = 0; loop.invalidate(); });
    panel.slider('ψ', { min: 0, max: 90, value: 0, step: 1, unit: '°', format: (v) => String(Math.round(v)) }, (v) => { psi = (v * Math.PI) / 180; if (mode !== 'linear') { mode = 'linear'; sel.set('linear'); } tn = 0; loop.invalidate(); });
    panel.slider('Amplitude', { min: 0.05, max: 0.6, value: amp, step: 0.01 }, (v) => { amp = v; loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
