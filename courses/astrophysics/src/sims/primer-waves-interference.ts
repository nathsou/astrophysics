// Appendix A8: a ripple tank. Two coherent point sources emit circular waves; the field is the
// sum of the two (superposition). "Waves" shows the instantaneous height, "Intensity" the
// time-averaged energy, and the strip on the right is the fringe pattern on a distant screen.
// Units: the tank is 40 cm wide; wave speed 20 cm/s (only sets the animation rate).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange, cssColor } from '../lib/ui/theme';

const TANK_W = 40; // cm
const SPEED = 20; // cm/s

export default defineSim({
  mount({ host }) {
    let pal = palette();
    let cBg = cssColor('--bg-sunk'), cPos = cssColor('--accent'), cNeg = cssColor('--accent-2');
    onThemeChange(() => {
      pal = palette();
      cBg = cssColor('--bg-sunk'); cPos = cssColor('--accent'); cNeg = cssColor('--accent-2');
      loop.invalidate();
    });

    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;

    // Low-resolution field buffer, upscaled with smoothing: 288 × 162 ≈ 47k cells.
    const GW = 288, GH = 162;
    const off = document.createElement('canvas');
    off.width = GW; off.height = GH;
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(GW, GH);
    const r1 = new Float32Array(GW * GH), r2 = new Float32Array(GW * GH);
    const cmPerCell = TANK_W / GW;
    const TANK_H = GH * cmPerCell;

    let lambda = 2.5; // cm
    let sep = 6; // cm
    let phase = 0; // radians, extra phase of source 2
    let view: 'waves' | 'intensity' = 'waves';
    let twoSources = true;
    let t = 0;

    const srcX = 5; // cm from left
    const src = () => [
      [srcX, TANK_H / 2 - sep / 2],
      [srcX, TANK_H / 2 + sep / 2],
    ];

    function geometry() {
      const [[x1, y1], [x2, y2]] = src();
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const x = (i + 0.5) * cmPerCell, y = (j + 0.5) * cmPerCell;
        r1[j * GW + i] = Math.hypot(x - x1, y - y1);
        r2[j * GW + i] = Math.hypot(x - x2, y - y2);
      }
    }
    geometry();

    function fill() {
      const k = (2 * Math.PI) / lambda, w = k * SPEED;
      const d = img.data;
      for (let p = 0; p < GW * GH; p++) {
        const a1 = 1 / Math.sqrt(0.6 + r1[p]), a2 = twoSources ? 1 / Math.sqrt(0.6 + r2[p]) : 0;
        let v: number;
        if (view === 'waves') {
          v = a1 * Math.cos(k * r1[p] - w * t) + a2 * Math.cos(k * r2[p] - w * t + phase);
          v *= 1.6;
        } else {
          // time average of (sum)^2 = (a1² + a2² + 2 a1 a2 cos Δφ) / 2
          v = (a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(k * (r1[p] - r2[p]) - phase)) * 1.4;
        }
        const s = Math.max(-1, Math.min(1, v));
        const c = s >= 0 ? cPos : cNeg, m = Math.abs(s);
        const q = p * 4;
        d[q] = 255 * (cBg[0] + (c[0] - cBg[0]) * m);
        d[q + 1] = 255 * (cBg[1] + (c[1] - cBg[1]) * m);
        d[q + 2] = 255 * (cBg[2] + (c[2] - cBg[2]) * m);
        d[q + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
    }

    const loop = new Loop((dt) => { t += dt; }, render, 1 / 60);

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      fill();
      const stripW = Math.max(40, W * 0.1);
      const fw = W - stripW;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, GW * (fw / W), GH, 0, 0, fw, H);
      const sx = fw / (TANK_W * (fw / W)); // px per cm in the drawn region
      const sy = H / TANK_H;
      // sources
      src().forEach(([x, y], i) => {
        if (i === 1 && !twoSources) return;
        ctx.beginPath(); ctx.arc(x * sx, y * sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = pal.fg; ctx.fill();
        ctx.strokeStyle = pal.bg; ctx.lineWidth = 1.5; ctx.stroke();
      });
      // screen: time-averaged intensity along the right edge of the drawn tank
      const k = (2 * Math.PI) / lambda;
      const xs = TANK_W * (fw / W);
      const [[x1, y1], [x2, y2]] = src();
      ctx.fillStyle = pal.bg; ctx.fillRect(fw, 0, stripW, H);
      ctx.strokeStyle = pal.rule; ctx.beginPath(); ctx.moveTo(fw + 0.5, 0); ctx.lineTo(fw + 0.5, H); ctx.stroke();
      ctx.beginPath();
      let maxI = 0;
      const Is: number[] = [];
      for (let py = 0; py <= H; py += 2) {
        const y = py / sy;
        const d1 = Math.hypot(xs - x1, y - y1), d2 = Math.hypot(xs - x2, y - y2);
        const a1 = 1 / Math.sqrt(d1), a2 = twoSources ? 1 / Math.sqrt(d2) : 0;
        const I = a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(k * (d1 - d2) - phase);
        Is.push(I); maxI = Math.max(maxI, I);
      }
      Is.forEach((I, n) => {
        const X = fw + 6 + (stripW - 12) * (I / maxI), Y = n * 2;
        n ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      });
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = pal.muted; ctx.textAlign = 'center';
      ctx.fillText('screen', fw + stripW / 2, 14);
      // scale bar: one wavelength
      ctx.textAlign = 'left';
      const bx = 12, by = H - 14;
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + lambda * sx, by); ctx.stroke();
      ctx.fillStyle = pal.fg;
      ctx.fillText(`λ = ${fmt(lambda, 2)} cm`, bx + lambda * sx + 6, by + 4);
    }

    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    const viewSel = panel.select('View', [
      { value: 'waves', label: 'Wave height' },
      { value: 'intensity', label: 'Time-averaged intensity' },
    ], view, (v) => { view = v; loop.invalidate(); });
    void viewSel;
    panel.slider('Wavelength', { min: 0.8, max: 6, value: lambda, step: 0.05, unit: 'cm' }, (v) => { lambda = v; update(); });
    panel.slider('Separation', { min: 0, max: 16, value: sep, step: 0.1, unit: 'cm' }, (v) => { sep = v; geometry(); update(); });
    panel.slider('Phase of source 2', { min: 0, max: 360, value: 0, step: 1, unit: '°' }, (v) => { phase = (v * Math.PI) / 180; update(); });
    panel.toggle('Second source', true, (v) => { twoSources = v; update(); });
    const ro = panel.readout('d/λ');
    const rf = panel.readout('Nearest dark line at');
    function update() {
      ro.set(twoSources ? fmt(sep / lambda, 3) : '—');
      // dark where k·d·sinθ − φ = (2m+1)π; report the dark direction closest to straight ahead
      const kd = ((2 * Math.PI) / lambda) * sep;
      let best = Infinity;
      for (let m = -40; m <= 40; m++) {
        const sn = ((2 * m + 1) * Math.PI + phase) / kd;
        if (Math.abs(sn) <= 1 && Math.abs(sn) < Math.abs(best)) best = sn;
      }
      rf.set(!twoSources ? 'none (one source)' : !Number.isFinite(best) ? 'none (d too small)' : `θ = ${fmt((Math.asin(Math.abs(best)) * 180) / Math.PI, 3)}°`);
      loop.invalidate();
    }
    update();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
