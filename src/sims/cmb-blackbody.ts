// Chapter 27: the CMB spectrum vs a Planck curve, in the style of the COBE/FIRAS plot.
// "Data" points are drawn at the FIRAS frequencies from a 2.7255 K blackbody with FIRAS-sized
// uncertainties (illustrative, not the published table). The lower panel shows residuals in kJy/sr,
// where a 0.1 mK error in T, or a Compton-y distortion at the FIRAS limit, is visible.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { h, c, kB } from '../lib/physics/constants';

const T0 = 2.7255;
const JY = 1e-26;
/** Planck B_ν in MJy/sr for wavenumber σ in cm⁻¹. */
function Bnu(sig: number, T: number) {
  const nu = c * 100 * sig;
  return ((2 * h * nu ** 3) / (c * c) / Math.expm1((h * nu) / (kB * T))) / JY / 1e6;
}
/** Thermal SZ / Compton-y distortion ΔI_ν (MJy/sr) for y = 1. */
function yShape(sig: number, T: number) {
  const x = (h * c * 100 * sig) / (kB * T);
  const I0 = (2 * (kB * T) ** 3) / (h * c) ** 2 / JY / 1e6;
  const ex = Math.exp(x);
  return I0 * ((x ** 4 * ex) / (ex - 1) ** 2) * (x / Math.tanh(x / 2) - 4);
}

const SIG = Array.from({ length: 43 }, (_, i) => 2.27 + i * 0.4535);
const ERR_KJY = SIG.map((s) => 10 + 40 * Math.exp(-((s - 5) ** 2) / 20)); // illustrative 1σ, kJy/sr

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const s1 = createStage(host, { aspect: 1.9 });
    const s2 = createStage(host, { aspect: 4.2 });
    const top = new Plot(s1.canvas, { x: { min: 0, max: 23, label: '' }, y: { min: 0, max: 420, label: 'I_ν (MJy/sr)' }, title: 'CMB spectrum (FIRAS-like points, error bars ×400)' });
    const bot = new Plot(s2.canvas, { x: { min: 0, max: 23, label: 'wavenumber (cm⁻¹)   [1 cm⁻¹ = 30 GHz]' }, y: { min: -300, max: 300, label: 'model − data (kJy/sr)' }, margin: { l: 56, r: 16, t: 8, b: 38 } });

    let T = T0, y = 0;
    const model = (s: number) => Bnu(s, T) + y * yShape(s, T);
    const loop = new Loop(null, render);
    let dirty = true;
    function render() {
      if (!dirty) return;
      dirty = false;
      top.draw(() => {
        top.fn(model, { color: pal.accent, width: 2 });
        const ctx = top.ctx;
        ctx.strokeStyle = pal.fg; ctx.lineWidth = 1;
        SIG.forEach((s, i) => {
          const v = Bnu(s, T0), e = (ERR_KJY[i] / 1000) * 400;
          ctx.beginPath(); ctx.moveTo(top.px(s), top.py(v - e)); ctx.lineTo(top.px(s), top.py(v + e)); ctx.stroke();
        });
        top.scatter(SIG, SIG.map((s) => Bnu(s, T0)), { size: 3, color: pal.fg });
        top.text(`model T = ${T.toFixed(4)} K${y ? `, y = ${fmt(y, 2)}` : ''}`, top.px(12), top.py(360), { color: pal.accent });
      });
      let chi = 0;
      bot.draw(() => {
        bot.hline(0, { color: pal.faint });
        bot.fn((s) => (model(s) - Bnu(s, T0)) * 1000, { color: pal.accent, width: 2 });
        const ctx = bot.ctx;
        ctx.strokeStyle = pal.fg; ctx.lineWidth = 1;
        SIG.forEach((s, i) => {
          const e = ERR_KJY[i];
          ctx.beginPath(); ctx.moveTo(bot.px(s), bot.py(-e)); ctx.lineTo(bot.px(s), bot.py(e)); ctx.stroke();
          chi += (((model(s) - Bnu(s, T0)) * 1000) / e) ** 2;
        });
        bot.scatter(SIG, SIG.map(() => 0), { size: 3, color: pal.fg });
      });
      rChi.set(`${fmt(chi, 3)} for 43 points`);
    }
    s1.onResize((w, hh, d) => { top.resize(w, hh, d); dirty = true; loop.invalidate(); });
    s2.onResize((w, hh, d) => { bot.resize(w, hh, d); dirty = true; loop.invalidate(); });
    onThemeChange(() => { pal = palette(); dirty = true; });

    const panel = new Panel(host);
    panel.slider('Model temperature', { min: 2.72, max: 2.735, value: T, step: 0.0001, unit: 'K', format: (v) => v.toFixed(4) }, (v) => { T = v; dirty = true; });
    panel.slider('Compton y', { min: 0, max: 3e-4, value: 0, step: 1e-6, format: (v) => (v ? fmt(v, 2) : '0') }, (v) => { y = v; dirty = true; });
    const rChi = panel.readout('χ² =');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
